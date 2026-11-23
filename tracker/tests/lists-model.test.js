'use strict';
// The permanent randomized model test of the Lists engine (docs/lists-spec.md, section 5, "Model test", part A).
// Random small game data (yields 1 to 5, several gil offers per item with different pack sizes and qualities, trades with one
// to three currencies, several recipes per item, loops of every kind), one owner with several lists and steps, wanted items
// with every combination of hq / coll / make, random ways, order and stock, and random sequences of way changes, crafts
// recorded, units bought, rows and steps finished, wanted items moved and removed and re-added, and lists reordered.
// Each of E1 to E19 is one test(). A failure prints the invariant, the seed, the case number and the shrunk case.
// The invariants are stated here by the test itself; the engine is never asked to check itself, except that the plain
// data readers (LISTS.way for an offer's text, LISTS.tree) are used where the spec defines them as the reference.
// Part B (tabs, the real CC.writeSection) is work item W3's; part C (devices, the real ET.threeWay, ET.applyMerge, ET.saveMerge) is W4's.
// Interpretations the model makes (the orchestrator confirms them; none weakens a spec invariant):
//   (1) "total to get, to craft or to trade" are the fields short, got, crafts and, for trade lines only, trades; the number of
//       purchases of a gil line can rise when a smaller pack becomes the cheaper offer (gil never rises), so it is not compared;
//   (2) E17 is checked for items that are not cut (a loop's lowest item is listed under Other, E14);
//   (3) an operation that cannot apply to the current state is skipped.
// Run: node tests/lists-model.test.js     Override: LISTS_MODEL_N (cases per seed), LISTS_MODEL_SEED (one seed).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require(path.join(__dirname, '..', 'command-center', 'src', 'lists', 'engine.js'));
const L = globalThis.LISTS;
require(path.join(__dirname, '..', 'src', 'core', 'save.js'));
const CC = globalThis.CC;
for (const f of ['model', 'codec', 'merge', 'storage']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
const ET = globalThis.ET;

const SEEDS = process.env.LISTS_MODEL_SEED ? [Number(process.env.LISTS_MODEL_SEED)] : [1, 2, 3];
const PER_SEED = Number(process.env.LISTS_MODEL_N || 1000);
const OPS_PER_CASE = 8;
const TIME_LIMIT_MS = 20000;

const clone = (x) => JSON.parse(JSON.stringify(x));
const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v));
const cdiv = (a, b) => (a <= 0 ? 0 : Math.ceil(a / b));
const QS = ['nq', 'hq', 'coll'];
const BYS = ['vendor', 'craft', 'gather', 'trade', 'market'];

// ---------------------------------------------------------------------------------------------------------------- random
function makeRnd(seed) { let s = seed >>> 0; return (n) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s >>> 4) % n; }; }

function genData(rnd) {
  const n = 8 + rnd(5), ids = [];
  for (let k = 0; k < n; k++) ids.push(10 + k);
  const items = { 1: ['Gil', 1, 0] }, recipes = {}, gather = {}, trades = {};
  let rid = 1000;
  const rec = (item, ing, y) => { recipes[rid] = [item, y, rnd(8), 1 + rnd(60), 0, ing, (rnd(3) ? 1 : 0) | (rnd(5) === 0 ? 8 : 0)]; rid++; };
  const pickAbove = (k, m) => { const cand = ids.slice(k + 1); const out = []; for (let i = 0; i < m && cand.length; i++) out.push(cand.splice(rnd(cand.length), 1)[0]); return out; };
  ids.forEach((id, k) => {
    items[id] = ['I' + id, (rnd(5) ? 1 : 0) | (rnd(3) ? 2 : 0) | (rnd(8) === 0 ? 4 : 0), 0];
    if (rnd(3)) for (let r = 0, nr = 1 + (rnd(3) === 0 ? 1 : 0); r < nr; r++) {
      const ing = pickAbove(k, 1 + rnd(3)).map((m) => [m, 1 + rnd(4)]);
      if (ing.length) rec(id, ing, [1, 1, 2, 3, 3, 4, 5][rnd(7)]);
    }
    if (rnd(3) === 0) gather[id] = [rnd(3), 1 + rnd(50), 'Z', rnd(6) === 0 ? [1, 5, 9] : 0, rnd(6) === 0 ? 120 : 0];
    const offers = [];
    if (rnd(3) === 0) for (let o = 0, no = 1 + rnd(3); o < no; o++) offers.push([[1, 1, 3, 5][rnd(4)], [[1, 10 + rnd(190)]], rnd(4) === 0 ? 1 : 0, 0, 100 + rnd(50)]);
    if (rnd(4) === 0) for (let o = 0, no = 1 + rnd(2); o < no; o++) {
      const cs = pickAbove(k, 1 + rnd(3)).map((m) => [m, 1 + rnd(5)]);
      if (rnd(3) === 0) cs.push([1, 10 * (1 + rnd(5))]);
      if (cs.length) offers.push([1 + rnd(3), cs, rnd(5) === 0 ? 1 : 0, 0, 100 + rnd(50)]);
    }
    if (offers.length) trades[id] = offers;
  });
  // loops: a self-loop, two crafts, two trades, a craft and a trade
  const loop = rnd(4) === 0 ? rnd(4) : -1;
  if (loop >= 0) {
    const a = ids[rnd(n - 1)], b = ids[Math.min(n - 1, ids.indexOf(a) + 1 + rnd(2))];
    const strip = (x) => { for (const r of Object.keys(recipes)) if (recipes[r][0] === x) delete recipes[r]; delete gather[x]; delete trades[x]; };
    if (loop === 0) rec(a, [[a, 1 + rnd(2)]], 1);
    else if (loop === 1 && a !== b) { rec(a, [[b, 1]], 1); rec(b, [[a, 1]], 1); }
    else if (loop === 2 && a !== b) { strip(a); strip(b); trades[a] = [[1, [[b, 1 + rnd(3)]], 0, 0, 150]]; trades[b] = [[1, [[a, 1 + rnd(3)]], 0, 0, 151]]; }
    else if (loop === 3 && a !== b) { strip(b); rec(a, [[b, 1]], 1); trades[b] = [[1, [[a, 2]], 0, 0, 152]]; }
  }
  return { stamp: 'model', items, recipes, gather, trades, npcs: {}, changes: [] };
}

function offerKey(o) { return o[4] + '.' + o[0] + '.' + o[1][0][0]; }

function genState(rnd) {
  const data = genData(rnd), ids = Object.keys(data.items).map(Number).filter((x) => x !== 1), n = ids.length;
  const pickItem = () => ids[Math.min(rnd(n), rnd(n))];
  const recipesOf = (item) => Object.keys(data.recipes).filter((r) => data.recipes[r][0] === item).map(Number);
  let order = 'vendor craft gather trade market';
  const defaultOrder = rnd(10) < 4;
  if (!defaultOrder) { const a = BYS.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } order = a.join(' '); }
  const ways = {};
  if (rnd(2)) for (let i = 0, nw = 1 + rnd(4); i < nw; i++) {
    const item = pickItem(), w = {}, by = ['vendor', 'craft', 'gather', 'trade', 'market', 'have', 'have', undefined][rnd(8)];
    if (by) w.by = by;
    const rs = recipesOf(item);
    if (rs.length && rnd(3) === 0) w.recipe = rs[rnd(rs.length)];
    if (rnd(5) === 0) w.recipe = 999;
    if (rnd(3) === 0) w.hq = true;
    if ((data.trades[item] || []).length && rnd(3) === 0) w.offer = offerKey(data.trades[item][rnd(data.trades[item].length)]);
    if (Object.keys(w).length) ways[item] = w;
  }
  const have = {};
  for (const id of ids) if (rnd(10) < 4) {
    const e = { nq: rnd(7), hq: rnd(3) === 0 ? rnd(5) : 0, coll: rnd(5) === 0 ? rnd(4) : 0 };
    if (e.nq || e.hq || e.coll) have[id] = e;
  }
  const lists = [];
  let tid = 0;
  for (let li = 0, nl = 1 + rnd(3); li < nl; li++) {
    const steps = {}, ns = rnd(4);
    for (let s = 0; s < ns; s++) steps['s' + (s + 1)] = { name: 'S', n: rnd(3) };
    const targets = [];
    for (let t = 0, nt = 1 + rnd(4); t < nt; t++) {
      const item = pickItem(), rs = recipesOf(item), qty = 1 + rnd(9), make = rnd(4) === 0;
      const tg = { id: 't' + (++tid), item, recipe: rs.length && rnd(2) ? rs[rnd(rs.length)] : 0, qty };
      if (rnd(4) === 0) tg.hq = true;
      if (rnd(6) === 0) tg.coll = true;
      if (make) { tg.make = true; if (rnd(2)) tg.crafted = rnd(qty + 1); }
      const sk = Object.keys(steps);
      if (sk.length && rnd(3)) tg.step = rnd(8) === 0 ? 'gone' : sk[rnd(sk.length)];
      if (rnd(12) === 0) tg.done = true;
      targets.push(tg);
    }
    lists.push({ id: 'L' + (li + 1), steps, targets });
  }
  let prices = null;
  if (rnd(2)) { prices = {}; for (const id of ids) if (rnd(2)) prices[id] = [0, 5, 20, 100, 500][rnd(5)]; }
  return { data, order, ways, have, prices, lists };
}

function genCase(seed, i) {
  const rnd = makeRnd(seed * 100003 + i * 7919 + 11), init = genState(rnd), ops = [];
  for (let k = 0; k < OPS_PER_CASE; k++) ops.push({ kind: OPS[rnd(OPS.length)], n: [rnd(100000), rnd(100000), rnd(100000), rnd(100000)] });
  return { init, ops };
}

// ---------------------------------------------------------------------------------------------------------------- helpers
const toInput = (S) => ({ order: S.order, ways: S.ways, have: S.have, prices: S.prices, lists: S.lists });
const planOf = (S) => L.plan(S.data, toInput(S));
const liveTargets = (S) => { const out = []; S.lists.forEach((l, li) => l.targets.forEach((t, ti) => { if (!t.done) out.push({ l, li, t, ti }); })); return out; };
const keyOfT = (l, t) => l.id + '.' + t.id;
const targetMap = (S) => { const m = {}; for (const l of S.lists) for (const t of l.targets) m[keyOfT(l, t)] = t; return m; };
const stepIdsOf = (l) => Object.keys(l.steps).sort((a, b) => (l.steps[a].n - l.steps[b].n) || (a < b ? -1 : 1));
const stepOfT = (l, t) => { const ids = stepIdsOf(l); return t.step != null && ids.includes(t.step) ? t.step : (ids[0] || ''); };
function recipeOracle(S, t) {
  const r = S.data.recipes[t.recipe];
  if (t.recipe && r && r[0] === t.item) return t.recipe;
  const rs = Object.keys(S.data.recipes).map(Number).filter((x) => S.data.recipes[x][0] === t.item).sort((a, b) => S.data.recipes[a][3] - S.data.recipes[b][3] || a - b);
  return rs[0] || 0;
}
function partOracle(S, t) {
  const rid = recipeOracle(S, t), fl = S.data.items[t.item] ? S.data.items[t.item][1] : 0;
  if (t.make && rid) return { part: 'make', recipe: rid };
  if (t.coll && ((rid && (S.data.recipes[rid][6] & 8)) || (fl & 4))) return { part: 'coll', recipe: rid };
  return { part: t.hq ? 'hq' : 'normal', recipe: 0 };
}
const FIELDS = ['short', 'got', 'crafts', 'outside'];
function risen(p1, p2, skip) { // the first total of p2 that is higher than in p1, or null
  for (const key of Object.keys(p2.lines)) {
    const b = p2.lines[key], a = p1.lines[key] || {};
    if (skip && skip(b)) continue;
    for (const f of FIELDS) if ((b[f] || 0) > (a[f] || 0)) return key + ' ' + f + ' ' + (a[f] || 0) + ' -> ' + b[f];
    if (b.by === 'trade' && (b.trades || 0) > (a.by === 'trade' ? a.trades || 0 : 0)) return key + ' trades ' + (a.trades || 0) + ' -> ' + b.trades;
  }
  return null;
}
const sumFrom = (plan, item) => { const s = { nq: 0, hq: 0, coll: 0 }; for (const k of plan.items[item] || []) for (const q of QS) s[q] += plan.lines[k].from[q]; return s; };

