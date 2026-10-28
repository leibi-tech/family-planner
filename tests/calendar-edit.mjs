// Kalender K2 (v0.15): Termine erfassen, ändern (nur diesen / alle), löschen, Personen im Titel,
// fremde Termine nicht änderbar, offline gesperrt.
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
const now = new Date();
const at = (off, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, m).toISOString();
await ctl('gcal', {
  accounts: {
    uA: { email: 'tobias@gmail.com', selected: [{ id: 'tobias@gmail.com', name: 'Tobias', kind: 'own' }, { id: 'familie@group', name: 'Familie', kind: 'family' }] },
    uB: { email: 'thadea@gmail.com', selected: [{ id: 'thadea@gmail.com', name: 'Thadea', kind: 'own' }] },
  },
  personOf: { uA: tobias.id, uB: frau.id },
  events: { 'thadea@gmail.com': [{ id: 'y1', title: 'Yoga', allDay: false, start: at(0, 19, 30), end: at(0, 20, 30) }] },
  writes: [],
  repeats: {},
});
await p.reload();
await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForSelector('.cal-ev:has-text("Yoga")');

// 1) Neuer Termin mit Kind 1
await p.click('.cal-add');
await p.waitForSelector('.sheet h2:has-text("Neuer Termin")');
await p.fill('.sheet input[placeholder="z.B. Zahnarzt"]', 'Zahnarzt');
ok((await p.locator('.sheet .chip:has-text("Tobias")').isDisabled()) && (await p.locator('.sheet .chip.on:has-text("Tobias")').count()) === 1, 'eigener Kalender: ich bin fix dabei');
await p.click(`.sheet .chip:has-text("${kind1.name}")`);
ok((await p.locator('text=In Google: «[Kind 1] Zahnarzt»').count()) === 1, 'Vorschau Titel «[Kind 1] Zahnarzt»');
const times = p.locator('.sheet input[type=time]');
await times.nth(0).fill('14:00');
ok((await times.nth(1).inputValue()) === '15:00', 'Ende rückt mit (1 Stunde)');
ok(!(await overflow()), 'Formular nicht breiter als der Bildschirm');
await p.click('.sheet button:has-text("Speichern")');
await p.waitForSelector('text=Termin gespeichert');
await p.waitForSelector('.cal-ev:has-text("Zahnarzt")');
let dump = await fetch('http://localhost:8766/__control/gcal-dump').then((r) => r.json());
const w1 = dump.writes.at(-1);
ok(w1.op === 'create' && w1.event.title === '[Kind 1] Zahnarzt' && w1.event.startTime === '14:00' && w1.event.repeat == null, 'an Google: «[Kind 1] Zahnarzt», 14:00, ohne Wiederholung');
ok((await p.locator('.cal-ev:has-text("Zahnarzt") .cal-ev-title').innerText()) === 'Zahnarzt', 'in der App ohne [Kind 1] im Titel');
ok((await p.locator('.cal-ev:has-text("Zahnarzt") .cal-ev-sub').innerText()) === `${tobias.name}, ${kind1.name}`, 'betrifft: Tobias, Kind 1');

// 2) Filter mit Kind
ok((await p.locator(`.cal-chip:has-text("${kind1.name}")`).count()) === 1, 'Filter-Knopf für Kind 1');
await p.click(`.cal-chip:has-text("${tobias.name}")`);
ok((await p.locator('.cal-ev:has-text("Zahnarzt")').count()) === 1, 'Tobias ausgeblendet: Termin bleibt wegen Kind 1');
await p.click(`.cal-chip:has-text("${kind1.name}")`);
ok((await p.locator('.cal-ev:has-text("Zahnarzt")').count()) === 0, 'beide ausgeblendet: Termin weg');
await p.click(`.cal-chip:has-text("${tobias.name}")`);
await p.click(`.cal-chip:has-text("${kind1.name}")`);

// 3) Serie im Familienkalender
await p.click('.cal-add');
await p.fill('.sheet input[placeholder="z.B. Zahnarzt"]', 'Turnen');
await p.selectOption('.sheet select.select >> nth=0', 'familie@group');
ok((await p.locator('.sheet .chip:disabled').count()) === 0, 'Familienkalender: niemand fix');
ok((await p.locator('text=Niemand gewählt = ganze Familie').count()) === 1, 'Hinweis «ganze Familie»');
await p.click(`.sheet .chip:has-text("${kind2.name}")`);
await p.locator('.sheet input[type=time]').nth(0).fill('17:00');
await p.selectOption('.sheet select.select >> nth=1', 'weekly');
await p.click('.sheet button:has-text("Speichern")');
await p.waitForSelector('.cal-ev:has-text("Turnen")');
dump = await fetch('http://localhost:8766/__control/gcal-dump').then((r) => r.json());
ok(dump.writes.at(-1).event.repeat?.freq === 'weekly' && dump.writes.at(-1).event.title === '[Kind 2] Turnen', 'Serie wöchentlich, «[Kind 2] Turnen»');
ok((await p.locator('.cal-ev:has-text("Turnen") .cal-ev-sub').innerText()) === kind2.name, 'Familientermin betrifft nur Kind 2');

