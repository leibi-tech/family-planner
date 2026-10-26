// Kalender (v0.14): ohne Haushalt, Verbinden (Rückkehr von Google), Kalender wählen, Monatsraster,
// Tagesliste, Personenfilter, Termin-Ansicht, offline aus der Kopie, keine Überbreite.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
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

// 1) Ohne Haushalt: Hinweis
await p.goto(APP);
await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr');
ok((await p.locator('text=Termine aus Google Kalender').count()) === 1, '«Kalender» unter «Mehr»');
await p.click('text=Kalender');
ok((await p.locator('text=braucht darum «Gemeinsam nutzen»').count()) === 1, 'ohne Haushalt: Hinweis auf «Gemeinsam nutzen»');
ok((await p.locator('.topbar-back').count()) === 1, 'Zurück-Pfeil oben links');

// 2) Mit Haushalt, noch nicht verbunden
const persons = await p.evaluate(() => window.__persons());
const [tobias, thadea] = persons;
await ctl('members', { uA: { role: 'owner', person_id: tobias.id } });
await p.evaluate(() => window.__setMeta('session', { access_token: 'uA:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uA', email: 'uA@x.ch' } }));
await p.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));

// Termine relativ zu heute
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const day = (off) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const at = (off, h, m = 0) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, m); return d.toISOString(); };
await ctl('gcal', {
  accounts: { uB: { email: 'thadea@gmail.com', selected: [{ id: 'thadea@gmail.com', name: 'Thadea', kind: 'own' }] } },
  personOf: { uB: thadea.id },
  googleList: [
    { id: 'uA@gmail.com', name: 'Tobias privat', color: '#039be5', access: 'owner', primary: true },
    { id: 'familie@group', name: 'Familie', color: '#33b679', access: 'writer', primary: false },
    { id: 'feiertage', name: 'Feiertage in der Schweiz', color: '#999', access: 'reader', primary: false },
  ],
  events: {
    'uA@gmail.com': [
      { id: 'a1', title: 'Zahnarzt', allDay: false, start: at(0, 10), end: at(0, 11), location: 'Weinfelden' },
      { id: 'a2', title: 'Hockey', allDay: false, start: at(0, 19), end: at(0, 21) },
      { id: 'a3', title: 'Nachtschicht', allDay: false, start: at(1, 22), end: at(2, 6) },
    ],
    'thadea@gmail.com': [{ id: 'b1', title: 'Yoga', allDay: false, start: at(0, 19, 30), end: at(0, 20, 30), description: 'Matte <b>mitnehmen</b>' }],
    'familie@group': [{ id: 'f1', title: 'Ausflug', allDay: true, start: day(0), end: day(2) }],
  },
  connectUrl: APP + '?g=1#kalender=ok',
  errors: [],
});
await p.reload();
await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForTimeout(800);
ok((await p.locator('button:has-text("Mit Google verbinden")').count()) === 1, 'nicht verbunden: Knopf «Mit Google verbinden»');
ok((await p.locator('.cal-grid .cal-cell').count()) >= 28, 'Monatsraster sichtbar');
ok((await p.locator('.cal-ev:has-text("Yoga")').count()) === 1, 'Termine von Thadea sichtbar, obwohl ich noch nicht verbunden bin');

// 3) Verbinden → Rückkehr von «Google» → Kalender-Seite mit Auswahl
await p.click('.cal-banner button');
await p.waitForSelector('text=nicht überprüft');
ok(true, 'Hinweis «Google hat diese App nicht überprüft» wird erklärt');
await p.click('.sheet button:has-text("Mit Google verbinden")');
await p.waitForURL(/\?g=1/);
await p.waitForSelector('text=Google verbunden');
ok((await p.locator('.topbar h1').innerText()) === 'Kalender', 'nach Rückkehr direkt auf der Kalender-Seite');
ok(!(await p.evaluate(() => location.hash)), '#kalender=… aus der Adresse entfernt');
await p.waitForSelector('.cal-pick li');
const rows = p.locator('.cal-pick li');
ok((await rows.count()) === 3, 'drei Google-Kalender zur Auswahl');
ok((await rows.nth(0).locator('button.on').innerText()) === 'Mein Kalender', 'Hauptkalender als «Mein Kalender» vorgeschlagen');
ok((await rows.nth(2).locator('text=(nur lesen)').count()) === 1, 'Feiertage: «nur lesen» angezeigt');
await rows.nth(1).locator('button:has-text("Familie")').click();
ok(!(await overflow()), 'Auswahl-Fenster nicht breiter als der Bildschirm');
await p.click('button:has-text("Auswahl speichern")');
await p.waitForSelector('text=Gespeichert');
await p.click('.sheet >> text=Schliessen');
await p.waitForTimeout(600);

