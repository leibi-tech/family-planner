// Betreuungs-Warnung (K4, v0.17): Haben beide Eltern gleichzeitig einen Termin, fragt die App
// «Wer schaut auf die Kinder?». Die Antwort wird in der eigenen Datenbank gespeichert (Tabelle «care»),
// verknüpft mit den Google-Terminen. Verschiebt oder löscht jemand einen Termin, merkt es die App.
import { useEffect, useState } from 'react';
import { getMeta, setMeta, type BaseRecord } from './db';
import { householdMembers } from './cloud';
import { eventKey, eventRange, type CalEvent, type CalHelpers, type CalInfo } from './calendar';

export interface CareSnap {
  calendarId: string;
  eventId: string;
  start: string;
  end: string;
  title: string;
}

export interface CareInfo extends BaseRecord {
  // id = Schlüssel der Überschneidung (siehe conflictKey)
  events: CareSnap[]; // so sahen die Termine beim Erfassen aus
  mode: 'person' | 'mit'; // jemand betreut / Kinder gehen mit
  who: string; // Name der Betreuung bzw. Elternteil, mit dem die Kinder gehen
  note: string;
  editedBy: string | null;
}

export interface Conflict {
  key: string;
  events: CalEvent[]; // 1 Termin (beide Eltern zusammen) oder 2 Termine
  start: Date; // Zeit, in der beide weg sind
  end: Date;
}

export type CareState = 'open' | 'ok' | 'changed';

export const conflictKey = (events: CalEvent[]) => events.map(eventKey).sort().join('+');

/** Eltern = Personen mit eigenem App-Konto oder eigenem Google-Kalender. Kinder = alle anderen.
 *  (So zählt z.B. Thadea auch dann, wenn ihr Google-Kalender noch nicht verbunden ist.) */
export function parentsOf(calendars: CalInfo[], accountPersons: string[] = []): string[] {
  const ids: string[] = [];
  for (const c of calendars) if (c.kind === 'own' && c.personId && !ids.includes(c.personId)) ids.push(c.personId);
  for (const id of accountPersons) if (!ids.includes(id)) ids.push(id);
  return ids;
}

const ACCOUNTS_KEY = 'accountPersons';
/** Personen mit eigenem App-Konto (aus der Mitgliederliste, offline aus der Kopie). */
export function useAccountPersons(household: string | null): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const saved = await getMeta<{ household: string; ids: string[] }>(ACCOUNTS_KEY);
      if (alive && saved && saved.household === household) setIds(saved.ids);
      if (!household || !navigator.onLine) return;
      try {
        const list = (await householdMembers(household)).map((m) => m.person_id).filter((x): x is string => !!x);
        await setMeta(ACCOUNTS_KEY, { household, ids: list });
        if (alive) setIds(list);
      } catch {
        /* offline: Kopie bleibt */
      }
    })();
    return () => {
      alive = false;
    };
  }, [household]);
  return ids;
}

/** Überschneidungen im Zeitraum [from, to). Nur Termine mit Uhrzeit. Gilt (vorerst) für genau 2 Eltern. */
export function findConflicts(events: CalEvent[], allParents: string[], h: CalHelpers, from: Date, to: Date): Conflict[] {
  const parents = allParents.filter((id) => h.personIds.includes(id));
  if (parents.length !== 2) return [];
  const [A, B] = parents;
  const kids = h.personIds.filter((id) => !parents.includes(id));
  if (!kids.length) return [];

  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => ({ e, ps: h.personsOf(e), r: eventRange(e) }))
    .filter((x) => x.r[1] > from && x.r[0] < to);
  const kidsCovered = (ps: string[]) => kids.every((k) => ps.includes(k));
  const out = new Map<string, Conflict>();
  const add = (evs: CalEvent[], start: Date, end: Date) => {
    const key = conflictKey(evs);
    if (!out.has(key)) out.set(key, { key, events: evs, start, end });
  };

  for (const a of timed) {
    if (!a.ps.includes(A)) continue;
    if (a.ps.includes(B)) {
      // Beide Eltern im gleichen Termin
      if (!kidsCovered(a.ps)) add([a.e], a.r[0], a.r[1]);
      continue;
    }
    for (const b of timed) {
      if (!b.ps.includes(B) || b.ps.includes(A)) continue;
      const s = a.r[0] > b.r[0] ? a.r[0] : b.r[0];
      const en = a.r[1] < b.r[1] ? a.r[1] : b.r[1];
      if (s >= en) continue;
      if (kidsCovered([...a.ps, ...b.ps])) continue;
      add([a.e, b.e], s, en);
    }
  }
  return [...out.values()].sort((x, y) => +x.start - +y.start);
}

export const snapOf = (e: CalEvent): CareSnap => ({ calendarId: e.calendarId, eventId: e.id, start: e.start, end: e.end, title: e.title });

/** Offen, erledigt oder «Termin geändert – bitte prüfen». */
export function careState(c: Conflict, care: CareInfo | undefined): CareState {
  if (!care || care.deleted) return 'open';
  const same = c.events.every((e) => care.events.some((s) => s.calendarId === e.calendarId && s.eventId === e.id && s.start === e.start && s.end === e.end));
  return same ? 'ok' : 'changed';
}

/** Erfasste Betreuungen, deren Überschneidung es nicht mehr gibt (Termin verschoben/gelöscht),
 *  solange der ursprüngliche Zeitpunkt im Zeitraum liegt und noch nicht vorbei ist. */
export function orphanedCare(care: CareInfo[], conflicts: Conflict[], from: Date, to: Date): CareInfo[] {
  const keys = new Set(conflicts.map((c) => c.key));
  return care.filter((c) => {
    if (c.deleted || keys.has(c.id) || !c.events.length) return false;
    const end = Math.max(...c.events.map((s) => +new Date(s.end)));
    const start = Math.min(...c.events.map((s) => +new Date(s.start)));
    return end > +from && start < +to;
  });
}

export function careLabel(care: CareInfo): string {
  return care.mode === 'mit' ? `Kinder gehen mit ${care.who}` : `${care.who} schaut auf die Kinder`;
}
