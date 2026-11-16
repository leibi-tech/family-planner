// Widget «Termine» der Android-App (E56). Die App gibt der Hülle die Termine der nächsten 14 Tage
// (aus der Kopie auf dem Handy). Das Widget zeigt davon 7 Tage ab heute, auch wenn die App zu ist.
// Frisch wird es jedes Mal, wenn die App die Termine neu holt (Startseite, Kalender).
import { apkSetWidget, inApk } from './android';
import { FAMILY_COLOR, calHelpers, eventsFromCache, loadCache, monthKey, occursOn, personColor, sortEvents, timeLabel } from './calendar';
import { getSession } from './cloud';
import { getAll, getMeta, type Person } from './db';
import { googleTodos, type GCache } from './gtasks';
import { dateKey } from './model';
import { getSyncState } from './sync';
import { isMine, sortTodos, type Todo } from './todos';

export const WIDGET_DAYS = 14;

export interface WidgetRow {
  d: string; // Tag JJJJ-MM-TT
  t: string; // Zeit, z.B. «09:00–10:00», «ganztägig»
  n: string; // Titel ohne [Namen]
  w: string; // wen betrifft es
  c: string[]; // Farben (eine pro Person, höchstens 3)
}
export interface WidgetData {
  at: number;
  connected: boolean;
  rows: WidgetRow[];
}

/** Termine für das Widget zusammenstellen (ab heute, WIDGET_DAYS Tage). */
export async function widgetData(now = new Date()): Promise<WidgetData> {
  const household = getSyncState().household?.id ?? null;
  const cache = await loadCache();
  if (!household || !cache || cache.household !== household) return { at: Date.now(), connected: false, rows: [] };
  const persons = (await getAll<Person>('persons')).sort((a, b) => a.sort - b.sort);
  const h = calHelpers(cache.calendars, persons);
  const keys: string[] = [];
  for (let i = 0; i < 2; i++) keys.push(monthKey(now.getFullYear(), now.getMonth() + i));
  const events = eventsFromCache(cache, keys);
  const rows: WidgetRow[] = [];
  for (let i = 0; i < WIDGET_DAYS; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    for (const e of sortEvents(events.filter((x) => occursOn(x, day))))
      rows.push({ d: dateKey(day), t: timeLabel(e, day), n: h.titleOf(e), w: h.whoOf(e), c: h.colorsOf(e).slice(0, 3) });
  }
  return { at: Date.now(), connected: true, rows };
}

// ---------- Widget «ToDos» (APK 1.6, E58) ----------
// Offene ToDos: meine (inkl. private und Google-ToDos) und die ohne Zuteilung («wer Zeit hat»).
// Reihenfolge wie auf der Startseite: überfällige, dann nach Datum, ohne Datum am Schluss.
// Nur zum Ansehen; Antippen öffnet das ToDo in der App.
export const TODO_WIDGET_MAX = 50;

export interface TodoWidgetRow {
  id: string; // ToDo-ID (Google: «g:…»)
  n: string; // Titel
  d: string; // fällig am JJJJ-MM-TT oder leer (das Widget rechnet «heute», «überfällig» selbst)
  w: string; // wem zugeteilt («alle» = ohne Zuteilung)
  c: string[]; // Farben (eine pro Person, höchstens 3)
  g: boolean; // Google-ToDo
}
export interface TodoWidgetData {
  at: number;
  rows: TodoWidgetRow[];
  more: number; // weitere, die nicht mehr Platz haben
}

/** Eigene Person (wie useMe): aus dem Konto, ohne Haushalt die erste Person der Familie. */
function meOf(persons: Person[]): string | null {
  const s = getSyncState();
  if (s.household) return s.membership?.person_id ?? null;
  return persons[0]?.id ?? null;
}

/** ToDos für das Widget zusammenstellen. */
export async function todoWidgetData(): Promise<TodoWidgetData> {
  const persons = (await getAll<Person>('persons')).sort((a, b) => a.sort - b.sort);
  const me = meOf(persons);
  const ids = persons.map((p) => p.id);
  const todos = (await getAll<Todo>('todos')).filter((t) => !t.done && !t.cleared && (isMine(t, me) || (!t.private && t.assignees.length === 0)));
  // Google-ToDos nur aus der Kopie des angemeldeten Kontos
  const g = await getMeta<GCache>('googleTasks');
  const user = (await getSession())?.user?.id ?? null;
  const gtodos = g && user && g.user === user ? googleTodos(g, me).filter((t) => !t.done) : [];
  const all = sortTodos([...todos, ...gtodos]);
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? '?';
  const rows = all.slice(0, TODO_WIDGET_MAX).map((t) => {
    const who = t.assignees.filter((id) => ids.includes(id));
    return {
      id: t.id,
      n: t.title,
      d: t.due ?? '',
      w: t.google ? 'Google' : who.length ? who.map(nameOf).join(', ') : 'alle',
      c: (who.length ? who.map((id) => personColor(ids, id)) : [FAMILY_COLOR]).slice(0, 3),
      g: !!t.google,
    };
  });
  return { at: Date.now(), rows, more: Math.max(0, all.length - rows.length) };
}

/** Termine und ToDos an die Widgets geben (nur in der Android-App; ToDos ab APK 1.6). */
export async function pushWidget() {
  if (!inApk()) return;
  try {
    apkSetWidget('termine', JSON.stringify(await widgetData()));
  } catch {
    /* Widget bleibt beim letzten Stand */
  }
  await pushTodoWidget();
}

let todoTimer: number | undefined;
/** ToDos an das Widget geben (nach Änderungen leicht verzögert, damit viele Änderungen nur einmal zählen). */
export function pushTodoWidget(delay = 0): Promise<void> {
  if (!inApk()) return Promise.resolve();
  clearTimeout(todoTimer);
  return new Promise((done) => {
    todoTimer = window.setTimeout(async () => {
      try {
        apkSetWidget('todos', JSON.stringify(await todoWidgetData()));
      } catch {
        /* Widget bleibt beim letzten Stand */
      }
      done();
    }, delay);
  });
}
