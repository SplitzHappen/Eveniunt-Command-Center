'use strict';
// Simulator reference tests. Expected values are transcribed from:
//  - Raphael simulator tests marked "Verified in-game" (raphael-sim/tests/simulator_tests.rs)
//  - Teamcraft simulator test comments recording in-game values
//  - Game sheets (CraftAction/Action CP costs and levels) via data/actions-verified.json
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const CS = require(path.join(__dirname, '..', 'src', 'engine', 'sim.js'));
const A = CS.A, COND = CS.COND;

function settings(o) {
  return Object.assign({
    maxProgress: 99999, maxQuality: 99999, maxDurability: 80, maxCp: 999,
    baseProgress: 100, baseQuality: 100, level: 100, specialist: true, manipulation: true,
    cosmicTool: false, expert: false, condFlag: 15, condModel: 'teamcraft', sshCharges: 0, mmCharges: 0
  }, o);
}
function run(st, seq) {
  let s = CS.initialState(st);
  const out = [];
  for (const item of seq) {
    const [key, cond, ok] = Array.isArray(item) ? item : [item, COND.Normal, true];
    s.cond = cond === undefined ? COND.Normal : cond;
    const why = CS.whyNot(A[key], s, st);
    assert.equal(why, null, `${key} should be usable at step ${out.length}: ${why}`);
    s = CS.apply(A[key], s, st, ok === undefined ? true : ok);
    out.push(s);
  }
  return out;
}

test('Raphael in-game be9fc5c2 (Classical Index, Lv90)', () => {
  const st = settings({ maxCp: 594, maxDurability: 70, maxProgress: 3900, maxQuality: 10920, baseProgress: 247, baseQuality: 265, level: 90 });
  const seq = [
    ['Reflect'], ['Manipulation'], ['PreciseTouch', COND.Excellent], ['WasteNot', COND.Poor],
    ['PreparatoryTouch'], ['MastersMend'], ['PreparatoryTouch'], ['Innovation'], ['BasicTouch'],
    ['StandardTouch'], ['AdvancedTouch'], ['PrudentTouch'], ['GreatStrides'], ['Innovation'], ['Observe'],
    ['AdvancedTouch'], ['Veneration'], ['Groundwork'], ['DelicateSynthesis']
  ];
  const got = run(st, seq).map(s => [s.progress, s.quality]);
  assert.deepEqual(got, [
    [0, 795], [0, 795], [0, 2703], [0, 2703], [0, 3445], [0, 3445], [0, 4293], [0, 4293], [0, 5008],
    [0, 5952], [0, 7144], [0, 7939], [0, 7939], [0, 7939], [0, 7939], [0, 9926], [0, 9926], [1333, 9926], [1703, 10456]
  ]);
});

test('Raphael in-game d11d9c68 (Lv94, verified patch 7.0)', () => {
  const st = settings({ maxCp: 601, maxDurability: 80, maxProgress: 6300, maxQuality: 11400, baseProgress: 238, baseQuality: 300, level: 94 });
  const seq = ['Reflect', 'Innovation', 'PreparatoryTouch', 'PrudentTouch', 'GreatStrides', 'PreparatoryTouch',
    'GreatStrides', 'Innovation', 'PreparatoryTouch', 'MastersMend', 'GreatStrides', 'ByregotsBlessing'];
  const got = run(st, seq).map(s => s.quality);
  assert.deepEqual(got, [900, 900, 1980, 2610, 2610, 4860, 4860, 4860, 7410, 7410, 7410, 11400]);
});

