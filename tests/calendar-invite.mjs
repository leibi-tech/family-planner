// Kalender v0.23: Termin für eine andere Person → automatische Einladung in ihren Google-Kalender.
// Selbst abwählen → «(Thadea) …», in der App nur Thadea. Einladung nur einmal sichtbar,
// bei der eingeladenen Person nicht änderbar.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const dump = () => fetch('http://localhost:8766/__control/gcal-dump').then((r) => r.json());
const APP = 'http://localhost:8765/docs-test/';
await ctl('reset');

const init = `window.__setMeta = async (k, v) => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__persons = async () => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const q = db.transaction('persons').objectStore('persons').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => a.sort - b.sort)); }); };
window.__putPersons = async (list) => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const tx = db.transaction('persons', 'readwrite'); const st = tx.objectStore('persons'); st.clear(); for (const x of list) st.put(x); tx.oncomplete = res; }); };`;
const errs = [];
async function phone(user, personIdx) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Europe/Zurich' });
  await ctx.addInitScript({ content: init });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(APP);
  await p.waitForSelector('.tabbar');
  return { ctx, p };
}

// Handy Tobias
const { p } = await phone();
const persons = await p.evaluate(() => window.__persons());
const [tobias, frau, kind1] = persons;
await ctl('members', { uA: { role: 'owner', person_id: tobias.id }, uB: { role: 'member', person_id: frau.id } });
await p.evaluate(() => window.__setMeta('session', { access_token: 'uA:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uA', email: 'uA@x.ch' } }));
await p.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));
// Thadea ist noch NICHT mit Google verbunden → Adresse von Hand bei «Familie»
await ctl('gcal', {
  accounts: { uA: { email: 'tobias@gmail.com', selected: [{ id: 'tobias@gmail.com', name: 'Tobias', kind: 'own' }, { id: 'familie@group', name: 'Familie', kind: 'family' }] } },
  personOf: { uA: tobias.id },
  events: {},
  writes: [],
  repeats: {},
});
await p.reload();
await p.waitForSelector('.tabbar');

// 1) Gmail-Adresse bei Familie eintragen
await p.click('.tabbar >> text=Mehr');
await p.click('.more-grid >> text=Familie').catch(() => p.click('text=Familie'));
await p.click(`.row:has-text("${frau.name}")`);
await p.fill('.sheet input[type=email]', 'nicht-gueltig');
ok(await p.locator('.sheet button:has-text("Speichern")').isDisabled(), 'ungültige Adresse: Speichern gesperrt');
await p.fill('.sheet input[type=email]', 'Thadea@Gmail.com');
await p.click('.sheet button:has-text("Speichern")');
const fr2 = (await p.evaluate(() => window.__persons())).find((x) => x.id === frau.id);
ok(fr2.email === 'thadea@gmail.com', 'Adresse gespeichert (klein geschrieben)');

// 2) Termin für mich + Thadea → Einladung
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForSelector('.cal-add');
await p.click('.cal-add');
await p.fill('.sheet input[placeholder="z.B. Zahnarzt"]', 'Elternabend');
ok((await p.locator('.cal-invite-hint').count()) === 0, 'ohne Thadea: keine Einladung');
await p.click(`.sheet .chip:has-text("${frau.name}")`);
ok((await p.locator(`.cal-invite-hint:has-text("${frau.name} bekommt eine Einladung")`).count()) === 1, 'Hinweis: Thadea bekommt eine Einladung');
await p.click(`.sheet .chip:has-text("${kind1.name}")`);
ok((await p.locator(`.cal-invite-hint:has-text("${kind1.name}")`).count()) === 0, 'Kind ohne Adresse: keine Einladung');
await p.locator('.sheet input[type=time]').nth(0).fill('19:00');
await p.click('.sheet button:has-text("Speichern")');
await p.waitForSelector('text=Termin gespeichert');
let d = await dump();
let w = d.writes.at(-1);
ok(w.op === 'create' && JSON.stringify(w.invite) === '["thadea@gmail.com"]' && w.event.title === `[${frau.name}, ${kind1.name}] Elternabend`, 'an Google: Einladung an thadea@gmail.com, Titel mit [ ]');

