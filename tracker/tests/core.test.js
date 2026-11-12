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
