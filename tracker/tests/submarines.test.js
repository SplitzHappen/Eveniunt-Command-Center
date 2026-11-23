'use strict';
// Submersibles data (design step S1): the counts of data/submarines.json and the five hand-worked voyages in
// tests/fixtures/submarine-voyages.json, recomputed here independently of the tool that built the data.
// Run: node --test tests/submarines.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'submarine-voyages.json'), 'utf8'));
const SECTOR = new Map(D.sectors.map((s) => [s.id, s]));
const SEA = new Map(D.seas.map((s) => [s.id, s]));
const PART = new Map(D.parts.map((p) => [p.id, p]));
const RANK = new Map(D.ranks.map((r) => [r.rank, r]));
const STATS = ['surveillance', 'retrieval', 'speed', 'range', 'favor'];
const SLOTS = ['hull', 'stern', 'bow', 'bridge'];
const TOP = D.ranks[D.ranks.length - 1].rank;

// ---------------------------------------------------------------- an independent reading of the formulas
function stats(rank, parts) {
  const out = {};
  for (const k of STATS) out[k] = SLOTS.reduce((t, sl) => t + PART.get(parts[sl])[k], 0) + RANK.get(rank)[k + 'Bonus'];
  return out;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function voyage(route, speed) {
  const F = D.formula;
  const v = Math.max(speed, F.minSpeed);
  let prev = SEA.get(SECTOR.get(route[0]).sea), range = 0, secs = 0;
  for (const id of route) {
    const s = SECTOR.get(id), l = dist(prev, s);
    range += Math.floor(l * F.distanceFactor) + s.surveyDistance;
    secs += Math.floor(l * F.travelFactor / (v * 100) * 60) + Math.floor(s.survey * F.surveyFactor / (v * 100) * 60);
    prev = s;
  }
  return { range, seconds: secs + F.fixedSeconds };
}
function rankAfter(rank, into, exp) {
  let r = rank, e = into + exp;
  while (r < TOP && e >= RANK.get(r).expToNext) { e -= RANK.get(r).expToNext; r += 1; }
  return { rank: r, into: e };
}

// ---------------------------------------------------------------- counts and shape
test('counts match the design: 143 sectors in 7 seas, 40 parts, 145 ranks', () => {
  assert.equal(D.sectors.length, 143);
  assert.equal(D.seas.length, 7);
  assert.deepEqual(D.seas.map((s) => D.sectors.filter((x) => x.sea === s.id).length), [30, 20, 20, 20, 20, 20, 13]);
  assert.deepEqual(D.seas.map((s) => s.name), ['Deep-sea Site', 'Sea of Ash', 'Sea of Jade', 'Sirensong Sea', 'Lilac Sea', 'South Indigo Deep', 'The Northern Empty']);
  assert.equal(D.parts.length, 40);
  assert.equal(D.classes.length, 10);
  assert.deepEqual(D.ranks.map((r) => r.rank), Array.from({ length: 145 }, (_, n) => n + 1));
  assert.equal(D.ranks.slice(0, -1).reduce((t, r) => t + r.expToNext, 0), 1829558717);
  assert.deepEqual(D.counts, { sectors: 143, seas: 7, parts: 40, classes: 10, ranks: 145, expToMaxRank: 1829558717, lootPairs: 1085, lootSectors: 141, lootItems: 356, unlockNameChecks: 141, dropSectors: 143, dropRecords: 205249206, breakpoints: 143, dropRewards: 1353, dropItemsAdded: 57 });
});

test('sectors: unique ids, one letter per sea, ranks 1 to 145, whole-number fields', () => {
  assert.equal(SECTOR.size, 143);
  for (const sea of D.seas) {
    const letters = D.sectors.filter((s) => s.sea === sea.id).map((s) => s.letter);
    assert.equal(new Set(letters).size, letters.length, sea.name);
    assert.ok(!SECTOR.has(sea.start), 'a starting point is not a sector');
  }
  for (const s of D.sectors) {
    assert.ok(SEA.has(s.sea));
    assert.ok(s.name.endsWith(`(${s.letter})`), s.name);
    assert.ok(!/[*<>]/.test(s.name), 'no markup in ' + s.name);
    for (const k of ['rank', 'tanks', 'survey', 'exp', 'surveyDistance', 'stars', 'x', 'y', 'z']) assert.ok(Number.isInteger(s[k]), `${s.id}.${k}`);
    assert.ok(s.rank >= 1 && s.rank <= 145 && s.tanks >= 1 && s.survey > 0 && s.exp > 0);
  }
  assert.equal(Math.min(...D.sectors.map((s) => s.rank)), 1);
  assert.equal(Math.max(...D.sectors.map((s) => s.rank)), 145);
});

test('parts: ten classes of four slots, named from their items; class ranks 1, 15, 25, 35, 45 and five at 50', () => {
  for (const c of D.classes) {
    assert.equal(c.parts.length, 4);
    c.parts.forEach((id, n) => {
      const p = PART.get(id);
      assert.equal(p.class, c.id);
      assert.equal(p.slotName, SLOTS[n]);
      assert.equal(p.rank, c.rank);
      assert.equal(D.items[String(p.item)], p.name);
      assert.ok(p.name.startsWith(c.name + '-class '), p.name);
    });
  }
  assert.deepEqual(D.classes.map((c) => c.rank), [1, 15, 25, 35, 45, 50, 50, 50, 50, 50]);
  assert.deepEqual(D.classes.slice(0, 5).map((c) => c.name), ['Shark', 'Unkiu', 'Whale', 'Coelacanth', 'Syldra']);
  assert.equal(new Set(D.parts.map((p) => p.item)).size, 40);
});

test('ranks: bonuses start above rank 50 and never fall', () => {
  for (const r of D.ranks) if (r.rank <= 50) for (const k of STATS) assert.equal(r[k + 'Bonus'], 0, `rank ${r.rank}`);
  for (let n = 1; n < D.ranks.length; n++) for (const k of STATS) assert.ok(D.ranks[n][k + 'Bonus'] >= D.ranks[n - 1][k + 'Bonus']);
  assert.deepEqual(STATS.map((k) => RANK.get(145)[k + 'Bonus']), [110, 140, 100, 130, 105]);
});

test('loot: possible items for 141 sectors, every item named, the two newest sectors without a list', () => {
  let pairs = 0;
  for (const [sid, list] of Object.entries(D.loot)) {
    assert.ok(SECTOR.has(Number(sid)), sid);
    assert.deepEqual(list, [...new Set(list)].sort((a, b) => a - b));
    for (const it of list) assert.ok(D.items[String(it)], `item ${it}`);
    pairs += list.length;
  }
  assert.equal(pairs, 1085);
  assert.equal(Object.keys(D.loot).length, 141);
  assert.deepEqual(D.dropped.sectorsWithoutLoot, [148, 149]);
  assert.equal(D.dropped.lootEntries, 1361);
  assert.equal(D.dropped.lootWithoutSector.length, 18);
  assert.deepEqual(D.dropped.lootNotOnASector, [{ item: 46121, row: 136, why: 'starting point' }]);
  assert.equal(D.dropped.lootEntries - 18 - 1 - D.dropped.lootRepeats, 1085);
});

test('unlocks: every sector once, chains end at A or B of the first sea, slots 2 to 4 from J, O and T, each sea opened once', () => {
  assert.deepEqual(Object.keys(D.unlocks).map(Number).sort((a, b) => a - b), [...SECTOR.keys()].sort((a, b) => a - b));
  assert.deepEqual(Object.entries(D.unlocks).filter(([, e]) => e.start).map(([k]) => Number(k)), [1, 2]);
  for (const [k, e] of Object.entries(D.unlocks)) {
    let id = Number(k), steps = 0;
    while (!D.unlocks[String(id)].start) { id = D.unlocks[String(id)].by; assert.ok(SECTOR.has(id)); assert.ok(++steps < 143, 'loop at ' + k); }
    if (e.by && SECTOR.get(e.by).sea !== SECTOR.get(Number(k)).sea) assert.equal(D.unlocks[String(e.by)].opensSea, SECTOR.get(Number(k)).sea);
  }
  assert.deepEqual(D.subSlots, [{ slot: 2, sector: 10 }, { slot: 3, sector: 15 }, { slot: 4, sector: 20 }]);
  assert.deepEqual(D.subSlots.map((s) => SECTOR.get(s.sector).letter), ['J', 'O', 'T']);
  assert.deepEqual(Object.entries(D.unlocks).filter(([, e]) => e.extraSub).map(([k]) => Number(k)), D.subSlots.map((s) => s.sector));
  for (const s of D.subSlots) assert.equal(SECTOR.get(s.sector).sea, 1);
  const opens = Object.entries(D.unlocks).filter(([, e]) => e.opensSea).map(([k, e]) => [SECTOR.get(Number(k)).sea, e.opensSea]);
  assert.deepEqual(opens, [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]);
});

test('sources: every table names a pinned source; licences and the game-data notice are carried', () => {
  assert.equal(D.sources.game.commit, '44948e4cda5846eab0baa9872122a888fcc4f1b1');
  assert.equal(D.sources.game.notice, 'Game data (c) SQUARE ENIX CO., LTD.');
  assert.equal(D.sources.teamcraft.commit, '70429e214dc952be23114df514a18223dc429449');
  assert.equal(D.sources.submarineTracker.commit, '04c54d770f815cd416bbade1ac5b178b551a32b5');
  for (const s of [D.sources.teamcraft, D.sources.submarineTracker]) {
    assert.equal(s.licence, 'MIT');
    assert.match(s.notice, /^Copyright \(c\) \d{4} /);
    assert.match(s.permission, /The above copyright notice and this permission notice shall be included/);
  }
  for (const [name, t] of Object.entries(D.tables)) {
    assert.ok(D.sources[t.source], name);
    assert.equal(t.commit, D.sources[t.source].commit, name);
  }
  for (const k of ['unlocks', 'subSlots', 'commonRoutes']) assert.equal(D.tables[k].label, 'community data');
  assert.equal(D.tables.formula.label, 'calculated, not yet confirmed');
  assert.equal(D.formula.label, 'calculated, not yet confirmed');
  assert.deepEqual([D.formula.fixedSeconds, D.formula.distanceFactor, D.formula.travelFactor, D.formula.surveyFactor, D.formula.minSpeed, D.formula.maxSectors], [43200, 0.035, 3990, 7000, 1, 5]);
});

test('common routes lie in their sea; "Fight Club - OJ" is Deep-sea Site O then J', () => {
  for (const r of D.commonRoutes) {
    assert.ok(r.route.length >= 1 && r.route.length <= 5, r.name);
    for (const id of r.route) assert.equal(SECTOR.get(id).sea, r.sea, r.name);
  }
  const oj = D.commonRoutes.find((r) => r.name === 'Fight Club - OJ');
  assert.deepEqual(oj.route.map((id) => SECTOR.get(id).letter), ['O', 'J']);
  assert.equal(oj.sea, 1);
});

// ---------------------------------------------------------------- the five voyages
test('five hand-worked voyages, each with its working', () => {
  assert.equal(FX.voyages.length, 5);
  assert.equal(FX.formulaLabel, D.formula.label);
  for (const v of FX.voyages) assert.ok(v.working.length >= 8, v.id);
});

for (const v of FX.voyages) {
  test(`voyage ${v.id}: ${v.title}`, () => {
    const b = v.build;
    for (const sl of SLOTS) assert.ok(PART.get(b.parts[sl]).rank <= b.rank, `${v.id}: part rank`);
    assert.deepEqual(SLOTS.map((sl) => PART.get(b.parts[sl]).name), b.partNames);
    assert.ok(v.route.length >= 1 && v.route.length <= D.formula.maxSectors);
    const sea = SECTOR.get(v.route[0]).sea;
    for (const id of v.route) {
      assert.equal(SECTOR.get(id).sea, sea, `${v.id}: one sea`);
      assert.ok(SECTOR.get(id).rank <= b.rank, `${v.id}: sector ${id} needs rank ${SECTOR.get(id).rank}`);
    }
    assert.deepEqual(v.routeNames, v.route.map((id) => SECTOR.get(id).name));
    const st = stats(b.rank, b.parts);
    assert.deepEqual(st, v.stats);
    const r = voyage(v.route, st.speed);
    const e = v.expected;
    assert.equal(r.range, e.rangeUsed);
    assert.equal(r.range <= st.range, e.reachable);
    assert.equal(e.reachable, true);
    assert.equal(v.route.reduce((t, id) => t + SECTOR.get(id).tanks, 0), e.tanks);
    const exp = v.route.reduce((t, id) => t + SECTOR.get(id).exp, 0);
    assert.equal(exp, e.exp);
    const ra = rankAfter(b.rank, b.expIntoRank, exp);
    assert.equal(ra.rank, e.rankAfter);
    assert.equal(ra.into, e.expIntoRankAfter);
    assert.equal(r.seconds, e.voyageSeconds);
    assert.equal(new Date(Date.parse(v.sentAt) + r.seconds * 1000).toISOString().replace('.000Z', 'Z'), e.returnAt);
  });
}

test('rank walk stops at the top rank', () => {
  assert.deepEqual(rankAfter(145, 0, 999999999), { rank: 145, into: 999999999 });
  assert.equal(rankAfter(1, 0, 1829558717).rank, 145);
  assert.equal(rankAfter(1, 0, 1829558716).rank, 144);
});

// ---------------------------------------------------------------- duplicate free companies of one character (F.foldFcs)
globalThis.FLEET = globalThis.FLEET || {};
require('../command-center/src/submersibles/fleet.js');
const FOLD = globalThis.FLEET.foldFcs;
const bareFc = (name, charId, order) => ({ name, charId, order, unlockedSlots: 1, discovered: [1, 2] });
const solidFc = (name, charId, order) => Object.assign(bareFc(name, charId, order), { world: 'Ravana' });
const secOf = (fcs, subs) => ({ fcs, subs: subs || {}, trips: {}, settings: {} });

test('foldFcs: nothing to do returns an equal copy and no ids; the input is untouched', () => {
  const sec = secOf({ f1: bareFc('A', 'c1', 0), f2: bareFc('B', 'c2', 1), f3: solidFc('C', null, 2), f4: solidFc('D', null, 3) });
  const copy = JSON.parse(JSON.stringify(sec));
  const r = FOLD(sec);
  assert.deepEqual(r.section, sec); assert.deepEqual(r.removed, []); assert.notEqual(r.section, sec);
  assert.deepEqual(sec, copy);
});
test('foldFcs: all bare keeps the lowest order, then the lowest id; the others go', () => {
  const sec = secOf({ fb: bareFc('X', 'c1', 3), fa: bareFc('Y', 'c1', 3), fc: bareFc('Z', 'c1', 5), fz: bareFc('W', 'c1', 1), other: bareFc('O', 'c2', 0) });
  const r = FOLD(sec);
  assert.deepEqual(r.removed, ['fa', 'fb', 'fc']); assert.deepEqual(Object.keys(r.section.fcs).sort(), ['fz', 'other']);
  const tie = FOLD(secOf({ fb: bareFc('X', 'c1', 2), fa: bareFc('Y', 'c1', 2) }));
  assert.deepEqual(tie.removed, ['fb']); assert.equal(tie.section.fcs.fa.name, 'Y');
});
test('foldFcs: a bare one goes when another has submarines, a world, more slots or more sectors; an empty name is filled', () => {
  const withSub = secOf({ s: bareFc('Real', 'c1', 0), b: bareFc('Typed', 'c1', 1) }, { u1: { fcId: 's', slot: 1 } });
  const r = FOLD(withSub);
  assert.deepEqual(r.removed, ['b']); assert.deepEqual(Object.keys(r.section.subs), ['u1']); assert.equal(r.section.fcs.s.name, 'Real');
  const empty = FOLD(secOf({ s: Object.assign(bareFc('', 'c1', 0), { unlockedSlots: 2 }), b1: bareFc('', 'c1', 1), b2: bareFc('Typed', 'c1', 2) }));
  assert.deepEqual(empty.removed, ['b1', 'b2']); assert.equal(empty.section.fcs.s.name, 'Typed');
  assert.deepEqual(FOLD(secOf({ w: solidFc('W', 'c1', 0), b: bareFc('B', 'c1', 1) })).removed, ['b']);
  assert.deepEqual(FOLD(secOf({ w: Object.assign(bareFc('W', 'c1', 0), { discovered: [1, 2, 3] }), b: bareFc('B', 'c1', 1) })).removed, ['b']);
  const named = FOLD(secOf({ s: bareFc('Keep', 'c1', 0), b: bareFc('Typed', 'c1', 1) }, { u1: { fcId: 's', slot: 1 } }));
  assert.equal(named.section.fcs.s.name, 'Keep');
});
test('foldFcs: absent slots and sectors count as bare; free companies that are not bare, or with no character, are never removed', () => {
  const loose = (name) => ({ name, charId: 'c1', order: 0 });
  assert.deepEqual(FOLD(secOf({ a: loose('A'), b: loose('B') })).removed, ['b']);
  const two = secOf({ a: solidFc('A', 'c1', 0), b: solidFc('B', 'c1', 1) }, { u: { fcId: 'b', slot: 1 } });
  assert.deepEqual(FOLD(two).removed, []);
  const none = secOf({ a: bareFc('A', null, 0), b: bareFc('B', null, 0), c: { name: 'C', order: 0 }, d: { name: 'D', order: 0 } });
  assert.deepEqual(FOLD(none).removed, []);
});
test('isBare: bare; with a submarine, a world, more slots or a third discovery it is not; a missing company is not', () => {
  const ISBARE = globalThis.FLEET.isBare;
  const sec = secOf({ a: bareFc('A', 'c1', 0), s: bareFc('S', 'c1', 1), w: solidFc('W', 'c1', 2), n: Object.assign(bareFc('N', 'c1', 3), { unlockedSlots: 2 }), d: Object.assign(bareFc('D', 'c1', 4), { discovered: [1, 2, 3] }), l: { name: 'L', order: 5 } }, { u1: { fcId: 's', slot: 1 } });
  assert.equal(ISBARE(sec, 'a'), true); assert.equal(ISBARE(sec, 'l'), true);
  ['s', 'w', 'n', 'd', 'missing'].forEach((id) => assert.equal(ISBARE(sec, id), false, id));
});
test('foldFcs: applying it again removes nothing', () => {
  const once = FOLD(secOf({ a: bareFc('A', 'c1', 0), b: bareFc('B', 'c1', 1), c: bareFc('C', 'c1', 2), s: solidFc('S', 'c2', 0), t: bareFc('T', 'c2', 1) }));
  const again = FOLD(once.section);
  assert.deepEqual(again.removed, []); assert.deepEqual(again.section, once.section);
});

// ---------------------------------------------------------------- step S4-1: the sea chart (command-center/src/submersibles/chart.js)
require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'chart.js'));
const CH = globalThis.CHART.init(D);
const count = (text, needle) => text.split(needle).length - 1;
test('chart: every sea has one node per sector, all inside the box, one reveal line per sector revealed from the same sea', () => {
  assert.equal(CH.Y_DOWN, true);
  for (const sea of D.seas) {
    const v = CH.view(sea.id, []);
    const secs = D.sectors.filter((s) => s.sea === sea.id);
    assert.equal(v.nodes.length, sea.sectors); assert.equal(v.nodes.length, secs.length);
    const b = v.box;
    for (const n of v.nodes.concat([v.start])) assert.ok(n.x >= b.x && n.x <= b.x + b.w && n.y >= b.y && n.y <= b.y + b.h, `sea ${sea.id} node inside`);
    const want = secs.filter((s) => D.unlocks[s.id].by != null && SECTOR.get(D.unlocks[s.id].by).sea === sea.id).length;
    assert.equal(v.lines.length, want);
    for (const l of v.lines) assert.equal(D.unlocks[l.to].by, l.from);
    assert.deepEqual([v.start.x, v.start.y], [sea.x, sea.y]); // y drawn downward: unchanged
  }
  const A = CH.view(1, []).nodes.find((n) => n.letter === 'A'), start = CH.view(1, []).start;
  assert.ok(A.x > start.x && A.y < start.y); // by the data A lies up and to the right of Start
});
test('chart: sector states, slot labels and sea-opening labels', () => {
  const v = CH.view(1, [1, 3]);
  const st = Object.fromEntries(v.nodes.map((n) => [n.id, n.state]));
  assert.equal(st[1], 'found'); assert.equal(st[3], 'found');
  assert.equal(st[2], 'next'); // a start sector, not found yet
  for (const s of D.sectors.filter((x) => x.sea === 1)) {
    const u = D.unlocks[s.id];
    if (![1, 3].includes(s.id) && !u.start) assert.equal(st[s.id], u.by === 1 || u.by === 3 ? 'next' : 'far', 'sector ' + s.id);
  }
  assert.ok(Object.values(st).includes('far'));
  const slots = Object.fromEntries(D.subSlots.map((u) => [u.sector, u.slot]));
  for (const sea of D.seas) for (const n of CH.view(sea.id, [], 5).nodes) {
    assert.equal(n.slot, slots[n.id] || null);
    const o = D.unlocks[n.id].opensSea;
    assert.equal(n.opens, o ? SEA.get(o).name : null);
    assert.equal(n.rankOk, SECTOR.get(n.id).rank <= 5);
  }
  assert.deepEqual(D.subSlots.map((u) => CH.view(1, []).nodes.find((n) => n.id === u.sector).slot), [2, 3, 4]);
  assert.equal(D.sectors.filter((s) => D.unlocks[s.id].opensSea).length, 6);
  assert.equal(CH.view(1, []).nodes.find((n) => n.id === 30).opens, SEA.get(2).name);
  assert.equal(CH.view(99, []), null);
});
test('chart: the route is drawn in order from Start with numbers 1 to n; an empty route draws no line', () => {
  const v = CH.view(1, [1, 2, 3, 10, 15]);
  const route = [15, 10, 3];
  const svg = CH.svg(v, route);
  assert.equal(count(svg, '<polyline'), 1);
  const pts = /<polyline[^>]*points="([^"]+)"/.exec(svg)[1].split(' ').map((p) => p.split(',').map(Number));
  const want = [v.start].concat(route.map((id) => v.nodes.find((n) => n.id === id)));
  assert.equal(pts.length, route.length + 1);
  want.forEach((p, i) => { assert.ok(Math.abs(pts[i][0] - p.x) < 0.06 && Math.abs(pts[i][1] - p.y) < 0.06, 'point ' + i); });
  route.forEach((id, i) => {
    const node = new RegExp('data-sector="' + id + '"[\\s\\S]*?</g>').exec(svg)[0];
    assert.ok(new RegExp('class="chart-letter"[^>]*>[^<]* ' + (i + 1) + '</text>').test(node), 'number ' + (i + 1));
  });
  for (const none of [undefined, null, []]) assert.equal(count(CH.svg(v, none), '<polyline'), 0);
});
test('chart: the SVG holds each sector once, names are escaped, the route is numbered', () => {
  for (const sea of D.seas) {
    const svg = CH.svg(CH.view(sea.id, [1]));
    for (const s of D.sectors.filter((x) => x.sea === sea.id)) assert.equal(count(svg, `data-sector="${s.id}"`), 1);
    assert.equal(count(svg, 'data-sector='), sea.sectors);
    assert.equal(count(svg, 'tabindex="0"'), sea.sectors);
  }
  const svg = CH.svg(CH.view(1, []));
  assert.ok(!svg.includes("Offender's Rot")); assert.ok(svg.includes('Offender&#39;s Rot'));
  assert.ok(!/<[^>]*\bonclick/.test(svg));
  assert.ok(CH.svg(CH.view(1, [1, 2]), [1, 2]).includes('<polyline'));
});

