// Liebesgruss (v0.20): einer Person mit App-Konto einen Text oder ein Foto auf den Startbildschirm schicken.
// Die Person sieht den Gruss beim Öffnen gross und reagiert mit einem Emoji, erst dann geht die App auf.
// Läuft über den normalen Abgleich (Tabelle «greetings»), kein Datenbank-Update nötig.
import { getAllRaw, localChanges, newId, put, putRaw, type BaseRecord } from './db';

export const REACTIONS = ['❤️', '😘', '😂', '👍'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_NAMES: Record<Reaction, string> = { '❤️': 'Herz', '😘': 'Kuss', '😂': 'Lachen', '👍': 'Daumen hoch' };

export interface Greeting extends BaseRecord {
  from: string; // Person, die sendet
  to: string; // Person, die empfängt
  text: string;
  photo: string | null; // verkleinertes JPEG als data-URL
  sentAt: number;
  reaction: Reaction | null;
  reactedAt: number | null;
  seen: boolean; // Absender hat die Reaktion auf der Startseite weggetippt
}

/** Album: höchstens so viele Grüsse behalten. */
export const ALBUM_MAX = 100;

/** Offener Gruss an diese Person (noch keine Reaktion)? */
export const openFor = (list: Greeting[], to: string) => list.find((g) => g.to === to && !g.reaction) ?? null;

/** Grüsse, auf die ich noch reagieren muss (älteste zuerst). */
export const waitingForMe = (list: Greeting[], me: string | null) =>
  me ? list.filter((g) => g.to === me && !g.reaction).sort((a, b) => a.sentAt - b.sentAt) : [];

export async function sendGreeting(from: string, to: string, text: string, photo: string | null) {
  const g: Greeting = { id: newId(), from, to, text: text.trim(), photo, sentAt: Date.now(), reaction: null, reactedAt: null, seen: false, updatedAt: 0, deleted: false };
  await put('greetings', g);
}

export const react = (g: Greeting, r: Reaction) => put<Greeting>('greetings', { ...g, reaction: r, reactedAt: Date.now() });
export const markSeen = (g: Greeting) => put<Greeting>('greetings', { ...g, seen: true });
/** Gruss löschen: Inhalt (Foto) entfernen, damit er keinen Platz mehr braucht. */
export const removeGreeting = (g: Greeting) => put<Greeting>('greetings', { ...g, text: '', photo: null, deleted: true });

/**
 * Welche Grüsse fallen aus dem Album? Sind es mehr als 100, wird bei den älteren (alle ausser den
 * neusten 50) jeder zweite gelöscht – so lange, bis es höchstens 100 sind. So bleiben auch ein paar alte.
 * Offene Grüsse (ohne Reaktion) werden nie gelöscht. Alle Handys rechnen gleich, darum kein Durcheinander.
 */
export function toThin(list: Greeting[], max = ALBUM_MAX): string[] {
  let rest = [...list].sort((a, b) => a.sentAt - b.sentAt || (a.id < b.id ? -1 : 1));
  const out: string[] = [];
  while (rest.length > max) {
    const older = rest.slice(0, rest.length - Math.floor(max / 2));
    const drop = new Set(older.filter((g) => g.reaction).filter((_, i) => i % 2 === 1).map((g) => g.id));
    if (!drop.size) break;
    out.push(...drop);
    rest = rest.filter((g) => !drop.has(g.id));
  }
  return out;
}

/** Album ausdünnen (beim Start und nach Änderungen). */
export async function thinAlbum() {
  const all = (await getAllRaw<Greeting>('greetings')).filter((g) => !g.deleted);
  const ids = new Set(toThin(all));
  if (!ids.size) return;
  const now = Date.now();
  // Löschen beide Handys gleichzeitig, ist das Ergebnis dasselbe (gelöscht)
  await putRaw(
    'greetings',
    all.filter((g) => ids.has(g.id)).map((g) => ({ ...g, text: '', photo: null, deleted: true, updatedAt: Math.max(g.updatedAt + 1, now), dirty: true })),
  );
  localChanges.dispatchEvent(new Event('change'));
}

/** Foto verkleinern (längste Seite 1080 px, JPEG), damit es schnell ankommt und wenig Platz braucht. */
export async function shrinkPhoto(file: Blob, maxSide = 1080, quality = 0.72): Promise<string> {
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
  const w = Math.max(1, Math.round(src.width * f));
  const h = Math.max(1, Math.round(src.height * f));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

export function fmtWhen(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const t = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  if (ts >= day.getTime()) return 'heute ' + t;
  if (ts >= day.getTime() - 86400000) return 'gestern ' + t;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}
