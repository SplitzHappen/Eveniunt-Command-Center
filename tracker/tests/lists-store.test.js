'use strict';
// The Lists edit functions (work item W7 of docs/lists-spec.md): ST-1 to ST-15. Run: node tests/lists-store.test.js
// Every edit is a pure function of the section: it returns the new section and an undo entry (the units it replaced and the units it wrote),
// or a plain line and no change. Sizes are limited here and only here (D20).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'src', 'core', 'save.js'));
const CC = globalThis.CC;
require(path.join(__dirname, '..', 'command-center', 'src', 'lists', 'engine.js'));
require(path.join(__dirname, '..', 'command-center', 'src', 'lists', 'store.js'));
const L = globalThis.LISTS, S = L.store;
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'lists-fixture.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const J = JSON.stringify;
const unit = (sec, g, k) => (sec[g][k] === undefined ? null : J(sec[g][k]));

// a seeded random source with the shape of crypto.getRandomValues
function source(seed) { let s = seed >>> 0, calls = 0; const f = (a) => { calls++; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; a[i] = (s >>> 8) & 255; } return a; }; f.calls = () => calls; return f; }
let T0 = 1000;
const ctx = (rand) => ({ now: T0++, rand: rand || source(7) });
const ok = (r) => { assert.ok(!r.error, r.error); return r; };
function planOf(sec, owner) {
  const st = S.stateOf(sec, owner), lists = Object.keys(sec.lists).filter((id) => S.ownerOf(sec.lists[id]) === owner).sort().map((id) => ({
    id, steps: sec.lists[id].steps || {},
    targets: Object.keys(sec.targets).filter((k) => k.startsWith(id + '.')).sort().map((k) => Object.assign({ id: k.slice(id.length + 1) }, sec.targets[k])) }));
  return L.plan(D, { order: '', ways: st.ways, have: st.have, lists, prices: null });
}
// a section made only through the store: one list for c1 with a plain item, a collectable item, a must-craft item and some stock
function base() {
  let sec = S.emptySection();
  const c = ctx();
  let r = ok(S.newList(sec, { name: 'Main', charId: 'c1', stamp: D.stamp }, c)); sec = r.section; const lid = r.id;
  const add = (o) => { r = ok(S.addTarget(sec, lid, o, c)); sec = r.section; return r.key; };
  const k1 = add({ item: 100, recipe: 1000, qty: 2 }), k2 = add({ item: 160, recipe: 1020, qty: 1 }), k3 = add({ item: 130, recipe: 1011, qty: 3, make: true }), k4 = add({ item: 161, recipe: 1021, qty: 1, hq: true });
  sec = ok(S.setHave(sec, 'c1', 103, 'nq', 10)).section;
  sec = ok(S.setHave(sec, 'c1', 101, 'nq', 4)).section;
  return { sec, lid, k1, k2, k3, k4 };
}
const tid = (k) => k.slice(k.indexOf('.') + 1);

test('ST-1 add, change the amount, a cleared amount keeps the item, remove', () => {
  const { sec, lid, k1 } = base();
  assert.equal(sec.targets[k1].qty, 2); assert.equal(sec.targets[k1].item, 100);
  let r = ok(S.setQty(sec, lid, tid(k1), '5')); assert.equal(r.section.targets[k1].qty, 5);
  for (const blank of ['', '   ', null, undefined, 'abc', 0, '0', -3]) {
    const c = S.setQty(r.section, lid, tid(k1), blank);
    assert.equal(c.entry, null, 'a cleared or invalid amount changes nothing: ' + blank); assert.equal(J(c.section), J(r.section)); assert.equal(c.section.targets[k1].qty, 5);
  }
  assert.ok(S.setQty(r.section, lid, tid(k1), 100000).error);
  const gone = ok(S.removeTarget(r.section, lid, tid(k1)));
  assert.equal(gone.section.targets[k1], undefined);
  assert.ok(gone.section.lists[lid]); assert.equal(Object.keys(gone.section.targets).length, 3);
  // the input is never changed
  const snap = J(sec); S.setQty(sec, lid, tid(k1), 9); S.removeTarget(sec, lid, tid(k1)); assert.equal(J(sec), snap);
  // an amount above the cap is a plain line; a crafted count never stays above a lowered amount
  const m = ok(S.setQty(sec, lid, tid(base().k3), 3));
  assert.equal(m.entry, null);
});

