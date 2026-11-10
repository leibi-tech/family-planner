// v0.33 Neuigkeiten (E55): Karte auf der Startseite einmal, ✕ für immer weg, Liste unter Einstellungen.
import { chromium } from './pw.mjs';
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const errs = [];
const open = async (seen) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  if (seen) await ctx.addInitScript({ content: `if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('fp-news-seen', '${seen}'); }` });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar');
  return { ctx, p };
};
{
  const { ctx, p } = await open();
  const card = p.locator('[data-testid=news]');
  ok(await card.count() === 1, 'Startseite: Karte «Neu in myFam.»');
  ok(await card.locator('.news-item').count() === 1 && (await card.innerText()).includes('Neuigkeiten'), 'Bisherige Installation: nur die neueste Neuigkeit, nicht die ganze Liste');
  const box = await card.locator('.news-x').boundingBox();
  ok(box && box.width >= 44 && box.height >= 44, '✕ gross genug zum Antippen (' + Math.round(box?.width) + ' px)');
  await card.locator('text=Alle Neuigkeiten').click();
  ok((await p.locator('.topbar h1').innerText()) === 'Neuigkeiten', '«Alle Neuigkeiten» öffnet die Seite');
  const n = await p.locator('[data-testid=news-list] li').count();
  ok(n >= 10 && (await p.locator('[data-testid=news-list] li').first().innerText()).includes('Version 0.34.0'), 'Liste mit allen Neuerungen, neueste zuoberst (' + n + ')');
  await p.locator('[data-back]').first().click();
  ok((await p.locator('.topbar h1').innerText()) === 'Einstellungen', 'Zurück → Einstellungen');
  ok(await p.locator('.set-row:has-text("Neuigkeiten")').count() === 1, 'Einstellungen: Eintrag «Neuigkeiten»');
  await p.click('.tabbar >> text=Start'); await p.waitForSelector('[data-testid=news]');
  await p.locator('[data-testid=news] .news-x').click();
  ok(await card.count() === 0, '✕ blendet die Karte aus');
  await p.reload(); await p.waitForSelector('.tabbar'); await p.waitForTimeout(300);
  ok(await card.count() === 0, 'Nach Neuladen: bleibt weg');
  await ctx.close();
}
{
  const { ctx, p } = await open('0.32.0');
  const t = await p.locator('[data-testid=news]').innerText();
  ok(await p.locator('[data-testid=news] .news-item').count() === 2 && t.includes('Widget') && !t.includes('Teilen an die App'), 'Zuletzt 0.32.0 gesehen: genau die zwei neueren Neuigkeiten');
  await ctx.close();
}
{
  const { ctx, p } = await open('0.34.0');
  ok(await p.locator('[data-testid=news]').count() === 0, 'Alles gesehen: keine Karte');
  await ctx.close();
}
ok(errs.length === 0, 'Keine Fehler ' + errs.join(' | '));
await b.close();
