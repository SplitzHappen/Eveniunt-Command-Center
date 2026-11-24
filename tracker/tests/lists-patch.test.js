'use strict';
// Patch safety and sync names (work item R6 of docs/lists-redteam.md). Run: node tests/lists-patch.test.js
//  R6-1  the game-data pins of the Tracker, the Atelier, the Lists data (and the Submersibles data) are the same commit, in each tool and in the file it wrote
//  R6-2  describeUnit names an item when it is given a lookup, and keeps "item 5056" without one (the Tracker, the Atelier)
//  R6-3  the Lists page uses the engine's own way rule (LISTS.waysFor / LISTS.offersFor), which agrees with LISTS.way
//  R6-4  an item with placed and unplaced nodes keeps the unplaced ones, with their windows, after the placed ones
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(T, ...p), 'utf8');
const json = (...p) => JSON.parse(read(...p));

// ---------------------------------------------------------------- R6-1 the pins
// A pin is { who, where, sha }: who is the tool or data, where the file it is read from, sha the first 8 characters of the commit.
function find(text, re, who, where) {
  const m = re.exec(text);
  if (!m) throw new Error('Cannot read the ' + who + ' pin in ' + where + ': the file no longer has the expected line. Update tests/lists-patch.test.js with it.');
  return { who, where, sha: m[1].slice(0, 8) };
}
function datamining() {
  const ex = read('tools', 'extract.py'), at = read('..', 'crafting', 'atelier', 'tools', 'prepare-data.py'), li = read('tools', 'lists-data.py'), sm = read('tools', 'submarines.py');
  const dm = /^DM_COMMIT = "([0-9a-f]{40})"/m;
  return [
    find(ex, dm, 'Tracker data tool (xivapi/ffxiv-datamining)', 'tracker/tools/extract.py'),
    find(read('data', 'tracker-data.json').slice(0, 2000), /xivapi\/ffxiv-datamining ([0-9a-f]{7,40})/, 'Tracker data (xivapi/ffxiv-datamining)', 'tracker/data/tracker-data.json'),
    find(at, /xivapi\/ffxiv-datamining ([0-9a-f]{7,40})/, 'Atelier data tool (xivapi/ffxiv-datamining)', 'crafting/atelier/tools/prepare-data.py'),
    find(read('..', 'crafting', 'atelier', 'data', 'atelier-data.json').slice(-600), /xivapi\/ffxiv-datamining ([0-9a-f]{7,40})/, 'Atelier data (xivapi/ffxiv-datamining)', 'crafting/atelier/data/atelier-data.json'),
    { who: 'Cosmic Exploration data the Atelier reads (xivapi/ffxiv-datamining)', where: 'crafting/data/cosmic-db.json', sha: json('..', 'crafting', 'data', 'cosmic-db.json').generated_from.commit.slice(0, 8) },
    find(li, dm, 'Lists data tool (xivapi/ffxiv-datamining)', 'tracker/tools/lists-data.py'),
    { who: 'Lists data (xivapi/ffxiv-datamining)', where: 'tracker/data/lists.json (stamp)', sha: json('data', 'lists.json').stamp.split(' ')[1] },
    find(sm, dm, 'Submersibles data tool (xivapi/ffxiv-datamining)', 'tracker/tools/submarines.py'),
    { who: 'Submersibles data (xivapi/ffxiv-datamining)', where: 'tracker/data/submarines.json', sha: json('data', 'submarines.json').sources.game.commit.slice(0, 8) }
  ];
}
// The Teamcraft pin of the Lists and Submersibles data (the files of shops, nodes, parts). The Tracker pins its own, older commit for
// the patch-label files only (data/SOURCES.md); its tool and its data must agree with each other.
function teamcraftShared() {
  const tc = /^TC_COMMIT = "([0-9a-f]{40})"/m;
  return [
    find(read('tools', 'lists-data.py'), tc, 'Lists data tool (ffxiv-teamcraft)', 'tracker/tools/lists-data.py'),
    { who: 'Lists data (ffxiv-teamcraft)', where: 'tracker/data/lists.json (stamp)', sha: json('data', 'lists.json').stamp.split(' ')[2] },
    find(read('tools', 'submarines.py'), tc, 'Submersibles data tool (ffxiv-teamcraft)', 'tracker/tools/submarines.py'),
    { who: 'Submersibles data (ffxiv-teamcraft)', where: 'tracker/data/submarines.json', sha: json('data', 'submarines.json').sources.teamcraft.commit.slice(0, 8) }
  ];
}
function teamcraftTracker() {
  return [
    find(read('tools', 'extract.py'), /^TC_COMMIT = "([0-9a-f]{40})"/m, 'Tracker data tool (ffxiv-teamcraft, patch labels)', 'tracker/tools/extract.py'),
    find(read('data', 'tracker-data.json').slice(0, 2000), /ffxiv-teamcraft\/ffxiv-teamcraft ([0-9a-f]{7,40})/, 'Tracker data (ffxiv-teamcraft, patch labels)', 'tracker/data/tracker-data.json')
  ];
}
// the message that names the two pins that differ, or '' when all are the same
function mismatch(pins) {
  for (let i = 1; i < pins.length; i++) {
    if (pins[i].sha !== pins[0].sha) {
      return 'Game-data pins differ: the ' + pins[0].who + ' is at ' + pins[0].sha + ' (' + pins[0].where + ') but the ' + pins[i].who + ' is at ' + pins[i].sha + ' (' + pins[i].where +
        '). Move them together: see the refresh checklist in tracker/data/SOURCES.md.';
    }
  }
  return '';
}
test('R6-1 the game-data pins of the Tracker, the Atelier and the Lists data are the same commit; a difference names the two pins', () => {
  assert.equal(mismatch(datamining()), '', mismatch(datamining()));
  assert.equal(mismatch(teamcraftShared()), '', mismatch(teamcraftShared()));
  assert.equal(mismatch(teamcraftTracker()), '', mismatch(teamcraftTracker()));
  // the message itself: two differing pins are named, with their commits and files
  const pins = datamining(), bad = pins.map((p) => Object.assign({}, p));
  bad[2].sha = '12345678';
  const msg = mismatch(bad);
  assert.match(msg, /Tracker data tool/); assert.match(msg, /Atelier data tool/); assert.match(msg, /12345678/); assert.match(msg, /prepare-data\.py/);
  assert.equal(mismatch(pins.map((p) => Object.assign({}, p))), '');
});

