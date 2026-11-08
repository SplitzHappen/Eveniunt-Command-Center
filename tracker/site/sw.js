// Eveniunt Tracker — service worker: works offline after the first visit.
// Unlike the Atelier's worker it adds no cross-origin isolation headers: the Tracker needs no shared memory, and those
// headers would block Google's sign-in window used by cloud sync. Cache name carries the build id; a new build replaces it.
const BUILD = 'b3a6f32361e3';
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
    if (req.mode === 'navigate') { // network first for the page (fresh when online), cache when offline or slow
      const key = new URL('./', self.registration.scope).href;
      const cached = (await cache.match(key)) || (await cache.match('index.html'));
      const net = fetch(req).then((r) => { if (r.ok) cache.put(key, r.clone()); return r; });
      if (!cached) return net;
      net.catch(() => {}); // a late failure after the saved copy was used is not an error
      // a weak connection must not keep the app from opening: after 4 s the saved copy is used (the fresh page
      // still lands in the cache for next time)
      const slow = new Promise((resolve) => setTimeout(() => resolve(cached), 4000));
      try { return await Promise.race([net, slow]); } catch (err) { return cached; }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const net = await fetch(req);
    if (net.ok) cache.put(req, net.clone());
    return net;
  })());
});