test('Raphael in-game 4866545e (Lv100, verified patch 7.1)', () => {
  const st = settings({ maxCp: 540, maxDurability: 35, maxProgress: 4125, maxQuality: 12000, baseProgress: 282, baseQuality: 256, level: 100 });
  const seq = ['Reflect', 'Manipulation', 'Innovation', 'BasicTouch', 'RefinedTouch', 'PrudentTouch', 'PrudentTouch',
    'Innovation', 'BasicTouch', 'StandardTouch', 'AdvancedTouch', 'Manipulation', 'TrainedPerfection', 'GreatStrides',
    'Innovation', 'PreparatoryTouch', 'GreatStrides', 'ByregotsBlessing'];
  const states = run(st, seq);
  assert.deepEqual(states.map(s => s.quality), [768, 768, 768, 1228, 1727, 2303, 2917, 2917, 3569, 4433, 5527, 5527, 5527, 5527, 5527, 8087, 8087, 11927]);
  assert.ok(states.every(s => s.done === 0), 'craft must not fail on durability');
});

test('Raphael f9f0dac7 progress sequence (Lv100; quality not compared: that test runs Raphael adversarial mode)', () => {
  const st = settings({ maxCp: 697, maxDurability: 80, maxProgress: 6600, maxQuality: 12000, baseProgress: 261, baseQuality: 240, level: 100 });
  const seq = ['Reflect', 'Observe', 'AdvancedTouch', 'Innovation', 'BasicTouch', 'StandardTouch', 'AdvancedTouch',
    'PreparatoryTouch', 'ImmaculateMend', 'Innovation', 'PrudentTouch', 'BasicTouch', 'StandardTouch', 'AdvancedTouch',
    'Innovation', 'BasicTouch', 'StandardTouch', 'AdvancedTouch', 'ByregotsBlessing', 'TrainedPerfection',
    'ImmaculateMend', 'Veneration', 'Groundwork', 'Groundwork', 'Groundwork', 'Groundwork', 'Veneration', 'Groundwork'];
  const states = run(st, seq);
  assert.deepEqual(states.map(s => s.progress).slice(-7), [0, 1409, 2818, 4227, 5636, 5636, 7045]);
  assert.equal(states[states.length - 1].done, 1);
});

test('Base values reproduce in-game f32 rounding (Teamcraft test comment: Preparatory Touch 693 in game)', () => {
  // rlvl 710, dividers 170/150, modifiers 90/75, Lv100 5408/5255.
  const rl = { level: 100, progressDivider: 170, qualityDivider: 150, progressModifier: 90, qualityModifier: 75 };
  const b = CS.baseValues({ craftsmanship: 5408, control: 5255, level: 100 }, rl);
  assert.equal(b.baseQuality, 289);
  const st = settings({ maxCp: 630, maxDurability: 70, maxProgress: 7500, maxQuality: 16500, baseProgress: b.baseProgress, baseQuality: b.baseQuality });
  const states = run(st, ['Reflect', 'Manipulation', 'WasteNotII', 'PreparatoryTouch', 'Innovation',
    'PreparatoryTouch', 'PreparatoryTouch', 'PreparatoryTouch', 'ByregotsBlessing']);
  const gains = states.map((s, i) => s.quality - (i ? states[i - 1].quality : 0));
  // In-game values recorded in the Teamcraft test comments: 693, 1213, 1387, 1560, 2601.
  assert.equal(gains[3], 693);
  assert.equal(gains[5], 1213);
  assert.equal(gains[6], 1387);
  assert.equal(gains[7], 1560);
  assert.equal(gains[8], 2601);
});

test('Condition effects: Pliant halves CP (ceil), Sturdy halves durability and stacks with Waste Not', () => {
  const st = settings({ maxCp: 541, maxDurability: 70 });
  let s = CS.initialState(st);
  s.cond = COND.Pliant;
  assert.equal(CS.cpCost(A.WasteNot, s), 28);
  assert.equal(CS.cpCost(A.Observe, s), 4); // ceil(7/2)
  s = CS.apply(A.WasteNot, s, st); s.cond = COND.Sturdy;
  assert.equal(CS.durCost(A.BasicTouch, s), 3); // ceil(10/4)
  s.cond = COND.Robust;
  assert.equal(CS.durCost(A.PreparatoryTouch, s), 5);
});

