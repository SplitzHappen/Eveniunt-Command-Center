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
  //   subs:  { <subId>: { fcId, slot, name, rank, expIntoRank, expExact, parts: [hull, stern, bow, bridge], voyage: { sentAt, route, returnAt, calcAt, gameSaid } | null } }
  //   expExact: rank and expIntoRank are what the game showed at the last return (typed), not an estimate.
  //   trips: { <tripId>: { s, t, r, back, calc, said, items: [[itemId, qty]], newSectors, rankAfter, rankCalc, grade, expBase, expGot } }
  //   grade: the voyage grade the owner noted (C, B, A, S, SS); expBase: the route's base experience; expGot: the experience
  //   really gained, from the rank and experience the owner typed (owner request 2026-11-15: learn what each grade gives).
  //   rankCalc: the least rank worked out on return; rankAfter: the rank kept (the owner's correction when the game showed more).
  //   calcAt / calc: the worked-out return time, kept beside the game's typed time as evidence for the formula (design 3.2).
  //   settings: { prefs: { sort, grouping (auto, sub, fc, fleet), night (always, quiet), quietHours, window, priceWorld } }
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
      out.subs[id] = keep({ fcId: s.fcId, slot: s.slot, name: subName(s.name, 20), rank: intIn(s.rank, 1, 145), expIntoRank: intIn(s.expIntoRank, 0, 1e9), expExact: s.expExact === true && intIn(s.rank, 1, 145) !== undefined && intIn(s.expIntoRank, 0, 1e9) !== undefined ? true : undefined,
        parts: subParts(s.parts), voyage: subVoyage(s.voyage) });
    }
    if (plain(sec.trips)) for (const [id, t] of Object.entries(sec.trips)) {
      if (!plain(t) || !safeKey(t.s) || time(t.t) === undefined) continue;
      const items = Array.isArray(t.items) ? t.items.filter((x) => Array.isArray(x) && x.length === 2 && intIn(x[0], 1, 1e7) !== undefined && intIn(x[1], 1, 1e6) !== undefined).map((x) => [x[0], x[1]]) : [];
      out.trips[id] = keep({ s: t.s, t: t.t, r: sectors(t.r, 5) || [], back: time(t.back), calc: time(t.calc), said: subName(t.said, 40), items, newSectors: sectors(t.newSectors) || [], rankAfter: intIn(t.rankAfter, 1, 145), rankCalc: intIn(t.rankCalc, 1, 145),
        grade: ['C', 'B', 'A', 'S', 'SS'].includes(t.grade) ? t.grade : undefined, expBase: intIn(t.expBase, 1, 1e9), expGot: intIn(t.expGot, 1, 1e9) });
    }
    const p = plain(sec.settings) && plain(sec.settings.prefs) ? sec.settings.prefs : null;
    if (p) out.settings.prefs = keep({ sort: ['fc', 'time'].includes(p.sort) ? p.sort : undefined, grouping: ['auto', 'sub', 'fc', 'fleet'].includes(p.grouping) ? p.grouping : undefined, night: ['always', 'quiet'].includes(p.night) ? p.night : undefined,
      quietHours: hhmm(p.quietHours), window: hhmm(p.window), priceWorld: subName(p.priceWorld, 32) });
    return out;
  }
  CC.checkSubmersibles = checkSubmersibles;
  // The Command Center's own settings (2026-11-12): settings every module uses, such as notifications at night.
  //   settings: { notify: { night: 'always' | 'quiet', quietHours: { from, to } } }
  function checkSettings(sec) {
    const out = {};
    const n = plain(sec.notify) ? sec.notify : null;
    if (n) out.notify = keep({ night: ['always', 'quiet'].includes(n.night) ? n.night : undefined, quietHours: hhmm(n.quietHours) });
    return out;
  }
  CC.checkSettings = checkSettings;
  // The Lists section (docs/lists-spec.md, section 4). Always the whole frame, in this key order, so once written it never
  // disappears; no arrays anywhere (D23); NO size limit (D20): every entry whose fields are valid is kept, however many there are.
  //   lists:   { <listId>: { name, charId, order, made, data, steps: { <stepId>: { name, n } } } }
  //   targets: { '<listId>.<targetId>': { item, recipe, qty, hq, coll, make, crafted, step, done, at } }
  //   ways:    { '<owner>.<itemId>': { by, recipe, hq, offer } }       owners: { <owner>: { order } }
  //   have:    { '<owner>.<itemId>': { nq, hq, coll } }                prefs: { priceWorld, hideDone, combined: { <listId>: 1 } }
  // An entry is dropped only when it is malformed (a bad id, or a wanted item without its item or amount (a missing recipe reads as 0)); a bad field is
  // left out, never repaired. A step id that is not in the list's header, a count of zeros, a crafted count above the amount, an
  // owner's order text that is not five words: all kept as stored (the engine and the page read them; the checker never deletes).
  const LIST_ID = /^[a-z0-9]{4,16}$/;
  const OWNER_ID = /^(c[1-8]|u)$/;
  const ITEM_ID = /^[1-9][0-9]{0,7}$/;
  const WAYS = ['vendor', 'craft', 'gather', 'trade', 'market', 'have'];
  const dotKey = (k, left, right) => { const i = typeof k === 'string' ? k.indexOf('.') : -1; return i > 0 && left.test(k.slice(0, i)) && right.test(k.slice(i + 1)); };
  function checkLists(sec) {
    const out = { v: 1, lists: {}, targets: {}, ways: {}, owners: {}, have: {}, prefs: {} };
    if (plain(sec.lists)) for (const [id, h] of Object.entries(sec.lists)) {
      if (!LIST_ID.test(id) || !plain(h)) continue;
      let steps;
      if (plain(h.steps)) {
        steps = {};
        for (const [sid, st] of Object.entries(h.steps)) if (LIST_ID.test(sid) && plain(st)) steps[sid] = keep({ name: subName(st.name, 60), n: intIn(st.n, 0, 9999) });
      }
      out.lists[id] = keep({ name: subName(h.name, 60), charId: typeof h.charId === 'string' && /^c[1-8]$/.test(h.charId) ? h.charId : (h.charId === null ? null : undefined),
        order: intIn(h.order, 0, 9999), made: time(h.made), data: subName(h.data, 60), steps });
    }
    if (plain(sec.targets)) for (const [key, t] of Object.entries(sec.targets)) {
      if (!dotKey(key, LIST_ID, LIST_ID) || !plain(t)) continue;
      const item = intIn(t.item, 1, 1e7), recipe = t.recipe === undefined ? 0 : intIn(t.recipe, 0, 1e7), qty = intIn(t.qty, 1, 99999);
      if (item === undefined || recipe === undefined || qty === undefined) continue; // a wanted item without an item or an amount is not guessed
      out.targets[key] = keep({ item, recipe, qty, hq: t.hq === true ? true : undefined, coll: t.coll === true ? true : undefined, make: t.make === true ? true : undefined,
        crafted: intIn(t.crafted, 0, 99999), step: typeof t.step === 'string' && LIST_ID.test(t.step) ? t.step : undefined, done: t.done === true ? true : undefined, at: time(t.at) });
    }
    if (plain(sec.ways)) for (const [key, w] of Object.entries(sec.ways)) {
      if (!dotKey(key, OWNER_ID, ITEM_ID) || !plain(w)) continue;
      out.ways[key] = keep({ by: WAYS.includes(w.by) ? w.by : undefined, recipe: intIn(w.recipe, 1, 1e7), hq: w.hq === true ? true : undefined,
        offer: typeof w.offer === 'string' && /^[0-9]{1,9}\.[0-9]{1,9}\.[0-9]{1,9}$/.test(w.offer) ? w.offer : undefined });
    }
    if (plain(sec.owners)) for (const [id, o] of Object.entries(sec.owners)) if (OWNER_ID.test(id) && plain(o)) out.owners[id] = keep({ order: typeof o.order === 'string' ? o.order : undefined });
    if (plain(sec.have)) for (const [key, h] of Object.entries(sec.have)) {
      if (!dotKey(key, OWNER_ID, ITEM_ID) || !plain(h)) continue;
      out.have[key] = keep({ nq: intIn(h.nq, 0, 999999), hq: intIn(h.hq, 0, 999999), coll: intIn(h.coll, 0, 999999) });
    }
    const p = plain(sec.prefs) ? sec.prefs : {};
    out.prefs = keep({ priceWorld: subName(p.priceWorld, 32), hideDone: typeof p.hideDone === 'boolean' ? p.hideDone : undefined, combined: undefined });
    if (plain(p.combined)) { const c = {}; for (const [id, v] of Object.entries(p.combined)) if (LIST_ID.test(id) && (v === 1 || v === true)) c[id] = 1; out.prefs.combined = c; }
    return out;
  }
  CC.checkLists = checkLists;
  const CHECK = { atelier: checkAtelier, lists: checkLists, submersibles: checkSubmersibles, settings: checkSettings };
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
  // A free company changed on both sides (owner decision 2026-11-19, docs/submersibles-merge-spec.md): merged field by
  // field. key: 'm|' + JSON path; b, l, r: the unit as JSON text, or undefined. Returns null (the caller keeps its
  // generic rule) unless the key is a free company and both sides are objects; else { local, remote, asks } where the
  // two texts carry the same merged discoveries, slots and position and differ only in the fields named in asks.
  // Discoveries: the union of both sides, nothing is removed. Slots: the higher. Position: the lower. Name, world and
  // linked character: changed on one side only is taken; changed differently on both is asked.
  CC.mergeUnit = function (key, b, l, r) {
    let p; try { p = JSON.parse(String(key).slice(2)); } catch (e) { return null; }
    if (!Array.isArray(p) || p.length !== 3 || p[0] !== 'submersibles' || p[1] !== 'fcs' || !safeKey(p[2]) || !String(key).startsWith('m|')) return null;
    const parse = (t) => { if (typeof t !== 'string') return undefined; try { const o = JSON.parse(t); return plain(o) ? o : undefined; } catch (e) { return undefined; } };
    const L = parse(l), R = parse(r), B = parse(b);
    if (!L || !R) return null;
    const blank = (v) => v === undefined || v === null || v === '';
    const same = (x, y) => (blank(x) && blank(y)) || JSON.stringify(x) === JSON.stringify(y);
    const outL = {}, outR = {}, asks = [];
    for (const f of ['name', 'world', 'charId', 'order', 'unlockedSlots']) {
      const lv = L[f], rv = R[f], bv = B ? B[f] : undefined;
      let v, split = false;
      if (same(lv, rv)) v = blank(lv) && blank(rv) ? (lv === null || rv === null ? null : lv === '' || rv === '' ? '' : undefined) : lv; // both blank: whatever both sides had stays (null, then an empty text, then nothing)
      else if (B && same(lv, bv)) v = rv;
      else if (B && same(rv, bv)) v = lv;
      else if (f === 'order') v = lv == null ? rv : rv == null ? lv : Math.min(lv, rv); // a side without a position takes the other's
      else if (f === 'unlockedSlots') v = Math.max(lv ?? 1, rv ?? 1);
      else if (!B && blank(lv) !== blank(rv)) v = blank(lv) ? rv : lv;
      else split = true;
      if (split) { outL[f] = lv; outR[f] = rv; asks.push(f); } else { outL[f] = v; outR[f] = v; }
    }
    if (Array.isArray(L.discovered) || Array.isArray(R.discovered)) {
      const u = [...new Set([...(Array.isArray(L.discovered) ? L.discovered : []), ...(Array.isArray(R.discovered) ? R.discovered : [])])]
        .filter((x) => Number.isInteger(x)).sort((x, y) => x - y);
      outL.discovered = u; outR.discovered = u.slice();
    }
    const text = (o) => JSON.stringify(CC.checkSubmersibles({ fcs: { x: o } }).fcs.x);
    const local = text(outL), remote = text(outR);
    return { local, remote, asks: local === remote ? [] : asks };
  };
  // Three-way merge of the units of every section except the Tracker's. Clashes keep the local unit; a free company
  // changed on both sides is merged by CC.mergeUnit.
  CC.mergeModules = function (base, local, remote) {
    const B = CC.flatModules(base), L = CC.flatModules(local), R = CC.flatModules(remote);
    const m = new Map();
    for (const k of new Set([...B.keys(), ...L.keys(), ...R.keys()])) {
      const b = B.get(k), l = L.get(k), r = R.get(k);
      let v = l === r ? l : l === b ? r : l;
      if (l !== undefined && r !== undefined && l !== r && l !== b && r !== b) { const u = CC.mergeUnit(k, b, l, r); if (u) v = u.local; }
      if (v !== undefined) m.set(k, v);
    }
    return CC.unflatModules(m);
  };
  // A plain-language label for a unit, for the "which one is right?" prompt.
  const LABEL = { atelier: 'Atelier', lists: 'Lists', submersibles: 'Submersibles', settings: 'Settings' };
  // Lists labels (spec section 4, "Wording"): the sync's pass puts listName in integrity; items appear by number.
  function listsLabel(p, local, remote, nameOf, integrity) {
    const parse = (t) => { if (typeof t !== 'string') return null; try { const o = JSON.parse(t); return plain(o) ? o : null; } catch (e) { return null; } };
    const L = parse(local), R = parse(remote), any = L || R || {};
    const who = (id) => (id === 'u' ? 'lists without a character' : (nameOf ? nameOf(id) : id));
    const gone = (t) => (t == null ? '(removed)' : null);
    const listName = integrity && typeof integrity.listName === 'string' && integrity.listName ? '“' + integrity.listName + '”' : '';
    const owner = typeof p[2] === 'string' ? p[2].split('.')[0] : '';
    const itemNo = typeof p[2] === 'string' ? p[2].split('.')[1] : '';
    let what = null, side = null;
    if (p[1] === 'lists' && p.length === 3) what = 'Lists: list ' + (listName || (any.name ? '“' + any.name + '”' : ''));
    else if (p[1] === 'targets' && p.length === 3) {
      const t = L || R || {}, bits = [];
      if (t.item !== undefined) bits.push('item ' + t.item);
      if (t.qty !== undefined) bits.push(t.qty + ' wanted');
      what = 'Lists: ' + (listName ? listName + ': ' : '') + 'a wanted item' + (bits.length ? ' (' + bits.join(', ') + ')' : '');
    } else if (p[1] === 'ways' && p.length === 3) what = 'Lists: how ' + who(owner) + ' gets item ' + itemNo;
    else if (p[1] === 'owners' && p.length === 3) what = 'Lists: ' + who(p[2]) + '\'s order of ways to get items';
    else if (p[1] === 'have' && p.length === 3) {
      what = 'Lists: the amount ' + who(owner) + ' has of item ' + itemNo;
      const amount = (o) => (o ? [['nq', 'normal'], ['hq', 'high-quality'], ['coll', 'collectable']].filter((f) => o[f[0]]).map((f) => o[f[0]] + ' ' + f[1]).join(', ') || '0' : null);
      side = [amount(L), amount(R)];
    }
    if (!what) return null;
    if (p[1] === 'owners' && p[2] === 'u') what = 'Lists: the order of ways to get items for lists without a character';
    return { who: '', what, local: gone(local) || (side && side[0]) || 'the version on this device', remote: gone(remote) || (side && side[1]) || 'the version on the other device' };
  }
  CC.describeUnit = function (id, local, remote, nameOf, integrity) {
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
      if (integrity && p[1] === 'fcs') { const names = (integrity.names && integrity.names.length ? integrity.names : integrity.linked).map((x) => '“' + x + '”'); what += '; choosing its removal also removes ' + (names.length === 1 ? 'its submarine ' : 'its submarines ') + names.join(', ') + (names.length === 1 ? ' and its logged voyages' : ' and their logged voyages') + '; keeping the free company keeps ' + (names.length === 1 ? 'it' : 'them') + ' too'; }
      if (!integrity && p[1] === 'fcs' && local != null && remote != null) {
        let L = null, R = null; try { L = JSON.parse(local); R = JSON.parse(remote); } catch (e) { /* today's wording */ }
        if (plain(L) && plain(R)) {
          const none = '(none)', show = (v) => (v === undefined || v === null || v === '' ? none : String(v));
          const FIELDS = [['name', 'name', (v) => '“' + show(v) + '”'], ['world', 'world', show], ['charId', 'character', (v) => (v ? (nameOf ? nameOf(v) : v) : none)],
            ['unlockedSlots', 'unlocked slots', show], ['order', 'position in the list', show], ['discovered', 'discovered sectors', (v) => (Array.isArray(v) ? v.join(', ') : none)]];
          const diff = FIELDS.filter((f) => JSON.stringify(L[f[0]] === undefined ? null : L[f[0]]) !== JSON.stringify(R[f[0]] === undefined ? null : R[f[0]]));
          if (diff.length) {
            const labels = diff.map((f) => f[1]), joined = labels.length === 1 ? labels[0] : labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1];
            const side = (o) => diff.map((f) => f[1] + ' ' + f[2](o[f[0]])).join(', '); // the dialog names the side ("This device:", "Other device:")
            const nameDiffers = diff.some((f) => f[0] === 'name'), both = [...new Set([L.name, R.name].filter((x) => x !== undefined && x !== null && x !== ''))].map((x) => '“' + x + '”').join(' / ');
            const sameList = JSON.stringify(L.discovered === undefined ? null : L.discovered) === JSON.stringify(R.discovered === undefined ? null : R.discovered);
            what = 'Submersibles: free company' + (nameDiffers ? (both ? ' ' + both : '') : n ? ' “' + n + '”' : '') + ': the ' + joined + (labels.length === 1 ? ' differs' : ' differ') + ' between your devices' + (sameList ? '; its discovered sectors are already combined and stay the same whichever you choose' : '');
            return { who: '', what, local: side(L), remote: side(R) };
          }
        }
      }
    } else if (p[0] === 'submersibles' && p[1] === 'settings') what = 'Submersibles settings';
    else if (p[0] === 'lists') { const l = listsLabel(p, local, remote, nameOf, integrity); if (l) return l; }
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
  CC.transact = async function (fn, options) {
    options = options || {};
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
            if (options.guard && !options.guard()) { result = { rev: cur, wrote: false, kind: 'indexeddb', cancelled: true }; return; }
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
      if (options.guard && !options.guard()) return { rev: cur, wrote: false, kind: 'localstorage', cancelled: true };
      const doc = fn(parse(raw), cur, (k, v) => extras.push([k, v]));
      CC.kind = 'localstorage';
      for (const [k, v] of extras) localStorage.setItem(LS + ':' + k, typeof v === 'string' ? v : JSON.stringify(v));
      if (!doc) return { rev: cur, wrote: false, kind: 'localstorage' };
      localStorage.setItem(LS, JSON.stringify(doc)); localStorage.setItem(LS + '-rev', rev); // a full storage throws: the caller reports "not saved"
      announce(rev);
      return { rev, wrote: true, kind: 'localstorage' };
    }
    if (options.guard && !options.guard()) return { rev: memory[REV], wrote: false, kind: 'memory', cancelled: true };
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

  // A free company is bare when no submarine of sec belongs to it, it has no world, one slot (or none noted) and the start
  // sectors only: exactly what the main Settings creates (the same test as FLEET.isBare). Pure.
  function subBare(sec, id, f) {
    if (!f) return false;
    const subs = (sec && sec.subs) || {};
    if (Object.keys(subs).some((k) => subs[k] && subs[k].fcId === id)) return false;
    return !f.world && (f.unlockedSlots == null || f.unlockedSlots === 1)
      && (f.discovered == null || (Array.isArray(f.discovered) && f.discovered.length === 2 && f.discovered[0] === 1 && f.discovered[1] === 2));
  }
  // True when fc, stored in sec under fcId, would be removed by the automatic duplicate fold (FLEET.foldFcs): fc is bare in
  // sec, has a character, and another company of that character in sec is not bare, or is bare and sorts before it (lower
  // order || 0, then lower id by plain < comparison, as foldFcs does). Pure.
  // The fold's own order: lower order || 0, then lower id by plain < comparison.
  const foldBefore = (a, fa, z, fz) => ((fa.order || 0) - (fz.order || 0)) || (a < z ? -1 : a > z ? 1 : 0);
  CC.foldLoser = function (sec, fcId, fc) {
    if (!fc || typeof fc.charId !== 'string' || !subBare(sec, fcId, fc)) return false;
    const fcs = (sec && sec.fcs) || {};
    return Object.keys(fcs).some((id) => {
      const o = fcs[id];
      if (id === fcId || !o || o.charId !== fc.charId) return false;
      return !subBare(sec, id, o) || foldBefore(id, o, fcId, fc) < 0;
    });
  };
  // The id of the company that beats fc (stored under fcId) in the duplicate fold of sec: the first non-empty company of its
  // character, else the first empty one, in the fold's own order; null when none. Call only when CC.foldLoser is true.
  CC.foldWinner = function (sec, fcId, fc) {
    const fcs = (sec && sec.fcs) || {};
    const ids = Object.keys(fcs).filter((id) => id !== fcId && fcs[id] && fc && typeof fc.charId === 'string' && fcs[id].charId === fc.charId)
      .sort((x, y) => foldBefore(x, fcs[x], y, fcs[y]));
    return ids.find((id) => !subBare(sec, id, fcs[id])) || ids[0] || null;
  };
  // True when some company-and-slot holds two or more submarines in sec and one of them is not already in that slot in stored.
  function slotAdded(sec, stored) {
    const slots = {};
    Object.keys((sec && sec.subs) || {}).forEach((id) => {
      const s = sec.subs[id]; if (!s || s.slot == null) return;
      (slots[s.fcId + '|' + s.slot] = slots[s.fcId + '|' + s.slot] || []).push(id);
    });
    return Object.keys(slots).some((k) => slots[k].length > 1 && slots[k].some((id) => {
      const t = ((stored && stored.subs) || {})[id], s = sec.subs[id];
      return !(t && t.fcId === s.fcId && t.slot === s.slot);
    }));
  }

  // The submarines of each company-and-slot, as { 'fcId|slot': [subId, ...] } with every list sorted.
  function slotSets(sec) {
    const out = {};
    Object.keys((sec && sec.subs) || {}).sort().forEach((id) => {
      const s = sec.subs[id]; if (!s || s.slot == null) return;
      (out[s.fcId + '|' + s.slot] = out[s.fcId + '|' + s.slot] || []).push(id);
    });
    return out;
  }

  // The stale-write rules of the Lists section (spec section 4; "no new violation"). base: the page's copy when it last read or
  // wrote; local: what it sends; stored: the stored section (the empty frame when there is none); result: what would be written.
  // Order: LI2, LI1, LI4, LI5; LI3 (a unit the page did not change stays as stored has it) is the merge itself.
  const LI_LIST = 'This list was removed on another device or in another tab.';
  const LI_ITEM = 'This item was removed from the list on another device or in another tab.';
  const LI_KEPT = 'This was changed on another device or in another tab, so it was not removed.';
  const LI_SINCE = 'This was changed on another device or in another tab since.';
  function listsRules(base, local, stored, result, known, merged) {
    const grp = (o, g) => (o && plain(o[g]) ? o[g] : {});
    const J = JSON.stringify, listOf = (k) => k.split('.')[0];
    // LI2 No new orphan: a wanted item in the result without its list header, unless stored already held it that way.
    for (const k of Object.keys(grp(result, 'targets')))
      if (!grp(result, 'lists')[listOf(k)] && !(grp(stored, 'targets')[k] && !grp(stored, 'lists')[listOf(k)])) throw new Error(LI_LIST);
    if (merged) {
      // ... and a wanted item the page added or changed whose list is in base and gone from stored.
      for (const [k, t] of Object.entries(grp(local, 'targets')))
        if (J(t) !== J(grp(base, 'targets')[k]) && grp(base, 'lists')[listOf(k)] && !grp(stored, 'lists')[listOf(k)]) throw new Error(LI_LIST);
      // LI1 Nothing comes back: a header, then a wanted item (its list still stored), in base, absent from stored, present in the result.
      for (const id of Object.keys(grp(base, 'lists'))) if (!grp(stored, 'lists')[id] && grp(result, 'lists')[id]) throw new Error(LI_LIST);
      for (const k of Object.keys(grp(base, 'targets')))
        if (!grp(stored, 'targets')[k] && grp(result, 'targets')[k] && grp(stored, 'lists')[listOf(k)]) throw new Error(LI_ITEM);
      // LI4 Nothing changed elsewhere is removed (D21): a unit in base that the page removed and stored holds with another value.
      for (const g of ['lists', 'targets', 'ways', 'owners', 'have', 'prefs'])
        for (const k of Object.keys(grp(base, g)))
          if (grp(local, g)[k] === undefined && grp(stored, g)[k] !== undefined && J(grp(stored, g)[k]) !== J(grp(base, g)[k])) throw new Error(LI_KEPT);
    }
    // LI5 A conditional write (D16): known.expect = { <unit key: 'm|' + JSON path>: <unit as JSON text, or null for absent> }.
    if (known && plain(known.expect)) {
      const S = CC.flatModules({ lists: stored });
      for (const [k, text] of Object.entries(known.expect)) {
        const cur = S.has(k) ? S.get(k) : null;
        if (cur !== (text === undefined ? null : text)) throw new Error(LI_SINCE);
      }
    }
  }

  // Write one module's section. known = { rev, base }: the stamp and the section this page last read or wrote. If
  // another page saved since, the section is merged with the stored one (units changed only elsewhere are kept).
  // own = { moved, device }: this module's entries in the device-only parts. Resolves to { rev, section, merged }.
  CC.writeSection = async function (name, section, known, own) {
    let out = null;
    const r = await CC.transact((raw, rev) => {
      const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc(); // an unreadable or newer save throws: nothing is written over it
      // Lists (spec section 4, "The gate"): the merge and every refusal run whenever the stamp differs, and a missing stored
      // section is read as the empty frame, so a stale page can never write its old copy back whole.
      const stored = name === 'lists' ? (doc.modules[name] || CC.checkLists({})) : doc.modules[name];
      let sec = CC.checkModules({ [name]: section })[name] || {};
      let merged = false, local = sec, base = {};
      if (stored && rev !== (known && known.rev)) {
        base = (known && known.base) || {};
        local = sec;
        sec = CC.mergeModules({ [name]: base }, { [name]: local }, { [name]: stored })[name] || {};
        merged = true;
        // A delayed Submersibles edit can add a submarine after another tab's automatic fold removed
        // its still-bare free company. Keep the relation valid by moving that newly edited submarine
        // to the deterministic surviving company for the same character. If this was not a bare
        // duplicate cleanup (or the destination slot is occupied), refuse the write visibly instead
        // of resurrecting an explicitly removed company or persisting an orphan.
        if (name === 'submersibles') {
          const b = base, l = local, m = sec;
          const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
          const isBareBase = (id) => subBare(b, id, (b.fcs || {})[id]);
          // A company this write would bring back after the stored copy lost it: only the automatic duplicate fold
          // may have removed it (CC.foldLoser); anything else was removed on purpose and is not stored again.
          for (const fcId of Object.keys(b.fcs || {})) {
            if ((stored.fcs || {})[fcId] || !(m.fcs || {})[fcId]) continue;
            if (!(isBareBase(fcId) && CC.foldLoser(stored, fcId, b.fcs[fcId]))) throw new Error('This free company was removed on another device or in another tab.');
          }
          // A submarine or logged voyage removed in the stored copy is not stored again by a page that still held it.
          [['subs', 'This submarine was removed on another device or in another tab.'], ['trips', 'This logged voyage was removed on another device or in another tab.']].forEach(([kind, text]) => {
            for (const id of Object.keys(b[kind] || {})) if (!(stored[kind] || {})[id] && (m[kind] || {})[id]) throw new Error(text);
          });
          // A slot this page rearranged (its set of submarines differs between its copy and what it sends) is stored as
          // the page showed it; if the merge made it something else, another page changed it too: refused.
          {
            const B = slotSets(b), L = slotSets(l), M = slotSets(m);
            const t = (x, k) => (x[k] || []).join();
            for (const k of new Set(Object.keys(B).concat(Object.keys(L))))
              if (t(B, k) !== t(L, k) && t(L, k) !== t(M, k)) throw new Error('That submarine slot changed elsewhere.');
          }
          for (const [subId, sub] of Object.entries(l.subs || {})) {
            if (!sub || !m.subs || !m.subs[subId] || same(sub, (b.subs || {})[subId])) continue;
            const fcId = sub.fcId;
            if ((m.fcs || {})[fcId] || !(l.fcs || {})[fcId]) continue;
            if (!isBareBase(fcId)) throw new Error('The free company changed while its submarine was being saved.');
            // Only a company the automatic clean-up would remove again is moved from; it goes to the company that beats it.
            // Anything else was removed on purpose: nothing is written.
            if (!CC.foldLoser(stored, fcId, b.fcs[fcId])) throw new Error('This free company was removed on another device or in another tab.');
            const target = CC.foldWinner(stored, fcId, b.fcs[fcId]);
            if (!target || !(m.fcs || {})[target]) throw new Error('The free company was removed while its submarine was being saved.');
            if (Object.values(m.subs || {}).some((other) => other !== m.subs[subId] && other.fcId === target && other.slot === sub.slot))
              throw new Error('That submarine slot changed elsewhere.');
            m.subs[subId].fcId = target;
          }
          // One submarine changed in two tabs (owner decision 2026-11-20): when its stored record, this page's copy and what
          // this page sends are all different from each other (removed here counts as different), the save is refused whole.
          for (const id of Object.keys(b.subs || {})) {
            const rv = (stored.subs || {})[id]; if (!rv) continue;
            const t = [JSON.stringify(b.subs[id]), (l.subs || {})[id] === undefined ? undefined : JSON.stringify(l.subs[id]), JSON.stringify(rv)];
            if (t[0] !== t[1] && t[0] !== t[2] && t[1] !== t[2]) throw new Error('This submarine changed in another tab or on another device.');
          }
        }
      }
      if (name === 'lists') listsRules(CC.checkLists(plain(base) ? clean(base, 0) : {}), local, stored, sec, known, merged);
      // A submarine never points at a company this write leaves out, unless it already did in the stored copy.
      if (name === 'submersibles') {
        const rs = stored || {};
        for (const [id, sub] of Object.entries(sec.subs || {})) {
          const f = sub && sub.fcId;
          if (f === undefined || (sec.fcs || {})[f]) continue;
          const was = (rs.subs || {})[id];
          if (was && was.fcId === f && !(rs.fcs || {})[f]) continue;
          throw new Error((rs.fcs || {})[f] ? 'This free company has a submarine that was saved in another tab or on another device, so nothing was removed.' : 'The free company changed while its submarine was being saved.');
        }
      }
      // One company-and-slot never gains a second submarine through a write: refuse when a slot would hold two or more
      // records and one of them is not already in that slot in the stored copy (a stored duplicate stays writable).
      if (name === 'submersibles' && slotAdded(sec, stored || {})) throw new Error('That submarine slot changed elsewhere.');
      doc.modules[name] = sec;
      if (own && own.moved) doc.moved[name] = own.moved;
      if (own && own.device) doc.device[name] = own.device;
      doc.updated = Date.now();
      out = { section: sec, merged, doc };
      return doc;
    });
    return Object.assign({ rev: r.rev }, out);
  };

  // Run a deterministic section cleanup against the save as it exists inside the same read/write transaction.
  // The fold decision is never based on a page's stale snapshot. A null/empty result does not write.
  CC.foldSection = async function (name, fold) {
    if (!MODULE.test(name) || typeof fold !== 'function') throw new Error('invalid section fold');
    let out = null;
    const r = await CC.transact((raw) => {
      const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc();
      const current = doc.modules[name];
      if (!current) return null;
      const result = fold(current);
      if (!result || !Array.isArray(result.removed) || !result.removed.length) return null;
      doc.modules[name] = CC.checkModules({ [name]: result.section })[name] || {};
      doc.updated = Date.now();
      out = { section: doc.modules[name], removed: result.removed.slice(), doc };
      return doc;
    });
    return Object.assign({ rev: r.rev, wrote: r.wrote, kind: r.kind }, out || {});
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