// 4) Nur diesen Termin ändern
await p.click('.cal-ev:has-text("Turnen")');
ok((await p.locator('.sheet >> text=Wiederkehrender Termin').count()) === 1, 'Serie erkannt');
await p.click('.sheet button:has-text("Bearbeiten")');
await p.click('.sheet button:has-text("Nur diesen Termin")');
await p.waitForSelector('.sheet h2:has-text("Diesen Termin ändern")');
ok((await p.locator('.sheet select.select').count()) === 0, '«Nur diesen»: keine Wiederholung wählbar');
ok((await p.locator(`.sheet .chip.on:has-text("${kind2.name}")`).count()) === 1, 'Kind 2 vorgewählt (aus dem Titel)');
await p.fill('.sheet input[placeholder="z.B. Zahnarzt"]', 'Turnen Halle 2');
await p.click('.sheet button:has-text("Speichern")');
await p.waitForSelector('.cal-ev:has-text("Turnen Halle 2")');
dump = await fetch('http://localhost:8766/__control/gcal-dump').then((r) => r.json());
ok(dump.writes.at(-1).op === 'update' && dump.writes.at(-1).scope === 'one' && dump.writes.at(-1).event.title === '[Kind 2] Turnen Halle 2', 'nur dieser Termin geändert (Kind 2 bleibt im Titel)');

// 5) Alle ändern
await p.click('.cal-ev:has-text("Turnen Halle 2")');
await p.click('.sheet button:has-text("Bearbeiten")');
await p.click('.sheet button:has-text("Alle Termine der Serie")');
await p.waitForSelector('.sheet h2:has-text("Alle Termine der Serie ändern")');
await p.waitForSelector('.sheet select.select');
ok((await p.locator('.sheet select.select').inputValue()) === 'weekly', '«Alle»: Wiederholung «wöchentlich» geladen');
await p.fill('.sheet input[placeholder="z.B. Zahnarzt"]', 'Kinderturnen');
await p.locator('.sheet input[type=date]').nth(2).fill(`${now.getFullYear() + 1}-06-30`);
await p.click('.sheet button:has-text("Speichern")');
await p.waitForSelector('text=Termin geändert');
dump = await fetch('http://localhost:8766/__control/gcal-dump').then((r) => r.json());
const w5 = dump.writes.at(-1);
ok(w5.scope === 'all' && w5.event.title === '[Kind 2] Kinderturnen' && w5.event.repeat?.freq === 'weekly' && /-06-30$/.test(w5.event.repeat.until), '«Alle»: Titel und «bis» für die Serie');

// 6) Löschen
await p.click('.cal-ev:has-text("Zahnarzt")');
await p.click('.sheet button:has-text("Löschen")');
await p.click('.sheet button:has-text("Ja, löschen")');
await p.waitForSelector('text=Termin gelöscht');
ok((await p.locator('.cal-ev:has-text("Zahnarzt")').count()) === 0, 'Termin gelöscht');
await p.click('.cal-ev:has-text("Kinderturnen")');
await p.click('.sheet button:has-text("Löschen")');
ok((await p.locator('.sheet button:has-text("Alle Termine der Serie löschen")').count()) === 1, 'Serie: Frage «nur diesen / alle» beim Löschen');
await p.click('.sheet button:has-text("Alle Termine der Serie löschen")');
await p.waitForSelector('text=Termin gelöscht');
dump = await fetch('http://localhost:8766/__control/gcal-dump').then((r) => r.json());
ok((dump.events['familie@group'] ?? []).length === 0, 'ganze Serie gelöscht');

// 7) Fremder Termin
await p.click('.cal-ev:has-text("Yoga")');
ok((await p.locator('.sheet button:has-text("Bearbeiten")').count()) === 0 && (await p.locator(`text=Diesen Termin kann nur ${frau.name} ändern`).count()) === 1, 'Thadeas Termin: nicht änderbar, Hinweis mit Name');
await p.click('.sheet button:has-text("Schliessen")');

// 8) Offline gesperrt
await ctx.setOffline(true);
await p.waitForTimeout(300);
ok(await p.locator('.cal-add').isDisabled(), 'offline: «+ Termin» gesperrt');
await ctx.setOffline(false);

ok(errs.length === 0, 'keine Fehler im Browser: ' + errs.join(' | '));
await b.close();
