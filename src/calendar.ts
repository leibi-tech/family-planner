// Kalender (v0.14): Termine aus Google Kalender über die Supabase-Funktion «google-kalender».
// Die Termine werden nicht in der gemeinsamen Datenbank gespeichert, sondern direkt bei Google
// geholt und als Kopie auf dem Handy abgelegt (Tabelle «meta»), damit sie offline sichtbar sind.
import { calendarCall } from './cloud';
import { getMeta, setMeta } from './db';
import { dateKey } from './model';

export interface CalEvent {
  id: string;
  calendarId: string;
  recurringEventId: string | null;
  title: string;
  allDay: boolean;
  start: string; // ganztägig: JJJJ-MM-TT, sonst ISO-Zeit
  end: string; // ganztägig: Folgetag (exklusiv)
  location: string | null;
  description: string | null;
  link: string | null;
}

export interface CalInfo {
  id: string;
  name: string;
  kind: 'own' | 'family';
  personId: string | null; // bei «own»: Person des Kontos
  mine: boolean;
  writable?: boolean; // darf ich hier Termine erfassen/ändern?
  email: string | null;
}

export interface CalStatus {
  connected: boolean;
  email?: string | null;
  calendars?: Array<{ id: string; name: string; kind: 'own' | 'family' }>;
}

export interface Repeat {
  freq: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  until?: string | null;
}
export const REPEAT_LABELS: Record<Repeat['freq'], string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  biweekly: 'Alle 2 Wochen',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

/** Was die App an Google schickt (siehe Funktion «google-kalender»). */
export interface EventInput {
  title: string;
  allDay: boolean;
  startDate: string;
  endDate: string; // inklusiv
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  repeat?: Repeat | null; // undefined = unverändert lassen
}

export interface GoogleCalendar {
  id: string;
  name: string;
  color: string | null;
  access: string;
  primary: boolean;
}

interface MonthChunk {
  at: number; // wann geholt
  events: CalEvent[];
}
export interface CalCache {
  household: string;
  calendars: CalInfo[];
  months: Record<string, MonthChunk>; // 'JJJJ-MM' → Termine, die diesen Monat berühren
  errors: string[];
  at: number;
}

const CACHE_KEY = 'calendarCache';
const STATUS_KEY = 'calendarStatus';
export const STALE_MS = 5 * 60000;

// ---------- Datum ----------
export const monthKey = (y: number, m: number) => {
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Erster und letzter Tag (inkl.), an dem der Termin stattfindet (lokale Zeit). */
export function eventDays(e: CalEvent): [Date, Date] {
  if (e.allDay) {
    const s = parseDay(e.start);
    const end = parseDay(e.end);
    end.setDate(end.getDate() - 1);
    return [s, end < s ? s : end];
  }
  const s = new Date(e.start);
  const end = new Date(e.end);
  const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  let ed = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // Endet genau um Mitternacht → zählt nicht mehr zum nächsten Tag
  if (+end === +ed && ed > sd) ed = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate() - 1);
  return [sd, ed < sd ? sd : ed];
}

export const occursOn = (e: CalEvent, day: Date) => {
  const [s, en] = eventDays(e);
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return d >= s && d <= en;
};

const hm = (d: Date) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
const dm = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;

/** Zeitangabe für die Tagesliste, z.B. «19:00–21:00», «ganztägig», «ab 18:00», «bis 2.11.». */
export function timeLabel(e: CalEvent, day: Date): string {
  const [s, en] = eventDays(e);
  const k = dateKey(day);
  const first = dateKey(s) === k;
  const last = dateKey(en) === k;
  if (e.allDay) return first && last ? 'ganztägig' : last ? 'ganztägig (letzter Tag)' : `ganztägig, bis ${dm(en)}`;
  const st = new Date(e.start);
  const et = new Date(e.end);
  if (first && last) return `${hm(st)}–${hm(et)}`;
  if (first) return `ab ${hm(st)}`;
  if (last) return `bis ${hm(et)}`;
  return 'ganzer Tag';
}

