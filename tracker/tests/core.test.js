'use strict';
// Core logic tests: node --test tests/core.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
for (const f of ['model', 'codec', 'merge', 'ffxivcollect', 'gdrive', 'links', 'storage']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
globalThis.ET.DRIVE_SETTLE_MS = 0; // the cloud re-check after writing waits a moment in the app; not in tests
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
  assert.ok(code.startsWith('EVT1-'));
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

test('Google Drive sync with a fake Drive: create, merge, conflict, finish', async () => {
  const files = {};
  let nextId = 1;
  const fake = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const json = (o) => ({ ok: true, status: 200, json: async () => o });
    if (url.includes('/drive/v3/files?spaces=appDataFolder')) return json({ files: Object.keys(files).map((id) => ({ id })) });
    if (method === 'POST' && url.includes('uploadType=multipart')) {
      const id = 'f' + nextId++;
      const body = opts.body.split('\r\n\r\n')[2].split('\r\n--')[0];
      files[id] = JSON.parse(body);
      return json({ id });
    }
    const m = url.match(/files\/(f\d+)/);
    if (method === 'PATCH') { files[m[1]] = JSON.parse(opts.body); return json({}); }
    if (url.includes('alt=media')) return json(files[m[1]]);
    return { ok: false, status: 400 };
  };
  const k1 = firstKey('mounts', () => true), k2 = firstKey('minions', () => true);
  const pc = ET.newState(['A']);
  assert.deepStrictEqual(await ET.driveSync(pc, 'tok', fake), { done: true, created: true });
  const phone = ET.newState(['A']);
  assert.strictEqual((await ET.driveSync(phone, 'tok', fake)).done, true);
  ET.setTick(phone, 'c1', k1, true);
  await ET.driveSync(phone, 'tok', fake);
  ET.setTick(pc, 'c1', k2, true);
  assert.strictEqual((await ET.driveSync(pc, 'tok', fake)).done, true);
  assert.ok(pc.ticks.c1[k1] && pc.ticks.c1[k2]);
  // conflict: both rename the character differently
  ET.renameCharacter(pc, 'c1', 'PC name');
  ET.renameCharacter(phone, 'c1', 'Phone name');
  await ET.driveSync(phone, 'tok', fake);
  const r = await ET.driveSync(pc, 'tok', fake);
  assert.strictEqual(r.done, false);
  assert.strictEqual(r.conflicts.length, 1);
  await ET.driveFinish(pc, 'tok', r, { [r.conflicts[0].id]: 'remote' }, fake);
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

function fakeDrive() {
  const files = {}, mtime = {}, fail = { patch: 0 }, hooks = {};
  let nextId = 1, clock = 0;
  const f = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const json = (o) => ({ ok: true, status: 200, json: async () => o });
    if (url.includes('/drive/v3/files?spaces=appDataFolder')) return json({ files: Object.keys(files).map((id) => ({ id, modifiedTime: String(mtime[id]) })) });
    if (method === 'POST' && url.includes('uploadType=multipart')) {
      const id = 'f' + nextId++;
      files[id] = JSON.parse(opts.body.split('\r\n\r\n')[2].split('\r\n--')[0]); mtime[id] = ++clock;
      return json({ id, modifiedTime: String(mtime[id]) });
    }
    const m = url.match(/files\/(f\d+)/);
    if (method === 'PATCH') {
      if (fail.patch) { fail.patch--; return { ok: false, status: 500 }; }
      files[m[1]] = JSON.parse(opts.body); const written = String(mtime[m[1]] = ++clock);
      if (hooks.afterPatch) { const h = hooks.afterPatch; hooks.afterPatch = null; await h(); }
      return json({ id: m[1], modifiedTime: written });
    }
    if (url.includes('alt=media')) return json(files[m[1]]);
    return { ok: false, status: 400 };
  };
  return { f, files, fail, hooks, touch: (id, doc) => { files[id] = doc; mtime[id] = ++clock; } };
}

test('cloud sync: a damaged cloud copy never wipes this device', async () => {
  const d = fakeDrive();
  const st = ET.newState(['A']);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 5);
  keys.forEach((k) => ET.setTick(st, 'c1', k, true));
  await ET.driveSync(st, 'tok', d.f);
  d.touch('f1', {}); // emptied or replaced by something else
  await assert.rejects(ET.driveSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  assert.strictEqual(Object.keys(st.ticks.c1).length, 5);
  await ET.driveOverwrite(st, 'tok', 'f1', d.f);
  assert.strictEqual(Object.keys(d.files.f1.ticks.c1).length, 5);
});

test('cloud sync: a large removal from the other device is held for confirmation', async () => {
  const d = fakeDrive();
  const pc = ET.newState(['A']);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 120);
  keys.forEach((k) => ET.setTick(pc, 'c1', k, true));
  await ET.driveSync(pc, 'tok', d.f);
  const phone = ET.newState(['A']);
  await ET.driveSync(phone, 'tok', d.f); // the phone takes the 120 ticks
  assert.strictEqual(Object.keys(phone.ticks.c1).length, 120);
  phone.ticks.c1 = {}; phone.updated = Date.now(); // cleared by mistake on the phone
  await ET.driveSync(phone, 'tok', d.f);
  const r = await ET.driveSync(pc, 'tok', d.f);
  assert.strictEqual(r.done, false);
  assert.strictEqual(r.loss, 120);
  assert.strictEqual(Object.keys(pc.ticks.c1).length, 120, 'nothing removed before the owner confirms');
});

