// ToDos und Ämtli-Plan (v0.10).
import { getAllRaw, putGenerated, type BaseRecord, type Person } from './db';
import { addDays, dateKey, mondayOf } from './model';

export interface Todo extends BaseRecord {
  title: string;
  note: string;
  due: string | null; // «JJJJ-MM-TT» oder leer
  assignees: string[]; // Personen-IDs (leer = niemand)
  private: boolean; // nur für die erfassende Person sichtbar (auch in der Cloud geschützt)
  createdBy: string | null; // Personen-ID
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  doneBy: string | null;
  cleared?: boolean; // erledigtes Ämtli-ToDo aus der Liste entfernt (bleibt in der Übersicht)
  choreId?: string; // stammt aus diesem Ämtli
  choreWeek?: string; // Montag der Ämtli-Woche
}

export type AssignMode = 'none' | 'fixed' | 'rotate';

export interface Chore extends BaseRecord {
  title: string;
  note: string;
  intervalWeeks: number; // 1 = jede Woche
  startDate: string; // erstmals fällig am «JJJJ-MM-TT» (bestimmt auch den Wochentag)
  assignMode: AssignMode;
  people: string[]; // fixed: alle diese Personen; rotate: Reihenfolge, abwechselnd
  paused: boolean;
  createdWeek: string; // Montag der Woche, in der das Ämtli erfasst wurde
}

export const parseDate = (k: string) => new Date(k + 'T12:00');
const DAY = 86400000;
const weeksBetween = (a: Date, b: Date) => Math.round((mondayOf(b).getTime() - mondayOf(a).getTime()) / (7 * DAY));

export interface Occurrence {
  week: string; // Montag
  due: string; // Fälligkeitstag
  index: number; // das wievielte Mal (0 = erstes Mal)
  assignees: string[];
}

/** Ist das Ämtli in der Woche ab «monday» fällig? */
export function occurrenceIn(chore: Chore, monday: Date, persons: Person[]): Occurrence | null {
  const start = parseDate(chore.startDate);
  const w = weeksBetween(start, monday);
  const n = Math.max(1, chore.intervalWeeks || 1);
  if (w < 0 || w % n !== 0) return null;
  const index = w / n;
  const wd = (start.getDay() + 6) % 7;
  const valid = chore.people.filter((id) => persons.some((p) => p.id === id));
  const assignees =
    chore.assignMode === 'fixed' ? valid : chore.assignMode === 'rotate' && valid.length ? [valid[index % valid.length]] : [];
  return { week: dateKey(mondayOf(monday)), due: dateKey(addDays(mondayOf(monday), wd)), index, assignees };
}

export const choreTodoId = (choreId: string, week: string) => `chore-${choreId}-${week}`;

export function todoFromChore(chore: Chore, occ: Occurrence): Todo {
  return {
    id: choreTodoId(chore.id, occ.week),
    title: chore.title,
    note: chore.note,
    due: occ.due,
    assignees: occ.assignees,
    private: false,
    createdBy: null,
    createdAt: parseDate(occ.week).getTime(),
    done: false,
    doneAt: null,
    doneBy: null,
    choreId: chore.id,
    choreWeek: occ.week,
    updatedAt: 1,
    deleted: false,
  };
}

/**
 * Legt die fälligen Ämtli als ToDos an (diese Woche und bis zu 3 Wochen zurück, falls die App
 * länger nicht offen war). Feste IDs pro Ämtli und Woche: Zwei Handys erzeugen denselben Eintrag.
 */
let generating = false;
export async function generateChoreTodos(today = new Date()): Promise<number> {
  if (generating) return 0;
  generating = true;
  try {
    const chores = (await getAllRaw<Chore>('chores')).filter((c) => !c.deleted && !c.paused);
    if (!chores.length) return 0;
    const persons = (await getAllRaw<Person>('persons')).filter((p) => !p.deleted);
    const existing = new Set((await getAllRaw<Todo>('todos')).map((t) => t.id)); // inkl. gelöschte
    const thisMonday = mondayOf(today);
    const out: Todo[] = [];
    for (const c of chores) {
      for (let back = 3; back >= 0; back--) {
        const monday = addDays(thisMonday, -7 * back);
        if (dateKey(monday) < c.createdWeek) continue; // nichts vor der Erfassung nachholen
        const occ = occurrenceIn(c, monday, persons);
        if (!occ || existing.has(choreTodoId(c.id, occ.week))) continue;
        out.push(todoFromChore(c, occ));
      }
    }
    await putGenerated('todos', out);
    return out.length;
  } finally {
    generating = false;
  }
}

/** Gehört das ToDo zu «Meine»? */
export function isMine(t: Todo, me: string | null): boolean {
  if (t.private) return true;
  if (!me) return false;
  if (t.assignees.includes(me)) return true;
  return t.assignees.length === 0 && t.createdBy === me;
}

export function isOverdue(t: Todo, today = dateKey(new Date())): boolean {
  return !t.done && !!t.due && t.due < today;
}

/** Offene: überfällige zuerst, dann nach Datum, ohne Datum am Schluss. Erledigte: zuletzt erledigte zuerst. */
export function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0);
    const da = a.due ?? '9999', db = b.due ?? '9999';
    if (da !== db) return da < db ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function fmtDue(due: string, today = new Date()): string {
  const d = parseDate(due);
  const diff = Math.round((d.getTime() - parseDate(dateKey(today)).getTime()) / DAY);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'morgen';
  if (diff === -1) return 'gestern';
  return `${WD_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

export const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export function choreRuleLabel(c: Chore): string {
  const wd = WEEKDAY_NAMES[(parseDate(c.startDate).getDay() + 6) % 7];
  const n = Math.max(1, c.intervalWeeks);
  return n === 1 ? `jeden ${wd}` : `alle ${n} Wochen am ${wd}`;
}
