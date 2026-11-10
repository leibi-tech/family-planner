// Widget «Termine» der Android-App (E56). Die App gibt der Hülle die Termine der nächsten 14 Tage
// (aus der Kopie auf dem Handy). Das Widget zeigt davon 7 Tage ab heute, auch wenn die App zu ist.
// Frisch wird es jedes Mal, wenn die App die Termine neu holt (Startseite, Kalender).
import { apkSetWidget, inApk } from './android';
import { calHelpers, eventsFromCache, loadCache, monthKey, occursOn, sortEvents, timeLabel } from './calendar';
import { getAll, type Person } from './db';
import { dateKey } from './model';
import { getSyncState } from './sync';

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

/** Termine an das Widget geben (nur in der Android-App ab 1.5). */
export async function pushWidget() {
  if (!inApk()) return;
  try {
    apkSetWidget('termine', JSON.stringify(await widgetData()));
  } catch {
    /* Widget bleibt beim letzten Stand */
  }
}
