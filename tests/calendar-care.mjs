// Kalender K4/K5 (v0.17): «Wer schaut auf die Kinder?» (Überschneidung beider Eltern, Betreuung erfassen,
// Termin verschoben/gelöscht), Rückfrage als ToDo mit «Termin öffnen», Termine auf der Startseite.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const APP = 'http://localhost:8765/docs-test/';
await ctl('reset');

const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Europe/Zurich' });
await ctx.addInitScript({ content: `window.__setMeta = async (k, v) => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__all = async (s) => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };` });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

await p.goto(APP);
await p.waitForSelector('.tabbar');
const persons = (await p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const [tobias, frau, kind1, kind2] = persons;
await ctl('members', { uA: { role: 'owner', person_id: tobias.id } });
await p.evaluate(() => window.__setMeta('session', { access_token: 'uA:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uA', email: 'uA@x.ch' } }));
await p.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const day = (off) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const at = (off, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, m).toISOString();
const soon = (min) => new Date(Date.now() + min * 60000).toISOString();
const T = 'tobias@gmail.com', F = 'thadea@gmail.com';
const events = {
  [T]: [
    { id: 'z1', title: 'Zahnarzt', allDay: false, start: soon(60), end: soon(120) },
    { id: 'h1', title: 'Hockey', allDay: false, start: at(1, 19), end: at(1, 21) },
    { id: 'e1', title: `[${frau.name}] Essen`, allDay: false, start: at(1, 12), end: at(1, 13) },
    { id: 's1', title: `[${kind1.name}, ${kind2.name}] Schwimmen`, allDay: false, start: at(1, 16), end: at(1, 17) },
    { id: 'w1', title: 'Arbeit', allDay: false, start: at(2, 8), end: at(2, 17) },
  ],
  [F]: [
    { id: 'p1', title: 'Elternabend', allDay: false, start: at(1, 19, 30), end: at(1, 21) },
    { id: 'c1', title: 'Coiffeur', allDay: false, start: at(1, 16), end: at(1, 17) },
    { id: 'v1', title: 'Ferien', allDay: true, start: day(2), end: day(3) },
  ],
};
await ctl('gcal', {
  accounts: {
    uA: { email: T, selected: [{ id: T, name: 'Tobias', kind: 'own' }] },
    uB: { email: F, selected: [{ id: F, name: 'Thadea', kind: 'own' }] },
  },
  personOf: { uA: tobias.id, uB: frau.id },
  events,
  writes: [],
  repeats: {},
});
await p.reload();
await p.waitForSelector('.dash-hello');
await p.waitForSelector('.care-card', { timeout: 5000 }).catch(() => {});

// 1) Startseite: Warnungen und Termine
const careRows = p.locator('.care-card .dash-care-row');
const careTexts = await careRows.allInnerTexts();
ok(careTexts.length === 2, 'Startseite: 2 Warnungen (' + careTexts.map((t) => t.split('\n')[1]).join(' | ') + ')');
ok(careTexts.some((t) => t.includes('Hockey') && t.includes('Elternabend')) && careTexts.some((t) => t.includes('Essen')), 'Hockey + Elternabend und gemeinsames Essen');
ok(!careTexts.some((t) => t.includes('Schwimmen') || t.includes('Coiffeur')), 'keine Warnung, wenn die Kinder mitgehen');
ok(!careTexts.some((t) => t.includes('Arbeit')), 'ganztägige Termine (Ferien) zählen nicht');
ok(careTexts.find((t) => t.includes('Hockey')).includes('19:30–21:00'), 'Zeitraum der Überschneidung 19:30–21:00');
const calDays = p.locator('.dash-cal-day');
ok((await calDays.nth(0).locator('.dash-cal-title').allInnerTexts()).includes('Zahnarzt'), 'Termine heute: Zahnarzt');
ok((await calDays.nth(1).locator('.dash-cal-title').count()) === 5, 'Termine morgen: 5');
ok((await calDays.nth(1).locator('.dash-cal-row:has-text("Essen") .dash-cal-who').innerText()) === `${tobias.name}, ${frau.name}`, 'Startseite zeigt die Personen');
ok(!(await overflow()), 'Startseite nicht breiter als der Bildschirm');

// 2) Betreuung erfassen
await careRows.filter({ hasText: 'Hockey' }).click();
await p.waitForSelector('.sheet h2:has-text("Wer schaut auf die Kinder?")');
ok((await p.locator('.sheet .care-event').count()) === 2, 'Fenster zeigt beide Termine');
await p.fill('.sheet input[placeholder="z.B. Grosi"]', 'Grosi');
await p.fill('.sheet textarea', 'holt sie um 18 Uhr');
await p.click('.sheet button:has-text("Speichern")'); await p.waitForTimeout(400);
ok((await careRows.count()) === 1, 'nach dem Erfassen: noch 1 Warnung');
const care = (await p.evaluate(() => window.__all('care'))).filter((c) => !c.deleted);
ok(care.length === 1 && care[0].who === 'Grosi' && care[0].mode === 'person' && care[0].events.length === 2, 'Betreuung gespeichert, mit beiden Terminen verknüpft');
// Kinder gehen mit
await careRows.filter({ hasText: 'Essen' }).click();
await p.click('.sheet button:has-text("Kinder gehen mit")');
await p.click(`.sheet .chip:has-text("${frau.name}")`);
await p.click('.sheet button:has-text("Speichern")'); await p.waitForTimeout(400);
ok((await p.locator('.care-card').count()) === 0, 'alles erfasst: keine Warnung mehr auf der Startseite');

