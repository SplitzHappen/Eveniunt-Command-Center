#!/usr/bin/env node
'use strict';
// Tuning tool for the Submersibles recommendations (spec docs/submersibles-recommendations-spec.md, 4.6, item R4).
// Builds a test fleet ONLY from tracker/data/submarines.json, runs the advisor (ADVISOR.advise with RECS settings) and works
// out the default fuel allowance (RECS.GIVE_UP) and checks the 5% band, on three scenarios: levelling, unlocking and (item D8 of
// docs/submersibles-droprates-spec.md) gil, measured on estimated merchant gil per hour and per tank. Prints the tables; with --write it writes
// docs/submersibles-recommendations-tuning.md. Nothing is random and nothing time-dependent is written, so a second run
// writes an identical file.
//   node tracker/tools/recs-tune.js            print
//   node tracker/tools/recs-tune.js --write    print and write the document
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs', 'submersibles-recommendations-tuning.md');
const SRC = path.join(ROOT, 'tracker', 'command-center', 'src', 'submersibles');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'tracker', 'data', 'submarines.json'), 'utf8'));
require(path.join(SRC, 'recs.js'));
require(path.join(SRC, 'drops.js')); // the advisor's Gil stage reads DROPS; the tool measures gil with it too
require(path.join(SRC, 'advisor.js'));
const RECS = globalThis.RECS, ADV = globalThis.ADVISOR.init(D);

const RANKS = [1, 10, 20, 30, 40, 50, 70, 90, 110, 130, 145];
const GIL_FROM = 20; // the gil scenario starts at this rank
const BEFORE = { giveUp: 10, band: 5, scenarios: 122 }; // the previous run (levelling and unlocking, ranks 1 to 130), as the previous document stated it
const SLOTS = 4;
const STEP = 5;
const BANDS = [0, 0.02, 0.05, 0.10];
const INTENDED = { levelling: 'X', unlocking: 'U2', gil: 'G' };

// ------------------------------------------------------------------ the fleet and the scenarios
function fleet() {
  const out = [];
  RANKS.forEach((rank) => {
    D.classes.filter((c) => c.rank <= rank).forEach((c) => {
      const parts = D.parts.filter((p) => p.class === c.id).sort((a, b) => a.slot - b.slot).map((p) => p.id);
      out.push({ rank, cls: c.name, parts });
    });
  });
  return out;
}
function scenarios() {
  const list = [];
  fleet().forEach((sub) => {
    const found = (limit, always) => D.sectors.filter((s) => s.rank <= limit || always.indexOf(s.id) >= 0).map((s) => s.id);
    const A_B = D.sectors.filter((s) => s.letter === 'A' || s.letter === 'B').map((s) => s.id).filter((id) => D.sectors.find((s) => s.id === id).sea === D.seas[0].id);
    list.push({ kind: 'levelling', sub, found: found(sub.rank, []), order: ['level', 'unlock', 'gil', 'loot'] });
    list.push({ kind: 'unlocking', sub, found: found(Math.floor(sub.rank / 2), A_B), order: ['unlock', 'level', 'gil', 'loot'] });
    if (sub.rank >= GIL_FROM) list.push({ kind: 'gil', sub, found: D.sectors.map((s) => s.id), order: ['gil', 'unlock', 'level', 'loot'] });
  });
  return list;
}
// advise is pure, so one answer is kept per (band, input): the allowance sweep and the band table ask for the same fuel-off runs
const MEMO = new Map();
function advise(inp) {
  const key = RECS.BAND + '|' + JSON.stringify(inp);
  if (!MEMO.has(key)) MEMO.set(key, ADV.advise(inp));
  return MEMO.get(key);
}
function input(sc, recs) {
  return { sub: { rank: sc.sub.rank, expIntoRank: 0, parts: sc.sub.parts }, fc: { unlockedSlots: SLOTS, discovered: sc.found }, slotsFilled: SLOTS, pending: [],
    recs: Object.assign({ fuel: false, giveUp: RECS.GIVE_UP, order: sc.order, loot: RECS.defaults().loot }, recs) };
}