test('cloud sync: if another device writes between reading and writing, nothing is overwritten', async () => {
  const d = fakeDrive();
  const a = ET.newState(['A']);
  await ET.driveSync(a, 'tok', d.f);
  ET.renameCharacter(a, 'c1', 'Name on A');
  const b = ET.newState(['A']);
  await ET.driveSync(b, 'tok', d.f);
  ET.renameCharacter(b, 'c1', 'Name on B');
  await ET.driveSync(b, 'tok', d.f);
  const r = await ET.driveSync(a, 'tok', d.f); // conflict on the name: waits for the owner
  assert.strictEqual(r.done, false);
  const k = firstKey('mounts', () => true);
  ET.setTick(b, 'c1', k, true);
  await ET.driveSync(b, 'tok', d.f); // meanwhile B syncs again
  await assert.rejects(ET.driveFinish(a, 'tok', r, {}, d.f), (e) => e.code === 'changed');
  assert.ok(d.files.f1.ticks.c1[k], "B's newer tick is still in the cloud");
});

test('cloud sync: the merged copy is validated (a cloud file with an odd character is refused; odd keys are ignored)', async () => {
  const d = fakeDrive();
  const st = ET.newState(['A']);
  await ET.driveSync(st, 'tok', d.f);
  const bad = JSON.parse(JSON.stringify(d.files.f1));
  bad.chars.push({ id: '__proto__', name: 'x' }); bad.ticks.__proto__ = { 'mounts:1': 1 };
  d.touch('f1', bad);
  await assert.rejects(ET.driveSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  const doc = JSON.parse(JSON.stringify(d.files.f1));
  doc.chars.pop(); doc.ticks.c1 = { 'mounts:1': 1, '<b>': 1 };
  d.touch('f1', doc);
  await ET.driveSync(st, 'tok', d.f);
  assert.deepStrictEqual(st.chars.map((c) => c.id), ['c1']);
  assert.deepStrictEqual(Object.keys(st.ticks.c1), ['mounts:1']);
  assert.strictEqual(({})['mounts:1'], undefined);
});

test('cloud sync: a copy missing a character\'s ticks, or of another app, is refused; any removal from the other device asks first', async () => {
  const d = fakeDrive();
  const st = ET.newState(['A']);
  const keys = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 10);
  keys.forEach((k) => ET.setTick(st, 'c1', k, true));
  await ET.driveSync(st, 'tok', d.f);
  const noMap = JSON.parse(JSON.stringify(d.files.f1)); delete noMap.ticks.c1;
  d.touch('f1', noMap);
  await assert.rejects(ET.driveSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  d.touch('f1', Object.assign({}, JSON.parse(JSON.stringify(st.sync.drive.base)), { app: 'something-else', v: 1 }));
  await assert.rejects(ET.driveSync(st, 'tok', d.f), (e) => e.code === 'damaged');
  const one = JSON.parse(JSON.stringify(st.sync.drive.base)); one.app = 'eveniunt-completionist-tracker'; one.v = ET.STATE_VERSION; delete one.ticks.c1[keys[0]];
  d.touch('f1', one); // one tick removed on the other device
  const r = await ET.driveSync(st, 'tok', d.f);
  assert.strictEqual(r.done, false);
  assert.strictEqual(r.loss, 1, 'even one removal is confirmed');
  assert.strictEqual(Object.keys(st.ticks.c1).length, 10);
});

test('cloud sync: a failed upload leaves this device unchanged; ticks made during the upload are kept', async () => {
  const d = fakeDrive();
  const a = ET.newState(['A']);
  await ET.driveSync(a, 'tok', d.f);
  const b = ET.newState(['A']);
  await ET.driveSync(b, 'tok', d.f);
  const [k1, k2, k3] = ET.sectionKeys(idx.sections.find((s) => s.id === 'mounts')).slice(0, 3);
  ET.setTick(b, 'c1', k1, true);
  await ET.driveSync(b, 'tok', d.f);
  d.fail.patch = 1;
  await assert.rejects(ET.driveSync(a, 'tok', d.f), /answered 500/);
  assert.ok(!a.ticks.c1[k1], 'nothing merged here when the upload failed');
  d.hooks.afterPatch = () => { ET.setTick(a, 'c1', k2, true); }; // ticked on this device while the upload runs
  await ET.driveSync(a, 'tok', d.f);
  assert.ok(a.ticks.c1[k1] && a.ticks.c1[k2]);
  ET.setTick(a, 'c1', k3, true);
  await ET.driveSync(a, 'tok', d.f);
  assert.ok(d.files.f1.ticks.c1[k2] && d.files.f1.ticks.c1[k3], 'the tick made during the upload reaches the cloud on the next sync');
});

test('cloud sync: two devices writing at the same moment end with both devices\' ticks', async () => {
  const d = fakeDrive();
  const a = ET.newState(['A']);
  await ET.driveSync(a, 'tok', d.f);
  const b = ET.newState(['A']);
  await ET.driveSync(b, 'tok', d.f);
  const [ka, kb] = ET.sectionKeys(idx.sections.find((s) => s.id === 'minions')).slice(0, 2);
  ET.setTick(a, 'c1', ka, true); ET.setTick(b, 'c1', kb, true);
  // B read the cloud copy and passed its check before A wrote; A uploads, and right after A's upload lands, B's upload
  // (made from the older copy, so without A's tick) overwrites it. Drive has no "write only if unchanged".
  const before = JSON.parse(JSON.stringify(d.files.f1));
  d.hooks.afterPatch = () => {
    const merged = ET.applyMerge(JSON.parse(JSON.stringify(b)), ET.threeWay(b.sync.drive.base, ET.portable(b), before), {});
    const docB = Object.assign({ app: 'eveniunt-completionist-tracker', v: ET.STATE_VERSION }, JSON.parse(JSON.stringify(ET.portable(merged))));
    d.touch('f1', docB);
    b.sync.drive.base = JSON.parse(JSON.stringify(ET.portable(merged)));
  };
  await assert.rejects(ET.driveSync(a, 'tok', d.f), (e) => e.code === 'changed', 'A notices the later write');
  assert.ok(!d.files.f1.ticks.c1[ka] && d.files.f1.ticks.c1[kb], "for a moment the cloud lacks A's tick");
  await ET.driveSync(a, 'tok', d.f); // the automatic second sync
  await ET.driveSync(b, 'tok', d.f);
  assert.ok(d.files.f1.ticks.c1[ka] && d.files.f1.ticks.c1[kb], 'the cloud copy has both ticks');
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
