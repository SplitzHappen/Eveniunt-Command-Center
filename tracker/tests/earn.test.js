'use strict';
// Submersibles step S5: what a logged return is worth (command-center/src/submersibles/earn.js) and the merchant-price
// table it reads (data/submarines.json, itemInfo). Run: node --test tests/earn.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'earn.js'));
const E = globalThis.EARN.init(D);
const H = 3600000;

test('itemInfo: one merchant price and market flag for every item the data names', () => {
  assert.deepEqual(Object.keys(D.itemInfo).sort(), Object.keys(D.items).sort());
  for (const [id, v] of Object.entries(D.itemInfo)) {
    assert.ok(Number.isInteger(v[0]) && v[0] >= 0, id);
    assert.ok(v[1] === 0 || v[1] === 1, id);
  }
  assert.ok(Object.values(D.loot).flat().every((id) => String(id) in D.itemInfo));
  assert.equal(D.tables.itemInfo.source, 'game');
});

test('unit value: the better of merchant and market after the 5% tax; untradable items never take a market price', () => {
  assert.deepEqual(E.unitValue(10099, {}), { each: 10, how: 'merchant' });            // Unaspected Crystal, merchant 10
  assert.deepEqual(E.unitValue(10099, { 10099: 9 }), { each: 10, how: 'merchant' });   // 9 less 5% = 8 < 10
  assert.deepEqual(E.unitValue(10099, { 10099: 1000 }), { each: 950, how: 'market' });
  assert.deepEqual(E.unitValue(10099, { 10099: 1001 }), { each: 950, how: 'market' }); // rounded down
  assert.deepEqual(E.unitValue(5, {}), { each: null, how: null });                     // no merchant price, no market price
  assert.equal(E.tradable(37487), false);                                             // False Classic Spectacles: merchant 1,000, not on the market
  assert.deepEqual(E.unitValue(37487, { 37487: 50000 }), { each: 1000, how: 'merchant' });
});

test('route loot: by sector in route order, each item once; history counts and the last trip', () => {
  const g = E.routeLoot([1, 2]);
  assert.deepEqual(g.map((x) => x.sector), [1, 2]);
  assert.deepEqual(g[0].items, D.loot['1']);
  const both = g[0].items.concat(g[1].items);
  assert.equal(new Set(both).size, both.length);
  const trips = { a: { r: [1, 2], t: 1, items: [[10099, 2]] }, b: { r: [1, 2], t: 5, items: [[10099, 1], [5, 3]] }, c: { r: [2], t: 9, items: [[7, 1]] } };
  const h = E.history(trips, [1, 2]);
  assert.deepEqual(h.count, { 10099: 2, 5: 1 });
  assert.deepEqual(h.last, [[10099, 1], [5, 3]]);
  assert.equal(E.history(trips, [3]).last, null);
});

