// Eveniunt Command Center, Lists: the planning engine (docs/lists-spec.md section 5).
// Pure plain script: attaches to globalThis.LISTS, so it runs in the page and in Node tests. No DOM, no storage, no clock,
// no network; the input is never changed. Nothing here reads or automates the game: stock is what the player typed.
//
// Data shapes (tracker/data/lists.json): items { id: [name, flags, merchantSells] } (flags 1 tradable, 2 can be HQ,
// 4 always collectable, 8 crystal); recipes { id: [item, yield, job, level, stars, [[item, amount]...], flags] } (flags 1 HQ,
// 8 collectable); gather { item: [job, level, zone, hours or 0, minutes] }; trades { item: [[gives, [[currency, amount]...],
// hq 0/1, gcRank, npc]...] } (currency 1 is gil).
//
// Choices the spec leaves open (each keeps every invariant; listed in the work item's report):
//  - market is a source only for a tradable item (flag 1); an item with no source at all is planned as `other`.
//  - a list without steps has one step whose id is the empty text.
//  - `make` needs a recipe: the target's own when it is a recipe of the item, else the item's recipe of lowest level.
//  - collectable stock is given to the collectable lines of one item in recipe order, not list order (so that
//    reordering lists never moves a total, E9); within a line it is given in list then step order.
//  - (accepted) market only for a tradable item; a list without steps has one step with the empty id; `make` uses the target's
//    recipe or else the item's lowest-level recipe; collectable stock goes to one item's collectable lines in recipe order;
//    "total to get or trade" compares short, got, crafts and, for trade lines only, trades; `LISTS.way` returns an offer for trade
//    ways only; the vendor offer is chosen by the shortfall; `LISTS.tree` includes the wanted items; nextWindow reads minutes as
//    Eorzean minutes, merges overlapping windows and gives null for an untimed node; `LISTS.missing` takes ticks and excluded as a
//    Set, an array or an object; the data index is cached per data object (do not change data after planning).
//  - D27 to D29 (spec): record takes only unpromised stock; a hand-in removes only the handed-in items' own stock; a cut affects only
//    parts that pass needs down.
//  - plan lines carry extra fields: from {nq,hq,coll} (stock given by quality; shares also carry fromDirect, the part given to non-make wanted items), quality, job, yield, node; the plan
//    carries stepOf { targetKey: stepId } for finishStep.
(function () {
  'use strict';
  var L = (globalThis.LISTS = globalThis.LISTS || {});
  var DEFAULT_ORDER = ['vendor', 'craft', 'gather', 'trade', 'market'];
  var IX = typeof WeakMap === 'function' ? new WeakMap() : null;
  var EMPTY = [];
  var QS = ['nq', 'hq', 'coll'];
  var ET_HOUR = 175000, ET_DAY = 24 * ET_HOUR;

  function nat(x) { x = Math.floor(+x); return x > 0 && isFinite(x) ? x : 0; }
  function cdiv(a, b) { return a <= 0 ? 0 : Math.ceil(a / b); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function zero() { return { nq: 0, hq: 0, coll: 0 }; }
  function byNum(a, b) { return a - b; }

  // ------------------------------------------------------------------------------------------------ data index
  function index(data) {
    var ix = IX && IX.get(data);
    if (ix) return ix;
    ix = { ofItem: {}, offers: {} };
    var id, r, k;
    for (id in data.recipes || {}) { r = data.recipes[id]; (ix.ofItem[r[0]] = ix.ofItem[r[0]] || []).push(+id); }
    for (k in ix.ofItem) ix.ofItem[k].sort(function (a, b) { var x = data.recipes[a], y = data.recipes[b]; return x[3] - y[3] || a - b; });
    if (IX) IX.set(data, ix);
    return ix;
  }
  function flagsOf(data, item) { var it = data.items && data.items[item]; return it ? it[1] | 0 : 0; }
  function nameOf(data, item) { var it = data.items && data.items[item]; return it ? it[0] : 'item ' + item; }
  // offers of an item in one quality: { gil: [...], trade: [...] }, each offer { gives, cur, hq, rank, npc, key }
  function offersOf(ctx, item, q) {
    var ck = item + '|' + q, got = ctx.ix.offers[ck];
    if (got) return got;
    got = { gil: [], trade: [] };
    var raw = (ctx.data.trades && ctx.data.trades[item]) || EMPTY;
    for (var i = 0; i < raw.length; i++) {
      var o = raw[i], isHq = o[2] ? 'hq' : 'normal';
      if (isHq !== q) continue;
      var off = { gives: o[0], cur: o[1], hq: o[2] ? 1 : 0, rank: o[3] || 0, npc: o[4], key: o[4] + '.' + o[0] + '.' + o[1][0][0] };
      (o[1].length === 1 && o[1][0][0] === 1 ? got.gil : got.trade).push(off);
    }
    ctx.ix.offers[ck] = got;
    return got;
  }
  function betterGil(a, b, s) {
    var ta = cdiv(s, a.gives) * a.cur[0][1], tb = cdiv(s, b.gives) * b.cur[0][1];
    if (ta !== tb) return ta < tb;
    var x = a.cur[0][1] * b.gives, y = b.cur[0][1] * a.gives;
    if (x !== y) return x < y;
    if (a.gives !== b.gives) return a.gives < b.gives;
    return a.npc < b.npc;
  }
  function pickGil(offers, s) {
    var best = null;
    for (var i = 0; i < offers.length; i++) if (!best || betterGil(offers[i], best, s)) best = offers[i];
    return best;
  }
  function betterTrade(a, b) {
    if (a.cur.length !== b.cur.length) return a.cur.length < b.cur.length;
    var x = a.cur[0][1] * b.gives, y = b.cur[0][1] * a.gives;
    if (x !== y) return x < y;
    if (a.cur[0][0] !== b.cur[0][0]) return a.cur[0][0] < b.cur[0][0];
    return a.npc < b.npc;
  }
  function pickTrade(offers, stored) {
    var i, best = null;
    if (stored) for (i = 0; i < offers.length; i++) if (offers[i].key === stored) return offers[i];
    for (i = 0; i < offers.length; i++) if (!best || betterTrade(offers[i], best)) best = offers[i];
    return best;
  }

  // ------------------------------------------------------------------------------------------------ context and ways
  function parseOrder(o) {
    var a = typeof o === 'string' ? o.split(/\s+/).filter(Boolean) : Array.isArray(o) ? o.slice() : null;
    if (!a || a.length !== 5) return DEFAULT_ORDER;
    for (var i = 0; i < 5; i++) if (DEFAULT_ORDER.indexOf(a[i]) < 0 || a.indexOf(a[i]) !== i) return DEFAULT_ORDER;
    return a;
  }
  function makeCtx(data, input) {
    input = input || {};
    return { data: data, ix: index(data), order: parseOrder(input.order), ways: input.ways || {}, wc: {}, ec: {} };
  }
  function recipeChoice(ctx, item, stored) {
    var r = stored && ctx.data.recipes[stored];
    if (r && r[0] === item) return +stored;
    var l = ctx.ix.ofItem[item];
    return l ? l[0] : 0;
  }
  // The way of an item in one quality ('normal' or 'hq'): fixed by the data, the order and the stored way (D12, D14).
  function wayOf(ctx, item, q) {
    var ck = item + '|' + q, c = ctx.wc[ck];
    if (c) return c;
    var data = ctx.data, w = ctx.ways[item] || {}, res = null;
    function avail(by) {
      switch (by) {
        case 'have': return true;
        case 'craft': var rid = recipeChoice(ctx, item, w.recipe); return !!rid && (q === 'normal' || (data.recipes[rid][6] & 1) === 1);
        case 'vendor': return offersOf(ctx, item, q).gil.length > 0;
        case 'trade': return offersOf(ctx, item, q).trade.length > 0;
        case 'gather': return q === 'normal' && !!(data.gather && data.gather[item]);
        case 'market': return (flagsOf(data, item) & 1) === 1;
        default: return false;
      }
    }
    function make(by, why) {
      var r = { by: by, why: why, recipe: 0, offer: null, _o: null };
      if (by === 'craft') r.recipe = recipeChoice(ctx, item, w.recipe);
      if (by === 'trade') { r._o = pickTrade(offersOf(ctx, item, q).trade, w.offer); r.offer = r._o.key; }
      return r;
    }
    if (w.by && avail(w.by)) res = make(w.by, 'chosen');
    for (var i = 0; !res && i < ctx.order.length; i++) if (avail(ctx.order[i])) res = make(ctx.order[i], 'order');
    if (!res) res = { by: 'other', why: 'none', recipe: 0, offer: null, _o: null };
    ctx.wc[ck] = res;
    return res;
  }
  L.way = function (data, input, itemId, quality) {
    var r = wayOf(makeCtx(data, input), +itemId, quality === 'hq' ? 'hq' : 'normal');
    return { by: r.by, why: r.why, recipe: r.recipe, offer: r.offer };
  };

  // ------------------------------------------------------------------------------------------------ loops (D24)
  // The items an item can lead to: every recipe's materials, and the non-gil currencies of its trade ways (both qualities).
  function edgesOf(ctx, item) {
    var c = ctx.ec[item];
    if (c) return c;
    var out = [], seen = {}, rs = ctx.ix.ofItem[item] || EMPTY, i, j;
    function add(m) { if (m !== 1 && !seen[m]) { seen[m] = 1; out.push(m); } }
    for (i = 0; i < rs.length; i++) { var ing = ctx.data.recipes[rs[i]][5]; for (j = 0; j < ing.length; j++) add(ing[j][0]); }
    var qs = ['normal', 'hq'];
    for (i = 0; i < 2; i++) {
      var w = wayOf(ctx, item, qs[i]);
      if (w.by === 'trade') for (j = 0; j < w._o.cur.length; j++) add(w._o.cur[j][0]);
    }
    ctx.ec[item] = out;
    return out;
  }
  function reach(ctx, roots) {
    var adj = new Map(), nodes = [], stack = roots.slice(), v;
    while (stack.length) {
      v = stack.pop();
      if (adj.has(v)) continue;
      var es = edgesOf(ctx, v); adj.set(v, es); nodes.push(v);
      for (var i = 0; i < es.length; i++) if (!adj.has(es[i])) stack.push(es[i]);
    }
    nodes.sort(byNum);
    return { adj: adj, nodes: nodes };
  }
  // Cut the lowest item of every loop, search again until none is left (E14). Returns { notes, set }.
  function cutLoops(ctx, g) {
    var notes = {}, set = new Set();
    for (;;) {
      var idx = new Map(), low = new Map(), on = new Set(), st = [], counter = 0, found = [], k, s;
      for (k = 0; k < g.nodes.length; k++) {
        s = g.nodes[k];
        if (idx.has(s)) continue;
        var cs = [{ v: s, i: 0 }];
        idx.set(s, counter); low.set(s, counter); counter++; st.push(s); on.add(s);
        while (cs.length) {
          var f = cs[cs.length - 1], es = set.has(f.v) ? EMPTY : g.adj.get(f.v), w;
          if (f.i < es.length) {
            w = es[f.i++];
            if (!idx.has(w)) { idx.set(w, counter); low.set(w, counter); counter++; st.push(w); on.add(w); cs.push({ v: w, i: 0 }); }
            else if (on.has(w)) low.set(f.v, Math.min(low.get(f.v), idx.get(w)));
          } else {
            cs.pop();
            if (cs.length) { var p = cs[cs.length - 1].v; low.set(p, Math.min(low.get(p), low.get(f.v))); }
            if (low.get(f.v) === idx.get(f.v)) {
              var comp = [];
              do { w = st.pop(); on.delete(w); comp.push(w); } while (w !== f.v);
              if (comp.length > 1 || es.indexOf(f.v) >= 0) found.push(comp);
            }
          }
        }
      }
      if (!found.length) break;
      for (k = 0; k < found.length; k++) {
        var comp2 = found[k].slice().sort(byNum), c = comp2[0], names = comp2.map(function (x) { return nameOf(ctx.data, x); });
        set.add(c);
        notes[c] = (comp2.length === 1 ? names[0] + ' needs itself'
          : (comp2.length === 2 ? names[0] + ' and ' + names[1] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]) + ' need each other')
          + '; ' + nameOf(ctx.data, c) + ' is listed under Other.';
      }
    }
    return { notes: notes, set: set };
  }
  function liveItems(lists) {
    var roots = [], seen = {};
    for (var i = 0; i < (lists || []).length; i++) {
      var ts = (lists[i] && lists[i].targets) || EMPTY;
      for (var j = 0; j < ts.length; j++) { var t = ts[j]; if (t && !t.done && nat(t.qty) > 0 && isFinite(+t.item) && !seen[t.item]) { seen[t.item] = 1; roots.push(+t.item); } }
    }
    return roots;
  }
  L.cuts = function (data, input) {
    var ctx = makeCtx(data, input), g = reach(ctx, liveItems((input || {}).lists));
    return cutLoops(ctx, g).notes;
  };
  // every item the wanted items could need, whatever the ways and the stock
  L.tree = function (data, lists) {
    var ix = index(data), seen = new Set(), stack = liveItems(lists), v, i, j;
    while (stack.length) {
      v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      var rs = ix.ofItem[v] || EMPTY;
      for (i = 0; i < rs.length; i++) { var ing = data.recipes[rs[i]][5]; for (j = 0; j < ing.length; j++) if (!seen.has(ing[j][0])) stack.push(ing[j][0]); }
      var tr = (data.trades && data.trades[v]) || EMPTY;
      for (i = 0; i < tr.length; i++) for (j = 0; j < tr[i][1].length; j++) { var c = tr[i][1][j][0]; if (c !== 1 && !seen.has(c)) stack.push(c); }
    }
    return seen;
  };

  // ------------------------------------------------------------------------------------------------ the plan
  function classify(ctx, t) {
    var item = +t.item, data = ctx.data, rid = recipeChoice(ctx, item, t.recipe), note = null;
    if (t.make) {
      if (rid) return { part: 'make', recipe: rid };
      note = 'make-no-recipe';
    }
    if (t.coll) {
      if ((rid && (data.recipes[rid][6] & 8)) || (flagsOf(data, item) & 4)) return { part: 'coll', recipe: rid };
      note = 'coll-not-collectable';
    }
    return { part: t.hq ? 'hq' : 'normal', recipe: 0, note: note };
  }
  var PART_RANK = { make: 0, coll: 1, hq: 2, normal: 3 };
  var QUALITY = { make: 'nq', coll: 'coll', hq: 'hq', normal: 'nq' };

  L.plan = function (data, input) {
    input = input || {};
    var ctx = makeCtx(data, input), lists = input.lists || [], haveIn = input.have || {}, prices = input.prices || null;
    var lines = {}, byItem = {}, notes = [], stepOf = {}, listInfo = [], li, ti, k;

    // lists, steps
    for (li = 0; li < lists.length; li++) {
      var l = lists[li], sids = Object.keys((l && l.steps) || {});
      sids.sort(function (a, b) { var x = l.steps[a], y = l.steps[b]; return ((x && x.n) || 0) - ((y && y.n) || 0) || (a < b ? -1 : a > b ? 1 : 0); });
      var idxOf = {}; sids.forEach(function (s, i) { idxOf[s] = i; });
      listInfo.push({ id: l.id, sids: sids, idxOf: idxOf, first: sids.length ? sids[0] : '' });
    }
    function addNeed(item, part, recipe, cl, si, dir, n) {
      if (n <= 0) return;
      var key = item + '|' + part + '|' + recipe, ln = lines[key];
      if (!ln) { ln = lines[key] = { key: key, item: item, part: part, recipe: recipe, cs: {} }; (byItem[item] = byItem[item] || []).push(ln); }
      var ck = cl + '|' + si + '|' + dir, c = ln.cs[ck];
      if (!c) c = ln.cs[ck] = { li: cl, si: si, dir: dir, n: 0 };
      c.n += n;
    }
    // wanted items
    for (li = 0; li < lists.length; li++) {
      var ts = lists[li].targets || EMPTY, info = listInfo[li];
      for (ti = 0; ti < ts.length; ti++) {
        var t = ts[ti];
        if (!t || t.done || !isFinite(+t.item)) continue;
        var qty = nat(t.qty); if (qty < 1) continue;
        var cls = classify(ctx, t), tkey = info.id + '.' + (t.id != null ? t.id : ti);
        if (cls.note) notes.push({ kind: cls.note, item: +t.item, list: info.id, target: tkey, text: cls.note === 'coll-not-collectable' ? 'This cannot be made as a collectable; planned as an ordinary item.' : 'This cannot be made as a crafted item; planned as an ordinary item.' });
        var sid = t.step != null && info.idxOf[t.step] !== undefined ? t.step : info.first;
        stepOf[tkey] = sid;
        var crafted = Math.min(nat(t.crafted), qty), n = cls.part === 'make' ? qty - crafted : qty;
        addNeed(+t.item, cls.part, cls.recipe, li, info.idxOf[sid] || 0, cls.part === 'make' ? 0 : 1, n);
      }
    }
    // loops and the order items are settled in
    var g = reach(ctx, liveItems(lists)), cut = cutLoops(ctx, g);
    var seenV = new Set(), post = [];
    g.nodes.forEach(function (root) {
      if (seenV.has(root)) return;
      var stack = [{ v: root, i: 0 }]; seenV.add(root);
      while (stack.length) {
        var f = stack[stack.length - 1], es = cut.set.has(f.v) ? EMPTY : g.adj.get(f.v);
        if (f.i < es.length) { var w = es[f.i++]; if (!seenV.has(w)) { seenV.add(w); stack.push({ v: w, i: 0 }); } }
        else { stack.pop(); post.push(f.v); }
      }
    });
    post.reverse();

    // settle
    var out = {}, shares = {}, used = {}, gilVendor = 0, gilMarket = 0, unknown = [];
    function price(item) { var p = prices && prices[item]; return Number.isInteger(p) && p > 0 ? p : null; }
    function share(c, key) {
      var sk = c.li + '|' + c.si, s = shares[sk];
      if (!s) s = shares[sk] = { li: c.li, si: c.si, lines: {} };
      var o = s.lines[key];
      if (!o) o = s.lines[key] = { need: 0, given: 0, outside: 0, short: 0, crafts: 0, trades: 0, got: 0, makes: 0, cost: 0, from: zero(), fromDirect: zero() };
      return o;
    }
    function childPart(m) { var w = ctx.ways[m]; return w && w.hq ? 'hq' : 'normal'; }

    function settleLine(ln, pool, takeOrder, isCut) {
      var cs = Object.keys(ln.cs).map(function (x) { return ln.cs[x]; });
      cs.sort(function (a, b) { return a.li - b.li || a.si - b.si || a.dir - b.dir; });
      var rows = [], need = 0, given = 0, from = zero(), q, i;
      for (i = 0; i < cs.length; i++) {
        var rem = cs[i].n, fr = zero();
        for (var j = 0; j < takeOrder.length; j++) { q = takeOrder[j]; var tk = Math.min(rem, pool[q]); pool[q] -= tk; fr[q] += tk; rem -= tk; }
        rows.push({ c: cs[i], n: cs[i].n, g: cs[i].n - rem, from: fr });
        need += cs[i].n; given += cs[i].n - rem;
        for (q in fr) from[q] += fr[q];
      }
      var short = need - given, item = ln.item, qual = ln.part === 'hq' ? 'hq' : 'normal', by, why, recipe = 0, offer = null, rec = null, yld = 1;
      if (ln.part === 'make' || ln.part === 'coll') {
        if (isCut) { by = 'other'; why = 'cut'; }
        else if (ln.recipe) { by = 'craft'; why = ln.part; recipe = ln.recipe; }
        else { by = 'other'; why = 'none'; }
      } else {
        var w = wayOf(ctx, item, qual); by = w.by; why = w.why; recipe = w.recipe; if (by === 'trade') offer = w._o;
        if (isCut && (by === 'craft' || by === 'trade')) { by = 'other'; why = 'cut'; recipe = 0; offer = null; } // D29: only a part that passes needs down
      }
      if (by === 'craft') { rec = data.recipes[recipe]; yld = Math.max(1, rec[1] | 0); }
      if (by === 'vendor') offer = pickGil(offersOf(ctx, item, qual).gil, short);
      var gives = offer ? Math.max(1, offer.gives | 0) : 1, gilPer = 0, cur = [];
      if (by === 'vendor') gilPer = offer.cur[0][1];
      if (by === 'trade') for (i = 0; i < offer.cur.length; i++) { if (offer.cur[i][0] === 1) gilPer += offer.cur[i][1]; else cur.push(offer.cur[i]); }
      var px = by === 'market' ? price(item) : null;
      var S = 0, prev = 0, tot = { crafts: 0, trades: 0, got: 0, makes: 0, outside: 0, cost: 0 }, costUnknown = false;
      for (i = 0; i < rows.length; i++) {
        var r = rows[i], s = r.n - r.g, units = 0, cr = 0, tr = 0, mk = 0, outside = 0, cost = 0, cumNow;
        S += s;
        if (by === 'craft') { cumNow = cdiv(S, yld); cr = cumNow - prev; prev = cumNow; mk = cr * yld; if (cr) for (var m = 0; m < rec[5].length; m++) addNeed(rec[5][m][0], childPart(rec[5][m][0]), 0, r.c.li, r.c.si, 0, cr * rec[5][m][1]); }
        else if (by === 'vendor' || by === 'trade') {
          cumNow = cdiv(S, gives); tr = cumNow - prev; prev = cumNow; units = tr * gives; cost = tr * gilPer;
          for (var n2 = 0; tr && n2 < cur.length; n2++) addNeed(cur[n2][0], 'normal', 0, r.c.li, r.c.si, 0, tr * cur[n2][1]);
        } else if (by === 'have') outside = s;
        else { units = s; if (by === 'market' && s) { if (px) cost = s * px; else costUnknown = true; } }
        var sh = share(r.c, ln.key);
        sh.need += r.n; sh.given += r.g; sh.outside += outside; sh.short += s; sh.crafts += cr; sh.trades += tr; sh.got += units; sh.makes += mk; sh.cost += cost;
        for (q in r.from) { sh.from[q] += r.from[q]; if (r.c.dir) sh.fromDirect[q] += r.from[q]; }
        tot.crafts += cr; tot.trades += tr; tot.got += units; tot.makes += mk; tot.outside += outside; tot.cost += cost;
      }
      var node = by === 'gather' ? data.gather[item] : null;
      out[ln.key] = {
        item: item, part: ln.part, need: need, given: given, outside: tot.outside, short: short, by: by, why: why, recipe: recipe,
        offer: offer ? { key: offer.key, npc: offer.npc, gives: offer.gives, cur: offer.cur, hq: offer.hq, rank: offer.rank } : null,
        crafts: tot.crafts, trades: tot.trades, makes: tot.makes, got: tot.got, spare: by === 'have' ? 0 : tot.makes + tot.got - short,
        cost: by === 'market' && costUnknown ? null : tot.cost, timed: node && Array.isArray(node[3]) && node[3].length ? { hours: node[3], minutes: node[4] } : null,
        from: from, quality: QUALITY[ln.part], job: by === 'craft' ? rec[2] : null, yield: by === 'craft' ? yld : null,
        node: node ? { job: node[0], level: node[1], zone: node[2] } : null
      };
      if (by === 'vendor') gilVendor += tot.cost;
      if (by === 'trade') gilVendor += tot.cost;
      if (by === 'market') { if (costUnknown) unknown.push(item); else gilMarket += tot.cost; }
    }

    post.forEach(function (item) {
      var lns = byItem[item];
      if (!lns) return;
      var isCut = cut.set.has(item), h = haveIn[item] || {}, pool = { nq: nat(h.nq), hq: nat(h.hq), coll: nat(h.coll) }, start = { nq: pool.nq, hq: pool.hq, coll: pool.coll };
      lns.sort(function (a, b) { return PART_RANK[a.part] - PART_RANK[b.part] || a.recipe - b.recipe; });
      lns.forEach(function (ln) {
        settleLine(ln, pool, ln.part === 'make' ? EMPTY : ln.part === 'coll' ? ['coll'] : ln.part === 'hq' ? ['hq'] : ['nq', 'hq'], isCut);
      });
      used[item] = { nq: start.nq - pool.nq, hq: start.hq - pool.hq, coll: start.coll - pool.coll };
    });

    // left over stock
    var left = {}, hk;
    Object.keys(haveIn).sort(byNum).forEach(function (id) {
      var h = haveIn[id] || {}, u = used[id] || zero(), e = { nq: nat(h.nq) - u.nq, hq: nat(h.hq) - u.hq, coll: nat(h.coll) - u.coll };
      if (e.nq || e.hq || e.coll) left[id] = e;
    });
    var leftover = {}, leftIds = Object.keys(left).map(Number);
    if (leftIds.length) lists.forEach(function (lst) {
      var tr = L.tree(data, [lst]), arr = leftIds.filter(function (id) { return tr.has(id) && (left[id].nq || left[id].hq); }).map(function (id) { return { item: id, nq: left[id].nq, hq: left[id].hq }; });
      if (arr.length) leftover[lst.id] = arr;
    });

    // items, shop, spare, order
    var itemsOut = {}, shop = { vendor: [], gather: [], trade: [], market: [], other: [], outside: [] }, spare = {}, craftKeys = [];
    Object.keys(out).forEach(function (key) {
      var ln = out[key];
      (itemsOut[ln.item] = itemsOut[ln.item] || []).push(key);
      if (ln.spare > 0) spare[key] = ln.spare;
      if (ln.by === 'have') { if (ln.short > 0) shop.outside.push(key); }
      else if (ln.by === 'craft') { if (ln.crafts > 0) craftKeys.push(key); }
      else if (ln.short > 0) shop[ln.by].push(key);
    });
    Object.keys(shop).forEach(function (s) { shop[s].sort(function (a, b) { return out[a].item - out[b].item || PART_RANK[out[a].part] - PART_RANK[out[b].part]; }); });
    // crafting order: a craft after those that make its materials, blocks of one job, greedy on the current job
    var byItemCraft = {}, indeg = {}, kids = {};
    craftKeys.forEach(function (key) { (byItemCraft[out[key].item] = byItemCraft[out[key].item] || []).push(key); indeg[key] = 0; kids[key] = []; });
    craftKeys.forEach(function (key) {
      data.recipes[out[key].recipe][5].forEach(function (ing) { (byItemCraft[ing[0]] || EMPTY).forEach(function (p) { kids[p].push(key); indeg[key]++; }); });
    });
    var ready = craftKeys.filter(function (x) { return indeg[x] === 0; }), orderOut = [], curJob = null;
    function rk(a, b) { return out[a].item - out[b].item || PART_RANK[out[a].part] - PART_RANK[out[b].part] || out[a].recipe - out[b].recipe; }
    while (ready.length) {
      ready.sort(rk);
      var pick = null, jc = {};
      for (k = 0; k < ready.length; k++) { var jb = out[ready[k]].job; jc[jb] = (jc[jb] || 0) + 1; if (jb === curJob && !pick) pick = ready[k]; }
      if (!pick) {
        var bj = null; Object.keys(jc).map(Number).sort(byNum).forEach(function (j) { if (bj === null || jc[j] > jc[bj]) bj = j; });
        curJob = bj; pick = ready.filter(function (x) { return out[x].job === bj; })[0]; orderOut.push({ job: bj, crafts: [] });
      }
      orderOut[orderOut.length - 1].crafts.push(pick);
      ready.splice(ready.indexOf(pick), 1);
      kids[pick].forEach(function (c) { if (--indeg[c] === 0) ready.push(c); });
    }

    // shares in list then step order
    var sharesOut = Object.keys(shares).map(function (x) { return shares[x]; }).sort(function (a, b) { return a.li - b.li || a.si - b.si; }).map(function (s) {
      return { list: listInfo[s.li].id, step: listInfo[s.li].sids.length ? listInfo[s.li].sids[s.si] : '', lines: s.lines };
    });
    unknown.sort(byNum);
    var cutOut = {}; Object.keys(cut.notes).forEach(function (c) { cutOut[c] = cut.notes[c]; notes.push({ kind: 'cut', item: +c, text: cut.notes[c] }); });
    return { lines: out, items: itemsOut, shares: sharesOut, order: orderOut, shop: shop, gil: { vendor: gilVendor, market: gilMarket, unknown: unknown }, spare: spare, left: left, leftover: leftover, cut: cutOut, notes: notes, stepOf: stepOf };
  };

  // ------------------------------------------------------------------------------------------------ stock and records
  function addStock(have, item, q, n) {
    if (n <= 0) return;
    var e = have[item] || (have[item] = zero());
    e.nq = nat(e.nq); e.hq = nat(e.hq); e.coll = nat(e.coll); e[q] += n;
  }
  function tidy(have, item) { var e = have[item]; if (e && !nat(e.nq) && !nat(e.hq) && !nat(e.coll)) delete have[item]; }
  L.bought = function (have, itemId, units, quality) {
    var h = clone(have || {}), q = quality === 'hq' ? 'hq' : quality === 'coll' ? 'coll' : 'nq';
    addStock(h, itemId, q, nat(units));
    return h;
  };
  // Recording crafts is always allowed (D26, E12, D27). state is { have, targets, ways } of one owner. Materials come from the
  // stock the plan gave this craft's own material line, then from stock the plan gave to no line (normal before high quality;
  // only high quality when that material's way has hq); never from stock the plan gave to another line.
  L.record = function (data, state, plan, o) {
    var have = clone(state.have || {}), targets = clone(state.targets || {}), ways = state.ways || {}, short = [];
    var line = o.line, r = data.recipes[line.recipe], times = nat(o.times);
    if (!r || !times) return { have: have, targets: targets, short: short };
    var q = o.quality || line.quality || 'nq', y = Math.max(1, r[1] | 0), ing = r[5], orig = state.have || {};
    for (var i = 0; i < ing.length; i++) {
      var m = ing[i][0], take = times * ing[i][1], hqWay = !!(ways[m] && ways[m].hq), e = have[m] || zero(), o0 = orig[m] || {};
      e.nq = nat(e.nq); e.hq = nat(e.hq); e.coll = nat(e.coll);
      var own = plan.lines[m + '|' + (hqWay ? 'hq' : 'normal') + '|0'], givenAll = zero(), k2;
      (plan.items[m] || []).forEach(function (k) { QS.forEach(function (qq) { givenAll[qq] += plan.lines[k].from[qq]; }); });
      var ownFrom = own ? own.from : zero(), free = { nq: Math.max(0, nat(o0.nq) - givenAll.nq), hq: Math.max(0, nat(o0.hq) - givenAll.hq) };
      var order = hqWay ? ['hq'] : ['nq', 'hq'], got = 0, t;
      for (k2 = 0; k2 < order.length; k2++) { t = Math.min(take - got, ownFrom[order[k2]], e[order[k2]]); e[order[k2]] -= t; got += t; }
      for (k2 = 0; k2 < order.length; k2++) { t = Math.min(take - got, free[order[k2]], e[order[k2]]); e[order[k2]] -= t; got += t; }
      if (take - got > 0 && short.indexOf(m) < 0) short.push(m);
      if (have[m]) tidy(have, m);
    }
    addStock(have, line.item, q === 'hq' ? 'hq' : q === 'coll' ? 'coll' : 'nq', times * y);
    var made = times * y, keys = Object.keys(o.targets || {});
    for (i = 0; i < keys.length; i++) {
      var tg = targets[keys[i]];
      if (!tg || tg.item !== line.item) continue;
      var c = Math.min(nat(o.targets[keys[i]]), made, nat(tg.qty) - nat(tg.crafted));
      if (c > 0) { tg.crafted = nat(tg.crafted) + c; made -= c; }
    }
    return { have: have, targets: targets, short: short };
  };
  // A step handed in (E19): its wanted items are done; stock the plan gave them (not their must-craft ones) is taken out.
  L.finishStep = function (plan, state, listId, stepId) {
    var have = clone(state.have || {}), targets = clone(state.targets || {}), k;
    for (k in targets) {
      if (k.slice(0, k.indexOf('.')) === String(listId) && !targets[k].done && plan.stepOf && plan.stepOf[k] === stepId) targets[k].done = true;
    }
    plan.shares.forEach(function (s) {
      if (s.list !== listId || s.step !== stepId) return;
      Object.keys(s.lines).forEach(function (key) {
        var sh = s.lines[key], item = plan.lines[key].item;
        ['nq', 'hq', 'coll'].forEach(function (q) {
          var n = sh.fromDirect[q];
          if (n > 0 && have[item]) { have[item][q] = Math.max(0, nat(have[item][q]) - n); }
        });
        if (have[item]) tidy(have, item);
      });
    });
    return { have: have, targets: targets };
  };

  // ------------------------------------------------------------------------------------------------ crafting log, time
  function has(x, id) { return !x ? false : typeof x.has === 'function' ? x.has(id) || x.has(String(id)) : Array.isArray(x) ? x.indexOf(id) >= 0 || x.indexOf(String(id)) >= 0 : !!x[id]; }
  // the recipes of one crafting-log page that are not ticked and are in the data
  L.missing = function (data, ticks, excluded, job, page) {
    var pages = data.log && data.log[job], pg = pages && pages[page];
    if (!pg) return [];
    return pg[1].filter(function (id) { return data.recipes && data.recipes[id] && !has(ticks, id) && !has(excluded, id); });
  };
  // Eorzea time: one Eorzean hour is 175,000 ms. Windows open at each listed hour and last `minutes` Eorzean minutes.
  L.nextWindow = function (hours, minutes, nowMs) {
    if (!Array.isArray(hours) || !hours.length || !(minutes > 0)) return null;
    var len = minutes * ET_HOUR / 60, day = Math.floor(nowMs / ET_DAY), iv = [], d, i;
    var hs = hours.slice().sort(byNum);
    for (d = day - 1; d <= day + 2; d++) for (i = 0; i < hs.length; i++) iv.push([d * ET_DAY + hs[i] * ET_HOUR, d * ET_DAY + hs[i] * ET_HOUR + len]);
    iv.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    iv.forEach(function (x) { var l = merged[merged.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else merged.push([x[0], x[1]]); });
    for (i = 0; i < merged.length; i++) {
      if (merged[i][0] <= nowMs && nowMs < merged[i][1]) return { opensAt: merged[i][0], closesAt: merged[i][1], open: true };
      if (merged[i][0] > nowMs) return { opensAt: merged[i][0], closesAt: merged[i][1], open: false };
    }
    return null;
  };
})();