// ---------------------------------------------------------------- review fixes: tap targets, labels
test('chart: tap circles are about 40 px across at a phone width and never overlap a neighbour', () => {
  for (const sea of D.seas) {
    const v = CH.view(sea.id, []), hits = CH.hitRadii(v), span = Math.max(v.box.w, v.box.h);
    for (const a of v.nodes) for (const c of v.nodes) if (a.id < c.id) assert.ok(hits[a.id] + hits[c.id] <= Math.hypot(a.x - c.x, a.y - c.y) + 1e-6, `sea ${sea.id}: ${a.id}/${c.id} circles overlap`);
    for (const a of v.nodes) assert.ok(hits[a.id] > 0);
    if (sea.id === 1) for (const a of v.nodes) assert.ok(hits[a.id] * 2 * 340 / span >= 36, `node ${a.id} tap target ${Math.round(hits[a.id] * 2 * 340 / span)} px`);
  }
  const svg = CH.svg(CH.view(1, []));
  assert.ok(!/class="hit" r="29\.\d"/.test(svg));
});
test('chart: an over-rank sector says so in its accessible label; slot and opens labels do not cover letters or markers', () => {
  const svg = CH.svg(CH.view(1, [], 10));
  assert.ok(/aria-label="[^"]*\(R\)[^"]*above this submarine's rank"/.test(svg.replace(/&#39;/g, "'")));
  assert.ok(!/aria-label="[^"]*\(A\)[^"]*above this submarine/.test(svg.replace(/&#39;/g, "'")));
  for (const sea of D.seas) {
    const v = CH.view(sea.id, []), svg2 = CH.svg(v), size = Math.max(v.box.w, v.box.h) / 30;
    const boxes = [];
    for (const g of svg2.split('<g class="chart-node').slice(1)) {
      const [tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g).slice(1).map(Number);
      const letter = /<text class="chart-letter" y="([-\d.]+)"[^>]*>([^<]*)</.exec(g);
      boxes.push({ id: +/data-sector="(\d+)"/.exec(g)[1], kind: 'letter', x0: tx - letter[2].length * 0.55 * size / 2, x1: tx + letter[2].length * 0.55 * size / 2, y0: ty + +letter[1] - size, y1: ty + +letter[1] + size * 0.25 });
      boxes.push({ id: +/data-sector="(\d+)"/.exec(g)[1], kind: 'marker', x0: tx - size * 0.4, x1: tx + size * 0.4, y0: ty - size * 0.4, y1: ty + size * 0.4 });
    }
    for (const g of svg2.split('<g class="chart-node').slice(1)) {
      const tag = /<text class="chart-tag" x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)">([^<]*)</.exec(g);
      if (!tag) continue;
      const [tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g).slice(1).map(Number), fsT = +tag[4], w = tag[5].length * 0.55 * fsT;
      const x0 = tx + +tag[1] - (tag[3] === 'start' ? 0 : tag[3] === 'end' ? w : w / 2), t = { x0, x1: x0 + w, y0: ty + +tag[2] - fsT, y1: ty + +tag[2] + fsT * 0.25 };
      const id = +/data-sector="(\d+)"/.exec(g)[1];
      for (const o of boxes) if (o.id !== id || o.kind === 'marker') assert.ok(!(t.x0 < o.x1 && o.x0 < t.x1 && t.y0 < o.y1 && o.y0 < t.y1), `sea ${sea.id}: label of ${id} covers ${o.kind} of ${o.id}`);
    }
  }
});

test('E4 chart: the "Start" label is clear of every node with its rings, every letter, mark, reveal line and route line, in every sea', () => {
  const viewsOf = (sea) => [
    [CH.view(sea.id, []), null, null],
    [CH.view(sea.id, ALL, 50), D.sectors.filter((x) => x.sea === sea.id).slice(0, 4).map((x) => x.id), { selected: D.sectors.find((x) => x.sea === sea.id).id }],
    [CH.view(sea.id, ALL.filter((i) => i % 2), 20), D.sectors.filter((x) => x.sea === sea.id && x.id % 2).slice(0, 5).map((x) => x.id), null]];
  let bad = 0;
  for (const sea of D.seas) for (const [v, route, opts] of viewsOf(sea)) {
    const svg = CH.svg(v, route, opts), size = Math.max(v.box.w, v.box.h) / 30, r = Math.max(v.box.w, v.box.h) / 70;
    const st = /<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)">Start</.exec(svg);
    assert.ok(st, 'Start label');
    const w = 5 * 0.55 * size, x0 = +st[1] - (st[3] === 'start' ? 0 : st[3] === 'end' ? w : w / 2), t = { x0, x1: x0 + w, y0: +st[2] - size, y1: +st[2] + size * 0.25 };
    const where = `sea ${sea.id} ${route ? 'route' : 'plain'}`;
    for (const n of v.nodes) assert.ok(!(n.x + r + 13 > t.x0 && n.x - r - 13 < t.x1 && n.y + r + 13 > t.y0 && n.y - r - 13 < t.y1), `${where}: Start label touches ${n.letter} or its rings`);
    for (const g of svg.split('<g class="chart-node').slice(1)) {
      const [tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g).slice(1).map(Number), l = /<text class="chart-letter" y="([-\d.]+)" text-anchor="(\w+)" font-size="[\d.]+"(?: x="([-\d.]+)")?>([^<]*)</.exec(g);
      const lw = l[4].length * 0.55 * size, lx = tx + (l[3] ? +l[3] : 0), lx0 = lx - (l[2] === 'start' ? 0 : l[2] === 'end' ? lw : lw / 2);
      assert.ok(!(t.x0 < lx0 + lw && lx0 < t.x1 && t.y0 < ty + +l[1] + size * 0.25 && ty + +l[1] - size < t.y1), `${where}: Start label covers a letter`);
    }
    const segs = v.lines.map((l) => [l.x1, l.y1, l.x2, l.y2]);
    const pl = /<polyline[^>]*points="([^"]+)"/.exec(svg); if (pl) { const p = pl[1].split(' ').map((q) => q.split(',').map(Number)); for (let i = 1; i < p.length; i++) segs.push([p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]]); }
    for (const [x1, y1, x2, y2] of segs) for (let i = 0; i <= 48; i++) { const px = x1 + (x2 - x1) * i / 48, py = y1 + (y2 - y1) * i / 48; if (px > t.x0 && px < t.x1 && py > t.y0 && py < t.y1) { bad++; assert.fail(`${where}: a line crosses the Start label`); } }
    assert.ok(t.x0 >= v.box.x && t.x1 <= v.box.x + v.box.w && t.y0 >= v.box.y && t.y1 <= v.box.y + v.box.h, `${where}: Start label inside the drawing`);
  }
  assert.equal(bad, 0);
});
test('E4 chart: every tap circle is 44 px across at a 360 px screen, or as large as the neighbours allow and never under the floor where room exists; none overlap', () => {
  for (const sea of D.seas) {
    const v = CH.view(sea.id, []), hits = CH.hitRadii(v), vb = /viewBox="([^"]+)"/.exec(CH.svg(v))[1].split(' ').map(Number), px = 320 / Math.max(vb[2], vb[3]); // the chart is about 320 px wide at 360 px
    for (const a of v.nodes) {
      const d = hits[a.id] * 2 * px;
      if (d >= 44 - 0.5) continue;
      const touching = v.nodes.some((c) => c !== a && Math.abs(hits[a.id] + hits[c.id] - Math.hypot(a.x - c.x, a.y - c.y)) < 1e-6);
      assert.ok(touching, `sea ${sea.id} node ${a.id}: ${d.toFixed(1)} px but no neighbour stops it`);
      assert.ok(d >= 28, `sea ${sea.id} node ${a.id}: ${d.toFixed(1)} px`);
    }
  }
  const sizes = D.seas.map((sea) => { const v = CH.view(sea.id, []), hits = CH.hitRadii(v), vb = /viewBox="([^"]+)"/.exec(CH.svg(v))[1].split(' ').map(Number); return Math.min(...v.nodes.map((n) => hits[n.id] * 2 * 320 / Math.max(vb[2], vb[3]))); });
  assert.ok(sizes[4] >= 43.5 && sizes[0] >= 34, 'measured minimum per sea: ' + sizes.map((x) => x.toFixed(1)).join(' '));
});
test('F5 chart: no slot or opens label is closer than 6 px to the marker of a sector it does not belong to (phone chart width and wider), in every sea', () => {
  const states = (sea) => [[], ALL, D.sectors.filter((s) => s.sea === sea.id && s.id % 3 === 0).map((s) => s.id)];
  for (const sea of D.seas) for (const disc of states(sea)) {
    const v = CH.view(sea.id, disc), svg = CH.svg(v), vb = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number), span = Math.max(v.box.w, v.box.h), r = span / 70;
    const half = { found: r, next: r * Math.SQRT2, far: r * 0.7 }, nodes = [];
    for (const g of svg.split('<g class="chart-node').slice(1)) { const [tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g).slice(1).map(Number), id = +/data-sector="(\d+)"/.exec(g)[1]; nodes.push({ id, tx, ty, g, h: half[v.nodes.find((n) => n.id === id).state] }); }
    for (const px of [320, 700]) { // 360 px phone, desktop
      const scale = px / Math.max(vb[2], vb[3]);
      for (const n of nodes) {
        const tag = /<text class="chart-tag" x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)">([^<]*)</.exec(n.g); if (!tag) continue;
        const fsT = +tag[4], w = tag[5].length * 0.55 * fsT, x0 = n.tx + +tag[1] - (tag[3] === 'start' ? 0 : tag[3] === 'end' ? w : w / 2), t = { x0, x1: x0 + w, y0: n.ty + +tag[2] - fsT, y1: n.ty + +tag[2] + fsT * 0.25 };
        for (const o of nodes) {
          if (o.id === n.id) continue;
          const dx = Math.max(o.tx - o.h - t.x1, t.x0 - (o.tx + o.h), 0), dy = Math.max(o.ty - o.h - t.y1, t.y0 - (o.ty + o.h), 0);
          assert.ok(Math.hypot(dx, dy) * scale >= 6, `sea ${sea.id}: label of ${n.id} is ${(Math.hypot(dx, dy) * scale).toFixed(1)} px from the marker of ${o.id} at ${px} px`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------- Revision 2, W18: the bolder chart (decoration only; geometry frozen)
test('chart W18: the seven viewBox strings are the baseline of W0 (geometry frozen), and the SVG text is deterministic', () => {
  const W0 = ['25.2 -17.6 939.6 1011.5', '81.6 77 857.5 912.9', '-5.9 8.6 1013.8 976.7', '-3.7 -0.7 1010.4 996.4', '-20.8 -7.3 1012.7 1004.6', '7.4 -9.4 995.3 1005.7', '277.4 85.7 704.1 917.6']; // measured before any W18 change
  assert.equal(D.seas.length, 7);
  D.seas.forEach((sea, i) => {
    const svg = CH.svg(CH.view(sea.id, []));
    assert.equal(/viewBox="([^"]+)"/.exec(svg)[1], W0[i], 'sea ' + sea.id);
    assert.equal(svg, CH.svg(CH.view(sea.id, [])));
    assert.ok(svg.includes(`data-sea="${sea.id}"`));
  });
});
test('chart W18: one polyline with a route and none without; selected only with opts.selected, once; one sweep; no nested g; new decoration is aria-hidden', () => {
  const v = CH.view(1, [1, 2, 3], 10), route = [1, 3];
  assert.equal(count(CH.svg(v, route), '<polyline'), 1); assert.equal(count(CH.svg(v), '<polyline'), 0);
  for (const none of [CH.svg(v, route), CH.svg(v, route, {}), CH.svg(v, route, { selected: null })]) assert.ok(!none.includes('selected') && !none.includes('chart-lock'));
  const sel = CH.svg(v, route, { selected: 3 });
  assert.equal(count(sel, ' selected"'), 1); assert.equal(count(sel, 'chart-lock'), 1);
  assert.ok(new RegExp('class="chart-node [^"]* selected" data-sector="3"').test(sel));
  assert.ok(new RegExp('class="chart-node [^"]*on-route[^"]*" data-sector="1"').test(sel));
  assert.equal(count(sel, 'class="chart-sweep"'), 1);
  assert.ok(sel.includes('has-slot')); assert.ok(CH.svg(CH.view(1, [])).includes('opens-sea'));
  for (const sea of D.seas) {
    const svg = CH.svg(CH.view(sea.id, [1]), [1], { selected: 1 }), nodes = svg.split('<g class="chart-node').slice(1);
    for (const g of nodes) { const inner = g.slice(0, g.indexOf('</g>')); assert.ok(!inner.includes('<g'), 'no nested g'); assert.equal(count(g.slice(0, g.indexOf('</g>')), 'tabindex'), 1); }
    assert.equal(count(svg, 'tabindex="0"'), sea.sectors);
    const outside = [svg.slice(0, svg.indexOf('<g class="chart-start"')), svg.slice(svg.lastIndexOf('</g>') + 4)].join('');
    for (const gh of outside.match(/<g class="chart-(?:rings|sweep|lines|chevs)"[^>]*>/g)) assert.ok(gh.includes('aria-hidden="true"')); // the children of these groups are hidden with them
    const top = outside.replace(/<g class="chart-(?:rings|sweep|lines|chevs)"[^>]*>.*?<\/g>/g, '');
    for (const el of top.match(/<(path|line|circle|polyline|g)\b[^>]*>/g) || []) assert.ok(el.includes('aria-hidden="true"'), 'aria-hidden: ' + el.slice(0, 60));
    for (const el of svg.match(/<(path|circle)\b[^>]*class="chart-(start-ring|start-ping|halo|overring|routering|ring2|lock|plus)"[^>]*>/g) || []) assert.ok(el.includes('aria-hidden="true"'));
    assert.ok(count(svg, 'class="chart-grid major"') === 1 && count(svg, 'class="chart-grid"') === 1);
  }
});
test('chart W18: with C.Y_DOWN false the rings and the sweep stay centred on Start and every grid line lies on a multiple of 100 in data y', () => {
  const saved = CH.Y_DOWN;
  try {
    for (const down of [true, false]) {
      CH.Y_DOWN = down;
      for (const sea of D.seas) {
        const v = CH.view(sea.id, []), svg = CH.svg(v), secs = D.sectors.filter((s) => s.sea === sea.id);
        const ys = secs.map((s) => s.y).concat([sea.y]), sum = Math.min(...ys) + Math.max(...ys);
        const near = (a, b) => Math.abs(a - b) < 0.06;
        assert.ok(near(v.start.y, down ? sea.y : sum - sea.y) && near(v.start.x, sea.x));
        const rings = svg.match(/<circle class="(?:solid|dash)" cx="([-\d.]+)" cy="([-\d.]+)"/g);
        assert.ok(rings.length >= 1 && rings.length <= 8);
        for (const r of rings) { const m = /cx="([-\d.]+)" cy="([-\d.]+)"/.exec(r); assert.ok(near(+m[1], v.start.x) && near(+m[2], v.start.y)); }
        const o = /transform-origin:([-\d.]+)px ([-\d.]+)px/.exec(svg); assert.ok(near(+o[1], v.start.x) && near(+o[2], v.start.y), 'sweep origin');
        const fan = /class="chart-sweep-fan" d="M([-\d.]+) ([-\d.]+)L/.exec(svg); assert.ok(near(+fan[1], v.start.x) && near(+fan[2], v.start.y), 'fan point on Start');
        const lines = svg.match(/<path class="chart-grid(?: major)?" aria-hidden="true" d="([^"]*)"/g).map((x) => /d="([^"]*)"/.exec(x)[1]);
        let horizontal = 0;
        for (const d of lines) for (const seg of d.match(/M[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+/g) || []) {
          const [x1, y1, x2, y2] = seg.match(/-?[\d.]+/g).map(Number);
          if (near(y1, y2)) { horizontal++; const dataY = down ? y1 : sum - y1; assert.ok(Math.abs(dataY / 100 - Math.round(dataY / 100)) < 0.002, 'y ' + dataY); } else { assert.ok(near(x1, x2)); assert.ok(Math.abs(x1 / 100 - Math.round(x1 / 100)) < 0.002, 'x ' + x1); }
        }
        assert.ok(horizontal > 5);
      }
    }
  } finally { CH.Y_DOWN = saved; }
  assert.equal(CH.Y_DOWN, true);
});

// ---------------------------------------------------------------- R1: the recommendation settings (recs.js)
// First (spec risk 1): a save section of its own, 'submersibles-recommendations', survives the shared save's checks,
// another module's write and a merge, with no change to save.js (it keeps a section it has no checker for as plain data).
test('R1: the section submersibles-recommendations survives checkDoc, another module\'s writeSection and mergeModules', async () => {
  require(path.join(__dirname, '..', 'src', 'core', 'save.js'));
  const CC = globalThis.CC;
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
  CC.resetMemory();
  const NAME = 'submersibles-recommendations';
  assert.ok(CC.MODULE.test(NAME), 'the name is a valid module name');
  const rec = { choices: { fuel: true, giveUp: 20, order: ['gil', 'unlock', 'level', 'loot'], loot1: 5665, loot2: 0, use2: false } };
  // checkDoc
  const doc = { app: CC.APP, v: CC.VERSION, updated: 1, chars: [], modules: { [NAME]: rec }, device: {}, moved: {} };
  assert.deepStrictEqual(CC.checkDoc(doc).modules[NAME], rec, 'checkDoc keeps it exactly');
  // another module's writeSection
  const first = await CC.writeSection(NAME, rec, null);
  await CC.writeSection('lists', { lists: { l1: { name: 'Gear', items: {} } } }, { rev: first.rev, base: null });
  const stored = CC.checkDoc((await CC.read()).raw).modules;
  assert.deepStrictEqual(stored[NAME], rec, 'another module\'s write leaves it');
  assert.deepStrictEqual(stored.lists.lists.l1.name, 'Gear');
  // mergeModules: changed on one side only is taken; an unrelated module's change leaves it; both sides keep it
  const other = { lists: { lists: { l2: { name: 'Food', items: {} } } } };
  const merged = CC.mergeModules({ [NAME]: rec }, Object.assign({ [NAME]: rec }, other), { [NAME]: rec });
  assert.deepStrictEqual(merged[NAME], rec, 'a merge keeps it');
  const rec2 = { choices: Object.assign({}, rec.choices, { fuel: false }) };
  assert.deepStrictEqual(CC.mergeModules({ [NAME]: rec }, { [NAME]: rec }, { [NAME]: rec2 })[NAME].choices.fuel, false, 'a change from the other device is taken');
  assert.deepStrictEqual(CC.mergeModules({ [NAME]: rec }, { [NAME]: rec }, { [NAME]: rec })[NAME], rec);
  assert.deepStrictEqual(CC.mergeModules({}, other, { [NAME]: rec })[NAME], rec, 'a section only the other device has is taken');
  delete globalThis.localStorage;
  CC.resetMemory();
});

const RECS = (require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'recs.js')), globalThis.RECS);
const route = (id, secs, tanks, sectors, extra) => Object.assign({ id, route: sectors || [id.charCodeAt(0)], seconds: secs, tanks }, extra);
const byAmount = (key, rate) => ({ key, objective: key, rate: !!rate, amount: (r) => r[key] });

test('R1: constants, labels and defaults', () => {
  assert.deepEqual(RECS.KEYS, ['unlock', 'level', 'gil', 'loot']);
  assert.deepEqual(RECS.KEYS.map((k) => RECS.LABEL[k]), ['Unlocking Routes', 'Leveling Submersible Rank', 'Gil Farming', 'Loot Farming']);
  assert.equal(RECS.NAME, 'submersibles-recommendations');
  assert.equal(RECS.BAND, 0.05);
  assert.deepEqual([RECS.GIVE_UP, RECS.GIVE_MIN, RECS.GIVE_MAX, RECS.GIVE_STEP], [15, 5, 50, 5]);
  assert.deepEqual(RECS.defaults(), { fuel: false, giveUp: 15, order: ['unlock', 'level', 'gil', 'loot'], loot: [[0, true], [0, false], [0, false], [0, false], [0, false]] });
  assert.deepEqual(RECS.check({ choices: RECS.defaults() }), RECS.defaults(), 'what check returns for the defaults is the defaults');
});

test('R1/D5: items holds each item of `loot` and of `dropRates` once, by name then id', () => {
  const items = RECS.items(D);
  assert.equal(new Set(items.map((x) => x.id)).size, items.length);
  const all = new Set(); for (const l of Object.values(D.loot)) for (const id of l) all.add(id);
  for (const sec of Object.values(D.dropRates.sectors)) for (const pool of sec.pools) for (const row of pool.items) all.add(row[0]);
  assert.ok(items.length >= D.counts.lootItems, 'the loot items are all in the list');
  assert.deepEqual(items.map((x) => x.id).sort((a, b) => a - b), [...all].sort((a, b) => a - b));
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1], b = items[i];
    assert.ok(a.name.toLowerCase() < b.name.toLowerCase() || (a.name.toLowerCase() === b.name.toLowerCase() && (a.name < b.name || (a.name === b.name && a.id < b.id))), a.name + ' before ' + b.name);
  }
  const small = { loot: { 1: [7, 3], 2: [3, 9] }, items: { 7: 'Beta', 3: 'alpha', 9: 'Beta', 4: 'Gamma' }, dropRates: { sectors: { 1: { pools: [{ items: [[4, 1, 1], [3, 1, 1]] }, { items: [] }, { items: [] }] } } } };
  assert.deepEqual(RECS.items(small), [{ id: 3, name: 'alpha' }, { id: 7, name: 'Beta' }, { id: 9, name: 'Beta' }, { id: 4, name: 'Gamma' }]);
  assert.deepEqual(RECS.items(null), []);
});

test('R1: check reads every row of the storage table and never fails on rubbish', () => {
  const [a, b, c] = RECS.items(D);
  const sec = (ch) => ({ choices: ch });
  const dflt = RECS.defaults();
  for (const bad of [undefined, null, 5, 'x', [], {}, { choices: null }, { choices: [] }, { choices: 7 }]) assert.deepEqual(RECS.check(bad, D), dflt);
  // fuel: anything but true is off
  assert.equal(RECS.check(sec({ fuel: true }), D).fuel, true);
  for (const v of [false, 1, 'true', null, undefined, {}]) assert.equal(RECS.check(sec({ fuel: v }), D).fuel, false);
  // giveUp: whole number 5 to 50, a multiple of 5
  for (const v of [5, 15, 25, 50]) assert.equal(RECS.check(sec({ giveUp: v }), D).giveUp, v);
  for (const v of [0, 4, 7, 55, 100, -5, 12.5, '20', null, NaN]) assert.equal(RECS.check(sec({ giveUp: v }), D).giveUp, RECS.GIVE_UP);
  // order: the four keys, each once
  assert.deepEqual(RECS.check(sec({ order: ['gil', 'loot', 'level', 'unlock'] }), D).order, ['gil', 'loot', 'level', 'unlock']);
  for (const v of [['gil', 'gil', 'level', 'unlock'], ['gil', 'loot', 'level'], ['gil', 'loot', 'level', 'unlock', 'x'], ['a', 'b', 'c', 'd'], 'gil', null]) assert.deepEqual(RECS.check(sec({ order: v }), D).order, dflt.order);
  // loot1 to loot5 and use2 to use5: 0 is none; picker 1 is always on; unknown item or later duplicate is none; missing keys are none and off
  assert.deepEqual(RECS.check(sec({ loot1: a.id, use2: true, loot2: b.id }), D).loot, [[a.id, true], [b.id, true], [0, false], [0, false], [0, false]]);
  assert.deepEqual(RECS.check(sec({ use1: false, loot1: a.id, loot2: b.id, use2: false, loot3: c.id, use3: 1, use4: true, loot5: a.id, use5: true }), D).loot, [[a.id, true], [b.id, false], [c.id, false], [0, true], [0, true]], 'use1 is never read');
  assert.deepEqual(RECS.check(sec({ loot1: 999999999, loot2: 'x', loot3: null, loot4: a.id, use4: 'true', loot5: 1.5, use5: true }), D).loot, [[0, true], [0, false], [0, false], [a.id, false], [0, true]]);
  assert.deepEqual(RECS.check(sec({ loot1: 'x', loot2: [a.id], use2: [] }), D).loot, dflt.loot);
  // the same raw value gives the same result and the input is not touched
  const raw = sec({ fuel: true, giveUp: 20, order: ['gil', 'loot', 'level', 'unlock'], loot1: a.id });
  const before = JSON.stringify(raw); RECS.check(raw, D); assert.equal(JSON.stringify(raw), before);
});

test('R1: active and sig', () => {
  const [a, b, c] = RECS.items(D);
  const ch = RECS.check({ choices: { loot1: a.id, loot2: b.id, use2: false, loot3: c.id, use3: true } }, D);
  assert.deepEqual(RECS.active(ch), [a.id, c.id], 'a picker that is off is not chosen');
  assert.deepEqual(RECS.active(RECS.defaults()), []);
  assert.deepEqual(RECS.active({ loot: [[a.id, true], [0, true], [a.id, true]] }), [a.id], 'each item once');
  const s0 = RECS.sig(RECS.defaults());
  assert.equal(typeof s0, 'string');
  assert.notEqual(RECS.sig(Object.assign(RECS.defaults(), { fuel: true })), s0);
  assert.notEqual(RECS.sig(Object.assign(RECS.defaults(), { order: ['gil', 'unlock', 'level', 'loot'] })), s0);
  assert.notEqual(RECS.sig(ch), s0);
  assert.equal(RECS.sig(Object.assign(RECS.defaults(), { giveUp: 30 })), s0, 'the allowance matters only with fuel on');
  assert.notEqual(RECS.sig(Object.assign(RECS.defaults(), { fuel: true, giveUp: 30 })), RECS.sig(Object.assign(RECS.defaults(), { fuel: true, giveUp: 20 })));
  assert.equal(RECS.sig(Object.assign({}, ch, { loot: [[a.id, true], [b.id, false], [c.id, true], [0, false], [0, false]] })), RECS.sig(ch));
});

test('R1: pick, the 5% band at 4.9% and 5.1%', () => {
  // equal seconds: the score is the amount
  const X = route('X', 3600, 1, [1], { u: 100 }), In = route('I', 3600, 1, [2], { u: 95.1 }), Out = route('O', 3600, 1, [3], { u: 94.9 });
  const lowIn = route('L', 3600, 1, [4], { u: 1, g: 5 }), lowOut = route('M', 3600, 1, [5], { u: 1, g: 99 });
  // priority 2 chooses only among routes within 5% of the best for priority 1
  const r = RECS.pick([X, In, Out, lowIn, lowOut].map((x) => Object.assign({}, x, { g: x.g || (x.id === 'I' ? 50 : x.id === 'O' ? 90 : 10) })), [byAmount('u'), byAmount('g')], {});
  assert.equal(r.plan.id, 'I', '4.9% below the best stays in the band; 5.1% below leaves it');
  assert.equal(r.lead, 'u');
  assert.deepEqual(r.used, ['u', 'g']);
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.routes.map((x) => x.id).slice(0, 3), ['I', 'X', 'O'], 'steps survived first, then the scores');
  assert.equal(r.routes.length, 5, 'every candidate is returned');
});

test('R1: pick, per hour or per voyage', () => {
  const longer = route('L', 7200, 1, [1], { a: 150 }), quick = route('Q', 3600, 1, [2], { a: 100 });
  assert.equal(RECS.pick([longer, quick], [byAmount('a', true)], {}).plan.id, 'Q', '100 an hour beats 75 an hour');
  assert.equal(RECS.pick([longer, quick], [byAmount('a', false)], {}).plan.id, 'L', 'per voyage the larger amount wins');
});

test('R1: pick, a stage with nothing to give is skipped and named; prepare gives the amount function', () => {
  const a = route('A', 3600, 1, [1], { g: 3 }), b = route('B', 3600, 1, [2], { g: 5 });
  const zero = { key: 'unlock', objective: 'unlock', rate: true, amount: () => 0, reason: 'every sector is found' };
  const seen = [];
  const prepared = { key: 'gil', objective: 'gil', rate: true, prepare: (S) => { seen.push(S.length); return (r) => r.g; } };
  const r = RECS.pick([a, b], [zero, prepared], {});
  assert.equal(r.plan.id, 'B');
  assert.equal(r.lead, 'gil', 'the lead is the first live stage');
  assert.deepEqual(r.used, ['gil']);
  assert.deepEqual(r.skipped, [{ key: 'unlock', objective: 'unlock', reason: 'every sector is found' }]);
  assert.deepEqual(seen, [2]);
  // a later stage prepares on the routes still in play only
  const seen2 = [];
  const first = byAmount('g'), second = { key: 'x', objective: 'x', rate: true, prepare: (S) => { seen2.push(S.map((q) => q.id)); return () => 1; } };
  RECS.pick([a, b, route('C', 3600, 1, [3], { g: 1 })], [first, second], {});
  assert.deepEqual(seen2, [['B']]);
  // nothing live at all: no lead, order by seconds, tanks, id
  const none = RECS.pick([route('Z', 100, 1), route('Y', 100, 1)], [zero], {});
  assert.equal(none.lead, null); assert.deepEqual(none.used, []); assert.equal(none.plan.id, 'Y');
  assert.deepEqual(RECS.pick([], [zero], {}).plan, null);
});

test('R1: pick, fuel on: the allowance replaces the band for the top priority, then the per-tank filter', () => {
  const best = route('B', 3600, 2, [1], { u: 100, g: 1 });      // 50 per tank
  const frugal = route('F', 3600, 1, [2], { u: 86, g: 1 });      // 86 per tank, 14% below the best
  const wasteful = route('W', 3600, 3, [3], { u: 90, g: 9 });    // 30 per tank
  const far = route('R', 3600, 1, [4], { u: 80, g: 99 });        // 20% below the best
  const cands = [best, frugal, wasteful, far];
  const off = RECS.pick(cands, [byAmount('u'), byAmount('g')], { fuel: false });
  assert.equal(off.plan.id, 'B', 'fuel off: band 5%, only the best remains');
  const on = RECS.pick(cands, [byAmount('u'), byAmount('g')], { fuel: true, giveUp: 15 });
  assert.equal(on.plan.id, 'F', 'allowance 15%: B, F and W are in; per tank only F is within 5% of the best');
  assert.equal(on.lead, 'u');
  assert.equal(on.routes[1].id, 'B', 'B stayed through the allowance but not the per-tank filter');
  const tight = RECS.pick(cands, [byAmount('u'), byAmount('g')], { fuel: true, giveUp: 10 });
  assert.equal(tight.plan.id, 'B', 'allowance 10% leaves F out (14% below); of B and W, B is the best per tank');
  // the allowance applies to the lead only: priority 2 uses the 5% band
  const l1 = route('1', 3600, 2, [1], { u: 100, g: 10 }), l2 = route('2', 3600, 1, [2], { u: 90, g: 50 }), l3 = route('3', 3600, 1, [3], { u: 89, g: 80 });
  const two = RECS.pick([l1, l2, l3], [byAmount('u'), byAmount('g')], { fuel: true, giveUp: 15 });
  assert.equal(two.plan.id, '3', 'the allowance lets 2 and 3 in with 1, the per-tank filter drops 1 (50 per tank), the second priority picks 3');
  const stage2 = RECS.pick([l1, l2, l3], [byAmount('u'), byAmount('g')], { fuel: false });
  assert.equal(stage2.plan.id, '1');
  // when the top stage is skipped, the allowance goes to the first live one (the lead)
  const skippedTop = RECS.pick(cands, [{ key: 'level', objective: 'level', rate: true, amount: () => 0 }, byAmount('u'), byAmount('g')], { fuel: true, giveUp: 15 });
  assert.equal(skippedTop.plan.id, 'F');
  assert.equal(skippedTop.lead, 'u');
  // the default allowance is the module's
  assert.equal(RECS.pick(cands, [byAmount('u')], { fuel: true, giveUp: 15 }).plan.id, 'F'); // the pick falls back to RECS.GIVE_UP; the 15 here keeps this case about the rule, not the shipped number
});

test('R1: pick, each tie-break in order: steps, scores, seconds, tanks, id', () => {
  const st = [byAmount('u'), byAmount('g')];
  // more narrowing steps survived: a route that stayed in both bands beats one that dropped at the second
  const full = route('Z', 3600, 1, [1], { u: 100, g: 10 }), half = route('A', 3600, 1, [2], { u: 100, g: 1 });
  assert.deepEqual(RECS.pick([half, full], st, {}).routes.map((x) => x.id), ['Z', 'A']);
  // each used stage's score, in order, highest first (both inside the band of the first stage)
  const hi = route('H', 3600, 1, [1], { u: 100, g: 7 }), lo = route('L', 3600, 1, [2], { u: 97, g: 7 });
  assert.deepEqual(RECS.pick([lo, hi], st, {}).routes.map((x) => x.id), ['H', 'L']);
  const g1 = route('G', 3600, 1, [3], { u: 100, g: 7.1 });
  assert.deepEqual(RECS.pick([hi, g1], st, {}).routes.map((x) => x.id), ['G', 'H'], 'equal first score, the second decides');
  // fewer seconds: equal per voyage (rate off), so quicker first
  const one = [{ key: 'a', objective: 'a', rate: false, amount: () => 5 }];
  const slow = route('A', 7200, 1, [1]), fast = route('B', 3600, 1, [2]);
  assert.deepEqual(RECS.pick([slow, fast], one, {}).routes.map((x) => x.id), ['B', 'A']);
  // fewer tanks
  const tankier = route('A', 3600, 3, [1]), lean = route('B', 3600, 2, [2]);
  assert.deepEqual(RECS.pick([tankier, lean], one, {}).routes.map((x) => x.id), ['B', 'A']);
  // the route's id text ascending; compared as text ("10" before "9")
  const r9 = route('9', 3600, 1, [1]), r10 = route('10', 3600, 1, [2]), ra = route('a', 3600, 1, [3]);
  assert.deepEqual(RECS.pick([ra, r9, r10], one, {}).routes.map((x) => x.id), ['10', '9', 'a']);
  // without an id: the sectors in order
  const p = { route: [2, 1], seconds: 100, tanks: 1 }, q = { route: [1, 2], seconds: 100, tanks: 1 };
  assert.deepEqual(RECS.pick([p, q], one, {}).routes, [q, p]);
  // nothing random: the same answer for any input order
  const set = [hi, lo, g1, full, half];
  const a = RECS.pick(set, st, {}).routes.map((x) => x.id), b = RECS.pick(set.slice().reverse(), st, {}).routes.map((x) => x.id);
  assert.deepEqual(a, b);
});