test('totals: day, week, month and all time; per free company, route (gil per hour, trips) and item', () => {
  const now = new Date(2026, 10, 12, 15, 0).getTime(); // Thursday 12 November 2026, 15:00 local
  const sec = {
    fcs: { fa: { name: 'Alpha' }, fb: { name: 'Bravo' } },
    subs: { a1: { fcId: 'fa', name: 'A1' }, b1: { fcId: 'fb', name: 'B1, the second' } },
    trips: {
      t1: { s: 'a1', t: now - 13 * H, r: [1, 2], back: now - H, items: [[10099, 10]] },                         // today: 10 x 950
      t2: { s: 'a1', t: new Date(2026, 10, 9, 1).getTime(), r: [1, 2], back: new Date(2026, 10, 9, 13).getTime(), items: [[10099, 2]] }, // Monday
      t3: { s: 'b1', t: new Date(2026, 10, 2).getTime(), r: [3], back: new Date(2026, 10, 2, 6).getTime(), items: [[5, 4]] },        // this month, no price
      t4: { s: 'b1', t: new Date(2026, 9, 1).getTime(), r: [3], back: new Date(2026, 9, 1, 6).getTime(), items: [[10099, 1]] },      // October
      t5: { s: 'a1', t: now - 2 * H, r: [1], back: now - H, items: [] },                                          // nothing logged
    },
  };
  const t = E.totals(sec, { 10099: 1000 }, now);
  assert.equal(t.day, 9500);
  assert.equal(t.week, 11400);
  assert.equal(t.month, 11400);
  assert.equal(t.all, 12350);
  assert.equal(t.trips, 5); assert.equal(t.logged, 4);
  assert.deepEqual(Object.keys(t.unknown), ['5']);
  assert.deepEqual(t.byFc, { fa: 11400, fb: 950 });
  assert.equal(t.byRoute['1,2'].trips, 2);
  assert.equal(t.byRoute['1,2'].perHour, 11400 / 24);
  assert.equal(t.byRoute['1'], undefined); // an unlogged trip adds nothing to a route
  assert.deepEqual(t.byItem[10099], { qty: 13, gil: 12350, how: 'market' });
  const csv = E.csv(sec, { 10099: 1000 }, (r) => r.join('-')).split('\r\n');
  assert.equal(csv[0], 'sent,back,free company,submarine,route,item,quantity,value each (gil),priced by,rank after');
  assert.equal(csv.length, 7); // header, five trips (one line each), final empty line
  assert.ok(csv.some((l) => l.includes('"B1, the second"') && l.includes(',4,,unknown,')));
  assert.ok(csv.some((l) => l.includes('Unaspected Crystal,10,950,market')));
});

test('archive: the voyages back before a moment go to a file that loads back without duplicates', () => {
  const sec = { fcs: { fa: {} }, subs: { a1: { fcId: 'fa' } }, trips: { old: { s: 'a1', t: 10, back: 20, items: [] }, edge: { s: 'a1', t: 50, back: 100, items: [] }, now: { s: 'a1', t: 200, back: 300, items: [] } } };
  const a = E.archive(sec, 100);
  assert.equal(a.kind, 'eveniunt-submersibles-archive');
  assert.deepEqual(Object.keys(a.trips), ['old']);
  assert.equal(a.count, 1);
  const kept = { trips: { now: sec.trips.now } };
  assert.equal(E.restore(kept, JSON.parse(JSON.stringify(a))), 1);
  assert.deepEqual(Object.keys(kept.trips).sort(), ['now', 'old']);
  assert.equal(E.restore(kept, a), 0);
  assert.throws(() => E.restore(kept, { trips: {} }), /not a Submersibles archive/);
});

test('ranking: ten voyages on one route rank it, nine do not; ties share a position; an unlogged trip adds nothing', () => {
  const trip = (r, n, gilItems, hours, at) => ({ s: 'a1', t: at, r, back: at + hours * H, items: gilItems, newSectors: [] });
  const trips = {};
  // routes [1,2] and [3] earn the same per hour (10 gil per crystal, 1 crystal per hour); [5] earns less; [4] has nine voyages
  for (let i = 0; i < 10; i++) trips['x' + i] = trip([1, 2], i, [[10099, 20]], 20, 1000 + i);
  for (let i = 0; i < 12; i++) trips['y' + i] = trip([3], i, [[10099, 10]], 10, 2000 + i);
  for (let i = 0; i < 10; i++) trips['z' + i] = trip([5], i, [[10099, 5]], 10, 3000 + i);
  for (let i = 0; i < 9; i++) trips['w' + i] = trip([4], i, [[10099, 50]], 10, 4000 + i);
  trips.none = { s: 'a1', t: 5000, r: [1, 2], back: 5000 + 20 * H, items: [], newSectors: [] };
  const tot = E.totals({ subs: { a1: { fcId: 'fa' } }, trips }, {}, 9e12);
  assert.equal(tot.byRoute['1,2'].trips, 10);                  // the unlogged trip is not counted
  assert.equal(tot.byRoute['1,2'].perTrip, 200);
  assert.equal(tot.byRoute['4'].enough, false);
  assert.equal(tot.byRoute['1,2'].enough, true);
  assert.equal(E.ENOUGH, 10);
  const r = E.ranked(tot.byRoute);
  assert.deepEqual(r.ranked.map((x) => [x.route.join(), x.pos]), [['3', 1], ['1,2', 1], ['5', 3]]); // tie: more voyages first
  assert.deepEqual(r.thin.map((x) => x.route.join()), ['4']);
  assert.equal(r.thin[0].trips, 9);
});

