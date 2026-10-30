// Service Worker: macht die App offline nutzbar.
// Version und Dateiliste werden beim Bauen automatisch eingesetzt.
const CACHE = 'family-planner-%VERSION%';
const ASSETS = %ASSETS%;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('family-planner-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// «Teilen» aus einer anderen App (z.B. Scan aus Google Drive): Dateien merken, App öffnen.
const SHARE = 'fp-teilen';
async function receiveShare(req) {
  try {
    const form = await req.formData();
    const c = await caches.open(SHARE);
    for (const k of await c.keys()) await c.delete(k);
    let i = 0;
    for (const f of form.getAll('file')) {
      if (typeof f === 'string') continue;
      await c.put(new Request('./teilen/' + i++), new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Name': encodeURIComponent(f.name || 'Dokument') } }));
    }
  } catch (err) {
    /* nichts angekommen: App öffnet trotzdem */
  }
  return Response.redirect(new URL('./?teilen=1', self.registration.scope).href, 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).origin === location.origin && new URL(req.url).pathname.endsWith('/teilen')) {
    e.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Seite selbst: zuerst Internet (für Updates), sonst gespeicherte Version.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // Alles andere: zuerst gespeicherte Version (schnell, offline).
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
