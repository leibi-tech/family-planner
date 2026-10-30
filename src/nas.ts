// Verbindung zum Synology NAS (DSM Web API, File Station).
// Die Anmeldung läuft direkt mit dem NAS-Konto. Sitzung und Gerätekennung bleiben nur auf diesem Handy
// (localStorage) – nichts davon geht an Supabase.
// Der NAS wird über ein kleines Hilfsprogramm erreicht (nas/ im Repository), das die nötige Freigabe
// für die App ergänzt (CORS). Alle Anfragen sind «einfache» Anfragen (GET oder POST mit Formular),
// damit der Browser keine Vorab-Prüfung (OPTIONS) schickt.

export const NAS_ROOT = '/Familien-Dokumente';
export const NAS_TEST_FOLDER = NAS_ROOT + '/Test';

export interface NasLogin {
  url: string; // z.B. https://name.synology.me:8443
  user: string;
  sid: string;
  did?: string; // Gerätekennung: nach der ersten 2-Schritt-Anmeldung braucht es keinen Code mehr
}

export interface NasFile {
  name: string;
  path: string;
  isdir: boolean;
  size: number;
  mtime: number; // Sekunden
}

const KEY = 'fp-nas';
const DID_KEY = 'fp-nas-did';

export function loadNas(): NasLogin | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && v.url && v.sid ? v : null;
  } catch {
    return null;
  }
}

function saveNas(v: NasLogin | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* egal */
  }
}

/** Zuletzt verwendete Adresse und Benutzername (für das Anmeldeformular). */
export function lastNasInput(): { url: string; user: string } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY + '-last') || 'null');
    return { url: v?.url ?? '', user: v?.user ?? '' };
  } catch {
    return { url: '', user: '' };
  }
}

export function normalizeUrl(input: string): string {
  let u = input.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

/** Fehler mit verständlicher Meldung. `relogin` = Sitzung abgelaufen, neu anmelden. `otp` = Code nötig. */
export class NasError extends Error {
  constructor(
    message: string,
    public code?: number,
    public relogin = false,
    public otp = false,
  ) {
    super(message);
  }
}

const AUTH_MSG: Record<number, string> = {
  400: 'Benutzername oder Passwort stimmt nicht.',
  401: 'Dieses NAS-Konto ist deaktiviert.',
  402: 'Dieses NAS-Konto darf File Station nicht benutzen (NAS: Benutzer → Programme).',
  403: 'Bitte den 6-stelligen Code aus der Authenticator-App eingeben.',
  404: 'Der Code stimmt nicht. Bitte den aktuellen Code eingeben.',
  406: 'Der NAS verlangt für dieses Konto die 2-Schritt-Anmeldung. Bitte zuerst einmal im Browser beim NAS anmelden und sie einrichten.',
  407: 'Der NAS hat diese Verbindung wegen zu vieler Fehlversuche gesperrt. Später nochmals versuchen oder die Sperre im NAS aufheben.',
  409: 'Das Passwort ist abgelaufen. Bitte im NAS ein neues Passwort setzen.',
  410: 'Das Passwort muss geändert werden. Bitte zuerst im Browser beim NAS anmelden.',
};

const FILE_MSG: Record<number, string> = {
  105: 'Keine Berechtigung. Das NAS-Konto braucht Lese- und Schreibrechte für den Ordner «Familien-Dokumente».',
  408: 'Der Ordner «Familien-Dokumente» wurde auf dem NAS nicht gefunden.',
  414: 'Eine Datei mit diesem Namen gibt es schon.',
  415: 'Der NAS meldet: zu wenig Platz oder Kontingent überschritten.',
  416: 'Der NAS meldet: kein Platz mehr.',
};

const SESSION_CODES = [106, 107, 119];

async function call(url: string, params: Record<string, string>, post = false, body?: BodyInit): Promise<any> {
  let res: Response;
  try {
    if (body) res = await fetch(url, { method: 'POST', body });
    else if (post) res = await fetch(url, { method: 'POST', body: new URLSearchParams(params) });
    else res = await fetch(url + '?' + new URLSearchParams(params).toString());
  } catch {
    throw new NasError(
      navigator.onLine
        ? 'Der NAS ist nicht erreichbar. Adresse prüfen (mit https:// und Port) und ob das Hilfsprogramm auf dem NAS läuft (ANLEITUNG U).'
        : 'Keine Internetverbindung.',
    );
  }
  if (res.status === 413) throw new NasError('Die Datei ist zu gross (höchstens 50 MB).');
  if (!res.ok) throw new NasError(`Der NAS antwortet mit Fehler ${res.status}. Ist die Adresse richtig?`);
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new NasError('Unter dieser Adresse antwortet kein NAS. Ist die Adresse richtig?');
  }
  return data;
}

function api(login: NasLogin) {
  return login.url + '/webapi/entry.cgi';
}

