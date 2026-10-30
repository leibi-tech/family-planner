// Dokumente (NAS-Test, v0.18): Anmeldung beim NAS (falsches Passwort, 2-Schritt-Code, Gerät merken),
// Foto und PDF hochladen, Vorschaubild, Öffnen, Sitzung abgelaufen, Löschen, Abmelden, NAS nicht erreichbar.
// Der NAS-Nachbau läuft hinter dem echten Hilfsprogramm nas/nginx.conf (siehe tests/nas-proxy.sh).
import { chromium } from './pw.mjs';
const NAS = 'http://localhost:8767';
const CTL = 'http://localhost:' + (process.env.NAS_CTL_PORT || '8768');
const b = await chromium.launch();
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ctl = (what) => fetch(CTL + '/__control/' + what, { method: 'POST' }).then((r) => r.json());
await ctl('reset');

const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
p.on('dialog', (d) => d.accept());
await p.goto('http://localhost:8765/docs-test/'); await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr');
ok(await p.locator('text=Dokumente (Test)').count() === 1, 'Unter «Mehr» gibt es «Dokumente (Test)»');
await p.click('text=Dokumente (Test)');
const login = p.locator('button:has-text("Beim NAS anmelden")');
ok(await login.isDisabled(), 'Anmelden gesperrt, solange nichts eingegeben');

const f = p.locator('.docs .field input');
// NAS nicht erreichbar
await f.nth(0).fill('http://localhost:8799'); await f.nth(1).fill('app'); await f.nth(2).fill('geheim-123');
await login.click(); await p.waitForTimeout(800);
ok(await p.locator('text=nicht erreichbar').count() === 1, 'Falsche Adresse: «NAS ist nicht erreichbar»');

// falsches Passwort
await f.nth(0).fill(NAS); await f.nth(2).fill('falsch');
await login.click(); await p.waitForTimeout(600);
ok(await p.locator('text=Passwort stimmt nicht').count() === 1, 'Falsches Passwort wird gemeldet');

// 2-Schritt-Code
await f.nth(2).fill('geheim-123');
await login.click(); await p.waitForTimeout(600);
ok(await p.locator('.field span:has-text("Code aus der Authenticator-App")').count() === 1, 'Konto mit 2-Schritt-Anmeldung: Feld für den Code erscheint');
ok(await login.isDisabled(), 'Ohne Code gesperrt');
await f.nth(3).fill('999999'); await login.click(); await p.waitForTimeout(600);
ok(await p.locator('text=Der Code stimmt nicht').count() === 1, 'Falscher Code wird gemeldet');
await f.nth(3).fill('123456'); await login.click(); await p.waitForTimeout(800);
ok(await p.locator('text=Angemeldet als').count() === 1, 'Mit richtigem Code angemeldet');
ok(await p.locator('text=Noch keine Dateien').count() === 1, 'Leerer Ordner (Test-Ordner existiert noch nicht)');

// Passwort bleibt nicht auf dem Handy, Anmeldung nur per POST (nicht in der Adresse)
const stored = await p.evaluate(() => JSON.stringify(localStorage));
ok(!stored.includes('geheim-123') && stored.includes('sid-'), 'Passwort nicht gespeichert, nur die Sitzung');
let st = await ctl('state');
ok(st.log.filter((l) => l.api === 'SYNO.API.Auth').every((l) => !l.hasPasswordInUrl), 'Passwort nie in der Adresse');
if (!process.env.NAS_CTL_PORT) ok(st.log.some((l) => l.xff), 'Hilfsprogramm gibt die Absender-Adresse weiter (für die Sperre bei Fehlversuchen)');