// ---------------------------------------------------------------- R6-2 item names in sync questions
test('R6-2 describeUnit names an item when it is given a lookup and keeps the number without one', () => {
  require(path.join(T, 'src', 'core', 'save.js'));
  const CC = globalThis.CC, nameOf = (c) => ({ c1: 'Tamsin Reed' })[c] || c;
  const names = { 5056: 'Bronze Ingot', 5057: 'Iron Ingot' }, lookup = (id) => names[id] || '';
  const d = (p, l, r, integ, look) => CC.describeUnit('m|' + JSON.stringify(p), l, r, nameOf, integ, look);
  assert.equal(d(['lists', 'have', 'c1.5056'], '{"nq":3}', '{"nq":5}', undefined, lookup).what, 'Lists: the amount Tamsin Reed has of Bronze Ingot', 'the question names the item');
  assert.equal(d(['lists', 'have', 'c1.5056'], '{"nq":3}', '{"nq":5}').what, 'Lists: the amount Tamsin Reed has of item 5056', 'without a lookup it is the number, as before');
  assert.equal(d(['lists', 'have', 'c1.9999'], '{"nq":3}', '{"nq":5}', undefined, lookup).what, 'Lists: the amount Tamsin Reed has of item 9999', 'an item the lookup does not know stays a number');
  assert.equal(d(['lists', 'ways', 'c1.5057'], '{"by":"craft"}', '{"by":"vendor"}', undefined, lookup).what, 'Lists: how Tamsin Reed gets Iron Ingot');
  assert.equal(d(['lists', 'targets', 'l1aaaaaaaaaa.t1aaaaaaaaaa'], '{"item":5056,"recipe":0,"qty":3}', '{"item":5056,"recipe":0,"qty":4}', { listName: 'Food' }, lookup).what, 'Lists: “Food”: a wanted item (Bronze Ingot, 3 wanted)');
  assert.equal(d(['lists', 'have', 'c1.5056'], '{"nq":3}', '{"nq":5}', undefined, () => { throw new Error('boom'); }).what, 'Lists: the amount Tamsin Reed has of item 5056', 'a lookup that fails leaves the number');
});

