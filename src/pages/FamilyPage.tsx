import { useEffect, useState } from 'react';
import { getAll, newId, put, remove, type Person } from '../db';
import type { Menu } from '../model';
import { useRecords } from '../hooks';
import { CloudCard, useSync } from '../components/CloudCard';
import { isAdmin } from '../sync';

const MIN = 0.05;
const MAX = 3.0;
const STEP = 0.05;

/** 1 → «1.0», 1.25 → «1.25», 0.5 → «0.5» */
export const fmtFactor = (f: number) => f.toFixed(2).replace(/(\.\d)0$/, '$1');
/** Auf 0.05 runden und begrenzen. */
const clamp = (f: number) => Math.min(MAX, Math.max(MIN, Math.round(f * 20) / 20));

/**
 * Reparatur (v0.9.2): Bis v0.9.1 konnte man den eigenen Faktor ändern. Dann ist der gespeicherte
 * Faktor des Erstellers nicht mehr 1.0, und alles erscheint krumm (z.B. 1.01, 0.61).
 * Nur der Ersteller (bzw. ohne Haushalt) rechnet einmal alles um: eigener Faktor = 1.0, die anderen
 * auf 0.05 gerundet. Die Mengen-Bezüge aller Menüs werden im gleichen Verhältnis angepasst,
 * damit die Einkaufsmengen gleich bleiben.
 */
let repairing = false;
async function repairFactors(myId: string) {
  if (repairing) return;
  repairing = true;
  try {
    const persons = await getAll<Person>('persons');
    const me = persons.find((p) => p.id === myId);
    if (!me || me.factor <= 0 || Math.abs(me.factor - 1) < 0.001) return;
    const k = 1 / me.factor;
    for (const p of persons) {
      const f = p.id === myId ? 1 : clamp(p.factor * k);
      if (f !== p.factor) await put<Person>('persons', { ...p, factor: f });
    }
    for (const m of await getAll<Menu>('menus')) {
      await put<Menu>('menus', { ...m, basis: { ...m.basis, baseFactor: Math.round(m.basis.baseFactor * k * 10000) / 10000 } });
    }
  } finally {
    repairing = false;
  }
}

export function FamilyPage() {
  const persons = useRecords<Person>('persons');
  const sync = useSync();
  const [editing, setEditing] = useState<Person | null>(null);
  const myId0 = sync.membership?.person_id ?? null;
  const myStored = persons?.find((p) => p.id === myId0)?.factor;
  useEffect(() => {
    const owner = sync.membership?.role === 'owner';
    if (myId0 && owner && myStored != null && Math.abs(myStored - 1) >= 0.001) repairFactors(myId0);
  }, [myId0, myStored, sync.membership?.role]);

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
          isMe={editing.id === myId}
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
  isMe,
  onClose,
}: {
  person: Person;
  isNew: boolean;
  scale: number;
  meName?: string;
  isMe: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [factor, setFactor] = useState(clamp(person.factor / scale)); // aus eigener Sicht
  const [factorText, setFactorText] = useState(fmtFactor(clamp(person.factor / scale)));
  const step = (d: number) => {
    const f = clamp(factor + d);
    setFactor(f);
    setFactorText(fmtFactor(f));
  };
  const typeFactor = (t: string) => {
    setFactorText(t);
    const n = Number(t.trim().replace(',', '.'));
    if (Number.isFinite(n) && n > 0) setFactor(clamp(n));
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    // Der eigene Faktor bleibt unverändert (man selbst ist immer 1.0), nur der Name ändert sich.
    const f = isMe ? person.factor : Math.round(clamp(factor) * scale * 1000) / 1000;
    await put<Person>('persons', { ...person, name: name.trim(), factor: f });
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
          {isMe ? (
            <small className="muted">Du bist immer 1.0. Die Faktoren der anderen sagen, wie viel sie im Vergleich zu dir essen.</small>
          ) : (
            <>
              <div className="stepper">
                <button className="btn step" onClick={() => step(-STEP)} aria-label="weniger">
                  −
                </button>
                <input
                  className="step-value step-input"
                  inputMode="decimal"
                  value={factorText}
                  onChange={(e) => typeFactor(e.target.value)}
                  onBlur={() => setFactorText(fmtFactor(factor))}
                  onFocus={(e) => e.target.select()}
                  aria-label="Portionenfaktor"
                />
                <button className="btn step" onClick={() => step(STEP)} aria-label="mehr">
                  +
                </button>
              </div>
              <small className="muted">
                1.0 = {meName ? `eine Portion wie ${meName}` : 'eine normale Portion'} · 0.5 = halbe Portion · wird auf 0.05 gerundet
              </small>
            </>
          )}
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