// Hochladen: Foto + PDF
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBNIQFlQIAxhMP8bnJ6dEAAAAASUVORK5CYII=', 'base64');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
await p.setInputFiles('[data-testid=nas-file]', [
  { name: 'Quittung Waschmaschine.png', mimeType: 'image/png', buffer: png },
  { name: 'Police.pdf', mimeType: 'application/pdf', buffer: pdf },
]);
await p.waitForSelector('text=2 Dateien gespeichert'); await p.waitForTimeout(500);
ok(await p.locator('.docs-item').count() === 2, 'Zwei Dateien in der Liste');
st = await ctl('state');
ok(st.files.length === 2 && st.files.every((x) => /^\/Familien-Dokumente\/Test\/\d{4}-\d\d-\d\d_\d{6}_/.test(x)), 'Auf dem NAS im Ordner Familien-Dokumente/Test mit Datum im Namen');
ok(st.files.some((x) => x.endsWith('_Quittung_Waschmaschine.png')), 'Leerzeichen im Dateinamen ersetzt');
ok(await p.locator('.docs-name:has-text("Quittung_Waschmaschine.png")').count() === 1, 'Name ohne Datum angezeigt');
const img = p.locator('.docs-thumb img');
await p.waitForTimeout(300);
ok(await img.count() === 1 && (await img.evaluate((i) => i.naturalWidth)) === 2, 'Vorschaubild vom NAS geladen');
ok(await p.locator('.docs-icon').count() === 1, 'PDF mit Symbol');
const href = await p.locator('a.docs-thumb:has(.docs-icon)').getAttribute('href');
const got = await (await fetch(href)).text();
ok(got.startsWith('%PDF'), 'Link «öffnen» liefert die Originaldatei');

// Gleicher Name nochmals: kein Überschreiben (Datum im Namen)
await p.waitForTimeout(1100);
await p.setInputFiles('[data-testid=nas-file]', [{ name: 'Police.pdf', mimeType: 'application/pdf', buffer: pdf }]);
await p.waitForSelector('text=Datei gespeichert'); await p.waitForTimeout(400);
ok(await p.locator('.docs-item').count() === 3, 'Gleicher Dateiname nochmals: als neue Datei gespeichert');

// Nach Neustart der App weiterhin angemeldet
await p.reload(); await p.waitForSelector('.tabbar');
await p.click('.tabbar >> text=Mehr'); await p.click('text=Dokumente (Test)'); await p.waitForTimeout(600);
ok(await p.locator('.docs-item').count() === 3, 'Nach Neustart noch angemeldet, Dateien sichtbar');

// Sitzung abgelaufen → neu anmelden, ohne Code (Gerät ist bekannt)
await ctl('expire');
await p.click('button:has-text("Neu laden")'); await p.waitForTimeout(600);
ok(await p.locator('text=Anmeldung beim NAS ist abgelaufen').count() === 1, 'Abgelaufene Sitzung: Hinweis und Anmeldeformular');
ok((await f.nth(0).inputValue()) === NAS && (await f.nth(1).inputValue()) === 'app', 'Adresse und Benutzer vorausgefüllt');
await f.nth(2).fill('geheim-123'); await login.click(); await p.waitForTimeout(800);
ok(await p.locator('.docs-item').count() === 3, 'Neu angemeldet ohne Code (Gerät gemerkt), Dateien da');

// Löschen
await p.locator('.docs-del').first().click(); await p.waitForTimeout(600);
ok(await p.locator('.docs-item').count() === 2 && (await ctl('state')).files.length === 2, 'Datei gelöscht (auch auf dem NAS)');

// Abmelden
await p.click('button:has-text("Vom NAS abmelden")'); await p.waitForTimeout(500);
st = await ctl('state');
ok(await login.count() === 1 && st.sids === 0, 'Abgemeldet: Formular sichtbar, Sitzung auf dem NAS beendet');
ok(!(await p.evaluate(() => JSON.stringify(localStorage))).includes('sid-'), 'Sitzung vom Handy entfernt');

// Hilfsprogramm: NAS-Oberfläche nicht erreichbar, Freigabe nur für die App
if (!process.env.NAS_CTL_PORT) {
  ok((await fetch(NAS + '/')).status === 404 && (await fetch(NAS + '/webapi/auth.cgi')).status === 404, 'Hilfsprogramm: nur Datei-Schnittstelle erreichbar, NAS-Oberfläche nicht');
  const r = await fetch(NAS + '/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=/x&_sid=nix');
  ok(r.headers.get('access-control-allow-origin') === 'http://localhost:8765', 'Hilfsprogramm: Freigabe nur für die App-Adresse');
}

ok(errs.length === 0, 'Keine Fehler in der App' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
