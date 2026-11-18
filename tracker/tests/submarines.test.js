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
  assert.deepEqual([RECS.GIVE_UP, RECS.GIVE_MIN, RECS.GIVE_MAX, RECS.GIVE_STEP], [10, 5, 50, 5]);
  assert.deepEqual(RECS.defaults(), { fuel: false, giveUp: 10, order: ['unlock', 'level', 'gil', 'loot'], loot: [[0, true], [0, false], [0, false], [0, false], [0, false]] });
  assert.deepEqual(RECS.check({ choices: RECS.defaults() }), RECS.defaults(), 'what check returns for the defaults is the defaults');
});

test('R1: items holds each loot item once, by name then id', () => {
  const items = RECS.items(D);
  assert.equal(items.length, D.counts.lootItems);
  assert.equal(new Set(items.map((x) => x.id)).size, items.length);
  const all = new Set(); for (const l of Object.values(D.loot)) for (const id of l) all.add(id);
  assert.deepEqual(items.map((x) => x.id).sort((a, b) => a - b), [...all].sort((a, b) => a - b));
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1], b = items[i];
    assert.ok(a.name.toLowerCase() < b.name.toLowerCase() || (a.name.toLowerCase() === b.name.toLowerCase() && (a.name < b.name || (a.name === b.name && a.id < b.id))), a.name + ' before ' + b.name);
  }
  const small = { loot: { 1: [7, 3], 2: [3, 9] }, items: { 7: 'Beta', 3: 'alpha', 9: 'Beta' } };
  assert.deepEqual(RECS.items(small), [{ id: 3, name: 'alpha' }, { id: 7, name: 'Beta' }, { id: 9, name: 'Beta' }]);
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
  const stars = (r) => r.route.reduce((t, id) => t + SECTOR.get(id).stars, 0);
  const U1 = (r) => (visit && r.route.includes(visit) ? 1 : 0), U2 = (r) => (undiscovered.length ? newOf(r.route) : 0);
  const single = routes.filter((r) => r.route.length === 1), u1 = single.some((r) => U1(r) > 0), u2 = single.some((r) => U2(r) > 0);
  const U3 = (r) => (left && !top && !u1 && !u2 ? r.exp : 0), X = (r) => (top ? 0 : r.exp);
  const fns = { unlock: [U1, U2, U3], level: [X], gil: [stars] };
  const stages = order.filter((k) => fns[k]).flatMap((k) => fns[k]);
  let S = routes, lead = false;
  const rec = new Map(routes.map((r) => [r, []]));
  for (const fn of stages) {
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

test('Submersibles advisor with settings (R2): invariant I1, the S6 cases equal today\'s advice when only Gil is live and fuel is off', () => {
  const build = [31, 24, 25, 34], base = { sub: { rank: 145, parts: build }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
  const L = (route, trips, perTrip, enough) => ({ route, trips, perTrip, enough: enough === undefined ? trips >= 10 : enough });
  const plain = ADV.advise(base);
  const cases = [
    base,
    Object.assign({}, base, { sub: { rank: 145, parts: SHARK } }),
    Object.assign({}, base, { logged: null }), Object.assign({}, base, { logged: [] }),
    Object.assign({}, base, { logged: [L([1, 2], 9, 5000)], enough: 10 }),
    Object.assign({}, base, { logged: [L(plain.plan.route, 9, 5000)], enough: 10 }),
    Object.assign({}, base, { logged: [L([1, 2], 14, 412000)], enough: 10, priceNote: 'Market prices seen Tue 14:05 on this device.' }),
    Object.assign({}, base, { logged: [L([1, 2], 14, 412000), L(plain.plan.route, 12, 0)], enough: 10 }),
    Object.assign({}, base, { logged: [L([1, 2], 14, 412000), L(plain.plan.route, 4, 1000, false)], enough: 10 }),
  ];
  for (const [i, c] of cases.entries()) {
    const today = ADV.advise(c), now = ADV.advise(Object.assign({}, c, { recs: RECS.defaults() }));
    const pick = (a) => ({ step: a.step, stepName: a.stepName, goal: a.goal, plan: a.plan, alts: a.alts, parts: a.parts, note: a.note, own: a.own });
    assert.deepEqual(pick(now), pick(today), 'case ' + i);
    assert.equal(now.lead, 'G'); assert.equal(now.fuel, false);
    assert.deepEqual(now.skipped.map((x) => x.key), ['U1', 'U2', 'U3', 'X', 'L1', 'L2']);
  }
  // fuel on is no longer today's answer path, but is still a gil route this sub can run
  const f = ADV.advise(Object.assign({}, base, { recs: withRecs({ fuel: true }) }));
  assert.equal(f.lead, 'G'); assert.equal(f.fuel, true); assert.ok(f.plan.ev.reachable);
});

test('Submersibles advisor with settings (R2): each skip of 4.5 names its cause; loot leads when an item can drop', () => {
  const full = { sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: ALL }, slotsFilled: 4 };
  const a = ADV.advise(Object.assign({}, full, { recs: RECS.defaults() }));
  const why = Object.fromEntries(a.skipped.map((s) => [s.key, s.reason]));
  assert.equal(why.U1, 'every sector is found'); assert.equal(why.U2, 'every sector is found'); assert.equal(why.U3, 'every sector is found');
  assert.equal(why.X, 'this sub is at the top rank'); assert.equal(why.L1, 'no item chosen'); assert.equal(why.L2, 'no item chosen');
  // loot skipped because no chosen item can drop where this sub can go (rank 1, sectors A and B)
  const items = RECS.items(D);
  const lowDrop = (id) => D.sectors.some((s) => s.rank <= 1 && (D.loot[s.id] || []).includes(id));
  const far = items.find((i) => !lowDrop(i.id)), near = items.find((i) => (D.loot[1] || []).includes(i.id) && !(D.loot[2] || []).includes(i.id));
  const low = { sub: { rank: 1, parts: SHARK }, fc: { unlockedSlots: 1, discovered: [1, 2] }, slotsFilled: 1 };
  const b = ADV.advise(Object.assign({}, low, { recs: withRecs({ loot: [[far.id, true], [0, false], [0, false], [0, false], [0, false]] }) }));
  assert.match(b.skipped.find((s) => s.key === 'L1').reason, /^none of your chosen items can drop in a sector this sub can reach now$/);
  assert.ok(b.skipped.some((s) => s.key === 'L2'));
  // with an item that can drop in A only, Loot first: coverage 1 for each route through A; per hour A alone wins
  const c = ADV.advise(Object.assign({}, low, { recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: [[near.id, true], [0, false], [0, false], [0, false], [0, false]] }) }));
  assert.equal(c.lead, 'L1'); assert.deepEqual(c.plan.route, [1]);
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
  assert.match(a.plan.why, /Skipped Leveling Submersible Rank: this sub is at the top rank\./);
  assert.ok(!/Loot Farming/.test(a.plan.why), 'no item chosen is said in Setup only');
  // Gil ranked first: nothing above it, so nothing named
  const g = ADV.advise(Object.assign({}, R3_FULL, { recs: withRecs({ fuel: true, order: ['gil', 'unlock', 'level', 'loot'] }) }));
  assert.ok(!/Skipped/.test(g.plan.why));
  // a chosen item that cannot drop where this sub can go: named, with the 4.5 sentence
  const far = R3_ITEMS.find((i) => !D.sectors.some((s) => s.rank <= 1 && (D.loot[s.id] || []).includes(i.id)));
  const l = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(far.id) }) }));
  assert.equal(l.lead, 'U1');
  assert.match(l.plan.why, /Skipped Loot Farming: none of your chosen items can drop in a sector this sub can reach now\./);
  // the 4.5 causes sit in the skipped list too
  const why = Object.fromEntries(a.skipped.map((s) => [s.key, s.reason]));
  assert.equal(why.U1, 'every sector is found'); assert.equal(why.X, 'this sub is at the top rank'); assert.equal(why.L1, 'no item chosen');
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
  assert.equal(g.lead, 'G'); assert.ok(g.parts && g.parts.gilGain > 0, 'with Gil leading the S6 gil tip stays');
  assert.deepEqual(g.parts, ADV.advise(shark145).parts, 'the same tip as today');
  // a non-gil lead at step 3: never a gil tip, only the minutes tip on the suggested route
  for (const rank of [30, 60, 130]) {
    const x = ADV.advise(Object.assign({}, shark145, { sub: { rank, parts: SHARK }, recs: withRecs({ order: ['level', 'unlock', 'gil', 'loot'] }) }));
    assert.equal(x.step, 3); assert.equal(x.lead, 'X');
    assert.ok(x.parts && x.parts.gilGain === undefined && x.parts.gilFrom === undefined, 'rank ' + rank);
    assert.match(x.parts.why, /min sooner \(calculated\)/);
  }
  const l = ADV.advise(Object.assign({}, shark145, { sub: { rank: 30, parts: SHARK }, recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(R3_ITEMS.find((i) => D.sectors.some((s) => s.rank <= 30 && (D.loot[s.id] || []).includes(i.id))).id) }) }));
  assert.ok(l.lead === 'L1' && l.step === 3 && (l.parts === null || l.parts.gilGain === undefined));
});