// amount of a stage key on a route (no pending voyages, so newOf counts every unfound child once)
function amountOf(key, sc, plan) {
  const disc = new Set(sc.found), seen = {};
  if (key === 'X' || key === 'U3') return plan.ev.exp;
  if (key === 'G') { const gil = globalThis.DROPS.route(D, plan.route, ADV.stats(sc.sub.rank, sc.sub.parts)); return gil ? gil.gil : 0; } // estimated merchant gil of one voyage
  if (key === 'U2') {
    let n = 0;
    plan.route.forEach((id) => ADV.children(id).forEach((c) => { if (!disc.has(c) && !seen[c]) { seen[c] = 1; n++; } }));
    return n;
  }
  return 0;
}
const perHour = (key, sc, plan) => amountOf(key, sc, plan) / (plan.ev.seconds / 3600);
const perTank = (key, sc, plan) => amountOf(key, sc, plan) / Math.max(1, plan.ev.tanks);
const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);
const routeKey = (plan) => plan.route.slice().sort((a, b) => a - b).join(',');

// ------------------------------------------------------------------ the allowance
function tuneAllowance(sc) {
  const off = advise(input(sc, { fuel: false }));
  const lead = off.lead;
  const base = { scenario: sc, lead, intended: lead === INTENDED[sc.kind], off, rows: [] };
  if (!base.intended) return base;
  const so = perHour(lead, sc, off.plan), eo = perTank(lead, sc, off.plan);
  for (let g = RECS.GIVE_MIN; g <= RECS.GIVE_MAX; g += STEP) {
    const on = advise(input(sc, { fuel: true, giveUp: g }));
    base.rows.push({ g, lost: so > 0 ? Math.max(0, 1 - perHour(lead, sc, on.plan) / so) : 0, gain: eo > 0 ? perTank(lead, sc, on.plan) / eo - 1 : 0, changed: routeKey(on.plan) !== routeKey(off.plan) });
  }
  return base;
}

// ------------------------------------------------------------------ the band
// Fuel off. First priority = the intended lead stage; second = Leveling (when the first is Unlocking) or Unlocking (when the
// first is Leveling), if it is live. Shares are of the best score any route reaches for that priority (found with a band of 0
// and that priority alone first), so a loss and a gain are in the same unit: percentage points of "the best possible".
function withBand(b, fn) { const old = RECS.BAND; RECS.BAND = b; try { return fn(); } finally { RECS.BAND = old; } }
function bandRows(runs) {
  const second = { levelling: ['U2', ['unlock', 'level', 'gil', 'loot']], unlocking: ['X', ['level', 'unlock', 'gil', 'loot']], gil: ['X', ['level', 'gil', 'unlock', 'loot']] };
  const per = BANDS.map(() => ({ loss: [], gain: [] }));
  let used = 0;
  runs.forEach((r) => {
    if (!r.intended) return;
    const sc = r.scenario, first = INTENDED[sc.kind], sec = second[sc.kind][0];
    const bestFirst = withBand(0, () => advise(input(sc, { fuel: false })));
    const bestSecond = withBand(0, () => advise(input(sc, { fuel: false, order: second[sc.kind][1] })));
    if (bestSecond.lead !== sec) return; // the second priority is not live here
    const f0 = perHour(first, sc, bestFirst.plan), s0 = perHour(sec, sc, bestSecond.plan);
    if (!(f0 > 0 && s0 > 0)) return;
    used++;
    const base = perHour(sec, sc, bestFirst.plan) / s0;
    BANDS.forEach((b, i) => {
      const res = withBand(b, () => advise(input(sc, { fuel: false })));
      per[i].loss.push(1 - perHour(first, sc, res.plan) / f0);
      per[i].gain.push(perHour(sec, sc, res.plan) / s0 - base);
    });
  });
  return { used, rows: BANDS.map((b, i) => ({ band: b, loss: mean(per[i].loss) * 100, gain: mean(per[i].gain) * 100 })) };
}

