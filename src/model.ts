// Gemeinsame Typen und Listen für Menüs (und später Wochenplan/Einkauf).
import type { BaseRecord } from './db';

export type MealType = 'fruehstueck' | 'mittag' | 'abend';
export const MEAL_TYPES: Array<{ id: MealType; label: string; short: string }> = [
  { id: 'fruehstueck', label: 'Frühstück', short: 'Früh' },
  { id: 'mittag', label: 'Mittagessen', short: 'Mittag' },
  { id: 'abend', label: 'Abendessen', short: 'Abend' },
];

export const UNITS = ['g', 'kg', 'ml', 'l', 'Stk.', 'Pck.', 'Dose', 'Bund', 'EL', 'TL', 'Prise'] as const;

export type Category = 'lebensmittel' | 'anderes';
export const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'lebensmittel', label: 'Lebensmittel' },
  { id: 'anderes', label: 'Anderes' },
];

export interface Ingredient {
  id: string;
  product: string;
  amount: number | null; // wie eingegeben; leer = «nach Bedarf»
  unit: string;
  category: Category;
}

/** Wofür gelten die eingegebenen Mengen? baseFactor = Faktor, auf den sich die Mengen beziehen. */
export type Basis =
  | { kind: 'family'; baseFactor: number } // Summe der Faktoren beim Erstellen
  | { kind: 'person'; baseFactor: number; personId: string; personName: string }
  | { kind: 'portions'; baseFactor: number; portions: number }; // importiertes Rezept: n Portionen à Faktor 1.0

export interface Menu extends BaseRecord {
  name: string;
  mealTypes: MealType[];
  basis: Basis;
  ingredients: Ingredient[];
  note: string;
}

/** Menge pro Faktor 1.0 (Grundlage für die spätere Einkaufsliste). */
export function amountPerFactorOne(menu: Menu, ing: Ingredient): number | null {
  if (ing.amount == null || !menu.basis.baseFactor) return null;
  return ing.amount / menu.basis.baseFactor;
}

/** Zahl aus Eingabefeld lesen (Komma oder Punkt). Leer/ungültig = null. */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function fmtAmount(n: number | null): string {
  if (n == null) return '';
  return String(Math.round(n * 100) / 100);
}

/** scale = eigener Faktor, damit Faktoren «aus eigener Sicht» angezeigt werden (ich = 1.0). */
export function basisLabel(b: Basis, scale = 1): string {
  const f = (b.baseFactor / scale).toFixed(2).replace(/(\.\d)0$/, '$1');
  if (b.kind === 'portions') return `${b.portions} ${b.portions === 1 ? 'Portion' : 'Portionen'} (Faktor ${f})`;
  return b.kind === 'family' ? `ganze Familie (Faktor ${f})` : `1 Portion von ${b.personName} (Faktor ${f})`;
}

// ---------------- Wochenplan (Schritt 3) ----------------

export type SlotKind = MealType | 'extra';

export interface Dish {
  id: string;
  menuId: string;
}

export interface Slot {
  id: string;
  kind: SlotKind;
  label: string; // Anzeigename, z.B. «Mittagessen» oder «Zvieri»
  active: boolean; // false = entfällt (ausgegraut)
  dishes: Dish[];
  absent: string[]; // Personen-IDs, die NICHT mitessen (leer = alle)
}

/** Ein Tag im Plan. id = Datum «JJJJ-MM-TT». */
export interface PlanDay extends BaseRecord {
  slots: Slot[];
}

/** Standard-Mahlzeiten eines Tages. Feste IDs pro Datum, damit ein noch leerer Tag stabil bleibt. */
export function defaultSlots(dayKey: string): Slot[] {
  return MEAL_TYPES.map((t) => ({ id: `${dayKey}-${t.id}`, kind: t.id, label: t.label, active: true, dishes: [], absent: [] }));
}

// --- Datum-Hilfen (immer lokale Zeit, Woche beginnt am Montag) ---
export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7; // Mo=0 … So=6
  x.setDate(x.getDate() - wd);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Kalenderwoche nach ISO 8601. */
export function isoWeek(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const fmtDay = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
