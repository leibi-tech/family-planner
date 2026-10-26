import { useEffect, useState } from 'react';
import { put, type Person } from '../db';
import { useRecords } from '../hooks';
import { dateKey, type Menu, type PlanDay } from '../model';
import { requestOpen } from '../nav';
import {
  fmtAgo,
  isPinnedFor,
  patchItem,
  preview,
  progress,
  setPin,
  topItems,
  updateNote,
  type Note,
} from '../notes';
import { fmtDue, isMine, isOverdue, sortTodos, type Todo } from '../todos';
import { useMe } from './TodoPage';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const greeting = (h: number) => (h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend');

const MAX_TODOS = 5;
const MAX_ITEMS = 5; // offene Punkte einer angehefteten Liste
const MAX_RECENT = 4;

export function StartPage({ goto }: { goto: (tab: string) => void }) {
  const persons = useRecords<Person>('persons');
  const menus = useRecords<Menu>('menus');
  const days = useRecords<PlanDay>('days');
  const todos = useRecords<Todo>('todos');
  const notes = useRecords<Note>('notes');
  const me = useMe(persons);

  // Datum und Uhrzeit laufend nachführen (Tageswechsel um Mitternacht)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60000);
    const vis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  if (!persons || !menus || !days || !todos || !notes) return <p className="muted center">Lade …</p>;

  const myName = persons.find((p) => p.id === me)?.name;
  const nameOf = (id: string | null) => persons.find((p) => p.id === id)?.name ?? null;

  // ---- Was kochen wir heute? ----
  const today = days.find((d) => d.id === dateKey(now));
  const meals = (today?.slots ?? []).filter((s) => s.active && s.dishes.length > 0);
  const menuById = new Map(menus.map((m) => [m.id, m]));

  // ---- Meine ToDos ----
  const myTodos = sortTodos(todos.filter((t) => !t.done && !t.cleared && isMine(t, me)));
  const todayKey = dateKey(now);
  const toggleTodo = (t: Todo) => put<Todo>('todos', { ...t, done: true, doneAt: Date.now(), doneBy: me });

  // ---- Angeheftet / zuletzt geändert ----
  const pinned = notes.filter((n) => isPinnedFor(n, me)).sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = notes
    .filter((n) => !isPinnedFor(n, me))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_RECENT);

  const openNote = (n: Note) => requestOpen('note', n.id, 'start');

  return (
    <section className="dash">
      <header className="dash-hello">
        <h2>
          {greeting(now.getHours())}
          {myName ? `, ${myName}` : ''}
        </h2>
        <p className="muted">
          {DAYS[now.getDay()]}, {now.getDate()}. {MONTHS[now.getMonth()]}
        </p>
      </header>

      {/* Was kochen wir heute? */}
      <div className="dash-card">
        <div className="dash-head">
          <h3>🍽️ Was kochen wir heute?</h3>
          <button className="dash-link" onClick={() => goto('plan')}>
            Plan ›
          </button>
        </div>
        {meals.length === 0 ? (
          <p className="muted dash-empty">Für heute ist noch nichts geplant.</p>
        ) : (
          <ul className="dash-meals">
            {meals.map((s) => {
              const absent = s.absent.map((id) => nameOf(id)).filter(Boolean);
              return (
                <li key={s.id}>
                  <span className="dash-meal-label">{s.label}</span>
                  <span className="dash-dishes">
                    {s.dishes.map((d) => {
                      const m = menuById.get(d.menuId);
                      return m ? (
                        <button key={d.id} className="dash-dish" onClick={() => requestOpen('menu', m.id, 'start')}>
                          {m.name}
                        </button>
                      ) : (
                        <span key={d.id} className="muted">
                          gelöschtes Menü
                        </span>
                      );
                    })}
                    {absent.length > 0 && <small className="muted">ohne {absent.join(', ')}</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Meine ToDos */}
      <div className="dash-card">
        <div className="dash-head">
          <h3>
            ✅ Meine ToDos
            {myTodos.length > 0 && <span className="tab-count">{myTodos.length}</span>}
          </h3>
          <button className="dash-link" onClick={() => goto('todo')}>
            Alle ›
          </button>
        </div>
        {myTodos.length === 0 ? (
          <p className="muted dash-empty">{me ? 'Nichts zu tun. 🎉' : 'Lege unter «Familie» fest, wer du bist.'}</p>
        ) : (
          <ul className="dash-todos">
            {myTodos.slice(0, MAX_TODOS).map((t) => {
              const late = isOverdue(t, todayKey);
              return (
                <li key={t.id} className={'dash-todo' + (late ? ' overdue' : '')}>
                  <button className="todo-check" aria-label="Erledigt" onClick={() => toggleTodo(t)}>
                    <span className="box" aria-hidden />
                  </button>
                  <button className="dash-todo-main" onClick={() => requestOpen('todo', t.id, 'start')}>
                    <span className="dash-todo-title">
                      {t.private && <span aria-label="privat">🔒 </span>}
                      {t.choreId && <span aria-label="Ämtli">🔁 </span>}
                      {t.noteId && <span aria-label="mit Notiz">📝 </span>}
                      {t.title}
                    </span>
                    {t.due && (
                      <span className={'todo-due' + (late ? ' late' : '')}>
                        {late ? 'überfällig · ' : ''}
                        {fmtDue(t.due, now)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {myTodos.length > MAX_TODOS && (
          <button className="dash-more" onClick={() => goto('todo')}>
            + {myTodos.length - MAX_TODOS} weitere
          </button>
        )}
      </div>

      {/* Angeheftet */}
      {pinned.length > 0 ? (
        <div className="dash-card">
          <div className="dash-head">
            <h3>📌 Angeheftet</h3>
            <button className="dash-link" onClick={() => goto('notizen')}>
              Notizen ›
            </button>
          </div>
          <ul className="dash-pins">
            {pinned.map((n) => (
              <PinnedNote key={n.id} note={n} me={me} onOpen={() => openNote(n)} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="dash-card dash-hint">
          <h3>📌 Angeheftet</h3>
          <p className="muted dash-empty">
            Hier erscheinen Notizen und Listen, die du mit dem Pin (📌) anheftest, z.B. die Einkaufs- oder Packliste.
          </p>
        </div>
      )}

      {/* Zuletzt geändert */}
      {recent.length > 0 && (
        <div className="dash-card">
          <div className="dash-head">
            <h3>🕘 Zuletzt geändert</h3>
            <button className="dash-link" onClick={() => goto('notizen')}>
              Notizen ›
            </button>
          </div>
          <ul className="dash-recent">
            {recent.map((n) => {
              const who = nameOf(n.editedBy);
              return (
                <li key={n.id}>
                  <button className="dash-recent-row" onClick={() => openNote(n)}>
                    <span aria-hidden>{n.kind === 'list' ? '☑️' : '📝'}</span>
                    <span className="dash-recent-main">
                      <span className="dash-recent-title">
                        {n.private && '🔒 '}
                        {n.title || (n.kind === 'list' ? 'Liste ohne Titel' : 'Notiz ohne Titel')}
                      </span>
                      <span className="muted dash-recent-meta">
                        {who ? `${who} · ` : ''}
                        {fmtAgo(n.updatedAt, now.getTime())}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Angeheftete Notiz/Liste. Bei Listen können offene Punkte direkt abgehakt werden. */
function PinnedNote({ note, me, onOpen }: { note: Note; me: string | null; onOpen: () => void }) {
  const open = topItems(note).filter((i) => !i.done);
  const p = progress(note);
  const unpin = () => me && void updateNote(note, me, (n) => setPin(n, [me], false));
  const tick = (id: string) => void updateNote(note, me, (n) => patchItem(n, id, { done: true }));

  return (
    <li className="dash-pin">
      <div className="dash-pin-head">
        <button className="dash-pin-title" onClick={onOpen}>
          <span aria-hidden>{note.kind === 'list' ? '☑️' : '📝'}</span>
          <span className="dash-pin-name">
            {note.private && '🔒 '}
            {note.title || (note.kind === 'list' ? 'Liste ohne Titel' : 'Notiz ohne Titel')}
          </span>
          {note.kind === 'list' && p.total > 0 && (
            <span className="ni-count">
              {p.done}/{p.total}
            </span>
          )}
        </button>
        <button className="icon-btn small" aria-label="Von der Startseite lösen" title="Von der Startseite lösen" onClick={unpin}>
          ✕
        </button>
      </div>
      {note.kind === 'list' ? (
        open.length === 0 ? (
          <p className="muted dash-pin-empty">{p.total ? 'Alles erledigt. 🎉' : 'Noch keine Punkte.'}</p>
        ) : (
          <ul className="dash-pin-items">
            {open.slice(0, MAX_ITEMS).map((it) => (
              <li key={it.id}>
                <button className="todo-check" aria-label="Erledigt" onClick={() => tick(it.id)}>
                  <span className="box" aria-hidden />
                </button>
                <button className="dash-pin-item" onClick={onOpen}>
                  {it.text}
                </button>
              </li>
            ))}
            {open.length > MAX_ITEMS && (
              <li>
                <button className="dash-more" onClick={onOpen}>
                  + {open.length - MAX_ITEMS} weitere
                </button>
              </li>
            )}
          </ul>
        )
      ) : (
        <button className="dash-pin-text" onClick={onOpen}>
          {preview(note)}
        </button>
      )}
    </li>
  );
}
