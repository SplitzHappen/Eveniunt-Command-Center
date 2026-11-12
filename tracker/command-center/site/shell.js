// Eveniunt Command Center shell (gates 1B to 1E; Submersibles step S2): header, module switcher, home screen, the
// site-wide service worker, the shared-save summary, the install record the apps' hand-over notice reads, and the
// Submersibles return alerts.
// The shell is deliberately NOT cross-origin isolated, so Google's sign-in window keeps working here (gate 1A, R1).
// Today's Tracker and Atelier open as their own pages, unchanged; the Atelier needs its own isolated page for
// multi-core solving (blueprint section 4a, rule 1).
(function () {
  'use strict';
  var HOSTED = /^https?:$/.test(location.protocol);
  var status = document.getElementById('status');
  function show() {
    if (!status) return;
    status.textContent = navigator.onLine ? '' : 'Offline: modules you have opened on this device still work.';
  }
  window.addEventListener('online', show); window.addEventListener('offline', show); show();

  if (HOSTED && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // look for a newer version on every opening and when the installed app comes back to the screen
      reg.update().catch(function () { /* offline */ });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { /* offline */ }); });
    }).catch(function () { /* the page still works without offline support */ });
  }

  // Install button, shown only when the browser offers installation.
  var deferred = null;
  var mast = document.querySelector('.mast');
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'install'; btn.hidden = true; btn.textContent = 'Install app';
  if (mast) mast.appendChild(btn);
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; btn.hidden = false; });
  // The hand-over record (gate 1D, blueprint rule 5): once the Command Center is installed on this device, the Tracker and
  // the Atelier stop showing their one-time notice. Written when the browser reports the install, or when the shell finds
  // itself running as an installed app (Safari on iPhone and iPad reports no install event). This device only.
  var DEVICE_KEY = 'eveniunt-command-center-device';
  function markInstalled() {
    try { var d = JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}') || {}; if (!d.installed) { d.installed = Date.now(); localStorage.setItem(DEVICE_KEY, JSON.stringify(d)); } } catch (e) { /* private window */ }
  }
  window.addEventListener('appinstalled', function () { btn.hidden = true; markInstalled(); });
  if ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true) markInstalled();
  btn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; btn.hidden = true; });
  });

  // One save for every module (gate 1C): whose save this is, and a live line on each module's tile. The shell only reads.
  var box = document.getElementById('save');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function live(name, html) { var el = document.querySelector('[data-live="' + name + '"]'); if (el) el.innerHTML = html; }
  function signedIn() { try { return !!(JSON.parse(localStorage.getItem('eveniunt-cloud-device') || 'null') || {}).device; } catch (e) { return false; } }
  // the very first opening (owner request 2026-11-12): welcomed by cloud sync, which can bring everything else
  document.addEventListener('click', function (e) { if (e.target.closest('[data-welcome=signin]') && window.__settings) window.__settings.signIn(); });
  function showSave() {
    if (!window.CC) return Promise.resolve();
    return CC.read().then(function (r) {
      var doc = null;
      try { doc = r.raw != null ? CC.checkDoc(r.raw) : null; } catch (e) { doc = null; }
      var chars = doc ? doc.chars : [], subs = doc && doc.modules.submersibles, at = doc && doc.modules.atelier;
      var fcOf = function (id) { if (!subs) return ''; var k = Object.keys(subs.fcs || {}).find(function (f) { return subs.fcs[f].charId === id; }); return k ? subs.fcs[k].name || '' : ''; };
      if (box) {
        box.innerHTML = chars.length ? '<h2>Your characters</h2><ul class="chars">' + chars.map(function (c) { var f = fcOf(c.id); return '<li>' + esc(c.name) + (f ? '<small>' + esc(f) + '</small>' : '') + '</li>'; }).join('') + '</ul>'
          : (signedIn() ? '<h2>Getting started</h2><p class="muted">Signed in to cloud sync: your characters arrive with the first sync, or add them in Settings.</p><p class="cc-first"><a class="btn sm" href="#settings">Open Settings</a></p>'
            : '<h2>Start here: cloud sync</h2><p class="muted">Already use the Command Center on another device? Sign in once and everything arrives: characters, Tracker, Submersibles, settings.</p><p class="cc-first row"><button type="button" class="btn" data-welcome="signin">Sign in with Microsoft</button><a class="btn sm ghost" href="#settings">New here: add characters</a></p>');
        box.classList.toggle('welcome', !chars.length);
        box.hidden = false;
      }
      var hello = document.getElementById('hello-name'); if (hello) hello.textContent = chars.length ? ', ' + chars[0].name.split(' ')[0] : '';
      live('tracker', chars.length ? chars.length + ' character' + (chars.length === 1 ? '' : 's') + ' on the ledger' : 'No characters yet');
      if (window.FLEET && subs && Object.keys(subs.fcs || {}).length) {
        var now = Date.now(), sum = FLEET.summary(subs, now), nf = Object.keys(subs.fcs).length;
        live('submersibles', (sum.back ? '<b>' + sum.back + ' back now</b> · ' : '') + (sum.next ? 'next back ' + esc(FLEET.fmtClock(sum.next.sub.voyage.returnAt, now)) + ' (' + esc(FLEET.subLabel(sum.next)) + ')' : 'none out') + ' · ' + nf + ' free compan' + (nf === 1 ? 'y' : 'ies'));
      } else live('submersibles', 'No free company yet');
      var crafters = at && at.chars ? Object.keys(at.chars).length : 0;
      live('atelier', crafters ? 'Crafter stats for ' + crafters + ' character' + (crafters === 1 ? '' : 's') : '');
    }).catch(function () { if (box) box.hidden = true; });
  }
  showSave();
  if (window.CC) CC.onChange(showSave);
  window.addEventListener('pageshow', function (e) { if (e.persisted) showSave(); });

  // Submersibles alerts (step S2, blueprint rule 8): while the shell is open, a banner (and the sound, if turned on in the
  // module) when a sub comes back. What came back while no page was open shows as Back in the module, with no banner.
  var subsSec = null;
  function readSubs() {
    if (!window.CC) return Promise.resolve();
    return CC.read().then(function (r) { try { subsSec = r.raw != null ? (CC.checkDoc(r.raw).modules.submersibles || null) : null; } catch (e) { subsSec = null; } }).catch(function () { subsSec = null; });
  }
  var alerts = null;
  if (window.FLEET) readSubs().then(function () { alerts = FLEET.startAlerts({ section: function () { return subsSec; }, link: 'submersibles/' }); window.__commandCenter.alerts = alerts; });
  if (window.CC) CC.onChange(readSubs);

  setInterval(showSave, 30000); // keeps the next-back line current
  window.__commandCenter = { version: 1, modules: ['tracker', 'atelier', 'submersibles'], showSave: showSave, markInstalled: markInstalled };
})();