test('R1: pick, other routes are the next two with other sets of sectors', () => {
  const st = [byAmount('a', true)];
  const plan = route('P', 3600, 1, [1, 2], { a: 100 });
  const sameSet = route('S', 3600, 1, [2, 1], { a: 99 });   // same sectors, other order: not "other"
  const o1 = route('O1', 3600, 1, [3], { a: 98 });
  const dupOfO1 = route('D', 3600, 1, [3], { a: 97 });
  const o2 = route('O2', 3600, 1, [4], { a: 96 });
  const o3 = route('O3', 3600, 1, [5], { a: 95 });
  const r = RECS.pick([o3, dupOfO1, o2, sameSet, o1, plan], st, {});
  assert.equal(r.plan.id, 'P');
  assert.deepEqual(r.others.map((x) => x.id), ['O1', 'O2']);
  assert.deepEqual(RECS.pick([plan, sameSet], st, {}).others, []);
  assert.deepEqual(RECS.pick([plan, o1], st, {}).others.map((x) => x.id), ['O1']);
});

// ---------------------------------------------------------------- R2: route choice in the advisor (spec 4.2 to 4.4, 4.8)
const ADV = (require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'advisor.js')), globalThis.ADVISOR.init(D));
const SHARK = [3, 4, 1, 2];
const sharkObj = { hull: 3, stern: 4, bow: 1, bridge: 2 };
const withRecs = (o) => Object.assign(RECS.defaults(), o);
const ALL = D.sectors.map((s) => s.id);
const PARENT = new Map(Object.entries(D.unlocks).filter(([, u]) => u.by).map(([k, u]) => [+k, u.by]));
const CHILDREN = (id) => [...PARENT].filter(([, by]) => by === id).map(([k]) => k);

test('Submersibles advisor with settings (R2): the worked example of spec 4.8, four routes and both orders, to the second', () => {
  const st = ADV.stats(1, SHARK);
  assert.equal(st.speed, 110); assert.equal(st.range, 70);
  // [route, range used, seconds, tanks, base experience per hour (1 decimal)]
  const table = [[[1], 16, 54250, 1, 704.1], [[2], 22, 57885, 1, 659.9], [[1, 2], 34, 66532, 2, 1148.2], [[2, 1], 40, 70167, 2, 1088.7]];
  for (const [route, range, secs, tanks, xph] of table) {
    const ev = ADV.evalRoute(route, st);
    assert.deepEqual([ev.range, ev.seconds, ev.tanks, Math.round(ev.exp / (ev.seconds / 3600) * 10) / 10], [range, secs, tanks, xph], route.join('>'));
    // the independent reading of the formula agrees
    assert.deepEqual([voyage(route, st.speed).range, voyage(route, st.speed).seconds], [range, secs]);
  }
  const base = { sub: { rank: 1, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2] }, slotsFilled: 1 };
  const run = (o) => ADV.advise(Object.assign({}, base, { recs: withRecs(o) }));
  const routes = (a) => [a.plan].concat(a.alts).map((x) => x.route.join('>'));
  const noFuel = run({}), fuel = run({ fuel: true, giveUp: 15 });
  assert.deepEqual([noFuel.lead, noFuel.step, routes(noFuel)], ['U1', 1, ['2', '1>2']]); // route 1 does not survey B (score 0 for the lead): not offered
  assert.deepEqual(routes(fuel), ['2', '1>2'], 'fuel on: A > B enters the allowance, per tank B wins, same plan');
  assert.equal(fuel.fuel, true); assert.equal(noFuel.fuel, false);
  const lvl = run({ order: ['level', 'unlock', 'gil', 'loot'] }), lvlFuel = run({ order: ['level', 'unlock', 'gil', 'loot'], fuel: true, giveUp: 15 });
  assert.deepEqual([lvl.lead, lvl.plan.route], ['X', [1, 2]]);
  assert.deepEqual(lvlFuel.plan.route, [1, 2], 'B > A enters with fuel on, both 10,610 an hour per tank, A > B stays first on its score');
  assert.equal(lvl.alts.length, 2); assert.ok(lvl.alts.every((x) => x.route.slice().sort().join() !== '1,2'), 'other routes have other sectors');
  // the result keeps today's shape
  for (const a of [noFuel, fuel, lvl]) {
    assert.ok(a.plan.ev.reachable && typeof a.plan.why === 'string' && a.plan.why.length > 0); assert.equal(a.parts, null);
    assert.ok(Array.isArray(a.skipped) && a.skipped.every((s) => s.key && s.objective && s.reason));
  }
});

// An independent reading of 4.4 over every order of 1 to 5 sectors of the pool (no RECS.pick, no ADVISOR search).
function brute(scn) {
  const { rank, found, slots, order, fuel, giveUp } = scn;
  const pool = D.sectors.filter((s) => found.includes(s.id) && s.rank <= rank), speed = stats(rank, sharkObj).speed, rng = stats(rank, sharkObj).range;
  const routes = [];
  (function walk(r) {
    if (r.length >= 5) return;
    for (const s of pool) { if (r.includes(s.id)) continue; const n = r.concat(s.id), v = voyage(n, speed); if (v.range > rng) continue; routes.push({ route: n, seconds: v.seconds, tanks: Math.max(1, n.reduce((t, id) => t + SECTOR.get(id).tanks, 0)), exp: n.reduce((t, id) => t + SECTOR.get(id).exp, 0) }); walk(n); }
  })([]);
  const undiscovered = ALL.filter((id) => !found.includes(id));
  const newOf = (r) => { const seen = new Set(); for (const id of r) for (const c of CHILDREN(id)) if (!found.includes(c)) seen.add(c); return seen.size; };
  let visit = null;
  if (slots < 4) {
    const target = D.subSlots.find((u) => u.slot === slots + 1).sector;
    let cur = target; const chain = [target];
    while (!found.includes(cur) && PARENT.has(cur)) { cur = PARENT.get(cur); chain.unshift(cur); }
    visit = found.includes(target) ? target : found.includes(cur) ? cur : null;
    if (visit && SECTOR.get(visit).rank > rank) visit = null;
  }
  const left = slots < 4 || undiscovered.length > 0, top = rank >= TOP;
  // Gil (D3): estimated merchant gil of the route for this build; when a community route is among the routes in play, only those score
  const bst = stats(rank, sharkObj), commKey = new Set(D.commonRoutes.map((c) => c.route.join(','))), estG = (r) => DROPS.route(D, r.route, bst).gil;
  // owner decision Q4: an app-found route also scores (alone) when its estimate per hour is at least twice that of the best community route in play
  const gilFor = (S) => {
    const isC = (r) => commKey.has(r.route.join(',')), per = (r) => estG(r) / (r.seconds / 3600), comm = S.filter(isC);
    if (!comm.length) return estG;
    const base = Math.max(...comm.map(per)), win = (r) => !isC(r) && per(r) > 0 && per(r) >= 2 * base;
    return S.some(win) ? (r) => (win(r) ? estG(r) : 0) : (r) => (isC(r) ? estG(r) : 0);
  };
  const U1 = (r) => (visit && r.route.includes(visit) ? 1 : 0), U2 = (r) => (undiscovered.length ? newOf(r.route) : 0);
  const single = routes.filter((r) => r.route.length === 1), u1 = single.some((r) => U1(r) > 0), u2 = single.some((r) => U2(r) > 0);
  const U3 = (r) => (left && !top && !u1 && !u2 ? r.exp : 0), X = (r) => (top ? 0 : r.exp);
  const fns = { unlock: [U1, U2, U3].map((f) => () => f), level: [() => X], gil: [gilFor] };
  const stages = order.filter((k) => fns[k]).flatMap((k) => fns[k]);
  let S = routes, lead = false;
  const rec = new Map(routes.map((r) => [r, []]));
  for (const mkFn of stages) {
    const fn = mkFn(S);
    const sc = new Map(S.map((r) => [r, fn(r) / (r.seconds / 3600)]));
    const best = Math.max(...sc.values());
    if (!(best > 0)) continue;
    const band = fuel && !lead ? giveUp / 100 : 0.05;
    S.forEach((r) => rec.get(r).push(sc.get(r)));
    S = S.filter((r) => sc.get(r) >= (1 - band) * best - 1e-9 * best);
    if (fuel && !lead) {
      const e = (r) => fn(r) / r.tanks, bestE = Math.max(...S.map(e));
      S = S.filter((r) => e(r) >= 0.95 * bestE - 1e-9 * bestE);
    }
    lead = true;
  }
  S = S.slice().sort((a, b) => {
    const x = rec.get(a), y = rec.get(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return y[i] - x[i];
    if (a.seconds !== b.seconds) return a.seconds - b.seconds;
    if (a.tanks !== b.tanks) return a.tanks - b.tanks;
    return a.route.join('-') < b.route.join('-') ? -1 : 1;
  });
  return S[0].route;
}
const SCENARIOS = [
  { name: 'rank 1, two found', rank: 1, found: [1, 2], slots: 1, order: ['unlock', 'level', 'gil', 'loot'], fuel: false, giveUp: 15 },
  { name: 'rank 10, seven visitable, Leveling first, fuel', rank: 10, found: [1, 2, 3, 4, 5, 6, 7, 8], slots: 1, order: ['level', 'gil', 'unlock', 'loot'], fuel: true, giveUp: 15 },
  { name: 'rank 14, eight visitable, Gil first, fuel off', rank: 14, found: [1, 2, 3, 4, 5, 6, 7, 8], slots: 1, order: ['gil', 'unlock', 'level', 'loot'], fuel: false, giveUp: 15 },
  { name: 'rank 14, eight visitable, all slots, sectors to find, fuel at 25', rank: 14, found: [1, 2, 3, 4, 5, 6, 7, 8], slots: 4, order: ['gil', 'unlock', 'level', 'loot'], fuel: true, giveUp: 25 },
  { name: 'rank 10, slot 2 held, Gil then Leveling', rank: 10, found: [1, 2, 3, 4, 5, 6, 7], slots: 2, order: ['gil', 'level', 'unlock', 'loot'], fuel: false, giveUp: 15 },
  { name: 'D8: rank 5, A to G found, Gil second', rank: 5, found: [1, 2, 3, 4, 5, 6, 7], slots: 1, order: ['unlock', 'gil', 'level', 'loot'], fuel: false, giveUp: 15 },
  { name: 'rank 14, Unlocking first, fuel at 10', rank: 14, found: [1, 2, 3, 4, 5, 6, 7, 8], slots: 1, order: ['unlock', 'level', 'gil', 'loot'], fuel: true, giveUp: 10 },
  // D3: the Fight Club sectors M, R, O, J, Z found, so five community routes can be run; they score for Gil unless a found route is twice as good (Q4)
  { name: 'D3: rank 60, Fight Club sectors found, Gil first', rank: 60, found: [13, 18, 15, 10, 26], slots: 4, order: ['gil', 'unlock', 'level', 'loot'], fuel: false, giveUp: 15 },
  { name: 'D3: rank 60, Fight Club sectors found, Gil first, fuel at 25', rank: 60, found: [13, 18, 15, 10, 26], slots: 4, order: ['gil', 'unlock', 'level', 'loot'], fuel: true, giveUp: 25 },
  { name: 'D3: rank 60, Leveling first, Gil second', rank: 60, found: [13, 18, 15, 10, 26], slots: 4, order: ['level', 'gil', 'unlock', 'loot'], fuel: false, giveUp: 15 },
];

test('Submersibles advisor with settings (R2): for pools of at most 8 sectors the plan equals a brute-force best under 4.4', () => {
  for (const s of SCENARIOS) {
    const a = ADV.advise({ sub: { rank: s.rank, parts: SHARK }, fc: { unlockedSlots: s.slots, discovered: s.found }, slotsFilled: s.slots, recs: withRecs({ order: s.order, fuel: s.fuel, giveUp: s.giveUp }) });
    assert.deepEqual(a.plan.route, brute(s), s.name);
    assert.ok(a.alts.length <= 2 && a.alts.every((x) => x.route.slice().sort().join() !== a.plan.route.slice().sort().join()), s.name + ': other routes have other sectors');
  }
});

test('Submersibles advisor with settings (R2): D8, levelling towards what is left to unlock when no route can reveal it now', () => {
  const s = SCENARIOS.find((x) => x.name.startsWith('D8'));
  const input = { sub: { rank: s.rank, parts: SHARK }, fc: { unlockedSlots: 1, discovered: s.found }, slotsFilled: 1 };
  const a = ADV.advise(Object.assign({}, input, { recs: withRecs({ order: s.order }) }));
  assert.equal(a.lead, 'U3', 'Unlocking scores experience per hour');
  assert.ok(a.skipped.some((x) => x.key === 'U1') && a.skipped.some((x) => x.key === 'U2'));
  const st = ADV.stats(s.rank, SHARK), xph = (r) => { const e = ADV.evalRoute(r, st); return e.exp / (e.seconds / 3600); };
  const best = Math.max(...[[1], [2], [3], [4], [1, 2], [3, 4], [1, 2, 3, 4], [4, 3, 2, 1]].map(xph));
  assert.ok(xph(a.plan.route) >= 0.95 * best, 'the plan is an experience route');
  assert.ok(a.plan.route.length >= 2);
  // Gil is ranked second and decides only among the routes within 5% of the best experience
  assert.deepEqual(a.plan.route, brute(s));
  // with sector G (7) still unfound, D can reveal it: the premise changes and Unlocking leads by U2
  const f = ADV.advise(Object.assign({}, input, { fc: { unlockedSlots: 1, discovered: [1, 2, 3, 4, 5, 6] }, recs: withRecs({ order: s.order }) }));
  assert.equal(f.lead, 'U2');
});

test('Submersibles advisor with settings (R2): each skip of 4.5 names its cause; loot leads when an item can drop', () => {
  const full = { sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
  const a = ADV.advise(Object.assign({}, full, { recs: RECS.defaults() }));
  const why = Object.fromEntries(a.skipped.map((s) => [s.key, s.reason]));
  assert.equal(why.U1, 'every sector is found'); assert.equal(why.U2, 'every sector is found'); assert.equal(why.U3, 'every sector is found');
  assert.equal(why.X, `this submarine is at rank ${TOP}, the top rank`); assert.equal(why.L, 'no item chosen');
  // loot skipped because no chosen item can drop where this sub can go (rank 1, sectors A and B)
  const items = RECS.items(D);
  const lowDrop = (id) => D.sectors.some((s) => s.rank <= 1 && (D.loot[s.id] || []).includes(id));
  const far = items.find((i) => !lowDrop(i.id)), near = items.find((i) => (D.loot[1] || []).includes(i.id) && !(D.loot[2] || []).includes(i.id));
  const low = { sub: { rank: 1, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2] }, slotsFilled: 1 };
  const b = ADV.advise(Object.assign({}, low, { recs: withRecs({ loot: [[far.id, true], [0, false], [0, false], [0, false], [0, false]] }) }));
  assert.match(b.skipped.find((s) => s.key === 'L').reason, /^none of your chosen items has a recorded drop this submarine can reach now$/);
  // with an item that can drop in A only, Loot first: only routes through A bring it; per hour A alone wins
  const c = ADV.advise(Object.assign({}, low, { recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: [[near.id, true], [0, false], [0, false], [0, false], [0, false]] }) }));
  assert.equal(c.lead, 'L'); assert.deepEqual(c.plan.route, [1]);
  // a sub with a range of nothing: blocked, today's sentence
  const weak = [0, 1, 2, 3].map((sl) => D.parts.filter((p) => p.slot === sl).sort((x, y) => x.range - y.range)[0].id);
  const d = ADV.advise({ sub: { rank: 1, parts: weak }, fc: { unlockedSlots: 1, discovered: [1, 2] }, recs: RECS.defaults() });
  assert.equal(d.blocked, 'No discovered sector is within this build\'s range.');
  // no rank or parts: today's blocked answer, with or without settings
  assert.ok(ADV.advise({ sub: { rank: 5, parts: null }, fc: { unlockedSlots: 1, discovered: [1, 2] }, recs: RECS.defaults() }).blocked);
});

test('Submersibles advisor with settings (R2): without input.recs nothing is counted or added', () => {
  const a = ADV.advise({ sub: { rank: 1, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2] }, slotsFilled: 1 });
  assert.equal(a.lead, undefined); assert.equal(a.skipped, undefined); assert.equal(a.fuel, undefined);
  assert.equal(ADV.advise({ sub: { rank: 1, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2] }, slotsFilled: 1, recs: null }).lead, undefined);
});

test('Submersibles advisor with settings (R2): rank 130, everything found, Leveling first, fuel on: at most 92,000 route evaluations', () => {
  const t0 = Date.now();
  const a = ADV.advise({ sub: { rank: 130, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4, recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'], fuel: true }) });
  assert.ok(ADV.lastEvals > 0 && ADV.lastEvals <= 92000, 'evaluations ' + ADV.lastEvals);
  assert.equal(a.lead, 'X'); assert.ok(a.plan.ev.reachable);
  assert.ok(Date.now() - t0 < 5000, 'a few seconds at most');
});

// ---------------------------------------------------------------- R3: reasons, header, part advice (spec 4.5, 4.7)
const R3_FULL = { sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
const R3_LOW = { sub: { rank: 1, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2] }, slotsFilled: 1 };
const R3_LOGGED = (route, trips, perTrip) => ({ route, trips, perTrip, enough: trips >= 10 });
const R3_ITEMS = RECS.items(D);
const R3_NEAR = R3_ITEMS.find((i) => (D.loot[1] || []).includes(i.id) && !(D.loot[2] || []).includes(i.id));
const R3_LOOT = (id) => [[id, true], [0, false], [0, false], [0, false], [0, false]];

test('Submersibles advisor reasons (R3): the worked example of spec 4.8, to the word', () => {
  const run = (o) => ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs(o) }));
  const b = 'On the way to Deep-sea Site J, which grants slot 2: surveying Deep-sea Site B can reveal Deep-sea Site E.';
  assert.equal(run({}).plan.why, b);
  assert.equal(run({ fuel: true, giveUp: 15 }).plan.why, b + ' Fuel efficiency made no difference here.');
  assert.equal(run({ order: ['level', 'unlock', 'gil', 'loot'] }).plan.why, 'Most experience per hour within reach (at least 1,148 an hour).');
  // other routes never say "most"; a plan that is not the best for the lead states its figure only
  for (const a of [run({}), run({ order: ['level', 'unlock', 'gil', 'loot'] })]) for (const x of a.alts) assert.ok(!/\b[Mm]ost\b/.test(x.why), x.why);
  assert.ok(run({ order: ['level', 'unlock', 'gil', 'loot'] }).alts.every((x) => /^At least [\d,]+ experience an hour\.$/.test(x.why)));
  assert.equal(run({ order: ['level', 'unlock', 'gil', 'loot'], fuel: true, giveUp: 15 }).plan.why, 'Most experience per hour within reach (at least 1,148 an hour). Fuel efficiency made no difference here.');
  // every other route carries its own sentence, as plain text
  for (const a of [run({}), run({ order: ['level', 'unlock', 'gil', 'loot'] })]) for (const x of [a.plan].concat(a.alts)) assert.ok(typeof x.why === 'string' && x.why.length > 0 && !/[<>&]/.test(x.why));
});

test('Submersibles advisor reasons (R3): U2 and U3 wording, and a later stage that narrowed the choice', () => {
  const found8 = D.sectors.filter((s) => s.rank <= 14).map((s) => s.id).slice(0, 8);
  const u2 = ADV.advise({ sub: { rank: 14, parts: SHARK }, fc: { unlockedSlots: 4, discovered: found8 }, slotsFilled: 4, recs: RECS.defaults() });
  assert.equal(u2.lead, 'U2');
  assert.match(u2.plan.why, /^Can reveal \d+ new sectors? \(.+ lead to them\): the most per hour within reach\.$/);
  const d8 = ADV.advise({ sub: { rank: 5, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2, 3, 4, 5, 6, 7] }, slotsFilled: 1, recs: withRecs({ order: ['unlock', 'gil', 'level', 'loot'] }) });
  assert.equal(d8.lead, 'U3');
  assert.match(d8.plan.why, /^Most experience per hour within reach \(at least [\d,]+ an hour\), (levelling to rank \d+ for|building range for) .+ \(step 1: slot 2\)/);
  // Leveling leads, Gil is ranked second and narrows the 5% band: "Then Gil Farming: ..."
  const lvl = ADV.advise({ sub: { rank: 14, parts: SHARK }, fc: { unlockedSlots: 4, discovered: found8 }, slotsFilled: 4, recs: withRecs({ order: ['level', 'gil', 'unlock', 'loot'] }) });
  const thens = lvl.plan.why.match(/Then [^.]*\./g) || [];
  assert.ok(thens.length <= 2);
  for (const t of thens) assert.match(t, /^Then (Gil Farming|Unlocking Routes|Loot Farming): /);
});

test('Submersibles advisor reasons (R3): the fuel sentence compares with the same candidates decided without fuel', () => {
  const found = D.sectors.filter((s) => s.rank <= 5).map((s) => s.id).slice(0, 8);
  const inp = { sub: { rank: 5, parts: SHARK }, fc: { unlockedSlots: 4, discovered: found }, slotsFilled: 4 };
  const order = ['level', 'gil', 'unlock', 'loot'];
  const on = ADV.advise(Object.assign({}, inp, { recs: withRecs({ order, fuel: true, giveUp: 10 }) }));
  const off = ADV.advise(Object.assign({}, inp, { recs: withRecs({ order, fuel: false, giveUp: 10 }) }));
  const m = on.plan.why.match(/Fuel efficiency: (\d+) tanks? instead of (\d+), for (\d+)% less experience per hour\.$/);
  assert.ok(m, on.plan.why);
  const rate = (x) => x.ev.exp / (x.ev.seconds / 3600);
  assert.equal(+m[1], on.plan.ev.tanks); assert.equal(+m[2], off.plan.ev.tanks); assert.ok(+m[1] < +m[2]);
  assert.equal(+m[3], Math.round((1 - rate(on.plan) / rate(off.plan)) * 100));
  assert.ok(ADV.lastEvals > 0);
  // no fuel sentence without fuel
  assert.ok(!/Fuel efficiency/.test(off.plan.why));
  // fuel on over a sea of more than 8 sectors: the comparison reuses the candidates, it makes no further route evaluation
  const big = { sub: { rank: 130, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4, recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'], fuel: true }) };
  const a = ADV.advise(big); const evalsOn = ADV.lastEvals;
  assert.ok(evalsOn <= 92000 && /Fuel efficiency/.test(a.plan.why));
});

test('Submersibles advisor reasons (R3): skipped objectives above the lead are named with their cause, those below are not', () => {
  const a = ADV.advise(Object.assign({}, R3_FULL, { recs: withRecs({ fuel: true }) }));
  assert.equal(a.lead, 'G');
  assert.match(a.plan.why, /Skipped Unlocking Routes: every sector is found\./);
  assert.match(a.plan.why, new RegExp('Skipped Leveling Submersible Rank: this submarine is at rank ' + TOP + ', the top rank\\.'));
  assert.ok(!/Loot Farming/.test(a.plan.why), 'no item chosen is said in Setup only');
  // Gil ranked first: nothing above it, so nothing named
  const g = ADV.advise(Object.assign({}, R3_FULL, { recs: withRecs({ fuel: true, order: ['gil', 'unlock', 'level', 'loot'] }) }));
  assert.ok(!/Skipped/.test(g.plan.why));
  // a chosen item that cannot drop where this sub can go: named, with the 4.5 sentence
  const far = R3_ITEMS.find((i) => !D.sectors.some((s) => s.rank <= 1 && (D.loot[s.id] || []).includes(i.id)));
  const l = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(far.id) }) }));
  assert.equal(l.lead, 'U1');
  assert.match(l.plan.why, /Skipped Loot Farming: none of your chosen items has a recorded drop this submarine can reach now\./);
  // the 4.5 causes sit in the skipped list too
  const why = Object.fromEntries(a.skipped.map((s) => [s.key, s.reason]));
  assert.equal(why.U1, 'every sector is found'); assert.equal(why.X, `this submarine is at rank ${TOP}, the top rank`); assert.equal(why.L, 'no item chosen');
});

test('Submersibles advisor header (R3): each case of spec 4.7', () => {
  const run = (inp, o) => ADV.advise(Object.assign({}, inp, { recs: withRecs(o) }));
  const found8 = D.sectors.filter((s) => s.rank <= 14).map((s) => s.id).slice(0, 8);
  const STEP1 = 'Suggested · step 1 of 3: Unlock all four submarines';
  assert.equal(run(R3_LOW, {}).head, STEP1); assert.equal(run(R3_LOW, {}).label, 'Unlocking Routes');
  assert.equal(run({ sub: { rank: 5, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2, 3, 4, 5, 6, 7] }, slotsFilled: 1 }, { order: ['unlock', 'gil', 'level', 'loot'] }).head, STEP1); // U3
  assert.equal(run({ sub: { rank: 14, parts: SHARK }, fc: { unlockedSlots: 4, discovered: found8 }, slotsFilled: 4 }, {}).head, 'Suggested · step 2 of 3: Discover every sector'); // U2
  assert.equal(run(R3_LOW, { order: ['level', 'unlock', 'gil', 'loot'] }).head, 'Suggested · Leveling Submersible Rank');
  assert.equal(run(R3_LOW, { order: ['gil', 'unlock', 'level', 'loot'] }).head, 'Suggested · Gil Farming'); // Gil leads before step 3
  assert.equal(run(R3_LOW, { order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(R3_NEAR.id) }).head, 'Suggested · Loot Farming');
  assert.equal(run(R3_FULL, { fuel: true }).head, 'Suggested · step 3 of 3: Farm gil'); // Gil at step 3, fuel path
  assert.equal(run(R3_FULL, {}).head, 'Suggested · step 3 of 3: Farm gil'); // Gil at step 3, today's answer unchanged
  assert.equal(run(Object.assign({}, R3_FULL, { sub: { rank: 130, parts: [31, 24, 25, 34] } }), { order: ['level', 'unlock', 'gil', 'loot'] }).head, 'Suggested · Leveling Submersible Rank'); // Leveling at step 3
  // the plain no-settings answer has no header field
  assert.equal(ADV.advise(R3_LOW).head, undefined);
});

test('Submersibles advisor part advice (R3): none before step 3; a gil tip only beside a gil plan', () => {
  const logged = [R3_LOGGED([1, 2], 14, 412000), R3_LOGGED([3, 4], 12, 300000)];
  for (const o of [{}, { order: ['level', 'unlock', 'gil', 'loot'] }, { fuel: true }, { order: ['gil', 'unlock', 'level', 'loot'] }]) {
    assert.equal(ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs(o) })).parts, null, 'step 1');
    assert.equal(ADV.advise({ sub: { rank: 14, parts: SHARK }, fc: { unlockedSlots: 4, discovered: [1, 2, 3, 4, 5, 6, 7, 8] }, slotsFilled: 4, recs: withRecs(o) }).parts, null, 'step 2');
  }
  const shark145 = Object.assign({}, R3_FULL, { sub: { rank: 145, parts: SHARK }, logged, enough: 10 });
  const g = ADV.advise(Object.assign({}, shark145, { recs: RECS.defaults() }));
  // D6: with Gil leading the tip is valued by the community estimate (it no longer refuses swaps that lower a stat); without settings it is today's S6 tip
  assert.equal(g.lead, 'G'); assert.ok(g.parts && g.parts.gilGain > 0 && g.parts.estimate === true, 'with Gil leading the tip is an estimate');
  assert.match(g.parts.why, /estimate from community drop records/);
  const today = ADV.advise(shark145).parts;
  assert.ok(today && today.gilGain > 0 && today.estimate === undefined && /calculated from your own log/.test(today.why), 'no settings: today\'s tip');
  // a non-gil lead at step 3: no part advice at all (gaps spec G6; before, the minutes-only tip "N min sooner (calculated)" stood beside a Leveling plan)
  for (const rank of [30, 60, 130]) {
    const x = ADV.advise(Object.assign({}, shark145, { sub: { rank, parts: SHARK }, recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'] }) }));
    assert.equal(x.step, 3); assert.equal(x.lead, 'X');
    assert.equal(x.parts, null, 'rank ' + rank);
  }
  // D5: Loot leads only for an item with a drop record this sub can reach; the first such item is chosen here
  const lootAt30 = (id) => ADV.advise(Object.assign({}, shark145, { sub: { rank: 30, parts: SHARK }, recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(id) }) }));
  const l = R3_ITEMS.map((i) => lootAt30(i.id)).find((x) => x.lead === 'L');
  assert.ok(l && l.step === 3 && l.parts === null, 'Loot Farming: no loot-valued tip exists, so none (G6)');
});

