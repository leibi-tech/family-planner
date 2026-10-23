import { useEffect, useRef, useState } from 'react';
import { newId, put, remove, type Person } from '../db';
import { useRecords } from '../hooks';
import { useSync } from '../components/CloudCard';
import {
  CATEGORIES,
  MEAL_TYPES,
  UNITS,
  basisLabel,
  fmtAmount,
  parseAmount,
  type Basis,
  type Category,
  type MealType,
  type Menu,
} from '../model';

export function emptyMenu(familyFactor: number, mealTypes: MealType[] = []): Menu {
  return {
    id: newId(),
    name: '',
    mealTypes,
    basis: { kind: 'family', baseFactor: familyFactor },
    ingredients: [],
    note: '',
    updatedAt: 0,
    deleted: false,
  };
}

export const familyFactorOf = (persons: Person[]) => Math.round(persons.reduce((s, p) => s + p.factor, 0) * 10) / 10;

export function MenusPage() {
  const menus = useRecords<Menu>('menus');
  const persons = useRecords<Person>('persons');
  const [editing, setEditing] = useState<Menu | null>(null);

  if (!menus || !persons) return <p className="muted center">Lade …</p>;

  const sorted = [...menus].sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
  const familyFactor = familyFactorOf(persons);
  const newMenu = () => setEditing(emptyMenu(familyFactor));

  return (
    <section>
      {sorted.length === 0 ? (
        <p className="hint">
          Noch keine Menüs. Erfasse deine Lieblingsgerichte einmal, dann kannst du sie im Wochenplan immer wieder
          verwenden.
        </p>
      ) : (
        <ul className="list">
          {sorted.map((m) => (
            <li key={m.id}>
              <button className="row" onClick={() => setEditing(m)}>
                <span className="row-main">
                  {m.name}
                  <span className="row-sub">
                    {m.mealTypes.length
                      ? MEAL_TYPES.filter((t) => m.mealTypes.includes(t.id))
                          .map((t) => t.label)
                          .join(' · ')
                      : 'keine Mahlzeit gewählt'}
                  </span>
                </span>
                <span className="badge">{m.ingredients.length} {m.ingredients.length === 1 ? 'Zutat' : 'Zutaten'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-primary btn-block" onClick={newMenu}>
        + Neues Menü
      </button>

      {editing && (
        <MenuEditor
          menu={editing}
          isNew={!menus.some((m) => m.id === editing.id)}
          persons={persons}
          familyFactor={familyFactor}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

// Zutat im Formular: Menge als Text, damit «1,5» beim Tippen nicht stört.
interface IngRow {
  id: string;
  product: string;
  amountText: string;
  unit: string;
  category: Category;
}

export function MenuEditor({
  menu,
  isNew,
  persons,
  familyFactor,
  onClose,
  onSaved,
}: {
  menu: Menu;
  isNew: boolean;
  persons: Person[];
  familyFactor: number;
  onClose: () => void;
  onSaved?: (menu: Menu) => void;
}) {
  const [name, setName] = useState(menu.name);
  const [mealTypes, setMealTypes] = useState<MealType[]>(menu.mealTypes);
  const [basis, setBasis] = useState<Basis>(menu.basis);
  const [rows, setRows] = useState<IngRow[]>(() =>
    menu.ingredients.map((i) => ({ ...i, amountText: fmtAmount(i.amount) })),
  );
  const [note, setNote] = useState(menu.note);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (focusId.current) {
      document.getElementById('p-' + focusId.current)?.focus();
      focusId.current = null;
    }
  }, [rows.length]);

  const sortedPersons = [...persons].sort((a, b) => a.sort - b.sort);
  const myId = useSync().membership?.person_id;
  const scale = persons.find((p) => p.id === myId)?.factor || 1;
  const valid = name.trim().length > 0;

  const toggleMeal = (t: MealType) =>
    setMealTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const setFamily = () =>
    setBasis(menu.basis.kind === 'family' ? menu.basis : { kind: 'family', baseFactor: familyFactor });

  const setPerson = (personId: string) => {
    const p = persons.find((x) => x.id === personId) ?? sortedPersons[0];
    if (p) setBasis({ kind: 'person', baseFactor: p.factor, personId: p.id, personName: p.name });
  };

  const updateRow = (id: string, patch: Partial<IngRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => {
    const id = newId();
    focusId.current = id;
    setRows((rs) => [...rs, { id, product: '', amountText: '', unit: 'g', category: 'lebensmittel' }]);
  };

  const save = async () => {
    if (!valid) return;
    const ingredients = rows
      .filter((r) => r.product.trim())
      .map((r) => ({
        id: r.id,
        product: r.product.trim(),
        amount: parseAmount(r.amountText),
        unit: r.unit,
        category: r.category,
      }));
    const saved: Menu = { ...menu, name: name.trim(), mealTypes, basis, ingredients, note: note.trim() };
    await put<Menu>('menus', saved);
    onSaved?.(saved);
    onClose();
  };

  const del = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    await remove<Menu>('menus', menu);
    onClose();
  };

  return (
    <div className="sheet-backdrop">
      <div className="sheet sheet-full" role="dialog" aria-modal="true">
        <h2>{isNew ? 'Neues Menü' : 'Menü bearbeiten'}</h2>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Spaghetti Bolognese" />
        </label>

        <div className="field">
          <span>Mahlzeit</span>
          <div className="chips">
            {MEAL_TYPES.map((t) => (
              <button
                key={t.id}
                className={'chip' + (mealTypes.includes(t.id) ? ' on' : '')}
                onClick={() => toggleMeal(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Die Mengen gelten für …</span>
          <div className="seg">
            <button className={basis.kind === 'family' ? 'on' : ''} onClick={setFamily}>
              Ganze Familie
            </button>
            <button
              className={basis.kind === 'person' ? 'on' : ''}
              onClick={() => setPerson(basis.kind === 'person' ? basis.personId : (myId ?? sortedPersons[0]?.id))}
            >
              1 Portion
            </button>
          </div>
          {basis.kind === 'person' && (
            <select
              className="select"
              value={basis.personId}
              onChange={(e) => setPerson(e.target.value)}
              aria-label="Person"
            >
              {sortedPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  1 Portion von {p.name} (Faktor {(p.factor / scale).toFixed(2).replace(/(\.\d)0$/, '$1')})
                </option>
              ))}
            </select>
          )}
          <small className="muted">Mengen gelten für: {basisLabel(basis, scale)}</small>
        </div>

        <div className="field">
          <span>Zutaten</span>
          {rows.length === 0 && <small className="muted">Noch keine Zutaten.</small>}
          <div className="ings">
            {rows.map((r) => (
              <div key={r.id} className="ing">
                <div className="ing-top">
                  <input
                    id={'p-' + r.id}
                    value={r.product}
                    onChange={(e) => updateRow(r.id, { product: e.target.value })}
                    placeholder="Produkt, z.B. Hackfleisch"
                  />
                  <button
                    className="icon-btn"
                    aria-label="Zutat entfernen"
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  >
                    ✕
                  </button>
                </div>
                <div className="ing-bottom">
                  <input
                    className="amount"
                    inputMode="decimal"
                    value={r.amountText}
                    onChange={(e) => updateRow(r.id, { amountText: e.target.value })}
                    placeholder="Menge"
                    aria-label="Menge"
                  />
                  <select
                    className="select"
                    value={r.unit}
                    onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                    aria-label="Einheit"
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                  <button
                    className={'chip small' + (r.category === 'anderes' ? ' on-alt' : '')}
                    onClick={() =>
                      updateRow(r.id, { category: r.category === 'lebensmittel' ? 'anderes' : 'lebensmittel' })
                    }
                    aria-label="Sparte wechseln"
                  >
                    {CATEGORIES.find((c) => c.id === r.category)!.label}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-block" onClick={addRow}>
            + Zutat
          </button>
        </div>

        <label className="field">
          <span>Notiz / Zubereitung (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        </label>

        <div className="sheet-actions">
          <button className="btn btn-primary btn-block" onClick={save} disabled={!valid}>
            Speichern
          </button>
          <button className="btn btn-block" onClick={onClose}>
            Abbrechen
          </button>
          {!isNew && (
            <button className={'btn btn-block ' + (confirmDelete ? 'btn-danger' : 'btn-ghost-danger')} onClick={del}>
              {confirmDelete ? `Wirklich «${menu.name}» löschen?` : 'Menü löschen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
