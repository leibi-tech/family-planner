// Dokumente (v0.21): Versicherungen, Garantien, Quittungen … Angaben laufen über den normalen
// Abgleich (Tabelle «docs»), die Datei selbst liegt in der Supabase-Ablage (Storage) und als Kopie
// auf dem Handy. Ohne Internet wird die Datei später hochgeladen.
import { useEffect, useState } from 'react';
import { fileKeys, getAllRaw, getFile, getMeta, newId, put, putFile, remove, setMeta, type BaseRecord } from './db';
import { CloudError, deleteDocFiles, downloadDocFile, getSession, uploadDocFile } from './cloud';
import { getSyncState, onSyncChange } from './sync';

export const CATEGORIES = [
  { id: 'versicherung', label: 'Versicherung' },
  { id: 'garantie', label: 'Garantie' },
  { id: 'rechnung', label: 'Quittung / Rechnung' },
  { id: 'vertrag', label: 'Vertrag' },
  { id: 'gesundheit', label: 'Gesundheit' },
  { id: 'steuern', label: 'Steuern' },
  { id: 'schule', label: 'Schule / Kinder' },
  { id: 'anderes', label: 'Anderes' },
] as const;
export type Category = (typeof CATEGORIES)[number]['id'];
export const catLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? 'Anderes';

export interface DocFile {
  name: string; // Dateiname beim Teilen/Herunterladen
  type: string; // application/pdf, image/jpeg …
  size: number; // Bytes
  pages: number; // Seiten (bei Scans), sonst 1
  path: string | null; // Ort in der Ablage, sobald hochgeladen
}

export interface Doc extends BaseRecord {
  title: string;
  category: Category;
  date: string | null; // Datum des Dokuments / Kaufdatum (JJJJ-MM-TT)
  until: string | null; // gültig bis / Garantie bis
  note: string;
  thumb: string | null; // kleines Vorschaubild (data-URL), auch offline
  file: DocFile;
  createdAt: number;
  by: string | null; // Person, die es erfasst hat
}

export const MAX_SIZE = 20 * 1024 * 1024;

const events = new EventTarget();
const emit = () => events.dispatchEvent(new Event('files'));

/** Dateiname aus Titel und Datum, z.B. «2026-10-30 Garantie Waschmaschine.pdf». */
export function fileNameFor(d: Pick<Doc, 'title' | 'date'>, type: string): string {
  const ext = extOf(type);
  const base = `${d.date ? d.date + ' ' : ''}${d.title || 'Dokument'}`.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80);
  return `${base}.${ext}`;
}
export const extOf = (type: string) => (type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg');

/** Neues Dokument speichern. Die Datei bleibt auf dem Handy, bis sie hochgeladen ist. */
export async function saveNewDoc(meta: Omit<Doc, 'id' | 'updatedAt' | 'deleted' | 'file' | 'createdAt'>, blob: Blob, pages: number): Promise<Doc> {
  const id = newId();
  const doc: Doc = {
    ...meta,
    id,
    createdAt: Date.now(),
    file: { name: fileNameFor(meta, blob.type), type: blob.type, size: blob.size, pages, path: null },
    updatedAt: 0,
    deleted: false,
  };
  await putFile(id, { blob, pending: true });
  await put('docs', doc);
  emit();
  void uploadPending();
  return doc;
}

export async function updateDoc(doc: Doc, patch: Partial<Doc>) {
  const next = { ...doc, ...patch };
  next.file = { ...next.file, name: fileNameFor(next, next.file.type) };
  await put('docs', next);
}

export async function deleteDoc(doc: Doc) {
  await remove<Doc>('docs', { ...doc, thumb: null });
  await putFile(doc.id, undefined);
  if (doc.file.path) {
    const q = (await getMeta<string[]>('docDeletes')) ?? [];
    await setMeta('docDeletes', [...q, doc.file.path]);
  }
  emit();
  void uploadPending();
}

/** Datei holen: zuerst die Kopie auf dem Handy, sonst aus der Ablage (und merken). */
export async function loadDocFile(doc: Doc): Promise<Blob> {
  const local = await getFile(doc.id);
  if (local) return local.blob;
  if (!doc.file.path) throw new CloudError('Die Datei ist noch auf dem Handy, mit dem sie erfasst wurde. Sie erscheint hier, sobald jenes Handy online war.');
  if (!navigator.onLine) throw new CloudError('Ohne Internet nicht verfügbar. Diese Datei wurde auf diesem Handy noch nie geöffnet.');
  const blob = await downloadDocFile(doc.file.path);
  await putFile(doc.id, { blob, pending: false });
  emit();
  return blob;
}

let running: Promise<void> | null = null;
let again = false;
let lastError: string | null = null;
export const uploadError = () => lastError;

/** Wartende Dateien hochladen und gelöschte in der Ablage entfernen. */
export function uploadPending(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await uploadOnce();
    } while (again);
  })().finally(() => (running = null));
  return running;
}

