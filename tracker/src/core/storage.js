// Saving on this device. IndexedDB holds the state (8 characters x 32,000 entries can outgrow the
// 5 MB browser localStorage limit); localStorage is the fallback, and memory the last resort.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const DB = 'eveniunt-tracker', STORE = 'state', KEY = 'main', LS = 'eveniunt-tracker-state';

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('no IndexedDB'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(db, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r && r.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  let memory = null;
  ET.storageKind = 'memory';

  ET.loadState = async function () {
    try {
      const db = await openDb();
      const st = await tx(db, 'readonly', (s) => s.get(KEY));
      ET.storageKind = 'indexeddb';
      if (st) return ET.validateState(st);
    } catch (e) { /* fall through */ }
    try {
      const raw = localStorage.getItem(LS);
      if (ET.storageKind === 'memory') ET.storageKind = 'localstorage';
      if (raw) return ET.validateState(JSON.parse(raw));
    } catch (e) { /* fall through */ }
    return memory ? ET.validateState(memory) : null;
  };

  // Debounced save: many ticks in a row cost one write.
  let timer = null, pendingState = null;
  ET.saveState = function (st, now) {
    pendingState = st;
    clearTimeout(timer);
    const run = async () => {
      const snap = JSON.parse(JSON.stringify(pendingState));
      memory = snap;
      try {
        const db = await openDb();
        await tx(db, 'readwrite', (s) => s.put(snap, KEY));
        ET.storageKind = 'indexeddb';
        return true;
      } catch (e) { /* fall through */ }
      try { localStorage.setItem(LS, JSON.stringify(snap)); ET.storageKind = 'localstorage'; return true; } catch (e) { ET.storageKind = 'memory'; return false; }
    };
    if (now) return run();
    timer = setTimeout(run, 400);
    return Promise.resolve(true);
  };

  ET.clearState = async function () {
    memory = null;
    try { const db = await openDb(); await tx(db, 'readwrite', (s) => s.delete(KEY)); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(LS); } catch (e) { /* ignore */ }
  };
})();
