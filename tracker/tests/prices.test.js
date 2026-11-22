'use strict';
// The shared price service (command-center/src/prices.js): PR-1 to PR-5 of docs/lists-spec.md, work item W5.
// Run: node --test tests/prices.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'command-center', 'src');
require(path.join(SRC, 'prices.js'));
const PRICE = globalThis.PRICE;
const H = 3600000;
const now = 1700000000000;

const listsRead = (x) => {
  const cheapest = x.minPrice > 0 ? x.minPrice : 0, avg = x.currentAveragePrice > 0 ? Math.round(x.currentAveragePrice) : 0;
  if (!cheapest && !avg && !('minPrice' in x)) return null;
  return [cheapest, avg, x.worldName || null, x.lastUploadTime || null];
};
const make = (over) => PRICE.create(Object.assign({
  cacheKey: 'test-prices', triedKey: 'test-prices-tried', query: '?listings=1&entries=20', read: listsRead, tradable: (id) => id !== 99
}, over));
const memStore = () => { const s = {}; return { s, ls: { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); } } }; };

test('PR-1: two services do not touch each other\'s records', async () => {
  const { s, ls } = memStore(); globalThis.localStorage = ls;
  const a = make({ cacheKey: 'a-prices', triedKey: 'a-tried', read: (x) => x.averagePrice || 0 });
  const b = make({ cacheKey: 'b-prices', triedKey: 'b-tried' });
  a.triedSave('Aether', now, {});
  assert.ok('a-tried' in s && !('b-tried' in s));
  assert.deepEqual(b.triedLoad({}), {}, 'the other service sees no attempt');
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items: { 2: { averagePrice: 5 } } }) });
  await a.fetchPrices('Aether', [2], true);
  assert.ok('a-prices' in s && !('b-prices' in s));
  assert.equal(b.cached('Aether'), null);
  assert.equal(a.cached('Aether').prices[2], 5);
  delete globalThis.localStorage; delete globalThis.fetch;
});

test('PR-2: the limits and the gate, for a second read', () => {
  const S = make();
  assert.equal(S.GATE_MS, 15 * 60000); assert.equal(S.FRESH_MS, H); assert.equal(S.NONE_MS, H); assert.equal(S.SKEW_MS, 60000);
  assert.equal(S.aged(now, now + H - 1, H), false);
  assert.equal(S.aged(now, now + H, H), true);
  assert.equal(S.aged(now + 60000, now, H), false, 'a minute ahead is allowed');
  assert.equal(S.aged(now + 60001, now, H), true, 'more than a minute ahead counts as expired');
  const tried = { Aether: { at: now } };
  assert.equal(S.mayTry(null, 'Aether', now, false), true);
  assert.equal(S.mayTry(tried, 'Aether', now + S.GATE_MS - 1, false), false);
  assert.equal(S.mayTry(tried, 'Aether', now + S.GATE_MS, false), true);
  assert.equal(S.mayTry(tried, 'Aether', now, true), true, 'Refresh');
  assert.equal(S.mayTry(tried, 'Crystal', now, false), true, 'per place');
});

test('PR-3: freshness (needed, seenAt, oldest) for a second read', () => {
  const S = make();
  const c = { scope: 'Aether', at: now, prices: { 2: [10, 9, 'A', 1], 3: [20, 19, 'A', 1] }, none: { 4: now }, seen: { 2: now, 3: now - 2 * H } };
  assert.deepEqual(S.needed(c, [2, 3, 4, 5, 99], now + 60000), [3, 5], 'stale 3 and new 5; 4 is recorded; 99 is not tradable');
  assert.deepEqual(S.needed(c, [4], now + H), [4], 'a "no price" record runs out after an hour');
  assert.deepEqual(S.needed(null, [2, 99], now), [2]);
  assert.equal(S.seenAt(c, 2), now); assert.equal(S.seenAt({ at: 7, prices: {} }, 2), 7); assert.equal(S.seenAt(null, 2), 0);
  assert.equal(S.oldest(c, [2, 3, 4]), now - 2 * H);
  assert.equal(S.oldest(c, [4, 5]), null);
});

