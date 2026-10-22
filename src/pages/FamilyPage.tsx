import { useState } from 'react';
import { newId, put, remove, type Person } from '../db';
import { useRecords } from '../hooks';

const MIN = 0.1;
const MAX = 3.0;
const STEP = 0.1;

export const fmtFactor = (f: number) => f.toFixed(1);
const clamp = (f: number) => Math.min(MAX, Math.max(MIN, Math.round(f * 10) / 10));

export function FamilyPage() {
  const persons = useRecords<Person>('persons');
  const [editing, setEditing] = useState<Person | null>(null);

  if (!persons) return <p className="muted center">Lade …</p>;

  const sorted = [...persons].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const total = sorted.reduce((s, p) => s + p.factor, 0);

  const addPerson = () => {
    const maxSort = sorted.reduce((m, p) => Math.max(m, p.sort), -1);
    setEditing({ id: newId(), name: '', factor: 1.0, sort: maxSort + 1, updatedAt: 0, deleted: false });
  };

  return (
    <section>
      <p className="hint">
        Der <b>Portionenfaktor</b> sagt, wie viel jemand im Vergleich zu Tobias (1.0) isst. Daraus berechnet die App
        später die Einkaufsmengen.
      </p>

      <ul className="list">
        {sorted.map((p) => (
          <li key={p.id}>
            <button className="row" onClick={() => setEditing(p)}>
              <span className="avatar" aria-hidden>
                {p.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <span className="row-main">{p.name}</span>
              <span className="badge">× {fmtFactor(p.factor)}</span>
            </button>
          </li>
        ))}
      </ul>

      {sorted.length === 0 && <p className="muted center">Noch keine Personen erfasst.</p>}

      <div className="total">
        Ganze Familie: <b>Faktor {fmtFactor(total)}</b>
      </div>

      <button className="btn btn-primary btn-block" onClick={addPerson}>
        + Person hinzufügen
      </button>

      {editing && (
        <PersonSheet
          person={editing}
          isNew={!persons.some((p) => p.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function PersonSheet({ person, isNew, onClose }: { person: Person; isNew: boolean; onClose: () => void }) {
  const [name, setName] = useState(person.name);
  const [factor, setFactor] = useState(person.factor);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    await put<Person>('persons', { ...person, name: name.trim(), factor: clamp(factor) });
    onClose();
  };

  const del = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await remove<Person>('persons', person);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Neue Person' : 'Person bearbeiten'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Anna"
            autoFocus={isNew}
            enterKeyHint="done"
          />
        </label>

        <div className="field">
          <span>Portionenfaktor</span>
          <div className="stepper">
            <button className="btn step" onClick={() => setFactor((f) => clamp(f - STEP))} aria-label="weniger">
              −
            </button>
            <output className="step-value">{fmtFactor(factor)}</output>
            <button className="btn step" onClick={() => setFactor((f) => clamp(f + STEP))} aria-label="mehr">
              +
            </button>
          </div>
          <small className="muted">1.0 = eine Portion wie Tobias · 0.5 = halbe Portion</small>
        </div>

        <div className="sheet-actions">
          <button className="btn btn-primary btn-block" onClick={save} disabled={!valid}>
            Speichern
          </button>
          <button className="btn btn-block" onClick={onClose}>
            Abbrechen
          </button>
          {!isNew && (
            <button className={'btn btn-block ' + (confirmDelete ? 'btn-danger' : 'btn-ghost-danger')} onClick={del}>
              {confirmDelete ? `Wirklich «${person.name}» löschen?` : 'Löschen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
