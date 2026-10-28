// Seitenübergreifend öffnen: z.B. von der Startseite direkt zu einem Menü, einer Notiz oder einem ToDo.
// Die Zielseite holt sich die Anfrage ab, sobald ihre Daten geladen sind.
export type NavKind = 'note' | 'menu' | 'todo' | 'event';

/** Auf welcher Seite (Tab) wird das Ziel angezeigt? */
export const TAB_FOR: Record<NavKind, string> = { note: 'notizen', menu: 'menues', todo: 'todo', event: 'kalender' };

export interface OpenRequest {
  kind: NavKind;
  id: string;
  from: string | null; // Seite, zu der «Zurück» nach dem Schliessen führt
}

let pending: OpenRequest | null = null;
const events = new EventTarget();

/** Bittet die App, zur passenden Seite zu wechseln und das Ziel zu öffnen. */
export function requestOpen(kind: NavKind, id: string, from: string | null) {
  pending = { kind, id, from };
  events.dispatchEvent(new CustomEvent('open', { detail: kind }));
}

/** Wird von der Zielseite aufgerufen, sobald sie geladen ist. */
export function takePending(kind: NavKind): OpenRequest | null {
  if (!pending || pending.kind !== kind) return null;
  const p = pending;
  pending = null;
  return p;
}

export const onOpenRequest = (fn: (kind: NavKind) => void) => {
  const h = (e: Event) => fn((e as CustomEvent<NavKind>).detail);
  events.addEventListener('open', h);
  return () => events.removeEventListener('open', h);
};

/** Nach dem Schliessen eines von aussen geöffneten Ziels zur Ausgangsseite zurück. */
export function navBack(from: string) {
  events.dispatchEvent(new CustomEvent('back', { detail: from }));
}
export const onNavBack = (fn: (from: string) => void) => {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  events.addEventListener('back', h);
  return () => events.removeEventListener('back', h);
};
