// Datensicherung (v0.31, E52): alle Einträge und Dokumente dieses Handys als ZIP-Datei.
// Inhalt: daten.json (alle Einträge), dokumente/… (die Dateien, direkt am PC lesbar), LIESMICH.txt.
// Einlesen holt nur zurück, was fehlt oder gelöscht wurde. Bestehendes bleibt, wie es ist.
import { STORES, getAllRaw, getFile, getMeta, localChanges, putFile, putRaw, setMeta, type BaseRecord, type Person, type StoreName } from './db';
import { downloadDocFile, getSession } from './cloud';
import { extOf, uploadPending, type Doc } from './docs';
import { makeZip, readZip } from './zip';

declare const __APP_VERSION__: string;

export const BACKUP_FORMAT = 1;

export interface BackupData {
  app: 'myFam.';
  format: number;
  version: string;
  created: number;
  household: string | null;
  stores: Partial<Record<StoreName, BaseRecord[]>>;
  files: Record<string, string>; // Dokument-ID → Pfad in der ZIP-Datei
}

export interface BackupResult {
  blob: Blob;
  name: string;
  records: number;
  docs: number;
  missing: string[]; // Dokumente ohne Datei (nicht auf dem Handy, offline)
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Sicherung erstellen. onStep meldet den Fortschritt («Dokument 3 von 12»). */
export async function createBackup(onStep: (msg: string) => void = () => {}): Promise<BackupResult> {
  const now = new Date();
  const stores: BackupData['stores'] = {};
  let records = 0;
  for (const s of STORES) {
    const list = (await getAllRaw(s)).filter((r) => !r.deleted).map(({ dirty, ...r }) => r as BaseRecord);
    stores[s] = list;
    records += list.length;
  }
  const docs = (stores.docs ?? []) as Doc[];
  const files: Record<string, string> = {};
  const entries: { name: string; data: Blob }[] = [];
  const missing: string[] = [];
  const used = new Set<string>();
  const online = navigator.onLine && !!(await getSession());
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    onStep(`Dokument ${i + 1} von ${docs.length}`);
    let blob: Blob | undefined = (await getFile(d.id))?.blob;
    if (!blob && d.file?.path && online) {
      try {
        blob = await downloadDocFile(d.file.path); // nur für die Sicherung, keine Kopie aufs Handy
      } catch {
        /* unten als fehlend melden */
      }
    }
    if (!blob) {
      missing.push(d.title || 'Dokument');
      continue;
    }
    let name = (d.file?.name || `Dokument.${extOf(blob.type)}`).replace(/[\\/]+/g, '-');
    if (used.has(name.toLowerCase())) name = name.replace(/(\.[a-z0-9]+)?$/i, ` (${d.id.slice(0, 6)})$1`);
    used.add(name.toLowerCase());
    files[d.id] = 'dokumente/' + name;
    entries.push({ name: files[d.id], data: blob });
  }
  onStep('Datei wird erstellt …');
  const hh = await getMeta<{ name?: string }>('household');
  const data: BackupData = {
    app: 'myFam.',
    format: BACKUP_FORMAT,
    version: __APP_VERSION__,
    created: now.getTime(),
    household: hh?.name ?? null,
    stores,
    files,
  };
  const readme = [
    'myFam. – Datensicherung vom ' + now.toLocaleString('de-CH'),
    '',
    'daten.json   alle Einträge (Menüs, Wochenplan, Einkauf, ToDos, Notizen, Familie, Grüsse, Angaben zu den Dokumenten …)',
    'dokumente/   die Dokumente als PDF/Bild, direkt lesbar',
    '',
    'Zurückholen: in der App Mehr → Einstellungen → Datensicherung → «Sicherung einlesen».',
    'Dabei kommt nur zurück, was fehlt oder gelöscht wurde. Bestehende Einträge bleiben, wie sie sind.',
    'Termine sind bei Google gespeichert und nicht in dieser Datei.',
    missing.length ? `\nOhne Datei (war nicht auf dem Handy und ohne Internet nicht ladbar): ${missing.join(', ')}` : '',
  ].join('\r\n');
  const blob = await makeZip(
    [{ name: 'daten.json', data: JSON.stringify(data, null, 1) }, { name: 'LIESMICH.txt', data: readme }, ...entries],
    now,
  );
  await setMeta('lastBackup', now.getTime());
  return { blob, name: `myFam-Sicherung-${stamp(now)}.zip`, records, docs: entries.length, missing };
}

