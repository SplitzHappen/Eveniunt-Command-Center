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
    navigator.serviceWorker.register('sw.js').catch(function () { /* the page still works without offline support */ });
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

  // One save for every module (gate 1C): show whose save this is. The shell only reads it.
  var box = document.getElementById('save');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function showSave() {
    if (!box || !window.CC) return Promise.resolve();
    return CC.read().then(function (r) {
      var doc = null;
      try { doc = r.raw != null ? CC.checkDoc(r.raw) : null; } catch (e) { doc = null; }
      if (!doc || !doc.chars.length) { box.hidden = true; return; }
      box.innerHTML = '<h2>One save for every module</h2><p class="muted">Your characters, shared by the Tracker, the Atelier and the modules to come:</p>' +
        '<ul class="chars">' + doc.chars.map(function (c) { return '<li>' + esc(c.name) + '</li>'; }).join('') + '</ul>';
      box.hidden = false;
    }).catch(function () { box.hidden = true; });
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

  window.__commandCenter = { version: 1, modules: ['tracker', 'atelier', 'submersibles'], showSave: showSave, markInstalled: markInstalled };
})();