// ------------------------------------------------------------------ the whole run
// the rule (spec 4.6) on a list of measured scenarios: the table, the first step that does not pay, and the result
function rule(intended) {
  const table = [{ g: 0, L: 0, E: 0 }];
  for (let g = RECS.GIVE_MIN; g <= RECS.GIVE_MAX; g += STEP) {
    const rows = intended.map((r) => r.rows.find((x) => x.g === g));
    table.push({ g, L: mean(rows.map((x) => x.lost)) * 100, E: mean(rows.map((x) => x.gain)) * 100, changed: rows.filter((x) => x.changed).length });
  }
  let chosen = null, verdict = '';
  for (let i = 1; i < table.length; i++) {
    const dE = table[i].E - table[i - 1].E, dL = table[i].L - table[i - 1].L;
    table[i].dE = dE; table[i].dL = dL; table[i].pays = dE >= dL;
  }
  let knee = null;
  for (let i = 1; i < table.length; i++) { if (!table[i].pays) { knee = i; break; } }
  if (knee === null) verdict = 'no knee: every step paid, so the rule would return ' + RECS.GIVE_MAX + ' and no allowance is chosen';
  else if (knee === 1) verdict = 'the rule fails at the first step (g = ' + RECS.GIVE_MIN + '): no allowance is chosen';
  else chosen = table[knee - 1].g;
  return { table, chosen, verdict, knee, n: intended.length };
}
function run() {
  const runs = scenarios().map(tuneAllowance);
  const intended = runs.filter((r) => r.intended);
  const main = rule(intended);
  const sets = [
    ['levelling and unlocking, ranks 1 to 130 (exactly the previous run\'s scenarios)', rule(intended.filter((r) => r.scenario.kind !== 'gil' && r.scenario.sub.rank < 145))],
    ['levelling and unlocking, ranks 1 to 145', rule(intended.filter((r) => r.scenario.kind !== 'gil'))],
    ['gil only (ranks 20 to 145)', rule(intended.filter((r) => r.scenario.kind === 'gil'))]];
  const band = bandRows(runs);
  const at5 = band.rows.find((r) => r.band === 0.05);
  const changedAny = intended.filter((r) => r.rows.some((x) => x.changed)).length;
  return { runs, intended, table: main.table, chosen: main.chosen, verdict: main.verdict, sets, band, bandOk: at5.gain > at5.loss, knee: main.knee, changedAny,
    total: runs.length, count: intended.length, enough: intended.length >= 20 };
}

