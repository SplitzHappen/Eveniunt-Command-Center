// Three-way merge used by cloud sync: base = what both sides agreed on at the last sync.
// A change made on only one side is taken automatically; a key changed differently on both sides
// becomes a conflict that the owner resolves (keep this device's value, or the other one).
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});

  function flat(p) {
    const m = new Map();
    if (!p) return m;
    for (const [c, t] of Object.entries(p.ticks || {})) for (const k of Object.keys(t)) m.set('t|' + c + '|' + k, '1');
    for (const [c, t] of Object.entries(p.excl || {})) for (const k of Object.keys(t)) m.set('e|' + c + '|' + k, '1');
    for (const [c, t] of Object.entries(p.vals || {})) for (const [k, v] of Object.entries(t)) m.set('v|' + c + '|' + k, String(v));
    for (const [k, v] of Object.entries(p.avail || {})) m.set('a|' + k, v);
    for (const c of p.chars || []) {
      m.set('n|' + c.id, c.name);
      if (c.lodestone) m.set('l|' + c.id, String(c.lodestone));
      if (c.cls || c.city) m.set('k|' + c.id, c.cls || 'city:' + c.city);
      if (c.gc) m.set('g|' + c.id, String(c.gc));
    }
    for (const [k, v] of Object.entries(p.settings || {})) m.set('s|' + k, String(v));
    return m;
  }

  ET.threeWay = function (base, local, remote) {
    const B = flat(base), L = flat(local), R = flat(remote);
    const keys = new Set([...B.keys(), ...L.keys(), ...R.keys()]);
    const merged = new Map();
    const conflicts = [];
    for (const k of keys) {
      const b = B.get(k), l = L.get(k), r = R.get(k);
      if (l === r) { if (l !== undefined) merged.set(k, l); continue; }
      if (l === b) { if (r !== undefined) merged.set(k, r); continue; }
      if (r === b) { if (l !== undefined) merged.set(k, l); continue; }
      conflicts.push({ id: k, local: l === undefined ? null : l, remote: r === undefined ? null : r });
      if (l !== undefined) merged.set(k, l); // provisional: this device, until the owner decides
    }
    return { merged, conflicts };
  };

  // choices: { conflictId: 'local' | 'remote' }; missing choices keep this device's value.
  ET.applyMerge = function (st, result, choices) {
    const m = new Map(result.merged);
    for (const c of result.conflicts) {
      const pick = (choices || {})[c.id] === 'remote' ? c.remote : c.local;
      if (pick === null) m.delete(c.id);
      else m.set(c.id, pick);
    }
    const chars = new Map(st.chars.map((c) => [c.id, c]));
    const ticks = {};
    const excl = {};
    const vals = {};
    const avail = {};
    const settings = Object.assign({}, st.settings);
    for (const [k, v] of m) {
      const [kind, a, ...rest] = k.split('|');
      if (kind === 't') {
        if (!chars.has(a)) chars.set(a, { id: a, name: a, lodestone: null });
        (ticks[a] = ticks[a] || {})[rest.join('|')] = 1;
      } else if (kind === 'v') {
        (vals[a] = vals[a] || {})[rest.join('|')] = Number(v);
      } else if (kind === 'e') {
        (excl[a] = excl[a] || {})[rest.join('|')] = 1;
      } else if (kind === 'a') avail[a] = v;
      else if (kind === 'n') { if (!chars.has(a)) chars.set(a, { id: a, name: v, lodestone: null }); else chars.get(a).name = v; }
      else if (kind === 'l') { if (chars.has(a)) chars.get(a).lodestone = v; }
      else if (kind === 'k') { if (chars.has(a)) { const ch = chars.get(a); if (v.startsWith('city:')) { ch.city = v.slice(5); ch.cls = null; } else { ch.cls = v; ch.city = null; } } }
      else if (kind === 'g') { if (chars.has(a)) chars.get(a).gc = Number(v); }
      else if (kind === 's') settings[a] = v === 'true' ? true : v === 'false' ? false : v;
    }
    const ordered = [...chars.values()].sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1))).slice(0, ET.MAX_CHARS);
    for (const c of ordered) { if (!m.has('l|' + c.id)) c.lodestone = null; if (!m.has('k|' + c.id)) { c.cls = null; c.city = null; } if (!m.has('g|' + c.id)) c.gc = null; }
    st.chars = ordered;
    st.ticks = {};
    st.excl = {}; st.vals = {};
    for (const c of ordered) { st.ticks[c.id] = ticks[c.id] || {}; st.excl[c.id] = excl[c.id] || {}; st.vals[c.id] = vals[c.id] || {}; }
    st.avail = avail;
    st.settings = settings;
    st.updated = Date.now();
    return st;
  };

  // Plain-language description of a conflict, for the "which one is right?" prompt.
  ET.describeConflict = function (c, idx, st) {
    const [kind, a, ...rest] = c.id.split('|');
    const who = (id) => (st.chars.find((x) => x.id === id) || { name: id }).name;
    const what = (k) => { const h = idx && idx.byKey.get(k); return h ? h.e.n + ' (' + h.s.t + ')' : k; };
    if (kind === 't') return { who: who(a), what: what(rest.join('|')), local: c.local ? 'ticked' : 'not ticked', remote: c.remote ? 'ticked' : 'not ticked' };
    if (kind === 'v') return { who: who(a), what: what(rest.join('|')), local: c.local == null ? '(none)' : 'level ' + c.local, remote: c.remote == null ? '(none)' : 'level ' + c.remote };
    if (kind === 'e') return { who: who(a), what: what(rest.join('|')), local: c.local ? 'does not apply' : 'applies', remote: c.remote ? 'does not apply' : 'applies' };
    if (kind === 'a') {
      const lab = (v) => (v === 'x' ? 'marked unobtainable' : v === 'ok' ? 'marked obtainable' : 'automatic');
      return { who: '', what: what(a), local: lab(c.local), remote: lab(c.remote) };
    }
    if (kind === 'n') return { who: '', what: 'Name of ' + a, local: c.local || '(none)', remote: c.remote || '(none)' };
    if (kind === 'l') return { who: who(a), what: 'Lodestone character number', local: c.local || '(none)', remote: c.remote || '(none)' };
    if (kind === 'k') return { who: who(a), what: 'Starting class', local: c.local || '(none)', remote: c.remote || '(none)' };
    if (kind === 'g') return { who: who(a), what: 'Grand Company', local: ET.GCS[c.local] || '(none)', remote: ET.GCS[c.remote] || '(none)' };
    return { who: '', what: 'Setting: ' + a, local: String(c.local), remote: String(c.remote) };
  };
})();