// 4) Raster und Tagesliste
const list = p.locator('.cal-list .cal-ev');
const titles = await list.locator('.cal-ev-title').allInnerTexts();
ok(JSON.stringify(titles) === JSON.stringify(['Ausflug', 'Zahnarzt', 'Hockey', 'Yoga']), 'Tagesliste heute: ganztägig zuerst, dann nach Zeit (' + titles.join(', ') + ')');
ok((await list.nth(0).locator('.cal-ev-time').innerText()).startsWith('ganztägig, bis'), 'mehrtägiger Termin: «ganztägig, bis …»');
ok((await list.nth(1).locator('.cal-ev-time').innerText()) === '10:00–11:00', 'Zeit 10:00–11:00');
ok((await list.nth(1).locator('.cal-ev-sub').innerText()) === `${tobias.name} · Weinfelden`, 'Person und Ort beim Termin');
ok((await list.nth(0).locator('.cal-ev-sub').innerText()) === 'Familie', 'Familienkalender als «Familie»');
ok((await p.locator('.cal-cell.today .cal-bar').count()) === 3 && (await p.locator('.cal-cell.today .cal-more').innerText()) === '+1', 'Heute im Raster: 3 Balken und «+1»');
ok((await p.locator('.cal-chip').count()) === 3, 'Filter: Tobias, Thadea, Familie');

// Nachtschicht über Mitternacht: morgen «ab 22:00», übermorgen «bis 06:00»
const cellFor = async (off) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
  if (d.getMonth() !== now.getMonth()) return false;
  await p.locator('.cal-cell:not(.other)').nth(d.getDate() - 1).click();
  return true;
};
if (await cellFor(1)) ok((await p.locator('.cal-ev:has-text("Nachtschicht") .cal-ev-time').innerText()) === 'ab 22:00', 'über Mitternacht: erster Tag «ab 22:00»');
if (await cellFor(2)) ok((await p.locator('.cal-ev:has-text("Nachtschicht") .cal-ev-time').innerText()) === 'bis 06:00', 'über Mitternacht: zweiter Tag «bis 06:00»');
await p.click('.cal-today-btn');

// 5) Filter: Thadea ausblenden
await p.click(`.cal-chip:has-text("${thadea.name}")`);
ok((await p.locator('.cal-ev:has-text("Yoga")').count()) === 0, 'Filter blendet Thadeas Termine aus');
await p.click(`.cal-chip:has-text("${thadea.name}")`);
ok((await p.locator('.cal-ev:has-text("Yoga")').count()) === 1, 'und wieder ein');

// 6) Termin-Ansicht
await p.click('.cal-ev:has-text("Yoga")');
ok((await p.locator('.sheet h2').innerText()) === 'Yoga', 'Termin-Ansicht öffnet');
ok((await p.locator('.cal-detail-desc').innerText()) === 'Matte  mitnehmen ', 'Beschreibung ohne HTML');
ok((await p.locator('a:has-text("In Google Kalender öffnen")').count()) === 1, 'Link zu Google Kalender');
await p.click('.sheet button:has-text("Schliessen")');

// 7) Monat wechseln und zurück
await p.click('button[aria-label="Nächster Monat"]');
await p.click('button[aria-label="Vorheriger Monat"]');
ok((await p.locator('.cal-ev:has-text("Zahnarzt")').count()) === 1, 'Monat vor und zurück: heutige Termine wieder da');
ok(!(await overflow()), 'Kalender nicht breiter als der Bildschirm');

// 8) Offline: aus der Kopie (Seite verlassen und wieder öffnen, ohne Internet)
await ctx.setOffline(true);
await p.click('.tabbar >> text=Start');
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForTimeout(500);
ok((await p.locator('.cal-ev:has-text("Hockey")').count()) === 1, 'offline: Termine aus der Kopie sichtbar');
ok((await p.locator('text=Offline · Stand').count()) === 1, 'offline: «Offline · Stand …»');
await p.click('button[aria-label="Nächster Monat"]');
await p.click('button[aria-label="Vorheriger Monat"]');
ok((await p.locator('.warn').count()) === 0, 'offline: keine Fehlermeldung beim Blättern');
await ctx.setOffline(false);

// 9) Trennen
await p.goto(APP);
await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForTimeout(500);
await p.click('button:has-text("⚙︎ Kalender")');
await p.waitForSelector('text=Verbunden mit');
await p.click('button:has-text("Verbindung trennen")');
await p.click('button:has-text("Wirklich trennen")');
await p.waitForSelector('.sheet button:has-text("Mit Google verbinden")');
await p.click('.sheet >> text=Schliessen');
await p.waitForTimeout(500);
ok((await p.locator('.cal-ev:has-text("Zahnarzt")').count()) === 0 && (await p.locator('.cal-ev:has-text("Yoga")').count()) === 1, 'nach Trennen: eigene Termine weg, Thadeas bleiben');

ok(errs.length === 0, 'keine Fehler im Browser: ' + errs.join(' | '));
await b.close();