test('Good condition quality x1.5, x1.75 with phase-9+ cosmic tool; Malleable progress x1.5', () => {
  const st = settings({ baseQuality: 300, baseProgress: 300 });
  let s = CS.initialState(st); s.cond = COND.Good;
  assert.equal(CS.qualityGain(A.BasicTouch, s, st), 450);
  assert.equal(CS.qualityGain(A.BasicTouch, s, Object.assign({}, st, { cosmicTool: true })), 525);
  s.cond = COND.Malleable;
  assert.equal(CS.progressGain(A.BasicSynthesis, s, st), 540);
});

test('Buff timing: buffs last N following steps; Manipulation repairs from the next step; FA/CO/H&S do not tick', () => {
  const st = settings({ maxDurability: 40 });
  let s = CS.initialState(st);
  s = CS.apply(A.Manipulation, s, st);
  assert.equal(s.manip, 8); assert.equal(s.durability, 40);
  s = CS.apply(A.BasicTouch, s, st); // 40-10+5
  assert.equal(s.durability, 35); assert.equal(s.manip, 7);
  s = CS.apply(A.GreatStrides, s, st);
  const gs = s.gs;
  s = CS.apply(A.FinalAppraisal, s, st);
  assert.equal(s.gs, gs, 'Final Appraisal does not tick');
  s = CS.apply(A.CarefulObservation, s, st);
  assert.equal(s.gs, gs, 'Careful Observation does not tick');
  s = CS.apply(A.HeartAndSoul, s, st);
  assert.equal(s.gs, gs);
  assert.equal(s.hs, 1);
  // Precise Touch under Normal consumes Heart and Soul
  s = CS.apply(A.PreciseTouch, s, st);
  assert.equal(s.hs, 0); assert.equal(s.gs, 0, 'Great Strides consumed by quality action');
});

