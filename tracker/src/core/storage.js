// Saving on this device (gate 1C). The Tracker keeps its data in the Command Center's one save (src/core/save.js),
// next to the other modules' sections: characters in chars, ticks and settings in modules.tracker, this device's sync
// bookkeeping in device.tracker.
//
// Moving in (blueprint rule 2): the first time this version runs on a device, today's save (IndexedDB
// 'eveniunt-tracker' → 'state' → 'main', or localStorage 'eveniunt-tracker-state') is COPIED into the one save, never
// moved: the old save, its stamp and its rescue copies are never written or deleted. Every character is compared before
// the copy is written and again after it is read back; if anything differs, nothing is saved and the owner is told.
// Until the owner confirms, Settings offers a way back to the save from before the move.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const CC = globalThis.CC;
  const OLD_DB = 'eveniunt-tracker', OLD_STORE = 'state', OLD_KEY = 'main', OLD_LS = 'eveniunt-tracker-state';
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

  let memory = null;
  ET.storageKind = 'memory';
  ET.loadProblem = null; // set when saved data exists but cannot be read: { message, raw } (a rescue copy is kept)
  ET.moveProblem = null; // set when the copy into the one save did not match: { stage, what } (nothing more is saved)
  ET.saveDisabled = false;
  ET.justMoved = false;  // true right after this load copied the old save in

  // ---------------------------------------------------------------- the one save <-> the Tracker's state
  ET.docFromState = function (st, keep) {
    const k = keep || CC.emptyDoc();
    const save = ET.saveDoc(st);
    const others = st.modules !== undefined ? st.modules : CC.others(k.modules);
    return {
      app: CC.APP, v: CC.VERSION, updated: st.updated || Date.now(),
      chars: save.chars,
      modules: Object.assign(JSON.parse(JSON.stringify(others)), { tracker: save.modules.tracker }),
      device: Object.assign({}, k.device || {}, { tracker: { sync: st.sync } }),
      moved: Object.assign({}, k.moved || {}, st.moved && st.moved.tracker ? { tracker: st.moved.tracker } : {}),
    };
  };
  const docPortable = (doc) => ET.fromSaveDoc(doc);
  ET.stateFromDoc = function (doc) {
    if (!doc.chars.length) return null;
    const dev = plain(doc.device.tracker) ? doc.device.tracker : {};
    return ET.validateState(Object.assign({ v: ET.STATE_VERSION }, docPortable(doc), { sync: dev.sync, updated: doc.updated || Date.now(), moved: plain(doc.moved.tracker) ? { tracker: doc.moved.tracker } : {} }));
  };

  // Same characters, ticks, marks, levels, availability choices and settings? null if so, else the part that differs.
  const canon = (v) => JSON.stringify(v, (k, x) => (plain(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x));
  ET.compareTracker = function (a, b) {
    const pa = ET.portable(a), pb = ET.portable(b);
    for (const f of ['chars', 'ticks', 'excl', 'vals', 'avail', 'settings']) if (canon(pa[f]) !== canon(pb[f])) return f;
    return null;
  };
  const count = (per) => Object.values(per || {}).reduce((n, o) => n + Object.keys(o || {}).length, 0);
  ET.moveSummary = (st) => ({ chars: st.chars.length, ticks: count(st.ticks), excl: count(st.excl), vals: count(st.vals), avail: Object.keys(st.avail || {}).length, same: true });

  // ---------------------------------------------------------------- today's save, read only
  function openOld() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('no IndexedDB'));
      const req = indexedDB.open(OLD_DB); // no version: whatever exists; if nothing does, nothing is created
      req.onupgradeneeded = () => { req.transaction.abort(); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('none'));
    });
  }
  // { st, from, raw } | { problem, raw, from } | null
  ET.readOldSave = async function () {
    let raw = null, from = null;
    try {
      const db = await openOld();
      try {
        raw = await new Promise((resolve, reject) => {
          const t = db.transaction(OLD_STORE, 'readonly'), r = t.objectStore(OLD_STORE).get(OLD_KEY);
          t.oncomplete = () => resolve(r.result == null ? null : r.result);
          t.onerror = () => reject(t.error);
        });
      } finally { db.close(); }
      if (raw != null) from = 'indexeddb';
    } catch (e) { raw = null; }
    if (raw == null) {
      try { const t = localStorage.getItem(OLD_LS); if (t != null) { raw = t; from = 'localstorage'; } } catch (e) { /* none */ }
    }
    if (raw == null) return null;
    try {
      const st = ET.validateState(JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)));
      return { st, from, raw };
    } catch (e) { return { problem: e, raw, from }; }
  };

  // Saved data that exists but fails validation is never silently replaced: a copy is kept under its own key and
  // reported, so the interface can offer to download it before anything new is saved over the main copy.
  async function rescue(raw, err) {
    const text = typeof raw === 'string' ? raw : (() => { try { return JSON.stringify(raw); } catch (e) { return String(raw); } })();
    ET.loadProblem = { message: err && err.message ? err.message : String(err), raw: text };
    try { await CC.putExtra('main-unreadable-' + stamp(), text); } catch (e) { /* the copy stays in ET.loadProblem for download */ }
  }

  // Two windows of the tracker (or the Tracker and the Atelier) on one device each hold a copy. Each save is a
  // compare-and-swap: the revision stamp is read and written with the save in one transaction, and a window whose last
  // known stamp is not the stored one (another page saved since) merges instead of overwriting: base = the copy this
  // window last loaded or saved, so changes made elsewhere are kept and its own are added (ET.threeWay; a key changed
  // differently in both keeps this window's value). The merged copy is handed to ET.onSaveMerged so the window shows it.
  let myRev = null, myBase = null, carry = null;
  function remember(rev, portable) { myRev = rev; myBase = portable ? JSON.parse(JSON.stringify(portable)) : null; }
  // the core of a save: given what is stored now (a state or its portable form), what to write (pure, for the tests)
  ET.saveMerge = function (snap, storedRev, stored, knownRev, base) {
    if (!stored || storedRev === knownRev) return { state: snap, merged: false };
    let other = stored;
    if (stored.v === ET.STATE_VERSION) { try { other = ET.portable(ET.validateState(JSON.parse(JSON.stringify(stored)))); } catch (e) { return { state: snap, merged: false }; } }
    const out = JSON.parse(JSON.stringify(snap));
    ET.applyMerge(out, ET.threeWay(base, ET.portable(snap), other), {});
    out.sync = snap.sync; out.moved = snap.moved; // this window's own
    return { state: ET.validateState(out), merged: true };
  };

  // Copy today's save into the one save (one transaction; skipped if another window did it meanwhile).
  async function moveOld(old) {
    const at = Date.now();
    let res = null;
    const w = await CC.transact((raw) => {
      const doc = raw != null ? CC.checkDoc(raw) : CC.emptyDoc();
      if (doc.moved.tracker) { res = { already: doc }; return null; }
      const st = JSON.parse(JSON.stringify(old.st));
      st.modules = CC.others(doc.modules);
      st.moved = { tracker: { at, from: old.from, check: ET.moveSummary(old.st), confirmed: null, wentBack: null } };
      const nd = ET.docFromState(st, doc);
      // before: the state read back from the new save must equal today's, character by character
      const back = ET.stateFromDoc(CC.checkDoc(JSON.parse(JSON.stringify(nd))));
      const diff = back ? ET.compareTracker(old.st, back) : 'chars';
      if (diff) { res = { mismatch: diff }; return null; }
      res = { doc: nd };
      return nd;
    });
    ET.storageKind = w.kind;
    if (res.mismatch) { ET.moveProblem = { stage: 'before', what: res.mismatch }; ET.saveDisabled = true; return old.st; }
    // after: read the stored save back and compare again
    const r = await CC.read();
    let doc = null, after = null;
    try { doc = CC.checkDoc(r.raw); after = ET.stateFromDoc(doc); } catch (e) { after = null; }
    if (res.doc) {
      const diff = after ? ET.compareTracker(old.st, after) : 'unreadable';
      if (diff) { ET.moveProblem = { stage: 'after', what: diff }; ET.saveDisabled = true; return old.st; }
      ET.justMoved = true;
    }
    lastRead = { rev: r.rev, base: doc ? docPortable(doc) : null };
    remember(r.rev, lastRead.base);
    if (!after) carry = { modules: doc ? CC.others(doc.modules) : {} };
    return after;
  }

  // peek: read without making it this window's base (another window's save, which the interface may or may not take;
  // ET.acceptLoaded() makes the copy read last this window's base once it is taken). A peek never moves anything.
  let lastRead = null;
  ET.acceptLoaded = () => { if (lastRead) remember(lastRead.rev, lastRead.base); };
  ET.loadState = async function (peek) {
    let r;
    try { r = await CC.read(); } catch (e) { r = { raw: null, rev: null, kind: 'memory' }; }
    ET.storageKind = r.kind;
    let doc = null;
    if (r.raw != null) {
      try { doc = CC.checkDoc(r.raw); } catch (e) { if (peek) return null; await rescue(r.raw, e); remember(r.rev, null); carry = { modules: {} }; return null; }
    }
    if (doc && doc.moved.tracker) {
      let st;
      try { st = ET.stateFromDoc(doc); } catch (e) { if (peek) return null; await rescue(r.raw, e); remember(r.rev, null); carry = { modules: CC.others(doc.modules) }; return null; }
      if (peek) { lastRead = { rev: r.rev, base: docPortable(doc) }; return st; }
      lastRead = { rev: r.rev, base: docPortable(doc) };
      remember(lastRead.rev, lastRead.base);
      if (!st) carry = { modules: CC.others(doc.modules), moved: doc.moved.tracker }; // after an erase: the move record stays
      return st;
    }
    if (peek) return null;
    // not moved yet on this device: today's save, if there is one, is copied in
    const old = await ET.readOldSave();
    if (old && old.st) return moveOld(old);
    if (old && old.problem) { await rescue(old.raw, old.problem); ET.moveFrom = 'unreadable'; } else ET.moveFrom = 'none';
    remember(r.rev, doc ? docPortable(doc) : null);
    carry = { modules: doc ? CC.others(doc.modules) : {} };
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
      // a state started on this device (setup) takes the other modules' sections as they were loaded
      if (pendingState.modules === undefined) pendingState.modules = JSON.parse(JSON.stringify((carry && carry.modules) || {}));
      if (!pendingState.moved || !pendingState.moved.tracker) pendingState.moved = { tracker: (carry && carry.moved) || { at: Date.now(), from: ET.moveFrom || 'none', check: null, confirmed: null, wentBack: null } };
      const snap = JSON.parse(JSON.stringify(pendingState));
      memory = snap;
      const done = (ok) => {
        if (ok && channel) try { channel.postMessage({ tab: ET.TAB_ID, updated: snap.updated }); } catch (e) { /* ignore */ }
        if (typeof ET.onSaveResult === 'function') ET.onSaveResult(ok);
        return ok;
      };
      if (ET.saveDisabled) return done(false);
      let result = null;
      try {
        const w = await CC.transact((raw, rev, put) => {
          let stored = null;
          if (raw != null) {
            try { stored = CC.checkDoc(raw); } catch (e) {
              if (e.code === 'newer') throw e; // written by a newer version: never overwritten
              put('main-unreadable-' + stamp(), typeof raw === 'string' ? raw : JSON.stringify(raw)); // kept before replacing
            }
          }
          result = ET.saveMerge(snap, rev, stored ? docPortable(stored) : null, myRev, myBase);
          return ET.docFromState(result.state, stored);
        });
        ET.storageKind = w.kind;
        remember(w.rev, ET.portable(result.state));
      } catch (e) { ET.storageKind = CC.kind; return done(false); }
      memory = result.state;
      if (result.merged && typeof ET.onSaveMerged === 'function') ET.onSaveMerged(result.state, snap);
      return done(true);
    };
    if (now) return run();
    timer = setTimeout(run, 400);
    return Promise.resolve(true);
  };
  ET.hasPendingSave = () => timer !== null && pendingState !== null;

  // "Erase everything on this device": the characters and the Tracker's section go. The move record stays, so the
  // save from before the move is not copied back in; that old save and the other modules' sections stay too.
  ET.clearState = async function () {
    memory = null;
    remember(null, null);
    try {
      await CC.transact((raw) => {
        let doc = null;
        try { doc = raw != null ? CC.checkDoc(raw) : null; } catch (e) { doc = null; }
        doc = doc || CC.emptyDoc();
        doc.chars = []; delete doc.modules.tracker; delete doc.device.tracker;
        if (!doc.moved.tracker) doc.moved.tracker = { at: Date.now(), from: 'none', check: null, confirmed: null, wentBack: null };
        doc.updated = Date.now();
        return doc;
      });
    } catch (e) { /* ignore */ }
  };

  // ---------------------------------------------------------------- the way back (until the owner confirms)
  ET.confirmMove = (st) => { if (st.moved && st.moved.tracker) { st.moved.tracker.confirmed = Date.now(); st.updated = Date.now(); } };
  // How many ticks, marks and levels differ between this state and the save from before the move (null: none kept).
  ET.oldSaveDiff = async function (st) {
    const old = await ET.readOldSave();
    if (!old || !old.st) return null;
    let n = 0;
    for (const f of ['ticks', 'excl', 'vals']) {
      const a = st[f] || {}, b = old.st[f] || {};
      for (const c of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const x = a[c] || {}, y = b[c] || {};
        for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (x[k] !== y[k]) n++;
      }
    }
    return { n, from: old.from };
  };
  // Copy the save from before the move in again. A copy of the current save is kept first (main-before-goback-<time>);
  // the other modules' sections stay; the cloud merge base is forgotten, so the next sync asks instead of deleting.
  ET.goBack = async function () {
    const old = await ET.readOldSave();
    if (!old || !old.st) throw new Error('The save from before the move is no longer on this device.');
    const at = Date.now();
    await CC.transact((raw, rev, put) => {
      const doc = raw != null ? CC.checkDoc(raw) : CC.emptyDoc();
      if (raw != null) put('main-before-goback-' + stamp(), raw);
      const st = JSON.parse(JSON.stringify(old.st));
      st.modules = CC.others(doc.modules);
      const sync = plain(doc.device.tracker) && plain(doc.device.tracker.sync) ? doc.device.tracker.sync : {};
      st.sync = { fc: {}, drive: plain(sync.drive) ? { fileId: sync.drive.fileId, at: sync.drive.at, base: null } : null, backupAt: typeof sync.backupAt === 'number' ? sync.backupAt : null };
      st.moved = { tracker: { at, from: old.from, check: ET.moveSummary(old.st), confirmed: null, wentBack: at } };
      st.updated = at;
      return ET.docFromState(ET.validateState(st), doc);
    });
    memory = null;
    remember(null, null);
  };
})();
