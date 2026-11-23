'use strict';
// Lists data (work item W1 of docs/lists-spec.md): the committed data/lists.json checked against the pinned game
// sheet rows quoted below, and the tool tools/lists-data.py run offline on a small made-up cache (tests LD-5, LD-7,
// LD-9, LD-10) so that no network is needed. LD-15 to LD-21 (work item B2 of docs/lists-look-spec.md): node names, both gatherers,
// timed unspoiled nodes, folklore, items without a position, fish spots and every crafter.
// Run: node tests/lists-data.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'lists-data.py');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'lists.json'), 'utf8'));
const GIL = (o) => o[1].length === 1 && o[1][0][0] === 1;

// ---------------------------------------------------------------- a made-up cache for the tool
const DM = 'dm-44948e4c', TCF = 'tc-70429e21';
const JOBS = ['carpenter', 'blacksmith', 'armorer', 'goldsmith', 'leatherworker', 'weaver', 'alchemist', 'culinarian', 'miner', 'botanist', 'fisher'];
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('made-up icon')]);
const NAMES = [[1, 'mineral deposit'], [2, 'rocky outcrop'], [3, 'mature tree'], [4, 'lush vegetation patch'], [5, 'unspoiled mineral deposit'],
  [6, 'unspoiled rocky outcrop'], [7, 'unspoiled mature tree'], [8, 'unspoiled lush vegetation patch'], [13, 'legendary mineral deposit'],
  [14, 'legendary rocky outcrop'], [15, 'legendary mature tree'], [16, 'legendary lush vegetation patch'], [21, 'teeming waters'], [22, 'swimming shadows']]
  .map(([n, t]) => ({ '#': n, Singular: t }));
// the game's map coordinate of a world position on a map of size factor 100 and no offset (the conversion of tools/info.py)
const mc = (raw) => 41 * (raw + 1024) / 2048 + 1;
function csv(head, rows) {
  return [head.join(',')].concat(rows.map((r) => head.map((h) => (h in r ? r[h] : '')).join(','))).join('\n') + '\n';
}
const ITEM_HEAD = ['#', 'Name', 'IsUntradable', 'CanBeHq', 'AlwaysCollectable', 'PriceMid'];
const REC_HEAD = ['#', 'CraftType', 'ItemResult', 'Ingredient[0]', 'Ingredient[1]', 'Ingredient[2]', 'Ingredient[3]', 'Ingredient[4]',
  'Ingredient[5]', 'Ingredient[6]', 'Ingredient[7]', 'RecipeLevelTable', 'SecretRecipeBook', 'AmountResult', 'AmountIngredient[0]',
  'AmountIngredient[1]', 'AmountIngredient[2]', 'AmountIngredient[3]', 'AmountIngredient[4]', 'AmountIngredient[5]', 'AmountIngredient[6]',
  'AmountIngredient[7]', 'CollectableMetadataKey', 'CanQuickSynth', 'CanHq', 'IsSpecializationRequired', 'IsExpert'];