test('Primed adds 2 steps to the next buff; Good Omen forces Good; Robust forces Sturdy', () => {
  const st = settings({ expert: true, condFlag: 1523 });
  let s = CS.initialState(st); s.cond = COND.Primed;
  s = CS.apply(A.Innovation, s, st);
  assert.equal(s.inno, 6);
  s.cond = COND.GoodOmen;
  assert.deepEqual(CS.nextConditionDist(s, st), [[COND.Good, 1]]);
  s.cond = COND.Robust;
  assert.deepEqual(CS.nextConditionDist(s, st), [[COND.Sturdy, 1]]);
  s.cond = COND.Normal;
  const dist = CS.nextConditionDist(s, st);
  const total = dist.reduce((a, d) => a + d[1], 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('Failures still cost CP and durability, tick buffs, keep Great Strides, grant no Inner Quiet', () => {
  const st = settings({ level: 100 });
  let s = CS.initialState(st);
  s = CS.apply(A.GreatStrides, s, st);
  s = CS.apply(A.Innovation, s, st);
  const before = CS.copyState(s);
  s = CS.apply(A.HastyTouch, s, st, false);
  assert.equal(s.quality, before.quality);
  assert.equal(s.durability, before.durability - 10);
  assert.equal(s.iq, 0);
  assert.equal(s.gs, before.gs - 1);
  assert.equal(s.inno, before.inno - 1);
  assert.equal(s.exped, 0, 'no Expedience after a failed Hasty Touch');
  s = CS.apply(A.RapidSynthesis, s, st, false);
  assert.equal(s.progress, 0);
});

test('Stellar Steady Hand guarantees success for the next three steps and spends a charge', () => {
  const st = settings({ sshCharges: 2 });
  let s = CS.initialState(st);
  s = CS.apply(A.StellarSteadyHand, s, st);
  assert.equal(s.sshCharges, 1); assert.equal(s.ssh, 3);
  assert.equal(CS.successRate(A.RapidSynthesis, s), 100);
  s = CS.apply(A.RapidSynthesis, s, st); s = CS.apply(A.HastyTouch, s, st);
  assert.equal(CS.successRate(A.DaringTouch, s), 100);
  s = CS.apply(A.DaringTouch, s, st);
  assert.equal(s.ssh, 0);
  assert.equal(CS.successRate(A.RapidSynthesis, s), 50);
});

test('Material Miracle: next conditions come from its six guaranteed conditions', () => {
  const st = settings({ mmCharges: 1, condFlag: 15 });
  let s = CS.initialState(st);
  s = CS.apply(A.MaterialMiracle, s, st);
  assert.equal(s.mmCharges, 0);
  const conds = CS.nextConditionDist(s, st).map(d => d[0]).sort((a, b) => a - b);
  assert.deepEqual(conds, CS.MM_CONDS.slice().sort((a, b) => a - b));
  assert.equal(CS.whyNot(A.MaterialMiracle, s, st), 'no charges left');
});

test('Craft ends at durability 0 unless progress completes; no Manipulation rescue at 0', () => {
  const st = settings({ maxDurability: 10, maxProgress: 100000 });
  let s = CS.initialState(st);
  s = CS.apply(A.Manipulation, s, st);
  s = CS.apply(A.BasicTouch, s, st);
  assert.equal(s.done, 2);
  const st2 = settings({ maxDurability: 10, maxProgress: 50, baseProgress: 100 });
  let t = CS.initialState(st2);
  t = CS.apply(A.BasicSynthesis, t, st2);
  assert.equal(t.done, 1);
});

test('Combos: Basic->Standard 18 CP, Standard(combo)->Advanced 18 CP, Observe->Advanced 18 CP, Basic->Refined +1 IQ', () => {
  const st = settings();
  let s = CS.initialState(st);
  s = CS.apply(A.BasicTouch, s, st);
  assert.equal(CS.cpCost(A.StandardTouch, s), 18);
  assert.equal(CS.cpCost(A.RefinedTouch, s), 24);
  const r = CS.apply(A.RefinedTouch, s, st);
  assert.equal(r.iq, 3);
  s = CS.apply(A.StandardTouch, s, st);
  assert.equal(CS.cpCost(A.AdvancedTouch, s), 18);
  let t = CS.apply(A.StandardTouch, CS.initialState(st), st);
  assert.equal(CS.cpCost(A.AdvancedTouch, t), 46);
  t = CS.apply(A.Observe, t, st);
  assert.equal(CS.cpCost(A.AdvancedTouch, t), 18);
});

test('Engine CP costs and levels match the game sheets', () => {
  const verified = require(path.join(__dirname, '..', 'data', 'actions-verified.json'));
  const checked = [];
  for (const a of CS.ACTIONS) {
    const v = verified[a.name];
    if (!v) continue;
    if (a.key === 'StellarSteadyHand' || a.key === 'MaterialMiracle') {
      assert.equal(a.cp, 0); continue; // charge cost (PrimaryCostType 20), not CP
    }
    assert.equal(a.cp, v.cp, `${a.name} CP`);
    assert.equal(a.level, v.level, `${a.name} level`);
    checked.push(a.name);
  }
  assert.ok(checked.length >= 30, `checked ${checked.length} actions`);
});

test('Level-synced recipe uses the adjust table below level 100', () => {
  const db = require(path.join(__dirname, '..', 'data', 'cosmic-db.json'));
  const m = db.missions.find(x => x.planet === 'auxesia' && x.rank === 'D');
  const r = db.recipes[String(m.recipes[0])];
  const lv100 = CS.makeSettings(r, { craftsmanship: 4000, control: 4000, cp: 600, level: 100 }, db);
  assert.equal(lv100.maxProgress, r.progress);
  assert.equal(lv100.maxQuality, r.quality);
  const lv50 = CS.makeSettings(r, { craftsmanship: 400, control: 400, cp: 300, level: 50 }, db);
  const row = db.recipeLevels[String(db.levelAdjust['50'])];
  assert.equal(lv50.maxProgress, Math.floor(row.Difficulty * r.difficultyFactor / 100));
  assert.equal(lv50.maxDurability, Math.floor(80 * r.durabilityFactor / 100));
});
