import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllRaw, newId, put, remove, type Person } from '../db';
import { useRecords } from '../hooks';
import { useSync } from '../components/CloudCard';
import type { Note } from '../notes';
import { navBack, onOpenRequest, requestOpen, takePending } from '../nav';
import { addDays, dateKey, fmtDay, isoWeek, mondayOf } from '../model';
import {
  choreRuleLabel,
  fmtDue,
  generateChoreTodos,
  isMine,
  isOverdue,
  occurrenceIn,
  parseDate,
  sortTodos,
  type AssignMode,
  type Chore,
  type Todo,
} from '../todos';

// ---------- Wer bin ich? ----------
/** Eigene Person: aus dem Konto, ohne Haushalt die erste Person der Familie. */
export function useMe(persons: Person[] | undefined): string | null {
  const sync = useSync();
  if (!persons) return null;
  if (sync.household) return sync.membership?.person_id ?? null;
  const first = [...persons].sort((a, b) => a.sort - b.sort)[0];
  return first?.id ?? null;
}

const ls = {
  get: (k: string, d: string) => {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

function usePersisted<T extends string>(key: string, def: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => ls.get(key, def) as T);
  return [
    v,
    (x: T) => {
      setV(x);
      ls.set(key, x);
    },
  ];
}

export function TodoPage() {
  const todos = useRecords<Todo>('todos');
  const chores = useRecords<Chore>('chores');
  const persons = useRecords<Person>('persons');
  const me = useMe(persons);
  const [section, setSection] = usePersisted<'todos' | 'aemtli'>('fp-todo-section', 'todos');
  const [req, setReq] = useState(0);
  const [openReq, setOpenReq] = useState<{ id: string; from: string | null } | null>(null);

  // Von aussen angefragt (Startseite): ToDo-Fenster direkt öffnen, sobald die ToDos geladen sind
  useEffect(() => onOpenRequest((k) => k === 'todo' && setReq((x) => x + 1)), []);
  useEffect(() => {
    if (!todos) return;
    const p = takePending('todo');
    if (!p) return;
    setSection('todos');
    setOpenReq({ id: p.id, from: p.from });
  }, [todos, req]);

  if (!todos || !chores || !persons) return <p className="muted center">Lade …</p>;
  const sorted = [...persons].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

  return (
    <section>
      <div className="seg cat-tabs">
        <button className={section === 'todos' ? 'on' : ''} onClick={() => setSection('todos')}>
          ToDos
        </button>
        <button className={section === 'aemtli' ? 'on' : ''} onClick={() => setSection('aemtli')}>
          Ämtli-Plan
        </button>
      </div>
      {section === 'todos' ? (
        <TodoList todos={todos} persons={sorted} me={me} openReq={openReq} onOpenHandled={() => setOpenReq(null)} />
      ) : (
        <ChoresView chores={chores} todos={todos} persons={sorted} me={me} />
      )}
    </section>
  );
}

// ---------- Liste ----------

function TodoList({
  todos,
  persons,
  me,
  openReq,
  onOpenHandled,
}: {
  todos: Todo[];
  persons: Person[];
  me: string | null;
  openReq: { id: string; from: string | null } | null;
  onOpenHandled: () => void;
}) {
  // Ansicht: 'mine', 'all' oder die ID einer Person
  const [view0, setView] = usePersisted<string>('fp-todo-view', 'mine');
  const others = persons.filter((p) => p.id !== me);
  const view = view0 === 'mine' || view0 === 'all' || others.some((p) => p.id === view0) ? view0 : 'mine';
  const viewPerson = others.find((p) => p.id === view) ?? null;
  const [hideDone, setHideDone] = usePersisted<'0' | '1'>('fp-todo-hidedone', '0');
  const [editing, setEditing] = useState<{ todo: Todo; isNew: boolean } | null>(null);
  const [quick, setQuick] = useState('');
  const fromRef = useRef<string | null>(null); // von der Startseite geöffnet: «Schliessen» führt dorthin zurück
  useEffect(() => {
    if (!openReq) return;
    const t = todos.find((x) => x.id === openReq.id);
    if (t) {
      fromRef.current = openReq.from;
      setEditing({ todo: t, isNew: false });
    }
    onOpenHandled();
  }, [openReq]);

  const visibleAll = todos.filter((t) => !t.cleared);
  const mine = visibleAll.filter((t) => isMine(t, me));
  // Pro Person: was ihr zugewiesen ist. Private ToDos gehören nur zu «Meine» – private der anderen
  // sind auf diesem Handy gar nicht vorhanden (Datenbank-Regel), eigene private erscheinen nie bei anderen.
  const ofPerson = (id: string) => visibleAll.filter((t) => !t.private && t.assignees.includes(id));
  const base = view === 'mine' ? mine : view === 'all' ? visibleAll : ofPerson(view);
  const openCount = (l: Todo[]) => l.filter((t) => !t.done).length;
  const list = sortTodos(hideDone === '1' ? base.filter((t) => !t.done) : base);
  const doneList = base.filter((t) => t.done);
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? '?';

  const blank = (title = ''): Todo => ({
    id: newId(),
    title,
    note: '',
    due: null,
    assignees: view === 'mine' && me ? [me] : viewPerson ? [viewPerson.id] : [],
    private: false,
    createdBy: me,
    createdAt: Date.now(),
    done: false,
    doneAt: null,
    doneBy: null,
    updatedAt: 0,
    deleted: false,
  });

  const quickAdd = async () => {
    const t = quick.trim();
    if (!t) return;
    await put<Todo>('todos', blank(t));
    setQuick('');
  };

  const toggle = (t: Todo) =>
    put<Todo>('todos', t.done ? { ...t, done: false, doneAt: null, doneBy: null } : { ...t, done: true, doneAt: Date.now(), doneBy: me });

  const clearDone = async () => {
    for (const t of doneList) {
      if (t.choreId) await put<Todo>('todos', { ...t, cleared: true }); // bleibt in der Ämtli-Übersicht
      else await remove<Todo>('todos', t);
    }
  };

  const today = dateKey(new Date());

  return (
    <>
      <div className="seg view-tabs">
        <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>
          Meine <span className="tab-count">{openCount(mine)}</span>
        </button>
        <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>
          Alle <span className="tab-count">{openCount(visibleAll)}</span>
        </button>
      </div>
      {others.length > 0 && (
        <div className="chips person-chips">
          {others.map((p) => (
            <button key={p.id} className={'chip small' + (view === p.id ? ' on' : '')} onClick={() => setView(view === p.id ? 'all' : p.id)}>
              {p.name} <span className="chip-count">{openCount(ofPerson(p.id))}</span>
            </button>
          ))}
        </div>
      )}

      <div className="quick-add">
        <input
          className="search"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
          placeholder="Neues ToDo …"
          enterKeyHint="done"
          aria-label="Neues ToDo"
        />
        <button
          className="btn btn-primary quick-btn"
          aria-label="ToDo mit Details erfassen"
          onClick={() => {
            setEditing({ todo: blank(quick.trim()), isNew: true });
            setQuick('');
          }}
        >
          +
        </button>
      </div>
      <p className="hint small-hint">Enter = schnell erfassen · + = mit Datum, Zuweisung, Notiz</p>

      {view === 'mine' && !me && (
        <p className="warn">Dein Konto ist noch keiner Person zugeordnet. Unter «Familie» festlegen, wer du bist.</p>
      )}

      {list.length === 0 ? (
        <p className="hint center">
          {base.length === 0
            ? view === 'mine'
              ? 'Keine ToDos für dich. 🎉'
              : viewPerson
                ? `Keine ToDos für ${viewPerson.name}.`
                : 'Noch keine ToDos erfasst.'
            : 'Alles erledigt. 🎉'}
        </p>
      ) : (
        <ul className="shop-list todo-list">
          {list.map((t) => {
            const overdue = isOverdue(t, today);
            return (
              <li key={t.id} className={'shop-item todo' + (t.done ? ' checked' : '') + (overdue ? ' overdue' : '')}>
                <button className="todo-check" aria-label={t.done ? 'Wieder öffnen' : 'Erledigt'} onClick={() => toggle(t)}>
                  <span className="box" aria-hidden>
                    {t.done ? '✓' : ''}
                  </span>
                </button>
                <button className="todo-main" onClick={() => setEditing({ todo: t, isNew: false })}>
                  <span className="shop-name todo-title">
                    {t.private && <span aria-label="privat">🔒 </span>}
                    {t.choreId && <span aria-label="Ämtli">🔁 </span>}
                    {t.noteId && <span aria-label="mit Notiz">📝 </span>}
                    {t.title}
                  </span>
                  <span className="todo-meta">
                    {t.due && (
                      <span className={'todo-due' + (overdue ? ' late' : '')}>
                        {overdue ? 'überfällig · ' : ''}
                        {fmtDue(t.due)}
                      </span>
                    )}
                    {t.assignees.map((id) => (
                      <span key={id} className={'who' + (id === me ? ' me' : '')}>
                        {nameOf(id)}
                      </span>
                    ))}
                    {t.done && t.doneBy && <span className="muted">erledigt von {nameOf(t.doneBy)}</span>}
                  </span>
                  {t.note && !t.done && <span className="shop-src todo-note">{t.note}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="todo-tools">
        {doneList.length > 0 && (
          <button className="btn" onClick={() => setHideDone(hideDone === '1' ? '0' : '1')}>
            {hideDone === '1' ? `Erledigte anzeigen (${doneList.length})` : 'Erledigte ausblenden'}
          </button>
        )}
        {doneList.length > 0 && (
          <button className="btn btn-ghost-danger" onClick={clearDone}>
            Erledigte löschen
          </button>
        )}
      </div>

      {editing && (
        <TodoSheet
          todo={editing.todo}
          isNew={editing.isNew}
          persons={persons}
          me={me}
          onClose={() => {
            setEditing(null);
            if (fromRef.current) {
              navBack(fromRef.current);
              fromRef.current = null;
            }
          }}
        />
      )}
    </>
  );
}

// ---------- ToDo bearbeiten ----------

function TodoSheet({
  todo,
  isNew,
  persons,
  me,
  onClose,
}: {
  todo: Todo;
  isNew: boolean;
  persons: Person[];
  me: string | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [note, setNote] = useState(todo.note);
  const [due, setDue] = useState(todo.due ?? '');
  const [priv, setPriv] = useState(todo.private);
  const [assignees, setAssignees] = useState<string[]>(todo.assignees);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = title.trim().length > 0;
  const fromChore = !!todo.choreId;

  const togglePerson = (id: string) =>
    setAssignees(assignees.includes(id) ? assignees.filter((x) => x !== id) : [...assignees, id]);

  const setPrivate = (v: boolean) => {
    setPriv(v);
    // Privat: nur für mich sichtbar, darum keine Zuweisung an andere
    if (v) setAssignees(me ? [me] : []);
  };

  const save = async () => {
    if (!valid) return;
    const next: Todo = {
      ...todo,
      title: title.trim(),
      note: note.trim(),
      due: due || null,
      private: priv,
      assignees: priv ? (me ? [me] : []) : assignees,
    };
    if (!isNew && priv !== todo.private) {
      // Wechsel privat ↔ geteilt: als neuer Eintrag speichern, den alten ohne Inhalt löschen.
      // So bleibt ein privates ToDo auch auf den anderen Handys nicht als Kopie liegen.
      await put<Todo>('todos', { ...next, id: newId() });
      await put('todos', { id: todo.id, updatedAt: todo.updatedAt, deleted: true });
    } else {
      await put<Todo>('todos', next);
    }
    onClose();
  };

  const del = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    if (todo.private) await put('todos', { id: todo.id, updatedAt: todo.updatedAt, deleted: true });
    else await remove<Todo>('todos', todo);
    onClose();
  };

  const creator = persons.find((p) => p.id === todo.createdBy)?.name;
  const notes = useRecords<Note>('notes');
  const linked = todo.noteId ? notes?.find((n) => n.id === todo.noteId) : undefined;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Neues ToDo' : 'ToDo bearbeiten'}</h2>
        {todo.noteId && (
          <div className="import-banner note-link">
            {linked ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  requestOpen('note', linked.id, 'todo');
                }}
              >
                {linked.kind === 'list' ? '☑️ Liste öffnen' : '📝 Notiz öffnen'}: {linked.title || 'ohne Titel'}
              </button>
            ) : (
              <span className="muted">📝 Die verknüpfte Notiz ist nicht mehr verfügbar (gelöscht oder privat).</span>
            )}
          </div>
        )}
        {fromChore && <p className="import-banner">🔁 Aus dem Ämtli-Plan (Woche ab {fmtDay(parseDate(todo.choreWeek!))})</p>}

        <label className="field">
          <span>Was ist zu tun?</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Velo flicken" autoFocus={isNew && !title} enterKeyHint="done" />
        </label>

        <div className="field">
          <span>Fällig am</span>
          <div className="due-row">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fällig am" />
            {due && (
              <button className="btn" onClick={() => setDue('')}>
                Kein Datum
              </button>
            )}
          </div>
          {!due && (
            <div className="chips">
              <button className="chip small" onClick={() => setDue(dateKey(new Date()))}>
                Heute
              </button>
              <button className="chip small" onClick={() => setDue(dateKey(addDays(new Date(), 1)))}>
                Morgen
              </button>
              <button className="chip small" onClick={() => setDue(dateKey(addDays(mondayOf(new Date()), 6)))}>
                Diese Woche
              </button>
            </div>
          )}
        </div>

        {!fromChore && (
          <div className="field">
            <span>Sichtbarkeit</span>
            <div className="seg">
              <button className={!priv ? 'on' : ''} onClick={() => setPrivate(false)}>
                👪 Familie
              </button>
              <button className={priv ? 'on' : ''} onClick={() => setPrivate(true)}>
                🔒 Privat
              </button>
            </div>
            {priv && <small className="muted">Nur du siehst dieses ToDo. Es kann niemandem zugewiesen werden.</small>}
          </div>
        )}

        {!priv && (
          <div className="field">
            <span>Wer macht es?</span>
            <div className="chips">
              {persons.map((p) => (
                <button key={p.id} className={'chip small' + (assignees.includes(p.id) ? ' on' : '')} onClick={() => togglePerson(p.id)}>
                  {p.name}
                  {p.id === me ? ' (ich)' : ''}
                </button>
              ))}
            </div>
            <small className="muted">
              {assignees.length === 0
                ? 'Offen – wer Zeit hat, übernimmt es. Erscheint bei «Alle» (und bei dir unter «Meine»).'
                : assignees.length > 1
                  ? 'Mehrere Personen: erledigt, sobald jemand abhakt.'
                  : ''}
            </small>
          </div>
        )}

        <label className="field">
          <span>Notiz</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>

        {!isNew && creator && <p className="muted small-note">Erfasst von {creator}</p>}

        <div className="sheet-actions">
          <button className="btn btn-primary" disabled={!valid} onClick={save}>
            Speichern
          </button>
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          {!isNew && (
            <button className={confirmDelete ? 'btn btn-danger' : 'btn btn-ghost-danger'} onClick={del}>
              {confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Ämtli-Plan ----------

function ChoresView({ chores, todos, persons, me }: { chores: Chore[]; todos: Todo[]; persons: Person[]; me: string | null }) {
  const [editing, setEditing] = useState<{ chore: Chore; isNew: boolean } | null>(null);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? '?';
  const sorted = [...chores].sort((a, b) => a.title.localeCompare(b.title, 'de-CH'));

  const newChore = (): Chore => ({
    id: newId(),
    title: '',
    note: '',
    intervalWeeks: 1,
    startDate: dateKey(new Date()),
    assignMode: 'fixed',
    people: [],
    paused: false,
    createdWeek: dateKey(mondayOf(new Date())),
    updatedAt: 0,
    deleted: false,
  });

  const wk = dateKey(monday);
  const weekTodos = todos.filter((t) => t.choreWeek === wk);
  const groups = [
    ...persons.map((p) => ({ id: p.id, name: p.name, items: weekTodos.filter((t) => t.assignees.includes(p.id)) })),
    { id: '-', name: 'Offen (wer Zeit hat)', items: weekTodos.filter((t) => t.assignees.length === 0) },
  ].filter((g) => g.items.length > 0);
  const isThisWeek = wk === dateKey(mondayOf(new Date()));

  const toggle = (t: Todo) =>
    put<Todo>('todos', t.done ? { ...t, done: false, doneAt: null, doneBy: null } : { ...t, done: true, doneAt: Date.now(), doneBy: me });

  return (
    <>
      <p className="hint">Ämtli wiederholen sich und erscheinen in ihrer Woche automatisch als ToDo.</p>
      {sorted.length > 0 && (
        <ul className="list">
          {sorted.map((c) => {
            const occ = occurrenceIn(c, mondayOf(new Date()), persons);
            const who =
              c.assignMode === 'none' || c.people.length === 0
                ? 'offen (wer Zeit hat)'
                : c.assignMode === 'rotate'
                  ? 'abwechselnd: ' + c.people.map(nameOf).join(' → ')
                  : c.people.map(nameOf).join(', ');
            return (
              <li key={c.id}>
                <button className={'row' + (c.paused ? ' paused' : '')} onClick={() => setEditing({ chore: c, isNew: false })}>
                  <span className="row-main">
                    {c.title}
                    <span className="row-sub wrap">
                      {c.paused ? '⏸ pausiert · ' : ''}
                      {choreRuleLabel(c)} · {who}
                    </span>
                    {occ && !c.paused && occ.assignees.length > 0 && (
                      <span className="row-sub wrap">Diese Woche: {occ.assignees.map(nameOf).join(', ')}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button className="btn btn-primary btn-block" onClick={() => setEditing({ chore: newChore(), isNew: true })}>
        + Ämtli erfassen
      </button>

      <h3 className="sec overview-title">Übersicht pro Person</h3>
      <div className="weeknav small">
        <button className="btn step" aria-label="Vorherige Woche" onClick={() => setMonday(addDays(monday, -7))}>
          ‹
        </button>
        <div className="weeknav-title">
          <b>KW {isoWeek(monday)}</b>
          <span className="muted">
            {fmtDay(monday)} – {fmtDay(addDays(monday, 6))}
          </span>
        </div>
        <button className="btn step" aria-label="Nächste Woche" onClick={() => setMonday(addDays(monday, 7))}>
          ›
        </button>
      </div>
      {!isThisWeek && (
        <div className="weektools">
          <button className="btn" onClick={() => setMonday(mondayOf(new Date()))}>
            Diese Woche
          </button>
        </div>
      )}
      {groups.length === 0 ? (
        <p className="hint center">{monday > new Date() ? 'Diese Woche ist noch nicht eröffnet.' : 'In dieser Woche gab es keine Ämtli.'}</p>
      ) : (
        groups.map((g) => {
          const done = g.items.filter((t) => t.done).length;
          return (
            <div key={g.id} className="shop-cat">
              <h3 className="sec person-head">
                <span>{g.name}</span>
                <span className={'tab-count' + (done === g.items.length ? ' all-done' : '')}>
                  {done}/{g.items.length}
                </span>
              </h3>
              <ul className="shop-list">
                {g.items
                  .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
                  .map((t) => (
                    <li key={t.id} className={'shop-item todo' + (t.done ? ' checked' : '') + (isOverdue(t) ? ' overdue' : '')}>
                      <button className="shop-main" onClick={() => toggle(t)}>
                        <span className="box" aria-hidden>
                          {t.done ? '✓' : ''}
                        </span>
                        <span className="shop-text">
                          <span className="shop-name todo-title">{t.title}</span>
                          <span className="shop-src">
                            {t.due ? fmtDue(t.due) : ''}
                            {t.done && t.doneBy && t.doneBy !== g.id ? ` · erledigt von ${nameOf(t.doneBy)}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })
      )}

      {editing && (
        <ChoreSheet chore={editing.chore} isNew={editing.isNew} persons={persons} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

const CHORE_INTERVALS = [1, 2, 3, 4, 6, 8];

/** Offene, noch nicht erledigte Ämtli-ToDos ab dieser Woche an die neuen Einstellungen anpassen. */
async function updateOpenOccurrences(chore: Chore, persons: Person[], removeAll = false) {
  const thisWeek = dateKey(mondayOf(new Date()));
  const all = (await getAllRaw<Todo>('todos')).filter(
    (t) => !t.deleted && t.choreId === chore.id && !t.done && (t.choreWeek ?? '') >= thisWeek,
  );
  for (const t of all) {
    const occ = removeAll || chore.paused ? null : occurrenceIn(chore, parseDate(t.choreWeek!), persons);
    if (!occ) await remove<Todo>('todos', t);
    else await put<Todo>('todos', { ...t, title: chore.title, note: chore.note, due: occ.due, assignees: occ.assignees });
  }
}

function ChoreSheet({ chore, isNew, persons, onClose }: { chore: Chore; isNew: boolean; persons: Person[]; onClose: () => void }) {
  const [title, setTitle] = useState(chore.title);
  const [note, setNote] = useState(chore.note);
  const [interval, setIntervalWeeks] = useState(chore.intervalWeeks);
  const [startDate, setStartDate] = useState(chore.startDate);
  const [mode, setMode] = useState<AssignMode>(chore.assignMode);
  const [people, setPeople] = useState<string[]>(chore.people);
  const paused = chore.paused;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = title.trim().length > 0 && !!startDate;
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? '?';

  const togglePerson = (id: string) => setPeople(people.includes(id) ? people.filter((x) => x !== id) : [...people, id]);

  const draft: Chore = {
    ...chore,
    title: title.trim(),
    note: note.trim(),
    intervalWeeks: interval,
    startDate,
    assignMode: people.length ? mode : 'none',
    people: mode === 'none' ? [] : people,
    paused,
  };

  // Vorschau: die nächsten 4 Termine
  const preview = useMemo(() => {
    if (!startDate) return [];
    const out: Array<{ due: string; who: string[] }> = [];
    let m = mondayOf(new Date());
    for (let i = 0; i < 60 && out.length < 4; i++, m = addDays(m, 7)) {
      const o = occurrenceIn(draft, m, persons);
      if (o) out.push({ due: o.due, who: o.assignees });
    }
    return out;
  }, [startDate, interval, mode, people.join(','), persons]);

  const save = async () => {
    if (!valid) return;
    await put<Chore>('chores', draft);
    await updateOpenOccurrences(draft, persons);
    await generateChoreTodos();
    onClose();
  };

  const del = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    await remove<Chore>('chores', chore);
    await updateOpenOccurrences(chore, persons, true); // offene entfernen, erledigte bleiben in der Übersicht
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Neues Ämtli' : 'Ämtli bearbeiten'}</h2>

        <label className="field">
          <span>Ämtli</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Abfall rausstellen" autoFocus={isNew} enterKeyHint="done" />
        </label>

        <div className="field">
          <span>Wiederholung</span>
          <select className="select" value={interval} onChange={(e) => setIntervalWeeks(Number(e.target.value))} aria-label="Wiederholung">
            {CHORE_INTERVALS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'Jede Woche' : `Alle ${n} Wochen`}
              </option>
            ))}
          </select>
        </div>

        <label className="field">
          <span>Erstmals fällig am</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <small className="muted">Der Wochentag gilt auch für alle weiteren Male.</small>
        </label>

        <div className="field">
          <span>Wer macht es?</span>
          <div className="seg seg3">
            <button className={mode === 'none' ? 'on' : ''} onClick={() => setMode('none')}>
              Offen
            </button>
            <button className={mode === 'fixed' ? 'on' : ''} onClick={() => setMode('fixed')}>
              Fix
            </button>
            <button className={mode === 'rotate' ? 'on' : ''} onClick={() => setMode('rotate')}>
              Abwechselnd
            </button>
          </div>
          {mode === 'none' && <small className="muted">Niemand fest eingeteilt – wer Zeit hat, übernimmt es.</small>}
          {mode !== 'none' && (
            <>
              <div className="chips">
                {persons.map((p) => {
                  const pos = people.indexOf(p.id);
                  return (
                    <button key={p.id} className={'chip small' + (pos >= 0 ? ' on' : '')} onClick={() => togglePerson(p.id)}>
                      {mode === 'rotate' && pos >= 0 ? `${pos + 1}. ` : ''}
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <small className="muted">
                {mode === 'fixed'
                  ? 'Alle gewählten Personen bekommen das Ämtli jedes Mal.'
                  : 'Reihenfolge = Reihenfolge beim Antippen. Jedes Mal ist die nächste Person dran.'}
              </small>
            </>
          )}
        </div>

        {preview.length > 0 && (
          <div className="box-section">
            <h3 className="sec">Nächste Termine</h3>
            {preview.map((p) => (
              <div key={p.due} className="preview-row">
                <span>{fmtDue(p.due)}</span>
                <span className="muted">{p.who.length ? p.who.map(nameOf).join(', ') : 'offen'}</span>
              </div>
            ))}
          </div>
        )}

        <label className="field">
          <span>Notiz</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </label>

        <div className="sheet-actions">
          <button className="btn btn-primary" disabled={!valid} onClick={save}>
            Speichern
          </button>
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          {!isNew && (
            <button className={confirmDelete ? 'btn btn-danger' : 'btn btn-ghost-danger'} onClick={del}>
              {confirmDelete ? 'Wirklich löschen?' : 'Ämtli löschen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
