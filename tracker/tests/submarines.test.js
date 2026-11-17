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
  const rec = { choices: { fuel: true, giveUp: 20, order: ['gil', 'unlock', 'level', 'loot'], loot: [[5665, true], [0, false], [0, false], [0, false], [0, false]] } };
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
  assert.deepEqual(RECS.defaults(), { fuel: false, giveUp: 15, order: ['unlock', 'level', 'gil', 'loot'], loot: [[0, false], [0, false], [0, false], [0, false], [0, false]] });
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
  // loot: five pairs; 0 is none; the first is always on; unknown item or later duplicate is none; missing pairs are [0, false]
  assert.deepEqual(RECS.check(sec({ loot: [[a.id, false], [b.id, true]] }), D).loot, [[a.id, true], [b.id, true], [0, false], [0, false], [0, false]]);
  assert.deepEqual(RECS.check(sec({ loot: [[a.id, true], [b.id, false], [c.id, 1], [0, true], [a.id, true]] }), D).loot, [[a.id, true], [b.id, false], [c.id, false], [0, true], [0, true]]);
  assert.deepEqual(RECS.check(sec({ loot: [[999999999, true], 'x', null, [a.id], [1.5, true], [b.id, true]] }), D).loot, [[0, true], [0, false], [0, false], [a.id, false], [0, true]]);
  assert.deepEqual(RECS.check(sec({ loot: 'x' }), D).loot, dflt.loot);
  // the same raw value gives the same result and the input is not touched
  const raw = sec({ fuel: true, giveUp: 20, order: ['gil', 'loot', 'level', 'unlock'], loot: [[a.id, true]] });
  const before = JSON.stringify(raw); RECS.check(raw, D); assert.equal(JSON.stringify(raw), before);
});

test('R1: active and sig', () => {
  const [a, b, c] = RECS.items(D);
  const ch = RECS.check({ choices: { loot: [[a.id, true], [b.id, false], [c.id, true]] } }, D);
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
  assert.equal(RECS.pick(cands, [byAmount('u')], { fuel: true }).plan.id, 'F');
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
  assert.deepEqual([noFuel.lead, noFuel.step, routes(noFuel)], ['U1', 1, ['2', '1>2', '1']]);
  assert.deepEqual(routes(fuel), ['2', '1>2', '1'], 'fuel on: A > B enters the allowance, per tank B wins, same plan');
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