test('Submersibles advisor reasons (R3, D5): a loot reason gives expected quantities per hour, names its source and promises nothing', () => {
  const a = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(R3_NEAR.id) }) }));
  assert.equal(a.lead, 'L');
  const head = new RegExp('^Expected: about [\\d.]+ ' + R3_NEAR.name + ' an hour \\(estimate from community drop records, at least [\\d,.]+( million)? surveys per sector\\)\\.');
  assert.match(a.plan.why, head, a.plan.why);
  assert.ok(!/will drop|guarantee|always|drop odds are not known|possible items only/i.test(a.plan.why));
  for (const x of a.alts) assert.match(x.why, /^Expected: about /);
  // a loot plan on a later stage carries its figure and the source
  const later = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({ order: ['level', 'loot', 'unlock', 'gil'], loot: R3_LOOT(R3_NEAR.id) }) }));
  if (/Then Loot Farming/.test(later.plan.why)) assert.match(later.plan.why, /Then Loot Farming: about [\d.]+ .+ an hour \(estimate from community drop records\)/);
});

test('Submersibles advisor blocked answer (R3): with settings it carries today\'s step, step name and sentence', () => {
  const weak = [0, 1, 2, 3].map((sl) => D.parts.filter((p) => p.slot === sl).sort((x, y) => x.range - y.range)[0].id);
  const cases = [
    { sub: { rank: 1, parts: weak }, fc: { unlockedSlots: 1, discovered: [1, 2] } },
    { sub: { rank: 1, parts: weak }, fc: { unlockedSlots: 4, discovered: [1, 2] } },
    { sub: { rank: 1, parts: weak }, fc: { unlockedSlots: 4, discovered: ALL } },
    { sub: { rank: 20, parts: weak }, fc: { unlockedSlots: 2, discovered: [1, 2, 3, 4, 5] }, slotsFilled: 1 },
  ];
  for (const c of cases) for (const o of [{}, { fuel: true }, { order: ['gil', 'loot', 'level', 'unlock'] }]) {
    const today = ADV.advise(c), now = ADV.advise(Object.assign({}, c, { recs: withRecs(o) }));
    if (!today.blocked) continue;
    assert.equal(now.blocked, today.blocked); assert.equal(now.step, today.step); assert.equal(now.stepName, today.stepName);
    assert.equal(now.lead, null); assert.deepEqual(now.skipped, []);
  }
  assert.ok(cases.some((c) => ADV.advise(c).blocked), 'at least one case is blocked today');
  const t = ADV.advise(cases[0]);
  assert.deepEqual([t.step, t.stepName], [3, 'Farm gil']);
});

