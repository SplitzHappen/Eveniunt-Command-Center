'use strict';
// The order of ways edit (work item W8 of docs/lists-spec.md, "Order of ways sheet"): ST-16. Run: node tests/lists-store-order.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require(path.join(__dirname, '..', 'src', 'core', 'save.js'));
const CC = globalThis.CC;
require(path.join(__dirname, '..', 'command-center', 'src', 'lists', 'engine.js'));
require(path.join(__dirname, '..', 'command-center', 'src', 'lists', 'store.js'));
const S = globalThis.LISTS.store;
const J = JSON.stringify;

test('ST-16 setOrder stores one text of five words, undoes byte for byte, and refuses a bad order', () => {
  const sec = S.emptySection();
  const r = S.setOrder(sec, 'c1', 'craft vendor gather trade market');
  assert.ok(!r.error && r.entry);
  assert.equal(r.section.owners.c1.order, 'craft vendor gather trade market');
  assert.deepEqual(CC.checkModules({ lists: r.section }).lists.owners, r.section.owners);
  assert.equal(S.setOrder(r.section, 'c1', 'craft vendor gather trade market').entry, null, 'the same order changes nothing');
  const u = S.undo(r.section, r.entry);
  assert.ok(!u.error);
  assert.equal(J(u.section), J(sec), 'undo gives the section back byte for byte');
  const other = S.setOrder(r.section, 'c1', 'vendor craft gather trade market');
  assert.equal(S.undo(other.section, r.entry).error, S.lines.undo, 'an undo whose unit changed since is refused');
  ['vendor craft gather trade', 'vendor vendor gather trade market', 'vendor craft gather trade nonsense', '', null, 5].forEach((bad) => {
    const e = S.setOrder(r.section, 'c1', bad);
    assert.ok(e.error && !e.section, 'refused: ' + J(bad));
  });
  assert.ok(S.setOrder(r.section, 'zz', 'vendor craft gather trade market').error);
  assert.ok(!S.setOrder(r.section, 'u', 'market trade gather craft vendor').error, 'lists without a character have an order too');
  // the engine reads the stored order
  const D = { items: { 1: ['Gil', 1, 0], 5: ['Thing', 1, 0] }, recipes: { 9: [5, 1, 0, 1, 0, [[1, 1]], 1] }, gather: {}, trades: { 5: [[1, [[1, 10]], 0, 0, 77]] }, npcs: {} };
  assert.equal(globalThis.LISTS.way(D, { order: 'vendor craft gather trade market', ways: {} }, 5, 'normal').by, 'vendor');
  assert.equal(globalThis.LISTS.way(D, { order: r.section.owners.c1.order, ways: {} }, 5, 'normal').by, 'craft');
});
