// v0.34 / APK 1.5: Widget «Termine · 7 Tage». Die App gibt der Hülle die Termine der nächsten 14 Tage
// (FPAndroid.setWidget) und öffnet vom Widget aus den Kalender (?kalender=…, window.fpOpenCalendar).
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const APP = 'http://localhost:8765/docs-test/';
const errs = [];
await ctl('reset');

const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Europe/Zurich' });
await ctx.addInitScript({ content: `window.__widget = []; window.FPAndroid = { saveFile() {}, shareFile() {}, versionCode: () => 99, versionName: () => '1.5 (Build 99)', takeShared: () => '',
  setWidget: (n, j) => window.__widget.push([n, JSON.parse(j)]) };
window.__setMeta = async (k, v) => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__persons = async () => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const q = db.transaction('persons').objectStore('persons').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => a.sort - b.sort)); }); };` });
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(APP); await p.waitForSelector('.tabbar');
const last = () => p.evaluate(() => window.__widget.filter((x) => x[0] === 'termine').pop()?.[1] ?? null);
ok((await last())?.connected === false, 'Ohne Familie/Kalender: Widget bekommt «nicht verbunden»');

const persons = await p.evaluate(() => window.__persons());
const [tobias, thadea] = persons;
await ctl('members', { uA: { role: 'owner', person_id: tobias.id } });
await p.evaluate(() => window.__setMeta('session', { access_token: 'uA:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uA', email: 'uA@x.ch' } }));
await p.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const day = (off) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const at = (off, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, m).toISOString();
await ctl('gcal', {
  accounts: { uB: { email: 'thadea@gmail.com', selected: [{ id: 'thadea@gmail.com', name: 'Thadea', kind: 'own' }] } },
  personOf: { uB: thadea.id },
  events: {
    'thadea@gmail.com': [
      { id: 'b1', title: 'Yoga', allDay: false, start: at(0, 23, 0), end: at(0, 23, 45) },
      { id: 'b2', title: `[${tobias.name}] Elternabend`, allDay: false, start: at(3, 19), end: at(3, 21) },
      { id: 'b3', title: 'Ferien', allDay: true, start: day(5), end: day(7) },
      { id: 'b4', title: 'Viel später', allDay: true, start: day(20), end: day(21) },
    ],
  },
  errors: [],
});
await p.reload(); await p.waitForSelector('.tabbar'); await p.waitForTimeout(1200);
const w = await last();
const rows = w?.rows ?? [];
const find = (n) => rows.filter((r) => r.n === n);
ok(w?.connected === true && w.at > 0, 'Startseite holt Termine → Widget bekommt Daten');
ok(find('Yoga')[0]?.d === day(0) && find('Yoga')[0]?.t === '23:00–23:45' && find('Yoga')[0]?.w === thadea.name, 'Termin heute mit Zeit und Person (' + JSON.stringify(find('Yoga')[0]) + ')');
const ea = find('Elternabend')[0];
ok(ea?.d === day(3) && ea.c.length === 2 && ea.w.includes(tobias.name) && ea.w.includes(thadea.name), 'Titel ohne [Namen], zwei Personen, zwei Farben');
ok(find('Ferien').length === 2 && find('Ferien')[0].d === day(5) && find('Ferien')[0].t.startsWith('ganztägig'), 'Mehrtägiger Termin an jedem Tag');
ok(find('Viel später').length === 0, 'Nur die nächsten 14 Tage');

// Vom Widget geöffnet: bestimmter Tag → Kalender, Tagesansicht
await p.goto(APP + '?kalender=' + day(3)); await p.waitForSelector('.tabbar');
await p.waitForSelector('.cal-dv', { timeout: 8000 });
ok((await p.locator('.topbar h1').innerText()) === 'Kalender' && (await p.locator('.cal-dv-ev:has-text("Elternabend")').count()) >= 1, 'Widget-Zeile antippen → Tagesansicht dieses Tages');
ok(!p.url().includes('kalender='), 'Adresse wieder ohne ?kalender');
// Kopf antippen, App läuft schon
await p.click('.tabbar >> text=Start'); await p.waitForTimeout(200);
ok(await p.evaluate(() => window.fpOpenCalendar('')) === true, 'fpOpenCalendar vorhanden');
await p.waitForTimeout(300);
ok((await p.locator('.topbar h1').innerText()) === 'Kalender', 'Widget-Kopf antippen → Kalender');
await p.click('.tabbar >> text=Start'); await p.waitForTimeout(200);
await p.evaluate((d) => window.fpOpenCalendar(d), day(5)); await p.waitForSelector('.cal-dv', { timeout: 8000 });
ok((await p.locator('.cal-dv-ev:has-text("Ferien"), .cal-dv-chip:has-text("Ferien")').count()) >= 1, 'App läuft schon: Zeile antippen → Tagesansicht');
await ctx.close();

// Im Browser (ohne Hülle): keine Fehler
const c2 = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
const q = await c2.newPage(); q.on('pageerror', (e) => errs.push(String(e)));
await q.goto(APP + '?kalender=1'); await q.waitForSelector('.tabbar');
ok((await q.locator('.topbar h1').innerText()) === 'Kalender', 'Im Browser: ?kalender=1 öffnet den Kalender');
await c2.close();

ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
