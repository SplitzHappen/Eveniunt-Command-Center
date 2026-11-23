'use strict';
// The Lists engine (work item W2 of docs/lists-spec.md): one test per invariant E1 to E19 (LE-1 to LE-19), replays of the Teamcraft
// faults of docs/lists-research.md section 1, the owner's case and the review cases (LE-R9 to LE-R21), and one test for each of the
// two counterexamples the model test found (D27, D28). Run: node tests/lists-engine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'command-center', 'src', 'lists', 'engine.js'));
const L = globalThis.LISTS;
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'lists-fixture.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const T = (id, item, qty, more) => Object.assign({ id, item, recipe: 0, qty }, more || {});
const list = (id, targets, steps) => ({ id, steps: steps || {}, targets });
const inp = (lists, o) => Object.assign({ order: '', ways: {}, have: {}, prices: null, lists }, o || {});
const plan = (lists, o, data) => L.plan(data || D, inp(lists, o));
const stock = (nq, hq, coll) => ({ nq: nq || 0, hq: hq || 0, coll: coll || 0 });
const line = (p, item, part, recipe) => p.lines[item + '|' + (part || 'normal') + '|' + (recipe || 0)];
const tm = (lists) => { const m = {}; for (const l of lists) for (const t of l.targets) m[l.id + '.' + t.id] = t; return m; };
function noRise(p1, p2, skip) {
  for (const k of Object.keys(p2.lines)) {
    const b = p2.lines[k], a = p1.lines[k] || {};
    if (skip && skip(b)) continue;
    for (const f of ['short', 'got', 'crafts', 'outside']) assert.ok((b[f] || 0) <= (a[f] || 0), k + ' ' + f + ' rose ' + (a[f] || 0) + ' -> ' + b[f]);
    if (b.by === 'trade') assert.ok(b.trades <= (a.by === 'trade' ? a.trades : 0), k + ' trades rose');
  }
}
const quiet = (p) => Object.values(p.lines).every((ln) => ln.short === 0 && ln.crafts === 0 && ln.trades === 0);
const sumFields = (p, key, f) => p.shares.reduce((n, s) => n + (s.lines[key] ? s.lines[key][f] : 0), 0);

test('LE-1 same input gives the same plan and the input is not changed', () => {
  const input = inp([list('A', [T('a', 100, 2), T('b', 120, 4, { hq: true })])], { have: { 103: stock(2, 1) }, ways: { 101: { by: 'craft' } } });
  const snap = JSON.stringify(input), dsnap = JSON.stringify(D), p1 = L.plan(D, input), p2 = L.plan(D, input);
  assert.equal(JSON.stringify(p1), JSON.stringify(p2));
  assert.equal(JSON.stringify(input), snap); assert.equal(JSON.stringify(D), dsnap);
});

test('LE-2 every line balances; stock given plus left equals stock typed; spare is never given', () => {
  const p = plan([list('A', [T('a', 100, 2), T('b', 120, 4)])], { have: { 103: stock(5, 2), 120: stock(1) }, ways: { 101: { by: 'craft' } } });
  for (const ln of Object.values(p.lines)) assert.equal(ln.given + ln.got + ln.makes + ln.outside, ln.need + ln.spare);
  const g = (item) => (p.items[item] || []).reduce((n, k) => n + p.lines[k].given, 0), lf = (p.left[103] || stock());
  assert.equal(g(103) + lf.nq + lf.hq, 7);
  assert.ok((p.spare['120|normal|0'] || 0) >= 0);
});

test('LE-3 crafts and purchases round up; what is made beyond the shortfall is spare', () => {
  const p = plan([list('A', [T('a', 120, 4), T('b', 130, 4)])]);
  const g = line(p, 120); assert.deepEqual([g.crafts, g.makes, g.spare], [2, 6, 2]);
  const v = line(p, 130); assert.deepEqual([v.trades, v.got, v.spare], [4, 4, 0]);
  const p2 = plan([list('A', [T('a', 140, 3)])]); assert.deepEqual([line(p2, 140).trades, line(p2, 140).got, line(p2, 140).spare], [2, 4, 1]);
});

test('LE-4 raising a stock count never raises a total; a covered line passes no need down', () => {
  const lists = [list('A', [T('a', 100, 2)]), list('B', [T('b', 120, 5, { hq: true })])], p1 = plan(lists, { ways: { 101: { by: 'craft' } } });
  let have = {}, prev = p1;
  for (const [item, q] of [[103, 'nq'], [104, 'nq'], [101, 'hq'], [120, 'hq'], [102, 'nq']]) {
    have = clone(have); have[item] = have[item] || stock(); have[item][q] += 2;
    const p = plan(lists, { have, ways: { 101: { by: 'craft' } } }); noRise(prev, p); prev = p;
  }
  const covered = plan([list('A', [T('a', 100, 1)])], { have: { 101: stock(2), 102: stock(1), 103: stock(3) } });
  assert.equal(line(covered, 100).short, 1); assert.equal(line(covered, 104), undefined);
  for (const i of [101, 102, 103]) assert.deepEqual([line(covered, i).short, line(covered, i).crafts], [0, 0]);
});

test('LE-5 removing a wanted item or lowering its amount never raises a total', () => {
  const ts = [T('a', 100, 3), T('b', 120, 4), T('c', 130, 5, { hq: true }), T('d', 140, 3, { make: true, recipe: 0 })];
  const lists = [list('A', ts)], p0 = plan(lists, { have: { 103: stock(2) } });
  for (let i = 0; i < ts.length; i++) {
    const rest = clone(lists); rest[0].targets.splice(i, 1); noRise(p0, plan(rest, { have: { 103: stock(2) } }));
    const lower = clone(lists); lower[0].targets[i].qty = 1; noRise(p0, plan(lower, { have: { 103: stock(2) } }));
  }
});