// 3) Termin nur für Thadea (ich wähle mich ab)
await p.click('.cal-add');
await p.fill('.sheet input[placeholder="z.B. Zahnarzt"]', 'Zahnarzt');
await p.click(`.sheet .chip:has-text("${tobias.name}")`);
ok((await p.locator('.sheet .warn:has-text("mindestens eine Person")').count()) === 1 && (await p.locator('.sheet button:has-text("Speichern")').isDisabled()), 'niemand gewählt: Hinweis, Speichern gesperrt');
await p.click(`.sheet .chip:has-text("${frau.name}")`);
ok((await p.locator(`text=In Google: «(${frau.name}) Zahnarzt»`).count()) === 1, 'Vorschau «(Thadea) Zahnarzt»');
await p.locator('.sheet input[type=time]').nth(0).fill('10:00');
await p.click('.sheet button:has-text("Speichern")');
await p.waitForSelector('text=Termin gespeichert');
d = await dump();
w = d.writes.at(-1);
ok(w.event.title === `(${frau.name}) Zahnarzt` && w.invite[0] === 'thadea@gmail.com', 'an Google: «(Thadea) Zahnarzt» mit Einladung');
await p.waitForSelector('.cal-ev:has-text("Zahnarzt")');
ok((await p.locator('.cal-ev:has-text("Zahnarzt") .cal-ev-sub').innerText()) === frau.name, 'in der App: betrifft nur Thadea');
ok((await p.locator('.cal-ev:has-text("Zahnarzt") .cal-ev-title').innerText()) === 'Zahnarzt', 'Titel ohne Klammern');

// 4) Bearbeiten: Thadea abgewählt bleibt, ich bin abgewählt; Einladung wieder entfernen
await p.click('.cal-ev:has-text("Zahnarzt")');
ok((await p.locator(`.sheet .cal-guests:has-text("${frau.name} (offen)")`).count()) === 1, 'Details: «Eingeladen: Thadea (offen)»');
await p.click('.sheet button:has-text("Bearbeiten")');
ok((await p.locator(`.sheet .chip.on:has-text("${tobias.name}")`).count()) === 0 && (await p.locator(`.sheet .chip.on:has-text("${frau.name}")`).count()) === 1, 'Formular: ich abgewählt, Thadea gewählt');
await p.click(`.sheet .chip:has-text("${tobias.name}")`);
await p.click(`.sheet .chip:has-text("${frau.name}")`);
await p.click('.sheet button:has-text("Speichern")');
await p.waitForSelector('text=Termin geändert');
d = await dump();
w = d.writes.at(-1);
ok(w.op === 'update' && w.event.title === 'Zahnarzt' && w.invite.length === 0 && w.inviteKnown.includes('thadea@gmail.com'), 'Thadea entfernt: Einladung wird zurückgezogen');

// 5) Thadea verbindet sich später mit Google: Termin nur einmal, bei ihr nicht änderbar
await ctl('gcal', {
  accounts: {
    uA: { email: 'tobias@gmail.com', selected: [{ id: 'tobias@gmail.com', name: 'Tobias', kind: 'own' }, { id: 'familie@group', name: 'Familie', kind: 'family' }] },
    uB: { email: 'thadea@gmail.com', selected: [{ id: 'thadea@gmail.com', name: 'Thadea', kind: 'own' }] },
  },
  personOf: { uA: tobias.id, uB: frau.id },
});
await p.click('.cal-head button:has-text("Heute"), button:has-text("Heute")').catch(() => {});
await p.reload();
await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.waitForSelector('.cal-ev:has-text("Elternabend")');
await p.waitForTimeout(500);
ok((await p.locator('.cal-ev:has-text("Elternabend")').count()) === 1, 'Tobias: Einladung nur einmal sichtbar');

const { p: q } = await phone();
await q.evaluate(() => window.__setMeta('session', { access_token: 'uB:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uB', email: 'uB@x.ch' } }));
await q.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));
await q.evaluate((l) => window.__putPersons(l), await p.evaluate(() => window.__persons()));
await q.reload();
await q.waitForSelector('.tabbar');
await q.click('.tabbar >> text=Mehr');
await q.click('text=Kalender');
await q.waitForSelector('.cal-ev:has-text("Elternabend")');
await q.waitForTimeout(500);
ok((await q.locator('.cal-ev:has-text("Elternabend")').count()) === 1, 'Thadea: Einladung nur einmal sichtbar');
const sub = await q.locator('.cal-ev:has-text("Elternabend") .cal-ev-sub').innerText();
ok(sub.includes(tobias.name) && sub.includes(frau.name), 'Thadea: betrifft Tobias und Thadea');
await q.click('.cal-ev:has-text("Elternabend")');
ok((await q.locator('.sheet button:has-text("Bearbeiten")').count()) === 0 && (await q.locator(`.sheet >> text=Diesen Termin kann nur ${tobias.name} ändern`).count()) === 1, 'Thadea: nicht änderbar, nur Tobias');

ok(errs.length === 0, 'keine Fehler im Browser: ' + errs.join(' | '));
await b.close();
