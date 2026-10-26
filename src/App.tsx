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
import { onNavBack, onOpenRequest, TAB_FOR } from './nav';
import { useRecords } from './hooks';
import { onChange, type Person } from './db';
import { generateChoreTodos, isMine, type Todo } from './todos';

type Tab = 'start' | 'plan' | 'einkauf' | 'todo' | 'notizen' | 'mehr' | 'menues' | 'familie';

/** Seiten, die unter «Mehr» liegen (der Knopf «Mehr» bleibt dann hervorgehoben). */
const MORE_PAGES: Tab[] = ['plan', 'menues', 'familie'];

const TITLES: Record<Tab, string> = {
  start: 'Start',
  plan: 'Wochenplan',
  einkauf: 'Einkauf',
  todo: 'ToDo',
  notizen: 'Notizen',
  mehr: 'Mehr',
  menues: 'Menüs',
  familie: 'Familie',
};

// Menüleiste unten: Start liegt in der Mitte und ist hervorgehoben (grösseres Symbol, Bogen in der Trennlinie), Wochenplan/Menüs/Familie liegen unter «Mehr».
const TABS: Array<{ id: Tab; label: string; icon: string; home?: boolean }> = [
  { id: 'einkauf', label: 'Einkauf', icon: '🛒' },
  { id: 'todo', label: 'ToDo', icon: '✅' },
  { id: 'start', label: 'Start', icon: '🏠', home: true },
  { id: 'notizen', label: 'Notizen', icon: '🗒️' },
  { id: 'mehr', label: 'Mehr', icon: '☰' },
];

declare const __APP_VERSION__: string;

export function App() {
  // Die App startet immer mit der Startseite.
  const [tab, setTabState] = useState<Tab>('start');
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

  const inMore = MORE_PAGES.includes(tab);

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
            {sync.status === 'läuft' ? '⟳' : sync.status === 'fehler' ? '⚠︎' : '☁︎'}
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
        ) : (
          <MorePage goto={setTab} />
        )}

        <footer className="foot muted">
          Version {__APP_VERSION__}
          <br />
          {persistent === true && 'Daten dauerhaft auf diesem Gerät gespeichert ✓'}
          {persistent === false && 'Daten auf diesem Gerät gespeichert'}
        </footer>
      </main>

      <WhoAmIPrompt />

      <nav className="tabbar">
        {TABS.map((t) => {
          const active = t.id === tab || (t.id === 'mehr' && inMore);
          return (
            <button
              key={t.id}
              className={'tab' + (active ? ' active' : '') + (t.home ? ' home' : '')}
              onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="tab-icon" aria-hidden>
                {t.icon}
                {t.id === 'todo' && myOpen > 0 && <span className="tab-badge">{myOpen > 99 ? '99+' : myOpen}</span>}
              </span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** «Mehr»: Seiten, die nicht in der Menüleiste Platz haben. */
function MorePage({ goto }: { goto: (t: Tab) => void }) {
  const items: Array<{ id: Tab; icon: string; label: string; sub: string }> = [
    { id: 'plan', icon: '📅', label: 'Wochenplan', sub: 'Menüs für die Woche planen' },
    { id: 'menues', icon: '🍲', label: 'Menüs', sub: 'Gerichte erfassen und importieren' },
    { id: 'familie', icon: '👪', label: 'Familie', sub: 'Personen, Portionen, gemeinsam nutzen' },
  ];
  return (
    <ul className="list">
      {items.map((i) => (
        <li key={i.id}>
          <button className="row" onClick={() => goto(i.id)}>
            <span className="more-icon" aria-hidden>
              {i.icon}
            </span>
            <span className="row-main">
              {i.label}
              <span className="row-sub">{i.sub}</span>
            </span>
            <span className="chev" aria-hidden>
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