test('LE-6 a high-quality need uses high-quality stock and sources only; one part per wanted item; flags stay', () => {
  const p = plan([list('A', [T('a', 101, 2, { hq: true })])], { have: { 101: stock(5, 1) } });
  const h = line(p, 101, 'hq'); assert.deepEqual([h.from.nq, h.from.hq, h.given], [0, 1, 1]);
  assert.equal(h.by, 'craft'); assert.ok(h.recipe && D.recipes[h.recipe][6] & 1);
  const q = plan([list('A', [T('a', 130, 2, { hq: true })])]); assert.equal(line(q, 130, 'hq').offer.hq, 1);
  const t = T('a', 101, 2, { hq: true, coll: true, make: true }), copy = clone(t); plan([list('A', [t])]); assert.deepEqual(t, copy);
});

test('LE-7 a collectable wanted item is met by collectable stock or a craft', () => {
  const p = plan([list('A', [T('a', 160, 3, { coll: true, recipe: 1020 })])], { have: { 160: stock(9, 9, 1) } });
  const c = line(p, 160, 'coll', 1020); assert.deepEqual([c.from.coll, c.from.nq, c.from.hq, c.short, c.crafts, c.by], [1, 0, 0, 2, 2, 'craft']);
});

test('LE-8 a trade uses its real ratio and every currency, and the offer is the same at every amount', () => {
  for (let n = 1; n <= 9; n++) {
    const p = plan([list('A', [T('a', 140, n)])]), ln = line(p, 140);
    assert.equal(ln.offer.key, '6001.2.141'); assert.equal(ln.trades, Math.ceil(n / 2));
    assert.equal(line(p, 141).need, ln.trades * 3); assert.equal(p.gil.vendor, ln.trades * 50);
  }
  const p = plan([list('A', [T('a', 102, 1)])], { ways: { 102: { by: 'trade' } } }); assert.equal(line(p, 110).need, 2);
});

test('LE-9 totals do not depend on lists or steps; shares add up to every total', () => {
  const a = T('a', 100, 3, { step: 's2' }), b = T('b', 120, 4), c = T('c', 101, 2, { hq: true }), have = { 103: stock(4), 101: stock(1, 1) };
  const one = plan([list('A', [a, b, c], { s1: { n: 0 }, s2: { n: 1 } })], { have });
  const two = plan([list('B', [c], { x: { n: 0 } }), list('A', [b]), list('C', [a])], { have });
  const rev = plan([list('C', [a]), list('A', [b]), list('B', [c])], { have });
  assert.deepEqual(one.lines, two.lines); assert.deepEqual(one.lines, rev.lines);
  for (const p of [one, two]) for (const k of Object.keys(p.lines)) for (const f of ['need', 'given', 'short', 'crafts', 'trades', 'got', 'makes', 'outside']) assert.equal(sumFields(p, k, f), p.lines[k][f], k + ' ' + f);
});

test('LE-10 the crafting order is valid, blocks are one job, neighbours differ', () => {
  const p = plan([list('A', [T('a', 100, 2)])], { ways: { 101: { by: 'craft' } } }), pos = {};
  let at = 0; p.order.forEach((b, i) => { if (i) assert.notEqual(b.job, p.order[i - 1].job); b.crafts.forEach((k) => { assert.equal(p.lines[k].job, b.job); pos[k] = at++; }); });
  assert.ok(pos['101|normal|0'] < pos['100|normal|0'] && pos['102|normal|0'] < pos['100|normal|0']);
  assert.equal(at, 3);
});

test('LE-11 "already have" is an outside supply, counted and named', () => {
  const p = plan([list('A', [T('a', 120, 5)])], { ways: { 120: { by: 'have' } }, have: { 120: stock(2) } }), ln = line(p, 120);
  assert.deepEqual([ln.need, ln.given, ln.outside, ln.short, ln.crafts, ln.got], [5, 2, 3, 3, 0, 0]); assert.deepEqual(p.shop.outside, ['120|normal|0']); assert.equal(line(p, 103), undefined);
});

const stateOf = (lists, have, ways) => ({ have: have || {}, targets: tm(lists), ways: ways || {} });
test('LE-12 recording a craft: always, and when nothing was short', () => {
  const lists = [list('A', [T('a', 101, 4)])], ways = { 101: { by: 'craft' } }, have = { 104: stock(6) }, p = plan(lists, { ways, have });
  const r = L.record(D, stateOf(lists, have, ways), p, { line: line(p, 101), times: 1, quality: 'nq', targets: {} });
  assert.deepEqual(r.have[101], stock(1)); assert.deepEqual(r.have[104], stock(4)); assert.deepEqual(r.short, []);
  const p2 = plan(lists, { ways, have: r.have }); assert.equal(line(p2, 101).crafts, 3); noRise(p, p2);
  const none = L.record(D, stateOf(lists, {}, ways), plan(lists, { ways }), { line: line(plan(lists, { ways }), 101), times: 2, quality: 'nq', targets: {} });
  assert.deepEqual(none.short, [104]); assert.deepEqual(none.have[101], stock(2)); assert.equal(none.have[104], undefined);
});

test('LE-13 removing a wanted item and adding an equal one back leaves every total equal', () => {
  const ts = [T('a', 100, 3), T('b', 120, 4)], p0 = plan([list('A', ts)], { have: { 103: stock(2) } });
  const back = [ts[1], Object.assign({}, ts[0], { id: 'z' })];
  assert.deepEqual(plan([list('A', back)], { have: { 103: stock(2) } }).lines, p0.lines);
});

test('LE-14 every loop is cut at its lowest item, whatever the stock and the wanted items', () => {
  const all = [T('a', 150, 1), T('b', 152, 1), T('c', 153, 1), T('d', 155, 1)], p = plan([list('A', all)]);
  assert.deepEqual(Object.keys(p.cut).sort(), ['150', '151', '153', '155']);
  for (const k of [150, 151, 153, 155]) for (const ln of p.items[k].map((x) => p.lines[x])) assert.equal(ln.by, 'other');
  const p2 = plan([list('A', [T('x', 152, 3), T('y', 100, 1)])], { have: { 151: stock(9), 103: stock(1) } });
  assert.deepEqual(Object.keys(p2.cut), ['151']); assert.deepEqual(L.cuts(D, inp([list('A', [T('x', 151, 1)])])), { 151: p2.cut[151] });
});

