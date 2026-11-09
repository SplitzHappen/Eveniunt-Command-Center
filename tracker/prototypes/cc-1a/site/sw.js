// Gate 1A prototype: the root (shell) service worker, scope "/".
// - Shell pages get NO cross-origin isolation headers (as today's tracker worker), so Google's popup keeps its opener.
// - Navigations and files under atelier/ get the isolation headers here too (the "one worker for the whole app"
//   route), so the Atelier is isolated on its very first visit from the shell, without the reload the Atelier's own
//   worker needs. Registered as sw.js?isolateAtelier=0 it leaves atelier/ alone (the "naive root worker" case the
//   checks also try), and the Atelier's own worker (atelier/sw.js) has to take over.
const ISOLATE_ATELIER = new URL(self.location.href).searchParams.get('isolateAtelier') !== '0';
const CACHE = 'cc1a-shell-v1';
const FILES = ['./', 'index.html', 'shared.js', 'shell.js', 'signin.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
function isolate(res) { // the same function as the Atelier's worker today
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const inAtelier = url.pathname.startsWith(new URL('atelier/', self.registration.scope).pathname);
  const wrap = inAtelier && ISOLATE_ATELIER ? isolate : (r) => r;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // network first (fresh when online), saved copy when offline
    try { const net = await fetch(req); if (net.ok) cache.put(req, net.clone()); return wrap(net); }
    catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && !inAtelier ? await cache.match('./') : null);
      return wrap(hit || new Response('offline', { status: 504 }));
    }
  })());
});
