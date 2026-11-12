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
  var ST = null, DOC = null, REV = null, CFG = null, busy = false, last = '';

  // ------------------------------------------------------------------ reading the save
  function load() {
    return Promise.all([ET.loadState(), CC.read()]).then(function (x) {
      ST = x[0]; REV = x[1].rev;
      try { DOC = x[1].raw != null ? CC.checkDoc(x[1].raw) : CC.emptyDoc(); } catch (e) { DOC = null; last = 'The save cannot be used here: ' + e.message; }
    });
  }
  function section(name) { return (DOC && DOC.modules[name]) || null; }
  function writeSection(name, sec) {
    var base = section(name) ? JSON.parse(JSON.stringify(section(name))) : null;
    return CC.writeSection(name, sec, { rev: REV, base: base }).then(function (r) { REV = r.rev; DOC = r.doc; });
  }
  function fcOf(charId) { var s = section('submersibles'); if (!s) return null; var id = Object.keys(s.fcs || {}).find(function (k) { return s.fcs[k].charId === charId; }); return id ? { id: id, fc: s.fcs[id] } : null; }

  // ------------------------------------------------------------------ the page
  function render() {
    if (!box) return;
    var chars = ST ? ST.chars : [];
    var n = chars.length;
    var night = (section('settings') && section('settings').notify) || {};
    var q = night.quietHours || { from: 22 * 60, to: 8 * 60 };
    var theme = ''; try { theme = ((JSON.parse(localStorage.getItem('eveniunt-tracker-ui') || '{}') || {}).theme) || ''; } catch (e) { /* none */ }
    var cs = ET.cloudState();
    box.innerHTML = '<h1>Settings</h1><p class="muted">For the whole Command Center. The Tracker\'s own Settings change the same save.</p>' +
      (last ? '<p class="set-msg" role="status">' + esc(last) + '</p>' : '') +
      // characters and free companies
      '<section class="set-card"><h2>Characters and free companies</h2><p class="muted">The characters every module shares. The free company you type here appears in Submersibles, ready for its submarines. Starting class and Grand Company are in the Tracker\'s Settings.</p>' +
      '<label class="set-row">How many characters <select class="inp" data-set="count">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (k) { return '<option' + (k === Math.max(n, 1) ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      (n ? '<div class="set-chars"><span class="h">Character</span><span class="h">Free company</span>' + chars.map(function (c) {
        var f = fcOf(c.id);
        return '<input class="inp" data-set="name" data-id="' + esc(c.id) + '" value="' + esc(c.name) + '" maxlength="40" aria-label="Character name">' +
          '<input class="inp" data-set="fc" data-id="' + esc(c.id) + '" value="' + esc(f ? f.fc.name || '' : '') + '" maxlength="40" placeholder="none" aria-label="Free company of ' + esc(c.name) + '">';
      }).join('') + '</div>' : '<p><button type="button" class="btn" data-act="first">Add my first character</button></p>') + '</section>' +
      // cloud sync
      '<section class="set-card"><h2>Cloud sync</h2><p class="muted">A private copy in your own OneDrive keeps every device the same: characters, Tracker ticks, Submersibles and the rest. Sign in once per device (on an iPhone, the home-screen app and Safari each once); after that it syncs by itself.</p>' +
      '<p class="set-status">' + (!HOSTED ? 'Works on the published site only.' : !CFG ? 'Cloud sync is not set up on this site.' : cs.device ? 'This device is signed in' + (cs.since ? ' since ' + esc(new Date(cs.since).toLocaleDateString()) : '') + '.' + (ST && ST.sync && ST.sync.drive ? ' Last sync ' + esc(new Date(ST.sync.drive.at).toLocaleString()) + '.' : '') : 'This device is not signed in.') + '</p>' +
      '<p class="row">' + (cs.device ? '<button type="button" class="btn" data-act="sync">Sync now</button><button type="button" class="btn ghost" data-act="signout">Sign out on this device</button>' : '<button type="button" class="btn primary" data-act="signin"' + (HOSTED && CFG ? '' : ' disabled') + '>Sign in with Microsoft</button>') + '</p></section>' +
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
      // appearance
      '<section class="set-card"><h2>Appearance</h2><p class="row">' + [['', 'As the device'], ['light', 'Light'], ['dark', 'Dark']].map(function (t) { return '<label class="set-opt inline"><input type="radio" name="theme" value="' + t[0] + '" data-set="theme"' + (theme === t[0] ? ' checked' : '') + '> ' + t[1] + '</label>'; }).join('') + '</p><p class="muted small">The Tracker has more colour themes in its own Settings.</p></section>';
    pushStatus();
  }
  function hhmm(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function minutes(v) { var m = /^(\d{2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function say(t) { last = t; var el = $('.set-msg', box); if (el) el.textContent = t; else render(); }

  // ------------------------------------------------------------------ changes
  function saveChars() { if (!ST) return Promise.resolve(); return Promise.resolve(ET.saveState(ST, true)).then(function () { return CC.read(); }).then(function (r) { REV = r.rev; try { DOC = CC.checkDoc(r.raw); } catch (e) { /* kept */ } }); }
  function setFc(charId, name) {
    var sec = JSON.parse(JSON.stringify(section('submersibles') || { fcs: {}, subs: {}, trips: {}, settings: {} }));
    ['fcs', 'subs', 'trips', 'settings'].forEach(function (k) { if (!sec[k]) sec[k] = {}; });
    var f = fcOf(charId), clean = String(name || '').trim().slice(0, 40);
    if (f) { if (!clean) return Promise.resolve(); sec.fcs[f.id].name = clean; } // an emptied name keeps the free company (never deleted from here)
    else if (clean) {
      var order = Object.keys(sec.fcs).reduce(function (m, k) { return Math.max(m, (sec.fcs[k].order || 0) + 1); }, 0);
      sec.fcs[F.newId('f')] = { name: clean, charId: charId, order: order, unlockedSlots: 1, discovered: [1, 2] };
    } else return Promise.resolve();
    return writeSection('submersibles', sec);
  }
  function onChange(e) {
    var t = e.target, k = t.dataset && t.dataset.set; if (!k) return;
    if (k === 'name' && ST) { ET.renameCharacter(ST, t.dataset.id, t.value); saveChars().then(function () { say('Saved.'); }); }
    else if (k === 'fc') setFc(t.dataset.id, t.value).then(function () { say('Saved: the free company is in Submersibles.'); });
    else if (k === 'count') {
      var n = +t.value;
      if (!ST) { ST = ET.newState(Array.from({ length: n }, function (_, i) { return 'Character ' + (i + 1); })); saveChars().then(render); return; }
      if (n < ST.chars.length && !confirm('Remove the last ' + (ST.chars.length - n) + ' character(s)? Their Tracker ticks are removed too (a backup file keeps them).')) { render(); return; }
      ET.setCharacterCount(ST, n); saveChars().then(render);
    }
    else if (k === 'night' || k === 'qfrom' || k === 'qto') {
      var cur = JSON.parse(JSON.stringify(section('settings') || {})); cur.notify = Object.assign({ night: 'always', quietHours: { from: 22 * 60, to: 8 * 60 } }, cur.notify || {});
      if (k === 'night') cur.notify.night = t.value; else { var m = minutes(t.value); if (m == null) return; cur.notify.quietHours = Object.assign({}, cur.notify.quietHours, k === 'qfrom' ? { from: m } : { to: m }); }
      writeSection('settings', cur).then(function () { say('Saved.'); });
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
    if (a === 'first') { ST = ET.newState(['Character 1']); saveChars().then(render); }
    else if (a === 'signin') { if (CFG) { if (ST) ET.saveState(ST, true); say('Going to Microsoft\'s sign-in page…'); ET.cloudBegin(CFG); } }
    else if (a === 'signout') { ET.cloudForget(CFG).then(function () { say('Signed out on this device.'); render(); }); }
    else if (a === 'sync') sync(true);
    else if (a === 'backup' && ST) download('eveniunt-command-center-' + new Date().toISOString().slice(0, 10) + '.json', ET.exportFile(ST), 'application/json');
    else if (a === 'code' && ST) ET.makeTransferCode(ST).then(function (code) { var el = $('[data-code]', box); el.innerHTML = '<p class="muted small">Paste it in the Tracker\'s Settings (Import and backup) on the other device:</p><textarea class="inp code" readonly rows="3">' + esc(code) + '</textarea>'; el.querySelector('textarea').select(); });
    else if (a === 'push-on') { pushStatus('Turning on…'); PUSH.enable().then(function () { pushStatus(); }).catch(function (err) { pushStatus(err.message); }); }
    else if (a === 'push-off') PUSH.disable().then(function () { pushStatus(); }).catch(function (err) { pushStatus(err.message); });
    else if (a === 'push-test') PUSH.call('/push/test').then(function () { pushStatus('Test sent: it should arrive within a few seconds.'); }).catch(function (err) { pushStatus(err.message); });
  }
  function pushStatus(msg) {
    var el = $('[data-push-status]', box); if (!el || !PUSH) return;
    if (msg) { el.textContent = msg; return; }
    if (!PUSH.supported()) { el.textContent = 'This browser cannot receive web notifications here. On an iPhone or iPad, open the Command Center from the home screen.'; return; }
    if (!PUSH.device()) { el.textContent = 'Not available yet: sign in for cloud sync above first.'; return; }
    PUSH.call('/push/status').then(function (r) { el.textContent = (r.on ? 'On for this device.' : 'Off for this device.') + ' ' + r.devices + ' device' + (r.devices === 1 ? '' : 's') + ' turned on. ' + (r.count ? r.count + ' alert' + (r.count === 1 ? '' : 's') + ' scheduled.' : 'Nothing scheduled.'); })
      .catch(function (err) { el.textContent = err.code === 'push_not_set_up' ? 'Your helper does not do notifications yet (helper/README.md, section 4).' : err.message; });
  }

  // ------------------------------------------------------------------ cloud sync from here (the same steps as the Tracker)
  function sync(interactive, retried) {
    if (busy || !HOSTED || !CFG || !ET.cloudState().device) return Promise.resolve();
    busy = true;
    if (!ST) ST = ET.newState(['Character 1']); // placeholder names give way to the cloud copy's names
    var tok = null;
    return ET.cloudToken(CFG).then(function (t) {
      tok = t; if (interactive) say('Syncing with OneDrive…');
      return ET.cloudSync(ST, tok, null, CFG);
    }).then(function (r) {
      if (r.done) return done();
      if (r.loss && !confirm('The other device\'s copy would remove ' + r.loss.toLocaleString() + ' Tracker tick(s) from this device. Apply that? Cancel keeps this device unchanged.')) { say('Cloud sync paused: nothing was changed.'); return; }
      if (r.conflicts.length) { say('Your devices disagree on ' + r.conflicts.length + ' entr' + (r.conflicts.length === 1 ? 'y' : 'ies') + ': open the Tracker to choose which is right (it asks on opening).'); return; }
      return ET.cloudFinish(ST, tok, r, {}, null, CFG).then(done);
    }).catch(function (err) {
      if (err && (err.code === 401 || err.code === 'changed') && !retried) { busy = false; return (err.code === 401 ? ET.cloudToken(CFG, null, true) : Promise.resolve()).then(function () { return sync(interactive, true); }); }
      if (err && err.code === 'not-signed-in') return;
      say('Cloud sync: ' + (err && err.message || err));
    }).then(function () { busy = false; });
    function done() { ST.sync.backupAt = Date.now(); return saveChars().then(function () { last = 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.'; if (isOpen()) render(); }); }
  }
  function start() {
    return (HOSTED ? ET.cloudConfig() : Promise.resolve(null)).then(function (c) { CFG = c; return load(); }).then(function () {
      if (!CFG) return;
      if (ET.cloudState().pending) return ET.cloudComplete(CFG).then(function () { last = 'Signed in: this device now syncs by itself.'; return sync(true); }, function (err) { last = 'Cloud sync: ' + err.message; });
      if (ET.cloudState().device) return sync(false);
    }).then(function () { if (isOpen()) render(); });
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
  window.addEventListener('hashchange', route);
  route();
  var ready = start();
  window.__settings = { ready: function () { return ready; }, state: function () { return ST; }, render: render };
})();
