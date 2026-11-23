// Service worker for ڕێبەری پەروەردەی شارباژێڕ
// Strategy: Stale-While-Revalidate for same-origin GET requests.
// Pages/fonts/styles/icons are served from cache instantly and refreshed in the background.
// Bump VERSION on every release so old caches are removed on activate.
const VERSION = 'v5';
const CACHE = 'rebari-' + VERSION;
const PRECACHE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('rebari-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // maps, QR and other external links go straight to the network
  if (url.pathname.startsWith('/api/')) return; // live data and accounts always come from the network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network);      // refresh in the background
      return cached;
    }
    const res = await network;
    if (res) return res;
    // offline and not cached: fall back to the app shell for page navigations
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
