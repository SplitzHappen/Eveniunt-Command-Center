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
