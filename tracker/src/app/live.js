  // ── Live pages: Up Now, Big Fish, Ocean Fishing, Timers & Events, Field Monsters, Gold Saucer, Notifications ──
  // Everything here is worked out in the page from data/live.json and data/conditions.json (no connection needed),
  // except the optional fresh copy of the events list on the hosted site.
  var LIVE = (function () { try { return JSON.parse(document.getElementById('live-data').textContent); } catch (err) { return null; } })() ||
    { bigfish: [], ocean: null, field: { zones: {}, challenge: [], events: {}, weatherZone: {} }, timers: { timers: [] }, guides: {}, gate: [] };
  var LIVE_VIEWS = [['now', 'Up Now'], ['dailies', 'Dailies & Weeklies'], ['bigfish', 'Big Fish'], ['srank', 'S Ranks'], ['ocean', 'Ocean Fishing'], ['island', 'Island Sanctuary'], ['timers', 'Timers & Events'], ['weather', 'Weather'],
    ['hunts', 'Hunts'], ['field', 'Field Monsters'], ['market', 'Market Board'], ['housing', 'Housing'], ['news', 'News'], ['gold', 'Gold Saucer'], ['pvp', 'PvP Series'], ['leveling', 'Leveling Guides'], ['notify', 'Notifications']];
  var NOTIFY_DEFAULT = {
    on: false, browser: true, sound: true, toast: true, lead: 5,
    bigfish: 'missing', bigfishLead: 10, legendaryOnly: false,
    vistas: false, nodes: 'watched', fish: 'watched',
    ocean: 'missing', oceanLead: 10,
    daily: true, weekly: true, gc: false, fashion: false,
    gate: false, gates: {}, gateLead: 2,
    events: true, fieldNm: false, srank: false, isle: false, jumbo: false,
    hunt: 'off', huntLead: 10, huntMaint: true, news: 'maint'
  };
  UI.live = Object.assign({ char: null, hide: false, ex: '', legendary: false, soon: false, bfHide: false, zone: 'Eureka Anemos', el: '', weak: '', spawnNow: false, watch: [] }, UI.live || {});
  UI.live.notify = Object.assign({}, NOTIFY_DEFAULT, UI.live.notify || {});
  function liveChar() { var c = ST.chars.find(function (x) { return x.id === UI.live.char; }) || ST.chars[0]; return c ? c.id : null; }
  function charSelect() {
    return '<label class="lv-sel">Character <select data-live="char">' + ST.chars.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === liveChar() ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>';
  }
  function has(k) { var c = liveChar(); return !!(k && c && ST.ticks[c] && ST.ticks[c][k]); }
  function nameOf(k) { var h = IDX.byKey.get(k); return h ? h.e.n : k; }
  function liveSave() { persist(); }
  function liveHead(title, note, extra) { return '<div class="p-head"><span class="ttl"><span class="kick">Live · Eorzea time <b data-et>' + etText(Date.now()) + '</b> · your time <b data-lt>' + lt(Date.now()) + '</b></span><h2>' + esc(title) + '</h2>' + (note ? '<p class="note">' + note + '</p>' : '') + '</span>' + (extra || '') + '</div>'; }
  function rowName(k, label) { return '<span class="er lv-er" data-k="' + esc(k) + '"><span class="c0"><span class="nm">' + esc(label || nameOf(k)) + '</span></span></span>'; }
  function cdown(ms) { return '<span class="cd" data-at="' + ms + '">' + dur(ms - Date.now()) + '</span>'; }
  function star(k) { var on = UI.live.watch.indexOf(k) >= 0; return '<button type="button" class="lv-star' + (on ? ' on' : '') + '" data-watch="' + esc(k) + '" title="' + (on ? 'Watched: you get notifications for it' : 'Watch: get a notification when it is up') + '">' + (on ? '★' : '☆') + '</button>'; }

  // ---- windows: when can a condition [zone, from hour, to hour, weathers, previous weathers] be met?
  function okW(c, p) { return (!c[3].length || c[3].indexOf(weatherAt(c[0], p)) >= 0) && (!c[4].length || c[4].indexOf(weatherAt(c[0], p - PERIOD)) >= 0); }
  var QUARTER = 43750; // 15 Eorzea minutes in real milliseconds
  function windowsOf(c, from, count) {
    var out = [], p0 = periodStart(from);
    if (!c) return out;
    if (c[1] === 0 && c[2] === 24 && !c[3].length && !c[4].length) return [{ s: from, e: Infinity, always: true }];
    for (var n = 0; n < 2400 && out.length < count; n++) {
      var p = p0 + n * PERIOD; if (!okW(c, p)) continue;
      var hi = p + PERIOD, start = null, t = n === 0 ? from : p;
      for (; t < hi; t += QUARTER) {
        var ok = inHours(etHours(t), c[1], c[2]);
        if (ok && start === null) start = t;
        if (!ok && start !== null) { out.push({ s: start, e: t }); start = null; if (out.length >= count) break; }
      }
      if (start !== null && out.length < count) {
        var e2 = hi; while (e2 < hi + 6 * PERIOD && okW(c, periodStart(e2)) && inHours(etHours(e2), c[1], c[2])) e2 += QUARTER;
        out.push({ s: start, e: e2 }); n = Math.floor((e2 - p0) / PERIOD) - 1;
      }
    }
    if (out.length && out[0].s <= from) { // open now: find where this window began, for the progress bar
      var b = out[0].s; while (b > from - 6 * PERIOD && okW(c, periodStart(b - QUARTER)) && inHours(etHours(b - QUARTER), c[1], c[2])) b -= QUARTER;
      out[0].b = b;
    }
    return out;
  }
  var WCACHE = {}, WCACHE_AT = 0;
  function cachedWindows(id, c, count) {
    var now = Date.now();
    if (now - WCACHE_AT > 60000) { WCACHE = {}; WCACHE_AT = now; }
    var hit = WCACHE[id];
    if (hit && (hit.length < 1 || hit[0].e > now)) return hit.filter(function (w) { return w.e > now; });
    return (WCACHE[id] = windowsOf(c, now - 2000, count || 3)); // a little early, so a window open now counts as open on the page that asked
  }
  function bfCond(f) { return f.z && (f.a != null) ? [f.z, f.a, f.b, f.w || [], f.pw || []] : null; }
  function condLabel(c) {
    if (!c) return 'No window data';
    var bits = [];
    if (!(c[1] === 0 && c[2] === 24)) bits.push(etText(realFromEt(c[1])) + '–' + etText(realFromEt(c[2] % 24)) + ' ET');
    if (c[4].length) bits.push(c[4].map(wName).join(' or ') + ' → ' + (c[3].length ? c[3].map(wName).join(' or ') : 'any weather'));
    else if (c[3].length) bits.push(c[3].map(wName).join(' or '));
    return bits.length ? bits.join(' · ') : 'Any time, any weather';
  }

  // ---- Up Now
  function upNowItems() {
    var now = Date.now(), items = [];
    var bigKeys = {}; LIVE.bigfish.forEach(function (f) { if (f.k) bigKeys[f.k] = f; });
    Object.keys(COND.cond).forEach(function (k) {
      var c = COND.cond[k], w = cachedWindows(k, c, 1)[0]; if (!w) return;
      var type = k.indexOf('sightseeing:') === 0 ? 'Vistas' : k.indexOf('spearfishing:') === 0 ? 'Spearfishing' : 'Fish';
      items.push({ k: k, type: type, w: w, c: c, big: bigKeys[k] });
    });
    Object.keys(COND.nodes).forEach(function (k) {
      var nd = COND.nodes[k], h = etHours(now), best = null;
      nd[0].forEach(function (s) {
        var start = (s - h + 24) % 24, end = (s + nd[1] / 60 - h + 24) % 24, open = inHours(h, s, (s + nd[1] / 60) % 24);
        var w = open ? { s: now - realFromEt((h - s + 24) % 24), e: now + realFromEt(end || 24) } : { s: now + realFromEt(start), e: now + realFromEt(start + nd[1] / 60) };
        if (!best || w.s < best.s) best = w;
      });
      if (best) items.push({ k: k, type: 'Gathering', w: best, node: nd });
    });
    LIVE.bigfish.forEach(function (f) { // big fish outside the fishing log's conditions (newest fish, from the wiki)
      if (f.k && COND.cond[f.k]) return; var c = bfCond(f); if (!c) return; var w = cachedWindows('bf:' + f.n, c, 1)[0]; if (w) items.push({ k: f.k, label: f.n, type: 'Fish', w: w, c: c, big: f });
    });
    return items;
  }
  function renderNow() {
    var now = Date.now(), items = upNowItems(), hide = UI.live.hide;
    var open = items.filter(function (x) { return x.w.s <= now && (!hide || !has(x.k)); }).sort(function (a, b) { return a.w.e - b.w.e; });
    var soon = items.filter(function (x) { return x.w.s > now && x.w.s - now < 3600000 && (!hide || !has(x.k)); }).sort(function (a, b) { return a.w.s - b.w.s; });
    function block(list, title, isOpen) {
      var groups = {}; list.forEach(function (x) { (groups[x.type] = groups[x.type] || []).push(x); });
      var order = ['Fish', 'Spearfishing', 'Gathering', 'Vistas'];
      return '<h3 class="lv-h">' + title + ' <span class="dim">(' + list.length + ')</span></h3>' + (list.length ? order.filter(function (t) { return groups[t]; }).map(function (t) {
        return '<div class="lv-group"><h4>' + t + '</h4>' + groups[t].map(function (x) {
          var got = has(x.k), zone = x.c ? x.c[0] : '';
          return '<div class="lv-row' + (got ? ' got' : '') + '">' + rowName(x.k, x.label) + (x.big ? '<span class="lv-badge' + (x.big.kind === 'legendary' ? ' leg' : '') + '">' + (x.big.kind === 'legendary' ? 'Legendary' : 'Big fish') + '</span>' : '') +
            '<span class="lv-zone">' + esc(zone || (x.node ? 'up at ' + x.node[0].map(function (s) { return ('0' + s).slice(-2) + ':00'; }).join(', ') + ' ET' : '')) + '</span>' +
            '<span class="lv-when">' + (isOpen ? 'ends in ' + cdown(x.w.e) : 'opens in ' + cdown(x.w.s) + ' <span class="dim">(' + lt(x.w.s) + ')</span>') + '</span>' +
            '<span class="lv-got">' + (got ? '✓ have it' : '') + '</span>' + (x.k ? star(x.k) : '') + '</div>';
        }).join('') + '</div>';
      }).join('') : '<p class="dim">Nothing right now.</p>');
    }
    var tools = '<div class="lv-tools">' + charSelect() + '<label class="lv-chk"><input type="checkbox" data-live="hide"' + (hide ? ' checked' : '') + '> Hide what this character already has</label></div>';
    $('#page').innerHTML = liveHead('Up Now', 'Everything with a time or weather window that is open right now, and what opens within the hour: fish and spearfishing (including big fish), timed gathering nodes and vistas. Hover a name for how to get it. Ticks come from the chosen character.', '') + tools +
      block(open, 'Open now', true) + block(soon, 'Opening within the hour', false);
  }

  // ---- Big Fish (a board in the manner of spawn trackers: what is up, how far into its window, what is next)
  function renderBigFish() {
    var now = Date.now(), L = UI.live, exps = [];
    LIVE.bigfish.forEach(function (f) { if (exps.indexOf(f.ex) < 0) exps.push(f.ex); });
    var rows = LIVE.bigfish.map(function (f) {
      var c = (f.k && COND.cond[f.k]) || bfCond(f), ws = c ? cachedWindows('bf:' + f.n, c, 3) : [];
      return { f: f, c: c, ws: ws, open: ws.length && ws[0].s <= now, got: has(f.k) };
    }).filter(function (r) {
      return (!L.ex || r.f.ex === L.ex) && (!L.legendary || r.f.kind === 'legendary') && (!L.bfHide || !r.got) && (!L.soon || (r.ws[0] && r.ws[0].s - now < 3600000));
    });
    rows.sort(function (a, b) {
      if (a.open !== b.open) return a.open ? -1 : 1;
      var x = a.ws[0] ? (a.open ? a.ws[0].e : a.ws[0].s) : Infinity, y = b.ws[0] ? (b.open ? b.ws[0].e : b.ws[0].s) : Infinity;
      return x - y;
    });
    var total = LIVE.bigfish.length, caught = LIVE.bigfish.filter(function (f) { return has(f.k); }).length;
    var tools = '<div class="lv-tools">' + charSelect() +
      '<label class="lv-sel">Expansion <select data-live="ex"><option value="">All</option>' + exps.map(function (x) { return '<option' + (x === L.ex ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>' +
      '<label class="lv-chk"><input type="checkbox" data-live="legendary"' + (L.legendary ? ' checked' : '') + '> Legendary only</label>' +
      '<label class="lv-chk"><input type="checkbox" data-live="bfHide"' + (L.bfHide ? ' checked' : '') + '> Hide caught</label>' +
      '<label class="lv-chk"><input type="checkbox" data-live="soon"' + (L.soon ? ' checked' : '') + '> Up within the hour</label>' +
      '<span class="lv-count">' + caught + ' / ' + total + ' caught</span></div>';
    var list = rows.map(function (r) {
      var f = r.f, w = r.ws[0], status, bar = '';
      if (!r.c) status = '<span class="dim">No window data yet</span>';
      else if (w && w.always) status = '<b class="up">Always up</b>';
      else if (r.open) {
        var pct = w.b ? Math.min(100, Math.max(0, Math.round((now - w.b) / (w.e - w.b) * 100))) : 0;
        status = '<b class="up">UP</b> · ends in ' + cdown(w.e);
        bar = '<span class="lv-bar"><i style="width:' + pct + '%"></i></span>';
      } else if (w) status = 'in ' + cdown(w.s) + ' <span class="dim">· ' + lt(w.s) + '</span>';
      else status = '<span class="dim">No window in the next month</span>';
      var next = r.ws.slice(r.open ? 1 : 1, 3).map(function (x) { return lt(x.s) + ' (' + dur(x.e - x.s) + ')'; }).join(' · ');
      var how = [];
      if (f.bait) how.push('Bait: ' + f.bait.join(' → '));
      if (f.tug || f.hook) how.push([f.tug ? f.tug + ' bite' : '', f.hook ? f.hook + ' Hookset' : ''].filter(Boolean).join(', '));
      if (f.pred) how.push('Intuition: catch ' + f.pred.map(function (p) { return p[1] + '× ' + p[0]; }).join(', ') + ' first');
      if (f.req) how.push(f.req);
      if (f.lure) how.push(f.lure);
      if (f.eyes) how.push('Fish Eyes works');
      if (f.folk) how.push('Needs ' + f.folk);
      return '<div class="bf-row' + (r.open ? ' open' : '') + (r.got ? ' got' : '') + '">' +
        '<div class="bf-name">' + (f.k ? rowName(f.k, f.n) : '<span class="nm">' + esc(f.n) + '</span>') + '<span class="lv-badge' + (f.kind === 'legendary' ? ' leg' : '') + '">' + (f.kind === 'legendary' ? 'Legendary' : 'Big fish') + '</span> <span class="dim">' + esc(f.ex) + '</span></div>' +
        '<div class="bf-where">' + esc([f.spot, f.z].filter(function (x, n, a) { return x && a.indexOf(x) === n; }).join(', ')) + (f.xy ? ' <span class="dim">(' + f.xy[0] + ', ' + f.xy[1] + ')</span>' : '') + '<br><span class="dim">' + esc(condLabel(r.c)) + '</span></div>' +
        '<div class="bf-status">' + status + bar + (next ? '<br><span class="dim">Then ' + next + '</span>' : '') + '</div>' +
        '<div class="bf-how">' + esc(how.join(' · ')) + '</div>' +
        '<div class="bf-act">' + (f.k ? '<button type="button" class="lv-tick' + (r.got ? ' on' : '') + '" data-ltick="' + esc(f.k) + '">' + (r.got ? '✓ Caught' : 'Mark caught') + '</button>' + star(f.k) : '') + '</div></div>';
    }).join('');
    $('#page').innerHTML = liveHead('Big Fish', 'Every big fish and legendary fish, sorted like a spawn tracker: fish that are up now first (with how far into the window you are), then the soonest windows, with the next two after that in your local time. Windows come from each fish\'s hours, weather and previous weather, worked out with the game\'s weather formula. Mark a fish caught here or in the Fishing Log; ☆ adds it to notifications.', '') + tools +
      '<div class="bf-head"><span>Fish</span><span>Where and when</span><span>Status</span><span>How to catch it</span><span></span></div>' + (list || '<p class="dim">No fish match these filters.</p>');
  }

  // ---- Ocean fishing
  function voyagesFrom(now, count) {
    var O = LIVE.ocean, out = [], slot = Math.floor(now / 1000 / O.period);
    if (now / 1000 - slot * O.period > 15 * 60) slot++; // boarding closes at a quarter past
    for (var j = 0; j < count; j++) {
      var k = slot + j, row = O.table[(k + O.offset) % O.table.length];
      out.push({ at: k * O.period * 1000, indigo: O.routes[row[0]], ruby: O.routes[row[1]] });
    }
    return out;
  }
  function routeHtml(r) {
    if (!r) return '';
    var miss = 0, total = 0;
    var stops = r.stops.map(function (s) {
      var m = s.fish.concat(s.spectral).filter(function (k) { total++; if (!has(k)) { miss++; return true; } return false; });
      return '<span class="of-stop"><b>' + esc(s.name) + '</b> <span class="of-tod ' + esc(s.time.toLowerCase()) + '">' + esc(s.time) + '</span>' + (m.length ? ' <span class="dim">' + m.length + ' fish to log</span>' : '') + '</span>';
    }).join('<span class="of-arrow">→</span>');
    return '<div class="of-route"><div class="of-rname">' + esc(r.line) + ': ' + esc(r.name) + (r.targets.length ? ' <span class="of-tg">Targets: ' + esc(r.targets.join(', ')) + '</span>' : '') + (miss ? ' <span class="lv-badge">' + miss + ' of ' + total + ' fish missing</span>' : (total ? ' <span class="dim">all fish logged</span>' : '')) + '</div><div class="of-stops">' + stops + '</div></div>';
  }
  function renderOcean() {
    var now = Date.now(), O = LIVE.ocean;
    if (!O) { $('#page').innerHTML = liveHead('Ocean Fishing') + '<p>No ocean fishing data in this build.</p>'; return; }
    var vs = voyagesFrom(now, 12);
    var rows = vs.map(function (v, n) {
      var boarding = now >= v.at && now < v.at + 15 * 60000;
      return '<div class="of-voy' + (boarding ? ' boarding' : '') + '"><div class="of-time"><b>' + lt(v.at) + '</b><br>' + (boarding ? '<b class="up">Boarding now</b> · closes in ' + cdown(v.at + 15 * 60000) : 'boarding in ' + cdown(v.at)) + '</div><div>' + routeHtml(v.indigo) + routeHtml(v.ruby) + '</div></div>';
    }).join('');
    var c = liveChar(), done = O.ach.filter(function (a) { return has(a[0]); }).length;
    var ach = '<h3 class="lv-h">Ocean fishing achievements <span class="dim">(' + done + ' of ' + O.ach.length + ')</span></h3><div class="of-ach">' + O.ach.map(function (a) {
      return '<div class="lv-row' + (has(a[0]) ? ' got' : '') + '">' + rowName(a[0], a[1]) + '<span class="dim">' + esc(a[2]) + '</span><span class="lv-got">' + (has(a[0]) ? '✓' : '') + '</span></div>';
    }).join('') + '</div>';
    var guide = '<h3 class="lv-h">Guide: leveling and fast-tracking the achievements</h3>' + (LIVE.guides.ocean || []).map(function (g) { return '<div class="lv-guide"><b>' + esc(g[0]) + '</b><p>' + esc(g[1]) + '</p></div>'; }).join('');
    $('#page').innerHTML = liveHead('Ocean Fishing', 'The next 12 voyages from Limsa Lominsa (Indigo Route) and Kugane (Ruby Route), from the game\'s own route table. Each shows its stops with the time of day, the route\'s best targets, and how many of the fish there the chosen character still has to log.', '') +
      '<div class="lv-tools">' + charSelect() + '</div><div class="of-list">' + rows + '</div>' + ach + guide;
  }

  // ---- Timers & Events
  var FRESH_TIMERS = null;
  if (typeof HOSTED !== 'undefined' && HOSTED && window.fetch) {
    fetch('timers.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !Array.isArray(j.timers)) return;
      var P = new DOMParser(); // names may arrive as HTML; keep the text only (DOMParser never runs scripts or handlers)
      FRESH_TIMERS = { timers: j.timers.map(function (t) { return { name: (P.parseFromString(String(t.name || ''), 'text/html').body.textContent || '').trim(), type: t.type, start: +t.start, end: +t.end || 0 }; }).filter(function (t) { return t.name && t.start; }) };
    }).catch(function () {});
  }
  function nextUtc(now, h, dow) { // next time at UTC hour h (and weekday dow, 0 = Sunday)
    var d = new Date(now); d.setUTCMinutes(0, 0, 0); d.setUTCHours(h);
    while (d.getTime() <= now || (dow != null && d.getUTCDay() !== dow)) d = new Date(d.getTime() + 86400000);
    return d.getTime();
  }
  function nextGate(now) { var d = new Date(now), m = d.getMinutes(), add = 20 - (m % 20); d.setSeconds(0, 0); return d.getTime() + add * 60000 - (m % 20 === 0 && d.getTime() === now ? 0 : 0); }
  function gateNames(at) { var m = new Date(at).getMinutes(), g = LIVE.gate.find(function (x) { return x[0] === m; }); return g ? g[1] : []; }
  function resets(now) {
    var fr = nextUtc(now, 8, 5), frEnd = nextUtc(now, 8, 2), frOpen = frEnd < fr;
    return [
      ['daily', 'Daily reset', nextUtc(now, 15), 'Duty roulettes, beast tribe allowances, Custom Deliveries count, daily hunts and Mini Cactpot'],
      ['weekly', 'Weekly reset (Tuesday)', nextUtc(now, 8, 2), 'Raid lockouts, tomestone cap, Wondrous Tails, Custom Deliveries, Doman Enclave, weekly hunts and challenge log'],
      ['gc', 'Grand Company reset', nextUtc(now, 20), 'Grand Company supply and provisioning missions'],
      ['fashion', frOpen ? 'Fashion Report: judging open' : 'Fashion Report opens (Friday)', frOpen ? frEnd : fr, frOpen ? 'Judging closes at the weekly reset' : 'Judging opens on Friday at the same hour as the weekly reset']
    ];
  }
  function renderTimers() {
    var now = Date.now(), T = (FRESH_TIMERS || LIVE.timers);
    var rs = resets(now).map(function (r) { return '<div class="tm-row"><b>' + esc(r[1]) + '</b><span>' + cdown(r[2]) + '</span><span class="dim">' + esc(lt(r[2]) + ' · ' + new Date(r[2]).toLocaleDateString([], { weekday: 'short' })) + '</span><span class="dim">' + esc(r[3]) + '</span></div>'; }).join('');
    var g = nextGate(now), v = voyagesFrom(now, 1)[0];
    var other = '<div class="tm-row"><b>Next GATE</b><span>' + cdown(g) + '</span><span class="dim">' + lt(g) + '</span><span class="dim">One of: ' + esc(gateNames(g).join(', ')) + '</span></div>' +
      (v ? '<div class="tm-row"><b>Next ocean fishing boat</b><span>' + cdown(v.at) + '</span><span class="dim">' + lt(v.at) + '</span><span class="dim">' + esc((v.indigo ? v.indigo.name : '') + ' · ' + (v.ruby ? v.ruby.name : '')) + '</span></div>' : '');
    var ev = (T.timers || []).filter(function (t) { return (t.end || t.start) > now; }).sort(function (a, b) { return a.start - b.start; }).map(function (t) {
      var on = t.start <= now;
      return '<div class="tm-row ev ' + esc(t.type || '') + '"><b>' + esc(t.name) + '</b><span>' + (on ? (t.end ? 'ends in ' + cdown(t.end) : 'now') : 'starts in ' + cdown(t.start)) + '</span><span class="dim">' + esc(new Date(on && t.end ? t.end : t.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</span><span class="dim">' + esc(t.type === 'maintenance' ? 'Maintenance' : 'Event') + '</span></div>';
    }).join('');
    var jb = jumboAt(now), dcs = []; Object.keys(LIVE.dc || {}).forEach(function (r) { dcs = dcs.concat(LIVE.dc[r].dcs); });
    other += '<div class="tm-row"><b>Jumbo Cactpot drawing</b><span>' + (jb ? cdown(jb.at) : '') + '</span><span class="dim">' + (jb ? esc(lt(jb.at) + ' · ' + new Date(jb.at).toLocaleDateString([], { weekday: 'short' })) : '') + '</span><span class="dim">Data center <select data-live="dc"><option value="">choose</option>' + dcs.sort().map(function (d) { return '<option' + (d === UI.live.dc ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select>' + (jb ? ' · ' + esc(jb.region) : '') + '</span></div>';
    $('#page').innerHTML = liveHead('Timers & Events', 'Game resets, the next GATE and ocean fishing boat, and the seasonal events and maintenance announced on the Lodestone (from Xenoveritas\' timer list' + (FRESH_TIMERS ? ', fresh copy' : ', as of ' + esc(LIVE.timers.fetched || 'the build')) + '). All times are in your time zone.', '') +
      '<h3 class="lv-h">Resets</h3>' + rs + '<h3 class="lv-h">Gold Saucer and ocean fishing</h3>' + other + '<h3 class="lv-h">Seasonal events and maintenance</h3>' + (ev || '<p class="dim">Nothing announced right now.</p>') + '<div class="lv-tools">' + charSelect() + '</div>' + eventRewardsHtml(now);
  }

  // ---- Field monsters (Eureka, Bozja, the Occult Crescent)
  var ELEMENT_SETS = [['', 'All'], ['Ice|Lightning', 'Ice or lightning'], ['Fire|Earth', 'Fire or earth'], ['Water|Wind', 'Water or wind'], ['sprite', 'Sprites'], ['ashkin', 'Ashkin (night)']];
  function isNight(zone, now) { var h = etHours(now); return /Occult|Horn/.test(zone) ? (h >= 22 || h < 4) : (h >= 18 || h < 6); }
  function spawnNow(spawn, wzone, now) {
    if (!spawn) return null;
    var s = spawn.toLowerCase();
    if (s === 'night') return isNight(wzone, now);
    if (s === 'day') return !isNight(wzone, now);
    var cur = wName(weatherAt(wzone, now)).toLowerCase();
    return cur ? norm(cur) === norm(s) || cur.indexOf(s.replace(/s$/, '')) >= 0 : null;
  }
  function renderField() {
    var now = Date.now(), F = LIVE.field, L = UI.live, zones = Object.keys(F.zones);
    if (zones.indexOf(L.zone) < 0) L.zone = zones[0];
    var z = L.zone, wz = F.weatherZone[z] || z, eureka = /^Eureka/.test(z), occult = /Occult/.test(z);
    var mons = (F.zones[z] || []).filter(function (m) {
      if (eureka && L.el) {
        if (L.el === 'sprite') { if (!/Sprite$/.test(m.n)) return false; }
        else if (L.el === 'ashkin') { if (!/night/i.test(m.spawn || '')) return false; }
        else if (L.el.split('|').indexOf(m.el || '') < 0) return false;
      }
      if (occult && L.weak && (m.weak || '') !== L.weak) return false;
      if (L.spawnNow && m.spawn && !spawnNow(m.spawn, wz, now)) return false;
      if (L.spawnNow && !m.spawn) return false;
      return true;
    }).sort(function (a, b) { return (parseInt(a.lv, 10) || 0) - (parseInt(b.lv, 10) || 0) || a.n.localeCompare(b.n); });
    var cur = wName(weatherAt(wz, now)), night = isNight(wz, now);
    var tabs = '<div class="lv-tabs">' + zones.map(function (x) { return '<button type="button" class="lv-tab' + (x === z ? ' on' : '') + '" data-live-zone="' + esc(x) + '">' + esc(x.replace('The Occult Crescent: ', '')) + '</button>'; }).join('') + '</div>';
    var filt = '<div class="lv-tools">' + (eureka ? '<label class="lv-sel">Element <select data-live="el">' + ELEMENT_SETS.map(function (e) { return '<option value="' + e[0] + '"' + (e[0] === L.el ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('') + '</select></label>' : '') +
      (occult ? '<label class="lv-sel">Weak to <select data-live="weak"><option value="">Any</option>' + ['Fire', 'Ice', 'Wind', 'Earth', 'Lightning', 'Water'].map(function (e) { return '<option' + (e === L.weak ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="lv-chk"><input type="checkbox" data-live="spawnNow"' + (L.spawnNow ? ' checked' : '') + '> Only weather or night monsters that are out now</label>' +
      '<span class="lv-count">Weather now: <b>' + esc(cur || '—') + '</b> · ' + (night ? 'night' : 'day') + '</span></div>';
    var chal = F.challenge.filter(function (c) { return eureka ? /Forbidden/.test(c[1]) : occult ? /Occult|Critically|Fateful|Chain/.test(c[1]) : false; });
    var chalHtml = chal.length ? '<div class="lv-guide"><b>Challenge log</b>' + chal.map(function (c) {
      var hint = /ice- or lightning/.test(c[2]) ? 'Ice|Lightning' : /fire- or earth/.test(c[2]) ? 'Fire|Earth' : /water- or wind/.test(c[2]) ? 'Water|Wind' : /sprites/.test(c[2]) ? 'sprite' : /ashkin/.test(c[2]) ? 'ashkin' : '';
      return '<p>' + esc(c[1]) + ': ' + esc(c[2]) + (eureka && hint ? ' <button type="button" class="btn sm ghost" data-live-el="' + hint + '">Show them</button>' : '') + '</p>';
    }).join('') + '</div>' : '';
    var nms = Object.keys(F.events).filter(function (n) { var e = F.events[n]; return e.area && (z.indexOf(e.area) >= 0 || e.area.indexOf(z.replace('The Occult Crescent: ', '')) >= 0); }).map(function (n) {
      var e = F.events[n], trig = (F.zones[z] || []).find(function (m) { return e.spawn && norm(m.n) === norm(e.spawn.replace(/^Lv\. \d+ /, '')); });
      var need = trig && trig.spawn ? trig.spawn : '', live = need ? spawnNow(need, wz, now) : null;
      return '<div class="lv-row' + (live ? ' now' : '') + '"><b>' + esc(n) + '</b><span>' + esc(e.boss || '') + (e.weak ? ' <span class="dim">(weak to ' + esc(e.weak) + ')</span>' : '') + '</span><span class="dim">' + esc(e.spawn && e.spawn !== 'Automatic' ? 'Spawns after ' + e.spawn : (e.spawn === 'Automatic' ? 'Spawns by itself' : '')) + (need ? ' · trigger needs ' + need + (live ? ' — now' : '') : '') + '</span><span class="dim">' + esc((e.at || '').replace(/\s+/g, ' ')) + '</span></div>';
    }).join('');
    var table = '<div class="fm-head"><span>Monster</span><span>Level</span><span>Where</span><span>' + (occult ? 'Weak to' : 'Element') + '</span><span>Spawns</span></div>' + mons.map(function (m) {
      var live = m.spawn ? spawnNow(m.spawn, wz, now) : null;
      var drops = (m.loot || []).filter(function (l) { return /Fragment|Cluster|Memory|Lockbox|Logogram|Crystal/.test(l); });
      return '<div class="fm-row' + (live ? ' now' : '') + '"><span><b>' + esc(m.n) + '</b>' + (m.area ? ' <span class="dim">' + esc(m.area) + '</span>' : '') + (m.clan ? ' <span class="dim">· ' + esc(m.clan) + '</span>' : '') + (drops.length ? '<br><span class="dim">Drops: ' + esc(drops.join(', ')) + '</span>' : '') + '</span><span>' + esc(m.rank || m.lv || '') + '</span><span>' + (m.x != null ? '(' + m.x + ', ' + m.y + ')' : '') + '</span><span>' + esc(occult ? (m.weak || '') : (m.el || '')) + '</span><span>' + esc(m.spawn || 'always') + (m.rule ? ' <span class="dim" title="Not documented for this monster; Zadnor documents this rule for the same kind of monster">(usual rule)</span>' : '') + (live ? ' <b class="up">now</b>' : (function () { var nx = fieldNext(m, wz, now); return nx ? ' <span class="dim">· next ' + lt(nx.s) + ' (in ' + dur(nx.s - now) + ')</span>' : ''; })()) + (m.aggro ? ' <span class="dim">· aggro: ' + esc(m.aggro) + '</span>' : '') + '</span></div>';
    }).join('');
    $('#page').innerHTML = liveHead('Field Monsters', 'Where every monster of Eureka, Bozja and the Occult Crescent is, its level and element (Eureka) or weakness (Occult Crescent), and which only appear in certain weather or at night: those turn the accent colour while they are out. Use the element filter for the Eureka challenge log.', '') + tabs + filt + chalHtml +
      (nms ? '<h3 class="lv-h">Notorious monsters and events</h3>' + nms : '') + '<h3 class="lv-h">Monsters <span class="dim">(' + mons.length + ')</span></h3>' + table;
  }

  // ---- Gold Saucer
  function listProgress(sid) {
    var s = SEC.get(sid); if (!s) return '';
    return ST.chars.map(function (c) { var t = 0, d = 0; s.groups.forEach(function (g) { g.keys.forEach(function (k) { t++; if (ST.ticks[c.id][k]) d++; }); }); return esc(c.name) + ' ' + d + '/' + t; }).join(' · ');
  }
  function renderGold() {
    var now = Date.now(), g = nextGate(now), G = LIVE.guides;
    var sched = LIVE.gate.map(function (x) { return '<div class="tm-row"><b>:' + ('0' + x[0]).slice(-2) + '</b><span class="dim">' + esc(x[1].join(' · ')) + '</span></div>'; }).join('');
    function guide(list) { return (list || []).map(function (x) { return '<div class="lv-guide"><b>' + esc(x[0]) + '</b><p>' + esc(x[1]) + '</p></div>'; }).join(''); }
    $('#page').innerHTML = liveHead('Gold Saucer', 'The GATE schedule with the next one counting down, and guides to fast-track the Lord of Verminion and chocobo racing achievements. Their goals are tracked in Character → Gold Saucer → Lord of Verminion and Chocobo Racing.', '') +
      '<div class="tm-row big"><b>Next GATE</b><span>' + cdown(g) + '</span><span class="dim">' + lt(g) + ' · one of ' + esc(gateNames(g).join(', ')) + '</span></div>' + sched +
      '<h3 class="lv-h">GATEs</h3>' + guide(G.gate) +
      '<h3 class="lv-h">Lord of Verminion <span class="dim">' + listProgress('verminion') + '</span></h3>' + guide(G.verminion) +
      '<h3 class="lv-h">Chocobo Racing <span class="dim">' + listProgress('chocoboracing') + '</span></h3>' + guide(G.racing);
  }

  // ---- Notifications: what to be told about, and how
  function renderNotify() {
    var N = UI.live.notify, perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    function sel(key, opts) { return '<select data-notify="' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(N[key]) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
    function chk(key, label) { return '<label class="lv-chk"><input type="checkbox" data-notify="' + key + '"' + (N[key] ? ' checked' : '') + '> ' + label + '</label>'; }
    var leads = [[0, 'when it starts'], [2, '2 min before'], [5, '5 min before'], [10, '10 min before'], [15, '15 min before'], [30, '30 min before']];
    var gates = ['Air Force One', 'Cliffhanger', 'Leap of Faith', 'Any Way the Wind Blows', 'The Slice Is Right'];
    var watched = UI.live.watch.map(function (k) { return '<div class="lv-row">' + rowName(k) + star(k) + '</div>'; }).join('') || '<p class="dim">Nothing watched yet. Use ☆ on the Big Fish board, on Up Now, or in an entry\'s details.</p>';
    $('#page').innerHTML = liveHead('Notifications', 'Choose exactly what the tracker tells you about while it is open in a tab. Notifications use your browser\'s notifications (allow them below), a short sound, and a message in the page; switch each on or off. "Missing" means not yet ticked for the character chosen here.', '') +
      '<div class="nt-box">' + chk('on', '<b>Notifications on</b>') + ' <span class="dim">Browser permission: ' + esc(perm) + '</span> ' + (perm === 'default' ? '<button type="button" class="btn sm" data-notify-perm="1">Allow browser notifications</button>' : '') +
      '<div class="lv-tools">' + charSelect() + chk('browser', 'Browser notification') + chk('sound', 'Sound') + chk('toast', 'Message in the page') + '<button type="button" class="btn sm ghost" data-notify-test="1">Send a test</button></div></div>' +
      '<div class="nt-grid">' +
      '<div class="nt-cat"><h4>Big fish</h4>' + sel('bigfish', [['off', 'Off'], ['watched', 'Only watched fish'], ['missing', 'Big fish not yet caught'], ['all', 'Every big fish']]) + chk('legendaryOnly', 'Legendary fish only') + ' Tell me ' + sel('bigfishLead', leads) + '</div>' +
      '<div class="nt-cat"><h4>Other fish with a window</h4>' + sel('fish', [['off', 'Off'], ['watched', 'Only watched fish'], ['missing', 'Fish not yet caught']]) + '</div>' +
      '<div class="nt-cat"><h4>Timed gathering nodes</h4>' + sel('nodes', [['off', 'Off'], ['watched', 'Only watched items'], ['missing', 'Items not yet gathered']]) + '</div>' +
      '<div class="nt-cat"><h4>Vistas</h4>' + chk('vistas', 'Vistas not yet logged, when their window opens') + '</div>' +
      '<div class="nt-cat"><h4>Ocean fishing</h4>' + sel('ocean', [['off', 'Off'], ['all', 'Every boat'], ['missing', 'Boats with fish I have not logged']]) + ' Tell me ' + sel('oceanLead', leads) + '</div>' +
      '<div class="nt-cat"><h4>Resets</h4>' + chk('daily', 'Daily reset') + chk('weekly', 'Weekly reset') + chk('gc', 'Grand Company reset') + chk('fashion', 'Fashion Report opens') + ' Tell me ' + sel('lead', leads) + '</div>' +
      '<div class="nt-cat"><h4>GATEs</h4>' + chk('gate', 'Before each GATE') + gates.map(function (x) { return '<label class="lv-chk"><input type="checkbox" data-notify-gate="' + esc(x) + '"' + (N.gates[x] === false ? '' : ' checked') + '> ' + esc(x) + '</label>'; }).join('') + ' Tell me ' + sel('gateLead', leads) + '</div>' +
      '<div class="nt-cat"><h4>Events and maintenance</h4>' + chk('events', 'When a seasonal event or maintenance starts') + '</div>' +
      '<div class="nt-cat"><h4>S ranks</h4>' + chk('srank', 'When an S rank\'s weather, time or moon condition is met') + '</div>' +
      '<div class="nt-cat"><h4>Island Sanctuary</h4>' + chk('isle', 'When a rare animal comes out') + '</div>' +
      '<div class="nt-cat"><h4>Jumbo Cactpot</h4>' + chk('jumbo', 'Before the drawing (choose your data center on Timers & Events)') + '</div>' +
      '<div class="nt-cat"><h4>Hunts</h4>' + sel('hunt', [['off', 'Off'], ['S', 'S and SS ranks'], ['all', 'S, SS and A ranks']]) + ' Tell me ' + sel('huntLead', leads) + ' before a window opens, and again when it caps (for the world chosen on Hunts, from the kills you recorded)' + chk('huntMaint', 'Also windows that start from the last maintenance') + '</div>' +
      '<div class="nt-cat"><h4>Lodestone news</h4>' + sel('news', [['off', 'Off'], ['maint', 'Maintenance notices'], ['all', 'Every new news item and topic']]) + ' <span class="dim">(on the hosted tracker; checked every 30 minutes)</span></div>' +
      '<div class="nt-cat"><h4>Field operations</h4>' + chk('fieldNm', 'When weather or night brings out a monster that triggers a notorious monster') + '</div>' +
      '</div><h3 class="lv-h">Watched</h3>' + watched;
  }

  // ---- notification engine
  var FIRED = (function () { try { return JSON.parse(localStorage.getItem('eveniunt-tracker-fired') || '{}'); } catch (e) { return {}; } })();
  function beep() { try { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var a = new A(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.06; o.connect(g); g.connect(a.destination); o.start(); setTimeout(function () { o.stop(); a.close(); }, 220); } catch (e) { /* no sound */ } }
  function notifyNow(title, body) {
    var N = UI.live.notify;
    if (N.browser && typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification(title, { body: body, tag: title }); } catch (e) { /* ignore */ } }
    if (N.sound) beep();
    if (N.toast) toast(title + (body ? ': ' + body : ''));
  }
  function fireOnce(id, at, lead, title, body) {
    var now = Date.now();
    if (FIRED[id] || now < at - lead * 60000 || now > at + 60000 * 5) return;
    FIRED[id] = now; notifyNow(title, body);
  }
  function notifyTick() {
    var N = UI.live.notify; if (!N.on || !ST) return;
    var now = Date.now(), watch = UI.live.watch;
    function wanted(mode, k) { return mode === 'all' || (mode === 'watched' && watch.indexOf(k) >= 0) || (mode === 'missing' && (!has(k) || watch.indexOf(k) >= 0)); }
    LIVE.bigfish.forEach(function (f) {
      if (N.bigfish === 'off' || (N.legendaryOnly && f.kind !== 'legendary') || !wanted(N.bigfish, f.k)) return;
      var c = (f.k && COND.cond[f.k]) || bfCond(f), w = c && cachedWindows('bf:' + f.n, c, 1)[0]; if (!w || w.always) return;
      fireOnce('bf:' + f.n + ':' + w.s, w.s, +N.bigfishLead, (f.kind === 'legendary' ? 'Legendary fish' : 'Big fish') + ': ' + f.n, (w.s <= now ? 'up now' : 'up at ' + lt(w.s)) + (f.z ? ' in ' + f.z : ''));
    });
    var bigKeys = {}; LIVE.bigfish.forEach(function (f) { if (f.k) bigKeys[f.k] = 1; });
    Object.keys(COND.cond).forEach(function (k) {
      var vista = k.indexOf('sightseeing:') === 0;
      if (vista ? !N.vistas || has(k) : (bigKeys[k] || N.fish === 'off' || !wanted(N.fish, k))) return;
      var w = cachedWindows(k, COND.cond[k], 1)[0]; if (!w || w.always) return;
      fireOnce(k + ':' + w.s, w.s, 0, (vista ? 'Vista: ' : 'Fish: ') + nameOf(k), 'window open in ' + COND.cond[k][0]);
    });
    if (N.nodes !== 'off') Object.keys(COND.nodes).forEach(function (k) {
      if (!wanted(N.nodes, k)) return;
      var nd = COND.nodes[k], h = etHours(now);
      nd[0].forEach(function (s) { var d = (s - h + 24) % 24, at = now + realFromEt(d); if (d < 1) fireOnce(k + ':' + Math.round(at / 60000), at, 0, 'Node: ' + nameOf(k), 'up at ' + ('0' + s).slice(-2) + ':00 ET'); });
    });
    if (N.ocean !== 'off' && LIVE.ocean) voyagesFrom(now, 1).forEach(function (v) {
      var missing = [v.indigo, v.ruby].some(function (r) { return r && r.stops.some(function (s) { return s.fish.concat(s.spectral).some(function (k) { return !has(k); }); }); });
      if (N.ocean === 'missing' && !missing) return;
      fireOnce('ocean:' + v.at, v.at, +N.oceanLead, 'Ocean fishing boat at ' + lt(v.at), (v.indigo ? v.indigo.name : '') + ' / ' + (v.ruby ? v.ruby.name : ''));
    });
    resets(now).forEach(function (r) { if (N[r[0]]) fireOnce('reset:' + r[0] + ':' + r[2], r[2], +N.lead, r[1], lt(r[2])); });
    if (N.gate) { var g = nextGate(now), names = gateNames(g).filter(function (x) { return N.gates[x.replace(/ \(.*\)$/, '')] !== false; }); if (names.length) fireOnce('gate:' + g, g, +N.gateLead, 'GATE at ' + lt(g), names.join(', ')); }
    if (N.events) ((FRESH_TIMERS || LIVE.timers).timers || []).forEach(function (t) { fireOnce('ev:' + t.name + t.start, t.start, 0, t.name, 'starting now'); });
    if (N.srank) LIVE.srank.forEach(function (m) { if (!m.spec) return; var w = srWindows(m.n, m.spec, 1)[0]; if (w) fireOnce('sr:' + m.n + ':' + w.s, w.s, 0, 'S rank: ' + m.n, 'spawn condition met in ' + (m.area || '')); });
    if (N.isle) LIVE.island.animals.forEach(function (a) { if (!a.hours && !a.weather) return; var w = cachedWindows('isle:' + a.n, animalCond(a), 1)[0]; if (w) fireOnce('isle:' + a.n + ':' + w.s, w.s, 0, 'Island: ' + a.n, 'out now on your island'); });
    if (N.jumbo) { var jb = jumboAt(now); if (jb) fireOnce('jumbo:' + jb.at, jb.at, 30, 'Jumbo Cactpot drawing', 'at ' + lt(jb.at)); }
    if (N.fieldNm) Object.keys(LIVE.field.events).forEach(function (n) {
      var e = LIVE.field.events[n]; if (!e.spawn || e.spawn === 'Automatic') return;
      Object.keys(LIVE.field.zones).forEach(function (z) {
        var m = LIVE.field.zones[z].find(function (x) { return x.spawn && norm(x.n) === norm(e.spawn.replace(/^Lv\. \d+ /, '')); });
        if (m && spawnNow(m.spawn, LIVE.field.weatherZone[z] || z, now)) fireOnce('nm:' + n + ':' + periodStart(now), now, 0, n + ' can be triggered', m.n + ' is out (' + m.spawn + ') in ' + z);
      });
    });
    huntNotify(now);
    var cut = now - 3 * 86400000; Object.keys(FIRED).forEach(function (k) { if (FIRED[k] < cut) delete FIRED[k]; });
    try { localStorage.setItem('eveniunt-tracker-fired', JSON.stringify(FIRED)); } catch (e) { /* private window */ }
  }
  setInterval(notifyTick, 15000);
  function clearPoints(world, name) { var m = (LIVE.hunts.marks || []).find(function (x) { return x.n === name; }); if (m && m.tt && HST.pts[world]) delete HST.pts[world][m.tt]; }
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t.dataset || !t.dataset.mbq) return;
    UI.live.mq = t.value; clearTimeout(t._mbq);
    t._mbq = setTimeout(function () { liveSave(); renderMarket(); var i = $('[data-mbq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250);
  });

  // ---- shared: moon phase and reset arithmetic
  var MOON = ['New Moon', 'Waxing Crescent', 'Waxing Half Moon', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Waning Half Moon', 'Waning Crescent'];
  function eDays(ms) { return Math.floor(ms * 3600 / 175 / 1000 / 86400); }
  function moonPhase(ms) { return Math.floor((eDays(ms) % 32) / 4); } // a moon is 32 Eorzean days; each phase lasts 4, starting with the new moon
  function lastUtc(now, h, dow) { var n = nextUtc(now, h, dow); return n - (dow == null ? 86400000 : 7 * 86400000); }
  var WID_BY_NAME = {}; Object.keys(COND.names).forEach(function (k) { if (!WID_BY_NAME[COND.names[k].toLowerCase()]) WID_BY_NAME[COND.names[k].toLowerCase()] = +k; });

  // ---- S-rank board
  function srOk(s, t) {
    if (s.w && s.w.indexOf(weatherAt(s.zone, t)) < 0) return false;
    if (s.pw && s.pw.indexOf(weatherAt(s.zone, t - PERIOD)) < 0) return false;
    if (s.h && !inHours(etHours(t), s.h[0], s.h[1] % 24 === 0 && s.h[1] === 24 ? 24 : s.h[1])) return false;
    if (s.moon && moonPhase(t) !== (s.moon === 'full' ? 4 : 0)) return false;
    if (s.dry) { var wet = [WID_BY_NAME.rain, WID_BY_NAME.showers]; for (var p = periodStart(t - s.dry * 60000); p <= t; p += PERIOD) if (wet.indexOf(weatherAt(s.zone, p)) >= 0) return false; }
    return true;
  }
  function srWindows(name, s, count) {
    var now = Date.now(), key = 'sr:' + name, hit = WCACHE[key];
    if (hit && (!hit.length || hit[0].e > now) && now - WCACHE_AT < 60000) return hit;
    var out = [], start = null, t = now - (now % QUARTER), end = now + 14 * 86400000;
    for (; t < end && out.length < count; t += QUARTER) {
      var ok = srOk(s, t);
      if (ok && start === null) start = t;
      if (!ok && start !== null) { out.push({ s: start, e: t }); start = null; }
    }
    if (start !== null) out.push({ s: start, e: t });
    return (WCACHE[key] = out);
  }
  function renderSRank() {
    var now = Date.now(), rows = LIVE.srank.map(function (m) { var ws = m.spec ? srWindows(m.n, m.spec, 3) : []; return { m: m, ws: ws, open: ws[0] && ws[0].s <= now }; });
    rows.sort(function (a, b) { if (!!a.m.spec !== !!b.m.spec) return a.m.spec ? -1 : 1; if (a.open !== b.open) return a.open ? -1 : 1; return (a.ws[0] ? a.ws[0].s : Infinity) - (b.ws[0] ? b.ws[0].s : Infinity); });
    var list = rows.map(function (r) {
      var m = r.m, st = '';
      if (m.spec) st = r.open ? '<b class="up">Conditions met</b> · ' + cdown(r.ws[0].e) + ' left' : (r.ws[0] ? 'next in ' + cdown(r.ws[0].s) + ' <span class="dim">· ' + lt(r.ws[0].s) + '</span>' : '<span class="dim">not in the next 2 weeks</span>');
      else st = '<span class="dim">Triggered by players (no time or weather condition)</span>';
      return '<div class="bf-row sr' + (r.open ? ' open' : '') + '"><div><b>' + esc(m.n) + '</b><br><span class="dim">' + esc(m.area || '') + '</span></div><div>' + esc(m.spawn || '') + (m.spec && m.spec.note ? '<br><span class="dim">' + esc(m.spec.note) + '</span>' : '') + '</div><div>' + st + (r.ws.length > 1 ? '<br><span class="dim">Then ' + r.ws.slice(1).map(function (w) { return lt(w.s); }).join(' · ') + '</span>' : '') + '</div><div class="dim">' + esc(m.respawn ? 'Respawn: ' + m.respawn + (/hour/.test(m.respawn) ? '' : ' hours') : '') + '</div></div>';
    }).join('');
    $('#page').innerHTML = liveHead('S Ranks', 'Every S-rank elite mark and what makes it spawn. Where the condition is weather, time of day or the moon, the board says when it is met now and forecasts the next times (the moon is ' + esc(MOON[moonPhase(now)]) + ' now). It cannot know whether someone already killed the mark on your world: the respawn time is shown for that.', '') +
      '<div class="bf-head"><span>Mark</span><span>Spawn condition</span><span>Status</span><span>Respawn</span></div>' + list;
  }

  // ---- Island Sanctuary: rare animals and the workshop planner
  var ISLE = 'Unnamed Island';
  function animalCond(a) { var w = (a.weather || []).map(function (n) { return WID_BY_NAME[n.toLowerCase()]; }).filter(Boolean); return [ISLE, a.hours ? a.hours[0] : 0, a.hours ? (a.hours[1] || 24) : 24, w, []]; }
  UI.live.isle = Object.assign({ rank: 5, groove: 0, shops: 4, srank: 20, pop: {}, sup: {} }, UI.live.isle || {});
  function islePlan() {
    var I = LIVE.island, S = UI.live.isle, items = I.crafts.filter(function (c) { return c.lvl <= +S.srank; });
    var POP = ['Very High', 'High', 'Average', 'Low'];
    function val(c, eff) { var m = I.multiplier[S.pop[c.n] || 'Average'][I.supply.indexOf(S.sup[c.n] || 'Sufficient')]; return Math.floor(Math.floor(c.v * (1 + (S.rank - 1) / 10) * (1 + S.groove / 100)) * m) * (eff ? 2 : 1); }
    var best = {}; // best[t + '|' + last] = {v, path}
    items.forEach(function (c, j) { if (c.t <= 24) best[c.t + '|' + j] = { v: val(c, false), path: [[j, false]] }; });
    for (var t = 4; t <= 24; t += 2) items.forEach(function (c, j) {
      var cur = best[t + '|' + j]; if (!cur) return;
      items.forEach(function (d, k) {
        var nt = t + d.t; if (nt > 24) return;
        var eff = k !== j && d.th.some(function (x) { return c.th.indexOf(x) >= 0; });
        var nv = cur.v + val(d, eff), key = nt + '|' + k;
        if (!best[key] || best[key].v < nv) best[key] = { v: nv, path: cur.path.concat([[k, eff]]) };
      });
    });
    var top = null; Object.keys(best).forEach(function (k) { if (!top || best[k].v > top.v) top = best[k]; });
    return { items: items, top: top, val: val, POP: POP };
  }
  function renderIsland() {
    var now = Date.now(), I = LIVE.island, S = UI.live.isle;
    var rare = I.animals.filter(function (a) { return a.hours || a.weather; }).map(function (a) { var c = animalCond(a), ws = cachedWindows('isle:' + a.n, c, 2); return { a: a, c: c, ws: ws, open: ws[0] && ws[0].s <= now }; })
      .sort(function (x, y) { if (x.open !== y.open) return x.open ? -1 : 1; return (x.ws[0] ? x.ws[0].s : Infinity) - (y.ws[0] ? y.ws[0].s : Infinity); });
    var animals = rare.map(function (r) {
      var a = r.a, w = r.ws[0];
      return '<div class="bf-row' + (r.open ? ' open' : '') + '"><div><b>' + esc(a.n) + '</b> <span class="dim">' + esc(a.size || '') + '</span><br><span class="dim">(' + (a.xy || []).join(', ') + ')</span></div><div>' + esc(condLabel(r.c)) + '</div><div>' + (r.open ? '<b class="up">Out now</b> · ' + cdown(w.e) + ' left' : (w ? 'in ' + cdown(w.s) + ' <span class="dim">· ' + lt(w.s) + '</span>' : '')) + '</div><div class="dim">' + esc((a.tool ? 'Catch with ' + a.tool : '') + (a.common ? ' · leaves ' + a.common + (a.bonus ? ' (bonus ' + a.bonus + ')' : '') : '')) + '</div></div>';
    }).join('');
    var plan = islePlan(), rankOpt = function (key, max, from) { var o = ''; for (var n = from; n <= max; n++) o += '<option' + (+S[key] === n ? ' selected' : '') + '>' + n + '</option>'; return '<select data-isle="' + key + '">' + o + '</select>'; };
    var agenda = plan.top ? plan.top.path.map(function (p, n) { var c = plan.items[p[0]]; return '<div class="lv-row"><b>' + (n + 1) + '. ' + esc(c.n) + '</b><span class="dim">' + c.t + ' h · ' + esc(c.th.join(', ')) + '</span><span>' + (p[1] ? '<b class="up">efficient ×2</b>' : 'first item') + '</span><span>' + plan.val(c, p[1]) + ' cowries</span></div>'; }).join('') : '';
    var inputs = plan.items.map(function (c) {
      return '<div class="isle-in"><span>' + esc(c.n) + ' <span class="dim">' + c.t + 'h · ' + c.v + '</span></span><select data-isle-pop="' + esc(c.n) + '">' + plan.POP.map(function (p) { return '<option' + ((S.pop[c.n] || 'Average') === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select><select data-isle-sup="' + esc(c.n) + '">' + I.supply.map(function (p) { return '<option' + ((S.sup[c.n] || 'Sufficient') === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></div>';
    }).join('');
    $('#page').innerHTML = liveHead('Island Sanctuary', 'Rare animals by their Eorzea hours and island weather (worked out with the island\'s own weather table), and a workshop planner that finds the 24-hour agenda worth the most cowries from this week\'s popularity and supply.', '') +
      '<h3 class="lv-h">Rare animals</h3><div class="bf-head"><span>Animal</span><span>Needs</span><span>Status</span><span>Catch</span></div>' + animals +
      '<h3 class="lv-h">Workshop planner</h3><div class="lv-guide"><b>How the weekly recommendations work</b><p>Each item\'s export value = base value × workshop rank bonus (+10% per rank above I) × groove (+1% per point) × a popularity and supply multiplier; an item that shares a category with the one before it (and is a different item) is made twice for the price of one. Community groups such as Overseas Casuals read every item\'s popularity and supply in game each week (supply also peaks on set days) and publish the best agenda. Here you enter what your workshop screen shows: set the items whose popularity is not Average and any supply that is not Sufficient, and the planner finds the best chain. Re-run it each day as supply changes, and avoid making the same item many days in a row (it floods its supply).</p></div>' +
      '<div class="lv-tools"><label class="lv-sel">Sanctuary rank ' + rankOpt('srank', 20, 1) + '</label><label class="lv-sel">Workshop rank ' + rankOpt('rank', 5, 1) + '</label><label class="lv-sel">Groove ' + rankOpt('groove', 45, 0) + '</label><label class="lv-sel">Workshops ' + rankOpt('shops', 4, 1) + '</label><button type="button" class="btn sm ghost" data-isle-reset="1">Reset popularity and supply</button></div>' +
      (plan.top ? '<div class="lv-guide"><b>Best agenda: ' + plan.top.v.toLocaleString() + ' cowries per workshop, ' + (plan.top.v * S.shops).toLocaleString() + ' for ' + S.shops + ' (one cycle)</b>' + agenda + '</div>' : '') +
      '<details class="isle-details"><summary>This week\'s popularity and supply (' + plan.items.length + ' handicrafts)</summary><div class="isle-grid">' + inputs + '</div></details>';
  }

  // ---- Dailies & Weeklies (per character; clears itself at each reset; kept on this device)
  var DKEY = 'eveniunt-tracker-dailies';
  var DSTATE = (function () { try { return JSON.parse(localStorage.getItem(DKEY) || '{}'); } catch (e) { return {}; } })();
  function dSave() { try { localStorage.setItem(DKEY, JSON.stringify(DSTATE)); } catch (e) { /* private window */ } }
  function dResetOf(kind, now) { return kind === 'daily' ? lastUtc(now, 15) : kind === 'weekly' ? lastUtc(now, 8, 2) : kind === 'gc' ? lastUtc(now, 20) : null; }
  function dGet(cid, task, now) {
    var s = (DSTATE[cid] || {})[task[0]]; if (!s) return { n: 0 };
    if (task[2] === 'map') return now - s.at < 18 * 3600000 ? { n: 1, at: s.at } : { n: 0 };
    return s.at >= dResetOf(task[2], now) ? s : { n: 0 };
  }
  function renderDailies() {
    var now = Date.now(), tasks = LIVE.guides.dailies || [];
    var head = '<div class="dl-row dl-head"><span>Task</span>' + ST.chars.map(function (c) { return '<span>' + esc(c.name) + '</span>'; }).join('') + '</div>';
    function rows(kinds) { return tasks.filter(function (t) { return kinds.indexOf(t[2]) >= 0; }).map(function (t) {
      return '<div class="dl-row"><span>' + esc(t[1]) + '</span>' + ST.chars.map(function (c) {
        var s = dGet(c.id, t, now), done = s.n >= t[3];
        var label = t[2] === 'map' ? (s.n ? 'ready in ' + dur(s.at + 18 * 3600000 - now) : 'ready') : (t[3] > 1 ? s.n + '/' + t[3] : (done ? '✓' : ''));
        return '<button type="button" class="dl-cell' + (done ? ' done' : '') + '" data-dl="' + esc(c.id + '|' + t[0]) + '">' + label + '</button>';
      }).join('') + '</div>'; }).join(''); }
    var r = resets(now);
    $('#page').innerHTML = liveHead('Dailies & Weeklies', 'Tick what each character has done; every task clears itself at its reset (daily ' + lt(r[0][2]) + ', Grand Company ' + lt(r[2][2]) + ', weekly ' + new Date(r[1][2]).toLocaleDateString([], { weekday: 'long' }) + ' ' + lt(r[1][2]) + '). Click a box to count up; click a full box to clear it. The timeworn map shows when the next one can be gathered. This checklist is kept on this device.', '') +
      '<div class="dl-table" style="--n:' + ST.chars.length + '"><h3 class="lv-h">Daily · resets in ' + cdown(r[0][2]) + '</h3>' + head + rows(['daily', 'gc', 'map']) + '<h3 class="lv-h">Weekly · resets in ' + cdown(r[1][2]) + '</h3>' + head + rows(['weekly']) + '</div>';
  }

  // ---- Leveling guides and PvP series
  function renderLeveling() {
    var G = LIVE.guides.leveling || {};
    $('#page').innerHTML = liveHead('Leveling Guides', 'The fastest routes by role and level band, and the bonuses that stack. Ocean fishing and Cosmic Exploration have their own pages and guides.', '') +
      Object.keys(G).map(function (k) { return '<h3 class="lv-h">' + esc(k) + '</h3>' + G[k].map(function (x) { return '<div class="lv-guide"><b>' + esc(x[0]) + '</b><p>' + esc(x[1]) + '</p></div>'; }).join(''); }).join('');
  }
  function renderPvp() {
    var P = LIVE.pvp || {}, nums = Object.keys(P).map(Number).sort(function (a, b) { return b - a; });
    $('#page').innerHTML = liveHead('PvP Series', 'The collectable rewards of each PvP series (Series Malmstones), newest first: the level that gives each one, and whether the chosen character has it. Series experience comes from any PvP match during that series.', '') + '<div class="lv-tools">' + charSelect() + '</div>' +
      nums.map(function (n, i) { return '<h3 class="lv-h">Series ' + n + (i === 0 ? ' <span class="dim">(newest listed)</span>' : '') + '</h3>' + P[n].map(function (r) { return '<div class="lv-row' + (has(r[1]) ? ' got' : '') + '"><b>Level ' + r[0] + '</b>' + rowName(r[1], r[2]) + '<span class="dim">' + esc((IDX.byKey.get(r[1]) || { s: { t: '' } }).s.t) + '</span><span class="lv-got">' + (has(r[1]) ? '✓ have it' : '') + '</span></div>'; }).join(''); }).join('');
  }
  // ---- Jumbo Cactpot (by data center) and the current event's rewards, shown on Timers & Events
  function jumboAt(now) {
    var dc = UI.live.dc; if (!dc) return null;
    var reg = Object.keys(LIVE.dc || {}).find(function (r) { return LIVE.dc[r].dcs.indexOf(dc) >= 0; }); if (!reg) return null;
    return { at: nextUtc(now, LIVE.dc[reg].utc, LIVE.dc[reg].day), region: reg };
  }
  function eventRewardsHtml(now) {
    var T = (FRESH_TIMERS || LIVE.timers).timers || [], ER = LIVE.eventRewards || {}, out = '';
    T.filter(function (t) { return t.type !== 'maintenance' && (t.end || t.start) > now && t.start - now < 14 * 86400000; }).forEach(function (t) {
      var base = norm(t.name.replace(/\(.*?\)|\d{4}/g, '')).slice(0, 18);
      var keys = []; Object.keys(ER).forEach(function (n) { if (base && norm(n).indexOf(base) === 0) keys = keys.concat(ER[n]); });
      keys = keys.filter(function (k, i, a) { return a.indexOf(k) === i && IDX.byKey.has(k); });
      if (!keys.length) return;
      out += '<h3 class="lv-h">' + esc(t.name) + ': rewards from this and earlier years</h3>' + keys.map(function (k) { return '<div class="lv-row' + (has(k) ? ' got' : '') + '">' + rowName(k) + '<span class="dim">' + esc(IDX.byKey.get(k).s.t) + '</span><span class="lv-got">' + (has(k) ? '✓ have it' : '') + '</span></div>'; }).join('');
    });
    return out;
  }
  // ---- field monsters: when is a weather or night monster next out?
  function fieldNext(m, wz, now) {
    if (!m.spawn) return null;
    var s = m.spawn.toLowerCase(), occ = /Horn/.test(wz), c;
    if (s === 'night') c = [wz, occ ? 22 : 18, occ ? 4 : 6, [], []];
    else if (s === 'day') c = [wz, 6, 18, [], []];
    else { var id = WID_BY_NAME[s] || WID_BY_NAME[s.replace(/s$/, '')]; if (!id) return null; c = [wz, 0, 24, [id], []]; }
    return cachedWindows('fm:' + wz + ':' + s, c, 1)[0] || null;
  }

  // ---- data center and world (shared by Hunts, Market Board, Housing and the Jumbo Cactpot)
  function dcNames() { return Object.keys(LIVE.worlds || {}).sort(); }
  function worldsOf(dc) { return (LIVE.worlds || {})[dc] || []; }
  // a region (North America, Europe, Japan, Oceania) is every data center a character can travel to freely
  function regionOf(dc) { return Object.keys(LIVE.dc || {}).find(function (r) { return LIVE.dc[r].dcs.indexOf(dc) >= 0; }) || null; }
  function regionDcs() { var r = regionOf(UI.live.dc); return r ? LIVE.dc[r].dcs.filter(function (d) { return worldsOf(d).length; }) : (UI.live.dc ? [UI.live.dc] : []); }
  function regionWorlds() { var out = []; regionDcs().forEach(function (d) { worldsOf(d).forEach(function (w) { out.push([w[0], w[1], d]); }); }); return out; }
  function dcOfWorld(name) { var hit = null; dcNames().forEach(function (d) { if (worldsOf(d).some(function (w) { return w[1] === name; })) hit = d; }); return hit; }
  function curWorld() { var w = regionWorlds().find(function (x) { return x[1] === UI.live.world; }); return w || null; }
  function placeSel(withWorld, worldLabel, wLabel) {
    var w = curWorld();
    return '<label class="lv-sel">Data center <select data-live="dc"><option value="">choose</option>' + dcNames().map(function (d) { return '<option' + (d === UI.live.dc ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label>' +
      (withWorld ? '<label class="lv-sel">' + esc(wLabel || 'World') + ' <select data-live="world"><option value="">' + esc(worldLabel || 'choose') + '</option>' + regionDcs().map(function (d) { return '<optgroup label="' + esc(d) + '">' + worldsOf(d).map(function (x) { return '<option' + (w && x[1] === w[1] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></label>' : '');
  }
  function store(key) {
    var s = (function () { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; } })();
    s.save = function () { try { var c = Object.assign({}, s); delete c.save; localStorage.setItem(key, JSON.stringify(c)); } catch (e) { /* private window */ } };
    return s;
  }
  function ago(ms) { return dur(Math.max(0, Date.now() - ms)) + ' ago'; }

  // ---- Hunts: spawn windows per world, spawn point maps, world boss FATEs (records are kept on this device)
  var HST = store('eveniunt-tracker-hunts'); HST.kills = HST.kills || {}; HST.boss = HST.boss || {}; HST.pts = HST.pts || {};
  var HOUR = 3600000;
  UI.live = Object.assign({ hex: 'Dawntrail', hrank: 'S', hsort: 'window', hmap: '', hscope: 'region' }, UI.live);
  if (UI.live.scopeV !== 2) { UI.live.hscope = 'region'; UI.live.mscope = 'region'; UI.live.scopeV = 2; } // region-wide by default (free travel between data centers)
  function lastMaint(now) { // end of the latest all-worlds maintenance: from the events list, or the time entered here
    var T = (FRESH_TIMERS || LIVE.timers).timers || [], auto = HST.maintAuto || 0;
    T.forEach(function (t) { if (t.type === 'maintenance' && /all worlds/i.test(t.name) && t.end && t.end <= now && t.end > auto) auto = t.end; });
    if (auto !== (HST.maintAuto || 0)) { HST.maintAuto = auto; HST.save(); }
    return Math.max(auto, HST.maint || 0) || null;
  }
  function maintNow(now) { var T = (FRESH_TIMERS || LIVE.timers).timers || []; return T.find(function (t) { return t.type === 'maintenance' && /all worlds/i.test(t.name) && t.start <= now && t.end > now; }) || null; }
  function huntWin(m, world, now) {
    var rs = m.rs; if (!rs || !world) return { src: 'none' };
    var k = (HST.kills[world] || {})[m.n], mt = lastMaint(now);
    if (k && (!mt || k > mt)) return { src: 'kill', at: k, open: k + rs[0] * HOUR, cap: k + rs[1] * HOUR };
    if (mt && rs.length > 2) return { src: 'maint', at: mt, open: mt + rs[2] * HOUR, cap: mt + rs[3] * HOUR };
    return { src: k ? 'old' : 'none', at: k };
  }
  function huntState(w, now) { return !w.open ? 'unknown' : now < w.open ? 'closed' : now < w.cap ? 'open' : 'capped'; }
  function huntStatusHtml(w, now) {
    var s = huntState(w, now), from = w.src === 'kill' ? 'since the kill ' + ago(w.at) : 'since maintenance ended (' + ago(w.at) + ')';
    if (s === 'unknown') return '<span class="dim">' + (w.src === 'old' ? 'Last kill was before the latest maintenance and this rank has no maintenance rule' : 'No kill recorded on this world yet') + '</span>';
    if (s === 'closed') return '<span class="hn-st closed">Closed</span> opens in ' + cdown(w.open) + ' <span class="dim">· ' + lt(w.open) + ' · ' + from + '</span>';
    if (s === 'open') { var pct = Math.round((now - w.open) / (w.cap - w.open) * 100); return '<span class="hn-st open">Open</span> ' + pct + '% through · caps in ' + cdown(w.cap) + '<span class="lv-bar"><i style="width:' + pct + '%"></i></span><span class="dim">' + from + '</span>'; }
    return '<span class="hn-st capped">Capped</span> should be up · capped ' + ago(w.cap) + ' <span class="dim">· ' + from + '</span>';
  }
  function spawnMap(tt, rank, world) {
    var z = (LIVE.hunts.spawn || {})[tt]; if (!z) return '<p class="dim">No spawn point map for this zone.</p>';
    var bit = rank === 'A' ? 2 : 1, max = z.max, chk = ((HST.pts[world] || {})[tt]) || [], left = 0, g = '';
    for (var c = 5; c < max; c += 5) g += '<line x1="' + c + '" y1="1" x2="' + c + '" y2="' + max + '"/><line x1="1" y1="' + c + '" x2="' + max + '" y2="' + c + '"/>';
    var dots = z.pts.map(function (p, i) {
      if (!(p[2] & bit)) return '';
      var done = chk.indexOf(i) >= 0; if (!done) left++;
      return '<circle class="' + (done ? 'done' : '') + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (max / 60).toFixed(2) + '" data-hpt="' + tt + '|' + i + '"><title>(' + p[0] + ', ' + p[1] + ')' + (done ? ' — checked' : '') + '</title></circle>';
    }).join('');
    return '<div class="hn-map"><svg viewBox="0.5 0.5 ' + max + ' ' + max + '" role="img" aria-label="' + esc(z.n) + ' spawn points"><rect x="1" y="1" width="' + (max - 1) + '" height="' + (max - 1) + '"/><g class="grid">' + g + '</g>' + dots + '</svg>' +
      '<div class="hn-map-side"><b>' + esc(z.n) + '</b><p>' + left + ' ' + (rank === 'A' ? 'A-rank' : 'S-rank') + ' spawn points left to check. Click a point when you have checked it (or when a B or A rank is standing on it, since a mark cannot spawn on a taken point); click again to undo. Coordinates show on hover. Grid lines every 5 map units.</p>' +
      '<button type="button" class="btn sm ghost" data-hpt-clear="' + tt + '">Clear checked points</button></div></div>';
  }
  function bossWin(b, world, now) {
    var t = b.timer, k = (HST.boss[world] || {})[b.boss], mt = lastMaint(now);
    if (t && t.kill && k && (!mt || k > mt || !t.maint)) return { src: 'kill', at: k, open: k + t.kill[0] * HOUR, cap: k + t.kill[1] * HOUR };
    if (t && t.maint && mt) return { src: 'maint', at: mt, open: mt + t.maint[0] * HOUR, cap: mt + t.maint[1] * HOUR };
    return { src: k ? 'old' : 'none', at: k };
  }
  function renderHunts() {
    var now = Date.now(), L = UI.live, H = LIVE.hunts || { marks: [], bosses: [], spawn: {} }, w = curWorld(), world = w ? w[1] : null;
    var exps = []; H.marks.forEach(function (m) { if (exps.indexOf(m.ex) < 0) exps.push(m.ex); });
    if (exps.indexOf(L.hex) < 0) L.hex = exps[exps.length - 1];
    var region = L.hscope !== 'world', RW = regionWorlds(), rankOrder = { capped: 0, open: 1, closed: 2, unknown: 3 };
    function bestOf(list) { return list.slice().sort(function (a, b) { return rankOrder[a.s] - rankOrder[b.s] || (a.s === 'closed' ? a.w.open - b.w.open : (a.w.cap || 0) - (b.w.cap || 0)); })[0]; }
    var rows = H.marks.filter(function (m) { return m.ex === L.hex && (L.hrank === 'all' || (L.hrank === 'A' ? m.r === 'A' : m.r !== 'A')); }).map(function (m) {
      var per = region ? RW.map(function (x) { var hw = huntWin(m, x[1], now); return { world: x[1], dc: x[2], w: hw, s: huntState(hw, now) }; }) : null;
      var hw = world ? huntWin(m, world, now) : { src: 'none' }, mine = { w: hw, s: huntState(hw, now) };
      var lead = region && per.length ? bestOf(per) : mine;
      return { m: m, w: mine.w, s: mine.s, per: per, lead: lead };
    });
    if (L.hsort === 'window') rows.sort(function (a, b) { var x = a.lead, y = b.lead; return rankOrder[x.s] - rankOrder[y.s] || (x.s === 'open' ? x.w.cap - y.w.cap : x.s === 'closed' ? x.w.open - y.w.open : x.s === 'capped' ? x.w.cap - y.w.cap : 0); });
    var mt = lastMaint(now), mn = maintNow(now);
    var tabs = '<div class="lv-tabs">' + exps.map(function (x) { return '<button type="button" class="lv-tab' + (x === L.hex ? ' on' : '') + '" data-hex="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>';
    var tools = '<div class="lv-tools">' + placeSel(true, 'choose', region ? 'Record kills on' : 'World') +
      '<label class="lv-sel">Show <select data-live="hscope"><option value="region"' + (region ? ' selected' : '') + '>Every world in ' + esc(regionOf(L.dc) || 'the region') + '</option><option value="world"' + (!region ? ' selected' : '') + '>One world</option></select></label>' +
      '<label class="lv-sel">Ranks <select data-live="hrank"><option value="S"' + (L.hrank === 'S' ? ' selected' : '') + '>S and SS</option><option value="A"' + (L.hrank === 'A' ? ' selected' : '') + '>A (train)</option><option value="all"' + (L.hrank === 'all' ? ' selected' : '') + '>All</option></select></label>' +
      '<label class="lv-sel">Sort <select data-live="hsort"><option value="window"' + (L.hsort === 'window' ? ' selected' : '') + '>By window</option><option value="zone"' + (L.hsort === 'zone' ? ' selected' : '') + '>By zone</option></select></label>' +
      '<span class="lv-count">' + (mn ? '<b>Maintenance now</b> · ends in ' + cdown(mn.end) : 'Last maintenance ended ' + (mt ? esc(new Date(mt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : 'unknown')) + ' <button type="button" class="btn sm ghost" data-hmaint="1" title="Set the time the servers came back, if the events list missed it">Set</button></span></div>';
    var list = !L.dc ? '<p class="lv-guide">Choose your data center: the board then covers every world you can travel to in its region.</p>' : (!world && !region) ? '<p class="lv-guide">Choose a world.</p>' : rows.map(function (r) {
      var m = r.m, k = world && (HST.kills[world] || {})[m.n], open = L.hmap === m.n && world;
      var status = region ? chipsHtml(r.per, world) + (world ? '<div class="hn-sel"><b>' + esc(world) + ':</b> ' + huntStatusHtml(r.w, now) + '</div>' : '<div class="dim">Click a world to choose it for recording kills.</div>') : huntStatusHtml(r.w, now);
      return '<div class="bf-row hn-row ' + r.lead.s + '"><div><b>' + esc(m.n) + '</b> <span class="lv-badge' + (m.r !== 'A' ? ' leg' : '') + '">' + m.r + '</span><br><span class="dim">' + esc(m.z) + '</span></div>' +
        '<div>' + esc(m.spawn || (m.r === 'A' ? 'Spawns by itself' : '')) + '<br><span class="dim">Respawn ' + (m.rs ? m.rs[0] + '–' + m.rs[1] + ' h' + (m.rs.length > 2 ? ', after maintenance ' + m.rs[2] + '–' + m.rs[3] + ' h' : '') : 'unknown') + '</span></div>' +
        '<div>' + status + '</div>' +
        '<div class="bf-act hn-act">' + (!world ? '' : '<button type="button" class="lv-tick" data-hkill="' + esc(m.n) + '" title="Record on ' + esc(world) + '">Killed now</button>') + (world ? '<button type="button" class="btn sm ghost" data-hkill-at="' + esc(m.n) + '" title="Enter when it died">Killed at…</button>' : '') + (k ? '<button type="button" class="btn sm ghost" data-hkill-clear="' + esc(m.n) + '">Clear</button>' : '') + (world && m.tt && H.spawn[m.tt] ? '<button type="button" class="btn sm ghost' + (open ? ' on' : '') + '" data-hmap="' + esc(m.n) + '">' + (open ? 'Hide map' : 'Spawn points') + '</button>' : '') + '</div>' +
        (open ? '<div class="hn-mapwrap">' + spawnMap(m.tt, m.r === 'A' ? 'A' : 'S', world) + '</div>' : '') + '</div>';
    }).join('');
    var bosses = H.bosses.filter(function (b) { return b.ex === L.hex; }).map(function (b) {
      var bw = world ? bossWin(b, world, now) : { src: 'none' }, s = huntState(bw, now), k = world && (HST.boss[world] || {})[b.boss];
      var st = s !== 'unknown' ? huntStatusHtml(bw, now) : (k ? 'Last killed ' + ago(k) : '<span class="dim">No kill recorded' + (world ? ' on ' + esc(world) : '') + '</span>');
      if (region && RW.length) {
        var per = RW.map(function (x) { var w2 = bossWin(b, x[1], now), k2 = (HST.boss[x[1]] || {})[b.boss]; return { world: x[1], dc: x[2], w: w2, s: huntState(w2, now), k: k2 }; });
        st = chipsHtml(per, world, true) + (world ? '<div class="hn-sel"><b>' + esc(world) + ':</b> ' + st + '</div>' : '');
        s = bestOf(per).s;
      }
      return '<div class="bf-row hn-row ' + s + '"><div><b>' + esc(b.boss) + '</b> <span class="dim">Lv. ' + b.lv + '</span><br><span class="dim">' + esc(b.fate) + '</span><br><span class="dim">' + esc(b.zone) + (b.xy ? ' (' + b.xy.join(', ') + ')' : '') + '</span></div>' +
        '<div>' + (b.after ? '<ol class="hn-chain">' + b.after.map(function (a) { return '<li>' + esc(a[0]) + (a[1] ? ' <span class="dim">(' + a[1].join(', ') + ')</span>' : '') + '</li>'; }).join('') + '<li><b>' + esc(b.fate) + '</b></li></ol>' : '') + esc(b.how) + (b.weather ? '<br><span class="dim">Zone weather turns to ' + esc(b.weather) + ' when it appears</span>' : '') + (b.spots ? '<br><span class="dim">Places: ' + esc(b.spots.map(function (p) { return p[0] + ' (' + p[1] + ', ' + p[2] + ')'; }).join(' · ')) + '</span>' : '') + (b.reward ? '<br><span class="dim">Reward: ' + esc(b.reward) + '</span>' : '') + '</div>' +
        '<div>' + st + (b.timer ? '<br><span class="dim">' + esc(b.timer.text) + '</span>' : '<br><span class="dim">Cooldown length is not documented</span>') + '</div>' +
        '<div class="bf-act hn-act">' + (world ? '<button type="button" class="lv-tick" data-hboss="' + esc(b.boss) + '">Killed now</button>' + (k ? '<button type="button" class="btn sm ghost" data-hboss-clear="' + esc(b.boss) + '">Clear</button>' : '') : '') + '</div></div>';
    }).join('');
    $('#page').innerHTML = liveHead('Hunts', 'Spawn windows for every S, SS and A rank on every world of your region (all of North America for Dynamis), in the manner of the community hunt trackers: each square is a world, grey closed, green open, blue capped, and a click chooses it for recording kills. Record a kill and the board shows when the window opens, how far through it is, and when it caps (the mark should be up by then). After maintenance the shorter maintenance windows apply automatically. Spawn point maps let you tick off the points you have checked. The records stay on this device; the board cannot see kills other players make, so it only knows what you enter. Spawn conditions and weather forecasts are on S Ranks.', '') +
      tabs + tools + '<div class="bf-head hn-head"><span>Mark</span><span>Spawn and respawn</span><span>' + (region ? 'Window on each world' : 'Window' + (world ? ' on ' + esc(world) : '')) + '</span><span></span></div>' + list +
      (bosses ? '<h3 class="lv-h">World boss FATEs</h3><div class="bf-head hn-head"><span>Boss</span><span>How it appears</span><span>Status</span><span></span></div>' + bosses : '');
  }
  function chipsHtml(per, sel, boss) { // one small square per world, grouped by data center, coloured by window state
    var by = {}; per.forEach(function (p) { (by[p.dc] = by[p.dc] || []).push(p); });
    var counts = { open: 0, capped: 0 }; per.forEach(function (p) { if (counts[p.s] != null) counts[p.s]++; });
    var now = Date.now();
    function tip(p) { var w = p.w; return p.world + ': ' + (p.s === 'closed' ? 'closed, opens ' + lt(w.open) : p.s === 'open' ? 'open, caps ' + lt(w.cap) : p.s === 'capped' ? 'capped ' + dur(now - w.cap) + ' ago, should be up' : (boss && p.k ? 'killed ' + dur(now - p.k) + ' ago' : 'no record')); }
    return '<div class="hn-chips">' + Object.keys(by).map(function (d) { return '<span class="hn-dc"><i>' + esc(d) + '</i>' + by[d].map(function (p) { return '<button type="button" class="hn-chip ' + p.s + (p.world === sel ? ' sel' : '') + '" data-hworld="' + esc(p.world) + '" title="' + esc(tip(p)) + '">' + esc(p.world.slice(0, 3)) + '</button>'; }).join('') + '</span>'; }).join('') + '</div>' +
      (counts.open || counts.capped ? '<div class="dim">' + [counts.capped ? 'capped on ' + counts.capped : '', counts.open ? 'open on ' + counts.open : ''].filter(Boolean).join(', ') + ' of ' + per.length + ' worlds</div>' : '');
  }
  function huntNotify(now) {
    var N = UI.live.notify; if (!N.hunt || N.hunt === 'off' || !LIVE.hunts) return;
    var worlds = UI.live.hscope !== 'world' ? regionWorlds() : (curWorld() ? [curWorld()] : []); if (!worlds.length) return;
    LIVE.hunts.marks.forEach(function (m) {
      if (N.hunt === 'S' && m.r === 'A') return;
      var maintDone = false;
      worlds.forEach(function (w) {
        var hw = huntWin(m, w[1], now); if (!hw.open) return;
        if (hw.src === 'maint') { // the same on every world: one notification, not one per world
          if (!N.huntMaint || maintDone) return; maintDone = true;
          fireOnce('hunt:maint:' + m.n + ':o' + hw.open, hw.open, +N.huntLead || 0, 'Hunt window opens: ' + m.n, 'every world without a recorded kill · ' + m.z);
          fireOnce('hunt:maint:' + m.n + ':c' + hw.cap, hw.cap, 0, 'Hunt window capped: ' + m.n, 'should be up where it has not been killed · ' + m.z);
          return;
        }
        fireOnce('hunt:' + w[1] + ':' + m.n + ':o' + hw.open, hw.open, +N.huntLead || 0, 'Hunt window opens: ' + m.n, w[1] + ' · ' + m.z);
        fireOnce('hunt:' + w[1] + ':' + m.n + ':c' + hw.cap, hw.cap, 0, 'Hunt window capped: ' + m.n, 'should be up on ' + w[1] + ' · ' + m.z);
      });
    });
  }

  // ---- Market Board (Universalis: crowd-reported market prices; no account, nothing sent but item numbers)
  var MB = {}, MB_TTL = 10 * 60000;
  UI.live = Object.assign({ mlist: [], mqty: {}, mscope: 'region', mq: '' }, UI.live);
  function mbScope() { var w = curWorld(), r = regionOf(UI.live.dc); return UI.live.mscope === 'world' && w ? w[1] : UI.live.mscope === 'dc' || !r ? UI.live.dc : r.replace(/ /g, '-'); }
  function scopeLabel() { return (mbScope() || '').replace(/-/g, ' '); }
  function whereSold(world) { var d = dcOfWorld(world); return world ? esc(world) + (d && UI.live.mscope !== 'world' ? ' (' + esc(d) + ')' : '') : ''; }
  function mbFetch(ids) {
    var scope = mbScope(), now = Date.now(); if (!scope || !window.fetch) return Promise.resolve({});
    var need = ids.filter(function (id) { var h = MB[scope + '|' + id]; return !h || now - h.at > MB_TTL; });
    var chunks = []; for (var i = 0; i < need.length; i += 100) chunks.push(need.slice(i, i + 100));
    return Promise.all(chunks.map(function (c) {
      return fetch('https://universalis.app/api/v2/' + encodeURIComponent(scope) + '/' + c.join(',') + '?listings=5&entries=10').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j) { c.forEach(function (id) { MB[scope + '|' + id] = { at: now, d: null }; }); return; }
        var items = c.length === 1 ? (function () { var o = {}; o[c[0]] = j; return o; })() : (j.items || {});
        c.forEach(function (id) { MB[scope + '|' + id] = { at: now, d: items[id] || null }; });
      }).catch(function () { /* offline: leave the cache as it is */ });
    })).then(function () { var out = {}; ids.forEach(function (id) { var h = MB[scope + '|' + id]; out[id] = h ? h.d : undefined; }); return out; });
  }
  function mbSummary(d) {
    if (!d || !d.listings) return null;
    var l = d.listings[0], hist = d.recentHistory || [], avg = hist.length ? Math.round(hist.reduce(function (a, x) { return a + x.pricePerUnit; }, 0) / hist.length) : Math.round(d.averagePrice || 0);
    return { min: l ? l.pricePerUnit : null, hq: l ? l.hq : false, world: l ? (l.worldName || d.worldName || '') : '', avg: avg, vel: d.regularSaleVelocity || 0, upd: d.lastUploadTime || 0, count: (d.listings || []).length };
  }
  function gil(n) { return n == null ? '—' : Number(n).toLocaleString() + ' gil'; }
  function untradable(k) { var l = (typeof infoLines === 'function' ? infoLines(k) : [])[0] || ''; return /untradable/.test(l); }
  function marketLineHtml(k, e) {
    if (!e.it || untradable(k)) return '';
    var inList = UI.live.mlist.indexOf(k) >= 0;
    setTimeout(fillMarketLines, 0);
    return '<div class="mb-line" data-mb="' + e.it + '">' + (mbScope() ? '<b>Market board:</b> <span class="dim">checking prices in ' + esc(scopeLabel()) + '…</span>' : '<b>Market board:</b> <span class="dim">choose your data center on Live → Market Board to see prices</span>') + '</div>' +
      '<div><button type="button" class="btn sm ghost" data-mbadd="' + esc(k) + '">' + (inList ? '✓ On the shopping list' : 'Add to the shopping list') + '</button></div>';
  }
  function fillMarketLines() {
    var els = $$('[data-mb]:not([data-mb-done])'); if (!els.length || !mbScope()) return;
    var ids = els.map(function (x) { return +x.dataset.mb; });
    mbFetch(ids).then(function (res) {
      els.forEach(function (el) {
        el.dataset.mbDone = '1'; var d = res[+el.dataset.mb], s = mbSummary(d);
        el.innerHTML = '<b>Market board (' + esc(scopeLabel()) + '):</b> ' + (d === undefined ? '<span class="dim">no connection</span>' : !s ? '<span class="dim">not sold on the market board, or no data</span>' : s.min == null ? '<span class="dim">no listings now</span> · recent sales about ' + gil(s.avg) :
          'from ' + gil(s.min) + (s.hq ? ' (HQ)' : '') + (s.world ? ' on ' + whereSold(s.world) : '') + ' · recent sales about ' + gil(s.avg) + ' · ' + s.vel.toFixed(1) + ' sold a day <span class="dim">· updated ' + (s.upd ? ago(s.upd) : 'unknown') + '</span>');
      });
    });
  }
  function itemEntries() { var out = []; IDX.byKey.forEach(function (h, k) { if (h.e.it) out.push([k, h.e.n, h.s.t]); }); return out; }
  var ITEM_ENTRIES = null;
  function renderMarket() {
    var L = UI.live, scope = mbScope(), q = (L.mq || '').trim().toLowerCase();
    if (!ITEM_ENTRIES) ITEM_ENTRIES = itemEntries();
    var found = q.length >= 2 ? ITEM_ENTRIES.filter(function (x) { return x[1].toLowerCase().indexOf(q) >= 0 && !untradable(x[0]); }).slice(0, 25) : [];
    var seen = {}; found = found.filter(function (x) { var it = IDX.byKey.get(x[0]).e.it; if (seen[it]) return false; seen[it] = 1; return true; });
    var tools = '<div class="lv-tools">' + placeSel(L.mscope === 'world', 'choose') + '<label class="lv-sel">Prices from <select data-live="mscope"><option value="region"' + (L.mscope === 'region' ? ' selected' : '') + '>all of ' + esc(regionOf(L.dc) || 'the region') + '</option><option value="dc"' + (L.mscope === 'dc' ? ' selected' : '') + '>my data center</option><option value="world"' + (L.mscope === 'world' ? ' selected' : '') + '>one world</option></select></label><button type="button" class="btn sm ghost" data-mbrefresh="1">Refresh prices</button></div>';
    var search = '<div class="lv-tools"><label class="lv-sel">Find an item <input class="inp" data-mbq="1" value="' + esc(L.mq || '') + '" placeholder="Any collectable, recipe or gathered item in the tracker"></label></div>' +
      (found.length ? '<div class="mb-found">' + found.map(function (x) { var on = L.mlist.indexOf(x[0]) >= 0; return '<div class="lv-row"><b>' + esc(x[1]) + '</b><span class="dim">' + esc(x[2]) + '</span><span></span><span></span><span></span><button type="button" class="btn sm' + (on ? ' ghost' : '') + '" data-mbadd="' + esc(x[0]) + '">' + (on ? '✓ Added' : 'Add') + '</button></div>'; }).join('') + '</div>' : (q.length >= 2 ? '<p class="dim">No tradeable item in the tracker matches.</p>' : ''));
    var list = L.mlist.filter(function (k) { return IDX.byKey.has(k); });
    var table = list.length ? '<div class="mb-head"><span>Item</span><span>Qty</span><span>Cheapest now</span><span>Recent sales</span><span>Sold a day</span><span>Updated</span><span></span></div>' + list.map(function (k) {
      var e = IDX.byKey.get(k).e, h = scope && MB[scope + '|' + e.it], s = h && mbSummary(h.d);
      return '<div class="mb-row" data-mbrow="' + esc(k) + '"><span>' + rowName(k) + '</span><span><input class="inp qty" type="number" min="1" value="' + (L.mqty[k] || 1) + '" data-mbqty="' + esc(k) + '"></span><span>' + (!h ? '<span class="dim">…</span>' : !s ? '<span class="dim">no data</span>' : s.min == null ? '<span class="dim">no listings</span>' : gil(s.min) + (s.hq ? ' HQ' : '') + ' <span class="dim">' + whereSold(s.world) + '</span>') + '</span><span>' + (s ? gil(s.avg) : '') + '</span><span>' + (s ? s.vel.toFixed(1) : '') + '</span><span class="dim">' + (s && s.upd ? ago(s.upd) : '') + '</span><button type="button" class="btn sm ghost" data-mbdel="' + esc(k) + '">Remove</button></div>';
    }).join('') : '<p class="dim">The shopping list is empty. Find items above, or use "Add to the shopping list" in any entry\'s details.</p>';
    var total = 0, priced = 0; list.forEach(function (k) { var e = IDX.byKey.get(k).e, h = scope && MB[scope + '|' + e.it], s = h && mbSummary(h.d); if (s && s.min != null) { total += s.min * (L.mqty[k] || 1); priced++; } });
    $('#page').innerHTML = liveHead('Market Board', 'Live market prices from Universalis, a community site that collects what players\' game clients report. By default the whole region is searched (every data center you can travel to), and each price says which world and data center it is on. Prices can be minutes to hours old ("updated" shows when someone last saw that item). Entries in the tracker also show their price in their details.', '') + tools + search +
      '<h3 class="lv-h">Shopping list' + (list.length ? ' <span class="dim">· ' + esc(scopeLabel()) + ' · about ' + gil(total) + ' at the cheapest listing' + (priced < list.length ? ' (' + priced + ' of ' + list.length + ' priced)' : '') + '</span>' : '') + '</h3>' + (scope ? '' : '<p class="lv-guide">Choose your data center to see prices.</p>') + table;
    if (scope && list.length) {
      var ids = list.map(function (k) { return IDX.byKey.get(k).e.it; }), need = ids.some(function (id) { var h = MB[scope + '|' + id]; return !h || Date.now() - h.at > MB_TTL; });
      if (need) mbFetch(ids).then(function () { if (UI.view === 'market') renderMarket(); });
    }
  }

  // ---- Housing (PaissaDB: open plots reported by players with the PaissaHouse plugin)
  var HOUSE = {}, PLOT_SIZE = ['Small', 'Medium', 'Large'];
  UI.live = Object.assign({ hsize: '', hwho: '', hphase: '' }, UI.live);
  function whoCanBuy(ps) { return (ps & 2) && (ps & 4) ? 'Anyone' : ps & 2 ? 'Free companies' : ps & 4 ? 'Individuals' : '—'; }
  function phaseText(p) { return !p.lotto_phase ? 'Phase unknown' : p.lotto_phase === 1 ? 'Taking entries' + (p.lotto_entries != null ? ' · ' + p.lotto_entries + ' entr' + (p.lotto_entries === 1 ? 'y' : 'ies') : '') : p.lotto_phase === 2 ? 'Results' : 'Not taking entries'; }
  function renderHousing() {
    var L = UI.live, w = curWorld(), now = Date.now();
    var tools = '<div class="lv-tools">' + placeSel(true) +
      '<label class="lv-sel">Size <select data-live="hsize"><option value="">Any</option>' + PLOT_SIZE.map(function (s, i) { return '<option value="' + i + '"' + (String(L.hsize) === String(i) ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label class="lv-sel">For <select data-live="hwho"><option value="">Anyone</option><option value="4"' + (L.hwho === '4' ? ' selected' : '') + '>Individuals</option><option value="2"' + (L.hwho === '2' ? ' selected' : '') + '>Free companies</option></select></label>' +
      '<label class="lv-chk"><input type="checkbox" data-live="hphase"' + (L.hphase ? ' checked' : '') + '> Taking entries now</label></div>';
    var head = liveHead('Housing', 'Open plots on your world, from PaissaDB: players running the PaissaHouse plugin report the plots they see, so a plot can already be gone, and entry counts appear only when someone has looked at the placard. Ward and plot numbers are as the game shows them.', '');
    if (!w) { $('#page').innerHTML = head + tools + '<p class="lv-guide">Choose your data center and world.</p>'; return; }
    var h = HOUSE[w[0]];
    if (!h || now - h.at > 5 * 60000) {
      if (!h || !h.loading) {
        HOUSE[w[0]] = { at: h ? h.at : 0, d: h ? h.d : null, loading: true };
        fetch('https://paissadb.zhu.codes/worlds/' + w[0]).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { HOUSE[w[0]] = { at: Date.now(), d: j }; if (UI.view === 'housing') renderHousing(); })
          .catch(function () { HOUSE[w[0]] = { at: Date.now(), d: h ? h.d : null, err: true }; if (UI.view === 'housing') renderHousing(); });
      }
      if (!h || !h.d) { $('#page').innerHTML = head + tools + '<p class="dim">Loading open plots on ' + esc(w[1]) + '…</p>'; return; }
    }
    if (!h.d) { $('#page').innerHTML = head + tools + '<p class="dim">PaissaDB could not be reached. Try again later.</p>'; return; }
    var body = (h.d.districts || []).map(function (d) {
      var plots = (d.open_plots || []).filter(function (p) { return (L.hsize === '' || L.hsize == null || p.size === +L.hsize) && (!L.hwho || (p.purchase_system & +L.hwho)) && (!L.hphase || p.lotto_phase === 1); })
        .sort(function (a, b) { return b.size - a.size || a.ward_number - b.ward_number || a.plot_number - b.plot_number; });
      return '<h3 class="lv-h">' + esc(d.name) + ' <span class="dim">(' + plots.length + ' shown of ' + d.num_open_plots + ' open)</span></h3>' + (plots.length ? '<div class="hs-head"><span>Ward</span><span>Plot</span><span>Size</span><span>Price</span><span>For</span><span>Lottery</span><span>Seen</span></div>' + plots.map(function (p) {
        return '<div class="hs-row s' + p.size + '"><span>' + (p.ward_number + 1) + '</span><span>' + (p.plot_number + 1) + '</span><span>' + (PLOT_SIZE[p.size] || '?') + '</span><span>' + gil(p.price) + '</span><span>' + whoCanBuy(p.purchase_system) + '</span><span>' + phaseText(p) + (p.lotto_phase_until ? ' <span class="dim">until ' + esc(new Date(p.lotto_phase_until * 1000).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</span>' : '') + '</span><span class="dim">' + (p.last_updated_time ? ago(p.last_updated_time * 1000) : '') + '</span></div>';
      }).join('') : '');
    }).join('');
    $('#page').innerHTML = head + tools + '<p class="dim">' + esc(w[1]) + ': ' + (h.d.num_open_plots || 0) + ' open plots · checked ' + ago(h.at) + '</p>' + body;
  }

  // ---- News (the Lodestone's official news and topics feeds, saved by the public site every 6 hours)
  var NEWS = null, NEWS_SEEN = store('eveniunt-tracker-news');
  function parseFeed(xml, cat) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    return Array.prototype.slice.call(doc.getElementsByTagName('entry')).map(function (e) {
      var t = e.getElementsByTagName('title')[0], l = e.getElementsByTagName('link')[0], d = e.getElementsByTagName('published')[0] || e.getElementsByTagName('updated')[0];
      var href = l ? l.getAttribute('href') || '' : '';
      return { title: t ? t.textContent.trim() : '', link: /^https:\/\/(na|eu|jp|fr|de)\.finalfantasyxiv\.com\//.test(href) ? href : '', at: d ? Date.parse(d.textContent) || 0 : 0, cat: cat };
    }).filter(function (x) { return x.title; });
  }
  function loadNews() {
    if (!HOSTED || !window.fetch) return;
    Promise.all(['news', 'topics'].map(function (f) { return fetch(f + '.xml', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) { return t ? parseFeed(t, f) : []; }).catch(function () { return []; }); }))
      .then(function (r) {
        if (!r[0].length && !r[1].length) return;
        NEWS = { news: r[0], topics: r[1], at: Date.now() };
        var newest = Math.max.apply(null, r[0].concat(r[1]).map(function (x) { return x.at; })), seen = NEWS_SEEN.max || 0, N = UI.live.notify;
        if (seen && N.on && N.news && N.news !== 'off') r[0].concat(r[1]).filter(function (x) { return x.at > seen && (N.news === 'all' || /maintenance/i.test(x.title)); }).slice(0, 3).forEach(function (x) { notifyNow('Lodestone: ' + x.title, x.cat === 'topics' ? 'Topics' : 'News'); });
        if (newest > seen) { NEWS_SEEN.max = newest; NEWS_SEEN.save(); }
        if (UI.view === 'news') renderNews();
      });
  }
  loadNews(); setInterval(loadNews, 30 * 60000);
  function renderNews() {
    function list(items) { return items.map(function (x) { var m = /maintenance/i.test(x.title); return '<div class="nw-row' + (m ? ' maint' : '') + '"><span class="dim">' + (x.at ? esc(new Date(x.at).toLocaleDateString([], { month: 'short', day: 'numeric' })) : '') + '</span>' + (x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>' : '<span>' + esc(x.title) + '</span>') + (m ? '<span class="lv-badge">Maintenance</span>' : '<span></span>') + '</div>'; }).join(''); }
    $('#page').innerHTML = liveHead('News', 'The latest Lodestone news (maintenance, notices, updates) and topics, from the official feeds. The public site saves a fresh copy every 6 hours; titles open the Lodestone.', '') +
      (NEWS ? '<div class="nw-cols"><div><h3 class="lv-h">News</h3>' + list(NEWS.news) + '</div><div><h3 class="lv-h">Topics</h3>' + list(NEWS.topics) + '</div></div><p class="dim">Read ' + ago(NEWS.at) + '.</p>' :
        '<p class="lv-guide">' + (HOSTED ? 'Loading the Lodestone news…' : 'The news appears on the hosted tracker (splitzhappen.github.io), which saves the Lodestone feeds every 6 hours. A copy opened from a file cannot read them.') + '</p>');
  }

  // ---- page plumbing
  var LIVE_RENDER = { now: renderNow, dailies: renderDailies, bigfish: renderBigFish, srank: renderSRank, ocean: renderOcean, island: renderIsland, timers: renderTimers, weather: function () { renderWeather(); }, field: renderField, gold: renderGold, pvp: renderPvp, leveling: renderLeveling, notify: renderNotify, hunts: renderHunts, market: renderMarket, housing: renderHousing, news: renderNews };
  function isLive(v) { return Object.prototype.hasOwnProperty.call(LIVE_RENDER, v); }
  function liveTick() {
    var now = Date.now();
    $$('#page .cd[data-at]').forEach(function (el) { var at = +el.dataset.at; el.textContent = at > now ? dur(at - now) : 'now'; });
    $$('#page [data-et]').forEach(function (el) { el.textContent = etText(now); });
    $$('#page [data-lt]').forEach(function (el) { el.textContent = lt(now); });
  }
  setInterval(function () { if (isLive(UI.view) && UI.view !== 'weather') liveTick(); }, 1000);
  setInterval(function () { if (isLive(UI.view) && UI.view !== 'weather' && UI.view !== 'notify' && !document.querySelector('#page select:focus, #page input:focus')) LIVE_RENDER[UI.view](); }, 30000);
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.live) { UI.live[t.dataset.live] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.live === 'dc' && !curWorld()) UI.live.world = ''; liveSave(); LIVE_RENDER[UI.view] && LIVE_RENDER[UI.view](); }
    if (t.dataset && t.dataset.notify) { var N = UI.live.notify; N[t.dataset.notify] = t.type === 'checkbox' ? t.checked : t.value; liveSave(); }
    if (t.dataset && t.dataset.notifyGate) { UI.live.notify.gates[t.dataset.notifyGate] = t.checked; liveSave(); }
    if (t.dataset && t.dataset.mbqty) { UI.live.mqty[t.dataset.mbqty] = Math.max(1, parseInt(t.value, 10) || 1); liveSave(); renderMarket(); }
    if (t.dataset && t.dataset.isle) { UI.live.isle[t.dataset.isle] = +t.value; liveSave(); renderIsland(); }
    if (t.dataset && t.dataset.islePop) { UI.live.isle.pop[t.dataset.islePop] = t.value; liveSave(); renderIsland(); var dd = $('.isle-details'); if (dd) dd.open = true; }
    if (t.dataset && t.dataset.isleSup) { UI.live.isle.sup[t.dataset.isleSup] = t.value; liveSave(); renderIsland(); var de = $('.isle-details'); if (de) de.open = true; }
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-watch],[data-ltick],[data-live-zone],[data-live-el],[data-notify-perm],[data-notify-test],[data-live-view],[data-dl],[data-isle-reset],[data-hworld],[data-hex],[data-hkill],[data-hkill-at],[data-hkill-clear],[data-hmap],[data-hpt],[data-hpt-clear],[data-hmaint],[data-hboss],[data-hboss-clear],[data-mbadd],[data-mbdel],[data-mbrefresh]');
    if (!b) return;
    if (b.dataset.liveView) { ev.preventDefault(); setView(b.dataset.liveView); return; }
    var world = curWorld() ? curWorld()[1] : null, nowc = Date.now();
    if (b.dataset.hworld) { UI.live.world = b.dataset.hworld; liveSave(); renderHunts(); return; }
    if (b.dataset.hex) { UI.live.hex = b.dataset.hex; UI.live.hmap = ''; liveSave(); renderHunts(); return; }
    if (b.dataset.hmap) { UI.live.hmap = UI.live.hmap === b.dataset.hmap ? '' : b.dataset.hmap; liveSave(); renderHunts(); return; }
    if (b.dataset.hkill && world) { (HST.kills[world] = HST.kills[world] || {})[b.dataset.hkill] = nowc; clearPoints(world, b.dataset.hkill); HST.save(); renderHunts(); toast(b.dataset.hkill + ' recorded as killed on ' + world); return; }
    if (b.dataset.hkillAt && world) {
      var txt = prompt('When did ' + b.dataset.hkillAt + ' die? Type minutes ago (for example 25), or a date and time (for example 2026-11-09 14:30).', '');
      if (txt == null || !txt.trim()) return;
      var at = /^\d+$/.test(txt.trim()) ? nowc - parseInt(txt, 10) * 60000 : Date.parse(txt.trim().replace(' ', 'T'));
      if (!at || isNaN(at) || at > nowc) { toast('Could not read that time'); return; }
      (HST.kills[world] = HST.kills[world] || {})[b.dataset.hkillAt] = at; HST.save(); renderHunts(); return;
    }
    if (b.dataset.hkillClear && world) { delete (HST.kills[world] || {})[b.dataset.hkillClear]; HST.save(); renderHunts(); return; }
    if (b.dataset.hpt && world) { var pp = b.dataset.hpt.split('|'), zp = ((HST.pts[world] = HST.pts[world] || {})[pp[0]] = (HST.pts[world][pp[0]] || [])), ix = zp.indexOf(+pp[1]); if (ix >= 0) zp.splice(ix, 1); else zp.push(+pp[1]); HST.save(); renderHunts(); return; }
    if (b.dataset.hptClear && world) { delete (HST.pts[world] || {})[b.dataset.hptClear]; HST.save(); renderHunts(); return; }
    if (b.dataset.hmaint) {
      var mtxt = prompt('When did the servers come back after maintenance? A date and time, for example 2026-11-10 08:00 (your time). Leave empty to use the events list.', HST.maint ? new Date(HST.maint).toLocaleString() : '');
      if (mtxt == null) return; if (!mtxt.trim()) { HST.maint = null; } else { var mm = Date.parse(mtxt.trim().replace(' ', 'T')); if (!mm || isNaN(mm)) { toast('Could not read that time'); return; } HST.maint = mm; }
      HST.save(); renderHunts(); return;
    }
    if (b.dataset.hboss && world) { (HST.boss[world] = HST.boss[world] || {})[b.dataset.hboss] = nowc; HST.save(); renderHunts(); return; }
    if (b.dataset.hbossClear && world) { delete (HST.boss[world] || {})[b.dataset.hbossClear]; HST.save(); renderHunts(); return; }
    if (b.dataset.mbadd) { var ml = UI.live.mlist, mk = b.dataset.mbadd; if (ml.indexOf(mk) < 0) ml.push(mk); liveSave(); b.textContent = '✓ On the shopping list'; toast(nameOf(mk) + ' added to the shopping list (Live → Market Board)'); if (UI.view === 'market') renderMarket(); return; }
    if (b.dataset.mbdel) { UI.live.mlist = UI.live.mlist.filter(function (x) { return x !== b.dataset.mbdel; }); liveSave(); renderMarket(); return; }
    if (b.dataset.mbrefresh) { MB = {}; renderMarket(); return; }
    if (b.dataset.isleReset) { UI.live.isle.pop = {}; UI.live.isle.sup = {}; liveSave(); renderIsland(); return; }
    if (b.dataset.dl) {
      var parts = b.dataset.dl.split('|'), cid = parts[0], task = (LIVE.guides.dailies || []).find(function (x) { return x[0] === parts[1]; }), nowd = Date.now();
      var cur = dGet(cid, task, nowd), st = (DSTATE[cid] = DSTATE[cid] || {});
      if (task[2] === 'map') st[task[0]] = cur.n ? null : { n: 1, at: nowd };
      else st[task[0]] = cur.n >= task[3] ? null : { n: cur.n + 1, at: nowd };
      if (!st[task[0]]) delete st[task[0]];
      dSave(); renderDailies(); return;
    }
    if (b.dataset.watch) { var w = UI.live.watch, k = b.dataset.watch, i = w.indexOf(k); if (i >= 0) w.splice(i, 1); else w.push(k); liveSave(); var on = i < 0; $$('[data-watch="' + CSS.escape(k) + '"]').forEach(function (x) { x.classList.toggle('on', on); x.textContent = on ? '★' : '☆'; }); toast(on ? 'Watching ' + nameOf(k) + ' for notifications' : 'No longer watching ' + nameOf(k)); return; }
    if (b.dataset.ltick) { var c = liveChar(), kk = b.dataset.ltick; ET.setTick(ST, c, kk, !ST.ticks[c][kk]); save(); staleTallies([kk]); renderSide(); LIVE_RENDER[UI.view](); return; }
    if (b.dataset.liveZone) { UI.live.zone = b.dataset.liveZone; liveSave(); renderField(); return; }
    if (b.dataset.liveEl) { UI.live.el = b.dataset.liveEl; liveSave(); renderField(); return; }
    if (b.dataset.notifyPerm) { Notification.requestPermission().then(function () { renderNotify(); }); return; }
    if (b.dataset.notifyTest) { notifyNow('Eveniunt Tracker', 'Notifications are working'); return; }
  });