/** Ausführliche Zeitangabe für die Termin-Ansicht. */
export function whenLabel(e: CalEvent): string {
  const wd = (d: Date) => d.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const [s, en] = eventDays(e);
  if (e.allDay) return +s === +en ? `${wd(s)}, ganztägig` : `${wd(s)} bis ${wd(en)}, ganztägig`;
  const st = new Date(e.start);
  const et = new Date(e.end);
  return +s === +en ? `${wd(st)}, ${hm(st)}–${hm(et)}` : `${wd(st)}, ${hm(st)} bis ${wd(et)}, ${hm(et)}`;
}

/** Sortierung in der Tagesliste: ganztägige zuerst, dann nach Beginn. */
export function sortEvents(list: CalEvent[]): CalEvent[] {
  return [...list].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    const as = a.allDay ? +parseDay(a.start) : +new Date(a.start);
    const bs = b.allDay ? +parseDay(b.start) : +new Date(b.start);
    return as - bs || a.title.localeCompare(b.title);
  });
}

// ---------- Kopie auf dem Handy ----------
export const loadCache = () => getMeta<CalCache>(CACHE_KEY);
export const loadStatus = () => getMeta<CalStatus>(STATUS_KEY);

/** Termine der Monate (Schlüssel) aus der Kopie, ohne Doppelte. */
export function eventsFromCache(cache: CalCache | undefined, keys: string[]): CalEvent[] {
  if (!cache) return [];
  const seen = new Set<string>();
  const out: CalEvent[] = [];
  for (const k of keys)
    for (const e of cache.months[k]?.events ?? []) {
      const id = e.calendarId + '|' + e.id;
      if (!seen.has(id)) {
        seen.add(id);
        out.push(e);
      }
    }
  return out;
}

