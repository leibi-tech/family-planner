// Erzeugt das App-Symbol (Familie mit 4 Personen) als SVG und PNG in public/.
// Köpfe in den Kalenderfarben (Tobias blau, Thadea rosa, Kind 1 orange, Kind 2 violett), mit Verlauf.
// Aufruf: node scripts/make-icons.mjs   (braucht Playwright, siehe tests/pw.mjs)
import { writeFileSync } from 'node:fs';
import { chromium } from '../tests/pw.mjs';

// Farben wie im Kalender (src/calendar.ts, PALETTE): [hell, kräftig]
const P = {
  tobias: ['#7fb6f0', '#2f7dd1'],
  thadea: ['#f39abb', '#d0477a'],
  kind1: ['#ffc560', '#e08a00'],
  kind2: ['#b9a3f5', '#7a5bd6'],
};
// Körper in der App-Farbe Violett (Verlauf von hell nach dunkel)
const BODY = ['#7a5cf6', '#4327c4'];

// Personen: x = Mitte, y = Kopfmitte, r = Kopfradius, w = Schulterbreite
const people = [
  { id: 'tobias', x: 172, y: 196, r: 54, w: 160 },
  { id: 'thadea', x: 340, y: 210, r: 49, w: 146 },
  { id: 'kind1', x: 220, y: 306, r: 38, w: 112 },
  { id: 'kind2', x: 296, y: 318, r: 34, w: 102 },
];

const defs = people
  .map(({ id }) => {
    const [l, c] = P[id];
    return `<linearGradient id="h-${id}" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${l}"/><stop offset="1" stop-color="${c}"/></linearGradient>
<linearGradient id="b-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BODY[0]}"/><stop offset="1" stop-color="${BODY[1]}"/></linearGradient>`;
  })
  .join('\n');

const person = ({ id, x, y, r, w }) => {
  const top = y + r * 1.22;
  const bodyH = 600 - top;
  const outline = 7; // heller Rand, damit sich die Personen voneinander abheben
  return `<g>
<rect x="${x - w / 2}" y="${top}" width="${w}" height="${bodyH}" rx="${w * 0.46}" fill="url(#b-${id})" stroke="#fff6fb" stroke-width="${outline}"/>
<circle cx="${x}" cy="${y}" r="${r}" fill="url(#h-${id})" stroke="#fff6fb" stroke-width="${outline}"/>
<ellipse cx="${x - r * 0.32}" cy="${y - r * 0.38}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#fff" opacity="0.35" transform="rotate(-30 ${x - r * 0.32} ${y - r * 0.38})"/>
</g>`;
};

// Erwachsene hinten, Kinder vorne
const family = people.map(person).join('\n');

function svg({ maskable }) {
  // maskable: Fläche ganz gefüllt, Inhalt in der sicheren Mitte (80 %)
  const s = maskable ? 0.8 : 1;
  const clip = maskable ? '<rect width="512" height="512"/>' : '<rect width="512" height="512" rx="112"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3eeff"/><stop offset="0.6" stop-color="#ebe3ff"/><stop offset="1" stop-color="#ffe3ef"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.38" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
<clipPath id="c">${clip}</clipPath>
${defs}
</defs>
<g clip-path="url(#c)">
<rect width="512" height="512" fill="url(#bg)"/>
<circle cx="256" cy="200" r="230" fill="url(#glow)"/>
<g transform="translate(${256 * (1 - s)} ${256 * (1 - s) + (maskable ? 10 : 18)}) scale(${s})">
${family}
</g>
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
  await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await png(any, 512, 'public/icon-512.png');
await png(any, 192, 'public/icon-192.png');
await png(mask, 512, 'public/icon-maskable-512.png');
await png(mask, 180, 'public/apple-touch-icon.png');
await b.close();
console.log('Symbole erzeugt: public/icon.svg, icon-512.png, icon-192.png, icon-maskable-512.png, apple-touch-icon.png');
