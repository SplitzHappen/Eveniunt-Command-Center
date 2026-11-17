// Backup files and transfer codes.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const FILE_TAG = 'eveniunt-completionist-tracker'; // backups written before gate 1C (still read)
  const SAVE_TAG = 'eveniunt-command-center', BACKUP_V = 1;
  const CODE_PREFIX = 'EVT2-', OLD_CODE_PREFIX = 'EVT1-';
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

  // The portable part of the state: what moves between devices. Sync bookkeeping and the move record stay local.
  // modules: the other modules' sections of the one save (left out when this state does not know them).
  ET.portable = (st) => {
    const p = { chars: st.chars.map((c) => ({ id: c.id, name: c.name, lodestone: c.lodestone || null, cls: c.cls || null, city: c.cls ? null : (c.city || null), gc: c.gc || null })), ticks: st.ticks, vals: st.vals || {}, excl: st.excl || {}, avail: st.avail, settings: st.settings };
    if (st.modules !== undefined) p.modules = st.modules;
    return p;
  };
  // The shareable part of the one save, one section per module: { chars, modules: { tracker, atelier, ... } }.
  ET.saveDoc = (st) => {
    const p = ET.portable(st);
    return { chars: p.chars, modules: Object.assign({}, p.modules || {}, { tracker: { ticks: p.ticks, excl: p.excl, vals: p.vals, avail: p.avail, settings: p.settings } }) };
  };
  // ... and back to the portable form (the Tracker's section unpacked, the other sections checked)
  ET.fromSaveDoc = (save) => {
    const s = plain(save) ? save : {};
    const t = plain(s.modules) && plain(s.modules.tracker) ? s.modules.tracker : {};
    return { chars: s.chars, ticks: t.ticks || {}, excl: t.excl || {}, vals: t.vals || {}, avail: t.avail || {}, settings: t.settings || {}, modules: globalThis.CC ? globalThis.CC.checkModules(s.modules) : {} };
  };

  ET.exportFile = function (st) {
    return JSON.stringify({ app: SAVE_TAG, kind: 'backup', v: BACKUP_V, saved: new Date().toISOString(), save: ET.saveDoc(st) }, null, 0);
  };

  ET.importFile = function (text) {
    let doc;
    try { doc = JSON.parse(text); } catch (e) { throw new Error('This file is not a tracker backup (not JSON).'); }
    // sync bookkeeping (cloud file id and merge base, online-refresh lists) and the move record are this device's own
    // and never travel in a file: a crafted file must not plant a merge base or a cloud file id
    const local = { sync: { fc: {}, drive: null, backupAt: null }, moved: {}, updated: Date.now() };
    if (doc && doc.app === SAVE_TAG && doc.kind === 'backup') {
      if (!Number.isInteger(doc.v) || doc.v < 1) throw new Error('This file is not a tracker backup.');
      if (doc.v > BACKUP_V) throw new Error('This backup was saved by a newer version of the app. Reload the page to update, then load it again.');
      return ET.validateState(Object.assign({ v: ET.STATE_VERSION }, ET.fromSaveDoc(doc.save), local));
    }
    if (!doc || doc.app !== FILE_TAG || !doc.state) throw new Error('This file is not a tracker backup.');
    // a backup from before gate 1C speaks only for the Tracker: the other modules' sections stay as they are here
    const st = Object.assign({}, doc.state, local);
    delete st.modules;
    return ET.validateState(st);
  };

  // ---------------------------------------------------------------- transfer code
  // Ticks are grouped by section and stored as sorted id deltas, then compressed, so a full
  // 8-character file fits in a short pasteable code. Ids are game ids, so a code made on an older
  // data version still lands on the right entries.
  function packTicks(ticks) {
    const bySec = {};
    for (const k of Object.keys(ticks)) {
      const cut = k.lastIndexOf(':');
      (bySec[k.slice(0, cut)] = bySec[k.slice(0, cut)] || []).push(Number(k.slice(cut + 1)));
    }
    const out = {};
    for (const [s, ids] of Object.entries(bySec)) {
      ids.sort((a, b) => a - b);
      let prev = 0;
      out[s] = ids.map((x) => { const d = x - prev; prev = x; return d; }).join('.');
    }
    return out;
  }
  function unpackTicks(packed) {
    const t = {};
    for (const [s, str] of Object.entries(packed || {})) {
      let prev = 0;
      for (const d of String(str).split('.')) {
        if (d === '') continue;
        prev += Number(d);
        if (!Number.isFinite(prev)) throw new Error('Damaged transfer code.');
        t[s + ':' + prev] = 1;
      }
    }
    return t;
  }

  // limit: stop reading past this many bytes (a pasted code can never legitimately expand beyond it)
  async function pipe(bytes, stream, limit) {
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
    const parts = []; let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (limit && n > limit) { try { await reader.cancel(); } catch (e) { /* ignore */ } throw new Error('too large'); }
      parts.push(value);
    }
    const out = new Uint8Array(n); let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  const CODE_MAX = 4 * 1024 * 1024, DOC_MAX = 64 * 1024 * 1024;
  const b64u = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  };

  ET.makeTransferCode = async function (st) {
    const p = ET.portable(st);
    const doc = { c: p.chars.map((c) => [c.id, c.name, c.lodestone || '', c.cls || (c.city ? 'city:' + c.city : ''), c.gc || 0]), t: {}, a: p.avail, s: p.settings };
    doc.e = {}; doc.v = st.vals || {};
    if (p.modules !== undefined) doc.m = p.modules; // the other modules' sections (EVT2)
    for (const c of p.chars) { doc.t[c.id] = packTicks(st.ticks[c.id] || {}); doc.e[c.id] = packTicks((st.excl || {})[c.id] || {}); }
    const raw = new TextEncoder().encode(JSON.stringify(doc));
    return CODE_PREFIX + b64u(await pipe(raw, new CompressionStream('deflate-raw')));
  };

  ET.readTransferCode = async function (code) {
    const s = String(code || '').replace(/\s+/g, '');
    const prefix = s.startsWith(CODE_PREFIX) ? CODE_PREFIX : s.startsWith(OLD_CODE_PREFIX) ? OLD_CODE_PREFIX : null;
    if (!prefix) throw new Error(/^EVT\d+-/.test(s) ? 'This transfer code was made by a newer version of the app. Reload the page to update, then load it again.' : 'This is not a tracker transfer code.');
    if (s.length > CODE_MAX) throw new Error('This transfer code is far too long to be a tracker code.');
    const damaged = () => new Error('This transfer code is incomplete or damaged. Copy it again in full.');
    let doc;
    try {
      const raw = await pipe(unb64u(s.slice(prefix.length)), new DecompressionStream('deflate-raw'), DOC_MAX);
      doc = JSON.parse(new TextDecoder().decode(raw));
    } catch (e) {
      throw damaged();
    }
    if (!doc || !Array.isArray(doc.c) || !doc.t || typeof doc.t !== 'object') throw damaged();
    if (!doc.c.every((x) => Array.isArray(x) && typeof x[0] === 'string')) throw damaged();
    const st = {
      v: ET.STATE_VERSION,
      chars: doc.c.map(([id, name, lodestone, start, gc]) => ({ id, name, lodestone: lodestone || null, cls: start && !String(start).startsWith('city:') ? start : null, city: String(start || '').startsWith('city:') ? String(start).slice(5) : null, gc: gc || null })),
      ticks: {},
      avail: doc.a || {},
      settings: doc.s || {},
      sync: { fc: {}, drive: null },
      moved: {},
      updated: Date.now(),
    };
    // EVT2 carries the other modules' sections; an EVT1 code speaks only for the Tracker (they stay as they are here)
    if (prefix === CODE_PREFIX) st.modules = plain(doc.m) ? doc.m : {};
    st.excl = {}; st.vals = doc.v || {};
    const own = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
    for (const c of st.chars) { st.ticks[c.id] = unpackTicks(own(doc.t, c.id)); st.excl[c.id] = unpackTicks(own(doc.e, c.id)); }
    return ET.validateState(st);
  };
})();
