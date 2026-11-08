// Eveniunt Completionist Tracker - core model: characters, ticks, availability, totals.
// Plain script: attaches to globalThis.ET so the same file runs in the bundled page and in Node tests.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const MAX_CHARS = 8;
  const STATE_VERSION = 1;

  ET.MAX_CHARS = MAX_CHARS;
  ET.STATE_VERSION = STATE_VERSION;

  // ---------------------------------------------------------------- data index
  // Every entry is addressed by "<sectionId>:<entryId>". Entry ids are game sheet row ids, so keys
  // survive data updates (a new patch adds keys; it never renumbers old ones).
  ET.key = (sid, id) => sid + ':' + id;

  ET.indexData = function (data) {
    const byKey = new Map();
    const sections = [];
    for (const s of data.sections) {
      const groups = [];
      for (const g of s.g) {
        const keys = g.e.map((e) => {
          const k = ET.key(s.id, e.i);
          byKey.set(k, { e, s, g });
          return k;
        });
        groups.push({ t: g.t, c: g.c || '', keys });
      }
      sections.push({ id: s.id, t: s.t, area: s.area, groups });
    }
    return { data, byKey, sections };
  };

  // ---------------------------------------------------------------- state
  ET.newState = function (names) {
    if (!Array.isArray(names) || names.length < 1 || names.length > MAX_CHARS) {
      throw new Error('Choose between 1 and ' + MAX_CHARS + ' characters.');
    }
    const chars = names.map((n, i) => ({ id: 'c' + (i + 1), name: cleanName(n) || 'Character ' + (i + 1), lodestone: null, cls: null, gc: null }));
    const ticks = {};
    const excl = {};
    const vals = {};
    for (const c of chars) { ticks[c.id] = {}; excl[c.id] = {}; vals[c.id] = {}; }
    return {
      v: STATE_VERSION,
      chars,
      ticks,
      vals, // per character: level values for entries with e.val (e.g. job levels)
      excl, // per character: entries that do not apply to that character (e.g. another city's starting quests)
      avail: {}, // key -> 'x' (user says unobtainable) | 'ok' (user says obtainable)
      settings: { countLimited: false, countGone: false, countUnknown: false },
      sync: { fc: {}, drive: null, backupAt: null },
      updated: Date.now(),
    };
  };

  // Everything loaded from outside this device (a backup file, a transfer code, the cloud copy, or storage written
  // by an older version) passes through here. It is rebuilt field by field from known shapes, so a damaged or
  // crafted file can neither inject markup into the page nor reach Object.prototype (character ids become object
  // keys, so only "c1".."c8" are accepted; entry keys must look like "<section>:<number>").
  const CHAR_ID = /^c[1-8]$/;
  const ENTRY_KEY = /^[a-z0-9-]{1,40}:\d{1,9}$/;
  const NAME_MAX = 40;
  ET.CHAR_ID = CHAR_ID;
  ET.ENTRY_KEY = ENTRY_KEY;
  const cleanName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  ET.cleanName = cleanName;
  const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const keySet = (o) => { const out = {}; if (plain(o)) for (const k of Object.keys(o)) if (ENTRY_KEY.test(k) && o[k]) out[k] = 1; return out; };
  const levelMap = (o) => { const out = {}; if (plain(o)) for (const [k, v] of Object.entries(o)) { const n = Number(v); if (ENTRY_KEY.test(k) && Number.isFinite(n) && n >= 0) out[k] = Math.min(9999, Math.round(n)); } return out; };
  const CLASSES = ['mrd', 'acn', 'lnc', 'arc', 'cnj', 'gla', 'pgl', 'thm'];
  const CITY_IDS = ['lim', 'gri', 'uld'];

  ET.validateState = function (st) {
    const err = (m) => { throw new Error('Not a valid tracker file: ' + m); };
    if (!plain(st)) err('empty');
    if (st.v !== STATE_VERSION) err('unknown version ' + st.v);
    if (!Array.isArray(st.chars) || st.chars.length < 1 || st.chars.length > MAX_CHARS) err('characters');
    const ids = new Set();
    st.chars = st.chars.map((c, i) => {
      if (!plain(c) || typeof c.id !== 'string' || !CHAR_ID.test(c.id) || ids.has(c.id)) err('character ids');
      ids.add(c.id);
      const out = { id: c.id, name: cleanName(c.name) || 'Character ' + (i + 1), lodestone: null, cls: null, gc: null };
      const lode = String(c.lodestone == null ? '' : c.lodestone);
      if (/^\d{3,12}$/.test(lode)) out.lodestone = lode;
      if (CLASSES.includes(c.cls)) out.cls = c.cls;
      else if (CITY_IDS.includes(c.city)) out.city = c.city;
      if ([1, 2, 3].includes(Number(c.gc))) out.gc = Number(c.gc);
      return out;
    });
    if (!plain(st.ticks)) err('ticks');
    const per = (src, fn) => { const out = {}; for (const id of ids) out[id] = fn(plain(src) ? (Object.prototype.hasOwnProperty.call(src, id) ? src[id] : null) : null); return out; };
    st.ticks = per(st.ticks, keySet);
    st.excl = per(st.excl, keySet);
    st.vals = per(st.vals, levelMap);
    const avail = {};
    if (plain(st.avail)) for (const [k, v] of Object.entries(st.avail)) if (ENTRY_KEY.test(k) && (v === 'x' || v === 'ok')) avail[k] = v;
    st.avail = avail;
    const s = plain(st.settings) ? st.settings : {};
    st.settings = { countLimited: s.countLimited === true, countGone: s.countGone === true, countUnknown: s.countUnknown === true };
    const sync = plain(st.sync) ? st.sync : {};
    const fc = {};
    if (plain(sync.fc)) for (const id of ids) if (plain(sync.fc[id])) fc[id] = sync.fc[id];
    st.sync = { fc, drive: plain(sync.drive) ? sync.drive : null, backupAt: typeof sync.backupAt === 'number' ? sync.backupAt : null };
    if (typeof st.updated !== 'number') st.updated = Date.now();
    return st;
  };

  ET.renameCharacter = function (st, charId, name) {
    const c = st.chars.find((x) => x.id === charId);
    if (!c) throw new Error('No such character');
    c.name = cleanName(name) || c.name;
    st.updated = Date.now();
  };

  ET.setCharacterCount = function (st, n) {
    if (n < 1 || n > MAX_CHARS) throw new Error('Choose between 1 and ' + MAX_CHARS + ' characters.');
    while (st.chars.length < n) {
      let k = 1;
      while (st.chars.some((c) => c.id === 'c' + k)) k++;
      const c = { id: 'c' + k, name: 'Character ' + (st.chars.length + 1), lodestone: null, cls: null, gc: null };
      st.chars.push(c);
      st.ticks[c.id] = {};
      st.excl[c.id] = {};
      st.vals[c.id] = {};
    }
    // Removing characters drops their ticks; the interface asks before calling this.
    while (st.chars.length > n) {
      const c = st.chars.pop();
      delete st.ticks[c.id];
      delete st.excl[c.id];
      delete st.vals[c.id]; // otherwise a character added later in the same column would inherit these levels
      delete st.sync.fc[c.id];
    }
    st.updated = Date.now();
  };

  // ---------------------------------------------------------------- availability
  // Built-in marks come from the data (e.x: 'lim' time-limited only, 'gone' no longer obtainable,
  // 'unk' availability unknown).
  // A manual choice always wins: 'x' removes the entry from totals, 'ok' counts it.
  ET.availability = function (st, key, entry) {
    if (entry && entry.val && !entry.max) return { counted: false, info: true, manual: null, builtIn: null, marked: false }; // a value with no target (e.g. desynthesis level): recorded, not counted
    const manual = st.avail[key];
    const builtIn = entry && entry.x ? entry.x : null;
    let counted;
    if (manual === 'ok') counted = true;
    else if (manual === 'x') counted = false;
    else if (builtIn === 'lim') counted = !!st.settings.countLimited;
    else if (builtIn === 'gone') counted = !!st.settings.countGone;
    else if (builtIn === 'unk') counted = !!st.settings.countUnknown;
    else counted = true;
    return { counted, manual: manual || null, builtIn, marked: !counted };
  };

  // value: 'x' | 'ok' | 'auto' (back to the built-in mark)
  ET.setAvailability = function (st, key, value) {
    if (value === 'auto') delete st.avail[key];
    else if (value === 'x' || value === 'ok') st.avail[key] = value;
    else throw new Error('Unknown availability ' + value);
    st.updated = Date.now();
  };

  // One-click switch: flips between counted and not counted, storing a manual choice only when it
  // differs from what the built-in mark would give.
  ET.toggleAvailability = function (st, key, entry) {
    const now = ET.availability(st, key, entry).counted;
    const want = now ? 'x' : 'ok';
    delete st.avail[key];
    if (ET.availability(st, key, entry).counted !== !now) st.avail[key] = want;
    st.updated = Date.now();
    return !now;
  };

  // ---------------------------------------------------------------- level values
  // An entry with e.val holds a number per character; with e.max it is ticked once the value reaches it.
  ET.getValue = (st, charId, key) => (st.vals[charId] && st.vals[charId][key] != null ? st.vals[charId][key] : null);
  ET.setValue = function (st, charId, key, value, entry) {
    if (!st.vals[charId]) st.vals[charId] = {};
    const v = value === '' || value == null ? null : Math.max(0, Math.min(9999, Math.round(Number(value))));
    if (v == null || Number.isNaN(v)) delete st.vals[charId][key]; else st.vals[charId][key] = v;
    if (entry && entry.max) ET.setTick(st, charId, key, v != null && v >= entry.max);
    st.updated = Date.now();
  };

  // ---------------------------------------------------------------- starting class and Grand Company
  // The starting class decides the starting city; entries that belong to another city (e.city) or another Grand
  // Company (e.gc) do not apply to that character. Unset means nothing is excluded yet.
  ET.START_CLASSES = [
    ['mrd', 'Marauder', 'lim'], ['acn', 'Arcanist', 'lim'],
    ['lnc', 'Lancer', 'gri'], ['arc', 'Archer', 'gri'], ['cnj', 'Conjurer', 'gri'],
    ['gla', 'Gladiator', 'uld'], ['pgl', 'Pugilist', 'uld'], ['thm', 'Thaumaturge', 'uld'],
  ];
  ET.CITIES = { lim: 'Limsa Lominsa', gri: 'Gridania', uld: "Ul'dah" };
  ET.GCS = { 1: 'Maelstrom', 2: 'Order of the Twin Adder', 3: 'Immortal Flames' };
  ET.cityOf = (char) => { const c = ET.START_CLASSES.find((x) => x[0] === (char && char.cls)); return c ? c[2] : (char && char.city) || null; };
  ET.setStart = function (st, charId, cls, gc) {
    const c = st.chars.find((x) => x.id === charId);
    if (!c) throw new Error('No such character');
    if (cls !== undefined) { if (cls && !ET.START_CLASSES.some((x) => x[0] === cls)) throw new Error('Unknown starting class'); c.cls = cls || null; if (cls) delete c.city; }
    if (gc !== undefined) { c.gc = gc ? Number(gc) : null; }
    st.updated = Date.now();
  };
  // Why an entry does not apply to a character: 'manual' (marked by the user), 'city', 'gc', or null (it applies).
  ET.notApplicable = function (st, char, key, entry) {
    if (st.excl[char.id] && st.excl[char.id][key]) return 'manual';
    if (entry && entry.city) { const city = ET.cityOf(char); if (city && entry.city !== city) return 'city'; }
    if (entry && entry.gc && char.gc && entry.gc !== char.gc) return 'gc';
    return null;
  };

  // ---------------------------------------------------------------- per-character exclusion
  // "Does not apply to this character": left out of that character's total only.
  ET.isExcluded = (st, charId, key) => !!(st.excl[charId] && st.excl[charId][key]);
  ET.setExcluded = function (st, charId, key, on) {
    if (!st.excl[charId]) throw new Error('No such character');
    if (on) st.excl[charId][key] = 1;
    else delete st.excl[charId][key];
    st.updated = Date.now();
  };

  // ---------------------------------------------------------------- ticks
  ET.isTicked = (st, charId, key) => !!(st.ticks[charId] && st.ticks[charId][key]);

  ET.setTick = function (st, charId, key, on) {
    const t = st.ticks[charId];
    if (!t) throw new Error('No such character');
    if (on) t[key] = 1;
    else delete t[key];
    st.updated = Date.now();
  };

  ET.toggleTick = function (st, charId, key) {
    const on = !ET.isTicked(st, charId, key);
    ET.setTick(st, charId, key, on);
    return on;
  };

  // Tick or untick many entries for one or several characters (a whole group, or a whole row).
  ET.setMany = function (st, charIds, keys, on) {
    for (const c of charIds) for (const k of keys) {
      if (on) st.ticks[c][k] = 1;
      else delete st.ticks[c][k];
    }
    st.updated = Date.now();
  };

  // ---------------------------------------------------------------- totals
  // Counts only entries that are counted (see availability). Ticks on uncounted entries are kept
  // and shown, but never added to the done total.
  ET.tally = function (idx, st, keys) {
    const done = {};
    const totals = {};
    for (const c of st.chars) { done[c.id] = 0; totals[c.id] = 0; }
    let total = 0;
    let marked = 0;
    for (const k of keys) {
      const hit = idx.byKey.get(k);
      if (!hit) continue;
      const av = ET.availability(st, k, hit.e);
      if (av.info) continue;
      if (!av.counted) { marked++; continue; }
      total++;
      for (const c of st.chars) {
        if (ET.notApplicable(st, c, k, hit.e)) continue;
        totals[c.id]++;
        if (st.ticks[c.id][k]) done[c.id]++;
      }
    }
    // total: counted entries; totals[char]: what applies to that character (after its exclusions)
    return { total, totals, done, marked };
  };

  ET.sectionKeys = (sec) => sec.groups.flatMap((g) => g.keys);

  // Entries merged into one (e.al lists the old ids, e.g. the per-class variants of a city's opening quest): ticks,
  // "does not apply" marks, levels and availability choices saved under an old id move to the kept entry. Returns
  // how many were moved. Run after loading, restoring or syncing, so nothing saved before the merge disappears.
  ET.migrateAliases = function (idx, st) {
    let moved = 0;
    for (const [key, hit] of idx.byKey) {
      for (const a of hit.e.al || []) {
        const old = hit.s.id + ':' + a;
        if (old === key || idx.byKey.has(old)) continue;
        for (const c of st.chars) {
          for (const bag of [st.ticks[c.id], st.excl[c.id]]) if (bag && bag[old]) { bag[key] = 1; delete bag[old]; moved++; }
          const v = st.vals[c.id];
          if (v && v[old] != null) { if (v[key] == null) v[key] = v[old]; delete v[old]; moved++; }
        }
        if (st.avail[old]) { if (!st.avail[key]) st.avail[key] = st.avail[old]; delete st.avail[old]; moved++; }
      }
    }
    if (moved) st.updated = Date.now();
    return moved;
  };

  ET.summary = function (idx, st) {
    const out = { sections: {}, all: null };
    let allKeys = [];
    for (const sec of idx.sections) {
      const keys = ET.sectionKeys(sec);
      allKeys = allKeys.concat(keys);
      out.sections[sec.id] = ET.tally(idx, st, keys);
    }
    out.all = ET.tally(idx, st, allKeys);
    return out;
  };

  ET.percent = (done, total) => (total ? Math.floor((1000 * done) / total) / 10 : 0);
})();
