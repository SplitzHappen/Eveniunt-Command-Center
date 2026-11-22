// Eveniunt Command Center, Lists module page (work items W6 to W8 of docs/lists-spec.md): loads the one save and the data, shows "Your lists",
// makes and removes lists, and on a list's tabs To get, To craft and Wanted (and the combined view) plans every list of a character together, adds
// items, changes amounts and flags, finishes and removes them, takes the typed stock ("I have", minus, plus, "Have all"), "Made", "Bought it",
// "Get it by", the order of ways and the steps' hand-in, and shows Undo. Every change goes through LISTS.store (the edit functions), and the page writes one save
// at a time, as the Submersibles page does. Nothing is read from the game: the player types what they have.
(function () {
  'use strict';
  var CC = window.CC, S = window.LISTS.store, E = window.LISTS;
  var main = document.getElementById('view');
  // SH: the page's working state. sec: the saved section as last read or written (null when none is stored); rev and base: what the next write is
  // measured against (as in subs.js). queue: edits waiting for the write in flight. undo: the last 20 changes of this visit, newest first.
  var SH = { problem: null, chars: [], sec: null, rev: null, base: null, queue: [], busy: null, reloadLater: false, undo: [], note: '', rest: null,
    view: { list: null, form: false, confirm: null, bought: null, mode: 'bought', search: '', tab: 'wanted', open: {}, step: null, hide: false, sheet: false, combined: false, combinedOwner: null } };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

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
      SH.chars = doc.chars; SH.sec = doc.modules.lists || null; SH.rev = r.rev; SH.base = SH.sec ? clone(SH.sec) : null;
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
      SH.rev = r.rev; SH.base = clone(r.section); SH.sec = r.section; SH.chars = r.doc.chars;
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
        SH.rev = r.rev; SH.chars = doc.chars; SH.sec = doc.modules.lists || null; SH.base = SH.sec ? clone(SH.sec) : null;
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
  function planOf(sc, owner) {
    var st = S.stateOf(sc, owner), ids = sortedIds(sc.lists).filter(function (id) { return S.ownerOf(sc.lists[id]) === owner; });
    var lists = ids.map(function (id) {
      return { id: id, steps: sc.lists[id].steps || {}, targets: targetsOf(sc, id).map(function (k) { var t = clone(sc.targets[k]); t.id = k.slice(id.length + 1); return t; }) };
    });
    var order = sc.owners[owner] && sc.owners[owner].order;
    return E.plan(DATA, { order: order || '', ways: st.ways, have: st.have, lists: lists, prices: null });
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
      (held.length ? ' <span class="held">' + esc(held.join(', ')) + '</span>' : '') + '</div>' + reasonOf(V, ln, x);
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
        if (open) rows = keys.map(function (k) { return getRow(V, k, sums[k]); }).join('');
      }
      blocks += '<section class="gsec" data-sec="' + id + '">' + secHead(id, def[1], n, open) + (open ? '<ul class="lines">' + rows + '</ul>' : '') + '</section>';
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
    return '<p class="row lists-opts">' + btn(SH.view.hide ? 'Show completed' : 'Hide completed', 'hide', ' aria-pressed="' + (SH.view.hide ? 'true' : 'false') + '"') + ' ' + btn('Order of ways', 'sheet', ' aria-expanded="' + (SH.view.sheet ? 'true' : 'false') + '"') + '</p>' + (SH.view.sheet ? orderSheet(V) : '');
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

  // ------------------------------------------------------------------------------------------------ screens
  function btn(label, act, extra, cls) { return '<button type="button" class="btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>'; }
  function topButtons() {
    return btn('New list', 'new') + ' <button type="button" class="btn" data-act="from-log" disabled title="Available in a coming step">From the crafting log</button>';
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
      (t.make ? ' <span class="tag">Must be crafted by me: ' + (t.crafted || 0) + ' of ' + t.qty + ' crafted</span>' : '') + '</div>';
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
    var out = statusHtml() + '<div class="lists-bar">' + btn('Your lists', 'back') + '</div>' +
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
    if (SH.view.combined) renderCombined(); else if (SH.view.list) renderList(); else renderHome();
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
      case 'hide': SH.view.hide = !SH.view.hide; render(); break;
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
    if (f === 'qty') act(function (s) { return labeled(S.setQty(s, r.list, r.tid, el.value), 'Changed an amount of ' + itemName(r.item)); });
    else if (f === 'have') act(function (s) { return labeled(S.setHave(s, c.owner, c.item, el.getAttribute('data-q'), el.value), 'Changed what you have of ' + itemName(c.item)); });
    else if (f === 'flag') act(function (s) { return labeled(S.setFlag(s, r.list, r.tid, el.getAttribute('data-flag'), el.checked), 'Changed a setting of ' + itemName(r.item)); });
    else if (f === 'step') act(function (s) { return labeled(S.setStep(s, r.list, r.tid, el.value), 'Moved ' + itemName(r.item) + ' to another step'); });
    else if (f === 'way') { var v = el.value; act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { by: v || null, offer: null }), 'Chose how to get ' + itemName(c.item)); }); }
    else if (f === 'offer') { var key = el.value; act(function (s) { return labeled(S.setWay(s, c.owner, c.item, { by: 'trade', offer: key }), 'Chose a trade for ' + itemName(c.item)); }); }
    else if (f === 'tick') { var id = el.closest('[data-list]').getAttribute('data-list'), on = el.checked; act(function (s) { return S.tickCombined(s, id, on); }); }
    else if (f === 'listname') act(function (s) { return S.renameList(s, listId, el.value); });
  });

  // another page saved (the Tracker after a cloud sync, another tab): show its change, once nothing of ours is waiting
  function reload() {
    if (SH.hold) return Promise.resolve(); // a test holds this page's copy to make it stale (__lists.hold)
    if (SH.busy || SH.queue.length) { SH.reloadLater = true; return Promise.resolve(); }
    return loadSave().then(function () { if (SH.view.list && !sec().lists[SH.view.list]) SH.view.list = null; render(); });
  }
  window.__lists = { reload: reload, state: SH, data: function () { return DATA; }, section: function () { return SH.sec; }, hold: function (on) { SH.hold = !!on; }, combined: function () { return S.combined(sec()); }, plan: function (owner) { return planOf(sec(), owner); } };
  if (CC) CC.onChange(reload);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reload(); });
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).then(function (reg) {
      reg.update().catch(function () { /* offline */ });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { /* offline */ }); });
    }).catch(function () { /* works without offline support */ });
  }
  Promise.all([loadData(), loadSave()]).then(function () { render(); document.documentElement.dataset.ready = '1'; })
    .catch(function (e) { main.innerHTML = '<div class="lists-note"><b>The game data could not be opened.</b> ' + esc(e && e.message) + '</div>'; });
})();
