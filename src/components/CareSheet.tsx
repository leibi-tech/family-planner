// Fenster «Wer schaut auf die Kinder?» (K4): Betreuung zu einer Überschneidung erfassen, ändern, entfernen.
import { useState } from 'react';
import { put, remove } from '../db';
import { timeLabel, type CalHelpers } from '../calendar';
import { careLabel, careState, snapOf, type CareInfo, type Conflict } from '../care';

const fmtWhen = (s: Date, e: Date) => {
  const day = s.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric' });
  const t = (d: Date) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  return s.toDateString() === e.toDateString() ? `${day}, ${t(s)}–${t(e)}` : `${day}, ${t(s)} bis ${e.toLocaleDateString('de-CH', { weekday: 'short' })} ${t(e)}`;
};
export const conflictWhen = (c: { start: Date; end: Date }) => fmtWhen(c.start, c.end);

export function CareSheet({
  conflict,
  orphan,
  care,
  h,
  parents,
  me,
  onClose,
}: {
  conflict?: Conflict;
  orphan?: CareInfo; // Betreuung, deren Termine verschoben/gelöscht wurden
  care?: CareInfo;
  h: CalHelpers;
  parents: string[];
  me: string | null;
  onClose: () => void;
}) {
  const existing = care && !care.deleted ? care : undefined;
  const [mode, setMode] = useState<'person' | 'mit'>(existing?.mode ?? 'person');
  const [who, setWho] = useState(existing?.mode === 'person' ? existing.who : '');
  const parentNames = parents.map((id) => h.nameOf(id));
  const [withParent, setWithParent] = useState(existing?.mode === 'mit' ? existing.who : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const state = conflict ? careState(conflict, care) : 'changed';

  const save = async () => {
    if (!conflict) return;
    setBusy(true);
    await put<CareInfo>('care', {
      id: conflict.key,
      events: conflict.events.map(snapOf),
      mode,
      who: mode === 'mit' ? withParent : who.trim(),
      note: note.trim(),
      editedBy: me,
      updatedAt: existing?.updatedAt ?? 0,
      deleted: false,
    });
    onClose();
  };
  const del = async () => {
    const c = existing ?? orphan;
    if (!c) return;
    setBusy(true);
    await remove<CareInfo>('care', c);
    onClose();
  };
  const valid = mode === 'mit' ? !!withParent : !!who.trim();

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Wer schaut auf die Kinder?</h2>

        {orphan && !conflict ? (
          <>
            <p className="warn">
              Ein Termin wurde verschoben oder gelöscht. Die erfasste Betreuung («{careLabel(orphan)}») passt nicht mehr dazu.
            </p>
            <ul className="care-events">
              {orphan.events.map((s) => (
                <li key={s.calendarId + s.eventId} className="muted">
                  {h.titleOf({ title: s.title } as any)} · {fmtWhen(new Date(s.start), new Date(s.end))}
                </li>
              ))}
            </ul>
            <div className="sheet-actions">
              <button className="btn btn-primary" disabled={busy} onClick={del}>
                Betreuung löschen
              </button>
              <button className="btn" onClick={onClose}>
                Schliessen
              </button>
            </div>
          </>
        ) : conflict ? (
          <>
            <p className="care-when">
              ⚠️ Beide weg: <b>{conflictWhen(conflict)}</b>
            </p>
            <ul className="care-events">
              {conflict.events.map((e) => (
                <li key={e.calendarId + e.id} className="care-event">
                  <span className="care-stripe" style={{ background: h.bgOf(e, 'bottom') }} />
                  <span>
                    <b>{h.titleOf(e)}</b>
                    <span className="muted">
                      {' '}
                      · {h.whoOf(e)} · {timeLabel(e, conflict.start)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {state === 'changed' && <p className="warn">Ein Termin wurde geändert. Bitte prüfen, ob die Betreuung noch passt, und speichern.</p>}

            <div className="seg cal-seg">
              <button className={mode === 'person' ? 'on' : ''} onClick={() => setMode('person')}>
                Jemand betreut
              </button>
              <button className={mode === 'mit' ? 'on' : ''} onClick={() => setMode('mit')}>
                Kinder gehen mit
              </button>
            </div>
            {mode === 'person' ? (
              <label className="field">
                <span>Wer betreut?</span>
                <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="z.B. Grosi" enterKeyHint="done" />
              </label>
            ) : (
              <div className="field">
                <span>Mit wem?</span>
                <div className="chips">
                  {parentNames.map((n) => (
                    <button key={n} className={'chip small' + (withParent === n ? ' on' : '')} onClick={() => setWithParent(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="field">
              <span>Notiz (optional)</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Grosi holt sie um 18 Uhr ab, Znacht bei ihr" />
            </label>
            <div className="sheet-actions">
              <button className="btn btn-primary" disabled={!valid || busy} onClick={save}>
                Speichern
              </button>
              {existing && (
                <button className="btn btn-ghost-danger" disabled={busy} onClick={del}>
                  Betreuung entfernen
                </button>
              )}
              <button className="btn" onClick={onClose}>
                Abbrechen
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
