import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { startSync } from './sync';
import { applyTheme } from './prefs';
import { startDocUploads } from './docs';

// Aussehen (hell/dunkel) sofort setzen, bevor die App erscheint
applyTheme();

createRoot(document.getElementById('root')!).render(<App />);
startSync();
startDocUploads();

// Offline-Fähigkeit: Service Worker registrieren (nur auf https / installierter App).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  // Neue Version aktiv → Seite einmal neu laden, damit sie sichtbar wird.
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    location.reload();
  });
}
