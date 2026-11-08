// Backup files and transfer codes.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const FILE_TAG = 'eveniunt-completionist-tracker';
  const CODE_PREFIX = 'EVT1-';

  // The portable part of the state: what moves between devices. Sync bookkeeping stays local.
  ET.portable = (st) => ({ chars: st.chars.map((c) => ({ id: c.id, name: c.name, lodestone: c.lodestone || null, cls: c.cls || null, city: c.cls ? null : (c.city || null), gc: c.gc || null })), ticks: st.ticks, vals: st.vals || {}, excl: st.excl || {}, avail: st.avail, settings: st.settings });

  ET.exportFile = function (st) {
    return JSON.stringify({ app: FILE_TAG, saved: new Date().toISOString(), state: Object.assign({ v: st.v }, ET.portable(st)) }, null, 0);
  };

  ET.importFile = function (text) {
    let doc;
    try { doc = JSON.parse(text); } catch (e) { throw new Error('This file is not a tracker backup (not JSON).'); }
    if (!doc || doc.app !== FILE_TAG || !doc.state) throw new Error('This file is not a tracker backup.');
    const st = Object.assign({ sync: { fc: {}, drive: null }, updated: Date.now() }, doc.state);
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

  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
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
    for (const c of p.chars) { doc.t[c.id] = packTicks(st.ticks[c.id] || {}); doc.e[c.id] = packTicks((st.excl || {})[c.id] || {}); }
    const raw = new TextEncoder().encode(JSON.stringify(doc));
    return CODE_PREFIX + b64u(await pipe(raw, new CompressionStream('deflate-raw')));
  };

  ET.readTransferCode = async function (code) {
    const s = String(code || '').replace(/\s+/g, '');
    if (!s.startsWith(CODE_PREFIX)) throw new Error('This is not a tracker transfer code.');
    let doc;
    try {
      const raw = await pipe(unb64u(s.slice(CODE_PREFIX.length)), new DecompressionStream('deflate-raw'));
      doc = JSON.parse(new TextDecoder().decode(raw));
    } catch (e) {
      throw new Error('This transfer code is incomplete or damaged. Copy it again in full.');
    }
    const st = {
      v: ET.STATE_VERSION,
      chars: doc.c.map(([id, name, lodestone, start, gc]) => ({ id, name, lodestone: lodestone || null, cls: start && !String(start).startsWith('city:') ? start : null, city: String(start || '').startsWith('city:') ? String(start).slice(5) : null, gc: gc || null })),
      ticks: {},
      avail: doc.a || {},
      settings: doc.s || {},
      sync: { fc: {}, drive: null },
      updated: Date.now(),
    };
    st.excl = {}; st.vals = doc.v || {};
    for (const c of st.chars) { st.ticks[c.id] = unpackTicks(doc.t[c.id]); st.excl[c.id] = unpackTicks((doc.e || {})[c.id]); }
    return ET.validateState(st);
  };
})();
