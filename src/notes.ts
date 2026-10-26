// Gemeinsame Notizen und Listen (v0.11).
import { getAllRaw, newId, put, type BaseRecord, type Person } from './db';

export interface NoteItem {
  id: string;
  text: string;
  done: boolean;
  parent: string | null; // null = Hauptpunkt, sonst ID des Hauptpunkts (nur eine Ebene)
  sort: number;
  at: number; // letzte Änderung dieses Punkts (für das Zusammenführen)
  deleted: boolean;
}

export interface Pin {
  on: boolean;
  at: number;
}

export interface Note extends BaseRecord {
  kind: 'note' | 'list';
  title: string;
  body: string; // Text einer Notiz
  items: NoteItem[]; // Punkte einer Liste
  private: boolean; // nur für die erfassende Person sichtbar (auch in der Cloud geschützt)
  createdBy: string | null; // Personen-ID
  createdAt: number;
  editedBy: string | null; // Personen-ID der letzten Änderung
  pins: Record<string, Pin>; // pro Person: angeheftet (Startseite)
}

export function blankNote(kind: Note['kind'], me: string | null): Note {
  const now = Date.now();
  return {
    id: newId(),
    kind,
    title: '',
    body: '',
    items: [],
    private: false,
    createdBy: me,
    createdAt: now,
    editedBy: me,
    pins: {},
    updatedAt: 0,
    deleted: false,
  };
}

// ---------- Zusammenführen (zwei Handys ändern dieselbe Liste) ----------

/**
 * Führt zwei Fassungen derselben Notiz/Liste zusammen: Titel/Text von der neueren Fassung,
 * Listenpunkte und Anheft-Zustände einzeln (neuere Änderung pro Punkt gewinnt).
 * So gehen Änderungen nicht verloren, wenn zwei Personen gleichzeitig abhaken oder ergänzen.
 */
export function mergeNote(a: Note, b: Note): Note {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  // Gelöscht (oder ohne Inhalt als «privat geworden» markiert): nichts zusammenführen, nichts zurückholen
  if (newer.deleted) return { ...newer, updatedAt: Math.max(a.updatedAt, b.updatedAt) + 1 };
  const items = new Map<string, NoteItem>();
  for (const it of [...(b.items ?? []), ...(a.items ?? [])]) {
    const cur = items.get(it.id);
    // bei gleichem Zeitpunkt gewinnt die Fassung «a» (zuletzt eingefügt)
    if (!cur || it.at >= cur.at) items.set(it.id, it);
  }
  const pins: Record<string, Pin> = { ...(b.pins ?? {}) };
  for (const [k, p] of Object.entries(a.pins ?? {})) {
    if (!pins[k] || p.at >= pins[k].at) pins[k] = p;
  }
  return { ...newer, items: [...items.values()], pins, updatedAt: Math.max(a.updatedAt, b.updatedAt) + 1 };
}

// ---------- Hilfen ----------

/** Hauptpunkte (nicht gelöscht) in Anzeige-Reihenfolge: offene zuerst, Erledigte unten. */
export function topItems(n: Note): NoteItem[] {
  return orderItems((n.items ?? []).filter((i) => !i.deleted && !i.parent));
}
export function subItems(n: Note, parent: string): NoteItem[] {
  return orderItems((n.items ?? []).filter((i) => !i.deleted && i.parent === parent));
}
function orderItems(list: NoteItem[]): NoteItem[] {
  return [...list].sort((x, y) => (x.done === y.done ? x.sort - y.sort : x.done ? 1 : -1));
}

/** Fortschritt einer Liste: alle Punkte (Haupt- und Unterpunkte) zählen. */
export function progress(n: Note): { done: number; total: number } {
  const live = (n.items ?? []).filter((i) => !i.deleted);
  return { done: live.filter((i) => i.done).length, total: live.length };
}

export const isPinnedFor = (n: Note, me: string | null) => !!me && !!n.pins?.[me]?.on;
export const pinnedCount = (n: Note) => Object.values(n.pins ?? {}).filter((p) => p.on).length;
export const isPinnedForAll = (n: Note, persons: Person[]) =>
  persons.length > 1 && persons.every((p) => n.pins?.[p.id]?.on);

/** Erste Zeile(n) einer Notiz als Vorschau. */
export function preview(n: Note): string {
  if (n.kind === 'list') {
    const open = topItems(n).filter((i) => !i.done);
    const p = progress(n);
    if (!p.total) return 'Leere Liste';
    const head = open.slice(0, 2).map((i) => i.text).join(' · ');
    return `${p.done}/${p.total} erledigt${head ? ' · ' + head : ''}`;
  }
  return n.body.trim().replace(/\s+/g, ' ') || 'Leere Notiz';
}

/** Neueste zuerst; für «Meine Anheftungen» zuerst. */
export function sortNotes(list: Note[], me: string | null): Note[] {
  return [...list].sort((a, b) => {
    const pa = isPinnedFor(a, me), pb = isPinnedFor(b, me);
    if (pa !== pb) return pa ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export function fmtAgo(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = new Date(ts);
  const days = Math.round((now - ts) / 86400000);
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

/**
 * Notiz ändern: liest immer die neueste gespeicherte Fassung und wendet die Änderung darauf an
 * (so überschreiben sich Änderungen von der Cloud und eigene Eingaben nicht).
 */
export async function updateNote(base: Note, me: string | null, fn: (n: Note) => Note): Promise<Note> {
  const stored = (await getAllRaw<Note>('notes')).find((x) => x.id === base.id);
  const cur = stored && !stored.deleted ? stored : base;
  const next = { ...fn(cur), editedBy: me };
  await put<Note>('notes', next);
  return next;
}

export function addItem(n: Note, text: string, parent: string | null): Note {
  const sibs = (n.items ?? []).filter((i) => i.parent === parent);
  const sort = sibs.reduce((m, i) => Math.max(m, i.sort), 0) + 1;
  const item: NoteItem = { id: newId(), text, done: false, parent, sort, at: Date.now(), deleted: false };
  return { ...n, items: [...(n.items ?? []), item] };
}

export function patchItem(n: Note, id: string, patch: Partial<NoteItem>): Note {
  const at = Date.now();
  return { ...n, items: (n.items ?? []).map((i) => (i.id === id ? { ...i, ...patch, at } : i)) };
}

/** Punkt löschen; bei einem Hauptpunkt auch seine Unterpunkte. Gelöschte bleiben als Vermerk (fürs Zusammenführen). */
export function deleteItem(n: Note, id: string): Note {
  const at = Date.now();
  return { ...n, items: (n.items ?? []).map((i) => (i.id === id || i.parent === id ? { ...i, deleted: true, at } : i)) };
}

export function clearDoneItems(n: Note): Note {
  const at = Date.now();
  const doneTop = new Set((n.items ?? []).filter((i) => !i.deleted && !i.parent && i.done).map((i) => i.id));
  return {
    ...n,
    items: (n.items ?? []).map((i) => (!i.deleted && (i.done || (i.parent && doneTop.has(i.parent))) ? { ...i, deleted: true, at } : i)),
  };
}

export function setPin(n: Note, personIds: string[], on: boolean): Note {
  const at = Date.now();
  const pins = { ...(n.pins ?? {}) };
  for (const id of personIds) pins[id] = { on, at };
  return { ...n, pins };
}
