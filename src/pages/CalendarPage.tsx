import { useEffect, useMemo, useRef, useState } from 'react';
import type { Person } from '../db';
import { useRecords } from '../hooks';
import { dateKey } from '../model';
import { useSync } from '../components/CloudCard';
import {
  buildTitle,
  createEvent,
  deleteEvent,
  eventColors,
  eventPersons,
  isoWeek,
  stripes,
  eventToInput,
  isWritable,
  parseTitle,
  REPEAT_LABELS,
  seriesRepeat,
  updateEvent,
  type EventInput,
  type Repeat,
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
const HOUR_PX = 48; // Höhe einer Stunde in der Tagesansicht

type View = 'month' | 'week' | 'day';
const VIEW_KEY = 'calView';
const loadView = (): View => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'week' || v === 'day' ? v : 'month';
  } catch {
    return 'month';
  }
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

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
  const [editor, setEditor] = useState<{ ev: CalEvent | null; scope: 'one' | 'all'; day: Date } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [view, setView] = useState<View>(loadView);

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

  const personsOf = (e: CalEvent) => eventPersons(e, calById.get(e.calendarId), sortedPersons);
  const keysOf = (e: CalEvent) => {
    const ps = personsOf(e);
    return ps.length ? ps : ['family'];
  };
  const colorsOf = (e: CalEvent) => eventColors(personIds, personsOf(e));
  const bgOf = (e: CalEvent, dir: 'right' | 'bottom' = 'right') => stripes(colorsOf(e), dir);
  const titleOf = (e: CalEvent) => parseTitle(e.title, sortedPersons).title;
  const whoOf = (e: CalEvent) => {
    const ps = personsOf(e);
    if (!ps.length) return 'Familie';
    if (ps.length > 1 && personIds.every((id) => ps.includes(id))) return 'Familie (alle)';
    return ps.map((id) => sortedPersons.find((p) => p.id === id)?.name ?? '?').join(', ');
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

  const monthEvents = eventsFromCache(cache?.household === household ? cache : undefined, [
    monthKey(ym.y, ym.m - 1),
    monthKey(ym.y, ym.m),
    monthKey(ym.y, ym.m + 1),
  ]);
  // Filter: Personen, die Termine haben (eigener Kalender oder im Titel genannt), + Familie
  const present = new Set<string>();
  for (const c of cache?.calendars ?? []) if (c.kind === 'own' && c.personId) present.add(c.personId);
  for (const e of monthEvents) keysOf(e).forEach((k) => present.add(k));
  const filterKeys: Array<{ key: string; label: string; color: string }> = [];
  for (const p of sortedPersons) if (present.has(p.id)) filterKeys.push({ key: p.id, label: p.name, color: personColor(personIds, p.id) });
  if (present.has('family') || (cache?.calendars ?? []).some((c) => c.kind === 'family'))
    filterKeys.push({ key: 'family', label: 'Familie', color: personColor(personIds, null) });
  const toggle = (k: string) => {
    const n = new Set(hidden);
    n.has(k) ? n.delete(k) : n.add(k);
    setHidden(n);
  };
  // Sichtbar, solange mindestens eine betroffene Person eingeblendet ist
  const all = monthEvents.filter((e) => keysOf(e).some((k) => !hidden.has(k)));
  const writableCals = (cache?.calendars ?? []).filter(isWritable);

  // Raster: Montag vor dem 1. bis Sonntag nach dem Monatsende
  const first = new Date(ym.y, ym.m, 1);
  const start = new Date(ym.y, ym.m, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(ym.y, ym.m + 1, 0);
  const cells: Date[] = [];
  for (let d = new Date(start); d <= last || cells.length % 7 !== 0; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
    cells.push(d);
  const byDay = new Map<string, CalEvent[]>();
  for (const d of cells) byDay.set(dateKey(d), sortEvents(all.filter((e) => occursOn(e, d))));

  const showDay = (d: Date) => {
    setSelDay(d);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };
  const move = (delta: number) => {
    if (view === 'week') return showDay(addDays(selDay, 7 * delta));
    if (view === 'day') return showDay(addDays(selDay, delta));
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    const t = new Date();
    setSelDay(d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() ? new Date(t.getFullYear(), t.getMonth(), t.getDate()) : d);
  };
  const goToday = () => {
    const t = new Date();
    showDay(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
  };
  // Monat / Woche / Tag: immer auf heute springen, Ansicht merken
  const chooseView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* egal */
    }
    goToday();
  };
  const openDay = (d: Date) => {
    setView('day');
    try {
      localStorage.setItem(VIEW_KEY, 'day');
    } catch {
      /* egal */
    }
    showDay(d);
  };

  const selEvents = byDay.get(dateKey(selDay)) ?? sortEvents(all.filter((e) => occursOn(e, selDay)));
  const todayKey = dateKey(new Date());
  const noCalendars = cache && cache.household === household && cache.calendars.length === 0;
  const notConnected = status && !status.connected;
  const canAdd = writableCals.length > 0;
  const newEvent = (d: Date) => setEditor({ ev: null, scope: 'one', day: d });
  const eventsOn = (d: Date) => byDay.get(dateKey(d)) ?? sortEvents(all.filter((e) => occursOn(e, d)));
  const weekStart = mondayOf(selDay);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const navLabel = { month: ['Vorheriger Monat', 'Nächster Monat'], week: ['Vorherige Woche', 'Nächste Woche'], day: ['Vorheriger Tag', 'Nächster Tag'] }[view];
  const navTitle =
    view === 'month'
      ? `${MONTHS[ym.m]} ${ym.y}`
      : view === 'week'
        ? `KW ${isoWeek(weekStart)} · ${weekStart.getDate()}.${weekStart.getMonth() + 1}.–${weekDays[6].getDate()}.${weekDays[6].getMonth() + 1}.`
        : selDay.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  // Spalten der Tagesansicht: eine pro eingeblendeter Person (+ Familie)
  const columns = filterKeys.filter((f) => !hidden.has(f.key));
  const renderList = (evs: CalEvent[], d: Date) => (
    <ul className="cal-list">
      {evs.map((e) => (
        <li key={e.calendarId + e.id}>
          <button className="cal-ev" onClick={() => setDetail(e)}>
            <span className="cal-ev-stripe" style={{ background: bgOf(e, 'bottom') }} />
            <span className="cal-ev-time">{timeLabel(e, d)}</span>
            <span className="cal-ev-main">
              <span className="cal-ev-title">{titleOf(e)}</span>
              <span className="cal-ev-sub">
                {whoOf(e)}
                {e.location ? ` · ${e.location}` : ''}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

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

      <div className="seg seg3 cal-views" role="tablist">
        {(
          [
            ['month', 'Monat'],
            ['week', 'Woche'],
            ['day', 'Tag'],
          ] as Array<[View, string]>
        ).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => chooseView(v)}>
            {label}
          </button>
        ))}
      </div>

      <div className="weeknav">
        <button className="btn step" aria-label={navLabel[0]} onClick={() => move(-1)}>
          ‹
        </button>
        <div className="weeknav-title">
          <b className="cal-navtitle">{navTitle}</b>
          <button className="cal-today-btn" onClick={goToday}>
            Heute
          </button>
        </div>
        <button className="btn step" aria-label={navLabel[1]} onClick={() => move(1)}>
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

      {view === 'month' && (
        <>
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
                  <span key={e.calendarId + e.id} className="cal-bar" style={{ background: bgOf(e) }}>
                    {titleOf(e)}
                  </span>
                ))}
                {evs.length > MAX_BARS && <span className="cal-more">+{evs.length - MAX_BARS}</span>}
              </span>
            </button>
          );
        })}
      </div>

        </>
      )}

      {view === 'week' && (
        <div className="cal-week">
          {weekDays.map((d) => {
            const evs = eventsOn(d);
            const isToday = dateKey(d) === todayKey;
            return (
              <div key={dateKey(d)} className={'cal-wday' + (isToday ? ' today' : '')}>
                <div className="cal-wday-head">
                  <button className="cal-wday-title" onClick={() => openDay(d)}>
                    {d.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                    {isToday && <span className="pill pill-today">Heute</span>}
                  </button>
                  {canAdd && (
                    <button className="btn cal-wday-add" disabled={!online} aria-label={`Neuer Termin am ${d.getDate()}.${d.getMonth() + 1}.`} onClick={() => newEvent(d)}>
                      +
                    </button>
                  )}
                </div>
                {evs.length === 0 ? <p className="muted cal-wday-empty">Keine Termine</p> : renderList(evs, d)}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <>
          {canAdd && (
            <div className="cal-dv-actions">
              <button
                className="btn btn-primary cal-add"
                disabled={!online}
                title={online ? 'Neuer Termin' : 'Termine erfassen geht nur mit Internet'}
                onClick={() => newEvent(selDay)}
              >
                + Termin
              </button>
            </div>
          )}
          <DayGrid
            day={selDay}
            columns={columns.length ? columns : [{ key: 'family', label: 'Familie', color: personColor(personIds, null) }]}
            events={eventsOn(selDay)}
            keysOf={keysOf}
            titleOf={titleOf}
            bgOf={bgOf}
            onOpen={setDetail}
          />
        </>
      )}

      {view === 'month' && (
        <>
      <h3 className="cal-dayhead">
        {selDay.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
        {dateKey(selDay) === todayKey && <span className="pill pill-today">Heute</span>}
        {canAdd && (
          <button
            className="btn btn-primary cal-add"
            disabled={!online}
            title={online ? 'Neuer Termin' : 'Termine erfassen geht nur mit Internet'}
            onClick={() => newEvent(selDay)}
          >
            + Termin
          </button>
        )}
      </h3>
      {selEvents.length === 0 ? (
        <p className="muted cal-empty">Keine Termine.</p>
      ) : (
        renderList(selEvents, selDay)
      )}

        </>
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

      {detail && (
        <EventSheet
          ev={detail}
          title={titleOf(detail)}
          who={whoOf(detail)}
          bg={bgOf(detail, 'bottom')}
          cal={calById.get(detail.calendarId)}
          online={online}
          ownerName={(() => {
            const c = calById.get(detail.calendarId);
            return sortedPersons.find((p) => p.id === c?.personId)?.name ?? c?.email ?? 'die andere Person';
          })()}
          onClose={() => setDetail(null)}
          onEdit={(scope) => {
            setEditor({ ev: detail, scope, day: selDay });
            setDetail(null);
          }}
          onDeleted={async () => {
            setDetail(null);
            setFlash('Termin gelöscht ✓');
            await refresh(ym.y, ym.m - 1, 3, true);
          }}
        />
      )}
      {editor && (
        <EventEditor
          ev={editor.ev}
          scope={editor.scope}
          day={editor.day}
          calendars={writableCals}
          cal={editor.ev ? calById.get(editor.ev.calendarId) : undefined}
          persons={sortedPersons}
          myPersonId={sync.membership?.person_id ?? null}
          onClose={() => setEditor(null)}
          onSaved={async (msg) => {
            setEditor(null);
            setFlash(msg);
            await refresh(ym.y, ym.m - 1, 3, true);
          }}
        />
      )}
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

/** Tagesansicht: Zeitraster mit einer Spalte pro Person, damit Überschneidungen auffallen. */
function DayGrid({
  day,
  columns,
  events,
  keysOf,
  titleOf,
  bgOf,
  onOpen,
}: {
  day: Date;
  columns: Array<{ key: string; label: string; color: string }>;
  events: CalEvent[];
  keysOf: (e: CalEvent) => string[];
  titleOf: (e: CalEvent) => string;
  bgOf: (e: CalEvent, dir?: 'right' | 'bottom') => string;
  onOpen: (e: CalEvent) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = addDays(dayStart, 1);
  const allDay = events.filter((e) => e.allDay || (new Date(e.start) <= dayStart && new Date(e.end) >= dayEnd));
  const timed = events.filter((e) => !allDay.includes(e));
  const minutes = (t: Date) => Math.max(0, Math.min(1440, (+t - +dayStart) / 60000));
  const isToday = dateKey(day) === dateKey(new Date());
  const [nowMin, setNowMin] = useState(() => minutes(new Date()));
  useEffect(() => {
    if (!isToday) return;
    const t = window.setInterval(() => setNowMin(minutes(new Date())), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey(day)]);

  // Beim Öffnen zum ersten Termin bzw. 7 Uhr scrollen
  const firstMin = Math.min(7 * 60, ...timed.map((e) => minutes(new Date(e.start))));
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (firstMin / 60 - 0.5) * HOUR_PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey(day)]);

  // Pro Spalte: Termine nebeneinander legen, wenn sie sich überschneiden
  const layout = (list: CalEvent[]) => {
    const items = list
      .map((e) => ({ e, s: minutes(new Date(e.start)), en: minutes(new Date(e.end)) }))
      .map((x) => ({ ...x, en: Math.max(x.en, x.s + 20) }))
      .sort((a, b) => a.s - b.s || b.en - a.en);
    const out: Array<{ e: CalEvent; s: number; en: number; lane: number; lanes: number }> = [];
    let group: typeof out = [];
    let groupEnd = -1;
    const close = () => {
      const n = Math.max(1, ...group.map((g) => g.lane + 1));
      group.forEach((g) => (g.lanes = n));
      group = [];
    };
    for (const it of items) {
      if (it.s >= groupEnd) close();
      const used = new Set(group.filter((g) => g.en > it.s).map((g) => g.lane));
      let lane = 0;
      while (used.has(lane)) lane++;
      const placed = { ...it, lane, lanes: 1 };
      group.push(placed);
      out.push(placed);
      groupEnd = Math.max(groupEnd, it.en);
    }
    close();
    return out;
  };
  const hm = (d: Date) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  const cols = { gridTemplateColumns: `36px repeat(${columns.length}, minmax(0, 1fr))` };

  return (
    <div className="cal-dv">
      <div className="cal-dv-row cal-dv-head" style={cols}>
        <span />
        {columns.map((c) => (
          <span key={c.key} className="cal-dv-name">
            <span className="cal-dot" style={{ ['--c' as any]: c.color }} />
            <span className="cal-dv-name-text">{c.label}</span>
          </span>
        ))}
      </div>
      {allDay.length > 0 && (
        <div className="cal-dv-row cal-dv-allday" style={cols}>
          <span className="cal-dv-hour-label">ganzt.</span>
          {columns.map((c) => (
            <span key={c.key} className="cal-dv-allday-col">
              {allDay
                .filter((e) => keysOf(e).includes(c.key))
                .map((e) => (
                  <button key={e.calendarId + e.id} className="cal-dv-chip" style={{ background: bgOf(e) }} onClick={() => onOpen(e)}>
                    {titleOf(e)}
                  </button>
                ))}
            </span>
          ))}
        </div>
      )}
      <div className="cal-dv-scroll" ref={scroller}>
        <div className="cal-dv-body" style={{ ...cols, height: 24 * HOUR_PX }}>
          <div className="cal-dv-hours">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="cal-dv-hour-label" style={{ top: h * HOUR_PX }}>
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </span>
            ))}
          </div>
          {columns.map((c) => (
            <div key={c.key} className="cal-dv-col" data-col={c.key} style={{ backgroundSize: `100% ${HOUR_PX}px` }}>
              {layout(timed.filter((e) => keysOf(e).includes(c.key))).map(({ e, s, en, lane, lanes }) => (
                <button
                  key={e.calendarId + e.id}
                  className="cal-dv-ev"
                  style={{
                    top: (s / 60) * HOUR_PX,
                    height: Math.max(20, ((en - s) / 60) * HOUR_PX - 2),
                    left: `calc(${(lane / lanes) * 100}% + 1px)`,
                    width: `calc(${100 / lanes}% - 2px)`,
                    background: bgOf(e),
                  }}
                  onClick={() => onOpen(e)}
                >
                  <span className="cal-dv-ev-title">{titleOf(e)}</span>
                  <span className="cal-dv-ev-time">{hm(new Date(e.start))}</span>
                </button>
              ))}
            </div>
          ))}
          {isToday && <div className="cal-dv-now" style={{ top: (nowMin / 60) * HOUR_PX }} />}
        </div>
      </div>
    </div>
  );
}

function EventSheet({
  ev,
  title,
  who,
  bg,
  cal,
  online,
  ownerName,
  onClose,
  onEdit,
  onDeleted,
}: {
  ev: CalEvent;
  title: string;
  who: string;
  bg: string;
  cal?: CalInfo;
  online: boolean;
  ownerName: string;
  onClose: () => void;
  onEdit: (scope: 'one' | 'all') => void;
  onDeleted: () => Promise<void>;
}) {
  const [ask, setAsk] = useState<null | 'edit' | 'delete'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writable = isWritable(cal);
  const series = !!ev.recurringEventId;

  const del = async (scope: 'one' | 'all') => {
    setBusy(true);
    setError(null);
    try {
      await deleteEvent(ev, scope);
      await onDeleted();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="cal-detail-title">
          <span className="cal-detail-stripe" style={{ background: bg }} />
          {title}
        </h2>
        <p className="cal-detail-row">🕒 {whenLabel(ev)}</p>
        {series && <p className="cal-detail-row">🔁 Wiederkehrender Termin</p>}
        <p className="cal-detail-row">
          👤 {who}
          {cal ? <span className="muted"> · Kalender «{cal.name}»</span> : null}
        </p>
        {ev.location && <p className="cal-detail-row">📍 {ev.location}</p>}
        {ev.description && <p className="cal-detail-desc">{ev.description.replace(/<[^>]+>/g, ' ')}</p>}

        {!writable && <p className="muted small-note">Diesen Termin kann nur {ownerName} ändern.</p>}
        {writable && !online && <p className="warn">Ändern und Löschen geht nur mit Internet.</p>}

        {ask === 'edit' && (
          <div className="cal-ask">
            <b>Was möchtest du ändern?</b>
            <button className="btn btn-primary" onClick={() => onEdit('one')}>
              Nur diesen Termin
            </button>
            <button className="btn" onClick={() => onEdit('all')}>
              Alle Termine der Serie
            </button>
          </div>
        )}
        {ask === 'delete' && (
          <div className="cal-ask">
            <b>{series ? 'Was möchtest du löschen?' : 'Termin wirklich löschen?'}</b>
            {series ? (
              <>
                <button className="btn btn-danger" disabled={busy} onClick={() => del('one')}>
                  Nur diesen Termin löschen
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => del('all')}>
                  Alle Termine der Serie löschen
                </button>
              </>
            ) : (
              <button className="btn btn-danger" disabled={busy} onClick={() => del('one')}>
                Ja, löschen
              </button>
            )}
            <button className="btn" disabled={busy} onClick={() => setAsk(null)}>
              Abbrechen
            </button>
          </div>
        )}
        {error && <p className="warn">{error}</p>}

        {ask === null && (
          <div className="sheet-actions">
            {writable && (
              <div className="btn-pair">
                <button className="btn btn-primary" disabled={!online} onClick={() => (series ? setAsk('edit') : onEdit('one'))}>
                  ✎ Bearbeiten
                </button>
                <button className="btn btn-ghost-danger" disabled={!online} onClick={() => setAsk('delete')}>
                  Löschen
                </button>
              </div>
            )}
            {ev.link && (
              <a className="btn btn-block cal-link" href={ev.link} target="_blank" rel="noopener">
                In Google Kalender öffnen
              </a>
            )}
            <button className="btn" onClick={onClose}>
              Schliessen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type RepeatChoice = 'none' | Repeat['freq'] | 'keep';
const pad2 = (n: number) => String(n).padStart(2, '0');
const addMinutes = (date: string, time: string, min: number): [string, string] => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const t = new Date(y, m - 1, d, h, mi + min);
  return [dateKey(t), `${pad2(t.getHours())}:${pad2(t.getMinutes())}`];
};
const minutesBetween = (d1: string, t1: string, d2: string, t2: string) => {
  const a = new Date(`${d1}T${t1}:00`);
  const b = new Date(`${d2}T${t2}:00`);
  return Math.round((+b - +a) / 60000);
};

function EventEditor({
  ev,
  scope,
  day,
  calendars,
  cal,
  persons,
  myPersonId,
  onClose,
  onSaved,
}: {
  ev: CalEvent | null;
  scope: 'one' | 'all';
  day: Date;
  calendars: CalInfo[];
  cal?: CalInfo;
  persons: Person[];
  myPersonId: string | null;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const isNew = !ev;
  const series = !!ev?.recurringEventId;
  const init = useMemo<EventInput>(() => {
    if (ev) {
      const i = eventToInput(ev);
      return { ...i, title: parseTitle(ev.title, persons).title };
    }
    const now = new Date();
    const d = dateKey(day);
    const isToday = d === dateKey(now);
    const start = isToday ? `${pad2(Math.min(now.getHours() + 1, 23))}:00` : '09:00';
    const [ed, et] = addMinutes(d, start, 60);
    return { title: '', allDay: false, startDate: d, endDate: ed, startTime: start, endTime: et, location: '', description: '' };
  }, []);

  const defaultCal = cal?.id ?? (calendars.find((c) => c.kind === 'own') ?? calendars[0])?.id ?? '';
  const [calId, setCalId] = useState(defaultCal);
  const curCal = calendars.find((c) => c.id === calId) ?? cal;
  const owner = curCal?.kind === 'own' ? curCal.personId ?? myPersonId : null;

  const [title, setTitle] = useState(init.title);
  const [who, setWho] = useState<string[]>(() => (ev ? parseTitle(ev.title, persons).personIds : []));
  const [allDay, setAllDay] = useState(init.allDay);
  const [startDate, setStartDate] = useState(init.startDate);
  const [endDate, setEndDate] = useState(init.endDate);
  const [startTime, setStartTime] = useState(init.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(init.endTime ?? '10:00');
  const [location, setLocation] = useState(init.location ?? '');
  const [description, setDescription] = useState(init.description ?? '');
  const [repeat, setRepeat] = useState<RepeatChoice>(isNew || !series ? 'none' : 'keep');
  const [until, setUntil] = useState('');
  const [loadingRepeat, setLoadingRepeat] = useState(series && scope === 'all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wiederholung der Serie laden (nur bei «alle»)
  useEffect(() => {
    if (!(ev && series && scope === 'all')) return;
    seriesRepeat(ev)
      .then((r) => {
        if (r.repeat && r.repeat !== 'other') {
          setRepeat(r.repeat.freq);
          setUntil(r.repeat.until ?? '');
        } else if (r.repeat === 'other') setRepeat('keep');
        else setRepeat('none');
      })
      .catch(() => setRepeat('keep'))
      .finally(() => setLoadingRepeat(false));
  }, []);

  // Beginn verschieben → Ende mitverschieben (gleiche Dauer)
  const changeStart = (d: string, t: string) => {
    if (allDay) {
      const span = Math.round((+new Date(endDate + 'T00:00:00') - +new Date(startDate + 'T00:00:00')) / 86400000);
      const [nd] = addMinutes(d, '00:00', Math.max(0, span) * 1440);
      setEndDate(nd);
    } else {
      const dur = Math.max(15, minutesBetween(startDate, startTime, endDate, endTime));
      const [nd, nt] = addMinutes(d, t, dur);
      setEndDate(nd);
      setEndTime(nt);
    }
    setStartDate(d);
    setStartTime(t);
  };

  const toggleWho = (id: string) => setWho(who.includes(id) ? who.filter((x) => x !== id) : [...who, id]);
  const titleWho = who.filter((x) => x !== owner);
  const fullTitle = buildTitle(title, titleWho.length === persons.length ? [] : titleWho, persons);

  const endOk = allDay ? endDate >= startDate : `${endDate}T${endTime}` > `${startDate}T${startTime}`;
  const valid = title.trim() && calId && endOk && !loadingRepeat;
  const showRepeat = !(series && scope === 'one');

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: EventInput = {
      title: fullTitle,
      allDay,
      startDate,
      endDate,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      location,
      description,
      repeat: !showRepeat || repeat === 'keep' ? undefined : repeat === 'none' ? null : { freq: repeat, until: until || null },
    };
    try {
      if (isNew) await createEvent(calId, input);
      else await updateEvent(ev!, scope, input);
      await onSaved(isNew ? 'Termin gespeichert ✓' : 'Termin geändert ✓');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Neuer Termin' : series ? (scope === 'all' ? 'Alle Termine der Serie ändern' : 'Diesen Termin ändern') : 'Termin ändern'}</h2>
        {series && scope === 'all' && (
          <p className="import-banner">Änderungen an Datum und Zeit verschieben alle Termine der Serie gleich weit.</p>
        )}

        <label className="field">
          <span>Was?</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Zahnarzt" autoFocus={isNew} enterKeyHint="done" />
        </label>

        <div className="field">
          <span>Kalender</span>
          {isNew ? (
            <select className="select" value={calId} onChange={(e) => setCalId(e.target.value)}>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kind === 'family' ? `${c.name} (Familie)` : `${c.name} (mein Kalender)`}
                </option>
              ))}
            </select>
          ) : (
            <span className="muted">{curCal?.name}</span>
          )}
        </div>

        <div className="field">
          <span>Wen betrifft es?</span>
          <div className="chips">
            {persons.map((p) => {
              const fixed = p.id === owner;
              const on = fixed || who.includes(p.id);
              return (
                <button key={p.id} className={'chip small' + (on ? ' on' : '')} disabled={fixed} onClick={() => toggleWho(p.id)}>
                  {p.name}
                </button>
              );
            })}
          </div>
          <span className="small-hint muted">
            {curCal?.kind === 'family' && titleWho.length === 0 ? 'Niemand gewählt = ganze Familie. ' : ''}
            {fullTitle !== title.trim() && title.trim() ? `In Google: «${fullTitle}»` : ''}
          </span>
        </div>

        <div className="seg cal-seg">
          <button className={!allDay ? 'on' : ''} onClick={() => setAllDay(false)}>
            Mit Zeit
          </button>
          <button className={allDay ? 'on' : ''} onClick={() => setAllDay(true)}>
            Ganztägig
          </button>
        </div>

        <div className="cal-when">
          <label className="field">
            <span>Beginn</span>
            <input type="date" value={startDate} onChange={(e) => e.target.value && changeStart(e.target.value, startTime)} />
          </label>
          {!allDay && (
            <label className="field">
              <span>&nbsp;</span>
              <input type="time" value={startTime} onChange={(e) => e.target.value && changeStart(startDate, e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Ende</span>
            <input type="date" value={endDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} />
          </label>
          {!allDay && (
            <label className="field">
              <span>&nbsp;</span>
              <input type="time" value={endTime} onChange={(e) => e.target.value && setEndTime(e.target.value)} />
            </label>
          )}
        </div>
        {!endOk && <p className="warn">Das Ende liegt vor dem Beginn.</p>}

        {showRepeat && (
          <div className="field">
            <span>Wiederholen</span>
            {loadingRepeat ? (
              <span className="muted">Lade …</span>
            ) : (
              <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatChoice)}>
                {repeat === 'keep' && <option value="keep">Wie bisher (in Google festgelegt)</option>}
                <option value="none">Nicht wiederholen</option>
                {(Object.keys(REPEAT_LABELS) as Array<Repeat['freq']>).map((k) => (
                  <option key={k} value={k}>
                    {REPEAT_LABELS[k]}
                  </option>
                ))}
              </select>
            )}
            {repeat !== 'none' && repeat !== 'keep' && (
              <label className="cal-until">
                <span className="muted">bis (leer = ohne Ende)</span>
                <input type="date" value={until} min={startDate} onChange={(e) => setUntil(e.target.value)} />
              </label>
            )}
          </div>
        )}
        {series && scope === 'one' && <p className="muted small-note">🔁 Teil einer Serie. Die Änderung gilt nur für diesen Termin.</p>}

        <label className="field">
          <span>Ort (optional)</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z.B. Weinfelden" />
        </label>
        <label className="field">
          <span>Notiz (optional)</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        {error && <p className="warn">{error}</p>}
        <div className="sheet-actions">
          <button className="btn btn-primary" disabled={!valid || busy} onClick={save}>
            {busy ? 'Speichere …' : 'Speichern'}
          </button>
          <button className="btn" disabled={busy} onClick={onClose}>
            Abbrechen
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
      const sel = list.filter((c) => choice[c.id] && choice[c.id] !== 'none').map((c) => ({ id: c.id, name: c.name, kind: choice[c.id] as 'own' | 'family', access: c.access }));
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
