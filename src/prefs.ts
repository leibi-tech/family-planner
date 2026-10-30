// Persönliche Einstellungen auf diesem Gerät: Menüleiste und Aussehen (hell/dunkel).
// Jede Person hat ihr eigenes Handy, darum gilt die Einstellung pro Gerät.
import { useEffect, useState } from 'react';

/** Seiten, die man in der Menüleiste anheften kann (alles andere steht unter «Mehr»). */
export const PINNABLE = ['einkauf', 'todo', 'notizen', 'kalender', 'plan', 'menues', 'gruesse', 'dokumente', 'familie'] as const;
export type PinTab = (typeof PINNABLE)[number];

/** Freie Plätze: zwei links von Start, einer rechts (dann Mehr). So bleibt Start in der Mitte. */
export const NAV_SLOTS = 3;
export const DEFAULT_NAV: PinTab[] = ['einkauf', 'todo', 'notizen'];

export type Theme = 'hell' | 'dunkel';

const NAV_KEY = 'fp-nav';
const THEME_KEY = 'fp-theme';
const events = new EventTarget();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* Speicher gesperrt: gilt dann nur bis zum Neuladen */
  }
}

export function getNav(): PinTab[] {
  try {
    const v = JSON.parse(read(NAV_KEY) ?? 'null');
    if (Array.isArray(v)) {
      const ok = v.filter((x, i) => (PINNABLE as readonly string[]).includes(x) && v.indexOf(x) === i);
      return ok.slice(0, NAV_SLOTS) as PinTab[];
    }
  } catch {
    /* ungültig → Standard */
  }
  return [...DEFAULT_NAV];
}
export function setNav(v: PinTab[]) {
  write(NAV_KEY, JSON.stringify(v.slice(0, NAV_SLOTS)));
  events.dispatchEvent(new Event('nav'));
}
export function useNav(): PinTab[] {
  const [v, setV] = useState(getNav);
  useEffect(() => {
    const h = () => setV(getNav());
    events.addEventListener('nav', h);
    return () => events.removeEventListener('nav', h);
  }, []);
  return v;
}

export function getTheme(): Theme {
  return read(THEME_KEY) === 'dunkel' ? 'dunkel' : 'hell';
}
/** Aussehen auf die Seite anwenden (auch die Farbe der Android-Statusleiste). */
export function applyTheme(t: Theme = getTheme()) {
  document.documentElement.dataset.theme = t === 'dunkel' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dunkel' ? '#2d2650' : '#efeaff');
}
export function setTheme(t: Theme) {
  write(THEME_KEY, t);
  applyTheme(t);
  events.dispatchEvent(new Event('theme'));
}
export function useTheme(): Theme {
  const [v, setV] = useState(getTheme);
  useEffect(() => {
    const h = () => setV(getTheme());
    events.addEventListener('theme', h);
    return () => events.removeEventListener('theme', h);
  }, []);
  return v;
}