function check(data: any): any {
  if (data?.success) return data.data;
  const code: number | undefined = data?.error?.code ?? data?.error?.errors?.[0]?.code;
  if (code && SESSION_CODES.includes(code)) throw new NasError('Die Anmeldung beim NAS ist abgelaufen. Bitte neu anmelden.', code, true);
  throw new NasError((code && FILE_MSG[code]) || `Der NAS meldet einen Fehler${code ? ` (Nr. ${code})` : ''}.`, code);
}

/** Anmelden. Wirft NasError mit `otp = true`, wenn ein 2-Schritt-Code nötig ist. */
export async function nasLogin(urlInput: string, user: string, password: string, otp?: string): Promise<NasLogin> {
  const url = normalizeUrl(urlInput);
  if (!/^https?:\/\/[^/\s]+$/i.test(url)) throw new NasError('Bitte die Adresse so eingeben: https://name.synology.me:8443');
  let did: string | undefined;
  try {
    did = localStorage.getItem(DID_KEY) || undefined;
  } catch {
    /* egal */
  }
  const params: Record<string, string> = {
    api: 'SYNO.API.Auth',
    version: '6',
    method: 'login',
    account: user,
    passwd: password,
    session: 'FileStation',
    format: 'sid',
  };
  if (otp) {
    params.otp_code = otp.trim();
    params.enable_device_token = 'yes';
    params.device_name = 'Family-Planner';
  } else if (did) params.device_id = did;
  const data = await call(url + '/webapi/entry.cgi', params, true);
  if (!data?.success) {
    const code: number | undefined = data?.error?.code;
    throw new NasError((code && AUTH_MSG[code]) || `Anmeldung fehlgeschlagen${code ? ` (Nr. ${code})` : ''}.`, code, false, code === 403 || code === 404);
  }
  const login: NasLogin = { url, user, sid: data.data.sid, did: data.data.did || did };
  try {
    if (data.data.did) localStorage.setItem(DID_KEY, data.data.did);
    localStorage.setItem(KEY + '-last', JSON.stringify({ url, user }));
  } catch {
    /* egal */
  }
  saveNas(login);
  return login;
}

export async function nasLogout(login: NasLogin) {
  saveNas(null);
  try {
    await call(api(login), { api: 'SYNO.API.Auth', version: '6', method: 'logout', session: 'FileStation', _sid: login.sid }, true);
  } catch {
    /* egal: lokal ist abgemeldet */
  }
}

/** Sitzung lokal vergessen (z.B. nach «abgelaufen»). */
export function forgetNas() {
  saveNas(null);
}

export async function nasList(login: NasLogin, folder: string): Promise<NasFile[]> {
  const data = check(
    await call(api(login), {
      api: 'SYNO.FileStation.List',
      version: '2',
      method: 'list',
      folder_path: folder,
      additional: '["size","time"]',
      sort_by: 'mtime',
      sort_direction: 'desc',
      _sid: login.sid,
    }),
  );
  return (data.files ?? []).map((f: any) => ({
    name: f.name,
    path: f.path,
    isdir: !!f.isdir,
    size: f.additional?.size ?? 0,
    mtime: f.additional?.time?.mtime ?? 0,
  }));
}

/** Datei hochladen. Der Ordner wird angelegt, falls er fehlt. */
export async function nasUpload(login: NasLogin, folder: string, file: Blob, name: string): Promise<void> {
  const fd = new FormData();
  // Reihenfolge wichtig: die Angaben vor der Datei
  fd.append('api', 'SYNO.FileStation.Upload');
  fd.append('version', '2');
  fd.append('method', 'upload');
  fd.append('path', folder);
  fd.append('create_parents', 'true');
  fd.append('overwrite', 'false');
  fd.append('file', file, name);
  check(await call(api(login) + '?' + new URLSearchParams({ api: 'SYNO.FileStation.Upload', version: '2', method: 'upload', _sid: login.sid }), {}, true, fd));
}

export async function nasDelete(login: NasLogin, path: string): Promise<void> {
  check(await call(api(login), { api: 'SYNO.FileStation.Delete', version: '2', method: 'delete', path: JSON.stringify([path]), _sid: login.sid }, true));
}

/** Adresse für ein Vorschaubild (für <img>, braucht keine Freigabe). */
export function nasThumbUrl(login: NasLogin, path: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  return api(login) + '?' + new URLSearchParams({ api: 'SYNO.FileStation.Thumb', version: '2', method: 'get', path, size, _sid: login.sid });
}

/** Adresse zum Öffnen der Originaldatei (Foto oder PDF) im Browser. */
export function nasOpenUrl(login: NasLogin, path: string): string {
  return api(login) + '?' + new URLSearchParams({ api: 'SYNO.FileStation.Download', version: '2', method: 'download', path, mode: 'open', _sid: login.sid });
}

/** Eindeutiger Dateiname mit Datum, z.B. 2026-10-30_143012_quittung.jpg */
export function uploadName(original: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const clean = original
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(-60);
  return `${stamp}_${clean || 'datei'}`;
}

export const isImage = (name: string) => /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(name);
