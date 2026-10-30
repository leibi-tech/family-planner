// Dokumente (v0.21) ohne Haushalt: scannen (Blatt finden, Ecke ziehen, Filter, mehrere Seiten → PDF),
// Angaben, ansehen, PDF wählen, bearbeiten, suchen, löschen, «Teilen» aus einer anderen App.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__files = async () => { const db = await window.__idb(); return new Promise((res) => { const os = db.transaction('files').objectStore('files'); const k = os.getAllKeys(); k.onsuccess = () => { const v = os.getAll(); v.onsuccess = () => res(k.result.map((key, i) => ({ key, pending: v.result[i].pending, blob: v.result[i].blob }))); }; }); };
// Foto eines Blatts auf dunklem Tisch, schräg aufgenommen, mit Schatten
window.__photo = (q, paper = true) => { const c = document.createElement('canvas'); c.width = 1200; c.height = 1600; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 1600); g.addColorStop(0, '#4a4038'); g.addColorStop(1, '#2c2620'); x.fillStyle = g; x.fillRect(0, 0, 1200, 1600);
  for (let i = 0; i < 4000; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.25 + ')'; x.fillRect(Math.random() * 1200, Math.random() * 1600, 3, 3); }
  if (paper) { x.beginPath(); q.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath();
    const pg = x.createLinearGradient(0, 0, 1200, 0); pg.addColorStop(0, '#f2efe8'); pg.addColorStop(1, '#b9b4aa'); x.fillStyle = pg; x.fill();
    x.save(); x.clip(); x.fillStyle = '#222'; for (let r = 0; r < 18; r++) x.fillRect(260, 330 + r * 60, 500 + (r % 3) * 80, 14); x.fillStyle = '#c22'; x.fillRect(700, 1250, 180, 60); x.restore(); }
  return c.toDataURL('image/jpeg', 0.9).split(',')[1]; };
