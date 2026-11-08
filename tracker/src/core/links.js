// Links between entries (data/links.json, built from the game's own tables by tools/links.py).
// Ticking an entry also ticks what it proves: the quests it requires, the achievement and title it earns, the
// aether current a quest gives, the earlier ranks of a ladder, and so on. Links only ever ADD ticks, never remove
// one; an entry that does not apply to a character (another starting city or Grand Company, or marked by the owner)
// is never ticked by a link.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});

  // why an entry was ticked, in plain words (shown in the "also ticked" message and the entry's details)
  ET.LINK_KIND = {
    q: 'needed before it (quest)', qc: 'needed before it (your starting city)', qg: 'needed before it (your Grand Company)', c: 'aether current from this quest', r: 'reward', d: 'duty', t: 'title', a: 'achievement',
    l: 'earlier rank or stage', h: 'earlier hunting log rank', s: 'sightseeing log achievement', m: 'master recipe book',
    f: 'FATE', g: 'FATE achievement (assumes a gold rating)', x: 'from the FFXIV Completionist desktop app',
  };

  // Links name entries by their position in the data file. A links file built for other data (an entry added,
  // removed or moved) would tick the wrong things, so the data's key list is hashed and compared (FNV-1a, 32 bit);
  // the entry count alone cannot tell a reordered list from the original.
  ET.keysHash = function (keys) {
    let h = 0x811c9dc5;
    for (const k of keys) {
      for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      h ^= 10; h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  };
  ET.indexLinks = function (idx, L) {
    if (!L || !Array.isArray(L.imp)) return null;
    const keys = [];
    for (const s of idx.data.sections) for (const g of s.g) for (const e of g.e) keys.push(s.id + ':' + e.i);
    if (L.entries !== keys.length) return null; // built for other data: unusable, never misapplied
    if (L.keys_hash !== ET.keysHash(keys)) return null; // same count but other entries or another order (or no hash)
    const secKeys = new Map(idx.sections.map((s) => [s.id, ET.sectionKeys(s)]));
    const K = (x) => keys[x];
    const M = (m) => (typeof m === 'string' ? secKeys.get(m.slice(2)) || [] : m.map(K));
    const push = (map, k, v) => { const a = map.get(k); if (a) a.push(v); else map.set(k, [v]); };
    const X = { imp: new Map(), by: new Map(), rules: [], member: new Map(), lvlBy: new Map(), count: 0 };
    for (const [a, b, kind] of L.imp) { push(X.imp, K(a), [K(b), kind]); push(X.by, K(b), [K(a), kind]); X.count++; }
    const rule = (r, members) => { const id = X.rules.push(r) - 1; for (const m of members) push(X.member, m, id); X.count++; };
    for (const [t, m, kind] of L.all) { const mem = M(m); rule({ type: 'all', target: K(t), members: mem, kind }, mem); }
    for (const [t, m, kind] of L.any) { const mem = M(m); rule({ type: 'any', target: K(t), members: mem, kind }, mem); }
    for (const [a, b, kind] of L.ab) { const from = M(a); rule({ type: 'ab', from, targets: M(b), kind }, from); }
    for (const [t, n, m, kind] of L.cnt) { const mem = M(m); rule({ type: 'cnt', target: K(t), n, members: mem, kind }, mem); }
    for (const [t, need, ls, kind] of L.lvl) {
      const r = { type: 'lvl', target: K(t), need, levels: ls.map(([lk, lv]) => [K(lk), lv]), kind };
      const id = X.rules.push(r) - 1; X.count++;
      for (const [lk] of r.levels) push(X.lvlBy, lk, id);
    }
    return X;
  };

  // Ticks everything the given keys imply for one character (following links further), and returns the keys it
  // added, in order. opts.gold: also use FATE achievements that need a gold rating.
  ET.applyLinks = function (X, idx, st, charId, startKeys, opts) {
    const added = [];
    if (!X) return added;
    const gold = !opts || opts.gold !== false;
    const char = st.chars.find((c) => c.id === charId);
    const ticks = st.ticks[charId];
    if (!char || !ticks) return added;
    const queue = [];
    const can = (k) => {
      if (ticks[k]) return false;
      const hit = idx.byKey.get(k);
      return !!hit && !ET.notApplicable(st, char, k, hit.e) && !(hit.e.val && !hit.e.max);
    };
    const tick = (k) => { if (can(k)) { ticks[k] = 1; added.push(k); queue.push(k); } };
    // a choice between the starting cities' (or Grand Companies') versions of a step: only with the character's own
    // kind "qc:lg" applies to Limsa and Gridania starters, "qg:2" to the Twin Adder, and so on
    const cityLetter = { lim: 'l', gri: 'g', uld: 'u' }[ET.cityOf(char)] || '';
    // an entry of one starting city, Grand Company or class route is never assumed for a character whose city,
    // company or starting class is not set yet, unless the entry it follows from already belongs to the same one (a
    // company rank proves its own company's quest; a guildhest unlocked by one quest per city proves none of them)
    const same = (from, to) => {
      const f = idx.byKey.get(from), t = idx.byKey.get(to);
      if (!f || !t) return false;
      if (t.e.city && !cityLetter && f.e.city !== t.e.city) return false;
      if (t.e.gc && !char.gc && f.e.gc !== t.e.gc) return false;
      if ((t.e.sc || t.e.jc) && !char.cls && (f.e.sc !== t.e.sc || f.e.jc !== t.e.jc)) return false; // class route
      return true;
    };
    const chosen = (from, k, kind) => {
      if (kind.startsWith('qc:')) return !!cityLetter && kind.slice(3).includes(cityLetter);
      if (kind.startsWith('qg:')) return !!char.gc && kind.slice(3) === String(char.gc);
      return same(from, k);
    };
    const check = (id) => {
      const r = X.rules[id];
      if (r.kind === 'g' && !gold) return;
      if (r.type === 'any') tick(r.target);
      else if (r.type === 'all') { if (!ticks[r.target] && r.members.every((m) => ticks[m])) tick(r.target); }
      else if (r.type === 'ab') r.targets.forEach(tick);
      else if (r.type === 'cnt') {
        if (ticks[r.target]) return;
        let n = 0;
        for (const m of r.members) if (ticks[m] && ++n >= r.n) { tick(r.target); return; }
      } else if (r.type === 'lvl') {
        if (ticks[r.target]) return;
        let n = 0;
        for (const [lk, lv] of r.levels) if ((ET.getValue(st, charId, lk) || 0) >= lv) n++;
        if (n >= r.need) tick(r.target);
      }
    };
    for (const k of startKeys) if (ticks[k]) queue.push(k);
    if (opts && opts.levels) for (const lk of opts.levels) for (const id of X.lvlBy.get(lk) || []) check(id);
    if (opts && opts.everything) X.rules.forEach((r, id) => { if (r.type === 'lvl' || r.type === 'cnt') check(id); });
    while (queue.length) {
      const k = queue.shift();
      for (const [t, kind] of X.imp.get(k) || []) if ((kind !== 'g' || gold) && chosen(k, t, kind)) tick(t);
      for (const id of X.member.get(k) || []) check(id);
    }
    if (added.length) st.updated = Date.now();
    return added;
  };

  // Everything the current ticks and levels of one character imply (used to fill in existing data).
  ET.fillLinks = function (X, idx, st, charId, opts) {
    return ET.applyLinks(X, idx, st, charId, Object.keys(st.ticks[charId] || {}), Object.assign({}, opts, { everything: true }));
  };

  // For an entry's details: what ticking it also ticks, and what would tick it.
  ET.linksOf = function (X, key) {
    if (!X) return { implies: [], by: [], rules: [] };
    const rules = [];
    for (const id of X.member.get(key) || []) rules.push(X.rules[id]);
    X.rules.forEach((r) => { if (r.target === key) rules.push(r); });
    return { implies: X.imp.get(key) || [], by: X.by.get(key) || [], rules };
  };
})();
