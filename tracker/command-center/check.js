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
const { start, BASE, MOUNTS } = require('./serve');
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
        JSON.stringify(again.modules) === '["Home","Tracker","Atelier","Submersibles","⚙ Settings"]' && again.cards === 3 && real(errors).length === 0;
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
      record('C4', 'Offline after one visit: the shell, the Tracker (with its save) and the Atelier (isolated, multi-thread) open', sOff.cards === 3 && tOff.overview && tOff.isolated === false && aOff.isolated === true && aOff.threads > 1,
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
      record('C5', 'Offline, a module never opened shows a short note with a way back to the shell', note.h1 === 'You are offline' && note.back && s.cards === 3, { note, shellAfter: s.url });
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
      const ok = tHand.back === ROOT && s1.url === ROOT && s1.isolated === false && s1.cards === 3 &&
        aHand.back === ROOT && s2.url === ROOT && s2.isolated === false && s2.cards === 3 &&
        dHand.back === ROOT && s3.url === ROOT && s3.isolated === false && s3.cards === 3 && real(errors).length === 0 && real(c2.errors).length === 0;
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

    // ── C16 gate 1E, rule 10: the published layout. The repository's files (as Git would check them out) are copied to a
    //    scratch folder, the Pages workflow's own "Assemble the site" commands build _site from it, and a browser opens it. ──
    {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-publish-'));
      const detail = { scratch: tmp };
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
        detail.workerFiles.missing.length === 0 && detail.shell && detail.shell.isolated === false && detail.shell.cards === 3 && detail.shell.controller === ROOT3 + 'sw.js' &&
        detail.links.broken.length === 0 && /Sinus Ardorum/.test(detail.cosmic.title) && detail.tracker.overview && detail.tracker.controller === ROOT3 + 'tracker/sw.js' && detail.errors.length === 0;
      record('C16', 'The published layout (gate 1E): the repository\'s files and the Pages workflow\'s own assemble step put the shell at the root with its worker, the modules at their addresses, the four Cosmic pages and the fresh-list paths; every home-page link resolves and the Tracker opens from it', ok, detail);
    }

    // ── C17 to C19 gate 1E: cloud sync through OneDrive and the sync helper, against stand-ins for Microsoft's sign-in,
    //    the helper (the real helper/worker.js, in this process) and OneDrive (tests/standins.js) ──
    {
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
    }
    // ── C20 to C25 Submersibles step S2: the module page in the shell's site, its setup, board, send, alerts, calendar
    //    entries and layouts. Invented names only. The page clock (Playwright page.clock) moves time past a return. ──
    {
      const SUBS = ROOT + 'submersibles/';
      const ready = (page) => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const subsState = (page) => page.evaluate(() => ({
        url: location.href, isolated: self.crossOriginIsolated,
        controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
        back: (document.querySelector('.cc-back') || {}).href || null,
        tabs: [...document.querySelectorAll('.tabs [data-tab]')].map((b) => [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()),
        subs: [...document.querySelectorAll('.sub[data-status]')].map((x) => x.dataset.status),
        banners: [...document.querySelectorAll('.fleet-banner-text')].map((x) => x.textContent),
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
        const ok = JSON.stringify(shell.modules) === '["Home","Tracker","Atelier","Submersibles","⚙ Settings"]' && shell.cards === 3 &&
          fromShell.url === SUBS && fromShell.isolated === false && fromShell.controller === ROOT + 'sw.js' && fromShell.back === ROOT && fromShell.tabs.join() === 'Board,Log,Map,Earnings,Setup' &&
          backHome.url === ROOT && offline.isolated === false && offline.tabs.length === 5 && shellOffline.cards === 3 &&
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
          beforeBack.banners.length === 0 && sentRow === 'back' && atBack.banners.length === 1 && /is back/.test(atBack.banners[0]) && reloadRow === 'back' && afterReload.banners.length === 0 &&
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
    }
    // ── C27 the main Settings (owner request 2026-11-12): characters and their free companies, the night rule; the Tracker
    //    opens with those characters (no first-run window) and Submersibles shows the free company ──
    {
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
    }

    // ── C28 (owner reports 2026-11-12): an app icon installed from the Tracker's page opens on the main menu, and the Tracker
    //    still opens from there; the full appearance panel in the main Settings sets the theme of every page ──
    {
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
    }

    // ── C26 Submersibles step S7: phone notifications. The page works out the alerts (automatic grouping by stage), sends
    //    the schedule to the owner's helper (the real helper/worker.js, in-process with the stand-ins) and keeps the
    //    choices in the save. The browser's own push service cannot be reached from the session, so turning a device on
    //    and a real delivery are checked by tests/helper.test.js (encryption and signature) and by the owner's test button.
    {
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
    }
    // ── C29 to C40 (fault found 2026-11-13): in the main Settings, a character save must not remove free companies typed
    //    in the same visit, nor a change another page made meanwhile, nor bring back what another page changed or removed
    //    since; every order of edits. Each check compares the whole stored record (characters and every module's section).
    //    Invented names only. ──
    {
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
    }

    // ── C29 Submersibles step S5: what came back, the log and earnings. A returned sub's send window lists the route's
    //    possible loot by sector; quantities, a new sector and the new-slot line are kept with the trip and in the free
    //    company; the Log tab reopens the trip to change it; Earnings shows totals, gil per hour per route with the trip
    //    count, and the CSV export. Universalis is answered by a stand-in (the session reaches no outside site).
    {
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
    }
    // ── C76 (owner request 2026-11-15): on return the owner notes the voyage grade and types the rank and experience the game
    //    shows; the app stores the experience really gained and learns per grade; a later return with the same grade and
    //    nothing typed moves the rank on by the learned amount; Setup shows what was learned.
    {
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
    }
    // ── C77 (cross-family review of PR 1036, 2026-11-15): entries the game cannot show are refused, never read as blank or
    //    stored as exact; removing a voyage, or reading an impossible saved point, ends exactness; a grade's value below the
    //    base is shown as what is used (the base).
    {
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
    }

    // ── C78 Submersibles step S6-1: Earnings ranks the routes with ten logged voyages (equal gil per hour share a position)
    //    and lists the others as "n of 10 voyages" without a position, under a line that says what the figure is.
    {
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
        ranked: [...document.querySelectorAll('.earn-ranked tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent)),
        thin: [...document.querySelectorAll('.earn-thin tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent)),
        text: document.querySelector('#view').textContent
      }));
      const ok = got.ranked.length === 2 && got.ranked.every((r) => r[0] === '1') && got.thin.length === 1 && got.thin[0].length === 3 &&
        got.thin[0][2] === '3 of 10 voyages' && /Logged gil divided by logged hours at sea, at the prices shown above/.test(got.text) && real(errors).length === 0;
      record('C78', 'Earnings ranking (step S6-1): two routes with ten logged voyages and equal gil per hour are ranked and share position 1, a route with three voyages is listed apart as "3 of 10 voyages" without a position, a trip with nothing logged adds nothing, and a line says the figure is logged gil divided by logged hours at sea at the prices shown',
        ok, { got, errors: real(errors) });
      await ctx.close(); server9.close();
    }

    // ── C81 Submersibles step S6-0: in the send window of a returned sub, "Send on this route" keeps what was typed above it
    //    (a quantity and a "discovered" tick) in the trip and the free company, as "Send again" does.
    {
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
    }

    // ── C79 Submersibles step S6-2: at the gil step the suggestion comes from the player's own log once a route has ten
    //    logged voyages (nine do not count), on the Board and in the send window, without a reload, with no new saved field.
    {
      const server11 = await start(PORT5);
      const { ctx, errors } = await context();
      const page = await ctx.newPage();
      const requests = [];
      page.on('request', (r) => { if (/universalis/.test(r.url())) requests.push(r.url()); });
      const ready = () => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
      const saved = () => page.evaluate(async () => { const r = await CC.read(); return CC.checkDoc(r.raw).modules.submersibles; });
      const allIds = JSON.parse(fs.readFileSync(path.join(CC, '..', 'data', 'submarines.json'), 'utf8')).sectors.map((s) => s.id);
      await page.goto(ROOT5 + 'submersibles/'); await ready();
      await page.evaluate(async (all) => {
        const now = Date.now(), H = 3600000, sec = { fcs: {}, subs: {}, trips: {}, settings: {} };
        sec.fcs.fi = { name: 'India Company', world: 'Gilgamesh', unlockedSlots: 4, order: 0, discovered: all };
        sec.subs.i1 = { fcId: 'fi', slot: 1, name: 'Sub I1', rank: 145, parts: [31, 24, 25, 34], voyage: { sentAt: now - 30 * H, route: [1, 2], returnAt: now - H } };
        sec.subs.i2 = { fcId: 'fi', slot: 2, name: 'Sub I2', rank: 145, parts: [31, 24, 25, 34] };
        for (let i = 1; i <= 9; i++) sec.trips['i1-' + i] = { s: 'i1', t: now - (40 + i * 30) * H, r: [1, 2], back: now - (40 + i * 30 - 29) * H, items: [[10099, 2]], newSectors: [] };
        const r = await CC.read(); await CC.writeSection('submersibles', sec, { rev: r.rev, base: null });
      }, allIds);
      await page.reload(); await ready();
      const board = () => page.evaluate(() => { const b = document.querySelector('.sub[data-sub="i2"] [data-quick]'); return b ? { text: b.textContent, title: b.getAttribute('title') } : null; });
      const communityRoute = await page.evaluate(() => ADVISOR.routeText(ADVISOR.advise({ sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: window.__subs.section().fcs.fi.discovered }, slotsFilled: 4 }).plan.route));
      const loggedText = await page.evaluate(() => ADVISOR.routeText([1, 2]));
      const before = await board();
      const before0 = await saved();
      // the 10th voyage, logged through the page: the returned sub's send window, a quantity, "Send on this route"
      await page.click('.sub[data-sub="i1"] .sub-top');
      await page.waitForSelector('#sheet .loot');
      await page.click('#sheet .loot summary');
      await page.fill('#sheet [data-qty="10099"]', '2');
      await page.click('#sheet [data-act=quick]');
      await page.waitForFunction(() => !document.querySelector('#sheet[open]') && /From your own log/.test((document.querySelector('.sub[data-sub="i2"] [data-quick]') || {}).title || ''), null, { timeout: 10000 }).catch(() => {});
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
      const ok = !!before && before.text.includes(communityRoute) && !/From your own log/.test(before.title) && loggedText !== communityRoute &&
        !!after && after.text.includes(loggedText) && /From your own log: about [\d,]+ gil a voyage over 10 logged voyages/.test(after.title) &&
        /From your own log/.test(sheetAdvice) && sheetAdvice.includes(loggedText) && Object.keys(s1.trips).length === 10 && noNew && requests.length === 0 && real(errors).length === 0;
      record('C79', 'Advice from the log (step S6-2): at the gil step, with nine logged voyages on a route other than the community one the Board shows the community route; once the tenth is logged through the page, another sub\'s Board button and send window show the logged route and "From your own log", without a reload, with nothing fetched and no new field in the stored section',
        ok, { before, after, communityRoute, loggedText, sheetAdvice, trips: Object.keys(s1.trips).length, noNew, requests, errors: real(errors) });
      await ctx.close(); server11.close();
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
