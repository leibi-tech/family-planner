// v0.36 / APK 1.6: Widget «ToDos». Die App gibt der Hülle die offenen ToDos (meine inkl. Google und
// die ohne Zuteilung), überfällige zuerst (FPAndroid.setWidget('todos', …)). Antippen öffnet das ToDo
// (?todo=<ID> beim Start, window.fpOpenTodo bei laufender App).
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const APP = 'http://localhost:8765/docs-test/';
const errs = [];
await ctl('reset');
await ctl('gtasks', {});

const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Europe/Zurich' });
await ctx.addInitScript({ content: `window.__widget = []; window.FPAndroid = { saveFile() {}, shareFile() {}, versionCode: () => 99, versionName: () => '1.6 (Build 99)', takeShared: () => '',
  setWidget: (n, j) => window.__widget.push([n, JSON.parse(j)]) };
window.__idb = () => new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); });
window.__setMeta = async (k, v) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__put = async (s, recs) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction(s, 'readwrite'); recs.forEach((r) => tx.objectStore(s).put(r)); tx.oncomplete = res; }); };` });
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(APP); await p.waitForSelector('.tabbar'); await p.waitForTimeout(800);
const last = () => p.evaluate(() => window.__widget.filter((x) => x[0] === 'todos').pop()?.[1] ?? null);
ok(Array.isArray((await last())?.rows), 'Beim Start bekommt das Widget die ToDos');

const persons = (await p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const [tobias, thadea] = persons;
await ctl('members', { uA: { role: 'owner', person_id: tobias.id } });
await p.evaluate(() => window.__setMeta('session', { access_token: 'uA:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uA', email: 'uA@x.ch' } }));
await p.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));
await ctl('gcal', { accounts: { uA: { email: 'tobias@gmail.com', selected: [] } }, events: {}, errors: [] });
const pad = (n) => String(n).padStart(2, '0');
const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
await ctl('gtasks', { uA: { state: 'ok', lists: [{ id: 'L1', title: 'Meine Aufgaben' }], tasks: [
  { id: 'g1', listId: 'L1', title: 'Google heute', notes: '', due: day(0), done: false, completedAt: null, updated: '2026-11-01T10:00:00Z' },
  { id: 'g2', listId: 'L1', title: 'Google erledigt', notes: '', due: null, done: true, completedAt: '2026-11-01T10:00:00Z', updated: '2026-11-01T10:00:00Z' },
] } });
const todo = (id, title, extra) => ({ id, title, note: '', due: null, assignees: [], private: false, createdBy: thadea.id, createdAt: Date.now(), done: false, doneAt: null, doneBy: null, updatedAt: Date.now(), deleted: false, dirty: true, ...extra });
await p.evaluate((recs) => window.__put('todos', recs), [
  todo('t1', 'Rechnung zahlen', { assignees: [tobias.id], due: day(-2) }),
  todo('t2', 'Keller aufräumen', {}),
  todo('t3', 'Nur Thadea', { assignees: [thadea.id] }),
  todo('t4', 'Schon erledigt', { assignees: [tobias.id], done: true, doneAt: Date.now() }),
  todo('t5', 'Velo flicken', { assignees: [tobias.id, thadea.id], due: day(1) }),
]);
await p.reload(); await p.waitForSelector('.tabbar'); await p.waitForTimeout(1500);
let w = await last();
const names = (w?.rows ?? []).map((r) => r.n);
ok(JSON.stringify(names) === JSON.stringify(['Rechnung zahlen', 'Google heute', 'Velo flicken', 'Keller aufräumen']), 'Meine + ohne Zuteilung + Google, überfällige zuerst (' + names.join(', ') + ')');
const r = (n) => w.rows.find((x) => x.n === n);
ok(r('Rechnung zahlen').d === day(-2) && r('Rechnung zahlen').w === tobias.name && r('Rechnung zahlen').c.length === 1, 'Fälligkeit, Person und Farbe');
ok(r('Velo flicken').c.length === 2 && r('Velo flicken').w.includes(thadea.name), 'Zwei Personen → zwei Farben');
ok(r('Keller aufräumen').w === 'alle' && r('Keller aufräumen').d === '', 'Ohne Zuteilung: «alle», ohne Datum');
ok(r('Google heute').g === true && r('Google heute').id === 'g:g1', 'Google-ToDo mit Kennzeichen');
ok(w.more === 0, 'Keine weiteren');

// Neues ToDo in der App → Widget gleich nachgeführt
await p.click('.tabbar >> text=ToDo'); await p.waitForTimeout(300);
await p.fill('.quick-add input', 'Milch holen'); await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
w = await last();
ok(w.rows.some((x) => x.n === 'Milch holen'), 'Neues ToDo erscheint im Widget');
// Abhaken in der App → verschwindet aus dem Widget
await p.locator('.todo-list .todo', { hasText: 'Rechnung zahlen' }).locator('.todo-check').click();
await p.waitForTimeout(1200);
w = await last();
ok(!w.rows.some((x) => x.n === 'Rechnung zahlen'), 'In der App abgehakt → weg aus dem Widget');

// Vom Widget geöffnet (App startet neu): bestimmtes ToDo
await p.goto(APP + '?todo=t5'); await p.waitForSelector('.tabbar');
await p.waitForSelector('.sheet h2:has-text("ToDo bearbeiten")', { timeout: 8000 });
ok((await p.locator('.sheet input').first().inputValue()) === 'Velo flicken', 'Widget-Zeile antippen → dieses ToDo öffnet sich');
ok(!p.url().includes('todo='), 'Adresse wieder ohne ?todo');
// Google-ToDo beim Start
await p.goto(APP + '?todo=' + encodeURIComponent('g:g1')); await p.waitForSelector('.tabbar');
await p.waitForSelector('.sheet h2', { timeout: 8000 });
ok((await p.locator('.sheet input').first().inputValue()) === 'Google heute', 'Google-ToDo vom Widget aus öffnen');
await p.goto(APP + '?todo=1'); await p.waitForSelector('.tabbar'); await p.waitForTimeout(300);
ok((await p.locator('.topbar h1').innerText()).startsWith('ToDo') && (await p.locator('.sheet').count()) === 0, 'Widget-Kopf antippen → ToDo-Seite');
// App läuft schon
await p.click('.tabbar >> text=Start'); await p.waitForTimeout(300);
ok(await p.evaluate(() => window.fpOpenTodo('t2')) === true, 'fpOpenTodo vorhanden');
await p.waitForSelector('.sheet h2', { timeout: 8000 });
ok((await p.locator('.sheet input').first().inputValue()) === 'Keller aufräumen', 'App läuft schon: Zeile antippen → ToDo öffnet sich');
await ctx.close();

// Im Browser (ohne Hülle): ?todo=1 öffnet die ToDo-Seite, keine Fehler
const c2 = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(String(e)));
await q.goto(APP + '?todo=1'); await q.waitForSelector('.tabbar'); await q.waitForTimeout(300);
ok((await q.locator('.topbar h1').innerText()).startsWith('ToDo'), 'Im Browser: ?todo=1 öffnet die ToDo-Seite');
await c2.close();

ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
