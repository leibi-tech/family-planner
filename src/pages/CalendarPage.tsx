import { useEffect, useMemo, useRef, useState } from 'react';
import type { Person } from '../db';
import { useRecords } from '../hooks';
import { dateKey } from '../model';
import { useSync } from '../components/CloudCard';
import {
  disconnectGoogle,
  eventsFromCache,
  fetchMonths,
  fetchStatus,
  listGoogleCalendars,
  loadCache,
  loadStatus,
  monthKey,
  occursOn,
  personColor,
  saveSelection,
  sortEvents,
  STALE_MS,
  startConnect,
  takeReturnResult,
  timeLabel,
  whenLabel,
  type CalCache,
  type CalEvent,
  type CalInfo,
  type CalStatus,
  type GoogleCalendar,
} from '../calendar';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MAX_BARS = 3;

const fmtAgo = (t: number) => {
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return new Date(t).toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric' });
};

export function CalendarPage({ goto }: { goto: (tab: string) => void }) {
  const sync = useSync();
  const persons = useRecords<Person>('persons');
  const household = sync.household?.id ?? null;

  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selDay, setSelDay] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [status, setStatus] = useState<CalStatus | undefined>(undefined);
  const [cache, setCache] = useState<CalCache | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set()); // beim Öffnen immer alle sichtbar
  const [settings, setSettings] = useState(false);
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Gespeicherte Kopie sofort anzeigen
  useEffect(() => {
    loadStatus().then(setStatus);
    loadCache().then(setCache);
    const r = takeReturnResult();
    if (r === 'ok') {
      setFlash('Google verbunden ✓ Wähle jetzt, welche Kalender angezeigt werden.');
      setSettings(true);
    } else if (r === 'abgebrochen') setFlash('Verbindung mit Google abgebrochen.');
    else if (r === 'rechte') setError('Google hat den Zugriff auf den Kalender nicht erlaubt. Bitte nochmals verbinden und bei «Kalender» das Häkchen setzen.');
    else if (r) setError('Die Verbindung mit Google hat nicht geklappt. Bitte nochmals versuchen.');
  }, []);

  // Online: eigenen Status und Termine holen
  const busy = useRef(false);
  const refresh = async (y: number, m: number, count: number, force = false) => {
    if (!household || !navigator.onLine || busy.current) return;
    const cur = await loadCache();
    if (!force && cur && cur.household === household) {
      const keys = Array.from({ length: count }, (_, i) => monthKey(y, m + i));
      if (keys.every((k) => cur.months[k] && Date.now() - cur.months[k].at < STALE_MS)) return;
    }
    busy.current = true;
    setLoading(true);
    try {
      setCache(await fetchMonths(household, y, m, count));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!household || !online) return;
    fetchStatus().then(setStatus).catch((e) => setError(e?.message ?? String(e)));
    void refresh(today.getFullYear(), today.getMonth() - 1, 8, true);
    const vis = () => document.visibilityState === 'visible' && void refresh(ym.y, ym.m - 1, 3);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, online]);

  // Monat gewechselt → bei Bedarf nachladen
  useEffect(() => {
    void refresh(ym.y, ym.m - 1, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym.y, ym.m]);

  // Alle 5 Minuten auffrischen, solange die Seite offen ist
  useEffect(() => {
    const t = window.setInterval(() => void refresh(ym.y, ym.m - 1, 3), STALE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym.y, ym.m, household]);

  const sortedPersons = useMemo(() => [...(persons ?? [])].sort((a, b) => a.sort - b.sort), [persons]);
  const personIds = sortedPersons.map((p) => p.id);
  const calById = useMemo(() => new Map((cache?.calendars ?? []).map((c) => [c.id, c])), [cache]);

  const keyOf = (c: CalInfo | undefined) => (c?.kind === 'own' ? c.personId ?? 'unbekannt' : 'family');
  const colorOf = (e: CalEvent) => {
    const c = calById.get(e.calendarId);
    return c?.kind === 'own' ? personColor(personIds, c.personId) : personColor(personIds, null);
  };
  const whoOf = (e: CalEvent) => {
    const c = calById.get(e.calendarId);
    if (!c) return '';
    if (c.kind === 'family') return 'Familie';
    return sortedPersons.find((p) => p.id === c.personId)?.name ?? c.name;
  };

  if (!household) {
    return (
      <div className="soon">
        <div className="soon-icon">📆</div>
        <p>Der Kalender wird mit Google verbunden und braucht darum «Gemeinsam nutzen» (Konto und Haushalt).</p>
        <button className="btn btn-primary" onClick={() => goto('familie')}>
          Zu «Familie»
        </button>
      </div>
    );
  }

  // Filter: Personen mit eigenem Kalender + Familie
  const filterKeys: Array<{ key: string; label: string; color: string }> = [];
  for (const p of sortedPersons)
    if ((cache?.calendars ?? []).some((c) => c.kind === 'own' && c.personId === p.id))
      filterKeys.push({ key: p.id, label: p.name, color: personColor(personIds, p.id) });
  if ((cache?.calendars ?? []).some((c) => c.kind === 'family'))
    filterKeys.push({ key: 'family', label: 'Familie', color: personColor(personIds, null) });
  const toggle = (k: string) => {
    const n = new Set(hidden);
    n.has(k) ? n.delete(k) : n.add(k);
    setHidden(n);
  };

  const all = eventsFromCache(cache?.household === household ? cache : undefined, [
    monthKey(ym.y, ym.m - 1),
    monthKey(ym.y, ym.m),
    monthKey(ym.y, ym.m + 1),
  ]).filter((e) => !hidden.has(keyOf(calById.get(e.calendarId))));

  // Raster: Montag vor dem 1. bis Sonntag nach dem Monatsende
  const first = new Date(ym.y, ym.m, 1);
  const start = new Date(ym.y, ym.m, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(ym.y, ym.m + 1, 0);
  const cells: Date[] = [];
  for (let d = new Date(start); d <= last || cells.length % 7 !== 0; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
    cells.push(d);
  const byDay = new Map<string, CalEvent[]>();
  for (const d of cells) byDay.set(dateKey(d), sortEvents(all.filter((e) => occursOn(e, d))));

  const move = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    const t = new Date();
    setSelDay(d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() ? new Date(t.getFullYear(), t.getMonth(), t.getDate()) : d);
  };
  const goToday = () => {
    const t = new Date();
    setYm({ y: t.getFullYear(), m: t.getMonth() });
    setSelDay(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
  };

  const selEvents = byDay.get(dateKey(selDay)) ?? sortEvents(all.filter((e) => occursOn(e, selDay)));
  const todayKey = dateKey(new Date());
  const noCalendars = cache && cache.household === household && cache.calendars.length === 0;
  const notConnected = status && !status.connected;

  return (
    <section className="cal">
      {flash && (
        <p className="ok-note cal-flash" onClick={() => setFlash(null)}>
          {flash}
        </p>
      )}
      {(notConnected || noCalendars) && (
        <div className="import-banner cal-banner">
          {notConnected ? 'Verbinde deinen Google Kalender, damit deine Termine hier erscheinen.' : 'Noch keine Kalender ausgewählt.'}
          <button className="btn btn-primary btn-block" onClick={() => setSettings(true)}>
            {notConnected ? 'Mit Google verbinden' : 'Kalender auswählen'}
          </button>
        </div>
      )}

      <div className="weeknav">
        <button className="btn step" aria-label="Vorheriger Monat" onClick={() => move(-1)}>
          ‹
        </button>
        <div className="weeknav-title">
          <b>
            {MONTHS[ym.m]} {ym.y}
          </b>
          <button className="cal-today-btn" onClick={goToday}>
            Heute
          </button>
        </div>
        <button className="btn step" aria-label="Nächster Monat" onClick={() => move(1)}>
          ›
        </button>
      </div>

      {filterKeys.length > 1 && (
        <div className="cal-filter">
          {filterKeys.map((f) => (
            <button
              key={f.key}
              className={'cal-chip' + (hidden.has(f.key) ? ' off' : '')}
              style={{ ['--c' as any]: f.color }}
              onClick={() => toggle(f.key)}
              aria-pressed={!hidden.has(f.key)}
            >
              <span className="cal-dot" />
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="cal-grid" role="grid">
        {WD.map((w) => (
          <div key={w} className="cal-wd">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const k = dateKey(d);
          const evs = byDay.get(k) ?? [];
          const cls =
            'cal-cell' +
            (d.getMonth() !== ym.m ? ' other' : '') +
            (k === todayKey ? ' today' : '') +
            (k === dateKey(selDay) ? ' sel' : '');
          return (
            <button key={k} className={cls} onClick={() => setSelDay(d)} aria-label={`${d.getDate()}. ${MONTHS[d.getMonth()]}, ${evs.length} Termine`}>
              <span className="cal-num">{d.getDate()}</span>
              <span className="cal-bars">
                {evs.slice(0, MAX_BARS).map((e) => (
                  <span key={e.calendarId + e.id} className="cal-bar" style={{ background: colorOf(e) }}>
                    {e.title}
                  </span>
                ))}
                {evs.length > MAX_BARS && <span className="cal-more">+{evs.length - MAX_BARS}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="cal-dayhead">
        {selDay.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
        {dateKey(selDay) === todayKey && <span className="pill pill-today">Heute</span>}
      </h3>
      {selEvents.length === 0 ? (
        <p className="muted cal-empty">Keine Termine.</p>
      ) : (
        <ul className="cal-list">
          {selEvents.map((e) => (
            <li key={e.calendarId + e.id}>
              <button className="cal-ev" style={{ ['--c' as any]: colorOf(e) }} onClick={() => setDetail(e)}>
                <span className="cal-ev-time">{timeLabel(e, selDay)}</span>
                <span className="cal-ev-main">
                  <span className="cal-ev-title">{e.title}</span>
                  <span className="cal-ev-sub">
                    {whoOf(e)}
                    {e.location ? ` · ${e.location}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cal-foot">
        <span className="muted">
          {!online
            ? `Offline · Stand ${cache ? fmtAgo(cache.at) : '–'}`
            : loading
              ? 'Lade Termine …'
              : cache
                ? `Stand ${fmtAgo(cache.at)}`
                : ''}
        </span>
        <button className="small-btn btn" disabled={!online || loading} onClick={() => void refresh(ym.y, ym.m - 1, 3, true)}>
          ⟳ Aktualisieren
        </button>
        <button className="small-btn btn" onClick={() => setSettings(true)}>
          ⚙︎ Kalender
        </button>
      </div>
      {error && <p className="warn">{error}</p>}
      {(cache?.errors ?? []).map((e) => (
        <p key={e} className="warn">
          {e}
        </p>
      ))}

      {detail && <EventSheet ev={detail} who={whoOf(detail)} color={colorOf(detail)} cal={calById.get(detail.calendarId)} onClose={() => setDetail(null)} />}
      {settings && (
        <SettingsSheet
          household={household}
          hasPerson={!!sync.membership?.person_id}
          onClose={() => setSettings(false)}
          onChanged={async () => {
            setStatus(await loadStatus());
            await refresh(ym.y, ym.m - 1, 3, true);
          }}
        />
      )}
    </section>
  );
}

function EventSheet({ ev, who, color, cal, onClose }: { ev: CalEvent; who: string; color: string; cal?: CalInfo; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="cal-detail-title" style={{ ['--c' as any]: color }}>
          {ev.title}
        </h2>
        <p className="cal-detail-row">🕒 {whenLabel(ev)}</p>
        {ev.recurringEventId && <p className="cal-detail-row">🔁 Wiederkehrender Termin</p>}
        <p className="cal-detail-row">
          👤 {who}
          {cal ? <span className="muted"> · Kalender «{cal.name}»</span> : null}
        </p>
        {ev.location && <p className="cal-detail-row">📍 {ev.location}</p>}
        {ev.description && <p className="cal-detail-desc">{ev.description.replace(/<[^>]+>/g, ' ')}</p>}
        <p className="muted small-note">Termine ändern kommt im nächsten Schritt. Bis dahin direkt in Google Kalender.</p>
        <div className="sheet-actions">
          {ev.link && (
            <a className="btn btn-block cal-link" href={ev.link} target="_blank" rel="noopener">
              In Google Kalender öffnen
            </a>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}

type Kind = 'none' | 'own' | 'family';

function SettingsSheet({
  household,
  hasPerson,
  onClose,
  onChanged,
}: {
  household: string;
  hasPerson: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [status, setStatus] = useState<CalStatus | null>(null);
  const [list, setList] = useState<GoogleCalendar[] | null>(null);
  const [choice, setChoice] = useState<Record<string, Kind>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const s = await fetchStatus();
      setStatus(s);
      if (s.connected) {
        const r = await listGoogleCalendars();
        setList(r.calendars);
        const sel = r.selected ?? [];
        const c: Record<string, Kind> = {};
        for (const cal of r.calendars) {
          const found = sel.find((x) => x.id === cal.id);
          c[cal.id] = found ? found.kind : 'none';
        }
        // Erstes Mal: Hauptkalender als «Mein Kalender» vorschlagen
        if (sel.length === 0) {
          const p = r.calendars.find((x) => x.primary);
          if (p) c[p.id] = 'own';
        }
        setChoice(c);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await startConnect(household);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBusy(false);
    }
  };

  const save = async () => {
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      const sel = list.filter((c) => choice[c.id] && choice[c.id] !== 'none').map((c) => ({ id: c.id, name: c.name, kind: choice[c.id] as 'own' | 'family' }));
      await saveSelection(sel);
      setSaved(true);
      await onChanged();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectGoogle();
      setStatus({ connected: false });
      setList(null);
      setConfirmOff(false);
      await onChanged();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Google Kalender</h2>
        {!navigator.onLine && <p className="warn">Für die Einstellungen braucht es Internet.</p>}
        {status === null && !error && <p className="muted">Lade …</p>}

        {status && !status.connected && (
          <>
            <p className="hint">
              Verbinde dein eigenes Google-Konto. Die anderen in der Familie sehen danach die Kalender, die du auswählst. Jede Person verbindet ihr
              eigenes Konto.
            </p>
            <p className="import-banner">
              Google zeigt einmal den Hinweis <b>«Google hat diese App nicht überprüft»</b>. Tippe dort auf <b>«Erweitert»</b> und dann auf{' '}
              <b>«Weiter zu …»</b>. Danach den Zugriff auf den Kalender erlauben.
            </p>
            <button className="btn btn-primary btn-block" disabled={busy || !navigator.onLine} onClick={connect}>
              {busy ? 'Öffne Google …' : 'Mit Google verbinden'}
            </button>
          </>
        )}

        {status?.connected && (
          <>
            <p className="hint">
              Verbunden mit <b>{status.email}</b>. Wähle, welche deiner Kalender in der App erscheinen:
            </p>
            {!hasPerson && <p className="warn">Dein Konto ist noch keiner Person zugeordnet («Wer bist du?» unter Familie). Sonst fehlt bei «Mein Kalender» der Name.</p>}
            {list === null ? (
              <p className="muted">Lade Kalender …</p>
            ) : (
              <ul className="cal-pick">
                {list.map((c) => (
                  <li key={c.id}>
                    <div className="cal-pick-name">
                      <span className="cal-dot" style={{ ['--c' as any]: c.color ?? '#999' }} />
                      <span>
                        {c.name}
                        {c.access !== 'owner' && c.access !== 'writer' && <span className="muted"> (nur lesen)</span>}
                      </span>
                    </div>
                    <div className="seg seg3">
                      {(
                        [
                          ['none', 'Nicht zeigen'],
                          ['own', 'Mein Kalender'],
                          ['family', 'Familie'],
                        ] as Array<[Kind, string]>
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          className={choice[c.id] === k ? 'on' : ''}
                          onClick={() => {
                            setChoice({ ...choice, [c.id]: k });
                            setSaved(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="small-hint muted">
              «Mein Kalender» = deine Termine (erscheinen mit deinem Namen). «Familie» = gemeinsamer Familienkalender, den ihr in Google teilt.
            </p>
            {saved && <p className="ok-note">Gespeichert ✓</p>}
            <div className="sheet-actions">
              <button className="btn btn-primary" disabled={busy || !list} onClick={save}>
                Auswahl speichern
              </button>
              {!confirmOff ? (
                <button className="btn btn-ghost-danger" disabled={busy} onClick={() => setConfirmOff(true)}>
                  Verbindung trennen
                </button>
              ) : (
                <button className="btn btn-danger" disabled={busy} onClick={disconnect}>
                  Wirklich trennen? Deine Termine verschwinden aus der App.
                </button>
              )}
            </div>
          </>
        )}

        {error && <p className="warn">{error}</p>}
        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}
