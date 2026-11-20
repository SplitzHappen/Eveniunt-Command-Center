'use strict';
// Core logic tests: node --test tests/core.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
for (const f of ['save', 'model', 'codec', 'merge', 'ffxivcollect', 'cloud', 'links', 'storage']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
const ET = globalThis.ET;

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tracker-data.json'), 'utf8'));
const idx = ET.indexData(data);
// sid may name a list split by expansion (e.g. 'fates' for fates-arr ... fates-dt)
const firstKey = (sid, pred) => idx.sections.filter((s) => s.id === sid || s.id.startsWith(sid + '-')).flatMap((s) => ET.sectionKeys(s)).find((k) => pred(idx.byKey.get(k).e));

test('state: 1 to 8 characters, names kept, bad counts refused', () => {
  const st = ET.newState(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.strictEqual(st.chars.length, 8);
  assert.deepStrictEqual(st.chars.map((c) => c.name), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.throws(() => ET.newState([]));
  assert.throws(() => ET.newState(new Array(9).fill('x')));
  ET.setCharacterCount(st, 3);
  assert.strictEqual(st.chars.length, 3);
  assert.deepStrictEqual(Object.keys(st.ticks).sort(), ['c1', 'c2', 'c3']);
  ET.setCharacterCount(st, 5);
  assert.deepStrictEqual(st.chars.map((c) => c.id), ['c1', 'c2', 'c3', 'c4', 'c5']);
});

test('totals: built-in marks leave entries out; manual switch overrides both ways', () => {
  const st = ET.newState(['A', 'B']);
  const sec = idx.sections.find((s) => s.id === 'mounts');
  const keys = ET.sectionKeys(sec);
  const before = ET.tally(idx, st, keys);
  const lim = firstKey('mounts', (e) => e.x === 'lim');
  const normal = firstKey('mounts', (e) => !e.x);
  assert.ok(lim && normal);
  assert.strictEqual(before.total + before.marked, keys.length);

  // An X item switched on by hand counts.
  assert.strictEqual(ET.toggleAvailability(st, lim, idx.byKey.get(lim).e), true);
  assert.strictEqual(st.avail[lim], 'ok');
  assert.strictEqual(ET.tally(idx, st, keys).total, before.total + 1);
  // An obtainable item switched off by hand leaves the count.
  assert.strictEqual(ET.toggleAvailability(st, normal, idx.byKey.get(normal).e), false);
  assert.strictEqual(st.avail[normal], 'x');
  assert.strictEqual(ET.tally(idx, st, keys).total, before.total);
  // Switching back returns to the built-in mark and stores nothing.
  ET.toggleAvailability(st, lim, idx.byKey.get(lim).e);
  ET.toggleAvailability(st, normal, idx.byKey.get(normal).e);
  assert.deepStrictEqual(st.avail, {});
  assert.strictEqual(ET.tally(idx, st, keys).total, before.total);
});

test('totals: ticks on uncounted entries are kept but not added', () => {
  const st = ET.newState(['A']);
  const lim = firstKey('mounts', (e) => e.x === 'lim');
  const normal = firstKey('mounts', (e) => !e.x);
  ET.setTick(st, 'c1', lim, true);
  ET.setTick(st, 'c1', normal, true);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts'));
  assert.strictEqual(ET.tally(idx, st, keys).done.c1, 1);
  st.settings.countLimited = true;
  assert.strictEqual(ET.tally(idx, st, keys).done.c1, 2);
  assert.ok(ET.isTicked(st, 'c1', lim));
});

test('group ticking for several characters at once', () => {
  const st = ET.newState(['A', 'B', 'C']);
  const g = idx.sections.find((s) => s.id === 'minions').groups[0];
  ET.setMany(st, ['c1', 'c3'], g.keys, true);
  assert.strictEqual(Object.keys(st.ticks.c1).length, g.keys.length);
  assert.strictEqual(Object.keys(st.ticks.c2).length, 0);
  ET.setMany(st, ['c1'], g.keys, false);
  assert.strictEqual(Object.keys(st.ticks.c1).length, 0);
});

test('summary covers every section; overall total equals entries minus marked', () => {
  const st = ET.newState(['A']);
  const s = ET.summary(idx, st);
  const entries = data.sections.reduce((n, x) => n + x.g.reduce((m, g) => m + g.e.length, 0), 0);
  const info = data.sections.reduce((n, x) => n + x.g.reduce((m, g) => m + g.e.filter((e) => e.val && !e.max).length, 0), 0);
  assert.strictEqual(s.all.total + s.all.marked + info, entries, 'every entry is counted, marked, or a record-only value');
  assert.strictEqual(Object.keys(s.sections).length, data.sections.length);
});

test('backup file round trip, and wrong files refused', () => {
  const st = ET.newState(['Alpha', 'Beta']);
  ET.setTick(st, 'c2', firstKey('orchestrion', () => true), true);
  ET.setAvailability(st, firstKey('mounts', () => true), 'x');
  const back = ET.importFile(ET.exportFile(st));
  assert.deepStrictEqual(back.ticks, st.ticks);
  assert.deepStrictEqual(back.avail, st.avail);
  assert.deepStrictEqual(back.chars.map((c) => c.name), ['Alpha', 'Beta']);
  assert.throws(() => ET.importFile('{"hello":1}'));
  assert.throws(() => ET.importFile('not json'));
});

test('transfer code: full 8-character state fits in a short code and decodes exactly', async () => {
  const st = ET.newState(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const all = [...idx.byKey.keys()];
  // Each character ticks a different 40% of everything.
  st.chars.forEach((c, n) => { for (let i = n; i < all.length; i += 5) if (i % 2 === 0 || n % 2) st.ticks[c.id][all[i]] = 1; });
  ET.setAvailability(st, all[3], 'ok');
  const code = await ET.makeTransferCode(st);
  const back = await ET.readTransferCode(code);
  assert.deepStrictEqual(back.ticks, st.ticks);
  assert.deepStrictEqual(back.avail, st.avail);
  assert.ok(code.startsWith('EVT2-'));
  assert.ok(code.length < 200000, 'code length ' + code.length);
  await assert.rejects(ET.readTransferCode(code.slice(0, 40)));
  await assert.rejects(ET.readTransferCode('hello'));
});

test('three-way merge: one-sided changes merge, two-sided differences become conflicts', () => {
  const base = ET.newState(['A', 'B']);
  const k1 = firstKey('mounts', () => true), k2 = firstKey('minions', () => true), k3 = firstKey('emotes', () => true);
  ET.setTick(base, 'c1', k1, true);
  const local = JSON.parse(JSON.stringify(base));
  const remote = JSON.parse(JSON.stringify(base));
  ET.setTick(local, 'c1', k2, true); // only here
  ET.setTick(remote, 'c2', k3, true); // only there
  ET.setTick(local, 'c1', k1, false); // removed here, kept there -> one-sided, removal wins
  ET.setAvailability(local, k3, 'x');
  ET.setAvailability(remote, k3, 'ok'); // conflict
  const res = ET.threeWay(ET.portable(base), ET.portable(local), ET.portable(remote));
  assert.strictEqual(res.conflicts.length, 1);
  assert.strictEqual(res.conflicts[0].id, 'a|' + k3);
  const st = JSON.parse(JSON.stringify(local));
  ET.applyMerge(st, res, { ['a|' + k3]: 'remote' });
  assert.ok(st.ticks.c1[k2]);
  assert.ok(st.ticks.c2[k3]);
  assert.ok(!st.ticks.c1[k1]);
  assert.strictEqual(st.avail[k3], 'ok');
  const d = ET.describeConflict(res.conflicts[0], idx, st);
  assert.match(d.local, /unobtainable/);
});

function fakeFc(owned, status) {
  return async (url) => {
    const m = url.match(/characters\/(\d+)(?:\/(\w+)\/owned)?$/);
    if (!m) return { ok: false, status: 404 };
    if (!m[2]) return { ok: true, status: 200, json: async () => ({ id: Number(m[1]), name: 'Test' }) };
    if (status && status[m[2]]) return { ok: false, status: status[m[2]] };
    return { ok: true, status: 200, json: async () => (owned[m[2]] || []).map((id) => ({ id })) };
  };
}

test('online refresh: first refresh asks; later new acquisitions apply automatically; clashes ask', async () => {
  const st = ET.newState(['A']);
  const mounts = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).map((k) => idx.byKey.get(k).e);
  const [m1, m2, m3] = mounts;
  let owned = await ET.fetchOwned('123', fakeFc({ mounts: [m1.i] }, { achievements: 403 }));
  assert.strictEqual(owned.unavailable.achievements, 'private on the Lodestone');
  let rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.strictEqual(rec.auto.length, 0);
  assert.strictEqual(rec.ask.length, 1);
  ET.acceptRefresh(st, 'c1', owned, rec, { [rec.ask[0].key]: 'online' });
  assert.ok(ET.isTicked(st, 'c1', 'mounts:' + m1.i));

  // Later: m2 newly owned online (auto); the user unticked m1 locally but it is still owned online (ask);
  // the user ticked m3 locally but it is not owned online (ask).
  ET.setTick(st, 'c1', 'mounts:' + m1.i, false);
  ET.setTick(st, 'c1', 'mounts:' + m3.i, true);
  owned = await ET.fetchOwned('123', fakeFc({ mounts: [m1.i, m2.i] }));
  rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.auto.map((a) => a.key), ['mounts:' + m2.i]);
  assert.deepStrictEqual(rec.ask.map((a) => a.key).sort(), ['mounts:' + m1.i, 'mounts:' + m3.i].sort());
  ET.acceptRefresh(st, 'c1', owned, rec, { ['mounts:' + m1.i]: 'online', ['mounts:' + m3.i]: 'local' });
  assert.ok(ET.isTicked(st, 'c1', 'mounts:' + m1.i));
  assert.ok(ET.isTicked(st, 'c1', 'mounts:' + m2.i));
  assert.ok(ET.isTicked(st, 'c1', 'mounts:' + m3.i));
});

test('online refresh: a difference answered with "this device is right" is not asked again until a side changes', async () => {
  const st = ET.newState(['A']);
  const [m1, m2, m3] = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).map((k) => idx.byKey.get(k).e);
  ET.setTick(st, 'c1', 'mounts:' + m2.i, true); // ticked by hand, not on FFXIV Collect
  let owned = await ET.fetchOwned('123', fakeFc({ mounts: [m1.i] }));
  let rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.ask.map((a) => a.key).sort(), ['mounts:' + m1.i, 'mounts:' + m2.i].sort(), 'first refresh asks both');
  ET.acceptRefresh(st, 'c1', owned, rec, { ['mounts:' + m1.i]: 'local', ['mounts:' + m2.i]: 'local' });
  rec = ET.reconcileOwned(idx, st, 'c1', owned); // the same online lists the next day
  assert.deepStrictEqual(rec.ask, [], 'nothing asked again while nothing changed');
  assert.deepStrictEqual(rec.auto, []);
  assert.ok(ET.isTicked(st, 'c1', 'mounts:' + m2.i) && !ET.isTicked(st, 'c1', 'mounts:' + m1.i), 'the answers stand');
  owned = await ET.fetchOwned('123', fakeFc({ mounts: [m1.i, m3.i] })); // m3 newly owned online: applied; m1 unchanged: still not asked
  rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.auto.map((a) => a.key), ['mounts:' + m3.i]);
  assert.deepStrictEqual(rec.ask, []);
  ET.acceptRefresh(st, 'c1', owned, rec, {});
  owned = await ET.fetchOwned('123', fakeFc({ mounts: [m1.i, m2.i, m3.i] })); // m2 now owned online too: agreement, nothing to ask
  rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.ask, []);
  ET.acceptRefresh(st, 'c1', owned, rec, {});
  ET.setTick(st, 'c1', 'mounts:' + m1.i, true); ET.setTick(st, 'c1', 'mounts:' + m1.i, false); // still unticked here
  owned = await ET.fetchOwned('123', fakeFc({ mounts: [m2.i, m3.i] })); // m1 no longer owned online: the sides now agree
  rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.ask, []);
  // an answered difference returns when a side changes: m2 unticked here while owned online
  ET.setTick(st, 'c1', 'mounts:' + m2.i, false);
  rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.ask.map((a) => a.key), ['mounts:' + m2.i]);
  // "FFXIV Collect is right" forgets the remembered answer
  ET.acceptRefresh(st, 'c1', owned, rec, { ['mounts:' + m2.i]: 'online' });
  assert.ok(ET.isTicked(st, 'c1', 'mounts:' + m2.i));
  assert.strictEqual(st.sync.fc.c1.answered['mounts:' + m2.i], undefined);
});

test('online refresh: an empty collection on FFXIV Collect is "not recorded there", never "owns none"', async () => {
  const st = ET.newState(['A']);
  const rolls = ET.sectionKeys(idx.sections.find((s) => s.id === 'orchestrion')).slice(0, 50);
  rolls.forEach((k) => ET.setTick(st, 'c1', k, true));
  const owned = await ET.fetchOwned('123', fakeFc({ orchestrions: [], mounts: [] }));
  assert.strictEqual(owned.unavailable.orchestrions, 'nothing recorded on FFXIV Collect');
  assert.strictEqual(owned.ok.orchestrions, undefined);
  const rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.ask, [], 'never offers to untick 50 hand-ticked rolls because the online list is empty');
});

test('online refresh: hairstyles and facewear use FFXIV Collect ids', async () => {
  const st = ET.newState(['A']);
  const hk = firstKey('hairstyles', (e) => e.fc != null);
  const e = idx.byKey.get(hk).e;
  const owned = await ET.fetchOwned('1', fakeFc({ hairstyles: [e.fc] }));
  const rec = ET.reconcileOwned(idx, st, 'c1', owned);
  assert.deepStrictEqual(rec.ask.map((a) => a.key), [hk]);
});

test('online refresh: no connection leaves everything as it is', async () => {
  const owned = await ET.fetchOwned('1', async () => { throw new TypeError('Failed to fetch'); });
  assert.strictEqual(owned.offline, true);
  assert.deepStrictEqual(owned.ok, {});
});

test('parse Lodestone ids from numbers or URLs', () => {
  assert.strictEqual(ET.parseLodestoneId('https://na.finalfantasyxiv.com/lodestone/character/12345678/'), '12345678');
  assert.strictEqual(ET.parseLodestoneId(' 987654 '), '987654');
  assert.strictEqual(ET.parseLodestoneId('abc'), null);
});

test('OneDrive sync with a fake OneDrive: create, merge, conflict, finish', async () => {
  const fake = fakeGraph().f;
  const k1 = firstKey('mounts', () => true), k2 = firstKey('minions', () => true);
  const pc = ET.newState(['A']);
  assert.deepStrictEqual(await ET.cloudSync(pc, 'tok', fake), { done: true, created: true });
  const phone = ET.newState(['A']);
  assert.strictEqual((await ET.cloudSync(phone, 'tok', fake)).done, true);
  ET.setTick(phone, 'c1', k1, true);
  await ET.cloudSync(phone, 'tok', fake);
  ET.setTick(pc, 'c1', k2, true);
  assert.strictEqual((await ET.cloudSync(pc, 'tok', fake)).done, true);
  assert.ok(pc.ticks.c1[k1] && pc.ticks.c1[k2]);
  // conflict: both rename the character differently
  ET.renameCharacter(pc, 'c1', 'PC name');
  ET.renameCharacter(phone, 'c1', 'Phone name');
  await ET.cloudSync(phone, 'tok', fake);
  const r = await ET.cloudSync(pc, 'tok', fake);
  assert.strictEqual(r.done, false);
  assert.strictEqual(r.conflicts.length, 1);
  await ET.cloudFinish(pc, 'tok', r, { [r.conflicts[0].id]: 'remote' }, fake);
  assert.strictEqual(pc.chars[0].name, 'Phone name');
});

require(path.join(__dirname, '..', 'src', 'core', 'importer.js'));

test('desktop-app import: game-id areas land on the right entries; others are reported, not guessed', () => {
  const pick = (sid) => idx.byKey.get(ET.sectionKeys(idx.sections.find((s) => s.id === sid))[0]).e;
  const mount = pick('mounts'), quest = pick('quests-side-arr'), recipe = pick('craft-carpenter');
  const hair = idx.byKey.get(firstKey('hairstyles', (e) => e.al && e.al.length > 1)).e;
  const save = {
    version: '1.0.5', 'starting-class': '', custom: {}, 'bookmarked-groups': [], 'bookmarked-tasks': [],
    overall: {
      character: {
        'mount-guide': { [mount.i]: 'Y', 999999: 'Y' },
        character: { aesthetician: { [hair.al[1]]: 'Y' }, 'classes--jobs': { 0: '90', 1: '0' } },
      },
      duty: { quest: { sidequests: { any: { [quest.i]: 'Y' } } } },
      logs: { 'crafting-log': { carpenter: { 'level-based': { '1-5': { [recipe.i]: 'Y' } } } }, 'hunting-log': { gladiator: { 0: 'Y' } } },
      travel: { aetherytes: { 'la-noscea': { 0: 'Y', 1: 'Y' } } },
    },
  };
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'desktop-map.json'), 'utf8'));
  const r0 = ET.importDesktopSave(idx, JSON.stringify(save)); // without the position map
  assert.ok(!r0.ticks['aetherytes:' + 2] || true);
  const r = ET.importDesktopSave(idx, JSON.stringify(save), map);
  assert.ok(r.ticks['mounts:' + mount.i]);
  assert.ok(r.ticks['quests-side-arr:' + quest.i]);
  assert.ok(r.ticks['craft-carpenter:' + recipe.i]);
  assert.ok(r.ticks['hairstyles:' + hair.i], 'hairstyle matched through its race/gender row');
  const glad = idx.sections.find((s) => s.id === 'hunting').groups.find((g) => g.c === 'Gladiator');
  const page1 = glad.keys.filter((k) => idx.byKey.get(k).e.pg === 1);
  assert.ok(page1.length >= 1 && page1.every((k) => r.ticks[k]), 'hunting log page 1 targets ticked');
  assert.strictEqual(r.done, 8);
  assert.strictEqual(r.placed, 7, 'aetherytes placed through the position map');
  assert.deepStrictEqual(r.notPlaced.map((x) => x.area), ['character / mount-guide']);
  assert.strictEqual(r0.placed, 5);
  // Master crafting books are positions, never recipe ids.
  const books = ET.importDesktopSave(idx, { version: '1.0.5', overall: { logs: { 'crafting-log': { 'master-crafting-books': { 0: 'Y' } } } } }, map);
  assert.deepStrictEqual(Object.keys(books.ticks), ['masterbooks:1']);
  assert.deepStrictEqual(r.levels, []);
  assert.deepStrictEqual(r.vals, { 'levels:1': 90 }, 'job level imported as a value (first job in the list)');
  const st = ET.newState(['A', 'B']);
  ET.setTick(st, 'c2', 'mounts:' + pick('mounts').i, false);
  ET.applyImport(st, 'c2', r, 'add');
  assert.ok(ET.isTicked(st, 'c2', 'mounts:' + mount.i));
  assert.strictEqual(ET.getValue(st, 'c2', 'levels:1'), 90);
  assert.ok(!ET.isTicked(st, 'c2', 'levels:1'), 'level 90 is below the cap of 100');
  ET.setValue(st, 'c2', 'levels:1', 100, idx.byKey.get('levels:1').e);
  assert.ok(ET.isTicked(st, 'c2', 'levels:1'), 'reaching the cap ticks it');
  assert.strictEqual(Object.keys(st.ticks.c1).length, 0);
  assert.throws(() => ET.importDesktopSave(idx, '{"a":1}'));
  assert.strictEqual(ET.nameFromDesktopFile('Test Hero (Exampleworld) - FFXIV Completionist.json'), 'Test Hero');
});

test('availability unknown entries are not counted until switched on', () => {
  const st = ET.newState(['A']);
  const k = firstKey('fates', (e) => e.x === 'unk');
  assert.ok(k);
  assert.strictEqual(ET.availability(st, k, idx.byKey.get(k).e).counted, false);
  ET.toggleAvailability(st, k, idx.byKey.get(k).e);
  assert.strictEqual(ET.availability(st, k, idx.byKey.get(k).e).counted, true);
});

test('per-character exclusion: left out of that character only; travels in files, codes and merges', async () => {
  const st = ET.newState(['A', 'B']);
  const sec = idx.sections.find((s) => s.id === 'quests-side-arr');
  const keys = ET.sectionKeys(sec);
  const k = keys.find((x) => ET.availability(st, x, idx.byKey.get(x).e).counted);
  const before = ET.tally(idx, st, keys);
  ET.setExcluded(st, 'c1', k, true);
  const after = ET.tally(idx, st, keys);
  assert.strictEqual(after.totals.c1, before.totals.c1 - 1);
  assert.strictEqual(after.totals.c2, before.totals.c2);
  assert.ok(ET.importFile(ET.exportFile(st)).excl.c1[k]);
  assert.ok((await ET.readTransferCode(await ET.makeTransferCode(st))).excl.c1[k]);
  const base = ET.newState(['A', 'B']);
  const res = ET.threeWay(ET.portable(base), ET.portable(st), ET.portable(base));
  const m = ET.applyMerge(JSON.parse(JSON.stringify(base)), res, {});
  assert.ok(m.excl.c1[k]);
  // desktop-app X marks become exclusions for the imported character
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'desktop-map.json'), 'utf8'));
  const q = idx.byKey.get(k).e;
  const r = ET.importDesktopSave(idx, { version: '1.0.5', overall: { duty: { quest: { sidequests: { x: { [q.i]: 'X' } } } } } }, map);
  assert.deepStrictEqual(Object.keys(r.excl), [k]);
  ET.applyImport(st, 'c2', r, 'add');
  assert.ok(ET.isExcluded(st, 'c2', k));
});

test('starting class and Grand Company decide what applies; the importer works them out from X marks', () => {
  const st = ET.newState(['A', 'B']);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'quests-msq-arr'));
  const gri = keys.find((k) => idx.byKey.get(k).e.city === 'gri');
  const uld = keys.find((k) => idx.byKey.get(k).e.city === 'uld');
  const before = ET.tally(idx, st, keys).totals.c1;
  ET.setStart(st, 'c1', 'gla', 3);
  assert.strictEqual(ET.cityOf(st.chars[0]), 'uld');
  assert.strictEqual(ET.notApplicable(st, st.chars[0], gri, idx.byKey.get(gri).e), 'city');
  assert.strictEqual(ET.notApplicable(st, st.chars[0], uld, idx.byKey.get(uld).e), null);
  assert.ok(ET.tally(idx, st, keys).totals.c1 < before);
  assert.strictEqual(ET.tally(idx, st, keys).totals.c2, before, 'a character without a class keeps everything');
  // starting class travels in files and codes
  assert.strictEqual(ET.importFile(ET.exportFile(st)).chars[0].cls, 'gla');
  // inference: X on Gridania and Limsa city quests, ticks on an Ul'dah one -> Ul'dah
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'desktop-map.json'), 'utf8'));
  const lim = keys.find((k) => idx.byKey.get(k).e.city === 'lim');
  const id = (k) => idx.byKey.get(k).e.i;
  const r = ET.importDesktopSave(idx, { version: '1.0.5', overall: { duty: { quest: { 'main-scenario': { a: { [id(gri)]: 'X', [id(lim)]: 'X', [id(uld)]: 'Y' } } } } } }, map);
  assert.strictEqual(r.infer.city, 'uld');
  assert.deepStrictEqual(r.excl, {}, 'X marks explained by the starting city are not kept as manual marks');
  const st2 = ET.newState(['C']);
  ET.applyImport(st2, 'c1', r, 'add');
  assert.strictEqual(ET.cityOf(st2.chars[0]), 'uld');
});

// ---------------------------------------------------------------- red-team fixes (2026-11-08)
const backupDoc = (state) => JSON.stringify({ app: 'eveniunt-completionist-tracker', state: Object.assign({ v: 1, ticks: {} }, state) });

test('red team: a crafted backup cannot reach Object.prototype or smuggle markup into the page', () => {
  assert.throws(() => ET.importFile(backupDoc({ chars: [{ id: '__proto__', name: 'x' }] })), /character ids/);
  assert.throws(() => ET.importFile(backupDoc({ chars: [{ id: 'c1"><b>', name: 'x' }] })), /character ids/);
  const st = ET.importFile(backupDoc({
    chars: [{ id: 'c1', name: '<img src=x onerror=alert(1)>' + 'y'.repeat(80), city: '"><img src=x>', gc: 'x', lodestone: '"><b>' }],
    ticks: { c1: { 'mounts:1': 1, '__proto__': 1, 'bad key': 1 }, c9: { 'mounts:2': 1 } },
    vals: { c1: { 'levels:1': '"><b>', 'levels:2': '90', 'levels:3': -5 } },
    avail: { 'mounts:3': 'x', 'mounts:4': '<b>' },
    settings: { countLimited: 'yes', extra: 1 },
  }));
  assert.strictEqual(({})['mounts:1'], undefined);
  assert.deepStrictEqual(Object.keys(st.ticks.c1), ['mounts:1']);
  assert.deepStrictEqual(Object.keys(st.ticks), ['c1']);
  assert.ok(st.chars[0].name.length <= 40);
  assert.strictEqual(st.chars[0].city, undefined);
  assert.strictEqual(st.chars[0].gc, null);
  assert.strictEqual(st.chars[0].lodestone, null);
  assert.deepStrictEqual(st.vals.c1, { 'levels:2': 90 });
  assert.deepStrictEqual(st.avail, { 'mounts:3': 'x' });
  assert.deepStrictEqual(st.settings, { countLimited: false, countGone: false, countUnknown: false, links: true, gold: true });
});

test('red team: a backup file cannot plant cloud-sync bookkeeping (file id, merge base) or refresh lists', () => {
  const st = ET.importFile(backupDoc({ chars: [{ id: 'c1', name: 'A' }], sync: { drive: { fileId: 'planted', at: 'x', base: { ticks: { c1: { 'mounts:1': 1 } } } }, fc: { c1: { owned: 5 } }, backupAt: 1 } }));
  assert.deepStrictEqual(st.sync, { fc: {}, drive: null, backupAt: null });
});

test('red team: transfer codes that are damaged, huge or malformed are refused with a plain message', async () => {
  await assert.rejects(ET.readTransferCode('EVT1-' + 'A'.repeat(5 * 1024 * 1024)), /far too long/);
  await assert.rejects(ET.readTransferCode('EVT1-abc'), /incomplete or damaged/);
  const st = ET.newState(['A', 'B']);
  ET.setTick(st, 'c2', firstKey('mounts', () => true), true);
  const back = await ET.readTransferCode(await ET.makeTransferCode(st));
  assert.deepStrictEqual(back.ticks.c2, st.ticks.c2);
});