test('ST-2 set and clear an item\'s way and offer', () => {
  const { sec } = base();
  let r = ok(S.setWay(sec, 'c1', 130, { by: 'trade', offer: '5004.1.110' })); assert.deepEqual(r.section.ways['c1.130'], { by: 'trade', offer: '5004.1.110' });
  r = ok(S.setWay(r.section, 'c1', 130, { recipe: 1011, hq: true })); assert.deepEqual(r.section.ways['c1.130'], { by: 'trade', recipe: 1011, hq: true, offer: '5004.1.110' });
  r = ok(S.setWay(r.section, 'c1', 130, { offer: null, hq: false })); assert.deepEqual(r.section.ways['c1.130'], { by: 'trade', recipe: 1011 });
  assert.ok(S.setWay(r.section, 'c1', 130, { by: 'steal' }).error); assert.ok(S.setWay(r.section, 'c1', 130, { offer: 'x' }).error);
  const cleared = ok(S.clearWay(r.section, 'c1', 130)); assert.equal(cleared.section.ways['c1.130'], undefined);
  // a way with nothing left is removed, and clearing a way that is not there changes nothing
  const one = ok(S.setWay(sec, 'c1', 101, { by: 'craft' })); const none = ok(S.setWay(one.section, 'c1', 101, { by: null })); assert.equal(none.section.ways['c1.101'], undefined);
  assert.equal(S.clearWay(sec, 'c1', 999).entry, null);
});

test('ST-3 Bought it after a recorded craft raises only that item\'s count, by the units entered', () => {
  const { sec, lid, k3 } = base();
  const plan = planOf(sec, 'c1'), line = plan.lines['130|make|1011'];
  assert.ok(line, 'the must-craft line');
  const rec = ok(S.record(sec, D, 'c1', plan, { line, times: 1, targets: { [k3]: 1 } }));
  const before = clone(rec.section), r = ok(S.bought(rec.section, { owner: 'c1', item: 103, quality: 'nq', units: 2 }));
  assert.equal(r.section.have['c1.103'].nq, before.have['c1.103'].nq + 2);
  for (const g of ['lists', 'targets', 'ways', 'owners', 'prefs']) assert.equal(J(r.section[g]), J(before[g]), g + ' unchanged');
  for (const k of Object.keys(before.have)) if (k !== 'c1.103') assert.equal(J(r.section.have[k]), J(before.have[k]), k + ' unchanged');
  assert.deepEqual(r.entry.units.map((u) => u.g + ':' + u.k), ['have:c1.103']);
  assert.ok(S.bought(rec.section, { owner: 'c1', item: 103, quality: 'nq', units: 0 }).error);
  assert.ok(S.bought(rec.section, { owner: 'c1', item: 103, quality: 'nq', units: '' }).error);
  // a new count for an item not held yet is made; other qualities are left alone
  const q = ok(S.bought(rec.section, { owner: 'c1', item: 111, quality: 'hq', units: 3 })); assert.deepEqual(q.section.have['c1.111'], { nq: 0, hq: 3, coll: 0 });
});

test('ST-4 "Buy the rest too" sets the way of the item and nothing else', () => {
  const { sec } = base();
  const r = ok(S.setWay(sec, 'c1', 101, { by: 'vendor' }));
  assert.deepEqual(r.section.ways['c1.101'], { by: 'vendor' });
  assert.deepEqual(r.entry.units.map((u) => u.g), ['ways']);
  assert.equal(J(r.section.have), J(sec.have)); assert.equal(J(r.section.targets), J(sec.targets));
});

test('ST-5 "Bought it" on a must-craft row switches "Must be crafted by me" off', () => {
  const { sec, k3 } = base();
  assert.equal(sec.targets[k3].make, true);
  const r = ok(S.bought(sec, { owner: 'c1', item: 130, quality: 'nq', units: 3, makeKeys: [k3] }));
  assert.equal(r.section.targets[k3].make, undefined); assert.equal(r.section.targets[k3].qty, 3);
  assert.equal(r.section.have['c1.130'].nq, 3);
  assert.deepEqual(r.entry.units.map((u) => u.g + ':' + u.k).sort(), ['have:c1.130', 'targets:' + k3].sort());
  const u = ok(S.undo(r.section, r.entry)); assert.equal(J(u.section), J(sec));
});

