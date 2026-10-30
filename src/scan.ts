// Dokumenten-Scanner (v0.21): Blatt im Foto finden, gerade ziehen, aufhellen, als PDF speichern.
// Alles läuft im Handy, ohne Zusatzbibliothek.

export type Pt = { x: number; y: number };
/** Ecken in der Reihenfolge oben links, oben rechts, unten rechts, unten links. */
export type Quad = [Pt, Pt, Pt, Pt];
export type ScanFilter = 'farbe' | 'sw' | 'original';

/** Bild laden (Drehung aus dem Foto beachten), längste Seite höchstens maxSide. */
export async function loadImage(file: Blob, maxSide = 2400): Promise<HTMLCanvasElement> {
  let src: CanvasImageSource & { width: number; height: number };
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    src = await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Das Bild lässt sich nicht öffnen.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const f = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * f));
  c.height = Math.max(1, Math.round(src.height * f));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Um 90° im Uhrzeigersinn drehen. */
export function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.height;
  c.height = src.width;
  const x = c.getContext('2d')!;
  x.translate(c.width, 0);
  x.rotate(Math.PI / 2);
  x.drawImage(src, 0, 0);
  return c;
}

export const fullQuad = (w: number, h: number): Quad => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

/**
 * Blatt im Bild suchen: Papier ist meist heller als der Untergrund. Bild verkleinern, hell/dunkel
 * trennen (Otsu), grösste helle Fläche nehmen, deren äusserste Punkte sind die Ecken.
 * Findet es nichts Brauchbares → null (dann ganzes Bild).
 */
export function detectQuad(src: HTMLCanvasElement): Quad | null {
  const S = 360;
  const f = Math.min(1, S / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * f));
  const h = Math.max(8, Math.round(src.height * f));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  // Graustufen + leicht weichzeichnen (Text im Blatt soll die Fläche nicht zerreissen)
  let g: Float32Array = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  g = boxBlur(g, w, h, 2);
  g = boxBlur(g, w, h, 2);
  // Otsu-Schwelle
  const hist = new Array(256).fill(0);
  for (let i = 0; i < g.length; i++) hist[Math.min(255, Math.max(0, Math.round(g[i])))]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = g.length - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < g.length; i++) bin[i] = g[i] > thr ? 1 : 0;
  // Grösste zusammenhängende helle Fläche
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestLabel = 0, bestSize = 0, cur = 0;
  for (let i = 0; i < w * h; i++) {
    if (!bin[i] || label[i]) continue;
    cur++;
    let sp = 0, size = 0;
    stack[sp++] = i;
    label[i] = cur;
    while (sp) {
      const p = stack[--sp];
      size++;
      const x = p % w, y = (p - x) / w;
      if (x > 0 && bin[p - 1] && !label[p - 1]) (label[p - 1] = cur), (stack[sp++] = p - 1);
      if (x < w - 1 && bin[p + 1] && !label[p + 1]) (label[p + 1] = cur), (stack[sp++] = p + 1);
      if (y > 0 && bin[p - w] && !label[p - w]) (label[p - w] = cur), (stack[sp++] = p - w);
      if (y < h - 1 && bin[p + w] && !label[p + w]) (label[p + w] = cur), (stack[sp++] = p + w);
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = cur;
    }
  }
  const area = w * h;
  if (bestSize < area * 0.12 || bestSize > area * 0.97) return null;
  // Blatt muss sich deutlich vom Untergrund abheben (sonst nur ein heller Fleck im Bild)
  let sIn = 0, sOut = 0;
  for (let i = 0; i < area; i++) label[i] === bestLabel ? (sIn += g[i]) : (sOut += g[i]);
  if (sIn / bestSize - sOut / (area - bestSize) < 40) return null;
  // Ecken = äusserste Punkte in den 4 Diagonalrichtungen
  let tl = { v: Infinity, x: 0, y: 0 }, br = { v: -Infinity, x: 0, y: 0 }, tr = { v: -Infinity, x: 0, y: 0 }, bl = { v: Infinity, x: 0, y: 0 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (label[y * w + x] !== bestLabel) continue;
      const s = x + y, dd = x - y;
      if (s < tl.v) tl = { v: s, x, y };
      if (s > br.v) br = { v: s, x, y };
      if (dd > tr.v) tr = { v: dd, x, y };
      if (dd < bl.v) bl = { v: dd, x, y };
    }
  const k = 1 / f;
  const q: Quad = [
    { x: tl.x * k, y: tl.y * k },
    { x: (tr.x + 1) * k, y: tr.y * k },
    { x: (br.x + 1) * k, y: (br.y + 1) * k },
    { x: bl.x * k, y: (bl.y + 1) * k },
  ];
  // Fläche des Vierecks muss zur gefundenen Fläche passen (sonst ist es kein Blatt)
  const qa = quadArea(q) * f * f;
  if (qa < bestSize * 0.8 || qa > bestSize * 1.5) return null;
  // minimal nach innen, damit kein Streifen vom Tisch im Scan bleibt
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  return q.map((p) => ({
    x: Math.min(src.width, Math.max(0, p.x + (cx - p.x) * 0.012)),
    y: Math.min(src.height, Math.max(0, p.y + (cy - p.y) * 0.012)),
  })) as Quad;
}