test('removing a character also removes its levels, so a new character in that column starts empty', () => {
  const st = ET.newState(['A', 'B']);
  ET.setValue(st, 'c2', 'levels:1', 90, null);
  ET.setCharacterCount(st, 1);
  ET.setCharacterCount(st, 2);
  assert.deepStrictEqual(st.vals.c2, {});
});

test('Lodestone numbers: a bare number or a character page address only', () => {
  assert.strictEqual(ET.parseLodestoneId('12345678'), '12345678');
  assert.strictEqual(ET.parseLodestoneId('https://na.finalfantasyxiv.com/lodestone/character/12345678/'), '12345678');
  assert.strictEqual(ET.parseLodestoneId('https://eu.finalfantasyxiv.com/lodestone/character/987654/achievement/'), '987654');
  assert.strictEqual(ET.parseLodestoneId('https://na.finalfantasyxiv.com/lodestone/freecompany/9229001536389012345/'), null);
});

test('merged entries: ticks saved under an old variant id move to the kept entry', () => {
  const hit = [...idx.byKey].find(([, h]) => h.e.al && h.e.al.length);
  assert.ok(hit, 'the data has merged entries');
  const [key, h] = hit;
  const old = h.s.id + ':' + h.e.al[0];
  const st = ET.newState(['A']);
  st.ticks.c1[old] = 1;
  assert.strictEqual(ET.migrateAliases(idx, st), 1);
  assert.ok(st.ticks.c1[key] && !st.ticks.c1[old]);
});

// A stand-in for OneDrive's file service (Microsoft Graph): one file in the app folder, with an eTag per write and
// "write only if unchanged" (412 when the If-Match eTag is stale), as the real service does.
function fakeGraph() {
  const files = {}, etag = {}, fail = { put: 0 }, hooks = {};
  let clock = 0;
  const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
  const f = async (url, opts = {}) => {
    const method = opts.method || 'GET', h = opts.headers || {};
    if (url.includes('/me/drive/special/approot:/') && url.includes('select=')) return files.f1 ? json({ id: 'f1', eTag: etag.f1, size: 1, '@microsoft.graph.downloadUrl': 'https://dl.example/f1' }) : json({ error: { code: 'itemNotFound' } }, 404);
    if (url === 'https://dl.example/f1') return json(files.f1);
    if (method === 'PUT' && url.includes(':/content')) {
      if (fail.put) { fail.put--; return json({}, 500); }
      if (h['If-Match'] && h['If-Match'] !== etag.f1) return json({}, 412);
      files.f1 = JSON.parse(opts.body); etag.f1 = 'e' + (++clock);
      if (hooks.afterPut) { const hk = hooks.afterPut; hooks.afterPut = null; await hk(); }
      return json({ id: 'f1', eTag: etag.f1 });
    }
    return json({}, 400);
  };
  return { f, files, fail, hooks, touch: (id, doc) => { files[id] = doc; etag[id] = 'e' + (++clock); } };
}

test('cloud sync: a damaged cloud copy never wipes this device', async () => {
  const d = fakeGraph();
  const st = ET.newState(['A']);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 5);
  keys.forEach((k) => ET.setTick(st, 'c1', k, true));
  await ET.cloudSync(st, 'tok', d.f);
  d.touch('f1', {}); // emptied or replaced by something else
  await assert.rejects(ET.cloudSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  assert.strictEqual(Object.keys(st.ticks.c1).length, 5);
  await ET.cloudOverwrite(st, 'tok', d.f);
  assert.strictEqual(Object.keys((await ET.readCloud(d.files.f1)).ticks.c1).length, 5);
});

test('cloud sync: a large removal from the other device is held for confirmation', async () => {
  const d = fakeGraph();
  const pc = ET.newState(['A']);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 120);
  keys.forEach((k) => ET.setTick(pc, 'c1', k, true));
  await ET.cloudSync(pc, 'tok', d.f);
  const phone = ET.newState(['A']);
  await ET.cloudSync(phone, 'tok', d.f); // the phone takes the 120 ticks
  assert.strictEqual(Object.keys(phone.ticks.c1).length, 120);
  phone.ticks.c1 = {}; phone.updated = Date.now(); // cleared by mistake on the phone
  await ET.cloudSync(phone, 'tok', d.f);
  const r = await ET.cloudSync(pc, 'tok', d.f);
  assert.strictEqual(r.done, false);
  assert.strictEqual(r.loss, 120);
  assert.strictEqual(Object.keys(pc.ticks.c1).length, 120, 'nothing removed before the owner confirms');
});

test('cloud sync: if another device writes between reading and writing, nothing is overwritten', async () => {
  const d = fakeGraph();
  const a = ET.newState(['A']);
  await ET.cloudSync(a, 'tok', d.f);
  ET.renameCharacter(a, 'c1', 'Name on A');
  const b = ET.newState(['A']);
  await ET.cloudSync(b, 'tok', d.f);
  ET.renameCharacter(b, 'c1', 'Name on B');
  await ET.cloudSync(b, 'tok', d.f);
  const r = await ET.cloudSync(a, 'tok', d.f); // conflict on the name: waits for the owner
  assert.strictEqual(r.done, false);
  const k = firstKey('mounts', () => true);
  ET.setTick(b, 'c1', k, true);
  await ET.cloudSync(b, 'tok', d.f); // meanwhile B syncs again
  await assert.rejects(ET.cloudFinish(a, 'tok', r, {}, d.f), (e) => e.code === 'changed');
  assert.ok((await ET.readCloud(d.files.f1)).ticks.c1[k], "B's newer tick is still in the cloud");
});

test('cloud sync: the merged copy is validated (a cloud file with an odd character is refused; odd keys are ignored)', async () => {
  const d = fakeGraph();
  const st = ET.newState(['A']);
  await ET.cloudSync(st, 'tok', d.f);
  const bad = JSON.parse(JSON.stringify(await ET.readCloud(d.files.f1)));
  bad.chars.push({ id: '__proto__', name: 'x' }); bad.ticks.__proto__ = { 'mounts:1': 1 };
  d.touch('f1', bad);
  await assert.rejects(ET.cloudSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  const doc = JSON.parse(JSON.stringify(await ET.readCloud(d.files.f1)));
  doc.chars.pop(); doc.ticks.c1 = { 'mounts:1': 1, '<b>': 1 };
  d.touch('f1', doc);
  await ET.cloudSync(st, 'tok', d.f);
  assert.deepStrictEqual(st.chars.map((c) => c.id), ['c1']);
  assert.deepStrictEqual(Object.keys(st.ticks.c1), ['mounts:1']);
  assert.strictEqual(({})['mounts:1'], undefined);
});

test('cloud sync: a copy missing a character\'s ticks, or of another app, is refused; any removal from the other device asks first', async () => {
  const d = fakeGraph();
  const st = ET.newState(['A']);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 10);
  keys.forEach((k) => ET.setTick(st, 'c1', k, true));
  await ET.cloudSync(st, 'tok', d.f);
  const noMap = JSON.parse(JSON.stringify(await ET.readCloud(d.files.f1))); delete noMap.ticks.c1;
  d.touch('f1', noMap);
  await assert.rejects(ET.cloudSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  d.touch('f1', Object.assign({}, JSON.parse(JSON.stringify(st.sync.drive.base)), { app: 'something-else', v: 1 }));
  await assert.rejects(ET.cloudSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  const one = JSON.parse(JSON.stringify(st.sync.drive.base)); one.app = 'eveniunt-completionist-tracker'; one.v = ET.STATE_VERSION; delete one.ticks.c1[keys[0]];
  d.touch('f1', one); // one tick removed on the other device
  const r = await ET.cloudSync(st, 'tok', d.f);
  assert.strictEqual(r.done, false);
  assert.strictEqual(r.loss, 1, 'even one removal is confirmed');
  assert.strictEqual(Object.keys(st.ticks.c1).length, 10);
});

test('cloud sync: a failed upload leaves this device unchanged; ticks made during the upload are kept', async () => {
  const d = fakeGraph();
  const a = ET.newState(['A']);
  await ET.cloudSync(a, 'tok', d.f);
  const b = ET.newState(['A']);
  await ET.cloudSync(b, 'tok', d.f);
  const [k1, k2, k3] = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 3);
  ET.setTick(b, 'c1', k1, true);
  await ET.cloudSync(b, 'tok', d.f);
  d.fail.put = 1;
  await assert.rejects(ET.cloudSync(a, 'tok', d.f), /answered 500/);
  assert.ok(!a.ticks.c1[k1], 'nothing merged here when the upload failed');
  d.hooks.afterPut = () => { ET.setTick(a, 'c1', k2, true); }; // ticked on this device while the upload runs
  await ET.cloudSync(a, 'tok', d.f);
  assert.ok(a.ticks.c1[k1] && a.ticks.c1[k2]);
  ET.setTick(a, 'c1', k3, true);
  await ET.cloudSync(a, 'tok', d.f);
  assert.ok((await ET.readCloud(d.files.f1)).ticks.c1[k2] && (await ET.readCloud(d.files.f1)).ticks.c1[k3], 'the tick made during the upload reaches the cloud on the next sync');
});

test('cloud sync: two devices writing at the same moment end with both devices\' ticks (OneDrive writes only if unchanged)', async () => {
  const d = fakeGraph();
  const a = ET.newState(['A']);
  await ET.cloudSync(a, 'tok', d.f);
  const b = ET.newState(['A']);
  await ET.cloudSync(b, 'tok', d.f);
  const [ka, kb] = ET.sectionKeys(idx.sections.find((s) => s.id === 'minions')).slice(0, 2);
  ET.setTick(a, 'c1', ka, true); ET.setTick(b, 'c1', kb, true);
  // B read the cloud copy (and passed its check) before A wrote; A's write lands first
  const readByB = { result: ET.threeWay(b.sync.drive.base, ET.portable(b), b.sync.drive.base), fileId: 'f1', eTag: 'e1', remote: b.sync.drive.base };
  await ET.cloudSync(a, 'tok', d.f);
  // B's write, made from the older copy (so without A's tick), is refused: the copy is no longer the one B read
  await assert.rejects(ET.cloudFinish(b, 'tok', readByB, {}, d.f), (e) => e.code === 'changed', 'OneDrive refuses the stale write');
  assert.ok((await ET.readCloud(d.files.f1)).ticks.c1[ka] && !(await ET.readCloud(d.files.f1)).ticks.c1[kb], "the cloud copy still holds A's tick and nothing of B's");
  assert.ok(b.ticks.c1[kb] && !b.ticks.c1[ka], 'B is unchanged by the refused write');
  await ET.cloudSync(b, 'tok', d.f); // the automatic second sync combines both
  await ET.cloudSync(a, 'tok', d.f);
  assert.ok((await ET.readCloud(d.files.f1)).ticks.c1[ka] && (await ET.readCloud(d.files.f1)).ticks.c1[kb], 'the cloud copy has both ticks');
  assert.ok(a.ticks.c1[kb] && b.ticks.c1[ka], 'and so do both devices');
});

test('saving: a window that saves after another window saved combines both instead of overwriting', () => {
  const [k1, k2, k3] = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 3);
  const loaded = ET.newState(['A']); ET.setTick(loaded, 'c1', k3, true);
  const base = JSON.parse(JSON.stringify(ET.portable(loaded)));
  const w1 = JSON.parse(JSON.stringify(loaded)); ET.setTick(w1, 'c1', k1, true); // window 1 saved first (stored now)
  const w2 = JSON.parse(JSON.stringify(loaded)); ET.setTick(w2, 'c1', k2, true); ET.setTick(w2, 'c1', k3, false); // window 2
  const same = ET.saveMerge(w2, 'r1', w1, 'r1', base);
  assert.strictEqual(same.merged, false, 'no other save since: written as is');
  const r = ET.saveMerge(w2, 'r2', w1, 'r1', base);
  assert.strictEqual(r.merged, true);
  assert.deepStrictEqual(Object.keys(r.state.ticks.c1).sort(), [k1, k2].sort(), "window 1's tick kept, window 2's tick added and its removal applied");
});

test('class quests: each starting class does only one route of its first class quests', () => {
  const sec = idx.sections.find((s) => s.id === 'quests-cj-war');
  const CJ = 'quests-cj-war:';
  const gla = sec.groups.find((g) => g.t === 'Gladiator Quests').keys.map((k) => idx.byKey.get(k).e);
  const ways = gla.filter((e) => e.n === 'Way of the Gladiator');
  assert.strictEqual(ways.length, 2);
  const starter = ways.find((e) => e.sc === 'gla'), joiner = ways.find((e) => e.jc === 'gla');
  assert.ok(starter && joiner);
  const st = ET.newState(['G', 'P', 'N']);
  ET.setStart(st, 'c1', 'gla', null); ET.setStart(st, 'c2', 'pgl', null);
  const [g, p, n] = st.chars;
  assert.strictEqual(ET.notApplicable(st, g, CJ + joiner.i, joiner), 'cls');
  assert.strictEqual(ET.notApplicable(st, g, CJ + starter.i, starter), null);
  assert.strictEqual(ET.notApplicable(st, p, CJ + starter.i, starter), 'cls');
  assert.strictEqual(ET.notApplicable(st, p, CJ + joiner.i, joiner), null);
  assert.strictEqual(ET.notApplicable(st, n, CJ + joiner.i, joiner), null, 'unknown starting class: both count');
  // the guild's "So You Want to Be a Gladiator" is the joiner route's first step
  const sywtb = firstKey('quests-cj-war', (e) => e.n === 'So You Want to Be a Gladiator');
  assert.strictEqual(idx.byKey.get(sywtb).e.jc, 'gla');
  // every same-named pair in the list is now one route each
  for (const grp of idx.sections.filter((x) => x.id.startsWith('quests-cj-')).flatMap((x) => x.groups)) {
    const seen = new Map();
    for (const k of grp.keys) { const e = idx.byKey.get(k).e; if (seen.has(e.n)) { const o = seen.get(e.n); assert.ok((o.sc && e.jc) || (o.jc && e.sc), grp.t + ': ' + e.n); } else seen.set(e.n, e); }
  }
  assert.throws(() => ET.setStart(st, 'c1', undefined, 7), /Unknown Grand Company/);
  // a desktop-app save ticks the joiner version (the app lists one version): for a starter it moves to the starter version
  st.ticks.c1[CJ + joiner.i] = 1; st.ticks.c1[sywtb] = 1;
  ET.migrateAliases(idx, st);
  assert.ok(st.ticks.c1[CJ + starter.i] && !st.ticks.c1[CJ + joiner.i]);
  assert.ok(st.ticks.c1[sywtb], 'a joiner-only step keeps its tick (shown as not applying, not counted)');
  st.ticks.c2[CJ + joiner.i] = 1; ET.migrateAliases(idx, st);
  assert.ok(st.ticks.c2[CJ + joiner.i], 'a Pugilist starter joined Gladiator later: tick stays');
});

test('data: repeated PvP arena rows and duplicate emote rows are merged, and old ticks move over', () => {
  const pvp = idx.sections.find((s) => s.id === 'duty-pvp');
  const names = ET.sectionKeys(pvp).map((k) => { const h = idx.byKey.get(k); return h.g.t + '|' + h.e.n; });
  assert.strictEqual(new Set(names).size, names.length, 'one row per arena and mode');
  const pal = ET.sectionKeys(pvp).map((k) => idx.byKey.get(k).e).find((e) => e.n === 'The Palaistra' && e.al);
  assert.ok(pal && pal.al.length >= 5);
  const st = ET.newState(['A']);
  st.ticks.c1['duty-pvp:' + pal.al[0]] = 1;
  ET.migrateAliases(idx, st);
  assert.ok(st.ticks.c1['duty-pvp:' + pal.i]);
  const em = ET.sectionKeys(idx.sections.find((s) => s.id === 'emotes')).map((k) => idx.byKey.get(k).e.n);
  assert.strictEqual(em.filter((n) => n === 'Dote').length, 1);
});

test('data: seasonal event quests and titles of time-limited achievements are marked time-limited', () => {
  const oq = idx.sections.find((s) => s.id === 'quests-otherquests');
  const ev = oq.groups.filter((g) => / Events$/.test(g.t)).flatMap((g) => g.keys);
  assert.ok(ev.length > 250);
  assert.ok(ev.every((k) => idx.byKey.get(k).e.x === 'lim'));
  const titles = ET.sectionKeys(idx.sections.find((s) => s.id === 'titles')).map((k) => idx.byKey.get(k).e);
  assert.ok(titles.filter((e) => e.x === 'lim').length > 100 && titles.filter((e) => e.x === 'gone').length > 40);
});

test('class and job quests: ten lists as in the desktop app; ticks saved under the old combined list move over', () => {
  const cj = idx.sections.filter((x) => x.id.startsWith('quests-cj-'));
  assert.deepStrictEqual(cj.map((x) => x.t), ['Disciple of War Quests', 'Disciple of Magic Quests', 'Disciple of the Hand Quests', 'Disciple of the Land Quests', 'Crystalline Mean Quests', 'Studium Quests', 'Wachumeqimeqi Quests', 'Disciple of War Job Quests', 'Disciple of Magic Job Quests', 'Role Quests']);
  assert.ok(!idx.sections.some((x) => x.id === 'quests-classjobquests'));
  const bst = idx.sections.find((x) => x.id === 'quests-cj-warjob').groups.find((g) => g.t === 'Beastmaster Quests');
  assert.ok(bst && bst.keys.length >= 10);
  const k = bst.keys[0], e = idx.byKey.get(k).e;
  const st = ET.newState(['A']);
  st.ticks.c1['quests-classjobquests:' + e.i] = 1; st.excl.c1['quests-classjobquests:' + e.i] = 1;
  ET.migrateAliases(idx, st);
  assert.ok(st.ticks.c1[k] && st.excl.c1[k] && !st.ticks.c1['quests-classjobquests:' + e.i]);
});

test('Dawntrail additions: Beastmaster, Trust, treasure hunt, Quantum and event duties, Occult Crescent lore', () => {
  const bm = idx.sections.find((x) => x.id === 'beastmaster');
  assert.deepStrictEqual(bm.groups.map((g) => [g.t, g.keys.length]), [["Master's Bestiary", 50], ['Crucible of the Unbroken', 5]]);
  const tr = idx.sections.find((x) => x.id === 'trust');
  assert.deepStrictEqual(tr.groups.map((g) => [g.t, g.keys.length]), [['Shadowbringers', 6], ['Endwalker', 7], ['Dawntrail', 8]]);
  assert.ok(idx.sections.find((x) => x.id === 'duty-treasure').groups.flatMap((g) => g.keys).some((k) => idx.byKey.get(k).e.n === 'Vault Oneiron'));
  assert.ok(ET.sectionKeys(idx.sections.find((x) => x.id === 'treasuremaps')).length >= 25);
  assert.strictEqual(ET.sectionKeys(idx.sections.find((x) => x.id === 'duty-quantum')).length, 2);
  assert.ok(ET.sectionKeys(idx.sections.find((x) => x.id === 'duty-event')).every((k) => idx.byKey.get(k).e.x === 'lim'));
  assert.deepStrictEqual(idx.sections.find((x) => x.id === 'oclore').groups.map((g) => [g.t, g.keys.length]), [['South Horn', 30], ['North Horn', 30]]);
});

test('organised by expansion: big lists split per expansion, an expansion layer elsewhere, deep dungeons by series', () => {
  const EXP = ['A Realm Reborn', 'Heavensward', 'Stormblood', 'Shadowbringers', 'Endwalker', 'Dawntrail'];
  for (const base of ['quests-msq', 'quests-side', 'quests-allied', 'leves', 'fates', 'hunt']) {
    const lists = idx.sections.filter((x) => x.id.startsWith(base + '-') && x.id !== 'quests-side-hildibrand');
    assert.deepStrictEqual(lists.map((x) => x.t.split(': ')[1]), EXP, base);
    assert.ok(!idx.sections.some((x) => x.id === base), base + ' itself is gone');
  }
  assert.ok(!idx.sections.some((x) => x.id === 'quests-other'), 'no list of quests outside the journal');
  const hil = idx.sections.find((x) => x.id === 'quests-side-hildibrand');
  const hilNames = hil.groups.flatMap((g) => g.keys.map((k) => idx.byKey.get(k).e.n));
  assert.equal(hilNames.length, 57, 'all Hildibrand quests in one list');
  assert.ok(hilNames.includes('The Rise and Fall of Gentlemen') && hilNames.includes('The Imperfect Gentleman'));
  const vague = idx.sections.flatMap((x) => x.groups.filter((g) => /^(Other|\?\?\?|Patch not recorded)$|Not placed|Added after|spot not in the data/.test(g.t) || (x.groups.some((h) => h.xp) && (!g.xp || g.xp === 'Other'))).map((g) => x.id + ': ' + g.t));
  assert.deepStrictEqual(vague, [], 'no vague groups ("Other", "Patch not recorded", "Not placed ...")');
  assert.ok(!idx.sections.some((x) => /: Other\b|^Other$/.test(x.t)), 'no list called "Other"');

  const deep = idx.sections.find((x) => x.id === 'duty-deep');
  const where = (n) => deep.groups.find((g) => g.keys.some((k) => idx.byKey.get(k).e.n.startsWith(n))).t;
  assert.deepStrictEqual(["The Palace of the Dead", 'Heaven-on-High', 'Eureka Orthos', "Pilgrim's Traverse"].map(where), ['Heavensward', 'Stormblood', 'Endwalker', 'Dawntrail']);
  const ach = idx.sections.find((x) => x.id === 'ach-battle');
  assert.deepStrictEqual([...new Set(ach.groups.map((g) => g.xp))], EXP, 'achievements: expansion, then their category');
  const fu = idx.sections.find((x) => x.id === 'quests-otherquests').groups.filter((g) => g.t === 'Feature Unlocks');
  assert.ok(fu.length >= 5 && fu.every((g) => g.xp));
  // a tick saved under an old list moves to the new one
  const fk = ET.sectionKeys(idx.sections.find((x) => x.id === 'fates-dt'))[0];
  const st = ET.newState(['A']);
  st.ticks.c1['fates:' + idx.byKey.get(fk).e.i] = 1;
  ET.migrateAliases(idx, st);
  assert.ok(st.ticks.c1[fk]);
});

test('variant dungeon records: 12 or 13 per dungeon, and all of them give the dungeon\'s achievement', () => {
  const vr = idx.sections.find((x) => x.id === 'variantrecords');
  assert.deepStrictEqual(vr.groups.map((g) => g.keys.length), [12, 12, 12, 13]);
  const all = LINKS && ET.indexLinks(idx, LINKS);
  const st = ET.newState(['A']);
  vr.groups[0].keys.forEach((k) => ET.setTick(st, 'c1', k, true));
  assert.ok(ET.applyLinks(all, idx, st, 'c1', vr.groups[0].keys).map((k) => idx.byKey.get(k).e.n).includes('Dig Deep: The Sil\'dihn Subterrane'));
});

test('information window: every entry says how to get or do it; recipes and gathering in depth', () => {
  const INFO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'info.json'), 'utf8'));
  const bare = [...idx.byKey].filter(([k, h]) => !(INFO[k] && INFO[k].length) && !h.e.src && !h.e.d).map(([k]) => k);
  assert.deepStrictEqual(bare, [], 'no entry without how-to text');
  const recipe = firstKey('craft-weaver', (e) => e.n === 'Dwarven Cotton Breeches');
  assert.match(INFO[recipe].join(' / '), /Weaver level 80.*Materials: 2× Dwarven Cotton \(craft WVR \d+\)/);
  const basil = firstKey('gather-botanist', (e) => e.n === 'Hallowed Basil');
  const b = INFO[basil].join(' / ');
  assert.match(b, /Harvesting node, level 70, in Rustrock, The Peaks \(24\.1, 16\.6\)/);
  assert.match(b, /legendary · up at 6:00, 18:00 Eorzea time/);
  assert.match(b, /Tome of Botanical Folklore - Gyr Abania/);
  assert.match(b, /Not a collectable/);
  assert.ok(Object.entries(INFO).filter(([k]) => k.startsWith('gather-')).every(([, v]) => /collectable/i.test(v.join(' '))), 'every gathering entry says whether it is a collectable');
  assert.ok(!JSON.stringify(INFO).includes('see the guide'), 'no "see the guide": the answer is in the window');
  const say = (sid, name) => (INFO[firstKey(sid, (e) => e.n === name)] || []).join(' / ');
  assert.match(say('quests-msq', 'The Ultimate Weapon'), /Step 1: Speak with Cid/, 'quests carry their journal steps');
  assert.match(say('fates', 'Hide and Seek'), /Objective: Deliver the poached hides/);
  assert.match(say('fates', 'Unsafety Dance'), /Spawns after you defeat Lv\. 6 Flowering Sabotender/);
  assert.match(say('beastmaster', 'Squirrel'), /Tame it from a Ground Squirrel in Central Shroud/);
  assert.match(say('leves', "Our Man in Ul'dah"), /Deliver 1× Velveteen Work Gloves/);
  assert.match(say('cosmicmissions', 'Multi-purpose Fiberboard'), /Craft: Standard High-density Fiberboard/);
  assert.match(say('minions', 'Princely hatchling'), /Receive 50 player commendations/);
  assert.match(say('duty-dungeons', 'Sastasha'), /Unlocked by the quest It's Probably Pirates/);
  assert.match(say('duty-ultimate', 'The Unending Coil of Bahamut (Ultimate)'), /Deltascape V4\.0 \(Savage\).*Wandering Minstrel in Kugane/);
  assert.match(say('duty-treasure', 'Vault Oneiron'), /Gargantuaskin/);
  assert.match(say('duty-quest', 'Messenger of the Winds'), /Played during the quest Messenger of the Winds/);
  assert.match(say('hunt', 'Endymion'), /Three-star Clan Mark Bills: defeat 2 in The Sea of Clouds/);
  assert.match(say('hunting', 'Bark eft'), /Defeat 3 in South Shroud, Upper Paths/);
  assert.match(say('carnivale', "All's Well That Starts Well"), /stage 1: .*Celestium Attendant/);
  assert.match(say('relicweapons', 'Yoichi Bow Zeta'), /Zodiac Zeta stage \(8 of 8\).*Remon in Swiftperch/);
  assert.match(say('relicweapons', 'Pleiades Pagos'), /Pagos.*Frosted Protean Crystals/);
  assert.match(say('relictools', 'Lodestar Mallet'), /Lodestar stage \(7 of 7\).*Stand Tool, My Friend/);
  assert.ok(Object.entries(INFO).filter(([k]) => k.startsWith('relic')).every(([, v]) => / stage/.test(v[0])), 'every relic weapon and tool stage has its guide');
  const all = JSON.stringify(INFO);
  assert.ok(!/[-]/.test(all), 'no game icon glyphs in the text');
  assert.ok(!all.includes('Gig: UNKNOWN') && !all.includes('gold rating'), 'no placeholder or generic lines');
});

