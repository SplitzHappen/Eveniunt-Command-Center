// Three-way merge used by cloud sync: base = what both sides agreed on at the last sync.
// A change made on only one side is taken automatically; a key changed differently on both sides
// becomes a conflict that the owner resolves (keep this device's value, or the other one).
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});

  // Only well-formed parts of a copy take part (the cloud copy is outside data: a damaged or foreign file must not
  // inject odd character ids or keys); the merged state is validated again at the end of applyMerge.
  const SETTINGS = ['countLimited', 'countGone', 'countUnknown', 'links', 'gold'];
  function flat(p) {
    const m = new Map();
    if (!p || typeof p !== 'object') return m;
    const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    const okC = (c) => ET.CHAR_ID.test(c), okK = (k) => ET.ENTRY_KEY.test(k);
    for (const [c, t] of Object.entries(obj(p.ticks))) if (okC(c)) for (const k of Object.keys(obj(t))) if (okK(k)) m.set('t|' + c + '|' + k, '1');
    for (const [c, t] of Object.entries(obj(p.excl))) if (okC(c)) for (const k of Object.keys(obj(t))) if (okK(k)) m.set('e|' + c + '|' + k, '1');
    for (const [c, t] of Object.entries(obj(p.vals))) if (okC(c)) for (const [k, v] of Object.entries(obj(t))) if (okK(k) && Number.isFinite(Number(v))) m.set('v|' + c + '|' + k, String(Number(v)));
    for (const [k, v] of Object.entries(obj(p.avail))) if (okK(k) && (v === 'x' || v === 'ok')) m.set('a|' + k, v);
    for (const c of Array.isArray(p.chars) ? p.chars : []) {
      if (!c || typeof c.id !== 'string' || !okC(c.id)) continue;
      m.set('n|' + c.id, String(c.name || ''));
      if (c.lodestone) m.set('l|' + c.id, String(c.lodestone));
      if (c.cls || c.city) m.set('k|' + c.id, c.cls || 'city:' + c.city);
      if (c.gc) m.set('g|' + c.id, String(c.gc));
    }
    for (const [k, v] of Object.entries(obj(p.settings))) if (SETTINGS.includes(k)) m.set('s|' + k, String(v === true));
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
    return ET.validateState(st);
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
