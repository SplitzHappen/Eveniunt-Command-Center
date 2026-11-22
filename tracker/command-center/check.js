'use strict';
// Browser checks for the Command Center shell (gates 1B to 1E; blueprint section 5; gate 1A finding F1; rules 5 and 10;
// gate 1E's cloud sync through OneDrive and the sync helper, C17 to C19; Submersibles step S2, C20 to C25; phone notifications, C26; the return log and earnings, C29).
// Serves the published layout with serve.js (no isolation headers, like GitHub Pages), drives a browser through
// Playwright, and writes evidence/checks*.json plus screenshots. Every request to another site is blocked.
// Run: node command-center/build.js && node command-center/check.js
//      BROWSER=firefox node command-center/check.js      (evidence/checks-firefox.json)
//      BROWSER=webkit  node command-center/check.js      (evidence/checks-webkit.json)
// A check that needs an interface one engine lacks is recorded as not run, with the reason, never as passed.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), http = require('http');
const playwright = require('playwright');
const { start: startServer, BASE, MOUNTS } = require('./serve');
const { execFileSync } = require('child_process');
const os = require('os');

const BROWSER = process.env.BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(BROWSER)) { console.error('BROWSER must be chromium, firefox or webkit'); process.exit(2); }
const engine = playwright[BROWSER];
const CC = __dirname, T = path.join(CC, '..');
const ATELIER_SRC = path.join(T, '..', 'crafting', 'atelier');
const FIX = require(path.join(ATELIER_SRC, 'tests', 'fixtures', 'raphael-cli.json'));
const PORT = Number(process.env.PORT) || 8418, PORT2 = PORT + 1, PORT3 = PORT + 2, PORT4 = PORT + 3, PORT5 = PORT + 4;
const ROOT = 'http://127.0.0.1:' + PORT + BASE, ROOT2 = 'http://127.0.0.1:' + PORT2 + BASE, ROOT3 = 'http://127.0.0.1:' + PORT3 + BASE, ROOT4 = 'http://127.0.0.1:' + PORT4 + BASE, ROOT5 = 'http://127.0.0.1:' + PORT5 + BASE;
const DEVICE_KEY = 'eveniunt-command-center-device';
const results = [];
let browser;
// Harness safety: every context and test server is registered, so a numbered check that throws can be recorded as a FAIL for
// its own id, have what it opened closed, and let the run go on (see guard below).
const openContexts = [], openServers = [];
function start(port, opts) { return startServer(port, opts).then((s) => { openServers.push(s); return s; }); }
async function closeServer(s) { try { if (s.closeAllConnections) s.closeAllConnections(); await new Promise((ok) => { try { s.close(() => ok()); } catch (e) { ok(); } }); } catch (e) { /* already closed */ } }
async function guard(id, fn) {
  if (process.env.CHECK_ONLY && !process.env.CHECK_ONLY.split(',').includes(id)) return; // development aid: run only the listed checks (writes evidence/checks-only.json)
  const c0 = openContexts.length, s0 = openServers.length;
  try { await fn(); } catch (err) {
    record(id, 'check block stopped by an error before it finished (the run continues)', false, { error: String((err && err.message) || err).split('\n').slice(0, 4).join(' | ') });
  }
  for (const c of openContexts.splice(c0)) await c.close().catch(() => {});
  for (const s of openServers.splice(s0)) await closeServer(s);
}

function record(id, title, pass, detail) {
  results.push({ id, title, pass: !!pass, detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + id + ' ' + title + (pass ? '' : '\n     ' + JSON.stringify(detail)));
}
function skip(id, title, reason) {
  results.push({ id, title, pass: null, notRun: reason });
  console.log('SKIP ' + id + ' ' + title + ' — not run: ' + reason);
}
async function context(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 } }, opts));
  const errors = [], external = [];
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1:' + PORT + '/') || u.startsWith('http://127.0.0.1:' + PORT2 + '/') || u.startsWith('http://127.0.0.1:' + PORT3 + '/') || u.startsWith('http://127.0.0.1:' + PORT4 + '/') || u.startsWith('http://127.0.0.1:' + PORT5 + '/') || /^(blob|data):/.test(u)) return r.continue();
    external.push(u); return r.abort();
  });
  ctx.on('page', (p) => watch(p, errors));
  openContexts.push(ctx);
  return { ctx, errors, external };
}
function watch(page, errors) {
  page.on('pageerror', (e) => errors.push(page.url() + ' :: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(page.url() + ' :: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  page.__navs = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) page.__navs.push(f.url()); });
}
// expected noise: requests to other sites are blocked on purpose and same-site files the test server lacks (the public
// site's timers and news) answer 404; each browser reports those as console errors in its own words
// the picker note the page shows for an item (spec 6.5 item 4), worked out here from the data alone
function recNoteFor(data, id) {
  let count = 0, best = null;
  const grp = (n) => Math.round(n).toLocaleString('en');
  for (const sid of Object.keys(data.dropRates.sectors).map(Number).sort((a, b) => a - b)) {
    let here = false;
    data.dropRates.sectors[sid].pools.forEach((pool, t) => {
      const rolls = pool.band[0] + pool.band[1] + pool.band[2];
      for (const row of pool.items) if (row[0] === id && rolls) { here = true; const p = row[1] / rolls; if (!best || p > best.p) best = { sid, tier: t + 1, p, rolls }; }
    });
    if (here) count++;
  }
  if (!best) { const n = Object.values(data.loot || {}).filter((l) => l.includes(id)).length; return 'Listed as possible in ' + n + ' sector' + (n === 1 ? '' : 's') + '; no drop record yet, so no rate.'; }
  const sec = data.sectors.find((x) => x.id === best.sid), sea = data.seas.find((x) => x.id === sec.sea), v = best.p * 100;
  const pct = (Math.abs(v) < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v))) + '%', cnt = best.rolls < 1e6 ? grp(best.rolls) : (Math.round(best.rolls / 1e5) / 10).toFixed(1) + ' million';
  return 'Recorded in ' + count + ' sector' + (count === 1 ? '' : 's') + ' (community drop records). Most per survey: ' + sea.name + ' ' + sec.letter + ', tier ' + best.tier + ', ' + pct + ' of that tier, ' + cnt + ' surveys.';
}
// Visual fixes part 1 (S5): the rendered lines of every element matching sel: one text per line, found by measuring each character; a line must not start or end with a separator or an arrow
const renderedLines = (page, sel) => page.evaluate((sel) => {
  const out = [];
  document.querySelectorAll(sel).forEach((el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rows = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.nodeValue.trim() || getComputedStyle(n.parentElement).fontSize === '0px') continue;
      const rg = document.createRange();
      for (let i = 0; i < n.nodeValue.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getClientRects()[0]; if (!r || !r.width) continue; const ch = n.nodeValue[i], y = Math.round(r.top + r.height / 2); let row = rows.find((q) => Math.abs(q.y - y) < r.height / 2); if (!row) { row = { y, t: '' }; rows.push(row); } row.t += ch; }
    }
    rows.sort((a, b) => a.y - b.y).forEach((r) => out.push(r.t.trim()));
  });
  return out;
}, sel);
const badEnds = (lines) => lines.filter((t) => t && (/^[·→]/.test(t) || /[·→]$/.test(t)));
// Visual fixes part 2 (M16): every visible control whose source has a space between two pieces of text (a text node and a span, two spans) must show that space: the gap between the last glyph before it and the first glyph after it
// (on one line) is at least 1.5 px; a control's own text must not run "word:Word" together either
const runTogether = (page) => page.evaluate(() => {
  const bad = [], seen = new Set();
  document.querySelectorAll('button, a, summary, label, .btn, .link, [role=button]').forEach((el) => {
    if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return;
    const all = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const pe = n.parentElement, r = pe.getBoundingClientRect(); if (getComputedStyle(pe).fontSize === '0px' || r.width < 4 || r.height < 4) continue; all.push(n); }
    const solid = all.filter((n) => n.nodeValue.trim()), glyph = (n, last) => { const v = n.nodeValue, i = last ? v.trimEnd().length - 1 : v.length - v.trimStart().length, rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const q = rg.getClientRects()[0]; return q && q.width ? q : null; };
    for (let k = 0; k + 1 < solid.length; k++) {
      const a = solid[k], b = solid[k + 1], ia = all.indexOf(a), ib = all.indexOf(b);
      const between = a.nodeValue.slice(a.nodeValue.trimEnd().length) + all.slice(ia + 1, ib).map((n) => n.nodeValue).join('') + b.nodeValue.slice(0, b.nodeValue.length - b.nodeValue.trimStart().length);
      if (!/\s/.test(between)) continue;
      const ra = glyph(a, true), rb = glyph(b, false); if (!ra || !rb) continue;
      if (Math.abs((ra.top + ra.bottom) / 2 - (rb.top + rb.bottom) / 2) > Math.min(ra.height, rb.height) / 2) continue;
      if (rb.left - ra.right < 1.5) { const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70); if (!seen.has(t)) { seen.add(t); bad.push(t); } }
    }
    const it = (el.innerText || '').replace(/\s+/g, ' ');
    if (/[A-Za-z]:[^\s\d]/.test(it)) { const t = it.trim().slice(0, 70); if (!seen.has(t)) { seen.add(t); bad.push(t); } }
  });
  return bad;
});
// M5, M6: a line of the joined figures never starts with a source tag, a route title never leaves one letter alone
const badTagStart = (lines) => lines.filter((t) => /^(calculated|game data|learned|community estimate)/i.test(t));
const aloneLetter = (lines) => lines.filter((t) => /^[A-Z]{1,2}$/.test(t));
// M8: the width of a panel against the width of the main column (the Board's strip, the Log's and Earnings' panel)
const widthProbe = (pg, sel) => pg.evaluate((sel) => { const m = document.querySelector('.subs-main'), cs = getComputedStyle(m), inner = m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), p = document.querySelector(sel); return { inner: Math.round(inner), panel: p ? Math.round(p.getBoundingClientRect().width) : 0 }; }, sel);
// V1: the slanted mark at the right of a lane's send button never touches text: every rendered line of the button's text ends at least 8 px before the mark (a button without a mark is not counted)
const markProbe = (page) => page.evaluate(() => {
  const bad = []; let n = 0, lanes = 0;
  document.querySelectorAll('.sub-when .quick').forEach((b) => {
    const r = b.getBoundingClientRect(); if (!r.width) return; lanes++;
    const a = getComputedStyle(b, '::after'); if (a.content === 'none' || a.display === 'none') return; n++;
    const x1 = r.right - parseFloat(a.right), x0 = x1 - parseFloat(a.width), y0 = r.top + parseFloat(a.top), y1 = y0 + parseFloat(a.height), onY = (q) => q.bottom > y0 && q.top < y1;
    b.querySelectorAll('span').forEach((sp) => { if (!sp.getClientRects().length || getComputedStyle(sp).display === 'none') return; const rg = document.createRange(); rg.selectNodeContents(sp); [...rg.getClientRects()].forEach((q) => { if (q.width > 0 && onY(q) && q.right + 8 > x0 && q.left < x1) bad.push({ text: sp.textContent.trim(), gap: Math.round(x0 - q.right), cls: sp.className }); }); });
    [...b.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim()).forEach((c) => { const rg = document.createRange(); rg.selectNodeContents(c); [...rg.getClientRects()].forEach((q) => { if (q.width > 0 && onY(q) && q.right + 8 > x0 && q.left < x1) bad.push({ text: c.textContent, gap: Math.round(x0 - q.right) }); }); });
  });
  return { lanes, n, bad };
});
// M13, M14: the send bar and the rank chip of the compact lanes (the dense Board and the by-return-time list)
const barProbe = (page) => page.evaluate(() => {
  const q = [...document.querySelectorAll('.sub[data-sub] .quick')].filter((e) => e.getClientRects().length), chips = [...document.querySelectorAll('.sub[data-sub] .sub-meta > span:first-child')].filter((e) => e.getClientRects().length);
  const one = q.slice(0, 6).map((b) => { const cs = getComputedStyle(b), br = b.getBoundingClientRect(), sp = [...b.children].filter((c) => c.getClientRects().length && c.getBoundingClientRect().width > 0 && getComputedStyle(c).display !== 'none'), r0 = sp.length ? sp[0].getBoundingClientRect() : br, top = sp.filter((c) => Math.abs(c.getBoundingClientRect().top - r0.top) < 4), x0 = Math.min(...top.map((c) => c.getBoundingClientRect().left)), x1 = Math.max(...top.map((c) => c.getBoundingClientRect().right)); return { fs: parseFloat(cs.fontSize), fw: +cs.fontWeight, off: Math.round(((x0 + x1) / 2) - ((br.left + br.right) / 2)), text: (sp[0] || b).textContent.trim() }; });
  return { n: q.length, bars: one, chipH: chips.length ? Math.round(Math.min(...chips.map((c) => c.getBoundingClientRect().height))) : 0, chipFs: chips.length ? Math.min(...chips.map((c) => parseFloat(getComputedStyle(c).fontSize))) : 0 };
});
const real = (errors) => errors.filter((e) => !/net::ERR_FAILED|Failed to load resource|NetworkError|NS_ERROR|status of 404|404 \(|was blocked|Load request cancelled/.test(e));

const shellState = (page) => page.evaluate(async () => ({
  url: location.href,
  isolated: self.crossOriginIsolated,
  controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
  modules: [...document.querySelectorAll('.switcher a')].map((a) => a.textContent.trim()),
  cards: document.querySelectorAll('.modules .card').length,
  title: document.title
}));
async function shellControlled(page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller && /\/sw\.js$/.test(navigator.serviceWorker.controller.scriptURL), null, { timeout: 20000 });
}
async function atelierState(page, opts = {}) {
  // a first direct visit reloads itself once into isolation (the Atelier's start-up rule); wait for it to settle
  if (opts.expectIsolated) await page.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 60000 }).catch(() => {});
  for (let attempt = 0; ; attempt++) {
    try {
      await page.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 });
      await page.waitForFunction(() => window.__atelier.threads() > 1, null, { timeout: 30000 }).catch(() => {});
      return await page.evaluate(() => ({
        url: location.href,
        isolated: self.crossOriginIsolated,
        threads: window.__atelier.threads(),
        controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL
      }));
    } catch (err) {
      if (attempt >= 2) throw err;
      await page.waitForLoadState('load');
    }
  }
}
async function waitOwnWorker(page, app) {
  await page.waitForFunction((a) => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.endsWith('/' + a + '/sw.js'), app, { timeout: 30000 });
  // the app's own worker caches its files during install; wait until its offline copy holds the page
  await page.waitForFunction(async () => (await caches.keys()).some((k) => /^eveniunt-(tracker|atelier)-/.test(k)) && !!(await caches.match(new URL('./', location.href).href)), null, { timeout: 30000 });
}
// the Atelier's gate 1C question (whose are today's stats?) is a modal dialog; a check that clicks elsewhere answers "Not now" first
async function notNow(page) { if (await page.$('#dlg[open]')) { await page.click('#dlg [data-d=close]'); await page.waitForSelector('#dlg[open]', { state: 'detached', timeout: 10000 }).catch(() => {}); } }
// gate 1D: the header link back to the shell, and whether the hand-over notice is showing
const handoverState = (page) => page.evaluate(() => ({
  back: (document.querySelector('a[data-cc-back]') || {}).href || null,
  notice: !!document.querySelector('[data-handover]'),
  device: (() => { try { return JSON.parse(localStorage.getItem('eveniunt-command-center-device') || 'null'); } catch (e) { return 'unreadable'; } })()
}));
async function solve(page) {
  const want = FIX.cases.find((c) => c.recipeId === 38200);
  const job = await page.evaluate(() => window.__atelier.call('recipe', 38200, 'en').job);
  await page.click(`[data-act=job][data-v="${job}"]`);
  for (const [k, v] of Object.entries({ craftsmanship: want.stats[0], control: want.stats[1], cp: want.stats[2] })) {
    await page.fill(`[data-stat=${k}]`, String(v)); await page.dispatchEvent(`[data-stat=${k}]`, 'change');
  }
  await page.evaluate(() => { window.__atelier.S.savedCfg.loadFromSaved = false; });
  await page.locator('[data-act=recipe][data-v="38200"]').first().click();
  const t0 = Date.now();
  await page.click('[data-act=solve]');
  await page.waitForFunction(() => window.__atelier.S.result && !window.__atelier.S.solving, null, { timeout: 300000 });
  const r = await page.evaluate(() => { const x = window.__atelier.S.result; return { error: x.error || null, quality: x.v && x.v.quality, steps: x.actions && x.actions.length }; });
  return Object.assign(r, { seconds: +((Date.now() - t0) / 1000).toFixed(1), threads: await page.evaluate(() => window.__atelier.threads()), wantQuality: want.quality });
}
async function trackerSetup(page) {
  await page.waitForSelector('#dlg[open]', { timeout: 30000 });
  await page.selectOption('#nchars', '2');
  await page.fill('[data-name="0"]', 'Alba Eveniunt'); await page.fill('[data-name="1"]', 'Brio Eveniunt');
  await page.click('#go');
  await page.waitForSelector('.ov-table', { timeout: 30000 });
}
const trackerState = (page) => page.evaluate(() => ({
  url: location.href,
  isolated: self.crossOriginIsolated,
  overview: !!document.querySelector('.ov-table'),
  chars: window.__tracker && window.__tracker.ST ? window.__tracker.ST.chars.length : 0,
  controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL
}));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const get = (url) => new Promise((ok, no) => http.get(url, (res) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: Buffer.concat(b) })); }).on('error', no));
// Firefox's Playwright build takes no touch or mobile emulation; the other two engines do
const PHONE = BROWSER === 'firefox' ? { viewport: { width: 390, height: 844 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SHOT = BROWSER === 'chromium'; // screenshots come from the Chromium run only

(async () => {
  if (!fs.existsSync(path.join(CC, 'site', 'sw.js'))) { console.error('run node command-center/build.js first'); process.exit(2); }
  const ev = path.join(CC, 'evidence'); fs.mkdirSync(ev, { recursive: true });
  const file = process.env.CHECK_ONLY ? 'checks-only.json' : BROWSER === 'chromium' ? 'checks.json' : 'checks-' + BROWSER + '.json';
  try { browser = await engine.launch(); } catch (err) {
    // an engine Playwright knows but that is not installed here: record the attempt plainly, never as a pass
    const reason = 'engine not installed in this session: ' + String(err.message || err).split('\n')[0];
    fs.writeFileSync(path.join(ev, file), JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: BROWSER, playwright: require('playwright/package.json').version, node: process.version,
      passed: 0, total: 0, notRun: ['all checks: ' + reason], results: [] }, null, 2) + '\n');
    console.error('NOT RUN (' + BROWSER + '): ' + reason + '; evidence/' + file + ' written');
    process.exit(3);
  }
  let server;
  try { server = await start(PORT); } catch (err) { console.error(err.message); await browser.close(); process.exit(2); }
  const version = browser.version();
  try {
    // ── C1 the shell is not isolated, and its own worker controls it ──
    await guard('C1', async () => {
      const { ctx, errors, external } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      const first = await shellState(page);
      await page.reload(); await shellControlled(page);
      const again = await shellState(page);
      if (SHOT) await page.screenshot({ path: path.join(ev, 'shell-desktop.png') });
      const ok = first.isolated === false && again.isolated === false && again.controller === ROOT + 'sw.js' &&
        JSON.stringify(again.modules) === '["Home","Tracker","Atelier","Submersibles","Lists","⚙ Settings"]' && again.cards === 4 && real(errors).length === 0;
      record('C1', 'The shell is not cross-origin isolated (Google sign-in can work here) and its site-wide worker controls it', ok, { first, again, errors: real(errors), external });
      await ctx.close();
    });

    // ── C2 / C3 / C4: one browser profile, as a person would use it ──
    await guard('C2-C4', async () => {
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      // C2: shell → Atelier through the home card
      page.__navs.length = 0;
      await page.click('.modules a[data-module="atelier"]');
      const a = await atelierState(page);
      const navsToAtelier = page.__navs.filter((u) => u.startsWith(ROOT + 'atelier/')).length;
      const aHand = await handoverState(page); // opened from the shell: the way back, no hand-over notice
      const solved = await solve(page);
      await waitOwnWorker(page, 'atelier');
      const after = await page.evaluate(() => ({ isolated: self.crossOriginIsolated, controller: navigator.serviceWorker.controller.scriptURL }));
      record('C2', 'The Atelier opened from the shell is isolated, runs more than one thread and solves, with no extra reload and no hand-over notice', a.isolated === true && a.threads > 1 &&
        navsToAtelier === 1 && !solved.error && solved.quality >= solved.wantQuality && solved.threads > 1 && after.isolated === true && aHand.back === ROOT && !aHand.notice,
      { atelierOnArrival: a, navigationsToAtelier: navsToAtelier, handover: aHand, solve: solved, afterOwnWorkerTookOver: after });
      // back to the shell with the browser's Back button
      await page.goBack(); await page.waitForSelector('.modules');
      const back = await shellState(page);
      record('C2b', 'Back from the Atelier returns to the shell, which is still not isolated', back.isolated === false && back.url === ROOT, back);
      // C3: shell → Tracker through the module switcher
      await page.click('.switcher a[data-module="tracker"]');
      await trackerSetup(page);
      await waitOwnWorker(page, 'tracker');
      const t = await trackerState(page), tHand = await handoverState(page);
      record('C3', 'The Tracker opened from the shell works (not isolated, characters set up, overview shown), with the way back and no hand-over notice',
        t.isolated === false && t.overview && t.url === ROOT + 'tracker/' && tHand.back === ROOT && !tHand.notice, { tracker: t, handover: tHand });
      // C4: offline, everything opened once still works
      await ctx.setOffline(true);
      await page.goto(ROOT); await page.waitForSelector('.modules');
      const sOff = await shellState(page);
      await page.click('.switcher a[data-module="tracker"]'); await page.waitForSelector('.ov-table', { timeout: 30000 });
      const tOff = await trackerState(page);
      await page.goto(ROOT + 'atelier/');
      const aOff = await atelierState(page);
      await ctx.setOffline(false);
      record('C4', 'Offline after one visit: the shell, the Tracker (with its save) and the Atelier (isolated, multi-thread) open', sOff.cards === 4 && tOff.overview && tOff.isolated === false && aOff.isolated === true && aOff.threads > 1,
        { shell: sOff, tracker: tOff, atelier: aOff });
      record('C2-4 errors', 'No page or console errors in that profile', real(errors).length === 0, real(errors));
      await ctx.close();
    });

    // ── C5 offline, a module never opened on this device: a clear note, not a browser error ──
    await guard('C5', async () => {
      const { ctx } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      await ctx.setOffline(true);
      await page.click('.modules a[data-module="atelier"]');
      await page.waitForLoadState('domcontentloaded');
      const note = await page.evaluate(() => ({ h1: document.querySelector('h1') && document.querySelector('h1').textContent, back: !!document.querySelector('a[href]') }));
      await page.click('a[href]'); await page.waitForSelector('.modules');
      const s = await shellState(page);
      record('C5', 'Offline, a module never opened shows a short note with a way back to the shell', note.h1 === 'You are offline' && note.back && s.cards === 4, { note, shellAfter: s.url });
      await ctx.close();
    });

    // ── C6 today's pages, opened directly as today (installed apps and bookmarks), with no shell involved ──
    await guard('C6', async () => {
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT + 'atelier/');
      const a = await atelierState(page, { expectIsolated: true }); await waitOwnWorker(page, 'atelier');
      a.pageLoads = page.__navs.filter((u) => u.startsWith(ROOT + 'atelier/')).length; // the arrival plus the one reload
      a.reloadMark = await page.evaluate(() => sessionStorage.getItem('atelier-coi-reload'));
      a.controller = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);
      await ctx.setOffline(true); await page.reload();
      const aOff = await atelierState(page);
      await ctx.setOffline(false);
      record('C6a', "Today's Atelier opened directly: isolated with more than one thread after exactly one reload under its own worker, and offline",
        a.isolated && a.threads > 1 && a.pageLoads === 2 && a.reloadMark === '1' && a.controller === ROOT + 'atelier/sw.js' && aOff.isolated && aOff.threads > 1, { online: a, offline: aOff });
      const p2 = await ctx.newPage();
      await p2.goto(ROOT + 'tracker/'); await trackerSetup(p2); await waitOwnWorker(p2, 'tracker');
      await ctx.setOffline(true); await p2.reload(); await p2.waitForSelector('.ov-table', { timeout: 30000 });
      const tOff = await trackerState(p2);
      await ctx.setOffline(false);
      record('C6b', "Today's Tracker opened directly: works, and offline with its save", tOff.overview && tOff.isolated === false, tOff);
      record('C6 errors', 'No page or console errors', real(errors).length === 0, real(errors));
      await ctx.close();
    });

    // ── C7 apps already installed before the shell existed: the shell's worker does not take them over ──
    await guard('C7', async () => {
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT + 'atelier/'); await atelierState(page, { expectIsolated: true }); await waitOwnWorker(page, 'atelier');
      await page.goto(ROOT + 'tracker/'); await trackerSetup(page); await waitOwnWorker(page, 'tracker');
      await page.goto(ROOT); await shellControlled(page);
      const regs = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope).sort());
      await page.goto(ROOT + 'atelier/'); const a = await atelierState(page); const aHand = await handoverState(page);
      await page.goto(ROOT + 'tracker/'); await page.waitForSelector('.ov-table'); const t = await trackerState(page); const tHand = await handoverState(page);
      record('C7', 'With both apps already installed, adding the shell leaves each app under its own worker, Atelier isolated and multi-thread, each with the way back',
        regs.length === 3 && a.controller === ROOT + 'atelier/sw.js' && a.isolated && a.threads > 1 && t.controller === ROOT + 'tracker/sw.js' && t.overview &&
        aHand.back === ROOT && tHand.back === ROOT && real(errors).length === 0,
        { registrations: regs, atelier: a, tracker: t, waysBack: { atelier: aHand.back, tracker: tHand.back }, errors: real(errors) });
      await ctx.close();
    });

    // ── C8 the shell is installable; C9 phone width has no sideways scrolling ──
    await guard('C8-C9', async () => {
      if (BROWSER === 'chromium') {
        const { ctx } = await context();
        const page = await ctx.newPage();
        await page.goto(ROOT); await shellControlled(page);
        const cdp = await ctx.newCDPSession(page);
        const inst = await cdp.send('Page.getInstallabilityErrors');
        if (inst.installabilityErrors.some((x) => x.errorId === 'in-incognito')) skip('C8', 'The shell is installable as an app', 'the managed Chromium session reports in-incognito and suppresses PWA installability; installability is not assessable in this browser context');
        else record('C8', 'The shell is installable as an app', inst.installabilityErrors.length === 0, inst);
        await ctx.close();
      } else {
        skip('C8', 'The shell is installable as an app', 'Chromium-only interface (Page.getInstallabilityErrors); ' + BROWSER + ' offers no installability report');
      }
      const ph = await context(PHONE);
      const pp = await ph.ctx.newPage();
      await pp.goto(ROOT); await pp.waitForSelector('.modules');
      const w = await pp.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      if (SHOT) await pp.screenshot({ path: path.join(ev, 'shell-phone.png'), fullPage: true });
      // gate 1D: the apps at phone width keep the header link and show the notice without sideways scrolling; since
      // 2026-11-12 the link reads "Main menu" at every width (owner request)
      await pp.goto(ROOT + 'tracker/'); await trackerSetup(pp);
      const tw = await pp.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
        back: !!document.querySelector('a[data-cc-back]'), labelShown: getComputedStyle(document.querySelector('a[data-cc-back] .cc-txt')).display !== 'none' && /Main menu/.test(document.querySelector('a[data-cc-back]').textContent), notice: !!document.querySelector('[data-handover]') }));
      if (SHOT) await pp.screenshot({ path: path.join(ev, 'tracker-phone-handover.png') });
      record('C9', 'Phone width (390 px): no sideways scrolling in the shell or in the Tracker with its header link and hand-over notice',
        w.scroll <= w.client && tw.scroll <= tw.client && tw.back && tw.labelShown && tw.notice, { shell: w, tracker: tw });
      await ph.ctx.close();
    });

    // ── C10 the test site serves both apps' current builds byte for byte, with no isolation headers from the server ──
    // (gate 1B checked that neither app changed; gates 1C and 1D change both on purpose)
    await guard('C10', async () => {
      const served = [];
      for (const [prefix, dir] of MOUNTS.slice(0, 2)) {
        for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) {
          const r = await get('http://127.0.0.1:' + PORT + prefix + f);
          served.push({ file: prefix + f, same: r.status === 200 && sha(r.body) === sha(fs.readFileSync(path.join(dir, f))), isolationHeaders: !!r.headers['cross-origin-embedder-policy'] });
        }
      }
      record('C10', 'The test site serves both apps\' current builds byte for byte, with no isolation headers from the server', served.every((x) => x.same && !x.isolationHeaders), { served });
    });

    // ── C11 gate 1C: one save for the shell and both modules, moved in by copying ──
    await guard('C11', async () => {
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      // today's data, as the versions before gate 1C kept it: the Tracker in IndexedDB, the Atelier in localStorage
      const seeded = await page.evaluate(() => new Promise((res) => {
        const st = { v: 1, chars: [{ id: 'c1', name: 'Alba', lodestone: '12345678', cls: 'gla', gc: 1 }, { id: 'c2', name: 'Brio', lodestone: null, cls: null, city: 'uld', gc: 2 }],
          ticks: { c1: { 'mounts:1': 1, 'minions:2': 1 }, c2: { 'mounts:1': 1 } }, excl: { c1: {}, c2: { 'quests-msq-arr:65564': 1 } }, vals: { c1: {}, c2: {} }, avail: {},
          settings: { countLimited: false, countGone: false, countUnknown: false, links: true, gold: true }, sync: { fc: {}, drive: null, backupAt: null }, updated: 1 };
        const old = { stats: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ level: 100, craftsmanship: 5555, control: 5000, cp: 600, manipulation: true })), food: null, potion: null, cosmicTool: true,
          saved: [{ id: 's1', name: 'Kept macro', actions: ['MuscleMemory'], job: 0 }], history: [] };
        localStorage.setItem('eveniunt-atelier-v1', JSON.stringify(old));
        const r = indexedDB.open('eveniunt-tracker', 1); r.onupgradeneeded = () => r.result.createObjectStore('state');
        r.onsuccess = () => { const t = r.result.transaction('state', 'readwrite'); t.objectStore('state').put(st, 'main'); t.oncomplete = () => { r.result.close(); res({ tracker: JSON.stringify(st), atelier: localStorage.getItem('eveniunt-atelier-v1') }); }; };
      }));
      // the Tracker copies its save in
      await page.click('.switcher a[data-module="tracker"]');
      await page.waitForFunction(() => window.__tracker && window.__tracker.ST && !document.getElementById('boot'), null, { timeout: 30000 });
      const tracker = await page.evaluate(() => ({ chars: window.__tracker.ST.chars.map((c) => c.name), ticks: Object.keys(window.__tracker.ST.ticks.c1).length, moved: window.__tracker.ST.moved.tracker }));
      // the Atelier asks whose its stats are, then keeps each character's stats
      await page.goto(ROOT + 'atelier/');
      const a = await atelierState(page);
      await page.waitForSelector('#dlg[open]');
      const asked = await page.textContent('#dlg');
      await page.click('[data-d="own:c1"]');
      await page.selectOption('#crafter-char', 'c2');
      const brio = await page.evaluate(() => window.__atelier.S.stats[0].craftsmanship);
      await page.selectOption('#crafter-char', 'c1');
      const alba = await page.evaluate(() => window.__atelier.S.stats[0].craftsmanship);
      await page.evaluate(() => window.__atelier.flush());
      // the shell shows the shared characters
      await page.goto(ROOT); await page.waitForSelector('#save:not([hidden])');
      const shown = await page.$$eval('#save .chars li', (l) => l.map((x) => x.textContent));
      const after = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('eveniunt-tracker'); r.onsuccess = () => { const g = r.result.transaction('state').objectStore('state').get('main'); g.onsuccess = () => { r.result.close(); res({ tracker: JSON.stringify(g.result), atelier: localStorage.getItem('eveniunt-atelier-v1') }); }; }; }));
      const doc = await page.evaluate(() => CC.read().then((r) => r.raw));
      const ok = tracker.chars.join() === 'Alba,Brio' && tracker.ticks === 2 && tracker.moved.from === 'indexeddb' &&
        a.isolated && a.threads > 1 && /Whose crafter stats/.test(asked) && alba === 5555 && brio === 4900 && shown.join() === 'Alba,Brio' &&
        after.tracker === seeded.tracker && after.atelier === seeded.atelier &&
        Object.keys(doc.modules.tracker.ticks.c1).length === 2 && doc.modules.atelier.chars.c1.stats.j0.craftsmanship === 5555 && doc.modules.atelier.saved.s1.name === 'Kept macro' &&
        real(errors).length === 0;
      record('C11', 'One save for the shell and both modules: the Tracker copies its save in, the Atelier asks once and keeps each character\'s stats (still isolated, multi-thread), the shell shows the characters, the old data is untouched',
        ok, { tracker, atelier: { isolated: a.isolated, threads: a.threads, alba, brio }, shell: shown, oldDataUntouched: after.tracker === seeded.tracker && after.atelier === seeded.atelier,
          save: { chars: doc.chars.map((c) => c.name), modules: Object.keys(doc.modules), moved: Object.keys(doc.moved) }, errors: real(errors) });
      await ctx.close();
    });

    // ── C12 gate 1D, rule 5: apps installed before the shell existed keep working offline after it arrives, and hand over ──
    await guard('C12', async () => {
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      // both apps installed on their own, before the shell: each under its own worker, with its offline copy
      await page.goto(ROOT + 'atelier/'); await atelierState(page, { expectIsolated: true }); await waitOwnWorker(page, 'atelier');
      await page.goto(ROOT + 'tracker/'); await trackerSetup(page); await waitOwnWorker(page, 'tracker');
      // the new root app arrives
      await page.goto(ROOT); await shellControlled(page);
      // offline: both still open under their own workers, with the way back and the hand-over notice
      await ctx.setOffline(true);
      await page.goto(ROOT + 'tracker/'); await page.waitForSelector('.ov-table', { timeout: 30000 });
      const tOff = Object.assign(await trackerState(page), await handoverState(page));
      if (SHOT) await page.screenshot({ path: path.join(ev, 'tracker-handover.png') });
      await page.goto(ROOT + 'atelier/');
      const aOff = Object.assign(await atelierState(page), await handoverState(page));
      await notNow(page); // the gate 1C question comes first, since the Tracker set up characters after the Atelier's first opening
      if (SHOT) await page.screenshot({ path: path.join(ev, 'atelier-handover.png') });
      await ctx.setOffline(false);
      // "Got it" in one app records it for both
      await page.click('[data-handover-ok]');
      const gotIt = await handoverState(page);
      await page.goto(ROOT + 'tracker/'); await page.waitForSelector('.ov-table'); const tSeen = await handoverState(page);
      await page.goto(ROOT + 'atelier/'); await atelierState(page); await notNow(page); const aSeen = await handoverState(page);
      // with that record cleared, installing the Command Center ends the notice too (the shell writes the mark)
      await page.evaluate((k) => localStorage.removeItem(k), DEVICE_KEY);
      await page.goto(ROOT + 'tracker/'); await page.waitForSelector('.ov-table'); const tAgain = await handoverState(page);
      await page.goto(ROOT); await shellControlled(page); await page.evaluate(() => window.__commandCenter.markInstalled());
      await page.goto(ROOT + 'tracker/'); await page.waitForSelector('.ov-table'); const tInst = Object.assign(await trackerState(page), await handoverState(page));
      await page.goto(ROOT + 'atelier/'); await atelierState(page); await notNow(page); const aInst = await handoverState(page);
      const ok = tOff.overview && tOff.chars === 2 && tOff.controller === ROOT + 'tracker/sw.js' && tOff.back === ROOT && tOff.notice &&
        aOff.isolated && aOff.threads > 1 && aOff.controller === ROOT + 'atelier/sw.js' && aOff.back === ROOT && aOff.notice &&
        !gotIt.notice && gotIt.device && gotIt.device.handoverSeen > 0 && !tSeen.notice && !aSeen.notice && tSeen.back === ROOT &&
        tAgain.notice && tInst.device && tInst.device.installed > 0 && !tInst.notice && tInst.back === ROOT && tInst.chars === 2 && !aInst.notice && aInst.back === ROOT &&
        real(errors).length === 0;
      record('C12', 'Apps installed before the shell keep working offline after it arrives (own workers, save kept, Atelier isolated and multi-thread), show the way back and the hand-over notice; "Got it" or installing the Command Center ends the notice in both, and the link stays',
        ok, { offline: { tracker: tOff, atelier: aOff }, gotIt, afterGotIt: { tracker: tSeen, atelier: aSeen }, recordCleared: tAgain, afterInstall: { tracker: tInst, atelier: aInst }, errors: real(errors) });
      await ctx.close();
    });

    // ── C13 gate 1D, F1 second half: the Atelier's reload rule under a root worker that does NOT isolate atelier/ ──
    await guard('C13', async () => {
      const server2 = await start(PORT2, { rootSw: path.join(CC, 'fixtures', 'naive-root-sw.js') });
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT2); await shellControlled(page);
      // the naive root worker controls the site and sends the Atelier's page without isolation headers
      const probe = await page.evaluate(async (u) => { const r = await fetch(u); return { status: r.status, coep: r.headers.get('cross-origin-embedder-policy'), coop: r.headers.get('cross-origin-opener-policy') }; }, ROOT2 + 'atelier/');
      page.__navs.length = 0;
      await page.click('.modules a[data-module="atelier"]');
      const a = await atelierState(page, { expectIsolated: true }); await waitOwnWorker(page, 'atelier');
      const navs = page.__navs.filter((u) => u.startsWith(ROOT2 + 'atelier/')).length;
      const after = await page.evaluate(() => ({ isolated: self.crossOriginIsolated, threads: window.__atelier.threads(), controller: navigator.serviceWorker.controller.scriptURL, reloadMark: sessionStorage.getItem('atelier-coi-reload') }));
      // a second tab in the same profile: the Atelier's own worker already controls atelier/, so it arrives isolated with no reload
      const p2 = await ctx.newPage();
      await p2.goto(ROOT2 + 'atelier/'); const b = await atelierState(p2);
      const navs2 = p2.__navs.filter((u) => u.startsWith(ROOT2 + 'atelier/')).length;
      const ok = probe.status === 200 && probe.coep === null && probe.coop === null &&
        after.isolated === true && after.threads > 1 && after.controller === ROOT2 + 'atelier/sw.js' && navs === 2 && after.reloadMark === '1' &&
        b.isolated === true && b.threads > 1 && navs2 === 1 && real(errors).length === 0;
      record('C13', 'Under a site-wide worker that does not isolate atelier/, the Atelier\'s first visit still ends isolated with more than one thread, under its own worker, after exactly one reload; a second tab needs none',
        ok, { rootWorkerProbe: probe, arrival: a, afterOwnWorker: after, navigationsToAtelier: navs, secondTab: Object.assign(b, { navigations: navs2 }), errors: real(errors) });
      await ctx.close(); server2.close();
    });

    // ── C14 gate 1D: the way back to the shell from inside each app ──
    await guard('C14', async () => {
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      await page.click('.switcher a[data-module="tracker"]'); await trackerSetup(page);
      const tHand = await handoverState(page);
      await page.click('a[data-cc-back]'); await page.waitForSelector('.modules'); const s1 = await shellState(page);
      await page.click('.modules a[data-module="atelier"]'); await atelierState(page); await notNow(page);
      const aHand = await handoverState(page);
      await page.click('a[data-cc-back]'); await page.waitForSelector('.modules'); const s2 = await shellState(page);
      await ctx.close();
      // the Atelier opened directly, the shell never visited on this device: the link still opens the shell
      const c2 = await context(); const p = await c2.ctx.newPage();
      await p.goto(ROOT + 'atelier/'); await p.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 });
      await p.waitForSelector('a[data-cc-back]');
      // a first visit reloads the Atelier once, when its worker takes the page; a click before that reload is cancelled by it
      await p.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 60000 });
      await p.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 });
      await p.waitForSelector('a[data-cc-back]');
      const dHand = await handoverState(p);
      await p.click('a[data-cc-back]'); await p.waitForSelector('.modules'); const s3 = await shellState(p);
      const ok = tHand.back === ROOT && s1.url === ROOT && s1.isolated === false && s1.cards === 4 &&
        aHand.back === ROOT && s2.url === ROOT && s2.isolated === false && s2.cards === 4 &&
        dHand.back === ROOT && s3.url === ROOT && s3.isolated === false && s3.cards === 4 && real(errors).length === 0 && real(c2.errors).length === 0;
      record('C14', 'The header link brings the owner back to the shell from the Tracker and from the Atelier, also from an Atelier opened directly with the shell never visited; the shell is not isolated each time',
        ok, { fromTracker: { link: tHand.back, shell: s1 }, fromAtelier: { link: aHand.back, shell: s2 }, fromAtelierOpenedDirectly: { link: dHand.back, shell: s3 }, errors: real(errors).concat(real(c2.errors)) });
      await c2.ctx.close();
    });

    // ── C15 gate 1E: the shell has its own icons and manifest, told apart from the Tracker's and the Atelier's ──
    await guard('C15', async () => {
      const shellIcons = path.join(CC, 'site', 'icons'), trackerIcons = path.join(T, 'site', 'icons'), atelierIcons = path.join(ATELIER_SRC, 'site', 'icons');
      const names = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
      const distinct = names.map((n) => ({ icon: n, present: fs.existsSync(path.join(shellIcons, n)),
        differsFromTracker: fs.existsSync(path.join(shellIcons, n)) && sha(fs.readFileSync(path.join(shellIcons, n))) !== sha(fs.readFileSync(path.join(trackerIcons, n))),
        differsFromAtelier: fs.existsSync(path.join(shellIcons, n)) && sha(fs.readFileSync(path.join(shellIcons, n))) !== sha(fs.readFileSync(path.join(atelierIcons, n))) }));
      const manifest = JSON.parse(fs.readFileSync(path.join(CC, 'site', 'manifest.webmanifest'), 'utf8'));
      const { ctx } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      const served = await page.evaluate(async (icons) => { const out = []; for (const i of icons) { const r = await fetch(i.src); out.push({ src: i.src, status: r.status, type: r.headers.get('content-type') }); } return out; }, manifest.icons);
      const head = await page.evaluate(() => ({ icon: (document.querySelector('link[rel="icon"]') || {}).href, apple: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href, manifest: (document.querySelector('link[rel="manifest"]') || {}).href }));
      await ctx.close();
      const ok = distinct.every((d) => d.present && d.differsFromTracker && d.differsFromAtelier) && manifest.name === 'Eveniunt Command Center' && manifest.icons.length === 3 &&
        served.every((x) => x.status === 200 && /image\/png/.test(x.type)) && head.icon === ROOT + 'icons/icon-192.png' && head.apple === ROOT + 'icons/apple-touch-icon.png' && head.manifest === ROOT + 'manifest.webmanifest';
      record('C15', "The shell has its own icons and manifest (gate 1E), different from the Tracker's and the Atelier's, and the browser can load every one", ok, { distinct, manifest: { name: manifest.name, icons: manifest.icons.map((i) => i.src) }, served, head });
    });

    // ── C16 gate 1E, rule 10: the published layout. The repository's files (as Git would check them out) are copied to a
    //    scratch folder, the Pages workflow's own "Assemble the site" commands build _site from it, and a browser opens it. ──
    await guard('C16', async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-publish-'));
      const detail = { scratch: path.basename(tmp) }; // the folder's own name only: no absolute path in the evidence
      let site = null, server3 = null;
      try {
        const REPO = path.join(T, '..');
        execFileSync('bash', ['-c', 'git ls-files -z --cached --others --exclude-standard | tar --null -T - -cf - | tar -xf - -C "$0"', tmp], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
        detail.copied = execFileSync('bash', ['-c', 'find . -type f | wc -l'], { cwd: tmp, encoding: 'utf8' }).trim();
        const yml = fs.readFileSync(path.join(tmp, '.github', 'workflows', 'pages.yml'), 'utf8');
        const m = /- name: Assemble the site\n\s+run: \|\n([\s\S]*?)\n\s+- name:/.exec(yml);
        if (!m) throw new Error('"Assemble the site" step not found in pages.yml');
        const assemble = m[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
        execFileSync('bash', ['-c', assemble], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
        site = path.join(tmp, '_site');
        // the hourly job's fresh lists land on the Tracker's paths, which its worker serves network first (news and events keep working)
        detail.freshLists = { workflowWrites: ['_site/tracker/timers.json', '_site/tracker/$f.xml'].every((p) => yml.includes(p)), trackerWorkerServes: /timers\\.json\|news\\.xml\|topics\\.xml/.test(fs.readFileSync(path.join(T, 'site', 'sw.js'), 'utf8')) };
        // byte for byte: the root is the shell, the modules are the committed builds, the four Cosmic pages are there
        const same = (a, b) => sha(fs.readFileSync(a)) === sha(fs.readFileSync(b));
        detail.files = {
          root: same(path.join(site, 'index.html'), path.join(CC, 'site', 'index.html')) && same(path.join(site, 'sw.js'), path.join(CC, 'site', 'sw.js')) && same(path.join(site, 'manifest.webmanifest'), path.join(CC, 'site', 'manifest.webmanifest')),
          tracker: same(path.join(site, 'tracker', 'index.html'), path.join(T, 'site', 'index.html')) && same(path.join(site, 'tracker', 'sw.js'), path.join(T, 'site', 'sw.js')),
          atelier: same(path.join(site, 'atelier', 'index.html'), path.join(ATELIER_SRC, 'site', 'index.html')) && same(path.join(site, 'atelier', 'sw.js'), path.join(ATELIER_SRC, 'site', 'sw.js')),
          cosmic: ['sinus-ardorum', 'phaenna', 'oizys', 'auxesia'].every((c) => fs.existsSync(path.join(site, 'cosmic', 'cosmic-' + c + '.html'))),
          oldFrontPageGone: !fs.existsSync(path.join(site, 'assets')) && !fs.existsSync(path.join(tmp, 'web')),
          privateRecordsAbsent: !fs.existsSync(path.join(tmp, 'tracker', '.ai')) && !fs.existsSync(path.join(tmp, 'crafting', '.ai')) && !fs.existsSync(path.join(tmp, 'tracker', 'CLAUDE.md'))
        };
        // every file the shell's worker saves for offline use exists in the published site
        const files = JSON.parse(/const FILES = (\[[^\n]*\]);/.exec(fs.readFileSync(path.join(site, 'sw.js'), 'utf8'))[1]);
        detail.workerFiles = { count: files.length, missing: files.filter((f) => !fs.existsSync(path.join(site, f === './' ? 'index.html' : f))) };
        // serve _site like GitHub Pages and open it
        server3 = await new Promise((ok) => { const srv = http.createServer((req, res) => {
          const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
          if (!p.startsWith(BASE)) { res.writeHead(404); return res.end(); }
          let file = path.normalize(path.join(site, p.slice(BASE.length)));
          if (!file.startsWith(site)) { res.writeHead(404); return res.end(); }
          if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
          if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
          const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
          res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(file).pipe(res);
        }); srv.listen(PORT3, '127.0.0.1', () => ok(srv)); });
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await page.goto(ROOT3); await shellControlled(page);
        detail.shell = await shellState(page);
        // every link on the home page resolves on the published site (modules, Cosmic pages, offline files, outside links left alone)
        const links = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
        const local = links.filter((h) => !/^https?:/.test(h));
        detail.links = { local: local.length, outside: links.length - local.length, broken: [] };
        for (const h of local) { const r = await get(ROOT3 + h); if (r.status !== 200) detail.links.broken.push({ href: h, status: r.status }); }
        // a Cosmic page opens from the home screen
        await page.click('.cosmic a[href$="cosmic-sinus-ardorum.html"]'); await page.waitForLoadState('domcontentloaded');
        detail.cosmic = { url: page.url(), title: await page.title() };
        await page.goBack(); await page.waitForSelector('.modules');
        // the Tracker opens from the published root and its own worker takes it
        await page.click('.switcher a[data-module="tracker"]'); await trackerSetup(page); await waitOwnWorker(page, 'tracker');
        detail.tracker = await trackerState(page);
        detail.errors = real(errors);
        await ctx.close();
      } catch (err) {
        detail.error = String(err.stderr || err.message || err).split('\n').slice(0, 6).join('\n');
      } finally {
        if (server3) server3.close();
        fs.rmSync(tmp, { recursive: true, force: true });
      }
      const f = detail.files || {};
      const ok = !detail.error && f.root && f.tracker && f.atelier && f.cosmic && f.oldFrontPageGone && f.privateRecordsAbsent && detail.freshLists.workflowWrites && detail.freshLists.trackerWorkerServes &&
        detail.workerFiles.missing.length === 0 && detail.shell && detail.shell.isolated === false && detail.shell.cards === 4 && detail.shell.controller === ROOT3 + 'sw.js' &&
        detail.links.broken.length === 0 && /Sinus Ardorum/.test(detail.cosmic.title) && detail.tracker.overview && detail.tracker.controller === ROOT3 + 'tracker/sw.js' && detail.errors.length === 0;
      record('C16', 'The published layout (gate 1E): the repository\'s files and the Pages workflow\'s own assemble step put the shell at the root with its worker, the modules at their addresses, the four Cosmic pages and the fresh-list paths; every home-page link resolves and the Tracker opens from it', ok, detail);
    });

    // ── C17 to C19 gate 1E: cloud sync through OneDrive and the sync helper, against stand-ins for Microsoft's sign-in,
    //    the helper (the real helper/worker.js, in this process) and OneDrive (tests/standins.js) ──
    await guard('C17-C19', async () => {
      const server4 = await start(PORT4, { standins: true });
      const st = server4.standins;
      const syncText = () => ((document.querySelector('#sync-state') || {}).textContent || '');
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT4); await shellControlled(page);
      await page.click('.switcher a[data-module="tracker"]'); await trackerSetup(page); await waitOwnWorker(page, 'tracker');
      // C17: the first sign-in on a device, from the Tracker opened through the shell
      const before = { devices: st.kv.size, file: !!st.state.files.f1 };
      await page.evaluate(() => window.__tracker.openSettings('cloud'));
      const panelBefore = await page.textContent('#dlg');
      page.__navs.length = 0;
      await page.click('#sync-in');
      await page.waitForFunction(() => /Synced \d/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
      const after = { url: page.url(), devices: st.kv.size, file: !!st.state.files.f1, grants: st.state.log.slice(), navs: page.__navs.slice(), status: await page.evaluate(syncText),
        device: await page.evaluate(() => (JSON.parse(localStorage.getItem('eveniunt-cloud-device') || '{}') || {}).device || null) };
      const leaks = await page.evaluate(async (dev) => { const file = ET.exportFile(window.__tracker.ST); const code = await ET.makeTransferCode(window.__tracker.ST); const raw = JSON.stringify((await CC.read()).raw || {}); return { backup: file.includes(dev), code: code.includes(dev), save: raw.includes(dev) }; }, after.device);
      const cloudCopy = JSON.stringify(st.state.files.f1 || {});
      record('C17', 'First sign-in on a device: one tap takes the Tracker to Microsoft\'s sign-in and back through oauth.html, the helper keeps the device, the cloud copy is created and the status line says Synced; the device handle is in no backup, transfer code, save or cloud copy',
        before.devices === 0 && !before.file && /not signed in/.test(panelBefore) && after.url === ROOT4 + 'tracker/' && after.devices === 1 && after.file && after.grants.join() === 'authorization_code' &&
        after.navs.some((u) => u.includes('/tracker/oauth.html?code=')) && /^[0-9a-f]{64}$/.test(after.device || '') && /Synced \d/.test(after.status) &&
        !leaks.backup && !leaks.code && !leaks.save && !cloudCopy.includes(after.device) && real(errors).length === 0,
        { before, after: Object.assign({}, after, { device: after.device ? after.device.slice(0, 8) + '…' : null }), leaks, errors: real(errors) });
      // C18: a new sitting on the same device: the tab's key is gone; the Tracker gets a fresh key from the helper and syncs by itself, with no sign-in page
      await page.evaluate(() => sessionStorage.clear());
      const grants0 = st.state.log.length; page.__navs.length = 0;
      await page.reload(); await page.waitForSelector('.ov-table');
      await page.waitForFunction(() => /Synced \d/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
      await page.evaluate(() => window.__tracker.openSettings('cloud'));
      const panelSigned = await page.textContent('#dlg');
      await page.evaluate(() => window.__tracker.closeDialog());
      // the other device changed the copy meanwhile: the next sync takes the change, and OneDrive's "write only if unchanged" is honoured
      const other = JSON.parse(JSON.stringify(await page.evaluate(() => ET.portable(window.__tracker.ST))));
      other.chars[1].name = 'Brio renamed elsewhere';
      st.state.files.f1 = Object.assign({ app: 'eveniunt-completionist-tracker', v: 1 }, other); st.state.etag.f1 = 'e-other';
      await page.evaluate(() => window.__tracker.syncCloud(true));
      await page.waitForFunction(() => window.__tracker.ST.chars[1].name === 'Brio renamed elsewhere', null, { timeout: 30000 });
      const quiet = { grants: st.state.log.slice(grants0), navs: page.__navs.slice(), panel: panelSigned.slice(0, 400), renamed: await page.evaluate(() => window.__tracker.ST.chars[1].name), etagAfter: st.state.etag.f1 };
      record('C18', 'A new sitting on a signed-in device: no sign-in page, one quiet renewal through the helper, the status line says Synced, the panel says the device syncs by itself; a change made on another device arrives on the next sync',
        quiet.grants.join() === 'refresh_token,refresh_token' || quiet.grants.join() === 'refresh_token' ? (quiet.navs.filter((u) => u.includes('/login/')).length === 0 && /This device is signed in/.test(panelSigned) && /syncs by itself/.test(panelSigned) && quiet.renamed === 'Brio renamed elsewhere' && quiet.etagAfter !== 'e-other' && real(errors).length === 0) : false,
        Object.assign(quiet, { errors: real(errors) }));
      // C19: the sign-in ended (revoked in the Microsoft account, or the helper forgot the device): one tap is asked for, nothing else happens by itself
      st.state.revoked = true;
      await page.evaluate(() => sessionStorage.clear());
      await page.reload(); await page.waitForSelector('.ov-table');
      await page.waitForFunction(() => /tap to sign in/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
      const ended = { status: await page.evaluate(syncText), devices: st.kv.size, deviceRecord: await page.evaluate(() => localStorage.getItem('eveniunt-cloud-device')), file: !!st.state.files.f1 };
      await page.evaluate(() => window.__tracker.openSettings('cloud'));
      const endedPanel = await page.textContent('#dlg'); ended.panel = endedPanel.slice(0, 400); ended.notSignedIn = /not signed in/.test(endedPanel); ended.offersSignIn = !!(await page.$('#sync-in'));
      await page.evaluate(() => window.__tracker.closeDialog());
      // and the tap works again; signing out on the device forgets it at the helper
      st.state.revoked = false;
      await page.evaluate(() => window.__tracker.openSettings('cloud')); await page.click('#sync-in');
      await page.waitForFunction(() => /Synced \d/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
      ended.signedInAgain = st.kv.size === 1;
      await page.evaluate(() => window.__tracker.openSettings('cloud')); await page.click('#sync-out');
      await page.waitForFunction(() => /Signed out on this device/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 10000 });
      ended.afterSignOut = { devices: st.kv.size, status: await page.evaluate(syncText) };
      record('C19', 'An ended sign-in asks for one tap and nothing else: the status line says so, the device record is gone, the cloud copy is untouched, the panel offers the sign-in; the tap works again, and signing out forgets the device at the helper',
        /tap to sign in/.test(ended.status) && ended.devices === 0 && ended.deviceRecord === null && ended.file && ended.notSignedIn && ended.offersSignIn && ended.signedInAgain && ended.afterSignOut.devices === 0 && /Signed out/.test(ended.afterSignOut.status) && real(errors).length === 0,
        Object.assign(ended, { errors: real(errors) }));
      await ctx.close(); server4.close();
    });
    // ── C20 to C25 Submersibles step S2: the module page in the shell's site, its setup, board, send, alerts, calendar
    //    entries and layouts. Invented names only. The page clock (Playwright page.clock) moves time past a return. ──
    await guard('C20-C25', async () => {
      const SUBS = ROOT + 'submersibles/';
      const ready = (page) => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const subsState = (page) => page.evaluate(() => ({
        url: location.href, isolated: self.crossOriginIsolated,
        controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
        back: (document.querySelector('.cc-back') || {}).href || null,
        tabs: [...document.querySelectorAll('.tabs [data-tab]')].map((b) => [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()),
        subs: [...document.querySelectorAll('.sub[data-status]')].map((x) => x.dataset.status),
        banners: [...document.querySelectorAll('.fleet-banner-text')].map((x) => x.textContent),
        bannerGap: (() => { const b = document.querySelector('.fleet-banners'), h = document.querySelector('header'); return b && h ? Math.round(b.getBoundingClientRect().top - h.getBoundingClientRect().bottom) : null; })(), // M15: the banner stands below the header
        title: document.title
      }));
      const saved = (page) => page.evaluate(async () => { const r = await CC.read(); return r.raw ? CC.checkDoc(r.raw).modules.submersibles || null : null; });
      const wroteOut = (page) => page.waitForFunction(() => window.__subs && window.__subs.state().ready && !document.querySelector('#sheet[open]'), null, { timeout: 10000 }).then(() => page.waitForTimeout(500));
      // the guided setup of one free company with four submarines (one already on a voyage), end to end through the page
      async function setupFc(page, name, opts = {}) {
        await page.click('[data-act=new]');
        await page.fill('[data-w="fc.name"]', name);
        await page.selectOption('[data-w="fc.world"]', 'Maduin');
        await page.click('[data-act=wnext]');
        const subs = opts.subs || [['Sub One', 50], ['Sub Two', 40], ['Sub Three', 30], ['Sub Four', 12]];
        for (let i = 0; i < subs.length; i++) {
          if (i > 0) await page.check('[data-w=unlocked]');
          await page.fill('[data-w=name]', subs[i][0]);
          await page.fill('[data-w=rank]', String(subs[i][1])); await page.press('[data-w=rank]', 'Tab');
          for (let j = 0; j < 4; j++) await page.selectOption(`select[data-w=part][data-j="${j}"]`, { index: 1 });
          if (i === 0 && opts.voyage) { await page.check('input[name=voy0][value=in]'); await page.fill('[data-w=voyIn]', opts.voyage); }
          await page.click('[data-act=wnext]');
        }
        // the sectors already discovered: tick seven more in the first sea
        for (const id of opts.tick || [3, 4, 5, 6, 7, 8, 9]) await page.check(`input[data-w=disc][value="${id}"]`);
        const unlockNote = await page.textContent('.wiz .note');
        await page.click('[data-act=wsave]');
        await page.waitForSelector('.fc');
        await wroteOut(page);
        return unlockNote;
      }

      // C20: opens from the shell and directly, not isolated, under the shell's site-wide worker, offline after one visit
      {
        const { ctx, errors, external } = await context();
        const page = await ctx.newPage();
        await page.goto(ROOT); await shellControlled(page);
        const shell = await shellState(page);
        await page.click('.switcher a[data-module="submersibles"]'); await ready(page);
        const fromShell = await subsState(page);
        await page.click('.cc-back'); await page.waitForSelector('.modules');
        const backHome = await shellState(page);
        await page.click('.modules a[data-module="submersibles"]'); await ready(page);
        await ctx.setOffline(true);
        await page.reload(); await ready(page);
        const offline = await subsState(page);
        await page.goto(ROOT); await page.waitForSelector('.modules');
        const shellOffline = await shellState(page);
        await ctx.setOffline(false); await ctx.close();
        // directly, with the shell never visited: the module registers the site-wide worker itself
        const c2 = await context();
        const p2 = await c2.ctx.newPage();
        await p2.goto(SUBS); await ready(p2); await shellControlled(p2);
        const direct = await subsState(p2);
        await c2.ctx.setOffline(true); await p2.reload(); await ready(p2);
        const directOffline = await subsState(p2);
        await c2.ctx.close();
        const ok = JSON.stringify(shell.modules) === '["Home","Tracker","Atelier","Submersibles","Lists","⚙ Settings"]' && shell.cards === 4 &&
          fromShell.url === SUBS && fromShell.isolated === false && fromShell.controller === ROOT + 'sw.js' && fromShell.back === ROOT && fromShell.tabs.join() === 'Board,Log,Map,Earnings,Setup' &&
          backHome.url === ROOT && offline.isolated === false && offline.tabs.length === 5 && shellOffline.cards === 4 &&
          direct.isolated === false && direct.controller === ROOT + 'sw.js' && directOffline.tabs.length === 5 && directOffline.isolated === false &&
          real(errors).length === 0 && real(c2.errors).length === 0 && external.length === 0;
        record('C20', 'The Submersibles module opens from the shell (switcher and home card) and directly, is not isolated, comes under the shell\'s site-wide worker and works offline after one visit; its header leads back to the shell',
          ok, { shell: { modules: shell.modules, cards: shell.cards }, fromShell, backHome: backHome.url, offline, shellOffline: shellOffline.cards, direct, directOffline, errors: real(errors).concat(real(c2.errors)) });
      }

      // C21 to C24 in one profile: setup, send, the clock moved past the return, reload, calendar file, phone width
      {
        const T0 = new Date('2026-11-12T18:00:00Z').getTime();
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await page.clock.install({ time: T0 });
        await page.goto(SUBS); await ready(page);
        // C21: one free company with four subs, end to end
        const unlockNote = await setupFc(page, 'Alpha Company', { voyage: '1d 3h 12m' });
        const board = await subsState(page);
        const sec = await saved(page);
        const fcId = Object.keys(sec.fcs)[0], fc = sec.fcs[fcId], subs = Object.values(sec.subs);
        const one = subs.find((s) => s.name === 'Sub One');
        // everything stays editable: rename the free company afterwards
        await page.click('[data-tab=setup]'); await page.click(`[data-act=edit][data-fc="${fcId}"]`);
        await page.fill('[data-w="fc.name"]', 'Alpha Renamed');
        for (let i = 0; i < 6; i++) { if (await page.$('[data-act=wsave]')) break; await page.click('[data-act=wnext]'); }
        await page.click('[data-act=wsave]'); await page.waitForSelector('.fc'); await wroteOut(page);
        const afterEdit = await saved(page);
        const c21 = {
          fcs: Object.keys(sec.fcs).length, fc, subs: subs.map((s) => [s.slot, s.name, s.rank, s.parts]), oneVoyage: one && one.voyage,
          board: board.subs, unlockNote: /Deep-sea Site J/.test(unlockNote) && /not certain/.test(unlockNote) && /community data/i.test(unlockNote),
          renamed: afterEdit.fcs[fcId].name, sameSubs: JSON.stringify(Object.keys(afterEdit.subs).sort()) === JSON.stringify(Object.keys(sec.subs).sort()), voyageKept: afterEdit.subs[Object.keys(sec.subs).find((k) => sec.subs[k].name === 'Sub One')].voyage.returnAt === one.voyage.returnAt
        };
        record('C21', 'Guided setup of one free company with four subs, end to end: name, world, slots, names, ranks, parts, a voyage under way and the discovered sectors land in modules.submersibles in the design\'s shape; the board shows 1 Out and 3 Idle; the next-slot note names the sector and the source\'s notes; the free company is renamed afterwards with nothing else lost',
          c21.fcs === 1 && fc.name === 'Alpha Company' && fc.world === 'Maduin' && fc.unlockedSlots === 4 && JSON.stringify(fc.discovered) === '[1,2,3,4,5,6,7,8,9]' && subs.length === 4 &&
          subs.every((s) => s.fcId === fcId && Array.isArray(s.parts) && s.parts.length === 4) && one && one.voyage && one.voyage.returnAt - one.voyage.sentAt === (27 * 60 + 12) * 60000 && one.voyage.gameSaid === '1d 3h 12m' &&
          board.subs.filter((x) => x === 'out').length === 1 && board.subs.filter((x) => x === 'idle').length === 3 && c21.unlockNote && c21.renamed === 'Alpha Renamed' && c21.sameSubs && c21.voyageKept,
          c21);

        // C22: send by tapping a route; the return time is worked out (no typing); the page clock moved past it shows Back
        //      with one banner; a reload shows Back with no second banner; one press on the board\'s suggested-route button sends it again (worked out, no sheet); "Check against the game" keeps the worked-out time beside the game\'s and shows the difference under Setup; "Send all back" sends each sub on its suggested
        //      route; two returns entered as the game's time in the same minute share one banner, the worked-out time kept
        const sentId = await page.$eval('.sub[data-status=idle]', (el) => el.dataset.sub);
        await page.click(`.sub[data-sub=\"${sentId}\"] .sub-top`);
        const advice = await page.textContent('#sheet .advice');
        await page.click('#sheet .sector[data-pick="1"]');
        const calcText = await page.textContent('#sheet [data-picker]');
        await page.click('#sheet [data-act=dosend]'); await wroteOut(page);
        const wantSecs = await page.evaluate((id) => { const s = window.__subs.section().subs[id]; return ADVISOR.evalRoute([1], ADVISOR.stats(s.rank, s.parts)).seconds; }, sentId);
        const sent = [sentId, (await saved(page)).subs[sentId]];
        const beforeBack = await subsState(page);
        await page.clock.fastForward((wantSecs + 60) * 1000);
        await page.waitForFunction(() => document.querySelectorAll('.fleet-banner').length > 0, null, { timeout: 10000 });
        await page.waitForTimeout(1200);
        const atBack = await subsState(page);
        const sentRow = await page.$eval(`.sub[data-sub="${sentId}"]`, (el) => el.dataset.status);
        await page.reload(); await ready(page); await page.waitForTimeout(2500);
        const afterReload = await subsState(page);
        const reloadRow = await page.$eval(`.sub[data-sub="${sentId}"]`, (el) => el.dataset.status);
        // one press: the board's suggested-route button sends the back sub at once, worked out, with no sheet
        const quickLabel = await page.textContent(`.sub[data-sub="${sentId}"] .quick`);
        await page.click(`.sub[data-sub="${sentId}"] .quick`); await wroteOut(page);
        const afterQuick = (await saved(page)).subs[sentId].voyage;
        const quickOk = !!afterQuick && afterQuick.sentAt > sent[1].voyage.returnAt && afterQuick.calcAt === afterQuick.returnAt && afterQuick.route.length >= 1 && /^Send ▸/.test(quickLabel) && !(await page.$('#sheet[open]'));
        // the out card's "Check against the game": the game's time replaces the worked-out one, which is kept
        await page.click(`.sub[data-sub="${sentId}"] .sub-top`); await page.click('#sheet .game-says summary');
        const gameMin = Math.round((afterQuick.returnAt - (await page.evaluate(() => Date.now()))) / 60000) + 3;
        await page.fill('#sheet input[name=tin]', Math.floor(gameMin / 60) + 'h ' + (gameMin % 60) + 'm'); await page.click('#sheet [data-act=check]'); await wroteOut(page);
        const checked = (await saved(page)).subs[sentId].voyage;
        const checkOk = checked.calcAt === afterQuick.calcAt && checked.returnAt !== checked.calcAt && !!checked.gameSaid;
        await page.click('[data-tab=setup]'); const accuracy = await page.textContent('.accuracy');
        await page.waitForFunction(() => /MB of the 4 MB limit/.test((document.querySelector('[data-size]') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
        const sizeText = await page.textContent('[data-size]'); await page.click('[data-tab=board]');
        // the rank moved on when the first voyage was logged (step S3): the base experience of its route, kept as evidence
        const rankSub = (await saved(page)).subs[sentId];
        // send all back and idle subs: each on its suggested route with its own worked-out time
        await page.click('[data-act=sendall]');
        const picked = await page.$$eval('#sheet input[name=pick]:checked', (xs) => xs.map((x) => x.value));
        await page.click('#sheet [data-act=dosendall]'); await wroteOut(page);
        const afterAll = await saved(page);
        const allOk = picked.every((id) => { const v = afterAll.subs[id].voyage; return v && v.route.length >= 1 && v.calcAt === v.returnAt && !v.gameSaid; });
        // the game's time entered for two subs in the same minute: one shared banner; the worked-out time is kept beside it
        const nowMs = await page.evaluate(() => Date.now());
        await page.clock.fastForward(60000 - (nowMs % 60000) + 5000);
        const two = picked.slice(0, 2);
        for (const id of two) {
          await page.click(`.sub[data-sub=\"${id}\"] .sub-top`); await page.click('#sheet [data-act=retime]');
          await page.click('#sheet .game-says summary'); await page.fill('#sheet input[name=tin]', '45m');
          await page.click('#sheet [data-act=dore]'); await wroteOut(page);
        }
        const typed = await saved(page);
        await page.clock.fastForward('00:46:00');
        await page.waitForFunction(() => document.querySelectorAll('.fleet-banner').length > 0, null, { timeout: 10000 });
        await page.waitForTimeout(1200);
        const grouped = await subsState(page);
        const trips = Object.values(afterAll.trips);
        record('C22', 'Send by tapping a route: the return time is worked out with no typing and matches the formula; with the page clock moved past it the sub shows Back with one banner; a reload shows Back with no second banner; one press on the board\'s suggested-route button sends it again (worked out, no sheet); "Check against the game" keeps the worked-out time beside the game\'s and shows the difference under Setup; "Send all back" sends each picked sub on its own suggested route (subs looking for new sectors split them) and logs the returned voyage; two game times entered in the same minute share one banner and keep the worked-out time beside them',
          /Suggested · step [12] of 3/.test(advice) && /calculated, not yet confirmed/.test(calcText) && sent[1].voyage.returnAt - sent[1].voyage.sentAt === wantSecs * 1000 && sent[1].voyage.calcAt === sent[1].voyage.returnAt && !sent[1].voyage.gameSaid &&
          beforeBack.banners.length === 0 && sentRow === 'back' && atBack.banners.length === 1 && atBack.bannerGap >= 4 && /is back/.test(atBack.banners[0]) && reloadRow === 'back' && afterReload.banners.length === 0 &&
          quickOk && checkOk && /\+[234] min/.test(accuracy) && /MB of the 4 MB limit/.test(sizeText) && rankSub.expIntoRank === 10610 && rankSub.rank === 40 && picked.length === 2 && allOk && new Set(picked.map((id) => afterAll.subs[id].voyage.route.join())).size > 1 && trips.length === 1 && trips[0].back === sent[1].voyage.returnAt && trips[0].calc === sent[1].voyage.calcAt && trips[0].rankCalc === 40 && trips[0].rankAfter === 40 &&
          two.every((id) => typed.subs[id].voyage.gameSaid === '45m' && typeof typed.subs[id].voyage.calcAt === 'number' && typed.subs[id].voyage.calcAt !== typed.subs[id].voyage.returnAt) &&
          grouped.banners.length === 1 && /^2 submarines are back/.test(grouped.banners[0]),
          { advice: advice.replace(/\s+/g, ' ').slice(0, 200), wantSecs, quickLabel, afterQuick, checked, accuracy: accuracy.replace(/\s+/g, ' ').slice(-160), sizeText, rank: rankSub && [rankSub.rank, rankSub.expIntoRank], sent: sent[1].voyage, beforeBack: beforeBack.banners, atBack: atBack.banners, sentRow, afterReload: afterReload.banners, reloadRow, picked, allOk, sentAll: picked.map((id) => afterAll.subs[id].voyage), trips, typed: two.map((id) => typed.subs[id].voyage), grouped: grouped.banners });

        // C23: the calendar file for an Out sub: one event, the right time, a 0-minute alarm
        const outId = Object.entries((await saved(page)).subs).find(([, s]) => s.voyage && s.voyage.returnAt > (T0 + 4 * 3600000))[0];
        const outSub = (await saved(page)).subs[outId];
        await page.click(`.sub[data-sub=\"${outId}\"] .sub-top`);
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sheet [data-act=ics]')]);
        const ics = fs.readFileSync(await dl.path(), 'utf8');
        await page.click('#sheet [data-act=close]');
        const want = new Date(outSub.voyage.returnAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-board.png') });
        record('C23', 'The calendar file of an Out sub is one event at the typed return time with a 0-minute alarm, titled "<free company> · <sub> back"',
          (ics.match(/BEGIN:VEVENT/g) || []).length === 1 && ics.includes('DTSTART:' + want + '\r\n') && ics.includes('TRIGGER:PT0M') && ics.includes('SUMMARY:Alpha Renamed · ' + outSub.name + ' back') && /\.ics$/.test(dl.suggestedFilename()),
          { file: dl.suggestedFilename(), want, ics: ics.split('\r\n').filter((l) => /^(DTSTART|SUMMARY|TRIGGER)/.test(l)) });

        // C24: phone width (390 px): no sideways scrolling on the board, in the setup and in the send sheet; the bottom tab bar is there
        const pp = await ctx.newPage();
        await pp.setViewportSize({ width: 390, height: 844 });
        await pp.goto(SUBS); await ready(pp);
        const wide = () => pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const phone = { board: await wide(), tabbar: await pp.$eval('.tabs', (el) => { const r = el.getBoundingClientRect(); return { bottom: Math.round(r.bottom), height: Math.round(r.height), position: getComputedStyle(el).position }; }) };
        if (SHOT) await pp.screenshot({ path: path.join(ev, 'submersibles-phone.png'), fullPage: true });
        await pp.click('.sub[data-sub] .sub-top'); phone.sheet = await wide(); await pp.click('#sheet [data-act=close]');
        await pp.click('[data-tab=setup]'); await pp.click('[data-act=edit]'); phone.setupFc = await wide();
        await pp.click('[data-act=wnext]'); phone.setupSub = await wide();
        for (let i = 0; i < 6; i++) { if (await pp.$('[data-act=wsave]')) break; await pp.click('[data-act=wnext]'); }
        phone.setupSectors = await wide();
        record('C24', 'Phone width (390 px): no sideways scrolling on the board, in the send sheet or in any setup step; the tab bar sits at the bottom',
          phone.board <= 0 && phone.sheet <= 0 && phone.setupFc <= 0 && phone.setupSub <= 0 && phone.setupSectors <= 0 && phone.tabbar.position === 'fixed' && phone.tabbar.bottom === 844,
          phone);
        record('C21-24 errors', 'No page or console errors in that profile', real(errors).length === 0, real(errors));
        await ctx.close();
      }

      // C25: 8 free companies x 4 subs fit at 1920 x 1080 (computer, 4 x 2 grid) with every status shown; two columns on a tablet
      {
        const { ctx, errors } = await context({ viewport: { width: 1920, height: 1080 } });
        const page = await ctx.newPage();
        await page.goto(SUBS); await ready(page);
        await page.evaluate(async () => {
          const now = Date.now(), sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
          const names = ['Alpha', 'Bravo', 'Cedar', 'Delta', 'Ember', 'Fable', 'Garnet', 'Harbor'];
          names.forEach((n, i) => {
            sec.fcs['f' + i] = { name: n + ' Company', world: 'Maduin', order: i, unlockedSlots: i === 7 ? 3 : 4, discovered: [1, 2, 3] };
            for (let s = 1; s <= 4; s++) {
              const kind = (i + s) % 3, ret = kind === 0 ? now + (i * 4 + s) * 600000 : kind === 1 ? now - 600000 : null;
              sec.subs['s' + i + s] = { fcId: 'f' + i, slot: s, name: 'Sub ' + n[0] + s, rank: 60 + s, parts: [3, 4, 1, 2], voyage: ret ? { sentAt: now - 3600000, route: [1, 2], returnAt: ret, gameSaid: '1h' } : null };
            }
          });
          const r = await CC.read();
          await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        });
        await page.reload(); await ready(page);
        const fit = await page.evaluate(() => {
          const subs = [...document.querySelectorAll('.fc .sub[data-status]')];
          const rects = subs.map((el) => el.getBoundingClientRect());
          return { fcs: document.querySelectorAll('.fc').length, subs: subs.length, statuses: [...new Set(subs.map((x) => x.dataset.status))].sort(),
            maxBottom: Math.round(Math.max(...rects.map((r) => r.bottom))), maxRight: Math.round(Math.max(...rects.map((r) => r.right))),
            columns: new Set([...document.querySelectorAll('.fc')].map((el) => Math.round(el.getBoundingClientRect().left))).size, sideways: document.documentElement.scrollWidth - window.innerWidth, scrollY: window.scrollY };
        });
        if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-desktop.png') });
        await page.setViewportSize({ width: 1024, height: 1366 });
        const tablet = await page.evaluate(() => ({ columns: new Set([...document.querySelectorAll('.fc')].map((el) => Math.round(el.getBoundingClientRect().left))).size, sideways: document.documentElement.scrollWidth - window.innerWidth }));
        // sorting by return time across the fleet: Back first (longest waiting), then Out by return time
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.click('[data-sort=time]'); await page.waitForSelector('.fc.wide');
        const order = await page.$$eval('.fc.wide .sub', (xs) => xs.map((x) => x.dataset.status));
        const sortedOk = order.indexOf('out') > order.lastIndexOf('back') && order.indexOf('idle') > order.lastIndexOf('out');
        record('C25', '8 free companies x 4 subs fit on one screen at 1920 x 1080 (4 x 2 grid, every sub inside the window, no sideways scrolling), with Back, Out, Idle and Locked shown; a tablet (1024 px) shows two columns; sorting by return time puts Back first, then Out, then Idle',
          fit.fcs === 8 && fit.subs === 32 && fit.maxBottom <= 1080 && fit.maxRight <= 1920 && fit.columns === 4 && fit.sideways <= 0 && JSON.stringify(fit.statuses) === '["back","idle","locked","out"]' &&
          tablet.columns === 2 && tablet.sideways <= 0 && sortedOk && order.length === 31 && real(errors).length === 0,
          { fit, tablet, order, errors: real(errors) });
        await ctx.close();
      }
    });
    // ── C27 the main Settings (owner request 2026-11-12): characters and their free companies, the night rule; the Tracker
    //    opens with those characters (no first-run window) and Submersibles shows the free company ──
    await guard('C27', async () => {
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT + '#settings'); await page.waitForFunction(() => window.__settings, null, { timeout: 10000 });
      await page.evaluate(() => window.__settings.ready());
      const visible = await page.evaluate(() => !document.getElementById('settings').hidden && document.getElementById('home').hidden);
      await page.click('#settings [data-act=first]'); await page.waitForSelector('#settings [data-set=name][data-id=c1]');
      await page.selectOption('#settings [data-set=count]', '2'); await page.waitForSelector('#settings [data-set=name][data-id=c2]');
      await page.fill('#settings [data-set=name][data-id=c1]', 'Alba Test'); await page.dispatchEvent('#settings [data-set=name][data-id=c1]', 'change'); await page.waitForTimeout(600);
      await page.fill('#settings [data-set=fc][data-id=c1]', 'Alpha Company'); await page.dispatchEvent('#settings [data-set=fc][data-id=c1]', 'change'); await page.waitForTimeout(600);
      await page.check('#settings input[name=night][value=quiet]'); await page.waitForTimeout(600);
      const doc = await page.evaluate(async () => CC.checkDoc((await CC.read()).raw));
      const fcs = Object.values((doc.modules.submersibles || {}).fcs || {});
      await page.click('.switcher a[data-module="tracker"]'); await page.waitForFunction(() => window.__tracker || document.querySelector('#page .ledger, #page table, #page .home'), null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const trackerDialog = await page.$eval('#dlg', (d) => d.open);
      await page.waitForFunction(() => window.__tracker && window.__tracker.ST, null, { timeout: 30000 }).catch(() => {});
      const trackerText = await page.evaluate(() => window.__tracker && window.__tracker.ST ? window.__tracker.ST.chars.map((c) => c.name).join(',') : '');
      await page.goto(ROOT + 'submersibles/'); await page.waitForSelector('html[data-ready="1"]');
      const subsFc = await page.textContent('.fc-head h3').catch(() => null);
      const ok = visible && JSON.stringify(doc.chars.map((c) => c.name)) === '["Alba Test","Character 2"]' && fcs.length === 1 && fcs[0].name === 'Alpha Company' && fcs[0].charId === 'c1' &&
        doc.modules.settings && doc.modules.settings.notify && doc.modules.settings.notify.night === 'quiet' && trackerDialog === false && /Alba Test/.test(trackerText) && subsFc === 'Alpha Company' && real(errors).length === 0;
      record('C27', 'The main Settings (owner request): opened from the main menu; characters and a character\'s free company typed there reach the Tracker (no first-run window) and Submersibles; the night rule is kept for every module',
        ok, { visible, chars: doc.chars.map((c) => c.name), fcs, notify: doc.modules.settings && doc.modules.settings.notify, trackerDialog, trackerText, subsFc, errors: real(errors) });
      await ctx.close();
    });

    // ── C28 (owner reports 2026-11-12): an app icon installed from the Tracker's page opens on the main menu, and the Tracker
    //    still opens from there; the full appearance panel in the main Settings sets the theme of every page ──
    await guard('C28', async () => {
      const { ctx, errors } = await context();
      await ctx.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); });
      const page = await ctx.newPage();
      await page.goto(ROOT + 'tracker/'); await page.waitForURL(ROOT, { timeout: 20000 }).catch(() => {});
      const landed = page.url();
      await page.click('.switcher a[data-module="tracker"]'); await page.waitForTimeout(2500);
      const trackerAfter = page.url();
      // the theme, chosen in the main Settings
      await page.goto(ROOT + '#settings'); await page.waitForSelector('#s-appearance .look-card');
      const themes = await page.$$eval('#s-appearance [data-look=toggle]', (b) => b.length);
      await page.click('#s-appearance [data-look=toggle][data-v="shared:theme"]');
      const choices = await page.$$eval('#s-appearance [data-look=theme]', (b) => b.length);
      await page.click('#s-appearance [data-look=theme][data-v="ishgard-hoarfrost"]'); await page.click('#s-appearance [data-look=mode][data-v=dark]');
      const shellPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
      await page.goto(ROOT + 'submersibles/'); await page.waitForSelector('html[data-ready="1"]');
      const subsPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
      await page.goto(ROOT + 'tracker/'); await page.waitForTimeout(2500);
      const trackerPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
      const ok = landed === ROOT && trackerAfter.startsWith(ROOT + 'tracker/') && themes >= 3 && choices === 21 && shellPaper === '#1e2836' && subsPaper === shellPaper && trackerPaper === shellPaper && real(errors).length === 0;
      record('C28', 'An app icon installed from the Tracker\'s page opens on the main menu and the Tracker still opens from there; the main Settings has the full appearance panel (21 themes), and a theme chosen there colours the main menu, Submersibles and the Tracker alike',
        ok, { landed, trackerAfter, themes, choices, shellPaper, subsPaper, trackerPaper, errors: real(errors) });
      await ctx.close();
    });

    // ── C26 Submersibles step S7: phone notifications. The page works out the alerts (automatic grouping by stage), sends
    //    the schedule to the owner's helper (the real helper/worker.js, in-process with the stand-ins) and keeps the
    //    choices in the save. The browser's own push service cannot be reached from the session, so turning a device on
    //    and a real delivery are checked by tests/helper.test.js (encryption and signature) and by the owner's test button.
    await guard('C26', async () => {
      const server5 = await start(PORT5, { standins: true });
      const st = server5.standins;
      const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const jwk = await crypto.webcrypto.subtle.exportKey('jwk', k.privateKey);
      st.env.VAPID_JWK = JSON.stringify({ kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y }); st.env.VAPID_SUBJECT = 'https://site.test/';
      const device = 'd'.repeat(64); st.kv.set(device, JSON.stringify({ rt: 'rt-test', at: 1, used: 1 }));
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const SUBS5 = ROOT5 + 'submersibles/';
      await page.goto(SUBS5); await page.waitForSelector('html[data-ready="1"]');
      const allSectors = JSON.parse(fs.readFileSync(path.join(T, 'data', 'submarines.json'), 'utf8')).sectors.map((x) => x.id);
      await page.evaluate(async ({ device, all }) => {
        localStorage.setItem('eveniunt-cloud-device', JSON.stringify({ device, at: 1 }));
        const now = Date.now(), M = 60000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fa = { name: 'Alpha Company', unlockedSlots: 2, order: 0, discovered: [1, 2] };                 // still unlocking
        sec.fcs.fb = { name: 'Bravo Company', unlockedSlots: 4, order: 1, discovered: all };                    // farming gil (a better part exists, so not finished)
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 5, parts: [3, 4, 1, 2], voyage: { sentAt: now, route: [1], returnAt: now + 90 * M } };
        sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub A2', rank: 5, parts: [3, 4, 1, 2], voyage: { sentAt: now, route: [2], returnAt: now + 95 * M } };
        for (let i = 1; i <= 4; i++) sec.subs['b' + i] = { fcId: 'fb', slot: i, name: 'Sub B' + i, rank: 145, parts: [3, 4, 1, 2], voyage: { sentAt: now, route: [15, 10], returnAt: now + (600 + i) * M } };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, { device, all: allSectors });
      await page.reload(); await page.waitForSelector('html[data-ready="1"]');
      const sched = async () => { for (let i = 0; i < 40; i++) { const raw = st.kv.get('push:sched'); if (raw) return JSON.parse(raw); await page.waitForTimeout(250); } return null; };
      const first = await sched();
      const stages = await page.evaluate(() => [window.__subs.stageOf('fa'), window.__subs.stageOf('fb')]);
      await page.click('[data-tab=setup]');
      await page.waitForFunction(() => /scheduled|Nothing scheduled/.test((document.querySelector('[data-push-status]') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
      const status = await page.textContent('[data-push-status]');
      const nowLine = await page.textContent('.notify fieldset > p.hint');
      // the panel heads the Setup tab, also while the guided setup is open (owner report 2026-11-12)
      const firstPanel = await page.$eval('#view > section', (el) => el.classList.contains('notify'));
      const settingsLink = await page.$eval('.notify a[href="../#settings"]', (a) => a.textContent).catch(() => '');
      await page.click('[data-act=new]'); const duringWizard = !!(await page.$('.notify')) && !!(await page.$('.wiz')); await page.click('[data-act=wcancel]');
      // change the grouping to one alert per submarine, and the night rule to quiet hours: kept in the save, schedule resent
      st.kv.delete('push:sched');
      await page.check('input[name=grouping][value=sub]'); await page.waitForTimeout(400);
      const perSub = await sched();
      await page.waitForTimeout(700);
      const prefs = await page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles.settings.prefs; });
      const titles = (s) => s ? s.alerts.map((a) => a.title) : null;
      const ok = !!first && JSON.stringify(stages) === '["unlock","gil"]' &&
        JSON.stringify(titles(first)) === JSON.stringify(['Alpha Company · Sub A1 is back', 'Alpha Company · Sub A2 is back', 'Bravo Company: 4 subs back']) &&
        /Off for this device/.test(status) && /3 alerts scheduled/.test(status) && /Alpha Company: per submarine \(still unlocking\)/.test(nowLine) && /Bravo Company: per free company \(farming gil\)/.test(nowLine) &&
        !!perSub && perSub.alerts.length === 6 && firstPanel && duringWizard && prefs.grouping === 'sub' && /Settings/.test(settingsLink) && real(errors).length === 0;
      record('C26', 'Phone notifications (step S7): the page works out the alerts with the automatic grouping (a free company still unlocking gets one alert per sub, one farming gil one alert for the batch), sends them to the helper, shows the helper\'s status and the grouping now in force, and keeps a changed grouping in the save, resending the schedule; turning on, the test and the night rule are reached through the main Settings',
        ok, { stages, first: titles(first), firstPanel, duringWizard, status, nowLine, perSub: titles(perSub), prefs, errors: real(errors) });
      skip('C26b', 'Turning a device on and a real push delivery', 'the browser\'s push service (run by the browser maker) cannot be reached from the session; the helper\'s encryption and signature are checked by tests/helper.test.js, and the owner\'s "Send a test" button checks a real delivery');
      await ctx.close(); server5.close();
    });
    // ── C29 to C40 (fault found 2026-11-13): in the main Settings, a character save must not remove free companies typed
    //    in the same visit, nor a change another page made meanwhile, nor bring back what another page changed or removed
    //    since; every order of edits. Each check compares the whole stored record (characters and every module's section).
    //    Invented names only. ──
    await guard('C29-C40', async () => {
      const SUBS = ROOT + 'submersibles/';
      // the whole stored record, keys sorted: the characters and every module's section (Tracker ticks, Submersibles, settings)
      const whole = (page) => page.evaluate(async () => {
        const d = CC.checkDoc((await CC.read()).raw);
        const sort = (v) => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = sort(v[k]); return o; }, {}) : v);
        return sort({ chars: d.chars, modules: d.modules });
      });
      const sorted = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x)));
      const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
      // the expected record: a stored one with these characters' names changed
      const named = (rec, names) => { const r = JSON.parse(JSON.stringify(rec)); for (const c of r.chars) if (names[c.id]) c.name = names[c.id]; return r; };
      const until = (page, fn, arg) => page.waitForFunction(async ({ src, arg }) => { try { const d = CC.checkDoc((await CC.read()).raw); return (new Function('d', 'arg', 'return (' + src + ')(d, arg)'))(d, arg); } catch (e) { return false; } }, { src: fn.toString(), arg }, { timeout: 15000 }).then(() => page.waitForTimeout(400));
      async function openSettings(page) {
        await page.goto(ROOT + '#settings'); await page.waitForFunction(() => window.__settings, null, { timeout: 10000 });
        await page.evaluate(() => window.__settings.ready());
      }
      async function first(page) { await page.click('#settings [data-act=first]'); await page.waitForSelector('#settings [data-set=name][data-id=c1]'); await until(page, (d) => d.chars.length === 1); }
      async function count(page, n) { await page.selectOption('#settings [data-set=count]', String(n)); await page.waitForSelector(`#settings [data-set=name][data-id=c${n}]`); await until(page, (d, n) => d.chars.length === n, n); }
      const type = (page, k, id, v) => page.evaluate(({ k, id, v }) => { const el = document.querySelector(`#settings [data-set=${k}][data-id=${id}]`); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, { k, id, v });
      async function name(page, id, v) { await type(page, 'name', id, v); await until(page, (d, a) => d.chars.some((c) => c.id === a[0] && c.name === a[1]), [id, v]); }
      async function fc(page, id, v) { await type(page, 'fc', id, v); await until(page, (d, a) => Object.values((d.modules.submersibles || {}).fcs || {}).some((f) => f.charId === a[0] && f.name === a[1]), [id, v]); }
      async function night(page) { await page.check('#settings input[name=night][value=quiet]'); await until(page, (d) => d.modules.settings && d.modules.settings.notify && d.modules.settings.notify.night === 'quiet'); }
      // another page changes the Submersibles section the way the module does: read, change, write with its own stamp and base
      const otherSubs = (tab, change, arg) => tab.evaluate(async ({ src, arg }) => {
        const r = await CC.read(), d = CC.checkDoc(r.raw), base = d.modules.submersibles || null;
        const sec = JSON.parse(JSON.stringify(base || { fcs: {}, subs: {}, trips: {}, settings: {} }));
        (new Function('sec', 'arg', '(' + src + ')(sec, arg)'))(sec, arg);
        await CC.writeSection('submersibles', sec, { rev: r.rev, base });
      }, { src: change.toString(), arg });
      async function trackerTab(ctx) {
        const tab = await ctx.newPage();
        await tab.goto(ROOT + 'tracker/'); await tab.waitForFunction(() => window.__tracker && window.__tracker.ST, null, { timeout: 30000 });
        return tab;
      }
      // the Tracker in another tab ticks or unticks its first entry for character 1, through its own state and save
      const tick = (tab, on) => tab.evaluate(async (on) => { const t = window.__tracker, key = t.IDX.byKey.keys().next().value; ET.setTick(t.ST, 'c1', key, on); await ET.saveState(t.ST, true); return key; }, on);

      // C29: a free company for each of two characters, then a name
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await count(page, 2);
        await fc(page, 'c1', 'Alpha Company'); await fc(page, 'c2', 'Bravo Company');
        const want = named(await whole(page), { c1: 'Alba Test' });
        await name(page, 'c1', 'Alba Test');
        const got = await whole(page);
        const fcs = Object.values(got.modules.submersibles.fcs).map((f) => [f.charId, f.name]).sort();
        record('C29', 'Main Settings: a free company for character 1, then one for character 2, then a name change: the whole stored record is as before plus the name (both free companies kept)',
          same(got, want) && same(fcs, [['c1', 'Alpha Company'], ['c2', 'Bravo Company']]) && real(errors).length === 0, { got, want, errors: real(errors) });
        await ctx.close();
      }
      // C30: a free company, then two name changes in a row
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        await fc(page, 'c1', 'Alpha Company');
        const want = named(await whole(page), { c1: 'Alba Retest' });
        await name(page, 'c1', 'Alba Test'); await name(page, 'c1', 'Alba Retest');
        const got = await whole(page);
        record('C30', 'Main Settings: a free company, then two name changes in a row: the whole stored record is as before plus the last name (the free company kept)',
          same(got, want) && real(errors).length === 0, { got, want, errors: real(errors) });
        await ctx.close();
      }
      // C31 and C34 in one profile: a free company, a name change, then the number of characters raised; a reload shows what is stored
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        await fc(page, 'c1', 'Alpha Company');
        const before = await whole(page);
        await name(page, 'c1', 'Alba Test'); await count(page, 2);
        const got = await whole(page);
        // expected: as before, the name, and a second character with empty Tracker bags; nothing else changed
        const want = named(before, { c1: 'Alba Test' });
        want.chars.push(got.chars[1]);
        for (const bag of Object.keys(want.modules.tracker)) if (want.modules.tracker[bag] && want.modules.tracker[bag].c1 && JSON.stringify(want.modules.tracker[bag].c1) === '{}') want.modules.tracker[bag].c2 = {};
        const wantSorted = sorted(want);
        record('C31', 'Main Settings: a free company, a name change, then the number of characters raised: the whole stored record is as before plus the name and a new empty character (the free company kept)',
          same(got, wantSorted) && same(got.chars.map((c) => [c.id, c.name]), [['c1', 'Alba Test'], ['c2', 'Character 2']]) && real(errors).length === 0, { got, want: wantSorted, errors: real(errors) });
        // C34: a reload of Settings and of Submersibles shows what is stored
        await page.reload(); await page.waitForFunction(() => window.__settings, null, { timeout: 10000 }); await page.evaluate(() => window.__settings.ready());
        await page.waitForSelector('#settings [data-set=name][data-id=c2]');
        const shown = await page.evaluate(() => ['c1', 'c2'].map((id) => [document.querySelector(`#settings [data-set=name][data-id=${id}]`).value, document.querySelector(`#settings [data-set=fc][data-id=${id}]`).value]));
        await page.goto(SUBS); await page.waitForSelector('html[data-ready="1"]');
        const subsShown = await page.$$eval('.fc-head h3', (h) => h.map((x) => x.textContent));
        const again = await whole(page);
        record('C34', 'After those edits, a reload of the main Settings and of Submersibles shows what is stored (the name, the free company, the new character), and the whole stored record is unchanged by the reloads',
          same(shown, [['Alba Test', 'Alpha Company'], ['', '']]) && same(subsShown, ['Alpha Company']) && same(again, got) && same(again, wantSorted) && real(errors).length === 0,
          { shown, subsShown, again, errors: real(errors) });
        await ctx.close();
      }
      // C32: Settings open; Submersibles in a second tab adds a free company through its guided setup; then two name changes
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        const tab = await ctx.newPage();
        await tab.goto(SUBS); await tab.waitForSelector('html[data-ready="1"]');
        await tab.click('[data-act=new]');
        await tab.fill('[data-w="fc.name"]', 'Delta Company'); await tab.selectOption('[data-w="fc.world"]', 'Maduin'); await tab.click('[data-act=wnext]');
        const subs = [['Sub One', 50], ['Sub Two', 40], ['Sub Three', 30], ['Sub Four', 12]];
        for (let i = 0; i < subs.length; i++) {
          if (i > 0) await tab.check('[data-w=unlocked]');
          await tab.fill('[data-w=name]', subs[i][0]);
          await tab.fill('[data-w=rank]', String(subs[i][1])); await tab.press('[data-w=rank]', 'Tab');
          for (let j = 0; j < 4; j++) await tab.selectOption(`select[data-w=part][data-j="${j}"]`, { index: 1 });
          await tab.click('[data-act=wnext]');
        }
        await tab.click('[data-act=wsave]'); await tab.waitForSelector('.fc');
        await until(tab, (d) => Object.keys((d.modules.submersibles || {}).subs || {}).length === 4);
        await tab.waitForTimeout(600);
        const want = named(await whole(page), { c1: 'Alba Retest' });
        await page.bringToFront();
        await name(page, 'c1', 'Alba Test'); await name(page, 'c1', 'Alba Retest');
        const got = await whole(page);
        record('C32', 'Main Settings open while Submersibles in another tab adds a free company with four subs; then two name changes in Settings: the whole stored record is the other tab\'s plus the last name',
          same(got, want) && Object.keys(got.modules.submersibles.subs).length === 4 && real(errors).length === 0, { got, want, errors: real(errors) });
        await ctx.close();
      }
      // C33: the reverse order: a name, then a free company, then a name
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        await name(page, 'c1', 'Alba Test'); await fc(page, 'c1', 'Alpha Company');
        const want = named(await whole(page), { c1: 'Alba Retest' });
        await name(page, 'c1', 'Alba Retest');
        const got = await whole(page);
        record('C33', 'Main Settings, the reverse order: a name, then a free company, then a name: the whole stored record is as before plus the last name',
          same(got, want) && real(errors).length === 0, { got, want, errors: real(errors) });
        await ctx.close();
      }
      // C35: the night rule, then two name changes
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        await night(page);
        const want = named(await whole(page), { c1: 'Alba Retest' });
        await name(page, 'c1', 'Alba Test'); await name(page, 'c1', 'Alba Retest');
        const got = await whole(page);
        record('C35', 'Main Settings: the night rule, then two name changes: the whole stored record is as before plus the last name (the night rule kept)',
          same(got, want) && got.modules.settings.notify.night === 'quiet' && real(errors).length === 0, { got, want, errors: real(errors) });
        await ctx.close();
      }
      // C36: the Tracker in another tab ticks an entry; then two name changes in Settings
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        const tab = await trackerTab(ctx);
        const key = await tick(tab, true); await until(tab, (d, k) => !!(d.modules.tracker.ticks.c1 || {})[k], key);
        const want = named(await whole(page), { c1: 'Alba Retest' });
        await page.bringToFront();
        await name(page, 'c1', 'Alba Test'); await name(page, 'c1', 'Alba Retest');
        const got = await whole(page);
        record('C36', 'Main Settings open while the Tracker in another tab ticks an entry; then two name changes in Settings: the whole stored record is the Tracker\'s plus the last name (the tick kept)',
          same(got, want) && !!got.modules.tracker.ticks.c1[key] && real(errors).length === 0, { key, got, want, errors: real(errors) });
        await ctx.close();
      }
      // C37 and C38: another page adds a free company; Settings sets the night rule; the other page renames it (C37) or
      // removes it (C38); Settings changes a name: the other page's newer change wins
      for (const [id, title, change] of [
        ['C37', 'renames it', (sec) => { const k = Object.keys(sec.fcs).find((x) => sec.fcs[x].name === 'Echo Company'); sec.fcs[k].name = 'Echo Renamed'; }],
        ['C38', 'removes it', (sec) => { const k = Object.keys(sec.fcs).find((x) => sec.fcs[x].name === 'Echo Company'); delete sec.fcs[k]; }]
      ]) {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        const tab = await ctx.newPage(); await tab.goto(SUBS); await tab.waitForSelector('html[data-ready="1"]');
        await otherSubs(tab, (sec) => { sec.fcs.fecho = { name: 'Echo Company', order: 0, unlockedSlots: 1, discovered: [1, 2] }; });
        await page.bringToFront(); await night(page);
        await otherSubs(tab, change); await tab.waitForTimeout(400);
        const want = named(await whole(page), { c1: 'Alba Test' });
        await page.bringToFront(); await name(page, 'c1', 'Alba Test');
        const got = await whole(page);
        record(id, 'Main Settings open; another page adds a free company, Settings sets the night rule, the other page ' + title + ', Settings changes a name: the whole stored record is the other page\'s newer one plus the name',
          same(got, want) && real(errors).length === 0, { got, want, errors: real(errors) });
        await ctx.close();
      }
      // C39: the Tracker in another tab ticks an entry; Settings adds a free company; the Tracker unticks it; Settings changes a name
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        const tab = await trackerTab(ctx);
        const key = await tick(tab, true); await until(tab, (d, k) => !!(d.modules.tracker.ticks.c1 || {})[k], key);
        await page.bringToFront(); await fc(page, 'c1', 'Alpha Company');
        await tab.bringToFront(); await tab.waitForTimeout(600); await tick(tab, false); await until(tab, (d, k) => !(d.modules.tracker.ticks.c1 || {})[k], key);
        const want = named(await whole(page), { c1: 'Alba Test' });
        await page.bringToFront(); await name(page, 'c1', 'Alba Test');
        const got = await whole(page);
        record('C39', 'Main Settings open; the Tracker in another tab ticks an entry, Settings adds a free company, the Tracker unticks the entry, Settings changes a name: the whole stored record keeps the untick and the free company, plus the name',
          same(got, want) && !got.modules.tracker.ticks.c1[key] && real(errors).length === 0, { key, got, want, errors: real(errors) });
        await ctx.close();
      }
      // C40: quick succession, ten times: a free company and two name changes about 20 ms apart; every typed value is stored
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        const runs = [];
        for (let i = 1; i <= 10; i++) {
          const before = await whole(page), gap = 10 + 2 * i; // 12 to 30 ms
          await type(page, 'fc', 'c1', 'Alpha ' + i); await page.waitForTimeout(gap);
          await type(page, 'name', 'c1', 'Alba ' + i); await page.waitForTimeout(gap);
          await type(page, 'name', 'c1', 'Alba Re ' + i);
          await until(page, (d, a) => d.chars[0].name === a[0] && Object.values((d.modules.submersibles || {}).fcs || {}).some((f) => f.name === a[1]), ['Alba Re ' + i, 'Alpha ' + i]).catch(() => {});
          await page.waitForTimeout(600);
          const got = await whole(page);
          const want = named(before, { c1: 'Alba Re ' + i });
          const gotFcs = (got.modules.submersibles || { fcs: {} }).fcs, fcIds = Object.keys(gotFcs);
          if (want.modules.submersibles) { for (const k of Object.keys(want.modules.submersibles.fcs)) want.modules.submersibles.fcs[k].name = 'Alpha ' + i; }
          else want.modules.submersibles = fcIds.length === 1 && gotFcs[fcIds[0]].name === 'Alpha ' + i && gotFcs[fcIds[0]].charId === 'c1' ? got.modules.submersibles : null;
          runs.push({ i, gap, ok: same(got, want), name: got.chars[0].name, fcs: fcIds.map((k) => gotFcs[k].name) });
        }
        record('C40', 'Main Settings, quick succession ten times: a free company and two name changes about 20 ms apart: each time the whole stored record is as before plus the free company and the last name',
          runs.every((r) => r.ok) && real(errors).length === 0, { runs, errors: real(errors) });
        await ctx.close();
      }

      // ── C41 to C45 (part 2 of the 2026-11-13 fix): the main Settings takes in what other pages store while it is open,
      //    without disturbing a field being typed in; a free company typed for a character that has one renames it; a cloud
      //    sync under way keeps the edits saved during it, and an edit never waits on the network. Invented names only. ──
      const shownValue = (page, k, id) => page.evaluate(({ k, id }) => { const el = document.querySelector(`#settings [data-set=${k}][data-id=${id}]`); return el ? el.value : null; }, { k, id });
      const showsSoon = (page, k, id, v) => page.waitForFunction(({ k, id, v }) => { const el = document.querySelector(`#settings [data-set=${k}][data-id=${id}]`); return !!el && el.value === v; }, { k, id, v }, { timeout: 5000 }).then(() => true, () => false);
      const fcsFor = (rec, charId) => Object.values((rec.modules.submersibles || {}).fcs || {}).filter((f) => f.charId === charId);
      const message = (page) => page.evaluate(() => ((document.querySelector('#settings .set-msg') || {}).textContent || ''));
      // C54 to C58 helpers: the stores are made to fail by a flag that the page's reads and writes obey
      // when 'during': the stores fail from the start of the write to its end; 'after': they fail from its end until released
      async function breakStores(page, owner, fn, when) {
        await page.evaluate(({ owner, fn, when }) => {
          if (window.__fail === undefined) {
            window.__fail = false;
            const open = indexedDB.open.bind(indexedDB);
            indexedDB.open = function () { if (window.__fail) throw new DOMException('blocked', 'SecurityError'); return open.apply(null, arguments); };
            for (const m of ['getItem', 'setItem']) { const o = Storage.prototype[m]; Storage.prototype[m] = function () { if (window.__fail) throw new DOMException('blocked', 'SecurityError'); return o.apply(this, arguments); }; }
          }
          const host = owner === 'ET' ? ET : CC, orig = host[fn];
          host[fn] = function () {
            if (when === 'during') window.__fail = true;
            return orig.apply(host, arguments).then((r) => { window.__fail = when === 'after'; return r; }, (e) => { window.__fail = false; throw e; });
          };
        }, { owner, fn, when });
      }
      const release = (page) => page.evaluate(() => { window.__fail = false; });
      const NOTSAVED = 'Not saved on this device: save a backup file';
      const blank = (page) => page.evaluate(() => { const m = document.querySelector('#settings .set-msg'); if (m) m.textContent = ''; });
      const anyMessage = (page) => page.waitForFunction(() => ((document.querySelector('#settings .set-msg') || {}).textContent || '') !== '', null, { timeout: 10000 });
      // C41: another tab links a free company to character 1: the field shows it without a reload, and typing renames it;
      // the same for a write this page is not told about (its own code's write): the edit decides on the save as stored
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await count(page, 2);
        const tab = await ctx.newPage(); await tab.goto(SUBS); await tab.waitForSelector('html[data-ready="1"]');
        await otherSubs(tab, (sec) => { sec.fcs.ffox = { name: 'Foxtrot Company', charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] }; });
        await page.bringToFront();
        const shown = await showsSoon(page, 'fc', 'c1', 'Foxtrot Company');
        const want = await whole(page); want.modules.submersibles.fcs.ffox.name = 'Foxtrot Renamed';
        await fc(page, 'c1', 'Foxtrot Renamed');
        const got = await whole(page);
        await page.evaluate(async () => {
          const r = await CC.read(), d = CC.checkDoc(r.raw), base = d.modules.submersibles, sec = JSON.parse(JSON.stringify(base));
          sec.fcs.fgolf = { name: 'Golf Company', charId: 'c2', order: 1, unlockedSlots: 1, discovered: [1, 2] };
          await CC.writeSection('submersibles', sec, { rev: r.rev, base });
        });
        const want2 = await whole(page); want2.modules.submersibles.fcs.fgolf.name = 'Golf Renamed';
        await fc(page, 'c2', 'Golf Renamed');
        const got2 = await whole(page);
        record('C41', 'Main Settings open; another tab links a free company to character 1: the field shows it without a reload, and typing another name renames it (one free company for that character); a link the page was not told about is renamed too: each time the whole stored record is as before plus the new name',
          shown && same(got, want) && fcsFor(got, 'c1').length === 1 && same(got2, want2) && fcsFor(got2, 'c2').length === 1 && real(errors).length === 0,
          { shown, got, want, got2, want2, errors: real(errors) });
        await ctx.close();
      }
      // C42: another tab renames a character (the Tracker) and sends a submarine (Submersibles); Settings shows the name,
      // then a free company and two names are saved there
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await count(page, 2);
        const tab = await trackerTab(ctx);
        await tab.evaluate(async () => { const t = window.__tracker; ET.renameCharacter(t.ST, 'c2', 'Brio Elsewhere'); await ET.saveState(t.ST, true); });
        await until(tab, (d) => d.chars[1].name === 'Brio Elsewhere');
        const subsTab = await ctx.newPage(); await subsTab.goto(SUBS); await subsTab.waitForSelector('html[data-ready="1"]');
        await otherSubs(subsTab, (sec) => { sec.fcs.fhot = { name: 'Hotel Company', order: 0, unlockedSlots: 1, discovered: [1, 2] }; sec.subs.h1 = { fcId: 'fhot', slot: 1, name: 'Sub H1', rank: 5, parts: [3, 4, 1, 2] }; });
        await otherSubs(subsTab, (sec, now) => { sec.subs.h1.voyage = { sentAt: now, route: [1], returnAt: now + 3600000 }; }, Date.now());
        await until(subsTab, (d) => !!d.modules.submersibles.subs.h1.voyage);
        await page.bringToFront();
        const shown = await showsSoon(page, 'name', 'c2', 'Brio Elsewhere');
        const before = await whole(page);
        await fc(page, 'c1', 'Alpha Company'); await name(page, 'c1', 'Alba Test'); await name(page, 'c1', 'Alba Retest');
        const got = await whole(page);
        const want = named(before, { c1: 'Alba Retest' });
        const added = Object.keys(got.modules.submersibles.fcs).filter((k) => !before.modules.submersibles.fcs[k]);
        const nf = added.length === 1 ? got.modules.submersibles.fcs[added[0]] : null;
        if (nf) want.modules.submersibles.fcs[added[0]] = nf;
        record('C42', 'Main Settings open; another tab renames a character and sends a submarine: the Settings field shows the name without a reload; a free company and two names saved in Settings: the whole stored record is both tabs\' changes together',
          shown && !!nf && nf.charId === 'c1' && nf.name === 'Alpha Company' && same(got, want) && got.chars[1].name === 'Brio Elsewhere' && !!got.modules.submersibles.subs.h1.voyage && real(errors).length === 0,
          { shown, added, got, want, errors: real(errors) });
        await ctx.close();
      }
      // C43: a field being typed in when another tab stores a change keeps its text, focus and caret; after leaving it both
      // changes are stored and the fields show them; a transfer code that is shown stays shown
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await count(page, 2);
        const tab = await ctx.newPage(); await tab.goto(SUBS); await tab.waitForSelector('html[data-ready="1"]');
        await page.bringToFront();
        const sel = '#settings [data-set=name][data-id=c1]';
        await page.click(sel); await page.keyboard.type('Alba Typed'); for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
        await page.evaluate((s) => { document.querySelector(s).__mark = 1; }, sel);
        const focused = () => page.evaluate(() => { const a = document.activeElement; return { same: !!a && a.__mark === 1 && a.isConnected, value: a ? a.value : null, caret: a ? [a.selectionStart, a.selectionEnd] : null }; });
        const typing = await focused();
        await otherSubs(tab, (sec) => { sec.fcs.find = { name: 'India Company', charId: 'c2', order: 0, unlockedSlots: 1, discovered: [1, 2] }; });
        await page.waitForTimeout(800);
        const during = await focused();
        const want = named(await whole(page), { c1: 'Alba Typed' });
        await page.keyboard.press('Tab'); // leaves the field: its change is saved; the focus is in the next field
        await until(page, (d) => d.chars[0].name === 'Alba Typed');
        await page.evaluate(() => document.activeElement.blur());
        const shownAfter = await showsSoon(page, 'fc', 'c2', 'India Company');
        const nameAfter = await shownValue(page, 'name', 'c1');
        const got = await whole(page);
        await page.click('#settings [data-act=code]'); await page.waitForSelector('#settings [data-code] textarea');
        const codeState = () => page.evaluate(() => { const t = document.querySelector('#settings [data-code] textarea'); return { shown: !!t, value: t ? t.value : null, focused: !!t && document.activeElement === t, all: !!t && t.selectionStart === 0 && t.selectionEnd === t.value.length }; });
        // the shown code decodes (ET.readTransferCode) to the stored characters and free companies; the save is read again until it does
        const decodes = () => page.evaluate(async () => {
          const ta = document.querySelector('#settings [data-code] textarea'); if (!ta) return false;
          const dec = await ET.readTransferCode(ta.value), d = CC.checkDoc((await CC.read()).raw);
          const pick = (chars, x) => JSON.stringify({ chars: chars.map((c) => [c.id, c.name]), fcs: Object.keys((x || {}).fcs || {}).sort().map((k) => [k, x.fcs[k].name, x.fcs[k].charId]) });
          return pick(dec.chars, CC.checkModules(dec.modules || {}).submersibles) === pick(d.chars, d.modules.submersibles);
        });
        const decodesSoon = async () => { for (let i = 0; i < 20; i++) { if (await decodes()) return true; await page.waitForTimeout(250); } return false; };
        const code0 = await codeState();
        await otherSubs(tab, (sec) => { sec.fcs.find.name = 'India Renamed'; });
        const code1ok = await decodesSoon();
        const code1 = await codeState();
        await page.evaluate(() => document.activeElement.blur());
        const shownRenamed = await showsSoon(page, 'fc', 'c2', 'India Renamed');
        const code2 = await codeState();
        const code2ok = await decodesSoon();
        record('C43', 'Main Settings: a name being typed (caret mid-word) when another tab stores a change keeps its text, focus and caret; after leaving the field both changes are stored and the fields show them; a transfer code that is shown stays shown, keeps the focus and has its whole text selected again, and decodes to the stored save while another change is taken in and after the focus leaves',
          during.same && during.value === 'Alba Typed' && same(during.caret, typing.caret) && same(typing.caret, [7, 7]) && same(got, want) && shownAfter && nameAfter === 'Alba Typed' &&
          code0.shown && code1.shown && code1ok && code1.focused === code0.focused && code1.all && shownRenamed && code2.shown && code2ok && real(errors).length === 0,
          { typing, during, shownAfter, nameAfter, got, want, code: [code0, code1, code2].map((c) => ({ shown: c.shown, focused: c.focused, same: c.value === code0.value })), code1ok, code2ok, errors: real(errors) });
        await ctx.close();
      }
      // ── C46 to C50 (review of part 2): a button press survives a redraw due between press and release; fields show
      //    another tab's changes in place while the focus moves from field to field; a clash during a sync is left open;
      //    an emptied free-company box shows the name again; a write that did not happen is never answered "Saved". ──
      const trackerDo = (tab, src, arg) => tab.evaluate(async ({ src, arg }) => { const t = window.__tracker; await new Promise((r) => setTimeout(r, 300)); (new Function('t', 'arg', '(' + src + ')(t, arg)'))(t, arg); await ET.saveState(t.ST, true); }, { src: src.toString(), arg });
      const activeKey = (page) => page.evaluate(() => { const a = document.activeElement; return a && a.dataset && a.dataset.set ? a.dataset.set + ':' + (a.dataset.id || '') : (a && a.dataset && a.dataset.act) || ''; });
      const nameCount = (page) => page.evaluate(() => document.querySelectorAll('#settings [data-set=name]').length);
      // C46: a press on "Make a transfer code" is kept when another tab adds a character between press and release
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await count(page, 2); await name(page, 'c1', 'Alba Test');
        const tab = await trackerTab(ctx);
        const addChar = (n) => trackerDo(tab, (t, n) => { ET.setCharacterCount(t.ST, n); }, n);
        await page.bringToFront();
        const codeShown = () => page.evaluate(() => !!document.querySelector('#settings [data-code] textarea'));
        const clearCode = () => page.evaluate(() => { document.querySelector('#settings [data-code]').innerHTML = ''; if (document.activeElement) document.activeElement.blur(); });
        const press = async (during) => {
          const b = await page.$('#settings [data-act=code]'); await b.scrollIntoViewIfNeeded(); const bb = await b.boundingBox();
          await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
          if (during) await during(); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(800);
        };
        // (a) a name being typed when another tab adds a character (a redraw is due), then a mouse press on the button
        await page.click('#settings [data-set=name][data-id=c1]'); await page.keyboard.press('End'); await page.keyboard.type(' X');
        await addChar(3); await page.waitForTimeout(600);
        await press();
        const a = { code: await codeShown(), names: await nameCount(page) };
        // (b) no field has the focus; another tab adds a character while the button is held down
        await clearCode();
        await press(async () => { await addChar(4); await page.waitForTimeout(500); });
        const b = { code: await codeShown(), names: await nameCount(page) };
        // (c) the keyboard: Space held on the focused button while another tab adds a character; then Enter
        await clearCode(); await page.focus('#settings [data-act=code]');
        await page.keyboard.down('Space'); await addChar(5); await page.waitForTimeout(500); await page.keyboard.up('Space'); await page.waitForTimeout(800);
        const c = { code: await codeShown(), names: await nameCount(page) };
        await clearCode(); await page.focus('#settings [data-act=code]'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
        const enter = await codeShown();
        // (d) a fresh page with no message yet: a name typed, then a mouse press on the button (the first "Saved." must not move the button away)
        await page.reload(); await page.waitForFunction(() => window.__settings, null, { timeout: 10000 }); await page.evaluate(() => window.__settings.ready());
        await page.click('#settings [data-set=name][data-id=c2]'); await page.keyboard.press('End'); await page.keyboard.type('Brio');
        await press();
        const d = { code: await codeShown(), msg: await message(page) };
        const got = await whole(page);
        record('C46', 'Main Settings: a press on a button is kept when another tab adds a character between press and release (a name being typed before the mouse press; no field focused while the button is held; Space held on the focused button), Enter works, a press that saves a typed name as the page\'s first message is kept, and the typed names are stored',
          a.code && a.names === 3 && b.code && b.names === 4 && c.code && c.names === 5 && enter && d.code && d.msg === 'Saved.' && got.chars[0].name === 'Alba Test X' && got.chars[1].name === 'Brio' && got.chars.length === 5 && real(errors).length === 0,
          { a, b, c, enter, d, names: got.chars.map((x) => x.name), errors: real(errors) });
        await ctx.close();
      }
      // C47: another tab's changes reach the fields in place while the focus moves from field to field (Tab from a name box
      // to the next name box and to a free-company box); typed text is kept; a change in the number of characters is
      // drawn as soon as the focus moves to a field with nothing typed
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await count(page, 2); await name(page, 'c1', 'Alba Test'); await name(page, 'c2', 'Brio Test');
        const tracker = await trackerTab(ctx);
        const subsTab = await ctx.newPage(); await subsTab.goto(SUBS); await subsTab.waitForSelector('html[data-ready="1"]');
        await page.bringToFront();
        const vals = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#settings [data-set=name], #settings [data-set=fc]')].map((el) => [el.dataset.set + ':' + el.dataset.id, el.value])));
        // 1: the focus in character 1's name box, nothing typed: the other tabs rename both characters and link a free company to character 2
        await page.click('#settings [data-set=name][data-id=c1]');
        await trackerDo(tracker, (t) => { ET.renameCharacter(t.ST, 'c1', 'Alba Elsewhere'); ET.renameCharacter(t.ST, 'c2', 'Brio Elsewhere'); });
        await otherSubs(subsTab, (sec) => { sec.fcs.fjul = { name: 'Juliet Company', charId: 'c2', order: 0, unlockedSlots: 1, discovered: [1, 2] }; });
        await page.waitForTimeout(800);
        const s1 = { active: await activeKey(page), vals: await vals() };
        // 2: text typed in character 1's box is kept when another rename arrives
        await page.keyboard.press('End'); await page.keyboard.type(' X');
        await trackerDo(tracker, (t) => { ET.renameCharacter(t.ST, 'c1', 'Alba Third'); }); await page.waitForTimeout(800);
        const s2 = { active: await activeKey(page), n1: (await vals())['name:c1'] };
        // 3: Tab to character 1's free company, Tab to character 2's name (shows the other tab's name), add a letter, Tab to
        // character 2's free company (shows the linked one), add a word, leave
        await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
        const s3 = { active: await activeKey(page), n2: (await vals())['name:c2'] };
        await page.keyboard.press('End'); await page.keyboard.type('X'); await page.keyboard.press('Tab');
        const s4 = { active: await activeKey(page), f2: (await vals())['fc:c2'] };
        await page.keyboard.press('End'); await page.keyboard.type(' Two'); await page.evaluate(() => document.activeElement.blur());
        await until(page, (d) => d.chars[1].name === 'Brio ElsewhereX' && Object.values(d.modules.submersibles.fcs).some((f) => f.name === 'Juliet Company Two'));
        // 4: the focus in a quiet-hours time box: a rename reaches the name box; another tab adds a character: drawn at once
        // (nothing typed in the focused box), the focus kept
        await page.focus('#settings [data-set=qfrom]');
        await trackerDo(tracker, (t) => { ET.renameCharacter(t.ST, 'c1', 'Alba Fourth'); }); await page.waitForTimeout(800);
        const s5 = { active: await activeKey(page), n1: (await vals())['name:c1'] };
        await trackerDo(tracker, (t) => { ET.setCharacterCount(t.ST, 3); }); await page.waitForTimeout(800);
        const s6 = { active: await activeKey(page), names: await nameCount(page) };
        // 5: text typed in character 1's name box when another tab adds a fourth character: drawn when the focus moves on
        await page.click('#settings [data-set=name][data-id=c1]'); await page.keyboard.press('End'); await page.keyboard.type('Y');
        await trackerDo(tracker, (t) => { ET.setCharacterCount(t.ST, 4); }); await until(page, (d) => d.chars.length === 4);
        const s7 = { active: await activeKey(page), names: await nameCount(page) };
        const before = await whole(page);
        await page.keyboard.press('Tab'); await until(page, (d) => d.chars[0].name === 'Alba FourthY');
        const s8 = { active: await activeKey(page), names: await nameCount(page), n1: (await vals())['name:c1'] };
        const got = await whole(page);
        const want = named(before, { c1: 'Alba FourthY' });
        const ok = s1.active === 'name:c1' && s1.vals['name:c1'] === 'Alba Elsewhere' && s1.vals['name:c2'] === 'Brio Elsewhere' && s1.vals['fc:c2'] === 'Juliet Company' &&
          s2.active === 'name:c1' && s2.n1 === 'Alba Elsewhere X' && s3.active === 'name:c2' && s3.n2 === 'Brio Elsewhere' && s4.active === 'fc:c2' && s4.f2 === 'Juliet Company' &&
          s5.active === 'qfrom:' && s5.n1 === 'Alba Fourth' && s6.active === 'qfrom:' && s6.names === 3 && s7.active === 'name:c1' && s7.names === 3 && s8.active === 'fc:c1' && s8.names === 4 && s8.n1 === 'Alba FourthY' &&
          same(got, want) && got.chars[1].name === 'Brio ElsewhereX' && same(fcsFor(got, 'c2').map((f) => f.name), ['Juliet Company Two']) && real(errors).length === 0;
        record('C47', 'Main Settings: another tab\'s renames and free company reach the fields in place while a field has the focus (a focused box with nothing typed too); typed text is kept; Tab to the next name box and to a free-company box shows the other tab\'s values and edits build on them; with the focus in a time box a new character is drawn at once, and while text is typed it is drawn when the focus moves on; the whole stored record has everything',
          ok, { s1, s2, s3, s4, s5, s6, s7, s8, got, want, errors: real(errors) });
        await ctx.close();
      }
      // C44 and C45: cloud sync from the main Settings against the stand-ins (tests/standins.js), on their own port
      {
        const zlib = require('zlib');
        const server4 = await start(PORT4, { standins: true });
        const st = server4.standins;
        const device = 'e'.repeat(64); st.kv.set(device, JSON.stringify({ rt: 'rt-p2', at: 1, used: 1 })); st.state.refreshes.set('rt-p2', true);
        const unpack = (doc) => JSON.parse(zlib.inflateRawSync(Buffer.from(doc.data, 'base64')).toString('utf8'));
        const pack = (inner) => ({ app: 'eveniunt-completionist-tracker', v: 2, format: 'deflate-raw+base64', data: zlib.deflateRawSync(Buffer.from(JSON.stringify(inner))).toString('base64') });
        const settled = async (page) => { await page.waitForFunction(() => window.__settings, null, { timeout: 10000 }); await page.evaluate(() => window.__settings.ready()); };
        // a save with two named characters on a device signed in to the stand-ins; the sync at opening makes the cloud copy
        async function signedIn(page) {
          await page.goto(ROOT4 + '#settings'); await settled(page);
          await first(page); await count(page, 2); await name(page, 'c1', 'Alba Test'); await name(page, 'c2', 'Brio Test');
          await page.evaluate((device) => localStorage.setItem('eveniunt-cloud-device', JSON.stringify({ device, at: 1 })), device);
          await page.reload(); await settled(page);
          await page.waitForFunction(() => /Synced \d/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 15000 });
        }
        // C44: the cloud copy holds a change from another device; the upload is held back; a name and a free company are saved meanwhile
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await signedIn(page);
          const inner = unpack(st.state.files.f1);
          inner.chars.find((c) => c.id === 'c2').name = 'Brio Elsewhere';
          st.state.files.f1 = pack(inner); st.state.etag.f1 = 'e-other';
          const before = await whole(page);
          let release = null, held = false; const gate = new Promise((ok) => { release = ok; });
          await page.route('**/graph/**', async (route) => { if (route.request().method() === 'PUT') { held = true; await gate; } return route.continue(); });
          await page.click('#settings [data-act=sync]');
          for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(100);
          await type(page, 'name', 'c1', 'Alba During'); await until(page, (d) => d.chars[0].name === 'Alba During');
          await fc(page, 'c1', 'Alpha Company');
          const duringWait = { held, message: await message(page) };
          release();
          await page.waitForFunction(() => /Synced \d/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(400);
          const got = await whole(page);
          const want = named(before, { c1: 'Alba During', c2: 'Brio Elsewhere' });
          const nf = fcsFor(got, 'c1');
          want.modules.submersibles = nf.length === 1 && nf[0].name === 'Alpha Company' ? got.modules.submersibles : null;
          const shown = { c1: await shownValue(page, 'name', 'c1'), c2: await shownValue(page, 'name', 'c2'), fc: await shownValue(page, 'fc', 'c1') };
          const msgAfter = await message(page);
          // one more sync: the cloud copy then holds the other device's change and both edits
          await page.unroute('**/graph/**');
          const etag1 = st.state.etag.f1;
          await page.click('#settings [data-act=sync]');
          for (let i = 0; i < 100 && st.state.etag.f1 === etag1; i++) await page.waitForTimeout(100);
          await page.waitForTimeout(400);
          const cloud = unpack(st.state.files.f1);
          const cloudSays = { names: cloud.chars.map((c) => [c.id, c.name]), fcs: Object.values(((cloud.modules || {}).submersibles || {}).fcs || {}).map((f) => [f.charId, f.name]) };
          record('C44', 'Main Settings: a sync under way (the cloud copy holding another device\'s change, the upload held back): a name and a free company saved during the wait; when the page says Synced the whole stored record holds the other device\'s change and both edits, the fields show them, and after one more sync the cloud copy holds all three',
            duringWait.held && same(got, want) && /Synced \d/.test(msgAfter) && same(shown, { c1: 'Alba During', c2: 'Brio Elsewhere', fc: 'Alpha Company' }) &&
            same(cloudSays.names, [['c1', 'Alba During'], ['c2', 'Brio Elsewhere']]) && same(cloudSays.fcs, [['c1', 'Alpha Company']]) && real(errors).length === 0,
            { duringWait, got, want, shown, msgAfter, cloudSays, errors: real(errors) });
          await ctx.close();
        }
        // C45: a sync request that never answers, once from "Sync now" and once at opening: an edit made meanwhile is stored and its message shown
        {
          st.state.files = {}; st.state.etag = {};
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await signedIn(page);
          let stall = false, stalled = 0;
          await page.route('**/graph/**', (route) => { if (stall && route.request().method() === 'GET') { stalled++; return; } return route.continue(); }); // a stalled request is never answered
          stall = true;
          await page.click('#settings [data-act=sync]');
          for (let i = 0; i < 100 && !stalled; i++) await page.waitForTimeout(100);
          await type(page, 'name', 'c1', 'Alba Waiting');
          const nowStored = await until(page, (d) => d.chars[0].name === 'Alba Waiting').then(() => true, () => false);
          const nowMsg = await message(page);
          // the sync at opening never answers either: the characters are shown and an edit is stored with its message
          await page.reload(); await page.waitForFunction(() => window.__settings, null, { timeout: 10000 });
          const fields = await page.waitForSelector('#settings [data-set=fc][data-id=c1]', { timeout: 10000 }).then(() => true, () => false);
          if (fields) await type(page, 'fc', 'c1', 'Kilo Company');
          const openStored = fields && await until(page, (d) => Object.values((d.modules.submersibles || {}).fcs || {}).some((f) => f.charId === 'c1' && f.name === 'Kilo Company')).then(() => true, () => false);
          const openMsg = await message(page);
          record('C45', 'Main Settings: a sync request that never answers (from "Sync now", and at opening): an edit made meanwhile is stored and its usual message shown; the characters are shown while the sync at opening waits',
            stalled > 0 && nowStored && nowMsg === 'Saved.' && fields && openStored && openMsg === 'Saved: the free company is in Submersibles.' && real(errors).length === 0,
            { stalled, nowStored, nowMsg, fields, openStored, openMsg, errors: real(errors) });
          await ctx.close();
        }
        // C48: the same things changed during a sync here and on the other device: the clash is left open, not decided
        {
          st.state.files = {}; st.state.etag = {};
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await signedIn(page);
          await fc(page, 'c1', 'Lima Company');
          const syncAndWait = async () => { const e = st.state.etag.f1; await page.click('#settings [data-act=sync]'); for (let i = 0; i < 100 && st.state.etag.f1 === e; i++) await page.waitForTimeout(100); await page.waitForTimeout(400); };
          await syncAndWait();
          const inner = unpack(st.state.files.f1);
          inner.chars.find((c) => c.id === 'c1').name = 'Alba Cloud'; inner.chars.find((c) => c.id === 'c2').name = 'Brio Cloud';
          const fid = Object.keys(inner.modules.submersibles.fcs).find((k) => inner.modules.submersibles.fcs[k].charId === 'c1');
          inner.modules.submersibles.fcs[fid].name = 'Lima Cloud';
          st.state.files.f1 = pack(inner); st.state.etag.f1 = 'e-clash';
          const before = await whole(page);
          let release = null, held = false; const gate = new Promise((ok) => { release = ok; });
          await page.route('**/graph/**', async (route) => { if (route.request().method() === 'PUT') { held = true; await gate; } return route.continue(); });
          await page.click('#settings [data-act=sync]');
          for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(100);
          await type(page, 'name', 'c1', 'Alba Local'); await until(page, (d) => d.chars[0].name === 'Alba Local');
          await fc(page, 'c1', 'Lima Local');
          release();
          const DISAGREE = 'Your devices disagree on 2 entries: open the Tracker to choose which is right (it asks on opening).';
          const waitMsg = (re) => page.waitForFunction((src) => new RegExp(src).test((document.querySelector('#settings .set-msg') || {}).textContent || ''), re, { timeout: 15000 }).then(() => page.waitForTimeout(400), () => {});
          await waitMsg('disagree|Synced');
          const cloudOf = () => { const c = unpack(st.state.files.f1); return { names: c.chars.map((x) => [x.id, x.name]), fcs: Object.values(c.modules.submersibles.fcs).map((f) => [f.charId, f.name]) }; };
          const r1 = { msg: await message(page), got: await whole(page), cloud: cloudOf() };
          const want1 = named(before, { c1: 'Alba Local', c2: 'Brio Cloud' }); want1.modules.submersibles.fcs[fid].name = 'Lima Local';
          // (2) the next sync from Settings raises the clash and uploads nothing
          await page.unroute('**/graph/**');
          await page.evaluate(() => { document.querySelector('#settings .set-msg').textContent = ''; });
          const etag1 = st.state.etag.f1;
          await page.click('#settings [data-act=sync]'); await waitMsg('disagree|Synced');
          const r2 = { msg: await message(page), etagSame: st.state.etag.f1 === etag1, got: await whole(page), cloud: cloudOf() };
          // (3) the other device settles the clash on this device's values; a later change here syncs and uploads as usual
          const settledCopy = unpack(st.state.files.f1);
          settledCopy.chars.find((c) => c.id === 'c1').name = 'Alba Local'; settledCopy.modules.submersibles.fcs[fid].name = 'Lima Local';
          st.state.files.f1 = pack(settledCopy); st.state.etag.f1 = 'e-settled';
          await name(page, 'c2', 'Brio After');
          await page.evaluate(() => { document.querySelector('#settings .set-msg').textContent = ''; });
          await syncAndWait(); await waitMsg('disagree|Synced');
          const r3 = { msg: await message(page), etag: st.state.etag.f1, got: await whole(page), cloud: cloudOf() };
          record('C48', 'Main Settings: a name and a free company changed here during a sync and differently on the other device: the clash is not decided (the page says the devices disagree, word for word as for any clash; the stored save keeps this device\'s values and everything else the sync brought); the next sync raises it again and uploads nothing; once settled, a later change syncs (Synced) and is uploaded',
            same(r1.got, want1) && r1.msg === DISAGREE && same(r1.cloud, { names: [['c1', 'Alba Cloud'], ['c2', 'Brio Cloud']], fcs: [['c1', 'Lima Cloud']] }) &&
            r2.msg === DISAGREE && r2.etagSame && same(r2.got, want1) && same(r2.cloud, r1.cloud) &&
            /^Synced \d/.test(r3.msg) && r3.etag !== 'e-settled' && same(r3.cloud, { names: [['c1', 'Alba Local'], ['c2', 'Brio After']], fcs: [['c1', 'Lima Local']] }) && same(r3.got, named(want1, { c2: 'Brio After' })) && real(errors).length === 0,
            { r1, want1, r2, r3, errors: real(errors) });
          await ctx.close();
        }
        // C51: a third character added on both devices during the same sync, with different names: a clash left open
        {
          st.state.files = {}; st.state.etag = {};
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await signedIn(page);
          const inner = unpack(st.state.files.f1);
          inner.chars.push({ id: 'c3', name: 'Cora Cloud', lodestone: null });
          for (const bag of ['ticks', 'excl', 'vals']) inner.modules.tracker[bag].c3 = {};
          inner.chars.find((c) => c.id === 'c2').name = 'Brio Cloud';
          st.state.files.f1 = pack(inner); st.state.etag.f1 = 'e-cora';
          const before = await whole(page);
          let release = null, held = false; const gate = new Promise((ok) => { release = ok; });
          await page.route('**/graph/**', async (route) => { if (route.request().method() === 'PUT') { held = true; await gate; } return route.continue(); });
          await page.click('#settings [data-act=sync]');
          for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(100);
          await count(page, 3); await name(page, 'c3', 'Cora Local');
          release();
          const DISAGREE = 'Your devices disagree on 1 entry: open the Tracker to choose which is right (it asks on opening).';
          const waitMsg = () => page.waitForFunction(() => /disagree|Synced/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 15000 }).then(() => page.waitForTimeout(400), () => {});
          const clearMsg = () => page.evaluate(() => { document.querySelector('#settings .set-msg').textContent = ''; });
          const names = () => unpack(st.state.files.f1).chars.map((x) => [x.id, x.name]);
          await waitMsg();
          const got1 = await whole(page);
          const want1 = named(before, { c2: 'Brio Cloud' }); want1.chars.push({ cls: null, gc: null, id: 'c3', lodestone: null, name: 'Cora Local' });
          for (const bag of ['ticks', 'excl', 'vals']) want1.modules.tracker[bag].c3 = {};
          const r1 = { msg: await message(page), got: got1, cloud: names() };
          // (2) the next sync raises the clash again and uploads nothing
          await page.unroute('**/graph/**'); await clearMsg();
          const etag1 = st.state.etag.f1;
          await page.click('#settings [data-act=sync]'); await waitMsg();
          const r2 = { msg: await message(page), etagSame: st.state.etag.f1 === etag1, got: await whole(page), cloud: names() };
          // (3) settled on the other device with this device's name; a later change here syncs and uploads
          const settledCopy = unpack(st.state.files.f1); settledCopy.chars.find((c) => c.id === 'c3').name = 'Cora Local';
          st.state.files.f1 = pack(settledCopy); st.state.etag.f1 = 'e-cora-settled';
          await name(page, 'c2', 'Brio After'); await clearMsg();
          await page.click('#settings [data-act=sync]'); for (let i = 0; i < 100 && st.state.etag.f1 === 'e-cora-settled'; i++) await page.waitForTimeout(100); await waitMsg();
          const r3 = { msg: await message(page), cloud: names(), got: await whole(page) };
          record('C51', 'Main Settings: a third character added during a sync here and on the other device with different names: the page says the devices disagree, the stored save keeps this device\'s name and the rest the sync brought; the next sync raises it again and uploads nothing; once settled, a later change syncs (Synced) and is uploaded',
            same(r1.got, want1) && r1.msg === DISAGREE && same(r1.cloud, [['c1', 'Alba Test'], ['c2', 'Brio Cloud'], ['c3', 'Cora Cloud']]) &&
            r2.msg === DISAGREE && r2.etagSame && same(r2.got, want1) && same(r2.cloud, r1.cloud) &&
            /^Synced \d/.test(r3.msg) && same(r3.cloud, [['c1', 'Alba Test'], ['c2', 'Brio After'], ['c3', 'Cora Local']]) && same(r3.got, named(want1, { c2: 'Brio After' })) && real(errors).length === 0,
            { r1, want1, r2, r3, errors: real(errors) });
          await ctx.close();
        }
        // C52: "Sign in" pressed while a name edit sits between its save and taking the save back in, with a change the page
        // has not heard of (written by this page's own code, so not announced to it, as when another tab's notice is still
        // on its way). After the departure to the stand-in sign-in page the whole stored record holds that change and the name.
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await page.route('**/login/authorize**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Sign-in stand-in</title>' }));
          await page.goto(ROOT4 + '#settings'); await settled(page);
          await first(page); await name(page, 'c1', 'Alba Test');
          await page.evaluate(async () => {
            const r = await CC.read(), d = CC.checkDoc(r.raw), base = d.modules.submersibles || null;
            const sec = JSON.parse(JSON.stringify(base || { fcs: {}, subs: {}, trips: {}, settings: {} }));
            sec.fcs.fosc = { name: 'Oscar Company', charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] };
            await CC.writeSection('submersibles', sec, { rev: r.rev, base });
          });
          const before = await whole(page);
          // the page's reads are held, and leaving for the sign-in page is delayed by a second so that a save started on the
          // way out can finish (otherwise the browser may cut it off when the page goes, which hides the outcome)
          await page.evaluate(() => {
            const read = CC.read; window.__held = new Promise((ok) => { window.__release = ok; }); CC.read = function () { const a = arguments; return window.__held.then(() => read.apply(CC, a)); };
            const begin = ET.cloudBegin; ET.cloudBegin = function () { const a = arguments; return new Promise((ok) => setTimeout(ok, 1000)).then(() => begin.apply(ET, a)); };
          });
          await type(page, 'name', 'c1', 'Alba Leaving');
          await page.waitForTimeout(500); // the name is saved; taking the save back in waits on the held read
          await page.click('#settings [data-act=signin]');
          await page.waitForTimeout(500);
          await page.evaluate(() => window.__release()).catch(() => {}); // the page may have left already
          await page.waitForURL(/\/login\/authorize/, { timeout: 15000 }).catch(() => {});
          const left = page.url();
          // the stored record is read from a page opened after the departure (no other page is open before it)
          const tab = await ctx.newPage(); await tab.goto(ROOT4 + 'submersibles/'); await tab.waitForSelector('html[data-ready="1"]');
          const got = await whole(tab);
          record('C52', 'Main Settings: "Sign in" pressed while a name edit is between its save and taking the save back in, with a change the page has not heard of yet: the page leaves for the sign-in page only after that, and the whole stored record holds the change and the name',
            /\/login\/authorize/.test(left) && same(got, named(before, { c1: 'Alba Leaving' })) && real(errors).length === 0, { left: left.replace(/\?.*/, ''), got, want: named(before, { c1: 'Alba Leaving' }), errors: real(errors) });
          await ctx.close();
        }
        // C56: a read held for ever after a name save, then "Sign in": within 8 seconds the browser is on the stand-in sign-in page,
        // the stored record holds the name and a change another page made before, and a second press starts no second departure
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await page.route('**/login/authorize**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Sign-in stand-in</title>' }));
          await page.goto(ROOT4 + '#settings'); await settled(page);
          await first(page); await name(page, 'c1', 'Alba Test');
          const tab = await ctx.newPage(); await tab.goto(ROOT4 + 'submersibles/'); await tab.waitForSelector('html[data-ready="1"]');
          await otherSubs(tab, (sec) => { sec.fcs.fosc = { name: 'Oscar Company', charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] }; });
          await page.waitForTimeout(600); // the page hears of it
          const before = await whole(tab);
          // from here the page's reads never answer; each departure is counted where it survives the page (local storage)
          await page.evaluate(() => {
            CC.read = function () { return new Promise(() => {}); };
            const begin = ET.cloudBegin; ET.cloudBegin = function () { localStorage.setItem('x-begins', String(+(localStorage.getItem('x-begins') || 0) + 1)); return new Promise((ok) => setTimeout(ok, 1500)).then(() => begin.apply(ET, arguments)); };
          });
          await type(page, 'name', 'c1', 'Alba Leaving');
          await page.waitForTimeout(500); // the name is stored; taking it back in waits on the read that never answers
          const t0 = Date.now();
          await page.click('#settings [data-act=signin]');
          await page.waitForTimeout(700);
          await page.click('#settings [data-act=signin]', { timeout: 2000 }).catch(() => {}); // a second press while the first is under way
          await page.waitForURL(/\/login\/authorize/, { timeout: 8000 }).catch(() => {});
          const took = Date.now() - t0, left = page.url();
          await page.waitForTimeout(2500);
          const begins = await tab.evaluate(() => localStorage.getItem('x-begins'));
          const got = await whole(tab);
          record('C56', 'Main Settings: with a read that never answers after a name save, "Sign in" takes the browser to the sign-in page within 8 seconds, the whole stored record holds the name and the change another page made before, and a second press starts no second departure',
            /\/login\/authorize/.test(left) && took < 8000 && begins === '1' && same(got, named(before, { c1: 'Alba Leaving' })) && real(errors).length === 0,
            { left: left.replace(/\?.*/, ''), took, begins, got, want: named(before, { c1: 'Alba Leaving' }), errors: real(errors) });
          await ctx.close();
        }
        // C57: "Sign in" pressed with an idle queue, and the page's reads hang only after the departure's own write has been made:
        // the browser is still on the stand-in sign-in page within 8 seconds and the stored record is whole
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await page.route('**/login/authorize**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Sign-in stand-in</title>' }));
          await page.goto(ROOT4 + '#settings'); await settled(page);
          await first(page); await name(page, 'c1', 'Alba Test');
          const tab = await ctx.newPage(); await tab.goto(ROOT4 + 'submersibles/'); await tab.waitForSelector('html[data-ready="1"]');
          await page.waitForTimeout(500);
          const before = await whole(tab);
          await page.evaluate(() => {
            const save = ET.saveState;
            ET.saveState = function () { return save.apply(ET, arguments).then((r) => { CC.read = function () { return new Promise(() => {}); }; return r; }); };
          });
          const t0 = Date.now();
          await page.click('#settings [data-act=signin]');
          await page.waitForURL(/\/login\/authorize/, { timeout: 8000 }).catch(() => {});
          const took = Date.now() - t0, left = page.url();
          const got = await whole(tab);
          record('C57', 'Main Settings: "Sign in" pressed with an idle queue, the page\'s reads hanging once the departure\'s own write has been made: the browser is on the sign-in page within 8 seconds and the whole stored record is unchanged',
            /\/login\/authorize/.test(left) && took < 8000 && same(got, before) && real(errors).length === 0, { left: left.replace(/\?.*/, ''), took, got, before, errors: real(errors) });
          await ctx.close();
        }
        // C58: the stores fail only during the write at the end of a sync here: the page says not saved, not "Synced"
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          st.state.files = {}; st.state.etag = {};
          await signedIn(page);
          await breakStores(page, 'ET', 'saveState', 'during');
          await blank(page); await page.click('#settings [data-act=sync]');
          await anyMessage(page); await page.waitForFunction(() => !/Syncing/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 15000 });
          await page.waitForTimeout(400); await release(page);
          const msg = await message(page);
          record('C58', 'Main Settings: a sync whose closing write reaches memory only (the stores fail during it) says "Not saved on this device: save a backup file", not "Synced"', msg === NOTSAVED && real(errors).length === 0, { msg, errors: real(errors) });
          await ctx.close();
        }
        // ── C59 to C64 (part 4 of the 2026-11-13 fix): bare duplicate free companies of one character are folded (two tabs,
        //    two devices, the Submersibles page opened alone); a shown transfer code follows the save; a sync that never answers
        //    no longer blocks "Sync now" after 90 seconds and its late answer changes nothing. Invented names only. ──
        const syncedMsg = (page) => page.waitForFunction(() => /Synced \d/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 20000 }).then(() => true, () => false);
        const syncHere = async (page) => { await blank(page); await page.click('#settings [data-act=sync]'); const ok = await syncedMsg(page); await page.waitForTimeout(500); return ok; };
        const subsSec = (rec) => rec.modules.submersibles || { fcs: {} };
        // C59: two Settings tabs type a free company for the same character at the same instant (both writes held until both
        // pages have read, then released together), five times: one free company for that character, on both pages and stored
        {
          const runs = [];
          for (let i = 0; i < 5; i++) {
            const { ctx, errors } = await context();
            const a = await ctx.newPage(); await openSettings(a); await first(a); await count(a, 2);
            const b = await ctx.newPage(); await openSettings(b);
            for (const p of [a, b]) await p.evaluate(() => {
              window.__gate = new Promise((ok) => { window.__open = ok; });
              const w = CC.writeSection; CC.writeSection = function () { const args = arguments; return window.__gate.then(() => w.apply(CC, args)); };
            });
            await Promise.all([type(a, 'fc', 'c1', 'Delta A ' + i), type(b, 'fc', 'c1', 'Delta B ' + i)]);
            await a.waitForTimeout(500);
            await Promise.all([a.evaluate(() => window.__open()), b.evaluate(() => window.__open())]);
            await a.waitForTimeout(2500);
            const got = await whole(a), names = fcsFor(got, 'c1').map((f) => f.name);
            const shown = { a: await shownValue(a, 'fc', 'c1'), b: await shownValue(b, 'fc', 'c1') };
            runs.push({ i, names, shown, ok: names.length === 1 && shown.a === names[0] && shown.b === names[0] && real(errors).length === 0, errors: real(errors) });
            await ctx.close();
          }
          record('C59', 'Main Settings in two tabs: a free company typed for the same character in both at the same instant (five times): after both pages have settled there is exactly one free company for that character, the same on both pages and in the stored record',
            runs.every((r) => r.ok), { runs });
        }
        // C60: two devices each add a bare free company for the same character before syncing: after the second device's sync
        // one on it; after it syncs again and the first device syncs, one on that, one in the cloud copy, the same id everywhere
        {
          st.state.files = {}; st.state.etag = {};
          const second = 'f'.repeat(64); st.kv.set(second, JSON.stringify({ rt: 'rt-p3', at: 1, used: 1 })); st.state.refreshes.set('rt-p3', true);
          const one = await context(), two = await context();
          const a = await one.ctx.newPage(); await signedIn(a);
          const b = await two.ctx.newPage(); await b.goto(ROOT4 + '#settings'); await settled(b);
          await b.evaluate((device) => localStorage.setItem('eveniunt-cloud-device', JSON.stringify({ device, at: 1 })), second);
          await b.reload(); await settled(b); await syncedMsg(b);
          await b.waitForSelector('#settings [data-set=fc][data-id=c1]', { timeout: 10000 });
          await fc(a, 'c1', 'Delta A'); await fc(b, 'c1', 'Delta B');
          const sB1 = await syncHere(b);
          const sA1 = await syncHere(a);
          const onA = fcsFor(await whole(a), 'c1').length;
          const sA2 = await syncHere(a);
          const sB2 = await syncHere(b);
          const idsOf = (sec) => Object.keys((sec || { fcs: {} }).fcs).filter((k) => sec.fcs[k].charId === 'c1');
          const ids = { a: idsOf(subsSec(await whole(a))), b: idsOf(subsSec(await whole(b))), cloud: idsOf(((unpack(st.state.files.f1)).modules || {}).submersibles) };
          record('C60', 'Two devices (stand-ins) each add a bare free company for the same character before syncing: after the second device\'s sync there is one on it; after it syncs again and the first device syncs there is one on the first, one in the cloud copy, the same id everywhere',
            sB1 && sA1 && sA2 && sB2 && onA === 1 && ids.a.length === 1 && ids.b.length === 1 && ids.cloud.length === 1 && ids.a[0] === ids.b[0] && ids.a[0] === ids.cloud[0] && real(one.errors).length === 0 && real(two.errors).length === 0,
            { sB1, sA1, sA2, sB2, onA, ids, errors: real(one.errors).concat(real(two.errors)) });
          await one.ctx.close(); await two.ctx.close();
        }
        // C61: a character's bare free company goes when another of its free companies has submarines (an empty name is filled
        // from it, the submarines stay); two free companies with submarines for one character both stay
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage(); await openSettings(page); await first(page); await count(page, 2);
          const tab = await ctx.newPage(); await tab.goto(SUBS); await tab.waitForSelector('html[data-ready="1"]');
          await page.bringToFront();
          const rec = (name, charId, order, extra) => Object.assign({ name, charId, order, unlockedSlots: 1, discovered: [1, 2] }, extra || {});
          const sec = {
            fcs: { freal: rec('', 'c1', 0, { world: 'Ravana', unlockedSlots: 2 }), fbare: rec('Typed Name', 'c1', 1), g1: rec('Gulf Company', 'c2', 2, { world: 'Ravana' }), g2: rec('Hotel Company', 'c2', 3, { world: 'Ravana' }) },
            subs: { u1: { fcId: 'freal', slot: 1, name: 'Sub One' }, u2: { fcId: 'g1', slot: 1, name: 'Sub Two' }, u3: { fcId: 'g2', slot: 1, name: 'Sub Three' } }, trips: {}, settings: {}
          };
          const before = await whole(page);
          await otherSubs(tab, (s, arg) => { Object.assign(s.fcs, arg.fcs); Object.assign(s.subs, arg.subs); }, sec);
          const wantSec = JSON.parse(JSON.stringify(sec)); delete wantSec.fcs.fbare; wantSec.fcs.freal.name = 'Typed Name';
          const want = JSON.parse(JSON.stringify(before)); want.modules.submersibles = await page.evaluate((s) => CC.checkModules({ submersibles: s }).submersibles, wantSec);
          await until(page, (d) => !d.modules.submersibles || !d.modules.submersibles.fcs.fbare).catch(() => {});
          await page.waitForTimeout(1500);
          const got = await whole(page);
          record('C61', 'A character with one free company that has submarines and one bare one: the bare one goes, the submarines stay and the empty name is filled from it; two free companies with submarines for one character both stay (the whole stored record compared)',
            same(got, want) && Object.keys(subsSec(got).subs).length === 3 && fcsFor(got, 'c1').length === 1 && fcsFor(got, 'c2').length === 2 && real(errors).length === 0, { got, want, errors: real(errors) });
          await ctx.close();
        }
        // C62: Submersibles opened alone with a stored save that holds a bare duplicate: once loaded, one remains and is stored
        {
          const { ctx, errors } = await context();
          const p0 = await ctx.newPage(); await openSettings(p0); await first(p0); await count(p0, 2); await p0.close();
          const tr = await trackerTab(ctx);
          const dup = { fcs: { fa: { name: 'Name A', charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] }, fb: { name: 'Name B', charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] } }, subs: {}, trips: {}, settings: {} };
          await tr.evaluate(async (sec) => { const r = await CC.read(), d = CC.checkDoc(r.raw); await CC.writeSection('submersibles', sec, { rev: r.rev, base: d.modules.submersibles || null }); }, dup);
          const before = await whole(tr); await tr.close();
          const subs = await ctx.newPage(); await subs.goto(SUBS); await subs.waitForSelector('html[data-ready="1"]');
          await until(subs, (d) => Object.keys(d.modules.submersibles.fcs).length === 1).catch(() => {});
          await subs.waitForTimeout(800);
          const got = await whole(subs), shown = await subs.evaluate(() => Object.keys(window.__subs.section().fcs));
          const want = JSON.parse(JSON.stringify(before)); delete want.modules.submersibles.fcs.fb;
          record('C62', 'Submersibles opened alone with a stored save holding a bare duplicate free company: after loading one remains, on the page and stored (the whole stored record compared)',
            before.modules.submersibles && Object.keys(before.modules.submersibles.fcs).length === 2 && same(got, want) && same(shown, ['fa']) && real(errors).length === 0, { got, want, shown, errors: real(errors) });
          await ctx.close();
        }
        // C63: a shown transfer code follows the save: after a name changed here and after a free company added in another
        // tab it decodes (ET.readTransferCode, as the Tracker's import does) to the stored characters and free companies
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage(); await openSettings(page); await first(page); await count(page, 2); await fc(page, 'c1', 'Mike Company');
          await page.click('#settings [data-act=code]'); await page.waitForSelector('#settings [data-code] textarea');
          await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
          const codeState = () => page.evaluate(async () => {
            const ta = document.querySelector('#settings [data-code] textarea'); if (!ta) return null;
            const dec = await ET.readTransferCode(ta.value), d = CC.checkDoc((await CC.read()).raw);
            const pick = (chars, s) => JSON.stringify({ chars: chars.map((c) => [c.id, c.name]), fcs: Object.keys((s || {}).fcs || {}).sort().map((k) => [k, s.fcs[k].name, s.fcs[k].charId]) });
            const a = pick(dec.chars, CC.checkModules(dec.modules || {}).submersibles), b = pick(d.chars, d.modules.submersibles);
            return { same: a === b, boxes: document.querySelectorAll('#settings [data-code] textarea').length, decoded: a, stored: b };
          });
          const current = async () => { let s = null; for (let i = 0; i < 20; i++) { s = await codeState(); if (s && s.same) break; await page.waitForTimeout(250); } return s; };
          const s0 = await codeState();
          await name(page, 'c1', 'Alba Coded'); const s1 = await current();
          const tab = await ctx.newPage(); await tab.goto(SUBS); await tab.waitForSelector('html[data-ready="1"]');
          await otherSubs(tab, (s) => { s.fcs.fnov = { name: 'November Company', charId: 'c2', order: 5, unlockedSlots: 1, discovered: [1, 2] }; });
          await page.bringToFront(); const s2 = await current();
          // the save changes while the first code is still being made (that code is made from the older save and is held back):
          // the code shown is the newer one; then a remake that fails removes the code
          await page.evaluate(() => { document.querySelector('#settings [data-code]').innerHTML = ''; });
          await page.evaluate(() => {
            const orig = ET.makeTransferCode; let n = 0; window.__origCode = orig; window.__held = new Promise((ok) => { window.__release = ok; });
            ET.makeTransferCode = function (st) { return orig(st).then((code) => (n++ === 0 ? window.__held.then(() => code) : code)); };
          });
          await page.click('#settings [data-act=code]');
          await name(page, 'c1', 'Alba Coded Twice');
          await page.evaluate(() => window.__release()); await page.waitForTimeout(600);
          const s3 = await current();
          await page.evaluate(() => { ET.makeTransferCode = function () { return Promise.reject(new Error('cannot make')); }; });
          await name(page, 'c1', 'Alba Coded Thrice'); await page.waitForTimeout(600);
          const gone = await page.evaluate(() => !document.querySelector('#settings [data-code] textarea'));
          await page.evaluate(() => { ET.makeTransferCode = window.__origCode; });
          record('C63', 'A shown transfer code is made again when the save changes: after a name is changed here and after a free company is added in another tab it decodes to the stored characters and free companies, in the same box; when the save changes while the first code is still being made the code shown is the newer one; a remake that fails removes the code',
            s0 && s0.same && s1 && s1.same && s1.boxes === 1 && s2 && s2.same && s2.boxes === 1 && /November Company/.test(s2.decoded) && s3 && s3.same && /Alba Coded Twice/.test(s3.decoded) && gone && real(errors).length === 0, { s0, s1, s2, s3, gone, errors: real(errors) });
          await ctx.close();
        }
        // C66: delayed code generation is current after both character-count and first-name changes, including late old results.
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage(); await openSettings(page); await first(page); await count(page, 2);
          await page.evaluate(() => {
            window.__origCode66 = ET.makeTransferCode; window.__requests66 = [];
            ET.makeTransferCode = function (st) {
              const code = 'C66:' + JSON.stringify({ chars: st.chars.map((c) => [c.id, c.name]) });
              return new Promise((resolve) => window.__requests66.push({ code, release: () => resolve(code) }));
            };
          });
          const currentSnapshot = async () => page.evaluate(async () => {
            const d = CC.checkDoc((await CC.read()).raw), r = window.__requests66[window.__requests66.length - 1];
            return !!r && r.code === 'C66:' + JSON.stringify({ chars: d.chars.map((c) => [c.id, c.name]) });
          });
          const shownCode = () => page.evaluate(() => { const ta = document.querySelector('#settings [data-code] textarea'); return ta && ta.value; });
          const waitForCurrent = async () => { for (let i = 0; i < 40; i++) { if (await currentSnapshot()) return; await page.waitForTimeout(100); } throw new Error('current transfer-code request was not started'); };
          await page.click('#settings [data-act=code]'); await page.waitForFunction(() => window.__requests66.length >= 1);
          const hiddenAtStart = await page.evaluate(() => !document.querySelector('#settings [data-code] textarea'));
          await count(page, 3); await waitForCurrent();
          const hiddenForCount = await page.evaluate(() => !document.querySelector('#settings [data-code] textarea'));
          const countOld = 0;
          const expectedCount = await page.evaluate(async () => { const d = CC.checkDoc((await CC.read()).raw); return 'C66:' + JSON.stringify({ chars: d.chars.map((c) => [c.id, c.name]) }); });
          const countCurrent = await page.evaluate(() => window.__requests66.length - 1);
          await page.evaluate((i) => window.__requests66[i].release(), countCurrent);
          await page.waitForFunction(async () => {
            const ta = document.querySelector('#settings [data-code] textarea');
            const d = CC.checkDoc((await CC.read()).raw); return !!ta && ta.value === 'C66:' + JSON.stringify({ chars: d.chars.map((c) => [c.id, c.name]) });
          });
          await page.evaluate((i) => window.__requests66[i].release(), countOld); await page.waitForTimeout(200);
          const afterLateCount = await shownCode();

          const nameOld = await page.evaluate(() => window.__requests66.length);
          await page.click('#settings [data-act=code]'); await page.waitForFunction((n) => window.__requests66.length > n, nameOld);
          await name(page, 'c1', 'Alba After Count'); await waitForCurrent();
          const hiddenForName = await page.evaluate(() => !document.querySelector('#settings [data-code] textarea'));
          const nameCurrent = await page.evaluate(() => window.__requests66.length - 1);
          await page.evaluate((i) => window.__requests66[i].release(), nameCurrent);
          await page.waitForFunction(async () => {
            const ta = document.querySelector('#settings [data-code] textarea');
            const d = CC.checkDoc((await CC.read()).raw); return !!ta && ta.value === 'C66:' + JSON.stringify({ chars: d.chars.map((c) => [c.id, c.name]) });
          });
          await page.evaluate((i) => window.__requests66[i].release(), nameOld); await page.waitForTimeout(200);
          const afterLateName = await shownCode();
          const expected = await page.evaluate(async () => { const d = CC.checkDoc((await CC.read()).raw); return 'C66:' + JSON.stringify({ chars: d.chars.map((c) => [c.id, c.name]) }); });
          await page.evaluate(() => { window.__requests66.forEach((x) => x.release()); ET.makeTransferCode = window.__origCode66; });
          record('C66', 'Delayed transfer-code generation after a character-count change and a first-name change stays hidden pending regeneration; late older results never replace the code matching the stored save',
            hiddenAtStart && hiddenForCount && hiddenForName && afterLateCount === expectedCount && afterLateName === expected && expected.includes('Alba After Count') && real(errors).length === 0,
            { hiddenAtStart, hiddenForCount, hiddenForName, afterLateCount, expectedCount, afterLateName, expected, errors: real(errors) });
          await ctx.close();
        }
        // C67: the exposed sign-in helper is called while startup sync never answers; it still takes the bounded departure path.
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage();
          await page.route('**/login/authorize**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Sign-in stand-in</title>' }));
          await signedIn(page);
          const held = []; let gets = 0;
          await page.route('**/graph/**', (route) => {
            if (route.request().method() === 'GET') { gets++; held.push(route); return; }
            return route.continue();
          });
          await page.reload(); await page.waitForFunction(() => window.__settings, null, { timeout: 10000 });
          for (let i = 0; i < 100 && !held.length; i++) await page.waitForTimeout(100);
          const startupStalled = held.length > 0;
          const t0 = Date.now();
          await page.evaluate(() => window.__settings.signIn());
          const left = await page.waitForURL(/\/login\/authorize/, { timeout: 8000 }).then(() => true, () => false);
          const took = Date.now() - t0;
          await Promise.all(held.map((r) => r.abort().catch(() => {})));
          record('C67', 'The exposed Settings sign-in path leaves within its bounded departure while initial cloud sync is stalled forever',
            startupStalled && gets > 0 && left && took < 8000 && real(errors).length === 0, { startupStalled, gets, left, took, errors: real(errors) });
          await ctx.close();
        }
        // C68: supersession after the old sync has entered its local save cancels that save before it can overwrite a newer sync.
        {
          st.state.files = {}; st.state.etag = {};
          const { ctx, errors } = await context();
          const page = await ctx.newPage(); await signedIn(page);
          let gets = 0;
          await page.route('**/graph/**', (route) => { if (route.request().method() === 'GET') { gets++; page.evaluate((n) => { window.__graphGets68 = n; }, gets).catch(() => {}); } return route.continue(); });
          await page.evaluate(() => {
            const transact = CC.transact; window.__transactOrig68 = transact; window.__holdNext68 = true;
            CC.transact = function (fn, options) {
              if (!window.__holdNext68) return transact(fn, options);
              window.__holdNext68 = false;
              return new Promise((resolve, reject) => { window.__releaseOld68 = () => transact(fn, options).then(resolve, reject); });
            };
            const perf = performance.now.bind(performance); window.__skew68 = 0; performance.now = () => perf() + window.__skew68;
          });
          await page.click('#settings [data-act=sync]');
          await page.waitForFunction(() => typeof window.__releaseOld68 === 'function', null, { timeout: 15000 });
          const localBeforeRelease = await whole(page);
          const newerCloud = unpack(st.state.files.f1); newerCloud.chars.find((c) => c.id === 'c2').name = 'Brio Newer Cloud';
          st.state.files.f1 = pack(newerCloud); st.state.etag.f1 = 'e-newer-cloud';
          await page.evaluate(() => { window.__skew68 = 91000; });
          await blank(page); await page.click('#settings [data-act=sync]');
          // The page-side route counter proves the replacement cloud request has begun before releasing the old local save.
          const secondStarted = await page.waitForFunction(() => window.__graphGets68 >= 2, null, { timeout: 15000 }).then(() => true, () => false);
          await page.evaluate(() => window.__releaseOld68());
          const synced = await page.waitForFunction(() => /Synced \d/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 15000 }).then(() => true, () => false);
          await page.waitForTimeout(400);
          const after = await whole(page), msg = await message(page), cloud = unpack(st.state.files.f1);
          await page.evaluate(() => { CC.transact = window.__transactOrig68; });
          record('C68', 'When an old sync is superseded after entering its local save, its guarded write is cancelled and the replacement sync keeps the newer cloud character',
            secondStarted && synced && after.chars.find((c) => c.id === 'c2').name === 'Brio Newer Cloud' && cloud.chars.find((c) => c.id === 'c2').name === 'Brio Newer Cloud' && /Synced \d/.test(msg) && localBeforeRelease.chars.length === after.chars.length && real(errors).length === 0,
            { gets, secondStarted, synced, names: after.chars.map((c) => c.name), cloudNames: cloud.chars.map((c) => c.name), msg, errors: real(errors) });
          await ctx.close();
        }
        // C69: cleanup failure is visible after the primary Settings edit saves, without a false failure message or retry loop.
        {
          const { ctx, errors } = await context();
          const page = await ctx.newPage(); await openSettings(page); await first(page); await count(page, 2);
          await page.evaluate(() => {
            window.__foldOrig69 = CC.foldSection; window.__foldCalls69 = 0;
            CC.foldSection = function () { window.__foldCalls69++; return Promise.reject(new Error('injected cleanup write failure')); };
          });
          await fc(page, 'c1', 'Visible Cleanup Company'); await page.waitForTimeout(700);
          const msg = await message(page), got = await whole(page), calls = await page.evaluate(() => window.__foldCalls69);
          await page.evaluate(() => { CC.foldSection = window.__foldOrig69; });
          record('C69', 'A duplicate-fold write failure is shown while the primary free-company edit remains saved, and cleanup is not retried in a loop',
            /cleanup could not be saved/.test(msg) && fcsFor(got, 'c1').some((f) => f.name === 'Visible Cleanup Company') && calls === 1 && !/Not saved on this device/.test(msg) && real(errors).length === 0,
            { msg, fcs: fcsFor(got, 'c1'), calls, errors: real(errors) });
          await ctx.close();
        }
        // C64: a sync request that never answers: inside 90 seconds "Sync now" starts nothing; after them (the page's performance.now
        // moved on, no waiting) it starts a new attempt that ends "Synced"; when the first request is answered at last nothing changes
        {
          st.state.files = {}; st.state.etag = {};
          const { ctx, errors } = await context();
          const page = await ctx.newPage(); await signedIn(page);
          let stall = false, released = false, late = []; const held = [];
          await page.route('**/graph/**', (route) => { if (released) late.push(route.request().method()); if (stall && route.request().method() === 'GET') { held.push(route); return; } return route.continue(); });
          await page.evaluate(() => { const o = performance.now.bind(performance); window.__skew = 0; performance.now = () => o() + window.__skew; });
          stall = true;
          await page.click('#settings [data-act=sync]');
          for (let i = 0; i < 100 && !held.length; i++) await page.waitForTimeout(100);
          const firstHeld = held.length;
          await page.click('#settings [data-act=sync]'); await page.waitForTimeout(600);
          const blockedEarly = firstHeld > 0 && held.length === firstHeld;
          await page.evaluate(() => { window.__skew = 91000; }); stall = false;
          await blank(page); await page.click('#settings [data-act=sync]');
          const synced = await syncedMsg(page); await page.waitForTimeout(500);
          const msg = await message(page), before = await whole(page), cloud = JSON.stringify([st.state.files.f1, st.state.etag.f1]);
          const shownOf = async () => ({ c1: await shownValue(page, 'name', 'c1'), c2: await shownValue(page, 'name', 'c2'), fc: await shownValue(page, 'fc', 'c1') }), shownBefore = await shownOf();
          released = true;
          await Promise.all(held.map((r) => r.continue().catch(() => {})));
          await page.waitForTimeout(2500);
          const after = await whole(page), msgAfter = await message(page), shownAfter = await shownOf(), cloudAfter = JSON.stringify([st.state.files.f1, st.state.etag.f1]);
          record('C64', 'Main Settings: a sync request that never answers does not block "Sync now" after 90 seconds (the page\'s steady clock moved on): the new attempt ends "Synced", and when the first request is answered later the stand-in gets no further request from the first attempt (no upload), and the stored record, the cloud copy, the fields and the message are unchanged',
            blockedEarly && synced && /Synced \d/.test(msg) && same(after, before) && msgAfter === msg && same(shownAfter, shownBefore) && cloudAfter === cloud && late.length === 0 && real(errors).length === 0,
            { blockedEarly, synced, msg, msgAfter, same: same(after, before), cloudSame: cloudAfter === cloud, late, errors: real(errors) });
          await ctx.close();
        }
        // C65: the Submersibles setup is open on a bare free company (Edit) when another page stores a second bare one for the same
        // character that wins the fold: the open one is removed under the wizard; saving the wizard stores it again, with its
        // submarine, under the same id; the other bare one goes; the whole stored record is as expected
        {
          const { ctx, errors } = await context();
          const p0 = await ctx.newPage(); await openSettings(p0); await first(p0); await count(p0, 2); await p0.close();
          const w = await ctx.newPage(); await w.goto(SUBS); await w.waitForSelector('html[data-ready="1"]');
          const bare = (name) => ({ name, charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] });
          await otherSubs(w, (sec, arg) => { sec.fcs.fz = arg; }, bare('Zulu Company'));
          const p = await ctx.newPage(); await p.goto(SUBS); await p.waitForSelector('html[data-ready="1"]');
          await p.waitForFunction(() => window.__subs && window.__subs.startWizard);
          await p.evaluate(() => window.__subs.startWizard('fz')); await p.waitForTimeout(300);
          await otherSubs(w, (sec, arg) => { sec.fcs.fa = arg; }, bare('Alpha Company'));
          await p.waitForTimeout(1500);
          const removed = await p.evaluate(() => !window.__subs.section().fcs.fz);
          const before = await whole(w);
          for (let i = 0; i < 10 && !(await p.$('[data-act=wsave]')); i++) { const n = await p.$('[data-act=wnext]'); if (!n) break; await n.click(); await p.waitForTimeout(150); }
          const sv = await p.$('[data-act=wsave]'); if (sv) await sv.click();
          await p.waitForTimeout(1500);
          const got = await whole(p), fcs = fcsFor(got, 'c1'), subIds = Object.keys(subsSec(got).subs || {});
          const open = await p.evaluate(() => !!document.querySelector('.wiz'));
          const ok = removed && !!sv && !open && fcs.length === 1 && fcs[0].name === 'Zulu Company' && subIds.length >= 1 && subIds.every((k) => Object.keys(subsSec(got).fcs).includes(subsSec(got).subs[k].fcId));
          record('C65', 'Submersibles: a free company being edited in the setup is removed by the fold (another page stored a bare duplicate that wins); saving the setup stores it again under the same id with its submarine, one free company remains for the character, no error',
            ok && Object.keys(subsSec(got).fcs).includes('fz') && !subsSec(got).fcs.fa && real(errors).length === 0, { removed, sv: !!sv, open, fcs, subIds, before, got, errors: real(errors) });
          await ctx.close();
        }
        // C70: a refused delayed Submersibles write reconciles with the stored copy, then accepts
        // a later independent edit without reload. The write timer and intervening storage steps
        // are held explicitly so the collision is deterministic.
        {
          const { ctx, errors } = await context();
          const p0 = await ctx.newPage(); await openSettings(p0); await first(p0); await count(p0, 2); await p0.close();
          const w = await ctx.newPage(); await w.goto(SUBS); await w.waitForSelector('html[data-ready="1"]');
          const bare = (name, order) => ({ name, charId: 'c1', order, unlockedSlots: 1, discovered: [1, 2] });
          await otherSubs(w, (sec) => { sec.fcs.fz = { name: 'Zulu Company', charId: 'c1', order: 1, unlockedSlots: 1, discovered: [1, 2] }; });
          const p = await ctx.newPage(); await p.goto(SUBS); await p.waitForSelector('html[data-ready="1"]');
          await p.waitForFunction(() => window.__subs && window.__subs.startWizard);
          await p.evaluate(() => {
            const native = window.setTimeout; window.__heldWrites = []; window.__holdWrites = true;
            window.setTimeout = function (fn, ms) { if (ms === 250 && window.__holdWrites) { window.__heldWrites.push(fn); return 900000 + window.__heldWrites.length; } return native.apply(window, arguments); };
          });
          await p.evaluate(() => window.__subs.startWizard('fz')); await p.waitForTimeout(300);
          for (let i = 0; i < 12 && !(await p.$('[data-act=wsave]')); i++) { const n = await p.$('[data-act=wnext]'); if (!n) break; await n.click(); await p.waitForTimeout(100); }
          const sv = await p.$('[data-act=wsave]'); if (sv) await sv.click();
          const held = await p.evaluate(() => window.__heldWrites.length);
          await otherSubs(w, (sec) => { sec.fcs.fa = { name: 'Alpha Company', charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] }; sec.subs.sx = { fcId: 'fa', slot: 1, name: 'Other Device Sub', rank: 5, voyage: null }; });
          const folded = await w.evaluate(() => CC.foldSection('submersibles', FLEET.foldFcs));
          await p.evaluate(() => { window.__holdWrites = false; window.__heldWrites.splice(0).forEach((fn) => fn()); });
          await p.waitForFunction(() => /slot changed elsewhere/.test((document.querySelector('#status') || {}).textContent || ''), null, { timeout: 10000 });
          const afterRefusal = await p.evaluate(async () => ({
            saved: CC.checkDoc((await CC.read()).raw).modules.submersibles,
            shown: window.__subs.section(), status: document.querySelector('#status').textContent
          }));
          await p.click('[data-sort=time]');
          await p.waitForTimeout(300);
          await p.waitForFunction(() => !document.querySelector('#status').textContent, null, { timeout: 10000 });
          await p.waitForTimeout(1200);
          const afterEdit = await whole(p);
          const ok = held === 1 && folded.removed.join() === 'fz' && /re-enter any unsaved edits/.test(afterRefusal.status)
            && afterRefusal.saved.subs.sx && Object.keys(afterRefusal.saved.subs).length === 1
            && same(afterRefusal.shown, afterRefusal.saved) && afterEdit.modules.submersibles.settings.prefs && afterEdit.modules.submersibles.settings.prefs.sort === 'time'
            && real(errors).length === 0;
          record('C70', 'Submersibles refused write: current saved data and a clear re-entry message appear at once; a later sort edit saves without reloading',
            ok, { held, removed: folded.removed, afterRefusal, afterEdit, errors: real(errors) });
          await ctx.close();
        }
        // C71 to C73 (R3 regressions, AUD-20261114-SETTINGS-CLOUD-INTEGRITY-R3-001): two devices on the stand-ins meet on one
        // submarine slot or one free company. A merge applied without asking keeps every record; the Tracker asks; the owner's
        // answer is applied on every device and no submarine is left without its free company.
        {
          const r3dev = (ch, rt) => { const key = ch.repeat(64); st.kv.set(key, JSON.stringify({ rt, at: 1, used: 1 })); st.state.refreshes.set(rt, true); return key; };
          const ready4 = async (pg) => { await pg.waitForFunction(() => window.__settings, null, { timeout: 10000 }); await pg.evaluate(() => window.__settings.ready()); };
          const msg4 = (pg) => pg.evaluate(() => ((document.querySelector('#settings .set-msg') || {}).textContent || ''));
          const sync4 = async (pg) => {
            await pg.bringToFront(); await blank(pg); await pg.click('#settings [data-act=sync]');
            await pg.waitForFunction(() => /Synced \d|disagree/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
            await pg.waitForTimeout(700); return msg4(pg);
          };
          const device4 = async (ctx, key, withChars) => {
            const pg = await ctx.newPage(); await pg.goto(ROOT4 + '#settings'); await ready4(pg); if (withChars) await first(pg);
            await pg.evaluate((d) => localStorage.setItem('eveniunt-cloud-device', JSON.stringify({ device: d, at: 1 })), key);
            await pg.reload(); await ready4(pg);
            await pg.waitForFunction(() => /Synced \d/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
            return pg;
          };
          const subs4 = async (ctx) => { const pg = await ctx.newPage(); await pg.goto(ROOT4 + 'submersibles/'); await pg.waitForSelector('html[data-ready="1"]'); await pg.waitForTimeout(300); return pg; };
          const wizard4 = async (pg, fcId) => {
            await pg.bringToFront(); await pg.evaluate((id) => window.__subs.startWizard(id), fcId); await pg.waitForTimeout(300);
            for (let i = 0; i < 12 && !(await pg.$('[data-act=wsave]')); i++) { const n = await pg.$('[data-act=wnext]'); if (!n) break; await n.click(); await pg.waitForTimeout(100); }
            const sv = await pg.$('[data-act=wsave]'); if (sv) await sv.click(); await pg.waitForTimeout(1200); return !!sv;
          };
          const tracker4 = async (ctx, pickFor) => {
            const t = await ctx.newPage(); await t.goto(ROOT4 + 'tracker/');
            await t.waitForFunction(() => window.__tracker && window.__tracker.ST, null, { timeout: 30000 });
            const shown = await t.waitForSelector('dialog[open] .conf', { timeout: 30000 }).then(() => true, () => false);
            let rows = [];
            if (shown) {
              rows = await t.evaluate(() => [...document.querySelectorAll('dialog[open] .conf')].map((c) => ({ id: c.querySelector('[data-pick]').dataset.pick, text: c.querySelector('.w').textContent })));
              for (const r of rows) { const v = pickFor(r.id); if (v) await t.evaluate(({ id, v }) => { for (const b of document.querySelectorAll('dialog[open] [data-pick]')) if (b.dataset.pick === id && b.dataset.v === v) b.click(); }, { id: r.id, v }); }
              await t.click('dialog[open] #apply'); await t.waitForTimeout(3000);
            }
            await t.close(); return { shown, rows };
          };
          const subsOf = (rec) => (rec.modules.submersibles || { subs: {} });
          const names4 = (sec) => Object.values((sec || { subs: {} }).subs || {}).map((x) => x.name).sort();
          const orphans4 = (sec) => Object.entries((sec || { subs: {} }).subs || {}).filter(([, x]) => !((sec.fcs || {})[x.fcId])).map(([k]) => k);
          const cloud4 = () => (st.state.files.f1 ? ((unpack(st.state.files.f1).modules || {}).submersibles || null) : null);
          const solid = (name) => ({ name, charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2], world: 'Ravana' });
          // C71: device A sets up slot 1 while its Settings sync brings device B's submarine for that slot (upload held)
          {
            st.state.files = {}; st.state.etag = {};
            const one = await context(), two = await context();
            const a = await device4(one.ctx, r3dev('c', 'rt-c71a'), true), subsA = await subs4(one.ctx);
            await otherSubs(subsA, (sec, x) => { sec.fcs.fx = x; }, solid('Xray Company')); await a.waitForTimeout(800); await sync4(a);
            const b = await device4(two.ctx, r3dev('d', 'rt-c71b'), false), subsB = await subs4(two.ctx);
            await wizard4(subsB, 'fx'); await otherSubs(subsB, (sec) => { for (const id of Object.keys(sec.subs)) sec.subs[id].name = 'B Device Sub'; }); await b.waitForTimeout(800); await sync4(b);
            let release = null, held = false; const gate = new Promise((ok) => { release = ok; });
            await a.route('**/graph/**', async (route) => { if (route.request().method() === 'PUT' && !held) { held = true; await gate; } return route.continue(); });
            await a.bringToFront(); await blank(a); await a.click('#settings [data-act=sync]');
            for (let i = 0; i < 150 && !held; i++) await a.waitForTimeout(100);
            await wizard4(subsA, 'fx'); await otherSubs(subsA, (sec) => { for (const id of Object.keys(sec.subs)) if (sec.subs[id].name !== 'B Device Sub') sec.subs[id].name = 'A Device Sub'; }); await a.waitForTimeout(1000);
            release(); await a.waitForFunction(() => /Synced \d|disagree/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {}); await a.waitForTimeout(1200);
            const msgA = await msg4(a), afterSync = names4(subsOf(await whole(a)));
            const asked = await tracker4(one.ctx, () => 'remote'); // the owner keeps the other device's submarine
            await sync4(b); await sync4(a);
            const fa = subsOf(await whole(a)), fb = subsOf(await whole(b)), fc = cloud4();
            const ok = held && /disagree/.test(msgA) && same(afterSync, ['A Device Sub', 'B Device Sub']) && asked.shown && asked.rows.length === 1 && /slot 1 of “Xray Company”/.test(asked.rows[0].text)
              && same(names4(fa), ['B Device Sub']) && same(names4(fb), ['B Device Sub']) && same(names4(fc), ['B Device Sub']) && real(one.errors).length === 0 && real(two.errors).length === 0;
            record('C71', 'Two devices (stand-ins): a slot clash met inside the end-of-sync merge from Settings deletes neither submarine; the Tracker asks, and the owner\'s answer (the other device\'s submarine) is applied on both devices and the cloud copy',
              ok, { held, msgA, afterSync, asked, final: { a: names4(fa), b: names4(fb), cloud: names4(fc) }, errors: real(one.errors).concat(real(two.errors)) });
            await one.ctx.close(); await two.ctx.close();
          }
          // C72: both devices set up slot 1 of one free company with identical-looking records (default name and rank)
          {
            st.state.files = {}; st.state.etag = {};
            const one = await context(), two = await context();
            const a = await device4(one.ctx, r3dev('c', 'rt-c72a'), true), subsA = await subs4(one.ctx);
            await otherSubs(subsA, (sec, x) => { sec.fcs.fy = x; }, solid('Yankee Company')); await a.waitForTimeout(800); await sync4(a);
            const b = await device4(two.ctx, r3dev('d', 'rt-c72b'), false), subsB = await subs4(two.ctx);
            await wizard4(subsB, 'fy'); await wizard4(subsA, 'fy');
            await sync4(b); const msgA = await sync4(a);
            const asked = await tracker4(one.ctx, () => 'local');
            await sync4(b); await sync4(a);
            const inSlot = (sec) => Object.keys(sec.subs || {}).filter((k) => sec.subs[k].fcId === 'fy' && sec.subs[k].slot === 1);
            const fa = subsOf(await whole(a)), fb = subsOf(await whole(b));
            await subsA.reload(); await subsA.waitForSelector('html[data-ready="1"]'); await subsA.waitForTimeout(800);
            const board = await subsA.evaluate(() => document.querySelectorAll('.sub[data-sub]').length);
            const ok = /disagree/.test(msgA) && asked.shown && asked.rows.length === 1 && /this device’s “Sub 1”/.test(asked.rows[0].text) && inSlot(fa).length === 1 && same(inSlot(fa), inSlot(fb)) && board === 1
              && real(one.errors).length === 0 && real(two.errors).length === 0;
            record('C72', 'Two devices (stand-ins) fill one slot with identical-looking submarines: the Tracker asks; afterwards one submarine is in the slot on both devices and the board shows it',
              ok, { msgA, asked, a: inSlot(fa), b: inSlot(fb), board, errors: real(one.errors).concat(real(two.errors)) });
            await one.ctx.close(); await two.ctx.close();
          }
          // C73: a free company renamed and its submarine sent on A, both removed on B; the owner answers the two rows differently
          {
            st.state.files = {}; st.state.etag = {};
            const one = await context(), two = await context();
            const a = await device4(one.ctx, r3dev('c', 'rt-c73a'), true), subsA = await subs4(one.ctx);
            await otherSubs(subsA, (sec, x) => { sec.fcs.fz = x; sec.subs.s1 = { fcId: 'fz', slot: 1, name: 'Zulu One', rank: 10, voyage: null }; }, solid('Zulu Company')); await a.waitForTimeout(800); await sync4(a);
            const b = await device4(two.ctx, r3dev('d', 'rt-c73b'), false), subsB = await subs4(two.ctx);
            await otherSubs(subsB, (sec) => { Object.keys(sec.subs).forEach((id) => { if (sec.subs[id].fcId === 'fz') delete sec.subs[id]; }); delete sec.fcs.fz; }); await b.waitForTimeout(800); await sync4(b);
            await otherSubs(subsA, (sec) => { sec.fcs.fz.name = 'Zulu Company Renamed'; sec.subs.s1.voyage = { sentAt: Date.now(), route: [1], returnAt: Date.now() + 3600000 }; }); await a.waitForTimeout(800);
            const msgA = await sync4(a);
            const asked = await tracker4(one.ctx, (id) => (id.includes('"fcs"') ? 'remote' : 'local'));
            await sync4(b); await sync4(a); await sync4(b);
            const fa = subsOf(await whole(a)), fb = subsOf(await whole(b)), fc = cloud4() || { fcs: {}, subs: {} };
            const fcRow = asked.rows.find((r) => r.id.includes('"fcs"'));
            const ok = /disagree on 2/.test(msgA) && asked.shown && fcRow && /removes its submarine “Zulu One” and its logged voyages/.test(fcRow.text)
              && !orphans4(fa).length && !orphans4(fb).length && !orphans4(fc).length && !fa.fcs.fz && !fb.fcs.fz && !fc.fcs.fz && !Object.keys(fa.subs).length && !Object.keys(fb.subs).length
              && real(one.errors).length === 0 && real(two.errors).length === 0;
            record('C73', 'Two devices (stand-ins): a free company changed on one and removed on the other, with its submarine; answering "other device" for the free company and "this device" for its submarine removes both everywhere, leaves no submarine without its free company, and stays removed over further syncs',
              ok, { msgA, asked, final: { a: { fcs: Object.keys(fa.fcs), subs: Object.keys(fa.subs) }, b: { fcs: Object.keys(fb.fcs), subs: Object.keys(fb.subs) }, cloud: { fcs: Object.keys(fc.fcs || {}), subs: Object.keys(fc.subs || {}) } }, errors: real(one.errors).concat(real(two.errors)) });
            await one.ctx.close(); await two.ctx.close();
          }
          // C74 (F-01 of the ChatGPT review): a free company renamed on A and removed (with its submarine) on B; the owner keeps
          // A's free company: its unchanged submarine comes back with it on both devices and the cloud copy
          {
            st.state.files = {}; st.state.etag = {};
            const one = await context(), two = await context();
            const a = await device4(one.ctx, r3dev('c', 'rt-c74a'), true), subsA = await subs4(one.ctx);
            await otherSubs(subsA, (sec, x) => { sec.fcs.f1 = x; sec.subs.s1 = { fcId: 'f1', slot: 1, name: 'Vanguard', rank: 5, voyage: null }; }, solid('Company')); await a.waitForTimeout(800); await sync4(a);
            const b = await device4(two.ctx, r3dev('d', 'rt-c74b'), false), subsB = await subs4(two.ctx);
            await otherSubs(subsB, (sec) => { Object.keys(sec.subs).forEach((id) => { if (sec.subs[id].fcId === 'f1') delete sec.subs[id]; }); delete sec.fcs.f1; }); await b.waitForTimeout(800); await sync4(b);
            await otherSubs(subsA, (sec) => { sec.fcs.f1.name = 'Renamed Company'; }); await a.waitForTimeout(800);
            const msgA = await sync4(a);
            const asked = await tracker4(one.ctx, () => 'local');
            await sync4(b); await sync4(a); await sync4(b);
            const fa = subsOf(await whole(a)), fb = subsOf(await whole(b)), fc = cloud4() || { fcs: {}, subs: {} };
            await subsB.reload(); await subsB.waitForSelector('html[data-ready="1"]'); await subsB.waitForTimeout(800);
            const boardB = await subsB.evaluate(() => [...document.querySelectorAll('.sub[data-sub] .sub-name')].map((e) => e.textContent.trim()));
            const has = (x) => !!(x.fcs || {}).f1 && x.fcs.f1.name === 'Renamed Company' && !!(x.subs || {}).s1 && x.subs.s1.fcId === 'f1';
            const ok = /disagree on 1/.test(msgA) && asked.shown && asked.rows.length === 1 && /keeping the free company keeps it too/.test(asked.rows[0].text)
              && has(fa) && has(fb) && has(fc) && boardB.some((t) => /Vanguard/.test(t)) && real(one.errors).length === 0 && real(two.errors).length === 0;
            record('C74', 'Two devices (stand-ins): a free company renamed on one and removed with its submarine on the other; keeping the renamed free company keeps its unchanged submarine on both devices and the cloud copy, and the board shows it',
              ok, { msgA, asked, a: { fcs: Object.keys(fa.fcs), subs: Object.keys(fa.subs) }, b: { fcs: Object.keys(fb.fcs), subs: Object.keys(fb.subs) }, cloud: { fcs: Object.keys(fc.fcs || {}), subs: Object.keys(fc.subs || {}) }, boardB, errors: real(one.errors).concat(real(two.errors)) });
            await one.ctx.close(); await two.ctx.close();
          }
        }
        server4.close();
      }
      // C49: an emptied free-company box shows the free company's name again (the free company is kept, as before)
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page);
        await fc(page, 'c1', 'Mike Company');
        const before = await whole(page);
        await type(page, 'fc', 'c1', ''); await page.waitForTimeout(800);
        const shown = await shownValue(page, 'fc', 'c1'), msg = await message(page), got = await whole(page);
        record('C49', 'Main Settings: emptying a free-company box keeps the free company and the box shows its name again; the message is the one shown before; the whole stored record is unchanged',
          shown === 'Mike Company' && msg === 'Saved: the free company is in Submersibles.' && same(got, before) && real(errors).length === 0, { shown, msg, got, before, errors: real(errors) });
        await ctx.close();
      }
      // C50: a save this version must not write (stored by a newer version in another tab): a name, the number of characters,
      // a free company and the night rule each say they were not saved and change nothing; once the save is writable again
      // an edit is saved
      {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await name(page, 'c1', 'Alba Test'); await fc(page, 'c1', 'November Company');
        const tab = await ctx.newPage(); await tab.goto(SUBS); await tab.waitForSelector('html[data-ready="1"]');
        const before = await whole(page);
        await tab.evaluate(async () => { await CC.transact((raw) => Object.assign(JSON.parse(JSON.stringify(raw)), { v: CC.VERSION + 1 })); });
        await page.bringToFront(); await page.waitForTimeout(500);
        const rawNow = () => page.evaluate(async () => JSON.stringify((await CC.read()).raw));
        const raw0 = await rawNow();
        const clear = () => page.evaluate(() => { const m = document.querySelector('#settings .set-msg'); if (m) m.textContent = ''; });
        const NOT = 'Not saved on this device: This save was written by a newer version of the app. Reload the page to update.';
        const msgs = {}, shown = {};
        const setTime = (v) => page.evaluate((v) => { const el = document.querySelector('#settings [data-set=qfrom]'); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
        const nightShown = () => page.evaluate(() => [...document.querySelectorAll('#settings input[name=night]')].filter((r) => r.checked).map((r) => r.value).join());
        // after each failed edit the field shows what is stored again
        await clear(); await type(page, 'name', 'c1', 'Alba Newer'); await page.waitForTimeout(1000); msgs.name = await message(page); shown.name = await shownValue(page, 'name', 'c1');
        await clear(); await page.selectOption('#settings [data-set=count]', '2'); await page.waitForTimeout(1000); msgs.count = await message(page); msgs.countShown = await nameCount(page); shown.count = await page.$eval('#settings [data-set=count]', (el) => el.value);
        await clear(); await type(page, 'fc', 'c1', 'November Newer'); await page.waitForTimeout(1000); msgs.fc = await message(page); shown.fc = await shownValue(page, 'fc', 'c1');
        await clear(); await page.check('#settings input[name=night][value=quiet]'); await page.waitForTimeout(1000); msgs.night = await message(page); shown.night = await nightShown();
        await clear(); await setTime('23:15'); await page.waitForTimeout(1000); msgs.time = await message(page); shown.time = await page.$eval('#settings [data-set=qfrom]', (el) => el.value);
        const raw1 = await rawNow();
        await tab.evaluate(async () => { await CC.transact((raw) => Object.assign(JSON.parse(JSON.stringify(raw)), { v: CC.VERSION })); });
        await page.waitForTimeout(600);
        // the fields count as untouched again: another page's change reaches them in place
        await otherSubs(tab, (sec) => { const k = Object.keys(sec.fcs)[0]; sec.fcs[k].name = 'November Elsewhere'; });
        const reached = await showsSoon(page, 'fc', 'c1', 'November Elsewhere');
        await clear(); await name(page, 'c1', 'Alba Back'); const msgBack = await message(page);
        const got = await whole(page);
        const want = named(before, { c1: 'Alba Back' }); for (const k of Object.keys(want.modules.submersibles.fcs)) want.modules.submersibles.fcs[k].name = 'November Elsewhere';
        record('C50', 'Main Settings: with a save written by a newer version, a name, the number of characters, a free company, the night rule and a quiet-hours time each say "Not saved on this device: …" with the reason, change nothing (no uncaught error) and the field shows what is stored again; once the save is writable again another page\'s change reaches those fields, a name is saved ("Saved.") and the whole stored record is as before plus those two changes',
          msgs.name === NOT && msgs.count === NOT && msgs.countShown === 1 && msgs.fc === NOT && msgs.night === NOT && msgs.time === NOT && raw1 === raw0 &&
          same(shown, { name: 'Alba Test', count: '1', fc: 'November Company', night: 'always', time: '22:00' }) && reached && msgBack === 'Saved.' && same(got, want) && real(errors).length === 0,
          { msgs, shown, unchanged: raw1 === raw0, reached, msgBack, got, want, errors: real(errors) });
        await ctx.close();
      }
      // C53: neither the browser's database nor its local storage can be used (the shared save keeps the data in the page's
      // memory only): the first character, a name, the number of characters, a free company and the night rule each say
      // they were not saved, while the edit stays in the page; a reload shows that nothing was kept
      {
        const { ctx, errors } = await context();
        await ctx.addInitScript(() => {
          indexedDB.open = () => { throw new DOMException('blocked', 'SecurityError'); };
          Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
        });
        const page = await ctx.newPage();
        await openSettings(page);
        const NOT = 'Not saved on this device: save a backup file';
        const clear = () => page.evaluate(() => { const m = document.querySelector('#settings .set-msg'); if (m) m.textContent = ''; });
        const msgs = {};
        await page.click('#settings [data-act=first]'); await page.waitForSelector('#settings [data-set=name][data-id=c1]'); await page.waitForTimeout(800); msgs.first = await message(page);
        await clear(); await type(page, 'name', 'c1', 'Alba Memory'); await page.waitForTimeout(800); msgs.name = await message(page);
        await clear(); await page.selectOption('#settings [data-set=count]', '2'); await page.waitForTimeout(800); msgs.count = await message(page);
        await clear(); await type(page, 'fc', 'c1', 'Papa Company'); await page.waitForTimeout(800); msgs.fc = await message(page);
        await clear(); await page.check('#settings input[name=night][value=quiet]'); await page.waitForTimeout(800); msgs.night = await message(page);
        const inPage = await page.evaluate(() => ({ names: window.__settings.state().chars.map((c) => c.name), shown: [document.querySelector('#settings [data-set=name][data-id=c1]').value, document.querySelector('#settings [data-set=fc][data-id=c1]').value, document.querySelectorAll('#settings [data-set=name]').length] }));
        await page.reload(); await openSettings(page);
        const afterReload = await page.evaluate(() => ({ first: !!document.querySelector('#settings [data-act=first]'), names: document.querySelectorAll('#settings [data-set=name]').length }));
        record('C53', 'Main Settings with neither the browser\'s database nor its local storage usable: the first character, a name, the number of characters, a free company and the night rule each say "Not saved on this device: save a backup file" (never "Saved"), the edits stay in the page, and a reload shows nothing was kept',
          Object.values(msgs).every((m) => m === NOT) && same(inPage, { names: ['Alba Memory', 'Character 2'], shown: ['Alba Memory', 'Papa Company', 2] }) && afterReload.first && afterReload.names === 0 && real(errors).length === 0,
          { msgs, inPage, afterReload, errors: real(errors) });
        await ctx.close();
      }
      // C54 and C55 (part 3 of the 2026-11-13 fix): the "Saved" or "Not saved" message of an edit is decided by the result of
      // that edit's own write, not by a later read. The stores (the browser's database and local storage) are made to fail
      // by a flag the page's reads and writes obey; the page's own write function is wrapped to set and clear that flag.
      // C54: both stores fail during a name save only, and again during a free-company save only: the message says not saved
      // and the stored record is unchanged
      for (const kind of ['name', 'fc']) {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await name(page, 'c1', 'Alba Test');
        const before = await whole(page);
        await breakStores(page, kind === 'name' ? 'ET' : 'CC', kind === 'name' ? 'saveState' : 'writeSection', 'during');
        await blank(page); await type(page, kind, 'c1', kind === 'name' ? 'Alba Lost' : 'Papa Company');
        await anyMessage(page); await page.waitForTimeout(500); await release(page);
        const msg = await message(page), got = await whole(page);
        const shownNow = await shownValue(page, kind, 'c1'), wantShown = kind === 'name' ? 'Alba Test' : '';
        record(kind === 'name' ? 'C54' : 'C54b', 'Main Settings: both stores fail during ' + (kind === 'name' ? 'a name' : 'a free-company') + ' save only (working again before the next read): the message is "Not saved on this device: save a backup file" and the whole stored record is unchanged; the field shows what is stored',
          msg === NOTSAVED && same(got, before) && shownNow === wantShown && real(errors).length === 0, { msg, shownNow, got, before, errors: real(errors) });
        await ctx.close();
      }
      // C55: the write reaches the device, then the stores fail until the message is shown: the message is the usual one and
      // the stored record holds the edit
      for (const kind of ['name', 'fc']) {
        const { ctx, errors } = await context();
        const page = await ctx.newPage();
        await openSettings(page); await first(page); await name(page, 'c1', 'Alba Test');
        const before = await whole(page);
        await breakStores(page, kind === 'name' ? 'ET' : 'CC', kind === 'name' ? 'saveState' : 'writeSection', 'after');
        await blank(page); await type(page, kind, 'c1', kind === 'name' ? 'Alba Kept' : 'Quebec Company');
        await anyMessage(page); await release(page);
        const msg = await message(page); await page.waitForTimeout(300);
        const got = await whole(page);
        const ok = kind === 'name' ? msg === 'Saved.' && same(got, named(before, { c1: 'Alba Kept' }))
          : msg === 'Saved: the free company is in Submersibles.' && same(got.chars, before.chars) && same(fcsFor(got, 'c1').map((f) => f.name), ['Quebec Company']);
        record(kind === 'name' ? 'C55' : 'C55b', 'Main Settings: ' + (kind === 'name' ? 'a name' : 'a free-company') + ' save reaches the device, then the stores fail until the message is shown: the message is ' + (kind === 'name' ? '"Saved."' : '"Saved: the free company is in Submersibles."') + ' and the whole stored record holds the edit',
          ok && real(errors).length === 0, { msg, got, before, errors: real(errors) });
        await ctx.close();
      }
    });

    // ── C29 Submersibles step S5: what came back, the log and earnings. A returned sub's send window lists the route's
    //    possible loot by sector; quantities, a new sector and the new-slot line are kept with the trip and in the free
    //    company; the Log tab reopens the trip to change it; Earnings shows totals, gil per hour per route with the trip
    //    count, and the CSV export. Universalis is answered by a stand-in (the session reaches no outside site).
    await guard('C29', async () => {
      const server6 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      let asked = 0;
      await page.route('https://universalis.app/**', (r) => { asked++; const ids = new URL(r.request().url()).pathname.split('/').pop().split(','); const items = {}; ids.forEach((id) => { items[id] = { itemID: +id, averagePrice: 2000 }; }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ids.length === 1 ? items[ids[0]] : { items }) }); });
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles; });
      const wrote = () => page.waitForFunction(() => window.__subs && window.__subs.state().ready && !document.querySelector('#sheet[open]'), null, { timeout: 10000 }).then(() => page.waitForTimeout(600));
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: { prefs: { priceWorld: 'Aether' } } };
        sec.fcs.fa = { name: 'Alpha Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2] };
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 1, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };
        // nine earlier trips on the same route: with the one logged now, ten (enough data)
        sec.trips['a1-old'] = { s: 'a1', t: new Date(2024, 4, 1).getTime(), r: [1], back: new Date(2024, 4, 1, 14).getTime(), items: [[10099, 1]], newSectors: [] }; // for the archive
        for (let i = 1; i <= 9; i++) sec.trips['a1-' + i] = { s: 'a1', t: now - (40 + i * 30) * H, r: [1, 2], back: now - (40 + i * 30 - 29) * H, items: [[10099, 2]], newSectors: [] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready();
      await page.click('.sub[data-sub="a1"] .sub-top');
      await page.waitForSelector('#sheet .loot');
      const closedAtFirst = !(await page.$eval('#sheet .loot', (d) => d.open)); await page.click('#sheet .loot summary');
      const groups = await page.$$eval('#sheet .loot-group .loot-h', (xs) => xs.map((x) => x.textContent));
      const firstRow = await page.$eval('#sheet .loot-row .loot-name', (el) => el.textContent);
      const repeat = !!(await page.$('#sheet [data-act=loot-repeat]'));
      const ids = await page.$$eval('#sheet [data-qty]', (xs) => xs.map((x) => +x.dataset.qty));
      await page.fill(`#sheet [data-qty="${ids[0]}"]`, '3');
      await page.click(`#sheet [data-q="+"][data-item="${ids[1]}"]`); await page.click(`#sheet [data-q="+"][data-item="${ids[1]}"]`);
      // an item outside the route's list, picked by name
      const otherName = await page.evaluate(() => window.__subs.itemName(5));
      await page.fill('#sheet [data-add-item]', otherName); await page.dispatchEvent('#sheet [data-add-item]', 'change');
      const newSector = await page.$eval('#sheet [data-new-sector]', (el) => +el.dataset.newSector).catch(() => null);
      if (newSector) await page.check(`#sheet [data-new-sector="${newSector}"]`);
      const slotLine = !!(await page.$('#sheet [data-new-slot]'));
      const pickerFull = await page.evaluate(() => { const sel = document.querySelector('#sheet [name=sea]').getBoundingClientRect(), grid = document.querySelector('#sheet .sectors').getBoundingClientRect(); return grid.top >= sel.bottom - 1 && grid.width > 300; });
      await page.click('#sheet .sector[data-pick="1"]');
      await page.click('#sheet [data-act=dosend]'); await wrote();
      const s1 = await saved();
      const trip = Object.values(s1.trips).sort((a, b) => b.t - a.t)[0];
      const tripId = Object.keys(s1.trips).find((k) => s1.trips[k] === trip);
      const items = Object.fromEntries(trip.items);
      const lootOk = trip.r.join() === '1,2' && items[ids[0]] === 3 && items[ids[1]] === 2 && items[5] === 1 && (!newSector || (trip.newSectors.includes(newSector) && s1.fcs.fa.discovered.includes(newSector)));
      // the Log tab: the trip is there and can be changed
      await page.click('[data-tab=log]');
      const logRows = await page.$$eval('.log-row', (xs) => xs.length);
      await page.click(`.log-row[data-trip="${tripId}"]`); await page.waitForSelector('#sheet .loot');
      const keptQty = await page.inputValue(`#sheet [data-qty="${ids[0]}"]`);
      await page.fill(`#sheet [data-qty="${ids[0]}"]`, '4'); await page.click('#sheet [data-act=trip-save]'); await wrote();
      const edited = Object.fromEntries((await saved()).trips[tripId].items)[ids[0]];
      // Earnings: totals, route gil per hour with ten trips, priced by market and merchant, the CSV
      await page.click('[data-tab=earn]');
      await page.waitForFunction(() => /Universalis, Aether/.test((document.querySelector('#view') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
      const earn = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.earn-card b')].map((x) => x.textContent), text: document.querySelector('#view').textContent, route: [...document.querySelectorAll('.earn-t')][0].querySelector('tbody tr').textContent }));
      const want = await page.evaluate(() => { const p = {}; Object.keys(window.__subs.section().trips).forEach((k) => window.__subs.section().trips[k].items.forEach((x) => { p[x[0]] = 2000; })); return EARN.totals(window.__subs.section(), p, Date.now()).all; });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=csv]')]);
      const csv = fs.readFileSync(await dl.path(), 'utf8');
      // the archive (offered at 75% of the size limit; the threshold lowered for the check): file first, then removal on
      // confirming; loading the file back restores the voyage
      await page.evaluate(() => window.__subs.archiveAt(0));
      await page.click('[data-tab=setup]'); await page.waitForSelector('[data-act=archive]');
      // (the confirm is accepted by the profile's dialog handler)
      const [arcDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=archive]')]);
      const arcFile = await arcDl.path(); const arc = JSON.parse(fs.readFileSync(arcFile, 'utf8'));
      await page.waitForTimeout(800);
      const afterArc = Object.keys((await saved()).trips);
      await page.waitForSelector('[data-archive-file]', { state: 'attached' });
      await page.setInputFiles('[data-archive-file]', arcFile); await page.waitForTimeout(1200);
      const afterLoad = Object.keys((await saved()).trips);
      const archiveOk = arc.count === 1 && !!arc.trips['a1-old'] && !afterArc.includes('a1-old') && afterArc.length === 10 && afterLoad.includes('a1-old') && afterLoad.length === 11;
      // phone width: the loot window and the earnings fit
      await page.setViewportSize({ width: 390, height: 844 });
      const wideEarn = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await page.click('[data-tab=log]'); await page.click(`.log-row[data-trip="${tripId}"]`); await page.waitForSelector('#sheet .loot');
      const wideSheet = await page.evaluate(() => { const d = document.querySelector('#sheet'); return document.documentElement.scrollWidth > window.innerWidth + 1 || d.scrollWidth > d.clientWidth + 1; });
      const ok = closedAtFirst && pickerFull && archiveOk && groups.length >= 2 && /possible items/.test(groups[0]) && !!firstRow && repeat && lootOk && slotLine === false &&
        logRows === 11 && keptQty === '3' && edited === 4 && asked >= 1 &&
        earn.cards[3] === Math.round(want).toLocaleString('en') + ' gil' && /5% tax/.test(earn.text) && /10/.test(earn.route) && !/not enough data/.test(earn.route) &&
        csv.split('\r\n')[0].startsWith('sent,back,free company') && csv.includes('Alpha Company') && !wideEarn && !wideSheet && real(errors).length === 0;
      record('C75', 'What came back (step S5): a returned sub\'s send window keeps "What came back" folded until tapped, then lists the route\'s possible loot by sector with "Repeat last"; typed and tapped quantities, an item added by name and a new sector are kept with the trip and in the free company; the Log tab lists every voyage and reopens one to change it; Setup\'s archive downloads the oldest voyages to a file, removes them only on confirming and loads them back from the file; Earnings totals the log at market prices after the 5% tax (Universalis stand-in) or the merchant price, shows gil per hour by route with the trip count and exports the log as CSV; the window and the tab fit a phone; the route picker shows the sectors full width under the sea list (not squeezed by the shared appearance styles)',
        ok, { closedAtFirst, pickerFull, archiveOk, arcCount: arc.count, afterArc: afterArc.length, afterLoad: afterLoad.length, groups: groups.slice(0, 3), firstRow, repeat, trip, newSector, slotLine, logRows, keptQty, edited, asked, earn: { cards: earn.cards, route: earn.route }, want, csvHead: csv.split('\r\n')[0], wideEarn, wideSheet, errors: real(errors) });
      await ctx.close(); server6.close();
    });
    // ── C76 (owner request 2026-11-15): on return the owner notes the voyage grade and types the rank and experience the game
    //    shows; the app stores the experience really gained and learns per grade; a later return with the same grade and
    //    nothing typed moves the rank on by the learned amount; Setup shows what was learned.
    await guard('C76', async () => {
      const server7 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles; });
      const wrote = () => page.waitForFunction(() => window.__subs && window.__subs.state().ready && !document.querySelector('#sheet[open]'), null, { timeout: 10000 }).then(() => page.waitForTimeout(600));
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fb = { name: 'Bravo Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: [1, 2] };
        const v = { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H };
        sec.subs.b1 = { fcId: 'fb', slot: 1, name: 'Sub B1', rank: 10, expIntoRank: 100, expExact: true, parts: [3, 4, 1, 2], voyage: v };
        sec.subs.b2 = { fcId: 'fb', slot: 2, name: 'Sub B2', rank: 10, expIntoRank: 100, parts: [3, 4, 1, 2], voyage: v };
        sec.subs.b3 = { fcId: 'fb', slot: 3, name: 'Sub B3', rank: 10, expIntoRank: 100, parts: [3, 4, 1, 2], voyage: v }; // its starting point is only an estimate
        sec.subs.b4 = { fcId: 'fb', slot: 4, name: 'Sub B4', rank: 10, expIntoRank: 100, expExact: true, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [], returnAt: now - H, gameSaid: '29h' } }; // exact, then a voyage typed as a time only
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready();
      // the route's base experience and what 1.25 times it reaches (an "A" voyage the owner reads off the game)
      const plan = await page.evaluate(() => { const s = window.__subs.section().subs.b1, a = ADVISOR.afterVoyage(s, s.voyage.route), got = Math.round(a.exp * 1.25), to = ADVISOR.rankAfter(10, 100, got); return { base: a.exp, got, to }; });
      await page.click('.sub[data-sub="b1"] .sub-top'); await page.waitForSelector('#sheet [name=grade]');
      const emptyRank = await page.$eval('#sheet [name=rankfix]', (el) => el.value === '' && /at least/.test(el.placeholder));
      await page.selectOption('#sheet [name=grade]', 'A');
      await page.fill('#sheet [name=rankfix]', String(plan.to.rank)); await page.fill('#sheet [name=intofix]', String(plan.to.into));
      await page.click('#sheet [data-act=collect]'); await wrote();
      const s1 = await saved();
      const t1 = Object.values(s1.trips).find((t) => t.s === 'b1');
      // the third sub started from an estimate: experience typed without the rank is refused with a message; then the
      // exact rank and experience are taken, but nothing is learned from this voyage (its start was not exact)
      await page.click('.sub[data-sub="b3"] .sub-top'); await page.waitForSelector('#sheet [name=grade]');
      await page.selectOption('#sheet [name=grade]', 'A'); await page.fill('#sheet [name=intofix]', String(plan.to.into));
      await page.click('#sheet [data-act=collect]'); await page.waitForTimeout(300);
      const refused = await page.evaluate(() => (document.querySelector('#sheet [data-err]') || {}).textContent || '');
      // a rank above the game's top (145) is refused too, not silently dropped
      await page.fill('#sheet [name=rankfix]', '200'); await page.click('#sheet [data-act=collect]'); await page.waitForTimeout(200);
      const refusedTop = await page.evaluate(() => (document.querySelector('#sheet [data-err]') || {}).textContent || '');
      await page.fill('#sheet [name=rankfix]', String(plan.to.rank));
      await page.click('#sheet [data-act=collect]'); await wrote();
      const s3 = await saved(), t3 = Object.values(s3.trips).find((t) => t.s === 'b3');
      // the second sub: same route, grade A noted, nothing typed: the learned 1.25 is used
      await page.click('.sub[data-sub="b2"] .sub-top'); await page.waitForSelector('#sheet [name=grade]');
      await page.selectOption('#sheet [name=grade]', 'A');
      await page.click('#sheet [data-act=collect]'); await wrote();
      const s2 = await saved();
      const t2 = Object.values(s2.trips).find((t) => t.s === 'b2');
      // the fourth sub's voyage had no route: collected with nothing typed, its rank is no longer exact
      await page.click('.sub[data-sub="b4"] .sub-top'); await page.waitForSelector('#sheet [data-act=collect]');
      await page.click('#sheet [data-act=collect]'); await wrote();
      const s4 = await saved();
      await page.click('.tabs [data-tab=setup]'); await page.waitForTimeout(400);
      const setupLine = await page.evaluate(() => [...document.querySelectorAll('#view .hint')].map((p) => p.textContent).find((x) => /Experience learned/.test(x)) || '');
      const ok = emptyRank && t1 && t1.grade === 'A' && t1.expBase === plan.base && t1.expGot === plan.got && s1.subs.b1.rank === plan.to.rank && s1.subs.b1.expIntoRank === plan.to.into
        && t2 && t2.grade === 'A' && !t2.expGot && s2.subs.b2.rank === plan.to.rank && s2.subs.b2.expIntoRank === plan.to.into
        && /Type the rank/.test(refused) && /1 to 145/.test(refusedTop) && t3 && !t3.expGot && s3.subs.b3.rank === plan.to.rank && s3.subs.b3.expIntoRank === plan.to.into && s3.subs.b3.expExact === true
        && s4.subs.b4.rank === 10 && !s4.subs.b4.expExact
        && /1 voyage; per grade, times the base: A ×1\.25 \(1\)/.test(setupLine) && real(errors).length === 0;
      record('C76', 'Rank and experience on return: with the voyage grade noted and the rank and experience the game shows typed, the trip keeps the grade, the base and the experience really gained, and the sub takes the typed rank and experience; a sub whose starting point was only an estimate takes the typed rank and experience but teaches nothing, and experience typed without its rank, or a rank above 145, is refused with a message; a voyage typed as a time only, collected with nothing typed, leaves the rank no longer exact; a later return with the same grade and nothing typed moves the rank on by what was learned; Setup shows the learned amount per grade',
        ok, { emptyRank, plan, t1, b1: { rank: s1.subs.b1.rank, into: s1.subs.b1.expIntoRank }, refused, refusedTop, t3, b3: s3.subs.b3, b4: s4.subs.b4, t2, b2: { rank: s2.subs.b2.rank, into: s2.subs.b2.expIntoRank }, setupLine, errors: real(errors) });
      await ctx.close(); server7.close();
    });
    // ── C77 (cross-family review of PR 1036, 2026-11-15): entries the game cannot show are refused, never read as blank or
    //    stored as exact; removing a voyage, or reading an impossible saved point, ends exactness; a grade's value below the
    //    base is shown as what is used (the base).
    await guard('C77', async () => {
      const server8 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles; });
      const wrote = () => page.waitForFunction(() => window.__subs && window.__subs.state().ready && !document.querySelector('#sheet[open]'), null, { timeout: 10000 }).then(() => page.waitForTimeout(600));
      const err = () => page.evaluate(() => (document.querySelector('#sheet [data-err]') || {}).textContent || '');
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fd = { name: 'Delta Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: [1, 2] };
        const back = { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H };
        sec.subs.d1 = { fcId: 'fd', slot: 1, name: 'Sub D1', rank: 10, expIntoRank: 5000, expExact: true, parts: [3, 4, 1, 2], voyage: back };
        sec.subs.d2 = { fcId: 'fd', slot: 2, name: 'Sub D2', rank: 10, expIntoRank: 5000, expExact: true, parts: [3, 4, 1, 2], voyage: { sentAt: now - H, route: [1, 2], returnAt: now + 20 * H } };
        sec.subs.d3 = { fcId: 'fd', slot: 3, name: 'Sub D3', rank: 10, expIntoRank: 70000, expExact: true, parts: [3, 4, 1, 2], voyage: back }; // an impossible saved point (rank 10 needs 68,161)
        sec.subs.d4 = { fcId: 'fd', slot: 4, name: 'Sub D4', rank: 10, expIntoRank: 60000, expExact: true, parts: [3, 4, 1, 2], voyage: back }; // the base estimate crosses into rank 11
        sec.fcs.fe = { name: 'Echo Company', world: 'Gilgamesh', unlockedSlots: 4, order: 1, discovered: [1, 2] };
        sec.subs.e1 = { fcId: 'fe', slot: 1, name: 'Sub E1', rank: 10, expIntoRank: 5000, expExact: true, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [], returnAt: now - H, gameSaid: '29h' } }; // a voyage typed as a time only
        sec.subs.e2 = { fcId: 'fe', slot: 2, name: 'Sub E2', rank: 10, expIntoRank: 1000000000, expExact: true, parts: [3, 4, 1, 2], voyage: back }; // an impossible saved point, nothing typed on return
        sec.subs.e3 = { fcId: 'fe', slot: 3, name: 'Sub E3', rank: 10, expIntoRank: 5000, expExact: true, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [], returnAt: now - H, gameSaid: '29h' } }; // exact, a voyage typed as a time only
        sec.fcs.ff = { name: 'Foxtrot Company', world: 'Gilgamesh', unlockedSlots: 1, order: 2, discovered: [1, 2] };
        sec.subs.f1 = { fcId: 'ff', slot: 1, name: 'Sub F1', rank: 10, expIntoRank: 1000000000, expExact: true, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [], returnAt: now - H, gameSaid: '29h' } }; // an impossible saved point, a voyage typed as a time only, nothing typed
        sec.subs.e4 = { fcId: 'fe', slot: 4, name: 'Sub E4', rank: 10, expIntoRank: 1000000000, expExact: true, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [], returnAt: now - H, gameSaid: '29h' } }; // an impossible saved point, a voyage typed as a time only
        sec.trips.tc = { s: 'd9', t: now - 99 * H, r: [1], back: now - 98 * H, items: [], newSectors: [], grade: 'C', expBase: 1000, expGot: 800 };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready();
      // d1: a minus sign typed into a number box (the browser reads it as blank) is refused; a lower experience at the same
      // exact rank is refused; nothing is logged until a valid entry
      await page.click('.sub[data-sub="d1"] .sub-top'); await page.waitForSelector('#sheet [name=intofix]');
      await page.fill('#sheet [name=rankfix]', '10'); await page.locator('#sheet [name=intofix]').pressSequentially('-');
      await page.click('#sheet [data-act=collect]'); await page.waitForTimeout(200);
      const badInput = await err();
      await page.fill('#sheet [name=intofix]', '620'); await page.click('#sheet [data-act=collect]'); await page.waitForTimeout(200);
      const lower = await err();
      await page.fill('#sheet [name=intofix]', '5000'); await page.click('#sheet [data-act=collect]'); await page.waitForTimeout(200);
      const unchanged = await err(); // the same point as before a voyage that gives experience
      await page.fill('#sheet [name=intofix]', '6000'); await page.click('#sheet [data-act=collect]'); await page.waitForTimeout(200);
      const implausible = await err(); // 1,000 gained on a route whose base is 21,220
      const mid = await saved();
      await page.fill('#sheet [name=intofix]', '28342'); await page.click('#sheet [data-act=collect]'); await wrote();
      const s1 = await saved(), t1 = Object.values(s1.trips).find((t) => t.s === 'd1');
      // d2: removing its voyage ends exactness (if it did run in the game, its experience is unknown)
      await page.click('.sub[data-sub="d2"] .sub-top'); await page.waitForSelector('#sheet [data-act=unsend]');
      await page.click('#sheet [data-act=unsend]'); await wrote();
      const s2 = await saved();
      // d3: an impossible saved point (more experience than rank 10 needs) teaches nothing when the exact return is typed
      const to3 = await page.evaluate(() => ({ rank: 12, into: 10 }));
      await page.click('.sub[data-sub="d3"] .sub-top'); await page.waitForSelector('#sheet [name=intofix]');
      await page.selectOption('#sheet [name=grade]', 'B');
      await page.fill('#sheet [name=rankfix]', String(to3.rank)); await page.fill('#sheet [name=intofix]', String(to3.into));
      await page.click('#sheet [data-act=collect]'); await wrote();
      const s3 = await saved(), t3 = Object.values(s3.trips).find((t) => t.s === 'd3');
      // d4: the game still shows the starting rank, typed without experience: the known progress is kept, not reset to 0
      await page.click('.sub[data-sub="d4"] .sub-top'); await page.waitForSelector('#sheet [name=rankfix]');
      await page.fill('#sheet [name=rankfix]', '10'); await page.click('#sheet [data-act=collect]'); await wrote();
      const s4 = await saved();
      // e1: a voyage without a route, the starting rank typed without experience: the known progress is kept, not exact
      await page.click('.sub[data-sub="e1"] .sub-top'); await page.waitForSelector('#sheet [name=rankfix]');
      await page.fill('#sheet [name=rankfix]', '10'); await page.click('#sheet [data-act=collect]'); await wrote();
      // e2: an impossible saved point, nothing typed: the estimate starts from 0 progress (unknown), no jump of ranks
      await page.click('.sub[data-sub="e2"] .sub-top'); await page.waitForSelector('#sheet [data-act=collect]');
      await page.click('#sheet [data-act=collect]'); await wrote();
      const s6 = await saved();
      // e3: after a voyage without a route, the very same exact point (a copy of the old figure) is refused; the real one is kept
      await page.click('.sub[data-sub="e3"] .sub-top'); await page.waitForSelector('#sheet [name=intofix]');
      await page.fill('#sheet [name=rankfix]', '10'); await page.fill('#sheet [name=intofix]', '5000');
      await page.click('#sheet [data-act=collect]'); await page.waitForTimeout(200);
      const sameRouteless = await err();
      await page.fill('#sheet [name=intofix]', '26220'); await page.click('#sheet [data-act=collect]'); await wrote();
      // e4: an impossible saved point, a voyage without a route, the rank typed without experience: progress unknown (0)
      await page.click('.sub[data-sub="e4"] .sub-top'); await page.waitForSelector('#sheet [name=rankfix]');
      await page.fill('#sheet [name=rankfix]', '10'); await page.click('#sheet [data-act=collect]'); await wrote();
      // f1: the same, with nothing typed: progress unknown (0)
      await page.click('.sub[data-sub="f1"] .sub-top'); await page.waitForSelector('#sheet [data-act=collect]');
      await page.click('#sheet [data-act=collect]'); await wrote();
      const s7 = await saved();
      await page.click('.tabs [data-tab=setup]'); await page.waitForTimeout(400);
      const setupLine = await page.evaluate(() => [...document.querySelectorAll('#view .hint')].map((p) => p.textContent).find((x) => /Experience learned/.test(x)) || '');
      // d1 (exact at rank 10): its rank changed in Setup to 11 starts with no known progress and is no longer exact
      await page.click('[data-act=edit][data-fc="fd"]');
      for (let i = 0; i < 8 && !(await page.$('[data-w=rank]')); i++) await page.click('[data-act=wnext]');
      await page.fill('[data-w=rank]', '11'); await page.press('[data-w=rank]', 'Tab');
      for (let i = 0; i < 8 && !(await page.$('[data-act=wsave]')); i++) await page.click('[data-act=wnext]');
      await page.click('[data-act=wsave]'); await page.waitForSelector('.fc'); await page.waitForTimeout(800);
      const s5 = await saved();
      const ok = /whole number/.test(badInput) && /cannot be lower than before the voyage \(5,000/.test(lower) && mid.subs.d1.voyage && !Object.values(mid.trips).some((t) => t.s === 'd1')
        && /same rank and experience as before the voyage/.test(unchanged) && /this voyage gave 1,000 experience/.test(implausible)
        && t1 && s1.subs.d1.rank === 10 && s1.subs.d1.expIntoRank === 28342 && s1.subs.d1.expExact === true && t1.expGot === 23342
        && s6.subs.e1.rank === 10 && s6.subs.e1.expIntoRank === 5000 && !s6.subs.e1.expExact
        && s6.subs.e2.rank === 10 && s6.subs.e2.expIntoRank === 21220 && !s6.subs.e2.expExact
        && /same rank and experience as before the voyage/.test(sameRouteless) && s7.subs.e3.expIntoRank === 26220 && s7.subs.e3.expExact === true
        && s7.subs.e4.rank === 10 && s7.subs.e4.expIntoRank === 0 && !s7.subs.e4.expExact
        && s7.subs.f1.rank === 10 && !s7.subs.f1.expIntoRank && !s7.subs.f1.expExact
        && !s2.subs.d2.voyage && !s2.subs.d2.expExact
        && t3 && !t3.expGot && s3.subs.d3.rank === 12 && s3.subs.d3.expIntoRank === 10 && s3.subs.d3.expExact === true
        && s4.subs.d4.rank === 10 && s4.subs.d4.expIntoRank === 60000 && !s4.subs.d4.expExact
        && s5.subs.d1.rank === 11 && s5.subs.d1.expIntoRank == null && !s5.subs.d1.expExact
        && /C ×1\.00 \(1\)/.test(setupLine) && !/B ×/.test(setupLine) && real(errors).length === 0;
      record('C77', 'Return entries the game cannot show: a minus sign in a number box (read by the browser as blank) and a lower experience at the same exact rank, or a point that says the voyage gave less than half or more than four times the route base (an unchanged point included), are refused with a message and nothing is logged; the corrected entry is kept, exact, and teaches the experience really gained; removing a voyage ends exactness; an impossible saved point (more experience than its rank needs) teaches nothing; the starting rank typed without experience keeps the known progress, with or without a route; an impossible saved point is estimated from 0 progress, without a jump of ranks, and after a voyage without a route its progress is 0, rank typed or not; after a voyage without a route the very same exact point is refused; a rank changed in Setup starts with no known progress and is not exact; a grade whose learned value is below the base shows the base it uses',
        ok, { badInput, lower, unchanged, implausible, t1, e1: s6.subs.e1, e2: s6.subs.e2, sameRouteless, e3: s7.subs.e3, e4: s7.subs.e4, f1: s7.subs.f1, d1: s1.subs.d1, d2: s2.subs.d2, t3, d3: s3.subs.d3, d4: s4.subs.d4, d1AfterSetup: s5.subs.d1, setupLine, errors: real(errors) });
      await ctx.close(); server8.close();
    });

    // ── C78 Submersibles step S6-1: Earnings ranks the routes with ten logged voyages (equal gil per hour share a position)
    //    and lists the others as "n of 10 voyages" without a position, under a line that says what the figure is.
    await guard('C78', async () => {
      const server9 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      await page.route('https://universalis.app/**', (r) => { const ids = new URL(r.request().url()).pathname.split('/').pop().split(','); const items = {}; ids.forEach((id) => { items[id] = { itemID: +id, averagePrice: 2000 }; }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ids.length === 1 ? items[ids[0]] : { items }) }); });
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: { prefs: { priceWorld: 'Aether' } } };
        sec.fcs.fg = { name: 'Golf Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2, 3] };
        sec.subs.g1 = { fcId: 'fg', slot: 1, name: 'Sub G1', rank: 10, parts: [3, 4, 1, 2] };
        for (let i = 1; i <= 10; i++) sec.trips['p' + i] = { s: 'g1', t: now - (200 + i * 30) * H, r: [1, 2], back: now - (200 + i * 30 - 20) * H, items: [[10099, 2]], newSectors: [] };
        for (let i = 1; i <= 10; i++) sec.trips['q' + i] = { s: 'g1', t: now - (200 + i * 30) * H, r: [3], back: now - (200 + i * 30 - 10) * H, items: [[10099, 1]], newSectors: [] };
        for (let i = 1; i <= 3; i++) sec.trips['r' + i] = { s: 'g1', t: now - (10 + i * 30) * H, r: [2], back: now - (10 + i * 30 - 10) * H, items: [[10099, 1]], newSectors: [] };
        sec.trips.s1 = { s: 'g1', t: now - 5 * H, r: [1], back: now - H, items: [], newSectors: [] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready();
      await page.click('[data-tab=earn]');
      await page.waitForSelector('.earn-ranked');
      const got = await page.evaluate(() => ({
        ranked: [...document.querySelectorAll('.earn-ranked tbody tr:not(.earn-note)')].map((tr) => [...tr.children].map((td) => td.textContent)),
        thin: [...document.querySelectorAll('.earn-thin tbody tr:not(.earn-note)')].map((tr) => [...tr.children].map((td) => td.textContent)),
        text: document.querySelector('#view').textContent
      }));
      const ok = got.ranked.length === 2 && got.ranked.every((r) => r[0] === '1') && got.thin.length === 1 && got.thin[0].length === 3 &&
        got.thin[0][2] === '3 of 10 voyages' && /Logged gil divided by logged hours at sea, at the prices shown above/.test(got.text) && real(errors).length === 0;
      record('C78', 'Earnings ranking (step S6-1): two routes with ten logged voyages and equal gil per hour are ranked and share position 1, a route with three voyages is listed apart as "3 of 10 voyages" without a position, a trip with nothing logged adds nothing, and a line says the figure is logged gil divided by logged hours at sea at the prices shown',
        ok, { got, errors: real(errors) });
      await ctx.close(); server9.close();
    });

    // ── C81 Submersibles step S6-0: in the send window of a returned sub, "Send on this route" keeps what was typed above it
    //    (a quantity and a "discovered" tick) in the trip and the free company, as "Send again" does.
    await guard('C81', async () => {
      const server10 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles; });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fh = { name: 'Hotel Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1] };
        sec.subs.h1 = { fcId: 'fh', slot: 1, name: 'Sub H1', rank: 1, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready();
      await page.click('.sub[data-sub="h1"] .sub-top');
      await page.waitForSelector('#sheet .loot');
      await page.click('#sheet .loot summary');
      const itemId = await page.$eval('#sheet [data-qty]', (el) => +el.dataset.qty);
      await page.fill(`#sheet [data-qty="${itemId}"]`, '3');
      const newSector = await page.$eval('#sheet [data-new-sector]', (el) => +el.dataset.newSector).catch(() => null);
      if (newSector) await page.check(`#sheet [data-new-sector="${newSector}"]`);
      const hasQuick = !!(await page.$('#sheet [data-act=quick]'));
      if (hasQuick) await page.click('#sheet [data-act=quick]');
      await page.waitForFunction(() => window.__subs && window.__subs.state().ready && !document.querySelector('#sheet[open]'), null, { timeout: 10000 }).then(() => page.waitForTimeout(800)).catch(() => {});
      const s1 = await saved();
      const trips = Object.values(s1.trips);
      const trip = trips[0] || {};
      const items = Object.fromEntries(trip.items || []);
      const ok = hasQuick && !!newSector && trips.length === 1 && items[itemId] === 3 && (trip.newSectors || []).includes(newSector) && s1.fcs.fh.discovered.includes(newSector) && !!s1.subs.h1.voyage && real(errors).length === 0;
      record('C81', 'Send on this route (step S6-0): in the send window of a returned sub, a quantity and a "discovered" tick entered before pressing "Send on this route" are kept in the trip and the free company, and the sub is sent again',
        ok, { hasQuick, newSector, itemId, trip, discovered: s1.fcs.fh.discovered, errors: real(errors) });
      await ctx.close(); server10.close();
    });

    // ── C83 Submersibles step S6 review fix: "Send on this route" sends the route the window showed, even when a "discovered"
    //    tick entered in the same window would change the advice (rank 145, four slots, every sector found except 3).
    await guard('C83', async () => {
      const server14 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles; });
      const allIds = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8')).sectors.map((s) => s.id).filter((id) => id !== 3);
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async (all) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fl = { name: 'Lima Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.l1 = { fcId: 'fl', slot: 1, name: 'Sub L1', rank: 145, parts: [31, 24, 25, 34], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, allIds);
      await page.reload(); await ready();
      await page.click('.sub[data-sub="l1"] .sub-top');
      await page.waitForSelector('#sheet .advice');
      const shown = await page.$eval('#sheet [data-act=quick]', (el) => el.dataset.route || null);
      const freshAfterTick = await page.evaluate(() => { const fcs = JSON.parse(JSON.stringify(window.__subs.section().fcs.fl)); fcs.discovered.push(3); const a = ADVISOR.advise({ sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: fcs, slotsFilled: 4 }); return a.plan.route.join(','); });
      await page.click('#sheet .loot summary');
      await page.check('#sheet [data-new-sector="3"]');
      await page.click('#sheet [data-act=quick]');
      await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      const s1 = await saved();
      const sent = s1.subs.l1.voyage && s1.subs.l1.voyage.route ? s1.subs.l1.voyage.route.join(',') : null;
      const ok = shown === '1' && freshAfterTick !== shown && sent === shown && Object.keys(s1.trips).length === 1 && s1.fcs.fl.discovered.includes(3) && real(errors).length === 0;
      // the reopen path: the shown route cannot be sent once the return is logged (it holds sector 3, which is not found), so
      // exactly one trip is logged with its typed loot, nothing is sent, and the send window opens again with one plain sentence
      await page.evaluate(async (all) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fl = { name: 'Lima Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.l1 = { fcId: 'fl', slot: 1, name: 'Sub L1', rank: 145, parts: [31, 24, 25, 34], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, allIds);
      await page.reload(); await ready();
      await page.click('.sub[data-sub="l1"] .sub-top');
      await page.waitForSelector('#sheet .advice');
      await page.click('#sheet .loot summary');
      const lootId = await page.$eval('#sheet [data-qty]', (el) => +el.dataset.qty);
      await page.fill('#sheet [data-qty="' + lootId + '"]', '7');
      await page.$eval('#sheet [data-act=quick]', (el) => { el.dataset.route = '3'; });
      await page.click('#sheet [data-act=quick]');
      await page.waitForSelector('#sheet[open] [data-reopened]', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      const s2 = await saved();
      const reopened = await page.evaluate(() => ({ open: !!document.querySelector('#sheet[open]'), note: (document.querySelector('#sheet [data-reopened]') || {}).textContent || '', send: !!document.querySelector('#sheet [data-act=dosend]') }));
      const tripList = Object.values(s2.trips);
      const keptLoot = tripList.length === 1 && (tripList[0].items || []).some((x) => x[0] === lootId && x[1] === 7);
      const ok2 = tripList.length === 1 && keptLoot && !s2.subs.l1.voyage && reopened.open && reopened.send && /return was logged/.test(reopened.note) && /nothing was sent/.test(reopened.note) && real(errors).length === 0;
      record('C83', 'Send on this route (step S6 review): the button carries the route the window shows and sends exactly it, also when a "discovered" tick entered in the same window would change the advice (the fresh advice differs from the shown route); the return is logged once. Reopen path: when the shown route cannot be sent once the return is logged, exactly one trip is logged with its typed loot kept, nothing is sent, and the send window opens again with a sentence saying so',
        ok && ok2, { shown, sent, freshAfterTick, firstCase: ok, trips: tripList.length, keptLoot, voyage: s2.subs.l1.voyage || null, reopened, errors: real(errors) });
      await ctx.close(); server14.close();
    });

    // ── C79 Submersibles step S6-2, as changed by the drop-rates work (owner decision Q3): the community estimate ranks the gil
    //    routes; once a route has ten logged voyages its own log (in merchant gil per hour) is compared with its estimate and
    //    ranks it, and the reason shows both figures and says which decided. Nine voyages do not count. On the Board and in the
    //    send window, without a reload, with nothing fetched and no new field in the stored section.
    await guard('C79', async () => {
      const server11 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const requests = [];
      page.on('request', (r) => { if (/universalis/.test(r.url())) requests.push(r.url()); });
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles; });
      const allIds = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8')).sectors.map((s) => s.id);
      const LOOT = 22507; // Extravagant Salvaged Necklace: dropped on the Fight Club route JORZ and sold to a merchant
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async ([all, loot]) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} }, jorz = [10, 15, 18, 26];
        sec.fcs.fi = { name: 'India Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.i1 = { fcId: 'fi', slot: 1, name: 'Sub I1', rank: 145, parts: [31, 24, 25, 34], voyage: { sentAt: now - 30 * H, route: jorz, returnAt: now - H } };
        sec.subs.i2 = { fcId: 'fi', slot: 2, name: 'Sub I2', rank: 145, parts: [31, 24, 25, 34] };
        for (let i = 1; i <= 9; i++) sec.trips['i1-' + i] = { s: 'i1', t: now - (40 + i * 30) * H, r: jorz, back: now - (40 + i * 30 - 29) * H, items: [[loot, 100]], newSectors: [] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, [allIds, LOOT]);
      await page.reload(); await ready();
      const board = () => page.evaluate(() => { const b = document.querySelector('.sub[data-sub="i2"] [data-quick]'); return b ? { text: b.textContent, title: b.getAttribute('title') } : null; });
      const communityRoute = await page.evaluate(() => ADVISOR.routeText(ADVISOR.advise({ sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: window.__subs.section().fcs.fi.discovered }, slotsFilled: 4, recs: RECS.defaults() }).plan.route));
      const jorzText = await page.evaluate(() => ADVISOR.routeText([10, 15, 18, 26]));
      const before = await board();
      const before0 = await saved();
      // the 10th voyage, logged through the page: the returned sub's send window, a quantity, "Send on this route"
      await page.click('.sub[data-sub="i1"] .sub-top');
      await page.waitForSelector('#sheet .loot');
      await page.click('#sheet .loot summary');
      await page.fill('#sheet [data-qty="' + LOOT + '"]', '100');
      await page.click('#sheet [data-act=quick]');
      await page.waitForFunction(() => !document.querySelector('#sheet[open]') && /Your own log decided/.test((document.querySelector('.sub[data-sub="i2"] [data-quick]') || {}).title || ''), null, { timeout: 10000 }).catch(() => {});
      const after = await board();
      await page.click('.sub[data-sub="i2"] .sub-top');
      await page.waitForSelector('#sheet .advice');
      const sheetAdvice = await page.$eval('#sheet .advice', (el) => el.textContent);
      await page.waitForTimeout(800);
      const s1 = await saved();
      const keys = (o, f) => [...new Set(Object.values(o).flatMap((x) => Object.keys(x)))].filter(f || (() => true)).sort();
      const noNew = JSON.stringify(Object.keys(s1).sort()) === JSON.stringify(Object.keys(before0).sort()) &&
        keys(s1.trips).every((k) => ['s', 't', 'r', 'back', 'calc', 'said', 'items', 'newSectors', 'rankAfter', 'rankCalc', 'grade', 'expBase', 'expGot'].includes(k)) &&
        keys(s1.fcs).every((k) => keys(before0.fcs).includes(k)) && keys(s1.subs).every((k) => keys(before0.subs).concat(['voyage', 'expIntoRank', 'expExact']).includes(k));
      const logSentence = /Your own log on this route: about [\d,]+ gil an hour at merchant prices over 10 logged voyages \(this submarine is back in [\d.]+ hours\); the community estimate is about [\d,]+ an hour\. Your own log decided/;
      const ok = !!before && before.text.includes(communityRoute) && communityRoute === jorzText && /^Community gil route /.test(before.title) && /an estimate from community drop records/.test(before.title) &&
        /Your own log on this route: 9 of 10 logged voyages; the estimate decides until then\./.test(before.title) && !/Your own log decided/.test(before.title) &&
        !!after && after.text.includes(communityRoute) && /^Community gil route /.test(after.title) && logSentence.test(after.title) && !/stars/.test(after.title) &&
        logSentence.test(sheetAdvice) && /an estimate from community drop records/.test(sheetAdvice) && sheetAdvice.includes(communityRoute) && Object.keys(s1.trips).length === 10 && noNew && requests.length === 0 && real(errors).length === 0;
      record('C79', 'Advice from the log (step S6-2, owner decision Q3): at the gil step the Board shows the best community route by estimate and, with nine logged voyages on it, "9 of 10 logged voyages" with the estimate deciding; once the tenth is logged through the page, another sub\'s Board button and send window show the same route with the log figure beside the community estimate and "Your own log decided", without a reload, with nothing fetched and no new field in the stored section',
        ok, { before, after, communityRoute, jorzText, sheetAdvice, trips: Object.keys(s1.trips).length, noNew, requests, errors: real(errors) });
      await ctx.close(); server11.close();
    });

    // ── C80 Submersibles step S6-3: with a ranked logged route, a weak build gets a part note in gil ("more gil per hour")
    //    and its free company is at the gil stage; a build with no better part shows no note and its company is finished.
    await guard('C80', async () => {
      const server12 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const allIds = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8')).sectors.map((s) => s.id);
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async (all) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fj = { name: 'Juliet Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.fcs.fk = { name: 'Kilo Company', world: 'Gilgamesh', unlockedSlots: 4, order: 1, discovered: all };
        sec.subs.j1 = { fcId: 'fj', slot: 1, name: 'Sub J1', rank: 145, parts: [3, 4, 1, 2] };
        sec.subs.k1 = { fcId: 'fk', slot: 1, name: 'Sub K1', rank: 145, parts: [31, 24, 25, 34] };
        for (let i = 1; i <= 10; i++) sec.trips['j1-' + i] = { s: 'j1', t: now - (40 + i * 30) * H, r: [1, 2], back: now - (40 + i * 30 - 29) * H, items: [[10099, 2]], newSectors: [] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, allIds);
      await page.reload(); await ready();
      const advice = async (id) => {
        await page.click(`.sub[data-sub="${id}"] .sub-top`);
        await page.waitForSelector('#sheet .advice');
        const got = await page.evaluate(() => ({ text: document.querySelector('#sheet .advice').textContent, notes: [...document.querySelectorAll('#sheet .advice .note')].map((n) => n.textContent) }));
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 }).catch(() => {});
        return got;
      };
      const weak = await advice('j1');
      const goodBuild = await advice('k1');
      const stages = await page.evaluate(() => ({ weak: window.__subs.stageOf('fj'), good: window.__subs.stageOf('fk') }));
      // the route is now chosen from the community estimate (the log is on a route that is not a community route), so the text names the community route
      const ok = /Community gil route /.test(weak.text) && weak.notes.some((n) => /estimated to give about \+[\d,]+ gil an hour on this route \(estimate from community drop records/.test(n) && /counted as worth nothing: the community's reading, not confirmed/.test(n)) &&
        /Community gil route /.test(goodBuild.text) && !goodBuild.notes.some((n) => /Swapping/.test(n)) && stages.weak === 'gil' && stages.good === 'final' && real(errors).length === 0;
      record('C80', 'Part advice in gil (step S6-3): with a ranked logged route, a weak build shows a part note valued by the community estimate ("estimated to give about +N gil an hour", "counted as worth nothing") and its free company is at the gil stage; a build with no better part shows no part note and its company is finished',
        ok, { weak, goodBuild, stages, errors: real(errors) });
      await ctx.close(); server12.close();
    });

    // ── C82 Submersibles step S4-1: the Map tab draws the sea chart (read-only): seven sea buttons, found counts, the
    //    Deep-sea Site with 30 sectors and Start, details of J with its slot, no sideways scrolling on a phone, and the
    //    stored section unchanged.
    await guard('C82', async () => {
      const server13 = await start(PORT5);
      const { ctx, errors } = await context({ deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return JSON.stringify(CC.checkDoc(r.raw).modules.submersibles); });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      const seed = async (pg) => pg.evaluate(async () => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fl = { name: 'Lima Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2, 3, 10] };
        sec.fcs.fm = { name: 'Mike Company', world: 'Gilgamesh', unlockedSlots: 1, order: 1, discovered: [1] };
        sec.subs.l1 = { fcId: 'fl', slot: 1, name: 'Sub L1', rank: 10, parts: [3, 4, 1, 2] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await seed(page);
      await page.reload(); await ready();
      const before = await saved();
      const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await page.click('[data-tab=setup]'); await page.click('[data-act=edit]');
      for (let i = 0; i < 12 && !(await page.$('#view .hint')); i++) await page.click('[data-act=wnext]').catch(() => {});
      let setupText = '';
      for (let i = 0; i < 12; i++) { setupText = await page.$eval('#view', (el) => el.textContent); if (/Sectors already discovered/.test(setupText) || !(await page.$('[data-act=wnext]'))) break; await page.click('[data-act=wnext]'); }
      await page.click('[data-act=wcancel]');
      await page.click('[data-tab=map]');
      await page.waitForSelector('.chart-svg');
      const sea = () => page.evaluate(() => ({ text: document.querySelector('#view').textContent, buttons: [...document.querySelectorAll('[data-map-sea]')].map((b) => b.textContent), pressed: document.querySelector('[data-map-sea][aria-pressed=true]').textContent,
        sectors: document.querySelectorAll('.chart-svg [data-sector]').length, start: !!document.querySelector('.chart-start'), found: document.querySelectorAll('.chart-node.found').length, next: document.querySelectorAll('.chart-node.next').length }));
      const lima = await sea();
      await page.selectOption('#map-fc', 'fm');
      const mike = await sea();
      await page.selectOption('#map-fc', 'fl');
      await page.click('[data-map-sea="2"]');
      const ash = await sea();
      await page.click('[data-map-sea="1"]');
      await page.click('.chart-svg [data-sector="10"]');
      await page.waitForSelector('.chart-details');
      const details = await page.$eval('.chart-details', (el) => el.textContent);
      if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-map.png') });
      await page.keyboard.press('Tab');
      const sideDesktop = await wide();
      await page.waitForTimeout(800);
      const after = await saved();
      await ctx.close();
      const ph = await context(PHONE);
      const pp = await ph.ctx.newPage();
      await pp.goto(ROOT5 + 'submersibles/'); await pp.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await seed(pp); await pp.reload(); await pp.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await pp.click('[data-tab=map]'); await pp.waitForSelector('.chart-svg');
      await pp.click('.chart-svg [data-sector="10"]');
      const sidePhone = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const svgWidth = await pp.$eval('.chart-svg', (el) => Math.round(el.getBoundingClientRect().width));
      const hitMin = await pp.$$eval('.chart-svg .chart-node .hit', (els) => Math.round(Math.min(...els.map((e) => e.getBoundingClientRect().width))));
      await ph.ctx.close();
      const ok = !/arrive in step S4/.test(lima.text) && lima.buttons.length === 7 && /Deep-sea Site/.test(lima.pressed) && lima.sectors === 30 && lima.start && lima.found === 4 && lima.next >= 1 &&
        /found 4 of 30/.test(lima.buttons[0]) && /found 0 of 20/.test(lima.buttons[1]) && /found 1 of 30/.test(mike.buttons[0]) && mike.found === 1 && /not opened yet/.test(ash.text) && ash.sectors === 20 &&
        /slot 2/.test(details) && /unidentified derelict/.test(details) && /Rank needed/.test(details) && sideDesktop <= 0 && sidePhone <= 0 && svgWidth > 300 && hitMin >= 36 &&
        /The Map tab shows them on a chart\./.test(setupText) && !/step S4/.test(setupText) && before === after && real(errors).length === 0 && real(ph.errors).length === 0;
      record('C82', 'Sea chart (step S4-1): the Map tab no longer says it arrives in step S4; it has seven sea buttons with "found n of m"; the Deep-sea Site shows 30 sectors and Start; found counts follow the seeded free company and change with the selector; a sea with nothing found says "not opened yet"; tapping J shows its details with "slot 2"; at a phone width the page does not scroll sideways; the Setup sector step carries the new sentence; the stored section is unchanged',
        ok, { lima: { buttons: lima.buttons, sectors: lima.sectors, start: lima.start, found: lima.found, next: lima.next }, mike: { found: mike.found }, ash: { sectors: ash.sectors }, details, sideDesktop, sidePhone, svgWidth, hitMin, setupText: setupText.slice(-200), same: before === after, errors: real(errors) });
      await ctx.close().catch(() => {}); server13.close();
    });

    // ── C84 Submersibles step S4-2: the route planner on the Map tab: figures equal ADVISOR.evalRoute for the chosen sub, a
    //    sixth sector cannot be added, a sector above the sub's rank cannot be tapped, a community route button loads its
    //    route, "Send ... on this route..." opens the send window with that route, Cancel leaves the stored section
    //    byte-for-byte as before, and a sub that is Out has the button disabled.
    await guard('C84', async () => {
      const server14 = await start(PORT5);
      const { ctx, errors } = await context({ deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return JSON.stringify(CC.checkDoc(r.raw).modules.submersibles); });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const parts = [3, 4, 1, 2], now = Date.now();
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fl = { name: 'Lima Company', world: 'Gilgamesh', unlockedSlots: 2, order: 0, discovered: [1, 2, 3, 4, 5, 6, 7, 10, 15, 18, 26] };
        sec.subs.l1 = { fcId: 'fl', slot: 1, name: 'Sub L1', rank: 30, parts };
        sec.subs.l2 = { fcId: 'fl', slot: 2, name: 'Sub L2', rank: 30, parts, voyage: { sentAt: now, route: [1], returnAt: now + 3600000 } };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready();
      const before = await saved();
      await page.click('[data-tab=map]'); await page.waitForSelector('.chart-svg');
      const tap = (id) => page.click('.chart-svg [data-sector="' + id + '"]');
      const route = () => page.$eval('.planner .route-line', (el) => el.textContent);
      const noSub = await page.$eval('.planner', (el) => el.textContent);
      await page.selectOption('#map-sub', 'l1');
      await tap(1); await tap(3);
      const planned = await page.$eval('.planner', (el) => el.textContent);
      const want = await page.evaluate(() => { const st = ADVISOR.stats(30, [3, 4, 1, 2]), ev = ADVISOR.evalRoute([1, 3], st); return { range: 'range ' + ev.range + ' of ' + ev.maxRange, tanks: ev.tanks + ' tank', route: ADVISOR.routeText([1, 3]), exp: ev.exp.toLocaleString('en') + ' exp', calc: 'calculated' }; });
      const figuresOk = [want.range, want.tanks, want.exp, want.route, want.calc].every((x) => planned.includes(x));
      const drawn = await page.evaluate(() => ({ line: document.querySelectorAll('.chart-svg .chart-route').length, pts: (document.querySelector('.chart-route') || { getAttribute: () => '' }).getAttribute('points').split(' ').length }));
      await tap(3); const dropped = await route();
      await tap(26); const afterHigh = await route(); // one sector in the route: refused for the rank (50 > 30) alone, not because the route is full
      await tap(3);
      await page.focus('.chart-svg [data-sector="2"]'); await page.keyboard.press('Enter'); // a keyboard tap keeps the focus on the tapped sector after the redraw
      const kbFocus = await page.evaluate(() => (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.sector) || null);
      for (const id of [4, 5]) await tap(id);
      const five = await route();
      await tap(6); const afterSixth = await route(); // the sixth sector: refused because the route is full
      await page.click('[data-act=mapclear]');
      const community = await page.$$eval('[data-map-use]', (bs) => bs.map((b) => ({ t: b.textContent, d: b.disabled })));
      const okBtn = community.findIndex((b) => /OJ/.test(b.t) && !b.d), highBtn = community.find((b) => /JORZ/.test(b.t));
      await page.click('[data-map-use]:not([disabled])');
      const loaded = await route();
      const loadedWant = await page.evaluate(() => ADVISOR.routeText([15, 10]));
      if (SHOT) await (await page.$('.map-panel')).screenshot({ path: path.join(ev, 'submersibles-planner.png') });
      await page.click('[data-map-send]');
      await page.waitForSelector('#sheet [data-picker] .sector.on');
      const sheetRoute = await page.$eval('#sheet [data-picker] .route-line', (el) => el.textContent);
      const sheetOn = await page.$$eval('#sheet [data-picker] .sector.on', (els) => els.map((e) => e.textContent));
      await page.click('#sheet [data-act=close]');
      await page.waitForTimeout(800);
      const afterCancel = await saved();
      await page.selectOption('#map-sub', 'l2'); await tap(1);
      const outBtn = await page.$eval('[data-map-send]', (b) => ({ disabled: b.disabled, text: b.parentElement.textContent }));
      await page.waitForTimeout(800);
      const afterAll = await saved();
      const wideDesktop = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await ctx.close();
      const arrows = (s) => (s.match(/→/g) || []).length;
      const ok = /Choose a submarine/.test(noSub) && figuresOk && drawn.line === 1 && drawn.pts === 3 && arrows(dropped) === 0 && /: A\b/.test(dropped) &&
        kbFocus === '2' && arrows(five) === 4 && arrows(afterSixth) === 4 && !/\bF\b/.test(afterSixth) && arrows(afterHigh) === 0 && /: A\b/.test(afterHigh) && !/\bZ\b/.test(afterHigh) &&
        okBtn >= 0 && highBtn && highBtn.d === true && loaded.includes(loadedWant) && sheetRoute.includes(loadedWant) && sheetOn.length === 2 &&
        before === afterCancel && outBtn.disabled === true && /back/.test(outBtn.text) && before === afterAll && wideDesktop <= 0 && real(errors).length === 0;
      record('C84', 'Route planner (step S4-2): choosing a sub and tapping two found sectors gives the figures ADVISOR.evalRoute gives for it, with the "calculated" label, and draws a numbered line; a sixth sector cannot be added and a sector above the sub\'s rank cannot be tapped into the route; a community route button loads its route (disabled when the rank or a sector is missing); "Send ... on this route..." opens the send window with that route selected; Cancel leaves the stored section byte-for-byte as before; a sub that is Out has the button disabled',
        ok, { kbFocus, noSub: noSub.slice(0, 120), planned: planned.slice(0, 300), want, drawn, dropped, five, afterSixth, afterHigh, community, loaded, sheetRoute, sheetOn, same: before === afterCancel, outBtn, wideDesktop, errors: real(errors) });
      await ctx.close().catch(() => {}); server14.close();
    });

    // ── C85 Customizable Recommendations (R5): the panel shows the default order and the switch off; with nothing changed the
    //    save holds no new section; "Move up" by keyboard reorders, keeps focus and announces; the order survives a reload;
    //    with Gil first a sub in an unlocking free company shows another route on the Board button and in the send window (the
    //    same one); modules.submersibles is byte-for-byte unchanged.
    await guard('C85', async () => {
      const server15 = await start(PORT5);
      const { ctx, errors } = await context({ deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const doc = () => page.evaluate(async () => { const r = await CC.read(); const m = CC.checkDoc(r.raw).modules; return { subs: JSON.stringify(m.submersibles), recs: m['submersibles-recommendations'] === undefined ? null : m['submersibles-recommendations'] }; });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fa = { name: 'Alfa Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2] };
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 1, parts: [3, 4, 1, 2] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready();
      const quick = async () => { await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="a1"]'); return page.$eval('.quick[data-quick="a1"]', (b) => b.textContent); };
      const boardDefault = await quick();
      await page.click('[data-tab=setup]'); await page.waitForSelector('[data-recs-panel]');
      const panel = () => page.evaluate(() => ({ order: [...document.querySelectorAll('.rec-rank .rec-name')].map((e) => e.textContent), fuel: document.querySelector('[data-rec=fuel]').checked,
        live: document.querySelector('[data-recs-live]').textContent, focus: (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.rec) || null,
        names: [...document.querySelectorAll('.rec-rank button')].map((b) => b.getAttribute('aria-label') + (b.disabled ? ' (off)' : '')),
        startsWithText: [...document.querySelectorAll('.rec-rank button')].every((b) => b.getAttribute('aria-label').startsWith(b.textContent.trim())) }));
      const first = await panel();
      await page.waitForTimeout(800);
      const untouched = await doc();
      const baseline = untouched.subs;
      await page.focus('[data-rec="up-gil"]'); await page.keyboard.press('Enter');
      const one = await panel();
      await page.keyboard.press('Enter');
      const two = await panel();
      await page.waitForTimeout(800);
      const stored = await doc();
      if (SHOT) await (await page.$('[data-recs-panel]')).screenshot({ path: path.join(ev, 'submersibles-recommendations.png') });
      await page.reload(); await ready();
      await page.click('[data-tab=setup]'); await page.waitForSelector('[data-recs-panel]');
      const reloaded = await panel();
      const boardGil = await quick();
      await page.click('.sub[data-sub="a1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
      const sheetRoute = await page.$eval('#sheet .advice-route b', (b) => b.textContent);
      const sheetHead = await page.$eval('#sheet .advice-step', (b) => b.textContent);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const after = await doc();
      await ctx.close();
      const want = ['1. Unlocking Routes', '2. Leveling Submersible Rank', '3. Gil Farming', '4. Loot Farming'];
      const ok = first.order.join('|') === want.join('|') && first.fuel === false && first.names.includes('Move up: Unlocking Routes (off)') && first.names.includes('Move down: Loot Farming (off)') && first.names.includes('Move up: Gil Farming') && first.startsWithText === true &&
        untouched.recs === null &&
        one.order.join('|') === ['1. Unlocking Routes', '2. Gil Farming', '3. Leveling Submersible Rank', '4. Loot Farming'].join('|') && one.focus === 'up-gil' && one.live === 'Gil Farming is now 2 of 4' &&
        two.order[0] === '1. Gil Farming' && two.live === 'Gil Farming is now 1 of 4' && two.focus === 'down-gil' &&
        stored.recs && stored.recs.choices.order.join() === 'gil,unlock,level,loot' && Object.keys(stored.recs.choices).join() === 'order' &&
        reloaded.order[0] === '1. Gil Farming' && reloaded.order.length === 4 &&
        boardDefault.includes('Deep-sea Site: B') && !boardDefault.includes('→') && boardGil.includes('Deep-sea Site: A → B') && boardGil.includes(sheetRoute) && /Suggested · Gil Farming/.test(sheetHead) &&
        after.subs === baseline && real(errors).length === 0;
      record('C85', 'Customizable Recommendations (R5): the Setup panel shows the default order and the fuel switch off; with nothing changed the save has no recommendations section; "Move up" by keyboard reorders, keeps focus and announces "Gil Farming is now 2 of 4"; the order survives a reload; with Gil first the Board button and the send window show the same route, different from the default one, under the header "Suggested · Gil Farming"; modules.submersibles is byte-for-byte unchanged',
        ok, { first, one, two, reloaded: reloaded.order, stored: stored.recs, boardDefault, boardGil, sheetRoute, sheetHead, unchanged: after.subs === baseline, errors: real(errors) });
      await ctx.close().catch(() => {}); server15.close();
    });

    // ── C86 Customizable Recommendations (R5): the slider is disabled until the switch is on; the switch and the number are stored;
    //    on a seeded fleet where fuel changes the route the reason carries the fuel sentence; a second page that changed another
    //    field merges with no prompt.
    await guard('C86', async () => {
      const server16 = await start(PORT5);
      const { ctx, errors } = await context({ deviceScaleFactor: 2 });
      const A = await ctx.newPage(), B = await ctx.newPage();
      let prompts = 0;
      for (const pg of [A, B]) pg.on('dialog', (d) => { prompts++; d.dismiss().catch(() => {}); });
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await A.goto(ROOT5 + 'submersibles/'); await ready(A);
      await A.evaluate(async () => {
        const parts = [3, 4, 1, 2], sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fb = { name: 'Bravo Company', world: 'Gilgamesh', unlockedSlots: 2, order: 0, discovered: [1, 2, 3, 4, 5, 6, 7, 10, 15, 18, 26] };
        sec.subs.b1 = { fcId: 'fb', slot: 1, name: 'Sub B1', rank: 10, parts };
        sec.subs.b2 = { fcId: 'fb', slot: 2, name: 'Sub B2', rank: 10, parts };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await A.reload(); await ready(A);
      await B.goto(ROOT5 + 'submersibles/'); await ready(B);
      for (const pg of [A, B]) { await pg.click('[data-tab=setup]'); await pg.waitForSelector('[data-recs-panel]'); }
      const stored = (pg) => pg.evaluate(async () => { const r = await CC.read(); const m = CC.checkDoc(r.raw).modules['submersibles-recommendations']; return m ? m.choices : null; });
      const sliderOff = await B.$eval('[data-rec=giveUp]', (el) => ({ disabled: el.disabled, value: el.value, min: el.min, max: el.max, step: el.step }));
      const defaultBtnOff = await B.$eval('[data-rec=give-default]', (el) => el.disabled);
      // B stops hearing A (same page id), so its next write really is a write from a stale copy
      const aId = await A.evaluate(() => CC.PAGE_ID);
      await B.evaluate((id) => { CC.PAGE_ID = id; }, aId);
      await A.focus('[data-rec="up-level"]'); await A.keyboard.press('Enter'); // A changes the order: Leveling first
      await A.waitForTimeout(800);
      const afterA = await stored(A);
      await B.check('[data-rec=fuel]'); // B changes the switch from its older copy
      await B.waitForTimeout(800);
      const sliderOn = await B.$eval('[data-rec=giveUp]', (el) => el.disabled);
      const afterMerge = await stored(B);
      const orderOnB = await B.$$eval('.rec-rank .rec-name', (els) => els.map((e) => e.textContent));
      // the page's own indicator of a failed or clashing save is the status line: nothing may be shown on either page
      const statusA = await A.$eval('#status', (el) => el.textContent), statusB = await B.$eval('#status', (el) => el.textContent);
      await B.focus('[data-rec=giveUp]');
      for (let i = 0; i < 3; i++) await B.keyboard.press('ArrowRight');
      await B.waitForTimeout(800);
      const afterSlider = await stored(B);
      const shown = await B.$eval('[data-rec-give-text]', (el) => el.textContent);
      await B.reload(); await ready(B);
      await B.click('[data-tab=setup]'); await B.waitForSelector('[data-recs-panel]');
      const reloaded = await B.evaluate(() => ({ fuel: document.querySelector('[data-rec=fuel]').checked, value: document.querySelector('[data-rec=giveUp]').value, disabled: document.querySelector('[data-rec=giveUp]').disabled }));
      await B.click('[data-tab=board]');
      await B.click('.sub[data-sub="b1"] .sub-top'); await B.waitForSelector('#sheet .advice-route');
      const reason = await B.$eval('#sheet .advice-route + .hint', (p) => p.textContent);
      const sheetHead = await B.$eval('#sheet .advice-step', (b) => b.textContent);
      await B.keyboard.press('Escape');
      // the advice is kept while nothing it reads changes. A setting is changed first (the allowance: 30 to 35), so the cache is
      // really cold: the first stageOf makes one advise call per submarine concerned, the second none, and after another
      // setting change (35 to 40) the next call is fresh again
      await B.click('[data-tab=setup]'); await B.waitForSelector('[data-recs-panel]');
      const stageCalls = () => B.evaluate(() => {
        let calls = 0; const orig = ADVISOR.advise; ADVISOR.advise = function () { calls++; return orig.apply(this, arguments); };
        try {
          const subs = window.__subs.section().subs, concerned = Object.keys(subs).filter((k) => subs[k].fcId === 'fb' && subs[k].slot <= 2).length;
          const one = window.__subs.stageOf('fb'), c1 = calls, two = window.__subs.stageOf('fb');
          return { one, two, concerned, first: c1, second: calls - c1 };
        } finally { ADVISOR.advise = orig; }
      });
      await B.focus('[data-rec=giveUp]'); await B.keyboard.press('ArrowRight'); await B.waitForTimeout(800);
      const cache = await stageCalls();
      await B.focus('[data-rec=giveUp]'); await B.keyboard.press('ArrowRight'); await B.waitForTimeout(800);
      const cacheAfterChange = await stageCalls();
      await ctx.close();
      const ok = sliderOff.disabled === true && sliderOff.min === '5' && sliderOff.max === '50' && sliderOff.step === '5' && sliderOff.value === '15' && defaultBtnOff === true &&
        afterA && afterA.order.join() === 'level,unlock,gil,loot' && Object.keys(afterA).join() === 'order' &&
        sliderOn === false && afterMerge && afterMerge.fuel === true && afterMerge.order.join() === 'level,unlock,gil,loot' && orderOnB[0] === '1. Leveling Submersible Rank' &&
        afterSlider && afterSlider.fuel === true && afterSlider.giveUp === 30 && afterSlider.order.join() === 'level,unlock,gil,loot' && shown === '30%' &&
        reloaded.fuel === true && reloaded.value === '30' && reloaded.disabled === false &&
        /Fuel efficiency: 1 tank instead of 4, for \d+% less experience per hour\./.test(reason) && /Suggested · Leveling Submersible Rank/.test(sheetHead) &&
        afterMerge && afterMerge.fuel === true && afterMerge.order.join() === 'level,unlock,gil,loot' && statusA === '' && statusB === '' && prompts === 0 &&
        cache.concerned === 2 && cache.first === cache.concerned && cache.second === 0 && cache.one === cache.two &&
        cacheAfterChange.first === cacheAfterChange.concerned && cacheAfterChange.second === 0 && real(errors).length === 0;
      record('C86', 'Customizable Recommendations (R5): the slider (5 to 50, step 5) and "Use the default" are disabled until the fuel switch is on; the switch and the number are stored; a second page that changed another field from an older copy merges with no prompt, shows no clash or save problem and keeps the first page\'s order in the stored section together with its own change; after a setting change the notification stage logic makes one advice call per submarine, a second call with nothing changed makes none and a call after another change is fresh; on a seeded fleet where fuel changes the route the reason carries the fuel sentence',
        ok, { sliderOff, defaultBtnOff, afterA, sliderOn, afterMerge, statusA, statusB, cache, cacheAfterChange, orderOnB, afterSlider, shown, reloaded, reason, sheetHead, prompts, errors: real(errors) });
      await ctx.close().catch(() => {}); server16.close();
    });


    // ── C87 Customizable Recommendations (R6): five loot pickers, the first without a switch; every list is the same items A to Z;
    //    typing narrows one list in place (text, caret and focus stay; the chosen item stays listed; no match says so; clearing
    //    restores the list) and is not saved; pickers 2 to 5 are disabled until switched on and keep their choice; an item chosen
    //    once is absent elsewhere; choices survive a reload; a stored duplicate shows "counted once"; no sideways scroll on a phone.
    await guard('C87', async () => {
      const server17 = await start(PORT5);
      const DATA87 = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      const { ctx, errors } = await context({ deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const stored = () => page.evaluate(async () => { const r = await CC.read(); const m = CC.checkDoc(r.raw).modules['submersibles-recommendations']; return m ? JSON.stringify([1, 2, 3, 4, 5].map((n) => [m.choices['loot' + n] || 0, n === 1 || m.choices['use' + n] === true])) : null; });
      const toSetup = async () => { await page.click('[data-tab=setup]'); await page.waitForSelector('[data-recs-panel] .rec-picker'); };
      const opts = (i) => page.$$eval('[data-rec="loot-' + i + '"] option', (os) => os.map((o) => ({ v: o.value, t: o.textContent, d: o.disabled })));
      const sorted = (list) => list.filter((o) => o.v !== '0' && o.v !== '-1').every((o, k, a) => k === 0 || o.t.toLowerCase() >= a[k - 1].t.toLowerCase());
      const state = () => page.evaluate(() => [0, 1, 2, 3, 4].map((i) => ({ sel: document.querySelector('[data-rec="loot-' + i + '"]').disabled, find: document.querySelector('[data-rec-find="' + i + '"]').disabled, val: document.querySelector('[data-rec="loot-' + i + '"]').value,
        sw: (document.querySelector('[data-rec="loot-on-' + i + '"]') || {}).checked, note: document.querySelector('[data-rec-note="' + i + '"]').textContent })));
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async () => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fa = { name: 'Alfa Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2] };
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 1, parts: [3, 4, 1, 2] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready(); await toSetup();
      const pickers = await page.$$eval('.rec-picker', (els) => els.map((e) => ({ sw: !!e.querySelector('[data-rec^="loot-on-"]'), label: e.querySelector('select').getAttribute('aria-label'), find: e.querySelector('input[type=text]').getAttribute('aria-label') })));
      const empty = await page.$eval('[data-rec-empty]', (e) => e.textContent);
      const start0 = await state();
      const full = await opts(0);
      const total = full.length - 1;
      const noneFirst = full[0].t === 'none' && full[0].v === '0';
      const itemCount = await page.evaluate(() => RECS.items(JSON.parse(JSON.stringify(window.SUB_DATA || {}))).length).catch(() => -1);
      // choose Empty Crystal (12928) in picker 1
      await page.selectOption('[data-rec="loot-0"]', '12928');
      await page.waitForTimeout(300);
      const chosen1 = await state();
      const emptyAfter = await page.$eval('[data-rec-empty]', (e) => e.textContent);
      const focusAfterChoice = await page.evaluate(() => document.activeElement.dataset.rec);
      const p2 = await opts(1);
      const lacks = !p2.some((o) => o.v === '12928') && p2.length === full.length - 1;
      // typing narrows picker 1 in place
      const docBefore = await stored();
      await page.click('[data-rec-find="0"]');
      await page.keyboard.type('shard');
      const typed = await page.evaluate(() => ({ focus: document.activeElement.dataset.recFind, val: document.activeElement.value, caret: document.activeElement.selectionStart }));
      const narrow = await opts(0);
      const shardOnly = narrow.filter((o) => o.v !== '0' && o.v !== '12928' && o.v !== '-1');
      const narrowOk = narrow.length < full.length && shardOnly.length > 0 && shardOnly.every((o) => /shard/i.test(o.t)) && narrow.some((o) => o.v === '12928') && sorted(narrow) && sorted(full);
      await page.keyboard.type('zzq');
      const none = await opts(0);
      const noMatch = none.some((o) => o.t === 'No item matches' && o.d) && none.some((o) => o.v === '12928') && none.length === 3;
      const typed2 = await page.evaluate(() => ({ focus: document.activeElement.dataset.recFind, val: document.activeElement.value }));
      await page.fill('[data-rec-find="0"]', '');
      const restored = await opts(0);
      const restoredOk = restored.length === full.length && sorted(restored);
      const docTyped = await stored();
      // picker 2 switched on, an item chosen, then switched off: the choice is kept
      await page.check('[data-rec="loot-on-1"]');
      const on2 = await state();
      await page.fill('[data-rec-find="1"]', 'fire');
      const sh2 = await opts(1);
      await page.selectOption('[data-rec="loot-1"]', '2'); // Fire Shard: possible in one sector only
      await page.waitForTimeout(300);
      const withFire = await state();
      const noteFire = withFire[1].note;
      const findAfter = await page.$eval('[data-rec-find="1"]', (e) => e.value); // typed text of another picker survives a redraw, never saved
      const p1lack = !(await opts(0)).some((o) => o.v === '2') && !(await opts(2)).some((o) => o.v === '2');
      await page.check('[data-rec="loot-on-2"]'); await page.selectOption('[data-rec="loot-2"]', '3'); await page.uncheck('[data-rec="loot-on-2"]');
      const off3 = await state();
      await page.waitForTimeout(800);
      const storedNow = await stored();
      if (SHOT) { const h = await page.$('[data-recs-panel]'); await h.scrollIntoViewIfNeeded(); await h.screenshot({ path: path.join(ev, 'submersibles-recommendations.png') }); }
      await page.reload(); await ready(); await toSetup();
      const reloaded = await state();
      const reNote = reloaded[0].note;
      const typedGone = await page.$eval('[data-rec-find="0"]', (e) => e.value);
      // a stored duplicate: picker 2 holds the item picker 1 already counts
      await page.evaluate(async () => { const r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { fuel: false, giveUp: 10, order: ['unlock', 'level', 'gil', 'loot'], loot1: 12928, loot2: 12928, use2: true, loot3: 0, use3: false, loot4: 0, use4: false, loot5: 0, use5: false } }, { rev: r.rev, base: null }); });
      await page.reload(); await ready(); await toSetup();
      const dup = await state();
      // a stored duplicate can be cleared: choosing "none" in that picker is a change
      await page.selectOption('[data-rec="loot-1"]', '0');
      await page.waitForTimeout(800);
      const dupStored = JSON.parse(await stored()), dupAfter = await state();
      // a switched-off picker blocks nothing: its item stays in the other lists, and switching it on later shows the note
      await page.evaluate(async () => { const r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { loot1: 0, loot2: 12928, use2: false, loot3: 0, use3: false, loot4: 0, use4: false, loot5: 0, use5: false } }, { rev: r.rev, base: null }); });
      await page.reload(); await ready(); await toSetup();
      const offHeld = await state(), offList0 = await opts(0), offList2 = await opts(2);
      await page.selectOption('[data-rec="loot-0"]', '12928');
      await page.waitForTimeout(800);
      await page.check('[data-rec="loot-on-1"]');
      await page.waitForTimeout(800);
      const onLater = await state(), onLaterStored = JSON.parse(await stored());
      // phone width
      await page.setViewportSize({ width: 360, height: 800 });
      await page.waitForTimeout(200);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await ctx.close();
      const ok = pickers.length === 5 && pickers[0].sw === false && pickers.slice(1).every((p) => p.sw) && pickers[1].label === 'Loot item 2' && pickers[1].find === 'Type to narrow the list for loot item 2' &&
        empty === 'No item chosen: Loot Farming is skipped.' && emptyAfter === '' && noneFirst && total >= 300 && sorted(full) &&
        start0[0].sel === false && start0[0].find === false && start0.slice(1).every((s) => s.sel && s.find && s.sw === false) &&
        chosen1[0].val === '12928' && chosen1[0].note === recNoteFor(DATA87, 12928) && /^Recorded in \d+ sectors \(community drop records\)\. Most per survey: /.test(chosen1[0].note) && focusAfterChoice === 'loot-0' && lacks &&
        typed.focus === '0' && typed.val === 'shard' && typed.caret === 5 && narrowOk && typed2.focus === '0' && typed2.val === 'shardzzq' && noMatch && restoredOk && docTyped === docBefore &&
        sh2.some((o) => o.t === 'Fire Shard') && sh2.length < full.length &&
        on2[1].sel === false && on2[1].find === false && on2[1].sw === true && withFire[1].val === '2' && noteFire === recNoteFor(DATA87, 2) && /^Recorded in 1 sector \(community drop records\)\./.test(noteFire) && findAfter === 'fire' && p1lack &&
        off3[2].sel === true && off3[2].find === true && off3[2].val === '3' && off3[2].sw === false &&
        JSON.parse(storedNow)[0][0] === 12928 && JSON.parse(storedNow)[1][0] === 2 && JSON.parse(storedNow)[1][1] === true && JSON.parse(storedNow)[2][0] === 3 && JSON.parse(storedNow)[2][1] === false &&
        reloaded[0].val === '12928' && reloaded[1].val === '2' && reloaded[1].sw === true && reloaded[2].val === '3' && reloaded[2].sw === false && reloaded[2].sel === true && reloaded[0].find === false && typedGone === '' && /^Recorded in/.test(reNote) &&
        dup[1].val === '12928' && /counted once/i.test(dup[1].note) && /picker 1/i.test(dup[1].note) &&
        dupStored[1][0] === 0 && dupAfter[1].val === '0' && !/counted once/i.test(dupAfter[1].note) &&
        offHeld[1].val === '12928' && offList0.some((o) => o.v === '12928') && offList2.some((o) => o.v === '12928') && onLater[1].val === '12928' && /counted once/i.test(onLater[1].note) && /picker 1/i.test(onLater[1].note) && onLaterStored[1][0] === 12928 && onLaterStored[1][1] === true &&
        wide <= 0 && real(errors).length === 0;
      record('C87', 'Customizable Recommendations (R6): Setup shows five loot pickers (a text box and a drop-down each), the first without a switch; every list holds the same items A to Z with "none" first; typing narrows one list in place (the text box keeps its text, caret and focus, the chosen item stays listed, no match shows a disabled "No item matches", clearing restores the list) and is not saved; pickers 2 to 5 are disabled until switched on and keep their choice when switched off; an item chosen in one picker is absent from the others; choices survive a reload; a stored duplicate shows "counted once" and choosing "none" there clears it; a picker that is switched off keeps its item in the other lists, and switching it on later shows "counted once"; no sideways page scroll at 360 px',
        ok, { pickers, empty, total, itemCount, start0: start0.map((s) => [s.sel, s.find]), typed, typed2, narrow: narrow.length, none, restored: restored.length, noteFire, findAfter, p1lack, off3: off3[2], storedNow, reloaded: reloaded.map((s) => [s.val, s.sw, s.sel]), typedGone, dup: dup[1], dupStored, dupAfter: dupAfter[1], offHeld: offHeld[1], offList0: offList0.length, offList2: offList2.length, onLater: onLater[1], onLaterStored, wide, errors: real(errors) });
      await ctx.close().catch(() => {}); server17.close();
    });

    // ── C88 Customizable Recommendations (R6): with Loot Farming first and one item chosen, the Board suggests a route whose sectors
    //    list that item, the reason gives the expected quantity an hour from community drop records, and an item no reachable sector has a record for shows the skip sentence.
    await guard('C88', async () => {
      const server18 = await start(PORT5);
      const { ctx, errors } = await context({ deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      const sea1 = data.sectors.filter((s) => s.sea === 1 && [1, 2].includes(s.id));
      const letterOf = (id) => data.sectors.find((s) => s.id === id).name.replace(/^.*\(([A-Z])\)$/, '$1');
      const item = 5680; // Battledance Materia II: listed by sector 2 only (letter B), not by sector 1
      const listing = [1, 2].filter((id) => (data.loot[id] || []).includes(item));
      const seed = (choices) => page.evaluate(async (c) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fa = { name: 'Alfa Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2] };
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 1, parts: [3, 4, 1, 2] };
        let r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: c }, { rev: r.rev, base: null });
      }, choices);
      const read = async () => {
        await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="a1"]');
        const btn = await page.$eval('.quick[data-quick="a1"]', (b) => b.textContent);
        await page.click('.sub[data-sub="a1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
        const sheet = await page.$eval('#sheet .advice', (b) => b.textContent);
        const head = await page.$eval('#sheet .advice-step', (b) => b.textContent);
        const route = await page.$eval('#sheet .advice-route b', (b) => b.textContent);
        await page.keyboard.press('Escape');
        return { btn, sheet, head, route };
      };
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      const base = { fuel: false, giveUp: 10, order: ['loot', 'unlock', 'level', 'gil'] };
      await seed(Object.assign({}, base, { loot1: item }));
      await page.reload(); await ready();
      const reach = await read();
      await seed(Object.assign({}, base, { loot1: 2 })); // Fire Shard: only a sector far out of this sub's reach
      await page.reload(); await ready();
      const far = await read();
      await ctx.close();
      const ok = listing.length === 1 && reach.head.includes('Loot Farming') && reach.btn.includes(letterOf(listing[0])) && /^.*Expected: about [\d.]+ Battledance Materia II an hour \(estimate from community drop records, at least [\d,.]+( million)? surveys per sector\)\./.test(reach.sheet) && !/drop odds are not known|possible items only|stops? where/.test(reach.sheet) && sea1.length === 2 &&
        /none of your chosen items has a recorded drop this submarine can reach now/.test(far.sheet) && !/Loot Farming\)?$/.test(far.head.trim()) && real(errors).length === 0;
      record('C88', 'Customizable Recommendations (R6): with Loot Farming first and one item chosen, the Board button and the send window suggest a route whose sectors list that item and the reason gives the expected quantity an hour with its source ("estimate from community drop records"); with an item no sector this sub can reach has a drop record for, the reason names that Loot Farming was skipped for that cause',
        ok, { listing, reach, far, errors: real(errors) });
      await ctx.close().catch(() => {}); server18.close();
    });

    // ── C89 Customizable Recommendations (R8): two tabs of one browser, one merge unit per control: A picks an item in picker 1 and it
    //    is saved; B, loaded earlier and not reloaded, switches picker 2 on and picks another item: both choices are stored (with a key
    //    this build does not know, kept), B's picker 1 now shows A's item, neither page shows a save problem, no dialog, no page error.
    await guard('C89', async () => {
      const server19 = await start(PORT5);
      const { ctx, errors } = await context({ deviceScaleFactor: 2 });
      const A = await ctx.newPage(), B = await ctx.newPage();
      let prompts = 0;
      for (const pg of [A, B]) pg.on('dialog', (d) => { prompts++; d.dismiss().catch(() => {}); });
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await A.goto(ROOT5 + 'submersibles/'); await ready(A);
      await A.evaluate(async () => {
        const r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { loot4: 999999999, use4: true } }, { rev: r.rev, base: null });
      });
      await A.reload(); await ready(A);
      await B.goto(ROOT5 + 'submersibles/'); await ready(B);
      for (const pg of [A, B]) { await pg.click('[data-tab=setup]'); await pg.waitForSelector('[data-recs-panel] .rec-picker'); }
      const raw = () => A.evaluate(async () => { const r = await CC.read(); const m = CC.checkDoc(r.raw).modules['submersibles-recommendations']; return m || null; });
      // B stops hearing A (same page id), so its writes really are writes from a stale copy
      const aId = await A.evaluate(() => CC.PAGE_ID);
      await B.evaluate((id) => { CC.PAGE_ID = id; }, aId);
      await A.selectOption('[data-rec="loot-0"]', '12928'); // A: picker 1 gets Empty Crystal
      await A.waitForTimeout(800);
      const afterA = await raw();
      await B.check('[data-rec="loot-on-1"]'); // B: picker 2 on
      await B.waitForTimeout(800);
      await B.selectOption('[data-rec="loot-1"]', '2'); // B: picker 2 gets Fire Shard
      await B.waitForTimeout(800);
      const stored = await raw();
      const c = (stored && stored.choices) || {};
      const picker1OnB = await B.$eval('[data-rec="loot-0"]', (el) => el.value);
      const picker2OnB = await B.$eval('[data-rec="loot-1"]', (el) => ({ value: el.value, on: document.querySelector('[data-rec="loot-on-1"]').checked }));
      // A moves Gil Farming up; B has not seen it and still shows the default order: "Use the default order" on B is the later
      // change and must win, not be dropped as "nothing changed"
      await A.click('[data-rec="up-gil"]');
      await A.waitForTimeout(800);
      const orderAfterA = ((await raw()).choices.order || []).join(',');
      await B.click('[data-rec="order-default"]');
      await B.waitForTimeout(800);
      const orderAfterB = ((await raw()).choices.order || []).join(',');
      const statusA = await A.$eval('#status', (el) => el.textContent), statusB = await B.$eval('#status', (el) => el.textContent);
      const liveB = await B.$eval('[data-recs-live]', (el) => el.textContent);
      await ctx.close();
      const ok = afterA && afterA.choices.loot1 === 12928 &&
        orderAfterA === 'unlock,gil,level,loot' && orderAfterB === 'unlock,level,gil,loot' &&
        c.loot1 === 12928 && c.loot2 === 2 && c.use2 === true && c.loot4 === 999999999 && c.use4 === true && !('loot' in c) &&
        picker1OnB === '12928' && picker2OnB.value === '2' && picker2OnB.on === true &&
        statusA === '' && statusB === '' && !/Not saved/.test(liveB) && prompts === 0 && real(errors).length === 0;
      record('C89', 'Customizable Recommendations (R8): in two tabs of one browser, A picks an item in picker 1 and it is saved; B, loaded earlier and not reloaded, switches picker 2 on and picks another item; the save then holds both items, picker 2\'s switch and a key this build does not know, with no old "loot" key; B\'s picker 1 shows A\'s item; A then moves Gil Farming up and "Use the default order" on B, which has not seen that, puts the default order back; neither page shows a save problem, no dialog and no page error',
        ok, { afterA, stored, orderAfterA, orderAfterB, picker1OnB, picker2OnB, statusA, statusB, liveB, prompts, errors: real(errors) });
      await ctx.close().catch(() => {}); server19.close();
    });

    // ── C90 Submersibles drop rates, work item D3: a seeded rank-145 submarine (everything found, no log) at the gil step: the
    //    Board button and the send window show the same route, which is the best runnable community route by estimated merchant
    //    gil per hour (worked out here from the data); the reason says "Community gil route", "estimate from community drop
    //    records" and a record count, and no sentence is about sector stars.
    await guard('C90', async () => {
      const server21 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      for (const f of ['recs.js', 'drops.js', 'advisor.js']) require(path.join(CC, 'src', 'submersibles', f));
      const NA = globalThis.ADVISOR.init(data), PARTS = [31, 24, 25, 34], ST = NA.stats(145, PARTS);
      let best = null;
      for (const cr of data.commonRoutes) { const ev = NA.evalRoute(cr.route, ST); if (!ev || !ev.reachable) continue; const g = globalThis.DROPS.perHour(globalThis.DROPS.route(data, cr.route, ST).gil, ev.seconds); if (!best || g > best.g) best = { name: cr.name, route: cr.route, g }; }
      const bestText = NA.routeText(best.route);
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async ([all, parts]) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fm = { name: 'Mike Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.m1 = { fcId: 'fm', slot: 1, name: 'Sub M1', rank: 145, parts };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, [data.sectors.map((x) => x.id), PARTS]);
      await page.reload(); await ready();
      await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="m1"]');
      const btn = await page.$eval('.quick[data-quick="m1"]', (b) => ({ text: b.textContent, title: b.getAttribute('title') }));
      await page.click('.sub[data-sub="m1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
      const sheet = await page.evaluate(() => ({ route: document.querySelector('#sheet .advice-route b').textContent, why: document.querySelector('#sheet .advice-route + .hint').textContent, send: document.querySelector('#sheet [data-act=quick]').dataset.route, head: document.querySelector('#sheet .advice-step').textContent }));
      await ctx.close();
      const why = /^Community gil route [^:]+: about [\d,]+ gil a voyage at merchant prices \(about [\d,]+ an hour for this submarine\): an estimate from community drop records \(at least [\d.,]+( million)? surveys per sector on this route\), not a promise\. The best of the \d+ community gil routes this submarine can run\./;
      const ok = btn.text.includes(bestText) && sheet.route === bestText && sheet.send === best.route.join(',') && btn.title === sheet.why && why.test(sheet.why) && sheet.why.includes('Community gil route ' + best.name + ':') &&
        !/stars|only a guide/.test(btn.title + sheet.why) && /Suggested · step 3 of 3: Farm gil/.test(sheet.head) && real(errors).length === 0;
      record('C90', 'Gil Farming (D3): a rank-145 submarine with everything found and no log: the Board button and the send window show the same route, the best runnable community route by estimated merchant gil per hour (worked out from the data), and the reason says "Community gil route", "an estimate from community drop records" with its record count and "not a promise", and says nothing about stars',
        ok, { best, bestText, btn, sheet, errors: real(errors) });
      server21.close();
    });

    // ── C91 Submersibles drop rates, work item D3: a seeded rank-15 submarine (a few sectors found, Gil Farming first) cannot run
    //    a community route: "Found by the app from community drop rates", with the cause; with ten logged voyages on the route
    //    the log sentence stands beside the estimate and says which decided.
    await guard('C91', async () => {
      const server22 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      const seed = (trips) => page.evaluate(async (n) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} }, parts = [3, 4, 1, 2];
        sec.fcs.fn = { name: 'November Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
        sec.subs.n1 = { fcId: 'fn', slot: 1, name: 'Sub N1', rank: 15, parts };
        if (n.route) for (let i = 1; i <= n.count; i++) sec.trips['n1-' + i] = { s: 'n1', t: now - (40 + i * 30) * H, r: n.route, back: now - (40 + i * 30 - 29) * H, items: [[10099, 20000]], newSectors: [] };
        let r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { order: ['gil', 'unlock', 'level', 'loot'] } }, { rev: r.rev, base: null });
      }, trips);
      const read = async () => {
        await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="n1"]');
        const btn = await page.$eval('.quick[data-quick="n1"]', (b) => ({ text: b.textContent, title: b.getAttribute('title') }));
        await page.click('.sub[data-sub="n1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
        const sheet = await page.evaluate(() => ({ route: document.querySelector('#sheet .advice-route b').textContent, why: document.querySelector('#sheet .advice-route + .hint').textContent, head: document.querySelector('#sheet .advice-step').textContent }));
        await page.keyboard.press('Escape');
        return { btn, sheet };
      };
      await seed({}); await page.reload(); await ready();
      const plain = await read();
      // the route the advice shows, as sector ids, from the send window's button
      await page.click('.sub[data-sub="n1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
      const shown = await page.$eval('#sheet [data-act=quick]', (el) => el.dataset.route); await page.keyboard.press('Escape');
      await seed({ route: shown.split(',').map(Number), count: 10 }); await page.reload(); await ready();
      const logged = await read();
      await ctx.close();
      const head = /^No community gil route can be run by this submarine now \(sectors not found\)\. Found by the app from community drop rates: about [\d,]+ gil a voyage at merchant prices \(about [\d,]+ an hour for this submarine\): an estimate from community drop records \(at least [\d.,]+( million)? surveys per sector on this route\), not a promise\./;
      const logSentence = /Your own log on this route: about [\d,]+ gil an hour at merchant prices over 10 logged voyages \(this submarine is back in [\d.]+ hours\); the community estimate is about [\d,]+ an hour\. Your own log decided/;
      const ok = head.test(plain.sheet.why) && plain.btn.title === plain.sheet.why && !/Your own log/.test(plain.sheet.why) && /Suggested · Gil Farming/.test(plain.sheet.head) &&
        head.test(logged.sheet.why) && logSentence.test(logged.sheet.why) && logged.btn.title === logged.sheet.why && logged.sheet.route === plain.sheet.route && !/stars|only a guide/.test(plain.sheet.why + logged.sheet.why) && real(errors).length === 0;
      record('C91', 'Gil Farming (D3): a rank-15 submarine with sectors A to I found and Gil Farming first cannot run a community route: the reason says "No community gil route can be run by this submarine now (sectors not found)" and "Found by the app from community drop rates", with an estimate and its record count; with ten seeded logged voyages on that route the log sentence stands beside the community estimate and says "Your own log decided", on the Board and in the send window',
        ok, { plain, logged, shown, errors: real(errors) });
      server22.close();
    });

    // ── C92 Submersibles drop rates, work item D4: one submarine at the top rank and one at rank 60 in a seeded free company: the
    //    Setup line under the Leveling row names only the first; the Leveling row's buttons still work; the first shows a gil
    //    route, the second a levelling route; when every submarine is at the top rank the line says so.
    await guard('C92', async () => {
      const server23 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      const TOP = data.ranks[data.ranks.length - 1].rank;
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      const seed = (secondRank) => page.evaluate(async ([all, top, second]) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} }, parts = [31, 24, 25, 34];
        sec.fcs.fo = { name: 'Oscar Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.o1 = { fcId: 'fo', slot: 1, name: 'Sub Top', rank: top, parts };
        sec.subs.o2 = { fcId: 'fo', slot: 2, name: 'Sub Mid', rank: second, parts };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, [data.sectors.map((x) => x.id), TOP, secondRank]);
      await seed(60); await page.reload(); await ready();
      await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="o1"]');
      const board = () => page.evaluate(() => ({ o1: document.querySelector('.quick[data-quick="o1"]').getAttribute('title'), o2: document.querySelector('.quick[data-quick="o2"]').getAttribute('title') }));
      const b1 = await board();
      await page.click('[data-tab=setup]'); await page.waitForSelector('[data-recs-panel]');
      const line = () => page.evaluate(() => { const e = document.querySelector('[data-rec-top-skip]'); return { text: e ? e.textContent : null, prevRow: e && e.previousElementSibling ? e.previousElementSibling.textContent : null }; });
      const l1 = await line();
      const order = () => page.$$eval('.rec-rank .rec-name', (els) => els.map((e) => e.textContent));
      const enabled = await page.evaluate(() => ({ up: !document.querySelector('[data-rec="up-level"]').disabled, down: !document.querySelector('[data-rec="down-level"]').disabled }));
      await page.focus('[data-rec="up-level"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      const o1 = await order(), l2 = await line();
      await page.focus('[data-rec="down-level"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      const o2 = await order();
      await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="o1"]');
      const b2 = await board();
      await seed(TOP); await page.reload(); await ready();
      await page.click('[data-tab=setup]'); await page.waitForSelector('[data-recs-panel]');
      const lAll = await line();
      await ctx.close();
      const want = 'Skipped for submarines at rank ' + TOP + ', the top rank: Sub Top. They go to the next priority.';
      const ok = TOP === 145 && l1.text === want && !/Sub Mid/.test(l1.text) && /Leveling Submersible Rank/.test(l1.prevRow) &&
        enabled.up && enabled.down && o1[0] === '1. Leveling Submersible Rank' && o2.join('|') === ['1. Unlocking Routes', '2. Leveling Submersible Rank', '3. Gil Farming', '4. Loot Farming'].join('|') && l2.text === want &&
        /^Community gil route /.test(b1.o1) && /Skipped Leveling Submersible Rank: this submarine is at rank 145, the top rank\./.test(b1.o1) && /^(Most experience per hour within reach|At least [\d,]+ experience an hour)/.test(b1.o2) && !/top rank/.test(b1.o2) &&
        /^Community gil route /.test(b2.o1) && /^(Most experience per hour within reach|At least [\d,]+ experience an hour)/.test(b2.o2) &&
        lAll.text === 'Skipped for submarines at rank ' + TOP + ', the top rank: every submarine.' && real(errors).length === 0;
      record('C92', 'The top rank (D4): with one submarine at rank 145 and one at rank 60, the Setup line under the Leveling row names only the first; the Leveling row\'s Move up and Move down still work and the line stays; the rank-145 submarine\'s Board button shows a community gil route with "Skipped Leveling Submersible Rank: this submarine is at rank 145, the top rank." and the rank-60 one a levelling route; with every submarine at 145 the line says "every submarine"',
        ok, { TOP, b1, l1, enabled, o1, o2, l2, b2, lAll, errors: real(errors) });
      server23.close();
    });

    // ── C93 Submersibles drop rates, work item D5: a seeded rank-145 submarine, Loot Farming first and item 22507 (Extravagant
    //    Salvaged Necklace) chosen: the Board button's reason and the send window's reason start "Expected: about" and name the item,
    //    with the source and the record count; the Setup picker note says "Recorded in" (worked out here from the data); a second
    //    picker with an item that has no drop record shows "no drop record yet" and the plan does not count it.
    await guard('C93', async () => {
      const server24 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      const NONE = 9298; // Classic Spectacles: listed as possible by a sector, no drop record
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async ([all, none]) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fn = { name: 'November Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.n1 = { fcId: 'fn', slot: 1, name: 'Sub N1', rank: 145, parts: [31, 24, 25, 34] };
        let r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { fuel: false, giveUp: 10, order: ['loot', 'unlock', 'level', 'gil'], loot1: 22507, loot2: none, use2: true } }, { rev: r.rev, base: null });
      }, [data.sectors.map((x) => x.id), NONE]);
      await page.reload(); await ready();
      await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="n1"]');
      const btn = await page.$eval('.quick[data-quick="n1"]', (b) => ({ text: b.textContent, title: b.getAttribute('title') }));
      await page.click('.sub[data-sub="n1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
      const sheet = await page.evaluate(() => ({ head: document.querySelector('#sheet .advice-step').textContent, why: document.querySelector('#sheet .advice-route + .hint').textContent }));
      await page.keyboard.press('Escape');
      await page.click('[data-tab=setup]'); await page.waitForSelector('[data-rec-note="0"]');
      const notes = await page.evaluate(() => [0, 1].map((i) => document.querySelector('[data-rec-note="' + i + '"]').textContent));
      await ctx.close();
      const reason = /^Expected: about [\d.]+ Extravagant Salvaged Necklace an hour \(estimate from community drop records, at least [\d,.]+( million)? surveys per sector\)\./;
      const ok = /Loot Farming/.test(sheet.head) && reason.test(sheet.why) && btn.title === sheet.why && !/drop odds are not known|possible items only/.test(sheet.why + btn.title) &&
        notes[0] === recNoteFor(data, 22507) && /^Recorded in \d+ sectors? \(community drop records\)\. Most per survey: /.test(notes[0]) &&
        notes[1] === recNoteFor(data, NONE) && /no drop record yet/.test(notes[1]) && !sheet.why.includes('Classic Spectacles') && real(errors).length === 0;
      record('C93', 'Loot Farming with rates (D5): a rank-145 submarine, Loot Farming first and Extravagant Salvaged Necklace chosen: the Board button and the send window give a reason that starts "Expected: about", names the item and says "estimate from community drop records" with a record count; the Setup picker note says "Recorded in n sectors (community drop records). Most per survey: ..." (worked out from the data); an item with no drop record shows "no drop record yet" and is not counted in the plan',
        ok, { sheet, btn, notes, expected: [recNoteFor(data, 22507), recNoteFor(data, NONE)], errors: real(errors) });
      server24.close();
    });

    // ── C94 Submersibles drop rates, work item D6: a seeded rank-85 submarine (Gil Farming first, everything found) whose plan is the
    //    community route OJ: the send window shows a part tip valued by the estimate, with the threshold sentence (retrieval becomes
    //    optimal at O, 160 needed, 148 now) and the "counted as worth nothing" sentence; no gil tip appears beside a non-gil plan.
    await guard('C94', async () => {
      const server25 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      const seed = (order) => page.evaluate(async ([all, ord]) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fo = { name: 'Oscar Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.o1 = { fcId: 'fo', slot: 1, name: 'Sub O1', rank: 85, parts: [3, 4, 5, 14] };
        let r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { fuel: false, giveUp: 10, order: ord } }, { rev: r.rev, base: null });
      }, [data.sectors.map((x) => x.id), order]);
      const read = async () => {
        await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="o1"]');
        await page.click('.sub[data-sub="o1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
        const got = await page.evaluate(() => ({ route: document.querySelector('#sheet .advice-route b').textContent, notes: [...document.querySelectorAll('#sheet .advice .note')].map((n) => n.textContent) }));
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 }).catch(() => {});
        return got;
      };
      await seed(['gil', 'unlock', 'level', 'loot']); await page.reload(); await ready();
      const gil = await read();
      await seed(['level', 'unlock', 'gil', 'loot']); await page.reload(); await ready();
      const lvl = await read();
      await ctx.close();
      const tip = gil.notes.find((n) => /^Swapping the /.test(n)) || '';
      const ok = /estimated to give about \+[\d,]+ gil an hour on this route \(estimate from community drop records, at merchant prices\): \d+ minutes faster; retrieval becomes optimal at O \(160 needed, 148 now\)\./.test(tip) &&
        /Above a threshold, extra surveillance, retrieval or favor is counted as worth nothing: the community's reading, not confirmed\./.test(tip) &&
        lvl.notes.every((n) => !/estimated to give|counted as worth nothing/.test(n)) && real(errors).length === 0;
      record('C94', 'Part advice by estimate (D6): a rank-85 submarine with Gil Farming first shows a part tip valued by the community estimate that names the threshold crossed ("retrieval becomes optimal at O (160 needed, 148 now)") and says extra surveillance, retrieval or favor above a threshold is counted as worth nothing; with Leveling first the same submarine shows no gil tip',
        ok, { gil, lvl, tip, errors: real(errors) });
      server25.close();
    });

    // ── C95 Submersibles drop rates, work item D7: at 360 px wide, selecting O on the Map shows "61,069,971 surveys", the
    //    thresholds line and three tier blocks (tier 3 first, the odds worked out here from the data) with a first item's
    //    share, quantities and merchant price; the page does not scroll sideways.
    await guard('C95', async () => {
      const server26 = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      require(path.join(CC, 'src', 'submersibles', 'drops.js'));
      const DR = globalThis.DROPS, O = 15, sec = data.dropRates.sectors[O], bp = data.breakpoints[O];
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async ([all]) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fo = { name: 'Oscar Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.o1 = { fcId: 'fo', slot: 1, name: 'Sub O1', rank: 145, parts: [31, 24, 25, 34] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, [data.sectors.map((x) => x.id)]);
      await page.reload(); await ready();
      await page.click('[data-tab=map]'); await page.waitForSelector('.chart-svg');
      await page.click('.chart-svg [data-sector="' + O + '"]'); await page.waitForSelector('.chart-details .rates');
      const got = await page.evaluate(() => ({ text: document.querySelector('.chart-details').textContent, tiers: [...document.querySelectorAll('.chart-details .rates-tier')].map((d) => ({ tier: d.dataset.tier, summary: d.querySelector('summary').textContent, first: d.querySelector('.rate-item') && d.querySelector('.rate-item').textContent })),
        side: document.documentElement.scrollWidth - window.innerWidth, open: document.querySelectorAll('.chart-details details[open]').length }));
      await ctx.close();
      const band2 = (t) => sec.pools[t].band[2], sum2 = band2(0) + band2(1) + band2(2);
      const top = sec.pools[2].items.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0])[0], rolls3 = sec.pools[2].band[0] + sec.pools[2].band[1] + sec.pools[2].band[2];
      const rng = (lo, hi) => (!lo && !hi ? 'none' : lo === hi ? String(lo) : lo + ' to ' + hi);
      const firstWant = data.items[top[0]] + DR.fmt.pct(top[1] / rolls3) + ' of this tier' + [rng(top[3], top[4]), rng(top[5], top[6]), rng(top[7], top[8])].join(' / ') + ' by retrieval (poor / normal / optimal)' + Math.round(data.itemInfo[top[0]][0]).toLocaleString('en') + ' gil each at a merchant';
      const thr = 'Thresholds (community): surveillance ' + bp[0] + ' for tier 2, ' + bp[1] + ' for tier 3; retrieval ' + bp[2] + ' for normal, ' + bp[3] + ' for optimal quantities; favor ' + bp[4] + ' for a possible second item (it came on ' + DR.fmt.pct(sec.favor[1] / sec.favor[0]) + ' of surveys with enough favor).';
      const ok = got.text.includes(sec.n.toLocaleString('en') + ' surveys') && got.text.includes('Community drop records: 61,069,971 surveys.') && got.text.includes(thr) && got.tiers.length === 3 && got.tiers.map((x) => x.tier).join() === '3,2,1' &&
        got.tiers[0].summary === 'Tier 3 (surveillance ' + bp[1] + ' or more): ' + DR.fmt.pct(band2(2) / sum2) + ' of surveys by submarines with surveillance ' + bp[1] + ' or more land here' && got.tiers[1].summary.startsWith('Tier 2 (surveillance ' + bp[0] + ' or more): ') && got.tiers[2].summary.startsWith('Tier 1 (any surveillance): ') && (got.text.match(/How this is estimated/g) || []).length === 1 && got.tiers[0].first === firstWant && got.open === 0 && !/Possible items/.test(got.text) && got.side <= 0 && real(errors).length === 0;
      record('C95', 'Drop rates on the Map (D7): at 360 px wide, selecting O shows "Community drop records: 61,069,971 surveys.", the thresholds line (worked out from the data), three collapsed tier blocks with tier 3 first, each heading saying what the tier needs ("Tier 3 (surveillance 115 or more): p% of surveys by submarines with surveillance 115 or more land here"), and one collapsed "How this is estimated" for the screen, and per item its share of the tier, quantities by retrieval and merchant price; the old comma list is gone; the page does not scroll sideways',
        ok, { got: { tiers: got.tiers, side: got.side, open: got.open }, thr, firstWant, errors: real(errors) });
      server26.close();
    });

    // ── C96 Submersibles drop rates, work item D7: the send window for OJ (opened from the Map planner) shows the estimate,
    //    one line per sector and the collapsed list of what the route usually brings; the Earnings row of a logged route shows
    //    "Community average for this route" and the own-log figure; the page does not scroll sideways at 360 px.
    await guard('C96', async () => {
      const server27 = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      for (const f of ['recs.js', 'drops.js', 'advisor.js']) require(path.join(CC, 'src', 'submersibles', f));
      const NA = globalThis.ADVISOR.init(data), DR = globalThis.DROPS, PARTS = [31, 24, 25, 34], ST = NA.stats(145, PARTS), OJ = data.commonRoutes.find((c) => c.name === 'Fight Club - OJ').route;
      const ev = NA.evalRoute(OJ, ST), res = DR.route(data, OJ, ST), avg = DR.route(data, OJ, null), price = DR.merchant(data);
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async ([all, parts, route]) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fp = { name: 'Papa Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.p1 = { fcId: 'fp', slot: 1, name: 'Sub P1', rank: 145, parts };
        sec.trips.t1 = { s: 'p1', t: now - 60 * H, r: route, back: now - 40 * H, items: [[22507, 4]], newSectors: [] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, [data.sectors.map((x) => x.id), PARTS, OJ]);
      await page.reload(); await ready();
      await page.click('[data-tab=map]'); await page.waitForSelector('.chart-svg');
      await page.selectOption('#map-sub', 'p1'); await page.click('[data-map-use="' + OJ.join(',') + '"]');
      await page.click('[data-map-send="p1"]'); await page.waitForSelector('#sheet [data-rates]');
      const sheet = await page.evaluate(() => { const b = document.querySelector('#sheet [data-rates]'); return { lines: [...b.querySelectorAll(':scope > p.hint')].map((x) => x.textContent), list: [...b.querySelectorAll(':scope > details.rates')].map((d) => ({ head: d.querySelector('summary').textContent, open: d.open, items: [...d.querySelectorAll('.rate-item')].map((x) => x.textContent) })),
        side: document.documentElement.scrollWidth - window.innerWidth, sheetSide: document.querySelector('#sheet').scrollWidth - document.querySelector('#sheet').clientWidth }; });
      await page.keyboard.press('Escape');
      await page.click('[data-tab=earn]'); await page.waitForSelector('.earn-note');
      const earn = await page.evaluate(() => ({ notes: [...document.querySelectorAll('.earn-note')].map((x) => x.textContent), side: document.documentElement.scrollWidth - window.innerWidth }));
      await ctx.close();
      const estWant = 'About ' + DR.fmt.voyage(res.gil) + ' gil a voyage at merchant prices (about ' + DR.fmt.hour(DR.perHour(res.gil, ev.seconds)) + ' an hour for this submarine): an estimate from community drop records (at least ' + DR.fmt.count(res.count) + ' surveys per sector on this route), not a promise.' + (res.few ? ' Few records for a submarine like this one.' : '');
      const ids = Object.keys(res.items).map(Number).filter((id) => res.items[id] > 0).sort((a, b) => res.items[b] * price(b) - res.items[a] * price(a) || a - b).slice(0, 8);
      const itemsWant = ids.map((id) => data.items[id] + 'about ' + DR.fmt.qty(res.items[id]) + ' a voyage');
      const sectorLines = sheet.lines.filter((l) => /^[OJ]: /.test(l));
      const avgWant = 'Community average for this route: about ' + DR.fmt.voyage(avg.gil) + ' gil a voyage at merchant prices (what the community\'s submarines brought back; at least ' + DR.fmt.count(avg.count) + ' surveys per sector).';
      const ok = sheet.lines[0] === estWant && sectorLines.length === 2 && /^O: tier 3 in reach, retrieval optimal, second item possible$/.test(sectorLines[0]) && /^J: tier 3 in reach, retrieval optimal, second item possible$/.test(sectorLines[1]) &&
        sheet.list.length === 2 && sheet.list[0].head === 'What this route usually brings' && !sheet.list[0].open && JSON.stringify(sheet.list[0].items) === JSON.stringify(itemsWant) && sheet.list[0].items.length <= 8 && sheet.list[1].head === 'How this is estimated' && !sheet.list[1].open &&
        sheet.side <= 0 && sheet.sheetSide <= 0 && earn.notes.length >= 1 && earn.notes[0].startsWith(avgWant) && /Your own log: about [\d,]+ gil a voyage at merchant prices over 1 voyage\./.test(earn.notes[0]) && earn.side <= 0 && real(errors).length === 0;
      record('C96', 'Drop rates in the send window and Earnings (D7): the send window for OJ (from the Map planner) shows the estimate line, one line per sector ("O: tier 3 in reach, retrieval optimal, second item possible"), a collapsed "What this route usually brings" with the expected items (worked out from the data) and a collapsed "How this is estimated"; the Earnings row of a logged route shows "Community average for this route: about X gil a voyage at merchant prices (...)" and the own-log figure; no sideways scroll at 360 px',
        ok, { estWant, lines: sheet.lines, list: sheet.list, itemsWant, avgWant, earn, side: sheet.side, errors: real(errors) });
      server27.close();
    });

    // ── C97 Submersibles voyage gauge (W21): a submarine that is out shows a gauge filled to (now - sent) / (return - sent) from the stored times, named in words for a screen reader;
    //    0 % at the send time, about half mid-voyage, the gauge follows the clock, none after the return or when a time is missing; not animated with reduced motion; rows do not grow, in the dense Board too ──
    await guard('C97', async () => {
      const server28 = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      const seed = (nfc) => page.evaluate(async (n) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        for (let i = 0; i < n; i++) {
          sec.fcs['f' + i] = { name: 'Co ' + i, world: 'Maduin', order: i, unlockedSlots: 4, discovered: [1, 2, 3] };
          const base = { fcId: 'f' + i, rank: 50, parts: [3, 4, 1, 2] };
          if (i === 0) {
            sec.subs.zero = Object.assign({ slot: 1, name: 'Zero' }, base, { voyage: { sentAt: now + 1000, route: [1], returnAt: now + 4 * H } });
            sec.subs.mid = Object.assign({ slot: 2, name: 'Mid' }, base, { voyage: { sentAt: now - 2 * H, route: [1], returnAt: now + 2 * H } });
            sec.subs.fast = Object.assign({ slot: 3, name: 'Fast' }, base, { voyage: { sentAt: now - 40000, route: [1], returnAt: now + 60000 } });
            sec.subs.nosent = Object.assign({ slot: 4, name: 'Nosent' }, base, { voyage: { route: [1], returnAt: now + 3 * H } });
          } else {
            sec.subs['o' + i] = Object.assign({ slot: 1, name: 'Out ' + i }, base, { voyage: { sentAt: now - H, route: [1], returnAt: now + 3 * H } });
            sec.subs['i' + i] = Object.assign({ slot: 2, name: 'Idle ' + i }, base, { voyage: null });
          }
        }
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, nfc);
      await seed(1); await page.reload(); await ready(); await page.waitForSelector('.sub[data-sub="zero"] .vgauge');
      const read = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sub[data-sub]')].map((el) => { const g = el.querySelector('.vgauge'); return [el.dataset.sub, g ? { p: +g.style.getPropertyValue('--p'), text: g.nextElementSibling.textContent, hidden: g.getAttribute('aria-hidden'), status: el.dataset.status } : { none: true, status: el.dataset.status }]; })));
      const first = await read();
      const mot = await page.evaluate(() => { const g = document.querySelector('.sub[data-sub="mid"] .vgauge'), a = getComputedStyle(g, '::after'), b = getComputedStyle(g, '::before'); return { g: getComputedStyle(g).animationName, a: a.animationName, b: b.animationName, tr: a.transitionDuration, h: Math.round(g.getBoundingClientRect().height) }; });
      const fastP = first.fast.p;
      await page.waitForFunction((p) => +document.querySelector('.sub[data-sub="fast"] .vgauge').style.getPropertyValue('--p') > p, fastP, { timeout: 10000 });
      const followed = await page.evaluate(() => +document.querySelector('.sub[data-sub="fast"] .vgauge').style.getPropertyValue('--p'));
      // after the return (60 s from the seed): the row turns Back and the gauge is gone
      await page.waitForSelector('.sub[data-sub="fast"][data-status="back"]', { timeout: 90000 });
      const after = await read();
      // the row's height with and without the gauge (3 px in the dense Board), and the gauge inside the row
      await seed(5); await page.reload(); await ready(); await page.waitForSelector('.sub[data-sub="o1"] .vgauge');
      const dense = await page.evaluate(() => {
        const row = document.querySelector('.sub[data-sub="o1"]'), g = row.querySelector('.vgauge'), h0 = row.getBoundingClientRect().height, gr = g.getBoundingClientRect(), rr = row.getBoundingClientRect();
        g.style.display = 'none'; const h1 = row.getBoundingClientRect().height; g.style.display = '';
        const subs = [...document.querySelectorAll('.fc .sub[data-status]')]; 
        return { h0, h1, gaugeH: Math.round(gr.height), inside: gr.top >= rr.top && gr.bottom <= rr.bottom + 0.5, maxBottom: Math.round(Math.max(...subs.map((e) => e.getBoundingClientRect().bottom))), sideways: document.documentElement.scrollWidth - window.innerWidth };
      });
      await ctx.close();
      const pct = (r) => Math.floor(r.p * 100);
      const ok = first.zero.p === 0 && first.zero.text === 'Voyage 0 percent done' && Math.abs(first.mid.p - 0.5) < 0.01 && /^Voyage 4[89] percent done$|^Voyage 50 percent done$/.test(first.mid.text) && first.zero.hidden === 'true' &&
        first.nosent.none === true && first.nosent.status === 'out' && followed > fastP && after.fast.none === true && after.fast.status === 'back' && !!after.mid.p &&
        mot.g === 'none' && mot.a === 'none' && mot.b === 'none' && mot.h >= 3 && dense.h0 === dense.h1 && dense.gaugeH === 3 && dense.inside && dense.sideways <= 0 && dense.maxBottom <= 1080 && real(errors).length === 0;
      record('C97', 'Voyage gauge (W21): an Out submarine shows a gauge from its stored send and return times: 0 % at the send time (Voyage 0 percent done in words, the bar hidden from screen readers), half mid-voyage, following the clock, absent after the return and when the send time is missing; no animation with reduced motion; the dense Board rows (5 companies) do not grow and stay inside 1920 x 1080',
        ok, { first, mot, fastP, followed, after: { fast: after.fast, mid: after.mid }, dense, pct: pct(first.mid), errors: real(errors) });
      server28.close();
    });

    // ── C103 to C106 Submersibles Board as a timeline (W32, Rev4.7): the axis, the markers, the tallies, by return time, the phone ──
    const tlSeed = (pg, build) => pg.evaluate(async (src) => {
      const now = Date.now(), H = 3600000, M = 60000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
      new Function('sec', 'now', 'H', 'M', src)(sec, now, H, M);
      const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
    }, build);
    const OUT = (id, fc, slot, name, ms) => "sec.subs['" + id + "'] = { fcId: '" + fc + "', slot: " + slot + ", name: '" + name + "', rank: 50, parts: [3, 4, 1, 2], voyage: { sentAt: now - H, route: [1, 2], returnAt: now + " + ms + " } };";
    const FCS = (id, name, order, unlocked) => "sec.fcs['" + id + "'] = { name: '" + name + "', world: 'Maduin', order: " + order + ", unlockedSlots: " + unlocked + ", discovered: [1, 2, 3] };";
    // markers: each Out lane's marker as a share of its track, read from the page
    const markers = (pg) => pg.evaluate(() => [...document.querySelectorAll('.fc .sub[data-status="out"] .tl')].map((tl) => { const e = tl.querySelector('.tl-end'), r = tl.getBoundingClientRect(), q = e.getBoundingClientRect(); return { cls: tl.className, share: (q.left + q.width / 2 - r.left) / r.width, ret: +tl.style.getPropertyValue('--ret'), at: +tl.dataset.ret, shown: getComputedStyle(e).display !== 'none' }; }));
    await guard('C103', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage(); const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await tlSeed(page, FCS('fa', 'Alpha Company', 0, 4) + FCS('fb', 'Bravo Company', 1, 2) + OUT('o1', 'fa', 1, 'Sub O1', '6 * H') + OUT('o2', 'fa', 2, 'Sub O2', '20 * H') + OUT('o3', 'fa', 3, 'Sub O3', '30 * H') + OUT('o4', 'fa', 4, 'Sub O4', '10 * H') + OUT('p1', 'fb', 1, 'Sub P1', '15 * H') + OUT('p2', 'fb', 2, 'Sub P2', '8 * H')); // 30 h longest: span 48
      await page.reload(); await ready(); await page.waitForSelector('.tl.out');
      const got = await page.evaluate(() => { const ax = document.querySelector('.tl-axis'); return { span: ax.dataset.span, ticks: [...ax.querySelectorAll('i:not(.tl-mark)')].map((i) => i.textContent), axes: document.querySelectorAll('.tl-axis').length, aria: ax.getAttribute('aria-hidden'), next: document.querySelector('.strip-next').textContent, back: document.querySelector('.strip-back').textContent, tallies: Object.fromEntries([...document.querySelectorAll('.strip-tally')].map((t) => [t.classList[1], t.querySelector('b').textContent + '|' + t.textContent.trim()])), more: !!document.querySelector('.strip-more'), labels: [...document.querySelectorAll('.fc .sub[data-sub]')].map((l) => l.getAttribute('aria-label')).slice(0, 2) }; });
      const mk = await markers(page), now = await page.evaluate(() => Date.now());
      const off = mk.map((m) => Math.abs(m.share - (m.at - now) / (48 * 3600000)));
      await ctx.close();
      const ok = got.span === '48' && JSON.stringify(got.ticks) === '["now","+12 h","+24 h","+36 h","+48 h"]' && got.axes === 2 && got.aria === 'true' && mk.length === 6 && off.every((x) => x < 0.01) && mk.every((m) => m.shown && /\bout\b/.test(m.cls)) &&
        /^Next back: Alpha Company · Sub O1 in (5 h \d+ min|6 h)$/.test(got.next) && got.back === '0 back now' && got.tallies.out === '6|6 out' && got.tallies.idle === '0|0 idle' && got.tallies.locked === '2|2 locked' && !got.more && got.labels.every((l) => /Sub O\d, Out, route Deep-sea Site: A → B; back in .* · .*Press Enter/.test(l)) && real(errors).length === 0;
      record('C103', 'Board timeline (W32): a seeded fleet with known returns: each Out lane\'s marker stands at (return minus now) over the span within 0.01, the axis shows the span the rule gives (48 hours for a longest return of 30) and five ticks (now, +12 h, +24 h, +36 h, +48 h), the tallies equal the counts (6 out, 0 idle, 2 locked), "N back now" and "Next back: ..." read as before, and each lane is a labelled group that says the submarine, its state, route and return', ok, { got, off: off.map((x) => +x.toFixed(4)), errors: real(errors) });
      server.close();
    });
    await guard('C104', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage(); const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await tlSeed(page, FCS('fa', 'Alpha Company', 0, 4) + OUT('o1', 'fa', 1, 'Sub O1', '5 * H') + OUT('o2', 'fa', 2, 'Sub O2', '5 * H + 4 * M') + OUT('o3', 'fa', 3, 'Sub O3', '5 * H + 8 * M') + OUT('o4', 'fa', 4, 'Sub O4', '120 * H'));
      await page.reload(); await ready(); await page.waitForSelector('.tl.over');
      const got = await page.evaluate(() => { const ax = document.querySelector('.tl-axis'), over = document.querySelector('.tl.over'); return { span: ax.dataset.span, marks: [...ax.querySelectorAll('.tl-mark')].map((m) => m.dataset.n), over: document.querySelectorAll('.tl.over').length, overMarker: getComputedStyle(over.querySelector('.tl-end'), '::after').content, overIsOut: over.classList.contains('out'), more: (document.querySelector('.strip-more') || {}).textContent, sideways: document.documentElement.scrollWidth - innerWidth, when: over.closest('.sub').querySelector('.when').textContent }; });
      await ctx.close();
      const ok = got.span === '96' && JSON.stringify(got.marks) === '["3"]' && got.over === 1 && !got.overIsOut && /»/.test(got.overMarker) && got.more === 'and 2 more within 10 minutes' && got.sideways <= 0 && /5 d/.test(got.when) && real(errors).length === 0;
      record('C104', 'Board timeline (W32): a return 120 hours away runs off the end of the 96 hour axis (a tl.over lane with chevrons and no marker; the countdown still says when) with no sideways scroll; three returns within ten minutes are one axis mark with data-n="3" and the strip says "and 2 more within 10 minutes"', ok, { got, errors: real(errors) });
      server.close();
    });
    await guard('C105', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage(); const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      const idleSub = (id, fc, slot, name) => "sec.subs['" + id + "'] = { fcId: '" + fc + "', slot: " + slot + ", name: '" + name + "', rank: 60, parts: [3, 4, 1, 2], voyage: null };";
      const backSub = (id, fc, slot, name, agoMin) => "sec.subs['" + id + "'] = { fcId: '" + fc + "', slot: " + slot + ", name: '" + name + "', rank: 60, parts: [3, 4, 1, 2], voyage: { sentAt: now - 5 * H, route: [1, 2], returnAt: now - " + agoMin + " * M, gameSaid: '1h' } };";
      await tlSeed(page, FCS('fa', 'Alpha Company', 0, 4) + FCS('fb', 'Bravo Company', 1, 4) + OUT('o1', 'fa', 1, 'Sub O1', '9 * H') + OUT('o2', 'fa', 2, 'Sub O2', '3 * H') + backSub('b1', 'fa', 3, 'Sub B1', 30) + idleSub('i1', 'fa', 4, 'Sub I1') + OUT('o3', 'fb', 1, 'Sub O3', '20 * H') + OUT('o4', 'fb', 2, 'Sub O4', '1 * H') + backSub('b2', 'fb', 3, 'Sub B2', 90) + idleSub('i2', 'fb', 4, 'Sub I2'));
      await page.reload(); await ready(); await page.click('[data-sort=time]'); await page.waitForSelector('.fc.wide .tl-axis');
      const a = await page.evaluate(() => { const subs = [...document.querySelectorAll('.fc.wide .fc-subs.list .sub[data-sub]')]; return { groups: document.querySelectorAll('.fc.wide').length, order: subs.map((x) => x.dataset.status), lefts: [...new Set(subs.map((x) => Math.round(x.getBoundingClientRect().left)))].length, fcName: subs[0].querySelector('.sub-fc').textContent, backFirst: subs.slice(0, 2).map((x) => x.dataset.sub), outs: [...document.querySelectorAll('.fc.wide .sub[data-status="out"] .tl')].map((tl) => { const q = tl.querySelector('.tl-end').getBoundingClientRect(), r = tl.getBoundingClientRect(); return (q.left + q.width / 2 - r.left) / r.width; }) }; });
      // nothing out: the strip says none out, no lane has a bar, the axis follows the longest suggestion (48 hours when there is none)
      await tlSeed(page, FCS('fa', 'Alpha Company', 0, 4) + FCS('fb', 'Bravo Company', 1, 4) + backSub('b1', 'fa', 1, 'Sub B1', 30) + idleSub('i1', 'fa', 2, 'Sub I1') + idleSub('i3', 'fa', 3, 'Sub I3') + idleSub('i2', 'fb', 1, 'Sub I2'));
      await page.reload(); await ready(); await page.waitForSelector('.sub[data-sub]');
      const n = await page.evaluate(() => { const ax = document.querySelector('.tl-axis'), span = +ax.dataset.span, gh = [...document.querySelectorAll('.tl.ghost')].map((t) => +t.style.getPropertyValue('--ret') * span); const longest = Math.max(0, ...gh); const prev = [12, 24, 48, 72, 96].filter((x) => x < span).pop() || 0; return { next: document.querySelector('.strip-next').textContent, outLanes: document.querySelectorAll('.tl.out, .tl.over').length, bars: document.querySelectorAll('.tl.out .tl-bar, .tl.over .tl-bar').length, span, ghosts: gh.length, longest: +longest.toFixed(2), holds: longest <= span + 0.01 && (gh.length === 0 ? span === 48 : span === 12 || longest > prev) }; });
      await ctx.close();
      const nonDec = a.outs.every((x, i) => i === 0 || x >= a.outs[i - 1] - 1e-9);
      const ok = a.groups === 1 && a.lefts === 1 && JSON.stringify(a.order) === '["back","back","out","out","out","out","idle","idle"]' && /Alpha Company|Bravo Company/.test(a.fcName) && a.backFirst.join() === 'b2,b1' && a.outs.length === 4 && nonDec && n.next === 'Next back: none out' && n.outLanes === 0 && n.bars === 0 && n.holds && real(errors).length === 0;
      record('C105', 'Board timeline (W32): by return time is one column in today\'s order (Back with the longest wait first, then Out by return time, then Idle) with the company name beside each submarine, and the markers of the Out lanes never step back; with nothing out the strip says "Next back: none out", no lane has a bar and the axis follows the longest suggestion (48 hours when there is none)', ok, { a, n, errors: real(errors) });
      server.close();
    });
    await guard('C106', async () => {
      const server = await start(PORT5);
      const phone = { viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
      const seedPhone = async (pg, ready) => { await pg.goto(ROOT5 + 'submersibles/'); await ready(); await tlSeed(pg, FCS('fa', 'Alpha Company', 0, 3) + "sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub One', rank: 50, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } }; sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub Two', rank: 40, parts: [3, 4, 1, 2], voyage: { sentAt: now - H, route: [1, 3], returnAt: now + 27 * H } }; sec.subs.a3 = { fcId: 'fa', slot: 3, name: 'Sub Three', rank: 30, parts: [3, 4, 1, 2] };"); await pg.reload(); await ready(); await pg.waitForSelector('.sub[data-sub]'); };
      const { ctx, errors } = await context(phone);
      const page = await ctx.newPage(); const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await seedPhone(page, ready);
      const m = await page.evaluate(() => ({ sideways: document.documentElement.scrollWidth - innerWidth, track: Math.round(Math.min(...[...document.querySelectorAll('.sub[data-sub] .tl')].map((t) => t.getBoundingClientRect().width))), lanes: Math.round(Math.min(...[...document.querySelectorAll('.sub[data-sub]')].map((t) => t.getBoundingClientRect().height))), quick: Math.round(Math.min(...[...document.querySelectorAll('.quick')].map((t) => t.getBoundingClientRect().height))), axisW: Math.round(document.querySelector('.tl-axis').getBoundingClientRect().width) }));
      // keyboard: Tab until a lane has focus, one more Tab reaches its action; both show an outline
      let lane = null, laneOutline = null;
      for (let i = 0; i < 60 && !lane; i++) { await page.keyboard.press('Tab'); lane = await page.evaluate(() => { const a = document.activeElement; return a && a.matches('.sub[data-sub]') ? a.dataset.sub : null; }); }
      if (lane) laneOutline = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return { w: parseFloat(c.outlineWidth), s: c.outlineStyle }; });
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement.matches('.lane-more'))) await page.keyboard.press('Tab'); // E6: a lane's Details button comes first on a phone; the lane's own action follows it
      const act = await page.evaluate((id) => { const a = document.activeElement, c = getComputedStyle(a); return { inLane: !!a.closest('.sub[data-sub="' + id + '"]'), quick: a.matches('.quick'), w: parseFloat(c.outlineWidth), s: c.outlineStyle }; }, lane);
      await ctx.close();
      // reduced motion: nothing inside a lane animates or transitions (the lane itself and its pseudo-elements included)
      const { ctx: c2, errors: e2 } = await context(Object.assign({ reducedMotion: 'reduce' }, phone));
      const p2 = await c2.newPage();
      await seedPhone(p2, () => p2.waitForSelector('html[data-ready="1"]', { timeout: 20000 }));
      const rm = await p2.evaluate(() => { const bad = []; document.querySelectorAll('.sub, .sub *').forEach((e) => ['', '::before', '::after'].forEach((ps) => { const c = getComputedStyle(e, ps); if ((c.animationName !== 'none' && c.animationDuration !== '0s') || (c.transitionDuration.split(',').some((d) => parseFloat(d) > 0))) bad.push(e.tagName + '.' + (e.className || '') + ps); })); return bad.slice(0, 5); });
      await c2.close();
      const ok = m.sideways <= 0 && m.track >= 280 && m.lanes >= 40 && m.quick >= 40 && m.axisW > 200 && !!lane && laneOutline.w >= 2 && laneOutline.s !== 'none' && act.inLane && act.quick && act.w >= 2 && act.s !== 'none' && rm.length === 0 && real(errors).length === 0 && real(e2).length === 0;
      record('C106', 'Board timeline on a phone (W32): at 360 px no sideways scroll, the track is at least 280 px wide, every lane and action is at least 40 px high; Tab goes from a lane to its own action; a focused lane and its action show an outline; with reduced motion nothing inside a lane animates or transitions', ok, { m, lane, laneOutline, act, rm, errors: real(errors) });
      server.close();
    });

    // ── C98 Submersibles drop rates (review fixes 3 and 4): two seeded submarines at the gil step. Sub Q1 (rank 85) has a community plan and, among
    //    the other routes of the send window, one route found by the app and one community route; Sub Q2 (rank 30) has an app-found plan and a
    //    community route among its other routes. Every other route says what it is, its figure and its reason (all worked out here with the
    //    advisor from the data). The Board and the Map each show one collapsed "How this is estimated" with the share of the second-item assumption.
    await guard('C98', async () => {
      const server29 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      for (const f of ['recs.js', 'drops.js', 'advisor.js']) require(path.join(CC, 'src', 'submersibles', f));
      const NA = globalThis.ADVISOR.init(data), DR = globalThis.DROPS, RC = globalThis.RECS, all = data.sectors.map((x) => x.id);
      const SUBS = { q1: { rank: 85, parts: [27, 28, 25, 26] }, q2: { rank: 30, parts: [3, 4, 1, 2] } };
      const want = {};
      for (const id of Object.keys(SUBS)) {
        const a = NA.advise({ sub: SUBS[id], fc: { unlockedSlots: 4, discovered: all }, slotsFilled: 2, recs: Object.assign(RC.defaults(), { fuel: false, giveUp: 10, order: ['gil', 'unlock', 'level', 'loot'] }) });
        want[id] = { plan: a.plan.kind, share: a.plan.est.secondShare, alts: a.alts.map((x) => ({ kind: x.kind === 'community' ? 'Community route' : 'Found by the app', fig: DR.fmt.about(DR.fmt.hour(x.est.perHour)) + ' gil an hour (estimate)', why: x.why })) };
      }
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async ([allIds, subs]) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fq = { name: 'Quebec Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: allIds };
        Object.keys(subs).forEach((id, i) => { sec.subs[id] = { fcId: 'fq', slot: i + 1, name: 'Sub ' + id.toUpperCase(), rank: subs[id].rank, parts: subs[id].parts }; });
        let r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { fuel: false, giveUp: 10, order: ['gil', 'unlock', 'level', 'loot'] } }, { rev: r.rev, base: null });
      }, [all, SUBS]);
      await page.reload(); await ready();
      await page.click('[data-tab=board]'); await page.waitForSelector('.quick[data-quick="q1"]');
      const board = await page.evaluate(() => ({ notes: [...document.querySelectorAll('#view details.rates')].filter((d) => d.querySelector('summary').textContent === 'How this is estimated').map((d) => ({ open: d.open, text: d.textContent })) }));
      const got = {};
      for (const id of Object.keys(SUBS)) {
        await page.click('.sub[data-sub="' + id + '"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
        got[id] = await page.evaluate(() => ({ title: document.querySelector('#sheet .advice-route + .hint').textContent,
          alts: [...document.querySelectorAll('#sheet .alts li')].map((li) => ({ kind: (li.querySelector('[data-alt-kind]') || {}).textContent, fig: (li.querySelector('[data-alt-figure]') || {}).textContent, why: (li.querySelector('[data-alt-why]') || {}).textContent })) }));
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 }).catch(() => {});
      }
      await page.click('[data-tab=map]'); await page.waitForSelector('.chart-svg');
      await page.click('.chart-svg [data-sector="15"]'); await page.waitForSelector('.chart-details .rates');
      const map = await page.evaluate(() => ({ n: [...document.querySelectorAll('#view details.rates')].filter((d) => d.querySelector('summary').textContent === 'How this is estimated').length, open: [...document.querySelectorAll('#view details.rates')].some((d) => d.open) }));
      await ctx.close();
      const pcts = Object.keys(SUBS).map((id) => Math.round(want[id].share * 100)), lo = Math.min(...pcts), hi = Math.max(...pcts);
      const shareWant = lo === hi ? 'About ' + lo + '% of each gil figure shown here rests on that assumption.' : 'Between ' + lo + '% and ' + hi + '% of the gil figures shown here rest on that assumption.';
      const kinds = (id) => want[id].alts.map((x) => x.kind).join();
      const ok = want.q1.plan === 'community' && kinds('q1') === 'Found by the app,Community route' && want.q2.plan === 'derived' && want.q2.alts.some((x) => x.kind === 'Community route') &&
        JSON.stringify(got.q1.alts) === JSON.stringify(want.q1.alts) && JSON.stringify(got.q2.alts) === JSON.stringify(want.q2.alts) &&
        got.q1.alts[0].why.startsWith('Found by the app in ') && got.q1.alts[0].why.includes('Community routes come first unless an app-found route is at least twice as good.') && got.q1.alts[1].why.startsWith('Community gil route ') &&
        got.q2.title.startsWith('Found by the app from community drop records in ') && got.q2.alts.every((x) => x.kind && x.fig && x.why) &&
        board.notes.length === 1 && !board.notes[0].open && board.notes[0].text.includes('What the second item is, is not in the records') && board.notes[0].text.includes(shareWant) && map.n === 1 && !map.open && real(errors).length === 0;
      record('C98', 'Other routes and the uncertainty note (review fixes 3 and 4): in the send window of a rank-85 submarine with a community plan the other routes are one found by the app and one community route, each with what it is, its figure and its reason (as the advisor works them out from the data); a rank-30 submarine\'s app-found plan has a community route among its other routes; the Board and the Map each show exactly one collapsed "How this is estimated", the Board\'s with the share of the plans\' gil figures that rests on the second-item assumption',
        ok, { want, got, board, shareWant, map, errors: real(errors) });
      server29.close();
    });

    // ── C99 Submersibles first Board draw: 8 free companies x 4 rank-145 submarines, everything found, Gil first. The search for app-found routes
    //    is shared between submarines of one build, so the first Board renders within a generous bound (3 seconds; about 5 seconds before). ──
    await guard('C99', async () => {
      const server30 = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1920, height: 1080 } });
      const page = await ctx.newPage();
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 60000 });
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      const allIds = data.sectors.map((x) => x.id);
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async (ids) => {
        const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        ['Alpha', 'Bravo', 'Cedar', 'Delta', 'Ember', 'Fable', 'Garnet', 'Harbor'].forEach((n, i) => {
          sec.fcs['f' + i] = { name: n + ' Company', world: 'Maduin', order: i, unlockedSlots: 4, discovered: ids };
          for (let s = 1; s <= 4; s++) sec.subs['s' + i + s] = { fcId: 'f' + i, slot: s, name: 'Sub ' + n[0] + s, rank: 145, parts: [31, 24, 25, 34] };
        });
        let r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { fuel: false, giveUp: 10, order: ['gil', 'unlock', 'level', 'loot'] } }, { rev: r.rev, base: null });
      }, allIds);
      const t0 = Date.now();
      await page.reload(); await ready(); await page.waitForSelector('.fc .sub[data-status]');
      const ms = Date.now() - t0, subs = await page.locator('.fc .sub[data-status]').count();
      await ctx.close();
      record('C99', 'First Board draw (review fix 1): 8 free companies x 4 submarines at rank 145 with every sector found and Gil first render all 32 submarines within 3 seconds of loading the page (' + ms + ' ms here)',
        subs === 32 && ms < 3000 && real(errors).length === 0, { ms, subs, errors: real(errors) });
      server30.close();
    });

    // ── C100 Submersibles design gaps, Part A (docs/submersibles-design-gaps-spec.md): in the planner at desktop and at 360 px, G1 (a collapsed list of what the chosen
    //    route usually brings, equal to the send window's), G2 (a sector that cannot be added says why: the chart's cannot ring and cross, the words when tapped or
    //    focused, the accessible name; the numbers equal the planner's own evaluation) and G3 (a small source label on each figure); and G4 on an advice with other routes. ──
    await guard('C100', async () => {
      const server31 = await start(PORT5);
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      for (const f of ['recs.js', 'drops.js', 'advisor.js']) require(path.join(CC, 'src', 'submersibles', f));
      const NA = globalThis.ADVISOR.init(data), RC = globalThis.RECS, all = data.sectors.map((x) => x.id);
      const Q1 = { rank: 85, parts: [27, 28, 25, 26] };
      const wantAdvice = NA.advise({ sub: Q1, fc: { unlockedSlots: 4, discovered: all }, slotsFilled: 2, recs: Object.assign(RC.defaults(), { fuel: false, giveUp: 10, order: ['gil', 'unlock', 'level', 'loot'] }) });
      const FOUND = [1, 2, 3, 4, 5, 6, 7, 10, 15, 18, 26];
      const seen = {};
      for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 }], ['phone', { viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
        const { ctx, errors } = await context(opts);
        const page = await ctx.newPage();
        const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
        await page.goto(ROOT5 + 'submersibles/'); await ready();
        await page.evaluate(async ([allIds, found, q1]) => {
          const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
          sec.fcs.fp = { name: 'Papa Company', world: 'Gilgamesh', unlockedSlots: 2, order: 0, discovered: found };
          sec.subs.p1 = { fcId: 'fp', slot: 1, name: 'Sub P1', rank: 30, parts: [3, 4, 1, 2] };
          sec.fcs.fq = { name: 'Quebec Company', world: 'Gilgamesh', unlockedSlots: 4, order: 1, discovered: allIds };
          sec.subs.q1 = { fcId: 'fq', slot: 1, name: 'Sub Q1', rank: q1.rank, parts: q1.parts };
          let r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
          r = await CC.read(); await CC.writeSection('submersibles-recommendations', { choices: { fuel: false, giveUp: 10, order: ['gil', 'unlock', 'level', 'loot'] } }, { rev: r.rev, base: null });
        }, [all, FOUND, Q1]);
        await page.reload(); await ready();
        const out = {};
        await page.click('[data-tab=map]'); await page.waitForSelector('.chart-svg');
        await page.selectOption('#map-sub', 'p1');
        out.noRoute = await page.$eval('.planner', (el) => ({ rates: !!el.querySelector('[data-planner-rates]'), line: !!el.querySelector('[data-cannot-line]') }));
        const tap = (id) => page.click('.chart-svg [data-sector="' + id + '"]');
        await tap(10);
        // the planner's own evaluation, worked out independently of cannotAdd
        out.want = await page.evaluate(() => { const st = ADVISOR.stats(30, [3, 4, 1, 2]); return { rangeNeed: ADVISOR.evalRoute([10, 1], st).range - st.range, ranges: [1, 7, 18].map((id) => ADVISOR.evalRoute([10, id], st).range - st.range), addable: [2, 3, 4, 5, 6, 15].filter((id) => ADVISOR.evalRoute([10, id], st).reachable) }; });
        // G1: collapsed by default, opens to the send window's content
        out.g1 = await page.$eval('.planner', (el) => { const d = el.querySelector('[data-planner-rates]'); return d ? { open: d.open, summary: d.querySelector('summary').textContent, rates: !!d.querySelector('[data-rates]'), text: d.querySelector('[data-rates]') ? d.querySelector('[data-rates]').textContent : '' } : null; });
        await page.click('[data-planner-rates] > summary');
        out.g1open = await page.$eval('[data-planner-rates]', (d) => d.open);
        out.headings = await page.$$eval('.planner', (els) => els[0].textContent.split('What this route usually brings').length - 1); // once (correction 2)
        // G3 in the planner
        out.g3 = await page.$$eval('.planner .calc-line .tag.src', (els) => els.map((e) => e.textContent));
        out.g3rate = await page.$$eval('.planner [data-rates] [data-src] .tag.src', (els) => els.map((e) => e.textContent));
        out.confirm = await page.$$eval('.planner .hint .tag:not(.src)', (els) => els.map((e) => e.textContent));
        // G2 on the chart: marks, structure and names
        out.chart = await page.evaluate(() => {
          const svg = document.querySelector('.chart-svg'), nodes = [...svg.querySelectorAll('.chart-node')], cannot = nodes.filter((n) => n.classList.contains('cannot'));
          const lab = (id) => svg.querySelector('[data-sector="' + id + '"]').getAttribute('aria-label');
          return { nodes: nodes.length, cannot: cannot.length, marked: cannot.every((n) => n.querySelector('.chart-cannot-ring') && n.querySelector('.chart-cannot-x')), plainHasNone: nodes.filter((n) => !n.classList.contains('cannot')).every((n) => !n.querySelector('.chart-cannot-ring, .chart-cannot-x')),
            polylines: svg.querySelectorAll('polyline').length, nested: nodes.filter((n) => n.querySelector('g')).length, tabindex: svg.querySelectorAll('[tabindex]').length, hidden: [...svg.querySelectorAll('.chart-cannot-ring, .chart-cannot-x')].every((e) => e.getAttribute('aria-hidden') === 'true'),
            letterAttrs: [...svg.querySelectorAll('.chart-letter')].every((t) => ['class,y,text-anchor,font-size', 'class,y,text-anchor,font-size,x'].includes(t.getAttributeNames().join(','))),
            l1: lab(1), l8: lab(8), l26: lab(26), l2: lab(2), l10: lab(10), noCross10: !svg.querySelector('[data-sector="10"]').classList.contains('cannot') };
        });
        // a sector that can be added stays as it is
        out.addable = await page.evaluate((ids) => ids.map((id) => document.querySelector('.chart-svg [data-sector="' + id + '"]').classList.contains('cannot')), out.want.addable);
        // tapping a sector that cannot be added says why in words and leaves the route as it was
        await tap(8);
        out.t8 = await page.evaluate(() => ({ route: document.querySelector('.planner .route-line').textContent, line: document.querySelector('[data-cannot-line]').textContent, why: (document.querySelector('.chart-details [data-cannot-why]') || {}).textContent || '' }));
        await tap(26);
        out.t26 = await page.evaluate(() => ({ line: document.querySelector('[data-cannot-line]').textContent, why: (document.querySelector('.chart-details [data-cannot-why]') || {}).textContent || '' }));
        await page.focus('.chart-svg [data-sector="1"]');
        out.f1 = await page.$eval('[data-cannot-line]', (el) => el.textContent);
        await tap(2);
        out.after2 = await page.$eval('.planner .route-line', (el) => el.textContent);
        out.rates2 = await page.$eval('[data-planner-rates]', (d) => d.open); // still open after the redraw
        out.side = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        // Visual fixes part 1: S1 community routes, S2 chart labels, S3 sector states, S5 lines in the planner
        out.v1 = await page.evaluate(() => {
          const probe = document.createElement('i'); probe.style.color = 'var(--ink-2)'; document.querySelector('.planner').append(probe); const ink2 = getComputedStyle(probe).color; probe.remove();
          const btns = [...document.querySelectorAll('.planner .cr-list .btn')], dis = btns.map((b) => b.disabled), firstBlocked = dis.indexOf(true), lastUsable = dis.lastIndexOf(false);
          const blocked = btns.filter((b) => b.disabled).map((b) => { const c = getComputedStyle(b), why = b.querySelector('.cr-why'), wr = why && why.getBoundingClientRect(), nr = b.querySelector('.cr-name').getBoundingClientRect(); return { color: c.color === ink2, whyColor: !!why && getComputedStyle(why).color === ink2, opacity: c.opacity, band: /gradient/.test(c.backgroundImage), whyText: why ? why.textContent : '', below: !!wr && wr.top >= nr.bottom - 1 && wr.height > 8, desc: b.getAttribute('aria-describedby') === (why && why.id), title: b.title === (why && why.textContent) }; });
          const svg = document.querySelector('.chart-svg'), ctm = svg.getScreenCTM(), pl = svg.querySelector('polyline'), L = pl ? pl.getTotalLength() : 0, samples = [];
          for (let i = 0; i <= 120; i++) { const p = pl.getPointAtLength(L * i / 120), q = new DOMPoint(p.x, p.y).matrixTransform(pl.getScreenCTM()); samples.push([q.x, q.y]); }
          const bb = (e) => { const r = e.getBoundingClientRect(); return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; }, hit = (a, c) => a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1;
          const labels = [...svg.querySelectorAll('.chart-letter, .chart-tag')], hard = [...svg.querySelectorAll('.chart-plus, .chart-cannot-x')], locks = [...svg.querySelectorAll('.chart-lock')];
          const online = labels.filter((t) => { const r = bb(t); return samples.some((s) => s[0] > r.x0 + 1 && s[0] < r.x1 - 1 && s[1] > r.y0 + 2 && s[1] < r.y1 - 2); }).length;
          const onMark = labels.filter((t) => hard.some((h) => hit(bb(t), bb(h)))).length;
          const rings = [...svg.querySelectorAll('.chart-routering, .chart-ring2, .chart-cannot-ring')], onRing = labels.filter((t) => rings.some((rg) => { const c = rg.getBoundingClientRect(), cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2, rad = c.width / 2, r = bb(t); const nx = Math.max(r.x0, Math.min(cx, r.x1)), ny = Math.max(r.y0, Math.min(cy, r.y1)); return Math.hypot(nx - cx, ny - cy) < rad - 1 && Math.hypot(Math.max(Math.abs(r.x0 - cx), Math.abs(r.x1 - cx)), Math.max(Math.abs(r.y0 - cy), Math.abs(r.y1 - cy))) > rad + 1; })).length;
          const onLock = labels.filter((t) => locks.some((k) => { const kb = bb(k), tb = bb(t), tx = (tb.x0 + tb.x1) / 2; const mine = k.parentNode.contains(t); return !mine && hit(tb, kb); })).length;
          const nodes = [...svg.querySelectorAll('.chart-node')], over = nodes.filter((n) => n.classList.contains('over-rank')), far = nodes.filter((n) => n.classList.contains('far') && !n.classList.contains('over-rank'));
          const shapeOf = (n) => [...n.children].filter((e) => /^(circle|rect)$/i.test(e.tagName) && !e.classList.contains('hit') && !/chart-/.test(e.getAttribute('class') || '')).pop();
          const crosses = [...svg.querySelectorAll('.chart-cannot-x')].map((x) => { const r = x.getBoundingClientRect(), n = bb(shapeOf(x.parentNode)); return { w: r.width, outside: !hit({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }, n), upper: r.left >= n.x1 - 1 && r.bottom <= n.y0 + 1 }; });
          const key = [...document.querySelectorAll('.chart-key .key')].map((k) => k.className.replace('key ', ''));
          const cs = (n) => getComputedStyle(shapeOf(n));
          return { ink2: !!ink2, n: btns.length, usableFirst: firstBlocked < 0 || lastUsable < firstBlocked, nBlocked: blocked.length, blocked, online, onMark, onRing, onLock, nLabels: labels.length,
            halo: [...svg.querySelectorAll('text')].every((t) => /stroke/.test(getComputedStyle(t).paintOrder) && getComputedStyle(t).strokeWidth === '4px'), planned: !!pl,
            over: over.length, overDashed: over.every((n) => shapeOf(n).getAttribute('stroke-dasharray') === '4 3' && cs(n).fill === 'none' && cs(n).stroke !== 'none'), farSolid: far.length > 0 && far.every((n) => cs(n).fill !== 'none' && cs(n).fill !== 'rgba(0, 0, 0, 0)' && !shapeOf(n).getAttribute('stroke-dasharray')),
            crosses, key, noOverring: !svg.querySelector('.chart-overring') };
        });
        out.v1.lines = badEnds(await renderedLines(page, '.planner .calc-line, .planner .hint.units'));
        out.v1.ok = out.v1.n >= 2 && out.v1.nBlocked >= 1 && out.v1.usableFirst && out.v1.blocked.every((b) => b.color && b.whyColor && b.opacity === '1' && b.band && b.whyText.length > 8 && b.below && b.desc && b.title) &&
          out.v1.planned && out.v1.nLabels > 10 && out.v1.online === 0 && out.v1.onMark === 0 && out.v1.onRing === 0 && out.v1.onLock === 0 && out.v1.halo && out.v1.over > 0 && out.v1.overDashed && out.v1.farSolid && out.v1.noOverring &&
          out.v1.crosses.length > 0 && out.v1.crosses.every((c) => c.outside && c.upper && c.w >= 11) && ['found', 'next', 'far', 'above', 'cross'].every((k) => out.v1.key.includes(k)) && out.v1.lines.length === 0;
        if (SHOT) await (await page.$('.map-panel')).screenshot({ path: path.join(ev, 'submersibles-gaps-planner-' + label + '.png') });
        // the same content in the send window
        await page.click('[data-map-send="p1"]'); await page.waitForSelector('#sheet [data-rates]');
        out.sheet = await page.evaluate(() => ({ rates: document.querySelector('#sheet [data-rates]').textContent, plannerRates: null, tags: [...document.querySelectorAll('#sheet .calc-line .tag.src, #sheet .advice .hint .tag.src')].map((e) => e.textContent), rateTag: [...document.querySelectorAll('#sheet [data-rates] [data-src] .tag.src')].map((e) => e.textContent), side: document.documentElement.scrollWidth - window.innerWidth, sheetSide: document.querySelector('#sheet').scrollWidth - document.querySelector('#sheet').clientWidth }));
        // Visual fixes part 1: B1 disabled tiles, S6 one filled primary, S5 lines, S11 scrim
        out.v1s = await page.evaluate(() => {
          const pr = (v) => { const i = document.createElement('i'); i.style.color = v; document.querySelector('#sheet').append(i); const c = getComputedStyle(i).color; i.remove(); return c; };
          const ink2 = pr('var(--ink-2)'), seal = pr('var(--seal)'), ink = pr('var(--ink)'), dis = [...document.querySelectorAll('#sheet .sector:disabled')];
          const b1 = dis.map((t) => { const c = getComputedStyle(t), nm = getComputedStyle(t.querySelector('span')), rk = getComputedStyle(t.querySelector('small')), why = t.querySelector('.why'); return { opacity: c.opacity, colour: c.color === ink2, name: nm.color === ink2 && nm.opacity === '1', rank: rk.color === ink2, size: c.backgroundSize.split(',')[0].trim(), why: why ? why.textContent : '', whyShown: !!why && why.getBoundingClientRect().height > 8, letterDim: parseFloat(getComputedStyle(t.querySelector('b')).opacity) < 1, tip: t.title.length > 0 }; });
          const q = document.querySelector('#sheet .advice-route [data-act="quick"]'), qc = q && getComputedStyle(q), filled = [...document.querySelectorAll('#sheet .btn')].filter((b) => /gradient|rgb/.test(getComputedStyle(b).backgroundImage + getComputedStyle(b).backgroundColor) && getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)' && b.getBoundingClientRect().height > 0);
          const s6 = { outline: !!q && q.classList.contains('outline') && !q.classList.contains('primary'), fill: qc && qc.backgroundColor === 'rgba(0, 0, 0, 0)' && qc.backgroundImage === 'none', edge: qc && qc.borderTopColor === seal && qc.borderTopWidth === '2px', text: qc && qc.color === ink, primaries: [...document.querySelectorAll('#sheet .btn.primary')].filter((b) => b.getBoundingClientRect().height > 0).length };
          const bd = getComputedStyle(document.querySelector('#sheet'), '::backdrop').backgroundColor, m = /rgba?\(([^)]+)\)/.exec(bd), al = m ? (m[1].split(',')[3] === undefined ? 1 : parseFloat(m[1].split(',')[3])) : 0;
          const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }, rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
          const tb = rgb(pr('var(--out)')), pg = rgb(pr('var(--paper)')), /* a tally (the Out field) against the page, as on the Board behind the window */ cr = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          const dim = (c) => c.map((x) => x * (1 - al)), before = cr(tb, pg), after = cr(dim(tb), dim(pg));
          const top = document.elementFromPoint(6, 6);
          return { b1, s6, scrim: { alpha: al, before, after, covers: !!top && (top.id === 'sheet' || top.closest('#sheet') !== null) } };
        });
        out.v1s.lines = badEnds(await renderedLines(page, '#sheet .calc-line, #sheet .advice .hint.units, #sheet .alts li'));
        out.v1s.ok = out.v1s.b1.length >= 1 && out.v1s.b1.every((t) => t.opacity === '1' && t.colour && t.name && t.rank && t.size === '14px 100%' && t.why.length > 5 && t.whyShown && t.letterDim && t.tip) &&
          out.v1s.s6.outline && out.v1s.s6.fill && out.v1s.s6.edge && out.v1s.s6.text && out.v1s.s6.primaries === 1 &&
          Math.abs(out.v1s.scrim.alpha - 0.6) < 0.01 && (out.v1s.scrim.after - 1) <= (out.v1s.scrim.before - 1) / 2 && out.v1s.scrim.covers && out.v1s.lines.length === 0;
        if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-gaps-sheet-route-' + label + '.png') });
        await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 }).catch(() => {});
        out.plannerRatesText = await page.$eval('[data-planner-rates] [data-rates]', (el) => el.textContent).catch(() => null);
        // G4 (and G3 in the advice block): the send window of a submarine whose advice has other routes
        await page.click('[data-tab=board]'); await page.waitForSelector('.sub[data-sub="q1"]');
        await page.click('.sub[data-sub="q1"] .sub-top'); await page.waitForSelector('#sheet .advice-route');
        out.g4 = await page.evaluate(() => ({ alts: [...document.querySelectorAll('#sheet .alts li')].map((li) => ({ vs: (li.querySelector('[data-alt-vs]') || {}).textContent || '', fig: (li.querySelector('[data-alt-figure]') || {}).textContent || '', tag: (li.querySelector('[data-alt-figure] + .tag.src') || {}).textContent || '' })),
          src: (document.querySelector('#sheet .advice [data-src]') || {}).textContent || '', figTags: [...document.querySelectorAll('#sheet .advice .hint .tag.src')].map((e) => e.textContent), clock: null, side: document.documentElement.scrollWidth - window.innerWidth, sheetSide: document.querySelector('#sheet').scrollWidth - document.querySelector('#sheet').clientWidth }));
        if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-gaps-sheet-advice-' + label + '.png') });
        out.errors = real(errors);
        seen[label] = out;
        await ctx.close();
      }
      const wantAlts = wantAdvice.alts.map((x) => x.vs.text);
      const good = (o) => {
        const c = o.chart, w = o.want;
        return o.noRoute.rates === false && o.noRoute.line === true &&
          o.g1 && o.g1.open === false && o.g1.summary === 'What this route usually brings' && o.g1.rates && o.g1.text.includes('an estimate from community drop records') && o.g1open === true && o.rates2 === true &&
          o.plannerRatesText === o.sheet.rates.replace('What this route usually brings', '') && o.plannerRatesText.length > 100 && o.headings === 1 &&
          JSON.stringify(o.g3) === JSON.stringify(['calculated', 'calculated', 'game data', 'game data']) && o.g3rate.join() === 'community estimate' && o.confirm.length === 1 && /^calculated, not yet confirmed/.test(o.confirm[0]) &&
          c.cannot > 0 && c.cannot < c.nodes && c.marked && c.plainHasNone && c.polylines === 1 && c.nested === 0 && c.tabindex === c.nodes && c.hidden && c.letterAttrs &&
          c.l1.endsWith('out of range if added: Needs range ' + w.rangeNeed + ' more') && w.rangeNeed > 0 && w.ranges.every((n) => n > 0) && c.l8.endsWith('cannot be added: Not found yet') && c.l26.endsWith('cannot be added: Rank 50 needed (this submarine is rank 30)') &&
          !/cannot/.test(c.l2) && !/cannot/.test(c.l10) && c.noCross10 &&
          !/→/.test(o.t8.route) && /: J\b/.test(o.t8.route) && o.t8.line.endsWith(' cannot be added: Not found yet') && o.t8.why === 'Cannot be added to the planned route: Not found yet' && o.t26.why === 'Cannot be added to the planned route: Rank 50 needed (this submarine is rank 30)' && /cannot be added: Rank 50 needed/.test(o.t26.line) &&
          o.f1.endsWith(' out of range if added: Needs range ' + w.rangeNeed + ' more') && (o.after2.match(/→/g) || []).length === 1 && o.addable.length > 0 && o.addable.every((x) => x === false) &&
          o.v1.ok && o.v1s.ok && o.side <= 0 && o.sheet.side <= 0 && o.sheet.sheetSide <= 0 && o.sheet.tags.length >= 4 && o.sheet.rateTag.join() === 'community estimate' &&
          o.g4.alts.length === wantAlts.length && wantAlts.length > 0 && o.g4.alts.every((a, i) => a.vs.startsWith(wantAlts[i] + ' (') && a.vs.endsWith(')') && a.tag === 'community estimate' && a.fig) && o.g4.src.startsWith('Gil an hour: about ') && o.g4.src.includes('community estimate') &&
          o.g4.figTags.join() === 'calculated,calculated,game data,game data' && o.g4.side <= 0 && o.g4.sheetSide <= 0 && o.errors.length === 0;
      };
      record('C100', 'Design gaps A (G1 to G4), desktop and 360 px: the planner lists what the chosen route usually brings (collapsed by default, headed once, the same text as the send window, kept open across redraws); a found sector above the submarine\'s rank shows a ring and a cross on the chart (a sector not found yet or out of range shows none), and every sector the submarine cannot add says why in its name, in the line under the route and in its details (rank needed, not found yet, or, for a sector that would take the route out of range, the range needed as the planner\'s own evaluation gives it); a sector it can add stays plain; every figure carries a source label (calculated, game data, community estimate); each other route says how it differs from the plan; no sideways scroll',
        good(seen.desktop) && good(seen.phone), { desktop: seen.desktop, phone: seen.phone, wantAlts });
      server31.close();
    });

    // ── C101 Submersibles design gaps, Part B (docs/submersibles-design-gaps-spec.md): G7 (one sheet that sends every shown free company's returned subs, each with its own tick, logged exactly as
    //    the per-company sheet logs them), G8 (hide a free company: Board, next-back strip and fleet-wide send follow; a reload keeps it; nothing is deleted), G9 (the rank-up plan, "at least"),
    //    G10 (earnings by submarine) and G11 (discoveries are asked for: a list in Setup, and a question after a voyage that offers only the sectors that voyage could have revealed). ──
    await guard('C101', async () => {
      const server32 = await start(PORT5);
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      const kids = (ids) => data.sectors.map((x) => x.id).filter((id) => ids.includes((data.unlocks[id] || {}).by));
      const seaName = (id) => data.seas.find((x) => x.id === id).name;
      const ready = (page) => page.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
      const wroteOut = (page) => page.waitForFunction(() => window.__subs && window.__subs.state().ready && !document.querySelector('#sheet[open]'), null, { timeout: 10000 }).then(() => page.waitForTimeout(600));
      const saved = (page) => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules; });
      const parts = [3, 4, 1, 2];
      // profile 1 (G7 to G10): Alpha and Bravo; three returned subs (a1, a2, b1); a3 and b2 out; a4 out at the top rank; two companies' worth of logged voyages for Earnings
      const seed1 = (page) => page.evaluate(async (parts) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fa = { name: 'Alpha Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: [1, 2, 3] };
        sec.fcs.fb = { name: 'Bravo Company', world: 'Gilgamesh', unlockedSlots: 2, order: 1, discovered: [1, 2, 3] };
        const back = (r) => ({ sentAt: now - 30 * H, route: r, returnAt: now - H });
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts, voyage: back([1, 2]) };
        sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub A2', rank: 40, parts, voyage: back([1, 3]) };
        sec.subs.a3 = { fcId: 'fa', slot: 3, name: 'Sub A3', rank: 30, parts, voyage: { sentAt: now - H, route: [1, 2], returnAt: now + 5 * H } };
        sec.subs.a4 = { fcId: 'fa', slot: 4, name: 'Sub A4', rank: 145, parts: [31, 24, 25, 34], voyage: { sentAt: now - H, route: [1, 2], returnAt: now + 9 * H } };
        sec.subs.b1 = { fcId: 'fb', slot: 1, name: 'Sub B1', rank: 35, parts, voyage: back([1, 2]) };
        sec.subs.b2 = { fcId: 'fb', slot: 2, name: 'Sub B2', rank: 20, parts, voyage: { sentAt: now - H, route: [1], returnAt: now + 1 * H } };
        [['a1', 3], ['a1', 5], ['a2', 2], ['b1', 4]].forEach(([s, q], i) => { sec.trips['t' + i] = { s, t: now - (100 + i * 30) * H, r: [1, 2], back: now - (100 + i * 30 - 29) * H, items: [[10099, q]], newSectors: [] }; });
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, parts);
      const out = {};
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'submersibles/'); await ready(page);
      await seed1(page); await page.reload(); await ready(page);
      const before = await saved(page);

      // ---- G7: the fleet-wide send sheet
      await page.click('[data-act=sendallfleet]'); await page.waitForSelector('#sheet .pick-fc');
      out.g7 = await page.evaluate(() => ({ groups: [...document.querySelectorAll('#sheet .pick-fc')].map((h) => h.textContent), rows: [...document.querySelectorAll('#sheet input[name=pick]')].map((x) => [x.value, x.checked]), perGroup: [...document.querySelectorAll('#sheet .pick')].map((d) => d.querySelectorAll('input[name=pick]').length), side: document.documentElement.scrollWidth - window.innerWidth }));
      if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-gaps-sendall-fleet-desktop.png') });
      await page.uncheck('#sheet input[name=pick][value=b1]');
      await page.click('#sheet [data-act=dosendall]'); await wroteOut(page);
      const g7 = await saved(page); const sub7 = g7.submersibles;
      const tripOf = (sec, id) => Object.values(sec.trips).filter((t) => t.s === id && t.t > Date.now() - 40 * 3600000);
      out.g7after = { a1: tripOf(sub7, 'a1').length, a2: tripOf(sub7, 'a2').length, b1: tripOf(sub7, 'b1').length, a1v: !!(sub7.subs.a1.voyage && sub7.subs.a1.voyage.returnAt > Date.now()), a2v: !!(sub7.subs.a2.voyage && sub7.subs.a2.voyage.returnAt > Date.now()),
        b1same: JSON.stringify(sub7.subs.b1.voyage) === JSON.stringify(before.submersibles.subs.b1.voyage), b1rank: sub7.subs.b1.rank, a1rank: sub7.subs.a1.rank, trips: Object.keys(sub7.trips).length };
      // the per-company sheet logs the third one the same way (same code path): the two trips have the same fields
      await page.click('.fc[data-fc="fb"] [data-act=sendall]'); await page.waitForSelector('#sheet input[name=pick]');
      await page.click('#sheet [data-act=dosendall]'); await wroteOut(page);
      const g7b = (await saved(page)).submersibles;
      const keys = (t) => Object.keys(t).sort().join();
      out.g7same = { a1: keys(tripOf(g7b, 'a1')[0] || {}), b1: keys(tripOf(g7b, 'b1')[0] || {}) };

      // ---- G8: hide a free company
      await seed1(page); await page.reload(); await ready(page);
      const base8 = await saved(page);
      out.g8all = await page.evaluate(() => ({ fcs: document.querySelectorAll('.fc').length, next: document.querySelector('.strip-next').textContent, note: !!document.querySelector('[data-hidden-note]'), fleetBtn: !!document.querySelector('[data-act=sendallfleet]') }));
      await page.click('[data-tab=setup]'); await page.waitForSelector('[data-shown-panel]');
      out.g8panel = await page.evaluate(() => ({ text: document.querySelector('[data-shown-panel]').textContent, boxes: [...document.querySelectorAll('[data-shown-fc]')].map((x) => [x.dataset.shownFc, x.checked]) }));
      if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-gaps-setup-fcs.png'), fullPage: true });
      await page.uncheck('[data-shown-fc=fb]'); await page.waitForTimeout(700);
      await page.click('[data-tab=board]');
      out.g8hidden = await page.evaluate(() => ({ fcs: [...document.querySelectorAll('.fc')].map((x) => x.dataset.fc), next: document.querySelector('.strip-next').textContent, note: (document.querySelector('[data-hidden-note]') || {}).textContent || '', back: document.querySelector('.strip-back').textContent }));
      await page.click('[data-act=sendallfleet]'); await page.waitForSelector('#sheet .pick-fc');
      out.g8sheet = await page.evaluate(() => ({ groups: [...document.querySelectorAll('#sheet .pick-fc')].map((h) => h.textContent), rows: [...document.querySelectorAll('#sheet input[name=pick]')].map((x) => x.value) }));
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 });
      await page.click('[data-sort=time]'); await page.waitForSelector('.fc.wide');
      out.g8time = await page.$$eval('.fc.wide .sub .sub-fc', (xs) => [...new Set(xs.map((x) => x.textContent.replace(/ · $/, '')))]);
      await page.click('[data-sort=fc]'); await page.waitForSelector('.fleet');
      await page.reload(); await ready(page);
      out.g8reload = await page.evaluate(() => ({ fcs: [...document.querySelectorAll('.fc')].map((x) => x.dataset.fc), note: !!document.querySelector('[data-hidden-note]') }));
      const g8s = await saved(page);
      out.g8stored = { hide: g8s['submersibles-recommendations'] && g8s['submersibles-recommendations'].choices && g8s['submersibles-recommendations'].choices['hide-fb'], keys: Object.keys((g8s['submersibles-recommendations'] || {}).choices || {}), fb: !!g8s.submersibles.fcs.fb && !!g8s.submersibles.subs.b1 && !!g8s.submersibles.subs.b2,
        same: JSON.stringify(g8s.submersibles.subs.b1) === JSON.stringify(base8.submersibles.subs.b1) && JSON.stringify(g8s.submersibles.subs.b2) === JSON.stringify(base8.submersibles.subs.b2) && JSON.stringify(g8s.submersibles.fcs.fb) === JSON.stringify(base8.submersibles.fcs.fb) };
      out.g8alerts = await page.evaluate(() => { const S = window.__subs.section(); return Object.keys(S.subs).length; });
      // the note takes the way back to Setup, where a tick brings the company back
      await page.click('[data-hidden-note] [data-tab=setup]'); await page.waitForSelector('[data-shown-panel]');
      await page.check('[data-shown-fc=fb]'); await page.waitForTimeout(700);
      await page.click('[data-tab=board]');
      out.g8back = await page.evaluate(() => ({ fcs: document.querySelectorAll('.fc').length, note: !!document.querySelector('[data-hidden-note]') }));

      // ---- G9: the rank-up plan
      out.g9board = await page.evaluate(() => ({ a1: (document.querySelector('.sub[data-sub=a1] [data-rank-up]') || {}).textContent || null, a4: !!document.querySelector('.sub[data-sub=a4] [data-rank-up]') }));
      await page.click('.sub[data-sub=a1] .sub-top'); await page.waitForSelector('#sheet [data-rank-plan]');
      out.g9 = await page.evaluate(() => {
        const s = window.__subs.section().subs.a1, v = s.voyage, up = ADVISOR.afterVoyage(s, v.route), a = ADVISOR.advise({ sub: Object.assign({}, s, { rank: up.rank, expIntoRank: up.into }), fc: window.__subs.section().fcs.fa, slotsFilled: 4, recs: RECS.defaults() }), want = ADVISOR.rankUpPlan(up.rank, up.into, v.route, (v.returnAt - v.sentAt) / 1000);
        return { text: document.querySelector('#sheet [data-rank-plan]').textContent, need: want.need.toLocaleString('en'), perVoyage: want.perVoyage.toLocaleString('en'), side: document.documentElement.scrollWidth - window.innerWidth, hasAdvice: !!a };
      });
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 });
      await page.click('.sub[data-sub=a4] .sub-top'); await page.waitForSelector('#sheet h2');
      out.g9top = await page.evaluate(() => !!document.querySelector('#sheet [data-rank-plan]'));
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 });

      // ---- G10: earnings by submarine
      await page.click('[data-tab=earn]'); await page.waitForSelector('[data-earn-subs]');
      out.g10 = await page.evaluate(() => {
        const tot = EARN.totals(window.__subs.section(), {}, Date.now()), S = window.__subs.section();
        const rows = [...document.querySelectorAll('[data-earn-subs] tr')].map((tr) => [tr.cells[0].textContent, tr.cells[1].textContent]);
        const want = (id) => Math.round((tot.bySub[id] || { gil: 0 }).gil).toLocaleString('en') + ' gil';
        const got = (name) => (rows.find((r) => r[0].startsWith(name)) || [])[1];
        return { rows: rows.length, subs: Object.keys(S.subs).length, a1: [got('Alpha Company · Sub A1'), want('a1')], a2: [got('Alpha Company · Sub A2'), want('a2')], b1: [got('Bravo Company · Sub B1'), want('b1')], a3: [got('Alpha Company · Sub A3'), want('a3')],
          sum: Object.values(tot.bySub).reduce((n, x) => n + x.gil, 0) === tot.all, heading: [...document.querySelectorAll('#view h3')].map((h) => h.textContent).filter((t) => /submarine/i.test(t)) };
      });
      if (SHOT) await page.screenshot({ path: path.join(ev, 'submersibles-gaps-earn-subs.png'), fullPage: true });
      out.side = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await ctx.close();

      // ---- G11: discoveries are asked for, not hunted (and on a phone)
      const disc = [];
      for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 1000 } }], ['phone', { viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
        const { ctx: c2, errors: e2 } = await context(opts);
        const p2 = await c2.newPage();
        await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        await p2.evaluate(async (parts) => {
          const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
          const back = (r) => ({ sentAt: now - 30 * H, route: r, returnAt: now - H });
          sec.fcs.fa = { name: 'Alpha Company', world: 'Gilgamesh', unlockedSlots: 3, order: 0, discovered: [1, 2] };
          sec.fcs.fb = { name: 'Bravo Company', world: 'Gilgamesh', unlockedSlots: 1, order: 1, discovered: [1, 2, 3] };
          sec.fcs.fc = { name: 'Cedar Company', world: 'Gilgamesh', unlockedSlots: 2, order: 2, discovered: [1, 2, 3, 4, 5, 28] };
          sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts, voyage: back([1, 2]) };
          sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub A2', rank: 40, parts, voyage: back([1, 2]) };
          sec.subs.b1 = { fcId: 'fb', slot: 1, name: 'Sub B1', rank: 35, parts, voyage: back([1]) };
          sec.subs.c1 = { fcId: 'fc', slot: 1, name: 'Sub C1', rank: 60, parts, voyage: back([5]) };
          sec.subs.c2 = { fcId: 'fc', slot: 2, name: 'Sub C2', rank: 60, parts, voyage: back([28]) };
          const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        }, parts);
        await p2.reload(); await ready(p2);
        const o = { label };
        const openSheet = async (id) => { await p2.click('.sub[data-sub=' + id + '] .sub-top'); await p2.waitForSelector('#sheet h2'); };
        const closeIt = async () => { await p2.keyboard.press('Escape'); await p2.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 }); };
        const asked = () => p2.evaluate(() => { const q = document.querySelector('#sheet [data-reveal]'); return q ? { legend: q.querySelector('legend').textContent, ids: [...q.querySelectorAll('[data-new-sector]')].map((x) => +x.dataset.newSector), ticked: [...q.querySelectorAll('[data-new-sector]:checked')].length, none: q.querySelector('[data-reveal-none]').checked, noneText: q.querySelector('.reveal-none').textContent.trim(), inLoot: !!document.querySelector('#sheet .loot [data-reveal]'), labels: [...q.querySelectorAll('label.opt')].map((l) => l.textContent), side: document.documentElement.scrollWidth - window.innerWidth } : null; });
        await openSheet('a1'); o.a1 = await asked();
        if (SHOT) await p2.screenshot({ path: path.join(ev, 'submersibles-gaps-discovery-' + label + '.png') });
        await p2.check('#sheet [data-new-sector="4"]');
        o.afterTick = await p2.evaluate(() => ({ none: document.querySelector('[data-reveal-none]').checked, ticked: [...document.querySelectorAll('[data-new-sector]:checked')].map((x) => +x.dataset.newSector) }));
        await p2.check('#sheet [data-reveal-none]');
        o.afterNone = await p2.evaluate(() => ({ none: document.querySelector('[data-reveal-none]').checked, ticked: document.querySelectorAll('[data-new-sector]:checked').length }));
        await p2.check('#sheet [data-new-sector="5"]');
        await p2.click('#sheet [data-act=collect]'); await wroteOut(p2);
        await openSheet('a2'); o.a2 = await asked(); await closeIt();
        await openSheet('b1'); o.b1 = { asked: await asked(), legend: await p2.evaluate(() => /reveal a new sector/.test(document.querySelector('#sheet').textContent)) }; await closeIt();
        await openSheet('c1'); o.c1 = await asked(); await closeIt();
        await openSheet('c2'); o.c2 = await asked();
        await p2.click('#sheet [data-act=collect]'); await wroteOut(p2); // nothing ticked: nothing is added, nothing is removed
        const s2 = (await saved(p2)).submersibles;
        o.saved = { fa: s2.fcs.fa.discovered, fc: s2.fcs.fc.discovered, tripA1: Object.values(s2.trips).filter((t) => t.s === 'a1').map((t) => t.newSectors), a1gone: !s2.subs.a1.voyage };
        if (label === 'desktop') {
          // Setup: a list to tick what is already discovered, reached from the Setup tab itself
          await p2.click('[data-tab=setup]'); await p2.waitForSelector('[data-act=sectors][data-fc=fa]');
          o.setupBtn = await p2.$eval('[data-act=sectors][data-fc=fa]', (b) => b.textContent.trim());
          await p2.click('[data-act=sectors][data-fc=fa]'); await p2.waitForSelector('.wiz[data-step=sectors]');
          o.wiz = await p2.evaluate(() => ({ seas: [...document.querySelectorAll('.wiz details.sea summary')].map((x) => x.textContent), ticked: [...document.querySelectorAll('[data-w=disc]:checked')].map((x) => +x.value).sort((a, b) => a - b), total: document.querySelectorAll('[data-w=disc]').length }));
          await p2.evaluate(() => document.querySelector('.wiz details.sea').open = true);
          await p2.check('[data-w=disc][value="3"]'); await p2.click('[data-act=wsave]'); await p2.waitForTimeout(900);
          const s3 = (await saved(p2)).submersibles;
          o.setupSaved = { fa: s3.fcs.fa.discovered, a2rank: s3.subs.a2.rank, a2name: s3.subs.a2.name, fcs: Object.keys(s3.fcs).length };
          await p2.click('[data-tab=setup]');
          o.setupBtn2 = await p2.$eval('[data-act=sectors][data-fc=fa]', (b) => b.textContent.trim());
        }
        o.errors = real(e2);
        disc.push(o);
        await c2.close();
      }
      const d = disc[0], ph = disc[1];
      const allIds = (ids) => ids.slice().sort((a, b) => a - b).join();
      const wantA = kids([1, 2]).filter((x) => ![1, 2].includes(x));
      const asks = (o) => o.a1 && o.a1.legend === 'Did this voyage reveal a new sector?' && allIds(o.a1.ids) === allIds(wantA) && o.a1.ticked === 0 && o.a1.none === true && o.a1.noneText === 'None of these' && o.a1.inLoot === false && o.a1.side <= 0 &&
        o.a1.ids.every((id) => o.a1.labels.some((l) => l.includes(data.sectors.find((x) => x.id === id).letter) && l.includes(seaName(data.sectors.find((x) => x.id === id).sea)))) &&
        o.afterTick.none === false && o.afterTick.ticked.join() === '4' && o.afterNone.none === true && o.afterNone.ticked === 0 &&
        o.a2 && allIds(o.a2.ids) === allIds(wantA.filter((x) => x !== 5)) && o.b1.asked === null && o.b1.legend === false &&
        o.c1 && allIds(o.c1.ids) === allIds(kids([5])) && o.c1.labels.some((l) => l.includes('grants submarine slot 2')) && o.c2 && allIds(o.c2.ids) === allIds(kids([28])) && o.c2.labels.some((l) => l.includes('opens ' + seaName(data.unlocks[o.c2.ids[0]].opensSea))) &&
        o.saved.fa.join() === '1,2,5' && o.saved.tripA1.join() === '5' && o.saved.a1gone && o.saved.fc.join() === '1,2,3,4,5,28' && o.errors.length === 0;
      const eqg = (x) => x && x[0] === x[1] && !!x[0];
      const g7ok = out.g7.groups.join() === 'Alpha Company,Bravo Company' && out.g7.rows.map((r) => r.join(':')).join() === 'a1:true,a2:true,b1:true' && out.g7.perGroup.join() === '2,1' && out.g7.side <= 0 &&
        out.g7after.a1 === 1 && out.g7after.a2 === 1 && out.g7after.b1 === 0 && out.g7after.a1v && out.g7after.a2v && out.g7after.b1same && out.g7after.trips === 6 && out.g7same.a1 === out.g7same.b1 && out.g7same.a1.length > 10;
      const g8ok = out.g8all.fcs === 2 && /Bravo/.test(out.g8all.next) && !out.g8all.note && out.g8all.fleetBtn && out.g8panel.boxes.map((b) => b.join(':')).join() === 'fa:true,fb:true' && /follows you to your other devices/.test(out.g8panel.text) &&
        out.g8hidden.fcs.join() === 'fa' && /Alpha/.test(out.g8hidden.next) && !/Bravo/.test(out.g8hidden.next) && /1 free company is hidden/.test(out.g8hidden.note) && out.g8hidden.back === '2 back now' &&
        out.g8sheet.groups.join() === 'Alpha Company' && out.g8sheet.rows.join() === 'a1,a2' && out.g8time.join() === 'Alpha Company' && out.g8reload.fcs.join() === 'fa' && out.g8reload.note &&
        out.g8stored.hide === true && out.g8stored.keys.every((k) => /^hide-/.test(k) || ['fuel', 'giveUp', 'order'].includes(k) || /^(loot|use)\d$/.test(k)) && out.g8stored.fb && out.g8stored.same && out.g8alerts === 6 && out.g8back.fcs === 2 && !out.g8back.note;
      const g9ok = /^Rank-up plan:/.test(out.g9.text) && out.g9.text.includes(out.g9.need + ' experience still needed to reach rank 145') && out.g9.text.includes('at least ' + out.g9.perVoyage) && /no more than [\d,]+ voyages, about [\d,.]+ days/.test(out.g9.text) && out.g9.side <= 0 &&
        out.g9board.a1 === null && out.g9board.a4 === false && out.g9top === false; // the Board card has no rank-up line (it did not fit C25's 1080 px); the send window has the plan
      const g10ok = out.g10.rows === out.g10.subs && eqg(out.g10.a1) && eqg(out.g10.a2) && eqg(out.g10.b1) && out.g10.a3[1] === '0 gil' && out.g10.a3[0] === '0 gil' && out.g10.sum && out.g10.heading.join() === 'By submarine' && out.side <= 0 && real(errors).length === 0;
      record('C101', 'Design gaps B (G7 to G11): one sheet for the whole fleet sends exactly the ticked returned subs and logs them as the per-company sheet does; hiding a free company removes it from the Board, the next-back strip and the fleet-wide send, survives a reload and deletes nothing; the rank-up plan says "at least"; Earnings has totals by submarine; Setup has a list of discovered sectors and the return sheet asks which sectors the voyage revealed (only the ones it could have revealed, none ticked, "None of these", nothing when none)',
        g7ok && g8ok && g9ok && g10ok && asks(d) && d.setupBtn === 'Sectors already discovered: 3 of 143' && d.wiz.seas.length === 7 && d.wiz.total === 143 && d.wiz.ticked.join() === '1,2,5' && d.setupSaved.fa.join() === '1,2,3,5' && d.setupSaved.a2rank === 40 && d.setupSaved.fcs === 3 && d.setupBtn2 === 'Sectors already discovered: 4 of 143' &&
        asks(ph) && ph.a1.side <= 0, { g7ok, g8ok, g9ok, g10ok, out, desktop: d, phone: ph });
      server32.close();
    });

    // ── C102 Submersibles, Sectors list: "Mark every sector in <sea> as discovered" and "Clear every sector in <sea>" tick or untick one sea in the form
    //    only; Save stores exactly the ticked list; Clear keeps the two sectors open from the start; other seas are untouched; a later sea whose opening
    //    sector is not ticked says so (information only); no sideways scroll at 360 px.
    await guard('C102', async () => {
      const server33 = await start(PORT5);
      const data = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8'));
      const ids = (sea) => data.sectors.filter((x) => x.sea === sea).map((x) => x.id);
      const sea1 = data.seas[0], sea2 = data.seas[1], sea3 = data.seas[2];
      const keep3 = ids(sea3.id)[0], opener3 = +Object.keys(data.unlocks).find((k) => data.unlocks[k].opensSea === sea3.id);
      const opener2 = +Object.keys(data.unlocks).find((k) => data.unlocks[k].opensSea === sea2.id);
      const opener3Name = data.sectors.find((x) => x.id === opener3);
      const numeric = (a) => a.slice().sort((x, y) => x - y);
      const ready = (page) => page.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
      const saved = (page) => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules; });
      const out = {};
      for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 1000 } }], ['phone', { viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
        const { ctx: c3, errors: e3 } = await context(opts);
        const p3 = await c3.newPage();
        await p3.goto(ROOT5 + 'submersibles/'); await ready(p3);
        await p3.evaluate(async (keep) => {
          const sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
          sec.fcs.fa = { name: 'Alpha Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2, 3, keep] };
          sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };
          const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        }, keep3);
        await p3.reload(); await ready(p3);
        const open = async () => { await p3.click('[data-tab=setup]'); await p3.waitForSelector('[data-act=sectors][data-fc=fa]'); await p3.click('[data-act=sectors][data-fc=fa]'); await p3.waitForSelector('.wiz[data-step=sectors]'); await p3.evaluate(() => document.querySelectorAll('.wiz details.sea').forEach((d) => { d.open = true; })); };
        const ticked = () => p3.evaluate(() => [...document.querySelectorAll('[data-w=disc]:checked')].map((x) => +x.value).sort((a, b) => a - b));
        const sum = (n) => p3.evaluate((n) => document.querySelectorAll('.wiz details.sea summary')[n].textContent.replace(/\s+/g, ' ').trim(), n);
        const note = (n) => p3.$eval('[data-sea-note="' + n + '"]', (e) => e.textContent);
        const o = { label };
        await open();
        const mark = '[data-act=seaall][data-sea="' + sea1.id + '"]', clear = '[data-act=seanone][data-sea="' + sea1.id + '"]';
        o.names = await p3.evaluate(([m, c]) => [document.querySelector(m).textContent, document.querySelector(m).getAttribute('aria-label'), document.querySelector(c).textContent, document.querySelector(c).getAttribute('aria-label'), document.querySelector(m).getBoundingClientRect().height, document.querySelector(c).getBoundingClientRect().height], [mark, clear]);
        o.note2before = await note(sea2.id); o.note3before = await note(sea3.id);
        await p3.click(mark);
        o.focus = await p3.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-act'));
        o.live = await p3.$eval('[data-sea-live]', (e) => e.textContent);
        o.sum1 = await sum(0); o.sum3 = await sum(2);
        o.afterMark = await ticked();
        o.note2after = await note(sea2.id); o.note3after = await note(sea3.id);
        o.noteSea1 = await note(sea1.id);
        o.wide = await p3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (SHOT) { await p3.evaluate(() => document.querySelector('.wiz').scrollIntoView()); await p3.screenshot({ path: path.join(ev, 'submersibles-sectors-bulk-' + label + '.png'), fullPage: false }); }
        if (label === 'desktop') {
          await p3.click('[data-act=wsave]'); await p3.waitForTimeout(900);
          o.saved1 = numeric((await saved(p3)).submersibles.fcs.fa.discovered);
          await p3.reload(); await ready(p3);
          o.reloaded1 = numeric((await saved(p3)).submersibles.fcs.fa.discovered);
          await open(); await p3.click(clear);
          o.liveClear = await p3.$eval('[data-sea-live]', (e) => e.textContent); o.sum1c = await sum(0); o.focusClear = await p3.evaluate(() => document.activeElement.getAttribute('data-act'));
          o.afterClear = await ticked(); o.note2clear = await note(sea2.id);
          await p3.click('[data-act=wsave]'); await p3.waitForTimeout(900);
          await p3.reload(); await ready(p3);
          o.reloaded2 = numeric((await saved(p3)).submersibles.fcs.fa.discovered);
          await open(); await p3.click(clear); await p3.click('[data-act=wcancel]'); await p3.waitForTimeout(300);
          o.cancelled = numeric((await saved(p3)).submersibles.fcs.fa.discovered); // Clear then Cancel: nothing was stored
        }
        o.errors = real(e3);
        out[label] = o;
        await c3.close();
      }
      const d = out.desktop, p = out.phone, s1 = ids(sea1.id), n1 = s1.length, start2 = [1, 2];
      const want1 = numeric(Array.from(new Set(s1.concat([keep3]))));
      const op3 = 'This sea is opened by ' + opener3Name.name.replace(/\s*\([A-Z]\)$/, '') + ' ' + opener3Name.letter + ' in ' + data.seas.find((x) => x.id === opener3Name.sea).name + ', which is not ticked.';
      const ok = (o) => o.names[0] === 'Mark every sector in ' + sea1.name + ' as discovered' && o.names[1].includes(sea1.name) && o.names[2] === 'Clear every sector in ' + sea1.name && o.names[3].includes(sea1.name) && o.names[4] >= 36 && o.names[5] >= 36 &&
        o.focus === 'seaall' && o.live === 'All ' + n1 + ' sectors of ' + sea1.name + ' ticked' && o.sum1 === sea1.name + ' ' + n1 + ' of ' + n1 && o.sum3.endsWith('1 of ' + ids(sea3.id).length) &&
        allSame(o.afterMark, want1) && o.note2before.startsWith('This sea is opened by ') && o.note3before === op3 && o.note3after === op3 && o.noteSea1 === '' && o.wide <= 0 && o.errors.length === 0;
      function allSame(a, b) { return a.join() === b.join(); }
      const okD = ok(d) && d.note2after === '' && d.saved1.join() === want1.join() && d.reloaded1.join() === want1.join() && d.focusClear === 'seanone' && d.sum1c === sea1.name + ' 2 of ' + n1 && d.afterClear.join() === numeric(start2.concat([keep3])).join() && d.note2clear.startsWith('This sea is opened by ') &&
        d.reloaded2.join() === numeric(start2.concat([keep3])).join() && d.cancelled.join() === d.reloaded2.join() && d.liveClear.includes('open from the start');
      record('C102', 'Sectors list: "Mark every sector in <sea> as discovered" ticks that sea only in the form (count at once, announced politely, focus stays on the button, taps at least 36 px), Save keeps exactly that sea plus what was there, "Clear every sector in <sea>" removes them but keeps the two sectors open from the start, other seas are untouched, a later sea whose opening sector is not ticked says so, no sideways scroll at 360 px',
        okD && ok(p), { out, opener2 });
      server33.close();
    });

    // the market price lookup of Earnings and the Log, answered here (a stand-in for the market site, one price for the one item seeded) so that the page does not redraw itself in a loop while the offline run cannot fetch it
    const stubPrices = (pg) => pg.route('https://universalis.app/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ averagePrice: 100, items: { 10099: { averagePrice: 100 } } }) }));
    // ── C107 Submersibles empty states (W33, Rev4.7): the four full empty states (the Board with no free company, which the Map shows too; every company hidden; the Log with no voyage; Earnings with none)
    //    show their headline, their steps and one action; each action does what its row says; the scope is decoration hidden from screen readers; no sideways scroll and no clipped headline at 360 px;
    //    the sweep of the scope turns, and with reduced motion it stands still.
    await guard('C107', async () => {
      const server = await start(PORT5);
      const probe = (pg, id) => pg.evaluate((id) => {
        const el = document.querySelector('[data-empty="' + id + '"]'); if (!el) return null;
        const h = el.querySelector('h2'), a = el.querySelector('.es-act .btn'), sc = el.querySelector('.es-scope'), r = a.getBoundingClientRect();
        return { h: h.textContent, hFits: h.scrollWidth <= h.clientWidth + 1, h2s: document.querySelectorAll('#view h2').length, act: a.textContent, hook: a.getAttribute('data-act') || a.getAttribute('data-tab'), actH: Math.round(r.height), steps: [...el.querySelectorAll('.es-step')].map((x) => x.querySelector('strong').textContent + '|' + x.className.replace('es-step ', '')),
          kick: el.querySelector('.es-kick').textContent, welcome: el.classList.contains('welcome'), panel: el.classList.contains('panel'), hidden: sc.getAttribute('aria-hidden'), noColourAttr: ![...sc.querySelectorAll('*')].some((e) => e.hasAttribute('fill') || e.hasAttribute('stroke')), svg: sc.querySelectorAll('svg').length, labels: sc.querySelectorAll('.es-word, .es-count').length,
          word: sc.querySelector('.es-word').textContent, side: document.documentElement.scrollWidth - innerWidth, fan: getComputedStyle(el.querySelector('.es-sweep')).animationName, note: !!el.querySelector('.es-note'), aside: (el.querySelector('.es-aside') || {}).textContent || null, scopeH: Math.round(sc.getBoundingClientRect().height), bg: getComputedStyle(sc).backgroundImage.slice(0, 40) };
      }, id);
      const ready = (pg) => () => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const seedHidden = (pg) => pg.evaluate(async () => { const sec = { fcs: { fa: { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 1, discovered: [1, 2, 3] } }, subs: { a1: { fcId: 'fa', slot: 1, name: 'Sub One', rank: 50, parts: [3, 4, 1, 2] } }, trips: {}, settings: {} }; const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null }); });
      // the four states in one context; opts.actions: press each action (desktop only)
      const walkStates = async (opts, doActions) => {
        const { ctx, errors } = await context(opts), page = await ctx.newPage(), out = {}, rd = ready(page);
        await page.goto(ROOT5 + 'submersibles/'); await rd(); await page.waitForSelector('[data-empty="board-none"]');
        out.board = await probe(page, 'board-none');
        await page.click('[data-tab=map]'); await page.waitForSelector('[data-empty="board-none"]'); out.map = await probe(page, 'board-none'); await page.click('[data-tab=board]');
        if (doActions) { await page.click('[data-empty="board-none"] [data-act=new]'); await page.waitForSelector('.wiz-head'); out.setupOpens = true; await page.click('[data-act=wcancel]'); await page.click('[data-tab=board]'); await page.waitForSelector('[data-empty="board-none"]'); }
        await page.click('[data-tab=log]'); await page.waitForSelector('[data-empty="log-none"]'); out.log = await probe(page, 'log-none');
        if (doActions) { await page.click('[data-empty="log-none"] [data-tab=board]'); await page.waitForSelector('[data-empty="board-none"]'); out.logToBoard = await page.evaluate(() => document.querySelector('.tabs [data-tab=board]').getAttribute('aria-current')); await page.click('[data-tab=log]'); }
        await page.click('[data-tab=earn]'); await page.waitForSelector('[data-empty="earn-none"]'); out.earn = await probe(page, 'earn-none');
        if (doActions) { await page.click('[data-empty="earn-none"] [data-tab=log]'); await page.waitForSelector('[data-empty="log-none"]'); out.earnToLog = await page.evaluate(() => document.querySelector('.tabs [data-tab=log]').getAttribute('aria-current')); }
        await seedHidden(page); await page.reload(); await rd(); await page.click('[data-tab=setup]'); await page.waitForSelector('[data-shown-fc=fa]'); await page.uncheck('[data-shown-fc=fa]'); await page.waitForTimeout(700);
        await page.click('[data-tab=board]'); await page.waitForSelector('[data-empty="board-hidden"]'); out.hidden = await probe(page, 'board-hidden');
        out.hiddenExtra = await page.evaluate(() => ({ note: !!document.querySelector('[data-hidden-note]'), fleetEmpty: document.querySelector('.fleet') && document.querySelector('.fleet').children.length === 0, after: !!(document.querySelector('.fleet').compareDocumentPosition(document.querySelector('[data-empty="board-hidden"]')) & Node.DOCUMENT_POSITION_FOLLOWING) }));
        if (doActions) {
          // keyboard: Tab reaches the action and it shows an outline
          let on = false; for (let i = 0; i < 60 && !on; i++) { await page.keyboard.press('Tab'); on = await page.evaluate(() => document.activeElement.matches('[data-empty] .es-act .btn')); }
          out.focus = on ? await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return { w: parseFloat(c.outlineWidth), s: c.outlineStyle }; }) : null;
          await page.click('[data-empty="board-hidden"] [data-tab=setup]'); await page.waitForSelector('[data-shown-panel]'); out.hiddenToSetup = true;
        }
        out.errors = real(errors); await ctx.close(); return out;
      };
      const d = await walkStates({ viewport: { width: 1440, height: 1000 } }, true);
      const p = await walkStates({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, false);
      // reduced motion: the fan of the scope stands still
      const { ctx: rctx, errors: rerr } = await context({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }), rp = await rctx.newPage();
      await rp.goto(ROOT5 + 'submersibles/'); await ready(rp)(); await rp.waitForSelector('[data-empty="board-none"]');
      const rm = await probe(rp, 'board-none'); await rctx.close();
      const four = (w) => [w.board, w.log, w.earn, w.hidden];
      const okState = (x, h, act, hook, steps, kick) => x && x.h === h && x.act === act && x.hook === hook && x.steps.length === steps && x.kick === kick && x.panel && x.hidden === 'true' && x.noColourAttr && x.svg === 1 && x.labels === 2 && x.h2s === 1 && x.actH >= 36;
      const ok = okState(d.board, 'No submarines in the water', 'Start the setup', 'new', 3, 'The dock is empty') && d.board.welcome && d.board.note && d.board.aside === 'about 3 to 5 minutes per free company' && d.board.steps.join() === 'Name the free company|v-route,Add its submarines|v-rank,Tick what is discovered|v-loot' &&
        okState(d.map, 'No submarines in the water', 'Start the setup', 'new', 3, 'The dock is empty') && okState(d.log, 'No voyages yet', 'Go to the Board', 'board', 3, 'The log is empty') && d.log.steps.map((x) => x.split('|')[1]).join() === 'v-route,v-loot,v-gil' &&
        okState(d.earn, 'Nothing logged yet', 'Go to the Log', 'log', 2, 'No earnings yet') && d.earn.steps.map((x) => x.split('|')[1]).join() === 'v-loot,v-gil' && okState(d.hidden, 'Every free company is hidden', 'Show them in Setup', 'setup', 0, 'Nothing on the Board') &&
        d.hiddenExtra.note && d.hiddenExtra.fleetEmpty && d.hiddenExtra.after && d.setupOpens && d.logToBoard === 'page' && d.earnToLog === 'page' && d.hiddenToSetup && d.focus && d.focus.w >= 2 && d.focus.s !== 'none' &&
        four(d).map((x) => x.word).join() === 'Your dock,Log,Earnings,Hidden' && four(d).every((x) => x.fan !== 'none' && /gradient/.test(x.bg)) &&
        four(p).every((x) => x.side <= 0 && x.hFits && x.actH >= 36 && x.scopeH >= 130 && x.scopeH <= 190) && rm.fan === 'none' && !d.errors.length && !p.errors.length && !rerr.length;
      record('C107', 'Empty states (W33): the four full empty states (the Board with no free company, which the Map shows too, every company hidden, the Log with no voyage, Earnings with none) show their kicker, headline, steps in their role colours and one action; the actions open the setup, the Board, the Log and Setup; the scope is hidden from screen readers and holds no colour attribute; at 360 px there is no sideways scroll, the headline fits and the action is at least 36 px; the scope turns and, with reduced motion, stands still (W36: on a phone the scope band is 180 px, a 140 px drawing and a 40 px strip for its labels)',
        ok, { desktop: d, phone: p, reduced: { fan: rm.fan }, errors: [d.errors, p.errors, rerr] });
      server.close();
    });

    // ── C108 Submersibles Log as a ledger by day (W34, Rev4.7): each day rule's voyage count and gil equal the rows under it, "Today" and "Yesterday" and the year of an old day read as the spec says,
    //    the rule is sticky and does not cover a focused row, a row still opens its voyage, and at 360 px nothing scrolls sideways
    await guard('C108', async () => {
      const server = await start(PORT5);
      const seed = (pg) => pg.evaluate(async () => {
        const mid = new Date(); mid.setHours(0, 0, 0, 0); const D0 = mid.getTime(), H = 3600000, DAY = 86400000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        const at = (days, h, m) => { const d = new Date(D0 - days * DAY); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
        sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 1, discovered: [1, 2, 3] };
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub One', rank: 50, parts: [3, 4, 1, 2] };
        const T = (id, back, r, items) => { sec.trips[id] = { s: 'a1', t: back - 20 * H, r, back, items, newSectors: [] }; };
        T('t1', at(0, 0, 40), [1, 2], [[10099, 3]]); T('t2', at(0, 0, 10), [3], []);          // today: one logged, one not
        T('t3', at(1, 12), [1, 2], [[10099, 2]]);                                            // yesterday: logged
        T('t4', at(3, 9), [1, 2], [[10099, 4]]); T('t5', at(3, 8), [3], [[10099, 1]]);       // three days ago: two logged
        T('t6', at(5, 15), [1], []);                                                         // five days ago: nothing logged
        T('t7', at(400, 10), [1, 2], [[10099, 6]]);                                          // more than a year ago: the year is part of the label
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      const read = (pg) => pg.evaluate(() => {
        const out = [], list = document.querySelector('.log-list'); let cur = null;
        [...list.children].forEach((el) => {
          if (el.classList.contains('log-day')) { cur = { label: el.querySelector('b').textContent, summary: el.querySelector('span').textContent, rows: [], figs: [], sticky: getComputedStyle(el).position === 'sticky', top: getComputedStyle(el).top }; out.push(cur); }
          else if (el.classList.contains('log-row')) { cur.rows.push(el.dataset.trip); const b = el.querySelector('.log-what b'); if (b) cur.figs.push(+b.textContent.replace(/[^\d]/g, '')); }
        });
        return { days: out, rows: list.querySelectorAll('.log-row').length, firstIsDay: list.firstElementChild.classList.contains('log-day'), discs: [...list.querySelectorAll('.log-row')].map((r) => r.querySelectorAll('.log-disc .disc').length), discHidden: [...list.querySelectorAll('.log-disc .discs')].every((d) => d.getAttribute('aria-hidden') === 'true'), zebra: !!list.querySelector('.log-row:nth-child(even)') && getComputedStyle(list.querySelectorAll('.log-row')[1]).backgroundColor !== getComputedStyle(list.querySelectorAll('.log-row')[0]).backgroundColor };
      });
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 420 } }), page = await ctx.newPage(), rd = ready0(page); await stubPrices(page);
      function ready0(pg) { return () => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); }
      await page.goto(ROOT5 + 'submersibles/'); await rd(); await seed(page); await page.reload(); await rd(); await page.click('[data-tab=log]'); await page.waitForSelector('.log-row[data-trip]'); await page.waitForTimeout(300);
      const g = await read(page);
      const want = [['Today', ['t1', 't2']], ['Yesterday', ['t3']], [null, ['t4', 't5']], [null, ['t6']], [null, ['t7']]];
      const sums = g.days.map((d) => ({ n: +(/^(\d+) voyages?/.exec(d.summary) || [])[1], gil: (/· ([\d,]+) gil logged$/.exec(d.summary) || [])[1] ? +(/· ([\d,]+) gil logged$/.exec(d.summary)[1].replace(/,/g, '')) : (/· nothing logged$/.test(d.summary) ? 0 : -1), word: /^\d+ voyages? · /.test(d.summary) }));
      const match = g.days.length === 5 && g.days.every((d, i) => d.rows.join() === want[i][1].join() && sums[i].word && sums[i].n === d.rows.length && sums[i].gil === d.figs.reduce((a, b) => a + b, 0) && (want[i][0] ? d.label === want[i][0] : /^[A-Z][a-z]+ \d{1,2} [A-Z][a-z]+( \d{4})?$/.test(d.label)));
      const oneVoyage = /^1 voyage · /.test(g.days[1].summary) && /^2 voyages · /.test(g.days[0].summary), nothing = /· nothing logged$/.test(g.days[3].summary), withYear = /\d{4}$/.test(g.days[4].label) && !/\d{4}$/.test(g.days[2].label);
      // a row still opens its voyage
      await page.click('.log-row[data-trip="t4"]'); await page.waitForSelector('#sheet[open] .loot'); const opens = await page.evaluate(() => !!document.querySelector('#sheet[open] [data-act=trip-save]'));
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheet[open]')).catch(() => {});
      // the rule is sticky (top 0): scroll the page so that the third day's rows pass under it; a row focused with the keyboard stays clear of the rule
      const stick = await page.evaluate(async () => {
        // (the price lookup may redraw the Log once while this runs: each step takes its rows afresh and is repeated until the row it focused is still on the page)
        const wait = (ms) => new Promise((r) => setTimeout(r, ms)), q = () => [...document.querySelectorAll('.log-row')];
        window.scrollTo({ top: q()[3].getBoundingClientRect().top + window.scrollY - 5, behavior: 'instant' }); await wait(200);
        const stuckNow = [...document.querySelectorAll('.log-day')].filter((d) => Math.abs(d.getBoundingClientRect().top) <= 1).length;
        // a row above the viewport takes focus (as Shift+Tab does): the browser scrolls it into view and must leave it clear of the stuck rule
        let row = null;
        for (let k = 0; k < 6; k++) { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); await wait(200); row = q()[1]; row.focus(); await wait(300); if (row.isConnected && document.activeElement === row) break; }
        const stuck = [...document.querySelectorAll('.log-day')].filter((d) => Math.abs(d.getBoundingClientRect().top) <= 1), rule = stuck[0], rr = row.getBoundingClientRect();
        return { stuckNow, stuck: stuck.length, position: stuck[0] && getComputedStyle(stuck[0]).position, clear: rule ? rr.top >= rule.getBoundingClientRect().bottom - 1 : true, focused: document.activeElement === row, rowTop: Math.round(rr.top), ruleBottom: rule ? Math.round(rule.getBoundingClientRect().bottom) : null };
      });
      await ctx.close();
      // 360 px: no sideways scroll, rows and discs fit
      const { ctx: c2, errors: e2 } = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p2 = await c2.newPage(); await stubPrices(p2);
      await p2.goto(ROOT5 + 'submersibles/'); await ready0(p2)(); await seed(p2); await p2.reload(); await ready0(p2)(); await p2.click('[data-tab=log]'); await p2.waitForSelector('.log-row[data-trip]'); await p2.waitForTimeout(300);
      const ph = await p2.evaluate(() => ({ side: document.documentElement.scrollWidth - innerWidth, rowH: [...document.querySelectorAll('.log-row')].map((r) => Math.round(r.getBoundingClientRect().height)), rowW: Math.max(...[...document.querySelectorAll('.log-row, .log-day')].map((r) => Math.round(r.getBoundingClientRect().width))), listW: Math.round(document.querySelector('.log-list').getBoundingClientRect().width) }));
      await c2.close();
      const ok = match && oneVoyage && nothing && withYear && g.firstIsDay && g.rows === 7 && g.discs.join() === '2,1,2,2,1,1,2' && g.discHidden && !g.zebra && g.days.every((d) => d.sticky && d.top === '0px') && stick.stuckNow >= 1 && stick.focused && stick.clear === true && opens && ph.side <= 0 && ph.rowW <= ph.listW && ph.rowH.every((h) => h >= 40) && !real(errors).length && !real(e2).length;
      record('C108', 'Log by day (W34): a sticky day rule before each local day says "Today", "Yesterday" or the weekday, day and month (with the year when it is not this year) and "N voyages · G gil logged" (or "nothing logged"); the count and the gil equal the rows under it; rows carry their route discs; a row still opens its voyage; a focused row stays clear of the rule; no sideways scroll at 360 px',
        ok, { days: g.days.map((d) => [d.label, d.summary, d.rows.join('+'), d.figs.join('+')]), discs: g.discs, stick, opens, phone: ph, zebra: g.zebra, errors: [real(errors), real(e2)] });
      server.close();
    });

    // ── C109 Submersibles Earnings on one printed scale (W34, Rev4.7): each ranked bar's --p is its gil per hour over the printed scale, the scale is a nice number at least the largest figure,
    //    the by-company and by-submarine tables have their own scale and their own bars; ranked and thin rows carry route discs; no sideways scroll at 360 px
    await guard('C109', async () => {
      const server = await start(PORT5);
      const seed = (pg) => pg.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: { prefs: { priceWorld: 'Aether' } } };
        sec.fcs.fg = { name: 'Golf Company', world: 'Gilgamesh', unlockedSlots: 2, order: 0, discovered: [1, 2, 3] }; sec.fcs.fh = { name: 'Hotel Company', world: 'Gilgamesh', unlockedSlots: 1, order: 1, discovered: [1, 2, 3] };
        sec.subs.g1 = { fcId: 'fg', slot: 1, name: 'Sub G1', rank: 10, parts: [3, 4, 1, 2] }; sec.subs.g2 = { fcId: 'fg', slot: 2, name: 'Sub G2', rank: 10, parts: [3, 4, 1, 2] }; sec.subs.h1 = { fcId: 'fh', slot: 1, name: 'Sub H1', rank: 10, parts: [3, 4, 1, 2] };
        for (let i = 1; i <= 10; i++) sec.trips['p' + i] = { s: 'g1', t: now - (200 + i * 30) * H, r: [1, 2], back: now - (200 + i * 30 - 20) * H, items: [[10099, 700]], newSectors: [] };
        for (let i = 1; i <= 10; i++) sec.trips['q' + i] = { s: 'g2', t: now - (200 + i * 30) * H, r: [3], back: now - (200 + i * 30 - 10) * H, items: [[10099, 200]], newSectors: [] };
        for (let i = 1; i <= 10; i++) sec.trips['u' + i] = { s: 'h1', t: now - (200 + i * 30) * H, r: [2], back: now - (200 + i * 30 - 12) * H, items: [[10099, 100]], newSectors: [] };
        for (let i = 1; i <= 3; i++) sec.trips['r' + i] = { s: 'h1', t: now - (10 + i * 30) * H, r: [1], back: now - (10 + i * 30 - 10) * H, items: [[10099, 1]], newSectors: [] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      const read = (pg) => pg.evaluate(() => {
        const num = (t) => +String(t).replace(/[^\d]/g, ''), cap = (t) => { const c = t.querySelector('caption.earn-scale'); return c ? c.textContent : null; };
        const tabs = [...document.querySelectorAll('.earn-t')], by = (re) => tabs.find((t) => re.test(t.querySelector('caption') ? t.querySelector('caption').textContent : ''));
        const rows = (t, col) => t ? [...t.querySelectorAll('tbody tr[style]:not(.earn-note)')].map((tr) => ({ p: +tr.style.getPropertyValue('--p'), fig: num(tr.cells[col].textContent), discs: tr.querySelectorAll('.disc').length })) : [];
        const ranked = document.querySelector('.earn-ranked'), thin = document.querySelector('.earn-thin'), fcT = tabs.find((t) => !t.classList.contains('earn-ranked') && !t.classList.contains('earn-thin') && !t.hasAttribute('data-earn-subs') && t.querySelector('thead') === null), subT = document.querySelector('[data-earn-subs]');
        return { rankedCap: cap(ranked), fcCap: cap(fcT), subCap: cap(subT), ranked: rows(ranked, 2), fc: rows(fcT, 1), sub: rows(subT, 1), thinDiscs: thin ? [...thin.querySelectorAll('tbody tr:not(.earn-note)')].map((tr) => tr.querySelectorAll('.disc').length) : [], rankedDiscs: ranked ? [...ranked.querySelectorAll('tbody tr[data-pos]')].map((tr) => tr.cells[1].querySelectorAll('.disc').length) : [],
          captionsFirst: [ranked, fcT, subT].every((t) => t && t.firstElementChild.tagName === 'CAPTION'), cards: [...document.querySelectorAll('.earn-card')].map((c) => ({ b: c.querySelector('b').textContent, clip: getComputedStyle(c).clipPath !== 'none', figFirst: c.querySelector('b').getBoundingClientRect().top < c.querySelector('span').getBoundingClientRect().top })), side: document.documentElement.scrollWidth - innerWidth };
      });
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage(), rd = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); await stubPrices(page);
      await page.goto(ROOT5 + 'submersibles/'); await rd(); await seed(page); await page.reload(); await rd(); await page.click('[data-tab=earn]'); await page.waitForSelector('.earn-ranked'); await page.waitForTimeout(800);
      const g = await read(page); await ctx.close();
      const parse = (t, re) => { const m = re.exec(t || ''); return m ? +m[1].replace(/,/g, '') : null; };
      const sHr = parse(g.rankedCap, /^Bars run from 0 to ([\d,]+) gil an hour$/), sFc = parse(g.fcCap, /^Bars run from 0 to ([\d,]+) gil$/), sSub = parse(g.subCap, /^Bars run from 0 to ([\d,]+) gil$/);
      const nice = (v) => v != null && /^(1|2|25|5)0*$/.test(String(v));
      const ofRows = (rs, sc) => rs.length > 0 && rs.every((r) => Math.abs(r.p - r.fig / sc) <= 0.002 && r.p <= 1.0005);
      const holds = (rs, sc) => Math.max(...rs.map((r) => r.fig)) <= sc && (Math.max(...rs.map((r) => r.fig)) > 0);
      // the scale is the smallest nice number that holds the largest figure: the next one down would not
      const smallest = (rs, sc) => { const m = Math.max(...rs.map((r) => r.fig)), down = [1, 2, 2.5, 5].map((k) => k * Math.pow(10, Math.floor(Math.log10(sc)) - 1)).concat([1, 2, 2.5, 5].map((k) => k * Math.pow(10, Math.floor(Math.log10(sc))))).filter((v) => v < sc).sort((a, b) => b - a)[0]; return !down || down < m; };
      const phone = await (async () => { const { ctx: c2, errors: e2 } = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p2 = await c2.newPage(); await stubPrices(p2); await p2.goto(ROOT5 + 'submersibles/'); await p2.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); await seed(p2); await p2.reload(); await p2.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); await p2.click('[data-tab=earn]'); await p2.waitForSelector('.earn-ranked'); await p2.waitForTimeout(800); const r = await read(p2); await c2.close(); return { side: r.side, errors: real(e2) }; })();
      const ok = (g.ranked.length === 3 && nice(sHr) && nice(sFc) && nice(sSub) && ofRows(g.ranked, sHr) && holds(g.ranked, sHr) && smallest(g.ranked, sHr) && ofRows(g.fc, sFc) && holds(g.fc, sFc) && smallest(g.fc, sFc) && ofRows(g.sub, sSub) && holds(g.sub, sSub) && smallest(g.sub, sSub) &&
        g.captionsFirst && g.rankedDiscs.slice().sort().join() === '1,1,2' && g.thinDiscs.join() === '1' && g.cards.length === 4 && g.cards.every((c) => c.clip && c.figFirst) && g.side <= 0 && phone.side <= 0 && !phone.errors.length && !real(errors).length);
      record('C109', 'Earnings on one printed scale (W34): each ranked bar\'s --p is its gil per hour over the printed scale ("Bars run from 0 to N gil an hour", the smallest of 1, 2, 2.5, 5 or 10 times a power of ten that holds the largest figure); the by-company and by-submarine tables print their own scale and size their bars by it; ranked and thin rows carry route discs; the four totals are slanted count blocks with the figure over the word; no sideways scroll at 360 px',
        ok, { scale: { hr: sHr, fc: sFc, sub: sSub }, ranked: g.ranked, fc: g.fc, sub: g.sub, rankedDiscs: g.rankedDiscs, thinDiscs: g.thinDiscs, cards: g.cards, side: [g.side, phone.side], errors: [real(errors), phone.errors] });
      server.close();
    });

    // ── C110 to C112 Submersibles send window, Setup and recommendations, Map chain (W35, Rev4.7) ──
    const SEA_FC = "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 3, discovered: [1, 2, 3, 10, 15] }; sec.fcs.fb = { name: 'Bravo Company', world: 'Maduin', order: 1, unlockedSlots: 1, discovered: [1] };";
    await guard('C110', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage(); const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      // an idle submarine (its suggestion and the other routes are worked out at its own rank) and one that is Back (for Enter)
      await tlSeed(page, SEA_FC + "sec.subs.i1 = { fcId: 'fa', slot: 1, name: 'Sub I1', rank: 60, parts: [3, 4, 1, 2] }; sec.subs.a1 = { fcId: 'fa', slot: 2, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };");
      await page.reload(); await ready(); await page.waitForSelector('.sub[data-sub="i1"]');
      await page.click('.sub[data-sub="i1"] .sub-top'); await page.waitForSelector('#sheet[open] .cmp');
      const g = await page.evaluate(() => {
        const st = ADVISOR.stats(60, [3, 4, 1, 2]), secs = (ids) => ADVISOR.evalRoute(ids, st).seconds, ids = (t) => String(t).split(',').map(Number);
        const cmp = document.querySelector('#sheet .cmp'), ax = cmp.querySelector('.tl-axis'), span = +cmp.dataset.span;
        const lanes = [{ kind: 'pick', ids: ids(document.querySelector('#sheet [data-act=quick]').dataset.route), el: cmp.querySelector('.cmp-lane') }].concat([...document.querySelectorAll('#sheet .alts li')].map((li) => ({ kind: 'alt', ids: ids(li.querySelector('[data-use]').dataset.use), el: li.querySelector('.cmp-lane') })));
        const rows = lanes.map((l) => { const r = l.el.getBoundingClientRect(), e = l.el.querySelector('.tl-end').getBoundingClientRect(), want = secs(l.ids) / 3600 / span; return { kind: l.kind, want: +want.toFixed(4), ret: +l.el.style.getPropertyValue('--ret'), share: +((e.left + e.width / 2 - r.left) / r.width).toFixed(4), left: Math.round(r.left), right: Math.round(r.right), discs: l.el.querySelectorAll('.disc').length, ghost: l.el.classList.contains('ghost') }; });
        const need = Math.max(...lanes.map((l) => secs(l.ids))) / 3600, wantSpan = [12, 24, 48, 72, 96].find((x) => x >= need) || 96, axr = ax.getBoundingClientRect();
        const first = document.querySelector('#sheet .btn.primary');
        return { span, wantSpan, spanAttr: ax.dataset.span, ticks: [...ax.querySelectorAll('i')].map((i) => i.textContent), aria: ax.getAttribute('aria-hidden'), axes: document.querySelectorAll('#sheet .tl-axis').length, rows, axisL: Math.round(axr.left), axisR: Math.round(axr.right), firstPrimary: first && first.dataset.act, step: !!document.querySelector('#sheet .advice-step'), hint: !!document.querySelector('#sheet .advice .hint'), tags: document.querySelectorAll('#sheet .advice .tag.src').length, altKinds: document.querySelectorAll('#sheet .alts [data-alt-kind], #sheet .alts [data-alt-figure]').length, open: document.querySelector('#sheet .cmp + details').open, side: document.documentElement.scrollWidth - innerWidth };
      });
      await page.keyboard.press('Escape');
      // Enter in a field of the window presses the first primary button: the Back submarine goes out on the suggested route
      await page.click('.sub[data-sub="a1"] .sub-top'); await page.waitForSelector('#sheet[open] .cmp');
      const want = await page.$eval('#sheet [data-act=quick]', (b) => b.dataset.route);
      const first = await page.$eval('#sheet .btn.primary', (b) => b.dataset.act);
      await page.focus('#sheet input[data-reveal-none]'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('#sheet[open]'), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(async (id) => { const r = await CC.read(); const sub = (CC.checkDoc(r.raw).modules.submersibles || {}).subs; return sub && sub[id] && sub[id].voyage ? sub[id].voyage.route.join(',') : null; }, 'a1').catch(() => null);
      await ctx.close();
      const near = (a, b, t) => Math.abs(a - b) <= t;
      const ok = g.span === g.wantSpan && g.spanAttr === String(g.span) && JSON.stringify(g.ticks) === JSON.stringify(['now', '+' + g.span / 4 + ' h', '+' + g.span / 2 + ' h', '+' + g.span * 3 / 4 + ' h', '+' + g.span + ' h']) && g.aria === 'true' && g.axes === 1 && g.rows.length >= 2 && g.rows.every((r) => r.ghost && r.discs >= 1 && near(r.ret, r.want, 0.001) && near(r.share, r.want, 0.01) && r.left === g.rows[0].left && r.right === g.rows[0].right) && g.axisL === g.rows[0].left && g.axisR === g.rows[0].right &&
        g.firstPrimary === 'dosend' && g.step && g.hint && g.tags >= 2 && g.open && g.side <= 0 && first === 'dosend' && after === want && real(errors).length === 0;
      record('C110', 'Send window (W35): the suggestion and the other routes are lanes on one shared axis (the Board\'s axis, five ticks, the span the rule gives): each lane\'s marker stands at its voyage length over the shared span within 0.01, all lanes and the axis have the same edges, each lane has its discs; the first primary button is the suggestion\'s, and Enter in a field of the window presses it', ok, { g, first, want, after, errors: real(errors) });
      server.close();
    });
    await guard('C111', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage(); const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await tlSeed(page, SEA_FC + "sec.fcs.fc = { name: 'Cedar Company', world: 'Maduin', order: 2, unlockedSlots: 1, discovered: [1] }; sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };");
      await page.reload(); await ready(); await page.click('[data-tab=setup]'); await page.waitForSelector('[data-recs-panel]'); await page.waitForTimeout(300);
      const read = () => page.evaluate(() => {
        const st = (sel) => { const e = document.querySelector(sel); return e ? e.textContent : null; };
        const rungs = [1, 2, 3, 4].map((n) => { const li = document.querySelector('.rec-rank .rung-' + n), b = li && li.querySelector('.rec-name b'); return li ? { h: Math.round(li.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width), fs: parseFloat(getComputedStyle(b).fontSize) } : null; });
        const first = (document.querySelector('.rec-rank li .rec-name') || {}).textContent || '';
        return {
          fcHead: st('.panel:not(.recs):not([data-shown-panel]) > .head-state'), fcHeadW: Math.round(document.querySelector('.panel:not(.recs):not([data-shown-panel]) > .head-state').getBoundingClientRect().width), recHeadW: Math.round(document.querySelector('[data-recs-body] > .head-state:first-child').getBoundingClientRect().width), fcCount: document.querySelectorAll('.fc-list > li').length, fcSays: (document.querySelector('.fc-list').closest('.panel').querySelector('.muted') || {}).textContent.split(' ')[0],
          shownHead: st('[data-shown-panel] > .head-state'), shownSays: st('[data-shown-count]'),
          recHead: st('[data-recs-body] > .head-state:first-child'), recFirst: first.replace(/^\d+\.\s*/, '').trim(), fuel: document.querySelector('[data-rec=fuel]').checked, rungs,
          aria: [...document.querySelectorAll('.head-state')].map((e) => e.getAttribute('aria-hidden')).join(), n: document.querySelectorAll('.head-state').length,
          wash: [...document.querySelectorAll('.rec-rank li[class^="rung-"]')].map((l) => getComputedStyle(l).backgroundColor), nums: [...document.querySelectorAll('.rec-rank li .rec-name b')].map((b) => getComputedStyle(b).backgroundColor)
        };
      });
      const a = await read();
      await page.uncheck('[data-shown-fc=fb]'); await page.waitForTimeout(700); await page.waitForSelector('[data-shown-panel]');
      const b = await read();
      await page.uncheck('[data-shown-fc=fc]'); await page.waitForTimeout(700);
      const b2 = await read();
      // the recommendations head follows a change of order and of fuel without a reload: Unlocking down puts Leveling first, then fuel on adds its words
      await page.click('[data-rec="down-unlock"]'); await page.waitForTimeout(500);
      const c = await read();
      await page.check('[data-rec=fuel]'); await page.waitForTimeout(500);
      const d = await read();
      await page.click('[data-rec="order-default"]'); await page.waitForTimeout(500);
      const e = await read();
      // W-a: the head also says the loot count: none, then one item, then two (the second picker switched on)
      const opts = await page.$$eval('[data-rec="loot-1"] option', (os) => os.map((o) => o.value).filter((v) => v !== '0'));
      await page.selectOption('[data-rec="loot-0"]', opts[0]); await page.waitForTimeout(500);
      const f = await read();
      await page.check('[data-rec="loot-on-1"]'); await page.selectOption('[data-rec="loot-1"]', opts[1]); await page.waitForTimeout(500);
      const g = await read();
      // the head state beside or under its head at 1,440 and at 701 px: it never covers the head's text
      const overlap = async () => page.evaluate(() => [...document.querySelectorAll('.head-state')].map((hs) => {
        const h2 = hs.closest('.panel').querySelector('h2'), range = document.createRange(); range.selectNodeContents(h2);
        const rs = [...range.getClientRects()].filter((r) => r.width > 2), q = hs.getBoundingClientRect(), pos = getComputedStyle(hs).position;
        const hit = pos === 'absolute' && rs.some((r) => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top);
        return { pos, hit, w: Math.round(q.width), inside: q.right <= h2.closest('.panel').getBoundingClientRect().right + 1 };
      }));
      await page.$eval('[data-shown-panel]', (el) => el.scrollIntoView());
      const ov1440 = await overlap();
      await page.setViewportSize({ width: 701, height: 900 }); await page.waitForTimeout(300);
      const ov701 = await overlap();
      await page.setViewportSize({ width: 360, height: 800 }); await page.waitForTimeout(300);
      const ov360 = await overlap(), side360 = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      await ctx.close();
      const down = a.rungs.every((r) => r.h >= 76 && r.h === a.rungs[0].h) && a.rungs.map((r) => r.w).join() === '72,72,72,72' && a.rungs.map((r) => r.fs).join() === '44,38,32,28'; // visual fix M9: every rung as tall as the tallest and every badge as wide (was: heights stepping down, widths 72,64,56,52)
      const ok = a.n === 3 && a.aria === 'true,true,true' && a.fcHead === '3 companies, 1 submarine' && +a.fcSays === a.fcCount && a.fcCount === 3 && a.shownHead === 'All shown' && a.shownSays === 'All shown.' && b.shownHead === '1 hidden' && b.shownSays === '1 hidden from the Board.' && b2.shownHead === '2 hidden' && b2.shownSays === '2 hidden from the Board.' &&
        a.recHead === 'First: ' + a.recFirst + ' · Fuel: off · Loot: none' && !a.fuel && a.recFirst === 'Unlocking Routes' && c.recHead === 'First: ' + c.recFirst + ' · Fuel: off · Loot: none' && c.recFirst !== a.recFirst && d.fuel && d.recHead === 'First: ' + d.recFirst + ' · Fuel: on, 15% · Loot: none' && e.recHead === 'First: ' + e.recFirst + ' · Fuel: on, 15% · Loot: none' && e.recFirst === 'Unlocking Routes' &&
        f.recHead === 'First: ' + f.recFirst + ' · Fuel: on, 15% · Loot: 1 item' && g.recHead === 'First: ' + g.recFirst + ' · Fuel: on, 15% · Loot: 2 items' &&
        down && new Set(a.wash).size === 4 && new Set(a.nums).size === 4 && ov1440.every((o) => !o.hit && o.inside) && ov701.every((o) => !o.hit && o.inside) && ov360.every((o) => o.pos !== 'absolute' && o.inside) && side360 <= 0 && real(errors).length === 0;
      record('C111', 'Setup heads (W35, fix list W-a): "Free companies" says "N companies, M submarines" (the list under it has N companies), "Free companies on the Board" says "All shown" or "N hidden" as its own line does, and the recommendations head says "First: LABEL · Fuel: off" or "Fuel: on, 15%" and "Loot: none", "1 item" or "N items", and follows a change of order, of fuel and of the loot pickers without a reload; the four rungs step down in height (76, 68, 60, 56 at least; number blocks 72, 64, 56, 52 px with figures 44, 38, 32, 28) on four different washes with four different number fields; the head state never covers its head at 1,440 or 701 px and is a plain line at 360 px with no sideways scroll', ok, { a, b, b2, c, d, e, f, g, ov1440, ov701, ov360, side360, errors: real(errors) });
      server.close();
    });
    await guard('C112', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage(); const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await tlSeed(page, SEA_FC + "sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };");
      await page.reload(); await ready(); await page.click('[data-tab=map]'); await page.waitForSelector('.chart-svg');
      const chain = (pg) => pg.evaluate(() => {
        const bs = [...document.querySelectorAll('[data-map-sea]')], links = [...document.querySelectorAll('.map-seas .sea-link')], box = document.querySelector('.map-seas').getBoundingClientRect();
        const cs = getComputedStyle(document.querySelector('.map-seas'));
        return { n: bs.length, flex: cs.flexDirection, disp: cs.display, tops: [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))].length, rows: bs.map((b) => { const t = b.textContent, m = /^(.+?) found (\d+) of (\d+)$/.exec(t.trim()); return { name: m && m[1], n: m && +m[2], of: m && +m[3], closed: b.classList.contains('closed'), pressed: b.getAttribute('aria-pressed'), h: Math.round(b.getBoundingClientRect().height), clip: getComputedStyle(b).clipPath, tabindex: b.getAttribute('tabindex') }; }),
          links: links.map((l) => ({ t: l.textContent.trim(), disc: (l.querySelector('.disc') || {}).textContent, aria: (l.querySelector('.discs') || {}).getAttribute && l.querySelector('.discs').getAttribute('aria-hidden'), tab: l.tabIndex, vis: l.querySelector('.sea-link-t').getBoundingClientRect().width > 20 })), kids: [...document.querySelector('.map-seas').children].map((c) => c.tagName.toLowerCase() + (c.classList.contains('sea-link') ? '.l' : '')).join(' '), side: document.documentElement.scrollWidth - innerWidth, boxW: Math.round(box.width) };
      });
      const wide = await chain(page);
      await page.selectOption('#map-fc', 'fb'); await page.waitForTimeout(300);
      const fb = await chain(page);
      await page.selectOption('#map-fc', 'fa');
      await page.click('[data-map-sea="2"]'); await page.waitForTimeout(250);
      const pressedClosed = await page.evaluate(() => { const b = document.querySelector('[data-map-sea="2"]'); return { cls: b.className, pressed: b.getAttribute('aria-pressed'), text: b.textContent.trim() }; });
      await page.click('[data-map-sea="1"]');
      // keyboard: a sea button shows a focus outline
      await page.focus('[data-map-sea="3"]'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => { const a = document.activeElement, c = getComputedStyle(a); return { sea: a.dataset.mapSea, w: parseFloat(c.outlineWidth), s: c.outlineStyle }; });
      await ctx.close();
      const ph = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const pp = await ph.ctx.newPage(); await pp.goto(ROOT5 + 'submersibles/'); await pp.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await tlSeed(pp, SEA_FC + "sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };");
      await pp.reload(); await pp.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); await pp.click('[data-tab=map]'); await pp.waitForSelector('.chart-svg');
      const ph1 = await chain(pp);
      await ph.ctx.close();
      const exactly = (c) => c.rows.every((r) => r.closed === (r.n === 0)) && c.rows.every((r) => r.name && r.of > 0 && r.tabindex === null && r.clip === 'none');
      const ok = wide.n === 7 && exactly(wide) && wide.rows.map((r) => r.closed).join() === 'false,true,true,true,true,true,true' && wide.rows.map((r) => r.n).join() === '5,0,0,0,0,0,0' && exactly(fb) && fb.rows.map((r) => r.closed).join() === 'false,true,true,true,true,true,true' && fb.rows[0].n === 1 &&
        wide.flex === 'row' && wide.tops === 1 && wide.links.length === 6 && wide.links.every((l, i) => new RegExp('^.+ opens ' + wide.rows[i + 1].name + '$').test(l.t) && l.disc && l.aria === 'true' && l.tab === -1 && !l.vis) && wide.kids === 'button span.l button span.l button span.l button span.l button span.l button span.l button' && wide.side <= 0 &&
        pressedClosed.cls.includes('closed') && pressedClosed.pressed === 'true' && /^Sea of Ash found 0 of 20$/.test(pressedClosed.text) && focus.sea === '3' && focus.w >= 2 && focus.s !== 'none' &&
        ph1.n === 7 && ph1.disp === 'flex' && ph1.tops === 1 && exactly(ph1) && ph1.rows.every((r) => r.h >= 44) && ph1.links.filter((l) => l.vis).length === 0 && ph1.side <= 0 && real(errors).length === 0 && real(ph.errors).length === 0;
      record('C112', 'Map chain (W35): a sea button is "closed" exactly when nothing is found there (seven buttons, each still "NAME found n of m", none focusable except as a button, no clip-path); the seas stand in one row at 1,440 px joined by six links, each a disc of the sector that opens the next sea with the words "SECTOR opens SEA"; the chosen sea can be closed and stays chosen; a sea button shows a focus outline; at 360 px the chain is one row that scrolls sideways inside its own strip (S7: no sideways page scroll, every button 44 px or more, no caption shown)', ok, { wide, fb, pressedClosed, focus, ph1, errors: real(errors) });
      server.close();
    });

    // ── C113 (fix list F1) The market-price fetch no longer loops: with the price host blocked, and separately with one item the
    //    service leaves out and answers 404 for on its own, over five seconds on Earnings and on the Log there are at most two
    //    fetch attempts and three redraws; a failure says so in plain words; focus on the price-place picker survives;
    //    Refresh makes exactly one more attempt. The module is served from this test site; the price service is a stand-in.
    await guard('C113', async () => {
      const server = await start(PORT5);
      const SEED = FCS('fa', 'Alpha Company', 0, 2) + "sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] }; sec.trips.t1 = { s: 'a1', t: now - 40 * H, r: [1, 2], back: now - 10 * H, items: [[2, 3], [3, 1], [4, 2], [10099, 5]], newSectors: [] };";
      const MSG = 'Market prices could not be fetched; showing merchant prices.', MSG2 = 'Market prices could not be fetched; showing the last known market prices (fetched ';
      const run = async (mode, tab) => {
        const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
        const page = await ctx.newPage(); let attempts = 0; const asked = [];
        const cors = { 'access-control-allow-origin': '*' };
        await page.route('https://universalis.app/**', (r) => {
          attempts++;
          const ids = new URL(r.request().url()).pathname.split('/').pop().split(','); asked.push(ids.join(','));
          if (mode === 'blocked' || mode === 'stale-blocked') return r.abort('failed');
          if (ids.length === 1 && ids[0] === '4') return r.fulfill({ status: 404, contentType: 'application/json', headers: cors, body: '{}' });
          const items = {}; ids.filter((id) => id !== '4').forEach((id) => { items[id] = { itemID: +id, averagePrice: 2000 }; });
          r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(ids.length === 1 ? items[ids[0]] : { items }) });
        });
        const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
        await page.goto(ROOT5 + 'submersibles/'); await ready();
        await tlSeed(page, SEED);
        // single-404: a cache seeded with every price but item 4's (and no "no market price" record), so the only item asked for is item 4, alone, and the service answers 404 for it
        // (in one-404 the item is left out of the batch reply and is recorded from that, so its own request never happens). The cache has no per-item times: an older cache.
        if (mode === 'stale-blocked') await page.evaluate(() => localStorage.setItem('eveniunt-subs-prices', JSON.stringify({ scope: 'Maduin', at: Date.now() - 7200000, prices: { 2: 2000, 3: 2000, 10099: 2000 }, none: {} }))); // E1: old market prices, the fetch fails
        if (mode === 'single-404') await page.evaluate(() => localStorage.setItem('eveniunt-subs-prices', JSON.stringify({ scope: 'Maduin', at: Date.now(), prices: { 2: 2000, 3: 2000, 10099: 2000 }, none: {} })));
        await page.reload(); await ready();
        await page.evaluate(() => { window.__redraws = 0; new MutationObserver((m) => { window.__redraws += m.length; }).observe(document.querySelector('#view'), { childList: true }); });
        attempts = 0;
        await page.click('[data-tab=' + tab + ']'); await page.waitForSelector(tab === 'earn' ? '.earn-cards' : '.log-list');
        if (tab === 'earn') await page.evaluate(() => document.querySelector('[data-pref=priceWorld]').focus());
        await page.waitForTimeout(5000);
        const got = await page.evaluate(() => ({ text: document.querySelector('#view').textContent, focus: (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.pref) || null, redraws: window.__redraws }));
        const cacheNone = await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('eveniunt-subs-prices') || 'null'); return c && c.none ? Object.keys(c.none) : null; });
        const out = { mode, tab, attempts, asked: asked.slice(), cacheNone, redraws: got.redraws, message: got.text.includes(MSG), message2: got.text.includes(MSG2) && got.text.includes(') and merchant prices for the rest.'), seen: /prices seen/.test(got.text), focus: got.focus, extra: null };
        if (tab === 'earn') { const before = attempts; await page.evaluate(() => document.querySelector('[data-act=prices]').click()); await page.waitForTimeout(1500); out.extra = attempts - before; }
        // E2: after a failed attempt a page reload inside the 15 minutes makes no automatic attempt (the record is kept on the device); Refresh still makes exactly one
        if (tab === 'earn' && mode === 'blocked') {
          attempts = 0; await page.reload(); await ready(); await page.click('[data-tab=earn]'); await page.waitForSelector('.earn-cards'); await page.waitForTimeout(2500);
          out.reloadAttempts = attempts; const b2 = attempts; await page.evaluate(() => document.querySelector('[data-act=prices]').click()); await page.waitForTimeout(1500); out.reloadRefresh = attempts - b2;
        }
        out.errors = real(errors);
        await ctx.close();
        return out;
      };
      const rows = [];
      for (const mode of ['blocked', 'stale-blocked', 'one-404', 'single-404']) for (const tab of ['earn', 'log']) rows.push(await run(mode, tab));
      const ok = rows.every((r) => r.attempts <= 2 && r.redraws <= 3 && r.errors.length === 0 && (r.tab === 'log' || (r.focus === 'priceWorld' && r.extra === 1))) &&
        rows.filter((r) => r.mode === 'blocked').every((r) => r.message && !r.message2 && !r.seen && (r.tab !== 'earn' || (r.reloadAttempts === 0 && r.reloadRefresh === 1))) &&
        rows.filter((r) => r.mode === 'stale-blocked').every((r) => r.message2 && !r.message) && // E1: an old market price is kept, so the message says so
        rows.filter((r) => r.mode === 'one-404' || r.mode === 'single-404').every((r) => !r.message && !r.message2 && (r.tab === 'log' || r.seen)) &&
        rows.filter((r) => r.mode === 'single-404').every((r) => r.attempts === 1 && JSON.stringify(r.asked) === '["4"]' && JSON.stringify(r.cacheNone) === '["4"]'); // the single-item 404 branch is reached: item 4 alone was asked, answered 404 and is only "no market price"
      record('C113', 'Market prices do not loop (fix list F1): with the price host blocked, and with one item the service leaves out and answers 404 for on its own, over five seconds on Earnings and on the Log there are at most two fetch attempts and three redraws; a failed fetch says "' + MSG + '" and shows no "prices seen" time, a 404 for one item is only "no market price" (no message; the real fetch is timed); in a third mode a seeded cache leaves item 4 as the only item asked for, on its own, and its 404 is recorded as "no market price" with no message (K3.7); focus stays on the price-place picker; Refresh makes exactly one more attempt', ok, { rows });
      server.close();
    });

    // ── C117 (fix list K3.2) A Refresh or a change of price place made while a price fetch is running is not dropped: exactly one follow-up fetch,
    //    for the latest request, runs when the running one ends; the answer for a place that is no longer chosen is not shown. ──
    await guard('C117', async () => {
      const server = await start(PORT5);
      const SEED = FCS('fa', 'Alpha Company', 0, 2) + "sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] }; sec.trips.t1 = { s: 'a1', t: now - 40 * H, r: [1, 2], back: now - 10 * H, items: [[2, 3], [3, 1], [10099, 5]], newSectors: [] };";
      const run = async (kind) => {
        const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
        const page = await ctx.newPage(), asked = [];
        await page.route('https://universalis.app/**', async (r) => {
          const u = new URL(r.request().url()), scope = decodeURIComponent(u.pathname.split('/')[3]), ids = u.pathname.split('/').pop().split(',');
          asked.push(scope);
          await new Promise((ok) => setTimeout(ok, asked.length === 1 ? 2000 : 800)); // the first fetch is slow, so the later requests arrive while it runs
          const items = {}; ids.forEach((id) => { items[id] = { itemID: +id, averagePrice: scope === 'Crystal' ? 3000 : 2000 }; });
          r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items }) });
        });
        const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
        await page.goto(ROOT5 + 'submersibles/'); await ready();
        await tlSeed(page, SEED); await page.reload(); await ready();
        await page.evaluate(() => { window.__sawFirst = false; new MutationObserver(() => { if (/Maduin, prices seen/.test(document.querySelector('#view').textContent)) window.__sawFirst = true; }).observe(document.querySelector('#view'), { childList: true, subtree: true, characterData: true }); });
        await page.click('[data-tab=earn]'); await page.waitForSelector('.earn-cards');
        await page.waitForTimeout(400);
        const first = asked.slice();
        if (kind === 'refresh') { await page.click('[data-act=prices]'); await page.click('[data-act=prices]'); }
        else { await page.selectOption('[data-pref=priceWorld]', 'Aether'); await page.waitForTimeout(100); await page.selectOption('[data-pref=priceWorld]', 'Crystal'); await page.waitForTimeout(100); await page.click('[data-act=prices]'); }
        const during = asked.length;
        await page.waitForFunction((k) => new RegExp((k === 'refresh' ? 'Maduin' : 'Crystal') + ', prices seen').test(document.querySelector('#view').textContent), kind, { timeout: 15000 });
        await page.waitForTimeout(2500);
        const text = await page.evaluate(() => document.querySelector('#view').textContent), sawFirst = await page.evaluate(() => window.__sawFirst), settled = asked.slice();
        await ctx.close();
        return { kind, first, during, settled, sawFirst, seenText: (/Universalis, [A-Za-z-]+, prices seen/.exec(text) || [''])[0], errors: real(errors) };
      };
      const A = await run('refresh'), B = await run('place');
      const ok = JSON.stringify(A.first) === '["Maduin"]' && A.during === 1 && JSON.stringify(A.settled) === '["Maduin","Maduin"]' && A.errors.length === 0 &&
        JSON.stringify(B.first) === '["Maduin"]' && B.during === 1 && JSON.stringify(B.settled) === '["Maduin","Crystal"]' && /^Universalis, Crystal,/.test(B.seenText) && B.sawFirst === false && B.errors.length === 0;
      record('C117', 'A Refresh or a change of price place during a running price fetch is not dropped (fix list K3.2): with the first fetch slow, two presses of Refresh make exactly one follow-up fetch of the same place after it ends; a change to two other places and a Refresh make exactly one follow-up, for the place chosen last, and the page never shows the first place\'s answer as the prices seen', ok, { A, B });
      server.close();
    });

    // ── C118 (fix list K3.8) The Board's one-second tick only moves countdown text and time-line positions: it does not build the advice keys of the
    //    Back and Idle submarines again (that work is done when a drawing is made or a submarine's state changes). Over four seconds with six Back or Idle
    //    submarines the advisor's key function is not called by the ticks, and a submarine coming back still redraws the Board. ──
    await guard('C118', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage();
      const IDLE = (id, fc, slot) => "sec.subs['" + id + "'] = { fcId: '" + fc + "', slot: " + slot + ", name: '" + id + "', rank: 50, parts: [3, 4, 1, 2] };";
      const BACK = (id, fc, slot) => "sec.subs['" + id + "'] = { fcId: '" + fc + "', slot: " + slot + ", name: '" + id + "', rank: 50, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };";
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await tlSeed(page, FCS('fa', 'Alpha Company', 0, 4) + FCS('fb', 'Bravo Company', 1, 4) + OUT('o1', 'fa', 1, 'Sub O1', '6 * H') + BACK('b1', 'fa', 2) + BACK('b2', 'fa', 3) + IDLE('i1', 'fa', 4) + BACK('b3', 'fb', 1) + IDLE('i2', 'fb', 2) +
        "sec.subs.o2 = { fcId: 'fb', slot: 3, name: 'Sub O2', rank: 50, parts: [3, 4, 1, 2], voyage: { sentAt: now - 3600000, route: [1, 2], returnAt: now + 12000 } };");
      await page.reload(); await ready(); await page.waitForSelector('.tl.out');
      const m = await page.evaluate(async () => {
        let n = 0; const orig = window.RECS.sig; window.RECS.sig = function () { n++; return orig.apply(this, arguments); };
        await new Promise((ok) => setTimeout(ok, 4200)); // four ticks, no change of any submarine's state
        return { sigCalls: n, shown: document.querySelectorAll('.fc .sub').length };
      });
      // the submarine due in twelve seconds comes back: its lane becomes Back (a redraw)
      await page.waitForFunction(() => document.querySelectorAll('.fc .sub[data-status="back"]').length >= 4, null, { timeout: 20000 });
      await ctx.close();
      record('C118', 'The Board tick does only clock work (fix list K3.8): over four seconds with six Back or Idle submarines the advisor\'s key function is not called by the ticks (' + m.sigCalls + ' calls), and a submarine coming back still redraws the Board', m.sigCalls === 0 && m.shown >= 8 && errors.filter((e) => !/net::ERR|Failed to load/.test(e)).length === 0, { m, errors });
      server.close();
    });

    // ── C114 (fix list W-b) Setup with no free company has an empty state in the module's pattern: kicker, headline, one sentence and the
    //    guided-setup action (which opens it); the other Setup panels stay; at 360 px nothing scrolls sideways and the headline fits.
    await guard('C114', async () => {
      const server = await start(PORT5);
      const walk = async (opts, press) => {
        const { ctx, errors } = await context(opts), page = await ctx.newPage(), out = {};
        await page.goto(ROOT5 + 'submersibles/'); await page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
        await page.click('[data-tab=setup]'); await page.waitForSelector('[data-empty="setup-none"]');
        out.state = await page.evaluate(() => {
          const el = document.querySelector('[data-empty="setup-none"]'), h = el.querySelector('h2'), a = el.querySelector('.es-act .btn');
          return { kick: el.querySelector('.es-kick').textContent, h: h.textContent, hFits: h.scrollWidth <= h.clientWidth + 1, text: el.querySelector('.es-text').textContent, act: a.textContent, hook: a.getAttribute('data-act'), actH: Math.round(a.getBoundingClientRect().height),
            scope: el.querySelector('.es-scope').getAttribute('aria-hidden'), word: el.querySelector('.es-word').textContent, fcList: !!document.querySelector('.fc-list'), recs: !!document.querySelector('[data-recs-panel]'), size: !!document.querySelector('.panel.size'),
            panelOld: [...document.querySelectorAll('h2')].some((x) => x.textContent === 'Free companies'), side: document.documentElement.scrollWidth - innerWidth };
        });
        if (press) { await page.click('[data-empty="setup-none"] [data-act=new]'); await page.waitForSelector('.wiz-head'); out.wizard = true; await page.click('[data-act=wcancel]'); await page.waitForSelector('[data-empty="setup-none"]'); out.back = true; }
        out.errors = real(errors); await ctx.close(); return out;
      };
      const d = await walk({ viewport: { width: 1440, height: 1000 } }, true), p = await walk({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, false);
      const good = (x) => x.state.kick === 'No free company yet' && x.state.h === 'Set up your first free company' && x.state.text.length > 20 && x.state.act === 'Start the setup' && x.state.hook === 'new' && x.state.actH >= 36 && x.state.scope === 'true' && x.state.word === 'Setup' && !x.state.fcList && !x.state.panelOld && x.state.recs && x.state.size && x.state.side <= 0 && x.state.hFits && !x.errors.length;
      record('C114', 'Setup with no free company (fix list W-b): an empty state in the module\'s pattern (kicker "No free company yet", headline "Set up your first free company", one sentence, the action "Start the setup" that opens the guided setup and Cancel comes back), the other Setup panels still there, no sideways scroll and a headline that fits at 360 px', good(d) && d.wizard && d.back && good(p), { desktop: d, phone: p });
      server.close();
    });
    // ── C115 (fix list W-c, W-d, W-e) the Earnings tallies are blocks distinct from their panel in a light and a dark scheme (the block against the panel at least 1.4:1, its
    //    figures and labels at least 7:1 on it); a closed sea on the phone Map is hatched with 1 px lines (the name stays readable); the dense Board's action button shows the verb and
    //    the return time only (no route, no ellipsis, nothing half cut) while its accessible name is the full text with the route
    await guard('C115', async () => {
      const server = await start(PORT5);
      const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const rt = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const seedTrips = "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 1, discovered: [1, 2, 3] }; sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] }; sec.trips.t1 = { s: 'a1', t: now - 40 * H, r: [1, 2], back: now - 10 * H, items: [[10099, 5]], newSectors: [] };";
      const tallies = {};
      for (const scheme of ['light', 'dark']) {
        const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme }), page = await ctx.newPage();
        await page.route('https://universalis.app/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ averagePrice: 100, items: { 10099: { averagePrice: 100 } } }) }));
        await page.goto(ROOT5 + 'submersibles/'); await ready(page); await tlSeed(page, seedTrips); await page.reload(); await ready(page);
        await page.click('[data-tab=earn]'); await page.waitForSelector('.earn-card');
        tallies[scheme] = await page.evaluate(() => {
          const rgb = (e, p) => (getComputedStyle(e)[p].match(/[\d.]+/g) || []).slice(0, 3).map(Number), panel = document.querySelector('.earn-cards').closest('.panel');
          return { panel: rgb(panel, 'backgroundColor'), cards: [...document.querySelectorAll('.earn-card')].map((c, i) => ({ i, bg: rgb(c, 'backgroundColor'), fig: rgb(c.querySelector('b'), 'color'), label: rgb(c.querySelector('span'), 'color') })) };
        });
        tallies[scheme].errors = real(errors); await ctx.close();
      }
      const tallyOk = (t) => t.cards.length === 4 && t.cards.slice(1).every((c) => rt(c.bg, t.panel) >= 1.4 && rt(c.fig, c.bg) >= 7 && rt(c.label, c.bg) >= 7);
      const ratios = Object.fromEntries(Object.entries(tallies).map(([k, t]) => [k, t.cards.slice(1).map((c) => +rt(c.bg, t.panel).toFixed(2))]));
      // the phone Map: a closed sea's hatch
      const ph = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pp = await ph.ctx.newPage();
      await pp.goto(ROOT5 + 'submersibles/'); await ready(pp); await tlSeed(pp, SEA_FC + "sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };");
      await pp.reload(); await ready(pp); await pp.click('[data-tab=map]'); await pp.waitForSelector('.map-seas .closed');
      const hatch = await pp.evaluate(() => { const b = document.querySelector('.map-seas .closed:not([aria-pressed="true"])'), bi = getComputedStyle(b).backgroundImage; return { image: bi.slice(0, 160), px: (bi.match(/\b1px\b/g) || []).length, wide: /\b[2-9]px\b/.test(bi.replace(/rgba?\([^)]*\)/g, '')), color: getComputedStyle(b).color }; });
      await ph.ctx.close();
      // the dense Board (8 free companies of 4 subs at 1920 x 1080, as C25)
      const { ctx, errors } = await context({ viewport: { width: 1920, height: 1080 } }), page = await ctx.newPage();
      await page.goto(ROOT5 + 'submersibles/'); await ready(page);
      await page.evaluate(async () => {
        const now = Date.now(), sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        ['Alpha', 'Bravo', 'Cedar', 'Delta', 'Ember', 'Fable', 'Garnet', 'Harbor'].forEach((n, i) => {
          sec.fcs['f' + i] = { name: n + ' Company', world: 'Maduin', order: i, unlockedSlots: i === 7 ? 3 : 4, discovered: [1, 2, 3] };
          for (let s = 1; s <= 4; s++) { const kind = (i + s) % 3, ret = kind === 0 ? now + (i * 4 + s) * 600000 : kind === 1 ? now - 600000 : null; sec.subs['s' + i + s] = { fcId: 'f' + i, slot: s, name: 'Sub ' + n[0] + s, rank: 60 + s, parts: [3, 4, 1, 2], voyage: ret ? { sentAt: now - 3600000, route: [1, 2], returnAt: ret, gameSaid: '1h' } : null }; }
        });
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      await page.reload(); await ready(page); await page.waitForSelector('.sub .quick');
      const dense = await page.evaluate(() => {
        const out = [], bottom = Math.max(...[...document.querySelectorAll('.fc .sub[data-status]')].map((el) => el.getBoundingClientRect().bottom));
        document.querySelectorAll('.sub .quick').forEach((b) => {
          const q = b.getBoundingClientRect(), t = b.querySelector('.q-t').getBoundingClientRect(), v = b.querySelector('.q-v').getBoundingClientRect(), r = getComputedStyle(b.querySelector('.q-r')).display;
          const timeShown = t.top >= q.top - 1 && t.bottom <= q.bottom + 1 && t.right <= q.right + 1 && t.left >= q.left - 1, timeCut = !timeShown && t.top < q.bottom && t.bottom > q.top && t.right > q.left && t.left < q.right;
          out.push({ visible: b.innerText.trim().slice(0, 40), full: b.getAttribute('aria-label'), text: b.textContent, route: r, verbFits: v.right <= q.right + 1, timeShown, timeCut, ellipsis: getComputedStyle(b).textOverflow, h: Math.round(q.height) });
        });
        return { n: out.length, shown: out.filter((x) => x.timeShown).length, rows: out.slice(0, 3), bottom: Math.round(bottom), bad: out.filter((x) => x.route !== 'none' || !x.verbFits || x.timeCut || x.ellipsis !== 'clip' || !/^Send ▸ .+ · back .+$/.test(x.full) || x.full !== x.text || x.h !== 26).length };
      });
      await ctx.close();
      const ok = tallyOk(tallies.light) && tallyOk(tallies.dark) && !tallies.light.errors.length && !tallies.dark.errors.length &&
        hatch.px >= 1 && !hatch.wide && dense.n >= 20 && dense.bad === 0 && dense.bottom <= 1080 && real(errors).length === 0 && real(ph.errors).length === 0;
      record('C115', 'Earnings tallies, the closed-sea hatch and the dense Board button (fix list W-c, W-d, W-e): in a light and a dark scheme each of the three plain tallies is a block at least 1.4:1 from its panel with figure and label at least 7:1 on it; a closed sea on the phone Map is hatched with 1 px lines; at 1920 x 1080 every dense action button is 26 px high, shows no route and no ellipsis, never a half-cut time, and its accessible name is "Send ▸ route · back time" in full, the page still ends at 1080 px', ok, { ratios, light: tallies.light.cards.map((c) => c.bg), hatch, dense, errors: [real(errors), real(ph.errors)] });
      server.close();
    });

    // ── C116 (fix list K1) Saving the Setup sector list never undoes a discovery made elsewhere while the form was open: another tab saves a
    //    newer list; the open form shows it ticked (focus and scroll unmoved) and Save writes the union minus what the player unticked; Clear every
    //    sector in a sea removes only what was ticked there; a slot unlocked elsewhere and a rank or voyage changed elsewhere survive an untouched form. ──
    await guard('C116', async () => {
      const server = await start(PORT5);
      const SEC = (extra) => "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 1, discovered: [1, 2, 3" + (extra || '') + "] }; sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };";
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const stored = (pg) => pg.evaluate(async () => { const r = await CC.read(); const s = CC.checkDoc(r.raw).modules.submersibles; return { disc: s.fcs.fa.discovered, slots: s.fcs.fa.unlockedSlots, rank: s.subs.a1.rank, voyage: !!s.subs.a1.voyage, parts: s.subs.a1.parts }; });
      const scenario = async (name, build, act, other) => {
        const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, build); await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=sectors][data-fc=fa]'); await p1.waitForSelector('[data-act=wsave]');
        if (act) await act(p1);
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        await p2.evaluate(async (src) => {
          const r = await CC.read(), doc = CC.checkDoc(r.raw), sec = JSON.parse(JSON.stringify(doc.modules.submersibles)), base = JSON.parse(JSON.stringify(sec)), now = Date.now();
          new Function('sec', 'now', src)(sec, now); await CC.writeSection('submersibles', sec, { rev: r.rev, base });
        }, other);
        const mid = await stored(p2);
        await p1.bringToFront(); await p1.evaluate(() => window.scrollTo(0, 150));
        await p1.waitForTimeout(1500);
        const shown = await p1.evaluate(() => ({ ticked: [...document.querySelectorAll('.wiz input[data-w=disc]')].filter((b) => b.checked).map((b) => +b.value), focus: document.activeElement && document.activeElement.value, y: Math.round(window.scrollY) }));
        await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
        const after = await stored(p1);
        await p2.close();
        return { name, mid, shown, after, errors: real(errors) };
      };
      const A = await scenario('stale form keeps a newer discovery', SEC(), async (p) => { await p.focus('.wiz input[data-w=disc][value="2"]'); await p.evaluate(() => window.scrollTo(0, 150)); }, 'sec.fcs.fa.discovered = [1, 2, 3, 4];');
      const B = await scenario('an untick is honoured', SEC(), (p) => p.uncheck('.wiz input[data-w=disc][value="3"]'), 'sec.fcs.fa.discovered = [1, 2, 3, 4];');
      const C = await scenario('Clear a sea, a newer discovery in that sea and another sea stays', SEC(', 32, 33'), async (p) => { await p.click('.in-sea-2 summary'); await p.click('[data-act=seanone][data-sea="2"]'); }, 'sec.fcs.fa.discovered = [1, 2, 3, 4, 32, 33, 34];');
      const D = await scenario('a slot, a rank and a voyage changed elsewhere survive an untouched form', SEC(), null, "sec.fcs.fa.unlockedSlots = 2; sec.subs.a1.rank = 60; sec.subs.a1.voyage = { sentAt: now - 3600000, route: [1, 2], returnAt: now + 7200000 };");
      // E: the Keep label of an open Setup form follows a voyage that changed elsewhere (the save already did); focus and scroll stay
      const E = await (async () => {
        const { ctx, errors } = await context({ viewport: { width: 1440, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, SEC() + "sec.subs.a1.voyage = { sentAt: now - 3600000, route: [1, 2], returnAt: now + 7200000 };"); await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]'); await p1.click('[data-act=wnext]');
        await p1.waitForSelector('.wiz input[data-w=voyMode][value=keep]');
        const label = () => p1.evaluate(() => { const r = document.querySelector('.wiz input[data-w=voyMode][value=keep]'); return { text: r && r.parentElement.textContent.trim(), checked: !!(r && r.checked), focus: document.activeElement && document.activeElement.getAttribute('name'), y: Math.round(window.scrollY) }; });
        await p1.focus('.wiz input[data-w=voyMode][value=keep]');
        const before = await label();
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        const newReturn = await p2.evaluate(async () => {
          const r = await CC.read(), doc = CC.checkDoc(r.raw), sec = JSON.parse(JSON.stringify(doc.modules.submersibles)), base = JSON.parse(JSON.stringify(sec));
          sec.subs.a1.voyage.returnAt = Date.now() + 5 * 3600000; await CC.writeSection('submersibles', sec, { rev: r.rev, base }); return sec.subs.a1.voyage.returnAt;
        });
        await p1.bringToFront(); await p1.waitForTimeout(1500);
        const after = await label();
        for (let i = 0; i < 6; i++) { if (await p1.$('[data-act=wsave]')) break; await p1.click('[data-act=wnext]'); }
        await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
        const saved = await p1.evaluate(async () => CC.checkDoc((await CC.read()).raw).modules.submersibles.subs.a1.voyage.returnAt);
        await p2.close();
        return { before, after, newReturn, saved, errors: real(errors) };
      })();
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const ok = same(A.mid.disc, [1, 2, 3, 4]) && A.shown.ticked.includes(4) && A.shown.focus === '2' && A.shown.y === 150 && same(A.after.disc, [1, 2, 3, 4]) &&
        same(B.after.disc, [1, 2, 4]) && same(C.after.disc, [1, 2, 3, 4, 34]) &&
        D.after.slots === 2 && D.after.rank === 60 && D.after.voyage === true && same(D.after.parts, [3, 4, 1, 2]) &&
        E.before.text && E.after.text !== E.before.text && /^Keep: back/.test(E.after.text) && E.after.checked === E.before.checked && E.after.focus === E.before.focus && E.after.y === E.before.y && E.saved === E.newReturn &&
        [A, B, C, D, E].every((x) => x.errors.length === 0);
      record('C116', 'Setup sector list does not undo discoveries (fix list K1): with the sector step open, another tab saves a newer list [1, 2, 3, 4]; the form shows sector 4 ticked with focus and scroll unmoved and Save leaves [1, 2, 3, 4]; an untick in the form is honoured ([1, 2, 4]); after "Clear every sector in" a sea, a newer discovery in that sea and one in another sea stay ([1, 2, 3, 4, 34]); a slot, a rank and a voyage saved elsewhere survive an untouched form; and an open Setup form\'s "Keep: back ..." label follows a voyage changed elsewhere, with focus and scroll unmoved and the new voyage saved', ok, { A, B, C, D, E });
      server.close();
    });

    // ── C119 A free company changed in two places at once keeps both sides' discoveries (merge rule, owner decisions of 2026-11-19): (a) real pages: tab 2 holds
    //    a stale stamp and base; tab 1 records a new sector on the return sheet; tab 2 then saves another sector and a slot: the stored list holds both, the slot is
    //    kept, tab 1 shows the new count without a reload; (b) the same with CC.mergeUnit answering nothing in tab 2 (an old copy): tab 2's record is stored whole, as before;
    //    (c) built pages: the Tracker, the Command Center and the Atelier each have CC.mergeUnit, and the Tracker's ET.threeWay replays two devices adding one sector
    //    each (no question) and a name changed on both (one question, the same combined list in both versions). ──
    await guard('C119', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const run = async (oldCopy) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await p1.evaluate(async () => {
          const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
          sec.fcs.fa = { name: 'Alpha Company', world: 'Gilgamesh', unlockedSlots: 1, order: 0, discovered: [1, 2] };
          sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 1, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };
          const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        });
        await p1.reload(); await ready(p1);
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        await p2.evaluate(async (old) => {
          const r = await CC.read(); window.__stale = { rev: r.rev, base: JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)) };
          if (old) CC.mergeUnit = () => null;
        }, oldCopy);
        await p1.bringToFront();
        await p1.click('.sub[data-sub="a1"] .sub-top'); await p1.waitForSelector('#sheet .loot'); await p1.click('#sheet .loot summary');
        const newSector = await p1.$eval('#sheet [data-new-sector]', (el) => +el.dataset.newSector).catch(() => null);
        if (newSector) await p1.check('#sheet [data-new-sector="' + newSector + '"]');
        await p1.click('#sheet .sector[data-pick="1"]'); await p1.click('#sheet [data-act=dosend]');
        await p1.waitForFunction(() => window.__subs && window.__subs.state().ready && !document.querySelector('#sheet[open]'), null, { timeout: 10000 }); await p1.waitForTimeout(800);
        const afterP1 = await p1.evaluate(async () => CC.checkDoc((await CC.read()).raw).modules.submersibles.fcs.fa.discovered);
        const merged = await p2.evaluate(async () => {
          const sec = JSON.parse(JSON.stringify(window.__stale.base)); sec.fcs.fa.discovered = sec.fcs.fa.discovered.concat([34]); sec.fcs.fa.unlockedSlots = 2;
          const w = await CC.writeSection('submersibles', sec, window.__stale); return { merged: !!w.merged, hadFn: typeof CC.mergeUnit };
        });
        await p1.bringToFront(); await p1.click('[data-tab=setup]'); await p1.waitForTimeout(1500);
        const final = await p2.evaluate(async () => { const f = CC.checkDoc((await CC.read()).raw).modules.submersibles.fcs.fa; return { disc: f.discovered, slots: f.unlockedSlots }; });
        const shown = await p1.$eval('[data-act=sectors][data-fc=fa] b', (b) => b.textContent.trim()).catch(() => null);
        await ctx.close();
        return { newSector, afterP1, merged, final, shown, errors: real(errors) };
      };
      const A = await run(false), B = await run(true);
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const C = { pages: {} };
      const { ctx: cx, errors: ce } = await context();
      for (const [name, url] of [['tracker', ROOT5 + 'tracker/'], ['commandCenter', ROOT5 + 'submersibles/'], ['atelier', ROOT5 + 'atelier/']]) {
        const pg = await cx.newPage(); await pg.goto(url);
        // a first visit can reload a built page once, when its worker takes the page (the Atelier always does, into isolation): wait for that
        // reload, and repeat an evaluation that the reload cut off (this check failed once on the Checks workflow with "Execution context was destroyed")
        if (name === 'atelier') { await pg.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 60000 }).catch(() => {}); await pg.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 }).catch(() => {}); }
        const ready = () => pg.waitForFunction(() => typeof window.CC === 'object' && window.CC, null, { timeout: 30000 }).catch(() => {});
        const settled = async (fn) => { for (let attempt = 0; ; attempt++) { try { await ready(); return await pg.evaluate(fn); } catch (e) { if (attempt >= 3 || !/Execution context was destroyed|navigation|Target closed|detached/i.test(String(e && e.message))) throw e; await pg.waitForLoadState('load').catch(() => {}); await pg.waitForTimeout(500); } } };
        C.pages[name] = await settled(() => typeof window.CC === 'object' && window.CC ? typeof window.CC.mergeUnit : 'no CC');
        // the unit test T2 replayed in this built page: tab A adds sector 4, tab B (stale stamp and base) adds sector 5 and a slot
        C.t2 = C.t2 || {};
        C.t2[name] = await settled(async () => {
          if (typeof window.CC !== 'object' || !window.CC || typeof CC.writeSection !== 'function') return null;
          const sec = { fcs: { f1: { name: 'Alpha Company', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] } }, subs: {}, trips: {}, settings: {} };
          const first = await CC.writeSection('submersibles', sec, null), base = JSON.parse(JSON.stringify(first.section));
          const a = JSON.parse(JSON.stringify(base)); a.fcs.f1.discovered = [1, 2, 3, 4];
          const b = JSON.parse(JSON.stringify(base)); b.fcs.f1.discovered = [1, 2, 3, 5]; b.fcs.f1.unlockedSlots = 3;
          await CC.writeSection('submersibles', a, { rev: first.rev, base });
          const w = await CC.writeSection('submersibles', b, { rev: first.rev, base });
          return { merged: w.merged, disc: w.section.fcs.f1.discovered, slots: w.section.fcs.f1.unlockedSlots, stored: CC.checkDoc((await CC.read()).raw).modules.submersibles.fcs.f1.discovered };
        });
        if (name === 'tracker') {
          await pg.waitForFunction(() => window.ET && typeof window.ET.threeWay === 'function', null, { timeout: 30000 }).catch(() => {});
          C.replay = await settled(() => {
            const FC = (o) => Object.assign({ name: 'Alpha Company', world: 'Maduin', charId: 'c1', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] }, o);
            const st = (fc) => Object.assign(ET.newState(['A', 'B']), { modules: { submersibles: { fcs: { f1: fc }, subs: {}, trips: {}, settings: {} } } });
            const doc = (fc) => ET.portable(st(fc));
            const t4 = ET.threeWay(doc(FC({})), doc(FC({ discovered: [1, 2, 3, 4] })), doc(FC({ discovered: [1, 2, 3, 5] })));
            const t4s = ET.applyMerge(st(FC({ discovered: [1, 2, 3, 4] })), t4, {});
            const t6 = ET.threeWay(doc(FC({})), doc(FC({ name: 'Beta', discovered: [1, 2, 3, 4] })), doc(FC({ name: 'Gamma', discovered: [1, 2, 3, 5] })));
            const d6 = ET.describeConflict(t6.conflicts[0], null, st(FC({})));
            return { t4: { conflicts: t4.conflicts.length, disc: t4s.modules.submersibles.fcs.f1.discovered },
              t6: { conflicts: t6.conflicts.length, local: JSON.parse(t6.conflicts[0].local).discovered, remote: JSON.parse(t6.conflicts[0].remote).discovered, what: d6.what } };
          });
        }
        await pg.close();
      }
      await cx.close();
      const okA = !!A.newSector && A.afterP1.includes(A.newSector) && A.merged.merged === true && A.final.disc.includes(A.newSector) && A.final.disc.includes(34) && A.final.slots === 2 && !!A.shown && A.shown.indexOf(A.final.disc.length + ' of ') === 0 && A.errors.length === 0;
      const okB = !!B.newSector && B.merged.merged === true && same(B.final.disc, [1, 2, 34]) && B.final.slots === 2 && !B.final.disc.includes(B.newSector) && B.errors.length === 0;
      const okC = Object.values(C.pages).every((t) => t === 'function') && ['tracker', 'commandCenter', 'atelier'].every((n) => C.t2[n] && C.t2[n].merged === true && same(C.t2[n].disc, [1, 2, 3, 4, 5]) && same(C.t2[n].stored, [1, 2, 3, 4, 5]) && C.t2[n].slots === 3) && !!C.replay && C.replay.t4.conflicts === 0 && same(C.replay.t4.disc, [1, 2, 3, 4, 5]) && C.replay.t6.conflicts === 1 && same(C.replay.t6.local, [1, 2, 3, 4, 5]) && same(C.replay.t6.remote, [1, 2, 3, 4, 5]) && /name differs/.test(C.replay.t6.what) && /already combined/.test(C.replay.t6.what) && real(ce).length === 0;
      record('C119', 'A free company changed in two tabs keeps both discoveries: tab 1 records a sector on the return sheet, tab 2 (stale stamp and base) saves another sector and a slot: the stored list holds both, the slot is kept and tab 1 shows the new count without a reload; with CC.mergeUnit answering nothing in tab 2 (an old copy) its whole record is stored as before; the Tracker, the Command Center and the Atelier each carry CC.mergeUnit, and the two-tab merge of the unit test T2 (one tab adds a sector, the other adds a sector and a slot with a stale stamp: both sectors and the slot are stored) replayed in each of the three built pages, and an in-page ET.threeWay replay of two added sectors (no question) and a name changed on both (one question, the same combined list in both versions) gives the unit-test results', okA && okB && okC, { A, B, C });
      server.close();
    });

    // ── C120 (review fix R1) A free company removed elsewhere does not come back when its open Setup form is saved: (a) a form whose page was never told
    //    (it cannot hear the other tab): Save writes nothing, the company and its submarines stay removed, the form stays open and says so with a Close button;
    //    (b) a form whose page is told: the message shows at once, before Save; Close ends the form; (c) a submarine removed elsewhere is not written back
    //    (the company is), and the status line names it. No page error. ──
    await guard('C120', async () => {
      const server = await start(PORT5);
      const SEC = "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] }; sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] }; sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub A2', rank: 40, parts: [3, 4, 1, 2] };";
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const stored = (pg) => pg.evaluate(async () => { const s = CC.checkDoc((await CC.read()).raw).modules.submersibles; return { fcs: Object.keys(s.fcs), subs: Object.keys(s.subs) }; });
      const scenario = async (deaf, remove) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        if (deaf) await p1.addInitScript(() => { window.BroadcastChannel = undefined; });
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, SEC); await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=sectors][data-fc=fa]'); await p1.waitForSelector('[data-act=wsave]');
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        await p2.evaluate(async (what) => {
          const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec));
          if (what === 'company') { sec.fcs = {}; sec.subs = {}; } else delete sec.subs.a1;
          await CC.writeSection('submersibles', sec, { rev: r.rev, base });
        }, remove);
        const gone = () => p1.evaluate(() => { const g = document.querySelector('[data-wiz-gone]'); return { text: g ? g.textContent.trim() : null, close: !!document.querySelector('.wiz [data-act=wcancel]'), open: !!document.querySelector('.wiz'), status: document.querySelector('#status').textContent.trim() }; });
        let before = null;
        if (!deaf) { await p1.waitForTimeout(1500); before = await gone(); }
        else { await p1.waitForTimeout(300); }
        if (await p1.$('[data-act=wsave]')) await p1.click('[data-act=wsave]');
        await p1.waitForTimeout(1500);
        const after = await gone(), kept = await stored(p2);
        let closed = null;
        if (remove === 'company') { await p1.click('.wiz [data-act=wcancel]'); await p1.waitForTimeout(300); closed = await p1.evaluate(() => !document.querySelector('.wiz')); }
        await ctx.close();
        return { deaf, remove, before, after, kept, closed, errors: real(errors) };
      };
      const A = await scenario(true, 'company'), B = await scenario(false, 'company'), C = await scenario(true, 'sub');
      const MSG = 'This free company was removed on another device or in another tab, so nothing was saved. Close this form; to bring the company back, set it up again.';
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const ok = [A, B].every((x) => same(x.kept, { fcs: [], subs: [] }) && x.after.text === MSG && x.after.close && x.after.open && x.closed === true && x.errors.length === 0) && B.before.text === MSG &&
        same(C.kept, { fcs: ['fa'], subs: ['a2'] }) && /Sub A1/.test(C.after.status) && /removed/.test(C.after.status) && C.after.text === null && C.errors.length === 0;
      record('C120', 'A free company removed elsewhere does not come back (review fix R1): with its Setup form open and the removal made in another tab, Save writes nothing (also when the page was never told), the company and its submarines stay removed, the form stays open, says "' + MSG + '" with a Close button, and shows it at once when the page is told; a submarine removed elsewhere is not written back and the status line names it', ok, { A, B, C });
      server.close();
    });

    // ── C123 (integrity spec, fault A) A bare company (no submarine, one slot, discoveries [1, 2], no world) removed elsewhere on purpose while its Setup form is open stays removed:
    //    (a) the page is told (it hears the other tab): the form says "removed elsewhere" at once, there is no Save button, nothing is stored; (b) the page is not told (no
    //    BroadcastChannel, as C120): Save stores nothing and the status line says "Not saved on this device" and names the removal. No page error. ──
    await guard('C123', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const scenario = async (deaf) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        if (deaf) await p1.addInitScript(() => { window.BroadcastChannel = undefined; });
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, "sec.fcs.fb = { name: 'Bare Company', order: 0, unlockedSlots: 1, discovered: [1, 2] };"); await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=sectors][data-fc=fb]'); await p1.waitForSelector('[data-act=wsave]');
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        await p2.evaluate(async () => {
          const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec));
          sec.fcs = {}; sec.subs = {};
          await CC.writeSection('submersibles', sec, { rev: r.rev, base });
        });
        await p1.waitForTimeout(deaf ? 300 : 1500);
        const probe = () => p1.evaluate(() => ({ gone: !!document.querySelector('[data-wiz-gone]'), save: !!document.querySelector('[data-act=wsave]'), open: !!document.querySelector('.wiz'), status: document.querySelector('#status').textContent.trim() }));
        const before = await probe();
        if (before.save) await p1.click('[data-act=wsave]');
        await p1.waitForTimeout(1500);
        const after = await probe();
        const kept = await p2.evaluate(async () => { const s = CC.checkDoc((await CC.read()).raw).modules.submersibles; return { fcs: Object.keys(s.fcs), subs: Object.keys(s.subs) }; });
        await ctx.close();
        return { deaf, before, after, kept, errors: real(errors) };
      };
      const A = await scenario(false), B = await scenario(true);
      const none = JSON.stringify({ fcs: [], subs: [] });
      const ok = A.before.gone && !A.before.save && A.after.gone && JSON.stringify(A.kept) === none && A.errors.length === 0 &&
        !B.before.gone && B.before.save && /^Not saved on this device: This free company was removed on another device or in another tab\./.test(B.after.status) && JSON.stringify(B.kept) === none && B.errors.length === 0;
      record('C123', 'A bare company removed elsewhere on purpose stays removed (integrity spec): with its Setup form open, a page that is told shows "removed elsewhere" at once with no Save button and nothing is stored; a page that is not told (no BroadcastChannel) gets "Not saved on this device: This free company was removed on another device or in another tab." on Save and nothing is stored; no page error', ok, { A, B });
      server.close();
    });

    // ── C124 (integrity spec, fault B, owner decision O1) A company's form is open with an empty slot 2; another tab saves a submarine (rank 40, a voyage under way) into it; a name is typed
    //    for slot 2 and Save is pressed: one submarine in slot 2, the one saved elsewhere (same id), with the typed name, its rank 40 and its voyage, and the status line names the slot; told and not told. ──
    await guard('C124', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const SEC = "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] }; sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };";
      const toSave = async (p) => { for (let i = 0; i < 8; i++) { if (await p.$('[data-act=wsave]')) return; await p.click('[data-act=wnext]'); } };
      const scenario = async (deaf) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        if (deaf) await p1.addInitScript(() => { window.BroadcastChannel = undefined; });
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, SEC); await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]');
        await p1.click('[data-act=wnext]'); await p1.click('[data-act=wnext]'); await p1.fill('.wiz input[data-w=name]', 'Typed Two');
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        const returnAt = await p2.evaluate(async () => {
          const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec)), now = Date.now();
          sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Saved Two', rank: 40, parts: [3, 4, 1, 2], voyage: { sentAt: now - 3600000, route: [1, 2], returnAt: now + 5 * 3600000, gameSaid: '5h' } };
          await CC.writeSection('submersibles', sec, { rev: r.rev, base }); return sec.subs.a2.voyage.returnAt;
        });
        await p1.bringToFront(); await p1.waitForTimeout(deaf ? 300 : 1500);
        await toSave(p1); await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
        const out = await p1.evaluate(async () => {
          const s = CC.checkDoc((await CC.read()).raw).modules.submersibles, inSlot = Object.keys(s.subs).filter((k) => s.subs[k].fcId === 'fa' && s.subs[k].slot === 2);
          return { inSlot, rec: inSlot.length ? { name: s.subs[inSlot[0]].name, rank: s.subs[inSlot[0]].rank, returnAt: s.subs[inSlot[0]].voyage && s.subs[inSlot[0]].voyage.returnAt } : null, all: Object.keys(s.subs).sort(), status: document.querySelector('#status').textContent.trim() };
        });
        await ctx.close();
        return Object.assign(out, { deaf, returnAt, errors: real(errors) });
      };
      const A = await scenario(false), B = await scenario(true);
      // G2: typing only a rank keeps everything else as saved. kind 'adopt': slot 2 is empty in the form, another tab saves a submarine there; kind 'known': slot 1's parts are changed elsewhere while the form is open
      const rankOnly = async (kind) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, SEC); await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]');
        await p1.click('[data-act=wnext]'); if (kind === 'adopt') await p1.click('[data-act=wnext]');
        await p1.fill('.wiz input[data-w=rank]', kind === 'adopt' ? '45' : '55'); await p1.press('.wiz input[data-w=rank]', 'Tab');
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        const elsewhereAt = await p2.evaluate(async (k) => {
          const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec)), now = Date.now();
          if (k === 'adopt') sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Saved Two', rank: 40, parts: [3, 4, 1, 2], voyage: { sentAt: now - 3600000, route: [1, 2], returnAt: now + 5 * 3600000, gameSaid: '5h' } };
          else sec.subs.a1.parts = [7, 8, 5, 6];
          await CC.writeSection('submersibles', sec, { rev: r.rev, base }); return k === 'adopt' ? sec.subs.a2.voyage.returnAt : null;
        }, kind);
        await p1.bringToFront(); await p1.waitForTimeout(1500);
        await toSave(p1); await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
        const out = await p1.evaluate(async (k) => {
          const s = CC.checkDoc((await CC.read()).raw).modules.submersibles, r = s.subs[k === 'adopt' ? 'a2' : 'a1'];
          return { name: r.name, rank: r.rank, parts: r.parts, returnAt: r.voyage && r.voyage.returnAt, all: Object.keys(s.subs).sort(), status: document.querySelector('#status').textContent.trim() };
        }, kind);
        await ctx.close();
        return Object.assign(out, { elsewhereAt, errors: real(errors) });
      };
      const RA = await rankOnly('adopt'), RK = await rankOnly('known');
      const rankOk = RA.name === 'Saved Two' && RA.rank === 45 && JSON.stringify(RA.parts) === '[3,4,1,2]' && RA.returnAt === RA.elsewhereAt && RA.returnAt != null && JSON.stringify(RA.all) === '["a1","a2"]' && RA.errors.length === 0 &&
        RK.name === 'Sub A1' && RK.rank === 55 && JSON.stringify(RK.parts) === '[7,8,5,6]' && RK.errors.length === 0;
      const good = (x) => JSON.stringify(x.inSlot) === '["a2"]' && x.rec && x.rec.name === 'Typed Two' && x.rec.rank === 40 && x.rec.returnAt === x.returnAt && JSON.stringify(x.all) === '["a1","a2"]' &&
        x.status === 'Slot 2 already held “Saved Two”, saved in another tab or on another device while this form was open; what you typed here was applied to it.' && x.errors.length === 0;
      record('C124', 'Fault B (integrity spec, owner decision O1): the Setup form opened with an empty slot 2, another tab saves a submarine there (rank 40, a voyage), a name is typed for slot 2 and Save is pressed: slot 2 holds one submarine, the one saved elsewhere, with the typed name, rank 40 and the voyage, and the status line says "Slot 2 already held “Saved Two”, saved in another tab or on another device while this form was open; what you typed here was applied to it."; the page told and not told; and typing only a rank (G2) keeps the saved parts and voyage of an adopted submarine and the parts changed elsewhere of a known one', good(A) && good(B) && rankOk, { A, B, RA, RK });
      server.close();
    });

    // ── C125 (integrity spec, fault B) A bare company's form (not told, bare at opening) is saved with a name typed for slot 1 after another tab saved a submarine into slot 1: the store refuses
    //    ("That submarine slot changed elsewhere."), the status line says so and only the other tab's submarine is stored. ──
    await guard('C125', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
      await p1.addInitScript(() => { window.BroadcastChannel = undefined; });
      await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
      await tlSeed(p1, "sec.fcs.fb = { name: 'Bare Company', order: 0, unlockedSlots: 1, discovered: [1, 2] };"); await p1.reload(); await ready(p1);
      await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fb]'); await p1.waitForSelector('[data-act=wnext]');
      await p1.click('[data-act=wnext]'); await p1.fill('.wiz input[data-w=name]', 'Typed One');
      const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
      await p2.evaluate(async () => {
        const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec));
        sec.subs.b1 = { fcId: 'fb', slot: 1, name: 'Saved One', rank: 30, parts: [3, 4, 1, 2], voyage: null };
        await CC.writeSection('submersibles', sec, { rev: r.rev, base });
      });
      await p1.bringToFront(); await p1.waitForTimeout(300);
      for (let i = 0; i < 8 && !(await p1.$('[data-act=wsave]')); i++) await p1.click('[data-act=wnext]');
      await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
      const out = await p1.evaluate(async () => { const s = CC.checkDoc((await CC.read()).raw).modules.submersibles; return { subs: Object.keys(s.subs).map((k) => k + ':' + s.subs[k].name), status: document.querySelector('#status').textContent.trim() }; });
      await ctx.close();
      const ok = /slot changed elsewhere/.test(out.status) && /^Not saved on this device/.test(out.status) && JSON.stringify(out.subs) === '["b1:Saved One"]' && real(errors).length === 0;
      record('C125', 'Fault B, page not told and the company bare when its form opened: another tab saves a submarine into slot 1, a name is typed for slot 1 and Save is pressed: the store refuses ("That submarine slot changed elsewhere."), the status line says "Not saved on this device" with that reason and only the other tab\'s submarine is stored', ok, { out, errors: real(errors) });
      server.close();
    });

    // ── C126 (integrity spec, owner decision O3) A save that already holds two submarines in one slot (seeded straight into the store): the Board lists both with "Keep this one" beside each;
    //    nothing changes on load or when the confirmation is declined; accepting keeps the chosen one, the logged voyage of the removed one stays stored, the notice is gone, no page error.
    //    The notice is also pictured on a phone in Azure Dragoon dark (evidence/slot-notice-phone-azure-dark.png), with no sideways scroll, 44 px buttons and a keyboard way to them. ──
    await guard('C126', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const dupSeed = (pg) => pg.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: { fa: { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] } }, trips: { t1: { s: 'a2', t: now - 30 * H, r: [1, 2], back: now - 10 * H, items: [[10099, 3]], newSectors: [] } }, settings: {},
          subs: { a1: { fcId: 'fa', slot: 1, name: 'First Sub', rank: 50, parts: [3, 4, 1, 2], voyage: null }, a2: { fcId: 'fa', slot: 1, name: 'Second Sub', rank: 30, parts: [3, 4, 1, 2], voyage: { sentAt: now - H, route: [1, 2], returnAt: now + 4 * H, gameSaid: '4h' } } } };
        await CC.transact((raw) => { const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc(); doc.modules.submersibles = CC.checkModules({ submersibles: sec }).submersibles; doc.updated = Date.now(); return doc; });
      });
      const rawNow = (pg) => pg.evaluate(async () => JSON.stringify((await CC.read()).raw));
      const probe = (pg) => pg.evaluate(() => ({ notices: [...document.querySelectorAll('[data-slot-clash]')].map((n) => ({ key: n.dataset.slotClash, text: n.querySelector('p').textContent.trim(), rows: [...n.querySelectorAll('[data-clash-sub]')].map((r) => ({ id: r.dataset.clashSub, text: r.querySelector('span').textContent.trim(), button: r.querySelector('button').textContent.trim() })) })), status: document.querySelector('#status').textContent.trim() }));
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
      await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
      await dupSeed(p1); const seeded = await rawNow(p1);
      await p1.reload(); await ready(p1); await p1.waitForTimeout(1200);
      const listed = await probe(p1), afterLoad = await rawNow(p1);
      const confirms = []; await p1.evaluate(() => { window.__said = []; window.__answer = false; window.confirm = (m) => { window.__said.push(m); return window.__answer; }; });
      await p1.click('[data-clash-sub=a1] button'); await p1.waitForTimeout(800);
      const declined = await rawNow(p1), stillListed = (await probe(p1)).notices.length;
      await p1.evaluate(() => { window.__answer = true; });
      await p1.click('[data-clash-sub=a1] button'); await p1.waitForTimeout(1500);
      const said = await p1.evaluate(() => window.__said), after = await probe(p1);
      const stored = await p1.evaluate(async () => { const s = CC.checkDoc((await CC.read()).raw).modules.submersibles; return { subs: Object.keys(s.subs), trips: Object.keys(s.trips) }; });
      await ctx.close();
      // the phone picture, Azure Dragoon dark
      const ph = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' }), pp = await ph.ctx.newPage();
      await pp.route('https://universalis.app/**', (r) => r.abort('failed'));
      await pp.goto(ROOT5 + '#settings'); await pp.waitForSelector('#s-appearance .look-card');
      await pp.click('#s-appearance [data-look=toggle][data-v="shared:theme"]'); await pp.click('#s-appearance [data-look=theme][data-v="azure-dragoon"]'); await pp.click('#s-appearance [data-look=mode][data-v=dark]');
      await pp.goto(ROOT5 + 'submersibles/'); await ready(pp); await dupSeed(pp); await pp.reload(); await ready(pp); await pp.waitForSelector('[data-slot-clash]'); await pp.waitForTimeout(500);
      const phone = await pp.evaluate(() => {
        const n = document.querySelector('[data-slot-clash]'), b = [...n.querySelectorAll('button')].map((x) => { const r = x.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; }), nr = n.getBoundingClientRect();
        return { buttons: b, noteRight: Math.round(nr.right), noteLeft: Math.round(nr.left), scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
      });
      await pp.keyboard.press('Tab'); let reach = false;
      for (let i = 0; i < 60 && !reach; i++) { reach = await pp.evaluate(() => !!document.activeElement && document.activeElement.matches('[data-act=keepsub]')); if (!reach) await pp.keyboard.press('Tab'); }
      phone.keyboardReach = reach;
      if (SHOT) { await pp.evaluate(() => document.querySelector('[data-slot-clash]').scrollIntoView({ block: 'center' })); await pp.screenshot({ path: path.join(ev, 'slot-notice-phone-azure-dark.png') }); }
      await ph.ctx.close();
      const n0 = listed.notices[0];
      const okList = listed.notices.length === 1 && n0.key === 'fa|1' && n0.rows.length === 2 && /^Slot 1 of “Alpha Company” has 2 submarines saved, and a slot holds one\./.test(n0.text) && n0.rows.every((r) => r.button === 'Keep this one') && /First Sub/.test(n0.rows[0].text) && /Second Sub/.test(n0.rows[1].text);
      const ok = okList && afterLoad === seeded && declined === seeded && stillListed === 1 && said.length === 2 &&
        said[0] === 'Keep “First Sub” in slot 1 of “Alpha Company” and remove “Second Sub”? Their logged voyages stay in the history. A voyage under way on a removed one is not logged.' &&
        JSON.stringify(stored) === JSON.stringify({ subs: ['a1'], trips: ['t1'] }) && after.notices.length === 0 && /^Kept “First Sub” in slot 1/.test(after.status) && real(errors).length === 0 &&
        phone.scrollW <= phone.clientW && phone.buttons.length === 2 && phone.buttons.every((b) => b.h >= 44 && b.right <= phone.clientW) && phone.keyboardReach === true && real(ph.errors).length === 0;
      record('C126', 'A save that holds two submarines in one slot (integrity spec, owner decision O3): the Board lists both with "Keep this one" beside each; nothing changes on load or when the confirmation is declined; accepting keeps the chosen one, the removed one\'s logged voyage stays stored, the notice is gone, the status line says what was kept; on a phone (360 px, Azure Dragoon dark) the notice does not scroll sideways, its buttons are at least 44 px high and reachable by keyboard', ok, { listed, unchangedOnLoad: afterLoad === seeded, unchangedWhenDeclined: declined === seeded, stillListed, said, stored, after, phone, errors: real(errors).concat(real(ph.errors)) });
      server.close();
    });

    // ── C127 (integrity spec) The Tracker, the Command Center and the Atelier each carry CC.foldLoser and refuse the replay of the unit test INT-B1 (a stale page adds a second submarine to a slot
    //    another page filled) and of INT-A2 (a company removed on purpose is not stored again). ──
    await guard('C127', async () => {
      const server = await start(PORT5);
      const pages = {}, errs = [];
      for (const [name, url] of [['tracker', ROOT5 + 'tracker/'], ['commandCenter', ROOT5 + 'submersibles/'], ['atelier', ROOT5 + 'atelier/']]) {
        const { ctx, errors } = await context(); errs.push(errors); // a fresh store for each page
        const pg = await ctx.newPage(); await pg.goto(url);
        if (name === 'atelier') { await pg.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 60000 }).catch(() => {}); await pg.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 }).catch(() => {}); }
        const settled = async (fn) => { for (let attempt = 0; ; attempt++) { try { await pg.waitForFunction(() => typeof window.CC === 'object' && window.CC, null, { timeout: 30000 }).catch(() => {}); return await pg.evaluate(fn); } catch (e) { if (attempt >= 3 || !/Execution context was destroyed|navigation|Target closed|detached/i.test(String(e && e.message))) throw e; await pg.waitForLoadState('load').catch(() => {}); await pg.waitForTimeout(500); } } };
        pages[name] = await settled(async () => {
          if (typeof window.CC !== 'object' || !window.CC || typeof CC.writeSection !== 'function') return null;
          const fn = typeof CC.foldLoser, clone = (x) => JSON.parse(JSON.stringify(x)), msg = (e) => String(e && e.message);
          const solid = (name, order, c) => ({ name, charId: c, order, unlockedSlots: 2, world: 'Ravana', discovered: [1, 2, 3] });
          const first = await CC.writeSection('submersibles', { fcs: { fa: solid('Alpha', 0, 'c2'), fb: solid('Beta', 1, 'c1') }, subs: { s0: { fcId: 'fb', slot: 2, name: 'Sub B', rank: 10, voyage: null } }, trips: {}, settings: {} }, null);
          // INT-B1: another page fills slot 1 of fa, a stale page adds a second submarine there
          const other = clone(first.section); other.subs.s1 = { fcId: 'fa', slot: 1, name: 'Saved elsewhere', rank: 10, voyage: null };
          await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
          const mine = clone(first.section); mine.subs.s2 = { fcId: 'fa', slot: 1, name: 'Typed here', rank: 10, voyage: null };
          let slot = null; try { await CC.writeSection('submersibles', mine, { rev: first.rev, base: first.section }); } catch (e) { slot = msg(e); }
          // INT-A2: another page removes fb and its submarine; the stale page renames fb
          const gone = clone(other); delete gone.fcs.fb; delete gone.subs.s0;
          const mid = await CC.read(); await CC.writeSection('submersibles', gone, { rev: mid.rev, base: other });
          const renamed = clone(first.section); renamed.fcs.fb.name = 'Typed Name';
          let removed = null; try { await CC.writeSection('submersibles', renamed, { rev: first.rev, base: first.section }); } catch (e) { removed = msg(e); }
          const s = CC.checkDoc((await CC.read()).raw).modules.submersibles;
          return { fn, slot, removed, subs: Object.keys(s.subs).sort(), fcs: Object.keys(s.fcs).sort() };
        });
        await ctx.close();
      }
      const ok = Object.values(pages).every((p) => p && p.fn === 'function' && p.slot === 'That submarine slot changed elsewhere.' && p.removed === 'This free company was removed on another device or in another tab.' && JSON.stringify(p.subs) === '["s1"]' && JSON.stringify(p.fcs) === '["fa"]') && errs.every((e) => real(e).length === 0);
      record('C127', 'The Tracker, the Command Center and the Atelier each carry CC.foldLoser; in each built page a stale write that adds a second submarine to a slot another page filled is refused ("That submarine slot changed elsewhere.") and a stale write that renames a company removed on purpose is refused ("This free company was removed on another device or in another tab."), with only the other page\'s submarine stored and the company still removed', ok, { pages, errors: errs.map(real) });
      server.close();
    });

    // ── C121 (review fix R2) The Setup form's save keeps what changed elsewhere unless the player changed it here: (a) a slot switched off and on again in the form does not
    //    lower a slot count raised elsewhere; (b) a sector unticked in another tab while the form is open is not added back; (c) a name (company and submarine) typed back to what
    //    it was when the form opened does not overwrite a rename made elsewhere. ──
    await guard('C121', async () => {
      const server = await start(PORT5);
      const SEC = "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] }; sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] }; sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub A2', rank: 40, parts: [3, 4, 1, 2] };";
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const stored = (pg) => pg.evaluate(async () => { const s = CC.checkDoc((await CC.read()).raw).modules.submersibles; return { disc: s.fcs.fa.discovered, slots: s.fcs.fa.unlockedSlots, name: s.fcs.fa.name, a1: s.subs.a1 && s.subs.a1.name }; });
      const toSave = async (p) => { for (let i = 0; i < 8; i++) { if (await p.$('[data-act=wsave]')) return; await p.click('[data-act=wnext]'); } };
      const scenario = async (act, other, afterOther) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, SEC); await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]');
        await act(p1);
        const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
        await p2.evaluate(async (src) => {
          const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec));
          new Function('sec', src)(sec); await CC.writeSection('submersibles', sec, { rev: r.rev, base });
        }, other);
        await p1.bringToFront(); await p1.waitForTimeout(1500);
        if (afterOther) await afterOther(p1);
        await toSave(p1); await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
        const after = await stored(p1);
        await ctx.close();
        return { after, errors: real(errors) };
      };
      // (a) slot 2 off and on again; another tab raised the count to 3
      const A = await scenario(async (p) => { await p.click('[data-act=wnext]'); await p.click('[data-act=wnext]'); await p.uncheck('.wiz input[data-w=unlocked]'); await p.check('.wiz input[data-w=unlocked]'); }, 'sec.fcs.fa.unlockedSlots = 3;');
      // (b) the sector list is open; another tab unticks sector 3
      let shownB = null;
      const B = await scenario(async (p) => { await toSave(p); }, 'sec.fcs.fa.discovered = [1, 2];', async (p) => { shownB = await p.evaluate(() => [...document.querySelectorAll('.wiz input[data-w=disc]')].filter((b) => b.checked).map((b) => +b.value)); });
      // (c) the company's name and its first submarine's name typed back to what they were; another tab renamed both
      const Cc = await scenario(async (p) => {
        await p.fill('.wiz input[data-w="fc.name"]', 'Alpha Company X'); await p.fill('.wiz input[data-w="fc.name"]', 'Alpha Company');
        await p.click('[data-act=wnext]'); await p.fill('.wiz input[data-w=name]', 'Sub A1 X'); await p.fill('.wiz input[data-w=name]', 'Sub A1');
      }, "sec.fcs.fa.name = 'Alpha Renamed'; sec.subs.a1.name = 'Sub Renamed';");
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const ok = A.after.slots === 3 && same(B.after.disc, [1, 2]) && same(shownB, [1, 2]) && Cc.after.name === 'Alpha Renamed' && Cc.after.a1 === 'Sub Renamed' && [A, B, Cc].every((x) => x.errors.length === 0);
      record('C121', 'Setup form keeps what changed elsewhere unless the player changed it here (review fix R2): a slot switched off and on again in the form leaves a count of 3 raised elsewhere at 3; a sector unticked in another tab while the sector list is open is shown unticked and not added back ([1, 2]); a company name and a submarine name typed back to what they were do not overwrite a rename made elsewhere', ok, { A, B, shownB, C: Cc });
      server.close();
    });

    // ── C122 (review fix R4) When this page's own save is merged with a newer one and a sector the player unticked in the Setup form comes back (another tab had it ticked), a status
    //    line says so in plain words, with the count: 1 sector, 2 sectors; no line when nothing was merged. ──
    await guard('C122', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const scenario = async (unticks, interfere) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
        await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
        await tlSeed(p1, "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 1, discovered: [1, 2, 3, 5] }; sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2] };");
        await p1.reload(); await ready(p1);
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=sectors][data-fc=fa]'); await p1.waitForSelector('[data-act=wsave]');
        for (const id of unticks) await p1.uncheck('.wiz input[data-w=disc][value="' + id + '"]');
        // another tab changes the same company just before this page's own write goes through (the page's stamp is then old, so the write is merged)
        if (interfere) await p1.evaluate(() => {
          const real = CC.writeSection; let done = false;
          CC.writeSection = async function (name) {
            if (name === 'submersibles' && !done) {
              done = true; const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec));
              sec.fcs.fa.discovered = sec.fcs.fa.discovered.concat([4]); await real.call(CC, name, sec, { rev: r.rev, base });
            }
            return real.apply(this, arguments);
          };
        });
        await p1.click('[data-act=wsave]'); await p1.waitForTimeout(2000);
        const out = await p1.evaluate(async () => ({ status: document.querySelector('#status').textContent.trim(), disc: CC.checkDoc((await CC.read()).raw).modules.submersibles.fcs.fa.discovered }));
        await ctx.close();
        return Object.assign(out, { errors: real(errors) });
      };
      const one = await scenario([3], true), two = await scenario([3, 5], true), none = await scenario([3], false);
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const ok = one.status === '1 sector you unticked for Alpha Company was ticked on another device or tab and has been kept. Untick it again in Setup if it is wrong.' && same(one.disc, [1, 2, 3, 4, 5]) &&
        two.status === '2 sectors you unticked for Alpha Company were ticked on another device or tab and have been kept. Untick them again in Setup if they are wrong.' && same(two.disc, [1, 2, 3, 4, 5]) &&
        !/unticked/.test(none.status) && same(none.disc, [1, 2, 5]) && [one, two, none].every((x) => x.errors.length === 0);
      record('C122', 'A sync that brings an unticked sector back says so (review fix R4): with sector 3 unticked in the Setup form and another tab saving the company first, the merged save keeps it and the status line says "1 sector you unticked for Alpha Company was ticked on another device or tab and has been kept. Untick it again in Setup if it is wrong."; with sectors 3 and 5 unticked it says "2 sectors ... were ticked ... have been kept. Untick them again ..."; with nothing merged there is no such line and the untick stands', ok, { one, two, none });
      server.close();
    });

    // ── L1 Submersibles look evidence (not a behaviour check): one seeded profile walked through every screen; the
    //    screenshots are look-*.png (Chromium only). Asserts: no sideways page scroll at 360 px on the eight screens, no page
    //    errors. Asserts also at 360 px: the chart is at least 320 px wide, its smallest tap circle and every measured tap height are at least 36 px.
    // ── C133 (G1, second review) A stale page adds a submarine to a still-empty company that was removed on purpose and that would win the duplicate clean-up against the company left: the store
    //    refuses ("This free company was removed on another device or in another tab."), the page shows that message, the submarine is stored nowhere and there is no page error. ──
    await guard('C133', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await ctx.newPage(); await p1.route('https://universalis.app/**', (r) => r.abort('failed'));
      await p1.addInitScript(() => { window.BroadcastChannel = undefined; });
      await p1.goto(ROOT5 + 'submersibles/'); await ready(p1);
      await tlSeed(p1, "sec.fcs.fa = { name: 'Alpha Company', order: 0, unlockedSlots: 1, discovered: [1, 2], charId: 'c1' }; sec.fcs.fb = { name: 'Beta Company', order: 1, unlockedSlots: 1, discovered: [1, 2], charId: 'c2' };"); await p1.reload(); await ready(p1);
      await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]');
      await p1.click('[data-act=wnext]'); await p1.fill('.wiz input[data-w=name]', 'Typed One');
      const p2 = await ctx.newPage(); await p2.goto(ROOT5 + 'submersibles/'); await ready(p2);
      await p2.evaluate(async () => { // elsewhere: Alpha is removed on purpose and Beta becomes a company of the same character (Alpha would have won the clean-up)
        const r = await CC.read(), sec = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), base = JSON.parse(JSON.stringify(sec));
        delete sec.fcs.fa; sec.fcs.fb.charId = 'c1';
        await CC.writeSection('submersibles', sec, { rev: r.rev, base });
      });
      await p1.bringToFront(); await p1.waitForTimeout(300);
      for (let i = 0; i < 8 && !(await p1.$('[data-act=wsave]')); i++) await p1.click('[data-act=wnext]');
      await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
      const out = await p1.evaluate(async () => { const s = CC.checkDoc((await CC.read()).raw).modules.submersibles; return { fcs: Object.keys(s.fcs), subs: Object.keys(s.subs), status: document.querySelector('#status').textContent.trim() }; });
      const here = await p1.evaluate(() => document.body.textContent.includes('Typed One'));
      await ctx.close();
      const ok = /This free company was removed on another device or in another tab\./.test(out.status) && /^Not saved on this device/.test(out.status) && JSON.stringify(out.fcs) === '["fb"]' && out.subs.length === 0 && real(errors).length === 0;
      record('C133', 'A company removed on purpose is not replaced by another for a stale submarine (G1): a stale page adds a submarine to a still-empty company that another tab removed and that would win the clean-up against the company left; the page shows "Not saved on this device: This free company was removed on another device or in another tab.", only the other company stays stored, the submarine is stored nowhere, no page error', ok, { out, here, errors: real(errors) });
      server.close();
    });

    // ── C134 to C140 (integrity spec 2): the Setup form keeps a submarine where another tab put it; a refused write's recovery cancels a write scheduled during its re-read;
    //    the slot rules refuse a second "Keep this one"; the three built apps refuse the SI-2 and SI-3 replays. ──
    const si2Raw = (pg, src) => pg.evaluate(async (src) => { // stored exactly as given: no store rule applies (older saves hold duplicates)
      await CC.transact((raw) => { const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc(); const sec = JSON.parse(JSON.stringify(doc.modules.submersibles || { fcs: {}, subs: {}, trips: {}, settings: {} })); new Function('sec', src)(sec); doc.modules.submersibles = CC.checkModules({ submersibles: sec }).submersibles; doc.updated = Date.now(); return doc; });
    }, src);
    const si2Change = (pg, src) => pg.evaluate(async (src) => { // another tab's write, from the saved copy as it is now
      const r = await CC.read(), base = JSON.parse(JSON.stringify(CC.checkDoc(r.raw).modules.submersibles)), sec = JSON.parse(JSON.stringify(base));
      new Function('sec', src)(sec); await CC.writeSection('submersibles', sec, { rev: r.rev, base });
    }, src);
    const si2Stored = (pg) => pg.evaluate(async () => CC.checkDoc((await CC.read()).raw).modules.submersibles);
    const si2ToSave = async (p) => { for (let i = 0; i < 8; i++) { if (await p.$('[data-act=wsave]')) return; await p.click('[data-act=wnext]'); } };
    const si2Page = async (ctx, deaf) => { const p = await ctx.newPage(); await p.route('https://universalis.app/**', (r) => r.abort('failed')); if (deaf) await p.addInitScript(() => { window.BroadcastChannel = undefined; }); await p.goto(ROOT5 + 'submersibles/'); await p.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); return p; };
    const SI2_FC = "sec.fcs.fa = { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: ";
    const SI2_MOVED = 'is now in slot 2, where another tab or device put it while this form was open; it stays there, and what you typed here was applied to it.';

    // ── C134 (fault 4) A form's Save does not move a submarine another tab or device moved while it was open: it stays where it was saved, the typed name is applied, the status line names the move; told and not told. ──
    await guard('C134', async () => {
      const server = await start(PORT5);
      const scenario = async (told) => {
        const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
        const p1 = await si2Page(ctx, !told);
        await tlSeed(p1, SI2_FC + "1, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
        await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]');
        await p1.click('[data-act=wnext]'); await p1.fill('.wiz input[data-w=name]', 'Typed Name');
        const p2 = await si2Page(ctx, false);
        await si2Change(p2, 'sec.fcs.fa.unlockedSlots = 2; sec.subs.s1.slot = 2;');
        if (told) { await p1.bringToFront(); await p1.waitForTimeout(1500); } else await p1.waitForTimeout(300);
        await si2ToSave(p1); await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
        const s = await si2Stored(p1), status = await p1.evaluate(() => document.querySelector('#status').textContent.trim());
        await ctx.close();
        return { told, subs: Object.keys(s.subs), slot: s.subs.s1 && s.subs.s1.slot, name: s.subs.s1 && s.subs.s1.name, status, errors: real(errors) };
      };
      const A = await scenario(false), B = await scenario(true);
      const good = (x) => x.subs.join() === 's1' && x.slot === 2 && x.name === 'Typed Name' && x.status.includes('“Typed Name” ' + SI2_MOVED) && x.errors.length === 0;
      record('C134', 'Fault 4 (integrity spec 2): a Setup form opened while a submarine was in slot 1, with the submarine moved to slot 2 in another tab, a name typed and Save pressed: the submarine stays in slot 2 with the typed name (no second one), and the status line says "“Typed Name” ' + SI2_MOVED + '"; the page told and not told', good(A) && good(B), { A, B });
      server.close();
    });

    // ── C135 Slot 2 is switched off in the form while another tab saves a submarine into it: the submarine is stored, the slot count is 1 and the Board shows it Locked. ──
    await guard('C135', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "2, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]');
      await p1.click('[data-act=wnext]'); await p1.click('[data-act=wnext]'); await p1.uncheck('.wiz input[data-w=unlocked]');
      const p2 = await si2Page(ctx, false);
      await si2Change(p2, "sec.subs.s2 = { fcId: 'fa', slot: 2, name: 'Slot Two', rank: 40, voyage: null };");
      await si2ToSave(p1); await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
      await p1.click('[data-tab=board]'); await p1.waitForTimeout(300);
      const s = await si2Stored(p1), locked = await p1.evaluate(() => [...document.querySelectorAll('.sub[data-status="locked"]')].map((e) => e.dataset.slot));
      await ctx.close();
      const ok = !!s.subs.s2 && s.subs.s2.slot === 2 && s.fcs.fa.unlockedSlots === 1 && Object.keys(s.subs).length === 2 && locked.includes('2') && real(errors).length === 0;
      record('C135', 'A slot switched off in the Setup form while another tab saves a submarine into it (integrity spec 2): the submarine is stored in slot 2, the company has one slot, and the Board shows slot 2 Locked; no page error', ok, { subs: s.subs, slots: s.fcs.fa.unlockedSlots, locked, errors: real(errors) });
      server.close();
    });

    // ── C136 Adoption into a slot that holds two submarines (seeded): the typed name goes on the first, both are stored, the notice is shown. ──
    await guard('C136', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "2, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.click('[data-tab=setup]'); await p1.click('[data-act=edit][data-fc=fa]'); await p1.waitForSelector('[data-act=wnext]');
      await p1.click('[data-act=wnext]'); await p1.click('[data-act=wnext]'); await p1.fill('.wiz input[data-w=name]', 'Typed Two');
      const p2 = await si2Page(ctx, false);
      await si2Raw(p2, "sec.subs.x1 = { fcId: 'fa', slot: 2, name: 'Elsewhere A', rank: 40, voyage: null }; sec.subs.x2 = { fcId: 'fa', slot: 2, name: 'Elsewhere B', rank: 41, voyage: null };");
      await si2ToSave(p1); await p1.click('[data-act=wsave]'); await p1.waitForTimeout(1500);
      const s = await si2Stored(p1), status = await p1.evaluate(() => document.querySelector('#status').textContent.trim());
      await ctx.close();
      const typed = ['x1', 'x2'].filter((k) => s.subs[k] && s.subs[k].name === 'Typed Two');
      const ok = Object.keys(s.subs).sort().join() === 's1,x1,x2' && typed.length === 1 && s.subs.x1.slot === 2 && s.subs.x2.slot === 2 && /^Slot 2 already held “/.test(status) && real(errors).length === 0;
      record('C136', 'Adoption into a slot that already holds two submarines (integrity spec 2, seeded): the typed name is applied to the first, both stay stored in slot 2 and the status line says "Slot 2 already held …"; no page error', ok, { subs: s.subs, status, errors: real(errors) });
      server.close();
    });

    // ── C137 A new-company form and another tab adding a company, Save clicked twice: one company from the form and every submarine has its company. ──
    await guard('C137', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "1, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };");
      await p1.evaluate(async () => { await CC.transact((raw) => { const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc(); doc.chars = [{ id: 'c1', name: 'Alba', lodestone: null, cls: null, gc: 1 }]; doc.updated = Date.now(); return doc; }); }); // one character: the form's company and the other tab's company are for the SAME character
      await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.waitForFunction(() => window.__subs && window.__subs.startWizard);
      await p1.evaluate(() => window.__subs.startWizard()); await p1.waitForSelector('.wiz input[data-w="fc.name"]');
      await p1.fill('.wiz input[data-w="fc.name"]', 'Typed New'); await p1.selectOption('.wiz select[data-w="fc.charId"]', 'c1'); await p1.click('[data-act=wnext]'); await p1.fill('.wiz input[data-w=name]', 'New Sub');
      const p2 = await si2Page(ctx, false);
      await si2Change(p2, "sec.fcs.fq = { name: 'Other Tab Company', charId: 'c1', world: 'Maduin', order: 5, unlockedSlots: 1, discovered: [1, 2, 3] }; sec.subs.sq = { fcId: 'fq', slot: 1, name: 'Other Sub', rank: 30, voyage: null };");
      await si2ToSave(p1); await p1.evaluate(() => { const b = document.querySelector('[data-act=wsave]'); b.click(); b.click(); }); await p1.waitForTimeout(2000);
      const s = await si2Stored(p1);
      await ctx.close();
      const named = Object.keys(s.fcs).filter((k) => s.fcs[k].name === 'Typed New'), orphans = Object.keys(s.subs).filter((k) => !s.fcs[s.subs[k].fcId]);
      const ok = named.length === 1 && Object.keys(s.fcs).length === 3 && Object.keys(s.subs).length === 3 && orphans.length === 0 && Object.values(s.subs).some((x) => x.name === 'New Sub' && x.fcId === named[0]) && s.fcs[named[0]].charId === 'c1' && s.fcs.fq && s.fcs.fq.charId === 'c1' && s.subs.sq && s.subs.sq.fcId === 'fq' && s.fcs.fa && s.subs.s1 && s.subs.s1.fcId === 'fa' && real(errors).length === 0; // the clean-up of a character's duplicate companies may run: it must remove only an empty company, so no submarine loses its company (orphans) and both companies of that character stay
      record('C137', 'A new-company form racing another tab that adds a company, Save clicked twice (integrity spec 2): exactly one company from the form is stored with its submarine, the other tab\'s company and submarine (both companies for the same character) are kept, and every submarine has its company; no page error', ok, { fcs: Object.keys(s.fcs), subs: s.subs, orphans, errors: real(errors) });
      server.close();
    });

    // ── C138 A refused write whose re-read is held, and a sort click during the hold: the "Not saved" line stays, the sort is not stored, a later sort saves. ──
    await guard('C138', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "2, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.waitForFunction(() => window.__subs && window.__subs.write);
      const p2 = await si2Page(ctx, false);
      await si2Change(p2, "sec.subs.s2 = { fcId: 'fa', slot: 2, name: 'Saved Elsewhere', rank: 40, voyage: null };");
      await p1.evaluate(() => { // hold the refused write's re-read (as C69 wraps CC.foldSection)
        const native = CC.read.bind(CC); window.__hold = true; window.__held = [];
        CC.read = function () { if (window.__hold) return new Promise((res) => window.__held.push(() => res(native()))); return native(); };
        window.__subs.section().subs.s9 = { fcId: 'fa', slot: 2, name: 'Typed Here', rank: 10, voyage: null }; window.__subs.write();
      });
      await p1.waitForFunction(() => window.__held.length === 1, null, { timeout: 10000 });
      await p1.click('[data-sort=time]'); // schedules a write 250 ms ahead; the re-read is released before it fires, so the write runs after the recovery
      await p1.waitForTimeout(80); await p1.evaluate(() => { window.__hold = false; window.__held.splice(0).forEach((f) => f()); });
      await p1.waitForTimeout(1500);
      const after = await p1.evaluate(async () => ({ status: document.querySelector('#status').textContent, saved: CC.checkDoc((await CC.read()).raw).modules.submersibles }));
      await p1.click('[data-sort=time]'); await p1.waitForTimeout(1500);
      const later = await si2Stored(p1);
      await ctx.close();
      const ok = /^Not saved on this device: That submarine slot changed elsewhere\./.test(after.status) && /re-enter any unsaved edits/.test(after.status) && !(after.saved.settings.prefs && after.saved.settings.prefs.sort) && !after.saved.subs.s9 && !!after.saved.subs.s2
        && !!(later.settings.prefs && later.settings.prefs.sort === 'time') && real(errors).length === 0;
      record('C138', 'A refused write whose re-read is held and a sort click during the hold (integrity spec 2): the "Not saved on this device: That submarine slot changed elsewhere." line stays, the sort is not stored, the refused submarine is not stored, and a later sort saves', ok, { after, later: later.settings, errors: real(errors) });
      server.close();
    });

    // ── C139 Two tabs on a seeded duplicate, each confirming "Keep this one" for a different submarine: the second is refused and one submarine stays. ──
    await guard('C139', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "2, discovered: [1, 2, 3] }; sec.subs.sa = { fcId: 'fa', slot: 1, name: 'One', rank: 50, voyage: null };"); 
      await si2Raw(p1, "sec.subs.sb = { fcId: 'fa', slot: 1, name: 'Two', rank: 40, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      const p2 = await si2Page(ctx, true);
      for (const p of [p1, p2]) { await p.waitForSelector('[data-clash-sub]'); }
      await p1.click('[data-clash-sub=sa] [data-act=keepsub]'); await p1.waitForTimeout(1500);
      await p2.click('[data-clash-sub=sb] [data-act=keepsub]'); await p2.waitForTimeout(1500);
      const s = await si2Stored(p2), status = await p2.evaluate(() => document.querySelector('#status').textContent);
      await ctx.close();
      const ok = Object.keys(s.subs).join() === 'sa' && /^Not saved on this device: That submarine slot changed elsewhere\./.test(status) && real(errors).length === 0;
      record('C139', 'Two tabs on a seeded two-in-one-slot save, each confirming "Keep this one" for a different submarine (integrity spec 2): the second tab shows "Not saved on this device: That submarine slot changed elsewhere." and exactly one submarine is stored', ok, { subs: Object.keys(s.subs), status, errors: real(errors) });
      server.close();
    });

    // ── C140 The Tracker, the Command Center and the Atelier each refuse the replays of SI-2 (a stale page removes a company another tab put a submarine under) and SI-3 (a stale page edits a removed submarine). ──
    await guard('C140', async () => {
      const server = await start(PORT5);
      const pages = {}, errs = [];
      for (const [name, url] of [['tracker', ROOT5 + 'tracker/'], ['commandCenter', ROOT5 + 'submersibles/'], ['atelier', ROOT5 + 'atelier/']]) {
        const { ctx, errors } = await context(); errs.push(errors);
        const pg = await ctx.newPage(); await pg.goto(url);
        if (name === 'atelier') { await pg.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 60000 }).catch(() => {}); await pg.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 }).catch(() => {}); }
        const settled = async (fn) => { for (let attempt = 0; ; attempt++) { try { await pg.waitForFunction(() => typeof window.CC === 'object' && window.CC, null, { timeout: 30000 }).catch(() => {}); return await pg.evaluate(fn); } catch (e) { if (attempt >= 3 || !/Execution context was destroyed|navigation|Target closed|detached/i.test(String(e && e.message))) throw e; await pg.waitForLoadState('load').catch(() => {}); await pg.waitForTimeout(500); } } };
        pages[name] = await settled(async () => {
          if (typeof window.CC !== 'object' || !window.CC || typeof CC.writeSection !== 'function') return null;
          const clone = (x) => JSON.parse(JSON.stringify(x)), msg = (e) => String(e && e.message);
          const solid = (name, order, c) => ({ name, charId: c, order, unlockedSlots: 2, world: 'Ravana', discovered: [1, 2, 3] });
          const sub = (fc, slot, name) => ({ fcId: fc, slot, name, rank: 10, voyage: null });
          const trip = (s, t) => ({ s, t, r: [1, 2], items: [], newSectors: [] });
          const first = await CC.writeSection('submersibles', { fcs: { fa: solid('Alpha', 0, 'c2'), fb: solid('Beta', 1, 'c1') }, subs: { s2: sub('fa', 2, 'Two'), s3: sub('fa', 1, 'Three') }, trips: { t2: trip('s2', 2) }, settings: {} }, null);
          // SI-2: another page saves a submarine under fb; the stale page removes fb
          const added = clone(first.section); added.subs.s1 = sub('fb', 1, 'Under Beta');
          const w1 = await CC.writeSection('submersibles', added, { rev: first.rev, base: first.section });
          const removing = clone(first.section); delete removing.fcs.fb;
          let orphan = null; try { await CC.writeSection('submersibles', removing, { rev: first.rev, base: first.section }); } catch (e) { orphan = msg(e); }
          // SI-3: another page removes s3 and the logged voyage t2; the stale page edits both
          const gone = clone(w1.section); delete gone.subs.s3; delete gone.trips.t2;
          const w2 = await CC.writeSection('submersibles', gone, { rev: w1.rev, base: w1.section });
          const editSub = clone(w1.section); editSub.subs.s3.name = 'Renamed late';
          let subBack = null; try { await CC.writeSection('submersibles', editSub, { rev: w1.rev, base: w1.section }); } catch (e) { subBack = msg(e); }
          const editTrip = clone(w1.section); editTrip.trips.t2.t = 99;
          let tripBack = null; try { await CC.writeSection('submersibles', editTrip, { rev: w1.rev, base: w1.section }); } catch (e) { tripBack = msg(e); }
          const s = CC.checkDoc((await CC.read()).raw).modules.submersibles;
          return { orphan, subBack, tripBack, subs: Object.keys(s.subs).sort(), fcs: Object.keys(s.fcs).sort(), trips: Object.keys(s.trips) };
        });
        await ctx.close();
      }
      const ok = Object.values(pages).every((p) => p && /has a submarine that was saved in another tab/.test(p.orphan) && p.subBack === 'This submarine was removed on another device or in another tab.' && p.tripBack === 'This logged voyage was removed on another device or in another tab.' && p.subs.join() === 's1,s2' && p.fcs.join() === 'fa,fb' && p.trips.length === 0) && errs.every((e) => real(e).length === 0);
      record('C140', 'The Tracker, the Command Center and the Atelier each refuse the replays of SI-2 and SI-3 (integrity spec 2): removing a company another tab put a submarine under, editing a submarine removed in another tab and editing a logged voyage removed in another tab are refused with the new messages and the stored copy keeps the other tab\'s changes', ok, { pages, errors: errs.map(real) });
      server.close();
    });

    // ── C141 (third review, H1) A merged write finishes while the player edits again: the newer edit is not replaced by the merged copy of the older snapshot.
    //    Round A: the sort click is released before the write timer fires; round B: the timer fires while the first write is still held (the follow-up runs after it). ──
    await guard('C141', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "3, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.waitForFunction(() => window.__subs && window.__subs.write);
      const p2 = await si2Page(ctx, false);
      await p1.evaluate(() => { // hold a write's result after its transaction has stored it
        const native = CC.writeSection.bind(CC); window.__hold = false; window.__held = []; window.__writes = 0;
        CC.writeSection = function () { window.__writes++; const pr = native.apply(null, arguments); if (!window.__hold) return pr; return pr.then((r) => new Promise((res) => window.__held.push(() => res(r)))); };
      });
      const round = async (other, rename, sortKey, wait) => {
        await si2Change(p2, other); // another tab saves: the write below is then a merged one
        await p1.evaluate((rename) => { window.__hold = true; window.__held.length = 0; window.__subs.section().subs.s1.name = rename; window.__subs.write(); }, rename);
        await p1.waitForFunction(() => window.__held.length === 1, null, { timeout: 10000 });
        await p1.click('[data-sort=' + sortKey + ']'); // an edit made while the write is held
        await p1.waitForTimeout(wait); await p1.evaluate(() => { window.__hold = false; window.__held.splice(0).forEach((f) => f()); });
        await p1.waitForTimeout(1800);
        return { stored: await si2Stored(p1), shown: await p1.evaluate(() => JSON.parse(JSON.stringify(window.__subs.section()))), status: await p1.evaluate(() => document.querySelector('#status').textContent) };
      };
      const A = await round("sec.subs.s2 = { fcId: 'fa', slot: 2, name: 'Other Tab A', rank: 40, voyage: null };", 'Renamed A', 'time', 80);
      const B = await round("sec.subs.s3 = { fcId: 'fa', slot: 3, name: 'Other Tab B', rank: 30, voyage: null };", 'Renamed B', 'fc', 600);
      await ctx.close();
      const good = (x, sort, name, others) => !!x.stored.settings.prefs && x.stored.settings.prefs.sort === sort && x.stored.subs.s1.name === name && others.every((o) => !!x.stored.subs[o])
        && x.shown.settings.prefs.sort === sort && x.shown.subs.s1.name === name && others.every((o) => !!x.shown.subs[o]);
      const ok = good(A, 'time', 'Renamed A', ['s2']) && good(B, 'fc', 'Renamed B', ['s2', 's3']) && real(errors).length === 0;
      record('C141', 'A merged write finishes while the player edits again (third review): the newer edit (a sort click) is shown and stored by the follow-up write, the edit the write carried and the other tab\'s submarine are stored too, whether the write timer fires after the held write finishes or while it is held; no page error', ok, { A: { sort: A.stored.settings.prefs, name: A.stored.subs.s1.name, subs: Object.keys(A.stored.subs), shownSort: A.shown.settings.prefs }, B: { sort: B.stored.settings.prefs, name: B.stored.subs.s1.name, subs: Object.keys(B.stored.subs), shownSort: B.shown.settings.prefs }, errors: real(errors) });
      server.close();
    });

    // ── C142 (third review, H2) A refused write whose re-read also fails: the page is blocked (nothing more is written), shows the "cannot be used here" panel with the sentence, and the status line says the same. ──
    await guard('C142', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "2, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.waitForFunction(() => window.__subs && window.__subs.write);
      const p2 = await si2Page(ctx, false);
      await si2Change(p2, "sec.subs.s2 = { fcId: 'fa', slot: 2, name: 'Saved Elsewhere', rank: 40, voyage: null };");
      await p1.evaluate(() => { // the refused write's re-read fails
        const native = CC.read.bind(CC); window.__failRead = true;
        CC.read = function () { if (window.__failRead) return Promise.reject(new Error('read stub')); return native(); };
        window.__subs.section().subs.s9 = { fcId: 'fa', slot: 2, name: 'Typed Here', rank: 10, voyage: null }; window.__subs.write();
      });
      await p1.waitForFunction(() => /reload the page to continue/.test(document.querySelector('#status').textContent), null, { timeout: 10000 });
      const sentence = 'The saved data could not be reloaded after a refused save; reload the page to continue.';
      const shown = await p1.evaluate(() => ({ status: document.querySelector('#status').textContent, panel: (document.querySelector('.note.bad') || {}).textContent || '', state: window.__subs.state() }));
      await p1.evaluate(() => { window.__failRead = false; });
      await p1.evaluate(() => window.__subs.write()); await p1.waitForTimeout(1200); // a further write attempt: nothing is stored
      const later = await si2Stored(p1);
      await ctx.close();
      const ok = shown.state.problem === sentence && shown.panel.includes('The save cannot be used here.') && shown.panel.includes(sentence) && shown.status.includes(sentence) && !later.subs.s9 && !!later.subs.s2 && real(errors).length === 0;
      record('C142', 'A refused write whose re-read fails (third review): the page is blocked with "The saved data could not be reloaded after a refused save; reload the page to continue.", shows the "cannot be used here" panel with it, the status line says it, and a later write stores nothing', ok, { shown, later: Object.keys(later.subs), errors: real(errors) });
      server.close();
    });

    // ── C143 (fourth review, M1) A change waiting for its follow-up save survives another tab's save: the write is held, the player edits (the write timer fires during the hold, so the edit waits),
    //    and the other tab saves while the follow-up is pending. The edit and the other tab's submarine are both stored and shown. ──
    await guard('C143', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, false); // hears the other tab (BroadcastChannel), so its reload() runs
      await tlSeed(p1, SI2_FC + "3, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.waitForFunction(() => window.__subs && window.__subs.write);
      const p2 = await si2Page(ctx, false);
      await p1.evaluate(() => {
        const native = CC.writeSection.bind(CC); window.__hold = true; window.__held = [];
        CC.writeSection = function () { const pr = native.apply(null, arguments); if (!window.__hold) return pr; return pr.then((r) => new Promise((res) => window.__held.push(() => res(r)))); };
        window.__subs.section().subs.s1.name = 'Renamed M1'; window.__subs.write();
      });
      await p1.waitForFunction(() => window.__held.length === 1, null, { timeout: 10000 });
      await p1.click('[data-sort=time]'); await p1.waitForTimeout(700); // the timer has fired during the hold: the sort edit waits for its follow-up save
      await si2Change(p2, "sec.subs.s2 = { fcId: 'fa', slot: 2, name: 'Other Tab M1', rank: 40, voyage: null };"); // the other tab saves: p1 hears it
      await p1.waitForTimeout(900);
      await p1.evaluate(() => { window.__hold = false; window.__held.splice(0).forEach((f) => f()); });
      await p1.waitForTimeout(1800);
      const stored = await si2Stored(p1), shown = await p1.evaluate(() => JSON.parse(JSON.stringify(window.__subs.section())));
      await ctx.close();
      const good = (x) => !!x.settings.prefs && x.settings.prefs.sort === 'time' && x.subs.s1.name === 'Renamed M1' && !!x.subs.s2 && x.subs.s2.name === 'Other Tab M1';
      const ok = good(stored) && good(shown) && real(errors).length === 0;
      record('C143', 'An edit waiting for its follow-up save survives another tab\'s save (fourth review, M1): the sort click made while a write is held, then the other tab\'s new submarine arriving, both end up stored and shown, with the rename the write carried', ok, { stored: { sort: stored.settings.prefs, name: stored.subs.s1.name, subs: Object.keys(stored.subs) }, shown: { sort: shown.settings.prefs, name: shown.subs.s1.name, subs: Object.keys(shown.subs) }, errors: real(errors) });
      server.close();
    });

    // ── C144 (fourth review, M2) The other tab renames a submarine, the player changes its rank while a merged write is held: the follow-up save is refused by the store's rule, the page says so and shows the stored copy with the other tab's name. ──
    await guard('C144', async () => {
      const server = await start(PORT5);
      const { ctx, errors } = await context({ viewport: { width: 1280, height: 1000 } });
      const p1 = await si2Page(ctx, true);
      await tlSeed(p1, SI2_FC + "3, discovered: [1, 2, 3] }; sec.subs.s1 = { fcId: 'fa', slot: 1, name: 'First', rank: 50, voyage: null }; sec.subs.s2 = { fcId: 'fa', slot: 2, name: 'Second', rank: 50, voyage: null };"); await p1.reload(); await p1.waitForSelector('html[data-ready="1"]');
      await p1.waitForFunction(() => window.__subs && window.__subs.schedule);
      const p2 = await si2Page(ctx, false);
      await p1.evaluate(() => {
        const native = CC.writeSection.bind(CC); window.__hold = false; window.__held = [];
        CC.writeSection = function () { const pr = native.apply(null, arguments); if (!window.__hold) return pr; return pr.then((r) => new Promise((res) => window.__held.push(() => res(r)))); };
      });
      await si2Change(p2, "sec.subs.s1.name = 'Renamed Elsewhere';"); // the write below is then a merged one
      await p1.evaluate(() => { window.__hold = true; window.__subs.section().subs.s2.name = 'Second 2'; window.__subs.write(); });
      await p1.waitForFunction(() => window.__held.length === 1, null, { timeout: 10000 });
      await p1.evaluate(() => { window.__subs.section().subs.s1.rank = 70; window.__subs.schedule(); }); // the player's edit of the same submarine, during the write
      await p1.waitForTimeout(600);
      await p1.evaluate(() => { window.__hold = false; window.__held.splice(0).forEach((f) => f()); });
      await p1.waitForTimeout(1800);
      const stored = await si2Stored(p1), status = await p1.evaluate(() => document.querySelector('#status').textContent), shown = await p1.evaluate(() => JSON.parse(JSON.stringify(window.__subs.section())));
      await ctx.close();
      const ok = stored.subs.s1.name === 'Renamed Elsewhere' && stored.subs.s1.rank === 50 && stored.subs.s2.name === 'Second 2' && shown.subs.s1.name === 'Renamed Elsewhere' && shown.subs.s1.rank === 50
        && status.includes('Not saved on this device: This submarine changed in another tab or on another device.') && real(errors).length === 0;
      record('C144', 'A submarine changed in two tabs, the second change made while a merged write is held (fourth review, M2): the follow-up save is refused with "This submarine changed in another tab or on another device.", the page shows the stored copy, the other tab\'s name stays and the first write\'s other change is stored', ok, { stored: { s1: stored.subs.s1, s2: stored.subs.s2 }, shownS1: shown.subs.s1, status, errors: real(errors) });
      server.close();
    });

    // ── C145 (Lists, W3) The Lists section is kept byte for byte by every app. Each of the three newly built apps and the Tracker and Atelier builds shipped at the merge base (written to a temporary folder with git show and
    //    served beside the site) saves the same full lists section, then saves another module; the lists section read back is identical to what was sent, and the new builds' own checker leaves it unchanged. ──
    await guard('C145', async () => {
      const gitOut = (args) => execFileSync('git', args, { cwd: path.join(T, '..'), maxBuffer: 256 * 1024 * 1024 });
      let base;
      try { base = gitOut(['merge-base', 'HEAD', 'origin/main']).toString().trim(); gitOut(['cat-file', '-e', base + '^{commit}']); }
      catch (e) { throw new Error('the merge base with origin/main cannot be read (the checkout needs the history; the workflow uses fetch-depth: 0): ' + String(e.message).split('\n')[0]); }
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lists-old-'));
      const written = {};
      for (const [name, rel] of [['tracker', 'tracker/site'], ['atelier', 'crafting/atelier/site']]) {
        const dir = path.join(tmp, name);
        const files = gitOut(['ls-tree', '-r', '--name-only', base, rel]).toString().split('\n').filter(Boolean);
        if (!files.length) throw new Error('no files of ' + rel + ' at ' + base);
        for (const f of files) { const dest = path.join(dir, f.slice(rel.length + 1)); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, gitOut(['show', base + ':' + f])); }
        written[name] = dir;
      }
      const mounts = [[BASE + 'old-tracker/', written.tracker], [BASE + 'old-atelier/', written.atelier]];
      MOUNTS.unshift(...mounts);
      const server = await start(PORT5);
      const pages = {}, errs = [];
      try {
        for (const [name, url] of [['tracker', ROOT5 + 'tracker/'], ['commandCenter', ROOT5 + 'submersibles/'], ['atelier', ROOT5 + 'atelier/'], ['oldTracker', ROOT5 + 'old-tracker/'], ['oldAtelier', ROOT5 + 'old-atelier/']]) {
          const { ctx, errors } = await context(); errs.push(errors);
          const pg = await ctx.newPage(); await pg.goto(url);
          if (/atelier/i.test(name)) { await pg.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 60000 }).catch(() => {}); await pg.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 }).catch(() => {}); }
          for (let attempt = 0; ; attempt++) {
            try {
              await pg.waitForFunction(() => typeof window.CC === 'object' && window.CC, null, { timeout: 30000 }).catch(() => {});
              pages[name] = await pg.evaluate(async () => {
                if (typeof window.CC !== 'object' || !window.CC || typeof CC.writeSection !== 'function') return null;
                const sample = { v: 1, lists: { l1aaaaaaaaaa: { name: 'Food', charId: 'c1', order: 0, made: 1760000000000, data: '7.57h1 44948e4c 70429e21', steps: { s1aaaaaaaaaa: { name: 'First', n: 0 }, s2aaaaaaaaaa: { name: 'Second', n: 1 } } }, l2bbbbbbbbbb: { name: 'Gear', charId: null, order: 1, made: 1760000001000, data: '7.57h1 44948e4c 70429e21' } },
                  targets: { 'l1aaaaaaaaaa.t1aaaaaaaaaa': { item: 5057, recipe: 1000, qty: 3, hq: true, make: true, crafted: 1, step: 's2aaaaaaaaaa', at: 1760000002000 }, 'l1aaaaaaaaaa.t2bbbbbbbbbb': { item: 5058, recipe: 0, qty: 99999, coll: true, step: 'nosuchstep1', done: true, at: 1760000003000 } },
                  ways: { 'c1.5057': { by: 'trade', recipe: 1001, hq: true, offer: '1016902.15.14944' }, 'u.5058': { by: 'have' } }, owners: { c1: { order: 'market trade gather craft vendor' }, u: {} },
                  have: { 'c1.5057': { nq: 4, hq: 2, coll: 0 }, 'u.5058': { nq: 0, hq: 0, coll: 7 } }, prefs: { priceWorld: 'Ravana', hideDone: true, combined: { l1aaaaaaaaaa: 1, l2bbbbbbbbbb: 1 } } };
                const sent = JSON.stringify(sample), clone = (x) => JSON.parse(JSON.stringify(x));
                const first = await CC.writeSection('lists', clone(sample), null);
                const sub = { fcs: { fa: { name: 'Alpha', charId: 'c1', order: 0, unlockedSlots: 2, world: 'Ravana', discovered: [1, 2, 3] } }, subs: {}, trips: {}, settings: {} };
                const other = await CC.writeSection('submersibles', sub, { rev: first.rev, base: null }).then(() => 'ok', (e) => String(e && e.message));
                let tracker = 'not run';
                if (typeof ET === 'object' && ET && typeof ET.saveState === 'function' && typeof ET.stateFromDoc === 'function') {
                  const r = await CC.read(), st = ET.stateFromDoc(CC.checkDoc(r.raw)) || (typeof ET.newState === 'function' ? ET.newState(['A']) : null);
                  tracker = st ? await ET.saveState(st, true).then((v) => (v ? 'saved' : 'refused'), (e) => String(e && e.message)) : 'no state';
                }
                const raw = (await CC.read()).raw, listsNow = JSON.stringify(raw.modules.lists), checked = JSON.stringify(CC.checkDoc(clone(raw)).modules.lists);
                return { sent: listsNow === sent, other, tracker, checkedSame: checked === sent, hasChecker: typeof CC.checkLists };
              });
              break;
            } catch (e) { if (attempt >= 3 || !/context|navigation|destroyed/i.test(String(e.message))) throw e; await pg.waitForTimeout(500); }
          }
          await ctx.close();
        }
      } finally { MOUNTS.splice(MOUNTS.indexOf(mounts[0]), 2); fs.rmSync(tmp, { recursive: true, force: true }); }
      const newOnes = ['tracker', 'commandCenter', 'atelier'], oldOnes = ['oldTracker', 'oldAtelier'];
      const ok = Object.keys(pages).length === 5 && Object.values(pages).every((p) => p && p.sent === true && p.other === 'ok') && newOnes.every((n) => pages[n].hasChecker === 'function' && pages[n].checkedSame === true)
        && oldOnes.every((n) => pages[n].hasChecker === 'undefined') && ['tracker', 'oldTracker'].every((n) => pages[n].tracker === 'saved' || pages[n].tracker === 'not run') && errs.every((e) => real(e).length === 0);
      record('C145', 'The Lists section survives a save of another module (and the Tracker\'s own save) byte for byte in the three new builds and in the Tracker and Atelier builds shipped at the merge base (git show of ' + base.slice(0, 12) + '); the new builds\' checker CC.checkLists leaves it unchanged', ok, { pages, base });
      server.close();
    });

    // ── C146 (Lists, W4) Two devices on the stand-ins meet over a list. (A) One device removed a whole list, the other changed an item of it: the Settings sync
    //    says the devices disagree and changes nothing; the Tracker asks one question for the whole list, names it and says what each answer does; closing the dialog
    //    answers nothing (the list stays, the next opening asks again); Keep leaves the list and the changed item on both devices and the cloud copy; Remove takes the
    //    list and its items from both. (B) One device removed a wanted item the other changed: one question that names the list and the item; Keep leaves the changed
    //    item everywhere, Remove removes it everywhere; nothing is asked again afterwards. ──
    await guard('C146', async () => {
      const zlib = require('zlib');
      const server4 = await start(PORT4, { standins: true });
      const st = server4.standins;
      const unpack = (doc) => JSON.parse(zlib.inflateRawSync(Buffer.from(doc.data, 'base64')).toString('utf8'));
      const ready = async (pg) => { await pg.waitForFunction(() => window.__settings, null, { timeout: 10000 }); await pg.evaluate(() => window.__settings.ready()); };
      const msgOf = (pg) => pg.evaluate(() => ((document.querySelector('#settings .set-msg') || {}).textContent || ''));
      const blank = (pg) => pg.evaluate(() => { const m = document.querySelector('#settings .set-msg'); if (m) m.textContent = ''; });
      const sync = async (pg) => {
        await pg.bringToFront(); await blank(pg); await pg.click('#settings [data-act=sync]');
        await pg.waitForFunction(() => /Synced \d|disagree/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(700); return msgOf(pg);
      };
      const deviceKey = (ch, rt) => { const key = ch.repeat(64); st.kv.set(key, JSON.stringify({ rt, at: 1, used: 1 })); st.state.refreshes.set(rt, true); return key; };
      const device = async (ctx, key, withChars) => {
        const pg = await ctx.newPage(); await pg.goto(ROOT4 + '#settings'); await ready(pg);
        if (withChars) { await pg.click('#settings [data-act=first]'); await pg.waitForSelector('#settings [data-set=name][data-id=c1]'); for (let i = 0; i < 100 && !(await pg.evaluate(async () => { try { return CC.checkDoc((await CC.read()).raw).chars.length === 1; } catch (e) { return false; } })); i++) await pg.waitForTimeout(100); }
        await pg.evaluate((d) => localStorage.setItem('eveniunt-cloud-device', JSON.stringify({ device: d, at: 1 })), key);
        await pg.reload(); await ready(pg);
        await pg.waitForFunction(() => /Synced \d/.test((document.querySelector('#settings .set-msg') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
        return pg;
      };
      // another page changes the Lists section the way the module does: read, change, write with its own stamp and base
      const edit = (pg, change) => pg.evaluate(async (src) => {
        const r = await CC.read(), d = CC.checkDoc(r.raw), base = d.modules.lists || null;
        const sec = JSON.parse(JSON.stringify(base || { v: 1, lists: {}, targets: {}, ways: {}, owners: {}, have: {}, prefs: {} }));
        (new Function('sec', '(' + src + ')(sec)'))(sec);
        await CC.writeSection('lists', sec, { rev: r.rev, base });
      }, change.toString());
      const listsOf = (pg) => pg.evaluate(async () => { try { return CC.checkDoc((await CC.read()).raw).modules.lists || null; } catch (e) { return null; } });
      const cloudLists = () => (st.state.files.f1 ? ((unpack(st.state.files.f1).modules || {}).lists || null) : null);
      const seed = (sec) => { sec.lists['lfood00001'] = { name: 'Food', charId: 'c1', order: 0, made: 1760000000000, data: '7.57h1 44948e4c 70429e21' }; sec.targets['lfood00001.t1aaaaaaaa'] = { item: 5057, recipe: 0, qty: 3, at: 1760000001000 }; sec.targets['lfood00001.t2bbbbbbbb'] = { item: 5058, recipe: 0, qty: 1, at: 1760000002000 }; };
      // the Settings page holds the save as it read it: a change another page wrote reaches it when it opens again
      const reopen = async (pg) => { await pg.reload(); await ready(pg); await pg.waitForTimeout(800); };
      // the Tracker opens, asks (or not), and each question is answered 'local', 'remote' or left (Escape)
      const asking = async (ctx, answer) => {
        const t = await ctx.newPage(); await t.goto(ROOT4 + 'tracker/');
        await t.waitForFunction(() => window.__tracker && window.__tracker.ST, null, { timeout: 30000 });
        const shown = await t.waitForSelector('dialog[open] .conf', { timeout: 20000 }).then(() => true, () => false);
        let rows = [];
        if (shown) {
          rows = await t.evaluate(() => [...document.querySelectorAll('dialog[open] .conf')].map((c) => ({ id: c.querySelector('[data-pick]').dataset.pick, text: c.querySelector('.w').textContent })));
          if (answer === null) { await t.keyboard.press('Escape'); await t.waitForTimeout(800); }
          else {
            for (const r of rows) await t.evaluate(({ id, v }) => { for (const b of document.querySelectorAll('dialog[open] [data-pick]')) if (b.dataset.pick === id && b.dataset.v === v) b.click(); }, { id: r.id, v: answer });
            await t.click('dialog[open] #apply'); await t.waitForTimeout(3000);
          }
        }
        await t.close(); return { shown, rows };
      };
      const names = (sec) => ({ lists: Object.keys((sec || {}).lists || {}).sort(), targets: Object.entries((sec || {}).targets || {}).map(([k, v]) => k + ':' + v.qty).sort() });
      const outcome = {};
      // one scenario: a holds the list, b removes `removal`, a changes `change`; the Settings sync reports the disagreement; the Tracker is asked
      async function scenario(tag, chA, chB, removal, change, answers) {
        st.state.files = {}; st.state.etag = {};
        const one = await context(), two = await context();
        const a = await device(one.ctx, deviceKey(chA, 'rt-146' + tag + 'a'), true);
        await edit(a, seed); await reopen(a); await sync(a);
        const b = await device(two.ctx, deviceKey(chB, 'rt-146' + tag + 'b'), false);
        for (let i = 0; i < 100 && !names(await listsOf(b)).lists.length; i++) await b.waitForTimeout(200);
        const bHad = names(await listsOf(b));
        await edit(b, removal); await reopen(b); await sync(b);
        await edit(a, change); await reopen(a);
        const msgA = await sync(a), afterA = names(await listsOf(a)), cloudBefore = names(cloudLists());
        const rounds = [];
        for (const answer of answers) rounds.push(await asking(one.ctx, answer));
        await sync(b); await sync(a); await sync(b);
        const fa = names(await listsOf(a)), fb = names(await listsOf(b)), fc = names(cloudLists());
        const again = await asking(one.ctx, 'local').then((r) => r.shown);
        const errs = real(one.errors).concat(real(two.errors));
        await one.ctx.close(); await two.ctx.close();
        return { msgA, bHad, afterA, cloudBefore, rounds, final: { a: fa, b: fb, cloud: fc }, askedAfter: again, errors: errs };
      }
      const changed = ['lfood00001.t1aaaaaaaa:7', 'lfood00001.t2bbbbbbbb:1'];
      const removeList = (sec) => { delete sec.lists['lfood00001']; delete sec.targets['lfood00001.t1aaaaaaaa']; delete sec.targets['lfood00001.t2bbbbbbbb']; };
      const changeItem = (sec) => { sec.targets['lfood00001.t1aaaaaaaa'].qty = 7; };
      const removeItem = (sec) => { delete sec.targets['lfood00001.t1aaaaaaaa']; };
      const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
      // (A) the whole list: closed without an answer (asked again), then Keep (this device holds the list and the other removed it)
      const a1 = await scenario('a', 'e', 'f', removeList, changeItem, [null, 'local']);
      const okA1 = /disagree on 1 entry/.test(a1.msgA) && same(a1.bHad.lists, ['lfood00001']) && same(a1.afterA.targets, changed) && same(a1.cloudBefore.lists, [])
        && a1.rounds.length === 2 && a1.rounds.every((r) => r.shown && r.rows.length === 1 && /Lists: list “Food”/.test(r.rows[0].text) && /the list is kept: choosing this keeps it and its 2 wanted items/.test(r.rows[0].text) && /the list is removed: choosing this removes it and its 2 wanted items on both devices/.test(r.rows[0].text))
        && same(a1.final.a, { lists: ['lfood00001'], targets: changed }) && same(a1.final.b, a1.final.a) && same(a1.final.cloud, a1.final.a) && !a1.askedAfter && a1.errors.length === 0;
      // (A) Remove: the same disagreement, the owner says the other device is right
      const a2 = await scenario('b', 'a', 'b', removeList, changeItem, ['remote']);
      const okA2 = /disagree on 1 entry/.test(a2.msgA) && a2.rounds.length === 1 && a2.rounds[0].shown && a2.rounds[0].rows.length === 1 && same(a2.final.a, { lists: [], targets: [] }) && same(a2.final.b, a2.final.a) && same(a2.final.cloud, a2.final.a) && !a2.askedAfter && a2.errors.length === 0;
      // (B) removed against changed: a wanted item removed on the other device, changed here
      const b1 = await scenario('c', 'c', 'd', removeItem, changeItem, ['local']);
      const okB1 = /disagree on 1 entry/.test(b1.msgA) && b1.rounds.length === 1 && b1.rounds[0].shown && b1.rounds[0].rows.length === 1 && /Lists: “Food”: a wanted item \(item 5057, 7 wanted\)/.test(b1.rounds[0].rows[0].text) && /\(removed\)/.test(b1.rounds[0].rows[0].text)
        && same(b1.final.a, { lists: ['lfood00001'], targets: changed }) && same(b1.final.b, b1.final.a) && same(b1.final.cloud, b1.final.a) && !b1.askedAfter && b1.errors.length === 0;
      const b2 = await scenario('d', '1', '2', removeItem, changeItem, ['remote']);
      const okB2 = /disagree on 1 entry/.test(b2.msgA) && b2.rounds.length === 1 && b2.rounds[0].shown && same(b2.final.a, { lists: ['lfood00001'], targets: ['lfood00001.t2bbbbbbbb:1'] }) && same(b2.final.b, b2.final.a) && same(b2.final.cloud, b2.final.a) && !b2.askedAfter && b2.errors.length === 0;
      outcome.a1 = a1; outcome.a2 = a2; outcome.b1 = b1; outcome.b2 = b2;
      record('C146', 'Two devices (stand-ins) meet over a list: (A) removed whole on one device and an item changed on the other: the Settings sync says the devices disagree, the Tracker asks one question that names the list and says what each answer does; closing the dialog changes nothing and it is asked again; Keep leaves the list and the changed item on both devices and the cloud copy, Remove takes the list and its items from all three; (B) a wanted item removed on one device and changed on the other: one question naming the list and the item; Keep leaves the changed item, Remove removes it everywhere; nothing is asked again afterwards',
        okA1 && okA2 && okB1 && okB2, { okA1, okA2, okB1, okB2, outcome });
    });

    // ── C147 (Lists, W6) The Lists page opens from the switcher and from the home card, shows "Your lists" with its empty state, works offline after one
    //    visit, raises no page error and has no sideways scroll at 360 px; the data file is the real one (unpacked, with its crafting log and the no-hand-over list).
    await guard('C147', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await context();
      const page = await ctx.newPage();
      const LISTS = ROOT5 + 'lists/';
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
      const state = (pg) => pg.evaluate(() => ({ url: location.href, isolated: self.crossOriginIsolated, controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
        text: document.querySelector('#view').textContent.trim(), buttons: [...document.querySelectorAll('#view .btn')].map((b) => b.textContent.trim()), back: (document.querySelector('.cc-back') || {}).href,
        side: document.documentElement.scrollWidth - innerWidth, current: (document.querySelector('.switcher [aria-current=page]') || {}).textContent,
        data: window.__lists.data() && { recipes: Object.keys(window.__lists.data().recipes).length, log: Object.keys(window.__lists.data().log).length, noHand: window.__lists.data().noHandOver.length, stamp: window.__lists.data().stamp } }));
      await page.goto(ROOT5); await shellControlled(page);
      const shell = await shellState(page);
      await page.click('.switcher a[data-module="lists"]'); await ready(page);
      const fromSwitcher = await state(page);
      await page.click('.cc-back'); await page.waitForSelector('.modules');
      await page.click('.modules a[data-module="lists"]'); await ready(page);
      await ctx.setOffline(true);
      await page.reload(); await ready(page);
      const offline = await state(page);
      await ctx.setOffline(false);
      await page.setViewportSize({ width: 360, height: 740 });
      await page.reload(); await ready(page);
      const phone = await state(page);
      await ctx.close();
      const want = 'No lists yet. Start one, or build one from the crafting-log pages you have not finished.';
      const ok = JSON.stringify(shell.modules) === '["Home","Tracker","Atelier","Submersibles","Lists","⚙ Settings"]' && shell.cards === 4 &&
        fromSwitcher.url === LISTS && fromSwitcher.isolated === false && fromSwitcher.controller === ROOT5 + 'sw.js' && fromSwitcher.back === ROOT5 && fromSwitcher.current === 'Lists' &&
        fromSwitcher.text.startsWith(want) && fromSwitcher.buttons.join() === 'New list,From the crafting log' &&
        fromSwitcher.data && fromSwitcher.data.recipes > 13000 && fromSwitcher.data.log === 8 && /^\d/.test(fromSwitcher.data.stamp) &&
        offline.url === LISTS && offline.text.startsWith(want) && offline.data && offline.data.recipes === fromSwitcher.data.recipes &&
        phone.side <= 0 && phone.text.startsWith(want) && real(errors).length === 0 && external.length === 0;
      record('C147', 'The Lists page opens from the switcher and the home card, shows "Your lists" with its empty state, is not isolated, works offline after one visit, has no page error and no sideways scroll at 360 px',
        ok, { shell: { modules: shell.modules, cards: shell.cards }, fromSwitcher, offline, phone, errors: real(errors), external });
      void server;
    });

    // ── Lists, W7: the page's edits on the small fixture (stand-in game data, no network): C148 one tab, C149 two tabs, C165 undo across tabs. ──
    const LISTS_FIXTURE = fs.readFileSync(path.join(T, 'tests', 'fixtures', 'lists-fixture.json'), 'utf8');
    const listsCtx = async () => {
      const c = await context({ serviceWorkers: 'block' });
      await c.ctx.route('**/lists/data.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.LISTS_DATA = ' + LISTS_FIXTURE + ';' }));
      // W9: every Lists page answers Universalis with a stand-in (spec section 8, intro). `stand.reply(ids)` is null for the default answer (one cheap listing for each
      // item), 'abort' for a failed fetch, a number for that status, or { id: reply } (an id left out of it is left out of the answer).
      const stand = { asked: [], reply: null };
      await c.ctx.route('https://universalis.app/**', (r) => {
        const u = new URL(r.request().url()), ids = u.pathname.split('/').pop().split(','), cors = { 'access-control-allow-origin': '*' };
        stand.asked.push(u.pathname.split('/')[3] + ':' + ids.join(',') + u.search);
        const x = stand.reply ? stand.reply(ids) : null;
        if (x === 'abort') return r.abort('failed');
        if (typeof x === 'number') return r.fulfill({ status: x, contentType: 'application/json', headers: cors, body: '{}' });
        const items = {}; ids.forEach((id) => { if (!x) items[id] = { itemID: +id, listings: [{ pricePerUnit: 100, worldName: 'Test' }], averagePrice: 100 }; else if (x[id] !== undefined) items[id] = Object.assign({ itemID: +id }, x[id]); });
        r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(ids.length === 1 ? (items[ids[0]] || {}) : { items }) });
      });
      c.stand = stand;
      return c;
    };
    const lReady = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
    const lSettle = (pg) => pg.waitForFunction(() => window.__lists && !window.__lists.state.busy && !window.__lists.state.queue.length, null, { timeout: 15000 });
    const lStored = (pg) => pg.evaluate(async () => { const d = CC.checkDoc((await CC.read()).raw); return d.modules.lists || null; });
    const lOpenFirst = async (pg) => { await pg.click('.list-card [data-act=open]'); await pg.waitForSelector('.wanted-row, .empty-line'); };
    const lMake = async (pg, name) => { await pg.click('[data-act=new]'); await pg.fill('[data-f=newname]', name); await pg.click('[data-act=create]'); await lSettle(pg); await pg.waitForSelector('[data-f=listname]'); };
    const lAdd = async (pg, query, id, qty) => { await pg.fill('[data-f=addqty]', String(qty)); await pg.fill('[data-f=search]', query); await pg.click('button[data-act=add][data-item="' + id + '"]'); await lSettle(pg); };
    const lRow = (pg, id) => pg.locator('.wanted-row[data-item="' + id + '"]');
    const lType = async (pg, id, field, v) => { const el = lRow(pg, id).locator('[data-f=' + field + ']'); await el.fill(String(v)); await el.press('Tab'); await lSettle(pg); };
    const lNote = (pg) => pg.evaluate(() => (document.querySelector('.lists-status') || {}).textContent || '');
    const lTargets = (sec) => Object.values((sec && sec.targets) || {});
    const lQty = (sec, item) => (lTargets(sec).filter((t) => t.item === item)[0] || {}).qty;

    // ── C148 (Lists, W7) One tab: make a list, add wanted items, change amounts, type stock (I have, minus, plus), a cleared amount keeps the item, flags are kept together, and a reload keeps all. ──
    await guard('C148', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lMake(page, 'Food');
      ck.listOpen = (await page.inputValue('[data-f=listname]')) === 'Food';
      await lAdd(page, 'grand', 100, 2); await lAdd(page, 'mythril', 130, 1); await lAdd(page, 'collectable piece', 160, 1);
      ck.rows = await page.locator('.wanted-row').count() === 3;
      ck.qty2 = (await lRow(page, 100).locator('[data-f=qty]').inputValue()) === '2';
      await lType(page, 100, 'qty', 5);
      ck.qty5 = lQty(await lStored(page), 100) === 5;
      await lType(page, 100, 'qty', '');
      ck.clearedKeeps = lQty(await lStored(page), 100) === 5 && (await lRow(page, 100).locator('[data-f=qty]').inputValue()) === '5' && (await page.locator('.wanted-row').count()) === 3;
      await lType(page, 130, 'have', 4);
      let sec = await lStored(page);
      ck.have4 = JSON.stringify(sec.have['u.130']) === '{"nq":4,"hq":0,"coll":0}' && /have 4/.test(await lRow(page, 130).locator('.w-count').textContent());
      await lRow(page, 130).locator('[data-act=plus]').click(); await lSettle(page);
      await lRow(page, 130).locator('[data-act=plus]').click(); await lSettle(page);
      await lRow(page, 130).locator('[data-act=minus]').click(); await lSettle(page);
      ck.plusMinus = (await lStored(page)).have['u.130'].nq === 5;
      await lType(page, 130, 'have', 0);
      ck.zeroRemoves = (await lStored(page)).have['u.130'] === undefined;
      await lType(page, 130, 'have', 3);
      await lRow(page, 160).locator('[data-f=flag][data-flag=hq]').check(); await lSettle(page);
      await lRow(page, 160).locator('[data-f=flag][data-flag=coll]').check(); await lSettle(page);
      sec = await lStored(page);
      const t160 = lTargets(sec).filter((t) => t.item === 160)[0];
      ck.flagsTogether = t160.hq === true && t160.coll === true;
      await lRow(page, 100).locator('[data-act=ask-remove]').click(); await lRow(page, 100).locator('[data-act=remove]').click(); await lSettle(page);
      ck.removed = lQty(await lStored(page), 100) === undefined && lTargets(await lStored(page)).length === 2;
      ck.undoShown = (await page.locator('[data-act=undo][data-i="0"]').count()) === 1;
      await page.click('[data-act=undo][data-i="0"]'); await lSettle(page);
      ck.undoneBack = lQty(await lStored(page), 100) === 5;
      const before = await lStored(page);
      await page.reload(); await lReady(page);
      const after = await lStored(page);
      ck.reloadSame = JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(after.lists).length > 10;
      await lOpenFirst(page);
      ck.reloadShows = (await lRow(page, 100).locator('[data-f=qty]').inputValue()) === '5' && (await lRow(page, 130).locator('[data-f=have]').inputValue()) === '3' &&
        (await lRow(page, 160).locator('[data-f=flag][data-flag=coll]').isChecked()) && (await lRow(page, 160).locator('[data-f=flag][data-flag=hq]').isChecked());
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C148', 'Lists page: a new list, wanted items added and removed, amounts changed, a cleared amount keeps the item, stock typed with I have, plus and minus, flags kept together, Undo, and a reload shows all of it',
        Object.values(ck).every(Boolean), { ck, errors: real(errors), external });
      void server;
    });

    // ── C149 (Lists, W7) Two tabs on one save: different wanted items both kept; a stale edit inside a list another tab removed shows "Not saved" with the list's text and changes
    //    nothing; a stale removal of an item the other tab changed is refused. A tab's copy is held stale with __lists.hold. ──
    await guard('C149', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const a = await ctx.newPage(), b = await ctx.newPage();
      for (const p of [a, b]) { await p.goto(ROOT5 + 'lists/'); await lReady(p); }
      const ck = {};
      await lMake(a, 'Shared'); await lAdd(a, 'grand', 100, 2); await lAdd(a, 'mythril', 130, 3);
      await b.evaluate(() => window.__lists.reload()); await b.waitForSelector('.list-card'); await lOpenFirst(b);
      ck.bothShow = (await lRow(b, 100).count()) === 1 && (await lRow(b, 130).count()) === 1;
      // (1) different items, both stale
      for (const p of [a, b]) await p.evaluate(() => window.__lists.hold(true));
      await lType(a, 100, 'qty', 4); await lType(b, 130, 'qty', 6);
      let sec = await lStored(a);
      ck.differentItems = lQty(sec, 100) === 4 && lQty(sec, 130) === 6;
      for (const p of [a, b]) await p.evaluate(() => window.__lists.hold(false));
      await a.evaluate(() => window.__lists.reload()); await b.evaluate(() => window.__lists.reload());
      // (2) a stale edit inside a removed list
      await b.evaluate(() => window.__lists.hold(true));
      await a.click('[data-act=back]'); await a.click('[data-act=ask-remove-list]'); await a.click('[data-act=remove-list]'); await lSettle(a);
      ck.listGone = Object.keys((await lStored(a)).lists).length === 0;
      const frozen = JSON.stringify(await lStored(b));
      await lType(b, 100, 'qty', 9);
      const note = await lNote(b), after2 = await lStored(b);
      ck.staleInRemoved = note.includes('Not saved on this device: This list was removed on another device or in another tab.') && JSON.stringify(after2) === frozen && Object.keys(after2.lists).length === 0 && lTargets(after2).length === 0;
      await b.evaluate(() => window.__lists.hold(false));
      // (3) a stale removal of an item the other tab changed
      await b.evaluate(() => window.__lists.reload());
      await lMake(a, 'Second'); await lAdd(a, 'grand', 100, 2);
      await b.evaluate(() => window.__lists.reload()); await b.waitForSelector('.list-card'); await lOpenFirst(b);
      await b.evaluate(() => window.__lists.hold(true));
      await lType(a, 100, 'qty', 8);
      await lRow(b, 100).locator('[data-act=ask-remove]').click(); await lRow(b, 100).locator('[data-act=remove]').click(); await lSettle(b);
      const note3 = await lNote(b), after3 = await lStored(b);
      ck.staleRemovalRefused = note3.includes('Not saved on this device: This was changed on another device or in another tab, so it was not removed.') && lQty(after3, 100) === 8;
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C149', 'Lists page, two tabs: different wanted items are both kept; a stale edit inside a list the other tab removed says Not saved with the list\'s text and stores nothing; a stale removal of an item the other tab changed is refused',
        Object.values(ck).every(Boolean), { ck, notes: [note, note3], errors: real(errors), external });
      void server;
    });

    // ── C165 (Lists, W7) Undo across tabs: tab A buys 1, tab B types 10 for the same item, tab A's Undo is refused with its line and the count stays 10; without tab B's edit the Undo works. ──
    await guard('C165', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const a = await ctx.newPage(), b = await ctx.newPage();
      for (const p of [a, b]) { await p.goto(ROOT5 + 'lists/'); await lReady(p); }
      const ck = {};
      await lMake(a, 'Buying'); await lAdd(a, 'mythril', 130, 3);
      await b.evaluate(() => window.__lists.reload()); await b.waitForSelector('.list-card'); await lOpenFirst(b);
      const buyOne = async (p) => { await lRow(p, 130).locator('[data-act=ask-bought]').click(); await lRow(p, 130).locator('[data-f=boughtn]').fill('1'); await lRow(p, 130).locator('[data-act=bought]').click(); await lSettle(p); };
      await buyOne(a);
      ck.bought1 = (await lStored(a)).have['u.130'].nq === 1;
      ck.offers = (await a.locator('[data-act=rest]').count()) >= 1;
      await a.evaluate(() => window.__lists.hold(true));
      await lType(b, 130, 'have', 10);
      ck.typed10 = (await lStored(b)).have['u.130'].nq === 10;
      await a.click('[data-act=undo][data-i="0"]'); await lSettle(a);
      const note = await lNote(a);
      ck.refused = note.includes('Undo was not done: this was changed again since, here or on another device. Nothing was changed.') && (await lStored(a)).have['u.130'].nq === 10;
      ck.entryDropped = !/Bought 1 Mythril Bolt/.test(await lNote(a));
      // without tab B's edit the Undo works
      await a.evaluate(() => window.__lists.hold(false)); await a.evaluate(() => window.__lists.reload()); await b.evaluate(() => window.__lists.reload());
      await lType(a, 130, 'have', 0);
      await buyOne(a);
      ck.bought2 = (await lStored(a)).have['u.130'].nq === 1;
      await a.click('[data-act=undo][data-i="0"]'); await lSettle(a);
      ck.undone = (await lStored(a)).have['u.130'] === undefined && !(await lNote(a)).includes('Undo was not done');
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C165', 'Lists page, undo across tabs: tab A buys 1, tab B types 10 for the same item, tab A\'s Undo is refused with its line and the count stays 10; without tab B\'s edit the Undo works',
        Object.values(ck).every(Boolean), { ck, note, errors: real(errors), external });
      void server;
    });

    // ── Lists, W8: the tabs (To get, To craft, Wanted), steps, the combined view and the order of ways. Stand-in game data for C150 to C153, C161 to C163; the real data for C154. ──
    // A page's section is changed in the page itself, with the store's own edit functions, then written with the page's own save call (the way the page writes).
    const lSeed = async (pg, build) => {
      await pg.evaluate(async (src) => {
        const S = LISTS.store, r = await CC.read(), doc = r.raw == null ? CC.emptyDoc() : CC.checkDoc(r.raw), cur = doc.modules.lists || null;
        const out = new Function('S', 'sec', 'DATA', 'return (' + src + ')(S, sec, DATA)')(S, cur ? JSON.parse(JSON.stringify(cur)) : S.emptySection(), window.__lists.data());
        await CC.writeSection('lists', out, { rev: r.rev, base: cur ? JSON.parse(JSON.stringify(cur)) : null });
        await window.__lists.reload();
      }, build.toString());
      await lSettle(pg);
    };
    // lists and wanted items made in one go: spec = [{ name, charId, items: [[item, qty, flags?]], have: { item: n } }]
    const lSeedLists = (pg, spec) => lSeed(pg, new Function('S', 'sec', 'DATA', 'const spec = ' + JSON.stringify(spec) + ';' +
      'let t = 5000; const ctx = () => ({ now: t++ }); spec.forEach((l) => { let r = S.newList(sec, { name: l.name, charId: l.charId || null, stamp: DATA.stamp }, ctx()); sec = r.section; const id = r.id;' +
      '(l.items || []).forEach((i) => { const rec = Object.keys(DATA.recipes).filter((k) => DATA.recipes[k][0] === i[0]).sort((a, b) => DATA.recipes[a][3] - DATA.recipes[b][3] || a - b)[0] || 0; r = S.addTarget(sec, id, Object.assign({ item: i[0], recipe: rec, qty: i[1] }, i[2] || {}), ctx()); sec = r.section; });' +
      'Object.keys(l.have || {}).forEach((it) => { sec = S.setHave(sec, l.charId || "u", +it, "nq", l.have[it]).section; }); }); return sec;'));
    const lTab = async (pg, t) => { await pg.click('[data-act=tab][data-tab=' + t + ']'); await pg.waitForSelector('.tab[data-tab=' + t + '][aria-selected=true]'); };
    const lOpenAll = async (pg) => { for (let i = 0; i < 12; i++) { const c = pg.locator('.sec-toggle[aria-expanded=false]'); if (!(await c.count())) break; await c.first().click(); } };
    const lOpenList = async (pg, name, tab) => {
      if (await pg.locator('[data-act=back]').count()) await pg.click('[data-act=back]');
      await pg.waitForSelector('.list-card');
      await pg.locator('.list-card', { hasText: name }).first().locator('[data-act=open]').click(); await pg.waitForSelector('[data-f=listname]');
      if (tab) await lTab(pg, tab);
    };
    const lSecs = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gsec')].map((s) => [s.dataset.sec, [...s.querySelectorAll('.line-row, .left-row')].map((r) => ({ item: +r.dataset.item, q: r.dataset.q, text: r.textContent.replace(/\s+/g, ' ').trim() }))])));
    const lBlocks = (pg) => pg.evaluate(() => [...document.querySelectorAll('.cblock')].map((b) => ({ job: b.querySelector('h3').textContent, rows: [...b.querySelectorAll('.line-row')].map((r) => ({ item: +r.dataset.item, q: r.dataset.q, text: r.textContent.replace(/\s+/g, ' ').trim() })) })));
    const lTotals = (pg) => pg.evaluate(() => { const e = document.querySelector('.lists-totals'); return e ? { get: +e.dataset.get, craft: +e.dataset.craft } : null; });
    const lSteps = (pg) => pg.evaluate(() => [...document.querySelectorAll('.step-tab')].map((e) => ({ name: e.querySelector('.st-name').textContent, get: +e.querySelector('.st-fig').dataset.get, craft: +e.querySelector('.st-fig').dataset.craft, on: e.getAttribute('aria-selected') === 'true' })));
    const lItemsIn = (secs, sec) => (secs[sec] || []).map((r) => r.item);
    const lHave = async (pg) => (await lStored(pg)).have;
    const lWayOptions = (pg, loc) => loc.locator('[data-f=way] option').evaluateAll((os) => os.map((o) => o.value));

    // ── C150 (Lists, W8) A "Get it by" change and a change of the order of ways move the totals at once, in every list of that character; a high-quality row and an ordinary row of one item each show their own way and seller. ──
    await guard('C150', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lSeedLists(page, [{ name: 'Alpha', items: [[100, 1]] }, { name: 'Beta', items: [[100, 2], [130, 3]] }]);
      await lOpenList(page, 'Beta'); await lAdd(page, 'mythril', 130, 1); await lTab(page, 'wanted');
      await lRow(page, 130).nth(1).locator('[data-flag=hq]').check(); await lSettle(page);
      await lTab(page, 'get'); await lOpenAll(page);
      let secs = await lSecs(page);
      const vend = (secs.vendor || []).filter((r) => r.item === 130);
      ck.twoRows = vend.length === 2 && vend.some((r) => r.q === 'nq' && /Sold by Berin in Test Town: 3 for 280 gil/.test(r.text) && !/Eli/.test(r.text)) && vend.some((r) => r.q === 'hq' && /Sold by Eli in Test Town for 400 gil each/.test(r.text) && /High quality/.test(r.text) && !/Berin/.test(r.text));
      await lOpenList(page, 'Alpha', 'get'); await lOpenAll(page);
      secs = await lSecs(page);
      const t0 = await lTotals(page);
      ck.ingotBought = lItemsIn(secs, 'vendor').includes(101) && !lItemsIn(secs, 'gather').includes(104);
      // (1) one item's way, chosen on a row of list Alpha: the totals move at once, and list Beta shows the change
      await page.locator('.get-row[data-item="101"] [data-f=way]').selectOption('craft'); await lSettle(page);
      const t1 = await lTotals(page);
      ck.waysMoveTotals = t1.craft > t0.craft && t1.get !== t0.get;
      await lOpenList(page, 'Beta', 'craft');
      ck.otherListSeesWay = (await lBlocks(page)).some((b) => b.rows.some((r) => r.item === 101)) && JSON.stringify(await lTotals(page)) === JSON.stringify(t1);
      await lTab(page, 'get'); await lOpenAll(page);
      ck.otherListGather = lItemsIn(await lSecs(page), 'gather').includes(104);
      await page.locator('.get-row[data-item="101"] [data-f=way]').count();
      await lTab(page, 'craft'); await page.locator('.craft-row[data-item="101"] [data-f=way]').selectOption(''); await lSettle(page);
      ck.backToUsual = JSON.stringify(await lTotals(page)) === JSON.stringify(t0) && !(await lBlocks(page)).some((b) => b.rows.some((r) => r.item === 101));
      // (2) the order of ways: "Craft it" first, written once for the character, moves the totals in both lists
      await page.click('[data-act=sheet]'); await page.waitForSelector('.order-sheet');
      await page.click('[data-act=order-up][data-way=craft]'); await lSettle(page);
      const t2 = await lTotals(page);
      ck.orderMovesTotals = t2.craft > t0.craft;
      ck.orderStored = (await lStored(page)).owners.u.order === 'craft vendor gather trade market';
      await lOpenList(page, 'Alpha', 'craft');
      ck.orderInOtherList = JSON.stringify(await lTotals(page)) === JSON.stringify(t2) && (await lBlocks(page)).some((b) => b.rows.some((r) => r.item === 101));
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C150', 'Lists page: a "Get it by" change and a change of the order of ways move the totals at once and show in every list of that character; a high-quality row and an ordinary row of one item each show their own way and seller',
        Object.values(ck).every(Boolean), { ck, t0, t1, t2, errors: real(errors), external });
      void server;
    });

    // ── C151 (Lists, W8) Steps: each step's share, the shares add up to the list's totals, moving a wanted item to another step changes no total; "This step is handed in" lowers the stock by what the step used and no total rises. ──
    await guard('C151', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lSeedLists(page, [{ name: 'Stepped', items: [[100, 2], [130, 3]], have: { 130: 3 } }]);
      await lOpenList(page, 'Stepped', 'wanted');
      for (const n of ['Alpha', 'Beta']) { await page.fill('[data-f=stepname]', n); await page.click('[data-act=addstep]'); await lSettle(page); await page.waitForSelector('[data-f=stepname]'); }
      await lRow(page, 130).locator('[data-f=step]').selectOption({ label: 'Beta' }); await lSettle(page);
      await lTab(page, 'get');
      const sum = (a) => ({ get: a.reduce((x, s) => x + s.get, 0), craft: a.reduce((x, s) => x + s.craft, 0) });
      let steps = await lSteps(page), all = steps[0], parts = steps.slice(1);
      const tot0 = await lTotals(page);
      ck.stepTabs = steps.length === 3 && steps[0].name === 'All steps' && parts[0].name === 'Alpha' && parts[1].name === 'Beta' && parts[0].get + parts[0].craft > 0;
      ck.sharesAdd = sum(parts).get === all.get && sum(parts).craft === all.craft && all.get > 0 && all.craft > 0;
      ck.sentence = /A step.s figures are its share of .* plan and can move between steps and lists; the totals for .* never go up when you remove something\./.test(await page.locator('.lists-steps + .fine').textContent());
      // (2) moving a wanted item to another step: the character's totals and the list's totals stay, the steps' shares move
      await lTab(page, 'wanted'); await lRow(page, 100).locator('[data-f=step]').selectOption({ label: 'Beta' }); await lSettle(page); await lTab(page, 'get');
      steps = await lSteps(page);
      ck.moveKeepsTotals = JSON.stringify(await lTotals(page)) === JSON.stringify(tot0) && steps[0].get === all.get && steps[0].craft === all.craft && steps[1].get + steps[1].craft === 0 && sum(steps.slice(1)).get === all.get;
      await lTab(page, 'wanted'); await lRow(page, 100).locator('[data-f=step]').selectOption(''); await lSettle(page); await lTab(page, 'get');
      // (3) a step handed in: the confirm names the counts, the stock of the items themselves goes, no total rises
      const before = await lHave(page), totB = await lTotals(page);
      await page.locator('.step-tab', { hasText: 'Beta' }).click(); await page.click('[data-act=ask-handin]');
      const ask = await page.locator('.lists-confirm').textContent();
      ck.confirmNames = /3 Mythril Bolt/.test(ask) && /press Made first, so what is left over is counted/.test(ask);
      await page.click('[data-act=handin]'); await lSettle(page);
      const after = await lHave(page), totA = await lTotals(page);
      ck.stockFell = before['u.130'] && before['u.130'].nq === 3 && after['u.130'] === undefined && JSON.stringify(Object.keys(before).filter((k) => k !== 'u.130')) === JSON.stringify(Object.keys(after));
      ck.noTotalRose = totA.get <= totB.get && totA.craft <= totB.craft;
      ck.itemFinished = lTargets(await lStored(page)).filter((t) => t.item === 130)[0].done === true && lTargets(await lStored(page)).filter((t) => t.item === 100)[0].done !== true;
      await page.click('[data-act=undo][data-i="0"]'); await lSettle(page);
      ck.undoHandIn = (await lHave(page))['u.130'].nq === 3 && lTargets(await lStored(page)).filter((t) => t.item === 130)[0].done !== true;
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C151', 'Lists page, steps: each step shows its own share and the shares add up to the list\'s totals; moving a wanted item to another step changes no total; "This step is handed in" names the counts, lowers the stock by what the step used and raises no total; Undo restores it',
        Object.values(ck).every(Boolean), { ck, steps, tot0, totB, totA, errors: real(errors), external });
      void server;
    });

    // ── C152 (Lists, W8) Combined view: only one character's lists can be ticked; a subset shows "held for" an unticked earlier list and offers no stock twice; a "Get it by" change made there shows in the single lists too. ──
    await guard('C152', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lSeedLists(page, [{ name: 'First', charId: 'c1', items: [[103, 4]], have: { 103: 4 } }, { name: 'Second', charId: 'c1', items: [[103, 2]] }, { name: 'Third', charId: 'c1', items: [[103, 3]] }, { name: 'Other', charId: 'c2', items: [[103, 1]] }]);
      await page.click('[data-act=back]').catch(() => {}); await page.waitForSelector('.list-card');
      const box = (name) => page.locator('.list-card', { hasText: name }).locator('[data-f=tick]');
      await box('Second').check(); await lSettle(page); await box('Third').check(); await lSettle(page);
      ck.otherCharDisabled = await box('Other').isDisabled() && !(await box('First').isDisabled()) && /Each character has its own stock\./.test(await page.locator('#view').textContent());
      ck.tickStored = (await lStored(page)).prefs.combined && Object.keys((await lStored(page)).prefs.combined).length === 2;
      await page.locator('.lists-group', { hasText: 'Character c1' }).locator('[data-act=combined]').click(); await page.waitForSelector('.tab[data-tab=get]');
      await lOpenAll(page);
      let secs = await lSecs(page), row = (secs.gather || []).filter((r) => r.item === 103)[0];
      ck.heldFor = !!row && /need 5, have 4/.test(row.text) && /4 held for “First”/.test(row.text) && /to get 5/.test(row.text);
      // all three ticked: nothing is held, and the stock is offered once
      await page.click('[data-act=back]'); await box('First').check(); await lSettle(page);
      await page.locator('.lists-group', { hasText: 'Character c1' }).locator('[data-act=combined]').click(); await page.waitForSelector('.tab[data-tab=get]'); await lOpenAll(page);
      secs = await lSecs(page); row = (secs.gather || []).filter((r) => r.item === 103)[0];
      ck.noTwice = !!row && /need 9, have 4/.test(row.text) && !/held for/.test(row.text) && /to get 5/.test(row.text);
      // a way chosen on a combined row is the character's way: the single lists show it
      await page.locator('.get-row[data-item="103"] [data-f=way]').selectOption('market'); await lSettle(page);
      ck.wayStored = (await lStored(page)).ways['c1.103'].by === 'market';
      await page.click('[data-act=back]'); await page.locator('.list-card', { hasText: 'Second' }).locator('[data-act=open]').click(); await lTab(page, 'get'); await lOpenAll(page);
      ck.singleShows = lItemsIn(await lSecs(page), 'market').includes(103) && !lItemsIn(await lSecs(page), 'gather').includes(103);
      // fewer than two ticked: the empty state
      await page.click('[data-act=back]'); await box('First').uncheck(); await lSettle(page); await box('Third').uncheck(); await lSettle(page);
      await page.locator('.lists-group', { hasText: 'Character c1' }).locator('[data-act=combined]').click();
      ck.emptyState = /Tick two or more lists of one character\./.test(await page.locator('#view').textContent());
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C152', 'Lists page, combined view: only one character\'s lists can be ticked; a subset shows "held for" an unticked earlier list and offers the stock once; a "Get it by" change made there shows in the single lists; fewer than two ticked shows the empty state',
        Object.values(ck).every(Boolean), { ck, errors: real(errors), external });
      void server;
    });

    // ── C153 (Lists, W8) To craft: blocks by job in crafting order, Made 1 and Made all, "2 of 3 crafted" on a must-craft row, a recording beyond the typed materials shows its line, Hide completed. ──
    await guard('C153', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lSeedLists(page, [{ name: 'Crafts', items: [[100, 1], [130, 3, { make: true }], [120, 9]] }]);
      await lOpenList(page, 'Crafts', 'craft');
      const jobs = (await lBlocks(page)).map((b) => b.job);
      ck.jobBlocks = jobs.length >= 2 && jobs.every((j, i) => i === 0 || j !== jobs[i - 1]) && jobs.indexOf('Goldsmith') >= 0 && jobs.lastIndexOf('Armorer') > jobs.indexOf('Goldsmith');
      const mk = () => page.locator('.craft-row[data-item="130"]');
      ck.makeRow = /0 of 3 crafted/.test(await mk().textContent()) && /Must be crafted by me/.test(await mk().textContent()) && (await mk().locator('[data-act=made]').count()) === 2 && (await mk().locator('[data-f=way]').count()) === 0;
      await mk().locator('[data-act=made][data-crafts="1"]').click(); await lSettle(page);
      ck.shortLine = (await lNote(page)).includes('You recorded more than the materials typed here cover. Those materials were not taken from what your other lists are counting on; check what you have.');
      ck.oneOfThree = /1 of 3 crafted/.test(await mk().textContent()) && lTargets(await lStored(page)).filter((t) => t.item === 130)[0].crafted === 1 && (await lHave(page))['u.130'].nq === 1;
      await mk().locator('[data-act=made][data-crafts="1"]').click(); await lSettle(page);
      ck.twoOfThree = /2 of 3 crafted/.test(await mk().textContent());
      // Made all on a craft that makes 3 at a time
      const gem = () => page.locator('.craft-row[data-item="120"]');
      ck.gemRow = /3 crafts, makes 9/.test(await gem().textContent());
      await gem().locator('[data-act=made][data-crafts="3"]').click(); await lSettle(page);
      ck.madeAll = (await gem().count()) === 0 && (await lHave(page))['u.120'].nq === 9;
      await mk().locator('[data-act=made][data-crafts="1"]').click(); await lSettle(page);
      ck.completedShown = (await mk().count()) === 0 && /Already crafted/.test(await page.locator('.tab-craft').textContent()) && /3 of 3 crafted/.test(await page.locator('.cdone').textContent());
      await page.click('[data-act=hide]');
      ck.hidden = (await page.locator('.cdone').count()) === 0 && (await page.locator('[data-act=hide]').textContent()) === 'Show completed';
      await page.click('[data-act=hide]');
      ck.shownAgain = (await page.locator('.cdone').count()) === 1;
      // Hide completed also hides a finished wanted item
      await lTab(page, 'wanted'); await lRow(page, 120).locator('[data-act=done]').click(); await lSettle(page);
      await page.click('[data-act=hide]');
      ck.wantedHidden = (await lRow(page, 120).count()) === 0 && (await lRow(page, 100).count()) === 1;
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C153', 'Lists page, To craft: blocks by job in crafting order, Made 1 and Made all, "2 of 3 crafted" on a must-craft row, a recording beyond the typed materials shows its line, Hide completed hides crafted and finished items',
        Object.values(ck).every(Boolean), { ck, jobs, errors: real(errors), external });
      void server;
    });

    // ── C154 (Lists, W8) 500 wanted items of the real data: under 3,000 page elements with the sections closed, an open section drawn in under one second. ──
    await guard('C154', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await context({ serviceWorkers: 'block' });
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lSeed(page, function (S, sec, DATA) {
        let r = S.newList(sec, { name: 'Big', stamp: DATA.stamp }, { now: 7000 }); sec = r.section; const id = r.id, items = [], seen = {};
        Object.keys(DATA.recipes).forEach((k) => { const it = DATA.recipes[k][0]; if (items.length < 500 && !seen[it] && DATA.recipes[k][3] >= 20 && DATA.recipes[k][3] % 7 === 0) { seen[it] = 1; items.push([it, +k]); } });
        items.forEach((x, i) => { sec.targets[id + '.t' + String(i).padStart(7, '0')] = { item: x[0], recipe: x[1], qty: 1 + (i % 3), at: 8000 + i }; });
        return sec;
      });
      const n = lTargets(await lStored(page)).length;
      await lOpenList(page, 'Big', 'get');
      const m = await page.evaluate(() => {
        const t0 = performance.now(); document.querySelector('[data-act=tab][data-tab=get]').click(); const closed = performance.now() - t0;
        const elements = document.querySelectorAll('*').length;
        const heads = [...document.querySelectorAll('.sec-toggle')].map((b) => ({ sec: b.dataset.sec, n: +b.querySelector('.count').textContent }));
        heads.sort((a, b) => b.n - a.n);
        const big = heads[0], t1 = performance.now(); document.querySelector('.sec-toggle[data-sec="' + big.sec + '"]').click(); const opened = performance.now() - t1;
        return { elements, closed, opened, big, heads, openElements: document.querySelectorAll('*').length };
      });
      await lTab(page, 'craft');
      const craftEls = await page.evaluate(() => document.querySelectorAll('*').length);
      ck.count = n === 500;
      ck.elements = m.elements < 3000;
      ck.opened = m.opened < 1000 && m.big.n > 0;
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C154', 'Lists page, 500 wanted items of the real data: under 3,000 page elements on To get with the sections closed, and an open section drawn in under one second',
        Object.values(ck).every(Boolean), { ck, wanted: n, measured: m, craftTabElements: craftEls, errors: real(errors), external });
      void server;
    });

    // ── Lists, W9: prices, timed nodes, the patch notice. Universalis is answered by the stand-in of listsCtx (the session reaches no outside site). ──
    // Wanted items whose way is "market" (a stored way), so their rows carry prices: the fixture's tradable items 103, 104, 111, 120, 130, 141.
    const lSeedMarket = (pg, ids, name) => lSeed(pg, new Function('S', 'sec', 'DATA', 'const ids = ' + JSON.stringify(ids) + '; let t = 7000; const ctx = () => ({ now: t++ });' +
      'let r = S.newList(sec, { name: ' + JSON.stringify(name || 'Market') + ', charId: null, stamp: DATA.stamp }, ctx()); sec = r.section; const id = r.id;' +
      'ids.forEach((i) => { r = S.addTarget(sec, id, { item: i, recipe: 0, qty: 2 }, ctx()); sec = r.section; sec = S.setWay(sec, "u", i, { by: "market" }).section; }); return sec;'));
    const lMarketOpen = async (pg) => { await lOpenFirstList(pg); await lTab(pg, 'get'); await pg.click('.sec-toggle[data-sec=market][aria-expanded=false]'); await pg.waitForSelector('.gsec[data-sec=market] .price-total'); };
    const lOpenFirstList = async (pg) => { if (await pg.locator('[data-act=back]').count()) await pg.click('[data-act=back]'); await pg.waitForSelector('.list-card'); await pg.locator('.list-card [data-act=open]').first().click(); await pg.waitForSelector('[data-f=listname]'); };
    const lPriceTexts = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gsec[data-sec=market] .line-row')].map((r) => [r.dataset.item, (r.querySelector('.price-line') || {}).textContent || ''])));
    const lPriceTotal = (pg) => pg.evaluate(() => { const e = document.querySelector('.price-total'); return e ? { text: e.textContent, gil: +e.dataset.gil, priced: +e.dataset.priced, unpriced: +e.dataset.unpriced } : null; });
    const lWaitPrices = (pg) => pg.waitForFunction(() => { const e = document.querySelector('.gsec[data-sec=market] .price-line'); return e && !/Fetching/.test(e.textContent); }, null, { timeout: 15000 });
    const lSettled = (pg) => pg.waitForTimeout(400);
    const SORRY_NONE = 'Market prices could not be fetched; showing no market prices.', SORRY_KEPT = 'Market prices could not be fetched; showing the last known market prices.';

    // ── C166 (Lists, W9) The seven rows of the price table of section 6, each answered by a stand-in: the row's words, and a total that counts only priced items and names the rest. ──
    await guard('C166', async () => {
      const server = await start(PORT5);
      const ck = {}, ids = [103, 104, 111, 120, 130, 141];
      // rows 1 to 4: a listing, no listing with a recent average, no listing and no average / a price of 0 / a value that is not a whole number, left out of the reply
      {
        const c = await listsCtx(); const page = await c.ctx.newPage();
        c.stand.reply = () => ({ 103: { listings: [{ pricePerUnit: 120, worldName: 'Maduin' }], averagePrice: 100 }, 104: { listings: [], recentHistory: [{ pricePerUnit: 80 }, { pricePerUnit: 100 }] }, 111: { listings: [], averagePrice: 0 },
          120: { listings: [{ pricePerUnit: 0, worldName: 'Maduin' }] }, 130: { listings: [{ pricePerUnit: 12.5, worldName: 'Maduin' }] } });
        await page.goto(ROOT5 + 'lists/'); await lReady(page);
        await lSeedMarket(page, ids); await lMarketOpen(page); await lWaitPrices(page);
        const tx = await lPriceTexts(page), tot = await lPriceTotal(page);
        ck.listing = /^120 gil before tax, North-America \(cheapest on Maduin\), fetched \d\d:\d\d$/.test(tx[103]);
        ck.noListingAverage = tx[104] === 'No listings now; recent sales about 90 gil';
        ck.noListingNoAverage = tx[111] === 'No market price';
        ck.zero = tx[120] === 'No market price';
        ck.notWhole = tx[130] === 'No market price';
        ck.leftOut = tx[141] === 'No market data for this item';
        ck.total = tot.gil === 240 && tot.priced === 1 && tot.unpriced === 5 && /about 240 gil for 1 item; 5 items without a price/.test(tot.text) && /Test Ore|Ore Chunk|Thread|Triple Gem|Mythril Bolt|Trade Good|Crafted Dust/.test(tot.text);
        ck.engineGil = await page.evaluate(() => { const g = __lists.plan('u').gil; return g.market === 240 && g.unknown.length === 5; });
        ck.noErrors1 = real(c.errors).length === 0 && c.external.length === 0;
        await c.ctx.close();
      }
      // row 4, the other way: one item asked for alone and answered 404
      {
        const c = await listsCtx(); const page = await c.ctx.newPage(); c.stand.reply = () => 404;
        await page.goto(ROOT5 + 'lists/'); await lReady(page);
        await lSeedMarket(page, [111]); await lMarketOpen(page); await lWaitPrices(page);
        const tx = await lPriceTexts(page), tot = await lPriceTotal(page);
        ck.single404 = tx[111] === 'No market data for this item' && tot.priced === 0 && tot.unpriced === 1 && /about 0 gil for 0 items; 1 item without a price/.test(tot.text) && !/could not be fetched/.test(await page.textContent('#view'));
        await c.ctx.close();
      }
      // row 5: the fetch fails and an earlier price is kept
      {
        const c = await listsCtx(); const page = await c.ctx.newPage();
        await page.goto(ROOT5 + 'lists/'); await lReady(page);
        await lSeedMarket(page, [103]); await lMarketOpen(page); await lWaitPrices(page);
        const first = await lPriceTexts(page);
        c.stand.reply = () => 'abort';
        await page.click('[data-act=prices]'); await page.waitForFunction(() => /could not be fetched/.test(document.querySelector('#view').textContent), null, { timeout: 15000 });
        const tx = await lPriceTexts(page), tot = await lPriceTotal(page);
        ck.keptPrice = /^100 gil before tax, North-America \(cheapest on Test\), last seen \d\d:\d\d\. Market prices could not be fetched; showing the last known market prices\.$/.test(tx[103]) && /fetched/.test(first[103]) && !/last seen/.test(first[103]);
        ck.keptTotal = tot.gil === 200 && tot.priced === 1 && /\(prices seen \d\d:\d\d\)/.test(tot.text);
        await c.ctx.close();
      }
      // row 6: the fetch fails and nothing is kept
      {
        const c = await listsCtx(); const page = await c.ctx.newPage(); c.stand.reply = () => 'abort';
        await page.goto(ROOT5 + 'lists/'); await lReady(page);
        await lSeedMarket(page, [103]); await lMarketOpen(page); await page.waitForFunction(() => /could not be fetched/.test(document.querySelector('#view').textContent), null, { timeout: 15000 });
        const tx = await lPriceTexts(page), tot = await lPriceTotal(page);
        ck.nothingKept = tx[103] === 'Price not fetched. ' + SORRY_NONE && tot.gil === 0 && tot.priced === 0 && tot.unpriced === 1 && !/prices seen/.test(tot.text);
        await c.ctx.close();
      }
      // row 7: a price fetched an hour ago or more is shown with its time and counted, the total names the oldest time; it is fetched again at the next attempt
      {
        const c = await listsCtx(); const page = await c.ctx.newPage();
        await page.goto(ROOT5 + 'lists/'); await lReady(page);
        await lSeedMarket(page, [103, 104]);
        const old = await page.evaluate(() => { const at = Date.now() - 7200000; localStorage.setItem('eveniunt-lists-prices', JSON.stringify({ scope: 'North-America', at, prices: { 103: [150, 0, '', 0], 104: [60, 0, '', 0] }, none: {}, seen: { 103: at, 104: at + 600000 } })); localStorage.setItem('eveniunt-lists-prices-tried', JSON.stringify({ 'North-America': { at: Date.now() } })); return at; });
        await page.reload(); await lReady(page); await lMarketOpen(page); await lSettled(page);
        const tx = await lPriceTexts(page), tot = await lPriceTotal(page), hm = await page.evaluate((t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }, old);
        ck.oldPrice = /^150 gil before tax, North-America, fetched \d\d:\d\d$/.test(tx[103]) && tx[103].endsWith(hm) && c.stand.asked.length === 0;
        ck.oldTotal = tot.gil === 300 + 120 && tot.priced === 2 && tot.text.indexOf('(prices seen ' + hm + ')') >= 0;
        await page.evaluate(() => localStorage.removeItem('eveniunt-lists-prices-tried')); await page.reload(); await lReady(page); await lMarketOpen(page); await lWaitPrices(page);
        await page.waitForFunction(() => /100 gil/.test(document.querySelector('.gsec[data-sec=market] .price-line').textContent), null, { timeout: 15000 });
        ck.fetchedAgain = c.stand.asked.length === 1 && c.stand.asked[0].indexOf('North-America:103,104?listings=1&entries=20') === 0;
        ck.noErrors = real(c.errors).length === 0 && c.external.length === 0;
        await c.ctx.close();
      }
      record('C166', 'Lists page, prices: the seven rows of the price table (a listing; no listing with a recent average; no listing and no average, a price of 0 and a value that is not a whole number; left out of the reply or answered 404; a failed fetch with an earlier price kept; a failed fetch with nothing kept; a price an hour old or older) each show the row\'s words, and the total counts only priced items and names the rest',
        Object.values(ck).every(Boolean), { ck });
      void server;
    });

    // ── C155 (Lists, W9) Prices with their fetch time, the failure sentence, one automatic attempt across a reload, the place and Hide completed saved in the save, prices never in the save,
    //    the Submersibles price record untouched, and the plan's ways the same with and without prices. ──
    await guard('C155', async () => {
      const server = await start(PORT5);
      const ck = {}, SUBS = JSON.stringify({ scope: 'Maduin', at: 1700000000000, prices: { 2: 2000 }, none: {}, seen: { 2: 1700000000000 } }), SUBS_TRIED = JSON.stringify({ Maduin: { at: 1700000000000 } });
      const c = await listsCtx(); const page = await c.ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      await page.evaluate((a) => { localStorage.setItem('eveniunt-subs-prices', a[0]); localStorage.setItem('eveniunt-subs-prices-tried', a[1]); }, [SUBS, SUBS_TRIED]);
      await lSeedMarket(page, [103, 111]); await lSeedLists(page, [{ name: 'Crafts', items: [[100, 1]] }]);
      await lOpenList(page, 'Market'); await lTab(page, 'get'); await page.click('.sec-toggle[data-sec=market][aria-expanded=false]'); await lWaitPrices(page);
      let tx = await lPriceTexts(page);
      ck.fetchTime = /^100 gil before tax, North-America \(cheapest on Test\), fetched \d\d:\d\d$/.test(tx[103]) && c.stand.asked.length === 1 && /listings=1&entries=20$/.test(c.stand.asked[0]);
      // the plan's ways are the same with and without prices
      ck.waysSame = await page.evaluate(() => { const f = (p) => JSON.stringify(Object.keys(p.lines).sort().map((k) => [k, p.lines[k].by, p.lines[k].why, p.lines[k].recipe, p.lines[k].offer ? p.lines[k].offer.key : null])); return f(__lists.plan('u')) === f(__lists.plan('u', true)) && __lists.plan('u').gil.market > 0 && __lists.plan('u', true).gil.market === 0; });
      // prices are never in the save: the stored section holds no price and no price record
      const doc = await page.evaluate(async () => JSON.stringify((await CC.read()).raw));
      ck.notInSave = !/pricePerUnit|before tax|eveniunt-lists-prices|"prices"/.test(doc) && !/Maduin/.test(doc);
      // one automatic attempt across a reload: with the fetch failing, the reload makes no second attempt inside 15 minutes; Refresh makes exactly one
      await page.evaluate(() => { localStorage.removeItem('eveniunt-lists-prices'); localStorage.setItem('eveniunt-lists-prices-tried', '{}'); });
      c.stand.reply = () => 'abort'; c.stand.asked.length = 0;
      await page.reload(); await lReady(page); await lOpenList(page, 'Market', 'get'); await page.click('.sec-toggle[data-sec=market][aria-expanded=false]');
      await page.waitForFunction(() => /could not be fetched/.test(document.querySelector('#view').textContent), null, { timeout: 15000 });
      const afterFirst = c.stand.asked.length;
      tx = await lPriceTexts(page);
      ck.failureSentence = tx[103] === 'Price not fetched. ' + SORRY_NONE;
      await page.reload(); await lReady(page); await lOpenList(page, 'Market', 'get'); await page.click('.sec-toggle[data-sec=market][aria-expanded=false]'); await lSettled(page);
      ck.oneAttempt = afterFirst === 1 && c.stand.asked.length === 1 && (await page.evaluate(() => JSON.parse(localStorage.getItem('eveniunt-lists-prices-tried'))['North-America'].at > 0));
      await page.click('[data-act=prices]'); await lSettled(page);
      ck.refresh = c.stand.asked.length === 2;
      // the price place is kept in the save (prefs.priceWorld) and chosen for the next attempt; Hide completed is kept too (prefs.hideDone)
      c.stand.reply = null;
      await page.selectOption('[data-f=priceWorld]', 'Europe'); await lSettle(page);
      await page.waitForFunction(() => /Europe/.test(document.querySelector('.price-line') ? document.querySelector('.price-line').textContent : ''), null, { timeout: 15000 });
      ck.placeAsked = c.stand.asked.some((a) => a.indexOf('Europe:') === 0);
      ck.placeSaved = (await lStored(page)).prefs.priceWorld === 'Europe';
      await page.click('[data-act=hide]'); await lSettle(page);
      ck.hideSaved = (await lStored(page)).prefs.hideDone === true;
      await page.reload(); await lReady(page); await lOpenList(page, 'Market', 'get');
      ck.hideKept = (await page.locator('[data-act=hide]').textContent()) === 'Show completed' && (await page.locator('[data-f=priceWorld]').inputValue()) === 'Europe';
      await page.click('[data-act=hide]'); await lSettle(page);
      ck.hideOff = !('hideDone' in ((await lStored(page)).prefs || {})) || (await lStored(page)).prefs.hideDone === false;
      // the Submersibles record is exactly as it was
      const subs = await page.evaluate(() => [localStorage.getItem('eveniunt-subs-prices'), localStorage.getItem('eveniunt-subs-prices-tried')]);
      ck.subsUntouched = subs[0] === SUBS && subs[1] === SUBS_TRIED;
      ck.noErrors = real(c.errors).length === 0 && c.external.length === 0;
      record('C155', 'Lists page, prices: a price shows its fetch time, a failed fetch says "showing no market prices", a reload inside 15 minutes makes no second automatic attempt and Refresh makes exactly one, the price place and Hide completed are kept in the save (prefs) and prices never are, the Submersibles price record is byte for byte as it was, and the plan\'s ways are the same with and without prices',
        Object.values(ck).every(Boolean), { ck, asked: c.stand.asked, errors: real(c.errors), external: c.external });
      void server;
    });

    // ── C156 (Lists, W9) The next window of a timed node at a fixed clock: Eorzea time and real minutes; an open window says so; an untimed node shows none. ──
    await guard('C156', async () => {
      const server = await start(PORT5);
      const ck = {}, DAY = 4200000, HOUR = 175000, base = 400000 * DAY;
      const c = await listsCtx(); const page = await c.ctx.newPage();
      await c.ctx.clock.setFixedTime(base + 12 * HOUR); // 12:00 Eorzea time: the node 104 (hours 1 and 13, 180 Eorzean minutes) opens at 13:00, in 175 seconds
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      await lSeedLists(page, [{ name: 'Gather', items: [[104, 2], [103, 2]] }]);
      await lOpenList(page, 'Gather', 'get'); await lOpenAll(page);
      const rows = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gsec[data-sec=gather] .line-row')].map((r) => [r.dataset.item, (r.querySelector('.w-window') || {}).textContent || ''])));
      let w = await rows();
      ck.opensSoon = w[104] === 'opens 13:00 Eorzea time, in 3 min';
      ck.untimed = w[103] === '' && (await page.locator('.gsec[data-sec=gather] .line-row[data-item="103"]').count()) === 1;
      await c.ctx.clock.setFixedTime(base + 14 * HOUR); // 14:00: open until 16:00, in 350 seconds
      await page.reload(); await lReady(page); await lOpenList(page, 'Gather', 'get'); await lOpenAll(page);
      w = await rows();
      ck.open = w[104] === 'open now, closes 16:00 Eorzea time, in 6 min';
      await c.ctx.clock.setFixedTime(base + 4 * HOUR + 30000); // 04:00 and a little: the next window is the 13:00 one, 9 Eorzean hours away (1,575 seconds, about 26 minutes)
      await page.reload(); await lReady(page); await lOpenList(page, 'Gather', 'get'); await lOpenAll(page);
      w = await rows();
      ck.later = /^opens 13:00 Eorzea time, in 2[67] min$/.test(w[104]);
      ck.noErrors = real(c.errors).length === 0 && c.external.length === 0;
      record('C156', 'Lists page, timed nodes: at a fixed clock a timed gathering row says when the next window opens in Eorzea time and in real minutes ("opens 13:00 Eorzea time, in 3 min"), an open window says "open now, closes 16:00 Eorzea time", and an untimed node shows no window',
        Object.values(ck).every(Boolean), { ck, w, errors: real(c.errors), external: c.external });
      void server;
    });

    // ── C157 (Lists, W9) The notice that the game data changed: two entries in a row, one changing a recipe twice and one removing a material's recipe deep in the tree, compared oldest against today's. ──
    await guard('C157', async () => {
      const server = await start(PORT5);
      const T1 = '1.01 aaaaaaaa bbbbbbbb', T2 = '1.02 aaaaaaaa bbbbbbbb', T3 = '1.03 aaaaaaaa bbbbbbbb', OLD = '0.99 aaaaaaaa bbbbbbbb', NEWER = '1.04 aaaaaaaa bbbbbbbb';
      const f = JSON.parse(LISTS_FIXTURE), now1000 = f.recipes['1000'], gone1002 = f.recipes['1002'];
      const r1 = [100, 1, 2, 50, 0, [[101, 2], [102, 1], [103, 2]], 1], r2 = [100, 3, 2, 50, 0, [[101, 2], [102, 1], [103, 2]], 1];
      delete f.recipes['1002']; f.stamp = T3;
      f.changes = [{ from: T1, to: T2, recipes: { 1000: [r1, r2] }, gone: { 1002: gone1002 } }, { from: T2, to: T3, recipes: { 1000: [r2, now1000] }, gone: {} }];
      const ck = {};
      const c = await context({ serviceWorkers: 'block' }); const page = await c.ctx.newPage();
      await c.ctx.route('**/lists/data.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.LISTS_DATA = ' + JSON.stringify(f) + ';' }));
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      await lSeedLists(page, [{ name: 'Behind', items: [[100, 1], [130, 2]], have: { 103: 5 } }, { name: 'Unknown', items: [[100, 1]] }, { name: 'Ahead', items: [[100, 1]] }, { name: 'Current', items: [[100, 1]] }]);
      await lSeed(page, new Function('S', 'sec', 'DATA', 'const st = ' + JSON.stringify({ Behind: T1, Unknown: OLD, Ahead: NEWER, Current: T3 }) + '; Object.keys(sec.lists).forEach((k) => { sec.lists[k].data = st[sec.lists[k].name]; }); return sec;'));
      const lines = () => page.evaluate(() => [...document.querySelectorAll('.patch-notice li')].map((e) => e.textContent));
      const stored0 = await lStored(page), strip = (sec) => { const o = JSON.parse(JSON.stringify(sec)); Object.keys(o.lists).forEach((k) => { delete o.lists[k].data; }); return JSON.stringify(o); };
      await lOpenList(page, 'Behind');
      const ls = await lines();
      ck.twoLines = ls.length === 2 && ls.includes('Grand Widget now needs 3 Test Ore, was 2.') && ls.includes('Special Cloth can no longer be crafted (it was made from 2 Thread).');
      ck.once = new Set(ls).size === ls.length && !ls.some((l) => /makes/.test(l)) && !ls.some((l) => /was 1/.test(l));
      ck.heading = /Game data changed since this list was last checked/.test(await page.textContent('.patch-notice h2'));
      ck.keptBefore = strip(await lStored(page)) === strip(stored0) && (await page.locator('.wanted-row').count()) === 2;
      await page.click('[data-act=noted]'); await lSettle(page);
      const after = await lStored(page), behind = Object.values(after.lists).find((l) => l.name === 'Behind');
      ck.noted = behind.data === T3 && (await page.locator('.patch-notice').count()) === 0 && strip(after) === strip(stored0);
      await page.reload(); await lReady(page); await lOpenList(page, 'Behind');
      ck.stays = (await page.locator('.patch-notice').count()) === 0;
      // a stamp outside the chain: the plain sentence, nothing changed; a newer stamp and a current one: no notice
      await lOpenList(page, 'Unknown');
      const plain = await page.textContent('.patch-notice');
      ck.plain = /Game data changed since this list was last checked; the details for that version are not available\./.test(plain) && (await page.locator('.patch-notice li').count()) === 0;
      await lOpenList(page, 'Ahead'); ck.newer = (await page.locator('.patch-notice').count()) === 0;
      await lOpenList(page, 'Current'); ck.current = (await page.locator('.patch-notice').count()) === 0;
      ck.keptAll = strip(await lStored(page)) === strip(stored0);
      ck.noErrors = real(c.errors).length === 0 && c.external.length === 0;
      record('C157', 'Lists page, patch notice: with two data changes in a row (one recipe changed twice, a deep material\'s recipe removed) the notice names each change once, oldest row against today\'s, and nothing of the list is changed; "OK, noted" writes the new stamp and the notice stays away; a stamp outside the chain shows the plain sentence; a newer stamp and the current one show no notice',
        Object.values(ck).every(Boolean), { ck, ls, errors: real(c.errors), external: c.external });
      void server;
    });

    // ── C161 (Lists, W8) The owner's case on the fixture, with a new list and the untouched order: the gil-merchant material is bought and its materials are left out, the other-currency material is crafted and not traded; the sheet shows the five sentences; "Craft it" first brings the craft and its materials back. ──
    await guard('C161', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lMake(page, 'Owner case'); await lAdd(page, 'grand', 100, 1);
      await lTab(page, 'get'); await lOpenAll(page);
      let secs = await lSecs(page), crafts = await lBlocks(page);
      const ingot = (secs.vendor || []).filter((r) => r.item === 101)[0];
      ck.merchant = !!ingot && /Sold by Fenn in Test Town for 50 gil each/.test(ingot.text) && (await page.locator('.gsec[data-sec=vendor] h3').textContent()).includes('Buy from a merchant (gil)');
      await lTab(page, 'craft');
      crafts = await lBlocks(page);
      const craftItems = crafts.flatMap((b) => b.rows.map((r) => r.item));
      ck.notCrafted = !craftItems.includes(101) && craftItems.includes(100) && craftItems.includes(102);
      await lTab(page, 'get'); await lOpenAll(page); secs = await lSecs(page);
      const everyItem = Object.values(secs).flat().map((r) => r.item).concat(craftItems);
      ck.noMaterialsOfIngot = !everyItem.includes(104) && !everyItem.includes(1001);
      ck.notTraded = !lItemsIn(secs, 'trade').includes(102) && !(await page.locator('.gsec[data-sec=trade]').count());
      await page.click('[data-act=sheet]'); await page.waitForSelector('.order-sheet');
      const sheet = await page.locator('.order-sheet').textContent();
      ck.sentences = ['1. Buy from a merchant for gil. If an ordinary merchant sells it for gil, you buy it, and the materials to craft it are left out.', '2. Craft it.', '3. Gather it.',
        '4. Trade for it with another currency (scrips, tomestones, seals, tokens). These are not counted as easy, so they come after crafting and gathering unless you move them up.', '5. Buy on the market board.',
        'When an item can be got in several ways, ', 'This order is used in all of ', ' lists. You can change it here, or choose a way for one item on its row, at any time. Items from the crafting log, and collectables, are always crafted.']
        .every((x) => sheet.replace(/\s+/g, ' ').includes(x));
      await page.click('[data-act=order-up][data-way=craft]'); await lSettle(page);
      ck.sheetFollows = (await page.locator('.order-list li').first().getAttribute('data-way')) === 'craft' && (await page.locator('.order-list li').first().textContent()).includes('1. Craft it.');
      await page.click('[data-act=sheet]');
      await lTab(page, 'craft');
      const crafts2 = (await lBlocks(page)).flatMap((b) => b.rows.map((r) => r.item));
      await lTab(page, 'get'); await lOpenAll(page);
      const secs2 = await lSecs(page);
      ck.craftBack = crafts2.includes(101) && crafts2.includes(100) && lItemsIn(secs2, 'gather').includes(104) && !lItemsIn(secs2, 'vendor').includes(101);
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C161', 'Lists page, the owner\'s case: the gil-merchant material is under "Buy from a merchant (gil)" with its seller and price and is not crafted, none of its materials is on any tab, the other-currency material is crafted and not traded; the sheet shows the five sentences; moving "Craft it" first brings the craft and its materials back',
        Object.values(ck).every(Boolean), { ck, errors: real(errors), external });
      void server;
    });

    // ── C162 (Lists, W8) "Made 1", then "Bought it" with the full amount: the row and everything below it leave at once, no stock count falls, the gathered materials show under "Left over"; "Buy the rest too" sets the way; with fewer units the row stays; "Undo" twice restores both steps exactly; a reload keeps what was not undone. ──
    await guard('C162', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lSeedLists(page, [{ name: 'Bought', items: [[100, 2]], have: { 103: 6 } }]);
      await lOpenList(page, 'Bought', 'craft');
      const s0 = JSON.stringify(await lStored(page));
      const row = () => page.locator('.craft-row[data-item="100"]');
      ck.twoCrafts = /2 crafts/.test(await row().textContent());
      await row().locator('[data-act=made][data-crafts="1"]').click(); await lSettle(page);
      const h1 = await lHave(page);
      ck.made = h1['u.100'].nq === 1 && h1['u.103'].nq === 3 && /1 craft,/.test(await row().textContent());
      await row().locator('[data-act=ask-bought][data-mode=bought]').click();
      ck.prefilled = (await row().locator('[data-f=boughtn]').inputValue()) === '1';
      await row().locator('[data-act=bought]').click(); await lSettle(page);
      const h2 = await lHave(page);
      ck.rowGone = (await page.locator('.craft-row').count()) === 0 && /Nothing left to craft\./.test(await page.locator('.tab-craft').textContent());
      await lTab(page, 'get');
      ck.getEmpty = /Nothing left to get\./.test(await page.locator('.tab-get').textContent()) && (await page.locator('.line-row').count()) === 0;
      ck.noCountFell = Object.keys(h1).every((k) => h2[k] && ['nq', 'hq', 'coll'].every((q) => h2[k][q] >= h1[k][q])) && h2['u.100'].nq === 2;
      await lOpenAll(page);
      ck.leftOver = (await lSecs(page)).left.some((r) => r.item === 103 && r.text === '3 Test Ore: no longer needed by this list. Still in your stock, and used by your other lists if they need it.');
      ck.restOffered = (await page.locator('[data-act=rest]').count()) >= 1;
      // Undo twice: the purchase, then the craft
      await page.click('[data-act=undo][data-i="0"]'); await lSettle(page); await page.click('[data-act=undo][data-i="0"]'); await lSettle(page);
      ck.undoTwice = JSON.stringify(await lStored(page)) === s0;
      // fewer units: the row stays for the rest, and "Buy the rest too" sets the way
      await lTab(page, 'craft');
      await row().locator('[data-act=ask-bought][data-mode=bought]').click(); await row().locator('[data-f=boughtn]').fill('1'); await row().locator('[data-act=bought]').click(); await lSettle(page);
      ck.fewerKeeps = /1 craft,/.test(await row().textContent()) && (await lHave(page))['u.100'].nq === 1;
      const rest = page.locator('[data-act=rest][data-by=market]');
      ck.restWay = (await rest.count()) === 1;
      await rest.click(); await lSettle(page);
      ck.wayStored = (await lStored(page)).ways['u.100'].by === 'market' && (await page.locator('.craft-row').count()) === 0;
      const before = JSON.stringify(await lStored(page));
      await page.reload(); await lReady(page);
      ck.reloadKeeps = JSON.stringify(await lStored(page)) === before;
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C162', 'Lists page: Made 1 then Bought it with the full amount drops the row and everything under it from both tabs at once with no stock count lower and the gathered materials under Left over; Buy the rest too sets the way; fewer units keep the row; Undo twice restores both steps exactly; a reload keeps what was not undone',
        Object.values(ck).every(Boolean), { ck, errors: real(errors), external });
      void server;
    });

    // ── C163 (Lists, W8) The "Get it by" select is on a To get row, a To craft row, a Wanted row and a combined-view row, lists only the ways the item has in the row's quality; a craft switched to bought and back shows the first plan again; "I have enough of this" moves the row to "Not in your typed stock"; a looped item shows under Other with its note. ──
    await guard('C163', async () => {
      const server = await start(PORT5);
      const { ctx, errors, external } = await listsCtx();
      const page = await ctx.newPage();
      await page.goto(ROOT5 + 'lists/'); await lReady(page);
      const ck = {};
      await lSeedLists(page, [{ name: 'Select', items: [[100, 1], [150, 1], [130, 3]] }, { name: 'Select two', items: [[100, 1]] }]);
      await lOpenList(page, 'Select'); await lAdd(page, 'mythril', 130, 1); await lTab(page, 'wanted');
      await lRow(page, 130).nth(1).locator('[data-flag=hq]').check(); await lSettle(page);
      ck.wantedSelect = (await lRow(page, 100).locator('[data-f=way]').count()) === 1 && /Crafted by Armorer/.test(await lRow(page, 100).textContent());
      const nqOpts = await lWayOptions(page, lRow(page, 130).nth(0)), hqOpts = await lWayOptions(page, lRow(page, 130).nth(1));
      ck.nqWays = JSON.stringify(nqOpts) === JSON.stringify(['', 'vendor', 'craft', 'trade', 'market', 'have']);
      ck.hqWays = JSON.stringify(hqOpts) === JSON.stringify(['', 'vendor', 'craft', 'market', 'have']);
      await lTab(page, 'craft');
      const plan0 = async () => { await lTab(page, 'get'); await lOpenAll(page); const g = await lSecs(page); await lTab(page, 'craft'); return JSON.stringify([Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((r) => r.item + r.q)])), (await lBlocks(page)).map((b) => [b.job, b.rows.map((r) => r.item + r.q)]), await lTotals(page)]); }; // the rows and totals, not the reason text (it then says "You chose this")
      const first = await plan0();
      const crow = page.locator('.craft-row[data-item="100"]');
      ck.craftSelect = (await crow.locator('[data-f=way]').count()) === 1 && JSON.stringify(await lWayOptions(page, crow)) === JSON.stringify(['', 'craft', 'market', 'have']);
      await crow.locator('[data-f=way]').selectOption('market'); await lSettle(page);
      ck.movedToBuy = (await page.locator('.craft-row[data-item="100"]').count()) === 0;
      await lTab(page, 'get'); await lOpenAll(page);
      ck.getSelect = lItemsIn(await lSecs(page), 'market').includes(100) && (await page.locator('.get-row[data-item="100"] [data-f=way]').count()) === 1;
      await page.locator('.get-row[data-item="100"] [data-f=way]').selectOption('craft'); await lSettle(page);
      await lTab(page, 'craft');
      ck.backToFirst = (await plan0()) === first;
      // I have enough of this
      await page.locator('.craft-row[data-item="100"] [data-f=way]').selectOption('have'); await lSettle(page);
      await lTab(page, 'get'); await lOpenAll(page);
      const secs = await lSecs(page), have = (secs.have || []).filter((r) => r.item === 100)[0];
      ck.notTyped = !!have && /1 not in your typed stock: you said you already have these\./.test(have.text) && !lItemsIn(secs, 'market').includes(100);
      ck.looped = (secs.other || []).some((r) => r.item === 150 && /Self Knot needs itself; Self Knot is listed under Other\./.test(r.text));
      await page.locator('.get-row[data-item="100"] [data-f=way]').selectOption('');  await lSettle(page);
      // the combined view
      await page.click('[data-act=back]'); await page.locator('.list-card', { hasText: 'Select two' }).locator('[data-f=tick]').check(); await lSettle(page);
      await page.locator('.list-card', { hasText: 'Select' }).first().locator('[data-f=tick]').check(); await lSettle(page);
      await page.locator('.lists-group').first().locator('[data-act=combined]').click(); await page.waitForSelector('.tab[data-tab=craft]');
      await lTab(page, 'craft');
      ck.combinedSelect = (await page.locator('.craft-row[data-item="100"] [data-f=way]').count()) === 1;
      await page.locator('.craft-row[data-item="100"] [data-f=way]').selectOption('market'); await lSettle(page);
      await lTab(page, 'get'); await lOpenAll(page);
      ck.combinedMoved = lItemsIn(await lSecs(page), 'market').includes(100) && /need 2,/.test((await lSecs(page)).market.filter((r) => r.item === 100)[0].text);
      ck.noErrors = real(errors).length === 0 && external.length === 0;
      record('C163', 'Lists page, "Get it by": the select is on a To get row, a To craft row, a Wanted row and a combined-view row and lists only the ways the item has in that row\'s quality; a craft switched to bought and back shows the first plan again; "I have enough of this" moves the row to Not in your typed stock with its sentence; a looped item shows under Other with its note',
        Object.values(ck).every(Boolean), { ck, nqOpts, hqOpts, errors: real(errors), external });
      void server;
    });

    // ── C132 (review fixes E4, E6) Phone Map: every sector's tap circle is 44 px across at 360 and 390 px, or as large as its neighbours allow (never under 28 px, and touching a neighbour's circle when under 44); the "Start" label clears every node,
    //    ring, mark and line, on a phone and on desktop. Phone Board: a company's four lanes end within 2.5 screens of 800 px and each lane's explanatory line is behind one "Details" button (closed, aria-expanded, keyboard and tap). Phone send window:
    //    the sticky footer is at most 96 px with every button 44 px, the long advice text is two lines with "Show more", and the route comparison is within one screen's scroll. ──
    await guard('C132', async () => {
      const server = await start(PORT5);
      const ready = (pg) => pg.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const SEED = FCS('fa', 'Alpha Company', 0, 4) + FCS('fb', 'Bravo Company', 1, 2) +
        "sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub A1', rank: 50, parts: [3, 4, 1, 2], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } }; sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub A2', rank: 40, parts: [3, 4, 1, 2], voyage: { sentAt: now - H, route: [1, 3], returnAt: now + 27 * H } };" +
        "sec.subs.a3 = { fcId: 'fa', slot: 3, name: 'Sub A3', rank: 30, parts: [3, 4, 1, 2] }; sec.subs.a4 = { fcId: 'fa', slot: 4, name: 'Sub A4', rank: 20, parts: [3, 4, 1, 2] }; sec.subs.b1 = { fcId: 'fb', slot: 1, name: 'Sub B1', rank: 20, parts: [3, 4, 1, 2] };";
      const chart = (pg) => pg.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; };
        const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        const nodes = [...document.querySelectorAll('.chart-svg .chart-node')].map((g) => {
          const h = g.querySelector('.hit').getBoundingClientRect(), parts = [...g.children].filter((c) => !c.matches('.hit, .chart-focus, .chart-halo, .chart-letter, .chart-tag, .chart-lock')).map(R);
          return { cx: (h.left + h.right) / 2, cy: (h.top + h.bottom) / 2, d: h.width, parts };
        });
        const touch = nodes.map((n, i) => nodes.some((m, j) => j !== i && Math.abs((n.d + m.d) / 2 - Math.hypot(n.cx - m.cx, n.cy - m.cy)) < 1.5));
        const sr = document.createRange(); sr.selectNodeContents(document.querySelector('.chart-svg .chart-start text')); const st = sr.getBoundingClientRect(), t = { x0: st.left, x1: st.right, y0: st.top, y1: st.bottom };
        const marks = nodes.some((n) => n.parts.some((p) => hit(t, p)));
        const lineHit = [...document.querySelectorAll('.chart-svg .chart-lines line, .chart-svg .chart-route')].some((l) => {
          const pts = l.tagName === 'line' ? [[+l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')]] : (() => { const p = l.getAttribute('points').split(' ').map((q) => q.split(',').map(Number)); return p.slice(1).map((q, i) => [p[i][0], p[i][1], q[0], q[1]]); })();
          const m = l.getScreenCTM(), svg = l.ownerSVGElement;
          return pts.some(([x1, y1, x2, y2]) => { for (let i = 0; i <= 40; i++) { const pt = svg.createSVGPoint(); pt.x = x1 + (x2 - x1) * i / 40; pt.y = y1 + (y2 - y1) * i / 40; const q = pt.matrixTransform(m); if (q.x > t.x0 && q.x < t.x1 && q.y > t.y0 && q.y < t.y1) return true; } return false; });
        });
        return { n: nodes.length, min: Math.min(...nodes.map((n) => n.d)), bad: nodes.filter((n, i) => n.d < 43.5 && !(touch[i] && n.d >= 28)).length, startOnMark: marks, startOnLine: lineHit, w: Math.round(document.querySelector('.chart-svg').getBoundingClientRect().width) };
      });
      const rowsA = [];
      for (const [vw, vh, phone] of [[360, 800, true], [390, 844, true], [1440, 1000, false]]) {
        const { ctx, errors } = await context(phone ? { viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: vw, height: vh } });
        const page = await ctx.newPage(); await page.goto(ROOT5 + 'submersibles/'); await ready(page); await tlSeed(page, SEED); await page.reload(); await ready(page);
        await page.click('[data-tab=map]'); await page.waitForSelector('.chart-svg');
        for (const sea of [1, 2, 3, 4, 5, 6, 7]) { await page.click('[data-map-sea="' + sea + '"]'); await page.waitForSelector('.chart-svg[data-sea="' + sea + '"]'); const m = await chart(page); rowsA.push(Object.assign({ vw, sea, errors: real(errors).length }, m)); }
        await ctx.close();
      }
      const okA = rowsA.every((r) => r.n > 0 && r.errors === 0 && !r.startOnMark && !r.startOnLine && (r.vw === 1440 || r.bad === 0));
      const phoneMin = Object.fromEntries([360, 390].map((w) => [w, rowsA.filter((r) => r.vw === w).map((r) => Math.round(r.min * 10) / 10)]));
      // phone Board and send window
      const ph = await context({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const pg = await ph.ctx.newPage(); await pg.goto(ROOT5 + 'submersibles/'); await ready(pg); await tlSeed(pg, SEED); await pg.reload(); await ready(pg); await pg.waitForSelector('.fc .sub[data-sub]');
      const board = await pg.evaluate(() => {
        const fc = document.querySelector('.fc'), lanes = [...fc.querySelectorAll('.sub')], last = lanes[3].getBoundingClientRect(), more = [...document.querySelectorAll('.sub .lane-more')];
        return { lanes: lanes.length, bottom: Math.round(last.bottom + scrollY), more: more.length, exp: more.map((b) => b.getAttribute('aria-expanded')).join(), hidden: [...document.querySelectorAll('.sub .sub-extra')].every((e) => getComputedStyle(e).display === 'none'), ctl: more.every((b) => b.getAttribute('aria-controls') && document.getElementById(b.getAttribute('aria-controls'))), tap: Math.min(...more.map((b) => b.getBoundingClientRect().height)), rank: lanes.slice(0, 4).every((l) => l.querySelector('.sub-meta span').getBoundingClientRect().width > 0), side: document.documentElement.scrollWidth - innerWidth };
      });
      await pg.click('.fc .sub[data-sub="a3"] .lane-more'); const opened = await pg.evaluate(() => ({ sheet: !!document.querySelector('#sheet[open]'), exp: document.querySelector('.sub[data-sub="a3"] .lane-more').getAttribute('aria-expanded'), shown: getComputedStyle(document.querySelector('.sub[data-sub="a3"] .sub-extra')).display !== 'none' }));
      await pg.focus('.fc .sub[data-sub="a3"] .lane-more'); await pg.keyboard.press('Enter'); const closed = await pg.evaluate(() => ({ sheet: !!document.querySelector('#sheet[open]'), exp: document.querySelector('.sub[data-sub="a3"] .lane-more').getAttribute('aria-expanded'), shown: getComputedStyle(document.querySelector('.sub[data-sub="a3"] .sub-extra')).display !== 'none' }));
      const sheetOf = async (id) => {
        await pg.click('.sub[data-sub="' + id + '"] .sub-top'); await pg.waitForSelector('#sheet[open] .advice'); await pg.waitForTimeout(250);
        const r = await pg.evaluate(() => { const sh = document.querySelector('#sheet'), a = document.querySelector('#sheet .sheet-actions').getBoundingClientRect(), c = document.querySelector('#sheet .cmp').getBoundingClientRect(), w = document.querySelector('#advice-why'), wm = document.querySelector('#sheet .why-more'), lh = parseFloat(getComputedStyle(w).lineHeight);
          return { actions: Math.round(a.height), btns: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((b) => Math.round(b.getBoundingClientRect().height)), cmpTop: Math.round(c.top - sh.getBoundingClientRect().top + sh.scrollTop), client: sh.clientHeight, whyLines: Math.round(w.getBoundingClientRect().height / lh), whyCut: w.scrollHeight > w.clientHeight + 1, more: wm ? { hidden: wm.hidden, exp: wm.getAttribute('aria-expanded'), text: wm.textContent } : null, side: document.documentElement.scrollWidth - innerWidth }; });
        let after = null;
        if (r.more && !r.more.hidden) { await pg.click('#sheet .why-more'); after = await pg.evaluate(() => ({ exp: document.querySelector('#sheet .why-more').getAttribute('aria-expanded'), text: document.querySelector('#sheet .why-more').textContent, h: Math.round(document.querySelector('#advice-why').getBoundingClientRect().height) })); }
        await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('#sheet[open]')).catch(() => {});
        return Object.assign(r, { after });
      };
      const sIdle = await sheetOf('a3'), sBack = await sheetOf('a1');
      const errs = real(ph.errors); await ph.ctx.close();
      const okB = board.lanes === 4 && board.bottom <= 2000 && board.more >= 4 && /^false(,false)+$/.test(board.exp) && board.hidden && board.ctl && board.tap >= 44 && board.rank && board.side <= 0 &&
        !opened.sheet && opened.exp === 'true' && opened.shown && !closed.sheet && closed.exp === 'false' && !closed.shown;
      const okC = [sIdle, sBack].every((x) => x.actions <= 96 && x.btns.every((h) => h >= 44) && x.side <= 0) && sIdle.whyLines <= 2 && sIdle.whyCut && sIdle.more && !sIdle.more.hidden && sIdle.more.exp === 'false' && sIdle.more.text === 'Show more' && sIdle.after && sIdle.after.exp === 'true' && sIdle.after.text === 'Show less' &&
        sIdle.cmpTop <= 2 * sIdle.client - sIdle.actions && errs.length === 0;
      record('C132', 'Phone Map taps, Start label, Board lanes and send window (review fixes E4, E6): tap circles 44 px or neighbour-limited (360/390 px minimum per sea ' + JSON.stringify(phoneMin) + '), "Start" clear of nodes, rings, marks and lines in 7 seas at 360, 390 and 1,440 px; four lanes end at ' + board.bottom + ' px (limit 2,000) with one Details button each (closed, tap and Enter open and close, the lane does not open the send window); send window footer ' + sIdle.actions + ' px (limit 96), buttons ' + sIdle.btns.join('/') + ' px, advice text ' + sIdle.whyLines + ' lines with Show more, route comparison at ' + sIdle.cmpTop + ' px of a ' + sIdle.client + ' px window (back state ' + sBack.cmpTop + ')',
        okA && okB && okC, { okA, okB, okC, board, opened, closed, sIdle, sBack, errs, bad: rowsA.filter((r) => r.bad || r.startOnMark || r.startOnLine), phoneMin });
      server.close();
    });
    await guard('L1', async () => {
      const server20 = await start(PORT5);
      const seedL1 = (pg) => pg.evaluate(async () => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} }, parts = [3, 4, 1, 2];
        sec.fcs.fa = { name: 'Alpha Company', world: 'Gilgamesh', unlockedSlots: 3, order: 0, discovered: [1, 2, 3, 10, 15] };
        sec.fcs.fb = { name: 'Bravo Company', world: 'Gilgamesh', unlockedSlots: 1, order: 1, discovered: [1] };
        sec.subs.a1 = { fcId: 'fa', slot: 1, name: 'Sub One', rank: 50, parts, voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };
        sec.subs.a2 = { fcId: 'fa', slot: 2, name: 'Sub Two', rank: 40, parts, voyage: { sentAt: now - H, route: [1, 3], returnAt: now + 27 * H } };
        sec.subs.a3 = { fcId: 'fa', slot: 3, name: 'Sub Three', rank: 30, parts };
        sec.subs.b1 = { fcId: 'fb', slot: 1, name: 'Sub B1', rank: 12, parts };
        // W25: the quantities vary (so the gil heat varies) and some voyages carry the grade noted on return (seed data only; the other voyages have none)
        const qty = [2, 5, 1, 8, 3, 6, 2, 4, 7, 1, 3], grade = ['SS', '', 'S', 'A', '', 'B', '', 'C', '', 'A', ''];
        for (let i = 1; i <= 11; i++) { sec.trips['a1-' + i] = { s: 'a1', t: now - (40 + i * 30) * H, r: [1, 2], back: now - (40 + i * 30 - 29) * H, items: [[10099, qty[i - 1]]], newSectors: [] }; if (grade[i - 1]) sec.trips['a1-' + i].grade = grade[i - 1]; }
        // W22: four more voyages, two on a route in sea 2 (sectors 32, 33) and two in sea 5 (95, 96; ids from data/submarines.json), one of each pair with no items
        [[12, [32, 33], [[10099, 1]]], [13, [32, 33], []], [14, [95, 96], [[10099, 3]]], [15, [95, 96], []]].forEach(([i, r, items]) => { sec.trips['a1-' + i] = { s: 'a1', t: now - (40 + i * 30) * H, r, back: now - (40 + i * 30 - 29) * H, items, newSectors: [] }; if (i === 14) sec.trips['a1-14'].grade = 'S'; });
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      });
      // W22: the palette sheet (a temporary overlay made and removed here; nothing ships) and the measure of "how many colour families" (R3.7)
      const PAL = require('../tests/subs-palette.js');
      // Revision 4 (W31): the palette sheet is grouped by role (tools/subs-roles.js holds the list); each role is a row, each tone a swatch with a sample and the hex the browser computed under it
      const ROLE = require('../tools/subs-roles.js');
      const SPECIAL = new Set(['--molten', '--glow', '--hi', '--shadow', '--sweep', '--scrim', '--chart-glow', '--rule', '--grid']); // set by the theme or alpha: shown, not read as a hex
      const ON_OF = { '--paper': '--ink', '--paper-2': '--ink', '--paper-3': '--ink', '--slip': '--ink', '--slab': '--on-slab', '--seal': '--on-seal', '--back': '--on-back', '--out': '--on-out', '--idle': '--on-idle', '--chart-bg': '--chart-ink', '--chart-bg-2': '--chart-ink', '--chart-bg-hi': '--chart-ink', '--deep': '--on-deep', '--deep-2': '--on-deep' };
      const paletteHtml = (title) => {
        const MODEL = new Set(['--on-mid']); // tokens the model computes (compared with the browser); the others are read and shown only
        ROLE.ROLES.forEach((r) => r.tokens.forEach(([t]) => { if (/^--(rank|gil|loot|route)-[mgsw]$/.test(t) || /^--sea-\d(-[gsw])?$/.test(t) || /^--(back|out|idle|bad)-s$/.test(t) || /^--(deep|deep-2|on-deep|deep-line)$/.test(t)) MODEL.add(t); }));
        const swatch = (t, tone) => {
          const free = !MODEL.has(t) || undefined;
          const special = SPECIAL.has(t), solid = !special;
          const fill = t === '--molten' ? 'background:var(--molten)' : special ? 'background:var(--paper) linear-gradient(var(' + t + '),var(' + t + '))' : 'background:var(' + t + ')';
          let inner = '', samp = '';
          const on = ON_OF[t] || (tone === 'field' ? '--on-mid' : null);
          if (tone === 'field' && on) inner = '<span style="color:var(' + on + ')">Text on this field</span>';
          if (tone === 'on') samp = '<div class="pl-smp" style="background:var(' + ({ '--on-slab': '--slab', '--on-slab-2': '--slab', '--on-seal': '--seal', '--on-back': '--back', '--on-out': '--out', '--on-idle': '--idle', '--on-deep': '--deep-2', '--on-mid': '--rank-m' }[t] || '--slab') + ');color:var(' + t + ')"><b>Text on its field</b></div>';
          if (tone === 'graphic') samp = '<div class="pl-smp" style="background:var(--paper)"><i style="display:inline-block;width:62%;height:7px;background:var(' + t + ')"></i> <span style="display:inline-block;width:16px;height:11px;border:3px solid var(' + t + ');vertical-align:middle"></span></div>';
          if (tone === 'text' && /^--chart-/.test(t)) samp = '<div class="pl-smp" style="background:var(--chart-bg);color:var(' + t + ')"><b>On the water</b></div>'; // M15: a chart text tone is drawn on the water only, so the sheet shows it there and not on the page
          else if (tone === 'text') samp = '<div class="pl-smp" style="background:var(--slip);color:var(' + t + ')"><b>On the panel</b></div><div class="pl-smp" style="background:var(--paper);color:var(' + t + ')"><b>On the page</b></div>';
          if (tone === 'wash') inner = '<span style="color:var(--ink)">Ink on the wash</span>';
          if (tone === 'text' || tone === 'graphic') inner = '';
          const own = '<div class="pl-fill" style="' + fill + '">' + inner + '</div>';
          return '<div class="pl-sw" data-token="' + t + '"' + (free ? ' data-free="1"' : '') + (solid ? '' : ' data-special="1"') + '>' + own + '<div class="pl-cap"><b>' + t + '</b> <span class="pl-role">' + tone + '</span><br><span class="pl-hex">' + (solid ? '' : 'set by the theme') + '</span></div>' + samp + '</div>';
        };
        const row = (r, n) => '<div class="pl-row"><div class="pl-lab"><b>' + (n ? n + '. ' : '') + r.name + '</b><br>' + r.stands + '</div><div class="pl-tones">' + r.tokens.map(([t, tone]) => swatch(t, tone)).join('') + '</div></div>';
        const chart = (html) => '<div class="map-panel" style="display:contents">' + html + '</div>';
        let h = '<style>#pl{position:absolute;top:0;left:0;right:0;z-index:99999;box-sizing:border-box;padding:14px 20px 20px;background:var(--paper);color:var(--ink);font:13px/1.35 var(--f-body, sans-serif)}#pl h2{font:900 22px/1 var(--f-disp, sans-serif);text-transform:uppercase;margin:14px 0 6px}#pl .pl-row{display:grid;grid-template-columns:170px minmax(0,1fr);gap:10px;align-items:start;margin:6px 0;padding-top:6px;border-top:1px solid var(--ink-3)}#pl .pl-tones{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}#pl .pl-sw{min-width:0}#pl .pl-fill{height:42px;display:flex;align-items:center;padding:0 8px;font-weight:700;border:1px solid var(--ink-3)}#pl .pl-cap{font-size:11px;line-height:1.3;padding:2px 0}#pl .pl-role{color:var(--ink-2)}#pl .pl-hex{font-family:monospace}#pl .pl-smp{padding:2px 8px;font-size:12px}#pl .pl-lab b{font-size:15px}</style>';
        h += '<div id="pl"><h2 style="margin-top:0">' + title + '</h2><div>Every colour role of the Submersibles module in this theme, by name: its tones, a sample of each, and under each swatch the hex the browser computed. Theme roles come from the theme; meaning roles keep one hue in every theme.</div>';
        h += '<h2>Theme roles (9 roles, 25 tones)</h2>';
        ROLE.ROLES.filter((r) => r.kind === 'theme').forEach((r, i) => { h += row(r, i + 1); });
        h += '<h2>Meaning roles (18 roles, 77 tones with the shared on-mid)</h2>';
        let n = 9;
        ROLE.ROLES.filter((r) => r.kind === 'meaning').forEach((r) => { n++; h += r.tokens.some((x) => x[0].startsWith('--chart-')) ? chart(row(r, n)) : row(r, n); });
        h += row(ROLE.SHARED, '');
        return h + '</div>';
      };
      // reads every labelled swatch's computed background through a 1 x 1 canvas, writes the hex under it, returns [token, bytes]
      const readSwatches = (pg) => pg.evaluate(() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
        const px = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        return [...document.querySelectorAll('#pl [data-token]:not([data-special])')].map((el) => {
          const f = el.querySelector('.pl-fill'), b = px(getComputedStyle(f).backgroundColor);
          el.querySelector('.pl-hex').textContent = '#' + b.map((x) => x.toString(16).padStart(2, '0')).join('');
          return [el.dataset.token, b, !!el.dataset.free];
        });
      });
      // the screen voice as drawn now: a probe painted with var(--scr), read through the canvas
      const readScr = (pg) => pg.evaluate(() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
        const out = {};
        [['--scr', 'scr'], ['--scr-g', 'scrg']].forEach(([v, k]) => {
          const p = document.createElement('i'); p.style.cssText = 'position:absolute;width:1px;height:1px;background:var(' + v + ')'; document.body.appendChild(p);
          cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = getComputedStyle(p).backgroundColor; cx.fillRect(0, 0, 1, 1); out[k] = [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); p.remove();
        });
        return out;
      });
      // R3.7 measure: colour families on the screen now (record only; nothing asserted in W22)
      const families = (pg) => pg.evaluate(() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
        const memo = new Map();
        const px = (c) => { if (memo.has(c)) return memo.get(c); cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data, r = [d[0], d[1], d[2], d[3] / 255]; memo.set(c, r); return r; };
        const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const lch = (r) => { const [R, G, B] = r.map(lin), l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B), a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s; let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360; return [0, Math.hypot(a, b), h]; };
        const samples = [];
        const add = (c, w) => { if (!c || w <= 0 || /^url\(/.test(c) || c === 'none' || c === 'transparent') return; const p = px(c); if (p[3] < 0.5) return; const k = lch(p); if (k[1] >= 0.06) samples.push([k[2], w]); };
        const sides = ['Top', 'Right', 'Bottom', 'Left'];
        const one = (el, cs, svg, pseudo) => {
          if (!svg) { const w = pseudo ? (parseFloat(cs.width) * parseFloat(cs.height) || 0) : (() => { const r = el.getBoundingClientRect(); return r.width * r.height; })(); add(cs.backgroundColor, w); }
          const own = pseudo ? (cs.content && cs.content !== 'none' && cs.content !== 'normal' && cs.content !== '""') : [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (own) add(cs.color, 300);
          sides.forEach((sd) => { if (parseFloat(cs['border' + sd + 'Width']) >= 3 && cs['border' + sd + 'Style'] !== 'none' && cs['border' + sd + 'Style'] !== 'hidden') add(cs['border' + sd + 'Color'], 300); });
          if (svg) { add(cs.fill, 300); add(cs.stroke, 300); }
        };
        document.querySelectorAll('.subs-main, .subs-main *, #sheet[open], #sheet[open] *').forEach((el) => {
          if (!el.getClientRects().length) return;
          const svg = el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg';
          one(el, getComputedStyle(el), svg, false);
          if (!svg) ['::before', '::after'].forEach((ps) => { const cs = getComputedStyle(el, ps); if (cs.content && cs.content !== 'none' && cs.content !== 'normal') one(el, cs, false, true); });
        });
        // cut the wheel at its largest empty gap, then group greedily: a family ends when a hue is more than 30 degrees from its first
        samples.sort((a, b) => a[0] - b[0]);
        let at = 0, best = -1;
        for (let i = 0; i < samples.length; i++) { const gap = (samples[(i + 1) % samples.length][0] - samples[i][0] + 360) % 360; if (gap > best) { best = gap; at = (i + 1) % samples.length; } }
        const ord = samples.slice(at).concat(samples.slice(0, at)), fams = [];
        ord.forEach((s) => { const f = fams[fams.length - 1]; if (f && (s[0] - f.h0 + 360) % 360 <= 30) { f.w += s[1]; f.x += Math.cos(s[0] * Math.PI / 180) * s[1]; f.y += Math.sin(s[0] * Math.PI / 180) * s[1]; } else fams.push({ h0: s[0], w: s[1], x: Math.cos(s[0] * Math.PI / 180) * s[1], y: Math.sin(s[0] * Math.PI / 180) * s[1] }); });
        const kept = fams.filter((f) => f.w >= 300).map((f) => [Math.round((Math.atan2(f.y, f.x) * 180 / Math.PI + 360) % 360), Math.round(f.w)]);
        return { n: kept.length, f: kept };
      });
      // Revision 4 (W31): the role audit. Every opaque computed colour (text of an element's own text, background, border of 1 px or more, fill and stroke of a drawn shape) inside .subs-main and #sheet[open]
      // should equal a tone in that theme's generated list (docs/submersibles-colour-roles.md) within 2 per channel. W31 records the misses (distinct colours, with the property and element they were first seen on); W36 asserts there are none.
      const rolePalette = (theme, mode) => {
        const row = PAL.THEMES.find((r) => r[0] === theme), ctx = ROLE.envOf(row, mode), list = [];
        const add = (v) => { if (/^#[0-9a-f]{6}$/i.test(v)) list.push(PAL.hexRgb(v)); };
        ROLE.ROLES.concat([ROLE.SHARED]).forEach((r) => r.tokens.forEach(([t]) => { if (t.startsWith('--chart-')) for (let s = 1; s <= 7; s++) add(ROLE.valueOf(t, ctx, s)); else add(ROLE.valueOf(t, ctx)); }));
        Object.values(ctx.T).forEach(add);
        return list;
      };
      const roleAudit = (pg, list) => pg.evaluate((list) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true }), memo = new Map();
        const px = (c) => { if (memo.has(c)) return memo.get(c); cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data, r = [d[0], d[1], d[2], d[3] / 255]; memo.set(c, r); return r; };
        // the tones the theme itself sets (the line colours, which the model prints as a formula): read from the page, as the browser resolves them
        ['--rule', '--grid'].forEach((t) => { const pr = document.createElement('i'); pr.style.cssText = 'position:absolute;width:1px;height:1px;background:var(' + t + ')'; document.body.appendChild(pr); const q = px(getComputedStyle(pr).backgroundColor); pr.remove(); if (q[3] >= 0.99) list = list.concat([q.slice(0, 3)]); });
        const miss = new Map(); let n = 0;
        const hex = (r) => '#' + r.slice(0, 3).map((x) => x.toString(16).padStart(2, '0')).join('');
        const check = (c, what, el) => {
          if (!c || c === 'none' || /^url\(/.test(c) || c === 'transparent') return;
          const p = px(c); if (p[3] < 0.99) return; n++;
          if (list.some((t) => Math.max(Math.abs(t[0] - p[0]), Math.abs(t[1] - p[1]), Math.abs(t[2] - p[2])) <= 2)) return;
          const k = hex(p), e = miss.get(k) || { n: 0, first: what + ' ' + el.tagName.toLowerCase() + '.' + String(el.getAttribute('class') || '').split(' ')[0] }; e.n++; miss.set(k, e);
        };
        const sides = ['Top', 'Right', 'Bottom', 'Left'];
        document.querySelectorAll('.subs-main, .subs-main *, #sheet[open], #sheet[open] *').forEach((el) => {
          if (!el.getClientRects().length) return;
          const cs = getComputedStyle(el), svg = el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg';
          if (svg) { check(cs.fill, 'fill', el); check(cs.stroke, 'stroke', el); return; }
          check(cs.backgroundColor, 'background', el);
          if ([...el.childNodes].some((nd) => nd.nodeType === 3 && nd.textContent.trim())) check(cs.color, 'color', el);
          sides.forEach((sd) => { if (parseFloat(cs['border' + sd + 'Width']) >= 1 && cs['border' + sd + 'Style'] !== 'none' && cs['border' + sd + 'Style'] !== 'hidden') check(cs['border' + sd + 'Color'], 'border', el); });
        });
        return { n, miss: miss.size, top: [...miss.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([k, v]) => k + ' x' + v.n + ' ' + v.first) };
      }, list);
      // W23 (spec R3.6): what the chart draws now, read from computed style: only the planned route is dashed, the background lines are thin, the links are weighted by meaning, only lead and goal arrowheads show
      const chartProbe = (pg) => pg.evaluate(() => {
        const px = (v) => parseFloat(v) || 0, all = [...document.querySelectorAll('.chart-svg *')], out = { dashBad: [], grid: 0, rings: 0, lead: null, goal: null, route: null, nLead: 0, nGoal: 0, chevBad: 0, chevShown: 0 };
        all.forEach((el) => { const cs = getComputedStyle(el), cls = el.getAttribute('class') || ''; if (!/\bchart-route\b/.test(cls) && cs.strokeDasharray !== 'none' && cs.strokeDasharray !== '') out.dashBad.push(el.tagName + '.' + cls + ' ' + cs.strokeDasharray); });
        document.querySelectorAll('.chart-svg .chart-grid').forEach((el) => { out.grid = Math.max(out.grid, px(getComputedStyle(el).strokeWidth)); });
        document.querySelectorAll('.chart-svg .chart-rings circle').forEach((el) => { out.rings = Math.max(out.rings, px(getComputedStyle(el).strokeWidth)); });
        document.querySelectorAll('.chart-svg line.lead').forEach((el) => { out.nLead++; out.lead = Math.min(out.lead == null ? 99 : out.lead, px(getComputedStyle(el).strokeWidth)); });
        document.querySelectorAll('.chart-svg line.goal').forEach((el) => { out.nGoal++; out.goal = Math.min(out.goal == null ? 99 : out.goal, px(getComputedStyle(el).strokeWidth)); });
        document.querySelectorAll('.chart-svg polyline.chart-route').forEach((el) => { const cs = getComputedStyle(el); out.route = px(cs.strokeWidth); out.routeColour = cs.stroke; });
        // W29: the planned route's colour is used by nothing else on the chart except the route's own glow, the rings round its stops and the letters of those stops
        out.routeShared = out.routeColour ? all.filter((el) => { const cls = el.getAttribute('class') || '', cs = getComputedStyle(el); if (/\bchart-(route|route-glow|routering)\b/.test(cls)) return false; if (/\bchart-letter\b/.test(cls) && el.closest('.chart-node.on-route')) return false; return (cs.stroke === out.routeColour && cs.strokeWidth !== '0px') || (cs.fill === out.routeColour && el.tagName.toLowerCase() !== 'svg'); }).map((el) => el.tagName + '.' + (el.getAttribute('class') || '')) : [];
        document.querySelectorAll('.chart-svg .chart-chev').forEach((el) => { if (getComputedStyle(el).display !== 'none') { out.chevShown++; if (!(el.classList.contains('lead') || el.classList.contains('goal'))) out.chevBad++; } });
        return out;
      });
      // W36: the axis labels on screen (the ticks that are drawn, not the notches): left to right they are never closer than 6 px, "now" is first and the quarter that ends the axis is last, three or more of them
      const axisGaps = (pg) => pg.evaluate(() => {
        const res = { axes: 0, minGap: 999, bad: [] };
        document.querySelectorAll('.tl-axis').forEach((ax) => {
          if (!ax.getClientRects().length) return;
          const all = [...ax.querySelectorAll('i:not(.tl-mark)')], shown = all.filter((i) => getComputedStyle(i).display !== 'none'), r = shown.map((i) => i.getBoundingClientRect());
          res.axes++;
          for (let k = 1; k < r.length; k++) res.minGap = Math.min(res.minGap, Math.round((r[k].left - r[k - 1].right) * 10) / 10);
          if (shown.length < 3 || shown[0] !== all[0] || shown[shown.length - 1] !== all[all.length - 1] || shown[0].textContent !== 'now' || !/^\+\d+ h$/.test(shown[shown.length - 1].textContent)) res.bad.push(shown.map((i) => i.textContent).join(' '));
        });
        return res;
      });
      // W36: colours as the browser resolves them: a token (as a background) or a property of the first element a selector finds, as three bytes; null when nothing is there
      const colourOf = (pg, list) => pg.evaluate((list) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
        const px = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        return list.map(([sel, prop]) => {
          if (sel === 'token') { const pr = document.createElement('i'); pr.style.cssText = 'position:absolute;width:1px;height:1px;background:var(' + prop + ')'; (document.querySelector('.subs-page') || document.body).appendChild(pr); const c = px(getComputedStyle(pr).backgroundColor); pr.remove(); return c; }
          const el = document.querySelector(sel); return el ? px(getComputedStyle(el)[prop]) : null;
        });
      }, list);
      const walk = async (opts, tag, screens, checkPhone, theme, mode, pal) => {
        const { ctx, errors } = await context(opts);
        const page = await ctx.newPage();
        if (theme) { // as C28 chooses a theme: the main Settings, dark mode
          await page.goto(ROOT5 + '#settings'); await page.waitForSelector('#s-appearance .look-card');
          await page.click('#s-appearance [data-look=toggle][data-v="shared:theme"]');
          await page.click('#s-appearance [data-look=theme][data-v="' + theme + '"]'); await page.click('#s-appearance [data-look=mode][data-v=' + (mode || 'dark') + ']');
        }
        const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
        await page.goto(ROOT5 + 'submersibles/'); await ready();
        await seedL1(page); await page.reload(); await ready();
        const wide = [], wideNew = [], fam = {}, scr = {}, audit = {}, gaps = {}, aud = pal ? rolePalette(pal.theme, pal.mode) : null, shot = async (name) => { if (SHOT) await page.screenshot({ path: path.join(ev, 'look-' + name + '-' + tag + '.png') }); if (checkPhone) wide.push(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)); if (/^(wizard|empty)/.test(name)) wideNew.push(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)); fam[name] = await families(page); if (aud) audit[name] = await roleAudit(page, aud); if (/^board/.test(name)) gaps[name] = await axisGaps(page); (out.v2l.together = out.v2l.together || []).push(...await runTogether(page)); };
        const tab = async (t) => { await page.click('[data-tab=' + t + ']'); await page.waitForTimeout(250); if (pal) scr[t] = await readScr(page); };
        const out = { v1l: {}, v2l: {} };
        if (pal) { // the palette sheet: before any screen, on the Board's page background, then removed
          await page.waitForSelector('.sub[data-sub]'); scr.board = await readScr(page);
          await page.evaluate((html) => { const d = document.createElement('div'); d.id = 'pl-host'; d.innerHTML = html; document.body.appendChild(d); }, paletteHtml(pal.title));
          await page.waitForTimeout(300);
          const got = await readSwatches(page); await page.waitForTimeout(150);
          if (SHOT) await page.screenshot({ path: path.join(ev, 'look-palette-' + pal.name + '.png'), fullPage: true });
          out.v2l.pal = await page.evaluate(() => { const sw = document.querySelector('#pl [data-token="--chart-hot-text"]'); return sw ? [...sw.querySelectorAll('.pl-smp')].map((e) => e.textContent.trim()) : null; }); // M15
          await page.evaluate(() => document.getElementById('pl-host').remove());
          out.palGot = got;
        }
        if (screens.includes('board')) { await page.waitForSelector('.sub[data-sub]'); await shot('board');
          out.v1l.boardLines = badEnds(await renderedLines(page, '.sub-when .when, .sub-when .quick, .strip-next')); // S5
          out.v2l.boardW = await widthProbe(page, '.strip'); out.v2l.marks = await markProbe(page);
          // W21: the Out row (Sub Two, sent an hour ago, back in 27 hours) carries one voyage gauge, drawn and named in words
          out.lockedSea = await page.evaluate(() => document.querySelectorAll('.sub[data-status="locked"][class*="in-sea-"]').length); out.headBand = await page.evaluate(() => [...document.querySelectorAll('.fc-head')].filter((h) => /linear-gradient/.test(h.getAttribute('style') || '') && getComputedStyle(h).backgroundImage.includes('linear-gradient')).length);
          // W36: the two buttons of a company head stand on one line
          out.headTools = await page.evaluate(() => { const t = document.querySelector('.fc-head .fc-tools'), bs = t ? [...t.querySelectorAll('.btn')].map((b) => b.getBoundingClientRect()) : []; return { n: bs.length, sameLine: bs.every((b) => Math.abs(b.top - bs[0].top) <= 2), head: Math.round(document.querySelector('.fc-head').getBoundingClientRect().height), btnH: bs.length ? Math.round(Math.max(...bs.map((b) => b.height))) : 0 }; });
          out.gauge = await page.evaluate(() => { const r = document.querySelector('.sub[data-status="out"] .vgauge'); return { n: document.querySelectorAll('.sub[data-status="out"] .vgauge').length, h: r ? Math.round(r.getBoundingClientRect().height) : 0, text: r ? r.nextElementSibling.textContent : '' }; }); }
        // W32: the Board by return time (one column of compact lanes on the shared axis); a picture, the colour families recorded, the sort put back
        if (screens.includes('board') && !checkPhone) { await page.click('[data-sort=time]'); await page.waitForSelector('.fc.wide .tl-axis'); await page.waitForTimeout(250); await shot('board-time'); out.timeLanes = await page.evaluate(() => document.querySelectorAll('.fc.wide .sub[data-sub]').length); out.v2l.timeBars = await barProbe(page); out.v2l.timeMarks = await markProbe(page); await page.click('[data-sort=fc]'); await page.waitForSelector('.fleet'); }
        if (screens.includes('sheet')) {
          await page.click('.sub[data-sub="a1"] .sub-top'); await page.waitForSelector('#sheet[open] .advice'); await page.waitForTimeout(250); await shot('sheet');
          // W20, W35: the same window scrolled to the comparison, the suggestion and the other routes on one axis (a picture only)
          await page.$eval('#sheet .cmp', (el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(250);
          if (SHOT) await page.screenshot({ path: path.join(ev, 'look-sheet-route-' + tag + '.png') });
          { const [edge, plate] = await colourOf(page, [['#sheet .cmp-lane .tl-bar', 'outlineColor'], ['#sheet .cmp', 'backgroundColor']]); out.trough = await page.evaluate(() => { const b = document.querySelector('#sheet .cmp-lane .tl-bar'), cs = getComputedStyle(b); return { w: parseFloat(cs.outlineWidth), style: cs.outlineStyle, h: Math.round(b.getBoundingClientRect().height) }; }); out.trough.ratio = Math.round(PAL.ratio(edge, plate) * 100) / 100; }
          // Visual fixes part 2. M12: the subtitle is one line under the title, 13 px, only the company's name may be cut (the whole text in title). M4: the picker's sector letters are discs in their sea's colour.
          // M15: the sea select has one focus mark (the outline), the step badge of a chosen sector stays inside the picker and the sheet's gutter
          out.v2l.sub = await page.evaluate(() => { const h = document.querySelector('#sheet h2'), sub = h.querySelector('.sheet-sub'), sr = sub.getBoundingClientRect(), rg = document.createRange(); rg.setStart(h.firstChild, 0); rg.setEnd(h.firstChild, h.firstChild.length); const tr = rg.getBoundingClientRect(), cs = getComputedStyle(sub);
            return { below: sr.top >= tr.bottom - 1, oneLine: sr.height <= parseFloat(cs.fontSize) * 1.6, fs: parseFloat(cs.fontSize), nowrap: cs.whiteSpace === 'nowrap', title: sub.title, text: sub.textContent, fits: sub.scrollWidth <= sub.clientWidth + 1 || getComputedStyle(sub.querySelector('.sheet-fc')).textOverflow === 'ellipsis' }; });
          out.v2l.pickDiscs = await page.evaluate(() => { const rs = [...document.querySelectorAll('#sheet .sector')], mk = (v) => { const i = document.createElement('i'); i.style.background = v; document.querySelector('#sheet').append(i); const c = getComputedStyle(i).backgroundColor; i.remove(); return c; };
            return { n: rs.length, discs: rs.map((t) => { const d = t.querySelector('b > .disc'); if (!d) return null; const m = /in-sea-(\d)/.exec(d.className), cs = getComputedStyle(d); return { sea: !!m && cs.backgroundColor === mk('var(--sea-' + m[1] + ')'), size: Math.round(d.getBoundingClientRect().width), round: cs.borderRadius, text: d.textContent === t.querySelector('b').textContent }; }) }; });
          out.v2l.reveal = await page.evaluate(() => { const os = [...document.querySelectorAll('#sheet .loot-new .opt')].filter((o) => o.querySelector('[data-new-sector]')); return { n: os.length, phone: innerWidth < 480, rows: os.map((o) => { const b = o.querySelector('b').getBoundingClientRect(), m = o.querySelector('.muted'), mr = m.getBoundingClientRect(); return { one: m.getClientRects().length === 1, stacked: mr.top >= b.bottom - 1, aligned: Math.abs(mr.left - b.left) <= 2 }; }) }; });
          out.v2l.altLines = await renderedLines(page, '#sheet .alts li'); // M6 (same zone): "back" never stands alone at the end of a line, apart from its time
          await page.focus('#sheet select[name=sea]');
          out.v2l.focus = await page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e), i = document.createElement('i'); i.style.color = 'var(--ink)'; document.querySelector('#sheet').append(i); const ink = getComputedStyle(i).color; i.remove(); return { tag: e.tagName, outlineStyle: cs.outlineStyle, outlineW: cs.outlineWidth, bgImage: cs.backgroundImage, edge: cs.borderTopColor === ink }; });
          await page.evaluate(() => document.activeElement.blur());
          await page.click('#sheet .sector:not(:disabled)'); await page.waitForTimeout(200);
          out.v2l.ord = await page.evaluate(() => { const box = document.querySelector('#sheet .sectors').getBoundingClientRect(), sh = document.querySelector('#sheet .sheet-in').getBoundingClientRect(); return [...document.querySelectorAll('#sheet .sector .ord')].map((o) => { const r = o.getBoundingClientRect(); return r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.left >= sh.left + 10 && r.right <= sh.right - 10; }); });
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheet[open]')).catch(() => {});
          // M15: the "Send all back" window's confirm button is full width like the send window's
          await page.click('[data-act=sendallfleet]'); await page.waitForSelector('#sheet[open] [data-act=dosendall]'); await page.waitForTimeout(200);
          out.v2l.sendall = await page.evaluate(() => { const b = document.querySelector('#sheet [data-act=dosendall]'), a = b.closest('.sheet-actions'), br = b.getBoundingClientRect(), ar = a.getBoundingClientRect(), cs = getComputedStyle(a); return { w: Math.round(br.width), room: Math.round(ar.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), h: Math.round(br.height) }; });
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#sheet[open]')).catch(() => {});
        }
        if (screens.includes('log')) { await tab('log'); await page.waitForSelector('.log-row[data-trip]'); await shot('log'); out.v2l.logW = await widthProbe(page, '.subs-main .panel');
          // W25: the Log's rows carry their sea, whether loot is logged and the grade chip (read from the page; the colours are measured by the family count)
          out.unlogged = await page.evaluate(() => { const m = document.querySelector('.log-row.unlogged .log-what .muted'), cs = m && getComputedStyle(m); return m ? { text: m.textContent.trim(), style: cs.borderTopStyle, w: parseFloat(cs.borderTopWidth), heat: getComputedStyle(m.closest('.log-what'), '::after').content } : null; });
          // V3: the day-and-time cell has at most two rendered lines (the date on one line, the clock under it); on the desktop all rows share one height
          out.v3 = await page.evaluate(() => { const cells = [...document.querySelectorAll('.log-when')], lines = (c) => new Set([...c.querySelectorAll('span')].flatMap((sp) => { const rg = document.createRange(); rg.selectNodeContents(sp); return [...rg.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)); })).size, rows = [...document.querySelectorAll('.log-row')].map((r) => Math.round(r.getBoundingClientRect().height)); return { n: cells.length, maxLines: Math.max(...cells.map(lines)), dateOne: cells.every((c) => { const d = c.querySelector('span'), r = document.createRange(); r.selectNodeContents(d); return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size <= 1; }), clipped: cells.filter((c) => c.scrollWidth > c.clientWidth + 1).length, twoLines: cells.filter((c) => c.querySelectorAll('span').length === 2).length, rowSpread: Math.max(...rows) - Math.min(...rows), wide: innerWidth >= 701 }; });
          out.logProbe = await page.evaluate(() => { const rows = [...document.querySelectorAll('.log-row')]; return { n: rows.length, seas: [...new Set(rows.map((r) => (r.className.match(/in-sea-\d/) || [''])[0]).filter(Boolean))].length, logged: rows.filter((r) => r.classList.contains('logged')).length, unlogged: rows.filter((r) => r.classList.contains('unlogged')).length, graded: rows.filter((r) => r.querySelector('.log-grade')).length, ungraded: rows.filter((r) => !r.querySelector('.log-grade')).length, chips: [...new Set([...document.querySelectorAll('.log-grade')].map((c) => c.textContent))].join('|'), cells: [...new Set(rows.map((r) => getComputedStyle(r.querySelector('.log-when')).backgroundColor))].length }; }); }
        if (screens.includes('map')) { await tab('map'); await page.waitForSelector('.chart-svg');
          // S7: under 480 px the seas are one sideways-scrolling row (chips 44 px, the chosen sea in view, a fade, arrow keys), the MAP head is at most 56 px, the chart starts at 420 px or higher
          if (page.viewportSize().width < 480) {
            await page.evaluate(() => window.scrollTo(0, 0));
            out.v1l.seaStrip = await page.evaluate(() => { const st = document.querySelector('.map-seas'), chips = [...st.querySelectorAll('[data-map-sea]')], sr = st.getBoundingClientRect(), on = st.querySelector('[aria-pressed="true"]').getBoundingClientRect(), cs = getComputedStyle(st), h2 = document.querySelector('.map-panel > h2').getBoundingClientRect(), cw = document.querySelector('.chart-wrap').getBoundingClientRect();
              return { oneRow: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size === 1, scrolls: st.scrollWidth > st.clientWidth + 1, minH: Math.min(...chips.map((c) => c.getBoundingClientRect().height)), inView: on.left >= sr.left - 1 && on.right <= sr.right + 1, fade: !!st.getAttribute('data-more') && /gradient/.test(cs.maskImage || cs.webkitMaskImage || ''), overflowX: cs.overflowX, links: [...st.querySelectorAll('.sea-link')].filter((l) => l.getBoundingClientRect().height > 0).length, head: Math.round(h2.height), chartTop: Math.round(cw.top + scrollY), side: document.documentElement.scrollWidth - innerWidth }; });
            out.v2l.chips = await page.evaluate(() => ({ h: [...document.querySelectorAll('.map-seas [data-map-sea]')].map((c) => Math.round(c.getBoundingClientRect().height)), chartTop: Math.round(document.querySelector('.chart-wrap').getBoundingClientRect().top + scrollY) }));
            await page.focus('.map-seas [aria-pressed="true"]'); await page.keyboard.press('ArrowRight');
            out.v1l.seaKey = await page.evaluate(() => { const a = document.activeElement; return { onChip: a.matches('.map-seas [data-map-sea]'), moved: a.getAttribute('aria-pressed') !== 'true' }; });
            await page.keyboard.press('Enter'); await page.waitForTimeout(300);
            out.v1l.seaChange = await page.evaluate(() => { const st = document.querySelector('.map-seas'), on = st.querySelector('[aria-pressed="true"]'), sr = st.getBoundingClientRect(), r = on.getBoundingClientRect(); return { inView: r.left >= sr.left - 1 && r.right <= sr.right + 1, sea: on.dataset.mapSea }; });
            await page.click('.map-seas [data-map-sea="1"]'); await page.waitForTimeout(200);
          } await page.click('.chart-svg [data-sector="10"]'); await page.waitForSelector('.chart-details'); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250); await shot('map'); out.chartMap = await chartProbe(page);
          // M17: the "+" mark of the selected sector stands outside the keyboard-focus ring (which hugs the bracket), at full strength, with its halo in the water colour
          // V4: the bright lines (the way to the next slot or sea, the amber "can be revealed now" arrows) are obstacles: no "+" mark, cross or label box (as drawn, in pixels) meets one of them
          out.v4 = await page.evaluate(() => { const svg = document.querySelector('.chart-svg'), ctm = svg.getScreenCTM(), pt = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(ctm); return [q.x, q.y]; }, lines = [...svg.querySelectorAll('.chart-lines line.lead, .chart-lines line.goal')].map((l) => [pt(+l.getAttribute('x1'), +l.getAttribute('y1')), pt(+l.getAttribute('x2'), +l.getAttribute('y2'))]), things = [...svg.querySelectorAll('.chart-plus, .chart-cannot-x, .chart-letter, .chart-tag')], bad = [];
            things.forEach((t) => { const r = t.getBoundingClientRect(); lines.forEach(([a, b]) => { for (let i = 0; i <= 80; i++) { const x = a[0] + (b[0] - a[0]) * i / 80, y = a[1] + (b[1] - a[1]) * i / 80; if (x > r.left + 1 && x < r.right - 1 && y > r.top + 2 && y < r.bottom - 2) { bad.push((t.getAttribute('class') || '') + ' ' + (t.textContent || '').trim()); return; } } }); });
            return { lines: lines.length, things: things.length, bad }; });
          out.v2l.plus = await page.evaluate(() => {
            const svg = document.querySelector('.chart-svg'), sel = svg.querySelector('.chart-node.selected'); if (!sel) return null;
            const mk = (v) => { const i = document.createElement('i'); i.style.background = v; document.querySelector('.map-panel').append(i); const c = getComputedStyle(i).backgroundColor; i.remove(); return c; };
            const focus = sel.querySelector('.chart-focus'), plus = sel.querySelector('.chart-plus'), halo = sel.querySelector('.chart-plus-halo'); if (!focus || !plus || !halo) return { missing: true };
            focus.style.display = 'inline'; const fr = focus.getBoundingClientRect(); focus.style.display = '';
            const cx = (fr.left + fr.right) / 2, cy = (fr.top + fr.bottom) / 2, ringR = fr.width / 2 + 1.5, pr = plus.getBoundingClientRect(), nx = Math.max(pr.left, Math.min(cx, pr.right)), ny = Math.max(pr.top, Math.min(cy, pr.bottom)), dist = Math.hypot(nx - cx, ny - cy) - 1.5, cp = getComputedStyle(plus), ch = getComputedStyle(halo);
            return { outside: dist >= ringR, gap: Math.round((dist - ringR) * 10) / 10, full: cp.strokeOpacity === '1' && cp.opacity === '1', haloColour: ch.stroke === mk('var(--chart-bg)'), haloW: parseFloat(ch.strokeWidth), plusW: parseFloat(cp.strokeWidth), inkColour: cp.stroke === mk('var(--chart-ink)'), halos: svg.querySelectorAll('.chart-plus-halo').length === svg.querySelectorAll('.chart-plus').length && svg.querySelectorAll('.chart-plus').length > 0 };
          });
          // W36: the chain of seas and the chart on the first screen (the tab bar is fixed at the bottom of a phone)
          out.mapChain = await page.evaluate(() => { const ch = document.querySelector('.map-seas').getBoundingClientRect(), bs = [...document.querySelectorAll('[data-map-sea]')].map((b) => b.getBoundingClientRect()), svg = document.querySelector('.chart-svg').getBoundingClientRect(), tabs = document.querySelector('.tabs').getBoundingClientRect(), phone = getComputedStyle(document.querySelector('.tabs')).position === 'fixed', vis = [...document.querySelectorAll('.map-seas .sea-link')].filter((l) => l.getClientRects().length).length; return { chainH: Math.round(ch.height), rows: new Set(bs.map((b) => Math.round(b.top))).size, minH: Math.round(Math.min(...bs.map((b) => b.height))), chartTop: Math.round(svg.top), chartShown: Math.round(Math.min(svg.bottom, phone ? tabs.top : innerHeight) - Math.max(svg.top, 0)), innerH: innerHeight, links: vis, side: document.documentElement.scrollWidth - innerWidth }; });
          // W19: the sector console with the first tier block opened, scrolled to it (a picture only, no assertion)
          await page.$eval('.chart-details .rates-tier', (el) => { el.open = true; el.scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(250);
          out.v2l.tier = await page.evaluate(() => { const sm = document.querySelector('.chart-details .rates-tier[open] > summary'), i = document.createElement('i'); i.style.background = 'var(--route-w)'; document.querySelector('.chart-details').append(i); const w = getComputedStyle(i).backgroundColor; i.remove(); return { same: !!sm && getComputedStyle(sm).backgroundColor === w }; }); // M15: the open tier header is the route wash in every theme
          if (SHOT) await page.screenshot({ path: path.join(ev, 'look-map-tiers-' + tag + '.png') });
          await page.$eval('.chart-details .rates-tier', (el) => { el.open = false; }); await page.evaluate(() => window.scrollTo(0, 0)); }
        if (screens.includes('planner')) {
          await page.selectOption('#map-sub', 'a1'); await page.click('.chart-svg [data-sector="1"]'); await page.click('.chart-svg [data-sector="3"]');
          await page.waitForSelector('.planner .route-line'); await page.$eval('.planner', (el) => el.scrollIntoView()); await page.waitForTimeout(250); await shot('planner'); out.chartPlan = await chartProbe(page);
          // M7: the chart and the planner start at one height, the legend sits directly under the chart; M5, M6: no orphan letter in the route title, no tag at the start of a line
          out.v2l.mapGrid = await page.evaluate(() => { const g = (s) => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); }, ch = g('.map-grid > .chart-wrap'), k = g('.map-grid > .chart-key'), pl = g('.map-grid > .planner'), dt = g('.map-grid > .chart-details'); return { wide: innerWidth >= 1100, chartTop: Math.round(ch.top + scrollY), plannerTop: Math.round(pl.top + scrollY), keyGap: Math.round(k.top - ch.bottom), details: !!dt, plannerH: Math.round(pl.height), chartH: Math.round(ch.height), taller: !!dt && dt.bottom > ch.bottom }; });
          out.v2l.plannerLines = { route: await renderedLines(page, '.planner .route-line'), calc: await renderedLines(page, '.planner .calc-line') };
        }
        if (screens.includes('earnings')) { await tab('earn'); await page.waitForSelector('.earn-card b'); await shot('earnings'); out.v2l.earnW = await widthProbe(page, '.subs-main .panel');
          // S8: four tallies of one size and type; Today is the solid gil field in the on-voice text; the figure's line box clears the label by 6 px and no glyph touches
          out.v1l.tallies = await page.evaluate(() => { const pr = (v) => { const i = document.createElement('i'); i.style.color = v; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; }, gil = pr('var(--gil-m)'), onm = pr('var(--on-mid)'), cards = [...document.querySelectorAll('.earn-card')];
            const rows = cards.map((c) => { const cs = getComputedStyle(c), b = c.querySelector('b'), sp = c.querySelector('span'), br = b.getBoundingClientRect(), sr = sp.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(b); const gr = rg.getBoundingClientRect(); rg.selectNodeContents(sp); const lr = rg.getBoundingClientRect(); return { w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), pad: cs.padding, band: cs.backgroundSize, bFont: getComputedStyle(b).fontSize + getComputedStyle(b).fontFamily, sFont: getComputedStyle(sp).fontSize, bg: cs.backgroundColor, bColor: getComputedStyle(b).color, sColor: getComputedStyle(sp).color, gap: sr.top - br.bottom, glyphGap: lr.top - gr.bottom }; });
            return { n: rows.length, same: new Set(rows.map((r) => [r.w, r.h, r.pad, r.band, r.bFont, r.sFont].join('|'))).size === 1, todaySolid: rows[0].bg === gil && rows[0].bColor === onm && rows[0].sColor === onm, othersDeep: rows.slice(1).every((r) => r.bg !== gil), minGap: Math.min(...rows.map((r) => r.gap)), minGlyphGap: Math.min(...rows.map((r) => r.glyphGap)), todayBg: rows[0].bg, gil }; });
          // W20: the ranked table scrolled into view (a picture only; at 360 px every figure shows with no inner scrolling)
          await page.waitForTimeout(800); await page.evaluate(() => { const el = document.querySelector('.earn-ranked'); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: 'instant' }); }); await page.waitForTimeout(400);
          if (SHOT) await page.screenshot({ path: path.join(ev, 'look-earnings-ranked-' + tag + '.png') });
          // V5: every rendered line of a route name in a ranked card or a "not enough data" row starts at the name's own left edge (one x for all lines), beside the discs and never under them
          out.v5 = await page.evaluate(() => { const names = [...document.querySelectorAll('.earn-ranked tr[data-pos] > td:nth-child(2) .rt-name, .earn-thin tr:not(.earn-note) > td:first-child .rt-name')], rows = names.map((nm) => { const rg = document.createRange(); rg.selectNodeContents(nm); const byTop = {}; [...rg.getClientRects()].filter((q) => q.width > 0).forEach((q) => { const k = Math.round(q.top / 4); byTop[k] = Math.min(byTop[k] === undefined ? 1e9 : byTop[k], q.left); }); const lefts = Object.values(byTop), disc = nm.parentNode.querySelector('.discs'), dr = disc && disc.getBoundingClientRect(), nr = nm.getBoundingClientRect(); return { text: nm.textContent.trim(), lines: lefts.length, spread: Math.max(...lefts) - Math.min(...lefts), atEdge: Math.min(...lefts) - nr.left <= 1, besideDiscs: !dr || nr.left >= dr.right - 1 }; }); return { n: rows.length, ranked: document.querySelectorAll('.earn-ranked .rt-name').length, thin: document.querySelectorAll('.earn-thin .rt-name').length, multi: rows.filter((r) => r.lines > 1).length, rows, phone: innerWidth <= 700 }; });
          // S9: the suffix sits under the title; under 560 px each ranked route is a card: the route (discs and name) alone on the first line ("Deep-sea Site: A \u2192 B" on one line), the bar on its own full-width line, gil per voyage left and voyages right (nowrap) on the third
          out.v1l.ranked = await page.evaluate(() => { const h = [...document.querySelectorAll('.wide-panel > h3')].find((x) => /Gil per hour by route/.test(x.textContent)), mu = h.querySelector('.muted'), rg = document.createRange(); rg.setStart(h.firstChild, 0); rg.setEnd(h.firstChild, h.firstChild.length); const tr = rg.getBoundingClientRect(), mr = mu.getBoundingClientRect(), phone = innerWidth < 560;
            const rows = [...document.querySelectorAll('.earn-ranked tr[data-pos]')].map((r) => { const t = r.getBoundingClientRect(), q = (n) => r.children[n].getBoundingClientRect(); const nm = r.querySelector('.rt-name'), g = document.createRange(); g.selectNodeContents(nm); const ls = new Set([...g.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 4))); return { text: nm.textContent.replace(/\s+/g, ' ').trim(), lines: ls.size, vo: q(4).top, voBottom: q(4).bottom, voNowrap: getComputedStyle(r.children[4]).whiteSpace === 'nowrap', perTop: q(3).top, perBottom: q(3).bottom, barTop: q(2).top, barBottom: q(2).bottom, barL: q(2).left, barR: q(2).right, tl: t.left, tr: t.right, side: document.documentElement.scrollWidth - innerWidth, w: t.width }; });
            return { under: mr.top >= tr.bottom - 1, phone, n: rows.length, card: !phone || rows.every((r) => r.voNowrap && r.vo >= r.barBottom - 1 && r.vo < r.perBottom && r.voBottom > r.perTop && r.barL - r.tl <= 1 && r.tr - r.barR <= 1 && r.side <= 0) && rows.filter((r) => r.text === 'Deep-sea Site: A \u2192 B').every((r) => r.lines === 1) }; }); }
        if (screens.includes('setup')) { await tab('setup'); await page.waitForSelector('[data-recs-panel]'); await shot('setup');
          // S4: every Setup head (the Recommendations head too) has one field, one text colour, one type and one height; the four-colour stripe is a 6 px accent directly under the head
          out.v1l.heads = await page.evaluate(() => { const hs = [...document.querySelectorAll('.panel > h2:first-child')].filter((h) => h.getClientRects().length && !h.closest('.empty-state')), rs = document.querySelector('.panel.recs > h2:first-child'), cs = (h) => getComputedStyle(h), rc = cs(rs);
            return { n: hs.length, bgs: [...new Set(hs.map((h) => cs(h).backgroundColor))], colours: [...new Set(hs.map((h) => cs(h).color))], fonts: [...new Set(hs.map((h) => cs(h).fontSize + cs(h).fontFamily + cs(h).fontWeight))], heights: hs.map((h) => Math.round(h.getBoundingClientRect().height)), recsInList: hs.includes(rs), stripe: rc.borderBottomWidth === '6px' && /gradient/.test(rc.borderImageSource) }; });
          // M8, M11, M18: Setup's two columns from 1,400 px (tops aligned), the company line in units that never split, every head on one line at a phone width
          out.v2l.setup = await page.evaluate(() => { const hs = [...document.querySelectorAll('.panel > h2:first-child')].filter((h) => h.getClientRects().length && !h.closest('.empty-state')), lines = (h) => { const rg = document.createRange(), tops = new Set(), w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) for (let i = 0; i < n.nodeValue.length; i++) { if (!n.nodeValue[i].trim()) continue; rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getClientRects()[0]; if (r && r.width) tops.add(Math.round(r.top)); } return tops.size; };
            const cols = document.querySelector('.setup-cols'), cs = cols ? [...cols.querySelectorAll(':scope > .setup-col')].map((e) => e.getBoundingClientRect()) : [], recs = document.querySelector('.panel.recs'), fcp = document.querySelector('.setup-col .panel');
            return { width: innerWidth, heights: hs.map((h) => Math.round(h.getBoundingClientRect().height)), lines: hs.map(lines), cols: cols ? getComputedStyle(cols).display : null, c0: cs[0] && [Math.round(cs[0].left), Math.round(cs[0].right)], c1: cs[1] && [Math.round(cs[1].left), Math.round(cs[1].right)], tops: [fcp && Math.round(fcp.getBoundingClientRect().top), recs && Math.round(recs.getBoundingClientRect().top)], inRight: !!recs && !!recs.closest('.setup-col:nth-child(2)'), nbOne: [...document.querySelectorAll('.fc-list li .muted .nb')].every((e) => e.getClientRects().length === 1) && document.querySelectorAll('.fc-list li .muted .nb').length >= 2 }; });
          out.v2l.fcMeta = await renderedLines(page, '.fc-list li > span > .muted');
          // V2: at 1,440 and 1,920 px every top-level Setup panel's right edge is the left column's or the page column's, and the first panel's equals the right column's
          { const edges = () => page.evaluate(() => { const main = document.querySelector('.subs-main'), cs = getComputedStyle(main), page = Math.round(main.getBoundingClientRect().right - parseFloat(cs.paddingRight)), cols = document.querySelector('.setup-cols'); if (!cols) return null; const [l, r] = [...cols.querySelectorAll(':scope > .setup-col')].map((e) => Math.round(e.getBoundingClientRect().right)), tops = [...main.querySelectorAll(':scope > .panel, :scope > .setup-cols > .setup-col > .panel')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().right)), first = main.querySelector(':scope > .panel'); return { width: innerWidth, page, l, r, tops, first: first && Math.round(first.getBoundingClientRect().right) }; });
            const vs = page.viewportSize(); out.v2l.edges = [];
            if (vs.width >= 1400) { out.v2l.edges.push(await edges()); await page.setViewportSize({ width: 1920, height: vs.height }); await page.waitForTimeout(300); out.v2l.edges.push(await edges()); await page.setViewportSize(vs); await page.waitForTimeout(300); } }
          // W36: radio buttons and checkboxes drawn from the roles: the unchecked box's edge against the page colour and the panel (3:1), the checked state in the accent, a focus ring
          { const [ink, paper, slip, seal, onSeal] = await colourOf(page, [['token', '--ink'], ['token', '--paper'], ['token', '--slip'], ['token', '--seal'], ['token', '--on-seal']]);
            const r = await page.evaluate(() => {
              const radios = [...document.querySelectorAll('input[type="radio"]')].filter((e) => e.getClientRects().length), boxes = [...document.querySelectorAll('input[type="checkbox"]')].filter((e) => e.getClientRects().length), cs = (e) => getComputedStyle(e);
              const un = radios.find((e) => !e.checked), on = radios.find((e) => e.checked), cb = boxes.find((e) => !e.checked), cbOn = boxes.find((e) => e.checked);
              return { radios: radios.length, boxes: boxes.length, unW: un && parseFloat(cs(un).borderTopWidth), unApp: un && cs(un).appearance, cbApp: cb && cs(cb).appearance, onImg: on && /radial-gradient/.test(cs(on).backgroundImage), cbOnBg: cbOn ? cs(cbOn).backgroundColor : null, size: un && Math.round(un.getBoundingClientRect().width), cbSize: cb && Math.round(cb.getBoundingClientRect().width), unEdge: un && cs(un).borderTopColor, cbEdge: cb && cs(cb).borderTopColor };
            });
            const [unEdge, cbEdge, cbOnBg] = await colourOf(page, [['input[type="radio"]:not(:checked)', 'borderTopColor'], ['input[type="checkbox"]:not(:checked)', 'borderTopColor'], ['input[type="checkbox"]:checked', 'backgroundColor']]);
            await page.focus('input[type="radio"]'); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
            r.focus = await page.evaluate(() => { const a = document.activeElement, c = getComputedStyle(a); return { type: a.type, w: parseFloat(c.outlineWidth), s: c.outlineStyle }; });
            r.edgeOnPaper = Math.round(PAL.ratio(unEdge, paper) * 100) / 100; r.edgeOnSlip = Math.round(PAL.ratio(unEdge, slip) * 100) / 100; r.cbEdgeOnSlip = Math.round(PAL.ratio(cbEdge, slip) * 100) / 100;
            r.checkedIsAccent = !!cbOnBg && cbOnBg.join() === seal.join(); r.markOnAccent = Math.round(PAL.ratio(onSeal, seal) * 100) / 100;
            out.controls = r;
            if (SHOT && pal) { await page.screenshot({ path: path.join(ev, 'look-controls-' + tag + '.png'), fullPage: true }); await page.evaluate(() => window.scrollTo(0, 0)); } } }
        if (screens.includes('recommendations')) { await page.$eval('[data-recs-panel]', (el) => el.scrollIntoView()); await page.waitForTimeout(250); await shot('recommendations');
          out.v2l.rec = await page.evaluate(() => { const lis = [1, 2, 3, 4].map((n) => document.querySelector('.rec-rank .rung-' + n)), pr = (v) => { const i = document.createElement('i'); i.style.color = v; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; }, seal = pr('var(--seal)'), ink = pr('var(--ink)'), ink2 = pr('var(--ink-2)');
            const left = lis.map((l) => { const b = l.querySelector('.rec-name b'); let t = b.nextSibling; while (t && !(t.nodeType === 3 && t.nodeValue.trim())) t = t.nextSibling; const rg = document.createRange(), i = t.nodeValue.length - t.nodeValue.trimStart().length; rg.setStart(t, i); rg.setEnd(t, i + 1); return Math.round(rg.getClientRects()[0].left * 10) / 10; });
            const r = document.querySelector('.rec-give input[type="range"]'), rule = [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules]; } catch (e) { return []; } }).find((x) => x.selectorText && /rec-give input\[type="range"\]::-webkit-slider-thumb/.test(x.selectorText)), off = [...document.querySelectorAll('.rec-picker')].filter((q) => q.querySelector('.rec-find:disabled')).map((q) => { const sel = q.querySelector('.rec-sel'), o = q.querySelector('.rec-off'), sr = sel.getBoundingClientRect(), orr = o && o.getBoundingClientRect(); return { colour: getComputedStyle(sel).color === ink2, note: getComputedStyle(q.querySelector('.rec-note')).color === ink2, off: !!o && o.textContent.trim() === 'off' && Math.abs((orr.top + orr.bottom) / 2 - (sr.top + sr.bottom) / 2) < sr.height / 2 }; });
            return { minH: lis.map((l) => getComputedStyle(l).minHeight), h: lis.map((l) => Math.round(l.getBoundingClientRect().height)), bw: lis.map((l) => Math.round(l.querySelector('.rec-name b').getBoundingClientRect().width)), left, thumb: { bg: !!rule && /background: var\(--seal\)/.test(rule.cssText), edge: !!rule && /border: 2px solid var\(--ink\)/.test(rule.cssText), opacity: getComputedStyle(r).opacity === '1', disabled: r.disabled }, off }; }); // M9, M10, M15
          out.rungs = await page.evaluate(() => [...document.querySelectorAll('.rec-rank li:not(.hint)')].map((li) => ({ img: /linear-gradient/.test(getComputedStyle(li).backgroundImage), bg: getComputedStyle(li).backgroundColor }))); }
        if (screens.includes('wizard')) {
          // W29: the setup wizard on its last step, where every sea is listed (the first one open); a picture, the sea rows counted, no sideways scroll
          await tab('setup'); await page.click('[data-act="edit"][data-fc="fa"]'); await page.waitForSelector('.wiz-head');
          for (let i = 0; i < 8 && !(await page.$('[data-step="sectors"]')); i++) { await page.click('[data-act="wnext"]'); await page.waitForTimeout(150); }
          await page.waitForSelector('[data-step="sectors"] .sea'); await page.evaluate(() => { const el = document.querySelector('[data-step="sectors"] .sea'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150); }); await page.waitForTimeout(200);
          out.wizScroll = await page.evaluate(() => [window.scrollY, document.documentElement.scrollHeight, document.querySelector('[data-step="sectors"] .sea').getBoundingClientRect().top, getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow]);
          await shot('wizard');
          out.wizard = await page.evaluate(() => ({ seas: document.querySelectorAll('.sea[class*="in-sea-"]').length, open: document.querySelectorAll('.sea[open]').length }));
          // M3, M4, M12, M15: the sector list: a disc in the sea's colour, the rank never splits, the cells of a line share a height, one column under 480 px; a disabled bulk button is readable with its hatched band
          out.v2l.wiz = await page.evaluate(() => { const mk = (v) => { const i = document.createElement('i'); i.style.background = v; document.querySelector('.wiz').append(i); const c = getComputedStyle(i).backgroundColor; i.remove(); return c; }, open = document.querySelector('.wiz .sea[open]'), ts = [...open.querySelectorAll('.tick')], rows = {};
            ts.forEach((t) => { const r = t.getBoundingClientRect(), k = Math.round(r.top); (rows[k] = rows[k] || []).push(Math.round(r.height)); });
            const discs = ts.map((t) => { const d = t.querySelector('b > .disc'), m = d && /in-sea-(\d)/.exec(d.className); return !!d && getComputedStyle(d).backgroundColor === mk('var(--sea-' + m[1] + ')'); }), ticks = open.querySelector('.ticks');
            const res = { n: ts.length, discs: discs.every(Boolean), rankOne: [...open.querySelectorAll('.tick .nb')].every((e) => e.getClientRects().length === 1), sameRow: Object.values(rows).every((hs) => Math.max(...hs) - Math.min(...hs) <= 1), cols: getComputedStyle(ticks).gridTemplateColumns.split(' ').length, width: innerWidth };
            document.querySelectorAll('.wiz .sea').forEach((d) => { d.open = true; });
            const i2 = document.createElement('i'); i2.style.color = 'var(--ink-2)'; document.querySelector('.wiz').append(i2); const ink2 = getComputedStyle(i2).color; i2.remove();
            res.bulk = [...document.querySelectorAll('.wiz .sea-bulk .btn:disabled')].map((b) => { const cs = getComputedStyle(b); return { opacity: cs.opacity, colour: cs.color === ink2, band: /gradient/.test(cs.backgroundImage) && cs.backgroundSize.split(',')[0].trim() === '14px 100%' }; });
            document.querySelectorAll('.wiz .sea').forEach((d, i) => { d.open = i === 0; });
            return res; });
          // M15: the "Mark every sector" button the instant after a tap (the pointer still on it) is readable: no half-way colours (the old picture caught the 120 ms transition), 4.5:1 between its text and its field
          await page.click('.wiz [data-act=seaall]');
          out.v2l.bulkHover = await page.evaluate(() => { const b = document.querySelector('.wiz [data-act=seaall]'), cs = getComputedStyle(b), rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number), lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }, a = lum(rgb(cs.color)), c2 = lum(rgb(cs.backgroundColor)); return { ratio: Math.round((Math.max(a, c2) + 0.05) / (Math.min(a, c2) + 0.05) * 100) / 100, transition: cs.transitionDuration, disabled: b.disabled }; });
          await page.click('[data-act="wcancel"]'); await page.waitForTimeout(200);
        }
        if (checkPhone) {
          out.minHeights = await page.evaluate(() => {
            const sels = ['.btn', '.quick', '.tabs button', '[data-map-sea]', '.sector', '.qbtn', '.log-row', '.sub[data-sub]', '.rec-rank button'], res = {};
            for (const s of sels) { const hs = [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height)); res[s] = hs.length ? Math.min(...hs) : null; }
            return res;
          });
          await tab('map'); await page.waitForSelector('.chart-svg');
          out.chart = await page.evaluate(() => ({ width: Math.round(document.querySelector('.chart-svg').getBoundingClientRect().width), hitMin: Math.round(Math.min(...[...document.querySelectorAll('.chart-svg .chart-node .hit')].map((e) => e.getBoundingClientRect().width))) }));
        }
        if (pal) { // compare the browser with the model, per channel
          const want = PAL.palette(PAL.THEMES.find((r) => r[0] === pal.theme), pal.mode);
          let maxDiff = 0, worst = null, n = 0; const bad = [];
          const cmp = (tok, g, w) => { const d = Math.max(...g.map((v, i) => Math.abs(v - w[i]))); n++; if (d > maxDiff) { maxDiff = d; worst = [tok, g, w]; } if (d > 2) bad.push(tok + ' ' + g + ' vs ' + w); };
          const roleCtx = ROLE.envOf(PAL.THEMES.find((r) => r[0] === pal.theme), pal.mode); // the tones the model does not compute are compared with the generated list's values
          out.palGot.forEach(([tok, g, free]) => { if (free) cmp(tok, g, PAL.hexRgb(ROLE.valueOf(tok, roleCtx))); else { if (!(tok in want)) throw new Error('model has no ' + tok); cmp(tok, g, want[tok]); } });
          Object.keys(scr).forEach((t) => { const g = scr[t]; cmp('--scr@' + t, g.scr, want['--scr@' + t]); cmp('--scr-g@' + t, g.scrg, want['--scr-g@' + t]); });
          out.pal = { theme: pal.theme, mode: pal.mode, compared: n, maxDiff, worst, bad, hex: { rank: PAL.toHex(want['--rank-m']), gil: PAL.toHex(want['--gil-m']), loot: PAL.toHex(want['--loot-m']), route: PAL.toHex(want['--route-m']) } };
          // the page's own timing of PALETTE.compute for this theme (the page reads the root's computed colours, then computes)
          out.pal.ms = await page.evaluate(() => { const t = PALETTE.read(), t0 = performance.now(); for (let i = 0; i < 20; i++) PALETTE.compute(t); return Math.round((performance.now() - t0) / 20 * 100) / 100; });
          out.pal.supportsPalette = await page.evaluate(() => typeof PALETTE === 'object' && typeof PALETTE.compute === 'function' && document.body.style.getPropertyValue('--rank-m').trim().startsWith('#'));
          if (pal.follow) { // the palette follows a theme change made without a reload (as C28 changes it in Settings)
            const probe = (names) => page.evaluate((ns) => {
              const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true }), o = {};
              ns.forEach((n) => { const p = document.createElement('i'); p.style.cssText = 'position:absolute;width:1px;height:1px;background:var(' + n + ')'; document.body.appendChild(p); cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = getComputedStyle(p).backgroundColor; cx.fillRect(0, 0, 1, 1); o[n] = [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); p.remove(); });
              return o;
            }, names);
            const names = ['--rank-m', '--gil-g', '--loot-s', '--route-w', '--on-mid', '--sea-1', '--idle-s'];
            const before = await probe(names);
            await page.evaluate(() => { const k = 'eveniunt-tracker-ui', d = JSON.parse(localStorage.getItem(k) || '{}'); d.theme = 'dark'; localStorage.setItem(k, JSON.stringify(d)); window.EVENIUNT_LOOK.apply(); });
            await page.waitForTimeout(150);
            const after = await probe(names), wantDark = PAL.palette(PAL.THEMES.find((r) => r[0] === pal.theme), 'dark');
            let fd = 0; names.forEach((n) => { fd = Math.max(fd, ...after[n].map((v, i) => Math.abs(v - wantDark[n][i]))); });
            out.pal.follow = { changed: names.filter((n) => before[n].join() !== after[n].join()).length, of: names.length, maxDiff: fd };
          }
          delete out.palGot;
        }
        await ctx.close();
        return { wide, wideNew, fam, audit, gaps, errors: real(errors), ...out };
      };
      const all8 = ['board', 'sheet', 'log', 'map', 'planner', 'earnings', 'setup', 'recommendations'];
      // W29, W33: the empty states (a profile with nothing in it: the Board, the Log and Earnings; then one company hidden) in a given theme; pictures look-empty-{board,log,earnings,hidden}-<tag>.png, the colour families recorded
      const emptyWalk = async (opts, tag, theme, mode, pal) => {
        const { ctx, errors } = await context(opts), page = await ctx.newPage(), fam = {}, wide = [], audit = {}, aud = pal ? rolePalette(pal.theme, pal.mode) : null;
        if (theme) {
          await page.goto(ROOT5 + '#settings'); await page.waitForSelector('#s-appearance .look-card');
          await page.click('#s-appearance [data-look=toggle][data-v="shared:theme"]');
          await page.click('#s-appearance [data-look=theme][data-v="' + theme + '"]'); await page.click('#s-appearance [data-look=mode][data-v=' + mode + ']');
        }
        await page.goto(ROOT5 + 'submersibles/'); await page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
        await page.waitForSelector('.panel.welcome'); await page.waitForTimeout(250);
        const shot = async (name) => { if (SHOT) await page.screenshot({ path: path.join(ev, 'look-' + name + '-' + tag + '.png') }); wide.push(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)); fam[name] = await families(page); if (aud) audit[name] = await roleAudit(page, aud); };
        await shot('empty-board');
        // M1: the label stands centred under the diamond (checked at the page's width and at 900 px); not on a phone, where the word joins the count in the strip
        const v2 = { centred: [] }, centred = () => page.evaluate(() => { const d = document.querySelector('.es-scope .es-dia'), w = document.querySelector('.es-scope .es-word'); if (!d || !w || innerWidth < 701) return null; const a = d.getBoundingClientRect(), b = w.getBoundingClientRect(); return { dx: Math.round(((a.left + a.right) / 2 - (b.left + b.right) / 2) * 10) / 10, below: b.top >= (a.top + a.bottom) / 2, width: innerWidth }; });
        v2.centred.push(await centred());
        { const vs = page.viewportSize(); if (vs.width >= 1000) { await page.setViewportSize({ width: 900, height: vs.height }); await page.waitForTimeout(250); v2.centred.push(await centred()); await page.setViewportSize(vs); await page.waitForTimeout(250); } }
        // W36: the deep-water panel against the page (its two ends, and the four ring colours against both ends) and the scope's labels against the rings' picture
        const T = await colourOf(page, ['--paper', '--deep', '--deep-2', '--route-m', '--loot-m', '--gil-m', '--rank-m'].map((t) => ['token', t])), rt = (a, b) => Math.round(PAL.ratio(a, b) * 100) / 100;
        const deep = { onPage: [rt(T[1], T[0]), rt(T[2], T[0])], rings: Math.min(...T.slice(3).map((c) => Math.min(rt(c, T[1]), rt(c, T[2])))) };
        deep.labels = await page.evaluate(() => { // true when a label sits on the drawing and a ring runs through it (a ring crosses a box when the box has points both inside and outside it)
          const sv = document.querySelector('.es-scope svg').getBoundingClientRect(), rings = [...document.querySelectorAll('.es-scope .es-ring')].map((c) => { const q = c.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, r: q.width / 2 }; });
          const crossed = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (!(r.left < sv.right && r.right > sv.left && r.top < sv.bottom && r.bottom > sv.top)) return false;
            return rings.some((c) => { const nx = Math.max(r.left, Math.min(c.x, r.right)), ny = Math.max(r.top, Math.min(c.y, r.bottom)), near = Math.hypot(nx - c.x, ny - c.y), far = Math.max(...[[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].map(([x, y]) => Math.hypot(x - c.x, y - c.y))); return near < c.r + 2 && far > c.r - 2; }); };
          return { word: crossed(document.querySelector('.es-scope .es-word')), count: crossed(document.querySelector('.es-scope .es-count')) }; });
        await page.click('[data-tab=log]'); await page.waitForSelector('[data-empty="log-none"]'); await page.waitForTimeout(250); await shot('empty-log'); v2.centred.push(await centred());
        // W33: Earnings with nothing logged, and the Board with every company hidden (a company is set up, then unticked in Setup)
        await page.click('[data-tab=earn]'); await page.waitForSelector('[data-empty="earn-none"]'); await page.waitForTimeout(250); await shot('empty-earnings');
        await page.click('[data-tab=setup]'); await page.waitForSelector('[data-empty="setup-none"]'); await page.$eval('[data-empty="setup-none"]', (e) => e.scrollIntoView()); await page.waitForTimeout(250); await shot('empty-setup'); v2.centred.push(await centred()); // fix list W-b: the picture starts at the empty state
        await page.evaluate(async () => { const sec = { fcs: { fa: { name: 'Alpha Company', world: 'Maduin', order: 0, unlockedSlots: 1, discovered: [1, 2, 3] } }, subs: { a1: { fcId: 'fa', slot: 1, name: 'Sub One', rank: 50, parts: [3, 4, 1, 2] } }, trips: {}, settings: {} }; const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null }); });
        await page.reload(); await page.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); await page.click('[data-tab=setup]'); await page.waitForSelector('[data-shown-fc=fa]'); await page.uncheck('[data-shown-fc=fa]'); await page.waitForTimeout(700);
        await page.click('[data-tab=board]'); await page.waitForSelector('[data-empty="board-hidden"]'); await page.waitForTimeout(250); await shot('empty-hidden');
        v2.centred.push(await centred());
        // M2: nothing out: the next-return slab is one compact line, the tools stand under it with no blank band, and the footnote has no stray ")"
        v2.strip = await page.evaluate(() => { const n = document.querySelector('.strip-next'), st = document.querySelector('.strip'), t = document.querySelector('.strip-tools'), nr = n.getBoundingClientRect(), sr = st.getBoundingClientRect(), tr = t.getBoundingClientRect(); return { none: n.classList.contains('none'), text: n.textContent, h: Math.round(nr.height), toolsBelow: tr.top >= nr.bottom - 1 || tr.left >= nr.right - 1, blank: Math.round(sr.bottom - Math.max(tr.bottom, nr.bottom)), foot: [...document.querySelectorAll('.foot-note')].map((e) => e.textContent).filter((x) => /\)\)/.test(x)).length, width: innerWidth }; });
        await ctx.close();
        return { fam, wide, audit, deep, v2, errors: real(errors) };
      };
      // W32: the dense Board (eight companies of four submarines at 1920 x 1080) in a theme: the picture look-board-dense-<tag>.png, the lowest lane bottom, no sideways scroll, the colour families recorded
      const denseWalk = async (opts, tag, theme, mode, o) => {
        o = o || { n: 8, pic: 'dense' }; const aud = o.pal ? rolePalette(o.pal.theme, o.pal.mode) : null;
        const { ctx, errors } = await context(opts), page = await ctx.newPage();
        if (theme) {
          await page.goto(ROOT5 + '#settings'); await page.waitForSelector('#s-appearance .look-card');
          await page.click('#s-appearance [data-look=toggle][data-v="shared:theme"]');
          await page.click('#s-appearance [data-look=theme][data-v="' + theme + '"]'); await page.click('#s-appearance [data-look=mode][data-v=' + mode + ']');
        }
        await page.goto(ROOT5 + 'submersibles/'); await page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
        await page.evaluate(async (N) => {
          const now = Date.now(), sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
          ['Alpha', 'Bravo', 'Cedar', 'Delta', 'Ember', 'Fable', 'Garnet', 'Harbor'].slice(0, N).forEach((n, i) => {
            sec.fcs['f' + i] = { name: n + ' Company', world: 'Maduin', order: i, unlockedSlots: i === 7 ? 3 : 4, discovered: [1, 2, 3] };
            for (let s = 1; s <= 4; s++) { const kind = (i + s) % 3, ret = kind === 0 ? now + (i * 4 + s) * 600000 : kind === 1 ? now - 600000 : null; sec.subs['s' + i + s] = { fcId: 'f' + i, slot: s, name: 'Sub ' + n[0] + s, rank: 60 + s, parts: [3, 4, 1, 2], voyage: ret ? { sentAt: now - 3600000, route: [1, 2], returnAt: ret, gameSaid: '1h' } : null }; }
          });
          const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
        }, o.n);
        await page.reload(); await page.waitForSelector('html[data-ready="1"]', { timeout: 20000 }); await page.waitForSelector('.fc .sub[data-sub]'); await page.waitForTimeout(300);
        if (SHOT) await page.screenshot({ path: path.join(ev, 'look-board-' + o.pic + '-' + tag + '.png') });
        const m = await page.evaluate(() => { const subs = [...document.querySelectorAll('.fc .sub[data-status]')].map((e) => e.getBoundingClientRect()); return { maxBottom: Math.round(Math.max(...subs.map((r) => r.bottom))), laneMax: Math.round(Math.max(...subs.map((r) => r.height))), columns: new Set([...document.querySelectorAll('.fc')].map((el) => Math.round(el.getBoundingClientRect().left))).size, sideways: document.documentElement.scrollWidth - innerWidth, fcs: document.querySelectorAll('.fc').length }; });
        m.axis = await axisGaps(page);
        // M13: every company head has the same height and its buttons on the same row; a locked slot says in full where it opens (up to two lines, no ellipsis, nothing cut). M14: the send bar and the rank chip
        m.heads = await page.evaluate(() => ({ heads: [...document.querySelectorAll('.fc-head')].map((h) => { const r = h.getBoundingClientRect(), t = h.querySelector('.fc-tools'), tr = t.getBoundingClientRect(); return { h: Math.round(r.height), toolsTop: Math.round(tr.top - r.top), tools: t.querySelectorAll('.btn').length }; }),
          locked: [...document.querySelectorAll('.sub[data-status="locked"] .sub-meta')].map((e) => { const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight); return { text: e.textContent.trim(), lines: Math.round(e.getBoundingClientRect().height / lh), clipped: e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1, ellipsis: cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth }; }) }));
        m.bars = await barProbe(page); m.marks = await markProbe(page);
        const fam = await families(page), audit = aud ? await roleAudit(page, aud) : null;
        await ctx.close();
        return { m, fam, audit, errors: real(errors) };
      };
      const d = await walk({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' }, 'desktop', all8.concat('wizard'), false, null, null, { name: 'default', theme: 'crystarium-dawnglass', mode: 'light', follow: true, title: 'Palette: Crystarium Dawnglass, light (the default)' });
      const dd = await walk({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' }, 'desktop-dark', ['board', 'map'], false);
      const da = await walk({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' }, 'desktop-azure-dark', all8.concat('wizard'), false, 'azure-dragoon', 'dark', { name: 'azure-dark', theme: 'azure-dragoon', mode: 'dark', title: 'Palette: Azure Dragoon, dark' });
      const dm = await walk({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' }, 'desktop-magitek-light', all8.concat('wizard'), false, 'magitek-steel', 'light', { name: 'magitek-light', theme: 'magitek-steel', mode: 'light', title: 'Palette: Magitek Steel, light' });
      const p390 = await walk({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'phone-390', ['board', 'map'], false);
      const p = await walk({ viewport: { width: 360, height: 800 }, colorScheme: 'dark', deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'phone', all8, true);
      const pl = await walk({ viewport: { width: 360, height: 800 }, colorScheme: 'light', deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'phone-light', ['board', 'map', 'wizard'], false);
      const PD = { theme: 'crystarium-dawnglass', mode: 'light' }, PA = { theme: 'azure-dragoon', mode: 'dark' }, PM = { theme: 'magitek-steel', mode: 'light' };
      const n0 = await denseWalk({ viewport: { width: 1920, height: 1080 }, colorScheme: 'light' }, 'desktop', null, null, { n: 8, pic: 'dense', pal: PD });
      const na = await denseWalk({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' }, 'desktop-azure-dark', 'azure-dragoon', 'dark', { n: 8, pic: 'dense', pal: PA });
      const nm = await denseWalk({ viewport: { width: 1920, height: 1080 }, colorScheme: 'light' }, 'desktop-magitek-light', 'magitek-steel', 'light', { n: 8, pic: 'dense', pal: PM });
      // W36: the mid widths: six companies at 1,500 px and at 1,400 px keep one-line lanes (three columns), at 1,024 px two columns, and the axis labels never crowd
      const mid = await denseWalk({ viewport: { width: 1500, height: 900 }, colorScheme: 'light' }, 'desktop', null, null, { n: 6, pic: 'mid', pal: PD });
      const mid14 = await denseWalk({ viewport: { width: 1400, height: 900 }, colorScheme: 'light' }, 'desktop-1400', null, null, { n: 6, pic: 'mid', pal: PD });
      const mid18 = await denseWalk({ viewport: { width: 1800, height: 900 }, colorScheme: 'light' }, 'desktop-1800', null, null, { n: 6, pic: 'mid', pal: PD });
      const midA = await denseWalk({ viewport: { width: 1500, height: 900 }, colorScheme: 'dark' }, 'desktop-azure-dark', 'azure-dragoon', 'dark', { n: 6, pic: 'mid', pal: PA });
      const mid10 = await denseWalk({ viewport: { width: 1024, height: 900 }, colorScheme: 'light' }, 'desktop-1024', null, null, { n: 6, pic: 'mid', pal: PD });
      const e0 = await emptyWalk({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' }, 'desktop', null, null, PD);
      const ea = await emptyWalk({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' }, 'desktop-azure-dark', 'azure-dragoon', 'dark', PA);
      const em = await emptyWalk({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' }, 'desktop-magitek-light', 'magitek-steel', 'light', PM);
      const ep = await emptyWalk({ viewport: { width: 360, height: 800 }, colorScheme: 'dark', deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'phone', null, null);
      // Revision 4 (W31): the comparison sheet look-palette-compare.png: the meaning roles of the three evidence themes side by side, one row per role, one column per theme, so that sameness across themes can be seen at a glance.
      // Drawn from the generated list's values (which the three palette sheets above compare with the browser), on each theme's own page colour, in a page of its own.
      if (SHOT) {
        const cmpThemes = [['crystarium-dawnglass', 'light', 'Crystarium Dawnglass, light (default)'], ['azure-dragoon', 'dark', 'Azure Dragoon, dark'], ['magitek-steel', 'light', 'Magitek Steel, light']];
        const cctx = cmpThemes.map(([t, m]) => ROLE.envOf(PAL.THEMES.find((r) => r[0] === t), m));
        const val = (t, k) => ROLE.valueOf(t, cctx[k]), hexOk = (v) => /^#[0-9a-f]{6}$/i.test(v);
        const chip = (r, [t, tone], k) => { const v = val(t, k); if (!hexOk(v)) return ''; const onF = val('--on-mid', k), ink = val('--ink', k), paper = val('--paper', k);
          const inner = tone === 'field' ? '<span style="color:' + (/^--chart-bg/.test(t) ? val('--chart-ink', k) : /^--sea-\d$|^--(rank|gil|loot|route)-m$/.test(t) ? onF : r.kind === 'meaning' && /^--(back|out|idle)$/.test(t) ? val('--on-' + t.slice(2), k) : ink) + '">Aa</span>' : tone === 'text' ? '<span style="color:' + v + '">Aa</span>' : tone === 'wash' ? '<span style="color:' + ink + '">Aa</span>' : tone === 'on' ? '<span style="color:' + v + '">Aa</span>' : '';
          const bg = tone === 'text' && /^--chart-/.test(t) ? val('--chart-bg', k) : tone === 'text' ? paper : tone === 'on' ? val(t === '--on-mid' ? '--rank-m' : '--' + t.slice(5), k) : v;
          return '<div class="ch"><div class="sw" style="background:' + bg + ';border-color:' + ink + '">' + inner + '</div><div class="hx">' + t.replace(/^--/, '') + '<br>' + v + '</div></div>'; };
        const rows = ROLE.ROLES.filter((r) => r.kind === 'meaning').concat([ROLE.SHARED]);
        let h = '<style>body{margin:0;font:12px/1.3 sans-serif;background:#fff;color:#111}table{border-collapse:collapse;width:100%}th,td{vertical-align:top;padding:6px 8px;border-top:1px solid #bbb}th{text-align:left;font-weight:700}h1{font:700 20px sans-serif;margin:12px 8px 2px}p{margin:2px 8px 8px}.lab{width:150px}.ch{display:inline-block;width:68px;margin:0 4px 0 0;vertical-align:top}.sw{height:34px;border:1px solid;display:flex;align-items:center;justify-content:center;font:700 15px sans-serif}.hx{font:10px/1.2 monospace;word-break:break-all;padding-top:2px}</style>';
        h += '<h1>Meaning roles in three themes (the same role, one row; one column per theme)</h1><p>Each cell sits on that theme\'s own page colour. Under each swatch: the tone and its hex. A role should read as the same colour across a row.</p><table><tr><th class="lab">Role</th>' + cmpThemes.map((c) => '<th>' + c[2] + '</th>').join('') + '</tr>';
        rows.forEach((r) => { h += '<tr><th class="lab">' + r.name + '<br><span style="font-weight:400">' + r.stands + '</span></th>' + cmpThemes.map((c, k) => '<td style="background:' + val('--paper', k) + ';color:' + val('--ink', k) + '">' + r.tokens.map((x) => chip(r, x, k)).join('') + '</td>').join('') + '</tr>'; });
        h += '</table>';
        const { ctx: cc } = await context({ viewport: { width: 1540, height: 900 }, colorScheme: 'light' }), cp = await cc.newPage();
        await cp.setContent('<!doctype html><html><body>' + h + '</body></html>'); await cp.waitForTimeout(150);
        await cp.screenshot({ path: path.join(ev, 'look-palette-compare.png'), fullPage: true }); await cc.close();
      }
      // W23: the chart reads by meaning (R3.6) and R3.7's measurable rule: the hue-family floor on the Map and the planner (default theme 5; Azure Dragoon dark and Magitek Steel light 4); other screens stay recorded only
      const chartOk = [d, da, dm].every((w) => [w.chartMap, w.chartPlan].every((c) => c && c.dashBad.length === 0 && c.grid <= 1 && c.rings <= 1 && c.nLead >= 1 && c.lead >= 2.5 && c.nGoal >= 1 && c.goal >= 3 && c.chevBad === 0 && c.chevShown >= 1)) && [d, da, dm].every((w) => w.chartPlan.route >= 7 && w.chartPlan.routeShared.length === 0);
      const floorOk = d.fam.map.n >= 5 && d.fam.planner.n >= 5 && [da, dm].every((w) => w.fam.map.n >= 4 && w.fam.planner.n >= 4);
      // W25, W26 (R3.7): the Log's floor (default 5; Azure Dragoon dark and Magitek Steel light 4) and Earnings' (4; 3); the Log fixture exercises three seas, loot and no loot, a grade and none
      const logFloorOk = d.fam.log.n >= 5 && [da, dm].every((w) => w.fam.log.n >= 4) && d.fam.earnings.n >= 4 && [da, dm].every((w) => w.fam.earnings.n >= 3);
      const logProbeOk = [d, da, dm].every((w) => w.logProbe && w.logProbe.seas >= 3 && w.logProbe.logged >= 1 && w.logProbe.unlogged >= 1 && w.logProbe.graded >= 1 && w.logProbe.ungraded >= 1 && w.logProbe.cells >= 3);
      // W27, W28 (R3.7): the Board, Setup and recommendations hold their floors (default theme 4; Azure Dragoon dark and Magitek Steel light 3) and the send window holds 3 in all three
      const bsFloorOk = ['board', 'setup', 'recommendations'].every((k) => d.fam[k].n >= 4 && [da, dm].every((w) => w.fam[k].n >= 3)) && [d, da, dm].every((w) => w.fam.sheet.n >= 3);
      // W29: the wizard lists all seven seas (the first open) and the empty states and the wizard do not scroll sideways at 360 px; a locked slot carries its sector's sea; a company head carries its status band
      const finalOk = [d, da, dm].every((w) => w.wizard && w.wizard.seas === 7 && w.wizard.open === 1) && pl.wizard.seas === 7 && pl.wideNew.every((x) => x <= 0) && ep.wide.every((x) => x <= 0) && [e0, ea, em, ep].every((w) => !w.errors.length) && [d, da, dm].every((w) => w.lockedSea >= 1 && w.headBand >= 2);
      const denseOk = [n0, na, nm].every((w) => w.m.fcs === 8 && w.m.maxBottom <= 1080 && w.m.sideways <= 0 && !w.errors.length) && [d, da, dm].every((w) => w.timeLanes === 4);
      // W36 (the final pass). The role audit is asserted: no opaque computed colour on any pictured screen (all eight screens and the wizard, the empty states, the dense and mid Boards) outside the theme's list of tones, in the three themes.
      const audits = [...[d, da, dm].flatMap((w) => Object.values(w.audit)), ...[e0, ea, em].flatMap((w) => Object.values(w.audit)), ...[n0, na, nm, mid, mid14, mid18, midA, mid10].map((w) => w.audit)].filter(Boolean);
      const auditOk = audits.length >= 40 && audits.every((a) => a.n > 30 && a.miss === 0);
      // the axis labels are never closer than 6 px, on every Board picture (the walks, the dense and the mid Boards), "now" first and the last quarter last
      const axisAll = [...[d, dd, da, dm, p390, p, pl].flatMap((w) => Object.values(w.gaps)), ...[n0, na, nm, mid, mid14, mid18, midA, mid10].map((w) => w.m.axis)];
      const axisOk = axisAll.length >= 20 && axisAll.every((g) => g.axes >= 1 && g.minGap >= 6 && g.bad.length === 0);
      // the mid widths: one-line lanes (compact lanes are 64 px; none stacked): two columns at 1,400 px and 1,024 px, three from 1,404 px
      const midOk = [mid, mid18, midA].every((w) => w.m.fcs === 6 && w.m.columns === 3 && w.m.laneMax <= 72 && w.m.sideways <= 0 && !w.errors.length) && [mid14, mid10].every((w) => w.m.columns === 2 && w.m.laneMax <= 72 && w.m.sideways <= 0);
      // the deep-water panel: in a dark theme both ends stand clear of the page (at least 1.3:1 for the dark end, 1.7:1 for the light end), in a light theme at least 3:1; the four ring colours reach 3:1 on both ends; the scope's labels do not touch its drawing on a phone
      const deepOk = ea.deep.onPage[0] >= 1.3 && ea.deep.onPage[1] >= 1.7 && [e0, em].every((w) => w.deep.onPage.every((x) => x >= 3)) && [e0, ea, em, ep].every((w) => w.deep.rings >= 3) && [e0, ea, em, ep].every((w) => !w.deep.labels.word && !w.deep.labels.count);
      const troughOk = [d, da, dm].every((w) => w.trough && w.trough.ratio >= 3 && w.trough.w >= 2 && w.trough.style === 'solid' && w.trough.h >= 10);
      const controlsOk = [d, da, dm].every((w) => w.controls && w.controls.radios >= 4 && w.controls.boxes >= 1 && w.controls.unApp === 'none' && w.controls.cbApp === 'none' && w.controls.unW >= 2 && w.controls.size >= 20 && w.controls.edgeOnPaper >= 3 && w.controls.edgeOnSlip >= 3 && w.controls.cbEdgeOnSlip >= 3 && w.controls.checkedIsAccent && w.controls.onImg && w.controls.markOnAccent >= 3 && w.controls.focus.type === 'radio' && w.controls.focus.w >= 2 && w.controls.focus.s !== 'none');
      const rungsOk = [d, da, dm].every((w) => w.rungs.length === 4 && w.rungs.every((r) => r.img));
      const phoneW36Ok = [p390, p, pl].every((w) => w.headTools && w.headTools.n === 2 && w.headTools.sameLine) && p390.mapChain.chainH <= 260 && p390.mapChain.rows <= 4 && p390.mapChain.minH >= 44 && p390.mapChain.chartShown >= 150 && p390.mapChain.links <= 1 && p390.mapChain.side <= 0;
      const gilIdleOk = [d, da, dm].every((w) => w.unlogged && /^nothing logged/.test(w.unlogged.text) && w.unlogged.style === 'dashed' && w.unlogged.w >= 2 && (w.unlogged.heat === 'none' || w.unlogged.heat === 'normal'));
      const w36Ok = auditOk && axisOk && midOk && deepOk && troughOk && controlsOk && rungsOk && phoneW36Ok && gilIdleOk && [mid, mid14, mid18, midA, mid10].every((w) => !w.errors.length);
      const gaugeOk = [d, dd, da, dm, p390, p, pl].every((w) => !w.gauge || (w.gauge.n === 1 && w.gauge.h >= 3 && w.gauge.text === 'Voyage 3 percent done')) && d.gauge.n === 1;
      // Visual fixes part 1 (L1 part): S4 heads, S5 board lines, S7 sea strip, S8 tallies, S9 ranked cards, in the pictured walks
      const v1all = [d, da, dm, p].filter((w) => w.v1l), phones = [p, p390, pl].filter((w) => w.v1l && w.v1l.seaStrip);
      const v1Ok = v1all.every((w) => w.v1l.heads && w.v1l.heads.recsInList && w.v1l.heads.bgs.length === 1 && w.v1l.heads.colours.length === 1 && w.v1l.heads.fonts.length === 1 && Math.max(...w.v1l.heads.heights) - Math.min(...w.v1l.heads.heights) <= 30 && w.v1l.heads.stripe &&
          w.v1l.tallies.n === 4 && w.v1l.tallies.same && w.v1l.tallies.todaySolid && w.v1l.tallies.othersDeep && w.v1l.tallies.minGap >= 6 && w.v1l.tallies.minGlyphGap >= 0 && w.v1l.ranked.under && w.v1l.ranked.card && w.v1l.ranked.n > 0) &&
        [d, da, dm, p, p390, pl].every((w) => w.v1l.boardLines.length === 0) && phones.length === 3 &&
        phones.every((w) => w.v1l.seaStrip.oneRow && w.v1l.seaStrip.scrolls && w.v1l.seaStrip.minH >= 44 && w.v1l.seaStrip.inView && w.v1l.seaStrip.fade && w.v1l.seaStrip.links === 0 && w.v1l.seaStrip.head <= 56 && w.v1l.seaStrip.chartTop <= 420 && w.v1l.seaStrip.side <= 0 && w.v1l.seaKey.onChip && w.v1l.seaKey.moved && w.v1l.seaChange.inView);
      // Visual fixes part 2 (L1 part): M1 to M19, read from the walks
      const eq = (xs, tol) => xs.length > 0 && Math.max(...xs) - Math.min(...xs) <= tol, near = (a, b, t) => Math.abs(a - b) <= t;
      const walks2 = [d, dd, da, dm, p390, p, pl], desk = [d, da, dm];
      const m16 = walks2.flatMap((w) => w.v2l.together || []);
      const m1 = [e0, ea, em].every((w) => w.v2.centred.filter(Boolean).length >= 5 && w.v2.centred.filter(Boolean).every((c) => Math.abs(c.dx) <= 2 && c.below));
      const m2 = [e0, ea, em, ep].every((w) => w.v2.strip.none && w.v2.strip.text === 'Next back: none out' && w.v2.strip.h <= (w.v2.strip.width < 701 ? 56 : 44) && w.v2.strip.toolsBelow && w.v2.strip.blank <= 14 && w.v2.strip.foot === 0);
      const m3 = [d, da, dm, pl].every((w) => w.v2l.wiz && w.v2l.wiz.n > 20 && w.v2l.wiz.discs && w.v2l.wiz.rankOne && w.v2l.wiz.sameRow && w.v2l.wiz.bulk.every((b) => b.opacity === '1' && b.colour && b.band) && w.v2l.bulkHover.ratio >= 4.5 && w.v2l.bulkHover.transition === '0s') && pl.v2l.wiz.cols === 1;
      const m6b = [d, da, dm, p].every((w) => w.v2l.altLines.length > 0 && !w.v2l.altLines.some((t) => /(^|\s)back$/.test(t)));
      const m12r = [d, da, dm, p].every((w) => w.v2l.reveal.n >= 2 && w.v2l.reveal.rows.every((r) => r.one && (!w.v2l.reveal.phone || (r.stacked && r.aligned))));
      const m4 = [d, da, dm, p].every((w) => w.v2l.pickDiscs.n > 3 && w.v2l.pickDiscs.discs.every((x) => x && x.sea && x.size >= 24 && x.round && x.text));
      const m56 = [d, da, dm, p].every((w) => w.v2l.plannerLines.route.length > 0 && badEnds(w.v2l.plannerLines.route).length === 0 && aloneLetter(w.v2l.plannerLines.route).length === 0 && w.v2l.plannerLines.calc.length > 0 && badEnds(w.v2l.plannerLines.calc).length === 0 && badTagStart(w.v2l.plannerLines.calc).length === 0);
      const m7 = desk.every((w) => w.v2l.mapGrid.wide && w.v2l.mapGrid.details && near(w.v2l.mapGrid.chartTop, w.v2l.mapGrid.plannerTop, 2) && w.v2l.mapGrid.keyGap >= -1 && w.v2l.mapGrid.keyGap <= 4);
      const m8 = desk.every((w) => near(w.v2l.boardW.panel, w.v2l.boardW.inner, 2) && near(w.v2l.logW.panel, w.v2l.logW.inner, 2) && near(w.v2l.earnW.panel, w.v2l.earnW.inner, 2) && w.v2l.setup.cols === 'grid' && w.v2l.setup.c1[0] >= w.v2l.setup.c0[1] && w.v2l.setup.inRight && near(w.v2l.setup.tops[0], w.v2l.setup.tops[1], 2)) && p.v2l.setup.cols === 'block' && p.v2l.setup.c1[0] <= p.v2l.setup.c0[0] + 2;
      const m9 = [d, da, dm, p].every((w) => w.v2l.rec.minH.every((x) => x === '76px') && w.v2l.rec.bw.every((x) => x === 72) && eq(w.v2l.rec.left, 1) && w.v2l.rec.h.every((x) => x >= 76)) && desk.every((w) => eq(w.v2l.rec.h, 1));
      const m10 = [d, da, dm, p].every((w) => w.v2l.rec.thumb.bg && w.v2l.rec.thumb.edge && w.v2l.rec.thumb.opacity);
      const m11 = [d, da, dm, p].every((w) => w.v2l.setup.nbOne && w.v2l.fcMeta.length > 0 && badEnds(w.v2l.fcMeta).length === 0 && !w.v2l.fcMeta.some((t) => /^subs?$/.test(t)));
      const m12 = m12r && [d, da, dm, p].every((w) => { const x = w.v2l.sub; return x.below && x.oneLine && x.fs <= 13 && x.nowrap && x.title.length > 5 && x.fits && /rank/.test(x.text); });
      const m13 = [n0, na, nm].every((w) => eq(w.m.heads.heads.map((h) => h.h), 1) && eq(w.m.heads.heads.map((h) => h.toolsTop), 1) && w.m.heads.heads.every((h) => h.tools >= 1) && w.m.heads.locked.length >= 1 && w.m.heads.locked.every((l) => /Unlocked by surveying/.test(l.text) && l.lines <= 2 && !l.clipped && !l.ellipsis));
      const bars = [n0.m.bars, na.m.bars, nm.m.bars, d.v2l.timeBars, da.v2l.timeBars, dm.v2l.timeBars];
      const m14 = bars.every((b) => b.n >= 1 && b.bars.every((x) => x.fs >= 13 && x.fw >= 700 && Math.abs(x.off) <= 6 && /Send/.test(x.text)) && b.chipH >= 17 && b.chipFs >= 11);
      const m15 = [d, da, dm, p].every((w) => w.v2l.sendall.w >= w.v2l.sendall.room - 2 && w.v2l.sendall.h >= 44 && w.v2l.ord.length >= 1 && w.v2l.ord.every(Boolean) && w.v2l.focus.tag === 'SELECT' && w.v2l.focus.outlineStyle === 'solid' && w.v2l.focus.outlineW === '2px' && w.v2l.focus.bgImage === 'none' && w.v2l.focus.edge && w.v2l.rec.off.length >= 1 && w.v2l.rec.off.every((o) => o.colour && o.note && o.off)) &&
        [d, da, dm].every((w) => w.v2l.tier.same && w.v2l.pal && w.v2l.pal.length === 1 && w.v2l.pal[0] === 'On the water');
      const m17 = walks2.every((w) => w.v2l.plus && !w.v2l.plus.missing && w.v2l.plus.outside && w.v2l.plus.gap >= 2 && w.v2l.plus.full && w.v2l.plus.haloColour && w.v2l.plus.haloW >= 6 && w.v2l.plus.haloW > w.v2l.plus.plusW && w.v2l.plus.inkColour && w.v2l.plus.halos);
      const m18 = [p].every((w) => w.v2l.setup.lines.length >= 5 && w.v2l.setup.lines.every((n) => n === 1) && eq(w.v2l.setup.heights, 1));
      const m19 = [p, p390, pl].every((w) => w.v2l.chips && w.v2l.chips.h.length === 7 && w.v2l.chips.h.every((h) => h >= 44 && h <= 56) && w.v2l.chips.chartTop <= 400);
      const v2Ok = m6b && m1 && m2 && m3 && m4 && m56 && m7 && m8 && m9 && m10 && m11 && m12 && m13 && m14 && m15 && m16.length === 0 && m17 && m18 && m19;
      const v2Detail = { m6b, m1, m2, m3, m4, m56, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19, why: v2Ok ? undefined : { wiz: [d.v2l.wiz, pl.v2l.wiz], rec: [d.v2l.rec, p.v2l.rec], setup: [d.v2l.setup, p.v2l.setup], fcMeta: [d.v2l.fcMeta, p.v2l.fcMeta], strip: [e0.v2.strip, ep.v2.strip], together: m16 } };
      // Visual fixes part 3 (V1 to V5), read from the pictured walks
      const markOk = (m) => !!m && m.bad.length === 0;
      const v1Marks = walks2.every((w) => markOk(w.v2l.marks)) && [d, da, dm].every((w) => markOk(w.v2l.timeMarks) && w.v2l.marks.n >= 1) && [n0, na, nm, mid, mid14, mid18, midA, mid10].every((w) => markOk(w.m.marks));
      const v2Edges = [d, da, dm].every((w) => w.v2l.edges.length === 2 && w.v2l.edges.every((e) => e && e.tops.length >= 5 && e.tops.every((x) => x === e.l || x === e.page) && e.first === e.r && e.r === e.page && e.l < e.r));
      const v3Log = [d, da, dm, p].every((w) => w.v3 && w.v3.n >= 10 && w.v3.maxLines <= 2 && w.v3.dateOne && w.v3.clipped === 0) && [d, da, dm].every((w) => w.v3.twoLines >= 5 && w.v3.rowSpread <= 2);
      const v4Map = walks2.every((w) => w.v4 && w.v4.lines >= 1 && w.v4.things > 10 && w.v4.bad.length === 0);
      const v5Cards = [d, da, dm, p].every((w) => w.v5 && w.v5.ranked >= 1 && w.v5.thin >= 1 && w.v5.rows.every((r) => r.spread === 0 && r.atEdge && r.besideDiscs));
      const v3Detail = { v1Marks, v2Edges, v3Log, v4Map, v5Cards };
      const ok = v1Marks && v2Edges && v3Log && v4Map && v5Cards && v2Ok && v1Ok && w36Ok && finalOk && gaugeOk && denseOk && chartOk && floorOk && logFloorOk && bsFloorOk && logProbeOk && p.wide.length === 8 && p.wide.every((w) => w <= 0) && p.chart.width >= 320 && p.chart.hitMin >= 36 && Object.values(p.minHeights).every((h) => h === null || h >= 36) && !d.errors.length && !dd.errors.length && !da.errors.length && !dm.errors.length && [d, da, dm].every((w) => w.pal.supportsPalette === true && w.pal.bad.length === 0 && w.pal.compared >= 60) && d.pal.follow.changed >= 5 && d.pal.follow.maxDiff <= 2 && !p.errors.length && !pl.errors.length && !p390.errors.length;
      record('L1', 'Submersibles look evidence: one profile (two free companies; Back, Out and Idle subs and a locked slot; five sectors found; eleven logged voyages) walked through Board, send window, Log, Map, planner, Earnings, Setup and Recommendations: the look-*.png pictures (Chromium), no sideways scroll at 360 px on the eight screens, no page errors; at 360 px the chart is at least 320 px wide, the smallest chart tap circle and every tap height are at least 36 px; W22b: the vivid palette is computed by palette.js on the page; the palette sheet look-palette-*.png in three themes, every palette token read in the browser equals the model within 2 per channel, the palette follows a theme change without a reload, and the colour families per screen recorded; W23: on the Map and the planner in three themes only the planned route is dashed, grid and rings are 1 px at most, a lead link (2.5 px or more) and a goal link (3 px or more) are drawn, the route is 5 px or more, only lead and goal arrowheads show, and the hue-family floor holds (default theme 5, Azure Dragoon dark and Magitek Steel light 4); W25, W26: the Log (rows in at least three seas, with and without loot, with and without a grade chip) and Earnings hold their hue-family floors (Log: default theme 5, Azure Dragoon dark and Magitek Steel light 4; Earnings: 4 and 3); W27, W28: the Board, Setup and recommendations hold their floors (4; 3) and the send window 3 in the three themes; the other screens recorded only; W29: the planned route is 7 px or more and its colour is used by no other chart element, the setup wizard (all seven seas listed) and the empty states (the Board welcome panel and the Log empty panel, three themes and a phone) are pictured and do not scroll sideways at 360 px, locked slots carry their sector\'s sea and company heads their status band; W32: the Board by return time (look-board-time-*.png) and the dense Board of eight companies in three themes (look-board-dense-*.png, lowest lane bottom at most 1,080 px, no sideways scroll); W35: the send window (look-sheet-*.png at the top, look-sheet-route-*.png scrolled to the comparison on its one axis), Setup and the recommendations panel with their head states and the ladder, and the Map with the chain of seas at its top (look-map-*.png), in three themes and on a phone; W36 (the final pass): the role audit is asserted (no opaque computed colour outside the theme\'s tones on any pictured screen, 3 themes), the axis labels are never closer than 6 px with "now" and the last quarter kept, six companies keep one-line lanes at 1,024 to 1,800 px (two columns up to 1,403 px, three from 1,404 px) (look-board-mid-*.png), the deep-water panel stands clear of the page in a dark theme (1.3:1 and 1.7:1 at its two ends; rings 3:1), the send window\'s trough edge is 3:1 on its plate, radio buttons and checkboxes are drawn from the roles (look-controls-*.png: 3:1 edge, accent when checked, focus ring), the ladder rungs carry their role colour, a company head\'s buttons share a line on a phone, the phone Map\'s chain is compact with the chart on the first screen, and the scope\'s labels clear its drawing on a phone; visual fixes part 2 (M1 to M19, measured on the pictured walks): the empty scope\'s label is centred under its diamond (also at 900 px), with nothing out the next-return strip is one compact line with no blank band and the footnote has no stray bracket, the wizard\'s sector list and the send window\'s picker draw each letter as a disc in its sea\'s colour (the rank never splits, the cells of a line share a height, one column under 480 px), no route title leaves one letter alone and no line starts with a source tag, at 1,100 px and wider the chart and the planner start together with the legend directly under the chart, the Log, Earnings and Board are one width and Setup is two columns from 1,400 px with their tops aligned, the ranking rungs share one height, badge width and label edge, the slider thumb is the accent with its ink edge, no company-line unit splits, the send window\'s subtitle is one line, the dense Board\'s heads share a height and a button row and a locked slot is shown in full on two lines, the compact lanes\' send bar is centred 13 px bold and the rank chip is bigger, the Send-all button is full width, the disabled bulk button is hatched and readable, the step badge stays in the gutter, a loot picker that is off is dimmed with the word off, the sea select has one focus mark, the open tier header is the route wash, the palette sheet shows chart text on the water, no control runs two pieces of text together, the + slot mark stands outside the focus ring at full strength with a water halo, every Setup head is one line on a phone, the sea chips are 44 to 56 px tall',
        ok, { v2: v2Detail, part3: v3Detail, part3why: ok ? undefined : { marks: walks2.map((w) => w.v2l.marks), edges: d.v2l.edges, v3: [d.v3, p.v3], v4: [d.v4, dm.v4], v5: [p.v5, d.v5] }, gauge: d.gauge, sideways360: p.wide, errors: [d.errors, dd.errors, da.errors, dm.errors, p.errors, pl.errors], minHeights360: p.minHeights, chart360: p.chart, palette: [d.pal, da.pal, dm.pal], chart: { desktop: [d.chartMap, d.chartPlan], azureDark: [da.chartMap, da.chartPlan], magitekLight: [dm.chartMap, dm.chartPlan] }, logProbe: [d.logProbe, da.logProbe, dm.logProbe], families: Object.fromEntries([['desktop', d], ['desktop-dark', dd], ['desktop-azure-dark', da], ['desktop-magitek-light', dm], ['phone-390', p390], ['phone', p], ['phone-light', pl], ['empty-desktop', e0], ['empty-azure-dark', ea], ['empty-magitek-light', em], ['empty-phone', ep]].map(([k, w]) => [k, w.fam])), wizard: [d.wizard, da.wizard, dm.wizard, pl.wizard], routeColour: [d.chartPlan.routeColour, da.chartPlan.routeColour, dm.chartPlan.routeColour], routeShared: [d.chartPlan.routeShared, da.chartPlan.routeShared, dm.chartPlan.routeShared], lockedSea: [d.lockedSea, da.lockedSea, dm.lockedSea], headBand: [d.headBand, da.headBand, dm.headBand], emptyErrors: [e0.errors, ea.errors, em.errors, ep.errors], dense: [n0.m, na.m, nm.m], denseFamilies: [n0.fam, na.fam, nm.fam], w36: { auditOk, audits: audits.length, auditMiss: audits.filter((a) => a.miss || a.n <= 30).map((a) => [a.n, a.top]).slice(0, 6), axisOk, axisMin: Math.min(...axisAll.map((g) => g.minGap)), axisBad: axisAll.filter((g) => g.bad.length || g.minGap < 6).slice(0, 4), midOk, mid: [mid.m, mid14.m, mid18.m, midA.m, mid10.m], deepOk, deep: [e0.deep, ea.deep, em.deep, ep.deep], troughOk, trough: [d.trough, da.trough, dm.trough], controlsOk, controls: [d.controls, da.controls, dm.controls], rungsOk, rungs: [d.rungs, da.rungs, dm.rungs], phoneW36Ok, head: [p390.headTools, p.headTools, pl.headTools], mapChain: p390.mapChain, gilIdleOk, unlogged: [d.unlogged, da.unlogged, dm.unlogged] }, roleAudit: { desktop: d.audit, azureDark: da.audit, magitekLight: dm.audit }, v1Ok, v1l: { d: d.v1l, da: da.v1l, dm: dm.v1l, p: p.v1l, p390: p390.v1l, pl: pl.v1l } });
      server20.close();
    });

  } finally {
    await browser.close(); server.close();
  }
  const ran = results.filter((r) => r.pass !== null);
  const out = {
    date: new Date().toISOString().slice(0, 10),
    browser: BROWSER + ' ' + version, playwright: require('playwright/package.json').version, node: process.version,
    passed: ran.filter((r) => r.pass).length, total: ran.length, notRun: results.filter((r) => r.pass === null).map((r) => r.id + ': ' + r.notRun), results
  };
  fs.writeFileSync(path.join(ev, file), JSON.stringify(out, null, 2) + '\n');
  console.log(out.passed + '/' + out.total + ' passed' + (out.notRun.length ? ', ' + out.notRun.length + ' not run' : '') + '; evidence/' + file + ' written');
  process.exit(out.passed === out.total ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
