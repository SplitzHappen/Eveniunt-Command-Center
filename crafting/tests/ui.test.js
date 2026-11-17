'use strict';
// End-to-end tests of the built HTML files in headless Chromium, opened from
// file:// with every non-local request aborted (offline proof).
// Run: node tools/build.js && node --test tests/ui.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const CS = require(path.join(ROOT, 'src', 'engine', 'sim.js'));
require(path.join(ROOT, 'src', 'engine', 'solver.js'));
const DB = require(path.join(ROOT, 'data', 'cosmic-db.json'));
const PLANETS = ['sinus-ardorum', 'phaenna', 'oizys', 'auxesia'];
const fileUrl = p => 'file://' + path.join(ROOT, 'dist', `cosmic-${p}.html`);

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(planet, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts.context || {}));
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (/^(file|blob|data):/.test(u)) return r.continue();
    external.push(u); return r.abort();
  });
  if (opts.blockStorage) {
    await ctx.addInitScript(() => {
      const thrower = { get() { throw new Error('blocked'); } };
      Object.defineProperty(window, 'localStorage', thrower);
    });
  }
  if (opts.fastThink !== false) {
    await ctx.addInitScript(() => {
      try {
        if (!localStorage.getItem('cosmic-solver-v1')) {
          localStorage.setItem('cosmic-solver-v1', JSON.stringify({ shared: { settings: { condModel: 'teamcraft', thinkMs: 200, showEstimate: true, mmSecPerStep: 3, theme: 'auto' } } }));
        }
      } catch (e) { /* storage blocked */ }
    });
  }
  await page.goto(fileUrl(planet));
  await page.waitForSelector('#setup .chip');
  return { ctx, page, errors, external };
}
const idle = page => page.waitForFunction(() => window.__cosmicSolver && !window.__cosmicSolver.app.thinking, null, { timeout: 20000 });
async function pageState(page) { return page.evaluate(() => JSON.parse(JSON.stringify(window.__cosmicSolver.app.craft))); }

async function chooseMission(page, missionId, job) {
  await page.click(`[data-act=job][data-v="${job}"]`);
  await page.click('[data-act=rank][data-v="all"]');
  await page.click(`[data-act=mission][data-v="${missionId}"]`);
}

test('every planet file opens offline with no errors and its own data', async () => {
  for (const planet of PLANETS) {
    const { ctx, page, errors, external } = await open(planet);
    const info = await page.evaluate(() => {
      const db = JSON.parse(document.getElementById('db').textContent);
      return { planet: db.planet.key, missions: db.missions.length, recipes: Object.keys(db.recipes).length,
        scripts: [...document.scripts].filter(s => s.src).length, links: document.querySelectorAll('link[href]').length };
    });
    const expected = DB.missions.filter(m => m.planet === planet);
    assert.equal(info.planet, planet);
    assert.equal(info.missions, expected.length, `${planet} mission count`);
    assert.equal(info.scripts, 0, 'no external scripts');
    assert.equal(info.links, 0, 'no external stylesheets');
    assert.deepEqual(errors, [], `${planet} console errors`);
    assert.deepEqual(external, [], `${planet} external requests`);
    await ctx.close();
  }
});

