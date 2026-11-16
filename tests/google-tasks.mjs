// Google-ToDos (v0.35): Hinweis «neu verbinden», Anzeige unter «Meine» mit G, Startseite, Zähler,
// abhaken, ändern, neu in Google erfassen (Liste wählen), löschen, Fehler → zurück, offline gesperrt,
// das andere Handy sieht nichts und nichts landet in der gemeinsamen Datenbank.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const helpers = `
window.__idb = () => new Promise((res, rej) => { const r = indexedDB.open('family-planner'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.__all = async (s) => { const db = await window.__idb(); return new Promise((res) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); }); };
window.__setMeta = async (k, v) => { const db = await window.__idb(); return new Promise((res) => { const tx = db.transaction('meta', 'readwrite'); if (v === undefined) tx.objectStore('meta').delete(k); else tx.objectStore('meta').put(v, k); tx.oncomplete = res; }); };
`;
const ctl = (path, body) => fetch('http://localhost:8766/__control/' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
await ctl('reset');
await ctl('gtasks', {});
const APP = 'http://localhost:8765/docs-test/';
const mk = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Europe/Zurich' });
  await ctx.addInitScript({ content: helpers });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(APP);
  await p.waitForSelector('.tabbar');
  return { ctx, p };
};
const A = await mk();
const B = await mk();
const persons = (await A.p.evaluate(() => window.__all('persons'))).sort((a, b) => a.sort - b.sort);
const pA = persons[0].id, pB = persons[1].id;
const sess = (uid) => ({ access_token: uid + ':tok', refresh_token: 'r', expires_at: 4102444800, user: { id: uid, email: uid + '@x.ch' } });
const hh = { id: 'hh1', name: 'Test' };
await ctl('members', { uA: { role: 'owner', person_id: pA }, uB: { role: 'member', person_id: pB } });
await ctl('gcal', { accounts: { uA: { email: 'tobias@gmail.com', selected: [] }, uB: { email: 'thadea@gmail.com', selected: [] } }, googleList: [], events: {}, errors: [], connectUrl: APP + '?g=1#kalender=ok' });
for (const [X, u] of [[A, 'uA'], [B, 'uB']]) {
  await X.p.evaluate(async ([s, h]) => { await window.__setMeta('session', s); await window.__setMeta('household', h); }, [sess(u), hh]);
}
const pad = (n) => String(n).padStart(2, '0');
const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const reload = async (X) => { await X.p.evaluate(() => window.__setMeta('googleTasks', undefined)); await X.p.reload(); await X.p.waitForSelector('.tabbar'); await X.p.waitForTimeout(1200); };

// 1) Erlaubnis fehlt noch → Hinweis «Google neu verbinden» unter «Meine»
await ctl('gtasks', { uA: { state: 'scope' } });
await reload(A);
await A.p.click('.tabbar >> text=ToDo');
await A.p.waitForTimeout(500);
ok(await A.p.locator('.gtask-hint button:has-text("Google neu verbinden")').count() === 1, 'Erlaubnis fehlt: Hinweis mit «Google neu verbinden»');
await A.p.click('.gtask-hint button:has-text("Google neu verbinden")');
await A.p.waitForURL(/\?g=1/);
await A.p.waitForSelector('text=Google verbunden');
ok(true, '«Google neu verbinden» führt zu Google und zurück in die App');
await A.p.click('.sheet >> text=Schliessen').catch(() => {});

// 2) Google-ToDos vorhanden
await ctl('gtasks', {
  uA: {
    state: 'ok',
    lists: [{ id: 'L1', title: 'Meine Aufgaben' }, { id: 'L2', title: 'Arbeit' }],
    tasks: [
      { id: 'g1', listId: 'L1', title: 'Steuererklärung', notes: 'Belege suchen', due: day(-1), done: false, completedAt: null, updated: '2026-11-01T10:00:00Z' },
      { id: 'g2', listId: 'L2', title: 'Offerte schreiben', notes: '', due: null, done: false, completedAt: null, updated: '2026-11-02T10:00:00Z' },
      { id: 'g3', listId: 'L1', title: 'Alt erledigt', notes: '', due: null, done: true, completedAt: '2026-11-10T10:00:00Z', updated: '2026-11-10T10:00:00Z' },
    ],
  },
  uB: { state: 'ok', lists: [{ id: 'LB', title: 'Thadea' }], tasks: [{ id: 'h1', listId: 'LB', title: 'Geschenk Tobias', notes: '', due: null, done: false, completedAt: null, updated: '2026-11-01T10:00:00Z' }] },
});
await reload(A);
// Startseite und Zähler
ok(await A.p.locator('.dash-todo', { hasText: 'Steuererklärung' }).locator('.gtask-badge').count() === 1, 'Startseite: Google-ToDo mit «G» unter «Meine ToDos»');
ok(await A.p.locator('.dash-todo.overdue', { hasText: 'Steuererklärung' }).count() === 1, 'Startseite: überfälliges Google-ToDo markiert');
ok((await A.p.locator('.tabbar .tab-badge').innerText()) === '2', 'Zähler in der Menüleiste zählt die 2 offenen Google-ToDos');
await A.p.click('.tabbar >> text=ToDo');
await A.p.waitForTimeout(500);
ok(await A.p.locator('.gtask-hint').count() === 0, 'verbunden: kein Hinweis mehr');
const titles = await A.p.locator('.todo-list .todo-title').allInnerTexts();
ok(titles.some((t) => t.includes('Steuererklärung')) && titles.some((t) => t.includes('Offerte schreiben')) && titles.some((t) => t.includes('Alt erledigt')), 'ToDo «Meine»: Google-ToDos aus beiden Listen (auch erledigte)');
ok(await A.p.locator('.todo-list .todo', { hasText: 'Steuererklärung' }).locator('.gtask-badge').count() === 1, 'ToDo-Liste: «G» statt Schloss');
ok(await A.p.locator('.todo.overdue', { hasText: 'Steuererklärung' }).count() === 1, 'überfällig wie die anderen ToDos');
// Andere Person: keine Google-ToDos
await A.p.locator('.person-chips .chip').first().click();
await A.p.waitForTimeout(300);
ok(await A.p.locator('.todo-list .gtask-badge').count() === 0, 'bei einer anderen Person keine Google-ToDos');
await A.p.click('.view-tabs >> text=Meine');

// 3) Abhaken → Google
await A.p.locator('.todo', { hasText: 'Steuererklärung' }).locator('.todo-check').click();
await A.p.waitForTimeout(600);
let dump = await ctl('gtasks-dump');
ok(dump.writes.some((w) => w.op === 'taskUpdate' && w.taskId === 'g1' && w.task.done === true), 'Abhaken geht an Google (done)');
ok(await A.p.locator('.todo.checked', { hasText: 'Steuererklärung' }).count() === 1, 'abgehakt angezeigt');
await A.p.locator('.todo', { hasText: 'Steuererklärung' }).locator('.todo-check').click();
await A.p.waitForTimeout(600);
dump = await ctl('gtasks-dump');
ok(dump.writes.some((w) => w.op === 'taskUpdate' && w.taskId === 'g1' && w.task.done === false), 'wieder öffnen geht an Google');

// 4) Ändern
await A.p.locator('.todo-main', { hasText: 'Steuererklärung' }).click();
ok(await A.p.locator('.gtask-banner', { hasText: 'Meine Aufgaben' }).count() === 1, 'Fenster zeigt «Google-ToDo · Liste «Meine Aufgaben»»');
ok(await A.p.locator('.sheet >> text=Sichtbarkeit').count() === 0 && await A.p.locator('.sheet >> text=Wer macht es?').count() === 0, 'keine Sichtbarkeit / Zuweisung bei Google-ToDos');
ok((await A.p.locator('.sheet textarea').inputValue()) === 'Belege suchen', 'Notiz aus Google');
await A.p.fill('.sheet input:not([type=date])', 'Steuererklärung 2026');
await A.p.fill('.sheet input[type=date]', day(3));
await A.p.click('.sheet >> text=Speichern');
await A.p.waitForTimeout(700);
dump = await ctl('gtasks-dump');
const upd = dump.writes.filter((w) => w.op === 'taskUpdate' && w.taskId === 'g1').pop();
ok(upd && upd.task.title === 'Steuererklärung 2026' && upd.task.due === day(3) && upd.task.notes === 'Belege suchen', 'Ändern: Titel, Datum, Notiz an Google');
ok(await A.p.locator('.todo', { hasText: 'Steuererklärung 2026' }).count() === 1, 'geänderter Titel in der Liste');

// 5) Neu in Google erfassen, Liste wählen
await A.p.fill('input[aria-label="Neues ToDo"]', 'Velo service');
await A.p.click('button[aria-label="ToDo mit Details erfassen"]');
await A.p.click('.sheet button:has-text("Google")');
ok(await A.p.locator('.sheet >> text=Wer macht es?').count() === 0, 'Google gewählt: keine Zuweisung');
await A.p.selectOption('select[aria-label="Liste in Google"]', 'L2');
await A.p.click('.sheet >> text=Speichern');
await A.p.waitForTimeout(700);
dump = await ctl('gtasks-dump');
ok(dump.writes.some((w) => w.op === 'taskCreate' && w.listId === 'L2' && w.task.title === 'Velo service'), 'neues ToDo in Google-Liste «Arbeit» erfasst');
ok(await A.p.locator('.todo', { hasText: 'Velo service' }).locator('.gtask-badge').count() === 1, 'neues Google-ToDo erscheint mit «G»');
const local = await A.p.evaluate(() => window.__all('todos'));
ok(!local.some((t) => /Velo service|Steuererklärung|Offerte/.test(t.title)), 'Google-ToDos nicht in der ToDo-Datenbank des Handys');

// 6) Fehler bei Google → wieder wie vorher + Meldung
await ctl('gtasks', { ...dump, failNext: true });
await A.p.locator('.todo', { hasText: 'Offerte schreiben' }).locator('.todo-check').click();
await A.p.waitForTimeout(700);
ok(await A.p.locator('.todo.checked', { hasText: 'Offerte schreiben' }).count() === 0, 'Fehler bei Google: Häkchen wieder weg');
ok(await A.p.locator('p.warn', { hasText: 'Google antwortet nicht' }).count() === 1, 'Fehler wird angezeigt');

// 7) Löschen (auch in Google)
await A.p.locator('.todo-main', { hasText: 'Offerte schreiben' }).click();
await A.p.click('.sheet >> text=Löschen');
ok(await A.p.locator('.sheet >> text=Auch in Google').count() === 1, 'Löschen fragt nach («Auch in Google»)');
await A.p.click('.sheet >> text=Wirklich löschen?');
await A.p.waitForTimeout(700);
dump = await ctl('gtasks-dump');
ok(dump.writes.some((w) => w.op === 'taskDelete' && w.taskId === 'g2'), 'Löschen geht an Google');
ok(await A.p.locator('.todo', { hasText: 'Offerte schreiben' }).count() === 0, 'gelöscht aus der Liste');

// 8) Erledigte löschen: erledigte Google-ToDos auch in Google weg
await A.p.click('text=Erledigte löschen');
await A.p.waitForTimeout(800);
dump = await ctl('gtasks-dump');
ok(dump.writes.some((w) => w.op === 'taskDelete' && w.taskId === 'g3'), '«Erledigte löschen» löscht erledigte Google-ToDos');

// 9) Offline: ansehen ja, ändern nein
await A.ctx.setOffline(true);
await A.p.evaluate(() => window.dispatchEvent(new Event('offline')));
await A.p.locator('.todo-main', { hasText: 'Steuererklärung 2026' }).click();
ok(await A.p.locator('.sheet >> text=nur mit Internet').count() === 1, 'offline: Hinweis «nur mit Internet»');
ok(await A.p.locator('.sheet button:has-text("Speichern")').isDisabled(), 'offline: Speichern gesperrt');
await A.p.click('.sheet >> text=Abbrechen');
await A.ctx.setOffline(false);

// 10) Das andere Handy sieht nur die eigenen Google-ToDos, nichts in der gemeinsamen Datenbank
await reload(B);
await B.p.click('.tabbar >> text=ToDo');
await B.p.waitForTimeout(500);
await B.p.click('.view-tabs >> text=Alle');
const bt = await B.p.locator('.todo-list').innerText().catch(() => '');
ok(!/Steuer|Velo service/.test(bt) && /Geschenk Tobias/.test(bt), 'Thadeas Handy: nur ihre eigenen Google-ToDos, keine von Tobias');
const recs = await ctl('dump');
ok(!JSON.stringify(recs).match(/Steuer|Velo service|Geschenk Tobias/), 'keine Google-ToDos in der gemeinsamen Datenbank');

// 11) Abmelden/anderes Konto: alte Kopie wird nicht gezeigt
await A.p.evaluate(async (s) => { await window.__setMeta('session', s); }, sess('uB'));
await A.p.reload();
await A.p.waitForSelector('.tabbar');
await A.p.click('.tabbar >> text=ToDo');
await A.p.waitForTimeout(800);
ok(!/Steuer/.test(await A.p.locator('section').innerText()), 'anderes Konto auf dem Handy: Kopie von Tobias wird nicht gezeigt');

ok(errs.length === 0, 'keine Fehler im Browser' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
