// Datensicherung (v0.31): Sicherung erstellen (ZIP mit daten.json + Dokumenten), versehentlich gelöscht →
// einlesen holt es für alle zurück, Bestehendes bleibt, neues Handy (Umzug) ohne doppelte Person, falsche Datei.
import { chromium } from './pw.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__put = async (s, recs) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction(s, 'readwrite'); recs.forEach((r) => tx.objectStore(s).put(r)); tx.oncomplete = res; }); };
window.__setMeta = async (k, v) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__clearAll = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); return new Promise((res) => { const tx = db.transaction(names, 'readwrite'); names.forEach((n) => tx.objectStore(n).clear()); tx.oncomplete = res; }); };
window.__markDirty = async () => { for (const n of ['persons']) { const all = await window.__all(n); await window.__put(n, all.map((r) => ({ ...r, dirty: true }))); } };
window.__photo = () => { const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#333'; x.fillRect(0, 0, 900, 1200);
  x.fillStyle = '#f4f2ee'; x.beginPath(); x.moveTo(120, 140); x.lineTo(780, 110); x.lineTo(820, 1080); x.lineTo(90, 1110); x.closePath(); x.fill();
  x.fillStyle = '#222'; for (let r = 0; r < 12; r++) x.fillRect(200, 250 + r * 60, 420, 12); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; };