test('all eight classes are selectable and mission filters match the dataset', async () => {
  const { ctx, page, errors } = await open('auxesia');
  for (let job = 0; job < 8; job++) {
    await page.click(`[data-act=job][data-v="${job}"]`);
    await page.click('[data-act=rank][data-v="all"]');
    const n = await page.locator('[data-act=mission]').count();
    const exp = DB.missions.filter(m => m.planet === 'auxesia' && m.job === job);
    assert.equal(n, exp.length, `class ${job} mission count`);
    for (const rank of ['D', 'C', 'B', 'A', 'EX', 'EX+', 'Master']) {
      const er = exp.filter(m => m.rank === rank).length;
      if (!er) continue;
      await page.click(`[data-act=rank][data-v="${rank}"]`);
      assert.equal(await page.locator('[data-act=mission]').count(), er, `class ${job} rank ${rank}`);
    }
    await page.click('[data-act=rank][data-v="all"]');
    await page.click('[data-act=expertOnly]');
    const ex = exp.filter(m => m.recipes.some(id => DB.recipes[String(id)].expert)).length;
    assert.equal(await page.locator('[data-act=mission]').count(), ex, `class ${job} expert filter`);
    await page.click('[data-act=expertOnly]');
  }
  await page.click('[data-act=job][data-v="0"]');
  await page.fill('[data-act=search]', 'Biofuel');
  const hits = await page.locator('[data-act=mission]').count();
  assert.ok(hits >= 1, 'search finds missions by item name');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every recipe in every file builds valid craft settings (level 100 and minimum level)', async () => {
  for (const planet of PLANETS) {
    const { ctx, page } = await open(planet);
    const bad = await page.evaluate(() => {
      const db = JSON.parse(document.getElementById('db').textContent);
      const out = [];
      for (const m of db.missions) for (const id of m.recipes) {
        const r = db.recipes[String(id)];
        for (const level of [100, m.minLevel]) {
          if (!r.maxLevelScaling && level < r.level) continue;
          try {
            const st = CS.makeSettings(r, { craftsmanship: 3000, control: 3000, cp: 500, level, specialist: true }, db, {});
            if (!(st.maxProgress > 0 && st.maxQuality > 0 && st.maxDurability > 0 && st.baseProgress > 0 && st.baseQuality > 0)) out.push(id + '@' + level);
            const s = CS.initialState(st);
            if (!CS.legalActions(s, st).length) out.push(id + '@' + level + ':noactions');
          } catch (e) { out.push(id + '@' + level + ':' + e.message); }
        }
      }
      return out;
    });
    assert.deepEqual(bad, [], `${planet} recipes`);
    await ctx.close();
  }
});

// Drive a whole craft through the UI with random conditions; check the page
// state against an independent replay of the same reports in Node.
async function driveCraft(page, rnd, maxSteps = 80) {
  const reports = [];
  for (let i = 0; i < maxSteps; i++) {
    await idle(page);
    const c = await pageState(page);
    if (c.state.done) break;
    const recId = await page.evaluate(() => { const a = window.__cosmicSolver.app.craft.pending; return a ? a.id : null; });
    assert.notEqual(recId, null, 'a recommendation exists');
    const a = CS.ACTIONS[recId];
    const why = CS.whyNot(a, Object.assign({}, c.state, { mm: c.mmEndsAt ? 1 : 0 }), c.st);
    assert.equal(why, null, `recommended ${a.name} must be usable`);
    const buttons = await page.$$('#craft [data-act=cond]');
    assert.ok(buttons.length > 0, 'condition buttons shown');
    // pick a random visible button (success or failure row)
    const meta = await Promise.all(buttons.map(b => b.evaluate(el => ({ v: +el.dataset.v, ok: el.dataset.ok === '1' }))));
    const pick = meta[Math.floor(rnd() * meta.length)];
    await buttons[meta.indexOf(pick)].click();
    reports.push({ action: recId, cond: pick.v, ok: pick.ok });
  }
  return reports;
}

