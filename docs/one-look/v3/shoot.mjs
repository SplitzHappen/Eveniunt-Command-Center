// Pictures of the one-look comparison (docs/one-look/v3/): node docs/one-look/v3/shoot.mjs
// Serves the repository, sets the stored appearance choice as the app stores it, writes docs/one-look/v3/pictures/
// <screen>-<A|B>-<1440|360>-<theme>-<mode>.png and one sheet per theme with look A above look B. Needs the built site.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let chromium; try { ({ chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))); } catch (e) { ({ chromium } = require('playwright')); }
const OUT = path.join(ROOT, 'docs', 'one-look', 'v3', 'pictures');
const SCREENS = ['atelier', 'lists', 'bourse'];
const SHOTS = [[1440, 1000, 'crystarium-dawnglass', 'light'], [1440, 1000, 'azure-dragoon', 'dark'], [1440, 1000, 'uldah-sultanate-gilt', 'light'], [360, 800, 'crystarium-dawnglass', 'dark']];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8441, '127.0.0.1');
const BASE = 'http://127.0.0.1:8441/';
const browser = await chromium.launch();
const report = {};
try {
  for (const [w, h, theme, mode] of SHOTS) for (const s of SCREENS) for (const v of ['A', 'B', 'C', 'D']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: mode });
    await ctx.addInitScript((a) => { try { localStorage.setItem('eveniunt-tracker-ui', JSON.stringify({ theme: a[0], look: { shared: { theme: a[1] } } })); } catch (e) { /* none */ } }, [mode, theme]);
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + 'docs/one-look/v3/mock/' + s + '-' + v + '.html');
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
    const name = s + '-' + v + '-' + w + '-' + theme + '-' + mode;
    report[name] = await page.evaluate(() => ({ sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    if (errors.length) report[name].errors = errors;
    await page.screenshot({ path: path.join(OUT, name + '.png') }); await ctx.close();
  }
  for (const [, , theme, mode] of SHOTS.filter((x) => x[0] === 1440)) {
    const tag = theme + '-' + mode, img = (s, v, w, t) => BASE + 'docs/one-look/v3/pictures/' + s + '-' + v + '-' + w + '-' + t + '.png';
    const cell = (src, label, wd) => '<figure style="margin:0"><img src="' + src + '" style="width:' + wd + 'px;display:block;border:2px solid #000"><figcaption style="font:700 15px system-ui;padding:4px 0">' + label + '</figcaption></figure>';
    const row = (t, items) => '<h2 style="font:800 22px system-ui;margin:18px 0 8px">' + t + '</h2><div style="display:flex;gap:14px;align-items:flex-start">' + items.join('') + '</div>';
    const rowsFor = (pairs) => pairs.map(([v, t]) => row(t, SCREENS.map((s) => cell(img(s, v, 1440, tag), s[0].toUpperCase() + s.slice(1), 560)).concat(SCREENS.map((s) => cell(img(s, v, 360, 'crystarium-dawnglass-dark'), 'phone', 150))))).join('');
    for (const [file, titleTxt, pairs] of [['sheet-', 'A or B?', [['A', 'A · Submersibles-led: dark capital bars, separate lanes with big state wedges, big answers'], ['B', 'B · Atelier-led: book chapters, one ledger per section, leaders, figures at reading size']]],
      ['sheet-mix-', 'the two mixes', [['C', "C · Mix: A's lanes, wedges and big answers under B's book-style titles"], ['D', "D · Mix: A's dark capital bars and big answer band over B's quieter ledgers"]]]]) {
      const html = '<!doctype html><meta charset="utf-8"><body style="margin:16px;background:#fff;color:#000;width:2300px"><h1 style="font:800 28px system-ui;margin:0">One look for the whole app: ' + titleTxt + ' · ' + theme + ' ' + mode + '</h1>' + rowsFor(pairs) + '</body>';
      const f = path.join(OUT, '_sheet.html'); fs.writeFileSync(f, html);
      const ctx = await browser.newContext({ viewport: { width: 2332, height: 1000 }, deviceScaleFactor: 1 }), page = await ctx.newPage();
      await page.goto(BASE + 'docs/one-look/v3/pictures/_sheet.html'); await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(OUT, file + tag + '.png'), fullPage: true }); await ctx.close(); fs.unlinkSync(f);
    }
  }
} finally { await browser.close(); server.close(); }
console.log(JSON.stringify(report));
