'use strict';
// Saved Universalis replies (tests/fixtures/universalis/, see its README.md): BR-1 to BR-10 of docs/bourse-spec.md, work item B1.
// Reads only the saved files, never the network. Run: node tests/bourse-replies.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'fixtures', 'universalis');
const load = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n + '.json'), 'utf8'));
const REGIONS = [['North-America', 'region-two-items'], ['Europe', 'region-europe-two-items'], ['Oceania', 'region-oceania-two-items']];
const IDS = ['44162', '44166'];
const items = (r) => (r.items ? Object.values(r.items) : [r]); // one id asked: the item is the reply itself
const listingsOf = (r) => items(r).flatMap((i) => i.listings);
const salesOf = (r) => items(r).flatMap((i) => i.recentHistory);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = Number.isInteger;

test('BR-1: listing fields (deep reply) with type, normal and high quality', () => {
  let nq = 0, hq = 0;
  for (const [, n] of REGIONS) for (const l of listingsOf(load(n))) {
    assert.ok(isInt(l.pricePerUnit) && l.pricePerUnit > 0);
    assert.ok(isInt(l.quantity) && l.quantity > 0);
    assert.ok(isInt(l.total) && isInt(l.tax));
    assert.equal(typeof l.hq, 'boolean');
    assert.equal(typeof l.worldName, 'string');
    if (l.hq) hq++; else nq++;
  }
  assert.ok(nq > 0 && hq > 0, 'both qualities are present in the saved listings');
});

test('BR-2: sale fields (recentHistory) with type, normal and high quality', () => {
  let hq = 0;
  for (const [, n] of REGIONS) for (const s of salesOf(load(n))) {
    assert.ok(isInt(s.pricePerUnit) && s.pricePerUnit > 0);
    assert.ok(isInt(s.quantity) && s.quantity > 0);
    assert.ok(isInt(s.timestamp) && s.timestamp > 0);
    assert.equal(typeof s.hq, 'boolean');
    assert.equal(typeof s.worldName, 'string');
    if (s.hq) hq++;
  }
  assert.ok(hq > 0);
  // normal-quality sales exist in the saved files (the history reply and the other items)
  const all = [...salesOf(load('region-batch')), ...load('history-one-item').entries, ...salesOf(load('slim-two-items'))];
  assert.ok(all.some((s) => s.hq === false), 'a normal-quality sale is saved');
  assert.ok(all.some((s) => s.hq === true));
});

test('BR-3: item level fields: lastUploadTime, worldUploadTimes, listing counts', () => {
  for (const [, n] of REGIONS) for (const i of items(load(n))) {
    assert.ok(isNum(i.lastUploadTime) && i.lastUploadTime > 0);
    assert.equal(typeof i.worldUploadTimes, 'object');
    const ks = Object.keys(i.worldUploadTimes);
    assert.ok(ks.length > 0);
    for (const k of ks) assert.ok(/^\d+$/.test(k) && isNum(i.worldUploadTimes[k]));
    assert.ok(isInt(i.listingsCount) && isInt(i.recentHistoryCount));
  }
});

test('BR-4: slim reply (listings=0): minPriceNQ, minPriceHQ, history with hq, timestamp, worldName', () => {
  const r = load('slim-two-items');
  assert.deepEqual(Object.keys(r.items).sort(), IDS);
  for (const i of items(r)) {
    assert.deepEqual(i.listings, []);
    assert.ok(isInt(i.minPriceNQ) && isInt(i.minPriceHQ));
    assert.ok(i.recentHistory.length > 0);
    for (const s of i.recentHistory) {
      assert.equal(typeof s.hq, 'boolean');
      assert.ok(isInt(s.timestamp));
      assert.equal(typeof s.worldName, 'string');
    }
  }
});

test('BR-5: history endpoint: entries with pricePerUnit, hq, quantity, timestamp, worldName', () => {
  const h = load('history-one-item');
  assert.equal(h.itemID, 44162);
  assert.ok(Array.isArray(h.entries) && h.entries.length > 0 && h.entries.length <= 10);
  for (const e of h.entries) {
    assert.ok(isInt(e.pricePerUnit) && isInt(e.quantity) && isInt(e.timestamp));
    assert.equal(typeof e.hq, 'boolean');
    assert.equal(typeof e.worldName, 'string');
  }
});

test('BR-6: batch replies: shape of several items, one item, unresolved', () => {
  const b = load('region-batch');
  assert.deepEqual(Object.keys(b.items).sort(), ['44001', '44162', '44166', '5']);
  assert.deepEqual(b.unresolvedItems, []);
  assert.equal(b.regionName, 'North-America');
  const w = load('world-batch');
  assert.deepEqual(Object.keys(w.items).sort(), ['44001', '44162', '44166', '5']);
  assert.equal(w.worldName, 'Gilgamesh');
  // one id asked: the item is the reply itself, not wrapped in items{}
  const one = load('world-one-item');
  assert.equal(one.items, undefined);
  assert.equal(one.itemID, 44162);
  assert.equal(one.worldName, 'Gilgamesh');
  assert.ok(Array.isArray(one.listings) && Array.isArray(one.recentHistory));
});

