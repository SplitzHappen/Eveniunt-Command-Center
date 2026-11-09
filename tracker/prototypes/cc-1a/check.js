'use strict';
// Gate 1A prototype: the browser checks (blueprint section 4a, rule 1). Starts serve.js, drives Chromium with
// Playwright, and writes evidence/checks.json. Exit code 0 only if every required check passed.
// Usage: node check.js [port]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { start } = require('./serve.js');

const PORT = Number(process.argv[2]) || 8417;
const BASE = 'http://localhost:' + PORT + '/';
const FILE_ATELIER = 'file://' + path.join(__dirname, 'site', 'atelier', 'index.html');
const results = [];
function record(id, required, title, pass, evidence) {
  results.push({ id, required, title, result: pass ? 'passed' : 'failed', evidence });
  console.log((pass ? 'PASS ' : 'FAIL ') + id + ' ' + title + '\n     ' + JSON.stringify(evidence));
}

// every page's console errors and uncaught errors are collected
function watch(page, sink) {
  page.on('console', (m) => { if (m.type() === 'error') sink.push('console: ' + m.text()); });
  page.on('pageerror', (e) => sink.push('pageerror: ' + e.message));
}
// The Atelier reloads itself once on a first visit that is not yet isolated (as the real one). Wait until it has
// settled, then return its pool result.
async function atelierResult(page) {
  for (let i = 0; i < 40; i++) {
    try {
      await page.waitForLoadState('load');
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => (window.__atelier ? window.__atelier.ready() : null));
      if (r) return Object.assign(r, { reloadedOnce: await page.evaluate(() => sessionStorage.getItem('cc1a-coi-reload') === '1'), controller: await page.evaluate(() => window.__atelier.controller()), errors: await page.evaluate(() => window.__atelier.errors()) });
    } catch (e) { /* the page reloaded while we asked: ask again */ }
  }
  throw new Error('the Atelier page never settled');
}
async function signInFromShell(context, page, which) {
  const popupP = context.waitForEvent('page');
  const resP = page.evaluate((w) => window.__shell.signIn(w, true), which);
  const popup = await popupP;
  await popup.waitForLoadState('load');
  const popupSaw = await popup.evaluate(() => window.__signin.hasOpener);
  const res = await resP;
  const popupOrigin = new URL(popup.url()).origin;
  await popup.close();
  return { popupOrigin, popupHasOpener: popupSaw, shellGotMessage: res.ok, token: res.token || null, reason: res.reason || null };
}