// ---------------------------------------------------------------- links between entries
const LINKS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'links.json'), 'utf8'));
const LX = ET.indexLinks(idx, LINKS);
const edgesOf = (kind) => [...LX.imp].flatMap(([a, ts]) => ts.filter((t) => t[1] === kind).map((t) => [a, t[0]]));

test('links: built for this data, and refused when built for other data', () => {
  assert.ok(LX && LX.count > 10000);
  assert.strictEqual(ET.indexLinks(idx, Object.assign({}, LINKS, { entries: LINKS.entries + 1 })), null);
  // the same number of entries, but one removed and another added elsewhere: every link after the change would land
  // on the wrong row, so a links file that carries the data's key hash is refused
  const keys = [...idx.byKey.keys()];
  const hashed = Object.assign({}, LINKS, { keys_hash: ET.keysHash(keys) });
  assert.ok(ET.indexLinks(idx, hashed), 'accepted with the matching hash');
  const other = JSON.parse(JSON.stringify(data));
  const m = other.sections.find((s) => s.id === 'mounts'); m.g[0].e.splice(0, 1);
  const mi = other.sections.find((s) => s.id === 'minions'); mi.g[mi.g.length - 1].e.push({ i: 999999, n: 'New' });
  const idx2 = ET.indexData(other);
  assert.strictEqual(idx2.byKey.size, idx.byKey.size);
  assert.strictEqual(ET.indexLinks(idx2, hashed), null, 'refused: same count, other entries');
  assert.strictEqual(ET.keysHash(['a:1', 'b:2']), ET.keysHash(['a:1', 'b:2']));
  assert.notStrictEqual(ET.keysHash(['a:1', 'b:2']), ET.keysHash(['b:2', 'a:1']));
});

test('links: a quest ticks the quests it needs, all the way back, and never another city\'s quests', () => {
  const st = ET.newState(['A']);
  // the last quest of the A Realm Reborn main story pulls in its whole chain
  const twu = firstKey('quests-msq', (e) => e.n === 'The Ultimate Weapon');
  ET.setTick(st, 'c1', twu, true);
  const added = ET.applyLinks(LX, idx, st, 'c1', [twu], { gold: false });
  const msq = added.filter((k) => k.startsWith('quests-msq-'));
  assert.ok(msq.length > 100, 'the main story before it: ' + msq.length);
  // a Gridania starter in the Twin Adder: the chain runs through that company's officer quest down to the Gridania
  // opening quests, never Limsa's or Ul'dah's (the game's data only says "one of the three" at those steps)
  const st2 = ET.newState(['B']);
  ET.setStart(st2, 'c1', 'cnj', 2);
  ET.setTick(st2, 'c1', twu, true);
  const added2 = ET.applyLinks(LX, idx, st2, 'c1', [twu], { gold: false });
  const cities = new Set(added2.map((k) => idx.byKey.get(k).e.city).filter(Boolean));
  assert.deepStrictEqual([...cities], ['gri'], 'the Gridania opening quests, and only those');
  const gcs = new Set(added2.map((k) => idx.byKey.get(k).e.gc).filter(Boolean));
  assert.deepStrictEqual([...gcs], [2], 'only Twin Adder quests');
  assert.ok(added2.length > added.length);
  // with no starting class chosen, no city's opening quests are assumed
  const cities1 = new Set(added.map((k) => idx.byKey.get(k).e.city).filter(Boolean));
  assert.deepStrictEqual([...cities1], []);
});

test('links: achievement and its own title tick each other; a quest ticks its aether current and the reverse', () => {
  const [ach, title] = edgesOf('t').find(([a, b]) => a.startsWith('ach-') && edgesOf('t').some(([x, y]) => x === b && y === a));
  const st = ET.newState(['A']);
  ET.setTick(st, 'c1', title, true);
  assert.ok(ET.applyLinks(LX, idx, st, 'c1', [title]).includes(ach));
  const [q, cur] = edgesOf('c').find(([a]) => a.startsWith('quests-'));
  const st2 = ET.newState(['A']);
  ET.setTick(st2, 'c1', cur, true);
  assert.ok(ET.applyLinks(LX, idx, st2, 'c1', [cur]).includes(q));
});

test('links: all aether currents of a zone tick its Freebird achievement', () => {
  const r = LX.rules.find((x) => x.type === 'all' && idx.byKey.get(x.target).e.n.startsWith('Freebird'));
  const st = ET.newState(['A']);
  r.members.slice(0, -1).forEach((m) => ET.setTick(st, 'c1', m, true));
  assert.ok(!ET.applyLinks(LX, idx, st, 'c1', r.members.slice(0, -1)).includes(r.target), 'not before the last one');
  ET.setTick(st, 'c1', r.members[r.members.length - 1], true);
  assert.ok(ET.applyLinks(LX, idx, st, 'c1', [r.members[r.members.length - 1]]).includes(r.target));
});

test('links: a FATE ticks its achievement only when a gold rating is assumed; the achievement always ticks the FATE', () => {
  const [fate, ach] = edgesOf('g')[0];
  const off = ET.newState(['A']); ET.setTick(off, 'c1', fate, true);
  assert.ok(!ET.applyLinks(LX, idx, off, 'c1', [fate], { gold: false }).includes(ach));
  const on = ET.newState(['A']); ET.setTick(on, 'c1', fate, true);
  assert.ok(ET.applyLinks(LX, idx, on, 'c1', [fate], { gold: true }).includes(ach));
  const rev = ET.newState(['A']); ET.setTick(rev, 'c1', ach, true);
  assert.ok(ET.applyLinks(LX, idx, rev, 'c1', [ach], { gold: false }).includes(fate));
});

test('links: a level reached ticks the level achievement; links only add and skip what does not apply', () => {
  const pld = firstKey('levels', (e) => e.n.startsWith('Paladin'));
  const ach = firstKey('ach-character', (e) => e.n === 'Stick Them with the Pointy End I');
  const st = ET.newState(['A']);
  ET.setValue(st, 'c1', pld, 10, idx.byKey.get(pld).e);
  assert.ok(ET.applyLinks(LX, idx, st, 'c1', [], { levels: [pld] }).includes(ach));
  // marked "does not apply": never ticked by a link
  const [q, cur] = edgesOf('c').find(([a]) => a.startsWith('quests-'));
  const st2 = ET.newState(['A']);
  ET.setExcluded(st2, 'c1', cur, true);
  ET.setTick(st2, 'c1', q, true);
  assert.ok(!ET.applyLinks(LX, idx, st2, 'c1', [q]).includes(cur));
  assert.ok(!st2.ticks.c1[cur]);
});

test('links: a duty unlocked by one quest per city or company never assumes a city or company', () => {
  const byName = (sid, n) => firstKey(sid, (e) => e.n === n);
  const gh = byName('duty-guildhests', 'Basic Training: Enemy Parties'); // unlocked by one "Simply the Hest" per starting city
  const st = ET.newState(['A']);
  ET.setTick(st, 'c1', gh, true);
  const added = ET.applyLinks(LX, idx, st, 'c1', [gh]);
  assert.deepStrictEqual(added.filter((k) => idx.byKey.get(k).e.city), [], 'no starting class chosen: no city quest is assumed');
  const st2 = ET.newState(['B']);
  ET.setStart(st2, 'c1', 'cnj', null);
  ET.setTick(st2, 'c1', gh, true);
  const cities = new Set(ET.applyLinks(LX, idx, st2, 'c1', [gh]).map((k) => idx.byKey.get(k).e.city).filter(Boolean));
  assert.deepStrictEqual([...cities], ['gri'], 'a Gridania starter: Gridania quests only');
  const pvp = byName('duty-pvp', 'The Borderland Ruins (Secure)'); // unlocked by one quest per Grand Company
  const st3 = ET.newState(['C']);
  ET.setTick(st3, 'c1', pvp, true);
  assert.deepStrictEqual(ET.applyLinks(LX, idx, st3, 'c1', [pvp]).filter((k) => idx.byKey.get(k).e.gc), [], 'no Grand Company chosen: no company quest is assumed');
});

test('links: Beastmaster beasts and boards, Trust levels, treasure dungeons and Quantum duties', () => {
  const nm = (k) => idx.byKey.get(k).e.n;
  const bm = idx.sections.find((x) => x.id === 'beastmaster');
  const [beasts, boards] = bm.groups.map((g) => g.keys);
  let st = ET.newState(['A']);
  beasts.slice(0, 20).forEach((k) => ET.setTick(st, 'c1', k, true));
  assert.deepStrictEqual(ET.applyLinks(LX, idx, st, 'c1', beasts.slice(0, 20)).map(nm), ['A Beast in the Hand I', 'A Beast in the Hand II']);
  st = ET.newState(['A']); ET.setTick(st, 'c1', boards[0], true);
  const b1 = ET.applyLinks(LX, idx, st, 'c1', [boards[0]]).map(nm);
  assert.ok(b1.includes('Crucible Checkmate I') && b1.includes('Into the Crucible'), 'the board proves its achievement and its unlock quest');
  const tr = idx.sections.find((x) => x.id === 'trust');
  st = ET.newState(['A']);
  const shb = tr.groups[0].keys;
  shb.slice(0, 5).forEach((k) => ET.setValue(st, 'c1', k, 80, idx.byKey.get(k).e));
  assert.deepStrictEqual(ET.applyLinks(LX, idx, st, 'c1', [], { levels: shb }).map(nm), [], 'five of the six avatars: not yet');
  ET.setValue(st, 'c1', shb[5], 80, idx.byKey.get(shb[5]).e);
  assert.ok(ET.applyLinks(LX, idx, st, 'c1', [], { levels: shb }).map(nm).includes('Bound by Faith'));
  const vault = firstKey('duty-treasure', (e) => e.n === 'Vault Oneiron');
  st = ET.newState(['A']); ET.setTick(st, 'c1', vault, true);
  assert.ok(ET.applyLinks(LX, idx, st, 'c1', [vault]).map(nm).includes('Dreaming in Neon I'));
  const fv = firstKey('duty-quantum', (e) => e.n === 'The Final Verse (Quantum)');
  st = ET.newState(['A']); ET.setTick(st, 'c1', fv, true);
  assert.ok(ET.applyLinks(LX, idx, st, 'c1', [fv]).map(nm).includes('Unholy Sacrament'));
});

test('links: achievement tiers, Dawntrail relic stages, Grand Company ranks, and checked links from the desktop app', () => {
  const byName = (sid, n) => firstKey(sid, (e) => e.n === n);
  const fill = (k, opts) => { const st = ET.newState(['A']); ET.setTick(st, 'c1', k, true); return ET.applyLinks(LX, idx, st, 'c1', [k], opts || {}); };
  // "To Crush Your Enemies III" (1,000 enemies) proves II (500) and I (100)
  const crush = fill(firstKey('ach-battle', (e) => e.n === 'To Crush Your Enemies III'));
  assert.ok(['To Crush Your Enemies II', 'To Crush Your Enemies I'].every((n) => crush.some((k) => idx.byKey.get(k).e.n === n)));
  // the last Phantom stage proves the four before it (Console Games Wiki: each upgrade needs the previous stage)
  const occ = fill(byName('relicweapons', 'Phantom Sword Occultum & Phantom Shield Occultum'));
  for (const st of ['Penumbrae', 'Umbrae', 'Obscurum', 'Eclipticum']) assert.ok(occ.some((k) => /^Phantom Sword/.test(idx.byKey.get(k).e.n) && idx.byKey.get(k).e.n.includes(st)), st);
  // the first Maelstrom rank comes with "Till Sea Swallows All"
  assert.ok(fill(byName('gcranks', 'Storm Private Third Class')).some((k) => idx.byKey.get(k).e.n === 'Till Sea Swallows All'));
  // from the desktop app, checked: the Firebird quest needs the Heavensward lanners
  const fire = fill(byName('quests-side', 'Fiery Wings, Fiery Hearts'));
  assert.ok(fire.includes(byName('mounts', 'Warring Lanner')) && fire.includes(byName('mounts', 'Dark Lanner')));
});

// ---------------------------------------------------------------- Live pages data
test('live data: ocean fishing schedule, big fish, field monsters, new lists', () => {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'live.json'), 'utf8'));
  const O = L.ocean;
  assert.equal(O.table.length, 144); assert.equal(Object.keys(O.routes).length, 21);
  // the Indigo pattern published by the community schedule (ffxiv.oceanfishing.boats), first 24 voyages; its voyage n
  // leaves at 2-hour slot k with n = (k + 84) mod 144. The game table must give the same route for the same slot.
  const site = [7, 10, 1, 4, 8, 11, 2, 5, 12, 3, 6, 7, 10, 1, 4, 8, 11, 2, 5, 9, 3, 6, 7, 10];
  for (let n = 0; n < site.length; n++) { const k = (n - 84 + 144 * 10) % 144; assert.equal(O.table[(k + O.offset) % 144][0], site[n], 'voyage ' + n); }
  const r1 = O.routes['1'];
  assert.deepEqual(r1.stops.map((s) => s.name + ' ' + s.time), ['The Southern Strait of Merlthor Night', 'Galadion Bay Day', 'The Northern Strait of Merlthor Sunset']);
  assert.ok(O.ach.length >= 40, 'ocean fishing achievements found');
  assert.equal(L.bigfish.length, 335); assert.equal(L.bigfish.filter((f) => f.kind === 'legendary').length, 36);
  assert.ok(L.bigfish.filter((f) => f.k).length >= 320, 'big fish matched to the fishing log');
  assert.equal(L.bigfish.filter((f) => f.a != null).length, 335, 'every big fish has a window (or none needed)');
  assert.ok(L.field.zones['The Bozjan Southern Front'].length >= 70, 'Bozja monsters from the wiki pages');
  assert.ok(L.field.zones['The Occult Crescent: North Horn'].length >= 100, 'North Horn monsters');
  assert.equal(L.field.weatherZone['The Bozjan Southern Front'], 'Bozjan Southern Front', 'Bozja uses its own weather table');
  const anemos = L.field.zones['Eureka Anemos'];
  assert.ok(anemos.filter((m) => m.el).length >= 60, 'Eureka monsters with an element');
  assert.ok(L.field.zones['The Occult Crescent: South Horn'].filter((m) => m.weak).length >= 90);
  assert.ok(L.field.challenge.some((c) => /Forbidden Ice/.test(c[1])), 'Eureka challenge log entries');
  const n = (id) => idx.sections.find((s) => s.id === id).groups.reduce((a, g) => a + g.keys.length, 0);
  assert.equal(n('armoire'), 3563); assert.equal(n('outfits'), 1088);
  assert.equal(n('verminion'), 29); assert.ok(n('chocoboracing') >= 25);
});

test('live data: S ranks, island, PvP series, data centers', () => {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'live.json'), 'utf8'));
  assert.equal(L.srank.length, 50); assert.ok(L.srank.filter((s) => s.spec).length >= 10);
  assert.equal(L.island.animals.length, 43); assert.ok(L.island.animals.filter((a) => a.weather).length >= 20);
  assert.ok(L.island.crafts.length >= 80); assert.deepEqual(L.island.multiplier.Average, [1.6, 1.3, 1, 0.8, 0.6]);
  assert.ok(Object.keys(L.pvp).length >= 10);
  assert.ok(L.dc['North America'].dcs.includes('Dynamis'));
  assert.ok((L.guides.dailies || []).length >= 20 && Object.keys(L.guides.leveling || {}).length === 3);
});

test('live data: hunts (windows, spawn points, world boss FATEs), worlds, and the wider character sync', () => {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'live.json'), 'utf8'));
  const H = L.hunts;
  assert.equal(H.marks.filter((m) => m.r === 'S').length, 47); assert.equal(H.marks.filter((m) => m.r === 'SS').length, 3);
  assert.equal(H.marks.filter((m) => m.r === 'A').length, 76);
  assert.ok(H.marks.every((m) => m.rs && m.rs[0] <= m.rs[1]), 'every mark has a respawn window');
  assert.ok(H.marks.filter((m) => m.r === 'S').every((m) => m.rs.length === 4), 'every S rank has a maintenance window');
  assert.deepEqual(H.marks.find((m) => m.n === 'Laideronnette').rs, [42, 48, 25, 29]);
  assert.equal(Object.keys(H.spawn).length, 47, 'a spawn point map for every hunt zone');
  assert.ok(H.marks.filter((m) => m.r !== 'SS').every((m) => H.spawn[m.tt]), 'every S and A rank finds its zone map');
  assert.ok(Object.values(H.spawn).every((z) => z.max >= 41 && z.pts.every((p) => p[0] >= 1 && p[0] <= z.max && p[1] >= 1 && p[1] <= z.max)), 'points inside their map');
  assert.equal(H.bosses.length, 12); assert.ok(H.bosses.every((b) => b.zone && b.how && b.ex));
  assert.deepEqual(L.worlds.Dynamis.map((w) => w[0]).sort(), [404, 405, 406, 407, 408, 409, 410, 411]);
  assert.ok(!Object.keys(L.worlds).some((d) => /Cloud/.test(d)), 'test data centers left out');
  assert.ok(['cards', 'npcs', 'leves'].every((c) => ET.FC_COLLECTIONS.some((x) => x[1] === c)));
  assert.equal(ET.fcCollectionOf('leves-dt'), 'leves'); assert.equal(ET.fcCollectionOf('ttnpcs'), 'npcs');
  const tt = idx.sections.find((s) => s.id === 'ttnpcs');
  assert.ok(tt.groups.reduce((a, g) => a + g.keys.filter((k) => idx.byKey.get(k).e.fc).length, 0) >= 120, 'Triple Triad opponents carry their FFXIV Collect id');
});

// ── gate 1C: the one save ────────────────────────────────────────────────────────────────────────────────────────────
// Node has no IndexedDB, so these run on the localStorage fallback (a shim); the browser checks cover IndexedDB.
const CC = globalThis.CC;
function useStorage() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
  CC.resetMemory(); ET.moveProblem = null; ET.saveDisabled = false; ET.justMoved = false; ET.loadProblem = null;
  return m;
}
// 8 characters with every field filled: ticks, "does not apply" marks, levels, starting class or city, Grand Company,
// Lodestone number, plus availability choices and changed settings
function fullState() {
  const st = ET.newState(['Alba Eveniunt', 'Brio Eveniunt', 'Cara Eveniunt', 'Dax Eveniunt', 'Eli Eveniunt', 'Fen Eveniunt', 'Gia Eveniunt', 'Hal Eveniunt']);
  const all = [...idx.byKey.keys()];
  const cls = ['gla', 'pgl', 'mrd', 'lnc', 'arc', 'cnj', 'thm', 'acn'];
  st.chars.forEach((c, n) => {
    c.lodestone = String(10000000 + n); c.gc = (n % 3) + 1;
    if (n === 7) { c.cls = null; c.city = 'uld'; } else c.cls = cls[n];
    for (let i = n; i < all.length; i += 3) st.ticks[c.id][all[i]] = 1;
    for (let i = n; i < all.length; i += 97) st.excl[c.id][all[i]] = 1;
    st.vals[c.id][all[n]] = 50 + n;
  });
  ET.setAvailability(st, all[3], 'ok'); ET.setAvailability(st, all[4], 'x');
  st.settings.countLimited = true; st.settings.links = false;
  return ET.validateState(st);
}
const MODS = {
  atelier: { chars: { c1: { stats: { j0: { level: 100, craftsmanship: 5000, control: 4900, cp: 650 } }, food: { id: 44, hq: true }, potion: null, cosmicTool: true } }, saved: { s1: { id: 's1', name: 'Macro one', actions: ['MuscleMemory'] } }, prefs: { guideMs: 400 } },
  lists: { lists: { l1: { name: 'Gear', items: { 123: { qty: 2, have: 1 } } } } },
  // design 7.1: free companies, submarines and trips side by side, each its own merge unit (invented names)
  submersibles: {
    fcs: { f1: { name: 'Alpha Company', world: 'Maduin', charId: 'c1', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] } },
    subs: {
      s1: { fcId: 'f1', slot: 1, name: 'Sub One', rank: 50, expIntoRank: 1200, parts: [3, 4, 1, 2], voyage: { sentAt: 1762800000000, route: [1, 2], returnAt: 1762897920000, calcAt: 1762897900000, gameSaid: '1d 3h 12m' } },
      s2: { fcId: 'f1', slot: 2, name: 'Sub Two', rank: 12, parts: [3, 4, 1, 2], voyage: null },
    },
    trips: { 's2-1762700000000': { s: 's2', t: 1762700000000, r: [1], back: 1762750000000, calc: 1762750000000, said: '13h 53m', items: [], newSectors: [] } },
    settings: { prefs: { sort: 'fc' } },
  },
};

test('one save: an 8-character save is copied in, every field matches, the old save is untouched, and it is copied once', async () => {
  const ls = useStorage();
  const st = fullState();
  const oldText = JSON.stringify(st);
  ls.set('eveniunt-tracker-state', oldText); ls.set('eveniunt-tracker-state-rev', 'r0');
  const loaded = await ET.loadState();
  assert.strictEqual(ET.justMoved, true);
  assert.strictEqual(ET.compareTracker(st, loaded), null, 'every character matches');
  loaded.chars.forEach((c, i) => assert.deepStrictEqual([c.name, c.lodestone, c.cls, c.city || null, c.gc], [st.chars[i].name, st.chars[i].lodestone, st.chars[i].cls, st.chars[i].city || null, st.chars[i].gc]));
  assert.strictEqual(ls.get('eveniunt-tracker-state'), oldText, 'the old save is byte for byte the same');
  assert.strictEqual(ls.get('eveniunt-tracker-state-rev'), 'r0');
  const doc = JSON.parse(ls.get(CC.LS));
  assert.strictEqual(doc.app, 'eveniunt-command-center');
  assert.deepStrictEqual(Object.keys(doc.modules), ['tracker']);
  assert.strictEqual(doc.moved.tracker.from, 'localstorage');
  assert.strictEqual(doc.moved.tracker.check.chars, 8);
  assert.strictEqual(doc.moved.tracker.check.ticks, Object.values(st.ticks).reduce((n, t) => n + Object.keys(t).length, 0));
  // the old save left as it was is not copied again (only later work by an old window is brought in; see below)
  ET.justMoved = false; ET.caughtUp = false;
  const again = await ET.loadState();
  assert.strictEqual(ET.justMoved, false);
  assert.strictEqual(ET.caughtUp, false);
  assert.strictEqual(ET.compareTracker(st, again), null, 'the one save is used');
});

// The owner's case (2026-11-10): the new version opened first on a blank save and moved it; a Tracker tab from before
// the update, still open in the same browser, went on saving to the old place, so its characters never arrived.
test('catch-up: an old window\'s work after the move reaches a still-blank one save on the next load', async () => {
  const ls = useStorage();
  ls.set('eveniunt-tracker-state', JSON.stringify(ET.newState(['Character 1', 'Character 2'])));
  const first = await ET.loadState();
  assert.ok(ET.untouched(first), 'moved blank');
  const at = JSON.parse(ls.get(CC.LS)).moved.tracker.at;
  // the old window saves real characters and ticks after the move
  const real = fullState(); real.updated = at + 1000;
  ls.set('eveniunt-tracker-state', JSON.stringify(real));
  ET.caughtUp = false;
  const next = await ET.loadState();
  assert.strictEqual(ET.caughtUp, true);
  assert.strictEqual(ET.compareTracker(real, next), null, 'every character, tick and setting arrived');
  const doc = JSON.parse(ls.get(CC.LS));
  assert.strictEqual(doc.moved.tracker.oldSeen, real.updated);
  assert.strictEqual(doc.moved.tracker.at, at, 'the move record is kept');
  assert.strictEqual(doc.chars.length, 8);
  // brought in once: the next load uses the one save, and a change made here is not undone
  const k = Object.keys(next.ticks.c1)[0]; ET.setTick(next, 'c1', k, false); await ET.saveState(next, true);
  ET.caughtUp = false;
  const third = await ET.loadState();
  assert.strictEqual(ET.caughtUp, false);
  assert.ok(!third.ticks.c1[k], 'the tick removed after the catch-up stays removed');
  assert.strictEqual(ls.get('eveniunt-tracker-state'), JSON.stringify(real), 'the old save is never written');
});

test('catch-up: into a save already in use, the old window\'s work is merged; placeholder names give way, real ones stay', async () => {
  const ls = useStorage();
  ls.set('eveniunt-tracker-state', JSON.stringify(ET.newState(['Character 1', 'Character 2'])));
  const cur = await ET.loadState();
  const keys = [...idx.byKey.keys()];
  ET.renameCharacter(cur, 'c2', 'Brio Here'); ET.setTick(cur, 'c2', keys[0], true);
  await ET.saveState(cur, true);
  const at = JSON.parse(ls.get(CC.LS)).moved.tracker.at;
  const old = ET.newState(['Alba There', 'Brio There']); ET.setTick(old, 'c1', keys[1], true); old.updated = at + 1000;
  ls.set('eveniunt-tracker-state', JSON.stringify(old));
  const next = await ET.loadState();
  assert.strictEqual(ET.caughtUp, true);
  assert.deepStrictEqual(next.chars.map((c) => c.name), ['Alba There', 'Brio Here']);
  assert.ok(next.ticks.c1[keys[1]], 'the old window\'s tick arrived');
  assert.ok(next.ticks.c2[keys[0]], 'the tick made here stays');
});

test('catch-up: an old save that only claims a stamp on reading is never brought in, and an erase stays erased', async () => {
  const ls = useStorage();
  const st = fullState(); const raw = JSON.parse(JSON.stringify(st)); delete raw.updated;
  ls.set('eveniunt-tracker-state', JSON.stringify(ET.newState(['Character 1'])));
  await ET.loadState();
  ls.set('eveniunt-tracker-state', JSON.stringify(raw));
  ET.caughtUp = false;
  const next = await ET.loadState();
  assert.strictEqual(ET.caughtUp, false, 'no stored stamp: not brought in');
  assert.ok(ET.untouched(next));
  await ET.clearState();
  ET.caughtUp = false;
  assert.strictEqual(await ET.loadState(), null, 'erased stays erased');
});

test('one save: running the move twice is safe, and a second window that loads at the same time does not copy again', async () => {
  const ls = useStorage();
  ls.set('eveniunt-tracker-state', JSON.stringify(fullState()));
  const [a, b] = await Promise.all([ET.loadState(), ET.loadState()]);
  assert.strictEqual(ET.compareTracker(a, b), null);
  const doc = JSON.parse(ls.get(CC.LS));
  const at = doc.moved.tracker.at;
  await ET.loadState();
  assert.strictEqual(JSON.parse(ls.get(CC.LS)).moved.tracker.at, at, 'the move record is not rewritten');
});

