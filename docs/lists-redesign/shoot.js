'use strict';
// Pictures and measures of the Lists look mock-ups (docs/lists-look-spec.md, item M1).
// Run from anywhere: node docs/lists-redesign/shoot.js
// Serves the repository root on a local port, opens every page of docs/lists-redesign/mock/ with the Chromium of the repository's Playwright at
// 1440 x 1000 (light scheme) and 360 x 800 (dark scheme), writes docs/lists-redesign/after/<page>-desktop-light.png and <page>-phone-dark.png
// (full page) and docs/lists-redesign/after/measures.json. Nothing is written outside docs/lists-redesign/after/.
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const MOCK = path.join(__dirname, 'mock'), OUT = path.join(__dirname, 'after');
const playwright = require(path.join(ROOT, 'node_modules', 'playwright'));
const PAGES = ['lists', 'lists-empty', 'get', 'get-open', 'craft', 'craft-open', 'wanted', 'settings', 'order', 'combined', 'log', 'log-which', 'restored', 'patch', 'status', 'left', 'steps'];
const DIALOGS = ['settings', 'order'];
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

// runs inside the page
function measure() {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const H = innerHeight, phone = innerWidth <= 700;
  const mast = document.querySelector('header.mast').getBoundingClientRect();
  const mastBottom = mast.bottom + scrollY;
  const rows = [...document.querySelectorAll('.lr, .hit')].filter(vis);
  const status = [...document.querySelectorAll('.statusline')].filter(vis);
  const bar = phone ? 64 : 0;
  const statusH = status.reduce((m, e) => Math.max(m, e.getBoundingClientRect().height + (phone ? 0 : 16)), 0);
  const fixedStatusLimit = H - bar - (phone ? statusH : (status.length ? 56 : 0));
  const isCtl = (e) => e.matches('button, a[href], input, select, textarea');
  const stat = rows.filter((r) => !r.classList.contains('open')).map((r) => {
    const all = [...r.querySelectorAll('button, a[href], input, select, textarea')].filter(vis);
    const st = r.querySelector('.stepper'); const stVis = st && vis(st);
    const outside = all.filter((e) => !(st && st.contains(e)));
    const controls = outside.length + (stVis ? 1 : 0);
    const bordered = outside.filter((e) => e.tagName === 'BUTTON' && ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(getComputedStyle(e)['border' + s + 'Width']) >= 1 && getComputedStyle(e)['border' + s + 'Style'] !== 'none')).length + (stVis ? 1 : 0);
    const primaries = all.filter((e) => e.classList.contains('btn-p')).length;
    return { h: Math.round(r.getBoundingClientRect().height * 10) / 10, controls, bordered, primaries, item: r.getAttribute('data-item') || '' };
  });
  const opened = [...document.querySelectorAll('.lr.open')].filter(vis).map((r) => {
    const d = r.nextElementSibling && r.nextElementSibling.classList.contains('drawer') ? r.nextElementSibling : null;
    const dr = d ? d.getBoundingClientRect() : null, rr = r.getBoundingClientRect();
    return { h: Math.round(((dr ? dr.bottom : rr.bottom) - rr.top) * 10) / 10, row: Math.round(rr.height * 10) / 10, controls: [...r.querySelectorAll('button, a[href], input, select')].filter(vis).length, primaries: [...r.querySelectorAll('.btn-p')].filter(vis).length };
  });
  const first = rows.length ? Math.round((rows[0].getBoundingClientRect().top + scrollY) - mastBottom) : null;
  const inView = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= fixedStatusLimit; }).length;
  const inViewAboveBar = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= H - bar; }).length;
  const dataFace = [...document.querySelectorAll('body *')].filter((e) => vis(e) && /IBM Plex Mono/.test(getComputedStyle(e).fontFamily) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => ({ text: [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(), tag: e.tagName.toLowerCase() }));
  const dataNoDigit = dataFace.filter((x) => !/\d/.test(x.text));
  const dataLabel = [...document.querySelectorAll('label, button, select, h1, h2, h3, legend')].filter((e) => vis(e) && /IBM Plex Mono/.test(getComputedStyle(e).fontFamily)).map((e) => e.textContent.trim().slice(0, 40));
  const small = phone ? [...document.querySelectorAll('button, select, input:not([type=checkbox]):not([type=radio]), a.link, .tabs a')].filter((e) => vis(e) && !e.closest('.scrim')).filter((e) => e.getBoundingClientRect().height < 39.5).map((e) => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height)) : [];
  const head = document.querySelector('.head, .group-head, .panel-h');
  const rowHeights = stat.map((x) => x.h);
  return {
    viewport: [innerWidth, H],
    sidewaysScroll: document.documentElement.scrollWidth - innerWidth,
    pageHeight: document.documentElement.scrollHeight,
    mastheadBottom: Math.round(mastBottom),
    headHeight: head ? Math.round(head.getBoundingClientRect().height) : null,
    rowsAtRest: stat.length, rowHeightMaxAtRest: rowHeights.length ? Math.max(...rowHeights) : null, rowHeightMinAtRest: rowHeights.length ? Math.min(...rowHeights) : null,
    openedRows: opened,
    controlsPerRowMax: stat.length ? Math.max(...stat.map((x) => x.controls)) : null,
    borderedButtonsPerRowMax: stat.length ? Math.max(...stat.map((x) => x.bordered)) : null,
    primariesPerRowMax: stat.length ? Math.max(...stat.map((x) => x.primaries)) : null,
    firstRowFromMastheadBottom: first,
    rowsFullyInView: inView, rowsFullyInViewAboveBarOnly: inViewAboveBar, viewLimit: Math.round(fixedStatusLimit),
    statusLineHeight: status.length ? Math.round(Math.max(...status.map((e) => e.getBoundingClientRect().height))) : null,
    dataFaceTexts: dataFace.map((x) => x.text), dataFaceWithoutDigit: dataNoDigit.map((x) => x.text), dataFaceOnLabelsButtonsHeadings: dataLabel,
    targetsUnder40AtPhone: small,
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve(); const port = server.address().port;
  const browser = await playwright.chromium.launch();
  const modes = [
    { tag: 'desktop-light', key: 'desktop', viewport: { width: 1440, height: 1000 }, colorScheme: 'light', scale: 1 },
    { tag: 'phone-dark', key: 'phone', viewport: { width: 360, height: 800 }, colorScheme: 'dark', scale: 2 },
  ];
  const measures = { about: 'Measured by docs/lists-redesign/shoot.js on the static mock-ups. Rows at rest exclude the opened row; "controls" counts the visible buttons, links, fields and selects of a row, the stepper counted once; "bordered" counts buttons with a border on all four sides (the stepper counted once); the first row is the first .lr or .hit; rows in view are counted at scroll 0 above the fixed bottom bar and the status line (rowsFullyInViewAboveBarOnly ignores the status line).', pages: {} };
  for (const m of modes) {
    const ctx = await browser.newContext({ viewport: m.viewport, colorScheme: m.colorScheme, deviceScaleFactor: m.scale, reducedMotion: 'reduce' });
    for (const name of PAGES) {
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
      await page.goto('http://127.0.0.1:' + port + '/docs/lists-redesign/mock/' + name + '.html', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
      const data = await page.evaluate(measure);
      data.errors = errors;
      (measures.pages[name] = measures.pages[name] || {})[m.key] = data;
      // A dialog is pictured at the window size it opens in. Every other page is pictured whole: the window is made as tall as the page first,
      // so the fixed tab bar and status line sit at the bottom of the picture, as they do at the end of a scroll.
      if (!DIALOGS.includes(name)) { const h = await page.evaluate(() => document.documentElement.scrollHeight); await page.setViewportSize({ width: m.viewport.width, height: Math.max(m.viewport.height, h) }); await page.waitForTimeout(100); }
      await page.screenshot({ path: path.join(OUT, name + '-' + m.tag + '.png'), fullPage: !DIALOGS.includes(name) });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'measures.json'), JSON.stringify(measures, null, 1) + '\n');
  const n = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length;
  console.log('wrote ' + n + ' pictures and measures.json');
})().catch((e) => { console.error(e); process.exit(1); });