test('G10: totals per submarine: the same gil as the totals by free company, summed by submarine, removed submarines kept', () => {
  const sec = { fcs: { f: {} }, subs: { a: { fcId: 'f', slot: 1 }, b: { fcId: 'f', slot: 2 } }, trips: {
    t1: { s: 'a', t: 1000, back: 2000, r: [1], items: [[5, 3]] }, t2: { s: 'a', t: 3000, back: 4000, r: [1], items: [[5, 1]] },
    t3: { s: 'b', t: 1000, back: 2000, r: [1], items: [[5, 10]] }, t4: { s: 'gone', t: 1000, back: 2000, r: [1], items: [[5, 2]] }, t5: { s: 'b', t: 5000, back: 6000, r: [1], items: [] } } };
  const tot = E.totals(sec, { 5: 1000 }, 7000), each = E.unitValue(5, { 5: 1000 }).each;
  assert.equal(tot.bySub.a.gil, each * 4); assert.equal(tot.bySub.a.trips, 2); assert.equal(tot.bySub.b.gil, each * 10); assert.equal(tot.bySub.b.trips, 1); assert.equal(tot.bySub.gone.gil, each * 2);
  assert.equal(Object.values(tot.bySub).reduce((n, x) => n + x.gil, 0), tot.all, 'the submarines add up to all time');
  assert.equal(tot.byFc.f, each * 14, 'the free company total is unchanged');
});


// F1: the market-price fetch. The attempt gate, the report of failed batches and the "no market price" record are pure functions.
test('F1 attempt gate: one automatic attempt per price place in 15 minutes whatever the outcome; Refresh always tries', () => {
  const now = 10 * H, tried = { Aether: { at: now - 60000 } }; // one entry per price place (K3.3)
  assert.equal(E.mayTry(null, 'Aether', now, false), true, 'never tried');
  assert.equal(E.mayTry(tried, 'Aether', now, false), false, 'a minute after an attempt');
  assert.equal(E.mayTry(tried, 'Aether', now + E.GATE_MS - 60001, false), false, 'just under 15 minutes');
  assert.equal(E.mayTry(tried, 'Aether', now + E.GATE_MS - 60000, false), true, '15 minutes after');
  assert.equal(E.mayTry(tried, 'Crystal', now, false), true, 'another price place has its own gate');
  assert.equal(E.mayTry(tried, 'Aether', now, true), true, 'Refresh');
  assert.equal(E.GATE_MS, 15 * 60000);
});

test('F1 failed batches: a refused or failing service sets an error and does not stamp the cache fresh; an answered one does', () => {
  const c = { scope: 'Aether', at: 5, prices: { 2: 100 }, none: {} }, now = 9 * H;
  const refused = E.settle(c, [[2, 3]], [{ ok: false, status: 0 }], now);
  assert.equal(refused.failed, 1); assert.equal(refused.answered, 0); assert.equal(refused.error, 'no connection');
  assert.equal(refused.cache.at, 5, 'not stamped as fresh'); assert.deepEqual(refused.cache.prices, { 2: 100 }); assert.deepEqual(refused.cache.none, {});
  const http = E.settle(c, [[2, 3]], [{ ok: false, status: 500 }], now);
  assert.equal(http.error, 'the price service answered 500'); assert.equal(http.cache.at, 5);
  assert.equal(E.settle(c, [[2, 3]], [{ ok: false, status: 404 }], now).error, 'the price service answered 404', 'a 404 for a batch of several items is a failure');
  const good = E.settle(c, [[2, 3]], [{ ok: true, json: { items: { 2: { averagePrice: 200.4 }, 3: { averagePrice: 0 } } } }], now);
  assert.equal(good.error, null); assert.equal(good.cache.at, now); assert.deepEqual(good.cache.prices, { 2: 200, 3: 0 });
  const part = E.settle(c, [[2], [3]], [{ ok: true, json: { averagePrice: 50 } }, { ok: false, status: 0 }], now);
  assert.equal(part.failed, 1); assert.equal(part.error, null, 'one batch answered: no all-failed error'); assert.equal(part.partial, true, 'but the failure is reported as partial'); assert.equal(part.cache.at, now); assert.deepEqual(part.cache.prices, { 2: 50 });
  assert.equal(part.cache.seen[2], now, 'the answered item is stamped fresh'); assert.equal(3 in part.cache.seen, false, 'the item of the failed batch is not');
  assert.equal(E.settle(c, [], [], now).error, null, 'nothing asked, nothing failed');
});