// 3) Kalender: Morgen antippen → Tagesansicht morgen, Symbole
await calDays.nth(1).locator('.dash-cal-label').click();
await p.waitForSelector('.cal-dv');
ok((await p.locator('.cal-views button.on').innerText()) === 'Tag', '«Morgen» öffnet die Tagesansicht');
ok((await p.locator('.cal-dv-ev:has-text("Hockey") .cal-dv-ev-title').innerText()).startsWith('✅'), 'Hockey mit ✅');
await p.click('.cal-dv-col >> nth=0 >> .cal-dv-ev:has-text("Hockey")');
ok((await p.locator('.care-box.ok').innerText()).includes('Grosi schaut auf die Kinder'), 'Termin-Ansicht: «Grosi schaut auf die Kinder»');
await p.click('.sheet button:has-text("Schliessen")');
ok((await p.locator('.topbar h1').innerText()) === 'Start', 'Schliessen führt zurück zur Startseite');

// 4) Termin verschoben → «Termin geändert – Betreuung prüfen»
events[T][1] = { ...events[T][1], end: at(1, 21, 30) };
await ctl('gcal', { events });
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.click('button:has-text("Aktualisieren")');
await p.waitForTimeout(800);
await p.click('.cal-views >> text=Tag');
await p.click('button[aria-label="Nächster Tag"]');
ok((await p.locator('.cal-dv-ev:has-text("Hockey") .cal-dv-ev-title').innerText()).startsWith('⚠️'), 'nach Verschieben: Hockey wieder mit ⚠️');
await p.click('.cal-dv-col >> nth=0 >> .cal-dv-ev:has-text("Hockey")');
ok((await p.locator('.care-box.changed').innerText()).includes('Termin geändert'), 'Termin-Ansicht: «Termin geändert – Betreuung prüfen»');
await p.click('.care-box button');
ok((await p.locator('.sheet input[placeholder="z.B. Grosi"]').inputValue()) === 'Grosi', 'bisherige Betreuung vorausgefüllt');
await p.click('.sheet button:has-text("Speichern")'); await p.waitForTimeout(400);
ok((await p.locator('.cal-dv-ev:has-text("Hockey") .cal-dv-ev-title').innerText()).startsWith('✅'), 'bestätigt: wieder ✅');

// 5) Termin weit weg verschoben → erfasste Betreuung passt nicht mehr
events[F][0] = { ...events[F][0], start: at(3, 10), end: at(3, 11) };
await ctl('gcal', { events });
await p.click('button:has-text("Aktualisieren")');
await p.waitForTimeout(800);
ok((await p.locator('.care-orphan').count()) === 1, 'Hinweis «Termin geändert – Betreuung prüfen» oben im Kalender');
await p.click('.care-orphan');
await p.click('.sheet button:has-text("Betreuung löschen")'); await p.waitForTimeout(400);
ok((await p.locator('.care-orphan').count()) === 0, 'Betreuung gelöscht, Hinweis weg');

// 6) Rückfrage bei fremdem Termin → ToDo mit «Termin öffnen»
await p.click(`.cal-dv-col[data-col="${frau.id}"] .cal-dv-ev:has-text("Coiffeur")`);
ok((await p.locator('.sheet button:has-text("Bearbeiten")').count()) === 0, 'fremder Termin: nicht änderbar');
await p.click(`.sheet button:has-text("Rückfrage an ${frau.name}")`);
await p.fill('.sheet .cal-ask textarea', 'Geht 17 Uhr auch?');
await p.click('.sheet button:has-text("Senden")');
await p.waitForSelector('text=Rückfrage als ToDo');
const todo = (await p.evaluate(() => window.__all('todos'))).find((t) => t.title.startsWith('Rückfrage: Coiffeur'));
ok(todo && todo.assignees[0] === frau.id && todo.note === 'Geht 17 Uhr auch?' && todo.eventRef?.eventId === 'c1', 'ToDo für Frau mit Text und Termin-Link');
await p.click('.tabbar >> text=ToDo');
await p.click('text=Alle');
ok((await p.locator('.todo-main', { hasText: 'Rückfrage: Coiffeur' }).locator('span[aria-label="mit Termin"]').count()) === 1, 'ToDo zeigt 📅');
await p.locator('.todo-main', { hasText: 'Rückfrage: Coiffeur' }).click();
await p.click('text=Termin öffnen');
await p.waitForSelector('.sheet h2:has-text("Coiffeur")');
ok((await p.locator('.topbar h1').innerText()) === 'Kalender', '«Termin öffnen» zeigt den Termin im Kalender');
await p.click('.sheet button:has-text("Schliessen")');
ok((await p.locator('.topbar h1').innerText()) === 'ToDo', 'zurück zum ToDo');

// 7) Monatsansicht: Tag mit offener Warnung markiert
await p.click('.tabbar >> text=Mehr');
await p.click('text=Kalender');
await p.click('.cal-views >> text=Monat');
ok(!(await overflow()), 'Kalender nicht breiter als der Bildschirm');

ok(errs.length === 0, 'keine Fehler im Browser: ' + errs.join(' | '));
await b.close();
