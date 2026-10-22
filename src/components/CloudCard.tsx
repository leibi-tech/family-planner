import { useEffect, useState } from 'react';
import {
  CloudError,
  createHousehold,
  getSession,
  joinHousehold,
  myHouseholds,
  onSessionChange,
  signIn,
  signOut,
  signUp,
  type Household,
  type Session,
} from '../cloud';
import {
  connectHousehold,
  disconnect,
  getSyncState,
  onSyncChange,
  resumeHousehold,
  storedHouseholdId,
  syncNow,
  type SyncState,
} from '../sync';

export function useSync(): SyncState {
  const [s, setS] = useState(getSyncState());
  useEffect(() => onSyncChange(() => setS(getSyncState())), []);
  return s;
}

function useSession(): Session | null | undefined {
  const [s, setS] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const load = () => getSession().then(setS);
    load();
    return onSessionChange(load);
  }, []);
  return s;
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

/** Karte «Gemeinsam nutzen» auf der Familien-Seite. */
export function CloudCard() {
  const session = useSession();
  const sync = useSync();
  const [open, setOpen] = useState(false);

  if (session === undefined) return null;

  let line: string;
  if (!session) line = 'Nicht verbunden – Daten nur auf diesem Handy.';
  else if (!sync.household) line = `Angemeldet als ${session.user.email}. Noch kein Haushalt.`;
  else
    line =
      sync.status === 'läuft'
        ? 'Gleiche ab …'
        : sync.status === 'offline'
          ? 'Offline – wird abgeglichen, sobald Internet da ist.'
          : sync.status === 'fehler'
            ? `Fehler: ${sync.error}`
            : sync.lastSync
              ? `Abgeglichen um ${fmtTime(sync.lastSync)}`
              : 'Verbunden';

  return (
    <>
      <button className={'cloud-card' + (sync.household ? ' on' : '')} onClick={() => setOpen(true)}>
        <span className="cloud-icon" aria-hidden>
          {sync.household ? '☁️' : '📱'}
        </span>
        <span className="cloud-text">
          <b>{sync.household ? `Gemeinsam: ${sync.household.name}` : 'Gemeinsam nutzen'}</b>
          <span className={sync.status === 'fehler' ? 'err' : 'muted'}>{line}</span>
        </span>
        <span className="chev" aria-hidden>
          ›
        </span>
      </button>
      {open && <CloudSheet session={session} sync={sync} onClose={() => setOpen(false)} />}
    </>
  );
}

function CloudSheet({ session, sync, onClose }: { session: Session | null; sync: SyncState; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {!session ? (
          <LoginForm />
        ) : !sync.household ? (
          <HouseholdSetup session={session} />
        ) : (
          <Connected session={session} sync={sync} />
        )}
        <button className="btn btn-block" style={{ marginTop: 10 }} onClick={onClose}>
          Schliessen
        </button>
      </div>
    </div>
  );
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof CloudError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const { busy, error, run } = useBusy();
  const valid = /\S+@\S+\.\S+/.test(email) && pw.length >= 6;

  return (
    <>
      <h2>Gemeinsam nutzen</h2>
      <p className="hint">
        Mit einem Konto werden eure Daten über die Cloud abgeglichen. Jede Person hat ein eigenes Konto; ihr verbindet
        euch dann über einen Haushalt.
      </p>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
          Anmelden
        </button>
        <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
          Neues Konto
        </button>
      </div>
      <label className="field">
        <span>E-Mail</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} />
      </label>
      <label className="field">
        <span>Passwort {mode === 'signup' && <span className="muted">(mind. 8 Zeichen empfohlen)</span>}</span>
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </label>
      {error && <p className="warn">{error}</p>}
      <button
        className="btn btn-primary btn-block"
        disabled={!valid || busy}
        onClick={() => run(() => (mode === 'login' ? signIn(email, pw) : signUp(email, pw)))}
      >
        {busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
      </button>
    </>
  );
}

