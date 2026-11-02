// v0.24 Einstellung «Einkaufsliste aus Menüs»: Standard aus. Ausschalten lässt Bestehendes stehen,
// Einschalten bringt nur danach eingeplante Menüs in die Einkaufsliste.
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
const now = Date.now();
const menu = (id, name, product) => ({ id, name, mealTypes: ['mittag', 'abend'], basis: { kind: 'family', baseFactor: 2.6 }, ingredients: [{ id: 'i' + id, product, amount: 1, unit: 'Stk.', category: 'lebensmittel' }], note: '', updatedAt: now, deleted: false });
await p.evaluate(async (ms) => window.__put('menus', ms), [menu('m1', 'Milchreis', 'Milch'), menu('m2', 'Brotzeit', 'Brot'), menu('m3', 'Fondue', 'Käse')]);
await p.reload(); await p.waitForSelector('.tabbar');

const more = async () => { await p.click('.tabbar >> text=Mehr'); await p.waitForSelector('.more-grid'); };
const setShop = async (label) => { await more(); await p.locator('[aria-label="Einkaufsliste aus Menüs"] button', { hasText: label }).click(); await p.waitForTimeout(200); };
const plan = async (dayIdx, slot, name) => {
  await more(); await p.click('.more-grid .row >> text=Wochenplan'); await p.waitForSelector('.day');
  await p.locator('.day').nth(dayIdx).locator('.slot', { hasText: slot }).click();
  await p.locator('.sheet .row', { hasText: name }).click(); await p.waitForTimeout(300);
};
const shopItems = async () => { await p.click('.tabbar >> text=Einkauf'); await p.waitForTimeout(300); return p.locator('.shop-name b').allTextContents(); };

// Standard: aus
await more();
ok(await p.locator('[aria-label="Einkaufsliste aus Menüs"] button.on').textContent() === 'Aus', 'Standard: «Einkaufsliste aus Menüs» ist aus');
await plan(0, 'Mittagessen', 'Milchreis');
let list = await shopItems();
ok(!list.includes('Milch'), 'Aus: eingeplantes Menü kommt nicht in die Einkaufsliste');
ok(await p.locator('.hint', { hasText: 'Mehr → Einstellungen' }).count() === 1, 'Leere Liste verweist auf die Einstellung');

// Einschalten: nur danach Eingeplantes kommt dazu
await setShop('Ein');
await plan(0, 'Abendessen', 'Brotzeit');
list = await shopItems();
ok(list.includes('Brot') && !list.includes('Milch'), 'Ein: neu eingeplantes Menü kommt dazu, vorher eingeplantes nicht (' + list.join(', ') + ')');

// Ausschalten: Bestehendes bleibt, Neues kommt nicht
await setShop('Aus');
await plan(1, 'Mittagessen', 'Fondue');
list = await shopItems();
ok(list.includes('Brot') && !list.includes('Käse'), 'Wieder aus: Brot bleibt, neues Menü (Käse) kommt nicht (' + list.join(', ') + ')');

// Gespeichert für den Haushalt (Eintrag in «shopping», wird mit abgeglichen)
const rec = (await p.evaluate(() => window.__all('shopping'))).find((r) => r.id === 'einstellungen');
ok(rec && rec.fromMenus === false && rec.dirty === true, 'Einstellung als gemeinsamer Eintrag gespeichert');
await p.reload(); await p.waitForSelector('.tabbar');
list = await shopItems();
ok(list.includes('Brot') && !list.includes('Käse') && !list.includes('Milch'), 'Nach Neuladen unverändert');

ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