test('one save: the way back restores the save from before the move (after keeping a copy); erase keeps the old save', async () => {
  const ls = useStorage();
  const st = fullState();
  ls.set('eveniunt-tracker-state', JSON.stringify(st));
  const loaded = await ET.loadState();
  const k = [...idx.byKey.keys()].find((x) => !loaded.ticks.c2[x]);
  ET.setTick(loaded, 'c2', k, true);
  await ET.saveState(loaded, true);
  const diff = await ET.oldSaveDiff(loaded);
  assert.strictEqual(diff.n, 1, 'one tick differs from the save before the move');
  await ET.goBack();
  assert.strictEqual((await CC.extras('main-before-goback-')).length, 1, 'a copy of the current save was kept first');
  const back = await ET.loadState();
  assert.strictEqual(ET.compareTracker(st, back), null);
  assert.ok(back.moved.tracker.wentBack);
  ET.confirmMove(back); await ET.saveState(back, true);
  assert.ok(JSON.parse(ls.get(CC.LS)).moved.tracker.confirmed);
  await ET.clearState();
  assert.strictEqual(await ET.loadState(), null, 'erased');
  assert.ok(ls.get('eveniunt-tracker-state'), 'the save from before the move is still kept');
  assert.strictEqual(await ET.loadState(), null, 'and is not copied back in after erasing');
  await ET.saveState(ET.newState(['New']), true);
  assert.strictEqual(JSON.parse(ls.get(CC.LS)).moved.tracker.from, 'localstorage', 'starting again keeps the move record, so the way back stays offered');
});

test('one save: a Tracker save after an Atelier save keeps the Atelier\'s change, and the reverse', async () => {
  const ls = useStorage();
  ls.set('eveniunt-tracker-state', JSON.stringify(ET.newState(['A', 'B'])));
  const st = await ET.loadState();
  // the Atelier writes its section, knowing nothing of the Tracker's latest
  const r1 = await CC.read();
  await CC.writeSection('atelier', MODS.atelier, { rev: r1.rev, base: null }, { moved: { at: 1, from: null } });
  const k = [...idx.byKey.keys()][0];
  ET.setTick(st, 'c1', k, true);
  let merged = null; ET.onSaveMerged = (m) => { merged = m; };
  await ET.saveState(st, true);
  ET.onSaveMerged = null;
  const doc = JSON.parse(ls.get(CC.LS));
  assert.ok(doc.modules.tracker.ticks.c1[k], 'the tick is saved');
  assert.strictEqual(doc.modules.atelier.chars.c1.stats.j0.craftsmanship, 5000, "the Atelier's stats are kept");
  assert.strictEqual(doc.moved.atelier.at, 1, "the Atelier's move record is kept");
  assert.ok(merged && merged.modules.atelier, 'the Tracker window takes in the Atelier section');
  // the Atelier, with an older copy, writes again: the Tracker's tick stays
  await CC.writeSection('atelier', Object.assign({}, MODS.atelier, { prefs: { guideMs: 700 } }), { rev: r1.rev, base: MODS.atelier });
  const doc2 = JSON.parse(ls.get(CC.LS));
  assert.ok(doc2.modules.tracker.ticks.c1[k]);
  assert.strictEqual(doc2.modules.atelier.prefs.guideMs, 700);
});

test('one save: a save written by a newer version is never overwritten', async () => {
  const ls = useStorage();
  ls.set(CC.LS, JSON.stringify({ app: 'eveniunt-command-center', v: 99, chars: [], modules: {} }));
  assert.strictEqual(await ET.loadState(), null);
  assert.ok(ET.loadProblem && /newer/.test(ET.loadProblem.message));
  const ok = await ET.saveState(ET.newState(['A']), true);
  assert.strictEqual(ok, false);
  assert.strictEqual(JSON.parse(ls.get(CC.LS)).v, 99);
});

test('module sections (Lists, Submersibles, Atelier) survive a backup file, a transfer code and a two-device cloud sync', async () => {
  const st = ET.newState(['A', 'B']); st.modules = JSON.parse(JSON.stringify(MODS)); ET.validateState(st);
  const want = CC.checkModules(MODS);
  const file = JSON.parse(ET.exportFile(st));
  assert.strictEqual(file.app, 'eveniunt-command-center');
  assert.deepStrictEqual(Object.keys(file.save.modules).sort(), ['atelier', 'lists', 'submersibles', 'tracker']);
  assert.deepStrictEqual(ET.importFile(ET.exportFile(st)).modules, want, 'backup file');
  assert.deepStrictEqual((await ET.readTransferCode(await ET.makeTransferCode(st))).modules, want, 'transfer code');
  // two devices: the PC has the module data; the phone starts empty, takes it, adds a submarine; the PC takes that
  const d = fakeGraph();
  await ET.cloudSync(st, 'tok', d.f);
  assert.strictEqual(d.files.f1.v, 2); assert.strictEqual(d.files.f1.format, 'deflate-raw+base64'); assert.strictEqual(d.files.f1.ticks, undefined, 'stored compressed');
  const phone = ET.newState(['A', 'B']); phone.modules = {};
  await ET.cloudSync(phone, 'tok', d.f);
  assert.deepStrictEqual(phone.modules, want, 'the phone has every section');
  phone.modules.submersibles.subs.s3 = { fcId: 'f1', slot: 3, name: 'Sub Three', rank: 1, voyage: null };
  phone.modules.lists.lists.l2 = { name: 'Food', items: {} };
  await ET.cloudSync(phone, 'tok', d.f);
  await ET.cloudSync(st, 'tok', d.f);
  assert.strictEqual(st.modules.submersibles.subs.s3.name, 'Sub Three');
  assert.strictEqual(st.modules.submersibles.subs.s1.voyage.gameSaid, '1d 3h 12m', 'the sample FC, sub and trip arrive whole');
  assert.strictEqual(st.modules.submersibles.trips['s2-1762700000000'].back, 1762750000000);
  assert.strictEqual(st.modules.lists.lists.l2.name, 'Food');
  assert.strictEqual(st.modules.atelier.chars.c1.stats.j0.craftsmanship, 5000);
  assert.deepStrictEqual((await ET.readCloud(d.files.f1)).modules, st.modules);
});

// ── step S2: the Submersibles section's checker and merge (design 7.1, 7.3; blueprint rules 3 and 11) ───────────────
test('Submersibles checker: the sample in the design\'s shape is kept exactly; the id lists match data/submarines.json', () => {
  assert.deepStrictEqual(CC.checkModules({ submersibles: MODS.submersibles }).submersibles, MODS.submersibles, 'nothing in a good section is changed');
  const sd = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  const sectorIds = sd.sectors.map((x) => x.id);
  assert.strictEqual(sectorIds.length, 143);
  for (let n = 0; n <= CC.SUB_SECTOR_MAX + 1; n++) assert.strictEqual(CC.isSubSector(n), sectorIds.includes(n), 'sector ' + n);
  assert.strictEqual(CC.SUB_PART_SLOTS, sd.parts.slice().sort((a, b) => a.id - b.id).map((x) => String(x.slot)).join(''), 'part id → slot');
  assert.strictEqual(CC.SUB_PART_SLOTS.length, sd.parts.length);
});

test('Submersibles checker: bad fields and entries are dropped, never repaired; limits hold; unknown fields go', () => {
  const long = 'x'.repeat(60);
  const out = CC.checkModules({ submersibles: {
    fcs: {
      f1: { name: '  Alpha \n Company  ', world: 'Maduin', charId: 'c9', order: 2, unlockedSlots: 5, discovered: [1, 31, 999, 2, 2, '3', 149], secret: 1 },
      f2: { name: long }, f3: 'not an object', f4: { charId: null, unlockedSlots: 4 },
    },
    subs: {
      s1: { fcId: 'f1', slot: 1, name: long, rank: 146, expIntoRank: -1, parts: [3, 4, 1, 2], voyage: { sentAt: 'soon', returnAt: 1762897920000, calcAt: -5, route: [1, 2, 3, 4, 5, 6, 7, 52], gameSaid: long }, colour: 'red' },
      s2: { fcId: 'f1', slot: 2, rank: 0, parts: [1, 2, 3, 4] },          // parts in the wrong slots
      s3: { fcId: 'f1', slot: 3, rank: 50.5, parts: [3, 4, 1, 999] },     // a part that does not exist
      s4: { fcId: 'f1', slot: 4, voyage: { sentAt: 1, route: [1] } },     // a voyage with no return time
      s5: { slot: 1, name: 'Nowhere' }, s6: { fcId: 'f1', slot: 0 }, s7: { fcId: 'f 1', slot: 1 },
    },
    trips: {
      't-ok': { s: 's1', t: 10, r: [1, 2], back: 20, calc: 'x', said: long, items: [[5665, 3], [0, 1], [10, 0], ['x', 1], [12220, 2, 9]], newSectors: [3, 31], rankAfter: 51 },
      't-bad': { s: 's1' }, 't-bad2': { t: 10 },
    },
    settings: { prefs: { sort: 'nonsense', grouping: 'fleet', quietHours: { from: 1320, to: 420 }, window: { from: 2000, to: 1 }, priceWorld: 'Maduin', theme: 'dark' }, other: { x: 1 } },
    extra: { a: 1 },
  } }).submersibles;
  assert.deepStrictEqual(Object.keys(out), ['fcs', 'subs', 'trips', 'settings'], 'only the four parts of the section');
  assert.deepStrictEqual(out.fcs.f1, { name: 'Alpha Company', world: 'Maduin', order: 2, discovered: [1, 2, 149] }, 'bad character, slots, sectors and the unknown field dropped');
  assert.strictEqual(out.fcs.f2.name.length, 40, 'FC names capped at 40');
  assert.ok(!('f3' in out.fcs));
  assert.deepStrictEqual(out.fcs.f4, { charId: null, unlockedSlots: 4 });
  assert.deepStrictEqual(out.subs.s1, { fcId: 'f1', slot: 1, name: 'x'.repeat(20), parts: [3, 4, 1, 2], voyage: { route: [1, 2, 3, 4, 5], returnAt: 1762897920000, gameSaid: 'x'.repeat(40) } });
  assert.deepStrictEqual(out.subs.s2, { fcId: 'f1', slot: 2, voyage: null }, 'rank 0 and parts in the wrong slots dropped');
  assert.deepStrictEqual(out.subs.s3, { fcId: 'f1', slot: 3, voyage: null }, 'a fractional rank and an unknown part dropped');
  assert.deepStrictEqual(out.subs.s4, { fcId: 'f1', slot: 4, voyage: null });
  assert.deepStrictEqual(Object.keys(out.subs).sort(), ['s1', 's2', 's3', 's4'], 'subs with no free company or slot are dropped');
  assert.deepStrictEqual(out.trips, { 't-ok': { s: 's1', t: 10, r: [1, 2], back: 20, said: 'x'.repeat(40), items: [[5665, 3]], newSectors: [3], rankAfter: 51 } });
  assert.deepStrictEqual(out.settings, { prefs: { grouping: 'fleet', quietHours: { from: 1320, to: 420 }, priceWorld: 'Maduin' } });
});

test('Submersibles checker: trips are never dropped to save space (15,000 trips, about a year for 32 subs)', () => {
  const trips = {};
  for (let i = 0; i < 15000; i++) trips['s' + (i % 32) + '-' + (1762000000000 + i * 60000)] = { s: 's' + (i % 32), t: 1762000000000 + i * 60000, r: [1, 2], back: 1762000000000 + i * 60000 + 9e7, items: [[5665, 2], [12220, 1]], newSectors: [] };
  const out = CC.checkModules({ submersibles: { trips } }).submersibles;
  assert.strictEqual(Object.keys(out.trips).length, 15000);
  const merged = CC.mergeModules({}, { submersibles: { trips } }, {}).submersibles;
  assert.strictEqual(Object.keys(merged.trips).length, 15000, 'and none is lost in a merge');
});

test('Submersibles: two devices each log a different trip and send a different sub; both arrive, no clash', async () => {
  const pc = ET.newState(['A', 'B']); pc.modules = JSON.parse(JSON.stringify(MODS)); ET.validateState(pc);
  const d = fakeGraph();
  await ET.cloudSync(pc, 'tok', d.f);
  const phone = ET.newState(['A', 'B']); phone.modules = {};
  await ET.cloudSync(phone, 'tok', d.f);
  assert.deepStrictEqual(phone.modules.submersibles, MODS.submersibles);
  // the PC: sub 1 came back; its trip is logged and it is sent again
  const pcSub = pc.modules.submersibles;
  pcSub.trips['s1-1762800000000'] = { s: 's1', t: 1762800000000, r: [1, 2], back: 1762897920000, items: [], newSectors: [] };
  pcSub.subs.s1.voyage = { sentAt: 1762898000000, route: [2], returnAt: 1762950000000, gameSaid: '14:26' };
  // the phone: sub 2 had come back earlier; its trip is logged and it is sent
  const phSub = phone.modules.submersibles;
  phSub.trips['s2-1762750000000'] = { s: 's2', t: 1762750000000, r: [3], back: 1762790000000, items: [], newSectors: [] };
  phSub.subs.s2.voyage = { sentAt: 1762898100000, route: [1, 3], returnAt: 1762960000000, gameSaid: '17:12' };
  const r1 = await ET.cloudSync(phone, 'tok', d.f);
  const r2 = await ET.cloudSync(pc, 'tok', d.f);
  const r3 = await ET.cloudSync(phone, 'tok', d.f);
  for (const r of [r1, r2, r3]) assert.ok(r.done === true && !(r.conflicts || []).length, 'no clash: ' + JSON.stringify(r.conflicts || []));
  for (const st of [pc, phone]) {
    const s = st.modules.submersibles;
    assert.deepStrictEqual(Object.keys(s.trips).sort(), ['s1-1762800000000', 's2-1762700000000', 's2-1762750000000']);
    assert.strictEqual(s.subs.s1.voyage.gameSaid, '14:26');
    assert.strictEqual(s.subs.s2.voyage.gameSaid, '17:12');
    assert.strictEqual(s.fcs.f1.name, 'Alpha Company');
  }
  assert.deepStrictEqual(pc.modules, phone.modules);
  // the same through the one save on one device: two pages write different units with stale stamps; both are kept
  useStorage();
  const first = await CC.writeSection('submersibles', MODS.submersibles, null);
  const base = JSON.parse(JSON.stringify(first.section));
  const a = JSON.parse(JSON.stringify(base)); a.trips['s1-1'] = { s: 's1', t: 1, r: [], back: 2, items: [], newSectors: [] };
  const b = JSON.parse(JSON.stringify(base)); b.subs.s2.voyage = { sentAt: 5, route: [], returnAt: 6, gameSaid: '1h' };
  await CC.writeSection('submersibles', a, { rev: first.rev, base });
  const w = await CC.writeSection('submersibles', b, { rev: first.rev, base });
  assert.strictEqual(w.merged, true);
  assert.ok(w.section.trips['s1-1'], 'the other page\'s trip is kept');
  assert.strictEqual(w.section.subs.s2.voyage.gameSaid, '1h');
  assert.strictEqual(CC.describeUnit('m|["submersibles","subs","s2"]', JSON.stringify({ name: 'Sub Two' }), null).what, 'Submersibles: submarine “Sub Two”');
});

test('Submersibles: typed game times, statuses and the calendar file (command-center/src/submersibles/fleet.js)', () => {
  require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'fleet.js'));
  const F = globalThis.FLEET, M = 60000, H = 60 * M;
  for (const [t, ms] of [['1d 3h 12m', 27 * H + 12 * M], ['1d3h12m', 27 * H + 12 * M], ['27:45', 27 * H + 45 * M], ['3:05:10', 3 * H + 5 * M + 10000], ['45 min', 45 * M], ['2 hours 5 minutes', 2 * H + 5 * M], ['12h', 12 * H], [' 1D 2H ', 26 * H]]) assert.strictEqual(F.parseDuration(t), ms, t);
  for (const t of ['', 'soon', '90', '12 mo', '1d 3h tomorrow', '25:61', '0m', '31d']) assert.strictEqual(F.parseDuration(t), null, 'not read: ' + JSON.stringify(t));
  assert.strictEqual(F.parseBackAt('2026-11-12T21:40'), new Date(2026, 10, 12, 21, 40).getTime());
  assert.strictEqual(F.parseBackAt('21:40'), null);
  const fc = { unlockedSlots: 2 };
  assert.strictEqual(F.status({ slot: 3, voyage: null }, fc, 0), 'locked');
  assert.strictEqual(F.status({ slot: 1, voyage: null }, fc, 0), 'idle');
  assert.strictEqual(F.status({ slot: 1, voyage: { returnAt: 10 } }, fc, 5), 'out');
  assert.strictEqual(F.status({ slot: 2, voyage: { returnAt: 10 } }, fc, 10), 'back');
  assert.strictEqual(F.fmtDur(2 * H + 4 * M + 59000, true), '2 h 5 min', 'time to go rounds up');
  assert.strictEqual(F.fmtDur(2 * H + 4 * M + 59000), '2 h 4 min', 'time waited rounds down');
  assert.strictEqual(F.fmtDur(27 * H + 12 * M), '1 d 3 h 12 min');
  const at = Date.UTC(2026, 10, 12, 21, 40, 0);
  const ics = F.ics({ title: 'Alpha, Co; · Sub One back', at, uid: 's1-' + at, note: 'typed', now: at - H });
  const lines = ics.split('\r\n');
  assert.ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics), 'CRLF line ends');
  assert.ok(lines.includes('DTSTART:20261112T214000Z') && lines.includes('DTEND:20261112T215500Z') && lines.includes('TRIGGER:PT0M'));
  assert.ok(lines.includes('SUMMARY:Alpha\\, Co\\; · Sub One back'), 'commas and semicolons escaped');
  assert.strictEqual(lines.filter((l) => l === 'BEGIN:VEVENT').length, 1);
  assert.ok(lines.every((l) => Buffer.byteLength(l) <= 75), 'lines folded at 75 octets');
  assert.strictEqual(F.fileName('Alpha Company · Sub One back'), 'alpha-company-sub-one-back.ics');
  assert.strictEqual(F.tripId('sabc', 1762800000000.4), 'sabc-1762800000000');
  assert.ok(CC.safeKey(F.tripId(F.newId('s'), Date.now())), 'trip ids are valid save keys');
});

test('Submersibles: the voyage gauge share (W21) is worked out from the stored send and return times, clamped, and absent when either is missing', () => {
  require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'fleet.js'));
  const F = globalThis.FLEET, H = 3600000, v = { sentAt: 1000 * H, returnAt: 1004 * H };
  assert.strictEqual(F.voyageProgress(v, 1000 * H), 0, 'at the send time');
  assert.strictEqual(F.voyageProgress(v, 1001 * H), 0.25);
  assert.strictEqual(F.voyageProgress(v, 1002 * H), 0.5, 'mid-voyage');
  assert.strictEqual(F.voyageProgress(v, 1004 * H), 1, 'at the return time');
  assert.strictEqual(F.voyageProgress(v, 1009 * H), 1, 'after the return: clamped');
  assert.strictEqual(F.voyageProgress(v, 990 * H), 0, 'before the send time: clamped');
  for (const bad of [null, undefined, {}, { returnAt: 5 }, { sentAt: 5 }, { sentAt: 0, returnAt: 5 }, { sentAt: 9, returnAt: 9 }, { sentAt: 9, returnAt: 3 }, { sentAt: 'x', returnAt: 5 }]) assert.strictEqual(F.voyageProgress(bad, 4), null, JSON.stringify(bad));
});

test('Submersibles: worked-out voyages match the five hand-worked voyages to the second (advisor.js)', () => {
  const SD = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'advisor.js'));
  const A = globalThis.ADVISOR.init(SD);
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'submarine-voyages.json'), 'utf8'));
  for (const v of FX.voyages) {
    const p = v.build.parts, st = A.stats(v.build.rank, [p.hull, p.stern, p.bow, p.bridge]);
    assert.deepStrictEqual(st, v.stats, v.id + ' stats');
    const ev = A.evalRoute(v.route, st), after = A.rankAfter(v.build.rank, v.build.expIntoRank, ev.exp);
    assert.deepStrictEqual([ev.range, ev.reachable, ev.tanks, ev.exp, ev.seconds, after.rank, after.into],
      [v.expected.rangeUsed, v.expected.reachable, v.expected.tanks, v.expected.exp, v.expected.voyageSeconds, v.expected.rankAfter, v.expected.expIntoRankAfter], v.id);
    assert.strictEqual(new Date(Date.parse(v.sentAt) + ev.seconds * 1000).toISOString().replace('.000', ''), v.expected.returnAt, v.id + ' return time');
  }
  assert.strictEqual(A.stats(10, [3, 4, 1]), null, 'no stats without four parts');
  assert.strictEqual(A.evalRoute([1, 32], A.stats(50, [3, 4, 1, 2])), null, 'a route stays in one sea');
});

// Players measuring the game on the official Square Enix forum ("Max Level Submersible Planner", posts 41 and 49,
// 2020-08-22 and 2021-04-18) found, independently of Submarine Tracker: a fixed 12 hours per voyage; travel of
// floor(distance x 39.9) minutes at speed 1; a survey of 61,600 minutes / speed for an 880-minute sector (70 per minute).
test('Submersibles: the formula\'s numbers agree with what players measured in the game (official forum)', () => {
  const SD = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  const A = globalThis.ADVISOR.init(SD), Fm = SD.formula;
  assert.strictEqual(Fm.fixedSeconds, 12 * 3600, 'fixed 12 hours');
  assert.strictEqual(Fm.travelFactor / 100, 39.9, '39.9 minutes per unit of distance at speed 1');
  assert.strictEqual(Fm.surveyFactor / 100, 70, '70 minutes per survey minute at speed 1');
  const blue = SD.sectors.find((s) => s.id === 51); // the Blue Hole (T), 880 survey minutes
  assert.strictEqual(blue.survey * Fm.surveyFactor / 100, 61600);
  const st = (speed) => ({ surveillance: 0, retrieval: 0, speed, range: 999, favor: 0 });
  const sea = SD.seas.find((x) => x.id === blue.sea), r = Math.hypot(sea.x - blue.x, sea.y - blue.y, sea.z - blue.z);
  assert.strictEqual(A.evalRoute([51], st(1)).seconds, 43200 + Math.floor(r * 39.9 * 60) + 61600 * 60, 'speed 1: 12 h + travel + 61,600 minutes');
  assert.strictEqual(A.evalRoute([51], st(70)).seconds, 43200 + Math.floor(r * 3990 / 7000 * 60) + Math.floor(61600 / 70 * 60), 'speed 70: the survey is 61,600 / 70 minutes');
});

test('Submersibles: rank after a voyage moves on by the base experience ("at least"); the checker keeps the rank evidence', () => {
  const SD = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  const A = globalThis.ADVISOR.init(SD);
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'submarine-voyages.json'), 'utf8'));
  for (const v of FX.voyages) {
    const a = A.afterVoyage({ rank: v.build.rank, expIntoRank: v.build.expIntoRank }, v.route);
    assert.deepStrictEqual([a.exp, a.rank, a.into], [v.expected.exp, v.expected.rankAfter, v.expected.expIntoRankAfter], v.id);
  }
  assert.strictEqual(A.afterVoyage({ rank: 10 }, []), null, 'no route, no rank change');
  assert.strictEqual(A.afterVoyage({ rank: 145, expIntoRank: 5 }, [1]).rank, 145, 'stays at the top rank');
  const out = CC.checkModules({ submersibles: { trips: { t1: { s: 's1', t: 1, rankAfter: 52, rankCalc: 51 }, t2: { s: 's1', t: 2, rankCalc: 146 } } } }).submersibles.trips;
  assert.deepStrictEqual([out.t1.rankAfter, out.t1.rankCalc, out.t2.rankCalc], [52, 51, undefined]);
});

test('Submersibles experience learning (owner 2026-11-15): exact experience from the typed rank and progress, per-grade factors, slips ignored', () => {
  const SD = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'advisor.js'));
  const A = globalThis.ADVISOR.init(SD);
  const R = new Map(SD.ranks.map((r) => [r.rank, r]));
  // the experience between two points counts every rank crossed
  assert.strictEqual(A.expBetween(10, 100, 10, 600), 500);
  assert.strictEqual(A.expBetween(10, 100, 12, 50), R.get(10).expToNext - 100 + R.get(11).expToNext + 50);
  assert.strictEqual(A.expBetween(12, 0, 10, 0), null, 'going backwards is inconsistent');
  assert.strictEqual(A.expBetween(10, R.get(10).expToNext, 11, 0), null, 'a start the game cannot show (as much as the rank needs) is inconsistent');
  assert.strictEqual(A.expBetween(10, 0, 10, R.get(10).expToNext + 5), null, 'an end the game cannot show is inconsistent');
  assert.strictEqual(A.expBetween(10, 600, 10, 100), null, 'less experience at the same rank is inconsistent');
  assert.deepStrictEqual(A.rankAfter(10, 1e9, 1000), { rank: 10, into: 1000 }, 'an impossible saved progress is unknown (0), never carried into an estimate');
  // and agrees with rankAfter
  const after = A.rankAfter(10, 100, 123456);
  assert.strictEqual(A.expBetween(10, 100, after.rank, after.into), 123456);
  // learning: median per grade, slips outside 0.5x..4x ignored, nothing learned -> factor 1 (base)
  const trips = [
    { expBase: 1000, expGot: 1250, grade: 'A' }, { expBase: 2000, expGot: 2500, grade: 'A' }, { expBase: 1000, expGot: 1300, grade: 'A' },
    { expBase: 1000, expGot: 1500, grade: 'S' },
    { expBase: 1000, expGot: 1000, grade: 'C' },
    { expBase: 1000, expGot: 9000, grade: 'SS' }, // a slip
    { expBase: 1000, grade: 'B' }, // rank typed without the experience: not exact, not learned
    { expBase: 1000, expGot: 1100 } // exact but no grade: counts overall only
  ];
  const L = A.learn(trips);
  assert.strictEqual(L.n, 6);
  assert.deepStrictEqual(L.grades.A, { factor: 1.25, n: 3 });
  assert.deepStrictEqual(L.grades.S, { factor: 1.5, n: 1 });
  assert.ok(!L.grades.SS && !L.grades.B);
  assert.strictEqual(A.factorFor(L, 'A'), 1.25);
  assert.strictEqual(A.factorFor(L, 'B'), 1, 'nothing learned for B: the base');
  assert.strictEqual(A.factorFor(L, ''), 1);
  assert.strictEqual(A.factorFor(A.learn([]), 'S'), 1);
  // the save keeps the new trip fields and drops bad ones
  const sec = CC.checkModules({ submersibles: { fcs: {}, subs: {}, settings: {}, trips: {
    ok: { s: 's1', t: 1, r: [1], back: 2, items: [], newSectors: [], grade: 'SS', expBase: 1000, expGot: 1500 },
    bad: { s: 's1', t: 3, r: [1], back: 4, items: [], newSectors: [], grade: 'Z', expBase: -5, expGot: 1.5 } } } }).submersibles;
  const subsSec = CC.checkModules({ submersibles: { fcs: {}, trips: {}, settings: {}, subs: { x: { fcId: 'f', slot: 1, rank: 3, expIntoRank: 5, expExact: true }, y: { fcId: 'f', slot: 2, rank: 3, expExact: 'yes' } } } }).submersibles;
  assert.strictEqual(subsSec.subs.x.expExact, true); assert.strictEqual(subsSec.subs.y.expExact, undefined, 'only true is kept');
  const badSec = CC.checkModules({ submersibles: { fcs: {}, trips: {}, settings: {}, subs: { z: { fcId: 'f', slot: 1, rank: 3, expIntoRank: -4, expExact: true }, w: { fcId: 'f', slot: 2, rank: 900, expIntoRank: 4, expExact: true } } } }).submersibles;
  assert.strictEqual(badSec.subs.z.expExact, undefined, 'exact only with a valid experience'); assert.strictEqual(badSec.subs.w.expExact, undefined, 'exact only with a valid rank');
  assert.strictEqual(sec.trips.ok.grade, 'SS'); assert.strictEqual(sec.trips.ok.expBase, 1000); assert.strictEqual(sec.trips.ok.expGot, 1500);
  assert.ok(sec.trips.bad && sec.trips.bad.grade === undefined && sec.trips.bad.expBase === undefined && sec.trips.bad.expGot === undefined, 'bad fields dropped, the trip kept');
});