test('LE-15 gil: priced items counted, unpriced named and never 0', () => {
  const p = plan([list('A', [T('a', 100, 1)])], { prices: { 111: 30 } }); assert.equal(p.gil.market, 60); assert.deepEqual(p.gil.unknown, []);
  const q = plan([list('A', [T('a', 100, 1)])], { prices: { 111: 0 } }); assert.equal(q.gil.market, 0); assert.deepEqual(q.gil.unknown, [111]); assert.equal(line(q, 111).cost, null);
  assert.equal(p.gil.vendor, 100);
});

test('LE-16 stock given never exceeds stock typed, whichever list; shares add up', () => {
  const lists = [list('A', [T('a', 120, 3)]), list('B', [T('b', 120, 3), T('c', 120, 2, { hq: true })])], p = plan(lists, { have: { 120: stock(4, 1) } });
  const g = (q) => p.items[120].reduce((n, k) => n + p.lines[k].from[q], 0); assert.ok(g('nq') <= 4 && g('hq') <= 1); assert.equal(g('nq') + g('hq'), 5);
  const sh = p.shares.reduce((n, s) => n + Object.values(s.lines).reduce((m, v) => m + v.from.nq + v.from.hq, 0), 0); assert.equal(sh, 5);
  assert.deepEqual(p.shares.map((s) => s.list), ['A', 'B']);
});

test('LE-17 with the default order a gil merchant\'s item is bought; every need has a source', () => {
  const p = plan([list('A', [T('a', 100, 1), T('b', 101, 3)])]);
  assert.equal(line(p, 101).by, 'vendor'); assert.equal(line(p, 104), undefined); assert.equal(line(p, 101).need, 5);
  const fromSources = line(p, 103).need === 3; assert.ok(fromSources);
});

test('LE-18 changing how an item is got, and units bought', () => {
  const lists = [list('A', [T('a', 100, 1)])], ways = { 101: { by: 'craft' } }, have = { 104: stock(4) }, p0 = plan(lists, { ways, have });
  const v = plan(lists, { ways: { 101: { by: 'vendor' } }, have }); noRise(p0, v, (b) => b.item === 101);
  for (const by of ['market', 'have']) { const x = plan(lists, { ways: { 101: { by } }, have }); noRise(p0, x, (b) => b.item === 101); assert.equal(line(x, 101).crafts || 0, 0); }
  const t = plan(lists, { ways: { 102: { by: 'craft' }, 101: { by: 'craft' } }, have }), t2 = plan(lists, { ways: { 102: { by: 'trade' }, 101: { by: 'craft' } }, have });
  noRise(t, t2, (b) => b.item === 102 || b.item === 110);
  assert.deepEqual(plan(lists, { ways, have }), p0);
  const h2 = L.bought(have, 101, 1, 'nq'); assert.deepEqual(h2[101], stock(1)); assert.deepEqual(h2[104], have[104]);
  const b = plan(lists, { ways, have: h2 }); noRise(p0, b); assert.equal(line(b, 101).crafts, 1);
  const back = plan(lists, { ways: { 101: { by: 'vendor' } }, have: h2 }); assert.ok(line(back, 101).got >= 1);
});

test('LE-19 Finished: a row changes no stock; a step lowers only its own items\' stock; no total rises', () => {
  const lists = [list('A', [T('a', 120, 2, { step: 's1' }), T('b', 100, 1, { step: 's2' })], { s1: { n: 0 }, s2: { n: 1 } })], have = { 120: stock(2), 103: stock(3) }, p = plan(lists, { have });
  const rowDone = clone(lists); rowDone[0].targets[0].done = true; noRise(p, plan(rowDone, { have }));
  const r = L.finishStep(p, stateOf(lists, have), 'A', 's1');
  assert.equal(r.targets['A.a'].done, true); assert.equal(r.targets['A.b'].done, undefined); assert.equal(r.have[120], undefined); assert.deepEqual(r.have[103], stock(3));
  const done = clone(lists); done[0].targets[0].done = true; noRise(p, plan(done, { have: r.have }));
});

// ---------------------------------------------------------------------------------------------------- replays of the Teamcraft faults
test('replay #983: a recipe that yields several lowers the totals as crafts are recorded', () => {
  let lists = [list('A', [T('a', 120, 6)])], have = {}, p = plan(lists);
  assert.equal(line(p, 103).need, 2);
  const r = L.record(D, stateOf(lists, { 103: stock(2) }), plan(lists, { have: { 103: stock(2) } }), { line: line(p, 120), times: 1, quality: 'nq', targets: {} });
  const p2 = plan(lists, { have: r.have }); assert.equal(line(p2, 103).need, 1); assert.equal(line(p2, 120).crafts, 1);
});
test('replay #2971: removing a finished item does not make a completed requirement fall back', () => {
  const lists = [list('A', [T('a', 120, 3), T('b', 100, 1)])], have = { 120: stock(3) }, p = plan(lists, { have }), rem = clone(lists); rem[0].targets.splice(1, 1);
  const p2 = plan(rem, { have }); assert.equal(line(p2, 120).short, 0); assert.equal(p2.lines['120|normal|0'].need, 3); noRise(p, p2);
});
test('replay #1721: stock a craft used up is not offered again to the next list', () => {
  const p = plan([list('A', [T('a', 120, 3)]), list('B', [T('b', 120, 3)])], { have: { 120: stock(3) } });
  assert.equal(line(p, 120).given, 3); assert.equal(line(p, 120).short, 3); assert.equal(p.shares[0].lines['120|normal|0'].given, 3); assert.equal(p.shares[1].lines['120|normal|0'].given, 0);
});
test('replay #559: a trade that is not one for one is not counted as one for one', () => {
  const p = plan([list('A', [T('a', 140, 3)])]); assert.equal(line(p, 140).trades, 2); assert.equal(line(p, 141).need, 6);
});
test('replay #2896: crafted collectables count toward the list', () => {
  const p = plan([list('A', [T('a', 160, 2, { coll: true, recipe: 1020 })])]); assert.equal(line(p, 160, 'coll', 1020).crafts, 2);
  const q = plan([list('A', [T('a', 160, 2, { coll: true, recipe: 1020 })])], { have: { 160: stock(0, 0, 2) } }); assert.deepEqual([line(q, 160, 'coll', 1020).short, line(q, 160, 'coll', 1020).crafts], [0, 0]);
});
test('replay #3113: high quality stays on the wanted item through a copy', () => {
  const lists = [list('A', [T('a', 101, 2, { hq: true, make: true, recipe: 1001 })])], copy = clone(lists);
  assert.deepEqual(copy, lists); assert.ok(plan(copy).lines['101|make|1001']);
});
test('replay #40 and #39: removing an item leaves no materials; a cleared amount is ignored and the item stays in the input', () => {
  const lists = [list('A', [T('a', 100, 1), T('b', 120, 1)])]; lists[0].targets.splice(0, 1);
  const p = plan(lists); assert.equal(line(p, 101), undefined); assert.equal(line(p, 102), undefined);
  const z = [list('A', [T('a', 100, 0)])]; assert.deepEqual(plan(z).lines, {}); assert.equal(z[0].targets.length, 1);
});

