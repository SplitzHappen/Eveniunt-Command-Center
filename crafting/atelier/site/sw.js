// Eveniunt Atelier — service worker: offline app + cross-origin isolation for multi-core solving.
// GitHub Pages cannot send COOP/COEP headers, so this worker adds them to every same-origin response
// (the same technique as coi-serviceworker). Cache name carries the build id; a new build replaces the old cache.
const BUILD = 'd393d51ed39b';
const CACHE = 'eveniunt-atelier-' + BUILD;
const FILES = ["./","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest","mt/atelier_bridge.js","mt/atelier_bridge_bg.wasm","mt/snippets/wasm-bindgen-rayon-38edf6e439f6d70d/src/workerHelpers.no-bundler.js","mt/solver-worker.js"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('eveniunt-atelier-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? new URL('./', self.registration.scope).href : req;
    // network first for navigations (fresh app when online), cache first for everything else (fast, offline)
    if (req.mode === 'navigate') {
      try { const net = await fetch(req); if (net.ok) cache.put(key, net.clone()); return isolate(net); }
      catch (err) { const hit = await cache.match(key) || await cache.match('index.html'); return isolate(hit); }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return isolate(hit);
    const net = await fetch(req);
    if (net.ok) cache.put(req, net.clone());
    return isolate(net);
  })());
});
