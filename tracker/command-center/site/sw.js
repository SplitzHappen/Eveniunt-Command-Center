// Eveniunt Command Center: site-wide service worker (scope: the site root, for example /Eveniunt-Command-Center/).
//
// What it does:
// - The shell's own files work offline after the first visit. The shell gets NO cross-origin isolation headers,
//   so Google's sign-in window keeps working from it (gate 1A, check R1).
// - Pages under atelier/ get the cross-origin isolation headers, exactly the three the Atelier's own worker adds.
//   Without this, a first visit to the Atelier under this worker would stay on one core (gate 1A, finding F1).
// - Pages under tracker/ pass through unchanged.
// - Once an app's own worker is installed (scope tracker/ or atelier/), the browser sends that app's requests to
//   it, not here; this worker only covers an app's first visit, or the moments before its own worker takes over.
// - Offline, an app's pages are served from that app's own offline copy (searched across all caches), so nothing
//   is stored twice. A module never opened on this device shows a short note instead of a browser error.
// - Module pages inside the shell's own site (Submersibles, step S2) are kept and served like the shell: not isolated.
// - Requests to other sites (Google, FFXIV Collect, Universalis) and any other path on this site go straight to
//   the network, untouched.
// The cache name carries the build id; a new build replaces the old cache.
const BUILD = '09acbd8db748';
const CACHE = 'eveniunt-cc-' + BUILD;
const FILES = ["./","core/cloud.js","core/codec.js","core/merge.js","core/model.js","core/storage.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest","save.js","settings.js","shell.css","shell.js","submersibles/advisor.js","submersibles/data.js","submersibles/fleet.js","submersibles/index.html","submersibles/push.js","submersibles/subs.css","submersibles/subs.js"];
const SCOPE = new URL('./', self.location).href;
const ATELIER = SCOPE + 'atelier/';
const TRACKER = SCOPE + 'tracker/';
const SHELL = new Set(FILES.map((f) => new URL(f, SCOPE).href));
// Module pages that live inside the shell's own site, not isolated (Submersibles, step S2): kept for offline use with the
// shell's files, opened network first like the shell's page.
const PAGES = ['submersibles/'].map((p) => SCOPE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('eveniunt-cc-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque' || res.type === 'opaqueredirect') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function notYetOffline(name) {
  const page = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Offline</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:46ch;margin:12vh auto;padding:0 16px}</style>' +
    '<h1>You are offline</h1><p>The ' + name + ' has not been opened on this device yet, so there is no offline copy of it. ' +
    'Open it once while connected; after that it works offline.</p><p><a href="' + SCOPE + '">Back to the Command Center</a></p>';
  return new Response(page, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// An app page: network first (always the newest app when online), then that app's own offline copy.
async function app(req, appScope, name, iso) {
  let res;
  try {
    res = await fetch(req);
  } catch (err) {
    res = await caches.match(req, { ignoreSearch: true });
    if (!res && req.mode === 'navigate') res = (await caches.match(appScope)) || (await caches.match(appScope + 'index.html'));
    if (!res) return req.mode === 'navigate' ? notYetOffline(name) : Response.error();
  }
  return iso ? isolate(res) : res;
}

// A shell page: network first with the saved copy after 4 s or offline; other shell files from the cache.
// page: the folder of the page (the shell's root, or a module page such as submersibles/).
async function shell(req, page) {
  const cache = await caches.open(CACHE);
  if (req.mode === 'navigate') {
    page = page || SCOPE;
    const cached = (await cache.match(page)) || (await cache.match(page + 'index.html'));
    const net = fetch(req).then((r) => { if (r.ok) cache.put(page, r.clone()); return r; });
    if (!cached) return net;
    net.catch(() => {});
    const slow = new Promise((resolve) => setTimeout(() => resolve(cached), 4000));
    try { return await Promise.race([net, slow]); } catch (err) { return cached; }
  }
  // other shell files (scripts, styles, data): network first, so an installed app never keeps running old code after an
  // update (owner report 2026-11-12: the iPhone home-screen app kept an old Submersibles script); the saved copy after
  // 4 s or offline
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; });
  if (!hit) return net;
  net.catch(() => {});
  const slow = new Promise((resolve) => setTimeout(() => resolve(hit), 4000));
  try { const r = await Promise.race([net, slow]); return r && r.ok ? r : hit; } catch (err) { return hit; }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const href = url.origin + url.pathname;
  if (href.startsWith(ATELIER)) return e.respondWith(app(req, ATELIER, 'Atelier', true));
  if (href.startsWith(TRACKER)) return e.respondWith(app(req, TRACKER, 'Tracker', false));
  const page = PAGES.find((p) => href === p || href === p + 'index.html');
  if (page) return e.respondWith(shell(req, page));
  if (SHELL.has(href) || href === SCOPE + 'index.html') return e.respondWith(shell(req));
  // anything else on the site: untouched
});

// Phone notifications (Submersibles step S7): the owner's helper sends a standard web push when a submarine is due back;
// this worker shows it, and a tap opens the Submersibles board.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Eveniunt Command Center', { body: d.body || '', tag: d.tag || 'subs', icon: SCOPE + 'icons/icon-192.png', badge: SCOPE + 'icons/icon-192.png', data: { url: SCOPE + 'submersibles/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || SCOPE + 'submersibles/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(SCOPE + 'submersibles/'));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
