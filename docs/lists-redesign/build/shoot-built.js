'use strict';
// Pictures of the built Lists page (work item B4 of docs/lists-look-spec.md): the list head, the List settings sheet, Order of ways and the status line,
// at 1440 x 1000 (light) and 360 x 800 (dark), written next to this file. Serves tracker/command-center/site/ on a local port, seeds one character and
// one list in the page's own save with real item names from the game data, and takes the pictures. Run: node docs/lists-redesign/build/shoot-built.js
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SITE = path.join(ROOT, 'tracker', 'command-center', 'site');
const playwright = require(path.join(ROOT, 'node_modules', 'playwright'));
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const serve = () => new Promise((ok) => { const s = http.createServer((q, r) => { const p = path.normalize(path.join(SITE, decodeURIComponent(q.url.split('?')[0]))); let f = p; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!f.startsWith(SITE) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(0, '127.0.0.1', () => ok(s)); });
const WANT = [['Crawler Silk', 2], ['Rubber', 2], ['Heartfelt Gift Component', 3], ['Earth Cluster', 4], ['Wind Cluster', 4], ['Lightning Cluster', 4], ['Stalk of Ramie', 6], ['Mythril Bolt', 3], ['Titanium Ingot', 2]];
(async () => {
  const srv = await serve(), base = 'http://127.0.0.1:' + srv.address().port + '/lists/';
  const browser = await playwright.chromium.launch();
  const out = {};
  for (const [tag, vp, scheme] of [['desktop-light', { width: 1440, height: 1000 }, 'light'], ['phone-dark', { width: 360, height: 800 }, 'dark']]) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, serviceWorkers: 'block' }), page = await ctx.newPage();
    await page.addInitScript((s) => { try { localStorage.setItem('eveniunt-tracker-ui', JSON.stringify({ theme: s })); } catch (e) { /* none */ } }, scheme);
    await page.goto(base); await page.waitForSelector('html[data-ready="1"]');
    await page.evaluate(async (want) => {
      await CC.transact((raw) => { const d = raw ? CC.checkDoc(raw) : CC.emptyDoc(); d.chars = [{ id: 'c1', name: 'Tamsin Reed', lodestone: null, cls: null, gc: 1 }]; d.updated = Date.now(); return d; });
      const S = LISTS.store, D = window.__lists.data(), r = await CC.read();
      let sec = S.emptySection(), t = 5000; const ctx = () => ({ now: t++ });
      const nm = {}; Object.keys(D.items).forEach((id) => { if (!(D.items[id][0] in nm)) nm[D.items[id][0]] = +id; });
      let x = S.newList(sec, { name: 'Plan', charId: 'c1', stamp: D.stamp }, ctx()); sec = x.section; const id = x.id;
      want.forEach((w) => { const it = nm[w[0]]; if (!it) return; const rec = Object.keys(D.recipes).filter((k) => D.recipes[k][0] === it).sort((a, b) => D.recipes[a][3] - D.recipes[b][3] || a - b)[0] || 0; x = S.addTarget(sec, id, { item: it, recipe: rec, qty: w[1] }, ctx()); if (x.section) sec = x.section; });
      sec = S.addStep(sec, id, 'Gear', ctx()).section; sec = S.addStep(sec, id, 'Gifts', ctx()).section;
      await CC.writeSection('lists', sec, { rev: r.rev, base: null });
      await window.__lists.reload();
    }, WANT);
    await page.waitForTimeout(300);
    const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(__dirname, n + '-' + tag + '.png') }); };
    await page.locator('.list-card [data-act=open]').first().click(); await page.waitForSelector('.lhead');
    await page.click('[data-act=tab][data-tab=get]'); for (let i = 0; i < 8; i++) { const c = page.locator('.sec-toggle[aria-expanded=false]'); if (!(await c.count())) break; await c.first().click(); }
    // one change, so the status line has something to say
    for (let i = 0; i < 2; i++) { const hv = page.locator('.get-row [data-act=haveall]').nth(i); if (await hv.count()) { await hv.click(); await page.waitForTimeout(400); } }
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('head');
    out[tag] = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) }; }; return { mast: r('header.mast'), head: r('.lhead'), status: r('.lists-status'), tabs: r('.lists-tabs'), scrollX: document.documentElement.scrollWidth - innerWidth, firstRowBelowMast: (() => { const m = document.querySelector('header.mast').getBoundingClientRect(), r = document.querySelector('.line-row'); return r ? Math.round(r.getBoundingClientRect().top - m.bottom) : null; })(), tabHeights: [...document.querySelectorAll('.ltab')].map((e) => Math.round(e.getBoundingClientRect().height)), statusLinks: [...document.querySelectorAll('.lists-status .lk')].map((e) => Math.round(e.getBoundingClientRect().height)), statusIsButton: document.querySelector('.lists-status').tagName === 'BUTTON' }; });
    await page.click('[data-act=settings]'); await page.waitForSelector('.lsheet'); await shot('settings');
    out[tag].sheet = await page.evaluate(() => { const b = document.querySelector('.lsheet').getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width) }; });
    await page.click('[data-act=sheet]'); await page.waitForSelector('.order-sheet'); await shot('order');
    await page.click('[data-act=sheet]'); await page.waitForSelector('.lsheet', { state: 'detached' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('.lists-earlier summary'); await shot('status');
    await ctx.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(__dirname, 'measures.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