function recipeRow(id, result, ings, yld) {
  const r = { '#': id, CraftType: 1, ItemResult: result, RecipeLevelTable: 1, SecretRecipeBook: 0, AmountResult: yld || 1,
    CollectableMetadataKey: 0, CanQuickSynth: 'True', CanHq: 'True', IsSpecializationRequired: 'False', IsExpert: 'False' };
  for (let n = 0; n < 8; n++) { r['Ingredient[' + n + ']'] = n < ings.length ? ings[n][0] : -1; r['AmountIngredient[' + n + ']'] = n < ings.length ? ings[n][1] : 0; }
  return r;
}
// items: 1 Gil, 10 Top, 11 Plank, 12 Nail, 13 Ore, 14 Token, 20 Gadget (five offers)
const ITEMS = [[1, 'Gil'], [10, 'Top'], [11, 'Plank'], [12, 'Nail'], [13, 'Ore'], [14, 'Token'], [20, 'Gadget']];
function writeCache(dir, o) {
  fs.mkdirSync(path.join(dir, DM), { recursive: true });
  fs.mkdirSync(path.join(dir, TCF), { recursive: true });
  const w = (f, t) => fs.writeFileSync(path.join(dir, f), t);
  w(DM + '/Item.csv', csv(ITEM_HEAD, ITEMS.map(([id, name]) => ({ '#': id, Name: name, IsUntradable: 'False', CanBeHq: 'True', AlwaysCollectable: 'False', PriceMid: 5 }))));
  w(DM + '/Recipe.csv', csv(REC_HEAD, o.recipes));
  w(DM + '/RecipeLevelTable.csv', csv(['#', 'ClassJobLevel', 'Stars'], [{ '#': 1, ClassJobLevel: 7, Stars: 0 }]));
  w(DM + '/PlaceName.csv', csv(['#', 'Name'], [{ '#': 5, Name: 'Test Town' }, { '#': 6, Name: 'Test Zone' }, { '#': 7, Name: 'Test Area' }, { '#': 8, Name: 'Test Aetheryte' }]));
  const W = o.world || {};
  w(DM + '/Map.csv', csv(['#', 'SizeFactor', 'OffsetX', 'OffsetY', 'PlaceName'], [{ '#': 7, SizeFactor: 100, OffsetX: 0, OffsetY: 0, PlaceName: 6 }]));
  w(DM + '/GatheringPointName.csv', csv(['#', 'Singular'], W.names === undefined ? NAMES : W.names));
  w(DM + '/GatheringType.csv', csv(['#', 'Name'], [0, 1, 2, 3, 5].map((n) => ({ '#': n, Name: 'type' + n }))));
  w(DM + '/GatheringPoint.csv', csv(['#', 'GatheringPointBase', 'GatheringSubCategory', 'Type'], W.points || []));
  w(DM + '/GatheringPointBase.csv', csv(['#', 'GatheringType', 'GatheringLevel'], W.bases || []));
  w(DM + '/GatheringSubCategory.csv', csv(['#', 'FolkloreBook', 'Item'], W.subs || []));
  w(DM + '/ExportedGatheringPoint.csv', csv(['#', 'X', 'Y', 'Radius', 'GatheringType', 'GatheringPointType'], W.exported || []));
  w(DM + '/SpearfishingNotebook.csv', csv(['#', 'GatheringPointBase', 'IsShadowNode'], W.spear || []));
  w(DM + '/FishingSpot.csv', csv(['#', 'X', 'Z'], W.fsheet || []));
  w(TCF + '/aetherytes.json', JSON.stringify(W.aetherytes || []));
  fs.mkdirSync(path.join(dir, TCF, 'classjob'), { recursive: true });
  for (const j of JOBS) w(TCF + '/classjob/' + j + '.png', (W.icons && j in W.icons) ? W.icons[j] : PNG);
  w(TCF + '/shops.json', JSON.stringify(o.shops || []));
  w(TCF + '/nodes.json', JSON.stringify(W.nodes || {}));
  w(TCF + '/gathering-items.json', '{}');
  w(TCF + '/fishing-sources.json', JSON.stringify(W.sources || {}));
  w(TCF + '/fishing-spots.json', JSON.stringify(W.spots || []));
  w(TCF + '/npcs.json', JSON.stringify({ 500: { en: 'test merchant', position: { zoneid: 5 } } }));
}
const GOOD = () => [recipeRow(1, 10, [[11, 2], [12, 1], [20, 1]], 3), recipeRow(2, 11, [[13, 1]], 1)];
const SHOPS = () => [
  { id: 1, type: 'GilShop', npcs: [500], trades: [
    { currencies: [{ id: 1, amount: 100 }], items: [{ id: 20, amount: 1 }] },
    { currencies: [{ id: 1, amount: 280 }], items: [{ id: 20, amount: 3 }] } ] },
  { id: 2, type: 'SpecialShop', npcs: [700], trades: [
    { currencies: [{ id: 14, amount: 2 }], items: [{ id: 20, amount: 3 }] },
    { currencies: [{ id: 1, amount: 400 }], items: [{ id: 20, amount: 1, hq: true }] },
    { requiredGCRank: 2, currencies: [{ id: 14, amount: 2 }], items: [{ id: 20, amount: 3 }] },
    { currencies: [{ id: 1, amount: 100 }], items: [{ id: 20, amount: 1 }] } ] },
  { id: 3, type: 'SpecialShop', npcs: [600, 650], trades: [{ currencies: [{ id: 1, amount: 100 }], items: [{ id: 20, amount: 1 }] }] },
];
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'lists-data-test-')); }
function run(cache, out, recipes) {
  return spawnSync('python3', ['-I', TOOL, '--cache', cache, '--out', out, '--expect-recipes', String(recipes)], { encoding: 'utf8' });
}

// ---------------------------------------------------------------- the committed file
test('LD-1 every ingredient, result and currency is in items; every currency has its own recipes and offers (closure)', () => {
  const need = new Set();
  for (const r of Object.values(D.recipes)) { need.add(r[0]); for (const [it] of r[5]) need.add(it); }
  for (const lst of Object.values(D.trades)) for (const o of lst) for (const [c] of o[1]) need.add(c);
  for (const it of need) assert.ok(D.items[it], 'item ' + it + ' missing from items');
  const currencies = new Set();
  for (const lst of Object.values(D.trades)) for (const o of lst) for (const [c] of o[1]) currencies.add(c);
  assert.ok(currencies.has(1) && currencies.size > 50);
  const made = new Set(Object.values(D.recipes).map((r) => r[0]));
  assert.ok([...currencies].some((c) => D.trades[c]), 'a currency with offers of its own is kept');
  assert.ok([...currencies].some((c) => made.has(c)), 'a currency with a recipe of its own is kept');
  for (const [id, it] of Object.entries(D.items)) assert.ok(typeof it[0] === 'string' && Number.isInteger(it[1]) && Number.isInteger(it[2]), 'item ' + id);
  for (const n of Object.values(D.npcs)) assert.equal(n.length, 2);
});

