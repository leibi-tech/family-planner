import { useEffect, useState } from 'react';
import { requestPersistentStorage } from './db';
import { FamilyPage } from './pages/FamilyPage';
import { MenusPage } from './pages/MenusPage';
import { PlanPage } from './pages/PlanPage';

type Tab = 'familie' | 'menues' | 'plan' | 'einkauf';

const TABS: Array<{ id: Tab; label: string; icon: string; ready: boolean }> = [
  { id: 'plan', label: 'Wochenplan', icon: '📅', ready: true },
  { id: 'einkauf', label: 'Einkauf', icon: '🛒', ready: false },
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
  const [online, setOnline] = useState(navigator.onLine);

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
        {!online && <span className="pill">offline</span>}
      </header>

      <main className="content">
        {tab === 'familie' ? (
          <FamilyPage />
        ) : tab === 'menues' ? (
          <MenusPage />
        ) : tab === 'plan' ? (
          <PlanPage />
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

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (t.id === tab ? ' active' : '') + (t.ready ? '' : ' later')}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
