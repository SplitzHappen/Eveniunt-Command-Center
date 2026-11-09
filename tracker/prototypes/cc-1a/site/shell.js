// Gate 1A prototype: the shell page. Registers the root service worker (which adds NO isolation headers to the
// shell, like today's tracker worker) and opens a sign-in popup the way Google's sign-in library does: window.open,
// then the popup posts the result back to window.opener.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  $('#iso').textContent = String(self.crossOriginIsolated === true);

  // the "Google" stand-in lives on the same server under another host name, so it is a different origin, as
  // accounts.google.com is; the same-origin stand-in is checked too
  var port = location.port ? ':' + location.port : '';
  var otherHost = location.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  var SIGNIN = {
    same: location.origin + location.pathname.replace(/[^/]*$/, '') + 'signin.html',
    other: location.protocol + '//' + otherHost + port + location.pathname.replace(/[^/]*$/, '') + 'signin.html',
  };

  function signIn(which, stay) {
    var url = SIGNIN[which] + (stay ? '?stay=1' : '');
    var expected = new URL(url).origin;
    return new Promise(function (resolve) {
      var done = false;
      function finish(r) { if (done) return; done = true; window.removeEventListener('message', onMsg); resolve(r); }
      function onMsg(e) {
        if (e.origin !== expected || !e.data || e.data.type !== 'cc-signin') return; // as the real library: only its own origin
        finish({ ok: true, token: e.data.token, from: e.origin });
      }
      window.addEventListener('message', onMsg);
      var w = window.open(url, 'cc1a-signin', 'width=480,height=560');
      if (!w) return finish({ ok: false, reason: 'popup blocked' });
      setTimeout(function () { finish({ ok: false, reason: 'no message within 5 s' }); }, 5000);
    }).then(function (r) {
      $('#signin-result').textContent = r.ok ? 'Signed in (token from ' + r.from + ')' : 'Sign-in failed: ' + r.reason;
      return r;
    });
  }
  $('#signin-same').onclick = function () { signIn('same'); };
  $('#signin-other').onclick = function () { signIn('other'); };

  function showShared() {
    return CC.read().then(function (s) { $('#shared').textContent = JSON.stringify(s.idb); return s; });
  }
  showShared();

  // root service worker: the shell's offline copy; see sw.js for how it treats /atelier/
  var swReady = Promise.resolve(null);
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    var swUrl = 'sw.js' + (new URLSearchParams(location.search).get('sw') === 'naive' ? '?isolateAtelier=0' : '');
    swReady = navigator.serviceWorker.register(swUrl).then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) { return reg.active ? reg.active.scriptURL : null; });
  }

  window.__shell = {
    isolated: function () { return self.crossOriginIsolated === true; },
    signIn: signIn,
    read: showShared,
    write: function (save) { return CC.write(save, 'shell').then(showShared); },
    swReady: function () { return swReady; },
    signinUrls: SIGNIN,
  };
})();
