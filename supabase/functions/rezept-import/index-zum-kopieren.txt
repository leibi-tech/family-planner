// Supabase Edge Function «rezept-import»
// Holt eine Rezept-Webseite und gibt Titel, Zutaten, Personenzahl und Zubereitung zurück.
// Viele Rezeptseiten (Fooby, Betty Bossi, Migusto, Chefkoch …) enthalten diese Angaben
// maschinenlesbar für Google («schema.org/Recipe»). Die App kann fremde Seiten nicht selbst
// abrufen (Browser-Sperre), darum macht das diese kleine Funktion.
// Nur angemeldete Konten dürfen sie verwenden (Prüfung unten), damit sie nicht missbraucht wird.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

declare const Deno: any;
const env = (k: string): string | undefined =>
  typeof Deno !== 'undefined' ? Deno.env.get(k) : (globalThis as any).process?.env?.[k];

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Nur POST erlaubt.' }, 405);

  // 1) Angemeldet? Wir fragen Supabase Auth mit dem Token der App.
  const auth = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  const base = env('SUPABASE_URL');
  if (!auth.startsWith('Bearer ') || !base) return json({ error: 'Bitte zuerst in der App anmelden.' }, 401);
  const who = await fetch(`${base}/auth/v1/user`, { headers: { Authorization: auth, apikey } }).catch(() => null);
  if (!who || !who.ok) return json({ error: 'Bitte zuerst in der App anmelden.' }, 401);

  // 2) Link prüfen
  let url: URL;
  try {
    const body = await req.json();
    url = new URL(String(body?.url ?? '').trim());
  } catch {
    return json({ error: 'Das ist kein gültiger Link.' }, 400);
  }
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) return json({ error: 'Das ist kein gültiger Link.' }, 400);

  // 3) Seite holen (höchstens 12 Sekunden, höchstens 4 MB)
  let html: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-CH,de;q=0.9',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return json({ error: `Die Seite konnte nicht geladen werden (Fehler ${res.status}).` }, 422);
    html = await readLimited(res, 4_000_000);
  } catch {
    return json({ error: 'Die Seite konnte nicht geladen werden.' }, 422);
  }

  const recipe = extractRecipe(html, url.toString());
  if (!recipe || recipe.ingredients.length === 0)
    return json({ error: 'Auf dieser Seite wurde kein Rezept gefunden. Bitte die Zutaten als Text kopieren und einfügen.' }, 422);
  return json(recipe);
}

async function readLimited(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size > max) {
      reader.cancel();
      break;
    }
  }
  const all = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    all.set(c.subarray(0, Math.min(c.length, size - o)), o);
    o += c.length;
    if (o >= size) break;
  }
  return new TextDecoder('utf-8').decode(all);
}

function isPrivateHost(h: string): boolean {
  h = h.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

// ---------------- Rezept aus HTML lesen ----------------

export interface WebRecipe {
  name: string;
  ingredients: string[];
  yield: string | null;
  instructions: string[];
  url: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ss', eacute: 'é', egrave: 'è', ndash: '–', mdash: '—' };

function clean(s: unknown): string {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e] ?? m;
    })
    .replace(/<[^>]*>/g, ' ') // doppelt verpackte Tags («&lt;b&gt;»)
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecipe(o: any): boolean {
  const t = o?.['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

function findRecipe(o: any, depth = 0): any {
  if (!o || typeof o !== 'object' || depth > 8) return null;
  if (Array.isArray(o)) {
    for (const x of o) {
      const r = findRecipe(x, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (isRecipe(o)) return o;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipe(o[k], depth + 1);
    if (r) return r;
  }
  return null;
}

function instructionsOf(x: any, out: string[] = []): string[] {
  if (!x) return out;
  if (typeof x === 'string') {
    for (const part of x.split(/\n+|<br\s*\/?>|<\/p>|<\/li>/i)) {
      const c = clean(part);
      if (c) out.push(c);
    }
  } else if (Array.isArray(x)) {
    for (const y of x) instructionsOf(y, out);
  } else if (typeof x === 'object') {
    if (x.itemListElement) {
      if (x.name) out.push(clean(x.name) + ':');
      instructionsOf(x.itemListElement, out);
    } else instructionsOf(x.text ?? x.name, out);
  }
  return out;
}

export function extractRecipe(html: string, url: string): WebRecipe | null {
  // a) JSON-LD (am häufigsten)
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: any;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      try {
        data = JSON.parse(m[1].replace(/[\u0000-\u001f]+/g, ' ').trim());
      } catch {
        continue;
      }
    }
    const r = findRecipe(data);
    if (!r) continue;
    const ing = r.recipeIngredient ?? r.ingredients ?? [];
    const ingredients = (Array.isArray(ing) ? ing : [ing]).map(clean).filter(Boolean);
    const y = Array.isArray(r.recipeYield) ? r.recipeYield.map(String).find((s: string) => /\d/.test(s)) ?? r.recipeYield[0] : r.recipeYield;
    return {
      name: clean(r.name) || titleOf(html),
      ingredients,
      yield: y != null ? clean(y) : null,
      instructions: instructionsOf(r.recipeInstructions),
      url,
    };
  }
  // b) Microdata: <li itemprop="recipeIngredient">
  const items: string[] = [];
  const mi = /<([a-z0-9]+)[^>]*itemprop\s*=\s*["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  while ((m = mi.exec(html))) {
    const c = clean(m[2]);
    if (c) items.push(c);
  }
  if (items.length) return { name: titleOf(html), ingredients: items, yield: null, instructions: [], url };
  return null;
}

function titleOf(html: string): string {
  const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const t = og?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  return clean(t).replace(/\s*[|–-]\s*[^|–-]*$/, '').trim();
}

if (typeof Deno !== 'undefined') Deno.serve(handler);