// ---------------------------------------------------------------------------------------------------- the owner's case and the reviews
test('LE-R9 the owner\'s case: the gil merchant first, the other-currency material crafted', () => {
  const p = plan([list('A', [T('a', 100, 1)])]);
  assert.ok(p.shop.vendor.includes('101|normal|0')); const v = line(p, 101); assert.deepEqual([v.offer.npc, v.offer.cur[0][1], v.trades], [5101, 50, 2]);
  assert.equal(D.npcs[v.offer.npc][0], 'Fenn');
  assert.ok(!p.order.some((b) => b.crafts.includes('101|normal|0'))); assert.equal(line(p, 104), undefined);
  assert.equal(line(p, 102).by, 'craft'); assert.equal(line(p, 110), undefined); assert.ok(p.shop.gather.includes('103|normal|0'));
});
test('LE-R10 a recorded craft, then vendor, bought and trade: E18 and what is left over', () => {
  const lists = [list('A', [T('a', 100, 1)])], ways = { 101: { by: 'craft' }, 102: { by: 'craft' } }, have = { 104: stock(4) }, p = plan(lists, { ways, have });
  const r = L.record(D, stateOf(lists, have, ways), p, { line: line(p, 101), times: 1, quality: 'nq', targets: {} }), p1 = plan(lists, { ways, have: r.have });
  const v = plan(lists, { ways: Object.assign({}, ways, { 101: { by: 'vendor' } }), have: r.have }); noRise(p1, v, (b) => b.item === 101);
  assert.deepEqual(v.leftover.A, [{ item: 104, nq: 2, hq: 0 }]); assert.equal(line(v, 101).trades, 1);
  const bo = L.bought(r.have, 101, 2, 'nq'), pb = plan(lists, { ways, have: bo }); noRise(p1, pb); assert.deepEqual([line(pb, 101).short, line(pb, 101).crafts], [0, 0]);
  assert.deepEqual(pb.leftover.A, [{ item: 101, nq: 1, hq: 0 }, { item: 104, nq: 2, hq: 0 }]);
  const t = plan(lists, { ways: Object.assign({}, ways, { 102: { by: 'trade' } }), have: r.have }); noRise(p1, t, (b) => b.item === 102 || b.item === 110); assert.equal(line(t, 110).need, 2);
  assert.deepEqual(plan(lists, { ways, have: r.have }), p1);
});
test('LE-R11 two lists and an item that makes 3: every removal and stock rise on totals, one share rises', () => {
  const lists = [list('A', [T('a', 120, 1)]), list('B', [T('b', 120, 2)])], p = plan(lists);
  assert.equal(line(p, 120).crafts, 1); assert.equal(p.shares[0].lines['120|normal|0'].crafts, 1); assert.equal(p.shares[1].lines['120|normal|0'].crafts, 0);
  const rem = [lists[1]], q = plan(rem); noRise(p, q); assert.equal(q.shares[0].lines['120|normal|0'].crafts, 1);
  const rem2 = [lists[0]]; noRise(p, plan(rem2));
  for (const n of [1, 2, 3]) noRise(p, plan(lists, { have: { 120: stock(n), 103: stock(n) } }));
});
test('LE-R12 one high-quality X held, a normal-only merchant: the same in one step or two', () => {
  const have = { 101: stock(0, 1) }, a = T('a', 101, 1, { hq: true, step: 's1' }), b = T('b', 101, 1, { step: 's2' });
  for (const lists of [[list('A', [a, b], { s1: { n: 0 }, s2: { n: 1 } })], [list('A', [a]), list('B', [b])], [list('A', [T('a', 101, 1, { hq: true }), T('b', 101, 1)])]]) {
    const p = plan(lists, { have }); assert.equal(line(p, 101, 'hq').given, 1); assert.equal(line(p, 101).by, 'vendor'); assert.equal(line(p, 101).trades, 1); assert.equal(line(p, 101, 'hq').short, 0);
  }
});
test('LE-R13 a crafting-log page whose entry is also another entry\'s material', () => {
  assert.deepEqual(L.missing(D, new Set([1010]), [], 2, 0), [1000, 1001]); assert.deepEqual(L.missing(D, {}, null, 2, 9), []);
  const p = plan([list('A', [T('a', 100, 1, { make: true, recipe: 1000 }), T('b', 101, 1, { make: true, recipe: 1001 })])]);
  assert.equal(line(p, 101, 'make', 1001).crafts, 1); assert.equal(line(p, 101).by, 'vendor'); assert.equal(line(p, 101).need, 2);
});
test('LE-R14 loops: each plan ends, the lowest id is cut and noted, the same with other stock and wanted items', () => {
  for (const [item, cutItem] of [[150, 150], [152, 151], [153, 153], [155, 155], [156, 155]]) {
    const a = plan([list('A', [T('a', item, 2)])]), b = plan([list('B', [T('x', item, 5), T('y', 100, 2)])], { have: { [item]: stock(1), 103: stock(9) } });
    for (const p of [a, b]) { assert.ok(Object.keys(p.cut).includes(String(cutItem))); assert.ok(/listed under Other/.test(p.cut[cutItem])); assert.equal(line(p, cutItem).by, 'other'); }
    assert.deepEqual(Object.keys(a.cut), Object.keys(b.cut));
  }
});
test('LE-R15 the trade "2 for 3 Y and 50 gil", 3 wanted', () => {
  const p = plan([list('A', [T('a', 140, 3)])]); assert.deepEqual([line(p, 140).trades, line(p, 141).need, p.gil.vendor, line(p, 142).need], [2, 6, 100, 12]);
});
test('LE-R16 gil offers "1 for 100" and "3 for 280", shortfall 4; a high-quality need takes the fifth offer', () => {
  const p = plan([list('A', [T('a', 130, 4)])]), v = line(p, 130); assert.deepEqual([v.trades, v.cost, v.offer.npc], [4, 400, 5001]); assert.equal(D.npcs[v.offer.npc][0], 'Alda');
  const q = line(plan([list('A', [T('a', 130, 4, { hq: true })])]), 130, 'hq'); assert.deepEqual([q.offer.npc, q.offer.hq, q.by], [5005, 1, 'vendor']);
  assert.equal(line(plan([list('A', [T('a', 130, 6)])]), 130).offer.npc, 5002);
});
test('LE-R17 recording: must-craft with an ordinary one, three recordings, short, another quality', () => {
  let lists = [list('A', [T('a', 120, 3, { make: true, recipe: 1010 })]), list('B', [T('b', 120, 1)])], p = plan(lists);
  assert.deepEqual([line(p, 120, 'make', 1010).crafts, line(p, 120).crafts], [1, 1]);
  const r = L.record(D, stateOf(lists, { 103: stock(2) }), plan(lists, { have: { 103: stock(2) } }), { line: line(p, 120, 'make', 1010), times: 1, quality: 'nq', targets: { 'A.a': 3 } });
  assert.equal(r.targets['A.a'].crafted, 3); lists[0].targets[0].crafted = 3; const p2 = plan(lists, { have: r.have }); assert.ok(quiet(p2));
  let ls = [list('A', [T('a', 161, 3, { make: true, recipe: 1021 })])], have = { 103: stock(9) };
  for (let i = 1; i <= 3; i++) {
    const pp = plan(ls, { have }), rr = L.record(D, stateOf(ls, have), pp, { line: line(pp, 161, 'make', 1021), times: 1, quality: 'nq', targets: { 'A.a': 1 } });
    assert.equal(rr.targets['A.a'].crafted, i); ls[0].targets[0].crafted = i; have = rr.have;
  }
  const pn = plan([list('A', [T('a', 100, 1)])]), rs = L.record(D, stateOf([list('A', [T('a', 100, 1)])], {}), pn, { line: line(pn, 100), times: 1, quality: 'nq', targets: {} });
  assert.deepEqual(rs.short.sort(), [101, 102, 103]); assert.deepEqual(rs.have, { 100: stock(1) });
  const rh = L.record(D, stateOf([list('A', [T('a', 100, 1)])], {}), pn, { line: line(pn, 100), times: 1, quality: 'hq', targets: {} }); assert.deepEqual(rh.have[100], stock(0, 1));
});
test('LE-R18 have: need 5, stock 0: outside 5, balanced, nothing below', () => {
  const p = plan([list('A', [T('a', 100, 5)])], { ways: { 100: { by: 'have' } } }), ln = line(p, 100);
  assert.deepEqual([ln.outside, ln.need, ln.given], [5, 5, 0]); assert.equal(ln.given + ln.outside, ln.need + ln.spare); assert.deepEqual(Object.keys(p.lines), ['100|normal|0']);
});
test('LE-R19 every combination of hq, coll and make counts in exactly one part', () => {
  const cases = [[160, 1020, true], [161, 1021, false], [170, 0, true], [120, 1010, false]];
  for (const [item, recipe, collectable] of cases) for (let bits = 0; bits < 8; bits++) {
    const hq = !!(bits & 1), coll = !!(bits & 2), make = !!(bits & 4), t = T('a', item, 2, { hq, coll, make, recipe });
    const want = make && recipe ? 'make' : coll && collectable ? 'coll' : hq ? 'hq' : 'normal', p = plan([list('A', [t])]);
    const mine = Object.values(p.lines).filter((ln) => ln.item === item && ln.need > 0 && ln.part === want);
    assert.equal(mine.length, 1, item + ' ' + bits); assert.equal(mine[0].need, 2);
    assert.equal(Object.values(p.lines).filter((ln) => ln.item === item).length, 1, item + ' ' + bits + ' one part only');
  }
});
test('LE-R20 bought fewer, equal and more, in each quality', () => {
  for (const q of ['nq', 'hq']) {
    const lists = [list('A', [T('a', 120, 5, q === 'hq' ? { hq: true } : {})])], part = q === 'hq' ? 'hq' : 'normal', p0 = plan(lists);
    assert.equal(line(p0, 120, part).crafts, 2);
    const few = plan(lists, { have: L.bought({}, 120, 2, q) }); assert.deepEqual([line(few, 120, part).short, line(few, 120, part).crafts], [3, 1]); assert.equal(line(few, 103).need, 1);
    const eq = plan(lists, { have: L.bought({}, 120, 5, q) }); assert.ok(quiet(eq));
    const more = plan(lists, { have: L.bought({}, 120, 7, q) }); assert.ok(quiet(more)); assert.deepEqual(more.left[120], q === 'hq' ? stock(0, 2) : stock(2));
  }
});
test('LE-R21 row and step Finished', () => {
  const lists = [list('A', [T('a', 120, 3, { step: 's1' }), T('b', 140, 1, { step: 's2' })], { s1: { n: 0 }, s2: { n: 1 } })], have = { 120: stock(3), 142: stock(5) }, p = plan(lists, { have });
  const row = clone(lists); row[0].targets[0].done = true; const pr = plan(row, { have }); assert.equal(line(pr, 120), undefined); assert.deepEqual(have, { 120: stock(3), 142: stock(5) }); noRise(p, pr);
  const r = L.finishStep(p, stateOf(lists, have), 'A', 's1'); assert.equal(r.have[120], undefined); assert.deepEqual(r.have[142], stock(5)); assert.equal(r.targets['A.a'].done, true);
  const r2 = L.finishStep(p, stateOf(lists, have), 'A', 's2'); assert.deepEqual(r2.have[120], stock(3)); assert.deepEqual(r2.have[142], stock(5), 'materials are never taken'); assert.equal(r2.targets['A.b'].done, true);
});

