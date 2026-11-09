'use strict';
// Gate 1B test server: the published site's layout, assembled on the fly with no copying, like GitHub Pages under
// the project path /Eveniunt-Command-Center/:
//   /Eveniunt-Command-Center/          -> command-center/site/                                   (the new shell)
//   /Eveniunt-Command-Center/tracker/  -> site/                                                  (today's Tracker, unchanged)
//   /Eveniunt-Command-Center/atelier/  -> ../ffxiv-cosmic-crafting-solver/atelier/site/          (today's Atelier, unchanged)
// It sends NO cross-origin isolation headers, as GitHub Pages does, so any isolation comes from service workers.
// Usage: node command-center/serve.js [port]   (default 8418)
// start(port, { rootSw }) serves that file as the root sw.js instead of the shell's: check C13 (gate 1D) uses
// fixtures/naive-root-sw.js, a site-wide worker that controls every page and adds no isolation headers.
const http = require('http'), fs = require('fs'), path = require('path');
const CC = __dirname, T = path.join(CC, '..');
const BASE = '/Eveniunt-Command-Center/';
const MOUNTS = [
  [BASE + 'tracker/', path.join(T, 'site')],
  [BASE + 'atelier/', path.join(T, '..', 'ffxiv-cosmic-crafting-solver', 'atelier', 'site')],
  [BASE, path.join(CC, 'site')]
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json', '.xml': 'application/xml' };

function resolve(p) {
  for (const [prefix, dir] of MOUNTS) {
    if (!p.startsWith(prefix)) continue;
    let file = path.normalize(path.join(dir, p.slice(prefix.length)));
    if (!file.startsWith(dir)) return null;
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    return fs.existsSync(file) ? file : null;
  }
  return null;
}

function start(port, opts = {}) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // folders without the final slash redirect, as GitHub Pages does
    if (MOUNTS.some(([prefix]) => p + '/' === prefix)) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    const file = opts.rootSw && p === BASE + 'sw.js' ? opts.rootSw : resolve(p);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}
module.exports = { start, BASE, MOUNTS };
if (require.main === module) {
  const port = Number(process.argv[2]) || 8418;
  start(port).then(() => console.log('Command Center test site on http://127.0.0.1:' + port + BASE));
}