test('ST-6 ticking Collectable on a high-quality item keeps both flags stored', () => {
  const { sec, lid, k4 } = base();
  assert.equal(sec.targets[k4].hq, true);
  const r = ok(S.setFlag(sec, lid, tid(k4), 'coll', true));
  assert.equal(r.section.targets[k4].hq, true); assert.equal(r.section.targets[k4].coll, true);
  const m = ok(S.setFlag(r.section, lid, tid(k4), 'make', true)); assert.deepEqual([m.section.targets[k4].hq, m.section.targets[k4].coll, m.section.targets[k4].make], [true, true, true]);
  const off = ok(S.setFlag(m.section, lid, tid(k4), 'hq', false)); assert.equal(off.section.targets[k4].hq, undefined); assert.equal(off.section.targets[k4].coll, true);
});

// every kind of edit, so that undo is tried on each
function edits(b) {
  const { lid, k1, k2, k3, k4 } = b, plan = planOf(b.sec, 'c1');
  return [
    ['newList', (s) => S.newList(s, { name: 'Second', charId: null }, ctx())],
    ['renameList', (s) => S.renameList(s, lid, 'Renamed')],
    ['removeList', (s) => S.removeList(s, lid)],
    ['addStep', (s) => S.addStep(s, lid, 'Second step', ctx())],
    ['addTarget', (s) => S.addTarget(s, lid, { item: 111, recipe: 0, qty: 4 }, ctx())],
    ['setQty', (s) => S.setQty(s, lid, tid(k1), 7)],
    ['setFlag', (s) => S.setFlag(s, lid, tid(k2), 'make', true)],
    ['setDone', (s) => S.setDone(s, lid, tid(k4), true)],
    ['removeTarget', (s) => S.removeTarget(s, lid, tid(k3))],
    ['setHave', (s) => S.setHave(s, 'c1', 103, 'nq', 2)],
    ['setHave to zero', (s) => S.setHave(s, 'c1', 101, 'nq', 0)],
    ['setHave new', (s) => S.setHave(s, 'c1', 777, 'hq', 5)],
    ['adjustHave', (s) => S.adjustHave(s, 'c1', 103, 'nq', -1)],
    ['bought', (s) => S.bought(s, { owner: 'c1', item: 130, quality: 'nq', units: 2, makeKeys: [k3] })],
    ['setWay', (s) => S.setWay(s, 'c1', 101, { by: 'craft', recipe: 1001 })],
    ['clearWay', (s) => S.clearWay(S.setWay(s, 'c1', 101, { by: 'craft' }).section, 'c1', 101)],
    ['record', (s) => S.record(s, D, 'c1', plan, { line: plan.lines['130|make|1011'], times: 2, targets: { [k3]: 2 } })],
    ['finishStep', (s) => S.finishStep(s, 'c1', plan, lid, '')],
    ['tickCombined', (s) => S.tickCombined(s, lid, true)]
  ];
}

test('ST-7 undo of each kind of edit gives the section back byte for byte', () => {
  const b = base();
  for (const [name, f] of edits(b)) {
    const r = f(b.sec);
    if (name === 'clearWay') { assert.ok(r.entry === null || r.entry, name); continue; } // set then cleared in one go: nothing left to undo from the original
    assert.ok(!r.error, name + ': ' + r.error); assert.ok(r.entry, name + ' made a change');
    assert.notEqual(J(r.section), J(b.sec), name + ' changed the section');
    const u = ok(S.undo(r.section, r.entry));
    assert.equal(J(u.section), J(b.sec), name + ': undo is byte for byte');
    assert.deepEqual(Object.keys(u.expect).sort(), r.entry.units.map((x) => 'm|' + J(['lists', x.g, x.k])).sort());
  }
});

