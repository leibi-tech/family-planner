// Abgleich zwischen Handy und Cloud (Phase 2).
// Ablauf: 1) lokale Änderungen hochladen (dirty), 2) Änderungen der anderen herunterladen.
// Bei Konflikten gewinnt die neuere Änderung (updatedAt) – lokal wie auf dem Server.
import { STORES, clearStore, getAllRaw, getMeta, localChanges, putRaw, setMeta, type BaseRecord, type StoreName } from './db';
import {
  CloudError,
  getSession,
  myMembership,
  onSessionChange,
  pullRecords,
  pushRecords,
  type CloudRecord,
  type Household,
  type Membership,
} from './cloud';

export interface SyncState {
  household: Household | null;
  status: 'aus' | 'bereit' | 'läuft' | 'fehler' | 'offline';
  lastSync: number | null;
  error: string | null;
  membership: Membership | null; // eigene Rolle und Person im Haushalt
}

let state: SyncState = { household: null, status: 'aus', lastSync: null, error: null, membership: null };

/** Darf dieses Gerät Personen/Faktoren ändern? Ohne Haushalt: ja (nur lokal). */
export const isAdmin = (s: SyncState = state) =>
  !s.household || !s.membership || s.membership.role === 'owner' || s.membership.role === 'admin';
const events = new EventTarget();
const emit = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  events.dispatchEvent(new Event('change'));
};
export const getSyncState = () => state;
export const onSyncChange = (fn: () => void) => {
  events.addEventListener('change', fn);
  return () => events.removeEventListener('change', fn);
};

const stripLocal = (r: BaseRecord) => {
  const { dirty, ...data } = r;
  return data;
};

let running: Promise<void> | null = null;
let again = false;

/** Einmal abgleichen. Läuft schon ein Abgleich, wird danach nochmals abgeglichen. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => (running = null));
  return running;
}

async function syncOnce() {
  const hh = state.household;
  if (!hh || !(await getSession())) return;
  if (!navigator.onLine) return emit({ status: 'offline' });
  emit({ status: 'läuft', error: null });
  try {
    // 1) Hochladen
    const rows: CloudRecord[] = [];
    const privateRows: CloudRecord[] = []; // private ToDos: getrennt, mit owner_id (nur dieses Konto sieht sie)
    const uid = (await getSession())!.user.id;
    const dirtyByStore = new Map<StoreName, BaseRecord[]>();
    for (const store of STORES) {
      if (store === 'persons' && !isAdmin()) continue; // Personen ändert nur der Admin
      const dirty = (await getAllRaw(store)).filter((r) => r.dirty);
      if (!dirty.length) continue;
      dirtyByStore.set(store, dirty);
      for (const r of dirty) {
        const row: CloudRecord = { household_id: hh.id, store, id: r.id, data: stripLocal(r), updated_at: r.updatedAt, deleted: r.deleted };
        if ((r as any).private === true) privateRows.push({ ...row, owner_id: uid });
        else rows.push(row);
      }
    }
    if (rows.length || privateRows.length) {
      if (rows.length) await pushRecords(rows);
      if (privateRows.length) await pushRecords(privateRows);
      // Nur als «hochgeladen» markieren, wenn sich der Eintrag inzwischen nicht wieder geändert hat
      for (const [store, sent] of dirtyByStore) {
        const now = new Map((await getAllRaw(store)).map((r) => [r.id, r]));
        const done = sent
          .filter((r) => now.get(r.id)?.updatedAt === r.updatedAt)
          .map((r) => ({ ...now.get(r.id)!, dirty: false }));
        await putRaw(store, done);
      }
    }

    // 2) Herunterladen
    const since = (await getMeta<string>('lastPull:' + hh.id)) ?? null;
    const incoming = await pullRecords(hh.id, since);
    const byStore = new Map<string, CloudRecord[]>();
    for (const r of incoming) {
      if (!(STORES as readonly string[]).includes(r.store)) continue; // unbekannte Art (neuere App-Version)
      (byStore.get(r.store) ?? byStore.set(r.store, []).get(r.store)!).push(r);
    }
    for (const [store, list] of byStore) {
      const local = new Map((await getAllRaw(store as StoreName)).map((r) => [r.id, r]));
      const apply: BaseRecord[] = [];
      for (const r of list) {
        const mine = local.get(r.id);
        if (mine && mine.dirty && mine.updatedAt > r.updated_at) continue; // meine Änderung ist neuer
        if (mine && !mine.dirty && mine.updatedAt === r.updated_at && mine.deleted === r.deleted) continue;
        apply.push({ ...r.data, id: r.id, updatedAt: r.updated_at, deleted: r.deleted, dirty: false });
      }
      await putRaw(store as StoreName, apply);
    }
    if (incoming.length) await setMeta('lastPull:' + hh.id, incoming[incoming.length - 1].server_updated_at);
    emit({ status: 'bereit', lastSync: Date.now(), error: null });
  } catch (e) {
    const msg = e instanceof CloudError ? e.message : String(e);
    emit({ status: navigator.onLine ? 'fehler' : 'offline', error: msg });
  }
}

/** Eigene Rolle/Person vom Server holen (und offline merken). */
export async function refreshMembership(): Promise<void> {
  const hh = state.household;
  if (!hh || !navigator.onLine) return;
  try {
    const m = await myMembership(hh.id);
    if (!m) {
      // nicht mehr Mitglied (vom Admin entfernt)
      await disconnect();
      emit({ error: 'Du bist nicht mehr Mitglied dieses Haushalts.' });
      return;
    }
    await setMeta('membership:' + hh.id, m);
    const wasAdmin = isAdmin();
    emit({ membership: m });
    if (!isAdmin()) {
      // Lokale Personen-Änderungen verwerfen und Personen frisch vom Server holen
      const persons = await getAllRaw('persons');
      if (persons.some((p) => p.dirty) || wasAdmin) {
        await putRaw('persons', persons.map((p) => ({ ...p, dirty: false, updatedAt: 0 })));
        await setMeta('lastPull:' + hh.id, undefined);
        syncNow();
      }
    }
  } catch {
    /* offline – später nochmals */
  }
}

