'use strict';
// Eveniunt Atelier end-to-end tests: the built single file in headless Chromium, opened from file://
// with every non-local request aborted. Run: node tools/build.js && node --test tests/atelier.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');
const A = path.join(__dirname, '..');
const URL = 'file://' + path.join(A, 'dist', 'eveniunt-atelier.html');
const FIX = require(path.join(__dirname, 'fixtures', 'raphael-cli.json'));

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 } }, opts.context || {}));
  if (opts.blockStorage) await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|blob|data):/.test(u)) return r.continue(); external.push(u); return r.abort(); });
  await page.goto(URL);
  await page.waitForFunction(() => !document.getElementById('boot') && window.__atelier, null, { timeout: 30000 });
  return { ctx, page, errors, external };
}
async function setStats(page, job, st) {
  await page.click(`[data-act=job][data-v="${job}"]`);
  for (const [k, v] of Object.entries(st)) { await page.fill(`[data-stat=${k}]`, String(v)); await page.dispatchEvent(`[data-stat=${k}]`, 'change'); }
}
async function pickRecipe(page, query, id) {
  if (await page.isChecked('#activejob')) await page.uncheck('#activejob');
  await page.fill('#q', query);
  await page.waitForSelector(`[data-act=recipe][data-v="${id}"]`);
  await page.click(`[data-act=recipe][data-v="${id}"]`);
}
const solved = page => page.waitForFunction(() => window.__atelier.S.result && !window.__atelier.S.solving, null, { timeout: 300000 });
const result = page => page.evaluate(() => { const r = window.__atelier.S.result; return r && { error: r.error, actions: r.actions, v: r.v && { quality: r.v.quality, reliable: r.v.reliable, normalOk: r.v.normalOk, mc: r.v.mc, rs: r.v.rs }, esc: r.escalation, guideEst: r.guideEst, fromHistory: r.fromHistory }; });

test('opens offline: no external requests, no errors, engine + data embedded', async () => {
  const { ctx, page, errors, external } = await open();
  const info = await page.evaluate(() => ({ scripts: [...document.scripts].filter(s => s.src).length, links: document.querySelectorAll('link[href]').length,
    experts: window.__atelier.call('expert_recipe_count'), recipes: window.__atelier.call('search_recipes', '', 'en', -1, 100000).length }));
  assert.equal(info.scripts, 0); assert.equal(info.links, 0);
  assert.equal(info.experts, 544);
  assert.ok(info.recipes > 13000, `${info.recipes} recipes`);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await ctx.close();
});

test('solver parity: the embedded Raphael returns the native raphael-cli rotation, and the guide engine agrees on the numbers', async () => {
  const { ctx, page } = await open();
  for (const c of FIX.cases) {
    const out = await page.evaluate(({ c }) => {
      const B = window.__raphael;
      const req = JSON.stringify({ recipeId: c.recipeId, stats: { craftsmanship: c.stats[0], control: c.stats[1], cp: c.stats[2], level: 100, manipulation: true } });
      const r = JSON.parse(B.solve(req, () => {}, () => {}));
      const acts = JSON.parse(B.actions('en'));
      const sim = JSON.parse(B.simulate(req, Uint32Array.from(r.actions)));
      // replay with the guide engine under Normal conditions
      const rs = sim.settings, CS = window.CS;
      const st = { maxProgress: rs.maxProgress, maxQuality: rs.maxQuality, maxDurability: rs.maxDurability, maxCp: rs.maxCp, baseProgress: rs.baseProgress,
        baseQuality: rs.baseQuality, level: rs.jobLevel, specialist: false, manipulation: true, expert: false, condFlag: 15 };
      let s = CS.initialState(st);
      const map = { MasterMend: 'MastersMend', WasteNot2: 'WasteNotII' };
      for (const i of r.actions) { const k = acts[i].key; s = CS.apply(CS.A[map[k] || k], s, st, true); s.cond = 0; }
      return { keys: r.actions.map(i => acts[i].key), last: sim.steps[sim.steps.length - 1], eng: { progress: s.progress, quality: s.quality, durability: s.durability, cp: s.cp } };
    }, { c });
    assert.deepEqual(out.keys, c.actions, `recipe ${c.recipeId} rotation`);
    assert.equal(out.last.progress, c.progress); assert.equal(out.last.quality, c.quality);
    assert.deepEqual(out.eng, { progress: out.last.progress, quality: out.last.quality, durability: out.last.durability, cp: out.last.cp }, `guide engine vs Raphael, recipe ${c.recipeId}`);
  }
  await ctx.close();
});

