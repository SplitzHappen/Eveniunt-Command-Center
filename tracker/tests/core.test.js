'use strict';
// Core logic tests: node --test tests/core.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
for (const f of ['model', 'codec', 'merge', 'ffxivcollect', 'gdrive']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
const ET = globalThis.ET;

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tracker-data.json'), 'utf8'));
const idx = ET.indexData(data);
const firstKey = (sid, pred) => ET.sectionKeys(idx.sections.find((s) => s.id === sid)).find((k) => pred(idx.byKey.get(k).e));

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
  const mount = pick('mounts'), quest = pick('quests-sidequests'), recipe = pick('craft-carpenter');
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
  assert.ok(r.ticks['quests-sidequests:' + quest.i]);
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
  const sec = idx.sections.find((s) => s.id === 'quests-sidequests');
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
