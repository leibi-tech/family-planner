import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__put = async (s, recs) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction(s, 'readwrite'); recs.forEach((r) => tx.objectStore(s).put(r)); tx.oncomplete = res; }); };
`;
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
await ctx.addInitScript({ content: helpers });
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar');
const persons = (await p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const me = persons[0].id, thadea = persons[1].id;
const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
const key = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const today = key(d); const yest = key(new Date(d.getTime() - 86400000)); const morrow = key(new Date(d.getTime() + 86400000));
const now = Date.now();
const menu = (id, name) => ({ id, name, mealTypes: ['mittag'], basis: { kind: 'family', baseFactor: 2.6 }, ingredients: [], note: '', updatedAt: now, deleted: false });
const todo = (id, title, due, extra = {}) => ({ id, title, note: '', due, assignees: [me], private: false, createdBy: me, createdAt: now, done: false, doneAt: null, doneBy: null, updatedAt: now, deleted: false, ...extra });
const item = (id, text, sort, done = false, parent = null) => ({ id, text, done, parent, sort, at: now, deleted: false });
const note = (id, kind, title, extra = {}) => ({ id, kind, title, body: '', items: [], private: false, createdBy: thadea, createdAt: now, editedBy: thadea, pins: {}, updatedAt: now, deleted: false, ...extra });
await p.evaluate(async ([m1, m2, day, todos, notes]) => {
  await window.__put('menus', [m1, m2]); await window.__put('days', [day]); await window.__put('todos', todos); await window.__put('notes', notes);
}, [menu('m1', 'Spaghetti Bolognese'), menu('m2', 'Randensalat'),
  { id: today, slots: [{ id: today + '-mittag', kind: 'mittag', label: 'Mittagessen', active: true, dishes: [{ id: 'd1', menuId: 'm1' }], absent: [] }, { id: today + '-abend', kind: 'abend', label: 'Abendessen', active: true, dishes: [{ id: 'd2', menuId: 'm2' }], absent: [me] }, { id: today + '-fr', kind: 'fruehstueck', label: 'Frühstück', active: true, dishes: [], absent: [] }], updatedAt: now, deleted: false },
  [todo('t1', 'Velo flicken', today), todo('t2', 'Steuern', yest), todo('t3', 'Zahnarzt', morrow), todo('t4', 'Abfall', morrow), todo('t5', 'Post', morrow), todo('t6', 'Geschenk kaufen', null), todo('t7', 'Nicht meins', today, { assignees: [thadea], createdBy: thadea })],
  [note('n1', 'list', 'Einkauf Hof', { items: [item('i1', 'Milch', 1), item('i2', 'Brot', 2), item('i3', 'Eier', 3, true), item('i4', 'Butter', 4), item('i5', 'Käse', 5), item('i6', 'Reis', 6), item('i7', 'Mehl', 7), item('i8', 'Zucker', 8)], pins: { [me]: { on: true, at: now } }, updatedAt: now - 1000 }),
   note('n2', 'note', 'WLAN-Code', { body: 'Gast: sonne2026', pins: { [me]: { on: true, at: now } }, updatedAt: now - 2000 }),
   note('n3', 'note', 'Ferienideen', { body: 'Südtirol', updatedAt: now - 3600000 }),
   note('n4', 'list', 'Packliste', { items: [item('p1', 'Zelt', 1)], updatedAt: now - 7200000 })]]);
await p.reload(); await p.waitForSelector('.dash');

ok((await p.locator('.dash-hello h2').innerText()).includes('Tobias'), 'Begrüssung mit Name: ' + (await p.locator('.dash-hello h2').innerText()));
ok((await p.locator('.tabbar .tab').count()) === 5, '5 Knöpfe unten');
ok(await p.locator('.tab.home.active').count() === 1, 'Start-Knopf hervorgehoben und aktiv');
ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'kein seitliches Wischen');
// Menü heute
ok(await p.locator('.dash-dish', { hasText: 'Spaghetti Bolognese' }).count() === 1 && await p.locator('.dash-dish', { hasText: 'Randensalat' }).count() === 1, 'Menüs von heute angezeigt');
ok(await p.locator('.dash-meals >> text=ohne Tobias').count() === 1, '«ohne Tobias» beim Abendessen');
ok(await p.locator('.dash-meals >> text=Frühstück').count() === 0, 'Leere Mahlzeit nicht angezeigt');
await p.screenshot({ path: '/tmp/fp-test-start.png', fullPage: true });
// ToDos
const titles = await p.locator('.dash-todo-title').allInnerTexts();
ok(titles.length === 5 && titles[0] === 'Steuern', 'ToDos: überfällige zuerst, 5 sichtbar: ' + titles.join(' | '));
ok(await p.locator('.dash-todos >> text=Nicht meins').count() === 0, 'ToDo einer anderen Person nicht sichtbar');
ok(await p.locator('text=+ 1 weitere').count() === 1, '«+ 1 weitere»');
// abhaken
await p.locator('.dash-todo', { hasText: 'Steuern' }).locator('.todo-check').click(); await p.waitForTimeout(400);
ok(await p.locator('.dash-todo', { hasText: 'Steuern' }).count() === 0, 'ToDo abgehakt verschwindet');
ok((await p.evaluate(() => window.__all('todos'))).find((t) => t.id === 't2').done === true, 'ToDo in der Datenbank erledigt');
// ToDo antippen -> Sheet, schliessen -> zurück zur Startseite
await p.locator('.dash-todo-main', { hasText: 'Velo flicken' }).click(); await p.waitForTimeout(400);
ok(await p.locator('.sheet h2', { hasText: 'ToDo bearbeiten' }).count() === 1 && await p.locator('.tabbar .tab.active', { hasText: 'ToDo' }).count() === 1, 'ToDo-Fenster geöffnet');
await p.click('.sheet >> text=Abbrechen'); await p.waitForTimeout(400);
ok(await p.locator('.dash').count() === 1, 'Zurück auf der Startseite');
// Menü antippen
await p.locator('.dash-dish', { hasText: 'Spaghetti' }).click(); await p.waitForTimeout(500);
ok(await p.locator('.sheet input[value="Spaghetti Bolognese"]').count() === 1, 'Menü direkt geöffnet');
ok(await p.locator('.tabbar .tab.active', { hasText: 'Mehr' }).count() === 1, '«Mehr» aktiv bei Menü');
await p.click('.sheet >> text=Abbrechen'); await p.waitForTimeout(400);
ok(await p.locator('.dash').count() === 1, 'nach Menü zurück zur Startseite');
// Angeheftete Liste
const pin = p.locator('.dash-pin', { hasText: 'Einkauf Hof' });
ok(await pin.locator('.dash-pin-items li .dash-pin-item').count() === 5, 'Liste: 5 offene Punkte sichtbar (Erledigtes nicht)');
ok(await pin.locator('text=+ 2 weitere').count() === 1, 'Liste: «+ 2 weitere»');
await pin.locator('.dash-pin-item', { hasText: 'Milch' }).locator('xpath=preceding-sibling::button').click(); await p.waitForTimeout(500);
ok((await p.evaluate(() => window.__all('notes'))).find((n) => n.id === 'n1').items.find((i) => i.id === 'i1').done === true, 'Punkt direkt auf der Startseite abgehakt');
ok(await pin.locator('.dash-pin-item', { hasText: 'Milch' }).count() === 0, 'Abgehakter Punkt verschwindet');
ok(await p.locator('.dash-pin', { hasText: 'WLAN-Code' }).locator('text=sonne2026').count() === 1, 'Angeheftete Notiz mit Text');
// lösen
await p.locator('.dash-pin', { hasText: 'WLAN-Code' }).locator('button[aria-label="Von der Startseite lösen"]').click(); await p.waitForTimeout(500);
ok(await p.locator('.dash-pin', { hasText: 'WLAN-Code' }).count() === 0, 'Notiz bei mir gelöst');
const pins = (await p.evaluate(() => window.__all('notes'))).find((n) => n.id === 'n2').pins;
ok(pins[me].on === false, 'Pin nur bei mir aus');
ok(await p.locator('.dash-recent-row', { hasText: 'WLAN-Code' }).count() === 1, 'Gelöste Notiz erscheint unter «Zuletzt geändert»');
// Zuletzt geändert -> öffnen, zurück
await p.locator('.dash-recent-row', { hasText: 'Ferienideen' }).click(); await p.waitForTimeout(500);
ok(await p.locator('.note-title-input').inputValue() === 'Ferienideen', 'Notiz aus «Zuletzt geändert» geöffnet');
await p.click('text=‹ Zurück'); await p.waitForTimeout(400);
ok(await p.locator('.dash').count() === 1, 'Zurück zur Startseite nach der Notiz');
// Mehr
await p.click('.tabbar >> text=Mehr');
ok(await p.locator('.row', { hasText: 'Wochenplan' }).count() === 1 && await p.locator('.row .row-main', { hasText: /^Menüs/ }).count() === 1 && await p.locator('.row', { hasText: 'Familie' }).count() === 1, '«Mehr» zeigt Wochenplan, Menüs, Familie');
await p.click('.row >> text=Wochenplan'); await p.waitForTimeout(300);
ok(await p.locator('.topbar h1', { hasText: 'Wochenplan' }).count() === 1 && await p.locator('.topbar-back').count() === 1, 'Wochenplan mit Zurück-Pfeil');
ok(await p.locator('.tabbar .tab.active', { hasText: 'Mehr' }).count() === 1, '«Mehr» bleibt hervorgehoben');
ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'Wochenplan: kein seitliches Wischen');
await p.click('.topbar-back'); await p.waitForTimeout(200);
ok(await p.locator('.row', { hasText: 'Familie' }).count() === 1, 'Pfeil führt zu «Mehr»');
// Wochenplan-Link von Start
await p.click('.tabbar >> text=Start'); await p.click('text=Plan ›'); await p.waitForTimeout(300);
ok(await p.locator('.topbar h1', { hasText: 'Wochenplan' }).count() === 1, 'Link «Wochenplan ›» funktioniert');
// Neu laden -> Start
await p.click('.tabbar >> text=Einkauf'); await p.reload(); await p.waitForSelector('.tabbar');
ok(await p.locator('.dash').count() === 1, 'App startet immer auf der Startseite');
await p.screenshot({ path: '/tmp/fp-test-start2.png', fullPage: true });
console.log('Fehler:', errs);
await b.close();
