// Eveniunt Command Center, Submersibles: phone notifications (step S7, design section 6; owner's choices 2026-11-12).
// - Works out the alerts from the save: when each one fires and what it says.
// - Grouping (Settings, changeable any time):
//     auto   (default) per free company, decided by the app: a free company still unlocking subs or sectors (its
//            levelling happens there too) gets one alert per submarine; one that is farming gil gets one alert when
//            its last sub is back; once every free company farms gil with every sub at the top rank and no better
//            part to fit, one alert for the whole fleet;
//     sub    one alert per submarine;
//     fc     one alert per free company, when its last sub is back;
//     fleet  one alert when the last sub of the fleet is back.
//   In the grouped modes a sub that comes back more than 30 minutes before the rest of its group still gets its own.
// - At night (Settings): "always" alerts at once; "quiet" holds alerts that fall in the quiet hours until they end.
// - Talks to the owner's helper (the address in the Tracker's sync-config.json), authenticated by this device's cloud
//   sync handle; the helper keeps only alert times, labels and push addresses (helper/worker.js).
// Plain script: attaches to globalThis.PUSH, so the alert rules run in Node tests too.
(function () {
  'use strict';
  var P = (globalThis.PUSH = globalThis.PUSH || {});
  var MIN = 60000, STRAGGLER = 30 * MIN;
  P.GROUPINGS = { auto: 'Automatic', sub: 'Per submarine', fc: 'Per free company', fleet: 'Whole fleet' };

  function subName(s) { return s.name || 'Sub ' + s.slot; }
  function fcName(fc) { return fc.name || 'Free company'; }
  function inQuiet(t, q) {
    var d = new Date(t), m = d.getHours() * 60 + d.getMinutes();
    return q.from === q.to ? false : q.from < q.to ? m >= q.from && m < q.to : m >= q.from || m < q.to;
  }
  function quietEnd(t, q) { // the next moment the quiet hours end, after t
    var d = new Date(t); d.setSeconds(0, 0);
    d.setHours(Math.floor(q.to / 60), q.to % 60, 0, 0);
    if (d.getTime() <= t) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function hm(t) { var d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  // The mode each free company uses. stageOf(fcId) → 'unlock' | 'gil' | 'final' (worked out by the page from the
  // advisor: 'final' = gil step, every sub at the top rank, no better part).
  P.modes = function (sec, prefs, stageOf) {
    var g = (prefs && prefs.grouping) || 'auto', out = {};
    var ids = Object.keys(sec.fcs || {});
    var allFinal = ids.length > 0 && ids.every(function (id) { return stageOf(id) === 'final'; });
    ids.forEach(function (id) { out[id] = g !== 'auto' ? g : allFinal ? 'fleet' : stageOf(id) === 'unlock' ? 'sub' : 'fc'; });
    return out;
  };

  // The alerts for every sub on a voyage that is still to come back: [{ id, at, title, body }], sorted by time.
  P.alerts = function (sec, prefs, stageOf, now) {
    var modes = P.modes(sec, prefs, stageOf), out = [], groups = {};
    Object.keys(sec.subs || {}).forEach(function (id) {
      var s = sec.subs[id], fc = (sec.fcs || {})[s.fcId], v = s.voyage;
      if (!fc || !v || !(v.returnAt > now) || s.slot > (fc.unlockedSlots || 1)) return;
      var mode = modes[s.fcId], key = mode === 'sub' ? 's:' + id : mode === 'fc' ? 'f:' + s.fcId : 'fleet';
      (groups[key] = groups[key] || []).push({ id: id, s: s, fc: fc, at: v.returnAt });
    });
    Object.keys(groups).forEach(function (key) {
      var g = groups[key].sort(function (a, b) { return a.at - b.at; }), last = g[g.length - 1].at;
      var single = function (x) { out.push({ id: 's:' + x.id + ':' + x.at, at: x.at, title: fcName(x.fc) + ' · ' + subName(x.s) + ' is back', body: '' }); };
      if (key.charAt(0) === 's') { single(g[0]); return; }
      var early = g.filter(function (x) { return x.at < last - STRAGGLER; }), rest = g.filter(function (x) { return x.at >= last - STRAGGLER; });
      early.forEach(single);
      if (rest.length === 1) { single(rest[0]); return; }
      var title = key === 'fleet' ? 'Fleet back: ' + rest.length + ' submarines' : fcName(rest[0].fc) + ': ' + rest.length + ' subs back';
      var body = key === 'fleet' ? rest.map(function (x) { return fcName(x.fc) + ' · ' + subName(x.s); }).join(', ') : rest.map(function (x) { return subName(x.s); }).join(', ');
      out.push({ id: key + ':' + last, at: last, title: title, body: body });
    });
    var q = prefs && prefs.night === 'quiet' && prefs.quietHours ? prefs.quietHours : null;
    if (q) out.forEach(function (a) { if (inQuiet(a.at, q)) { a.body = (a.body ? a.body + ' · ' : '') + 'back at ' + hm(a.at) + ', held for your quiet hours'; a.at = quietEnd(a.at, q); } });
    return out.sort(function (a, b) { return a.at - b.at || (a.id < b.id ? -1 : 1); });
  };

  // ------------------------------------------------------------------ the helper (browser only)
  P.config = function () {
    if (P._cfg) return P._cfg;
    P._cfg = fetch('../tracker/sync-config.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) { return c && typeof c.helper === 'string' && /^https?:\/\//.test(c.helper) ? c.helper.replace(/\/$/, '') : null; }).catch(function () { return null; });
    return P._cfg;
  };
  P.device = function () { try { var d = JSON.parse(localStorage.getItem('eveniunt-cloud-device') || 'null'); return d && /^[0-9a-f]{64}$/.test(d.device) ? d.device : null; } catch (e) { return null; } };
  P.call = function (path, body) {
    return P.config().then(function (h) {
      if (!h) throw Object.assign(new Error('Cloud sync is not set up on this site, so the helper is not known.'), { code: 'no-helper' });
      return fetch(h + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ device: P.device() }, body || {})) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw Object.assign(new Error(j.message || 'The helper answered ' + r.status), { code: j.error || 'helper', status: r.status }); return j; }); });
    });
  };
  P.supported = function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; };
  function keyBytes(b64) { var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  P.registration = function () { return navigator.serviceWorker.getRegistration('../').then(function (r) { return r || navigator.serviceWorker.ready; }); };
  // Turn notifications on for this device: permission, the browser's push address, then the helper.
  P.enable = function () {
    if (!P.supported()) return Promise.reject(new Error('This browser cannot receive web notifications. On an iPhone or iPad, add the Command Center to the home screen and open it from there.'));
    if (!P.device()) return Promise.reject(new Error('Sign in for cloud sync once on this device first (Tracker, Settings, Cloud sync): that is how your helper knows the device is yours.'));
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Notifications were not allowed. Allow them for this site in the browser settings, then try again.');
      return Promise.all([P.call('/push/key'), P.registration()]);
    }).then(function (x) {
      return x[1].pushManager.getSubscription().then(function (old) { return old || x[1].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(x[0].key) }); });
    }).then(function (sub) { return P.call('/push/subscribe', { subscription: sub.toJSON() }); });
  };
  P.disable = function () {
    return P.registration().then(function (r) { return r && r.pushManager.getSubscription(); }).then(function (s) { return s && s.unsubscribe(); })
      .catch(function () { /* nothing to undo here */ }).then(function () { return P.call('/push/unsubscribe'); });
  };
  // Send the schedule if it changed since the last time (one helper write per change).
  P.sync = function (alerts, stamp) {
    if (!P.device()) return Promise.resolve(null);
    var sig = JSON.stringify([stamp, alerts]);
    try { if (sessionStorage.getItem('eveniunt-subs-push') === sig) return Promise.resolve(null); } catch (e) { /* none */ }
    return P.call('/push/schedule', { stamp: stamp, alerts: alerts }).then(function (r) { try { sessionStorage.setItem('eveniunt-subs-push', sig); } catch (e) { /* none */ } return r; });
  };
})();