test('ST-8 twenty undos in a row, newest first, give back the first section byte for byte', () => {
  const b = base(), snaps = [b.sec], entries = [];
  let sec = b.sec;
  for (let i = 0; i < 20; i++) {
    const r = ok(i % 4 === 0 ? S.setQty(sec, b.lid, tid(b.k1), 10 + i) : i % 4 === 1 ? S.adjustHave(sec, 'c1', 103, 'nq', 1) : i % 4 === 2 ? S.setWay(sec, 'c1', 101, { by: i % 8 === 2 ? 'craft' : 'market' }) : S.addTarget(sec, b.lid, { item: 111, qty: 1 + i }, ctx()));
    assert.ok(r.entry); sec = r.section; entries.push(r.entry); snaps.push(sec);
  }
  for (let i = 19; i >= 0; i--) { const u = ok(S.undo(sec, entries[i])); sec = u.section; assert.equal(J(sec), J(snaps[i]), 'after undoing change ' + (i + 1)); }
});

test('ST-9 no edit lowers a stock count except minus, "I have", a recorded craft and a step handed in', () => {
  const b = base(), haveKeys = Object.keys(b.sec.have);
  const lowering = new Set(['setHave', 'setHave to zero', 'adjustHave', 'record', 'finishStep', 'removeList']);
  for (const [name, f] of edits(b)) {
    const r = f(b.sec); if (r.error || !r.entry) continue;
    for (const k of haveKeys) for (const q of ['nq', 'hq', 'coll']) {
      const was = b.sec.have[k][q] || 0, now = (r.section.have[k] && r.section.have[k][q]) || 0;
      if (!lowering.has(name)) assert.ok(now >= was, name + ' lowered ' + k + '.' + q);
    }
  }
  // and the ones that may lower it do exactly what they say: minus by one, "I have" to the typed number
  assert.equal(S.adjustHave(b.sec, 'c1', 103, 'nq', -1).section.have['c1.103'].nq, 9);
  assert.equal(S.setHave(b.sec, 'c1', 103, 'nq', 3).section.have['c1.103'].nq, 3);
  assert.equal(S.adjustHave(S.setHave(b.sec, 'c1', 103, 'nq', 0).section, 'c1', 103, 'nq', -1).entry, null, 'minus at zero changes nothing');
  // a typed count that is all zeros is removed
  assert.equal(S.setHave(b.sec, 'c1', 101, 'nq', 0).section.have['c1.101'], undefined);
});

function over(n, mk) { const o = {}; for (let i = 0; i < n; i++) mk(o, i); return o; }
const idOf = (i) => 'z' + String(i).padStart(7, '0');

