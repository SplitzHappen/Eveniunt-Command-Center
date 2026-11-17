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
  assert.deepEqual(D.counts, { sectors: 143, seas: 7, parts: 40, classes: 10, ranks: 145, expToMaxRank: 1829558717, lootPairs: 1085, lootSectors: 141, lootItems: 356, unlockNameChecks: 141 });
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
