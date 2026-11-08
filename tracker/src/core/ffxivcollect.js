// Online refresh from FFXIV Collect (community site that reads public Lodestone profiles).
// Offline-first: the tracker always works without it; when a refresh succeeds it applies new
// acquisitions that do not clash with anything changed on this device, and returns every other
// difference so the owner decides which side is right.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});
  const API = 'https://ffxivcollect.com/api/characters/';

  // tracker section id (or prefix) -> FFXIV Collect collection
  ET.FC_COLLECTIONS = [
    ['mounts', 'mounts'], ['minions', 'minions'], ['orchestrion', 'orchestrions'], ['emotes', 'emotes'],
    ['hairstyles', 'hairstyles'], ['barding', 'bardings'], ['fashion', 'fashions'], ['facewear', 'facewear'],
    ['bluemagic', 'spells'], ['ach-', 'achievements'],
  ];
  const collectionOf = (sid) => {
    for (const [p, col] of ET.FC_COLLECTIONS) if (p.endsWith('-') ? sid.startsWith(p) : sid === p) return col;
    return null;
  };
  ET.fcCollectionOf = collectionOf;

  // Accepts a number or a Lodestone character URL.
  ET.parseLodestoneId = function (text) {
    // a bare number, or the number after "character/" in a Lodestone address (never digits from another kind of page)
    const t = String(text || '').trim();
    const m = t.match(/^(\d{3,12})$/) || t.match(/\/character\/(\d{3,12})(?:\/|$|\?|#)/);
    return m ? m[1] : null;
  };

  // Returns { ok: {collection: [fcIds]}, unavailable: {collection: reason}, offline: bool, character }
  ET.fetchOwned = async function (lodestoneId, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    const out = { ok: {}, unavailable: {}, offline: false, character: null };
    const cols = [...new Set(ET.FC_COLLECTIONS.map((x) => x[1]))];
    try {
      const r = await f(API + encodeURIComponent(lodestoneId));
      if (r.status === 404) { out.unavailable._character = 'not found on FFXIV Collect'; return out; }
      if (!r.ok) { out.unavailable._character = 'FFXIV Collect answered ' + r.status; return out; }
      out.character = await r.json();
    } catch (e) {
      out.offline = true;
      return out;
    }
    for (const col of cols) {
      try {
        const r = await f(API + encodeURIComponent(lodestoneId) + '/' + col + '/owned');
        if (r.status === 403) { out.unavailable[col] = 'private on the Lodestone'; continue; }
        if (!r.ok) { out.unavailable[col] = 'FFXIV Collect answered ' + r.status; continue; }
        const rows = await r.json();
        if (!Array.isArray(rows)) { out.unavailable[col] = 'unexpected answer from FFXIV Collect'; continue; }
        // FFXIV Collect fills mounts, minions, achievements, emotes and facewear from the Lodestone; the other
        // collections are only what the player recorded on its site by hand. An empty list almost always means
        // "nothing recorded there", never "owns none", so it is not compared (it could only ask to untick everything).
        if (!rows.length) { out.unavailable[col] = 'nothing recorded on FFXIV Collect'; continue; }
        out.ok[col] = rows.map((x) => x && x.id).filter((x) => Number.isInteger(x));
      } catch (e) {
        out.offline = true;
        return out;
      }
    }
    return out;
  };

  // Compare one character's online ownership with this device.
  //  - base: the online lists stored at the last accepted refresh.
  //  - auto: newly owned online, and this device had not changed that entry since the last refresh.
  //  - ask:  every other difference (including the first refresh, which has no base), except one the owner has
  //          already answered with "this device is right" while neither side has changed since (answered: key ->
  //          [online, local] at the time of the answer); otherwise the same prompt would return at every start.
  ET.reconcileOwned = function (idx, st, charId, owned) {
    const prev = (st.sync.fc[charId] && st.sync.fc[charId].owned) || {};
    const answered = (st.sync.fc[charId] && st.sync.fc[charId].answered) || {};
    const auto = [];
    const ask = [];
    for (const sec of idx.sections) {
      const col = collectionOf(sec.id);
      if (!col || !owned.ok[col]) continue;
      const online = new Set(owned.ok[col]);
      const base = prev[col] ? new Set(prev[col]) : null;
      for (const k of ET.sectionKeys(sec)) {
        const e = idx.byKey.get(k).e;
        const fid = e.fc != null ? e.fc : e.i;
        const on = online.has(fid);
        const local = ET.isTicked(st, charId, k);
        if (on === local) continue;
        const a = answered[k];
        if (Array.isArray(a) && a[0] === on && a[1] === local) continue;
        const wasOn = base ? base.has(fid) : null;
        if (base && on && local === wasOn) auto.push({ key: k, value: true });
        else ask.push({ key: k, local, online: on, name: e.n, section: sec.t });
      }
    }
    return { auto, ask };
  };

  // Apply the result: auto changes, the owner's choices for asked items ({key: 'online'|'local'}),
  // and remember the online lists as the new base.
  ET.acceptRefresh = function (st, charId, owned, rec, choices) {
    const answered = Object.assign({}, (st.sync.fc[charId] && st.sync.fc[charId].answered) || {});
    for (const a of rec.auto) ET.setTick(st, charId, a.key, a.value);
    for (const q of rec.ask) {
      if ((choices || {})[q.key] === 'online') { ET.setTick(st, charId, q.key, q.online); delete answered[q.key]; }
      else answered[q.key] = [q.online, q.local]; // remembered, so the same difference is not asked again
    }
    const keep = (st.sync.fc[charId] && st.sync.fc[charId].owned) || {};
    st.sync.fc[charId] = { at: new Date().toISOString(), owned: Object.assign({}, keep, owned.ok), unavailable: owned.unavailable, answered };
  };
})();
