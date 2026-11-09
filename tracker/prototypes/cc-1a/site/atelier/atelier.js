// Gate 1A prototype: the Atelier page. Mirrors the real Atelier's start-up (atelier/src/atelier.js):
// - hosted (http/https): registers its own service worker (sw.js, adds the isolation headers) and reloads once
//   when the first visit is not yet isolated;
// - multi-core only when crossOriginIsolated and SharedArrayBuffer exist, in module workers loaded from a file
//   (pool-worker.js), as the real 'mt/solver-worker.js';
// - otherwise (opened as a file, or anything fails) one classic worker built from a Blob, as the real fallback.
// The work is a tiny hand-assembled WebAssembly module whose one function is an atomic add on imported memory:
// on shared memory, 4 threads adding at once must give an exact total.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var HOSTED = /^https?:$/.test(location.protocol);
  var THREADS = 4;
  // (module (import "env" "mem" (memory 1 1 [shared])) (func (export "add") (param i32 i32) (result i32)
  //   (i32.atomic.rmw.add (local.get 0) (local.get 1))))
  function wasmBytes(shared) {
    return new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 7, 1, 0x60, 2, 0x7f, 0x7f, 1, 0x7f,
      2, 0x0d, 1, 3, 0x65, 0x6e, 0x76, 3, 0x6d, 0x65, 0x6d, 2, shared ? 3 : 1, 1, 1, 3, 2, 1, 0, 7, 7, 1, 3, 0x61, 0x64, 0x64, 0, 0,
      0x0a, 0x0c, 1, 0x0a, 0, 0x20, 0, 0x20, 1, 0xfe, 0x1e, 2, 0, 0x0b]);
  }
  var errors = self.__errors;
  $('#iso').textContent = String(self.crossOriginIsolated === true);

  function canMultiCore() { return HOSTED && self.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined'; }

  // n workers on one shared memory: all must arrive at a barrier (so they are alive at the same time), then each
  // adds 1 `iterations` times and burns `work` loops of arithmetic; returns what each did and when.
  function runPool(n, iterations, work) {
    var memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    return WebAssembly.compile(wasmBytes(true)).then(function (module) {
      var t0 = performance.now(), workers = [], jobs = [];
      for (var i = 0; i < n; i++) {
        jobs.push(new Promise(function (resolve, reject) {
          var w = new Worker('pool-worker.js', { type: 'module' });
          workers.push(w);
          w.onmessage = function (e) { if (e.data.type === 'done') resolve(e.data); else reject(new Error(e.data.error)); };
          w.onerror = function (e) { reject(new Error('worker failed: ' + (e.message || 'unknown'))); };
          w.postMessage({ module: module, memory: memory, id: i, n: n, iterations: iterations, work: work });
        }));
      }
      return Promise.all(jobs).then(function (done) {
        workers.forEach(function (w) { w.terminate(); });
        var i32 = new Int32Array(memory.buffer);
        return { threads: done.length, counter: i32[0], expected: n * iterations, arrived: i32[1], wallMs: Math.round(performance.now() - t0), spans: done.map(function (d) { return [d.t0, d.t1]; }) };
      });
    });
  }

  // one thread, unshared memory, a Blob worker: what the single offline file can do
  function runSingle(iterations, work) {
    var src = '(' + function () {
      self.onmessage = function (e) {
        var d = e.data;
        WebAssembly.instantiate(d.bytes, { env: { mem: new WebAssembly.Memory({ initial: 1, maximum: 1 }) } }).then(function (r) {
          var add = r.instance.exports.add, last = 0, t0 = performance.now(), x = 0;
          for (var i = 0; i < d.iterations; i++) last = add(0, 1);
          for (var j = 0; j < d.work; j++) x += Math.sqrt(j);
          self.postMessage({ type: 'done', counter: last + 1, ms: performance.now() - t0, x: x });
        }, function (err) { self.postMessage({ type: 'error', error: String(err) }); });
      };
    }.toString() + ')();';
    return new Promise(function (resolve, reject) {
      var t0 = performance.now();
      var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = function (e) { w.terminate(); if (e.data.type === 'done') resolve({ threads: 1, counter: e.data.counter, expected: iterations, wallMs: Math.round(performance.now() - t0) }); else reject(new Error(e.data.error)); };
      w.onerror = function (e) { reject(new Error('worker failed: ' + (e.message || 'unknown'))); };
      w.postMessage({ bytes: wasmBytes(false), iterations: iterations, work: work });
    });
  }

  var ITER = 250000, WORK = 30000000;
  var ready = (function () {
    if (!canMultiCore()) {
      return runSingle(ITER, 0).then(function (r) { r.mode = 'single'; r.reason = HOSTED ? 'not cross-origin isolated' : 'opened as a file'; return r; });
    }
    var out = null;
    return runPool(THREADS, ITER, 0).then(function (r) {
      out = r; out.mode = 'multi';
      // speed: the same arithmetic on 1 worker, then on 4 workers at once; with 4 real cores the wall time stays
      // about the same while 4 times the work is done
      return runPool(1, 0, WORK);
    }).then(function (one) {
      out.timing = { oneWorkerMs: one.wallMs };
      return runPool(THREADS, 0, WORK);
    }).then(function (four) {
      out.timing.fourWorkersMs = four.wallMs;
      out.timing.speedup = +(4 * out.timing.oneWorkerMs / four.wallMs).toFixed(2);
      return out;
    }).catch(function (err) {
      errors.push('multi-core failed, fell back: ' + err.message); // the real Atelier also falls back on any failure
      return runSingle(ITER, 0).then(function (r) { r.mode = 'single'; r.reason = 'multi-core failed'; return r; });
    });
  })().then(function (r) {
    r.isolated = self.crossOriginIsolated === true;
    r.hardwareConcurrency = navigator.hardwareConcurrency || null;
    $('#threads').textContent = String(r.threads);
    $('#pool').textContent = r.threads + ' thread(s): counter ' + r.counter + ' of ' + r.expected + (r.timing ? ' · speed-up ' + r.timing.speedup + '×' : '') + (r.reason ? ' (' + r.reason + ')' : '');
    return r;
  });

  function showShared() { return CC.read().then(function (s) { $('#shared').textContent = JSON.stringify(s.idb); return s; }); }
  showShared().catch(function () { $('#shared').textContent = '(no shared save here)'; });

  // negative control: the isolated page opening the same sign-in popup loses the opener (why sign-in stays in the shell)
  function signInFromHere(stay) {
    var url = location.protocol + '//' + (location.hostname === 'localhost' ? '127.0.0.1' : 'localhost') + (location.port ? ':' + location.port : '') +
      location.pathname.replace(/atelier\/[^/]*$/, '') + 'signin.html' + (stay ? '?stay=1' : '');
    return new Promise(function (resolve) {
      var done = false;
      function finish(r) { if (!done) { done = true; window.removeEventListener('message', onMsg); resolve(r); } }
      function onMsg(e) { if (e.data && e.data.type === 'cc-signin') finish({ ok: true, from: e.origin }); }
      window.addEventListener('message', onMsg);
      var w = window.open(url, 'cc1a-signin-atelier', 'width=480,height=560');
      if (!w) return finish({ ok: false, reason: 'popup blocked' });
      setTimeout(function () { finish({ ok: false, reason: 'no message within 3 s', handleClosed: w.closed }); }, 3000);
    }).then(function (r) { $('#signin-result').textContent = r.ok ? 'Signed in (unexpected)' : 'Sign-in failed: ' + r.reason; return r; });
  }
  $('#signin').onclick = function () { signInFromHere(); };

  // installable-app start-up, as the real Atelier
  var swReady = Promise.resolve(null);
  if (HOSTED && 'serviceWorker' in navigator) {
    // Today's Atelier reloads at once if ANY worker controls the page. Under a root worker (scope "/") that does
    // not isolate atelier/, that reload happens before the Atelier's own worker has taken over, so the one allowed
    // reload is spent and the page stays on 1 thread (check X5). The fix reloads at once only when the controller is
    // the Atelier's own worker, and otherwise waits for that worker to take over. ?reload=legacy keeps today's rule.
    var LEGACY = new URLSearchParams(location.search).get('reload') === 'legacy';
    var ownWorker = function (c) { return !!c && new URL(c.scriptURL).pathname === new URL('sw.js', location.href).pathname; };
    swReady = navigator.serviceWorker.register('sw.js').then(function () {
      if (!self.crossOriginIsolated) {
        var once = false; try { once = sessionStorage.getItem('cc1a-coi-reload') === '1'; } catch (e) { /* ignore */ }
        var go = function () { try { sessionStorage.setItem('cc1a-coi-reload', '1'); } catch (e) { /* ignore */ } location.reload(); };
        if (!once) navigator.serviceWorker.addEventListener('controllerchange', function () { if (LEGACY || ownWorker(navigator.serviceWorker.controller)) go(); });
        if (!once && (LEGACY ? navigator.serviceWorker.controller : ownWorker(navigator.serviceWorker.controller))) go();
      }
      return navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null;
    }).catch(function (err) { errors.push('service worker: ' + err.message); return null; });
  }

  window.__atelier = {
    ready: function () { return ready; },
    read: showShared,
    write: function (save) { return CC.write(save, 'atelier').then(showShared); },
    signInFromHere: signInFromHere,
    swReady: function () { return swReady; },
    controller: function () { return navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null; },
    errors: function () { return errors.slice(); },
  };
})();