export const lastBackup = () => getMeta<number>('lastBackup');

export interface BackupPreview {
  data: BackupData;
  counts: { store: StoreName; total: number; restore: number }[];
  restore: number; // so viele Einträge kommen zurück
  read(name: string): Promise<Blob | null>;
}

/** Sicherungsdatei lesen und zählen, was zurückkommen würde (ändert noch nichts). */
export async function readBackup(file: Blob): Promise<BackupPreview> {
  let list;
  try {
    list = await readZip(file);
  } catch {
    throw new Error('Das ist keine Sicherungsdatei von myFam. (keine ZIP-Datei).');
  }
  const main = list.find((f) => f.name === 'daten.json');
  if (!main) throw new Error('Das ist keine Sicherungsdatei von myFam. (daten.json fehlt).');
  let data: BackupData;
  try {
    data = JSON.parse(await (await main.read()).text());
  } catch {
    throw new Error('Die Sicherungsdatei ist beschädigt.');
  }
  if (data?.app !== 'myFam.' || typeof data.stores !== 'object') throw new Error('Das ist keine Sicherungsdatei von myFam.');
  if (data.format > BACKUP_FORMAT) throw new Error('Diese Sicherung stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  const counts: BackupPreview['counts'] = [];
  let restore = 0;
  for (const s of STORES) {
    const recs = data.stores[s] ?? [];
    if (!recs.length) continue;
    const local = new Map((await getAllRaw(s)).map((r) => [r.id, r]));
    const n = recs.filter((r) => !local.get(r.id) || local.get(r.id)!.deleted).length;
    counts.push({ store: s, total: recs.length, restore: n });
    restore += n;
  }
  const byName = new Map(list.map((f) => [f.name, f]));
  return { data, counts, restore, read: async (name) => (byName.has(name) ? byName.get(name)!.read() : null) };
}

/**
 * Zurückholen: Einträge, die auf dem Handy fehlen oder gelöscht sind, kommen zurück und werden
 * beim nächsten Abgleich für alle übernommen (neuer Zeitstempel = gewinnt gegen den Löschvermerk).
 */
export async function restoreBackup(p: BackupPreview): Promise<number> {
  let n = 0;
  let t = Date.now();
  for (const s of STORES) {
    const recs = p.data.stores[s] ?? [];
    if (!recs.length) continue;
    const localAll = await getAllRaw(s);
    const local = new Map(localAll.map((r) => [r.id, r]));
    const back: BaseRecord[] = [];
    for (const r of recs) {
      const mine = local.get(r.id);
      if (mine && !mine.deleted) continue;
      back.push({ ...r, id: r.id, deleted: false, updatedAt: t++, dirty: true });
    }
    if (s === 'persons') {
      // Neu eingerichtete Familie (z.B. nach einem Umzug): gleichnamige neue Person durch die gesicherte ersetzen
      const backIds = new Set((recs as Person[]).map((r) => r.id));
      const names = new Set((back as Person[]).map((r) => r.name.trim().toLowerCase()));
      for (const l of localAll as Person[]) {
        if (!l.deleted && !backIds.has(l.id) && names.has(l.name.trim().toLowerCase())) back.push({ ...l, deleted: true, updatedAt: t++, dirty: true });
      }
    }
    const files: [string, Blob][] = [];
    if (s === 'docs') {
      for (const d of back as Doc[]) {
        if (d.deleted) continue;
        const path = p.data.files?.[d.id];
        const blob = path ? await p.read(path) : null;
        if (blob) {
          files.push([d.id, blob.type ? blob : new Blob([blob], { type: d.file?.type || 'application/pdf' })]);
          d.file = { ...d.file, path: null }; // wird neu in die Ablage geladen
        }
      }
    }
    await putRaw(s, back);
    for (const [id, blob] of files) await putFile(id, { blob, pending: true });
    n += back.filter((r) => !r.deleted || !local.has(r.id)).length;
  }
  localChanges.dispatchEvent(new Event('change'));
  void uploadPending();
  return n;
}
