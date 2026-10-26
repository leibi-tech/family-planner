import { useEffect, useRef, useState } from 'react';
import { newId, put, type Person } from '../db';
import { useRecords } from '../hooks';
import {
  addItem,
  blankNote,
  clearDoneItems,
  deleteItem,
  fmtAgo,
  isPinnedFor,
  isPinnedForAll,
  patchItem,
  preview,
  progress,
  setPin,
  sortNotes,
  subItems,
  topItems,
  updateNote,
  type Note,
  type NoteItem,
} from '../notes';
import { useMe } from './TodoPage';

type Filter = 'all' | 'note' | 'list';

const lsGet = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};

export function NotesPage() {
  const notes = useRecords<Note>('notes');
  const persons = useRecords<Person>('persons');
  const me = useMe(persons);
  const [filter, setFilterState] = useState<Filter>(() => lsGet('fp-notes-filter', 'all') as Filter);
  const [open, setOpen] = useState<Note | null>(null); // geöffnete Notiz (neu oder bestehend)

  if (!notes || !persons) return <p className="muted center">Lade …</p>;
  const sortedPersons = [...persons].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

  if (open) {
    return <NoteEditor key={open.id} initial={open} persons={sortedPersons} me={me} onClose={() => setOpen(null)} />;
  }

  const setFilter = (f: Filter) => {
    setFilterState(f);
    try {
      localStorage.setItem('fp-notes-filter', f);
    } catch {}
  };
  const nameOf = (id: string | null) => persons.find((p) => p.id === id)?.name ?? null;
  const shown = sortNotes(notes.filter((n) => filter === 'all' || n.kind === filter), me);
  const count = (k: Filter) => notes.filter((n) => k === 'all' || n.kind === k).length;

  return (
    <section>
      <div className="btn-pair note-new">
        <button className="btn btn-primary" onClick={() => setOpen(blankNote('note', me))}>
          + Notiz
        </button>
        <button className="btn btn-primary" onClick={() => setOpen(blankNote('list', me))}>
          + Liste
        </button>
      </div>

      <div className="seg seg3 view-tabs">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
          Alle <span className="tab-count">{count('all')}</span>
        </button>
        <button className={filter === 'note' ? 'on' : ''} onClick={() => setFilter('note')}>
          Notizen <span className="tab-count">{count('note')}</span>
        </button>
        <button className={filter === 'list' ? 'on' : ''} onClick={() => setFilter('list')}>
          Listen <span className="tab-count">{count('list')}</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="hint center">
          {notes.length === 0
            ? 'Noch nichts erfasst. Hier sammelt ihr Notizen und Listen, z.B. Geschenkideen oder die Packliste für die Ferien.'
            : 'Nichts in dieser Ansicht.'}
        </p>
      ) : (
        <ul className="note-list">
          {shown.map((n) => {
            const pinned = isPinnedFor(n, me);
            const all = isPinnedForAll(n, persons);
            const who = nameOf(n.editedBy);
            return (
              <li key={n.id}>
                <button className="note-card" onClick={() => setOpen(n)}>
                  <span className="note-icon" aria-hidden>
                    {n.kind === 'list' ? '☑️' : '📝'}
                  </span>
                  <span className="note-main">
                    <span className="note-title">
                      {n.private && <span aria-label="privat">🔒 </span>}
                      {n.title || (n.kind === 'list' ? 'Liste ohne Titel' : 'Notiz ohne Titel')}
                    </span>
                    <span className="note-preview">{preview(n)}</span>
                    <span className="note-meta">
                      {who ? `${who} · ` : ''}
                      {fmtAgo(n.updatedAt)}
                    </span>
                  </span>
                  {pinned && (
                    <span className="note-pin" aria-label={all ? 'für alle angeheftet' : 'angeheftet'}>
                      {all ? '📌📌' : '📌'}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Speichern nach kurzer Pause ----------

/** Speichert einen Text 0.6 s nach der letzten Eingabe und beim Verlassen der Seite. */
function useAutosave(value: string, stored: string, save: (v: string) => void) {
  const latest = useRef(value);
  const storedRef = useRef(stored);
  const saveRef = useRef(save);
  latest.current = value;
  storedRef.current = stored;
  saveRef.current = save;
  useEffect(() => {
    if (value === storedRef.current) return;
    const t = setTimeout(() => saveRef.current(value), 600);
    return () => clearTimeout(t);
  }, [value]);
  useEffect(
    () => () => {
      if (latest.current !== storedRef.current) saveRef.current(latest.current);
    },
    [],
  );
}

// ---------- Notiz / Liste bearbeiten ----------

function NoteEditor({
  initial,
  persons,
  me,
  onClose,
}: {
  initial: Note;
  persons: Person[];
  me: string | null;
  onClose: () => void;
}) {
  const notes = useRecords<Note>('notes');
  const [curId, setCurId] = useState(initial.id);
  const base = useRef<Note>(initial); // Grundlage, solange noch nichts gespeichert ist
  const queue = useRef<Promise<unknown>>(Promise.resolve()); // Änderungen nacheinander speichern
  const live = notes?.find((n) => n.id === curId) ?? base.current;

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [, force] = useState(0);
  const [pinMenu, setPinMenu] = useState(false);
  const [confirm, setConfirm] = useState<null | 'private' | 'shared' | 'delete'>(null);

  const commit = (fn: (n: Note) => Note) => {
    const run = queue.current.then(async () => {
      base.current = await updateNote(base.current, me, fn);
    });
    queue.current = run.catch(() => {});
    return run;
  };

  useAutosave(title, live.title, (v) => void commit((n) => ({ ...n, title: v })));
  useAutosave(body, live.body, (v) => void commit((n) => ({ ...n, body: v })));

  const isList = live.kind === 'list';
  const pinnedMe = isPinnedFor(live, me);
  const pinnedAll = isPinnedForAll(live, persons);
  const allIds = persons.map((p) => p.id);
  const nameOf = (id: string | null) => persons.find((p) => p.id === id)?.name ?? null;

  // Privat ↔ geteilt: als neuer Eintrag speichern, den alten ohne Inhalt löschen
  // (so bleibt nichts Privates bei den anderen liegen und nichts Geteiltes hängen).
  const changeVisibility = async (priv: boolean) => {
    setConfirm(null);
    await queue.current;
    const stored = notes?.find((n) => n.id === curId);
    const cur: Note = { ...live, title: title, body: body, private: priv };
    if (priv) cur.pins = me ? { [me]: { on: !!live.pins?.[me]?.on, at: Date.now() } } : {};
    if (!stored) {
      base.current = cur;
      force((x) => x + 1);
      return;
    }
    const next: Note = { ...cur, id: newId(), updatedAt: 0, editedBy: me };
    await put<Note>('notes', next);
    await put('notes', { id: stored.id, updatedAt: stored.updatedAt, deleted: true });
    base.current = next;
    setCurId(next.id);
  };

  const pinFor = (ids: string[], on: boolean) => {
    setPinMenu(false);
    void commit((n) => setPin(n, ids, on));
  };

  const remove = async () => {
    await queue.current;
    const stored = notes?.find((n) => n.id === curId);
    if (stored) await put('notes', { id: stored.id, updatedAt: stored.updatedAt, deleted: true });
    onClose();
  };

  const creator = nameOf(live.createdBy);
  const editor = nameOf(live.editedBy);
  const saved = !!notes?.find((n) => n.id === curId);

  return (
    <section className="note-editor">
      <div className="note-head">
        <button className="btn" onClick={onClose}>
          ‹ Zurück
        </button>
        <div className="note-head-actions">
          <button
            className={'icon-btn' + (pinnedMe ? ' on' : '')}
            aria-label="Anheften"
            aria-expanded={pinMenu}
            onClick={() => setPinMenu(!pinMenu)}
          >
            {pinnedAll ? '📌📌' : '📌'}
          </button>
          <button
            className={'icon-btn' + (live.private ? ' on' : '')}
            aria-label={live.private ? 'Privat – nur für dich' : 'Für alle sichtbar'}
            onClick={() => setConfirm(live.private ? 'shared' : 'private')}
          >
            {live.private ? '🔒' : '🔓'}
          </button>
        </div>
      </div>

      {pinMenu && (
        <div className="pin-menu">
          <button className="btn" onClick={() => pinFor(me ? [me] : [], !pinnedMe)} disabled={!me}>
            {pinnedMe ? '📌 Bei mir lösen' : '📌 Für mich anheften'}
          </button>
          {!live.private && (
            <button className="btn" onClick={() => pinFor(allIds, true)}>
              📌📌 Für alle anheften
            </button>
          )}
          <small className="muted">
            Angeheftetes erscheint auf der Startseite. Jede Person kann es bei sich selbst wieder lösen.
          </small>
        </div>
      )}

      {confirm === 'private' && (
        <div className="confirm-bar">
          <p>
            🔒 Nur du siehst diese {isList ? 'Liste' : 'Notiz'} danach. Die anderen sehen sie nicht mehr.
          </p>
          <div className="btn-pair">
            <button className="btn btn-primary" onClick={() => changeVisibility(true)}>
              Privat machen
            </button>
            <button className="btn" onClick={() => setConfirm(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {confirm === 'shared' && (
        <div className="confirm-bar">
          <p>
            🔓 Alle in der Familie sehen diese {isList ? 'Liste' : 'Notiz'} danach und können sie bearbeiten.
          </p>
          <div className="btn-pair">
            <button className="btn btn-primary" onClick={() => changeVisibility(false)}>
              Für alle freigeben
            </button>
            <button className="btn" onClick={() => setConfirm(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <input
        className="note-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isList ? 'Titel der Liste' : 'Titel'}
        enterKeyHint="done"
        autoFocus={!initial.title && !initial.body && !(initial.items ?? []).length}
        aria-label="Titel"
      />

      {isList ? (
        <ListBody note={live} commit={commit} />
      ) : (
        <textarea
          className="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Text …"
          aria-label="Text"
        />
      )}

      <p className="muted small-note note-info">
        {live.private ? '🔒 Privat. ' : ''}
        {saved && editor ? `Zuletzt geändert von ${editor}, ${fmtAgo(live.updatedAt)}. ` : ''}
        {saved && creator ? `Erstellt von ${creator}.` : ''}
      </p>

      {saved && (
        <div className="sheet-actions">
          <button
            className={confirm === 'delete' ? 'btn btn-danger' : 'btn btn-ghost-danger'}
            onClick={() => (confirm === 'delete' ? remove() : setConfirm('delete'))}
          >
            {confirm === 'delete' ? 'Wirklich löschen?' : isList ? 'Liste löschen' : 'Notiz löschen'}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Liste mit Unterpunkten ----------

function ListBody({ note, commit }: { note: Note; commit: (fn: (n: Note) => Note) => Promise<unknown> }) {
  const [text, setText] = useState('');
  const [subFor, setSubFor] = useState<string | null>(null); // Hauptpunkt, zu dem gerade ein Unterpunkt erfasst wird
  const [subText, setSubText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  const p = progress(note);
  const tops = topItems(note);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    void commit((n) => addItem(n, t, null));
    addRef.current?.focus();
  };
  const addSub = (parent: string) => {
    const t = subText.trim();
    if (!t) return setSubFor(null);
    setSubText('');
    void commit((n) => addItem(n, t, parent));
  };
  const toggle = (it: NoteItem) => void commit((n) => patchItem(n, it.id, { done: !it.done }));
  const startEdit = (it: NoteItem) => {
    setEditId(it.id);
    setEditText(it.text);
  };
  const finishEdit = (it: NoteItem) => {
    const t = editText.trim();
    setEditId(null);
    if (t && t !== it.text) void commit((n) => patchItem(n, it.id, { text: t }));
  };
  const del = (it: NoteItem) => {
    setEditId(null);
    void commit((n) => deleteItem(n, it.id));
  };

  const row = (it: NoteItem, isSub: boolean) => {
    const subs = isSub ? [] : subItems(note, it.id);
    const subDone = subs.filter((s) => s.done).length;
    return (
      <div className={'ni-row' + (it.done ? ' done' : '') + (isSub ? ' sub' : '')}>
        <button className="todo-check" aria-label={it.done ? 'Wieder öffnen' : 'Erledigt'} onClick={() => toggle(it)}>
          <span className="box" aria-hidden>
            {it.done ? '✓' : ''}
          </span>
        </button>
        {editId === it.id ? (
          <>
            <input
              className="ni-edit"
              value={editText}
              autoFocus
              onChange={(e) => setEditText(e.target.value)}
              onBlur={() => finishEdit(it)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              enterKeyHint="done"
              aria-label="Punkt bearbeiten"
            />
            <button className="icon-btn danger" aria-label="Punkt löschen" onMouseDown={(e) => e.preventDefault()} onClick={() => del(it)}>
              ✕
            </button>
          </>
        ) : (
          <>
            <button className="ni-text" onClick={() => startEdit(it)}>
              {it.text}
              {subs.length > 0 && (
                <span className="ni-count">
                  {subDone}/{subs.length}
                </span>
              )}
            </button>
            {!isSub && (
              <button
                className="icon-btn small"
                aria-label="Unterpunkt hinzufügen"
                onClick={() => {
                  setSubFor(subFor === it.id ? null : it.id);
                  setSubText('');
                }}
              >
                ⤷
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {p.total > 0 && (
        <p className="muted small-note">
          {p.done} von {p.total} erledigt
        </p>
      )}
      <ul className="ni-list">
        {tops.map((it) => (
          <li key={it.id} className="ni-group">
            {row(it, false)}
            {subItems(note, it.id).map((s) => (
              <div key={s.id}>{row(s, true)}</div>
            ))}
            {subFor === it.id && (
              <div className="ni-row sub ni-add">
                <input
                  className="ni-edit"
                  value={subText}
                  autoFocus
                  onChange={(e) => setSubText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSub(it.id)}
                  onBlur={() => !subText.trim() && setSubFor(null)}
                  placeholder="Unterpunkt …"
                  enterKeyHint="done"
                  aria-label="Neuer Unterpunkt"
                />
                <button className="btn btn-primary small-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => addSub(it.id)}>
                  +
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="quick-add">
        <input
          ref={addRef}
          className="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Neuer Punkt …"
          enterKeyHint="done"
          aria-label="Neuer Punkt"
        />
        <button className="btn btn-primary quick-btn" aria-label="Punkt hinzufügen" onClick={add}>
          +
        </button>
      </div>

      {p.done > 0 && (
        <button className="btn btn-block" onClick={() => void commit((n) => clearDoneItems(n))}>
          Erledigte entfernen ({p.done})
        </button>
      )}
    </>
  );
}
