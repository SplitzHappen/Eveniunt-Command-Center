'use strict';
// Fixes after the review of the Submersibles module (K1 and K3.4): the merge of the Setup form's sector ticks, and the Log's day headings.
// Run: node --test tests/subs-fixes.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const SRC = path.join(__dirname, '..', 'command-center', 'src', 'submersibles');
require(path.join(SRC, 'fleet.js'));
const F = globalThis.FLEET;
const LEDGER = require(path.join(SRC, 'ledger.js'));

test('K1 mergeTicks: a stale form keeps a discovery saved meanwhile', () => {
  assert.deepEqual(F.mergeTicks([1, 2, 3, 4], [1, 2, 3], []), [1, 2, 3, 4], 'saved now has 4, the form opened with [1, 2, 3]');
  assert.deepEqual(F.mergeTicks([1, 2, 3], [1, 2, 3, 7], []), [1, 2, 3, 7], 'what the form ticks is added');
  assert.deepEqual(F.mergeTicks(undefined, [2, 1], []), [1, 2], 'a new company has no saved list');
  assert.deepEqual(F.mergeTicks(null, [], []), []);
  assert.deepEqual(F.mergeTicks([3, 1, 3], [1, 2], []), [1, 2, 3], 'sorted, no repeats');
});

test('K1 mergeTicks: an untick is honoured, even when the saved list still has the sector', () => {
  assert.deepEqual(F.mergeTicks([1, 2, 3, 4], [1, 2], [3]), [1, 2, 4], 'the player unticked 3; 4 was saved meanwhile and stays');
  assert.deepEqual(F.mergeTicks([1, 2, 3], [1, 2, 3], [3]), [1, 2]);
});

test('K1 mergeTicks: Clear every sector in a sea removes only that sea\'s sectors that were there; a newer discovery elsewhere stays', () => {
  // the form opened with sea 2 sectors 32, 33 ticked; Clear removed them (off = [32, 33]); sector 4 (another sea) was saved meanwhile
  assert.deepEqual(F.mergeTicks([1, 2, 3, 4, 32, 33], [1, 2, 3], [32, 33]), [1, 2, 3, 4]);
  // a sector of the cleared sea that was not ticked in the form is not in off, so it is not removed
  assert.deepEqual(F.mergeTicks([1, 2, 3, 34, 32, 33], [1, 2, 3], [32, 33]), [1, 2, 3, 34], 'a newer discovery in the SAME sea arrives after Clear: it was never shown cleared, so it stays');
});

test('K1 mergeTicks: ignores what is not a whole sector number', () => {
  assert.deepEqual(F.mergeTicks([1, '2', null, 3.5], [NaN, 4], []), [1, 4]);
});

test('K3.4 a Log day heading counts and totals every voyage of its day, whatever rows are drawn', () => {
  const day = (d, h) => new Date(2026, 5, d, h, 0, 0).getTime();
  const rows = [{ at: day(10, 20), logged: true, gil: 1000.4 }, { at: day(10, 15), logged: false, gil: 0 }, { at: day(10, 9), logged: true, gil: 500 }, { at: day(9, 22), logged: true, gil: 70 }, { at: day(9, 3), logged: true, gil: 30 }];
  const info = LEDGER.dayInfo(rows);
  assert.deepEqual(info[LEDGER.dayStart(day(10, 1))], { n: 3, logged: 2, gil: 1500 });
  assert.deepEqual(info[LEDGER.dayStart(day(9, 1))], { n: 2, logged: 2, gil: 100 });
  assert.deepEqual(LEDGER.dayInfo([]), {}); assert.deepEqual(LEDGER.dayInfo(null), {});
  // only the first four rows are drawn: the older day has one of its two rows drawn, and its heading still says two voyages and 100 gil
  const drawn = LEDGER.days(rows.slice(0, 4)), older = drawn[1];
  assert.equal(older.rows.length, 1);
  assert.equal(info[older.key].n, 2); assert.equal(info[older.key].gil, 100);
  assert.equal(LEDGER.shownNote(info[older.key].n, older.rows.length), 'showing 1 of 2');
  assert.equal(LEDGER.shownNote(3, 3), '', 'nothing hidden: nothing said');
});
