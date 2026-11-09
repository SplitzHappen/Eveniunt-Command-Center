// Eveniunt Tracker — interface. Core logic lives in src/core (globalThis.ET); the Appearance module
// (themes, Mode/Theme/Accent/Background/Foreground, Advanced) is inserted from the Eveniunt Atelier at build time.
(function () {
  'use strict';
  var ET = globalThis.ET;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DATA = JSON.parse($('#tracker-data').textContent);
  var MAP = JSON.parse($('#desktop-map').textContent);
  var IDX = ET.indexData(DATA);
  // rows whose name repeats inside their group (portrait parts, fishing spots, FATE versions, missions) show the first
  // part of their details next to the name, so they can be told apart without opening each one
  var TWIN = new Set();
  IDX.sections.forEach(function (sec) { sec.groups.forEach(function (g) { var n = {}; g.keys.forEach(function (k) { var nm = IDX.byKey.get(k).e.n; (n[nm] = n[nm] || []).push(k); }); Object.keys(n).forEach(function (nm) { if (n[nm].length > 1) n[nm].forEach(function (k) { TWIN.add(k); }); }); }); });
  var LX = ET.indexLinks(IDX, JSON.parse($('#links-data').textContent)); // links between entries (null if they do not fit this data)
  var RAW = new Map(DATA.sections.map(function (s) { return [s.id, s]; }));
  var SEC = new Map(IDX.sections.map(function (s) { return [s.id, s]; }));
  var HOSTED = /^https?:/.test(location.protocol);
  var ST = null; // tracker state (characters, ticks, exclusions, availability choices)

  // ── preferences (appearance and view; per device) ──
  var PREF_KEY = 'eveniunt-tracker-ui';
  function load() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch (e) { return null; } }
  var S = { theme: (load() || {}).theme || 'system', look: null };
  var UI = Object.assign({ view: 'home', sec: null, mode: 'tick', filter: 'all', folded: {}, open: {}, showX: true }, (load() || {}).ui || {});
  if (['all', 'missing', 'done', 'unob'].indexOf(UI.filter) < 0) UI.filter = 'all';
  UI.q = ''; UI.find = ''; UI.mode = 'tick'; // the "does not apply" mode is for one sitting: a plain click always means done after a reload
  function persist() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: S.theme, look: S.look, ui: { view: UI.view, sec: UI.sec, filter: UI.filter, folded: UI.folded, open: UI.open, mode: UI.mode, showX: UI.showX, live: UI.live } })); } catch (e) { /* private window */ }
  }
  var toastTimer = null;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2600); }
  function toastAction(msg, label, fn) {
    var t = $('#toast');
    t.innerHTML = '<span>' + esc(msg) + '</span><button type="button" class="toast-btn">' + esc(label) + '</button>';
    t.classList.remove('hidden'); clearTimeout(toastTimer);
    t.querySelector('button').onclick = function () { t.classList.add('hidden'); fn(); };
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 8000);
  }
  function clampInt(v, lo, hi, d) { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); }
  function copyText(text, msg) {
    var done = function () { toast(msg || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed: select the text and copy it'); } ta.remove(); }
  }
  function download(name, text, type) {
    var u = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
  }

  /*{{LOOK}}*/

  function applyTheme() { applyLook(); }

  // ── the menu: the in-game main menu, as the desktop app lays it out ──
  var TREE = [
    ['Character', [
      ['Achievements', function (s) { return s.indexOf('ach-') === 0; }],
      ['Classes and Jobs', ['levels', 'beastmaster']],
      ['Collections', ['mounts', 'minions', 'hairstyles', 'facewear', 'fashion', 'barding', 'armoire', 'outfits', 'titles', 'plate', 'portraits']],
      ['Ranks and Deliveries', ['gcranks', 'societyranks', 'deliveries', 'companionrank', 'companionskills']],
      ['Relics', ['relicweapons', 'relictools']],
      ['Blue Mage', ['bluemagic', 'bluelog', 'carnivale']],
      ['Gold Saucer', ['cards', 'ttnpcs', 'mahjong', 'verminion', 'chocoboracing']]]],
    ['Duty', [
      ['Main Scenario Quests', function (s) { return s.indexOf('quests-msq-') === 0; }],
      ['Chronicles of a New Era', ['quests-chroniclesofanewera']],
      ['Sidequests', function (s) { return s.indexOf('quests-side-') === 0; }],
      ['Allied Society Quests', function (s) { return s.indexOf('quests-allied-') === 0; }],
      ['Class and Job Quests', function (s) { return s.indexOf('quests-cj-') === 0; }],
      ['Other Quests', ['quests-otherquests']],
      ['Levequests', function (s) { return s.indexOf('leves-') === 0; }],
      ['Duty Finder', function (s) { return (s.indexOf('duty-') === 0 && s !== 'duty-treasure') || s === 'variantrecords'; }],
      ['Trust', ['trust']],
      ['Treasure Hunt', ['treasuremaps', 'duty-treasure']],
      ['FATEs', function (s) { return s.indexOf('fates-') === 0 || s === 'sharedfate'; }],
      ['The Hunt', function (s) { return s.indexOf('hunt-') === 0; }],
      ['Training', ['novice']],
      ['Field Operations', ['eurekalevel', 'eurekaaeth', 'logos', 'eurekaduties', 'bozjarank', 'bozjaaeth', 'lostactions', 'bozjaduties', 'oclevel', 'ocaeth', 'ocevents', 'phantomjobs', 'oclore', 'ocduties']],
      ['Cosmic Exploration', ['cosmicmissions', 'cosmicrecords']],
      ['Island Sanctuary', function (s) { return s.indexOf('isle') === 0; }],
      ['Collection', ['collection']]]],
    ['Logs', [
      ['Crafting', function (s) { return s.indexOf('craft-') === 0 || s === 'masterbooks'; }],
      ['Gathering', function (s) { return s.indexOf('gather-') === 0 || s === 'folklore'; }],
      ['Fishing', ['fishing', 'fishingspots', 'spearfishing']],
      ['Hunting, Sightseeing and Music', ['hunting', 'sightseeing', 'orchestrion']]]],
    ['Travel', [['Aetherytes and Flying', ['aetherytes', 'aethercurrents']], ['Mounts and Porters', ['mountspeed', 'porters']]]],
    ['Social', [['Emotes', ['emotes']]]]
  ];
  var MENUS = (function () {
    var used = new Set();
    var menus = TREE.map(function (m) {
      return { t: m[0], folders: m[1].map(function (f) {
        var secs = typeof f[1] === 'function' ? IDX.sections.filter(function (s) { return f[1](s.id); }).map(function (s) { return s.id; }) : f[1].filter(function (id) { return SEC.has(id); });
        secs.forEach(function (id) { used.add(id); });
        return { t: f[0], secs: secs };
      }).filter(function (f) { return f.secs.length; }) };
    });
    var rest = IDX.sections.filter(function (s) { return !used.has(s.id); }).map(function (s) { return s.id; });
    if (rest.length) menus.push({ t: 'Other', folders: [{ t: 'Other', secs: rest }] });
    return menus;
  })();
  function navTitle(id) {
    var s = SEC.get(id), t = s.t;
    if (s.folder && t.indexOf(': ') > 0) return t.slice(t.indexOf(': ') + 2);
    return t.replace(/^(Achievements|Duties|Crafting Log|Gathering Log|Eureka|Bozja|Occult Crescent|Island Sanctuary|Treasure Hunt): /, '');
  }
  // A–Z order (the default): lists inside each folder, folders inside each menu and entries inside each group are
  // sorted by name (numbers in natural order); Settings → Counting → "Keep the game's order" shows the game's order.
  var COLL = (typeof Intl !== 'undefined' && Intl.Collator) ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) : { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } };
  function az() { return !(ST && ST.settings && ST.settings.gameOrder); }
  // expansions keep release order ahead of A–Z: a name that is or names an expansion sorts by expansion, then the rest A–Z
  var XPANS = ['a realm reborn', 'heavensward', 'stormblood', 'shadowbringers', 'endwalker', 'dawntrail', 'evercold'];
  var XRANK = new Map();
  function xRank(name) {
    var hit = XRANK.get(name); if (hit !== undefined) return hit;
    var t = String(name || '').toLowerCase(), best = -1, at = Infinity;
    XPANS.forEach(function (x, i) { var p = t.indexOf(x); if (p >= 0 && (p < at)) { at = p; best = i; } });
    XRANK.set(name, best); return best;
  }
  function nameCompare(a, b) { // expansion order first (for names that carry one), then A–Z with numbers in natural order
    var x = xRank(a), y = xRank(b);
    if (x >= 0 && y >= 0 && x !== y) return x - y;
    if (x >= 0 && y >= 0) { var sa = String(a).toLowerCase().replace(XPANS[x], ''), sb = String(b).toLowerCase().replace(XPANS[y], ''); return COLL.compare(sa, sb) || COLL.compare(a, b); }
    if ((x >= 0) !== (y >= 0)) return x >= 0 ? -1 : 1; // expansion names first, in release order; everything else after, A–Z
    return COLL.compare(a, b);
  }
  var SORTED = new Map();
  function orderedKeys(keys, gid) {
    if (!az()) return keys;
    var hit = gid && SORTED.get(gid); if (hit && hit.src === keys) return hit.keys;
    var out = keys.slice().sort(function (a, b) { return nameCompare(IDX.byKey.get(a).e.n, IDX.byKey.get(b).e.n); });
    if (gid) SORTED.set(gid, { src: keys, keys: out });
    return out;
  }
  function orderedFolders(folders) { return az() ? folders.slice().sort(function (a, b) { return nameCompare(a.t, b.t); }) : folders; }
  function orderedSecs(ids) { return az() ? ids.slice().sort(function (a, b) { return nameCompare(navTitle(a), navTitle(b)); }) : ids; }
  function menuOf(id) { for (var i = 0; i < MENUS.length; i++) for (var j = 0; j < MENUS[i].folders.length; j++) if (MENUS[i].folders[j].secs.indexOf(id) >= 0) return [MENUS[i], MENUS[i].folders[j]]; return [null, null]; }

  // ── tallies ──
  var KEYS = new Map(IDX.sections.map(function (s) { return [s.id, ET.sectionKeys(s)]; }));
  // Per-list totals are cached: a tick recounts only its own list (the menu and overview add the cached lists up),
  // instead of all 43,000 entries for every character on every click. Any change that can affect many lists
  // (settings, characters, loading, syncing) goes through render(), which clears the cache.
  var TALLY = new Map();
  function sectionTally(id) { var t = TALLY.get(id); if (!t) { t = ET.tally(IDX, ST, KEYS.get(id)); TALLY.set(id, t); } return t; }
  function tallyOf(ids) {
    if (ids.length === 1) return sectionTally(ids[0]);
    var out = { total: 0, totals: {}, done: {}, marked: 0 };
    ST.chars.forEach(function (c) { out.totals[c.id] = 0; out.done[c.id] = 0; });
    ids.forEach(function (id) { var t = sectionTally(id); out.total += t.total; out.marked += t.marked; ST.chars.forEach(function (c) { out.totals[c.id] += t.totals[c.id] || 0; out.done[c.id] += t.done[c.id] || 0; }); });
    return out;
  }
  function staleTallies(keys) { keys.forEach(function (k) { var h = IDX.byKey.get(k); if (h) TALLY.delete(h.s.id); }); }
  function combined(t) { var d = 0, n = 0; ST.chars.forEach(function (c) { d += t.done[c.id]; n += t.totals[c.id]; }); return { d: d, n: n, p: ET.percent(d, n) }; }
  function pctTxt(d, n) { return n ? ET.percent(d, n).toFixed(1).replace(/\.0$/, '') + '%' : '–'; }

  // ── sidebar ──
  function renderSide() {
    var h = '<button type="button" class="home' + (UI.view === 'home' ? ' on' : '') + '" data-act="home">Overview</button>';
    h += '<div class="nav-menu nav-live"><h3>Live</h3>' + orderedFolders(LIVE_FOLDERS).map(function (f) {
      var key = 'Live/' + f.t, views = f.views.filter(function (v) { return LIVE_NAME[v]; });
      if (az()) views.sort(function (a, b) { return COLL.compare(LIVE_NAME[a], LIVE_NAME[b]); });
      var open = UI.open[key] || views.indexOf(UI.view) >= 0;
      return '<details class="nav-folder" data-key="' + esc(key) + '"' + (open ? ' open' : '') + '><summary><span class="nm">' + esc(f.t) + '</span><span class="pc"></span></summary>' +
        views.map(function (v) { return '<button type="button" class="nav-link' + (UI.view === v ? ' on' : '') + '" data-live-view="' + v + '"><span class="nm">' + esc(LIVE_NAME[v]) + '</span></button>'; }).join('') + '</details>';
    }).join('') + '</div>';
    MENUS.forEach(function (m) {
      var all = []; m.folders.forEach(function (f) { all = all.concat(f.secs); });
      var mt = combined(tallyOf(all));
      h += '<div class="nav-menu"><h3>' + esc(m.t) + '<span class="pc">' + pctTxt(mt.d, mt.n) + '</span></h3>';
      orderedFolders(m.folders).forEach(function (f) {
        var single = false; // every menu uses folders, so all sections look and behave the same
        var ft = combined(tallyOf(f.secs)), key = m.t + '/' + f.t;
        var open = single || UI.open[key] || f.secs.indexOf(UI.sec) >= 0;
        var links = orderedSecs(f.secs).map(function (id) {
          var t = combined(tallyOf([id]));
          return '<button type="button" class="nav-link' + (UI.view === 'sec' && UI.sec === id ? ' on' : '') + (t.n && t.d === t.n ? ' full' : '') + '" data-act="sec" data-id="' + id + '"><span class="nm">' + esc(navTitle(id)) + '</span><span class="pc">' + pctTxt(t.d, t.n) + '</span></button>';
        }).join('');
        h += single ? links : '<details class="nav-folder" data-key="' + esc(key) + '"' + (open ? ' open' : '') + '><summary class="' + (ft.n && ft.d === ft.n ? 'full' : '') + '"><span class="nm">' + esc(f.t) + '</span><span class="pc">' + pctTxt(ft.d, ft.n) + '</span></summary>' + links + '</details>';
      });
      h += '</div>';
    });
    $('#side').innerHTML = h;
  }
  var sideQueued = false;
  function queueSide() { if (sideQueued) return; sideQueued = true; requestAnimationFrame(function () { sideQueued = false; renderSide(); }); }

  // ── per-character progress (shown in the column headers) ──
  function headCells(t) {
    return ST.chars.map(function (c) {
      var d = t.done[c.id], n = t.totals[c.id];
      return '<span class="c" title="' + esc(c.name) + (charStart(c) ? ' · ' + esc(charStart(c)) : '') + ': ' + d + ' of ' + n + '"><span class="nm">' + esc(colName(c)) + '</span><span class="pc' + (n && d === n ? ' full' : '') + '">' + (colWidth() < 44 ? (n ? Math.floor(100 * d / n) + '%' : '–') : pctTxt(d, n)) + '</span></span>';
    }).join('');
  }
  function colName(c) { var narrow = colWidth() < 58; return narrow ? String(ST.chars.indexOf(c) + 1) : c.name.split(/\s+/)[0]; }
  function charStart(c) { var cl = ET.START_CLASSES.find(function (x) { return x[0] === c.cls; }); var city = ET.cityOf(c); return (cl ? cl[1] + ', ' : '') + (city ? ET.CITIES[city] : ''); }

  // ── entries ──
  var MARK = { lim: 'Time-limited: only from events, seasonal content or ended campaigns', gone: 'No longer obtainable', unk: 'Availability unknown' };
  var SHORT = { lim: 'Time-limited', gone: 'Unobtainable', unk: 'Unknown' };
  var WHY = { city: 'another starting city', gc: 'another Grand Company', cls: 'the other route of the first class quests (set by the starting class)', manual: 'marked by you' };
  // the checklist workbook pre-excludes rows that do not exist or no longer can be done (for example a second mount
  // speed increase in a zone that has only one), so its mark is worded for both cases
  function markText(hit, code, table) { if (code === 'gone' && RAW.get(hit.s.id).src === 'checklist') return table === SHORT ? 'Not applicable' : 'Not applicable or no longer obtainable (the checklist lists no such step)'; return table[code] || ''; }
  function detailHtml(k) {
    var hit = IDX.byKey.get(k), e = hit.e, av = ET.availability(ST, k, e), bits = [];
    if (e.d && infoLines(k).join(' ').indexOf(e.d) < 0) bits.push('<div>' + esc(e.d) + '</div>');
    var st = stampsHtml(k); if (st) bits.push(st);
    if (COND.cond[k] || COND.nodes[k] || LIVE.bigfish.some(function (f) { return f.k === k; })) bits.push('<div>' + star(k) + ' Watch for notifications</div>');
    infoLines(k).forEach(function (l) { bits.push(lineHtml(l)); });
    var mbl = marketLineHtml(k, e); if (mbl) bits.push(mbl);
    if (!INFO) loadInfo().then(function () { var d = document.querySelector('.det[data-det="' + k + '"]'); if (d && infoLines(k).length) d.outerHTML = detailHtml(k); });
    if (e.src && !infoLines(k).filter(function (l) { return l.charAt(0) !== '§'; }).length) bits.push('<div><b>How to obtain:</b> ' + esc(e.src.join(' · ')) + '</div>');
    var facts = [];
    if (e.p) facts.push('Patch ' + esc(e.p));
    if (e.cnt) facts.push('Defeat ×' + e.cnt);
    if (e.lv) facts.push('Level ' + e.lv);
    if (e.stars) facts.push('★'.repeat(Math.min(5, e.stars)));
    if (e.no) facts.push('No. ' + e.no);
    if (e.cmd) facts.push(esc(e.cmd));
    if (e.race) facts.push(esc(e.race));
    if (e.zone) facts.push(esc(e.zone));
    if (e.spot) facts.push(esc(e.spot));
    if (e.kind) facts.push(esc(e.kind));
    if (e.pts) facts.push(e.pts + ' points');
    if (e.max) facts.push('Complete at ' + (e.unit || 'level') + ' ' + e.max);
    if (e.city) facts.push('Only for characters who started in ' + ET.CITIES[e.city]);
    if (e.gc) facts.push('Only for the ' + ET.GCS[e.gc]);
    if (facts.length) bits.push('<div>' + facts.join(' · ') + '</div>');
    if (LX) {
      var lk = ET.linksOf(LX, k), gold = ST.settings.gold !== false;
      var imp = lk.implies.filter(function (x) { return x[1] !== 'g' || gold; }).map(function (x) { return x[0]; });
      var by = lk.by.filter(function (x) { return x[1] !== 'g' || gold; }).map(function (x) { return x[0]; });
      var whenRules = lk.rules.filter(function (r) { return r.target === k && (r.kind !== 'g' || gold); }).map(function (r) {
        if (r.type === 'all') return 'all ' + r.members.length + ' of: ' + nameList(r.members, 3, hit.s.id);
        if (r.type === 'any') return 'any one of: ' + nameList(r.members, 3, hit.s.id);
        if (r.type === 'cnt') return r.n.toLocaleString() + ' or more of ' + (IDX.byKey.get(r.members[0]) ? IDX.byKey.get(r.members[0]).s.t : 'a list');
        if (r.type === 'lvl') return r.levels.map(function (l) { return IDX.byKey.get(l[0]).e.n + ' level ' + l[1]; }).join(r.need < r.levels.length ? ' / ' : ' and ') + (r.need < r.levels.length ? ' (' + r.need + ' of them)' : '');
        return '';
      }).filter(Boolean);
      var part = lk.rules.filter(function (r) { return r.target && r.target !== k && (r.type === 'all' || r.type === 'cnt') && (r.kind !== 'g' || gold); }).map(function (r) { return r.target; });
      var lines = [];
      if (imp.length) lines.push('<b>Ticking it also ticks:</b> ' + esc(nameList(imp, 4, hit.s.id)));
      if (by.length) lines.push('<b>Ticked automatically by:</b> ' + esc(nameList(by, 4, hit.s.id)));
      whenRules.forEach(function (w) { lines.push('<b>Ticked automatically with:</b> ' + esc(w)); });
      if (part.length) lines.push('<b>Counts toward:</b> ' + esc(nameList(part, 3, hit.s.id)));
      if (lines.length) bits.push('<div class="links">' + lines.map(function (l) { return '<div>' + l + '</div>'; }).join('') + '</div>');
    }
    var na = ST.chars.map(function (c) { var w = ET.notApplicable(ST, c, k, e); return w ? esc(c.name) + ' (' + WHY[w] + ')' : null; }).filter(Boolean);
    if (na.length) bits.push('<div><b>Does not apply to:</b> ' + na.join(', ') + '</div>');
    if (!av.info) {
      var status = av.counted ? (av.manual === 'ok' ? 'Counted (your choice; normally: ' + esc(markText(hit, av.builtIn, MARK)) + ')' : 'Counted in totals') : (av.manual === 'x' ? 'Not counted: you marked it unobtainable' : 'Not counted: ' + esc(markText(hit, av.builtIn, MARK)));
      bits.push('<div class="row"><span><b>Status:</b> ' + status + '</span><button type="button" class="btn sm" data-x="' + k + '">' + (av.counted ? 'Mark unobtainable (stop counting)' : 'Count it anyway') + '</button>' + (av.manual ? '<button type="button" class="btn sm ghost" data-xauto="' + k + '">Back to the default</button>' : '') + '</div>');
    }
    return '<div class="det" data-det="' + k + '">' + bits.join('') + '</div>';
  }
  function rowHtml(k) {
    var hit = IDX.byKey.get(k), e = hit.e, av = ET.availability(ST, k, e), open = OPEN.has(k);
    var cells = ST.chars.map(function (c) {
      var on = !!ST.ticks[c.id][k], na = ET.notApplicable(ST, c, k, e);
      if (e.val) {
        var v = ET.getValue(ST, c.id, k);
        return '<span class="c"><input class="lvl' + (on ? ' on' : '') + '" type="number" inputmode="numeric" min="0" max="9999" data-k="' + k + '" data-c="' + c.id + '" value="' + (v == null ? '' : esc(v)) + '" placeholder="–" aria-label="' + esc(c.name) + ' ' + (e.unit || 'level') + '"></span>';
      }
      return '<span class="c"><button type="button" class="tk' + (on ? ' on' : '') + (na ? ' na' : '') + '" data-k="' + k + '" data-c="' + c.id + '" aria-pressed="' + on + '" title="' + esc(c.name) + (na ? ': does not apply (' + WHY[na] + ')' : '') + (na && na !== 'manual' ? '' : ' · click: done · right-click: does not apply · click again: clear') + '" aria-label="' + esc(c.name) + (na ? ', does not apply' : '') + '"><i></i></button></span>';
    }).join('');
    var pill = av.marked ? '<button type="button" class="pill" data-x="' + k + '" title="Not counted. Click to count it anyway.">' + (av.manual === 'x' ? 'Not counted' : markText(hit, av.builtIn, SHORT) || 'Not counted') + '</button>' : '';
    return '<div class="lr er' + (av.marked ? ' x' : '') + (open ? ' open' : '') + '" data-k="' + k + '"><span class="c0" data-open="' + k + '" tabindex="0" role="button" aria-expanded="' + open + '"><span class="nm">' + esc(e.n) + '</span>' + (TWIN.has(k) && (e.d || e.sc || e.jc) ? '<span class="p">' + esc(e.sc ? 'starting class route' : e.jc ? 'joined later route' : String(e.d).split(' · ')[0]) + '</span>' : '') + (e.p ? '<span class="p">' + esc(e.p) + '</span>' : '') + pill + '</span>' + cells + '</div>' + (open ? detailHtml(k) : '');
  }
  // ── how to get it: the information window (hover over a name; tap the name on a touch screen for the details) ──
  var INFO = null, INFO_P = null;
  function loadInfo() {
    if (INFO_P) return INFO_P;
    INFO_P = new Promise(function (resolve) {
      try {
        var el = document.getElementById('info-data'), b64 = el ? el.textContent.trim() : '';
        if (!b64 || typeof DecompressionStream !== 'function') { INFO = {}; return resolve(INFO); }
        var bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (var n = 0; n < bin.length; n++) bytes[n] = bin.charCodeAt(n);
        new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
          .then(function (t) { INFO = JSON.parse(t); resolve(INFO); }, function () { INFO = {}; resolve(INFO); });
      } catch (e) { INFO = {}; resolve(INFO); }
    });
    return INFO_P;
  }
  function infoLines(k) { return (INFO && INFO[k]) || []; }
  // "Step 3: Speak with X." reads as a numbered walkthrough; other lines are plain
  function lineHtml(l) {
    if (l.charAt(0) === '§') return '';
    var m = /^Step (\d+): (.*)$/.exec(l); if (m) return '<div class="step"><b>' + m[1] + '.</b> ' + esc(m[2]) + '</div>';
    m = /^How to obtain: (.*)$/.exec(l); if (m) return '<div><b>How to obtain:</b> ' + esc(m[1]) + '</div>';
    return '<div>' + esc(l) + '</div>';
  }
  // item stamps from the first information line ("§untradable,dye2"): an untradable stamp and the dye drop
  var DYE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5C8 1.5 3.2 7 3.2 10.2a4.8 4.8 0 0 0 9.6 0C12.8 7 8 1.5 8 1.5z" fill="currentColor"/><path d="M6 10.5a2 2 0 0 0 2 2" stroke="var(--paper)" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".7"/></svg>';
  function stampsHtml(k) {
    var l = infoLines(k)[0];
    if (!l || l.charAt(0) !== '§') return '';
    var out = '';
    l.slice(1).split(',').forEach(function (t) {
      if (t === 'untradable') out += '<span class="stamp" title="Cannot be traded or sold on the market board">Untradable</span>';
      var d = /^dye(\d)$/.exec(t); if (d) out += '<span class="dye" title="Dyeable' + (d[1] === '2' ? ' (two dye channels)' : '') + '">' + DYE_SVG + (d[1] === '2' ? DYE_SVG : '') + '</span>';
    });
    return out ? '<span class="stamps">' + out + '</span>' : '';
  }
  // ── Eorzea time, weather and live windows ──
  // Eorzea time runs 3600/175 times faster than real time; weather changes every 8 Eorzea hours (1,400 real seconds)
  // and is chosen by the game's formula from the time and each zone's weather table (data/conditions.json).
  var COND = (function () { try { return JSON.parse(document.getElementById('cond-data').textContent); } catch (err) { return { weather: {}, names: {}, regions: [], cond: {}, nodes: {} }; } })();
  var PERIOD = 1400000;
  function etHours(ms) { return (ms * 3600 / 175 / 1000 / 3600) % 24; }
  function etText(ms) { var h = etHours(ms), m = Math.floor((h % 1) * 60); return ('0' + Math.floor(h)).slice(-2) + ':' + ('0' + m).slice(-2); }
  function wTarget(ms) {
    var unix = Math.floor(ms / 1000), bell = Math.floor(unix / 175), inc = (bell + 8 - (bell % 8)) % 24, days = Math.floor(unix / 4200);
    var base = (days * 100 + inc) >>> 0, s1 = ((base << 11) ^ base) >>> 0, s2 = ((s1 >>> 8) ^ s1) >>> 0;
    return s2 % 100;
  }
  function weatherAt(zone, ms) { var t = COND.weather[zone]; if (!t) return 0; var v = wTarget(ms); for (var n = 0; n < t.length; n++) if (v < t[n][1]) return t[n][0]; return t[t.length - 1][0]; }
  function wName(id) { return COND.names[id] || ''; }
  function periodStart(ms) { return Math.floor(ms / PERIOD) * PERIOD; }
  function inHours(h, a, b) { return a <= b ? h >= a && h < b : h >= a || h < b; }
  function realFromEt(etH) { return etH * 175000; } // Eorzea hours -> real ms
  // is the entry's window open now, and when does it next open (searching up to about 30 days ahead)?
  function windowInfo(k, now) {
    var c = COND.cond[k], nd = COND.nodes[k];
    if (nd) {
      var h = etHours(now), dur = nd[1] / 60, open = nd[0].some(function (s) { return inHours(h, s, (s + dur) % 24); });
      var best = null; nd[0].forEach(function (s) { var d = (s - h + 24) % 24; if (d > 0 && (best === null || d < best)) best = d; });
      return { open: open, next: open ? null : now + realFromEt(best), until: open ? now + realFromEt(Math.min.apply(null, nd[0].map(function (s) { var e = (s + dur) % 24; return (e - h + 24) % 24 || 24; }))) : null };
    }
    if (!c) return null;
    var zone = c[0], a = c[1], b = c[2], ws = c[3], pws = c[4];
    function okWeather(p) { return (!ws.length || ws.indexOf(weatherAt(zone, p)) >= 0) && (!pws.length || pws.indexOf(weatherAt(zone, p - PERIOD)) >= 0); }
    var p0 = periodStart(now);
    for (var n = 0; n < 2200; n++) {
      var p = p0 + n * PERIOD;
      if (!okWeather(p)) continue;
      var pe = etHours(p), lo = Math.max(p, n === 0 ? now : p), hi = p + PERIOD;
      // walk this 8-hour period in Eorzea quarter-hours to find where the hour window is open
      for (var t = lo; t < hi; t += 43750) {
        if (inHours(etHours(t), a, b)) {
          var end = t; while (end < hi && inHours(etHours(end), a, b) && okWeather(periodStart(end))) end += 43750;
          if (end >= hi) { var q = hi; while (q < hi + 3 * PERIOD && okWeather(periodStart(q)) && inHours(etHours(q), a, b)) q += 43750; end = q; }
          return t <= now ? { open: true, until: end, zone: zone } : { open: false, next: t, until: end, zone: zone };
        }
      }
    }
    return { open: false, next: null, zone: zone };
  }
  function openNow(k, now) {
    var c = COND.cond[k], nd = COND.nodes[k], h = etHours(now);
    if (nd) return nd[0].some(function (st) { return inHours(h, st, (st + nd[1] / 60) % 24); });
    if (!c || !inHours(h, c[1], c[2])) return false;
    var p = periodStart(now);
    return (!c[3].length || c[3].indexOf(weatherAt(c[0], p)) >= 0) && (!c[4].length || c[4].indexOf(weatherAt(c[0], p - PERIOD)) >= 0);
  }
  function dur(ms) { var m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; }
  function lt(ms) { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function condText(k) {
    var c = COND.cond[k], nd = COND.nodes[k], bits = [];
    if (nd) return 'Up at ' + nd[0].map(function (s) { return ('0' + s).slice(-2) + ':00'; }).join(', ') + ' Eorzea time';
    if (!c) return '';
    if (!(c[1] === 0 && c[2] === 24)) bits.push(etText(realFromEt(c[1])) + '–' + etText(realFromEt(c[2] % 24)) + ' ET');
    if (c[3].length) bits.push(c[3].map(wName).join(' or '));
    if (c[4].length) bits.push('after ' + c[4].map(wName).join(' or '));
    return bits.join(' · ') + (c[0] ? ' in ' + c[0] : '');
  }
  function liveLine(k) {
    var w = windowInfo(k, Date.now()); if (!w) return '';
    var head = w.open ? '<b class="live-now">Available now</b>' + (w.until ? ' for ' + dur(w.until - Date.now()) : '') : (w.next ? '<b>Next window</b> in ' + dur(w.next - Date.now()) + ' (your time ' + lt(w.next) + ')' : '<b>No window in the next month</b>');
    return '<div class="live-line">' + head + '<br><span class="dim">' + esc(condText(k)) + '</span></div>';
  }
  function tickClock() {
    var el = $('#clock'); if (!el) return;
    var now = Date.now();
    el.innerHTML = '<span class="ck-et">ET ' + etText(now) + '</span><span class="ck-lt">' + lt(now) + '</span>';
  }
  function refreshLive() {
    var now = Date.now();
    $$('.er[data-k]').forEach(function (row) {
      var k = row.dataset.k; if (!COND.cond[k] && !COND.nodes[k]) return;
      row.classList.toggle('live', openNow(k, now)); row.classList.add('timed');
    });
    if (UI.view === 'weather') renderWeather(true);
  }
  function renderWeather(soft) {
    var now = Date.now(), p0 = periodStart(now);
    var rows = COND.regions.map(function (r) {
      return '<div class="wx-reg"><h3>' + esc(r[1]) + ' <span class="dim">' + esc(r[0]) + '</span></h3>' + r[2].map(function (z) {
        var cells = [0, 1, 2, 3].map(function (n) { var p = p0 + n * PERIOD, w = weatherAt(z, p); return '<span class="wx' + (n === 0 ? ' now' : '') + '" title="' + (n === 0 ? 'Now, until ' : 'From ') + lt(n === 0 ? p + PERIOD : p) + ' your time (ET ' + etText(p) + ')">' + esc(wName(w)) + '</span>'; }).join('');
        return '<div class="wx-row"><span class="wx-z">' + esc(z) + '</span>' + cells + '</div>';
      }).join('') + '</div>';
    }).join('');
    var head = '<div class="p-head"><span class="ttl"><span class="kick">Eorzea time ' + etText(now) + ' · your time ' + lt(now) + '</span><h2>Weather</h2><p class="note">Every zone with weather, including Eureka, Bozja, the Occult Crescent, the Diadem, Island Sanctuary and Cosmic Exploration. Columns: now (changes in ' + dur(p0 + PERIOD - now) + '), then the next three 8-hour Eorzea periods. Hover a cell for its time. Entries in the lists that can be done right now (vistas, fish, timed nodes) are highlighted there.</p></span></div>';
    var html = head + '<div class="wx-head"><span class="wx-z">Zone</span><span class="wx">Now</span><span class="wx">Next</span><span class="wx">Then</span><span class="wx">Later</span></div>' + rows;
    if (soft && $('#page').dataset.wx === String(p0)) { var k = $('#page .kick'); if (k) k.textContent = 'Eorzea time ' + etText(now) + ' · your time ' + lt(now); return; }
    $('#page').innerHTML = html; $('#page').dataset.wx = String(p0);
  }
  setInterval(tickClock, 1000); setInterval(refreshLive, 5000);
  setTimeout(function () { tickClock(); refreshLive(); }, 0);
  function tipHtml(k) {
    var hit = IDX.byKey.get(k), e = hit.e, bits = [];
    bits.push('<div class="tt-row"><span><b class="tt">' + esc(e.n) + '</b>' + (e.p ? ' <span class="p">' + esc(e.p) + '</span>' : '') + '</span>' + stampsHtml(k) + '</div>');
    if (e.d && infoLines(k).join(' ').indexOf(e.d) < 0) bits.push('<div>' + esc(e.d) + '</div>');
    var lw = liveLine(k); if (lw) bits.push(lw);
    infoLines(k).forEach(function (l) { bits.push(lineHtml(l)); });
    if (e.src && !infoLines(k).filter(function (l) { return l.charAt(0) !== '§'; }).length) bits.push('<div><b>How to obtain:</b> ' + esc(e.src.join(' · ')) + '</div>');
    if (!infoLines(k).length && !e.src && !e.d) bits.push('<div class="dim">No how-to details for this one yet.</div>');
    return bits.join('');
  }
  var tipTimer = null, tipHide = null, tipKey = null;
  function showTip(k, anchor) {
    loadInfo().then(function () {
      if (tipKey !== k) return;
      var t = $('#tip'); t.innerHTML = tipHtml(k); t.classList.remove('hidden');
      var r = anchor.getBoundingClientRect(), w = Math.min(420, window.innerWidth - 24);
      t.style.maxWidth = w + 'px';
      var left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
      var top = r.bottom + 6; t.style.left = left + 'px'; t.style.top = top + 'px';
      var th = t.getBoundingClientRect().height;
      if (top + th > window.innerHeight - 8) t.style.top = Math.max(8, r.top - th - 6) + 'px';
    });
  }
  function hideTip() { tipKey = null; clearTimeout(tipTimer); var t = $('#tip'); if (t) t.classList.add('hidden'); }
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('mouseover', function (ev) {
      var nm = ev.target.closest && ev.target.closest('.er .c0 .nm');
      if (!nm) { if (tipKey) hideTip(); return; }
      var k = nm.closest('.er').dataset.k;
      clearTimeout(tipHide);
      if (tipKey === k) return;
      clearTimeout(tipTimer); tipKey = k;
      tipTimer = setTimeout(function () { showTip(k, nm); }, 350);
    });
    window.addEventListener('scroll', hideTip, true);
  }
  var OPEN = new Set();
  function norm(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function applying(k, e) { return ST.chars.filter(function (c) { return !ET.notApplicable(ST, c, k, e); }); }
  function passes(k, q) {
    var e = IDX.byKey.get(k).e;
    if (q && norm(e.n + ' ' + (e.d || '') + ' ' + (e.src ? e.src.join(' ') : '')).indexOf(q) < 0) return false;
    var av = ET.availability(ST, k, e);
    if (!UI.showX && av.marked && UI.filter !== 'unob') return false;
    if (UI.filter === 'all') return true;
    if (UI.filter === 'unob') return av.marked;
    if (!av.counted) return false;
    var apply = applying(k, e);
    var done = apply.filter(function (c) { return ST.ticks[c.id][k]; }).length;
    if (UI.filter === 'missing') return done < apply.length;
    if (UI.filter === 'done') return apply.length > 0 && done === apply.length;
    return true;
  }
  function groupCounts(keys) {
    return ST.chars.map(function (c) {
      var n = 0, d = 0;
      keys.forEach(function (k) { var hit = IDX.byKey.get(k); if (!hit) return; var av = ET.availability(ST, k, hit.e); if (av.info || !av.counted || ET.notApplicable(ST, c, k, hit.e)) return; n++; if (ST.ticks[c.id][k]) d++; });
      return [d, n];
    });
  }
  function headRowHtml(t) { return '<div class="lr lh" id="lh"><span class="c0">' + (UI.view === 'sec' ? esc(SEC.get(UI.sec).t) : 'Entry') + '</span>' + headCells(t) + '</div>'; }
  function groupHtml(sid, gi, g, keys, label) {
    var id = sid + '#' + gi, sec = SEC.get(sid);
    // Groups start closed when a list opens (only their headers and counts show), so a long list reads as a short
    // table of contents. A list with one group, a search inside the list and the global search show rows directly.
    var folded = !(OPENG.has(id) || UI.find || sid.indexOf('find:') === 0 || (sec && sec.groups.length === 1));
    var cnt = groupCounts(g.keys);
    return '<div class="lgroup' + (folded ? ' folded' : '') + '" data-g="' + sid + '#' + gi + '"><div class="lr gh"><span class="c0" data-fold="' + sid + '#' + gi + '" tabindex="0" role="button" aria-expanded="' + !folded + '"><span class="fold">▾</span><span class="t">' + esc(label || g.t) + '</span>' + (g.c ? '<span class="k">' + esc(g.c) + '</span>' : '') + '</span>' +
      ST.chars.map(function (c, i) { var full = cnt[i][1] && cnt[i][0] === cnt[i][1]; return '<span class="c' + (full ? ' full' : '') + '" data-gc="' + c.id + '" data-gk="' + sid + '#' + gi + '" tabindex="0" role="button" title="' + esc(c.name) + ': ' + cnt[i][0] + ' of ' + cnt[i][1] + '. Click to tick or clear the whole group.">' + (cnt[i][1] ? (full ? '✓' : colWidth() < 44 ? String(cnt[i][0]) : cnt[i][0] + '/' + cnt[i][1]) : '–') + '</span>'; }).join('') + '</div>' +
      (folded ? '' : keys.map(rowHtml).join('')) + '</div>';
  }
  var OPENG = new Set(); // groups opened in the current list (reset each time a list is entered)
  var GROUP_KEYS = new Map(); // "sid#gi" -> keys of the full group

  // ── pages ──
  function setView(view, sec, push) {
    UI.view = view; UI.sec = sec || UI.sec; document.body.classList.remove('drawer'); OPEN.clear(); OPENG.clear(); XFOLD.clear(); UI.find = '';
    persist(); render();
    var h = view === 'sec' ? '#/s/' + sec : view === 'search' ? '#/find' : isLive(view) ? '#/live/' + view : '#/';
    if (push !== false && location.hash !== h) history.pushState(null, '', h);
    $('#page').focus({ preventScroll: true }); window.scrollTo(0, 0);
  }
  function render() {
    TALLY.clear();
    renderSide();
    if (isLive(UI.view)) LIVE_RENDER[UI.view]();
    else if (UI.view === 'sec' && SEC.has(UI.sec)) renderSection(UI.sec);
    else if (UI.view === 'search' && UI.q) renderSearch();
    else renderHome();
    $('#page').style.setProperty('--n', ST.chars.length);
  }
  function colWidth() {
    var page = $('#page'), w = page ? page.clientWidth : window.innerWidth, n = ST.chars.length;
    var nameCol = w < 520 ? 120 : w < 860 ? 170 : 260;
    return Math.max(26, Math.min(96, Math.floor((w - nameCol) / n)));
  }
  function cw() { return colWidth(); }
  function renderHome() {
    var allIds = IDX.sections.map(function (s) { return s.id; }), tAll = tallyOf(allIds);
    var cells = function (t) { return ST.chars.map(function (c) { var d = t.done[c.id], n = t.totals[c.id], full = n && d === n; return '<span class="c' + (full ? ' full' : '') + '" title="' + esc(c.name) + ': ' + d + ' of ' + n + '">' + pctTxt(d, n) + '<span class="meter"><i style="width:' + ET.percent(d, n) + '%"></i></span></span>'; }).join(''); };
    var h = '<div class="p-head"><span class="ttl"><h2>Overview</h2><p class="note">Each row is a folder of the menu; each column is a character. Click a row to open it.</p></span></div>';
    h += '<div class="ov-table" style="--n:' + ST.chars.length + ';--cw:' + cw() + 'px"><div class="lr lh"><span class="c0">Folder</span>' + headCells(tAll) + '</div>';
    h += '<div class="lr fr tot-row"><span class="c0">Everything</span>' + cells(tAll) + '</div>';
    // achievement points: the points of every ticked achievement, per character
    var ptsAll = 0, ptsBy = {}; ST.chars.forEach(function (c) { ptsBy[c.id] = 0; });
    IDX.sections.forEach(function (s) { if (s.id.indexOf('ach-') !== 0) return; s.groups.forEach(function (g) { g.keys.forEach(function (k) { var p = IDX.byKey.get(k).e.pts || 0; ptsAll += p; ST.chars.forEach(function (c) { if (ST.ticks[c.id][k]) ptsBy[c.id] += p; }); }); }); });
    h += '<div class="lr fr ach-pts"><span class="c0">Achievement points</span>' + ST.chars.map(function (c) { return '<span class="c" title="' + esc(c.name) + ': ' + ptsBy[c.id].toLocaleString() + ' of ' + ptsAll.toLocaleString() + ' achievement points">' + ptsBy[c.id].toLocaleString() + '</span>'; }).join('') + '</div>';
    MENUS.forEach(function (m) {
      h += '<div class="lr mh"><span class="c0">' + esc(m.t) + '</span></div>';
      m.folders.forEach(function (f) {
        h += '<div class="lr fr" data-act="sec" data-id="' + f.secs[0] + '" role="link" tabindex="0"><span class="c0">' + esc(f.t) + '</span>' + cells(tallyOf(f.secs)) + '</div>';
      });
    });
    $('#page').innerHTML = h + '</div>';
  }
  function toolbarHtml() {
    var chip = function (v, l) { return '<button type="button" data-filter="' + v + '" class="' + (UI.filter === v ? 'on' : '') + '">' + l + '</button>'; };
    return '<div class="bar"><input class="find" id="find" type="search" placeholder="Find in this list" value="' + esc(UI.find) + '" aria-label="Find in this list">' +
      '<span class="chips" role="group" aria-label="Show">' + chip('all', 'All') + chip('missing', 'Missing') + chip('done', 'Done') + '</span>' +
      '<span class="grow"></span>' +
      '<button type="button" class="opt-btn" data-openall="1">Open all</button><button type="button" class="opt-btn" data-openall="0">Close all</button>' +
      '<button type="button" class="opt-btn' + (UI.showX ? ' on' : '') + '" data-showx="1" title="Entries that are not counted (time-limited, unobtainable or unknown)">' + (UI.showX ? '✓ ' : '') + 'Show not counted</button>' +
      '<button type="button" class="opt-btn' + (UI.mode === 'na' ? ' on' : '') + '" data-mode="' + (UI.mode === 'na' ? 'tick' : 'na') + '" title="Mark entries that do not apply to one character">' + (UI.mode === 'na' ? '✓ ' : '') + 'Mark “does not apply”</button>' +
      (UI.mode === 'na' ? '<span class="mode-note">Clicking a box now marks that entry as not applying to that character. Click “Mark does not apply” again to go back to ticking.</span>' : '<span class="mode-note quiet">Click a box: done. Right-click (or press and hold): does not apply. Click a marked box again to clear it.</span>') + '</div>';
  }
  function renderSection(sid) {
    var sec = SEC.get(sid), raw = RAW.get(sid), mo = menuOf(sid);
    var t = tallyOf([sid]);
    var h = '<div class="p-head"><span class="ttl"><span class="kick">' + esc((mo[0] ? mo[0].t : '') + (mo[1] && mo[1].t !== (mo[0] && mo[0].t) ? ' › ' + mo[1].t : '')) + '</span><h2>' + esc(sec.t) + '</h2>' + (raw.note ? '<p class="note">' + esc(raw.note) + '</p>' : '') + '</span><span class="tot">' + t.total.toLocaleString() + ' entries' + (t.marked ? ' · ' + t.marked.toLocaleString() + ' not counted' : '') + '</span></div>';
    h += toolbarHtml();
    h += '<div class="ledger" id="ledger" style="--n:' + ST.chars.length + ';--cw:' + cw() + 'px"></div>';
    $('#page').innerHTML = h;
    renderLedger();
  }
  // A list whose groups belong to different expansions shows an expansion heading above them (with each character's
  // count for that expansion); clicking it folds the expansion's groups away.
  var XFOLD = new Set(); // "sid|expansion" folded in the current visit
  function expansionHtml(sid, xp, keys) {
    var id = sid + '|' + xp, folded = XFOLD.has(id) && !UI.find, cnt = groupCounts(keys);
    return '<div class="lr gx' + (folded ? ' folded' : '') + '"><span class="c0" data-xfold="' + esc(id) + '" tabindex="0" role="button" aria-expanded="' + !folded + '"><span class="fold">▾</span><span class="t">' + esc(xp) + '</span></span>' +
      ST.chars.map(function (c, i) { var full = cnt[i][1] && cnt[i][0] === cnt[i][1]; return '<span class="c' + (full ? ' full' : '') + '" title="' + esc(c.name) + ', ' + esc(xp) + ': ' + cnt[i][0] + ' of ' + cnt[i][1] + '">' + (cnt[i][1] ? (full ? '✓' : colWidth() < 44 ? String(cnt[i][0]) : cnt[i][0] + '/' + cnt[i][1]) : '–') + '</span>'; }).join('') + '</div>';
  }
  function renderLedger() {
    var sid = UI.sec, sec = SEC.get(sid), q = norm(UI.find), any = false;
    var h = headRowHtml(tallyOf([sid]));
    var layered = sec.groups.some(function (g) { return g.xp; }), xp = null;
    sec.groups.forEach(function (g, gi) {
      GROUP_KEYS.set(sid + '#' + gi, g.keys);
      var keys = orderedKeys(g.keys, sid + '#' + gi).filter(function (k) { return passes(k, q); });
      if (!keys.length) return;
      any = true;
      // a lone group named like its expansion needs no expansion heading above it
      var same = sec.groups.filter(function (o) { return o.xp === g.xp; });
      var lone = layered && same.length === 1 && norm(g.t) === norm(g.xp || 'Other');
      if (layered && g.xp !== xp) {
        xp = g.xp;
        var all = []; same.forEach(function (o) { all = all.concat(o.keys); });
        if (!lone) h += expansionHtml(sid, xp || 'Other', all);
      }
      if (layered && !lone && XFOLD.has(sid + '|' + (g.xp || 'Other')) && !UI.find) return;
      h += groupHtml(sid, gi, g, keys);
    });
    if (!any) h += '<p class="empty">Nothing to show. Clear the search, choose All, or turn on “Show not counted”.</p>';
    $('#ledger').innerHTML = h;
  }
  function renderSearch() {
    var q = norm(UI.q), out = [], total = 0, all = [];
    IDX.sections.forEach(function (s) {
      var keys = KEYS.get(s.id).filter(function (k) { return norm(IDX.byKey.get(k).e.n).indexOf(q) >= 0; });
      total += keys.length; all = all.concat(keys);
      if (keys.length) out.push([s, orderedKeys(keys).slice(0, 60)]);
    });
    var h = '<div class="p-head"><span class="ttl"><span class="kick">Search</span><h2>“' + esc(UI.q) + '”</h2><p class="note">' + total.toLocaleString() + ' match' + (total === 1 ? '' : 'es') + ' in ' + out.length + ' list' + (out.length === 1 ? '' : 's') + (total > 600 ? '; showing the first 60 per list' : '') + '.</p></span></div>';
    h += '<div class="ledger" id="ledger" style="--n:' + ST.chars.length + ';--cw:' + cw() + 'px">' + '<div class="lr lh" id="lh"><span class="c0">Matches</span>' + headCells(ET.tally(IDX, ST, all)) + '</div>';
    out.forEach(function (o) {
      var g = { t: o[0].t, c: '', keys: o[1] };
      GROUP_KEYS.set('find:' + o[0].id + '#0', o[1]);
      h += groupHtml('find:' + o[0].id, 0, g, o[1], o[0].t);
    });
    if (!out.length) h += '<p class="empty">No entry has that name.</p>';
    $('#page').innerHTML = h + '</div>';
  }

  // ── updating after a change, without re-rendering the whole list ──
  function refreshAfter(keys) {
    staleTallies(keys);
    keys.forEach(function (k) {
      var row = $('.er[data-k="' + CSS.escape(k) + '"]', $('#page'));
      if (!row || !row.isConnected) return;
      if (row.querySelector('.lvl')) { // level rows update in place (the field may still have focus)
        $$('.lvl', row).forEach(function (inp) { inp.classList.toggle('on', !!ST.ticks[inp.dataset.c][k]); });
        return;
      }
      var det = row.nextElementSibling && row.nextElementSibling.classList.contains('det') ? row.nextElementSibling : null;
      if (det) det.remove();
      row.outerHTML = rowHtml(k);
    });
    $$('.lgroup', $('#page')).forEach(function (gEl) {
      var full = GROUP_KEYS.get(gEl.dataset.g);
      if (!full) return;
      var cnt = groupCounts(full);
      $$('.gh .c', gEl).forEach(function (cell, i) { var f = !!cnt[i][1] && cnt[i][0] === cnt[i][1]; cell.textContent = cnt[i][1] ? (f ? '✓' : colWidth() < 44 ? String(cnt[i][0]) : cnt[i][0] + '/' + cnt[i][1]) : '–'; cell.classList.toggle('full', f); });
    });
    var lh = $('#lh');
    if (lh && UI.view === 'sec') lh.outerHTML = headRowHtml(tallyOf([UI.sec]));
    queueSide();
    save();
  }
  var dirty = false;
  function save() { ET.saveState(ST); dirty = true; queueDriveSync(); }

  // ── a character's box: left click marks it done, right click (or a long press on a touch screen) marks it as not
  // applying to that character; any click on a box that is already marked returns it to unmarked (and counted) ──
  // ── links: ticking an entry also ticks what it proves (only adds; Undo in the message) ──
  function linksOn() { return !!LX && ST.settings.links !== false; }
  function followLinks(charId, keys, extra) {
    if (!linksOn()) return [];
    return ET.applyLinks(LX, IDX, ST, charId, keys, Object.assign({ gold: ST.settings.gold !== false }, extra || {}));
  }
  // names, with the list in brackets for entries from another list than `home` (e.g. "Magitek Armor (Mounts)")
  function nameList(keys, max, home) {
    var names = keys.slice(0, max).map(function (k) { var h = IDX.byKey.get(k); return !h ? k : h.e.n + (home && h.s.id !== home ? ' (' + h.s.t + ')' : ''); });
    return names.join(', ') + (keys.length > max ? ' and ' + (keys.length - max).toLocaleString() + ' more' : '');
  }
  function announceLinks(charId, added) {
    if (!added.length) return;
    toastAction('Also ticked for ' + charName(charId) + ': ' + nameList(added, 3, UI.view === 'sec' ? UI.sec : null), 'Undo', function () {
      added.forEach(function (k) { ET.setTick(ST, charId, k, false); });
      refreshAfter(added); toast('Undone');
    });
  }
  var longPressAt = 0;
  function boxAction(tk, button) {
    var k = tk.dataset.k, c = tk.dataset.c, ent = IDX.byKey.get(k).e, ch0 = ST.chars.find(function (x) { return x.id === c; });
    var why = ET.notApplicable(ST, ch0, k, ent);
    if (why && why !== 'manual') { toast('Does not apply to ' + ch0.name + ': ' + WHY[why] + '. Change it in Settings → Characters.'); return; }
    var done = !!ST.ticks[c][k], na = ET.isExcluded(ST, c, k);
    if (done || na) {
      if (done) ET.setTick(ST, c, k, false);
      if (na) ET.setExcluded(ST, c, k, false);
    } else if (button === 'right' || UI.mode === 'na') ET.setExcluded(ST, c, k, true);
    else {
      ET.setTick(ST, c, k, true);
      var added = followLinks(c, [k]);
      refreshAfter([k].concat(added)); announceLinks(c, added); return;
    }
    refreshAfter([k]);
  }
  document.addEventListener('contextmenu', function (e) {
    var tk = e.target.closest && e.target.closest('.tk');
    if (!tk) return;
    e.preventDefault();
    if (Date.now() - longPressAt < 700) return; // the long press below already handled it
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; longPressAt = Date.now(); } // a touch browser's own long-press menu: handle it once
    boxAction(tk, 'right');
  });
  var pressTimer = null;
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    var tk = e.target.closest && e.target.closest('.tk');
    if (!tk) return;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function () { pressTimer = null; longPressAt = Date.now(); boxAction(tk, 'right'); if (navigator.vibrate) navigator.vibrate(15); }, 550);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (ev !== 'pointermove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 6) { clearTimeout(pressTimer); pressTimer = null; } });
  });

  // ── events ──
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a) {
      var act = a.dataset.act;
      if (act === 'home') { e.preventDefault(); setView('home'); return; }
      if (act === 'weather') { e.preventDefault(); setView('weather'); return; }
      if (act === 'sec') { setView('sec', a.dataset.id); return; }
      if (act === 'settings') { openSettings(); return; }
      if (act === 'drawer') { document.body.classList.toggle('drawer'); return; }
    }
    if (document.body.classList.contains('drawer') && !e.target.closest('.side') && !e.target.closest('.menu-btn')) document.body.classList.remove('drawer');
    var tk = e.target.closest('.tk');
    if (tk) { if (Date.now() - longPressAt < 700) return; boxAction(tk, 'left'); return; }
    var xa = e.target.closest('[data-xauto]');
    if (xa) { ET.setAvailability(ST, xa.dataset.xauto, 'auto'); toast('Back to the default'); refreshAfter([xa.dataset.xauto]); return; }
    var xb = e.target.closest('[data-x]');
    if (xb) { var key = xb.dataset.x; var counted = ET.toggleAvailability(ST, key, IDX.byKey.get(key).e); toast(counted ? 'Now counted in totals' : 'Marked unobtainable: no longer counted'); refreshAfter([key]); return; }
    var op = e.target.closest('[data-open]');
    if (op) { var ok = op.dataset.open; if (OPEN.has(ok)) OPEN.delete(ok); else OPEN.add(ok); var r0 = op.closest('.er'); var d0 = r0.nextElementSibling; if (d0 && d0.classList.contains('det')) d0.remove(); r0.outerHTML = rowHtml(ok); return; }
    var gc = e.target.closest('[data-gc]');
    if (gc) {
      var keys = (GROUP_KEYS.get(gc.dataset.gk) || []), ch = gc.dataset.gc, chObj = ST.chars.find(function (x) { return x.id === ch; });
      var free = keys.filter(function (k2) { var w = ET.notApplicable(ST, chObj, k2, IDX.byKey.get(k2).e); return !w || w === 'manual'; });
      if (UI.mode === 'na') {
        var allNa = free.length && free.every(function (k2) { return ST.excl[ch][k2]; });
        free.forEach(function (k2) { ET.setExcluded(ST, ch, k2, !allNa); });
      } else {
        var live = free.filter(function (k2) { return !ST.excl[ch][k2] && ET.availability(ST, k2, IDX.byKey.get(k2).e).counted; });
        var allOn = live.length && live.every(function (k2) { return ST.ticks[ch][k2]; });
        if (!live.length) { toast('Nothing in this group applies to ' + chObj.name); return; }
        if (!allOn && live.length > 25 && !confirm('Tick all ' + live.length + ' entries in this group for ' + chObj.name + '?')) return;
        // clearing a whole group removes ticks: it is confirmed like a large tick and can be undone right after
        if (allOn && live.length > 25 && !confirm('Clear all ' + live.length + ' ticks in this group for ' + chObj.name + '?')) return;
        ET.setMany(ST, [ch], live, !allOn);
        if (!allOn) { var gAdded = followLinks(ch, live); refreshAfter(keys.concat(gAdded)); announceLinks(ch, gAdded); return; }
        refreshAfter(keys);
        toastAction(live.length + ' ticks cleared for ' + chObj.name, 'Undo', function () { ET.setMany(ST, [ch], live, true); refreshAfter(keys); toast('Undone'); });
        return;
      }
      refreshAfter(keys); return;
    }
    var xf = e.target.closest('[data-xfold]');
    if (xf) { var xid = xf.dataset.xfold; if (XFOLD.has(xid)) XFOLD.delete(xid); else XFOLD.add(xid); renderLedger(); return; }
    var fold = e.target.closest('[data-fold]');
    if (fold) { var id = fold.dataset.fold; if (fold.closest('.lgroup').classList.contains('folded')) OPENG.add(id); else OPENG.delete(id); if (UI.view === 'search') renderSearch(); else renderLedger(); return; }
    var oa = e.target.closest('[data-openall]');
    if (oa) { if (oa.dataset.openall === '1') SEC.get(UI.sec).groups.forEach(function (g, gi) { OPENG.add(UI.sec + '#' + gi); }); else OPENG.clear(); renderLedger(); return; }
    var fl = e.target.closest('[data-filter]');
    if (fl) { UI.filter = fl.dataset.filter; persist(); $$('[data-filter]').forEach(function (b) { b.classList.toggle('on', b === fl); }); renderLedger(); return; }
    var sx = e.target.closest('[data-showx]');
    if (sx) { UI.showX = !UI.showX; persist(); renderSection(UI.sec); return; }
    var md = e.target.closest('[data-mode]');
    if (md) { UI.mode = md.dataset.mode; persist(); renderSection(UI.sec); return; }
  });
  document.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('nav-folder')) { UI.open[e.target.dataset.key] = e.target.open; persist(); } }, true);
  var findTimer = null;
  document.addEventListener('input', function (e) {
    if (e.target.id === 'find') { clearTimeout(findTimer); findTimer = setTimeout(function () { UI.find = e.target.value; renderLedger(); }, 160); }
    if (e.target.id === 'q') { clearTimeout(findTimer); findTimer = setTimeout(function () { UI.q = e.target.value.trim(); if (UI.q.length >= 2) setView('search', null, false); else if (UI.view === 'search') setView('home', null, false); }, 220); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('lvl')) {
      var lk = e.target.dataset.k, lc = e.target.dataset.c;
      ET.setValue(ST, lc, lk, e.target.value, IDX.byKey.get(lk).e);
      var lAdded = followLinks(lc, ST.ticks[lc][lk] ? [lk] : [], { levels: [lk] });
      refreshAfter([lk].concat(lAdded)); announceLinks(lc, lAdded); return;
    }
    if (e.target.id === 'filter') { UI.filter = e.target.value; persist(); renderLedger(); }
    if (e.target.id === 'jump' && e.target.value !== '') { var g = $('.lgroup[data-g="' + UI.sec + '#' + e.target.value + '"]'); if (g) g.scrollIntoView({ block: 'start' }); else toast('That group is hidden by the current filter'); e.target.value = ''; }
  });
  window.addEventListener('popstate', route);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('.fr[data-act]')) { e.target.click(); return; }
    // entry names (details), group headers (open/close) and group counts (tick/clear) are spans: Enter and Space act like a click
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-open], [data-fold], [data-gc], [data-xfold]')) { e.preventDefault(); e.target.click(); return; }
    if (e.key === 'Escape' && document.body.classList.contains('drawer')) document.body.classList.remove('drawer');
  });
  var resizeTimer = null;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { var l = $('#ledger'); if (l) { l.style.setProperty('--cw', cw() + 'px'); if (UI.view === 'sec') renderLedger(); } }, 200); });
  function route() {
    var m = location.hash.match(/^#\/s\/(.+)$/);
    if (m && SEC.has(m[1])) setView('sec', m[1], false);
    else if (/^#\/(live\/)?weather$/.test(location.hash)) setView('weather', null, false);
    else if (/^#\/live\/(\w+)$/.test(location.hash) && isLive(location.hash.slice(7))) setView(location.hash.slice(7), null, false);
    else if (location.hash === '#/' || !location.hash) setView(UI.view === 'sec' && SEC.has(UI.sec) && !location.hash ? 'sec' : 'home', UI.sec, false);
  }
  function charName(id) { var c = ST.chars.find(function (x) { return x.id === id; }); return c ? c.name : id; }

  // ── dialogs ──
  var dlg = $('#dlg');
  function openDialog(html, bind) { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); if (bind) bind(dlg); }
  function closeDialog() { if (dlg.open) dlg.close(); }
  // Automatic prompts (online-refresh differences, cloud-sync conflicts) wait until the window is free, so one never
  // replaces another that is still open (or a settings page the owner is using).
  function whenDialogFree(fn) { if (!dlg.open) return fn(); dlg.addEventListener('close', function once() { dlg.removeEventListener('close', once); setTimeout(function () { whenDialogFree(fn); }, 0); }); }
  // Before any data exists (first run, or unreadable data) the dialog must not be dismissed: the page would be empty.
  dlg.addEventListener('click', function (e) { if (e.target === dlg && ST) closeDialog(); if (e.target.closest('[data-close]')) closeDialog(); });
  dlg.addEventListener('cancel', function (e) { if (!ST) e.preventDefault(); });

  function classSelect(attr, id, cur) {
    var groups = { lim: [], gri: [], uld: [] };
    ET.START_CLASSES.forEach(function (x) { groups[x[2]].push(x); });
    return '<select class="inp" ' + attr + '="' + id + '" aria-label="Starting class"><option value="">Starting class…</option>' +
      Object.keys(groups).map(function (city) { return '<optgroup label="' + esc(ET.CITIES[city]) + '">' + groups[city].map(function (x) { return '<option value="' + x[0] + '"' + (cur === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</optgroup>'; }).join('') +
      (cur && cur.indexOf('city:') === 0 ? '<option value="' + esc(cur) + '" selected>' + esc(ET.CITIES[cur.slice(5)]) + ' (class not recorded)</option>' : '') + '</select>';
  }
  function gcSelect(attr, id, cur) {
    return '<select class="inp" ' + attr + '="' + id + '" aria-label="Grand Company"><option value="">Not yet</option>' + [1, 2, 3].map(function (g) { return '<option value="' + g + '"' + (Number(cur) === g ? ' selected' : '') + '>' + esc(ET.GCS[g]) + '</option>'; }).join('') + '</select>';
  }
  function setupDialog() {
    var n = 8, rowsState = [];
    var draw = function () {
      var rows = '<div class="ch head"><span></span><span>Name</span><span>Starting class</span><span>Grand Company</span></div>';
      for (var i = 0; i < n; i++) {
        var r = rowsState[i] || {};
        rows += '<div class="ch"><b>' + (i + 1) + '</b><input class="inp" data-name="' + i + '" placeholder="Character ' + (i + 1) + '" value="' + esc(r.name || '') + '" aria-label="Character ' + (i + 1) + ' name">' + classSelect('data-cls', i, r.cls) + gcSelect('data-gcs', i, r.gc) + '</div>';
      }
      openDialog('<h3>Welcome to the Eveniunt Tracker</h3><p class="help">Track up to eight characters side by side. For each one, the starting class decides which city’s opening quests apply (the other two cities’ quests are greyed out), and the Grand Company does the same for company quests. You can change all of this later in Settings.</p>' +
        '<div class="row"><label class="help" for="nchars">How many characters</label><select id="nchars" class="inp" style="width:auto">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (k) { return '<option' + (k === n ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>' +
        '<div class="chars setup" style="margin-top:10px">' + rows + '</div>' +
        '<div class="row" style="margin-top:16px"><button type="button" class="btn" id="go">Start tracking</button><button type="button" class="btn ghost" id="load-backup">Load a backup or import saves instead</button></div>', function (d) {
        $('#nchars', d).onchange = function (e) { keep(); n = +e.target.value; draw(); };
        var make = function () {
          keep();
          var st = ET.newState(Array.from({ length: n }, function (_, i) { return (rowsState[i] && rowsState[i].name) || 'Character ' + (i + 1); }));
          st.chars.forEach(function (c, i) { var r = rowsState[i] || {}; ET.setStart(st, c.id, r.cls || null, r.gc || null); });
          return st;
        };
        $('#go', d).onclick = function () { ST = make(); ET.saveState(ST, true); closeDialog(); afterBoot(); toast('Ready. Import desktop-app saves any time from Settings → Import and backup.'); };
        $('#load-backup', d).onclick = function () { ST = make(); afterBoot(); openSettings('data'); };
      });
    };
    var keep = function () {
      $$('[data-name]', dlg).forEach(function (inp) { var i = +inp.dataset.name; rowsState[i] = rowsState[i] || {}; rowsState[i].name = inp.value.trim(); });
      $$('[data-cls]', dlg).forEach(function (s) { var i = +s.dataset.cls; rowsState[i] = rowsState[i] || {}; rowsState[i].cls = s.value; });
      $$('[data-gcs]', dlg).forEach(function (s) { var i = +s.dataset.gcs; rowsState[i] = rowsState[i] || {}; rowsState[i].gc = s.value ? Number(s.value) : null; });
    };
    draw();
  }

  var setTab = 'chars';
  function openSettings(tab) {
    if (tab) setTab = tab;
    var tabs = [['chars', 'Characters'], ['count', 'Counting'], ['data', 'Import and backup'], ['online', 'Online refresh'], ['cloud', 'Cloud sync'], ['look', 'Appearance'], ['about', 'About']];
    var body = { chars: charsTab, count: countTab, data: dataTab, online: onlineTab, cloud: cloudTab, look: function () { return '<div id="s-appearance" class="appearance">' + appearanceHtml() + '</div>'; }, about: aboutTab }[setTab]();
    openDialog('<h3>Settings</h3><nav class="set-nav">' + tabs.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (setTab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</nav>' + body + '<div class="row" style="margin-top:18px"><button type="button" class="btn sm" data-close>Close</button></div>', function (d) {
      $$('[data-tab]', d).forEach(function (b) { b.onclick = function () { openSettings(b.dataset.tab); }; });
      if (setTab === 'look') bindAppearance(d);
      ({ chars: bindChars, count: bindCount, data: bindData, online: bindOnline, cloud: bindCloud }[setTab] || function () {})(d);
    });
  }
  function charsTab() {
    var missing = ST.chars.filter(function (c) { return !c.cls; }).map(function (c) { return c.name; });
    var noGc = ST.chars.filter(function (c) { return !c.gc; }).map(function (c) { return c.name; });
    return '<p class="help">Up to eight characters, side by side in every list. The starting class decides which city’s opening quests apply; the Grand Company does the same for company quests. Entries for the other cities and companies are greyed out for that character and left out of its totals. The Lodestone number (or the character’s Lodestone page address) turns on the online refresh.</p>' +
      (missing.length ? '<p class="help"><b>Choose a starting class for:</b> ' + esc(missing.join(', ')) + '. Until then, all three cities’ opening quests and both versions of the first class quests count for them.</p>' : '') +
      (noGc.length ? '<p class="help"><b>Choose a Grand Company for:</b> ' + esc(noGc.join(', ')) + ' (once they have joined one). Until then, all three companies’ quests, ranks and hunting logs count for them.</p>' : '') +
      '<div class="row"><label class="help" for="cn">How many characters</label><select id="cn" class="inp" style="width:auto">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (k) { return '<option' + (k === ST.chars.length ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>' +
      '<div class="chars" style="margin-top:10px"><div class="ch head"><span></span><span>Name and Lodestone number</span><span>Starting class</span><span>Grand Company</span></div>' + ST.chars.map(function (c, i) {
        return '<div class="ch"><b>' + (i + 1) + '</b><span style="display:grid;gap:4px"><input class="inp" data-cname="' + c.id + '" value="' + esc(c.name) + '" aria-label="Name of character ' + (i + 1) + '"><input class="inp" data-lode="' + c.id + '" value="' + esc(c.lodestone || '') + '" placeholder="Lodestone number (optional)" aria-label="Lodestone number of character ' + (i + 1) + '"></span>' +
          classSelect('data-ccls', c.id, c.cls || (c.city ? 'city:' + c.city : '')) + gcSelect('data-cgc', c.id, c.gc) + '</div>';
      }).join('') + '</div>' +
      '<div class="row" style="margin-top:12px"><button type="button" class="btn sm" id="save-chars">Save characters</button></div>';
  }
  function bindChars(d) {
    $('#cn', d).onchange = function (e) {
      var n = +e.target.value;
      if (n < ST.chars.length) {
        var lost = ST.chars.slice(n).map(function (c) { return c.name; }).join(', ');
        if (!confirm('Remove ' + lost + '? Their ticks will be deleted from this device (save a backup first if unsure).')) { e.target.value = ST.chars.length; return; }
      }
      ET.setCharacterCount(ST, n); save(); render(); openSettings('chars');
    };
    $('#save-chars', d).onclick = function () {
      $$('[data-cname]', d).forEach(function (inp) { ET.renameCharacter(ST, inp.dataset.cname, inp.value); });
      var bad = [];
      $$('[data-lode]', d).forEach(function (inp) { var c = ST.chars.find(function (x) { return x.id === inp.dataset.lode; }); var v = inp.value.trim(); var id = v ? ET.parseLodestoneId(v) : null; if (v && !id) bad.push(c.name); c.lodestone = id; });
      $$('[data-ccls]', d).forEach(function (s) { var c = ST.chars.find(function (x) { return x.id === s.dataset.ccls; }); if (s.value.indexOf('city:') === 0) return; ET.setStart(ST, c.id, s.value || null, undefined); if (!s.value) delete c.city; });
      $$('[data-cgc]', d).forEach(function (s) { ET.setStart(ST, s.dataset.cgc, undefined, s.value ? Number(s.value) : null); });
      ET.migrateAliases(IDX, ST); // a starting class just chosen puts first class quest ticks on its route
      ST.updated = Date.now(); save(); render(); toast(bad.length ? 'Not a Lodestone number for: ' + bad.join(', ') : 'Characters saved'); openSettings('chars');
    };
  }
  function countTab() {
    var sw = function (k, label, help) { return '<div class="look-row"><span><b>' + label + '</b><small>' + help + '</small></span><span class="look-ctl"><label class="switch"><input type="checkbox" data-count="' + k + '"' + (ST.settings[k] ? ' checked' : '') + '><i></i></label></span></div>'; };
    var manual = Object.keys(ST.avail).length;
    return '<p class="help">Entries marked ✕ are left out of every total. These switches count a whole kind of ✕ entry at once; the ✕ button on any row overrides it for that entry.</p><div class="look-card">' +
      sw('countLimited', 'Count time-limited entries', 'Only obtainable from events, seasonal content or ended campaigns (they may return)') +
      sw('countGone', 'Count entries that are no longer obtainable', 'Legacy achievements, retired items and rows the checklist excludes') +
      sw('countUnknown', 'Count entries of unknown availability', 'Mostly FATEs not placed in any zone') + '</div>' +
      '<h4>Order</h4><div class="look-card">' + sw('gameOrder', 'Keep the game\'s order', 'Lists, folders and entries are sorted A to Z. Switch this on to see them in the order the game uses (story order for quests, level order for recipes and leves, release order for expansions)') + '</div>' +
      '<div class="row" style="margin-top:12px"><span class="help">' + manual + ' entr' + (manual === 1 ? 'y has' : 'ies have') + ' your own ✕ choice.</span>' + (manual ? '<button type="button" class="btn sm ghost" id="clear-avail">Clear my ✕ choices</button>' : '') + '</div>' +
      '<h4>Links between entries</h4><p class="help">Built from the game’s own data (' + (LX ? LX.count.toLocaleString() : 0) + ' links). They only ever add ticks: unticking something never unticks anything else, and nothing that does not apply to a character is ticked.</p><div class="look-card">' +
      sw('links', 'Tick what an entry proves', 'When you tick something, also tick what it proves: the earlier quests it needs, the achievement and title it earns, the aether current or reward a quest gives, earlier ranks and relic stages, master recipe books, and more') +
      sw('gold', 'Assume a gold rating for FATE achievements', 'Ticking a FATE that has its own achievement also ticks that achievement (the game awards it for the highest rating)') + '</div>' +
      '<div class="row" style="margin-top:12px"><button type="button" class="btn sm" id="fill-links"' + (LX ? '' : ' disabled') + '>Fill in what your current ticks prove</button></div>';
  }
  function fillLinksDialog() {
    var copy = JSON.parse(JSON.stringify(ST)), per = [];
    copy.chars.forEach(function (c) {
      var added = ET.fillLinks(LX, IDX, copy, c.id, { gold: ST.settings.gold !== false });
      var bySec = {};
      added.forEach(function (k) { var t = IDX.byKey.get(k).s.t; bySec[t] = (bySec[t] || 0) + 1; });
      per.push({ c: c, added: added, top: Object.keys(bySec).map(function (t) { return [t, bySec[t]]; }).sort(function (a, b) { return b[1] - a[1]; }) });
    });
    var total = per.reduce(function (a, p) { return a + p.added.length; }, 0);
    openDialog('<h3>Fill in what your ticks prove</h3><p class="help">' + (total ? total.toLocaleString() + ' entries would be ticked. You can undo this right after.' : 'Nothing to add: your ticks already include everything they prove.') + '</p><div class="report">' +
      per.filter(function (p) { return p.added.length; }).map(function (p) { return '<p class="help"><b>' + esc(p.c.name) + ': ' + p.added.length.toLocaleString() + '</b><br><small class="dim">' + p.top.slice(0, 6).map(function (x) { return esc(x[0]) + ' ' + x[1]; }).join(' · ') + '</small></p>'; }).join('') + '</div>' +
      '<div class="row" style="margin-top:14px">' + (total ? '<button type="button" class="btn" id="do-fill">Tick them</button>' : '') + '<button type="button" class="btn ghost" data-close>' + (total ? 'Cancel' : 'Close') + '</button></div>', function (d) {
      var b = $('#do-fill', d); if (!b) return;
      b.onclick = function () {
        var done = per.map(function (p) { return { c: p.c.id, added: ET.fillLinks(LX, IDX, ST, p.c.id, { gold: ST.settings.gold !== false }) }; });
        var all = []; done.forEach(function (x) { all = all.concat(x.added); });
        closeDialog(); save(); render();
        toastAction(all.length.toLocaleString() + ' entries ticked from links', 'Undo', function () {
          done.forEach(function (x) { x.added.forEach(function (k) { ET.setTick(ST, x.c, k, false); }); });
          save(); render(); toast('Undone');
        });
      };
    });
  }
  function bindCount(d) {
    $$('[data-count]', d).forEach(function (inp) { inp.onchange = function () { ST.settings[inp.dataset.count] = inp.checked; ST.updated = Date.now(); save(); render(); }; });
    var fl = $('#fill-links', d); if (fl) fl.onclick = fillLinksDialog;
    var cl = $('#clear-avail', d); if (cl) cl.onclick = function () { if (!confirm('Return every entry to its built-in mark?')) return; ST.avail = {}; ST.updated = Date.now(); save(); render(); openSettings('count'); };
  }
  // The one save (gate 1C): where the data lives, and, until the owner confirms, the way back to the save from before
  // the move (which stays on this device, unchanged, in any case).
  function sharedSaveHtml() {
    var mv = (ST.moved && ST.moved.tracker) || null;
    var h = '<h4>Your shared save</h4>';
    if (!mv) return h + '<p class="help">Your data is kept in the Command Center’s shared save on this device, which the Atelier and the coming modules also use.</p>';
    var when = mv.at ? new Date(mv.at).toLocaleDateString() : '';
    var copied = mv.from === 'indexeddb' || mv.from === 'localstorage';
    if (!copied) return h + '<p class="help">Your data is kept in the Command Center’s shared save on this device, which the Atelier and the coming modules also use.</p>';
    var c = mv.check || {};
    var checked = c.same ? ' The copy was checked: ' + (c.chars || 0) + ' characters and ' + (c.ticks || 0).toLocaleString() + ' ticks, with every mark, level, starting class, Grand Company and Lodestone number, match.' : '';
    if (mv.confirmed) return h + '<p class="help">On ' + esc(when) + ', your tracker data was copied into the Command Center’s shared save, which the Atelier and the coming modules also use. You confirmed it on ' + esc(new Date(mv.confirmed).toLocaleDateString()) + '. Your save from before the move is still kept on this device.</p>';
    return h + '<p class="help">' + (mv.wentBack ? 'On ' + esc(new Date(mv.wentBack).toLocaleDateString()) + ', you went back to your save from before the move.' : 'On ' + esc(when) + ', your tracker data was copied into the Command Center’s shared save, which the Atelier and the coming modules also use.') + checked + ' Your save from before the move is kept unchanged on this device.</p>' +
      '<div class="row"><button type="button" class="btn sm" id="move-ok">It looks right</button><button type="button" class="btn sm ghost" id="move-back">Go back to my save from before the move</button></div>';
  }
  function dataTab() {
    return sharedSaveHtml() + '<h4>Import from the FFXIV Completionist desktop app</h4><p class="help">Choose one or more character files saved by the desktop app (JSON). You then pick which column each file goes into. Ticks and its “X” marks (does not apply to that character) are imported; anything that cannot be placed exactly is listed so you can do it by hand.</p>' +
      '<div class="row"><input type="file" id="desk-files" accept=".json,application/json" multiple></div>' +
      '<h4>Backup file</h4><p class="help">Everything in one file: characters, ticks, “does not apply” marks and your ✕ choices, plus the Atelier’s crafter stats and saved macros.</p>' +
      '<div class="row"><button type="button" class="btn sm" id="save-backup">Save a backup file</button><label class="btn sm ghost">Load a backup file<input type="file" id="load-file" accept=".json,application/json" hidden></label></div>' +
      '<h4>Transfer code</h4><p class="help">A pasteable code with everything in it, to move to another device without files.</p>' +
      '<div class="row"><button type="button" class="btn sm" id="make-code">Make a transfer code</button></div><textarea class="inp code" id="code" rows="4" placeholder="Paste a transfer code here to load it"></textarea>' +
      '<div class="row"><button type="button" class="btn sm ghost" id="copy-code">Copy</button><button type="button" class="btn sm ghost" id="read-code">Load this code</button></div>' +
      '<h4>Start over</h4><div class="row"><button type="button" class="btn sm ghost" id="wipe">Erase everything on this device</button></div>';
  }
  function bindData(d) {
    var ok = $('#move-ok', d), back = $('#move-back', d);
    if (ok) ok.onclick = function () { ET.confirmMove(ST); ET.saveState(ST, true).then(function () { toast('Thank you. Your save from before the move stays kept on this device.'); openSettings('data'); }); };
    if (back) back.onclick = function () {
      ET.oldSaveDiff(ST).then(function (diff) {
        if (!diff) { toast('The save from before the move is no longer on this device.'); return; }
        if (!confirm('Go back to your save from before the move? ' + (diff.n ? diff.n.toLocaleString() + ' ticks, marks or levels differ from it, and those changes would be undone. ' : 'It matches what you have now. ') + 'A copy of your current data is kept on this device first. The Atelier’s stats and macros stay as they are.')) return;
        return ET.goBack().then(function () { location.reload(); });
      }).catch(function (err) { toast(err.message); });
    };
    $('#save-backup', d).onclick = function () { download('eveniunt-tracker-backup-' + new Date().toISOString().slice(0, 10) + '.json', ET.exportFile(ST)); markBackedUp(); toast('Backup saved'); };
    $('#load-file', d).onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var doc = null; try { doc = JSON.parse(txt); } catch (err) { /* handled below */ }
        if (doc && ET.isDesktopSave(doc)) { deskImport([{ name: f.name, doc: doc }]); return; }
        var st = ET.importFile(txt);
        if (!confirm('Replace everything on this device with this backup (' + st.chars.map(function (c) { return c.name; }).join(', ') + ')?')) return;
        adoptLoaded(st); toast('Backup loaded'); closeDialog();
      }).catch(function (err) { toast(err.message); });
    };
    $('#make-code', d).onclick = function () { ET.makeTransferCode(ST).then(function (code) { $('#code', d).value = code; markBackedUp(); toast('Transfer code ready (' + code.length.toLocaleString() + ' characters)'); }); };
    $('#copy-code', d).onclick = function () { var v = $('#code', d).value; if (v) copyText(v, 'Transfer code copied'); };
    $('#read-code', d).onclick = function () {
      ET.readTransferCode($('#code', d).value).then(function (st) {
        if (!confirm('Replace everything on this device with this code (' + st.chars.map(function (c) { return c.name; }).join(', ') + ')?')) return;
        adoptLoaded(st); toast('Transfer code loaded'); closeDialog();
      }).catch(function (err) { toast(err.message); });
    };
    $('#desk-files', d).onchange = function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      Promise.all(files.map(function (f) { return f.text().then(function (t) { return { name: f.name, doc: JSON.parse(t) }; }); })).then(deskImport).catch(function () { toast('One of those files is not a desktop-app save'); });
    };
    $('#wipe', d).onclick = function () { if (!confirm('Erase all characters and ticks on this device? Save a backup first if unsure. (Your save from before the move to the shared save, and the Atelier’s macros, stay kept.)')) return; ET.clearState().then(function () { location.reload(); }); };
  }
  // A loaded backup or transfer code replaces this device's data. The cloud-sync base is forgotten (the file id is
  // kept), so the next sync merges the two copies and asks about differences, instead of reading everything the
  // loaded copy lacks as deletions to send to the other devices.
  function adoptLoaded(st) {
    st.sync = { fc: {}, drive: ST.sync.drive ? { fileId: ST.sync.drive.fileId, at: ST.sync.drive.at, base: null } : null, backupAt: ST.sync.backupAt };
    // the other modules' sections: a section the file or code carries replaces this device's; one it does not carry
    // (an old backup or EVT1 code, or a module never used there) stays as it is here
    st.modules = Object.assign({}, ST.modules || {}, st.modules || {});
    st.moved = ST.moved;
    ST = st; ET.migrateAliases(IDX, ST); ET.saveState(ST, true); render();
  }
  function markBackedUp() { ST.sync.backupAt = Date.now(); ET.saveState(ST); }
  function deskImport(files) {
    files = files.filter(function (f) { return ET.isDesktopSave(f.doc); });
    if (!files.length) { toast('Those are not desktop-app saves'); return; }
    var guess = function (f, i) {
      var nm = norm(ET.nameFromDesktopFile(f.name));
      var hit = ST.chars.find(function (c) { return norm(c.name) === nm; });
      return hit ? hit.id : (ST.chars[i] || ST.chars[0]).id;
    };
    openDialog('<h3>Import desktop-app saves</h3><p class="help">Choose the column for each file. “Add” keeps ticks already in that column; “Replace” clears that column first.</p><div class="files">' + files.map(function (f, i) {
      return '<div class="f"><span><b>' + esc(ET.nameFromDesktopFile(f.name) || f.name) + '</b><br><small class="dim">' + esc(f.name) + '</small></span><select class="inp" data-file="' + i + '"><option value="">Skip</option>' + ST.chars.map(function (c) { return '<option value="' + c.id + '"' + (c.id === guess(f, i) ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</div><div class="row" style="margin-top:10px"><label class="check"><input type="checkbox" id="rename" checked> Rename the column to the file’s character name</label></div>' +
      '<div class="row" style="margin-top:6px"><span class="seg2" id="imode"><button type="button" class="on" data-im="add">Add</button><button type="button" data-im="replace">Replace</button></span></div>' +
      '<div class="row" style="margin-top:14px"><button type="button" class="btn" id="do-import">Import</button><button type="button" class="btn ghost" data-close>Cancel</button></div>', function (d) {
      var mode = 'add';
      $$('[data-im]', d).forEach(function (b) { b.onclick = function () { mode = b.dataset.im; $$('[data-im]', d).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      $('#do-import', d).onclick = function () {
        var results = [];
        $$('[data-file]', d).forEach(function (sel) {
          if (!sel.value) return;
          var f = files[+sel.dataset.file], r = ET.importDesktopSave(IDX, f.doc, MAP);
          ET.applyImport(ST, sel.value, r, mode);
          ET.migrateAliases(IDX, ST); // a starting class learned from the save puts first class quest ticks on its route
          r.linked = linksOn() ? ET.fillLinks(LX, IDX, ST, sel.value, { gold: ST.settings.gold !== false }).length : 0;
          if ($('#rename', d).checked && ET.nameFromDesktopFile(f.name)) ET.renameCharacter(ST, sel.value, ET.nameFromDesktopFile(f.name));
          results.push({ who: charName(sel.value), r: r });
        });
        ET.saveState(ST, true); save(); render(); importReport(results);
      };
    });
  }
  function importReport(results) {
    var rows = [];
    results.forEach(function (x) { x.r.missed.forEach(function (m) { rows.push([x.who, m.kind === 'level' ? 'Level ' + m.value : m.kind === 'exclusion' ? '“X” mark' : 'Tick', m.area, m.path + ' #' + m.id]); }); });
    // a cell starting with = + - @ would run as a formula in a spreadsheet: it gets a leading apostrophe (the values come from the save file)
    var csv = 'Character,Type,Area,Where in the desktop app\n' + rows.map(function (r) { return r.map(function (v) { v = String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    openDialog('<h3>Import finished</h3>' + results.map(function (x) {
      return '<p class="help"><b>' + esc(x.who) + ':</b> ' + x.r.placed.toLocaleString() + ' of ' + x.r.done.toLocaleString() + ' ticks imported (' + pctTxt(x.r.placed, x.r.done) + '), ' + Object.keys(x.r.excl).length + ' “does not apply” marks' + (x.r.linked ? ', ' + x.r.linked.toLocaleString() + ' more ticked by links (what those ticks prove)' : '') + '; ' + x.r.missed.filter(function (m) { return m.kind !== 'level'; }).length + ' to do by hand, ' + x.r.missed.filter(function (m) { return m.kind === 'level'; }).length + ' level values not imported.</p>';
    }).join('') + (rows.length ? '<div class="report"><table>' + rows.slice(0, 300).map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div><div class="row"><button type="button" class="btn sm" id="dl-report">Download the full list</button></div>' : '') +
      '<div class="row" style="margin-top:14px"><button type="button" class="btn" data-close>Done</button></div>', function (d) {
      var b = $('#dl-report', d); if (b) b.onclick = function () { download('tracker-import-not-merged.csv', csv, 'text/csv'); };
    });
  }

  // ── online refresh (FFXIV Collect) ──
  function onlineTab() {
    var withId = ST.chars.filter(function (c) { return c.lodestone; });
    return '<p class="help">Reads public character data from FFXIV Collect (a community site) for characters with a Lodestone number: mounts, minions, orchestrion rolls, emotes, hairstyles, barding, fashion accessories, facewear, Blue Magic, armoire, outfit glamours, Triple Triad cards and opponents, levequests and achievements (mounts, minions, emotes, facewear and achievements come from the Lodestone itself; the rest is what the player recorded on FFXIV Collect). It runs when the tracker opens with internet, and never changes anything you changed yourself without asking. Nothing is sent except the Lodestone number.</p>' +
      '<div class="report"><table>' + ST.chars.map(function (c) { var s = ST.sync.fc[c.id]; return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + (c.lodestone ? esc(c.lodestone) : '<span class="dim">no Lodestone number</span>') + '</td><td>' + (s ? 'Last refresh ' + esc(new Date(s.at).toLocaleString()) + (s.unavailable && Object.keys(s.unavailable).length ? '<br><small class="dim">Not available: ' + esc(Object.keys(s.unavailable).join(', ')) + '</small>' : '') : '<span class="dim">never</span>') + '</td></tr>'; }).join('') + '</table></div>' +
      '<div class="row"><button type="button" class="btn sm" id="fc-now"' + (withId.length ? '' : ' disabled') + '>Refresh now</button><button type="button" class="btn sm ghost" data-tab-go="chars">Add Lodestone numbers</button></div>';
  }
  function bindOnline(d) {
    var b = $('#fc-now', d); if (b) b.onclick = function () { closeDialog(); refreshOnline(true); };
    var g = $('[data-tab-go]', d); if (g) g.onclick = function () { openSettings('chars'); };
  }
  function setSyncState(t, detail, warn) {
    var el = $('#sync-state');
    if (!t) { el.innerHTML = ''; el.title = ''; return; }
    el.innerHTML = '<span class="ss-dot' + (warn ? ' warn' : '') + '"></span>' + esc(t);
    el.title = detail || t; el.classList.toggle('warn', !!warn);
  }
  function refreshOnline(manual) {
    var chars = ST.chars.filter(function (c) { return c.lodestone; });
    if (!chars.length) { if (manual) toast('Add a Lodestone number first'); return Promise.resolve(); }
    if (!navigator.onLine) { setSyncState('Offline: online refresh waits for a connection'); return Promise.resolve(); }
    setSyncState('Refreshing from FFXIV Collect…');
    var asks = [], applied = 0, problems = [];
    return chars.reduce(function (p, c) {
      return p.then(function () {
        return ET.fetchOwned(c.lodestone).then(function (owned) {
          if (owned.offline) { problems.push(c.name + ': no connection'); return; }
          if (owned.unavailable._character) { problems.push(c.name + ': ' + owned.unavailable._character); return; }
          var rec = ET.reconcileOwned(IDX, ST, c.id, owned);
          // a character with questions waits for the owner's answers: its automatic ticks are applied (and counted) then
          if (rec.ask.length) { asks.push({ c: c, owned: owned, rec: rec }); return; }
          ET.acceptRefresh(ST, c.id, owned, rec, {});
          applied += rec.auto.length + followLinks(c.id, rec.auto.map(function (a) { return a.key; })).length;
        });
      });
    }, Promise.resolve()).then(function () {
      save(); render();
      // a character that could not be refreshed is named: the status never reads as a full refresh when one failed
      var when = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (problems.length) setSyncState('Refreshed ' + when + ' · ' + problems.length + ' not refreshed', 'Not refreshed from FFXIV Collect:\n' + problems.join('\n') + '\n\nA character not found there needs a public FFXIV Collect profile with that Lodestone number.', true);
      else setSyncState('Refreshed ' + when + (applied ? ' · ' + applied + ' new' : ''));
      if (problems.length && manual) toast('Not refreshed: ' + problems.join(' · '));
      if (asks.length) whenDialogFree(function () { askOnline(asks); });
      else if (manual && !problems.length) toast(applied ? applied + ' new entries ticked from FFXIV Collect' : 'Everything already matches FFXIV Collect');
    }).catch(function (err) { save(); setSyncState('Online refresh failed: ' + ((err && err.message) || err)); });
  }
  function askOnline(asks) {
    var items = [];
    asks.forEach(function (a) { a.rec.ask.forEach(function (q) { items.push({ id: a.c.id + '|' + q.key, who: a.c.name, what: q.name + ' (' + q.section + ')', local: q.local ? 'ticked' : 'not ticked', remote: q.online ? 'owned' : 'not owned' }); }); });
    conflictDialog('Online and this device disagree', 'FFXIV Collect and this device disagree on these entries. Choose which one is right.', 'FFXIV Collect', items, function (choices) {
      // taking FFXIV Collect's side on an entry ticked here removes that tick: confirmed when many, and undoable
      var removed = [];
      asks.forEach(function (a) { a.rec.ask.forEach(function (q) { if (choices[a.c.id + '|' + q.key] === 'remote' && q.local && !q.online) removed.push([a.c.id, q.key]); }); });
      if (removed.length > 10 && !confirm('This removes ' + removed.length + ' ticks made on this device because FFXIV Collect does not list them. Remove them?')) { toast('Nothing changed'); return; }
      asks.forEach(function (a) {
        var ch = {};
        a.rec.ask.forEach(function (q) { ch[q.key] = choices[a.c.id + '|' + q.key] === 'remote' ? 'online' : 'local'; });
        ET.acceptRefresh(ST, a.c.id, a.owned, a.rec, ch);
        followLinks(a.c.id, a.rec.auto.map(function (x) { return x.key; }).concat(a.rec.ask.filter(function (q) { return ch[q.key] === 'online' && q.online; }).map(function (q) { return q.key; })));
      });
      save(); render();
      if (removed.length) toastAction(removed.length + ' ticks removed to match FFXIV Collect', 'Undo', function () { removed.forEach(function (r) { ET.setTick(ST, r[0], r[1], true); }); save(); render(); toast('Undone'); });
      else toast('Saved');
    });
  }
  function conflictDialog(title, help, otherLabel, items, done, onCancel) {
    var choice = {}, applied = false;
    if (onCancel) dlg.addEventListener('close', function once() { dlg.removeEventListener('close', once); if (!applied) onCancel(); });
    items.forEach(function (it) { choice[it.id] = 'local'; });
    var draw = function () {
      openDialog('<h3>' + esc(title) + '</h3><p class="help">' + esc(help) + '</p><div class="row"><button type="button" class="btn sm" data-all="remote">' + esc(otherLabel) + ' is right for all</button><button type="button" class="btn sm" data-all="local">This device is right for all</button></div><div class="report" style="max-height:50vh">' +
        items.map(function (it) {
          return '<div class="conf"><span class="w">' + (it.who ? esc(it.who) + ': ' : '') + esc(it.what) + '<small>' + esc(otherLabel) + ': ' + esc(it.remote) + ' · This device: ' + esc(it.local) + '</small></span><span class="seg2"><button type="button" data-pick="' + esc(it.id) + '" data-v="remote" class="' + (choice[it.id] === 'remote' ? 'on' : '') + '">' + esc(otherLabel) + '</button><button type="button" data-pick="' + esc(it.id) + '" data-v="local" class="' + (choice[it.id] === 'local' ? 'on' : '') + '">This device</button></span></div>';
        }).join('') + '</div><div class="row" style="margin-top:14px"><button type="button" class="btn" id="apply">Apply</button></div>', function (d) {
        $$('[data-all]', d).forEach(function (b) { b.onclick = function () { items.forEach(function (it) { choice[it.id] = b.dataset.all; }); draw(); }; });
        $$('[data-pick]', d).forEach(function (b) { b.onclick = function () { choice[b.dataset.pick] = b.dataset.v; $$('[data-pick="' + CSS.escape(b.dataset.pick) + '"]', d).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
        $('#apply', d).onclick = function () { applied = true; closeDialog(); done(choice); };
      });
    };
    draw();
  }

  // ── cloud sync (Google Drive app-data folder) ──
  var DRIVE = { token: null, at: 0, busy: false, asking: false, timer: null };
  function cloudTab() {
    var s = ST.sync.drive;
    var ok = HOSTED && location.origin === 'https://splitzhappen.github.io';
    return '<p class="help">Keeps a private copy in your own Google Drive (a hidden app folder only this tracker can see) and merges changes from your other devices. A change made on two devices to the same entry asks you which is right. Free; nothing goes anywhere else.</p>' +
      (ok ? '' : '<p class="help"><b>Cloud sync works in the installed app at splitzhappen.github.io/Eveniunt-Command-Center/tracker/.</b> In this copy, use backup files or a transfer code.</p>') +
      '<p class="help">' + (s ? 'Last sync: ' + esc(new Date(s.at).toLocaleString()) : 'Not synced yet.') + (DRIVE.token ? ' Signed in: changes sync automatically while this page stays open.' : s ? ' <b>Not signed in on this device right now: nothing is syncing until you sign in below.</b> Sign-in lasts about an hour and is needed again each time the tracker is opened.' : '') + '</p>' +
      '<div class="row"><button type="button" class="btn sm" id="sync-now"' + (ok ? '' : ' disabled') + '>' + (DRIVE.token ? 'Sync now' : 'Sign in with Google and sync') + '</button></div>';
  }
  function bindCloud(d) { var b = $('#sync-now', d); if (b) b.onclick = function () { closeDialog(); syncDrive(true); }; }
  function syncDrive(interactive, retried) {
    if (DRIVE.busy || DRIVE.asking) return Promise.resolve();
    var fresh = DRIVE.token && Date.now() - DRIVE.at < 50 * 60 * 1000;
    var get = fresh ? Promise.resolve(DRIVE.token) : interactive ? ET.driveSignIn(ET.GDRIVE_CLIENT_ID).then(function (t) { DRIVE.token = t; DRIVE.at = Date.now(); return t; }) : Promise.reject(new Error('not signed in'));
    var synced = function (msg) { ET.migrateAliases(IDX, ST); ST.sync.backupAt = Date.now(); ET.saveState(ST, true); render(); setSyncState('Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); if (msg) toast(msg); };
    var failed = function (err, tok) {
      ET.saveState(ST); // a finished step may already have combined copies here: keep it
      if (err && err.code === 401) DRIVE.token = null;
      if (err && err.code === 'changed' && !retried) { DRIVE.busy = false; return syncDrive(interactive, true); }
      if (err && err.code === 'damaged' && interactive && tok && confirm(err.message + ' Replace the cloud copy with this device’s data?')) {
        return ET.driveOverwrite(ST, tok, err.fileId).then(function () { synced('Cloud copy replaced with this device’s data'); });
      }
      if (interactive || (err && err.message !== 'not signed in')) setSyncState('Cloud sync: ' + (err.message || err));
      else if (ST.sync.drive) setSyncState('Cloud sync paused: sign in again (Settings → Cloud sync)'); // the hour-long sign-in ran out
    };
    DRIVE.busy = true; setSyncState('Syncing with Google Drive…');
    var tokNow = null;
    return get.then(function (tok) {
      tokNow = tok;
      return ET.driveSync(ST, tok).then(function (r) {
        if (r.done) { synced(interactive ? (r.created ? 'Cloud copy created' : 'Synced') : ''); return; }
        var finish = function (choices) {
          DRIVE.asking = false; DRIVE.busy = true;
          return ET.driveFinish(ST, tok, r, choices).then(function () { synced('Synced'); }).catch(function (err) { return failed(err, tok); }).then(function () { DRIVE.busy = false; });
        };
        // A large removal coming from the other device is confirmed first (it could be a mistake made there).
        // A removal coming from the other device is confirmed first (it could be a mistake made there); once declined,
        // the same cloud copy is not asked about again by the automatic syncs (only "Sync now" asks again)
        if (r.loss && !interactive && DRIVE.declined === r.modifiedTime) { setSyncState('Cloud sync paused: the other device’s removals wait for you (Settings → Cloud sync → Sync now)'); return; }
        if (r.loss && !confirm('The other device’s copy would remove ' + r.loss.toLocaleString() + ' tick' + (r.loss === 1 ? '' : 's') + ' from this device (removed there since the last sync). Apply that? Choose Cancel to keep this device unchanged and not sync now.')) {
          DRIVE.declined = r.modifiedTime; setSyncState('Cloud sync paused: nothing was changed'); return;
        }
        if (!r.conflicts.length) { DRIVE.busy = false; return finish({}); }
        var items = r.conflicts.map(function (c) { var x = ET.describeConflict(c, IDX, ST); return { id: c.id, who: x.who, what: x.what, local: x.local, remote: x.remote }; });
        DRIVE.asking = true;
        whenDialogFree(function () { conflictDialog('Your devices disagree', 'These entries were changed differently on another device. Choose which one is right.', 'Other device', items, finish, function () { DRIVE.asking = false; setSyncState('Cloud sync waiting for your choices'); }); });
      });
    }).catch(function (err) { return failed(err, tokNow); }).then(function () { DRIVE.busy = false; });
  }
  function queueDriveSync() {
    if (!DRIVE.token) { if (ST.sync.drive && !$('#sync-state').textContent) setSyncState('Cloud sync is off until you sign in (Settings → Cloud sync)'); return; }
    clearTimeout(DRIVE.timer); DRIVE.timer = setTimeout(function () { syncDrive(false); }, 15000);
  }
  document.addEventListener('visibilitychange', function () {
    if (!ST) return;
    if (document.visibilityState === 'hidden') { if (ET.hasPendingSave()) ET.saveState(ST, true); if (DRIVE.token) syncDrive(false); }
    else checkOtherTab();
  });
  // Closing the tab or switching apps on a phone right after a tick: write it now rather than after the short delay.
  window.addEventListener('pagehide', function () { if (ST && ET.hasPendingSave()) ET.saveState(ST, true); });

  // ── another tab or window of the tracker saved: take its newer copy (unless this tab has a change still waiting) ──
  function checkOtherTab() {
    if (!ST || ET.hasPendingSave()) return;
    ET.loadState(true).then(function (st) {
      if (st && st.updated > ST.updated && !ET.hasPendingSave()) { ET.acceptLoaded(); ST = st; ET.migrateAliases(IDX, ST); render(); toast('Updated with changes made in another window'); }
    });
  }
  ET.onOtherTabSave = function () { checkOtherTab(); };
  // this window saved while another had saved first: the save combined both, and this window takes in the other's
  // changes (anything changed here since that save is kept)
  ET.onSaveMerged = function (merged, snap) {
    if (!ST) return;
    ST = ET.applyMerge(ST, ET.threeWay(ET.portable(snap), ET.portable(ST), ET.portable(merged)), {});
    ET.migrateAliases(IDX, ST); render(); toast('Combined with changes made in another window');
  };

  // ── saving problems are shown, never silent ──
  var saveWarned = false;
  ET.onSaveResult = function (ok) {
    if (ok) { if (saveWarned) { saveWarned = false; setSyncState(''); } return; }
    if (!saveWarned) { saveWarned = true; toast('This browser did not let the tracker save. Save a backup file now (Settings → Import and backup).'); }
    setSyncState('Not saved on this device: save a backup file');
  };

  function aboutTab() {
    var m = DATA.meta || {}, src = m.sources || {};
    var n = DATA.sections.reduce(function (a, s) { return a + s.g.reduce(function (b, g) { return b + g.e.length; }, 0); }, 0);
    return '<p class="help"><b>Eveniunt Tracker</b>, part of the Eveniunt Network Command Center. ' + n.toLocaleString() + ' entries in ' + DATA.sections.length + ' lists. Works offline; your data stays on this device unless you use a backup, a transfer code, the online refresh or cloud sync.</p>' +
      '<h4>Sources and credits</h4><ul class="help">' + Object.keys(src).map(function (k) { return '<li>' + esc(src[k]) + '</li>'; }).join('') + '</ul>' +
      '<p class="help">' + esc(m.copyright || '') + ' FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. This is a fan-made tool, not affiliated with or endorsed by Square Enix. It never reads game memory or automates the game.</p>' +
      '<p class="help">Storage on this device: ' + esc(ET.storageKind) + '.</p>';
  }

  // ── boot ──
  function afterBoot() {
    var b = $('#boot'); if (b) b.remove();
    render(); route();
    if (navigator.onLine) setTimeout(function () { refreshOnline(false); }, 1500);
    ET.requestPersistence();
    backupReminder();
    // a device that synced before is not syncing now: sign-in is per visit, so say so instead of looking synced
    if (ST.sync.drive && !DRIVE.token && !$('#sync-state').textContent) setSyncState('Cloud sync is off until you sign in (Settings → Cloud sync)');
  }
  // Browsers can clear a website's saved data (Safari after weeks without a visit, any browser when storage runs
  // low), so a gentle reminder appears when there are ticks and no backup, transfer code or cloud sync for 30 days.
  function backupReminder() {
    var ticks = ST.chars.reduce(function (a, c) { return a + Object.keys(ST.ticks[c.id]).length; }, 0);
    var at = ST.sync.backupAt || 0;
    if (ticks > 20 && Date.now() - at > 30 * 24 * 3600 * 1000) setSyncState(at ? 'No backup for over a month: Settings → Import and backup, or Cloud sync' : 'Tip: save a backup or turn on cloud sync (Settings) so your ticks are safe if this browser clears its data');
  }
  // Saved data that could not be read is offered for download before anything new is saved over it.
  function loadProblemDialog() {
    var p = ET.loadProblem;
    openDialog('<h3>Saved data could not be read</h3><p class="help">The tracker found saved data on this device but could not read it (' + esc(p.message) + '). A copy has been kept. Download it first so nothing is lost, then load a backup, use cloud sync, or start fresh.</p>' +
      '<div class="row"><button type="button" class="btn" id="dl-bad">Download the unreadable data</button><button type="button" class="btn ghost" id="go-on">Continue</button></div>', function (d) {
      $('#dl-bad', d).onclick = function () { download('eveniunt-tracker-unreadable-' + new Date().toISOString().slice(0, 10) + '.json', p.raw); };
      $('#go-on', d).onclick = function () { setupDialog(); };
    });
  }
  applyTheme();
  function moveProblemDialog() {
    openDialog('<h3>Your save could not be moved safely</h3><p class="help">This version keeps your data in the Command Center’s shared save. Copying your save there did not match exactly (' + esc(ET.moveProblem.what) + '), so nothing more is saved on this device for now. Your save from before the move is unchanged. Save a backup file now, then reload the page; if this message comes back, send the backup to the site owner.</p>' +
      '<div class="row"><button type="button" class="btn" id="mp-backup">Save a backup file</button><button type="button" class="btn ghost" id="mp-close">Continue</button></div>', function (d) {
      $('#mp-backup', d).onclick = function () { download('eveniunt-tracker-backup-' + new Date().toISOString().slice(0, 10) + '.json', ET.exportFile(ST)); };
      $('#mp-close', d).onclick = function () { closeDialog(); };
    });
  }
  ET.loadState().then(function (st) {
    if (st) {
      ST = st; if (ET.migrateAliases(IDX, ST)) save(); afterBoot();
      if (ET.moveProblem) moveProblemDialog();
      else if (ET.justMoved) toast('Your data now lives in the Command Center’s shared save. Your old save is kept (Settings → Import and backup).');
    }
    else { var b = $('#boot'); if (b) b.remove(); if (ET.loadProblem) loadProblemDialog(); else setupDialog(); }
  });
  window.addEventListener('online', function () { if (ST) refreshOnline(false); });

  // The one-time hand-over notice (gate 1D, blueprint rule 5), for a Tracker installed or bookmarked on its own: shown on
  // the hosted page when it was not opened from the shell, until the owner has seen it ("Got it") or the Command Center is
  // installed on this device. One record for both apps, on this device only: eveniunt-command-center-device.
  var CC_DEVICE = 'eveniunt-command-center-device'; // declared before pwa() below runs, which reads it at start-up
  function ccDevice() { try { return JSON.parse(localStorage.getItem(CC_DEVICE) || '{}') || {}; } catch (e) { return {}; } }
  function handover(home, name) {
    var d = ccDevice(), ref = document.referrer || '';
    var fromShell = ref.indexOf(home) === 0 && ref.slice(home.length).indexOf('/') < 0;
    if (d.installed || d.handoverSeen || fromShell) return;
    // on an iPhone or iPad every app installed on the home screen keeps its own copy of the browser's storage
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var el = document.createElement('aside'); el.className = 'handover'; el.setAttribute('role', 'note'); el.setAttribute('data-handover', '1');
    el.innerHTML = '<p><b>The ' + esc(name) + ' is now part of the Eveniunt Command Center:</b> one installable app for the Tracker, the Atelier and the modules to come. ' +
      'It reads the same save as this page, so nothing needs to move, and this icon keeps working.' +
      (ios ? ' On this device, each installed app keeps its own copy of the save: before you remove an icon, move your data with a transfer code, a backup or cloud sync.' : '') +
      '</p><p class="handover-acts"><a class="btn sm" href="' + esc(home) + '">Open the Command Center</a><button type="button" class="btn sm ghost" data-handover-ok="1">Got it</button></p>';
    el.querySelector('[data-handover-ok]').addEventListener('click', function () {
      el.remove();
      try { var n = ccDevice(); n.handoverSeen = Date.now(); localStorage.setItem(CC_DEVICE, JSON.stringify(n)); } catch (e) { /* private window: shown again next time */ }
    });
    var mast = document.querySelector('.mast'); if (mast) mast.insertAdjacentElement('afterend', el);
  }
  // ── installable app (hosted only) ──
  (function pwa() {
    if (!HOSTED || !('serviceWorker' in navigator)) return;
    var link = document.createElement('link'); link.rel = 'manifest'; link.href = 'manifest.webmanifest'; document.head.appendChild(link);
    var tc = document.createElement('meta'); tc.name = 'theme-color'; tc.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#0f2234'; document.head.appendChild(tc);
    navigator.serviceWorker.register('sw.js').catch(function () { /* the page still works */ });
    var deferred = null, btn = document.createElement('button');
    btn.className = 'btn sm install-btn hidden'; btn.textContent = '⤓ Install app'; btn.setAttribute('data-install', '1');
    var tools = document.querySelector('.mast-tools'); if (tools) tools.insertBefore(btn, tools.firstChild);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; btn.classList.remove('hidden'); });
    window.addEventListener('appinstalled', function () { btn.classList.add('hidden'); toast('Eveniunt Tracker installed'); });
    btn.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { deferred = null; btn.classList.add('hidden'); }); });
    // The way back to the Command Center (gate 1D): the shell lives at the site root, one level up. A plain link, first
    // among the header tools; on narrow screens only the house sign shows.
    var home = new URL('../', location.href).href;
    var back = document.createElement('a'); back.className = 'btn sm ghost cc-back'; back.href = home; back.setAttribute('data-cc-back', '1'); back.setAttribute('aria-label', 'Eveniunt Command Center: home');
    back.innerHTML = '<span aria-hidden="true">\u2302</span><span class="cc-txt">Command Center</span>';
    if (tools) tools.insertBefore(back, tools.firstChild);
    handover(home, 'Tracker');
  })();
/*{{LIVE}}*/
  window.__tracker = { openAll: function () { SEC.get(UI.sec).groups.forEach(function (g, gi) { OPENG.add(UI.sec + '#' + gi); }); renderLedger(); }, get ST() { return ST; }, get UI() { return UI; }, IDX: IDX, MENUS: MENUS, setView: setView, render: render, S: S };
})();
