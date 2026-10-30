// Dokumente (v0.21) mit zwei Handys: Datei in die Ablage hochladen, auf dem anderen Handy ansehen
// (auch offline), offline erfassen und später hochladen, Ablage nicht eingerichtet, löschen für alle.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__files = async () => { const db = await window.__idb(); return new Promise((res) => { const os = db.transaction('files').objectStore('files'); const k = os.getAllKeys(); k.onsuccess = () => { const v = os.getAll(); v.onsuccess = () => res(k.result.map((key, i) => ({ key, pending: v.result[i].pending }))); }; }); };
window.__setMeta = async (k, v) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__clearAll = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); return new Promise((res) => { const tx = db.transaction(names, 'readwrite'); names.forEach((n) => tx.objectStore(n).clear()); tx.oncomplete = res; }); };
window.__markDirty = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta' && n !== 'files'); for (const n of names) { const all = await window.__all(n); await new Promise((res) => { const tx = db.transaction(n, 'readwrite'); all.forEach((r) => tx.objectStore(n).put({ ...r, dirty: true })); tx.oncomplete = res; }); } };
window.__photo = () => { const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#333'; x.fillRect(0, 0, 900, 1200);
  x.fillStyle = '#f4f2ee'; x.beginPath(); x.moveTo(120, 140); x.lineTo(780, 110); x.lineTo(820, 1080); x.lineTo(90, 1110); x.closePath(); x.fill();
  x.fillStyle = '#222'; for (let r = 0; r < 12; r++) x.fillRect(200, 250 + r * 60, 420, 12); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; };
