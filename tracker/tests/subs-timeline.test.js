'use strict';
// The Board's time axis (docs/submersibles-look-spec.md, Revision 4, Rev4.7, W32): the pure arithmetic of
// src/submersibles/timeline.js. Run: node --test tests/subs-timeline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const TL = require('../command-center/src/submersibles/timeline.js');
const H = 3600000;

test('TL.span: the smallest of 12, 24, 48, 72 or 96 hours that holds the time; 48 for nothing; 96 for more', () => {
  assert.equal(TL.span(0), 48, 'nothing to hold');
  assert.equal(TL.span(-5), 48);
  assert.equal(TL.span(NaN), 48);
  assert.equal(TL.span(undefined), 48);
  assert.equal(TL.span(1), 12);
  assert.equal(TL.span(12 * H), 12, 'exactly 12 hours fits the 12 hour axis');
  assert.equal(TL.span(12 * H + 1000), 24, '12 hours and a second needs 24');
  assert.equal(TL.span(24 * H), 24);
  assert.equal(TL.span(24 * H + 1), 48);
  assert.equal(TL.span(48 * H), 48);
  assert.equal(TL.span(48 * H + 1), 72);
  assert.equal(TL.span(72 * H), 72);
  assert.equal(TL.span(72 * H + 1), 96);
  assert.equal(TL.span(96 * H), 96);
  assert.equal(TL.span(200 * H), 96, 'a later return runs off the end of the longest axis');
  assert.deepEqual(TL.SPANS, [12, 24, 48, 72, 96]);
});

test('TL.pos: 0 to 1 with four decimals, clamped', () => {
  assert.equal(TL.pos(0, 48), 0);
  assert.equal(TL.pos(-100, 48), 0, 'a time already past is the left edge');
  assert.equal(TL.pos(24 * H, 48), 0.5);
  assert.equal(TL.pos(27 * H, 48), 0.5625);
  assert.equal(TL.pos(48 * H, 48), 1);
  assert.equal(TL.pos(120 * H, 48), 1, 'past the end is the right edge');
  assert.equal(TL.pos(H, 96), 0.0104, 'rounded to four decimals');
  assert.equal(TL.pos(10 * H, 0), 0, 'no span');
  assert.equal(TL.pos(NaN, 48), 0);
});

test('TL.ticks: five labels, "now" then "+N h" at each quarter, for the five spans', () => {
  const labels = (h) => TL.ticks(h).map((t) => t.label);
  assert.deepEqual(labels(12), ['now', '+3 h', '+6 h', '+9 h', '+12 h']);
  assert.deepEqual(labels(24), ['now', '+6 h', '+12 h', '+18 h', '+24 h']);
  assert.deepEqual(labels(48), ['now', '+12 h', '+24 h', '+36 h', '+48 h']);
  assert.deepEqual(labels(72), ['now', '+18 h', '+36 h', '+54 h', '+72 h']);
  assert.deepEqual(labels(96), ['now', '+24 h', '+48 h', '+72 h', '+96 h']);
  assert.deepEqual(TL.ticks(48).map((t) => t.x), [0, 0.25, 0.5, 0.75, 1]);
});

test('TL.marks: returns closer than 0.02 of the axis become one mark with a count', () => {
  assert.deepEqual(TL.marks([]), []);
  assert.deepEqual(TL.marks(null), []);
  assert.deepEqual(TL.marks([0.5]), [{ x: 0.5, n: 1 }]);
  assert.deepEqual(TL.marks([0.5, 0.6]), [{ x: 0.5, n: 1 }, { x: 0.6, n: 1 }], 'far apart stay apart');
  assert.deepEqual(TL.marks([0.51, 0.5, 0.505]), [{ x: 0.505, n: 3 }], 'three together are one mark of three (the mean position)');
  assert.deepEqual(TL.marks([0.5, 0.52]), [{ x: 0.5, n: 1 }, { x: 0.52, n: 1 }], 'exactly 0.02 apart is not closer than 0.02');
  assert.deepEqual(TL.marks([0.5, 0.5199]), [{ x: 0.51, n: 2 }], 'just under 0.02 merges');
  assert.deepEqual(TL.marks([0.1, 0.105, 0.9, 0.91, 0.5]), [{ x: 0.1025, n: 2 }, { x: 0.5, n: 1 }, { x: 0.905, n: 2 }]);
  // ten minutes on a 48 hour axis is 0.0035: three returns within ten minutes are one mark
  const ten = 600000 / (48 * H);
  assert.equal(TL.marks([0.4, 0.4 + ten / 2, 0.4 + ten]).length, 1);
  assert.equal(TL.marks([0.4, 0.4 + ten / 2, 0.4 + ten])[0].n, 3);
});

test('timeline.js is pure and shipped: no clock, no page, in the page and the build', () => {
  const dir = path.join(__dirname, '..', 'command-center');
  const src = fs.readFileSync(path.join(dir, 'src', 'submersibles', 'timeline.js'), 'utf8');
  assert.ok(!/Date\.now|new Date|document\.|setTimeout|setInterval|localStorage/.test(src.replace(/\/\/.*$/gm, '')), 'no clock and no page in the arithmetic');
  const html = fs.readFileSync(path.join(dir, 'src', 'submersibles', 'index.html'), 'utf8');
  assert.ok(html.indexOf('<script src="timeline.js"></script>') > 0 && html.indexOf('<script src="timeline.js"></script>') < html.indexOf('<script src="subs.js"></script>'), 'timeline.js is loaded before subs.js');
  assert.ok(/'palette\.js', 'timeline\.js'\]/.test(fs.readFileSync(path.join(dir, 'build.js'), 'utf8')), 'build.js copies it');
});

