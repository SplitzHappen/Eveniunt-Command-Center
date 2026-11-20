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
  E.ENOUGH = 10; // logged voyages on exactly one route (same sectors, same order) before its figure is ranked
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
    var out = { day: 0, week: 0, month: 0, all: 0, trips: 0, logged: 0, unknown: {}, byFc: {}, bySub: {}, byRoute: {}, byItem: {} };
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
      var bs = out.bySub[t.s] = out.bySub[t.s] || { gil: 0, trips: 0 }; bs.gil += v.gil; bs.trips++; // G10: the same total per submarine (a removed submarine keeps its voyages)
      var rk = (t.r || []).join(',');
      if (rk && t.back && t.t && t.back > t.t) {
        var r = out.byRoute[rk] = out.byRoute[rk] || { route: t.r.slice(), gil: 0, hours: 0, trips: 0 };
        r.gil += v.gil; r.hours += (t.back - t.t) / 3600000; r.trips++;
      }
      (t.items || []).forEach(function (x) { var u = E.unitValue(x[0], prices), b = out.byItem[x[0]] = out.byItem[x[0]] || { qty: 0, gil: 0, how: u.how }; b.qty += x[1]; b.gil += (u.each || 0) * x[1]; });
    });
    Object.keys(out.byRoute).forEach(function (k) { var r = out.byRoute[k]; r.perHour = r.hours ? r.gil / r.hours : 0; r.perTrip = r.trips ? r.gil / r.trips : 0; r.enough = r.trips >= E.ENOUGH; });
    return out;
  };
  // Ranks the routes of totals().byRoute: { ranked: [entry + pos], thin: [entry] }. Ranked: enough voyages, best gil per
  // hour first; routes whose gil per hour rounds to the same whole gil share a position (1, 1, 3), inside a tie more
  // voyages first, then the route text. Thin: by voyage count, highest first, then gil per hour.
  E.ranked = function (byRoute) {
    var all = Object.keys(byRoute || {}).map(function (k) { return { key: k, e: byRoute[k] }; });
    var by = function (o) { return o.e; };
    var txt = function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; };
    var good = all.filter(function (o) { return o.e.enough; }).sort(function (a, b) {
      return (Math.round(b.e.perHour) - Math.round(a.e.perHour)) || (b.e.trips - a.e.trips) || txt(a, b);
    });
    var ranked = good.map(function (o, i) {
      var pos = i > 0 && Math.round(good[i - 1].e.perHour) === Math.round(o.e.perHour) ? null : i + 1;
      o.pos = pos; return o;
    });
    ranked.forEach(function (o, i) { if (o.pos === null) o.pos = ranked[i - 1].pos; });
    var thin = all.filter(function (o) { return !o.e.enough; }).sort(function (a, b) {
      return (b.e.trips - a.e.trips) || (b.e.perHour - a.e.perHour) || txt(a, b);
    });
    return {
      ranked: ranked.map(function (o) { var x = Object.assign({}, o.e); x.pos = o.pos; return x; }),
      thin: thin.map(by)
    };
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
  // The rules of an automatic attempt and of what a reply means are pure functions, so the tests can run them without a browser.
  E.GATE_MS = 15 * 60000; // no automatic attempt for this long after the last one, whatever its outcome (Refresh ignores it)
  E.FRESH_MS = 3600000; // a fetched price list is fresh for an hour
  E.NONE_MS = 3600000; // an item the service has no price for is not asked for again for an hour
  E.SKEW_MS = 60000; // a stored time this far ahead of the clock means the clock was moved back: the record is treated as expired
  // Has a stored time run out? age = now - stored time. Expired at the limit, and also when the time is in the future by more than a minute.
  E.aged = function (at, now, limit) { var age = now - at; return age >= limit || age < -E.SKEW_MS; };
  // May the app try on its own? tried = { <price place>: { at } } (the last automatic attempt of each place), or null.
  // E2: the attempt record of each price place is also kept in device storage next to the price cache (not in the save), so a reload and
  // another tab on the same device honour the same 15 minutes. A storage failure falls back to the page's memory.
  var TRIED_KEY = 'eveniunt-subs-prices-tried';
  E.triedLoad = function (mem) {
    var out = Object.assign({}, mem || {});
    try {
      var o = JSON.parse(localStorage.getItem(TRIED_KEY) || 'null');
      if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { var a = o[k] && +o[k].at; if (a > 0 && a - Date.now() <= E.SKEW_MS && (!out[k] || a > out[k].at)) out[k] = { at: a }; });
    } catch (e) { /* memory only */ }
    return out;
  };
  E.triedSave = function (scope, at, mem) {
    if (mem) mem[scope] = { at: at };
    try { var o = JSON.parse(localStorage.getItem(TRIED_KEY) || 'null'); if (!o || typeof o !== 'object') o = {}; o[scope] = { at: at }; localStorage.setItem(TRIED_KEY, JSON.stringify(o)); } catch (e) { /* memory only */ }
  };
  E.mayTry = function (tried, scope, now, force) { var t = tried && tried[scope]; return !!force || !t || E.aged(t.at, now, E.GATE_MS); };
  // When a price was fetched: its own time in c.seen, else the time of the whole list (an older cache has no per-item time).
  E.seenAt = function (c, id) { return c && c.seen && c.seen[id] != null ? c.seen[id] : c ? c.at : 0; };
  // The oldest fetch time among the given items that have a price in the cache, or null: "prices seen" never claims more than is true.
  E.oldest = function (c, ids) {
    var t = null;
    if (c && c.prices) (ids || []).forEach(function (id) { if (id in c.prices) { var s = E.seenAt(c, id); if (s && (t === null || s < t)) t = s; } });
    return t;
  };
  // The tradable items a fetch would still ask for: those with no price or a price fetched an hour ago or more (judged per item), unless
  // the service was already found to have no price for them less than an hour ago.
  E.needed = function (c, ids, now) {
    var want = ids.filter(function (id) { return E.tradable(id); });
    if (!c) return want;
    var none = c.none || {}, prices = c.prices || {};
    return want.filter(function (id) { return !(none[id] != null && !E.aged(none[id], now, E.NONE_MS)) && (!(id in prices) || E.aged(E.seenAt(c, id), now, E.FRESH_MS)); });
  };
  // Folds the replies of the batches into the cache. results[n] is { ok: true, json } or { ok: false, status } for batches[n].
  // An item left out of an answered reply, or answered 404 on its own, is recorded in c.none as "no market price"; any other
  // failed batch counts as failed. Each answered item gets its own fetch time in c.seen; an item of a failed batch keeps its old price
  // and its old time (an older cache without c.seen is first given every item's time as the list's time), so it is asked for again.
  // c.at is the time of the last answered fetch. When every batch failed, nothing changes. Returns { cache, failed, answered, partial, error }.
  E.settle = function (c, batches, results, now) {
    var next = { scope: c.scope, at: c.at, prices: Object.assign({}, c.prices), none: Object.assign({}, c.none || {}), seen: {} }, failed = 0, status = 0;
    Object.keys(c.prices).forEach(function (id) { next.seen[id] = E.seenAt(c, id); });
    results.forEach(function (res, n) {
      var b = batches[n];
      if (res && res.ok) {
        var j = res.json || {}, items = j.items || (b.length === 1 ? { [b[0]]: j } : {});
        b.forEach(function (id) {
          var x = items[id];
          if (x == null) { next.none[id] = now; return; }
          var p = x.averagePrice || x.currentAveragePrice; next.prices[id] = p ? Math.round(p) : 0; next.seen[id] = now; delete next.none[id];
        });
      } else if (res && res.status === 404 && b.length === 1) next.none[b[0]] = now;
      else { failed++; status = (res && res.status) || status; }
    });
    var answered = batches.length - failed;
    if (answered > 0) next.at = now;
    return { cache: next, failed: failed, answered: answered, partial: failed > 0 && answered > 0, error: batches.length && !answered ? (status ? 'the price service answered ' + status : 'no connection') : null };
  };
  // The message for a failed fetch, with the time of the last real one when there is one (fmt = the module's clock).
  E.PARTIAL_NOTE = 'Some market prices could not be fetched; those items show their last known or merchant price.';
  // c = the cache the values are drawn from ({ prices, at, seen }), ids = the items on screen. The message is decided by the prices
  // actually used for those items (an item whose value is the market price, as E.unitValue decides), not by a flag: the oldest such fetch time is named.
  E.usedMarket = function (c, ids) {
    var t = null;
    if (c && c.prices) (ids || []).forEach(function (id) { if (E.unitValue(id, c.prices).how === 'market') { var s = E.seenAt(c, id); if (t === null || s < t) t = s; } });
    return t;
  };
  E.failureNote = function (c, ids, fmt) {
    var t = E.usedMarket(c, ids);
    return t === null ? 'Market prices could not be fetched; showing merchant prices.'
      : 'Market prices could not be fetched; showing the last known market prices' + (t ? ' (fetched ' + fmt(t) + ')' : '') + ' and merchant prices for the rest.';
  };
  // Resolves { scope, at, prices, none, seen, error, partial }: error is set when every batch failed (the cache is then not stamped as fresh); partial when only some did.
  // force asks for every tradable item again, and forgets the "no market price" records.
  E.fetchPrices = function (scope, ids, force) {
    var c = E.cached(scope) || { scope: scope, at: 0, prices: {}, none: {} }, now = Date.now();
    var list = force ? ids.filter(function (id) { return E.tradable(id); }) : E.needed(c, ids, now);
    if (!list.length) return Promise.resolve(Object.assign({ error: null, partial: false }, c));
    var batches = [];
    for (var i = 0; i < list.length; i += 100) batches.push(list.slice(i, i + 100));
    return Promise.all(batches.map(function (b) {
      return fetch('https://universalis.app/api/v2/' + encodeURIComponent(scope) + '/' + b.join(',') + '?listings=0&entries=20')
        .then(function (r) { return r.ok ? r.json().then(function (j) { return { ok: true, json: j }; }) : { ok: false, status: r.status }; })
        .catch(function () { return { ok: false, status: 0 }; });
    })).then(function (res) {
      var s = E.settle(c, batches, res, Date.now());
      if (s.answered > 0) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s.cache)); } catch (e) { /* private window */ } }
      return Object.assign({ error: s.error, partial: s.partial }, s.cache);
    });
  };
})();