// ---------------------------------------------------------------------------------------------------- the two counterexamples of the model test
test('LE-CE1 (D28) a step handed in with a craft that makes 2 shared by two lists raises no total', () => {
  const data = { items: { 1: ['Gil', 1, 0], 10: ['X', 1, 0], 11: ['M', 1, 0] }, recipes: { 1000: [10, 2, 1, 1, 0, [[11, 1]], 0] }, gather: {}, trades: {}, npcs: {} };
  const lists = [list('A', [T('t1', 10, 1, { step: 'a' })], { a: { n: 0 } }), list('B', [T('t2', 10, 1)])], have = { 11: stock(1) }, p = plan(lists, { have }, data);
  const r = L.finishStep(p, stateOf(lists, have), 'A', 'a'); assert.deepEqual(r.have, have, 'the material stays');
  const done = clone(lists); done[0].targets[0].done = true; noRise(p, plan(done, { have: r.have }, data));
});
test('LE-CE2 (D27) recording never takes stock another line holds', () => {
  const data = { items: { 1: ['Gil', 1, 0], 10: ['Y', 1, 0], 11: ['M', 1, 0] }, recipes: { 1000: [10, 1, 1, 1, 0, [[11, 1]], 0] }, gather: {}, trades: {}, npcs: {} };
  const lists = [list('A', [T('t1', 11, 1, { hq: true }), T('t2', 10, 1, { make: true, recipe: 1000 })])], have = { 11: stock(0, 1) }, p = plan(lists, { have }, data);
  const r = L.record(data, stateOf(lists, have), p, { line: line(p, 10, 'make', 1000), times: 1, quality: 'nq', targets: { 'A.t2': 1 } });
  assert.deepEqual(r.short, [11]); assert.deepEqual(r.have[11], stock(0, 1)); assert.deepEqual(r.have[10], stock(1));
});

