// Import a character file saved by the "FFXIV Completionist" desktop app (format version 1.0.x).
// The file is a tree of areas; each leaf maps an id to "Y" (done) or a number (a level).
// Areas that store the game's own ids are imported; areas that store positions on the desktop app's
// own pages, and level values, are reported, never guessed.
(function () {
  'use strict';
  const ET = (globalThis.ET = globalThis.ET || {});

  // [save path prefix, tracker section id or prefix ending in '-']; first match wins.
  ET.DESKTOP_MAP = [
    ['character/achievement', 'ach-'],
    ['character/mount-guide', 'mounts'],
    ['character/minion-guide', 'minions'],
    ['logs/orchestrion-list', 'orchestrion'],
    ['social/emotes', 'emotes'],
    ['character/companion/barding', 'barding'],
    ['character/facewear', 'facewear'],
    ['character/fashion-accessories', 'fashion'],
    ['character/character/aesthetician', 'hairstyles'],
    ['character/character/title', 'titles'],
    ['character/gold-saucer/triple-triad-card-list', 'cards'],
    ['character/blue-mage/spellbook', 'bluemagic'],
    ['duty/duty-raid-finder', 'duty-'],
    ['duty/quest/levequests', 'leves'],
    ['duty/quest', 'quests-'],
    ['duty/fate', 'fates'],
    ['duty/the-hunt', 'hunt'],
    ['logs/crafting-log', 'craft-'],
    ['logs/gathering/fishing-guide', 'fishing'],
    ['logs/sightseeing-log', 'sightseeing'],
  ];

  // Plain names for areas the importer cannot place yet (shown in the import report).
  const AREA_NAMES = {
    'character/adventure-plate': 'Adventurer plate parts', 'character/character/classes--jobs': 'Class and job levels',
    'character/character/desynthesis': 'Desynthesis levels', 'character/character/grand-company-rank': 'Grand Company ranks',
    'character/character/societal-relations': 'Allied society ranks', 'character/companion': 'Chocobo companion ranks and skills',
    'character/relic-gear': 'Relic weapons and tools', 'character/blue-mage/log': 'Blue Mage log', 'character/gold-saucer': 'Gold Saucer',
    'duty/collection': 'Portable Archive and Yo-kai medallium', 'duty/exploratory-missions': 'Eureka and Bozja',
    'duty/hall-of-the-novice': 'Hall of the Novice', 'duty/island-sanctuary': 'Island Sanctuary', 'duty/squadron': 'Squadron',
    'duty/trust': 'Trust levels', 'logs/gathering/gathering-log': 'Gathering log', 'logs/gathering/fishing-log': 'Fishing log by spot',
    'logs/gathering/folklore-gathering-books': 'Folklore books', 'logs/hunting-log': 'Hunting log', 'travel/aetherytes': 'Aetherytes',
    'travel/aether-currents': 'Aether currents', 'travel/mount-speed': 'Mount speed', 'travel/porters': 'Porters', 'travel/shared-fate': 'Shared FATE',
  };
  const areaName0 = (path) => {
    let best = '';
    for (const k of Object.keys(AREA_NAMES)) if ((path === k || path.startsWith(k + '/')) && k.length > best.length) best = k;
    return best ? AREA_NAMES[best] : path.split('/').slice(0, 3).join(' / ');
  };
  const areaName = areaName0;

  function buildLookup(idx) {
    const look = new Map(); // target -> Map(id -> key)
    for (const [, target] of ET.DESKTOP_MAP) {
      if (look.has(target)) continue;
      const m = new Map();
      for (const sec of idx.sections) {
        if (target.endsWith('-') ? !sec.id.startsWith(target) : sec.id !== target) continue;
        for (const k of ET.sectionKeys(sec)) {
          const e = idx.byKey.get(k).e;
          if (!m.has(e.i)) m.set(e.i, k);
          for (const a of e.al || []) if (!m.has(a)) m.set(a, k);
        }
      }
      look.set(target, m);
    }
    return look;
  }

  ET.isDesktopSave = (doc) => !!(doc && typeof doc === 'object' && doc.overall && typeof doc.overall === 'object' && 'version' in doc);

  // Suggest a character name from the desktop app's file name: "Name Surname (World) - FFXIV Completionist.json"
  ET.nameFromDesktopFile = (fileName) => {
    const m = String(fileName || '').match(/^(.+?)\s*(?:\(([^)]+)\))?\s*-\s*FFXIV Completionist/i);
    if (m) return m[1].trim();
    return String(fileName || '').replace(/\.json$/i, '').trim(); // any other file name: use it as the name
  };

  // Returns { ticks: {key: 1}, imported, notPlaced: [{area, count}], levels: [{area, count}], version }
  const nrm = (t) => String(t || '').toLowerCase().replace(/\u2019/g, "'").replace(/[^a-z0-9]+/g, '').replace(/^the/, '');

  const EXP = { arr: 'arealmreborn', hw: 'heavensward', sb: 'stormblood', shb: 'shadowbringers', ew: 'endwalker', dt: 'dawntrail' };
  // Find the rows for a desktop-app area name: exact heading, expansion abbreviation, or the heading
  // that contains the name (e.g. "zodiac" -> "A Realm Reborn Weapons: Zodiac").
  function leafGroup(groups, leaf) {
    const raw = nrm(leaf);
    const cands = [raw, raw.replace(/and/g, ''), raw.replace(/tools$/, ''), EXP[String(leaf).toLowerCase()] || ''].filter(Boolean);
    for (const c of cands) if (groups[c]) return groups[c];
    for (const c of cands) {
      const hit = Object.keys(groups).filter((h) => h.includes(c)).sort((a, b) => a.length - b.length)[0];
      if (hit) return groups[hit];
    }
    return null;
  }

  // Position rules from data/desktop-map.json (built by tools/add-checklist.py). Returns a key or null.
  function positionKey(rule, rest, pos, siblings, pagesSeen, idx) {
    if (rule.s === 'global') return rule.k[pos] || null;
    if (rule.s === 'leaf') { const g = leafGroup(rule.g, rest.length ? rest[0] : rule.p.split('/').pop()); return (g && g[pos]) || null; }
    if (rule.s === 'id') return idx.byKey.has(rule.sec + ':' + pos) ? rule.sec + ':' + pos : null;
    if (rule.s === 'currents') {
      const z = rule.z[nrm(rest[rest.length - 1])];
      if (!z) return null;
      const ticked = Object.entries(siblings).filter(([, v]) => v === 'Y').map(([k]) => Number(k));
      const legacy = z.n < 15 && ticked.some((x) => x >= 10);
      if (legacy && pos >= 10) return z.q[pos - 10] || null;
      if (legacy) { const rank = ticked.filter((x) => x < 10).sort((a, b) => a - b).indexOf(pos); return z.f[rank] || null; }
      const nf = z.n - z.q.length;
      return (pos < nf ? z.f[pos] : z.q[pos - nf]) || null;
    }
    if (rule.s === 'gather') {
      const [tab, kind, page] = rest;
      const pages = rule.t[tab] && rule.t[tab][kind];
      if (!pages) return null;
      let list = pages[nrm(page)];
      if (!list) { // a page renamed between versions: use the same position in the page order
        const seen = pagesSeen.get(tab + '/' + kind) || [];
        const order = Object.keys(pages);
        const at = seen.indexOf(page);
        list = at >= 0 && at < order.length ? pages[order[at]] : null;
      }
      return (list && list[pos]) || null;
    }
    return null;
  }

  ET.importDesktopSave = function (idx, text, map) {
    ET.indexForImport = idx;
    let doc;
    try { doc = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { throw new Error('This file is not a desktop-app save (not JSON).'); }
    if (!ET.isDesktopSave(doc)) throw new Error('This file is not a save from the FFXIV Completionist desktop app.');
    const look = buildLookup(idx);
    // Hunting log: the desktop app stores the page number (0-based) per class or Grand Company;
    // each page holds up to four targets.
    const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const hunting = new Map();
    const hsec = idx.sections.find((s) => s.id === 'hunting');
    if (hsec) for (const g of hsec.groups) for (const k of g.keys) {
      const e = idx.byKey.get(k).e;
      const id = slug(g.c) + '|' + (e.pg - 1);
      (hunting.get(id) || hunting.set(id, []).get(id)).push(k);
    }
    const ticks = {};
    const notPlaced = new Map();
    const levels = new Map();
    let doneCount = 0, placed = 0;
    const missed = []; // every tick or level not imported, for the "do these by hand" list
    const excl = {}; // entries the save marks X: not applicable to this character
    const vals = {}; // level values (job levels, desynthesis)
    const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    const rules = (map && map.rules) || [];
    const pagesSeen = new Map();
    (function pages(node, path) {
      for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') {
        const p = path ? path + '/' + k : k;
        const parts = p.split('/');
        if (parts.length === 6 && p.startsWith('logs/gathering/gathering-log/')) {
          const id = parts[3] + '/' + parts[4];
          (pagesSeen.get(id) || pagesSeen.set(id, []).get(id)).push(parts[5]);
        }
        pages(v, p);
      }
    })(doc.overall, '');
    (function walk(node, path) {
      for (const [k, v] of Object.entries(node)) {
        const p = path ? path + '/' + k : k;
        if (v && typeof v === 'object') { walk(v, p); continue; }
        if (v === 'Y') {
          doneCount++;
          const prule = /^\d+$/.test(k) && rules.filter((r) => path === r.p || path.startsWith(r.p + '/')).sort((a, b) => b.p.length - a.p.length)[0];
          if (prule) {
            const rest = path === prule.p ? [] : path.slice(prule.p.length + 1).split('/');
            const key = positionKey(prule, rest, Number(k), node, pagesSeen, idx);
            if (key && idx.byKey.has(key)) { ticks[key] = 1; placed++; } else { bump(notPlaced, areaName(path)); missed.push({ area: areaName(path), path, id: k, kind: 'tick' }); }
            continue;
          }
          if (path.startsWith('logs/hunting-log/')) {
            const keys = hunting.get(path.split('/')[2] + '|' + k);
            if (keys) { for (const hk of keys) ticks[hk] = 1; placed++; continue; }
          }
          const rule = ET.DESKTOP_MAP.find(([pre]) => path === pre || path.startsWith(pre + '/'));
          const key = rule && /^\d+$/.test(k) ? look.get(rule[1]).get(Number(k)) : null;
          if (key) { ticks[key] = 1; placed++; } else { bump(notPlaced, areaName(path)); missed.push({ area: areaName(path), path, id: k, kind: 'tick' }); }
        } else if (v === 'X' && /^\d+$/.test(k)) {
          const prule = rules.filter((r) => path === r.p || path.startsWith(r.p + '/')).sort((a, b) => b.p.length - a.p.length)[0];
          let key = null;
          if (prule) key = positionKey(prule, path === prule.p ? [] : path.slice(prule.p.length + 1).split('/'), Number(k), node, pagesSeen, idx);
          else { const rule = ET.DESKTOP_MAP.find(([pre]) => path === pre || path.startsWith(pre + '/')); key = rule ? look.get(rule[1]).get(Number(k)) : null; }
          if (key && idx.byKey.has(key)) excl[key] = 1;
          else missed.push({ area: areaName(path), path, id: k, kind: 'exclusion' });
        } else if (/^\d+$/.test(String(v)) && /^\d+$/.test(k) && rules.some((r) => r.val && path === r.p)) {
          const vr = rules.find((r) => r.val && path === r.p);
          const key = vr.k[Number(k)];
          if (key && idx.byKey.has(key)) { if (Number(v) > 0) vals[key] = Number(v); }
          else missed.push({ area: areaName(path), path, id: k, kind: 'level', value: String(v) });
        } else if (v !== '0' && v !== '' && v !== 'N' && v != null) {
          bump(levels, areaName(path));
          missed.push({ area: areaName(path), path, id: k, kind: 'level', value: String(v) });
        }
      }
    })(doc.overall, '');
    const list = (m) => [...m].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);
    // Work out the starting city and Grand Company from the save: the desktop app marks the other cities' and
    // companies' entries X, and only the character's own can be done. X marks explained this way are not kept as
    // manual marks (the starting class and company then decide them, and stay correct if they are changed).
    const infer = { city: null, gc: null };
    const named = { marauder: 'mrd', arcanist: 'acn', lancer: 'lnc', archer: 'arc', conjurer: 'cnj', gladiator: 'gla', pugilist: 'pgl', thaumaturge: 'thm' };
    const sc = named[String(doc['starting-class'] || '').toLowerCase().trim()];
    const score = (field) => {
      const xs = {}, ts = {};
      for (const k of Object.keys(excl)) { const e = idx.byKey.get(k).e; if (e[field]) xs[e[field]] = (xs[e[field]] || 0) + 1; }
      for (const k of Object.keys(ticks)) { const e = idx.byKey.get(k).e; if (e[field]) ts[e[field]] = (ts[e[field]] || 0) + 1; }
      const all = field === 'city' ? ['lim', 'gri', 'uld'] : [1, 2, 3];
      const ticked = all.filter((c) => ts[c] && !xs[c]);
      const free = all.filter((c) => !xs[c]);
      return ticked.length === 1 ? ticked[0] : free.length === 1 && Object.keys(xs).length === 2 ? free[0] : null;
    };
    infer.cls = sc || null;
    infer.city = sc ? (ET.START_CLASSES.find((x) => x[0] === sc) || [])[2] : score('city');
    infer.gc = score('gc');
    if (infer.gc) infer.gc = Number(infer.gc);
    for (const k of Object.keys(excl)) {
      const e = idx.byKey.get(k).e;
      if ((infer.city && e.city && e.city !== infer.city) || (infer.gc && e.gc && e.gc !== infer.gc)) delete excl[k];
    }
    return { ticks, excl, vals, missed, infer, imported: Object.keys(ticks).length, placed, done: doneCount, notPlaced: list(notPlaced), levels: list(levels), version: String(doc.version) };
  };

  // Put an import into one character. mode 'add' keeps existing ticks; 'replace' clears that character first.
  ET.applyImport = function (st, charId, result, mode) {
    if (!st.ticks[charId]) throw new Error('No such character');
    if (mode === 'replace') { st.ticks[charId] = {}; st.excl[charId] = {}; }
    for (const k of Object.keys(result.ticks)) st.ticks[charId][k] = 1;
    for (const k of Object.keys(result.excl || {})) st.excl[charId][k] = 1;
    if (mode === 'replace') st.vals[charId] = {};
    for (const [k, v] of Object.entries(result.vals || {})) { const hit = ET.indexForImport && ET.indexForImport.byKey.get(k); ET.setValue(st, charId, k, v, hit ? hit.e : null); }
    const c = st.chars.find((x) => x.id === charId);
    const inf = result.infer || {};
    if (c && !c.cls && (inf.cls || inf.city)) { if (inf.cls) c.cls = inf.cls; else c.city = inf.city; }
    if (c && !c.gc && inf.gc) c.gc = inf.gc;
    st.updated = Date.now();
  };
})();
