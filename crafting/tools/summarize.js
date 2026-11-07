#!/usr/bin/env node
'use strict';
// Summarize validation/*.json into Markdown tables (printed to stdout).
const fs = require('fs');
const path = require('path');
const V = path.join(__dirname, '..', 'validation');
const pct = x => (x * 100).toFixed(0) + '%';
const load = f => { const p = path.join(V, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };

function pooled(rows, policy, filter) {
  const rs = rows.filter(filter || (() => true)).map(r => r.results[policy]).filter(Boolean);
  const n = rs.reduce((a, r) => a + r.n, 0);
  if (!n) return null;
  const w = k => rs.reduce((a, r) => a + r[k] * r.n, 0) / n;
  return { scenarios: rs.length, n, success: w('successRate'), complete: w('completionRate'), quality: w('meanQuality'), steps: w('meanSteps'),
    ms: rs.reduce((a, r) => a + (r.msPerDecision || 0), 0) / rs.length,
    est: rs.filter(r => r.meanFirstEstimate !== null).length ? rs.reduce((a, r) => a + (r.meanFirstEstimate || 0) * r.n, 0) / n : null };
}

function table(title, data, groups) {
  const out = [`### ${title}`, '', '| Group | Scenarios | Crafts per policy | Static rotation | Heuristic policy | Rollout solver | Solver completion | Solver mean steps | First-step estimate (mean) | ms per decision |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const [label, f] of groups) {
    const s = pooled(data.rows, 'static', f), h = pooled(data.rows, 'heuristic', f), o = pooled(data.rows, 'solver', f);
    if (!o) continue;
    out.push(`| ${label} | ${o.scenarios} | ${o.n} | ${s ? pct(s.success) : '–'} | ${h ? pct(h.success) : '–'} | **${pct(o.success)}** | ${pct(o.complete)} | ${o.steps.toFixed(1)} | ${o.est === null ? '–' : pct(o.est)} | ${o.ms.toFixed(0)} |`);
  }
  return out.join('\n');
}

function perScenario(data) {
  const out = ['| Planet | Profile | Rank | Special | Stats | Target / max | Static | Heuristic | Solver | Solver mean quality |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const r of data.rows) {
    const g = p => r.results[p] ? pct(r.results[p].successRate) : '–';
    out.push(`| ${r.scenario.planet} | ${r.scenario.profile} | ${r.scenario.rank} | ${r.scenario.special ? (r.scenario.special === 'StellarSteadyHand' ? 'SSH' : 'MM') + '×' + r.scenario.charges : '–'} | ${r.stats} | ${r.target.target} / ${r.maxQuality} | ${g('static')} | ${g('heuristic')} | ${g('solver')} | ${r.results.solver ? r.results.solver.meanQuality : '–'} |`);
  }
  return out.join('\n');
}

// Static-rotation results re-run after the Material Miracle planning fix
// replace the static column where present.
function overrideStatic(data, file) {
  const fix = load(file);
  if (!data || !fix) return data;
  const byKey = new Map(fix.rows.map(r => [r.scenario.key + '|' + r.stats + '|' + r.env, r.results.static]));
  for (const r of data.rows) { const k = r.scenario.key + '|' + r.stats + '|' + r.env; if (byKey.has(k)) r.results.static = byKey.get(k); }
  return data;
}
const all = overrideStatic(load('expert-all.json'), 'expert-all-static.json');
const parts = [];
if (all) {
  const planets = ['sinus-ardorum', 'phaenna', 'oizys', 'auxesia'];
  parts.push(table('Expert recipes, all planets (pooled)', all, [
    ['All, high stats', r => r.stats === 'high'], ['All, mid stats', r => r.stats === 'mid'],
    ...planets.map(p => [`${p}, high`, r => r.stats === 'high' && r.scenario.planet === p]),
    ...planets.map(p => [`${p}, mid`, r => r.stats === 'mid' && r.scenario.planet === p]),
    ['With Stellar Steady Hand', r => r.scenario.special === 'StellarSteadyHand'],
    ['With Material Miracle', r => r.scenario.special === 'MaterialMiracle'],
    ['No special action', r => !r.scenario.special]
  ]));
  // head-to-head counts
  let better = 0, worse = 0, tie = 0, sig = 0;
  for (const r of all.rows) {
    const s = r.results.solver, h = r.results.heuristic;
    if (s.successRate > h.successRate) better++; else if (s.successRate < h.successRate) worse++; else tie++;
    if (s.successRate - h.successRate > s.ci95 + h.ci95) sig++;
  }
  parts.push(`Solver vs heuristic per scenario: better ${better}, equal ${tie}, worse ${worse}; clearly better (gap larger than both 95% intervals) ${sig} of ${all.rows.length}. Run time ${all.seconds.toFixed(0)} s on 4 cores.`);
}
const mm = overrideStatic(load('auxesia-model-mismatch.json'), 'auxesia-model-mismatch-static.json');
if (mm) parts.push(table('Model mismatch: crafts follow Craftimizer condition rates, solver plans with Teamcraft rates (Auxesia, high stats)', mm, [['Auxesia', () => true]]));
const fast = load('auxesia-fast.json');
if (fast) parts.push(table('Fast mode (Auxesia, high stats)', fast, [['Auxesia', () => true]]));
const norm = load('normal-sample.json');
if (norm) parts.push(table('Normal (non-expert) recipes, sample across planets, low stats (4700/4500/620, no specialist, no Cosmic tool)', norm, [['Sample', () => true]]));
if (all) parts.push('### Per scenario (expert)\n\n' + perScenario(all));
console.log(parts.join('\n\n'));