test('ST-10 each limit refuses the edit with its line and changes nothing; data over a limit can still be edited and shrunk', () => {
  // lists: 200
  const lists = S.emptySection(); for (let i = 0; i < 200; i++) lists.lists[idOf(i)] = { name: 'L' + i, charId: null, order: i, made: 1 + i };
  const before = J(lists), r1 = S.newList(lists, { name: 'One more' }, ctx());
  assert.equal(r1.error, S.lines.lists); assert.equal(r1.section, undefined); assert.equal(J(lists), before);
  assert.equal(r1.error, 'You already have 200 lists, the most this app keeps. Remove one to make another.');
  // wanted items: 2,000 in a list; the line is the spec's
  const t = S.emptySection(); t.lists[idOf(1)] = { name: 'Big', charId: 'c1', order: 0, made: 1 };
  for (let i = 0; i < 2000; i++) t.targets[idOf(1) + '.' + idOf(i + 10)] = { item: 100, recipe: 0, qty: 1, at: 1 + i };
  const tb = J(t), r2 = S.addTarget(t, idOf(1), { item: 101, qty: 1 }, ctx());
  assert.equal(r2.error, 'This list is full: 2,000 items.'); assert.equal(J(t), tb);
  // steps: 20
  const st = S.emptySection(); st.lists[idOf(1)] = { name: 'Steps', charId: null, order: 0, made: 1, steps: over(20, (o, i) => { o[idOf(i + 20)] = { name: 'S' + i, n: i }; }) };
  const sb = J(st), r3 = S.addStep(st, idOf(1), 'More', ctx());
  assert.equal(r3.error, S.lines.steps); assert.equal(J(st), sb);
  // stock: 20,000 counts; a new count is refused (by "I have" and by "Bought it"), an existing one is edited
  const h = S.emptySection(); for (let i = 0; i < 20000; i++) h.have['c1.' + (i + 1)] = { nq: 1, hq: 0, coll: 0 };
  const hb = J(h), r4 = S.setHave(h, 'c1', 9999999, 'nq', 5);
  assert.equal(r4.error, S.lines.have); assert.equal(J(h), hb);
  assert.equal(S.bought(h, { owner: 'c1', item: 9999999, quality: 'nq', units: 1 }).error, S.lines.have);
  assert.equal(S.setHave(h, 'c1', 5, 'nq', 9).section.have['c1.5'].nq, 9);
  // a section already over a limit (as a sync can leave it) still edits, shrinks, and refuses only new ones
  const big = S.emptySection(); big.lists[idOf(1)] = { name: 'Over', charId: 'c1', order: 0, made: 1 };
  for (let i = 0; i < 2500; i++) big.targets[idOf(1) + '.' + idOf(i + 10)] = { item: 100, recipe: 0, qty: 1, at: 1 + i };
  const key = idOf(1) + '.' + idOf(10);
  assert.equal(S.setQty(big, idOf(1), idOf(10), 4).section.targets[key].qty, 4);
  assert.equal(S.addTarget(big, idOf(1), { item: 101, qty: 1 }, ctx()).error, S.lines.targets);
  let shrunk = big; for (let i = 0; i < 501; i++) shrunk = ok(S.removeTarget(shrunk, idOf(1), idOf(10 + i))).section;
  assert.equal(Object.keys(shrunk.targets).length, 1999);
  assert.ok(ok(S.addTarget(shrunk, idOf(1), { item: 101, qty: 1 }, ctx())).section.targets, 'below the limit again');
  const nl = S.emptySection(); for (let i = 0; i < 230; i++) nl.lists[idOf(i)] = { name: 'L', charId: null, order: i, made: 1 };
  assert.equal(S.renameList(nl, idOf(3), 'Still editable').section.lists[idOf(3)].name, 'Still editable');
  assert.equal(S.removeList(nl, idOf(3)).section.lists[idOf(3)], undefined);
});

test('ST-11 an undo whose unit was changed since is refused and changes nothing; the undo before it still works', () => {
  const b = base();
  const first = ok(S.setQty(b.sec, b.lid, tid(b.k1), 9));              // change 1: an amount
  const second = ok(S.bought(first.section, { owner: 'c1', item: 103, quality: 'nq', units: 1 })); // change 2: a count
  const other = ok(S.setHave(second.section, 'c1', 103, 'nq', 10));     // another tab types 10 for the same item
  const snap = J(other.section), refused = S.undo(other.section, second.entry);
  assert.equal(refused.error, 'Undo was not done: this was changed again since, here or on another device. Nothing was changed.');
  assert.equal(refused.section, undefined); assert.equal(J(other.section), snap); assert.equal(other.section.have['c1.103'].nq, 10);
  const still = ok(S.undo(other.section, first.entry));                 // the undo before it has its own units untouched
  assert.equal(still.section.targets[b.k1].qty, 2); assert.equal(still.section.have['c1.103'].nq, 10);
  // without the other tab's change the later one works; a unit removed since refuses too
  assert.equal(J(ok(S.undo(second.section, second.entry)).section), J(first.section));
  const removed = ok(S.removeTarget(first.section, b.lid, tid(b.k1)));
  assert.ok(S.undo(removed.section, first.entry).error);
  // an undone change cannot be undone twice
  assert.ok(S.undo(S.undo(second.section, second.entry).section, second.entry).error);
});

