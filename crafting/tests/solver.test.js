'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CS = require(path.join(ROOT, 'src', 'engine', 'sim.js'));
require(path.join(ROOT, 'src', 'engine', 'solver.js'));
const DB = require(path.join(ROOT, 'data', 'cosmic-db.json'));
const A = CS.A, COND = CS.COND;
const STATS = { craftsmanship: 5400, control: 5200, cp: 700, level: 100, specialist: true, cosmicTool: true };

function expertScenarios() {
  const seen = new Set(); const out = [];
  for (const m of DB.missions) for (const id of m.recipes) {
    const r = DB.recipes[String(id)];
    if (!r.expert || seen.has(r.profile)) continue;
    seen.add(r.profile);
    const o = m.objectives[0];
    out.push({ m, r, ssh: o.specialAction === 'StellarSteadyHand' ? o.specialActionCharges : 0, mm: o.specialAction === 'MaterialMiracle' ? o.specialActionCharges : 0 });
  }
  return out;
}

test('fuzz: the solver never recommends an unusable action (all 50 expert profiles, random outcomes)', () => {
  const scs = expertScenarios();
  assert.equal(scs.length, 50);
  let checked = 0;
  scs.forEach((sc, idx) => {
    const st = CS.makeSettings(sc.r, STATS, DB, { sshCharges: sc.ssh, mmCharges: sc.mm });
    const target = sc.r.tiers ? sc.r.tiers[2] : sc.r.quality;
    const rnd = CS.mulberry32(100 + idx);
    let s = CS.initialState(st);
    let guard = 0;
    while (!s.done && guard++ < 90) {
      const rec = CS.recommend(s, st, { target, lowerTiers: sc.r.tiers || [], timeMs: Infinity, maxRollouts: 120, minRollouts: 4, seed: guard });
      assert.ok(rec.action, `profile ${sc.r.profile}: an action is recommended`);
      assert.equal(CS.whyNot(rec.action, s, st), null, `profile ${sc.r.profile} step ${guard}: ${rec.action.name}`);
      // follow a random usable action 30% of the time to visit odd states
      let a = rec.action;
      if (rnd() < 0.3) { const legal = CS.legalActions(s, st); a = legal[Math.floor(rnd() * legal.length)]; }
      s = CS.stepSample(s, a, st, rnd);
      checked++;
    }
  });
  assert.ok(checked > 1000, `checked ${checked} states`);
});

test('quality target met: recommends completing progress now', () => {
  const r = DB.recipes['38200'];
  const st = CS.makeSettings(r, STATS, DB, {});
  const s = CS.initialState(st);
  s.progress = st.maxProgress - 50; s.quality = r.tiers[2] + 100; s.step = 20; s.cp = 200; s.durability = 30;
  const rec = CS.recommend(s, st, { target: r.tiers[2], timeMs: Infinity, maxRollouts: 400 });
  assert.ok(rec.action.prog, 'a progress action');
  assert.ok(CS.progressGain(rec.action, s, st) >= 50);
  assert.match(rec.reason, /Complete progress now/);
  assert.equal(rec.estimate.pTarget, 1);
});

test('exhausted special actions are never recommended', () => {
  const r = DB.recipes['38199'];
  const st = CS.makeSettings(r, STATS, DB, { sshCharges: 0, mmCharges: 0 });
  let s = CS.initialState(st);
  const rnd = CS.mulberry32(9);
  let guard = 0;
  while (!s.done && guard++ < 60) {
    const rec = CS.recommend(s, st, { target: r.tiers[2], timeMs: Infinity, maxRollouts: 150, seed: guard });
    assert.ok(rec.action !== A.StellarSteadyHand && rec.action !== A.MaterialMiracle);
    s = CS.stepSample(s, rec.action, st, rnd);
  }
  // charges available but per-craft budget zero
  const st2 = CS.makeSettings(r, STATS, DB, { sshCharges: 4 });
  const rec2 = CS.recommend(CS.initialState(st2), st2, { target: r.tiers[2], timeMs: Infinity, maxRollouts: 200, sshBudget: 0 });
  assert.notEqual(rec2.action, A.StellarSteadyHand);
});

test('unreachable target: the craft is still completed', () => {
  const r = DB.recipes['38200'];
  const weak = { craftsmanship: 4000, control: 3500, cp: 550, level: 100, specialist: false, cosmicTool: false };
  const st = CS.makeSettings(r, weak, DB, {});
  let completed = 0;
  for (let k = 0; k < 6; k++) {
    let s = CS.initialState(st); const rnd = CS.mulberry32(50 + k); let g = 0;
    while (!s.done && g++ < 80) {
      const rec = CS.recommend(s, st, { target: r.quality, timeMs: Infinity, maxRollouts: 150, seed: g });
      s = CS.stepSample(s, rec.action, st, rnd);
    }
    completed += s.done === 1 ? 1 : 0;
  }
  assert.ok(completed >= 5, `completed ${completed}/6`);
});

