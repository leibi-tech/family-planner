import { useMemo, useState } from 'react';
import { newId, put, type Person } from '../db';
import { useRecords } from '../hooks';
import {
  MEAL_TYPES,
  WEEKDAYS,
  addDays,
  dateKey,
  defaultSlots,
  fmtDay,
  isoWeek,
  mondayOf,
  type MealType,
  type Menu,
  type PlanDay,
  type Slot,
} from '../model';
import { MenuEditor, emptyMenu, familyFactorOf } from './MenusPage';

type Sel = { dayKey: string; slotId: string } | null;

function blankDay(key: string): PlanDay {
  return { id: key, slots: defaultSlots(key), updatedAt: 0, deleted: false };
}

export function PlanPage() {
  const days = useRecords<PlanDay>('days');
  const menus = useRecords<Menu>('menus');
  const persons = useRecords<Person>('persons');
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [sel, setSel] = useState<Sel>(null); // Mahlzeit bearbeiten
  const [picker, setPicker] = useState<Sel>(null); // Menü auswählen
  const [addSlotFor, setAddSlotFor] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const dayMap = useMemo(() => new Map((days ?? []).map((d) => [d.id, d])), [days]);
  const menuMap = useMemo(() => new Map((menus ?? []).map((m) => [m.id, m])), [menus]);

  if (!days || !menus || !persons) return <p className="muted center">Lade …</p>;

  const sortedPersons = [...persons].sort((a, b) => a.sort - b.sort);
  const getDay = (key: string) => dayMap.get(key) ?? blankDay(key);
  const saveDay = (day: PlanDay) => put<PlanDay>('days', day);
  const updateSlot = (dayKey: string, slotId: string, fn: (s: Slot) => Slot | null) => {
    const day = getDay(dayKey);
    const slots = day.slots.map((s) => (s.id === slotId ? fn(s) : s)).filter((s): s is Slot => s !== null);
    return saveDay({ ...day, slots });
  };

  const todayKey = dateKey(new Date());
  const weekDates = WEEKDAYS.map((_, i) => addDays(monday, i));
  const isThisWeek = dateKey(monday) === dateKey(mondayOf(new Date()));

  const selDay = sel ? getDay(sel.dayKey) : null;
  const selSlot = selDay?.slots.find((s) => s.id === sel!.slotId) ?? null;
  const pickDay = picker ? getDay(picker.dayKey) : null;
  const pickSlot = pickDay?.slots.find((s) => s.id === picker!.slotId) ?? null;

  const addDish = (target: NonNullable<Sel>, menuId: string) =>
    updateSlot(target.dayKey, target.slotId, (s) => ({ ...s, dishes: [...s.dishes, { id: newId(), menuId }] }));

  return (
    <section>
      <div className="weeknav">
        <button className="btn step" aria-label="Vorherige Woche" onClick={() => setMonday(addDays(monday, -7))}>
          ‹
        </button>
        <div className="weeknav-title">
          <b>KW {isoWeek(monday)}</b>
          <span className="muted">
            {fmtDay(monday)} – {fmtDay(addDays(monday, 6))}
            {addDays(monday, 6).getFullYear()}
          </span>
        </div>
        <button className="btn step" aria-label="Nächste Woche" onClick={() => setMonday(addDays(monday, 7))}>
          ›
        </button>
      </div>
      <div className="weektools">
        {!isThisWeek && (
          <button className="btn" onClick={() => setMonday(mondayOf(new Date()))}>
            Heute
          </button>
        )}
        <button className="btn" onClick={() => setCopyOpen(true)}>
          Woche kopieren
        </button>
      </div>

      {weekDates.map((d, i) => {
        const key = dateKey(d);
        const day = getDay(key);
        return (
          <div key={key} className={'day' + (key === todayKey ? ' today' : '')}>
            <div className="day-head">
              <b>{WEEKDAYS[i]}</b> <span className="muted">{fmtDay(d)}</span>
              {key === todayKey && <span className="pill pill-today">heute</span>}
            </div>
            {day.slots.map((s) =>
              s.active ? (
                <button
                  key={s.id}
                  className="slot"
                  onClick={() =>
                    s.dishes.length === 0 ? setPicker({ dayKey: key, slotId: s.id }) : setSel({ dayKey: key, slotId: s.id })
                  }
                >
                  <span className="slot-label">{s.label}</span>
                  <span className="slot-body">
                    {s.dishes.length === 0 ? (
                      <span className="slot-empty">+ Menü wählen</span>
                    ) : (
                      s.dishes.map((dish) => (
                        <span key={dish.id} className="slot-dish">
                          {menuMap.get(dish.menuId)?.name ?? <i className="muted">gelöschtes Menü</i>}
                        </span>
                      ))
                    )}
                    <AbsentNote slot={s} persons={sortedPersons} />
                  </span>
                </button>
              ) : (
                <button
                  key={s.id}
                  className="slot slot-off"
                  onClick={() => updateSlot(key, s.id, (x) => ({ ...x, active: true }))}
                >
                  <span className="slot-label">{s.label}</span>
                  <span className="slot-body">entfällt · antippen zum Aktivieren</span>
                </button>
              ),
            )}
            <button className="day-add" onClick={() => setAddSlotFor(key)}>
              + Mahlzeit
            </button>
          </div>
        );
      })}

      {sel && selSlot && (
        <SlotSheet
          title={`${WEEKDAYS[(new Date(sel.dayKey + 'T12:00').getDay() + 6) % 7]} · ${selSlot.label}`}
          slot={selSlot}
          menuMap={menuMap}
          persons={sortedPersons}
          onChange={(fn) => updateSlot(sel.dayKey, sel.slotId, fn)}
          onAddDish={() => setPicker(sel)}
          onClose={() => setSel(null)}
        />
      )}

      {picker && pickSlot && (
        <MenuPicker
          slot={pickSlot}
          menus={menus}
          persons={persons}
          onPick={async (menuId) => {
            await addDish(picker, menuId);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {addSlotFor && (
        <AddSlotSheet
          onAdd={(label) => {
            const day = getDay(addSlotFor);
            const slot: Slot = { id: newId(), kind: 'extra', label, active: true, dishes: [], absent: [] };
            const slots = [...day.slots];
            const after: Record<string, MealType> = { znüni: 'fruehstueck', zvieri: 'mittag' };
            const anchor = after[label.trim().toLowerCase()];
            const idx = anchor ? slots.findIndex((s) => s.kind === anchor) : -1;
            if (idx >= 0) slots.splice(idx + 1, 0, slot);
            else slots.push(slot);
            saveDay({ ...day, slots });
            setAddSlotFor(null);
          }}
          onClose={() => setAddSlotFor(null)}
        />
      )}

      {copyOpen && (
        <CopyWeekSheet
          monday={monday}
          hasPlan={(m) => WEEKDAYS.some((_, i) => dayMap.get(dateKey(addDays(m, i)))?.slots.some((s) => s.dishes.length))}
          onCopy={async (target) => {
            for (let i = 0; i < 7; i++) {
              const src = getDay(dateKey(addDays(monday, i)));
              const key = dateKey(addDays(target, i));
              const existing = dayMap.get(key);
              await saveDay({
                id: key,
                updatedAt: 0,
                deleted: false,
                ...(existing ? { updatedAt: existing.updatedAt } : {}),
                slots: src.slots.map((s) => ({
                  ...s,
                  id: newId(),
                  dishes: s.dishes.map((d) => ({ ...d, id: newId() })),
                  absent: [...s.absent],
                })),
              });
            }
            setCopyOpen(false);
            setMonday(target);
          }}
          onClose={() => setCopyOpen(false)}
        />
      )}
    </section>
  );
}

function AbsentNote({ slot, persons }: { slot: Slot; persons: Person[] }) {
  const names = persons.filter((p) => slot.absent.includes(p.id)).map((p) => p.name);
  if (!names.length) return null;
  return <span className="slot-absent">ohne {names.join(', ')}</span>;
}

function SlotSheet({
  title,
  slot,
  menuMap,
  persons,
  onChange,
  onAddDish,
  onClose,
}: {
  title: string;
  slot: Slot;
  menuMap: Map<string, Menu>;
  persons: Person[];
  onChange: (fn: (s: Slot) => Slot | null) => void;
  onAddDish: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(slot.label);
  const toggle = (pid: string) =>
    onChange((s) => ({ ...s, absent: s.absent.includes(pid) ? s.absent.filter((x) => x !== pid) : [...s.absent, pid] }));
  const eaters = persons.filter((p) => !slot.absent.includes(p.id));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>

        {slot.kind === 'extra' && (
          <label className="field">
            <span>Name der Mahlzeit</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label.trim() && onChange((s) => ({ ...s, label: label.trim() }))}
            />
          </label>
        )}

        <div className="field">
          <span>Gerichte</span>
          <ul className="list">
            {slot.dishes.map((d) => (
              <li key={d.id} className="dish-row">
                <span>{menuMap.get(d.menuId)?.name ?? 'gelöschtes Menü'}</span>
                <button
                  className="icon-btn"
                  aria-label="Gericht entfernen"
                  onClick={() => onChange((s) => ({ ...s, dishes: s.dishes.filter((x) => x.id !== d.id) }))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-block" onClick={onAddDish}>
            + Gericht hinzufügen
          </button>
        </div>

        <div className="field">
          <span>
            Wer isst mit? <span className="muted">({eaters.length} von {persons.length})</span>
          </span>
          <div className="chips">
            {persons.map((p) => (
              <button key={p.id} className={'chip' + (slot.absent.includes(p.id) ? '' : ' on')} onClick={() => toggle(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn btn-primary btn-block" onClick={onClose}>
            Fertig
          </button>
          {slot.kind === 'extra' ? (
            <button
              className="btn btn-block btn-ghost-danger"
              onClick={() => {
                onChange(() => null);
                onClose();
              }}
            >
              Mahlzeit löschen
            </button>
          ) : (
            <button
              className="btn btn-block btn-ghost-danger"
              onClick={() => {
                onChange((s) => ({ ...s, active: false }));
                onClose();
              }}
            >
              Mahlzeit entfällt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuPicker({
  slot,
  menus,
  persons,
  onPick,
  onClose,
}: {
  slot: Slot;
  menus: Menu[];
  persons: Person[];
  onPick: (menuId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState<Menu | null>(null);
  const kind = slot.kind === 'extra' ? null : slot.kind;
  const filtered = menus
    .filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
  const matching = kind ? filtered.filter((m) => m.mealTypes.includes(kind)) : filtered;
  const others = kind ? filtered.filter((m) => !m.mealTypes.includes(kind)) : [];
  const kindLabel = MEAL_TYPES.find((t) => t.id === kind)?.label;

  if (creating)
    return (
      <MenuEditor
        menu={creating}
        isNew
        persons={persons}
        familyFactor={familyFactorOf(persons)}
        onClose={() => setCreating(null)}
        onSaved={(m) => onPick(m.id)}
      />
    );

  const item = (m: Menu) => (
    <li key={m.id}>
      <button className="row" onClick={() => onPick(m.id)}>
        <span className="row-main">{m.name}</span>
      </button>
    </li>
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Menü für {slot.label}</h2>
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen …" />
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            const m = emptyMenu(familyFactorOf(persons), kind ? [kind] : []);
            m.name = q.trim();
            setCreating(m);
          }}
        >
          + Neues Menü erstellen
        </button>
        {menus.length === 0 && <p className="muted">Noch keine Menüs erfasst.</p>}
        {matching.length > 0 && (
          <>
            {kind && <h3 className="sec">Passend für {kindLabel}</h3>}
            <ul className="list">{matching.map(item)}</ul>
          </>
        )}
        {others.length > 0 && (
          <>
            <h3 className="sec">Andere Menüs</h3>
            <ul className="list">{others.map(item)}</ul>
          </>
        )}
        <button className="btn btn-block" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function AddSlotSheet({ onAdd, onClose }: { onAdd: (label: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState('');
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Mahlzeit hinzufügen</h2>
        <div className="chips" style={{ marginBottom: 16 }}>
          {['Znüni', 'Zvieri', 'Dessert'].map((n) => (
            <button key={n} className="chip" onClick={() => onAdd(n)}>
              {n}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Oder eigener Name</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Apéro" />
        </label>
        <div className="sheet-actions">
          <button className="btn btn-primary btn-block" disabled={!label.trim()} onClick={() => onAdd(label.trim())}>
            Hinzufügen
          </button>
          <button className="btn btn-block" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyWeekSheet({
  monday,
  hasPlan,
  onCopy,
  onClose,
}: {
  monday: Date;
  hasPlan: (m: Date) => boolean | undefined;
  onCopy: (target: Date) => void;
  onClose: () => void;
}) {
  const options = [1, 2, 3, 4].map((n) => addDays(monday, 7 * n));
  const [target, setTarget] = useState(options[0]);
  const overwrite = hasPlan(target);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>KW {isoWeek(monday)} kopieren nach …</h2>
        <div className="chips" style={{ marginBottom: 12 }}>
          {options.map((o) => (
            <button
              key={dateKey(o)}
              className={'chip' + (dateKey(o) === dateKey(target) ? ' on' : '')}
              onClick={() => setTarget(o)}
            >
              KW {isoWeek(o)} ({fmtDay(o)})
            </button>
          ))}
        </div>
        {overwrite && <p className="warn">KW {isoWeek(target)} hat schon Einträge. Sie werden überschrieben.</p>}
        <div className="sheet-actions">
          <button className={'btn btn-block ' + (overwrite ? 'btn-danger' : 'btn-primary')} onClick={() => onCopy(target)}>
            {overwrite ? 'Überschreiben und kopieren' : 'Kopieren'}
          </button>
          <button className="btn btn-block" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