/** Holt die Monate ab (y, m) für «count» Monate bei Google und legt sie in der Kopie ab. */
export async function fetchMonths(household: string, y: number, m: number, count: number): Promise<CalCache> {
  const from = new Date(y, m, 1);
  const to = new Date(y, m + count, 1);
  const r = await calendarCall<{ calendars: CalInfo[]; events: CalEvent[]; errors: string[] }>('events', {
    household,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const old = await loadCache();
  const months: Record<string, MonthChunk> = old && old.household === household ? { ...old.months } : {};
  const now = Date.now();
  const fresh: Record<string, CalEvent[]> = {};
  for (let i = 0; i < count; i++) fresh[monthKey(y, m + i)] = [];
  for (const e of r.events) {
    const [s, en] = eventDays(e);
    for (let i = 0; i < count; i++) {
      const ms = new Date(y, m + i, 1);
      const me = new Date(y, m + i + 1, 0);
      if (s <= me && en >= ms) fresh[monthKey(y, m + i)].push(e);
    }
  }
  for (const [k, events] of Object.entries(fresh)) months[k] = { at: now, events };
  // Alte Monate (älter als 1 Jahr zurück) aufräumen
  const limit = monthKey(new Date().getFullYear() - 1, new Date().getMonth());
  for (const k of Object.keys(months)) if (k < limit) delete months[k];
  const cache: CalCache = { household, calendars: r.calendars, months, errors: r.errors ?? [], at: now };
  await setMeta(CACHE_KEY, cache);
  return cache;
}

export async function fetchStatus(): Promise<CalStatus> {
  const s = await calendarCall<CalStatus>('status');
  await setMeta(STATUS_KEY, s);
  return s;
}

export const isWritable = (c: CalInfo | undefined) => !!c && (c.writable ?? c.mine);

export const createEvent = (calendarId: string, event: EventInput) => calendarCall('create', { calendarId, event });
export const updateEvent = (
  e: CalEvent,
  scope: 'one' | 'all',
  event: EventInput,
) =>
  calendarCall('update', {
    calendarId: e.calendarId,
    eventId: e.id,
    recurringEventId: e.recurringEventId,
    scope,
    origStartDate: dateKey(eventDays(e)[0]),
    event,
  });
export const deleteEvent = (e: CalEvent, scope: 'one' | 'all') =>
  calendarCall('delete', { calendarId: e.calendarId, eventId: e.id, recurringEventId: e.recurringEventId, scope });
export const seriesRepeat = (e: CalEvent) =>
  calendarCall<{ repeat: Repeat | 'other' | null }>('master', { calendarId: e.calendarId, eventId: e.recurringEventId });

// ---------- Personen im Titel: «[Kind 1, Kind 2] Turnen» ----------
interface Named {
  id: string;
  name: string;
}
/** Zerlegt «[A, B] Titel» in Personen (nur bekannte Namen) und Titel. */
export function parseTitle(title: string, persons: Named[]): { title: string; personIds: string[] } {
  const m = title.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { title, personIds: [] };
  const ids: string[] = [];
  for (const raw of m[1].split(/[,;+&]/)) {
    const n = raw.trim().toLowerCase();
    const p = persons.find((x) => x.name.trim().toLowerCase() === n);
    if (!p) return { title, personIds: [] }; // unbekannter Name → Titel so lassen
    if (!ids.includes(p.id)) ids.push(p.id);
  }
  return { title: m[2] || title, personIds: ids };
}
export function buildTitle(title: string, personIds: string[], persons: Named[]): string {
  const names = persons.filter((p) => personIds.includes(p.id)).map((p) => p.name);
  const clean = title.trim();
  return names.length ? `[${names.join(', ')}] ${clean}` : clean;
}
/** Wen betrifft ein Termin? Leere Liste = ganze Familie. */
export function eventPersons(e: CalEvent, cal: CalInfo | undefined, persons: Named[]): string[] {
  const { personIds } = parseTitle(e.title, persons);
  if (cal?.kind === 'own' && cal.personId) return [cal.personId, ...personIds.filter((x) => x !== cal.personId)];
  return personIds;
}

/** Lokales Datum/Zeit eines Termins für das Formular. */
export function eventToInput(e: CalEvent): EventInput {
  const [s, en] = eventDays(e);
  if (e.allDay) return { title: e.title, allDay: true, startDate: dateKey(s), endDate: dateKey(en), location: e.location ?? '', description: e.description ?? '' };
  const st = new Date(e.start);
  const et = new Date(e.end);
  const t = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    title: e.title,
    allDay: false,
    startDate: dateKey(st),
    endDate: dateKey(et),
    startTime: t(st),
    endTime: t(et),
    location: e.location ?? '',
    description: e.description ?? '',
  };
}

export const listGoogleCalendars = () =>
  calendarCall<{ email: string; calendars: GoogleCalendar[]; selected: CalStatus['calendars'] }>('calendars');

export async function saveSelection(cals: Array<{ id: string; name: string; kind: 'own' | 'family'; access?: string }>) {
  await calendarCall('select', { calendars: cals });
  await fetchStatus();
}

export async function disconnectGoogle() {
  await calendarCall('disconnect');
  await setMeta(STATUS_KEY, { connected: false });
}

/** Startet die Verbindung: die App wechselt zur Google-Anmeldung und kommt danach zurück. */
export async function startConnect(household: string) {
  const returnUrl = location.origin + location.pathname;
  const r = await calendarCall<{ url: string }>('connect', { household, returnUrl });
  location.assign(r.url);
}

// ---------- Rückkehr von Google (#kalender=…) ----------
let returnResult: string | null = null;
/** Beim Start der App aufrufen: liest «#kalender=…» aus der Adresse und entfernt es. */
export function readReturnFromGoogle(): string | null {
  const m = location.hash.match(/^#kalender=([a-z]+)/);
  if (!m) return null;
  returnResult = m[1];
  history.replaceState(null, '', location.pathname + location.search);
  return returnResult;
}
export function takeReturnResult(): string | null {
  const r = returnResult;
  returnResult = null;
  return r;
}

// ---------- Farben pro Person ----------
const PALETTE = ['#2f7dd1', '#d0477a', '#e08a00', '#7a5bd6', '#1f9e8f', '#b5533c'];
export const FAMILY_COLOR = '#2f7d5b';
export function personColor(personIds: string[], id: string | null): string {
  if (!id) return FAMILY_COLOR;
  const i = personIds.indexOf(id);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}