test('nextWindow: Eorzea time windows, open now or next', () => {
  assert.equal(L.nextWindow(0, 0, 1), null);
  const H = 175000, w = L.nextWindow([1, 13], 180, 0); assert.deepEqual(w, { opensAt: H, closesAt: 4 * H, open: false });
  const o = L.nextWindow([1, 13], 180, 2 * H); assert.deepEqual([o.open, o.opensAt, o.closesAt], [true, H, 4 * H]);
});

test('LE-GONE a must-craft item whose recipe left the game data stays in the list and asks for nothing', () => {
  const data = { items: { 1: ['Gil', 1, 0], 10: ['Y', 1, 0], 11: ['M', 1, 0] }, recipes: { 1000: [10, 1, 1, 1, 0, [[11, 2]], 0] }, gather: {}, trades: {}, npcs: {} };
  const gone = T('t1', 12, 3, { make: true, recipe: 1999 }), keep = T('t2', 10, 1, { make: true, recipe: 1000 });
  const lists = [list('A', [gone, keep])], copy = clone(lists), p = plan(lists, {}, data);
  assert.deepEqual(lists, copy);
  assert.equal(Object.keys(p.lines).some((k) => k.startsWith('12|')), false);
  assert.ok(line(p, 10, 'make', 1000)); assert.equal(line(p, 11).need, 2);
  assert.equal(Object.keys(plan([list('A', [gone])], {}, data).lines).length, 0);
  assert.equal(L.tree(data, lists).has(12), false);
});

// ---- B3 (docs/lists-look-spec.md, D-C1): the counted recipe of an item with several crafters
test('LE-B3a the counted recipe follows ways.recipe, else the lowest level then lowest id; a must-craft row keeps its own recipe', () => {
  const lists = [list('A', [T('a', 101, 2)])];
  const def = plan(lists, { ways: { 101: { by: 'craft' } } });
  assert.deepEqual([line(def, 101).recipe, line(def, 101).job], [1001, 1], 'default: the level 10 recipe');
  assert.equal(line(def, 104).need, 4, 'its materials: 4 of 104 (two crafts)');
  const set = plan(lists, { ways: { 101: { by: 'craft', recipe: 1003 } } });
  assert.deepEqual([line(set, 101).recipe, line(set, 101).job, line(set, 101).need], [1003, 1, 2], 'ways.recipe 1003 is counted');
  assert.equal(line(set, 103).need, 3, 'the materials of recipe 1003: 3 of 103');
  assert.ok(!line(set, 104), 'the materials of the default recipe are no longer asked for');
  // a recipe of another item is ignored
  assert.equal(line(plan(lists, { ways: { 101: { by: 'craft', recipe: 1000 } } }), 101).recipe, 1001);
  // a crafting-log wanted item keeps its own recipe whatever ways.recipe says
  const mk = plan([list('A', [T('a', 101, 1, { make: true, recipe: 1001 })])], { ways: { 101: { recipe: 1003 } } });
  assert.ok(line(mk, 101, 'make', 1001) && !line(mk, 101, 'make', 1003));
});

