// Eveniunt Command Center, Submersibles: the Log's days (docs/submersibles-look-spec.md, Revision 4, Rev4.7, W34).
// One plain script, loaded by the page and by a unit test. Pure: it reads no clock (the caller passes "now") and no page. Times are
// milliseconds; a day is a local calendar day (the Log groups its rows by the day of the time each row shows).
(function () {
  'use strict';
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var LEDGER = {};
  // the start of the local day that holds ms
  LEDGER.dayStart = function (ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  // "Today", "Yesterday", else the weekday, day and month in English (with the year when it is not now's year)
  LEDGER.dayLabel = function (ms, now) {
    var diff = Math.round((LEDGER.dayStart(ms) - LEDGER.dayStart(now)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    var d = new Date(ms), n = new Date(now);
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() === n.getFullYear() ? '' : ' ' + d.getFullYear());
  };
  // rows: [{ at: ms, ... }] newest first, as the Log lists them. Returns [{ key: the day's start, at: the first row's time, rows: [...] }] in the same order
  LEDGER.days = function (rows) {
    var out = [], cur = null;
    (rows || []).forEach(function (r) {
      var key = LEDGER.dayStart(r.at);
      if (!cur || cur.key !== key) { cur = { key: key, at: r.at, rows: [] }; out.push(cur); }
      cur.rows.push(r);
    });
    return out;
  };
  // K3.4: a day heading counts and totals ALL of that day's voyages, whatever part of the list is drawn.
  // rows: [{ at, logged: whether loot is logged, gil: its value }] (every voyage, not only the drawn ones). Returns { <day start>: { n, logged, gil } }.
  LEDGER.dayInfo = function (rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var k = LEDGER.dayStart(r.at), d = out[k] = out[k] || { n: 0, logged: 0, gil: 0 };
      d.n++; if (r.logged) { d.logged++; d.gil += Math.round(+r.gil || 0); }
    });
    return out;
  };
  // "showing 3 of 8" when some of the day's n voyages are not drawn, else ""
  LEDGER.shownNote = function (n, shown) { return shown < n ? 'showing ' + shown + ' of ' + n : ''; };
  if (typeof window !== 'undefined') window.LEDGER = LEDGER;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEDGER;
})();