`;
const mk = async (fresh) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.addInitScript({ content: helpers + (fresh ? "try { localStorage.setItem('fp-test-fresh', '1'); } catch {}" : '') });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar'); return { ctx, p };
};
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const store = () => fetch('http://localhost:8766/__control/storage').then((r) => r.json());
await ctl('reset');

const A = await mk(); const B = await mk();
const persons = (await A.p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const sess = (uid) => ({ access_token: uid + ':tok', refresh_token: 'r', expires_at: 4102444800, user: { id: uid, email: uid + '@x.ch' } });
const hh = { id: 'hh1', name: 'Familie Test' };
await ctl('members', { __list: true, uA: { role: 'owner', person_id: persons[0].id }, uB: { role: 'member', person_id: persons[1].id } });
await A.p.evaluate(async ([s, h]) => { await window.__setMeta('session', s); await window.__setMeta('household', h); await window.__markDirty(); }, [sess('uA'), hh]);
await A.p.reload(); await A.p.waitForSelector('.tabbar'); await A.p.waitForTimeout(1500);
await B.p.evaluate(async ([s, h]) => { await window.__clearAll(); await window.__setMeta('session', s); await window.__setMeta('household', h); }, [sess('uB'), hh]);
await B.p.reload(); await B.p.waitForSelector('.tabbar'); await B.p.waitForTimeout(1500);
const sync = async (...ps) => { for (const p of ps) { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1800); } };
const live = async (p, s) => (await p.evaluate((s) => window.__all(s), s)).filter((r) => !r.deleted);

// Daten anlegen: zwei Menüs, eine Notiz, ein Dokument (gescannt)
const menu = (id, name) => ({ id, name, mealTypes: ['abend'], basis: { kind: 'family', baseFactor: 2.6 }, ingredients: [{ id: id + 'i', name: 'Teigwaren', amount: 500, unit: 'g' }], note: '', updatedAt: Date.now(), deleted: false, dirty: true });
await A.p.evaluate(([m1, m2]) => window.__put('menus', [m1, m2]), [menu('m1', 'Spaghetti Bolognese'), menu('m2', 'Älplermagronen')]);
await A.p.evaluate(() => window.__put('notes', [{ id: 'n1', title: 'Ferien packen', kind: 'note', body: 'Sonnencreme', items: [], pins: {}, private: false, createdBy: null, createdAt: Date.now(), editedBy: null, updatedAt: Date.now(), deleted: false, dirty: true }]));
await A.p.reload(); await A.p.waitForSelector('.tabbar');
await A.p.click('.tabbar >> text=Mehr'); await A.p.click('.more-grid >> text=Dokumente'); await A.p.waitForSelector('.docs-add');
const photo = await A.p.evaluate(() => window.__photo());
await A.p.setInputFiles('[data-testid=docs-camera]', { name: 'IMG.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') });
await A.p.click('text=Seite übernehmen'); await A.p.click('text=Fertig (1 Seite)');
await A.p.fill('.docs-form input[maxlength="120"]', 'Garantie Velo');
await A.p.click('button:has-text("Speichern")');
await A.p.waitForSelector('.docs-view >> text=in der Cloud gespeichert ✓', { timeout: 5000 });
await A.p.click('text=‹ Alle Dokumente');
await sync(A.p, B.p);
ok((await live(B.p, 'menus')).length === 2 && (await live(B.p, 'docs')).length === 1, 'B hat Menüs und Dokument');

// 1) Sicherung erstellen auf B (Dokument nur in der Ablage, nicht auf dem Handy)
const openBackup = async (p) => { await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid >> text=Einstellungen'); await p.click('text=Datensicherung'); await p.waitForSelector('.backup'); };
await openBackup(B.p);
ok((await B.p.locator('[data-testid=backup-last]').innerText()).includes('noch keine Sicherung'), 'Noch keine Sicherung');
await B.p.click('button:has-text("Sicherung erstellen")');
await B.p.waitForSelector('[data-testid=backup-made]', { timeout: 8000 });
const madeText = await B.p.locator('[data-testid=backup-made]').innerText();
ok(/1 Dokument/.test(madeText), madeText.split('\n')[0]);
ok((await B.p.evaluate(() => window.__all('files'))).length === 0, 'Dokument aus der Ablage geholt, ohne Kopie aufs Handy');
const [dl] = await Promise.all([B.p.waitForEvent('download'), B.p.click('button:has-text("Herunterladen")')]);
ok(/^myFam-Sicherung-\d{4}-\d\d-\d\d\.zip$/.test(dl.suggestedFilename()), 'Dateiname ' + dl.suggestedFilename());
const zipPath = '/tmp/fp-test-backup.zip';
await dl.saveAs(zipPath);
ok((await B.p.locator('[data-testid=backup-last]').innerText()).includes('Letzte Sicherung'), '«Letzte Sicherung» angezeigt');
// ZIP mit Python prüfen (Standard-ZIP, am PC lesbar)
const info = JSON.parse(execFileSync('python3', ['-c', `
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
d = json.loads(z.read('daten.json'))
print(json.dumps({'names': z.namelist(), 'menus': len(d['stores']['menus']), 'notes': len(d['stores']['notes']), 'files': d['files'], 'pdf': [z.read(n)[:5].decode() for n in z.namelist() if n.startswith('dokumente/')], 'dirty': any('dirty' in r for s in d['stores'].values() for r in s)}))
`, zipPath]).toString());
ok(info.names.includes('daten.json') && info.names.includes('LIESMICH.txt'), 'ZIP: daten.json und LIESMICH.txt');
ok(info.menus === 2 && info.notes === 1 && !info.dirty, 'ZIP: 2 Menüs, 1 Notiz, ohne interne Markierungen');
ok(info.pdf.length === 1 && info.pdf[0] === '%PDF-' && /Garantie Velo\.pdf$/.test(Object.values(info.files)[0]), 'ZIP: Dokument als PDF unter dokumente/ (CRC geprüft)');

// 2) Versehentlich gelöscht: A löscht Menü und Dokument → auch bei B weg
const m1 = (await live(A.p, 'menus')).find((m) => m.id === 'm1');
await A.p.evaluate((m) => window.__put('menus', [{ ...m, deleted: true, updatedAt: Date.now(), dirty: true }]), m1);
await A.p.click('.docs-row'); await A.p.waitForSelector('.docs-view'); await A.p.click('.docs-view button:has-text("Löschen")'); await A.p.waitForTimeout(800);
await sync(A.p, B.p);
ok((await live(B.p, 'menus')).length === 1 && (await live(B.p, 'docs')).length === 0, 'B: Menü und Dokument gelöscht');
ok(Object.keys(await store()).length === 0, 'Datei in der Ablage gelöscht');
// B ändert das andere Menü nach der Sicherung → bleibt beim Einlesen
const m2 = (await live(B.p, 'menus'))[0];
await B.p.evaluate((m) => window.__put('menus', [{ ...m, name: 'Älplermagronen mit Apfelmus', updatedAt: Date.now(), dirty: true }]), m2);

// 3) Einlesen auf B
await B.p.setInputFiles('[data-testid=backup-file]', zipPath);
await B.p.waitForSelector('[data-testid=backup-preview]');
const prev = await B.p.locator('[data-testid=backup-preview]').innerText();
ok(/Menüs: 2 · 1 fehlen/.test(prev) && /Dokumente: 1 · 1 fehlen/.test(prev) && /Notizen und Listen: 1 · alle vorhanden/.test(prev), 'Vorschau zählt, was fehlt');
ok(prev.includes('Familie Test'), 'Vorschau zeigt Familie');
await B.p.click('button:has-text("2 Einträge zurückholen")');
await B.p.waitForSelector('[data-testid=backup-done]');
ok((await B.p.locator('[data-testid=backup-done]').innerText()).includes('2 Einträge zurückgeholt'), '2 Einträge zurückgeholt');
const bm = await live(B.p, 'menus');
ok(bm.length === 2 && bm.some((m) => m.name === 'Älplermagronen mit Apfelmus'), 'Später Geändertes bleibt (nicht überschrieben)');
await B.p.waitForTimeout(1500);
await sync(B.p, A.p, B.p);
ok((await live(A.p, 'menus')).some((m) => m.id === 'm1' && m.name === 'Spaghetti Bolognese'), 'A: Menü wieder da (Abgleich)');
const st = await store();
const ad = await live(A.p, 'docs');
ok(ad.length === 1 && ad[0].title === 'Garantie Velo' && Object.keys(st).length === 1 && ad[0].file.path === Object.keys(st)[0], 'A: Dokument wieder da, Datei wieder in der Ablage');
await A.p.click('.tabbar >> text=Mehr'); await A.p.click('.more-grid >> text=Dokumente'); await A.p.waitForSelector('.docs-row');
await A.p.click('.docs-row'); await A.p.waitForSelector('.docs-pages img', { timeout: 5000 });
ok(true, 'A: zurückgeholtes Dokument lässt sich öffnen');

// 4) Gleiche Sicherung nochmals → nichts fehlt
await B.p.setInputFiles('[data-testid=backup-file]', zipPath);
await B.p.waitForSelector('[data-testid=backup-preview]');
ok((await B.p.locator('[data-testid=backup-preview]').innerText()).includes('Es fehlt nichts'), 'Nochmals einlesen: «Es fehlt nichts»');

// 5) Falsche Datei
writeFileSync('/tmp/fp-test-not.zip', 'kein zip');
await B.p.setInputFiles('[data-testid=backup-file]', '/tmp/fp-test-not.zip');
await B.p.waitForSelector('.backup .warn');
ok((await B.p.locator('.backup .warn').innerText()).includes('keine Sicherungsdatei'), 'Falsche Datei → Hinweis');

// 6) Umzug: neues Handy, Name eingegeben → Sicherung einlesen, keine doppelte Person
const C = await mk(true);
await C.p.waitForSelector('[aria-label="Willkommen"]');
await C.p.fill('[aria-label="Willkommen"] input', persons[0].name);
await C.p.click("text=Los geht's"); await C.p.waitForTimeout(300);
await openBackup(C.p);
await C.p.setInputFiles('[data-testid=backup-file]', zipPath);
await C.p.waitForSelector('[data-testid=backup-preview]');
await C.p.click('[data-testid=backup-preview] .btn-primary');
await C.p.waitForSelector('[data-testid=backup-done]');
const cp = await live(C.p, 'persons');
ok(cp.length === persons.length && cp.filter((p) => p.name === persons[0].name).length === 1 && cp.some((p) => p.id === persons[0].id), 'Neues Handy: alle Personen, keine doppelt');
ok((await live(C.p, 'menus')).length === 2 && (await live(C.p, 'docs')).length === 1 && (await C.p.evaluate(() => window.__all('files'))).length === 1, 'Neues Handy: Menüs und Dokument mit Datei');
await C.p.screenshot({ path: '/tmp/fp-test-backup.png', fullPage: true });

ok(errs.length === 0, 'keine Fehler ' + errs.join(' | '));
await b.close();