(async () => {
  const server = await start(PORT);
  const browser = await chromium.launch();
  const meta = { browser: 'Chromium ' + browser.version(), playwright: require('playwright/package.json').version, node: process.version, date: new Date().toISOString(), base: BASE };
  try {
    // ---------------------------------------------------------------- 1. sign-in from the shell
    {
      const context = await browser.newContext();
      const page = await context.newPage(); const errs = []; watch(page, errs);
      await page.goto(BASE);
      const sw = await page.evaluate(() => window.__shell.swReady());
      const isolated = await page.evaluate(() => window.__shell.isolated());
      const other = await signInFromShell(context, page, 'other');
      const same = await signInFromShell(context, page, 'same');
      record('R1-signin', true, 'The shell is not isolated; its sign-in popup (Google-style, other origin, and same origin) keeps window.opener and returns a message',
        !isolated && other.popupHasOpener && other.shellGotMessage && other.popupOrigin !== new URL(BASE).origin && same.popupHasOpener && same.shellGotMessage && errs.length === 0,
        { shellCrossOriginIsolated: isolated, serviceWorker: sw, otherOrigin: other, sameOrigin: same, errors: errs });
      // installability of the shell (Chromium's own check)
      const cdp = await context.newCDPSession(page);
      const inst = await cdp.send('Page.getInstallabilityErrors');
      record('X4-installable', false, 'The shell passes Chromium\'s installability check (manifest, icons, service worker)', inst.installabilityErrors.length === 0, { installabilityErrors: inst.installabilityErrors });
      await context.close();
    }

    // ---------------------------------------------------------------- 2. the Atelier: isolated, 4 threads (three ways in)
    const routes = {};
    { // A: straight to the Atelier, nothing installed (today's installed Atelier): its own worker, one reload
      const context = await browser.newContext();
      const page = await context.newPage(); const errs = []; watch(page, errs);
      await page.goto(BASE + 'atelier/');
      routes.directColdVisit = Object.assign(await atelierResult(page), { pageErrors: errs });
      await context.close();
    }
    { // B: shell first (root worker installed), then the link: the root worker isolates atelier/ itself
      const context = await browser.newContext();
      const page = await context.newPage(); const errs = []; watch(page, errs);
      await page.goto(BASE); await page.evaluate(() => window.__shell.swReady());
      await page.click('#to-atelier');
      routes.fromShellOneWorker = Object.assign(await atelierResult(page), { pageErrors: errs });
      await context.close();
    }
    { // C: shell first with a naive root worker that does not isolate atelier/: the Atelier's own worker must take
      // over (prototype start-up rule, which reloads only once its own worker controls the page)
      const context = await browser.newContext();
      const page = await context.newPage(); const errs = []; watch(page, errs);
      await page.goto(BASE + '?sw=naive'); await page.evaluate(() => window.__shell.swReady());
      await page.click('#to-atelier');
      routes.fromShellNaiveRootWorkerFixedStartup = Object.assign(await atelierResult(page), { pageErrors: errs });
      await context.close();
    }
    const okRoute = (r) => r.isolated === true && r.mode === 'multi' && r.threads === 4 && r.arrived === 4 && r.counter === r.expected && r.errors.length === 0 && r.pageErrors.length === 0;
    record('R2-atelier-4-threads', true, 'The Atelier page reports crossOriginIsolated === true and runs 4 threads on shared WebAssembly memory (exact atomic total), by every way in',
      Object.values(routes).every(okRoute), routes);
    { // X5: the same naive root worker with TODAY's Atelier start-up rule (reload at once if any worker controls the page)
      const context = await browser.newContext();
      const page = await context.newPage(); const errs = []; watch(page, errs);
      await page.goto(BASE + '?sw=naive'); await page.evaluate(() => window.__shell.swReady());
      await page.goto(BASE + 'atelier/?reload=legacy');
      const first = await atelierResult(page);
      // a later visit in a new tab session (the one-reload mark is per tab session)
      const page2 = await context.newPage();
      await page2.goto(BASE + 'atelier/?reload=legacy');
      const second = await atelierResult(page2);
      const brief = (r) => ({ isolated: r.isolated, threads: r.threads, reloadedOnce: r.reloadedOnce, controller: r.controller, reason: r.reason || null });
      record('X5-today-startup-under-root-worker', false, 'Today\'s Atelier start-up rule, unchanged, reaches 4 threads on the first visit under a root worker that does not isolate atelier/',
        first.isolated === true && first.threads === 4, { firstVisit: brief(first), nextVisit: brief(second), pageErrors: errs });
      await context.close();
    }

    // ---------------------------------------------------------------- 3. shell -> Atelier -> shell keeps the shared save
    {
      const context = await browser.newContext();
      const page = await context.newPage(); const errs = []; watch(page, errs);
      await page.goto(BASE); await page.evaluate(() => window.__shell.swReady());
      const marker = 'm-' + Math.random().toString(36).slice(2);
      await page.evaluate((m) => window.__shell.write({ marker: m, chars: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], updated: Date.now() }), marker);
      await page.click('#to-atelier');
      const at = await atelierResult(page);
      const seenInAtelier = await page.evaluate(() => window.__atelier.read());
      await page.evaluate((m) => window.__atelier.write({ marker: m, chars: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], atelier: { job: 3, stats: { craftsmanship: 5200 } }, updated: Date.now() }), marker);
      await page.click('#to-shell');
      await page.waitForLoadState('load');
      const backInShell = await page.evaluate(() => window.__shell.read());
      const shellIsolatedAfter = await page.evaluate(() => window.__shell.isolated());
      const signInAfter = await signInFromShell(context, page, 'other');
      // and once more with the browser's Back button (history), not a link
      await page.click('#to-atelier'); await atelierResult(page);
      await page.evaluate(() => window.__atelier.write(Object.assign({}, { marker: 'after-back', updated: Date.now() })));
      await page.goBack(); await page.waitForLoadState('load');
      const afterBack = await page.evaluate(() => window.__shell.read());
      const pass = at.isolated && at.threads === 4 &&
        seenInAtelier.idb && seenInAtelier.idb.marker === marker && seenInAtelier.ls && seenInAtelier.ls.marker === marker &&
        backInShell.idb && backInShell.idb.atelier && backInShell.idb.atelier.stats.craftsmanship === 5200 && backInShell.ls && backInShell.ls.atelier &&
        !shellIsolatedAfter && signInAfter.shellGotMessage && afterBack.idb.marker === 'after-back' && errs.length === 0;
      record('R3-round-trip', true, 'Shell -> Atelier -> shell (by link and by Back) keeps the shared save in IndexedDB and localStorage; the shell is still not isolated and sign-in still works after the trip',
        pass, { marker, atelierIsolated: at.isolated, atelierThreads: at.threads, seenInAtelier, backInShell, shellIsolatedAfter, signInAfter, afterBackMarker: afterBack.idb && afterBack.idb.marker, errors: errs });

      // ------------------------------------------------------------ extra: offline, after both pages were visited
      await context.setOffline(true);
      await page.goto(BASE).catch(() => {});
      const offShell = await page.evaluate(() => ({ isolated: window.__shell.isolated(), title: document.title })).catch((e) => ({ error: e.message }));
      await page.click('#to-atelier').catch(() => {});
      const offAt = await atelierResult(page).catch((e) => ({ error: e.message }));
      await context.setOffline(false);
      record('X3-offline', false, 'Offline, after one visit: the shell opens, and the Atelier still opens isolated with 4 threads',
        offShell.title && offShell.isolated === false && offAt.isolated === true && offAt.threads === 4, { shell: offShell, atelier: { isolated: offAt.isolated, threads: offAt.threads, controller: offAt.controller, error: offAt.error || null } });
      await context.close();
    }

    // ---------------------------------------------------------------- extra: sign-in from the isolated page (negative control)
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(BASE + 'atelier/'); const at = await atelierResult(page);
      const popupP = context.waitForEvent('page');
      const resP = page.evaluate(() => window.__atelier.signInFromHere(true));
      const popup = await popupP; await popup.waitForLoadState('load');
      const popupHasOpener = await popup.evaluate(() => window.__signin.hasOpener);
      const res = await resP;
      record('X1-negative-control', false, 'Control: the same popup opened from the isolated Atelier page loses window.opener and no message returns (so sign-in must stay in the shell)',
        at.isolated === true && popupHasOpener === false && res.ok === false, { atelierIsolated: at.isolated, popupHasOpener, atelierGotMessage: res.ok, reason: res.reason, openerSawPopupClosed: res.handleClosed });
      await context.close();
    }

    // ---------------------------------------------------------------- extra: live messages across the isolation boundary
    {
      const context = await browser.newContext();
      const shell = await context.newPage(); await shell.goto(BASE); await shell.evaluate(() => window.__shell.swReady());
      const at = await context.newPage(); await at.goto(BASE + 'atelier/'); await atelierResult(at);
      await at.evaluate(() => window.__atelier.write({ marker: 'from-atelier', updated: 1 }));
      await shell.waitForTimeout(300);
      await shell.evaluate(() => window.__shell.write({ marker: 'from-shell', updated: 2 }));
      await at.waitForTimeout(300);
      const shellHeard = await shell.evaluate(() => CC.heard);
      const atHeard = await at.evaluate(() => CC.heard);
      record('X2-broadcast', false, 'With the shell and the Atelier open in two tabs, each hears the other\'s saves (BroadcastChannel, which the tracker uses to stop two windows overwriting each other)',
        shellHeard.some((m) => m.from === 'atelier') && atHeard.some((m) => m.from === 'shell'), { shellHeard, atelierHeard: atHeard });
      await context.close();
    }

    // ---------------------------------------------------------------- 4. opened as a file: one thread, no errors
    {
      const context = await browser.newContext();
      const page = await context.newPage(); const errs = []; watch(page, errs);
      await page.goto(FILE_ATELIER);
      const r = await atelierResult(page);
      record('R4-file-fallback', true, 'Opened as a file, the Atelier page falls back to 1 thread without errors',
        r.isolated === false && r.mode === 'single' && r.threads === 1 && r.counter === r.expected && r.errors.length === 0 && errs.length === 0, Object.assign(r, { url: FILE_ATELIER.replace(__dirname, '<cc-1a>'), pageErrors: errs }));
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const out = { meta, results };
  fs.mkdirSync(path.join(__dirname, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'evidence', 'checks.json'), JSON.stringify(out, null, 2) + '\n');
  const failed = results.filter((r) => r.required && r.result !== 'passed');
  console.log('\n' + results.filter((r) => r.result === 'passed').length + ' of ' + results.length + ' checks passed; required failures: ' + failed.length);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
