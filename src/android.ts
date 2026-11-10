// Verbindung zur Android-App (APK, E46/E47). In der APK stellt die Hülle «FPAndroid» bereit,
// im Browser gibt es das nicht – dann bleibt alles wie bisher.
interface FPAndroidApi {
  saveFile(name: string, mime: string, base64: string): void;
  shareFile(name: string, mime: string, base64: string): void;
  versionCode?(): number; // ab APK 1.2
  versionName?(): string;
  takeShared?(): string; // ab APK 1.4: von einer anderen App geteilte Datei (JSON), sonst ''
  setWidget?(name: string, json: string): void; // ab APK 1.5: Daten für ein Widget
}
const api = (): FPAndroidApi | undefined => (window as unknown as { FPAndroid?: FPAndroidApi }).FPAndroid;

/** Läuft die App in der Android-App (APK)? */
export const inApk = () => !!api();

const toBase64 = (blob: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });

/** Datei im Ordner «Download» des Handys speichern (APK). */
export async function apkSave(blob: Blob, name: string) {
  api()?.saveFile(name, blob.type || 'application/octet-stream', await toBase64(blob));
}

/** Android-Teilen-Fenster mit der Datei öffnen (APK). */
export async function apkShare(blob: Blob, name: string) {
  api()?.shareFile(name, blob.type || 'application/octet-stream', await toBase64(blob));
}

/** Daten für ein Widget auf dem Startbildschirm an die Hülle geben (ab APK 1.5). */
export function apkSetWidget(name: string, json: string) {
  api()?.setWidget?.(name, json);
}

/** Von einer anderen App an die APK geteilte Datei abholen (nur einmal vorhanden). */
export function apkTakeShared(): File | null {
  try {
    const raw = api()?.takeShared?.();
    if (!raw) return null;
    const o = JSON.parse(raw) as { name?: string; mime?: string; data?: string };
    const bin = atob(o.data ?? '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], o.name || 'Dokument', { type: o.mime || '' });
  } catch {
    return null;
  }
}

/**
 * Zurück-Taste von Android: die Hülle ruft window.fpBack() auf.
 * Reihenfolge: offenes Fenster schliessen → Zurück-Knopf der Seite → zur Startseite.
 * Gibt false zurück, wenn nichts mehr zu tun ist (dann geht die App in den Hintergrund).
 */
export function installBack(fallback: () => boolean) {
  const visible = (el: Element) => el.getClientRects().length > 0;
  (window as unknown as { fpBack?: () => boolean }).fpBack = () => {
    // Gruss auf dem Startbildschirm: erst reagieren, Zurück macht nichts
    const gate = document.querySelector('.greet-gate');
    if (gate && visible(gate)) return true;
    const all = [...document.querySelectorAll('.sheet-backdrop, .scan, [data-back]')].filter(visible);
    const top = all[all.length - 1] as HTMLElement | undefined;
    if (top) {
      if (top.matches('[data-back]')) {
        top.click();
        return true;
      }
      // Fenster: eigener Zurück-/Abbrechen-Knopf, sonst wie neben das Fenster tippen
      const own = [...top.querySelectorAll<HTMLElement>('[data-back]')].filter(visible);
      if (own.length) own[own.length - 1].click();
      else if (top.matches('.sheet-backdrop')) top.click();
      return true;
    }
    return fallback();
  };
}

// ---- Neue APK-Version melden (E48) ----
export const APK_URL = 'https://github.com/leibi-tech/family-planner/releases/download/android/family-planner.apk';
const RELEASE_API = 'https://api.github.com/repos/leibi-tech/family-planner/releases/tags/android';
const APK_11_BUILD = 5; // APK 1.1 kennt ihre Nummer noch nicht selbst

export interface ApkVersion {
  code: number;
  name: string;
}

/** Installierte APK-Version (null im Browser). */
export function apkVersion(): ApkVersion | null {
  const a = api();
  if (!a) return null;
  if (typeof a.versionCode === 'function') return { code: Number(a.versionCode()), name: String(a.versionName?.() ?? '') };
  return { code: APK_11_BUILD, name: '1.1 (Build 5)' };
}

/** Neueste APK auf GitHub (aus dem Text der Seite «Android-App»: «Version 1.2 (Build 7)»). */
export async function latestApk(): Promise<ApkVersion | null> {
  try {
    const r = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { body?: string };
    const m = /Version (.+?\(Build (\d+)\))/.exec(j.body ?? '');
    return m ? { code: Number(m[2]), name: m[1] } : null;
  } catch {
    return null;
  }
}
