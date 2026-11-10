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

// v0.27 Hinweis «Neue Android-App bereit»: installiert Build 5, auf GitHub Build 7
const mk = async (installed) => {
  const c = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  let asked = 0;
  await c.route('https://api.github.com/**', (r) => { asked++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ body: 'Neueste Android-App: Version 1.2 (Build 7). Auf dem Handy …' }) }); });
  await c.addInitScript({ content: `window.FPAndroid = { saveFile() {}, shareFile() {}${installed ? `, versionCode: () => ${installed}, versionName: () => '1.x (Build ${installed})'` : ''} };` });
  const q = await c.newPage(); q.on('pageerror', (e) => errs.push(String(e)));
  await q.goto('http://localhost:8765/docs-test/'); await q.waitForSelector('.tabbar'); await q.waitForTimeout(500);
  return { c, q, asked: () => asked };
};
{
  const { c, q, asked } = await mk(0); // APK 1.1: kennt ihre Nummer nicht → Build 5
  const card = q.locator('[data-testid=apk-update]');
  ok(await card.count() === 1 && (await card.innerText()).includes('1.2 (Build 7)') && (await card.innerText()).includes('1.1 (Build 5)'), 'APK 1.1 installiert, 1.2 auf GitHub: Hinweis auf der Startseite');
  ok(await card.locator('a').getAttribute('href') === 'https://github.com/leibi-tech/family-planner/releases/download/android/family-planner.apk', 'Knopf «Herunterladen» führt zur APK');
  ok((await q.locator('.foot').innerText()).includes('Android-App 1.1 (Build 5)'), 'Unten: installierte Android-App-Version');
  await card.locator('text=Später').click();
  ok(await card.count() === 0, '«Später» blendet den Hinweis aus');
  await q.reload(); await q.waitForSelector('.tabbar'); await q.waitForTimeout(300);
  ok(await card.count() === 0 && asked() === 1, 'Nach Neuladen: bleibt ausgeblendet, GitHub nur einmal gefragt');
  await c.close();
}
{
  const { c, q } = await mk(7);
  ok(await q.locator('[data-testid=apk-update]').count() === 0, 'Neueste APK installiert: kein Hinweis');
  await c.close();
}
{
  const c = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  let asked = 0; await c.route('https://api.github.com/**', (r) => { asked++; r.abort(); });
  const q = await c.newPage(); await q.goto('http://localhost:8765/docs-test/'); await q.waitForSelector('.tabbar'); await q.waitForTimeout(300);
  ok(asked === 0 && await q.locator('[data-testid=apk-update]').count() === 0 && !(await q.locator('.foot').innerText()).includes('Android'), 'Im Browser: kein Hinweis, GitHub wird nicht gefragt');
  await c.close();
}

// v0.32 / APK 1.4: «Teilen» aus einer anderen App an die APK. Die Hülle hält die Datei bereit
// (FPAndroid.takeShared, nur einmal) und öffnet die App mit ?teilen=1.
{
  const pdfText = '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n4 0 obj << /Type /Page /Parent 2 0 R >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';
  const share = async (file) => {
    const c = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
    await c.addInitScript({ content: `window.__taken = 0; window.__shared = ${JSON.stringify(file ? JSON.stringify(file) : "")};
      window.FPAndroid = { saveFile() {}, shareFile() {}, versionCode: () => 99, versionName: () => '1.4 (Build 99)',
        takeShared: () => { window.__taken++; const s = window.__shared; window.__shared = ''; return s; } };` });
    const q = await c.newPage(); q.on('pageerror', (e) => errs.push(String(e)));
    await q.goto('http://localhost:8765/docs-test/?teilen=1'); await q.waitForSelector('.tabbar');
    return { c, q };
  };
  {
    const { c, q } = await share({ name: 'Rechnung Garage.pdf', mime: 'application/pdf', data: Buffer.from(pdfText, 'latin1').toString('base64') });
    await q.waitForSelector('.docs-form', { timeout: 8000 });
    ok((await q.locator('.topbar h1').innerText()) === 'Dokumente', 'APK: geteiltes PDF öffnet die Seite Dokumente');
    ok((await q.locator('.docs-form-file').innerText()).includes('2 Seiten'), 'APK: «Neues Dokument» mit dem geteilten PDF (2 Seiten)');
    await q.waitForTimeout(300);
    ok(!q.url().includes('teilen') && await q.evaluate(() => window.__taken) === 1, 'APK: Datei nur einmal abgeholt, Adresse wieder ohne ?teilen');
    await c.close();
  }
  {
    const img = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#333'; x.fillRect(0, 0, 600, 800); x.fillStyle = '#f4f1ea'; x.fillRect(80, 80, 440, 640); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; }), 'base64');
    const { c, q } = await share({ name: 'IMG_2041.jpg', mime: 'image/jpeg', data: img.toString('base64') });
    await q.waitForSelector('.scan', { timeout: 8000 });
    ok(await q.locator('.scan').count() === 1, 'APK: geteiltes Foto öffnet den Scanner (Ecken, gerade ziehen)');
    await c.close();
  }
  {
    const { c, q } = await share('');
    await q.waitForTimeout(500);
    ok(await q.locator('.docs-form').count() === 0 && await q.locator('.scan').count() === 0, 'APK: ?teilen=1 ohne Datei → nur Seite Dokumente, kein Fenster');
    await c.close();
  }
}

ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
