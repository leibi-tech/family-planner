// Einkaufsliste: Berechnung aus dem Wochenplan (Schritt 4).
// Die Liste selbst wird nicht gespeichert, sondern jedes Mal frisch aus dem Plan berechnet.
// Gespeichert werden nur deine Entscheide (zu Hause vorhanden, abgehakt) – pro Woche und pro Artikel.
import type { BaseRecord, Person } from './db';
import { WEEKDAYS, addDays, dateKey, defaultSlots, type Category, type Menu, type PlanDay } from './model';

export interface Source {
  day: string; // «Mo»
  slot: string; // «Mittagessen»
  menu: string; // «Spaghetti»
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
}

export const shopWeekId = (monday: Date) => 'woche-' + dateKey(monday);

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

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
): ShopItem[] {
  const acc = new Map<string, ShopItem & { raw: number }>();

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
        const source: Source = { day: WEEKDAYS[i].slice(0, 2), slot: slot.label, menu: menu.name };
        for (const ing of menu.ingredients) {
          const k = norm(ing.product) + '|' + ing.unit;
          let item = acc.get(k);
          if (!item) {
            const name = ing.product.trim();
            item = { key: k, product: name.charAt(0).toUpperCase() + name.slice(1), unit: ing.unit, qty: null, raw: 0, category: ing.category, sources: [] };
            acc.set(k, item);
          }
          if (ing.amount != null && menu.basis.baseFactor > 0) {
            item.raw += (ing.amount / menu.basis.baseFactor) * factor;
          }
          if (ing.category === 'lebensmittel') item.category = 'lebensmittel';
          const last = item.sources[item.sources.length - 1];
          if (!last || last.day !== source.day || last.slot !== source.slot || last.menu !== source.menu) {
            item.sources.push(source);
          }
        }
      }
    }
  }

  return [...acc.values()].map(({ raw, ...item }) => ({
    ...item,
    qty: raw > 0 ? roundQty(raw, item.unit) : null,
  }));
}

export function fmtQty(item: ShopItem): string {
  if (item.qty == null) return 'nach Bedarf';
  return `${item.qty} ${item.unit}`;
}

/** Herkunft kompakt: «Spaghetti: Mo Mittagessen, Do Abendessen · Salat: Mo Abendessen» */
export function fmtSources(sources: Source[]): string {
  const byMenu = new Map<string, string[]>();
  for (const src of sources) {
    const list = byMenu.get(src.menu) ?? [];
    list.push(`${src.day} ${src.slot}`);
    byMenu.set(src.menu, list);
  }
  return [...byMenu].map(([menu, when]) => `${menu}: ${when.join(', ')}`).join(' · ');
}