test('macro text matches Raphael\'s own unit test (default settings, every action)', async () => {
  const { ctx, page } = await open();
  const cards = await page.evaluate(() => {
    const B = window.__raphael; const n = JSON.parse(B.actions('en')).length;
    return JSON.parse(B.macros('{}', Uint32Array.from(Array.from({ length: n }, (_, i) => i)), 'en'));
  });
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map(c => c.duration), [40, 44, 14]);
  assert.equal(cards[0].text.split('\n')[0], '/ac "Basic Synthesis" <wait.3>');
  assert.equal(cards[2].text, '/ac "Trained Perfection" <wait.3>\n/ac "Duty Action II" <wait.2>\n/ac "Rapid Synthesis" <wait.3>\n/ac "Hasty Touch" <wait.3>\n/ac "Hasty Touch" <wait.3>');
  const withAll = await page.evaluate(() => JSON.parse(window.__raphael.macros(JSON.stringify({ notificationEnabled: true, introEnabled: true, notificationSound: 7 }), Uint32Array.from([0, 1, 2]), 'en')));
  assert.equal(withAll[0].text, '/macrolock\n/ac "Basic Synthesis" <wait.3>\n/ac "Basic Touch" <wait.3>\n/ac "Master\'s Mend" <wait.3>\n/echo Macro finished (1/1) <se.7>');
  await ctx.close();
});

test('UI: level-80 expert at endgame stats -> reliable macro verdict, cards copyable', async () => {
  const { ctx, page, errors } = await open();
  await setStats(page, 0, { craftsmanship: 5800, control: 5600, cp: 750, level: 100 });
  await pickRecipe(page, 'Grade 3 Artisanal Skybuilders\' Goldsmithing Bench', 34415);
  await page.click('[data-act=solve]');
  await solved(page);
  const r = await result(page);
  assert.equal(r.v.reliable, true, JSON.stringify(r.v));
  assert.equal(r.v.mc.hits, r.v.mc.n);
  assert.ok(await page.locator('.verdict.reliable').isVisible());
  assert.equal(await page.locator('.ribbon-flag').count(), 0);
  assert.ok(await page.locator('.card').count() >= 1);
  assert.ok(await page.locator('.col').count() === r.actions.length, 'one loom column per action');
  // every action card shows the in-game icon of the selected crafter
  const icons = await page.evaluate(() => [...document.querySelectorAll('.loom .tile')].map(t => { const i = t.querySelector('img'); return i ? i.getAttribute('src') : null; }));
  assert.equal(icons.length, r.actions.length);
  assert.ok(icons.every(Boolean), 'icon on every action card');
  assert.ok(await page.locator('.chart-svg .l-qual').count() === 1 && (await page.locator('.chart-svg').boundingBox()).height >= 180, 'full-size step chart');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('UI: hard expert at mid stats -> guide banner, macro marked not recommended, food check finishes, guide works with keys and undo', async () => {
  const { ctx, page, errors } = await open();
  await setStats(page, 0, { craftsmanship: 2900, control: 2850, cp: 560, level: 80 });
  await pickRecipe(page, 'Grade 3 Artisanal Skybuilders\' Goldsmithing Bench', 34415);
  await page.click('[data-act=solve]');
  await solved(page);
  let r = await result(page);
  assert.equal(r.v.reliable, false);
  assert.ok(await page.locator('.verdict.guide, .verdict.pending').first().isVisible());
  assert.equal(await page.locator('.ribbon-flag').count(), 2, 'graph side and macro side both flagged');
  assert.ok(await page.locator('.rot-side .ribbon-flag').isVisible(), 'macro shown but flagged');
  await page.waitForFunction(() => { const e = window.__atelier.S.result.escalation; return e && (e.done || e.found); }, null, { timeout: 300000 });
  r = await result(page);
  if (r.esc.found) {
    assert.ok(await page.locator('[data-act=apply-loadout]').isVisible());
    await page.click('[data-act=apply-loadout]');
    await solved(page);
    const after = await page.evaluate(() => window.__atelier.S.food);
    assert.ok(after && after.hq, 'loadout applied');
  }
  // guide
  await page.click('[data-act=guide] >> nth=0');
  await page.waitForFunction(() => window.__atelier.S.guide && !window.__atelier.S.guide.thinking && window.__atelier.S.guide.rec);
  const s0 = await page.evaluate(() => JSON.stringify(window.__atelier.S.guide.state));
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__atelier.S.guide.history.length === 1 && !window.__atelier.S.guide.thinking);
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__atelier.S.guide.history.length === 0 && !window.__atelier.S.guide.thinking);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__atelier.S.guide.state)), s0);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('UI: history persists across reload and loads instantly; RON config from Raphael pastes in; language switch localizes macros', async () => {
  const { ctx, page } = await open();
  await setStats(page, 7, { craftsmanship: 4900, control: 4800, cp: 620, level: 100 });
  await pickRecipe(page, 'Rarefied Tacos de Carne Asada', 35829);
  await page.click('[data-act=solve]');
  await solved(page);
  const first = await result(page);
  assert.deepEqual(first.actions.length, FIX.cases[0].steps);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('boot') && window.__atelier);
  assert.equal(await page.evaluate(() => window.__atelier.S.history.length), 1);
  await page.click('[data-act=solve]');
  await solved(page);
  const again = await result(page);
  assert.equal(again.fromHistory, true, 'identical parameters load from history');
  // Raphael RON config
  await page.click('[data-act=paste-cfg]');
  const ron = '(selected_job:3,crafter_stats:(' + Array.from({ length: 8 }, (_, i) => `(craftsmanship:${4000 + i},control:4100,cp:610,level:100,manipulation:true,heart_and_soul:true,quick_innovation:false)`).join(',') + '))';
  await page.fill('#cfgtext', ron);
  await page.click('dialog [data-d=load]');
  const st = await page.evaluate(() => ({ job: window.__atelier.S.job, s: window.__atelier.S.stats[3] }));
  assert.equal(st.job, 3); assert.equal(st.s.craftsmanship, 4003); assert.equal(st.s.heartAndSoul, true);
  // Japanese
  await page.selectOption('#locale', 'jp');
  await page.click('[data-act=job][data-v="7"]');
  await pickRecipe(page, 'タコス', 35829).catch(async () => { await page.fill('#q', ''); });
  const jp = await page.evaluate(() => JSON.parse(window.__raphael.macros('{}', Uint32Array.from([0, 1]), 'jp'))[0].text);
  assert.ok(!/Basic Synthesis/.test(jp) && /\/ac "/.test(jp), jp);
  await ctx.close();
});