`;
const mk = async () => { const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' }); await ctx.addInitScript({ content: helpers }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('dialog', (d) => d.accept()); await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar'); return { ctx, p }; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
await ctl('reset');

const A = await mk(); const B = await mk();
const persons = (await A.p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const sess = (uid) => ({ access_token: uid + ':tok', refresh_token: 'r', expires_at: 4102444800, user: { id: uid, email: uid + '@x.ch' } });
const hh = { id: 'hh1', name: 'Test' };
await ctl('members', { __list: true, uA: { role: 'owner', person_id: persons[0].id }, uB: { role: 'member', person_id: persons[1].id } });
await A.p.evaluate(async ([s, h]) => { await window.__setMeta('session', s); await window.__setMeta('household', h); await window.__markDirty(); }, [sess('uA'), hh]);
await A.p.reload(); await A.p.waitForSelector('.tabbar'); await A.p.waitForTimeout(2000);
await B.p.evaluate(async ([s, h]) => { await window.__clearAll(); await window.__setMeta('session', s); await window.__setMeta('household', h); }, [sess('uB'), hh]);
await B.p.reload(); await B.p.waitForSelector('.tabbar'); await B.p.waitForTimeout(2000);
const sync = async (...ps) => { for (const p of ps) { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1800); } };
const openDocs = async (p) => { await p.click('.tabbar >> text=Mehr'); await p.click('.more-grid >> text=Dokumente'); await p.waitForSelector('.docs-add'); };
const scan = async (p, title) => {
  const photo = await p.evaluate(() => window.__photo());
  await p.setInputFiles('[data-testid=docs-camera]', { name: 'IMG.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') });
  await p.click('text=Seite übernehmen');
  await p.click('text=Fertig (1 Seite)');
  await p.fill('.docs-form input[maxlength="120"]', title);
  await p.click('button:has-text("Speichern")');
  await p.waitForSelector('.docs-view');
};
const store = () => fetch('http://localhost:8766/__control/storage').then((r) => r.json());
const log = () => fetch('http://localhost:8766/__control/log').then((r) => r.json());

// 1) A scannt → Datei in der Ablage
await openDocs(A.p);
ok(!(await A.p.locator('.docs').innerText()).includes('nur auf diesem Handy'), 'Mit Haushalt: kein Hinweis «nur auf diesem Handy»');
await scan(A.p, 'Quittung Velo');
await A.p.waitForSelector('.docs-view >> text=in der Cloud gespeichert ✓', { timeout: 5000 });
let st = await store();
const doc1 = (await A.p.evaluate(() => window.__all('docs')))[0];
ok(Object.keys(st).length === 1 && st[`hh1/${doc1.id}.pdf`]?.type === 'application/pdf', 'Datei liegt in der Ablage unter Haushalt/ID.pdf');
ok(doc1.file.path === `hh1/${doc1.id}.pdf`, 'Eintrag kennt den Ort der Datei');
ok((await A.p.evaluate(() => window.__files()))[0].pending === false, 'Kopie auf dem Handy bleibt (offline ansehen)');

// 2) B sieht das Dokument und lädt die Datei beim Öffnen
await sync(A.p, B.p);
await openDocs(B.p);
await B.p.waitForSelector('.docs-row');
ok((await B.p.locator('.docs-row').innerText()).includes('Quittung Velo') && await B.p.locator('.docs-row img').count() === 1, 'B: Dokument mit Vorschaubild in der Liste');
await B.p.click('.docs-row');
await B.p.waitForSelector('.docs-pages img', { timeout: 5000 });
ok((await log()).some((l) => l.uid === 'uB' && l.op === 'storage-download'), 'B: Datei aus der Ablage geladen');
ok((await B.p.locator('.docs-view').innerText()).includes(`Erfasst von ${persons[0].name}`), 'B: «Erfasst von …»');
await B.p.click('text=‹ Alle Dokumente');
// offline nochmals öffnen → aus der Kopie
await B.ctx.setOffline(true);
const before = (await log()).filter((l) => l.op === 'storage-download').length;
await B.p.click('.docs-row');
await B.p.waitForSelector('.docs-pages img', { timeout: 5000 });
ok((await log()).filter((l) => l.op === 'storage-download').length === before, 'B offline: Dokument aus der Kopie auf dem Handy');
await B.p.click('text=‹ Alle Dokumente');
await B.ctx.setOffline(false);

// 3) A offline erfassen → später hochladen
await A.p.click('text=‹ Alle Dokumente');
await A.ctx.setOffline(true);
await scan(A.p, 'Garantie Kaffeemaschine');
await A.p.waitForTimeout(500);
ok((await A.p.locator('.docs-view').innerText()).includes('wird hochgeladen'), 'A offline: «wird hochgeladen …»');
ok(Object.keys(await store()).length === 1, 'A offline: noch nichts in der Ablage');
await A.p.click('text=‹ Alle Dokumente');
ok(await A.p.locator('.docs-up').count() === 1, 'A offline: Liste zeigt «wird hochgeladen …»');
await A.ctx.setOffline(false);
await A.p.evaluate(() => window.dispatchEvent(new Event('online')));
await A.p.waitForTimeout(1500);
ok(Object.keys(await store()).length === 2 && await A.p.locator('.docs-up').count() === 0, 'A wieder online: hochgeladen');

// 4) Ablage in Supabase noch nicht eingerichtet
await ctl('storage-fail', { on: true });
await scan(A.p, 'Krankenkasse');
await A.p.click('text=‹ Alle Dokumente');
await A.p.waitForSelector('.warn:has-text("update-0.21.sql")', { timeout: 4000 });
ok(true, 'Ablage fehlt: Hinweis «update-0.21.sql ausführen»');
await ctl('storage-fail', { on: false });
await sync(A.p);
await A.p.waitForTimeout(800);
ok(Object.keys(await store()).length === 3 && await A.p.locator('.warn').count() === 0, 'Nach dem Einrichten: beim nächsten Abgleich hochgeladen');

// 5) B löscht → für alle weg, auch in der Ablage
await sync(A.p, B.p);
await B.p.click('.docs-row:has-text("Quittung Velo")');
await B.p.click('.docs-view button:has-text("Löschen")');
await B.p.waitForTimeout(800);
st = await store();
ok(!st[`hh1/${doc1.id}.pdf`] && Object.keys(st).length === 2, 'B löscht: Datei aus der Ablage entfernt');
await sync(B.p, A.p);
await A.p.waitForTimeout(500);
ok(await A.p.locator('.docs-row:has-text("Quittung Velo")').count() === 0, 'A: Dokument verschwunden');
ok(!(await A.p.evaluate(() => window.__files())).some((f) => f.key === doc1.id), 'A: Kopie auf dem Handy aufgeräumt');


// 6) Privat (Schloss) und «Betrifft» mit Personen-Filter (v0.22)
const nameB = persons[1].name, nameK = persons[2].name;
const scanWith = async (p, title, fn) => {
  const photo = await p.evaluate(() => window.__photo());
  await p.setInputFiles('[data-testid=docs-camera]', { name: 'IMG.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') });
  await p.click('text=Seite übernehmen');
  await p.click('text=Fertig (1 Seite)');
  await p.fill('.docs-form input[maxlength="120"]', title);
  await fn(p);
  await p.click('button:has-text("Speichern")');
  await p.waitForSelector('.docs-view');
};
await A.p.click('text=‹ Alle Dokumente').catch(() => {});
ok((await A.p.locator('.docs-add').count()) === 1, 'A: Liste offen');
await scanWith(A.p, 'Police Thadea', async (p) => {
  ok((await p.locator('.docs-vis').innerText()).includes('Für alle'), 'Standard: für alle sichtbar (offenes Schloss)');
  await p.click(`.docs-who .chip:has-text("${nameB}")`);
  await p.click('.docs-form .chip:has-text("Versicherung")');
});
ok((await A.p.locator('.docs-view').innerText()).includes(`Betrifft: ${nameB}`), 'Ansicht: «Betrifft: …»');
await A.p.click('text=‹ Alle Dokumente');
await scanWith(A.p, 'Mein Arztbericht', async (p) => {
  await p.click('.docs-form-head .icon-btn');
  ok((await p.locator('.docs-vis').innerText()).includes('Privat'), 'Schloss: privat');
  ok(await p.locator('.docs-who').count() === 0, 'Privat: keine Personen-Auswahl');
});
await A.p.waitForSelector('.docs-view >> text=in der Cloud gespeichert ✓', { timeout: 5000 });
const privDoc = (await A.p.evaluate(() => window.__all('docs'))).find((d) => d.title === 'Mein Arztbericht');
ok(privDoc.private === true && privDoc.file.path === `hh1/privat/uA/${privDoc.id}.pdf`, 'Private Datei im eigenen Ordner: ' + privDoc.file.path);
await A.p.click('text=‹ Alle Dokumente');
ok(await A.p.locator('.docs-row:has-text("🔒")').count() === 1, 'A: Schloss in der Liste');
await sync(A.p, B.p);
const recs = await fetch('http://localhost:8766/__control/dump').then((r) => r.json());
ok(recs.find((r) => r.id === privDoc.id)?.owner_id === 'uA', 'Cloud: privater Eintrag gehört nur A');
await B.p.reload(); await B.p.waitForSelector('.tabbar'); await openDocs(B.p);
await B.p.waitForSelector('.docs-row:has-text("Police Thadea")');
ok(await B.p.locator('.docs-row:has-text("Mein Arztbericht")').count() === 0, 'B sieht das private Dokument nicht');
const r = await fetch(`http://localhost:8766/storage/v1/object/authenticated/dokumente/hh1/privat/uA/${privDoc.id}.pdf`, { headers: { authorization: 'Bearer uB:tok' } });
ok(r.status >= 400, 'Ablage: B darf die private Datei nicht laden');
await B.p.click(`.docs-chips .chip:has-text("${nameB}")`);
ok(await B.p.locator('.docs-row').count() === 1 && (await B.p.locator('.docs-row').innerText()).includes('Police Thadea'), `B: Filter «${nameB}» zeigt die Police`);
ok(await B.p.locator(`.docs-chips .chip:has-text("${nameK}")`).count() === 0, 'Personen ohne Dokumente erscheinen nicht im Filter');
await A.p.click(`.docs-chips .chip:has-text("${persons[0].name}")`);
ok(await A.p.locator('.docs-row').count() === 1 && (await A.p.locator('.docs-row').innerText()).includes('Mein Arztbericht'), 'A: eigene private Dokumente unter dem eigenen Namen');
await A.p.click('.docs-chips .chip:has-text("Alle Personen")');

// privat → für alle
await A.p.click('.docs-row:has-text("Mein Arztbericht")');
await A.p.click('text=Angaben bearbeiten');
await A.p.click('.docs-form-head .icon-btn');
await A.p.click(`.docs-who .chip:has-text("${persons[0].name}")`);
await A.p.click('button:has-text("Speichern")');
await A.p.waitForSelector('.docs-view >> text=in der Cloud gespeichert ✓', { timeout: 5000 });
const pub = (await A.p.evaluate(() => window.__all('docs'))).find((d) => !d.deleted && d.title === 'Mein Arztbericht');
const st2 = await store();
ok(pub.id !== privDoc.id && !pub.private && st2[`hh1/${pub.id}.pdf`] && !st2[`hh1/privat/uA/${privDoc.id}.pdf`], 'Für alle freigegeben: neue Datei im Haushalt, private gelöscht');
await sync(A.p, B.p);
await B.p.click('.docs-chips .chip:has-text("Alle Personen")');
await B.p.waitForSelector('.docs-row:has-text("Mein Arztbericht")', { timeout: 4000 });
ok(true, 'B sieht es jetzt');

ok(errs.length === 0, 'keine Fehler im Browser ' + errs.join(' | '));
await b.close();