test('Submersibles advisor reasons (R3): a loot reason says drop odds are not known and promises nothing', () => {
  const a = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(R3_NEAR.id) }) }));
  assert.equal(a.lead, 'L1'); assert.equal(a.plan.route.length, 1);
  assert.ok(a.plan.why.startsWith('Can bring back 1 of your 1 chosen item (' + R3_NEAR.name + '); possible items only (community data), drop odds are not known.'), a.plan.why);
  assert.ok(!/will drop|guarantee|always/i.test(a.plan.why));
  // L2 leads when coverage cannot tell routes apart
  const l2 = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({ order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(R3_NEAR.id) }) }));
  for (const x of [l2.plan].concat(l2.alts)) if (/Can bring back/.test(x.why)) assert.match(x.why, /drop odds are not known/);
  // a loot plan on a later stage still carries the note
  const later = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs({ order: ['level', 'loot', 'unlock', 'gil'], loot: R3_LOOT(R3_NEAR.id) }) }));
  if (/Then Loot Farming/.test(later.plan.why)) assert.match(later.plan.why, /drop odds are not known/);
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

test('Review fix 3: the Loot follow-on says stops and an hourly figure in plain words', () => {
  const found = D.sectors.filter((s) => s.rank <= 5).map((s) => s.id).slice(0, 4);
  const a = ADV.advise({ sub: { rank: 5, parts: SHARK }, fc: { unlockedSlots: 4, discovered: found }, slotsFilled: 4, recs: withRecs({ order: ['level', 'loot', 'unlock', 'gil'], loot: R3_LOOT(12586) }) });
  assert.match(a.plan.why, / Then Loot Farming: \d+ stops? where a chosen item can drop \([\d.,]+ an hour\); possible items only \(community data\), drop odds are not known\.$/, a.plan.why);
  assert.ok(!/sector and item chances/.test(a.plan.why));
});

