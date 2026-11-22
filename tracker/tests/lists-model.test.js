'use strict';
// The permanent randomized model test of the Lists engine (docs/lists-spec.md, section 5, "Model test", part A).
// Random small game data (yields 1 to 5, several gil offers per item with different pack sizes and qualities, trades with one
// to three currencies, several recipes per item, loops of every kind), one owner with several lists and steps, wanted items
// with every combination of hq / coll / make, random ways, order and stock, and random sequences of way changes, crafts
// recorded, units bought, rows and steps finished, wanted items moved and removed and re-added, and lists reordered.
// Each of E1 to E19 is one test(). A failure prints the invariant, the seed, the case number and the shrunk case.
// The invariants are stated here by the test itself; the engine is never asked to check itself, except that the plain
// data readers (LISTS.way for an offer's text, LISTS.tree) are used where the spec defines them as the reference.
// Parts B (tabs) and C (devices) are added by work items W3 and W4.
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