test('LD-2 five recipes checked by hand against the pinned sheet rows', () => {
  // Recipe.csv rows at 44948e4c (columns: CraftType, ItemResult, AmountResult, ingredients with amounts, RecipeLevelTable,
  // CollectableMetadataKey, SecretRecipeBook); RecipeLevelTable 1 and 2 are level 1 and 2, 90 is level 50 with 3 stars,
  // 142 is level 57. Flags: 1 HQ, 2 expert, 4 specialist, 8 collectable, 16 quick synthesis, 32 master book.
  // 1: CraftType 1, result 5056 (Bronze Ingot) x1, 5106 x2, 5107 x1, 2 x1, table 1, quick synth, HQ
  assert.deepEqual(D.recipes[1], [5056, 1, 1, 1, 0, [[5106, 2], [5107, 1], [2, 1]], 17]);
  // 2: one with a crafted material: 5056 (Bronze Ingot, made by recipe 1) x1, 5361 x1, 2 x1, 5 x1; result 2546 (Bronze Hatchet)
  assert.deepEqual(D.recipes[2], [2546, 1, 1, 1, 0, [[5056, 1], [5361, 1], [2, 1], [5, 1]], 17]);
  assert.equal(D.items[5056][0], 'Bronze Ingot');
  assert.equal(D.items[2546][0], 'Bronze Hatchet');
  assert.ok(Object.values(D.recipes).some((r) => r[0] === 5056), 'the crafted material has a recipe of its own');
  // 901: the multi-yield one: CraftType 7, result 4847 (Table Salt) AmountResult 6, 5518 x1, 2 x1
  assert.deepEqual(D.recipes[901], [4847, 6, 7, 1, 0, [[5518, 1], [2, 1]], 17]);
  assert.equal(D.items[4847][0], 'Table Salt');
  // 32193: collectable: CollectableMetadataKey 3, CraftType 0, result 17549, 17554 x2, 10 x4, 9 x2, table 142, no quick synth
  assert.deepEqual(D.recipes[32193], [17549, 1, 0, 57, 0, [[17554, 2], [10, 4], [9, 2]], 9]);
  assert.equal(D.items[17549][0], 'Near Eastern Antique');
  // 30241: SecretRecipeBook 3 (a master book), table 90 (level 50, 3 stars), six ingredients
  assert.deepEqual(D.recipes[30241], [7480, 1, 2, 50, 3, [[7607, 1], [7807, 2], [5075, 1], [5085, 1], [15, 2], [17, 1]], 49]);
  assert.equal(D.items[7480][0], 'Heavy Wolfram Helm');
  assert.equal(D.items[2][1] & 8, 8, 'a crystal is flagged');
});

test('LD-3 timed windows equal conditions.json wherever both hold the item', () => {
  const T = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tracker-data.json'), 'utf8'));
  const C = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'conditions.json'), 'utf8')).nodes;
  const item = {};
  for (const s of T.sections) if (s.id.startsWith('gather-')) for (const g of s.g) for (const e of g.e) item[s.id + ':' + e.i] = e.it;
  let both = 0;
  for (const [key, win] of Object.entries(C)) {
    const g = D.gatherLegacy[item[key]];
    if (!g) continue;
    both++;
    assert.deepEqual([g[3], g[4]], [win[0], win[1]], key);
  }
  assert.ok(both > 100, 'items compared: ' + both);
  for (const g of Object.values(D.gatherLegacy)) assert.ok((g[3] === 0 && g[4] === 0) || (Array.isArray(g[3]) && g[3].length && g[4] > 0));
});

test('LD-4 a trade that gives several keeps its ratio', () => {
  let several = 0;
  for (const lst of Object.values(D.trades)) for (const o of lst) { assert.ok(o[0] >= 1); if (o[0] > 1) several++; }
  assert.ok(several > 0, 'the data has offers that give more than one');
  const out = tmp(), cache = tmp();
  writeCache(cache, { recipes: GOOD(), shops: SHOPS() });
  const r = run(cache, path.join(out, 'l.json'), 2);
  assert.equal(r.status, 0, r.stderr);
  const L = JSON.parse(fs.readFileSync(path.join(out, 'l.json'), 'utf8'));
  assert.ok(L.trades[20].some((o) => o[0] === 3 && JSON.stringify(o[1]) === '[[14,2]]'), 'three for two tokens');
  assert.ok(L.trades[20].some((o) => o[0] === 3 && JSON.stringify(o[1]) === '[[1,280]]'), 'three for 280 gil');
});

test('LD-5 a second run writes an identical file with empty changes', () => {
  assert.deepEqual(D.changes, []);
  const out = tmp(), cache = tmp(), f = path.join(out, 'l.json');
  writeCache(cache, { recipes: GOOD(), shops: SHOPS() });
  assert.equal(run(cache, f, 2).status, 0);
  const first = fs.readFileSync(f, 'utf8');
  assert.equal(run(cache, f, 2).status, 0);
  assert.equal(fs.readFileSync(f, 'utf8'), first);
  assert.deepEqual(JSON.parse(first).changes, []);
});

