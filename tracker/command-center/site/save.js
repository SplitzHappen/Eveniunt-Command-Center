// Eveniunt Command Center: the one save shared by every module (gate 1C; blueprint section 4a, rules 2, 3 and 4).
// Plain script: attaches to globalThis.CC, so the same file runs in the Tracker, the Atelier, the shell and Node tests.
//
// The save is one record in IndexedDB ('eveniunt-command-center' → 'save' → 'main', with a revision stamp 'main-rev'),
// localStorage as the fallback, memory as the last resort:
//   { app, v, updated, chars: [...], modules: { tracker, atelier, lists, submersibles, ... }, device: {...}, moved: {...} }
// - chars: the characters every module shares (up to 8, ids c1..c8).
// - modules: one section per module. The Tracker checks its own section; this file checks the others, and keeps a
//   section it does not know (written by a newer app) as plain data instead of dropping it.
// - device and moved: this device's own bookkeeping, never copied into backups, transfer codes or the cloud.
// Every write runs in one transaction that reads the stamp, lets the caller merge with what another page saved since,
// and writes the save with a new stamp, so two pages saving at once are serialised by the browser.
(function () {
  'use strict';
  const CC = (globalThis.CC = globalThis.CC || {});
  CC.APP = 'eveniunt-command-center';
  CC.VERSION = 1;
  const DB = 'eveniunt-command-center', STORE = 'save', KEY = 'main', REV = 'main-rev', LS = 'eveniunt-command-center-save';
  CC.DB = DB; CC.STORE = STORE; CC.LS = LS;
  CC.MAX_CHARS = 8;
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const MODULE = /^[a-z][a-z0-9-]{0,31}$/;
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const safeKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 64 && /^[A-Za-z0-9_.:-]+$/.test(k) && !BAD_KEYS.has(k);
  CC.MODULE = MODULE;
  CC.safeKey = safeKey;

  // ------------------------------------------------------------------ checking outside data
  // A JSON-safe copy with limits: plain objects with safe keys, arrays, finite numbers, short strings, booleans, null.
  function clean(v, depth) {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') return v.length > 20000 ? v.slice(0, 20000) : v;
    if (depth > 10) return null;
    if (Array.isArray(v)) return v.slice(0, 5000).map((x) => clean(x, depth + 1));
    if (plain(v)) { const o = {}; for (const [k, x] of Object.entries(v)) if (safeKey(k) && x !== undefined) o[k] = clean(x, depth + 1); return o; }
    return null;
  }
  CC.clean = (v) => clean(v, 0);
  const cleanName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  // Characters as every module sees them (the Tracker checks them fully with its own rules).
  CC.checkChars = function (chars) {
    const out = [], ids = new Set();
    for (const c of Array.isArray(chars) ? chars.slice(0, CC.MAX_CHARS) : []) {
      if (!plain(c) || typeof c.id !== 'string' || !/^c[1-8]$/.test(c.id) || ids.has(c.id)) continue;
      ids.add(c.id);
      const o = { id: c.id, name: cleanName(c.name) || c.id, lodestone: /^\d{3,12}$/.test(String(c.lodestone || '')) ? String(c.lodestone) : null, cls: typeof c.cls === 'string' && /^[a-z]{3}$/.test(c.cls) ? c.cls : null, gc: [1, 2, 3].includes(Number(c.gc)) ? Number(c.gc) : null };
      if (!o.cls && typeof c.city === 'string' && /^[a-z]{3}$/.test(c.city)) o.city = c.city;
      out.push(o);
    }
    return out;
  };

  // The Atelier's section: one crafter profile per character, today's single set until its character is named,
  // saved macros by id, and the macro, solver and guide preferences.
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  function statRow(s) {
    return { level: int(s.level, 1, 100, 100), craftsmanship: int(s.craftsmanship, 1, 99999, 4900), control: int(s.control, 1, 99999, 4800), cp: int(s.cp, 1, 9999, 620),
      manipulation: s.manipulation !== false, heartAndSoul: s.heartAndSoul === true, quickInnovation: s.quickInnovation === true };
  }
  const item = (x) => (plain(x) && Number.isInteger(x.id) && x.id > 0 ? { id: x.id, hq: x.hq !== false } : null);
  CC.checkProfile = function (p) {
    if (!plain(p)) return null;
    const stats = {};
    for (let j = 0; j < 8; j++) { const s = plain(p.stats) ? p.stats['j' + j] : null; if (plain(s)) stats['j' + j] = statRow(s); }
    return { stats, food: item(p.food), potion: item(p.potion), cosmicTool: p.cosmicTool !== false };
  };
  const PREFS = ['macro', 'savedCfg', 'guideMs', 'condModel', 'mmSecPerStep', 'solver', 'target'];
  function checkAtelier(sec) {
    const out = { v: 1, chars: {}, unassigned: CC.checkProfile(sec.unassigned), saved: {}, prefs: {} };
    if (plain(sec.chars)) for (const [id, p] of Object.entries(sec.chars)) { const q = /^c[1-8]$/.test(id) && CC.checkProfile(p); if (q) out.chars[id] = q; }
    if (plain(sec.saved)) for (const [id, m] of Object.entries(sec.saved).slice(0, 500)) if (plain(m)) out.saved[id] = m;
    if (plain(sec.prefs)) for (const k of PREFS) if (sec.prefs[k] !== undefined && sec.prefs[k] !== null) out.prefs[k] = sec.prefs[k];
    return out;
  }
  // The Submersibles section (design 7.1; step S2): free companies, submarines, trips and preferences, each one merge unit.
  //   fcs:   { <fcId>:  { name, world, charId, order, unlockedSlots, discovered: [sectorIds] } }
  //   subs:  { <subId>: { fcId, slot, name, rank, expIntoRank, parts: [hull, stern, bow, bridge], voyage: { sentAt, route, returnAt, calcAt, gameSaid } | null } }
  //   trips: { <tripId>: { s, t, r, back, calc, said, items: [[itemId, qty]], newSectors, rankAfter, rankCalc } }
  //   rankCalc: the least rank worked out on return; rankAfter: the rank kept (the owner's correction when the game showed more).
  //   calcAt / calc: the worked-out return time, kept beside the game's typed time as evidence for the formula (design 3.2).
  //   settings: { prefs: { sort, grouping, quietHours, window, priceWorld } }
  // Only known fields with the right type are kept; a bad field or entry is dropped, never repaired by guessing. Trips are
  // never dropped to save space (blueprint rule 11). Sector and part ids are the game's (data/submarines.json, pinned
  // game data 44948e4c); tests/core.test.js checks these two lists against that file, so a new game patch updates both.
  const SUB_SEA_STARTS = new Set([31, 52, 73, 94, 115, 136]); // each sea's starting point is not a sector
  CC.SUB_SECTOR_MAX = 149;
  CC.SUB_PART_SLOTS = '2301'.repeat(10); // part id n sits in slot SUB_PART_SLOTS[n - 1]: 0 hull, 1 stern, 2 bow, 3 bridge
  const isSector = (n) => Number.isInteger(n) && n >= 1 && n <= CC.SUB_SECTOR_MAX && !SUB_SEA_STARTS.has(n);
  CC.isSubSector = isSector;
  const time = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
  const intIn = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
  const subName = (s, cap) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, cap) : undefined);
  const sectors = (a, max) => { if (!Array.isArray(a)) return undefined; const out = []; for (const n of a) if (isSector(n) && !out.includes(n)) out.push(n); return max ? out.slice(0, max) : out; };
  const keep = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
  const hhmm = (w) => (plain(w) && intIn(w.from, 0, 1439) !== undefined && intIn(w.to, 0, 1439) !== undefined ? { from: w.from, to: w.to } : undefined);
  function subParts(p) {
    if (!Array.isArray(p) || p.length !== 4) return undefined;
    return p.every((id, i) => Number.isInteger(id) && id >= 1 && id <= CC.SUB_PART_SLOTS.length && CC.SUB_PART_SLOTS[id - 1] === String(i)) ? p.slice() : undefined;
  }
  function subVoyage(v) {
    if (!plain(v) || time(v.returnAt) === undefined) return null;
    return keep({ sentAt: time(v.sentAt), route: sectors(v.route, 5) || [], returnAt: v.returnAt, calcAt: time(v.calcAt), gameSaid: subName(v.gameSaid, 40) });
  }
  function checkSubmersibles(sec) {
    const out = { fcs: {}, subs: {}, trips: {}, settings: {} };
    if (plain(sec.fcs)) for (const [id, f] of Object.entries(sec.fcs)) {
      if (!plain(f)) continue;
      out.fcs[id] = keep({ name: subName(f.name, 40), world: subName(f.world, 32), charId: typeof f.charId === 'string' && /^c[1-8]$/.test(f.charId) ? f.charId : (f.charId === null ? null : undefined),
        order: intIn(f.order, 0, 9999), unlockedSlots: intIn(f.unlockedSlots, 1, 4), discovered: sectors(f.discovered) });
    }
    if (plain(sec.subs)) for (const [id, s] of Object.entries(sec.subs)) {
      if (!plain(s) || !safeKey(s.fcId) || intIn(s.slot, 1, 4) === undefined) continue; // a sub that belongs nowhere is not guessed
      out.subs[id] = keep({ fcId: s.fcId, slot: s.slot, name: subName(s.name, 20), rank: intIn(s.rank, 1, 145), expIntoRank: intIn(s.expIntoRank, 0, 1e9),
        parts: subParts(s.parts), voyage: subVoyage(s.voyage) });
    }
    if (plain(sec.trips)) for (const [id, t] of Object.entries(sec.trips)) {
      if (!plain(t) || !safeKey(t.s) || time(t.t) === undefined) continue;
      const items = Array.isArray(t.items) ? t.items.filter((x) => Array.isArray(x) && x.length === 2 && intIn(x[0], 1, 1e7) !== undefined && intIn(x[1], 1, 1e6) !== undefined).map((x) => [x[0], x[1]]) : [];
      out.trips[id] = keep({ s: t.s, t: t.t, r: sectors(t.r, 5) || [], back: time(t.back), calc: time(t.calc), said: subName(t.said, 40), items, newSectors: sectors(t.newSectors) || [], rankAfter: intIn(t.rankAfter, 1, 145), rankCalc: intIn(t.rankCalc, 1, 145) });
    }
    const p = plain(sec.settings) && plain(sec.settings.prefs) ? sec.settings.prefs : null;
    if (p) out.settings.prefs = keep({ sort: ['fc', 'time'].includes(p.sort) ? p.sort : undefined, grouping: ['sub', 'fc', 'fleet'].includes(p.grouping) ? p.grouping : undefined,
      quietHours: hhmm(p.quietHours), window: hhmm(p.window), priceWorld: subName(p.priceWorld, 32) });
    return out;
  }
  CC.checkSubmersibles = checkSubmersibles;
  const CHECK = { atelier: checkAtelier, submersibles: checkSubmersibles };
  // Every section except the Tracker's (the Tracker checks its own).
  CC.checkModules = function (mods) {
    const out = {};
    if (!plain(mods)) return out;
    for (const [name, sec] of Object.entries(mods)) {
      if (name === 'tracker' || !MODULE.test(name) || !plain(sec)) continue;
      const c = clean(sec, 0);
      out[name] = CHECK[name] ? CHECK[name](c) : c;
    }
    return out;
  };
  CC.others = (mods) => CC.checkModules(mods);

  // The whole save as read from storage. Throws on anything that is not a Command Center save; a save from a newer
  // version throws with code 'newer' (it is never overwritten by this one).
  CC.checkDoc = function (doc) {
    if (!plain(doc) || doc.app !== CC.APP) throw new Error('not a Command Center save');
    if (!Number.isInteger(doc.v) || doc.v < 1) throw new Error('unknown save version');
    if (doc.v > CC.VERSION) throw Object.assign(new Error('This save was written by a newer version of the app. Reload the page to update.'), { code: 'newer' });
    const mods = plain(doc.modules) ? doc.modules : {};
    const out = { app: CC.APP, v: CC.VERSION, updated: typeof doc.updated === 'number' ? doc.updated : 0, chars: CC.checkChars(doc.chars), modules: CC.checkModules(mods),
      device: plain(doc.device) ? clean(doc.device, 0) : {}, moved: plain(doc.moved) ? clean(doc.moved, 0) : {} };
    if (plain(mods.tracker)) out.modules.tracker = mods.tracker; // checked by the Tracker itself
    return out;
  };
  CC.emptyDoc = () => ({ app: CC.APP, v: CC.VERSION, updated: 0, chars: [], modules: {}, device: {}, moved: {} });

  // ------------------------------------------------------------------ merging module sections
  // Every section except the Tracker's merges in units two levels down (for example atelier → chars → c1): a unit
  // changed on one side only is taken; a unit changed differently on both sides is a clash for the owner.
  // Keys: 'm|' + JSON path; values: the unit as JSON.
  CC.UNIT_DEPTH = 2;
  function walk(obj, path, depth, map) {
    for (const [k, v] of Object.entries(obj)) {
      if (!safeKey(k) || v === undefined) continue;
      const p = path.concat(k);
      if (depth > 1 && plain(v) && Object.keys(v).length) walk(v, p, depth - 1, map);
      else map.set('m|' + JSON.stringify(p), JSON.stringify(v));
    }
  }
  CC.flatModules = function (mods, map) {
    map = map || new Map();
    if (!plain(mods)) return map;
    for (const [name, sec] of Object.entries(mods)) if (name !== 'tracker' && MODULE.test(name) && plain(sec)) walk(sec, [name], CC.UNIT_DEPTH, map);
    return map;
  };
  CC.unflatModules = function (map) {
    const out = {};
    const entries = [...map].filter(([k]) => k.startsWith('m|')).map(([k, v]) => { try { return [JSON.parse(k.slice(2)), JSON.parse(v)]; } catch (e) { return null; } })
      .filter((x) => x && Array.isArray(x[0]) && x[0].length >= 2 && MODULE.test(x[0][0]) && x[0][0] !== 'tracker' && x[0].slice(1).every(safeKey))
      .sort((a, b) => a[0].length - b[0].length); // shorter paths first, so a deeper unit is never overwritten by an empty parent
    for (const [p, val] of entries) {
      let o = out;
      for (let i = 0; i < p.length - 1; i++) { if (!plain(o[p[i]])) o[p[i]] = {}; o = o[p[i]]; }
      const last = p[p.length - 1];
      if (plain(val) && !Object.keys(val).length && plain(o[last])) continue;
      o[last] = val;
    }
    return CC.checkModules(out);
  };
  // Three-way merge of the units of every section except the Tracker's. Clashes keep the local unit.
  CC.mergeModules = function (base, local, remote) {
    const B = CC.flatModules(base), L = CC.flatModules(local), R = CC.flatModules(remote);
    const m = new Map();
    for (const k of new Set([...B.keys(), ...L.keys(), ...R.keys()])) {
      const b = B.get(k), l = L.get(k), r = R.get(k);
      const v = l === r ? l : l === b ? r : l;
      if (v !== undefined) m.set(k, v);
    }
    return CC.unflatModules(m);
  };
  // A plain-language label for a unit, for the "which one is right?" prompt.
  const LABEL = { atelier: 'Atelier', lists: 'Lists', submersibles: 'Submersibles' };
  CC.describeUnit = function (id, local, remote, nameOf) {
    let p = []; try { p = JSON.parse(id.slice(2)); } catch (e) { /* shown as is */ }
    const mod = LABEL[p[0]] || p[0];
    let what = mod + ': ' + p.slice(1).join(' › ');
    if (p[0] === 'atelier' && p[1] === 'chars') what = 'Atelier: crafter stats of ' + (nameOf ? nameOf(p[2]) : p[2]);
    else if (p[0] === 'atelier' && p[1] === 'unassigned') what = 'Atelier: crafter stats not yet given to a character';
    else if (p[0] === 'atelier' && p[1] === 'saved') { let n = ''; try { n = JSON.parse(local || remote || '{}').name || ''; } catch (e) { /* none */ } what = 'Atelier: saved macro' + (n ? ' “' + n + '”' : ''); }
    else if (p[0] === 'atelier' && p[1] === 'prefs') what = 'Atelier setting: ' + p[2];
    else if (p[0] === 'submersibles' && ['fcs', 'subs', 'trips'].includes(p[1])) {
      let n = ''; try { n = JSON.parse(local || remote || '{}').name || ''; } catch (e) { /* none */ }
      what = 'Submersibles: ' + { fcs: 'free company', subs: 'submarine', trips: 'logged voyage' }[p[1]] + (n ? ' “' + n + '”' : '');
    } else if (p[0] === 'submersibles' && p[1] === 'settings') what = 'Submersibles settings';
    return { who: '', what, local: local == null ? '(removed)' : 'the version on this device', remote: remote == null ? '(removed)' : 'the version on the other device' };
  };

  // ------------------------------------------------------------------ storage
  function openDb() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('no IndexedDB'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
  }
  let memory = { [KEY]: null, [REV]: null };
  const parseText = (text) => { if (text == null) return null; try { return JSON.parse(text); } catch (e) { return text; } };
  CC.kind = 'memory';

  // Read the save as stored (not checked): { raw, rev, kind }.
  CC.read = async function () {
    try {
      const db = await openDb();
      const out = await new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readonly'), s = t.objectStore(STORE);
        const a = s.get(KEY), b = s.get(REV);
        t.oncomplete = () => resolve({ raw: a.result == null ? null : a.result, rev: b.result == null ? null : b.result, kind: 'indexeddb' });
        t.onerror = () => reject(t.error);
      });
      db.close();
      CC.kind = 'indexeddb';
      return out;
    } catch (e) { /* fall through */ }
    try {
      const raw = localStorage.getItem(LS);
      CC.kind = 'localstorage';
      return { raw: parseText(raw), rev: localStorage.getItem(LS + '-rev'), kind: 'localstorage' };
    } catch (e) { /* fall through */ }
    CC.kind = 'memory';
    return { raw: memory[KEY], rev: memory[REV], kind: 'memory' };
  };

  // One read-merge-write. fn(raw, rev, put) runs synchronously inside the transaction and returns the save to write,
  // or null to write nothing; put(key, value) stores an extra record (a rescue or safety copy) in the same transaction.
  // An error thrown by fn cancels the whole transaction and reaches the caller. Resolves to { rev, wrote, kind }.
  const newRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const parse = parseText; // unreadable text goes to fn as is
  CC.transact = async function (fn) {
    const rev = newRev();
    let db = null;
    try { db = await openDb(); } catch (e) { db = null; }
    if (db) {
      let fnError = null;
      try {
        const out = await new Promise((resolve, reject) => {
          const t = db.transaction(STORE, 'readwrite'), s = t.objectStore(STORE);
          let result = null;
          const a = s.get(KEY), b = s.get(REV);
          b.onsuccess = () => {
            const cur = b.result == null ? null : b.result;
            let doc;
            try { doc = fn(a.result == null ? null : a.result, cur, (k, v) => s.put(v, k)); } catch (e) { fnError = e; t.abort(); return; }
            if (doc) { s.put(doc, KEY); s.put(rev, REV); result = { rev, wrote: true, kind: 'indexeddb' }; } else result = { rev: cur, wrote: false, kind: 'indexeddb' };
          };
          t.oncomplete = () => resolve(result);
          t.onerror = () => reject(fnError || t.error);
          t.onabort = () => reject(fnError || t.error || new Error('The save was interrupted.'));
        });
        CC.kind = 'indexeddb';
        if (out.wrote) announce(out.rev);
        return out;
      } finally { db.close(); }
    }
    let raw, cur, lsOk = true;
    try { raw = localStorage.getItem(LS); cur = localStorage.getItem(LS + '-rev'); } catch (e) { lsOk = false; }
    if (lsOk) {
      const extras = [];
      const doc = fn(parse(raw), cur, (k, v) => extras.push([k, v]));
      CC.kind = 'localstorage';
      for (const [k, v] of extras) localStorage.setItem(LS + ':' + k, typeof v === 'string' ? v : JSON.stringify(v));
      if (!doc) return { rev: cur, wrote: false, kind: 'localstorage' };
      localStorage.setItem(LS, JSON.stringify(doc)); localStorage.setItem(LS + '-rev', rev); // a full storage throws: the caller reports "not saved"
      announce(rev);
      return { rev, wrote: true, kind: 'localstorage' };
    }
    const doc = fn(memory[KEY], memory[REV], () => {});
    CC.kind = 'memory';
    if (!doc) return { rev: memory[REV], wrote: false, kind: 'memory' };
    memory = { [KEY]: JSON.parse(JSON.stringify(doc)), [REV]: rev };
    return { rev, wrote: true, kind: 'memory' };
  };
  // Store one extra record (a rescue copy) outside a save.
  CC.putExtra = (key, value) => CC.transact((raw, rev, put) => { put(key, value); return null; });
  // List the extra records whose keys start with a prefix (for tests and the rescue download).
  CC.extras = async function (prefix) {
    try {
      const db = await openDb();
      const out = await new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readonly'), r = t.objectStore(STORE).getAllKeys();
        t.oncomplete = () => resolve(r.result.filter((k) => String(k).startsWith(prefix)));
        t.onerror = () => reject(t.error);
      });
      db.close();
      return out;
    } catch (e) {
      try { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(LS + ':' + prefix)) out.push(k.slice(LS.length + 1)); } return out; } catch (e2) { return []; }
    }
  };
  CC.resetMemory = () => { memory = { [KEY]: null, [REV]: null }; };

  // Write one module's section. known = { rev, base }: the stamp and the section this page last read or wrote. If
  // another page saved since, the section is merged with the stored one (units changed only elsewhere are kept).
  // own = { moved, device }: this module's entries in the device-only parts. Resolves to { rev, section, merged }.
  CC.writeSection = async function (name, section, known, own) {
    let out = null;
    const r = await CC.transact((raw, rev) => {
      const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc(); // an unreadable or newer save throws: nothing is written over it
      const stored = doc.modules[name];
      let sec = CC.checkModules({ [name]: section })[name] || {};
      let merged = false;
      if (stored && rev !== (known && known.rev)) {
        sec = CC.mergeModules({ [name]: (known && known.base) || {} }, { [name]: sec }, { [name]: stored })[name] || {};
        merged = true;
      }
      doc.modules[name] = sec;
      if (own && own.moved) doc.moved[name] = own.moved;
      if (own && own.device) doc.device[name] = own.device;
      doc.updated = Date.now();
      out = { section: sec, merged, doc };
      return doc;
    });
    return Object.assign({ rev: r.rev }, out);
  };

  // ------------------------------------------------------------------ other pages
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('eveniunt-command-center') : null;
  if (channel && typeof channel.unref === 'function') channel.unref();
  CC.PAGE_ID = Math.random().toString(36).slice(2);
  const listeners = [];
  CC.onChange = (fn) => { listeners.push(fn); };
  if (channel) channel.onmessage = (e) => { if (e.data && e.data.page !== CC.PAGE_ID) listeners.forEach((fn) => { try { fn(e.data); } catch (err) { /* a listener's problem stays its own */ } }); };
  function announce(rev) { if (channel) try { channel.postMessage({ page: CC.PAGE_ID, rev }); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------------ compression (cloud copy)
  async function pipe(bytes, stream, limit) {
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
    const parts = []; let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (limit && n > limit) { try { await reader.cancel(); } catch (e) { /* ignore */ } throw new Error('too large'); }
      parts.push(value);
    }
    const out = new Uint8Array(n); let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
  // text → deflate-raw → base64, and back (limit: stop past this many bytes unpacked)
  CC.pack = async (text) => b64(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')));
  CC.unpack = async (data, limit) => new TextDecoder().decode(await pipe(unb64(String(data)), new DecompressionStream('deflate-raw'), limit || 256 * 1024 * 1024));
  CC.byteLength = (text) => new TextEncoder().encode(text).length;
})();