test('UI: stellar missions and custom recipes; phone width has no sideways scroll; blocked storage still works', async () => {
  const { ctx, page, errors } = await open({ blockStorage: true });
  await page.click('[data-act=mode][data-v=missions]');
  await page.waitForSelector('.mission-h');
  assert.ok(await page.locator('.mission-h').count() > 0);
  await page.click('[data-act=mode][data-v=custom]');
  await page.fill('[data-custom=maxProgress]', '3000'); await page.dispatchEvent('[data-custom=maxProgress]', 'change');
  await page.fill('[data-custom=maxQuality]', '6000'); await page.dispatchEvent('[data-custom=maxQuality]', 'change');
  await page.click('[data-act=solve]');
  await solved(page);
  const r = await result(page);
  assert.ok(!r.error && r.actions.length > 0);
  assert.deepEqual(errors, []);
  await ctx.close();
  const m = await open({ context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
  assert.ok(await m.page.evaluate(() => document.documentElement.scrollWidth) <= 390);
  await m.page.click('[data-act=tab][data-pane=crafter]');
  assert.ok(await m.page.locator('#pane-crafter').isVisible());
  assert.ok(await m.page.evaluate(() => document.documentElement.scrollWidth) <= 390);
  await m.ctx.close();
});

test('UI: full crafting-log lists for all 8 jobs, complete mission lists with class badges, per-job icons, HQ-material prompt', async () => {
  const { ctx, page, errors } = await open();
  for (let job = 0; job < 8; job++) {
    await page.click(`[data-act=job][data-v="${job}"]`);
    const want = await page.evaluate(j => window.__atelier.call('search_recipes', '', 'en', j, 1e6).length, job);
    const got = await page.locator('#results .item').count();
    assert.equal(got, want, `job ${job}: every recipe listed with no search`);
    const ids = await page.evaluate(() => [...document.querySelectorAll('#results .item')].map(b => +b.dataset.v));
    assert.equal(new Set(ids).size, ids.length, 'no duplicates');
    // the first page follows the game's crafting-log page order
    const log = await page.evaluate(j => { const d = JSON.parse(document.getElementById('atelier-data').textContent); return d.log.jobs[j][0][1]; }, job);
    const have = new Set(ids);
    assert.deepEqual(ids.slice(0, 5), log.filter(i => have.has(i)).slice(0, 5));
    assert.equal(await page.locator('#results .item .rank').count(), 198, 'all 198 Cosmic recipes of the job carry a class badge');
  }
  assert.match(await page.locator('#results .log-h').first().textContent(), /Lv 1–5/);
  // Stellar missions: complete, ordered by planet then class
  await page.click('[data-act=mode][data-v=missions]');
  await page.waitForSelector('.mission-h');
  assert.equal(await page.locator('#results .item').count(), 198);
  const ranks = await page.evaluate(() => [...document.querySelectorAll('#results .mission-h')].map(h => [h.querySelector('.zone').textContent, h.querySelector('.rank').textContent]));
  const order = ['D', 'C', 'B', 'A', 'EX', 'EX+', 'Master'];
  for (let i = 1; i < ranks.length; i++) if (ranks[i][0] === ranks[i - 1][0]) assert.ok(order.indexOf(ranks[i][1]) >= order.indexOf(ranks[i - 1][1]), 'class order within a planet');
  assert.equal(new Set(ranks.map(r => r[0])).size, 4, 'all four planets');
  // icons differ per job where the game's icons differ
  assert.notEqual(await page.evaluate(() => window.__atelier.iconUrl('Basic Synthesis', 0)), await page.evaluate(() => window.__atelier.iconUrl('Basic Synthesis', 6)));
  // HQ materials: loud prompt until set, then a confirmation
  await page.click('[data-act=mode][data-v=recipes]');
  const id = await page.evaluate(() => window.__atelier.call('search_recipes', 'Rarefied Tacos de Carne Asada', 'en', -1, 5)[0].id);
  await pickRecipe(page, 'Rarefied Tacos de Carne Asada', id);
  assert.ok(await page.locator('#hq-box.call').isVisible());
  assert.ok(await page.locator('.hq-nudge').isVisible(), 'prompt beside the Solve button');
  await page.click('.hq-nudge');
  await page.click('[data-act=hq-max]');
  assert.equal(await page.locator('#hq-box.call').count(), 0);
  assert.equal(await page.locator('.hq-nudge').count(), 0);
  assert.ok(await page.evaluate(() => window.__atelier.S.hqMat.some(x => x > 0)));
  assert.ok(await page.locator('#pane-crafter .hq-ok').isVisible());
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('UI: closing the guide returns to the workbook: slim banner, macro usable on request, reopening resumes', async () => {
  const { ctx, page, errors } = await open();
  await setStats(page, 0, { craftsmanship: 2900, control: 2850, cp: 560, level: 80 });
  await pickRecipe(page, 'Grade 3 Artisanal Skybuilders\' Goldsmithing Bench', 34415);
  await page.click('[data-act=solve]');
  await solved(page);
  await page.locator('.verdict [data-act=guide]').first().click();
  await page.waitForSelector('#guide:not(.hidden) .call');
  await page.waitForFunction(() => window.__atelier.S.guide && !window.__atelier.S.guide.thinking, null, { timeout: 20000 });
  await page.locator('#guide .orb').first().click();
  await page.waitForFunction(() => window.__atelier.S.guide && window.__atelier.S.guide.history.length === 1 && !window.__atelier.S.guide.thinking, null, { timeout: 20000 });
  await page.click('[data-act=g-close]');
  assert.ok(await page.evaluate(() => document.getElementById('guide').classList.contains('hidden')), 'guide closed');
  assert.equal(await page.locator('.verdict.guide').count(), 0, 'big banner gone after closing');
  assert.equal(await page.locator('.beacon').count(), 0);
  if (await page.locator('[data-act=use-macro]').count()) {
    await page.click('[data-act=use-macro]');
    assert.equal(await page.locator('.muted-wrap.not-rec').count(), 0, 'macro no longer greyed');
  }
  await page.locator('.verdict [data-act=guide]').first().click();
  await page.waitForSelector('#guide:not(.hidden)');
  assert.equal(await page.evaluate(() => window.__atelier.S.guide.history.length), 1, 'resumed where it stopped');
  await page.keyboard.press('Escape');
  assert.ok(await page.evaluate(() => document.getElementById('guide').classList.contains('hidden')));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('UI: guide opens inside the workbook; accent and custom hex/RGB colours apply; dropdown lists follow the theme', async () => {
  const { ctx, page, errors } = await open({ context: { colorScheme: 'dark' } });
  await page.evaluate(() => { window.__atelier.S.mode = 'custom'; window.__atelier.S.custom.expert = true; });
  await page.click('[data-act=mode][data-v=custom]');
  await page.click('[data-act=guide]');
  await page.waitForSelector('#guide:not(.hidden)');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('guide')).position), 'static', 'not a separate page');
  assert.ok(await page.evaluate(() => !!document.querySelector('.bench > #guide')));
  assert.ok(await page.locator('#pane-recipe').isVisible(), 'the workbook stays visible');
  await page.click('[data-act=g-close]');
  const cssVar = n => page.evaluate(k => getComputedStyle(document.documentElement).getPropertyValue(k).trim(), n);
  await page.click('[data-act=settings]');
  assert.equal(await page.locator('.mode-tile').count(), 3, 'Mode: System, Light, Dark');
  await page.click('[data-look=toggle][data-v="shared:theme"]');
  assert.equal(await page.locator('[data-look=theme]').count(), 20, 'only the 20 FFXIV themes');
  // every theme must visibly tint the page: no background within 24 levels of pure white (light) or pure black (dark)
  const bgs = await page.evaluate(() => [...document.querySelectorAll('[data-look=theme]')].map(b => b.dataset.v));
  for (const id of bgs) {
    for (const mode of ['light', 'dark']) {
      await page.click('[data-look=mode][data-v=' + mode + ']');
      await page.click('[data-look=theme][data-v=' + id + ']');
      const hex = await cssVar('--paper'); const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const dist = mode === 'light' ? Math.max(...rgb.map(v => 255 - v)) : Math.max(...rgb);
      assert.ok(dist >= 24, id + ' ' + mode + ' background ' + hex + ' is too close to plain ' + (mode === 'light' ? 'white' : 'black'));
      await page.click('[data-look=toggle][data-v="shared:theme"]');
    }
  }
  await page.click('[data-look=mode][data-v=system]');
  await page.click('[data-look=theme][data-v=crystarium-dawnglass]');
  await page.click('[data-look=toggle][data-v="shared:theme"]');
  const names = (await page.locator('[data-look=theme]').allTextContents()).map(x => x.replace(/^Aa|✓$/g, ''));
  assert.deepEqual(names, names.slice().sort((x, y) => x.localeCompare(y, 'en', { sensitivity: 'base' })), 'alphabetical');
  assert.equal(await page.locator('[data-look=theme][data-v=chatgpt], [data-look=theme][data-v=dracula]').count(), 0, 'no ChatGPT or Codex themes');
  assert.equal(await cssVar('--paper'), '#0f2234', 'default theme: Crystarium Dawnglass (dark)');
  await page.click('[data-look=theme][data-v=abyssal-oath]');
  assert.equal(await cssVar('--paper'), '#1f0a10', 'Abyssal Oath dark');
  assert.equal(await cssVar('--lb-b'), '#ff3452', 'the wordmark follows the theme accent');
  await page.click('[data-look=toggle][data-v="shared:theme"]');
  await page.click('[data-look=theme][data-v=limsa-brineward]');
  assert.equal(await cssVar('--paper'), '#0f1b2b', 'Limsa Brineward dark background');
  await page.click('[data-look=mode][data-v=light]');
  assert.equal(await cssVar('--paper'), '#d8e0ec', 'Limsa Brineward light background');
  await page.click('[data-look=toggle][data-v="shared:accent"]');
  await page.click('[data-look=accent][data-v=custom]');
  await page.fill('[data-pick=accentHex] .hx', '#12b5a0'); await page.dispatchEvent('[data-pick=accentHex] .hx', 'input');
  assert.equal(await cssVar('--seal'), '#12b5a0');
  assert.equal(await page.inputValue('[data-pick=accentHex] [data-ch="1"]'), '181', 'RGB fields follow the hex');
  await page.fill('[data-pick=accentHex] [data-ch="0"]', '255'); await page.dispatchEvent('[data-pick=accentHex] [data-ch="0"]', 'input');
  assert.equal((await page.inputValue('[data-pick=accentHex] .hx')).toLowerCase(), '#ffb5a0', 'hex follows the RGB fields');
  await page.click('[data-look=toggle][data-v="shared:bg"]');
  await page.fill('[data-pick=bg] .hx', '#101820'); await page.dispatchEvent('[data-pick=bg] .hx', 'input');
  assert.equal(await cssVar('--paper'), '#101820', 'custom background');
  // Advanced
  await page.click('.look-adv > summary');
  await page.click('.look-adv .switch');
  assert.ok(await page.isChecked('[data-look=separate]'));
  assert.equal(await page.locator('.look-sub').count(), 2, 'separate light and dark blocks');
  await page.click('[data-look=set][data-k=motion][data-v=on]');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'on');
  await page.fill('[data-lookn=codeFont]', '15'); await page.dispatchEvent('[data-lookn=codeFont]', 'change');
  assert.equal(await cssVar('--code-size'), '15px');
  const c = await page.evaluate(() => { const o = document.querySelector('#s-layout option'); const cs = getComputedStyle(o); return [cs.color, cs.backgroundColor]; });
  assert.notEqual(c[0], c[1], 'dropdown text and background differ');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Hosted, installable app (tools/build-site.js output served over plain HTTP like GitHub Pages: no special headers).
test('App: installable (manifest + service worker), becomes cross-origin isolated on its own, solves multi-core, works offline', async () => {
  const fs = require('fs'), http = require('http');
  const SITE = path.join(A, 'site');
  if (!fs.existsSync(path.join(SITE, 'sw.js'))) { assert.fail('run tools/build-site.js first'); }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    let f = decodeURIComponent(req.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    const p = path.join(SITE, f);
    if (!p.startsWith(SITE) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(url);
    // first visit installs the service worker, which reloads the page once into cross-origin isolation
    await page.waitForFunction(() => self.crossOriginIsolated === true && window.__atelier && !document.getElementById('boot'), null, { timeout: 60000 });
    const man = await page.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
    assert.equal(man.display, 'standalone'); assert.ok(man.icons.some((i) => i.sizes === '512x512'));
    await page.waitForFunction(() => window.__atelier.threads() > 1, null, { timeout: 30000 }).catch(() => {});
    await setStats(page, 0, { craftsmanship: 5800, control: 5600, cp: 750, level: 100 });
    const want = FIX.cases.find((c) => c.recipeId === 38200);
    const job = await page.evaluate(() => window.__atelier.call('recipe', 38200, 'en').job);
    await page.click(`[data-act=job][data-v="${job}"]`);
    for (const [k, v] of Object.entries({ craftsmanship: want.stats[0], control: want.stats[1], cp: want.stats[2] })) { await page.fill(`[data-stat=${k}]`, String(v)); await page.dispatchEvent(`[data-stat=${k}]`, 'change'); }
    await page.evaluate(() => { window.__atelier.S.savedCfg.loadFromSaved = false; });
    await page.locator('[data-act=recipe][data-v="38200"]').first().click();
    const t0 = Date.now(); await page.click('[data-act=solve]'); await solved(page); const secs = (Date.now() - t0) / 1000;
    const r = await result(page);
    const threads = await page.evaluate(() => window.__atelier.threads());
    console.log(`# hosted solve of recipe 38200: ${secs.toFixed(1)} s on ${threads} threads; quality ${r.v.quality}, ${r.actions.length} steps (native CLI: ${want.quality}, ${want.steps} steps)`);
    assert.ok(threads > 1, 'multi-core solver active');
    assert.ok(!r.error && r.v.quality >= want.quality, 'same quality as the native solver');
    // offline: reload with the network cut
    await ctx.setOffline(true);
    await page.reload(); await page.waitForFunction(() => window.__atelier && !document.getElementById('boot'), null, { timeout: 30000 });
    assert.ok(await page.locator('#results .item').count() > 100, 'works offline');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); server.close(); }
});
