// Eveniunt Command Center, Lists module page (work items W6 to W9 of docs/lists-spec.md): loads the one save and the data, shows "Your lists",
// makes and removes lists, and on a list's tabs To get, To craft and Wanted (and the combined view) plans every list of a character together, adds
// items, changes amounts and flags, finishes and removes them, takes the typed stock ("I have", minus, plus, "Have all"), "Made", "Bought it",
// "Get it by", the order of ways and the steps' hand-in, and shows Undo. W9 adds market prices (the shared price service, kept on this device only),
// the next window of a timed node, and the notice that the game data changed since a list was last checked. Every change goes through LISTS.store (the edit functions), and the page writes one save
// at a time, as the Submersibles page does. Nothing is read from the game: the player types what they have.
(function () {
  'use strict';
  var CC = window.CC, S = window.LISTS.store, E = window.LISTS;
  var main = document.getElementById('view');
  // SH: the page's working state. sec: the saved section as last read or written (null when none is stored); rev and base: what the next write is
  // measured against (as in subs.js). queue: edits waiting for the write in flight. undo: the last 20 changes of this visit, newest first.
  var SH = { problem: null, chars: [], tracker: null, log: null, sec: null, rev: null, base: null, queue: [], busy: null, reloadLater: false, undo: [], note: '', rest: null,
    view: { list: null, form: false, confirm: null, bought: null, mode: 'bought', search: '', tab: 'wanted', open: {}, step: null, hide: false, sheet: false, combined: false, combinedOwner: null } };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  // ------------------------------------------------------------------------------------------------ preferences and small edits (W9)
  // prefs.hideDone and prefs.priceWorld live in the save (spec section 4); prices never do. These edits write one unit and add no Undo entry.
  function prefEdit(s, key, val) {
    var orig = S.norm(s), d = clone(orig);
    d.prefs = d.prefs || {};
    if (val === undefined || val === null || val === '' || val === false) delete d.prefs[key]; else d.prefs[key] = val;
    var out = S.norm(d);
    if (JSON.stringify(out.prefs[key]) === JSON.stringify(orig.prefs[key])) return { section: orig, entry: null };
    return { section: out, expect: {} };
  }
  function setListStamp(s, id) {
    var orig = S.norm(s);
    if (!orig.lists[id]) return { error: 'This list was removed on another device or in another tab.' };
    var d = clone(orig); d.lists[id].data = String(DATA.stamp || '').slice(0, 60);
    var out = S.norm(d);
    if (JSON.stringify(out.lists[id]) === JSON.stringify(orig.lists[id])) return { section: orig, entry: null };
    return { section: out, expect: {} };
  }
  function syncPrefs() { SH.view.hide = !!(SH.sec && SH.sec.prefs && SH.sec.prefs.hideDone); }

  // ------------------------------------------------------------------------------------------------ market prices (W9, spec section 6)
  // The shared price service with Lists' own two keys and query. A stored price is [cheapest listing, recent average, world, last upload]; the
  // page judges it (a price counts only when it is a positive whole number). Prices live on this device only, never in the save.
  var REGION_OF = { Elemental: 'Japan', Gaia: 'Japan', Mana: 'Japan', Meteor: 'Japan', Aether: 'North-America', Crystal: 'North-America', Dynamis: 'North-America', Primal: 'North-America', Chaos: 'Europe', Light: 'Europe', Shadow: 'Europe', Materia: 'Oceania' };
  var PLACES = ['North-America', 'Europe', 'Japan', 'Oceania'].concat(Object.keys(REGION_OF).sort());
  var PR = { busy: false, error: null, errScope: null, partial: false, tried: {}, running: null, queued: null, want: [], dirty: false };
  var PC = { raw: undefined, scope: null, c: null };
  function posInt(n) { return typeof n === 'number' && isFinite(n) && n > 0 && Math.floor(n) === n; }
  function readReply(x) {
    if (!x || typeof x !== 'object') return null; // no usable reply: recorded as "no market data", never as 0
    var ls = Array.isArray(x.listings) ? x.listings : [], l = ls[0] || null;
    var hist = (Array.isArray(x.recentHistory) ? x.recentHistory : []).map(function (h) { return h && h.pricePerUnit; }).filter(posInt);
    var avg = hist.length ? Math.round(hist.reduce(function (a, b) { return a + b; }, 0) / hist.length) : Math.round(+x.averagePrice || +x.currentAveragePrice || 0);
    return [l ? (l.pricePerUnit === undefined ? 0 : l.pricePerUnit) : null, isFinite(avg) && avg > 0 ? avg : 0, l ? String(l.worldName || x.worldName || '') : '', +x.lastUploadTime > 0 ? +x.lastUploadTime : 0];
  }
  var PS = window.PRICE.create({ cacheKey: 'eveniunt-lists-prices', triedKey: 'eveniunt-lists-prices-tried', query: '?listings=1&entries=20', read: readReply,
    tradable: function (id) { return !!DATA && (itemFlags(id) & 1) !== 0; } });
  function sharedScope() { // the place the Tracker's market page uses: one world, one data centre, or (the default) the region
    try {
      var L = ((JSON.parse(localStorage.getItem('eveniunt-tracker-ui') || '{}') || {}).ui || {}).live || {}, region = REGION_OF[L.dc];
      if (L.mscope === 'world' && L.world) return L.world;
      if (L.dc) return L.mscope === 'dc' || !region ? L.dc : region;
    } catch (e) { /* none */ }
    return 'North-America';
  }
  function priceScope() { return (SH.sec && SH.sec.prefs && SH.sec.prefs.priceWorld) || sharedScope(); }
  function cache() {
    var scope = priceScope(), raw = null;
    try { raw = localStorage.getItem('eveniunt-lists-prices'); } catch (e) { /* private window */ }
    if (PC.raw === raw && PC.scope === scope) return PC.c;
    PC.raw = raw; PC.scope = scope; PC.c = PS.cached(scope); PC.map = null;
    return PC.c;
  }
  // { itemId: gil } for the engine: only a cheapest listing that is a positive whole number
  function priceMap() {
    var c = cache();
    if (!c || !c.prices) return null;
    if (!PC.map) { PC.map = {}; Object.keys(c.prices).forEach(function (id) { var v = c.prices[id]; if (Array.isArray(v) && posInt(v[0])) PC.map[id] = v[0]; }); }
    return PC.map;
  }
  function failNow() { return PR.error && PR.errScope === priceScope() ? PR.error : null; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtClock(t, now) {
    var d = new Date(t), n = new Date(now), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); }, diff = Math.round((day(d) - day(n)) / 86400000);
    return diff === 0 ? hm : diff === -1 ? 'yesterday ' + hm : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + hm;
  }
  function gilText(n) { return Number(n).toLocaleString('en-US') + ' gil'; }
  // What one item's price is, case by case (spec section 6; unknown is never 0): { text, gil (counted price or null), seen (fetch time or 0), kept }
  function priceInfo(item, now) {
    var c = cache(), v = c && c.prices ? c.prices[item] : undefined, bad = failNow(), place = priceScope();
    var sorry = 'Market prices could not be fetched; ';
    if (Array.isArray(v)) {
      var min = v[0], seen = PS.seenAt(c, item);
      if (posInt(min)) {
        return { gil: min, seen: seen, kept: !!bad, text: gilText(min) + ' before tax, ' + place + (v[2] ? ' (cheapest on ' + v[2] + ')' : '') + ', ' + (bad ? 'last seen ' : 'fetched ') + fmtClock(seen, now) + (bad ? '. ' + sorry + 'showing the last known market prices.' : '') };
      }
      if (min === null && posInt(v[1])) return { gil: null, seen: 0, text: 'No listings now; recent sales about ' + gilText(v[1]) };
      return { gil: null, seen: 0, text: 'No market price' };
    }
    if (c && c.none && c.none[item] != null) return { gil: null, seen: 0, text: 'No market data for this item' };
    if (bad) return { gil: null, seen: 0, text: 'Price not fetched. ' + sorry + 'showing no market prices.' };
    return { gil: null, seen: 0, text: PR.busy ? 'Fetching the price…' : 'Price not fetched' };
  }
  function priceRow(ln, now) {
    var pi = priceInfo(ln.item, now);
    return '<p class="price-line" data-price="' + (pi.gil || '') + '">' + esc(pi.text) + '</p>';
  }
  // "about N gil for M items; K items without a price" over the market rows the chosen lists share (spec section 6)
  function priceTotal(V, keys, sums, now) {
    var gil = 0, n = 0, none = [], seen = [], c = cache();
    keys.forEach(function (k) {
      var ln = V.plan.lines[k], pi = priceInfo(ln.item, now);
      if (pi.gil) { gil += pi.gil * sums[k].got; n++; seen.push(ln.item); } else none.push(itemName(ln.item));
    });
    var oldest = PS.oldest(c, seen), part = PR.partial && PR.errScope === priceScope() ? ' Some market prices could not be fetched; those items show their last known price.' : '';
    return '<p class="price-total" data-gil="' + gil + '" data-priced="' + n + '" data-unpriced="' + none.length + '">Buying on the market, before tax: about ' + gilText(gil) + ' for ' + n + ' item' + (n === 1 ? '' : 's') +
      (none.length ? '; ' + none.length + ' item' + (none.length === 1 ? '' : 's') + ' without a price (' + esc(none.join(', ')) + ')' : '') + (oldest ? ' (prices seen ' + esc(fmtClock(oldest, now)) + ')' : '') + '.' + esc(part) + '</p>';
  }
  function placeBar() {
    var cur = (SH.sec && SH.sec.prefs && SH.sec.prefs.priceWorld) || '';
    return '<p class="row lists-prices"><label>Market prices from <select data-f="priceWorld"><option value="">' + esc(priceScope()) + ' (shared place setting)</option>' +
      PLACES.map(function (d) { return '<option' + (cur === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label> ' + btn('Refresh prices', 'prices') + '</p>';
  }
  // One automatic attempt per 15 minutes per place per device (kept in device storage, so a reload honours it too); Refresh tries at once. A Refresh or a change
  // of place during a fetch is not dropped: one follow-up is kept and runs when the running fetch ends.
  function loadPrices(force) {
    var ids = PR.want || [];
    if (!ids.length || !DATA) return;
    var scope = priceScope(), now = Date.now();
    if (PR.busy) { if (force || scope !== PR.running) PR.queued = { force: !!(force || (PR.queued && PR.queued.force)) }; return; }
    var c = PS.cached(scope);
    PR.tried = PS.triedLoad(PR.tried);
    if (!force && (!PS.mayTry(PR.tried, scope, now, false) || (c && !PS.needed(c, ids, now).length))) return;
    PR.busy = true; PR.running = scope; PS.triedSave(scope, now, PR.tried);
    PS.fetchPrices(scope, ids, !!force).then(function (r) { if (scope === priceScope()) { PR.errScope = scope; PR.error = r.error || null; PR.partial = !!r.partial; } })
      .catch(function (e) { if (scope === priceScope()) { PR.errScope = scope; PR.error = (e && e.message) || 'no connection'; } })
      .then(function () {
        PR.busy = false; PR.running = null;
        var q = PR.queued; PR.queued = null;
        if (q) loadPrices(q.force);
        var ae = document.activeElement;
        if (ae && main.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) PR.dirty = true; // a redraw would take the focus from a field being typed in
        else render();
      });
  }

  // ------------------------------------------------------------------------------------------------ timed nodes (W9)
  var ET_HOUR = 175000, ET_DAY = 24 * ET_HOUR;
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function etClock(ms) { return pad2(Math.floor((ms % ET_DAY) / ET_HOUR)) + ':' + pad2(Math.floor((ms % ET_HOUR) / ET_HOUR * 60)); }
  function realDur(ms) { var m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
  function windowText(hours, minutes, now) {
    var w = E.nextWindow(hours, minutes, now);
    if (!w) return '';
    return w.open ? 'open now, closes ' + etClock(w.closesAt) + ' Eorzea time, in ' + realDur(w.closesAt - now) : 'opens ' + etClock(w.opensAt) + ' Eorzea time, in ' + realDur(w.opensAt - now);
  }
  function windowRow(ln, now) {
    if (!ln.timed) return '';
    var t = windowText(ln.timed.hours, ln.timed.minutes, now);
    return t ? '<p class="w-window" data-hours="' + esc(ln.timed.hours.join(',')) + '" data-mins="' + ln.timed.minutes + '">' + esc(t) + '</p>' : '';
  }
  function tickWindows() {
    var now = Date.now();
    [].forEach.call(main.querySelectorAll('.w-window'), function (el) { var t = windowText(el.getAttribute('data-hours').split(',').map(Number), +el.getAttribute('data-mins'), now); if (t && el.textContent !== t) el.textContent = t; });
  }

  // ------------------------------------------------------------------------------------------------ the patch notice (W9, spec section 6)
  function stampParts(s) { var m = /^(\d+)\.(\d+)(\S*)/.exec(String(s || '')); return m ? [+m[1], +m[2], m[3]] : null; }
  function stampNewer(a, b) { var x = stampParts(a), y = stampParts(b); if (!x || !y) return false; return x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2]; }
  function ingText(row) { var p = row[5].map(function (g) { return g[1] + ' ' + itemName(g[0]); }); return p.length > 1 ? p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1] : p[0] || 'nothing'; }
  function ingMap(row) { var o = {}; row[5].forEach(function (g) { o[g[0]] = (o[g[0]] || 0) + g[1]; }); return o; }
  // The entries from the list's stamp to the newest, chained by from and to; null when the stamp is not in the chain.
  function chainFrom(stampText) {
    var ents = DATA.changes || [], used = {}, cur = stampText, out = [];
    for (;;) {
      var i = -1; ents.forEach(function (e, n) { if (i < 0 && !used[n] && e && e.from === cur) i = n; });
      if (i < 0) break;
      used[i] = 1; out.push(ents[i]); cur = ents[i].to;
    }
    return out.length ? out : null;
  }
  // { lines: [...] } the differences, { plain: true } when the details are not available, or null when nothing is to be said
  function patchNotice(h, id, sc) {
    var stampText = h && h.data;
    if (!stampText || !DATA.stamp || stampText === DATA.stamp || stampNewer(stampText, DATA.stamp)) return null;
    var chain = chainFrom(stampText);
    if (!chain) return { plain: true };
    var old = Object.assign({}, DATA.recipes), seen = {};
    chain.forEach(function (e) {
      Object.keys(e.recipes || {}).forEach(function (r) { if (!seen[r]) { seen[r] = 1; if (e.recipes[r][0] == null) delete old[r]; else old[r] = e.recipes[r][0]; } });
      Object.keys(e.gone || {}).forEach(function (r) { if (!seen[r]) { seen[r] = 1; old[r] = e.gone[r]; } });
    });
    var lists = [{ id: id, steps: h.steps || {}, targets: targetsOf(sc, id).filter(function (k) { return !sc.targets[k].done; }).map(function (k) { var t = clone(sc.targets[k]); t.id = k.slice(id.length + 1); return t; }) }];
    var oldTree = E.tree(Object.assign({}, DATA, { recipes: old }), lists), newTree = E.tree(DATA, lists), lines = [];
    Object.keys(seen).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      var o = old[r], n = DATA.recipes[r], row = o || n;
      if (!row || (o && n && JSON.stringify(o) === JSON.stringify(n))) return;
      if (!oldTree.has(row[0]) && !newTree.has(row[0]) && !(n && newTree.has(n[0]))) return;
      var nm = itemName(row[0]);
      if (o && !n) lines.push(nm + ' can no longer be crafted (it was made from ' + ingText(o) + ').');
      else if (!o && n) lines.push(nm + ' is now crafted from ' + ingText(n) + '.');
      else {
        var before = lines.length;
        if (o[1] !== n[1]) lines.push(nm + ' now makes ' + n[1] + ', was ' + o[1] + '.');
        var a = ingMap(o), b = ingMap(n);
        Object.keys(b).forEach(function (g) { if (a[g] === undefined) lines.push(nm + ' now also needs ' + b[g] + ' ' + itemName(+g) + '.'); else if (a[g] !== b[g]) lines.push(nm + ' now needs ' + b[g] + ' ' + itemName(+g) + ', was ' + a[g] + '.'); });
        Object.keys(a).forEach(function (g) { if (b[g] === undefined) lines.push(nm + ' no longer needs ' + itemName(+g) + ' (was ' + a[g] + ').'); });
        if (lines.length === before) lines.push(nm + ' has changed crafting details.');
      }
    });
    return { lines: lines };
  }
  function noticeHtml(h, id, sc) {
    var n = patchNotice(h, id, sc);
    if (!n) return '';
    var ok = '<p class="row">' + btn('OK, noted', 'noted') + '</p>';
    if (n.plain) return '<section class="lists-panel patch-notice" role="status"><p><b>Game data changed since this list was last checked; the details for that version are not available.</b></p><p class="muted">Nothing in this list was changed.</p>' + ok + '</section>';
    return '<section class="lists-panel patch-notice" role="status"><h2>Game data changed since this list was last checked</h2>' +
      (n.lines.length ? '<ul class="patch-lines">' + n.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '<p>None of the recipes this list uses changed.</p>') +
      '<p class="muted">Nothing in this list was changed: every wanted item, amount, setting, step, way and stock count is kept.</p>' + ok + '</section>';
  }

  // data/lists.json plus `log` and `noHandOver`, built in by build.js (packed when that is smaller)
  var DATA = null, RECIPES_OF = null, NAMES = null;
  function loadData() {
    var p = window.LISTS_DATA ? Promise.resolve(window.LISTS_DATA) : CC.unpack(window.LISTS_DATA_PACKED).then(JSON.parse);
    return p.then(function (d) { DATA = d; });
  }
  function loadSave() {
    return CC.read().then(function (r) {
      SH.problem = null;
      var doc = CC.emptyDoc();
      if (r.raw != null) { try { doc = CC.checkDoc(r.raw); } catch (e) { SH.problem = e.message; return; } } // unreadable or newer: never written over
      SH.chars = doc.chars; SH.tracker = doc.modules.tracker || null; SH.sec = doc.modules.lists || null; SH.rev = r.rev; SH.base = SH.sec ? clone(SH.sec) : null; syncPrefs();
    }).catch(function (e) { SH.problem = e.message; });
  }

  // ------------------------------------------------------------------------------------------------ writing: one save at a time
  // An edit is a function of the section as it is when its turn comes: { section, entry } | { error } from LISTS.store (or LISTS.store.undo).
  // opts.undoOf: the undo entry this edit applies; opts.after(result): called once the change is saved.
  function act(f, opts) { SH.queue.push({ f: f, o: opts || {} }); return pump(); }
  function pump() {
    if (SH.busy) return SH.busy;
    if (!SH.queue.length || SH.problem) return Promise.resolve();
    var job = SH.queue.shift();
    SH.busy = Promise.resolve().then(function () { return doJob(job); }).catch(function () { /* settled in doJob */ }).then(function () {
      SH.busy = null;
      if (SH.queue.length) return pump();
      if (SH.reloadLater) { SH.reloadLater = false; return reload(); }
    });
    return SH.busy;
  }
  function dropEntry(entry) { SH.undo = SH.undo.filter(function (e) { return e !== entry; }); }
  function doJob(job) {
    var res = job.f(SH.sec || S.emptySection()), isUndo = !!job.o.undoOf;
    if (res.error) {
      SH.note = res.error; SH.rest = null;
      if (isUndo) dropEntry(job.o.undoOf);
      render(); return null;
    }
    if (!res.entry && !res.expect) { render(); return null; } // nothing changed (a cleared amount keeps the old one)
    return CC.writeSection('lists', res.section, { rev: SH.rev, base: SH.base, expect: res.expect }).then(function (r) {
      SH.rev = r.rev; SH.base = clone(r.section); SH.sec = r.section; SH.chars = r.doc.chars; SH.tracker = (r.doc.modules && r.doc.modules.tracker) || SH.tracker;
      SH.note = ''; SH.rest = null;
      if (isUndo) dropEntry(job.o.undoOf);
      else if (res.entry) { SH.undo.unshift(res.entry); if (SH.undo.length > 20) SH.undo.length = 20; }
      if (job.o.after) job.o.after(res);
      render();
    }, function (e) {
      // A refused write: show the saved copy again and say so; edits waiting behind it were made on the old copy and are dropped.
      SH.queue.length = 0;
      var elsewhere = !!(e && /on another device or in another tab/.test(e.message)); // the store's refusals (LI1 to LI5) all say so
      return CC.read().then(function (r) {
        var doc = r.raw == null ? CC.emptyDoc() : CC.checkDoc(r.raw);
        SH.rev = r.rev; SH.chars = doc.chars; SH.tracker = doc.modules.tracker || null; SH.sec = doc.modules.lists || null; SH.base = SH.sec ? clone(SH.sec) : null; syncPrefs();
        if (isUndo && elsewhere) { dropEntry(job.o.undoOf); SH.note = S.lines.undo; } else SH.note = 'Not saved on this device: ' + e.message + ' The page now shows what is saved; re-enter any unsaved edits if you still need them.';
        SH.rest = null; render();
      }).catch(function () {
        SH.problem = 'The saved data could not be reloaded after a refused save; reload the page to continue.';
        SH.note = 'Not saved on this device: ' + (e && e.message) + ' ' + SH.problem; render();
      });
    });
  }
  function labeled(res, label) { if (res && res.entry) res.entry.label = label; return res; }

  // ------------------------------------------------------------------------------------------------ reading
  // List order is fixed (spec section 4): by `order`, then `made`, then the id as plain text.
  function sortedIds(lists) {
    return Object.keys(lists).sort(function (a, b) {
      var x = lists[a], y = lists[b];
      return (x.order || 0) - (y.order || 0) || (x.made || 0) - (y.made || 0) || (a < b ? -1 : a > b ? 1 : 0);
    });
  }
  function count(o) { return o ? Object.keys(o).length : 0; }
  function sec() { return SH.sec || S.emptySection(); }
  function nameOfChar(c) { if (!c) return 'No character'; var f = SH.chars.filter(function (x) { return x.id === c; })[0]; return f ? f.name : 'Character ' + c; }
  function itemName(id) { var it = DATA && DATA.items && DATA.items[id]; return it ? it[0] : 'item ' + id; }
  function recipesOf(item) {
    if (!RECIPES_OF) {
      RECIPES_OF = {};
      Object.keys(DATA.recipes || {}).forEach(function (id) { var r = DATA.recipes[id]; (RECIPES_OF[r[0]] = RECIPES_OF[r[0]] || []).push(+id); });
      Object.keys(RECIPES_OF).forEach(function (k) { RECIPES_OF[k].sort(function (a, b) { return DATA.recipes[a][3] - DATA.recipes[b][3] || a - b; }); });
    }
    return RECIPES_OF[item] || [];
  }
  function itemFlags(item) { var it = DATA.items[item]; return it ? it[1] | 0 : 0; }
  function canHq(item) { return (itemFlags(item) & 2) !== 0; }
  function canColl(item) { return (itemFlags(item) & 4) !== 0 || recipesOf(item).some(function (r) { return (DATA.recipes[r][6] & 8) !== 0; }); }
  function search(q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    if (!NAMES) NAMES = Object.keys(DATA.items).filter(function (id) { return +id !== 1; }).map(function (id) { return [+id, DATA.items[id][0], DATA.items[id][0].toLowerCase()]; });
    var hits = NAMES.filter(function (n) { return n[2].indexOf(q) >= 0; });
    hits.sort(function (a, b) { return (a[2].indexOf(q) !== 0) - (b[2].indexOf(q) !== 0) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) || a[0] - b[0]; });
    return hits.slice(0, 25);
  }
  function targetsOf(sc, listId) {
    var p = listId + '.';
    return Object.keys(sc.targets).filter(function (k) { return k.slice(0, p.length) === p; }).sort(function (a, b) {
      return (sc.targets[a].at || 0) - (sc.targets[b].at || 0) || (a < b ? -1 : a > b ? 1 : 0);
    });
  }
  // The plan of one owner: every list of that owner together, in list order (spec section 5: a list is never planned alone).
  function planOf(sc, owner, noPrices) {
    var st = S.stateOf(sc, owner), ids = sortedIds(sc.lists).filter(function (id) { return S.ownerOf(sc.lists[id]) === owner; });
    var lists = ids.map(function (id) {
      return { id: id, steps: sc.lists[id].steps || {}, targets: targetsOf(sc, id).map(function (k) { var t = clone(sc.targets[k]); t.id = k.slice(id.length + 1); return t; }) };
    });
    var order = sc.owners[owner] && sc.owners[owner].order;
    return E.plan(DATA, { order: order || '', ways: st.ways, have: st.have, lists: lists, prices: noPrices ? null : priceMap() });
  }
  // the plan line a wanted item counts in (the engine's own rule: make, then collectable, then high quality, then ordinary)
  function lineFor(plan, t) {
    var keys = plan.items[t.item] || [], want = t.make ? 'make' : t.coll ? 'coll' : t.hq ? 'hq' : 'normal', found = null, fb = null;
    keys.forEach(function (k) { var ln = plan.lines[k]; if (ln.part === want && !found) found = ln; if (ln.part === 'normal' && !fb) fb = ln; });
    return found || fb || (keys.length ? plan.lines[keys[0]] : null);
  }
  function qualityOf(t, ln) { return ln && ln.quality ? ln.quality : t.coll ? 'coll' : t.hq ? 'hq' : 'nq'; }
  function qWord(q) { return q === 'hq' ? 'high quality' : q === 'coll' ? 'collectable' : 'ordinary'; }

  // ------------------------------------------------------------------------------------------------ plan views (W8)
  var JOBS = ['Carpenter', 'Blacksmith', 'Armorer', 'Goldsmith', 'Leatherworker', 'Weaver', 'Alchemist', 'Culinarian'], GATHER_JOBS = ['Miner', 'Botanist', 'Fisher'];
  var DEFAULT_ORDER = ['vendor', 'craft', 'gather', 'trade', 'market'];
  var WAY_TEXT = {
    vendor: 'Buy from a merchant for gil. If an ordinary merchant sells it for gil, you buy it, and the materials to craft it are left out.',
    craft: 'Craft it.', gather: 'Gather it.',
    trade: 'Trade for it with another currency (scrips, tomestones, seals, tokens). These are not counted as easy, so they come after crafting and gathering unless you move them up.',
    market: 'Buy on the market board.'
  };
  var WAY_LABEL = { vendor: 'Buy from a merchant (gil)', craft: 'Craft it', gather: 'Gather it', trade: 'Trade for other currencies', market: 'Buy on the market board', have: 'I have enough of this (do not count it)', '': 'Use the usual order' };
  var SECTIONS = [['vendor', 'Buy from a merchant (gil)'], ['gather', 'Gather'], ['trade', 'Trade for other currencies'], ['market', 'Buy on the market'], ['other', 'Other'], ['have', 'Not in your typed stock'], ['left', 'Left over']];
  var RECORD_LINE = 'You recorded more than the materials typed here cover. Those materials were not taken from what your other lists are counting on; check what you have.';
  var QFIELDS = ['need', 'given', 'outside', 'short', 'crafts', 'trades', 'got', 'makes'];

  function orderOf(sc, owner) {
    var o = sc.owners[owner] && sc.owners[owner].order, a = typeof o === 'string' ? o.split(/\s+/).filter(Boolean) : [];
    if (a.length !== 5) return DEFAULT_ORDER.slice();
    for (var i = 0; i < 5; i++) if (DEFAULT_ORDER.indexOf(a[i]) < 0 || a.indexOf(a[i]) !== i) return DEFAULT_ORDER.slice();
    return a;
  }
  function ownerListIds(sc, owner) { return sortedIds(sc.lists).filter(function (id) { return S.ownerOf(sc.lists[id]) === owner; }); }
  function stepIdsOf(h) { var steps = (h && h.steps) || {}; return Object.keys(steps).sort(function (a, b) { return (steps[a].n || 0) - (steps[b].n || 0) || (a < b ? -1 : a > b ? 1 : 0); }); }
  // V: what one screen shows: the plan of the whole owner (every list together) and the lists the screen is about
  function buildV(ids, owner) {
    var sc = sec();
    return { sc: sc, owner: owner, ids: ids, ownerIds: ownerListIds(sc, owner), plan: planOf(sc, owner), applied: false, char: nameOfChar(owner === 'u' ? '' : owner) };
  }
  // the shares of the chosen lists (and one step, or null for all of them) added up, per plan line
  function sumShares(plan, ids, stepId) {
    var set = {}, out = {}; ids.forEach(function (i) { set[i] = 1; });
    plan.shares.forEach(function (s) {
      if (!set[s.list] || (stepId !== null && s.step !== stepId)) return;
      Object.keys(s.lines).forEach(function (k) {
        var x = s.lines[k], o = out[k] || (out[k] = { need: 0, given: 0, outside: 0, short: 0, crafts: 0, trades: 0, got: 0, makes: 0, from: { nq: 0, hq: 0, coll: 0 } });
        QFIELDS.forEach(function (f) { o[f] += x[f]; });
        ['nq', 'hq', 'coll'].forEach(function (q) { o.from[q] += x.from[q]; });
      });
    });
    return out;
  }
  function figures(plan, sums) {
    var get = 0, craft = 0;
    Object.keys(sums).forEach(function (k) { var ln = plan.lines[k], x = sums[k]; if (ln.by === 'craft') craft += x.crafts; else if (ln.by !== 'have') get += x.got; });
    return { get: get, craft: craft };
  }
  // stock the plan gave to lists served before the chosen ones and not chosen: "4 held for “Other list”" (E16)
  function heldFor(V, key) {
    var last = -1, by = {}, names = [];
    V.ids.forEach(function (id) { last = Math.max(last, V.ownerIds.indexOf(id)); });
    V.plan.shares.forEach(function (s) {
      var i = V.ownerIds.indexOf(s.list), x = s.lines[key];
      if (!x || V.ids.indexOf(s.list) >= 0 || i < 0 || i > last) return;
      var n = x.from.nq + x.from.hq + x.from.coll;
      if (n > 0) { if (!by[s.list]) { by[s.list] = 0; names.push(s.list); } by[s.list] += n; }
    });
    return names.map(function (id) { return by[id] + ' held for “' + ((V.sc.lists[id] && V.sc.lists[id].name) || 'Untitled list') + '”'; });
  }
  function typedOf(V, item, q) { var h = V.sc.have[V.owner + '.' + item]; return (h && h[q]) || 0; }

  // ways an item has in one quality ('normal' or 'hq'), in the default order; what the engine's own availability rule allows
  function offersFor(item, q) {
    var out = { gil: [], trade: [] };
    ((DATA.trades && DATA.trades[item]) || []).forEach(function (o) { if ((o[2] ? 'hq' : 'normal') === q) (o[1].length === 1 && o[1][0][0] === 1 ? out.gil : out.trade).push(o); });
    return out;
  }
  function waysOf(V, item, q) {
    var w = V.sc.ways[V.owner + '.' + item] || {}, off = offersFor(item, q), res = [];
    var rid = w.recipe && DATA.recipes[w.recipe] && DATA.recipes[w.recipe][0] === item ? w.recipe : (recipesOf(item)[0] || 0);
    if (off.gil.length) res.push('vendor');
    if (rid && (q === 'normal' || (DATA.recipes[rid][6] & 1))) res.push('craft');
    if (q === 'normal' && DATA.gather && DATA.gather[item]) res.push('gather');
    if (off.trade.length) res.push('trade');
    if (itemFlags(item) & 1) res.push('market');
    return res;
  }
  function seller(npc) { var n = DATA.npcs && DATA.npcs[npc]; return n && n[0] ? { name: n[0], zone: n[1] || '' } : { name: 'a merchant', zone: '' }; }
  function curText(cur) { return cur.map(function (c) { return c[1] + ' ' + (c[0] === 1 ? 'gil' : itemName(c[0])); }).join(' and '); }
  function isCrafted(ln) { return ln.part === 'make' || ln.part === 'coll'; }
  function qWayOf(ln) { return ln.part === 'hq' ? 'hq' : 'normal'; }
  function stamp(ln) {
    var t = ln.part === 'make' ? 'Must be crafted by me' : ln.part === 'coll' ? 'Collectable' : ln.part === 'hq' ? 'High quality' : 'Ordinary';
    return '<span class="stamp q-' + ln.quality + '">' + t + '</span>';
  }
  // why this way (D15): the seller, "You chose this", a loop's note
  function reasonOf(V, ln, x) {
    var p = [], off = ln.offer, w = V.sc.ways[V.owner + '.' + ln.item] || {};
    if (ln.by === 'vendor' && off) {
      var sl = seller(off.npc), g = off.cur[0][1];
      p.push('Sold by ' + sl.name + (sl.zone ? ' in ' + sl.zone : '') + (off.gives === 1 ? ' for ' + g + ' gil each' : ': ' + off.gives + ' for ' + g + ' gil'));
      if (off.rank) p.push('needs Grand Company rank ' + off.rank);
      if (ln.why === 'order' && waysOf(V, ln.item, qWayOf(ln)).indexOf('craft') >= 0) p.push('planned as bought, because a merchant comes first');
    } else if (ln.by === 'trade' && off) {
      var st = seller(off.npc);
      p.push('Traded by ' + st.name + (st.zone ? ' in ' + st.zone : '') + ': ' + curText(off.cur) + ' for ' + off.gives);
      if (off.rank) p.push('needs Grand Company rank ' + off.rank);
    } else if (ln.by === 'craft') {
      var r = DATA.recipes[ln.recipe];
      p.push('Crafted by ' + (JOBS[r[2]] || 'a crafter') + ', level ' + r[3]);
    } else if (ln.by === 'gather' && ln.node) p.push('Gathered by ' + (GATHER_JOBS[ln.node.job] || 'a gatherer') + ', level ' + ln.node.level + ', in ' + ln.node.zone);
    else if (ln.by === 'market') p.push('Bought on the market board');
    else if (ln.by === 'have') p.push((x ? x.outside : ln.outside) + ' not in your typed stock: you said you already have these');
    else if (ln.by === 'other') p.push('No way to get this is known');
    if (ln.part === 'make') p.push('You marked this as must be crafted by me');
    if (ln.part === 'coll') p.push('Collectables are always crafted');
    if (ln.why === 'chosen' && !isCrafted(ln)) p.push('You chose this');
    if (w.by && w.by !== 'have' && !isCrafted(ln) && waysOf(V, ln.item, 'normal').indexOf(w.by) < 0 && waysOf(V, ln.item, 'hq').indexOf(w.by) < 0) p.push('The way you chose is no longer available in the game data; using the usual order. Your choice is still stored');
    else if (w.by === 'trade' && w.offer && !isCrafted(ln) && ['normal', 'hq'].every(function (qq) { return !offersFor(ln.item, qq).trade.some(function (o) { return o[4] + '.' + o[0] + '.' + o[1][0][0] === w.offer; }); })) p.push('The trade you chose is no longer in the game data; using the usual one. Your choice is still stored');
    var s = p.join('. ') + (p.length ? '.' : '');
    if (V.plan.cut[ln.item]) s += (s ? ' ' : '') + V.plan.cut[ln.item];
    return s ? '<p class="why">' + esc(s) + '</p>' : '';
  }
  // "Get it by" select, "Craft it instead", the other trades (D15); none on a must-craft or collectable row
  function wayBlock(V, ln) {
    if (isCrafted(ln)) return '';
    var item = ln.item, q = qWayOf(ln), ways = waysOf(V, item, q), stored = (V.sc.ways[V.owner + '.' + item] || {}).by || '';
    var sel = stored === 'have' || ways.indexOf(stored) >= 0 ? stored : '';
    var h = '<div class="w-way"><label>Get it by <select data-f="way">' + ['']
      .concat(ways).concat(['have']).map(function (v) { return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + esc(WAY_LABEL[v]) + '</option>'; }).join('') + '</select></label>';
    if (ln.by === 'vendor' && ln.why === 'order' && ways.indexOf('craft') >= 0) h += ' ' + btn('Craft it instead', 'setway', ' data-by="craft"');
    if (ln.by === 'trade') {
      var trades = offersFor(item, q).trade;
      if (trades.length > 1) h += '<label>Other trades <select data-f="offer">' + trades.map(function (o) {
        var key = o[4] + '.' + o[0] + '.' + o[1][0][0], sl = seller(o[4]);
        return '<option value="' + key + '"' + (ln.offer && ln.offer.key === key ? ' selected' : '') + '>' + esc(sl.name + ': ' + curText(o[1]) + ' for ' + o[0]) + '</option>';
      }).join('') + '</select></label>';
    }
    h += '</div>';
    if (!V.applied) { V.applied = true; h += '<p class="muted fine">This applies wherever ' + esc(V.char) + ' needs this item.</p>'; }
    return h;
  }
  function boughtBox(V, rowKey, need, q) {
    if (SH.view.bought !== rowKey) return '';
    var other = SH.view.mode === 'other';
    return '<div class="w-bought"><label>' + (other ? 'How many did you get?' : 'How many did you buy?') + ' <input type="number" inputmode="numeric" min="1" max="999999" data-f="boughtn" value="' + Math.max(1, need) + '"></label> <span>in ' + qWord(q) + ' quality</span> ' +
      btn('Add to my stock', 'bought') + ' ' + btn('Cancel', 'cancel-bought') + '</div>';
  }
  function rowAttrs(V, key, ln, q) { return ' data-lk="' + esc(key) + '" data-item="' + ln.item + '" data-q="' + q + '" data-owner="' + esc(V.owner) + '"'; }

  // a row of To get: one line of the plan, the chosen lists' share of it
  function getRow(V, key, x) {
    var ln = V.plan.lines[key], name = itemName(ln.item), q = ln.quality, typed = typedOf(V, ln.item, q), held = heldFor(V, key);
    var h = '<li class="line-row get-row"' + rowAttrs(V, key, ln, q) + '><div class="w-head"><b class="w-name">' + esc(name) + '</b> <span class="w-count">need ' + x.need + ', have ' + typed + ' ' + stamp(ln) +
      (ln.by === 'have' ? '' : ' · to get ' + x.got + (ln.by === 'vendor' || ln.by === 'trade' ? ' (' + x.trades + ' purchase' + (x.trades === 1 ? '' : 's') + ')' : '')) + '</span>' +
      (held.length ? ' <span class="held">' + esc(held.join(', ')) + '</span>' : '') + '</div>' + reasonOf(V, ln, x) +
      (ln.by === 'gather' ? windowRow(ln, Date.now()) : '') + (ln.by === 'market' ? priceRow(ln, Date.now()) : '');
    h += '<div class="w-stock"><label>I have <input type="number" inputmode="numeric" min="0" max="999999" data-f="have" data-q="' + q + '" value="' + typed + '"></label> ' +
      btn('−', 'minus', ' aria-label="One less ' + esc(name) + '"') + ' ' + btn('+', 'plus', ' aria-label="One more ' + esc(name) + '"') + ' ' + btn('Have all', 'haveall', ' data-n="' + x.short + '"') + '</div>';
    return h + wayBlock(V, ln) + '</li>';
  }
  function makeProgress(V, item) {
    var c = 0, q = 0;
    V.ids.forEach(function (lid) { targetsOf(V.sc, lid).forEach(function (k) { var t = V.sc.targets[k]; if (t.item === item && t.make && !t.done) { c += Math.min(t.crafted || 0, t.qty); q += t.qty; } }); });
    return { crafted: c, qty: q };
  }
  function craftRow(V, key, x) {
    var ln = V.plan.lines[key], name = itemName(ln.item), q = ln.quality, spare = V.plan.spare[key] || 0, rowKey = 'L|' + key;
    var h = '<li class="line-row craft-row"' + rowAttrs(V, key, ln, q) + '><div class="w-head"><b class="w-name">' + esc(name) + '</b> <span class="w-count">' + x.crafts + ' craft' + (x.crafts === 1 ? '' : 's') + ', makes ' + x.makes + ' ' + stamp(ln) + '</span>' +
      (spare ? ' <span class="tag">spare: ' + spare + '</span>' : '');
    if (ln.part === 'make') { var mp = makeProgress(V, ln.item); h += ' <span class="tag">' + mp.crafted + ' of ' + mp.qty + ' crafted</span>'; }
    h += '</div>' + reasonOf(V, ln, x) + '<div class="w-act">' + btn('Made 1', 'made', ' data-crafts="1"') + ' ' + (x.crafts > 1 ? btn('Made all', 'made', ' data-crafts="' + x.crafts + '"') + ' ' : '') +
      btn('Bought it', 'ask-bought', ' data-mode="bought"') + ' ' + btn('Got it another way', 'ask-bought', ' data-mode="other"');
    if (!(DATA.noHandOver || []).some(function (r) { return r === ln.recipe; })) h += ' <a class="btn" href="../atelier/#recipe=' + ln.recipe + '">Solve in the Atelier</a>';
    h += '</div>' + boughtBox(V, rowKey, x.short, q) + wayBlock(V, ln) + '</li>';
    return h;
  }
  function secHead(id, label, n, open) {
    return '<h3 class="gsec-h"><button type="button" class="btn sec-toggle" data-act="sec" data-sec="' + id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? '▾ ' : '▸ ') + esc(label) + ' <span class="count">' + n + '</span></button></h3>';
  }
  function leftEntries(V) {
    var seen = {}, out = [];
    V.ids.forEach(function (id) { (V.plan.leftover[id] || []).forEach(function (e) { if (!seen[e.item]) { seen[e.item] = 1; out.push(e); } }); });
    return out;
  }
  function leftRows(V, entries) {
    var many = V.ids.length > 1, who = many ? 'these lists' : 'this list', h = '';
    entries.forEach(function (e) {
      [['nq', ''], ['hq', 'high-quality ']].forEach(function (p) {
        if (e[p[0]] > 0) h += '<li class="left-row" data-item="' + e.item + '">' + e[p[0]] + ' ' + p[1] + esc(itemName(e.item)) + ': no longer needed by ' + who + '. Still in your stock, and used by your other lists if they need it.</li>';
      });
    });
    return h;
  }
  function getTab(V, sums) {
    var h = '', shown = 0, blocks = '';
    SECTIONS.forEach(function (def) {
      var id = def[0], open = !!SH.view.open[id], n, rows = '';
      if (id === 'left') {
        var ents = leftEntries(V); n = ents.length;
        if (!n) return;
        if (open) rows = leftRows(V, ents);
      } else {
        var keys = (id === 'have' ? V.plan.shop.outside : V.plan.shop[id]).filter(function (k) { return sums[k] && sums[k].short > 0; });
        n = keys.length;
        if (!n) return;
        shown += n;
        if (open) rows = (id === 'market' ? priceTotal(V, keys, sums, Date.now()) : '') + '<ul class="lines">' + keys.map(function (k) { return getRow(V, k, sums[k]); }).join('') + '</ul>';
        if (open && id === 'market') keys.forEach(function (k) { if (PR.want.indexOf(V.plan.lines[k].item) < 0) PR.want.push(V.plan.lines[k].item); });
      }
      blocks += '<section class="gsec" data-sec="' + id + '">' + secHead(id, def[1], n, open) + (open ? (id === 'left' ? '<ul class="lines">' + rows + '</ul>' : rows) : '') + '</section>';
    });
    if (!shown) h += '<p class="muted empty-line">Nothing left to get.</p>';
    return h + blocks + '<p class="muted fine">You type what you have. This app never reads the game.</p>';
  }
  function craftTab(V, sums) {
    var h = '', last = null, any = false;
    V.plan.order.forEach(function (b) {
      var keys = b.crafts.filter(function (k) { return sums[k] && sums[k].crafts > 0; });
      if (!keys.length) return;
      any = true;
      if (last !== b.job) { if (last !== null) h += '</ul></section>'; h += '<section class="cblock" data-job="' + b.job + '"><h3>' + esc(JOBS[b.job] || 'Crafter') + '</h3><ul class="lines">'; last = b.job; }
      h += keys.map(function (k) { return craftRow(V, k, sums[k]); }).join('');
    });
    if (last !== null) h += '</ul></section>';
    var done = SH.view.hide ? [] : crafted(V);
    if (done.length) { any = true; h += '<section class="cblock cdone"><h3>Already crafted</h3><ul class="lines">' + done.map(function (d) { return '<li class="line-row done"><b class="w-name">' + esc(itemName(d.item)) + '</b> <span class="tag">' + d.crafted + ' of ' + d.qty + ' crafted</span></li>'; }).join('') + '</ul></section>'; }
    return (any ? '' : '<p class="muted empty-line">Nothing left to craft.</p>') + h;
  }
  // must-craft items already crafted in full (not yet marked finished): the "completed" rows of To craft
  function crafted(V) {
    var out = [];
    V.ids.forEach(function (lid) { targetsOf(V.sc, lid).forEach(function (k) { var t = V.sc.targets[k]; if (t.make && !t.done && (t.crafted || 0) >= t.qty) out.push({ item: t.item, crafted: t.crafted || 0, qty: t.qty }); }); });
    return out;
  }
  function orderSheet(V) {
    var ord = orderOf(V.sc, V.owner);
    return '<section class="lists-panel order-sheet" aria-label="Order of ways"><h2>Order of ways</h2><p>When an item can be got in several ways, ' + esc(V.char) + '’s lists try them in this order:</p><ol class="order-list">' +
      ord.map(function (w, i) {
        return '<li data-way="' + w + '"><span class="ord-text"><b>' + (i + 1) + '.</b> ' + esc(WAY_TEXT[w]) + '</span> <span class="ord-btns">' + btn('Move up', 'order-up', ' data-way="' + w + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up: ' + esc(WAY_LABEL[w]) + '"') + ' ' +
          btn('Move down', 'order-down', ' data-way="' + w + '"' + (i === 4 ? ' disabled' : '') + ' aria-label="Move down: ' + esc(WAY_LABEL[w]) + '"') + '</span></li>';
      }).join('') + '</ol><p class="muted">This order is used in all of ' + esc(V.char) + '’s lists. You can change it here, or choose a way for one item on its row, at any time. Items from the crafting log, and collectables, are always crafted.</p>' +
      '<p class="row">' + btn('Back to the usual order', 'order-reset') + ' ' + btn('Close', 'sheet') + '</p></section>';
  }
  function totalsLine(V) {
    var f = figures(V.plan, V.plan.lines);
    return '<p class="lists-totals" data-get="' + f.get + '" data-craft="' + f.craft + '">Totals for ' + esc(V.char) + ': ' + f.get + ' to get, ' + f.craft + ' to craft.</p>';
  }
  function tabsHtml(V, tabs) {
    return '<div class="lists-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" role="tab" class="btn tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (SH.view.tab === t[0] ? 'true' : 'false') + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  function barHtml(V) {
    return '<p class="row lists-opts">' + btn(SH.view.hide ? 'Show completed' : 'Hide completed', 'hide', ' aria-pressed="' + (SH.view.hide ? 'true' : 'false') + '"') + ' ' + btn('Order of ways', 'sheet', ' aria-expanded="' + (SH.view.sheet ? 'true' : 'false') + '"') + '</p>' + placeBar() + (SH.view.sheet ? orderSheet(V) : '');
  }
  // step tabs: each step's own share; the hand-in button and its confirm (E19, D28)
  function stepsHtml(V, h, listId) {
    var sids = stepIdsOf(h);
    if (!sids.length) return '';
    var tabs = [[null, 'All steps']].concat(sids.map(function (s) { return [s, h.steps[s].name]; }));
    var out = '<div class="lists-steps" role="tablist" aria-label="Steps">' + tabs.map(function (t) {
      var f = figures(V.plan, sumShares(V.plan, [listId], t[0])), on = SH.view.step === t[0];
      return '<button type="button" role="tab" class="btn step-tab" data-act="step" data-step="' + (t[0] === null ? '' : esc(t[0])) + '" aria-selected="' + (on ? 'true' : 'false') + '"><span class="st-name">' + esc(t[1]) + '</span> <span class="st-fig" data-get="' + f.get + '" data-craft="' + f.craft + '">' + f.get + ' to get · ' + f.craft + ' to craft</span></button>';
    }).join('') + '</div><p class="muted fine">A step’s figures are its share of ' + esc(V.char) + '’s plan and can move between steps and lists; the totals for ' + esc(V.char) + ' never go up when you remove something.</p>';
    if (SH.view.step !== null && h.steps[SH.view.step]) {
      var sid = SH.view.step, ask = SH.view.confirm === 'step:' + sid;
      out += '<p class="row">' + (ask ? '' : btn('This step is handed in', 'ask-handin')) + '</p>';
      if (ask) {
        var items = [], n = 0, got = {};
        Object.keys(V.sc.targets).forEach(function (k) { if (k.slice(0, listId.length + 1) === listId + '.' && !V.sc.targets[k].done && V.plan.stepOf[k] === sid) n++; });
        V.plan.shares.forEach(function (s) {
          if (s.list !== listId || s.step !== sid) return;
          Object.keys(s.lines).forEach(function (k) { var d = s.lines[k].fromDirect, t = d.nq + d.hq + d.coll; if (t > 0) got[V.plan.lines[k].item] = (got[V.plan.lines[k].item] || 0) + t; });
        });
        Object.keys(got).forEach(function (i) { items.push(got[i] + ' ' + itemName(+i)); });
        out += '<div class="lists-confirm"><p class="ask">Hand in “' + esc(h.steps[sid].name) + '”? ' + n + ' wanted item' + (n === 1 ? '' : 's') + ' will be marked finished' +
          (items.length ? ', and this much of your stock will be taken out: ' + esc(items.join(', ')) : ', and none of your stock will be taken out') + '. If you crafted any of these without pressing Made, press Made first, so what is left over is counted.</p><p class="row">' +
          btn('Hand in', 'handin', ' data-step="' + esc(sid) + '"') + ' ' + btn('Keep', 'keep') + '</p></div>';
      }
    }
    return out;
  }


  // ------------------------------------------------------------------------------------------------ from the crafting log (W10, spec sections 6 and 7)
  // Which recipes of a crafting-log page a character has not ticked is read from the Tracker's section of the one save with the Tracker's own
  // core scripts (core/model.js and core/codec.js: ET.fromSaveDoc, ET.isTicked, ET.isExcluded), loaded when this screen first needs them. The page
  // only reads; nothing is written until Create. The log (data.log) holds the recipe ids of the Tracker's craft-* lists, one list per job.
  var LOG_JOBS = ['Carpenter', 'Blacksmith', 'Armorer', 'Goldsmith', 'Leatherworker', 'Weaver', 'Alchemist', 'Culinarian'];
  var ET_LOAD = null;
  function loadCore() {
    if (window.ET && window.ET.fromSaveDoc && window.ET.isTicked) return Promise.resolve();
    if (!ET_LOAD) ET_LOAD = ['../core/model.js', '../core/codec.js'].reduce(function (p, src) {
      return p.then(function () { return new Promise(function (ok, bad) { var el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = function () { bad(new Error('The Tracker’s reading code could not be opened.')); }; document.head.appendChild(el); }); });
    }, Promise.resolve());
    return ET_LOAD;
  }
  function trackerState() { return window.ET.fromSaveDoc({ chars: SH.chars, modules: { tracker: SH.tracker || {} } }); }
  function sectionId(job) { return 'craft-' + LOG_JOBS[job].toLowerCase(); }
  function logPages(job) { return (DATA.log && DATA.log[job]) || []; }
  // { total, missing: [recipe ids] } of one character, job and page: applicable (not marked as not applying) and not ticked
  function logCounts(charId, job, page) {
    var st = trackerState(), key = function (id) { return window.ET.key(sectionId(job), id); }, ticks = new Set(), excl = new Set();
    var pg = logPages(job)[page]; if (!pg) return { total: 0, missing: [] };
    pg[1].forEach(function (id) { if (window.ET.isTicked(st, charId, key(id))) ticks.add(id); if (window.ET.isExcluded(st, charId, key(id))) excl.add(id); });
    return { total: E.missing(DATA, new Set(), excl, job, page).length, missing: E.missing(DATA, ticks, excl, job, page) };
  }
  function openLog(o) { // o: { job, page, char } (anything may be null)
    var chars = SH.chars || [];
    SH.view.log = { job: o && o.job != null ? o.job : null, page: o && o.page != null ? o.page : null, char: o && o.char ? o.char : (chars.length === 1 ? chars[0].id : null), asked: false };
    SH.view.list = null; SH.view.combined = false; SH.view.form = false; SH.view.confirm = null; SH.view.bought = null; SH.note = '';
  }
  // the Tracker's link: #from=<job 0-7>.<first recipe id of the page>&char=<cN>; read once, then removed. An unknown job or recipe opens the screen unfilled.
  function readHash() {
    var h = location.hash || '';
    if (h.indexOf('#from=') !== 0) return Promise.resolve();
    var m = /^#from=(\d+)\.(\d+)(?:&char=(c[1-8]))?$/.exec(h), o = { job: null, page: null, char: null };
    if (m) {
      var job = +m[1], rid = +m[2], pages = job < 8 ? logPages(job) : [];
      for (var i = 0; i < pages.length; i++) if (pages[i][1].indexOf(rid) >= 0) { o.job = job; o.page = i; break; }
      if (m[3] && (SH.chars || []).some(function (c) { return c.id === m[3]; })) o.char = m[3];
    }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    return loadCore().then(function () { openLog(o); render(); }, function (e) { SH.note = e.message; render(); });
  }
  function renderLog() {
    var V = SH.view.log, chars = SH.chars || [], head = statusHtml(), job = V.job, pages = job != null ? logPages(job) : [], pg = V.page != null ? pages[V.page] : null;
    var h = head + '<section class="lists-panel log-screen"><h2>From the crafting log</h2>';
    if (!chars.length) {
      main.innerHTML = h + '<p>Set up your characters in the Tracker first: the crafting log is read from what each character has ticked there.</p><p class="row">' + btn('Back', 'log-cancel') + '</p></section>';
      return;
    }
    h += '<form class="lists-form" onsubmit="return false">' +
      '<label>Job <select data-f="logjob"><option value="">Choose a job</option>' + LOG_JOBS.map(function (n, i) { return '<option value="' + i + '"' + (i === job ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
      '<label>Page <select data-f="logpage"' + (job == null ? ' disabled' : '') + '><option value="">Choose a page</option>' + pages.map(function (x, i) { return '<option value="' + i + '"' + (i === V.page ? ' selected' : '') + '>' + esc(x[0]) + '</option>'; }).join('') + '</select></label>';
    if (V.char) h += '<label>Character <select data-f="logchar">' + chars.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === V.char ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>';
    h += '</form>';
    if (!pg) h += '<p class="muted">Choose a job and a page.</p>';
    else if (!V.char) {
      h += '<h3>For which character?</h3><p class="row">' + chars.map(function (c) { var n = logCounts(c.id, job, V.page).missing.length;
        return '<button type="button" class="btn" data-act="log-char" data-char="' + esc(c.id) + '">' + esc(c.name) + ': ' + n + ' not ticked</button>'; }).join(' ') + '</p>';
    } else {
      var k = logCounts(V.char, job, V.page);
      if (!k.missing.length) h += '<p class="log-empty">Everything on this page is ticked.</p>';
      else h += '<p class="log-count">' + k.missing.length + ' of ' + k.total + ' not ticked in the Tracker</p><ul class="log-items">' + k.missing.map(function (id) { return '<li>' + esc(itemName(DATA.recipes[id][0])) + '</li>'; }).join('') + '</ul>';
      h += '<p class="row">' + (k.missing.length ? btn('Create', 'log-create') + ' ' : '') + btn('Cancel', 'log-cancel') + '</p>';
      main.innerHTML = h + '</section>'; return;
    }
    main.innerHTML = h + '<p class="row">' + btn('Cancel', 'log-cancel') + '</p></section>';
  }
  // one list, one wanted item with "Must be crafted by me" and no stored way for each entry, in one change (one Undo)
  function logCreate(charId, job, page, ids) {
    var title = (logPages(job)[page] || ['Crafting log'])[0], name = LOG_JOBS[job] + ': ' + title;
    return function (s) {
      var r = S.newList(s, { name: name, charId: charId, stamp: DATA.stamp }, CTX());
      if (r.error) return r;
      var units = r.entry ? r.entry.units.slice() : [], sec = r.section, i;
      for (i = 0; i < ids.length; i++) {
        var t = S.addTarget(sec, r.id, { item: DATA.recipes[ids[i]][0], recipe: ids[i], qty: 1, make: true }, CTX());
        if (t.error) return t;
        if (t.entry) units = units.concat(t.entry.units);
        sec = t.section;
      }
      return { section: sec, entry: { label: 'Made the list “' + name + '”', units: units }, id: r.id };
    };
  }

  // ------------------------------------------------------------------------------------------------ screens
  function btn(label, act, extra, cls) { return '<button type="button" class="btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>'; }
  function topButtons() {
    return btn('New list', 'new') + ' ' + btn('From the crafting log', 'from-log');
  }
  function statusHtml() {
    var h = '';
    if (SH.note) h += '<p class="lists-note-line">' + esc(SH.note) + '</p>';
    if (SH.rest) {
      h += '<p class="lists-rest">' + SH.rest.ways.map(function (w) { return btn('Buy the rest too: ' + (w === 'vendor' ? 'from a merchant' : 'on the market'), 'rest', ' data-by="' + w + '"'); }).join(' ') + '</p>';
    }
    if (SH.undo.length) {
      h += '<p class="lists-undo">' + btn('Undo: ' + SH.undo[0].label, 'undo', ' data-i="0"');
      if (SH.undo.length > 1) {
        h += '</p><details class="lists-earlier"><summary>Earlier changes (' + (SH.undo.length - 1) + ')</summary><ul>' + SH.undo.slice(1).map(function (e, i) {
          return '<li><span>' + esc(e.label) + '</span> ' + btn('Undo', 'undo', ' data-i="' + (i + 1) + '"') + '</li>';
        }).join('') + '</ul></details>';
      } else h += '</p>';
    }
    return '<div class="lists-status" role="status" aria-live="polite">' + h + '</div>';
  }
  function newForm() {
    var chars = SH.chars || [];
    return '<form class="lists-form" data-form="new" onsubmit="return false"><label>List name <input type="text" data-f="newname" maxlength="60" autocomplete="off"></label>' +
      '<label>Character <select data-f="newchar">' + chars.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '<option value="">No character</option></select></label>' +
      '<span class="row">' + btn('Create', 'create') + ' ' + btn('Cancel', 'cancel-new') + '</span></form>';
  }
  // "12 of 40 ready": finished, crafted in full, or covered by what is typed (the whole plan, as the rows are)
  function readyCounts(sc) {
    var plans = {}, out = {};
    Object.keys(sc.targets || {}).forEach(function (k) {
      var lid = k.split('.')[0], h = sc.lists[lid]; if (!h) return;
      var owner = S.ownerOf(h), t = sc.targets[k], o = out[lid] || (out[lid] = { ready: 0, total: 0 });
      o.total++;
      if (t.done || (t.make && (t.crafted || 0) >= t.qty)) { o.ready++; return; }
      var plan = plans[owner] || (plans[owner] = planOf(sc, owner)), ln = lineFor(plan, t);
      if (ln && !t.make && ln.short === 0) o.ready++;
    });
    return out;
  }
  function renderHome() {
    var sc = sec(), lists = sc.lists, ids = sortedIds(lists), head = statusHtml();
    if (!ids.length) {
      main.innerHTML = head + '<div class="lists-empty"><p>No lists yet. Start one, or build one from the crafting-log pages you have not finished.</p><div class="row">' + topButtons() + '</div>' + (SH.view.form ? newForm() : '') + '</div>';
      return;
    }
    var ready = readyCounts(sc), ticked = S.combined(sc), tickOwner = ticked.length ? S.ownerOf(lists[ticked[0]]) : null, anyDisabled = false;
    var groups = {}, order = [];
    ids.forEach(function (id) { var c = lists[id].charId || ''; if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(id); });
    order.sort(function (a, b) { return (a === '') - (b === '') || (a < b ? -1 : a > b ? 1 : 0); });
    var body = order.map(function (c) {
      var owner = c || 'u';
      return '<section class="lists-group" aria-label="' + esc(nameOfChar(c)) + '"><h2>' + esc(nameOfChar(c)) + '</h2><p class="row group-bar">' + btn('Combined view', 'combined', ' data-owner="' + owner + '"') + '</p><div class="lists-cards">' + groups[c].map(function (id) {
        var l = lists[id], steps = Math.max(1, count(l.steps)), r = ready[id] || { ready: 0, total: 0 }, asking = SH.view.confirm === 'list:' + id;
        var off = tickOwner !== null && tickOwner !== owner; if (off) anyDisabled = true;
        return '<article class="list-card" data-list="' + esc(id) + '"><h3>' + esc(l.name || 'Untitled list') + '</h3><p>' + r.ready + ' of ' + r.total + ' ready · ' + steps + ' step' + (steps === 1 ? '' : 's') + '</p>' +
          '<label class="chk tick"><input type="checkbox" data-f="tick"' + (ticked.indexOf(id) >= 0 ? ' checked' : '') + (off ? ' disabled' : '') + '> Combined view</label><p class="row">' +
          btn('Open', 'open') + ' ' + (asking ? '<span class="ask">Remove this list and its ' + r.total + ' wanted item' + (r.total === 1 ? '' : 's') + '?</span> ' + btn('Remove', 'remove-list', '', 'danger') + ' ' + btn('Keep', 'keep')
            : btn('Remove list', 'ask-remove-list')) + '</p></article>';
      }).join('') + '</div></section>';
    }).join('');
    main.innerHTML = head + '<div class="lists-bar">' + topButtons() + '</div>' + (SH.view.form ? newForm() : '') + (anyDisabled ? '<p class="muted fine">Each character has its own stock.</p>' : '') + body;
  }
  function flagBox(key, flag, label, on) { return '<label class="chk"><input type="checkbox" data-f="flag" data-flag="' + flag + '"' + (on ? ' checked' : '') + '> ' + esc(label) + '</label>'; }
  function renderRow(V, listId, h, key) {
    var sc = V.sc, plan = V.plan, t = sc.targets[key], owner = S.ownerOf(h), ln = t.done ? null : lineFor(plan, t), q = qualityOf(t, ln), tid = key.slice(listId.length + 1);
    var have = sc.have[owner + '.' + t.item], typed = (have && have[q]) || 0, name = itemName(t.item), recs = recipesOf(t.item);
    var need = ln ? (ln.part === 'make' ? ln.need : ln.short) : 0, steps = h.steps || {}, stepIds = stepIdsOf(h);
    var h2 = '<li class="wanted-row' + (t.done ? ' done' : '') + '" data-key="' + esc(key) + '" data-item="' + t.item + '" data-q="' + q + '" data-owner="' + esc(owner) + '"><div class="w-head"><b class="w-name">' + esc(name) + '</b> <span class="w-count">' +
      (t.done ? 'Finished' : 'need ' + (ln ? ln.need : t.qty) + ', have ' + typed) + ' <span class="w-q">(' + qWord(q) + ')</span></span>' +
      (t.make ? ' <span class="tag">Must be crafted by me: ' + (t.crafted || 0) + ' of ' + t.qty + ' crafted</span>' : '') + (!DATA.items[t.item] || (t.make && !recs.length) ? ' <span class="tag gone">no longer in the game data</span>' : '') + '</div>';
    var shown = ln && !(t.make && ln.part !== 'make');
    if (shown) h2 += reasonOf(V, ln, null);
    h2 += '<div class="w-edit"><label>Amount <input type="number" inputmode="numeric" min="1" max="99999" data-f="qty" value="' + t.qty + '"></label>';
    if (canHq(t.item) || t.hq) h2 += flagBox(key, 'hq', 'High quality', t.hq);
    if (canColl(t.item) || t.coll) h2 += flagBox(key, 'coll', 'Collectable', t.coll);
    if (recs.length || t.make) h2 += flagBox(key, 'make', 'Must be crafted by me', t.make);
    if (stepIds.length) h2 += '<label>Step <select data-f="step"><option value="">' + esc(steps[stepIds[0]].name) + ' (first)</option>' + stepIds.slice(1).map(function (s) {
      return '<option value="' + esc(s) + '"' + (t.step === s ? ' selected' : '') + '>' + esc(steps[s].name) + '</option>'; }).join('') + '</select></label>';
    h2 += '</div>';
    if (shown && !isCrafted(ln)) h2 += wayBlock(V, ln);
    h2 += '<div class="w-stock"><label>I have <input type="number" inputmode="numeric" min="0" max="999999" data-f="have" data-q="' + q + '" value="' + typed + '"></label> ' +
      btn('−', 'minus', ' aria-label="One less ' + esc(name) + '"') + ' ' + btn('+', 'plus', ' aria-label="One more ' + esc(name) + '"') + ' ' + (t.done ? '' : btn('Bought it', 'ask-bought')) + '</div>';
    if (SH.view.bought === key && !t.done) h2 += boughtBox(V, key, need, q);
    h2 += '<div class="w-act">' + btn(t.done ? 'Not finished' : 'Finished', 'done') + ' ' +
      (SH.view.confirm === key ? '<span class="ask">Remove this wanted item?</span> ' + btn('Remove', 'remove', '', 'danger') + ' ' + btn('Keep', 'keep') : btn('Remove', 'ask-remove')) + '</div></li>';
    return h2;
  }
  function hitsHtml() {
    var res = search(SH.view.search);
    if (SH.view.search.trim().length < 2) return '';
    return '<ul class="hits">' + (res.length ? res.map(function (n) { return '<li><span>' + esc(n[1]) + '</span> ' + btn('Add', 'add', ' data-item="' + n[0] + '" aria-label="Add ' + esc(n[1]) + '"') + '</li>'; }).join('') : '<li class="muted">No item matches.</li>') + '</ul>';
  }
  function wantedTab(V, id, h, keys) {
    var shown = keys.filter(function (k) { var t = V.sc.targets[k]; return !(SH.view.hide && (t.done || (t.make && (t.crafted || 0) >= t.qty))); });
    return '<section class="lists-panel"><h2>Wanted</h2><div class="add-bar"><label>Add items <input type="search" data-f="search" autocomplete="off" value="' + esc(SH.view.search) + '" placeholder="Type part of an item name"></label> ' +
      '<label>Amount <input type="number" inputmode="numeric" min="1" max="99999" data-f="addqty" value="1"></label></div>' +
      '<div class="hits-box">' + hitsHtml() + '</div>' +
      (shown.length ? '<ul class="wanted">' + shown.map(function (k) { return renderRow(V, id, h, k); }).join('') + '</ul>' : '<p class="muted empty-line">' + (keys.length ? 'Everything here is finished or crafted.' : 'Add the first item.') + '</p>') +
      '<p class="muted">You type what you have. This app never reads the game. Clearing an amount keeps the old amount; only Remove removes.</p></section>';
  }
  function renderList() {
    var sc = sec(), id = SH.view.list, h = sc.lists[id];
    if (!h) { SH.view.list = null; return renderHome(); }
    var owner = S.ownerOf(h), V = buildV([id], owner), keys = targetsOf(sc, id), sids = stepIdsOf(h), steps = h.steps || {};
    if (SH.view.step !== null && !steps[SH.view.step]) SH.view.step = null;
    var sums = sumShares(V.plan, V.ids, SH.view.step), tab = SH.view.tab;
    var out = statusHtml() + '<div class="lists-bar">' + btn('Your lists', 'back') + '</div>' + noticeHtml(h, id, sc) +
      '<section class="lists-panel"><label class="list-title">List name <input type="text" data-f="listname" maxlength="60" value="' + esc(h.name || '') + '"></label>' +
      '<p class="muted">' + esc(nameOfChar(h.charId || '')) + ' · ' + (sids.length ? sids.length + ' step' + (sids.length === 1 ? '' : 's') + ': ' + sids.map(function (s) { return esc(steps[s].name); }).join(', ') : 'one step') + '</p>' +
      '<p class="row"><label>New step <input type="text" data-f="stepname" maxlength="60"></label> ' + btn('Add a step', 'addstep') + '</p>' + totalsLine(V) + barHtml(V) + '</section>' +
      tabsHtml(V, [['get', 'To get'], ['craft', 'To craft'], ['wanted', 'Wanted']]) + (tab === 'wanted' ? '' : stepsHtml(V, h, id));
    if (tab === 'get') out += '<section class="lists-panel tab-get">' + getTab(V, sums) + '</section>';
    else if (tab === 'craft') out += '<section class="lists-panel tab-craft">' + craftTab(V, sums) + '</section>';
    else out += wantedTab(V, id, h, keys);
    main.innerHTML = out;
  }
  // the combined view: the ticked lists of one character, each row the sum of their shares (spec section 7)
  function renderCombined() {
    var sc = sec(), owner = SH.view.combinedOwner, ids = S.combined(sc).filter(function (i) { return S.ownerOf(sc.lists[i]) === owner; });
    var out = statusHtml() + '<div class="lists-bar">' + btn('Your lists', 'back') + '</div>';
    if (ids.length < 2) { main.innerHTML = out + '<div class="lists-empty"><p>Tick two or more lists of one character.</p><p class="muted">Each character has its own stock.</p></div>'; return; }
    var V = buildV(ids, owner), sums = sumShares(V.plan, ids, null), tab = SH.view.tab === 'craft' ? 'craft' : 'get';
    out += '<section class="lists-panel"><h2>Combined view</h2><p class="muted">' + esc(V.char) + ' · ' + ids.map(function (i) { return esc(sc.lists[i].name || 'Untitled list'); }).join(', ') + '</p>' + totalsLine(V) + barHtml(V) + '</section>' +
      tabsHtml(V, [['get', 'To get'], ['craft', 'To craft']]) + '<section class="lists-panel tab-' + tab + '">' + (tab === 'craft' ? craftTab(V, sums) : getTab(V, sums)) + '</section>';
    main.innerHTML = out;
  }
  function render() {
    if (SH.problem) { main.innerHTML = '<div class="lists-note"><b>The save cannot be used here.</b> ' + esc(SH.problem) + ' Nothing has been written over it.' + (SH.note ? ' ' + esc(SH.note) : '') + '</div>'; return; }
    PR.want = []; PR.dirty = false;
    if (SH.view.log) { renderLog(); return; }
    if (SH.view.combined) renderCombined(); else if (SH.view.list) renderList(); else renderHome();
    loadPrices(false); // the one automatic attempt of this place (the service's own 15-minute gate decides)
  }

  // ------------------------------------------------------------------------------------------------ events
  var CTX = function () { return { now: Date.now() }; };
  function rowOf(el) { var li = el.closest('[data-key]'); if (!li) return null; var key = li.getAttribute('data-key'), i = key.indexOf('.'); return { key: key, list: key.slice(0, i), tid: key.slice(i + 1), item: +li.getAttribute('data-item'), q: li.getAttribute('data-q'), el: li }; }
  // a row of any tab: its item, the stock quality, the character and (on a plan row) the line
  function ctxOf(el) {
    var li = el.closest('.wanted-row, .line-row'); if (!li) return null;
    return { el: li, item: +li.getAttribute('data-item'), q: li.getAttribute('data-q'), owner: li.getAttribute('data-owner'), lk: li.getAttribute('data-lk'), key: li.getAttribute('data-key') };
  }
  function vendorQualities(item, q) { var tr = (DATA.trades && DATA.trades[item]) || []; return tr.some(function (o) { return o[1].length === 1 && o[1][0][0] === 1 && (o[2] ? 'hq' : 'nq') === (q === 'hq' ? 'hq' : 'nq'); }); }
  // how much of a must-craft item's output goes to which wanted items: list order, then step order (the engine's record)
  function creditsFor(sc, owner, item, made) {
    var out = {}, left = made;
    ownerListIds(sc, owner).forEach(function (lid) {
      var steps = sc.lists[lid].steps || {}, sids = stepIdsOf(sc.lists[lid]);
      var keys = targetsOf(sc, lid).filter(function (k) { var t = sc.targets[k]; return t.item === item && t.make && !t.done; });
      var idx = function (k) { var i = sids.indexOf(sc.targets[k].step); return steps && i > 0 ? i : 0; };
      keys.sort(function (a, b) { return idx(a) - idx(b); });
      keys.forEach(function (k) { var t = sc.targets[k], c = Math.min(left, t.qty - (t.crafted || 0)); if (c > 0) { out[k] = c; left -= c; } });
    });
    return out;
  }
  function makeKeysOf(sc, owner, item) {
    var out = [];
    ownerListIds(sc, owner).forEach(function (lid) { targetsOf(sc, lid).forEach(function (k) { var t = sc.targets[k]; if (t.item === item && t.make && !t.done) out.push(k); }); });
    return out;
  }
  function openList(id) { SH.view.list = id; SH.view.combined = false; SH.view.search = ''; SH.view.confirm = null; SH.view.bought = null; SH.view.step = null; SH.view.sheet = false; SH.note = ''; }
  main.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-act'), r = rowOf(b), c = ctxOf(b), listId = SH.view.list, card = b.closest('[data-list]');
    switch (a) {
      case 'from-log': loadCore().then(function () { openLog(null); render(); }, function (e) { SH.note = e.message; render(); }); break;
      case 'log-cancel': SH.view.log = null; render(); break;
      case 'log-char': SH.view.log.char = b.getAttribute('data-char'); render(); break;
      case 'log-create': {
        var LV = SH.view.log, ids = logCounts(LV.char, LV.job, LV.page).missing, lch = LV.char;
        act(logCreate(lch, LV.job, LV.page, ids), { after: function (x) { SH.view.log = null; if (x.id) openList(x.id); SH.view.tab = 'craft'; } });
        break;
      }
      case 'new': SH.view.form = true; render(); var nm = main.querySelector('[data-f=newname]'); if (nm) nm.focus(); break;
      case 'cancel-new': SH.view.form = false; render(); break;
      case 'create': {
        var form = b.closest('[data-form]'), name = form.querySelector('[data-f=newname]').value, ch = form.querySelector('[data-f=newchar]').value || null;
        act(function (s) { var x = S.newList(s, { name: name, charId: ch, stamp: DATA.stamp }, CTX()); return x; }, { after: function (x) { SH.view.form = false; if (x.id) openList(x.id); SH.view.tab = 'wanted'; } });
        break;
      }
      case 'open': openList(card.getAttribute('data-list')); SH.view.tab = 'wanted'; render(); break;
      case 'back': SH.view.list = null; SH.view.combined = false; SH.view.confirm = null; SH.view.bought = null; render(); break;
      case 'combined': SH.view.combined = true; SH.view.list = null; SH.view.combinedOwner = b.getAttribute('data-owner'); SH.view.tab = 'get'; SH.view.confirm = null; SH.view.bought = null; SH.view.sheet = false; SH.note = ''; render(); break;
      case 'tab': SH.view.tab = b.getAttribute('data-tab'); SH.view.confirm = null; SH.view.bought = null; render(); break;
      case 'step': SH.view.step = b.getAttribute('data-step') || null; SH.view.confirm = null; render(); break;
      case 'sec': { var sid = b.getAttribute('data-sec'); SH.view.open[sid] = !SH.view.open[sid]; render(); break; }
      case 'hide': { var hv = !SH.view.hide; SH.view.hide = hv; render(); act(function (s) { return prefEdit(s, 'hideDone', hv); }); break; }
      case 'prices': loadPrices(true); break;
      case 'noted': { var nid = SH.view.list; act(function (s) { return setListStamp(s, nid); }); break; }
      case 'sheet': SH.view.sheet = !SH.view.sheet; render(); break;
      case 'ask-remove-list': SH.view.confirm = 'list:' + card.getAttribute('data-list'); render(); break;
      case 'keep': SH.view.confirm = null; render(); break;
      case 'remove-list': { var lid = card.getAttribute('data-list'); SH.view.confirm = null; act(function (s) { return S.removeList(s, lid); }); break; }
      case 'add': {
        var qty = main.querySelector('[data-f=addqty]').value, item = +b.getAttribute('data-item'), rid = recipesOf(item)[0] || 0;
        act(function (s) { return labeled(S.addTarget(s, listId, { item: item, recipe: rid, qty: qty }, CTX()), 'Added ' + itemName(item)); });
        break;
      }
      case 'addstep': { var sn = main.querySelector('[data-f=stepname]').value; act(function (s) { return S.addStep(s, listId, sn, CTX()); }); break; }
      case 'done': { var t = sec().targets[r.key]; act(function (s) { return labeled(S.setDone(s, r.list, r.tid, !(t && t.done)), (t && t.done ? 'Marked not finished: ' : 'Finished: ') + itemName(r.item)); }); break; }
      case 'ask-remove': SH.view.confirm = r.key; render(); break;
      case 'remove': SH.view.confirm = null; act(function (s) { return labeled(S.removeTarget(s, r.list, r.tid), 'Removed ' + itemName(r.item)); }); break;
      case 'minus': case 'plus': act(function (s) { return labeled(S.adjustHave(s, c.owner, c.item, c.q, a === 'plus' ? 1 : -1), 'Changed what you have of ' + itemName(c.item)); }); break;
      case 'haveall': { var n = +b.getAttribute('data-n') || 0; act(function (s) { return labeled(S.adjustHave(s, c.owner, c.item, c.q, n), 'Had all of ' + itemName(c.item)); }); break; }
      case 'setway': { var by = b.getAttribute('data-by'); act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { by: by, offer: null }), 'Chose how to get ' + itemName(c.item)); }); break; }
      case 'ask-bought': SH.view.bought = c.lk ? 'L|' + c.lk : c.key; SH.view.mode = b.getAttribute('data-mode') || 'bought'; render(); var bn = main.querySelector('[data-f=boughtn]'); if (bn) { bn.focus(); bn.select(); } break;
      case 'cancel-bought': SH.view.bought = null; render(); break;
      case 'bought': {
        var units = c.el.querySelector('[data-f=boughtn]').value, other = SH.view.mode === 'other', owner = c.owner, makeKeys;
        if (c.lk) makeKeys = c.lk.split('|')[1] === 'make' ? makeKeysOf(sec(), owner, c.item) : [];
        else { var t2 = sec().targets[c.key]; makeKeys = t2 && t2.make ? [c.key] : []; }
        SH.view.bought = null;
        act(function (s) { return labeled(S.bought(s, { owner: owner, item: c.item, quality: c.q, units: units, makeKeys: makeKeys }), (other ? 'Got ' : 'Bought ') + Math.floor(Number(units)) + ' ' + itemName(c.item) + (other ? ' another way' : '')); }, { after: function () {
          var ways = []; if (!other) { if (vendorQualities(c.item, c.q)) ways.push('vendor'); if (itemFlags(c.item) & 1) ways.push('market'); }
          SH.rest = ways.length ? { owner: owner, item: c.item, ways: ways } : null;
        } });
        break;
      }
      case 'made': {
        var times = +b.getAttribute('data-crafts') || 1, lk = c.lk, mo = c.owner;
        act(function (s) {
          var plan = planOf(s, mo), ln = plan.lines[lk];
          if (!ln || ln.by !== 'craft') return { error: 'That craft is no longer in the plan.' };
          var credits = ln.part === 'make' ? creditsFor(s, mo, ln.item, times * ln.yield) : {};
          return labeled(S.record(s, DATA, mo, plan, { line: ln, times: times, quality: ln.quality, targets: credits }), 'Made ' + times + ' ' + itemName(ln.item));
        }, { after: function (res) { if (res.short && res.short.length) SH.note = RECORD_LINE; } });
        break;
      }
      case 'ask-handin': SH.view.confirm = 'step:' + SH.view.step; render(); break;
      case 'handin': {
        var stp = b.getAttribute('data-step'), ho = S.ownerOf(sec().lists[listId]), sname = (sec().lists[listId].steps[stp] || {}).name || 'a step';
        SH.view.confirm = null;
        act(function (s) { return labeled(S.finishStep(s, ho, planOf(s, ho), listId, stp), 'Handed in “' + sname + '”'); });
        break;
      }
      case 'order-up': case 'order-down': {
        var way = b.getAttribute('data-way'), oo = orderOwner();
        act(function (s) { var o = orderOf(s, oo), i = o.indexOf(way), j = a === 'order-up' ? i - 1 : i + 1; if (i < 0 || j < 0 || j > 4) return { section: s, entry: null }; o[i] = o[j]; o[j] = way; return S.setOrder(s, oo, o.join(' ')); });
        break;
      }
      case 'order-reset': { var ro = orderOwner(); act(function (s) { return S.setOrder(s, ro, DEFAULT_ORDER.join(' ')); }); break; }
      case 'rest': { var rest = SH.rest, by2 = b.getAttribute('data-by'); if (rest) act(function (s) { return labeled(S.setWay(s, rest.owner, rest.item, { by: by2 }), 'Chose how to get ' + itemName(rest.item)); }); break; }
      case 'undo': { var entry = SH.undo[+b.getAttribute('data-i')]; if (entry) act(function (s) { return S.undo(s, entry); }, { undoOf: entry }); break; }
    }
  });
  function orderOwner() { return SH.view.combined ? SH.view.combinedOwner : S.ownerOf(sec().lists[SH.view.list]); }
  main.addEventListener('input', function (ev) { if (ev.target.getAttribute && ev.target.getAttribute('data-f') === 'search') { SH.view.search = ev.target.value; var box = main.querySelector('.hits-box'); if (box) box.innerHTML = hitsHtml(); } });
  main.addEventListener('change', function (ev) {
    var el = ev.target, f = el.getAttribute && el.getAttribute('data-f'); if (!f) return;
    var r = rowOf(el), c = ctxOf(el), listId = SH.view.list;
    if (f === 'logjob') { SH.view.log.job = el.value === '' ? null : +el.value; SH.view.log.page = null; render(); return; }
    if (f === 'logpage') { SH.view.log.page = el.value === '' ? null : +el.value; render(); return; }
    if (f === 'logchar') { SH.view.log.char = el.value; render(); return; }
    if (f === 'qty') act(function (s) { return labeled(S.setQty(s, r.list, r.tid, el.value), 'Changed an amount of ' + itemName(r.item)); });
    else if (f === 'have') act(function (s) { return labeled(S.setHave(s, c.owner, c.item, el.getAttribute('data-q'), el.value), 'Changed what you have of ' + itemName(c.item)); });
    else if (f === 'flag') act(function (s) { return labeled(S.setFlag(s, r.list, r.tid, el.getAttribute('data-flag'), el.checked), 'Changed a setting of ' + itemName(r.item)); });
    else if (f === 'step') act(function (s) { return labeled(S.setStep(s, r.list, r.tid, el.value), 'Moved ' + itemName(r.item) + ' to another step'); });
    else if (f === 'way') { var v = el.value; act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { by: v || null, offer: null }), 'Chose how to get ' + itemName(c.item)); }); }
    else if (f === 'offer') { var key = el.value; act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { by: 'trade', offer: key }), 'Chose a trade for ' + itemName(c.item)); }); }
    else if (f === 'tick') { var id = el.closest('[data-list]').getAttribute('data-list'), on = el.checked; act(function (s) { return S.tickCombined(s, id, on); }); }
    else if (f === 'priceWorld') { var pw = el.value; act(function (s) { return prefEdit(s, 'priceWorld', pw); }); }
    else if (f === 'listname') act(function (s) { return S.renameList(s, listId, el.value); });
  });

  // another page saved (the Tracker after a cloud sync, another tab): show its change, once nothing of ours is waiting
  function reload() {
    if (SH.hold) return Promise.resolve(); // a test holds this page's copy to make it stale (__lists.hold)
    if (SH.busy || SH.queue.length) { SH.reloadLater = true; return Promise.resolve(); }
    return loadSave().then(function () { if (SH.view.list && !sec().lists[SH.view.list]) SH.view.list = null; render(); });
  }
  window.__lists = { reload: reload, state: SH, data: function () { return DATA; }, section: function () { return SH.sec; }, hold: function (on) { SH.hold = !!on; }, combined: function () { return S.combined(sec()); }, plan: function (owner, noPrices) { return planOf(sec(), owner, noPrices); }, prices: function () { return { place: priceScope(), cache: cache(), error: failNow(), busy: PR.busy }; } };
  setInterval(tickWindows, 15000); // the minutes to a timed node's window move on without a redraw
  window.addEventListener('hashchange', function () { if (DATA && !SH.problem) readHash(); });
  if (CC) CC.onChange(reload);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reload(); });
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).then(function (reg) {
      reg.update().catch(function () { /* offline */ });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { /* offline */ }); });
    }).catch(function () { /* works without offline support */ });
  }
  Promise.all([loadData(), loadSave()]).then(function () { render(); return readHash(); }).then(function () { document.documentElement.dataset.ready = '1'; })
    .catch(function (e) { main.innerHTML = '<div class="lists-note"><b>The game data could not be opened.</b> ' + esc(e && e.message) + '</div>'; });
})();