test('subs.js draws the Board as Rev4.7 says: tallies, axis, track, discs, the key; the lane is a labelled group', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'subs.js'), 'utf8');
  for (const s of ['class="strip-tally \'', 'class="strip-more">and \'', ' more within 10 minutes', 'class="tl-axis" aria-hidden="true" data-span="', 'class="tl-mark"', 'class="tl \' + (over', 'class="disc in-sea-', '<span class="discs" aria-hidden="true">', 'class="when-at"',
    'class="foot-note tl-key">Letters: the route\\\'s sectors, in order, in their sea\\\'s colour. Bar and marker: the time left and the return, on the line above. Outlined: a suggestion, not sent.', 'role="group" tabindex="0"', 'aria-label="']) assert.ok(js.includes(s), s);
  // the arithmetic is TL's, not subs.js's own
  assert.ok(js.includes('TL.span(ms)') && js.includes('TL.pos(') && js.includes('TL.ticks(') && js.includes('TL.marks('));
});

// ---- W34 (Rev4.7): the printed scale of Earnings and the Log's days ----
test('TL.niceScale: the smallest of 1, 2, 2.5, 5 or 10 times a power of ten that is at least the largest figure; 1 for nothing', () => {
  const cases = [[0, 1], [-5, 1], [0.3, 0.5], [1, 1], [1.5, 2], [2, 2], [2.4, 2.5], [2.5, 2.5], [2.6, 5], [5, 5], [9, 10], [10, 10], [11, 20], [24, 25], [26, 50], [999, 1000], [1000, 1000], [1001, 2000], [2400, 2500], [49999, 50000], [50000, 50000], [50001, 100000], [123456, 200000], [2500000, 2500000]];
  for (const [max, want] of cases) assert.equal(TL.niceScale(max), want, 'for ' + max);
  for (let max = 1; max < 3e6; max = Math.ceil(max * 1.37)) { const sc = TL.niceScale(max); assert.ok(sc >= max, sc + ' holds ' + max); assert.ok(/^(1|2|2\.5|5)0*$/.test(String(sc).replace('.', '')) || /^(1|2|25|5)0*$/.test(String(sc).replace('.', '')), sc + ' is a nice number'); }
});

const LEDGER = require('../command-center/src/submersibles/ledger.js');
test('LEDGER: local days, their labels (Today, Yesterday, weekday day month, year when not this year) and the grouping of rows', () => {
  const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h || 0, mi || 0).getTime(), now = at(2026, 11, 19, 15, 30);
  assert.equal(LEDGER.dayStart(at(2026, 11, 19, 23, 59)), at(2026, 11, 19));
  assert.equal(LEDGER.dayStart(at(2026, 11, 19, 0, 0)), at(2026, 11, 19));
  assert.equal(LEDGER.dayLabel(at(2026, 11, 19, 0, 1), now), 'Today');
  assert.equal(LEDGER.dayLabel(at(2026, 11, 18, 23, 59), now), 'Yesterday');
  assert.equal(LEDGER.dayLabel(at(2026, 11, 17, 12), now), 'Tuesday 17 November');
  assert.equal(LEDGER.dayLabel(at(2026, 1, 1, 8), now), 'Thursday 1 January');
  assert.equal(LEDGER.dayLabel(at(2025, 12, 31, 8), now), 'Wednesday 31 December 2025');
  const rows = [at(2026, 11, 19, 14), at(2026, 11, 19, 2), at(2026, 11, 18, 22), at(2026, 11, 17, 9), at(2026, 11, 17, 8)].map((t, i) => ({ at: t, i }));
  const days = LEDGER.days(rows);
  assert.deepEqual(days.map((d) => d.rows.map((r) => r.i)), [[0, 1], [2], [3, 4]]);
  assert.deepEqual(days.map((d) => LEDGER.dayLabel(d.at, now)), ['Today', 'Yesterday', 'Tuesday 17 November']);
  assert.deepEqual(LEDGER.days([]), []);
});

test('ledger.js is pure and shipped: no clock, no page, loaded before subs.js and copied by the build', () => {
  const dir = path.join(__dirname, '..', 'command-center');
  const src = fs.readFileSync(path.join(dir, 'src', 'submersibles', 'ledger.js'), 'utf8');
  assert.ok(!/Date\.now|document\.|setTimeout|setInterval|localStorage/.test(src.replace(/\/\/.*$/gm, '')), 'no clock and no page');
  const html = fs.readFileSync(path.join(dir, 'src', 'submersibles', 'index.html'), 'utf8');
  assert.ok(html.indexOf('<script src="ledger.js"></script>') > 0 && html.indexOf('<script src="ledger.js"></script>') < html.indexOf('<script src="subs.js"></script>'));
  assert.ok(fs.readFileSync(path.join(dir, 'build.js'), 'utf8').includes("'ledger.js'"));
});
