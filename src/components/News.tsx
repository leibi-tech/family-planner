// Neuigkeiten (E55): Karte auf der Startseite und Seite unter Einstellungen.
import { useState } from 'react';
import { NEWS, dismissNews, unseenNews } from '../news';

/** Startseite: neue Funktionen einmal zeigen, ✕ blendet sie für immer aus. */
export function NewsCard({ onAll }: { onAll: () => void }) {
  const [items, setItems] = useState(unseenNews);
  if (!items.length) return null;
  return (
    <div className="dash-card news-card" data-testid="news">
      <div className="dash-head">
        <h3>✨ Neu in myFam.</h3>
        <button
          className="news-x"
          aria-label="Ausblenden"
          onClick={() => {
            dismissNews();
            setItems([]);
          }}
        >
          ✕
        </button>
      </div>
      {items.map((n) => (
        <div className="news-item" key={n.version}>
          <b>{n.title}</b>
          <p>{n.text}</p>
        </div>
      ))}
      <button className="news-all" onClick={onAll}>
        Alle Neuigkeiten ›
      </button>
    </div>
  );
}

/** Einstellungen → Neuigkeiten: alle Neuerungen, neueste zuoberst. */
export function NewsPage() {
  return (
    <ul className="news-list" data-testid="news-list">
      {NEWS.map((n) => (
        <li key={n.version} className="set-box">
          <div className="news-meta muted">
            {n.date} · Version {n.version}
          </div>
          <b>{n.title}</b>
          <p>{n.text}</p>
        </li>
      ))}
    </ul>
  );
}