test('PR-4: settle for a second read (failures, 404, items left out, partial)', () => {
  const S = make();
  const c = { scope: 'Aether', at: now - 5 * H, prices: { 2: [1, 1, 'A', 1] }, none: {} };
  const ok = { ok: true, json: { items: { 2: { minPrice: 30, currentAveragePrice: 28.6, worldName: 'Zodiark', lastUploadTime: 5 } } } };
  const r = S.settle(c, [[2, 3]], [ok], now);
  assert.deepEqual(r.cache.prices[2], [30, 29, 'Zodiark', 5]);
  assert.equal(r.cache.none[3], now, 'an item left out of the reply is recorded as no price');
  assert.equal(r.cache.seen[2], now); assert.equal(r.cache.at, now); assert.equal(r.error, null);
  const down = S.settle(c, [[2]], [{ ok: false, status: 500 }], now);
  assert.equal(down.error, 'the price service answered 500'); assert.equal(down.cache.at, c.at); assert.deepEqual(down.cache.prices, c.prices);
  assert.equal(S.settle(c, [[2]], [{ ok: false, status: 0 }], now).error, 'no connection');
  assert.equal(S.settle(c, [[2, 3]], [{ ok: false, status: 404 }], now).error, 'the price service answered 404', '404 for several items fails');
  assert.equal(S.settle(c, [[3]], [{ ok: false, status: 404 }], now).cache.none[3], now, '404 for one item is no market data');
  const part = S.settle(c, [[2], [3]], [{ ok: true, json: { minPrice: 7, currentAveragePrice: 0 } }, { ok: false, status: 0 }], now);
  assert.equal(part.partial, true); assert.deepEqual(part.cache.prices[2], [7, 0, null, null]);
  assert.equal(S.settle(c, [], [], now).error, null);
});

test('PR-5: a read that returns null is recorded as no price, never as 0', () => {
  const S = make();
  const c = { scope: 'Aether', at: now - 5 * H, prices: { 2: [1, 1, 'A', 1] }, none: {}, seen: { 2: now - 5 * H } };
  const r = S.settle(c, [[2, 3]], [{ ok: true, json: { items: { 2: {}, 3: { worldName: 'x' } } } }], now);
  assert.equal(r.cache.none[2], now); assert.equal(r.cache.none[3], now);
  assert.deepEqual(r.cache.prices[2], [1, 1, 'A', 1], 'the earlier price is kept, not overwritten by 0');
  assert.equal(r.cache.seen[2], now - 5 * H, 'and keeps its own time');
  assert.ok(!('3' in r.cache.prices));
  assert.deepEqual(S.needed(r.cache, [2, 3], now + 60000), [], 'asked for again only after an hour');
  assert.deepEqual(S.needed(r.cache, [3], now + H), [3]);
});

test('PR-5: the Submersibles read gives byte-identical cache records to today\'s', async () => {
  require(path.join(SRC, 'submersibles', 'earn.js')); // loads ../prices.js itself when PRICE is missing
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submarines.json'), 'utf8'));
  const E = globalThis.EARN.init(D);
  const c = { scope: 'Aether', at: now - H, prices: { 2: 10 }, none: {} };
  // the replies of earn.test.js, and the record the code before the move wrote for them
  const good = E.settle(c, [[2, 3]], [{ ok: true, json: { items: { 2: { averagePrice: 200.4 }, 3: { averagePrice: 0 } } } }], now);
  assert.equal(JSON.stringify(good.cache), '{"scope":"Aether","at":' + now + ',"prices":{"2":200,"3":0},"none":{},"seen":{"2":' + now + ',"3":' + now + '}}');
  const part = E.settle(c, [[2], [3]], [{ ok: true, json: { averagePrice: 50 } }, { ok: false, status: 0 }], now);
  assert.equal(JSON.stringify(part.cache), '{"scope":"Aether","at":' + now + ',"prices":{"2":50},"none":{},"seen":{"2":' + now + '}}');
  const cur = E.settle(c, [[2]], [{ ok: true, json: { currentAveragePrice: 7.5 } }], now);
  assert.equal(cur.cache.prices[2], 8, 'the current average is the fallback field');
  const left = E.settle(c, [[2, 3]], [{ ok: true, json: { items: { 2: { averagePrice: 10 } } } }], now);
  assert.equal(JSON.stringify(left.cache.none), '{"3":' + now + '}');
  const empty = E.settle(c, [[2]], [{ ok: true, json: { items: { 2: {} } } }], now);
  assert.equal(empty.cache.prices[2], 0, 'a reply with no price stores 0 here, as before; never null');
  // storage keys and query text are unchanged
  const { s, ls } = memStore(); globalThis.localStorage = ls;
  const urls = []; globalThis.fetch = async (u) => { urls.push(u); return { ok: true, json: async () => ({ items: { 2: { averagePrice: 12.4 } } }) }; };
  const res = await E.fetchPrices('Aether', [2], true);
  assert.equal(urls.length, 1); assert.ok(urls[0].endsWith('/Aether/2?listings=0&entries=20'), urls[0]);
  assert.deepEqual(JSON.parse(s['eveniunt-subs-prices']).prices, { 2: 12 }); assert.equal(res.prices[2], 12);
  E.triedSave('Aether', now, {}); assert.ok('eveniunt-subs-prices-tried' in s);
  assert.equal(E.cached('Aether').prices[2], 12);
  delete globalThis.localStorage; delete globalThis.fetch;
});
