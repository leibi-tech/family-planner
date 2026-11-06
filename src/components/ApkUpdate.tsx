// Startseite: Hinweis, wenn auf GitHub eine neuere Android-App (APK) bereitliegt (E48).
import { useEffect, useState } from 'react';
import { APK_URL, apkVersion, latestApk, type ApkVersion } from '../android';

const KEY = 'fp-apk-latest'; // zuletzt gefundene Version, höchstens alle 3 Stunden neu fragen
const LATER = 'fp-apk-later'; // «Später»: bis zum nächsten Start der App ausblenden

const read = (k: string, store: Storage) => {
  try {
    return JSON.parse(store.getItem(k) ?? 'null');
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown, store: Storage) => {
  try {
    store.setItem(k, JSON.stringify(v));
  } catch {
    /* egal */
  }
};

export function ApkUpdateCard() {
  const [installed] = useState(apkVersion);
  const [latest, setLatest] = useState<ApkVersion | null>(null);
  const [later, setLater] = useState<number | null>(() => read(LATER, sessionStorage));

  useEffect(() => {
    if (!installed) return;
    const saved = read(KEY, localStorage) as { t: number; v: ApkVersion } | null;
    if (saved && Date.now() - saved.t < 3 * 3600000) return setLatest(saved.v);
    if (!navigator.onLine) return;
    void latestApk().then((v) => {
      if (!v) return;
      write(KEY, { t: Date.now(), v }, localStorage);
      setLatest(v);
    });
  }, [installed]);

  if (!installed || !latest || latest.code <= installed.code || later === latest.code) return null;
  return (
    <div className="dash-card apk-card" data-testid="apk-update">
      <div className="dash-head">
        <h3>📲 Neue Android-App bereit</h3>
      </div>
      <p>
        Version {latest.name}. Installiert ist {installed.name || installed.code}. Antippen lädt sie herunter, danach <b>Öffnen</b> → <b>Aktualisieren</b>. Deine Daten bleiben.
      </p>
      <div className="apk-actions">
        <a className="btn btn-primary" href={APK_URL}>
          Herunterladen
        </a>
        <button
          className="btn btn-ghost"
          onClick={() => {
            write(LATER, latest.code, sessionStorage);
            setLater(latest.code);
          }}
        >
          Später
        </button>
      </div>
    </div>
  );
}