test('LD-6 every offer has at least one currency and gil offers sort first', () => {
  let gil = 0, other = 0;
  for (const [it, lst] of Object.entries(D.trades)) {
    let seenOther = false;
    for (const o of lst) {
      assert.ok(o[1].length >= 1, 'item ' + it);
      for (const [c, a] of o[1]) assert.ok(c >= 1 && a >= 1);
      if (GIL(o)) { gil++; assert.ok(!seenOther, 'a gil offer after another currency for item ' + it); } else { other++; seenOther = true; }
    }
  }
  assert.ok(gil > 1000 && other > 100);
  assert.equal(gil, 4041);
  assert.equal(other, 1045);
});

test('LD-7 the compare step keeps the earlier entry and adds one holding both old rows', () => {
  const out = tmp(), cache = tmp(), f = path.join(out, 'l.json');
  writeCache(cache, { recipes: GOOD(), shops: SHOPS() });
  assert.equal(run(cache, f, 2).status, 0);
  const L = JSON.parse(fs.readFileSync(f, 'utf8'));
  const oldRow1 = JSON.parse(JSON.stringify(L.recipes[1]));
  const earlier = { from: 'old 00000000 00000000', to: 'older 11111111 11111111', recipes: { 7: [[1, 1, 1, 1, 0, [[2, 1]], 0], [1, 1, 1, 2, 0, [[2, 1]], 0]] }, gone: {} };
  L.stamp = 'prev 22222222 33333333';
  L.recipes[1][1] = 9; // one recipe row altered
  const fake = [99, 1, 1, 1, 0, [[13, 4]], 1];
  L.recipes[3] = fake; // a recipe the data no longer holds: removed
  L.changes = [earlier];
  fs.writeFileSync(f, JSON.stringify(L));
  assert.equal(run(cache, f, 2).status, 0);
  const N = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(N.changes.length, 2);
  assert.deepEqual(N.changes[0], earlier);
  assert.equal(N.changes[1].from, 'prev 22222222 33333333');
  assert.equal(N.changes[1].to, '7.57h1 44948e4c 70429e21');
  assert.deepEqual(N.changes[1].recipes, { 1: [[oldRow1[0], 9, oldRow1[2], oldRow1[3], oldRow1[4], oldRow1[5], oldRow1[6]], oldRow1] });
  assert.deepEqual(N.changes[1].gone, { 3: fake });
  assert.deepEqual(N.recipes[1], oldRow1);
  assert.ok(!N.recipes[3]);
});

test('LD-8 the stamp matches the format and is at most 40 characters', () => {
  assert.match(D.stamp, /^\S+ [0-9a-f]{8} [0-9a-f]{8}$/);
  assert.ok(D.stamp.length <= 40);
  assert.equal(D.stamp, '7.57h1 44948e4c 70429e21');
});

test('LD-9 a recipe loop stops the tool and writes nothing; the real table has none', () => {
  const out = tmp(), cache = tmp(), f = path.join(out, 'l.json');
  writeCache(cache, { recipes: [recipeRow(1, 10, [[11, 1]]), recipeRow(2, 11, [[10, 1]])], shops: [] });
  const r = run(cache, f, 2);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /STOP.*loop/);
  assert.ok(!fs.existsSync(f) && !fs.existsSync(f + '.part'));
  // a self-loop stops too
  writeCache(cache, { recipes: [recipeRow(1, 10, [[10, 1]])], shops: [] });
  const s = run(cache, f, 1);
  assert.notEqual(s.status, 0);
  assert.ok(!fs.existsSync(f));
  // the real table: a depth-first search for an item that needs itself
  const graph = new Map();
  for (const r of Object.values(D.recipes)) { if (!graph.has(r[0])) graph.set(r[0], new Set()); for (const [it] of r[5]) graph.get(r[0]).add(it); }
  const state = new Map();
  for (const root of graph.keys()) {
    if (state.get(root)) continue;
    const stack = [[root, graph.get(root)[Symbol.iterator]()]];
    state.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const nx = top[1].next();
      if (nx.done) { state.set(top[0], 2); stack.pop(); continue; }
      assert.notEqual(state.get(nx.value), 1, 'loop through item ' + nx.value);
      if (!state.get(nx.value) && graph.has(nx.value)) { state.set(nx.value, 1); stack.push([nx.value, graph.get(nx.value)[Symbol.iterator]()]); }
    }
  }
});