test('Submersibles advisor: the owner\'s order (unlock all four subs, discover every sector, farm gil), parts only at the end', () => {
  const SD = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  const A = globalThis.ADVISOR.init(SD);
  const shark = [3, 4, 1, 2], all = SD.sectors.map((s) => s.id);
  // missing rank or parts: no guess
  assert.ok(A.advise({ sub: { rank: 5, parts: null }, fc: { unlockedSlots: 1, discovered: [1, 2] } }).blocked);
  // step 1, the slot-2 sector (Deep-sea Site J) not yet found: survey the discovered sector that reveals the next one on the way
  const a1 = A.advise({ sub: { rank: 1, parts: shark }, fc: { unlockedSlots: 1, discovered: [1, 2] }, slotsFilled: 1 });
  assert.strictEqual(a1.step, 1); assert.ok(a1.plan.route.includes(2), 'B reveals E, on the way to J'); assert.match(a1.plan.why, /slot 2/);
  // step 1, J discovered and the rank allows it: a route that surveys J, the quickest one
  const a2 = A.advise({ sub: { rank: 25, parts: shark }, fc: { unlockedSlots: 1, discovered: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, slotsFilled: 1 });
  assert.deepStrictEqual([a2.step, a2.plan.route], [1, [10]]);
  // step 1, rank too low for the next sector on the way: level with the most experience per hour, and say why
  const a3 = A.advise({ sub: { rank: 5, parts: shark }, fc: { unlockedSlots: 1, discovered: [1, 2, 3, 4, 5, 6] }, slotsFilled: 1 });
  assert.strictEqual(a3.step, 1); assert.match(a3.plan.why, /levelling to rank 7/);
  // a slot unlocked but empty: the note says the next slot only shows once it holds a sub
  assert.match(A.advise({ sub: { rank: 25, parts: shark }, fc: { unlockedSlots: 2, discovered: [1, 2] }, slotsFilled: 1 }).note, /slot 2 holds a submarine/);
  // step 2 once all four slots are unlocked: the route that reveals the most new sectors
  const a4 = A.advise({ sub: { rank: 40, parts: shark }, fc: { unlockedSlots: 4, discovered: [1, 2, 3, 4, 5, 6] }, slotsFilled: 4 });
  assert.strictEqual(a4.step, 2); assert.match(a4.plan.why, /reveal \d+ new sector/);
  // sectors already on another sub's voyage are not counted again
  const a5 = A.advise({ sub: { rank: 40, parts: shark }, fc: { unlockedSlots: 4, discovered: [1, 2, 3, 4, 5, 6] }, slotsFilled: 4, pending: a4.plan.route });
  assert.notDeepStrictEqual(a5.plan.route, a4.plan.route);
  for (const a of [a1, a2, a3, a4, a5]) assert.ok(!a.parts, 'no part advice before the gil step');
  // step 3 with everything found: a reachable community gil route, and a part tip
  const a6 = A.advise({ sub: { rank: 145, parts: [31, 24, 25, 34] }, fc: { unlockedSlots: 4, discovered: all }, slotsFilled: 4 });
  assert.strictEqual(a6.step, 3); assert.match(a6.plan.why, /community gil route/);
  assert.ok(A.evalRoute(a6.plan.route, A.stats(145, [31, 24, 25, 34])).reachable);
  assert.ok(a6.parts === null || /sooner \(calculated\)/.test(a6.parts.why));
  const a7 = A.advise({ sub: { rank: 145, parts: shark }, fc: { unlockedSlots: 4, discovered: all }, slotsFilled: 4 });
  assert.ok(a7.parts && a7.parts.gain >= 60, 'a weak build at the gil step gets a part tip');
  // every suggestion is a valid, reachable route of 1 to 5 discovered sectors the rank allows
  for (const a of [a1, a2, a3, a4, a5, a6, a7]) for (const x of [a.plan].concat(a.alts)) assert.ok(x.ev.reachable && x.route.length >= 1 && x.route.length <= 5);
});

test('Submersibles advisor, advice from the log (S6-2): ranked reachable routes become the plan, by gil per hour for this sub, with the rules of the spec', () => {
  const SD = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  const A = globalThis.ADVISOR.init(SD);
  const all = SD.sectors.map((s) => s.id), build = [31, 24, 25, 34];
  const base = { sub: { rank: 145, parts: build }, fc: { unlockedSlots: 4, discovered: all }, slotsFilled: 4 };
  const L = (route, trips, perTrip, enough) => ({ route, trips, perTrip, enough: enough === undefined ? trips >= 10 : enough });
  const secs = (r) => A.evalRoute(r, A.stats(145, build)).seconds;
  const plain = A.advise(base);
  // without a log (none, null or empty) the result is today's
  for (const extra of [{}, { logged: null }, { logged: [] }, { logged: [L([1, 2], 9, 5000)], enough: 10 }]) {
    const a = A.advise(Object.assign({}, base, extra));
    assert.deepStrictEqual(a.plan.route, plain.plan.route); assert.deepStrictEqual(a.alts.map((x) => x.route), plain.alts.map((x) => x.route));
    assert.ok(!a.own, 'not from the log'); assert.match(a.plan.why, /community gil route/); assert.doesNotMatch(a.plan.why, /logging arrives/);
  }
  // 9 voyages do not count: the reason says how many there are
  const nine = A.advise(Object.assign({}, base, { logged: [L(plain.plan.route, 9, 5000)], enough: 10 }));
  assert.deepStrictEqual(nine.plan.route, plain.plan.route); assert.match(nine.plan.why, /takes over once a route has 10 logged voyages \(this one has 9\)/);
  // a ranked, reachable route becomes the plan, with the figures and the price note
  assert.notDeepStrictEqual(plain.plan.route, [1, 2]);
  const own = A.advise(Object.assign({}, base, { logged: [L([1, 2], 14, 412000)], enough: 10, priceNote: 'Market prices seen Tue 14:05 on this device.' }));
  assert.strictEqual(own.own, true); assert.strictEqual(own.plan.own, true); assert.deepStrictEqual(own.plan.route, [1, 2]);
  assert.match(own.plan.why, /^From your own log: about 412,000 gil a voyage over 14 logged voyages; this sub is back in \d+(\.\d)? hours, so about [\d,]+ gil per hour\. Market prices seen Tue 14:05 on this device\.$/);
  assert.strictEqual(own.alts.length, 2, 'filled up from today\'s list');
  for (const x of own.alts) { assert.match(x.why, /^Not enough of your own data \(0 of 10 voyages\)/); assert.notDeepStrictEqual(x.route, [1, 2]); assert.ok(x.ev.reachable); }
  assert.notDeepStrictEqual(own.alts[0].route, own.alts[1].route);
  // a community route with enough logged voyages but no known price (pays 0): not "not enough data", and no gil figure
  const noPrice = A.advise(Object.assign({}, base, { logged: [L([1, 2], 14, 412000), L(plain.plan.route, 12, 0)], enough: 10 }));
  const np = noPrice.alts.find((x) => x.route.join() === plain.plan.route.join());
  assert.ok(np, 'the unpriced community route is listed'); assert.match(np.why, /^Its items have no known price on this device \(12 logged voyages\), so no gil figure;/); assert.doesNotMatch(np.why, /Not enough of your own data/);
  // the order: gil per hour for this sub; the fill-up names the logged count of a thin route
  const thin = A.advise(Object.assign({}, base, { logged: [L([1, 2], 14, 412000), L(plain.plan.route, 4, 1000, false)], enough: 10 }));
  assert.ok(thin.alts.some((x) => x.route.join() === plain.plan.route.join() && /\(4 of 10 voyages\)/.test(x.why)));
  const g = (r, p) => p / (secs(r) / 3600), pa = { '1,2': 100000, '1': 90000, '2': 20000 };
  const o3 = A.advise(Object.assign({}, base, { logged: [L([2], 12, pa['2']), L([1], 12, pa['1']), L([1, 2], 12, pa['1,2'])], enough: 10 }));
  const want = [[1], [1, 2], [2]].sort((x, y) => g(y, pa[y.join()]) - g(x, pa[x.join()]));
  assert.deepStrictEqual([o3.plan.route].concat(o3.alts.map((x) => x.route)), want, 'best gil per hour first, by this sub\'s own hours (not the log\'s)');
  // tie-break 1: equal gil per hour, fewer seconds first (the shorter route)
  const sS = secs([1]), sL = secs([2]); assert.ok(sS < sL);
  const gph = 50000 / (sS / 3600), pL = 50000 * sL / sS, ulp = (x, n) => { const f = new Float64Array([x]), u = new BigInt64Array(f.buffer); u[0] += BigInt(n); return f[0]; };
  let found = null;
  for (let k = -64; k <= 64 && found === null; k++) if (ulp(pL, k) / (sL / 3600) === gph) found = ulp(pL, k);
  assert.ok(found !== null, 'test data: an equal figure exists');
  const t1 = A.advise(Object.assign({}, base, { logged: [L([2], 12, found), L([1], 12, 50000)], enough: 10 }));
  assert.deepStrictEqual(t1.plan.route, [1], 'equal gil per hour: fewer seconds first'); assert.deepStrictEqual(t1.alts[0].route, [2]);
  // tie-break 2: equal gil per hour and equal seconds, the route text ascending (32,36 before 34,38), in either input order
  assert.strictEqual(secs([32, 36]), secs([34, 38]));
  for (const list of [[L([34, 38], 11, 70000), L([32, 36], 11, 70000)], [L([32, 36], 11, 70000), L([34, 38], 11, 70000)]]) {
    const t2 = A.advise(Object.assign({}, base, { logged: list, enough: 10 }));
    assert.deepStrictEqual(t2.plan.route, [32, 36]); assert.deepStrictEqual(t2.alts[0].route, [34, 38]);
  }
  // routes this sub cannot run are ignored: an undiscovered sector, a sector above the rank, a route out of range, and perTrip 0
  const ignored = [
    [Object.assign({}, base, { fc: { unlockedSlots: 4, discovered: all.filter((id) => id !== 2) } }), L([1, 2], 20, 9e6)],
    [Object.assign({}, base, { sub: { rank: 1, parts: [3, 4, 1, 2] } }), L([1, 2, 3], 20, 9e6)],
    [Object.assign({}, base, { sub: { rank: 145, parts: [3, 4, 1, 2] } }), null],
    [base, L([1, 2], 20, 0)]
  ];
  const far = [50, 43, 48, 45, 39]; // 202 of 200 range for the weak build
  assert.ok(!A.evalRoute(far, A.stats(145, [3, 4, 1, 2])).reachable, 'test data: a route out of range of the weak build');
  ignored[2][1] = L(far, 20, 9e6);
  for (const [input, l] of ignored) {
    const ref = A.advise(input), got = A.advise(Object.assign({}, input, { logged: [l], enough: 10 }));
    assert.ok(!got.own, 'ignored: ' + l.route.join()); assert.deepStrictEqual(got.plan.route, ref.plan.route);
  }
  // blocked stays blocked
  assert.ok(A.advise({ sub: { rank: 5, parts: null }, fc: { unlockedSlots: 1, discovered: [1] }, logged: [L([1], 20, 100)] }).blocked);
});

test('Submersibles advisor, part advice in gil (S6-3): the swap that raises the best gil per hour, only if it lowers no surveillance, retrieval or favor', () => {
  const SD = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  const A = globalThis.ADVISOR.init(SD);
  const all = SD.sectors.map((s) => s.id), weak = [3, 4, 1, 2], good = [31, 24, 25, 34], PT = {};
  SD.parts.forEach((p) => { PT[p.id] = p; });
  const base = (parts) => ({ sub: { rank: 145, parts }, fc: { unlockedSlots: 4, discovered: all }, slotsFilled: 4 });
  const L = (route, trips, perTrip) => ({ route, trips, perTrip, enough: trips >= 10 });
  const gphOf = (parts, route, perTrip) => { const ev = A.evalRoute(route, A.stats(145, parts)); return ev.reachable ? perTrip / (ev.seconds / 3600) : 0; };
  // a ranked route the weak build runs slowly: a tip in gil, with the figures and the three stats not lowered
  const a = A.advise(Object.assign(base(weak), { logged: [L([1, 2], 12, 100000)], enough: 10 }));
  assert.ok(a.parts && /more gil per hour/.test(a.parts.why) && /lowers none of surveillance, retrieval and favor/.test(a.parts.why));
  assert.ok(a.parts.gilGain > 0 && a.parts.gain > 0 && Number.isInteger(a.parts.slot) && a.parts.from === weak[a.parts.slot]);
  for (const k of ['surveillance', 'retrieval', 'favor']) assert.ok(PT[a.parts.to][k] >= PT[a.parts.from][k], 'does not lower ' + k);
  assert.ok(a.parts.gain >= gphOf(weak, [1, 2], 100000) * 0.01);
  // the best swap by brute force over the allowed ones: same gain, and the tie-break is the lower slot then the lower part id
  const brute = (parts, logged) => {
    const cur = Math.max(0, ...logged.map((l) => gphOf(parts, l.route, l.perTrip))); let best = null;
    for (let i = 0; i < 4; i++) for (const p of SD.parts.slice().sort((x, y) => x.id - y.id)) {
      const o = PT[parts[i]];
      if (p.slot !== i || p.id === parts[i] || SD.classes.find((c) => c.id === p.class).rank > 145) continue;
      if (p.surveillance < o.surveillance || p.retrieval < o.retrieval || p.favor < o.favor) continue;
      const np = parts.slice(); np[i] = p.id;
      const g = Math.max(0, ...logged.map((l) => gphOf(np, l.route, l.perTrip))) - cur;
      if (g > 0 && (!best || g > best.gain)) best = { slot: i, to: p.id, gain: g };
    }
    return { cur, best };
  };
  const bf = brute(weak, [L([1, 2], 12, 100000)]);
  assert.strictEqual(a.parts.slot, bf.best.slot); assert.strictEqual(a.parts.to, bf.best.to); assert.ok(Math.abs(a.parts.gain - bf.best.gain) < 1e-6);
  // a swap that makes a better, ranked route reachable is preferred to one that only saves minutes
  const far = [50, 43, 48, 45, 39];
  assert.ok(!A.evalRoute(far, A.stats(145, weak)).reachable);
  const f = A.advise(Object.assign(base(weak), { logged: [L(far, 12, 500000)], enough: 10 }));
  assert.ok(f.parts && /nothing within range now/.test(f.parts.why), 'a route out of range now comes into range');
  assert.ok(A.evalRoute(far, A.stats(145, weak.map((p, i) => (i === f.parts.slot ? f.parts.to : p)))).reachable);
  const timeOnly = A.advise(base(weak)).parts; // today's tip (no log) looks at minutes only
  assert.ok(timeOnly && /sooner \(calculated\)/.test(timeOnly.why));
  // below 1% of the current best: no tip (a build that is already the best the rank allows for the ranked route)
  const none = A.advise(Object.assign(base(good), { logged: [L([1, 2], 12, 100000)], enough: 10 }));
  assert.strictEqual(none.own, true); assert.strictEqual(none.parts, null, 'no better part: no tip');
  // a gain strictly between 0 and 1% of the current best gives no tip (fixed inputs: the best allowed swap gains about 0.35%)
  const small = [31, 8, 9, 22], bfs = brute(small, [L([1], 12, 100000)]);
  assert.ok(bfs.best && bfs.best.gain > 0 && bfs.best.gain < bfs.cur * 0.01 && bfs.best.gain > bfs.cur * 0.001, 'test data: a gain between 0 and 1%');
  assert.strictEqual(A.advise(Object.assign(base(small), { logged: [L([1], 12, 100000)], enough: 10 })).parts, null, 'a gain below 1%: no tip');
  // exact ties, from real inputs: the same best gain from two parts; the lower slot wins, then the lower part id
  const tieSlot = [7, 12, 37, 38], bt = brute(tieSlot, [L([1], 12, 100000)]);
  const gains = []; // the allowed swaps with the best gain, found without the advisor's own loop order
  for (const p of SD.parts) { const i = p.slot, o = PT[tieSlot[i]]; if (p.id === tieSlot[i] || SD.classes.find((c) => c.id === p.class).rank > 145 || p.surveillance < o.surveillance || p.retrieval < o.retrieval || p.favor < o.favor) continue; const np = tieSlot.slice(); np[i] = p.id; gains.push({ slot: i, id: p.id, g: gphOf(np, [1], 100000) - bt.cur }); }
  const top = Math.max(...gains.map((x) => x.g)), tops = gains.filter((x) => x.g === top);
  assert.ok(tops.length > 1 && new Set(tops.map((x) => x.slot)).size > 1, 'test data: an exact tie across slots');
  const ts = A.advise(Object.assign(base(tieSlot), { logged: [L([1], 12, 100000)], enough: 10 })).parts;
  assert.strictEqual(ts.slot, Math.min(...tops.map((x) => x.slot))); assert.strictEqual(ts.to, 27);
  const tiePart = [23, 32, 9, 6], bp = brute(tiePart, [L([1], 12, 100000)]);
  const gp = SD.parts.filter((p) => p.slot === 3 && p.id !== 6 && (p.id === 14 || p.id === 34)).map((p) => gphOf([23, 32, 9, p.id], [1], 100000) - bp.cur);
  assert.strictEqual(gp.length, 2); assert.strictEqual(gp[0], gp[1], 'test data: two parts of one slot with exactly the same gain');
  assert.ok(Math.abs(bp.best.gain - gp[0]) < 1e-9);
  const tp = A.advise(Object.assign(base(tiePart), { logged: [L([1], 12, 100000)], enough: 10 })).parts;
  assert.strictEqual(tp.slot, 3); assert.strictEqual(tp.to, 14, 'same slot: the lower part id');
  // a swap that lowers retrieval, surveillance or favor is never suggested, even when it is faster
  const lowers = SD.parts.some((p) => p.slot === 0 && PT[weak[0]] && (p.surveillance < PT[weak[0]].surveillance || p.retrieval < PT[weak[0]].retrieval || p.favor < PT[weak[0]].favor) && p.speed > PT[weak[0]].speed);
  assert.ok(lowers, 'test data: a faster hull that lowers a stat exists');
  for (const lg of [[L([1, 2], 12, 1e5)], [L([1], 12, 5e4), L([2], 12, 9e4)], [L(far, 12, 5e5)]]) {
    const r = A.advise(Object.assign(base(weak), { logged: lg, enough: 10 }));
    if (r.parts) for (const k of ['surveillance', 'retrieval', 'favor']) assert.ok(PT[r.parts.to][k] >= PT[r.parts.from][k]);
  }
  // with no ranked route (none, or nine voyages) the tip is today's, unchanged
  for (const lg of [null, [], [L([1, 2], 9, 100000)]]) {
    const r = A.advise(Object.assign(base(weak), lg ? { logged: lg, enough: 10 } : {}));
    assert.deepStrictEqual(r.parts, timeOnly);
  }
  // the tip keeps its four fields and the result is null (not undefined) when there is none
  for (const k of ['slot', 'from', 'to', 'why']) assert.ok(k in a.parts);
  assert.ok(A.advise(Object.assign(base(good), { logged: [L([1, 2], 12, 100000)], enough: 10 })).parts === null);
});

test('Submersibles notifications: automatic grouping by stage, stragglers, the three fixed groupings, quiet hours (push.js)', () => {
  require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'push.js'));
  const P = globalThis.PUSH, M = 60000, now = new Date(2026, 10, 12, 12, 0).getTime();
  const sec = { fcs: { a: { name: 'Alpha', unlockedSlots: 4 }, b: { name: 'Bravo', unlockedSlots: 4 } }, subs: {}, trips: {}, settings: {} };
  const add = (id, fc, slot, inMin) => { sec.subs[id] = { fcId: fc, slot, name: 'Sub ' + id, voyage: inMin == null ? null : { returnAt: now + inMin * M, route: [1] } }; };
  add('a1', 'a', 1, 60); add('a2', 'a', 2, 75); add('a3', 'a', 3, null); add('a4', 'a', 4, 200);
  add('b1', 'b', 1, 600); add('b2', 'b', 2, 601); add('b3', 'b', 3, 602); add('b4', 'b', 4, 500);
  const stage = { a: 'unlock', b: 'gil' };
  // automatic: Alpha (unlocking) per sub; Bravo (gil) one alert for 3 subs, its straggler b4 (100 minutes early) on its own
  const auto = P.alerts(sec, {}, (id) => stage[id], now);
  assert.deepStrictEqual(P.modes(sec, {}, (id) => stage[id]), { a: 'sub', b: 'fc' });
  assert.deepStrictEqual(auto.map((x) => x.title), ['Alpha · Sub a1 is back', 'Alpha · Sub a2 is back', 'Alpha · Sub a4 is back', 'Bravo · Sub b4 is back', 'Bravo: 3 subs back']);
  assert.strictEqual(auto[4].at, now + 602 * M); assert.strictEqual(auto[4].body, 'Sub b1, Sub b2, Sub b3');
  // automatic, every free company finished: one alert for the whole fleet (stragglers on their own)
  const fin = P.alerts(sec, { grouping: 'auto' }, () => 'final', now);
  assert.deepStrictEqual(P.modes(sec, {}, () => 'final'), { a: 'fleet', b: 'fleet' });
  assert.strictEqual(fin[fin.length - 1].title, 'Fleet back: 3 submarines');
  assert.strictEqual(fin.length, 1 + 4, 'the four subs more than 30 minutes before the last (a1, a2, a4, b4) each get their own');
  // a fixed choice wins over the stage
  assert.strictEqual(P.alerts(sec, { grouping: 'sub' }, () => 'final', now).length, 7);
  assert.deepStrictEqual(P.alerts(sec, { grouping: 'fc' }, () => 'unlock', now).map((x) => x.title).filter((t) => /subs back/.test(t)), ['Bravo: 3 subs back'], 'Alpha\'s subs are each more than 30 minutes apart, so each has its own');
  // a locked slot, a voyage already back and no voyage give no alert
  sec.fcs.a.unlockedSlots = 3; const noA4 = P.alerts(sec, { grouping: 'sub' }, () => 'unlock', now); sec.fcs.a.unlockedSlots = 4;
  assert.ok(!noA4.some((x) => /a4/.test(x.title)));
  assert.strictEqual(P.alerts(sec, { grouping: 'sub' }, () => 'unlock', now + 1000 * M).length, 0);
  // quiet hours 22:00 to 08:00: an alert at 23:40 waits until 08:00 next day; "always" does not
  const night = { fcs: { a: { name: 'Alpha', unlockedSlots: 1 } }, subs: { n: { fcId: 'a', slot: 1, name: 'Night', voyage: { returnAt: new Date(2026, 10, 12, 23, 40).getTime() } } }, trips: {}, settings: {} };
  const q = P.alerts(night, { grouping: 'sub', night: 'quiet', quietHours: { from: 22 * 60, to: 8 * 60 } }, () => 'unlock', now);
  assert.strictEqual(q[0].at, new Date(2026, 10, 13, 8, 0).getTime()); assert.match(q[0].body, /back at 23:40, held for your quiet hours/);
  const a = P.alerts(night, { grouping: 'sub', night: 'always', quietHours: { from: 22 * 60, to: 8 * 60 } }, () => 'unlock', now);
  assert.strictEqual(a[0].at, new Date(2026, 10, 12, 23, 40).getTime());
  // a daytime quiet window (13:00 to 15:00) and an alert outside it
  const day = P.alerts(night, { night: 'quiet', grouping: 'sub', quietHours: { from: 13 * 60, to: 15 * 60 } }, () => 'unlock', now);
  assert.strictEqual(day[0].at, new Date(2026, 10, 12, 23, 40).getTime());
  // the checker keeps the new preferences
  assert.deepStrictEqual(CC.checkModules({ submersibles: { settings: { prefs: { grouping: 'auto', night: 'quiet', quietHours: { from: 1320, to: 480 } } } } }).submersibles.settings.prefs, { grouping: 'auto', night: 'quiet', quietHours: { from: 1320, to: 480 } });
});

test('the Command Center\'s own settings section: the night rule kept, anything else dropped', () => {
  assert.deepStrictEqual(CC.checkModules({ settings: { notify: { night: 'quiet', quietHours: { from: 1320, to: 480 }, extra: 1 }, other: 2 } }).settings, { notify: { night: 'quiet', quietHours: { from: 1320, to: 480 } } });
  assert.deepStrictEqual(CC.checkModules({ settings: { notify: { night: 'loud', quietHours: { from: 9999, to: 1 } } } }).settings, { notify: {} });
});

