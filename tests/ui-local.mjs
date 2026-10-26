import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await page.goto('http://localhost:8765/docs-test/');
await page.click('.tabbar >> text=Notizen');
ok(await page.locator('.tabbar').isVisible(), 'Menüleiste sichtbar');
// Tab bar fits
const bar = await page.locator('.tabbar').boundingBox(); ok(bar.width <= 390, 'Tabbar nicht breiter als Bildschirm');
ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'kein seitliches Wischen (Liste)');
// Notiz
await page.click('text=+ Notiz');
ok(await page.locator('.tabbar').isVisible(), 'Menüleiste im Editor sichtbar');
await page.fill('.note-title-input', 'Geschenkideen');
await page.fill('.note-body', 'Papa: Buch\nMama: Schal');
await page.waitForTimeout(900);
await page.click('text=‹ Zurück');
ok(await page.locator('.note-card', { hasText: 'Geschenkideen' }).count() === 1, 'Notiz in Übersicht');
ok(await page.locator('.note-card', { hasText: 'Mama: Schal' }).count() === 1, 'Vorschau zeigt Text');
// Liste mit Unterpunkten
await page.click('text=+ Liste');
await page.fill('.note-title-input', 'Packliste Ferien');
await page.fill('input[aria-label="Neuer Punkt"]', 'Kleider'); await page.keyboard.press('Enter');
await page.fill('input[aria-label="Neuer Punkt"]', 'Zahnbürsten'); await page.keyboard.press('Enter');
await page.fill('input[aria-label="Neuer Punkt"]', 'Sonnencreme'); await page.keyboard.press('Enter');
await page.waitForTimeout(300);
ok(await page.locator('.ni-text').count() === 3, '3 Hauptpunkte');
await page.locator('.ni-group', { hasText: 'Kleider' }).locator('button[aria-label="Unterpunkt hinzufügen"]').click();
await page.fill('input[aria-label="Neuer Unterpunkt"]', 'Socken'); await page.keyboard.press('Enter');
await page.fill('input[aria-label="Neuer Unterpunkt"]', 'T-Shirts'); await page.keyboard.press('Enter');
await page.waitForTimeout(300);
ok(await page.locator('.ni-row.sub .ni-text').count() === 2, '2 Unterpunkte');
// abhaken -> rutscht nach unten
await page.locator('.ni-group', { hasText: 'Kleider' }).locator('.ni-row:not(.sub) .todo-check').click();
await page.waitForTimeout(300);
const order = await page.locator('.ni-list > li > .ni-row:not(.sub) .ni-text').allInnerTexts();
ok(order[order.length - 1].startsWith('Kleider'), 'Abgehakter Punkt rutscht nach unten: ' + order.join(' | '));
// Unterpunkt abhaken zeigt Zähler
await page.locator('.ni-row.sub .todo-check').first().click(); await page.waitForTimeout(300);
ok((await page.locator('.ni-count').innerText()).trim() === '1/2', 'Zähler 1/2');
// Punkt bearbeiten + löschen
await page.locator('.ni-text', { hasText: 'Sonnencreme' }).click();
await page.fill('.ni-edit', 'Sonnencreme LSF 50'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
ok(await page.locator('.ni-text', { hasText: 'LSF 50' }).count() === 1, 'Punkt umbenannt');
await page.locator('.ni-text', { hasText: 'Zahnbürsten' }).click();
await page.click('button[aria-label="Punkt löschen"]'); await page.waitForTimeout(300);
ok(await page.locator('.ni-text', { hasText: 'Zahnbürsten' }).count() === 0, 'Punkt gelöscht');
// Pin
await page.click('button[aria-label="Anheften"]');
ok(await page.locator('text=Für alle anheften').count() === 1, 'Pin-Menü mit «für alle»');
await page.click('text=📌 Für mich anheften'); await page.waitForTimeout(300);
// privat
await page.click('button[aria-label="Für alle sichtbar"]');
ok(await page.locator('text=Nur du siehst').count() === 1, 'Rückfrage privat');
await page.click('text=Privat machen'); await page.waitForTimeout(500);
ok(await page.locator('button[aria-label^="Privat"]').count() === 1, 'Schloss zu');
await page.click('button[aria-label="Anheften"]');
ok(await page.locator('text=Für alle anheften').count() === 0, 'Private: kein «für alle»');
await page.click('button[aria-label="Anheften"]');
await page.click('text=‹ Zurück');
let cards = await page.locator('.note-card').allInnerTexts();
ok(cards.length === 2 && cards[0].includes('Packliste Ferien') && cards[0].includes('🔒') && cards[0].includes('📌'), 'Liste oben (angeheftet), privat: ' + JSON.stringify(cards[0]));
ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'kein seitliches Wischen (Übersicht)');
// Neu laden -> bleibt
await page.reload(); await page.waitForSelector('.dash'); await page.click('.tabbar >> text=Notizen'); await page.waitForSelector('.note-card');
ok(await page.locator('.note-card').count() === 2, 'nach Neuladen noch da');
await page.locator('.note-card', { hasText: 'Packliste' }).click();
ok(await page.locator('.ni-row.sub').count() === 2 && await page.locator('.ni-text', { hasText: 'LSF 50' }).count() === 1, 'Inhalt der Liste erhalten');
await page.screenshot({ path: '/tmp/fp-test-list.png' });
await page.click('text=‹ Zurück');
await page.screenshot({ path: '/tmp/fp-test-overview.png' });
// Löschen
await page.locator('.note-card', { hasText: 'Geschenkideen' }).click();
await page.click('text=Notiz löschen'); await page.click('text=Wirklich löschen?'); await page.waitForTimeout(300);
ok(await page.locator('.note-card').count() === 1, 'Notiz gelöscht');
console.log('Fehler in Konsole:', errs);
await b.close();
