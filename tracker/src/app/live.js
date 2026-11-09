  // ── Live pages: Up Now, Big Fish, Ocean Fishing, Timers & Events, Field Monsters, Gold Saucer, Notifications ──
  // Everything here is worked out in the page from data/live.json and data/conditions.json (no connection needed),
  // except the optional fresh copy of the events list on the hosted site.
  var LIVE = (function () { try { return JSON.parse(document.getElementById('live-data').textContent); } catch (err) { return null; } })() ||
    { bigfish: [], ocean: null, field: { zones: {}, challenge: [], events: {}, weatherZone: {} }, timers: { timers: [] }, guides: {}, gate: [] };
  var LIVE_VIEWS = [['now', 'Up Now'], ['bigfish', 'Big Fish'], ['ocean', 'Ocean Fishing'], ['timers', 'Timers & Events'], ['weather', 'Weather'],
    ['field', 'Field Monsters'], ['gold', 'Gold Saucer'], ['notify', 'Notifications']];
  var NOTIFY_DEFAULT = {
    on: false, browser: true, sound: true, toast: true, lead: 5,
    bigfish: 'missing', bigfishLead: 10, legendaryOnly: false,
    vistas: false, nodes: 'watched', fish: 'watched',
    ocean: 'missing', oceanLead: 10,
    daily: true, weekly: true, gc: false, fashion: false,
    gate: false, gates: {}, gateLead: 2,
    events: true, fieldNm: false
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
    return (WCACHE[id] = windowsOf(c, now, count || 3));
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
    $('#page').innerHTML = liveHead('Timers & Events', 'Game resets, the next GATE and ocean fishing boat, and the seasonal events and maintenance announced on the Lodestone (from Xenoveritas\' timer list' + (FRESH_TIMERS ? ', fresh copy' : ', as of ' + esc(LIVE.timers.fetched || 'the build')) + '). All times are in your time zone.', '') +
      '<h3 class="lv-h">Resets</h3>' + rs + '<h3 class="lv-h">Gold Saucer and ocean fishing</h3>' + other + '<h3 class="lv-h">Seasonal events and maintenance</h3>' + (ev || '<p class="dim">Nothing announced right now.</p>');
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
      return '<div class="fm-row' + (live ? ' now' : '') + '"><span><b>' + esc(m.n) + '</b>' + (m.area ? ' <span class="dim">' + esc(m.area) + '</span>' : '') + (m.clan ? ' <span class="dim">· ' + esc(m.clan) + '</span>' : '') + (drops.length ? '<br><span class="dim">Drops: ' + esc(drops.join(', ')) + '</span>' : '') + '</span><span>' + esc(m.rank || m.lv || '') + '</span><span>' + (m.x != null ? '(' + m.x + ', ' + m.y + ')' : '') + '</span><span>' + esc(occult ? (m.weak || '') : (m.el || '')) + '</span><span>' + esc(m.spawn || 'always') + (m.rule ? ' <span class="dim" title="Not documented for this monster; Zadnor documents this rule for the same kind of monster">(usual rule)</span>' : '') + (live ? ' <b class="up">now</b>' : '') + (m.aggro ? ' <span class="dim">· aggro: ' + esc(m.aggro) + '</span>' : '') + '</span></div>';
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
    if (N.fieldNm) Object.keys(LIVE.field.events).forEach(function (n) {
      var e = LIVE.field.events[n]; if (!e.spawn || e.spawn === 'Automatic') return;
      Object.keys(LIVE.field.zones).forEach(function (z) {
        var m = LIVE.field.zones[z].find(function (x) { return x.spawn && norm(x.n) === norm(e.spawn.replace(/^Lv\. \d+ /, '')); });
        if (m && spawnNow(m.spawn, LIVE.field.weatherZone[z] || z, now)) fireOnce('nm:' + n + ':' + periodStart(now), now, 0, n + ' can be triggered', m.n + ' is out (' + m.spawn + ') in ' + z);
      });
    });
    var cut = now - 3 * 86400000; Object.keys(FIRED).forEach(function (k) { if (FIRED[k] < cut) delete FIRED[k]; });
    try { localStorage.setItem('eveniunt-tracker-fired', JSON.stringify(FIRED)); } catch (e) { /* private window */ }
  }
  setInterval(notifyTick, 15000);

  // ---- page plumbing
  var LIVE_RENDER = { now: renderNow, bigfish: renderBigFish, ocean: renderOcean, timers: renderTimers, weather: function () { renderWeather(); }, field: renderField, gold: renderGold, notify: renderNotify };
  function isLive(v) { return Object.prototype.hasOwnProperty.call(LIVE_RENDER, v); }
  function liveTick() {
    var now = Date.now();
    $$('#page .cd[data-at]').forEach(function (el) { var at = +el.dataset.at; el.textContent = at > now ? dur(at - now) : 'now'; });
    $$('#page [data-et]').forEach(function (el) { el.textContent = etText(now); });
    $$('#page [data-lt]').forEach(function (el) { el.textContent = lt(now); });
  }
  setInterval(function () { if (isLive(UI.view) && UI.view !== 'weather') liveTick(); }, 1000);
  setInterval(function () { if (isLive(UI.view) && UI.view !== 'weather' && UI.view !== 'notify' && !document.querySelector('#page select:focus')) LIVE_RENDER[UI.view](); }, 30000);
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.live) { UI.live[t.dataset.live] = t.type === 'checkbox' ? t.checked : t.value; liveSave(); LIVE_RENDER[UI.view] && LIVE_RENDER[UI.view](); }
    if (t.dataset && t.dataset.notify) { var N = UI.live.notify; N[t.dataset.notify] = t.type === 'checkbox' ? t.checked : t.value; liveSave(); }
    if (t.dataset && t.dataset.notifyGate) { UI.live.notify.gates[t.dataset.notifyGate] = t.checked; liveSave(); }
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-watch],[data-ltick],[data-live-zone],[data-live-el],[data-notify-perm],[data-notify-test],[data-live-view]');
    if (!b) return;
    if (b.dataset.liveView) { ev.preventDefault(); setView(b.dataset.liveView); return; }
    if (b.dataset.watch) { var w = UI.live.watch, k = b.dataset.watch, i = w.indexOf(k); if (i >= 0) w.splice(i, 1); else w.push(k); liveSave(); var on = i < 0; $$('[data-watch="' + CSS.escape(k) + '"]').forEach(function (x) { x.classList.toggle('on', on); x.textContent = on ? '★' : '☆'; }); toast(on ? 'Watching ' + nameOf(k) + ' for notifications' : 'No longer watching ' + nameOf(k)); return; }
    if (b.dataset.ltick) { var c = liveChar(), kk = b.dataset.ltick; ET.setTick(ST, c, kk, !ST.ticks[c][kk]); save(); staleTallies([kk]); renderSide(); LIVE_RENDER[UI.view](); return; }
    if (b.dataset.liveZone) { UI.live.zone = b.dataset.liveZone; liveSave(); renderField(); return; }
    if (b.dataset.liveEl) { UI.live.el = b.dataset.liveEl; liveSave(); renderField(); return; }
    if (b.dataset.notifyPerm) { Notification.requestPermission().then(function () { renderNotify(); }); return; }
    if (b.dataset.notifyTest) { notifyNow('Eveniunt Tracker', 'Notifications are working'); return; }
  });
