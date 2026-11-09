'use strict';
// Browser checks for the Command Center shell (gates 1B to 1E; blueprint section 5; gate 1A finding F1; rules 5 and 10).
// Serves the published layout with serve.js (no isolation headers, like GitHub Pages), drives a browser through
// Playwright, and writes evidence/checks*.json plus screenshots. Every request to another site is blocked.
// Run: node command-center/build.js && node command-center/check.js
//      BROWSER=firefox node command-center/check.js      (evidence/checks-firefox.json)
//      BROWSER=webkit  node command-center/check.js      (evidence/checks-webkit.json)
// A check that needs an interface one engine lacks is recorded as not run, with the reason, never as passed.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), http = require('http');
const playwright = require('playwright');
const { start, BASE, MOUNTS } = require('./serve');
const { execFileSync } = require('child_process');
const os = require('os');

const BROWSER = process.env.BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(BROWSER)) { console.error('BROWSER must be chromium, firefox or webkit'); process.exit(2); }
const engine = playwright[BROWSER];
const CC = __dirname, T = path.join(CC, '..');
const ATELIER_SRC = path.join(T, '..', 'ffxiv-cosmic-crafting-solver', 'atelier');
const FIX = require(path.join(ATELIER_SRC, 'tests', 'fixtures', 'raphael-cli.json'));
const PORT = Number(process.env.PORT) || 8418, PORT2 = PORT + 1, PORT3 = PORT + 2;
const ROOT = 'http://127.0.0.1:' + PORT + BASE, ROOT2 = 'http://127.0.0.1:' + PORT2 + BASE, ROOT3 = 'http://127.0.0.1:' + PORT3 + BASE;
const DEVICE_KEY = 'eveniunt-command-center-device';
const results = [];
let browser;

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
    if (u.startsWith('http://127.0.0.1:' + PORT + '/') || u.startsWith('http://127.0.0.1:' + PORT2 + '/') || u.startsWith('http://127.0.0.1:' + PORT3 + '/') || /^(blob|data):/.test(u)) return r.continue();
    external.push(u); return r.abort();
  });
  ctx.on('page', (p) => watch(p, errors));
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
  const file = BROWSER === 'chromium' ? 'checks.json' : 'checks-' + BROWSER + '.json';
  try { browser = await engine.launch(); } catch (err) {
    // an engine Playwright knows but that is not installed here: record the attempt plainly, never as a pass
    const reason = 'engine not installed in this session: ' + String(err.message || err).split('\n')[0];
    fs.writeFileSync(path.join(ev, file), JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: BROWSER, playwright: require('playwright/package.json').version, node: process.version,
      passed: 0, total: 0, notRun: ['all checks: ' + reason], results: [] }, null, 2) + '\n');
    console.error('NOT RUN (' + BROWSER + '): ' + reason + '; evidence/' + file + ' written');
    process.exit(3);
  }
  const server = await start(PORT);
  const version = browser.version();
  try {
    // ── C1 the shell is not isolated, and its own worker controls it ──
    {
      const { ctx, errors, external } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      const first = await shellState(page);
      await page.reload(); await shellControlled(page);
      const again = await shellState(page);
      if (SHOT) await page.screenshot({ path: path.join(ev, 'shell-desktop.png') });
      const ok = first.isolated === false && again.isolated === false && again.controller === ROOT + 'sw.js' &&
        JSON.stringify(again.modules) === '["Home","Tracker","Atelier"]' && again.cards === 2 && real(errors).length === 0;
      record('C1', 'The shell is not cross-origin isolated (Google sign-in can work here) and its site-wide worker controls it', ok, { first, again, errors: real(errors), external });
      await ctx.close();
    }

    // ── C2 / C3 / C4: one browser profile, as a person would use it ──
    {
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
      record('C4', 'Offline after one visit: the shell, the Tracker (with its save) and the Atelier (isolated, multi-thread) open', sOff.cards === 2 && tOff.overview && tOff.isolated === false && aOff.isolated === true && aOff.threads > 1,
        { shell: sOff, tracker: tOff, atelier: aOff });
      record('C2-4 errors', 'No page or console errors in that profile', real(errors).length === 0, real(errors));
      await ctx.close();
    }

    // ── C5 offline, a module never opened on this device: a clear note, not a browser error ──
    {
      const { ctx } = await context();
      const page = await ctx.newPage();
      await page.goto(ROOT); await shellControlled(page);
      await ctx.setOffline(true);
      await page.click('.modules a[data-module="atelier"]');
      await page.waitForLoadState('domcontentloaded');
      const note = await page.evaluate(() => ({ h1: document.querySelector('h1') && document.querySelector('h1').textContent, back: !!document.querySelector('a[href]') }));
      await page.click('a[href]'); await page.waitForSelector('.modules');
      const s = await shellState(page);
      record('C5', 'Offline, a module never opened shows a short note with a way back to the shell', note.h1 === 'You are offline' && note.back && s.cards === 2, { note, shellAfter: s.url });
      await ctx.close();
    }

    // ── C6 today's pages, opened directly as today (installed apps and bookmarks), with no shell involved ──
    {
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
    }

    // ── C7 apps already installed before the shell existed: the shell's worker does not take them over ──
    {
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
    }

    // ── C8 the shell is installable; C9 phone width has no sideways scrolling ──
    {
      if (BROWSER === 'chromium') {
        const { ctx } = await context();
        const page = await ctx.newPage();
        await page.goto(ROOT); await shellControlled(page);
        const cdp = await ctx.newCDPSession(page);
        const inst = await cdp.send('Page.getInstallabilityErrors');
        record('C8', 'The shell is installable as an app', inst.installabilityErrors.length === 0, inst);
        await ctx.close();
      } else {
        skip('C8', 'The shell is installable as an app', 'Chromium-only interface (Page.getInstallabilityErrors); ' + BROWSER + ' offers no installability report');
      }
      const ph = await context(PHONE);
      const pp = await ph.ctx.newPage();
      await pp.goto(ROOT); await pp.waitForSelector('.modules');
      const w = await pp.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      if (SHOT) await pp.screenshot({ path: path.join(ev, 'shell-phone.png'), fullPage: true });
      // gate 1D: the apps at phone width keep the header link (sign only) and show the notice without sideways scrolling
      await pp.goto(ROOT + 'tracker/'); await trackerSetup(pp);
      const tw = await pp.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
        back: !!document.querySelector('a[data-cc-back]'), textHidden: getComputedStyle(document.querySelector('a[data-cc-back] .cc-txt')).display === 'none', notice: !!document.querySelector('[data-handover]') }));
      if (SHOT) await pp.screenshot({ path: path.join(ev, 'tracker-phone-handover.png') });
      record('C9', 'Phone width (390 px): no sideways scrolling in the shell or in the Tracker with its header link and hand-over notice',
        w.scroll <= w.client && tw.scroll <= tw.client && tw.back && tw.textHidden && tw.notice, { shell: w, tracker: tw });
      await ph.ctx.close();
    }

    // ── C10 the test site serves both apps' current builds byte for byte, with no isolation headers from the server ──
    // (gate 1B checked that neither app changed; gates 1C and 1D change both on purpose)
    {
      const served = [];
      for (const [prefix, dir] of MOUNTS.slice(0, 2)) {
        for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) {
          const r = await get('http://127.0.0.1:' + PORT + prefix + f);
          served.push({ file: prefix + f, same: r.status === 200 && sha(r.body) === sha(fs.readFileSync(path.join(dir, f))), isolationHeaders: !!r.headers['cross-origin-embedder-policy'] });
        }
      }
      record('C10', 'The test site serves both apps\' current builds byte for byte, with no isolation headers from the server', served.every((x) => x.same && !x.isolationHeaders), { served });
    }

    // ── C11 gate 1C: one save for the shell and both modules, moved in by copying ──
    {
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
    }

    // ── C12 gate 1D, rule 5: apps installed before the shell existed keep working offline after it arrives, and hand over ──
    {
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
    }

    // ── C13 gate 1D, F1 second half: the Atelier's reload rule under a root worker that does NOT isolate atelier/ ──
    {
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
    }

    // ── C14 gate 1D: the way back to the shell from inside each app ──
    {
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
      const dHand = await handoverState(p);
      await p.click('a[data-cc-back]'); await p.waitForSelector('.modules'); const s3 = await shellState(p);
      const ok = tHand.back === ROOT && s1.url === ROOT && s1.isolated === false && s1.cards === 2 &&
        aHand.back === ROOT && s2.url === ROOT && s2.isolated === false && s2.cards === 2 &&
        dHand.back === ROOT && s3.url === ROOT && s3.isolated === false && s3.cards === 2 && real(errors).length === 0 && real(c2.errors).length === 0;
      record('C14', 'The header link brings the owner back to the shell from the Tracker and from the Atelier, also from an Atelier opened directly with the shell never visited; the shell is not isolated each time',
        ok, { fromTracker: { link: tHand.back, shell: s1 }, fromAtelier: { link: aHand.back, shell: s2 }, fromAtelierOpenedDirectly: { link: dHand.back, shell: s3 }, errors: real(errors).concat(real(c2.errors)) });
      await c2.ctx.close();
    }

    // ── C15 gate 1E: the shell has its own icons and manifest, told apart from the Tracker's and the Atelier's ──
    {
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
    }

    // ── C16 gate 1E, rule 10: the published layout. The real publish script assembles the public repository into a scratch
    //    clone, the Pages workflow's own "Assemble the site" commands build _site from it, and a browser opens that site. ──
    {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-publish-'));
      const detail = { scratch: tmp };
      let site = null, server3 = null;
      try {
        execFileSync('git', ['init', '-q', tmp]);
        const publish = execFileSync('bash', [path.join(ATELIER_SRC, '..', 'tools', 'publish-public.sh'), tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        detail.publish = publish.trim().split('\n').slice(-2);
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
        detail.workerFiles.missing.length === 0 && detail.shell && detail.shell.isolated === false && detail.shell.cards === 2 && detail.shell.controller === ROOT3 + 'sw.js' &&
        detail.links.broken.length === 0 && /Sinus Ardorum/.test(detail.cosmic.title) && detail.tracker.overview && detail.tracker.controller === ROOT3 + 'tracker/sw.js' && detail.errors.length === 0;
      record('C16', 'The published layout (gate 1E): the publish script and the Pages workflow\'s own assemble step put the shell at the root with its worker, the modules at their addresses, the four Cosmic pages and the fresh-list paths; every home-page link resolves and the Tracker opens from it', ok, detail);
    }
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
