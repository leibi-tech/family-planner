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
  | { kind: 'person'; baseFactor: number; personId: string; personName: string };

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

export function basisLabel(b: Basis): string {
  return b.kind === 'family'
    ? `ganze Familie (Faktor ${b.baseFactor.toFixed(1)})`
    : `1 Portion von ${b.personName} (Faktor ${b.baseFactor.toFixed(1)})`;
}
