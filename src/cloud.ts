// Verbindung zu Supabase (Phase 2) – ohne Zusatzbibliothek, direkt über die Web-Schnittstelle.
// Die Adresse und der «publishable»-Schlüssel sind öffentlich gedacht; geschützt wird über
// die Sicherheitsregeln in der Datenbank (siehe supabase/schema.sql).
import { getMeta, setMeta } from './db';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;
export const SUPABASE_URL = __SUPABASE_URL__;
const KEY = __SUPABASE_KEY__;

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Sekunden seit 1970
  user: { id: string; email: string };
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

export class CloudError extends Error {}

let session: Session | null | undefined;
const listeners = new EventTarget();
export const onSessionChange = (fn: () => void) => {
  listeners.addEventListener('change', fn);
  return () => listeners.removeEventListener('change', fn);
};

async function saveSession(s: Session | null) {
  session = s;
  await setMeta('session', s ?? undefined);
  listeners.dispatchEvent(new Event('change'));
}

export async function getSession(): Promise<Session | null> {
  if (session === undefined) session = (await getMeta<Session>('session')) ?? null;
  return session;
}

/** Übersetzt Fehlermeldungen von Supabase in verständliches Deutsch. */
function niceError(status: number, body: any): string {
  const msg = String(body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? '');
  const code = String(body?.error_code ?? body?.code ?? '');
  if (code === 'invalid_credentials' || /invalid login/i.test(msg)) return 'E-Mail oder Passwort stimmt nicht.';
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'Für diese E-Mail gibt es schon ein Konto. Bitte «Anmelden» wählen.';
  if (code === 'weak_password' || /password should be/i.test(msg)) return 'Das Passwort ist zu kurz (mindestens 6, besser 8 Zeichen).';
  if (code === 'email_address_invalid' || /email.*invalid/i.test(msg)) return 'Diese E-Mail-Adresse ist ungültig.';
  if (code === 'email_not_confirmed') return 'Die E-Mail ist noch nicht bestätigt (in Supabase «Confirm email» ausschalten).';
  if (/Code ungültig/.test(msg)) return 'Dieser Einladungscode ist ungültig.';
  if (status === 429) return 'Zu viele Versuche. Bitte kurz warten.';
  return msg || `Fehler ${status}`;
}

async function call(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<any> {
  const headers: Record<string, string> = { apikey: KEY, 'Content-Type': 'application/json', ...(init.headers as any) };
  if (init.auth !== false) {
    const s = await validSession();
    headers.Authorization = `Bearer ${s.access_token}`;
  }
  let res: Response;
  try {
    res = await fetch(SUPABASE_URL + path, { ...init, headers });
  } catch {
    throw new CloudError('Keine Verbindung zum Internet.');
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && init.auth !== false) {
      // Sitzung ungültig geworden
      await saveSession(null);
    }
    throw new CloudError(niceError(res.status, body));
  }
  return body;
}

function toSession(b: any): Session {
  return {
    access_token: b.access_token,
    refresh_token: b.refresh_token,
    expires_at: b.expires_at ?? Math.floor(Date.now() / 1000) + (b.expires_in ?? 3600),
    user: { id: b.user.id, email: b.user.email },
  };
}

let refreshing: Promise<Session> | null = null;

async function validSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new CloudError('Nicht angemeldet.');
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  if (!refreshing) {
    refreshing = call('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    })
      .then(async (b) => {
        const ns = toSession(b);
        await saveSession(ns);
        return ns;
      })
      .finally(() => (refreshing = null));
  }
  return refreshing;
}

export async function signUp(email: string, password: string): Promise<void> {
  const b = await call('/auth/v1/signup', { method: 'POST', auth: false, body: JSON.stringify({ email, password }) });
  if (!b?.access_token) throw new CloudError('Konto erstellt, aber in Supabase ist «Confirm email» noch eingeschaltet.');
  await saveSession(toSession(b));
}

export async function signIn(email: string, password: string): Promise<void> {
  const b = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
  await saveSession(toSession(b));
}

export async function signOut(): Promise<void> {
  try {
    await call('/auth/v1/logout', { method: 'POST' });
  } catch {
    /* offline oder schon abgemeldet – egal */
  }
  await saveSession(null);
}

export async function myHouseholds(): Promise<Household[]> {
  return call('/rest/v1/households?select=id,name,invite_code&order=created_at.asc');
}

export async function createHousehold(name: string): Promise<Household> {
  return call('/rest/v1/rpc/create_household', { method: 'POST', body: JSON.stringify({ p_name: name }) });
}

export async function joinHousehold(code: string): Promise<Household> {
  return call('/rest/v1/rpc/join_household', { method: 'POST', body: JSON.stringify({ p_code: code }) });
}

export interface CloudRecord {
  household_id: string;
  store: string;
  id: string;
  data: any;
  updated_at: number;
  deleted: boolean;
  server_updated_at?: string;
}

export async function pushRecords(rows: CloudRecord[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 200) {
    await call('/rest/v1/records', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 200)),
    });
  }
}

/** Holt alle Einträge, die seit «since» auf dem Server geändert wurden (seitenweise). */
export async function pullRecords(householdId: string, since: string | null): Promise<CloudRecord[]> {
  const out: CloudRecord[] = [];
  let cursor = since;
  for (;;) {
    const filter = cursor ? `&server_updated_at=gt.${encodeURIComponent(cursor)}` : '';
    const page: CloudRecord[] = await call(
      `/rest/v1/records?select=store,id,data,updated_at,deleted,server_updated_at&household_id=eq.${householdId}${filter}&order=server_updated_at.asc&limit=500`,
    );
    out.push(...page);
    if (page.length < 500) break;
    cursor = page[page.length - 1].server_updated_at!;
  }
  return out;
}
