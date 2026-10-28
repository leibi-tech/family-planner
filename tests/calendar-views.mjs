// Kalender v0.16: Monat / Woche / Tag (immer auf heute), Ansicht merken, Tagesansicht mit Spalte pro Person,
// Termine mit mehreren Personen mehrfarbig, mit allen Personen grün (Familie).
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const APP = 'http://localhost:8765/docs-test/';
await ctl('reset');

const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Europe/Zurich' });
await ctx.addInitScript({ content: `window.__setMeta = async (k, v) => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__persons = async () => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const q = db.transaction('persons').objectStore('persons').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => a.sort - b.sort)); }); };` });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

await p.goto(APP);
await p.waitForSelector('.tabbar');
const persons = await p.evaluate(() => window.__persons());
const [tobias, frau, kind1, kind2] = persons;
await ctl('members', { uA: { role: 'owner', person_id: tobias.id } });
await p.evaluate(() => window.__setMeta('session', { access_token: 'uA:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uA', email: 'uA@x.ch' } }));
await p.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const day = (off) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const at = (off, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, m).toISOString();
await ctl('gcal', {
  accounts: {
    uA: { email: 'tobias@gmail.com', selected: [{ id: 'tobias@gmail.com', name: 'Tobias', kind: 'own' }, { id: 'familie@group', name: 'Familie', kind: 'family' }] },
    uB: { email: 'thadea@gmail.com', selected: [{ id: 'thadea@gmail.com', name: 'Thadea', kind: 'own' }] },
  },
  personOf: { uA: tobias.id, uB: frau.id },
  events: {
    'tobias@gmail.com': [
      { id: 't1', title: `[${frau.name}] Test`, allDay: false, start: at(0, 10), end: at(0, 11) },
      { id: 't2', title: `[${frau.name}, ${kind1.name}, ${kind2.name}] Ausflug`, allDay: false, start: at(0, 14), end: at(0, 16) },
      { id: 't3', title: 'Hockey', allDay: false, start: at(0, 19), end: at(0, 21) },
      { id: 't4', title: 'Sitzung', allDay: false, start: at(0, 19), end: at(0, 19, 30) },
    ],
    'thadea@gmail.com': [{ id: 'y1', title: 'Yoga', allDay: false, start: at(0, 19, 30), end: at(0, 20, 30) }],
    'familie@group': [{ id: 'f1', title: 'Ferien', allDay: true, start: day(0), end: day(1) }],
  },
  writes: [],
  repeats: {},
});
await p.reload();
await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForSelector('.cal-ev:has-text("Yoga")');
const bg = (sel) => p.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundImage + '|' + getComputedStyle(el).backgroundColor);
const GREEN = 'rgb(47, 125, 91)';

// 1) Monat: Farben
ok((await p.locator('.cal-views button.on').innerText()) === 'Monat', 'startet in der Monatsansicht');
const testBar = await bg('.cal-cell.today .cal-bar:has-text("Test")');
ok(testBar.includes('linear-gradient') && testBar.includes('rgb(47, 125, 209)'), 'Termin für mich + Frau: Balken zweifarbig (' + testBar + ')');
const ausflugBar = await bg('.cal-cell.today .cal-bar:has-text("Ausflug")');
ok(ausflugBar.startsWith('none|') && ausflugBar.endsWith(GREEN), 'Termin mit allen Personen: grün wie Familie');
ok((await bg('.cal-ev:has-text("Test") .cal-ev-stripe')).includes('linear-gradient'), 'Tagesliste: Streifen links zweifarbig');
ok((await p.locator('.cal-ev:has-text("Ausflug") .cal-ev-sub').innerText()) === 'Familie (alle)', 'Ausflug: «Familie (alle)»');
await p.click('.cal-ev:has-text("Test")');
ok((await bg('.sheet .cal-detail-stripe')).includes('linear-gradient'), 'Termin-Ansicht: Streifen zweifarbig');
await p.click('.sheet button:has-text("Schliessen")');

// 2) Woche
await p.click('.cal-views >> text=Woche');
ok((await p.locator('.cal-wday').count()) === 7, 'Woche: 7 Tage untereinander');
ok((await p.locator('.cal-navtitle').innerText()).startsWith('KW '), 'Woche: Titel mit KW');
ok((await p.locator('.cal-wday.today .cal-ev').count()) === 6, 'Woche: heute 6 Termine in der Liste');
ok(!(await overflow()), 'Woche nicht breiter als der Bildschirm');
await p.click('button[aria-label="Nächste Woche"]');
await p.click('button[aria-label="Nächste Woche"]');
ok((await p.locator('.cal-wday.today').count()) === 0, 'zwei Wochen weiter: heute nicht sichtbar');
await p.click('.cal-views >> text=Woche');
ok((await p.locator('.cal-wday.today').count()) === 1, 'nochmals «Woche» tippen: zurück auf heute');

