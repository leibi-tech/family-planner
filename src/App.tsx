import { useEffect, useState } from 'react';
import { requestPersistentStorage } from './db';
import { FamilyPage } from './pages/FamilyPage';
import { MenusPage } from './pages/MenusPage';
import { PlanPage } from './pages/PlanPage';
import { useSync, WhoAmIPrompt } from './components/CloudCard';
import { ShoppingPage } from './pages/ShoppingPage';
import { TodoPage, useMe } from './pages/TodoPage';
import { NotesPage } from './pages/NotesPage';
import { StartPage } from './pages/StartPage';
import { CalendarPage } from './pages/CalendarPage';
import { DocsPage } from './pages/DocsPage';
import { readReturnFromGoogle } from './calendar';
import { onNavBack, onOpenRequest, TAB_FOR } from './nav';
import { useRecords } from './hooks';
import { onChange, type Person } from './db';
import { generateChoreTodos, isMine, type Todo } from './todos';
import { Icon } from './icons';
import { NAV_SLOTS, PINNABLE, setNav, setTheme, useNav, useTheme, type PinTab } from './prefs';

type Tab = 'start' | 'plan' | 'einkauf' | 'todo' | 'notizen' | 'mehr' | 'menues' | 'familie' | 'kalender' | 'dokumente' | 'leiste';

const TITLES: Record<Tab, string> = {
  start: 'Start',
  plan: 'Wochenplan',
  einkauf: 'Einkauf',
  todo: 'ToDo',
  notizen: 'Notizen',
  mehr: 'Mehr',
  menues: 'Menüs',
  familie: 'Familie',
  kalender: 'Kalender',
  dokumente: 'Dokumente',
  leiste: 'Menüleiste',
};

/** Name in der Menüleiste und auf «Mehr», mit Beschreibung und Kachelfarbe. */
const PAGE_INFO: Record<PinTab, { label: string; sub: string; color: number }> = {
  einkauf: { label: 'Einkauf', sub: 'Einkaufsliste aus dem Wochenplan', color: 2 },
  todo: { label: 'ToDo', sub: 'Aufgaben und Ämtli', color: 4 },
  notizen: { label: 'Notizen', sub: 'Notizen und Listen', color: 5 },
  kalender: { label: 'Kalender', sub: 'Termine aus Google Kalender', color: 3 },
  plan: { label: 'Wochenplan', sub: 'Menüs für die Woche planen', color: 1 },
  menues: { label: 'Menüs', sub: 'Gerichte erfassen und importieren', color: 2 },
  dokumente: { label: 'Dokumente (Test)', sub: 'Fotos und PDFs auf dem NAS speichern', color: 4 },
  familie: { label: 'Familie', sub: 'Personen, Portionen, gemeinsam nutzen', color: 5 },
};
const shortLabel = (id: PinTab) => (id === 'dokumente' ? 'Dokumente' : PAGE_INFO[id].label);

declare const __APP_VERSION__: string;