test('Review fix 6a: no other route scores 0 for the lead', () => {
  for (const o of [{}, { order: ['level', 'unlock', 'gil', 'loot'] }, { order: ['loot', 'unlock', 'level', 'gil'], loot: R3_LOOT(R3_NEAR.id) }]) {
    const a = ADV.advise(Object.assign({}, R3_LOW, { recs: withRecs(o) }));
    assert.ok(a.alts.every((x) => x.route.length > 0));
    if (a.lead === 'U1') assert.ok(a.alts.every((x) => x.route.includes(2)), 'every other route surveys the sector on the way');
    if (a.lead === 'L1') assert.ok(a.alts.every((x) => x.route.some((id) => (D.loot[id] || []).includes(R3_NEAR.id))));
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
let tuned = null;
const tuning = () => (tuned = tuned || TUNE.run());
test('R4: RECS.GIVE_UP equals the tuning rule\'s result, and the fleet is big enough', () => {
  const t = tuning();
  assert.ok(t.count >= 20, 'scenarios with the intended lead: ' + t.count);
  assert.notEqual(t.chosen, null, t.verdict);
  assert.equal(t.chosen, RECS.GIVE_UP);
  assert.ok(RECS.GIVE_UP > RECS.BAND * 100 && RECS.GIVE_UP < RECS.GIVE_MAX, 'above the band and short of the top of the range');
  assert.ok(t.table.slice(1).every((x) => x.g === 0 || Number.isFinite(x.L) && Number.isFinite(x.E)));
});
test('R4: the 5% band gains more on the second priority than it loses on the first', () => {
  const b = tuning().band.rows.find((r) => r.band === 0.05);
  assert.ok(b.gain > b.loss, 'gain ' + b.gain + ' loss ' + b.loss);
});
test('R4: the tuning document is the tool\'s output', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'submersibles-recommendations-tuning.md'), 'utf8');
  assert.equal(doc, TUNE.render(tuning()) + '\n', 'run: node tracker/tools/recs-tune.js --write');
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