test('LE-B3b an item whose crafters have identical ingredients plans the same whichever recipe is counted', () => {
  const data = clone(D);
  data.recipes[1099] = [101, 1, 2, 30, 0, clone(data.recipes[1001][5]), data.recipes[1001][6]]; // a second job, same ingredients
  const lists = [list('A', [T('a', 101, 3)])];
  const a = plan(lists, { ways: { 101: { by: 'craft' } } }, data), b = plan(lists, { ways: { 101: { by: 'craft', recipe: 1099 } } }, data);
  assert.equal(line(a, 101).recipe, 1001); assert.equal(line(b, 101).recipe, 1099);
  const strip = (p) => { const c = clone(p); for (const ln of Object.values(c.lines)) { delete ln.recipe; delete ln.job; } for (const o of c.order) delete o.job; return JSON.stringify(c); };
  assert.equal(strip(b).replace(/1099/g, 'R'), strip(a).replace(/1001/g, 'R'));
});

// ---- R2: the chosen spot of a gather row (docs/lists-redteam.md, the owner's answer 1A) ----
{
  const sp = (level, zone, hours, minutes) => [0, 1, level, zone, 10, 10, 5, hours || 0, minutes || 0, 0, 0];
  const gp = (...items) => ({ lines: Object.fromEntries(items.map((i) => [i + '|normal|0', { item: i, by: 'gather' }])) });
  const ctx = (spots, plan) => ({ spots, plan });

  test('LE-R2a an item whose lowest spot is elsewhere but another spot is in the route zone gets the route spot, and says why', () => {
    const spots = { 1: [sp(5, 'Elsewhere'), sp(20, 'Mor Dhona')], 2: [sp(15, 'Mor Dhona')] };
    const c = L.chosenSpot(1, ctx(spots, gp(1, 2)));
    assert.equal(c.spot, spots[1][1]); assert.equal(c.index, 1); assert.equal(c.route, 1);
    assert.equal(c.why, 'Chosen: on your route in Mor Dhona');
    assert.equal(L.chosenSpot(2, ctx(spots, gp(1, 2))).spot, spots[2][0], 'the other row keeps its only spot');
  });

  test('LE-R2b a list with one gather item gets its lowest spot, and an own zone never votes for itself', () => {
    const spots = { 1: [sp(5, 'Elsewhere'), sp(20, 'Mor Dhona'), sp(20, 'Mor Dhona')] };
    const c = L.chosenSpot(1, ctx(spots, gp(1)));
    assert.equal(c.spot, spots[1][0]); assert.equal(c.index, 0); assert.equal(c.why, '');
    assert.equal(L.chosenSpot(1, ctx(spots, { lines: {} })).spot, spots[1][0], 'an empty plan gives the lowest spot');
    assert.equal(L.chosenSpot(9, ctx(spots, gp(1))), null, 'no spots, no choice');
  });

  test('LE-R2c ties: most other rows, then lowest level, then the table order (nearest aetheryte, lowest node id); deterministic', () => {
    // two zones with other rows: Zone B has two rows, Zone C one: B wins although C has the lower level
    let spots = { 1: [sp(5, 'A'), sp(30, 'C'), sp(40, 'B')], 2: [sp(1, 'B')], 3: [sp(1, 'B'), sp(1, 'C')] };
    assert.equal(L.chosenSpot(1, ctx(spots, gp(1, 2, 3))).spot, spots[1][2]);
    // equal row counts: the lower level wins
    spots = { 1: [sp(5, 'A'), sp(40, 'B'), sp(30, 'C')], 2: [sp(1, 'B')], 3: [sp(1, 'C')] };
    assert.equal(L.chosenSpot(1, ctx(spots, gp(1, 2, 3))).spot, spots[1][2]);
    // equal count and level: the first of the table (nearest aetheryte, then lowest id)
    spots = { 1: [sp(5, 'A'), sp(30, 'B'), sp(30, 'C')], 2: [sp(1, 'B')], 3: [sp(1, 'C')] };
    const a = L.chosenSpot(1, ctx(spots, gp(1, 2, 3))), b = L.chosenSpot(1, ctx(spots, gp(3, 2, 1)));
    assert.equal(a.spot, spots[1][1]); assert.deepEqual(a, b, 'the order of the lines does not matter');
    // a row that is not gathered does not vote
    const other = gp(2); other.lines['3|normal|0'] = { item: 3, by: 'craft' };
    spots = { 1: [sp(5, 'A'), sp(30, 'C')], 2: [sp(1, 'B')], 3: [sp(1, 'C')] };
    assert.equal(L.chosenSpot(1, ctx(spots, other)).spot, spots[1][0]);
  });

  test('LE-R7a the chosen spot counts the zones of the rows on screen only: a row of another list, or one with nothing left to get, does not pull it', () => {
    const spots = { 1: [sp(5, 'A'), sp(30, 'C')], 3: [sp(1, 'C')] };
    const full = { lines: { '1|normal|0': { item: 1, by: 'gather', short: 2 }, '3|normal|0': { item: 3, by: 'gather', short: 4 } } };
    const bothShown = L.gatherScope(full, { '1|normal|0': { short: 2 }, '3|normal|0': { short: 4 } });
    assert.deepEqual(Object.keys(bothShown.lines).sort(), ['1|normal|0', '3|normal|0']);
    assert.equal(L.chosenSpot(1, ctx(spots, bothShown)).spot, spots[1][1], 'with both rows on screen the shared zone C is chosen');
    const onlyOne = L.gatherScope(full, { '1|normal|0': { short: 2 } }); // the other row belongs to a list that is not on screen
    assert.deepEqual(Object.keys(onlyOne.lines), ['1|normal|0']);
    assert.equal(L.chosenSpot(1, ctx(spots, onlyOne)).spot, spots[1][0], 'a row that is not on screen pulls nothing: the lowest spot stays');
    assert.equal(L.chosenSpot(1, ctx(spots, L.gatherScope(full, { '1|normal|0': { short: 2 }, '3|normal|0': { short: 0 } }))).spot, spots[1][0], 'nor does a row with nothing left to get');
    assert.equal(L.chosenSpot(1, ctx(spots, full)).spot, spots[1][1], 'the unscoped plan (the earlier behaviour) is pulled by the other list');
  });

  test('LE-R2d the window is the chosen spot\'s own, never merged across spots', () => {
    const spots = { 1: [sp(50, 'Z1', [1, 5, 9], 180), sp(50, 'Mor Dhona', [13, 17, 21], 180)], 2: [sp(1, 'Mor Dhona')] };
    const c = L.chosenSpot(1, ctx(spots, gp(1, 2)));
    assert.deepEqual([c.spot[7], c.spot[8]], [[13, 17, 21], 180]);
    const alone = L.chosenSpot(1, ctx(spots, gp(1)));
    assert.deepEqual([alone.spot[7], alone.spot[8]], [[1, 5, 9], 180]);
  });

  test('LE-R2e the engine still plans from the gather table the build makes from the spots (has a gather source)', () => {
    const spots = { 103: [sp(5, 'Z', [2], 120)] };
    const data = clone(D); data.gather = { 103: [0, 5, 'Z', [2], 120] };
    const p = plan([list('A', [T('a', 103, 1)])], {}, data);
    assert.equal(line(p, 103).by, 'gather');
    assert.deepEqual(L.chosenSpot(103, ctx(spots, p)).spot, spots[103][0]);
  });
}

