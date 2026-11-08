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
  ET.loadProblem = null; // set when saved data exists but cannot be read: { message, raw } (a rescue copy is kept)

  // Saved data that exists but fails validation is never silently replaced: a copy is kept under its own key and
  // reported, so the interface can offer to download it before anything new is saved over the main copy.
  async function rescue(raw, err) {
    const text = typeof raw === 'string' ? raw : (() => { try { return JSON.stringify(raw); } catch (e) { return String(raw); } })();
    ET.loadProblem = { message: err && err.message ? err.message : String(err), raw: text };
    const key = KEY + '-unreadable-' + new Date().toISOString().replace(/[:.]/g, '-');
    try { const db = await openDb(); await tx(db, 'readwrite', (s) => s.put(text, key)); } catch (e) {
      try { localStorage.setItem(LS + '-unreadable', text); } catch (e2) { /* the copy stays in ET.loadProblem for download */ }
    }
  }

  ET.loadState = async function () {
    let dbOk = false;
    try {
      const db = await openDb();
      const st = await tx(db, 'readonly', (s) => s.get(KEY));
      ET.storageKind = 'indexeddb'; dbOk = true;
      if (st) {
        try { return ET.validateState(st); } catch (e) { await rescue(st, e); return null; }
      }
    } catch (e) { /* fall through */ }
    try {
      const raw = localStorage.getItem(LS);
      if (!dbOk) ET.storageKind = 'localstorage';
      if (raw) {
        try { return ET.validateState(JSON.parse(raw)); } catch (e) { await rescue(raw, e); return null; }
      }
    } catch (e) { /* fall through */ }
    return memory ? ET.validateState(memory) : null;
  };

  // Ask the browser to keep this site's data under storage pressure (and, in Safari, not to clear it after a week
  // without a visit). Resolves to true, false, or null when the browser has no such setting.
  ET.requestPersistence = async function () {
    try { if (navigator.storage && navigator.storage.persist) return (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch (e) { /* ignore */ }
    return null;
  };

  // Other tabs or windows of the tracker on this device hear about each save, so an older copy open elsewhere does
  // not overwrite newer ticks.
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('eveniunt-tracker') : null;
  ET.TAB_ID = Math.random().toString(36).slice(2);
  ET.onOtherTabSave = null;
  if (channel) channel.onmessage = (e) => { if (e.data && e.data.tab !== ET.TAB_ID && typeof ET.onOtherTabSave === 'function') ET.onOtherTabSave(e.data.updated); };
  ET.onSaveResult = null; // called with true (saved on this device) or false (could not be saved)

  // Debounced save: many ticks in a row cost one write.
  let timer = null, pendingState = null;
  ET.saveState = function (st, now) {
    pendingState = st;
    clearTimeout(timer);
    const run = async () => {
      clearTimeout(timer); timer = null;
      const snap = JSON.parse(JSON.stringify(pendingState));
      memory = snap;
      const done = (ok) => {
        if (ok && channel) try { channel.postMessage({ tab: ET.TAB_ID, updated: snap.updated }); } catch (e) { /* ignore */ }
        if (typeof ET.onSaveResult === 'function') ET.onSaveResult(ok);
        return ok;
      };
      try {
        const db = await openDb();
        await tx(db, 'readwrite', (s) => s.put(snap, KEY));
        ET.storageKind = 'indexeddb';
        return done(true);
      } catch (e) { /* fall through */ }
      try { localStorage.setItem(LS, JSON.stringify(snap)); ET.storageKind = 'localstorage'; return done(true); } catch (e) { ET.storageKind = 'memory'; return done(false); }
    };
    if (now) return run();
    timer = setTimeout(run, 400);
    return Promise.resolve(true);
  };
  ET.hasPendingSave = () => timer !== null && pendingState !== null;

  ET.clearState = async function () {
    memory = null;
    try { const db = await openDb(); await tx(db, 'readwrite', (s) => s.delete(KEY)); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(LS); } catch (e) { /* ignore */ }
  };
})();