test('LD-10 an item with more than four offers keeps every distinct one; only exact duplicates merge', () => {
  const cache = tmp(), out = tmp(), f = path.join(out, 'l.json');
  writeCache(cache, { recipes: GOOD(), shops: SHOPS() });
  assert.equal(run(cache, f, 2).status, 0);
  const L = JSON.parse(fs.readFileSync(f, 'utf8'));
  const offers = L.trades[20];
  // listed across three shops, "1 for 100 gil" three times: the distinct ones are 1 for 100, 3 for 280, 3 for 2 tokens,
  // 1 HQ for 400 and 3 for 2 tokens at Grand Company rank 2, which makes five
  assert.equal(offers.length, 5);
  assert.deepEqual(offers.map((o) => GIL(o)), [true, true, true, false, false]);
  const hq = offers.filter((o) => o[2] === 1);
  assert.equal(hq.length, 1);
  assert.deepEqual(hq[0].slice(0, 2), [1, [[1, 400]]]);
  assert.ok(offers.some((o) => o[3] === 2), 'the rank-2 offer is kept apart from the unranked one');
  const single = offers.filter((o) => o[0] === 1 && o[2] === 0 && GIL(o));
  assert.equal(single.length, 1, 'the exact duplicates merged into one');
  assert.equal(single[0][4], 500, 'the lowest seller id is kept');
  assert.ok(offers.slice(0, 3).every((o) => o[1][0][0] === 1), 'gil offers first');
  assert.deepEqual(L.npcs[500], ['test merchant', 'Test Town']);
  // the real data: items with more than four offers keep every distinct one
  let many = 0;
  for (const lst of Object.values(D.trades)) {
    if (lst.length > 4) many++;
    const seen = new Set(lst.map((o) => JSON.stringify(o.slice(0, 4))));
    assert.equal(seen.size, lst.length, 'a duplicate offer');
  }
  assert.ok(many > 0);
});

// ---------------------------------------------------------------- fix 5 of work item W14: added recipes and empty stamp changes
// The tool is run on a made-up cache; the earlier file is then rewritten to look like an older patch and the tool is run again.
const NOW = '7.57h1 44948e4c 70429e21';
function earlierFile(edit) {
  const out = tmp(), cache = tmp(), f = path.join(out, 'l.json');
  writeCache(cache, { recipes: GOOD(), shops: SHOPS() });
  assert.equal(run(cache, f, 2).status, 0);
  const L = JSON.parse(fs.readFileSync(f, 'utf8'));
  const rows = JSON.parse(JSON.stringify(L.recipes));
  edit(L);
  fs.writeFileSync(f, JSON.stringify(L));
  assert.equal(run(cache, f, 2).status, 0);
  return { N: JSON.parse(fs.readFileSync(f, 'utf8')), rows, f, cache };
}

test('LD-11 a recipe added by the patch is recorded with a null old row, with nothing else changed', () => {
  const { N, rows } = earlierFile((L) => { delete L.recipes[2]; L.stamp = 'prev 22222222 33333333'; });
  assert.equal(N.changes.length, 1);
  assert.equal(N.changes[0].from, 'prev 22222222 33333333');
  assert.equal(N.changes[0].to, NOW);
  assert.deepEqual(N.changes[0].recipes, { 2: [null, rows[2]] });
  assert.deepEqual(N.changes[0].gone, {});
});

test('LD-12 an added recipe, a changed one and a removed one are all recorded in one entry', () => {
  const fake = [99, 1, 1, 1, 0, [[13, 4]], 1];
  const { N, rows } = earlierFile((L) => { delete L.recipes[2]; L.recipes[1][1] = 9; L.recipes[3] = fake; L.stamp = 'prev 22222222 33333333'; });
  assert.equal(N.changes.length, 1);
  const e = N.changes[0], was1 = JSON.parse(JSON.stringify(rows[1])); was1[1] = 9;
  assert.deepEqual(e.recipes, { 1: [was1, rows[1]], 2: [null, rows[2]] });
  assert.deepEqual(e.gone, { 3: fake });
});

test('LD-13 a stamp change with no recipe difference still writes an (empty) entry linking the two stamps', () => {
  const { N } = earlierFile((L) => { L.stamp = 'prev 22222222 33333333'; });
  assert.deepEqual(N.changes, [{ from: 'prev 22222222 33333333', to: NOW, recipes: {}, gone: {} }]);
});

test('LD-14 two patches in a row: the earlier entry is kept and the new one chains from its `to`', () => {
  const earlier = { from: 'old 00000000 00000000', to: 'prev 22222222 33333333', recipes: {}, gone: {} };
  const { N, rows, f, cache } = earlierFile((L) => { delete L.recipes[2]; L.stamp = 'prev 22222222 33333333'; L.changes = [earlier]; });
  assert.equal(N.changes.length, 2);
  assert.deepEqual(N.changes[0], earlier);
  assert.equal(N.changes[1].from, earlier.to);
  assert.equal(N.changes[1].to, NOW);
  assert.deepEqual(N.changes[1].recipes, { 2: [null, rows[2]] });
  assert.equal(run(cache, f, 2).status, 0); // a run on the same stamp and recipes adds nothing
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).changes.length, 2);
});

// ---------------------------------------------------------------- work item B2 of docs/lists-look-spec.md (D-C1, D-C2, D-G1, D-G2)
// Spots are [job, nameRow, level, zone, x, y, aetheryte, hours, minutes, folklore, hidden(, spotName)]; job 0 miner, 1 botanist, 2 fisher.
const spotsOf = (item) => D.gather[item] || [];
const everySpot = () => Object.values(D.gather).flat();
const has = (row) => everySpot().some((sp) => JSON.stringify(sp.slice(0, 6)) === JSON.stringify(row));