// ---------------------------------------------------------------------------------------------------------------- the invariants on one plan
function checkBase(S, P, flag) {
  const data = S.data, lines = P.lines, live = liveTargets(S);
  // E1 (the input unchanged is checked by the caller); a second plan from the same input is equal
  const P2 = planOf(S);
  if (canon(P2) !== canon(P)) flag('E1', 'two plans of the same input differ');
  // E2, E16: per line, and per item and quality
  for (const key of Object.keys(lines)) {
    const ln = lines[key], made = ln.got + ln.makes;
    if (ln.given + made + ln.outside !== ln.need + ln.spare) flag('E2', key + ': given ' + ln.given + ' + got ' + made + ' + outside ' + ln.outside + ' != need ' + ln.need + ' + spare ' + ln.spare);
    if (ln.spare < 0 || ln.short !== ln.need - ln.given) flag('E2', key + ': short or spare wrong');
    if ((ln.from.nq + ln.from.hq + ln.from.coll) !== ln.given) flag('E2', key + ': stock by quality does not add up to given');
    if (ln.spare !== (P.spare[key] || 0)) flag('E2', key + ': plan.spare disagrees');
  }
  for (const item of new Set([...Object.keys(S.have), ...Object.keys(P.items)])) {
    const typed = S.have[item] || { nq: 0, hq: 0, coll: 0 }, g = sumFrom(P, item), lf = (P.left[item] || { nq: 0, hq: 0, coll: 0 });
    for (const q of QS) {
      if (g[q] + lf[q] !== typed[q]) flag('E2', 'item ' + item + ' ' + q + ': given ' + g[q] + ' + left ' + lf[q] + ' != typed ' + typed[q]);
      if (g[q] > typed[q]) flag('E16', 'item ' + item + ' ' + q + ': ' + g[q] + ' given of ' + typed[q] + ' typed');
    }
  }
  // E16: shares of stock add up; E9 (second half): shares add up to every total
  const acc = {};
  for (const s of P.shares) for (const [key, v] of Object.entries(s.lines)) {
    const a = acc[key] = acc[key] || { need: 0, given: 0, outside: 0, short: 0, crafts: 0, trades: 0, got: 0, makes: 0, cost: 0, from: { nq: 0, hq: 0, coll: 0 } };
    for (const f of ['need', 'given', 'outside', 'short', 'crafts', 'trades', 'got', 'makes', 'cost']) a[f] += v[f];
    for (const q of QS) a.from[q] += v.from[q];
  }
  for (const key of Object.keys(lines)) {
    const ln = lines[key], a = acc[key];
    if (!a) { flag('E9', key + ' has no share'); continue; }
    for (const f of ['need', 'given', 'outside', 'short', 'crafts', 'trades', 'got', 'makes']) if (a[f] !== ln[f]) flag('E9', key + ': shares add up to ' + a[f] + ' for ' + f + ', total ' + ln[f]);
    if (ln.cost !== null && a.cost !== ln.cost) flag('E9', key + ': shares of cost add up to ' + a.cost + ', total ' + ln.cost);
    for (const q of QS) if (a.from[q] !== ln.from[q]) flag('E16', key + ': shares of ' + q + ' stock add up to ' + a.from[q] + ', given ' + ln.from[q]);
  }
  for (const key of Object.keys(acc)) if (!lines[key]) flag('E9', 'a share names a line that is not in the plan: ' + key);
  // E3: rounding up
  for (const [key, ln] of Object.entries(lines)) {
    if (ln.by === 'craft') {
      if (ln.crafts !== cdiv(ln.short, ln.yield) || ln.makes - ln.short < 0 || ln.makes - ln.short >= ln.yield) flag('E3', key + ': crafts ' + ln.crafts + ' for ' + ln.short + ' at yield ' + ln.yield);
    } else if (ln.by === 'vendor' || ln.by === 'trade') {
      if (ln.trades !== cdiv(ln.short, ln.offer.gives) || ln.got - ln.short < 0 || (ln.short > 0 && ln.got - ln.short >= ln.offer.gives)) flag('E3', key + ': purchases ' + ln.trades + ' for ' + ln.short + ' at ' + ln.offer.gives);
    } else if (ln.crafts || ln.trades || ln.makes) flag('E3', key + ': crafts or purchases on a ' + ln.by + ' line');
  }
  // E6, E7: parts and qualities
  const direct = {};
  for (const { t } of live) {
    if (!(t.qty >= 1)) continue;
    const po = partOracle(S, t), key = t.item + '|' + po.part + '|' + po.recipe, crafted = Math.min(t.crafted || 0, t.qty), n = po.part === 'make' ? t.qty - crafted : t.qty;
    if (n > 0) direct[key] = (direct[key] || 0) + n;
    if (n > 0 && !lines[key]) flag('E6', 'wanted item ' + t.item + ' counts in part ' + po.part + ' but there is no line ' + key);
  }
  for (const [key, ln] of Object.entries(lines)) {
    if (ln.part === 'hq') {
      if (ln.from.nq || ln.from.coll) flag('E6', key + ': a high-quality need was given other stock');
      if ((ln.by === 'vendor' || ln.by === 'trade') && !ln.offer.hq) flag('E6', key + ': a high-quality need goes to an offer without the quality');
      if (ln.by === 'gather') flag('E6', key + ': a high-quality need is gathered');
      if (ln.by === 'craft' && !(data.recipes[ln.recipe][6] & 1)) flag('E6', key + ': a high-quality need is crafted from a recipe that cannot be high quality');
    }
    if (ln.part === 'normal' && (ln.by === 'vendor' || ln.by === 'trade') && ln.offer.hq) flag('E6', key + ': an ordinary need goes to a high-quality offer');
    if (ln.part === 'normal' && ln.from.coll) flag('E7', key + ': a normal need was given collectable stock');
    if (ln.part === 'coll') {
      if (ln.from.nq || ln.from.hq) flag('E7', key + ': a collectable need was given other stock');
      if (ln.by !== 'craft' && !(ln.by === 'other')) flag('E7', key + ': a collectable need is met by ' + ln.by);
    }
    if (ln.part === 'make' && (ln.given || (ln.by !== 'craft' && ln.by !== 'other'))) flag('E6', key + ': a must-craft line was given stock or not crafted');
  }
  // E17 (second half) and E8 and E11: every need comes from a wanted item, a craft or a trade; the exact accounting
  const expect = Object.assign({}, direct);
  let gilVendor = 0, gilMarket = 0; const unknown = [];
  const price = (id) => { const p = S.prices && S.prices[id]; return Number.isInteger(p) && p > 0 ? p : null; };
  for (const [key, ln] of Object.entries(lines)) {
    if (ln.by === 'craft') for (const [m, a] of data.recipes[ln.recipe][5]) { const k2 = m + '|' + (S.ways[m] && S.ways[m].hq ? 'hq' : 'normal') + '|0'; expect[k2] = (expect[k2] || 0) + ln.crafts * a; }
    if (ln.by === 'trade') for (const [c, a] of ln.offer.cur) { if (c === 1) gilVendor += ln.trades * a; else { const k2 = c + '|normal|0'; expect[k2] = (expect[k2] || 0) + ln.trades * a; } }
    if (ln.by === 'vendor') gilVendor += ln.trades * ln.offer.cur[0][1];
    if (ln.by === 'market' && ln.short > 0) { if (price(ln.item)) gilMarket += ln.short * price(ln.item); else unknown.push(ln.item); }
    if (ln.by === 'have' && (ln.outside !== ln.short || ln.crafts || ln.trades || ln.got || ln.makes)) flag('E11', key + ': a have line gets, crafts or trades');
    if (ln.by === 'have' && ln.short > 0 && !P.shop.outside.includes(key)) flag('E11', key + ': not in shop.outside');
  }
  for (const key of new Set([...Object.keys(expect), ...Object.keys(lines)])) if ((expect[key] || 0) !== (lines[key] ? lines[key].need : 0)) flag('E17', key + ': need ' + (lines[key] ? lines[key].need : 0) + ', the wanted items, crafts and trades give ' + (expect[key] || 0));
  // E8: the offer is the one the rule or the stored choice names; gil offers cost least
  for (const [key, ln] of Object.entries(lines)) {
    if (ln.by === 'trade') {
      const q = ln.part === 'hq' ? 1 : 0, offs = (data.trades[ln.item] || []).filter((o) => (o[2] ? 1 : 0) === q && !(o[1].length === 1 && o[1][0][0] === 1));
      let want = offs.find((o) => S.ways[ln.item] && S.ways[ln.item].offer === offerKey(o));
      if (!want) want = offs.reduce((b, o) => { if (!b) return o; const x = o[1][0][1] * b[0], y = b[1][0][1] * o[0]; return (o[1].length < b[1].length || (o[1].length === b[1].length && (x < y || (x === y && (o[1][0][0] < b[1][0][0] || (o[1][0][0] === b[1][0][0] && o[4] < b[4])))))) ? o : b; }, null);
      if (!want || ln.offer.key !== offerKey(want)) flag('E8', key + ': offer ' + ln.offer.key + ', the rule names ' + (want && offerKey(want)));
    }
    if (ln.by === 'vendor') {
      const q = ln.part === 'hq' ? 1 : 0, offs = (data.trades[ln.item] || []).filter((o) => (o[2] ? 1 : 0) === q && o[1].length === 1 && o[1][0][0] === 1);
      const cost = (o) => cdiv(ln.short, o[0]) * o[1][0][1], mine = offs.find((o) => o[0] === ln.offer.gives && o[1][0][1] === ln.offer.cur[0][1] && o[4] === ln.offer.npc);
      if (!mine || offs.some((o) => cost(o) < cost(mine))) flag('E8', key + ': a cheaper gil offer exists');
    }
  }
  // E15: gil
  if (P.gil.vendor !== gilVendor || P.gil.market !== gilMarket || canon(P.gil.unknown) !== canon(unknown.sort((a, b) => a - b))) flag('E15', 'gil ' + canon(P.gil) + ', expected ' + gilVendor + '/' + gilMarket + '/' + canon(unknown));
  for (const [key, ln] of Object.entries(lines)) if (ln.by === 'market' && ln.short > 0 && !price(ln.item) && ln.cost !== null) flag('E15', key + ': an unpriced item has a cost');
  // E10: the crafting order
  const pos = {}, blocks = P.order; let at = 0;
  for (let b = 0; b < blocks.length; b++) {
    if (b && blocks[b].job === blocks[b - 1].job) flag('E10', 'two neighbouring blocks of job ' + blocks[b].job);
    for (const key of blocks[b].crafts) { if (lines[key].job !== blocks[b].job) flag('E10', key + ' is in a block of another job'); if (pos[key] !== undefined) flag('E10', key + ' twice'); pos[key] = at++; }
  }
  for (const [key, ln] of Object.entries(lines)) if (ln.by === 'craft' && ln.crafts > 0) {
    if (pos[key] === undefined) { flag('E10', key + ' is not in the order'); continue; }
    for (const [m] of data.recipes[ln.recipe][5]) for (const k2 of P.items[m] || []) if (lines[k2].by === 'craft' && lines[k2].crafts > 0 && !(pos[k2] < pos[key])) flag('E10', key + ' comes before ' + k2 + ', which makes its material');
  }
  if (Object.keys(pos).length !== at) flag('E10', 'a craft is in the order twice');
  // E14: loops, the cut is the lowest item and is the same whatever the stock and wanted items
  const oc = cutOracle(S, P);
  const cutKeys = Object.keys(P.cut).map(Number).sort((a, b) => a - b);
  if (canon(cutKeys) !== canon(oc)) flag('E14', 'cut ' + canon(cutKeys) + ', the loop search gives ' + canon(oc));
  for (const c of cutKeys) for (const k2 of P.items[c] || []) {
    const ln = lines[k2], w = ln.part === 'make' || ln.part === 'coll' ? { by: 'craft' } : L.way(data, toInput(S), c, ln.part === 'hq' ? 'hq' : 'normal');
    if (ln.by === 'craft' || ln.by === 'trade' || ln.crafts) flag('E14', 'cut item ' + c + ' still passes needs down');
    if ((w.by === 'craft' || w.by === 'trade') && (ln.by !== 'other' || (ln.short > 0 && P.shop.other.indexOf(k2) < 0))) flag('E14', 'cut item ' + c + ' part ' + ln.part + ' is not listed under other');
    if (w.by !== 'craft' && w.by !== 'trade' && ln.by !== w.by) flag('E14', 'cut item ' + c + ' part ' + ln.part + ' is not planned by its way (' + w.by + ')');
  }
  const alone = L.cuts(data, toInput(S)), reachAll = L.cuts(data, { order: S.order, ways: S.ways, have: {}, lists: [{ id: 'x', steps: {}, targets: liveTargets(S).map((x) => ({ id: x.t.id, item: x.t.item, qty: 1 })) }] });
  if (canon(Object.keys(alone).sort()) !== canon(Object.keys(reachAll).sort())) flag('E14', 'the cut depends on amounts or stock');
  if (canon(Object.keys(alone).sort()) !== canon(Object.keys(P.cut).sort())) flag('E14', 'LISTS.cuts and the plan disagree');
  // E17 (first half): with the default order and no stored way, a gil merchant's item is bought
  if (S.order === 'vendor craft gather trade market' && !Object.keys(S.ways).length) {
    for (const [key, ln] of Object.entries(lines)) {
      if (ln.part !== 'normal' && ln.part !== 'hq') continue;
      const q = ln.part === 'hq' ? 1 : 0, has = (data.trades[ln.item] || []).some((o) => (o[2] ? 1 : 0) === q && o[1].length === 1 && o[1][0][0] === 1);
      if (has && ln.by !== 'vendor') flag('E17', key + ' is got by ' + ln.by + ', a gil merchant sells it');
    }
  }
}