// ---------------------------------------------------------------- review fixes: stored fields, true reasons, other routes
// What a page writes (RECS.store) and what the merges do with it, through the real merge code: the cloud merge (merge.js,
// the "which one is right?" prompt) and the page-to-page merge of CC.writeSection.
function recsFixture() {
  for (const f of ['save', 'model', 'codec', 'merge']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
  globalThis.CC.resetMemory();
  return { CC: globalThis.CC, ET: globalThis.ET, NAME: 'submersibles-recommendations' };
}
// one page's change: normalise, store only the fields already stored plus the changed one
function recsEdit(raw, mut) {
  const was = RECS.check(raw, D), c = JSON.parse(JSON.stringify(was));
  mut(c);
  return RECS.store(raw, RECS.intent(was, c));
}
const OTHER_ORDER = ['gil', 'unlock', 'level', 'loot'];

test('Review fix 1: check of the defaults is the defaults, so a first write from defaults sees no change in loot', () => {
  assert.deepEqual(RECS.check({ choices: RECS.defaults() }, D), RECS.defaults());
  assert.deepEqual(RECS.intent(RECS.check(null, D), RECS.defaults()), {});
});

test('Review fix 2: a write stores only the stored fields and the changed ones', () => {
  const a = recsEdit(null, (c) => { c.order = OTHER_ORDER.slice(); });
  assert.deepEqual(Object.keys(a.choices), ['order']);
  const b = recsEdit(a, (c) => { c.fuel = true; });
  assert.deepEqual(Object.keys(b.choices).sort(), ['fuel', 'order'], 'the stored one stays, the changed one is added');
  assert.deepEqual(RECS.intent(RECS.defaults(), Object.assign(RECS.defaults(), { loot: [[0, true], [5, true], [0, false], [0, false], [0, false]] })), { loot2: 5, use2: true }, 'the item and the switch of one picker are two keys');
  assert.deepEqual(RECS.intent(RECS.defaults(), Object.assign(RECS.defaults(), { loot: [[7, true], [0, false], [0, false], [0, false], [0, false]] })), { loot1: 7 }, 'picker 1 has no switch key');
  assert.deepEqual(RECS.check(b, D), Object.assign(RECS.defaults(), { fuel: true, order: OTHER_ORDER }), 'check fills in the rest');
  assert.deepEqual(recsEdit(null, (c) => { c.giveUp = 35; }).choices, { giveUp: 35 });
  assert.deepEqual(RECS.store({ choices: { giveUp: 'x', order: ['a'] } }, {}).choices, { giveUp: 'x', order: ['a'] }, 'an unchanged stored field is kept exactly as stored');
});

test('Review fix 2a: no section at the last sync, one device changes the order and the other the fuel switch: both kept, no clash', () => {
  const { CC, ET, NAME } = recsFixture();
  const doc = (sec) => ({ modules: sec ? { [NAME]: sec } : {} });
  const base = doc(null);
  const A = doc(recsEdit(null, (c) => { c.order = OTHER_ORDER.slice(); }));
  const B = doc(recsEdit(null, (c) => { c.fuel = true; }));
  const res = ET.threeWay(base, A, B);
  assert.deepEqual(res.conflicts, [], JSON.stringify(res.conflicts));
  const merged = CC.unflatModules(res.merged)[NAME];
  assert.deepEqual(RECS.check(merged, D), Object.assign(RECS.defaults(), { fuel: true, order: OTHER_ORDER }));
  // the other way round, too
  assert.deepEqual(ET.threeWay(base, B, A).conflicts, []);
  // the old write (all four fields) made this a clash
  const whole = (mut) => { const c = RECS.defaults(); mut(c); return { choices: c }; };
  const old = ET.threeWay(base, doc(whole((c) => { c.order = OTHER_ORDER.slice(); })), doc(whole((c) => { c.fuel = true; })));
  assert.ok(old.conflicts.length > 0, 'the old whole-choices write raised a prompt although nothing clashed');
  delete globalThis.localStorage; CC.resetMemory();
});

test('Review fix 2b: two pages on one device, the stale page\'s first write keeps the other page\'s change to a different field', async () => {
  const { CC, NAME } = recsFixture();
  const r0 = await CC.read();
  // both pages read the save with no section
  const first = recsEdit(null, (c) => { c.order = OTHER_ORDER.slice(); });
  await CC.writeSection(NAME, first, { rev: r0.rev, base: null });
  const second = recsEdit(null, (c) => { c.fuel = true; }); // the stale page: it never saw the order change
  const w = await CC.writeSection(NAME, second, { rev: r0.rev, base: null });
  assert.equal(w.merged, true);
  const stored = CC.checkDoc((await CC.read()).raw).modules[NAME];
  assert.deepEqual(RECS.check(stored, D), Object.assign(RECS.defaults(), { fuel: true, order: OTHER_ORDER }));
  // a page that read a stored section writes with it as its base, and a change to a third field joins the other two
  const third = recsEdit(stored, (c) => { c.giveUp = 30; });
  await CC.writeSection(NAME, third, { rev: w.rev, base: stored });
  assert.deepEqual(RECS.check(CC.checkDoc((await CC.read()).raw).modules[NAME], D), Object.assign(RECS.defaults(), { fuel: true, order: OTHER_ORDER, giveUp: 30 }));
  delete globalThis.localStorage; CC.resetMemory();
});

test('Review fix 2c: the same field changed differently on both devices still raises the choice', () => {
  const { CC, ET, NAME } = recsFixture();
  const doc = (sec) => ({ modules: { [NAME]: sec } });
  const base = recsEdit(null, (c) => { c.order = ['level', 'unlock', 'gil', 'loot']; });
  const A = recsEdit(base, (c) => { c.order = OTHER_ORDER.slice(); }), B = recsEdit(base, (c) => { c.order = ['loot', 'gil', 'level', 'unlock']; });
  const res = ET.threeWay(doc(base), doc(A), doc(B));
  assert.deepEqual(res.conflicts.map((c) => c.id), ['m|' + JSON.stringify([NAME, 'choices', 'order'])]);
  // and the same field with no section at the last sync
  const res2 = ET.threeWay({ modules: {} }, doc(A), doc(B));
  assert.deepEqual(res2.conflicts.map((c) => c.id), ['m|' + JSON.stringify([NAME, 'choices', 'order'])]);
  delete globalThis.localStorage; CC.resetMemory();
});

test('Review fix 3: "most" only for the route with the best lead score; other routes and weaker plans state a figure', () => {
  // fuel gives up some experience: the plan is not the best for the lead, so it never says "most"
  const found = D.sectors.filter((s) => s.rank <= 5).map((s) => s.id).slice(0, 4);
  const inp = { sub: { rank: 5, parts: SHARK }, fc: { unlockedSlots: 1, discovered: found }, slotsFilled: 1 };
  const f = ADV.advise(Object.assign({}, inp, { recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'], fuel: true, giveUp: 10 }) }));
  assert.match(f.plan.why, /^At least [\d,]+ experience an hour\. Fuel efficiency: \d+ tanks? instead of \d+, for \d+% less experience per hour\.$/);
  assert.ok(!/most/i.test(f.plan.why));
  const noFuel = ADV.advise(Object.assign({}, inp, { recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'] }) }));
  assert.match(noFuel.plan.why, /^At least [\d,]+ experience an hour\. Then Unlocking Routes: /, 'Unlocking, ranked second, chose a route that is not the quickest for experience');
  for (const a of [f, noFuel]) for (const x of a.alts) assert.ok(!/most/i.test(x.why), x.why);
  // unlocking: other routes say what they can reveal, without "most"
  const found8 = D.sectors.filter((s) => s.rank <= 14).map((s) => s.id).slice(0, 8);
  const u2 = ADV.advise({ sub: { rank: 14, parts: SHARK }, fc: { unlockedSlots: 4, discovered: found8 }, slotsFilled: 4, recs: RECS.defaults() });
  for (const x of u2.alts) assert.match(x.why, /^Can reveal \d+ new sectors? \(.+ lead to them\)\.$/);
});

test('Review fix 3 (D5): the Loot follow-on gives the expected quantity an hour and its source in plain words', () => {
  const found = D.sectors.filter((s) => s.rank <= 5).map((s) => s.id).slice(0, 4);
  const a = ADV.advise({ sub: { rank: 5, parts: SHARK }, fc: { unlockedSlots: 4, discovered: found }, slotsFilled: 4, recs: withRecs({ order: ['level', 'loot', 'unlock', 'gil'], loot: R3_LOOT(12586) }) });
  assert.match(a.plan.why, / Then Loot Farming: about [\d.]+ .+ an hour \(estimate from community drop records\)\.$/, a.plan.why);
  assert.ok(!/sector and item chances|possible items only|drop odds are not known/.test(a.plan.why));
});

test('Review fix 6a: no other route scores 0 for the lead', () => {
  for (const o of [{}, { order: ['level', 'unlock', 'gil', 'loot'] }, { order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(R3_NEAR.id) }]) {
    const a = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs(o) }));
    assert.ok(a.alts.every((x) => x.route.length > 0));
    if (a.lead === 'U1') assert.ok(a.alts.every((x) => x.route.includes(2)), 'every other route surveys the sector on the way');
    if (a.lead === 'L') assert.ok(a.alts.every((x) => x.route.some((id) => (D.loot[id] || []).includes(R3_NEAR.id))));
  }
});

test('Review fix 6b: a stage that the 5% band emptied does not claim no sector can serve it', () => {
  const found = D.sectors.filter((s) => s.rank <= 5).map((s) => s.id).slice(0, 4);
  const a = ADV.advise({ sub: { rank: 5, parts: SHARK }, fc: { unlockedSlots: 1, discovered: found }, slotsFilled: 1, recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'], fuel: true, giveUp: 10 }) });
  assert.equal(a.lead, 'X');
  assert.equal(a.skipped.find((x) => x.key === 'U1').reason, 'no route within 5% of the best for the priorities above serves it');
  // a stage with nothing to give anywhere keeps its own reason
  const top = ADV.advise(Object.assign({}, R3_FULL, { recs: RECS.defaults() }));
  assert.equal(top.skipped.find((x) => x.key === 'U1').reason, 'every sector is found');
});

// ---------------------------------------------------------------- R4: the tuning tool and the shipped defaults
// tools/recs-tune.js builds the test fleet from the data only and applies the rule of spec 4.6; the tuning document is its text.
const TUNE = require(path.join(__dirname, '..', 'tools', 'recs-tune.js'));
const TUNE_DOC = path.join(__dirname, '..', '..', 'docs', 'submersibles-recommendations-tuning.md');
const TUNE_FPR = path.join(__dirname, '..', '..', 'docs', 'submersibles-recommendations-tuning.fingerprint.json');
// The routine run stays cheap: it checks the committed document against its own fingerprint and the constants, and re-runs a small
// fixed sample. The full re-derivation (about a minute) is `npm run test:tuning` (node tracker/tools/recs-tune.js --check); run it
// after any change to advisor.js, recs.js, drops.js or the data.
const tuneDoc = () => fs.readFileSync(TUNE_DOC, 'utf8');
const tuneFpr = () => JSON.parse(fs.readFileSync(TUNE_FPR, 'utf8'));
test('R4: the tuning document carries a fingerprint that matches its own tables and the fingerprint file', () => {
  const doc = tuneDoc(), lines = doc.split('\n');
  const m = /```json\n([\s\S]*?)\n```/.exec(doc);
  assert.ok(m, 'the document holds a fingerprint block');
  const fp = JSON.parse(m[1]);
  assert.deepEqual(fp, tuneFpr(), 'the fingerprint file equals the block in the document');
  assert.equal(fp.tablesSha256, TUNE.tablesHash(lines), 'the table rows match their hash: run node tracker/tools/recs-tune.js --write');
  assert.ok(fp.measured >= 20 && fp.scenarios >= fp.measured, 'scenarios measured: ' + fp.measured + ' of ' + fp.scenarios);
  assert.ok(lines.some((l) => /^\| 145 \|/.test(l)), 'rank 145 is in the fleet');
  assert.ok(doc.includes('| Rank | Classes | Levelling lead | Unlocking lead | Gil lead |'));
  assert.equal(fp.band, Math.round(RECS.BAND * 100));
  assert.equal(fp.bandAccepted, true, 'the 5% band is accepted by the document');
});
// the default is the owner's choice and the rule no longer gives it over the whole fleet (spec D8); these cannot rot: they compare
// the constant with the tool's named constant, the document's own gil-only result and its own statement.
test('R4: RECS.GIVE_UP is the owner-chosen default of the tool, which the document states', () => {
  assert.equal(TUNE.OWNER_DEFAULT, 15);
  assert.equal(RECS.GIVE_UP, TUNE.OWNER_DEFAULT);
  assert.ok(RECS.GIVE_UP > RECS.BAND * 100 && RECS.GIVE_UP < RECS.GIVE_MAX, 'above the band and short of the top of the range');
  const fp = tuneFpr(), gil = fp.ruleParts.find((x) => /^gil only/.test(x.name));
  assert.ok(gil, 'the document has the gil-only part');
  assert.equal(gil.result, 15, 'the rule on the gil-only scenarios gives 15%');
  assert.equal(fp.ownerDefault, RECS.GIVE_UP);
  const doc = tuneDoc();
  assert.ok(doc.includes("The default allowance is the owner's choice: 15%."), 'the document says the default is the owner\'s choice');
  assert.ok(doc.includes('no longer the output of the rule over the whole fleet'));
});
test('R4: the rule re-run on a small fixed sample gives the rows the document holds', () => {
  const doc = tuneDoc(), lines = doc.split('\n');
  const from = lines.indexOf('## A fixed sample, re-run by the routine unit test'), to = lines.indexOf('## Fingerprint');
  assert.ok(from > 0 && to > from);
  const rows = lines.slice(from, to).filter((l) => l.startsWith('|'));
  const got = TUNE.sample();
  assert.ok(got.length > 10, 'sample rows: ' + got.length);
  assert.deepEqual(got, rows);
});

// ---------------------------------------------------------------- second review round
const BIG = 999999999; // an item id this build's data does not know (a newer data release on another device)

test('Round 2, fix 2: a write replaces only what the player changed and keeps everything else exactly as stored', () => {
  const [a, b] = RECS.items(D);
  const raw = { future: 1, choices: { fuel: false, loot1: a.id, loot2: BIG, use2: true, order: ['unlock', 'level', 'gil', 'loot', 'extra'], newer: { x: 1 }, loot: [[1, true]] } };
  const keep = JSON.stringify(raw);
  const fuel = recsEdit(raw, (c) => { c.fuel = true; });
  assert.equal(JSON.stringify(raw), keep, 'the input is not touched');
  assert.equal(fuel.choices.fuel, true);
  assert.equal(fuel.choices.loot2, BIG, 'the unknown item id stays through a fuel change');
  assert.deepEqual(fuel.choices.order, raw.choices.order, 'an order with an unknown extra key stays through a fuel change');
  assert.equal(fuel.future, 1); assert.deepEqual(fuel.choices.newer, { x: 1 }, 'unknown field and unknown sibling of choices stay');
  assert.deepEqual(fuel.choices.loot, [[1, true]], 'an old loot array stays as stored');
  // picker 3 changed: only its keys change; picker 2 keeps the unknown id
  const p3 = recsEdit(raw, (c) => { c.loot[2] = [b.id, true]; });
  assert.deepEqual([p3.choices.loot1, p3.choices.loot2, p3.choices.loot3, p3.choices.use3], [a.id, BIG, b.id, true]);
  // picker 1 changed: the others stay, including the unknown id
  const p1 = recsEdit(raw, (c) => { c.loot[0] = [b.id, true]; });
  assert.deepEqual([p1.choices.loot1, p1.choices.loot2, p1.choices.use2], [b.id, BIG, true]);
  assert.ok(!('use1' in p1.choices), 'use1 is never written');
  // the unknown-id picker itself switched off: its id is kept, only the switch changes
  const off = recsEdit(raw, (c) => { c.loot[1][1] = false; });
  assert.deepEqual([off.choices.loot2, off.choices.use2], [BIG, false]);
  for (const out of [fuel, p3, p1, off]) { assert.equal(out.future, 1); assert.deepEqual(out.choices.newer, { x: 1 }); assert.deepEqual(out.choices.loot, [[1, true]]); }
});

test('Round 2, fix 4: a switched-off picker blocks nothing and is not judged as a duplicate', () => {
  const [a, b] = RECS.items(D);
  assert.deepEqual(RECS.check({ choices: { loot2: a.id, loot3: a.id, use3: true } }, D).loot, [[0, true], [a.id, false], [a.id, true], [0, false], [0, false]], 'a later switched-on picker keeps the item an off picker holds');
  assert.deepEqual(RECS.check({ choices: { loot1: a.id, loot2: b.id, loot3: a.id } }, D).loot, [[a.id, true], [b.id, false], [a.id, false], [0, false], [0, false]], 'off pickers keep their choice, even equal ones');
  assert.deepEqual(RECS.check({ choices: { loot1: a.id, loot2: a.id, use2: true } }, D).loot[1], [0, true], 'two switched-on: the earlier wins');
  assert.deepEqual(RECS.active({ loot: [[0, true], [a.id, false], [a.id, true]] }), [a.id]);
  // switching on the picker that holds a used item: stored as on, read as a duplicate (none)
  const sw = recsEdit({ choices: { loot1: a.id, loot2: a.id } }, (c) => { c.loot[1][1] = true; });
  assert.deepEqual([sw.choices.loot2, sw.choices.use2], [a.id, true], 'the stored item is kept');
  assert.deepEqual(RECS.check(sw, D).loot[1], [0, true]);
});

test('Round 2, fix 3: an item held by an unrelated duplicate picker can be cleared by writing 0', () => {
  const [a] = RECS.items(D);
  const raw = { choices: { loot1: a.id, loot2: a.id, use2: true } };
  const was = RECS.check(raw, D); // [a,true],[0,true]
  const c = JSON.parse(JSON.stringify(was)); // the player picks "none": nothing differs ...
  assert.deepEqual(RECS.intent(was, c), {});
  assert.equal(RECS.held(raw, 1), a.id);
  // ... so the page forces picker 2 as changed
  const out = RECS.store(raw, { loot2: 0 });
  assert.deepEqual([out.choices.loot2, out.choices.use2], [0, true]);
  assert.equal(RECS.held(out, 1), 0);
});

// ---------------------------------------------------------------- R8: one merge unit per control (spec section 10)
const ALLKEYS = ['fuel', 'giveUp', 'order', 'loot1', 'loot2', 'loot3', 'loot4', 'loot5', 'use2', 'use3', 'use4', 'use5'];
test('K1: every key of the stored shape is its own merge unit, and the section survives the shared save code', async () => {
  const { CC, NAME } = recsFixture();
  const choices = { fuel: true, giveUp: 20, order: ['gil', 'unlock', 'level', 'loot'], loot1: 5665, loot2: 5666, loot3: 0, loot4: 999999999, loot5: 5667, use2: true, use3: false, use4: true, use5: false };
  assert.deepEqual(Object.keys(choices), ALLKEYS);
  const sec = { choices };
  const flat = CC.flatModules({ [NAME]: sec });
  assert.deepEqual([...flat.keys()].sort(), ALLKEYS.map((k) => 'm|' + JSON.stringify([NAME, 'choices', k])).sort(), 'exactly one unit per key');
  const doc = { app: CC.APP, v: CC.VERSION, updated: 1, chars: [], modules: { [NAME]: sec }, device: {}, moved: {} };
  assert.deepStrictEqual(CC.checkDoc(doc).modules[NAME], sec, 'checkDoc keeps it');
  const first = await CC.writeSection(NAME, sec, { rev: (await CC.read()).rev, base: null });
  await CC.writeSection('lists', { lists: { l1: { name: 'Gear', items: {} } } }, { rev: first.rev, base: null });
  assert.deepStrictEqual(CC.checkDoc((await CC.read()).raw).modules[NAME], sec, 'another module\'s write leaves it');
  const other = { lists: { lists: { l2: { name: 'Food', items: {} } } } };
  assert.deepStrictEqual(CC.mergeModules({ [NAME]: sec }, Object.assign({ [NAME]: sec }, other), { [NAME]: sec })[NAME], sec, 'a merge keeps it');
  delete globalThis.localStorage; CC.resetMemory();
});

// A "page": the shipped keeper on the real save code, loaded with CC.read() and read(); changes go through RECS.intent and change.
const stampOf = async (CC) => (await CC.read()).rev;
async function openPage(CC, NAME, wrap) {
  const results = [];
  const k = RECS.keeper((s, known) => (wrap || ((w) => w()))(() => CC.writeSection(NAME, s, known)), (r) => results.push(r));
  const r = await CC.read();
  const doc = r.raw == null ? CC.emptyDoc() : CC.checkDoc(r.raw);
  k.read(doc.modules[NAME], r.rev);
  return { k, results, edit: (mut) => { const was = RECS.check(k.raw, D), c = JSON.parse(JSON.stringify(was)); mut(c); return k.change(RECS.intent(was, c)); } };
}
const savedChoices = async (CC, NAME) => { const m = CC.checkDoc((await CC.read()).raw).modules[NAME]; return m ? m.choices : null; };
const pairsOf = async (CC, NAME) => RECS.check({ choices: await savedChoices(CC, NAME) }, D).loot;

test('K2: the defect: a stale page switching picker 2 on and picking keeps the item another page chose in picker 1', async () => {
  const [x, y] = RECS.items(D);
  for (const seeded of [true, false]) {
    const { CC, NAME } = recsFixture();
    if (seeded) await CC.writeSection(NAME, { choices: { fuel: false } }, { rev: await stampOf(CC), base: null });
    const A = await openPage(CC, NAME), B = await openPage(CC, NAME);
    await A.edit((c) => { c.loot[0][0] = x.id; });
    await B.edit((c) => { c.loot[1][1] = true; });
    await B.edit((c) => { c.loot[1][0] = y.id; });
    assert.deepEqual(await pairsOf(CC, NAME), [[x.id, true], [y.id, true], [0, false], [0, false], [0, false]], seeded ? 'section stored before both loaded' : 'no section');
    assert.deepEqual(RECS.check(B.k.raw, D).loot[0], [x.id, true], 'the stale page now holds the other page\'s item');
    assert.ok([...A.results, ...B.results].every((r) => r.ok));
    delete globalThis.localStorage; CC.resetMemory();
  }
});

test('K3: unknown keys and item ids survive a stale page\'s change to picker 2', async () => {
  const [, y] = RECS.items(D);
  const { CC, NAME } = recsFixture();
  await CC.writeSection(NAME, { future: 1, choices: { loot3: BIG, mystery: { a: 1 }, loot: [[3, true]] } }, { rev: await stampOf(CC), base: null });
  const B = await openPage(CC, NAME);
  const other = await openPage(CC, NAME); // another save after B loaded writes an unknown loot4
  await CC.writeSection(NAME, { future: 1, choices: { loot3: BIG, mystery: { a: 1 }, loot: [[3, true]], loot4: BIG + 1 } }, { rev: other.k.rev, base: other.k.base });
  await B.edit((c) => { c.loot[1][0] = y.id; });
  const ch = await savedChoices(CC, NAME);
  assert.equal(ch.loot2, y.id);
  assert.deepEqual([ch.loot3, ch.loot4, ch.mystery, ch.loot], [BIG, BIG + 1, { a: 1 }, [[3, true]]]);
  assert.equal(CC.checkDoc((await CC.read()).raw).modules[NAME].future, 1);
  delete globalThis.localStorage; CC.resetMemory();
});

test('K4: A picks an item for picker 2, stale B switches picker 2 off: the item is A\'s and the switch is off', async () => {
  const [x] = RECS.items(D);
  const { CC, NAME } = recsFixture();
  await CC.writeSection(NAME, { choices: { use2: true } }, { rev: await stampOf(CC), base: null });
  const A = await openPage(CC, NAME), B = await openPage(CC, NAME);
  await A.edit((c) => { c.loot[1][0] = x.id; });
  await B.edit((c) => { c.loot[1][1] = false; });
  const ch = await savedChoices(CC, NAME);
  assert.deepEqual([ch.loot2, ch.use2], [x.id, false]);
  delete globalThis.localStorage; CC.resetMemory();
});

test('K5: two changes without waiting make one write; a change made during a write is put on top of another page\'s write', async () => {
  const [x, y, z] = RECS.items(D);
  const { CC, NAME } = recsFixture();
  let writes = 0;
  const P = await openPage(CC, NAME, (w) => { writes++; return w(); });
  const p1 = P.edit((c) => { c.fuel = true; }), p2 = P.edit((c) => { c.giveUp = 30; });
  await Promise.all([p1, p2]);
  assert.equal(writes, 1, 'one write carried both');
  assert.deepEqual((({ fuel, giveUp }) => ({ fuel, giveUp }))(await savedChoices(CC, NAME)), { fuel: true, giveUp: 30 });
  // a second change while the first write is in progress, with another page's write landing in between
  const other = await openPage(CC, NAME);
  let first = true, mid = null;
  const Q = await openPage(CC, NAME, (w) => {
    if (!first) return w();
    first = false;
    // inside the write: Q makes its second change, and the other page's write lands
    mid = Q.edit((c) => { c.order = ['gil', 'unlock', 'level', 'loot']; });
    return other.edit((c) => { c.loot[0][0] = x.id; }).then(w);
  });
  const q1 = Q.edit((c) => { c.loot[1][0] = y.id; c.loot[1][1] = true; });
  await q1; await mid; // mid is set while the first write runs
  const ch = await savedChoices(CC, NAME);
  assert.deepEqual([ch.loot1, ch.loot2, ch.use2, ch.order, ch.fuel, ch.giveUp], [x.id, y.id, true, ['gil', 'unlock', 'level', 'loot'], true, 30], 'all three changes stored');
  assert.deepEqual(Q.k.edits, []);
  assert.ok(z && Q.results.every((r) => r.ok));
  delete globalThis.localStorage; CC.resetMemory();
});

test('K6: a write that rejects drops what it carried; the panel reads as before; later changes still store (D15)', async () => {
  const [x, y] = RECS.items(D);
  const { CC, NAME } = recsFixture();
  await CC.writeSection(NAME, { choices: { giveUp: 25 } }, { rev: await stampOf(CC), base: null });
  let calls = 0, queued = null;
  const P = await openPage(CC, NAME, (w) => {
    calls++;
    if (calls === 1) { queued = P.edit((c) => { c.loot[0][0] = y.id; }); return Promise.reject(new Error('disk full')); }
    return w();
  });
  const before = RECS.check(P.k.raw, D);
  const failing = P.edit((c) => { c.fuel = true; c.loot[0][0] = x.id; });
  assert.equal(RECS.check(P.k.raw, D).fuel, true, 'shown at once');
  await failing; await queued; // queued is set while the failing write runs
  assert.equal(P.results[0].ok, false);
  assert.equal(P.results[0].error.message, 'disk full');
  const ch = await savedChoices(CC, NAME);
  assert.deepEqual([ch.fuel, ch.loot1, ch.giveUp], [undefined, y.id, 25], 'the failed write\'s changes are dropped, the queued one is stored');
  assert.deepEqual(P.k.edits, []);
  assert.equal(P.results[1].ok, true);
  assert.equal(RECS.check(P.k.raw, D).fuel, before.fuel, 'reads as before the failed change');
  await P.edit((c) => { c.giveUp = 40; });
  assert.deepEqual((({ fuel, giveUp, loot1 }) => ({ fuel, giveUp, loot1 }))(await savedChoices(CC, NAME)), { fuel: undefined, giveUp: 40, loot1: y.id }, 'the next change stores only itself');
  // a failing write alone: the section is unchanged and the panel reads as before
  const F = await openPage(CC, NAME, () => Promise.reject(new Error('refused')));
  const was = JSON.stringify(RECS.check(F.k.raw, D)), stored = JSON.stringify(CC.checkDoc((await CC.read()).raw).modules[NAME]);
  await F.edit((c) => { c.fuel = true; });
  assert.equal(JSON.stringify(RECS.check(F.k.raw, D)), was);
  assert.equal(JSON.stringify(CC.checkDoc((await CC.read()).raw).modules[NAME]), stored, 'the save is unchanged');
  assert.deepEqual(F.k.edits, []);
  assert.equal(F.results[0].ok, false);
  delete globalThis.localStorage; CC.resetMemory();
});

test('K7: the same control in two pages: the later write is stored, without asking (what remains)', async () => {
  const [x, y] = RECS.items(D);
  const { CC, NAME } = recsFixture();
  const A = await openPage(CC, NAME), B = await openPage(CC, NAME);
  await A.edit((c) => { c.loot[0][0] = x.id; });
  await B.edit((c) => { c.loot[0][0] = y.id; });
  assert.equal((await savedChoices(CC, NAME)).loot1, y.id);
  await A.edit((c) => { c.order = ['gil', 'unlock', 'level', 'loot']; });
  await B.edit((c) => { c.order = ['loot', 'gil', 'level', 'unlock']; });
  assert.deepEqual((await savedChoices(CC, NAME)).order, ['loot', 'gil', 'level', 'unlock']);
  delete globalThis.localStorage; CC.resetMemory();
});

test('K8: across devices (threeWay): different pickers merge, one picker\'s item and switch merge, the same item differently asks', () => {
  const { CC, ET, NAME } = recsFixture();
  const [x, y] = RECS.items(D);
  const doc = (sec) => ({ modules: { [NAME]: sec } });
  const base = { choices: { loot1: x.id } };
  const edit = (raw, mut) => recsEdit(raw, mut);
  const A = edit(base, (c) => { c.loot[1][0] = y.id; c.loot[1][1] = true; }), B = edit(base, (c) => { c.loot[2][0] = y.id; c.loot[2][1] = true; });
  let res = ET.threeWay(doc(base), doc(A), doc(B));
  assert.deepEqual(res.conflicts, [], 'two different pickers');
  const m = CC.unflatModules(res.merged)[NAME].choices;
  assert.deepEqual([m.loot2, m.use2, m.loot3, m.use3], [y.id, true, y.id, true]);
  const I = edit(base, (c) => { c.loot[1][0] = y.id; }), S = edit(base, (c) => { c.loot[1][1] = true; });
  res = ET.threeWay(doc(base), doc(I), doc(S));
  assert.deepEqual(res.conflicts, [], 'the item and the switch of one picker');
  const m2 = CC.unflatModules(res.merged)[NAME].choices;
  assert.deepEqual([m2.loot2, m2.use2], [y.id, true]);
  const D1 = edit(base, (c) => { c.loot[1][0] = y.id; }), D2 = edit(base, (c) => { c.loot[1][0] = RECS.items(D)[2].id; });
  res = ET.threeWay(doc(base), doc(D1), doc(D2));
  assert.equal(res.conflicts.length, 1);
  assert.ok(res.conflicts[0].id.endsWith('"choices","loot2"]'), res.conflicts[0].id);
  delete globalThis.localStorage; CC.resetMemory();
});

test('K9: check reads every row of the storage table; an old choices.loot array is ignored and stays after a write', () => {
  const [a, b] = RECS.items(D);
  const old = { choices: { loot: [[a.id, true], [b.id, true], [0, false], [0, false], [0, false]] } };
  assert.deepEqual(RECS.check(old, D).loot, RECS.defaults().loot, 'not read');
  const out = recsEdit(old, (c) => { c.fuel = true; });
  assert.deepEqual(out.choices.loot, old.choices.loot, 'still there');
  assert.equal(out.choices.fuel, true);
  assert.equal(RECS.check(out, D).loot[0][0], 0);
  // each row: whole numbers only; false and truthy non-true switches are off
  assert.deepEqual(RECS.check({ choices: { loot1: a.id } }, D).loot[0], [a.id, true]);
  assert.deepEqual(RECS.check({ choices: { loot1: String(a.id), loot2: -a.id, loot3: 0, use3: true } }, D).loot, [[0, true], [0, false], [0, true], [0, false], [0, false]]);
  assert.deepEqual(RECS.check({ choices: { use2: 'true', use3: 1, use4: false, use5: true } }, D).loot.map((p) => p[1]), [true, false, false, false, true]);
  assert.equal(RECS.held({ choices: { loot2: a.id } }, 1), a.id);
  assert.equal(RECS.held({ choices: { loot2: 'x' } }, 1), 0);
  assert.equal(RECS.held(null, 0), 0);
  assert.equal(RECS.rebase(null, []), null);
  assert.deepEqual(RECS.rebase({ choices: { a: 1 } }, [{ seq: 1, patch: { b: 2 } }, { seq: 2, patch: { a: 3 } }]), { choices: { a: 3, b: 2 } });
});

// ---------------------------------------------------------------- community drop records and thresholds (D1)
test('drop records: 143 sectors and 143 threshold rows, on the game\'s sector ids', () => {
  const ids = D.sectors.map((s) => String(s.id)).sort();
  assert.deepEqual(Object.keys(D.dropRates.sectors).sort(), ids);
  assert.deepEqual(Object.keys(D.breakpoints).sort(), ids);
  assert.equal(D.counts.dropSectors, 143);
  assert.equal(D.counts.breakpoints, 143);
  assert.equal(D.counts.dropRecords, 205249206);
  assert.equal(D.counts.dropRewards, 1353);
  assert.equal(D.counts.dropItemsAdded, 57);
});
test('drop records: every pool\'s item rolls, band counts and retrieval counts agree', () => {
  let records = 0, rows = 0;
  for (const [id, s] of Object.entries(D.dropRates.sectors)) {
    assert.equal(s.pools.length, 3, id);
    let placed = 0;
    s.pools.forEach((p, t) => {
      const n = p.band.reduce((a, b) => a + b, 0);
      assert.equal(p.ret.reduce((a, b) => a + b, 0), n, id + ' retrieval, tier ' + (t + 1));
      assert.equal(p.items.reduce((a, r) => a + r[1], 0), n, id + ' items, tier ' + (t + 1));
      if (t >= 1) assert.equal(p.band[0], 0, id + ' low rolls in tier ' + (t + 1));
      if (t === 2) assert.equal(p.band[1], 0, id + ' mid rolls in tier 3');
      for (let i = 1; i < p.items.length; i++) assert.ok(p.items[i - 1][0] < p.items[i][0], 'sorted by id');
      for (const r of p.items) {
        assert.equal(r.length, 9);
        assert.ok(r[1] > 0 && r[2] >= r[1]);
        for (let k = 3; k < 9; k += 2) assert.ok(r[k] <= r[k + 1]);
        rows++;
      }
      placed += n;
    });
    assert.ok(s.favor[1] <= s.favor[0] && s.favor[0] <= placed);
    assert.equal(s.n - placed, D.dropped.dropRecordsWithoutTier[id] || 0);
    records += s.n;
  }
  assert.equal(records, D.counts.dropRecords);
  assert.equal(rows, D.counts.dropRewards);
  assert.equal(D.dropRates.sectors['92'].n, 18474);
  const all = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const s of Object.values(D.dropRates.sectors)) s.pools.forEach((p, t) => p.band.forEach((v, b) => { all[t][b] += v; }));
  assert.deepEqual(D.dropRates.all, all);
});
test('drop records: sector 15 (O) matches the source\'s figures', () => {
  const o = D.dropRates.sectors['15'];
  assert.equal(o.n, 61069971);
  assert.deepEqual(o.pools.map((p) => p.band[2]), [30745381, 19943663, 9385612]);
  assert.deepEqual(o.favor, [60547216, 49900626]);
  const t3 = new Map(o.pools[2].items.map((r) => [r[0], r[1]]));
  assert.equal(t3.get(22504), 1642949);
  assert.equal(t3.get(22505), 2580137);
  assert.equal(t3.get(22506), 3053457);
  assert.equal(t3.get(22507), 2109069);
});
test('thresholds: the community rows, in order', () => {
  assert.deepEqual(D.breakpoints['15'], [80, 115, 120, 160, 90]);
  assert.deepEqual(D.breakpoints['10'], [50, 115, 80, 110, 90]);
  for (const b of Object.values(D.breakpoints)) {
    assert.equal(b.length, 5);
    assert.ok(b[0] <= b[1] && b[2] <= b[3]);
  }
});
test('drop records: every drop item has a name and a price; the existing counts stay', () => {
  for (const s of Object.values(D.dropRates.sectors)) {
    for (const p of s.pools) {
      for (const r of p.items) {
        assert.ok(D.items[String(r[0])], 'name of ' + r[0]);
        assert.ok(Array.isArray(D.itemInfo[String(r[0])]), 'price of ' + r[0]);
      }
    }
  }
  assert.equal(D.counts.lootPairs, 1085);
  assert.equal(D.counts.lootSectors, 141);
  assert.equal(D.counts.lootItems, 356);
  assert.match(D.formula.experienceNote, /used for loot estimates only \(table `breakpoints`\); experience still shows the base value/);
});
test('drop records: the source, commit, licence, notice and permission are carried', () => {
  const g = D.sources.gacha;
  assert.equal(g.repo, 'Infiziert90/FFXIVGachaSpreadsheet');
  assert.equal(g.commit, 'c7bd22537e3fdd1fce05d9d84250ba475a7bb6e5');
  assert.equal(g.licence, 'MIT');
  assert.equal(g.kind, 'community data');
  assert.match(g.notice, /^Copyright \(c\) 2023 Infi /);
  assert.equal(g.permission, D.sources.submarineTracker.permission);
  assert.equal(D.tables.dropRates.commit, g.commit);
  assert.equal(D.tables.breakpoints.commit, g.commit);
  assert.match(D.tables.dropRates.label, /second item is not in the records/);
  assert.match(D.tables.breakpoints.label, /used for loot estimates only/);
});

// ---------------------------------------------------------------- D2: the estimator (drops.js)
const DROPS = (require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'drops.js')), globalThis.DROPS);
const OJ_ST = ADV.stats(145, [3, 4, 5, 14]);
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= Math.abs(b) * tol, `${what}: ${a} vs ${b}`);
const ALLHI = { surveillance: 999, retrieval: 999, favor: 999, speed: 100, range: 999 };

// A second, straightforward reading of spec 5.1 straight from the raw tables (direct sums, no cache, no shared helper).
function refSector(sid, st, price) {
  const sec = D.dropRates.sectors[String(sid)], bp = D.breakpoints[String(sid)];
  const price1 = (id) => (D.itemInfo[String(id)] && D.itemInfo[String(id)][0]) || 0;
  const pf = price || price1;
  let gil = 0, second;
  if (!st) {
    second = sec.favor[1] / sec.n;
    for (const pool of sec.pools) for (const it of pool.items) gil += (it[2] / sec.n) * pf(it[0]); // Total / sector rolls x price
    return { gil: gil * (1 + second), second };
  }
  const band = st.surveillance >= bp[1] ? 'high' : st.surveillance >= bp[0] ? 'mid' : 'low';
  const bi = { low: 0, mid: 1, high: 2 }[band];
  const res = st.retrieval >= bp[3] ? 2 : st.retrieval >= bp[2] ? 1 : 0;
  const counts = sec.pools.map((p) => p.band[bi]), tot = counts[0] + counts[1] + counts[2];
  assert.ok(tot >= 100, 'reference covers only well-recorded bands');
  second = st.favor >= bp[4] ? sec.favor[1] / sec.favor[0] : 0;
  sec.pools.forEach((pool, t) => {
    const rolls = pool.band[0] + pool.band[1] + pool.band[2];
    for (const it of pool.items) {
      const mids = [0, 1, 2].map((k) => (it[3 + 2 * k] + it[4 + 2 * k]) / 2), has = [0, 1, 2].map((k) => it[3 + 2 * k] + it[4 + 2 * k] > 0);
      assert.ok(has[res], 'reference covers only items with a range for the result');
      let num = 0, den = 0;
      for (let k = 0; k < 3; k++) if (has[k]) { num += pool.ret[k] * mids[k]; den += pool.ret[k]; }
      const q = mids[res] * (it[2] / it[1]) / (num / den);
      gil += (counts[t] / tot) * (it[1] / rolls) * q * pf(it[0]);
    }
  });
  return { gil: gil * (1 + second), second };
}

test('drops: the OJ example of spec 5.3, computed from the data', () => {
  const ev = ADV.evalRoute([15, 10], OJ_ST), r = DROPS.route(D, [15, 10], OJ_ST), per = DROPS.perHour(r.gil, ev.seconds);
  console.log('OJ: O %s, J %s, voyage %s, per hour %s, second-item share %s, seconds %s, range %s',
    r.sectors[0].gil, r.sectors[1].gil, r.gil, per, r.sectors[0].second / (1 + r.sectors[0].second), ev.seconds, ev.range);
  assert.equal(ev.seconds, 73640); assert.equal(ev.range, 59);
  near(r.sectors[0].gil, 58314, 0.005, 'O'); near(r.sectors[1].gil, 58348, 0.005, 'J');
  near(r.gil, 116700, 0.005, 'voyage'); near(per, 5700, 0.005, 'hour');
  assert.deepEqual(r.sectors.map((s) => s.state), [{ band: 2, ret: 2, favor: true }, { band: 2, ret: 2, favor: true }]);
  near(r.sectors[0].second, 0.8242, 0.001, 'O second'); near(r.sectors[1].second, 0.8242, 0.001, 'J second');
  const t = r.sectors[0].tiers; // merchant gil per roll at optimal, first item
  near(t[0].p, 0.5118, 0.002, 'O tier 1'); near(t[1].p, 0.3320, 0.002, 'O tier 2'); near(t[2].p, 0.1562, 0.002, 'O tier 3');
  near(t[0].gil, 64, 0.01, 'O tier 1 gil'); near(t[1].gil, 30660, 0.005, 'O tier 2 gil'); near(t[2].gil, 139259, 0.005, 'O tier 3 gil');
  near(r.sectors[1].tiers[2].gil, 139284, 0.005, 'J tier 3 gil');
  assert.equal(r.sectors[0].rolls, 60074656); assert.equal(r.sectors[1].rolls, 60042984);
  assert.equal(r.few, false);
  assert.equal(DROPS.fmt.voyage(r.gil), '116,700'); assert.equal(DROPS.fmt.hour(per), '5,700');
});
test('drops: the rank 85 contrast of spec 5.3', () => {
  const st = ADV.stats(85, [3, 4, 5, 14]);
  assert.equal(st.retrieval, 148);
  const r = DROPS.route(D, [15, 10], st);
  assert.deepEqual(r.sectors.map((s) => s.state.ret), [1, 2]);
  near(r.sectors[0].gil, 25900, 0.005, 'O at rank 85'); near(r.gil, 84300, 0.005, 'voyage at rank 85');
});
test('drops: cross-check against a direct recomputation for several sectors and builds', () => {
  const builds = [OJ_ST, ADV.stats(85, [3, 4, 5, 14]), ADV.stats(145, [1, 2, 3, 4]), ADV.stats(60, [5, 6, 7, 8])];
  let checked = 0;
  for (const sid of [15, 10, 18, 26, 1, 4, 63]) for (const st of builds.concat([null])) {
    let ref;
    try { ref = refSector(sid, st); } catch (e) { if (/reference covers/.test(e.message)) continue; throw e; }
    const got = DROPS.sector(D, sid, st);
    near(got.gil, ref.gil, 1e-9, `sector ${sid}`); near(got.second, ref.second, 1e-12, 'second'); checked++;
  }
  assert.ok(checked >= 12, 'checked ' + checked);
  const price = (id) => (id * 7) % 1000;
  near(DROPS.sector(D, 15, OJ_ST, price).gil, refSector(15, OJ_ST, price).gil, 1e-9, 'other price');
  console.log('cross-check: %d sector and build pairs agree', checked + 1);
});
test('drops: band and result edges at O (thresholds 80 / 115 / 120 / 160 / 90)', () => {
  assert.deepEqual(D.breakpoints['15'], [80, 115, 120, 160, 90]);
  const S = (o) => DROPS.state(D, 15, Object.assign({}, ALLHI, o));
  assert.equal(S({ surveillance: 114 }).band, 1); assert.equal(S({ surveillance: 115 }).band, 2);
  assert.equal(S({ surveillance: 79 }).band, 0); assert.equal(S({ surveillance: 80 }).band, 1);
  assert.equal(S({ retrieval: 159 }).ret, 1); assert.equal(S({ retrieval: 160 }).ret, 2);
  assert.equal(S({ retrieval: 119 }).ret, 0); assert.equal(S({ retrieval: 120 }).ret, 1);
  assert.equal(S({ favor: 89 }).favor, false); assert.equal(S({ favor: 90 }).favor, true);
  assert.equal(DROPS.state(D, 15, null), null); assert.equal(DROPS.state(D, 99999, ALLHI), null);
  // a build below every threshold: low band, poor, no second item, still an estimate
  const lo = DROPS.sector(D, 15, { surveillance: 0, retrieval: 0, favor: 0 });
  assert.deepEqual(lo.state, { band: 0, ret: 0, favor: false }); assert.equal(lo.second, 0); assert.ok(lo.gil > 0);
  // a build exactly on every threshold gets the higher band, result and the second item
  const on = DROPS.sector(D, 15, { surveillance: 115, retrieval: 160, favor: 90 });
  assert.deepEqual(on.state, { band: 2, ret: 2, favor: true });
  assert.ok(on.gil > lo.gil);
});
test('drops: low band gives tier 1 items only; favor below the threshold gives no second item', () => {
  const tier1 = new Set(D.dropRates.sectors['15'].pools[0].items.map((r) => String(r[0])));
  const low = DROPS.sector(D, 15, { surveillance: 0, retrieval: 999, favor: 999 });
  assert.deepEqual(low.tiers.map((t) => t.p), [1, 0, 0]);
  for (const id of Object.keys(low.items)) assert.ok(tier1.has(id), 'item ' + id);
  const no = DROPS.sector(D, 15, { surveillance: 999, retrieval: 999, favor: 89 }), yes = DROPS.sector(D, 15, ALLHI);
  assert.equal(no.second, 0); near(yes.gil / no.gil, 1 + yes.second, 1e-12, 'second item factor');
  near(yes.second, D.dropRates.sectors['15'].favor[1] / D.dropRates.sectors['15'].favor[0], 1e-12, 'second share');
});
test('drops: without a build the community average equals the formula of 5.1 computed here', () => {
  for (const sid of [15, 10, 1, 63]) {
    const ref = refSector(sid, null), got = DROPS.sector(D, sid, null);
    near(got.gil, ref.gil, 1e-9, 'average ' + sid); assert.equal(got.state, null); assert.equal(got.few, false);
    near(DROPS.sector(D, sid, undefined).gil, ref.gil, 1e-9, 'undefined build');
  }
  // sector without thresholds behaves as no build
  const D2 = Object.assign({}, D, { breakpoints: {} });
  near(DROPS.sector(D2, 15, OJ_ST).gil, refSector(15, null).gil, 1e-9, 'no thresholds');
});
test('drops: a route is the sum of its sectors in any order; n is the least-recorded sector; one and five sectors', () => {
  const route = [10, 15, 18, 26], a = DROPS.route(D, route, OJ_ST), b = DROPS.route(D, route.slice().reverse(), OJ_ST);
  near(a.gil, b.gil, 1e-12, 'order'); near(a.gil, route.reduce((t, id) => t + DROPS.sector(D, id, OJ_ST).gil, 0), 1e-12, 'sum');
  assert.equal(a.n, Math.min(...route.map((id) => D.dropRates.sectors[String(id)].n)));
  const items = {}; for (const s of a.sectors) for (const [id, q] of Object.entries(s.items)) items[id] = (items[id] || 0) + q;
  for (const [id, q] of Object.entries(items)) near(a.items[id], q, 1e-12, 'item ' + id);
  const one = DROPS.route(D, [15], OJ_ST); assert.equal(one.sectors.length, 1); near(one.gil, DROPS.sector(D, 15, OJ_ST).gil, 1e-12, 'one');
  const five = D.commonRoutes.find((r) => r.route.length === 5) || { route: [10, 15, 18, 26, 17] };
  const f = DROPS.route(D, five.route, OJ_ST); assert.equal(f.sectors.length, five.route.length);
  assert.equal(DROPS.route(D, [], OJ_ST), null); assert.equal(DROPS.route(D, [99999], OJ_ST), null);
  // gil is the quantities times the price
  near(Object.entries(a.items).reduce((t, [id, q]) => t + q * DROPS.merchant(D)(+id), 0), a.gil, 1e-9, 'items x price');
});
test('drops: another price function changes gil and nothing else; no price or price 0 counts nothing', () => {
  const base = DROPS.route(D, [15, 10], OJ_ST), dbl = DROPS.route(D, [15, 10], OJ_ST, (id) => 2 * DROPS.merchant(D)(id));
  near(dbl.gil, 2 * base.gil, 1e-12, 'double price'); assert.deepEqual(dbl.items, base.items); assert.equal(dbl.n, base.n);
  assert.equal(DROPS.route(D, [15, 10], OJ_ST, () => 0).gil, 0);
  assert.equal(DROPS.route(D, [15, 10], OJ_ST, () => undefined).gil, 0);
  assert.equal(DROPS.route(D, [15, 10], OJ_ST, () => NaN).gil, 0);
  const D2 = JSON.parse(JSON.stringify({ itemInfo: D.itemInfo }));
  const m = DROPS.merchant({ itemInfo: { 5: [0, 1], 6: [7, 0] } });
  assert.equal(m(5), 0); assert.equal(m(6), 7); assert.equal(m(7), 0);
  assert.equal(DROPS.merchant({})(1), 0); assert.ok(D2);
  // the merchant price of a real item is the table's
  const id = D.dropRates.sectors['15'].pools[2].items[0][0]; assert.equal(DROPS.merchant(D)(id), D.itemInfo[String(id)][0]);
});
// A small hand-made table: every number below is the test's own, so the expected figures can be worked out by eye.
const MINI = {
  itemInfo: { 1: [10, 1], 2: [100, 1], 3: [0, 0] },
  breakpoints: { 1: [10, 20, 5, 8, 3] },
  dropRates: {
    all: [[400, 300, 200], [0, 100, 200], [0, 0, 100]],
    sectors: { 1: {
      n: 1000, favor: [500, 250],
      pools: [
        { band: [200, 50, 10], ret: [0, 100, 160], items: [[1, 260, 520, 0, 0, 1, 3, 2, 2]] },       // the item has no poor range
        { band: [0, 40, 10], ret: [0, 25, 25], items: [[2, 50, 50, 1, 1, 1, 1, 1, 1], [3, 0, 0, 0, 0, 0, 0, 0, 0]] },
        { band: [0, 0, 5], ret: [0, 0, 5], items: [[2, 5, 15, 0, 0, 0, 0, 3, 3]] }
      ] } }
  }
};
MINI.dropRates.sectors[1].pools[2].items = [[2, 5, 15, 0, 0, 0, 0, 3, 3]];
MINI.dropRates.sectors[1].pools[1].items = [[2, 50, 50, 1, 1, 1, 1, 1, 1]];
test('drops: a thin band uses the all-sector counts and a missing range uses the nearest result; both marked few', () => {
  // low band here has 200 rolls in tier 1 only; the high band has 10 + 10 + 5 = 25 rolls (< 100): all-sector counts
  const thin = DROPS.sector(MINI, 1, { surveillance: 50, retrieval: 50, favor: 0 });
  assert.equal(thin.few, true); assert.equal(thin.rolls, 0);
  near(thin.tiers[0].p, 200 / 500, 1e-12, 'tier 1'); near(thin.tiers[1].p, 200 / 500, 1e-12, 'tier 2'); near(thin.tiers[2].p, 100 / 500, 1e-12, 'tier 3');
  // a well-recorded band (low: 200 rolls) and a result with no range for the item (poor): the normal range is used, marked few
  const lowPoor = DROPS.sector(MINI, 1, { surveillance: 0, retrieval: 0, favor: 0 });
  assert.equal(lowPoor.few, true); assert.equal(lowPoor.rolls, 200); assert.deepEqual(lowPoor.tiers.map((t) => t.p), [1, 0, 0]);
  // item 1: ranges normal 1..3 (mid 2, share 100/260) and optimal 2..2 (mid 2, share 160/260): scaled q = 2 x (520/260) / 2 = 2
  near(lowPoor.items[1], (260 / 260) * 2 * 1, 1e-12, 'quantity'); near(lowPoor.gil, 2 * 10, 1e-12, 'gil');
  const lowOpt = DROPS.sector(MINI, 1, { surveillance: 0, retrieval: 99, favor: 0 });
  assert.equal(lowOpt.few, false); near(lowOpt.items[1], 2, 1e-12, 'optimal quantity');
  // mid band: 50 + 40 + 0 = 90 rolls < 100: thin as well
  assert.equal(DROPS.sector(MINI, 1, { surveillance: 10, retrieval: 99, favor: 0 }).few, true);
  // a band with no records at all (no tier has one) falls back to the all-sector counts, never divides by zero
  const none = { itemInfo: MINI.itemInfo, breakpoints: MINI.breakpoints, dropRates: { all: MINI.dropRates.all, sectors: { 1: Object.assign({}, MINI.dropRates.sectors[1], { pools: MINI.dropRates.sectors[1].pools.map((p) => Object.assign({}, p, { band: [p.band[0], 0, 0] })) }) } } };
  const z = DROPS.sector(none, 1, { surveillance: 15, retrieval: 99, favor: 0 });
  assert.equal(z.few, true); assert.ok(Number.isFinite(z.gil));
  // the same real data: a sector's answer carries `few` only for thin cases
  assert.equal(DROPS.sector(D, 15, OJ_ST).few, false);
});
test('drops: real items with no range for the build\'s result are marked few', () => {
  let found = null;
  for (const [sid, s] of Object.entries(D.dropRates.sectors)) {
    s.pools.forEach((p, t) => p.items.forEach((it) => {
      for (let k = 0; k < 3 && !found; k++) if (it[3 + 2 * k] === 0 && it[4 + 2 * k] === 0 && [0, 1, 2].some((j) => it[3 + 2 * j] > 0) && p.band[2] >= 100 && s.pools.every((q) => q.band[2] >= 100)) found = [+sid, k];
    }));
    if (found) break;
  }
  assert.ok(found, 'such an item exists in the data');
  const bp = D.breakpoints[String(found[0])], retr = [0, bp[2], bp[3]][found[1]];
  const poor = DROPS.sector(D, found[0], { surveillance: 999, retrieval: retr, favor: 0 });
  assert.equal(poor.few, true);
  assert.ok(Number.isFinite(poor.gil));
});
test('drops: hours of zero are guarded; the rounding of spec 5.4', () => {
  assert.equal(DROPS.perHour(100, 0), null); assert.equal(DROPS.perHour(100, -5), null); assert.equal(DROPS.perHour(100, NaN), null);
  assert.equal(DROPS.perHour(7200, 3600), 7200);
  const f = DROPS.fmt;
  assert.equal(f.voyage(116662.9), '116,700'); assert.equal(f.hour(5703.2), '5,700');
  assert.equal(f.qty(4.612), '4.6'); assert.equal(f.qty(27.4), '27'); assert.equal(f.qty(1234), '1200'); assert.equal(f.qty(0.04567), '0.046'); assert.equal(f.qty(0), '0');
  assert.equal(f.pct(0.5118), '51%'); assert.equal(f.pct(0.0962), '9.6%'); assert.equal(f.pct(0.1562), '16%');
  assert.equal(f.count(61069971), '61.1 million'); assert.equal(f.count(60042984), '60.0 million'); assert.equal(f.count(18474), '18,474');
});
test('drops: cost of one route and of ranking the ten community routes', () => {
  const routes = D.commonRoutes.slice(0, 10);
  DROPS.route(D, routes[0].route, OJ_ST);
  const N = 100000, five = [10, 15, 18, 26, 17];
  let t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) DROPS.route(D, five, OJ_ST);
  const perRoute = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  t0 = process.hrtime.bigint();
  const R = 200;
  for (let i = 0; i < R; i++) for (const r of routes) { const ev = ADV.evalRoute(r.route, OJ_ST); if (ev) DROPS.perHour(DROPS.route(D, r.route, OJ_ST).gil, ev.seconds); }
  const rank10 = Number(process.hrtime.bigint() - t0) / 1e6 / R;
  console.log('cost: %s ms per 5-sector route (warm cache, %d calls); %s ms to rank %d community routes with evalRoute', perRoute.toFixed(5), N, rank10.toFixed(4), routes.length);
  assert.ok(perRoute < 1);
  // cold: compile every sector of a route for a state not seen before
  const cold = JSON.parse(JSON.stringify({ breakpoints: D.breakpoints, itemInfo: D.itemInfo, dropRates: D.dropRates }));
  t0 = process.hrtime.bigint(); DROPS.route(cold, five, OJ_ST); console.log('cost: cold first call of a 5-sector route %s ms', (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(3));
});

// ---------------------------------------------------------------- D3: Gil Farming (community routes first), D4: the top rank
// (docs/submersibles-droprates-spec.md sections 6.1, 6.2, 5.5 and the owner's decisions of 2026-11-18)
const D3_PARTS = [3, 4, 5, 14]; // the build of spec 5.3
const D3_FULL = { sub: { rank: TOP, parts: D3_PARTS }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
const gilAdvise = (inp, o) => ADV.advise(Object.assign({}, inp, { recs: withRecs(o || {}) }));
const LOGGED_ROW = (route, trips, merchantPerTrip, enough) => ({ route, trips, perTrip: merchantPerTrip == null ? 0 : merchantPerTrip, merchantPerTrip, enough: enough === undefined ? trips >= 10 : enough });
// brute force: every pinned community route the build can run, by estimated merchant gil per hour (a log figure replaces it when given)
function communityRanking(inp, logged) {
  const st = ADV.stats(inp.sub.rank, inp.sub.parts), disc = new Set(inp.fc.discovered), out = [];
  for (const cr of D.commonRoutes) {
    if (!cr.route.every((id) => disc.has(id) && SECTOR.get(id).rank <= inp.sub.rank)) continue;
    const ev = ADV.evalRoute(cr.route, st); if (!ev || !ev.reachable) continue;
    const est = DROPS.route(D, cr.route, st), lg = (logged || []).find((l) => l.route.join() === cr.route.join() && l.enough && Number.isFinite(l.merchantPerTrip));
    out.push({ name: cr.name, route: cr.route, ev, est, estPerHour: DROPS.perHour(est.gil, ev.seconds), perHour: DROPS.perHour(lg ? lg.merchantPerTrip : est.gil, ev.seconds), tanks: Math.max(1, ev.tanks) });
  }
  return out.sort((a, b) => b.perHour - a.perHour);
}
const noStarsText = (a) => [a.plan].concat(a.alts).forEach((x) => assert.ok(!/only a guide|sector stars|stars/i.test(x.why), x.why));

test('D3: rank 145, the build of 5.3, everything found, default order: Gil leads, the plan is the best runnable community route by DROPS', () => {
  const a = gilAdvise(D3_FULL), rank = communityRanking(D3_FULL);
  assert.equal(a.lead, 'G'); assert.equal(a.step, 3);
  assert.equal(a.plan.kind, 'community'); assert.deepEqual(a.plan.route, rank[0].route); assert.equal(a.plan.name, rank[0].name);
  assert.equal(rank.length, 10, 'all ten community routes can be run by this build');
  near(a.plan.est.perHour, rank[0].estPerHour, 1e-12, 'perHour'); near(a.plan.est.gil, rank[0].est.gil, 1e-12, 'gil');
  const least = Math.min(...rank[0].est.sectors.map((x) => x.rolls)); assert.equal(a.plan.est.n, least, 'the count is the band\'s least-recorded sector');
  assert.equal(a.plan.est.few, false);
  assert.ok(a.plan.why.startsWith(`Community gil route ${rank[0].name}: about `), a.plan.why);
  assert.ok(a.plan.why.includes('an estimate from community drop records (at least ' + DROPS.fmt.count(least) + ' surveys per sector on this route), not a promise.'), a.plan.why);
  assert.ok(a.plan.why.includes('The best of the 10 community gil routes this submarine can run.'), a.plan.why);
  assert.ok(a.plan.why.includes(DROPS.fmt.voyage(rank[0].est.gil) + ' gil a voyage at merchant prices (about ' + DROPS.fmt.hour(rank[0].estPerHour) + ' an hour'), a.plan.why);
  // other routes: community routes in order, each says what it is
  const idx = a.alts.map((x) => rank.findIndex((r) => r.route.join() === x.route.join()));
  assert.ok(idx.every((i) => i > 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), 'other routes are the next community routes, best first: ' + idx);
  for (const x of a.alts) assert.equal(x.kind, 'community');
  noStarsText(a);
  // with the default order, nothing is skipped silently: the two objectives above Gil are named
  assert.match(a.plan.why, /Skipped Unlocking Routes: every sector is found\./); assert.match(a.plan.why, /Skipped Leveling Submersible Rank: /);
  // the unchanged path (no recs) is untouched: it still says stars
  assert.match(ADV.advise(D3_FULL).plan.why, /stars are only a guide/);
});

test('D3: no community route can be run: the plan is derived, and the sentence says why (rank, sectors not found, range)', () => {
  const gilFirst = { order: ['gil', 'unlock', 'level', 'loot'] };
  const notFound = gilAdvise({ sub: { rank: 15, parts: SHARK }, fc: { unlockedSlots: 4, discovered: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, slotsFilled: 4 }, gilFirst);
  assert.equal(notFound.lead, 'G'); assert.equal(notFound.plan.kind, 'derived');
  assert.ok(notFound.plan.why.startsWith('No community gil route can be run by this submarine now (sectors not found). Found by the app from community drop rates: about '), notFound.plan.why);
  assert.ok(/an estimate from community drop records \(at least [\d,.]+( million)? surveys per sector on this route\), not a promise\./.test(notFound.plan.why));
  for (const x of [notFound.plan].concat(notFound.alts)) assert.equal(x.kind, 'derived');
  noStarsText(notFound);
  // the plan equals the best of every route the sub can run in that sea, by estimated gil per hour (brute force, 9 sectors found)
  const st = ADV.stats(15, SHARK); let best = 0;
  (function walk(r) { if (r.length >= 5) return; for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9]) { if (r.includes(id)) continue; const n = r.concat(id), ev = ADV.evalRoute(n, st); if (!ev.reachable) continue; best = Math.max(best, DROPS.perHour(DROPS.route(D, n, st).gil, ev.seconds)); walk(n); } })([]);
  assert.ok(notFound.plan.est.perHour >= 0.95 * best, `plan ${notFound.plan.est.perHour} vs best ${best}: within the search's reach`);
  // rank: the Fight Club sectors are found but rank 30 is below Z (rank 50) and R (37)... OJ stays runnable at 30, so use a rank below O (30)
  const lowRank = gilAdvise({ sub: { rank: 25, parts: SHARK }, fc: { unlockedSlots: 4, discovered: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 18, 26, 13] }, slotsFilled: 4 }, gilFirst);
  assert.equal(lowRank.plan.kind, 'derived'); assert.match(lowRank.plan.why, /^No community gil route can be run by this submarine now \(rank\)\./);
  // range: found and rank allowed, but the range does not reach any of them
  const rangeInp = { sub: { rank: 30, parts: [11, 16, 21, 2] }, fc: { unlockedSlots: 4, discovered: [13, 18, 15, 10, 26] }, slotsFilled: 4 };
  const noRange = gilAdvise(rangeInp, gilFirst);
  assert.equal(noRange.plan.kind, 'derived'); assert.match(noRange.plan.why, /^No community gil route can be run by this submarine now \(range\)\./);
  assert.equal(communityRanking(rangeInp).length, 0);
  // a sea of more than 8 visitable sectors: "best found, not proven best"
  const big = gilAdvise({ sub: { rank: TOP, parts: D3_PARTS }, fc: { unlockedSlots: 4, discovered: D.sectors.filter((s) => s.sea === 7).map((s) => s.id) }, slotsFilled: 4 });
  assert.equal(big.lead, 'G'); assert.equal(big.plan.kind, 'derived'); assert.match(big.plan.why, /The best found, not proven best\./);
});

test('D3 (Q4): a community route leads unless an app-found route is at least twice as good; below that a derived route is only an other route, above 5%', () => {
  // item prices lowered for every item the two community seas drop, so the community routes get poorer and the app-found routes in the other seas
  // (whose own items keep their price) richer by comparison (a copy of the data; the advisor is set back after)
  const commSeas = new Set(D.commonRoutes.map((c) => SECTOR.get(c.route[0]).sea)), itemsOf = (sid) => new Set(D.dropRates.sectors[sid].pools.flatMap((p) => p.items.map((it) => it[0])));
  const inComm = new Set();
  for (const s of D.sectors) if (commSeas.has(s.sea)) for (const it of itemsOf(s.id)) inComm.add(it);
  const withPrices = (f) => { const info = Object.assign({}, D.itemInfo); for (const id of inComm) if (info[id]) info[id] = [info[id][0] * f].concat(info[id].slice(1)); return Object.assign({}, D, { itemInfo: info }); };
  const st = ADV.stats(TOP, D3_PARTS);
  let derivedAlt = 0, derivedPlan = 0, communityPlan = 0;
  try {
    for (const k of [1, 0.5, 0.2, 0.05, 0.01, 0.001]) {
      const dk = withPrices(k); ADV.init(dk);
      const base = Math.max(...D.commonRoutes.map((c) => DROPS.perHour(DROPS.route(dk, c.route, st).gil, ADV.evalRoute(c.route, st).seconds)));
      const a = gilAdvise(D3_FULL);
      assert.equal(a.lead, 'G'); assert.ok(a.alts.length <= 2);
      if (a.plan.kind === 'derived') {
        derivedPlan++;
        assert.ok(a.plan.est.perHour >= ADV.DERIVED_FACTOR * base - 1e-9, `k=${k}: the app-found plan ${a.plan.est.perHour} must be at least ${ADV.DERIVED_FACTOR} x ${base}`);
        assert.ok(a.plan.why.startsWith('Found by the app from community drop records in '), a.plan.why);
        assert.ok(a.plan.why.includes('The best community route this submarine can run is '), a.plan.why);
        assert.ok(a.plan.why.includes(DROPS.fmt.about(DROPS.fmt.hour(base)) + ' an hour by the same estimate'), a.plan.why);
        assert.ok(a.plan.why.includes('This one is at least twice as good, so it comes first. Community routes come first unless an app-found route is at least twice as good.'), a.plan.why);
        assert.equal(a.alts[0].kind, 'community', 'the best community route is the first other route'); near(a.alts[0].est.perHour, base, 1e-9, 'community alt');
      } else {
        communityPlan++;
        assert.equal(a.plan.kind, 'community'); near(a.plan.est.perHour, base, 1e-9, 'plan');
        for (const x of a.alts) {
          if (x.kind !== 'derived') continue;
          derivedAlt++;
          assert.ok(x.est.perHour > 1.05 * a.plan.est.perHour, `derived ${x.est.perHour} must beat the plan ${a.plan.est.perHour} by more than 5%`);
          assert.ok(x.est.perHour < ADV.DERIVED_FACTOR * a.plan.est.perHour, 'below the takeover factor, else it would be the plan');
          assert.equal(a.alts[0], x, 'second place');
          // estimate against estimate (fix 6): the percentage is of the community route's estimate, which the sentence names
          const more = Math.round((x.est.perHour / a.plan.est.perHour - 1) * 100);
          assert.ok(x.why.includes(`by the same estimate, ${more}% more than the estimate for the community route (${DROPS.fmt.about(DROPS.fmt.hour(a.plan.est.perHour))} an hour). Community routes come first unless an app-found route is at least twice as good.`), x.why);
          assert.match(x.why, /^Found by the app in [A-Za-z -]+: (about [\d,]+|under 10) gil an hour by the same estimate, /);
        }
      }
      noStarsText(a);
      if (k === 1) assert.ok(a.plan.kind === 'community' && a.alts.every((x) => x.kind === 'community'), 'at the real prices no app-found route beats the community plan by 5%');
    }
  } finally { ADV.init(D); }
  assert.ok(communityPlan > 0 && derivedPlan > 0, 'both outcomes are reached: ' + communityPlan + ' community, ' + derivedPlan + ' app-found');
  assert.ok(derivedAlt >= 0);
});

test('D3 (Q4): rank 60, everything found: an app-found route leads over weak early community routes, in Gil first and as Gil\'s narrowing step', () => {
  const parts = (() => { const cls = D.classes.filter((c) => c.rank <= 60).sort((a, b) => b.rank - a.rank)[0]; return D.parts.filter((p) => p.class === cls.id).sort((a, b) => a.slot - b.slot).map((p) => p.id); })();
  const inp = { sub: { rank: 60, parts }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 }, gilFirst = { order: ['gil', 'unlock', 'level', 'loot'] };
  const st = ADV.stats(60, parts), ph = (r) => DROPS.perHour(DROPS.route(D, r, st).gil, ADV.evalRoute(r, st).seconds);
  const runnable = D.commonRoutes.filter((c) => { const ev = ADV.evalRoute(c.route, st); return c.route.every((id) => SECTOR.get(id).rank <= 60) && ev && ev.reachable; });
  const base = Math.max(...runnable.map((c) => ph(c.route)));
  const a = gilAdvise(inp, gilFirst);
  assert.equal(a.lead, 'G'); assert.equal(a.plan.kind, 'derived', 'a rank-60 submarine is not sent on a weak community route');
  assert.ok(a.plan.est.perHour >= 2 * base, `${a.plan.est.perHour} against ${base}`);
  assert.ok(a.plan.why.includes('found by the app') || a.plan.why.startsWith('Found by the app from community drop records'), a.plan.why);
  assert.ok(a.plan.why.includes('an estimate from community drop records'), a.plan.why);
  assert.ok(a.plan.why.includes(DROPS.fmt.about(DROPS.fmt.hour(base)) + ' an hour by the same estimate'), a.plan.why);
  assert.equal(a.alts[0].kind, 'community');
  // the same rule inside the narrowing step: Leveling first, Gil second; the sentence names both figures and says it was found by the app
  const l = gilAdvise(inp, { order: ['level', 'gil', 'unlock', 'loot'] });
  assert.equal(l.lead, 'X');
  assert.ok(!/about 0 gil|about 0 an hour/.test(l.plan.why), l.plan.why);
  // the sentence of the narrowing step names the found-by-the-app route and the best community figure
  assert.match(l.plan.why, /Then Gil Farming: (about [\d,]+|under 10) gil an hour at merchant prices \(estimate from community drop records/);
});

const bestParts = (rank) => { const cls = D.classes.filter((c) => c.rank <= rank).sort((a, b) => b.rank - a.rank)[0]; return D.parts.filter((p) => p.class === cls.id).sort((a, b) => a.slot - b.slot).map((p) => p.id); };

test('review fix 2: a gil figure under 10 is "under 10", never "about 0"', () => {
  assert.equal(DROPS.fmt.hour(0), 'under 10'); assert.equal(DROPS.fmt.hour(9.4), 'under 10'); assert.equal(DROPS.fmt.voyage(9), 'under 10');
  assert.equal(DROPS.fmt.hour(10), '10'); assert.equal(DROPS.fmt.voyage(149), '100'); assert.equal(DROPS.fmt.hour(5710), '5,710');
  assert.equal(DROPS.fmt.about('under 10'), 'under 10'); assert.equal(DROPS.fmt.about('5,700'), 'about 5,700');
  // in a reason: rank 85, Leveling first, Gil second picks a route near the best experience that earns almost nothing
  const l = gilAdvise({ sub: { rank: 85, parts: bestParts(85) }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 }, { order: ['level', 'gil', 'unlock', 'loot'] });
  assert.ok(l.plan.why.includes('Then Gil Farming: under 10 gil an hour at merchant prices'), l.plan.why);
  for (const x of [l.plan].concat(l.alts)) assert.doesNotMatch(x.why, /about 0\b|about under/, x.why);
});

test('review fix 4: DROPS gives the share of a figure that rests on the second item', () => {
  near(DROPS.route(MINI, [1], { surveillance: 0, retrieval: 99, favor: 3 }).secondShare, 0.5 / 1.5, 1e-12, 'second 0.5: a third');
  assert.equal(DROPS.route(MINI, [1], { surveillance: 0, retrieval: 99, favor: 0 }).secondShare, 0, 'no favor: nothing rests on it');
  const oj = D.commonRoutes.find((c) => c.name === 'Fight Club - OJ').route, r = DROPS.route(D, oj, ADV.stats(TOP, D3_PARTS));
  assert.equal(Math.round(r.secondShare * 100), 45, 'spec 5.2 A7: 45% of the O and J figures');
  assert.equal(gilAdvise(D3_FULL).plan.est.secondShare > 0.4, true);
});

test('review fix 5: the record count is the true smallest over the route\'s sectors, a sector that fell back to pooled counts included', () => {
  const hi = { surveillance: 50, retrieval: 50, favor: 0 };
  assert.equal(DROPS.sector(MINI, 1, hi).have, 25, 'the thin high band: 25 records, though the all-sector counts stood in');
  assert.equal(DROPS.sector(MINI, 1, { surveillance: 10, retrieval: 99, favor: 0 }).have, 90);
  assert.equal(DROPS.sector(MINI, 1, { surveillance: 0, retrieval: 0, favor: 0 }).have, 200);
  assert.equal(DROPS.sector(MINI, 1, null).have, 1000, 'no build: the sector\'s records');
  assert.equal(DROPS.route(MINI, [1], hi).count, 25);
  // the real data with sector O (15) thin in the high band: the route's count is 6, not the other sector's 60 million
  const copy = JSON.parse(JSON.stringify({ breakpoints: D.breakpoints, itemInfo: D.itemInfo, dropRates: D.dropRates }));
  copy.dropRates.sectors['15'].pools.forEach((p) => { p.band[2] = 2; });
  const st = ADV.stats(TOP, D3_PARTS), oj = D.commonRoutes.find((c) => c.name === 'Fight Club - OJ').route;
  const r = DROPS.route(copy, oj, st);
  assert.equal(r.count, 6); assert.ok(r.sectors.some((x) => x.rolls === 0), 'O fell back'); assert.equal(DROPS.route(D, oj, st).count, 60042984, 'untouched data: the smaller of O and J');
  // the advisor says so in the reason of a route through O
  ADV.init(Object.assign({}, D, { dropRates: copy.dropRates }));
  try {
    const a = gilAdvise(D3_FULL);
    for (const x of [a.plan].concat(a.alts)) {
      const want = DROPS.route(copy, x.route, st).count;
      assert.equal(x.est.n, want); assert.ok(x.why.includes('at least ' + DROPS.fmt.count(want) + ' surveys per sector'), x.why);
      if (x.route.includes(15)) { assert.equal(want, 6); assert.equal(x.est.few, true); }
    }
  } finally { ADV.init(D); }
});

test('review fix 7: part tips need a minimum absolute gain besides 5%, and say long durations in hours and minutes', () => {
  assert.equal(ADV.TIP_MIN_GAIN, 200);
  const inp = (rank) => ({ sub: { rank, parts: bestParts(rank) }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 });
  // rank 50 Shark earns about 135 an hour and the best swap adds 19: no tip now; with the floor at 0 the old behaviour returns
  const weak = { sub: { rank: 50, parts: [3, 4, 1, 2] }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
  assert.equal(gilAdvise(weak, { order: ['gil', 'unlock', 'level', 'loot'] }).parts, null);
  try {
    ADV.TIP_MIN_GAIN = 0;
    const old = gilAdvise(weak, { order: ['gil', 'unlock', 'level', 'loot'] }).parts;
    assert.ok(old && old.gilGain < 200 && old.gilTo > 1.05 * old.gilFrom, 'the 5% rule alone let this one through');
  } finally { ADV.TIP_MIN_GAIN = 200; }
  let long = 0, tips = 0;
  for (const [rank] of [[50], [60], [85], [90], [145]]) {
    const a = gilAdvise(inp(rank), { order: ['gil', 'unlock', 'level', 'loot'] }); if (!a.parts) continue;
    tips++;
    assert.ok(a.parts.gilGain >= ADV.TIP_MIN_GAIN && a.parts.gilTo > 1.05 * a.parts.gilFrom, a.parts.why);
    const m = /: (?:(\d+) hours?(?: (\d+) minutes?)?|(\d+) minutes?) (faster|slower)/.exec(a.parts.why);
    assert.ok(m, a.parts.why);
    if (m[1]) { long++; assert.ok(+m[1] * 60 + (+m[2] || 0) >= 90, a.parts.why); } else assert.ok(+m[3] < 90, a.parts.why);
    assert.doesNotMatch(a.parts.why, /\b(9\d|[1-9]\d\d+) minutes/, a.parts.why);
  }
  assert.ok(tips > 0 && long > 0, 'some tips are shown and some are long: ' + tips + ', ' + long);
  assert.match(gilAdvise(inp(85), { order: ['gil', 'unlock', 'level', 'loot'] }).parts.why, /: \d+ hours?( \d+ minutes?)? faster;/);
});

test('review fix 1: cost of the app-found search in every sea (route evaluations and time per submarine, everything found, Gil first)', () => {
  for (const [rank, limit] of [[60, 14000], [85, 22000], [145, 45000]]) {
    ADV.init(D); // a cold start: the search shared between submarines is empty
    const t0 = Date.now(); gilAdvise({ sub: { rank, parts: bestParts(rank) }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 }, { order: ['gil', 'unlock', 'level', 'loot'] });
    console.log('cost: rank %d, everything found, Gil first: %d route evaluations, %d ms', rank, ADV.lastEvals, Date.now() - t0);
    assert.ok(ADV.lastEvals > 0 && ADV.lastEvals <= limit, 'evaluations ' + ADV.lastEvals); assert.ok(Date.now() - t0 < 5000);
  }
});


test('first Board draw: 8 free companies x 4 rank-145 submarines, everything found, Gil first: the search is shared, at most 60,000 route evaluations in total (80,000 with fuel on); the plans equal fresh searches', () => {
  const run = (parts, rank) => gilAdvise({ sub: { rank, parts }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 }, { order: ['gil', 'unlock', 'level', 'loot'] });
  for (const fuel of [false, true]) {
    ADV.init(D); // empties the shared search cache: a cold start
    let total = 0; const t0 = Date.now(), plans = [];
    for (let i = 0; i < 32; i++) {
      const a = gilAdvise({ sub: { rank: 145, parts: bestParts(145) }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 }, { order: ['gil', 'unlock', 'level', 'loot'], fuel });
      total += ADV.lastEvals; plans.push(JSON.stringify(a));
    }
    console.log('first Board, 32 submarines, fuel %s: %d route evaluations, %d ms', fuel, total, Date.now() - t0);
    assert.ok(total > 0 && total <= (fuel ? 80000 : 60000), 'evaluations ' + total);
    assert.ok(plans.every((x) => x === plans[0]));
    ADV.init(D); const fresh = JSON.stringify(gilAdvise({ sub: { rank: 145, parts: bestParts(145) }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 }, { order: ['gil', 'unlock', 'level', 'loot'], fuel }));
    assert.equal(plans[0], fresh);
  }
  // different builds, ranks and seas never share an answer: each equals the answer of a cold start
  for (const [rank, parts] of [[60, bestParts(60)], [85, bestParts(85)], [145, [3, 4, 1, 2]]]) {
    const warm = JSON.stringify(run(parts, rank)); ADV.init(D); assert.equal(warm, JSON.stringify(run(parts, rank)));
  }
});

test('D3 (Q4): the factor is one named constant and the rule moves with it', () => {
  assert.equal(ADV.DERIVED_FACTOR, 2);
  const parts = (() => { const cls = D.classes.filter((c) => c.rank <= 60).sort((a, b) => b.rank - a.rank)[0]; return D.parts.filter((p) => p.class === cls.id).sort((a, b) => a.slot - b.slot).map((p) => p.id); })();
  const inp = { sub: { rank: 60, parts }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
  try {
    ADV.DERIVED_FACTOR = 1e9; // nothing is ever "so much better": community routes always lead
    assert.equal(gilAdvise(inp, { order: ['gil', 'unlock', 'level', 'loot'] }).plan.kind, 'community');
  } finally { ADV.DERIVED_FACTOR = 2; }
  assert.equal(gilAdvise(inp, { order: ['gil', 'unlock', 'level', 'loot'] }).plan.kind, 'derived');
});

test('D3: the own log (owner decision Q3): 10 voyages replace the estimate for that route only, both figures shown, the reason says which decided', () => {
  const base = gilAdvise(D3_FULL), rank = communityRanking(D3_FULL), st = ADV.stats(TOP, D3_PARTS);
  const hours = (r) => ADV.evalRoute(r, st).seconds / 3600;
  // a log on a route that is not a community route does not change the plan; nothing else changes
  const far = gilAdvise(Object.assign({}, D3_FULL, { logged: [LOGGED_ROW([1, 2], 30, 5e6)], enough: 10 }));
  assert.deepEqual(far.plan.route, base.plan.route);
  // fewer than 10 logged voyages: shown as "n of 10", the estimate decides
  const nine = gilAdvise(Object.assign({}, D3_FULL, { logged: [LOGGED_ROW(base.plan.route, 9, 5e6)], enough: 10 }));
  assert.deepEqual(nine.plan.route, base.plan.route);
  assert.ok(nine.plan.why.includes('Your own log on this route: 9 of 10 logged voyages; the estimate decides until then.'), nine.plan.why);
  // a log close to the estimate: the plan keeps the route, both figures are in the reason and the log decided
  const same = LOGGED_ROW(base.plan.route, 12, base.plan.est.gil * 1.01);
  const s = gilAdvise(Object.assign({}, D3_FULL, { logged: [same], enough: 10 }));
  assert.deepEqual(s.plan.route, base.plan.route); assert.equal(s.plan.own, true);
  assert.ok(s.plan.why.includes('Your own log on this route: about ' + DROPS.fmt.hour(same.merchantPerTrip / hours(base.plan.route)) + ' gil an hour at merchant prices over 12 logged voyages'), s.plan.why);
  assert.ok(s.plan.why.includes('the community estimate is about ' + DROPS.fmt.hour(base.plan.est.perHour) + ' an hour. Your own log decided'), s.plan.why);
  // a much better own figure on a lower route lifts it to the plan; a much worse one on the best route lowers it
  const lower = rank[2], up = LOGGED_ROW(lower.route, 14, lower.est.gil * 3);
  const lifted = gilAdvise(Object.assign({}, D3_FULL, { logged: [up], enough: 10 }));
  assert.deepEqual(lifted.plan.route, lower.route); assert.equal(lifted.plan.kind, 'community'); assert.match(lifted.plan.why, /Your own log decided/);
  assert.ok(lifted.plan.why.includes('the community estimate is about ' + DROPS.fmt.hour(lower.estPerHour) + ' an hour'));
  const down = LOGGED_ROW(base.plan.route, 11, 1000);
  const lowered = gilAdvise(Object.assign({}, D3_FULL, { logged: [down], enough: 10 }));
  assert.notDeepEqual(lowered.plan.route, base.plan.route);
  // the plan is the argmax of the figures, whichever mix of logged and estimated routes
  for (const logs of [[up], [down], [up, down], [LOGGED_ROW(rank[1].route, 10, 0)]]) {
    const r = communityRanking(D3_FULL, logs), a = gilAdvise(Object.assign({}, D3_FULL, { logged: logs, enough: 10 }));
    assert.deepEqual(a.plan.route, r[0].route, JSON.stringify(logs.map((l) => l.route.join('>') + ':' + l.merchantPerTrip)));
  }
  // a log that cannot be counted in merchant gil: the estimate decides for that route and the reason says so
  const unk = gilAdvise(Object.assign({}, D3_FULL, { logged: [LOGGED_ROW(base.plan.route, 12, null)], enough: 10 }));
  assert.deepEqual(unk.plan.route, base.plan.route); assert.ok(!unk.plan.own);
  assert.ok(unk.plan.why.includes('cannot be counted in merchant gil') && unk.plan.why.includes('so the estimate decided for it'), unk.plan.why);
  for (const a of [far, nine, s, lifted, lowered, unk]) noStarsText(a);
});

test('D3: fuel on with Gil leading narrows by estimated gil per tank; the evaluation bound holds', () => {
  const rank = communityRanking(D3_FULL), giveUp = 25;
  const a = gilAdvise(D3_FULL, { fuel: true, giveUp });
  assert.equal(a.lead, 'G'); assert.equal(a.fuel, true);
  const best = rank[0].perHour, inBand = rank.filter((r) => r.perHour >= (1 - giveUp / 100) * best - 1e-9 * best), bestE = Math.max(...inBand.map((r) => r.est.gil / r.tanks));
  const mine = rank.find((r) => r.route.join() === a.plan.route.join());
  assert.ok(mine && mine.perHour >= (1 - giveUp / 100) * best - 1e-9 * best, 'inside the allowance');
  assert.ok(mine.est.gil / mine.tanks >= 0.95 * bestE - 1e-9 * bestE, 'within 5% of the best gil per tank');
  assert.match(a.plan.why, /Fuel efficiency/); noStarsText(a);
  assert.ok(ADV.lastEvals > 0 && ADV.lastEvals <= 92000, 'evaluations ' + ADV.lastEvals);
  gilAdvise(D3_FULL); assert.ok(ADV.lastEvals <= 92000, 'evaluations ' + ADV.lastEvals);
  gilAdvise(D3_FULL, { fuel: true }); assert.ok(ADV.lastEvals <= 92000);
});

test('D3: Gil later in the order: it narrows within 5% with community routes only; the figure is an estimate', () => {
  const a = gilAdvise(Object.assign({}, D3_FULL, { sub: { rank: 60, parts: SHARK }, fc: { unlockedSlots: 4, discovered: [13, 18, 15, 10, 26] } }), { order: ['level', 'gil', 'unlock', 'loot'] });
  assert.equal(a.lead, 'X');
  for (const t of a.plan.why.match(/Then Gil Farming: [^.]*\./g) || []) assert.match(t, /^Then Gil Farming: about [\d,]+ gil an hour at merchant prices \((estimate from community drop records|your own log)\)\.$/);
  noStarsText(a);
});

// ---- D4: the top rank
test('D4: at the top rank, with the default order and everything found, Gil leads and the reason names the skipped Leveling with the rank from the data', () => {
  assert.equal(TOP, D.ranks[D.ranks.length - 1].rank);
  const a = gilAdvise(D3_FULL);
  assert.equal(a.lead, 'G'); assert.equal(a.plan.kind, 'community');
  assert.ok(a.plan.why.includes(`Skipped Leveling Submersible Rank: this submarine is at rank ${TOP}, the top rank.`), a.plan.why);
  assert.equal(a.skipped.find((x) => x.key === 'X').reason, `this submarine is at rank ${TOP}, the top rank`);
  // Leveling first: the same lead, plan and reason
  const l = gilAdvise(D3_FULL, { order: ['level', 'unlock', 'gil', 'loot'] });
  assert.equal(l.lead, 'G'); assert.deepEqual(l.plan.route, a.plan.route);
  assert.ok(l.plan.why.includes(`Skipped Leveling Submersible Rank: this submarine is at rank ${TOP}, the top rank.`), l.plan.why);
  // the next rank down: Leveling is not skipped, with the same save
  const below = gilAdvise(Object.assign({}, D3_FULL, { sub: { rank: TOP - 1, parts: D3_PARTS } }), { order: ['level', 'unlock', 'gil', 'loot'] });
  assert.equal(below.lead, 'X'); assert.ok(!/top rank/.test(below.plan.why), below.plan.why);
  const belowDefault = gilAdvise(Object.assign({}, D3_FULL, { sub: { rank: TOP - 1, parts: D3_PARTS } }));
  assert.equal(belowDefault.lead, 'X', 'default order: levelling before gil below the top rank, as before');
});

test('D4: a top-rank submarine that can still reveal a sector explores first (the case of spec 6.2: H found, K and M not), then farms gil', () => {
  const letter = (L) => D.sectors.find((s) => s.sea === 7 && s.letter === L).id, H = letter('H'), K = letter('K'), M = letter('M');
  assert.equal(SECTOR.get(H).rank, 141); assert.deepEqual(CHILDREN(H).sort(), [K, M].sort());
  const found = ALL.filter((id) => id !== K && id !== M), inp = (rank) => ({ sub: { rank, parts: D3_PARTS }, fc: { unlockedSlots: 4, discovered: found }, slotsFilled: 4 });
  const top = gilAdvise(inp(TOP));
  assert.equal(top.lead, 'U2'); assert.ok(top.plan.route.includes(H), 'the plan surveys H');
  assert.match(top.plan.why, /^Can reveal 2 new sectors/);
  assert.equal(top.skipped.find((x) => x.key === 'X').reason, `this submarine is at rank ${TOP}, the top rank`);
  // Leveling first at the top rank: Unlocking still leads, and Leveling is named as skipped
  const lvl = gilAdvise(inp(TOP), { order: ['level', 'unlock', 'gil', 'loot'] });
  assert.equal(lvl.lead, 'U2'); assert.ok(lvl.plan.route.includes(H)); assert.ok(lvl.plan.why.includes(`Skipped Leveling Submersible Rank: this submarine is at rank ${TOP}, the top rank.`));
  // one rank down, Leveling first: Leveling leads, as before
  const down = gilAdvise(inp(TOP - 1), { order: ['level', 'unlock', 'gil', 'loot'] });
  assert.equal(down.lead, 'X');
  // once K and M are found, the same submarine farms gil
  assert.equal(gilAdvise(Object.assign({}, inp(TOP), { fc: { unlockedSlots: 4, discovered: ALL } })).lead, 'G');
});

test('D4: a top-rank submarine with nothing to reveal and no community route it can run farms a derived route; the top rank is read from the data', () => {
  const north = D.sectors.filter((s) => s.sea === 7).map((s) => s.id);
  const a = gilAdvise({ sub: { rank: TOP, parts: D3_PARTS }, fc: { unlockedSlots: 4, discovered: north }, slotsFilled: 4 });
  assert.equal(a.lead, 'G'); assert.equal(a.plan.kind, 'derived');
  assert.match(a.plan.why, /^No community gil route can be run by this submarine now \(sectors not found\)\./);
  assert.ok(a.plan.why.includes(`Skipped Leveling Submersible Rank: this submarine is at rank ${TOP}, the top rank.`));
  assert.equal(ADV.top(), TOP);
});

// ---------------------------------------------------------------- D5: Loot Farming with rates (spec 6.3, owner decisions)
const D5_FOUND = [13, 18, 15, 10, 26]; // M, R, O, J, Z: one sea, five sectors, every order of them is a candidate
const D5_BEST = [31, 24, 25, 34];
const D5_IN = (rank, parts, loot, order) => ({ sub: { rank, parts }, fc: { unlockedSlots: 4, discovered: D5_FOUND }, slotsFilled: 4, recs: withRecs({ order: order || ['loot', 'unlock', 'level', 'gil'], loot }) });
// an independent reading of 6.3: every order of 1 to 5 sectors, expected quantity per hour of each item (DROPS), shares of the best, added
function d5Brute(rank, parts, ids) {
  const st = ADV.stats(rank, parts), pool = D.sectors.filter((s) => D5_FOUND.includes(s.id) && s.rank <= rank), routes = [];
  (function walk(r) {
    if (r.length >= 5) return;
    for (const s of pool) { if (r.includes(s.id)) continue; const n = r.concat(s.id), ev = ADV.evalRoute(n, st); if (!ev || !ev.reachable) continue; routes.push({ route: n, ev, per: Object.fromEntries(ids.map((id) => [id, (DROPS.route(D, n, st).items[id] || 0) / (ev.seconds / 3600)])) }); walk(n); }
  })([]);
  const best = Object.fromEntries(ids.map((id) => [id, Math.max(...routes.map((r) => r.per[id]))]));
  const score = (r) => ids.reduce((t, id) => t + (best[id] > 0 ? r.per[id] / best[id] : 0), 0);
  return { routes, best, score, top: Math.max(...routes.map(score)), of: (route) => routes.find((r) => r.route.join() === route.join()) };
}

test('D5: one chosen item: the plan is the route with the highest expected quantity an hour (within the 5% band the next priority narrows)', () => {
  for (const id of [22506, 5192]) { // Extravagant Salvaged Earring (tier 3), Sapphire (tier 1)
    const a = ADV.advise(D5_IN(145, D5_BEST, [[id, true], [0, false], [0, false], [0, false], [0, false]]));
    const b = d5Brute(145, D5_BEST, [id]), mine = b.of(a.plan.route);
    assert.equal(a.lead, 'L'); assert.ok(mine, 'the plan is a route of the pool');
    assert.ok(b.score(mine) >= 0.95 * b.top - 1e-9 && b.top > 0, 'item ' + id + ': ' + b.score(mine) + ' vs ' + b.top);
    assert.ok(a.plan.why.startsWith('Expected: about ') && a.plan.why.includes(D.items[id]), a.plan.why);
    assert.match(a.plan.why, /\(estimate from community drop records, at least [\d,.]+( million)? surveys per sector\)\./);
    assert.match(a.plan.why, /What the second item of a survey is, is not in the records/);
  }
});

test('D5: two chosen items: the score is the sum of each item\'s share of the best', () => {
  const ids = [22506, 5192], a = ADV.advise(D5_IN(145, D5_BEST, [[ids[0], true], [ids[1], true], [0, false], [0, false], [0, false]]));
  const b = d5Brute(145, D5_BEST, ids), mine = b.of(a.plan.route);
  assert.equal(a.lead, 'L'); assert.ok(b.score(mine) >= 0.95 * b.top - 1e-9, b.score(mine) + ' vs ' + b.top);
  // the sum of shares is not the share of either item alone: neither single-item best route need serve both
  const s0 = b.routes.reduce((m, r) => (r.per[ids[0]] > m.per[ids[0]] ? r : m)), s1 = b.routes.reduce((m, r) => (r.per[ids[1]] > m.per[ids[1]] ? r : m));
  assert.ok(b.score(s0) <= b.top + 1e-9 && b.score(s1) <= b.top + 1e-9);
  assert.ok(b.top < 2 + 1e-9 && b.top >= Math.max(b.score(s0), b.score(s1)) - 1e-9);
  assert.match(a.plan.why, /^Expected: about [\d.]+ .+ an hour, [\d.]+ .+ an hour \(estimate/);
  assert.ok(a.plan.why.includes(D.items[ids[0]]) && a.plan.why.includes(D.items[ids[1]]));
});

test('D5: a tier 3 item with surveillance below the tier 3 threshold is out of reach and gives the skip sentence', () => {
  const need = Math.min(...D5_FOUND.map((id) => D.breakpoints[id][1]));
  const weakSt = ADV.stats(85, SHARK), strongSt = ADV.stats(85, [3, 4, 5, 14]);
  assert.ok(weakSt.surveillance < need && strongSt.surveillance >= need, 'the two builds straddle the threshold');
  const loot = [[22507, true], [0, false], [0, false], [0, false], [0, false]]; // Extravagant Salvaged Necklace: tier 3 only
  const weak = ADV.advise(D5_IN(85, SHARK, loot));
  assert.match(weak.skipped.find((x) => x.key === 'L').reason, /^none of your chosen items has a recorded drop this submarine can reach now$/);
  assert.notEqual(weak.lead, 'L'); assert.match(weak.plan.why, /Skipped Loot Farming: none of your chosen items has a recorded drop this submarine can reach now\./);
  const strong = ADV.advise(D5_IN(85, [3, 4, 5, 14], loot));
  assert.equal(strong.lead, 'L'); assert.ok(strong.plan.why.includes('Extravagant Salvaged Necklace'));
  // an item that is only listed as possible (no drop record) adds nothing; the plan says so
  const spectacles = R3_ITEMS.find((i) => !D.dropRates.sectors[15].pools.some((pl) => pl.items.some((r) => r[0] === i.id)) && !Object.values(D.dropRates.sectors).some((sc) => sc.pools.some((pl) => pl.items.some((r) => r[0] === i.id))));
  assert.ok(spectacles, 'the data has a loot item without any drop record');
  const only = ADV.advise(Object.assign(D5_IN(145, D5_BEST, [[spectacles.id, true], [0, false], [0, false], [0, false], [0, false]]), {}));
  assert.notEqual(only.lead, 'L');
});

test('D5: no reason, note or source text says drop odds are not known or possible items only', () => {
  const src = ['advisor.js', 'subs.js', 'recs.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', f), 'utf8')).join('\n');
  assert.ok(!/drop odds are not known|possible items only|no drop odds/.test(src));
  const a = ADV.advise(D5_IN(145, D5_BEST, [[22506, true], [5192, true], [0, false], [0, false], [0, false]]));
  for (const x of [a.plan].concat(a.alts)) assert.ok(!/drop odds are not known|possible items only/.test(x.why), x.why);
});

// ---------------------------------------------------------------- D6: part advice by the community estimate (spec 6.4)
const D6_IN = (rank, parts) => ({ sub: { rank, parts }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4, recs: withRecs({ order: ['gil', 'unlock', 'level', 'loot'] }) });
const D6_SLOT = (i, rank) => D.parts.filter((p) => p.slot === i && D.classes.find((c) => c.id === p.class).rank <= rank);
// every swap the rank allows, valued independently by DROPS on the advised route: { slot, to, g, reachable }
function d6Swaps(rank, parts, route) {
  const st = ADV.stats(rank, parts), ev0 = ADV.evalRoute(route, st), cur = DROPS.perHour(DROPS.route(D, route, st).gil, ev0.seconds), out = [];
  for (let i = 0; i < 4; i++) for (const p of D6_SLOT(i, rank)) {
    if (p.id === parts[i]) continue;
    const np = parts.slice(); np[i] = p.id;
    const s2 = ADV.stats(rank, np), ev = ADV.evalRoute(route, s2);
    out.push({ slot: i, to: p.id, g: DROPS.perHour(DROPS.route(D, route, s2).gil, ev.seconds), reachable: ev.reachable, lowers: ['surveillance', 'retrieval', 'favor'].some((k) => PART.get(p.id)[k] < PART.get(parts[i])[k]) });
  }
  return { cur, out };
}

test('D6: the rank-85 build on OJ: a swap that lifts retrieval to 160 is advised and names the threshold', () => {
  const a = ADV.advise(D6_IN(85, [3, 4, 5, 14]));
  assert.equal(a.lead, 'G'); assert.deepEqual(a.plan.route, [15, 10]);
  const { cur, out } = d6Swaps(85, [3, 4, 5, 14], [15, 10]);
  const best = out.filter((x) => x.reachable && x.g > cur * 1.05).sort((x, y) => y.g - x.g)[0];
  assert.equal(a.parts.to, best.to); assert.equal(a.parts.slot, best.slot);
  assert.equal(a.parts.to, 31, 'the Whale-class hull (retrieval 173 against 148 now)');
  assert.match(a.parts.why, /Swapping the hull for Modified Whale-class Pressure Hull is estimated to give about \+[\d,]+ gil an hour on this route \(estimate from community drop records, at merchant prices\): \d+ minutes faster; retrieval becomes optimal at O \(160 needed, 148 now\)\./);
  assert.match(a.parts.why, /Above a threshold, extra surveillance, retrieval or favor is counted as worth nothing: the community's reading, not confirmed\./);
  assert.equal(a.parts.estimate, true);
});

test('D6: a swap that lowers a stat but keeps every threshold is advised when it gains more than 5%, and says so', () => {
  const parts = [27, 28, 33, 6], a = ADV.advise(D6_IN(145, parts));
  assert.equal(a.lead, 'G'); assert.ok(a.parts);
  const old = PART.get(a.parts.from), nw = PART.get(a.parts.to);
  assert.ok(nw.surveillance < old.surveillance, 'the chosen swap lowers surveillance (the old rule refused it)');
  const { cur, out } = d6Swaps(145, parts, a.plan.route), mine = out.find((x) => x.slot === a.parts.slot && x.to === a.parts.to);
  assert.ok(mine.g > cur * 1.05);
  assert.match(a.parts.why, /surveillance, retrieval and favor stay above every threshold of this route\./);
  assert.match(a.parts.why, /counted as worth nothing/);
});

test('D6: a gain under 5% gives no tip, and a swap that breaks the range is never advised', () => {
  // the best build: no swap gains 5%
  const top = ADV.advise(D6_IN(145, D5_BEST));
  assert.equal(top.parts, null);
  const t = d6Swaps(145, D5_BEST, top.plan.route); assert.ok(t.out.every((x) => !(x.g > t.cur * 1.05)));
  // a build where the swaps that would gain more than 5% all break the range, and the reachable ones gain less
  const a = ADV.advise(D6_IN(85, [39, 16, 25, 10])), s = d6Swaps(85, [39, 16, 25, 10], a.plan.route);
  assert.ok(s.out.some((x) => !x.reachable && x.g > s.cur * 1.05), 'a tempting swap exists but leaves the range');
  assert.ok(s.out.filter((x) => x.reachable).every((x) => !(x.g > s.cur * 1.05)));
  assert.equal(a.parts, null);
  // another build: the tip is the best reachable swap although an unreachable one would gain more
  const b = ADV.advise(D6_IN(85, [39, 16, 37, 10])), u = d6Swaps(85, [39, 16, 37, 10], b.plan.route);
  const bestAny = u.out.slice().sort((x, y) => y.g - x.g)[0], bestOk = u.out.filter((x) => x.reachable).sort((x, y) => y.g - x.g)[0];
  assert.ok(!bestAny.reachable && b.parts.to === bestOk.to && b.parts.slot === bestOk.slot);
  assert.ok(ADV.evalRoute(b.plan.route, ADV.stats(85, b.parts.slot === 0 ? [b.parts.to, 16, 37, 10] : b.parts.slot === 1 ? [39, b.parts.to, 37, 10] : b.parts.slot === 2 ? [39, 16, b.parts.to, 10] : [39, 16, 37, b.parts.to])).reachable);
});

test('D6: a non-gil lead never carries a gil tip; without settings the S6 tip is unchanged', () => {
  for (const order of [['level', 'unlock', 'gil', 'loot'], ['loot', 'unlock', 'level', 'gil']]) {
    const a = ADV.advise(Object.assign(D6_IN(85, [3, 4, 5, 14]), { recs: withRecs({ order, loot: R3_LOOT(22506) }) }));
    assert.notEqual(a.lead, 'G');
    assert.ok(a.parts === null || (a.parts.gilGain === undefined && a.parts.estimate === undefined), order[0]);
  }
  const plain = ADV.advise({ sub: { rank: 145, parts: SHARK }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4, logged: [R3_LOGGED([1, 2], 14, 412000)], enough: 10 });
  assert.ok(plain.parts && plain.parts.estimate === undefined && /own log/.test(plain.parts.why));
});

// ---------------------------------------------------------------- W23: the chart's link classes (colour only; chart.js adds classes, no element)
const linesOf = (svg) => [...svg.match(/<g class="chart-lines"[^>]*>(.*?)<\/g>/)[1].matchAll(/<line class="([^"]*)" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"\/>/g)].map((m) => ({ cls: m[1].split(' '), pts: [+m[2], +m[3], +m[4], +m[5]] }));
const chevsOf = (svg) => [...svg.match(/<g class="chart-chevs"[^>]*>(.*?)<\/g>/)[1].matchAll(/<path class="([^"]*)"/g)].map((m) => m[1].split(' '));
test('chart W23: every line has exactly one of open and closed; done and lead only with open, never both; chevrons carry the same classes', () => {
  for (const sea of D.seas) for (const found of [[], [1], [1, 2, 3], D.sectors.filter((s) => s.sea === sea.id).slice(0, 5).map((s) => s.id), D.sectors.filter((s) => s.sea === sea.id).map((s) => s.id)]) {
    const v = CH.view(sea.id, found), svg = CH.svg(v), ls = linesOf(svg), cv = chevsOf(svg);
    assert.equal(ls.length, v.lines.length); assert.equal(cv.length, v.lines.length);
    ls.forEach((l, i) => {
      assert.equal(l.cls.filter((c) => c === 'open' || c === 'closed').length, 1);
      if (l.cls.includes('done') || l.cls.includes('lead')) assert.ok(l.cls.includes('open'));
      assert.ok(!(l.cls.includes('done') && l.cls.includes('lead')));
      const ok = (x) => ['open', 'closed', 'done', 'lead', 'goal'].includes(x); assert.ok(l.cls.every(ok));
      assert.deepEqual(cv[i], ['chart-chev'].concat(l.cls), 'chevron ' + i + ' has the line\'s classes');
      const from = found.includes(v.lines[i].from), to = found.includes(v.lines[i].to);
      assert.equal(l.cls.includes('open'), from); assert.equal(l.cls.includes('done'), from && to); assert.equal(l.cls.includes('lead'), from && !to);
    });
  }
});
test('chart W23: the goal links are the chain from each unfound slot or next-sea sector back to the first found one, walked over the data\'s unlock links', () => {
  const slotSector = new Set(D.subSlots.map((u) => u.sector));
  for (const sea of D.seas) {
    const secs = D.sectors.filter((s) => s.sea === sea.id);
    for (const found of [[], [1, 2, 3], secs.slice(0, 5).map((s) => s.id), secs.slice(0, 12).map((s) => s.id)]) {
      const f = new Set(found), want = new Set();
      for (const s of secs) {
        const u = D.unlocks[s.id] || {};
        if ((slotSector.has(s.id) || u.opensSea) && !f.has(s.id)) for (let id = s.id, n = 0; id != null && SECTOR_BY[id] && SECTOR_BY[id].sea === sea.id && !f.has(id) && n < 64; n++) { want.add(id); id = (D.unlocks[id] || {}).by; }
      }
      const v = CH.view(sea.id, found), ls = linesOf(CH.svg(v));
      v.lines.forEach((l, i) => assert.equal(ls[i].cls.includes('goal'), want.has(l.to), 'sea ' + sea.id + ' found ' + found + ' line to ' + l.to));
    }
  }
  // the first sea with 15 found and 20 not: the way to slot 4 and to the next sea
  const v = CH.view(1, [1, 2, 3, 10, 15]), ls = linesOf(CH.svg(v));
  assert.ok(ls.some((l) => l.cls.includes('goal')) && ls.some((l) => l.cls.includes('lead')));
  assert.ok(ls.some((l) => l.cls.includes('goal') && l.cls.includes('lead')), 'the link from the found sector to the way is both');
});
const SECTOR_BY = Object.fromEntries(D.sectors.map((s) => [s.id, s]));
test('chart W23: with every sector found there is no goal and no lead; svg called twice gives the same string', () => {
  for (const sea of D.seas) {
    const all = D.sectors.filter((s) => s.sea === sea.id).map((s) => s.id), v = CH.view(sea.id, all), svg = CH.svg(v, [all[0]], { selected: all[0] });
    assert.ok(!/class="[^"]*\b(goal|lead)\b/.test(svg.slice(svg.indexOf('chart-lines'), svg.indexOf('chart-route-glow') > 0 ? svg.indexOf('chart-route-glow') : svg.indexOf('chart-start'))), 'sea ' + sea.id);
    assert.equal(svg, CH.svg(v, [all[0]], { selected: all[0] }));
  }
  const v = CH.view(1, [1, 2, 3, 10, 15]); assert.equal(CH.svg(v, [1, 3]), CH.svg(v, [1, 3]));
});

// ---------------------------------------------------------------- gaps spec Part A: G2, G4, G5, G6
const GAPS_PARTS = [3, 4, 1, 2]; // rank 30 Shark build, as the planner check uses
test('G2: a sector that cannot be added says why: the rank, not found yet, or the range the route would need (the planner\'s own evaluation)', () => {
  const sub = { rank: 30, parts: GAPS_PARTS }, st = ADV.stats(30, GAPS_PARTS), found = [1, 2, 3, 4, 5, 6, 7, 10, 15, 18, 26];
  // the rank: sector 26 needs rank 50 (the planner check seeds it)
  const hi = D.sectors.find((x) => x.rank > 30 && found.includes(x.id)) || null;
  const over = D.sectors.find((x) => x.rank > 30);
  assert.deepEqual(ADV.cannotAdd(sub, found, [], over.id), { kind: 'rank', text: `Rank ${over.rank} needed (this submarine is rank 30)` });
  // not found yet (a sector within the rank that is not ticked)
  const lost = D.sectors.find((x) => x.rank <= 30 && !found.includes(x.id));
  assert.deepEqual(ADV.cannotAdd(sub, found, [], lost.id), { kind: 'unfound', text: 'Not found yet' });
  // the rank comes before "not found" when both apply
  assert.equal(ADV.cannotAdd(sub, [], [], over.id).kind, 'rank');
  // the range: the number is the range the route would use with the sector added, minus the build's range, from evalRoute
  let seen = 0, near = 0;
  const weakParts = [0, 1, 2, 3].map((sl) => D.parts.filter((p) => p.slot === sl && D.classes.find((c) => c.id === p.class).rank <= 60).sort((x, y) => x.range - y.range)[0].id);
  const wsub = { rank: 60, parts: weakParts }, wst = ADV.stats(60, weakParts);
  for (const sea of D.seas) {
    const ids = D.sectors.filter((x) => x.sea === sea.id && x.rank <= 60).map((x) => x.id);
    for (const base of [[], ids.slice(0, 2), ids.slice(0, 4)]) for (const id of ids) {
      if (base.includes(id) || base.length >= 5) continue;
      const ev = ADV.evalRoute(base.concat(id), wst), w = ADV.cannotAdd(wsub, ids, base, id);
      if (ev.reachable) assert.equal(w, null);
      else {
        seen++; assert.equal(w.kind, 'range'); assert.equal(w.need, ev.range - wst.range); assert.ok(w.need > 0);
        assert.equal(w.alone, !ADV.evalRoute([id], wst).reachable); if (w.alone) near++;
        assert.equal(w.text, 'Needs range ' + w.need + ' more' + (w.alone ? ' (out of range from Start even on its own)' : ''));
      }
    }
  }
  assert.ok(seen > 0 && near > 0, 'some sector is out of range for this build, some even alone');
  // a sector already on the route, a full route and a missing build give no reason of their own
  assert.equal(ADV.cannotAdd(sub, found, [1], 1), null);
  assert.equal(ADV.cannotAdd(sub, found, [1, 2, 3, 4, 5], 6), null);
  assert.equal(ADV.cannotAdd({ rank: 30, parts: [null, null, null, null] }, found, [], 6), null);
  assert.ok(hi === null || ADV.cannotAdd(sub, found, [], hi.id).kind === 'rank');
});

test('G4: each other route says how it differs from the plan on the deciding measure and on return time', () => {
  const c = ADV.altClause(112, 100, 10 * 3600 + 5 * 3600, 10 * 3600, 'experience an hour');
  assert.equal(c.text, '12% more experience an hour, back 5 h later'); assert.equal(c.pct, 12); assert.equal(c.seconds, 5 * 3600);
  assert.equal(ADV.altClause(92, 100, 7 * 3600, 10 * 3600, 'gil an hour').text, '8% less gil an hour, back 3 h sooner');
  assert.equal(ADV.altClause(100, 100, 3600, 3600 + 20, 'gil an hour').text, 'about the same gil an hour, back at about the same time');
  assert.equal(ADV.altClause(50, 100, 3600 + 40 * 60, 3600, 'gil an hour').text, '50% less gil an hour, back 40 min later');
  // on a real advice: every other route carries the clause, worked out from its own figures and the plan's
  const a = ADV.advise({ sub: { rank: 60, parts: bestParts(60) }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4, recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'] }) });
  assert.equal(a.lead, 'X'); assert.ok(a.alts.length > 0);
  for (const x of a.alts) {
    const want = ADV.altClause((x.ev.exp / (x.ev.seconds / 3600)), (a.plan.ev.exp / (a.plan.ev.seconds / 3600)), x.ev.seconds, a.plan.ev.seconds, 'experience an hour');
    assert.deepEqual(x.vs, want); assert.match(x.vs.text, /experience an hour, back /);
  }
  // Gil Farming compares the estimates; a plain advice (no settings) has no clause
  const g = ADV.advise(D6_IN(85, [3, 4, 5, 14]));
  assert.equal(g.lead, 'G');
  for (const x of g.alts) { assert.match(x.vs.text, /gil an hour, back /); assert.equal(x.vs.pct, Math.round((x.est.perHour / g.plan.est.perHour - 1) * 100)); }
  for (const x of ADV.advise({ sub: { rank: 60, parts: bestParts(60) }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 }).alts) assert.equal(x.vs, undefined);
});

test('G5: with nothing discovered in range, the one part change that brings the most discovered sectors into range is named (a calculation, if the player has or crafts the part)', () => {
  // a build with the weakest range in every slot, a rank that allows better parts, and the nearest sectors found
  const weak = [0, 1, 2, 3].map((sl) => D.parts.filter((p) => p.slot === sl && D.classes.find((c) => c.id === p.class).rank <= 60).sort((x, y) => x.range - y.range)[0].id);
  const rank = 60, st = ADV.stats(rank, weak);
  const far = D.sectors.filter((x) => x.rank <= rank && !ADV.evalRoute([x.id], st).reachable).map((x) => x.id);
  assert.ok(far.length > 0);
  const inp = { sub: { rank, parts: weak }, fc: { unlockedSlots: 4, discovered: far }, slotsFilled: 4 };
  const a = ADV.advise(Object.assign({}, inp, { recs: withRecs({}) }));
  assert.ok(a.blocked && a.parts && a.parts.count > 0, 'a swap brings something into range');
  // brute force over every single swap the rank allows
  let bestCount = 0, bestAt = null;
  for (let i = 0; i < 4; i++) for (const p of D.parts.slice().sort((x, y) => x.id - y.id)) {
    if (p.slot !== i || p.id === weak[i] || D.classes.find((c) => c.id === p.class).rank > rank) continue;
    const np = weak.slice(); np[i] = p.id; const s2 = ADV.stats(rank, np);
    const n = far.filter((id) => ADV.evalRoute([id], s2).reachable).length;
    if (n > bestCount) { bestCount = n; bestAt = { slot: i, to: p.id }; }
  }
  assert.equal(a.parts.count, bestCount); assert.equal(a.parts.slot, bestAt.slot); assert.equal(a.parts.to, bestAt.to);
  assert.match(a.parts.why, /^Calculated: swapping the (hull|stern|bow|bridge) for .+ would bring \d+ discovered sectors? into range \(.+\)\. It applies only if you already have the part or plan to craft it\.$/);
  // no settings: today's answer, no tip
  assert.equal(ADV.advise(inp).parts, undefined);
  // no single swap helps: say so (every discovered sector is too far even for the best range part of this rank)
  const best = ADV.stats(1, SHARK), none = D.sectors.filter((x) => x.rank <= 1 && !ADV.evalRoute([x.id], best).reachable).map((x) => x.id);
  if (none.length) {
    const n = ADV.advise({ sub: { rank: 1, parts: SHARK }, fc: { unlockedSlots: 1, discovered: none }, slotsFilled: 1, recs: withRecs({}) });
    assert.ok(n.blocked); assert.ok(n.parts && n.parts.count === undefined && /no single part change brings a discovered sector into range/.test(n.parts.why));
  }
});

test('G6: part advice only beside a Gil Farming plan (the estimate tip) or in the nothing-in-reach case', () => {
  const base = { sub: { rank: 145, parts: SHARK }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
  for (const order of [['gil', 'unlock', 'level', 'loot'], ['level', 'unlock', 'gil', 'loot'], ['unlock', 'level', 'gil', 'loot'], ['loot', 'unlock', 'level', 'gil']]) {
    const a = ADV.advise(Object.assign({}, base, { recs: withRecs({ order, loot: R3_LOOT(22506) }) }));
    if (a.lead === 'G') assert.ok(a.parts === null || a.parts.estimate === true, order[0]);
    else assert.equal(a.parts, null, order[0] + ' leads ' + a.lead);
  }
  const lv = ADV.advise(Object.assign({}, base, { sub: { rank: 60, parts: SHARK }, recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'] }) }));
  assert.equal(lv.lead, 'X'); assert.equal(lv.parts, null);
  // while unlocking (step 1) there was never a tip, and still none
  assert.equal(ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({}) })).parts, null);
});

// ---------------------------------------------------------------- gaps spec Part B (G8 to G11)
test('G8: the hidden free companies are one flat key each in the settings section; hide and show round-trip; unknown companies are kept and ignored; the advice is untouched', () => {
  assert.equal(RECS.hideKey('f1'), 'hide-f1');
  assert.deepEqual(RECS.hidden(undefined), {}); assert.deepEqual(RECS.hidden({}), {}); assert.deepEqual(RECS.hidden({ choices: [] }), {});
  let raw = RECS.store(null, { 'hide-fa': true });
  assert.deepEqual(RECS.hidden(raw), { fa: true });
  raw = RECS.store(raw, { 'hide-fb': true });
  assert.deepEqual(RECS.hidden(raw), { fa: true, fb: true });
  raw = RECS.store(raw, { 'hide-fa': false });
  assert.deepEqual(RECS.hidden(raw), { fb: true }, 'shown again');
  assert.equal(raw.choices['hide-fa'], false);
  // only exactly true hides; a bare prefix or a wrong type is nothing
  assert.deepEqual(RECS.hidden({ choices: { 'hide-': true, 'hide-x': 1, 'hide-y': 'true', 'hide-z': null, hide: true } }), {});
  // a company that no longer exists: the key stays as stored (store never drops keys) and nothing reads it as a company
  const stale = RECS.store({ choices: { fuel: true, 'hide-gone': true, mystery: 7 } }, { 'hide-fb': true });
  assert.equal(stale.choices['hide-gone'], true); assert.equal(stale.choices.mystery, 7); assert.deepEqual(RECS.hidden(stale), { gone: true, fb: true });
  // hiding changes no recommendation and not the advice cache key
  const was = RECS.check({ choices: { fuel: true, giveUp: 20, order: ['gil', 'unlock', 'level', 'loot'] } }, D), withHide = RECS.check({ choices: { fuel: true, giveUp: 20, order: ['gil', 'unlock', 'level', 'loot'], 'hide-fa': true, 'hide-fb': false } }, D);
  assert.deepEqual(withHide, was); assert.equal(RECS.sig(withHide), RECS.sig(was));
  assert.deepEqual(RECS.check({ choices: { 'hide-fa': true } }, D), RECS.defaults());
  assert.deepEqual(RECS.intent(was, withHide), {}, 'no recommendation patch');
});

test('G8: two pages hiding different free companies both keep their change (the real CC.writeSection merge); the stored section holds no other key', async () => {
  require(path.join(__dirname, '..', 'src', 'core', 'save.js'));
  const CC = globalThis.CC, m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
  CC.resetMemory();
  const NAME = RECS.NAME;
  const first = await CC.writeSection(NAME, { choices: { fuel: true, giveUp: 20 } }, null);
  const page = () => RECS.keeper((section, known) => CC.writeSection(NAME, section, known), () => {});
  const a = page(), b = page();
  a.read(first.section, first.rev); b.read(first.section, first.rev);
  await a.change({ 'hide-fa': true });
  await b.change({ 'hide-fb': true }); // b never saw a's write: the merge keeps both
  const stored = CC.checkDoc((await CC.read()).raw).modules[NAME];
  assert.deepEqual(RECS.hidden(stored), { fa: true, fb: true });
  assert.equal(stored.choices.fuel, true); assert.equal(stored.choices.giveUp, 20);
  // showing one again on one page, hiding another elsewhere
  await a.change({ 'hide-fa': false });
  const again = CC.checkDoc((await CC.read()).raw).modules[NAME];
  assert.deepEqual(RECS.hidden(again), { fb: true });
  delete globalThis.localStorage; CC.resetMemory();
});

test('G9: the rank-up plan: the experience to the top rank from the rank table, and the days at a route (base experience, a floor)', () => {
  const top = ADV.top(), rk = (r) => D.ranks.find((x) => x.rank === r).expToNext;
  assert.equal(ADV.rankUpPlan(top, 0, [1], 3600), null, 'nothing at the top rank');
  assert.equal(ADV.rankUpPlan(0, 0, [1], 3600), null); assert.equal(ADV.rankUpPlan(null, 0, [1], 3600), null);
  const want = (rank, into) => { let n = -into; for (let r = rank; r < top; r++) n += rk(r); return n; };
  assert.equal(ADV.rankUpPlan(1, 0, null, 0).need, want(1, 0)); assert.equal(ADV.rankUpPlan(60, 1234, null, 0).need, want(60, 1234));
  assert.equal(ADV.rankUpPlan(144, 10, null, 0).need, rk(144) - 10);
  const none = ADV.rankUpPlan(60, 0, null, 0); assert.equal(none.perVoyage, null); assert.equal(none.days, null);
  // a progress the game cannot show counts as 0, as everywhere
  assert.equal(ADV.rankUpPlan(60, rk(60), null, 0).need, want(60, 0)); assert.equal(ADV.rankUpPlan(60, -5, null, 0).need, want(60, 0));
  const route = [1, 2], exp = D.sectors.find((x) => x.id === 1).exp + D.sectors.find((x) => x.id === 2).exp, secs = 11 * 3600;
  const p = ADV.rankUpPlan(100, 500, route, secs);
  assert.equal(p.perVoyage, exp); assert.equal(p.voyages, Math.ceil(p.need / exp)); assert.equal(p.days, p.voyages * secs / 86400); assert.equal(p.top, top);
});

test('G11: only undiscovered sectors that a sector on the route can reveal are offered; nothing when none; the unlock table says what a reveal opens or grants', () => {
  // brute force from the table: every sector X with unlocks[X].by on the route and X not discovered
  const brute = (route, disc) => D.sectors.map((x) => x.id).filter((id) => route.includes((D.unlocks[id] || {}).by) && !disc.includes(id));
  for (const [route, disc] of [[[1, 2], [1, 2]], [[1, 2, 3], [1, 2, 3]], [[1], [1, 2, 3, 4]], [[10, 15], [1, 2, 3, 10, 15]], [[28], [1, 2, 28]], [[70, 47, 28], [28, 47, 70]], [[], [1]], [[4, 5, 6, 7, 8], [4, 5, 6, 7, 8]]]) {
    assert.deepEqual([...ADV.revealable(route, disc)].sort((a, b) => a - b), brute(route, disc).sort((x, y) => x - y), JSON.stringify([route, disc]));
    assert.deepEqual(ADV.revealable(route, new Set(disc)), ADV.revealable(route, disc), 'an array or a Set');
    for (const id of ADV.revealable(route, disc)) assert.ok(!disc.includes(id) && route.includes(D.unlocks[id].by));
  }
  const every = D.sectors.map((x) => x.id);
  assert.deepEqual(ADV.revealable([1, 2, 3, 28], every), [], 'with everything found there is nothing to ask');
  assert.deepEqual(ADV.revealable([], [1]), []);
  const seen = ADV.revealable([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]); assert.equal(new Set(seen).size, seen.length, 'each once');
  // what a revealed sector opens or grants, where the data says so
  const sl = D.subSlots[0], op = Object.keys(D.unlocks).find((k) => D.unlocks[k].opensSea);
  assert.equal(ADV.revealNote(sl.sector).slot, sl.slot); assert.equal(ADV.revealNote(+op).opens, D.seas.find((s) => s.id === D.unlocks[op].opensSea).name);
  assert.deepEqual(ADV.revealNote(1), { slot: null, opens: null });
});

test('gaps correction: the cannot ring and cross mark only a FOUND sector above the submarine\'s rank; every other reason stays in words (the accessible name)', () => {
  const found = [1, 2, 3, 10, 26], v = CH.view(1, found, 30);
  const cannot = { 8: 'cannot be added: Not found yet', 26: 'cannot be added: Rank 50 needed (this submarine is rank 30)', 1: 'out of range if added: Needs range 4 more' };
  const svg = CH.svg(v, [10], { cannot });
  const node = (id) => new RegExp('<g class="chart-node[^"]*" data-sector="' + id + '"[\\s\\S]*?</g>').exec(svg)[0];
  assert.ok(/chart-cannot-ring/.test(node(26)) && /chart-cannot-x/.test(node(26)) && / cannot/.test(node(26).slice(0, 80)), 'found and above the rank: marked');
  for (const id of [8, 1]) { assert.ok(!/chart-cannot/.test(node(id)) && !/ cannot/.test(node(id).slice(0, 80)), id + ' has no mark'); }
  assert.match(node(8), /aria-label="[^"]*Not found yet"/); assert.match(node(1), /aria-label="[^"]*Needs range 4 more"/);
  assert.equal((svg.match(/chart-cannot-ring/g) || []).length, 1);
});

// T10 (docs/submersibles-merge-spec.md): the merged free company still goes through the fold as before; units other than a free company are untouched
test('T10: a merged free company that is still bare is folded, one that gained a sector is not; a submarine, a logged voyage and prefs changed on both sides keep this tab\'s version', () => {
  require(path.join(__dirname, '..', 'src', 'core', 'save.js'));
  const CC = globalThis.CC;
  const sec = (fcs, extra) => Object.assign({ fcs, subs: {}, trips: {}, settings: {} }, extra || {});
  const base = sec({ fa: bareFc('Alpha', 'c1', 5), fb: bareFc('Beta', 'c1', 0) });
  const a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(base));
  a.fcs.fa.order = 4; b.fcs.fa.order = 3; // both sides changed it, nothing else: the merged record is still bare
  const merged = CC.mergeModules({ submersibles: base }, { submersibles: a }, { submersibles: b }).submersibles;
  assert.equal(merged.fcs.fa.order, 3); assert.deepEqual(merged.fcs.fa.discovered, [1, 2]);
  assert.deepEqual(FOLD(merged).removed, ['fa'], 'still bare: folded into the other company as before');
  const a2 = JSON.parse(JSON.stringify(base)), b2 = JSON.parse(JSON.stringify(base));
  a2.fcs.fa.discovered = [1, 2, 3]; b2.fcs.fa.discovered = [1, 2, 4];
  const grown = CC.mergeModules({ submersibles: base }, { submersibles: a2 }, { submersibles: b2 }).submersibles;
  assert.deepEqual(grown.fcs.fa.discovered, [1, 2, 3, 4]);
  assert.deepEqual(FOLD(grown).removed, ['fb'], 'a company that gained sectors is not bare: the bare one goes');
  // a submarine, a logged voyage and the preferences, changed on both sides: this tab's version, as before
  const mk = (rank, sort, said) => sec({ fa: solidFc('Alpha', 'c1', 0) }, { subs: { s1: { fcId: 'fa', slot: 1, name: 'Sub', rank } }, trips: { t1: { s: 's1', t: 1, r: [1], back: 2, said, items: [], newSectors: [] } }, settings: { prefs: { priceWorld: sort } } });
  const m = CC.mergeModules({ submersibles: mk(10, 'Aether', '1h') }, { submersibles: mk(20, 'Maduin', '2h') }, { submersibles: mk(30, 'Ravana', '3h') }).submersibles;
  assert.equal(m.subs.s1.rank, 20); assert.equal(m.trips.t1.said, '2h'); assert.equal(m.settings.prefs.priceWorld, 'Maduin');
});

// ---- Visual fixes S2, S3: no label touches a bracket, a ring, a "+" mark, a cross or the route line, in every sea with each sector selected in turn ----
test('chart S2: for every sea, each sector selected in turn (with a route drawn), no label box meets a bracket leg, a ring stroke, a "+" mark, a cross or the route line', () => {
  const found = D.sectors.map((x) => x.id);
  let checked = 0;
  for (const sea of D.seas) {
    const v = CH.view(sea.id, found, 20), size = Math.max(v.box.w, v.box.h), fs = size / 30, r = size / 70, M = CH.marks(r);
    const ids = v.nodes.map((n) => n.id), route = ids.filter((id, i) => i % 2 === 0).slice(0, 4), cannot = {}; v.nodes.forEach((n) => { if (n.rank > 20) cannot[n.id] = 'above'; });
    for (const selId of ids) {
      const svg = CH.svg(v, route, { selected: selId, cannot }), groups = svg.split('<g class="chart-node').slice(1), labels = [], hard = [];
      const pts = /<polyline[^>]*points="([^"]+)"/.exec(svg)[1].split(' ').map((p) => p.split(',').map(Number));
      const rect = (cx, cy, w, h) => ({ x0: cx - w, x1: cx + w, y0: cy - h, y1: cy + h }), hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      for (const g of groups) {
        const id = +/data-sector="(\d+)"/.exec(g)[1], [tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g).slice(1).map(Number);
        const L = /<text class="chart-letter" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)"(?: x="([-\d.]+)")?>([^<]*)</.exec(g), lw = L[5].length * 0.55 * fs, lx = tx + (L[4] ? +L[4] : 0), lx0 = L[2] === 'start' ? lx : L[2] === 'end' ? lx - lw : lx - lw / 2;
        labels.push({ id, kind: 'letter', x0: lx0, x1: lx0 + lw, y0: ty + +L[1] - fs * 0.72, y1: ty + +L[1] });
        const T = /<text class="chart-tag" x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)">([^<]*)</.exec(g);
        if (T) { const fsT = +T[4], w = T[5].length * 0.55 * fsT, x0 = tx + +T[1] - (T[3] === 'start' ? 0 : T[3] === 'end' ? w : w / 2); labels.push({ id, kind: 'tag', x0, x1: x0 + w, y0: ty + +T[2] - fsT * 0.72, y1: ty + +T[2] }); }
        { const P = /class="chart-plus" aria-hidden="true" d="M([-\d.]+) ([-\d.]+)h([-\d.]+)M([-\d.]+) ([-\d.]+)v([-\d.]+)"/.exec(g); if (P) hard.push({ id, kind: 'plus', x0: tx + +P[1], x1: tx + +P[1] + +P[3], y0: ty + +P[5], y1: ty + +P[5] + +P[6] }); } // V4: read where the "+" is drawn (its corner may change)
        { const X = /class="chart-cannot-x" aria-hidden="true" d="([^"]+)"/.exec(g); if (X) { const nn = X[1].match(/-?[\d.]+/g).map(Number), xs = nn.filter((_, i) => i % 2 === 0), ys = nn.filter((_, i) => i % 2 === 1); hard.push({ id, kind: 'cross', x0: tx + Math.min(...xs), x1: tx + Math.max(...xs), y0: ty + Math.min(...ys), y1: ty + Math.max(...ys) }); } }
        const rings = [/chart-routering/.test(g) ? M.R1 : 0, /chart-cannot-ring/.test(g) || /chart-ring2/.test(g) ? M.R0 : 0].filter(Boolean);
        for (const rr of rings) hard.push({ id, kind: 'ring', x0: tx - rr, x1: tx + rr, y0: ty - rr, y1: ty + rr, ring: rr, cx: tx, cy: ty });
        if (id === selId) { const k = M.BK, lk = Math.max(6, r * 0.7); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { hard.push({ id, kind: 'bracket', x0: tx + Math.min(sx * k, sx * (k - lk)) - 2, x1: tx + Math.max(sx * k, sx * (k - lk)) + 2, y0: ty + sy * k - 2, y1: ty + sy * k + 2 }); hard.push({ id, kind: 'bracket', x0: tx + sx * k - 2, x1: tx + sx * k + 2, y0: ty + Math.min(sy * k, sy * (k - lk)), y1: ty + Math.max(sy * k, sy * (k - lk)) }); } }
      }
      for (const lab of labels) {
        for (const h of hard) {
          if (h.ring) { const nx = Math.max(lab.x0, Math.min(h.cx, lab.x1)), ny = Math.max(lab.y0, Math.min(h.cy, lab.y1)), dmin = Math.hypot(nx - h.cx, ny - h.cy), fx = Math.max(Math.abs(lab.x0 - h.cx), Math.abs(lab.x1 - h.cx)), fy = Math.max(Math.abs(lab.y0 - h.cy), Math.abs(lab.y1 - h.cy)), dmax = Math.hypot(fx, fy); assert.ok(!(dmin < h.ring + 2 && dmax > h.ring - 2), `sea ${sea.id} sel ${selId}: ${lab.kind} of ${lab.id} crosses the ring of ${h.id}`); }
          else assert.ok(!hit(lab, h), `sea ${sea.id} sel ${selId}: ${lab.kind} of ${lab.id} meets the ${h.kind} of ${h.id}`);
        }
        for (let i = 1; i < pts.length; i++) for (let k = 0; k <= 30; k++) { const px = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / 30, py = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / 30; assert.ok(!(px > lab.x0 && px < lab.x1 && py > lab.y0 && py < lab.y1), `sea ${sea.id} sel ${selId}: ${lab.kind} of ${lab.id} sits on the route line`); }
      }
      checked++;
    }
  }
  assert.ok(checked >= 40, 'checked ' + checked + ' selections');
});
// ---- Visual fix V4: the bright lines (the way to the next slot or sea, the amber "can be revealed now" arrows) are obstacles for "+" marks, crosses and labels ----
test('chart V4: for every sea and several found sets, no "+" mark, cross or label sits on a bright way-line or an amber arrow line', () => {
  let checked = 0, bright = 0, moved = 0;
  for (const sea of D.seas) {
    const secs = D.sectors.filter((x) => x.sea === sea.id).map((x) => x.id), sets = [[], secs.slice(0, 1), secs.slice(0, 3), secs.slice(0, 6), secs.slice(0, 10), secs];
    for (const found of sets) {
      const v = CH.view(sea.id, found, 20), size = Math.max(v.box.w, v.box.h), fs = size / 30, r = size / 70, M = CH.marks(r), cannot = {}; v.nodes.forEach((n) => { if (n.rank > 20) cannot[n.id] = 'above'; });
      for (const selId of [null, v.nodes[0].id]) {
        const svg = CH.svg(v, [], selId == null ? { cannot } : { selected: selId, cannot });
        const lines = [...svg.matchAll(/<line class="([^"]*)" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"\/>/g)].filter((m) => /\b(lead|goal)\b/.test(m[1])).map((m) => ({ x1: +m[2], y1: +m[3], x2: +m[4], y2: +m[5] }));
        bright += lines.length;
        const onLine = (b) => lines.some((l) => { for (let i = 0; i <= 60; i++) { const px = l.x1 + (l.x2 - l.x1) * i / 60, py = l.y1 + (l.y2 - l.y1) * i / 60; if (px > b.x0 && px < b.x1 && py > b.y0 && py < b.y1) return true; } return false; });
        for (const g of svg.split('<g class="chart-node').slice(1)) {
          const id = +/data-sector="(\d+)"/.exec(g)[1], [tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g).slice(1).map(Number), boxes = [];
          const P = /class="chart-plus" aria-hidden="true" d="M([-\d.]+) ([-\d.]+)h([-\d.]+)M([-\d.]+) ([-\d.]+)v([-\d.]+)"/.exec(g);
          if (P) { boxes.push({ kind: 'plus', x0: tx + +P[1], x1: tx + +P[1] + +P[3], y0: ty + +P[5], y1: ty + +P[5] + +P[6] }); if (+P[1] < 0 || +P[5] > 0) moved++; }
          const X = /class="chart-cannot-x" aria-hidden="true" d="([^"]+)"/.exec(g);
          if (X) { const nums = X[1].match(/-?[\d.]+/g).map(Number), xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1); boxes.push({ kind: 'cross', x0: tx + Math.min(...xs), x1: tx + Math.max(...xs), y0: ty + Math.min(...ys), y1: ty + Math.max(...ys) }); }
          const L = /<text class="chart-letter" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)"(?: x="([-\d.]+)")?>([^<]*)</.exec(g), lw = L[5].length * 0.55 * fs, lx = tx + (L[4] ? +L[4] : 0), lx0 = L[2] === 'start' ? lx : L[2] === 'end' ? lx - lw : lx - lw / 2;
          boxes.push({ kind: 'letter', x0: lx0, x1: lx0 + lw, y0: ty + +L[1] - fs * 0.72, y1: ty + +L[1] });
          const T = /<text class="chart-tag" x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)">([^<]*)</.exec(g);
          if (T) { const fsT = +T[4], w = T[5].length * 0.55 * fsT, x0 = tx + +T[1] - (T[3] === 'start' ? 0 : T[3] === 'end' ? w : w / 2); boxes.push({ kind: 'tag', x0, x1: x0 + w, y0: ty + +T[2] - fsT * 0.72, y1: ty + +T[2] }); }
          for (const b of boxes) assert.ok(!onLine(b), `sea ${sea.id}, ${found.length} found, selected ${selId}: the ${b.kind} of sector ${id} sits on a bright line`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 1000 && bright > 50, 'checked ' + checked + ' nodes, ' + bright + ' bright lines');
  assert.ok(moved >= 1, 'at least one "+" mark stands away from its upper right corner because of a line');
});
test('chart S2/S3: rings are at least 6 beyond the node, the bracket stands outside every ring, the above-rank node is a dashed outline, far is the small square, the cross is 12+ units and sits outside the node', () => {
  const v = CH.view(1, [1, 2, 3, 10, 26], 30), size = Math.max(v.box.w, v.box.h), r = size / 70, M = CH.marks(r);
  assert.ok(M.R0 >= r + 6 && M.R1 > M.R0 && M.BK > M.R1, 'ring and bracket radii');
  const svg = CH.svg(v, [10], { selected: 10, cannot: { 26: 'above' } });
  assert.match(svg, /class="chart-routering"[^>]*r="([\d.]+)"/); assert.ok(+/class="chart-routering"[^>]*r="([\d.]+)"/.exec(svg)[1] >= r + 6 - 0.1);
  const n26 = new RegExp('data-sector="26"[\\s\\S]*?</g>').exec(svg)[0];
  assert.match(n26, /<circle r="[\d.]+" stroke-dasharray="4 3"\/>/, 'found above the rank: dashed outline of its own shape'); assert.ok(!/chart-overring/.test(svg));
  const far = new RegExp('data-sector="8"[\\s\\S]*?</g>').exec(svg)[0]; assert.ok(!/stroke-dasharray/.test(far), 'a far node within the rank is not dashed');
  const d = /chart-cannot-x" aria-hidden="true" d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/.exec(n26); assert.ok(d && Math.abs(+d[3] - +d[1]) >= 8 && +d[1] > r && +d[2] < -r, 'a cross at least 8 wide outside the node, upper right');
});