test('LD-15 five nodes: the game sheets give each its name row, level, zone and map position', () => {
  // Quoted by hand from the pinned sheets (44948e4c). Every node is a GatheringPointBase id (Teamcraft's node id); its
  // ExportedGatheringPoint row holds GatheringType, GatheringPointType (the point type of its GatheringPoint rows) and the world
  // X and Y; Map gives size factor 100 and offsets 0 for the maps below, so x = 41 * (X + 1024) / 2048 + 1 and the same for Y.
  // GatheringPointName: rows 1 to 4 mineral deposit, rocky outcrop, mature tree, lush vegetation patch; 5 to 8 unspoiled.
  // GatheringType: 0 Mining, 1 Quarrying, 2 Logging, 3 Harvesting. Point type 1 is an ordinary node, 2 an unspoiled one.
  // node 10:  GatheringType 2, point type 1, level 10, X 536.716 Y -270,       map 16 = Lower La Noscea   -> row 3, (32.2, 16.1)
  // node 14:  GatheringType 3, point type 1, level 15, X 153.891 Y -134.284,   map 20 = Western Thanalan  -> row 4, (24.6, 18.8)
  // node 20:  GatheringType 1, point type 1, level 40, X 10.3019 Y 328.574,    map 24 = Northern Thanalan -> row 2, (21.7, 28.1)
  // node 47:  GatheringType 0, point type 1, level 25, X -272.097 Y -100.237,  map 6  = South Shroud      -> row 1, (16.1, 19.5)
  // node 211: GatheringType 2, point type 2, level 50, X 383.402 Y -434.948,   map 53 = Coerthas Central Highlands -> row 7, (29.2, 12.8)
  assert.deepEqual([mc(536.716), mc(-270)].map((v) => +v.toFixed(1)), [32.2, 16.1]);
  assert.deepEqual([mc(383.402), mc(-434.948)].map((v) => +v.toFixed(1)), [29.2, 12.8]);
  assert.ok(has([1, 3, 10, 'Lower La Noscea', 32.2, 16.1]), 'node 10, a mature tree');
  assert.ok(has([1, 4, 15, 'Western Thanalan', 24.6, 18.8]), 'node 14, a lush vegetation patch');
  assert.ok(has([0, 2, 40, 'Northern Thanalan', 21.7, 28.1]), 'node 20, a rocky outcrop');
  assert.ok(has([0, 1, 25, 'South Shroud', 16.1, 19.5]), 'node 47, a mineral deposit');
  assert.ok(has([1, 7, 50, 'Coerthas Central Highlands', 29.2, 12.8]), 'node 211, an unspoiled mature tree');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((r) => D.nodeNames[r]), ['Mineral Deposit', 'Rocky Outcrop', 'Mature Tree', 'Lush Vegetation Patch',
    'Unspoiled Mineral Deposit', 'Unspoiled Rocky Outcrop', 'Unspoiled Mature Tree', 'Unspoiled Lush Vegetation Patch']);
  // every row a spot uses has a name; a fishing spot or a spot without a position uses none; no name is made by hand beyond the capitals
  for (const sp of everySpot()) assert.ok(sp[1] === 0 ? (sp.length === 12 || (sp[4] === 0 && sp[5] === 0)) : D.nodeNames[sp[1]], 'row ' + sp[1]);
  for (const sp of everySpot()) { assert.ok(sp[0] >= 0 && sp[0] <= 2); assert.ok(sp[6] === 0 || D.aetherytes[sp[6]]); }
});

