// Eveniunt Command Center: the shared price service (Universalis market prices, cached on this device, never in the save).
// PRICE.create({ cacheKey, triedKey, query, read, tradable }) returns one service: the cache, the 15-minute gate on automatic
// attempts, the freshness rules, and the fetch. Each module creates its own, so two services never touch each other's records.
//   cacheKey / triedKey: the two device-storage keys of this service.
//   query: the query text of the fetch, with its leading "?".
//   read(x): the value to store for one item of a reply, or null for "this reply holds no usable price" (recorded as the
//            item left out of a reply, never as 0).
//   tradable(id): may a price be asked for this item?
// The rules and limits moved unchanged from submersibles/earn.js; only the reply-field read and the query text are parameters.
// Plain script: attaches to globalThis.PRICE, so the rules run in Node tests too.
(function () {
  'use strict';
  var P = (globalThis.PRICE = globalThis.PRICE || {});
  P.create = function (cfg) {
    var S = {}, CACHE_KEY = cfg.cacheKey, TRIED_KEY = cfg.triedKey, QUERY = cfg.query, read = cfg.read, tradable = cfg.tradable;
    S.cached = function (scope) { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && c.scope === scope ? c : null; } catch (e) { return null; } };
    // The rules of an automatic attempt and of what a reply means are pure functions, so the tests can run them without a browser.
    S.GATE_MS = 15 * 60000; // no automatic attempt for this long after the last one, whatever its outcome (Refresh ignores it)
    S.FRESH_MS = 3600000; // a fetched price list is fresh for an hour
    S.NONE_MS = 3600000; // an item the service has no price for is not asked for again for an hour
    S.SKEW_MS = 60000; // a stored time this far ahead of the clock means the clock was moved back: the record is treated as expired
    // Has a stored time run out? age = now - stored time. Expired at the limit, and also when the time is in the future by more than a minute.
    S.aged = function (at, now, limit) { var age = now - at; return age >= limit || age < -S.SKEW_MS; };
    // The attempt record of each price place is also kept in device storage next to the price cache (not in the save), so a reload and
    // another tab on the same device honour the same 15 minutes. A storage failure falls back to the page's memory.
    S.triedLoad = function (mem) {
      var out = Object.assign({}, mem || {});
      try {
        var o = JSON.parse(localStorage.getItem(TRIED_KEY) || 'null');
        if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { var a = o[k] && +o[k].at; if (a > 0 && a - Date.now() <= S.SKEW_MS && (!out[k] || a > out[k].at)) out[k] = { at: a }; });
      } catch (e) { /* memory only */ }
      return out;
    };
    S.triedSave = function (scope, at, mem) {
      if (mem) mem[scope] = { at: at };
      try { var o = JSON.parse(localStorage.getItem(TRIED_KEY) || 'null'); if (!o || typeof o !== 'object') o = {}; o[scope] = { at: at }; localStorage.setItem(TRIED_KEY, JSON.stringify(o)); } catch (e) { /* memory only */ }
    };
    // May the app try on its own? tried = { <price place>: { at } } (the last automatic attempt of each place), or null.
    S.mayTry = function (tried, scope, now, force) { var t = tried && tried[scope]; return !!force || !t || S.aged(t.at, now, S.GATE_MS); };
    // When a price was fetched: its own time in c.seen, else the time of the whole list (an older cache has no per-item time).
    S.seenAt = function (c, id) { return c && c.seen && c.seen[id] != null ? c.seen[id] : c ? c.at : 0; };
    // The oldest fetch time among the given items that have a price in the cache, or null: "prices seen" never claims more than is true.
    S.oldest = function (c, ids) {
      var t = null;
      if (c && c.prices) (ids || []).forEach(function (id) { if (id in c.prices) { var s = S.seenAt(c, id); if (s && (t === null || s < t)) t = s; } });
      return t;
    };
    // The tradable items a fetch would still ask for: those with no price or a price fetched an hour ago or more (judged per item), unless
    // the service was already found to have no price for them less than an hour ago.
    S.needed = function (c, ids, now) {
      var want = ids.filter(function (id) { return tradable(id); });
      if (!c) return want;
      var none = c.none || {}, prices = c.prices || {};
      return want.filter(function (id) { return !(none[id] != null && !S.aged(none[id], now, S.NONE_MS)) && (!(id in prices) || S.aged(S.seenAt(c, id), now, S.FRESH_MS)); });
    };
    // Folds the replies of the batches into the cache. results[n] is { ok: true, json } or { ok: false, status } for batches[n].
    // An item left out of an answered reply, or answered 404 on its own, or whose read returns null, is recorded in c.none as "no market
    // price"; any other failed batch counts as failed. Each answered item gets its own fetch time in c.seen; an item of a failed batch keeps
    // its old price and its old time (an older cache without c.seen is first given every item's time as the list's time), so it is asked for again.
    // c.at is the time of the last answered fetch. When every batch failed, nothing changes. Returns { cache, failed, answered, partial, error }.
    S.settle = function (c, batches, results, now) {
      var next = { scope: c.scope, at: c.at, prices: Object.assign({}, c.prices), none: Object.assign({}, c.none || {}), seen: {} }, failed = 0, status = 0;
      Object.keys(c.prices).forEach(function (id) { next.seen[id] = S.seenAt(c, id); });
      results.forEach(function (res, n) {
        var b = batches[n];
        if (res && res.ok) {
          var j = res.json || {}, items = j.items || (b.length === 1 ? { [b[0]]: j } : {});
          b.forEach(function (id) {
            var x = items[id];
            if (x == null) { next.none[id] = now; return; }
            var p = read(x);
            if (p == null) { next.none[id] = now; return; }
            next.prices[id] = p; next.seen[id] = now; delete next.none[id];
          });
        } else if (res && res.status === 404 && b.length === 1) next.none[b[0]] = now;
        else { failed++; status = (res && res.status) || status; }
      });
      var answered = batches.length - failed;
      if (answered > 0) next.at = now;
      return { cache: next, failed: failed, answered: answered, partial: failed > 0 && answered > 0, error: batches.length && !answered ? (status ? 'the price service answered ' + status : 'no connection') : null };
    };
    // Resolves { scope, at, prices, none, seen, error, partial }: error is set when every batch failed (the cache is then not stamped as fresh); partial when only some did.
    // force asks for every tradable item again, and forgets the "no market price" records.
    S.fetchPrices = function (scope, ids, force) {
      var c = S.cached(scope) || { scope: scope, at: 0, prices: {}, none: {} }, now = Date.now();
      var list = force ? ids.filter(function (id) { return tradable(id); }) : S.needed(c, ids, now);
      if (!list.length) return Promise.resolve(Object.assign({ error: null, partial: false }, c));
      var batches = [];
      for (var i = 0; i < list.length; i += 100) batches.push(list.slice(i, i + 100));
      return Promise.all(batches.map(function (b) {
        return fetch('https://universalis.app/api/v2/' + encodeURIComponent(scope) + '/' + b.join(',') + QUERY)
          .then(function (r) { return r.ok ? r.json().then(function (j) { return { ok: true, json: j }; }) : { ok: false, status: r.status }; })
          .catch(function () { return { ok: false, status: 0 }; });
      })).then(function (res) {
        var s = S.settle(c, batches, res, Date.now());
        if (s.answered > 0) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s.cache)); } catch (e) { /* private window */ } }
        return Object.assign({ error: s.error, partial: s.partial }, s.cache);
      });
    };
    return S;
  };
})();
