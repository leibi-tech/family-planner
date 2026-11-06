// v0.26 Android-App: Zurück-Taste (window.fpBack) und Speichern/Teilen über die Hülle (window.FPAndroid).
// Die Hülle wird nachgespielt: FPAndroid zeichnet die Aufrufe auf.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
await ctx.addInitScript({ content: `window.__calls = []; window.FPAndroid = {
  saveFile: (n, m, d) => window.__calls.push(['save', n, m, d.length]),
  shareFile: (n, m, d) => window.__calls.push(['share', n, m, d.length]) };` });
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('dialog', (d) => d.accept());
await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar');
const back = () => p.evaluate(() => window.fpBack());
const title = () => p.locator('.topbar h1').innerText();

ok(await back() === false, 'Startseite: Zurück → false (App geht in den Hintergrund)');

// Seite unter «Mehr» → Mehr → Start
await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid >> text=Dokumente'); await p.waitForSelector('.docs-add');
ok(await back() === true && (await title()) === 'Mehr', 'Dokumente → Zurück → Mehr');
ok(await back() === true && (await p.locator('.tabbar .tab.active').innerText()).includes('Start'), 'Mehr → Zurück → Startseite');

// Angeheftete Seite → Start
await p.click('.tabbar >> text=Einkauf'); await p.waitForTimeout(200);
ok(await back() === true && (await p.locator('.tabbar .tab.active').innerText()).includes('Start'), 'Einkauf → Zurück → Startseite');

// Fenster schliessen: ToDo erfassen
await p.click('.tabbar >> text=ToDo'); await p.waitForTimeout(200);
await p.locator('.fab, button:has-text("Neues ToDo"), button:has-text("+")').first().click();
await p.waitForSelector('.sheet-backdrop');
ok(await back() === true && await p.locator('.sheet-backdrop').count() === 0, 'Offenes Fenster → Zurück schliesst es');
ok((await p.locator('.tabbar .tab.active').innerText()).includes('ToDo'), '… und bleibt auf der Seite');

// Dokument: Scanner schliessen, Speichern und Teilen über die Hülle
await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid >> text=Dokumente'); await p.waitForSelector('.docs-add');
const img = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#333'; x.fillRect(0, 0, 600, 800); x.fillStyle = '#f4f1ea'; x.fillRect(80, 80, 440, 640); x.fillStyle = '#222'; for (let r = 0; r < 10; r++) x.fillRect(120, 140 + r * 50, 300, 10); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; });
await p.setInputFiles('[data-testid=docs-camera]', { name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(img, 'base64') });
await p.waitForSelector('.scan');
ok(await back() === true && await p.locator('.scan').count() === 0, 'Scanner → Zurück → Abbrechen');
await p.setInputFiles('[data-testid=docs-camera]', { name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(img, 'base64') });
await p.waitForSelector('text=Seite übernehmen'); await p.click('text=Seite übernehmen');
await p.click('text=/Fertig \\(1 Seite/'); await p.waitForSelector('.docs-form');
await p.fill('.docs-form input[maxlength="120"]', 'Quittung Velo');
await p.click('button:has-text("Speichern")'); await p.waitForSelector('.docs-view .docs-pages img');
ok(await p.locator('button:has-text("Teilen / öffnen mit")').count() === 1, 'In der APK: Knopf «Teilen / öffnen mit …» da');
await p.click('button:has-text("Herunterladen")'); await p.waitForTimeout(300);
await p.click('button:has-text("Teilen / öffnen mit")'); await p.waitForTimeout(300);
const calls = await p.evaluate(() => window.__calls);
ok(calls[0]?.[0] === 'save' && /Quittung Velo\.pdf$/.test(calls[0][1]) && calls[0][2] === 'application/pdf' && calls[0][3] > 1000, 'Herunterladen → Hülle speichert PDF (' + (calls[0] || []).slice(1).join(', ') + ')');
ok(calls[1]?.[0] === 'share' && calls[1][1] === calls[0][1], 'Teilen → Hülle teilt dieselbe Datei');
ok(await back() === true && await p.locator('.docs-view').count() === 0 && await p.locator('.docs-add').count() === 1, 'Dokument-Ansicht → Zurück → Liste');

ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