test('full crafts through the UI stay synchronized with the engine (Auxesia expert and normal recipes)', async () => {
  const { ctx, page, errors } = await open('auxesia');
  const picks = [
    DB.missions.find(m => m.planet === 'auxesia' && m.rank === 'Master' && m.objectives[0].specialAction === 'StellarSteadyHand'),
    DB.missions.find(m => m.planet === 'auxesia' && m.rank === 'EX'),
    DB.missions.find(m => m.planet === 'auxesia' && m.rank === 'D')
  ];
  let seed = 11;
  for (const m of picks) {
    await chooseMission(page, m.id, m.job);
    await page.click('[data-act=start]');
    const reports = await driveCraft(page, CS.mulberry32(seed++));
    const c = await pageState(page);
    assert.ok(c.state.done, `${m.name} finished`);
    // independent replay
    let s = CS.initialState(c.st);
    s.sshCharges = c.startSsh; s.mmCharges = c.startMm;
    for (const r of reports) {
      const a = CS.ACTIONS[r.action];
      const n = CS.apply(a, s, c.st, CS.successRate(a, s) >= 100 ? true : r.ok);
      if (!n.done) n.cond = (a.step || a === CS.A.CarefulObservation) ? r.cond : s.cond;
      delete n.lastPg; delete n.lastQg; delete n.lastOk;
      n.mm = 0; s = n;
    }
    const strip = x => { const y = Object.assign({}, x); delete y.mm; return y; };
    assert.deepEqual(strip(c.state), strip(s), `${m.name}: page state equals engine replay`);
    assert.equal(c.history.length, reports.length);
    await page.click('[data-act=showSetup]');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('failure reporting, undo, restart and manual correction', async () => {
  const { ctx, page, errors } = await open('auxesia');
  const m = DB.missions.find(x => x.planet === 'auxesia' && x.rank === 'EX+' && x.job === 1);
  await chooseMission(page, m.id, m.job);
  await page.click('[data-act=start]');
  await idle(page);
  // report the opener normally
  await page.keyboard.press('n');
  await idle(page);
  const before = await pageState(page);
  // choose Hasty Touch via "different action" and report a failure
  await page.click('[data-act=other]');
  await page.click(`dialog [data-dlg="${CS.A.HastyTouch.id}"]`);
  await page.keyboard.press('Shift+N');
  await idle(page);
  const after = await pageState(page);
  assert.equal(after.state.quality, before.state.quality, 'failed Hasty Touch adds no quality');
  assert.equal(after.state.durability, before.state.durability - CS.durCost(CS.A.HastyTouch, before.state), 'durability still spent');
  assert.equal(after.state.cond, CS.COND.Normal);
  assert.equal(after.history[after.history.length - 1].ok, false);
  // undo restores exactly
  await page.keyboard.press('u');
  await idle(page);
  assert.deepEqual((await pageState(page)).state, before.state);
  // manual correction (with clamping) and undo of the correction
  await page.click('[data-act=edit]');
  await page.fill('dialog input[data-k=quality]', '1234');
  await page.fill('dialog input[data-k=durability]', '9999');
  await page.selectOption('dialog select[data-k=cond]', String(CS.COND.Pliant));
  await page.click('dialog [data-dlg=apply]');
  await idle(page);
  const edited = await pageState(page);
  assert.equal(edited.state.quality, 1234);
  assert.equal(edited.state.durability, edited.st.maxDurability, 'durability clamped to the recipe maximum');
  assert.equal(edited.state.cond, CS.COND.Pliant);
  const rec = await page.evaluate(() => window.__cosmicSolver.app.craft.pending.id);
  assert.equal(CS.whyNot(CS.ACTIONS[rec], edited.state, edited.st), null, 'recommendation valid after correction');
  await page.click('#craft [data-act=undo]');
  await idle(page);
  assert.deepEqual((await pageState(page)).state, before.state, 'correction undone');
  // restart
  await page.click('#craft [data-act=restart]');
  await idle(page);
  const r = await pageState(page);
  assert.equal(r.history.length, 0);
  assert.equal(r.state.step, 0);
  assert.equal(r.state.durability, r.st.maxDurability);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('special actions: Stellar Steady Hand charges and Material Miracle timer', async () => {
  const { ctx, page, errors } = await open('auxesia');
  const ssh = DB.missions.find(x => x.planet === 'auxesia' && x.rank === 'Master' && x.objectives[0].specialAction === 'StellarSteadyHand');
  await chooseMission(page, ssh.id, ssh.job);
  await page.click('[data-act=start]');
  await idle(page);
  const c0 = await pageState(page);
  assert.equal(c0.state.sshCharges, ssh.objectives[0].specialActionCharges);
  await page.click('[data-act=other]');
  await page.click(`dialog [data-dlg="${CS.A.StellarSteadyHand.id}"]`);
  await page.keyboard.press('n');
  await idle(page);
  const c1 = await pageState(page);
  assert.equal(c1.state.sshCharges, c0.state.sshCharges - 1);
  assert.equal(c1.state.ssh, 3);
  assert.match(await page.textContent('#craft .buffs'), /Stellar Steady Hand 3/);
  // Rapid Synthesis now cannot fail: no failure row is offered
  await page.click('[data-act=other]');
  await page.click(`dialog [data-dlg="${CS.A.RapidSynthesis.id}"]`);
  assert.equal(await page.locator('#craft [data-ok="0"]').count(), 0, 'no failure option under Steady Hand');
  await page.click('[data-act=backToRec]');
  // Material Miracle mission
  await page.click('[data-act=showSetup]');
  const mm = DB.missions.find(x => x.planet === 'auxesia' && x.rank === 'Master' && x.objectives[0].specialAction === 'MaterialMiracle');
  await chooseMission(page, mm.id, mm.job);
  await page.click('[data-act=start]');
  await idle(page);
  await page.click('[data-act=other]');
  await page.click(`dialog [data-dlg="${CS.A.MaterialMiracle.id}"]`);
  await page.keyboard.press('g');
  await idle(page);
  const c2 = await pageState(page);
  assert.equal(c2.state.mmCharges, mm.objectives[0].specialActionCharges - 1);
  assert.ok(c2.mmEndsAt > 0);
  assert.match(await page.textContent('#craft .buffs'), /Material Miracle ~\d+ s/);
  // MM cannot be stacked while active
  await page.click('[data-act=other]');
  assert.ok(await page.locator(`dialog [data-dlg="${CS.A.MaterialMiracle.id}"]`).isDisabled());
  await page.click('dialog [data-dlg=close]');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('finished craft -> next craft carries mission charges; reload restores the craft', async () => {
  const { ctx, page, errors } = await open('oizys');
  const m = DB.missions.find(x => x.planet === 'oizys' && x.objectives[0].specialAction === 'StellarSteadyHand' && x.objectives[0].specialActionCharges >= 2 && x.objectives[0].kind === 'craft');
  await chooseMission(page, m.id, m.job);
  await page.click('[data-act=start]');
  await idle(page);
  // use one Steady Hand, then drive to the end
  await page.click('[data-act=other]');
  await page.click(`dialog [data-dlg="${CS.A.StellarSteadyHand.id}"]`);
  await page.keyboard.press('n');
  const reps = await driveCraft(page, CS.mulberry32(5), 150);
  const done = await pageState(page);
  assert.ok(done.state.done, `craft finished after ${reps.length} reports: ${JSON.stringify(done.state)}`);
  const left = done.state.sshCharges;
  await page.click('[data-act=nextCraft]');
  await idle(page);
  const next = await pageState(page);
  assert.equal(next.state.step, 0);
  assert.equal(next.state.sshCharges, left, `remaining charges carry to the next craft (session ${JSON.stringify(await page.evaluate(() => window.__cosmicSolver.app.session))})`);
  assert.equal(await page.evaluate(() => window.__cosmicSolver.app.session.craftsDone), 1);
  // progress one step, reload, and expect the same craft back
  await page.keyboard.press('n');
  await idle(page);
  const mid = await pageState(page);
  await page.reload();
  await page.waitForSelector('#craft:not(.hidden)');
  await idle(page);
  const restored = await pageState(page);
  assert.deepEqual(restored.state, mid.state, 'reload restores the same state');
  assert.equal(restored.history.length, mid.history.length, 'reload restores the history');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('works when browser storage is blocked (in-memory fallback)', async () => {
  const { ctx, page, errors } = await open('phaenna', { blockStorage: true, fastThink: false });
  const m = DB.missions.find(x => x.planet === 'phaenna' && x.rank === 'EX');
  await chooseMission(page, m.id, m.job);
  await page.click('[data-act=start]');
  await idle(page);
  assert.ok(await page.evaluate(() => !!window.__cosmicSolver.app.craft.pending));
  await page.keyboard.press('n');
  await idle(page);
  assert.equal((await pageState(page)).history.length, 1);
  await page.click('#btnSettings');
  assert.match(await page.textContent('dialog'), /storage is unavailable/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('phone layout: no horizontal scrolling, recommendation and condition buttons visible', async () => {
  const { ctx, page, errors } = await open('sinus-ardorum', { context: { viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true } });
  const m = DB.missions.find(x => x.planet === 'sinus-ardorum' && x.rank === 'EX+');
  await chooseMission(page, m.id, m.job);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollW <= 375, `no horizontal scroll in setup (${scrollW})`);
  await page.click('[data-act=start]');
  await idle(page);
  const w2 = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(w2 <= 375, `no horizontal scroll while crafting (${w2})`);
  assert.ok(await page.locator('#recAction').isVisible());
  await page.locator('#craft [data-act=cond]').first().tap();
  await idle(page);
  assert.equal((await pageState(page)).history.length, 1);
  fs.mkdirSync(path.join(ROOT, 'tests', 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, 'tests', 'screenshots', 'phone-crafting.png') });
  assert.deepEqual(errors, []);
  await ctx.close();
});
