// Einkaufsliste: Berechnung aus dem Wochenplan (Schritt 4).
// Die Liste selbst wird nicht gespeichert, sondern jedes Mal frisch aus dem Plan berechnet.
// Gespeichert werden nur deine Entscheide (zu Hause vorhanden, abgehakt) – pro Woche und pro Artikel.
import type { BaseRecord, Person } from './db';
import { WEEKDAYS, addDays, dateKey, defaultSlots, type Category, type Menu, type PlanDay } from './model';

export interface Source {
  day: string; // «Mo» (leer bei manuellen/wiederkehrenden Artikeln)
  slot: string; // «Mittagessen»
  menu: string; // «Spaghetti» bzw. «von Hand» / «jede Woche»
  kind?: 'plan' | 'manual' | 'recurring';
}

export interface ShopItem {
  key: string; // produkt|einheit (klein geschrieben)
  product: string;
  unit: string;
  qty: number | null; // gerundet; null = nur «nach Bedarf»
  category: Category;
  sources: Source[];
}

/** Gespeicherte Entscheide für eine Woche. id = «woche-JJJJ-MM-TT» (Montag). */
export interface ShopWeek extends BaseRecord {
  removed: string[]; // Vorrats-Check: zu Hause vorhanden
  checked: string[]; // im Laden abgehakt
  hidden?: string[]; // erledigt und ausgeblendet
}

/** Von Hand erfasster Artikel, gilt für eine Woche. */
export interface ManualItem extends BaseRecord {
  week: string; // shopWeekId
  product: string;
  qty: number | null;
  unit: string; // '' = ohne Einheit
  category: Category;
}

/** Wiederkehrender Artikel, z.B. jede Woche 12 Joghurts. */
export interface RecurringItem extends BaseRecord {
  product: string;
  qty: number | null;
  unit: string;
  category: Category;
  intervalWeeks: number; // 1 = jede Woche
  startWeek: string; // Montag «JJJJ-MM-TT», ab dem er gilt
}

/** Vorschlag beim Tippen (aus früheren Einträgen). id = Produktname klein geschrieben. */
export interface Suggestion extends BaseRecord {
  product: string;
  qty: number | null;
  unit: string;
  category: Category;
  uses: number;
}

export const intervalLabel = (n: number) => (n === 1 ? 'jede Woche' : `alle ${n} Wochen`);

/** Ist ein wiederkehrender Artikel in dieser Woche fällig? */
export function isDue(r: RecurringItem, monday: Date): boolean {
  const [y, m, d] = r.startWeek.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const weeks = Math.round((monday.getTime() - start.getTime()) / (7 * 86400000));
  return weeks >= 0 && weeks % Math.max(1, r.intervalWeeks) === 0;
}

export interface Extra {
  product: string;
  qty: number | null;
  unit: string;
  category: Category;
  source: Source;
}

export const shopWeekId = (monday: Date) => 'woche-' + dateKey(monday);

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Sinnvoll aufrunden je nach Einheit. */
export function roundQty(qty: number, unit: string): number {
  const up = (x: number, step: number) => Math.ceil(x / step - 1e-9) * step;
  let r: number;
  switch (unit) {
    case 'g':
    case 'ml':
      r = qty < 10 ? up(qty, 1) : up(qty, 10);
      break;
    case 'kg':
    case 'l':
      r = up(qty, 0.1);
      break;
    case 'EL':
    case 'TL':
      r = up(qty, 0.5);
      break;
    default: // Stk., Pck., Dose, Bund, Prise und eigene Einheiten
      r = up(qty, 1);
  }
  return Math.round(r * 100) / 100;
}

export function buildShoppingList(
  monday: Date,
  dayMap: Map<string, PlanDay>,
  menuMap: Map<string, Menu>,
  persons: Person[],
  extras: Extra[] = [],
): ShopItem[] {
  const acc = new Map<string, ShopItem & { raw: number }>();
  const getItem = (product: string, unit: string, category: Category) => {
    const k = itemKey(product, unit);
    let item = acc.get(k);
    if (!item) {
      const name = product.trim();
      item = { key: k, product: name.charAt(0).toUpperCase() + name.slice(1), unit, qty: null, raw: 0, category, sources: [] };
      acc.set(k, item);
    }
    if (category === 'lebensmittel') item.category = 'lebensmittel';
    return item;
  };

  for (let i = 0; i < 7; i++) {
    const key = dateKey(addDays(monday, i));
    const day = dayMap.get(key);
    const slots = day ? day.slots : defaultSlots(key);
    for (const slot of slots) {
      if (!slot.active) continue;
      const eaters = persons.filter((p) => !slot.absent.includes(p.id));
      const factor = eaters.reduce((s, p) => s + p.factor, 0);
      if (factor <= 0) continue;
      for (const dish of slot.dishes) {
        const menu = menuMap.get(dish.menuId);
        if (!menu) continue;
        const source: Source = { day: WEEKDAYS[i].slice(0, 2), slot: slot.label, menu: menu.name, kind: 'plan' };
        for (const ing of menu.ingredients) {
          const item = getItem(ing.product, ing.unit, ing.category);
          if (ing.amount != null && menu.basis.baseFactor > 0) {
            item.raw += (ing.amount / menu.basis.baseFactor) * factor;
          }
          const last = item.sources[item.sources.length - 1];
          if (!last || last.day !== source.day || last.slot !== source.slot || last.menu !== source.menu) {
            item.sources.push(source);
          }
        }
      }
    }
  }

  for (const x of extras) {
    if (!x.product.trim()) continue;
    const item = getItem(x.product, x.unit, x.category);
    if (x.qty != null) item.raw += x.qty;
    item.sources.push(x.source);
  }

  return [...acc.values()].map(({ raw, ...item }) => ({
    ...item,
    qty: raw > 0 ? roundQty(raw, item.unit) : null,
  }));
}

export const itemKey = (product: string, unit: string) => norm(product) + '|' + unit;

export function fmtQty(item: { qty: number | null; unit: string; sources?: Source[] }): string {
  if (item.qty == null) return item.sources?.some((s) => !s.kind || s.kind === 'plan') ? 'nach Bedarf' : '';
  return `${item.qty}${item.unit ? ' ' + item.unit : ''}`;
}

/** Herkunft kompakt: «Spaghetti: Mo Mittagessen, Do Abendessen · Salat: Mo Abendessen» */
export function fmtSources(sources: Source[]): string {
  const byMenu = new Map<string, string[]>();
  const other: string[] = [];
  for (const src of sources) {
    if (src.kind === 'manual' || src.kind === 'recurring') {
      if (!other.includes(src.menu)) other.push(src.menu);
      continue;
    }
    const list = byMenu.get(src.menu) ?? [];
    list.push(`${src.day} ${src.slot}`);
    byMenu.set(src.menu, list);
  }
  return [...[...byMenu].map(([menu, when]) => `${menu}: ${when.join(', ')}`), ...other].join(' · ');
}
