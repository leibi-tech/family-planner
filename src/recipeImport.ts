// Menü-Import: Rezepttext (oder Zutaten von einer Webseite) in Zutaten zerlegen.
// Läuft komplett auf dem Handy, ohne Internet. Der Link-Import holt nur die Rohdaten
// über die Supabase-Funktion «rezept-import» und verwendet danach denselben Zerleger.
import type { Category, MealType } from './model';

export interface ParsedIngredient {
  product: string;
  amount: number | null;
  unit: string; // immer eine Einheit aus UNITS
  category: Category;
  source: string; // Originalzeile, zur Kontrolle
  unsure: boolean; // Einheit oder Menge nicht sicher erkannt
}

export interface ParsedRecipe {
  name: string;
  servings: number | null; // «für 4 Personen»
  ingredients: ParsedIngredient[];
  note: string;
  mealTypes: MealType[];
}

// ---------- Zahlen ----------
const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅛': 0.125 };
const NUM = String.raw`(?:\d+[.,]\d+|\d+\s*[½⅓⅔¼¾⅕⅛]|\d+\s+\d+\/\d+|\d+\/\d+|\d+|[½⅓⅔¼¾⅕⅛])`;

function toNumber(t: string): number | null {
  t = t.trim();
  let m = t.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅛])$/);
  if (m) return Number(m[1]) + FRACTIONS[m[2]];
  if (FRACTIONS[t] != null) return FRACTIONS[t];
  m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ---------- Einheiten ----------
// Wort (klein geschrieben, ohne Schlusspunkt) → [Einheit der App, Umrechnungsfaktor]
const UNIT_WORDS: Array<[string[], string, number]> = [
  [['g', 'gr', 'gramm'], 'g', 1],
  [['kg', 'kilo', 'kilogramm'], 'kg', 1],
  [['mg'], 'g', 0.001],
  [['ml', 'milliliter'], 'ml', 1],
  [['cl', 'zentiliter'], 'ml', 10],
  [['dl', 'deziliter'], 'ml', 100],
  [['l', 'liter', 'lt'], 'l', 1],
  [['el', 'esslöffel', 'essl', 'eßlöffel', 'tbsp'], 'EL', 1],
  [['tl', 'teelöffel', 'teel', 'kl', 'kaffeelöffel', 'tsp'], 'TL', 1],
  [['prise', 'prisen', 'msp', 'messerspitze', 'messerspitzen'], 'Prise', 1],
  [['bund', 'bd', 'bündel'], 'Bund', 1],
  [['dose', 'dosen', 'büchse', 'büchsen'], 'Dose', 1],
  [['pck', 'pkg', 'pack', 'packung', 'packungen', 'päckchen', 'päckli', 'paket', 'pakete', 'beutel', 'btl', 'tüte'], 'Pck.', 1],
  [['stk', 'stück', 'st'], 'Stk.', 1],
];
// Mengenwörter, die als «Stk.» zählen; das Wort bleibt im Produktnamen erhalten.
const PIECE_WORDS = [
  'zehe', 'zehen', 'scheibe', 'scheiben', 'becher', 'glas', 'gläser', 'tasse', 'tassen', 'zweig', 'zweige', 'zweiglein',
  'blatt', 'blätter', 'stange', 'stangen', 'knolle', 'knollen', 'kopf', 'köpfe', 'handvoll', 'würfel', 'tafel',
  'tafeln', 'rolle', 'rollen', 'flasche', 'flaschen', 'stängel', 'kugel', 'kugeln', 'riegel', 'schale', 'schalen',
  'netz', 'beet', 'portion', 'portionen',
];

const unitIndex = new Map<string, [string, number]>();
for (const [words, unit, mul] of UNIT_WORDS) for (const w of words) unitIndex.set(w, [unit, mul]);

const VAGUE = /^(etwas|wenig|einige|einigen|ein paar|ca\.?|circa|rund|evtl\.?|eventuell|nach belieben|nach bedarf|n\. ?b\.?|reichlich|je|gut|knapp|zirka)\s+/i;
const VAGUE_ONLY = /\b(nach belieben|nach bedarf|zum (bestreuen|garnieren|braten|anbraten|servieren|bestäuben|einfetten)|für die form|wenig|etwas)\b/gi;

