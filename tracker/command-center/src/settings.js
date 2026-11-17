// Eveniunt Command Center: the main Settings (owner request 2026-11-12: "the settings should be outside in the main menu
// of the app"). Opened from the main menu (#settings). The Tracker keeps its own Settings too; both change the same save.
// - Characters and their free companies: names here are the Tracker's characters (one save); a free company typed here
//   becomes that character's free company in Submersibles (modules.submersibles.fcs, linked by charId).
// - Cloud sync: sign in once per device, sync now, sign out; a signed-in device syncs every module when this page opens.
//   The sign-in goes through the Tracker's registered return address (tracker/oauth.html) and comes back here.
// - Backups: a backup file and a transfer code of the whole save.
// - Notifications: on or off for this device, a test, and the night rule for every module (modules.settings.notify).
// - Appearance: light, dark, or as the device.
// Uses the Tracker's core scripts (core/*.js, the same code the Tracker runs), save.js, and submersibles/fleet.js and push.js.
(function () {
  'use strict';
  var CC = window.CC, ET = window.ET, F = window.FLEET, PUSH = window.PUSH;
  if (!CC || !ET) return;
  ET.CLOUD_BASE = new URL('tracker/', location.href).href;
  var HOSTED = /^https?:$/.test(location.protocol);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var box = $('#settings'), home = $('#home');
  var ST = null, DOC = null, REV = null, CFG = null, busy = null, last = '', foldProblem = '', foldAllowed = false;

  // ------------------------------------------------------------------ reading the save
  function load() {
    return Promise.all([ET.loadState(), CC.read()]).then(function (x) {
      ST = x[0]; REV = x[1].rev;
      try { DOC = x[1].raw != null ? CC.checkDoc(x[1].raw) : CC.emptyDoc(); foldAllowed = true; } catch (e) { DOC = null; foldAllowed = false; last = 'The save cannot be used here: ' + e.message; }
    });
  }
  function section(name) { return (DOC && DOC.modules[name]) || null; }
  function writeRaw(name, sec) {
    var base = section(name) ? JSON.parse(JSON.stringify(section(name))) : null;
    return CC.writeSection(name, sec, { rev: REV, base: base }).then(function (r) {
      var kind = CC.kind; // this write's own result, taken before any other read changes it
      REV = r.rev; DOC = r.doc; return adopt().then(function () { return kind; });
    });
  }
  function writeSection(name, sec) { return writeRaw(name, sec).then(function (kind) { return foldOwn().then(function () { return kind; }); }); }
  // Duplicate bare free companies of one character (two tabs or devices adding one) are folded as the save is taken in:
  // written only when something was removed, inside the queue; a second pass removes nothing, so there is no loop.
  function foldOwn() {
    // A foreign or newer save is intentionally not writable; do not attempt cleanup or append cleanup feedback.
    if (!DOC || !foldAllowed) return Promise.resolve(null);
    return CC.foldSection('submersibles', F.foldFcs).then(function (r) {
      foldProblem = '';
      if (r.doc) { REV = r.rev; DOC = r.doc; return adopt(); }
    }, function () { foldProblem = 'Duplicate free company cleanup could not be saved.'; });
  }
  // After this page writes, its state and the shared code's base become the save as stored (a peek read, taken the way the
  // Tracker's screen takes another window's save): the next character save then neither writes back a copy older than
  // what is stored nor counts other pages' later changes as this page's own.
  function adopt() { return ET.loadState(true).then(function (st) { if (st) { ET.acceptLoaded(); ST = st; refreshCode(); } }); }
  // The page's edits run one at a time, each changing ST inside its step, so no edit works on a state another replaces.
  var queue = Promise.resolve();
  function step(fn) { var p = queue.then(fn); queue = p.catch(function () { /* the next edit still runs */ }); return p; }
  // Another page stored a change: the page takes the stored save in (its sections, its state and the shared code's base),
  // inside the queue so that no edit is working on the state it replaces; the fields follow through fill().
  var hearing = false;
  function hear() { if (hearing) return; hearing = true; step(function () { hearing = false; return reread().then(adopt).then(foldOwn).then(fill); }).catch(function () { /* the page keeps what it shows */ }); }
  function reread() { return CC.read().then(function (r) { try { DOC = r.raw != null ? CC.checkDoc(r.raw) : CC.emptyDoc(); REV = r.rev; foldAllowed = true; } catch (e) { foldAllowed = false; /* retain the last readable view, but never write or clean the unreadable save */ } }); }
  function fcOf(charId) { var s = section('submersibles'); if (!s) return null; var id = Object.keys(s.fcs || {}).find(function (k) { return s.fcs[k].charId === charId; }); return id ? { id: id, fc: s.fcs[id] } : null; }

  // ------------------------------------------------------------------ the page
  function render(quiet) {
    if (!box) return;
    var code = quiet && $('[data-code]', box) ? $('[data-code]', box).innerHTML : '', push = quiet && $('[data-push-status]', box) ? $('[data-push-status]', box).textContent : null;
    var chars = ST ? ST.chars : [];
    var n = chars.length;
    var night = (section('settings') && section('settings').notify) || {};
    var q = night.quietHours || { from: 22 * 60, to: 8 * 60 };
    var theme = ''; try { theme = ((JSON.parse(localStorage.getItem('eveniunt-tracker-ui') || '{}') || {}).theme) || ''; } catch (e) { /* none */ }
    var cs = ET.cloudState();
    box.innerHTML = '<h1>Settings</h1><p class="muted">For the whole Command Center. The Tracker\'s own Settings change the same save.</p>' +
      (last || foldProblem ? '<p class="set-msg" role="status">' + esc([last, foldProblem].filter(Boolean).join(' ')) + '</p>' : '') +
      // cloud sync
      '<section class="set-card"><h2>Cloud sync</h2><p class="muted">A private copy in your own OneDrive keeps every device the same: characters, Tracker ticks, Submersibles and the rest. Sign in once per device (on an iPhone, the home-screen app and Safari each once); after that it syncs by itself.</p>' +
      '<p class="set-status">' + (!HOSTED ? 'Works on the published site only.' : !CFG ? 'Cloud sync is not set up on this site.' : cs.device ? 'This device is signed in' + (cs.since ? ' since ' + esc(new Date(cs.since).toLocaleDateString()) : '') + '.' + (ST && ST.sync && ST.sync.drive ? ' Last sync ' + esc(new Date(ST.sync.drive.at).toLocaleString()) + '.' : '') : 'This device is not signed in.') + '</p>' +
      '<p class="row">' + (cs.device ? '<button type="button" class="btn" data-act="sync">Sync now</button><button type="button" class="btn ghost" data-act="signout">Sign out on this device</button>' : '<button type="button" class="btn primary" data-act="signin"' + (HOSTED && CFG ? '' : ' disabled') + '>Sign in with Microsoft</button>') + '</p></section>' +
      // characters and free companies
      '<section class="set-card"><h2>Characters and free companies</h2><p class="muted">The characters every module shares. The free company you type here appears in Submersibles, ready for its submarines. Starting class and Grand Company are in the Tracker\'s Settings.</p>' +
      '<label class="set-row">How many characters <select class="inp" data-set="count">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (k) { return '<option' + (k === Math.max(n, 1) ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      (n ? '<div class="set-chars">' + chars.map(function (c, i) {
        var f = fcOf(c.id), placeholder = /^Character \d$/.test(c.name);
        return '<div class="set-char"><span class="set-num">' + (i + 1) + '</span>' +
          '<label class="set-lab">Character name<input class="inp" data-set="name" data-id="' + esc(c.id) + '" value="' + esc(placeholder ? '' : c.name) + '" maxlength="40" placeholder="Character ' + (i + 1) + ': type the name"></label>' +
          '<label class="set-lab">Free company<input class="inp" data-set="fc" data-id="' + esc(c.id) + '" value="' + esc(f ? f.fc.name || '' : '') + '" maxlength="40" placeholder="Its free company (optional)"></label></div>';
      }).join('') + '</div>' : '<p><button type="button" class="btn" data-act="first">Add my first character</button></p>') + '</section>' +
      // backups
      '<section class="set-card"><h2>Backups</h2><p class="muted">A file or a code with your whole save, for another device or safekeeping. Loading one, and importing desktop-app saves, is in the Tracker\'s Settings (Import and backup).</p>' +
      '<p class="row"><button type="button" class="btn" data-act="backup"' + (ST ? '' : ' disabled') + '>Save a backup file</button><button type="button" class="btn" data-act="code"' + (ST ? '' : ' disabled') + '>Make a transfer code</button><a class="btn ghost" href="tracker/#settings">Open the Tracker\'s Settings</a></p><div data-code></div></section>' +
      // notifications
      '<section class="set-card"><h2>Notifications</h2><p class="muted">Your phone or computer is told when something is due, even with the app closed (today: submarines coming back; how they are grouped is chosen in Submersibles, Setup). Turn them on separately on each device. The choices below are kept even while notifications are off.</p>' +
      '<p class="set-status" data-push-status>Checking…</p>' +
      '<p class="row"><button type="button" class="btn primary" data-act="push-on">Turn on for this device</button><button type="button" class="btn" data-act="push-test">Send a test</button><button type="button" class="btn ghost" data-act="push-off">Turn off for this device</button></p>' +
      '<fieldset class="set-field"><legend>At night</legend>' +
      '<label class="set-opt"><input type="radio" name="night" value="always" data-set="night"' + (night.night !== 'quiet' ? ' checked' : '') + '> <b>Always alert</b> <span class="muted">alerts come whenever something is due</span></label>' +
      '<label class="set-opt"><input type="radio" name="night" value="quiet" data-set="night"' + (night.night === 'quiet' ? ' checked' : '') + '> <b>Quiet hours</b> <span class="muted">alerts in these hours wait until they end</span></label>' +
      '<p class="row">From <input class="inp" type="time" data-set="qfrom" value="' + hhmm(q.from) + '"> to <input class="inp" type="time" data-set="qto" value="' + hhmm(q.to) + '"></p></fieldset>' +
      '<p class="muted small">Android and computers: Chrome, Edge or Firefox. iPhone and iPad: only from the Command Center added to the home screen (Apple\'s rule). Needs cloud sync signed in on that device.</p></section>' +
      // appearance: the full panel the Tracker and the Atelier have (every theme, accent, colours, contrast, motion), saved
      // for every page (owner request 2026-11-12: "the main menu settings needs to have everything theme related")
      '<section class="set-card"><h2>Appearance</h2><p class="muted">For every page of the Command Center: the main menu, the Tracker, the Atelier and Submersibles.</p><div id="s-appearance" class="appearance">' + (window.EVENIUNT_LOOK ? window.EVENIUNT_LOOK.html() : '') + '</div><p class="muted small" data-look-msg></p></section>';
    if (code) $('[data-code]', box).innerHTML = code;
    if (push != null) $('[data-push-status]', box).textContent = push; else pushStatus();
    if (window.EVENIUNT_LOOK && box.querySelector('#s-appearance')) window.EVENIUNT_LOOK.bind(box);
  }
  // Redrawing for a change the user did not make here (another page's, a sync's): while a field of the page has the focus
  // (typing, an open choice list, a shown transfer code) nothing is redrawn, so its text, caret and list stay; the redraw
  // runs once no field has the focus. A shown transfer code and the notification status are carried over.
  // Exception: a focused field that is pristine (nothing typed) and can be found again is redrawn and gets the focus and
  // caret back, so the redraw also runs when the focus moves to another field. No redraw while a button is being pressed.
  var stale = false, pressing = false;
  function pristine(el) { return el.type === 'radio' || el.type === 'checkbox' ? el.checked === el.defaultChecked : el.value === el.defaultValue; }
  function keyOf(el) { var k = el.dataset && el.dataset.set; if (!k || el.tagName !== 'INPUT') return null; return '[data-set="' + k + '"]' + (el.dataset.id ? '[data-id="' + el.dataset.id + '"]' : '') + (el.type === 'radio' ? '[value="' + el.value + '"]' : ''); }
  function redraw() {
    if (!box || !isOpen()) return;
    var a = document.activeElement, inBox = !!a && a !== box && box.contains(a), field = inBox && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
    var again = field ? (pristine(a) && keyOf(a)) : null;
    if (pressing || (field && !again)) { stale = true; return; }
    var act = inBox && !field && a.dataset ? a.dataset.act : null, sel = null;
    try { if (again) sel = [a.selectionStart, a.selectionEnd]; } catch (e) { sel = null; }
    stale = false; render(true);
    var b = again ? box.querySelector(again) : act ? box.querySelector('[data-act="' + act + '"]') : null;
    if (b) { b.focus(); try { if (sel && sel[0] != null) b.setSelectionRange(sel[0], sel[1]); } catch (e) { /* a field without a caret */ } }
  }
  // Taking in a change in place: every field shows what is stored, except one with typed text (focused or still being
  // saved), which keeps it; a focused field keeps its element and focus. A change in the number of characters needs
  // the full redraw.
  function fill() {
    if (!box || !isOpen()) return;
    refreshCode();
    var chars = ST ? ST.chars : [], names = box.querySelectorAll('[data-set=name]');
    if (names.length !== chars.length || [].some.call(names, function (el, i) { return el.dataset.id !== chars[i].id; })) return redraw();
    var put = function (el, v) { if (el && pristine(el) && el.value !== v) { el.defaultValue = v; el.value = v; } };
    chars.forEach(function (c) {
      put(box.querySelector('[data-set=name][data-id="' + c.id + '"]'), /^Character \d$/.test(c.name) ? '' : c.name);
      var f = fcOf(c.id); put(box.querySelector('[data-set=fc][data-id="' + c.id + '"]'), f ? f.fc.name || '' : '');
    });
    var night = (section('settings') && section('settings').notify) || {}, q = night.quietHours || { from: 22 * 60, to: 8 * 60 };
    put($('[data-set=qfrom]', box), hhmm(q.from)); put($('[data-set=qto]', box), hhmm(q.to));
    var radios = box.querySelectorAll('[data-set=night]');
    if ([].every.call(radios, pristine)) [].forEach.call(radios, function (r) { var on = (r.value === 'quiet') === (night.night === 'quiet'); r.defaultChecked = on; r.checked = on; });
  }
  // One path makes the shown transfer code, for the press and for every remake (the save changed): only the newest request's
  // result is shown, in the same box; a box with the focus keeps it and has its whole text selected again; when making the
  // code fails, the shown code is removed rather than left out of date.
  var codeSeq = 0, codePending = false, focusSeq = 0, codeFocusIntent = null, codeFocusElement = null;
  if (box) box.addEventListener('focusin', function () { focusSeq++; });
  function makeCode(press) {
    if (!box || !ST) return; var mine = ++codeSeq; codePending = true;
    var old = $('[data-code] textarea', box);
    if (codeFocusIntent !== null && codeFocusIntent !== focusSeq) { codeFocusIntent = null; codeFocusElement = null; }
    if (codeFocusIntent === null && (press || (!!old && document.activeElement === old))) { codeFocusIntent = focusSeq; codeFocusElement = document.activeElement; }
    var target = $('[data-code]', box); if (target) target.innerHTML = '';
    ET.makeTransferCode(JSON.parse(JSON.stringify(ST))).then(function (code) {
      if (mine !== codeSeq) return; codePending = false;
      var el = $('[data-code]', box); if (!el) return;
      var ta = el.querySelector('textarea'), had = codeFocusIntent !== null && codeFocusIntent === focusSeq && (document.activeElement === document.body || document.activeElement === codeFocusElement);
      codeFocusIntent = null; codeFocusElement = null;
      if (!ta) { el.innerHTML = '<p class="muted small">Paste it in the Tracker\'s Settings (Import and backup) on the other device:</p><textarea class="inp code" readonly rows="3">' + esc(code) + '</textarea>'; ta = el.querySelector('textarea'); }
      else if (ta.value !== code) { ta.defaultValue = code; ta.value = code; }
      if (had) { ta.focus(); ta.select(); }
    }, function () { if (mine !== codeSeq) return; codePending = false; codeFocusIntent = null; codeFocusElement = null; var el = box && $('[data-code]', box); if (el) el.innerHTML = ''; });
  }
  function refreshCode() { if (box && ST && (codePending || $('[data-code] textarea', box))) makeCode(); }
  // after an edit is saved, its field holds what is stored (unless more was typed meanwhile), and the others follow
  function settled(t, v) {
    if (t.type === 'radio') box.querySelectorAll('[name="' + t.name + '"]').forEach(function (r) { r.defaultChecked = r.checked; });
    else if (t.value === v) t.defaultValue = v;
    fill();
  }
  // A write that did not happen is never answered with "Saved": the page's state goes back to the stored one and says so.
  // The field that failed shows what is stored again and counts as untouched, so later changes reach it.
  function failed(e, t) {
    say('Not saved on this device: ' + (e && e.message ? e.message : 'save a backup file'));
    if (t && t.type === 'radio') box.querySelectorAll('[name="' + t.name + '"]').forEach(function (r) { r.checked = r.defaultChecked; });
    else if (t) t.value = t.defaultValue;
    if (t) fill();
  }
  // When neither the browser's database nor its local storage could be written, the shared save keeps the data in this
  // page's memory only and reports it as written: it is never called saved. Each edit is judged by the kind its own write
  // reported ('memory' or not), never by a later read. After such a write every field shows the save as the page then
  // reads it: the memory copy while storage stays unusable (the edit stays visible), the older stored save once it works.
  function saved(kind, t) { say(kind === 'memory' ? 'Not saved on this device: save a backup file' : [t, foldProblem].filter(Boolean).join(' ')); }
  function after(kind, t, v) { if (kind === 'memory') step(reread).then(function () { show(t, v); }, function () { show(t, v); }); else settled(t, v); }
  // The edited field takes what the page now holds for it (as after a failed write), and the others follow.
  function show(t, typed) {
    var k = t.dataset.set, id = t.dataset.id, n = (section('settings') && section('settings').notify) || {}, q = n.quietHours || { from: 22 * 60, to: 8 * 60 }, v = '';
    if (k === 'night') { box.querySelectorAll('[name="' + t.name + '"]').forEach(function (r) { var on = (r.value === 'quiet') === (n.night === 'quiet'); r.defaultChecked = on; r.checked = on; }); return fill(); }
    if (k === 'name') { var c = ST && ST.chars.find(function (x) { return x.id === id; }); v = c && !/^Character \d$/.test(c.name) ? c.name : ''; }
    else if (k === 'fc') { var f = fcOf(id); v = f ? f.fc.name || '' : ''; }
    else v = hhmm(k === 'qfrom' ? q.from : q.to);
    if (typed !== undefined && t.value !== typed) return fill(); // more was typed meanwhile: it stays
    t.defaultValue = v; t.value = v; fill();
  }
  function counted(kind) { render(); if (kind === 'memory') saved(kind, ''); }
  function edit(fn) { var keep; return step(function () { keep = ST ? JSON.parse(JSON.stringify(ST)) : null; return fn(); }).catch(function (e) { ST = keep; throw e; }); }
  function hhmm(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function minutes(v) { var m = /^(\d{2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; }
  // A message is put in place without redrawing the page, so a field being typed in keeps its text and focus; a first
  // message waits until a press is handled, so the page does not move under the pointer.
  var saying = false;
  function say(t) {
    last = t; var el = $('.set-msg', box), intro = box && $('h1 + p.muted', box);
    if (!el && intro && pressing) { saying = true; return; }
    if (!el && intro) { el = document.createElement('p'); el.className = 'set-msg'; el.setAttribute('role', 'status'); intro.after(el); }
    if (el) el.textContent = t; else render();
  }

  // ------------------------------------------------------------------ changes
  function saveChars(guard) {
    if (!ST) return Promise.resolve(); var ok = false, kind = null;
    return Promise.resolve(ET.saveState(ST, true, guard ? { guard: guard } : undefined)).then(function (saved) { ok = saved; kind = ET.storageKind; return CC.read(); }).then(function (r) {
      var bad = null; try { DOC = CC.checkDoc(r.raw); REV = r.rev; } catch (e) { bad = e; }
      if (!ok) throw bad || new Error(''); // the reason when the save says it (a newer version), else none
      if (!bad) return adopt().then(foldOwn).then(function () { return kind; });
      return kind;
    });
  }
  // Rename or add is decided on the save as stored when this edit runs (a free company linked elsewhere is renamed).
  function setFc(charId, name) { return reread().then(function () { return setFcNow(charId, name); }); }
  function setFcNow(charId, name) {
    var sec = JSON.parse(JSON.stringify(section('submersibles') || { fcs: {}, subs: {}, trips: {}, settings: {} }));
    ['fcs', 'subs', 'trips', 'settings'].forEach(function (k) { if (!sec[k]) sec[k] = {}; });
    var f = fcOf(charId), clean = String(name || '').trim().slice(0, 40);
    if (f) { // an emptied name keeps the free company (never deleted from here), and the box shows its name again
      if (!clean) { var el = box && box.querySelector('[data-set=fc][data-id="' + charId + '"]'); if (el && !el.value.trim()) { el.defaultValue = f.fc.name || ''; el.value = f.fc.name || ''; } return Promise.resolve(); }
      sec.fcs[f.id].name = clean;
    }
    else if (clean) {
      var order = Object.keys(sec.fcs).reduce(function (m, k) { return Math.max(m, (sec.fcs[k].order || 0) + 1); }, 0);
      sec.fcs[F.newId('f')] = { name: clean, charId: charId, order: order, unlockedSlots: 1, discovered: [1, 2] };
    } else return Promise.resolve();
    return writeSection('submersibles', sec);
  }
  function onChange(e) {
    var t = e.target, k = t.dataset && t.dataset.set; if (!k) return;
    var id = t.dataset.id, v = t.value;
    if (k === 'name' && ST) edit(function () { if (!ST) return; ET.renameCharacter(ST, id, v.trim() || 'Character ' + (ST.chars.findIndex(function (c) { return c.id === id; }) + 1)); return saveChars(); }).then(function (kind) { saved(kind, 'Saved.'); after(kind, t, v); }, function (e) { failed(e, t); });
    else if (k === 'fc') edit(function () { return setFc(id, v); }).then(function (kind) { saved(kind, 'Saved: the free company is in Submersibles.'); after(kind, t, v); }, function (e) { failed(e, t); });
    else if (k === 'count') {
      var n = +t.value;
      if (!ST) { edit(function () { if (!ST) ST = ET.newState(Array.from({ length: n }, function (_, i) { return 'Character ' + (i + 1); })); else ET.setCharacterCount(ST, n); return saveChars(); }).then(counted, function (e) { render(); failed(e); }); return; }
      if (n < ST.chars.length && !confirm('Remove the last ' + (ST.chars.length - n) + ' character(s)? Their Tracker ticks are removed too (a backup file keeps them).')) { render(); return; }
      edit(function () { ET.setCharacterCount(ST, n); return saveChars(); }).then(counted, function (e) { render(); failed(e); });
    }
    else if (k === 'night' || k === 'qfrom' || k === 'qto') {
      var m = k === 'night' ? null : minutes(v); if (k !== 'night' && m == null) return;
      edit(function () {
        var cur = JSON.parse(JSON.stringify(section('settings') || {})); cur.notify = Object.assign({ night: 'always', quietHours: { from: 22 * 60, to: 8 * 60 } }, cur.notify || {});
        if (k === 'night') cur.notify.night = v; else cur.notify.quietHours = Object.assign({}, cur.notify.quietHours, k === 'qfrom' ? { from: m } : { to: m });
        return writeSection('settings', cur);
      }).then(function (kind) { saved(kind, 'Saved.'); after(kind, t, v); }, function (e) { failed(e, t); });
    }
    else if (k === 'theme') {
      try { var u = JSON.parse(localStorage.getItem('eveniunt-tracker-ui') || '{}') || {}; if (t.value) u.theme = t.value; else delete u.theme; localStorage.setItem('eveniunt-tracker-ui', JSON.stringify(u)); } catch (err) { /* private window */ }
      if (t.value) document.documentElement.setAttribute('data-theme', t.value); else document.documentElement.removeAttribute('data-theme');
    }
  }
  function download(name, text, type) { var url = URL.createObjectURL(new Blob([text], { type: type })); var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 10000); }
  function onClick(e) {
    var b = e.target.closest('[data-act]'); if (!b || !box.contains(b)) return;
    var a = b.dataset.act;
    if (a === 'first') edit(function () { ST = ET.newState(['Character 1']); return saveChars(); }).then(counted, function (e) { render(); failed(e); });
    else if (a === 'signin') { if (CFG) depart(true); }
    else if (a === 'signout') { ET.cloudForget(CFG).then(function () { say('Signed out on this device.'); render(); }); }
    else if (a === 'sync') sync(true);
    else if (a === 'backup' && ST) download('eveniunt-command-center-' + new Date().toISOString().slice(0, 10) + '.json', ET.exportFile(ST), 'application/json');
    else if (a === 'code' && ST) makeCode(true);
    else if (a === 'push-on') { pushStatus('Turning on…'); PUSH.enable().then(function () { pushStatus(); }).catch(function (err) { pushStatus(err.message); }); }
    else if (a === 'push-off') PUSH.disable().then(function () { pushStatus(); }).catch(function (err) { pushStatus(err.message); });
    else if (a === 'push-test') PUSH.call('/push/test').then(function () { pushStatus('Test sent: it should arrive within a few seconds.'); }).catch(function (err) { pushStatus(err.message); });
  }
  function pushStatus(msg) {
    var el = $('[data-push-status]', box); if (!el || !PUSH) return;
    if (msg) { el.textContent = msg; return; }
    if (!PUSH.supported()) { el.textContent = 'This browser cannot receive web notifications here. On an iPhone or iPad, open the Command Center from the home screen.'; return; }
    if (!PUSH.device()) { el.textContent = 'Not available yet: sign in for cloud sync above first.'; return; }
    var put = function (t) { var e = $('[data-push-status]', box); if (e) e.textContent = t; }; // the page may have been redrawn meanwhile
    PUSH.call('/push/status').then(function (r) { put((r.on ? 'On for this device.' : 'Off for this device.') + ' ' + r.devices + ' device' + (r.devices === 1 ? '' : 's') + ' turned on. ' + (r.count ? r.count + ' alert' + (r.count === 1 ? '' : 's') + ' scheduled.' : 'Nothing scheduled.')); })
      .catch(function (err) { put(err.code === 'push_not_set_up' ? 'Your helper does not do notifications yet (helper/README.md, section 4).' : err.message); });
  }

  // ------------------------------------------------------------------ cloud sync from here (the same steps as the Tracker)
  function sync(interactive, retried) {
    // An attempt running for more than 90 seconds no longer blocks a new one; it is then superseded (busy is another
    // object) and whatever it does later is dropped.
    if (!HOSTED || !CFG || !ET.cloudState().device || (busy && performance.now() - busy.at <= 90000)) return Promise.resolve();
    // Each attempt has its own network function for the shared sync code: once superseded, its request in flight is aborted
    // and every later call rejects, so it can neither download nor upload any more.
    if (busy) busy.stop();
    var ctl = new AbortController(), me = busy = { at: performance.now(), stop: function () { ctl.abort(); } }, SUP = {};
    var live = function () { if (busy !== me) throw SUP; };
    var net = function (url, opts) { if (busy !== me) return Promise.reject(new Error('superseded')); return globalThis.fetch(url, Object.assign({}, opts, { signal: ctl.signal })); };
    if (!ST) ST = ET.newState(['Character 1']); // placeholder names give way to the cloud copy's names
    // The shared sync code changes the state it is given in place, so it works on a copy: edits and other pages' changes
    // that replace ST meanwhile are kept, and at the end what the sync brought (the copy against its start) is merged into
    // ST as it is then. Edits never wait for the sync; only this merge waits its turn in the queue.
    // A clash (the same thing changed here during the sync and on the other device) is not decided: this device keeps its
    // value, and the cloud base keeps that item as it was at the start, so the next sync raises the clash as usual.
    var mine = JSON.parse(JSON.stringify(ST)), from = JSON.parse(JSON.stringify(ET.portable(mine))), tok = null;
    return ET.cloudToken(CFG).then(function (t) {
      live(); tok = t; if (interactive) say('Syncing with OneDrive…');
      return ET.cloudSync(mine, tok, net, CFG);
    }).then(function (r) {
      live();
      if (r.done) return done();
      if (r.loss && !confirm('The other device\'s copy would remove ' + r.loss.toLocaleString() + ' Tracker tick(s) from this device. Apply that? Cancel keeps this device unchanged.')) { say('Cloud sync paused: nothing was changed.'); return; }
      if (r.conflicts.length) { say('Your devices disagree on ' + r.conflicts.length + ' entr' + (r.conflicts.length === 1 ? 'y' : 'ies') + ': open the Tracker to choose which is right (it asks on opening).'); return; }
      return ET.cloudFinish(mine, tok, r, {}, net, CFG).then(done);
    }).catch(function (err) {
      if (busy !== me) return;
      if (err && (err.code === 401 || err.code === 'changed') && !retried) { busy = null; return (err.code === 401 ? ET.cloudToken(CFG, null, true) : Promise.resolve()).then(function () { return sync(interactive, true); }); }
      if (err && err.code === 'not-signed-in') return;
      say('Cloud sync: ' + (err && err.message || err));
    }).then(function () { if (busy === me) busy = null; });
    function done() {
      var clashes = 0;
      return step(function () {
        live();
        var before = JSON.parse(JSON.stringify(ST));
        var res = ET.threeWay(from, ET.portable(ST), ET.portable(mine)), drive = mine.sync.drive;
        clashes = res.conflicts.length;
        ET.applyMerge(ST, res, {});
        if (clashes && drive && drive.base) {
          var flat = function (p) { return ET.threeWay(p, p, p).merged; }, start = flat(from), base = flat(drive.base);
          res.conflicts.forEach(function (c) { if (start.has(c.id)) base.set(c.id, start.get(c.id)); else base.delete(c.id); });
          // the base is rebuilt on the copy's characters, minus those whose name the base no longer holds (a character
          // added on both devices): applyMerge keeps the characters it is given, which would keep the other device's name
          var carrier = JSON.parse(JSON.stringify(mine));
          carrier.chars = carrier.chars.filter(function (c) { return base.has('n|' + c.id); });
          drive = Object.assign({}, drive, { base: ET.portable(ET.applyMerge(carrier, { merged: base, conflicts: [] }, {})) });
        }
        ST.sync.drive = drive; ST.sync.backupAt = Date.now();
        return saveChars(function () { return busy === me; }).catch(function (e) { if (busy !== me) ST = before; throw e; });
      }).then(function (kind) {
        live();
        if (kind === 'memory' && !clashes) say('Not saved on this device: save a backup file');
        else say(clashes ? 'Your devices disagree on ' + clashes + ' entr' + (clashes === 1 ? 'y' : 'ies') + ': open the Tracker to choose which is right (it asks on opening).' : 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.');
        fill();
      });
    }
  }
  var configReady = HOSTED ? ET.cloudConfig() : Promise.resolve(null);
  function start() {
    return configReady.then(function (c) { CFG = c; return load(); }).then(function () { return step(foldOwn); }).then(function () {
      // from here on, other pages' changes are taken in; the characters are shown at once, not after the sync at opening
      CC.onChange(hear);
      window.addEventListener('pageshow', function (e) { if (e.persisted) { leaving = false; hear(); } });
      if (isOpen()) render();
      if (!CFG) return;
      if (ET.cloudState().pending) return ET.cloudComplete(CFG).then(function () { last = 'Signed in: this device now syncs by itself.'; return sync(true); }, function (err) { last = 'Cloud sync: ' + err.message; });
      if (ET.cloudState().device) return sync(false);
    }).then(fill);
  }

  // ------------------------------------------------------------------ showing the page
  function isOpen() { return location.hash === '#settings'; }
  function route() {
    var open = isOpen();
    if (box) box.hidden = !open;
    if (home) home.hidden = open;
    document.querySelectorAll('.switcher a').forEach(function (a) { a.toggleAttribute('aria-current', open ? a.dataset.module === 'settings' : a.dataset.module === 'home'); if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page'); });
    if (open) { render(); window.scrollTo(0, 0); }
  }
  if (box) { box.addEventListener('change', onChange); box.addEventListener('click', onClick); }
  // a pending redraw runs after the focus moves (and after the left field's own change) or after a press is handled
  function later() { setTimeout(function () { if (stale) step(redraw); }, 0); }
  if (box) {
    box.addEventListener('focusout', later);
    box.addEventListener('pointerdown', function () { pressing = true; });
    box.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button, a')) pressing = true; });
    ['pointerup', 'pointercancel', 'keyup'].forEach(function (n) { document.addEventListener(n, function () { if (pressing) setTimeout(function () { pressing = false; if (saying) { saying = false; say(last); } later(); }, 0); }); });
  }
  window.addEventListener('hashchange', route);
  route();
  var ready = start();
  function signIn() { configReady.then(function (c) { CFG = c; if (CFG) depart(false); else { location.hash = '#settings'; } }, function () { location.hash = '#settings'; }); }
  // Leaving for the sign-in page: the state is saved in the queue, after every pending edit has been saved and taken back
  // in, so the adopted state is written; the page leaves once that save has ended. A save that fails is said, and the
  // sign-in still goes ahead (it does not depend on that save).
  // One departure at a time, with one 5-second deadline from the press for the wait for the queue and the save together.
  // The save runs in the queue and only if the deadline has not passed; at the deadline the page leaves without it (a save
  // outside the queue could write an older state over another page's change).
  var leaving = false;
  function depart(tell) {
    if (leaving) return; leaving = true;
    var gone = false, timer = setTimeout(go, 5000);
    function go() {
      if (gone) return; gone = true; clearTimeout(timer);
      if (tell) say('Going to Microsoft\'s sign-in page…');
      Promise.resolve().then(function () { return ET.cloudBegin(CFG); }).then(function () { /* the page is leaving: the flag stays set */ }, function () { leaving = false; });
    }
    queue.then(function () { if (!gone) return step(function () { return gone ? null : saveChars(); }); }).then(go, function (e) { if (!gone) failed(e); go(); });
  }
  window.__settings = { ready: function () { return ready; }, state: function () { return ST; }, render: render, signIn: signIn };
})();
