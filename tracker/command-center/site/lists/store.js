// Eveniunt Command Center, Lists: the edit functions (work item W7 of docs/lists-spec.md, sections 4 and 7).
// Plain script: attaches to LISTS.store (after engine.js), no DOM, no storage, no clock of its own (the time and the random source
// come in through `ctx`), so the page and Node tests share it. It needs save.js (CC.checkModules) so that the unit texts it keeps for
// undo are exactly the texts the save stores.
//
// Every edit takes the section as read and returns { section, entry } (entry null when nothing changed) or { error: 'plain line' }
// and changes nothing. A new section is always built from a copy; the input is never changed. `entry` is the undo record (D16):
//   { label, units: [{ g, k, before, after }] }   g the group, k the unit's key, before and after the unit's JSON text or null (absent).
// Undo (S.undo) puts the `before` texts back only when every unit is still exactly its `after` text, and returns `expect` for
// CC.writeSection (LI5), which checks the same inside the save's own transaction.
// The size limits of section 4 (D20) are enforced here and only here; data already over a limit stays and can be edited and shrunk.
// Groups are written in sorted key order, so that an undo gives the section back byte for byte.
(function () {
  'use strict';
  var L = (globalThis.LISTS = globalThis.LISTS || {});
  var S = (L.store = {});
  var GROUPS = ['lists', 'targets', 'ways', 'owners', 'have'];
  var LIMITS = S.limits = { lists: 200, targets: 2000, steps: 20, have: 20000 };
  var LINES = S.lines = {
    lists: 'You already have 200 lists, the most this app keeps. Remove one to make another.',
    targets: 'This list is full: 2,000 items.',
    steps: 'This list has 20 steps, the most it can have.',
    have: 'Your stock is full: 20,000 different items. Clear one first.',
    undo: 'Undo was not done: this was changed again since, here or on another device. Nothing was changed.'
  };
  var WAYS = ['vendor', 'craft', 'gather', 'trade', 'market', 'have'];
  var QUALITIES = ['nq', 'hq', 'coll'];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function text(v) { return v === undefined ? null : JSON.stringify(v); }
  function emptySection() { return { v: 1, lists: {}, targets: {}, ways: {}, owners: {}, have: {}, prefs: {} }; }
  // the section as the save stores it (field order, dropped bad fields); groups in sorted key order
  function norm(sec) {
    var src = sec && typeof sec === 'object' ? clone(sec) : {};
    GROUPS.forEach(function (g) {
      var o = src[g] && typeof src[g] === 'object' ? src[g] : {}, s = {};
      Object.keys(o).sort().forEach(function (k) { s[k] = o[k]; });
      src[g] = s;
    });
    var CC = globalThis.CC;
    if (!CC || !CC.checkModules) throw new Error('lists store: save.js is not loaded');
    return CC.checkModules({ lists: src }).lists || emptySection();
  }
  S.norm = norm;
  S.emptySection = emptySection;

  // a session on one copy: draft is edited, touch() names every unit it changes, finish() builds the entry
  function session(sec) {
    var orig = norm(sec), draft = clone(orig), touched = [], seen = {};
    return {
      orig: orig, d: draft,
      touch: function (g, k) { var id = g + '\u0000' + k; if (!seen[id]) { seen[id] = 1; touched.push([g, k]); } },
      finish: function (label) {
        var out = norm(draft), units = [];
        touched.forEach(function (t) {
          var b = text(orig[t[0]][t[1]]), a = text(out[t[0]][t[1]]);
          if (b !== a) units.push({ g: t[0], k: t[1], before: b, after: a });
        });
        if (!units.length) return { section: orig, entry: null };
        return { section: out, entry: { label: label, units: units } };
      }
    };
  }
  function fail(line) { return { error: line }; }
  function nonEmpty(o) { return Object.keys(o).length > 0; }

  // ------------------------------------------------------------------------------------------------ ids
  function usedIds(sec) {
    var u = {};
    Object.keys(sec.lists).forEach(function (id) { u[id] = 1; var st = sec.lists[id].steps || {}; Object.keys(st).forEach(function (s) { u[s] = 1; }); });
    Object.keys(sec.targets).forEach(function (k) { u[k.slice(k.indexOf('.') + 1)] = 1; u[k.slice(0, k.indexOf('.'))] = 1; });
    return u;
  }
  function source(ctx) {
    if (ctx && typeof ctx.rand === 'function') return ctx.rand;
    var c = globalThis.crypto;
    if (c && typeof c.getRandomValues === 'function') return function (a) { return c.getRandomValues(a); };
    throw new Error('lists store: no random source');
  }
  // 12 characters of 0-9a-z from the random source (rejection sampling: no bias), never one already used in the section
  S.newId = function (sec, ctx) {
    var used = usedIds(sec), rand = source(ctx), A = '0123456789abcdefghijklmnopqrstuvwxyz';
    for (var tries = 0; tries < 100; tries++) {
      var id = '';
      while (id.length < 12) {
        var b = new Uint8Array(24); rand(b);
        for (var i = 0; i < b.length && id.length < 12; i++) if (b[i] < 252) id += A.charAt(b[i] % 36);
      }
      if (!used[id]) return id;
    }
    throw new Error('lists store: could not make a new id');
  };
  function nowOf(ctx) { var t = ctx && ctx.now; return typeof t === 'number' && isFinite(t) && t > 0 ? Math.floor(t) : Date.now(); }
  function cleanName(s) { return typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : ''; }
  function whole(v) { if (v === '' || v == null || typeof v === 'boolean') return null; var n = Number(v); return isFinite(n) ? Math.floor(n) : null; }
  var NO_LIST = 'That list is not here any more.', NO_ITEM = 'That wanted item is not here any more.';
  var OWNER = /^(c[1-8]|u)$/, ITEMKEY = /^[1-9][0-9]{0,7}$/;
  function ownerOf(h) { return h && h.charId ? h.charId : 'u'; }
  S.ownerOf = ownerOf;

  // ------------------------------------------------------------------------------------------------ lists and steps
  // o: { name, charId, stamp }. Returns { section, entry, id }.
  S.newList = function (sec, o, ctx) {
    var s = session(sec), d = s.d, name = cleanName(o && o.name);
    if (!name) return fail('Give the list a name.');
    var charId = o && o.charId ? String(o.charId) : null;
    if (charId !== null && !/^c[1-8]$/.test(charId)) return fail('Choose one of your characters, or none.');
    if (Object.keys(d.lists).length >= LIMITS.lists) return fail(LINES.lists);
    var id = S.newId(d, ctx), order = 0;
    Object.keys(d.lists).forEach(function (k) { order = Math.max(order, (d.lists[k].order || 0) + 1); });
    var h = { name: name, charId: charId, order: Math.min(order, 9999), made: nowOf(ctx) };
    if (o && typeof o.stamp === 'string' && o.stamp) h.data = o.stamp.slice(0, 60);
    d.lists[id] = h; s.touch('lists', id);
    var r = s.finish('Made the list “' + name + '”'); r.id = id; return r;
  };
  S.renameList = function (sec, listId, name) {
    var s = session(sec), d = s.d, h = d.lists[listId], n = cleanName(name);
    if (!h) return fail(NO_LIST);
    if (!n) return { section: s.orig, entry: null, kept: true }; // clearing a name keeps the old one
    h.name = n; s.touch('lists', listId);
    return s.finish('Renamed the list “' + n + '”');
  };
  // the list's header and every wanted item of it
  S.removeList = function (sec, listId) {
    var s = session(sec), d = s.d, h = d.lists[listId];
    if (!h) return fail(NO_LIST);
    Object.keys(d.targets).forEach(function (k) { if (k.slice(0, k.indexOf('.')) === listId) { delete d.targets[k]; s.touch('targets', k); } });
    delete d.lists[listId]; s.touch('lists', listId);
    return s.finish('Removed the list “' + (h.name || 'Untitled list') + '”');
  };
  S.addStep = function (sec, listId, name, ctx) {
    var s = session(sec), d = s.d, h = d.lists[listId];
    if (!h) return fail(NO_LIST);
    var steps = h.steps || {}, ids = Object.keys(steps);
    if (ids.length >= LIMITS.steps) return fail(LINES.steps);
    var id = S.newId(d, ctx), n = 0;
    ids.forEach(function (k) { n = Math.max(n, (steps[k].n || 0) + 1); });
    steps[id] = { name: cleanName(name) || 'Step ' + (ids.length + 1), n: Math.min(n, 9999) };
    h.steps = steps; s.touch('lists', listId);
    var r = s.finish('Added a step to “' + (h.name || 'Untitled list') + '”'); r.id = id; return r;
  };

  // ------------------------------------------------------------------------------------------------ wanted items
  function targetOf(s, listId, targetId) { var k = listId + '.' + targetId; return s.d.targets[k] ? { k: k, t: s.d.targets[k] } : null; }
  // o: { item, recipe, qty, hq, coll, make, step }. Returns { section, entry, id, key }.
  S.addTarget = function (sec, listId, o, ctx) {
    var s = session(sec), d = s.d, h = d.lists[listId];
    if (!h) return fail(NO_LIST);
    var item = whole(o && o.item);
    if (item === null || item < 1 || item > 1e7) return fail('Choose an item to add.');
    var qty = o.qty === undefined ? 1 : whole(o.qty);
    if (qty === null || qty < 1 || qty > 99999) return fail('The amount can be 1 to 99,999.');
    var recipe = whole(o.recipe); if (recipe === null || recipe < 0 || recipe > 1e7) recipe = 0;
    var n = 0, p = listId + '.';
    Object.keys(d.targets).forEach(function (k) { if (k.slice(0, p.length) === p) n++; });
    if (n >= LIMITS.targets) return fail(LINES.targets);
    var id = S.newId(d, ctx), t = { item: item, recipe: recipe, qty: qty };
    if (o.hq) t.hq = true; if (o.coll) t.coll = true; if (o.make) t.make = true;
    if (typeof o.step === 'string' && h.steps && h.steps[o.step]) t.step = o.step;
    t.at = nowOf(ctx);
    d.targets[listId + '.' + id] = t; s.touch('targets', listId + '.' + id);
    var r = s.finish('Added a wanted item'); r.id = id; r.key = listId + '.' + id; return r;
  };
  // A cleared or invalid amount keeps the old amount (only Remove removes).
  S.setQty = function (sec, listId, targetId, qty) {
    var s = session(sec), f = targetOf(s, listId, targetId);
    if (!f) return fail(NO_ITEM);
    var n = whole(qty);
    if (n === null || n < 1) return { section: s.orig, entry: null, kept: true };
    if (n > 99999) return fail('The amount can be 1 to 99,999.');
    f.t.qty = n;
    if (f.t.crafted !== undefined && f.t.crafted > n) f.t.crafted = n; // crafted stays within the amount
    s.touch('targets', f.k);
    return s.finish('Changed an amount');
  };
  // flag: 'hq', 'coll' or 'make'; every combination is kept as stored (E6)
  S.setFlag = function (sec, listId, targetId, flag, on) {
    var s = session(sec), f = targetOf(s, listId, targetId);
    if (!f) return fail(NO_ITEM);
    if (flag !== 'hq' && flag !== 'coll' && flag !== 'make') return fail('Unknown setting.');
    if (on) f.t[flag] = true; else delete f.t[flag];
    s.touch('targets', f.k);
    return s.finish('Changed a setting of a wanted item');
  };
  S.setStep = function (sec, listId, targetId, stepId) {
    var s = session(sec), f = targetOf(s, listId, targetId), h = s.d.lists[listId];
    if (!f) return fail(NO_ITEM);
    if (stepId) { if (!h || !h.steps || !h.steps[stepId]) return fail('That step is not here any more.'); f.t.step = stepId; } else delete f.t.step;
    s.touch('targets', f.k);
    return s.finish('Moved a wanted item to another step');
  };
  S.setDone = function (sec, listId, targetId, done) {
    var s = session(sec), f = targetOf(s, listId, targetId);
    if (!f) return fail(NO_ITEM);
    if (done) f.t.done = true; else delete f.t.done;
    s.touch('targets', f.k);
    return s.finish(done ? 'Marked a wanted item finished' : 'Marked a wanted item not finished');
  };
  S.removeTarget = function (sec, listId, targetId) {
    var s = session(sec), f = targetOf(s, listId, targetId);
    if (!f) return fail(NO_ITEM);
    delete s.d.targets[f.k]; s.touch('targets', f.k);
    return s.finish('Removed a wanted item');
  };

  // ------------------------------------------------------------------------------------------------ stock
  function haveOf(d, owner, item) { var e = d.have[owner + '.' + item]; return { nq: (e && e.nq) || 0, hq: (e && e.hq) || 0, coll: (e && e.coll) || 0 }; }
  // store one stock count of the owner; all zeros removes the unit. refuseNew: apply the limit on a new unit.
  function putHave(s, owner, item, e, refuseNew) {
    var k = owner + '.' + item, d = s.d, zero = !e.nq && !e.hq && !e.coll;
    if (zero) { if (d.have[k] !== undefined) { delete d.have[k]; s.touch('have', k); } return null; }
    if (d.have[k] === undefined && refuseNew && Object.keys(d.have).length >= LIMITS.have) return LINES.have;
    d.have[k] = { nq: e.nq, hq: e.hq, coll: e.coll }; s.touch('have', k);
    return null;
  }
  function checkStock(owner, item, quality) {
    if (!OWNER.test(String(owner)) || !ITEMKEY.test(String(item))) return 'Unknown item.';
    if (QUALITIES.indexOf(quality) < 0) return 'Unknown quality.';
    return null;
  }
  // "I have": sets the typed count of one quality (the player types what they have). A blank or invalid number keeps the old count.
  S.setHave = function (sec, owner, item, quality, n) {
    var bad = checkStock(owner, item, quality); if (bad) return fail(bad);
    var s = session(sec), v = whole(n);
    if (v === null) return { section: s.orig, entry: null, kept: true };
    if (v < 0 || v > 999999) return fail('A count can be 0 to 999,999.');
    var e = haveOf(s.d, owner, item);
    if (e[quality] === v) return { section: s.orig, entry: null };
    e[quality] = v;
    var err = putHave(s, owner, item, e, true); if (err) return fail(err);
    return s.finish('Changed what you have');
  };
  // the minus and plus buttons
  S.adjustHave = function (sec, owner, item, quality, delta) {
    var bad = checkStock(owner, item, quality); if (bad) return fail(bad);
    var d = norm(sec), cur = haveOf(d, owner, item)[quality], next = Math.max(0, Math.min(999999, cur + delta));
    return S.setHave(sec, owner, item, quality, next);
  };
  // "Bought it" (D15): o = { owner, item, quality, units, makeKeys }: adds exactly `units` to the stock (LISTS.bought) and switches
  // "Must be crafted by me" off on the named wanted items. Nothing else changes.
  S.bought = function (sec, o) {
    var bad = checkStock(o.owner, o.item, o.quality); if (bad) return fail(bad);
    var s = session(sec), d = s.d, u = whole(o.units);
    if (u === null || u < 1) return fail('Enter how many you bought: 1 or more.');
    var have = {}; have[o.item] = haveOf(d, o.owner, o.item);
    var after = L.bought(have, o.item, u, o.quality)[o.item];
    if (after[o.quality] > 999999) return fail('A count can be 0 to 999,999.');
    var err = putHave(s, o.owner, o.item, { nq: after.nq || 0, hq: after.hq || 0, coll: after.coll || 0 }, true); if (err) return fail(err);
    (o.makeKeys || []).forEach(function (k) { var t = d.targets[k]; if (t && t.make) { delete t.make; s.touch('targets', k); } });
    return s.finish('Bought it');
  };

  // ------------------------------------------------------------------------------------------------ ways
  // patch: { by, recipe, hq, offer }; a field set to null (or false for hq) is cleared; a way with no field left is removed.
  S.setWay = function (sec, owner, item, patch) {
    if (!OWNER.test(String(owner)) || !ITEMKEY.test(String(item))) return fail('Unknown item.');
    var s = session(sec), k = owner + '.' + item, w = s.d.ways[k] ? clone(s.d.ways[k]) : {};
    patch = patch || {};
    if ('by' in patch) { if (patch.by == null) delete w.by; else if (WAYS.indexOf(patch.by) >= 0) w.by = patch.by; else return fail('Unknown way.'); }
    if ('recipe' in patch) { var r = whole(patch.recipe); if (patch.recipe == null) delete w.recipe; else if (r !== null && r >= 1 && r <= 1e7) w.recipe = r; else return fail('Unknown recipe.'); }
    if ('hq' in patch) { if (patch.hq) w.hq = true; else delete w.hq; }
    if ('offer' in patch) { if (patch.offer == null) delete w.offer; else if (/^[0-9]{1,9}\.[0-9]{1,9}\.[0-9]{1,9}$/.test(patch.offer)) w.offer = patch.offer; else return fail('Unknown offer.'); }
    if (nonEmpty(w)) s.d.ways[k] = w; else delete s.d.ways[k];
    s.touch('ways', k);
    return s.finish('Changed how an item is got');
  };
  // "Use the usual order": the way and its offer are cleared
  S.clearWay = function (sec, owner, item) {
    if (!OWNER.test(String(owner)) || !ITEMKEY.test(String(item))) return fail('Unknown item.');
    var s = session(sec), k = owner + '.' + item;
    delete s.d.ways[k]; s.touch('ways', k);
    return s.finish('Went back to the usual way of getting an item');
  };

  // ------------------------------------------------------------------------------------------------ engine state, record, hand-in
  // { have, targets, ways } of one owner in the engine's shape: targets keyed '<listId>.<targetId>', every list of that owner
  S.stateOf = function (sec, owner) {
    var d = norm(sec), have = {}, targets = {}, ways = {}, p = owner + '.';
    Object.keys(d.have).forEach(function (k) { if (k.slice(0, p.length) === p) have[k.slice(p.length)] = haveOf(d, owner, k.slice(p.length)); });
    Object.keys(d.ways).forEach(function (k) { if (k.slice(0, p.length) === p) ways[k.slice(p.length)] = clone(d.ways[k]); });
    Object.keys(d.targets).forEach(function (k) { var l = d.lists[k.slice(0, k.indexOf('.'))]; if (l && ownerOf(l) === owner) targets[k] = clone(d.targets[k]); });
    return { have: have, targets: targets, ways: ways };
  };
  // write what the engine returned: the changed stock counts and wanted items of one owner
  function apply(s, owner, state, res, refuseNew) {
    var err = null;
    var items = {}; Object.keys(state.have || {}).forEach(function (i) { items[i] = 1; }); Object.keys(res.have || {}).forEach(function (i) { items[i] = 1; });
    Object.keys(items).forEach(function (i) {
      var a = state.have[i] || {}, b = res.have[i] || {};
      var e0 = { nq: a.nq || 0, hq: a.hq || 0, coll: a.coll || 0 }, e1 = { nq: b.nq || 0, hq: b.hq || 0, coll: b.coll || 0 };
      if (JSON.stringify(e0) === JSON.stringify(e1)) return;
      err = putHave(s, owner, i, e1, refuseNew) || err;
    });
    Object.keys(res.targets || {}).forEach(function (key) {
      var t0 = state.targets[key], t1 = res.targets[key];
      if (!t0 || !t1 || JSON.stringify(t0) === JSON.stringify(t1) || !s.d.targets[key]) return;
      s.d.targets[key] = clone(t1); s.touch('targets', key);
    });
    return err;
  }
  // "Made" (D26, E12): stock and `crafted` in one change; never refused, so the stock-count limit does not apply to it.
  // o = { line, times, quality, targets: { '<listId>.<targetId>': n } }. Returns { section, entry, short }.
  S.record = function (sec, data, owner, plan, o) {
    var s = session(sec), state = S.stateOf(sec, owner), res = L.record(data, state, plan, o);
    apply(s, owner, state, res, false);
    var r = s.finish('Recorded a craft'); r.short = res.short; return r;
  };
  // "This step is handed in" (E19, D28): its wanted items are finished and only their own stock is taken out.
  S.finishStep = function (sec, owner, plan, listId, stepId) {
    var s = session(sec), state = S.stateOf(sec, owner), res = L.finishStep(plan, state, listId, stepId);
    apply(s, owner, state, res, false);
    return s.finish('Handed in a step');
  };

  // ------------------------------------------------------------------------------------------------ the combined view's selection
  // The ticked lists that still exist: an id that is no longer a list (a list that moved to a new id in a sync, LY6) is left out on
  // the page, never written back; the player ticks the moved list again.
  S.combined = function (sec) {
    var d = norm(sec), c = (d.prefs && d.prefs.combined) || {};
    return Object.keys(c).filter(function (id) { return c[id] && d.lists[id]; });
  };
  // Ticks or unticks one list; the stored selection is rewritten with the lists that exist.
  S.tickCombined = function (sec, listId, on) {
    var s = session(sec), d = s.d;
    if (!d.lists[listId]) return fail(NO_LIST);
    var c = {};
    S.combined(d).forEach(function (id) { c[id] = 1; });
    if (on) c[listId] = 1; else delete c[listId];
    var before = d.prefs && d.prefs.combined;
    if (JSON.stringify(before || {}) === JSON.stringify(c)) return { section: s.orig, entry: null };
    d.prefs = d.prefs || {}; d.prefs.combined = c;
    var k = 'combined'; s.touch('prefs', k);
    return s.finish('Changed the lists in the combined view');
  };

  // ------------------------------------------------------------------------------------------------ undo (D16, E20)
  // Puts the `before` text of every unit of the entry back, only when every unit is still exactly its `after` text.
  // Returns { section, expect } (expect is what CC.writeSection checks again inside the save's own transaction) or { error }.
  S.undo = function (sec, entry) {
    var cur = norm(sec), draft = clone(cur), expect = {};
    for (var i = 0; i < entry.units.length; i++) {
      var u = entry.units[i];
      if (text(cur[u.g][u.k]) !== u.after) return fail(LINES.undo);
    }
    entry.units.forEach(function (u) {
      if (u.before === null) delete draft[u.g][u.k]; else draft[u.g][u.k] = JSON.parse(u.before);
      expect['m|' + JSON.stringify(['lists', u.g, u.k])] = u.after;
    });
    return { section: norm(draft), expect: expect };
  };
})();