// Was nicht gegessen wird, kommt in die Sparte «Anderes».
const OTHER = /(backpapier|alufolie|alu-folie|klarsichtfolie|frischhaltefolie|zahnstocher|spiess|spieß|schaschlik|küchenschnur|bratschlauch|muffinförmchen|papierförmchen|grillkohle|kerze)/i;

const ARTICLE = /^(ein|eine|einer|einen|einem)\s+/i;
const WORD_NUMBERS: Record<string, number> = { ein: 1, eine: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, zehn: 10, zwölf: 12, halbe: 0.5, halber: 0.5, halbes: 0.5 };

function cleanProduct(t: string): string {
  return t
    .replace(/\s*\((?:ca\.?|etwa|à|je|zirka)?\s*\d[^)]*\)/gi, '') // «(ca. 400 g)»
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '')
    .replace(/^(von|vom|an)\s+/i, '')
    .replace(/^(kleine[rsn]?|grosse[rsn]?|große[rsn]?|mittelgrosse[rsn]?|mittelgroße[rsn]?|mittlere[rsn]?)\s+/i, '')
    .trim();
}

/** Eine Zutatenzeile zerlegen, z.B. «2,5 dl Rahm» → 250 ml Rahm. */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  const source = line.trim();
  let t = source
    .replace(/^[\s•·*▪◦‣–—-]+/, '') // Aufzählungszeichen
    .replace(/ /g, ' ')
    .trim();
  if (!t) return null;

  let amount: number | null = null;
  let unit = '';
  let unsure = false;

  t = t.replace(VAGUE, '');
  // Zahlwort am Anfang: «eine Zwiebel», «zwei Eier»
  const wn = t.match(/^([a-zäöü]+)\s+(.+)$/i);
  if (wn && WORD_NUMBERS[wn[1].toLowerCase()] != null) {
    amount = WORD_NUMBERS[wn[1].toLowerCase()];
    t = wn[2];
  }

  // Zahl oder Bereich am Anfang: «1–2», «1 bis 2», «1 1/2»
  const range = new RegExp(String.raw`^(${NUM})\s*(?:-|–|—|bis)\s*(${NUM})\s*`, 'i');
  const single = new RegExp(String.raw`^(${NUM})\s*`);
  let m = t.match(range);
  if (amount == null && m) {
    amount = toNumber(m[2]); // lieber genug: obere Grenze
    t = t.slice(m[0].length);
    unsure = true;
  } else if (amount == null && (m = t.match(single))) {
    amount = toNumber(m[1]);
    t = t.slice(m[0].length);
  }

  if (amount != null) {
    // Einheit direkt nach der Zahl: «400g», «2 EL», «1 Pck.»
    const um = t.match(/^([a-zäöüß]+)\.?(?=\s|$|,|\))/i);
    const word = um?.[1].toLowerCase();
    if (word && unitIndex.has(word)) {
      const [u, mul] = unitIndex.get(word)!;
      unit = u;
      amount = amount * mul;
      t = t.slice(um![0].length);
      // «1 Dose Tomaten (400 g)»: Dose behalten, das ist die Einkaufseinheit
    } else if (word && PIECE_WORDS.includes(word)) {
      unit = 'Stk.';
      unsure = true;
      // «2 Zehen Knoblauch» → Produkt «Knoblauch (Zehen)»
      const rest = cleanProduct(t.slice(um![0].length));
      t = rest ? `${rest} (${um![1]})` : um![1];
    } else {
      unit = 'Stk.'; // «2 Zwiebeln (ca. 200 g)» bleibt 2 Stk., das Gewicht steht in der Originalzeile
    }
  } else {
    t = t.replace(ARTICLE, '');
  }

  // Zusätze nach dem Komma entfernen («Zwiebel, fein gehackt»), ausser es bleibt nichts übrig.
  let product = t;
  const comma = product.indexOf(',');
  if (comma > 0) product = product.slice(0, comma);
  product = cleanProduct(product.replace(VAGUE_ONLY, ''));
  if (!product) product = cleanProduct(t);
  if (!product) return null;
  product = product.charAt(0).toUpperCase() + product.slice(1);

  if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
    amount = null;
    unsure = true;
  }
  if (amount == null) unit = 'g'; // «nach Bedarf» – Einheit spielt keine Rolle
  if (amount == null && /\d/.test(source)) unsure = true; // Zahl in der Zeile, aber nicht verstanden
  if (product.length > 32) unsure = true;
  amount = amount == null ? null : Math.round(amount * 1000) / 1000;

  return { product, amount, unit, category: OTHER.test(product) ? 'anderes' : 'lebensmittel', source, unsure };
}

