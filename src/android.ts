// Verbindung zur Android-App (APK, E46/E47). In der APK stellt die Hülle «FPAndroid» bereit,
// im Browser gibt es das nicht – dann bleibt alles wie bisher.
interface FPAndroidApi {
  saveFile(name: string, mime: string, base64: string): void;
  shareFile(name: string, mime: string, base64: string): void;
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
