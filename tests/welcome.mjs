// Erster Start (v0.29): keine fest eingetragenen Personen, die App fragt nach dem Namen.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const all = (p, s) => p.evaluate((s) => new Promise((res) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => { const q = r.result.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }; }), s);
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
await ctx.addInitScript({ content: "try { localStorage.setItem('fp-test-fresh', '1'); } catch {}" });
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar');
await p.waitForSelector('[aria-label="Willkommen"]');
ok(true, 'Willkommensfenster erscheint beim ersten Start');
ok((await all(p, 'persons')).length === 0, 'keine fest eingetragenen Personen (kein «Tobias»)');
ok(await p.locator('text=Los geht\'s').isDisabled(), '«Los geht\'s» erst mit Name');
await p.fill('[aria-label="Willkommen"] input', 'Kilian');
await p.click('text=Los geht\'s'); await p.waitForTimeout(400);
ok(await p.locator('[aria-label="Willkommen"]').count() === 0, 'Fenster schliesst');
ok((await p.locator('.dash-hello h2').innerText()).includes('Kilian'), 'Begrüssung: ' + (await p.locator('.dash-hello h2').innerText()));
const ps = await all(p, 'persons');
ok(ps.length === 1 && ps[0].name === 'Kilian' && ps[0].factor === 1, 'Person Kilian mit Faktor 1.0 angelegt');
await p.reload(); await p.waitForSelector('.dash'); await p.waitForTimeout(300);
ok(await p.locator('[aria-label="Willkommen"]').count() === 0, 'nach Neustart kein Fenster mehr');

// Zweites Handy: «Ich trete einer bestehenden Familie bei» → Seite Familie
const ctx2 = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
await ctx2.addInitScript({ content: "try { localStorage.setItem('fp-test-fresh', '1'); } catch {}" });
const q = await ctx2.newPage(); q.on('pageerror', (e) => errs.push(String(e)));
await q.goto('http://localhost:8765/docs-test/'); await q.waitForSelector('[aria-label="Willkommen"]');
await q.click('text=Ich trete einer bestehenden Familie bei'); await q.waitForTimeout(300);
ok(await q.locator('[aria-label="Willkommen"]').count() === 0 && (await q.locator('.topbar h1').innerText()) === 'Familie', 'Beitreten → Seite Familie');
await q.screenshot({ path: '/tmp/fp-test-welcome.png' });

// Bestehende Installation (Testversion mit Startwerten): kein Fenster
const ctx3 = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
const r = await ctx3.newPage();
await r.goto('http://localhost:8765/docs-test/'); await r.waitForSelector('.dash'); await r.waitForTimeout(400);
ok(await r.locator('[aria-label="Willkommen"]').count() === 0, 'mit vorhandenen Personen kein Fenster');
ok(errs.length === 0, 'keine Fehler ' + errs.join(' | '));
await b.close();
