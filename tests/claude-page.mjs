// v0.37 Anmeldeseite für den Claude-Connector (docs/claude.html): anmelden, erlauben, ablehnen.
// Supabase-Anmeldung und Funktion werden per page.route nachgebildet.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const URL0 = 'http://localhost:8765/docs-test/claude.html';

const open = async (hash) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  const calls = [];
  await p.route('http://localhost:8766/**', async (route) => {
    const req = route.request();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ url: req.url(), body });
    if (req.url().includes('/auth/v1/token')) {
      if (body.password !== 'geheim') return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"at","refresh_token":"rt"}' });
    }
    if (req.url().endsWith('/functions/v1/claude-connector/approve')) {
      const redirect = body.deny ? 'http://localhost:8765/docs-test/?error=access_denied' : 'http://localhost:8765/docs-test/?code=abc';
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ redirect }) });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await p.goto(URL0 + hash);
  return { ctx, p, calls };
};

{
  const { ctx, p } = await open('');
  ok((await p.locator('#card').innerText()).includes('Bitte dort auf «Verbinden» tippen'), 'Ohne Anfrage: Hinweis statt Formular');
  await ctx.close();
}
{
  const { ctx, p, calls } = await open('#req=R1&app=Claude');
  ok((await p.locator('h1').innerText()).includes('mit Claude verbinden') && (await p.locator('li').count()) === 3, 'Seite zeigt, was Claude darf');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, 'kein seitliches Scrollen im Handy-Format');
  await p.fill('#email', 'tobias@x.ch');
  await p.fill('#pw', 'falsch');
  await p.click('#ok');
  await p.waitForFunction(() => document.getElementById('err').textContent.length > 0);
  ok((await p.locator('#err').innerText()).includes('E-Mail oder Passwort falsch'), 'Falsches Passwort: Meldung');
  await p.fill('#pw', 'geheim');
  await Promise.all([p.waitForURL(/\?code=abc/), p.click('#ok')]);
  const ap = calls.find((c) => c.url.endsWith('/approve'));
  ok(ap && ap.body.req === 'R1' && ap.body.access_token === 'at' && ap.body.refresh_token === 'rt', 'Erlauben: Anmeldung an die Funktion, dann zurück zu Claude');
  await ctx.close();
}
{
  const { ctx, p, calls } = await open('#req=R2');
  await Promise.all([p.waitForURL(/error=access_denied/), p.click('#no')]);
  ok(calls.some((c) => c.body?.deny === true && c.body.req === 'R2') && !calls.some((c) => c.url.includes('/auth/')), 'Ablehnen: ohne Anmeldung zurück zu Claude');
  await ctx.close();
}
ok(errs.length === 0, 'Keine Fehler in der Seite' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
