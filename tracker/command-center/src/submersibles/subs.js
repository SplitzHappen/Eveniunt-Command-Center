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
  var RECS_NAME = window.RECS.NAME;
  var CC = window.CC, F = window.FLEET, ADV = window.ADVISOR, PUSH = window.PUSH, EARN = window.EARN, CHART = window.CHART, TL = window.TL;
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
      D = d; ADV.init(d); EARN.init(d); CHART.init(d);
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
  var SH = { rev: null, base: null, ready: false, timer: null, problem: null, chars: [], editSeq: 0 };
  var S = { fcs: {}, subs: {}, trips: {}, settings: {} };
  // The player's recommendation settings: a save section of their own (spec sections 6 and 10), one stored key per control. The write
  // path is RECS.keeper (recs.js); the page keeps only what the panel needs. Nothing is written until a setting changes; RECS.check only reads.
  var RC = { k: null, choices: null, shown: null, live: '', focus: null, find: ['', '', '', '', ''], items: null };
  function recsRead(doc, rev) { RC.k.read(doc.modules[RECS_NAME], rev); RC.choices = null; }
  function recsNow() { if (RC.choices) return RC.choices; var c = window.RECS.check(RC.k.raw, D); if (D) RC.choices = c; return c; }
  // after every write attempt: success tells the other pages; a failure drops the changes it carried (the panel returns to the last saved settings)
  function recsDone(res) {
    RC.choices = null;
    if (res.ok) pushSync();
    else {
      var msg = res.error && res.error.message ? res.error.message : String(res.error);
      RC.live = 'Not saved. The panel shows the last saved settings again.';
      var live = $('[data-recs-live]'); if (live) live.textContent = RC.live;
      setStatus('Recommendation settings not saved on this device: ' + msg + ' The panel shows the last saved settings again; make the change again if you still want it.');
    }
    if (JSON.stringify(recsNow()) !== RC.shown) redrawRecs();
    if (!res.ok || res.merged) render(); // the shown-companies choice may have changed under it
  }
  RC.k = window.RECS.keeper(function (section, known) {
    return CC.writeSection(RECS_NAME, section, known).then(function (r) { SH.updated = r.doc.updated || Date.now(); return r; });
  }, recsDone);
  function emptySection() { return { fcs: {}, subs: {}, trips: {}, settings: {} }; }
  function setSection(sec) { S = sec ? JSON.parse(JSON.stringify(sec)) : emptySection(); ['fcs', 'subs', 'trips', 'settings'].forEach(function (k) { if (!S[k]) S[k] = {}; }); }
  function loadSave() {
    return CC.read().then(function (r) {
      var doc = CC.emptyDoc();
      if (r.raw != null) {
        try { doc = CC.checkDoc(r.raw); } catch (e) { SH.problem = e.message; return; } // unreadable or newer: never written over
      }
      SH.rev = r.rev; SH.chars = doc.chars; SH.updated = doc.updated || 0; SH.notify = (doc.modules.settings && doc.modules.settings.notify) || null;
      SH.base = doc.modules.submersibles ? JSON.parse(JSON.stringify(doc.modules.submersibles)) : null;
      setSection(doc.modules.submersibles);
      recsRead(doc, r.rev);
      SH.ready = true;
      return foldBare();
    }).catch(function (e) { SH.problem = e.message; });
  }
  // Bare duplicate free companies of one character (added in two tabs or on two devices) are dropped as the section is taken
  // in and the change is stored through the page's own write; a second pass removes nothing.
  function foldBare() {
    var editAtStart = SH.editSeq;
    return CC.foldSection('submersibles', F.foldFcs).then(function (r) {
      if (r.doc) {
        // A pending local edit is newer than this asynchronous cleanup result; retain it and let its queued write merge.
        if (!SH.timer && SH.editSeq === editAtStart) {
          SH.rev = r.rev; SH.base = JSON.parse(JSON.stringify(r.section)); SH.chars = r.doc.chars; SH.updated = r.doc.updated || Date.now();
          setSection(r.section);
        }
      }
      return r;
    }).catch(function (e) {
      setStatus('Duplicate free company cleanup could not be saved: ' + e.message);
      return null;
    });
  }
  function schedule() { if (!SH.ready) return; SH.editSeq++; clearTimeout(SH.timer); SH.timer = setTimeout(write, 250); render(); }
  function write() {
    clearTimeout(SH.timer); SH.timer = null;
    if (!SH.ready || SH.problem) return Promise.resolve();
    var unticked = SH.unticked || {}; SH.unticked = {};
    var said = SH.note || ''; SH.note = ''; // a line to keep on show after this write (the write clears the status line when it folds duplicates)
    return CC.writeSection('submersibles', S, { rev: SH.rev, base: SH.base }).then(function (r) {
      SH.rev = r.rev; SH.base = JSON.parse(JSON.stringify(r.section)); SH.chars = r.doc.chars; SH.updated = r.doc.updated || Date.now(); SH.notify = (r.doc.modules.settings && r.doc.modules.settings.notify) || SH.notify;
      if (r.merged) {
        setSection(r.section); render();
        // R4: a sector the player unticked in the form just saved that another device or tab had ticked is kept (a merge never removes one); say so
        var lines = Object.keys(unticked).map(function (id) { var f = r.section.fcs && r.section.fcs[id]; return f ? F.cameBackLine(f.name, F.cameBack(f.discovered, unticked[id])) : ''; }).filter(Boolean);
        said = [said].concat(lines).filter(Boolean).join(' ');
      }
      return foldBare().then(function (folded) { if (folded) setStatus(''); if (said) setStatus(said); pushSync(); });
    }).catch(function (e) {
      // A refused write used to leave an old working copy and revision in place:
      // later edits then repeated the refusal or were replaced silently. Re-read
      // the persisted section, make it the visible working copy, and tell the user
      // that the rejected edits must be entered again. This clears the stale base
      // while leaving the page usable for a later independent edit.
      return CC.read().then(function (r) {
        var doc = r.raw == null ? CC.emptyDoc() : CC.checkDoc(r.raw);
        SH.rev = r.rev; SH.base = doc.modules.submersibles ? JSON.parse(JSON.stringify(doc.modules.submersibles)) : null;
        SH.chars = doc.chars; SH.updated = doc.updated || Date.now();
        setSection(doc.modules.submersibles); render();
        setStatus('Not saved on this device: ' + e.message + ' The page now shows what is saved; re-enter any unsaved edits if you still need them.');
      }).catch(function () {
        setStatus('Not saved on this device: ' + e.message + ' This page is blocked because it could not reload the saved data; your current edits remain visible.');
      });
    });
  }
  // another page (the Tracker after a cloud sync, another window) saved: take its section, unless a change made here
  // is still waiting (that save merges with theirs)
  function reload() {
    if (SH.timer || !SH.ready) return Promise.resolve();
    return CC.read().then(function (r) {
      var doc; try { doc = CC.checkDoc(r.raw); } catch (e) { return; }
      if (SH.timer) return;
      var before = JSON.stringify([SH.chars, S, recsNow(), hiddenSet()]);
      SH.rev = r.rev; SH.chars = doc.chars; SH.updated = doc.updated || SH.updated; SH.notify = (doc.modules.settings && doc.modules.settings.notify) || SH.notify;
      SH.base = doc.modules.submersibles ? JSON.parse(JSON.stringify(doc.modules.submersibles)) : null;
      setSection(doc.modules.submersibles);
      if (!RC.k.pending) recsRead(doc, r.rev);
      return foldBare().then(function () {
        syncTicks();
        if (W) { var gone = !!(W.fcId && !S.fcs[W.fcId]); if (gone !== !!W.gone) { W.gone = gone; render(); } } // R1: the message at once, not only on Save
        if (JSON.stringify([SH.chars, S, recsNow(), hiddenSet()]) !== before && !W) render();
        pushSync();
      });
    });
  }
  function setStatus(t) { var el = $('#status'); if (el) el.textContent = t; }

  // ------------------------------------------------------------------ view state (this tab only)
  var UI = { tab: 'board', map: {} };
  try { var saved = JSON.parse(sessionStorage.getItem('eveniunt-subs-ui') || '{}'); if (saved.tab) UI.tab = saved.tab; if (saved.map && typeof saved.map === 'object') UI.map = saved.map; } catch (e) { /* none */ }
  function keepUi() { try { sessionStorage.setItem('eveniunt-subs-ui', JSON.stringify(UI)); } catch (e) { /* none */ } }
  function sortMode() { return (S.settings.prefs && S.settings.prefs.sort) || 'fc'; }
  function fcList() { return Object.keys(S.fcs).map(function (id) { return { id: id, fc: S.fcs[id] }; }).sort(function (a, b) { return (a.fc.order || 0) - (b.fc.order || 0) || String(a.fc.name || '').localeCompare(b.fc.name || ''); }); }
  // G8 (gaps spec): which free companies the Board shows. A view preference stored in the module's own settings section (RECS.NAME), one flat key per company
  // (hide-<id> = true); absent or false = shown. It hides a company from the Board, the next-back strip and the fleet-wide send only: alerts, Earnings,
  // the Map and the company's data are untouched.
  function hiddenSet() { return window.RECS.hidden(RC.k.raw); }
  function shownFcs() { var h = hiddenSet(); return fcList().filter(function (f) { return !h[f.id]; }); }
  function hiddenCount() { var h = hiddenSet(); return fcList().filter(function (f) { return h[f.id]; }).length; }
  function shownFleet(now) { var h = hiddenSet(); return F.fleet(S, now).filter(function (x) { return !h[x.fcId]; }); }
  function setFcShown(fcId, shown) {
    var patch = {}; patch[window.RECS.hideKey(fcId)] = !shown;
    if (shown && !hiddenSet()[fcId]) return; // already shown: nothing to store
    RC.k.change(patch);
    render();
  }
  function subsOf(fcId) { var out = {}; Object.keys(S.subs).forEach(function (id) { var s = S.subs[id]; if (s.fcId === fcId && !out[s.slot]) out[s.slot] = { id: id, sub: s }; }); return out; }
  function charName(id) { var c = SH.chars.find(function (x) { return x.id === id; }); return c ? c.name : ''; }

  // ------------------------------------------------------------------ rendering
  var TABS = [['board', 'Board', null], ['log', 'Log', null], ['map', 'Map', null],
    ['earn', 'Earnings', null], ['setup', 'Setup', null]];
  function render() {
    if (!D) return;
    var ae = document.activeElement, keep = ae && ae.matches && ae.matches('[data-rec-find]') ? { i: ae.dataset.recFind, a: ae.selectionStart, b: ae.selectionEnd } : null; // the narrowing box being typed in
    var keepPicker = !!(ae && ae.matches && ae.matches('[data-pref=priceWorld]')); // the price-place picker: a redraw never takes the focus off it
    try { return renderView(); } finally {
      if (keepPicker && UI.tab === 'earn') { var pick = $('[data-pref=priceWorld]'); if (pick) pick.focus(); }
      if (keep) { var box = $('[data-rec-find="' + keep.i + '"]'); if (box && !box.disabled) { box.focus(); try { box.setSelectionRange(keep.a, keep.b); } catch (e) { /* none */ } } }
    }
  }
  function renderView() {
    refreshLogged();
    $$('.tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === UI.tab ? 'page' : 'false'); });
    var main = $('#view');
    if (SH.problem) { main.innerHTML = '<div class="note bad"><b>The save cannot be used here.</b> ' + esc(SH.problem) + ' Nothing has been written over it.</div>'; return; }
    if (UI.tab === 'board') main.innerHTML = boardHtml();
    else if (UI.tab === 'setup') { main.innerHTML = safeNotify() + (W ? wizardHtml() : setupHtml()); if (!W) measureSize(); pushStatus(); }
    else if (UI.tab === 'log') { main.innerHTML = logHtml(); PRICES.drawn = priceSig(); loadPrices(false); }
    else if (UI.tab === 'map') { main.innerHTML = mapHtml(); seaStrip(true); }
    else if (UI.tab === 'earn') { main.innerHTML = earnHtml(); PRICES.drawn = priceSig(); loadPrices(false); }
    else { var t = TABS.find(function (x) { return x[0] === UI.tab; }); main.innerHTML = '<section class="panel empty-state"><h2>' + esc(t[1]) + '</h2><p class="muted empty-line">' + esc(t[2]) + ' Until then, the Board and Setup work on their own.</p></section>'; }
    lastStatus = statusKey();
  }
  // S7: on a phone the seas are one row that scrolls inside its own strip: the chosen sea is scrolled into view (on load and on change), a fade marks the side where more seas are hidden (data-more), arrow keys move between the chips
  function seaStrip(center) {
    var strip = document.querySelector('.map-seas'); if (!strip) return;
    if (center) { var on = strip.querySelector('[data-map-sea][aria-pressed="true"]'); if (on && strip.scrollWidth > strip.clientWidth + 1) strip.scrollLeft = Math.max(0, on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2); }
    seaFade(strip);
  }
  function seaFade(strip) {
    var more = strip.scrollWidth <= strip.clientWidth + 1 ? '' : strip.scrollLeft > 2 ? (strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2 ? 'both' : 'start') : 'end';
    if (more) strip.setAttribute('data-more', more); else strip.removeAttribute('data-more');
  }
  document.addEventListener('scroll', function (e) { if (e.target && e.target.classList && e.target.classList.contains('map-seas')) seaFade(e.target); }, true);
  document.addEventListener('keydown', function (e) {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !e.target.closest || !e.target.matches('.map-seas [data-map-sea]')) return;
    var chips = [].slice.call(e.target.closest('.map-seas').querySelectorAll('[data-map-sea]')), i = chips.indexOf(e.target), j = Math.max(0, Math.min(chips.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    e.preventDefault(); chips[j].focus(); if (chips[j].scrollIntoView) chips[j].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  var lastStatus = '';
  function statusKey() { var now = Date.now(); return F.fleet(S, now).map(function (x) { return x.id + x.status; }).join(); }

  // the next-back strip counts only the shown free companies (G8)
  var MORE_MS = 10 * 60000; // "and N more within 10 minutes" (Rev4.7)
  function shownSummary(now) {
    var all = shownFleet(now), next = null, back = 0, out = 0, idle = 0;
    all.forEach(function (x) {
      if (x.status === 'back') back++; else if (x.status === 'out') out++; else if (x.status === 'idle') idle++;
      if (x.status === 'out' && (!next || x.sub.voyage.returnAt < next.sub.voyage.returnAt)) next = x;
    });
    // locked: for each shown company, 4 less its unlocked slots
    var locked = shownFcs().reduce(function (n, f) { return n + Math.max(0, 4 - (f.fc.unlockedSlots || 1)); }, 0);
    var more = next ? all.filter(function (x) { return x !== next && x.status === 'out' && x.sub.voyage.returnAt - next.sub.voyage.returnAt <= MORE_MS; }).length : 0;
    return { next: next, back: back, out: out, idle: idle, locked: locked, more: more, sendable: all.filter(function (x) { return x.status === 'back' || x.status === 'idle'; }).length };
  }
  function strip(now) {
    var sum = shownSummary(now);
    var next = sum.next ? '<b>Next back:</b> ' + esc(F.subLabel(sum.next)) + ' in <span data-until="' + sum.next.sub.voyage.returnAt + '">' + F.fmtDur(sum.next.sub.voyage.returnAt - now, true) + '</span>'
      : '<b>Next back:</b> none out';
    var sound = !!F.deviceSubs().sound;
    var tally = function (cls, n, word) { return '<span class="strip-tally ' + cls + (n ? ' on' : '') + '"><b>' + n + '</b> ' + word + '</span>'; };
    return '<div class="strip">' +
      '<span class="strip-next">' + next + '</span>' +
      (sum.more ? '<span class="strip-more">and ' + sum.more + ' more within 10 minutes</span>' : '') +
      '<span class="strip-back' + (sum.back ? ' on' : '') + '"><b>' + sum.back + '</b> back now</span>' +
      tally('out', sum.out, 'out') + tally('idle', sum.idle, 'idle') + tally('locked', sum.locked, 'locked') +
      '<span class="strip-tools">' +
        '<span class="seg" role="group" aria-label="Sort"><button type="button" data-sort="fc" aria-pressed="' + (sortMode() === 'fc') + '">By FC</button><button type="button" data-sort="time" aria-pressed="' + (sortMode() === 'time') + '">By return time</button></span>' +
        (sum.sendable ? '<button type="button" class="btn sm" data-act="sendallfleet" title="One sheet for every shown free company: tick the submarines to send">Send all back, every free company</button>' : '') +
        '<button type="button" class="btn sm" data-act="sound" aria-pressed="' + sound + '" title="A sound with the banner when a sub comes back (this device only)">Sound ' + (sound ? 'on' : 'off') + '</button>' +
      '</span></div>';
  }
  // ---- the Board's timeline (W32, Rev4.7): one shared axis that starts now; all of its arithmetic is in timeline.js ----
  var HOUR_MS = 3600000;
  // a route as lettered discs in their sea's colour: a label, never a time (at most five)
  function routeDiscs(route) {
    var r = (route || []).filter(function (id) { return SECTOR[id]; }).slice(0, 5);
    if (!r.length) return '';
    return '<span class="discs" aria-hidden="true">' + r.map(function (id, k) { var sc = SECTOR[id]; return '<i class="disc in-sea-' + sc.sea + '" style="--i:' + k + '">' + esc(sc.letter) + '</i>'; }).join('') + '</span>';
  }
  // the axis of the whole Board: the smallest span that holds every shown Out return and every suggested voyage (48 hours when there is none)
  // K3.8: a drawing works the advice out (it is kept while its inputs are unchanged); the one-second tick only reuses the longest suggestion of the last drawing
  // (reuse = true): the advice cannot change between two drawings, because a change of a submarine's state, of the save or of the recommendations draws again.
  var ADVICE_MS = 0;
  function boardAxis(now, reuse) {
    var ms = 0, adv = 0;
    shownFleet(now).forEach(function (x) {
      if (x.status === 'out') ms = Math.max(ms, x.sub.voyage.returnAt - now);
      else if (!reuse && (x.status === 'back' || x.status === 'idle')) { var a = adviceFor(x.id); if (a && a.plan) adv = Math.max(adv, a.plan.ev.seconds * 1000); }
    });
    if (!reuse) ADVICE_MS = adv;
    ms = Math.max(ms, ADVICE_MS);
    return { span: TL.span(ms) };
  }
  // the marks of an axis: the returns of Out submarines that fall inside it, returns closer than 2% of it merged into one counted mark
  function axisMarksHtml(rets, span, now) {
    var xs = rets.filter(function (t) { return t - now <= span * HOUR_MS; }).map(function (t) { return TL.pos(t - now, span); });
    return TL.marks(xs).map(function (m) { return '<i class="tl-mark" style="--x:' + m.x + '" data-n="' + m.n + '"></i>'; }).join('');
  }
  function axisHtml(T, outs, now) {
    var rets = outs.map(function (x) { return x.sub.voyage.returnAt; });
    return '<div class="tl-axis" aria-hidden="true" data-span="' + T.span + '" data-rets="' + rets.join(',') + '">' +
      TL.ticks(T.span).map(function (t) { return '<i style="--x:' + t.x + '">' + t.label + '</i>'; }).join('') + axisMarksHtml(rets, T.span, now) + '</div>';
  }
  // the track of a lane: out (bar to the return, marker at it), over (the return is past the axis), done (Back), ghost (a suggestion, outlined)
  function laneTl(x, now, a, T) {
    var v = x.sub.voyage, st = x.status, bar = '<i class="tl-bar"></i><i class="tl-end"></i>';
    if (st === 'out') {
      var ms = v.returnAt - now, over = ms > T.span * HOUR_MS;
      return '<span class="tl ' + (over ? 'over' : 'out') + '" aria-hidden="true" data-ret="' + v.returnAt + '" style="--ret:' + TL.pos(ms, T.span) + '">' + routeDiscs(v.route) + bar + '</span>';
    }
    var plan = a && a.plan;
    if (st === 'back' && v && v.route && v.route.length) return '<span class="tl done" aria-hidden="true">' + routeDiscs(v.route) + bar + '</span>';
    if (plan) { var gm = plan.ev.seconds * 1000; return '<span class="tl ghost' + (gm > T.span * HOUR_MS ? ' over' : '') + '" aria-hidden="true" style="--ret:' + TL.pos(gm, T.span) + '">' + routeDiscs(plan.route) + bar + '</span>'; }
    return '<span class="tl' + (st === 'back' ? ' done' : '') + '" aria-hidden="true">' + bar + '</span>';
  }
  // the voice of the objective that chose the advice (look only): unlock = route, level = rank, gil = gil, loot = loot
  function leadVoice(a) { var v = a && ({ U1: 'route', U2: 'route', U3: 'route', X: 'rank', G: 'gil', L: 'loot' })[a.lead]; return v ? ' lead-' + v : ''; }
  // a lane is one labelled group: the submarine, its state, its route and its return in words (the clock in tick() keeps the return current)
  function laneLabel(x, now, a, whenText) {
    var s = x.sub, v = s.voyage, route = v && v.route && v.route.length ? routeText(v.route) : (a && a.plan ? routeText(a.plan.route) : '');
    return (s.name || 'Sub ' + s.slot) + ', ' + F.LABEL[x.status] + (route ? ', route ' + route + (x.status === 'idle' || !(v && v.route && v.route.length) ? ' (suggested)' : '') : '');
  }
  function subRow(x, now, withFc, T) {
    var s = x.sub, st = x.status, v = s.voyage, info = '', said = '';
    if (st === 'out') { info = '<span class="when units" title="' + (v.gameSaid ? 'From the game (typed)' : 'Worked out from rank, parts and route') + '">' + u('back in <b data-until="' + v.returnAt + '">' + F.fmtDur(v.returnAt - now, true) + '</b>') + u(nb('<span class="when-at">' + esc(F.fmtClock(v.returnAt, now)) + '</span>')) + '</span>'; said = 'back in ' + F.fmtDur(v.returnAt - now, true) + ' · ' + F.fmtClock(v.returnAt, now); }
    else if (st === 'back') { var up = ADV.afterVoyage(s, v.route); info = '<span class="when units">' + u('waiting <b data-since="' + v.returnAt + '">' + F.fmtDur(now - v.returnAt) + '</b>') + u('back ' + nb('<span class="when-at">' + esc(F.fmtClock(v.returnAt, now)) + '</span>')) + (up && up.rank > s.rank ? u(nb('rank → ' + up.rank + '+')) : '') + '</span>'; said = 'waiting ' + F.fmtDur(now - v.returnAt) + ' · back ' + F.fmtClock(v.returnAt, now); }
    else if (st === 'idle') { info = '<span class="when">not sent</span>'; said = 'not sent'; }
    var quick = '', a = null;
    if (st === 'back' || st === 'idle') { a = adviceFor(x.id); if (a && a.plan) quick = '<button type="button" class="quick' + leadVoice(a) + '" data-quick="' + esc(x.id) + '" title="' + esc(a.plan.why) + '" aria-label="' + esc('Send ▸ ' + ADV.routeText(a.plan.route) + ' · back ' + F.fmtClock(now + a.plan.ev.seconds * 1000, now)) + '"><span class="q-v">Send</span><span class="q-r"> ▸ ' + routeHtml(a.plan.route) + '</span><span class="q-t"><span class="q-dot"> · </span>back ' + nb(esc(F.fmtClock(now + a.plan.ev.seconds * 1000, now))) + '</span></button>'; } // W-e: the same text, in parts, so the dense lane can show the verb and the time only (the lane already draws the route as discs); the accessible name is the whole
    var gauge = '', vp = st === 'out' ? F.voyageProgress(v, now) : null;
    if (vp !== null) gauge = '<span class="vgauge" aria-hidden="true" data-voy data-sent="' + v.sentAt + '" data-ret="' + v.returnAt + '" style="--p:' + vp.toFixed(4) + '"></span><span class="vgauge-sr" data-voy-text>Voyage ' + Math.floor(vp * 100) + ' percent done</span>';
    var route = v && v.route && v.route.length ? '<span class="route" title="Route as entered">' + esc(routeText(v.route)) + '</span>' : '';
    var lbl = laneLabel(x, now, a);
    return '<div class="sub" role="group" tabindex="0" data-sub="' + esc(x.id) + '" data-status="' + st + '" data-lbl="' + esc(lbl) + '" aria-label="' + esc(lbl + '; ' + said + '. Press Enter to open it.') + '">' +
      '<span class="sub-top"><span class="sub-name">' + (withFc ? '<span class="sub-fc">' + esc(x.fc.name || 'Unnamed') + ' · </span>' : '') + esc(s.name || 'Sub ' + s.slot) + '</span>' +
      '<span class="chip ' + st + '">' + F.LABEL[st] + '</span></span>' +
      '<span class="sub-meta"><span title="Rank as you entered it">' + (s.rank ? 'Rank ' + s.rank : 'Rank ?') + '</span><span class="code" title="' + esc(partsTitle(s.parts)) + ' (as you entered them)">' + partsCode(s.parts) + '</span>' + route + '</span>' +
      laneTl(x, now, a, T) +
      '<span class="sub-when">' + info + quick + '</span>' + gauge + '</div>';
  }
  function lockedRow(slot) {
    var u = slotUnlock(slot), lbl = 'Slot ' + slot + ', Locked' + (u ? '; unlocked by surveying ' + sectorLabel(u) : '');
    var tl = '<span class="tl locked" aria-hidden="true">' + (u && SECTOR[u.id] ? routeDiscs([u.id]) : '') + '<i class="tl-bar"></i></span>';
    return '<div class="sub' + (u && u.sea ? ' in-sea-' + u.sea : '') + '" role="group" aria-label="' + esc(lbl) + '" data-status="locked" data-slot="' + slot + '"><span class="sub-top"><span class="sub-name">Slot ' + slot + '</span><span class="chip locked">Locked</span></span>' +
      '<span class="sub-meta">' + (u ? 'Unlocked by surveying ' + esc(sectorLabel(u)) + ' <span class="tag" title="Submarine Tracker, MIT; see Credits">community data</span>' : 'unlock not known') + '</span>' + tl + '</div>';
  }
  function fcCard(f, now, T) {
    var fc = f.fc, subs = subsOf(f.id), rows = '', outs = [];
    for (var slot = 1; slot <= 4; slot++) {
      var e = subs[slot];
      if (slot > (fc.unlockedSlots || 1) || !e) { rows += slot > (fc.unlockedSlots || 1) ? lockedRow(slot) : '<div class="sub empty" data-status="idle"><span class="sub-meta">Slot ' + slot + ' is unlocked but has no sub yet. <button type="button" class="link" data-act="edit" data-fc="' + esc(f.id) + '">Add it in Setup</button></span></div>'; continue; }
      var x = { id: e.id, sub: e.sub, fc: fc, fcId: f.id, status: F.status(e.sub, fc, now) };
      if (x.status === 'out') outs.push(x);
      rows += subRow(x, now, false, T);
    }
    var last = outs.slice().sort(function (a, b) { return b.sub.voyage.returnAt - a.sub.voyage.returnAt; })[0];
    var sendable = Object.keys(subs).some(function (k) { var st = F.status(subs[k].sub, fc, now); return st === 'back' || st === 'idle'; });
    var where = [fc.world, charName(fc.charId)].filter(Boolean).join(' · ');
    // look only: a thin band across the head, one quarter per slot in the slot's status colour (Back green, Out blue, Idle amber, Locked neutral; a slot with no sub yet has no colour); the rows below carry the words
    var band = [1, 2, 3, 4].map(function (sl, k) {
      var e = subs[sl], c = sl > (fc.unlockedSlots || 1) ? 'var(--ink-3)' : e ? 'var(--' + F.status(e.sub, fc, now) + ')' : 'transparent';
      return c + ' ' + k * 25 + '% ' + (k + 1) * 25 + '%';
    }).join(', ');
    return '<section class="fc" data-fc="' + esc(f.id) + '"><header class="fc-head" style="--band:linear-gradient(90deg, ' + band + ')"><div><h3>' + esc(fc.name || 'Unnamed free company') + '</h3>' + (where ? '<span class="muted">' + esc(where) + '</span>' : '') + '</div>' +
      '<div class="fc-tools">' + (sendable ? '<button type="button" class="btn sm" data-act="sendall" data-fc="' + esc(f.id) + '">Send all back</button>' : '') +
      (last ? '<button type="button" class="btn sm ghost" data-act="ics-fc" data-fc="' + esc(f.id) + '" title="Add the last return of this free company to your calendar">Calendar: last back ' + esc(F.fmtClock(last.sub.voyage.returnAt, now)) + '</button>' : '') +
      '</div></header><div class="fc-subs">' + axisHtml(T, outs, now) + rows + '</div></section>';
  }
  // ---- the empty states (W33, Rev4.7): one pattern. o: { id, cls, kick, title, text (html), steps: [[role, title, text], ...], act (html: the one primary button), aside, note (html), word (the scope's word) } ----
  function emptyHtml(o) {
    var steps = (o.steps || []).map(function (st, k) { return '<li class="es-step v-' + st[0] + '"><b>' + (k + 1) + '</b><span><strong>' + esc(st[1]) + '</strong><span>' + esc(st[2]) + '</span></span></li>'; }).join('');
    var count = D && D.seas && D.sectors ? D.seas.length + ' seas, ' + D.sectors.length + ' sectors' : '';
    return '<section class="panel empty-state' + (o.cls ? ' ' + o.cls : '') + '" data-empty="' + o.id + '"><div class="es-main"><p class="es-kick">' + esc(o.kick) + '</p><h2>' + esc(o.title) + '</h2><p class="es-text">' + o.text + '</p>' +
      (steps ? '<ol class="es-steps">' + steps + '</ol>' : '') +
      '<p class="es-act">' + o.act + (o.aside ? '<span class="es-aside">' + esc(o.aside) + '</span>' : '') + '</p>' + (o.note ? '<p class="es-note">' + o.note + '</p>' : '') + '</div>' +
      '<div class="es-scope" aria-hidden="true"><svg viewBox="0 0 640 820" preserveAspectRatio="xMidYMid slice" focusable="false">' +
        '<circle class="es-ring r1" cx="370" cy="430" r="90"/><circle class="es-ring r2" cx="370" cy="430" r="180"/><circle class="es-ring r3" cx="370" cy="430" r="270"/><circle class="es-ring r4" cx="370" cy="430" r="360"/><circle class="es-ring r5" cx="370" cy="430" r="450"/>' +
        '<line class="es-cross" x1="370" y1="-40" x2="370" y2="900"/><line class="es-cross" x1="-100" y1="430" x2="760" y2="430"/>' +
        '<g class="es-sweep"><path class="es-fan" d="M370 430 L370 70 A360 360 0 0 1 624.6 175.4 Z"/><line class="es-edge" x1="370" y1="430" x2="624.6" y2="175.4"/></g>' +
        '<path class="es-dia" d="M370 408 L392 430 L370 452 L348 430 Z"/></svg>' +
        '<span class="es-word">' + esc(o.word) + '</span>' + (count ? '<span class="es-count">' + esc(count) + '</span>' : '') + '</div></section>';
  }
  // once per Board: the collapsed "How this is estimated", when any suggestion on the screen rests on community drop records; with the part of
  // each plan's gil figure that rests on the second-item assumption
  function boardEstimateNote(now) {
    var shown = false, shares = [];
    shownFleet(now).forEach(function (x) {
      if (x.status !== 'back' && x.status !== 'idle') return;
      var a = adviceFor(x.id); if (!a || !a.plan) return;
      if (/community drop records/.test(a.plan.why || '')) shown = true;
      if (a.plan.est && typeof a.plan.est.secondShare === 'number') shares.push(a.plan.est.secondShare);
    });
    return shown ? howEstimatedHtml(shares) : '';
  }
  function boardHtml() {
    var now = Date.now(), fcs = shownFcs(), nHidden = hiddenCount();
    if (!fcList().length) {
      return emptyHtml({ id: 'board-none', cls: 'welcome', kick: 'The dock is empty', title: 'No submarines in the water', word: 'Your dock',
        text: 'Add a free company and its submarines, and this Board shows who is out, who is back and what to send next.',
        steps: [['route', 'Name the free company', 'Its world and the character it belongs to.'], ['rank', 'Add its submarines', 'Name, rank and the four parts of each one, and any voyage under way.'], ['loot', 'Tick what is discovered', 'One press can mark a whole sea.']],
        act: '<button type="button" class="btn primary" data-act="new">Start the setup</button>', aside: 'about 3 to 5 minutes per free company',
        note: 'Enter each sub\'s rank and four parts: the app then works out every return time from the route you tap, and suggests the next route following your order (unlock all four subs, discover every sector, farm gil).' });
    }
    var body, T = boardAxis(now);
    if (sortMode() === 'time') {
      var all = shownFleet(now).filter(function (x) { return x.status !== 'locked'; });
      var rank = { back: 0, out: 1, idle: 2 };
      all.sort(function (a, b) {
        return rank[a.status] - rank[b.status] || (a.status === 'back' ? a.sub.voyage.returnAt - b.sub.voyage.returnAt : a.status === 'out' ? a.sub.voyage.returnAt - b.sub.voyage.returnAt : 0) || String(F.subLabel(a)).localeCompare(F.subLabel(b));
      });
      body = '<section class="fc wide"><header class="fc-head"><h3>All submarines by return time</h3></header><div class="fc-subs list">' + axisHtml(T, all.filter(function (x) { return x.status === 'out'; }), now) + (all.length ? all.map(function (x) { return subRow(x, now, true, T); }).join('') : '<p class="muted empty-line">No submarine is in an unlocked slot yet.</p>') + '</div></section>';
    } else body = '<div class="fleet">' + fcs.map(function (f) { return fcCard(f, now, T); }).join('') + '</div>';
    if (!fcs.length) body = '<div class="fleet"></div>' + emptyHtml({ id: 'board-hidden', kick: 'Nothing on the Board', title: 'Every free company is hidden', word: 'Hidden',
      text: 'Their data and alerts are unchanged. Tick one in Setup to see it here.', act: '<button type="button" class="btn primary" data-tab="setup">Show them in Setup</button>' });
    var hid = nHidden ? '<p class="hint hidden-note" data-hidden-note>' + nHidden + ' free compan' + (nHidden === 1 ? 'y is' : 'ies are') + ' hidden from this Board (their data and alerts are unchanged). <button type="button" class="link" data-tab="setup">Show ' + (nHidden === 1 ? 'it' : 'them') + ' in Setup</button></p>' : '';
    return strip(now) + hid + body + boardEstimateNote(now) + '<p class="foot-note tl-key">Letters: the route\'s sectors, in order, in their sea\'s colour. Bar and marker: the time left and the return, on the line above. Outlined: a suggestion, not sent.</p>' +
      '<p class="foot-note">Return times: worked out from rank, parts and route (' + esc(confirmation().text) + '), or the game\'s time where you typed it. Ranks and parts: as you entered them. Suggestions follow your order: unlock all four subs, discover every sector, farm gil. Alerts work while a Command Center page is open; for a reminder when the app is closed, add the return to your calendar.</p>';
  }
  // how the worked-out times compare with the game's: every voyage or trip where the game's time was also entered
  function accuracyHtml() {
    var rows = [], c = confirmation();
    var add = function (subId, calc, back, said) { if (calc && back && said) rows.push({ sub: S.subs[subId], calc: calc, back: back, said: said }); };
    Object.keys(S.trips).forEach(function (k) { var t = S.trips[k]; add(t.s, t.calc, t.back, t.said); });
    Object.keys(S.subs).forEach(function (k) { var v = S.subs[k].voyage; if (v) add(k, v.calcAt, v.returnAt, v.gameSaid); });
    rows.sort(function (a, b) { return b.back - a.back; });
    var rc = Object.keys(S.trips).map(function (k) { return S.trips[k]; }).filter(function (t) { return t.rankCalc && t.rankAfter; });
    var rankLine = '<p class="hint">Ranks after a voyage: ' + rc.length + ' worked out' + (rc.length ? ', ' + rc.filter(function (t) { return t.rankAfter > t.rankCalc; }).length + ' corrected higher from the game (survey bonuses give extra experience)' : '') + '.</p>';
    var L = learned(), gl = ADV.GRADES.filter(function (g) { return L.grades[g]; }).map(function (g) { return g + ' ×' + ADV.factorFor(L, g).toFixed(2) + ' (' + L.grades[g].n + ')'; }).join(', ');
    rankLine += '<p class="hint">Experience learned from your voyages (rank and experience typed on return): ' + (L.n ? L.n + ' voyage' + (L.n === 1 ? '' : 's') + (gl ? '; per grade, times the base: ' + gl : '; note the grade too to learn per grade') : 'none yet') + '.</p>';
    return '<section class="panel accuracy"><h2>Accuracy of worked-out times</h2><p><span class="tag">' + esc(c.text) + '</span></p>' + rankLine +
      '<p class="muted">The times use the community formula from Submarine Tracker; players measuring the game on the official forum found the same three numbers (12 hours per voyage, 39.9 minutes per unit of distance at speed 1, 70 minutes per survey minute at speed 1). To confirm it on your own fleet: after sending in the game, open the sub here and use <b>Check against the game</b>. After 10 checks within a minute, the label says confirmed.</p>' +
      (rows.length ? '<table class="acc"><thead><tr><th>Sub</th><th>Worked out</th><th>Game</th><th>Difference</th></tr></thead><tbody>' + rows.slice(0, 20).map(function (r) {
        var d = Math.round((r.back - r.calc) / 1000);
        return '<tr><td>' + esc(r.sub ? r.sub.name || 'Sub ' + r.sub.slot : 'removed sub') + '</td><td>' + esc(F.fmtClock(r.calc)) + '</td><td>' + esc(F.fmtClock(r.back)) + ' <span class="muted">(' + esc(r.said) + ')</span></td><td class="' + (Math.abs(d) <= 60 ? 'ok' : 'bad') + '">' + (Math.abs(d) <= 60 ? 'agrees' : (d > 0 ? '+' : '') + Math.round(d / 60) + ' min') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint empty-line">No checks yet.</p>') + '</section>';
  }
  // ------------------------------------------------------------------ phone notifications (step S7)
  // where each free company stands in the owner's order: still unlocking (subs or sectors, levelling included), farming
  // gil, or finished (gil step, every sub at the top rank and no better part to fit)
  function stageOf(fcId) {
    refreshLogged();
    var fc = S.fcs[fcId], list = Object.keys(S.subs).filter(function (k) { return S.subs[k].fcId === fcId && S.subs[k].slot <= (fc.unlockedSlots || 1); });
    if (!fc || !list.length) return 'unlock';
    var advice = list.map(function (k) { return advised('stage', k, S.subs[k], fc, [], list.length); });
    if (advice.some(function (a) { return a.blocked || a.step < 3; })) return 'unlock';
    return list.every(function (k) { return S.subs[k].rank === ADV.top(); }) && advice.every(function (a) { return !a.parts; }) ? 'final' : 'gil';
  }
  function prefs() { return Object.assign({}, S.settings.prefs || {}, SH.notify || {}); } // the night rule comes from the main Settings
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
    var p = prefs(), g = p.grouping || 'auto';
    var modes = PUSH.modes(S, p, stageOf), WHY = { sub: 'per submarine (still unlocking)', fc: 'per free company (farming gil)', fleet: 'whole fleet (everything at the top)' };
    var auto = fcList().map(function (f) { return esc(f.fc.name || 'Unnamed') + ': ' + (g === 'auto' ? WHY[modes[f.id]] : PUSH.GROUPINGS[modes[f.id]].toLowerCase()); }).join(' · ');
    var opt = function (val, label, help) { return '<label class="opt notify-opt"><input type="radio" name="grouping" value="' + val + '" data-pref="grouping"' + (g === val ? ' checked' : '') + '> <span><b>' + esc(label) + '</b>' + (help ? '<br><span class="hint">' + help + '</span>' : '') + '</span></label>'; };
    return '<section class="panel notify"><h2>Submarine notifications</h2>' +
      '<p class="push-status" data-push-status>Checking…</p><p class="hint">Turning notifications on or off for a device, the test and the night rule are in the Command Center\'s <a href="../#settings">⚙ Settings</a>. The choice below is kept even while notifications are off.</p>' +
      '<fieldset><legend>How submarine alerts are grouped</legend>' +
      opt('auto', 'Automatic (recommended)', 'For each free company: one alert per submarine while it is still unlocking subs and sectors, one per free company once it farms gil; one for the whole fleet once every free company farms gil with every sub at rank 145 and no better part to fit.') +
      opt('sub', 'Per submarine', 'One alert for each sub that comes back.') +
      opt('fc', 'Per free company', 'One alert when the last sub of a free company is back.') +
      opt('fleet', 'Whole fleet', 'One alert when the last sub of the fleet is back.') +
      '<p class="hint">Now: ' + (auto || 'no free company yet') + '. In the grouped modes, a sub back more than 30 minutes before the rest of its group still gets its own alert.</p></fieldset></section>';
  }
  // the notifications panel heads the Setup tab, also while the guided setup is open (owner report 2026-11-12: it was
  // easy to miss below the free companies); a fault inside it shows as a message instead of hiding the panel
  function safeNotify() {
    try { return notifyHtml(); } catch (e) { return '<section class="panel notify"><h2>Phone notifications</h2><p class="hint bad">This panel could not be shown: ' + esc(e.message) + '. Close the app fully and open it again; if it stays, send this message.</p></section>'; }
  }
  function pushStatus(msg) {
    var el = $('[data-push-status]'); if (!el) return;
    if (msg) { el.textContent = msg; return; }
    if (!PUSH.supported()) { el.textContent = 'This browser cannot receive web notifications here. On an iPhone or iPad, open the Command Center from the home screen.'; return; }
    if (!PUSH.device()) { el.textContent = 'Notifications are off on this device: turn them on in ⚙ Settings (Command Center), after signing in for cloud sync there.'; return; }
    PUSH.call('/push/status').then(function (r) {
      el.textContent = (r.on ? 'On for this device.' : 'Off for this device.') + ' ' + r.devices + ' device' + (r.devices === 1 ? '' : 's') + ' turned on. ' + (r.count ? r.count + ' alert' + (r.count === 1 ? '' : 's') + ' scheduled, next ' + F.fmtClock(r.next) + '.' : 'Nothing scheduled.');
    }).catch(function (e) { el.textContent = e.code === 'push_not_set_up' ? 'Your helper does not do notifications yet: the one-time set-up in helper/README.md, section 4, turns them on.' : 'The helper could not be asked: ' + e.message; });
  }

  // the history size meter (design 7.3): the save's compressed size against the cloud copy's 4 MB limit
  var CLOUD_LIMIT = 4 * 1024 * 1024 - 64 * 1024; // as src/core/cloud.js
  var ARCHIVE_PCT = 75;
  function measureSize() {
    var el = $('[data-size]'); if (!el) return;
    CC.read().then(function (r) {
      if (r.raw == null) { el.textContent = 'Nothing saved yet.'; return null; }
      var doc = CC.checkDoc(r.raw);
      return CC.pack(JSON.stringify({ chars: doc.chars, modules: doc.modules })).then(function (z) {
        var bytes = CC.byteLength(z), pct = Math.round(bytes / CLOUD_LIMIT * 1000) / 10, trips = Object.keys(S.trips).length;
        el.innerHTML = '<p>Whole save, compressed as cloud sync sends it: <b>' + (bytes / 1024 / 1024).toFixed(2) + ' MB</b> of the 4 MB limit (' + pct + '%). ' + trips.toLocaleString('en') + ' logged voyage' + (trips === 1 ? '' : 's') + ' kept.' +
          (pct >= ARCHIVE_PCT ? ' <b>Over 75%:</b> keep the save small by moving the oldest voyages to a file. The file is downloaded first; the voyages leave the save only after you confirm, and the file can be loaded back here at any time.</p><p class="row"><button type="button" class="btn sm" data-act="archive">Archive voyages back before 1 January ' + (new Date().getFullYear() - 1) + '</button>' : ' Every voyage is kept; at this size there is room for many years.</p><p class="row">') +
          '<label class="btn sm ghost">Load an archive file<input type="file" accept=".json,application/json" data-archive-file hidden></label></p>';
      });
    }).catch(function (e) { el.textContent = 'Could not measure: ' + e.message; });
  }
  // ------------------------------------------------------------------ Customizable Recommendations (spec section 5, items 1 to 3 and 5)
  // ---- Loot Farming pickers (spec section 5, item 4): a native text box plus a native drop-down whose options the text narrows
  function recItems() { if (!RC.items) RC.items = window.RECS.items(D); return RC.items; }
  function sectorsWith(id) { return Object.keys(D.loot || {}).filter(function (k) { return (D.loot[k] || []).indexOf(id) >= 0; }).length; }
  // a stored duplicate: the item this picker holds in the save but which an earlier picker already counts (check() has set it to none)
  function recDupOf(i) {
    var c = recsNow(), id = window.RECS.held(RC.k.raw, i);
    if (!id || c.loot[i][0] || !c.loot[i][1]) return null; // only a switched-on picker can be a duplicate
    for (var j = 0; j < i; j++) if (c.loot[j][1] && c.loot[j][0] === id) return { id: id, of: j + 1 };
    return null;
  }
  function recOptionsHtml(i) {
    var c = recsNow(), dup = recDupOf(i), own = dup ? dup.id : c.loot[i][0], q = (RC.find[i] || '').trim().toLowerCase(), taken = {};
    c.loot.forEach(function (p, j) { if (j !== i && p[0] && p[1]) taken[p[0]] = 1; }); // only switched-on pickers exclude an item
    var out = '<option value="0">none</option>', hits = 0;
    recItems().forEach(function (it) {
      if (taken[it.id] && it.id !== own) return;
      var match = !q || it.name.toLowerCase().indexOf(q) >= 0;
      if (match) hits++;
      if (!match && it.id !== own) return; // the chosen item always stays listed
      out += '<option value="' + it.id + '"' + (it.id === own ? ' selected' : '') + '>' + esc(it.name) + '</option>';
    });
    if (!hits) out += '<option value="-1" disabled>No item matches</option>';
    return out;
  }
  // Community drop records by item (docs/submersibles-droprates-spec.md 6.5 item 4): in how many sectors the item was recorded and
  // where its share of a tier is highest (sector, tier, share, the tier's surveys). Built once from the data.
  function dropIndex() {
    if (RC.drops) return RC.drops;
    var out = {}, sec = (D.dropRates && D.dropRates.sectors) || {};
    Object.keys(sec).map(Number).sort(function (a, b) { return a - b; }).forEach(function (sid) {
      sec[sid].pools.forEach(function (pool, t) {
        var rolls = pool.band[0] + pool.band[1] + pool.band[2];
        if (!rolls) return;
        pool.items.forEach(function (row) {
          var e = out[row[0]] || (out[row[0]] = { sectors: {}, count: 0, best: null }), p = row[1] / rolls;
          if (!e.sectors[sid]) { e.sectors[sid] = 1; e.count++; }
          if (!e.best || p > e.best.p) e.best = { sector: sid, tier: t + 1, p: p, rolls: rolls };
        });
      });
    });
    return (RC.drops = out);
  }
  function recNoteHtml(i) {
    var c = recsNow(), dup = recDupOf(i), id = dup ? dup.id : c.loot[i][0];
    if (!id) return '';
    var d = dropIndex()[id], pre = dup ? 'Same as picker ' + dup.of + ', counted once. ' : '';
    if (!d) { var n = sectorsWith(id); return pre + 'Listed as possible in ' + n + ' sector' + (n === 1 ? '' : 's') + '; no drop record yet, so no rate.'; }
    return pre + 'Recorded in ' + d.count + ' sector' + (d.count === 1 ? '' : 's') + ' (community drop records). Most per survey: ' + ADV.sectorName(d.best.sector) + ', tier ' + d.best.tier + ', ' + window.DROPS.fmt.pct(d.best.p) + ' of that tier, ' + window.DROPS.fmt.count(d.best.rolls) + ' surveys.';
  }
  function recPickersHtml() {
    var c = recsNow(), R = window.RECS, html = '';
    for (var i = 0; i < R.PICKERS; i++) {
      var n = i + 1, on = i === 0 || c.loot[i][1] === true, off = on ? '' : ' disabled';
      html += '<div class="rec-picker" data-rec-picker="' + i + '">' +
        (i === 0 ? '<p class="rec-pick-title"><b>Loot item 1</b></p>' : '<label class="opt"><input type="checkbox" data-rec="loot-on-' + i + '"' + (on ? ' checked' : '') + '> <span>Use picker ' + n + '</span></label>') +
        '<div class="rec-pick-row"><input type="text" class="rec-find" data-rec-find="' + i + '" value="' + esc(RC.find[i] || '') + '" placeholder="Type to narrow the list" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="' + esc('Type to narrow the list for loot item ' + n) + '"' + off + '>' +
        '<select class="rec-sel" data-rec="loot-' + i + '" aria-label="' + esc('Loot item ' + n) + '"' + off + '>' + recOptionsHtml(i) + '</select></div>' +
        '<p class="hint rec-note" data-rec-note="' + i + '">' + esc(recNoteHtml(i)) + '</p></div>';
    }
    return html + '<p class="hint empty-line" data-rec-empty>' + (R.active(c).length ? '' : 'No item chosen: Loot Farming is skipped.') + '</p>';
  }
  function recNarrow(t) { // typing: only this picker's option list is rebuilt; the text box, caret and focus are not touched
    var i = +t.dataset.recFind; RC.find[i] = t.value;
    var sel = $('[data-rec="loot-' + i + '"]'); if (sel) sel.innerHTML = recOptionsHtml(i);
  }
  // Under the Leveling row: the submarines at the top rank (the last rank of the data), for which Leveling is skipped (drop-rates spec 6.2, E12).
  // The row and its buttons stay usable: the order still applies to every submarine below the top rank.
  function topSkipHtml() {
    var top = ADV.top(), all = Object.keys(S.subs).map(function (k) { return S.subs[k]; }), at = all.filter(function (x) { return x.rank >= top; });
    if (!at.length) return '';
    var names = at.length === all.length ? 'every submarine.' : at.map(function (x) { return x.name || 'Sub ' + x.slot; }).join(', ') + '. They go to the next priority.';
    return '<li class="hint" data-rec-top-skip>' + esc('Skipped for submarines at rank ' + top + ', the top rank: ' + names) + '</li>';
  }
  function recsBodyHtml() {
    var R = window.RECS, c = recsNow(), n = c.order.length;
    var rows = c.order.map(function (k, i) {
      var name = R.LABEL[k];
      return '<li class="rung-' + (i + 1) + '"><span class="rec-name"><b>' + (i + 1) + '.</b> ' + esc(name) + '</span><span class="row">' +
        '<button type="button" class="btn sm" data-rec="up-' + esc(k) + '" aria-label="' + esc('Move up: ' + name) + '"' + (i === 0 ? ' disabled' : '') + '>Move up</button>' +
        '<button type="button" class="btn sm" data-rec="down-' + esc(k) + '" aria-label="' + esc('Move down: ' + name) + '"' + (i === n - 1 ? ' disabled' : '') + '>Move down</button></span></li>' + (k === 'level' ? topSkipHtml() : '');
    }).join('');
    // W35 (Rev4.7): the panel's head says its state, here the objective that decides first and whether fuel saving is on (redrawn with the body, so a change of order shows at once)
    var nLoot = R.active(c).length; // W-a: also whether fuel efficiency is on and its allowance, and how many loot items are chosen
    return '<p class="head-state" aria-hidden="true">First: ' + esc(R.LABEL[c.order[0]]) + ' · ' + (c.fuel ? 'Fuel: on, ' + c.giveUp + '%' : 'Fuel: off') + ' · Loot: ' + (nLoot ? nLoot + ' item' + (nLoot === 1 ? '' : 's') : 'none') + '</p>' +
      '<label class="opt big"><input type="checkbox" data-rec="fuel"' + (c.fuel ? ' checked' : '') + '> <span>Prioritise fuel efficiency</span></label>' +
      '<p class="rec-give"><label for="rec-give">To save fuel, give up at most <b>' + c.giveUp + '%</b> of the best result for my top priority</label><br>' +
      '<input type="range" id="rec-give" data-rec="giveUp" min="' + R.GIVE_MIN + '" max="' + R.GIVE_MAX + '" step="' + R.GIVE_STEP + '" value="' + c.giveUp + '"' + (c.fuel ? '' : ' disabled') + '> ' +
      '<span class="rec-give-text" data-rec-give-text>' + c.giveUp + '%</span> <button type="button" class="btn sm ghost" data-rec="give-default"' + (c.fuel ? '' : ' disabled') + '>Use the default (' + R.GIVE_UP + '%)</button></p>' +
      '<h3>Ranking</h3><p class="hint">The first objective decides; the next ones choose only among routes within ' + Math.round(R.BAND * 100) + '% of the best for those above.</p>' +
      '<ol class="rec-rank">' + rows + '</ol><p><button type="button" class="btn sm ghost" data-rec="order-default">Use the default order</button></p>' +
      '<h3>Loot Farming</h3><p class="hint">Up to five items. The first is always used; switch on more to farm several items at once. Each list holds every item that can drop in any sector, A to Z; type to make it shorter.</p>' + recPickersHtml();
  }
  function recsHtml() {
    return '<section class="panel recs" data-recs-panel><h2>Customizable Recommendations</h2>' +
      '<p class="muted">What the Board suggests for a submarine. Kept in the save, so it follows you to your other devices.</p>' +
      '<div data-recs-body>' + recsBodyHtml() + '</div><p class="hint" role="status" aria-live="polite" data-recs-live></p>' +
      '<details><summary>How the recommendation is decided</summary>' +
      '<p class="hint">Your ranking decides in order. For the first objective the app finds the best route and keeps every route within ' + Math.round(window.RECS.BAND * 100) + '% of it; the next objective chooses among those, and so on. A route is never more than ' + Math.round(window.RECS.BAND * 100) + '% worse than the best for any objective above the one that chose it. An objective with nothing to offer here is skipped, and the reason is named when it ranks above the suggestion. Nothing is random: equal routes go to the quicker one, then the one with fewer tanks.</p>' +
      '<p class="hint">With fuel efficiency on, the first objective may give up to the percentage you set; among those routes the one that brings the most per ceruleum tank wins. Fuel is counted in tanks, not in gil, because the price of a tank is not in the data.</p>' +
      '<p class="hint">What each objective measures, and its limits. Unlocking Routes: new submarine slots, then sectors that can still be revealed (community data; a reveal is not certain on every visit), then experience towards a needed rank. Leveling Submersible Rank: the base experience a voyage gives per hour, a floor only, because surveillance, retrieval and favor are not modelled. Gil Farming: the gil routes made by the community (loot sold to merchants) that this submarine can run, ranked by the gil per hour they are estimated to bring for this submarine, an estimate from community drop records; once a route has 10 logged voyages, your own log, counted in merchant gil per hour, replaces the estimate for that route, and the reason shows both figures. Loot Farming: for each chosen item, the quantity per hour a route is expected to bring for this submarine, as a share of the best route for that item, added over your items; an estimate from community drop records. Unknown: what the second item of a survey is (the estimate assumes it is drawn like the first), the exact spread of quantities, and whether an item the community never recorded in a sector can drop there.</p>' +
      '<p class="hint">In a sea with more than 8 sectors you can visit, the route is the best one found by a bounded search, not proven best.</p></details></section>';
  }
  function redrawRecs(focus) {
    var body = $('[data-recs-body]'); if (!body) return;
    body.innerHTML = recsBodyHtml(); RC.shown = JSON.stringify(recsNow());
    var live = $('[data-recs-live]'); if (live && RC.live != null) live.textContent = RC.live;
    if (focus) {
      var el = $('[data-rec="' + focus + '"]', body);
      if (el && el.disabled) { var li = el.closest('li'); el = li ? $('button:not([disabled])', li) : null; } // a button that just became disabled: its enabled neighbour
      if (el) el.focus();
    }
  }
  // one setting changed: the patch of stored keys the change touched goes to the keeper, which writes it; only this panel is redrawn
  function recsChange(mut, focus, live, forcePicker) {
    var R = window.RECS, was = recsNow(), c = JSON.parse(JSON.stringify(was));
    mut(c);
    var patch = R.intent(was, c);
    var force = typeof forcePicker === 'number' && forcePicker >= 0; // a stored duplicate cleared or replaced: a change although the settings read the same
    if (force) patch['loot' + (forcePicker + 1)] = c.loot[forcePicker][0];
    // "Use the default …": always sent, so a tab that has not yet seen another tab's change still makes the later change win
    if (forcePicker === 'order' || forcePicker === 'giveUp') { force = true; patch[forcePicker] = c[forcePicker]; }
    var none = !Object.keys(patch).length || (!force && JSON.stringify(R.check(R.store(RC.k.raw, patch), D)) === JSON.stringify(was));
    if (!none) RC.k.change(patch);
    RC.choices = null;
    RC.live = typeof live === 'function' ? live(recsNow()) : live || '';
    redrawRecs(focus);
  }
  function onRecsClick(b) {
    var R = window.RECS, v = b.dataset.rec, m = /^(up|down)-(.+)$/.exec(v);
    if (m) {
      recsChange(function (c) { var i = c.order.indexOf(m[2]), j = m[1] === 'up' ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= c.order.length) return; c.order.splice(j, 0, c.order.splice(i, 1)[0]); }, v,
        function (now) { return R.LABEL[m[2]] + ' is now ' + (now.order.indexOf(m[2]) + 1) + ' of ' + R.KEYS.length; });
    } else if (v === 'order-default') recsChange(function (c) { c.order = R.KEYS.slice(); }, v, 'The default order is back.', 'order');
    else if (v === 'give-default') recsChange(function (c) { c.giveUp = R.GIVE_UP; }, v, 'The allowance is back to ' + R.GIVE_UP + '%.', 'giveUp');
  }
  function setupHtml() {
    var fcs = fcList(), nSubs = fcs.reduce(function (n, f) { return n + Object.keys(subsOf(f.id)).length; }, 0); // W-a: the head says companies and submarines
    var fcPanel = fcs.length ? fcListHtml(fcs, nSubs) : emptyHtml({ id: 'setup-none', kick: 'No free company yet', title: 'Set up your first free company', word: 'Setup', // W-b: Setup with no free company, in the empty-state pattern
      text: esc('Add a free company and its submarines. The guided setup asks for its world, each submarine\'s rank and parts, and the sectors already discovered.'),
      act: '<button type="button" class="btn primary" data-act="new">Start the setup</button>', aside: 'about 3 to 5 minutes per free company' });
    return fcPanel + setupRestHtml();
  }
  function fcListHtml(fcs, nSubs) {
    return '<section class="panel"><h2>Free companies</h2><p class="head-state" aria-hidden="true">' + fcs.length + (fcs.length === 1 ? ' company, ' : ' companies, ') + nSubs + (nSubs === 1 ? ' submarine' : ' submarines') + '</p><p class="muted">' + fcs.length + ' set up' + (fcs.length < MAX_SUGGESTED_FCS ? ' (room on the board for ' + MAX_SUGGESTED_FCS + ' side by side; more also work)' : '') + '. Everything stays editable: rename, change rank or parts, move a free company to another character.</p>' +
      '<ul class="fc-list">' + fcs.map(function (f) {
        var n = Object.keys(subsOf(f.id)).length;
        return '<li><span><b>' + esc(f.fc.name || 'Unnamed') + '</b> <span class="muted">' + esc([f.fc.world, charName(f.fc.charId)].filter(Boolean).join(' · ')) + ' · ' + (f.fc.unlockedSlots || 1) + ' of 4 slots unlocked · ' + n + ' sub' + (n === 1 ? '' : 's') + '</span></span>' +
          '<span class="row"><button type="button" class="btn sm" data-act="edit" data-fc="' + esc(f.id) + '">Edit</button><button type="button" class="btn sm ghost" data-act="remove" data-fc="' + esc(f.id) + '">Remove</button></span>' +
          '<span class="fc-sectors"><button type="button" class="btn sm" data-act="sectors" data-fc="' + esc(f.id) + '" title="Opens the list of sectors to tick; Save keeps it">Sectors already discovered: <b>' + (f.fc.discovered || []).length + ' of ' + D.sectors.length + '</b></button></span></li>';
      }).join('') + '</ul><p><button type="button" class="btn primary" data-act="new">Add a free company</button></p></section>';
  }
  function setupRestHtml() {
    return shownPanelHtml() +
      recsHtml() + accuracyHtml() + '<section class="panel size"><h2>Size of your save</h2><div class="muted" data-size>Measuring…</div></section>' + '<section class="panel"><h2>Backups and other devices</h2><p class="muted">This module is part of the one save. The Tracker\'s Settings make backups and transfer codes and run cloud sync, and they carry your free companies, submarines and voyages too.</p></section>';
  }

  // G8: a tick per free company for the Board, the next-back strip and the fleet-wide send; all ticked until the player changes it
  function shownPanelHtml() {
    var fcs = fcList(), h = hiddenSet();
    if (!fcs.length) return '';
    return '<section class="panel" data-shown-panel><h2>Free companies on the Board</h2><p class="head-state" aria-hidden="true">' + (hiddenCount() ? hiddenCount() + ' hidden' : 'All shown') + '</p><p class="muted">Tick the free companies the Board, its next-back strip and “Send all back, every free company” show. Unticking only hides one: its data stays, its alerts still arrive and Earnings and the Map still include it. Kept in the save, so it follows you to your other devices.</p>' +
      '<div class="ticks shown-ticks">' + fcs.map(function (f) { return '<label class="tick"><input type="checkbox" data-shown-fc="' + esc(f.id) + '"' + (h[f.id] ? '' : ' checked') + '> <b>' + esc(f.fc.name || 'Unnamed') + '</b></label>'; }).join('') + '</div>' +
      '<p class="hint" data-shown-count>' + (hiddenCount() ? hiddenCount() + ' hidden from the Board.' : 'All shown.') + '</p></section>';
  }

  // ------------------------------------------------------------------ guided setup (design 3.6)
  var W = null; // { fcId, step, fc: {...}, subs: [ { id, unlocked, name, rank, parts: [..], voyMode, voyIn, voyAt, voyage, t: {name, rank, parts, voyage} } x4 ], disc: Set, off: Set, slotOff, t }
  function startWizard(fcId, at) {
    var fc = fcId ? S.fcs[fcId] : null, subs = fcId ? subsOf(fcId) : {};
    var ui = {}; try { ui = (JSON.parse(localStorage.getItem('eveniunt-tracker-ui') || '{}') || {}).ui || {}; } catch (e) { /* none */ }
    var liveWorld = ui.live && ui.live.world;
    W = { fcId: fcId || null, step: 0,
      fc: { name: fc ? fc.name || '' : '', world: fc ? fc.world || '' : liveWorld || '', charId: fc ? fc.charId || '' : '' }, start: {},
      subs: [1, 2, 3, 4].map(function (slot) {
        var e = subs[slot], s = e ? e.sub : null;
        return { id: e ? e.id : null, unlocked: slot === 1 || (fc ? slot <= (fc.unlockedSlots || 1) : false), name: s ? s.name || '' : '', rank: s && s.rank ? s.rank : 1,
          parts: s && s.parts ? s.parts.slice() : [null, null, null, null], voyage: s ? s.voyage : null, voyMode: s && s.voyage ? 'keep' : 'none', voyIn: '', voyAt: '', t: {},
          start: { name: s ? s.name || '' : '', rank: s && s.rank ? s.rank : 1 } };
      }),
      disc: new Set(fc && fc.discovered ? fc.discovered : startSectors()), // disc: the ticks the form shows (saved now + on - off)
      on: new Set(fc && fc.discovered ? [] : startSectors()), off: new Set(), t: {} }; // on: sectors the player ticked in this form (a new company starts with the starting sectors); off: sectors the player unticked here; t: fields of the company the player changed here
    W.start = { name: W.fc.name, world: W.fc.world, charId: W.fc.charId }; W.slots0 = formSlots(); // what the form opened with: a field typed back to it is not a change; the slot count it started with
    if (at === 'sectors') W.step = steps().length - 1; // straight to the list of sectors (the same step and the same Save)
    UI.tab = 'setup'; keepUi(); render(); focusWizard();
  }
  // Sectors step: a pair of buttons per sea ticks or unticks that sea in the form only (nothing is saved until Save). Clear keeps the
  // sectors that are open from the start. A later sea says, as information only, when the sector that opens it is not ticked.
  function openerOf(sea) { var id = Object.keys(D.unlocks).find(function (k) { return D.unlocks[k].opensSea === sea.id; }); return id ? SECTOR[+id] : null; }
  function seaNoteText(sea) {
    var o = openerOf(sea); if (!o || W.disc.has(o.id)) return '';
    return 'This sea is opened by ' + o.name.replace(/\s*\([A-Z]\)$/, '') + ' ' + o.letter + ' in ' + SEA[o.sea].name + ', which is not ticked.';
  }
  function seaControls(sea, list) {
    var n = list.length;
    return '<div class="sea-bulk" data-sea-bulk="' + sea.id + '"><div class="row">' +
      '<button type="button" class="btn sm" data-act="seaall" data-sea="' + sea.id + '" aria-label="Mark every sector in ' + esc(sea.name) + ' as discovered (' + n + ' sectors)">Mark every sector in ' + esc(sea.name) + ' as discovered</button>' +
      '<button type="button" class="btn sm ghost" data-act="seanone" data-sea="' + sea.id + '" aria-label="Clear every sector in ' + esc(sea.name) + ' (' + n + ' sectors)">Clear every sector in ' + esc(sea.name) + '</button></div>' +
      '<p class="hint" data-sea-note="' + sea.id + '">' + esc(seaNoteText(sea)) + '</p></div>';
  }
  function refreshSeaNotes() {
    $$('[data-sea-note]').forEach(function (el) { el.textContent = seaNoteText(SEA[+el.dataset.seaNote]); });
  }
  function seaBulk(btn, on) {
    var sea = SEA[+btn.dataset.sea], det = btn.closest('details'), start = startSectors(), live = $('[data-sea-live]');
    var list = D.sectors.filter(function (x) { return x.sea === sea.id; });
    list.forEach(function (x) { if (on) { W.disc.add(x.id); W.on.add(x.id); W.off.delete(x.id); } else if (start.indexOf(x.id) < 0 && W.disc.has(x.id)) { W.disc.delete(x.id); W.on.delete(x.id); W.off.add(x.id); } });
    $$('.ticks input', det).forEach(function (b) { b.checked = W.disc.has(+b.value); });
    var got = list.filter(function (x) { return W.disc.has(x.id); }).length;
    det.querySelector('summary .muted').textContent = got + ' of ' + list.length;
    refreshSeaNotes();
    if (live) live.textContent = on ? 'All ' + list.length + ' sectors of ' + sea.name + ' ticked' : (got ? 'Cleared; ' + got + ' of ' + list.length + ' sectors of ' + sea.name + ' stay ticked because they are open from the start' : 'All sectors of ' + sea.name + ' cleared');
  }
  function formSlots() { var u = 1; for (var i = 1; i < 4 && W.subs[i].unlocked; i++) u = i + 1; return u; }
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
  function keepLabel(cur, now) { return 'Keep: ' + (cur.returnAt > now ? 'back ' + F.fmtClock(cur.returnAt, now) : 'back since ' + F.fmtClock(cur.returnAt, now)); }
  function voyageFields(s, i) {
    var now = Date.now(), cur = s.voyage;
    var opts = (cur ? [['keep', keepLabel(cur, now)]] : [])
      .concat([['none', cur ? 'No voyage (remove it)' : 'No voyage'], ['in', 'Back in (as the game shows)'], ['at', 'Back at a date and time']]);
    return '<fieldset class="voy"><legend>Voyage under way</legend>' + opts.map(function (o) { return '<label class="opt"><input type="radio" name="voy' + i + '" value="' + o[0] + '" data-w="voyMode"' + (s.voyMode === o[0] ? ' checked' : '') + '> ' + esc(o[1]) + '</label>'; }).join('') +
      '<div class="voy-in"' + (s.voyMode === 'in' ? '' : ' hidden') + '><input class="inp" data-w="voyIn" value="' + esc(s.voyIn) + '" placeholder="1d 3h 12m or 27:45" autocomplete="off" aria-label="Time left, as the game shows"></div>' +
      '<div class="voy-at"' + (s.voyMode === 'at' ? '' : ' hidden') + '><input class="inp" type="datetime-local" data-w="voyAt" value="' + esc(s.voyAt) + '" aria-label="Return date and time"></div>' +
      '<p class="hint" data-voy-hint></p></fieldset>';
  }
  var GONE = 'This free company was removed on another device or in another tab, so nothing was saved. Close this form; to bring the company back, set it up again.';
  function wizardHtml() {
    if (W.fcId && !S.fcs[W.fcId]) return '<section class="panel wiz" data-step="gone"><header class="wiz-head"><h2>Edit free company</h2></header><div class="wiz-body"><div class="note bad" role="alert" data-wiz-gone>' + esc(GONE) + '</div></div>' +
      '<footer class="wiz-foot"><span></span><span class="row"><button type="button" class="btn primary" data-act="wcancel">Close</button></span></footer></section>';
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
      body = '<h3>Sectors already discovered</h3><p class="hint">Tick what this free company has found; discoveries are shared by all its submarines. The first two sectors of the Deep-sea Site are open from the start. The Map tab shows them on a chart.</p>' +
        '<p class="visually-hidden" role="status" aria-live="polite" data-sea-live></p>' + unlockNote(0) + D.seas.map(function (sea, k) {
          var list = D.sectors.filter(function (x) { return x.sea === sea.id; });
          var got = list.filter(function (x) { return W.disc.has(x.id); }).length;
          return '<details class="sea in-sea-' + sea.id + '"' + (k === 0 ? ' open' : '') + '><summary>' + esc(sea.name) + ' <span class="muted">' + got + ' of ' + list.length + '</span></summary>' + seaControls(sea, list) + '<div class="ticks">' +
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
  // K1: what the form writes over the saved copy is worked out against the copy saved NOW (another tab, a cloud sync or the return sheet
  // may have saved since the form opened): a field the player did not change in this form (or typed back to what it was when the form
  // opened) keeps its saved-now value, discoveries are the saved-now list plus the sectors ticked in this form minus what the player unticked,
  // and the slot count goes down only when the form ended below the count it started with.
  // R1: the saved copy is read first; a company (or a submarine) removed elsewhere is never written back.
  function saveWizard() {
    if (!W) return;
    var go = function () { if (W) writeWizard(); };
    Promise.resolve(reload()).then(go, go);
  }
  function writeWizard() {
    var fcId = W.fcId || F.newId('f'), now = W.fcId ? S.fcs[W.fcId] : null; // the free company as saved now (none for a new one)
    if (W.fcId && !now) { W.gone = true; render(); return; } // removed elsewhere: nothing is written, the form says so
    var order = W.fcId && S.fcs[fcId] ? S.fcs[fcId].order : fcList().reduce(function (m, f) { return Math.max(m, (f.fc.order || 0) + 1); }, 0);
    var unlocked = formSlots();
    if (now && !(unlocked < W.slots0)) unlocked = Math.max(unlocked, Math.min(4, now.unlockedSlots || 1));
    var tName = W.t.name && W.fc.name.trim() !== (W.start.name || '').trim(), tWorld = W.t.world && W.fc.world !== W.start.world, tChar = W.t.charId && W.fc.charId !== W.start.charId;
    var disc = F.mergeTicks(now && now.discovered, Array.from(W.on), Array.from(W.off));
    var fc = { name: now && !tName ? now.name : W.fc.name.trim(), unlockedSlots: unlocked, order: order || 0, discovered: disc, charId: (now && !tChar ? now.charId : W.fc.charId) || null };
    var world = now && !tWorld ? now.world : W.fc.world;
    if (world) fc.world = world;
    S.fcs[fcId] = fc;
    var missing = [];
    W.subs.forEach(function (s, j) {
      if (!s.unlocked) return; // a slot switched off keeps its sub record; it shows as Locked and nothing is deleted
      if (s.id && !S.subs[s.id]) { missing.push(s.start.name || 'Sub ' + (j + 1)); return; } // removed elsewhere while the form was open: not written back
      var id = s.id || F.newId('s'), prev = S.subs[id] || {}, had = !!S.subs[id], t = s.t || {};
      var tSubName = t.name && s.name.trim() !== (s.start.name || '').trim(), tRank = t.rank && +s.rank !== +s.start.rank;
      var rank = had && !tRank && prev.rank ? prev.rank : +s.rank;
      var rec = { fcId: fcId, slot: j + 1, name: had && !tSubName ? prev.name : s.name.trim() || 'Sub ' + (j + 1), rank: rank, voyage: (had && (!t.voyage || s.voyMode === 'keep') ? prev.voyage : readVoyage(s).voyage) || null };
      if (prev.expIntoRank != null && prev.rank === rec.rank) rec.expIntoRank = prev.expIntoRank; // a new rank starts with no known progress
      if (prev.expExact && prev.rank === rec.rank && (s.voyMode === 'keep' || !prev.voyage || !t.voyage)) rec.expExact = true; // a rank changed in Setup, or a voyage replaced unlogged, is no longer the game's exact point
      var parts = had && !t.parts ? prev.parts : s.parts;
      if (parts && parts.length === 4 && parts.every(function (p) { return p && PART[p] && CLASS[PART[p].class].rank <= rec.rank; })) rec.parts = parts.slice();
      S.subs[id] = rec;
    });
    if (W.off.size) { SH.unticked = SH.unticked || {}; SH.unticked[fcId] = Array.from(W.off); } // R4: told of it if a merge brings any back
    W = null; UI.tab = 'board'; keepUi(); schedule();
    if (missing.length) setStatus(SH.note = missing.map(function (n) { return '“' + n + '”'; }).join(', ') + (missing.length === 1 ? ' was' : ' were') + ' removed on another device or in another tab while the form was open, so ' + (missing.length === 1 ? 'it was' : 'they were') + ' not saved.');
  }
  // the form's ticks follow discoveries that arrive while it is open (never one the player unticked here); the boxes change in place, so focus and scroll stay
  function syncTicks() {
    if (!W) return;
    var now = W.fcId ? S.fcs[W.fcId] : null;
    if (W.fcId && !now) return; // removed elsewhere: reload() shows the message
    W.disc = new Set(F.mergeTicks(now && now.discovered, Array.from(W.on), Array.from(W.off))); // saved now + ticked here - unticked here
    // a voyage changed elsewhere for a submarine whose voyage the player has not touched here: the "Keep: back ..." label shows the
    // new time (only its text changes: no redraw, so focus and scroll stay)
    W.subs.forEach(function (ws, i) {
      var cur = ws.id && S.subs[ws.id] ? S.subs[ws.id].voyage : null;
      if (!ws.id || ws.t.voyage || !cur || !ws.voyage || JSON.stringify(cur) === JSON.stringify(ws.voyage)) return;
      ws.voyage = cur;
      var radio = document.querySelector('.wiz input[data-w=voyMode][name="voy' + i + '"][value=keep]');
      if (radio && radio.nextSibling) radio.nextSibling.nodeValue = ' ' + keepLabel(cur, Date.now());
    });
    $$('.wiz details.sea').forEach(function (det) {
      var boxes = $$('.ticks input', det); boxes.forEach(function (b) { b.checked = W.disc.has(+b.value); });
      var sum = det.querySelector('summary .muted'); if (sum) sum.textContent = boxes.filter(function (b) { return b.checked; }).length + ' of ' + boxes.length;
    });
    if ($('[data-sea-note]')) refreshSeaNotes();
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
  // a tap outside the window closes it (owner request 2026-11-12)
  document.addEventListener('click', function (e) { var d = document.getElementById('sheet'); if (d && d.open && e.target === d) d.close(); });
  // G1: the planner's collapsed list of what the route brings stays as the player left it while the page redraws (this tab only)
  document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('[data-planner-rates]')) { var m = mapState(); if (!!m.rates !== d.open) { m.rates = d.open; keepUi(); } } }, true);
  // G2: a sector on the chart that cannot be added says why when it takes the focus (its accessible name says it too)
  document.addEventListener('focusin', function (e) {
    var n = e.target.closest && e.target.closest('#view [data-sector]'), line = $('[data-cannot-line]'); if (!n || !line) return;
    var w = /^(.*?), rank \d+.*, ((?:cannot be added|out of range if added): .*)$/.exec(n.getAttribute('aria-label') || ''); line.textContent = w ? w[1] + ' ' + w[2] : '';
  });
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
  // the player's own log for the advisor (item S6-2): ranked from the prices already cached on this device, never fetched
  var LOGGED = { list: [], sig: '', note: '' };
  function refreshLogged() {
    var now = Date.now(), c = null;
    try { c = EARN.cached(priceScope()); } catch (e) { c = null; }
    var tot = EARN.totals(S, c ? c.prices : {}, now), seen = c ? EARN.oldest(c, loggedIds()) : null; // the oldest fetch time among the logged items
    // the same log in merchant gil only (item sheet prices, no market price): the unit the community estimate is in, so the two
    // can be compared (drop-rates spec, owner decision Q3). A route with a logged item that has no price entry in the data
    // cannot be counted that way: merchantPerTrip is null and the estimate decides for it.
    var mer = EARN.totals(S, {}, now), unpriced = {};
    Object.keys(S.trips).forEach(function (k) {
      var t = S.trips[k];
      if (t.items && t.items.some(function (x) { return !(D && D.itemInfo && D.itemInfo[x[0]]); })) unpriced[(t.r || []).join(',')] = 1;
    });
    var list = Object.keys(tot.byRoute).sort().map(function (k) {
      var r = tot.byRoute[k], m = mer.byRoute[k];
      return { route: r.route.slice(), trips: r.trips, perTrip: r.perTrip, enough: r.enough, merchantPerTrip: m && !unpriced[k] ? m.perTrip : null };
    });
    LOGGED = {
      list: list,
      note: seen ? 'Market prices seen ' + F.fmtClock(seen, now) + ' on this device.' : 'Merchant prices only; open Earnings to load market prices.',
      sig: JSON.stringify([seen || 0, list.map(function (l) { return [l.route.join(','), l.trips, Math.round(l.perTrip), l.merchantPerTrip == null ? null : Math.round(l.merchantPerTrip)]; })])
    };
    return LOGGED;
  }
  function logInput() { return { logged: LOGGED.list.length ? LOGGED.list : null, enough: EARN.ENOUGH, priceNote: LOGGED.note }; }
  function adviceFor(subId) {
    var s = S.subs[subId], fc = s && S.fcs[s.fcId]; if (!fc) return null;
    // a sub that is back is planned at the rank its voyage brings it to, so the button sends what it shows
    if (s.voyage && s.voyage.returnAt <= Date.now()) { var up = ADV.afterVoyage(s, s.voyage.route); if (up) s = Object.assign({}, s, { rank: up.rank, expIntoRank: up.into }); }
    return advised('board', subId, s, fc, pendingFor(subId), slotsFilled(s.fcId));
  }
  // One advice per sub, kept while every input the advisor reads is unchanged (one entry per caller, so they do not push each other out).
  function advised(tag, subId, s, fc, pending, slots) {
    var key = JSON.stringify([s.rank, s.expIntoRank, s.parts, fc.unlockedSlots, fc.discovered, pending, slots, LOGGED.sig, LOGGED.note, window.RECS.sig(recsNow())]);
    var slot = ADVICE[subId] = ADVICE[subId] || {};
    if (slot[tag] && slot[tag].key === key) return slot[tag].value;
    var v = ADV.advise(Object.assign({ sub: s, fc: fc, pending: pending, slotsFilled: slots }, logInput(), { recs: recsNow() }));
    slot[tag] = { key: key, value: v };
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
  // G3 (gaps spec): a small label on a figure says where it comes from, in the small tag style: calculated (return time, range, the rank after),
  // game data (tanks, base experience), learned (the player's own log, with its voyage count), community estimate
  // S5: a unit is one piece of a joined line; a unit never breaks at a clock or a route (.nb), the separator between units is drawn by CSS outside the unit (never ends or starts a line)
  function nb(h) { return '<span class="nb">' + h + '</span>'; }
  function u(h) { return '<span class="u">' + h + '</span>'; }
  function routeHtml(route) { var t = ADV.routeText(route), i = t.indexOf(': '); return i < 0 ? esc(t) : esc(t.slice(0, i + 1)) + ' ' + nb(esc(t.slice(i + 2))); }
  function src(t) { return ' <span class="tag src">' + esc(t) + '</span>'; }
  function figures(ev, s, now) {
    var after = ADV.rankAfter(s.rank, s.expIntoRank || 0, ev.exp);
    return u('Back <b>' + nb(esc(F.fmtClock(now + ev.seconds * 1000, now))) + '</b> (in ' + nb(F.fmtDur(ev.seconds * 1000, true)) + ')' + src('calculated')) + u('range ' + ev.range + ' of ' + ev.maxRange + src('calculated')) + u(ev.tanks + ' tank' + (ev.tanks === 1 ? '' : 's') + src('game data')) +
      u('at least ' + nb(ev.exp.toLocaleString('en') + ' exp') + src('game data') + (after.rank > s.rank ? ', rank at least ' + after.rank + src('calculated') : ''));
  }
  // the gil-an-hour figures of a plan or another route (Gil Farming leading): the community estimate, and the player's own log where it decided
  function gilSources(x) {
    var DR = window.DROPS, out = '';
    if (x.est) out += DR.fmt.about(DR.fmt.hour(x.est.perHour)) + src('community estimate');
    if (x.own && x.perTrip > 0 && x.trips) out += (out ? ' · ' : '') + DR.fmt.about(DR.fmt.hour(x.perTrip / (x.ev.seconds / 3600))) + src('learned, ' + x.trips + ' voyage' + (x.trips === 1 ? '' : 's'));
    return out;
  }
  // G9 (gaps spec): the rank-up plan of a submarine below the top rank (in the send window only: a line on the Board card made the 8 x 4 Board 1154 px tall at 1920 x 1080, over C25's 1080 limit): the experience still needed to the top rank (the game's rank table, the rank and the
  // experience into it) and the days at the route it is on (its voyage under way) or the route suggested for it. Experience from a route is its base
  // experience, a floor, so "at least". Nothing for a submarine at the top rank or without a known rank.
  function rankPlanFor(id) {
    var s = S.subs[id], fc = s && S.fcs[s.fcId]; if (!fc || !s.rank) return null;
    var now = Date.now(), st = F.status(s, fc, now), v = s.voyage, route = null, seconds = 0, sub = s;
    if (v && v.route && v.route.length) { // a voyage under way, or one that has come back: the route it is on; a returned one counts the rank it brings
      route = v.route; seconds = (v.returnAt - (v.sentAt || v.returnAt)) / 1000;
      if (v.returnAt <= now) { var up = ADV.afterVoyage(s, v.route); if (up) sub = Object.assign({}, s, { rank: up.rank, expIntoRank: up.into }); }
    }
    if (!route || !(seconds > 0)) { var a = st === 'back' || st === 'idle' ? adviceFor(id) : null; if (a && a.plan) { route = a.plan.route; seconds = a.plan.ev.seconds; } else { route = null; seconds = 0; } }
    var plan = ADV.rankUpPlan(sub.rank, sub.expIntoRank || 0, route, seconds);
    return plan ? Object.assign(plan, { route: route }) : null;
  }
  function rankPlanHtml(id) {
    var p = rankPlanFor(id); if (!p) return '';
    var n = function (x) { return Math.round(x).toLocaleString('en'); };
    var days = p.days == null ? '' : p.days >= 10 ? 'about ' + n(p.days) + ' days' : 'about ' + (Math.round(p.days * 10) / 10) + ' days';
    return '<p class="hint rank-plan" data-rank-plan><b>Rank-up plan:</b> ' + n(p.need) + ' experience still needed to reach rank ' + p.top + ' (from rank ' + p.rank + ' and your experience into it' + src('calculated').trimEnd() + ').' +
      (p.perVoyage ? ' On the route ' + esc(ADV.routeText(p.route)) + ', a voyage gives <b>at least ' + n(p.perVoyage) + '</b> experience (base experience; the game adds more' + src('game data').trimEnd() + '), so the top rank comes in no more than ' + n(p.voyages) + ' voyages, ' + days + ' at that rate, sooner if the voyages give more.' : ' No route is planned for it yet, so no time can be given.') + '</p>';
  }
  // W35 (Rev4.7): the suggestion and the other routes are lanes on ONE time axis (the Board's axis component, timeline.js): the discs of the route, a bar to its return and the marker at it.
  // seconds is the voyage length; span is the shared axis in hours; pick: the suggested route (a solid marker and an accent bar), the others are outlined
  function cmpLane(route, seconds, span, pick) {
    var ms = seconds * 1000, over = ms > span * HOUR_MS;
    return '<span class="tl ghost cmp-lane' + (pick ? ' pick' : '') + (over ? ' over' : '') + '" aria-hidden="true" style="--ret:' + TL.pos(ms, span) + '">' + routeDiscs(route) + '<i class="tl-bar"></i><i class="tl-end"></i></span>';
  }
  function cmpAxis(span) {
    return '<div class="tl-axis cmp-axis" aria-hidden="true" data-span="' + span + '">' + TL.ticks(span).map(function (t) { return '<i style="--x:' + t.x + '">' + t.label + '</i>'; }).join('') + '</div>';
  }
  function adviceHtml(id) {
    var s = S.subs[id], a = adviceFor(id), now = Date.now();
    if (!a) return '';
    if (a.blocked) return '<div class="advice"><p class="hint">' + esc(a.blocked) + '</p>' + (a.parts ? '<p class="note" data-range-tip>' + esc(a.parts.why) + '</p>' : '') + '</div>';
    // one span for the suggestion and every other route: the smallest of 12 to 96 hours that holds the longest, so every return time lines up
    var span = TL.span(Math.max.apply(null, [a.plan.ev.seconds].concat((a.alts || []).map(function (x) { return x.ev.seconds; }))) * 1000);
    // every other route says what it is (community route or found by the app), its figure and its reason (spec 6.1)
    var alt = (a.alts || []).map(function (x) {
      var kind = x.kind === 'community' ? 'Community route' : x.kind === 'derived' ? 'Found by the app' : '';
      var fig = x.est ? window.DROPS.fmt.about(window.DROPS.fmt.hour(x.est.perHour)) + ' gil an hour (estimate)' : '';
      var old = x.why && /^(Not enough of your own data|Its items have no known price)/.test(x.why); // the unchanged advisor's two short reasons
      var why = x.why ? (old ? x.why.replace(/;.*$/, '') : x.why) : '';
      return '<li>' + cmpLane(x.route, x.ev.seconds, span, false) + '<button type="button" class="link" data-use="' + x.route.join(',') + '">' + routeHtml(x.route) + '</button> <span class="muted">back ' + nb(esc(F.fmtClock(now + x.ev.seconds * 1000, now))) + '</span>' +
        (kind ? ' <span class="tag" data-alt-kind>' + kind + '</span>' : '') + (fig ? ' <span class="muted" data-alt-figure>' + esc(fig) + '</span>' + src('community estimate') : '') +
        (x.own && x.perTrip > 0 && x.trips ? ' <span class="muted" data-alt-own>' + esc(window.DROPS.fmt.about(window.DROPS.fmt.hour(x.perTrip / (x.ev.seconds / 3600))) + ' gil an hour from your log') + '</span>' + src('learned, ' + x.trips + ' voyage' + (x.trips === 1 ? '' : 's')) : '') +
        (x.vs ? '<br><span class="muted" data-alt-vs>' + esc(x.vs.text + ' (' + F.fmtClock(now + x.ev.seconds * 1000, now) + ')') + '</span>' : '') +
        (why ? '<br><span class="muted" data-alt-why>' + esc(why) + '</span>' : '') + '</li>';
    }).join('');
    return '<div class="advice' + leadVoice(a) + '"><p class="advice-step">' + (a.head ? esc(a.head) : 'Suggested · step ' + a.step + ' of 3: ' + esc(a.stepName)) + (a.goal && !(a.lead && a.step === 3 && a.lead !== 'G') ? ' <span class="muted">(' + esc(a.goal) + ')</span>' : '') + '</p>' +
      '<p class="advice-route"><b>' + routeHtml(a.plan.route) + '</b> <button type="button" class="btn outline" data-act="quick" data-sub="' + esc(id) + '" data-route="' + a.plan.route.join(',') + '">Send on this route</button> <button type="button" class="btn sm" data-use="' + a.plan.route.join(',') + '">Change it first</button></p>' +
      '<p class="hint">' + esc(a.plan.why) + '</p><p class="hint units">' + figures(a.plan.ev, s, now) + '</p>' + (a.lead === 'G' && gilSources(a.plan) ? '<p class="src-line" data-src>Gil an hour: ' + gilSources(a.plan) + '</p>' : '') +
      '<div class="cmp" data-cmp data-span="' + span + '">' + cmpAxis(span) + cmpLane(a.plan.route, a.plan.ev.seconds, span, true) + '</div>' +
      (alt ? '<details open><summary class="hint">Other routes</summary><ul class="alts">' + alt + '</ul></details>' : '') +
      (a.parts ? '<p class="note">' + esc(a.parts.why) + '</p>' : '') + (a.note ? '<p class="note">' + esc(a.note) + '</p>' : '') + '</div>';
  }
  function pickerHtml() {
    var s = S.subs[PICK.id], fc = S.fcs[s.fcId], disc = new Set(fc.discovered || []), now = Date.now();
    var seas = D.seas.filter(function (sea) { return D.sectors.some(function (x) { return x.sea === sea.id && disc.has(x.id); }); });
    if (!seas.length) return '<p class="hint empty-line">No discovered sectors entered for this free company (Setup → Sectors).</p>';
    if (!PICK.sea || !seas.some(function (x) { return x.id === PICK.sea; })) PICK.sea = PICK.route.length ? SECTOR[PICK.route[0]].sea : seas[0].id;
    var st = subStats(s), ev = st && PICK.route.length ? ADV.evalRoute(PICK.route, st) : null;
    var btns = D.sectors.filter(function (x) { return x.sea === PICK.sea && disc.has(x.id); }).map(function (x) {
      var n = PICK.route.indexOf(x.id), low = s.rank && x.rank > s.rank, full = n < 0 && PICK.route.length >= 5;
      var why = low ? 'above this rank' : full ? 'route is full' : ''; // B1: the reason is on the tile, not only in the tooltip
      return '<button type="button" class="sector' + (n >= 0 ? ' on' : '') + '" data-pick="' + x.id + '"' + (low || full ? ' disabled' : '') + ' title="' + esc(x.name + ', rank ' + x.rank + (low ? ' (rank too low)' : '')) + '">' +
        (n >= 0 ? '<span class="ord">' + (n + 1) + '</span>' : '') + '<b>' + esc(x.letter) + '</b><span>' + esc(x.name.replace(/\s*\([A-Z]\)$/, '')) + '</span><small>rank ' + x.rank + '</small>' + (why ? '<small class="why">' + why + '</small>' : '') + '</button>';
    }).join('');
    var calc = '';
    if (!PICK.route.length) calc = '<p class="hint">Tap sectors in the order the sub should visit them (up to 5). The time is worked out as you go.</p>';
    else if (!st) calc = '<p class="hint bad">Enter this sub\'s rank and four parts in Setup so the time can be worked out; until then, type the game\'s time below.</p>';
    else if (!ev.reachable) calc = '<p class="hint bad">Out of range: this route needs range ' + ev.range + ', the build has ' + ev.maxRange + '. Drop a sector or change the order.</p>';
    else calc = '<p class="calc-line units">' + figures(ev, s, now) + '</p><p class="hint"><span class="tag">' + esc(confirmation().text) + '</span></p>' + routeRatesHtml(s, st, ev, PICK.route);
    return '<div class="route-pick in-sea-' + PICK.sea + '"><label class="field">Sea <select class="inp" name="sea">' + seas.map(function (x) { return '<option value="' + x.id + '"' + (x.id === PICK.sea ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="sectors">' + btns + '</div>' +
      '<div class="route-row">' + routeDiscs(PICK.route) + '<p class="route-line">Route: ' + (PICK.route.length ? '<b>' + routeHtml(PICK.route) + '</b> <button type="button" class="link" data-act="pickclear">Clear</button>' : '<span class="muted">none yet</span>') + '</p></div>' + calc + '</div>';
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
  // ------------------------------------------------------------------ what came back (step S5, design 3.3)
  // The items the route can drop, grouped by sector, the ones logged most often on this route first, each with a
  // quantity; "Repeat last" fills in the previous return of this route; any other item can be added by name. New sectors
  // the report mentioned, and a new submarine slot, are ticked here and kept in the free company.
  // G11 (gaps spec): the questions after a voyage, kept outside the collapsed "What came back" block. Which sector did it reveal: ONLY undiscovered sectors that a
  // sector on this route can reveal (the unlock table), by name, letter and sea, none ticked, "None of these" the answer given until one is ticked; nothing at all
  // when the route could reveal nothing new. Where the data says a sector grants a slot or opens the next sea, it is said beside it. A voyage's earlier answers
  // (newSectors, when the Log tab opens an old voyage) stay listed and ticked. This sheet only ever adds to the free company's discoveries (applyFinds).
  function discoveryHtml(subId, route, newSectors) {
    var s = S.subs[subId], fc = S.fcs[s.fcId], disc = new Set(fc.discovered || []);
    var list = ADV.revealable(route, disc); (newSectors || []).forEach(function (c) { if (SECTOR[c] && list.indexOf(c) < 0) list.push(c); });
    var slotSector = (D.subSlots.find(function (u) { return u.slot === (fc.unlockedSlots || 1) + 1; }) || {}).sector;
    var slotTick = slotSector && (route || []).indexOf(slotSector) >= 0, out = '';
    if (list.length) {
      out += '<fieldset class="loot-new" data-reveal><legend>Did this voyage reveal a new sector?</legend><p class="hint">Only sectors this route can reveal and that are not found yet are listed. Nothing is ticked for you, and this never removes a discovery.</p>' +
        list.map(function (c) {
          var x = SECTOR[c], n = ADV.revealNote(c);
          return '<label class="opt"><input type="checkbox" data-new-sector="' + c + '"' + ((newSectors || []).indexOf(c) >= 0 ? ' checked' : '') + '> <b>' + esc(x.name.replace(/\s*\([A-Z]\)$/, '')) + '</b> <span class="muted">' + esc(ADV.sectorName(c)) + '</span>' +
            (n.opens ? ' <span class="tag reveal-note">opens ' + esc(n.opens) + '</span>' : '') + (n.slot ? ' <span class="tag reveal-note">grants submarine slot ' + n.slot + '</span>' : '') + '</label>';
        }).join('') +
        '<label class="opt reveal-none"><input type="checkbox" data-reveal-none' + ((newSectors || []).length ? '' : ' checked') + '> <b>None of these</b></label></fieldset>';
    }
    if (slotTick) out += '<fieldset class="loot-new" data-slot-q><legend>Did this voyage unlock a new submarine slot?</legend><label class="opt"><input type="checkbox" data-new-slot> “Permission granted to register an additional submersible!” <span class="muted">slot ' + ((fc.unlockedSlots || 1) + 1) + '</span></label></fieldset>';
    return out;
  }
  // keeps "None of these" and the sector ticks consistent: ticking a sector clears None, ticking None clears the sectors, nothing ticked means None
  function syncReveal(t) {
    var box = t.closest('[data-reveal]'); if (!box) return;
    var none = $('[data-reveal-none]', box), ticks = $$('[data-new-sector]', box);
    if (t === none) { if (none.checked) ticks.forEach(function (x) { x.checked = false; }); else if (!ticks.some(function (x) { return x.checked; })) none.checked = true; }
    else none.checked = !ticks.some(function (x) { return x.checked; });
  }
  function lootHtml(subId, route, items, newSectors, open) {
    var s = S.subs[subId], fc = S.fcs[s.fcId], disc = new Set(fc.discovered || []);
    var qty = {}; (items || []).forEach(function (x) { qty[x[0]] = x[1]; });
    var hist = EARN.history(S.trips, route), groups = EARN.routeLoot(route), listed = {};
    var row = function (id, avg) { listed[id] = 1; return '<div class="loot-row"><span class="loot-name">' + esc(EARN.name(id)) + (EARN.tradable(id) ? '' : ' <span class="tag">merchant only</span>') +
      (avg ? '<small>' + (avg.items[id] > 0 ? 'community average: about ' + window.DROPS.fmt.qty(avg.items[id]) + ' a voyage' : 'listed as possible, no drop record yet') + '</small>' : '') + '</span>' +
      '<span class="qty"><button type="button" class="qbtn" data-q="-" data-item="' + id + '" aria-label="One less">−</button><input class="inp qinp" type="number" min="0" max="999999" inputmode="numeric" data-qty="' + id + '" value="' + (qty[id] || '') + '" placeholder="0" aria-label="' + esc(EARN.name(id)) + ' quantity"><button type="button" class="qbtn" data-q="+" data-item="' + id + '" aria-label="One more">+</button></span></div>'; };
    var body = route && route.length ? groups.map(function (g) {
      var list = g.items.slice().sort(function (a, b) { return (hist.count[b] || 0) - (hist.count[a] || 0) || EARN.name(a).localeCompare(EARN.name(b)); });
      var avg = window.DROPS.sector(D, g.sector, null), seen = avg ? list.filter(function (id) { return avg.items[id] > 0; }).length : 0;
      return '<div class="loot-group"><div class="loot-h">' + esc(ADV.sectorName(g.sector)) + ' <span class="muted">· ' + list.length + ' possible items (community data)' + (avg ? '; ' + seen + ' with drop records, from ' + window.DROPS.fmt.count(avg.n) + ' community surveys' : '') + '</span></div>' + (list.length ? list.map(function (id) { return row(id, avg); }).join('') : '<p class="hint">No loot list for this sector yet.</p>') + '</div>';
    }).join('') : '<p class="hint empty-line">No route was recorded for this voyage, so add the items by name.</p>';
    var extra = Object.keys(qty).map(Number).filter(function (id) { return !listed[id]; });
    return '<details class="loot"' + (open ? ' open' : '') + '><summary>What came back <span class="muted">(optional: the quantities in the voyage report' + (open ? '' : '; can also be entered later in the Log tab') + ')</span></summary>' +
      '<p class="row">' + (hist.last ? '<button type="button" class="btn sm" data-act="loot-repeat" data-items="' + esc(JSON.stringify(hist.last)) + '">Repeat last</button>' : '') + '<button type="button" class="btn sm ghost" data-act="loot-clear">Clear</button></p>' +
      body + '<div class="loot-group" data-extra>' + (extra.length ? '<div class="loot-h">Other items</div>' + extra.map(function (id) { return row(id); }).join('') : '') + '</div>' +
      '<label class="field">Add another item <input class="inp" list="all-items" data-add-item placeholder="type a name"></label>' +
      '</details>' + discoveryHtml(subId, route, newSectors);
  }
  function readLoot(form) {
    if (!form) return null;
    var items = [];
    $$('[data-qty]', form).forEach(function (el) { var n = Math.round(+el.value); if (n > 0 && n <= 999999) items.push([+el.dataset.qty, n]); });
    return { items: items, newSectors: $$('[data-new-sector]:checked', form).map(function (el) { return +el.dataset.newSector; }), slot: !!$('[data-new-slot]:checked', form) };
  }
  function applyFinds(fcId, loot) { // new sectors join the free company's discoveries; a new slot is unlocked
    var fc = S.fcs[fcId]; if (!fc || !loot) return;
    if (loot.newSectors.length) fc.discovered = Array.from(new Set((fc.discovered || []).concat(loot.newSectors))).sort(function (a, b) { return a - b; });
    if (loot.slot && (fc.unlockedSlots || 1) < 4) fc.unlockedSlots = (fc.unlockedSlots || 1) + 1;
  }
  function addLootRow(form, id) {
    var box = $('[data-extra]', form); if (!box) return;
    if (!box.querySelector('.loot-h')) box.insertAdjacentHTML('afterbegin', '<div class="loot-h">Other items</div>');
    box.insertAdjacentHTML('beforeend', '<div class="loot-row"><span class="loot-name">' + esc(EARN.name(id)) + '</span><span class="qty"><button type="button" class="qbtn" data-q="-" data-item="' + id + '" aria-label="One less">−</button><input class="inp qinp" type="number" min="0" max="999999" inputmode="numeric" data-qty="' + id + '" value="" placeholder="0"><button type="button" class="qbtn" data-q="+" data-item="' + id + '" aria-label="One more">+</button></span></div>');
  }
  function itemsDatalist() { return '<datalist id="all-items">' + Object.keys(D.items).map(function (id) { return '<option value="' + esc(D.items[id]) + '">'; }).join('') + '</datalist>'; }

  // ------------------------------------------------------------------ the Log tab: every voyage, newest first
  var LOGSHOW = 60;
  function logHtml() {
    var now = Date.now(), prices = PRICES.prices || {}, list = Object.keys(S.trips).map(function (k) { return { id: k, t: S.trips[k] }; }).sort(function (a, b) { return (b.t.back || b.t.t) - (a.t.back || a.t.t); });
    if (!list.length) return emptyHtml({ id: 'log-none', kick: 'The log is empty', title: 'No voyages yet', word: 'Log',
      text: esc('Every voyage that ends ("Send again", "Collected" or the one-press send) is kept here. Tap one to enter what came back.'),
      steps: [['route', 'Send a submarine', 'From the Board, on the suggested route or your own.'], ['loot', 'Log what came back', 'When it returns, enter the items in the send window or here.'], ['gil', 'See what it earned', 'Earnings adds it up by route, company and item.']],
      act: '<button type="button" class="btn primary" data-tab="board">Go to the Board</button>' });
    // look only (R3, W25): each row's value is worked out first so the row can carry its sea, whether loot is logged and its gil against the largest shown
    var everyRow = list.map(function (x) { return { x: x, v: EARN.tripValue(x.t, prices) }; }), shown = everyRow.slice(0, LOGSHOW);
    var maxGil = Math.max.apply(null, shown.map(function (r) { return r.v.logged ? +r.v.gil || 0 : 0; }).concat([0]));
    // W34 (Rev4.7): a ledger by day. Before the first row of each local day (the day of the time the row shows) a day rule says the day, its voyages and the gil of its logged rows
    var days = LEDGER.days(shown.map(function (r) { r.at = r.x.t.back || r.x.t.t; return r; })), dayAll = LEDGER.dayInfo(everyRow.map(function (r) { return { at: r.x.t.back || r.x.t.t, logged: r.v.logged, gil: r.v.gil }; })); // a heading counts the whole day, not the rows drawn
    var rowHtml = function (r) {
      var x = r.x, t = x.t, sub = S.subs[t.s] || {}, fc = S.fcs[sub.fcId] || {}, v = r.v, sec = t.r && t.r.length ? SECTOR[t.r[0]] : null;
      var cls = 'log-row' + (sec && sec.sea ? ' in-sea-' + sec.sea : '') + (v.logged ? ' logged' : ' unlogged'), st = v.logged ? ' style="--p:' + (maxGil > 0 ? Math.max(0, (+v.gil || 0) / maxGil).toFixed(3) : '0') + '"' : '';
      return '<button type="button" class="' + cls + '" data-trip="' + esc(x.id) + '"' + st + '><span class="log-when">' + esc(F.fmtClock(t.back || t.t, now)) + '</span><span class="log-disc">' + routeDiscs(t.r) + '</span><span class="log-who"><b>' + esc((fc.name || '?') + ' · ' + (sub.name || 'removed sub')) + '</b><span class="muted">' + esc(t.r && t.r.length ? ADV.routeText(t.r) : 'no route') + (t.rankAfter ? ' · rank ' + t.rankAfter : '') + '</span></span>' +
        '<span class="log-what">' + (t.grade && ADV.GRADES.indexOf(t.grade) >= 0 ? '<span class="log-grade g-' + t.grade.toLowerCase() + '">Grade ' + esc(t.grade) + '</span> ' : '') + (v.logged ? t.items.length + ' item' + (t.items.length === 1 ? '' : 's') + ' · <b>' + fmtGil(v.gil) + '</b>' + (v.unknown.length ? ' + unpriced' : '') : '<span class="muted">nothing logged · tap to add</span>') + '</span></button>';
    };
    var ledger = days.map(function (d) {
      var all = dayAll[d.key], more = LEDGER.shownNote(all.n, d.rows.length);
      return '<div class="log-day" data-day="' + d.key + '"><b>' + esc(LEDGER.dayLabel(d.at, now)) + '</b> <span>' + all.n + ' voyage' + (all.n === 1 ? '' : 's') + ' · ' + (all.logged ? fmtGil(all.gil) + ' logged' : 'nothing logged') + (more ? ' · ' + more : '') + '</span></div>' + d.rows.map(rowHtml).join('');
    }).join('');
    return '<section class="panel wide-panel"><h2>Log</h2><p class="muted">' + list.length + ' voyage' + (list.length === 1 ? '' : 's') + ' kept. Tap one to enter or change what came back.</p>' + (priceNote() ? '<p class="hint" data-price-note>' + esc(priceNote()) + '</p>' : '') + '<div class="log-list">' + ledger + '</div>' + (list.length > LOGSHOW ? '<p><button type="button" class="btn sm" data-act="log-more">Show more</button></p>' : '') + '</section>';
  }
  // ------------------------------------------------------------------ the Map tab (step S4-1): read-only; writes nothing to the save
  function mapState() {
    var fcs = fcList(), m = UI.map || (UI.map = {});
    if (!m.fc || !S.fcs[m.fc]) m.fc = fcs.length ? fcs[0].id : null;
    if (!SEA[m.sea]) m.sea = D.seas[0].id;
    if (m.sector && (!SECTOR[m.sector] || SECTOR[m.sector].sea !== m.sea)) m.sector = null;
    // the planner (step S4-2): the chosen sub must belong to the chosen free company; the route only holds found sectors of this sea
    var sb = m.sub && S.subs[m.sub];
    if (!sb || sb.fcId !== m.fc) { m.sub = null; m.route = []; }
    var disc = new Set((S.fcs[m.fc] && S.fcs[m.fc].discovered) || []);
    m.route = (Array.isArray(m.route) ? m.route : []).filter(function (id, i, a) { return SECTOR[id] && SECTOR[id].sea === m.sea && disc.has(id) && (!sb || !sb.rank || SECTOR[id].rank <= sb.rank) && a.indexOf(id) === i; }).slice(0, 5);
    return m;
  }
  // ------------------------------------------------------------------ drop rates shown (spec 6.5, item D7): content only, one short line per figure
  function rangeText(lo, hi) { return !lo && !hi ? 'none' : lo === hi ? String(lo) : lo + ' to ' + hi; }
  // collapsed, once per screen that shows an estimate (spec 5.4)
  // shares: for each gil figure on the screen the part (0 to 1) that rests on the second-item assumption, computed by DROPS (secondShare); none
  // when the screen has no gil figure of a plan. Said as one sentence: "about 45% of this figure" or the range over the figures shown.
  function secondShareText(shares) {
    var v = (shares || []).filter(function (x) { return typeof x === 'number' && isFinite(x); });
    if (!v.length) return '';
    var lo = Math.round(Math.min.apply(null, v) * 100), hi = Math.round(Math.max.apply(null, v) * 100);
    return lo === hi ? 'About ' + lo + '% of ' + (v.length === 1 ? 'this figure' : 'each gil figure shown here') + ' rests on that assumption.'
      : 'Between ' + lo + '% and ' + hi + '% of the gil figures shown here rest on that assumption.';
  }
  function howEstimatedHtml(shares) {
    var share = secondShareText(shares);
    return '<details class="rates"><summary>How this is estimated</summary>' +
      '<p class="hint">For each sector on the route, the app takes the community\'s drop records and the thresholds the community worked out. A submarine whose surveillance reaches a sector\'s threshold is counted in the higher tier band, and one whose retrieval reaches it in the better quantity; that stat is counted the same however far above the threshold it is. The tier odds are the share of surveys of that band that landed in each tier. The odds of an item inside a tier are what the community recorded, and its quantity is the recorded range for this submarine\'s retrieval, scaled so the community\'s own average comes out. A second item is counted as often as the community recorded it when the favor is enough. Merchant prices are the game\'s. An estimate, not a promise.</p>' +
      '<p class="hint">What the second item is, is not in the records; the estimate assumes it is drawn like the first.' + (share ? ' ' + esc(share) : '') + '</p></details>';
  }
  // Map, the selected sector (spec 6.5 item 1): the record count, the thresholds, one collapsed block per tier with its items
  function sectorRatesHtml(id) {
    var DR = window.DROPS, sec = D.dropRates && D.dropRates.sectors && D.dropRates.sectors[id], b = D.breakpoints && D.breakpoints[id];
    var price = DR.merchant(D), listed = D.loot[id] || [];
    if (!sec) return '<p class="hint' + (listed.length ? '' : ' empty-line') + '">Possible items: ' + (listed.length ? listed.map(function (i) { return esc(EARN.name(i)); }).join(', ') + ' (listed as possible, no drop record yet).' : 'no loot list for this sector yet.') + '</p>';
    var recorded = {}; sec.pools.forEach(function (pl) { pl.items.forEach(function (r) { recorded[r[0]] = 1; }); });
    var out = '<div class="rates"><p class="hint">Community drop records: ' + sec.n.toLocaleString('en') + ' surveys.</p>';
    if (b) out += '<p class="hint">Thresholds (community): surveillance ' + b[0] + ' for tier 2, ' + b[1] + ' for tier 3; retrieval ' + b[2] + ' for normal, ' + b[3] + ' for optimal quantities; favor ' + b[4] + ' for a possible second item' + (sec.favor[0] > 0 ? ' (it came on ' + DR.fmt.pct(sec.favor[1] / sec.favor[0]) + ' of surveys with enough favor)' : '') + '.</p>';
    else out += '<p class="hint">No community thresholds are recorded for this sector.</p>';
    var bandSum = function (k) { return sec.pools[0].band[k] + sec.pools[1].band[k] + sec.pools[2].band[k]; };
    for (var t = 2; t >= 0; t--) {
      var pool = sec.pools[t], rolls = pool.band[0] + pool.band[1] + pool.band[2];
      if (!rolls) continue;
      var head, low = '';
      if (b && bandSum(2) > 0) {
        // what the tier needs (tier 1 needs nothing, tier 2 the lower threshold, tier 3 the higher) and how often a submarine in the strongest band lands in it
        head = 'Tier ' + (t + 1) + (t === 0 ? ' (any surveillance)' : ' (surveillance ' + b[t - 1] + ' or more)') + ': ' + DR.fmt.pct(pool.band[2] / bandSum(2)) + ' of surveys by submarines with surveillance ' + b[1] + ' or more land here';
        var parts = [];
        if (bandSum(1) > 0 && pool.band[1] > 0) parts.push(DR.fmt.pct(pool.band[1] / bandSum(1)) + ' with surveillance ' + b[0] + ' to ' + (b[1] - 1));
        if (bandSum(0) > 0 && pool.band[0] > 0) parts.push(DR.fmt.pct(pool.band[0] / bandSum(0)) + ' with less than ' + b[0]);
        if (parts.length) low = '<p class="hint">Lower: ' + parts.join('; ') + '.</p>';
      } else head = 'Tier ' + (t + 1) + ': ' + DR.fmt.pct(rolls / sec.n) + ' of all recorded surveys';
      var rows = pool.items.slice().sort(function (x, y) { return y[1] - x[1] || x[0] - y[0]; }).map(function (r) {
        var g = price(r[0]);
        return '<p class="rate-item"><b>' + esc(EARN.name(r[0])) + '</b><span>' + DR.fmt.pct(r[1] / rolls) + ' of this tier</span><span>' +
          [rangeText(r[3], r[4]), rangeText(r[5], r[6]), rangeText(r[7], r[8])].join(' / ') + ' by retrieval (poor / normal / optimal)</span><span>' + (g ? Math.round(g).toLocaleString('en') + ' gil each at a merchant' : 'no merchant price') + '</span></p>';
      }).join('');
      out += '<details class="rates-tier" data-tier="' + (t + 1) + '"><summary>' + esc(head) + '</summary>' + low + rows + '</details>';
    }
    var open = listed.filter(function (i) { return !recorded[i]; });
    if (open.length) out += '<p class="hint">Listed as possible, no drop record yet: ' + open.map(function (i) { return esc(EARN.name(i)); }).join(', ') + '.</p>';
    return out + howEstimatedHtml() + '</div>';
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  // the send window and the planner (spec 6.5 item 2, 5.4, 5.5): the estimate for this submarine on the chosen route
  function routeRatesHtml(s, st, ev, route, once) { // once: the caller already heads the block "What this route usually brings" (the planner), so the list is not headed again
    var DR = window.DROPS, r = st && ev && ev.reachable ? DR.route(D, route, st) : null;
    if (!r) return '';
    var now = Date.now(), out = '<div class="rates" data-rates>';
    out += '<p class="hint">' + cap(DR.fmt.about(DR.fmt.voyage(r.gil))) + ' gil a voyage at merchant prices (' + DR.fmt.about(DR.fmt.hour(DR.perHour(r.gil, ev.seconds))) + ' an hour for this submarine): an estimate from community drop records (at least ' + DR.fmt.count(r.count) + ' surveys per sector on this route), not a promise.' + (r.few ? ' Few records for a submarine like this one.' : '') + '</p><p class="src-line" data-src>' + src('community estimate').trim() + '</p>';
    route.forEach(function (sid, i) {
      var b = D.breakpoints && D.breakpoints[sid], x = r.sectors[i], stt = x.state, bits = [];
      if (!b || !stt) bits.push('no community thresholds, the community average is used');
      else {
        bits.push(stt.band === 2 ? 'tier 3 in reach' : 'tier 3 out of reach (surveillance ' + b[1] + ' needed, this submarine has ' + st.surveillance + ')');
        bits.push(stt.ret === 2 ? 'retrieval optimal' : 'retrieval ' + (stt.ret === 1 ? 'normal (' + b[3] + ' needed, this submarine has ' + st.retrieval + ')' : 'poor (' + b[2] + ' needed for normal, this submarine has ' + st.retrieval + ')'));
        bits.push(stt.favor ? 'second item possible' : 'no second item (favor ' + b[4] + ' needed, this submarine has ' + st.favor + ')');
      }
      out += '<p class="hint">' + esc(SECTOR[sid].letter) + ': ' + bits.join(', ') + '</p>';
    });
    var price = DR.merchant(D), ids = Object.keys(r.items).map(Number).filter(function (id) { return r.items[id] > 0; });
    ids.sort(function (a, b) { return r.items[b] * price(b) - r.items[a] * price(a) || a - b; });
    if (ids.length) out += (once ? '<div class="rates-list" data-rates-list>' : '<details class="rates"><summary>What this route usually brings</summary>') + ids.slice(0, 8).map(function (id) {
      return '<p class="rate-item"><b>' + esc(EARN.name(id)) + '</b><span>about ' + DR.fmt.qty(r.items[id]) + ' a voyage</span></p>';
    }).join('') + (once ? '</div>' : '</details>');
    var c = null; try { c = EARN.cached(priceScope()); } catch (e) { c = null; }
    if (c && c.prices && ids.some(function (id) { return c.prices[id]; })) {
      var seenAt = EARN.oldest(c, ids);
      var z = 0; ids.forEach(function (id) { z += r.items[id] * (EARN.unitValue(id, c.prices).each || 0); });
      out += '<p class="hint">At the market prices cached on this device (seen ' + esc(F.fmtClock(seenAt, now)) + '): ' + DR.fmt.about(DR.fmt.voyage(z)) + ' gil a voyage. Not used to choose the route.</p>';
    }
    return out + howEstimatedHtml([r.secondShare]) + '</div>';
  }
  function sectorDetails(id, fc) {
    var s = SECTOR[id], u = D.unlocks[id] || {}, found = (fc.discovered || []).indexOf(id) >= 0;
    var node = CHART.view(s.sea, fc.discovered || []).nodes.find(function (n) { return n.id === id; });
    var by = u.start ? 'open from the start' : u.by != null && SECTOR[u.by] ? esc(sectorLabel(SECTOR[u.by])) + (SECTOR[u.by].sea !== s.sea ? ' (in the previous sea)' : '') : 'not known';
    var ms = mapState(), sbm = ms.sub && S.subs[ms.sub], no = sbm ? ADV.cannotAdd(sbm, fc.discovered || [], ms.route, id) : null;
    var reveals = D.sectors.filter(function (x) { return (D.unlocks[x.id] || {}).by === id; }).map(function (x) { return esc(sectorLabel(x)); });
    return '<section class="chart-details panel" aria-live="polite"><h3><span class="sd-letter" aria-hidden="true">' + esc(s.letter) + '</span><span class="sd-name">' + esc(s.name) + '</span></h3>' +
      (no ? '<p class="cannot-why" data-cannot-why>' + esc(cap(reasonPhrase(no)).replace(/^Cannot be added:/, 'Cannot be added to the planned route:')) + '</p>' : '') +
      '<p class="muted st-' + node.state + '">' + esc(CHART.stateText(node.state)) + (node.slot ? ' · <b>slot ' + node.slot + '</b>' : '') + (node.opens ? ' · <b>opens ' + esc(node.opens) + '</b>' : '') + '</p>' +
      '<dl class="chart-facts"><dt>Rank needed</dt><dd>' + s.rank + '</dd><dt>Tanks</dt><dd>' + s.tanks + '</dd><dt>Survey</dt><dd>' + s.survey + ' min</dd>' +
      '<dt>Base experience</dt><dd>at least ' + Number(s.exp).toLocaleString('en') + '</dd><dt>Stars</dt><dd>' + s.stars + '</dd>' +
      '<dt>Revealed by</dt><dd>' + by + ' <span class="tag" title="Submarine Tracker, MIT; see Credits">community data</span></dd>' +
      '<dt>Reveals</dt><dd>' + (reveals.length ? reveals.join(', ') : 'nothing') + '</dd></dl>' + sectorRatesHtml(id) + '</section>';
  }
  // the route planner: draws and works out a route; it never sends and writes nothing (the send window does that, on the owner's press)
  // G2: for each sector of the shown sea that cannot be added to the planned route, why (ADVISOR.cannotAdd: the rank, not found yet, or the range the
  // route would need, from the planner's own route evaluation); empty without a chosen submarine
  // the words: a sector above the rank or not found cannot be added; one that needs more range can be tapped in, but the route is then out of range
  function reasonPhrase(w) { return (w.kind === 'range' ? 'out of range if added: ' : 'cannot be added: ') + w.text; }
  function cannotMap(fc, m) {
    var sb = m.sub && S.subs[m.sub], out = {};
    if (!sb) return out;
    D.sectors.forEach(function (x) { if (x.sea !== m.sea) return; var w = ADV.cannotAdd(sb, fc.discovered || [], m.route, x.id); if (w) out[x.id] = reasonPhrase(w); });
    return out;
  }
  function plannerHtml(fc, m) {
    var subs = subsOf(m.fc), now = Date.now(), slots = Object.keys(subs).sort(function (a, b) { return a - b; });
    var opts = '<option value="">No submarine chosen</option>' + slots.map(function (k) { return '<option value="' + esc(subs[k].id) + '"' + (subs[k].id === m.sub ? ' selected' : '') + '>' + esc(subs[k].sub.name || 'Sub ' + subs[k].sub.slot) + '</option>'; }).join('');
    var o = '<div class="planner"><label class="field inline">Plan for <select id="map-sub" data-map-sub>' + opts + '</select></label>';
    if (!slots.length) return o + '<p class="hint empty-line">This free company has no submarines entered yet (Setup).</p></div>';
    if (!m.sub) return o + '<p class="hint empty-line">Choose a submarine to plan a route: tap found sectors in the order it should visit them (up to 5).</p></div>';
    var s = S.subs[m.sub], st = subStats(s), route = m.route, ev = st && route.length ? ADV.evalRoute(route, st) : null, status = F.status(s, fc, now);
    var commonAll = (D.commonRoutes || []).filter(function (cr) { return cr.sea === m.sea; }).map(function (cr) {
      var miss = cr.route.some(function (id) { return (fc.discovered || []).indexOf(id) < 0; }), high = cr.route.some(function (id) { return s.rank && SECTOR[id].rank > s.rank; });
      var why = miss ? 'Not every sector is found yet' + (high ? ' and one is above this rank' : '') : high ? 'A sector is above this rank' : '';
      return { cr: cr, why: why };
    });
    // S1: usable routes first, the others after; an unusable one stays disabled (for assistive tech, with the reason in its description) and says why under its name
    var common = commonAll.filter(function (x) { return !x.why; }).concat(commonAll.filter(function (x) { return x.why; })).map(function (x, i) {
      return '<button type="button" class="btn sm' + (x.why ? ' blocked' : '') + '" data-map-use="' + x.cr.route.join(',') + '"' + (x.why ? ' disabled title="' + esc(x.why) + '" aria-describedby="cr-why-' + i + '"' : '') + '><span class="cr-name">' + esc(x.cr.name) + '</span>' + (x.why ? '<span class="cr-why" id="cr-why-' + i + '">' + esc(x.why) + '</span>' : '') + '</button>';
    }).join('');
    var calc;
    if (!route.length) calc = '<p class="hint">Tap found sectors on the chart in the order the sub should visit them (up to 5; tap again to drop one). The time is worked out as you go.</p>';
    else if (!st) calc = '<p class="hint bad">Enter this sub\'s rank and four parts in Setup so the time can be worked out.</p>';
    else if (!ev.reachable) calc = '<p class="hint bad">Out of range: this route needs range ' + ev.range + ', the build has ' + ev.maxRange + '. Drop a sector or change the order.</p>';
    else {
      calc = '<p class="calc-line units">' + figures(ev, s, now) + '</p><p class="hint"><span class="tag">' + esc(confirmation().text) + '</span></p>';
      // G1 (gaps spec): what the chosen route usually brings, the same content as the send window, collapsed until the player opens it (kept open across redraws in this tab)
      var rates = routeRatesHtml(s, st, ev, route, true);
      if (rates) calc += '<details class="planner-rates" data-planner-rates' + (m.rates ? ' open' : '') + '><summary>What this route usually brings</summary>' + rates + '</details>';
    }
    var name = s.name || 'Sub ' + s.slot, out = status === 'out' || status === 'locked';
    var no = cannotMap(fc, m), why = m.sector && no[m.sector] ? SECTOR[m.sector].name + ' ' + no[m.sector] : '';
    return o + '<div class="route-row">' + routeDiscs(route) + '<p class="route-line">Route: ' + (route.length ? '<b>' + routeHtml(route) + '</b> <button type="button" class="link" data-act="mapclear">Clear</button>' : '<span class="muted">none yet</span>') + '</p></div>' +
      (common ? '<p class="hint">Community routes in this sea:</p><div class="cr-list">' + common + '</div>' : '') + calc +
      '<p class="hint">A sector marked with a cross is found but above this submarine\'s rank. Tap or focus any sector that cannot be added (not found yet, above the rank, or out of range if added) to see why.</p><p class="cannot-line" data-cannot-line role="status">' + esc(why) + '</p>' +
      '<p><button type="button" class="btn primary" data-map-send="' + esc(m.sub) + '"' + (!route.length || out ? ' disabled' : '') + '>Send ' + esc(name) + ' on this route…</button>' +
      (status === 'out' && s.voyage ? ' <span class="muted">Out: back ' + esc(F.fmtClock(s.voyage.returnAt, now)) + '</span>' : status === 'locked' ? ' <span class="muted">Not unlocked yet</span>' : '') + '</p>' +
      '<p class="hint">Nothing is sent or saved here; the button opens the send window with this route.</p></div>';
  }
  // opens the existing send window with the planned route loaded (the send window does the sending)
  function planSend(id) {
    var m = mapState(), s = S.subs[id], fc = s && S.fcs[s.fcId]; if (id !== m.sub || !fc || !m.route.length) return;
    var st = F.status(s, fc, Date.now()); if (st === 'out' || st === 'locked') return;
    var route = m.route.slice();
    sendSheet(id, false);
    PICK.route = route; PICK.sea = SECTOR[route[0]].sea; redrawPicker();
  }
  function mapHtml() {
    var fcs = fcList();
    if (!fcs.length) return boardHtml();
    var m = mapState(), fc = S.fcs[m.fc], disc = fc.discovered || [];
    var opts = fcs.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === m.fc ? ' selected' : '') + '>' + esc(f.fc.name || 'Unnamed free company') + '</option>'; }).join('');
    // W35 (Rev4.7): the seven seas as one chain in unlock order; a sea with nothing found is closed; the link before a sea names the sector that opens it
    var seas = D.seas.map(function (sea, i) {
      var n = D.sectors.filter(function (s) { return s.sea === sea.id && disc.indexOf(s.id) >= 0; }).length, op = i ? openerOf(sea) : null;
      var link = op ? '<span class="sea-link">' + routeDiscs([op.id]) + '<span class="sea-link-t">' + esc(ADV.sectorName(op.id)) + ' opens ' + esc(sea.name) + '</span></span>' : '';
      return link + '<button type="button" class="btn sm' + (n ? '' : ' closed') + '" data-map-sea="' + sea.id + '" style="--p:' + (sea.sectors ? Math.round(n / sea.sectors * 1000) / 1000 : 0) + '" aria-pressed="' + (sea.id === m.sea) + '">' + esc(sea.name) + ' <span class="muted">found ' + n + ' of ' + sea.sectors + '</span></button>';
    }).join('');
    var ps = m.sub && S.subs[m.sub], view = CHART.view(m.sea, disc, ps && ps.rank ? ps.rank : null), nFound = view.nodes.filter(function (n) { return n.state === 'found'; }).length;
    var seaName = (D.seas.find(function (x) { return x.id === m.sea; }) || {}).name || '', seaCount = (D.seas.find(function (x) { return x.id === m.sea; }) || {}).sectors;
    var sw = function (cls, shape) { return '<span class="key ' + cls + '"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' + shape + '</svg></span>'; };
    return '<section class="panel wide-panel map-panel"><h2>Map</h2>' +
      '<label class="field inline">Free company <select id="map-fc" data-map-fc>' + opts + '</select></label>' +
      '<div class="map-seas" role="group" aria-label="Sea">' + seas + '</div>' +
      (disc.length ? '' : '<p class="note">Nothing is ticked as found for this free company yet. Tick the sectors in Setup (Edit the free company, sectors step) and they show here.</p>') +
      (nFound ? '' : '<p class="hint empty-line">This sea is not opened yet.</p>') +
      '<div class="map-grid">' + plannerHtml(fc, m) +
      '<div class="chart-wrap' + (m.sub ? ' planning' : '') + '"><header class="chart-head"><span class="chart-sea">' + esc(seaName) + '</span><span class="chart-count">found ' + nFound + ' of ' + seaCount + '</span></header>' + CHART.svg(view, m.sub ? m.route : null, { selected: m.sector, cannot: m.sub ? cannotMap(fc, m) : null }) + '</div>' +
      '<p class="hint chart-key">' + sw('found', '<circle cx="8" cy="8" r="6" fill="currentColor"/>') + ' found · ' + sw('next', '<path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="currentColor"/>') + ' can be revealed next · ' + sw('far', '<rect x="4" y="4" width="8" height="8" fill="currentColor"/>') + ' further away · Start · planned route, numbered · plus: grants a submarine slot · double ring: opens the next sea · ' + sw('above', '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/>') + ' above this submarine\'s rank (dashed outline; ' + sw('cross', '<path d="M3 3L13 13M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>') + ' a found sector that cannot be added) · bright line: the way to the next slot or sea · amber arrow: can be revealed now. The grid, rings and sweep are decoration and measure nothing. Tap a sector for its details.</p>' +
      (m.sector ? sectorDetails(m.sector, fc) : '') + '</div>' +
      '<p class="hint">Drawn by this app from the game\'s position numbers; this is not the game\'s map picture. Depth is not drawn. Which sector reveals which is community data.</p></section>';
  }
  function mapPick(id) {
    var m = mapState(), sb = m.sub && S.subs[m.sub], disc = (S.fcs[m.fc] || {}).discovered || [];
    var why = sb && SECTOR[id].sea === m.sea && m.route.indexOf(id) < 0 ? ADV.cannotAdd(sb, disc, m.route, id) : null;
    // planner tap: add or drop. A sector above the rank or not found is shown with its reason instead; one that only needs more range is still added, as before
    // (the route then shows "Out of range"), because the gaps spec changes no adding behaviour
    if (sb && SECTOR[id].sea === m.sea && (!why || why.kind === 'range')) {
      var at = m.route.indexOf(id);
      if (at >= 0) m.route.splice(at, 1); else if (m.route.length < 5) m.route.push(id);
    } else m.sector = m.sector === id ? null : id; // a sector that cannot be added is shown with its reason instead
    keepUi(); render();
    var n = $('#view [data-sector="' + id + '"]'); if (n) n.focus();
  }

  function fmtGil(n) { return Math.round(n).toLocaleString('en') + ' gil'; }
  function tripSheet(tripId) {
    var t = S.trips[tripId], sub = S.subs[t.s]; if (!t) return;
    if (!sub) { sheet('<h2>Voyage</h2><p class="hint empty-line">This submarine was removed; its voyage is kept in the history.</p><div class="sheet-actions"><button type="button" class="btn ghost" data-act="close">Close</button></div>'); return; }
    var fc = S.fcs[sub.fcId] || {}, now = Date.now();
    sheet('<h2>' + esc((sub.name || 'Sub') + ' · ' + (fc.name || '')) + '</h2><p class="muted">Back ' + esc(F.fmtClock(t.back || t.t, now)) + ' · ' + esc(t.r && t.r.length ? ADV.routeText(t.r) : 'no route recorded') + '</p>' +
      lootHtml(t.s, t.r, t.items, t.newSectors, true) + itemsDatalist() +
      '<div class="sheet-actions"><button type="button" class="btn primary" data-act="trip-save" data-trip="' + esc(tripId) + '">Save</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div>');
  }

  // ------------------------------------------------------------------ the Earnings tab (design 3.5)
  // at: the time of the last answered fetch; seen: the OLDEST fetch time among the logged items that have a price (what "prices seen" says); partial: some batches failed;
  // tried: the last automatic attempt of each price place; running: the place being fetched; queued: the one follow-up request made while a fetch ran.
  var PRICES = { scope: null, at: 0, seen: null, prices: {}, busy: false, error: null, partial: false, tried: {}, running: null, queued: null, drawn: '' };
  function priceScope() { return (S.settings.prefs && S.settings.prefs.priceWorld) || sharedScope(); }
  function sharedScope() { // the place the Tracker's live prices use, else the first free company's world
    try { // the same rule as the Tracker's Market Board: one world, one data centre or (default) the region
      var L = ((JSON.parse(localStorage.getItem('eveniunt-tracker-ui') || '{}') || {}).ui || {}).live || {};
      var region = Object.keys(WORLDS.dc || {}).find(function (r) { return (WORLDS.dc[r].dcs || []).indexOf(L.dc) >= 0; });
      if (L.mscope === 'world' && L.world) return L.world;
      if (L.dc) return L.mscope === 'dc' || !region ? L.dc : region.replace(/ /g, '-');
    } catch (e) { /* none */ }
    var fc = fcList()[0]; return (fc && fc.fc.world) || 'North-America';
  }
  function loggedIds() { var ids = {}; Object.keys(S.trips).forEach(function (k) { (S.trips[k].items || []).forEach(function (x) { ids[x[0]] = 1; }); }); return Object.keys(ids).map(Number); }
  // What the price lines of a drawn screen show: a fetch redraws only when this changes.
  function priceSig() { return JSON.stringify([PRICES.scope, PRICES.at, PRICES.seen, PRICES.busy, priceNote(), PRICES.prices]); }
  // The plain message for a failed fetch (only for the place being shown), with the time of the last real fetch if there is one.
  function priceNote() { return PRICES.error && PRICES.tried[priceScope()] ? EARN.failureNote(PRICES.at, function (t) { return F.fmtClock(t, Date.now()); }) : PRICES.partial && PRICES.tried[priceScope()] ? EARN.PARTIAL_NOTE : ''; }
  // An automatic attempt happens at most once in 15 minutes per price place, whatever its outcome; Refresh (force) tries at once.
  // A Refresh or a change of price place while a fetch runs is not dropped: one follow-up request is kept (the latest) and runs when the running one ends.
  // The result of a fetch for a place that is no longer the chosen one is cached by the fetch but not shown.
  function loadPrices(force) {
    var scope = priceScope(), ids = loggedIds(), now = Date.now();
    if (!ids.length) return;
    if (PRICES.busy) { if (force || scope !== PRICES.running) PRICES.queued = { force: !!(force || (PRICES.queued && PRICES.queued.force)) }; return; }
    var c = EARN.cached(scope); if (c) { PRICES.scope = scope; PRICES.at = c.at; PRICES.seen = EARN.oldest(c, ids); PRICES.prices = c.prices; }
    if (!force && (!EARN.mayTry(PRICES.tried, scope, now, false) || (c && !EARN.needed(c, ids, now).length))) return;
    PRICES.busy = true; PRICES.running = scope; PRICES.tried[scope] = { at: now };
    EARN.fetchPrices(scope, ids, !!force).then(function (r) { if (scope !== priceScope()) return; PRICES.scope = scope; PRICES.at = r.at; PRICES.seen = EARN.oldest(r, ids); PRICES.prices = r.prices; PRICES.error = r.error || null; PRICES.partial = !!r.partial; })
      .catch(function (e) { if (scope === priceScope()) PRICES.error = e.message || String(e); }).then(function () {
        PRICES.busy = false; PRICES.running = null;
        var q = PRICES.queued; PRICES.queued = null;
        if (q) loadPrices(q.force); // the one follow-up starts before the redraw, so the redraw does not start another
        if ((UI.tab === 'earn' || UI.tab === 'log') && priceSig() !== PRICES.drawn) { var y = window.scrollY, x = window.scrollX; render(); if (window.scrollY !== y) window.scrollTo(x, y); }
      });
  }
  function earnHtml() {
    var now = Date.now(), tot = EARN.totals(S, PRICES.prices || {}, now), scope = priceScope();
    if (!tot.trips) return emptyHtml({ id: 'earn-none', kick: 'No earnings yet', title: 'Nothing logged yet', word: 'Earnings',
      text: esc('Earnings come from what you log in each returned voyage (Log tab, or the send window of a returned sub).'),
      steps: [['loot', 'Log a returned voyage', 'Enter what came back in the Log tab.'], ['gil', 'Prices are added', 'The better of the merchant price and the market price after tax.']],
      act: '<button type="button" class="btn primary" data-tab="log">Go to the Log</button>' });
    var rk = EARN.ranked(tot.byRoute);
    var ratio = function (v, m) { return m > 0 ? (Math.max(0, +v || 0) / m).toFixed(3) : '0'; }; // look only: a bar's fill is a ratio of figures already shown
    // W34 (Rev4.7): every table of bars is drawn on one printed "nice" scale (1, 2, 2.5, 5 or 10 times a power of ten, at least its largest figure), so bars compare at a glance
    var maxHr = Math.max.apply(null, rk.ranked.map(function (r) { return +r.perHour || 0; }).concat([0]));
    var maxFc = Math.max.apply(null, fcList().map(function (f) { return +tot.byFc[f.id] || 0; }).concat([0]));
    var scaleHr = TL.niceScale(maxHr), scaleFc = TL.niceScale(maxFc);
    var mer = EARN.totals(S, {}, now), unpriced = {}; // the log in merchant gil only, the unit of the community figure; a route with an item the data has no price for is left out
    Object.keys(S.trips).forEach(function (k) { var t = S.trips[k]; if (t.items && t.items.some(function (x) { return !(D && D.itemInfo && D.itemInfo[x[0]]); })) unpriced[(t.r || []).join(',')] = 1; });
    var seaOf = function (route) { var sc = route && route.length ? SECTOR[route[0]] : null; return sc && sc.sea ? 'in-sea-' + sc.sea : ''; }; // look only: the sea's colour on a route row
    var noteRow = function (route, span) {
      var key = route.join(','), c = window.DROPS.route(D, route, null), m = mer.byRoute[key], bits = [];
      if (c) bits.push('Community average for this route: ' + window.DROPS.fmt.about(window.DROPS.fmt.voyage(c.gil)) + ' gil a voyage at merchant prices (what the community\'s submarines brought back; at least ' + window.DROPS.fmt.count(c.count) + ' surveys per sector).');
      if (m && !unpriced[key]) bits.push('Your own log: ' + window.DROPS.fmt.about(window.DROPS.fmt.voyage(m.perTrip)) + ' gil a voyage at merchant prices over ' + m.trips + ' voyage' + (m.trips === 1 ? '' : 's') + '.');
      return bits.length ? '<tr class="earn-note"><td colspan="' + span + '"><span class="earn-note-text">' + bits.join(' ') + '</span></td></tr>' : '';
    };
    var anyNote = rk.ranked.concat(rk.thin).some(function (r) { return !!window.DROPS.route(D, r.route, null); });
    var subRows = Object.keys(S.subs).concat(Object.keys(tot.bySub).filter(function (k) { return !S.subs[k]; })).map(function (k) {
      var x = S.subs[k], fc = x && S.fcs[x.fcId], b = tot.bySub[k] || { gil: 0, trips: 0 };
      return { id: k, name: x ? (fc && fc.name ? fc.name : 'Unnamed') + ' · ' + (x.name || 'Sub ' + x.slot) : 'Removed submarine', gil: b.gil, trips: b.trips };
    }).sort(function (a, b) { return b.gil - a.gil || a.name.localeCompare(b.name); });
    var maxSub = Math.max.apply(null, subRows.map(function (r) { return r.gil; }).concat([0])), scaleSub = TL.niceScale(maxSub);
    var scaleCap = function (txt) { return '<caption class="earn-scale">' + txt + '</caption>'; };
    var items = Object.keys(tot.byItem).map(function (id) { return [id, tot.byItem[id]]; }).sort(function (a, b) { return b[1].gil - a[1].gil; }).slice(0, 12);
    var dcs = []; Object.keys(WORLDS.dc || {}).forEach(function (r) { dcs.push(r.replace(/ /g, '-')); (WORLDS.dc[r].dcs || []).forEach(function (d) { dcs.push(d); }); });
    var seenTxt = PRICES.seen ? 'Universalis, ' + esc(PRICES.scope) + ', prices seen ' + esc(F.fmtClock(PRICES.seen, now)) : '', pn = priceNote(), src = pn && !(PRICES.partial && !PRICES.error) ? esc(pn) : pn && seenTxt ? seenTxt + ' (' + esc(pn) + ')' : pn ? esc(pn) : seenTxt ? seenTxt : PRICES.busy ? 'Universalis prices loading…' : 'no market prices yet';
    return '<section class="panel wide-panel"><h2>Earnings</h2><p class="muted">Estimated value of what you logged: the better of the merchant price (game data) and the market price after the 5% tax (' + src + '). Not yet sold; market prices are community reports, never a promise. ' + tot.logged + ' of ' + tot.trips + ' voyages logged.</p>' +
      '<div class="earn-cards">' + [['Today', tot.day], ['This week', tot.week], ['This month', tot.month], ['All time', tot.all]].map(function (x) { return '<div class="earn-card"><span>' + x[0] + '</span><b>' + fmtGil(x[1]) + '</b></div>'; }).join('') + '</div>' +
      (Object.keys(tot.unknown).length ? '<p class="hint">No price yet for ' + Object.keys(tot.unknown).map(EARN.name).join(', ') + '; left out of the totals.</p>' : '') +
      '<p class="row"><label class="field inline">Market prices from <select class="inp" data-pref="priceWorld"><option value="">' + esc(priceScope()) + ' (shared place setting)</option>' + dcs.map(function (d) { return '<option' + (S.settings.prefs && S.settings.prefs.priceWorld === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label><button type="button" class="btn sm" data-act="prices">Refresh prices</button><button type="button" class="btn sm" data-act="csv">Export the log (CSV)</button></p>' +
      '<h3>Gil per hour by route <span class="muted">(from your own log)</span></h3>' + (rk.ranked.length || rk.thin.length ? '<p class="hint">Logged gil divided by logged hours at sea, at the prices shown above.</p>' +
        (rk.ranked.length ? '<h4>Ranked</h4><table class="earn-t earn-ranked">' + scaleCap('Bars run from 0 to ' + fmtGil(scaleHr) + ' an hour') + '<thead><tr><th>Position</th><th>Route</th><th>Gil per hour</th><th>Gil per voyage</th><th>Voyages</th></tr></thead><tbody>' + rk.ranked.map(function (r) { return '<tr data-pos="' + r.pos + '" class="' + seaOf(r.route) + '" style="--p:' + ratio(r.perHour, scaleHr) + '"><td>' + r.pos + '</td><td>' + routeDiscs(r.route) + routeHtml(r.route) + '</td><td><b>' + fmtGil(r.perHour) + '</b></td><td>' + fmtGil(r.perTrip) + '</td><td>' + r.trips + '</td></tr>' + noteRow(r.route, 5); }).join('') + '</tbody></table>' : '') +
        (rk.thin.length ? '<h4>Not enough data yet</h4><table class="earn-t earn-thin"><thead><tr><th>Route</th><th>Gil per hour</th><th>Voyages</th></tr></thead><tbody>' + rk.thin.map(function (r) { return '<tr class="' + seaOf(r.route) + '"><td>' + routeDiscs(r.route) + routeHtml(r.route) + '</td><td><b>' + fmtGil(r.perHour) + '</b></td><td><span class="tag">' + r.trips + ' of ' + EARN.ENOUGH + ' voyages</span></td></tr>' + noteRow(r.route, 3); }).join('') + '</tbody></table>' : '') + (anyNote ? howEstimatedHtml(rk.ranked.concat(rk.thin).map(function (r) { var c = window.DROPS.route(D, r.route, null); return c ? c.secondShare : null; })) : '')
        : '<p class="hint empty-line">Log what came back from voyages with a route to see this.</p>') +
      '<h3>By free company</h3><table class="earn-t">' + scaleCap('Bars run from 0 to ' + fmtGil(scaleFc)) + '<tbody>' + fcList().map(function (f) { return '<tr style="--p:' + ratio(tot.byFc[f.id] || 0, scaleFc) + '"><td>' + esc(f.fc.name || 'Unnamed') + '</td><td><b>' + fmtGil(tot.byFc[f.id] || 0) + '</b></td></tr>'; }).join('') + '</tbody></table>' +
      '<h3>By submarine</h3><table class="earn-t" data-earn-subs>' + scaleCap('Bars run from 0 to ' + fmtGil(scaleSub)) + '<tbody>' + subRows.map(function (r) { return '<tr style="--p:' + ratio(r.gil, scaleSub) + '"><td>' + esc(r.name) + (r.trips ? ' <span class="muted">' + r.trips + ' voyage' + (r.trips === 1 ? '' : 's') + ' logged</span>' : '') + '</td><td><b>' + fmtGil(r.gil) + '</b></td></tr>'; }).join('') + '</tbody></table>' +
      '<h3>Top items</h3><table class="earn-t"><thead><tr><th>Item</th><th>Quantity</th><th>Value</th><th>Priced by</th></tr></thead><tbody>' + items.map(function (x) { return '<tr><td>' + esc(EARN.name(x[0])) + '</td><td>' + x[1].qty.toLocaleString('en') + '</td><td>' + fmtGil(x[1].gil) + '</td><td>' + (x[1].how || 'unknown') + '</td></tr>'; }).join('') + '</tbody></table></section>';
  }

  // what the app has learned from the owner's exact returns (rank and experience typed), per voyage grade
  function learned() { return ADV.learn(Object.keys(S.trips).map(function (k) { return S.trips[k]; })); }
  // the voyage that ended becomes a trip (with what came back, if logged) and the voyage is cleared; the sub's rank and
  // experience move on by the learned estimate for the noted grade (base, "at least", when nothing is learned), or to the
  // rank and experience the owner typed (then exact: s.expExact)
  function logTrip(subId, rankFix, loot) {
    var s = S.subs[subId], v = s && s.voyage;
    if (!v) return;
    var rep = rankFix && typeof rankFix === 'object' ? rankFix : { rank: rankFix || 0, into: null, grade: '' };
    var t = v.sentAt || v.returnAt;
    var trip = { s: subId, t: t, r: (v.route || []).slice(), back: v.returnAt, items: loot ? loot.items : [], newSectors: loot ? loot.newSectors : [] };
    applyFinds(s.fcId, loot);
    if (v.calcAt) trip.calc = v.calcAt;
    if (v.gameSaid) trip.said = v.gameSaid;
    if (rep.grade) trip.grade = rep.grade;
    var after = ADV.afterVoyage(s, v.route), need0 = ADV.expToNext(s.rank), into0 = s.expIntoRank || 0;
    var possible = need0 != null && into0 >= 0 && into0 < need0, startExact = !!s.expExact && possible; // an impossible saved point is not exact
    var from = { rank: s.rank, into: possible ? into0 : 0 }; // and its progress is unknown (0, "at least")
    var typed = rep.rank && rep.rank >= (s.rank || 1) && rep.rank <= 145 ? rep.rank : 0;
    if (after) {
      trip.rankCalc = after.rank; trip.expBase = after.exp;
      // the estimate: the base experience times what this grade has given on the owner's own voyages (base if nothing learned)
      var est = ADV.rankAfter(from.rank, from.into, Math.round(after.exp * ADV.factorFor(learned(), rep.grade)));
      if (typed && rep.into != null) {
        // exact: the game's rank and progress. The experience really gained is learned from only when the starting point
        // was exact too (the previous return was typed); otherwise earlier voyages' bonus would be counted as this one's.
        var got = ADV.expBetween(from.rank, from.into, typed, rep.into);
        if (startExact && got != null && got > 0) trip.expGot = got;
        s.rank = typed; s.expIntoRank = rep.into; s.expExact = true;
      } else if (typed && typed !== est.rank) { s.rank = typed; s.expIntoRank = typed === after.rank ? after.into : typed === from.rank ? from.into : 0; s.expExact = false; }
      else { s.rank = est.rank; s.expIntoRank = est.into; s.expExact = false; }
      trip.rankAfter = s.rank;
    } else if (typed) { s.rank = typed; s.expIntoRank = rep.into != null ? rep.into : typed === from.rank ? from.into : 0; s.expExact = rep.into != null; trip.rankAfter = typed; }
    else { s.expExact = false; if (!possible) s.expIntoRank = 0; } // a voyage without a route moved the rank by an unknown amount
    S.trips[F.tripId(subId, t)] = trip;
    s.voyage = null;
  }
  function openSub(id) {
    var s = S.subs[id], fc = s && S.fcs[s.fcId]; if (!fc) return;
    var now = Date.now(), st = F.status(s, fc, now), v = s.voyage, name = esc((s.name || 'Sub ' + s.slot) + ' · ' + (fc.name || ''));
    if (st === 'out') {
      sheet('<h2 class="st-out">' + name + '</h2><dl class="facts"><dt>Back</dt><dd>' + esc(F.fmtClock(v.returnAt, now)) + ', in ' + F.fmtDur(v.returnAt - now, true) + ' <span class="tag">' + (v.gameSaid ? 'from the game (typed)' : esc(confirmation().text)) + '</span></dd>' +
        (v.calcAt && v.gameSaid && Math.abs(v.calcAt - v.returnAt) > 60000 ? '<dt>Worked out</dt><dd>' + esc(F.fmtClock(v.calcAt, now)) + ' (the game\'s time is used)</dd>' : '') +
        (v.gameSaid ? '<dt>You typed</dt><dd>' + esc(v.gameSaid) + '</dd>' : '') + (v.sentAt ? '<dt>Sent</dt><dd>' + esc(F.fmtClock(v.sentAt, now)) + '</dd>' : '') + (v.route && v.route.length ? '<dt>Route</dt><dd>' + esc(routeText(v.route)) + '</dd>' : '') + '</dl>' +
        (v.calcAt && !v.gameSaid ? '<details class="game-says"><summary>Check against the game <span class="muted">(optional: type the time the game shows)</span></summary>' + timeFields('t', 'in', '') + '<p><button type="button" class="btn" data-act="check" data-sub="' + esc(id) + '">Check</button></p></details><p class="wiz-err" data-err role="alert"></p>' : '') +
        rankPlanHtml(id) +
        '<div class="sheet-actions"><button type="button" class="btn primary" data-act="ics" data-sub="' + esc(id) + '">Add to calendar</button><button type="button" class="btn" data-act="retime" data-sub="' + esc(id) + '">Change this voyage</button>' +
        '<button type="button" class="btn ghost" data-act="unsend" data-sub="' + esc(id) + '">Remove this voyage (sent by mistake)</button><button type="button" class="btn ghost" data-act="close">Close</button></div>');
      return;
    }
    if (st === 'locked') return;
    sendSheet(id, false);
  }
  function sendSheet(id, retime) {
    refreshLogged();
    var s = S.subs[id], fc = S.fcs[s.fcId], now = Date.now(), st = F.status(s, fc, now), v = s.voyage;
    PICK = { id: id, route: retime && v ? (v.route || []).slice() : [], sea: null };
    var head = retime ? 'Change this voyage' : 'Send ' + (s.name || 'Sub ' + s.slot);
    sheet('<h2 class="st-' + st + '">' + esc(head) + ' <span class="muted">' + esc(fc.name || '') + ' · rank ' + (s.rank || '?') + ' · ' + partsCode(s.parts) + '</span></h2>' +
      (st === 'back' && !retime ? '<p class="note">Back since ' + esc(F.fmtClock(v.returnAt, now)) + '. Sending again logs that voyage in the history, with what came back if you enter it here (or later, in the Log tab).</p>' + lootHtml(id, v.route, [], []) + itemsDatalist() + rankField(id) : '') +
      (retime ? '' : adviceHtml(id) + rankPlanHtml(id)) + '<div data-picker>' + pickerHtml() + '</div>' +
      '<details class="game-says"' + (!subStats(s) ? ' open' : '') + '><summary>The game says… <span class="muted">(optional: type the game\'s return time to check the worked-out one)</span></summary>' + timeFields('t', 'in', '') + '</details>' +
      '<p class="wiz-err" data-err role="alert"></p><div class="sheet-actions"><button type="button" class="btn primary" data-act="' + (retime ? 'dore' : 'dosend') + '" data-sub="' + esc(id) + '">' + (retime ? 'Save' : st === 'back' ? 'Send again' : 'Send') + '</button>' +
      (st === 'back' && !retime ? '<button type="button" class="btn" data-act="collect" data-sub="' + esc(id) + '">Collected, not sent</button>' : '') +
      '<button type="button" class="btn ghost" data-act="close">Cancel</button></div><p class="hint">Rank moves on by itself when a voyage is logged (at least the base experience); type the rank and experience the game shows above to keep it exact.</p>');
    previewTime($('#sheet form'), 't');
  }
  // suggestions for several subs sent together: each one counts the routes already given to the ones before it, so
  // subs looking for new sectors split the discoveries instead of all taking the same route
  function planAll(ids) {
    var taken = [], out = {};
    ids.forEach(function (id) {
      var s = S.subs[id], fc = S.fcs[s.fcId];
      if (s.voyage && s.voyage.returnAt <= Date.now()) { var up = ADV.afterVoyage(s, s.voyage.route); if (up) s = Object.assign({}, s, { rank: up.rank, expIntoRank: up.into }); }
      var a = advised('plan', id, s, fc, pendingFor(id).concat(taken), slotsFilled(s.fcId));
      out[id] = a;
      if (a && a.plan) taken = taken.concat(a.plan.route);
    });
    return out;
  }
  // one press: send this sub on its suggested route, with the worked-out return time
  // shown: the route the send window showed (sector ids); the button sends exactly that one, worked out for the sub as it is
  // after the return is logged. If it cannot be sent then, nothing is sent and the window opens again with fresh advice.
  function quickSend(id, rankFix, loot, shown) {
    var s = S.subs[id], now = Date.now();
    if (!s) return;
    if (s.voyage && s.voyage.returnAt <= now) logTrip(id, rankFix, loot); // the rank moves on first, so the suggestion fits it
    refreshLogged();
    var route, ev;
    if (shown && shown.length) {
      var fc = S.fcs[s.fcId], disc = new Set((fc && fc.discovered) || []), st = subStats(s);
      var okRoute = !!st && shown.length <= 5 && shown.every(function (x) { return SECTOR[x] && disc.has(x) && SECTOR[x].rank <= (s.rank || 0); });
      ev = okRoute ? ADV.evalRoute(shown, st) : null;
      if (!ev || !ev.reachable) {
        schedule(); openSub(id);
        var h2 = $('#sheet h2'); if (h2) h2.insertAdjacentHTML('afterend', '<p class="note" data-reopened>' + esc('The return was logged, and the suggested route changed, so nothing was sent. Check the route below and send again.') + '</p>');
        return;
      }
      route = shown.slice();
    } else {
      var a = adviceFor(id);
      if (!a || !a.plan) { schedule(); openSub(id); return; }
      route = a.plan.route.slice(); ev = a.plan.ev;
    }
    s.voyage = { sentAt: now, route: route, returnAt: now + ev.seconds * 1000, calcAt: now + ev.seconds * 1000 };
    closeSheet(); schedule();
    setStatus((s.name || 'Sub ' + s.slot) + ' sent: ' + ADV.routeText(route) + ', back ' + F.fmtClock(s.voyage.returnAt, now) + '.');
  }
  // after a voyage: the voyage grade, the rank the game shows and the experience into it (optional). Typing the rank and
  // the experience makes the app exact and teaches it what each grade gives; the estimate shown uses what it has learned.
  function rankField(id) {
    var s = S.subs[id], a = s.voyage && ADV.afterVoyage(s, s.voyage.route), L = learned();
    var grades = '<label class="field">Voyage grade <select class="inp" name="grade"><option value="">not noted</option>' + ADV.GRADES.map(function (g) { return '<option>' + g + '</option>'; }).join('') + '</select></label>';
    var lead = a ? '<p>This voyage gave at least <b>' + a.exp.toLocaleString('en') + '</b> experience: rank <b>' + (a.rank > s.rank ? s.rank + ' → at least ' + a.rank : 'at least ' + a.rank + ' (no rank up)') + '</b>.' +
      (L.n ? ' <span class="muted">Learned from ' + L.n + ' of your voyages; with the grade noted, the estimate uses it.</span>' : ' <span class="muted">Type the rank and experience the game shows to make it exact; the app learns from them what each grade gives.</span>') + '</p>' : '';
    return '<div class="rankbox">' + lead + '<div class="rankrow">' + grades +
      '<label class="field rankfix">Rank the game shows <input class="inp" type="number" name="rankfix" min="' + (s.rank || 1) + '" max="145" placeholder="' + (a ? 'at least ' + a.rank : 'optional') + '" inputmode="numeric"></label>' +
      '<label class="field rankfix">Experience into that rank <input class="inp" type="number" name="intofix" min="0" placeholder="optional" inputmode="numeric"></label></div></div>';
  }
  // what the owner typed must be something the game can show: experience needs its rank; the rank cannot go down; the
  // experience is less than that rank needs to go up. '' when fine.
  function rankFixError(id, rep) {
    var s = S.subs[id]; if (!s || !s.voyage) return '';
    if (rep.bad) return rep.bad;
    var need = ADV.expToNext(s.rank);
    if (s.expExact && need != null && (s.expIntoRank || 0) < need && rep.rank === s.rank && rep.into != null && rep.into < (s.expIntoRank || 0)) return 'The experience cannot be lower than before the voyage (' + (s.expIntoRank || 0).toLocaleString('en') + ' into rank ' + s.rank + '); check the number the game shows.';
    if (rep.rank && !ADV.expToNext(rep.rank) && rep.rank !== 145) return 'The rank is a whole number from 1 to 145.';
    if (rep.into != null && !rep.rank) return 'Type the rank the game shows too (the experience belongs to a rank).';
    if (rep.rank && rep.rank < (s.rank || 1)) return 'The rank cannot be lower than before the voyage (' + s.rank + ').';
    var need = rep.rank ? ADV.expToNext(rep.rank) : null;
    if (rep.into != null && need != null && rep.into >= need) return 'Rank ' + rep.rank + ' needs ' + need.toLocaleString('en') + ' experience to go up; check the number the game shows.';
    // from an exact start, what the typed point says this voyage gave must be in the range the app learns from (half to
    // four times the route's base): an unchanged or mistyped point would otherwise be stored as exact and the next voyage
    // would be credited with this one's experience
    var a = ADV.afterVoyage(s, s.voyage.route), n0 = ADV.expToNext(s.rank);
    // with or without a route: a voyage always gives experience, so from an exact start the very same point is a copy of the
    // old figure, not what the game shows now (at the top rank the game may stop counting)
    if (s.expExact && rep.rank && rep.into != null && n0 != null && (s.expIntoRank || 0) < n0 && s.rank < 145 && ADV.expBetween(s.rank, s.expIntoRank || 0, rep.rank, rep.into) === 0)
      return 'That is the same rank and experience as before the voyage (' + (s.expIntoRank || 0).toLocaleString('en') + ' into rank ' + s.rank + '); a voyage always gives experience. Check the number the game shows.';
    if (s.expExact && a && a.exp > 0 && rep.rank && rep.into != null && n0 != null && (s.expIntoRank || 0) < n0) {
      var got = ADV.expBetween(s.rank, s.expIntoRank || 0, rep.rank, rep.into);
      if (got != null && (got < a.exp * 0.5 || got > a.exp * 4)) return 'That would mean this voyage gave ' + got.toLocaleString('en') + ' experience; this route gives about ' + a.exp.toLocaleString('en') + ' or more. Check the rank and experience the game shows.';
    }
    return '';
  }
  function readRankFix(form) {
    var bad = '';
    var num = function (n, what) { var el = form && form.elements[n]; if (!el) return null; if (el.validity && el.validity.badInput) { bad = bad || 'The ' + what + ' is a whole number, as the game shows it.'; return null; } if (String(el.value).trim() === '') return null; var v = +el.value; if (Number.isInteger(v) && v >= 0) return v; bad = bad || 'The ' + what + ' is a whole number, as the game shows it.'; return null; };
    var g = form && form.elements.grade ? form.elements.grade.value : '';
    var rank = num('rankfix', 'rank'), into = num('intofix', 'experience');
    if (rank === 0) bad = bad || 'The rank is a whole number from 1 to 145.';
    return { rank: rank && rank >= 1 ? rank : 0, into: into, grade: ADV.GRADES.indexOf(g) >= 0 ? g : '', bad: bad };
  }
  // "Send all back": one sheet for one free company (fcIds = [id]) or, with `fleet`, for every shown free company (G7, gaps spec): the same rows, the same
  // "Send" (dosendall, one code path), each submarine with its own tick, grouped by free company; nothing is sent until the player confirms.
  // planGroups: the suggestions of several subs sent together, worked out per free company (a company's subs split its own discoveries; another company's do not count)
  function planGroups(ids) {
    var by = {}, order = [], out = {};
    ids.forEach(function (id) { var f = S.subs[id].fcId; if (!by[f]) { by[f] = []; order.push(f); } by[f].push(id); });
    order.forEach(function (f) { Object.assign(out, planAll(by[f])); });
    return out;
  }
  function sendAllSheet(fcIds, fleet) {
    refreshLogged();
    var now = Date.now();
    var groups = fcIds.map(function (fcId) {
      var fc = S.fcs[fcId], subs = subsOf(fcId);
      return { fcId: fcId, fc: fc, list: Object.keys(subs).map(function (k) { return subs[k]; }).filter(function (e) { var st = F.status(e.sub, fc, now); return st === 'back' || st === 'idle'; }) };
    }).filter(function (g) { return g.list.length; });
    var plans = planGroups([].concat.apply([], groups.map(function (g) { return g.list.map(function (e) { return e.id; }); })));
    var row = function (g, e) {
      var st = F.status(e.sub, g.fc, now), a = plans[e.id], plan = a && a.plan;
      return '<label class="opt"><input type="checkbox" name="pick" value="' + esc(e.id) + '" checked> ' + esc(e.sub.name || 'Sub ' + e.sub.slot) + ' <span class="chip ' + st + '">' + F.LABEL[st] + '</span> <span class="muted">' +
        (plan ? routeHtml(plan.route) + ' · back ' + nb(esc(F.fmtClock(now + plan.ev.seconds * 1000, now))) : esc(a && a.blocked ? 'needs rank and parts: uses the time typed below' : 'no route')) + '</span></label>';
    };
    var head = fleet ? 'Send all back subs <span class="muted">every free company</span>' : 'Send all back subs <span class="muted">' + esc(groups.length ? groups[0].fc.name || '' : '') + '</span>';
    sheet('<h2>' + head + '</h2><p class="hint">Each goes on its suggested route, with its own worked-out time. Subs that are back have their voyage logged first. ' + (fleet ? 'Untick any submarine to leave it out. ' : '') + 'Change any one by tapping it on the board instead.</p>' +
      (groups.length ? groups.map(function (g) {
        return (fleet ? '<h3 class="pick-fc" data-pick-fc="' + esc(g.fcId) + '">' + esc(g.fc.name || 'Unnamed free company') + '</h3>' : '') + '<div class="pick">' + g.list.map(function (e) { return row(g, e); }).join('') + '</div>';
      }).join('') : '<p class="hint empty-line">No submarine is back or waiting to be sent.</p>') +
      '<details class="game-says"><summary>The game says… <span class="muted">(only for subs without rank and parts)</span></summary>' + timeFields('t', 'in', '') + '</details>' +
      '<p class="wiz-err" data-err role="alert"></p><div class="sheet-actions"><button type="button" class="btn primary" data-act="dosendall">Send</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div>');
    previewTime($('#sheet form'), 't');
  }
  function sheetError(text) { var p = $('#sheet [data-err]'); if (p) p.textContent = text; }
  function calendar(title, at, uid) {
    F.download(F.fileName(title), F.ics({ title: title, at: at, uid: uid, note: 'Return time typed from the game in the Eveniunt Command Center (Submersibles).' }));
  }

  // ------------------------------------------------------------------ events
  function onClick(e) {
    var rb = e.target.closest('button[data-rec]');
    if (rb) { if (!rb.disabled) onRecsClick(rb); return; }
    var qb = e.target.closest('[data-q]');
    if (qb) { var qi = $('[data-qty="' + qb.dataset.item + '"]', qb.closest('form') || document); if (qi) qi.value = Math.max(0, (Math.round(+qi.value) || 0) + (qb.dataset.q === '+' ? 1 : -1)) || ''; return; }
    var tb = e.target.closest('[data-trip]:not([data-act])');
    if (tb) { tripSheet(tb.dataset.trip); return; }
    var qk = e.target.closest('[data-quick]');
    if (qk) { quickSend(qk.dataset.quick); return; }
    var ms = e.target.closest('[data-map-sea]');
    if (ms) { var m1 = mapState(); m1.sea = +ms.dataset.mapSea; m1.sector = null; m1.route = []; keepUi(); render(); return; }
    var mu = e.target.closest('[data-map-use]');
    if (mu && !mu.disabled) { var m3 = mapState(); m3.route = mu.dataset.mapUse.split(',').map(Number); keepUi(); render(); return; }
    var mw = e.target.closest('[data-map-send]');
    if (mw) { if (!mw.disabled) planSend(mw.dataset.mapSend); return; }
    var mc = e.target.closest('[data-act=mapclear]');
    if (mc) { var m4 = mapState(); m4.route = []; keepUi(); render(); return; }
    var mn = e.target.closest('#view [data-sector]');
    if (mn) { mapPick(+mn.dataset.sector); return; }
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
      case 'sectors': closeSheet(); startWizard(b.dataset.fc, 'sectors'); break;
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
      case 'seaall': case 'seanone': if (W) seaBulk(b, b.dataset.act === 'seaall'); break;
      case 'dosend': case 'dore': {
        var id = b.dataset.sub, s = S.subs[id];
        var sentAt = act === 'dore' && s.voyage && s.voyage.sentAt ? s.voyage.sentAt : now;
        var plan = planVoyage(form, sentAt);
        if (plan.error) { sheetError(plan.error); break; }
        if (act === 'send' || act === 'dosend') { if (s.voyage) { var rep = readRankFix(form), bad = rankFixError(id, rep); if (bad) { sheetError(bad); break; } logTrip(id, rep, readLoot(form)); } }
        s.voyage = plan.voyage;
        if (plan.differs) setStatus('The game\'s time differs from the worked-out one by ' + plan.differs + ' min; the game\'s time is used and kept as evidence.');
        closeSheet(); schedule(); break;
      }
      case 'collect': { var repc = readRankFix(form), badc = rankFixError(b.dataset.sub, repc); if (badc) { sheetError(badc); break; } logTrip(b.dataset.sub, repc, readLoot(form)); closeSheet(); schedule(); break; }
      case 'unsend': if (confirm('Remove this voyage? Nothing is logged for it.')) { S.subs[b.dataset.sub].voyage = null; S.subs[b.dataset.sub].expExact = false; closeSheet(); schedule(); } break; // if it did run in the game, its experience is unknown
      case 'retime': sendSheet(b.dataset.sub, true); break;
      case 'ics': { var sub = S.subs[b.dataset.sub], f = S.fcs[sub.fcId]; calendar((f.name || 'Free company') + ' · ' + (sub.name || 'Sub ' + sub.slot) + ' back', sub.voyage.returnAt, b.dataset.sub + '-' + sub.voyage.returnAt); break; }
      case 'ics-fc': {
        var fcx = S.fcs[b.dataset.fc], all = subsOf(b.dataset.fc), last = null;
        Object.keys(all).forEach(function (k) { var x = all[k].sub; if (F.status(x, fcx, now) === 'out' && (!last || x.voyage.returnAt > last.voyage.returnAt)) last = x; });
        if (last) calendar((fcx.name || 'Free company') + ' · last sub back (' + (last.name || 'Sub ' + last.slot) + ')', last.voyage.returnAt, b.dataset.fc + '-last-' + last.voyage.returnAt);
        break;
      }
      case 'sendall': sendAllSheet([b.dataset.fc], false); break;
      case 'sendallfleet': sendAllSheet(shownFcs().map(function (f) { return f.id; }), true); break;
      case 'dosendall': {
        var picks = $$('input[name=pick]:checked', form).map(function (x) { return x.value; }), t = readTime(form, 't');
        if (!picks.length) { sheetError('Pick at least one submarine.'); break; }
        picks.forEach(function (pid) { var x = S.subs[pid]; if (x && x.voyage) logTrip(pid); }); // ranks move on first
        refreshLogged();
        var plans = planGroups(picks);
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
      case 'quick': { var repq = readRankFix(form), badq = rankFixError(b.dataset.sub, repq); if (badq) { sheetError(badq); break; } quickSend(b.dataset.sub, repq, readLoot(form), (b.dataset.route || '').split(',').map(Number).filter(function (x) { return x > 0; })); break; }
      case 'loot-repeat': { var rep = JSON.parse(b.dataset.items || '[]'); $$('[data-qty]', form).forEach(function (el) { el.value = ''; }); rep.forEach(function (x) { var el = $('[data-qty="' + x[0] + '"]', form); if (!el) { addLootRow(form, x[0]); el = $('[data-qty="' + x[0] + '"]', form); } if (el) el.value = x[1]; }); break; }
      case 'loot-clear': $$('[data-qty]', form).forEach(function (el) { el.value = ''; }); break;
      case 'trip-save': {
        var tr = S.trips[b.dataset.trip]; if (!tr) break;
        var lo = readLoot(form); tr.items = lo.items; tr.newSectors = lo.newSectors;
        var ts = S.subs[tr.s]; if (ts) applyFinds(ts.fcId, lo);
        closeSheet(); schedule(); break;
      }
      case 'log-more': LOGSHOW += 100; render(); break;
      case 'archive': {
        var before = new Date(new Date().getFullYear() - 1, 0, 1).getTime(), arc = EARN.archive(S, before);
        if (!arc.count) { setStatus('No voyages came back before that date.'); break; }
        F.download('submersibles-archive-before-' + new Date(before).getFullYear() + '.json', JSON.stringify(arc), 'application/json');
        if (!confirm('The file with ' + arc.count + ' voyage' + (arc.count === 1 ? '' : 's') + ' was downloaded. Keep it safe, then remove these voyages from the save? (Load the file back here to bring them back.)')) break;
        Object.keys(arc.trips).forEach(function (k) { delete S.trips[k]; });
        setStatus(arc.count + ' old voyages moved to the archive file.'); schedule(); break;
      }
      case 'prices': loadPrices(true); render(); break;
      case 'csv': F.download('submersibles-log-' + new Date().toISOString().slice(0, 10) + '.csv', EARN.csv(S, PRICES.prices || {}, function (r) { return r && r.length ? ADV.routeText(r) : ''; }), 'text/csv;charset=utf-8'); break;
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
    if (t.matches && t.matches('[data-rec-find]')) { if (e.type === 'input') recNarrow(t); return; }
    if (t.matches && t.matches('select[data-rec]') && e.type === 'change') {
      var si = +t.dataset.rec.slice(5), sv = +t.value, sname = sv ? (D.items[sv] || 'Item ' + sv) : '';
      recsChange(function (c) { c.loot[si][0] = sv; }, t.dataset.rec, sv ? 'Loot item ' + (si + 1) + ': ' + sname + '.' : 'Loot item ' + (si + 1) + ' is cleared.', recDupOf(si) ? si : -1);
      return;
    }
    if (t.matches && t.matches('[data-rec]') && t.tagName === 'INPUT') {
      if (t.dataset.rec === 'giveUp') {
        var gt = $('[data-rec-give-text]'); if (gt) gt.textContent = t.value + '%'; // while dragging only the shown number moves
        if (e.type === 'change') { var gv = +t.value; recsChange(function (c) { c.giveUp = gv; }, 'giveUp', 'The allowance is ' + gv + '%.'); }
      } else if (/^loot-on-\d$/.test(t.dataset.rec) && e.type === 'change') { var oi = +t.dataset.rec.slice(8), ov = t.checked; recsChange(function (c) { c.loot[oi][1] = ov; }, t.dataset.rec, 'Picker ' + (oi + 1) + (ov ? ' is on.' : ' is off; its choice is kept.')); }
      else if (t.dataset.rec === 'fuel' && e.type === 'change') { var fv = t.checked; recsChange(function (c) { c.fuel = fv; }, 'fuel', fv ? 'Fuel efficiency is on.' : 'Fuel efficiency is off.'); }
      return;
    }
    if (t.matches && t.matches('[data-map-fc]')) { var m2 = mapState(); m2.fc = t.value; m2.sector = null; m2.sub = null; m2.route = []; keepUi(); render(); return; }
    if (t.matches && t.matches('[data-map-sub]')) { var m5 = mapState(); m5.sub = t.value || null; m5.route = []; keepUi(); render(); return; }
    if (t.dataset.shownFc && e.type === 'change') { setFcShown(t.dataset.shownFc, t.checked); var again = $('[data-shown-fc="' + t.dataset.shownFc + '"]'); if (again) again.focus(); return; }
    if (t.closest('#sheet')) {
      if (t.matches('[data-add-item]')) { // an item picked from the list joins "Other items" with a quantity of 1
        var nm = t.value.trim().toLowerCase(), id = Object.keys(D.items).find(function (k) { return D.items[k].toLowerCase() === nm; });
        if (id) { var f0 = t.closest('form'); if (!$('[data-qty="' + id + '"]', f0)) addLootRow(f0, +id); var q0 = $('[data-qty="' + id + '"]', f0); if (q0) { q0.value = q0.value || 1; q0.focus(); } t.value = ''; }
        return;
      }
      if (t.matches('[data-new-sector], [data-reveal-none]')) { syncReveal(t); return; }
      if (t.matches('[data-qty], [data-new-slot]')) return;
      if (t.name === 'sea') { if (PICK && e.type === 'change') { PICK.sea = +t.value; if (PICK.route.length && SECTOR[PICK.route[0]].sea !== PICK.sea) PICK.route = []; redrawPicker(); } return; }
      previewTime($('#sheet form'), 't');
      if (/^t(in|at|mode)$/.test(t.name)) redrawPicker();
      return;
    }
    if (t.matches('[data-archive-file]') && e.type === 'change' && t.files && t.files[0]) {
      t.files[0].text().then(function (txt) { var n = EARN.restore(S, JSON.parse(txt)); setStatus(n ? n + ' voyage' + (n === 1 ? '' : 's') + ' loaded back from the archive.' : 'Every voyage in that file is already in the save.'); if (n) schedule(); })
        .catch(function (err) { setStatus('Could not load that file: ' + (err.message || err)); });
      t.value = ''; return;
    }
    if (t.dataset.pref === 'priceWorld' && e.type === 'change') { S.settings.prefs = Object.assign({}, S.settings.prefs || {}, { priceWorld: t.value || undefined }); if (!t.value) delete S.settings.prefs.priceWorld; schedule(); loadPrices(true); return; }
    if (t.dataset.pref && e.type === 'change') {
      var pr = Object.assign({}, S.settings.prefs || {});
      if (t.dataset.pref === 'grouping') pr.grouping = t.value;
      else if (t.dataset.pref === 'night') pr.night = t.value;
      else { var q = Object.assign({ from: 22 * 60, to: 8 * 60 }, pr.quietHours || {}), m = minutes(t.value); if (m == null) return; q[t.dataset.pref === 'qfrom' ? 'from' : 'to'] = m; pr.quietHours = q; }
      S.settings.prefs = pr; schedule(); return;
    }
    if (!W || !t.dataset.w) return;
    var key = t.dataset.w, st = steps(), step = st[Math.min(W.step, st.length - 1)], s = /^sub/.test(step) ? W.subs[+step.slice(3) - 1] : null;
    if (key === 'fc.name') { W.fc.name = t.value; W.t.name = true; }
    else if (key === 'fc.world') { W.fc.world = t.value; W.t.world = true; }
    else if (key === 'fc.charId') { W.fc.charId = t.value; W.t.charId = true; }
    else if (key === 'disc') { if (t.checked) { W.disc.add(+t.value); W.on.add(+t.value); W.off.delete(+t.value); } else { W.disc.delete(+t.value); W.on.delete(+t.value); W.off.add(+t.value); } var sum = t.closest('details').querySelector('summary .muted'); var all = t.closest('.ticks').querySelectorAll('input'); sum.textContent = Array.prototype.filter.call(all, function (x) { return x.checked; }).length + ' of ' + all.length; refreshSeaNotes(); }
    else if (s && key === 'unlocked') { s.unlocked = t.checked; if (!t.checked) { for (var k = W.subs.indexOf(s) + 1; k < 4; k++) W.subs[k].unlocked = false; } render(); }
    else if (s && key === 'name') { s.name = t.value; s.t.name = true; }
    else if (s && key === 'rank') {
      s.rank = t.value === '' ? '' : +t.value; s.t.rank = true; s.t.parts = true; // a new rank refreshes the parts lists, so the form then writes the parts
      if (e.type === 'change' && Number.isInteger(s.rank) && s.rank >= 1) { // refresh the parts lists for the new rank
        $$('select[data-w=part]').forEach(function (sel) { var j = +sel.dataset.j; sel.innerHTML = partOptions(j, s.rank, s.parts[j]); s.parts[j] = sel.value ? +sel.value : null; });
      }
    }
    else if (s && key === 'part') { s.parts[+t.dataset.j] = t.value ? +t.value : null; s.t.parts = true; }
    else if (s && key === 'voyMode') { s.voyMode = t.value; s.t.voyage = true; var fs = t.closest('fieldset'); fs.querySelector('.voy-in').hidden = t.value !== 'in'; fs.querySelector('.voy-at').hidden = t.value !== 'at'; voyHint(s, fs); }
    else if (s && key === 'voyIn') { s.voyIn = t.value; s.t.voyage = true; voyHint(s, t.closest('fieldset')); }
    else if (s && key === 'voyAt') { s.voyAt = t.value; s.t.voyage = true; voyHint(s, t.closest('fieldset')); }
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
    // the axis changes its span when the longest return or suggestion crosses 12, 24, 48 or 72 hours: redraw then
    var ax = $('.tl-axis'), T = null;
    if (ax) { T = boardAxis(now, true); if (+ax.dataset.span !== T.span) { if (!(dlg && dlg.open)) render(); return; } }
    $$('[data-until]').forEach(function (el) { el.textContent = F.fmtDur(+el.dataset.until - now, true); });
    $$('[data-since]').forEach(function (el) { el.textContent = F.fmtDur(now - +el.dataset.since); });
    $$('[data-voy]').forEach(function (el) {
      var p = F.voyageProgress({ sentAt: +el.dataset.sent, returnAt: +el.dataset.ret }, now);
      if (p === null) return;
      el.style.setProperty('--p', p.toFixed(4));
      var t = el.nextElementSibling; if (t && t.hasAttribute('data-voy-text')) t.textContent = 'Voyage ' + Math.floor(p * 100) + ' percent done';
    });
    if (!T) return;
    // the bar and the marker of each Out lane, and the notches of each axis, follow the clock (no transition: one step a second)
    $$('.tl[data-ret]').forEach(function (el) { var ms = +el.dataset.ret - now, over = ms > T.span * HOUR_MS; el.style.setProperty('--ret', String(TL.pos(ms, T.span))); el.classList.toggle('over', over); el.classList.toggle('out', !over); });
    $$('.tl-axis').forEach(function (a) {
      var html = axisMarksHtml((a.dataset.rets || '').split(',').filter(Boolean).map(Number), T.span, now);
      if (a.__marks === html) return;
      a.__marks = html; $$('.tl-mark', a).forEach(function (m) { m.remove(); }); a.insertAdjacentHTML('beforeend', html);
    });
    // each lane's accessible name keeps its return current
    $$('.sub[data-lbl]').forEach(function (el) { var w = el.querySelector('.when'), t = el.dataset.lbl + '; ' + (w ? w.textContent : '') + '. Press Enter to open it.'; if (el.getAttribute('aria-label') !== t) el.setAttribute('aria-label', t); });
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
  document.addEventListener('keydown', function (e) { var r = e.target; if ((e.key === 'Enter' || e.key === ' ') && r.closest && r.matches('#view [data-sector]')) { e.preventDefault(); mapPick(+r.dataset.sector); return; } if ((e.key === 'Enter' || e.key === ' ') && r.classList && r.classList.contains('sub') && r.dataset.sub) { e.preventDefault(); openSub(r.dataset.sub); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.closest && e.target.closest('#sheet') && e.target.tagName === 'INPUT' && !e.target.matches('[data-add-item], [data-qty]')) { e.preventDefault(); var p = $('#sheet [data-act="quick"]') || $('#sheet .btn.primary'); if (p) p.click(); /* S6: the suggestion's button is an outline now, so it is named first: Enter still sends on the suggested route */ } });
  if (CC) CC.onChange(reload);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && SH.timer) write(); else if (document.visibilityState === 'visible') { reload(); tick(); } });
  window.addEventListener('pagehide', function () { if (SH.timer) write(); });
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).then(function (reg) {
      // look for a newer version on every opening and whenever the app comes back to the screen (installed apps on a
      // phone stay in memory for days); a new version takes over and the page reloads once, outside the guided setup
      reg.update().catch(function () { /* offline */ });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { /* offline */ }); });
    }).catch(function () { /* works without offline support */ });
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; } // the first worker taking over is not an update
      if (W || (dlg && dlg.open) || SH.timer) return; // never in the middle of something; the next opening picks it up
      try { if (sessionStorage.getItem('eveniunt-subs-reloaded')) return; sessionStorage.setItem('eveniunt-subs-reloaded', '1'); } catch (e) { return; }
      location.reload();
    });
  }

  Promise.all([loadData(), loadSave()]).then(function () {
    credits(); render();
    window.__subs.alerts = F.startAlerts({ section: function () { return SH.ready ? S : null; }, link: null });
    pushSync();
    setInterval(tick, 1000);
    document.documentElement.dataset.ready = '1';
  }).catch(function (e) {
    $('#view').innerHTML = '<div class="note bad"><b>The Submersibles data could not be opened on this browser.</b> ' + esc(e.message || e) + '</div>';
  });
  window.__subs = { stageOf: function (id) { return stageOf(id); }, section: function () { return S; }, itemName: function (id) { return EARN.name(id); }, archiveAt: function (pct) { ARCHIVE_PCT = pct; }, write: write, startWizard: startWizard, state: function () { return { ready: SH.ready, problem: SH.problem, rev: SH.rev }; } };
})();