test('BR-7: tax model: rate unit, total excludes tax, tax is rounded down', () => {
  const rates = load('tax-rates');
  assert.ok(Object.keys(rates).length >= 7);
  for (const v of Object.values(rates)) assert.ok(isInt(v) && v >= 0 && v <= 20, 'a rate is a whole percent (5), not 0.05');
  assert.equal(rates['Limsa Lominsa'], 5);
  const ls = listingsOf(load('capped-item'));
  assert.equal(ls.length, 60);
  let fractional = 0;
  for (const l of ls) {
    assert.equal(l.total, l.pricePerUnit * l.quantity, 'total is price x quantity, tax not included');
    assert.ok(l.tax <= l.total * 0.05 + 1e-9, 'tax is at most 5 percent of total');
    const exact = l.total * 0.05;
    if (!isInt(exact)) fractional++;
    assert.equal(l.tax, Math.floor(l.total * 5 / 100), 'tax is the 5 percent rounded down');
  }
  assert.ok(fractional > 0, 'the saved listings include a fractional case');
  for (const s of salesOf(load('region-batch'))) assert.equal(s.total, s.pricePerUnit * s.quantity);
});

test('BR-8: real request names; unknown item and unknown place both answer 404 with the same shape', () => {
  for (const [name, n] of REGIONS) {
    const r = load(n);
    assert.equal(r.regionName, name);
    assert.deepEqual(Object.keys(r.items).sort(), IDS);
  }
  const ui = load('unknown-item'), up = load('unknown-place');
  for (const e of [ui, up]) { assert.equal(e.status, 404); assert.equal(e.title, 'Not Found'); }
  assert.deepEqual(Object.keys(ui).sort(), Object.keys(up).sort());
});

test('BR-9: a world on every listing and sale; time units; worldUploadTimes', () => {
  for (const f of ['region-two-items', 'region-europe-two-items', 'region-oceania-two-items', 'region-batch']) {
    const r = load(f);
    for (const x of [...listingsOf(r), ...salesOf(r)]) {
      assert.equal(typeof x.worldName, 'string');
      assert.ok(isInt(x.worldID));
    }
  }
  const SEC_MIN = 1e9, SEC_MAX = 1e10; // seconds since 1970 (2001 to 2286)
  for (const i of items(load('region-two-items'))) {
    assert.ok(i.lastUploadTime > 1e12, 'lastUploadTime is in milliseconds');
    for (const t of Object.values(i.worldUploadTimes)) assert.ok(t > 1e12, 'a world upload time is in milliseconds');
    for (const s of i.recentHistory) assert.ok(s.timestamp > SEC_MIN && s.timestamp < SEC_MAX, 'a sale timestamp is in seconds');
    for (const l of i.listings) assert.ok(l.lastReviewTime > SEC_MIN && l.lastReviewTime < SEC_MAX, 'lastReviewTime is in seconds');
    // the world named on a listing is a world the reply has an upload time for
    for (const l of i.listings) assert.ok(String(l.worldID) in i.worldUploadTimes);
  }
  // a world reply does not carry worldUploadTimes: the world's age is lastUploadTime
  const w = load('world-one-item');
  assert.equal(w.worldUploadTimes, undefined);
  assert.ok(w.lastUploadTime > 1e12);
});

test('BR-10: listings=60 caps per item; listings=300 is accepted', () => {
  const c = load('capped-item');
  assert.equal(c.listingsCount, 60);
  assert.equal(c.listings.length, 60);
  const all = load('item-all-listings');
  assert.ok(all.listingsCount > 60 && all.listingsCount <= 300, 'listings=300 answered more than 60 listings, no error');
  assert.deepEqual(all.recentHistory, []);
  assert.ok(Object.keys(load('region-two-items').items).every((k) => load('region-two-items').items[k].listingsCount <= 60));
  // the high-quality filter returns only high-quality listings
  for (const l of listingsOf(load('hq-filter'))) assert.equal(l.hq, true);
});

// The redaction boundary (see the README): only these keys may appear anywhere in a saved reply. Player names and ids
// (retainer, seller, buyer, creator), listing numbers and request trace numbers were removed when the replies were saved.
const ALLOWED = new Set(['averagePrice', 'averagePriceHQ', 'averagePriceNQ', 'currentAveragePrice', 'currentAveragePriceHQ', 'currentAveragePriceNQ',
  'entries', 'hasData', 'hq', 'hqSaleVelocity', 'isCrafted', 'itemID', 'itemIDs', 'items', 'lastReviewTime', 'lastUploadTime', 'listings', 'listingsCount',
  'materia', 'maxPrice', 'maxPriceHQ', 'maxPriceNQ', 'minPrice', 'minPriceHQ', 'minPriceNQ', 'nqSaleVelocity', 'onMannequin', 'pricePerUnit', 'quantity',
  'recentHistory', 'recentHistoryCount', 'regionName', 'regularSaleVelocity', 'retainerCity', 'stackSizeHistogram', 'stackSizeHistogramHQ',
  'stackSizeHistogramNQ', 'stainID', 'status', 'tax', 'timestamp', 'title', 'total', 'type', 'unitsForSale', 'unitsSold', 'unresolvedItems', 'worldID',
  'worldName', 'worldUploadTimes',
  // the tax-rates reply is keyed by city
  'Crystarium', 'Gridania', 'Ishgard', 'Kugane', 'Limsa Lominsa', 'Old Sharlayan', 'Tuliyollal', "Ul'dah"]);
function unexpectedKeys(o, out = []) {
  if (Array.isArray(o)) o.forEach((v) => unexpectedKeys(v, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (!/^\d+$/.test(k) && !ALLOWED.has(k)) out.push(k); unexpectedKeys(v, out); }
  return out;
}

test('the key check refuses a key outside the allowed list (control)', () => {
  assert.deepEqual(unexpectedKeys({ listings: [{ pricePerUnit: 1, retainerName: 'x' }], items: { 5: { listingID: 'y' } } }), ['retainerName', 'listingID']);
});

test('no player names, player ids, listing numbers or trace numbers in the saved files: every key is on the allowed list', () => {
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
    assert.deepEqual(unexpectedKeys(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))), [], f);
  }
});