test('E1 the failure message is decided by the prices actually used: an old market price kept -> first sentence and the market value; none -> merchant sentence and value', () => {
  const kept = { prices: { 10099: 1000 }, at: 7, seen: { 10099: 7 } }, ids = [10099];
  const msgA = E.failureNote(kept, ids, (t) => 'T' + t);
  assert.equal(msgA, 'Market prices could not be fetched; showing the last known market prices (fetched T7) and merchant prices for the rest.');
  assert.deepEqual(E.unitValue(10099, kept.prices), { each: 950, how: 'market' }, 'the value really comes from the old market price (merchant is 10)');
  const none = { prices: {}, at: 0 };
  assert.equal(E.failureNote(none, ids, String), 'Market prices could not be fetched; showing merchant prices.');
  assert.deepEqual(E.unitValue(10099, none.prices), { each: 10, how: 'merchant' });
  assert.equal(E.failureNote({ prices: { 10099: 1000 }, at: 7 }, [2], String), 'Market prices could not be fetched; showing merchant prices.', 'a cached price for an item not on screen is not used');
  assert.equal(E.failureNote({ prices: { 37487: 5000 }, at: 7 }, [37487], String), 'Market prices could not be fetched; showing merchant prices.', 'an untradable item never uses a market price');
  assert.equal(E.failureNote({ prices: { 10099: 0 }, at: 7 }, ids, String), 'Market prices could not be fetched; showing merchant prices.', 'a cached 0 is no price');
});

test('G3 the failure message names market prices only when a market price is the one used: the merchant price is higher -> merchant sentence and merchant value', () => {
  const cached = { prices: { 10099: 10 }, at: 7, seen: { 10099: 7 } }, ids = [10099];
  assert.deepEqual(E.unitValue(10099, cached.prices), { each: 10, how: 'merchant' }, 'merchant 10 beats the cached market 10 after tax');
  assert.equal(E.failureNote(cached, ids, (t) => 'T' + t), 'Market prices could not be fetched; showing merchant prices.');
  assert.equal(E.usedMarket(cached, ids), null);
  // the time named is the oldest fetch among the items whose market price is used: item 10099 (merchant value, fetched at 1) does not count
  const two = { prices: { 10099: 10, 2: 100 }, at: 9, seen: { 10099: 1, 2: 3 } }, both = [10099, 2];
  assert.deepEqual(E.unitValue(2, two.prices), { each: 95, how: 'market' });
  assert.equal(E.usedMarket(two, both), 3);
  assert.equal(E.failureNote(two, both, (t) => 'T' + t), 'Market prices could not be fetched; showing the last known market prices (fetched T3) and merchant prices for the rest.');
});

