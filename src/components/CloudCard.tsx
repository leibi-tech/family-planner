import { useEffect, useState } from 'react';
import type { Person } from '../db';
import { useRecords } from '../hooks';
import {
  CloudError,
  assignPerson,
  createHousehold,
  getInviteCode,
  getSession,
  householdMembers,
  joinHousehold,
  myHouseholds,
  newInviteCode,
  removeMember,
  setMemberRole,
  claimPerson,
  type Member,
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
  isAdmin,
  onSyncChange,
  refreshMembership,
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
  useEffect(() => {
    refreshMembership();
  }, []);
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
  const [joinName, setJoinName] = useState('');
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
            <label className="field">
              <span>Dein Vorname (so wie ihn der Admin erfasst hat)</span>
              <input value={joinName} onChange={(e) => setJoinName(e.target.value)} autoComplete="given-name" />
            </label>
            {confirmJoin && (
              <p className="warn">Die Daten, die bisher auf diesem Handy waren, werden durch die des Haushalts ersetzt.</p>
            )}
            <button
              className={'btn btn-block ' + (confirmJoin ? 'btn-danger' : 'btn-primary')}
              disabled={busy || code.length !== 6 || !joinName.trim()}
              onClick={() =>
                confirmJoin
                  ? run(async () => connectHousehold(await joinHousehold(code, joinName.trim()), 'replace'))
                  : setConfirmJoin(true)
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

const roleLabel = (r: string) => (r === 'owner' ? 'Ersteller · Admin' : r === 'admin' ? 'Admin' : 'Mitglied');

function Connected({ session, sync }: { session: Session; sync: SyncState }) {
  const hh = sync.household!;
  const admin = isAdmin(sync);
  const persons = useRecords<Person>('persons') ?? [];
  const me = persons.find((p) => p.id === sync.membership?.person_id);
  const [confirmOut, setConfirmOut] = useState(false);

  return (
    <>
      <h2>{hh.name}</h2>
      <p className="muted small-hint">
        Angemeldet als {session.user.email}
        <br />
        Du bist: <b>{me?.name ?? 'noch nicht zugeordnet'}</b>
        {sync.membership && <> · {roleLabel(sync.membership.role)}</>}
      </p>

      {admin && <InviteBox householdId={hh.id} />}
      {admin ? (
        <MembersAdmin key={sync.membership?.person_id ?? '-'} householdId={hh.id} myUserId={session.user.id} persons={persons} />
      ) : (
        <p className="hint small-hint">Personen, Faktoren und Einladungen verwaltet der Admin eurer Familie.</p>
      )}

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

function InviteBox({ householdId }: { householdId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useBusy();
  useEffect(() => {
    run(async () => setCode(await getInviteCode(householdId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const share = async () => {
    const text = `Komm in unseren Family-Planner! App: https://leibi-tech.github.io/family-planner/ – Einladungscode: ${code} (zusammen mit deinem Vornamen eingeben)`;
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
    <div className="invite">
      <span className="muted">Einladungscode</span>
      <b className="invite-code">{code ?? '······'}</b>
      <button className="btn btn-block" disabled={!code} onClick={share}>
        {copied ? 'Kopiert ✓' : 'Code teilen'}
      </button>
      <button
        className="btn btn-block btn-ghost-danger"
        disabled={busy}
        onClick={() => run(async () => setCode(await newInviteCode(householdId)))}
      >
        Neuen Code erzeugen
      </button>
      {error && <p className="warn">{error}</p>}
      <small className="muted">
        Beitreten geht nur mit Code <b>und</b> dem Vornamen einer Person, die unter «Familie» erfasst und noch keinem Konto
        zugeordnet ist.
      </small>
    </div>
  );
}

function MembersAdmin({ householdId, myUserId, persons }: { householdId: string; myUserId: string; persons: Person[] }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { busy, error, run } = useBusy();
  const load = () => run(async () => setMembers(await householdMembers(householdId)));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const nameOf = (pid: string | null) => persons.find((p) => p.id === pid)?.name ?? 'nicht zugeordnet';
  const act = (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      setMembers(await householdMembers(householdId));
      await refreshMembership();
    });

  return (
    <div className="field">
      <span>Mitglieder ({members?.length ?? '…'})</span>
      <ul className="list">
        {(members ?? []).map((m) => (
          <li key={m.user_id} className="member">
            <button className="member-head" onClick={() => setOpen(open === m.user_id ? null : m.user_id)}>
              <span className="member-text">
                <b>
                  {nameOf(m.person_id)}
                  {m.user_id === myUserId && ' (du)'}
                </b>
                <span className="muted">{m.email}</span>
              </span>
              <span className={'role-badge ' + m.role}>{roleLabel(m.role)}</span>
            </button>
            {open === m.user_id && (
              <div className="member-actions">
                <label className="field">
                  <span>Person</span>
                  <select
                    className="select"
                    value={m.person_id ?? ''}
                    disabled={busy}
                    onChange={(e) => e.target.value && act(() => assignPerson(householdId, m.user_id, e.target.value))}
                  >
                    <option value="">– wählen –</option>
                    {[...persons]
                      .sort((a, b) => a.sort - b.sort)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                {m.role !== 'owner' && (
                  <>
                    <button
                      className="btn btn-block"
                      disabled={busy}
                      onClick={() => act(() => setMemberRole(householdId, m.user_id, m.role === 'admin' ? 'member' : 'admin'))}
                    >
                      {m.role === 'admin' ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}
                    </button>
                    {m.user_id !== myUserId && (
                      <RemoveButton disabled={busy} onRemove={() => act(() => removeMember(householdId, m.user_id))} />
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="warn">{error}</p>}
    </div>
  );
}

function RemoveButton({ disabled, onRemove }: { disabled: boolean; onRemove: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <button
      className={'btn btn-block ' + (confirm ? 'btn-danger' : 'btn-ghost-danger')}
      disabled={disabled}
      onClick={() => (confirm ? onRemove() : setConfirm(true))}
    >
      {confirm ? 'Wirklich aus der Familie entfernen?' : 'Aus der Familie entfernen'}
    </button>
  );
}

/** Fragt nach, wer man ist, solange das eigene Konto keiner Person zugeordnet ist. */
export function WhoAmIPrompt() {
  const sync = useSync();
  const persons = useRecords<Person>('persons');
  const [taken, setTaken] = useState<string[] | null>(null);
  const [later, setLater] = useState(false);
  const { busy, error, run } = useBusy();
  const hh = sync.household;
  const need = !!hh && !!sync.membership && !sync.membership.person_id && !later;

  useEffect(() => {
    if (!need || !hh) return;
    run(async () => setTaken((await householdMembers(hh.id)).map((m) => m.person_id).filter((x): x is string => !!x)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need, hh?.id]);

  if (!need || !persons || !taken) return null;
  const free = [...persons].sort((a, b) => a.sort - b.sort).filter((p) => !taken.includes(p.id));

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>Wer bist du?</h2>
        <p className="hint">
          Damit die App weiss, wer du in der Familie «{hh!.name}» bist, wähle deinen Namen. Das geht nur einmal; ändern
          kann es danach nur der Admin.
        </p>
        <div className="list">
          {free.map((p) => (
            <button
              key={p.id}
              className="row"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await claimPerson(hh!.id, p.id);
                  await refreshMembership();
                })
              }
            >
              <span className="avatar" aria-hidden>
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="row-main">{p.name}</span>
            </button>
          ))}
        </div>
        {free.length === 0 && <p className="warn">Alle Personen sind schon zugeordnet. Bitte den Admin, dich zu erfassen.</p>}
        {error && <p className="warn">{error}</p>}
        <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => setLater(true)}>
          Später
        </button>
      </div>
    </div>
  );
}