// ------------------------------------------------------------------ the text
const f2 = (x) => x.toFixed(2);
function render(R) {
  const L = [];
  const subs = fleet();
  L.push('# Submersibles recommendations: how the default numbers were chosen', '');
  L.push('Written by `node tracker/tools/recs-tune.js --write` (spec section 4.6, item R4). Do not edit by hand: run the tool again. The file holds no dates or timings, so a second run writes the same text.', '');
  const kindCount = (k) => R.runs.filter((r) => r.intended && r.scenario.kind === k).length;
  const lead = (rank, kind) => R.runs.filter((r) => r.scenario.sub.rank === rank && r.scenario.kind === kind).map((r) => r.lead || 'none').join(', ');
  L.push('## What changed in this run', '');
  L.push('- The previous run measured ' + BEFORE.scenarios + ' scenarios (levelling and unlocking, ranks 1 to 130, no gil) and its rule gave a fuel allowance of ' + BEFORE.giveUp + '% and accepted the ' + BEFORE.band + '% band.');
  L.push('- This run adds rank 145 to the test fleet and a third scenario, *gil*, and measures it on estimated merchant gil per hour and per tank (the estimate of `drops.js`, from community drop records). It measures ' + R.count + ' of ' + R.total + ' scenarios.');
  L.push('- At rank 145 the Leveling stage is skipped, so a levelling scenario there has another lead and is not measured (the tables below show it).');
  L.push('- The rule is unchanged. Result on all three scenarios: ' + (R.chosen === null ? 'no clear answer (' + R.verdict + ')' : 'a fuel allowance of ' + R.chosen + '%') + '. The 5% band: ' + (R.bandOk ? 'accepted' : 'not accepted') + '.');
  const res = (s) => (s.chosen === null ? 'no clear answer' : s.chosen + '%');
  L.push('- What the new tables show: ' + R.sets.map(([name, s]) => name + ': ' + res(s)).join('; ') + '; all three scenarios together: ' + res(R) + '. See "The same rule on parts of the scenarios" below.');
  L.push('- The shipped constants in this run: `RECS.GIVE_UP` = ' + RECS.GIVE_UP + '%, `RECS.BAND` = ' + Math.round(RECS.BAND * 100) + '%. ' + (R.chosen === RECS.GIVE_UP ? 'The rule confirms them.' : 'They are not changed by this run: the choice is left to the owner.'), '');
  L.push('## The test fleet and the scenarios', '');
  L.push('Everything comes from `tracker/data/submarines.json`: no number is invented and no voyage log is used. The only prices are the data\'s own merchant prices, used by the gil scenario.', '');
  L.push('- Ranks: ' + RANKS.join(', ') + '. At each rank, one build for every submarine class the rank allows, made of that class\'s own four parts (hull, stern, bow, bridge). That gives ' + subs.length + ' builds.');
  L.push('- Every sub has ' + SLOTS + ' unlocked slots, no voyage on another sub, no experience into its rank.');
  L.push('- Scenario *levelling*: every sector of rank at most R is found (R is the sub\'s rank); Leveling is ranked first. Intended lead: experience (stage X).');
  L.push('- Scenario *unlocking*: every sector of rank at most R/2 (rounded down) is found, and always the two sectors A and B of the first sea; Unlocking is ranked first. Intended lead: new sectors (stage U2).');
  L.push('- Scenario *gil*: every sector is found, Gil Farming is ranked first, ranks from ' + GIL_FROM + '. Intended lead: gil (stage G). The amount is the estimated merchant gil of the voyage for that build (`DROPS.route` with the build\'s own surveillance, retrieval and favor), per hour and per tank like the other amounts. Community routes come first, as in the advisor.');
  L.push('- Scenarios: ' + R.total + '. With the intended lead: ' + R.count + ' (' + kindCount('levelling') + ' levelling, ' + kindCount('unlocking') + ' unlocking, ' + kindCount('gil') + ' gil). Only these are measured. The rest have another lead (for example no sector able to reveal a new one), which these tables do not describe.');
  L.push('- Scenarios in which some allowance from ' + RECS.GIVE_MIN + ' to ' + RECS.GIVE_MAX + ' changed the route compared with fuel off: ' + R.changedAny + ' of ' + R.count + '.');
  L.push('');
  L.push('| Rank | Classes | Levelling lead | Unlocking lead | Gil lead |', '| --- | --- | --- | --- | --- |');
  RANKS.forEach((rank) => {
    const cl = subs.filter((s) => s.rank === rank).map((s) => s.cls);
    L.push('| ' + rank + ' | ' + cl.join(', ') + ' | ' + lead(rank, 'levelling') + ' | ' + lead(rank, 'unlocking') + ' | ' + (lead(rank, 'gil') || 'not run') + ' |');
  });
  L.push('');
  L.push('## The fuel allowance', '');
  L.push('For each allowance g the top priority may give up (fuel efficiency on), over the ' + R.count + ' scenarios:', '');
  L.push('- `L(g)`: mean share of the top priority\'s per-hour score given up, against fuel off, in percent.');
  L.push('- `E(g)`: mean gain in the top priority\'s amount per tank, against fuel off, in percent.', '');
  L.push('| g (%) | L(g) | E(g) | step cost (L) | step gain (E) | step pays (E gain >= L cost) | scenarios whose route changed |', '| --- | --- | --- | --- | --- | --- | --- |');
  R.table.forEach((t, i) => {
    L.push(i === 0 ? '| 0 (fuel off) | 0.00 | 0.00 | | | | |' : '| ' + t.g + ' | ' + f2(t.L) + ' | ' + f2(t.E) + ' | ' + f2(t.dL) + ' | ' + f2(t.dE) + ' | ' + (t.pays ? 'yes' : 'no') + ' | ' + t.changed + ' |');
  });
  L.push('');
  L.push('**The rule, in one sentence:** the default allowance is the largest g up to which every step of 5 points bought at least as much extra gain per tank as it cost in lost per-hour score (`E(g) - E(g-5) >= L(g) - L(g-5)`, with fuel off as `E = L = 0`).', '');
  L.push('**Chosen numbers**', '');
  if (R.chosen !== null) L.push('- Fuel allowance (`RECS.GIVE_UP`): **' + R.chosen + '%** (the first step that does not pay is ' + R.table[R.knee].g + '%).' + (R.chosen === RECS.GIVE_UP ? ' This is the shipped value.' : ' The shipped value is ' + RECS.GIVE_UP + '% and is not changed by this run: the owner decides.'));
  else L.push('- Fuel allowance (`RECS.GIVE_UP`): no result from the rule: ' + R.verdict + '. The shipped value stays at ' + RECS.GIVE_UP + '% until the owner decides.');
  L.push('', 'The same rule on parts of the scenarios, to show where the answer comes from (first column: the scenarios used; "pays" lists the steps 5, 10, ... 50 in order):', '', '| Scenarios | Count | Result | Steps that pay |', '| --- | --- | --- | --- |');
  L.push('| all three | ' + R.count + ' | ' + (R.chosen === null ? 'none (' + R.verdict + ')' : R.chosen + '%') + ' | ' + R.table.slice(1).map((t) => (t.pays ? 'y' : 'n')).join(' ') + ' |');
  R.sets.forEach(([name, s]) => L.push('| ' + name + ' | ' + s.n + ' | ' + (s.chosen === null ? 'none (' + s.verdict + ')' : s.chosen + '%') + ' | ' + s.table.slice(1).map((t) => (t.pays ? 'y' : 'n')).join(' ') + ' |'));
  L.push('');
  L.push('- Band between priorities (`RECS.BAND`): 5%, fixed (' + (R.bandOk ? 'accepted' : 'NOT accepted') + ' by the table below).', '');
  L.push('## The band between priorities', '');
  L.push('Fuel off. The first priority is the scenario\'s lead (experience in a levelling scenario, new sectors in an unlocking one); the second is the other of the two (new sectors, or experience), in the scenarios where it can be live (' + R.band.used + ' of ' + R.count + '). Both columns are in percentage points of the best score any route reaches for that priority per hour; the gain is counted against a band of 0%.', '');
  L.push('| Band | Mean loss on the first priority | Mean gain on the second priority |', '| --- | --- | --- |');
  R.band.rows.forEach((r) => L.push('| ' + Math.round(r.band * 100) + '% | ' + f2(r.loss) + ' | ' + f2(r.gain) + ' |'));
  const b5 = R.band.rows.find((r) => r.band === 0.05);
  L.push('', 'Accepted at 5% when the second priority gains more than the first loses: ' + f2(b5.gain) + ' against ' + f2(b5.loss) + ', so ' + (R.bandOk ? 'accepted' : 'not accepted') + '.', '');
  // what the numbers above do and do not show, with this run's own figures
  const rows = R.table.slice(1), gap = (t) => t.E - t.L, last = rows[rows.length - 1];
  const stop = R.knee === null ? null : R.table[R.knee], atChosen = R.chosen === null ? null : R.table.find((t) => t.g === R.chosen);
  const later = stop ? rows.filter((t) => t.g > stop.g) : [], laterPay = later.filter((t) => t.pays);
  const growing = rows.every((t, i) => i === 0 || gap(t) >= gap(rows[i - 1]) || t.g <= (stop ? stop.g : 0));
  L.push('## What this does and does not show', '');
  if (stop) {
    L.push('- **' + (R.chosen === null ? 'The rule\'s first failing step' : R.chosen + '%') + ' is where the rule stops, not the best value.** It is the first allowance at which a 5-point step stops paying (the step to ' + stop.g + '%: gain ' + f2(stop.dE) + ' against cost ' + f2(stop.dL) + '). ' +
      laterPay.length + ' of the ' + later.length + ' steps after it pay again, and the gap between E and L ' + (growing ? 'keeps growing' : 'does not fall steadily') + ': ' + (atChosen ? f2(gap(atChosen)) + ' at ' + atChosen.g + '%, ' : '') + f2(gap(last)) + ' at ' + last.g + '% (the ' + last.g + '% row: L ' + f2(last.L) + ', E ' + f2(last.E) + ', route changed in ' + last.changed + ' of ' + R.count + ' scenarios). The table does not show which allowance is best; the rule only picks the first point where the gain falls short of the cost.');
  } else L.push('- No step failed to pay, so the table gives no stopping point.');
  L.push('- **E and L are different units.** E is a gain in the amount per ceruleum tank; L is the share of the top priority\'s per-hour score given up. Comparing them (`E gain >= L cost`) puts a tank and an hour of that score on one scale, and the data gives no exchange rate between them, so "pays" is only the rule\'s word.');
  L.push('- **The next-slot stage is never measured.** Every scenario has ' + SLOTS + ' slots unlocked, so the stage that looks for the sector granting the next submarine slot (U1) has nothing to do in any of them.');
  L.push('- **The 95% per-tank filter was not tuned.** After the allowance, only routes within 95% of the best gain per tank stay (spec 4.4); that 95% is fixed, and no other value was tried.');
  L.push('- **Loot is left out.** Which items a player picks cannot be derived from data, so there is no loot scenario. The tables describe experience, new sectors and estimated merchant gil.', '');
  L.push('## What was left out, and why', '');
  L.push('- **Gil, still left out:** market prices (the gil scenario uses merchant prices only), the player\'s own voyage log (none is made up), and the price of a ceruleum tank (not in the data, so fuel stays counted in tanks). The gil figure is an estimate: what the second item of a survey is, is not in the community records, and the thresholds are the community\'s reading.');
  L.push('- **Loot:** which items a player picks cannot be derived from data, so no loot scenario was run.');
  L.push('- Times are "calculated, not yet confirmed" and experience is a floor (see the data\'s notes), so the tables describe how the rule behaves on the data, not what the game pays.');
  L.push('- Searches above 8 visitable sectors in a sea return the best route found, not a proven best, exactly as in the advisor.', '');
  return L.join('\n');
}

module.exports = { run, render, fleet, scenarios };

if (require.main === module) {
  const R = run(), text = render(R);
  process.stdout.write(text + '\n');
  if (process.argv.indexOf('--write') >= 0) { fs.writeFileSync(DOC, text + '\n'); console.log('Wrote ' + path.relative(ROOT, DOC)); }
}
