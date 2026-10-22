import { useEffect, useMemo, useState } from 'react';
import { newId, put, remove, type Person } from '../db';
import { useRecords } from '../hooks';
import {
  CATEGORIES,
  UNITS,
  addDays,
  dateKey,
  fmtDay,
  isoWeek,
  mondayOf,
  parseAmount,
  type Category,
  type Menu,
  type PlanDay,
} from '../model';
import {
  buildShoppingList,
  roundQty,
  fmtQty,
  fmtSources,
  intervalLabel,
  isDue,
  itemKey,
  norm,
  shopWeekId,
  type Extra,
  type ManualItem,
  type RecurringItem,
  type ShopItem,
  type ShopWeek,
  type Suggestion,
} from '../shopping';

export function ShoppingPage() {
  const days = useRecords<PlanDay>('days');
  const menus = useRecords<Menu>('menus');
  const persons = useRecords<Person>('persons');
  const weeks = useRecords<ShopWeek>('shopping');
  const manual = useRecords<ManualItem>('manual');
  const recurring = useRecords<RecurringItem>('recurring');
  const suggestions = useRecords<Suggestion>('suggest');
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [showHome, setShowHome] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [cat, setCatState] = useState<Category>(() => {
    try {
      return localStorage.getItem('fp-shop-cat') === 'anderes' ? 'anderes' : 'lebensmittel';
    } catch {
      return 'lebensmittel';
    }
  });
  const setCat = (c: Category) => {
    setCatState(c);
    try {
      localStorage.setItem('fp-shop-cat', c);
    } catch {}
  };

  const wid = shopWeekId(monday);
  const weekManual = useMemo(() => (manual ?? []).filter((m) => m.week === wid), [manual, wid]);

  const items = useMemo(() => {
    if (!days || !menus || !persons || !recurring) return [];
    const extras: Extra[] = [
      ...weekManual.map((m) => ({ ...m, source: { day: '', slot: '', menu: 'von Hand', kind: 'manual' as const } })),
      ...recurring
        .filter((r) => isDue(r, monday))
        .map((r) => ({ ...r, source: { day: '', slot: '', menu: intervalLabel(r.intervalWeeks), kind: 'recurring' as const } })),
    ];
    return buildShoppingList(
      monday,
      new Map(days.map((d) => [d.id, d])),
      new Map(menus.map((m) => [m.id, m])),
      persons,
      extras,
    );
  }, [days, menus, persons, recurring, weekManual, monday]);

  if (!days || !menus || !persons || !weeks || !manual || !recurring || !suggestions)
    return <p className="muted center">Lade …</p>;

  const week: ShopWeek = weeks.find((w) => w.id === wid) ?? {
    id: wid,
    removed: [],
    checked: [],
    hidden: [],
    updatedAt: 0,
    deleted: false,
  };
  const hidden = week.hidden ?? [];
  const save = (patch: Partial<ShopWeek>) => put<ShopWeek>('shopping', { ...week, ...patch });
  const toggleIn = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  // Nachkauf: Wurde ein Artikel schon gekauft (abgehakt/ausgeblendet) und braucht es inzwischen mehr,
  // erscheint nur die zusätzliche Menge wieder als offener Artikel.
  const bought = week.bought ?? {};
  type Row = ShopItem & { extra?: number | null; fullQty?: number | null };
  const rows: Row[] = items.map((i) => {
    const b = bought[i.key];
    const wasDone = week.checked.includes(i.key) || hidden.includes(i.key);
    if (wasDone && i.qty != null && b != null && i.qty > b + 1e-9)
      return { ...i, qty: roundQty(i.qty - b, i.unit), extra: b, fullQty: i.qty };
    return { ...i, fullQty: i.qty };
  });
  const isChecked = (i: Row) => week.checked.includes(i.key) && i.extra === undefined;
  const isHidden = (i: Row) => hidden.includes(i.key) && i.extra === undefined;

  const toggleCheck = (i: Row) => {
    const nb = { ...bought };
    if (isChecked(i)) {
      delete nb[i.key];
      return save({ checked: week.checked.filter((k) => k !== i.key), bought: nb });
    }
    nb[i.key] = i.fullQty ?? null;
    return save({
      checked: week.checked.includes(i.key) ? week.checked : [...week.checked, i.key],
      hidden: hidden.filter((h) => h !== i.key),
      bought: nb,
    });
  };

  const allVisible = rows.filter((i) => !isHidden(i));
  const openCount = (c: Category) =>
    allVisible.filter((i) => i.category === c && !week.removed.includes(i.key) && !isChecked(i)).length;
  const visible = allVisible.filter((i) => i.category === cat);
  const atHome = visible.filter((i) => week.removed.includes(i.key));
  const toBuy = visible.filter((i) => !week.removed.includes(i.key));
  const done = toBuy.filter((i) => isChecked(i));
  const isThisWeek = shopWeekId(mondayOf(new Date())) === wid;
  const manualOnly = (i: ShopItem) => i.sources.every((s) => s.kind === 'manual');

  const byName = (a: ShopItem, b: ShopItem) => a.product.localeCompare(b.product, 'de-CH');

  const deleteManual = async (key: string) => {
    for (const m of weekManual.filter((m) => itemKey(m.product, m.unit) === key)) await remove<ManualItem>('manual', m);
  };

  const hideDone = async () => {
    const keys = done.map((i) => i.key);
    for (const k of keys) await deleteManual(k);
    await save({ hidden: [...hidden, ...keys], checked: week.checked.filter((k) => !keys.includes(k)) });
  };

  const addItem = async (x: { product: string; qty: number | null; unit: string; category: Category; interval: number }) => {
    const base = { product: x.product, qty: x.qty, unit: x.unit, category: x.category, updatedAt: 0, deleted: false };
    if (x.interval > 0) {
      await put<RecurringItem>('recurring', { ...base, id: newId(), intervalWeeks: x.interval, startWeek: dateKey(monday) });
    } else {
      await put<ManualItem>('manual', { ...base, id: newId(), week: wid });
    }
    // War der Artikel als «zu Hause» markiert: wieder auf die Liste.
    // (Schon gekaufte Artikel erscheinen automatisch mit der zusätzlichen Menge.)
    const k = itemKey(x.product, x.unit);
    const isDone = week.checked.includes(k) || hidden.includes(k);
    if (week.removed.includes(k) || (isDone && (x.qty == null || bought[k] == null))) {
      await save({
        removed: week.removed.filter((h) => h !== k),
        ...(isDone && (x.qty == null || bought[k] == null)
          ? { hidden: hidden.filter((h) => h !== k), checked: week.checked.filter((h) => h !== k) }
          : {}),
      });
    }
    // Vorschlag merken
    const sid = norm(x.product);
    const old = suggestions.find((s) => s.id === sid);
    await put<Suggestion>('suggest', { ...base, id: sid, uses: (old?.uses ?? 0) + 1 });
  };

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
      {!isThisWeek && (
        <div className="weektools">
          <button className="btn" onClick={() => setMonday(mondayOf(new Date()))}>
            Diese Woche
          </button>
        </div>
      )}

      <div className="seg cat-tabs">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
            {c.label} <span className="tab-count">{openCount(c.id)}</span>
          </button>
        ))}
      </div>

      <AddItem suggestions={suggestions} defaultCategory={cat} onAdd={addItem} />

      {visible.length === 0 ? (
        <p className="hint center">
          {allVisible.length === 0
            ? 'Für diese Woche ist die Liste leer. Sie füllt sich automatisch aus dem Wochenplan, oder du erfasst oben Artikel von Hand.'
            : `Unter «${CATEGORIES.find((c) => c.id === cat)!.label}» ist diese Woche nichts zu kaufen.`}
        </p>
      ) : (
        <>
          <div className="total">
            <b>{toBuy.length}</b> Artikel · {done.length} abgehakt
            {atHome.length > 0 && <> · {atHome.length} zu Hause</>}
          </div>
          <p className="hint small-hint">Antippen = im Laden abhaken · 🏠 = habe ich schon zu Hause (Vorrats-Check)</p>

          {CATEGORIES.filter((c) => c.id === cat).map((cat) => {
            const list = toBuy.filter((i) => i.category === cat.id);
            if (!list.length) return null;
            const open = list.filter((i) => !isChecked(i)).sort(byName);
            const checkedList = list.filter((i) => isChecked(i)).sort(byName);
            return (
              <div key={cat.id} className="shop-cat">
                <h3 className="sec">
                  {cat.label} <span className="muted">({list.length})</span>
                </h3>
                <ul className="shop-list">
                  {[...open, ...checkedList].map((item) => {
                    const checked = isChecked(item);
                    return (
                      <li key={item.key} className={'shop-item' + (checked ? ' checked' : '') + (item.extra !== undefined ? ' extra' : '')}>
                        <button className="shop-main" onClick={() => toggleCheck(item)}>
                          <span className="box" aria-hidden>
                            {checked ? '✓' : ''}
                          </span>
                          <span className="shop-text">
                            <span className="shop-name">
                              <b>{item.product}</b>{' '}
                              <span className="shop-qty">
                                {item.extra !== undefined ? '+ ' : ''}
                                {fmtQty(item)}
                              </span>
                            </span>
                            {item.extra !== undefined && (
                              <span className="shop-more">
                                Nachkauf · {fmtQty({ qty: item.extra, unit: item.unit })} schon gekauft
                              </span>
                            )}
                            <span className="shop-src">{fmtSources(item.sources)}</span>
                          </span>
                        </button>
                        {!checked &&
                          (manualOnly(item) ? (
                            <button className="icon-btn home-btn" aria-label="Artikel löschen" onClick={() => deleteManual(item.key)}>
                              ✕
                            </button>
                          ) : (
                            <button
                              className="icon-btn home-btn"
                              aria-label="Zu Hause vorhanden"
                              onClick={() => save({ removed: toggleIn(week.removed, item.key) })}
                            >
                              🏠
                            </button>
                          ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {done.length > 0 && (
            <button className="btn btn-block" onClick={hideDone}>
              Erledigte ausblenden ({done.length})
            </button>
          )}

          {atHome.length > 0 && (
            <div className="shop-cat">
              <button className="sec-toggle" onClick={() => setShowHome(!showHome)}>
                {showHome ? '▾' : '▸'} Zu Hause vorhanden ({atHome.length})
              </button>
              {showHome && (
                <ul className="shop-list">
                  {atHome.sort(byName).map((item) => (
                    <li key={item.key} className="shop-item home">
                      <span className="shop-text">
                        <span className="shop-name">
                          <b>{item.product}</b> <span className="shop-qty">{fmtQty(item)}</span>
                        </span>
                      </span>
                      <button className="btn undo-btn" onClick={() => save({ removed: toggleIn(week.removed, item.key) })}>
                        ↩ Doch kaufen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {rows.some(isHidden) && (
        <button className="sec-toggle" onClick={() => save({ hidden: [] })}>
          ↩ Ausgeblendete wieder anzeigen ({rows.filter(isHidden).length})
        </button>
      )}

      {recurring.length > 0 && (
        <div className="shop-cat">
          <button className="sec-toggle" onClick={() => setShowRecurring(!showRecurring)}>
            {showRecurring ? '▾' : '▸'} Wiederkehrende Artikel ({recurring.length})
          </button>
          {showRecurring && (
            <ul className="shop-list">
              {[...recurring]
                .sort((a, b) => a.product.localeCompare(b.product, 'de-CH'))
                .map((r) => (
                  <li key={r.id} className="shop-item home">
                    <span className="shop-text">
                      <span className="shop-name">
                        <b>{r.product}</b> <span className="shop-qty">{fmtQty(r)}</span>
                      </span>
                      <span className="shop-src">
                        {intervalLabel(r.intervalWeeks)} · ab KW {isoWeek(new Date(r.startWeek + 'T12:00'))}
                      </span>
                    </span>
                    <button
                      className="icon-btn home-btn"
                      aria-label="Wiederkehrenden Artikel löschen"
                      onClick={() => remove<RecurringItem>('recurring', r)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

const INTERVALS = [
  { n: 0, label: 'Einmalig' },
  { n: 1, label: 'Jede Woche' },
  { n: 2, label: 'Alle 2 Wochen' },
  { n: 3, label: 'Alle 3 Wochen' },
  { n: 4, label: 'Alle 4 Wochen' },
];

function AddItem({
  suggestions,
  defaultCategory,
  onAdd,
}: {
  suggestions: Suggestion[];
  defaultCategory: Category;
  onAdd: (x: { product: string; qty: number | null; unit: string; category: Category; interval: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<Category>(defaultCategory);
  useEffect(() => setCategory(defaultCategory), [defaultCategory]);
  const [interval, setIntervalWeeks] = useState(0);
  const [focus, setFocus] = useState(false);

  const q = norm(product);
  const matches = q
    ? suggestions
        .filter((s) => s.id.includes(q) && s.id !== q)
        .sort((a, b) => Number(!a.id.startsWith(q)) - Number(!b.id.startsWith(q)) || b.uses - a.uses)
        .slice(0, 6)
    : [];

  const pick = (s: Suggestion) => {
    setProduct(s.product);
    setQtyText(s.qty != null ? String(s.qty) : '');
    setUnit(s.unit);
    setCategory(s.category);
  };

  const reset = () => {
    setProduct('');
    setQtyText('');
    setUnit('');
    setCategory(defaultCategory);
    setIntervalWeeks(0);
  };

  const submit = async () => {
    if (!product.trim()) return;
    await onAdd({ product: product.trim(), qty: parseAmount(qtyText), unit, category, interval });
    reset();
    document.getElementById('add-product')?.focus();
  };

  if (!open)
    return (
      <button className="btn btn-primary btn-block add-open" onClick={() => setOpen(true)}>
        + Artikel erfassen
      </button>
    );

  return (
    <div className="add-box">
      <div className="suggest-wrap">
        <input
          id="add-product"
          className="search"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(document.activeElement?.id === 'add-product'), 150)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Artikel, z.B. Milch"
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
        />
        {focus && matches.length > 0 && (
          <ul className="suggest">
            {matches.map((s) => (
              <li key={s.id}>
                <button className="suggest-pick" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                  {s.product}
                  {s.qty != null && <span className="muted"> · {fmtQty(s)}</span>}
                </button>
                <button
                  className="suggest-del"
                  aria-label={`Vorschlag ${s.product} löschen`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => remove<Suggestion>('suggest', s)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ing-bottom">
        <input
          className="amount"
          inputMode="decimal"
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
          placeholder="Menge"
          aria-label="Menge"
        />
        <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Einheit">
          <option value="">–</option>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <button
          className={'chip small' + (category === 'anderes' ? ' on-alt' : '')}
          onClick={() => setCategory(category === 'lebensmittel' ? 'anderes' : 'lebensmittel')}
        >
          {CATEGORIES.find((c) => c.id === category)!.label}
        </button>
      </div>
      <select className="select interval" value={interval} onChange={(e) => setIntervalWeeks(Number(e.target.value))} aria-label="Wiederholung">
        {INTERVALS.map((i) => (
          <option key={i.n} value={i.n}>
            {i.label}
          </option>
        ))}
      </select>
      <div className="add-actions">
        <button className="btn btn-primary" disabled={!product.trim()} onClick={submit}>
          Hinzufügen
        </button>
        <button
          className="btn"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Schliessen
        </button>
      </div>
    </div>
  );
}
