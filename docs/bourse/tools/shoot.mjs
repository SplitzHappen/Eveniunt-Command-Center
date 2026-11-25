// Pictures of the Bourse mock-ups and the comparison sheets: node docs/bourse/tools/shoot.mjs
// Serves the repository on 127.0.0.1, sets the stored appearance choice as docs/one-look/tools/shoot-site.mjs does, and writes into
// docs/bourse/pictures/: <screen>-<1440|360>-<theme>-<mode>.png (deviceScaleFactor 1, viewport only), measures.json, and one
// sheet-<theme>-<mode>.png per theme that puts the Bourse screens beside the real Home, Lists, Submersibles and Atelier pictures of
// docs/one-look/foundation-pictures/. Needs the built site (npm run build) and Playwright's Chromium.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))); } catch (e) { ({ chromium } = require('playwright')); }
const OUT = path.join(ROOT, 'docs', 'bourse', 'pictures');
const MAIN = ['trip', 'item', 'profit', 'watch'];
const EXTRA = ['settings', 'empty', 'states'];
const SIZES = [[1440, 1000], [360, 800]];
const CHOICES = [['crystarium-dawnglass', 'light'], ['crystarium-dawnglass', 'dark'], ['azure-dragoon', 'dark'], ['uldah-sultanate-gilt', 'light']];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };

fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8437, '127.0.0.1');
const BASE = 'http://127.0.0.1:8437/';
const browser = await chromium.launch();
const measures = {};

async function shot(name, w, h, theme, mode) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: mode });
  await ctx.addInitScript((a) => { try { localStorage.setItem('eveniunt-tracker-ui', JSON.stringify({ theme: a[0], look: { shared: { theme: a[1] } } })); } catch (e) { /* none */ } }, [mode, theme]);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + 'docs/bourse/mock/' + name + '.html');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth, hd = document.querySelector('.ol-hdr').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.bm-lane')].filter((r) => !r.closest('.bm-sheet') && r.offsetParent);
    const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
    const inView = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }).length;
    let big = { size: 0, text: '' };
    document.querySelectorAll('body *').forEach((el) => { if (!el.childNodes.length || !el.offsetParent || el.closest('.ol-hdr')) return; const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(''); if (!own) return; const b = el.getBoundingClientRect(); if (b.top > innerHeight || b.bottom < 0) return; const s = parseFloat(getComputedStyle(el).fontSize); if (s > big.size) big = { size: s, text: own.slice(0, 40) }; });
    const monoBad = [...document.querySelectorAll('body *')].filter((el) => el.offsetParent && /Plex Mono/.test(getComputedStyle(el).fontFamily) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() && !/\d/.test(n.textContent))).map((el) => el.textContent.trim().slice(0, 30));
    const first = rows[0] ? Math.round(rows[0].getBoundingClientRect().top - hd.bottom) : null;
    const acts = rows.map((r) => [...r.querySelectorAll('.bm-acts > *')].filter((x) => getComputedStyle(x).display !== 'none').length);
    return { sideways: document.documentElement.scrollWidth > vw, rowMax: hs.length ? Math.max(...hs) : null, rowMin: hs.length ? Math.min(...hs) : null, rowsInView: inView, firstRowFromHeader: first, largest: big, actsMax: acts.length ? Math.max(...acts) : 0, monoWithoutDigit: monoBad.slice(0, 5) };
  });
  if (errors.length) m.errors = errors;
  measures[name + '-' + w + '-' + theme + '-' + mode] = m;
  await page.screenshot({ path: path.join(OUT, name + '-' + w + '-' + theme + '-' + mode + '.png') });
  await ctx.close();
}

const PREVIEW = process.env.PREVIEW; // PREVIEW=trip,item: only those, 1440 light and 360 dark, no sheets, measures not written
try {
  if (PREVIEW) { for (const n of PREVIEW.split(',')) { await shot(n, 1440, 1000, 'crystarium-dawnglass', 'light'); await shot(n, 360, 800, 'crystarium-dawnglass', 'dark'); } console.log(JSON.stringify(measures, null, 1)); process.exit(0); }
  for (const [theme, mode] of CHOICES) for (const [w, h] of SIZES) for (const n of MAIN) await shot(n, w, h, theme, mode);
  for (const n of EXTRA) { await shot(n, 1440, 1000, 'crystarium-dawnglass', 'light'); await shot(n, 360, 800, 'crystarium-dawnglass', 'dark'); }
  // comparison sheets: the real pictures on the top row, the Bourse below, at the same scale; phone pictures on the right
  for (const [theme, mode] of CHOICES) {
    const tag = theme + '-' + mode, fp = (n, w) => BASE + 'docs/one-look/foundation-pictures/' + n + '-' + w + '-' + tag + '.png', bp = (n, w) => BASE + 'docs/bourse/pictures/' + n + '-' + w + '-' + tag + '.png';
    const cell = (src, label, wide) => '<figure style="margin:0"><img src="' + src + '" style="width:' + (wide ? 480 : 144) + 'px;display:block;border:2px solid #000"><figcaption style="font:700 14px system-ui;padding:4px 0">' + label + '</figcaption></figure>';
    const row = (title, items) => '<h2 style="font:700 18px system-ui;margin:16px 0 6px">' + title + '</h2><div style="display:flex;gap:12px;align-items:flex-start">' + items.join('') + '</div>';
    const html = '<!doctype html><meta charset="utf-8"><body style="margin:16px;background:#fff;color:#000;width:2600px"><h1 style="font:800 26px system-ui;margin:0">Bourse mock-ups beside the real app · ' + theme + ' ' + mode + '</h1>' +
      row('The real app now (from docs/one-look/foundation-pictures)', [['home', 'Home'], ['lists', 'Lists'], ['submersibles', 'Submersibles'], ['atelier', 'Atelier']].map(([n, l]) => cell(fp(n, 1440), l, 1)).concat([['lists', 'Lists phone'], ['submersibles', 'Submersibles phone']].map(([n, l]) => cell(fp(n, 360), l)))) +
      row('Bourse mock-ups (examples)', [['trip', 'Trip'], ['item', 'Item'], ['profit', 'Profit'], ['watch', 'Watch']].map(([n, l]) => cell(bp(n, 1440), l, 1))) +
      row('Bourse on the phone', MAIN.concat(['states']).filter((n) => n !== 'states').map((n) => cell(bp(n, 360), n))) + '</body>';
    const f = path.join(OUT, '_sheet.html'); fs.writeFileSync(f, html);
    const ctx = await browser.newContext({ viewport: { width: 2632, height: 1200 }, deviceScaleFactor: 1 }), page = await ctx.newPage();
    await page.goto(BASE + 'docs/bourse/pictures/_sheet.html'); await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT, 'sheet-' + tag + '.png'), fullPage: true }); await ctx.close();
    fs.unlinkSync(f);
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(OUT, 'measures.json'), JSON.stringify(measures, null, 1) + '\n');
console.log('pictures in ' + OUT);