/** Wie parseIngredientLine, teilt aber «Salz, Pfeffer» oder «Salz und Pfeffer» in zwei Zutaten. */
export function parseIngredients(l: string): ParsedIngredient[] {
  const parts =
    !startsWithAmount(l) && /^[^\d]+(,|\bund\b)[^\d]+$/i.test(l) && l.length < 35
      ? l.split(/,|\bund\b/i).map((x) => x.trim()).filter(Boolean)
      : [l];
  const out: ParsedIngredient[] = [];
  for (const p of parts) {
    const ing = parseIngredientLine(p);
    if (ing) {
      if (parts.length > 1) ing.source = l.trim();
      out.push(ing);
    }
  }
  return out;
}

// ---------- Ganzer Text ----------
const SERVINGS = /(?:für|fuer|ergibt|reicht für)?\s*(\d+)(?:\s*(?:-|–|bis)\s*(\d+))?\s*(personen|portionen|pers\.?|port\.?|stück|stk\.?|servings|people)\b/i;
const HEAD_INGR = /^(zutaten|einkaufsliste|du brauchst|das brauchst du|ingredients)\b[:\s]*/i;
const HEAD_STEPS = /^(zubereitung|so geht'?s|so wird'?s gemacht|anleitung|zubereiten|instructions|method|vorgehen)\b/i;
const STEP_LINE = /^(\d+[.)]\s+|schritt\s*\d+)/i;
const SECTION_LINE = /^[^\d]{1,40}:$/; // «Für die Sauce:»
const NOISE = /^(drucken|teilen|merken|speichern|bewertung|kommentare?|zur einkaufsliste|auf die einkaufsliste|werbung|anzeige|\d+\s*kcal|kalorien|nährwerte|zeit|arbeitszeit|zubereitungszeit|gesamtzeit|backen|schwierigkeit|einfach|mittel|schwer|vegetarisch|vegan)\b/i;

function startsWithAmount(l: string): boolean {
  return new RegExp(String.raw`^[\s•·*–-]*(?:${NUM})`).test(l) || /^[\s•·*–-]*(eine?|zwei|drei|vier|fünf|sechs|halbe[rs]?)\s/i.test(l);
}

/** Nur Menge und Einheit ohne Produkt, z.B. Zeile «400 g» (Fooby kopiert oft so). */
function amountOnly(l: string): boolean {
  return new RegExp(String.raw`^\s*(?:${NUM})(?:\s*(?:-|–|bis)\s*${NUM})?\s*([a-zäöü]+\.?)?\s*$`, 'i').test(l) && !/[a-zäöü]{4,}/i.test(l.replace(/(stück|liter|gramm|prise|prisen|bund|dose|dosen|pck\.?|packung|zehen?|scheiben?|becher|glas|tasse|teelöffel|esslöffel)/i, ''));
}

/**
 * Rezepttext zerlegen. Erkennt Titel, Personenzahl, Zutaten und Zubereitung.
 * Ohne Überschriften gilt: Zeilen mit Menge sind Zutaten, nummerierte/lange Sätze Zubereitung.
 */