test('LD-15b the tool stops when a node cannot be named, mapped or placed, and when an icon is bad', () => {
  const world = () => {
    const x = 100, y = -100;
    return { nodes: { 100: { items: [13], level: 5, type: 0, map: 7, zoneid: 7, x: +mc(x).toFixed(2), y: +mc(y).toFixed(2) } },
      points: [{ '#': 30000, GatheringPointBase: 100, GatheringSubCategory: 0, Type: 1 }], bases: [{ '#': 100, GatheringType: 0, GatheringLevel: 5 }],
      exported: [{ '#': 100, X: x, Y: y, Radius: 10, GatheringType: 0, GatheringPointType: 1 }] };
  };
  const attempt = (edit, icons) => {
    const w = world(); edit(w);
    if (icons) w.icons = icons;
    const cache = tmp(), out = tmp(), f = path.join(out, 'l.json');
    writeCache(cache, { recipes: GOOD(), shops: SHOPS(), world: w });
    return Object.assign(run(cache, f, 2), { f, out });
  };
  const ok = attempt(() => {});
  assert.equal(ok.status, 0, ok.stderr);
  const L = JSON.parse(fs.readFileSync(ok.f, 'utf8'));
  assert.deepEqual(L.gather[13], [[0, 1, 5, 'Test Zone', 23.5, 19.5, 0, 0, 0, 0, 0]]);
  assert.deepEqual(L.nodeNames, { 1: 'Mineral Deposit' });
  assert.equal(fs.readdirSync(path.join(ok.out, 'classjob')).length, 11);
  const stops = (r, re) => { assert.notEqual(r.status, 0); assert.match(r.stderr, re); assert.ok(!fs.existsSync(r.f)); };
  stops(attempt((w) => { w.points = []; }), /STOP.*node 100.*GatheringPoint/);                        // an id that is no GatheringPoint row
  stops(attempt((w) => { w.points[0].Type = 7; w.exported[0].GatheringPointType = 7; }), /STOP.*node 100.*no name row/); // a kind that cannot be named
  stops(attempt((w) => { w.exported[0].GatheringPointType = 2; }), /STOP.*point type/);                // sheets that disagree
  stops(attempt((w) => { w.nodes[100].x += 1; }), /STOP.*game's map scale/);                           // not the game's map scale
  stops(attempt((w) => { w.names = []; }), /STOP.*GatheringPointName/);                               // the name sheet lacks the row
  stops(attempt(() => {}, { fisher: Buffer.from('not a png') }), /STOP.*fisher.*not a PNG/);
  stops(attempt(() => {}, { miner: Buffer.concat([PNG, Buffer.alloc(17 * 1024)]) }), /STOP.*miner.*16 kB/);
});

test('LD-16 a shard that Miner and Botanist both gather lists both jobs; every spot has a position and a name', () => {
  // Fire Shard (2): Teamcraft node 154 is a mineral deposit (GatheringType 0, level 5, X 261.123 Y 209.031: map 20, Western Thanalan,
  // 26.7, 25.7) and node 30 a lush vegetation patch (GatheringType 3, level 15, X 57.6711 Y -118.099: map 15, Middle La Noscea, 22.7, 19.1).
  assert.deepEqual([mc(261.123), mc(209.031), mc(57.6711), mc(-118.099)].map((v) => +v.toFixed(1)), [26.7, 25.7, 22.7, 19.1]);
  const fire = spotsOf(2);
  assert.deepEqual(new Set(fire.map((sp) => sp[0])), new Set([0, 1]));
  assert.deepEqual(fire[0].slice(0, 6), [0, 1, 5, 'Western Thanalan', 26.7, 25.7]);
  assert.ok(fire.some((sp) => JSON.stringify(sp.slice(0, 6)) === JSON.stringify([1, 4, 15, 'Middle La Noscea', 22.7, 19.1])));
  const both = Object.values(D.gather).filter((l) => l.some((sp) => sp[0] === 0) && l.some((sp) => sp[0] === 1));
  assert.ok(both.length >= 15, 'items gathered by both: ' + both.length);
  // best first: lowest level, then the nearest aetheryte (spots without one last), then the node id
  for (const l of Object.values(D.gather)) for (let k = 1; k < l.length; k++) assert.ok(l[k - 1][2] <= l[k][2], 'sorted by level');
});

test('LD-17 a timed unspoiled node carries its window', () => {
  // Node 211 (Spruce Log, 5395): point type 2 (unspoiled), GatheringType 2, level 50. Teamcraft: spawns at Eorzea hour 9, stays 180 minutes.
  // GatheringRarePopTimeTable row 1 (the GatheringPointTransient row of its GatheringPoint 30999): StartTime[0] 900 = 09:00.
  assert.deepEqual(spotsOf(5395), [[1, 7, 50, 'Coerthas Central Highlands', 29.2, 12.8, spotsOf(5395)[0][6], [9], 180, 0, 0]]);
  assert.ok(D.aetherytes[spotsOf(5395)[0][6]]);
  assert.match(D.nodeNames[7], /^Unspoiled /);
  for (const sp of everySpot()) assert.ok((sp[7] === 0 && sp[8] === 0) || (Array.isArray(sp[7]) && sp[7].length && sp[8] > 0));
});

test('LD-18 a folklore node names its book', () => {
  // Tungstite (16724): node 289, GatheringType 0, point type 5 (legendary), level 60; its GatheringPoint row has GatheringSubCategory
  // 2000 (FolkloreBook "Coerthan Mining Folklore"), whose Item is 12238, named "Tome of Geological Folklore - Coerthas" in Item.
  const t = spotsOf(16724);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].slice(0, 3), [0, 13, 60]);
  assert.equal(t[0][9], 'Tome of Geological Folklore - Coerthas');
  assert.equal(D.nodeNames[13], 'Legendary Mineral Deposit');
  assert.ok(everySpot().filter((sp) => sp[9]).length > 50);
  assert.ok(everySpot().filter((sp) => sp[9]).every((sp) => /Folklore/.test(sp[9]) && [13, 14, 15, 16].includes(sp[1])));
  assert.ok(everySpot().some((sp) => sp[10] === 1), 'a hidden item is marked');
});

