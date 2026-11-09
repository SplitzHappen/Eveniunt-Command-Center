// Gate 1A prototype: the one shared save both pages read and write (IndexedDB, with localStorage beside it so
// both storage kinds the two apps use today are exercised). Loaded by the shell and by the Atelier page.
(function () {
  'use strict';
  var DB = 'cc1a-shared', STORE = 'kv', KEY = 'save', LS = 'cc1a-shared';
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!self.indexedDB) return reject(new Error('no IndexedDB'));
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode), r = fn(t.objectStore(STORE));
        t.oncomplete = function () { db.close(); resolve(r && r.result); };
        t.onerror = t.onabort = function () { db.close(); reject(t.error); };
      });
    });
  }
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cc1a-shared') : null;
  self.CC = {
    read: function () {
      return tx('readonly', function (s) { return s.get(KEY); }).then(function (idb) {
        var ls = null; try { ls = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { ls = null; }
        return { idb: idb || null, ls: ls };
      });
    },
    write: function (save, from) {
      return tx('readwrite', function (s) { return s.put(save, KEY); }).then(function () {
        try { localStorage.setItem(LS, JSON.stringify(save)); } catch (e) { /* private window: IndexedDB copy only */ }
        if (channel) channel.postMessage({ from: from, updated: save.updated });
        return true;
      });
    },
    // messages from other pages of the app (another tab, the other side of the isolation boundary)
    heard: [],
  };
  if (channel) channel.onmessage = function (e) { self.CC.heard.push(e.data); };
  // every uncaught error is kept, so the browser checks can assert "no errors"
  self.__errors = [];
  self.addEventListener('error', function (e) { self.__errors.push(String(e.message || e)); });
  self.addEventListener('unhandledrejection', function (e) { self.__errors.push('unhandled: ' + String(e.reason)); });
})();