test('ST-12 recording through the store writes stock and crafted in one change; one undo restores both', () => {
  const { sec, k3 } = base(), plan = planOf(sec, 'c1'), line = plan.lines['130|make|1011'];
  const r = ok(S.record(sec, D, 'c1', plan, { line, times: 2, targets: { [k3]: 2 } }));
  assert.equal(r.section.targets[k3].crafted, 2); assert.equal(r.section.have['c1.130'].nq, 2); assert.equal(r.section.have['c1.103'].nq, 8);
  assert.deepEqual(r.short, []);
  const kinds = r.entry.units.map((u) => u.g).sort(); assert.deepEqual(kinds, ['have', 'have', 'targets']);
  assert.equal(J(ok(S.undo(r.section, r.entry)).section), J(sec));
  // recording is never refused: beyond the typed materials it still writes, and says which were short
  const none = ok(S.setHave(sec, 'c1', 103, 'nq', 0)), p2 = planOf(none.section, 'c1');
  const r2 = ok(S.record(none.section, D, 'c1', p2, { line: p2.lines['130|make|1011'], times: 1, targets: { [k3]: 1 } }));
  assert.deepEqual(r2.short, [103]); assert.equal(r2.section.have['c1.130'].nq, 1);
  // and the stock-count limit does not stop it
  const full = S.emptySection(); full.lists = clone(sec.lists); full.targets = clone(sec.targets); for (let i = 0; i < 20000; i++) full.have['c1.' + (i + 1000)] = { nq: 1, hq: 0, coll: 0 };
  const p3 = planOf(full, 'c1'), r3 = S.record(full, D, 'c1', p3, { line: p3.lines['130|make|1011'], times: 1, targets: { [k3]: 1 } });
  assert.ok(!r3.error); assert.equal(r3.section.have['c1.130'].nq, 1);
});

test('ST-13 new ids are 12 characters from the random source and never repeat within a section', () => {
  const rand = source(99), calls0 = rand.calls();
  let sec = S.emptySection();
  const c = { now: 5, rand }, seen = new Set();
  let r = ok(S.newList(sec, { name: 'A' }, c)); sec = r.section; const lid = r.id;
  assert.ok(rand.calls() > calls0, 'the id came from the supplied source');
  const ids = [lid];
  for (let i = 0; i < 300; i++) { r = ok(S.addTarget(sec, lid, { item: 100, qty: 1 }, c)); sec = r.section; ids.push(r.id); if (i < 15) { r = ok(S.addStep(sec, lid, 'S', c)); sec = r.section; ids.push(r.id); } }
  for (const id of ids) { assert.match(id, /^[0-9a-z]{12}$/); assert.ok(!seen.has(id), 'repeated ' + id); seen.add(id); }
  // an id already in use is drawn again
  const fixed = (a) => { for (let i = 0; i < a.length; i++) a[i] = i % 2 ? 1 : 2; return a; };
  const one = ok(S.newList(S.emptySection(), { name: 'X' }, { now: 5, rand: fixed }));
  let n = 0; const flip = (a) => { n++; for (let i = 0; i < a.length; i++) a[i] = n === 1 ? (i % 2 ? 1 : 2) : (i + n) % 200; return a; };
  const t = ok(S.newList(one.section, { name: 'Z' }, { now: 5, rand: flip })); assert.notEqual(t.id, one.id); assert.ok(n >= 2, 'drew again after a clash');
  // the default source is the platform's
  const d = ok(S.newList(S.emptySection(), { name: 'D' }, { now: 5 })); assert.match(d.id, /^[0-9a-z]{12}$/);
  // ids the checker accepts
  assert.equal(CC.checkLists(clone(sec)).lists[lid].name, 'A');
});

test('ST-14 an id in the combined selection that is not a list any more is dropped on the page and not written back (a list that moved id, LY6)', () => {
  const b = base(), sec = clone(b.sec); sec.prefs.combined = { [b.lid]: 1, gone00000000: 1 };
  assert.deepEqual(S.combined(sec), [b.lid]);
  assert.equal(J(sec.prefs.combined), J({ [b.lid]: 1, gone00000000: 1 }), 'reading changes nothing');
  assert.deepEqual(S.combined(S.emptySection()), []);
  const r = ok(S.tickCombined(sec, b.lid, false)); assert.deepEqual(r.section.prefs.combined, {});
  const r2 = ok(S.tickCombined(sec, b.lid, true)); assert.deepEqual(r2.section.prefs.combined, { [b.lid]: 1 }, 'ticking a ticked list only drops the unknown id');
  assert.equal(S.tickCombined(r2.section, b.lid, true).entry, null, 'already ticked and clean: nothing to write');
  const ids = ok(S.newList(sec, { name: 'Other' }, ctx())); const t = ok(S.tickCombined(ids.section, ids.id, true));
  assert.deepEqual(Object.keys(t.section.prefs.combined).sort(), [b.lid, ids.id].sort(), 'the unknown id is dropped when the selection is written');
  assert.ok(S.tickCombined(sec, 'nolist000000', true).error);
});

