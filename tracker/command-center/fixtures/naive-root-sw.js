// A deliberately naive site-wide worker, for gate 1D check C13 only (never deployed): it controls every page under the
// site root and adds no cross-origin isolation headers, which is what a site-wide worker from before gate 1B would do.
// Gate 1A's check X5 showed that today's Atelier, under such a worker, spent its one reload before its own worker took
// the page and stayed on one core. With gate 1D's reload rule the Atelier reloads only once its own worker controls it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { if (e.request.method === 'GET') e.respondWith(fetch(e.request)); });
