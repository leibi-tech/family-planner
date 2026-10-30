// Erzeugt das App-Symbol als SVG und PNG in public/ (Entwurf von Tobias, Variante 4 «Bunt auf Violett»):
// Grosses Herz, darin die Eltern, die mit ihren Armen ein Herz um die zwei Kinder legen.
// Eltern mit Verlauf blau (Tobias) → rosa (Thadea), Kinder orange (Kind 1) → violett (Kind 2), wie die Kalenderfarben.
// Aufruf: node scripts/make-icons.mjs   (braucht Playwright, siehe tests/pw.mjs)
// Die PNG-Dateien bekommen eine Kennung im Namen (z.B. icon-1a2b3c4d-512.png). Ändert sich das Symbol,
// ändert sich der Name; so merkt Chrome auf Android die Änderung und ersetzt das Symbol auf dem Startbildschirm.
// manifest.webmanifest und index.html werden automatisch nachgeführt.
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '../tests/pw.mjs';

const HEART = 'M256 462 C 148 392, 44 306, 44 190 C 44 112, 100 56, 170 56 C 210 56, 240 76, 256 106 C 272 76, 302 56, 342 56 C 412 56, 468 112, 468 190 C 468 306, 364 392, 256 462 Z';
// Eltern: Köpfe + Schultern + Arme, die zur Herzspitze laufen
const PH = [[180, 150, 44, '#7fbaf5'], [332, 150, 44, '#f590b8']];
const PBODY = 'M138 204 L374 204 C 416 204, 438 234, 434 274 C 428 338, 344 396, 256 446 C 168 396, 84 338, 78 274 C 74 234, 96 204, 138 204 Z';
// Kinder: Köpfe + Schultern, unten offen, damit die Arme der Eltern sie umarmen
const KH = [[212, 280, 30, '#ffbf5a'], [300, 280, 30, '#c3b0fa']];
const KBODY = 'M196 324 L316 324 C 346 324, 362 340, 360 362 C 358 404, 300 450, 256 500 C 212 450, 154 404, 152 362 C 150 340, 166 324, 196 324 Z';
const GAP = 14; // Abstand zwischen Eltern und Kindern

const neck = ([x, y, r], w, h) => `<rect x="${x - w / 2}" y="${y + r - 10}" width="${w}" height="${h}"/>`;
const circles = (list) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
const parents = circles(PH) + PH.map((h) => neck(h, 34, 26)).join('') + `<path d="${PBODY}"/>`;
const kids = circles(KH) + KH.map((h) => neck(h, 22, 20)).join('') + `<path d="${KBODY}"/>`;
const heads = (list) => list.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
const lin = (id, a, b, x1, y1, x2, y2) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

function svg({ maskable }) {
  // maskable: Fläche ganz gefüllt, Inhalt in der sicheren Mitte (Android schneidet rund zu)
  const s = maskable ? 0.82 : 1;
  const t = 256 * (1 - s);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
${lin('bg', '#7a5cf6', '#4327c4', 60, 60, 452, 452)}
${lin('pt', '#5ea4f0', '#f07aa8', 60, 256, 452, 256)}
${lin('kd', '#ffb340', '#b9a3f5', 150, 256, 362, 256)}
<mask id="pm" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#000"/><g fill="#fff">${parents}</g><g fill="#000" stroke="#000" stroke-width="${GAP}" stroke-linejoin="round">${kids}</g></mask>
<clipPath id="heart"><path d="${HEART}"/></clipPath>
</defs>
<rect width="512" height="512" ${maskable ? '' : 'rx="112"'} fill="url(#bg)"/>
<g transform="translate(${t} ${t}) scale(${s})">
<path d="${HEART}" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="12"/>
<g mask="url(#pm)"><rect width="512" height="512" fill="url(#pt)"/>${heads(PH)}</g>
<g clip-path="url(#heart)"><g fill="url(#kd)">${kids}</g></g>${heads(KH)}
</g>
</svg>`;
}

const any = svg({ maskable: false });
const mask = svg({ maskable: true });
writeFileSync('public/icon.svg', any);

const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 1 });
async function png(src, size, file) {
  await p.setViewportSize({ width: size, height: size });
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(src).toString('base64');
  await p.setContent(`<html><body style="margin:0;background:transparent"><img src="${uri}" width="${size}" height="${size}" style="display:block"></body></html>`);
  await p.waitForFunction(() => document.querySelector('img').complete);
  await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
const tag = createHash('sha1').update(any + mask).digest('hex').slice(0, 8);
for (const f of readdirSync('public')) if (/^(icon-.*\.png|apple-touch-icon.*\.png)$/.test(f)) rmSync('public/' + f);
const n = { any192: `icon-${tag}-192.png`, any512: `icon-${tag}-512.png`, mask512: `icon-${tag}-maskable-512.png`, apple: `apple-touch-icon-${tag}.png` };
await png(any, 512, 'public/' + n.any512);
await png(any, 192, 'public/' + n.any192);
await png(mask, 512, 'public/' + n.mask512);
await png(mask, 180, 'public/' + n.apple);
await b.close();

const man = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
man.icons = [
  { src: n.any192, sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: n.any512, sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: n.mask512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];
writeFileSync('public/manifest.webmanifest', JSON.stringify(man, null, 2) + '\n');
const html = readFileSync('public/index.html', 'utf8')
  .replace(/href="\.\/icon[^"]*\.png"/, `href="./${n.any192}"`)
  .replace(/href="\.\/apple-touch-icon[^"]*\.png"/, `href="./${n.apple}"`);
writeFileSync('public/index.html', html);
console.log('Symbole erzeugt (Kennung ' + tag + '): ' + Object.values(n).join(', ') + ', icon.svg');