test('ST-15 a step handed in marks its items finished and lowers only their own stock; one undo restores both', () => {
  const b = base();
  let sec = ok(S.setHave(b.sec, 'c1', 100, 'nq', 2)).section; // two Grand Widgets typed: they cover the wanted two
  const plan = planOf(sec, 'c1'), r = ok(S.finishStep(sec, 'c1', plan, b.lid, ''));
  assert.equal(r.section.targets[b.k1].done, true);
  assert.equal((r.section.have['c1.100'] || { nq: 0 }).nq, 0, 'the handed-in item left the stock');
  assert.equal(J(r.section.have['c1.103']), J(sec.have['c1.103']), 'a material is never taken by a hand-in');
  assert.equal(J(ok(S.undo(r.section, r.entry)).section), J(sec));
  // a row's Finished changes no stock count
  const f = ok(S.setDone(sec, b.lid, tid(b.k1), true)); assert.equal(J(f.section.have), J(sec.have));
});

// ---- W14 (outside code reviews, 2026-11-22), fix 1: a count the store would raise above 999,999 is kept at 999,999 and the result says so
test('ST-16 a record or a purchase that would pass 999,999 keeps 999,999 in every quality, never loses the count, and says so', () => {
  const lineOf = (sec, key) => { const p = planOf(sec, 'c1'); return { p, ln: p.lines[key] }; };
  const stocked = (sec, item, q, n) => ok(S.setHave(sec, 'c1', item, q, n)).section;
  // ordinary quality, a make line, one craft that makes one
  let b = base(), sec = stocked(b.sec, 130, 'nq', 999999), { p, ln } = lineOf(sec, '130|make|1011');
  let r = ok(S.record(sec, D, 'c1', p, { line: ln, times: 1, targets: { [b.k3]: 1 } }));
  assert.equal(r.section.have['c1.130'].nq, 999999, 'ordinary stock is kept, not dropped');
  assert.equal(r.section.targets[b.k3].crafted, 1, 'the craft is still counted'); assert.equal(r.capped, true);
  assert.equal(r.section.have['c1.103'].nq, 9, 'the material is still taken');
  assert.equal(ok(S.undo(r.section, r.entry)).section.have['c1.130'].nq, 999999);
  // a multi-yield craft (Triple Gem makes 3): 999,998 + 3 is capped, 999,990 + 3 is not
  b = base(); let k = ok(S.addTarget(b.sec, b.lid, { item: 120, recipe: 1010, qty: 3 }, ctx())).section;
  k = stocked(k, 120, 'nq', 999998); p = planOf(k, 'c1');
  const gem = '120|normal|0'; assert.equal(p.lines[gem].by, 'craft'); assert.equal(p.lines[gem].yield, 3);
  r = ok(S.record(k, D, 'c1', p, { line: p.lines[gem], times: 1 })); assert.equal(r.section.have['c1.120'].nq, 999999); assert.equal(r.capped, true);
  const k2 = stocked(k, 120, 'nq', 999990); p = planOf(k2, 'c1');
  r = ok(S.record(k2, D, 'c1', p, { line: p.lines[gem], times: 1 })); assert.equal(r.section.have['c1.120'].nq, 999993); assert.ok(!r.capped);
  // high quality and collectable stock, the quality chosen by the caller
  b = base(); sec = stocked(b.sec, 130, 'hq', 999999); ({ p, ln } = lineOf(sec, '130|make|1011'));
  r = ok(S.record(sec, D, 'c1', p, { line: ln, times: 2, quality: 'hq', targets: { [b.k3]: 2 } }));
  assert.equal(r.section.have['c1.130'].hq, 999999); assert.equal(r.section.targets[b.k3].crafted, 2); assert.equal(r.capped, true);
  sec = stocked(b.sec, 130, 'coll', 999999); ({ p, ln } = lineOf(sec, '130|make|1011'));
  r = ok(S.record(sec, D, 'c1', p, { line: ln, times: 1, quality: 'coll', targets: { [b.k3]: 1 } }));
  assert.equal(r.section.have['c1.130'].coll, 999999); assert.equal(r.capped, true);
  // another quality of the same item is untouched by the cap
  sec = stocked(stocked(b.sec, 130, 'hq', 999999), 130, 'nq', 5); ({ p, ln } = lineOf(sec, '130|make|1011'));
  r = ok(S.record(sec, D, 'c1', p, { line: ln, times: 1, quality: 'hq', targets: { [b.k3]: 1 } }));
  assert.deepEqual(r.section.have['c1.130'], { nq: 5, hq: 999999, coll: 0 });
  // "Bought it" caps too (it used to refuse)
  sec = stocked(b.sec, 111, 'nq', 999998);
  r = ok(S.bought(sec, { owner: 'c1', item: 111, quality: 'nq', units: 5 })); assert.equal(r.section.have['c1.111'].nq, 999999); assert.equal(r.capped, true);
  r = ok(S.bought(r.section, { owner: 'c1', item: 111, quality: 'nq', units: 1 })); assert.equal(r.entry, null); assert.equal(r.capped, true);
  r = ok(S.bought(stocked(b.sec, 111, 'nq', 10), { owner: 'c1', item: 111, quality: 'nq', units: 5 })); assert.equal(r.section.have['c1.111'].nq, 15); assert.ok(!r.capped);
  assert.equal(S.lines.capped, 'Counts above 999,999 are kept at 999,999.');
});

