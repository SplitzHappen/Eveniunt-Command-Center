// Eveniunt Command Center, Lists module page (work items W6 to W9 of docs/lists-spec.md): loads the one save and the data, shows "Your lists",
// makes and removes lists, and on a list's tabs To get, To craft and Wanted (and the combined view) plans every list of a character together, adds
// items, changes amounts and flags, finishes and removes them, takes the typed stock ("I have", minus, plus, "Have all"), "Made", "Bought it",
// "Get it by", the order of ways and the steps' hand-in, and shows Undo. W9 adds market prices (the shared price service, kept on this device only),
// the next window of a timed node, and the notice that the game data changed since a list was last checked. Every change goes through LISTS.store (the edit functions), and the page writes one save
// at a time, as the Submersibles page does. Nothing is read from the game: the player types what they have.
(function () {
  'use strict';
  var CC = window.CC, S = window.LISTS.store, E = window.LISTS;
  var main = document.getElementById('view'), tabsEl = document.getElementById('tabs'), statusEl = document.getElementById('lstatus');
  // SH: the page's working state. sec: the saved section as last read or written (null when none is stored); rev and base: what the next write is
  // measured against (as in subs.js). queue: edits waiting for the write in flight. undo: the last 20 changes of this visit, newest first.
  var SH = { problem: null, chars: [], tracker: null, log: null, sec: null, rev: null, base: null, queue: [], busy: null, reloadLater: false, undo: [], note: '', rest: null,
    view: { list: null, form: false, confirm: null, bought: null, mode: 'bought', search: '', tab: 'wanted', open: {}, step: null, hide: false, sheet: false, combined: false, combinedOwner: null, row: null, offers: {}, spots: {}, edit: {}, notice: false, noticeAll: false, more: null } };
  // the phone keeps its stepper in the opened row (one copy of every control: the checks and the page read one "I have" per row)
  var NARROW = window.matchMedia ? window.matchMedia('(max-width: 700px)') : { matches: false };
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
    var t = pi.text, i = t.indexOf(' before tax'), head = i >= 0 ? t.slice(0, i + 11) : t, more = i >= 0 ? t.slice(i + 11) : ''; // a phone shows the price; the place and the time are in the opened row
    return '<span class="price-line" data-price="' + (pi.gil || '') + '">' + esc(head) + (more ? '<span class="pl-more">' + esc(more) + '</span>' : '') + '</span>';
  }
  // "about N gil for M items; K items without a price" over the market rows the chosen lists share (spec section 6)
  function priceTotal(V, keys, sums, now) {
    var gil = 0, n = 0, none = [], seen = [], c = cache();
    keys.forEach(function (k) {
      var ln = V.plan.lines[k], pi = priceInfo(ln.item, now);
      if (pi.gil) { gil += pi.gil * sums[k].got; n++; seen.push(ln.item); } else none.push(itemName(ln.item));
    });
    var oldest = PS.oldest(c, seen), part = PR.partial && PR.errScope === priceScope() ? ' Some market prices could not be fetched; those items show their last known price.' : '';
    var attrs = ' data-gil="' + gil + '" data-priced="' + n + '" data-unpriced="' + none.length + '"';
    if (!n && none.length) return '<p class="price-total"' + attrs + '>No market prices yet: ' + none.length + ' item' + (none.length === 1 ? '' : 's') + ' without a price (' + esc(none.join(', ')) + ').' + esc(part) + '</p>'; // never "about 0 gil for 0 items"
    return '<p class="price-total"' + attrs + '>Buying on the market, before tax: about ' + gilText(gil) + ' for ' + n + ' item' + (n === 1 ? '' : 's') +
      (none.length ? '; ' + none.length + ' item' + (none.length === 1 ? '' : 's') + ' without a price (' + esc(none.join(', ')) + ')' : '') + (oldest ? ' (prices seen ' + esc(fmtClock(oldest, now)) + ')' : '') + '.' + esc(part) + '</p>';
  }
  function placeSelect() {
    var cur = (SH.sec && SH.sec.prefs && SH.sec.prefs.priceWorld) || '';
    return '<label class="lfield"><span>Market prices from</span><select data-f="priceWorld"><option value="">' + esc(priceScope()) + ' (shared place setting)</option>' +
      PLACES.map(function (d) { return '<option' + (cur === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label>';
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
  // R2: the window is the shown (chosen) spot's own; the engine's merged-free `timed` only stands in for data without spots
  function windowRow(ln, now, timed) {
    timed = timed === undefined ? ln.timed : timed;
    if (!timed) return '';
    var t = windowText(timed.hours, timed.minutes, now);
    return t ? '<span class="w-window" data-hours="' + esc(timed.hours.join(',')) + '" data-mins="' + timed.minutes + '">' + esc(t) + '</span>' : '';
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
      else if (!o && n) lines.push(nm + ' can now be crafted from ' + ingText(n) + '.'); // an added recipe (old row null, W14)
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
  // F4: a one-line slab under the list head ("Game data changed since this list was last checked · 3 changes in this list · Show"), opening into its lines
  function noticeHtml(h, id, sc) {
    var n = patchNotice(h, id, sc);
    if (!n) return '';
    var ok = rb('OK, noted', 'noted', '', 'lbtn-p');
    if (n.plain) return '<section class="patch-notice" role="status"><div class="pn-line"><p class="pn-t"><b>Game data changed since this list was last checked; the details for that version are not available.</b> Nothing in this list was changed.</p>' + ok + '</div></section>';
    var open = SH.view.notice, ls = n.lines, shownLines = open && !SH.view.noticeAll ? ls.slice(0, 5) : ls;
    return '<section class="patch-notice' + (open ? ' open' : '') + '" role="status"><div class="pn-line"><h2>Game data changed since this list was last checked</h2>' +
      (ls.length ? '<span class="pn-sum">' + ls.length + ' change' + (ls.length === 1 ? '' : 's') + ' in this list</span>' + lk(open ? 'Hide' : 'Show', 'notice', ' aria-expanded="' + (open ? 'true' : 'false') + '"') : '<span class="pn-sum">None of the recipes this list uses changed.</span>' + ok) + '</div>' +
      (open && ls.length ? '<div class="pn-body"><ul class="patch-lines">' + shownLines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' + (ls.length > 5 && !SH.view.noticeAll ? '<p class="acts-row">' + lk('Show all ' + ls.length + ' changes', 'notice-all') + '</p>' : '') +
        '<p class="muted">Nothing in this list was changed: every wanted item, amount, setting, step, way and stock count is kept.</p><p class="acts-row">' + ok + '</p></div>' : '') + '</section>';
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
    if (!res.entry && !res.expect) { if (res.capped) SH.note = S.lines.capped; render(); return null; } // nothing changed (a cleared amount keeps the old one)
    return CC.writeSection('lists', res.section, { rev: SH.rev, base: SH.base, expect: res.expect }).then(function (r) {
      SH.rev = r.rev; SH.base = clone(r.section); SH.sec = r.section; SH.chars = r.doc.chars; SH.tracker = (r.doc.modules && r.doc.modules.tracker) || SH.tracker;
      SH.note = ''; SH.rest = null;
      if (isUndo) dropEntry(job.o.undoOf);
      else if (res.entry) { SH.undo.unshift(res.entry); if (SH.undo.length > 20) SH.undo.length = 20; }
      if (job.o.after) job.o.after(res);
      if (res.capped) SH.note = SH.note ? SH.note + ' ' + S.lines.capped : S.lines.capped; // a count was kept at 999,999
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
  // No Undo for the two actions on a "Restored list": the save refuses a write that makes a wanted item without its list again (LI2), so an Undo would only be refused.
  function noUndo(res) { if (res && res.entry) dropEntry(res.entry); }
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
  // Free Company workshop projects (R4): a result item of DATA.projects; its kind 0 is a submarine part, 1 an airship part
  function projectOf(item) { return (DATA && DATA.projects && DATA.projects[item]) || null; }
  function projectWord(p) { return p[0] === 1 ? 'Airship part' : 'Submarine part'; }
  var PROJ_BY_NAME = null;
  function projectKindByName(name) { // the stamp on Your lists: a list named after a part with only "Phase n" steps (the save has no field for it)
    if (!PROJ_BY_NAME) { PROJ_BY_NAME = {}; Object.keys((DATA && DATA.projects) || {}).forEach(function (id) { var it = DATA.items[id]; if (it) PROJ_BY_NAME[it[0]] = DATA.projects[id][0]; }); }
    return Object.prototype.hasOwnProperty.call(PROJ_BY_NAME, name) ? PROJ_BY_NAME[name] : null;
  }
  function projectStamp(l) {
    var k = projectKindByName(l.name), st = l.steps || {}, ids = Object.keys(st);
    if (k === null || !ids.length || !ids.every(function (i) { return /^(Part \d+, )?Phase \d+$/.test(st[i].name); })) return '';
    return ' <span class="lstamp plain proj">' + projectWord([k]) + '</span>';
  }
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
  // The recipe a wanted item is planned with: its own when it is a recipe of the item, else the item's recipe of lowest level (the engine's rule).
  function recipeOfTarget(t) {
    var r = t.recipe && DATA.recipes[t.recipe];
    if (r && r[0] === t.item) return +t.recipe;
    return recipesOf(t.item)[0] || 0;
  }
  // W14: a must-craft or collectable line belongs to one recipe, so the row's own line is the one of its own recipe, never another recipe of the product
  function lineFor(plan, t) {
    var keys = plan.items[t.item] || [], want = t.make ? 'make' : t.coll ? 'coll' : t.hq ? 'hq' : 'normal', found = null, fb = null, rid = recipeOfTarget(t);
    keys.forEach(function (k) { var ln = plan.lines[k]; if (ln.part === want && (want === 'make' || want === 'coll' ? ln.recipe === rid : true) && !found) found = ln; if (ln.part === 'normal' && !fb) fb = ln; });
    // W15: a must-craft row crafted in full has no line and never borrows another recipe's line (W16: one not yet complete shows its actual plan line, as when no recipe is usable)
    if (t.make && (t.crafted || 0) >= t.qty) return found;
    var other = null; keys.forEach(function (k) { var ln = plan.lines[k]; if (!other && ln.part !== 'make' && ln.part !== 'coll') other = ln; });
    return found || fb || other;
  }
  function askedQuality(t) { return t.coll ? 'coll' : t.hq ? 'hq' : 'nq'; }
  // a must-craft wanted item's stock is counted in the quality it asks for (W14); any other row follows its plan line
  function qualityOf(t, ln) { return t.make && ln && ln.part === 'make' ? askedQuality(t) : ln && ln.quality ? ln.quality : askedQuality(t); }
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
  // R3: Crystals (shards, crystals and clusters that are gathered) before Gather; Currencies to earn (a display group of the way "other") before Other
  var SECTIONS = [['vendor', 'Buy from a merchant (gil)'], ['crystal', 'Crystals'], ['gather', 'Gather'], ['trade', 'Trade for other currencies'], ['market', 'Buy on the market'], ['earn', 'Currencies to earn'], ['other', 'Other'], ['have', 'Not in your typed stock'], ['left', 'Left over']];
  var CUR_LINE = 'This is a currency: it is earned, not bought';
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
  // R3: a currency that nothing here can give (tomestones, scrips, seals, tokens: the way "other") is earned, not bought, so it is counted apart from "to get"
  var CURSET = null;
  function isCurrency(item) { if (!CURSET) { CURSET = {}; (DATA.currencies || []).forEach(function (i) { CURSET[i] = 1; }); } return !!CURSET[item]; }
  function isEarn(ln) { return ln.by === 'other' && isCurrency(ln.item); }
  function isCrystal(item) { return (itemFlags(item) & 8) !== 0; }
  function figures(plan, sums) {
    var get = 0, craft = 0, earn = 0;
    Object.keys(sums).forEach(function (k) { var ln = plan.lines[k], x = sums[k]; if (ln.by === 'craft') craft += x.crafts; else if (isEarn(ln)) earn += x.got; else if (ln.by !== 'have') get += x.got; });
    return { get: get, craft: craft, earn: earn };
  }
  // the character's totals as tallies: to get, to craft, and (only when there is something) to earn; their words are the screen's accessible text
  function talliesHtml(f, who, cls) {
    return '<div class="tallies' + (f.earn ? ' three' : '') + (cls ? ' ' + cls : '') + '" role="group" aria-label="Totals for ' + esc(who) + ': ' + f.get + ' to get, ' + f.craft + ' to craft' + (f.earn ? ', ' + f.earn + ' to earn' : '') + '." data-get="' + f.get + '" data-craft="' + f.craft + '" data-earn="' + f.earn + '">' +
      '<span class="tally ' + (f.get ? 'r-short' : 'r-ready') + '"><b>' + f.get + '</b><span>to get</span></span><span class="tally r-craft"><b>' + f.craft + '</b><span>to craft</span></span>' + (f.earn ? '<span class="tally r-slab"><b>' + f.earn + '</b><span>to earn</span></span>' : '') + '</div>';
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
  // F2: quality stamps stay on every row; the ordinary quality is the default and is not stamped. "Must craft" is the stamp of the tick "Must be crafted by me".
  function stamp(ln) {
    var t = ln.part === 'make' ? 'Must craft' : ln.part === 'coll' ? 'Collectable' : ln.part === 'hq' ? 'High quality' : '';
    return t ? ' <span class="lstamp plain">' + t + '</span>' : '';
  }
  // W11: the way a row is got, told in a word and drawn in its role (craft, gather, merchant, market); a trade is a merchant role told apart by its word
  var WAY_WORD = { vendor: ['merchant', 'Merchant'], trade: ['merchant', 'Trade'], gather: ['gather', 'Gather'], market: ['market', 'Market'] };
  function wayPill(ln, craft) { var w = craft ? ['craft', 'Craft'] : WAY_WORD[ln.by]; return w ? ' <span class="role role-' + w[0] + '">' + w[1] + '</span>' : ''; }
  // why this way (D15): the seller, "You chose this", a loop's note
  function reasonText(V, ln, x) {
    var p = [], off = ln.offer, w = V.sc.ways[V.owner + '.' + ln.item] || {};
    if (ln.by === 'vendor' && off) {
      var sl = seller(shownNpc(V, ln)), g = off.cur[0][1]; // R3: among sellers at the same price, the one in a place the plan already visits (display only)
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
    } else if (ln.by === 'gather' && ln.node) {
      var cs = chosenSpot(ln.item, V.plan);
      if (cs) { p.push('Gathered by ' + (GATHER_JOBS[cs.spot[0]] || 'a gatherer') + ', level ' + cs.spot[2] + (cs.spot[3] ? ', in ' + cs.spot[3] : '')); if (cs.why) p.push(cs.why); }
      else p.push('Gathered by ' + (GATHER_JOBS[ln.node.job] || 'a gatherer') + ', level ' + ln.node.level + ', in ' + ln.node.zone);
    }
    else if (ln.by === 'market') p.push('Bought on the market board');
    else if (ln.by === 'have') p.push((x ? x.outside : ln.outside) + ' not in your typed stock: you said you already have these');
    else if (ln.by === 'other') p.push(isCurrency(ln.item) ? CUR_LINE : 'No way to get this is known');
    if (ln.part === 'make') p.push('You marked this as “Must be crafted by me”');
    if (ln.part === 'coll') p.push('Collectables are always crafted');
    if (ln.why === 'chosen' && !isCrafted(ln)) p.push('You chose this');
    if (w.by === 'market' && isCurrency(ln.item) && !isCrafted(ln)) { if (p.indexOf(CUR_LINE) < 0) p.push(CUR_LINE); } // R3: a market way stored for a currency says why it is not used
    else if (w.by && w.by !== 'have' && !isCrafted(ln) && waysOf(V, ln.item, 'normal').indexOf(w.by) < 0 && waysOf(V, ln.item, 'hq').indexOf(w.by) < 0) p.push('The way you chose is no longer available in the game data; using the usual order. Your choice is still stored');
    else if (w.by === 'trade' && w.offer && !isCrafted(ln) && ['normal', 'hq'].every(function (qq) { return !offersFor(ln.item, qq).trade.some(function (o) { return o[4] + '.' + o[0] + '.' + o[1][0][0] === w.offer; }); })) p.push('The trade you chose is no longer in the game data; using the usual one. Your choice is still stored');
    var s = p.map(function (t) { return t.charAt(0).toUpperCase() + t.slice(1); }).join('. ') + (p.length ? '.' : '');
    if (V.plan.cut[ln.item]) s += (s ? ' ' : '') + V.plan.cut[ln.item];
    return s;
  }
  // D-C2: a job named in a sentence ("Crafted by Weaver", "Gathered by Miner") has its picture before the name
  function withJobIcon(html) { return html.replace(new RegExp('\\b(Crafted|Gathered) by (' + JOBS.concat(GATHER_JOBS).join('|') + ')\\b'), function (m, a, j) { return a + ' by ' + jobImg(j, false, 'jd') + j; }); }
  function reasonOf(V, ln, x) { var s = reasonText(V, ln, x); return s ? '<p class="why">' + withJobIcon(esc(s)) + '</p>' : ''; }
  // the opened gather row lists its spots, so the first sentence (which names one of them) is left out
  function reasonRest(V, ln, x) { var s = reasonText(V, ln, x), i = s.search(/\.( |$)/), r = i < 0 ? '' : s.slice(i + 1).trim(); return r ? '<p class="why">' + withJobIcon(esc(r)) + '</p>' : ''; }
  function firstSentence(s) { var i = s.search(/\.( |$)/); return i < 0 ? s : s.slice(0, i + 1); }
  // ---- R3: vendors by place, high quality, master books, copy name ----
  // The places a plan goes to: the zone of the chosen spot of every gather row and the planned seller's place of every vendor row (rows that still
  // have something to get). A vendor row shows, among the sellers at its planned price, the one in the most visited place (engine shownSeller).
  function visitsOf(V) {
    if (V.visits) return V.visits;
    var v = {};
    V.plan.shop.gather.forEach(function (k) { var cs = chosenSpot(V.plan.lines[k].item, V.plan), z = cs ? cs.spot[3] : V.plan.lines[k].node && V.plan.lines[k].node.zone; if (z) v[z] = (v[z] || 0) + 1; });
    V.plan.shop.vendor.forEach(function (k) { var o = V.plan.lines[k].offer, z = o && seller(o.npc).zone; if (z) v[z] = (v[z] || 0) + 1; });
    return (V.visits = v);
  }
  function shownNpc(V, ln) {
    var off = ln.offer, list = DATA.sellers && DATA.sellers[ln.item];
    if (!off || !list || !V.plan.shop) return off && off.npc;
    var own = seller(off.npc).zone, vis = Object.assign({}, visitsOf(V));
    if (own && vis[own] && V.plan.shop.vendor.some(function (k) { return V.plan.lines[k] === ln; })) vis[own]--; // the row's own place does not count for itself
    return E.shownSeller(list, off.npc, function (n) { return seller(n).zone; }, vis);
  }
  function matsOf(V) { return V.mats || (V.mats = E.materialsOf(DATA, V.plan)); }
  // a material that can be had in high quality by crafting or from a merchant (the market's "high quality" is not a way the plan can make)
  function hqAble(V, item) { return canHq(item) && waysOf(V, item, 'hq').some(function (w) { return w !== 'market'; }); }
  function hqOn(V, item) { return !!(V.sc.ways[V.owner + '.' + item] || {}).hq; }
  function hqBlock(V, ln) {
    if (isCrafted(ln) || !matsOf(V)[ln.item]) return '';
    var on = hqOn(V, ln.item);
    if (!on && !hqAble(V, ln.item)) return '';
    return '<label class="chk ltick w-hq"><input type="checkbox" data-f="hqway"' + (on ? ' checked' : '') + '> Need it in high quality</label>';
  }
  // the materials of a plan that "High quality for every material" would set (not yet set, and can be had in high quality)
  function hqTodo(V) { return Object.keys(matsOf(V)).map(Number).filter(function (i) { return !hqOn(V, i) && hqAble(V, i); }).sort(function (a, b) { return a - b; }); }
  // one change, one Undo: every named material's way gets hq (the store's own setWay, its undo units joined)
  function hqAllEdit(owner) {
    return function (s) {
      var V = { sc: s, owner: owner, plan: planOf(s, owner) }, items = hqTodo(V), sec = s, units = [], i, r;
      for (i = 0; i < items.length; i++) {
        r = S.setWay(sec, owner, items[i], { hq: true });
        if (r.error) return r;
        if (r.entry) { units = units.concat(r.entry.units); sec = r.section; }
      }
      if (!units.length) return { section: s, entry: null };
      return { section: sec, entry: { label: 'Needed high quality for ' + items.length + ' material' + (items.length === 1 ? '' : 's'), units: units } };
    };
  }
  // master book, expert, specialist and stars of a recipe (data: recipe flags 2 expert, 4 specialist, 32 master book; books { recipe: bookItem })
  function bookOf(rid) { var b = DATA.books && DATA.books[rid]; return b ? { item: b, name: (DATA.bookNames && DATA.bookNames[b]) || itemName(b) } : null; }
  function recipeStamps(rid) {
    var r = DATA.recipes[rid], bk = bookOf(rid), t = '';
    if (!r) return '';
    if (bk) t += ' <span class="lstamp plain rs-book">' + esc(bk.name) + '</span>';
    if (r[6] & 2) t += ' <span class="lstamp plain rs-expert">Expert</span>';
    if (r[6] & 4) t += ' <span class="lstamp plain rs-spec">Specialist</span>';
    if (r[4] > 0) t += ' <span class="lstamp plain rs-stars">' + r[4] + (r[4] === 1 ? ' star' : ' stars') + '</span>';
    return t;
  }
  // the opened craft row's one sentence about the recipe: the book (and, when the Tracker says it is not ticked, that), Expert, Specialist and the stars
  function recipeFacts(rid, warn) {
    var r = DATA.recipes[rid], bk = bookOf(rid), p = [];
    if (!r) return '';
    if (bk) p.push(warn ? bk.name + ' is not ticked for ' + warn.who + ' in the Tracker' : 'Needs ' + bk.name);
    if (r[6] & 2) p.push('Expert recipe');
    if (r[6] & 4) p.push('Specialist recipe');
    if (r[4] > 0) p.push(r[4] + (r[4] === 1 ? ' star' : ' stars'));
    return p.length ? '<p class="why rfacts' + (warn ? ' bookwarn' : '') + '">' + esc(p.join('. ')) + '.</p>' : '';
  }
  // The book warning: the Tracker's "Master Crafting Books" tick of the list's character, read with the Tracker's own reader (as the crafting log does).
  // No character, no entry for the book, or the reader not loaded yet: no warning (never a guess). The reader is loaded once, then the page redraws.
  var NEED_CORE = false, CORE_TRIED = false;
  function bookWarn(V, ln) {
    var bk = bookOf(ln.recipe);
    if (!bk || V.owner === 'u') return null;
    var entry = DATA.bookTicks && DATA.bookTicks[bk.item];
    if (entry === undefined) return null;
    if (!(window.ET && window.ET.fromSaveDoc && window.ET.isTicked)) { NEED_CORE = true; return null; }
    if (!V.tstate) V.tstate = trackerState();
    return window.ET.isTicked(V.tstate, V.owner, window.ET.key('masterbooks', entry)) ? null : { name: bk.name, who: V.char };
  }
  // copy an item's name: the clipboard, else a hidden text box that is selected and copied
  function copyText(t) {
    function fallback() {
      var ta = document.createElement('textarea'), ok = false;
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return fallback(); });
    return Promise.resolve(fallback());
  }

  // ---- the row kit (docs/lists-look-spec.md section 3): icons, spots, the stepper and one row shell shared by To get, To craft and Wanted ----
  var CHEV = '<svg class="lchev" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M4 2l5 5-5 5"/></svg>';
  function rb(label, act, extra, cls) { return '<button type="button" class="' + (cls || 'lbtn-o') + '" data-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>'; }
  // D-C1, D-G1: a job's picture; the name is the picture's alt text where no name is written beside it
  function jobImg(name, alt, cls) { return name ? '<img class="jicon ' + (cls || 'jr') + '" src="classjob/' + name.toLowerCase() + '.png" alt="' + (alt ? esc(name) : '') + '" width="24" height="24">' : ''; }
  function crafterJobs(item) { var seen = {}, out = []; recipesOf(item).forEach(function (r) { var j = DATA.recipes[r][2]; if (!seen[j]) { seen[j] = 1; out.push(j); } }); return out; }
  // every crafter's (or gatherer's) picture, always all of them (never "+N"): beside the name on a desktop row, in one strip under it on a phone
  function iconSet(names) {
    return names.length ? ' <span class="jset">' + names.map(function (n) { return jobImg(n, true); }).join('') + '</span>' : '';
  }
  // D-C1: the name's last word keeps its chevron (a wrapped name never leaves the chevron alone on a line)
  function nameHtml(name) {
    var i = String(name).lastIndexOf(' ');
    return (i < 0 ? '' : esc(name.slice(0, i)) + ' ') + '<span class="nb">' + esc(i < 0 ? name : name.slice(i + 1)) + CHEV + '</span>';
  }
  function spotsOf(item) { return (DATA.spots && DATA.spots[item]) || []; }
  // R2: the one spot a gather row shows (engine LISTS.chosenSpot: a zone the plan's other gather rows can use first, then the lowest
  // level); the row's level, node, zone, position, aetheryte and window, the drawer's sentence and the order of the spot list use it
  function chosenSpot(item, plan) { return E.chosenSpot(item, { spots: DATA.spots, plan: plan }); }
  function chosenTimed(c) { return c.spot[7] && c.spot[7].length && c.spot[8] > 0 ? { hours: c.spot[7], minutes: c.spot[8] } : null; }
  function spotName(s) { return s[0] === 2 ? (s[11] || 'Fishing spot') : (DATA.nodeNames && DATA.nodeNames[s[1]]) || ''; }
  // D-G1: "Lv. 5 Rocky Outcrop · Lower La Noscea (X 26, Y 21) · Aleport"; an item with no position says so and names its zone when it is known
  function spotText(s) {
    var pos = s[4] > 0 || s[5] > 0, zone = s[3] || '', nm = spotName(s), head = 'Lv. ' + s[2] + (nm ? ' ' + nm : '');
    var place = pos ? zone + ' (X ' + +s[4] + ', Y ' + +s[5] + ')' : 'No map position in the game data' + (zone ? ' · ' + zone : '');
    var ae = pos && s[6] && DATA.aetherytes && DATA.aetherytes[s[6]];
    return [head, place, ae].filter(Boolean).join(' · ');
  }
  function spotExtras(s, now) {
    var p = [];
    if (s[7] && s[7].length) { var t = windowText(s[7], s[8], now); if (t) p.push(t); }
    if (s[9]) p.push('needs ' + s[9]);
    if (s[10]) p.push('hidden item');
    return p.join(' · ');
  }
  function spotsBlock(ln, cs) {
    var sp = spotsOf(ln.item), all = !!SH.view.spots[ln.key], now = Date.now(), lim = NARROW.matches ? 2 : 3;
    if (!sp.length) return '';
    if (cs && cs.index) sp = [cs.spot].concat(sp.slice(0, cs.index), sp.slice(cs.index + 1)); // the shown spot first; every spot stays listed
    var h = '<ul class="spots">' + (all ? sp : sp.slice(0, lim)).map(function (s) {
      var x = spotExtras(s, now);
      return '<li>' + jobImg(GATHER_JOBS[s[0]], false, 'jd') + '<span>' + esc(spotText(s)) + (x ? ' <span class="sx">' + esc(x) + '</span>' : '') + '</span></li>';
    }).join('') + '</ul>';
    return h;
  }
  // "N more spots" folds the rest past three (two on a phone); it sits on the line of the drawer's other links
  function spotsLink(ln) {
    var sp = spotsOf(ln.item), all = !!SH.view.spots[ln.key], lim = NARROW.matches ? 2 : 3;
    return sp.length > lim ? lk(all ? 'Show fewer spots' : (sp.length - lim) + ' more spots', 'spots', ' data-k="' + esc(ln.key) + '" aria-expanded="' + (all ? 'true' : 'false') + '"') : '';
  }
  // F5, A2: minus, the figure, plus; on a phone it sits in the opened row (a larger one with its label above)
  function stepperHtml(name, typed, q, drawer) {
    return '<span class="stepper' + (drawer ? ' big' : '') + '" role="group" aria-label="I have"><button type="button" class="stp" data-act="minus" aria-label="One less ' + esc(name) + '">' + svg(ICO.minus, 14) + '</button>' +
      '<label class="fld">' + (drawer ? '' : '<small>have</small>') + '<input type="number" inputmode="numeric" min="0" max="999999" data-f="have" data-q="' + q + '" value="' + typed + '" aria-label="I have"></label>' +
      '<button type="button" class="stp" data-act="plus" aria-label="One more ' + esc(name) + '">' + svg(ICO.plus, 14) + '</button></span>';
  }
  // R3: on a phone "Copy name" sits beside the stepper (the drawer's links line is full there); elsewhere it is in the links line (wayActs)
  function stepperBlock(name, typed, q) { return NARROW.matches ? '<div class="inl"><span class="lab">I have</span>' + stepperHtml(name, typed, q, true) + lk('Copy name', 'copy') + '</div>' : ''; }
  // o: cls, attrs, role, rk, fig, word, wcls, name, stamps, icons, l2, mid, prim, done, drawer() (drawn only for the one open row, so closed rows stay cheap)
  function rowHtml(o) {
    var open = SH.view.row === o.rk;
    return '<li class="' + o.cls + (open ? ' open' : '') + '"' + o.attrs + '><div class="lr ' + o.role + (open ? ' open' : '') + (o.done ? ' done' : '') + '"><span class="cnt w1"><i' + (o.wcls ? ' class="' + o.wcls + '"' : '') + '>' + o.word + '</i> <b>' + o.fig + '</b></span>' +
      '<button type="button" class="opener' + (o.l3 ? ' has3' : '') + (o.win ? ' win' : '') + '" data-act="row" data-rk="' + esc(o.rk) + '" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="l1"><span class="nm w-name">' + nameHtml(o.name) + '</span>' + (o.stamps || '') + (o.icons || '') + '</span><span class="l2">' + o.l2 + '</span>' + (o.l3 ? '<span class="l3">' + o.l3 + '</span>' : '') + '</button>' +
      '<span class="st-col">' + (o.mid || '') + '</span><span class="pc">' + (o.prim || '') + '</span></div>' + (open ? '<div class="drawer ' + o.role + '">' + o.drawer() + '</div>' : '') + '</li>';
  }
  function offerKey(o) { return o[4] + '.' + o[0] + '.' + o[1][0][0]; }
  function offerText(o) { return seller(o[4]).name + ': ' + curText(o[1]) + ' for ' + o[0]; }
  // "Get it by" select with its label above, "Craft it instead", the chosen trade with "Other offers (N)" (F4), the link to the order of ways; none on a must-craft or collectable row
  function wayBlock(V, ln, beside) {
    if (isCrafted(ln)) return '';
    var item = ln.item, q = qWayOf(ln), ways = waysOf(V, item, q), stored = (V.sc.ways[V.owner + '.' + item] || {}).by || '';
    var sel = stored === 'have' || ways.indexOf(stored) >= 0 ? stored : '';
    var h = '<div class="w-way"><div class="selrow"><label class="lfld"><span class="lab">Get it by</span><select data-f="way">' + ['']
      .concat(ways).concat(['have']).map(function (v) { return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + esc(WAY_LABEL[v]) + '</option>'; }).join('') + '</select></label>' + (beside || '') + '</div>';
    h += '<p class="fine">This applies wherever ' + esc(V.char) + ' needs this item.</p>';
    if (ln.by === 'trade') {
      var trades = offersFor(item, q).trade;
      if (trades.length > 1) {
        var cur = trades.filter(function (o) { return ln.offer && ln.offer.key === offerKey(o); })[0] || trades[0], open = !!SH.view.offers[ln.key];
        h += '<div class="offers"><p class="why">Chosen trade: ' + esc(offerText(cur)) + '</p><p class="acts-row">' + lk('Other offers (' + (trades.length - 1) + ')', 'offers', ' data-k="' + esc(ln.key) + '" aria-expanded="' + (open ? 'true' : 'false') + '"') + '</p>' +
          (open ? '<div class="radios" role="radiogroup" aria-label="Other offers">' + trades.map(function (o) {
            var k = offerKey(o);
            return '<label class="rad' + (k === offerKey(cur) ? ' on' : '') + '"><input type="radio" name="offer-' + esc(ln.key) + '" data-f="offer" value="' + k + '"' + (k === offerKey(cur) ? ' checked' : '') + '><span>' + esc(offerText(o)) + '</span></label>';
          }).join('') + '</div>' : '') + '</div>';
      }
    }
    return h + '</div>';
  }
  // the one wrapping line of a drawer's other actions: at most two outline buttons, then text links; "Order of ways" is in every drawer
  function wayActs(V, ln, btns, links, noCopy) {
    var craftIt = ln && !isCrafted(ln) && ln.by === 'vendor' && ln.why === 'order' && waysOf(V, ln.item, qWayOf(ln)).indexOf('craft') >= 0 ? rb('Craft it instead', 'setway', ' data-by="craft"', 'lbtn-o') : '';
    return '<p class="acts-row">' + (btns || '') + craftIt + lk('Order of ways', 'order-open') + (noCopy ? '' : lk('Copy name', 'copy')) + (links || '') + '</p>';
  }
  function boughtBox(V, rowKey, need, q) {
    if (SH.view.bought !== rowKey) return '';
    var other = SH.view.mode === 'other';
    return '<div class="w-bought"><label class="lfld"><span class="lab">' + (other ? 'How many did you get?' : 'How many did you buy?') + '</span><input type="number" inputmode="numeric" min="1" max="999999" data-f="boughtn" value="' + Math.max(1, need) + '"></label><p class="fine">in ' + qWord(q) + ' quality</p><p class="acts-row">' +
      rb('Add to my stock', 'bought', '', 'lbtn-o') + lk('Cancel', 'cancel-bought') + '</p></div>';
  }
  function rowAttrs(V, key, ln, q) { return ' data-lk="' + esc(key) + '" data-item="' + ln.item + '" data-q="' + q + '" data-owner="' + esc(V.owner) + '"'; }

  // a row of To get: count block, name and facts, the stepper (desktop) and the one quiet primary; everything else in the opened row
  var ROLE_OF = { vendor: 'r-merchant', trade: 'r-merchant', gather: 'r-gather', market: 'r-market' };
  function getRow(V, key, x) {
    var ln = V.plan.lines[key], name = itemName(ln.item), q = ln.quality, typed = typedOf(V, ln.item, q), held = heldFor(V, key), now = Date.now(), outside = ln.by === 'have';
    var sp = ln.by === 'gather' ? spotsOf(ln.item) : [], cs = sp.length ? chosenSpot(ln.item, V.plan) : null, why = cs ? spotText(cs.spot) + (cs.why ? ' · ' + cs.why : '') : ln.by === 'other' ? reasonText(V, ln, x) : firstSentence(reasonText(V, ln, x));
    var l2 = '<span class="w-count">need ' + x.need + ', have ' + typed + '</span>' + (ln.by === 'vendor' || ln.by === 'trade' ? ' (' + x.trades + ' purchase' + (x.trades === 1 ? '' : 's') + ')' : '') +
      (held.length ? ' · <span class="held">' + esc(held.join(', ')) + '</span>' : '') + (why ? '<span class="dsk' + (sp.length ? ' keep' : '') + '"> · ' + esc(why) + '</span>' : '') +
      '';
    var l3 = (ln.by === 'gather' ? (cs ? windowRow(ln, now, chosenTimed(cs)) : windowRow(ln, now)) : '') + (ln.by === 'market' ? priceRow(ln, now) : '');
    var jobs = []; sp.forEach(function (s) { var n = GATHER_JOBS[s[0]]; if (n && jobs.indexOf(n) < 0) jobs.push(n); });
    if (ln.by === 'gather' && l3) l3 = '<span class="jm">' + iconSet(jobs) + '</span>' + l3; // a phone shows a timed row's pictures on the window's line (the row stays within 96 px); a desktop row beside the name
    var earn = isEarn(ln);
    return rowHtml({ cls: 'line-row get-row', attrs: rowAttrs(V, key, ln, q), role: earn ? 'r-slab' : ROLE_OF[ln.by] || 'r-short', rk: 'g|' + key, fig: outside ? x.outside : x.got || x.short, word: outside ? 'not typed' : earn ? 'to earn' : 'to get', wcls: outside || earn ? '' : 'role role-short',
      name: name, stamps: (V.combined ? wayPill(ln, false) : '') + stamp(ln), icons: iconSet(jobs), l2: l2, l3: l3, win: ln.by === 'gather' && !!l3,
      mid: NARROW.matches ? '' : stepperHtml(name, typed, q, false), prim: outside ? '' : rb('Have all', 'haveall', ' data-n="' + x.short + '"', 'lbtn-r'),
      drawer: function () { return (sp.length ? reasonRest(V, ln, x) : reasonOf(V, ln, x)) + (ln.by === 'market' ? '<p class="why">' + esc(priceInfo(ln.item, now).text) + '</p>' : '') + (ln.by === 'gather' ? spotsBlock(ln, cs) : '') + stepperBlock(name, typed, q) + wayBlock(V, ln, hqBlock(V, ln)) + wayActs(V, ln, '', ln.by === 'gather' ? spotsLink(ln) : '', NARROW.matches); } });
  }
  function makeProgress(V, item, recipe) {
    var c = 0, q = 0;
    V.ids.forEach(function (lid) { targetsOf(V.sc, lid).forEach(function (k) { var t = V.sc.targets[k]; if (t.item === item && t.make && !t.done && recipeOfTarget(t) === recipe) { c += Math.min(t.crafted || 0, t.qty); q += t.qty; } }); });
    return { crafted: c, qty: q };
  }
  // The qualities the must-craft wanted items of one line (item and recipe) still ask for, the one "Made" records first: collectable, else high quality, else ordinary.
  function madeQualities(sc, owner, item, recipe) {
    var has = {};
    makeKeysOf(sc, owner, item, recipe).forEach(function (k) { var t = sc.targets[k]; if ((t.crafted || 0) < t.qty) has[askedQuality(t)] = 1; });
    return ['coll', 'hq', 'nq'].filter(function (q) { return has[q]; });
  }
  // the quality "Made" records for a line: the player's choice on the row when it is one of the asked qualities, else the first asked one
  function madeQuality(sc, owner, ln, lk) {
    if (ln.part !== 'make') return ln.quality;
    var qs = madeQualities(sc, owner, ln.item, ln.recipe), pick = (SH.view.madeQ || {})[lk];
    return pick && qs.indexOf(pick) >= 0 ? pick : qs[0] || 'nq';
  }
  // D-C1: every job that can craft the item, with its level; where their materials differ, which recipe is counted and (not on a must-craft or collectable row, which keep their own recipe) a choice
  function ingKey(rid) { return JSON.stringify((DATA.recipes[rid][5] || []).map(function (i) { return [i[0], i[1]]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; })); }
  function crafterBlock(ln) {
    var rs = recipesOf(ln.item), jobs = {};
    rs.forEach(function (r) { jobs[DATA.recipes[r][2]] = 1; });
    if (Object.keys(jobs).length < 2) return '';
    var differ = rs.some(function (r) { return ingKey(r) !== ingKey(rs[0]); }), label = function (r) { return (JOBS[DATA.recipes[r][2]] || 'A crafter') + ', level ' + DATA.recipes[r][3]; };
    var h = '<div class="w-crafters"><p class="why">Crafters: ' + rs.map(function (r) { return jobImg(JOBS[DATA.recipes[r][2]], false, 'jd') + esc(label(r)); }).join('; ') + '.</p>';
    if (differ) {
      h += '<p class="why">Materials differ by crafter; counted for ' + esc(JOBS[DATA.recipes[ln.recipe][2]] || 'a crafter') + '.</p>';
      if (ln.part !== 'make' && ln.part !== 'coll') h += '<label class="lfld"><span class="lab">Count materials for</span><select data-f="countrecipe">' + rs.map(function (r) { return '<option value="' + r + '"' + (r === ln.recipe ? ' selected' : '') + '>' + esc(label(r)) + '</option>'; }).join('') + '</select></label>';
    }
    return h + '</div>';
  }
  function craftRow(V, key, x) {
    var ln = V.plan.lines[key], name = itemName(ln.item), q = madeQuality(V.sc, V.owner, ln, key), spare = V.plan.spare[key] || 0, rowKey = 'L|' + key, mp = ln.part === 'make' ? makeProgress(V, ln.item, ln.recipe) : null;
    var mqs = ln.part === 'make' ? madeQualities(V.sc, V.owner, ln.item, ln.recipe) : [], jobs = crafterJobs(ln.item).map(function (j) { return JOBS[j]; });
    var warn = bookWarn(V, ln), rst = recipeStamps(ln.recipe);
    // the book, Expert, Specialist and stars are stamps beside the name on a desktop; the warning is a stamp there and the first words of the facts line on a phone (a phone row stays within 96 px);
    // the opened row says it all in one sentence
    var l2 = (warn ? '<span class="bk-l2">Book not ticked · </span>' : '') + '<span class="w-count">' + x.crafts + ' craft' + (x.crafts === 1 ? '' : 's') + ', makes ' + x.makes + '</span>' + (spare ? ' · spare: ' + spare : '') + (mp ? '<span class="cr"> · ' + mp.crafted + ' of ' + mp.qty + ' crafted</span>' : '') + ' · level ' + DATA.recipes[ln.recipe][3];
    var bar = mp ? '<span class="prog"><span class="bar" aria-hidden="true"><i style="width:' + Math.round(100 * Math.min(1, mp.crafted / Math.max(1, mp.qty))) + '%"></i></span><span class="fig">' + mp.crafted + ' of ' + mp.qty + ' crafted</span></span>' : '';
    return rowHtml({ cls: 'line-row craft-row', attrs: rowAttrs(V, key, ln, q), role: 'r-craft', rk: 'c|' + key, fig: x.crafts, word: 'crafts', name: name, stamps: (V.combined ? wayPill(ln, true) : '') + stamp(ln) + (rst || warn ? '<span class="rst-dsk">' + rst + (warn ? ' <span class="lstamp warn">Book not ticked</span>' : '') + '</span>' : ''), icons: iconSet(jobs), l2: l2,
      mid: bar, prim: x.crafts > 0 ? rb(x.crafts > 1 ? 'Made all' : 'Made 1', 'made', ' data-crafts="' + x.crafts + '"', 'lbtn-r') : '',
      drawer: function () {
        var atelier = !(DATA.noHandOver || []).some(function (r) { return r === ln.recipe; });
        return reasonOf(V, ln, x) + recipeFacts(ln.recipe, warn) + crafterBlock(ln) +
          (mqs.length > 1 ? '<label class="lfld"><span class="lab">Quality made</span><select data-f="madeq">' + mqs.map(function (m) { return '<option value="' + m + '"' + (m === q ? ' selected' : '') + '>' + qWord(m) + '</option>'; }).join('') + '</select></label>' : '') +
          boughtBox(V, rowKey, x.short, q) + wayBlock(V, ln, hqBlock(V, ln)) + wayActs(V, ln, (x.crafts > 1 ? rb('Made 1', 'made', ' data-crafts="1"', 'lbtn-o') : '') + rb('Bought it', 'ask-bought', ' data-mode="bought"', 'lbtn-o'), lk('Got it another way', 'ask-bought', ' data-mode="other"') + (atelier ? '<a class="lk" href="../atelier/#recipe=' + ln.recipe + '">Solve in the Atelier</a>' : ''));
      } });
  }
  function secHead(id, label, n, open, summary) {
    return '<h3 class="gsec-h"><button type="button" class="btn sec-toggle" data-act="sec" data-sec="' + id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + svg(ICO.chev, 14) + '<span class="sec-title">' + esc(label) + '</span>' + (summary ? '<span class="sec-sum">' + summary + '</span>' : '') + '<span class="count">' + n + '</span></button></h3>';
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
        if (e[p[0]] > 0) h += '<li class="left-row" data-item="' + e.item + '" data-n="' + e[p[0]] + '"><span class="lt">' + e[p[0]] + ' ' + p[1] + esc(itemName(e.item)) + ': no longer needed by ' + who + '. Still in your stock, and used by your other lists if they need it.</span></li>';
      });
    });
    return h;
  }
  // R3: which section a plan row is shown in: crystals (gathered shards, crystals and clusters) apart from Gather, currencies apart from Other
  function inSection(id, ln) {
    if (id === 'crystal') return isCrystal(ln.item);
    if (id === 'gather') return !isCrystal(ln.item);
    if (id === 'earn') return isCurrency(ln.item);
    if (id === 'other') return !isCurrency(ln.item);
    return true;
  }
  // R3: Gather by zone, then aetheryte (the chosen spot of each row), timed nodes first by the next window; Buy from a merchant by city, then seller
  // (the seller shown). The order is made when the page is drawn, never on the 15-second tick, which only rewrites the window texts.
  function routeRows(V, id, keys, sums) {
    var one = function (k) { return getRow(V, k, sums[k]); };
    if (id !== 'gather' && id !== 'vendor') return keys.map(one).join('');
    var now = Date.now(), rows = keys.map(function (k) {
      var ln = V.plan.lines[k], a = '', b = '', rank = null;
      if (id === 'gather') {
        var cs = chosenSpot(ln.item, V.plan), timed = cs ? chosenTimed(cs) : ln.timed, w = timed ? E.nextWindow(timed.hours, timed.minutes, now) : null;
        a = cs ? cs.spot[3] || '' : (ln.node && ln.node.zone) || '';
        if (cs && (cs.spot[4] > 0 || cs.spot[5] > 0) && cs.spot[6] && DATA.aetherytes && DATA.aetherytes[cs.spot[6]]) b = DATA.aetherytes[cs.spot[6]];
        if (w) rank = (w.open ? 0 : 1) * 1e15 + (w.open ? w.closesAt : w.opensAt);
      } else { var sl = seller(shownNpc(V, ln)); a = sl.zone; b = sl.zone || sl.name !== 'a merchant' ? sl.name : ''; }
      return { key: k, a: a, b: b, rank: rank, name: itemName(ln.item) };
    });
    var subText = function (sb) { return sb.b ? (id === 'gather' ? 'Near ' : '') + sb.b : id === 'gather' ? 'No aetheryte listed' : 'Merchant not named'; };
    return E.groupRows(rows).map(function (g) {
      // a zone with one aetheryte (one seller) says it on its own head line; with several, each has a line under the head
      var many = g.subs.length > 1, lone = !many && g.subs[0].b !== '';
      return '<li class="zone-head" data-zone="' + esc(g.a) + '"><h4 class="zn">' + esc(g.a || (id === 'gather' ? 'No zone in the game data' : 'Place not known')) + '</h4>' + (lone ? '<span class="zs">' + esc(subText(g.subs[0])) + '</span>' : '') + '<span class="zc">' + g.n + '</span></li>' + g.subs.map(function (sb) {
        return (many ? '<li class="ae-head" data-sub="' + esc(sb.b) + '"><span class="sn">' + esc(subText(sb)) + '</span><span class="zc">' + sb.n + '</span></li>' : '') + sb.keys.map(one).join('');
      }).join('');
    }).join('');
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
        var src = id === 'have' ? V.plan.shop.outside : id === 'crystal' ? V.plan.shop.gather : id === 'earn' ? V.plan.shop.other : V.plan.shop[id];
        var keys = src.filter(function (k) { return sums[k] && sums[k].short > 0 && inSection(id, V.plan.lines[k]); });
        n = keys.length;
        if (!n) return;
        shown += n;
        if (open) rows = (id === 'market' ? '<div class="market-line">' + priceTotal(V, keys, sums, Date.now()) + lk('Refresh prices', 'prices') + '</div>' : '') + '<ul class="lines">' + routeRows(V, id, keys, sums) + '</ul>';
        if (open && id === 'market') keys.forEach(function (k) { if (PR.want.indexOf(V.plan.lines[k].item) < 0) PR.want.push(V.plan.lines[k].item); });
      }
      blocks += '<section class="gsec" data-sec="' + id + '">' + secHead(id, def[1], n, open) + (open ? (id === 'left' ? '<ul class="lines">' + rows + '</ul>' : rows) : '') + '</section>';
    });
    if (!shown) h += '<p class="muted empty-line"><span class="ring" aria-hidden="true"></span>Nothing left to get.</p>';
    return h + blocks + '<p class="muted fine">You type what you have. This app never reads the game.</p>';
  }
  function craftTab(V, sums) {
    var h = '', groups = [], any = false;
    V.plan.order.forEach(function (b) {
      var keys = b.crafts.filter(function (k) { return sums[k] && sums[k].crafts > 0; });
      if (!keys.length) return;
      any = true;
      var g = groups[groups.length - 1];
      if (!g || g.job !== b.job) { g = { job: b.job, keys: [] }; groups.push(g); }
      g.keys = g.keys.concat(keys);
    });
    groups.forEach(function (g, i) {
      var n = g.keys.reduce(function (t, k) { return t + sums[k].crafts; }, 0), nm = JOBS[g.job] || 'Crafter';
      h += '<section class="cblock" data-job="' + g.job + '"><div class="job-head"><span class="no">' + (i + 1) + '</span><h3>' + (JOBS[g.job] ? jobIcon(JOBS[g.job], 32) : '') + esc(nm) + '</h3><span class="sum">' + n + ' craft' + (n === 1 ? '' : 's') + '</span></div><ul class="lines">' +
        g.keys.map(function (k) { return craftRow(V, k, sums[k]); }).join('') + '</ul></section>';
    });
    var done = SH.view.hide ? [] : crafted(V);
    if (done.length) { any = true; h += '<section class="cblock cdone"><div class="job-head"><span class="no"></span><h3>Already crafted</h3><span class="sum">' + done.length + '</span></div><ul class="lines">' + done.map(function (d) { return '<li class="line-row done"><div class="lr r-ready done"><span class="cnt"><b>' + d.qty + '</b><i class="role role-ready">finished</i></span><div class="opener"><span class="l1"><span class="nm w-name">' + esc(itemName(d.item)) + '</span></span><span class="l2">' + d.crafted + ' of ' + d.qty + ' crafted</span></div><span class="st-col"></span><span class="pc"></span></div></li>'; }).join('') + '</ul></section>'; }
    return (any ? '' : '<p class="muted empty-line"><span class="ring" aria-hidden="true"></span>Nothing left to craft.</p>') + h;
  }
  // must-craft items already crafted in full (not yet marked finished): the "completed" rows of To craft
  function crafted(V) {
    var out = [];
    V.ids.forEach(function (lid) { targetsOf(V.sc, lid).forEach(function (k) { var t = V.sc.targets[k]; if (t.make && !t.done && (t.crafted || 0) >= t.qty) out.push({ item: t.item, crafted: t.crafted || 0, qty: t.qty }); }); });
    return out;
  }
  // ------------------------------------------------------------------------------------------------ the kit (docs/lists-look-spec.md section 3): drawn pictures, rail, head, sheets, status line
  var ICO = {
    minus: '<path d="M3 8h10"/>', plus: '<path d="M3 8h10M8 3v10"/>', more: '<circle cx="4" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="20" cy="12" r="1.7"/>',
    lists: '<path d="M4 6h3M10 6h10M4 12h3M10 12h10M4 18h3M10 18h6"/>', get: '<path d="M12 3v11M7 10l5 5 5-5M4 20h16"/>', craft: '<path d="M13.5 4.5l6 6-3 3-6-6zM12 12L4.5 19.5M3.5 20.5l2-2"/>', wanted: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    close: '<path d="M4 4l10 10M14 4L4 14"/>', chev: '<path d="M2 4l5 5 5-5"/>', up: '<path d="M3 11l5-6 5 6"/>', down: '<path d="M3 5l5 6 5-6"/>'
  };
  function svg(d, size) { var vb = d === ICO.close ? 18 : d === ICO.chev ? 14 : d === ICO.up || d === ICO.down || d === ICO.minus || d === ICO.plus ? 16 : 24; return '<svg viewBox="0 0 ' + vb + ' ' + vb + '" width="' + (size || vb) + '" height="' + (size || vb) + '" aria-hidden="true" focusable="false">' + d + '</svg>'; }
  // D-C2: the game's job icon beside the job's name (the name is written next to it, so the picture has an empty alt)
  function jobIcon(name, px) { return '<img class="jicon" src="classjob/' + name.toLowerCase() + '.png" alt="" width="' + px + '" height="' + px + '">'; }
  function lk(label, act, extra) { return '<button type="button" class="lk" data-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>'; }
  // the side rail (a bottom bar on a phone): Lists always; To get, To craft and Wanted when a list is open; To get and To craft in the combined view
  var RAIL = { kind: 'home' };
  function railHtml() {
    var R = RAIL, on = SH.view.tab;
    function item(label, ico, role, sel, n, attrs) { return '<button type="button" role="tab" class="tab ltab ' + role + '"' + attrs + ' aria-selected="' + (sel ? 'true' : 'false') + '">' + svg(ICO[ico]) + '<span class="tl">' + label + '</span><span class="tn">' + n + '</span></button>'; }
    var h = item('Lists', 'lists', 'r-accent', R.kind === 'home', R.lists == null ? count(sec().lists) : R.lists, ' data-act="back"');
    if (R.kind === 'list' || R.kind === 'combined') {
      h += item('To get', 'get', 'r-short', on === 'get' || (R.kind === 'combined' && on !== 'craft'), R.get, ' data-act="tab" data-tab="get"') + item('To craft', 'craft', 'r-craft', on === 'craft', R.craft, ' data-act="tab" data-tab="craft"');
      if (R.kind === 'list') h += item('Wanted', 'wanted', 'r-slab', on === 'wanted', R.wanted, ' data-act="tab" data-tab="wanted"');
    }
    return h;
  }
  // the list head: an inverted slab that says the answer (kicker, title, state line, the character's two totals, one settings control)
  function headHtml(V, o) {
    var f = figures(V.plan, V.plan.lines), who = V.char, stateParts = [], place = priceScope();
    var title, gear = '';
    if (o.combined) {
      title = V.ids.map(function (i) { return esc(V.sc.lists[i].name || 'Untitled list'); }).join(', ');
      stateParts.push(lk(SH.view.hide ? 'Show completed' : 'Hide completed', 'hide', ' aria-pressed="' + (SH.view.hide ? 'true' : 'false') + '"'), lk('Order of ways', 'sheet', ' aria-expanded="false"'), lk('Prices: ' + place, 'prices-sheet'));
    } else {
      var n = o.steps;
      title = esc(o.h.name || 'Untitled list');
      stateParts.push(n > 1 ? n + ' steps' : 'one step');
      if (SH.view.hide) stateParts.push('completed hidden');
      stateParts.push('prices: ' + esc(place));
      gear = '<button type="button" class="lbtn-o" data-act="settings" aria-haspopup="dialog" aria-expanded="' + (SH.view.sheet === 'settings' ? 'true' : 'false') + '">' + svg(ICO.gear, 18) + 'List settings</button>';
    }
    return '<section class="lhead' + (o.combined ? ' combined' : '') + '"><p class="kick">' + esc(who) + (o.combined ? ' · Combined view' : '') + '</p><h1>' + title + '</h1><p class="state">' + stateParts.join(o.combined ? ' ' : ' · ') + '</p>' +
      '<div class="tal-col"><p class="cap">Totals for ' + esc(who) + ':</p>' + talliesHtml(f, who, 'lists-totals') + '</div>' + gear + '</section>';
  }
  // a sheet: a scrim, a dialog with a labelled close, a title over a double rule, and its footer
  function sheetHtml(title, cls, body, foot) {
    return '<div class="lscrim" data-act="sheet-close"></div><div class="lsheet ' + cls + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><button type="button" class="lx" data-act="sheet-close">' + svg(ICO.close, 14) + 'Close</button><h2>' + esc(title) + '</h2>' + body + '<div class="sfoot">' + foot + '</div></div>';
  }
  function settingsSheet(V, h, listId) {
    var sids = stepIdsOf(h), steps = h.steps || {};
    var body = '<label class="lfield"><span>List name</span><input type="text" data-f="listname" maxlength="60" value="' + esc(h.name || '') + '"></label>' +
      '<label class="lfield"><span>Character</span><select data-f="listchar">' + charOptions(h.charId || '') + '</select></label>' +
      '<div class="lfield"><span>Steps</span>' + (sids.length ? '<div class="stepname">' + sids.map(function (s) { return '<div>' + esc(steps[s].name) + '</div>'; }).join('') + '</div>' : '') +
      (sids.length ? '<p class="fine steps-note">A step’s figures are its share of ' + esc(V.char) + '’s plan and can move between steps and lists; the totals for ' + esc(V.char) + ' never go up when you remove something.</p>' : '') + '<div class="add-step"><label class="lfield"><span>New step</span><input type="text" data-f="stepname" maxlength="60"></label>' + '<button type="button" class="btn lbtn-o" data-act="addstep">Add a step</button></div></div>' +
      '<div class="switch-row"><button type="button" class="swb" data-act="hide" aria-pressed="' + (SH.view.hide ? 'true' : 'false') + '">' + (SH.view.hide ? 'Show completed' : 'Hide completed') + '<span class="sw" aria-hidden="true"></span></button></div>' +
      placeSelect() + '<p class="acts-row">' + lk('Order of ways', 'sheet', ' aria-expanded="false"') + lk('High quality for every material', 'hq-all', ' title="' + esc(hqTodo(V).length ? hqTodo(V).length + ' material' + (hqTodo(V).length === 1 ? '' : 's') + ' of ' + V.char + '’s lists can be made in high quality and are not set yet; one Undo takes it all back' : 'Every material that can be made in high quality is set already') + '"') + '</p>';
    return sheetHtml('List settings', 'settings-sheet', body, '<button type="button" class="lbtn-p big" data-act="sheet-close">Done</button>');
  }
  function pricesSheet() { return sheetHtml('Market prices', 'settings-sheet', placeSelect(), '<button type="button" class="lbtn-p big" data-act="sheet-close">Done</button>'); }
  var WAY_ROLE = { vendor: 'r-merchant', craft: 'r-craft', gather: 'r-gather', trade: 'r-merchant', market: 'r-market' };
  function orderSheet(V) {
    var ord = orderOf(V.sc, V.owner);
    var body = '<p class="sentence">When an item can be got in several ways, ' + esc(V.char) + '’s lists try them in this order:</p><ol class="order-list ladder">' +
      ord.map(function (w, i) {
        return '<li data-way="' + w + '" class="rung ' + WAY_ROLE[w] + (i === 0 ? ' first' : '') + '"><span class="no">' + (i + 1) + '<span class="dot">.</span></span> <span class="tx" data-label="' + esc(WAY_LABEL[w]) + '">' + esc(WAY_TEXT[w]) + '</span> <span class="mv">' +
          '<button type="button" class="icon-b" data-act="order-up" data-way="' + w + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up: ' + esc(WAY_LABEL[w]) + '">' + svg(ICO.up, 16) + '</button>' +
          '<button type="button" class="icon-b" data-act="order-down" data-way="' + w + '"' + (i === 4 ? ' disabled' : '') + ' aria-label="Move down: ' + esc(WAY_LABEL[w]) + '">' + svg(ICO.down, 16) + '</button></span></li>';
      }).join('') + '</ol><p class="para">This order is used in all of ' + esc(V.char) + '’s lists. You can change it here, or choose a way for one item on its row, at any time. Items from the crafting log, and collectables, are always crafted.</p>';
    return sheetHtml('Order of ways', 'order-sheet', body, lk('Back to the usual order', 'order-reset') + '<button type="button" class="lbtn-p big" data-act="sheet">Close</button>');
  }
  // the open sheet of the page (kept in SH.view.sheet, so a redraw after a save keeps it open): 'settings' | 'prices' | 'order'
  function sheetFor(V, h, listId) {
    var k = SH.view.sheet;
    if (k === 'order') return orderSheet(V);
    if (k === 'prices') return pricesSheet();
    if (k === 'new') return newSheet();
    if (k === 'settings' && h) return settingsSheet(V, h, listId);
    return '';
  }
  // step tabs: each step's own share; the hand-in button and its confirm (E19, D28)
  function stepsHtml(V, h, listId) {
    var sids = stepIdsOf(h);
    if (!sids.length) return '';
    var tabs = [[null, 'All steps']].concat(sids.map(function (s) { return [s, h.steps[s].name]; }));
    var out = '<div class="lists-steps" role="tablist" aria-label="Steps">' + tabs.map(function (t) {
      var f = figures(V.plan, sumShares(V.plan, [listId], t[0])), on = SH.view.step === t[0];
      return '<button type="button" role="tab" class="btn step-tab" data-act="step" data-step="' + (t[0] === null ? '' : esc(t[0])) + '" aria-selected="' + (on ? 'true' : 'false') + '"><span class="st-name">' + esc(t[1]) + '</span> <span class="st-fig" data-get="' + f.get + '" data-craft="' + f.craft + '">' + f.get + ' to get · ' + f.craft + ' to craft</span></button>';
    }).join('') + '</div>';
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
    SH.view.list = null; SH.view.combined = false; SH.view.form = false; SH.view.confirm = null; SH.view.bought = null; SH.view.sheet = false; SH.note = '';
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
    var V = SH.view.log, chars = SH.chars || [], job = V.job, pages = job != null ? logPages(job) : [], pg = V.page != null ? pages[V.page] : null;
    var h = '<section class="lists-panel log-screen"><h2 class="panel-h">From the crafting log</h2><div class="panel-b">';
    if (!chars.length) {
      main.innerHTML = '<section class="empty-state lists-empty log-screen"><div class="es-main"><p class="es-text">Set up your characters in the Tracker first: the crafting log is read from what each character has ticked there.</p><p class="es-kick">No characters</p><h2>From the crafting log</h2><div class="es-act">' + lk('Back', 'log-cancel') + '</div></div>' +
        '<div class="es-ledger" aria-hidden="true"><svg viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" focusable="false"><path class="dl" d="M0 30H320M0 66H320M0 102H320M0 138H320M0 174H320M0 210H320"/><path class="dc" d="M104 40h70l-14 22h-70z"/><path class="dg" d="M134 112h86l-14 22h-86z"/><path class="dm" d="M184 76h74l-14 22h-74z"/></svg></div></section>';
      return;
    }
    h += '<form class="fields" onsubmit="return false">' +
      (V.char ? '<label class="lfield"><span>Character</span><select data-f="logchar">' + chars.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === V.char ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="lfield"><span>Job</span><select data-f="logjob"><option value="">Choose a job</option>' + LOG_JOBS.map(function (n, i) { return '<option value="' + i + '"' + (i === job ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
      '<label class="lfield"><span>Page</span><select data-f="logpage"' + (job == null ? ' disabled' : '') + '><option value="">Choose a page</option>' + pages.map(function (x, i) { return '<option value="' + i + '"' + (i === V.page ? ' selected' : '') + '>' + esc(x[0]) + '</option>'; }).join('') + '</select></label></form>';
    if (!pg) h += '<p class="muted empty-line">Choose a job and a page.</p><p class="createbar">' + lk('Back', 'log-cancel') + '</p>';
    else if (!V.char) {
      h += '<h3 class="which-h">For which character?</h3><div class="which">' + chars.map(function (c) { var n = logCounts(c.id, job, V.page).missing.length;
        return '<button type="button" class="which-row" data-act="log-char" data-char="' + esc(c.id) + '"><b>' + esc(c.name) + '</b><span class="sr">: </span><span class="nw"><span class="n">' + n + '</span> <span class="w">not ticked</span></span>' + CHEV + '</button>'; }).join('') + '</div><p class="createbar">' + lk('Back', 'log-cancel') + '</p>';
    } else {
      var k = logCounts(V.char, job, V.page);
      if (!k.missing.length) h += '<p class="log-empty empty-line">Everything on this page is ticked.</p>';
      else h += '<div class="answer"><span class="cnt r-craft"><b>' + k.missing.length + '</b><i>crafts</i></span><p class="log-count">' + k.missing.length + ' of ' + k.total + ' not ticked in the Tracker</p></div><ul class="log-items missing">' + k.missing.map(function (id) { return '<li>' + esc(itemName(DATA.recipes[id][0])) + '</li>'; }).join('') + '</ul>';
      h += '<p class="createbar">' + (k.missing.length ? btn('Create', 'log-create', '', 'lbtn-p big') + ' ' : '') + lk('Back', 'log-cancel') + '</p>';
    }
    main.innerHTML = h + '</div></section><p class="muted fine">You type what you have. This app never reads the game.</p>';
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
    return btn('New list', 'new', '', 'lbtn-p') + ' ' + btn('From the crafting log', 'from-log', '', 'lbtn-o');
  }
  // S1, S2: one slim status line, fixed at the bottom of the page (above the bottom bar on a phone); what it offers is a text link. It is drawn outside the page's redraw (#lstatus).
  function statusHtml() { return ''; }
  function paintStatus() {
    var h = '', err = false, u = SH.undo[0];
    if (SH.note) {
      err = /^(Not saved on this device|Undo was not done)/.test(SH.note) || SH.note === RECORD_LINE;
      h += '<span class="sent note">' + esc(SH.note) + '</span>';
    }
    if (u) h += '<span class="sent">' + esc(u.label) + '.</span>' + lk('Undo', 'undo', ' data-i="0" aria-label="Undo: ' + esc(u.label) + '"');
    if (SH.rest) h += SH.rest.ways.map(function (w) { return lk('Buy the rest too: ' + (w === 'vendor' ? 'from a merchant' : 'on the market'), 'rest', ' data-by="' + w + '"'); }).join('');
    if (SH.undo.length > 1) {
      h += '<details class="lists-earlier"><summary>Earlier changes (' + (SH.undo.length - 1) + ')</summary><ul>' + SH.undo.slice(1).map(function (e, i) {
        return '<li><span>' + esc(e.label) + '</span> ' + lk('Undo', 'undo', ' data-i="' + (i + 1) + '" aria-label="Undo: ' + esc(e.label) + '"') + '</li>';
      }).join('') + '</ul></details>';
    }
    var wasOpen = statusEl.querySelector('.lists-earlier[open]');
    statusEl.className = 'lists-status' + (err ? ' err' : '') + (h ? '' : ' empty');
    statusEl.innerHTML = h;
    if (wasOpen) { var d = statusEl.querySelector('.lists-earlier'); if (d) d.open = true; }
  }
  // the new list is a sheet of the kit (its fields are the purpose fields of a create step); "Create" is its one primary
  function newSheet() {
    var chars = SH.chars || [];
    var body = '<form class="nform" data-form="new" onsubmit="return false"><label class="lfield"><span>List name</span><input type="text" data-f="newname" maxlength="60" autocomplete="off"></label>' +
      '<label class="lfield"><span>Character</span><select data-f="newchar">' + chars.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '<option value="">No character</option></select></label></form>';
    return sheetHtml('New list', 'settings-sheet', body, lk('Cancel', 'cancel-new') + '<button type="button" class="btn lbtn-p big" data-act="create">Create</button>');
  }
  // "12 of 40 ready": finished, crafted in full, or covered by what is typed (the whole plan, as the rows are)
  function readyCounts(sc, plans) {
    var out = {};
    plans = plans || {};
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
  // W15: the character choices of a select: every character, then "No character" (the default unless `sel` names one)
  function charOptions(sel) {
    var chars = SH.chars || [], known = !sel || chars.some(function (c) { return c.id === sel; });
    return chars.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + (known ? '' : '<option value="' + esc(sel) + '" selected>' + esc(nameOfChar(sel)) + '</option>') + '<option value=""' + (sel ? '' : ' selected') + '>No character</option>';
  }
  // "Restored list" (spec section 4): wanted items whose list is missing are kept, shown here, planned by nothing until put in a list, or removed
  function orphansHtml(sc) {
    var orph = S.orphans(sc), ids = Object.keys(orph);
    return ids.map(function (id) {
      var keys = orph[id].sort(function (a, b) { return (sc.targets[a].at || 0) - (sc.targets[b].at || 0) || (a < b ? -1 : a > b ? 1 : 0); }), asking = SH.view.confirm === 'orphan:' + id;
      return '<section class="lists-group lists-restored" data-orphan="' + esc(id) + '" aria-label="Restored list"><div class="group-head solo"><div class="nm-col"><h2>Restored list</h2></div></div><div class="rcard"><span class="cnt r-short"><b>' + keys.length + '</b><i>wanted</i></span><div class="body">' +
        '<p>' + keys.length + ' wanted item' + (keys.length === 1 ? ' has' : 's have') + ' no list, which can happen after a sync with a device on an older version. They are kept, and no plan counts them until they are in a list.</p>' +
        '<ul class="restored-items">' + keys.map(function (k) { var t = sc.targets[k]; return '<li data-key="' + esc(k) + '">' + esc(itemName(t.item)) + ' × ' + t.qty + '</li>'; }).join('') + '</ul>' +
        '<label class="lfld"><span class="lab">Character</span><select data-f="restorechar">' + charOptions('') + '</select></label><p class="acts-row">' + btn('Put these in a new list', 'restore-orphans', '', 'lbtn-r') + ' ' +
        (asking ? '<span class="ask">Remove these ' + keys.length + ' wanted item' + (keys.length === 1 ? '' : 's') + '?</span> ' + btn('Remove', 'remove-orphans', '', 'lbtn-o bad') + ' ' + lk('Keep', 'keep') : '<button type="button" class="lk bad" data-act="ask-remove-orphans">Remove</button>') + '</p></div></div></section>';
    }).join('');
  }
  function dayMonth(t) { var d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()]; }
  // the empty state of Your lists: a kicker, a display headline, the built sentence, three steps, the actions and a ruled-ledger panel that measures nothing
  function emptyState(lead, kicker, head, steps, acts, nrec) {
    var deco = '<div class="es-ledger" aria-hidden="true"><svg viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" focusable="false"><path class="dl" d="M0 30H320M0 66H320M0 102H320M0 138H320M0 174H320M0 210H320"/>' +
      '<path class="dc" d="M104 40h70l-14 22h-70z"/><path class="dg" d="M134 112h86l-14 22h-86z"/><path class="dm" d="M184 76h74l-14 22h-74z"/>' +
      '<path class="dk" d="M196 150h26l-10 18h-26zM232 150h26l-10 18h-26zM268 150h26l-10 18h-26z"/></svg>' + (nrec ? '<span class="lab">Your lists</span><span class="cnt-l">' + nrec.toLocaleString('en-US') + ' recipes in the game data</span>' : '') + '</div>';
    return '<section class="empty-state lists-empty"><div class="es-main"><p class="es-text">' + esc(lead) + '</p><p class="es-kick">' + esc(kicker) + '</p><h2>' + esc(head) + '</h2>' +
      (steps ? '<ol class="es-steps">' + steps.map(function (s, i) { return '<li class="es-step"><b class="' + ['r-craft', 'r-gather', 'r-market'][i] + '">' + (i + 1) + '</b><span><strong>' + esc(s[0]) + '</strong>' + esc(s[1]) + '</span></li>'; }).join('') + '</ol>' : '') + '<div class="es-act">' + acts + '</div></div>' + deco + '</section>';
  }
  function renderHome() {
    var sc = sec(), lists = sc.lists, ids = sortedIds(lists), restored = orphansHtml(sc), sheet = SH.view.sheet === 'new' ? newSheet() : '';
    RAIL = { kind: 'home', lists: ids.length };
    if (!ids.length) {
      main.innerHTML = emptyState('No lists yet. Start one, or build one from the crafting-log pages you have not finished.', 'No lists yet', 'Nothing to make yet',
        [['Say what you want to make', 'Add items by name, or start from a crafting-log page.'], ['Type what you have', 'The app never reads the game.'], ['Work down the plan', 'What to get, what to craft, and in which order.']],
        topButtons(), Object.keys(DATA.recipes || {}).length) + restored + sheet;
      return;
    }
    var plans = {}, ready = readyCounts(sc, plans), ticked = S.combined(sc), tickOwner = ticked.length ? S.ownerOf(lists[ticked[0]]) : null;
    var groups = {}, order = [];
    ids.forEach(function (id) { var c = lists[id].charId || ''; if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(id); });
    order.sort(function (a, b) { return (a === '') - (b === '') || (a < b ? -1 : a > b ? 1 : 0); });
    var body = order.map(function (c) {
      var owner = c || 'u', who = nameOfChar(c), plan = plans[owner] || (plans[owner] = planOf(sc, owner)), f = figures(plan, plan.lines), off = tickOwner !== null && tickOwner !== owner;
      var mine = ticked.filter(function (i) { return S.ownerOf(lists[i]) === owner; }).length, state = off ? 'Each character has its own stock.' : mine === 1 ? 'Tick two or more lists of one character.' : '';
      return '<section class="lists-group" aria-label="' + esc(who) + '"><div class="group-head"><div class="nm-col"><h2>' + esc(who) + '</h2>' + (state ? '<p class="state">' + state + '</p>' : '') + '</div><div class="tal-col"><p class="cap">Totals for ' + esc(who) + ':</p>' +
        talliesHtml(f, who, '') + '</div>' +
        rb('Combined view' + (mine ? ' (' + mine + ')' : ''), 'combined', ' data-owner="' + owner + '"', 'lbtn-o') + '</div><div class="lists-cards">' + groups[c].map(function (id) {
        var l = lists[id], steps = Math.max(1, count(l.steps)), r = ready[id] || { ready: 0, total: 0 }, asking = SH.view.confirm === 'list:' + id, menu = SH.view.more === id, nm = l.name || 'Untitled list';
        var offTick = tickOwner !== null && tickOwner !== owner, changed = l.data && DATA.stamp && l.data !== DATA.stamp, pct = r.total ? Math.round(100 * r.ready / r.total) : 0;
        return '<article class="list-card lcard" data-list="' + esc(id) + '"><span class="ready ' + (r.total && r.ready === r.total ? 'r-ready' : 'r-slab') + '"><b>' + r.ready + '</b><i class="role role-ready">of ' + r.total + ' ready</i><span class="bar" aria-hidden="true"><em style="width:' + pct + '%"></em></span></span>' +
          '<div class="mid"><h3><button type="button" class="open" data-act="open">' + esc(nm) + '</button>' + (changed ? '<span class="lstamp r-short">Game data changed</span>' : '') + projectStamp(l) + '</h3><p>' + steps + ' step' + (steps === 1 ? '' : 's') + (l.made ? ' · made ' + dayMonth(l.made) : '') + '</p>' +
          '<label class="chk tick ltick"><input type="checkbox" data-f="tick"' + (ticked.indexOf(id) >= 0 ? ' checked' : '') + (offTick ? ' disabled' : '') + '><span>In combined view</span></label></div>' +
          '<div class="rt"><button type="button" class="more" data-act="more" aria-expanded="' + (menu || asking ? 'true' : 'false') + '" aria-label="More for ' + esc(nm) + '">' + svg(ICO.more, 18) + '</button></div>' +
          (menu || asking ? '<div class="cfoot">' + (asking ? '<span class="ask">Remove this list and its ' + r.total + ' wanted item' + (r.total === 1 ? '' : 's') + '?</span> ' + rb('Remove', 'remove-list', '', 'lbtn-o bad') + ' ' + lk('Keep', 'keep') : '<button type="button" class="lk bad" data-act="ask-remove-list">Remove list</button>') + '</div>' : '') + '</article>';
      }).join('') + '</div></section>';
    }).join('');
    main.innerHTML = '<div class="topstrip"><div class="tcount"><p class="kick">Your lists</p><span class="lnum">' + ids.length + '</span><span>list' + (ids.length === 1 ? '' : 's') + '</span></div><div class="acts">' + topButtons() + '</div></div>' + body + restored + '<p class="muted fine">You type what you have. This app never reads the game.</p>' + sheet;
  }
  function flagBox(key, flag, label, on) { return '<label class="chk ltick"><input type="checkbox" data-f="flag" data-flag="' + flag + '"' + (on ? ' checked' : '') + '> ' + esc(label) + '</label>'; }
  // a row of Wanted: the amount asked for on the slab, the facts, every crafter's icon, the stepper (desktop) and "Finished"; the rest in the opened row
  function renderRow(V, listId, h, key) {
    var sc = V.sc, plan = V.plan, t = sc.targets[key], owner = S.ownerOf(h), ln = t.done ? null : lineFor(plan, t), q = qualityOf(t, ln);
    var have = sc.have[owner + '.' + t.item], typed = (have && have[q]) || 0, name = itemName(t.item), recs = recipesOf(t.item), rk = 'w|' + key;
    var need = ln ? (ln.part === 'make' ? ln.need : ln.short) : 0, steps = h.steps || {}, stepIds = stepIdsOf(h), shown = ln && !(t.make && ln.part !== 'make');
    var stepName = stepIds.length ? (steps[t.step] || steps[stepIds[0]] || {}).name : '';
    var l2 = '<span class="w-count">' + (t.done ? 'Finished' : t.make && !ln ? 'crafted ' + Math.min(t.crafted || 0, t.qty) + ' of ' + t.qty + ', have ' + typed : 'need ' + (ln ? ln.need : t.qty) + ', have ' + typed) + ' <span class="w-q">(' + qWord(q) + ')</span></span>' +
      (t.make && ln ? ' · ' + (t.crafted || 0) + ' of ' + t.qty + ' crafted' : '') + (stepName ? '<span class="stepn"> · ' + esc(stepName) + '</span>' : '');
    var stamps = (ln ? wayPill(ln, ln.by === 'craft') : '') + (t.coll ? ' <span class="lstamp plain">Collectable</span>' : t.hq ? ' <span class="lstamp plain">High quality</span>' : '') + (t.make ? ' <span class="lstamp plain">Must craft</span>' : '') +
      (!DATA.items[t.item] || (t.make && !recs.length) ? ' <span class="lstamp plain gone">no longer in the game data</span>' : '');
    return rowHtml({ cls: 'wanted-row' + (t.done ? ' done' : ''), attrs: ' data-key="' + esc(key) + '" data-item="' + t.item + '" data-q="' + q + '" data-owner="' + esc(owner) + '"', role: t.done ? 'r-ready' : 'r-slab', rk: rk, fig: t.qty, word: t.done ? 'finished' : 'wanted', wcls: t.done ? 'role role-ready' : '',
      name: name, stamps: stamps, icons: iconSet(crafterJobs(t.item).map(function (j) { return JOBS[j]; })), l2: l2, done: t.done,
      mid: t.done || NARROW.matches ? '' : stepperHtml(name, typed, q, false), prim: t.done ? '' : rb('Finished', 'done', '', 'lbtn-r'),
      drawer: function () {
        var d = '';
        if (shown) d += reasonOf(V, ln, null);
        else if (t.make && !ln && !t.done && DATA.recipes[recipeOfTarget(t)]) { var orr = DATA.recipes[recipeOfTarget(t)]; d += '<p class="why own-state">' + withJobIcon('Crafted by ' + (JOBS[orr[2]] || 'a crafter') + ', level ' + orr[3] + '.') + '</p>'; } // W15: the row's own recipe and job
        var fold = NARROW.matches && !SH.view.edit[key];
        var ed = '<div class="w-edit"><label class="lfld amt"><span class="lab">Amount</span><input type="number" inputmode="numeric" min="1" max="99999" data-f="qty" value="' + t.qty + '"></label><span class="ticks">';
        if (canHq(t.item) || t.hq) ed += flagBox(key, 'hq', 'High quality', t.hq);
        if (canColl(t.item) || t.coll) ed += flagBox(key, 'coll', 'Collectable', t.coll);
        if (recs.length || t.make) ed += flagBox(key, 'make', 'Must be crafted by me', t.make);
        ed += '</span>';
        if (stepIds.length) ed += '<label class="lfld"><span class="lab">Step</span><select data-f="step"><option value="">' + esc(steps[stepIds[0]].name) + ' (first)</option>' + stepIds.slice(1).map(function (s) {
          return '<option value="' + esc(s) + '"' + (t.step === s ? ' selected' : '') + '>' + esc(steps[s].name) + '</option>'; }).join('') + '</select></label>';
        ed += '</div>'; if (!fold) d += ed;
        if (shown && !isCrafted(ln)) d += wayBlock(V, ln);
        d += stepperBlock(name, typed, q);
        if (SH.view.bought === key && !t.done) d += boughtBox(V, key, need, q);
        d += wayActs(V, shown ? ln : null, t.done ? rb('Not finished', 'done', '', 'lbtn-o') : rb('Bought it', 'ask-bought', '', 'lbtn-o'),
          (fold ? lk('Amount, quality and step', 'edit', ' data-k="' + esc(key) + '"') + ' ' : '') + (SH.view.confirm === key ? '<span class="ask">Remove this wanted item?</span> ' + rb('Remove', 'remove', '', 'lbtn-o bad') + ' ' + lk('Keep', 'keep') : '<button type="button" class="lk bad" data-act="ask-remove">Remove</button>'), NARROW.matches);
        return d;
      } });
  }
  // a search result is a row whose whole face is the add action: the item's name, the ways it can be had, and what it is
  function hitHtml(id, name) {
    var pj = projectOf(id);
    if (pj) return '<button type="button" class="hit r-accent" data-act="add-project" data-item="' + id + '" aria-label="Make a list for ' + esc(name) + '"><span class="cnt"><b>+</b><i>list</i></span><span class="opener"><span class="l1"><span class="nm">' + esc(name) + '</span> <span class="lstamp plain proj">' + projectWord(pj) + '</span></span><span class="l2">Free Company workshop project. Makes a new list with one step for each phase.</span></span></button>';
    var recs = recipesOf(id), g = DATA.gather && DATA.gather[id], r0 = recs[0] && DATA.recipes[recs[0]], off = offersFor(id, 'normal'), st = '';
    if (recs.length) st += '<span class="role role-craft">Craft</span> ';
    if (g) st += '<span class="role role-gather">Gather</span> ';
    if (off.gil.length) st += '<span class="role role-merchant">Merchant</span> ';
    else if (off.trade.length) st += '<span class="role role-merchant">Trade</span> ';
    var info = r0 ? 'Crafted by ' + (JOBS[r0[2]] || 'a crafter') + ', level ' + r0[3] + '.' : g ? 'Gathered by ' + (GATHER_JOBS[g[0]] || 'a gatherer') + ', level ' + g[1] + '.' : '';
    return '<button type="button" class="hit r-accent" data-act="add" data-item="' + id + '" aria-label="Add ' + esc(name) + '"><span class="cnt"><b>+</b><i>add</i></span><span class="opener"><span class="l1"><span class="nm">' + esc(name) + '</span> ' + st + '</span><span class="l2">' + withJobIcon(esc(info)) + '</span></span></button>';
  }
  function hitsHtml() {
    var res = search(SH.view.search);
    if (SH.view.search.trim().length < 2) return '';
    return '<div class="hits ledger">' + (res.length ? res.map(function (n) { return hitHtml(n[0], n[1]); }).join('') : '<p class="muted empty-line">No item matches.</p>') + '</div>';
  }
  function wantedTab(V, id, h, keys) {
    var shown = keys.filter(function (k) { var t = V.sc.targets[k]; return !(SH.view.hide && (t.done || (t.make && (t.crafted || 0) >= t.qty))); });
    return '<section class="lists-panel tab-wanted"><h2 class="sr">Wanted</h2><div class="add-bar"><label class="lfld q"><span class="lab">Add items</span><input type="search" data-f="search" autocomplete="off" value="' + esc(SH.view.search) + '" placeholder="Type part of an item name"></label>' +
      '<label class="lfld a"><span class="lab">Amount</span><input type="number" inputmode="numeric" min="1" max="99999" data-f="addqty" value="1"></label></div>' +
      '<div class="hits-box">' + hitsHtml() + '</div>' +
      (shown.length ? '<ul class="wanted lines">' + shown.map(function (k) { return renderRow(V, id, h, k); }).join('') + '</ul>' : '<p class="muted empty-line"><span class="ring" aria-hidden="true"></span>' + (keys.length ? 'Everything here is finished or crafted.' : 'Add the first item.') + '</p>') +
      '<p class="muted fine">You type what you have. This app never reads the game. Clearing an amount keeps the old amount; only Remove removes.</p></section>';
  }
  function renderList() {
    var sc = sec(), id = SH.view.list, h = sc.lists[id];
    if (!h) { SH.view.list = null; return renderHome(); }
    var owner = S.ownerOf(h), V = buildV([id], owner), keys = targetsOf(sc, id), sids = stepIdsOf(h), steps = h.steps || {};
    if (SH.view.step !== null && !steps[SH.view.step]) SH.view.step = null;
    var sums = sumShares(V.plan, V.ids, SH.view.step), tab = SH.view.tab;
    var f0 = figures(V.plan, V.plan.lines);
    RAIL = { kind: 'list', get: f0.get, craft: f0.craft, wanted: keys.length };
    var out = headHtml(V, { h: h, steps: sids.length }) + noticeHtml(h, id, sc) + (tab === 'wanted' ? '' : stepsHtml(V, h, id));
    if (tab === 'get') out += '<section class="lists-panel tab-get">' + getTab(V, sums) + '</section>';
    else if (tab === 'craft') out += '<section class="lists-panel tab-craft">' + craftTab(V, sums) + '</section>';
    else out += wantedTab(V, id, h, keys);
    main.innerHTML = out + sheetFor(V, h, id);
  }
  // the combined view: the ticked lists of one character, each row the sum of their shares (spec section 7)
  function renderCombined() {
    var sc = sec(), owner = SH.view.combinedOwner, ids = S.combined(sc).filter(function (i) { return S.ownerOf(sc.lists[i]) === owner; });
    if (ids.length < 2) { RAIL = { kind: 'home' }; main.innerHTML = '<p class="muted empty-line lists-empty"><span class="ring" aria-hidden="true"></span>Tick two or more lists of one character.</p><p class="muted fine">Each character has its own stock.</p>'; return; }
    var V = buildV(ids, owner), sums = (V.combined = true, sumShares(V.plan, ids, null)), tab = SH.view.tab === 'craft' ? 'craft' : 'get', f0 = figures(V.plan, V.plan.lines);
    RAIL = { kind: 'combined', get: f0.get, craft: f0.craft };
    main.innerHTML = headHtml(V, { combined: true }) + '<section class="lists-panel tab-' + tab + '">' + (tab === 'craft' ? craftTab(V, sums) : getTab(V, sums)) + '</section>' + sheetFor(V, null, null);
  }
  // an open sheet survives the redraw after a save: it is kept in SH.view.sheet, and the field in use, its caret and the sheet's scroll are put back
  function render() {
    var ae = document.activeElement, keep = null, sh = main.querySelector('.lsheet');
    if (sh && ae && sh.contains(ae)) keep = { f: ae.getAttribute('data-f'), act: ae.getAttribute('data-act'), way: ae.getAttribute('data-way'), at: ae.selectionStart, end: ae.selectionEnd, val: ae.value };
    var top = sh ? sh.scrollTop : 0, wasSheet = sh ? SH.view.sheet : null;
    paintStatus();
    if (SH.problem) { RAIL = { kind: 'home' }; tabsEl.innerHTML = railHtml(); main.innerHTML = '<div class="lists-note"><b>The save cannot be used here.</b> ' + esc(SH.problem) + ' Nothing has been written over it.' + (SH.note ? ' ' + esc(SH.note) : '') + '</div>'; return; }
    PR.want = []; PR.dirty = false;
    RAIL = { kind: 'home' };
    if (SH.view.log) renderLog();
    else {
      if (SH.view.combined) renderCombined(); else if (SH.view.list) renderList(); else renderHome();
      loadPrices(false); // the one automatic attempt of this place (the service's own 15-minute gate decides)
    }
    tabsEl.innerHTML = railHtml();
    var ns = main.querySelector('.lsheet');
    if (ns) {
      if (wasSheet === SH.view.sheet) ns.scrollTop = top;
      var t = null;
      if (keep && wasSheet === SH.view.sheet) {
        if (keep.f) t = ns.querySelector('[data-f="' + keep.f + '"]'); else if (keep.act) t = ns.querySelector('[data-act="' + keep.act + '"]' + (keep.way ? '[data-way="' + keep.way + '"]' : ''));
        if (t && t.disabled) t = null;
      }
      if (!t && !keep && wasSheet !== SH.view.sheet) t = ns.querySelector('.lx');
      if (t) { t.focus(); if (keep && t.getAttribute('data-f') && keep.at != null && t.setSelectionRange && t.type === 'text') { try { t.setSelectionRange(keep.at, keep.end); } catch (e) { /* not a text field */ } } }
    }
    // R3: a craft row of a master-book recipe needs the Tracker's reader; it is loaded once, then the page is drawn again with the warnings
    if (NEED_CORE && !CORE_TRIED) { NEED_CORE = false; CORE_TRIED = true; loadCore().then(function () { render(); }, function () { /* no warning without the reader */ }); }
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
  // W14: only the wanted items of the line's own recipe count (a product can have several recipes, and each has its own line).
  // W15: and only those the made quality satisfies: collectable output credits collectable items; high-quality output credits high-quality items, then ordinary ones;
  // ordinary output credits ordinary items only. Inside each group: list order, then step order; what is left of the output stays in stock.
  function creditsFor(sc, owner, item, recipe, made, quality) {
    var out = {}, left = made, groups = quality === 'coll' ? [['coll']] : quality === 'hq' ? [['hq'], ['nq']] : [['nq']];
    groups.forEach(function (want) {
      ownerListIds(sc, owner).forEach(function (lid) {
        var steps = sc.lists[lid].steps || {}, sids = stepIdsOf(sc.lists[lid]);
        var keys = targetsOf(sc, lid).filter(function (k) { var t = sc.targets[k]; return t.item === item && t.make && !t.done && recipeOfTarget(t) === recipe && want.indexOf(askedQuality(t)) >= 0; });
        var idx = function (k) { var i = sids.indexOf(sc.targets[k].step); return steps && i > 0 ? i : 0; };
        keys.sort(function (a, b) { return idx(a) - idx(b); });
        keys.forEach(function (k) { var t = sc.targets[k], c = Math.min(left, t.qty - (t.crafted || 0)); if (c > 0) { out[k] = c; left -= c; } });
      });
    });
    return out;
  }
  function makeKeysOf(sc, owner, item, recipe) {
    var out = [];
    ownerListIds(sc, owner).forEach(function (lid) { targetsOf(sc, lid).forEach(function (k) { var t = sc.targets[k]; if (t.item === item && t.make && !t.done && recipeOfTarget(t) === recipe) out.push(k); }); });
    return out;
  }
  function openList(id) { SH.view.row = null; SH.view.notice = false; SH.view.noticeAll = false; SH.view.more = null; SH.view.list = id; SH.view.combined = false; SH.view.search = ''; SH.view.confirm = null; SH.view.bought = null; SH.view.step = null; SH.view.sheet = false; SH.note = ''; }
  function onClick(ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-act'), r = rowOf(b), c = ctxOf(b), listId = SH.view.list, card = b.closest('[data-list]');
    switch (a) {
      case 'from-log': SH.view.row = null; loadCore().then(function () { openLog(null); render(); }, function (e) { SH.note = e.message; render(); }); break;
      case 'log-cancel': SH.view.log = null; render(); break;
      case 'log-char': SH.view.log.char = b.getAttribute('data-char'); render(); break;
      case 'log-create': {
        var LV = SH.view.log, ids = logCounts(LV.char, LV.job, LV.page).missing, lch = LV.char;
        act(logCreate(lch, LV.job, LV.page, ids), { after: function (x) { SH.view.log = null; if (x.id) openList(x.id); SH.view.tab = 'craft'; } });
        break;
      }
      case 'new': SH.view.form = true; SH.view.sheet = 'new'; render(); var nm = main.querySelector('[data-f=newname]'); if (nm) nm.focus(); break;
      case 'cancel-new': SH.view.form = false; SH.view.sheet = false; render(); refocusOpener(); break;
      case 'create': {
        var form = main.querySelector('[data-form=new]'), name = form.querySelector('[data-f=newname]').value, ch = form.querySelector('[data-f=newchar]').value || null;
        act(function (s) { var x = S.newList(s, { name: name, charId: ch, stamp: DATA.stamp }, CTX()); return x; }, { after: function (x) { SH.view.form = false; SH.view.sheet = false; if (x.id) openList(x.id); SH.view.tab = 'wanted'; } });
        break;
      }
      case 'open': openList(card.getAttribute('data-list')); SH.view.tab = 'wanted'; render(); break;
      case 'back': SH.view.row = null; SH.view.more = null; SH.view.log = null; SH.view.sheet = false; SH.view.list = null; SH.view.combined = false; SH.view.confirm = null; SH.view.bought = null; render(); break;
      case 'combined': SH.view.row = null; SH.view.combined = true; SH.view.list = null; SH.view.combinedOwner = b.getAttribute('data-owner'); SH.view.tab = 'get'; SH.view.confirm = null; SH.view.bought = null; SH.view.sheet = false; SH.note = ''; render(); break;
      case 'tab': SH.view.tab = b.getAttribute('data-tab'); SH.view.row = null; SH.view.confirm = null; SH.view.bought = null; render(); break;
      case 'step': SH.view.step = b.getAttribute('data-step') || null; SH.view.confirm = null; render(); break;
      case 'sec': { var sid = b.getAttribute('data-sec'); SH.view.open[sid] = !SH.view.open[sid]; render(); break; }
      case 'hide': { var hv = !SH.view.hide; SH.view.hide = hv; render(); act(function (s) { return prefEdit(s, 'hideDone', hv); }); break; }
      case 'prices': loadPrices(true); break;
      case 'noted': { var nid = SH.view.list; act(function (s) { return setListStamp(s, nid); }); break; }
      case 'settings': SH.view.sheet = 'settings'; render(); break;
      case 'prices-sheet': SH.view.sheet = 'prices'; render(); break;
      case 'sheet': SH.view.sheet = SH.view.sheet === 'order' ? false : 'order'; render(); if (!SH.view.sheet) refocusOpener(b); break;
      case 'sheet-close': SH.view.sheet = false; SH.view.form = false; render(); refocusOpener(b); break;
      case 'row': {
        var rk = b.getAttribute('data-rk'); SH.view.row = SH.view.row === rk ? null : rk; SH.view.bought = null; SH.view.confirm = null; render();
        [].some.call(main.querySelectorAll('[data-act=row]'), function (o) { if (o.getAttribute('data-rk') === rk) { o.focus(); return true; } return false; });
        break;
      }
      case 'spots': { var sk = b.getAttribute('data-k'); SH.view.spots[sk] = !SH.view.spots[sk]; render(); break; }
      case 'offers': { var ok2 = b.getAttribute('data-k'); SH.view.offers[ok2] = !SH.view.offers[ok2]; render(); break; }
      case 'edit': { var ek = b.getAttribute('data-k'); SH.view.edit[ek] = !SH.view.edit[ek]; render(); break; }
      case 'order-open': SH.view.sheet = 'order'; render(); break;
      case 'copy': { var cn = itemName(c.item); copyText(cn).then(function (ok) { SH.note = ok ? 'Copied ' + cn + '.' : 'Could not copy: this browser refused. The name is ' + cn + '.'; paintStatus(); }); break; }
      case 'hq-all': { var hqo = orderOwner(); act(hqAllEdit(hqo)); break; }
      case 'more': { var mid = card.getAttribute('data-list'); SH.view.more = SH.view.more === mid ? null : mid; SH.view.confirm = null; render(); break; }
      case 'notice': SH.view.notice = !SH.view.notice; render(); break;
      case 'notice-all': SH.view.noticeAll = true; render(); break;
      case 'ask-remove-list': SH.view.confirm = 'list:' + card.getAttribute('data-list'); render(); break;
      case 'keep': SH.view.confirm = null; SH.view.more = null; render(); break;
      case 'ask-remove-orphans': SH.view.confirm = 'orphan:' + b.closest('[data-orphan]').getAttribute('data-orphan'); render(); break;
      case 'remove-orphans': { var oid = b.closest('[data-orphan]').getAttribute('data-orphan'); SH.view.confirm = null; act(function (s) { return S.removeOrphans(s, oid); }, { after: noUndo }); break; }
      case 'restore-orphans': { var rid2 = b.closest('[data-orphan]').getAttribute('data-orphan'); var rch = b.closest('[data-orphan]').querySelector('[data-f=restorechar]'), rchar = rch && rch.value ? rch.value : null; act(function (s) { return S.restoreList(s, rid2, CTX(), rchar); }, { after: noUndo }); break; }
      case 'remove-list': { var lid = card.getAttribute('data-list'); SH.view.confirm = null; SH.view.more = null; act(function (s) { return S.removeList(s, lid); }); break; }
      case 'add-project': {
        var pitem = +b.getAttribute('data-item'), pj = projectOf(pitem), pch = (sec().lists[listId] || {}).charId || null;
        if (!pj) break;
        act(function (s) { return S.fromProject(s, { name: itemName(pitem), charId: pch, stamp: DATA.stamp, project: pj }, CTX()); }, { after: function (x) { if (x.id) { openList(x.id); SH.view.tab = 'get'; } } });
        break;
      }
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
        if (c.lk) makeKeys = c.lk.split('|')[1] === 'make' ? makeKeysOf(sec(), owner, c.item, +c.lk.split('|')[2]) : [];
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
          var mq = madeQuality(s, mo, ln, lk), credits = ln.part === 'make' ? creditsFor(s, mo, ln.item, ln.recipe, times * ln.yield, mq) : {};
          return labeled(S.record(s, DATA, mo, plan, { line: ln, times: times, quality: mq, targets: credits }), 'Made ' + times + ' ' + itemName(ln.item));
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
  }
  [main, tabsEl, statusEl].forEach(function (el) { el.addEventListener('click', onClick); }); // the page, the rail and the status line are three places of one screen
  // a closed sheet gives the focus back to the control that opened it; Escape closes it (A7); Tab stays inside it while it is open
  function refocusOpener() { var o = main.querySelector('[data-act=settings], [data-act=prices-sheet], [data-act=new]'); if (o) o.focus(); }
  document.addEventListener('keydown', function (ev) {
    if (!SH.view.sheet) return;
    if (ev.key === 'Escape') { SH.view.sheet = false; SH.view.form = false; render(); refocusOpener(); ev.preventDefault(); return; }
    if (ev.key !== 'Tab') return;
    var sh = main.querySelector('.lsheet'); if (!sh) return;
    var f = [].filter.call(sh.querySelectorAll('button, input, select, a[href], [tabindex]'), function (e) { return !e.disabled && e.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!sh.contains(document.activeElement)) { first.focus(); ev.preventDefault(); }
    else if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
    else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
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
    else if (f === 'madeq') { (SH.view.madeQ = SH.view.madeQ || {})[c.lk] = el.value; c.el.setAttribute('data-q', el.value); }
    else if (f === 'step') act(function (s) { return labeled(S.setStep(s, r.list, r.tid, el.value), 'Moved ' + itemName(r.item) + ' to another step'); });
    else if (f === 'way') { var v = el.value; act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { by: v || null, offer: null }), 'Chose how to get ' + itemName(c.item)); }); }
    else if (f === 'hqway') { // R3: "Need it in high quality" (the way's hq); the row stays open though its line changes quality
      var hqOnNow = el.checked, hi = c.item, was = hqOnNow ? 'normal' : 'hq', became = hqOnNow ? 'hq' : 'normal';
      act(function (s) { return labeled(S.setWay(s, c.owner, hi, { hq: hqOnNow }), (hqOnNow ? 'Needed high quality for ' : 'Went back to ordinary quality for ') + itemName(hi)); },
        { after: function () { if (SH.view.row) SH.view.row = SH.view.row.replace('|' + hi + '|' + was + '|', '|' + hi + '|' + became + '|'); } });
    }
    else if (f === 'countrecipe') { var cr = +el.value; act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { recipe: cr }), 'Counted the materials of ' + itemName(c.item) + ' for ' + (JOBS[DATA.recipes[cr][2]] || 'a crafter')); }); }
    else if (f === 'offer') { var key = el.value; act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { by: 'trade', offer: key }), 'Chose a trade for ' + itemName(c.item)); }); }
    else if (f === 'tick') { var id = el.closest('[data-list]').getAttribute('data-list'), on = el.checked; act(function (s) { return S.tickCombined(s, id, on); }); }
    else if (f === 'priceWorld') { var pw = el.value; act(function (s) { return prefEdit(s, 'priceWorld', pw); }); }
    else if (f === 'listchar') { var lc = el.value || null; act(function (s) { return S.setListChar(s, listId, lc); }); }
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
  if (NARROW.addEventListener) NARROW.addEventListener('change', function () { if (DATA && !SH.problem) render(); });
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
