// Test der Supabase-Funktion «google-kalender» mit gefälschtem Google und gefälschter Datenbank.
// Aufruf: node tests/google-function.mjs
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'gk-'));
await build({
  entryPoints: ['supabase/functions/google-kalender/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(dir, 'f.mjs'),
  logLevel: 'error',
});

Object.assign(process.env, {
  SUPABASE_URL: 'https://sb.test',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJservice',
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'csecret',
});

// ---- gefälschte Welt ----
const users = { 'tok-tobias': { id: 'u-tobias', email: 't@x.ch' }, 'tok-thadea': { id: 'u-thadea', email: 'th@x.ch' }, 'tok-fremd': { id: 'u-fremd', email: 'f@x.ch' } };
const members = [
  { household_id: 'H1', user_id: 'u-tobias', person_id: 'p-tobias' },
  { household_id: 'H1', user_id: 'u-thadea', person_id: 'p-thadea' },
  { household_id: 'H2', user_id: 'u-fremd', person_id: 'p-fremd' },
];
let accounts = [];
const google = {
  codes: { 'code-t': { email: 'tobias@gmail.com', refresh: 'rt-t' }, 'code-th': { email: 'thadea@gmail.com', refresh: 'rt-th' } },
  refresh: { 'rt-t': 'at-t', 'rt-th': 'at-th' },
  revoked: [],
  calendars: {
    'at-t': [
      { id: 'tobias@gmail.com', summary: 'Tobias', accessRole: 'owner', primary: true },
      { id: 'familie@group', summary: 'Familie', accessRole: 'owner' },
    ],
    'at-th': [
      { id: 'thadea@gmail.com', summary: 'Thadea', accessRole: 'owner', primary: true },
      { id: 'familie@group', summary: 'Familie', accessRole: 'writer' },
    ],
  },
  events: {
    'tobias@gmail.com': [
      { id: 'e1', summary: 'Hockey', start: { dateTime: '2026-10-27T19:00:00+01:00' }, end: { dateTime: '2026-10-27T21:00:00+01:00' }, htmlLink: 'L1' },
      { id: 'e0', status: 'cancelled', start: { dateTime: '2026-10-28T19:00:00+01:00' } },
    ],
    'thadea@gmail.com': [{ id: 'e2', summary: 'Yoga', start: { dateTime: '2026-10-27T19:30:00+01:00' }, end: { dateTime: '2026-10-27T20:30:00+01:00' } }],
    'familie@group': [{ id: 'e3', summary: 'Ferien', start: { date: '2026-10-30' }, end: { date: '2026-11-02' }, recurringEventId: null }],
  },
  eventCalls: [],
};

const R = (body, status = 200, headers = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  const h = init.headers || {};
  if (url.host === 'sb.test' && url.pathname === '/auth/v1/user') {
    const u = users[(h.Authorization || '').replace('Bearer ', '')];
    return u ? R(u) : R({}, 401);
  }
  if (url.host === 'sb.test' && url.pathname.startsWith('/rest/v1/')) {
    if (h.apikey !== 'eyJservice' || h.Authorization !== 'Bearer eyJservice') return R({ message: 'no' }, 401);
    const table = url.pathname.split('/').pop();
    const f = (rows) =>
      rows.filter((r) =>
        [...url.searchParams].every(([k, v]) => ['select', 'on_conflict'].includes(k) || String(r[k]) === v.replace(/^eq\./, '')),
      );
    if (table === 'members') return R(f(members));
    if (table === 'google_accounts') {
      if (method === 'GET') return R(f(accounts));
      const b = init.body ? JSON.parse(init.body) : null;
      if (method === 'POST') {
        accounts = accounts.filter((a) => a.user_id !== b.user_id);
        accounts.push({ calendars: [], ...b });
        return R(null, 201);
      }
      if (method === 'PATCH') {
        f(accounts).forEach((a) => Object.assign(a, b));
        return R(null, 204);
      }
      if (method === 'DELETE') {
        const del = new Set(f(accounts));
        accounts = accounts.filter((a) => !del.has(a));
        return R(null, 204);
      }
    }
  }
  if (url.href.startsWith('https://oauth2.googleapis.com/token')) {
    const p = new URLSearchParams(init.body.toString());
    if (p.get('client_secret') !== 'csecret') return R({ error: 'invalid_client' }, 401);
    if (p.get('grant_type') === 'authorization_code') {
      const c = google.codes[p.get('code')];
      if (!c) return R({ error: 'invalid_grant' }, 400);
      if (p.get('redirect_uri') !== 'https://sb.test/functions/v1/google-kalender') return R({ error: 'redirect_uri_mismatch' }, 400);
      const idt = 'x.' + Buffer.from(JSON.stringify({ email: c.email })).toString('base64url') + '.y';
      return R({ access_token: google.refresh[c.refresh], refresh_token: c.refresh, expires_in: 3600, id_token: idt, scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly' });
    }
    const at = google.refresh[p.get('refresh_token')];
    return at ? R({ access_token: at, expires_in: 3600 }) : R({ error: 'invalid_grant' }, 400);
  }
  if (url.href.startsWith('https://oauth2.googleapis.com/revoke')) {
    google.revoked.push(url.searchParams.get('token'));
    return R({});
  }
  if (url.host === 'www.googleapis.com') {
    const at = (h.Authorization || '').replace('Bearer ', '');
    if (!google.calendars[at]) return R({}, 401);
    if (url.pathname.endsWith('/users/me/calendarList')) return R({ items: google.calendars[at] });
    const m = url.pathname.match(/\/calendars\/(.+)\/events$/);
    if (m) {
      const cal = decodeURIComponent(m[1]);
      if (!google.calendars[at].some((c) => c.id === cal)) return R({}, 404);
      google.eventCalls.push({ cal, at, timeMin: url.searchParams.get('timeMin') });
      return R({ items: google.events[cal] ?? [] });
    }
  }
  throw new Error('Unerwarteter Aufruf: ' + method + ' ' + url.href);
};

const { handler } = await import(join(dir, 'f.mjs'));
const post = async (tok, body) => {
  const res = await handler(
    new Request('https://sb.test/functions/v1/google-kalender', {
      method: 'POST',
      headers: { authorization: tok ? `Bearer ${tok}` : '', apikey: 'pub', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
};
const get = async (q) => handler(new Request('https://sb.test/functions/v1/google-kalender?' + q, { method: 'GET' }));

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? 'OK   ' : 'FAIL ') + msg);
  if (!cond) fails++;
};
const APP = 'https://leibi-tech.github.io/family-planner/';

// 1) ohne Anmeldung
ok((await post(null, { action: 'status' })).status === 401, 'ohne Anmeldung → 401');
// 2) Status: nicht verbunden
ok((await post('tok-tobias', { action: 'status' })).body.connected === false, 'Status: noch nicht verbunden');
// 3) Connect: fremder Haushalt verboten, falsche Rücksprung-Adresse verboten
ok((await post('tok-fremd', { action: 'connect', household: 'H1', returnUrl: APP })).status === 403, 'fremder Haushalt → 403');
ok((await post('tok-tobias', { action: 'connect', household: 'H1', returnUrl: 'https://boese.example/' })).status === 400, 'fremde Rücksprung-Adresse → 400');
const c = await post('tok-tobias', { action: 'connect', household: 'H1', returnUrl: APP + '#x' });
const gurl = new URL(c.body.url);
ok(gurl.host === 'accounts.google.com' && gurl.searchParams.get('access_type') === 'offline' && gurl.searchParams.get('prompt') === 'consent', 'Connect liefert Google-Adresse (offline, consent)');
ok(gurl.searchParams.get('redirect_uri') === 'https://sb.test/functions/v1/google-kalender', 'Rücksprung zur Funktion');
const state = gurl.searchParams.get('state');

// 4) Callback mit gefälschtem state → abgelehnt
const bad = await get('code=code-t&state=' + encodeURIComponent(state.replace(/.$/, (x) => (x === 'A' ? 'B' : 'A'))));
ok(bad.status === 400, 'manipulierter state → abgelehnt');
// 5) Abbruch bei Google
const ab = await get('error=access_denied&state=' + encodeURIComponent(state));
ok(ab.status === 302 && ab.headers.get('location') === APP + '#kalender=abgebrochen', 'Abbruch → zurück in die App mit «abgebrochen»');
// 6) Callback ok
const cb = await get('code=code-t&state=' + encodeURIComponent(state));
ok(cb.status === 302 && cb.headers.get('location') === APP + '#kalender=ok', 'Callback → zurück in die App mit «ok»');
ok(accounts.length === 1 && accounts[0].refresh_token === 'rt-t' && accounts[0].google_email === 'tobias@gmail.com', 'Schlüssel und E-Mail gespeichert');

// 7) Kalenderliste und Auswahl
const cl = await post('tok-tobias', { action: 'calendars' });
ok(cl.body.calendars.length === 2 && cl.body.calendars[0].primary, 'Kalenderliste von Google');
await post('tok-tobias', { action: 'select', calendars: [{ id: 'tobias@gmail.com', name: 'Tobias', kind: 'own' }, { id: 'familie@group', name: 'Familie', kind: 'family' }, { id: 'x', kind: 'böse' }] });
ok(accounts[0].calendars.length === 2, 'Auswahl gespeichert (Ungültiges ignoriert)');
const st = await post('tok-tobias', { action: 'status' });
ok(st.body.connected && st.body.email === 'tobias@gmail.com' && !('refresh_token' in st.body), 'Status ohne Schlüssel');

// 8) Thadea verbindet sich auch
const c2 = await post('tok-thadea', { action: 'connect', household: 'H1', returnUrl: APP });
await get('code=code-th&state=' + encodeURIComponent(new URL(c2.body.url).searchParams.get('state')));
await post('tok-thadea', { action: 'select', calendars: [{ id: 'thadea@gmail.com', name: 'Thadea', kind: 'own' }, { id: 'familie@group', name: 'Familie', kind: 'family' }] });

// 9) Termine holen (aus Sicht Thadea)
google.eventCalls.length = 0;
const ev = await post('tok-thadea', { action: 'events', household: 'H1', from: '2026-10-01T00:00:00Z', to: '2026-12-01T00:00:00Z' });
ok(ev.status === 200, 'Termine: Status 200');
ok(ev.body.events.length === 3, 'drei Termine (abgesagter weggelassen, Familienkalender nur einmal)');
const fam = google.eventCalls.filter((x) => x.cal === 'familie@group');
ok(fam.length === 1 && fam[0].at === 'at-th', 'Familienkalender einmal, mit eigenem Zugang gelesen');
const cals = Object.fromEntries(ev.body.calendars.map((x) => [x.id, x]));
ok(cals['tobias@gmail.com'].personId === 'p-tobias' && !cals['tobias@gmail.com'].mine, 'Kalender Tobias → Person Tobias, nicht «meiner»');
ok(cals['thadea@gmail.com'].mine && cals['familie@group'].kind === 'family', 'eigener Kalender und Familienkalender erkannt');
const ferien = ev.body.events.find((e) => e.id === 'e3');
ok(ferien.allDay && ferien.start === '2026-10-30' && ferien.end === '2026-11-02', 'Ganztägiger Termin richtig');
const hockey = ev.body.events.find((e) => e.id === 'e1');
ok(hockey.start === '2026-10-27T19:00:00+01:00' && hockey.title === 'Hockey' && hockey.link === 'L1', 'Termin mit Zeit');

// 10) Fremder Haushalt kann keine Termine holen
ok((await post('tok-fremd', { action: 'events', household: 'H1', from: '2026-10-01T00:00:00Z', to: '2026-12-01T00:00:00Z' })).status === 403, 'fremder Haushalt → keine Termine');
ok((await post('tok-tobias', { action: 'events', household: 'H1', from: '2026-10-01', to: '2028-10-01' })).status === 400, 'zu langer Zeitraum → 400');

// 11) Abgelaufener Zugang bei Thadea: Tobias sieht trotzdem seine Termine + Hinweis
const th = accounts.find((a) => a.user_id === 'u-thadea');
th.access_token = null;
th.refresh_token = 'rt-widerrufen';
const ev2 = await post('tok-tobias', { action: 'events', household: 'H1', from: '2026-10-01T00:00:00Z', to: '2026-12-01T00:00:00Z' });
ok(ev2.body.events.length === 2 && ev2.body.errors.length === 1 && /thadea@gmail.com/.test(ev2.body.errors[0]), 'abgelaufene Verbindung: Rest kommt, Hinweis mit Konto');

// 12) Trennen
await post('tok-tobias', { action: 'disconnect' });
ok(!accounts.some((a) => a.user_id === 'u-tobias') && google.revoked.includes('rt-t'), 'Trennen: gelöscht und bei Google widerrufen');

console.log(fails ? `FEHLER: ${fails}` : 'ALLE OK');
process.exit(fails ? 1 : 0);
