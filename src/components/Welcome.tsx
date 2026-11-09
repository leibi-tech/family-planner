// Erster Start (v0.29): Die App fragt nach dem eigenen Namen, statt fest «Tobias» einzutragen.
import { useState } from 'react';
import { newId, put, type Person } from '../db';
import { useRecords } from '../hooks';
import { useSync } from './CloudCard';

const DONE_KEY = 'fp-welcome-done';
const isDone = () => {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
};
const setDone = () => {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {}
};

/** Erscheint nur, solange noch keine Person erfasst ist und das Handy mit keiner Familie verbunden ist. */
export function Welcome({ onJoin }: { onJoin: () => void }) {
  const persons = useRecords<Person>('persons');
  const sync = useSync();
  const [name, setName] = useState('');
  const [hidden, setHidden] = useState(isDone);
  if (hidden || !persons || persons.length > 0 || sync.household) return null;

  const start = async () => {
    const n = name.trim();
    if (!n) return;
    await put<Person>('persons', { id: newId(), name: n, factor: 1, sort: 0, updatedAt: 0, deleted: false });
    setDone();
    setHidden(true);
  };

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Willkommen">
        <h2>Willkommen bei myFam. 👋</h2>
        <label className="field">
          <span>Wie heisst du?</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void start()}
            placeholder="Dein Vorname"
            autoFocus
            enterKeyHint="done"
          />
        </label>
        <p className="hint">Weitere Personen (Partner/in, Kinder) fügst du danach unter Mehr → Familie dazu.</p>
        <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={() => void start()}>
          Los geht's
        </button>
        <button
          className="btn btn-block"
          style={{ marginTop: 10 }}
          onClick={() => {
            setDone();
            setHidden(true);
            onJoin();
          }}
        >
          Ich trete einer bestehenden Familie bei
        </button>
      </div>
    </div>
  );
}
