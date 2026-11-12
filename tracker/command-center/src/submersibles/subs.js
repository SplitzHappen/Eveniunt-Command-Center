// Eveniunt Command Center, Submersibles module page (step S2 of the Submersibles design: fleet board and guided setup).
// - Guided setup once per free company: name, world, character, the four sub slots (unlocked, name, rank, parts, any
//   voyage under way) and the sectors already discovered.
// - The fleet board: every sub as Back, Out, Idle or Locked with live countdowns; sorting by FC or by return time.
// - Send: the return time the owner TYPES FROM THE GAME (nothing is calculated yet; worked-out times are step S3).
// - Calendar entries, and in-app alerts through fleet.js.
// The data lives in the one save (modules.submersibles, design 7.1), written through CC.writeSection and read through
// CC.read, as the Atelier does; backups, transfer codes and cloud sync carry it. Nothing is read from the game.
(function () {
  'use strict';
  var CC = window.CC, F = window.FLEET, ADV = window.ADVISOR, PUSH = window.PUSH;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var SLOTS = ['hull', 'stern', 'bow', 'bridge'];
  var SLOT_NAME = { hull: 'Hull', stern: 'Stern', bow: 'Bow', bridge: 'Bridge' };
  var MAX_SUGGESTED_FCS = 8;

  // ------------------------------------------------------------------ data (data/submarines.json, built in by build.js)
  var D = null, SECTOR = {}, PART = {}, CLASS = {}, SEA = {}, WORLDS = window.SUB_WORLDS || { dc: {}, worlds: {} };
  function loadData() {
    var p = window.SUB_DATA ? Promise.resolve(window.SUB_DATA) : CC.unpack(window.SUB_DATA_PACKED).then(JSON.parse);
    return p.then(function (d) {
      D = d; ADV.init(d);
      d.sectors.forEach(function (s) { SECTOR[s.id] = s; });
      d.parts.forEach(function (x) { PART[x.id] = x; });
      d.classes.forEach(function (c) { CLASS[c.id] = c; });
      d.seas.forEach(function (s) { SEA[s.id] = s; });
    });
  }
  var LETTER = { Shark: 'S', Unkiu: 'U', Whale: 'W', Coelacanth: 'C', Syldra: 'Y' };
  function classCode(c) { var base = c.name.replace(/^Modified /, ''); return (LETTER[base] || base[0]) + (/^Modified /.test(c.name) ? '+' : ''); }
  function partsCode(parts) { return parts && parts.length === 4 ? parts.map(function (id) { return PART[id] ? classCode(CLASS[PART[id].class]) : '?'; }).join('') : '????'; }
  function partsTitle(parts) { return parts && parts.length === 4 ? parts.map(function (id) { return PART[id] ? PART[id].name : '?'; }).join(', ') : 'parts not entered'; }
  function sectorShort(id) { var s = SECTOR[id]; return s ? s.letter : '?'; }
  function routeText(route) {
    if (!route || !route.length) return '';
    var sea = SECTOR[route[0]] ? SEA[SECTOR[route[0]].sea].name : '';
    return sea + ': ' + route.map(sectorShort).join(' → ');
  }
  function startSectors() { return Object.keys(D.unlocks).filter(function (k) { return D.unlocks[k].start; }).map(Number); }
  function slotUnlock(slot) { var u = D.subSlots.find(function (x) { return x.slot === slot; }); return u ? SECTOR[u.sector] : null; }
  function sectorLabel(s) { return SEA[s.sea].name + ' ' + s.letter; }

  // ------------------------------------------------------------------ the one save
  var SH = { rev: null, base: null, ready: false, timer: null, problem: null, chars: [] };
  var S = { fcs: {}, subs: {}, trips: {}, settings: {} };
  function emptySection() { return { fcs: {}, subs: {}, trips: {}, settings: {} }; }
  function setSection(sec) { S = sec ? JSON.parse(JSON.stringify(sec)) : emptySection(); ['fcs', 'subs', 'trips', 'settings'].forEach(function (k) { if (!S[k]) S[k] = {}; }); }
  function loadSave() {
    return CC.read().then(function (r) {
      var doc = CC.emptyDoc();
      if (r.raw != null) {
        try { doc = CC.checkDoc(r.raw); } catch (e) { SH.problem = e.message; return; } // unreadable or newer: never written over
      }
      SH.rev = r.rev; SH.chars = doc.chars; SH.updated = doc.updated || 0;
      SH.base = doc.modules.submersibles ? JSON.parse(JSON.stringify(doc.modules.submersibles)) : null;
      setSection(doc.modules.submersibles);
      SH.ready = true;
    }).catch(function (e) { SH.problem = e.message; });
  }
  function schedule() { if (!SH.ready) return; clearTimeout(SH.timer); SH.timer = setTimeout(write, 250); render(); }
  function write() {
    clearTimeout(SH.timer); SH.timer = null;
    if (!SH.ready || SH.problem) return Promise.resolve();
    return CC.writeSection('submersibles', S, { rev: SH.rev, base: SH.base }).then(function (r) {
      SH.rev = r.rev; SH.base = JSON.parse(JSON.stringify(r.section)); SH.chars = r.doc.chars; SH.updated = r.doc.updated || Date.now();
      if (r.merged) { setSection(r.section); render(); }
      setStatus('');
      pushSync();
    }).catch(function (e) { setStatus('Not saved on this device: ' + e.message); });
  }
  // another page (the Tracker after a cloud sync, another window) saved: take its section, unless a change made here
  // is still waiting (that save merges with theirs)
  function reload() {
    if (SH.timer || !SH.ready) return;
    CC.read().then(function (r) {
      var doc; try { doc = CC.checkDoc(r.raw); } catch (e) { return; }
      if (SH.timer) return;
      var before = JSON.stringify([SH.chars, S]);
      SH.rev = r.rev; SH.chars = doc.chars; SH.updated = doc.updated || SH.updated;
      SH.base = doc.modules.submersibles ? JSON.parse(JSON.stringify(doc.modules.submersibles)) : null;
      setSection(doc.modules.submersibles);
      if (JSON.stringify([SH.chars, S]) !== before && !W) render();
      pushSync();
    });
  }
  function setStatus(t) { var el = $('#status'); if (el) el.textContent = t; }

  // ------------------------------------------------------------------ view state (this tab only)
  var UI = { tab: 'board' };
  try { var saved = JSON.parse(sessionStorage.getItem('eveniunt-subs-ui') || '{}'); if (saved.tab) UI.tab = saved.tab; } catch (e) { /* none */ }
  function keepUi() { try { sessionStorage.setItem('eveniunt-subs-ui', JSON.stringify(UI)); } catch (e) { /* none */ } }
  function sortMode() { return (S.settings.prefs && S.settings.prefs.sort) || 'fc'; }
  function fcList() { return Object.keys(S.fcs).map(function (id) { return { id: id, fc: S.fcs[id] }; }).sort(function (a, b) { return (a.fc.order || 0) - (b.fc.order || 0) || String(a.fc.name || '').localeCompare(b.fc.name || ''); }); }
  function subsOf(fcId) { var out = {}; Object.keys(S.subs).forEach(function (id) { var s = S.subs[id]; if (s.fcId === fcId && !out[s.slot]) out[s.slot] = { id: id, sub: s }; }); return out; }
  function charName(id) { var c = SH.chars.find(function (x) { return x.id === id; }); return c ? c.name : ''; }

  // ------------------------------------------------------------------ rendering
  var TABS = [['board', 'Board', null], ['log', 'Log', 'Logging what each voyage brought back arrives in step S5 of the plan.'], ['map', 'Map', 'The seven sea maps and the route planner arrive in step S4.'],
    ['earn', 'Earnings', 'Earnings and gil per hour from your own log arrive in step S5.'], ['setup', 'Setup', null]];
  function render() {
    if (!D) return;
    $$('.tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === UI.tab ? 'page' : 'false'); });
    var main = $('#view');
    if (SH.problem) { main.innerHTML = '<div class="note bad"><b>The save cannot be used here.</b> ' + esc(SH.problem) + ' Nothing has been written over it.</div>'; return; }
    if (UI.tab === 'board') main.innerHTML = boardHtml();
    else if (UI.tab === 'setup') { main.innerHTML = W ? wizardHtml() : setupHtml(); if (!W) { measureSize(); pushStatus(); } }
    else { var t = TABS.find(function (x) { return x[0] === UI.tab; }); main.innerHTML = '<section class="panel"><h2>' + esc(t[1]) + '</h2><p class="muted">' + esc(t[2]) + ' Until then, the Board and Setup work on their own.</p></section>'; }
    lastStatus = statusKey();
  }
  var lastStatus = '';
  function statusKey() { var now = Date.now(); return F.fleet(S, now).map(function (x) { return x.id + x.status; }).join(); }

  function strip(now) {
    var sum = F.summary(S, now);
    var next = sum.next ? '<b>Next back:</b> ' + esc(F.subLabel(sum.next)) + ' in <span data-until="' + sum.next.sub.voyage.returnAt + '">' + F.fmtDur(sum.next.sub.voyage.returnAt - now, true) + '</span>'
      : '<b>Next back:</b> none out';
    var sound = !!F.deviceSubs().sound;
    return '<div class="strip">' +
      '<span class="strip-next">' + next + '</span>' +
      '<span class="strip-back' + (sum.back ? ' on' : '') + '"><b>' + sum.back + '</b> back now</span>' +
      '<span class="strip-tools">' +
        '<span class="seg" role="group" aria-label="Sort"><button type="button" data-sort="fc" aria-pressed="' + (sortMode() === 'fc') + '">By FC</button><button type="button" data-sort="time" aria-pressed="' + (sortMode() === 'time') + '">By return time</button></span>' +
        '<button type="button" class="btn sm" data-act="sound" aria-pressed="' + sound + '" title="A sound with the banner when a sub comes back (this device only)">Sound ' + (sound ? 'on' : 'off') + '</button>' +
      '</span></div>';
  }
  function subRow(x, now, withFc) {
    var s = x.sub, st = x.status, v = s.voyage, info = '';
    if (st === 'out') info = '<span class="when" title="' + (v.gameSaid ? 'From the game (typed)' : 'Worked out from rank, parts and route') + '">back in <b data-until="' + v.returnAt + '">' + F.fmtDur(v.returnAt - now, true) + '</b> · ' + esc(F.fmtClock(v.returnAt, now)) + '</span>';
    else if (st === 'back') { var up = ADV.afterVoyage(s, v.route); info = '<span class="when">waiting <b data-since="' + v.returnAt + '">' + F.fmtDur(now - v.returnAt) + '</b> · back ' + esc(F.fmtClock(v.returnAt, now)) + (up && up.rank > s.rank ? ' · rank → ' + up.rank + '+' : '') + '</span>'; }
    else if (st === 'idle') info = '<span class="when">not sent</span>';
    var quick = '';
    if (st === 'back' || st === 'idle') { var a = adviceFor(x.id); if (a && a.plan) quick = '<button type="button" class="quick" data-quick="' + esc(x.id) + '" title="' + esc(a.plan.why) + '">Send ▸ ' + esc(ADV.routeText(a.plan.route)) + ' · back ' + esc(F.fmtClock(now + a.plan.ev.seconds * 1000, now)) + '</button>'; }
    var route = v && v.route && v.route.length ? '<span class="route" title="Route as entered">' + esc(routeText(v.route)) + '</span>' : '';
    return '<div class="sub" role="button" tabindex="0" data-sub="' + esc(x.id) + '" data-status="' + st + '">' +
      '<span class="sub-top"><span class="sub-name">' + (withFc ? '<span class="sub-fc">' + esc(x.fc.name || 'Unnamed') + ' · </span>' : '') + esc(s.name || 'Sub ' + s.slot) + '</span>' +
      '<span class="chip ' + st + '">' + F.LABEL[st] + '</span></span>' +
      '<span class="sub-meta"><span title="Rank as you entered it">' + (s.rank ? 'Rank ' + s.rank : 'Rank ?') + '</span><span class="code" title="' + esc(partsTitle(s.parts)) + ' (as you entered them)">' + partsCode(s.parts) + '</span>' + route + '</span>' +
      '<span class="sub-when">' + info + quick + '</span></div>';
  }
  function lockedRow(slot) {
    var u = slotUnlock(slot);
    return '<div class="sub" data-status="locked" data-slot="' + slot + '"><span class="sub-top"><span class="sub-name">Slot ' + slot + '</span><span class="chip locked">Locked</span></span>' +
      '<span class="sub-meta">' + (u ? 'Unlocked by surveying ' + esc(sectorLabel(u)) + ' <span class="tag" title="Submarine Tracker, MIT; see Credits">community data</span>' : 'unlock not known') + '</span></div>';
  }
  function fcCard(f, now) {
    var fc = f.fc, subs = subsOf(f.id), rows = '', outs = [];
    for (var slot = 1; slot <= 4; slot++) {
      var e = subs[slot];
      if (slot > (fc.unlockedSlots || 1) || !e) { rows += slot > (fc.unlockedSlots || 1) ? lockedRow(slot) : '<div class="sub empty" data-status="idle"><span class="sub-meta">Slot ' + slot + ' is unlocked but has no sub yet. <button type="button" class="link" data-act="edit" data-fc="' + esc(f.id) + '">Add it in Setup</button></span></div>'; continue; }
      var x = { id: e.id, sub: e.sub, fc: fc, fcId: f.id, status: F.status(e.sub, fc, now) };
      if (x.status === 'out') outs.push(x);
      rows += subRow(x, now, false);
    }
    var last = outs.sort(function (a, b) { return b.sub.voyage.returnAt - a.sub.voyage.returnAt; })[0];
    var sendable = Object.keys(subs).some(function (k) { var st = F.status(subs[k].sub, fc, now); return st === 'back' || st === 'idle'; });
    var where = [fc.world, charName(fc.charId)].filter(Boolean).join(' · ');
    return '<section class="fc" data-fc="' + esc(f.id) + '"><header class="fc-head"><div><h3>' + esc(fc.name || 'Unnamed free company') + '</h3>' + (where ? '<span class="muted">' + esc(where) + '</span>' : '') + '</div>' +
      '<div class="fc-tools">' + (sendable ? '<button type="button" class="btn sm" data-act="sendall" data-fc="' + esc(f.id) + '">Send all back</button>' : '') +
      (last ? '<button type="button" class="btn sm ghost" data-act="ics-fc" data-fc="' + esc(f.id) + '" title="Add the last return of this free company to your calendar">Calendar: last back ' + esc(F.fmtClock(last.sub.voyage.returnAt, now)) + '</button>' : '') +
      '</div></header><div class="fc-subs">' + rows + '</div></section>';
  }
  function boardHtml() {
    var now = Date.now(), fcs = fcList();
    if (!fcs.length) {
      return '<section class="panel welcome"><h2>Set up your first free company</h2><p>Once per free company, about 3 to 5 minutes: its name, world and character, then each of its four submarine slots (name, rank, parts and any voyage under way) and the sectors already discovered.</p>' +
        '<p><button type="button" class="btn primary" data-act="new">Start the setup</button></p><p class="muted">Enter each sub\'s rank and four parts: the app then works out every return time from the route you tap, and suggests the next route following your order (unlock all four subs, discover every sector, farm gil).</p></section>';
    }
    var body;
    if (sortMode() === 'time') {
      var all = F.fleet(S, now).filter(function (x) { return x.status !== 'locked'; });
      var rank = { back: 0, out: 1, idle: 2 };
      all.sort(function (a, b) {
        return rank[a.status] - rank[b.status] || (a.status === 'back' ? a.sub.voyage.returnAt - b.sub.voyage.returnAt : a.status === 'out' ? a.sub.voyage.returnAt - b.sub.voyage.returnAt : 0) || String(F.subLabel(a)).localeCompare(F.subLabel(b));
      });
      body = '<section class="fc wide"><header class="fc-head"><h3>All submarines by return time</h3></header><div class="fc-subs list">' + all.map(function (x) { return subRow(x, now, true); }).join('') + '</div></section>';
    } else body = '<div class="fleet">' + fcs.map(function (f) { return fcCard(f, now); }).join('') + '</div>';
    return strip(now) + body + '<p class="foot-note">Return times: worked out from rank, parts and route (' + esc(confirmation().text) + '), or the game\'s time where you typed it. Ranks and parts: as you entered them. Suggestions follow your order: unlock all four subs, discover every sector, farm gil. Alerts work while a Command Center page is open; for a reminder when the app is closed, add the return to your calendar.</p>';
  }
  // how the worked-out times compare with the game's: every voyage or trip where the game's time was also entered
  function accuracyHtml() {
    var rows = [], c = confirmation();
    var add = function (subId, calc, back, said) { if (calc && back && said) rows.push({ sub: S.subs[subId], calc: calc, back: back, said: said }); };
    Object.keys(S.trips).forEach(function (k) { var t = S.trips[k]; add(t.s, t.calc, t.back, t.said); });
    Object.keys(S.subs).forEach(function (k) { var v = S.subs[k].voyage; if (v) add(k, v.calcAt, v.returnAt, v.gameSaid); });
    rows.sort(function (a, b) { return b.back - a.back; });
    var rc = Object.keys(S.trips).map(function (k) { return S.trips[k]; }).filter(function (t) { return t.rankCalc && t.rankAfter; });
    var rankLine = '<p class="hint">Ranks after a voyage: ' + rc.length + ' worked out' + (rc.length ? ', ' + rc.filter(function (t) { return t.rankAfter > t.rankCalc; }).length + ' corrected higher from the game (survey bonuses give extra experience; the app counts only the base)' : '') + '.</p>';
    return '<section class="panel accuracy"><h2>Accuracy of worked-out times</h2><p><span class="tag">' + esc(c.text) + '</span></p>' + rankLine +
      '<p class="muted">The times use the community formula from Submarine Tracker; players measuring the game on the official forum found the same three numbers (12 hours per voyage, 39.9 minutes per unit of distance at speed 1, 70 minutes per survey minute at speed 1). To confirm it on your own fleet: after sending in the game, open the sub here and use <b>Check against the game</b>. After 10 checks within a minute, the label says confirmed.</p>' +
      (rows.length ? '<table class="acc"><thead><tr><th>Sub</th><th>Worked out</th><th>Game</th><th>Difference</th></tr></thead><tbody>' + rows.slice(0, 20).map(function (r) {
        var d = Math.round((r.back - r.calc) / 1000);
        return '<tr><td>' + esc(r.sub ? r.sub.name || 'Sub ' + r.sub.slot : 'removed sub') + '</td><td>' + esc(F.fmtClock(r.calc)) + '</td><td>' + esc(F.fmtClock(r.back)) + ' <span class="muted">(' + esc(r.said) + ')</span></td><td class="' + (Math.abs(d) <= 60 ? 'ok' : 'bad') + '">' + (Math.abs(d) <= 60 ? 'agrees' : (d > 0 ? '+' : '') + Math.round(d / 60) + ' min') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">No checks yet.</p>') + '</section>';
  }
  // ------------------------------------------------------------------ phone notifications (step S7)
  // where each free company stands in the owner's order: still unlocking (subs or sectors, levelling included), farming
  // gil, or finished (gil step, every sub at the top rank and no better part to fit)
  function stageOf(fcId) {
    var fc = S.fcs[fcId], list = Object.keys(S.subs).filter(function (k) { return S.subs[k].fcId === fcId && S.subs[k].slot <= (fc.unlockedSlots || 1); });
    if (!fc || !list.length) return 'unlock';
    var advice = list.map(function (k) { return ADV.advise({ sub: S.subs[k], fc: fc, slotsFilled: list.length }); });
    if (advice.some(function (a) { return a.blocked || a.step < 3; })) return 'unlock';
    return list.every(function (k) { return S.subs[k].rank === 145; }) && advice.every(function (a) { return !a.parts; }) ? 'final' : 'gil';
  }
  function prefs() { return S.settings.prefs || {}; }
  var pushTimer = null;
  function pushSync() {
    if (!PUSH || !PUSH.device()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      PUSH.sync(PUSH.alerts(S, prefs(), stageOf, Date.now()), SH.updated || 0).then(function (r) { if (r) PUSH.last = r; pushStatus(); }).catch(function (e) { PUSH.lastError = e; pushStatus(); });
    }, 1500);
  }
  function minutes(v) { var m = /^(\d{2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function hhmm(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function notifyHtml() {
    var p = prefs(), g = p.grouping || 'auto', q = p.quietHours || { from: 22 * 60, to: 8 * 60 }, night = p.night || 'always';
    var modes = PUSH.modes(S, p, stageOf), WHY = { sub: 'per submarine (still unlocking)', fc: 'per free company (farming gil)', fleet: 'whole fleet (everything at the top)' };
    var auto = fcList().map(function (f) { return esc(f.fc.name || 'Unnamed') + ': ' + (g === 'auto' ? WHY[modes[f.id]] : PUSH.GROUPINGS[modes[f.id]].toLowerCase()); }).join(' · ');
    var opt = function (name, val, label, help) { return '<label class="opt notify-opt"><input type="radio" name="' + name + '" value="' + val + '" data-pref="' + name + '"' + ((name === 'grouping' ? g : night) === val ? ' checked' : '') + '> <span><b>' + esc(label) + '</b>' + (help ? '<br><span class="hint">' + help + '</span>' : '') + '</span></label>'; };
    return '<section class="panel notify"><h2>Phone notifications</h2><p class="muted">Your phone or computer is told when subs are back, even with the app closed. They come through your own sync helper, which keeps only the alert times, short labels and this device\'s notification address.</p>' +
      '<p data-push-status class="push-status">Checking…</p>' +
      '<p class="row"><button type="button" class="btn primary" data-act="push-on">Turn on for this device</button><button type="button" class="btn" data-act="push-test">Send a test</button><button type="button" class="btn ghost" data-act="push-off">Turn off for this device</button></p>' +
      '<fieldset><legend>How alerts are grouped</legend>' +
      opt('grouping', 'auto', 'Automatic (recommended)', 'The app decides for each free company: one alert per submarine while it is still unlocking subs and sectors, one per free company once it farms gil; one for the whole fleet once every free company farms gil with every sub at rank 145 and no better part to fit.') +
      opt('grouping', 'sub', 'Per submarine', 'One alert for each sub that comes back.') +
      opt('grouping', 'fc', 'Per free company', 'One alert when the last sub of a free company is back.') +
      opt('grouping', 'fleet', 'Whole fleet', 'One alert when the last sub of the fleet is back.') +
      '<p class="hint">Now: ' + (auto || 'no free company yet') + '. In the grouped modes, a sub back more than 30 minutes before the rest of its group still gets its own alert.</p></fieldset>' +
      '<fieldset><legend>At night</legend>' + opt('night', 'always', 'Always alert', 'Alerts come whenever a sub is back.') +
      opt('night', 'quiet', 'Quiet hours', 'Alerts that fall in these hours wait until they end; the board still shows the subs as Back.') +
      '<p class="row quiet-hours">From <input class="inp" type="time" name="qfrom" data-pref="qfrom" value="' + hhmm(q.from) + '"> to <input class="inp" type="time" name="qto" data-pref="qto" value="' + hhmm(q.to) + '"></p></fieldset>' +
      '<p class="hint">Works on Android and on computers in Chrome, Edge or Firefox. On an iPhone or iPad, only from the Command Center added to the home screen (Apple\'s rule), turned on there once. Each device is turned on separately, and needs cloud sync signed in once (Tracker, Settings, Cloud sync). Calendar entries keep working either way.</p></section>';
  }
  function pushStatus(msg) {
    var el = $('[data-push-status]'); if (!el) return;
    if (msg) { el.textContent = msg; return; }
    if (!PUSH.supported()) { el.textContent = 'This browser cannot receive web notifications here. On an iPhone or iPad, open the Command Center from the home screen.'; return; }
    if (!PUSH.device()) { el.textContent = 'Not available yet on this device: sign in for cloud sync once in the Tracker (Settings, Cloud sync), then come back here.'; return; }
    PUSH.call('/push/status').then(function (r) {
      el.textContent = (r.on ? 'On for this device.' : 'Off for this device.') + ' ' + r.devices + ' device' + (r.devices === 1 ? '' : 's') + ' turned on. ' + (r.count ? r.count + ' alert' + (r.count === 1 ? '' : 's') + ' scheduled, next ' + F.fmtClock(r.next) + '.' : 'Nothing scheduled.');
    }).catch(function (e) { el.textContent = e.code === 'push_not_set_up' ? 'Your helper does not do notifications yet: the one-time set-up in helper/README.md, section 4, turns them on.' : 'The helper could not be asked: ' + e.message; });
  }

  // the history size meter (design 7.3): the save's compressed size against the cloud copy's 4 MB limit
  var CLOUD_LIMIT = 4 * 1024 * 1024 - 64 * 1024; // as src/core/cloud.js
  function measureSize() {
    var el = $('[data-size]'); if (!el) return;
    CC.read().then(function (r) {
      if (r.raw == null) { el.textContent = 'Nothing saved yet.'; return null; }
      var doc = CC.checkDoc(r.raw);
      return CC.pack(JSON.stringify({ chars: doc.chars, modules: doc.modules })).then(function (z) {
        var bytes = CC.byteLength(z), pct = Math.round(bytes / CLOUD_LIMIT * 1000) / 10, trips = Object.keys(S.trips).length;
        el.innerHTML = 'Whole save, compressed as cloud sync sends it: <b>' + (bytes / 1024 / 1024).toFixed(2) + ' MB</b> of the 4 MB limit (' + pct + '%). ' + trips.toLocaleString('en') + ' logged voyage' + (trips === 1 ? '' : 's') + ' kept.' +
          (pct >= 75 ? ' <b>Over 75%:</b> archiving the oldest years to a file will be offered with the return sheet (step S5); nothing is ever dropped.' : ' Every voyage is kept; at this size there is room for many years.');
      });
    }).catch(function (e) { el.textContent = 'Could not measure: ' + e.message; });
  }
  function setupHtml() {
    var fcs = fcList();
    return '<section class="panel"><h2>Free companies</h2><p class="muted">' + fcs.length + ' set up' + (fcs.length < MAX_SUGGESTED_FCS ? ' (room on the board for ' + MAX_SUGGESTED_FCS + ' side by side; more also work)' : '') + '. Everything stays editable: rename, change rank or parts, move a free company to another character.</p>' +
      '<ul class="fc-list">' + fcs.map(function (f) {
        var n = Object.keys(subsOf(f.id)).length;
        return '<li><span><b>' + esc(f.fc.name || 'Unnamed') + '</b> <span class="muted">' + esc([f.fc.world, charName(f.fc.charId)].filter(Boolean).join(' · ')) + ' · ' + (f.fc.unlockedSlots || 1) + ' of 4 slots unlocked · ' + n + ' sub' + (n === 1 ? '' : 's') + '</span></span>' +
          '<span class="row"><button type="button" class="btn sm" data-act="edit" data-fc="' + esc(f.id) + '">Edit</button><button type="button" class="btn sm ghost" data-act="remove" data-fc="' + esc(f.id) + '">Remove</button></span></li>';
      }).join('') + '</ul><p><button type="button" class="btn primary" data-act="new">Add a free company</button></p></section>' +
      notifyHtml() + accuracyHtml() + '<section class="panel size"><h2>Size of your save</h2><p class="muted" data-size>Measuring…</p></section>' + '<section class="panel"><h2>Backups and other devices</h2><p class="muted">This module is part of the one save. The Tracker\'s Settings make backups and transfer codes and run cloud sync, and they carry your free companies, submarines and voyages too.</p></section>';
  }

  // ------------------------------------------------------------------ guided setup (design 3.6)
  var W = null; // { fcId, step, fc: {...}, subs: [ { id, unlocked, name, rank, parts: [..], voyMode, voyIn, voyAt, voyage } x4 ], disc: Set }
  function startWizard(fcId) {
    var fc = fcId ? S.fcs[fcId] : null, subs = fcId ? subsOf(fcId) : {};
    var ui = {}; try { ui = (JSON.parse(localStorage.getItem('eveniunt-tracker-ui') || '{}') || {}).ui || {}; } catch (e) { /* none */ }
    var liveWorld = ui.live && ui.live.world;
    W = { fcId: fcId || null, step: 0,
      fc: { name: fc ? fc.name || '' : '', world: fc ? fc.world || '' : liveWorld || '', charId: fc ? fc.charId || '' : '' },
      subs: [1, 2, 3, 4].map(function (slot) {
        var e = subs[slot], s = e ? e.sub : null;
        return { id: e ? e.id : null, unlocked: slot === 1 || (fc ? slot <= (fc.unlockedSlots || 1) : false), name: s ? s.name || '' : '', rank: s && s.rank ? s.rank : 1,
          parts: s && s.parts ? s.parts.slice() : [null, null, null, null], voyage: s ? s.voyage : null, voyMode: s && s.voyage ? 'keep' : 'none', voyIn: '', voyAt: '' };
      }),
      disc: new Set(fc && fc.discovered ? fc.discovered : startSectors()) };
    UI.tab = 'setup'; keepUi(); render(); focusWizard();
  }
  function focusWizard() { var el = $('#view .wiz input, #view .wiz select'); if (el) el.focus(); }
  function steps() { var out = ['fc']; for (var i = 0; i < 4; i++) { if (i === 0 || W.subs[i].unlocked || (i > 0 && W.subs[i - 1].unlocked)) out.push('sub' + (i + 1)); if (i > 0 && !W.subs[i].unlocked) break; } out.push('sectors'); return out; }
  function worldOptions(sel) {
    var html = '<option value="">choose</option>', regions = WORLDS.dc || {};
    Object.keys(regions).forEach(function (r) {
      regions[r].dcs.forEach(function (dc) {
        var ws = (WORLDS.worlds || {})[dc] || [];
        if (!ws.length) return;
        html += '<optgroup label="' + esc(dc + ' (' + r + ')') + '">' + ws.map(function (w) { return '<option' + (w[1] === sel ? ' selected' : '') + '>' + esc(w[1]) + '</option>'; }).join('') + '</optgroup>';
      });
    });
    return html;
  }
  function partOptions(slotIdx, rank, sel) {
    var slotName = SLOTS[slotIdx];
    var parts = D.parts.filter(function (p) { return p.slotName === slotName && CLASS[p.class].rank <= rank; })
      .sort(function (a, b) { return CLASS[a.class].rank - CLASS[b.class].rank || a.name.localeCompare(b.name); });
    return '<option value="">not entered</option>' + parts.map(function (p) { return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(CLASS[p.class].name) + ' (' + esc(p.name) + ')</option>'; }).join('');
  }
  function voyageFields(s, i) {
    var now = Date.now(), cur = s.voyage;
    var opts = (cur ? [['keep', 'Keep: ' + (cur.returnAt > now ? 'back ' + F.fmtClock(cur.returnAt, now) : 'back since ' + F.fmtClock(cur.returnAt, now))]] : [])
      .concat([['none', cur ? 'No voyage (remove it)' : 'No voyage'], ['in', 'Back in (as the game shows)'], ['at', 'Back at a date and time']]);
    return '<fieldset class="voy"><legend>Voyage under way</legend>' + opts.map(function (o) { return '<label class="opt"><input type="radio" name="voy' + i + '" value="' + o[0] + '" data-w="voyMode"' + (s.voyMode === o[0] ? ' checked' : '') + '> ' + esc(o[1]) + '</label>'; }).join('') +
      '<div class="voy-in"' + (s.voyMode === 'in' ? '' : ' hidden') + '><input class="inp" data-w="voyIn" value="' + esc(s.voyIn) + '" placeholder="1d 3h 12m or 27:45" autocomplete="off" aria-label="Time left, as the game shows"></div>' +
      '<div class="voy-at"' + (s.voyMode === 'at' ? '' : ' hidden') + '><input class="inp" type="datetime-local" data-w="voyAt" value="' + esc(s.voyAt) + '" aria-label="Return date and time"></div>' +
      '<p class="hint" data-voy-hint></p></fieldset>';
  }
  function wizardHtml() {
    var st = steps(), key = st[Math.min(W.step, st.length - 1)], n = Math.min(W.step, st.length - 1), body = '';
    if (key === 'fc') {
      body = '<h3>Free company</h3>' +
        '<label class="field">Name <input class="inp" data-w="fc.name" maxlength="40" value="' + esc(W.fc.name) + '" placeholder="the name you know it by" autocomplete="off"></label>' +
        '<label class="field">World <select class="inp" data-w="fc.world">' + worldOptions(W.fc.world) + '</select></label>' +
        '<label class="field">Character it belongs to <select class="inp" data-w="fc.charId"><option value="">none</option>' + SH.chars.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === W.fc.charId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        (SH.chars.length ? '' : '<p class="hint">No characters in the save yet; you can link one later.</p>');
    } else if (/^sub/.test(key)) {
      var i = +key.slice(3) - 1, s = W.subs[i];
      body = '<h3>Submarine slot ' + (i + 1) + '</h3>' +
        (i === 0 ? '<p class="hint">Slot 1 is always unlocked.</p>' : '<label class="opt big"><input type="checkbox" data-w="unlocked"' + (s.unlocked ? ' checked' : '') + '> Slot ' + (i + 1) + ' is unlocked in the game</label>' + unlockNote(i + 1));
      if (s.unlocked) {
        body += '<label class="field">Name <input class="inp" data-w="name" maxlength="20" value="' + esc(s.name) + '" placeholder="Sub ' + (i + 1) + '" autocomplete="off"></label>' +
          '<label class="field">Rank <input class="inp" type="number" min="1" max="145" step="1" data-w="rank" value="' + esc(s.rank) + '" inputmode="numeric"></label>' +
          '<fieldset class="parts"><legend>Parts <span class="hint">only classes your rank allows</span></legend>' + SLOTS.map(function (sl, j) {
            return '<label class="field">' + SLOT_NAME[sl] + ' <select class="inp" data-w="part" data-j="' + j + '">' + partOptions(j, s.rank, s.parts[j]) + '</select></label>';
          }).join('') + '</fieldset>' + voyageFields(s, i);
      }
    } else {
      body = '<h3>Sectors already discovered</h3><p class="hint">Tick what this free company has found; discoveries are shared by all its submarines. The first two sectors of the Deep-sea Site are open from the start. The sea map comes in step S4.</p>' +
        unlockNote(0) + D.seas.map(function (sea, k) {
          var list = D.sectors.filter(function (x) { return x.sea === sea.id; });
          var got = list.filter(function (x) { return W.disc.has(x.id); }).length;
          return '<details class="sea"' + (k === 0 ? ' open' : '') + '><summary>' + esc(sea.name) + ' <span class="muted">' + got + ' of ' + list.length + '</span></summary><div class="ticks">' +
            list.map(function (x) { return '<label class="tick"><input type="checkbox" data-w="disc" value="' + x.id + '"' + (W.disc.has(x.id) ? ' checked' : '') + '> <b>' + esc(x.letter) + '</b> ' + esc(x.name.replace(/\s*\([A-Z]\)$/, '')) + ' <span class="muted">rank ' + x.rank + '</span></label>'; }).join('') + '</div></details>';
        }).join('');
    }
    var dots = st.map(function (k, j) { return '<span class="dot' + (j === n ? ' on' : j < n ? ' done' : '') + '">' + (k === 'fc' ? 'FC' : k === 'sectors' ? 'Sectors' : 'Sub ' + k.slice(3)) + '</span>'; }).join('');
    return '<section class="panel wiz" data-step="' + key + '"><header class="wiz-head"><h2>' + (W.fcId ? 'Edit free company' : 'Set up a free company') + '</h2><div class="dots">' + dots + '</div></header>' +
      '<div class="wiz-body">' + body + '</div><p class="wiz-err" role="alert"></p>' +
      '<footer class="wiz-foot"><button type="button" class="btn ghost" data-act="wcancel">Cancel</button><span class="row">' + (n > 0 ? '<button type="button" class="btn" data-act="wback">Back</button>' : '') +
      (key === 'sectors' ? '<button type="button" class="btn primary" data-act="wsave">Save</button>' : '<button type="button" class="btn primary" data-act="wnext">Next</button>') + '</span></footer></section>';
  }
  // which sector grants the next slot, with the source's two notes (design 3.6; data/submarines.json subSlots)
  function unlockNote(slot) {
    var list = slot ? D.subSlots.filter(function (u) { return u.slot === slot; }) : D.subSlots;
    return '<div class="note"><b>' + (slot ? 'What unlocks slot ' + slot : 'What unlocks more slots') + ':</b> ' + list.map(function (u) { var s = SECTOR[u.sector]; return 'slot ' + u.slot + ' by surveying ' + esc(sectorLabel(s)) + ' (' + esc(s.name.replace(/\s*\([A-Z]\)$/, '')) + ', rank ' + s.rank + ')'; }).join('; ') +
      '. Discovery is not certain on every visit, and a new slot only shows once the previous one holds a submarine. <span class="tag" title="Submarine Tracker (MIT), pinned; see Credits">community data</span></div>';
  }
  function readVoyage(s) {
    var now = Date.now();
    if (s.voyMode === 'keep') return { ok: true, voyage: s.voyage };
    if (s.voyMode === 'none') return { ok: true, voyage: null };
    if (s.voyMode === 'in') { var d = F.parseDuration(s.voyIn); return d ? { ok: true, voyage: { sentAt: now, route: [], returnAt: now + d, gameSaid: s.voyIn.trim().slice(0, 40) } } : { ok: false, why: 'Type the time left as the game shows it, for example 1d 3h 12m or 27:45.' }; }
    var t = F.parseBackAt(s.voyAt);
    return t ? { ok: true, voyage: { sentAt: now, route: [], returnAt: t, gameSaid: s.voyAt } } : { ok: false, why: 'Pick the date and time the game shows for the return.' };
  }
  function checkStep() {
    var st = steps(), key = st[Math.min(W.step, st.length - 1)];
    if (key === 'fc' && !W.fc.name.trim()) return 'Give the free company a name.';
    if (/^sub/.test(key)) {
      var s = W.subs[+key.slice(3) - 1];
      if (!s.unlocked) return '';
      if (!(Number.isInteger(+s.rank) && +s.rank >= 1 && +s.rank <= 145)) return 'The rank is a whole number from 1 to 145.';
      var v = readVoyage(s); if (!v.ok) return v.why;
    }
    return '';
  }
  function saveWizard() {
    var fcId = W.fcId || F.newId('f');
    var order = W.fcId ? S.fcs[fcId].order : fcList().reduce(function (m, f) { return Math.max(m, (f.fc.order || 0) + 1); }, 0);
    var unlocked = 1; for (var i = 1; i < 4 && W.subs[i].unlocked; i++) unlocked = i + 1;
    var fc = { name: W.fc.name.trim(), unlockedSlots: unlocked, order: order || 0, discovered: Array.from(W.disc).sort(function (a, b) { return a - b; }), charId: W.fc.charId || null };
    if (W.fc.world) fc.world = W.fc.world;
    S.fcs[fcId] = fc;
    W.subs.forEach(function (s, j) {
      if (!s.unlocked) return; // a slot switched off keeps its sub record; it shows as Locked and nothing is deleted
      var id = s.id || F.newId('s'), prev = S.subs[id] || {};
      var rec = { fcId: fcId, slot: j + 1, name: s.name.trim() || 'Sub ' + (j + 1), rank: +s.rank, voyage: readVoyage(s).voyage || null };
      if (prev.expIntoRank != null) rec.expIntoRank = prev.expIntoRank;
      if (s.parts.every(function (p) { return p && PART[p] && CLASS[PART[p].class].rank <= rec.rank; })) rec.parts = s.parts.slice();
      S.subs[id] = rec;
    });
    W = null; UI.tab = 'board'; keepUi(); schedule();
  }

  // ------------------------------------------------------------------ the sheet (send, details, send all)
  var dlg = null;
  function sheet(html) {
    dlg = $('#sheet');
    dlg.innerHTML = '<form method="dialog" class="sheet-in">' + html + '</form>';
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    var first = dlg.querySelector('input:not([type=radio]), select'); if (first) first.focus();
  }
  function closeSheet() { if (dlg && dlg.open) dlg.close(); }
  function timeFields(prefix, mode, val) {
    return '<div class="seg wide" role="radiogroup" aria-label="How to give the return time"><label><input type="radio" name="' + prefix + 'mode" value="in"' + (mode !== 'at' ? ' checked' : '') + '> Back in</label><label><input type="radio" name="' + prefix + 'mode" value="at"' + (mode === 'at' ? ' checked' : '') + '> Back at</label></div>' +
      '<div data-mode="in"' + (mode === 'at' ? ' hidden' : '') + '><input class="inp big" name="' + prefix + 'in" value="' + esc(mode !== 'at' ? val || '' : '') + '" placeholder="1d 3h 12m or 27:45" autocomplete="off" aria-label="Time left, as the game shows"></div>' +
      '<div data-mode="at"' + (mode === 'at' ? '' : ' hidden') + '><input class="inp big" type="datetime-local" name="' + prefix + 'at" value="' + esc(mode === 'at' ? val || '' : '') + '" aria-label="Return date and time"></div>' +
      '<p class="hint" data-preview>Leave it empty to use the worked-out time.</p>';
  }
  function readTime(form, prefix) {
    var mode = (form.querySelector('input[name=' + prefix + 'mode]:checked') || {}).value || 'in', now = Date.now();
    if (mode === 'in') { var txt = form.elements[prefix + 'in'].value, d = F.parseDuration(txt); return d ? { returnAt: now + d, gameSaid: txt.trim().slice(0, 40) } : null; }
    var v = form.elements[prefix + 'at'].value, t = F.parseBackAt(v); return t ? { returnAt: t, gameSaid: v } : null;
  }
  function previewTime(form, prefix) {
    var p = form.querySelector('[data-preview]'); if (!p) return;
    var r = readTime(form, prefix), now = Date.now();
    var mode = (form.querySelector('input[name=' + prefix + 'mode]:checked') || {}).value || 'in';
    form.querySelectorAll('[data-mode]').forEach(function (el) { el.hidden = el.dataset.mode !== mode; });
    var typed = mode === 'in' ? form.elements[prefix + 'in'].value.trim() : form.elements[prefix + 'at'].value;
    p.className = 'hint' + (!r && typed ? ' bad' : '');
    p.textContent = r ? (r.returnAt <= now ? 'That time has already passed: the sub will show as Back.' : 'Back ' + F.fmtClock(r.returnAt, now) + ', in ' + F.fmtDur(r.returnAt - now, true) + '. From the game (typed); this time is used.')
      : typed ? (mode === 'in' ? 'Not read. Write it as the game shows it, for example 1d 3h 12m, 3h 5m or 27:45.' : 'Pick a date and a time.') : 'Leave it empty to use the worked-out time.';
  }
  // ------------------------------------------------------------------ worked-out voyages and the route picker
  // The sub's build gives its stats; the route the owner taps together gives range, return time, tanks and experience,
  // worked out again on every tap (advisor.js; community formula, "calculated, not yet confirmed" until the owner's game
  // times agree). An optional "The game says…" time overrides the worked-out one for that voyage and is kept as evidence.
  var PICK = null; // { id, route: [sector ids], sea }
  function subStats(s) { return ADV.stats(s.rank, s.parts); }
  function pendingFor(subId) { // sectors already on the other subs' voyages of the same free company
    var s = S.subs[subId], out = [], now = Date.now();
    Object.keys(S.subs).forEach(function (k) { var x = S.subs[k]; if (k !== subId && x.fcId === s.fcId && x.voyage && x.voyage.returnAt > now) out = out.concat(x.voyage.route || []); });
    return out;
  }
  function slotsFilled(fcId) { return Object.keys(subsOf(fcId)).length; }
  var ADVICE = {};
  function adviceFor(subId) {
    var s = S.subs[subId], fc = s && S.fcs[s.fcId]; if (!fc) return null;
    // a sub that is back is planned at the rank its voyage brings it to, so the button sends what it shows
    if (s.voyage && s.voyage.returnAt <= Date.now()) { var up = ADV.afterVoyage(s, s.voyage.route); if (up) s = Object.assign({}, s, { rank: up.rank, expIntoRank: up.into }); }
    var key = JSON.stringify([s.rank, s.parts, fc.unlockedSlots, fc.discovered, pendingFor(subId), slotsFilled(s.fcId)]);
    if (ADVICE[subId] && ADVICE[subId].key === key) return ADVICE[subId].value;
    var v = ADV.advise({ sub: s, fc: fc, pending: pendingFor(subId), slotsFilled: slotsFilled(s.fcId) });
    ADVICE[subId] = { key: key, value: v };
    return v;
  }
  // how far the worked-out times are confirmed: voyages and trips where the owner also entered the game's time
  function confirmation() {
    var agree = 0, differ = 0;
    var look = function (calc, back, said) { if (calc && said && back) { if (Math.abs(back - calc) <= 60000) agree++; else differ++; } };
    Object.keys(S.trips).forEach(function (k) { var t = S.trips[k]; look(t.calc, t.back, t.said); });
    Object.keys(S.subs).forEach(function (k) { var v = S.subs[k].voyage; if (v) look(v.calcAt, v.returnAt, v.gameSaid); });
    var ok = agree >= 10 && differ === 0;
    return { agree: agree, differ: differ, ok: ok, text: ok ? 'calculated, confirmed by ' + agree + ' of your game times' : 'calculated, not yet confirmed (' + agree + ' of 10 game times agree' + (differ ? ', ' + differ + ' differ' : '') + ')' };
  }
  function figures(ev, s, now) {
    var after = ADV.rankAfter(s.rank, s.expIntoRank || 0, ev.exp);
    return 'Back <b>' + esc(F.fmtClock(now + ev.seconds * 1000, now)) + '</b> (in ' + F.fmtDur(ev.seconds * 1000, true) + ') · range ' + ev.range + ' of ' + ev.maxRange + ' · ' + ev.tanks + ' tank' + (ev.tanks === 1 ? '' : 's') +
      ' · at least ' + ev.exp.toLocaleString('en') + ' exp' + (after.rank > s.rank ? ', rank at least ' + after.rank : '');
  }
  function adviceHtml(id) {
    var s = S.subs[id], a = adviceFor(id), now = Date.now();
    if (!a) return '';
    if (a.blocked) return '<div class="advice"><p class="hint">' + esc(a.blocked) + '</p></div>';
    var alt = (a.alts || []).map(function (x, i) { return '<li><button type="button" class="link" data-use="' + x.route.join(',') + '">' + esc(ADV.routeText(x.route)) + '</button> <span class="muted">back ' + esc(F.fmtClock(now + x.ev.seconds * 1000, now)) + '</span></li>'; }).join('');
    return '<div class="advice"><p class="advice-step">Suggested · step ' + a.step + ' of 3: ' + esc(a.stepName) + (a.goal ? ' <span class="muted">(' + esc(a.goal) + ')</span>' : '') + '</p>' +
      '<p class="advice-route"><b>' + esc(ADV.routeText(a.plan.route)) + '</b> <button type="button" class="btn primary" data-act="quick" data-sub="' + esc(id) + '">Send on this route</button> <button type="button" class="btn sm" data-use="' + a.plan.route.join(',') + '">Change it first</button></p>' +
      '<p class="hint">' + esc(a.plan.why) + '</p><p class="hint">' + figures(a.plan.ev, s, now) + '</p>' +
      (alt ? '<details><summary class="hint">Other routes</summary><ul class="alts">' + alt + '</ul></details>' : '') +
      (a.parts ? '<p class="note">' + esc(a.parts.why) + '</p>' : '') + (a.note ? '<p class="note">' + esc(a.note) + '</p>' : '') + '</div>';
  }
  function pickerHtml() {
    var s = S.subs[PICK.id], fc = S.fcs[s.fcId], disc = new Set(fc.discovered || []), now = Date.now();
    var seas = D.seas.filter(function (sea) { return D.sectors.some(function (x) { return x.sea === sea.id && disc.has(x.id); }); });
    if (!seas.length) return '<p class="hint">No discovered sectors entered for this free company (Setup → Sectors).</p>';
    if (!PICK.sea || !seas.some(function (x) { return x.id === PICK.sea; })) PICK.sea = PICK.route.length ? SECTOR[PICK.route[0]].sea : seas[0].id;
    var st = subStats(s), ev = st && PICK.route.length ? ADV.evalRoute(PICK.route, st) : null;
    var btns = D.sectors.filter(function (x) { return x.sea === PICK.sea && disc.has(x.id); }).map(function (x) {
      var n = PICK.route.indexOf(x.id), low = s.rank && x.rank > s.rank, full = n < 0 && PICK.route.length >= 5;
      return '<button type="button" class="sector' + (n >= 0 ? ' on' : '') + '" data-pick="' + x.id + '"' + (low || full ? ' disabled' : '') + ' title="' + esc(x.name + ', rank ' + x.rank + (low ? ' (rank too low)' : '')) + '">' +
        (n >= 0 ? '<span class="ord">' + (n + 1) + '</span>' : '') + '<b>' + esc(x.letter) + '</b><span>' + esc(x.name.replace(/\s*\([A-Z]\)$/, '')) + '</span><small>rank ' + x.rank + '</small></button>';
    }).join('');
    var calc = '';
    if (!PICK.route.length) calc = '<p class="hint">Tap sectors in the order the sub should visit them (up to 5). The time is worked out as you go.</p>';
    else if (!st) calc = '<p class="hint bad">Enter this sub\'s rank and four parts in Setup so the time can be worked out; until then, type the game\'s time below.</p>';
    else if (!ev.reachable) calc = '<p class="hint bad">Out of range: this route needs range ' + ev.range + ', the build has ' + ev.maxRange + '. Drop a sector or change the order.</p>';
    else calc = '<p class="calc-line">' + figures(ev, s, now) + '</p><p class="hint"><span class="tag">' + esc(confirmation().text) + '</span></p>';
    return '<div class="picker"><label class="field">Sea <select class="inp" name="sea">' + seas.map(function (x) { return '<option value="' + x.id + '"' + (x.id === PICK.sea ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="sectors">' + btns + '</div>' +
      '<p class="route-line">Route: ' + (PICK.route.length ? '<b>' + esc(ADV.routeText(PICK.route)) + '</b> <button type="button" class="link" data-act="pickclear">Clear</button>' : '<span class="muted">none yet</span>') + '</p>' + calc + '</div>';
  }
  function redrawPicker() { var box = $('#sheet [data-picker]'); if (box) box.innerHTML = pickerHtml(); }
  function readRoute() { return PICK ? PICK.route.slice() : []; }
  // the voyage to store for this send: worked out when possible; the game's time, if entered, wins and is kept
  function planVoyage(form, sentAt) {
    var s = S.subs[PICK.id], st = subStats(s), route = readRoute(), ev = st && route.length ? ADV.evalRoute(route, st) : null;
    var calcAt = ev && ev.reachable ? sentAt + ev.seconds * 1000 : null;
    var game = readTime(form, 't');
    if (!calcAt && !game) return { error: !route.length ? 'Tap the route first.' : !st ? 'Enter the rank and parts in Setup, or type the time the game shows.' : 'That route is out of range.' };
    var v = { sentAt: sentAt, route: route, returnAt: game ? game.returnAt : calcAt };
    if (calcAt) v.calcAt = calcAt;
    if (game) v.gameSaid = game.gameSaid;
    return { voyage: v, differs: game && calcAt && Math.abs(game.returnAt - calcAt) > 60000 ? Math.round((game.returnAt - calcAt) / 60000) : 0 };
  }
  // the voyage that ended becomes a trip (S5 fills in what came back) and the voyage is cleared; the sub's rank and
  // experience move on by the route's base experience ("at least"), or to the rank the owner says the game shows
  function logTrip(subId, rankFix) {
    var s = S.subs[subId], v = s && s.voyage;
    if (!v) return;
    var t = v.sentAt || v.returnAt;
    var trip = { s: subId, t: t, r: (v.route || []).slice(), back: v.returnAt, items: [], newSectors: [] };
    if (v.calcAt) trip.calc = v.calcAt;
    if (v.gameSaid) trip.said = v.gameSaid;
    var after = ADV.afterVoyage(s, v.route);
    if (after) {
      trip.rankCalc = after.rank;
      if (rankFix && rankFix !== after.rank && rankFix >= s.rank && rankFix <= 145) { s.rank = rankFix; s.expIntoRank = 0; }
      else { s.rank = after.rank; s.expIntoRank = after.into; }
      trip.rankAfter = s.rank;
    } else if (rankFix && rankFix >= (s.rank || 1) && rankFix <= 145) { s.rank = rankFix; s.expIntoRank = 0; trip.rankAfter = rankFix; }
    S.trips[F.tripId(subId, t)] = trip;
    s.voyage = null;
  }
  function openSub(id) {
    var s = S.subs[id], fc = s && S.fcs[s.fcId]; if (!fc) return;
    var now = Date.now(), st = F.status(s, fc, now), v = s.voyage, name = esc((s.name || 'Sub ' + s.slot) + ' · ' + (fc.name || ''));
    if (st === 'out') {
      sheet('<h2>' + name + '</h2><dl class="facts"><dt>Back</dt><dd>' + esc(F.fmtClock(v.returnAt, now)) + ', in ' + F.fmtDur(v.returnAt - now, true) + ' <span class="tag">' + (v.gameSaid ? 'from the game (typed)' : esc(confirmation().text)) + '</span></dd>' +
        (v.calcAt && v.gameSaid && Math.abs(v.calcAt - v.returnAt) > 60000 ? '<dt>Worked out</dt><dd>' + esc(F.fmtClock(v.calcAt, now)) + ' (the game\'s time is used)</dd>' : '') +
        (v.gameSaid ? '<dt>You typed</dt><dd>' + esc(v.gameSaid) + '</dd>' : '') + (v.sentAt ? '<dt>Sent</dt><dd>' + esc(F.fmtClock(v.sentAt, now)) + '</dd>' : '') + (v.route && v.route.length ? '<dt>Route</dt><dd>' + esc(routeText(v.route)) + '</dd>' : '') + '</dl>' +
        (v.calcAt && !v.gameSaid ? '<details class="game-says"><summary>Check against the game <span class="muted">(optional: type the time the game shows)</span></summary>' + timeFields('t', 'in', '') + '<p><button type="button" class="btn" data-act="check" data-sub="' + esc(id) + '">Check</button></p></details><p class="wiz-err" data-err role="alert"></p>' : '') +
        '<div class="sheet-actions"><button type="button" class="btn primary" data-act="ics" data-sub="' + esc(id) + '">Add to calendar</button><button type="button" class="btn" data-act="retime" data-sub="' + esc(id) + '">Change this voyage</button>' +
        '<button type="button" class="btn ghost" data-act="unsend" data-sub="' + esc(id) + '">Remove this voyage (sent by mistake)</button><button type="button" class="btn ghost" data-act="close">Close</button></div>');
      return;
    }
    if (st === 'locked') return;
    sendSheet(id, false);
  }
  function sendSheet(id, retime) {
    var s = S.subs[id], fc = S.fcs[s.fcId], now = Date.now(), st = F.status(s, fc, now), v = s.voyage;
    PICK = { id: id, route: retime && v ? (v.route || []).slice() : [], sea: null };
    var head = retime ? 'Change this voyage' : 'Send ' + (s.name || 'Sub ' + s.slot);
    sheet('<h2>' + esc(head) + ' <span class="muted">' + esc(fc.name || '') + ' · rank ' + (s.rank || '?') + ' · ' + partsCode(s.parts) + '</span></h2>' +
      (st === 'back' && !retime ? '<p class="note">Back since ' + esc(F.fmtClock(v.returnAt, now)) + '. Sending again logs that voyage in the history (what it brought back is entered from step S5).</p>' + rankField(id) : '') +
      (retime ? '' : adviceHtml(id)) + '<div data-picker>' + pickerHtml() + '</div>' +
      '<details class="game-says"' + (!subStats(s) ? ' open' : '') + '><summary>The game says… <span class="muted">(optional: type the game\'s return time to check the worked-out one)</span></summary>' + timeFields('t', 'in', '') + '</details>' +
      '<p class="wiz-err" data-err role="alert"></p><div class="sheet-actions"><button type="button" class="btn primary" data-act="' + (retime ? 'dore' : 'dosend') + '" data-sub="' + esc(id) + '">' + (retime ? 'Save' : st === 'back' ? 'Send again' : 'Send') + '</button>' +
      (st === 'back' && !retime ? '<button type="button" class="btn" data-act="collect" data-sub="' + esc(id) + '">Collected, not sent</button>' : '') +
      '<button type="button" class="btn ghost" data-act="close">Cancel</button></div><p class="hint">Rank moves on by itself when a voyage is logged (at least the base experience); if the game shows a higher rank, enter it above.</p>');
    previewTime($('#sheet form'), 't');
  }
  // suggestions for several subs sent together: each one counts the routes already given to the ones before it, so
  // subs looking for new sectors split the discoveries instead of all taking the same route
  function planAll(ids) {
    var taken = [], out = {};
    ids.forEach(function (id) {
      var s = S.subs[id], fc = S.fcs[s.fcId];
      if (s.voyage && s.voyage.returnAt <= Date.now()) { var up = ADV.afterVoyage(s, s.voyage.route); if (up) s = Object.assign({}, s, { rank: up.rank, expIntoRank: up.into }); }
      var a = ADV.advise({ sub: s, fc: fc, pending: pendingFor(id).concat(taken), slotsFilled: slotsFilled(s.fcId) });
      out[id] = a;
      if (a && a.plan) taken = taken.concat(a.plan.route);
    });
    return out;
  }
  // one press: send this sub on its suggested route, with the worked-out return time
  function quickSend(id, rankFix) {
    var s = S.subs[id], now = Date.now();
    if (!s) return;
    if (s.voyage && s.voyage.returnAt <= now) logTrip(id, rankFix); // the rank moves on first, so the suggestion fits it
    var a = adviceFor(id);
    if (!a || !a.plan) { schedule(); openSub(id); return; }
    s.voyage = { sentAt: now, route: a.plan.route.slice(), returnAt: now + a.plan.ev.seconds * 1000, calcAt: now + a.plan.ev.seconds * 1000 };
    closeSheet(); schedule();
    setStatus((s.name || 'Sub ' + s.slot) + ' sent: ' + ADV.routeText(a.plan.route) + ', back ' + F.fmtClock(s.voyage.returnAt, now) + '.');
  }
  // after a voyage: the rank worked out ("at least"), and a field to put the rank the game shows if it is higher
  function rankField(id) {
    var s = S.subs[id], a = s.voyage && ADV.afterVoyage(s, s.voyage.route);
    if (!a) return '<label class="field rankfix">Rank the game shows now <input class="inp" type="number" name="rankfix" min="' + (s.rank || 1) + '" max="145" value="' + (s.rank || '') + '" inputmode="numeric"></label>';
    return '<div class="rankbox"><p>This voyage gave at least <b>' + a.exp.toLocaleString('en') + '</b> experience: rank <b>' + (a.rank > s.rank ? s.rank + ' → at least ' + a.rank : 'at least ' + a.rank + ' (no rank up)') + '</b>.</p>' +
      '<label class="field rankfix">Rank the game shows, if higher <input class="inp" type="number" name="rankfix" min="' + a.rank + '" max="145" value="' + a.rank + '" inputmode="numeric"></label></div>';
  }
  function readRankFix(form) { var el = form && form.elements.rankfix; var n = el ? Math.round(+el.value) : 0; return Number.isInteger(n) && n >= 1 ? n : 0; }
  function sendAllSheet(fcId) {
    var fc = S.fcs[fcId], subs = subsOf(fcId), now = Date.now();
    var list = Object.keys(subs).map(function (k) { return subs[k]; }).filter(function (e) { var st = F.status(e.sub, fc, now); return st === 'back' || st === 'idle'; });
    var plans = planAll(list.map(function (e) { return e.id; }));
    sheet('<h2>Send all back subs <span class="muted">' + esc(fc.name || '') + '</span></h2><p class="hint">Each goes on its suggested route, with its own worked-out time. Subs that are back have their voyage logged first. Change any one by tapping it on the board instead.</p>' +
      '<div class="pick">' + list.map(function (e) {
        var st = F.status(e.sub, fc, now), a = plans[e.id], plan = a && a.plan;
        return '<label class="opt"><input type="checkbox" name="pick" value="' + esc(e.id) + '" checked> ' + esc(e.sub.name || 'Sub ' + e.sub.slot) + ' <span class="chip ' + st + '">' + F.LABEL[st] + '</span> <span class="muted">' +
          (plan ? esc(ADV.routeText(plan.route)) + ' · back ' + esc(F.fmtClock(now + plan.ev.seconds * 1000, now)) : esc(a && a.blocked ? 'needs rank and parts: uses the time typed below' : 'no route')) + '</span></label>';
      }).join('') + '</div>' +
      '<details class="game-says"><summary>The game says… <span class="muted">(only for subs without rank and parts)</span></summary>' + timeFields('t', 'in', '') + '</details>' +
      '<p class="wiz-err" data-err role="alert"></p><div class="sheet-actions"><button type="button" class="btn primary" data-act="dosendall" data-fc="' + esc(fcId) + '">Send</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div>');
    previewTime($('#sheet form'), 't');
  }
  function sheetError(text) { var p = $('#sheet [data-err]'); if (p) p.textContent = text; }
  function calendar(title, at, uid) {
    F.download(F.fileName(title), F.ics({ title: title, at: at, uid: uid, note: 'Return time typed from the game in the Eveniunt Command Center (Submersibles).' }));
  }

  // ------------------------------------------------------------------ events
  function onClick(e) {
    var qk = e.target.closest('[data-quick]');
    if (qk) { quickSend(qk.dataset.quick); return; }
    var pk = e.target.closest('[data-pick], [data-use]');
    if (pk && PICK) {
      if (pk.dataset.use) { PICK.route = pk.dataset.use.split(',').map(Number); PICK.sea = SECTOR[PICK.route[0]].sea; }
      else { var sid = +pk.dataset.pick, at = PICK.route.indexOf(sid); if (at >= 0) PICK.route.splice(at, 1); else if (PICK.route.length < 5) PICK.route.push(sid); }
      redrawPicker(); return;
    }
    var b = e.target.closest('[data-act], [data-tab], [data-sort], .sub[data-sub]');
    if (!b) return;
    if (b.dataset.tab) { UI.tab = b.dataset.tab; keepUi(); render(); return; }
    if (b.dataset.sort) { S.settings.prefs = Object.assign({}, S.settings.prefs || {}, { sort: b.dataset.sort }); schedule(); return; }
    var act = b.dataset.act;
    if (!act && b.dataset.sub) { openSub(b.dataset.sub); return; }
    var form = $('#sheet form'), now = Date.now();
    switch (act) {
      case 'new': startWizard(null); break;
      case 'edit': closeSheet(); startWizard(b.dataset.fc); break;
      case 'remove': {
        var fc = S.fcs[b.dataset.fc];
        if (!fc || !confirm('Remove “' + (fc.name || 'this free company') + '” and its submarines from the board? Logged voyages stay in the history.')) break;
        Object.keys(S.subs).forEach(function (id) { if (S.subs[id].fcId === b.dataset.fc) delete S.subs[id]; });
        delete S.fcs[b.dataset.fc]; schedule(); break;
      }
      case 'sound': F.setDeviceSubs(function (s) { s.sound = !s.sound; }); if (F.deviceSubs().sound) { F.unlockSound(); F.chime(); } render(); break;
      case 'close': closeSheet(); break;
      case 'wcancel': W = null; render(); break;
      case 'wback': W.step = Math.max(0, W.step - 1); render(); focusWizard(); break;
      case 'wnext': { var err = checkStep(); if (err) { $('.wiz-err').textContent = err; break; } W.step++; render(); focusWizard(); break; }
      case 'wsave': saveWizard(); break;
      case 'dosend': case 'dore': {
        var id = b.dataset.sub, s = S.subs[id];
        var sentAt = act === 'dore' && s.voyage && s.voyage.sentAt ? s.voyage.sentAt : now;
        var plan = planVoyage(form, sentAt);
        if (plan.error) { sheetError(plan.error); break; }
        if (act === 'send' || act === 'dosend') { if (s.voyage) logTrip(id, readRankFix(form)); }
        s.voyage = plan.voyage;
        if (plan.differs) setStatus('The game\'s time differs from the worked-out one by ' + plan.differs + ' min; the game\'s time is used and kept as evidence.');
        closeSheet(); schedule(); break;
      }
      case 'collect': logTrip(b.dataset.sub, readRankFix(form)); closeSheet(); schedule(); break;
      case 'unsend': if (confirm('Remove this voyage? Nothing is logged for it.')) { S.subs[b.dataset.sub].voyage = null; closeSheet(); schedule(); } break;
      case 'retime': sendSheet(b.dataset.sub, true); break;
      case 'ics': { var sub = S.subs[b.dataset.sub], f = S.fcs[sub.fcId]; calendar((f.name || 'Free company') + ' · ' + (sub.name || 'Sub ' + sub.slot) + ' back', sub.voyage.returnAt, b.dataset.sub + '-' + sub.voyage.returnAt); break; }
      case 'ics-fc': {
        var fcx = S.fcs[b.dataset.fc], all = subsOf(b.dataset.fc), last = null;
        Object.keys(all).forEach(function (k) { var x = all[k].sub; if (F.status(x, fcx, now) === 'out' && (!last || x.voyage.returnAt > last.voyage.returnAt)) last = x; });
        if (last) calendar((fcx.name || 'Free company') + ' · last sub back (' + (last.name || 'Sub ' + last.slot) + ')', last.voyage.returnAt, b.dataset.fc + '-last-' + last.voyage.returnAt);
        break;
      }
      case 'sendall': sendAllSheet(b.dataset.fc); break;
      case 'dosendall': {
        var picks = $$('input[name=pick]:checked', form).map(function (x) { return x.value; }), t = readTime(form, 't');
        if (!picks.length) { sheetError('Pick at least one submarine.'); break; }
        picks.forEach(function (pid) { var x = S.subs[pid]; if (x && x.voyage) logTrip(pid); }); // ranks move on first
        var plans = planAll(picks);
        var missing = picks.filter(function (pid) { var a = plans[pid]; return !(a && a.plan); });
        if (missing.length && !t) { sheetError('Some subs have no worked-out route: type the time the game shows for them.'); break; }
        picks.forEach(function (pid) {
          var x = S.subs[pid]; if (!x) return;
          var a = plans[pid];
          x.voyage = a && a.plan ? { sentAt: now, route: a.plan.route.slice(), returnAt: now + a.plan.ev.seconds * 1000, calcAt: now + a.plan.ev.seconds * 1000 } : { sentAt: now, route: [], returnAt: t.returnAt, gameSaid: t.gameSaid };
        });
        closeSheet(); schedule(); break;
      }
      case 'pickclear': PICK.route = []; redrawPicker(); break;
      case 'quick': quickSend(b.dataset.sub, readRankFix(form)); break;
      case 'push-on': pushStatus('Turning on…'); PUSH.enable().then(function () { try { sessionStorage.removeItem('eveniunt-subs-push'); } catch (e) { /* none */ } pushSync(); pushStatus(); }).catch(function (e) { pushStatus(e.message); }); break;
      case 'push-off': PUSH.disable().then(function () { pushStatus(); }).catch(function (e) { pushStatus(e.message); }); break;
      case 'push-test': PUSH.call('/push/test').then(function () { pushStatus('Test sent: it should arrive within a few seconds.'); }).catch(function (e) { pushStatus(e.message); }); break;
      case 'check': {
        var cs = S.subs[b.dataset.sub], game = readTime(form, 't');
        if (!cs || !cs.voyage) break;
        if (!game) { sheetError('Type the time the game shows, for example 1d 3h 12m or 27:45.'); break; }
        if (!cs.voyage.calcAt) cs.voyage.calcAt = cs.voyage.returnAt;
        cs.voyage.returnAt = game.returnAt; cs.voyage.gameSaid = game.gameSaid;
        var diff = Math.round((game.returnAt - cs.voyage.calcAt) / 60000);
        setStatus(Math.abs(game.returnAt - cs.voyage.calcAt) <= 60000 ? 'The game agrees with the worked-out time (within a minute).' : 'The game\'s time differs by ' + diff + ' min; the game\'s time is used and kept as evidence.');
        closeSheet(); schedule(); break;
      }
    }
  }
  function onInput(e) {
    var t = e.target;
    if (t.closest('#sheet')) {
      if (t.name === 'sea') { if (PICK && e.type === 'change') { PICK.sea = +t.value; if (PICK.route.length && SECTOR[PICK.route[0]].sea !== PICK.sea) PICK.route = []; redrawPicker(); } return; }
      previewTime($('#sheet form'), 't');
      if (/^t(in|at|mode)$/.test(t.name)) redrawPicker();
      return;
    }
    if (t.dataset.pref && e.type === 'change') {
      var pr = Object.assign({}, S.settings.prefs || {});
      if (t.dataset.pref === 'grouping') pr.grouping = t.value;
      else if (t.dataset.pref === 'night') pr.night = t.value;
      else { var q = Object.assign({ from: 22 * 60, to: 8 * 60 }, pr.quietHours || {}), m = minutes(t.value); if (m == null) return; q[t.dataset.pref === 'qfrom' ? 'from' : 'to'] = m; pr.quietHours = q; }
      S.settings.prefs = pr; schedule(); return;
    }
    if (!W || !t.dataset.w) return;
    var key = t.dataset.w, st = steps(), step = st[Math.min(W.step, st.length - 1)], s = /^sub/.test(step) ? W.subs[+step.slice(3) - 1] : null;
    if (key === 'fc.name') W.fc.name = t.value;
    else if (key === 'fc.world') W.fc.world = t.value;
    else if (key === 'fc.charId') W.fc.charId = t.value;
    else if (key === 'disc') { if (t.checked) W.disc.add(+t.value); else W.disc.delete(+t.value); var sum = t.closest('details').querySelector('summary .muted'); var all = t.closest('.ticks').querySelectorAll('input'); sum.textContent = Array.prototype.filter.call(all, function (x) { return x.checked; }).length + ' of ' + all.length; }
    else if (s && key === 'unlocked') { s.unlocked = t.checked; if (!t.checked) for (var k = W.subs.indexOf(s) + 1; k < 4; k++) W.subs[k].unlocked = false; render(); }
    else if (s && key === 'name') s.name = t.value;
    else if (s && key === 'rank') {
      s.rank = t.value === '' ? '' : +t.value;
      if (e.type === 'change' && Number.isInteger(s.rank) && s.rank >= 1) { // refresh the parts lists for the new rank
        $$('select[data-w=part]').forEach(function (sel) { var j = +sel.dataset.j; sel.innerHTML = partOptions(j, s.rank, s.parts[j]); s.parts[j] = sel.value ? +sel.value : null; });
      }
    }
    else if (s && key === 'part') s.parts[+t.dataset.j] = t.value ? +t.value : null;
    else if (s && key === 'voyMode') { s.voyMode = t.value; var fs = t.closest('fieldset'); fs.querySelector('.voy-in').hidden = t.value !== 'in'; fs.querySelector('.voy-at').hidden = t.value !== 'at'; voyHint(s, fs); }
    else if (s && key === 'voyIn') { s.voyIn = t.value; voyHint(s, t.closest('fieldset')); }
    else if (s && key === 'voyAt') { s.voyAt = t.value; voyHint(s, t.closest('fieldset')); }
  }
  function voyHint(s, fs) {
    var p = fs.querySelector('[data-voy-hint]'), r = readVoyage(s), now = Date.now();
    if (s.voyMode === 'in' || s.voyMode === 'at') p.textContent = r.ok && r.voyage ? 'Back ' + F.fmtClock(r.voyage.returnAt, now) + (r.voyage.returnAt > now ? ', in ' + F.fmtDur(r.voyage.returnAt - now, true) : ' (already back)') + '. From the game (typed).' : (s.voyMode === 'in' && s.voyIn.trim()) || (s.voyMode === 'at' && s.voyAt) ? r.why : '';
    else p.textContent = '';
  }

  // ------------------------------------------------------------------ the clock: countdowns every second, a redraw when a status changes
  function tick() {
    if (!D || UI.tab !== 'board') return;
    if (statusKey() !== lastStatus) { if (!(dlg && dlg.open)) render(); return; }
    var now = Date.now();
    $$('[data-until]').forEach(function (el) { el.textContent = F.fmtDur(+el.dataset.until - now, true); });
    $$('[data-since]').forEach(function (el) { el.textContent = F.fmtDur(now - +el.dataset.since); });
  }

  // ------------------------------------------------------------------ start
  function credits() {
    var src = D.sources, el = $('#credits-body');
    if (!el) return;
    el.innerHTML = Object.keys(src).map(function (k) {
      var x = src[k];
      return '<p><b>' + esc(x.repo) + '</b> at ' + esc(String(x.commit).slice(0, 8)) + (x.version ? ' (game ' + esc(x.version) + ')' : '') + ', ' + esc(x.kind) + (x.licence ? ', ' + esc(x.licence) + ' licence' : '') + '. ' + esc(x.notice || '') + '</p>' +
        (x.permission ? '<details><summary>Licence text</summary><pre>' + esc(x.permission) + '</pre></details>' : '');
    }).join('');
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  document.addEventListener('submit', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) { var r = e.target; if ((e.key === 'Enter' || e.key === ' ') && r.classList && r.classList.contains('sub') && r.dataset.sub) { e.preventDefault(); openSub(r.dataset.sub); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.closest && e.target.closest('#sheet') && e.target.tagName === 'INPUT') { e.preventDefault(); var p = $('#sheet .btn.primary'); if (p) p.click(); } });
  if (CC) CC.onChange(reload);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && SH.timer) write(); else if (document.visibilityState === 'visible') { reload(); tick(); } });
  window.addEventListener('pagehide', function () { if (SH.timer) write(); });
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () { /* works without offline support */ });

  Promise.all([loadData(), loadSave()]).then(function () {
    credits(); render();
    window.__subs.alerts = F.startAlerts({ section: function () { return SH.ready ? S : null; }, link: null });
    pushSync();
    setInterval(tick, 1000);
    document.documentElement.dataset.ready = '1';
  }).catch(function (e) {
    $('#view').innerHTML = '<div class="note bad"><b>The Submersibles data could not be opened on this browser.</b> ' + esc(e.message || e) + '</div>';
  });
  window.__subs = { stageOf: function (id) { return stageOf(id); }, section: function () { return S; }, write: write, startWizard: startWizard, state: function () { return { ready: SH.ready, problem: SH.problem, rev: SH.rev }; } };
})();
