// Einstellungen → Datensicherung (v0.31, E52): Sicherung erstellen (ZIP) und wieder einlesen.
import { useEffect, useRef, useState } from 'react';
import { apkSave, apkShare, inApk } from '../android';
import { createBackup, lastBackup, readBackup, restoreBackup, type BackupPreview, type BackupResult } from '../backup';
import type { StoreName } from '../db';
import { fmtSize } from '../docs';
import { Icon } from '../icons';
import { useSync } from '../components/CloudCard';

const LABELS: Record<StoreName, string> = {
  persons: 'Personen',
  menus: 'Menüs',
  days: 'Wochenplan-Tage',
  shopping: 'Einkaufsliste (Einstellungen, Abgehaktes)',
  manual: 'Einkauf von Hand',
  recurring: 'Wiederkehrende Artikel',
  suggest: 'Vorschläge Einkauf',
  todos: 'ToDos',
  chores: 'Ämtli',
  notes: 'Notizen und Listen',
  care: 'Betreuung',
  greetings: 'Grüsse',
  docs: 'Dokumente',
};

const fmt = (t: number) => new Date(t).toLocaleString('de-CH', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function BackupPage() {
  const apk = inApk();
  const sync = useSync();
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [made, setMade] = useState<BackupResult | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void lastBackup().then((t) => setLast(t ?? null));
  }, [made]);

  const create = async () => {
    setError(null);
    setDone(null);
    setPreview(null);
    setMade(null);
    setBusy('Sicherung wird erstellt …');
    try {
      setMade(await createBackup((m) => setBusy(m)));
    } catch (e) {
      setError('Die Sicherung konnte nicht erstellt werden. ' + ((e as Error)?.message ?? ''));
    }
    setBusy(null);
  };

  const file = () => new File([made!.blob], made!.name, { type: 'application/zip' });
  const canShare = !!made && (apk || (typeof navigator.share === 'function' && (navigator.canShare?.({ files: [file()] }) ?? false)));
  const share = () => (apk ? void apkShare(made!.blob, made!.name) : void navigator.share({ files: [file()], title: made!.name }).catch(() => {}));
  const download = () => {
    if (apk) return void apkSave(made!.blob, made!.name);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(made!.blob);
    a.download = made!.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };

  const pick = async (f: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!f) return;
    setError(null);
    setDone(null);
    setMade(null);
    setPreview(null);
    setBusy('Sicherung wird gelesen …');
    try {
      setPreview(await readBackup(f));
    } catch (e) {
      setError((e as Error)?.message || 'Die Datei lässt sich nicht lesen.');
    }
    setBusy(null);
  };

  const restore = async () => {
    if (!preview) return;
    setBusy('Daten werden zurückgeholt …');
    try {
      setDone(await restoreBackup(preview));
      setPreview(null);
    } catch (e) {
      setError('Das Zurückholen hat nicht geklappt. ' + ((e as Error)?.message ?? ''));
    }
    setBusy(null);
  };

  return (
    <div className="backup">
      <p className="hint">
        Speichert alle Einträge und Dokumente, die auf diesem Handy sind, in eine Datei. Lege sie z.B. in Google Drive ab. So hast du alles, falls etwas aus Versehen gelöscht wird oder die Datenbank umziehen muss. Termine sind bei Google und nicht in der Sicherung.
      </p>

      <div className="set-box">
        <div className="set-box-h">
          <Icon name="sicherung" />
          Sicherung erstellen
        </div>
        <p className="hint small-hint" data-testid="backup-last">
          {last ? `Letzte Sicherung auf diesem Handy: ${fmt(last)}` : 'Auf diesem Handy wurde noch keine Sicherung erstellt.'}
        </p>
        {!sync.household && <p className="hint small-hint">Dieses Handy ist mit keiner Familie verbunden. Gesichert wird, was auf diesem Handy ist.</p>}
        <button className="btn btn-primary btn-block" disabled={!!busy} onClick={() => void create()}>
          Sicherung erstellen
        </button>
        {made && (
          <div className="ok-note" data-testid="backup-made">
            Sicherung bereit: {made.records} Einträge, {made.docs} {made.docs === 1 ? 'Dokument' : 'Dokumente'} ({fmtSize(made.blob.size)}).
            {made.missing.length > 0 && (
              <>
                <br />
                Ohne Datei (nur auf einem anderen Handy, oder kein Internet): {made.missing.join(', ')}
              </>
            )}
            <div className="backup-actions">
              <button className="btn btn-primary" onClick={download}>
                {apk ? 'Im Handy speichern' : 'Herunterladen'}
              </button>
              {canShare && (
                <button className="btn" onClick={share}>
                  Teilen (z.B. Google Drive)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="set-box">
        <div className="set-box-h">
          <Icon name="sync" />
          Sicherung einlesen
        </div>
        <p className="hint small-hint">
          Holt zurück, was fehlt oder gelöscht wurde. Was heute in der App steht, bleibt, wie es ist. Mit einer Familie verbunden: Das Zurückgeholte kommt auch auf die anderen Handys.
        </p>
        <input ref={input} type="file" accept=".zip,application/zip" hidden data-testid="backup-file" onChange={(e) => void pick(e.target.files?.[0])} />
        <button className="btn btn-block" disabled={!!busy} onClick={() => input.current?.click()}>
          Sicherungsdatei wählen
        </button>
        {preview && (
          <div className="backup-preview" data-testid="backup-preview">
            <p>
              <b>Sicherung vom {fmt(preview.data.created)}</b>
              {preview.data.household ? ` · ${preview.data.household}` : ''}
            </p>
            <ul>
              {preview.counts.map((c) => (
                <li key={c.store}>
                  {LABELS[c.store]}: {c.total}
                  {c.restore > 0 ? <b> · {c.restore} fehlen</b> : ' · alle vorhanden'}
                </li>
              ))}
            </ul>
            {preview.restore > 0 ? (
              <div className="backup-actions">
                <button className="btn btn-primary" onClick={() => void restore()} disabled={!!busy}>
                  {preview.restore} {preview.restore === 1 ? 'Eintrag' : 'Einträge'} zurückholen
                </button>
                <button className="btn btn-ghost" data-back onClick={() => setPreview(null)}>
                  Abbrechen
                </button>
              </div>
            ) : (
              <p className="ok-note">Alles aus dieser Sicherung ist schon in der App. Es fehlt nichts.</p>
            )}
          </div>
        )}
        {done !== null && (
          <p className="ok-note" data-testid="backup-done">
            {done} {done === 1 ? 'Eintrag' : 'Einträge'} zurückgeholt ✓
          </p>
        )}
      </div>

      {busy && <p className="muted center">{busy}</p>}
      {error && <p className="warn">{error}</p>}
    </div>
  );
}
