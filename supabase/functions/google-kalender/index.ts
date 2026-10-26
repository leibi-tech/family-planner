// Supabase Edge Function «google-kalender»
// Verbindet ein Konto der App mit einem Google-Konto und holt die Termine aus Google Kalender.
//
// Ablauf «Verbinden»:
//   1) App ruft {action:'connect'} auf → bekommt die Google-Anmeldeseite (Adresse)
//   2) Google schickt nach der Zustimmung hierher zurück (GET ?code=…&state=…)
//   3) Diese Funktion tauscht den Code gegen einen dauerhaften Schlüssel (refresh_token),
//      speichert ihn geschützt in der Tabelle google_accounts und leitet zurück in die App.
// Der Schlüssel verlässt den Server nie. Die App sieht nur die Termine.
//
// Geheimnisse (Supabase → Edge Functions → Secrets): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
// «Verify JWT» muss AUS sein (Google ruft ohne App-Anmeldung zurück). Die Funktion prüft selbst.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

declare const Deno: any;
const env = (k: string): string | undefined =>
  typeof Deno !== 'undefined' ? Deno.env.get(k) : (globalThis as any).process?.env?.[k];

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';
const GCAL = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
].join(' ');
const DEFAULT_APP_URL = 'https://leibi-tech.github.io/family-planner/';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- Supabase-Datenbank (mit Server-Schlüssel) ----------
function serviceKey(): string {
  const k = env('FP_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  if (!k) throw new HttpError(500, 'Server-Schlüssel fehlt.');
  return k;
}
async function db(path: string, init: RequestInit = {}): Promise<any> {
  const key = serviceKey();
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...(init.headers as any) };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    if (/google_accounts/.test(text) && /does not exist|schema cache/i.test(text))
      throw new HttpError(500, 'Die Datenbank ist noch nicht auf dem neusten Stand: bitte «update-0.14.sql» in Supabase ausführen.');
    throw new HttpError(500, `Datenbank-Fehler (${res.status}).`);
  }
  return text ? JSON.parse(text) : null;
}

interface Account {
  user_id: string;
  household_id: string;
  google_email: string | null;
  refresh_token: string;
  access_token: string | null;
  access_expires: number | null;
  calendars: Array<{ id: string; name: string; kind: 'own' | 'family' }>;
}

const getAccount = async (userId: string): Promise<Account | null> =>
  (await db(`google_accounts?user_id=eq.${userId}&select=*`))?.[0] ?? null;

async function isMember(userId: string, household: string): Promise<{ person_id: string | null } | null> {
  const rows = await db(`members?user_id=eq.${userId}&household_id=eq.${household}&select=person_id`);
  return rows?.[0] ?? null;
}

// ---------- Wer ruft an? ----------
async function currentUser(req: Request): Promise<{ id: string; email: string }> {
  const auth = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Bitte zuerst in der App anmelden.');
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: auth, apikey } }).catch(() => null);
  if (!res || !res.ok) throw new HttpError(401, 'Bitte zuerst in der App anmelden.');
  const u = await res.json();
  return { id: u.id, email: u.email };
}

// ---------- «state» bei Google: signiert, damit niemand ein fremdes Konto unterschieben kann ----------
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(env('GOOGLE_CLIENT_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
async function makeState(payload: object): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}
async function readState(state: string): Promise<{ u: string; h: string; r: string; t: number } | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig || (await hmac(body)) !== sig) return null;
  const p = JSON.parse(decodeURIComponent(escape(fromB64url(body))));
  if (Date.now() - p.t > 30 * 60000) return null; // 30 Minuten gültig
  return p;
}

const redirectUri = () => `${env('SUPABASE_URL')}/functions/v1/google-kalender`;
const appUrlOk = (u: string) => {
  const allowed = (env('APP_URL') || DEFAULT_APP_URL).split(',').map((s) => s.trim());
  return allowed.some((a) => u.startsWith(a)) || /^http:\/\/localhost(:\d+)?\//.test(u);
};

// ---------- Google ----------
async function googleToken(params: Record<string, string>): Promise<any> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID')!, client_secret: env('GOOGLE_CLIENT_SECRET')!, ...params }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status === 400 || res.status === 401 ? 409 : 502, String(b.error || 'google'));
  return b;
}