function HouseholdSetup({ session }: { session: Session }) {
  const [list, setList] = useState<Household[] | null>(null);
  const [name, setName] = useState('Familie');
  const [code, setCode] = useState('');
  const [confirmJoin, setConfirmJoin] = useState(false);
  const { busy, error, run } = useBusy();

  useEffect(() => {
    run(async () => {
      const hs = await myHouseholds();
      const stored = await storedHouseholdId();
      const same = hs.find((h) => h.id === stored);
      if (same) return resumeHousehold(same); // dieses Handy war schon verbunden
      setList(hs);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!list) return <p className="muted center">{error ?? 'Lade …'}</p>;

  return (
    <>
      <h2>Haushalt</h2>
      <p className="muted small-hint">Angemeldet als {session.user.email}</p>

      {list.length > 0 && (
        <div className="field">
          <span>Dein Haushalt</span>
          {list.map((h) => (
            <button key={h.id} className="btn btn-block" disabled={busy} onClick={() => run(() => connectHousehold(h, 'replace'))}>
              «{h.name}» auf diesem Handy verwenden
            </button>
          ))}
          <small className="muted">Die Daten auf diesem Handy werden durch die des Haushalts ersetzt.</small>
        </div>
      )}

      {list.length === 0 && (
        <>
          <div className="box-section">
            <h3 className="sec">Neuen Haushalt erstellen</h3>
            <p className="hint small-hint">Für die erste Person. Deine bisherigen Daten auf diesem Handy werden hochgeladen.</p>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Familie Muster" />
            </label>
            <button
              className="btn btn-primary btn-block"
              disabled={busy || !name.trim()}
              onClick={() => run(async () => connectHousehold(await createHousehold(name.trim()), 'upload'))}
            >
              Haushalt erstellen
            </button>
          </div>

          <div className="box-section">
            <h3 className="sec">Oder: mit Einladungscode beitreten</h3>
            <label className="field">
              <span>Code (6 Zeichen)</span>
              <input
                className="code-input"
                value={code}
                maxLength={6}
                autoCapitalize="characters"
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setConfirmJoin(false);
                }}
              />
            </label>
            {confirmJoin && (
              <p className="warn">Die Daten, die bisher auf diesem Handy waren, werden durch die des Haushalts ersetzt.</p>
            )}
            <button
              className={'btn btn-block ' + (confirmJoin ? 'btn-danger' : 'btn-primary')}
              disabled={busy || code.length !== 6}
              onClick={() =>
                confirmJoin ? run(async () => connectHousehold(await joinHousehold(code), 'replace')) : setConfirmJoin(true)
              }
            >
              {confirmJoin ? 'Ja, beitreten' : 'Beitreten'}
            </button>
          </div>
        </>
      )}

      {error && <p className="warn">{error}</p>}
      <button className="btn btn-block btn-ghost-danger" onClick={() => signOut()}>
        Abmelden
      </button>
    </>
  );
}

function Connected({ session, sync }: { session: Session; sync: SyncState }) {
  const hh = sync.household!;
  const [copied, setCopied] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const share = async () => {
    const text = `Komm in unseren Family-Planner! App: https://leibi-tech.github.io/family-planner/ – Einladungscode: ${hh.invite_code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      /* abgebrochen */
    }
  };

  return (
    <>
      <h2>{hh.name}</h2>
      <p className="muted small-hint">Angemeldet als {session.user.email}</p>

      <div className="invite">
        <span className="muted">Einladungscode</span>
        <b className="invite-code">{hh.invite_code}</b>
        <button className="btn btn-block" onClick={share}>
          {copied ? 'Kopiert ✓' : 'Code teilen'}
        </button>
        <small className="muted">
          So kommt deine Partnerin dazu: App öffnen → Familie → «Gemeinsam nutzen» → eigenes Konto erstellen → Code eingeben.
        </small>
      </div>

      <div className="total">
        {sync.status === 'läuft'
          ? 'Gleiche ab …'
          : sync.status === 'offline'
            ? 'Offline – wird später abgeglichen.'
            : sync.status === 'fehler'
              ? `Fehler: ${sync.error}`
              : sync.lastSync
                ? `Zuletzt abgeglichen um ${fmtTime(sync.lastSync)}`
                : 'Verbunden'}
      </div>
      <button className="btn btn-primary btn-block" disabled={sync.status === 'läuft'} onClick={() => syncNow()}>
        Jetzt abgleichen
      </button>

      <button
        className={'btn btn-block ' + (confirmOut ? 'btn-danger' : 'btn-ghost-danger')}
        style={{ marginTop: 10 }}
        onClick={async () => {
          if (!confirmOut) return setConfirmOut(true);
          await disconnect();
          await signOut();
        }}
      >
        {confirmOut ? 'Wirklich abmelden? (Daten bleiben auf dem Handy)' : 'Abmelden'}
      </button>
    </>
  );
}
