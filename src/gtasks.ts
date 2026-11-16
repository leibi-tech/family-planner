// Google-ToDos (v0.35, E57): die eigenen ToDos aus Google Tasks unter «Meine».
// Nur für die angemeldete Person: Die Funktion «google-kalender» benutzt immer das eigene
// Google-Konto. Die ToDos kommen nicht in die gemeinsame Datenbank, sondern nur als Kopie auf
// dieses Handy (Tabelle «meta»), damit sie offline sichtbar sind. Ändern nur mit Internet.
import { useEffect, useState } from 'react';
import { calendarCall, getSession } from './cloud';
import { getMeta, setMeta } from './db';
import type { Todo } from './todos';

export interface GTask {
  id: string;
  listId: string;
  title: string;
  notes: string;
  due: string | null; // JJJJ-MM-TT
  done: boolean;
  completedAt: string | null;
  updated: string | null;
}
export interface GList {
  id: string;
  title: string;
}

/** ok = geladen · none = nicht mit Google verbunden · scope = Erlaubnis fehlt (neu verbinden) · disabled = im Cloud-Projekt aus */
export type GState = 'ok' | 'none' | 'scope' | 'disabled';

export interface GCache {
  user: string; // Konto, dem die Kopie gehört
  state: GState;
  lists: GList[];
  tasks: GTask[];
  at: number;
}

const KEY = 'googleTasks';
const STALE_MS = 5 * 60000;
export const GPREFIX = 'g:';

let cache: GCache | null = null;
let loaded = false;
let error: string | null = null;
const ev = new EventTarget();
const emit = () => ev.dispatchEvent(new Event('change'));

async function myUser(): Promise<string | null> {
  return (await getSession())?.user?.id ?? null;
}

async function load(): Promise<void> {
  if (loaded) return;
  const c = await getMeta<GCache>(KEY);
  const u = await myUser();
  // Kopie eines anderen Kontos (z.B. abgemeldet und anders angemeldet) nie anzeigen
  cache = c && u && c.user === u ? c : null;
  loaded = true;
  emit();
}

async function save(c: GCache | null) {
  cache = c;
  await setMeta(KEY, c ?? undefined);
  emit();
}

let busy = false;
/** Bei Google holen (nur online, mit Konto und Haushalt). force = auch wenn die Kopie frisch ist. */
export async function refreshGoogleTasks(force = false): Promise<void> {
  await load();
  if (busy || !navigator.onLine) return;
  const u = await myUser();
  if (!u) {
    if (cache) await save(null);
    return;
  }
  if (!force && cache && cache.user === u && Date.now() - cache.at < STALE_MS) return;
  busy = true;
  try {
    const r = await calendarCall<{ state: GState; lists?: GList[]; tasks?: GTask[] }>('tasks');
    error = null;
    await save({ user: u, state: r.state, lists: r.lists ?? [], tasks: r.tasks ?? [], at: Date.now() });
  } catch (e: any) {
    error = e?.message ?? String(e);
    emit();
  } finally {
    busy = false;
  }
}

/** Google-ToDos für die Anzeige (aktualisiert sich selbst). */
export function useGoogleTasks(): { cache: GCache | null; error: string | null } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((x) => x + 1);
    ev.addEventListener('change', f);
    void refreshGoogleTasks();
    const t = setInterval(() => void refreshGoogleTasks(), STALE_MS);
    const on = () => void refreshGoogleTasks(true);
    window.addEventListener('online', on);
    return () => {
      ev.removeEventListener('change', f);
      clearInterval(t);
      window.removeEventListener('online', on);
    };
  }, []);
  return { cache: cache?.state === 'ok' || cache?.state === 'scope' || cache?.state === 'disabled' ? cache : null, error };
}

/** Bei jeder Änderung der Google-ToDos (z.B. für das Widget). */
export const onGoogleTasksChange = (fn: () => void) => {
  ev.addEventListener('change', fn);
  return () => ev.removeEventListener('change', fn);
};

export const isGoogle = (t: Pick<Todo, 'id'>) => t.id.startsWith(GPREFIX);

/** Google-ToDo als ToDo der App darstellen (privat, mir zugewiesen). */
export function asTodo(g: GTask, me: string | null): Todo {
  return {
    id: GPREFIX + g.id,
    title: g.title,
    note: g.notes,
    due: g.due,
    assignees: me ? [me] : [],
    private: true,
    createdBy: me,
    createdAt: g.updated ? Date.parse(g.updated) : 0,
    done: g.done,
    doneAt: g.completedAt ? Date.parse(g.completedAt) : null,
    doneBy: g.done ? me : null,
    updatedAt: 0,
    deleted: false,
    google: { listId: g.listId, taskId: g.id },
  };
}

export const googleTodos = (c: GCache | null, me: string | null): Todo[] =>
  c && c.state === 'ok' ? c.tasks.map((g) => asTodo(g, me)) : [];

export const listName = (listId: string) => cache?.lists.find((l) => l.id === listId)?.title ?? '';

// ---------- Ändern (nur online) ----------
function needOnline() {
  if (!navigator.onLine) throw new Error('Google-ToDos kann man nur mit Internet ändern.');
}

async function replaceLocal(fn: (tasks: GTask[]) => GTask[]) {
  if (!cache) return;
  await save({ ...cache, tasks: fn(cache.tasks) });
}

export interface GInput {
  title: string;
  notes: string;
  due: string | null;
}

export async function createGoogleTask(listId: string, input: GInput): Promise<void> {
  needOnline();
  const r = await calendarCall<{ task: GTask | null }>('taskCreate', { listId, task: input });
  if (r.task) await replaceLocal((l) => [...l, r.task!]);
  void refreshGoogleTasks(true);
}

export async function updateGoogleTask(t: Todo, patch: Partial<GInput> & { done?: boolean }): Promise<void> {
  needOnline();
  const g = t.google!;
  // Sofort anzeigen, bei einem Fehler wieder zurück
  const before = cache;
  await replaceLocal((l) =>
    l.map((x) =>
      x.id === g.taskId
        ? {
            ...x,
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            ...(patch.due !== undefined ? { due: patch.due } : {}),
            ...(patch.done !== undefined ? { done: patch.done, completedAt: patch.done ? new Date().toISOString() : null } : {}),
          }
        : x,
    ),
  );
  try {
    const r = await calendarCall<{ task: GTask | null }>('taskUpdate', { listId: g.listId, taskId: g.taskId, task: patch });
    if (r.task) await replaceLocal((l) => l.map((x) => (x.id === g.taskId ? r.task! : x)));
  } catch (e) {
    if (before) await save(before);
    throw e;
  }
}

export async function deleteGoogleTask(t: Todo): Promise<void> {
  needOnline();
  const g = t.google!;
  await calendarCall('taskDelete', { listId: g.listId, taskId: g.taskId });
  await replaceLocal((l) => l.filter((x) => x.id !== g.taskId));
}

/** Abhaken / wieder öffnen; Fehler als Text zurück (für eine kurze Meldung). */
export async function toggleGoogleTask(t: Todo): Promise<string | null> {
  try {
    await updateGoogleTask(t, { done: !t.done });
    return null;
  } catch (e: any) {
    return e?.message ?? String(e);
  }
}