async function uploadOnce() {
  const hh = getSyncState().household;
  const docs = new Map((await getAllRaw<Doc>('docs')).map((d) => [d.id, d]));
  const keys = await fileKeys();
  // Aufräumen: Kopien von Dokumenten, die (auch auf einem anderen Handy) gelöscht wurden
  for (const id of keys) {
    const d = docs.get(id);
    if (!d || d.deleted) {
      const f = await getFile(id);
      if (f && (!f.pending || d?.deleted)) await putFile(id, undefined);
    }
  }
  if (!hh || !navigator.onLine || !(await getSession())) return;
  try {
    const del = (await getMeta<string[]>('docDeletes')) ?? [];
    if (del.length) {
      await deleteDocFiles(del);
      const now = (await getMeta<string[]>('docDeletes')) ?? [];
      await setMeta('docDeletes', now.filter((p) => !del.includes(p)));
    }
    for (const id of await fileKeys()) {
      const f = await getFile(id);
      const d = docs.get(id);
      if (!f?.pending || !d || d.deleted) continue;
      const path = `${hh.id}/${id}.${extOf(f.blob.type)}`;
      await uploadDocFile(path, f.blob);
      await putFile(id, { blob: f.blob, pending: false });
      // frisch lesen: Angaben könnten inzwischen geändert worden sein
      const cur = (await getAllRaw<Doc>('docs')).find((x) => x.id === id);
      if (cur && !cur.deleted) await put<Doc>('docs', { ...cur, file: { ...cur.file, path } });
      emit();
    }
    lastError = null;
  } catch (e) {
    lastError = e instanceof CloudError ? e.message : String(e);
  }
  emit();
}

/** Beim App-Start: hochladen, sobald Internet und Haushalt da sind. */
export function startDocUploads() {
  void uploadPending();
  window.addEventListener('online', () => void uploadPending());
  let wasReady = false;
  onSyncChange(() => {
    const ready = getSyncState().status === 'bereit';
    if (ready && !wasReady) void uploadPending();
    wasReady = ready;
  });
}

/** Welche Dokumente warten auf diesem Handy noch aufs Hochladen? (für die Anzeige) */
export function usePendingFiles(): { pending: Set<string>; error: string | null } {
  const [v, setV] = useState<{ pending: Set<string>; error: string | null }>({ pending: new Set(), error: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const ids = new Set<string>();
      for (const id of await fileKeys()) if ((await getFile(id))?.pending) ids.add(id);
      if (alive) setV({ pending: ids, error: lastError });
    };
    void load();
    events.addEventListener('files', load);
    return () => {
      alive = false;
      events.removeEventListener('files', load);
    };
  }, []);
  return v;
}

/** «Gültig bis» abgelaufen oder bald (30 Tage)? */
export function untilState(until: string | null, today = new Date()): 'abgelaufen' | 'bald' | null {
  if (!until) return null;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const u = new Date(until + 'T00:00:00');
  if (u < t) return 'abgelaufen';
  if (u.getTime() - t.getTime() <= 30 * 86400000) return 'bald';
  return null;
}

export const fmtDate = (d: string | null) => (d ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}` : '');

export function fmtSize(b: number): string {
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1).replace('.0', '') + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
}

// ---------- Teilen aus anderen Apps (Android «Teilen» → Family-Planner) ----------
// Der Service Worker legt die geteilten Dateien in den Zwischenspeicher «fp-teilen».
export const SHARE_CACHE = 'fp-teilen';

export async function takeSharedFiles(): Promise<File[]> {
  if (!('caches' in window)) return [];
  try {
    const c = await caches.open(SHARE_CACHE);
    const out: File[] = [];
    for (const req of await c.keys()) {
      const res = await c.match(req);
      if (res) {
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('X-Name') || 'Dokument');
        out.push(new File([blob], name, { type: blob.type || res.headers.get('Content-Type') || '' }));
      }
      await c.delete(req);
    }
    return out;
  } catch {
    return [];
  }
}

/** Wurde die App über «Teilen» geöffnet? (Adresse ?teilen=1) */
export function readShareStart(): boolean {
  if (!/[?&]teilen=1/.test(location.search)) return false;
  history.replaceState(null, '', location.pathname + location.hash);
  return true;
}