// the loops, brute force: reachability on the edges the spec names, the lowest item of every loop cut, repeated; only items reachable
function cutOracle(S, P) {
  const data = S.data, roots = [...new Set(liveTargets(S).map((x) => x.t.item))], edges = {};
  const get = (item) => {
    if (edges[item]) return edges[item];
    const set = new Set();
    for (const r of Object.keys(data.recipes)) if (data.recipes[r][0] === item) for (const [m] of data.recipes[r][5]) set.add(m);
    for (const q of ['normal', 'hq']) { const w = L.way(data, toInput(S), item, q); if (w.by === 'trade') { const o = (data.trades[item] || []).find((x) => offerKey(x) === w.offer); if (o) for (const [c] of o[1]) if (c !== 1) set.add(c); } }
    return (edges[item] = [...set]);
  };
  const nodes = new Set(), stack = roots.slice();
  while (stack.length) { const v = stack.pop(); if (nodes.has(v)) continue; nodes.add(v); for (const w of get(v)) stack.push(w); }
  const cut = new Set(), list = [...nodes];
  for (;;) {
    const out = (v) => (cut.has(v) ? [] : get(v)), reach = {};
    for (const s of list) { const seen = new Set(), st = out(s).slice(); while (st.length) { const v = st.pop(); if (seen.has(v)) continue; seen.add(v); for (const w of out(v)) st.push(w); } reach[s] = seen; }
    const loops = new Map();
    for (const s of list) if (reach[s].has(s)) { const comp = list.filter((x) => reach[s].has(x) && reach[x].has(s)); comp.push(s); loops.set(Math.min(...comp), 1); }
    if (!loops.size) break;
    for (const c of loops.keys()) cut.add(c);
  }
  return [...cut].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------------------------------------------- operations and their checks
const OPS = ['raise', 'raise', 'remove', 'remove', 'lower', 'add', 'move', 'move', 'reorder', 'readd', 'way', 'order', 'record', 'record', 'record', 'bought', 'bought', 'finishRow', 'finishStep', 'finishStep', 'waySwitch', 'waySwitch', 'waySwitch'];
const stateOf = (S) => ({ have: S.have, targets: targetMap(S), ways: S.ways });

// Applies one operation to S (a clone is returned) and checks what the operation promises; returns the new state or null (a no-op).
function applyOp(S, op, flag, trace) {
  const n = op.n, P1 = planOf(S), live = liveTargets(S), S2 = clone(S);
  const items = Object.keys(S.data.items).map(Number).filter((x) => x !== 1);
  const note = (s) => trace.push(s);
  switch (op.kind) {
    case 'raise': { // E4
      const item = items[n[0] % items.length], q = QS[n[1] % 3], by = 1 + (n[2] % 5);
      S2.have[item] = S2.have[item] || { nq: 0, hq: 0, coll: 0 }; S2.have[item][q] += by;
      note('raise ' + item + ' ' + q + ' +' + by);
      const r = risen(P1, planOf(S2)); if (r) flag('E4', 'stock raised: ' + r);
      return S2;
    }
    case 'remove': case 'lower': { // E5
      if (!live.length) return null;
      const x = live[n[0] % live.length], t = S2.lists[x.li].targets[x.ti];
      if (op.kind === 'remove') { S2.lists[x.li].targets.splice(x.ti, 1); note('remove ' + keyOfT(x.l, x.t)); }
      else { if (t.qty < 2) return null; t.qty = 1 + (n[1] % (t.qty - 1)); note('lower ' + keyOfT(x.l, x.t) + ' to ' + t.qty); }
      const r = risen(P1, planOf(S2)); if (r) flag('E5', op.kind + ' of a wanted item: ' + r);
      return S2;
    }
    case 'add': {
      const l = S2.lists[n[0] % S2.lists.length], item = items[n[1] % items.length];
      l.targets.push({ id: 'n' + n[3], item, recipe: 0, qty: 1 + (n[2] % 6) }); note('add ' + item + ' to ' + l.id);
      return S2;
    }
    case 'move': { // E9
      if (!live.length) return null;
      const x = live[n[0] % live.length], to = S2.lists[n[1] % S2.lists.length], t = S2.lists[x.li].targets.splice(x.ti, 1)[0], sk = Object.keys(to.steps);
      if (sk.length && n[2] % 3) t.step = sk[n[2] % sk.length]; else delete t.step;
      to.targets.push(t); note('move ' + keyOfT(x.l, x.t) + ' to ' + to.id + ' step ' + t.step);
      if (canon(planOf(S2).lines) !== canon(P1.lines)) flag('E9', 'moving a wanted item changed a total');
      return S2;
    }
    case 'reorder': { // E9
      if (S2.lists.length < 2) return null;
      const a = n[0] % S2.lists.length, b = (a + 1 + (n[1] % (S2.lists.length - 1))) % S2.lists.length;
      [S2.lists[a], S2.lists[b]] = [S2.lists[b], S2.lists[a]]; note('reorder lists ' + a + ' and ' + b);
      if (canon(planOf(S2).lines) !== canon(P1.lines)) flag('E9', 'reordering lists changed a total');
      return S2;
    }
    case 'readd': { // E13
      if (!live.length) return null;
      const x = live[n[0] % live.length], t = S2.lists[x.li].targets[x.ti], copy = clone(t);
      S2.lists[x.li].targets.splice(x.ti, 1); copy.id = 'r' + n[1]; S2.lists[x.li].targets.push(copy);
      note('remove and add back ' + keyOfT(x.l, x.t));
      if (canon(planOf(S2).lines) !== canon(P1.lines)) flag('E13', 'removing a wanted item and adding an equal one back changed a total');
      return S2;
    }
    case 'way': {
      const item = items[n[0] % items.length], w = {}, by = [...BYS, 'have', undefined][n[1] % 7];
      if (by) w.by = by; if (n[2] % 3 === 0) w.hq = true;
      const rs = Object.keys(S.data.recipes).map(Number).filter((r) => S.data.recipes[r][0] === item);
      if (rs.length && n[3] % 3 === 0) w.recipe = rs[n[3] % rs.length];
      const tr = S.data.trades[item] || []; if (tr.length && n[3] % 5 === 0) w.offer = offerKey(tr[n[3] % tr.length]);
      if (Object.keys(w).length) S2.ways[item] = w; else delete S2.ways[item];
      note('way ' + item + ' ' + canon(S2.ways[item]));
      return S2;
    }
    case 'order': {
      const a = BYS.slice(); for (let i = a.length - 1, r = n[0]; i > 0; i--, r = Math.floor(r / 3) + n[1]) { const j = r % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      S2.order = a.join(' '); note('order ' + S2.order);
      return S2;
    }
    case 'record': return recordOp(S, S2, P1, n, flag, note);
    case 'bought': { // E18 (a) with LISTS.bought
      const cands = Object.keys(P1.lines).filter((k) => P1.lines[k].short > 0 && !(P1.lines[k].by === 'have'));
      if (!cands.length) return null;
      const key = cands[n[0] % cands.length], ln = P1.lines[key], units = 1 + (n[1] % (ln.short + 2));
      S2.have = L.bought(S.have, ln.item, units, ln.quality); note('bought ' + units + ' of ' + key);
      for (const id of new Set([...Object.keys(S.have), ...Object.keys(S2.have)])) {
        const a = S.have[id] || { nq: 0, hq: 0, coll: 0 }, b = S2.have[id] || { nq: 0, hq: 0, coll: 0 };
        for (const q of QS) { const want = a[q] + (id == ln.item && q === ln.quality ? units : 0); if (b[q] !== want) flag('E18', 'bought changed stock of ' + id + ' ' + q + ' to ' + b[q] + ', expected ' + want); }
      }
      const P2 = planOf(S2), r1 = risenCrafts(P1, P2); if (r1) flag('E18', 'bought: a total to craft rose: ' + r1);
      const r2 = risen(P1, P2, (b) => b.item === ln.item && false); if (r2) flag('E18', 'bought: ' + r2);
      return S2;
    }
    case 'finishRow': { // E19, a row's Finished
      if (!live.length) return null;
      const x = live[n[0] % live.length]; S2.lists[x.li].targets[x.ti].done = true; note('finish row ' + keyOfT(x.l, x.t));
      const r = risen(P1, planOf(S2)); if (r) flag('E19', 'a row finished: ' + r);
      return S2;
    }
    case 'finishStep': { // E19, a step handed in
      const l = S2.lists[n[0] % S2.lists.length], ids = stepIdsOf(l), step = ids.length ? ids[n[1] % ids.length] : '';
      const st = stateOf(S), res = L.finishStep(P1, st, l.id, step);
      note('finish step ' + l.id + '/' + step);
      // what the plan had given the wanted items of the step (the must-craft ones excepted)
      const take = {};
      for (const sh of P1.shares) if (sh.list === l.id && sh.step === step) for (const [key, v] of Object.entries(sh.lines)) for (const q of QS) { const k = P1.lines[key].item + '.' + q; take[k] = (take[k] || 0) + v.fromDirect[q]; }
      for (const id of new Set([...Object.keys(S.have), ...Object.keys(res.have)])) for (const q of QS) {
        const before = (S.have[id] || { nq: 0, hq: 0, coll: 0 })[q], after = (res.have[id] || { nq: 0, hq: 0, coll: 0 })[q];
        if (after !== before - (take[id + '.' + q] || 0)) flag('E19', 'step handed in: stock of ' + id + ' ' + q + ' is ' + after + ', expected ' + (before - (take[id + '.' + q] || 0)));
      }
      for (const [k, t] of Object.entries(targetMap(S))) {
        const want = t.done || (k.startsWith(l.id + '.') && stepOfT(l, t) === step) ? true : !!t.done;
        if (!!res.targets[k].done !== want) flag('E19', 'step handed in: ' + k + ' done is ' + !!res.targets[k].done);
        if (!k.startsWith(l.id + '.') && canon(res.targets[k]) !== canon(t)) flag('E19', 'step handed in changed a wanted item of another list');
      }
      S2.have = res.have; for (const sl of S2.lists) for (const t of sl.targets) t.done = res.targets[sl.id + '.' + t.id].done || undefined;
      for (const sl of S2.lists) for (const t of sl.targets) if (t.done === undefined) delete t.done;
      const r = risen(P1, planOf(S2)); if (r) flag('E19', 'a step handed in: ' + r);
      return S2;
    }
    case 'waySwitch': return switchOp(S, S2, P1, n, flag, note);
    default: return null;
  }
}

function risenCrafts(p1, p2) {
  for (const key of Object.keys(p2.lines)) if (p2.lines[key].crafts > (p1.lines[key] ? p1.lines[key].crafts : 0)) return key + ' ' + (p1.lines[key] ? p1.lines[key].crafts : 0) + ' -> ' + p2.lines[key].crafts;
  return null;
}

// E12: recording crafts
function recordOp(S, S2, P1, n, flag, note) {
  const cands = Object.keys(P1.lines).filter((k) => P1.lines[k].by === 'craft' && P1.lines[k].crafts > 0);
  if (!cands.length) return null;
  const key = cands[n[0] % cands.length], ln = P1.lines[key], times = 1 + (n[1] % (ln.crafts + 1)), own = ln.quality;
  const quality = n[3] % 4 === 0 ? QS[n[3] % 3] : own, data = S.data, r = data.recipes[ln.recipe];
  // credits: the line's own must-craft wanted items, in list then step order
  const credit = {};
  if (ln.part === 'make') {
    const rows = liveTargets(S).filter(({ t }) => { const po = partOracle(S, t); return po.part === 'make' && t.item === ln.item && po.recipe === ln.recipe; });
    rows.sort((a, b) => a.li - b.li || stepIdsOf(a.l).indexOf(stepOfT(a.l, a.t)) - stepIdsOf(b.l).indexOf(stepOfT(b.l, b.t)));
    let left = times * r[1];
    for (const { l, t } of rows) { const c = Math.min(left, t.qty - Math.min(t.crafted || 0, t.qty)); if (c > 0) { credit[keyOfT(l, t)] = c; left -= c; } }
  }
  const st = stateOf(S), res = L.record(data, st, P1, { line: ln, times, quality, targets: credit });
  note('record ' + times + ' of ' + key + ' in ' + quality + (canon(credit) !== '{}' ? ' credits ' + canon(credit) : ''));
  // (a)
  const made = times * r[1], expectShort = [];
  for (const id of new Set([...Object.keys(S.have), ...Object.keys(res.have)])) {
    const a = S.have[id] || { nq: 0, hq: 0, coll: 0 }, b = res.have[id] || { nq: 0, hq: 0, coll: 0 }, ing = r[5].find((x) => x[0] == id), exp = { nq: a.nq, hq: a.hq, coll: a.coll };
    if (ing) {
      // D27: the stock the plan gave this craft's own material line, then stock given to no line; never another line's
      const take = times * ing[1], hqOnly = !!(S.ways[id] && S.ways[id].hq), own = P1.lines[id + '|' + (hqOnly ? 'hq' : 'normal') + '|0'];
      const allGiven = sumFrom(P1, id), order = hqOnly ? ['hq'] : ['nq', 'hq'];
      let need = take;
      for (const qq of order) { const t = Math.min(need, own ? own.from[qq] : 0); exp[qq] -= t; need -= t; }
      for (const qq of order) { const t = Math.min(need, Math.max(0, a[qq] - allGiven[qq]), exp[qq]); exp[qq] -= t; need -= t; }
      if (need > 0) expectShort.push(Number(id));
    }
    if (id == ln.item) exp[quality] += made;
    for (const q of QS) if (b[q] !== exp[q]) flag('E12', 'record: stock of ' + id + ' ' + q + ' is ' + b[q] + ', expected ' + exp[q]);
  }
  for (const [ing] of r[5]) if (!(S.have[ing]) && !expectShort.includes(ing)) expectShort.push(ing);
  if (canon([...res.short].sort((a, b) => a - b)) !== canon([...new Set(expectShort)].sort((a, b) => a - b))) flag('E12', 'record: short ' + canon(res.short) + ', expected ' + canon(expectShort));
  let credited = 0;
  for (const [k, t] of Object.entries(targetMap(S))) {
    const b = res.targets[k], rise = (b.crafted || 0) - (t.crafted || 0);
    if (rise < 0 || (rise > 0 && !(k in credit)) || (b.crafted || 0) > t.qty && rise > 0) flag('E12', 'record: crafted of ' + k + ' went from ' + (t.crafted || 0) + ' to ' + (b.crafted || 0));
    if (rise > 0 && rise > (credit[k] || 0)) flag('E12', 'record: ' + k + ' credited more than named');
    credited += Math.max(0, rise);
    const same = { ...b }; if (rise) { if (t.crafted === undefined) delete same.crafted; else same.crafted = t.crafted; }
    if (canon(same) !== canon(t) && !(rise === 0 && canon(b) === canon(t))) flag('E12', 'record: another field of ' + k + ' changed');
  }
  if (credited > made) flag('E12', 'record: credits exceed what was made');
  S2.have = res.have; const tm = res.targets;
  for (const sl of S2.lists) for (const t of sl.targets) { const b = tm[sl.id + '.' + t.id]; if (b.crafted !== undefined) t.crafted = b.crafted; }
  // (b)
  if (!res.short.length && times <= ln.crafts && (quality === own || ln.part === 'make')) {
    const P2 = planOf(S2), after = P2.lines[key] ? P2.lines[key].crafts : 0;
    if (after !== ln.crafts - times) flag('E12', 'record: the line\'s crafts went from ' + ln.crafts + ' to ' + after + ' after recording ' + times);
    const r2 = risen(P1, P2); if (r2) flag('E12', 'record: ' + r2);
  }
  return S2;
}

// E18: changing the way of a crafted item
function switchOp(S, S2, P1, n, flag, note) {
  const cands = Object.keys(P1.lines).filter((k) => { const l = P1.lines[k]; return (l.part === 'normal' || l.part === 'hq') && l.by === 'craft'; });
  if (!cands.length) return null;
  const key = cands[n[0] % cands.length], ln = P1.lines[key], X = ln.item, q = ln.part === 'hq' ? 'hq' : 'normal';
  const to = ['vendor', 'market', 'have', 'trade'][n[1] % 4], old = S.ways[X];
  const trial = clone(S); trial.ways[X] = Object.assign({}, old || {}, { by: to }); delete trial.ways[X].offer;
  if (L.way(S.data, toInput(trial), X, q).by !== to) return null; // the select lists only the ways the row's quality has
  S2.ways[X] = trial.ways[X]; note('switch ' + X + ' from craft to ' + to + ' (' + q + ')');
  const P2 = planOf(S2);
  if (to !== 'trade') {
    const r1 = risenCrafts(P1, P2); if (r1) flag('E18', 'craft to ' + to + ': a total to craft rose: ' + r1);
    const r2 = risen(P1, P2, (b) => b.item === X); if (r2) flag('E18', 'craft to ' + to + ': ' + r2);
  } else {
    const cur = new Set(); for (const k of P2.items[X] || []) if (P2.lines[k].by === 'trade') for (const [c] of P2.lines[k].offer.cur) if (c !== 1) cur.add(c);
    const allowed = new Set(); for (const c of cur) for (const t of L.tree(S.data, [{ id: 'x', targets: [{ id: 1, item: c, qty: 1 }] }])) allowed.add(t);
    const r1 = risenCrafts(P1, P2); if (r1 && !allowed.has(P2.lines[r1.split(' ')[0]].item)) flag('E18', 'craft to trade: a total to craft rose outside the currencies: ' + r1);
    const r2 = risen(P1, P2, (b) => b.item === X || allowed.has(b.item)); if (r2) flag('E18', 'craft to trade: ' + r2);
  }
  if (to === 'vendor') for (const k of P2.items[X] || []) { const l2 = P2.lines[k]; if (l2.by === 'vendor' && l2.got - l2.short >= l2.offer.gives) flag('E18', 'vendor: more than one purchase over the shortfall'); }
  // (c) the way back, stock as it was
  const back = clone(S2); if (old) back.ways[X] = old; else delete back.ways[X];
  if (canon(planOf(back)) !== canon(P1)) flag('E18', 'changing the way back did not give the earlier plan again');
  // (c) after a purchase: no total is higher than before the first change
  const mine = Object.keys(P2.lines).filter((k) => P2.lines[k].short > 0 && P2.lines[k].by !== 'have');
  if (mine.length) {
    const l2 = P2.lines[mine[n[2] % mine.length]], units = 1 + (n[3] % (l2.short + 2)), bought = clone(S2); bought.have = L.bought(S2.have, l2.item, units, l2.quality);
    const b2 = clone(bought); if (old) b2.ways[X] = old; else delete b2.ways[X];
    const r3 = risen(P1, planOf(b2)); if (r3) flag('E18', 'way changed, units bought, way changed back: ' + r3);
  }
  return S2;
}

// ---------------------------------------------------------------------------------------------------------------- one case
function runCase(c) {
  const viol = [], seen = new Set(), trace = [];
  let at = 0;
  const flag = (inv, msg) => { if (!seen.has(inv)) { seen.add(inv); viol.push({ inv, msg, at }); } };
  let S = clone(c.init);
  const frozen = canon(S);
  try {
    const P = planOf(S); if (canon(S) !== frozen) flag('E1', 'the input was changed by a plan');
    checkBase(S, P, flag);
    for (at = 0; at < c.ops.length; at++) {
      const before = canon(S), next = applyOp(S, c.ops[at], flag, trace);
      if (canon(S) !== before) flag('E1', 'an operation changed its input state');
      if (!next) { trace.push(c.ops[at].kind + ' (no-op)'); continue; }
      S = next;
      const P2 = planOf(S); checkBase(S, P2, flag);
    }
  } catch (e) { flag('E1', 'threw ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
  return { viol, trace };
}

// ---------------------------------------------------------------------------------------------------------------- shrinker and sweep
function shrink(c, inv) {
  let cur = { init: clone(c.init), ops: c.ops.slice() };
  const fails = (x) => runCase(x).viol.some((v) => v.inv === inv);
  for (let progress = true; progress;) {
    progress = false;
    for (let k = 0; k < cur.ops.length; k++) { const cand = { init: cur.init, ops: cur.ops.filter((_, j) => j !== k) }; if (fails(cand)) { cur = cand; progress = true; k--; } }
    for (let li = 0; li < cur.init.lists.length; li++) for (let ti = 0; ti < cur.init.lists[li].targets.length; ti++) {
      const cand = { init: clone(cur.init), ops: cur.ops }; cand.init.lists[li].targets.splice(ti, 1);
      if (fails(cand)) { cur = cand; progress = true; ti--; }
    }
    for (let li = cur.init.lists.length - 1; li >= 0; li--) { const cand = { init: clone(cur.init), ops: cur.ops }; cand.init.lists.splice(li, 1); if (cand.init.lists.length && fails(cand)) { cur = cand; progress = true; } }
    for (const part of ['have', 'ways']) for (const id of Object.keys(cur.init[part])) { const cand = { init: clone(cur.init), ops: cur.ops }; delete cand.init[part][id]; if (fails(cand)) { cur = cand; progress = true; } }
    if (cur.init.prices) { const cand = { init: clone(cur.init), ops: cur.ops }; cand.init.prices = null; if (fails(cand)) { cur = cand; progress = true; } }
    for (const id of Object.keys(cur.init.data.recipes)) { const cand = { init: clone(cur.init), ops: cur.ops }; delete cand.init.data.recipes[id]; if (fails(cand)) { cur = cand; progress = true; } }
    for (const id of Object.keys(cur.init.data.trades)) { const cand = { init: clone(cur.init), ops: cur.ops }; delete cand.init.data.trades[id]; if (fails(cand)) { cur = cand; progress = true; } }
    for (const id of Object.keys(cur.init.data.gather)) { const cand = { init: clone(cur.init), ops: cur.ops }; delete cand.init.data.gather[id]; if (fails(cand)) { cur = cand; progress = true; } }
  }
  return cur;
}
const INVS = Array.from({ length: 19 }, (_, i) => 'E' + (i + 1));
let sweepRun = null;
function sweepAll() {
  if (sweepRun) return sweepRun;
  const t0 = Date.now(), out = { ran: 0, ms: 0, inv: {} };
  for (const inv of INVS) out.inv[inv] = { count: 0, first: null };
  for (const seed of SEEDS) for (let i = 0; i < PER_SEED; i++) {
    const c = genCase(seed, i), r = runCase(c); out.ran++;
    for (const v of r.viol) { const o = out.inv[v.inv] = out.inv[v.inv] || { count: 0, first: null }; o.count++; if (!o.first) o.first = { seed, i, c, msg: v.msg }; }
  }
  out.ms = Date.now() - t0;
  for (const inv of Object.keys(out.inv)) {
    const f = out.inv[inv].first; if (!f) continue;
    const small = shrink(f.c, inv), r = runCase(small), v = r.viol.find((x) => x.inv === inv);
    f.shrunk = small; f.shrunkMsg = v ? v.msg : f.msg; f.trace = r.trace.join('\n    ');
  }
  return (sweepRun = out);
}
function explain(inv, o) {
  const f = o.inv[inv].first, s = f.shrunk;
  return inv + ' failed in ' + o.inv[inv].count + ' of ' + o.ran + ' cases. First: seed ' + f.seed + ', case ' + f.i + '. ' + f.shrunkMsg + '\n  shrunk case: ' + s.ops.length + ' operation(s):\n    ' + f.trace
    + '\n  data ' + canon(s.init.data) + '\n  order ' + s.init.order + ' ways ' + canon(s.init.ways) + ' have ' + canon(s.init.have) + ' prices ' + canon(s.init.prices) + '\n  lists ' + canon(s.init.lists)
    + '\n  operations ' + canon(s.ops);
}

const TEXT = {
  E1: 'same input gives the same plan; the input is unchanged', E2: 'given + got or made + outside = need + spare; given stock + left = typed; spare and outside never given',
  E3: 'crafts and purchases are the shortfall divided by what one gives, rounded up', E4: 'raising any stock count never raises a total to get, to craft or to trade',
  E5: 'removing a wanted item or lowering its amount never raises a total', E6: 'a high-quality need is met by high-quality stock and sources only; each wanted item counts in one part',
  E7: 'a collectable wanted item is met by collectable stock or a craft', E8: 'a trade\'s real ratio, every currency charged, the offer fixed by the rule',
  E9: 'totals do not depend on lists or steps, and shares add up to the totals', E10: 'the crafting order is valid, one job per block, neighbours differ',
  E11: '"already have" is an outside supply, counted and named', E12: 'recording a craft (a) always, (b) when nothing was short and the crafts were shown',
  E13: 'removing a wanted item and adding an equal one back leaves every total equal', E14: 'every loop is cut at its lowest item, whatever the stock and the wanted items',
  E15: 'gil: priced items counted, unpriced named and never 0', E16: 'stock given never exceeds the stock typed, and its shares add up',
  E17: 'with the default order a gil merchant\'s item is bought; every need has a source', E18: 'changing how an item is got, and units bought',
  E19: 'Finished on a row and on a step'
};
for (const inv of INVS) test(inv + ' (engine) ' + TEXT[inv], () => { const o = sweepAll(); if (o.inv[inv].count) assert.fail(explain(inv, o)); });
test('the model ran the cases asked for, within the time limit', () => {
  const o = sweepAll();
  console.log('# lists model: ' + o.ran + ' cases of ' + OPS_PER_CASE + ' operations (seeds ' + SEEDS.join(',') + ') in ' + o.ms + ' ms');
  assert.equal(o.ran, SEEDS.length * PER_SEED);
  if (!process.env.LISTS_MODEL_N) assert.ok(o.ms < TIME_LIMIT_MS, 'took ' + o.ms + ' ms, the limit is ' + TIME_LIMIT_MS);
});


// =========================================================================================================== part B: tabs
// Three tabs of one device edit the Lists section through the real CC.writeSection, each with an undo stack (the conditional write,
// LI5). Every sequence: a seeded start, then 12 random steps (add, change, remove a list, a wanted item, a way, a count, an order, a
// preference; a refresh; an undo; a wipe of everything). The test states its invariants itself, over units (a list header, a wanted item,
// a way, an owner's order, a stock count, a preference):
//   LI1 nothing the stored copy lost comes back (a header; a wanted item whose list is stored);  LI2 no new wanted item without its list;
//   LI3 a unit the page did not change stays as stored has it, one it changed is as sent;  LI4 a unit another tab changed is not removed;
//   LI5 / E20 a write with `expect` is applied only if every named unit is exactly as expected, and then restores the earlier units;
//   REFUSED a refused write leaves the store byte-identical, with the spec's text;  ACCEPTED a write is refused if and only if a rule above
//   says so;  CHECKDOC the store passes CC.checkDoc unchanged;  GONE a unit missing afterwards was removed by the page that wrote;
//   FRAME an emptied section stays the whole frame;  BIG a store seeded above every size limit is kept whole by a write.
const B_INVS = ['LI1', 'LI2', 'LI3', 'LI4', 'LI5', 'E20', 'REFUSED', 'ACCEPTED', 'CHECKDOC', 'GONE', 'FRAME', 'BIG'];
const B_GROUPS = ['lists', 'targets', 'ways', 'owners', 'have', 'prefs'];
const B_STEPS = 12, B_TIME_LIMIT_MS = 20000;
const BJ = JSON.stringify;
const B_TEXT = { list: 'This list was removed on another device or in another tab.', item: 'This item was removed from the list on another device or in another tab.',
  kept: 'This was changed on another device or in another tab, so it was not removed.', since: 'This was changed on another device or in another tab since.' };
const bUnits = (sec) => { const m = new Map(); for (const g of B_GROUPS) for (const [k, v] of Object.entries((sec && sec[g]) || {})) m.set(g + '|' + k, BJ(v)); return m; };
const bExpectKey = (u) => { const i = u.indexOf('|'); return 'm|' + BJ(['lists', u.slice(0, i), u.slice(i + 1)]); };
const bStoredOf = (raw) => (raw && raw.modules && raw.modules.lists) || CC.checkLists({});
const bListOf = (u) => u.slice(u.indexOf('|') + 1).split('.')[0];
const bReset = () => { CC.resetMemory(); if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); } };
function bSetUnit(sec, u, text) { const i = u.indexOf('|'), g = u.slice(0, i), k = u.slice(i + 1); if (text === null) delete sec[g][k]; else sec[g][k] = JSON.parse(text); }

// what the rules say about one write, in the order the spec gives: LI2, LI1, LI4, LI5; returns { id, text } or null
function bOracle(B, sent, S, M, differs, expect) {
  const uB = bUnits(B), uL = bUnits(sent), uS = bUnits(S), uM = bUnits(M);
  for (const u of uM.keys()) if (u.startsWith('targets|') && !uM.has('lists|' + bListOf(u)) && !(uS.has(u) && !uS.has('lists|' + bListOf(u)))) return { id: 'LI2', text: B_TEXT.list };
  if (differs) {
    for (const [u, t] of uL) if (u.startsWith('targets|') && t !== uB.get(u) && uB.has('lists|' + bListOf(u)) && !uS.has('lists|' + bListOf(u))) return { id: 'LI2', text: B_TEXT.list };
    for (const u of uB.keys()) if (u.startsWith('lists|') && !uS.has(u) && uM.has(u)) return { id: 'LI1', text: B_TEXT.list };
    for (const u of uB.keys()) if (u.startsWith('targets|') && !uS.has(u) && uM.has(u) && uS.has('lists|' + bListOf(u))) return { id: 'LI1', text: B_TEXT.item };
    for (const [u, t] of uB) if (!uL.has(u) && uS.has(u) && uS.get(u) !== t) return { id: 'LI4', text: B_TEXT.kept };
  }
  if (expect) for (const [key, text] of Object.entries(expect)) {
    const u = [...new Set([...uS.keys(), ...Object.keys(expect).map(() => null)])].find((x) => x && bExpectKey(x) === key);
    const cur = u ? uS.get(u) : null;
    if (cur !== text) return { id: 'E20', text: B_TEXT.since };
  }
  return null;
}

const B_KINDS = ['addList', 'addList', 'addTarget', 'addTarget', 'addTarget', 'editTarget', 'editTarget', 'removeTarget', 'removeList', 'rename', 'setWay', 'removeWay', 'setHave', 'setHave', 'removeHave', 'setOrder', 'pref', 'refresh', 'undo', 'undo', 'undo', 'wipe'];
function bGenCase(seed, i) {
  const rnd = makeRnd(seed * 1000003 + i * 7919 + 17);
  const init = { lists: 1 + rnd(3), targets: rnd(5) }, ops = [];
  for (let k = 0; k < B_STEPS; k++) ops.push({ tab: rnd(3), k: rnd(B_KINDS.length), a: rnd(10000), b: rnd(10000), c: rnd(10000) });
  return { init, ops };
}
function bInitSection(init) {
  const sec = CC.checkLists({});
  for (let i = 0; i < init.lists; i++) sec.lists['li' + i + 'seed'] = { name: 'List ' + i, charId: null, order: i, made: 1760000000000 + i };
  for (let i = 0; i < init.targets; i++) sec.targets['li' + (i % init.lists) + 'seed.ti' + i + 'seed'] = { item: 100 + i, recipe: 0, qty: 1 + i };
  sec.ways['c1.100'] = { by: 'craft' }; sec.have['c1.100'] = { nq: 2 }; sec.owners.c1 = { order: 'vendor craft gather trade market' };
  return sec;
}

async function bRunCase(c) {
  const viol = [], trace = [], flag = (inv, msg) => viol.push({ inv, msg });
  bReset();
  const first = await CC.writeSection('lists', bInitSection(c.init), null);
  const tabs = [0, 1, 2].map((n) => ({ n, rev: first.rev, view: BJ(first.section), count: 0, undo: [] }));
  tabs.forEach((t) => { t.view = JSON.parse(t.view); });
  const everLists = new Set(Object.keys(first.section.lists));
  const refresh = async (t) => { const r = await CC.read(); t.rev = r.rev; t.view = JSON.parse(BJ(bStoredOf(r.raw))); };

  async function write(t, sent, expect, desc, pushUndo) {
    const r0 = await CC.read(), S = JSON.parse(BJ(bStoredOf(r0.raw))), before = BJ(r0.raw);
    const B = CC.checkLists(JSON.parse(BJ(t.view))), Ls = CC.checkLists(JSON.parse(BJ(sent))), differs = r0.rev !== t.rev;
    const M = differs ? CC.checkLists(CC.mergeModules({ lists: t.view }, { lists: Ls }, { lists: S }).lists) : Ls;
    const want = bOracle(B, Ls, S, M, differs, expect);
    let res = null, err = null;
    try { res = await CC.writeSection('lists', sent, expect ? { rev: t.rev, base: t.view, expect } : { rev: t.rev, base: t.view }); } catch (e) { err = String(e && e.message); }
    const r1 = await CC.read(), after = BJ(r1.raw), N = bStoredOf(r1.raw);
    trace.push('tab ' + t.n + ' ' + desc + (err ? ' -> refused: ' + err : ' -> written'));
    if (err) {
      if (!want) flag('ACCEPTED', 'a write no rule refuses was refused: ' + err);
      else if (err !== want.text) flag(want.id, 'refused with "' + err + '", the rule says "' + want.text + '"');
      if (after !== before) flag('REFUSED', 'a refused write changed the store');
      await refresh(t);
      return false;
    }
    if (want) flag(want.id, 'a write the rule refuses ("' + want.text + '") was stored');
    const uS = bUnits(S), uB = bUnits(B), uL = bUnits(Ls), uN = bUnits(N);
    for (const [u, t2] of uN) {
      if (uS.get(u) === t2) continue;
      if (uL.get(u) !== t2 || uL.get(u) === uB.get(u)) flag('LI3', 'unit ' + u + ' differs from stored but the page did not send a change to it');
    }
    for (const u of uS.keys()) if (!uN.has(u) && !(uB.has(u) && !uL.has(u))) flag('GONE', 'unit ' + u + ' disappeared and this page did not remove it');
    for (const [u, t2] of uL) if (uB.get(u) !== t2 && uN.get(u) !== t2 && !(uS.has(u) && uS.get(u) !== uB.get(u) && false)) flag('LI3', 'unit ' + u + ' the page changed is not as sent');
    for (const u of uN.keys()) if (u.startsWith('targets|') && !uN.has('lists|' + bListOf(u)) && !(uS.has(u) && !uS.has('lists|' + bListOf(u)))) flag('LI2', 'a new wanted item without its list: ' + u);
    if (expect) for (const [key, text] of Object.entries(expect)) { const u = [...uN.keys()].find((x) => bExpectKey(x) === key); void text; void u; }
    try { if (BJ(CC.checkDoc(JSON.parse(after)).modules.lists) !== BJ(N) || BJ(CC.checkLists(JSON.parse(BJ(N)))) !== BJ(N)) flag('CHECKDOC', 'the store changes when checked'); } catch (e) { flag('CHECKDOC', String(e && e.message)); }
    if (Object.keys(N).join() !== 'v,lists,targets,ways,owners,have,prefs') flag('FRAME', 'the section is not the whole frame: ' + Object.keys(N).join());
    if (pushUndo) {
      const entry = { before: {}, after: {} };
      for (const u of new Set([...uB.keys(), ...uL.keys()])) if (uB.get(u) !== uL.get(u)) { entry.before[u] = uB.has(u) ? uB.get(u) : null; entry.after[u] = uL.has(u) ? uL.get(u) : null; }
      if (Object.keys(entry.before).length) { t.undo.push(entry); if (t.undo.length > 20) t.undo.shift(); }
    }
    t.rev = res.rev; t.view = JSON.parse(BJ(res.section));
    Object.keys(res.section.lists).forEach((id) => everLists.add(id));
    return true;
  }

  for (const op of c.ops) {
    const t = tabs[op.tab], kind = B_KINDS[op.k], V = JSON.parse(BJ(t.view));
    const listIds = Object.keys(V.lists).sort(), tids = Object.keys(V.targets).sort(), pick = (arr, x) => arr[x % arr.length];
    const nid = (p) => p + t.n + (t.count++).toString(36).padStart(3, '0');
    if (kind === 'refresh') { await refresh(t); trace.push('tab ' + t.n + ' refresh'); continue; }
    if (kind === 'undo') {
      const e = t.undo.pop(); if (!e) continue;
      await refresh(t); // an undo is built on the saved copy, and the store checks the units again inside its transaction (D16)
      const sent = JSON.parse(BJ(t.view)), expect = {};
      for (const [u, text] of Object.entries(e.before)) bSetUnit(sent, u, text);
      for (const [u, text] of Object.entries(e.after)) expect[bExpectKey(u)] = text;
      const r0 = await CC.read(), S = bStoredOf(r0.raw), uS = bUnits(S);
      const matches = Object.entries(e.after).every(([u, text]) => (uS.has(u) ? uS.get(u) : null) === text);
      const ok = await write(t, sent, expect, 'undo of ' + Object.keys(e.before).length + ' unit(s)', false);
      if (ok && !matches) flag('E20', 'an undo was applied though a unit differed from what the change wrote');
      if (ok) { const uN = bUnits(bStoredOf((await CC.read()).raw)); for (const [u, text] of Object.entries(e.before)) if ((uN.has(u) ? uN.get(u) : null) !== text && !(uS.has(u) && false)) flag('E20', 'an applied undo did not restore ' + u + ' byte for byte'); }
      if (!ok && matches) { /* refused for another rule (a removed list, say): allowed */ }
      continue;
    }
    let desc = kind;
    if (kind === 'addList') { const id = nid('l'); V.lists[id] = { name: 'N' + op.a % 50, charId: null, order: op.b % 20, made: 1760000100000 + op.c }; desc += ' ' + id; }
    else if (kind === 'addTarget') {
      const pool = op.c % 5 === 0 && everLists.size ? [...everLists].sort() : listIds; if (!pool.length) continue;
      const l = pick(pool, op.a), id = nid('t'); V.targets[l + '.' + id] = { item: 100 + op.b % 6, recipe: 0, qty: 1 + op.c % 9 }; desc += ' ' + l + '.' + id;
    }
    else if (kind === 'editTarget') { if (!tids.length) continue; const k = pick(tids, op.a); V.targets[k].qty = 1 + op.b % 99; if (op.c % 3 === 0) V.targets[k].done = true; else if (op.c % 3 === 1) delete V.targets[k].done; desc += ' ' + k; }
    else if (kind === 'removeTarget') { if (!tids.length) continue; const k = pick(tids, op.a); delete V.targets[k]; desc += ' ' + k; }
    else if (kind === 'removeList') {
      if (!listIds.length) continue; const l = pick(listIds, op.a); delete V.lists[l]; for (const k of tids) if (k.startsWith(l + '.')) delete V.targets[k];
      if (V.prefs.combined) delete V.prefs.combined[l]; desc += ' ' + l;
    }
    else if (kind === 'rename') { if (!listIds.length) continue; const l = pick(listIds, op.a); V.lists[l].name = 'R' + op.b % 50; desc += ' ' + l; }
    else if (kind === 'setWay') { const k = 'c1.' + (100 + op.a % 4); V.ways[k] = { by: ['vendor', 'craft', 'gather', 'trade', 'market', 'have'][op.b % 6] }; desc += ' ' + k; }
    else if (kind === 'removeWay') { const ks = Object.keys(V.ways).sort(); if (!ks.length) continue; delete V.ways[pick(ks, op.a)]; }
    else if (kind === 'setHave') { const k = 'c1.' + (100 + op.a % 4); V.have[k] = { nq: 1 + op.b % 50 }; desc += ' ' + k; }
    else if (kind === 'removeHave') { const ks = Object.keys(V.have).sort(); if (!ks.length) continue; delete V.have[pick(ks, op.a)]; }
    else if (kind === 'setOrder') V.owners.c1 = { order: op.a % 2 ? 'craft vendor gather trade market' : 'vendor craft gather trade market' };
    else if (kind === 'pref') { V.prefs.hideDone = op.a % 2 === 0; if (op.b % 3 === 0) V.prefs.priceWorld = 'W' + op.c % 5; }
    else if (kind === 'wipe') { V.lists = {}; V.targets = {}; V.ways = {}; V.owners = {}; V.have = {}; V.prefs = {}; }
    await write(t, V, null, desc, true);
    if (kind === 'wipe') {
      const N = bStoredOf((await CC.read()).raw);
      if (Object.keys(N).join() !== 'v,lists,targets,ways,owners,have,prefs') flag('FRAME', 'an emptied section is not the whole frame');
    }
  }
  return { viol, trace };
}

function bShrink(c, inv) {
  let cur = c;
  return (async () => {
    for (let pass = 0; pass < 3; pass++) for (let i = cur.ops.length - 1; i >= 0; i--) {
      const t = { init: cur.init, ops: cur.ops.slice(0, i).concat(cur.ops.slice(i + 1)) };
      const r = await bRunCase(t); if (r.viol.some((v) => v.inv === inv)) cur = t;
    }
    return cur;
  })();
}

let bSweep = null;
function bSweepAll() {
  if (bSweep) return bSweep;
  return (bSweep = (async () => {
    const t0 = Date.now(), out = { ran: 0, ms: 0, inv: {} };
    for (const inv of B_INVS) out.inv[inv] = { count: 0, first: null };
    for (const seed of SEEDS) for (let i = 0; i < PER_SEED; i++) {
      const c = bGenCase(seed, i), r = await bRunCase(c); out.ran++;
      for (const v of r.viol) { const o = out.inv[v.inv] = out.inv[v.inv] || { count: 0, first: null }; o.count++; if (!o.first) o.first = { seed, i, c, msg: v.msg }; }
    }
    out.ms = Date.now() - t0;
    for (const inv of Object.keys(out.inv)) {
      const f = out.inv[inv].first; if (!f) continue;
      const small = await bShrink(f.c, inv), r = await bRunCase(small), v = r.viol.find((x) => x.inv === inv);
      f.shrunk = small; f.shrunkMsg = v ? v.msg : f.msg; f.trace = r.trace.join('\n    ');
    }
    return out;
  })());
}
const B_TEXTS = {
  LI1: 'nothing the stored copy lost comes back', LI2: 'no new wanted item without its list; a stale edit inside a removed list is refused', LI3: 'a unit the page did not change stays as stored has it; one it changed is as sent',
  LI4: 'a unit another tab changed is not removed', LI5: 'a conditional write is applied only if the named units are as expected', E20: 'undo restores byte for byte, only when every unit is as the change wrote it',
  REFUSED: 'a refused write leaves the store byte-identical', ACCEPTED: 'a write is refused only when a rule says so', CHECKDOC: 'the store passes CC.checkDoc unchanged', GONE: 'a unit missing afterwards was removed by the page that wrote',
  FRAME: 'an emptied section stays the whole frame', BIG: 'a store above every size limit is kept whole by a write'
};
for (const inv of B_INVS.filter((x) => x !== 'BIG')) test(inv + ' (tabs) ' + B_TEXTS[inv], async () => {
  const o = await bSweepAll();
  if (o.inv[inv].count) { const f = o.inv[inv].first; assert.fail(inv + ' failed in ' + o.inv[inv].count + ' violations. First: seed ' + f.seed + ', case ' + f.i + '. ' + f.shrunkMsg + '\n  shrunk case: ' + f.shrunk.ops.length + ' operation(s) from a start of ' + f.shrunk.init.lists + ' list(s), ' + f.shrunk.init.targets + ' item(s):\n    ' + f.trace + '\n  operations ' + BJ(f.shrunk.ops)); }
});
test('BIG (tabs) ' + B_TEXTS.BIG, async () => {
  const id = (p, n) => p + n.toString(36).padStart(11, '0'), sec = CC.checkLists({});
  for (let i = 0; i < 250; i++) sec.lists[id('l', i)] = { name: 'L' + i, charId: null, order: i, made: 1760000000000 + i };
  for (let i = 0; i < 2500; i++) sec.targets[id('l', 0) + '.' + id('t', i)] = { item: 100 + i, recipe: 0, qty: 1 };
  for (let i = 0; i < 25000; i++) sec.have['c1.' + (1000 + i)] = { nq: 1 };
  bReset();
  const first = await CC.writeSection('lists', JSON.parse(BJ(sec)), null);
  assert.equal(BJ(first.section), BJ(sec), 'the seed is stored whole');
  const edit = JSON.parse(BJ(first.section)); edit.lists[id('l', 3)].name = 'Edited'; edit.targets[id('l', 0) + '.' + id('t', 5)].qty = 9;
  const w1 = await CC.writeSection('lists', edit, { rev: first.rev, base: first.section });
  const other = JSON.parse(BJ(first.section)); other.have['c1.1000'] = { nq: 7 };
  const w2 = await CC.writeSection('lists', other, { rev: first.rev, base: first.section }); // a stale tab
  assert.equal(Object.keys(w2.section.lists).length, 250); assert.equal(Object.keys(w2.section.targets).length, 2500); assert.equal(Object.keys(w2.section.have).length, 25000);
  assert.equal(w2.section.lists[id('l', 3)].name, 'Edited'); assert.equal(w2.section.have['c1.1000'].nq, 7); void w1;
  const stored = CC.checkDoc((await CC.read()).raw).modules.lists;
  assert.equal(BJ(CC.checkLists(JSON.parse(BJ(stored)))), BJ(stored));
});
test('the tabs model ran the cases asked for, within the time limit', async () => {
  const o = await bSweepAll();
  console.log('# lists model part B: ' + o.ran + ' cases of ' + B_STEPS + ' steps, three tabs (seeds ' + SEEDS.join(',') + ') in ' + o.ms + ' ms');
  assert.equal(o.ran, SEEDS.length * PER_SEED);
  if (!process.env.LISTS_MODEL_N) assert.ok(o.ms < B_TIME_LIMIT_MS, 'took ' + o.ms + ' ms, the limit is ' + B_TIME_LIMIT_MS);
});

// =========================================================================================================== part C: devices
// Two devices edit one lists section from a common base (the last sync) with random steps (add, change and remove a list, a wanted item, a way,
// a stock count, an order, a preference; remove a header only, as an older build or a hand edit can leave it; make the same id on both devices
// with the same or a different creation time), then meet in the real ET.threeWay and ET.applyMerge (both orientations) and in the tab's own
// ET.saveMerge. The test states its invariants itself, over units (a list header, a wanted item, a way, an owner's order, a stock count, a
// preference), from the raw copies and never from the merge:
//   LY0 a unit removed on one side and changed on the other is kept (also by ET.threeWay, so a merge applied without asking keeps it);
//   LY1 a question about a whole list is asked exactly when the table says: the header is in base and missing on one side only, unless that side
//       removed the header and every wanted item and the other still holds exactly what base held; never more than one per list;
//   LY2 with no answer nothing of either device is missing afterwards, except what the other side removed from an unchanged unit (a one-sided
//       removal) or what moved to a new id (LY6); with answers, also what an answered question removes;
//   LY3 with no answer no wanted item lacks its list unless one of the two copies already held it so;
//   LY4 devices settle: after every question is answered a further sync of either device changes nothing and asks nothing, and with questions
//       unanswered a further sync asks the same questions;
//   LY5 a question about a whole list is only ever about its header: ways, orders and stock counts are not touched by its answer;
//   LY6 the same id made on both devices with a different creation time is two records, both kept, the later under the same new id in both
//       orientations, a list's wanted items moving with it, no question; with the same creation time it is one record;
//   SYM the questions and the set of units are the same from both devices;  ANSWERED an answer does what the question says;
//   SAVEMERGE the tab's own save (no answers) equals the merge applied with no answers;  BIG two devices each just under a size limit merge to
//   more than the limit with nothing dropped.
const C_INVS = ['LY0', 'LY1', 'LY2', 'LY3', 'LY4', 'LY5', 'LY6', 'SYM', 'ANSWERED', 'SAVEMERGE', 'BIG'];
const C_LISTS = ['liaaa', 'libbb', 'liccc'], C_TIDS = ['t1aaa', 't2aaa', 't3aaa', 't4aaa'], C_TIMES = [1760000000100, 1760000000200, 1760000000300];
const C_TIME_LIMIT_MS = 20000;
const C_TEMPLATE = ET.newState(['Kira']);
const cFrame = () => ({ v: 1, lists: {}, targets: {}, ways: {}, owners: {}, have: {}, prefs: {} });
const cPortable = (sec) => ET.portable(Object.assign({}, C_TEMPLATE, { modules: { lists: sec } }));
const cApply = (onto, res, answers) => clone(ET.applyMerge(Object.assign(clone(C_TEMPLATE), { modules: { lists: clone(onto) } }), res, answers || {}).modules.lists);
const cUnits = (sec) => {
  const m = new Map();
  for (const g of ['lists', 'targets', 'ways', 'owners', 'have']) for (const [k, v] of Object.entries(sec[g] || {})) m.set(g + '|' + k, BJ(v));
  for (const [k, v] of Object.entries(sec.prefs || {})) if (k !== 'combined') m.set('prefs|' + k, BJ(v));
  return m;
};
const cPath = (id) => { const p = JSON.parse(id.slice(2)); return p[0] === 'lists' && p.length === 3 ? p[1] + '|' + p[2] : null; };
const cTargets = (U, P) => [...U.keys()].filter((k) => k.startsWith('targets|' + P + '.'));
const cListOf = (u) => (u.startsWith('lists|') ? u.slice(6) : u.startsWith('targets|') ? u.slice(8).split('.')[0] : null);

function cGenCase(seed, i) {
  const rnd = makeRnd(seed * 7000003 + i * 104729 + 31), base = cFrame();
  const nl = 1 + rnd(3);
  for (let k = 0; k < nl; k++) {
    base.lists[C_LISTS[k]] = { name: 'Base' + k, charId: 'c1', order: k, made: 1760000000000 };
    for (let t = 0, nt = rnd(5); t < nt; t++) base.targets[C_LISTS[k] + '.' + C_TIDS[t]] = { item: 10 + t, recipe: 0, qty: 1 + rnd(5), at: 1760000000050 };
  }
  if (rnd(2)) base.ways['c1.100'] = { by: 'craft' };
  if (rnd(2)) base.have['c1.100'] = { nq: 3 };
  if (rnd(2)) base.owners.c1 = { order: 'vendor craft gather trade market' };
  if (rnd(2)) base.prefs.hideDone = true;
  const side = () => { const ops = []; for (let k = 0, n = rnd(6); k < n; k++) ops.push({ k: rnd(14), a: rnd(10000), b: rnd(10000), c: rnd(10000) }); return ops; };
  return { base, L: side(), R: side() };
}
function cApplyOps(sec0, ops, dev) {
  const sec = clone(sec0);
  ops.forEach((op, n) => {
    const lids = Object.keys(sec.lists).sort(), tks = Object.keys(sec.targets).sort(), pick = (arr, x) => arr[x % arr.length], tag = dev * 1000 + n;
    switch (op.k) {
      case 0: case 1: { // add a wanted item (sometimes to a list this device has no header for)
        const l = op.a % 9 === 0 ? pick(C_LISTS, op.b) : lids.length ? pick(lids, op.a) : null; if (!l) break;
        const key = l + '.' + C_TIDS[op.b % 4]; if (sec.targets[key]) break;
        sec.targets[key] = { item: tag + 100, recipe: 0, qty: 1 + op.c % 9, at: C_TIMES[op.c % 3] }; break;
      }
      case 2: { if (!tks.length) break; const k = pick(tks, op.a); sec.targets[k].qty = 20 + dev * 10 + op.b % 9; break; }
      case 3: { if (!tks.length) break; delete sec.targets[pick(tks, op.a)]; break; }
      case 4: { if (!lids.length) break; const l = pick(lids, op.a); delete sec.lists[l]; for (const k of tks) if (k.startsWith(l + '.')) delete sec.targets[k]; break; }
      case 5: { if (!lids.length) break; delete sec.lists[pick(lids, op.a)]; break; } // the header only
      case 6: { if (!lids.length) break; sec.lists[pick(lids, op.a)].name = 'D' + dev + 'n' + n; break; }
      case 7: case 8: { // add a list, sometimes with the id the other device may also use, with a creation time from a small set
        const l = pick(C_LISTS, op.a); if (sec.lists[l]) break;
        sec.lists[l] = { name: 'D' + dev + 'L' + n, charId: 'c1', order: 5, made: C_TIMES[op.b % 3] };
        for (let t = 0, nt = op.c % 3; t < nt; t++) sec.targets[l + '.' + C_TIDS[t]] = { item: tag * 10 + t + 100000, recipe: 0, qty: 1 + t, at: C_TIMES[(op.c + t) % 3] };
        break;
      }
      case 9: sec.ways['c1.' + (100 + op.a % 2)] = { by: ['vendor', 'craft', 'gather'][(op.b + dev) % 3] }; break;
      case 10: { const ks = Object.keys(sec.ways).sort(); if (ks.length) delete sec.ways[pick(ks, op.a)]; break; }
      case 11: sec.have['c1.' + (100 + op.a % 2)] = { nq: 10 + dev * 100 + op.b % 50 }; break;
      case 12: { const ks = Object.keys(sec.have).sort(); if (ks.length) delete sec.have[pick(ks, op.a)]; break; }
      default: if (op.a % 2) sec.owners.c1 = { order: dev ? 'craft vendor gather trade market' : 'vendor craft gather trade market' }; else delete sec.owners.c1; break;
    }
  });
  return sec;
}
// the questions and renames the spec's rules call for, from the raw copies
function cOracle(B, L, R) {
  const UB = cUnits(B), UL = cUnits(L), UR = cUnits(R), q = new Map(), moved = new Map();
  for (const [u] of UB) {
    if (!u.startsWith('lists|')) continue;
    const P = u.slice(6), lh = UL.has(u), rh = UR.has(u); if (lh === rh) continue;
    const Y = lh ? UL : UR, X = lh ? UR : UL, xT = cTargets(X, P), yT = cTargets(Y, P), bT = cTargets(UB, P);
    if (!xT.length && Y.get(u) === UB.get(u) && yT.length === bT.length && yT.every((k) => UB.get(k) === Y.get(k))) continue;
    q.set(P, xT.length ? 3 : 2);
  }
  const later = (a, b) => (a > b ? 'L' : 'R');
  const made = (U, u) => JSON.parse(U.get(u)).made, at = (U, u) => JSON.parse(U.get(u)).at;
  for (const u of UL.keys()) {
    if (u.startsWith('lists|') && !UB.has(u) && UR.has(u) && made(UL, u) !== made(UR, u)) moved.set(u, later(made(UL, u), made(UR, u)));
  }
  for (const u of UL.keys()) {
    if (!u.startsWith('targets|') || UB.has(u) || !UR.has(u) || at(UL, u) === at(UR, u)) continue;
    if (moved.has('lists|' + cListOf(u))) continue; // moves with its list
    moved.set(u, later(at(UL, u), at(UR, u)));
  }
  return { q, moved };
}

async function cRunCase(c, tally) {
  const viol = [], flag = (inv, msg) => viol.push({ inv, msg });
  const B = c.base, L = cApplyOps(B, c.L, 0), R = cApplyOps(B, c.R, 1), UB = cUnits(B), UL = cUnits(L), UR = cUnits(R);
  const orc = cOracle(B, L, R), pB = cPortable(B);
  const sides = { LR: { l: L, r: R, ul: UL, ur: UR }, RL: { l: R, r: L, ul: UR, ur: UL } };
  const out = {};
  for (const [name, s] of Object.entries(sides)) {
    const res = ET.threeWay(pB, cPortable(s.l), cPortable(s.r)), none = cApply(s.l, res, {});
    out[name] = { res, none, U: cUnits(none) };
  }
  const main = out.LR, U = main.U, qs = main.res.conflicts.filter((x) => x.integrity && x.integrity.kind === 'list');
  // movedMissing: a key the later side held under an old id and the other side did not hold
  const movedKeys = (u) => orc.moved.has(u) || (u.startsWith('targets|') && orc.moved.has('lists|' + cListOf(u)));
  const sameValue = (v) => [...U.values()].includes(v);
  for (const [name, r] of Object.entries(out)) {
    const s = sides[name];
    // LY1
    const asked = new Set(r.res.conflicts.filter((x) => x.integrity && x.integrity.kind === 'list').map((x) => x.integrity.listId));
    if (asked.size !== r.res.conflicts.filter((x) => x.integrity && x.integrity.kind === 'list').length) flag('LY1', 'more than one question for a list');
    if (BJ([...asked].sort()) !== BJ([...orc.q.keys()].sort())) flag('LY1', 'questions asked for ' + BJ([...asked].sort()) + ', the table says ' + BJ([...orc.q.keys()].sort()) + ' (' + name + ')');
    // LY0 in ET.threeWay itself: a unit removed on one side and changed on the other is in the merged map, so a merge applied without asking keeps it
    for (const [Us, Uo] of [[s.ul, s.ur], [s.ur, s.ul]]) for (const [u, v] of Uo) {
      if (!UB.has(u) || Us.has(u) || v === UB.get(u) || movedKeys(u)) continue;
      const bar = u.indexOf('|');
      if (!r.res.merged.has('m|' + BJ(['lists', u.slice(0, bar), u.slice(bar + 1)]))) flag('LY0', 'ET.threeWay did not keep ' + u + ', removed on one side and changed on the other (' + name + ')');
    }
    for (const P of asked) if (!r.res.merged.has('m|' + BJ(['lists', 'lists', P]))) flag('LY1', 'ET.threeWay did not keep the header of the list it asks about (' + P + ')');
    // LY0 and LY2: every unit of either copy that is missing afterwards was removed one-sidedly or moved
    for (const [side, Us, Uo] of [['this', s.ul, s.ur], ['other', s.ur, s.ul]]) for (const [u, v] of Us) {
      if (r.U.has(u)) continue;
      if (movedKeys(u)) { if (!sameValue(v)) flag('LY6', 'a moved unit ' + u + ' is not kept under its new id'); continue; }
      const oneSided = UB.has(u) && !Uo.has(u) && UB.get(u) === v;
      if (!oneSided) flag(UB.has(u) && !Uo.has(u) ? 'LY0' : 'LY2', 'unit ' + u + ' of the ' + side + ' device is missing afterwards and was not a one-sided removal (' + name + ')');
    }
    // LY3: no wanted item without its list unless one of the copies held it so
    for (const u of r.U.keys()) {
      if (!u.startsWith('targets|') || r.U.has('lists|' + cListOf(u)) || movedKeys(u)) continue;
      const P = cListOf(u);
      if (!((s.ul.has(u) && !s.ul.has('lists|' + P)) || (s.ur.has(u) && !s.ur.has('lists|' + P)))) flag('LY3', 'wanted item ' + u + ' lost its list in the merge');
    }
    // LY5: a list question is about the header; nothing of ways, owners, stock or preferences changes with a different answer
    for (const x of r.res.conflicts) if (x.integrity && x.integrity.kind === 'list' && cPath(x.id) !== 'lists|' + x.integrity.listId) flag('LY5', 'a list question is not about its header: ' + x.id);
    // a repeated sync with the same inputs asks the same questions (LY4, unanswered)
    const again = ET.threeWay(pB, cPortable(s.l), cPortable(s.r));
    if (BJ(again.conflicts) !== BJ(r.res.conflicts) || cUnits(cApply(s.l, again, {})).size !== r.U.size) flag('LY4', 'a repeated sync did not ask the same (' + name + ')');
    // answers: every question answered at random, then settle
    const rnd = makeRnd(r.res.conflicts.length * 31 + 7), answers = {};
    r.res.conflicts.forEach((x, n) => { answers[x.id] = ['local', 'remote'][(rnd(2) + n) % 2]; });
    const ans = cApply(s.l, r.res, answers), UA = cUnits(ans);
    const removed = new Set(), nulls = new Set(), own = new Set();
    for (const x of r.res.conflicts) if (x.integrity && x.integrity.kind === 'list' && (answers[x.id] === 'remote' ? x.remote : x.local) === null) removed.add(x.integrity.listId);
    for (const x of r.res.conflicts) {
      const pick = answers[x.id] === 'remote' ? x.remote : x.local;
      if (x.integrity && x.integrity.kind === 'list') {
        const P = x.integrity.listId;
        if (pick === null) { if (UA.has('lists|' + P) || cTargets(UA, P).length) flag('ANSWERED', 'Remove left something of list ' + P); }
        else { if (!UA.has('lists|' + P)) flag('ANSWERED', 'Keep lost the header of ' + P); for (const k of cTargets(r.U, P)) if (!UA.has(k)) flag('ANSWERED', 'Keep lost ' + k); }
      } else {
        const u = cPath(x.id); if (!u) continue; own.add(u);
        if (removed.has(cListOf(u))) continue;
        if (pick === null) { nulls.add(u); if (UA.has(u)) flag('ANSWERED', 'an answer for the removing side left ' + u); } else if (UA.get(u) !== pick && !removed.has(cListOf(u))) flag('ANSWERED', 'the answer for ' + u + ' was not applied');
      }
    }
    // LY5: the ways, orders, stock counts and preferences are exactly what the merge without that answer left, except units with a question of their own
    for (const u2 of new Set([...r.U.keys(), ...UA.keys()])) if (/^(ways|owners|have|prefs)\|/.test(u2) && !own.has(u2) && r.U.get(u2) !== UA.get(u2)) flag('LY5', 'answering the questions changed ' + u2 + ', which no question was about');
    for (const [side, Us, Uo] of [['this', s.ul, s.ur], ['other', s.ur, s.ul]]) for (const [u, v] of Us) {
      if (UA.has(u) || movedKeys(u)) continue;
      const oneSided = UB.has(u) && !Uo.has(u) && UB.get(u) === v, byAnswer = removed.has(cListOf(u)) || nulls.has(u);
      if (!oneSided && !byAnswer) flag('LY2', 'unit ' + u + ' of the ' + side + ' device is missing after the answers and no answer removed it');
    }
    // LY4 settle: every question answered, the answering device syncs again and the other device syncs against what it left
    const M = ans, again2 = ET.threeWay(cPortable(M), cPortable(M), cPortable(M));
    if (again2.conflicts.length || BJ(cApply(M, again2, {})) !== BJ(M)) flag('LY4', 'a sync after the answers asked or changed something (' + name + ')');
    const other = ET.threeWay(cPortable(s.r), cPortable(s.r), cPortable(M));
    if (other.conflicts.length || cApply(s.r, other, {}) && BJ(cApply(s.r, other, {}).lists) !== BJ(M.lists) && BJ(cUnits(cApply(s.r, other, {}))) !== BJ(UA)) flag('LY4', 'the other device did not settle on what the answers left (' + name + ')');
  }
  // SYM and SAVEMERGE
  if (BJ([...out.LR.U.keys()].sort()) !== BJ([...out.RL.U.keys()].sort())) flag('SYM', 'the set of units differs between the two orientations');
  if (BJ(out.LR.res.conflicts.map((x) => x.id).sort()) !== BJ(out.RL.res.conflicts.map((x) => x.id).sort())) flag('SYM', 'the questions differ between the two orientations');
  const tabSt = Object.assign(clone(C_TEMPLATE), { modules: { lists: clone(L) } });
  const tab = ET.saveMerge(tabSt, 'r2', cPortable(R), 'r1', pB);
  if (BJ(cUnits(tab.state.modules.lists)) !== BJ(cUnits(out.LR.none)) && canon(cUnits(tab.state.modules.lists)) !== canon(cUnits(out.LR.none))) flag('SAVEMERGE', 'the tab save differs from the merge applied with no answers');
  // LY6: same id, different time: two records; same time: one
  for (const [u, side] of orc.moved) {
    const P = cListOf(u);
    if (u.startsWith('lists|')) {
      const laterU = side === 'L' ? UL : UR, earlierU = side === 'L' ? UR : UL;
      const lv = JSON.parse(laterU.get(u)), ev = JSON.parse(earlierU.get(u));
      const heads = [...U.entries()].filter(([k]) => k.startsWith('lists|')).map(([k, v]) => [k, JSON.parse(v)]);
      const eh = heads.find(([k, v]) => v.name === ev.name), lh = heads.find(([k, v]) => v.name === lv.name);
      if (!eh || !lh || eh[0] !== u || !/^lists\|[a-z0-9]{12}$/.test(lh[0])) flag('LY6', 'both records of ' + P + ' are not kept, the earlier under its id and the later under a 12 character id');
      else {
        const nid = lh[0].slice(6);
        if (out.RL.U.get(lh[0]) !== U.get(lh[0])) flag('LY6', 'the two devices computed different new ids');
        for (const k of cTargets(laterU, P)) { const nk = 'targets|' + nid + k.slice(('targets|' + P).length); if (U.get(nk) !== laterU.get(k)) flag('LY6', 'wanted item ' + k + ' did not move with its list'); }
        for (const k of cTargets(earlierU, P)) if (U.get(k) !== earlierU.get(k) && !(UB.has(k))) flag('LY6', 'the earlier list lost ' + k);
      }
      tally.ly6List++;
    } else {
      const laterU = side === 'L' ? UL : UR, earlierU = side === 'L' ? UR : UL;
      const lv = laterU.get(u), ev = earlierU.get(u);
      const vals = [...U.entries()].filter(([k]) => k.startsWith('targets|' + P + '.')).map(([k, v]) => [k, v]);
      if (!vals.some(([k, v]) => k === u && v === ev) || !vals.some(([k, v]) => k !== u && v === lv && /^targets\|[a-z0-9]+\.[a-z0-9]{12}$/.test(k))) flag('LY6', 'both wanted items of ' + u + ' are not kept (the earlier under its id, the later under a new one)');
      tally.ly6Target++;
    }
  }
  // tallies of what the run actually met
  for (const [P, k] of orc.q) tally[k === 3 ? 'listQ3' : 'listQ2']++;
  for (const x of main.res.conflicts) {
    const u = cPath(x.id), g = u ? u.split('|')[0] : null;
    if (x.integrity && x.integrity.kind === 'list') continue;
    if (x.integrity && x.integrity.keep) tally['keep:' + g] = (tally['keep:' + g] || 0) + 1; else if (u) tally['clash:' + g] = (tally['clash:' + g] || 0) + 1;
  }
  for (const [u] of UB) if (u.startsWith('lists|') && !UL.has(u) !== !UR.has(u)) { const P = u.slice(6); if (!orc.q.has(P)) tally.case1++; }
  for (const [u] of UB) if (u.startsWith('lists|') && !UL.has(u) && !UR.has(u)) tally.case4++;
  for (const u of UL.keys()) if (u.startsWith('lists|') && !UB.has(u) && !UR.has(u)) tally.case5++;
  for (const u of UR.keys()) if (u.startsWith('lists|') && !UB.has(u) && !UL.has(u)) tally.case5++;
  for (const u of U.keys()) if (u.startsWith('targets|') && !U.has('lists|' + cListOf(u))) { tally.orphans++; break; }
  for (const [u] of UL) if (u.startsWith('lists|') && !UB.has(u) && UR.has(u) && UL.get(u) !== UR.get(u) && !orc.moved.has(u)) { tally.sameTime++; break; }
  return { viol, L, R };
}
function cShrink(c, inv) {
  return (async () => {
    let cur = c;
    for (let pass = 0; pass < 3; pass++) for (const side of ['L', 'R']) for (let i = cur[side].length - 1; i >= 0; i--) {
      const cand = { base: cur.base, L: cur.L.slice(), R: cur.R.slice() }; cand[side].splice(i, 1);
      const r = await cRunCase(cand, { ly6List: 0, ly6Target: 0, listQ2: 0, listQ3: 0, case1: 0, case4: 0, case5: 0, orphans: 0, sameTime: 0 });
      if (r.viol.some((v) => v.inv === inv)) cur = cand;
    }
    return cur;
  })();
}
let cSweep = null;
function cSweepAll() {
  if (cSweep) return cSweep;
  return (cSweep = (async () => {
    const t0 = Date.now(), out = { ran: 0, ms: 0, inv: {}, tally: { ly6List: 0, ly6Target: 0, listQ2: 0, listQ3: 0, case1: 0, case4: 0, case5: 0, orphans: 0, sameTime: 0 } };
    for (const inv of C_INVS) out.inv[inv] = { count: 0, first: null };
    for (const seed of SEEDS) for (let i = 0; i < PER_SEED; i++) {
      const c = cGenCase(seed, i), r = await cRunCase(c, out.tally); out.ran++;
      for (const v of r.viol) { const o = out.inv[v.inv] = out.inv[v.inv] || { count: 0, first: null }; o.count++; if (!o.first) o.first = { seed, i, c, msg: v.msg }; }
    }
    out.ms = Date.now() - t0;
    for (const inv of Object.keys(out.inv)) {
      const f = out.inv[inv].first; if (!f) continue;
      const small = await cShrink(f.c, inv), r = await cRunCase(small, { ly6List: 0, ly6Target: 0, listQ2: 0, listQ3: 0, case1: 0, case4: 0, case5: 0, orphans: 0, sameTime: 0 }), v = r.viol.find((x) => x.inv === inv);
      f.shrunk = small; f.shrunkMsg = v ? v.msg : f.msg; f.sections = { base: small.base, L: r.L, R: r.R };
    }
    return out;
  })());
}
const C_TEXTS = {
  LY0: 'a unit removed on one side and changed on the other is kept', LY1: 'the whole-list question is asked exactly when the table says', LY2: 'with no answer nothing is missing but one-sided removals and moves',
  LY3: 'no wanted item loses its list in a merge', LY4: 'devices settle; unanswered, the same questions again', LY5: 'a list question is about its header only', LY6: 'the same id on two devices with different times is two records',
  SYM: 'both orientations ask the same and hold the same units', ANSWERED: 'an answer does what the question says', SAVEMERGE: 'the tab save equals the merge applied with no answers'
};
for (const inv of C_INVS.filter((x) => x !== 'BIG')) test(inv + ' (devices) ' + C_TEXTS[inv], async () => {
  const o = await cSweepAll();
  if (o.inv[inv].count) { const f = o.inv[inv].first; assert.fail(inv + ' failed in ' + o.inv[inv].count + ' violations. First: seed ' + f.seed + ', case ' + f.i + '. ' + f.shrunkMsg + '\n  shrunk case: base ' + BJ(f.sections.base) + '\n  device L ops ' + BJ(f.shrunk.L) + ' gives ' + BJ(f.sections.L) + '\n  device R ops ' + BJ(f.shrunk.R) + ' gives ' + BJ(f.sections.R)); }
});
test('BIG (devices) two devices each just under a size limit merge to more than the limit with nothing dropped', () => {
  const id = (p, n) => p + n.toString(36).padStart(8, '0'), sec = cFrame();
  sec.lists[id('l', 0)] = { name: 'Shared', charId: null, order: 0, made: 1760000000000 };
  const side = (tag, from) => {
    const s = clone(sec);
    for (let i = 0; i < 190; i++) s.lists[id('l', tag * 1000 + 1 + i)] = { name: 'L' + tag + '-' + i, charId: null, order: i, made: 1760000000000 + i };
    for (let i = 0; i < 1900; i++) s.targets[id('l', 0) + '.' + id('t', tag * 10000 + i)] = { item: 100 + i, recipe: 0, qty: 1, at: 1760000000000 + i };
    for (let i = 0; i < 19000; i++) s.have['c1.' + (from + i)] = { nq: 1 };
    return s;
  };
  const L = side(1, 1000), R = side(2, 100000), res = ET.threeWay(cPortable(sec), cPortable(L), cPortable(R));
  assert.equal(res.conflicts.length, 0);
  const o = cApply(L, res, {}), tab = ET.saveMerge(Object.assign(clone(C_TEMPLATE), { modules: { lists: clone(L) } }), 'r2', cPortable(R), 'r1', cPortable(sec)).state.modules.lists;
  for (const x of [o, clone(tab)]) { assert.equal(Object.keys(x.lists).length, 381); assert.equal(Object.keys(x.targets).length, 3800); assert.equal(Object.keys(x.have).length, 38000); }
  assert.equal(BJ(CC.checkLists(clone(o))), BJ(o), 'the checker drops nothing');
});
test('the devices model ran the cases asked for, met every kind of question, within the time limit', async () => {
  const o = await cSweepAll(), t = o.tally;
  console.log('# lists model part C: ' + o.ran + ' cases, two devices, both orientations (seeds ' + SEEDS.join(',') + ') in ' + o.ms + ' ms; met: whole-list question without items on the removing side ' + t.listQ2 + ', with items ' + t.listQ3 + ', removal taken (case 1) ' + t.case1
    + ', both lack the header (case 4) ' + t.case4 + ', new list taken (case 5) ' + t.case5 + ', wanted item left without a list ' + t.orphans + ', same id with the same time ' + t.sameTime + ', same id on two devices: lists ' + t.ly6List + ', wanted items ' + t.ly6Target
    + '; kept-until-answered: ' + Object.keys(t).filter((k) => k.startsWith('keep:')).map((k) => k.slice(5) + ' ' + t[k]).join(', ') + '; value clashes: ' + Object.keys(t).filter((k) => k.startsWith('clash:')).map((k) => k.slice(6) + ' ' + t[k]).join(', '));
  assert.equal(o.ran, SEEDS.length * PER_SEED);
  if (!process.env.LISTS_MODEL_N) {
    assert.ok(o.ms < C_TIME_LIMIT_MS, 'took ' + o.ms + ' ms, the limit is ' + C_TIME_LIMIT_MS);
    for (const k of ['listQ2', 'listQ3', 'case1', 'case4', 'case5', 'orphans', 'sameTime', 'ly6List', 'ly6Target']) assert.ok(t[k] > 0, 'the model never met: ' + k);
    for (const g of ['targets', 'ways', 'have', 'owners']) assert.ok(t['keep:' + g] > 0, 'the model never met a kept-until-answered ' + g);
  }
});