// R3 (docs/lists-redteam.md): the page's pure helpers
{
  const row = (key, a, b, name, rank) => ({ key, a, b, name, rank: rank === undefined ? null : rank });
  test('LE-R3a groupRows: the first level with most rows first then by name, the unnamed last; the second level the same; ranked rows first by rank, then by name; the input order does not matter', () => {
    const rows = [row('k1', 'B', 'x', 'Zed'), row('k2', 'A', 'y', 'Ash'), row('k3', 'B', 'x', 'Ant'), row('k4', 'B', '', 'Bee'), row('k5', '', '', 'Nil'), row('k6', 'A', 'y', 'Elm', 50), row('k7', 'A', 'y', 'Fir', 10), row('k8', 'B', 'x', 'Oak', 900)];
    const want = [{ a: 'B', n: 4, subs: [{ b: 'x', n: 3, keys: ['k8', 'k3', 'k1'] }, { b: '', n: 1, keys: ['k4'] }] }, { a: 'A', n: 3, subs: [{ b: 'y', n: 3, keys: ['k7', 'k6', 'k2'] }] }, { a: '', n: 1, subs: [{ b: '', n: 1, keys: ['k5'] }] }];
    assert.deepEqual(L.groupRows(rows), want);
    assert.deepEqual(L.groupRows(rows.slice().reverse()), want);
    assert.deepEqual(L.groupRows([row('a', 'M', '', 'n'), row('b', 'K', '', 'n')]).map((g) => g.a), ['K', 'M'], 'equal counts go by name');
    assert.deepEqual(L.groupRows([]), []);
    assert.deepEqual(L.groupRows(null), []);
  });
  test('LE-R3b shownSeller: among the sellers at the planned price the one in the most visited place; a tie keeps the planned seller; a dearer seller or an unknown planned one never changes it', () => {
    const place = { 1: 'Old', 2: 'South', 3: 'South', 4: 'Far', 5: 'Old' };
    const list = [[1, 100], [2, 100], [3, 100], [4, 90], [5, 150]];
    const at = (planned, visits) => L.shownSeller(list, planned, (n) => place[n], visits);
    assert.equal(at(1, { South: 1 }), 2, 'the lowest id of the visited place');
    assert.equal(at(1, { South: 1, Old: 1 }), 1, 'a tie keeps the planned seller');
    assert.equal(at(1, {}), 1);
    assert.equal(at(1, null), 1);
    assert.equal(at(1, { Far: 9, Old: 0 }), 1, 'a seller at another price is not a candidate');
    assert.equal(at(1, { South: 2, Old: 1 }), 2);
    assert.equal(at(99, { South: 5 }), 99, 'a planned seller that is not in the list stays');
    assert.equal(at(2, { Old: 3, South: 1 }), 1, 'the visited place of another candidate wins over the planned one');
    assert.equal(L.shownSeller(undefined, 7, () => '', {}), 7);
  });
  test('LE-R3c bookEntries: by exact name; a name twice or not at all is never matched; the real data maps 110 of 110 master books', () => {
    const r = L.bookEntries({ 10: 'Master A', 11: 'Master B', 12: 'Master C', 13: 'Master D' }, [{ i: 1, n: 'Master A' }, { i: 2, n: 'Master B' }, { i: 3, n: 'Master B' }, { i: 4, n: 'master c' }]);
    assert.deepEqual(r.map, { 10: 1 });
    assert.deepEqual(r.missing, [11, 12, 13]);
    const lists = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'lists.json'), 'utf8'));
    const tracker = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tracker-data.json'), 'utf8'));
    const entries = [].concat(...tracker.sections.find((s) => s.id === 'masterbooks').g.map((g) => g.e));
    const real = L.bookEntries(lists.bookNames, entries);
    assert.equal(Object.keys(lists.bookNames).length, 110);
    assert.equal(Object.keys(real.map).length, 110);
    assert.deepEqual(real.missing, []);
    for (const b of Object.keys(real.map)) assert.equal(entries.find((e) => e.i === real.map[b]).n, lists.bookNames[b]);
  });
  test('LE-R3d materialsOf: the ingredients of the crafted lines of a plan, and nothing else', () => {
    const p = plan([list('A', [T('a', 100, 1, { make: true })])]);
    const m = L.materialsOf(D, p), want = {};
    for (const k of Object.keys(p.lines)) if (p.lines[k].by === 'craft') D.recipes[p.lines[k].recipe][5].forEach((g) => { want[g[0]] = 1; });
    assert.deepEqual(m, want);
    assert.ok(Object.keys(m).length > 0, 'the fixture item is crafted from materials');
    assert.deepEqual(L.materialsOf(D, null), {});
  });
}
