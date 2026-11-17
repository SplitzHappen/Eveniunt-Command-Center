#!/usr/bin/env node
'use strict';
/*
 * Batch evaluation of the decision engine against baselines.
 *
 *   node tools/evaluate.js [--planet auxesia] [--n 100] [--rollouts 800]
 *        [--stats high,mid,low] [--env teamcraft|craftimizer] [--profiles P001,P002]
 *        [--policies static,heuristic,solver] [--out results.json] [--workers 4]
 *
 * Every policy faces the same random craft environments (common random
 * numbers): craft i draws its conditions and success rolls from seed 1000+i.
 *
 * Policies
 *   static     A fixed rotation: the base heuristic's action sequence planned
 *              as if every condition were Normal, then replayed blindly
 *              (unusable actions are skipped). Represents a macro.
 *   heuristic  The condition-aware base policy, re-evaluated every step.
 *   solver     The rollout planner (recommend()), re-planning every step.
 */
const path = require('path');
const os = require('os');
const { fork } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CS = require(path.join(ROOT, 'src', 'engine', 'sim.js'));
require(path.join(ROOT, 'src', 'engine', 'solver.js'));

const STATS = {
  high: { craftsmanship: 5800, control: 5600, cp: 750, level: 100, specialist: true, cosmicTool: true },
  mid: { craftsmanship: 5200, control: 5000, cp: 680, level: 100, specialist: true, cosmicTool: true },
  low: { craftsmanship: 4700, control: 4500, cp: 620, level: 100, specialist: false, cosmicTool: false }
};

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
  return o;
}

function scenarios(db, planet, profileFilter, kind) {
  const out = [];
  const seen = new Set();
  for (const m of db.missions) {
    if (planet && planet !== 'all' && m.planet !== planet) continue;
    for (const rid of m.recipes) {
      const r = db.recipes[String(rid)];
      if (kind === 'expert' && !r.expert) continue;
      if (kind === 'normal' && r.expert) continue;
      if (profileFilter && !profileFilter.includes(r.profile)) continue;
      const obj = m.objectives[0] || {};
      const key = r.profile + '|' + (obj.specialAction || '') + '|' + (obj.specialActionCharges || 0);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key, planet: m.planet, profile: r.profile, mission: m.id, missionName: m.name, recipe: rid, rank: m.rank,
        special: obj.specialAction || null, charges: obj.specialActionCharges || 0
      });
    }
  }
  return out;
}

function targetFor(r) {
  if (r.tiers) return { target: r.tiers[2], lower: r.tiers.slice(0, 2), label: 'top tier' };
  if (r.requiredQuality) return { target: r.requiredQuality, lower: [], label: 'required quality' };
  return { target: r.quality, lower: [], label: 'max quality' };
}

function settingsFor(db, sc, statsKey, env) {
  const r = db.recipes[String(sc.recipe)];
  return CS.makeSettings(r, STATS[statsKey], db, {
    sshCharges: sc.special === 'StellarSteadyHand' ? sc.charges : 0,
    mmCharges: sc.special === 'MaterialMiracle' ? sc.charges : 0,
    condModel: env || 'teamcraft'
  });
}

function planOnce(st, tgt, rnd, eps) {
  let s = CS.initialState(st);
  const ctx = { target: tgt.target, lowerTiers: tgt.lower, sshBudget: st.sshCharges, mmBudget: 0 };
  const plan = [];
  let guard = 0;
  while (!s.done && guard++ < 80) {
    let a = CS.policy(s, st, ctx);
    // A macro user presses Material Miracle right after the opener; plan with
    // it in place so buff timings in the replay match the plan.
    if (st.mmCharges > 0 && plan.length === 1) a = CS.A.MaterialMiracle;
    else if (rnd && rnd() < eps) {
      // random usable step action that is deterministic under Normal conditions
      const opts = CS.legalActions(s, st).filter(x => x.step && CS.successRate(x, s) >= 100 && !x.special);
      if (opts.length) a = opts[Math.floor(rnd() * opts.length)];
    }
    if (!a) break;
    plan.push(a);
    s = CS.apply(a, s, st, true);
    s.cond = CS.COND.Normal;
  }
  return { plan, s };
}
// Static rotation: best of K randomized heuristic rotations planned as if
// every condition were Normal (a macro optimized for the no-luck case).
function staticPlan(st, tgt, K) {
  const rnd = CS.mulberry32(4242);
  let best = null, bestKey = -Infinity;
  for (let k = 0; k < (K || 300); k++) {
    const r = planOnce(st, tgt, k === 0 ? null : rnd, 0.15);
    const done = r.s.done === 1;
    const key = (done ? 1e9 : 0) + (done && r.s.quality >= tgt.target ? 1e8 : 0) + r.s.quality - r.plan.length;
    if (key > bestKey) { bestKey = key; best = r; }
  }
  const plan = best.plan.slice();
  return { plan, normalQuality: best.s.quality, normalComplete: best.s.done === 1 };
}