function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i], n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Schneller Weichzeichner (Kasten, horizontal + vertikal). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / (2 * r + 1);
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Abbildung vom Rechteck (0..1 × 0..1) auf das Viereck q (Perspektive). */
function squareToQuad(q: Quad) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = p1.x - p0.x; b = p2.x - p1.x; c = p0.x;
    d = p1.y - p0.y; e = p2.y - p1.y; f = p0.y;
    g = 0; h = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
    a = p1.x - p0.x + g * p1.x; b = p3.x - p0.x + h * p3.x; c = p0.x;
    d = p1.y - p0.y + g * p1.y; e = p3.y - p0.y + h * p3.y; f = p0.y;
  }
  return (u: number, v: number): [number, number] => {
    const z = g * u + h * v + 1;
    return [(a * u + b * v + c) / z, (d * u + e * v + f) / z];
  };
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Viereck aus dem Bild ausschneiden und gerade ziehen. Längste Seite höchstens maxSide. */
export function warp(src: HTMLCanvasElement, q: Quad, maxSide = 2000): HTMLCanvasElement {
  let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const f = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(1, Math.round(W * f));
  H = Math.max(1, Math.round(H * f));
  const sw = src.width, sh = src.height;
  const sd = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(W, H);
  const od = img.data;
  const map = squareToQuad(q);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      let [sx, sy] = map((x + 0.5) / W, v);
      sx = Math.min(sw - 1.001, Math.max(0, sx - 0.5));
      sy = Math.min(sh - 1.001, Math.max(0, sy - 0.5));
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        const top = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx;
        const bot = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
        od[o + k] = top + (bot - top) * fy;
      }
      od[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/**
 * Aufhellen wie ein Scanner: Schatten und graues Papier werden weiss, Schrift bleibt kräftig.
 * Dazu wird die Helligkeit des Papiers (stark weichgezeichnet) herausgerechnet.
 * «farbe» behält Farben (Stempel, Logos), «sw» = Graustufen mit mehr Kontrast.
 */
export function enhance(c: HTMLCanvasElement, mode: ScanFilter): HTMLCanvasElement {
  if (mode === 'original') return c;
  const w = c.width, h = c.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Hintergrund (Papierhelligkeit) auf kleinem Bild schätzen
  const s = Math.max(1, Math.round(Math.max(w, h) / 160));
  const bw = Math.ceil(w / s), bh = Math.ceil(h / s);
  let bg: Float32Array = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      // hellster Wert im Feld (Papier), damit Schrift den Hintergrund nicht abdunkelt
      let m = 0;
      for (let y = by * s; y < Math.min(h, by * s + s); y += 2)
        for (let x = bx * s; x < Math.min(w, bx * s + s); x += 2) {
          const i = (y * w + x) * 4;
          const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (v > m) m = v;
        }
      bg[by * bw + bx] = m;
    }
  bg = maxFilter(bg, bw, bh, 2);
  bg = boxBlur(bg, bw, bh, 3);
  const gamma = mode === 'sw' ? 2.0 : 1.5;
  const lut = new Uint8ClampedArray(1001);
  for (let i = 0; i <= 1000; i++) {
    const r = i / 1000;
    // oberhalb ~0.88 ganz weiss, darunter abdunkeln
    lut[i] = 255 * Math.pow(Math.min(1, r / 0.88), gamma);
  }
  for (let y = 0; y < h; y++) {
    const fy = Math.min(bh - 1.001, Math.max(0, y / s - 0.5));
    const y0 = fy | 0, ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1.001, Math.max(0, x / s - 0.5));
      const x0 = fx | 0, tx = fx - x0;
      const a = bg[y0 * bw + x0], b = bg[y0 * bw + x0 + 1], cc = bg[(y0 + 1) * bw + x0], dd = bg[(y0 + 1) * bw + x0 + 1];
      const back = Math.max(40, a + (b - a) * tx + (cc + (dd - cc) * tx - (a + (b - a) * tx)) * ty);
      const i = (y * w + x) * 4;
      if (mode === 'sw') {
        const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const o = lut[Math.min(1000, Math.round((v / back) * 1000))];
        d[i] = d[i + 1] = d[i + 2] = o;
      } else {
        for (let k = 0; k < 3; k++) d[i + k] = lut[Math.min(1000, Math.round((d[i + k] / back) * 1000))];
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function maxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++)
        for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) m = Math.max(m, src[yy * w + xx]);
      out[y * w + x] = m;
    }
  return out;
}