/** Gültiger Zugangsschlüssel für ein Konto (wird bei Bedarf erneuert und gespeichert). */
async function accessToken(acc: Account): Promise<string> {
  if (acc.access_token && (acc.access_expires ?? 0) - 60000 > Date.now()) return acc.access_token;
  let t: any;
  try {
    t = await googleToken({ grant_type: 'refresh_token', refresh_token: acc.refresh_token });
  } catch (e) {
    if (e instanceof HttpError && e.status === 409)
      throw new HttpError(409, `Die Verbindung zu Google (${acc.google_email ?? 'Konto'}) ist abgelaufen. Bitte neu verbinden.`);
    throw e;
  }
  acc.access_token = t.access_token;
  acc.access_expires = Date.now() + (t.expires_in ?? 3600) * 1000;
  await db(`google_accounts?user_id=eq.${acc.user_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ access_token: acc.access_token, access_expires: acc.access_expires, updated_at: new Date().toISOString() }),
  });
  return acc.access_token!;
}

async function gcal(acc: Account, path: string): Promise<any> {
  const tok = await accessToken(acc);
  const res = await fetch(GCAL + path, { headers: { Authorization: `Bearer ${tok}` } });
  const b = await res.json().catch(() => ({}));
  if (res.status === 401) throw new HttpError(409, `Die Verbindung zu Google (${acc.google_email ?? 'Konto'}) ist abgelaufen. Bitte neu verbinden.`);
  if (res.status === 404 || res.status === 403) throw new HttpError(404, 'Kalender nicht gefunden oder nicht freigegeben.');
  if (!res.ok) throw new HttpError(502, `Google antwortet nicht richtig (${res.status}).`);
  return b;
}

// ---------- Termine in ein einfaches Format bringen ----------
export interface CalEvent {
  id: string;
  calendarId: string;
  recurringEventId: string | null;
  title: string;
  allDay: boolean;
  start: string; // ganztägig: JJJJ-MM-TT, sonst ISO mit Zeitzone
  end: string; // ganztägig: Folgetag (exklusiv), wie bei Google
  location: string | null;
  description: string | null;
  link: string | null;
}

export function simplifyEvent(e: any, calendarId: string): CalEvent | null {
  if (!e || e.status === 'cancelled' || !e.start) return null;
  const allDay = !!e.start.date;
  return {
    id: e.id,
    calendarId,
    recurringEventId: e.recurringEventId ?? null,
    title: e.summary || '(ohne Titel)',
    allDay,
    start: allDay ? e.start.date : e.start.dateTime,
    end: allDay ? e.end?.date ?? e.start.date : e.end?.dateTime ?? e.start.dateTime,
    location: e.location ?? null,
    description: e.description ? String(e.description).slice(0, 2000) : null,
    link: e.htmlLink ?? null,
  };
}

async function listEvents(acc: Account, calId: string, from: string, to: string): Promise<CalEvent[]> {
  const out: CalEvent[] = [];
  let page: string | undefined;
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: from,
      timeMax: to,
      maxResults: '2500',
      timeZone: 'Europe/Zurich',
      fields: 'nextPageToken,items(id,status,summary,start,end,location,description,recurringEventId,htmlLink)',
    });
    if (page) q.set('pageToken', page);
    const b = await gcal(acc, `/calendars/${encodeURIComponent(calId)}/events?${q}`);
    for (const e of b.items ?? []) {
      const s = simplifyEvent(e, calId);
      if (s) out.push(s);
    }
    page = b.nextPageToken;
    if (!page) break;
  }
  return out;
}

// ---------- Aktionen ----------
async function actConnect(user: { id: string }, body: any): Promise<Response> {
  const household = String(body?.household ?? '');
  const returnUrl = String(body?.returnUrl ?? '');
  if (!appUrlOk(returnUrl)) throw new HttpError(400, 'Ungültige Rücksprung-Adresse.');
  if (!(await isMember(user.id, household))) throw new HttpError(403, 'Du gehörst nicht zu diesem Haushalt.');
  if (!env('GOOGLE_CLIENT_ID') || !env('GOOGLE_CLIENT_SECRET'))
    throw new HttpError(500, 'Google ist in Supabase noch nicht eingerichtet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET fehlen).');
  const state = await makeState({ u: user.id, h: household, r: returnUrl, t: Date.now() });
  const q = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID')!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  if (body?.hint) q.set('login_hint', String(body.hint));
  return json({ url: `${GOOGLE_AUTH}?${q}` });
}

function backToApp(returnUrl: string, result: string): Response {
  const u = returnUrl.split('#')[0] + '#kalender=' + encodeURIComponent(result);
  return new Response(null, { status: 302, headers: { Location: u } });
}

async function actCallback(url: URL): Promise<Response> {
  const state = await readState(url.searchParams.get('state') ?? '').catch(() => null);
  if (!state) return new Response('Der Link ist abgelaufen. Bitte in der App nochmals «Mit Google verbinden» wählen.', { status: 400 });
  if (url.searchParams.get('error')) return backToApp(state.r, 'abgebrochen');
  const code = url.searchParams.get('code');
  if (!code) return backToApp(state.r, 'fehler');
  try {
    const t = await googleToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
    const granted = String(t.scope ?? '');
    if (!granted.includes('calendar.events')) return backToApp(state.r, 'rechte');
    let email: string | null = null;
    try {
      email = JSON.parse(decodeURIComponent(escape(fromB64url(String(t.id_token).split('.')[1])))).email ?? null;
    } catch {}
    const old = await getAccount(state.u);
    const refresh = t.refresh_token ?? old?.refresh_token;
    if (!refresh) return backToApp(state.r, 'fehler');
    const sameGoogle = old && old.google_email === email;
    await db('google_accounts?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: state.u,
        household_id: state.h,
        google_email: email,
        refresh_token: refresh,
        access_token: t.access_token,
        access_expires: Date.now() + (t.expires_in ?? 3600) * 1000,
        calendars: sameGoogle ? old!.calendars : [],
        updated_at: new Date().toISOString(),
      }),
    });
    return backToApp(state.r, 'ok');
  } catch {
    return backToApp(state.r, 'fehler');
  }
}

async function actStatus(user: { id: string }): Promise<Response> {
  const acc = await getAccount(user.id);
  if (!acc) return json({ connected: false });
  return json({ connected: true, email: acc.google_email, calendars: acc.calendars });
}

async function actCalendars(user: { id: string }): Promise<Response> {
  const acc = await getAccount(user.id);
  if (!acc) throw new HttpError(409, 'Noch nicht mit Google verbunden.');
  const b = await gcal(acc, '/users/me/calendarList?fields=items(id,summary,summaryOverride,backgroundColor,accessRole,primary)&maxResults=250');
  const list = (b.items ?? []).map((c: any) => ({
    id: c.id,
    name: c.summaryOverride || c.summary || c.id,
    color: c.backgroundColor ?? null,
    access: c.accessRole,
    primary: !!c.primary,
  }));
  return json({ email: acc.google_email, calendars: list, selected: acc.calendars });
}

async function actSelect(user: { id: string }, body: any): Promise<Response> {
  const acc = await getAccount(user.id);
  if (!acc) throw new HttpError(409, 'Noch nicht mit Google verbunden.');
  const sel = (Array.isArray(body?.calendars) ? body.calendars : [])
    .filter((c: any) => c && typeof c.id === 'string' && (c.kind === 'own' || c.kind === 'family'))
    .slice(0, 20)
    .map((c: any) => ({ id: c.id, name: String(c.name ?? c.id).slice(0, 100), kind: c.kind }));
  await db(`google_accounts?user_id=eq.${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ calendars: sel, updated_at: new Date().toISOString() }),
  });
  return json({ ok: true, calendars: sel });
}