/** Haushalt merken und Abgleich starten. mode: 'upload' = lokale Daten hochladen, 'replace' = lokale Daten ersetzen. */
export async function connectHousehold(hh: Household, mode: 'upload' | 'replace') {
  if (mode === 'replace') {
    for (const store of STORES) await clearStore(store);
  } else {
    // alles Bestehende einmalig als «noch hochzuladen» markieren
    for (const store of STORES) {
      const all = await getAllRaw(store);
      await putRaw(store, all.map((r) => ({ ...r, dirty: true })));
    }
  }
  await setMeta('lastPull:' + hh.id, undefined);
  await setMeta('household', hh);
  emit({ household: hh, status: 'bereit', error: null, membership: null });
  await refreshMembership();
  await syncNow();
}

export async function disconnect() {
  await setMeta('household', undefined);
  emit({ household: null, status: 'aus', lastSync: null, error: null, membership: null });
}

let timer: number | undefined;
const soon = (ms = 1500) => {
  clearTimeout(timer);
  timer = window.setTimeout(() => syncNow(), ms);
};

/** Beim App-Start einmal aufrufen. */
export async function startSync() {
  const hh = (await getMeta<Household>('household')) ?? null;
  const s = await getSession();
  const mem = hh ? ((await getMeta<Membership>('membership:' + hh.id)) ?? null) : null;
  emit({ household: s ? hh : null, status: s && hh ? 'bereit' : 'aus', membership: mem });
  localChanges.addEventListener('change', () => soon());
  window.addEventListener('online', () => soon(200));
  window.addEventListener('offline', () => state.household && emit({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    soon(200);
    refreshMembership();
  });
  window.setInterval(() => document.visibilityState === 'visible' && syncNow(), 30000);
  onSessionChange(async () => {
    if (!(await getSession())) emit({ household: null, status: 'aus' });
  });
  if (s && hh) {
    refreshMembership();
    syncNow();
  }
  window.setInterval(() => document.visibilityState === 'visible' && refreshMembership(), 120000);
}

/** Bereits verbundenen Haushalt nach erneuter Anmeldung weiterverwenden (Daten bleiben). */
export async function resumeHousehold(hh: Household) {
  await setMeta('household', hh);
  emit({ household: hh, status: 'bereit', error: null, membership: (await getMeta<Membership>('membership:' + hh.id)) ?? null });
  await refreshMembership();
  await syncNow();
}

export async function storedHouseholdId(): Promise<string | null> {
  return (await getMeta<Household>('household'))?.id ?? null;
}
