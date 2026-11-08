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
    f: 'FATE', g: 'FATE achievement (assumes a gold rating)',
  };

  ET.indexLinks = function (idx, L) {
    if (!L || !Array.isArray(L.imp)) return null;
    const keys = [];
    for (const s of idx.data.sections) for (const g of s.g) for (const e of g.e) keys.push(s.id + ':' + e.i);
    if (L.entries !== keys.length) return null; // built for other data: unusable, never misapplied
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
    const chosen = (k, kind) => {
      if (kind.startsWith('qc:')) return !!cityLetter && kind.slice(3).includes(cityLetter);
      if (kind.startsWith('qg:')) return !!char.gc && kind.slice(3) === String(char.gc);
      return true;
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
      for (const [t, kind] of X.imp.get(k) || []) if ((kind !== 'g' || gold) && chosen(t, kind)) tick(t);
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