export function App() {
  // Die App startet immer mit der Startseite – ausser nach der Rückkehr von der Google-Anmeldung.
  const [tab, setTabState] = useState<Tab>(() => (readReturnFromGoogle() ? 'kalender' : 'start'));
  const setTab = (t: Tab) => {
    setTabState(t);
    window.scrollTo(0, 0);
  };
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const sync = useSync();
  const [online, setOnline] = useState(navigator.onLine);

  // Ämtli: fällige Wochen automatisch als ToDo eröffnen (beim Start, bei Änderungen, beim Zurückkehren)
  useEffect(() => {
    const gen = () => void generateChoreTodos();
    gen();
    const offC = onChange('chores', gen);
    const offP = onChange('persons', gen);
    const vis = () => document.visibilityState === 'visible' && gen();
    document.addEventListener('visibilitychange', vis);
    const t = window.setInterval(gen, 30 * 60000);
    return () => {
      offC();
      offP();
      document.removeEventListener('visibilitychange', vis);
      clearInterval(t);
    };
  }, []);

  // Direkt zu einem Menü, einer Notiz oder einem ToDo springen (Startseite, ToDo → Notiz) und wieder zurück
  useEffect(() => {
    const off1 = onOpenRequest((kind) => setTab(TAB_FOR[kind] as Tab));
    const off2 = onNavBack((from) => setTab(from as Tab));
    return () => {
      off1();
      off2();
    };
  }, []);

  // Zähler in der Menüleiste: meine offenen ToDos
  const todos = useRecords<Todo>('todos');
  const persons = useRecords<Person>('persons');
  const me = useMe(persons);
  const myOpen = (todos ?? []).filter((t) => !t.done && !t.cleared && isMine(t, me)).length;

  useEffect(() => {
    requestPersistentStorage().then(setPersistent);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Menüleiste: jede Person legt auf ihrem Handy fest, was angeheftet ist (Start Mitte, Mehr rechts)
  const pinned = useNav();
  const inMore = tab !== 'start' && tab !== 'mehr' && !(pinned as string[]).includes(tab);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          {inMore && (
            <button className="topbar-back" aria-label="Zurück zu Mehr" onClick={() => setTab('mehr')}>
              ‹
            </button>
          )}
          <h1>{TITLES[tab]}</h1>
        </div>
        {!online ? (
          <span className="pill">offline</span>
        ) : sync.household ? (
          <button className="pill pill-cloud" onClick={() => setTab('familie')} title="Abgleich">
            <Icon name={sync.status === 'läuft' ? 'sync' : sync.status === 'fehler' ? 'warn' : 'wolke'} />
          </button>
        ) : null}
      </header>

      <main className="content">
        {tab === 'start' ? (
          <StartPage goto={(t) => setTab(t as Tab)} />
        ) : tab === 'familie' ? (
          <FamilyPage />
        ) : tab === 'menues' ? (
          <MenusPage />
        ) : tab === 'plan' ? (
          <PlanPage />
        ) : tab === 'einkauf' ? (
          <ShoppingPage />
        ) : tab === 'todo' ? (
          <TodoPage />
        ) : tab === 'notizen' ? (
          <NotesPage />
        ) : tab === 'dokumente' ? (
          <DocsPage />
        ) : tab === 'kalender' ? (
          <CalendarPage goto={(t) => setTab(t as Tab)} />
        ) : tab === 'leiste' ? (
          <NavSettingsPage />
        ) : (
          <MorePage goto={setTab} pinned={pinned} />
        )}

        <footer className="foot muted">
          Version {__APP_VERSION__}
          <br />
          {persistent === true && 'Daten dauerhaft auf diesem Gerät gespeichert ✓'}
          {persistent === false && 'Daten auf diesem Gerät gespeichert'}
        </footer>
      </main>

      <WhoAmIPrompt />

      <TabBar pinned={pinned} tab={tab} inMore={inMore} myOpen={myOpen} onTab={setTab} />
    </div>
  );
}

/** Menüleiste unten: 2 Plätze, Start (Mitte), 1 Platz, Mehr. Ohne onTab = nur Vorschau. */
function TabBar({ pinned, tab, inMore, myOpen, onTab }: { pinned: PinTab[]; tab: Tab | null; inMore: boolean; myOpen: number; onTab?: (t: Tab) => void }) {
  const slots: Array<PinTab | null> = Array.from({ length: NAV_SLOTS }, (_, i) => pinned[i] ?? null);
  const items: Array<Tab | null> = [slots[0], slots[1], 'start', slots[2], 'mehr'];
  return (
    <nav className={onTab ? 'tabbar' : 'tabbar-demo'}>
      {items.map((id, i) => {
        if (!id)
          return (
            <span key={'frei' + i} className="tab free" aria-hidden>
              <span className="tab-icon">
                <svg className="ico" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="5" y="5" width="14" height="14" rx="4" strokeDasharray="3 3" />
                </svg>
              </span>
              <span>frei</span>
            </span>
          );
        const active = id === tab || (id === 'mehr' && inMore);
        const label = id === 'start' ? 'Start' : id === 'mehr' ? 'Mehr' : shortLabel(id as PinTab);
        return (
          <button
            key={id}
            className={'tab' + (active ? ' active' : '') + (id === 'start' ? ' home' : '')}
            onClick={onTab ? () => onTab(id) : undefined}
            tabIndex={onTab ? undefined : -1}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden>
              <Icon name={id} />
              {id === 'todo' && myOpen > 0 && <span className="tab-badge">{myOpen > 99 ? '99+' : myOpen}</span>}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** «Mehr»: alle Seiten, die nicht in der Menüleiste angeheftet sind, und die Einstellungen. */
function MorePage({ goto, pinned }: { goto: (t: Tab) => void; pinned: PinTab[] }) {
  const theme = useTheme();
  const rest = PINNABLE.filter((id) => !pinned.includes(id));
  return (
    <>
      <ul className="more-grid">
        {rest.map((id) => (
          <li key={id}>
            <button className="row" onClick={() => goto(id)}>
              <span className={'more-ico mc-' + PAGE_INFO[id].color}>
                <Icon name={id} />
              </span>
              <span className="row-main">
                {PAGE_INFO[id].label}
                <span className="row-sub">{PAGE_INFO[id].sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <h2 className="more-h">Einstellungen</h2>
      <button className="set-row" onClick={() => goto('leiste')}>
        <Icon name="leiste" />
        <span className="grow">Menüleiste anpassen</span>
        <span className="chev" aria-hidden>
          ›
        </span>
      </button>
      <div className="set-box">
        <div className="set-box-h">
          <Icon name="aussehen" />
          Aussehen
        </div>
        <div className="seg" role="group" aria-label="Aussehen">
          <button className={theme === 'hell' ? 'on' : ''} onClick={() => setTheme('hell')}>
            Hell
          </button>
          <button className={theme === 'dunkel' ? 'on' : ''} onClick={() => setTheme('dunkel')}>
            Dunkel
          </button>
        </div>
      </div>
    </>
  );
}

/** Menüleiste anpassen: anheften, lösen, verschieben. Gilt für dieses Handy. */
function NavSettingsPage() {
  const pinned = useNav();
  const full = pinned.length >= NAV_SLOTS;
  const move = (i: number, d: number) => {
    const n = [...pinned];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setNav(n);
  };
  const rest = PINNABLE.filter((id) => !pinned.includes(id));
  return (
    <>
      <p className="hint">Start bleibt in der Mitte, Mehr ganz rechts. Dazu kommen 3 Plätze: zwei links, einer rechts. Was nicht angeheftet ist, findest du unter «Mehr». Die Einstellung gilt für dieses Handy.</p>
      <div className="nav-preview" aria-label="Vorschau der Menüleiste">
        <TabBar pinned={pinned} tab="start" inMore={false} myOpen={0} />
      </div>
      <h3 className="nav-group">Angeheftet</h3>
      <ul className="nav-list">
        {pinned.map((id, i) => (
          <li key={id}>
            <span className="nav-num">{i + 1}</span>
            <span className="nav-name">
              <Icon name={id} />
              {shortLabel(id)}
            </span>
            <button className="nav-btn" aria-label={shortLabel(id) + ' nach links'} disabled={i === 0} onClick={() => move(i, -1)}>
              ‹
            </button>
            <button className="nav-btn" aria-label={shortLabel(id) + ' nach rechts'} disabled={i === pinned.length - 1} onClick={() => move(i, 1)}>
              ›
            </button>
            <button className="nav-btn" aria-label={shortLabel(id) + ' lösen'} onClick={() => setNav(pinned.filter((x) => x !== id))}>
              ✕
            </button>
          </li>
        ))}
        <li>
          <span className="nav-num off">·</span>
          <span className="nav-name">
            <Icon name="start" />
            Start
          </span>
          <span className="nav-fixed">immer Mitte</span>
        </li>
        <li>
          <span className="nav-num off">·</span>
          <span className="nav-name">
            <Icon name="mehr" />
            Mehr
          </span>
          <span className="nav-fixed">immer rechts</span>
        </li>
      </ul>
      <h3 className="nav-group">Unter «Mehr»</h3>
      <ul className="nav-list">
        {rest.map((id) => (
          <li key={id}>
            <span className="nav-name">
              <Icon name={id} />
              {shortLabel(id)}
            </span>
            <button className="nav-pin" disabled={full} onClick={() => setNav([...pinned, id])}>
              Anheften
            </button>
          </li>
        ))}
      </ul>
      {full && <p className="hint">Alle 3 Plätze sind belegt. Zuerst oben einen Knopf lösen (✕).</p>}
    </>
  );
}