export function parseRecipeText(text: string): ParsedRecipe {
  const raw = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/ /g, ' ').trim());
  // Zeilen zusammenführen, wenn Menge und Produkt getrennt kopiert wurden.
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i];
    if (!l) {
      lines.push('');
      continue;
    }
    if (amountOnly(l)) {
      let j = i + 1;
      while (j < raw.length && !raw[j]) j++;
      if (j < raw.length && raw[j] && !startsWithAmount(raw[j]) && !HEAD_STEPS.test(raw[j])) {
        lines.push(`${l} ${raw[j]}`);
        i = j;
        continue;
      }
    }
    lines.push(l);
  }

  let name = '';
  let servings: number | null = null;
  const ingredients: ParsedIngredient[] = [];
  const steps: string[] = [];
  let mode: 'auto' | 'ingr' | 'steps' = 'auto';
  let sawIngredient = false;

  for (const l of lines) {
    if (!l) continue;
    const sv = l.match(SERVINGS);
    if (sv && l.length < 40 && !servings && /^(für|fuer|ergibt|reicht|zutaten|\d)/i.test(l)) {
      servings = Number(sv[2] ?? sv[1]);
      if (/^\d/.test(l) && !/personen|portionen|pers/i.test(l)) servings = null; // «4 Stück» am Anfang ist eher eine Zutat
      else continue;
    }
    if (HEAD_INGR.test(l)) {
      mode = 'ingr';
      const rest = l.replace(HEAD_INGR, '');
      const s2 = rest.match(SERVINGS);
      if (s2 && !servings) servings = Number(s2[2] ?? s2[1]);
      continue;
    }
    if (HEAD_STEPS.test(l) && l.length < 40) {
      mode = 'steps';
      continue;
    }
    if (mode === 'steps') {
      steps.push(l);
      continue;
    }
    if (NOISE.test(l) && l.length < 40) continue;
    if (SECTION_LINE.test(l)) continue; // Zwischentitel wie «Sauce:»

    const looksLikeStep = STEP_LINE.test(l) || (l.length > 70 && /[.!]$/.test(l)) || l.split(' ').length > 12;
    if (mode === 'auto' && looksLikeStep && sawIngredient) {
      steps.push(l);
      continue;
    }
    if (mode === 'auto' && looksLikeStep) {
      steps.push(l);
      continue;
    }
    // Titel: erste Zeile ohne Menge, bevor Zutaten kamen
    if (!name && !sawIngredient && mode === 'auto' && !startsWithAmount(l) && l.length <= 60) {
      name = l.replace(/\s*[-–|].*(rezept|fooby|betty bossi|migusto|chefkoch).*$/i, '').trim();
      continue;
    }
    // Ab hier: Zutat. Kurze Zeilen ohne Menge («Salz», «Pfeffer») sind auch Zutaten.
    if (!startsWithAmount(l) && l.length > 45) {
      steps.push(l);
      continue;
    }
    const found = parseIngredients(l);
    ingredients.push(...found);
    if (found.length) sawIngredient = true;
  }

  return { name, servings, ingredients, note: steps.join('\n'), mealTypes: [] };
}

/** Daten aus dem Link-Import (strukturiertes Rezept einer Webseite) in dasselbe Format bringen. */
export function fromWebRecipe(r: WebRecipe): ParsedRecipe {
  const ingredients: ParsedIngredient[] = [];
  for (const line of r.ingredients) ingredients.push(...parseIngredients(line));
  let servings: number | null = null;
  const y = String(r.yield ?? '');
  const m = y.match(/(\d+)(?:\s*(?:-|–|bis)\s*(\d+))?/);
  if (m) servings = Number(m[2] ?? m[1]);
  const note = [r.instructions.join('\n'), r.url ? `Quelle: ${r.url}` : ''].filter(Boolean).join('\n\n');
  return { name: r.name.trim(), servings, ingredients, note, mealTypes: [] };
}

export interface WebRecipe {
  name: string;
  ingredients: string[];
  yield: string | null;
  instructions: string[];
  url: string;
}

/** Ist der eingefügte Text ein Link? */
export function extractUrl(text: string): string | null {
  const t = text.trim();
  const m = t.match(/https?:\/\/[^\s<>"]+/i);
  if (!m) return null;
  // Nur wenn der Text im Wesentlichen aus dem Link besteht (Teilen-Text von Apps enthält oft noch den Titel).
  return t.length - m[0].length < 120 ? m[0].replace(/[).,]+$/, '') : null;
}
