// Eveniunt Command Center, Submersibles: what came back, and what it is worth (step S5, design 3.3 and 3.5).
// - The possible loot of a route (Teamcraft's voyage sources, community data), and what was logged before.
// - The value of an item: the better of what a merchant pays (game data, Item.PriceLow) and the market price after the
//   market tax (Universalis, community reports, labelled with where and when the price was seen; design 5.6, rule 12).
//   Prices are read live and cached on this device, never stored in the save.
// - Totals per day, week, month and all time; per free company, per route and per item; gil per hour per route from
//   the owner's own log, with how many trips it rests on; a CSV export.
// Plain script: attaches to globalThis.EARN, so the sums run in Node tests too.
(function () {
  'use strict';
  var E = (globalThis.EARN = globalThis.EARN || {});
  var D = null;
  E.TAX = 0.05; // design Q4 default: the Market module's rule once it exists
  E.init = function (data) { D = data; return E; };
  E.name = function (id) { return (D && D.items[id]) || 'Item ' + id; };
  E.merchant = function (id) { var x = D && D.itemInfo && D.itemInfo[id]; return x ? x[0] : null; };
  E.tradable = function (id) { var x = D && D.itemInfo && D.itemInfo[id]; return x ? x[1] === 1 : true; };

  // The items the route's sectors can drop, by sector (in route order), each item once.
  E.routeLoot = function (route) {
    var seen = {}, out = [];
    (route || []).forEach(function (sid) {
      var list = ((D && D.loot[sid]) || []).filter(function (it) { if (seen[it]) return false; seen[it] = 1; return true; });
      out.push({ sector: sid, items: list });
    });
    return out;
  };
  // How often each item was logged before on this route (to list the usual ones first), and the last trip's items.
  E.history = function (trips, route) {
    var key = (route || []).join(','), count = {}, last = null;
    Object.keys(trips || {}).forEach(function (k) {
      var t = trips[k];
      if ((t.r || []).join(',') !== key || !t.items || !t.items.length) return;
      t.items.forEach(function (x) { count[x[0]] = (count[x[0]] || 0) + 1; });
      if (!last || t.t > last.t) last = t;
    });
    return { count: count, last: last ? last.items.map(function (x) { return x.slice(); }) : null };
  };

  // value of one item: { each, how: 'merchant' | 'market' | null }; prices = { <itemId>: average sale price }
  E.unitValue = function (id, prices) {
    var m = E.merchant(id) || 0, p = prices && prices[id], mk = E.tradable(id) && p ? Math.floor(p * (1 - E.TAX)) : 0;
    if (!m && !mk) return { each: null, how: null };
    return mk > m ? { each: mk, how: 'market' } : { each: m, how: 'merchant' };
  };
  // value of a trip: { gil, known, unknown: [itemIds without any price] }
  E.tripValue = function (trip, prices) {
    var gil = 0, unknown = [];
    (trip.items || []).forEach(function (x) { var v = E.unitValue(x[0], prices); if (v.each == null) unknown.push(x[0]); else gil += v.each * x[1]; });
    return { gil: gil, unknown: unknown, logged: !!(trip.items && trip.items.length) };
  };
  function startOf(kind, now) {
    var d = new Date(now);
    if (kind === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (kind === 'week') { var w = new Date(d.getFullYear(), d.getMonth(), d.getDate()); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); return w.getTime(); } // Monday
    if (kind === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return 0;
  }
  // Totals of the logged trips (a trip counts on the day it came back).
  E.totals = function (sec, prices, now) {
    var out = { day: 0, week: 0, month: 0, all: 0, trips: 0, logged: 0, unknown: {}, byFc: {}, byRoute: {}, byItem: {} };
    var lim = { day: startOf('day', now), week: startOf('week', now), month: startOf('month', now) };
    Object.keys(sec.trips || {}).forEach(function (k) {
      var t = sec.trips[k], v = E.tripValue(t, prices), when = t.back || t.t, sub = (sec.subs || {})[t.s], fcId = sub ? sub.fcId : '';
      out.trips++;
      if (!v.logged) return;
      out.logged++;
      v.unknown.forEach(function (id) { out.unknown[id] = 1; });
      out.all += v.gil;
      ['day', 'week', 'month'].forEach(function (p) { if (when >= lim[p]) out[p] += v.gil; });
      out.byFc[fcId] = (out.byFc[fcId] || 0) + v.gil;
      var rk = (t.r || []).join(',');
      if (rk && t.back && t.t && t.back > t.t) {
        var r = out.byRoute[rk] = out.byRoute[rk] || { route: t.r.slice(), gil: 0, hours: 0, trips: 0 };
        r.gil += v.gil; r.hours += (t.back - t.t) / 3600000; r.trips++;
      }
      (t.items || []).forEach(function (x) { var u = E.unitValue(x[0], prices), b = out.byItem[x[0]] = out.byItem[x[0]] || { qty: 0, gil: 0, how: u.how }; b.qty += x[1]; b.gil += (u.each || 0) * x[1]; });
    });
    Object.keys(out.byRoute).forEach(function (k) { var r = out.byRoute[k]; r.perHour = r.hours ? r.gil / r.hours : 0; });
    return out;
  };

  // The log as CSV: one line per item of every trip (a trip with nothing logged gets one line with no item).
  E.csv = function (sec, prices, fmtRoute) {
    var q = function (v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var lines = [['sent', 'back', 'free company', 'submarine', 'route', 'item', 'quantity', 'value each (gil)', 'priced by', 'rank after'].join(',')];
    Object.keys(sec.trips || {}).map(function (k) { return sec.trips[k]; }).sort(function (a, b) { return a.t - b.t; }).forEach(function (t) {
      var sub = (sec.subs || {})[t.s] || {}, fc = (sec.fcs || {})[sub.fcId] || {};
      var base = [new Date(t.t).toISOString(), t.back ? new Date(t.back).toISOString() : '', fc.name || '', sub.name || t.s, fmtRoute ? fmtRoute(t.r) : (t.r || []).join(' ')];
      if (!t.items || !t.items.length) { lines.push(base.concat(['', '', '', '', t.rankAfter || '']).map(q).join(',')); return; }
      t.items.forEach(function (x) { var u = E.unitValue(x[0], prices); lines.push(base.concat([E.name(x[0]), x[1], u.each == null ? '' : u.each, u.how || 'unknown', t.rankAfter || '']).map(q).join(',')); });
    });
    return lines.join('\r\n') + '\r\n';
  };

  // ------------------------------------------------------------------ archive (design: offered at 75% of the size limit)
  // The voyages that came back before a moment, as a file that can be loaded back; nothing leaves the save unless the
  // owner confirms after the file is downloaded.
  E.ARCHIVE_KIND = 'eveniunt-submersibles-archive';
  E.archive = function (sec, before) {
    var out = {};
    Object.keys(sec.trips || {}).forEach(function (k) { var t = sec.trips[k]; if ((t.back || t.t) < before) out[k] = t; });
    return { kind: E.ARCHIVE_KIND, version: 1, before: before, made: Date.now(), fcs: sec.fcs || {}, subs: sec.subs || {}, trips: out, count: Object.keys(out).length };
  };
  // Load an archive file back: adds the voyages the save does not have (by id); returns how many were added.
  E.restore = function (sec, file) {
    if (!file || file.kind !== E.ARCHIVE_KIND || !file.trips || typeof file.trips !== 'object') throw new Error('This is not a Submersibles archive file.');
    var n = 0; sec.trips = sec.trips || {};
    Object.keys(file.trips).forEach(function (k) { if (!sec.trips[k]) { sec.trips[k] = file.trips[k]; n++; } });
    return n;
  };

  // ------------------------------------------------------------------ Universalis (browser only)
  // Average recent sale price per item for a world, data centre or region; cached on this device for an hour.
  var CACHE_KEY = 'eveniunt-subs-prices';
  E.cached = function (scope) { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && c.scope === scope ? c : null; } catch (e) { return null; } };
  E.fetchPrices = function (scope, ids) {
    var c = E.cached(scope) || { scope: scope, at: 0, prices: {} };
    var want = ids.filter(function (id) { return E.tradable(id); });
    var missing = want.filter(function (id) { return !(id in c.prices); });
    if (!missing.length && Date.now() - c.at < 3600000) return Promise.resolve(c);
    var list = Date.now() - c.at < 3600000 ? missing : want, batches = [];
    for (var i = 0; i < list.length; i += 100) batches.push(list.slice(i, i + 100));
    return Promise.all(batches.map(function (b) {
      return fetch('https://universalis.app/api/v2/' + encodeURIComponent(scope) + '/' + b.join(',') + '?listings=0&entries=20').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    })).then(function (res) {
      res.forEach(function (j, n) {
        if (!j) return;
        var items = j.items || (batches[n].length === 1 ? { [batches[n][0]]: j } : {});
        Object.keys(items).forEach(function (id) { var x = items[id]; var p = x && (x.averagePrice || x.currentAveragePrice); c.prices[id] = p ? Math.round(p) : 0; });
      });
      c.at = Date.now();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* private window */ }
      return c;
    });
  };
})();
