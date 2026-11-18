// Eveniunt Command Center, Submersibles: expected loot and gil of a route for a build (item D2, docs/submersibles-droprates-spec.md).
// Pure arithmetic on the tables `breakpoints` and `dropRates` of data/submarines.json (community drop records, see the data's
// sources). No randomness, no constant of its own except FEW. Every assumption of spec section 5.2 sits in one named place:
//   A1  BAND / RESULT: a stat at or above a threshold puts the survey in the higher band or result (state).
//   A2  TIER_ODDS: tier odds are the measured share of that band's rolls, not dependent on how far above the threshold.
//   A3  ITEM_ODDS: item odds in a tier are the same in every band (Amount / the pool's rolls).
//   A5  QUANTITY: range middle of the build's retrieval result, scaled so the pool's own retrieval mix gives Total / Amount.
//   A6  second item comes `DoubleDips / Favor` of the time when the build's favor reaches the sector's threshold.
//   A7  SECOND_LIKE_FIRST: the second item is drawn like the first (same tier odds, items, quantities): factor 1 + second.
// A later change of an assumption is a change of that one function. Plain script on globalThis.DROPS; the data is passed in.
(function () {
  'use strict';
  var X = (globalThis.DROPS = globalThis.DROPS || {});
  X.FEW = 100; // fewer rolls than this in a sector's band: the all-sector counts are used and the result is marked `few`

  var cache = new WeakMap(); // data -> { sectors: { id: { stateKey: compiled } } }
  function store(data) { var c = cache.get(data); if (!c) { c = {}; cache.set(data, c); } return c; }

  // Merchant price of one item (the game sheet's PriceLow, itemInfo[id][0]); an item without one counts 0.
  X.merchant = function (data) {
    var info = (data && data.itemInfo) || {};
    return function (id) { var r = info[id]; var p = r && r[0]; return p > 0 ? p : 0; };
  };

  // A1: band 0 low, 1 mid, 2 high (surveillance); retrieval result 0 poor, 1 normal, 2 optimal; favor yes or no.
  // null without a build or without thresholds for the sector.
  X.state = function (data, sectorId, st) {
    var b = data && data.breakpoints && data.breakpoints[sectorId];
    if (!st || !b || !isFinite(st.surveillance) || !isFinite(st.retrieval) || !isFinite(st.favor)) return null;
    return {
      band: st.surveillance >= b[1] ? 2 : st.surveillance >= b[0] ? 1 : 0,
      ret: st.retrieval >= b[3] ? 2 : st.retrieval >= b[2] ? 1 : 0,
      favor: st.favor >= b[4]
    };
  };

  // A2: tier odds from the band's roll counts; { p: [p1, p2, p3], rolls, few }.
  function tierOdds(data, pools, band) {
    var c = [pools[0].band[band], pools[1].band[band], pools[2].band[band]], sum = c[0] + c[1] + c[2], few = false, have = sum;
    if (sum < X.FEW) { // thin or empty band in this sector: the all-sector counts
      var all = data.dropRates.all; c = [all[0][band], all[1][band], all[2][band]]; sum = c[0] + c[1] + c[2]; few = true;
      return { p: sum > 0 ? c.map(function (x) { return x / sum; }) : [0, 0, 0], rolls: 0, have: have, few: few };
    }
    return { p: c.map(function (x) { return x / sum; }), rolls: sum, have: have, few: few };
  }

  // A5: quantity of every item of a pool at retrieval result r. rows: [id, Amount, Total, pmin, pmax, nmin, nmax, omin, omax].
  // Returns { id: quantity per roll that lands on the item (not yet times its odds) } as a list [id, odds, q], plus few.
  function poolItems(pool, r) {
    var rolls = pool.band[0] + pool.band[1] + pool.band[2], out = [], few = false;
    if (!rolls) return { list: out, few: true };
    for (var i = 0; i < pool.items.length; i++) {
      var it = pool.items[i], mid = [], have = [];
      for (var k = 0; k < 3; k++) { var lo = it[3 + 2 * k], hi = it[4 + 2 * k]; have[k] = lo > 0 || hi > 0; mid[k] = (lo + hi) / 2; }
      var use = -1; // result whose range is used: r, else the nearest recorded, lower first
      if (have[r]) use = r;
      else {
        for (var d = 1; d < 3 && use < 0; d++) { if (r - d >= 0 && have[r - d]) use = r - d; else if (r + d <= 2 && have[r + d]) use = r + d; }
        few = true;
      }
      var mean = it[2] / it[1], q;
      if (use < 0) q = mean; // no range at all: the recorded average
      else {
        var ws = 0, wm = 0; // shares renormalised over the results that have a range for this item
        for (var j = 0; j < 3; j++) if (have[j]) { ws += pool.ret[j]; wm += pool.ret[j] * mid[j]; }
        q = ws > 0 ? mid[use] * mean / (wm / ws) : mean;
      }
      out.push([it[0], it[1] / rolls, q]);
    }
    return { list: out, few: few };
  }

  function addTo(map, id, v) { map[id] = (map[id] || 0) + v; }

  // Compiled once per data, sector and state; the price is applied per call. tiers[t] = { p, list: [[id, qty per roll of the sector]] }.
  function compile(data, sectorId, stt) {
    var sec = data.dropRates && data.dropRates.sectors[sectorId];
    if (!sec) return null;
    var pools = sec.pools, n = sec.n, few = false, second, tiers = [], items = {}, rolls = n, have = n, t, i;
    if (stt) {
      var od = tierOdds(data, pools, stt.band); few = od.few; rolls = od.few ? 0 : od.rolls; have = od.have;
      second = stt.favor && sec.favor[0] > 0 ? sec.favor[1] / sec.favor[0] : 0; // A6
      for (t = 0; t < 3; t++) {
        var pi = poolItems(pools[t], stt.ret), list = [];
        if (pi.few && od.p[t] > 0) few = true; // a tier that can come but has no records, or an item with no range for this result
        for (i = 0; i < pi.list.length; i++) list.push([pi.list[i][0], od.p[t] * pi.list[i][1] * pi.list[i][2]]);
        tiers.push({ p: od.p[t], list: list });
      }
    } else { // the community average: tier odds are the pools' shares of the sector's rolls, q = Total / Amount
      second = n > 0 ? sec.favor[1] / n : 0;
      for (t = 0; t < 3; t++) {
        var pr = pools[t].band[0] + pools[t].band[1] + pools[t].band[2], l2 = [];
        for (i = 0; i < pools[t].items.length; i++) {
          var r = pools[t].items[i];
          l2.push([r[0], (pr / n) * (r[1] / pr) * (r[2] / r[1])]);
        }
        tiers.push({ p: n > 0 ? pr / n : 0, list: l2 });
      }
    }
    // A7: the second item is drawn like the first, so every quantity is multiplied by 1 + second.
    var f = 1 + second;
    tiers.forEach(function (T) { if (T.p > 0) T.list.forEach(function (e) { addTo(items, e[0], e[1] * f); }); }); // a tier that cannot come adds no item
    return { n: n, rolls: rolls, have: have, second: second, factor: f, tiers: tiers, items: items, state: stt, few: few };
  }

  function stateKey(s) { return s ? s.band + '' + s.ret + (s.favor ? 'y' : 'n') : 'avg'; }

  // One sector: { gil, items, n, rolls, second, tiers, state, few }.
  //  gil    expected merchant gil (or of whatever `price` gives) of one survey, second item included
  //  items  { id: expected quantity of the survey, second item included } (shared with the cache: read only)
  //  n      the sector's records; rolls the records of the band used (0 when the all-sector counts stood in, or no build)
//  have   the sector's own records the figure rests on: the build's band, even when too thin and the all-sector counts stood in
//         (the true count, possibly 0); without a build, the sector's records
  //  second chance of a second item (0 when favor is short); tiers [{ p, gil }] gil per roll of that tier, first item only
  //  state  as X.state, null for the community average; few  a thin band or a missing range stood in
  X.sector = function (data, sectorId, st, price) {
    price = price || X.merchant(data);
    var stt = X.state(data, sectorId, st), c = store(data), bySector = c[sectorId] || (c[sectorId] = {}), key = stateKey(stt);
    var k = bySector[key] || (bySector[key] = compile(data, sectorId, stt));
    if (!k) return null;
    var gil = 0, tiers = [], t, i, pv;
    for (t = 0; t < 3; t++) {
      var T = k.tiers[t], g = 0;
      for (i = 0; i < T.list.length; i++) { pv = price(T.list[i][0]); if (pv > 0) g += T.list[i][1] * pv; }
      // per roll of this tier: the list holds odds x quantity already, so divide the tier's own odds back out
      tiers.push({ p: T.p, gil: T.p > 0 ? g / T.p : 0 });
      gil += g;
    }
    return { gil: gil * k.factor, items: k.items, n: k.n, rolls: k.rolls, have: k.have, second: k.second, tiers: tiers, state: k.state, few: k.few };
  };

  // A route: the sum of its sectors, each judged against its own thresholds (A8). null for an empty route or an unknown sector.
  X.route = function (data, route, st, price) {
    price = price || X.merchant(data);
    if (!route || !route.length) return null;
    var gil = 0, items = {}, n = Infinity, count = Infinity, viaSecond = 0, few = false, sectors = [];
    for (var i = 0; i < route.length; i++) {
      var s = X.sector(data, route[i], st, price);
      if (!s) return null;
      gil += s.gil; if (s.n < n) n = s.n; if (s.have < count) count = s.have; if (s.few) few = true; sectors.push(s);
      viaSecond += s.gil * s.second / (1 + s.second);
      for (var id in s.items) items[id] = (items[id] || 0) + s.items[id];
    }
    // count: the smallest number of records any sector of the route rests on (including a sector that fell back to pooled counts);
    // secondShare: the part of the gil figure that is the assumed second item (A7), 0 to 1
    return { gil: gil, items: items, n: n, count: count, secondShare: gil > 0 ? viaSecond / gil : 0, few: few, sectors: sectors };
  };

  // Per hour: gil over seconds / 3600, seconds from ADVISOR.evalRoute(...).seconds. null when seconds is not above zero.
  X.perHour = function (gil, seconds) { return seconds > 0 ? gil / (seconds / 3600) : null; };

  // Rounding of spec 5.4.
  function sig2(x) { return isFinite(x) ? String(Number(x.toPrecision(2))) : ''; }
  function group(n) { return Math.round(n).toLocaleString('en'); }
  X.fmt = {
    // a voyage to the nearest 100, an hour to the nearest 10; any figure under 10 is "under 10", never "about 0"
    voyage: function (g) { return Math.abs(g) < 10 ? 'under 10' : group(Math.round(g / 100) * 100); },
    hour: function (g) { return Math.abs(g) < 10 ? 'under 10' : group(Math.round(g / 10) * 10); },
    // "about 5,700", but "under 10" stands alone
    about: function (text) { return text === 'under 10' ? text : 'about ' + text; },
    qty: function (q) { return sig2(q); },                                  // two significant digits
    pct: function (p) { var v = p * 100; return (Math.abs(v) < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v))) + '%'; },
    count: function (n) { return n < 1e6 ? group(n) : (Math.round(n / 1e5) / 10).toFixed(1) + ' million'; }
  };
})();
