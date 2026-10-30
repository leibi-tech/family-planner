import { useEffect, useRef, useState } from 'react';
import {
  forgetNas,
  isImage,
  lastNasInput,
  loadNas,
  NAS_TEST_FOLDER,
  NasError,
  nasDelete,
  nasList,
  nasLogin,
  nasLogout,
  nasOpenUrl,
  nasThumbUrl,
  nasUpload,
  uploadName,
  type NasFile,
  type NasLogin,
} from '../nas';

/**
 * Dokumente – Machbarkeitstest NAS (v0.18): beim Synology NAS anmelden, Foto/PDF hochladen,
 * wieder anzeigen und löschen. Die Dateien liegen nur auf dem NAS.
 */
export function DocsPage() {
  const [login, setLogin] = useState<NasLogin | null>(() => loadNas());
  const [expired, setExpired] = useState(false);

  if (!login)
    return (
      <LoginForm
        expired={expired}
        onDone={(l) => {
          setExpired(false);
          setLogin(l);
        }}
      />
    );
  return (
    <FileArea
      login={login}
      onExpired={() => {
        forgetNas();
        setExpired(true);
        setLogin(null);
      }}
      onLogout={async () => {
        await nasLogout(login);
        setLogin(null);
      }}
    />
  );
}

function LoginForm({ expired, onDone }: { expired: boolean; onDone: (l: NasLogin) => void }) {
  const last = lastNasInput();
  const [url, setUrl] = useState(last.url);
  const [user, setUser] = useState(last.user);
  const [pw, setPw] = useState('');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(expired ? 'Die Anmeldung beim NAS ist abgelaufen. Bitte neu anmelden.' : null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await nasLogin(url, user.trim(), pw, needOtp ? otp : undefined));
    } catch (e) {
      const err = e as NasError;
      if (err.otp) setNeedOtp(true);
      setError(err.message || 'Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="docs">
      <h2>Dokumente auf dem NAS</h2>
      <p className="hint">
        Test: Fotos und PDFs werden direkt auf eurem Synology NAS gespeichert, im Ordner «Familien-Dokumente». Melde dich mit
        dem NAS-Konto für die App an. Der Zugang bleibt nur auf diesem Handy.
      </p>
      <label className="field">
        <span>Adresse des NAS</span>
        <input
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://name.synology.me:8443"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Benutzername (NAS)</span>
        <input autoCapitalize="none" autoCorrect="off" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} />
      </label>
      <label className="field">
        <span>Passwort (NAS)</span>
        <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {needOtp && (
        <label className="field">
          <span>Code aus der Authenticator-App</span>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
        </label>
      )}
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy || !url.trim() || !user.trim() || !pw || (needOtp && otp.length < 6)} onClick={submit}>
        {busy ? 'Bitte warten …' : 'Beim NAS anmelden'}
      </button>
    </section>
  );
}

function FileArea({ login, onExpired, onLogout }: { login: NasLogin; onExpired: () => void; onLogout: () => void }) {
  const [files, setFiles] = useState<NasFile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const handle = (e: unknown) => {
    const err = e as NasError;
    if (err.relogin) onExpired();
    else if (err.code === 408) {
      // Ordner «Test» gibt es noch nicht: leer anzeigen, er entsteht beim ersten Hochladen
      setFiles([]);
    } else setError(err.message || 'Unbekannter Fehler.');
  };

  const reload = async () => {
    setError(null);
    try {
      setFiles((await nasList(login, NAS_TEST_FOLDER)).filter((f) => !f.isdir));
    } catch (e) {
      handle(e);
    }
  };

  useEffect(() => {
    void reload();
  }, [login.sid]);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    setOkMsg(null);
    let n = 0;
    try {
      for (const f of Array.from(list)) {
        setBusy(`Lade hoch: ${f.name} …`);
        await nasUpload(login, NAS_TEST_FOLDER, f, uploadName(f.name));
        n++;
      }
      setOkMsg(n === 1 ? 'Datei gespeichert ✓' : `${n} Dateien gespeichert ✓`);
      await reload();
    } catch (e) {
      handle(e);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async (f: NasFile) => {
    if (!confirm(`«${f.name}» auf dem NAS löschen?`)) return;
    setBusy('Lösche …');
    setOkMsg(null);
    try {
      await nasDelete(login, f.path);
      await reload();
    } catch (e) {
      handle(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="docs">
      <p className="hint">
        Angemeldet als <b>{login.user}</b> auf {login.url.replace(/^https?:\/\//, '')}. Test-Ordner: {NAS_TEST_FOLDER}
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        data-testid="nas-file"
        onChange={(e) => void upload(e.target.files)}
      />
      <button className="btn btn-primary btn-block" disabled={!!busy} onClick={() => input.current?.click()}>
        📷 Foto oder PDF hinzufügen
      </button>
      {busy && <p className="hint" style={{ marginTop: 10 }}>{busy}</p>}
      {okMsg && (
        <p className="ok-note" role="status">
          {okMsg}
        </p>
      )}
      {error && (
        <p className="warn" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      <h3 className="sec">Auf dem NAS</h3>
      {files === null ? (
        <p className="hint">Lade …</p>
      ) : files.length === 0 ? (
        <p className="hint">Noch keine Dateien. Füge oben ein Foto oder PDF hinzu.</p>
      ) : (
        <ul className="docs-grid">
          {files.map((f) => (
            <li key={f.path} className="docs-item">
              <a href={nasOpenUrl(login, f.path)} target="_blank" rel="noopener noreferrer" className="docs-thumb" aria-label={`${f.name} öffnen`}>
                {isImage(f.name) ? <Thumb src={nasThumbUrl(login, f.path)} /> : <span className="docs-icon">📄</span>}
              </a>
              <span className="docs-name">{f.name.replace(/^\d{4}-\d\d-\d\d_\d{6}_/, '')}</span>
              <span className="docs-meta muted">
                {f.mtime ? new Date(f.mtime * 1000).toLocaleDateString('de-CH') : ''} · {formatSize(f.size)}
              </span>
              <button className="btn btn-ghost-danger docs-del" disabled={!!busy} onClick={() => remove(f)} aria-label={`${f.name} löschen`}>
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => void reload()} disabled={!!busy}>
        Neu laden
      </button>
      <button className="btn btn-block btn-ghost-danger" style={{ marginTop: 10 }} onClick={onLogout}>
        Vom NAS abmelden
      </button>
    </section>
  );
}

/** Vorschaubild; liefert der NAS keines (z.B. HEIC), erscheint ein Symbol. */
function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(false);
  return bad ? <span className="docs-icon">🖼️</span> : <img src={src} alt="" loading="lazy" onError={() => setBad(true)} />;
}

function formatSize(b: number): string {
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1).replace('.0', '') + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
}
