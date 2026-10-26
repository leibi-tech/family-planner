import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__setMeta = async (k, v) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
window.__clearAll = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); return new Promise((res) => { const tx = db.transaction(names, 'readwrite'); names.forEach((n) => tx.objectStore(n).clear()); tx.oncomplete = res; }); };
window.__markDirty = async () => { const db = await window.__idb(); const names = [...db.objectStoreNames].filter((n) => n !== 'meta'); for (const n of names) { const all = await window.__all(n); await new Promise((res) => { const tx = db.transaction(n, 'readwrite'); all.forEach((r) => tx.objectStore(r ? n : n).put({ ...r, dirty: true })); tx.oncomplete = res; }); } };
`;
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
await ctl('reset');
const mk = async () => { const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' }); await ctx.addInitScript({ content: helpers }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar'); return { ctx, p }; };
const A = await mk(); const B = await mk();
const persons = (await A.p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const pA = persons[0].id, pB = persons[1].id;
const sess = (uid) => ({ access_token: uid + ':tok', refresh_token: 'r', expires_at: 4102444800, user: { id: uid, email: uid + '@x.ch' } });
const hh = { id: 'hh1', name: 'Test' };
await ctl('members', { uA: { role: 'owner', person_id: pA }, uB: { role: 'member', person_id: pB } });
await A.p.evaluate(async ([s, h]) => { await window.__setMeta('session', s); await window.__setMeta('household', h); await window.__markDirty(); }, [sess('uA'), hh]);
await A.p.reload(); await A.p.waitForSelector('.tabbar'); await A.p.waitForTimeout(2500);
await B.p.evaluate(async ([s, h]) => { await window.__clearAll(); await window.__setMeta('session', s); await window.__setMeta('household', h); }, [sess('uB'), hh]);
await B.p.reload(); await B.p.waitForSelector('.tabbar'); await B.p.waitForTimeout(2500);
const sync = async (...ps) => { for (const p of ps) { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1800); } };

// Geteilte Liste -> ToDo für alle (offen), mit Datum «Heute»
await A.p.click('.tabbar >> text=Notizen');
await A.p.click('text=+ Liste'); await A.p.fill('.note-title-input', 'Hof aufräumen');
await A.p.fill('input[aria-label="Neuer Punkt"]', 'Scheune'); await A.p.keyboard.press('Enter'); await A.p.waitForTimeout(700);
await A.p.click('button[aria-label="Als ToDo anheften"]');
ok(await A.p.locator('text=Nur für mich').count() === 1, 'Frage «für wen» bei geteilter Notiz');
await A.p.click('.pin-menu >> text=Für alle'); await A.p.click('.pin-menu >> text=Heute'); await A.p.click('text=ToDo erstellen'); await A.p.waitForTimeout(600);
ok(await A.p.locator('text=ToDo für alle erstellt').count() === 1, 'Bestätigung «für alle»');
// Privates ToDo aus privater Notiz
await A.p.click('text=‹ Zurück');
await A.p.click('text=+ Notiz'); await A.p.fill('.note-title-input', 'Geheimprojekt'); await A.p.fill('.note-body', 'x'); await A.p.waitForTimeout(800);
await A.p.click('button[aria-label="Für alle sichtbar"]'); await A.p.click('text=Privat machen'); await A.p.waitForTimeout(700);
await A.p.click('button[aria-label="Als ToDo anheften"]');
ok(await A.p.locator('text=Nur für mich').count() === 0 && await A.p.locator('text=wird auch das ToDo privat').count() === 1, 'Private Notiz: keine Frage, ToDo wird privat');
await A.p.click('text=ToDo erstellen'); await A.p.waitForTimeout(600);
ok(await A.p.locator('text=Privates ToDo erstellt').count() === 1, 'Bestätigung «privat»');
await A.p.click('text=‹ Zurück');
const todos = await A.p.evaluate(() => window.__all('todos'));
const t1 = todos.find((t) => t.title === 'Hof aufräumen'), t2 = todos.find((t) => t.title === 'Geheimprojekt');
ok(t1 && t1.assignees.length === 0 && !t1.private && !!t1.due && !!t1.noteId, 'ToDo 1: offen, nicht privat, Datum, Notiz-Link');
ok(t2 && t2.private && t2.assignees[0] === pA && !!t2.noteId, 'ToDo 2: privat, mir zugewiesen, Notiz-Link');
// ToDo-Seite: Icon + Notiz öffnen
await A.p.click('.tabbar >> text=ToDo'); await A.p.waitForTimeout(700); console.log(await A.p.locator('.todo-list').innerText());
ok(await A.p.locator('.todo-title', { hasText: 'Hof aufräumen' }).locator('span[aria-label="mit Notiz"]').count() === 1, 'ToDo zeigt 📝');
await A.p.locator('.todo-main', { hasText: 'Hof aufräumen' }).click();
await A.p.click('text=Liste öffnen');
await A.p.waitForTimeout(500);
ok(await A.p.locator('.note-title-input').inputValue() === 'Hof aufräumen' && await A.p.locator('.ni-text', { hasText: 'Scheune' }).count() === 1, 'Link öffnet die Liste direkt');
ok(await A.p.locator('.tabbar .tab.active', { hasText: 'Notizen' }).count() === 1, 'Tab «Notizen» aktiv');
await A.p.screenshot({ path: '/tmp/fp-test-todo-panel.png' });
// B: sieht ToDo 1 (offen), nicht ToDo 2
await sync(A.p, B.p);
const tb = await B.p.evaluate(() => window.__all('todos'));
ok(tb.some((t) => t.title === 'Hof aufräumen' && t.noteId) && !tb.some((t) => t.title === 'Geheimprojekt'), 'B sieht geteiltes ToDo, nicht das private');
await B.p.click('.tabbar >> text=ToDo'); await B.p.click('text=Alle');
await B.p.locator('.todo-main', { hasText: 'Hof aufräumen' }).click();
await B.p.click('text=Liste öffnen'); await B.p.waitForTimeout(500);
ok(await B.p.locator('.ni-text', { hasText: 'Scheune' }).count() === 1, 'B kommt über das ToDo zur Liste');
// Private Notiz -> geteilt: noteId im ToDo folgt der neuen ID? (Geteilt->privat Test: Liste privat machen)
await A.p.click('button[aria-label="Für alle sichtbar"]'); await A.p.click('text=Privat machen'); await A.p.waitForTimeout(800);
const todos2 = await A.p.evaluate(() => window.__all('todos'));
const notes2 = (await A.p.evaluate(() => window.__all('notes'))).filter((n) => n.title === 'Hof aufräumen' && !n.deleted);
ok(notes2.length === 1 && todos2.find((t) => t.title === 'Hof aufräumen').noteId === notes2[0].id, 'ToDo-Link folgt der neuen Notiz-ID nach Wechsel auf privat');
console.log('Fehler:', errs);
await b.close();
