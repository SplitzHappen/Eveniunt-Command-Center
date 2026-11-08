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
    const chars = names.map((n, i) => ({ id: 'c' + (i + 1), name: String(n || '').trim() || 'Character ' + (i + 1), lodestone: null }));
    const ticks = {};
    const excl = {};
    for (const c of chars) { ticks[c.id] = {}; excl[c.id] = {}; }
    return {
      v: STATE_VERSION,
      chars,
      ticks,
      vals: {}, // per character: level values for entries with e.val (e.g. job levels)
      excl, // per character: entries that do not apply to that character (e.g. another city's starting quests)
      avail: {}, // key -> 'x' (user says unobtainable) | 'ok' (user says obtainable)
      settings: { countLimited: false, countGone: false, countUnknown: false },
      sync: { fc: {}, drive: null },
      updated: Date.now(),
    };
  };

  ET.validateState = function (st) {
    const err = (m) => { throw new Error('Not a valid tracker file: ' + m); };
    if (!st || typeof st !== 'object') err('empty');
    if (st.v !== STATE_VERSION) err('unknown version ' + st.v);
    if (!Array.isArray(st.chars) || st.chars.length < 1 || st.chars.length > MAX_CHARS) err('characters');
    const ids = new Set();
    for (const c of st.chars) {
      if (!c || typeof c.id !== 'string' || ids.has(c.id)) err('character ids');
      ids.add(c.id);
      if (typeof c.name !== 'string') err('character name');
    }
    if (!st.ticks || typeof st.ticks !== 'object') err('ticks');
    for (const id of ids) if (!st.ticks[id]) st.ticks[id] = {};
    for (const id of Object.keys(st.ticks)) if (!ids.has(id)) delete st.ticks[id];
    if (!st.vals || typeof st.vals !== 'object') st.vals = {};
    for (const id of ids) if (!st.vals[id]) st.vals[id] = {};
    for (const id of Object.keys(st.vals)) if (!ids.has(id)) delete st.vals[id];
    if (!st.excl || typeof st.excl !== 'object') st.excl = {};
    for (const id of ids) if (!st.excl[id]) st.excl[id] = {};
    for (const id of Object.keys(st.excl)) if (!ids.has(id)) delete st.excl[id];
    if (!st.avail || typeof st.avail !== 'object') st.avail = {};
    for (const [k, v] of Object.entries(st.avail)) if (v !== 'x' && v !== 'ok') delete st.avail[k];
    st.settings = Object.assign({ countLimited: false, countGone: false, countUnknown: false }, st.settings || {});
    st.sync = Object.assign({ fc: {}, drive: null }, st.sync || {});
    return st;
  };

  ET.renameCharacter = function (st, charId, name) {
    const c = st.chars.find((x) => x.id === charId);
    if (!c) throw new Error('No such character');
    c.name = String(name || '').trim() || c.name;
    st.updated = Date.now();
  };

  ET.setCharacterCount = function (st, n) {
    if (n < 1 || n > MAX_CHARS) throw new Error('Choose between 1 and ' + MAX_CHARS + ' characters.');
    while (st.chars.length < n) {
      let k = 1;
      while (st.chars.some((c) => c.id === 'c' + k)) k++;
      const c = { id: 'c' + k, name: 'Character ' + (st.chars.length + 1), lodestone: null };
      st.chars.push(c);
      st.ticks[c.id] = {};
      st.excl[c.id] = {};
    }
    // Removing characters drops their ticks; the interface asks before calling this.
    while (st.chars.length > n) {
      const c = st.chars.pop();
      delete st.ticks[c.id];
      delete st.excl[c.id];
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
        if (st.excl[c.id][k]) continue;
        totals[c.id]++;
        if (st.ticks[c.id][k]) done[c.id]++;
      }
    }
    // total: counted entries; totals[char]: what applies to that character (after its exclusions)
    return { total, totals, done, marked };
  };

  ET.sectionKeys = (sec) => sec.groups.flatMap((g) => g.keys);

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
