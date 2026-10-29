// Minimaler Nachbau von Supabase für Tests: Auth, records (mit Neuere-gewinnt), Mitgliedschaft.
import http from 'node:http';
process.env.TZ = 'Europe/Zurich'; // wie die Handys (für Termin-Zeiten)
const PORT = 8766;
const records = []; // {household_id, store, id, data, updated_at, deleted, owner_id, server_updated_at}
let tick = 0;
const members = {}; // token -> {role, person_id}
const log = [];
const passwords = {}; // E-Mail -> Passwort
const gcal = { accounts: {}, googleList: [], events: {}, personOf: {}, errors: [], connectUrl: '', writes: [], repeats: {}, seq: 0 }; // Kalender-Nachbau
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
  if (p === '/__control/reset') { records.length = 0; delete members.__list; return send(res, 200, {}); }
  if (p === '/__control/passwords') { Object.assign(passwords, body); return send(res, 200, {}); }
  if (p === '/__control/log') return send(res, 200, log);
  if (p === '/__control/gcal') { Object.assign(gcal, body); return send(res, 200, {}); }
  if (p === '/__control/gcal-dump') return send(res, 200, gcal);

  // Nachbau der Funktion «google-kalender» (v0.14)
  if (p === '/functions/v1/google-kalender' && req.method === 'POST') {
    if (!uid) return send(res, 401, { error: 'Bitte zuerst in der App anmelden.' });
    log.push({ uid, op: 'gcal-' + body.action });
    const st = gcal.accounts[uid];
    if (body.action === 'status') return send(res, 200, st ? { connected: true, email: st.email, calendars: st.selected } : { connected: false });
    if (body.action === 'connect') { gcal.accounts[uid] = { email: uid + '@gmail.com', selected: [] }; return send(res, 200, { url: gcal.connectUrl }); }
    if (body.action === 'calendars') return send(res, 200, { email: st.email, calendars: gcal.googleList, selected: st.selected });
    if (body.action === 'select') { st.selected = body.calendars; return send(res, 200, { ok: true, calendars: body.calendars }); }
    if (body.action === 'disconnect') { delete gcal.accounts[uid]; return send(res, 200, { ok: true }); }
    const own = st && st.selected.some((c) => c.id === body.calendarId);
    if (['create', 'update', 'delete', 'master'].includes(body.action) && !own) return send(res, 403, { error: 'Diesen Kalender kannst du nicht ändern (nicht in deiner Auswahl).' });
    const toEv = (e) => {
      const add1 = (d) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
      return e.allDay ? { title: e.title, allDay: true, start: e.startDate, end: add1(e.endDate), location: e.location || null, description: e.description || null }
        : { title: e.title, allDay: false, start: new Date(`${e.startDate}T${e.startTime}:00`).toISOString(), end: new Date(`${e.endDate}T${e.endTime}:00`).toISOString(), location: e.location || null, description: e.description || null };
    };
    const shift = (iso, days, allDay) => { if (allDay) { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + days); return x.toISOString().slice(0, 10); } const x = new Date(iso); x.setDate(x.getDate() + days); return x.toISOString(); };
    if (body.action === 'create') {
      const list = (gcal.events[body.calendarId] ??= []);
      const id = 'n' + (++gcal.seq);
      const base = toEv(body.event);
      gcal.writes.push({ uid, op: 'create', cal: body.calendarId, event: body.event });
      if (body.event.repeat) {
        gcal.repeats[id] = body.event.repeat;
        for (let i = 0; i < 3; i++) list.push({ ...base, id: `${id}_${i}`, recurringEventId: id, start: shift(base.start, i * 7, base.allDay), end: shift(base.end, i * 7, base.allDay) });
      } else list.push({ ...base, id });
      return send(res, 200, { ok: true, id });
    }
    if (body.action === 'master') return send(res, 200, { repeat: gcal.repeats[body.eventId] ?? null });
    if (body.action === 'update') {
      const list = gcal.events[body.calendarId] ?? [];
      gcal.writes.push({ uid, op: 'update', scope: body.scope, id: body.eventId, event: body.event });
      const ne = toEv(body.event);
      if (body.scope === 'all' && body.recurringEventId) {
        for (const e of list.filter((x) => x.recurringEventId === body.recurringEventId)) Object.assign(e, { title: ne.title, location: ne.location, description: ne.description });
        if (body.event.repeat !== undefined) gcal.repeats[body.recurringEventId] = body.event.repeat;
      } else {
        const e = list.find((x) => x.id === body.eventId);
        if (!e) return send(res, 404, { error: 'Diesen Termin gibt es in Google nicht mehr.' });
        Object.assign(e, ne);
      }
      return send(res, 200, { ok: true });
    }
    if (body.action === 'delete') {
      gcal.writes.push({ uid, op: 'delete', scope: body.scope, id: body.eventId });
      const list = gcal.events[body.calendarId] ?? [];
      gcal.events[body.calendarId] = list.filter((x) => (body.scope === 'all' && body.recurringEventId ? x.recurringEventId !== body.recurringEventId : x.id !== body.eventId));
      return send(res, 200, { ok: true });
    }
    if (body.action === 'events') {
      const calendars = []; const events = [];
      for (const [u, a] of Object.entries(gcal.accounts))
        for (const c of a.selected) {
          if (calendars.some((x) => x.id === c.id)) continue;
          calendars.push({ id: c.id, name: c.name, kind: c.kind, personId: c.kind === 'own' ? gcal.personOf[u] ?? members[u]?.person_id ?? null : null, mine: u === uid, writable: u === uid, email: a.email });
          for (const e of gcal.events[c.id] ?? []) if (e.end > body.from && e.start < body.to || e.allDay) events.push({ calendarId: c.id, recurringEventId: null, location: null, description: null, link: 'https://calendar.google.com/x', ...e });
        }
      return send(res, 200, { calendars, events, errors: gcal.errors });
    }
  }

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
  if (p.startsWith('/rest/v1/rpc/household_members') && members.__list) return send(res, 200, Object.entries(members).filter(([u]) => u !== '__list').map(([u, m]) => ({ user_id: u, role: m.role, person_id: m.person_id ?? null, email: null, joined_at: '2026-01-01' })));
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