async function actDisconnect(user: { id: string }): Promise<Response> {
  const acc = await getAccount(user.id);
  if (acc) {
    await fetch(`${GOOGLE_REVOKE}?token=${encodeURIComponent(acc.refresh_token)}`, { method: 'POST' }).catch(() => null);
    await db(`google_accounts?user_id=eq.${user.id}`, { method: 'DELETE' });
  }
  return json({ ok: true });
}

/** Termine aller verbundenen Konten des Haushalts im Zeitraum from–to. */
async function actEvents(user: { id: string }, body: any): Promise<Response> {
  const household = String(body?.household ?? '');
  const from = new Date(String(body?.from ?? ''));
  const to = new Date(String(body?.to ?? ''));
  if (isNaN(+from) || isNaN(+to) || to <= from || +to - +from > 400 * 86400000) throw new HttpError(400, 'Ungültiger Zeitraum.');
  if (!(await isMember(user.id, household))) throw new HttpError(403, 'Du gehörst nicht zu diesem Haushalt.');

  const accounts: Account[] = await db(`google_accounts?household_id=eq.${household}&select=*`);
  const members: Array<{ user_id: string; person_id: string | null }> = await db(
    `members?household_id=eq.${household}&select=user_id,person_id`,
  );
  const personOf = new Map(members.map((m) => [m.user_id, m.person_id]));
  // Nur Konten, die (noch) zum Haushalt gehören
  const active = accounts.filter((a) => personOf.has(a.user_id));
  // Eigenes Konto zuerst, damit ein gemeinsamer Familienkalender mit dem eigenen Zugang gelesen wird
  active.sort((a, b) => (a.user_id === user.id ? -1 : b.user_id === user.id ? 1 : 0));

  const calendars: Array<{ id: string; name: string; kind: 'own' | 'family'; personId: string | null; mine: boolean; email: string | null }> = [];
  const events: CalEvent[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const acc of active) {
    for (const c of acc.calendars ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      try {
        const evs = await listEvents(acc, c.id, from.toISOString(), to.toISOString());
        events.push(...evs);
        calendars.push({
          id: c.id,
          name: c.name,
          kind: c.kind,
          personId: c.kind === 'own' ? personOf.get(acc.user_id) ?? null : null,
          mine: acc.user_id === user.id,
          email: acc.google_email,
        });
      } catch (e) {
        errors.push(e instanceof HttpError ? e.message : `Kalender «${c.name}» konnte nicht geladen werden.`);
        seen.delete(c.id); // evtl. mit einem anderen Konto lesbar
      }
    }
  }
  return json({ calendars, events, errors: [...new Set(errors)] });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  try {
    if (req.method === 'GET') return await actCallback(url);
    if (req.method !== 'POST') return json({ error: 'Nicht erlaubt.' }, 405);
    const user = await currentUser(req);
    const body = await req.json().catch(() => ({}));
    switch (body?.action) {
      case 'connect':
        return await actConnect(user, body);
      case 'status':
        return await actStatus(user);
      case 'calendars':
        return await actCalendars(user);
      case 'select':
        return await actSelect(user, body);
      case 'disconnect':
        return await actDisconnect(user);
      case 'events':
        return await actEvents(user, body);
      default:
        return json({ error: 'Unbekannte Aktion.' }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: 'Unerwarteter Fehler in der Kalender-Funktion.' }, 500);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handler);
