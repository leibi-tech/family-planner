import { useEffect, useState } from 'react';
import { requestPersistentStorage } from './db';
import { FamilyPage } from './pages/FamilyPage';
import { MenusPage } from './pages/MenusPage';
import { PlanPage } from './pages/PlanPage';
import { useSync, WhoAmIPrompt } from './components/CloudCard';
import { ShoppingPage } from './pages/ShoppingPage';
import { TodoPage, useMe } from './pages/TodoPage';
import { NotesPage } from './pages/NotesPage';
import { useRecords } from './hooks';
import { onChange, type Person } from './db';
import { generateChoreTodos, isMine, type Todo } from './todos';

type Tab = 'familie' | 'menues' | 'plan' | 'einkauf' | 'todo' | 'notizen';

const TABS: Array<{ id: Tab; label: string; short?: string; icon: string; ready: boolean }> = [
  { id: 'plan', label: 'Wochenplan', short: 'Plan', icon: '📅', ready: true },
  { id: 'einkauf', label: 'Einkauf', icon: '🛒', ready: true },
  { id: 'todo', label: 'ToDo', icon: '✅', ready: true },
  { id: 'notizen', label: 'Notizen', icon: '🗒️', ready: true },
  { id: 'menues', label: 'Menüs', icon: '🍲', ready: true },
  { id: 'familie', label: 'Familie', icon: '👪', ready: true },
];

declare const __APP_VERSION__: string;

export function App() {
  const [tab, setTabState] = useState<Tab>(() => {
    try {
      const t = localStorage.getItem('fp-tab') as Tab | null;
      if (t && TABS.some((x) => x.id === t)) return t;
    } catch {}
    return 'plan';
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    window.scrollTo(0, 0);
    try {
      localStorage.setItem('fp-tab', t);
    } catch {}
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

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      <header className="topbar">
        <h1>{current.label}</h1>
        {!online ? (
          <span className="pill">offline</span>
        ) : sync.household ? (
          <button className="pill pill-cloud" onClick={() => setTab('familie')} title="Abgleich">
            {sync.status === 'läuft' ? '⟳' : sync.status === 'fehler' ? '⚠︎' : '☁︎'}
          </button>
        ) : null}
      </header>

      <main className="content">
        {tab === 'familie' ? (
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
          <div className="soon">
            <div className="soon-icon">{current.icon}</div>
            <p>
              <b>{current.label}</b> kommt in einem der nächsten Schritte.
            </p>
          </div>
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
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (t.id === tab ? ' active' : '') + (t.ready ? '' : ' later')}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
              {t.id === 'todo' && myOpen > 0 && <span className="tab-badge">{myOpen > 99 ? '99+' : myOpen}</span>}
            </span>
            <span>{t.short ?? t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