test('LD-19 an item without a map position keeps its zone when known and has no coordinates', () => {
  const none = Object.entries(D.gather).filter(([, l]) => l.every((sp) => sp[4] === 0 && sp[5] === 0));
  assert.equal(none.length, 17);
  for (const [it, l] of none) { assert.equal(l.length, 1, it); assert.deepEqual(l[0].slice(4), [0, 0, 0, 0, 0, 0, 0]); assert.ok(l[0][2] >= 1); }
  assert.ok(none.some(([it]) => D.items[it][0] === 'Lunar Meteorite'), 'Teamcraft places its nodes on no map');
  assert.ok(!everySpot().some((sp) => sp[4] === 0 && sp[5] === 0 && sp[1] !== 0 && sp[3] !== ''), 'a spot with a position has both');
  // a node that has a zone but no position: the zone stays
  const world = { nodes: { 100: { items: [20], level: 7, type: 2, zoneid: 7 } } };
  const cache = tmp(), f = path.join(tmp(), 'l.json');
  writeCache(cache, { recipes: GOOD(), shops: SHOPS(), world });
  const r = run(cache, f, 2);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')).gather[20], [[1, 0, 7, 'Test Area', 0, 0, 0, 0, 0, 0, 0]]);
});

test('LD-20 a fish carries its fishing spot: name, zone, level and map position', () => {
  // Fishing spot 36: FishingSpot row 36: TerritoryType 128, PlaceName 28 ("Limsa Lominsa Upper Decks"), X 930, Z 1032, level 1; Map 11
  // has size factor 200, so x = 41 / 2 * 930 / 2048 + 1 = 10.3 and y = 41 / 2 * 1032 / 2048 + 1 = 11.3. Spot 35: PlaceName 29
  // ("Limsa Lominsa Lower Decks"), X 668, Z 1120: x = 7.7, y = 12.2. Both give Lominsan Anchovy (4870).
  assert.deepEqual([41 / 2 * 930 / 2048 + 1, 41 / 2 * 1032 / 2048 + 1, 41 / 2 * 668 / 2048 + 1, 41 / 2 * 1120 / 2048 + 1].map((v) => +v.toFixed(1)), [10.3, 11.3, 7.7, 12.2]);
  const f = spotsOf(4870);
  assert.deepEqual(f.slice(0, 3).map((sp) => [sp[0], sp[1], sp[2], sp[3], sp[4], sp[5], sp[11]]), [
    [2, 0, 1, 'Limsa Lominsa Lower Decks', 7.7, 12.2, 'Limsa Lominsa Lower Decks'],
    [2, 0, 1, 'Middle La Noscea', 18.7, 22, 'Zephyr Drift'],
    [2, 0, 1, 'Limsa Lominsa Upper Decks', 10.3, 11.3, 'Limsa Lominsa Upper Decks']]);
  assert.equal(f[0].length, 12);
  assert.ok(D.aetherytes[f[0][6]]);
});

test('LD-21 every crafter of an item is listed, with differing and with identical ingredients', () => {
  // Bronze Ingot (5056): recipe 1 (Blacksmith, level 1: 5106 x2, 5107 x1, Fire Shard) and recipe 170 (Armorer, level 1: 5106 x2, 5107 x1,
  // Ice Shard): the ingredients differ. Item 36122: recipes 31916 (Blacksmith, 50) and 31929 (Armorer, 50) list the same six ingredients.
  assert.deepEqual(D.crafters[5056], [[1, 1, 1], [170, 2, 1]]);
  assert.deepEqual(D.recipes[1][5], [[5106, 2], [5107, 1], [2, 1]]);
  assert.deepEqual(D.recipes[170][5], [[5106, 2], [5107, 1], [3, 1]]);
  assert.deepEqual(D.crafters[36122], [[31916, 1, 50], [31929, 2, 50]]);
  assert.deepEqual(D.recipes[31916][5], D.recipes[31929][5]);
  // every recipe is listed once under its result; the first of an item is the lowest level, then the lowest recipe id
  let n = 0;
  for (const [it, l] of Object.entries(D.crafters)) {
    for (let k = 0; k < l.length; k++) {
      const r = D.recipes[l[k][0]]; n++;
      assert.deepEqual([r[0], r[2], r[3]], [+it, l[k][1], l[k][2]]);
      if (k) assert.ok(l[k - 1][2] < l[k][2] || (l[k - 1][2] === l[k][2] && l[k - 1][0] < l[k][0]));
    }
  }
  assert.equal(n, Object.keys(D.recipes).length);
  assert.equal(Object.values(D.crafters).filter((l) => new Set(l.map((c) => c[1])).size >= 2).length, 600);
});

test('LD-22 the 11 job icons are kept, are PNGs of at most 16 kB, and the built site carries them for the service worker', () => {
  const dir = path.join(__dirname, '..', 'data', 'classjob');
  assert.deepEqual(fs.readdirSync(dir).sort(), JOBS.map((j) => j + '.png').sort());
  for (const j of JOBS) {
    const b = fs.readFileSync(path.join(dir, j + '.png'));
    assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', j);
    assert.ok(b.length <= 16 * 1024, j);
    const built = path.join(__dirname, '..', 'command-center', 'site', 'lists', 'classjob', j + '.png');
    assert.ok(fs.readFileSync(built).equals(b), 'built copy of ' + j);
  }
  const sw = fs.readFileSync(path.join(__dirname, '..', 'command-center', 'site', 'sw.js'), 'utf8');
  for (const j of JOBS) assert.ok(sw.includes('lists/classjob/' + j + '.png'), 'the worker caches ' + j);
});