// ---- W14 fix 2: wanted items without their list ("Restored list")
test('ST-17 wanted items without a list are listed, put in a new list under the old id (nothing moves) or removed, the page offers no Undo for either (the save refuses to make an orphan again, LI2)', () => {
  const b = base(), ghost = 'gh0stlist001';
  const sec = clone(b.sec); sec.targets[ghost + '.aaaaaaaaaaa1'] = { item: 101, recipe: 1001, qty: 2, at: 5 }; sec.targets[ghost + '.aaaaaaaaaaa2'] = { item: 103, recipe: 0, qty: 7, at: 6 };
  const held = S.norm(sec);
  assert.deepEqual(S.orphans(held), { [ghost]: [ghost + '.aaaaaaaaaaa1', ghost + '.aaaaaaaaaaa2'] }, 'the checker keeps them and they are found');
  assert.deepEqual(S.orphans(b.sec), {});
  assert.deepEqual(Object.keys(S.stateOf(held, 'u').targets), [], 'no plan counts them: no owner has them');
  assert.deepEqual(Object.keys(S.stateOf(held, 'c1').targets).filter((k) => k.startsWith(ghost)), []);
  // put in a new list: the header takes the old id; the wanted items are byte for byte what they were
  const r = ok(S.restoreList(held, ghost, ctx()));
  assert.equal(r.id, ghost); assert.equal(r.section.lists[ghost].name, 'Restored list'); assert.equal(r.section.lists[ghost].charId, null);
  assert.equal(J(r.section.targets), J(held.targets), 'no wanted item moved or changed');
  assert.deepEqual(S.orphans(r.section), {});
  assert.deepEqual(r.entry.units.map((u) => u.g), ['lists']);
  assert.ok(S.restoreList(r.section, ghost, ctx()).error, 'a list that is back is not restored again');
  assert.ok(S.restoreList(held, 'nolist000000', ctx()).error, 'nothing to restore');
  // remove: only the orphans' wanted items; other lists and stock are untouched
  const d = ok(S.removeOrphans(held, ghost));
  assert.deepEqual(S.orphans(d.section), {}); assert.equal(J(d.section.lists), J(held.lists)); assert.equal(J(d.section.have), J(held.have));
  assert.equal(Object.keys(d.section.targets).length, Object.keys(held.targets).length - 2);
  assert.ok(S.removeOrphans(r.section, ghost).error, 'a list that is back is removed only as a list');
});