test('old formats still load: backups and EVT1 codes from before gate 1C, and a v1 cloud copy, leave the module sections alone', async () => {
  const st = ET.newState(['A']); const k = [...idx.byKey.keys()][5]; ET.setTick(st, 'c1', k, true);
  const oldFile = JSON.stringify({ app: 'eveniunt-completionist-tracker', saved: 'x', state: Object.assign({ v: 1 }, ET.portable(st)) });
  const fromOld = ET.importFile(oldFile);
  assert.ok(fromOld.ticks.c1[k]); assert.strictEqual(fromOld.modules, undefined, 'an old backup speaks only for the Tracker');
  const doc = { c: [['c1', 'A', '', '', 0]], t: { c1: { [k.split(':')[0]]: k.split(':')[1] } }, a: {}, s: {}, e: {}, v: {} };
  const evt1 = 'EVT1-' + require('zlib').deflateRawSync(Buffer.from(JSON.stringify(doc))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromCode = await ET.readTransferCode(evt1);
  assert.ok(fromCode.ticks.c1[k]); assert.strictEqual(fromCode.modules, undefined);
  await assert.rejects(ET.readTransferCode('EVT9-abc'), /newer version/);
  // a device not yet updated writes a v1 plain copy (no sections): this device keeps its sections and takes the tick
  const d = fakeGraph();
  const pc = ET.newState(['A']); pc.modules = JSON.parse(JSON.stringify(MODS)); ET.validateState(pc);
  await ET.cloudSync(pc, 'tok', d.f);
  const v1 = Object.assign({ app: 'eveniunt-completionist-tracker', v: 1 }, JSON.parse(JSON.stringify(ET.portable(pc))));
  delete v1.modules; v1.ticks.c1[k] = 1;
  d.touch('f1', v1);
  const r = await ET.cloudSync(pc, 'tok', d.f);
  assert.strictEqual(r.done, true);
  assert.ok(pc.ticks.c1[k], 'the tick from the old device arrives');
  assert.deepStrictEqual(pc.modules, CC.checkModules(MODS), 'and no section is lost');
  assert.strictEqual(d.files.f1.v, 2, 'the cloud copy is written back in the new format');
});

test('the cloud copy is compressed and marked version 2: a tracker from before gate 1C refuses it; the size is checked in bytes', async () => {
  const d = fakeGraph();
  const st = fullState(); st.modules = JSON.parse(JSON.stringify(MODS)); ET.validateState(st);
  await ET.cloudSync(st, 'tok', d.f);
  const f1 = d.files.f1, plainSize = JSON.stringify(Object.assign({ app: 'x', v: 1 }, ET.portable(st))).length;
  const sent = CC.byteLength(JSON.stringify(f1));
  assert.ok(sent < plainSize / 3, 'compressed: ' + sent + ' bytes against ' + plainSize + ' as plain text');
  // the old version's check, unchanged: "if (remote.v > STATE_VERSION) throw 'saved by a newer version'"
  assert.ok(typeof f1.v === 'number' && f1.v > 1);
  assert.strictEqual(CC.byteLength('é'), 2);
  const keep = ET.CLOUD_MAX_BYTES;
  ET.CLOUD_MAX_BYTES = sent - 1;
  try { await assert.rejects(ET.cloudOverwrite(st, 'tok', d.f), (e) => e.code === 'too-large'); } finally { ET.CLOUD_MAX_BYTES = keep; }
});

// The owner's report (2026-11-10): after a phone that still had "Character 1–8" synced with the computer, the typed
// names were gone while Lodestone numbers, Grand Companies and starting jobs stayed.
test('merge: a placeholder name never replaces a typed one, in either direction, and is never a clash', () => {
  const real = ET.newState(['Alba Eveniunt', 'Brio Eveniunt']); real.chars[0].lodestone = '123'; real.chars[0].gc = 2;
  const fresh = ET.newState(['Character 1', 'Character 2']);
  for (const [l, r] of [[real, fresh], [fresh, real]]) {
    const res = ET.threeWay(null, ET.portable(l), ET.portable(r));
    assert.deepStrictEqual(res.conflicts.filter((c) => c.id.startsWith('n|')), [], 'no name clash');
    const out = ET.applyMerge(JSON.parse(JSON.stringify(l)), res, {});
    assert.deepStrictEqual(out.chars.map((c) => c.name), ['Alba Eveniunt', 'Brio Eveniunt']);
    assert.strictEqual(out.chars[0].lodestone, '123');
  }
  // after an earlier sync agreed on the real name, a device that comes back with a placeholder does not win either
  const res = ET.threeWay(ET.portable(real), ET.portable(real), ET.portable(fresh));
  assert.deepStrictEqual(ET.applyMerge(JSON.parse(JSON.stringify(real)), res, {}).chars.map((c) => c.name), ['Alba Eveniunt', 'Brio Eveniunt']);
  // two different typed names are still the owner's call
  const other = ET.newState(['Alba Two', 'Brio Eveniunt']);
  assert.ok(ET.threeWay(null, ET.portable(real), ET.portable(other)).conflicts.some((c) => c.id === 'n|c1'));
});

require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'fleet.js'));

async function staleFreeCompanyFold(entryPoint) {
  CC.resetMemory();
  if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); }
  const bare = (name, order) => ({ name, charId: 'c1', order, unlockedSlots: 1, discovered: [1, 2] });
  const initial = { fcs: { fa: bare('Alpha Company', 0), fz: bare('Zulu Company', 1) }, subs: {}, trips: {}, settings: {} };
  const first = await CC.writeSection('submersibles', initial, null);
  const staleDecision = globalThis.FLEET.foldFcs(first.section);
  assert.deepStrictEqual(staleDecision.removed, ['fz']);

  // Another page configures the target and links a submarine after the fold was computed.
  const concurrent = JSON.parse(JSON.stringify(first.section));
  concurrent.fcs.fz.world = 'Ravana';
  concurrent.fcs.fz.unlockedSlots = 2;
  concurrent.subs.s1 = { fcId: 'fz', slot: 1, name: 'Sub One', rank: 10, voyage: null };
  await CC.writeSection('submersibles', concurrent, { rev: first.rev, base: first.section });

  // Both Settings and Submersibles now ask the store to fold its current section inside its write transaction.
  assert.deepStrictEqual(staleDecision.removed, ['fz'], 'the old snapshot would have deleted the concurrent record');
  const folded = await CC.foldSection('submersibles', globalThis.FLEET.foldFcs);
  const secondPass = await CC.foldSection('submersibles', globalThis.FLEET.foldFcs);
  assert.strictEqual(secondPass.wrote, false, 'a completed fold is idempotent and does not retry a write');
  const saved = folded.doc ? folded.doc.modules.submersibles : CC.checkDoc((await CC.read()).raw).modules.submersibles;
  return { entryPoint, saved, fleet: globalThis.FLEET.fleet(saved, Date.now()) };
}

test('SET-07 regression: Settings fold cannot delete a concurrently configured free company or orphan its submarine', async () => {
  const { saved, fleet } = await staleFreeCompanyFold('Settings');
  assert.ok(saved.fcs.fz, 'configured free company must survive');
  assert.strictEqual(saved.fcs.fz.world, 'Ravana');
  assert.ok(saved.subs.s1, 'submarine record must survive');
  assert.strictEqual(saved.subs.s1.fcId, 'fz');
  assert.deepStrictEqual(fleet.map((x) => x.id), ['s1']);
});

test('SET-07 regression: Submersibles fold cannot delete a concurrently configured free company or orphan its submarine', async () => {
  const { saved, fleet } = await staleFreeCompanyFold('Submersibles');
  assert.ok(saved.fcs.fz, 'configured free company must survive');
  assert.strictEqual(saved.fcs.fz.world, 'Ravana');
  assert.ok(saved.subs.s1, 'submarine record must survive');
  assert.strictEqual(saved.subs.s1.fcId, 'fz');
  assert.deepStrictEqual(fleet.map((x) => x.id), ['s1']);
});

test('AUD-01 regression: delayed submarine save follows the surviving duplicate without an orphan', async () => {
  CC.resetMemory();
  if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); }
  const bare = (name, order) => ({ name, charId: 'c1', order, unlockedSlots: 1, discovered: [1, 2] });
  const initial = { fcs: { fa: bare('Alpha Company', 0), fz: bare('Zulu Company', 1) }, subs: {}, trips: {}, settings: {} };
  const first = await CC.writeSection('submersibles', initial, null);
  await CC.foldSection('submersibles', globalThis.FLEET.foldFcs);
  const local = JSON.parse(JSON.stringify(first.section));
  local.subs.s1 = { fcId: 'fz', slot: 1, name: 'Sub One', rank: 10, voyage: { sentAt: 1, route: [1], returnAt: 2 } };
  const saved = await CC.writeSection('submersibles', local, { rev: first.rev, base: first.section });
  assert.deepStrictEqual(Object.keys(saved.section.fcs), ['fa']);
  assert.strictEqual(saved.section.subs.s1.fcId, 'fa');
  assert.strictEqual(saved.section.subs.s1.voyage.returnAt, 2, 'the voyage is kept');
  assert.ok(saved.section.fcs[saved.section.subs.s1.fcId], 'every submarine has a surviving owner');
});

test('AUD-01 regression: delayed submarine save follows either deterministic bare-duplicate tie winner', async () => {
  const bare = (name, order) => ({ name, charId: 'c1', order, unlockedSlots: 1, discovered: [1, 2] });
  for (const [faOrder, fzOrder, winner, loser] of [[0, 1, 'fa', 'fz'], [1, 0, 'fz', 'fa']]) {
    CC.resetMemory();
    if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); }
    const initial = { fcs: { fa: bare('Alpha Company', faOrder), fz: bare('Zulu Company', fzOrder) }, subs: {}, trips: {}, settings: {} };
    const first = await CC.writeSection('submersibles', initial, null);
    const folded = await CC.foldSection('submersibles', globalThis.FLEET.foldFcs);
    assert.deepStrictEqual(folded.removed, [loser]);
    const local = JSON.parse(JSON.stringify(first.section));
    local.subs.s1 = { fcId: loser, slot: 1, name: 'Sub One', rank: 10, voyage: { sentAt: 1, route: [1], returnAt: 2 } };
    const saved = await CC.writeSection('submersibles', local, { rev: first.rev, base: first.section });
    assert.deepStrictEqual(Object.keys(saved.section.fcs), [winner]);
    assert.strictEqual(saved.section.subs.s1.fcId, winner);
    assert.strictEqual(saved.section.subs.s1.voyage.returnAt, 2, 'the voyage is kept');
    assert.ok(saved.section.fcs[saved.section.subs.s1.fcId], 'every submarine has a surviving owner');
  }
});

test('R2 cloud integrity: a removed duplicate FC with a newer submarine becomes an explicit, data-preserving conflict in both tie orders', () => {
  const bare = (name, order) => ({ name, charId: 'c1', order, unlockedSlots: 1, discovered: [1, 2] });
  const cases = [
    { id: 'fz', base: { fz: bare('A Company', 0) }, local: { fz: bare('A Company', 0) }, remote: { fa: bare('B Company', 0) } },
    { id: 'fa', base: { fa: bare('A Company', 0) }, local: { fa: bare('A Company', 0) }, remote: { fz: bare('B Company', 0) } },
  ];
  for (const item of cases) {
    const make = (fcs, withSub) => ({
      app: 'eveniunt-command-center', v: 1, updated: 1,
      chars: [{ id: 'c1', name: 'Alba' }], ticks: { c1: {} }, excl: { c1: {} }, vals: { c1: {} }, avail: {}, settings: {},
      modules: { submersibles: { fcs, subs: withSub ? { s1: { fcId: item.id, slot: 1, name: 'Sub One', rank: 10, voyage: { sentAt: 1, route: [1, 2], returnAt: 20 } } } : {},
        trips: withSub ? { t1: { s: 's1', t: 2, r: [1, 2], back: 20, items: [], newSectors: [] } } : {}, settings: {} } },
      sync: { drive: null },
    });
    const base = make(item.base, false), local = make(item.local, true), remote = make(item.remote, false);
    const res = ET.threeWay(ET.portable(base), ET.portable(local), ET.portable(remote));
    const conflict = res.conflicts.find((c) => c.id === 'm|' + JSON.stringify(['submersibles', 'fcs', item.id]));
    assert.ok(conflict && conflict.integrity && conflict.integrity.linked.includes('s1'), 'the deleted company is surfaced as a conflict linked to its submarine');
    const safe = ET.applyMerge(JSON.parse(JSON.stringify(local)), res, {});
    assert.strictEqual(safe.modules.submersibles.subs.s1.fcId, item.id);
    assert.ok(safe.modules.submersibles.fcs[item.id]);
    assert.strictEqual(safe.modules.submersibles.subs.s1.voyage.returnAt, 20);
    assert.ok(globalThis.FLEET.fleet(safe.modules.submersibles, 0).some((x) => x.id === 's1'));
    const desc = ET.describeConflict(conflict, null, safe);
    assert.match(desc.what, /its submarine “Sub One” and its logged voyages/, 'the prompt names the submarine, not its internal id');
    const chosenDelete = ET.applyMerge(JSON.parse(JSON.stringify(local)), res, { [conflict.id]: 'remote' });
    assert.ok(!chosenDelete.modules.submersibles.fcs[item.id]);
    assert.ok(!chosenDelete.modules.submersibles.subs.s1 && !chosenDelete.modules.submersibles.trips.t1, 'a deliberate removal clears dependent records only after explicit choice');
  }
});

test('R2 pending async cleanup: keeping the old stamp and base merges the edit with intervening page data', async () => {
  CC.resetMemory();
  if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); }
  const bare = (name, order, charId) => ({ name, charId: charId || 'c1', order, unlockedSlots: 1, discovered: [1, 2] });
  const first = await CC.writeSection('submersibles', { fcs: { fa: bare('Alpha', 0), fz: bare('Zulu', 1) }, subs: {}, trips: {}, settings: {} }, null);
  const local = JSON.parse(JSON.stringify(first.section));
  const other = JSON.parse(JSON.stringify(first.section)); other.fcs.fx = bare('Xray', 2, 'c2');
  await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  await CC.foldSection('submersibles', globalThis.FLEET.foldFcs);
  local.settings.prefs = { sort: 'time' };
  const result = await CC.writeSection('submersibles', local, { rev: first.rev, base: first.section });
  const stored = CC.checkDoc((await CC.read()).raw).modules.submersibles;
  assert.ok(stored.fcs.fx, 'the other page company is retained');
  assert.strictEqual(stored.settings.prefs.sort, 'time');
  assert.ok(result.merged, 'the stale page base forced a three-way merge');
});

test('R2 two-device cloud path: duplicate tie orders, stale upload retry, retained voyage and repeated syncs stay referentially valid', async () => {
  const bare = (name, order) => ({ name, charId: 'c1', order, unlockedSlots: 1, discovered: [1, 2] });
  for (const [duplicateId, duplicateOrder, expectedRemoval] of [['fa', 0, 'fz'], ['fzz', 2, 'fzz']]) {
    const d = fakeGraph();
    const a = ET.newState(['Alba']);
    a.modules = { submersibles: { fcs: { fz: bare('A Company', 1) }, subs: {}, trips: {}, settings: {} }, lists: { rows: { q1: { name: 'Keep other module' } } } };
    await ET.cloudSync(a, 'tok', d.f);
    const b = ET.newState(['Alba']);
    await ET.cloudSync(b, 'tok', d.f);
    b.modules.submersibles.fcs[duplicateId] = bare('B Company', duplicateOrder);
    await ET.cloudSync(b, 'tok', d.f); // competing duplicate is uploaded
    const folded = globalThis.FLEET.foldFcs(b.modules.submersibles);
    assert.deepStrictEqual(folded.removed, [expectedRemoval]);
    b.modules.submersibles = folded.section;
    await ET.cloudSync(b, 'tok', d.f); // second-stage sync publishes the automatic cleanup
    a.modules.submersibles.subs.s1 = { fcId: 'fz', slot: 1, name: 'Sub One', rank: 10, voyage: { sentAt: 1, route: [1, 2], returnAt: 20 } };
    a.modules.submersibles.trips.t1 = { s: 's1', t: 2, r: [1, 2], back: 20, items: [], newSectors: [] };
    const pending = await ET.cloudSync(a, 'tok', d.f);
    if (expectedRemoval === 'fz') {
      assert.strictEqual(pending.done, false, 'ambiguous cleanup versus deliberate deletion is surfaced');
      const conflict = pending.conflicts.find((c) => c.integrity);
      assert.ok(conflict, 'the owner must resolve the FC/submarine relationship');
      const before = JSON.parse(JSON.stringify(d.files.f1));
      d.touch('f1', before); // another writer changed the eTag after the conflict was read
      await assert.rejects(ET.cloudFinish(a, 'tok', pending, { [conflict.id]: 'local' }, d.f), (e) => e.code === 'changed');
      assert.deepStrictEqual(d.files.f1, before, 'a stale upload changes no remote data');
      const retry = await ET.cloudSync(a, 'tok', d.f);
      assert.strictEqual(retry.done, false, 'retry reads the changed eTag and presents the still-live conflict');
      const retryConflict = retry.conflicts.find((c) => c.integrity);
      await ET.cloudFinish(a, 'tok', retry, { [retryConflict.id]: 'local' }, d.f);
    } else {
      assert.strictEqual(pending.done, true, 'when the original FC wins the tie there is no reassociation to make');
    }
    await ET.cloudSync(b, 'tok', d.f);
    await ET.cloudSync(a, 'tok', d.f);
    await ET.cloudSync(b, 'tok', d.f);
    const cloud = await ET.readCloud(d.files.f1);
    for (const state of [a, b, { modules: cloud.modules }]) {
      const sec = state.modules.submersibles;
      for (const [id, sub] of Object.entries(sec.subs)) assert.ok(sec.fcs[sub.fcId], id + ' has an existing FC');
      assert.strictEqual(sec.subs.s1.voyage.returnAt, 20);
      assert.ok(sec.trips.t1, 'the saved voyage log survives');
      assert.ok(globalThis.FLEET.fleet(sec, 0).some((x) => x.id === 's1'), 'the submarine remains visible');
    }
    assert.deepStrictEqual(a.modules, b.modules, 'both devices converge after the explicit choice and repeated syncs');
    assert.deepStrictEqual(a.modules.lists, { rows: { q1: { name: 'Keep other module' } } }, 'the unrelated module stays intact');
  }
});

test('R2 cloud slot conflict: two devices cannot merge distinct submarines into one occupied slot', () => {
  const base = ET.newState(['Alba']);
  base.modules = { submersibles: { fcs: { f1: { name: 'Alpha', charId: 'c1', order: 0, unlockedSlots: 1, discovered: [1, 2] } }, subs: {}, trips: {}, settings: {} } };
  const local = JSON.parse(JSON.stringify(base)), remote = JSON.parse(JSON.stringify(base));
  local.modules.submersibles.subs.sa = { fcId: 'f1', slot: 1, name: 'Local Sub', rank: 5, voyage: { sentAt: 1, route: [1], returnAt: 10 } };
  local.modules.submersibles.trips.ta = { s: 'sa', t: 2, r: [1], back: 10, items: [], newSectors: [] };
  remote.modules.submersibles.subs.sb = { fcId: 'f1', slot: 1, name: 'Remote Sub', rank: 5, voyage: { sentAt: 3, route: [2], returnAt: 20 } };
  remote.modules.submersibles.trips.tb = { s: 'sb', t: 4, r: [2], back: 20, items: [], newSectors: [] };
  const res = ET.threeWay(ET.portable(base), ET.portable(local), ET.portable(remote));
  const conflict = res.conflicts.find((c) => c.integrity && c.integrity.kind === 'slot');
  assert.ok(conflict, 'the incompatible shared slot is a conflict, not two saved records');
  const description = ET.describeConflict(conflict, null, local);
  assert.match(description.what, /slot 1 of “Alpha”.*other and its logged voyages are removed/, 'the prompt names the free company and says what is removed');
  assert.match(description.local, /this device’s “Local Sub”, rank 5/);
  const noChoice = ET.applyMerge(JSON.parse(JSON.stringify(local)), res, {});
  assert.deepStrictEqual(Object.keys(noChoice.modules.submersibles.subs).sort(), ['sa', 'sb'], 'without an explicit choice nothing is deleted');
  const keepLocal = ET.applyMerge(JSON.parse(JSON.stringify(local)), res, { [conflict.id]: 'local' });
  assert.deepStrictEqual(Object.keys(keepLocal.modules.submersibles.subs), ['sa']);
  assert.deepStrictEqual(Object.keys(keepLocal.modules.submersibles.trips), ['ta']);
  const keepRemote = ET.applyMerge(JSON.parse(JSON.stringify(local)), res, { [conflict.id]: 'remote' });
  assert.deepStrictEqual(Object.keys(keepRemote.modules.submersibles.subs), ['sb']);
  assert.deepStrictEqual(Object.keys(keepRemote.modules.submersibles.trips), ['tb']);
  assert.strictEqual(globalThis.FLEET.fleet(keepLocal.modules.submersibles, 0).length, 1);
  assert.strictEqual(globalThis.FLEET.fleet(keepRemote.modules.submersibles, 0).length, 1);
});

// R3 regressions (AUD-20261114-SETTINGS-CLOUD-INTEGRITY-R3-001): integrity choices are never applied without the owner,
// a free company and its submarines are one choice, and a slot clash is found by id.
const r3 = (() => {
  const st0 = ET.newState(['Alba']);
  const solid = (name) => ({ name, charId: 'c1', order: 0, unlockedSlots: 2, discovered: [1, 2], world: 'Ravana' });
  const sec = (o) => Object.assign({ fcs: {}, subs: {}, trips: {}, settings: {} }, JSON.parse(JSON.stringify(o)));
  const port = (x) => ET.portable(Object.assign(JSON.parse(JSON.stringify(st0)), { modules: { submersibles: sec(x) } }));
  const apply = (onto, res, choices) => ET.applyMerge(Object.assign(JSON.parse(JSON.stringify(st0)), { modules: { submersibles: sec(onto) } }), res, choices).modules.submersibles;
  const orphans = (x) => Object.entries(x.subs || {}).filter(([, v]) => !(x.fcs || {})[v.fcId]).map(([k]) => k);
  return { solid, sec, port, apply, orphans };
})();

test('R3-01 regression: a slot clash met in a merge applied without asking deletes nothing, and the next sync asks', () => {
  const { solid, port, apply } = r3;
  const from = { fcs: { fz: solid('Xray') } };
  const mine = { fcs: { fz: solid('Xray') }, subs: { sB: { fcId: 'fz', slot: 1, name: 'B Device Sub', rank: 7, voyage: null } }, trips: { tB: { s: 'sB', t: 1, r: [1], back: 2, items: [], newSectors: [] } } };
  const now = { fcs: { fz: solid('Xray') }, subs: { sA: { fcId: 'fz', slot: 1, name: 'A Device Sub', rank: 3, voyage: null } } };
  // Settings' end-of-sync merge (and the Tracker's after-upload merge) pass no choices
  const res = ET.threeWay(port(from), port(now), port(mine));
  assert.ok(res.conflicts.some((c) => c.integrity && c.integrity.kind === 'slot'), 'the clash is still reported');
  const after = apply(now, res, {});
  assert.deepStrictEqual(Object.keys(after.subs).sort(), ['sA', 'sB'], 'neither submarine is deleted without a choice');
  assert.ok(after.trips.tB, 'the other device\'s logged voyage is kept');
  // the next sync (base = the uploaded copy, remote = the cloud copy) raises the choice in the Tracker
  const res2 = ET.threeWay(port(mine), port(after), port(mine));
  const slot = res2.conflicts.find((c) => c.integrity && c.integrity.kind === 'slot');
  assert.ok(slot, 'the next sync asks');
  assert.strictEqual(slot.local, 'A Device Sub'); assert.strictEqual(slot.remote, 'B Device Sub');
  const keepOther = apply(after, res2, { [slot.id]: 'remote' });
  assert.deepStrictEqual(Object.keys(keepOther.subs), ['sB']); assert.ok(keepOther.trips.tB);
  const keepHere = apply(after, res2, { [slot.id]: 'local' });
  assert.deepStrictEqual(Object.keys(keepHere.subs), ['sA']); assert.ok(!keepHere.trips.tB, 'the dropped submarine\'s logged voyages go with it, as the prompt says');
});

test('R3-02 regression: a free company and its submarines are one choice; mixed answers never orphan a submarine', () => {
  const { solid, port, apply, orphans } = r3;
  const fcId = 'fz', fcKey = 'm|' + JSON.stringify(['submersibles', 'fcs', fcId]), s1Key = 'm|' + JSON.stringify(['submersibles', 'subs', 's1']);
  const base = { fcs: { fz: solid('Zulu') }, subs: { s1: { fcId, slot: 1, name: 'Zulu One', rank: 10, voyage: null } } };
  const changed = { fcs: { fz: solid('Zulu Renamed') }, subs: { s1: { fcId, slot: 1, name: 'Zulu One', rank: 10, voyage: { sentAt: 5, route: [1], returnAt: 9 } }, s2: { fcId, slot: 2, name: 'Zulu Two', rank: 4, voyage: null } } };
  // (a) changed here, removed there; (b) removed here, changed (and a submarine added) there
  for (const [label, local, remote, removalSide] of [['changed here, removed there', changed, {}, 'remote'], ['removed here, changed there', {}, changed, 'local']]) {
    const res = ET.threeWay(port(base), port(local), port(remote));
    const owner = res.conflicts.find((c) => c.id === fcKey);
    assert.ok(owner && owner.integrity && owner.integrity.kind === 'owner', label + ': the free-company row carries its submarines');
    assert.deepStrictEqual(owner.integrity.linked.sort(), ['s1', 's2'].filter((id) => local.subs && local.subs[id] || remote.subs && remote.subs[id]).sort());
    assert.match(ET.describeConflict(owner, null, ET.newState(['Alba'])).what, /its submarines “Zulu One”, “Zulu Two” and their logged voyages/);
    const keepSide = removalSide === 'remote' ? 'local' : 'remote';
    for (const choices of [{ [fcKey]: removalSide, [s1Key]: keepSide }, { [fcKey]: removalSide, [s1Key]: removalSide }, { [fcKey]: keepSide, [s1Key]: removalSide }, {}]) {
      const out = apply(local, res, choices);
      assert.deepStrictEqual(orphans(out), [], label + ' ' + JSON.stringify(choices) + ': no submarine without its free company');
      if (choices[fcKey] === removalSide) assert.ok(!out.fcs[fcId] && !out.subs.s1 && !out.subs.s2, label + ': the chosen removal is honoured with its submarines');
    }
    // after an explicit removal the device's own after-upload merge does not bring the free company back
    const doc = ET.portable(Object.assign(ET.newState(['Alba']), { modules: { submersibles: apply(local, res, { [fcKey]: removalSide, [s1Key]: keepSide }) } }));
    const before = port(local);
    const post = ET.threeWay(before, before, doc);
    assert.strictEqual(post.conflicts.length, 0, label + ': nothing re-protects the removed free company');
  }
});

