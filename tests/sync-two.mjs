import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
// IndexedDB-Helfer im Browser
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__setMeta = async (k, v) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__clearAll = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); return new Promise((res) => { const tx = db.transaction(names, 'readwrite'); names.forEach((n) => tx.objectStore(n).clear()); tx.oncomplete = res; }); };
window.__markDirty = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); for (const n of names) { const all = await window.__all(n); await new Promise((res) => { const tx = db.transaction(n, 'readwrite'); all.forEach((r) => tx.objectStore(n).put({ ...r, dirty: true })); tx.oncomplete = res; }); } };
`;



const mk = async () => { const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' }); await ctx.addInitScript({ content: helpers }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar'); return { ctx, p }; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
await ctl('reset');

const A = await mk(); const B = await mk();
const persons = (await A.p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const pA = persons[0].id, pB = persons[1].id;
const sess = (uid) => ({ access_token: uid + ':tok', refresh_token: 'r', expires_at: 4102444800, user: { id: uid, email: uid + '@x.ch' } });
const hh = { id: 'hh1', name: 'Test' };
await ctl('members', { uA: { role: 'owner', person_id: pA }, uB: { role: 'member', person_id: pB } });

await A.p.evaluate(async ([s, h]) => { await window.__setMeta('session', s); await window.__setMeta('household', h); await window.__markDirty(); }, [sess('uA'), hh]);
await A.p.reload(); await A.p.waitForSelector('.tabbar'); await A.p.waitForTimeout(2500);
await B.p.evaluate(async ([s, h]) => { await window.__clearAll(); await window.__setMeta('session', s); await window.__setMeta('household', h); }, [sess('uB'), hh]);
await B.p.reload(); await B.p.waitForSelector('.tabbar'); await B.p.waitForTimeout(2500);
const bPersons = await B.p.evaluate(() => window.__all('persons'));
ok(bPersons.length === 4 && bPersons.some((p) => p.id === pB), 'B hat die Personen von A erhalten');

const sync = async (...ps) => { for (const p of ps) { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1800); } };
const items = async (p, title) => (await p.evaluate(() => window.__all('notes'))).filter((n) => n.title === title && !n.deleted).flatMap((n) => n.items.filter((i) => !i.deleted).map((i) => i.text + (i.done ? '✓' : '')));

// 1) A erstellt gemeinsame Liste
await A.p.click('.tabbar >> text=Notizen'); await B.p.click('.tabbar >> text=Notizen');
await A.p.click('text=+ Liste');
await A.p.fill('.note-title-input', 'Hof');
for (const t of ['Brot', 'Butter', 'Käse']) { await A.p.fill('input[aria-label="Neuer Punkt"]', t); await A.p.keyboard.press('Enter'); }
await A.p.waitForTimeout(900);
await A.p.click('text=‹ Zurück');
await sync(A.p, B.p);
ok(await B.p.locator('.note-card', { hasText: 'Hof' }).count() === 1, 'B sieht die Liste von A');

// 2) gleichzeitig ändern: B offline
await B.ctx.setOffline(true);
await B.p.locator('.note-card', { hasText: 'Hof' }).click();
await B.p.fill('input[aria-label="Neuer Punkt"]', 'Eier'); await B.p.keyboard.press('Enter');
await B.p.locator('.ni-group', { hasText: 'Butter' }).locator('.ni-row:not(.sub) .todo-check').click();
await B.p.waitForTimeout(800);
await A.p.locator('.note-card', { hasText: 'Hof' }).click();
await A.p.fill('input[aria-label="Neuer Punkt"]', 'Milch'); await A.p.keyboard.press('Enter');
await A.p.locator('.ni-group', { hasText: 'Brot' }).locator('.ni-row:not(.sub) .todo-check').click();
await A.p.waitForTimeout(3500);
await B.ctx.setOffline(false);
await sync(B.p, A.p); await sync(A.p, B.p);
const ia = (await items(A.p, 'Hof')).sort(), ib = (await items(B.p, 'Hof')).sort();
console.log('A:', ia.join(', ')); console.log('B:', ib.join(', '));
const want = ['Brot✓', 'Butter✓', 'Eier', 'Käse', 'Milch'];
ok(JSON.stringify(ia) === JSON.stringify(want), 'A hat alle Änderungen zusammengeführt');
ok(JSON.stringify(ib) === JSON.stringify(want), 'B hat alle Änderungen zusammengeführt');
// B sieht live in der offenen Liste
ok(await B.p.locator('.ni-text', { hasText: 'Milch' }).count() === 1, 'B sieht «Milch» live in der offenen Liste');

// 3) Pin für alle
await A.p.click('button[aria-label="Anheften"]'); await A.p.click('text=Für alle anheften'); await A.p.waitForTimeout(600);
await A.p.click('text=‹ Zurück');
await sync(A.p, B.p);
const pinsB = (await B.p.evaluate(() => window.__all('notes'))).find((n) => n.title === 'Hof').pins;
ok(pinsB[pB]?.on === true && pinsB[pA]?.on === true, 'Pin für alle: bei B angeheftet');
// B löst bei sich
await B.p.click('text=‹ Zurück'); await B.p.locator('.note-card', { hasText: 'Hof' }).click();
await B.p.click('button[aria-label="Anheften"]'); await B.p.click('text=Bei mir lösen'); await B.p.waitForTimeout(600);
await B.p.click('text=‹ Zurück');
await sync(B.p, A.p);
const pinsA = (await A.p.evaluate(() => window.__all('notes'))).find((n) => n.title === 'Hof').pins;
ok(pinsA[pB]?.on === false && pinsA[pA]?.on === true, 'B hat bei sich gelöst, A bleibt angeheftet');

// 4) Private Notiz von A
await A.p.click('text=+ Notiz'); await A.p.fill('.note-title-input', 'Geheim'); await A.p.fill('.note-body', 'Überraschung');
await A.p.waitForTimeout(900);
await A.p.click('button[aria-label="Für alle sichtbar"]'); await A.p.click('text=Privat machen'); await A.p.waitForTimeout(800);
await A.p.click('text=‹ Zurück');
await sync(A.p, B.p);
ok((await B.p.evaluate(() => window.__all('notes'))).every((n) => n.title !== 'Geheim'), 'B sieht die private Notiz nicht');
let dump = await (await fetch('http://localhost:8766/__control/dump')).json();
const priv = dump.filter((r) => r.store === 'notes' && r.data.title === 'Geheim' && !r.deleted);
ok(priv.length === 1 && priv[0].owner_id === 'uA', 'Server: private Notiz gehört A');
const leaked = dump.filter((r) => r.store === 'notes' && !r.owner_id && JSON.stringify(r.data).includes('Überraschung'));
ok(leaked.length === 0, 'Server: kein Inhalt der privaten Notiz in geteilten Einträgen');

// 5) Geteilt -> privat: alter Eintrag ohne Inhalt
await A.p.click('text=+ Notiz'); await A.p.fill('.note-title-input', 'Erst offen'); await A.p.fill('.note-body', 'Geheimtext2');
await A.p.waitForTimeout(900); await A.p.click('text=‹ Zurück'); await sync(A.p, B.p);
ok((await B.p.evaluate(() => window.__all('notes'))).some((n) => n.title === 'Erst offen'), 'B sieht die geteilte Notiz');
await A.p.locator('.note-card', { hasText: 'Erst offen' }).click();
await A.p.click('button[aria-label="Für alle sichtbar"]'); await A.p.click('text=Privat machen'); await A.p.waitForTimeout(800);
await A.p.click('text=‹ Zurück'); await sync(A.p, B.p);
ok((await B.p.evaluate(() => window.__all('notes'))).filter((n) => n.title === 'Erst offen' && !n.deleted).length === 0, 'B sieht die Notiz nach «privat» nicht mehr');
dump = await (await fetch('http://localhost:8766/__control/dump')).json();
ok(dump.filter((r) => !r.owner_id && JSON.stringify(r.data).includes('Geheimtext2')).length === 0, 'Server: alter geteilter Eintrag enthält den Text nicht mehr');

console.log('Fehler:', errs);
await b.close();
