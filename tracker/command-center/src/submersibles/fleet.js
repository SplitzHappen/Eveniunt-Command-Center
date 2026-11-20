// Eveniunt Command Center, Submersibles (step S2): the parts shared by the module page and the shell.
// - reading what the owner typed from the game ("1d 3h 12m", "27:45", or a date and time);
// - a sub's status (Back, Out, Idle, Locked), durations and clock times in plain words;
// - the one-event calendar file (.ics) for a return;
// - in-app alerts: a banner, and a sound if the owner turned it on, when a sub comes back while a Command Center page is
//   open (blueprint rule 8). What came back while no page was open simply shows as Back, with no banner.
// Device only, never in the save (blueprint rule 4): the "already alerted" marks and the sound choice, in the existing
// device key 'eveniunt-command-center-device' under 'subs'. Nothing here reads or automates the game.
// Plain script: attaches to globalThis.FLEET, so the same file runs in the browser and in Node tests.
(function () {
  'use strict';
  var F = (globalThis.FLEET = globalThis.FLEET || {});
  var MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  F.DEVICE_KEY = 'eveniunt-command-center-device';

  // The sectors a free company ends with when the Setup form is saved: what is saved now plus the sectors the player ticked in the form
  // (a new company's starting sectors count as ticked), minus what the player unticked in the form. A sector unticked elsewhere while the
  // form was open is not added back; one the form never showed as ticked is never removed. Sorted whole numbers, no repeats.
  F.mergeTicks = function (saved, ticked, off) {
    var gone = {}, seen = {}, out = [];
    (off || []).forEach(function (id) { gone[id] = true; });
    (saved || []).concat(ticked || []).forEach(function (id) { if (Number.isInteger(id) && !gone[id] && !seen[id]) { seen[id] = true; out.push(id); } });
    return out.sort(function (a, b) { return a - b; });
  };
  // The sectors the player unticked in a saved form that the stored list holds again after a merge (another device or tab had them ticked).
  F.cameBack = function (stored, off) {
    var have = {}, seen = {};
    (stored || []).forEach(function (id) { have[id] = true; });
    return (off || []).filter(function (id) { if (!Number.isInteger(id) || !have[id] || seen[id]) return false; seen[id] = true; return true; }).sort(function (a, b) { return a - b; });
  };
  // The status line for them ('' when none came back).
  F.cameBackLine = function (name, back) {
    var n = (back || []).length, who = name || 'this free company';
    if (!n) return '';
    return n === 1 ? '1 sector you unticked for ' + who + ' was ticked on another device or tab and has been kept. Untick it again in Setup if it is wrong.'
      : n + ' sectors you unticked for ' + who + ' were ticked on another device or tab and have been kept. Untick them again in Setup if they are wrong.';
  };

  // ------------------------------------------------------------------ typed game times
  // A duration as the game shows it, or as the owner writes it: "1d 3h 12m", "3h", "45 min", "27:45" (hours:minutes),
  // "27:45:10". Returns milliseconds, or null when the text cannot be read without guessing.
  F.parseDuration = function (text) {
    var s = String(text == null ? '' : text).trim().toLowerCase();
    if (!s) return null;
    var m = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/.exec(s);
    if (m) return (+m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0)) * 1000;
    var re = /(\d+(?:[.,]\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])/g, total = 0, used = '', hit;
    while ((hit = re.exec(s))) {
      var n = parseFloat(hit[1].replace(',', '.')), u = hit[2][0];
      total += n * (u === 'd' ? DAY : u === 'h' ? HOUR : u === 'm' ? MIN : 1000);
      used += hit[0];
    }
    if (!used || s.replace(/[\s,]+/g, '') !== used.replace(/[\s,]+/g, '')) return null; // anything left over: not read
    return total > 0 && total <= 30 * DAY ? Math.round(total) : null;
  };
  // A date and time from a datetime-local field ("2026-11-12T21:40"), read as local time. Returns ms or null.
  F.parseBackAt = function (value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(String(value || '').trim());
    if (!m) return null;
    var t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
    return Number.isFinite(t) ? t : null;
  };
  // The value for a datetime-local field showing a time (local).
  F.localInput = function (t) {
    var d = new Date(t), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  // ------------------------------------------------------------------ status and wording
  // 'locked' (slot not unlocked in this FC), 'out' (on a voyage), 'back' (returned, waiting), 'idle' (no voyage).
  F.status = function (sub, fc, now) {
    if (!sub) return 'locked';
    var slots = fc && fc.unlockedSlots ? fc.unlockedSlots : 1;
    if (sub.slot > slots) return 'locked';
    if (!sub.voyage) return 'idle';
    return sub.voyage.returnAt > now ? 'out' : 'back';
  };
  // The share of a voyage already done, 0 to 1, from the send time and the return time already stored; null when either is
  // missing or the times are not in order (then no gauge is drawn). Clamped: before the send time 0, after the return 1.
  F.voyageProgress = function (v, now) {
    if (!v || !(v.sentAt > 0) || !(v.returnAt > 0) || !(v.returnAt > v.sentAt)) return null;
    return Math.min(1, Math.max(0, (now - v.sentAt) / (v.returnAt - v.sentAt)));
  };
  F.LABEL = { back: 'Back', out: 'Out', idle: 'Idle', locked: 'Locked' };
  // up: round up to the minute, for time still to go (a countdown started from "2h 5m" reads 2 h 5 min, not 2 h 4 min)
  F.fmtDur = function (ms, up) {
    if (!(ms > 0)) return 'now';
    var m = up ? Math.ceil(ms / MIN) : Math.floor(ms / MIN);
    if (m < 1) return 'under 1 min';
    var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d) return d + ' d' + (h ? ' ' + h + ' h' : '') + (mm ? ' ' + mm + ' min' : '');
    if (h) return h + ' h' + (mm ? ' ' + mm + ' min' : '');
    return mm + ' min';
  };
  // A clock time for a moment, with the day when it is not today.
  F.fmtClock = function (t, now) {
    var d = new Date(t), n = new Date(now == null ? Date.now() : now);
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var diff = Math.round((day(d) - day(n)) / DAY);
    if (diff === 0) return hm;
    if (diff === 1) return 'tomorrow ' + hm;
    if (diff === -1) return 'yesterday ' + hm;
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    if (Math.abs(diff) < 7) return wd + ' ' + hm;
    return wd + ' ' + d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + hm;
  };
  // Every sub of the save with its FC and status; the next one back and how many are back now.
  F.fleet = function (sec, now) {
    var out = [];
    if (!sec) return out;
    Object.keys(sec.subs || {}).forEach(function (id) {
      var s = sec.subs[id], fc = (sec.fcs || {})[s.fcId];
      if (!fc) return;
      out.push({ id: id, sub: s, fc: fc, fcId: s.fcId, status: F.status(s, fc, now) });
    });
    return out;
  };
  F.summary = function (sec, now) {
    var all = F.fleet(sec, now), next = null, back = 0;
    all.forEach(function (x) {
      if (x.status === 'back') back++;
      if (x.status === 'out' && (!next || x.sub.voyage.returnAt < next.sub.voyage.returnAt)) next = x;
    });
    return { next: next, back: back, total: all.filter(function (x) { return x.status !== 'locked'; }).length };
  };
  F.subLabel = function (x) { return (x.fc.name || 'Unnamed free company') + ' · ' + (x.sub.name || 'Sub ' + x.sub.slot); };

  // ------------------------------------------------------------------ duplicate free companies of one character
  // A free company is bare when no sub belongs to it, it has no world, one slot (or none noted) and the start sectors only:
  // exactly what the main Settings creates. Where a character has several free companies, bare ones are dropped when another
  // is not bare, else all but the first (lowest order, then id). Never touches one that is not bare, or one with no character.
  // Pure and deterministic, so two pages or devices drop the same ones. Returns { section: a copy, removed: [ids] }.
  F.isBare = function (sec, fcId) {
    var f = sec && sec.fcs && sec.fcs[fcId], subs = (sec && sec.subs) || {};
    if (!f) return false;
    var owned = Object.keys(subs).some(function (k) { return subs[k] && subs[k].fcId === fcId; });
    return !owned && !f.world && (f.unlockedSlots === undefined || f.unlockedSlots === 1) &&
      (f.discovered === undefined || (Array.isArray(f.discovered) && f.discovered.length === 2 && f.discovered[0] === 1 && f.discovered[1] === 2));
  };
  F.foldFcs = function (section) {
    var sec = JSON.parse(JSON.stringify(section || {})), fcs = sec.fcs || {}, removed = [];
    var bare = function (id) { return F.isBare(sec, id); };
    var by = function (a, b) { return ((fcs[a].order || 0) - (fcs[b].order || 0)) || (a < b ? -1 : a > b ? 1 : 0); };
    var groups = {};
    Object.keys(fcs).forEach(function (id) { var c = fcs[id] && fcs[id].charId; if (typeof c === 'string') (groups[c] = groups[c] || []).push(id); });
    Object.keys(groups).forEach(function (c) {
      var ids = groups[c].sort(by); if (ids.length < 2) return;
      var loose = ids.filter(bare), solid = ids.filter(function (id) { return !bare(id); }), gone;
      if (solid.length) {
        gone = loose;
        var name = gone.map(function (id) { return fcs[id].name; }).find(function (n) { return n; });
        var empty = solid.find(function (id) { return !fcs[id].name; });
        if (name && empty) fcs[empty].name = name;
      } else gone = loose.slice(1);
      gone.forEach(function (id) { delete fcs[id]; removed.push(id); });
    });
    return { section: sec, removed: removed.sort() };
  };

  // Which parts the Setup form writes for one submarine (pure). saved: the parts stored now (an array or none); typed: the form's own
  // four parts; touched: the player chose a part in this form (a typed rank alone does not count); rank: the rank being written;
  // fits(partId, rank): whether a part fits that rank. A part the player chose here is written as typed; otherwise the saved parts stay
  // when every one fits the rank, and when one does not fit, none are written and `cleared` says so (the status line names it).
  // -> { parts: array of four ids or null, cleared: boolean }
  F.partsWritten = function (saved, typed, touched, rank, fits) {
    var whole = function (p) { return Array.isArray(p) && p.length === 4 && p.every(function (x) { return x && fits(x, rank); }); };
    if (touched || !Array.isArray(saved)) return { parts: whole(typed) ? typed.slice() : null, cleared: false };
    if (whole(saved)) return { parts: saved.slice(), cleared: false };
    return { parts: null, cleared: saved.some(function (x) { return !!x; }) };
  };

  // Slots that hold two or more submarines (a stored duplicate: a slot holds one). [{ fcId, slot, ids }] for every existing
  // free company; ids in the order of sec.subs (the first is the one the company view shows); sorted by company order,
  // then company id, then slot. A submarine whose company is gone is not listed. Pure.
  F.slotClashes = function (sec) {
    var fcs = (sec && sec.fcs) || {}, subs = (sec && sec.subs) || {}, by = {}, out = [];
    Object.keys(subs).forEach(function (id) {
      var s = subs[id]; if (!s || !fcs[s.fcId] || s.slot == null) return;
      var k = s.fcId + '|' + s.slot;
      if (!by[k]) { by[k] = { fcId: s.fcId, slot: s.slot, ids: [] }; out.push(by[k]); }
      by[k].ids.push(id);
    });
    return out.filter(function (c) { return c.ids.length > 1; }).sort(function (a, b) {
      return ((fcs[a.fcId].order || 0) - (fcs[b.fcId].order || 0)) || (a.fcId < b.fcId ? -1 : a.fcId > b.fcId ? 1 : 0) || (a.slot - b.slot);
    });
  };

  // ------------------------------------------------------------------ calendar file
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsTime(t) { return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function fold(line) { // lines longer than 75 octets continue on the next line after a space (RFC 5545)
    var out = [], cur = '', len = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], n = unescape(encodeURIComponent(ch)).length;
      if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
      cur += ch; len += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  // One event at the return time with an alarm at that moment. o = { title, at, uid, note, now }
  F.ics = function (o) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eveniunt Command Center//Submersibles//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + o.uid + '@eveniunt-command-center', 'DTSTAMP:' + icsTime(o.now || Date.now()), 'DTSTART:' + icsTime(o.at), 'DTEND:' + icsTime(o.at + 15 * MIN),
      'SUMMARY:' + icsText(o.title), 'DESCRIPTION:' + icsText(o.note || ''), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(o.title), 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    return lines.map(fold).join('\r\n') + '\r\n';
  };
  F.fileName = function (title) { return (String(title).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'submarine') + '.ics'; };
  F.download = function (name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type || 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  };

  // ------------------------------------------------------------------ ids
  F.newId = function (prefix) { var s = ''; while (s.length < 8) s += Math.random().toString(36).slice(2); return prefix + s.slice(0, 8); };
  F.tripId = function (subId, sentAt) { return subId + '-' + Math.round(sentAt); };

  // ------------------------------------------------------------------ device-only settings
  F.device = function () { try { var d = JSON.parse(localStorage.getItem(F.DEVICE_KEY) || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } };
  F.deviceSubs = function () { var s = F.device().subs; return s && typeof s === 'object' ? s : {}; };
  F.setDeviceSubs = function (fn) {
    try { var d = F.device(); var s = d.subs && typeof d.subs === 'object' ? d.subs : {}; fn(s); d.subs = s; localStorage.setItem(F.DEVICE_KEY, JSON.stringify(d)); } catch (e) { /* private window: nothing kept */ }
  };

  // ------------------------------------------------------------------ in-app alerts
  var audio = null;
  function chime() {
    try {
      var A = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!A) return;
      audio = audio || new A();
      if (audio.state === 'suspended') audio.resume();
      [[880, 0], [1320, 0.18]].forEach(function (n) {
        var o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + n[1];
        o.frequency.value = n[0]; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.55);
      });
    } catch (e) { /* no sound on this device */ }
  }
  // Browsers allow sound only after the owner has touched the page once.
  F.unlockSound = function () { try { var A = globalThis.AudioContext || globalThis.webkitAudioContext; if (A && !audio) audio = new A(); if (audio && audio.state === 'suspended') audio.resume(); } catch (e) { /* none */ } };
  F.chime = chime;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function banner(group, link, now) {
    var box = document.getElementById('fleet-banners');
    if (!box) { box = document.createElement('div'); box.id = 'fleet-banners'; box.className = 'fleet-banners'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'assertive'); document.body.appendChild(box); }
    var at = F.fmtClock(group[0].sub.voyage.returnAt, now);
    var text = group.length === 1 ? F.subLabel(group[0]) + ' is back (' + at + ')'
      : group.length + ' submarines are back (' + at + '): ' + group.map(F.subLabel).join(', ');
    var b = document.createElement('div');
    b.className = 'fleet-banner';
    b.innerHTML = '<span class="fleet-banner-dot" aria-hidden="true"></span><span class="fleet-banner-text">' + esc(text) + '</span>' +
      (link ? '<a class="fleet-banner-go" href="' + esc(link) + '">Open Submersibles</a>' : '') + '<button type="button" class="fleet-banner-x" aria-label="Dismiss">×</button>';
    b.querySelector('.fleet-banner-x').addEventListener('click', function () { b.remove(); });
    box.appendChild(b);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    // M15: the banner stands below the page's top navigation and never covers it (at least 8 px under the header when it is in view)
    var head = document.querySelector('header'), hb = head ? head.getBoundingClientRect().bottom : 0;
    box.style.top = Math.round(Math.max(0, hb) + 8) + 'px';
    return text;
  }
  // opts: { link (the module's address, shown on the shell's banner), section() → the current section or null }
  F.startAlerts = function (opts) {
    var opened = Date.now();
    var api = { shown: [], opened: opened };
    function tick() {
      var sec = opts.section();
      if (!sec) return;
      var now = Date.now(), all = F.fleet(sec, now), due = [], seen = {};
      var marks = F.deviceSubs().alerted || {};
      var changed = false;
      all.forEach(function (x) {
        var v = x.sub.voyage;
        if (!v) return;
        seen[x.id] = true;
        if (v.returnAt > now || marks[x.id] === v.returnAt) return;
        marks[x.id] = v.returnAt; changed = true;
        if (v.returnAt <= opened || x.status === 'locked') return; // came back while no page was open: shows as Back, no banner
        due.push(x);
      });
      Object.keys(marks).forEach(function (id) { if (!seen[id]) { delete marks[id]; changed = true; } }); // marks only for voyages still in the save
      if (!changed) return;
      // another open page may have alerted for these a moment ago: read the marks again and keep only those still new
      var fresh = F.deviceSubs().alerted || {};
      due = due.filter(function (x) { return fresh[x.id] !== x.sub.voyage.returnAt; });
      F.setDeviceSubs(function (s) { s.alerted = marks; });
      if (!due.length) return;
      // subs returning within the same minute share one banner
      var groups = {};
      due.sort(function (a, b) { return a.sub.voyage.returnAt - b.sub.voyage.returnAt; }).forEach(function (x) { var k = Math.floor(x.sub.voyage.returnAt / MIN); (groups[k] = groups[k] || []).push(x); });
      Object.keys(groups).forEach(function (k) { api.shown.push(banner(groups[k], opts.link, now)); });
      if (F.deviceSubs().sound) chime();
      if (opts.onAlert) opts.onAlert(due);
    }
    api.tick = tick;
    tick();
    api.timer = setInterval(tick, 1000);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') tick(); });
      document.addEventListener('pointerdown', function once() { if (F.deviceSubs().sound) F.unlockSound(); document.removeEventListener('pointerdown', once); });
    }
    return api;
  };
})();