export const toJpeg = (c: HTMLCanvasElement, q = 0.7): Promise<Blob> =>
  new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht gespeichert werden.'))), 'image/jpeg', q));

/** Kleines Vorschaubild als data-URL (für die Liste, auch offline). */
export function thumbOf(c: HTMLCanvasElement, side = 240): string {
  const f = Math.min(1, side / Math.max(c.width, c.height));
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(c.width * f));
  t.height = Math.max(1, Math.round(c.height * f));
  const x = t.getContext('2d')!;
  x.fillStyle = '#fff';
  x.fillRect(0, 0, t.width, t.height);
  x.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.6);
}

export interface PdfPage {
  jpeg: Uint8Array;
  width: number; // Pixel
  height: number;
}

/** Einfaches PDF: jede Seite ein JPEG-Bild, Breite A4 (595 pt), Höhe passend zum Bild. */
export function makePdf(pages: PdfPage[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const add = (p: string | Uint8Array) => {
    const b = typeof p === 'string' ? enc.encode(p) : p;
    parts.push(b);
    len += b.length;
  };
  const obj = (n: number) => {
    offsets[n] = len;
  };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  // 1 = Katalog, 2 = Seitenliste, je Seite: Seite, Inhalt, Bild
  const pageObj = (i: number) => 3 + i * 3;
  obj(1);
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  obj(2);
  add(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>\nendobj\n`);
  pages.forEach((p, i) => {
    const pw = 595.28;
    const ph = Math.round((pw * p.height) / p.width * 100) / 100;
    const po = pageObj(i), co = po + 1, io = po + 2;
    obj(po);
    add(`${po} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im${i} ${io} 0 R >> >> /Contents ${co} 0 R >>\nendobj\n`);
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
    obj(co);
    add(`${co} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    obj(io);
    add(`${io} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    add(p.jpeg);
    add('\nendstream\nendobj\n');
  });
  const total = 3 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  add(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/**
 * Seitenbilder (JPEG) aus einem PDF holen, damit man es in der App ansehen kann.
 * Klappt bei eigenen Scans und bei den meisten PDFs aus Scanner-Apps. Andere PDFs → leere Liste.
 */
export function extractJpegs(bytes: Uint8Array, max = 30): Blob[] {
  const out: Blob[] = [];
  const latin = new TextDecoder('latin1').decode(bytes);
  let from = 0;
  while (out.length < max) {
    const f = latin.indexOf('/DCTDecode', from);
    if (f < 0) break;
    const st = latin.indexOf('stream', f);
    if (st < 0) break;
    let start = st + 6;
    if (latin[start] === '\r') start++;
    if (latin[start] === '\n') start++;
    const end = latin.indexOf('endstream', start);
    if (end < 0) break;
    const dictStart = latin.lastIndexOf('<<', f);
    const dict = latin.slice(dictStart, st);
    // Nur ganze Seitenbilder (JPEG beginnt mit FF D8), keine kleinen Logos und keine doppelt gefilterten
    const wd = Number(/\/Width\s+(\d+)/.exec(dict)?.[1] ?? 0);
    const hd = Number(/\/Height\s+(\d+)/.exec(dict)?.[1] ?? 0);
    if (bytes[start] === 0xff && bytes[start + 1] === 0xd8 && !/FlateDecode/.test(dict) && Math.max(wd, hd) >= 400) {
      let e = end;
      while (e > start && !(bytes[e - 2] === 0xff && bytes[e - 1] === 0xd9)) e--;
      if (e > start) out.push(new Blob([bytes.slice(start, e)], { type: 'image/jpeg' }));
    }
    from = end + 9;
  }
  return out;
}