test('resource-starved states still give a valid action or a clear stop', () => {
  const r = DB.recipes['38198'];
  const st = CS.makeSettings(r, STATS, DB, {});
  const s = CS.initialState(st);
  s.progress = st.maxProgress - 200; s.durability = 5; s.cp = 0; s.step = 25; s.quality = 5000;
  const rec = CS.recommend(s, st, { target: r.tiers[0], timeMs: Infinity, maxRollouts: 200 });
  assert.ok(rec.action, 'some action');
  assert.equal(CS.whyNot(rec.action, s, st), null);
  assert.ok(rec.action.prog, 'goes for progress when nothing else helps');
  const dead = CS.copyState(s); dead.done = 2;
  assert.equal(CS.recommend(dead, st, {}).action, null);
});

test('deterministic for a fixed seed and rollout cap; time budget respected; fallback flagged', () => {
  const r = DB.recipes['37986'];
  const st = CS.makeSettings(r, STATS, DB, {});
  const s = CS.initialState(st);
  const o = { target: r.tiers[2], timeMs: Infinity, maxRollouts: 600, seed: 3 };
  assert.equal(CS.recommend(s, st, o).action, CS.recommend(s, st, o).action);
  const t0 = Date.now();
  const rec = CS.recommend(s, st, { target: r.tiers[2], timeMs: 150 });
  const dt = Date.now() - t0;
  assert.ok(dt < 600, `took ${dt} ms for a 150 ms budget`);
  assert.ok(rec.estimate.n >= 24);
  const fb = CS.recommend(s, st, { target: r.tiers[2], timeMs: 0 });
  assert.equal(fb.fallback, true);
  assert.equal(CS.whyNot(fb.action, s, st), null);
});

test('conditions are exploited: Good in the quality phase is spent on a quality action', () => {
  const r = DB.recipes['37986'];
  const strong = { craftsmanship: 5800, control: 5600, cp: 750, level: 100, specialist: true, cosmicTool: true };
  const st = CS.makeSettings(r, strong, DB, {});
  const s = CS.initialState(st);
  s.progress = st.maxProgress - 300; s.step = 12; s.iq = 4; s.inno = 2; s.manip = 4; s.cond = COND.Good;
  s.durability = 40; s.cp = 420; s.quality = 5000;
  const rec = CS.recommend(s, st, { target: r.tiers[2], lowerTiers: r.tiers, timeMs: Infinity, maxRollouts: 4000 });
  assert.ok(rec.estimate.pTarget > 0.05, 'target reachable in this state');
  assert.equal(rec.action.kind, 'Q', `on Good got ${rec.action.name}`);
  assert.ok(CS.qualityGain(rec.action, s, st) >= CS.qualityGain(A.BasicTouch, s, st) * 1.5, 'a high-yield touch');
});

test('free non-step actions are not recommended without a clear gain', () => {
  const r = DB.recipes['37986'];
  const st = CS.makeSettings(r, STATS, DB, {});
  const s = CS.initialState(st);
  s.progress = st.maxProgress - 300; s.step = 12; s.iq = 4; s.inno = 2; s.cond = COND.Normal; s.durability = 40; s.cp = 400;
  const rec = CS.recommend(s, st, { target: r.tiers[2], lowerTiers: r.tiers, timeMs: Infinity, maxRollouts: 6000 });
  if (!rec.action.step) {
    const best = rec.alternatives.find(a => a.action.step);
    assert.ok(!best || rec.alternatives[0].value - best.value >= 0.01, `${rec.action.name} chosen without a clear margin`);
  }
});

test('never recommends an action that certainly destroys the craft (regression: 25-durability recipe)', () => {
  const r = DB.recipes['36212'];
  const weak = { craftsmanship: 4700, control: 4500, cp: 620, level: 100, specialist: false, cosmicTool: false };
  const st = CS.makeSettings(r, weak, DB, { mmCharges: 2 });
  let s = CS.initialState(st);
  s = CS.apply(A.Reflect, s, st); s.cond = COND.Good; // durability 15 now
  const rec = CS.recommend(s, st, { target: r.quality, timeMs: Infinity, maxRollouts: 600 });
  assert.equal(CS.certainFailure(rec.action, s, st), false, `${rec.action.name} would end the craft`);
  const n = CS.apply(rec.action, s, st, true);
  assert.notEqual(n.done, 2);
});
