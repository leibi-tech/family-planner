// Service Worker: macht die App offline nutzbar.
// Version und Dateiliste werden beim Bauen automatisch eingesetzt.
const CACHE = 'family-planner-1ce866103d';
const ASSETS = ["./","./index.html","./app.js?v=db00e2b3","./app.css?v=8bbd0953","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./manifest.webmanifest"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Seite selbst: zuerst Internet (für Updates), sonst gespeicherte Version.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // Alles andere: zuerst gespeicherte Version (schnell, offline).
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
