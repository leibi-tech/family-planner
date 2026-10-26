// Minimaler Nachbau von Supabase für Tests: Auth, records (mit Neuere-gewinnt), Mitgliedschaft.
import http from 'node:http';
const PORT = 8766;
const records = []; // {household_id, store, id, data, updated_at, deleted, owner_id, server_updated_at}
let tick = 0;
const members = {}; // token -> {role, person_id}
const log = [];
const passwords = {}; // E-Mail -> Passwort
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const send = (res, code, body) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const uidOf = (req) => (req.headers.authorization || '').replace('Bearer ', '').split(':')[0];

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const url = new URL(req.url, 'http://x');
  let raw = ''; for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : null;
  const uid = uidOf(req);
  const p = url.pathname;

  if (p === '/__control/members') { Object.assign(members, body); return send(res, 200, {}); }
  if (p === '/__control/dump') return send(res, 200, records);
  if (p === '/__control/reset') { records.length = 0; return send(res, 200, {}); }
  if (p === '/__control/passwords') { Object.assign(passwords, body); return send(res, 200, {}); }
  if (p === '/__control/log') return send(res, 200, log);

  if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    if (passwords[body.email] !== body.password) return send(res, 400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return send(res, 200, { access_token: body.email.split('@')[0] + ':tok', refresh_token: 'r', expires_in: 3600, user: { id: body.email.split('@')[0], email: body.email } });
  }
  if (p === '/auth/v1/user' && req.method === 'PUT') {
    const email = uid + '@x.ch';
    log.push({ uid, op: 'password-change' });
    if (body.password === passwords[email]) return send(res, 422, { error_code: 'same_password', msg: 'New password should be different from the old password.' });
    if (body.password.length < 6) return send(res, 422, { error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
    passwords[email] = body.password;
    return send(res, 200, { id: uid, email });
  }
  if (p.startsWith('/rest/v1/rpc/my_membership')) return send(res, 200, members[uid] ? [members[uid]] : []);
  if (p === '/rest/v1/records' && req.method === 'POST') {
    const rows = Array.isArray(body) ? body : [body];
    const keys = new Set(rows.map((r) => Object.keys(r).sort().join()));
    if (keys.size > 1) return send(res, 400, { message: 'All object keys must match' });
    for (const r of rows) {
      log.push({ uid, op: 'push', store: r.store, id: r.id, ua: r.updated_at });
      const cur = records.find((x) => x.household_id === r.household_id && x.store === r.store && x.id === r.id);
      if (cur) {
        if (cur.owner_id && cur.owner_id !== uid) return send(res, 403, { message: 'RLS' });
        if (r.updated_at < cur.updated_at) continue; // ältere Änderung ignorieren
        Object.assign(cur, r, { server_updated_at: new Date(Date.now() + ++tick).toISOString() });
      } else {
        records.push({ owner_id: null, ...r, server_updated_at: new Date(Date.now() + ++tick).toISOString() });
      }
    }
    return send(res, 201);
  }
  if (p === '/rest/v1/records' && req.method === 'GET') {
    const q = url.searchParams;
    let rows = records.filter((r) => !r.owner_id || r.owner_id === uid);
    const hh = q.get('household_id'); if (hh) rows = rows.filter((r) => r.household_id === hh.replace('eq.', ''));
    const st = q.get('store'); if (st) rows = rows.filter((r) => r.store === st.replace('eq.', ''));
    const idf = q.get('id');
    if (idf) { const ids = [...idf.matchAll(/"([^"]+)"/g)].map((m) => m[1]); rows = rows.filter((r) => ids.includes(r.id)); log.push({ uid, op: 'fetch', ids }); }
    const since = q.get('server_updated_at'); if (since) rows = rows.filter((r) => r.server_updated_at > since.replace('gt.', ''));
    rows.sort((a, b) => (a.server_updated_at < b.server_updated_at ? -1 : 1));
    return send(res, 200, rows.slice(0, Number(q.get('limit') || 1000)));
  }
  return send(res, 404, { message: 'not mocked ' + p });
}).listen(PORT, () => console.log('mock on', PORT));