test('R3-03 regression: two devices filling one slot with identical-looking records get a slot choice', () => {
  const { solid, port, apply } = r3;
  const b = { fcs: { fy: solid('Yankee') } };
  const rec = { fcId: 'fy', slot: 1, name: 'Sub 1', rank: 1, voyage: null };
  const l = { fcs: { fy: solid('Yankee') }, subs: { sA: rec } }, r = { fcs: { fy: solid('Yankee') }, subs: { sB: rec } };
  const res = ET.threeWay(port(b), port(l), port(r));
  const slot = res.conflicts.find((c) => c.integrity && c.integrity.kind === 'slot');
  assert.ok(slot, 'identical contents with different ids are still two submarines in one slot');
  const d = ET.describeConflict(slot, null, ET.newState(['Alba']));
  assert.match(d.local, /this device’s “Sub 1”/); assert.match(d.remote, /the other device’s “Sub 1”/);
  assert.deepStrictEqual(Object.keys(apply(l, res, { [slot.id]: 'remote' }).subs), ['sB']);
  // records already on both devices are left alone (nothing new to decide)
  const both = { fcs: { fy: solid('Yankee') }, subs: { sA: rec, sB: rec } };
  assert.ok(!ET.threeWay(port(both), port(both), port(both)).conflicts.length);
});

test('R3 review regressions: removed here while only a submarine changed there; a slot answer decides a restored submarine; a moved submarine survives a removal', () => {
  const { solid, port, apply, orphans } = r3;
  const fcKey = (id) => 'm|' + JSON.stringify(['submersibles', 'fcs', id]), subKey = (id) => 'm|' + JSON.stringify(['submersibles', 'subs', id]);
  const S = (fcId, slot, name, rank) => ({ fcId, slot, name, rank, voyage: null });
  // (1) this device removed F and S; the other device only edited S (F unchanged there)
  {
    const b = { fcs: { F: solid('F') }, subs: { S: S('F', 1, 'S', 1) } }, l = {}, r = { fcs: { F: solid('F') }, subs: { S: S('F', 1, 'S', 9) } };
    const res = ET.threeWay(port(b), port(l), port(r));
    assert.ok(res.conflicts.some((c) => c.id === fcKey('F') && c.integrity && c.integrity.kind === 'owner'), 'the free company is asked about together with S');
    for (const choices of [{ [subKey('S')]: 'remote', [fcKey('F')]: 'local' }, { [subKey('S')]: 'remote', [fcKey('F')]: 'remote' }, { [subKey('S')]: 'remote' }, { [subKey('S')]: 'local', [fcKey('F')]: 'local' }, {}]) {
      const out = apply(l, res, choices);
      assert.deepStrictEqual(orphans(out), [], JSON.stringify(choices));
    }
    const keepBoth = apply(l, res, { [subKey('S')]: 'remote', [fcKey('F')]: 'remote' });
    assert.ok(keepBoth.fcs.F && keepBoth.subs.S && keepBoth.subs.S.rank === 9);
    const removeBoth = apply(l, res, { [subKey('S')]: 'remote', [fcKey('F')]: 'local' });
    assert.ok(!removeBoth.fcs.F && !removeBoth.subs.S, 'the free-company answer decides its submarine');
  }
  // (2) base S1 in slot 1; this device removed S1 and set up S3 there; the other device edited S1
  {
    const b = { fcs: { F: solid('F') }, subs: { S1: S('F', 1, 'S1', 1) } }, l = { fcs: { F: solid('F') }, subs: { S3: S('F', 1, 'S3', 1) } }, r = { fcs: { F: solid('F') }, subs: { S1: S('F', 1, 'S1', 5) } };
    const res = ET.threeWay(port(b), port(l), port(r));
    const slot = res.conflicts.find((c) => c.integrity && c.integrity.kind === 'slot');
    assert.ok(slot, 'a submarine that an answer could bring back still counts for its slot');
    for (const s1 of ['local', 'remote']) for (const v of ['local', 'remote']) {
      const out = apply(l, res, { [subKey('S1')]: s1, [slot.id]: v });
      assert.deepStrictEqual(Object.keys(out.subs), [v === 'local' ? 'S3' : 'S1'], 'one submarine in the slot; the slot answer decides (' + s1 + '/' + v + ')');
    }
  }
  // (3) the other device moved S from F1 to F2 and removed F1; this device renamed F1; the owner picks the removal
  {
    const b = { fcs: { F1: solid('A'), F2: solid('B') }, subs: { S: S('F1', 1, 'S', 1) } }, l = { fcs: { F1: solid('A2'), F2: solid('B') }, subs: { S: S('F1', 1, 'S', 1) } }, r = { fcs: { F2: solid('B') }, subs: { S: S('F2', 1, 'S', 1) } };
    const res = ET.threeWay(port(b), port(l), port(r));
    const out = apply(l, res, { [fcKey('F1')]: 'remote' });
    assert.ok(!out.fcs.F1 && out.subs.S && out.subs.S.fcId === 'F2', 'a submarine that now belongs to another free company stays');
  }
});

test('F-01 regression (ChatGPT review): keeping a free company renamed on one device and removed on the other keeps its unchanged submarine and voyages', () => {
  const { solid, port, apply, orphans } = r3;
  const K = 'm|' + JSON.stringify(['submersibles', 'fcs', 'f1']);
  const base = { fcs: { f1: solid('Company') }, subs: { s1: { fcId: 'f1', slot: 1, name: 'Vanguard', rank: 5, voyage: null } }, trips: { t1: { s: 's1', t: 1, r: [1], back: 2, items: [], newSectors: [] } } };
  const renamed = { fcs: { f1: solid('Renamed company') }, subs: base.subs, trips: base.trips };
  const removed = { fcs: {}, subs: {} }; // Setup's Remove deletes the free company and its submarines
  for (const [label, l, r, keep, remove] of [['renamed here, removed there', renamed, removed, 'local', 'remote'], ['removed here, renamed there', removed, renamed, 'remote', 'local']]) {
    const res = ET.threeWay(port(base), port(l), port(r));
    const owner = res.conflicts.find((c) => c.id === K);
    assert.ok(owner && owner.integrity && owner.integrity.kind === 'owner', label + ': one free-company question');
    assert.match(ET.describeConflict(owner, null, ET.newState(['Alba'])).what, /its submarine “Vanguard” and its logged voyages; keeping the free company keeps it too/);
    const kept = apply(l, res, { [K]: keep });
    assert.ok(kept.fcs.f1 && kept.fcs.f1.name === 'Renamed company', label + ': the kept free company');
    assert.ok(kept.subs.s1 && kept.subs.s1.fcId === 'f1' && kept.trips.t1, label + ': keeps its submarine and logged voyage');
    assert.deepStrictEqual(orphans(kept), []);
    const gone = apply(l, res, { [K]: remove });
    assert.ok(!gone.fcs.f1 && !gone.subs.s1, label + ': the chosen removal removes both');
    // the next sync from the kept result raises nothing and keeps everything
    const next = ET.threeWay(port(kept), port(kept), port(kept));
    assert.strictEqual(next.conflicts.length, 0);
  }
  // without an answer: this device's side, as for any row (renamed here: kept with its submarine; removed here: removed)
  assert.ok(apply(renamed, ET.threeWay(port(base), port(renamed), port(removed)), {}).subs.s1);
  assert.ok(!apply(removed, ET.threeWay(port(base), port(removed), port(renamed)), {}).fcs.f1);
  // reviewer case D: removed here (with s1 and t1) while the other device added s3 to it; a merge with no answer keeps the
  // free company for s3 but brings back nothing this device removed
  {
    const removedAll = { fcs: {}, subs: {}, trips: {} };
    const added = { fcs: base.fcs, subs: Object.assign({}, base.subs, { s3: { fcId: 'f1', slot: 2, name: 'Newcomer', rank: 1, voyage: null } }), trips: base.trips };
    const out = apply(removedAll, ET.threeWay(port(base), port(removedAll), port(added)), {});
    assert.ok(out.fcs.f1 && out.subs.s3, 'kept for the other device\'s new submarine');
    assert.ok(!out.subs.s1 && !out.trips.t1, 'this device\'s removals are not undone without an answer');
    assert.deepStrictEqual(orphans(out), []);
  }
  // reviewer case A: renamed here (and s1 renamed here); removed there with s1 and t1; the owner keeps the free company but
  // answers the submarine's own row with the removal: no logged voyage comes back without its submarine
  {
    const both = { fcs: { f1: solid('Renamed company') }, subs: { s1: { fcId: 'f1', slot: 1, name: 'Vanguard II', rank: 5, voyage: null } }, trips: base.trips };
    const gone = { fcs: {}, subs: {}, trips: {} };
    const res = ET.threeWay(port(base), port(both), port(gone));
    const out = apply(both, res, { [K]: 'local', ['m|' + JSON.stringify(['submersibles', 'subs', 's1'])]: 'remote' });
    assert.ok(out.fcs.f1 && !out.subs.s1, 'the submarine row decides the submarine');
    assert.ok(!Object.values(out.trips || {}).some((t) => !out.subs[t.s]), 'no logged voyage without its submarine');
  }
});

test('SET-09 regression: a sync save whose liveness guard has expired writes nothing', async () => {
  CC.resetMemory();
  if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); }
  let live = true;
  const pending = ET.saveState(ET.newState(['Sync result']), true, { guard: () => live });
  live = false;
  assert.strictEqual(await pending, false);
  const stored = await CC.read();
  assert.strictEqual(stored.raw, null, 'cancelled sync result must not reach the save');
});

// ── a free company changed on both sides (docs/submersibles-merge-spec.md, owner decisions of 2026-11-19) ─────────────
const FCK = 'm|' + JSON.stringify(['submersibles', 'fcs', 'f1']);
const fcText = (o) => JSON.stringify(CC.checkSubmersibles({ fcs: { f1: Object.assign({ name: 'Alpha Company', world: 'Maduin', charId: 'c1', order: 0, unlockedSlots: 2, discovered: [1, 2, 3] }, o) } }).fcs.f1);
const fcOf = (t) => JSON.parse(t);

test('T1 CC.mergeUnit: only a free company present on both sides is merged; discoveries are combined, slots the higher, position the lower, a question only for name, world or character', () => {
  const b = fcText({ discovered: [1, 2] });
  assert.strictEqual(CC.mergeUnit('m|' + JSON.stringify(['submersibles', 'subs', 's1']), b, b, fcText({})), null, 'not a free company');
  assert.strictEqual(CC.mergeUnit('m|' + JSON.stringify(['atelier', 'prefs']), b, b, fcText({})), null);
  assert.strictEqual(CC.mergeUnit(FCK, b, undefined, fcText({})), null, 'a side missing');
  assert.strictEqual(CC.mergeUnit(FCK, b, fcText({}), undefined), null);
  assert.strictEqual(CC.mergeUnit(FCK, b, 'not json', fcText({})), null);
  const disc = (u) => fcOf(u.local).discovered;
  let u = CC.mergeUnit(FCK, fcText({ discovered: [1, 2] }), fcText({ discovered: [1, 2, 3] }), fcText({ discovered: [1, 2, 4] }));
  assert.deepStrictEqual(disc(u), [1, 2, 3, 4]); assert.deepStrictEqual(u.asks, []); assert.strictEqual(u.local, u.remote);
  u = CC.mergeUnit(FCK, fcText({ discovered: [1, 2, 3] }), fcText({ discovered: [1, 2] }), fcText({ discovered: [1, 2, 3, 4] }));
  assert.deepStrictEqual(disc(u), [1, 2, 3, 4], 'combine everything: an untick on one side removes nothing');
  assert.deepStrictEqual(disc(CC.mergeUnit(FCK, undefined, fcText({ discovered: [4, 1] }), fcText({ discovered: [2, 3] }))), [1, 2, 3, 4], 'no base: union, sorted');
  const noList = JSON.stringify({ name: 'Alpha Company' });
  assert.deepStrictEqual(disc(CC.mergeUnit(FCK, noList, fcText({ discovered: [1, 2, 3] }), fcText({ discovered: [1, 2, 4] }))), [1, 2, 3, 4], 'a base without the list: union');
  assert.strictEqual(fcOf(CC.mergeUnit(FCK, b, fcText({ unlockedSlots: 2, discovered: [1, 2, 3] }), fcText({ unlockedSlots: 3, discovered: [1, 2, 4] })).local).unlockedSlots, 3, 'slots: the higher');
  assert.strictEqual(fcOf(CC.mergeUnit(FCK, fcText({ order: 5, discovered: [1, 2] }), fcText({ order: 2, discovered: [1, 2, 3] }), fcText({ order: 3, discovered: [1, 2, 4] })).local).order, 2, 'position: the lower');
  u = CC.mergeUnit(FCK, fcText({ discovered: [1, 2] }), fcText({ name: 'Beta', discovered: [1, 2, 3] }), fcText({ world: 'Ravana', discovered: [1, 2, 4] }));
  assert.deepStrictEqual(u.asks, []); assert.strictEqual(fcOf(u.local).name, 'Beta'); assert.strictEqual(fcOf(u.local).world, 'Ravana');
  u = CC.mergeUnit(FCK, fcText({ discovered: [1, 2] }), fcText({ name: 'Beta', discovered: [1, 2, 3] }), fcText({ name: 'Gamma', discovered: [1, 2, 4] }));
  assert.deepStrictEqual(u.asks, ['name']); assert.strictEqual(fcOf(u.local).name, 'Beta'); assert.strictEqual(fcOf(u.remote).name, 'Gamma');
  assert.deepStrictEqual(disc(u), [1, 2, 3, 4]); assert.deepStrictEqual(fcOf(u.remote).discovered, [1, 2, 3, 4]);
  const l0 = JSON.stringify({ name: 'Alpha Company', discovered: [1, 2, 3] }), r0 = JSON.stringify({ name: 'Alpha Company', world: 'Maduin', discovered: [1, 2, 4] });
  u = CC.mergeUnit(FCK, undefined, l0, r0);
  assert.strictEqual(fcOf(u.local).world, 'Maduin', 'no base, a world on one side only: kept'); assert.deepStrictEqual(u.asks, []);
  // a side without a position takes the other's (not 0); both names blank leave the stored text as it is
  const noOrder = (o) => JSON.stringify(Object.assign({ name: 'Alpha Company', discovered: [1, 2] }, o));
  assert.strictEqual(fcOf(CC.mergeUnit(FCK, noOrder({ order: 0 }), noOrder({ discovered: [1, 2, 3] }), noOrder({ order: 4, discovered: [1, 2, 4] })).local).order, 4, 'no position on one side: the other side\'s');
  assert.strictEqual(fcOf(CC.mergeUnit(FCK, noOrder({ order: 0 }), noOrder({ order: 4, discovered: [1, 2, 4] }), noOrder({ discovered: [1, 2, 3] })).local).order, 4, '... either way round');
  assert.strictEqual(fcOf(CC.mergeUnit(FCK, noOrder({ order: 2 }), noOrder({ order: 0, discovered: [1, 2, 3] }), noOrder({ order: 3, discovered: [1, 2, 4] })).local).order, 0, 'a position of 0 is still a position: the lower');
  for (const blankName of [{ name: '' }, { name: undefined }]) {
    const lt = JSON.stringify(Object.assign({ order: 1, discovered: [1, 2, 3] }, blankName)), rt = JSON.stringify(Object.assign({ order: 1, discovered: [1, 2, 4] }, blankName));
    const m = CC.mergeUnit(FCK, JSON.stringify(Object.assign({ order: 1, discovered: [1, 2] }, blankName)), lt, rt);
    assert.strictEqual('name' in fcOf(m.local), 'name' in blankName && blankName.name !== undefined, 'blank names: the stored text keeps what both sides had');
    assert.deepStrictEqual(m.asks, []);
  }
  // the text is the checker's own, and the merge is symmetric and settled
  const L = fcText({ name: 'Beta', unlockedSlots: 3, discovered: [1, 2, 3] }), R = fcText({ name: 'Gamma', order: 4, discovered: [1, 2, 5] });
  u = CC.mergeUnit(FCK, b, L, R);
  assert.strictEqual(u.local, JSON.stringify(CC.checkSubmersibles({ fcs: { x: fcOf(u.local) } }).fcs.x));
  const v = CC.mergeUnit(FCK, b, R, L);
  assert.strictEqual(v.local, u.remote); assert.strictEqual(v.remote, u.local); assert.deepStrictEqual(v.asks, u.asks);
  const again = CC.mergeUnit(FCK, b, u.local, u.remote);
  assert.strictEqual(again.local, u.local); assert.strictEqual(again.remote, u.remote);
});

async function twoTabs() {
  useStorage();
  const first = await CC.writeSection('submersibles', MODS.submersibles, null);
  const base = JSON.parse(JSON.stringify(first.section));
  const a = JSON.parse(JSON.stringify(base)); a.fcs.f1.discovered = [1, 2, 3, 4];
  const b = JSON.parse(JSON.stringify(base)); b.fcs.f1.discovered = [1, 2, 3, 5]; b.fcs.f1.unlockedSlots = 3;
  await CC.writeSection('submersibles', a, { rev: first.rev, base });
  return CC.writeSection('submersibles', b, { rev: first.rev, base });
}

test('T2 two tabs: one adds a sector, the other adds a sector and a slot with a stale stamp; both sectors and the slot are stored', async () => {
  const w = await twoTabs();
  assert.strictEqual(w.merged, true);
  assert.deepStrictEqual(w.section.fcs.f1.discovered, [1, 2, 3, 4, 5]);
  assert.strictEqual(w.section.fcs.f1.unlockedSlots, 3);
  assert.deepStrictEqual(CC.checkDoc((await CC.read()).raw).modules.submersibles.fcs.f1.discovered, [1, 2, 3, 4, 5]);
});

test('T3 an old copy (no CC.mergeUnit): the same two tabs store this tab\'s whole record, as before', async () => {
  const real = CC.mergeUnit;
  CC.mergeUnit = () => null;
  try {
    const w = await twoTabs();
    assert.strictEqual(w.merged, true);
    assert.deepStrictEqual(w.section.fcs.f1.discovered, [1, 2, 3, 5]);
    assert.strictEqual(w.section.fcs.f1.unlockedSlots, 3);
  } finally { CC.mergeUnit = real; }
});

async function twoDevices(edit, oldFlags, order) {
  const d = fakeGraph();
  const pc = ET.newState(['A', 'B']); pc.modules = JSON.parse(JSON.stringify(MODS)); ET.validateState(pc);
  await ET.cloudSync(pc, 'tok', d.f);
  const phone = ET.newState(['A', 'B']); phone.modules = {};
  await ET.cloudSync(phone, 'tok', d.f);
  edit(pc.modules.submersibles.fcs.f1, phone.modules.submersibles.fcs.f1);
  const real = CC.mergeUnit;
  const sync = async (st, old) => { CC.mergeUnit = old ? () => null : real; try { return await ET.cloudSync(st, 'tok', d.f); } finally { CC.mergeUnit = real; } };
  const out = [];
  for (const who of order || ['phone', 'pc', 'phone']) out.push(await sync(who === 'pc' ? pc : phone, !!(oldFlags && oldFlags[who])));
  return { d, pc, phone, out };
}

