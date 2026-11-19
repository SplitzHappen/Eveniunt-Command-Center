// Eveniunt Command Center, Submersibles: the Board's time axis (docs/submersibles-look-spec.md, Revision 4, Rev4.7, W32).
// One plain script, loaded by the page and by the unit test. Every piece of time arithmetic of the timeline lives here and
// is pure: no clock, no page. Times are milliseconds; an axis is a whole number of hours.
(function () {
  'use strict';
  var HOUR = 3600000;
  var SPANS = [12, 24, 48, 72, 96];
  var TL = {};
  TL.SPANS = SPANS;
  TL.MERGE = 0.02; // returns closer together than this share of the axis become one mark
  // the smallest of 12, 24, 48, 72 or 96 hours that holds ms; 48 when there is nothing to hold; 96 for anything longer
  TL.span = function (ms) {
    if (!(ms > 0)) return 48;
    for (var i = 0; i < SPANS.length; i++) if (ms <= SPANS[i] * HOUR) return SPANS[i];
    return 96;
  };
  // where ms falls on an axis of span hours: 0 to 1, four decimals (a time before now is 0, one past the end is 1)
  TL.pos = function (ms, span) {
    if (!(ms > 0) || !(span > 0)) return 0;
    return Math.round(Math.min(1, ms / (span * HOUR)) * 10000) / 10000;
  };
  // the five labels of an axis of that many hours: "now", then "+N h" at each quarter
  TL.ticks = function (hours) {
    var out = [{ x: 0, label: 'now' }];
    for (var q = 1; q <= 4; q++) out.push({ x: q / 4, label: '+' + (hours * q / 4) + ' h' });
    return out;
  };
  // positions (0 to 1) of returns, merged: a return less than 0.02 of the axis after the first of its mark joins that mark.
  // Each mark is { x: the mean position, four decimals, n: how many returns }, in order from the left.
  TL.marks = function (positions) {
    var xs = (positions || []).filter(function (p) { return typeof p === 'number' && p === p; }).sort(function (a, b) { return a - b; });
    var out = [], cur = null;
    xs.forEach(function (p) {
      if (cur && p - cur.first < TL.MERGE) { cur.sum += p; cur.n++; }
      else { cur = { first: p, sum: p, n: 1 }; out.push(cur); }
    });
    return out.map(function (m) { return { x: Math.round(m.sum / m.n * 10000) / 10000, n: m.n }; });
  };
  if (typeof window !== 'undefined') window.TL = TL;
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
})();
