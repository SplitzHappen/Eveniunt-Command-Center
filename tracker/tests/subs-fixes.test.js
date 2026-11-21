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

test('R2 mergeTicks: the sectors written are saved now plus what the player ticked in the form, minus what was unticked; one unticked elsewhere is not added back', () => {
  // the form opened with [1, 2, 3]; another tab unticked 3: the form ticked nothing, so 3 is not written back
  assert.deepStrictEqual(F.mergeTicks([1, 2], [], []), [1, 2]);
  assert.deepStrictEqual(F.mergeTicks([1, 2], [7], []), [1, 2, 7], 'a sector the player ticked in the form is written');
  assert.deepStrictEqual(F.mergeTicks([1, 2], [7], [7]), [1, 2], 'ticked then unticked: not written');
  assert.deepStrictEqual(F.mergeTicks(undefined, [1, 2], []), [1, 2], 'a new company: the starting sectors count as ticked');
});

test('R4 cameBack: the sectors unticked in the saved form that the stored list holds again, and the plain-words line', () => {
  assert.deepStrictEqual(F.cameBack([1, 2, 3, 4], [3, 4, 9]), [3, 4]);
  assert.deepStrictEqual(F.cameBack([1, 2], [3, 3]), []);
  assert.deepStrictEqual(F.cameBack(undefined, [3]), []);
  assert.strictEqual(F.cameBackLine('Alpha', [3, 4]), '2 sectors you unticked for Alpha were ticked on another device or tab and have been kept. Untick them again in Setup if they are wrong.');
  assert.strictEqual(F.cameBackLine('Alpha', [3]), '1 sector you unticked for Alpha was ticked on another device or tab and has been kept. Untick it again in Setup if it is wrong.');
  assert.strictEqual(F.cameBackLine('Alpha', []), '');
});

// H1 (third review): the page's write reconciles what the save returned with an edit made while the write ran (three-way merge, base = what was sent).
test('H1 reconcile: a newer local edit survives, a remote-only change arrives, a unit changed in both takes the local one', () => {
  for (const f of ['save', 'model', 'codec', 'merge', 'storage']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
  const unit = (name, extra) => Object.assign({ name, charId: null, order: 0, unlockedSlots: 1, world: 'Ravana', discovered: [1, 2, 3] }, extra || {});
  const sec = (fcs, subs, settings) => ({ fcs: fcs, subs: subs || {}, trips: {}, settings: settings || {} });
  const sent = sec({ fa: unit('Alpha'), fb: unit('Beta', { order: 1 }) });
  const remote = sec({ fa: unit('Alpha'), fb: unit('Beta', { order: 1 }) }, { sx: { fcId: 'fa', slot: 1, name: 'Other Tab', rank: 5, voyage: null } });
  const local = sec({ fa: unit('Alpha Renamed'), fb: unit('Beta', { order: 1 }) }, {}, { prefs: { sort: 'time' } });
  const out = F.reconcile(sent, local, remote);
  assert.equal(out.fcs.fa.name, 'Alpha Renamed', 'the newer local edit survives');
  assert.equal(out.settings.prefs.sort, 'time', 'a newer local setting survives');
  assert.ok(out.subs.sx, 'a change only in the returned section reaches the working copy');
  assert.deepStrictEqual(sent.fcs.fa.name, 'Alpha', 'the inputs are not changed');
  const both = F.reconcile(sent, sec({ fa: unit('Alpha Local'), fb: unit('Beta', { order: 1 }) }), sec({ fa: unit('Alpha Remote'), fb: unit('Beta', { order: 1 }) }));
  assert.equal(both.fcs.fa.name, 'Alpha Local', 'a company changed on both sides keeps the local name');
  for (const k of ['fcs', 'subs', 'trips', 'settings']) assert.ok(both[k] && typeof both[k] === 'object', 'every part is present: ' + k);
});
