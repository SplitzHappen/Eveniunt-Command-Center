// Gate 1A prototype: the Atelier's own service worker, scope "atelier/". The isolate() function and the
// network-first navigation are the same as the real Atelier worker (atelier/site-src/sw.js); only the cache name
// and file list differ.
const CACHE = 'cc1a-atelier-v1';
const FILES = ['./', 'index.html', 'atelier.js', 'pool-worker.js', '../shared.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
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
