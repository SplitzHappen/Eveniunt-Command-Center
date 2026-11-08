// Eveniunt Tracker — service worker: works offline after the first visit.
// Unlike the Atelier's worker it adds no cross-origin isolation headers: the Tracker needs no shared memory, and those
// headers would block Google's sign-in window used by cloud sync. Cache name carries the build id; a new build replaces it.
const BUILD = '6b5f75e80145';
const CACHE = 'eveniunt-tracker-' + BUILD;
const FILES = ["./","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('eveniunt-tracker-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // Google, FFXIV Collect: straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') { // network first for the page (fresh when online), cache when offline
      const key = new URL('./', self.registration.scope).href;
      try { const net = await fetch(req); if (net.ok) cache.put(key, net.clone()); return net; }
      catch (err) { return (await cache.match(key)) || (await cache.match('index.html')); }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const net = await fetch(req);
    if (net.ok) cache.put(req, net.clone());
    return net;
  })());
});
