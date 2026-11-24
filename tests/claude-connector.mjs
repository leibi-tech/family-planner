// Test der Supabase-Funktion «claude-connector» (v0.37): Anmeldung wie Claude (OAuth mit PKCE),
// dann die Werkzeuge (Einkauf, ToDos, Termine) gegen eine nachgebaute Datenbank.
// Aufruf: node tests/claude-connector.mjs
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.TZ = 'Europe/Zurich';
const dir = mkdtempSync(join(tmpdir(), 'cc-'));
await build({
  entryPoints: ['supabase/functions/claude-connector/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(dir, 'f.mjs'),
  logLevel: 'error',
});
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'eyJservice', SUPABASE_ANON_KEY: 'anon' });
const BASE = 'https://sb.test/functions/v1/claude-connector';

let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${cond ? '' : ' ' + extra}`);
  if (!cond) failed++;
};

// ---------- gefälschte Welt ----------
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const pd = (k) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const dk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monday = (() => {
  const d = pd(today);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
})();
const wid = 'woche-' + dk(monday);
const tue = dk(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1));

const users = { password: { 'tobias@x.ch': { pw: 'geheim', id: 'u-tobias' }, 'fremd@x.ch': { pw: 'x', id: 'u-fremd' } } };
const sessions = new Map(); // access token → uid
const refreshes = new Map(); // refresh token → uid
let tokenNo = 0;
const jwt = (uid, ttl = 3600) => {
  const t = `eyJ.${Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + ttl, n: ++tokenNo })).toString('base64url')}.sig`;
  sessions.set(t, uid);
  return t;
};
const newSession = (uid) => {
  const r = 'rt-' + ++tokenNo;
  refreshes.set(r, uid);
  return { access_token: jwt(uid), refresh_token: r };
};
const members = [
  { household_id: 'H1', user_id: 'u-tobias', person_id: 'p-tobias' },
  { household_id: 'H1', user_id: 'u-thadea', person_id: 'p-thadea' },
];
const rec = (store, data, extra = {}) => ({ household_id: 'H1', store, id: data.id, data: { updatedAt: 1, deleted: false, ...data }, updated_at: 1, deleted: false, owner_id: null, ...extra });
const tables = {
  records: [
    rec('persons', { id: 'p-tobias', name: 'Tobias', factor: 1, sort: 0 }),
    rec('persons', { id: 'p-thadea', name: 'Thadea', factor: 0.8, sort: 1, email: 'thadea@gmail.com' }),
    rec('persons', { id: 'p-kilian', name: 'Kilian', factor: 0.4, sort: 2 }),
    rec('menus', { id: 'm1', name: 'Spaghetti', mealTypes: ['abend'], basis: { kind: 'family', baseFactor: 2.2 }, note: '', ingredients: [
      { id: 'i1', product: 'Spaghetti', amount: 500, unit: 'g', category: 'lebensmittel' },
      { id: 'i2', product: 'Tomaten', amount: 4, unit: 'Stk.', category: 'lebensmittel' },
    ] }),
    rec('days', { id: tue, slots: [{ id: 's1', kind: 'abend', label: 'Abendessen', active: true, absent: [], dishes: [{ id: 'd1', menuId: 'm1' }] }] }),
    rec('recurring', { id: 'r1', product: 'Joghurt', qty: 12, unit: 'Stk.', category: 'lebensmittel', intervalWeeks: 1, startWeek: dk(monday) }),
    rec('todos', { id: 't1', title: 'Zahnarzt anrufen', note: '', due: '2020-01-01', assignees: ['p-tobias'], private: false, createdBy: 'p-thadea', createdAt: 1, done: false, doneAt: null, doneBy: null }),
    rec('todos', { id: 't2', title: 'Geheim von Thadea', note: '', due: null, assignees: [], private: true, createdBy: 'p-thadea', createdAt: 2, done: false, doneAt: null, doneBy: null }, { owner_id: 'u-thadea' }),
    rec('todos', { id: 't3', title: 'Velo flicken', note: '', due: null, assignees: ['p-kilian'], private: false, createdBy: 'p-tobias', createdAt: 3, done: false, doneAt: null, doneBy: null }),
  ],
  claude_connections: [],
  members,
};
const cal = { calls: [], calendars: [
  { id: 'tobias@gmail.com', name: 'Tobias', kind: 'own', personId: 'p-tobias', mine: true, writable: true, email: 'tobias@gmail.com' },
  { id: 'familie@group', name: 'Familie', kind: 'family', personId: null, mine: true, writable: true, email: 'tobias@gmail.com' },
  { id: 'thadea@gmail.com', name: 'Thadea', kind: 'own', personId: 'p-thadea', mine: false, writable: false, email: 'thadea@gmail.com' },
], events: [
  { id: 'e1', calendarId: 'tobias@gmail.com', recurringEventId: null, title: 'Hockey', allDay: false, start: `${today}T19:00:00+01:00`, end: `${today}T21:00:00+01:00`, location: 'Halle', description: null, uid: 'u1' },
  { id: 'e2', calendarId: 'thadea@gmail.com', recurringEventId: null, title: '[Kilian] Elternabend', allDay: false, start: `${today}T20:00:00+01:00`, end: `${today}T21:00:00+01:00`, location: null, description: null, uid: 'u2' },
  { id: 'e3', calendarId: 'familie@group', recurringEventId: null, title: 'Ferien', allDay: true, start: today, end: dk(new Date(pd(today).getTime() + 3 * 86400000)), location: null, description: null, uid: 'u3' },
] };

function filterRows(rows, params) {
  return rows.filter((r) => {
    for (const [k, v] of params) {
      if (['select', 'limit', 'order', 'on_conflict'].includes(k)) continue;
      const val = k.startsWith('data->>') ? r.data?.[k.slice(7)] : r[k];
      const [op, ...rest] = v.split('.');
      const arg = rest.join('.');
      if (op === 'eq' && String(val) !== arg) return false;
      if (op === 'lt' && !(Number(val) < Number(arg))) return false;
      if (op === 'is' && !(arg === 'null' ? val == null : String(val) === arg)) return false;
      if (op === 'in') {
        const list = arg.slice(1, -1).split(',').map((x) => x.replace(/^"|"$/g, ''));
        if (!list.includes(String(val))) return false;
      }
    }
    return true;
  });
}
const select = (rows, sel) => (sel === '*' || !sel ? rows : rows.map((r) => Object.fromEntries(sel.split(',').map((c) => [c, r[c]]))));
const resp = (status, body) => new Response(body === undefined || status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = (init.method ?? 'GET').toUpperCase();
  const h = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const body = init.body ? JSON.parse(init.body) : null;
  const bearer = (h.authorization ?? '').replace('Bearer ', '');
  if (url.pathname === '/auth/v1/user') {
    const uid = sessions.get(bearer);
    return uid ? resp(200, { id: uid, email: uid + '@x' }) : resp(401, {});
  }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const uid = refreshes.get(body.refresh_token);
      if (!uid) return resp(400, { error: 'invalid_grant' });
      refreshes.delete(body.refresh_token); // Supabase erneuert den Schlüssel bei jeder Verwendung
      return resp(200, newSession(uid));
    }
  }
  if (url.pathname === '/functions/v1/google-kalender') {
    const uid = sessions.get(bearer);
    if (!uid) return resp(401, { error: 'Bitte anmelden' });
    cal.calls.push(body);
    if (body.action === 'events') return resp(200, { calendars: cal.calendars, events: cal.events, errors: [] });
    if (body.action === 'create' || body.action === 'update') return resp(200, { ok: true, id: 'neu' });
    return resp(400, { error: 'Unbekannte Aktion.' });
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    const table = url.pathname.slice(9);
    const isService = h.apikey === 'eyJservice';
    const uid = isService ? null : sessions.get(bearer);
    if (!isService && !uid) return resp(401, { message: 'JWT expired' });
    if (table === 'claude_connections' && !isService) return resp(403, { message: 'denied' });
    let rows = tables[table];
    const params = [...url.searchParams];
    const visible = (r) =>
      isService || (table === 'members' ? members.some((m) => m.user_id === uid && m.household_id === r.household_id) : members.some((m) => m.user_id === uid && m.household_id === r.household_id) && (r.owner_id == null || r.owner_id === uid));
    if (method === 'GET') return resp(200, select(filterRows(rows.filter(visible), params), url.searchParams.get('select')));
    if (method === 'POST') {
      for (const row of Array.isArray(body) ? body : [body]) {
        if (table === 'records') {
          if (!visible(row)) return resp(403, { message: 'RLS' });
          const i = rows.findIndex((r) => r.household_id === row.household_id && r.store === row.store && r.id === row.id);
          if (i >= 0) {
            if (!visible(rows[i])) return resp(403, { message: 'RLS' });
            if (row.updated_at >= rows[i].updated_at) rows[i] = { ...rows[i], ...row };
          } else rows.push({ owner_id: null, ...row });
        } else rows.push({ id: 'c' + rows.length + '-' + tokenNo, ...row });
      }
      return resp(201);
    }
    if (method === 'PATCH') {
      for (const r of filterRows(rows, params)) Object.assign(r, body);
      return resp(204);
    }
    if (method === 'DELETE') {
      const del = new Set(filterRows(rows, params));
      tables[table] = rows.filter((r) => !del.has(r));
      return resp(204);
    }
  }
  return resp(404, { error: 'unbekannt ' + url });
};

const { handler } = await import(join(dir, 'f.mjs'));
const call = (path, init = {}) => handler(new Request(BASE + path, init));
const postJson = (path, body, headers = {}) => call(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const b64 = (buf) => buf.toString('base64url');

// ---------- 1) Entdecken ----------
let r = await call('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) });
check('ohne Anmeldung: 401 mit Hinweis auf Metadaten', r.status === 401 && /resource_metadata="https:\/\/sb\.test\/functions\/v1\/claude-connector\/\.well-known\/oauth-protected-resource"/.test(r.headers.get('www-authenticate') ?? ''));
r = await call('/.well-known/oauth-protected-resource');
let b = await r.json();
check('Metadaten der Ressource', b.resource === BASE && b.authorization_servers[0] === BASE);
for (const p of ['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration']) {
  b = await (await call(p)).json();
  check(`Anmelde-Metadaten ${p}`, b.authorization_endpoint === BASE + '/authorize' && b.token_endpoint === BASE + '/token' && b.code_challenge_methods_supported.includes('S256'));
}

// ---------- 2) Registrieren ----------
r = await postJson('/register', { redirect_uris: ['https://evil.example/cb'], client_name: 'Böse' });
check('fremde Rücksprung-Adresse abgelehnt', r.status === 400);
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
r = await postJson('/register', { redirect_uris: [REDIRECT], client_name: 'Claude', token_endpoint_auth_method: 'none' });
b = await r.json();
check('Registrierung', r.status === 201 && b.client_id && b.redirect_uris[0] === REDIRECT);
const clientId = b.client_id;

// ---------- 3) Anmelden (wie Claude + Anmeldeseite) ----------
const verifier = b64(Buffer.from('ein-langer-zufaelliger-pruefwert-fuer-pkce-1234567890'));
const challenge = b64(createHash('sha256').update(verifier).digest());
const authUrl = `/authorize?${new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, state: 'st-1', code_challenge: challenge, code_challenge_method: 'S256', scope: 'myfam' })}`;
r = await call(`/authorize?${new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: 'https://claude.ai/anders', code_challenge: challenge, code_challenge_method: 'S256' })}`);
check('andere Rücksprung-Adresse als registriert abgelehnt', r.status === 400);
r = await call(authUrl);
const loc = new URL(r.headers.get('location') ?? 'x:');
check('Weiterleitung zur Anmeldeseite', r.status === 302 && loc.href.startsWith('https://leibi-tech.github.io/family-planner/claude.html#'));
const reqTok = new URLSearchParams(loc.hash.slice(1)).get('req');

r = await postJson('/approve', { req: reqTok + 'x', ...newSession('u-tobias') });
check('verfälschte Anfrage abgelehnt', r.status === 400);
r = await postJson('/approve', { req: reqTok, ...newSession('u-fremd') });
check('Konto ohne Familie abgelehnt', r.status === 403);
r = await postJson('/approve', { req: reqTok, deny: true });
b = await r.json();
check('Ablehnen → access_denied zurück an Claude', new URL(b.redirect).searchParams.get('error') === 'access_denied' && new URL(b.redirect).searchParams.get('state') === 'st-1');
const appSession = newSession('u-tobias');
r = await postJson('/approve', { req: reqTok, ...appSession });
b = await r.json();
const back = new URL(b.redirect);
check('Erlauben → Code zurück an Claude', back.origin + back.pathname === REDIRECT && back.searchParams.get('state') === 'st-1' && back.searchParams.get('code'));
const code = back.searchParams.get('code');

const form = (o) => call('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
r = await form({ grant_type: 'authorization_code', code, code_verifier: 'falsch', redirect_uri: REDIRECT, client_id: clientId });
check('falscher PKCE-Prüfwert abgelehnt', r.status === 400);
r = await form({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: REDIRECT, client_id: clientId });
let tok = await r.json();
check('Code → Zugangs-Schlüssel', r.status === 200 && tok.access_token && tok.refresh_token && tok.token_type === 'Bearer');
r = await form({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: REDIRECT, client_id: clientId });
check('Code nur einmal gültig', r.status === 400);

// ---------- 4) MCP ----------
let rpcId = 10;
const rpc = async (method, params) => {
  const res = await postJson('', { jsonrpc: '2.0', id: ++rpcId, method, params }, { Authorization: `Bearer ${tok.access_token}` });
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
};
const tool = async (name, args = {}) => {
  const x = await rpc('tools/call', { name, arguments: args });
  return { text: x.body?.result?.content?.[0]?.text ?? JSON.stringify(x.body), isError: x.body?.result?.isError };
};
let x = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
check('initialize', x.body?.result?.protocolVersion === '2025-06-18' && x.body.result.capabilities.tools && /myFam/.test(x.body.result.instructions));
const note = await postJson('', { jsonrpc: '2.0', method: 'notifications/initialized' }, { Authorization: `Bearer ${tok.access_token}` });
check('Benachrichtigung → 202', note.status === 202);
x = await rpc('tools/list', {});
const names = x.body.result.tools.map((t) => t.name);
check('10 Werkzeuge, keins zum Löschen', names.length === 10 && !names.some((n) => /loesch|lösch|delete/.test(n)), names.join(','));

let t = await tool('familie_anzeigen');
check('Familie: angemeldet als Tobias', /Tobias \(das bin ich/.test(t.text) && /Kilian/.test(t.text));

t = await tool('einkaufsliste_anzeigen');
check('Einkaufsliste: Zutaten aus dem Plan (Faktoren 2.2)', /Spaghetti 500 g \(Menü Spaghetti\)/.test(t.text) && /Tomaten 4 Stk\./.test(t.text), t.text);
check('Einkaufsliste: wiederkehrender Artikel', /Joghurt 12 Stk\. \(jede Woche\)/.test(t.text));

t = await tool('einkauf_hinzufuegen', { artikel: [{ produkt: 'Milch', menge: 2, einheit: 'Liter' }, { produkt: 'WC-Papier', kategorie: 'anderes' }] });
check('Artikel hinzugefügt', /Milch 2 l, WC-Papier/.test(t.text), t.text);
const manual = tables.records.filter((r) => r.store === 'manual');
check('… als «von Hand» für diese Woche gespeichert', manual.length === 2 && manual.every((m) => m.data.week === wid && m.updated_at > 1e12));
t = await tool('einkauf_abhaken', { produkte: ['milch', 'Banane'] });
check('Abhaken + Hinweis auf fehlenden Artikel', /Abgehakt: Milch/.test(t.text) && /Nicht auf der Liste.*Banane/.test(t.text), t.text);
const week = tables.records.find((r) => r.store === 'shopping' && r.id === wid);
check('… Woche gespeichert (checked, bought)', week?.data.checked.includes('milch|l') && week.data.bought['milch|l'] === 2);
t = await tool('einkaufsliste_anzeigen');
check('Liste zeigt [x] Milch', /\[x\] Milch 2 l/.test(t.text) && /\[ \] WC-Papier/.test(t.text), t.text);
t = await tool('einkauf_hinzufuegen', { artikel: [{ produkt: 'Milch', menge: 1, einheit: 'l' }] });
t = await tool('einkaufsliste_anzeigen');
check('Nachkauf: nur zusätzliche Menge offen', /\[ \] Milch 1 l/.test(t.text), t.text);
t = await tool('einkauf_abhaken', { produkte: ['Joghurt'], abgehakt: false });
check('wieder offen machen', /Wieder offen: Joghurt/.test(t.text));

t = await tool('todos_anzeigen', { ansicht: 'meine' });
check('Meine ToDos: zugeteilt + überfällig', /Zahnarzt anrufen \(fällig .*ÜBERFÄLLIG, für Tobias\)/.test(t.text) && !/Velo/.test(t.text), t.text);
check('private ToDos anderer bleiben unsichtbar', !/Geheim/.test(t.text) && !/Geheim/.test((await tool('todos_anzeigen', { ansicht: 'alle' })).text));
t = await tool('todo_erfassen', { titel: 'Geschenk kaufen', fuer: ['Thadea'], faellig: '2026-12-20' });
const nt = tables.records.find((r) => r.store === 'todos' && r.data.title === 'Geschenk kaufen');
check('ToDo erfasst (für Thadea, von Tobias)', nt && nt.data.assignees[0] === 'p-thadea' && nt.data.createdBy === 'p-tobias' && nt.owner_id == null, t.text);
t = await tool('todo_erfassen', { titel: 'Nur für mich', privat: true });
const pt = tables.records.find((r) => r.store === 'todos' && r.data.title === 'Nur für mich');
check('privates ToDo mit owner_id', pt?.owner_id === 'u-tobias' && pt.data.private === true);
t = await tool('todo_erfassen', { titel: 'X', fuer: ['Grossmami'] });
check('unbekannte Person → Fehler mit Namen', t.isError && /Grossmami.*Tobias, Thadea, Kilian/.test(t.text), t.text);
t = await tool('todo_aendern', { id: 't1', erledigt: true });
const t1 = tables.records.find((r) => r.id === 't1');
check('ToDo erledigt', t1.data.done === true && t1.data.doneBy === 'p-tobias' && t1.updated_at > 1);
t = await tool('todo_aendern', { id: 't2', erledigt: true });
check('fremdes privates ToDo nicht änderbar', t.isError && tables.records.find((r) => r.id === 't2').data.done === false);

t = await tool('termine_anzeigen');
check('Termine: eigener + fremder Kalender, Personen', /19:00–21:00 Hockey \(wer: Tobias, Kalender: Tobias, Ort: Halle\)/.test(t.text) && /Elternabend \(wer: Thadea, Kilian/.test(t.text) && /ganztägig bis .* Ferien \(ganze Familie/.test(t.text), t.text);
t = await tool('termin_erfassen', { titel: 'Kino', datum: '2026-12-05', start: '20:00', personen: ['Tobias', 'Thadea'] });
let c = cal.calls.at(-1);
check('Termin: eigener Kalender, 1 Stunde, Thadea eingeladen', c.action === 'create' && c.calendarId === 'tobias@gmail.com' && c.event.title === '[Thadea] Kino' && c.event.endTime === '21:00' && c.invite?.[0] === 'thadea@gmail.com', JSON.stringify(c));
t = await tool('termin_erfassen', { titel: 'Grosi Geburtstag', datum: '2026-12-10', kalender: 'familie' });
c = cal.calls.at(-1);
check('Termin im Familienkalender, ganztägig', c.calendarId === 'familie@group' && c.event.allDay === true && c.event.title === 'Grosi Geburtstag' && !c.invite);
t = await tool('termin_aendern', { kalender_id: 'tobias@gmail.com', termin_id: 'e1', tag: today, start: '18:30' });
c = cal.calls.at(-1);
check('Termin verschoben, Dauer bleibt', c.action === 'update' && c.event.startTime === '18:30' && c.event.endTime === '20:30' && c.event.title === 'Hockey' && c.event.location === 'Halle', JSON.stringify(c));
t = await tool('termin_aendern', { kalender_id: 'thadea@gmail.com', termin_id: 'e2', tag: today, titel: 'X' });
check('fremden Termin nicht änderbar', t.isError);

// ---------- 5) Erneuern ----------
r = await form({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: clientId });
const tok2 = await r.json();
check('Erneuern mit refresh_token', r.status === 200 && tok2.access_token && tok2.refresh_token !== tok.refresh_token);
r = await form({ grant_type: 'refresh_token', refresh_token: tok.refresh_token });
check('alter refresh_token ungültig', r.status === 400);
tok = tok2;
// Supabase-Anmeldung abgelaufen → wird mit dem gespeicherten Schlüssel erneuert
tables.claude_connections[0].sb_expires = Date.now() - 1000;
t = await tool('familie_anzeigen');
check('Supabase-Anmeldung wird erneuert', /Tobias/.test(t.text) && tables.claude_connections[0].sb_expires > Date.now());
// Konto-Anmeldung gesperrt (z.B. Passwort geändert) → 401, Verbindung weg
tables.claude_connections[0].sb_expires = Date.now() - 1000;
refreshes.clear();
const r401 = await postJson('', { jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'familie_anzeigen', arguments: {} } }, { Authorization: `Bearer ${tok.access_token}` });
check('abgelaufene Anmeldung → 401 und Verbindung gelöscht', r401.status === 401 && tables.claude_connections.length === 0);

console.log(failed ? `${failed} FEHLER` : 'ALLE OK');
process.exit(failed ? 1 : 0);
