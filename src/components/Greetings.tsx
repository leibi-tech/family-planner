// Liebesgruss (v0.20): Vollbild beim Empfänger, Karte auf der Startseite, Senden, Album «Unsere Grüsse».
import { useEffect, useRef, useState } from 'react';
import { type Person } from '../db';
import { useRecords } from '../hooks';
import { useAccountPersons } from '../care';
import { useSync } from './CloudCard';
import { useMe } from '../pages/TodoPage';
import {
  fmtWhen,
  markSeen,
  openFor,
  react,
  REACTION_NAMES,
  REACTIONS,
  removeGreeting,
  sendGreeting,
  shrinkPhoto,
  thinAlbum,
  waitingForMe,
  type Greeting,
} from '../greetings';
import { onChange } from '../db';

const nameIn = (persons: Person[] | undefined, id: string | null) => persons?.find((p) => p.id === id)?.name ?? 'Jemand';

/** Album klein halten: beim Start und nach jeder Änderung prüfen. Einmal in App einbauen. */
export function useThinAlbum() {
  useEffect(() => {
    void thinAlbum();
    return onChange('greetings', () => void thinAlbum());
  }, []);
}

/** Vollbild über der ganzen App, bis auf den Gruss reagiert ist. */
export function GreetingGate() {
  const greetings = useRecords<Greeting>('greetings');
  const persons = useRecords<Person>('persons');
  const me = useMe(persons);
  const [busy, setBusy] = useState(false);
  const g = waitingForMe(greetings ?? [], me)[0];
  if (!g || !persons) return null;
  return (
    <div className="greet-gate" role="dialog" aria-modal="true" aria-label="Gruss">
      <div className="greet-gate-inner">
        <p className="greet-from">💌 Gruss von {nameIn(persons, g.from)}</p>
        {g.photo && <img className="greet-photo" src={g.photo} alt="Foto im Gruss" />}
        {g.text && <p className="greet-text">{g.text}</p>}
        <p className="greet-ask muted">Wie gefällt dir das?</p>
        <div className="greet-reactions">
          {REACTIONS.map((r) => (
            <button
              key={r}
              className="greet-react"
              aria-label={REACTION_NAMES[r]}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await react(g, r);
                setBusy(false);
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Karte auf der Startseite: Gruss senden, «wartet auf Reaktion», Reaktionen. */
export function GreetingCard({ onAlbum }: { onAlbum: () => void }) {
  const greetings = useRecords<Greeting>('greetings');
  const persons = useRecords<Person>('persons');
  const me = useMe(persons);
  const sync = useSync();
  const accounts = useAccountPersons(sync.household?.id ?? null);
  const [sendTo, setSendTo] = useState<string | null>(null);
  if (!sync.household || !me || !persons || !greetings) return null;
  const others = persons.filter((p) => p.id !== me && accounts.includes(p.id)).sort((a, b) => a.sort - b.sort);
  if (!others.length) return null;
  const reactions = greetings.filter((g) => g.from === me && g.reaction && !g.seen).sort((a, b) => (b.reactedAt ?? 0) - (a.reactedAt ?? 0));

  return (
    <div className="dash-card greet-card">
      <div className="dash-head">
        <h3>💌 Liebesgruss</h3>
        <button className="dash-link" onClick={onAlbum}>
          Album ›
        </button>
      </div>
      {reactions.length > 0 && (
        <ul className="greet-replies">
          {reactions.map((g) => (
            <li key={g.id} className="greet-reply">
              <span className="greet-reply-emoji" aria-hidden>
                {g.reaction}
              </span>
              {g.photo ? <img className="greet-thumb" src={g.photo} alt="" /> : null}
              <span className="greet-reply-main">
                <strong>
                  {nameIn(persons, g.to)} hat mit {g.reaction} reagiert
                </strong>
                {g.text && <span className="muted greet-reply-text">«{g.text}»</span>}
              </span>
              <button className="icon-btn small" aria-label="Reaktion ausblenden" onClick={() => void markSeen(g)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="greet-send-list">
        {others.map((p) => {
          const open = openFor(greetings, p.id);
          return (
            <li key={p.id}>
              {open ? (
                <div className="greet-waiting">
                  <span>
                    Gruss an {p.name} <span className="muted">· wartet auf Reaktion</span>
                  </span>
                  {open.from === me && (
                    <button className="dash-link" onClick={() => confirm('Gruss zurücknehmen?') && void removeGreeting(open)}>
                      Zurücknehmen
                    </button>
                  )}
                </div>
              ) : (
                <button className="btn btn-block greet-send-btn" onClick={() => setSendTo(p.id)}>
                  Gruss an {p.name} senden
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {sendTo && <SendSheet from={me} to={sendTo} toName={nameIn(persons, sendTo)} onClose={() => setSendTo(null)} />}
    </div>
  );
}

function SendSheet({ from, to, toName, onClose }: { from: string; to: string; toName: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      setPhoto(await shrinkPhoto(f));
    } catch {
      setError('Das Foto lässt sich nicht öffnen. Bitte ein anderes wählen.');
    }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    await sendGreeting(from, to, text, photo);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Gruss an {toName}</h2>
        <p className="hint">{toName} sieht den Gruss beim nächsten Öffnen der App und reagiert mit einem Emoji.</p>
        <label className="field">
          <span>Text</span>
          <textarea className="greet-input" rows={3} value={text} maxLength={500} placeholder="z.B. Schönen Tag dir!" onChange={(e) => setText(e.target.value)} />
        </label>
        <input ref={fileRef} type="file" accept="image/*" hidden aria-label="Foto wählen" onChange={(e) => void pick(e.target.files?.[0])} />
        {photo ? (
          <div className="greet-preview">
            <img src={photo} alt="Vorschau" />
            <button className="btn btn-ghost" onClick={() => setPhoto(null)}>
              Foto entfernen
            </button>
          </div>
        ) : (
          <button className="btn btn-block" disabled={busy} onClick={() => fileRef.current?.click()}>
            📷 Foto aufnehmen oder wählen
          </button>
        )}
        {error && <p className="warn">{error}</p>}
        <div className="sheet-actions">
          <button className="btn btn-primary" disabled={busy || (!text.trim() && !photo)} onClick={() => void send()}>
            Senden 💌
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

/** Album «Unsere Grüsse»: neuste zuerst, antippen = gross ansehen. */
export function GreetingsPage() {
  const greetings = useRecords<Greeting>('greetings');
  const persons = useRecords<Person>('persons');
  const [view, setView] = useState<Greeting | null>(null);
  if (!greetings || !persons) return <p className="muted center">Lade …</p>;
  const list = [...greetings].sort((a, b) => b.sentAt - a.sentAt);
  return (
    <>
      <p className="hint">Die letzten 100 Grüsse bleiben hier. Kommen mehr dazu, verschwindet bei den älteren jeder zweite, so bleiben auch ein paar alte erhalten.</p>
      {list.length === 0 ? (
        <p className="muted center">Noch keine Grüsse. Auf der Startseite kannst du einen senden.</p>
      ) : (
        <ul className="greet-album">
          {list.map((g) => (
            <li key={g.id}>
              <button className="greet-tile" onClick={() => setView(g)}>
                {g.photo ? <img src={g.photo} alt="" loading="lazy" /> : <span className="greet-tile-text">{g.text}</span>}
                <span className="greet-tile-meta">
                  <span>
                    {nameIn(persons, g.from)} → {nameIn(persons, g.to)}
                  </span>
                  <span className="greet-tile-r">{g.reaction ?? '…'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {view && (
        <div className="sheet-backdrop" onClick={() => setView(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>
              {nameIn(persons, view.from)} → {nameIn(persons, view.to)}
            </h2>
            {view.photo && <img className="greet-photo" src={view.photo} alt="Foto im Gruss" />}
            {view.text && <p className="greet-text">{view.text}</p>}
            <p className="muted">
              Gesendet {fmtWhen(view.sentAt)}
              {view.reaction ? ` · ${view.reaction} ${fmtWhen(view.reactedAt ?? view.sentAt)}` : ' · wartet auf Reaktion'}
            </p>
            <div className="sheet-actions">
              <button className="btn" onClick={() => setView(null)}>
                Schliessen
              </button>
              <button
                className="btn btn-ghost-danger"
                onClick={() => {
                  if (!confirm('Gruss aus dem Album löschen?')) return;
                  void removeGreeting(view);
                  setView(null);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
