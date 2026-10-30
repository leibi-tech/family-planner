// Liebesgruss (v0.20): A schickt B Text + Foto, B muss reagieren, A sieht die Reaktion. Album und Ausdünnen.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__put = async (s, recs) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction(s, 'readwrite'); recs.forEach((r) => tx.objectStore(s).put(r)); tx.oncomplete = res; }); };
window.__setMeta = async (k, v) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__clearAll = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); return new Promise((res) => { const tx = db.transaction(names, 'readwrite'); names.forEach((n) => tx.objectStore(n).clear()); tx.oncomplete = res; }); };
window.__markDirty = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); for (const n of names) { const all = await window.__all(n); await new Promise((res) => { const tx = db.transaction(n, 'readwrite'); all.forEach((r) => tx.objectStore(n).put({ ...r, dirty: true })); tx.oncomplete = res; }); } };
`;
const mk = async () => { const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' }); await ctx.addInitScript({ content: helpers }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('dialog', (d) => d.accept()); await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar'); return { ctx, p }; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
await ctl('reset');

const A = await mk(); const B = await mk();
const persons = (await A.p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const pA = persons[0].id, pB = persons[1].id, nameB = persons[1].name;
const sess = (uid) => ({ access_token: uid + ':tok', refresh_token: 'r', expires_at: 4102444800, user: { id: uid, email: uid + '@x.ch' } });
const hh = { id: 'hh1', name: 'Test' };
await ctl('members', { __list: true, uA: { role: 'owner', person_id: pA }, uB: { role: 'member', person_id: pB } });
await A.p.evaluate(async ([s, h]) => { await window.__setMeta('session', s); await window.__setMeta('household', h); await window.__markDirty(); }, [sess('uA'), hh]);
await A.p.reload(); await A.p.waitForSelector('.tabbar'); await A.p.waitForTimeout(2500);
await B.p.evaluate(async ([s, h]) => { await window.__clearAll(); await window.__setMeta('session', s); await window.__setMeta('household', h); }, [sess('uB'), hh]);
await B.p.reload(); await B.p.waitForSelector('.tabbar'); await B.p.waitForTimeout(2500);
const sync = async (...ps) => { for (const p of ps) { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1800); } };

// 1) A sendet Text + Foto
await A.p.waitForSelector('.greet-card');
ok(await A.p.locator('.greet-card button', { hasText: `Gruss an ${nameB} senden` }).count() === 1, 'Startseite: Knopf «Gruss an … senden» (nur Person mit Konto)');
ok(await A.p.locator('.greet-card button', { hasText: 'Kind 1' }).count() === 0, 'Kinder ohne Konto stehen nicht zur Wahl');
await A.p.click(`text=Gruss an ${nameB} senden`);
ok(await A.p.locator('button:has-text("Senden 💌")').isDisabled(), 'Senden erst mit Text oder Foto');
await A.p.fill('.greet-input', 'Schönen Tag, Schatz!');
// Testbild 1600x1200 (wird auf 1080 verkleinert)
const png = await A.p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#e33'; x.fillRect(0, 0, 1600, 1200); return c.toDataURL('image/png').split(',')[1]; });
await A.p.setInputFiles('input[type=file]', { name: 'herz.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await A.p.waitForSelector('.greet-preview img');
await A.p.click('button:has-text("Senden 💌")');
await A.p.waitForTimeout(500);
const sent = (await A.p.evaluate(() => window.__all('greetings')))[0];
const dim = await A.p.evaluate((src) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = src; }), sent.photo);
ok(sent.photo.startsWith('data:image/jpeg') && dim[0] === 1080 && dim[1] === 810, 'Foto verkleinert auf ' + dim.join('x') + ', ' + Math.round(sent.photo.length / 1024) + ' KB');
ok(await A.p.locator('.greet-waiting', { hasText: 'wartet auf Reaktion' }).count() === 1, 'A: «wartet auf Reaktion», kein zweiter Gruss möglich');
ok(await A.p.locator('.greet-card button', { hasText: 'senden' }).count() === 0, 'A: Senden-Knopf weg, solange offen');
ok(await A.p.locator('.greet-gate').count() === 0, 'A selbst wird nicht blockiert');

// 2) B bekommt den Gruss als Vollbild und kann die App nicht nutzen
await sync(A.p, B.p);
await B.p.waitForSelector('.greet-gate', { timeout: 5000 });
ok((await B.p.locator('.greet-gate').innerText()).includes('Schönen Tag, Schatz!'), 'B: Vollbild mit Text');
ok(await B.p.locator('.greet-gate img.greet-photo').count() === 1, 'B: Foto sichtbar');
ok(await B.p.locator('.greet-react').count() === 4, 'B: 4 Emojis');
let blocked = false;
try { await B.p.click('.tabbar >> text=Mehr', { timeout: 1200 }); } catch { blocked = true; }
ok(blocked, 'B: Menüleiste gesperrt, bis reagiert ist');
// Neu laden: Gruss bleibt
await B.p.reload(); await B.p.waitForSelector('.greet-gate');
ok(true, 'B: Gruss erscheint auch nach dem Neuöffnen wieder');
await B.p.click('button[aria-label="Herz"]');
await B.p.waitForTimeout(400);
ok(await B.p.locator('.greet-gate').count() === 0, 'B: nach ❤️ ist die App frei');
ok(await B.p.locator('.greet-waiting').count() === 0 && await B.p.locator('.greet-card button', { hasText: `Gruss an ${persons[0].name} senden` }).count() === 1, 'B kann selber einen Gruss an A senden');

// 3) A sieht die Reaktion
await sync(B.p, A.p);
const reply = A.p.locator('.greet-reply');
ok(await reply.count() === 1 && (await reply.innerText()).includes(`${nameB} hat mit ❤️ reagiert`), 'A: «… hat mit ❤️ reagiert» auf der Startseite');
ok(await A.p.locator('.greet-card button', { hasText: `Gruss an ${nameB} senden` }).count() === 1, 'A: Senden wieder möglich');
await A.p.click('button[aria-label="Reaktion ausblenden"]'); await A.p.waitForTimeout(300);
ok(await A.p.locator('.greet-reply').count() === 0, 'A: Reaktion mit ✕ ausgeblendet');

// 4) Album
await A.p.click('.greet-card >> text=Album ›');
await A.p.waitForSelector('.greet-album');
ok(await A.p.locator('.greet-tile').count() === 1 && (await A.p.locator('.greet-tile').innerText()).includes('❤️'), 'Album: 1 Gruss mit ❤️');
await A.p.click('.greet-tile'); await A.p.waitForSelector('.sheet .greet-photo');
ok((await A.p.locator('.sheet').innerText()).includes('Schönen Tag'), 'Album: Gruss gross ansehen');
await A.p.click('.sheet >> text=Schliessen');
ok((await A.p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'kein seitliches Wischen');

// 5) Ausdünnen: 120 alte Grüsse -> höchstens 100, neuste 50 alle da, ältester bleibt
const base = Date.now() - 200 * 86400000;
const many = Array.from({ length: 120 }, (_, i) => ({ id: 'g' + String(i).padStart(3, '0'), from: pA, to: pB, text: 'Nr ' + i, photo: null, sentAt: base + i * 86400000, reaction: '👍', reactedAt: base + i * 86400000, seen: true, updatedAt: base, deleted: false }));
await A.p.evaluate((g) => window.__put('greetings', g), many);
await A.p.reload(); await A.p.waitForSelector('.tabbar'); await A.p.waitForTimeout(1200);
const left = (await A.p.evaluate(() => window.__all('greetings'))).filter((g) => !g.deleted);
const ids = new Set(left.map((g) => g.id));
ok(left.length <= 100 && left.length >= 70, 'Album ausgedünnt: ' + left.length + ' von 121');
ok(many.slice(-50).every((g) => ids.has(g.id)) && ids.has(sent.id), 'die neusten 50 sind alle noch da');
ok(ids.has('g000'), 'der älteste Gruss bleibt');
ok(!ids.has('g001'), 'jeder zweite ältere ist weg');
await sync(A.p);
const dump = (await (await fetch('http://localhost:8766/__control/dump')).json()).filter((r) => r.store === 'greetings' && r.deleted);
ok(dump.length === 121 - left.length && dump.every((r) => r.data.photo === null && r.data.text === ''), 'Server: ' + dump.length + ' gelöscht, ohne Inhalt');

console.log('Fehler:', errs);
ok(errs.length === 0, 'keine Fehler im Browser');
await b.close();