function runCraft(policyName, st, tgt, envSeed, opts, plan, solverSt) {
  const env = CS.mulberry32(envSeed);
  let s = CS.initialState(st);
  const ctx = { target: tgt.target, lowerTiers: tgt.lower, sshBudget: st.sshCharges, mmBudget: st.mmCharges };
  let ms = 0, decisions = 0, pi = 0, guard = 0;
  let firstEstimate = null;
  while (!s.done && guard++ < 100) {
    let a = null;
    if (policyName === 'static') {
      while (pi < plan.length && CS.whyNot(plan[pi], s, st) !== null) pi++;
      if (pi >= plan.length) break;
      a = plan[pi++];
    } else if (policyName === 'heuristic') {
      a = CS.policy(s, st, ctx);
    } else {
      const t0 = Date.now();
      // The solver plans with its own (possibly mismatched) condition model.
      const rec = CS.recommend(s, solverSt || st, {
        target: tgt.target, lowerTiers: tgt.lower, timeMs: Infinity, maxRollouts: opts.rollouts,
        minRollouts: opts.minRollouts || 16, seed: 777 + decisions, mode: opts.mode || 'reliable'
      });
      ms += Date.now() - t0;
      decisions++;
      if (firstEstimate === null && rec.estimate) firstEstimate = rec.estimate.pTarget;
      a = rec.action;
    }
    if (!a) break;
    s = CS.stepSample(s, a, st, env);
  }
  return {
    hit: s.done === 1 && s.quality >= tgt.target ? 1 : 0,
    complete: s.done === 1 ? 1 : 0,
    quality: s.quality, steps: s.step,
    msPerDecision: decisions ? ms / decisions : 0,
    firstEstimate
  };
}

function evaluateScenario(db, sc, statsKey, o) {
  const r = db.recipes[String(sc.recipe)];
  const tgt = targetFor(r);
  const st = settingsFor(db, sc, statsKey, o.env);
  const solverSt = o.env && o.env !== 'teamcraft' ? settingsFor(db, sc, statsKey, 'teamcraft') : null;
  const sp = staticPlan(st, tgt);
  const plan = sp.plan;
  const res = {};
  for (const p of o.policies) {
    const rows = [];
    for (let i = 0; i < o.n; i++) rows.push(runCraft(p, st, tgt, 1000 + i, o, plan, solverSt));
    const n = rows.length;
    const sum = k => rows.reduce((a, x) => a + x[k], 0);
    const hits = sum('hit');
    const est = rows.filter(x => x.firstEstimate !== null);
    res[p] = {
      n, successRate: hits / n,
      ci95: 1.96 * Math.sqrt(Math.max(hits / n * (1 - hits / n), 1e-9) / n),
      completionRate: sum('complete') / n,
      meanQuality: Math.round(sum('quality') / n),
      meanSteps: +(sum('steps') / n).toFixed(1),
      msPerDecision: +(sum('msPerDecision') / n).toFixed(1),
      meanFirstEstimate: est.length ? +(est.reduce((a, x) => a + x.firstEstimate, 0) / est.length).toFixed(3) : null
    };
  }
  return {
    scenario: sc, stats: statsKey, env: o.env || 'teamcraft', target: tgt, maxQuality: st.maxQuality,
    progress: st.maxProgress, durability: st.maxDurability, baseProgress: st.baseProgress, baseQuality: st.baseQuality,
    staticPlanLength: plan.length, staticNormalQuality: sp.normalQuality, results: res
  };
}

function main() {
  const o = args();
  const db = require(path.join(ROOT, 'data', 'cosmic-db.json'));
  const opts = {
    n: +(o.n || 50), rollouts: +(o.rollouts || 800), minRollouts: +(o.minRollouts || 16),
    env: o.env || 'teamcraft', mode: o.mode || 'reliable',
    policies: (o.policies || 'static,heuristic,solver').split(',')
  };
  const statsKeys = (o.stats || 'high').split(',');
  let scs = scenarios(db, o.planet || 'auxesia', o.profiles ? o.profiles.split(',') : null, o.kind || 'expert');
  if (o.sample) { const k = +o.sample; scs = scs.filter((_, i) => i % Math.max(1, Math.floor(scs.length / k)) === 0).slice(0, k); }
  const jobs = [];
  for (const sc of scs) for (const k of statsKeys) jobs.push({ sc, k });
  if (o.child) {
    // child: evaluate the jobs assigned by index
    const idx = JSON.parse(o.child);
    const out = idx.map(i => evaluateScenario(db, jobs[i].sc, jobs[i].k, opts));
    process.send(out);
    return;
  }
  const workers = Math.min(+(o.workers || os.cpus().length), jobs.length) || 1;
  const buckets = Array.from({ length: workers }, () => []);
  jobs.forEach((j, i) => buckets[i % workers].push(i));
  const t0 = Date.now();
  let pending = workers;
  const all = [];
  buckets.forEach(b => {
    const child = fork(__filename, [...process.argv.slice(2), '--child', JSON.stringify(b)]);
    child.on('message', m => all.push(...m));
    child.on('exit', () => {
      if (--pending === 0) {
        all.sort((a, b) => (a.scenario.key + a.stats).localeCompare(b.scenario.key + b.stats));
        const summary = { generated: new Date().toISOString(), options: opts, seconds: (Date.now() - t0) / 1000, rows: all };
        const fs = require('fs');
        if (o.out) fs.writeFileSync(o.out, JSON.stringify(summary, null, 1));
        for (const row of all) {
          const parts = opts.policies.map(p => {
            const r = row.results[p];
            return `${p} ${(r.successRate * 100).toFixed(0)}%±${(r.ci95 * 100).toFixed(0)} q${r.meanQuality} c${(r.completionRate * 100).toFixed(0)}% ${r.meanSteps}st${p === 'solver' ? ' ' + r.msPerDecision + 'ms est' + r.meanFirstEstimate : ''}`;
          });
          console.log(`${row.scenario.planet} ${row.scenario.profile} r${row.scenario.recipe} ${row.scenario.rank} ${row.scenario.special || '-'}x${row.scenario.charges} [${row.stats}] tgt ${row.target.target}/${row.maxQuality} | ${parts.join(' | ')}`);
        }
        console.log(`done in ${summary.seconds}s`);
      }
    });
  });
}

main();
