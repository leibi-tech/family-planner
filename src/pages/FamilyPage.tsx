import { useState } from 'react';
import { newId, put, remove, type Person } from '../db';
import { useRecords } from '../hooks';
import { CloudCard, useSync } from '../components/CloudCard';
import { isAdmin } from '../sync';

const MIN = 0.1;
const MAX = 3.0;
const STEP = 0.1;

/** 1 → «1.0», 1.25 → «1.25», 0.5 → «0.5» */
export const fmtFactor = (f: number) => f.toFixed(2).replace(/(\.\d)0$/, '$1');
const clamp = (f: number) => Math.min(MAX, Math.max(MIN, Math.round(f * 100) / 100));

export function FamilyPage() {
  const persons = useRecords<Person>('persons');
  const sync = useSync();
  const [editing, setEditing] = useState<Person | null>(null);

  if (!persons) return <p className="muted center">Lade …</p>;

  const admin = isAdmin(sync);
  const myId = sync.membership?.person_id ?? null;
  const me = persons.find((p) => p.id === myId);
  // Faktoren aus eigener Sicht: ich selbst = 1.0, die anderen im Verhältnis dazu
  const scale = me && me.factor > 0 ? me.factor : 1;
  const sorted = [...persons].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const total = sorted.reduce((s, p) => s + p.factor, 0) / scale;

  const addPerson = () => {
    const maxSort = sorted.reduce((m, p) => Math.max(m, p.sort), -1);
    setEditing({ id: newId(), name: '', factor: scale, sort: maxSort + 1, updatedAt: 0, deleted: false });
  };

  return (
    <section>
      <CloudCard />
      <p className="hint">
        Der <b>Portionenfaktor</b> sagt, wie viel jemand im Vergleich zu {me ? 'dir' : 'einer normalen Portion'} (1.0) isst.
        Daraus berechnet die App die Einkaufsmengen.
        {!admin && ' Personen und Faktoren kann nur der Admin eurer Familie ändern.'}
      </p>

      <ul className="list">
        {sorted.map((p) => (
          <li key={p.id}>
            <button className={'row' + (admin ? '' : ' readonly')} onClick={() => admin && setEditing(p)}>
              <span className="avatar" aria-hidden>
                {p.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <span className="row-main">
                {p.name}
                {p.id === myId && <span className="row-sub">du</span>}
              </span>
              <span className="badge">× {fmtFactor(p.factor / scale)}</span>
            </button>
          </li>
        ))}
      </ul>

      {sorted.length === 0 && <p className="muted center">Noch keine Personen erfasst.</p>}

      <div className="total">
        Ganze Familie: <b>Faktor {fmtFactor(total)}</b>
      </div>

      {admin && (
        <button className="btn btn-primary btn-block" onClick={addPerson}>
          + Person hinzufügen
        </button>
      )}

      {editing && (
        <PersonSheet
          person={editing}
          isNew={!persons.some((p) => p.id === editing.id)}
          scale={scale}
          meName={me?.name}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function PersonSheet({
  person,
  isNew,
  scale,
  meName,
  onClose,
}: {
  person: Person;
  isNew: boolean;
  scale: number;
  meName?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [factor, setFactor] = useState(clamp(person.factor / scale)); // aus eigener Sicht
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    await put<Person>('persons', { ...person, name: name.trim(), factor: Math.round(clamp(factor) * scale * 1000) / 1000 });
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
          <small className="muted">1.0 = {meName ? `eine Portion wie ${meName}` : 'eine normale Portion'} · 0.5 = halbe Portion</small>
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