test('E3 advisor: when no priority can be served the plan is not labelled Gil Farming and the reason says so', () => {
  const orig = globalThis.DROPS.route;
  try {
    globalThis.DROPS.route = () => null; // no gil record for any runnable route
    const inp = (found) => ({ sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: found }, slotsFilled: 4, recs: RECS.defaults() });
    for (const found of [[148, 149], ALL]) {
      const a = ADV.advise(inp(found));
      assert.equal(a.lead, null);
      assert.ok(!/Gil Farming/.test(a.head) && !/Gil Farming/.test(a.label));
      assert.equal(a.plan.why, 'None of your priorities can be served for this submarine right now; the route shown is simply the quickest one it can run.');
      const quick = a.plan.ev.seconds;
      assert.ok(a.plan.route.length >= 1 && quick > 0);
    }
  } finally { globalThis.DROPS.route = orig; }
  // every other case keeps its reason: with records, Gil Farming leads as before
  const g = ADV.advise({ sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4, recs: RECS.defaults() });
  assert.equal(g.lead, 'G'); assert.match(g.label, /Gil Farming/);
});

// ---------------------------------------------------------------- integrity spec 4.4: slots that hold more than one submarine
test('INT-D1 FLEET.slotClashes lists every company and slot that holds two or more submarines, first-shown record first', () => {
  const F = globalThis.FLEET || (require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'fleet.js')), globalThis.FLEET);
  assert.equal(typeof F.slotClashes, 'function');
  const fc = (name, order) => ({ name, order, unlockedSlots: 4, world: 'Ravana', discovered: [1, 2] });
  const s = (fcId, slot) => ({ fcId, slot, name: 'S', rank: 1, voyage: null });
  assert.deepEqual(F.slotClashes({ fcs: { fa: fc('A', 0) }, subs: { a1: s('fa', 1), a2: s('fa', 2) }, trips: {}, settings: {} }), [], 'one in each slot: none');
  assert.deepEqual(F.slotClashes({ fcs: {}, subs: {}, trips: {}, settings: {} }), []);
  const two = F.slotClashes({ fcs: { fa: fc('A', 0) }, subs: { x2: s('fa', 1), x1: s('fa', 1), y: s('fa', 3) }, trips: {}, settings: {} });
  assert.deepEqual(two, [{ fcId: 'fa', slot: 1, ids: ['x2', 'x1'] }], 'two in a slot; ids in key order');
  const three = F.slotClashes({ fcs: { fa: fc('A', 0) }, subs: { a: s('fa', 2), b: s('fa', 2), c: s('fa', 2) }, trips: {}, settings: {} });
  assert.deepEqual(three, [{ fcId: 'fa', slot: 2, ids: ['a', 'b', 'c'] }]);
  const orphan = F.slotClashes({ fcs: { fa: fc('A', 0) }, subs: { o1: s('gone', 1), o2: s('gone', 1) }, trips: {}, settings: {} });
  assert.deepEqual(orphan, [], 'a submarine without its company is not listed');
  const ord = F.slotClashes({ fcs: { fz: fc('Z', 0), fa: fc('A', 1) }, subs: { a1: s('fa', 1), a2: s('fa', 1), z3: s('fz', 3), z4: s('fz', 3), z1: s('fz', 1), z2: s('fz', 1) }, trips: {}, settings: {} });
  assert.deepEqual(ord.map((c) => c.fcId + '|' + c.slot), ['fz|1', 'fz|3', 'fa|1'], 'by company order, then slot');
});

