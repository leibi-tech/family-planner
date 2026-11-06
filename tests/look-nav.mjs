// v0.19 Neues Aussehen: Menüleiste selber einrichten, Hell/Dunkel, Mehr-Kacheln.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar');
const tabs = () => p.locator('.tabbar .tab').allTextContents();
const theme = () => p.evaluate(() => document.documentElement.dataset.theme);

ok(JSON.stringify(await tabs()) === JSON.stringify(['Einkauf', 'ToDo', 'Start', 'Kalender', 'Mehr']), 'Standard-Leiste: Einkauf, ToDo, Start, Kalender, Mehr');
ok(await theme() === 'light', 'Standard: hell');
ok(await p.locator('.tabbar svg.ico').count() === 5, 'Symbole statt Emojis in der Leiste');

// Mehr: Kacheln + Einstellungen
await p.click('.tabbar >> text=Mehr');
ok(await p.locator('.more-grid .row').count() === 7, '«Mehr» zeigt die 7 nicht angehefteten Seiten (mit Einstellungen)');
ok(await p.locator('.more-grid .row', { hasText: 'Kalender' }).count() === 0, 'Angeheftete Seite nicht unter «Mehr»');

// Leiste anpassen
await p.click('.more-grid >> text=Einstellungen');
ok(await p.locator('.topbar h1', { hasText: 'Einstellungen' }).count() === 1, 'Einstellungen: eigene Seite');
ok((await p.locator('[data-testid=about]').innerText()).includes('© 2026 Tobias Leibacher'), 'Einstellungen: Copyright');
ok((await p.locator('[data-testid=about]').innerText()).includes('Version 0.'), 'Einstellungen: Version');
await p.click('text=Datenschutzerklärung');
await p.waitForSelector('.privacy h1');
const priv = await p.locator('.privacy').innerText();
ok(priv.includes('Datenschutz – myFam.') && priv.includes('Supabase') && priv.includes('Limited Use') && !priv.includes('Zurück zur App'), 'Datenschutzerklärung in der App (ohne «Zurück zur App»)');
await p.click('.topbar-back');
ok(await p.locator('.topbar h1', { hasText: 'Einstellungen' }).count() === 1, 'Datenschutz → Zurück → Einstellungen');
await p.click('text=Menüleiste anpassen');
ok(await p.locator('.topbar h1', { hasText: 'Menüleiste' }).count() === 1 && await p.locator('.topbar-back').count() === 1, 'Seite «Menüleiste» mit Zurück-Pfeil');
ok(await p.locator('.nav-pin:disabled').count() === 7, 'Alle 3 Plätze belegt: Anheften gesperrt');
await p.click('[aria-label="Kalender lösen"]');
ok(JSON.stringify(await tabs()) === JSON.stringify(['Einkauf', 'ToDo', 'Start', 'frei', 'Mehr']), 'Kalender gelöst: Platz rechts frei, Start bleibt Mitte');
await p.locator('.nav-list li', { hasText: 'Kalender' }).locator('.nav-pin').click();
await p.click('[aria-label="Kalender nach links"]');
await p.click('[aria-label="Kalender nach links"]');
ok(JSON.stringify(await tabs()) === JSON.stringify(['Kalender', 'Einkauf', 'Start', 'ToDo', 'Mehr']), 'Kalender angeheftet und ganz nach links verschoben');

// bleibt nach Neuladen
await p.reload(); await p.waitForSelector('.tabbar');
ok(JSON.stringify(await tabs()) === JSON.stringify(['Kalender', 'Einkauf', 'Start', 'ToDo', 'Mehr']), 'Leiste bleibt nach Neuladen gespeichert');
await p.click('.tabbar >> text=Kalender'); await p.waitForTimeout(300);
ok(await p.locator('.tabbar .tab.active', { hasText: 'Kalender' }).count() === 1 && await p.locator('.topbar-back').count() === 0, 'Angehefteter Kalender: Knopf aktiv, kein Zurück-Pfeil');
await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid .row >> text=Notizen'); await p.waitForTimeout(300);
ok(await p.locator('.tabbar .tab.active', { hasText: 'Mehr' }).count() === 1 && await p.locator('.topbar-back').count() === 1, 'Notizen jetzt unter «Mehr» (Mehr aktiv, Zurück-Pfeil)');

// Dunkel
await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid >> text=Einstellungen'); await p.click('.seg button >> text=Dunkel');
ok(await theme() === 'dark', 'Dunkel eingeschaltet');
await p.reload(); await p.waitForSelector('.tabbar');
ok(await theme() === 'dark', 'Dunkel bleibt nach Neuladen');
const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
ok(bg === 'rgb(30, 27, 46)', 'Dunkel ist violett-blau, nicht schwarz (' + bg + ')');
await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid >> text=Einstellungen'); await p.click('.seg button >> text=Hell');

// Einstellungen anheften wie ToDo
await p.click('text=Menüleiste anpassen');
ok(await p.locator('.topbar-back[aria-label="Zurück zu Einstellungen"]').count() === 1, 'Menüleiste: Zurück führt zu den Einstellungen');
await p.click('[aria-label="Kalender lösen"]');
await p.locator('.nav-list li', { hasText: 'Einstellungen' }).locator('.nav-pin').click();
ok((await tabs()).includes('Einstellungen'), 'Einstellungen in der Menüleiste angeheftet');
await p.click('.tabbar >> text=Einstellungen');
ok(await p.locator('.tabbar .tab.active', { hasText: 'Einstellungen' }).count() === 1 && await p.locator('.topbar-back').count() === 0, 'Angeheftete Einstellungen: Knopf aktiv, kein Zurück-Pfeil');
ok(await p.evaluate(() => [...document.querySelectorAll('.tabbar .tab')].every((t) => t.scrollWidth <= t.clientWidth + 1)), 'Name «Einstellungen» passt in die Leiste');
ok(await theme() === 'light', 'Zurück auf hell');

// nichts ragt über den Bildschirm hinaus
ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Kein seitliches Wischen');
ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
