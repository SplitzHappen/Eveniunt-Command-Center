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

  // Two windows of the tracker on one device each hold a whole copy. Each save is a compare-and-swap: a revision
  // stamp is stored beside the state in the same transaction, and a window whose last known stamp is not the stored
  // one (another window saved since) merges instead of overwriting: base = the copy this window last loaded or saved,
  // so ticks made in the other window are kept and its own are added (ET.threeWay; a key changed differently in both
  // keeps this window's value). The merged copy is handed to ET.onSaveMerged so the window shows it.
  const REV = KEY + '-rev';
  let myRev = null, myBase = null;
  const newRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function remember(rev, st) { myRev = rev; myBase = st ? JSON.parse(JSON.stringify(ET.portable(st))) : null; }
  // the core of a save: given what is stored now, what to write (pure, so both storages and the tests share it)
  ET.saveMerge = function (snap, storedRev, stored, knownRev, base) {
    if (!stored || storedRev === knownRev) return { state: snap, merged: false };
    let other;
    try { other = ET.validateState(stored); } catch (e) { return { state: snap, merged: false }; }
    const out = JSON.parse(JSON.stringify(snap));
    ET.applyMerge(out, ET.threeWay(base, ET.portable(snap), ET.portable(other)), {});
    out.sync = snap.sync; // sync bookkeeping is the saving window's own
    return { state: ET.validateState(out), merged: true };
  };

  // peek: read without making it this window's base (another window's save, which the interface may or may not take;
  // ET.acceptLoaded() makes the copy read last this window's base once it is taken)
  let lastRead = null;
  ET.acceptLoaded = () => { if (lastRead) remember(lastRead.rev, lastRead.st); };
  ET.loadState = async function (peek) {
    const got = (rev, v) => { lastRead = { rev, st: v }; if (!peek) remember(rev, v); return v; };
    let dbOk = false;
    try {
      const db = await openDb();
      let rev = null;
      const st = await tx(db, 'readonly', (s) => { const r = s.get(KEY); const q = s.get(REV); q.onsuccess = () => { rev = q.result || null; }; return r; });
      ET.storageKind = 'indexeddb'; dbOk = true;
      if (st) {
        try { return got(rev, ET.validateState(st)); } catch (e) { await rescue(st, e); return null; }
      }
    } catch (e) { /* fall through */ }
    try {
      const raw = localStorage.getItem(LS);
      if (!dbOk) ET.storageKind = 'localstorage';
      if (raw) {
        try { return got(localStorage.getItem(LS + '-rev'), ET.validateState(JSON.parse(raw))); } catch (e) { await rescue(raw, e); return null; }
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
  if (channel && typeof channel.unref === 'function') channel.unref(); // outside a browser (tests), never keeps the process alive
  ET.TAB_ID = Math.random().toString(36).slice(2);
  ET.onOtherTabSave = null;
  if (channel) channel.onmessage = (e) => { if (e.data && e.data.tab !== ET.TAB_ID && typeof ET.onOtherTabSave === 'function') ET.onOtherTabSave(e.data.updated); };
  ET.onSaveResult = null; // called with true (saved on this device) or false (could not be saved)
  ET.onSaveMerged = null; // called with (merged, snapshot) when a save merged changes another window had saved

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
      const rev = newRev();
      let result = null;
      try {
        const db = await openDb();
        // read the stamp and (if another window saved since) the stored copy, merge, and write: one transaction, so
        // two windows saving at the same moment are serialised by the browser and neither overwrites the other
        await tx(db, 'readwrite', (s) => {
          const q = s.get(REV);
          q.onsuccess = () => {
            const write = (stored) => { result = ET.saveMerge(snap, q.result || null, stored, myRev, myBase); s.put(result.state, KEY); s.put(rev, REV); };
            if ((q.result || null) === myRev) write(null);
            else { const g = s.get(KEY); g.onsuccess = () => write(g.result); }
          };
        });
        ET.storageKind = 'indexeddb';
      } catch (e) { result = null; }
      if (!result) {
        try {
          const lsRev = localStorage.getItem(LS + '-rev');
          let stored = null;
          if (lsRev !== myRev) { try { stored = JSON.parse(localStorage.getItem(LS)); } catch (e) { stored = null; } }
          result = ET.saveMerge(snap, lsRev, stored, myRev, myBase);
          localStorage.setItem(LS, JSON.stringify(result.state)); localStorage.setItem(LS + '-rev', rev);
          ET.storageKind = 'localstorage';
        } catch (e) { ET.storageKind = 'memory'; return done(false); }
      }
      remember(rev, result.state);
      memory = result.state;
      if (result.merged && typeof ET.onSaveMerged === 'function') ET.onSaveMerged(result.state, snap);
      return done(true);
    };
    if (now) return run();
    timer = setTimeout(run, 400);
    return Promise.resolve(true);
  };
  ET.hasPendingSave = () => timer !== null && pendingState !== null;

  ET.clearState = async function () {
    memory = null;
    remember(null, null);
    try { const db = await openDb(); await tx(db, 'readwrite', (s) => { s.delete(REV); return s.delete(KEY); }); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(LS); localStorage.removeItem(LS + '-rev'); } catch (e) { /* ignore */ }
  };
})();