// G2: which parts the Setup form writes; a typed rank alone never replaces saved parts
test('G2 FLEET.partsWritten: untouched and fitting keeps the saved parts, untouched and not fitting clears them with a flag, touched writes the typed', () => {
  const F = globalThis.FLEET;
  assert.equal(typeof F.partsWritten, 'function');
  const rankOf = (id) => ({ 1: 1, 2: 1, 3: 1, 4: 1, 50: 50, 51: 50, 52: 50, 53: 50 })[id];
  const fits = (id, rank) => rankOf(id) <= rank;
  const saved = [50, 51, 52, 53], typed = [1, 2, 3, 4], none = [null, null, null, null];
  assert.deepEqual(F.partsWritten(saved, none, false, 50, fits), { parts: saved, cleared: false }, 'untouched + fits: saved');
  assert.deepEqual(F.partsWritten(saved, none, false, 10, fits), { parts: null, cleared: true }, 'untouched + does not fit: none, flagged');
  assert.deepEqual(F.partsWritten(saved, typed, true, 10, fits), { parts: typed, cleared: false }, 'touched: typed');
  assert.deepEqual(F.partsWritten(saved, [1, 2, null, 4], true, 10, fits), { parts: null, cleared: false }, 'touched but incomplete: none, no flag');
  assert.deepEqual(F.partsWritten(undefined, typed, false, 10, fits), { parts: typed, cleared: false }, 'nothing saved: typed');
  assert.deepEqual(F.partsWritten(none, none, false, 10, fits), { parts: null, cleared: false }, 'saved but empty: nothing to clear');
});