// 3) Tag: Spalten pro Person
await p.click('.cal-views >> text=Tag');
await p.waitForSelector('.cal-dv');
const names = await p.locator('.cal-dv-name-text').allInnerTexts();
ok(JSON.stringify(names) === JSON.stringify([tobias.name, frau.name, kind1.name, kind2.name, 'Familie']), 'Tag: eine Spalte pro Person + Familie (' + names.join(', ') + ')');
const col = (k) => p.locator(`.cal-dv-col[data-col="${k}"]`);
ok((await col(tobias.id).locator('.cal-dv-ev:has-text("Test")').count()) === 1 && (await col(frau.id).locator('.cal-dv-ev:has-text("Test")').count()) === 1, 'Test erscheint bei mir und bei Frau');
ok((await col(kind1.id).locator('.cal-dv-ev:has-text("Ausflug")').count()) === 1, 'Ausflug erscheint auch bei Kind 1');
ok((await col(frau.id).locator('.cal-dv-ev:has-text("Yoga")').count()) === 1 && (await col(tobias.id).locator('.cal-dv-ev:has-text("Yoga")').count()) === 0, 'Yoga nur in Frau-Spalte');
const hb = await col(tobias.id).locator('.cal-dv-ev:has-text("Hockey")').boundingBox();
const sb = await col(tobias.id).locator('.cal-dv-ev:has-text("Sitzung")').boundingBox();
ok(hb && sb && Math.abs(hb.y - sb.y) < 2 && (hb.x + hb.width <= sb.x + 1 || sb.x + sb.width <= hb.x + 1), 'gleichzeitige Termine einer Person liegen nebeneinander');
const yb = await col(frau.id).locator('.cal-dv-ev:has-text("Yoga")').boundingBox();
ok(yb && yb.y > hb.y && yb.y < hb.y + hb.height, 'Überschneidung Hockey/Yoga auf gleicher Höhe sichtbar');
ok((await col('family').count()) === 1 && (await p.locator('.cal-dv-chip:has-text("Ferien")').count()) === 1, 'ganztägig «Ferien» oben in der Familie-Spalte');
ok((await p.locator('.cal-dv-now').count()) === 1, 'rote Linie «jetzt»');
ok(!(await overflow()), 'Tag nicht breiter als der Bildschirm');
await col(frau.id).locator('.cal-dv-ev:has-text("Yoga")').click();
ok((await p.locator('.sheet h2').innerText()) === 'Yoga', 'Tippen auf Termin öffnet Details');
await p.click('.sheet button:has-text("Schliessen")');
await p.click(`.cal-chip:has-text("${kind2.name}")`);
ok((await p.locator('.cal-dv-name').count()) === 4, 'Filter blendet Spalte aus');
await p.click(`.cal-chip:has-text("${kind2.name}")`);

// 4) Anderer Monat → «Tag» = heute
const todayTitle = await p.locator('.cal-navtitle').innerText();
await p.click('button[aria-label="Nächster Tag"]');
ok((await p.locator('.cal-navtitle').innerText()) !== todayTitle && (await p.locator('.cal-dv-now').count()) === 0, 'nächster Tag: ohne «jetzt»-Linie');
await p.click('.cal-views >> text=Monat');
await p.click('button[aria-label="Nächster Monat"]');
await p.click('button[aria-label="Nächster Monat"]');
await p.click('.cal-views >> text=Tag');
ok((await p.locator('.cal-navtitle').innerText()) === todayTitle, 'aus anderem Monat «Tag» → heute');

// 5) Ansicht wird gemerkt
await p.click('.tabbar >> text=Start');
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForSelector('.cal-views');
ok((await p.locator('.cal-views button.on').innerText()) === 'Tag' && (await p.locator('.cal-dv').count()) === 1, 'Kalender öffnet wieder in der Tagesansicht');

// 6) Woche: Tag antippen → Tagesansicht dieses Tages
await p.click('.cal-views >> text=Woche');
await p.locator('.cal-wday-title').nth(6).click();
ok((await p.locator('.cal-views button.on').innerText()) === 'Tag' && (await p.locator('.cal-navtitle').innerText()).startsWith('So'), 'Tag in der Woche antippen → Tagesansicht Sonntag');

ok(errs.length === 0, 'keine Fehler im Browser: ' + errs.join(' | '));
await b.close();