// ---------------------------------------------------------------- R6-3 the page uses the engine's own way rule
require(path.join(T, 'command-center', 'src', 'lists', 'engine.js'));
test('R6-3 the page asks the engine for its ways and offers, and the engine\'s list agrees with the way it plans', () => {
  const page = read('command-center', 'src', 'lists', 'lists.js');
  assert.match(page, /LISTS\.waysFor\(DATA, item, q/, 'the page calls the engine for the ways of an item');
  assert.match(page, /LISTS\.offersFor\(DATA, item, q\)/, 'the page calls the engine for the offers of an item');
  assert.ok(!/res\.push\('(vendor|craft|gather|trade|market)'\)/.test(page), 'the page no longer keeps its own copy of the way rule');
  const L = globalThis.LISTS, D = json('tests', 'fixtures', 'lists-fixture.json');
  let n = 0;
  for (const id of Object.keys(D.items)) for (const q of ['normal', 'hq']) {
    const ways = L.waysFor(D, +id, q), w = L.way(D, {}, +id, q);
    if (ways.length) assert.equal(w.by, ways[0], 'item ' + id + ' ' + q + ': the planned way is the first of the ways offered');
    else assert.equal(w.by, 'other', 'item ' + id + ' ' + q + ': no way offered, none planned');
    for (const by of ways) assert.equal(L.way(D, { ways: { [id]: { by } } }, +id, q).by, by, 'item ' + id + ' ' + q + ': every offered way can be chosen');
    for (const by of ['vendor', 'craft', 'gather', 'trade', 'market']) if (!ways.includes(by)) assert.notEqual(L.way(D, { ways: { [id]: { by } } }, +id, q).why, 'chosen', 'item ' + id + ' ' + q + ': ' + by + ' is not offered, so it is not chosen');
    n++;
  }
  assert.ok(n > 20, 'the fixture was walked');
  // the real data: the offers split as the engine reads them
  const R = json('data', 'lists.json'), o = L.offersFor(R, 5056, 'normal');
  assert.ok(Array.isArray(o.gil) && Array.isArray(o.trade));
  assert.equal(o.gil.length + o.trade.length, (R.trades[5056] || []).filter((t) => !t[2]).length);
});

// ---------------------------------------------------------------- R6-4 spots without a position stay
test('R6-4 an item with placed and unplaced nodes keeps the unplaced ones, with their windows, after the placed ones', () => {
  const R = json('data', 'lists.json'), sp = R.gather[12538]; // Adamantite Ore
  assert.ok(sp && sp.length >= 2, 'Adamantite Ore has the placed spot and the unplaced ones');
  const placed = (s) => s[4] > 0 || s[5] > 0;
  assert.ok(placed(sp[0]), 'the first spot has a map position');
  assert.deepEqual(sp[0][7], [0, 12], 'the placed spot keeps its timed hours');
  const loose = sp.filter((s) => !placed(s));
  assert.ok(loose.length >= 1 && loose.every((s) => Array.isArray(s[7]) && s[7].length && s[8] > 0), 'the unplaced spots keep their windows');
  assert.ok(sp.map(placed).join().indexOf('false,true') < 0, 'every placed spot comes before every unplaced one');
  // across the file: never an unplaced spot before a placed one; an unplaced spot has no position and no aetheryte
  let mixed = 0;
  for (const [item, list] of Object.entries(R.gather)) {
    const flags = list.map(placed), first = flags.indexOf(false);
    if (first >= 0 && flags.slice(first).includes(true)) assert.fail('item ' + item + ' has a placed spot after an unplaced one');
    if (first > 0) mixed++;
    list.filter((s) => !placed(s)).forEach((s) => { assert.deepEqual([s[4], s[5], s[6]], [0, 0, 0]); assert.ok(s[9] === 0 || (typeof s[9] === 'string' && s[9]), 'folklore is 0 or a name'); });
  }
  assert.ok(mixed >= 40, 'items with both kinds: ' + mixed);
  assert.match(read('tools', 'lists-data.py'), /loose/, 'the tool keeps the unplaced nodes');
});