`;
const mk = async (sw = 'block') => { const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: sw, acceptDownloads: true }); await ctx.addInitScript({ content: helpers }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('dialog', (d) => d.accept()); await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar'); return { ctx, p }; };

const { p } = await mk();
await p.click('.tabbar >> text=Mehr');
await p.click('.more-grid >> text=Dokumente');
await p.waitForSelector('.docs-add');
ok((await p.locator('.docs').innerText()).includes('nur auf diesem Handy'), 'Ohne Haushalt: Hinweis «nur auf diesem Handy»');
ok(await p.locator('.docs-empty').count() === 1, 'Leer: Hinweis «Noch keine Dokumente»');

// 1) Scannen: Blatt finden
const truth = [[180, 230], [1010, 170], [1060, 1420], [140, 1470]];
const photo = await p.evaluate((q) => window.__photo(q), truth);
await p.setInputFiles('[data-testid=docs-camera]', { name: 'IMG_1.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') });
await p.waitForSelector('[data-testid=corner-0]', { timeout: 10000 });
const corners = async () => p.evaluate(() => [0, 1, 2, 3].map((i) => { const g = document.querySelector(`[data-testid=corner-${i}]`); return [Number(g.dataset.x), Number(g.dataset.y)]; }));
const found = await corners();
const err = Math.max(...found.map((c, i) => Math.hypot(c[0] - truth[i][0], c[1] - truth[i][1])));
ok(err < 30, `Blatt automatisch gefunden (grösste Abweichung ${Math.round(err)} px von 1600)`);
ok((await p.locator('.scan').innerText()).includes('Blatt gefunden'), 'Hinweis «Blatt gefunden»');

// Ecke von Hand verschieben (oben links etwas nach innen ziehen)
const box = await p.locator('.scan-svg').boundingBox();
const sc = box.width / 1200;
const dot = await p.locator('[data-testid=corner-0] circle.scan-dot').boundingBox();
await p.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + 200 * sc, box.y + 250 * sc, { steps: 5 });
await p.mouse.up();
const moved = (await corners())[0];
ok(Math.abs(moved[0] - 200) < 6 && Math.abs(moved[1] - 250) < 6, `Ecke gezogen auf ${moved.join('/')}`);
// wieder genau auf die Ecke
await p.mouse.move(box.x + 200 * sc, box.y + 250 * sc); await p.mouse.down(); await p.mouse.move(box.x + 180 * sc, box.y + 230 * sc, { steps: 3 }); await p.mouse.up();

// Filter Schwarz-weiss, übernehmen
await p.click('.scan-filter >> text=Schwarz-weiss');
await p.click('text=Seite übernehmen');
await p.waitForSelector('.scan-pages img');
const pix = await p.evaluate(async () => { const img = document.querySelector('.scan-pages img'); await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const at = (fx, fy) => Array.from(x.getImageData(Math.floor(fx * (c.width - 1)), Math.floor(fy * (c.height - 1)), 1, 1).data.slice(0, 3));
  return { w: c.width, h: c.height, corners: [at(0.02, 0.02), at(0.98, 0.02), at(0.98, 0.98), at(0.02, 0.98)], right: at(0.95, 0.5), gray: at(0.85, 0.82),
    text: (() => { const d = x.getImageData(Math.floor(c.width * 0.2), Math.floor(c.height * 0.1), Math.floor(c.width * 0.3), Math.floor(c.height * 0.4)).data; let m = 255; for (let i = 0; i < d.length; i += 4) m = Math.min(m, d[i]); return [m]; })() }; });
ok(pix.corners.every((c) => c[0] > 200), 'Gerade gezogen: alle Ecken sind Papier (kein Tisch mehr) ' + JSON.stringify(pix.corners.map((c) => c[0])));
ok(pix.right[0] > 225, `Schatten entfernt: rechter, dunklerer Rand wird weiss (${pix.right[0]})`);
ok(pix.text[0] < 90, `Schrift bleibt dunkel (${pix.text[0]})`);
ok(pix.gray[0] === pix.gray[1] && pix.gray[1] === pix.gray[2], 'Schwarz-weiss: keine Farbe');
ok(Math.abs(pix.w / pix.h - 870 / 1250) < 0.05, `Seitenverhältnis wie das Blatt (${pix.w}x${pix.h})`);
ok((await p.locator('.scan-title').innerText()).includes('1 Seite'), 'Kopf: 1 Seite');

// 2) Weitere Seite aus der Galerie, ohne erkennbares Blatt → ganzes Bild
const flat = await p.evaluate(() => window.__photo([], false));
await p.setInputFiles('[data-testid=scan-gallery]', { name: 'IMG_2.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(flat, 'base64') });
await p.waitForSelector('[data-testid=corner-0]');
ok((await p.locator('.scan').innerText()).includes('Kein Blatt erkannt'), 'Ohne Blatt: Hinweis, Punkte selber setzen');
ok(JSON.stringify(await corners()) === JSON.stringify([[0, 0], [1200, 0], [1200, 1600], [0, 1600]]), 'Ohne Blatt: ganzes Bild');
await p.click('.scan-filter >> text=Farbe');
await p.click('text=Seite übernehmen');
await p.waitForSelector('.scan-pages li:nth-child(2) img');
// Seite entfernen und mit Drehen nochmals
await p.click('button[aria-label="Seite 2 entfernen"]');
ok(await p.locator('.scan-pages li').count() === 1, 'Seite entfernt');
await p.setInputFiles('[data-testid=scan-camera]', { name: 'IMG_3.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') });
await p.waitForSelector('[data-testid=corner-0]');
await p.click('text=↻ Drehen');
await p.waitForTimeout(300);
ok(Number(await p.locator('[data-testid=corner-2]').getAttribute('data-x')) > 1300, 'Drehen: Bild ist jetzt quer');
await p.click('text=Seite übernehmen');
await p.waitForSelector('.scan-pages li:nth-child(2) img');
await p.click('text=Fertig (2 Seiten)');

// 3) Angaben
await p.waitForSelector('.docs-form');
ok((await p.locator('.docs-form-file').innerText()).includes('2 Seiten'), 'Formular: 2 Seiten');
ok(await p.locator('button:has-text("Speichern")').isDisabled(), 'Speichern erst mit Titel');
await p.fill('.docs-form input[maxlength="120"]', 'Waschmaschine');
await p.click('.docs-form .chip:has-text("Garantie")');
ok((await p.locator('.docs-form').innerText()).includes('Garantie bis'), 'Art Garantie: Feld heisst «Garantie bis»');
const soon = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
await p.fill('.docs-form input[type=date] >> nth=1', soon);
await p.fill('.docs-form textarea', 'Händler: Fust');
await p.click('button:has-text("Speichern")');
await p.waitForSelector('.docs-view');
await p.waitForSelector('.docs-pages img', { timeout: 5000 });
ok(await p.locator('.docs-pages img').count() === 2, 'Ansicht: beide Seiten aus dem PDF sichtbar');
ok((await p.locator('.docs-view').innerText()).includes('nur auf diesem Handy'), 'Ansicht: «nur auf diesem Handy»');
ok((await p.locator('.docs-view').innerText()).includes('Händler: Fust'), 'Ansicht: Notiz');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Herunterladen")')]);
ok(/^\d{4}-\d\d-\d\d Waschmaschine\.pdf$/.test(dl.suggestedFilename()), 'Herunterladen: ' + dl.suggestedFilename());

// PDF prüfen
const pdf = await p.evaluate(async () => { const f = (await window.__files())[0]; const t = new TextDecoder('latin1').decode(new Uint8Array(await f.blob.arrayBuffer())); return { pending: f.pending, type: f.blob.type, t }; });
ok(pdf.type === 'application/pdf' && pdf.t.startsWith('%PDF-1.4'), 'Datei ist ein PDF');
ok((pdf.t.match(/\/Subtype \/Image/g) || []).length === 2 && pdf.t.includes('/Count 2'), 'PDF mit 2 Seiten');
const xref = Number(/startxref\n(\d+)/.exec(pdf.t)[1]);
const offs = [...pdf.t.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
ok(pdf.t.slice(xref, xref + 4) === 'xref' && offs.every((o, i) => pdf.t.slice(o).startsWith(`${i + 1} 0 obj`)), 'PDF-Verzeichnis (xref) stimmt, andere Programme können es öffnen');
ok(pdf.pending === true, 'Datei wartet aufs Hochladen (ohne Haushalt bleibt sie hier)');
const rec = (await p.evaluate(() => window.__all('docs')))[0];
ok(rec.file.pages === 2 && rec.category === 'garantie' && rec.until === soon && rec.thumb?.startsWith('data:image/jpeg'), 'Angaben gespeichert, mit Vorschaubild');

// 4) Liste
await p.click('text=‹ Alle Dokumente');
ok((await p.locator('.docs-row').innerText()).includes('Garantie bis'), 'Liste: «Garantie bis …»');
ok(await p.locator('.docs-until.bald').count() === 1 && await p.locator('.docs-soon').count() === 1, 'Läuft in 20 Tagen ab: Hinweis «Läuft bald ab»');

// 5) PDF wählen (z.B. aus einer Scanner-App)
await p.setInputFiles('[data-testid=docs-file]', { name: 'police.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.t, 'latin1') });
await p.waitForSelector('.docs-form');
ok((await p.locator('.docs-form-file').innerText()).includes('2 Seiten') && await p.locator('.docs-form-file img').count() === 1, 'PDF gewählt: Seitenzahl und Vorschau erkannt');
await p.fill('.docs-form input[maxlength="120"]', 'Hausrat Police');
await p.click('.docs-form .chip:has-text("Versicherung")');
await p.click('button:has-text("Speichern")');
await p.waitForSelector('.docs-pages img');
await p.click('text=‹ Alle Dokumente');
ok(await p.locator('.docs-row').count() === 2, 'Liste: 2 Dokumente');
await p.setInputFiles('[data-testid=docs-file]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hallo') });
await p.waitForTimeout(200);
ok((await p.locator('.warn').innerText()).includes('PDF oder ein Foto'), 'Andere Datei: Hinweis');

// 6) Suchen und Filter
await p.fill('.docs-search', 'police');
ok(await p.locator('.docs-row').count() === 1, 'Suche «police»: 1 Treffer');
await p.fill('.docs-search', '');
await p.click('.docs-chips .chip:has-text("Garantie")');
ok(await p.locator('.docs-row').count() === 1 && (await p.locator('.docs-row').innerText()).includes('Waschmaschine'), 'Filter Garantie');
await p.click('.docs-chips .chip:has-text("Alle")');

// 7) Bearbeiten und löschen
await p.click('.docs-row:has-text("Hausrat")');
await p.click('text=Angaben bearbeiten');
await p.fill('.docs-form input[maxlength="120"]', 'Hausrat Police 2026');
await p.click('button:has-text("Speichern")');
await p.waitForSelector('.docs-view h2:has-text("Hausrat Police 2026")');
ok(true, 'Bearbeitet');
await p.click('.docs-view button:has-text("Löschen")');
await p.waitForSelector('.docs-list');
await p.waitForTimeout(300);
ok(await p.locator('.docs-row').count() === 1 && (await p.evaluate(() => window.__files())).length === 1, 'Gelöscht, auch die Datei auf dem Handy');

// 8) Über «Teilen» aus einer anderen App (Service Worker nimmt die Datei an)
const S = await mk('allow');
await S.p.evaluate(() => navigator.serviceWorker.ready);
await S.p.reload(); await S.p.waitForSelector('.tabbar');
ok(await S.p.evaluate(() => !!navigator.serviceWorker.controller), 'Service Worker aktiv');
await S.p.evaluate((t) => {
  const bytes = Uint8Array.from(t, (ch) => ch.charCodeAt(0));
  const f = new File([bytes], 'Scan aus Drive.pdf', { type: 'application/pdf' });
  const form = document.createElement('form'); form.method = 'POST'; form.action = './teilen'; form.enctype = 'multipart/form-data';
  const inp = document.createElement('input'); inp.type = 'file'; inp.name = 'file'; const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  form.appendChild(inp); document.body.appendChild(form); form.submit();
}, pdf.t);
await S.p.waitForURL(/teilen=1/);
await S.p.waitForSelector('.docs-form', { timeout: 8000 });
ok((await S.p.locator('.docs-form-file').innerText()).includes('2 Seiten'), 'Geteiltes PDF öffnet direkt «Neues Dokument»');
await S.p.waitForTimeout(300);
ok(!S.p.url().includes('teilen'), 'Adresse wieder ohne ?teilen');

ok(errs.length === 0, 'keine Fehler im Browser ' + errs.join(' | '));
await b.close();
