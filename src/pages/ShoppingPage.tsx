import { useMemo, useState } from 'react';
import { put, type Person } from '../db';
import { useRecords } from '../hooks';
import { CATEGORIES, addDays, fmtDay, isoWeek, mondayOf, type Menu, type PlanDay } from '../model';
import { buildShoppingList, fmtQty, fmtSources, shopWeekId, type ShopItem, type ShopWeek } from '../shopping';

export function ShoppingPage() {
  const days = useRecords<PlanDay>('days');
  const menus = useRecords<Menu>('menus');
  const persons = useRecords<Person>('persons');
  const weeks = useRecords<ShopWeek>('shopping');
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [showHome, setShowHome] = useState(false);

  const items = useMemo(() => {
    if (!days || !menus || !persons) return [];
    return buildShoppingList(
      monday,
      new Map(days.map((d) => [d.id, d])),
      new Map(menus.map((m) => [m.id, m])),
      persons,
    );
  }, [days, menus, persons, monday]);

  if (!days || !menus || !persons || !weeks) return <p className="muted center">Lade …</p>;

  const wid = shopWeekId(monday);
  const week: ShopWeek = weeks.find((w) => w.id === wid) ?? { id: wid, removed: [], checked: [], updatedAt: 0, deleted: false };
  const save = (patch: Partial<ShopWeek>) => put<ShopWeek>('shopping', { ...week, ...patch });
  const toggleIn = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const atHome = items.filter((i) => week.removed.includes(i.key));
  const toBuy = items.filter((i) => !week.removed.includes(i.key));
  const checkedCount = toBuy.filter((i) => week.checked.includes(i.key)).length;
  const isThisWeek = shopWeekId(mondayOf(new Date())) === wid;

  const byName = (a: ShopItem, b: ShopItem) => a.product.localeCompare(b.product, 'de-CH');

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

      {items.length === 0 ? (
        <p className="hint center">Für diese Woche ist noch nichts geplant. Die Liste füllt sich automatisch aus dem Wochenplan.</p>
      ) : (
        <>
          <div className="total">
            <b>{toBuy.length}</b> Artikel · {checkedCount} abgehakt
            {atHome.length > 0 && <> · {atHome.length} zu Hause</>}
          </div>
          <p className="hint small-hint">
            Antippen = im Laden abhaken · 🏠 = habe ich schon zu Hause (Vorrats-Check)
          </p>

          {CATEGORIES.map((cat) => {
            const list = toBuy.filter((i) => i.category === cat.id);
            if (!list.length) return null;
            const open = list.filter((i) => !week.checked.includes(i.key)).sort(byName);
            const done = list.filter((i) => week.checked.includes(i.key)).sort(byName);
            return (
              <div key={cat.id} className="shop-cat">
                <h3 className="sec">
                  {cat.label} <span className="muted">({list.length})</span>
                </h3>
                <ul className="shop-list">
                  {[...open, ...done].map((item) => {
                    const checked = week.checked.includes(item.key);
                    return (
                      <li key={item.key} className={'shop-item' + (checked ? ' checked' : '')}>
                        <button className="shop-main" onClick={() => save({ checked: toggleIn(week.checked, item.key) })}>
                          <span className="box" aria-hidden>
                            {checked ? '✓' : ''}
                          </span>
                          <span className="shop-text">
                            <span className="shop-name">
                              <b>{item.product}</b> <span className="shop-qty">{fmtQty(item)}</span>
                            </span>
                            <span className="shop-src">{fmtSources(item.sources)}</span>
                          </span>
                        </button>
                        {!checked && (
                          <button
                            className="icon-btn home-btn"
                            aria-label="Zu Hause vorhanden"
                            onClick={() => save({ removed: toggleIn(week.removed, item.key) })}
                          >
                            🏠
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

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
    </section>
  );
}