test('E2 the attempt gate is kept in device storage: a reload or another tab honours the same 15 minutes; a storage failure falls back to memory', () => {
  const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const now = Date.now(), mem1 = {};
  E.triedSave('Aether', now, mem1);
  const reloaded = E.triedLoad({}); // a new page (empty memory) on the same device
  assert.equal(E.mayTry(reloaded, 'Aether', now + 60000, false), false, 'a reload a minute later makes no automatic attempt');
  assert.equal(E.mayTry(reloaded, 'Aether', now + E.GATE_MS, false), true, 'after 15 minutes it may');
  assert.equal(E.mayTry(reloaded, 'Aether', now + 60000, true), true, 'Refresh still may');
  assert.equal(E.mayTry(reloaded, 'Crystal', now + 60000, false), true, 'per price place');
  store['eveniunt-subs-prices-tried'] = JSON.stringify({ Aether: { at: now + 5 * 60000 } });
  assert.equal(E.mayTry(E.triedLoad({}), 'Aether', now, false), true, 'a time in the future by more than a minute counts as expired');
  store['eveniunt-subs-prices-tried'] = 'not json';
  assert.equal(E.mayTry(E.triedLoad({ Aether: { at: now } }), 'Aether', now + 1000, false), false, 'a broken record leaves the memory in force');
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const mem2 = {}; E.triedSave('Aether', now, mem2);
  assert.equal(E.mayTry(E.triedLoad(mem2), 'Aether', now + 1000, false), false, 'storage failure: memory holds the gate');
  delete globalThis.localStorage;
});

test('F1 no market price: an item left out of a reply, or answered 404 on its own, is recorded and not asked for again for an hour', () => {
  const c = { scope: 'Aether', at: 0, prices: {}, none: {} }, now = 20 * H;
  const left = E.settle(c, [[2, 3, 4]], [{ ok: true, json: { items: { 2: { averagePrice: 10 }, 3: { averagePrice: 20 } } } }], now);
  assert.deepEqual(left.cache.none, { 4: now }); assert.equal(left.error, null); assert.equal(left.cache.at, now);
  const alone = E.settle(left.cache, [[4]], [{ ok: false, status: 404 }], now + 1);
  assert.deepEqual(alone.cache.none, { 4: now + 1 }); assert.equal(alone.failed, 0); assert.equal(alone.error, null, 'a 404 on its own is not a failure');
  assert.deepEqual(E.needed(left.cache, [2, 3, 4], now + 60000), [], 'the cache is fresh and item 4 is recorded');
  assert.deepEqual(E.needed(left.cache, [2, 3, 4, 5], now + 60000), [5], 'only an item never asked for is needed');
  assert.deepEqual(E.needed(left.cache, [2, 3, 4], now + 3600000 + 1), [2, 3, 4], 'after an hour the list is stale: everything again, the record has run out too');
  assert.deepEqual(E.needed(null, [2, 37487], now), [2], 'untradable items are never asked for');
  const back = E.settle(left.cache, [[4]], [{ ok: true, json: { averagePrice: 9 } }], now + 5);
  assert.deepEqual(back.cache.none, {}); assert.equal(back.cache.prices[4], 9, 'a later price clears the record');
});

