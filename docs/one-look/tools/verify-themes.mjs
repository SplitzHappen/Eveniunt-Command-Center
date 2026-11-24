// Compares the theme tokens of a page of the BUILT Command Center (served locally, theme chosen the way look.js reads it:
// localStorage "eveniunt-tracker-ui" = {theme: "light"|"dark", look: {shared: {theme: <id>}}}) with the mock in the same pair.
// Exit 0 only if every token of every pair is identical.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPlaywright } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const SITE = path.join(ROOT, 'tracker', 'command-center', 'site');
const PAIRS = [['crystarium-dawnglass', 'light'], ['crystarium-dawnglass', 'dark'], ['azure-dragoon', 'dark'], ['uldah-sultanate-gilt', 'light']];
const TOKENS = ['--paper', '--paper-2', '--paper-3', '--slip', '--ink', '--ink-2', '--ink-3', '--rule', '--grid', '--seal', '--on-seal', '--hi', '--ochre', '--lb-a', '--lb-b', '--lb-c', '--lb-glow'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(SITE, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+$/, '/index.html'));
  if (!p.startsWith(SITE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const read = (page) => page.evaluate((names) => {
  const cs = getComputedStyle(document.documentElement), out = {};
  names.forEach((n) => { out[n] = cs.getPropertyValue(n).trim(); });
  out['color-scheme'] = document.documentElement.style.getPropertyValue('color-scheme') || cs.getPropertyValue('color-scheme');
  return out;
}, TOKENS);

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let bad = 0;
try {
  for (const [id, mode] of PAIRS) {
    const live = await browser.newPage();
    await live.addInitScript((v) => { localStorage.setItem('eveniunt-tracker-ui', JSON.stringify({ theme: v.mode, look: { shared: { theme: v.id } } })); }, { id, mode });
    await live.goto('http://127.0.0.1:' + port + '/index.html');
    await live.waitForTimeout(600);
    const a = await read(live);
    const mock = await browser.newPage();
    await mock.goto(pathToFileURL(path.join(HERE, '..', 'mock', 'kit.html')).href + '?look=' + id + '&mode=' + mode);
    const b = await read(mock);
    const diffs = [...TOKENS, 'color-scheme'].filter((k) => a[k] !== b[k]);
    const empty = TOKENS.filter((k) => !a[k]);
    if (diffs.length || empty.length) { bad++; console.log('FAIL ' + id + ' ' + mode); diffs.forEach((k) => console.log('  ' + k + ': live "' + a[k] + '" mock "' + b[k] + '"')); empty.forEach((k) => console.log('  live token empty: ' + k)); }
    else console.log('ok   ' + id + ' ' + mode + ' (' + TOKENS.length + ' tokens + color-scheme identical)');
    await live.close(); await mock.close();
  }
} finally { await browser.close(); server.close(); }
process.exit(bad ? 1 : 0);
