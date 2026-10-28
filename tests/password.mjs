// «Passwort ändern»: bisheriges Passwort wird geprüft, neues muss anders und 8+ Zeichen lang sein.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
await ctl('reset');
await ctl('passwords', { 'uA@x.ch': 'altes-passwort1' });
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
await ctx.addInitScript({ content: `window.__setMeta = async (k, v) => { const db = await new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); }); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };` });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar');
await ctl('members', { uA: { role: 'owner', person_id: null } });
await p.evaluate(() => window.__setMeta('session', { access_token: 'uA:tok', refresh_token: 'r', expires_at: 4102444800, user: { id: 'uA', email: 'uA@x.ch' } }));
await p.evaluate(() => window.__setMeta('household', { id: 'hh1', name: 'Test' }));
await p.reload(); await p.waitForSelector('.tabbar'); await p.waitForTimeout(1500);
await p.click('.tabbar >> text=Mehr'); await p.click('text=Familie'); await p.waitForTimeout(300);
await p.click('.cloud-card'); await p.waitForTimeout(500);
ok(await p.locator('text=Passwort ändern').count() === 1, 'Knopf «Passwort ändern» sichtbar (angemeldet)');
await p.click('button:has-text("Passwort ändern")');
const save = p.locator('button:has-text("Passwort speichern")');
ok(await save.isDisabled(), 'Speichern gesperrt, solange nichts eingegeben');
const f = p.locator('.box-section input[type=password]');
// falsches bisheriges Passwort
await f.nth(0).fill('falsch'); await f.nth(1).fill('neues-passwort9'); await f.nth(2).fill('neues-passwort9');
await save.click(); await p.waitForTimeout(500);
ok(await p.locator('text=Das bisherige Passwort stimmt nicht').count() === 1, 'Falsches bisheriges Passwort wird gemeldet');
// zu kurz
await f.nth(1).fill('kurz'); await f.nth(2).fill('kurz');
ok(await save.isDisabled(), 'Zu kurzes neues Passwort: Speichern gesperrt');
// nicht gleich
await f.nth(1).fill('neues-passwort9'); await f.nth(2).fill('neues-passwort8');
ok(await p.locator('text=nicht gleich').count() === 1 && await save.isDisabled(), 'Ungleiche Wiederholung gemeldet und gesperrt');
// gleich wie bisher
await f.nth(0).fill('altes-passwort1'); await f.nth(1).fill('altes-passwort1'); await f.nth(2).fill('altes-passwort1');
await save.click(); await p.waitForTimeout(500);
ok(await p.locator('text=muss anders sein').count() === 1, 'Gleiches Passwort wie bisher wird abgelehnt');
// erfolgreich
await f.nth(1).fill('neues-passwort9'); await f.nth(2).fill('neues-passwort9');
await save.click(); await p.waitForTimeout(600);
ok(await p.locator('text=Passwort geändert').count() === 1, 'Erfolgsmeldung «Passwort geändert»');
// Server hat neues Passwort: erneutes Ändern mit neuem als bisherigem klappt
const log = await fetch('http://localhost:8766/__control/log').then((r) => r.json());
ok(log.filter((l) => l.op === 'password-change').length === 2, 'Server hat genau 2 Änderungsversuche gesehen (1x gleich abgelehnt, 1x ok)');
// angemeldet bleiben
ok(await p.locator('text=Abmelden').count() >= 1, 'Weiterhin angemeldet');
ok(errs.length === 0, 'keine Fehler im Browser: ' + errs.join(' | '));
await b.close();