test('T4 two devices each add one discovery: no question, both hold both, the saves are equal', async () => {
  const { pc, phone, out } = await twoDevices((p, h) => { p.discovered = [1, 2, 3, 4]; h.discovered = [1, 2, 3, 5]; });
  for (const r of out) assert.ok(r.done === true && !(r.conflicts || []).length, JSON.stringify(r.conflicts || []));
  for (const st of [pc, phone]) assert.deepStrictEqual(st.modules.submersibles.fcs.f1.discovered, [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(pc.modules, phone.modules);
});

test('T5 one device unticks sector 3, the other adds 4: no question, both end with [1, 2, 3, 4] (nothing is removed by a merge)', async () => {
  const { pc, phone, out } = await twoDevices((p, h) => { p.discovered = [1, 2]; h.discovered = [1, 2, 3, 4]; });
  for (const r of out) assert.ok(r.done === true && !(r.conflicts || []).length);
  for (const st of [pc, phone]) assert.deepStrictEqual(st.modules.submersibles.fcs.f1.discovered, [1, 2, 3, 4]);
});

test('T6 a name changed differently on both devices is the one question; both versions already carry the combined sectors; either answer keeps them', async () => {
  for (const choice of ['local', 'remote']) {
    const { d, pc, phone, out } = await twoDevices((p, h) => { p.name = 'Beta Company'; p.discovered = [1, 2, 3, 4]; h.name = 'Gamma Company'; h.discovered = [1, 2, 3, 5]; }, null, ['phone', 'pc']);
    const r = out[1];
    assert.strictEqual(r.done, false); assert.strictEqual(r.conflicts.length, 1);
    const c = r.conflicts[0];
    assert.strictEqual(c.id, FCK);
    assert.deepStrictEqual(fcOf(c.local).discovered, [1, 2, 3, 4, 5]); assert.deepStrictEqual(fcOf(c.remote).discovered, [1, 2, 3, 4, 5]);
    assert.deepStrictEqual(Object.keys(c).sort(), ['id', 'local', 'remote']);
    const desc = ET.describeConflict(c, idx, pc);
    assert.match(desc.what, /name differs/); assert.match(desc.what, /already combined/);
    assert.strictEqual(desc.local, 'name “Beta Company”'); assert.strictEqual(desc.remote, 'name “Gamma Company”'); // the dialog adds "This device:" / "Other device:"
    assert.match(desc.what, /^Submersibles: free company “Beta Company” \/ “Gamma Company”: the name differs/, 'both names in the heading');
    await ET.cloudFinish(pc, 'tok', r, { [c.id]: choice }, d.f);
    const want = choice === 'local' ? 'Beta Company' : 'Gamma Company';
    assert.strictEqual(pc.modules.submersibles.fcs.f1.name, want); assert.deepStrictEqual(pc.modules.submersibles.fcs.f1.discovered, [1, 2, 3, 4, 5]);
    for (const st of [phone, pc]) { const s = await ET.cloudSync(st, 'tok', d.f); assert.ok(s.done === true && !(s.conflicts || []).length, 'later syncs converge'); }
    assert.deepStrictEqual(pc.modules, phone.modules);
    assert.strictEqual(phone.modules.submersibles.fcs.f1.name, want);
  }
});

test('T7 old meets new: the new device merges and the old one takes it whole; the old device merging first gives the all-old result; only the six known fields are stored', async () => {
  const edit = (p, h) => { p.discovered = [1, 2, 3, 4]; h.discovered = [1, 2, 3, 5]; };
  const six = ['name', 'world', 'charId', 'order', 'unlockedSlots', 'discovered'];
  // new device merges first, the old phone takes the result whole
  const a = await twoDevices(edit, { phone: true }, ['phone', 'pc', 'phone']);
  for (const r of a.out) assert.ok(r.done === true && !(r.conflicts || []).length);
  assert.deepStrictEqual(a.phone.modules.submersibles.fcs.f1.discovered, [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(a.pc.modules, a.phone.modules);
  const cloud = await ET.readCloud(a.d.files.f1);
  assert.ok(Object.keys(cloud.modules.submersibles.fcs.f1).every((k) => six.includes(k)));
  // the old device merges first (the other uploaded first): the same as two old devices
  const mixed = await twoDevices(edit, { phone: true }, ['pc', 'phone']);
  const allOld = await twoDevices(edit, { phone: true, pc: true }, ['pc', 'phone']);
  const shape = (x) => JSON.stringify({ done: x.out[1].done, conflicts: (x.out[1].conflicts || []).map((c) => [c.id, c.local, c.remote]), phone: x.phone.modules.submersibles.fcs.f1 });
  assert.strictEqual(shape(mixed), shape(allOld));
  assert.strictEqual(mixed.out[1].done, false, 'an old device still asks the old question');
});

test('T8 end of a Settings sync: a discovery made during the sync and one from the cloud are both kept, no question', () => {
  const { solid, port, apply } = r3;
  const fc = (d) => Object.assign(solid('Xray'), { discovered: d });
  const from = { fcs: { fz: fc([1, 2]) } }, now = { fcs: { fz: fc([1, 2, 3]) } }, mine = { fcs: { fz: fc([1, 2, 4]) } };
  const res = ET.threeWay(port(from), port(now), port(mine));
  assert.strictEqual(res.conflicts.length, 0);
  assert.deepStrictEqual(apply(now, res, {}).fcs.fz.discovered, [1, 2, 3, 4]);
});

test('T9 a free company changed on one side and removed on the other still gives the owner question, with the untouched texts', () => {
  const { solid, port } = r3;
  const base = { fcs: { f1: solid('Company') }, subs: { s1: { fcId: 'f1', slot: 1, name: 'Vanguard', rank: 5, voyage: null } } };
  const changed = { fcs: { f1: Object.assign(solid('Company'), { discovered: [1, 2, 3] }) }, subs: base.subs };
  const res = ET.threeWay(port(base), port(changed), port({ fcs: {}, subs: {} }));
  const c = res.conflicts.find((x) => x.id === FCK);
  assert.ok(c && c.integrity && c.integrity.kind === 'owner');
  assert.deepStrictEqual(fcOf(c.local), changed.fcs.f1, 'the unit text is untouched'); assert.strictEqual(c.remote, null);
});

// R3.1 the question's wording: each side shows only what differs (the dialog adds "This device:" / "Other device:"); a name that differs names the company by both names
test('R3-1 describeUnit wording: name, world, character and two fields at once', () => {
  const nameOf = (id) => ({ c1: 'Alba', c2: 'Brin' })[id] || id, SAME = '; its discovered sectors are already combined and stay the same whichever you choose';
  const d = (l, r) => CC.describeUnit(FCK, fcText(l), fcText(r), nameOf);
  let x = d({ name: 'Beta' }, { name: 'Gamma' });
  assert.strictEqual(x.what, 'Submersibles: free company “Beta” / “Gamma”: the name differs between your devices' + SAME);
  assert.strictEqual(x.local, 'name “Beta”'); assert.strictEqual(x.remote, 'name “Gamma”');
  x = d({ world: 'Odin' }, { world: 'Ravana' });
  assert.strictEqual(x.what, 'Submersibles: free company “Alpha Company”: the world differs between your devices' + SAME);
  assert.strictEqual(x.local, 'world Odin'); assert.strictEqual(x.remote, 'world Ravana');
  x = d({ charId: 'c1' }, { charId: 'c2' });
  assert.strictEqual(x.what, 'Submersibles: free company “Alpha Company”: the character differs between your devices' + SAME);
  assert.strictEqual(x.local, 'character Alba'); assert.strictEqual(x.remote, 'character Brin');
  x = d({ name: 'Beta', world: 'Odin' }, { name: 'Gamma', world: 'Ravana' });
  assert.strictEqual(x.what, 'Submersibles: free company “Beta” / “Gamma”: the name and world differ between your devices' + SAME);
  assert.strictEqual(x.local, 'name “Beta”, world Odin'); assert.strictEqual(x.remote, 'name “Gamma”, world Ravana');
  x = d({ discovered: [1, 2, 3] }, { discovered: [1, 2, 4] });
  assert.ok(!/ \/ /.test(x.what) && !/^this device|^the other device/.test(x.local), 'no name difference: the heading has one name; no side prefix');
  assert.match(CC.describeUnit(FCK, fcText({ name: 'Beta' }), fcText({ name: '' }), nameOf).what, /free company “Beta”: the name differs/, 'one name blank: only the other is named');
});

// R3.2 a seeded randomized check of the merge: nothing of either side is lost, the sides can be swapped, a merged pair is settled
test('R3-2 CC.mergeUnit, 2,000 seeded random cases: no sector missing, swap gives the same texts, merging the output again changes nothing', () => {
  let seed = 20261119;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const some = () => { const n = Math.floor(rnd() * 6), out = []; for (let i = 0; i < n; i++) out.push(1 + Math.floor(rnd() * 12)); return out; };
  const fc = () => { const o = { discovered: some() }; if (rnd() < 0.8) o.name = pick(['Alpha', 'Beta', 'Gamma', '']); if (rnd() < 0.6) o.world = pick(['Odin', 'Ravana', '']); if (rnd() < 0.6) o.charId = pick(['c1', 'c2', null]); if (rnd() < 0.7) o.order = Math.floor(rnd() * 4); if (rnd() < 0.7) o.unlockedSlots = 1 + Math.floor(rnd() * 4); return JSON.stringify(CC.checkSubmersibles({ fcs: { x: o } }).fcs.x); };
  for (let i = 0; i < 2000; i++) {
    const b = rnd() < 0.8 ? fc() : undefined, l = fc(), r = fc();
    const u = CC.mergeUnit(FCK, b, l, r), v = CC.mergeUnit(FCK, b, r, l);
    assert.ok(u && v, 'both sides are free companies');
    for (const t of [l, r]) for (const sec of fcOf(t).discovered || []) assert.ok(fcOf(u.local).discovered.includes(sec) && fcOf(u.remote).discovered.includes(sec), 'case ' + i + ': sector ' + sec + ' kept');
    assert.strictEqual(v.local, u.remote, 'case ' + i + ': swapped'); assert.strictEqual(v.remote, u.local); assert.deepStrictEqual(v.asks, u.asks);
    const again = CC.mergeUnit(FCK, b, u.local, u.remote);
    assert.strictEqual(again.local, u.local, 'case ' + i + ': settled'); assert.strictEqual(again.remote, u.remote);
    for (const t of [u.local, u.remote]) { const self = CC.mergeUnit(FCK, b, t, t); assert.strictEqual(self.local, t, 'case ' + i + ': a side merged with itself'); assert.strictEqual(self.remote, t); }
  }
});

// R3.3 the end of a Settings sync (tracker/command-center/src/settings.js done()): a clash met there is applied without asking, the base is rebuilt so the next sync
// asks once, with the combined list, and not again afterwards
test('R3-3 end of a Settings sync with a name clash: asked once on the next sync, with the combined list, never repeatedly', async () => {
  const { port } = r3;
  const fc = (name, disc) => ({ name, charId: 'c1', order: 0, unlockedSlots: 2, world: 'Ravana', discovered: disc });
  const from = { fcs: { f1: fc('Alpha', [1, 2]) } }, now = { fcs: { f1: fc('Beta', [1, 2, 3]) } }, mine = { fcs: { f1: fc('Gamma', [1, 2, 4]) } };
  // what done() does: the three-way merge, applied without choices, then the base rebuilt for the clashes (the start copy's units)
  const st = (x) => Object.assign(ET.newState(['Alba']), { modules: { submersibles: Object.assign({ fcs: {}, subs: {}, trips: {}, settings: {} }, JSON.parse(JSON.stringify(x))) } });
  const target = st(now);
  const res = ET.threeWay(port(from), port(now), port(mine));
  assert.strictEqual(res.conflicts.length, 1); assert.strictEqual(fcOf(res.conflicts[0].local).name, 'Beta');
  ET.applyMerge(target, res, {});
  assert.deepStrictEqual(target.modules.submersibles.fcs.f1.discovered, [1, 2, 3, 4], 'applied without asking: this device\'s name, both sectors');
  const flat = (p) => ET.threeWay(p, p, p).merged, start = flat(port(from));
  const base = flat(port(from)); // the base the last sync left
  res.conflicts.forEach((c) => { if (start.has(c.id)) base.set(c.id, start.get(c.id)); else base.delete(c.id); });
  assert.strictEqual(base.get(FCK), start.get(FCK), 'the clashing unit is back at its start value');
  // next sync: base = rebuilt base, local = the merged copy, remote = the cloud copy (the other device's version): asked once, with the combined list
  const cloud = { fcs: { f1: fc('Gamma', [1, 2, 3, 4]) } };
  const baseDoc = ET.portable(ET.applyMerge(st(from), { merged: base, conflicts: [] }, {}));
  const next = ET.threeWay(baseDoc, ET.portable(target), port(cloud));
  assert.strictEqual(next.conflicts.length, 1, 'asked on the next sync');
  assert.deepStrictEqual(fcOf(next.conflicts[0].local).discovered, [1, 2, 3, 4]); assert.deepStrictEqual(fcOf(next.conflicts[0].remote).discovered, [1, 2, 3, 4]);
  assert.deepStrictEqual([fcOf(next.conflicts[0].local).name, fcOf(next.conflicts[0].remote).name], ['Beta', 'Gamma']);
  // the owner answers; the sync after that finds nothing to ask
  const answered = ET.applyMerge(st(JSON.parse(JSON.stringify(target.modules.submersibles))), next, { [next.conflicts[0].id]: 'remote' });
  const after = ET.threeWay(port(cloud), ET.portable(answered), port(cloud));
  assert.strictEqual(after.conflicts.length, 0, 'not asked again');
});

// ---------------------------------------------------------------------------------------------------------------------
// Integrity spec (docs/submersibles-integrity-spec.md), store rules: a free company removed on purpose is not stored
// again by a page that still held it; a company and slot never gain a second submarine through a write.
const intReset = () => { CC.resetMemory(); if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); } };
const intBare = (name, order, charId) => { const f = { name, order, unlockedSlots: 1, discovered: [1, 2] }; if (charId !== null) f.charId = charId || 'c1'; return f; };
const intSolid = (name, order, charId) => Object.assign(intBare(name, order, charId), { world: 'Ravana', unlockedSlots: 2, discovered: [1, 2, 3] });
const intSub = (fcId, slot, name) => ({ fcId, slot, name: name || 'Sub ' + slot, rank: 10, voyage: null });
const intClone = (x) => JSON.parse(JSON.stringify(x));
const intStored = async () => CC.checkDoc((await CC.read()).raw).modules.submersibles;
// seed a stored section exactly as given (no rule applies), return { rev, section }
const intSeed = async (sec) => {
  await CC.transact((raw) => { const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc(); doc.modules.submersibles = CC.checkModules({ submersibles: sec }).submersibles; doc.updated = Date.now(); return doc; });
  const r = await CC.read(); return { rev: r.rev, section: CC.checkDoc(r.raw).modules.submersibles };
};

test('INT-A1 CC.foldLoser equals the fold: a fixed table and 500 seeded random sections', () => {
  assert.strictEqual(typeof CC.foldLoser, 'function');
  const F = globalThis.FLEET, agree = (sec, id, fc) => {
    const added = intClone(sec); added.fcs = Object.assign({}, added.fcs, { [id]: fc });
    return CC.foldLoser(sec, id, fc) === F.foldFcs(added).removed.includes(id);
  };
  const sec = (fcs, subs) => ({ fcs, subs: subs || {}, trips: {}, settings: {} });
  // false with no character, and with no sibling
  assert.strictEqual(CC.foldLoser(sec({ fa: intBare('A', 0) }), 'fz', intBare('Z', 1, null)), false);
  assert.strictEqual(CC.foldLoser(sec({}), 'fz', intBare('Z', 1)), false);
  assert.strictEqual(CC.foldLoser(sec({ fa: intBare('A', 0, 'c2') }), 'fz', intBare('Z', 1)), false);
  // true: a bare sibling sorts before it; a solid sibling exists
  assert.strictEqual(CC.foldLoser(sec({ fa: intBare('A', 0) }), 'fz', intBare('Z', 1)), true);
  assert.strictEqual(CC.foldLoser(sec({ fa: intSolid('A', 5) }), 'fz', intBare('Z', 0)), true);
  // false: it would win; it is not bare
  assert.strictEqual(CC.foldLoser(sec({ fa: intBare('A', 1) }), 'fz', intBare('Z', 0)), false);
  assert.strictEqual(CC.foldLoser(sec({ fa: intBare('A', 0) }), 'fz', intSolid('Z', 1)), false);
  [[sec({ fa: intBare('A', 0), fb: intBare('B', 0) }), 'fa2', intBare('A2', 0)], [sec({ fa: intBare('A', 0) }), 'fa', intBare('A', 0)], [sec({ fb: intBare('B', 3) }), 'fa', intBare('A', 3)]]
    .forEach(([s, id, fc]) => assert.ok(agree(s, id, fc)));
  let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const mk = (name, solid) => { const f = rnd(5) === 0 ? intBare(name, rnd(3), null) : intBare(name, rnd(3), ['c1', 'c2'][rnd(2)]); if (solid) { f.world = 'Ravana'; if (rnd(2)) f.unlockedSlots = 2; } return f; };
  for (let i = 0; i < 500; i++) {
    const fcs = {}, subs = {}, n = rnd(5);
    for (let k = 0; k < n; k++) { const id = 'f' + 'abcde'[k], solid = rnd(3) === 0; fcs[id] = mk(id, solid); if (!solid && rnd(4) === 0) subs['s' + k] = intSub(id, 1); }
    const fc = mk('Z', rnd(4) === 0);
    assert.ok(agree(sec(fcs, subs), 'fx', fc), 'case ' + i);
  }
});

test('INT-A2 stale stamp: a company with a submarine removed in the stored copy and renamed here is refused, nothing comes back', async () => {
  intReset();
  const first = await CC.writeSection('submersibles', { fcs: { fa: intSolid('Alpha', 0, 'c2'), fb: intSolid('Beta', 1, 'c1') }, subs: { s1: intSub('fb', 1) }, trips: {}, settings: {} }, null);
  const local = intClone(first.section); local.fcs.fb.name = 'Typed Name';
  const other = intClone(first.section); delete other.fcs.fb; delete other.subs.s1;
  await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  await assert.rejects(() => CC.writeSection('submersibles', local, { rev: first.rev, base: first.section }), /removed on another device/);
  const stored = await intStored();
  assert.ok(!stored.fcs.fb && !stored.subs.s1, 'the stored copy still has neither');
});

test('INT-A3 stale stamp: a bare company with no character removed in the stored copy and renamed here is refused', async () => {
  intReset();
  const first = await CC.writeSection('submersibles', { fcs: { fa: intSolid('Alpha', 0), fb: intBare('Beta', 1, null) }, subs: {}, trips: {}, settings: {} }, null);
  const local = intClone(first.section); local.fcs.fb.name = 'Typed Name';
  const other = intClone(first.section); delete other.fcs.fb;
  await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  await assert.rejects(() => CC.writeSection('submersibles', local, { rev: first.rev, base: first.section }), /removed on another device/);
  assert.ok(!(await intStored()).fcs.fb);
});

test('INT-A4 stale stamp: a bare company removed on purpose, then a later bare company it would beat: refused', async () => {
  intReset();
  const first = await CC.writeSection('submersibles', { fcs: { fa: intSolid('Alpha', 0, 'c2'), fz: intBare('Zulu', 0) }, subs: {}, trips: {}, settings: {} }, null);
  const local = intClone(first.section); local.fcs.fz.name = 'Typed Name';
  const other = intClone(first.section); delete other.fcs.fz; other.fcs.fq = intBare('Later', 1);
  await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  await assert.rejects(() => CC.writeSection('submersibles', local, { rev: first.rev, base: first.section }), /removed on another device/);
  const stored = await intStored();
  assert.ok(!stored.fcs.fz && stored.fcs.fq);
});

test('INT-A5 (pin) the fold: a bare company that loses the fold is stored again by a save that adds a submarine', async () => {
  intReset();
  const first = await CC.writeSection('submersibles', { fcs: { fa: intBare('Alpha', 0), fz: intBare('Zulu', 1) }, subs: {}, trips: {}, settings: {} }, null);
  const folded = await CC.foldSection('submersibles', globalThis.FLEET.foldFcs);
  assert.deepStrictEqual(folded.removed, ['fz']);
  const local = intClone(first.section); local.fcs.fz.name = 'Typed Name'; local.subs.s1 = intSub('fz', 1);
  const saved = await CC.writeSection('submersibles', local, { rev: first.rev, base: first.section });
  assert.ok(saved.section.fcs.fz && saved.section.fcs.fz.name === 'Typed Name');
  assert.strictEqual((await intStored()).fcs.fz.name, 'Typed Name');
});

// G1: a stale page adds a submarine under a company (its record unchanged) that was removed elsewhere
const g1Run = async (fa, fb, extraStored) => {
  intReset();
  const first = await CC.writeSection('submersibles', { fcs: { fa, fb }, subs: {}, trips: {}, settings: {} }, null);
  const local = intClone(first.section); local.subs.sa = intSub('fa', 1, 'Added late');
  const other = intClone(first.section); delete other.fcs.fa;
  if (extraStored) extraStored(other);
  await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  const before = JSON.stringify(await intStored());
  return { before, run: () => CC.writeSection('submersibles', local, { rev: first.rev, base: first.section }) };
};
const G1MSG = /This free company was removed on another device or in another tab\./;

test('G1 a company kept on purpose (it would win the clean-up) is not replaced by another for a stale submarine', async () => {
  const t = await g1Run(intBare('Alpha', 0), intBare('Beta', 1));
  await assert.rejects(t.run, G1MSG);
  assert.strictEqual(JSON.stringify(await intStored()), t.before, 'the stored copy is unchanged');
});

test('G1 (pin) a company the clean-up would remove: the submarine moves to the company that beats it', async () => {
  const t = await g1Run(intBare('Alpha', 1), intBare('Beta', 0));
  const r = await t.run();
  assert.strictEqual(r.section.subs.sa.fcId, 'fb');
  assert.ok(!r.section.fcs.fa);
});

test('G1 (pin) a vanished empty company with a non-empty sibling: the submarine moves to that sibling', async () => {
  const t = await g1Run(intBare('Alpha', 0), intSolid('Beta', 1));
  const r = await t.run();
  assert.strictEqual(r.section.subs.sa.fcId, 'fb');
});

test('G1 the target is the company that beats it, not just any company of the character', async () => {
  // fb (bare, order 1) is not the winner; fc (solid) is: the move goes to fc
  intReset();
  const first = await CC.writeSection('submersibles', { fcs: { fa: intBare('Alpha', 0), fb: intBare('Beta', 1), fc: intSolid('Gamma', 2) }, subs: {}, trips: {}, settings: {} }, null);
  const local = intClone(first.section); local.subs.sa = intSub('fa', 1, 'Added late');
  const other = intClone(first.section); delete other.fcs.fa;
  await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  const r = await CC.writeSection('submersibles', local, { rev: first.rev, base: first.section });
  assert.strictEqual(r.section.subs.sa.fcId, 'fc');
});

test('G1 (pin) the target slot is occupied: refused', async () => {
  const t = await g1Run(intBare('Alpha', 1), intSolid('Beta', 0), (o) => { o.subs.sb = intSub('fb', 1, 'Already there'); });
  await assert.rejects(t.run, /slot changed elsewhere/);
  assert.strictEqual(JSON.stringify(await intStored()), t.before);
});

const intSlotBase = () => ({ fcs: { fa: Object.assign(intSolid('Alpha', 0), { unlockedSlots: 2 }) }, subs: {}, trips: {}, settings: {} });

test('INT-B1 stale stamp: a second submarine into a slot another page filled is refused, only the first is stored', async () => {
  intReset();
  const first = await CC.writeSection('submersibles', intSlotBase(), null);
  const other = intClone(first.section); other.subs.s1 = intSub('fa', 1, 'Saved elsewhere');
  await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  const local = intClone(first.section); local.subs.s2 = intSub('fa', 1, 'Typed here');
  await assert.rejects(() => CC.writeSection('submersibles', local, { rev: first.rev, base: first.section }), /slot changed elsewhere/);
  assert.deepStrictEqual(Object.keys((await intStored()).subs), ['s1']);
});

test('INT-B2 current stamp: a second submarine into an occupied slot is refused', async () => {
  intReset();
  const first = await CC.writeSection('submersibles', intSlotBase(), null);
  const other = intClone(first.section); other.subs.s1 = intSub('fa', 1, 'Saved elsewhere');
  const second = await CC.writeSection('submersibles', other, { rev: first.rev, base: first.section });
  const local = intClone(second.section); local.subs.s2 = intSub('fa', 1, 'Typed here');
  await assert.rejects(() => CC.writeSection('submersibles', local, { rev: second.rev, base: second.section }), /slot changed elsewhere/);
  assert.deepStrictEqual(Object.keys((await intStored()).subs), ['s1']);
});

test('INT-B3 (pin) a stored copy that already holds two in one slot stays writable: a preference change keeps both, a deletion resolves', async () => {
  intReset();
  const dup = intSlotBase(); dup.subs.s1 = intSub('fa', 1, 'One'); dup.subs.s2 = intSub('fa', 1, 'Two');
  const seeded = await intSeed(dup);
  assert.deepStrictEqual(Object.keys(seeded.section.subs).sort(), ['s1', 's2']);
  const pref = intClone(seeded.section); pref.settings.prefs = { sort: 'time' };
  const a = await CC.writeSection('submersibles', pref, { rev: seeded.rev, base: seeded.section });
  assert.deepStrictEqual(Object.keys(a.section.subs).sort(), ['s1', 's2']);
  assert.strictEqual(a.section.settings.prefs.sort, 'time');
  const del = intClone(a.section); delete del.subs.s2;
  const b = await CC.writeSection('submersibles', del, { rev: a.rev, base: a.section });
  assert.deepStrictEqual(Object.keys(b.section.subs), ['s1']);
});

// Integrity spec 4.3 / O2 option 2: three or more submarines in one slot across two devices are one question per slot.
const intSlot = (() => {
  const { solid, port, apply } = r3;
  const S = (slot, name, rank) => ({ fcId: 'fy', slot, name, rank, voyage: null });
  const side = (ids) => { const subs = {}, trips = {}; Object.keys(ids).forEach((id) => { subs[id] = S(1, ids[id][0], ids[id][1]); trips['t' + id] = { s: id, t: 1, r: [1], back: 2, items: [], newSectors: [] }; }); return { fcs: { fy: solid('Yankee') }, subs, trips }; };
  const run = (l, r) => { const res = ET.threeWay(port({ fcs: { fy: solid('Yankee') } }), port(l), port(r)); return { res, slots: res.conflicts.filter((c) => c.integrity && c.integrity.kind === 'slot') }; };
  const out = (l, res, choice, c) => apply(l, res, choice ? { [c.id]: choice } : {});
  return { side, run, out };
})();

test('INT-C1 three submarines in one slot (one here, two there): one question; no answer keeps all; each answer leaves one side with its voyages', () => {
  const { side, run, out } = intSlot, l = side({ a: ['Alpha One', 5] }), r = side({ b: ['Bravo Two', 9], c: ['Cedar Three', 7] });
  const { res, slots } = run(l, r);
  assert.strictEqual(slots.length, 1);
  assert.strictEqual(slots[0].id, 'i|submersibles-slot|' + encodeURIComponent('fy|1'));
  const none = out(l, res, null, slots[0]);
  assert.deepStrictEqual(Object.keys(none.subs).sort(), ['a', 'b', 'c']); assert.deepStrictEqual(Object.keys(none.trips).sort(), ['ta', 'tb', 'tc']);
  const here = out(l, res, 'local', slots[0]);
  assert.deepStrictEqual(Object.keys(here.subs), ['a']); assert.deepStrictEqual(Object.keys(here.trips), ['ta']);
  const there = out(l, res, 'remote', slots[0]);
  assert.deepStrictEqual(Object.keys(there.subs).sort(), ['b', 'c']); assert.deepStrictEqual(Object.keys(there.trips).sort(), ['tb', 'tc']);
  const d = ET.describeConflict(slots[0], null, ET.newState(['Alba']));
  assert.match(d.what, /slot 1 of “Yankee” holds 3 submarines across your devices/);
  assert.match(d.what, /if more than one stays, the Submersibles Board asks which one to keep/);
  assert.match(d.local, /^keep this device’s “Alpha One”, rank 5$/);
  assert.match(d.remote, /^keep the other device’s “Bravo Two”, rank 9 and “Cedar Three”, rank 7$/);
});

test('INT-C2 four submarines in one slot (two here, two there): one question, both answers, no answer keeps four', () => {
  const { side, run, out } = intSlot, l = side({ a: ['A', 1], b: ['B', 2] }), r = side({ c: ['C', 3], d: ['D', 4] });
  const { res, slots } = run(l, r);
  assert.strictEqual(slots.length, 1);
  assert.deepStrictEqual(Object.keys(out(l, res, null, slots[0]).subs).sort(), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(Object.keys(out(l, res, 'local', slots[0]).subs).sort(), ['a', 'b']);
  assert.deepStrictEqual(Object.keys(out(l, res, 'remote', slots[0]).subs).sort(), ['c', 'd']);
  assert.deepStrictEqual(Object.keys(out(l, res, 'remote', slots[0]).trips).sort(), ['tc', 'td']);
  assert.match(ET.describeConflict(slots[0], null, ET.newState(['Alba'])).what, /holds 4 submarines/);
});

test('INT-C3 one submarine on both devices and a second only on the other device: one question, each answer leaves one', () => {
  const { side, run, out } = intSlot, l = side({ a: ['A', 1] }), r = side({ a: ['A', 1], b: ['B', 2] });
  const { res, slots } = run(l, r);
  assert.strictEqual(slots.length, 1);
  assert.deepStrictEqual(Object.keys(out(l, res, 'local', slots[0]).subs), ['a']);
  assert.deepStrictEqual(Object.keys(out(l, res, 'remote', slots[0]).subs), ['b']);
  assert.deepStrictEqual(Object.keys(out(l, res, null, slots[0]).subs).sort(), ['a', 'b']);
});

// G4: the sync question never promises more than it does. For the INT-C cases and 500 seeded random ones (one to four records per side,
// some on both devices): every record the text names as staying either way is present after BOTH answers; the side not kept is removed
// (with its logged voyages) only when that answer is given; with no answer nothing is removed.
test('G4 the slot question: what its text names as staying stays after both answers, the side not kept goes only on its answer, no answer removes nothing', () => {
  const { side, run, out } = intSlot, nameOf = (id) => id.toUpperCase();
  const mk = (ids) => { const o = {}; ids.forEach((id, i) => { o[id] = [nameOf(id), 10 + i]; }); return side(o); };
  const names = (t) => { const r = []; String(t).replace(/“([^”]+)”/g, (m, n) => { r.push(n); return m; }); return r; };
  let asked = 0, withStays = 0;
  const one = (lids, rids, tag) => {
    const l = mk(lids), r = mk(rids), { res, slots } = run(l, r);
    const all = [...new Set(lids.concat(rids))].sort(), has = (o, id) => id in o.subs;
    if (!slots.length) return; // nothing asked: nothing is removed by the question (the merge keeps what each side has)
    assert.strictEqual(slots.length, 1, tag);
    asked++;
    const c = slots[0], d = ET.describeConflict(c, null, { chars: [] }), g = c.integrity;
    const staysText = (/; ((?:“[^”]+”(?:, )?)+), already on both devices, (?:stay|stays) either way/.exec(d.what) || [])[1];
    const stayIds = names(staysText).map((n) => n.toLowerCase());
    if (stayIds.length) withStays++;
    const keyId = (x) => JSON.parse(x.key.slice(2))[2], locIds = g.locals.map(keyId), remIds = g.remotes.map(keyId);
    const none = out(l, res, null, c), loc = out(l, res, 'local', c), rem = out(l, res, 'remote', c);
    all.forEach((id) => assert.ok(has(none, id) && has(none, id) && none.trips['t' + id], tag + ': no answer keeps ' + id));
    stayIds.forEach((id) => { assert.ok(has(loc, id) && has(rem, id), tag + ': ' + id + ' named as staying but missing after an answer'); assert.ok(!locIds.includes(id) && !remIds.includes(id), tag + ': a staying record is on neither side'); });
    // the buttons' texts name exactly the side's records
    assert.deepStrictEqual(names(d.local).map((n) => n.toLowerCase()).sort(), locIds.slice().sort(), tag + ': this-device text'); assert.deepStrictEqual(names(d.remote).map((n) => n.toLowerCase()).sort(), remIds.slice().sort(), tag + ': other-device text');
    locIds.forEach((id) => assert.ok(has(loc, id) && !has(rem, id) && !rem.trips['t' + id], tag + ': ' + id + ' stays on local, goes on remote with its voyage'));
    remIds.forEach((id) => assert.ok(has(rem, id) && !has(loc, id) && !loc.trips['t' + id], tag + ': ' + id + ' stays on remote, goes on local with its voyage'));
    all.filter((id) => !locIds.includes(id) && !remIds.includes(id)).forEach((id) => assert.ok(has(loc, id) && has(rem, id), tag + ': ' + id + ' is on neither side and must stay'));
  };
  [[['a'], ['b', 'c']], [['a', 'b'], ['c', 'd']], [['a'], ['a', 'b']], [['a', 'b'], ['a']], [['a', 'b'], ['a', 'c']], [['a', 'b', 'c'], ['a', 'b', 'c']], [['a'], ['b']]].forEach(([l, r], i) => one(l, r, 'fixed ' + i));
  let seed = 424242; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >> 8) % n; };
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (let i = 0; i < 500; i++) {
    const pick = () => { const n = 1 + rnd(4), o = []; while (o.length < n) { const id = pool[rnd(pool.length)]; if (!o.includes(id)) o.push(id); } return o; };
    one(pick(), pick(), 'case ' + i);
  }
  assert.ok(asked > 100 && withStays > 20, 'the random set reaches the questions it should: asked ' + asked + ', with a staying record ' + withStays);
});

test('INT-C4 (pin) three records already on both devices are not asked about; two new records on this device only are not asked about', () => {
  const { side, run } = intSlot, three = side({ a: ['A', 1], b: ['B', 2], c: ['C', 3] });
  assert.strictEqual(run(three, three).res.conflicts.length, 0);
  assert.strictEqual(run(side({ a: ['A', 1], b: ['B', 2] }), side({})).slots.length, 0);
});
