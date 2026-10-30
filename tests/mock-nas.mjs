// Nachbau eines Synology NAS (DSM Web API: Anmeldung und File Station) für die Tests.
// Läuft auf Port 8768 (ohne Freigabe für Browser, wie der echte NAS).
// Davor läuft in den Tests das echte Hilfsprogramm nas/nginx.conf auf Port 8767.
// Ist nginx nicht installiert: mit NAS_CORS=1 setzt der Nachbau die Freigabe selbst und läuft auf 8767.
// Steuerung (nur direkt, nicht über das Hilfsprogramm): POST /__control/reset, /__control/expire, GET /__control/state
import { createServer } from 'node:http';

const CORS = process.env.NAS_CORS === '1';
const PORT = Number(process.env.NAS_PORT || (CORS ? 8767 : 8768));

let users, sids, dids, files, folders, log;
function reset() {
  users = { app: { pw: 'geheim-123', otp: '123456' }, ohne2fa: { pw: 'pw-ohne' } };
  sids = new Map(); // sid → user
  dids = new Map(); // did → user
  files = new Map(); // path → { data: Buffer, type, mtime }
  folders = new Set(['/Familien-Dokumente']);
  log = [];
}
reset();

const json = (res, obj, status = 200) => {
  const h = { 'Content-Type': 'application/json' };
  if (CORS) h['Access-Control-Allow-Origin'] = '*';
  res.writeHead(status, h);
  res.end(JSON.stringify(obj));
};
const fail = (res, code) => json(res, { success: false, error: { code } });
const rnd = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const body = await readBody(req);

  if (url.pathname.startsWith('/__control/')) {
    const what = url.pathname.slice(11);
    if (what === 'reset') reset();
    if (what === 'expire') sids.clear();
    return json(res, { ok: true, sids: sids.size, files: [...files.keys()], folders: [...folders], log });
  }

  if (url.pathname !== '/webapi/entry.cgi') return json(res, { error: 'nicht gefunden' }, 404);

  // Angaben aus Adresse, Formular oder Multipart zusammenführen
  const p = Object.fromEntries(url.searchParams);
  let upload = null;
  const ct = req.headers['content-type'] || '';
  if (req.method === 'POST' && ct.startsWith('application/x-www-form-urlencoded')) Object.assign(p, Object.fromEntries(new URLSearchParams(body.toString())));
  if (req.method === 'POST' && ct.startsWith('multipart/form-data')) {
    const fd = await new Request('http://x', { method: 'POST', headers: { 'content-type': ct }, body }).formData();
    for (const [k, v] of fd) {
      if (typeof v === 'string') p[k] = v;
      else upload = { name: v.name, type: v.type, data: Buffer.from(await v.arrayBuffer()) };
    }
  }
  log.push({ api: p.api, method: p.method, hasPasswordInUrl: url.searchParams.has('passwd'), xff: req.headers['x-forwarded-for'] || null });

  if (p.api === 'SYNO.API.Auth') {
    if (p.method === 'login') {
      const u = users[p.account];
      if (!u || u.pw !== p.passwd) return fail(res, 400);
      let did;
      if (u.otp) {
        const trusted = p.device_id && dids.get(p.device_id) === p.account;
        if (!trusted) {
          if (!p.otp_code) return fail(res, 403);
          if (p.otp_code !== u.otp) return fail(res, 404);
          if (p.enable_device_token === 'yes') {
            did = 'did-' + rnd();
            dids.set(did, p.account);
          }
        }
      }
      const sid = 'sid-' + rnd();
      sids.set(sid, p.account);
      return json(res, { success: true, data: { sid, ...(did ? { did } : {}) } });
    }
    if (p.method === 'logout') {
      sids.delete(p._sid);
      return json(res, { success: true });
    }
  }

  if (!p._sid || !sids.has(p._sid)) return fail(res, 119);

  if (p.api === 'SYNO.FileStation.List' && p.method === 'list') {
    const folder = p.folder_path;
    if (!folders.has(folder)) return fail(res, 408);
    const list = [...files.entries()]
      .filter(([path]) => path.slice(0, path.lastIndexOf('/')) === folder)
      .map(([path, f]) => ({ name: path.split('/').pop(), path, isdir: false, additional: { size: f.data.length, time: { mtime: f.mtime } } }))
      .sort((a, b) => b.additional.time.mtime - a.additional.time.mtime);
    return json(res, { success: true, data: { files: list, total: list.length, offset: 0 } });
  }

  if (p.api === 'SYNO.FileStation.Upload' && p.method === 'upload') {
    if (!upload) return fail(res, 401);
    if (!p.path || !p.path.startsWith('/Familien-Dokumente')) return fail(res, 105);
    if (!folders.has(p.path)) {
      if (p.create_parents !== 'true') return fail(res, 408);
      folders.add(p.path);
    }
    const path = p.path + '/' + upload.name;
    if (files.has(path) && p.overwrite !== 'true') return fail(res, 414);
    files.set(path, { data: upload.data, type: upload.type, mtime: Math.floor(Date.now() / 1000) + files.size });
    return json(res, { success: true, data: {} });
  }

  if (p.api === 'SYNO.FileStation.Delete' && p.method === 'delete') {
    for (const path of JSON.parse(p.path || '[]')) files.delete(path);
    return json(res, { success: true, data: {} });
  }

  if (p.api === 'SYNO.FileStation.Thumb' || p.api === 'SYNO.FileStation.Download') {
    const f = files.get(p.path);
    if (!f) return fail(res, 408);
    const h = { 'Content-Type': f.type || 'application/octet-stream' };
    if (CORS) h['Access-Control-Allow-Origin'] = '*';
    res.writeHead(200, h);
    return res.end(f.data);
  }

  return fail(res, 103);
}).listen(PORT, () => console.log('NAS-Nachbau auf Port ' + PORT + (CORS ? ' (mit Freigabe)' : '')));
