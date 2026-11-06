// v0.24 Einstellung «Einkaufsliste aus Menüs»: Standard aus. Ausschalten lässt Bestehendes stehen,
// Einschalten bringt nur danach eingeplante Menüs in die Einkaufsliste. v0.25: «Fragen».
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
await p.evaluate(async (ms) => window.__put('menus', ms), [menu('m1', 'Milchreis', 'Milch'), menu('m2', 'Brotzeit', 'Brot'), menu('m3', 'Fondue', 'Käse'), { ...menu('m4', 'Pizza', 'Mehl'), ingredients: [{ id: 'a', product: 'Mehl', amount: 500, unit: 'g', category: 'lebensmittel' }, { id: 'b', product: 'Tomaten', amount: 2, unit: 'Dose', category: 'lebensmittel' }, { id: 'c', product: 'Salz', amount: null, unit: '', category: 'lebensmittel' }] }, menu('m5', 'Suppe', 'Lauch')]);
await p.reload(); await p.waitForSelector('.tabbar');

const more = async () => { await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid >> text=Einstellungen'); await p.waitForSelector('[aria-label="Einkaufsliste aus Menüs"]'); };
const setShop = async (label) => { await more(); await p.locator('[aria-label="Einkaufsliste aus Menüs"] button', { hasText: label }).click(); await p.waitForTimeout(200); };
const plan = async (dayIdx, slot, name) => {
  await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid .row >> text=Wochenplan'); await p.waitForSelector('.day');
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

// Fragen: nach dem Einplanen erscheint die Frage, Artikel lassen sich anpassen
await setShop('Fragen');
await plan(2, 'Mittagessen', 'Pizza');
const dlg = p.locator('[aria-label="Einkaufsliste ergänzen"]');
ok(await dlg.count() === 1, 'Fragen: «Einkaufsliste ergänzen?» erscheint nach dem Einplanen');
ok(await dlg.locator('.ask-name').count() === 3 && (await dlg.locator('[aria-label="Menge Mehl"]').inputValue()) !== '', 'Zutaten mit berechneter Menge vorgeschlagen');
await dlg.locator('[aria-label="Menge Mehl"]').fill('1');
await dlg.locator('[aria-label="Einheit Mehl"]').selectOption('kg');
await dlg.locator('[aria-label="Nicht kaufen: Salz"]').click();
await dlg.locator('button', { hasText: '+ Artikel' }).click();
await dlg.locator('.ask-name').nth(3).fill('Mozzarella');
await dlg.locator('button', { hasText: 'in die Einkaufsliste' }).click(); await p.waitForTimeout(300);
ok(await dlg.count() === 0, 'Fenster schliesst nach dem Übernehmen');
list = await shopItems();
ok(list.includes('Mehl') && list.includes('Tomaten') && list.includes('Mozzarella') && !list.includes('Salz'), 'Angepasste Artikel in der Liste, abgewählter nicht (' + list.join(', ') + ')');
const mehl = p.locator('.shop-item', { hasText: 'Mehl' });
ok((await mehl.locator('.shop-qty').textContent()).trim() === '1 kg', 'Geänderte Menge übernommen');
ok((await mehl.locator('.shop-src').textContent()).includes('Pizza'), 'Herkunft zeigt das Menü');
await plan(2, 'Abendessen', 'Suppe');
await p.locator('[aria-label="Einkaufsliste ergänzen"] button', { hasText: 'Nein, danke' }).click();
list = await shopItems();
ok(!list.includes('Lauch'), '«Nein, danke»: nichts übernommen');
await more();
ok(await p.locator('[aria-label="Einkaufsliste aus Menüs"] button.on').textContent() === 'Fragen', 'Einstellung «Fragen» gespeichert');

ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