// K2: a partly failed fetch is not hidden and does not stamp old prices as fresh; freshness is judged per item.
test('K2 per-item fetch times: an old cache reads every item as fetched at "at"; an item of a failed batch keeps its old price and time and is asked again, the others are not', () => {
  const old = { scope: 'Aether', at: 1 * H, prices: { 2: 100, 3: 200, 5: 300 }, none: {} }; // an old cache: no "seen"
  assert.equal(E.seenAt(old, 2), 1 * H); assert.equal(E.seenAt({ at: 4, seen: { 2: 9 } }, 2), 9); assert.equal(E.seenAt({ at: 4, seen: { 2: 9 } }, 3), 4);
  const now = 2 * H + 1; // the list is older than an hour: every item is stale
  assert.deepEqual(E.needed(old, [2, 3, 5], now), [2, 3, 5]);
  // one batch answered (item 2), one failed (item 3), item 5 was not asked for
  const s = E.settle(old, [[2], [3]], [{ ok: true, json: { averagePrice: 150 } }, { ok: false, status: 500 }], now);
  assert.equal(s.partial, true); assert.equal(s.error, null);
  assert.deepEqual(s.cache.prices, { 2: 150, 3: 200, 5: 300 }, 'the failed item keeps its old price');
  assert.deepEqual(s.cache.seen, { 2: now, 3: 1 * H, 5: 1 * H }, 'the failed item and the one not asked keep the old time; the answered one is fresh');
  assert.equal(s.cache.at, now);
  const next = now + 20 * 60000; // the next allowed attempt, 20 minutes later
  assert.deepEqual(E.needed(s.cache, [2, 3, 5], next), [3, 5], 'the answered item is not asked again; the stale ones are');
  assert.equal(E.oldest(s.cache, [2, 3, 5]), 1 * H, 'the "prices seen" time is the oldest among the items');
  assert.equal(E.oldest(s.cache, [2]), now, 'and the answered one alone is fresh');
  assert.equal(E.oldest(s.cache, [99]), null, 'no price among the items: no claim');
  assert.match(E.PARTIAL_NOTE, /^Some market prices could not be fetched; those items show their last known or merchant price\.$/);
  // every batch answered: all stamped; every batch failed: nothing changes (the old cache is kept as it is)
  const all = E.settle(old, [[2, 3, 5]], [{ ok: true, json: { items: { 2: { averagePrice: 1 }, 3: { averagePrice: 2 }, 5: { averagePrice: 3 } } } }], now);
  assert.equal(all.partial, false); assert.deepEqual(all.cache.seen, { 2: now, 3: now, 5: now });
  const none = E.settle(old, [[2, 3, 5]], [{ ok: false, status: 0 }], now);
  assert.equal(none.partial, false); assert.equal(none.cache.at, 1 * H); assert.deepEqual(none.cache.prices, old.prices);
  assert.deepEqual(E.needed(none.cache, [2, 3, 5], next), [2, 3, 5], 'all of them are asked for again');
});

test('K3.1 clock moved backwards: a stored time more than a minute in the future counts as expired; within a minute it is still fresh', () => {
  const now = 10 * H;
  assert.equal(E.aged(now + 30000, now, E.FRESH_MS), false, 'half a minute ahead: normal clock jitter');
  assert.equal(E.aged(now + 60000, now, E.FRESH_MS), false, 'exactly a minute ahead');
  assert.equal(E.aged(now + 60001, now, E.FRESH_MS), true, 'more than a minute ahead: the clock was moved back');
  assert.equal(E.mayTry({ Aether: { at: now + 5 * 60000 } }, 'Aether', now, false), true, 'an attempt "in the future" does not block the gate');
  assert.equal(E.mayTry({ Aether: { at: now + 30000 } }, 'Aether', now, false), false, 'a few seconds ahead still does');
  const c = { scope: 'Aether', at: now + 3 * H, prices: { 2: 100 }, none: { 3: now + 3 * H } };
  assert.deepEqual(E.needed(c, [2, 3], now), [2, 3], 'a price and a "no market price" record stamped in the future are asked for again');
  const ok = { scope: 'Aether', at: now - 60000, prices: { 2: 100 }, none: { 3: now - 60000 } };
  assert.deepEqual(E.needed(ok, [2, 3], now), [], 'a recent cache is left alone');
});

test('K3.3 the attempt gate keeps one entry per price place', () => {
  const now = 10 * H, tried = {};
  assert.equal(E.mayTry(tried, 'Aether', now, false), true);
  tried.Aether = { at: now }; tried.Crystal = { at: now + 5 * 60000 };
  assert.equal(E.mayTry(tried, 'Aether', now + 6 * 60000, false), false, 'trying Crystal did not erase the Aether attempt');
  assert.equal(E.mayTry(tried, 'Crystal', now + 6 * 60000, false), false);
  assert.equal(E.mayTry(tried, 'Aether', now + E.GATE_MS, false), true, 'each place opens 15 minutes after its own attempt');
  assert.equal(E.mayTry(tried, 'Crystal', now + E.GATE_MS, false), false);
  assert.equal(E.mayTry(tried, 'Primal', now, false), true, 'a place never tried');
});
