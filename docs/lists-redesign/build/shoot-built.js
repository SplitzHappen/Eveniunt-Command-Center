'use strict';
// Pictures of the built Lists page (work items B4, B5 and R7 of docs/lists-look-spec.md and docs/lists-redteam.md): every screen at 1440 x 1000 (light) and 360 x 800 (dark), written next to this
// file, with the measured figures of the checkable rules in measures.json. Serves tracker/command-center/site/ on a local port, seeds two characters in the page's own save: the first with a gear set list, a Shark-class Bow list and a list of bought things, the second with a crafting-log list made through the page and a weaving list (real game data; typed stock and amounts are examples), and takes the pictures.
// Run: node docs/lists-redesign/build/shoot-built.js
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SITE = path.join(ROOT, 'tracker', 'command-center', 'site');
const playwright = require(path.join(ROOT, 'node_modules', 'playwright'));
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const serve = () => new Promise((ok) => { const s = http.createServer((q, r) => { const p = path.normalize(path.join(SITE, decodeURIComponent(q.url.split('?')[0]))); let f = p; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!f.startsWith(SITE) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(0, '127.0.0.1', () => ok(s)); });
// the first character's gear set list: six pieces of the Courtly Lover's leatherworking set (every one a Master Leatherworker XII recipe), plus Helmet Crab and Highland Parsley (their spots are chosen along the route), Carnage Sword and Mustard Eggs (sold in two cities)
const GEAR = [[49294, 1], [49295, 1], [49298, 1], [49300, 1], [49303, 1], [49305, 1], [4880, 1], [4784, 1], [1611, 1], [4652, 1]];
const OTHER = [['Bronze Ingot', 2], ['Rubber', 1]];
(async () => {
  const srv = await serve(), base = 'http://127.0.0.1:' + srv.address().port + '/lists/';
  const browser = await playwright.chromium.launch();
  const out = {};
  for (const [tag, vp, scheme] of [['desktop-light', { width: 1440, height: 1000 }, 'light'], ['phone-dark', { width: 360, height: 800 }, 'dark']]) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, serviceWorkers: 'block' }), page = await ctx.newPage(), phone = vp.width < 600, M = {};
    await page.addInitScript((s) => { try { localStorage.setItem('eveniunt-tracker-ui', JSON.stringify({ theme: s })); } catch (e) { /* none */ } }, scheme);
    await page.goto(base); await page.waitForSelector('html[data-ready="1"]');
    const shot = async (n, full) => { await page.waitForTimeout(250); if (full) { const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight)); await page.setViewportSize({ width: vp.width, height: h }); await page.waitForTimeout(250); await page.screenshot({ path: path.join(__dirname, n + '-' + tag + '.png') }); await page.setViewportSize(vp); await page.waitForTimeout(150); } else await page.screenshot({ path: path.join(__dirname, n + '-' + tag + '.png') }); }; // a tall page is taken in a viewport as tall as the page, so the fixed status bar sits at the foot as it does for the reader, not across the rows
    const settle = () => page.waitForFunction(() => window.__lists && !window.__lists.state.busy && !window.__lists.state.queue.length);
    // the empty screen first
    await page.evaluate(async () => { await CC.transact((raw) => { const d = raw ? CC.checkDoc(raw) : CC.emptyDoc(); d.chars = [{ id: 'c1', name: 'Tamsin Reed', lodestone: null, cls: null, gc: 1 }, { id: 'c2', name: 'Joss Marlowe', lodestone: null, cls: null, gc: 1 }]; d.updated = Date.now(); return d; }); await window.__lists.reload(); });
    await page.waitForTimeout(300); await page.evaluate(() => window.scrollTo(0, 0));
    await shot('lists-empty', true);
    // the log screens: pick a page, then the character
    await page.click('[data-act=from-log]'); await page.waitForSelector('.log-screen'); await page.selectOption('[data-f=logjob]', '3'); await page.selectOption('[data-f=logpage]', '0');
    await shot('log-which', true);
    await page.click('[data-act=log-char][data-char=c2]'); await page.waitForSelector('.log-count'); await shot('log', true);
    await page.click('[data-act=log-create]'); await page.waitForSelector('.list-card, .lhead'); await page.waitForTimeout(400);
    if (await page.locator('[data-act=back]:visible').count()) await page.click('[data-act=back]');
    await page.waitForSelector('.list-card');
    await page.evaluate(async (sets) => {
      const S = LISTS.store, D = window.__lists.data(), r = await CC.read(), cur = CC.checkDoc(r.raw).modules.lists;
      let sec = JSON.parse(JSON.stringify(cur)), t = Date.now() - 5 * 864e5; const ctx = () => ({ now: t++ });
      const nm = {}; Object.keys(D.items).forEach((id) => { if (!(D.items[id][0] in nm)) nm[D.items[id][0]] = +id; });
      const mk = (name, charId, want, extra) => {
        let x = S.newList(sec, { name, charId, stamp: D.stamp }, ctx()); sec = x.section; const id = x.id;
        want.forEach((w) => { const it = nm[w[0]]; if (!it) return; const rec = Object.keys(D.recipes).filter((k) => D.recipes[k][0] === it).sort((a, b) => D.recipes[a][3] - D.recipes[b][3] || a - b)[0] || 0; x = S.addTarget(sec, id, Object.assign({ item: it, recipe: rec, qty: w[1] }, w[2] || {}), ctx()); if (x.section) sec = x.section; });
        if (extra) extra(id); return id;
      };
      const mkId = (name, charId, items) => { let x = S.newList(sec, { name, charId, stamp: D.stamp }, ctx()); sec = x.section; const id = x.id; items.forEach((w) => { const rec = Object.keys(D.recipes).filter((k) => D.recipes[k][0] === w[0]).sort((a, b) => D.recipes[a][3] - D.recipes[b][3] || a - b)[0] || 0; x = S.addTarget(sec, id, { item: w[0], recipe: rec, qty: w[1] }, ctx()); sec = x.section; }); return id; };
      mkId('Courtly Lover set', 'c1', sets.GEAR);
      sec = S.fromProject(sec, { name: D.items[21792][0], charId: 'c1', stamp: D.stamp, project: D.projects[21792] }, ctx()).section;
      mk('Bought', 'c1', [['Rubber', 1]]); mk('Weaving', 'c2', sets.OTHER); [['Bronze Ingot', 2], ['Copper Ore', 6]].forEach((h) => { const hv = S.setHave(sec, 'c2', nm[h[0]], 'nq', h[1]); if (hv.error) throw new Error(hv.error); sec = hv.section; }); // the wanted ingots are in stock, so the ore typed for them is left over (a Left over line)
      await CC.writeSection('lists', sec, { rev: r.rev, base: JSON.parse(JSON.stringify(cur)) });
      await window.__lists.reload();
    }, { GEAR, OTHER });
    await page.waitForTimeout(300); await page.evaluate(() => window.scrollTo(0, 0));
    await shot('lists', true);
    // a Restored list: wanted items whose list is missing, written straight into the save (the page itself never makes one)
    await page.evaluate(async () => {
      const r = await CC.read(), d = CC.checkDoc(r.raw), sec = JSON.parse(JSON.stringify(d.modules.lists)), D = window.__lists.data();
      const nm = {}; Object.keys(D.items).forEach((id) => { if (!(D.items[id][0] in nm)) nm[D.items[id][0]] = +id; });
      sec.targets['l9zzzzzzzzzz.t1aaaaaaaaaa'] = { item: nm['Cloud Cloth'], recipe: 0, qty: 2, at: 1 }; sec.targets['l9zzzzzzzzzz.t2bbbbbbbbbb'] = { item: nm['Rubber'], recipe: 0, qty: 1, at: 2 };
      await CC.transact((raw) => { const doc = CC.checkDoc(raw); doc.modules.lists = sec; doc.updated = Date.now(); return doc; }); await window.__lists.reload();
    });
    await page.waitForSelector('.lists-restored'); await page.waitForTimeout(300).then(() => page.evaluate(() => window.scrollTo(0, 0))); await shot('restored', true);
    await page.evaluate(async () => { await CC.transact((raw) => { const doc = CC.checkDoc(raw); Object.keys(doc.modules.lists.targets).forEach((k) => { if (k.indexOf('l9zzzzzzzzzz.') === 0) delete doc.modules.lists.targets[k]; }); doc.updated = Date.now(); return doc; }); await window.__lists.reload(); });
    await page.waitForTimeout(300);
    // the list: To get with every section open, then one row opened
    await page.locator('.list-card', { hasText: 'Courtly Lover' }).locator('[data-act=open]').click(); await page.waitForSelector('.lhead');
    await page.click('[data-act=tab][data-tab=get]'); for (let i = 0; i < 8; i++) { const c = page.locator('.sec-toggle[aria-expanded=false]'); if (!(await c.count())) break; await c.first().evaluate((e) => e.click()); await page.waitForTimeout(60); }
    await page.evaluate(() => window.scrollTo(0, 0)); await shot('get', true);
    const part = async (n, sec) => { const e = page.locator('.gsec[data-sec=' + sec + ']'); if (!(await e.count())) { console.log('no section ' + sec + ' ' + tag); return; } await e.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await e.screenshot({ path: path.join(__dirname, n + '-' + tag + '.png') }); };
    await part('get-earn', 'earn'); await part('get-crystals', 'crystal'); await part('get-gather', 'gather'); await part('get-vendors', 'vendor');
    await page.evaluate(() => window.scrollTo(0, 0));
    const measure = (sel) => page.evaluate((s) => {
      const mast = document.querySelector('header.mast').getBoundingClientRect(), rows = [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().height > 0);
      const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const info = rows.map((e) => { const b = e.getBoundingClientRect(); const ctl = [...e.querySelectorAll('button, a, select, input, textarea')].filter((c) => vis(c) && !c.closest('.stepper')).length + (e.querySelector('.stepper') && vis(e.querySelector('.stepper')) ? 1 : 0);
        const bordered = [...e.querySelectorAll('.lbtn-r, .lbtn-o, .lbtn-p, .stepper')].filter(vis).length, prim = [...e.querySelectorAll('.lbtn-r, .lbtn-p')].filter(vis).length; return { h: Math.round(b.height), ctl, bordered, prim, top: Math.round(b.top - mast.bottom) }; });
      const mono = [...document.querySelectorAll('.lists-main *')].filter((e) => vis(e) && /Plex Mono/i.test(getComputedStyle(e).fontFamily) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => e.textContent.trim().slice(0, 20));
      return { rows: info.length, maxH: Math.max(0, ...info.map((i) => i.h)), maxCtl: Math.max(0, ...info.map((i) => i.ctl)), maxBordered: Math.max(0, ...info.map((i) => i.bordered)), maxPrim: Math.max(0, ...info.map((i) => i.prim)), firstTop: info.length ? info[0].top : null, inView: info.filter((i) => i.top >= 0 && i.top + i.h + mast.bottom <= innerHeight).length, mono: mono.slice(0, 6), scrollX: document.documentElement.scrollWidth - innerWidth, h2: Math.round(document.documentElement.scrollHeight) };
    }, sel);
    M.get = await measure('.get-row .lr');
    // open a merchant row, then a gather row
    await page.locator('.get-row .opener').first().click(); await page.evaluate(() => window.scrollTo(0, 0)); await shot('get-open', true);
    M.getOpen = await page.evaluate(() => { const li = document.querySelector('.get-row.open'), lr = li.querySelector('.lr').getBoundingClientRect(), all = li.getBoundingClientRect(); return { rest: Math.round(lr.height), opened: Math.round(all.height) }; });
    await page.locator('.gsec[data-sec=gather] .get-row .opener').first().click(); await page.evaluate(() => { const e = document.querySelector('.get-row.open'); e && e.scrollIntoView(); }); await shot('get-gather-open', false);
    M.getGatherOpen = await page.evaluate(() => { const li = document.querySelector('.get-row.open'); return li ? Math.round(li.getBoundingClientRect().height) : null; });
    await page.locator('.get-row.open .opener').click();
    // To craft
    await page.click('[data-act=tab][data-tab=craft]'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('craft', true); M.craft = await measure('.craft-row .lr');
    await page.locator('.craft-row .opener').nth(2).click(); await page.evaluate(() => { const e = document.querySelector('.craft-row.open'); e && e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }); await shot('craft-open', true);
    M.craftOpen = await page.evaluate(() => { const li = document.querySelector('.craft-row.open'); return li ? Math.round(li.getBoundingClientRect().height) : null; });
    // a material that can be made in high quality: its drawer carries the choice
    await page.locator('.craft-row.open .opener').click();
    const hqRow = page.locator('.craft-row', { has: page.locator('[data-f=hqway]') }); const hqn = await page.evaluate(() => 0);
    const rows = await page.locator('.craft-row .opener').count(); let hqDone = false;
    for (let i = 0; i < rows && !hqDone; i++) { await page.locator('.craft-row .opener').nth(i).click(); if (await page.locator('.craft-row.open [data-f=hqway]').count()) { await page.evaluate(() => { const e = document.querySelector('.craft-row.open'); e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); }); await shot('craft-hq', true); hqDone = true; } await page.locator('.craft-row.open .opener').click(); }
    void hqRow; void hqn; M.hqShown = hqDone;
    // Wanted, with a search
    await page.click('[data-act=tab][data-tab=wanted]'); await page.evaluate(() => window.scrollTo(0, 0)); M.wanted = await measure('.wanted-row .lr'); await page.fill('[data-f=search]', 'Shark-class Bow'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('wanted', true);
    await page.fill('[data-f=search]', ''); await page.locator('.wanted-row .opener').nth(1).click(); await page.evaluate(() => window.scrollTo(0, 0)); await shot('wanted-open', true);
    M.wantedOpen = await page.evaluate(() => { const li = document.querySelector('.wanted-row.open'); return li ? Math.round(li.getBoundingClientRect().height) : null; });
    // the patch notice: a list stamped with an older version, with one changed recipe as an example line
    await page.evaluate(async () => {
      const D = window.__lists.data(), r = await CC.read(), d = CC.checkDoc(r.raw), sec = d.modules.lists, id = Object.keys(sec.lists).filter((k) => sec.lists[k].name === 'Courtly Lover set')[0];
      const rid = Object.keys(D.recipes).filter((k) => D.recipes[k][0] === 49294)[0], row = JSON.parse(JSON.stringify(D.recipes[rid]));
      row[5][0][1] = row[5][0][1] + 1; D.changes = [{ from: '7.0', to: D.stamp, recipes: { [rid]: [row] } }];
      sec.lists[id].data = '7.0'; await CC.transact((raw) => { const doc = CC.checkDoc(raw); doc.modules.lists = sec; doc.updated = Date.now(); return doc; }); await window.__lists.reload();
    });
    await page.click('[data-act=tab][data-tab=get]'); await page.waitForSelector('.patch-notice'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('patch-closed', false);
    await page.click('.patch-notice [data-act=notice]'); await shot('patch', false);
    M.patch = await page.evaluate(() => { const n = document.querySelector('.patch-notice').getBoundingClientRect(); const mast = document.querySelector('header.mast').getBoundingClientRect(); return { h: Math.round(n.height), top: Math.round(n.top - mast.bottom) }; });
    await page.click('.patch-notice [data-act=noted]'); await settle(); await page.waitForTimeout(200);
    // one change, so the status line has something to say; the head, the settings sheet, the Order of ways and the status line (B4)
    await page.click('[data-act=tab][data-tab=get]'); for (let i = 0; i < 2; i++) { const hv = page.locator('.get-row [data-act=haveall]').nth(i); if (await hv.count()) { await hv.click(); await page.waitForTimeout(400); } }
    await page.evaluate(() => window.scrollTo(0, 0)); await shot('head', false);
    M.head = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) }; }; const m = document.querySelector('header.mast').getBoundingClientRect(), f = document.querySelector('.line-row'); return { mast: r('header.mast'), head: r('.lhead'), status: r('.lists-status'), scrollX: document.documentElement.scrollWidth - innerWidth, firstRowBelowMast: f ? Math.round(f.getBoundingClientRect().top - m.bottom) : null, statusIsButton: document.querySelector('.lists-status').tagName === 'BUTTON' }; });
    await page.click('[data-act=settings]'); await page.waitForSelector('.lsheet'); await shot('settings', false);
    await page.click('[data-act=sheet]'); await page.waitForSelector('.order-sheet'); await shot('order', false);
    await page.click('[data-act=sheet]'); await page.waitForSelector('.lsheet', { state: 'detached' });
    await page.evaluate(() => window.scrollTo(0, 0)); await page.click('.lists-earlier summary'); await shot('status', false); await page.click('.lists-earlier summary');
    // a Left over line (the second character's list), and a chosen step (the first character's list)
    await page.click('[data-act=back]'); await page.waitForSelector('.list-card'); await page.locator('.list-card', { hasText: 'Weaving' }).locator('[data-act=open]').click(); await page.waitForSelector('.lhead');
    await page.click('[data-act=tab][data-tab=get]'); for (let i = 0; i < 8; i++) { const c = page.locator('.sec-toggle[aria-expanded=false]'); if (!(await c.count())) break; await c.first().evaluate((e) => e.click()); await page.waitForTimeout(60); }
    await page.evaluate(() => window.scrollTo(0, 0)); await shot('left', true);
    await page.click('[data-act=back]'); await page.waitForSelector('.list-card'); await page.locator('.list-card', { hasText: 'Shark-class Bow' }).locator('[data-act=open]').click(); await page.waitForSelector('.lhead');
    await page.click('[data-act=tab][data-tab=get]'); await page.waitForTimeout(300); await page.evaluate(() => window.scrollTo(0, 0)); await shot('project', true);
    await page.click('.step-tab[data-step]:not([data-step=""])'); await page.waitForTimeout(300); await page.evaluate(() => window.scrollTo(0, 0)); await shot('steps', false);
    // the combined view of the two lists of one character
    await page.click('[data-act=back]'); await page.waitForSelector('.list-card'); const ticks = page.locator('[data-f=tick]:not([disabled])'); for (let i = 0; i < await ticks.count(); i++) await ticks.nth(i).check(); await settle();
    await page.click('[data-act=combined]'); await page.waitForSelector('.lhead.combined'); for (let i = 0; i < 8; i++) { const c = page.locator('.sec-toggle[aria-expanded=false]'); if (!(await c.count())) break; await c.first().evaluate((e) => e.click()); await page.waitForTimeout(60); }
    await page.evaluate(() => window.scrollTo(0, 0)); await shot('combined', true); M.combined = await measure('.get-row .lr');
    out[tag] = M; await ctx.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(__dirname, 'measures.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
