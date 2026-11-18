// Eveniunt Command Center, Submersibles: worked-out voyages and the route advisor.
// - A build's five stats: its four parts plus the rank's bonus (game data).
// - A route's range used, voyage time, ceruleum tanks and base experience, by the community formula in
//   data/submarines.json ('formula', from Submarine Tracker, MIT; "calculated, not yet confirmed" until the owner's
//   game times agree). Base experience is a floor (the data's formula.experienceNote), so the rank after is "at least".
// - The advisor: one suggested route for a sub, following the owner's priority order (owner, 2026-11-11):
//     1. unlock every submarine slot of the free company, 2. discover every sector, 3. farm gil.
//   Levelling is not a step of its own: when rank (or range, which rank raises) is what stops the next unlock, the
//   advisor picks the route with the most experience per hour and says what it is levelling towards.
//   Parts are suggested only at step 3.
// Plain script: attaches to globalThis.ADVISOR, so it runs in the browser and in Node tests. Reads nothing from the game.
(function () {
  'use strict';
  var A = (globalThis.ADVISOR = globalThis.ADVISOR || {});
  var D = null, SECTOR = {}, SEA = {}, PART = {}, CLASS = {}, RANK = {}, CHILD = {}, TOP = 145;
  var STATS = ['surveillance', 'retrieval', 'speed', 'range', 'favor'];

  A.init = function (data) {
    D = data; SECTOR = {}; SEA = {}; PART = {}; CLASS = {}; RANK = {}; CHILD = {};
    data.sectors.forEach(function (s) { SECTOR[s.id] = s; });
    data.seas.forEach(function (s) { SEA[s.id] = s; });
    data.parts.forEach(function (p) { PART[p.id] = p; });
    data.classes.forEach(function (c) { CLASS[c.id] = c; });
    data.ranks.forEach(function (r) { RANK[r.rank] = r; });
    TOP = data.ranks[data.ranks.length - 1].rank;
    Object.keys(data.unlocks).forEach(function (k) { var u = data.unlocks[k]; if (u.by) (CHILD[u.by] = CHILD[u.by] || []).push(+k); });
    return A;
  };
  A.LABEL = function () { return D ? D.formula.label : 'calculated'; };
  A.top = function () { return TOP; }; // the top rank: the last row of the data's ranks, never a typed number

  // ------------------------------------------------------------------ builds and voyages (game data + community formula)
  A.stats = function (rank, parts) {
    if (!RANK[rank] || !parts || parts.length !== 4 || !parts.every(function (p) { return PART[p]; })) return null;
    var out = {};
    STATS.forEach(function (k) { out[k] = parts.reduce(function (t, p) { return t + PART[p][k]; }, 0) + RANK[rank][k + 'Bonus']; });
    return out;
  };
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
  // { range, reachable, seconds, tanks, exp } for a route of 1 to 5 sectors of one sea; null if the route is not valid.
  A.evalRoute = function (route, st) {
    if (!route || !route.length || route.length > D.formula.maxSectors || !st) return null;
    var first = SECTOR[route[0]]; if (!first) return null;
    var F = D.formula, v = Math.max(st.speed, F.minSpeed), prev = SEA[first.sea], range = 0, secs = 0, tanks = 0, exp = 0;
    for (var i = 0; i < route.length; i++) {
      var s = SECTOR[route[i]]; if (!s || s.sea !== first.sea) return null;
      var l = dist(prev, s);
      range += Math.floor(l * F.distanceFactor) + s.surveyDistance;
      secs += Math.floor(l * F.travelFactor / (v * 100) * 60) + Math.floor(s.survey * F.surveyFactor / (v * 100) * 60);
      tanks += s.tanks; exp += s.exp; prev = s;
    }
    return { range: range, maxRange: st.range, reachable: range <= st.range, seconds: secs + F.fixedSeconds, tanks: tanks, exp: exp };
  };
  // The experience between two points (rank, experience into it): what a voyage really gave when the owner types the rank
  // and progress the game shows afterwards. null when the points are inconsistent (going backwards, an unknown rank, or
  // more experience into a rank than that rank needs to go up: a point the game cannot show).
  A.expBetween = function (r1, i1, r2, i2) {
    if (!RANK[r1] || !RANK[r2] || r2 < r1) return null;
    if ((i1 || 0) < 0 || (i2 || 0) < 0 || (i1 || 0) >= RANK[r1].expToNext || (i2 || 0) >= RANK[r2].expToNext) return null;
    var e = -(i1 || 0);
    for (var r = r1; r < r2; r++) { if (!RANK[r]) return null; e += RANK[r].expToNext; }
    e += (i2 || 0);
    return e >= 0 ? e : null;
  };
  A.expToNext = function (rank) { return RANK[rank] ? RANK[rank].expToNext : null; };
  // Learning the bonus (owner request 2026-11-15): from voyages where the owner typed the rank and progress the game shows,
  // the experience really gained divided by the route's base experience, per voyage grade (C, B, A, S, SS). The middle
  // value (median) of each grade is used, so one mistyped voyage does not pull the estimate; factors outside 0.5 to 4 are
  // treated as typing slips and ignored. With nothing learned for a grade the estimate stays the base ("at least"). The base
  // is a floor, so a grade whose middle value is below 1 is used, and shown, as 1 (factorFor).
  A.GRADES = ['C', 'B', 'A', 'S', 'SS'];
  A.learn = function (trips) {
    var by = {}, all = [];
    (trips || []).forEach(function (t) {
      if (!t || !(t.expBase > 0) || !(t.expGot > 0)) return;
      var f = t.expGot / t.expBase; if (!(f >= 0.5 && f <= 4)) return;
      all.push(f); if (A.GRADES.indexOf(t.grade) >= 0) (by[t.grade] = by[t.grade] || []).push(f);
    });
    var med = function (a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
    var out = { n: all.length, overall: all.length ? med(all) : 1, grades: {} };
    Object.keys(by).forEach(function (g) { out.grades[g] = { factor: med(by[g]), n: by[g].length }; });
    return out;
  };
  A.factorFor = function (learned, grade) { var g = learned && grade && learned.grades[grade]; return g ? Math.max(1, g.factor) : 1; };
  // a progress the game cannot show at that rank (an old or edited save) is unknown: counted as 0 ("at least"), never
  // carried into an estimate
  A.rankAfter = function (rank, into, exp) {
    var i0 = into || 0; if (RANK[rank] && (i0 < 0 || i0 >= RANK[rank].expToNext)) i0 = 0;
    var r = rank, e = i0 + exp;
    while (r < TOP && RANK[r] && e >= RANK[r].expToNext) { e -= RANK[r].expToNext; r += 1; }
    return { rank: r, into: e };
  };

  // The rank and experience a sub reaches when a voyage on this route ends: base experience only, so "at least"
  // (formula.experienceNote). null without a route or a rank.
  A.afterVoyage = function (sub, route) {
    if (!sub || !RANK[sub.rank] || !route || !route.length) return null;
    var exp = route.reduce(function (t, id) { return t + (SECTOR[id] ? SECTOR[id].exp : 0); }, 0);
    var r = A.rankAfter(sub.rank, sub.expIntoRank || 0, exp);
    return { exp: exp, rank: r.rank, into: r.into };
  };

  // ------------------------------------------------------------------ unlocks (community data, Submarine Tracker)
  A.children = function (id) { return CHILD[id] || []; };
  // the chain of sectors from a discovered one down to the target: [discovered ancestor, ..., target]
  function chainTo(target, disc) {
    var path = [target], cur = target, guard = 0;
    while (!disc.has(cur) && guard++ < 200) { var u = D.unlocks[cur]; if (!u || !u.by) return null; cur = u.by; path.unshift(cur); }
    return disc.has(cur) ? path : null;
  }

  // ------------------------------------------------------------------ route search
  // Best routes made of the sectors in pool (visitable: discovered, rank allowed), for score(route, ev) (higher is better),
  // optionally all including one sector. A beam over routes of 1 to 5 sectors per sea: fast enough for 32 subs on a phone.
  // Route evaluations made since the last reset (item R2): the cost figure of spec 4.2, shown as ADVISOR.lastEvals.
  var evals = 0;
  A.lastEvals = 0;
  function counted(route, st) { evals++; return A.evalRoute(route, st); }
  function search(pool, st, score, must, keep) {
    var bySea = {}, out = [];
    pool.forEach(function (s) { (bySea[s.sea] = bySea[s.sea] || []).push(s.id); });
    Object.keys(bySea).forEach(function (sea) {
      var ids = bySea[sea];
      if (must && SECTOR[must].sea !== +sea) return;
      var layer = [[]];
      for (var depth = 0; depth < D.formula.maxSectors; depth++) {
        var next = [];
        layer.forEach(function (r) {
          ids.forEach(function (id) {
            if (r.indexOf(id) >= 0) return;
            var route = r.concat(id), ev = counted(route, st);
            if (!ev || !ev.reachable) return;
            var sc = score(route, ev);
            next.push({ route: route, ev: ev, score: sc });
          });
        });
        next.sort(function (a, b) { return b.score - a.score; });
        next = next.slice(0, keep || 80);
        next.forEach(function (c) { if (!must || c.route.indexOf(must) >= 0) out.push(c); });
        layer = next.map(function (c) { return c.route; });
        if (!layer.length) break;
      }
    });
    out.sort(function (a, b) { return b.score - a.score || a.ev.seconds - b.ev.seconds; });
    var seen = {}, uniq = [];
    out.forEach(function (c) { var k = c.route.slice().sort().join(); if (!seen[k]) { seen[k] = 1; uniq.push(c); } });
    return uniq;
  }
  function hours(ev) { return ev.seconds / 3600; }
  function name(id) { var s = SECTOR[id]; return s ? SEA[s.sea].name + ' ' + s.letter : '?'; }
  A.sectorName = name;
  A.routeText = function (route) { return route && route.length ? SEA[SECTOR[route[0]].sea].name + ': ' + route.map(function (id) { return SECTOR[id].letter; }).join(' → ') : ''; };

  // ------------------------------------------------------------------ the advisor
  // input: { sub: { rank, expIntoRank, parts }, fc: { unlockedSlots, discovered }, slotsFilled (subs registered in this
  //          free company), pending: [sector ids already on other subs' voyages of this free company] }
  // output: { step, stepName, goal, plan: { route, ev, why }, alts: [...], parts: { slot, from, to, why } | null, note }
  //         or { blocked: why } when the sub's rank or parts are missing.
  A.STEPS = ['Unlock all four submarines', 'Discover every sector', 'Farm gil'];
  A.advise = function (input) {
    var sub = input.sub, fc = input.fc;
    var st = A.stats(sub.rank, sub.parts);
    if (!st) return { blocked: 'Enter this sub\'s rank and its four parts in Setup, so its voyages can be worked out.' };
    var disc = new Set(fc.discovered || []), pending = new Set(input.pending || []);
    var pool = D.sectors.filter(function (s) { return disc.has(s.id) && s.rank <= sub.rank; });
    var undiscovered = D.sectors.filter(function (s) { return !disc.has(s.id); });
    var newOf = function (route) { var n = 0, seen = {}; route.forEach(function (id) { if (pending.has(id)) return; A.children(id).forEach(function (c) { if (!disc.has(c) && !seen[c]) { seen[c] = 1; n++; } }); }); return n; };
    if (input.recs && globalThis.RECS) return adviseRecs(input, sub, st, disc, pool, undiscovered, newOf);
    var level = function (towards) {
      var c = search(pool, st, function (r, ev) { return ev.exp / hours(ev); });
      if (!c.length) return null;
      return pack(c, function (x) { return 'Most experience per hour within reach (at least ' + Math.round(x.ev.exp / hours(x.ev)).toLocaleString('en') + ' an hour)' + (towards ? ', ' + towards : '') + '.'; });
    };
    var pack = function (cands, why) {
      return { plan: Object.assign({ why: why(cands[0]) }, cands[0]), alts: cands.slice(1, 3).map(function (x) { return Object.assign({ why: why(x) }, x); }) };
    };
    var out;
    // step 1: unlock all four submarines
    var slots = fc.unlockedSlots || 1;
    if (slots < 4) {
      var target = (D.subSlots.find(function (u) { return u.slot === slots + 1; }) || {}).sector;
      var head = { step: 1, stepName: A.STEPS[0] };
      if ((input.slotsFilled || 0) < slots) head.note = 'A new slot only shows once slot ' + slots + ' holds a submarine: register one there in the game when you can.';
      var chain = target ? chainTo(target, disc) : null;
      var visit = disc.has(target) ? target : chain ? chain[0] : null; // the discovered sector to survey next on the way
      if (visit && SECTOR[visit].rank <= sub.rank) {
        var c1 = search(pool, st, function (r, ev) { return -ev.seconds + newOf(r) * 60; }, visit);
        if (c1.length) {
          out = Object.assign(head, pack(c1, function (x) {
            return visit === target ? 'Surveying ' + name(target) + ' can grant slot ' + (slots + 1) + ' (not certain on every visit). This is the quickest route that includes it.'
              : 'On the way to ' + name(target) + ', which grants slot ' + (slots + 1) + ': surveying ' + name(visit) + ' can reveal ' + name(chain[1]) + '. Quickest route that includes it.';
          }));
          out.goal = 'slot ' + (slots + 1);
          return out;
        }
      }
      var why = visit ? (SECTOR[visit].rank > sub.rank ? 'levelling to rank ' + SECTOR[visit].rank + ' for ' + name(visit) + ' (step 1: slot ' + (slots + 1) + ')' : 'building range for ' + name(visit) + ' (step 1: slot ' + (slots + 1) + '); rank raises range') : null;
      var l1 = level(why);
      if (l1) { out = Object.assign(head, l1); out.goal = 'slot ' + (slots + 1); return out; }
    }
    // step 2: discover every sector
    if (undiscovered.length) {
      var c2 = search(pool, st, function (r, ev) { return newOf(r) * 1e7 - ev.seconds; }).filter(function (x) { return newOf(x.route) > 0; });
      var head2 = { step: 2, stepName: A.STEPS[1], goal: undiscovered.length + ' sectors still to find' };
      if (c2.length) return Object.assign(head2, pack(c2, function (x) { var n = newOf(x.route); return 'Can reveal ' + n + ' new sector' + (n === 1 ? '' : 's') + ' (' + x.route.filter(function (id) { return A.children(id).some(function (c) { return !disc.has(c); }); }).map(name).join(', ') + ' lead to them); quickest of the routes that reveal the most.'; }));
      var parents = D.sectors.filter(function (s) { return disc.has(s.id) && !pending.has(s.id) && A.children(s.id).some(function (c) { return !disc.has(c); }); });
      var need = parents.length ? parents.reduce(function (m, s) { return Math.min(m, s.rank); }, 999) : null;
      var allPending = !parents.length && D.sectors.some(function (s) { return disc.has(s.id) && A.children(s.id).some(function (c) { return !disc.has(c); }); });
      var l2 = level(need && need > sub.rank ? 'levelling to rank ' + need + ' for the next discovery (step 2)' : allPending ? 'while your other subs\' voyages reveal the next sectors (step 2)' : 'building range for the next discovery (step 2); rank raises range');
      if (l2) return Object.assign(head2, l2);
    }
    // step 3: farm gil
    var head3 = { step: 3, stepName: A.STEPS[2], goal: 'gil' };
    var stars = function (r) { return r.reduce(function (t, id) { return t + SECTOR[id].stars; }, 0); };
    var named = (D.commonRoutes || []).filter(function (cr) { return cr.route.every(function (id) { return disc.has(id) && SECTOR[id].rank <= sub.rank; }); })
      .map(function (cr) { var ev = A.evalRoute(cr.route, st); return ev && ev.reachable ? { route: cr.route, ev: ev, label: cr.name, score: stars(cr.route) / hours(ev) } : null; })
      .filter(Boolean).sort(function (a, b) { return b.score - a.score; });
    var c3 = named.length ? named : search(pool, st, function (r, ev) { return stars(r) / hours(ev); });
    // the player's own log (item S6-2): ranked routes this sub can run, by gil per hour for this sub's own build
    var enough = input.enough || 10, logged = input.logged || null, byKey = {};
    (logged || []).forEach(function (l) { byKey[l.route.join(',')] = l; });
    var own = [];
    // routes the part advice weighs: ranked, paying, discovered and within the rank; reachability is worked out per build
    var eligible = (logged || []).filter(function (l) {
      return l.enough && l.perTrip > 0 && l.route.every(function (id) { return disc.has(id) && SECTOR[id] && SECTOR[id].rank <= sub.rank; });
    });
    (logged || []).forEach(function (l) {
      if (!l.enough || !(l.perTrip > 0)) return;
      if (!l.route.every(function (id) { return disc.has(id) && SECTOR[id] && SECTOR[id].rank <= sub.rank; })) return;
      var ev = A.evalRoute(l.route, st);
      if (!ev || !ev.reachable) return;
      own.push({ route: l.route.slice(), ev: ev, trips: l.trips, perTrip: l.perTrip, gph: l.perTrip / (ev.seconds / 3600), key: l.route.join(',') });
    });
    own.sort(function (a, b) { return b.gph - a.gph || a.ev.seconds - b.ev.seconds || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); });
    var fmt = function (n) { return Math.round(n).toLocaleString('en'); };
    var note = input.priceNote ? ' ' + input.priceNote : '';
    if (own.length) {
      var ownWhy = function (x) {
        return 'From your own log: about ' + fmt(x.perTrip) + ' gil a voyage over ' + x.trips + ' logged voyages; this sub is back in ' + (Math.round(x.ev.seconds / 360) / 10) + ' hours, so about ' + fmt(x.gph) + ' gil per hour.' + note;
      };
      var picked = own.slice(0, 3), seenKeys = {};
      picked.forEach(function (x) { seenKeys[x.key] = 1; });
      var alts = picked.slice(1).map(function (x) { return Object.assign({ why: ownWhy(x), own: true }, x); });
      for (var ci = 0; ci < c3.length && alts.length < 2; ci++) {
        var cx = c3[ci], ck = cx.route.join(',');
        if (seenKeys[ck] || ck === picked[0].key) continue;
        seenKeys[ck] = 1;
        var nn = byKey[ck] ? byKey[ck].trips : 0;
        var lead = byKey[ck] && byKey[ck].enough ? 'Its items have no known price on this device (' + nn + ' logged voyages), so no gil figure' : 'Not enough of your own data (' + nn + ' of ' + enough + ' voyages)';
        alts.push(Object.assign({ why: lead + '; ' + (cx.label ? 'a community gil route ("' + cx.label + '")' : 'many sector stars per hour') + '.' }, cx));
      }
      out = Object.assign(head3, { plan: Object.assign({ why: ownWhy(picked[0]), own: true }, picked[0]), alts: alts, own: true });
      out.parts = gilTip(sub, eligible, fmt) || (eligible.length ? null : partTip(sub, st, out.plan.route));
      return out;
    }
    if (!c3.length) return { step: 3, stepName: A.STEPS[2], blocked: 'No discovered sector is within this build\'s range.' };
    out = Object.assign(head3, pack(c3, function (x) {
      var have = byKey[x.route.join(',')], n = have ? have.trips : (logged ? 0 : null);
      return (x.label ? 'A community gil route ("' + x.label + '", Submarine Tracker)' : 'The route with the most sector stars per hour (game data)') +
        '. Your own gil per hour takes over once a route has ' + enough + ' logged voyages' + (n ? ' (this one has ' + n + ')' : '') + '; until then the stars are only a guide.';
    }));
    out.own = false;
    out.parts = gilTip(sub, eligible, fmt) || (eligible.length ? null : partTip(sub, st, out.plan.route));
    return out;
  };
  // ------------------------------------------------------------------ the advisor with the player's settings (item R2)
  // input.recs = { fuel, giveUp, order, loot } (RECS.check). Candidates of spec 4.2, stages of 4.3, the choice RECS.pick (4.4).
  // Returns today's shape plus lead (the stage key U1, U2, U3, X, G, L1 or L2), head (the header text), label, skipped and fuel;
  // the reasons, the header and the part advice follow spec 4.5 and 4.7 (item R3).
  function adviseRecs(input, sub, st, disc, pool, undiscovered, newOf) {
    var R = globalThis.RECS, recs = input.recs, fc = input.fc;
    evals = 0;
    var fuel = !!recs.fuel, giveUp = typeof recs.giveUp === 'number' ? recs.giveUp : R.GIVE_UP;
    var order = Array.isArray(recs.order) && recs.order.length === R.KEYS.length && R.KEYS.every(function (k) { return recs.order.indexOf(k) >= 0; }) ? recs.order : R.KEYS;
    var items = R.active(recs), chosen = {};
    items.forEach(function (id) { chosen[id] = 1; });
    var slots = fc.unlockedSlots || 1, atTop = sub.rank >= TOP;
    var step = slots < 4 ? 1 : undiscovered.length ? 2 : 3;
    var stepName = A.STEPS[step - 1];
    var done = function (o) { A.lastEvals = evals; return o; };
    // the sector to survey next on the way to the next slot (today's `visit`), when this sub's rank allows it
    var visit = null, visitRaw = null, target = null, chain = null;
    if (slots < 4) {
      target = (D.subSlots.find(function (u) { return u.slot === slots + 1; }) || {}).sector;
      chain = target ? chainTo(target, disc) : null;
      visitRaw = disc.has(target) ? target : chain ? chain[0] : null;
      visit = visitRaw && SECTOR[visitRaw].rank <= sub.rank ? visitRaw : null;
    }
    var left = slots < 4 || undiscovered.length > 0;
    var lootAt = function (id) { return (D.loot && D.loot[id]) || []; };
    var allowed = function (route) { return route.every(function (id) { return disc.has(id) && SECTOR[id] && SECTOR[id].rank <= sub.rank; }); };
    var cev = function (route) { return counted(route, st); };
    var mk = function (route, ev) { return { route: route.slice(), ev: ev, seconds: ev.seconds, tanks: Math.max(1, ev.tanks) }; };
    // singles: every visitable sector alone, if within range
    var singles = [];
    pool.forEach(function (s) { var ev = cev([s.id]); if (ev && ev.reachable) singles.push(mk([s.id], ev)); });
    if (!singles.length) {
      // the same step, step name and sentence as today's answer for this input, so the Board's grouping and notifications do not move
      var kept = evals, td = A.advise(Object.assign({}, input, { recs: null }));
      evals = kept;
      return done({ step: td.blocked ? td.step : step, stepName: td.blocked ? td.stepName : stepName, blocked: td.blocked || 'No discovered sector is within this build\'s range.', lead: null, skipped: [], fuel: fuel });
    }
    var live = function (fn) { return singles.some(function (r) { return fn(r) > 0; }); };
    var noUnlock = !left ? 'every sector is found' : null;
    var U1 = { key: 'U1', objective: 'unlock', rate: true, reason: noUnlock || (slots >= 4 ? 'every submarine slot is unlocked' : 'no route this sub can run now surveys the sector on the way to the next slot'),
      amount: function (r) { return visit && r.route.indexOf(visit) >= 0 ? 1 : 0; } };
    var U2 = { key: 'U2', objective: 'unlock', rate: true, reason: noUnlock || 'no sector this sub can reach now can reveal a new one',
      amount: function (r) { return undiscovered.length ? newOf(r.route) : 0; } };
    var u1 = live(U1.amount), u2 = live(U2.amount);
    var U3 = { key: 'U3', objective: 'unlock', rate: true, reason: noUnlock || (atTop ? 'this sub is at the top rank' : 'a route this sub can run now already works towards what is left to unlock'),
      amount: function (r) { return left && !atTop && !u1 && !u2 ? r.ev.exp : 0; } };
    var topWhy = 'this submarine is at rank ' + TOP + ', the top rank';
    var X = { key: 'X', objective: 'level', rate: true, reason: topWhy, amount: function (r) { return atTop ? 0 : r.ev.exp; } };
    // Gil Farming (docs/submersibles-droprates-spec.md 6.1, owner decisions Q3): expected merchant gil of the route for this
    // sub's build (DROPS), or, once a route has `enough` logged voyages whose log can be counted in merchant gil, that log's
    // figure. Both are merchant gil per voyage, divided by this sub's hours: the same unit. When a community route is among
    // the routes still in play only community routes score; otherwise every route does.
    var DR = globalThis.DROPS, estMemo = {};
    var estOf = function (route, ev) {
      var k = route.join(','), m = estMemo[k]; if (m) return m;
      var e = ev || A.evalRoute(route, st), r = DR.route(D, route, st), cnt = Infinity;
      if (r) r.sectors.forEach(function (x) { if (x.rolls > 0 && x.rolls < cnt) cnt = x.rolls; }); // the band's records: what the estimate rests on
      m = estMemo[k] = r ? { gil: r.gil, perHour: DR.perHour(r.gil, e.seconds), n: cnt === Infinity ? r.n : cnt, few: r.few } : { gil: 0, perHour: 0, n: 0, few: true };
      return m;
    };
    var ownBy = {}; // routes with enough logged voyages and a log that can be counted in merchant gil
    (input.logged || []).forEach(function (l) {
      if (l.enough && Number.isFinite(l.merchantPerTrip) && l.merchantPerTrip >= 0 && allowed(l.route)) ownBy[l.route.join(',')] = l;
    });
    var gilAmount = function (r) { var o = ownBy[r.route.join(',')]; return o ? o.merchantPerTrip : estOf(r.route, r.ev).gil; };
    var G = { key: 'G', objective: 'gil', rate: true, amount: gilAmount, prepare: function (S) {
      if (S.some(function (r) { return r.label; })) return function (r) { return r.label ? gilAmount(r) : 0; };
      return gilAmount;
    } };
    var lootReason = items.length ? 'none of your chosen items can drop in a sector this sub can reach now' : 'no item chosen';
    var L1 = { key: 'L1', objective: 'loot', rate: false, reason: lootReason, amount: function (r) {
      var seen = {}, n = 0;
      r.route.forEach(function (id) { lootAt(id).forEach(function (it) { if (chosen[it] && !seen[it]) { seen[it] = 1; n++; } }); });
      return n;
    } };
    var L2 = { key: 'L2', objective: 'loot', rate: true, reason: lootReason, amount: function (r) {
      var n = 0;
      r.route.forEach(function (id) { lootAt(id).forEach(function (it) { if (chosen[it]) n++; }); });
      return n;
    } };
    var by = { unlock: [U1, U2, U3], level: [X], gil: [G], loot: [L1, L2] };
    // spec 4.5: the cause named when a whole objective is skipped
    var causeOf = { unlock: !left ? 'every sector is found' : 'no sector this sub can visit now leads to what is left to unlock', level: topWhy, gil: null, loot: lootReason };
    var leadKey = null; // set once the choice is made: a stage ranked after it that still has routes over all candidates was emptied by the bands
    var BAND_REASON = 'no route within ' + Math.round(R.BAND * 100) + '% of the best for the priorities above serves it';
    var fixSkipped = function (list) {
      var gone = {}, idx = function (k) { return stages.findIndex(function (s) { return s.key === k; }); };
      var bandOnly = function (x) { var st = stages.find(function (s) { return s.key === x.key; }); return leadKey !== null && idx(x.key) > idx(leadKey) && !!x.reason && live(st.amount); };
      list.forEach(function (x) { gone[x.objective] = (gone[x.objective] || 0) + 1; });
      return list.map(function (x) {
        if (bandOnly(x)) return { key: x.key, objective: x.objective, reason: BAND_REASON };
        var whole = gone[x.objective] === by[x.objective].length && causeOf[x.objective] && !by[x.objective].some(function (s) { return live(s.amount); });
        return { key: x.key, objective: x.objective, reason: whole ? causeOf[x.objective] : x.reason };
      });
    };
    var stages = [];
    order.forEach(function (k) { stages = stages.concat(by[k]); });
    var isLive = {};
    stages.forEach(function (s) { isLive[s.key] = s.key === 'G' ? true : live(s.amount); });
    var leadSt = stages.find(function (s) { return isLive[s.key]; });
    var cands = new Map();
    var add = function (c) { var k = c.route.join(','); if (!cands.has(k)) cands.set(k, c); return cands.get(k); };
    singles.forEach(add);
    // always added: this sub's runnable community routes and routes with enough logged voyages, in their exact order
    var commSea = {}, commCount = 0;
    (D.commonRoutes || []).forEach(function (cr) {
      if (!allowed(cr.route)) return;
      var ev = cev(cr.route); if (!ev || !ev.reachable) return;
      add(mk(cr.route, ev)).label = cr.name; commCount++; commSea[SECTOR[cr.route[0]].sea] = 1;
    });
    (input.logged || []).forEach(function (l) {
      if (!l.enough || !allowed(l.route)) return;
      var ev = cev(l.route); if (!ev || !ev.reachable) return;
      add(mk(l.route, ev));
    });
    // searched routes: every order of 1 to 5 sectors in a sea of at most 8 visitable sectors, else the bounded search on the lead.
    // With Gil leading, only the seas where this sub can run no community route are searched (spec 6.1, E10)
    {
      var bySea = {}, bySet = {}, num = function (a, b) { return a - b; };
      pool.forEach(function (s) { (bySea[s.sea] = bySea[s.sea] || []).push(s); });
      var keepSet = function (route, ev) {
        var k = route.slice().sort(num).join(','), cur = bySet[k];
        if (!cur || ev.seconds < cur.ev.seconds || (ev.seconds === cur.ev.seconds && route.join('-') < cur.route.join('-'))) bySet[k] = { route: route.slice(), ev: ev };
      };
      var searchLead = leadSt.key === 'G' ? G : leadSt;
      var amt = function (route, ev) { return searchLead.amount({ route: route, ev: ev }); };
      Object.keys(bySea).forEach(function (sea) {
        var secs = bySea[sea];
        if (leadSt.key === 'G' && commSea[sea]) return;
        if (secs.length <= 8) {
          var ids = secs.map(function (s) { return s.id; });
          (function walk(route) {
            if (route.length >= D.formula.maxSectors) return;
            ids.forEach(function (id) {
              if (route.indexOf(id) >= 0) return;
              var nr = route.concat(id), ev = cev(nr);
              if (!ev || !ev.reachable) return;
              keepSet(nr, ev); walk(nr);
            });
          })([]);
        } else {
          var hrs = function (ev) { return ev.seconds / 3600; };
          search(secs, st, function (r, ev) { return searchLead.rate ? amt(r, ev) / hrs(ev) : amt(r, ev); }).forEach(function (c) { keepSet(c.route, c.ev); });
          if (fuel) search(secs, st, function (r, ev) { return amt(r, ev) / Math.max(1, ev.tanks); }).forEach(function (c) { keepSet(c.route, c.ev); });
        }
      });
      Object.keys(bySet).forEach(function (k) { add(mk(bySet[k].route, bySet[k].ev)); });
    }
    var all = Array.from(cands.values());
    var res = R.pick(all, stages, { fuel: fuel, giveUp: giveUp });
    var lead = res.lead || 'G'; leadKey = lead;
    var leadStage = stages.find(function (s) { return s.key === lead; }), leadObj = leadStage.objective;
    var plan = res.plan;
    // ---- the reasons (spec 4.7, 4.5): plain text, no HTML; names come from the data and the player's chosen items
    var enough = input.enough || 10, logged = input.logged || null, byKey = {};
    (logged || []).forEach(function (l) { byKey[l.route.join(',')] = l; });
    var fmt = function (n) { return Math.round(n).toLocaleString('en'); };
    var one = function (n) { return (Math.round(n * 10) / 10).toLocaleString('en'); };
    var hrs = function (x) { return x.ev.seconds / 3600; };
    var tankText = function (n) { return n + (n === 1 ? ' tank' : ' tanks'); };
    var lootNames = function (route) {
      var seen = {}, out = [];
      route.forEach(function (id) { lootAt(id).forEach(function (it) { if (chosen[it] && !seen[it]) { seen[it] = 1; out.push((D.items && D.items[it]) || 'Item ' + it); } }); });
      return out;
    };
    var LOOT_NOTE = 'possible items only (community data), drop odds are not known';
    var towards = function () {
      if (slots < 4) {
        if (!visitRaw) return null;
        return SECTOR[visitRaw].rank > sub.rank ? 'levelling to rank ' + SECTOR[visitRaw].rank + ' for ' + name(visitRaw) + ' (step 1: slot ' + (slots + 1) + ')'
          : 'building range for ' + name(visitRaw) + ' (step 1: slot ' + (slots + 1) + '); rank raises range';
      }
      if (!undiscovered.length) return null;
      var parents = D.sectors.filter(function (s) { return disc.has(s.id) && !(input.pending || []).includes(s.id) && A.children(s.id).some(function (c) { return !disc.has(c); }); });
      var need = parents.length ? parents.reduce(function (m, s) { return Math.min(m, s.rank); }, 999) : null;
      var allPending = !parents.length && D.sectors.some(function (s) { return disc.has(s.id) && A.children(s.id).some(function (c) { return !disc.has(c); }); });
      return need && need > sub.rank ? 'levelling to rank ' + need + ' for the next discovery (step 2)' : allPending ? 'while your other subs\' voyages reveal the next sectors (step 2)' : 'building range for the next discovery (step 2); rank raises range';
    };
    var xph = function (x) { return x.ev.exp / hrs(x); };
    // ---- Gil Farming sentences (spec 5.4, 6.1; owner decisions Q3): the estimate and the player's own log side by side
    var kinds = function (n) { return n + ' community gil route' + (n === 1 ? '' : 's'); };
    var estText = function (x) {
      var e = estOf(x.route, x.ev);
      return 'about ' + DR.fmt.voyage(e.gil) + ' gil a voyage at merchant prices (about ' + DR.fmt.hour(e.perHour) + ' an hour for this submarine): an estimate from community drop records (at least ' +
        DR.fmt.count(e.n) + ' surveys per sector on this route), not a promise.' + (e.few ? ' Few records for a submarine like this one.' : '');
    };
    // the own-log part: which figure decided, and both figures
    var logText = function (x) {
      var key = x.route.join(','), lg = byKey[key], ob = ownBy[key];
      if (!lg || !(lg.trips > 0)) return '';
      var e = estOf(x.route, x.ev);
      if (ob) return ' Your own log on this route: about ' + DR.fmt.hour(ob.merchantPerTrip / hrs(x)) + ' gil an hour at merchant prices over ' + ob.trips + ' logged voyages (this submarine is back in ' + (Math.round(x.ev.seconds / 360) / 10) +
        ' hours); the community estimate is about ' + DR.fmt.hour(e.perHour) + ' an hour. Your own log decided, because the route has ' + enough + ' or more logged voyages.';
      if (lg.enough) return ' Your own log on this route (' + lg.trips + ' logged voyages) cannot be counted in merchant gil, because a logged item has no price in the data, so the estimate decided for it.';
      return ' Your own log on this route: ' + lg.trips + ' of ' + enough + ' logged voyages; the estimate decides until then.';
    };
    var seaOf = function (x) { return SEA[SECTOR[x.route[0]].sea]; };
    var bigSea = function (x) { return pool.filter(function (s) { return s.sea === SECTOR[x.route[0]].sea; }).length > 8; };
    // why no community route can be run: the furthest blocker among the community routes
    var noCommunity = function () {
      var routes = D.commonRoutes || [], found = routes.filter(function (cr) { return cr.route.every(function (id) { return disc.has(id); }); });
      if (!found.length) return 'sectors not found';
      return found.some(function (cr) { return allowed(cr.route); }) ? 'range' : 'rank';
    };
    var gilWhy = function (x, most) {
      var head, tail = '';
      if (x.label) {
        head = 'Community gil route ' + x.label + ': ';
        tail = commCount === 1 ? ' The only community gil route this submarine can run.' : (most ? ' The best of the ' + kinds(commCount) + ' this submarine can run.' : ' One of the ' + kinds(commCount) + ' this submarine can run.');
      } else if (!commCount) {
        head = 'No community gil route can be run by this submarine now (' + noCommunity() + '). Found by the app from community drop rates: ';
        tail = bigSea(x) ? ' The best found, not proven best.' : '';
      } else head = 'Found by the app in ' + seaOf(x).name + ': ';
      return head + estText(x) + logText(x) + tail;
    };
    // a derived route that beats the community plan by more than 5%: shown among the other routes, labelled
    var derivedWhy = function (x, plan) {
      var g = gilAmount(x) / hrs(x), p = gilAmount(plan) / hrs(plan), more = Math.round((g / p - 1) * 100), e = estOf(x.route, x.ev);
      return 'Found by the app in ' + seaOf(x).name + ': about ' + DR.fmt.hour(g) + ' gil an hour by the same estimate, ' + more + '% more than the community route. Community routes come first. An estimate from community drop records (at least ' +
        DR.fmt.count(e.n) + ' surveys per sector on this route), not a promise.' + (bigSea(x) ? ' The best found, not proven best.' : '') + logText(x);
    };
    // the lead's sentence for a route
    var leadWhy = function (key, x, most) {
      if (key === 'U1') return visit === target ? 'Surveying ' + name(target) + ' can grant slot ' + (slots + 1) + ' (not certain on every visit).'
        : 'On the way to ' + name(target) + ', which grants slot ' + (slots + 1) + ': surveying ' + name(visit) + ' can reveal ' + name(chain[1]) + '.';
      if (key === 'U2') {
        var n = newOf(x.route);
        return 'Can reveal ' + n + ' new sector' + (n === 1 ? '' : 's') + ' (' + x.route.filter(function (id) { return A.children(id).some(function (c) { return !disc.has(c); }); }).map(name).join(', ') + ' lead to them)' + (most ? ': the most per hour within reach.' : '.');
      }
      if (key === 'U3' || key === 'X') {
        var tw = key === 'U3' ? towards() : null;
        return (most ? 'Most experience per hour within reach (at least ' + fmt(xph(x)) + ' an hour)' : 'At least ' + fmt(xph(x)) + ' experience an hour') + (tw ? ', ' + tw : '') + '.';
      }
      if (key === 'G') return gilWhy(x, most);
      var names = lootNames(x.route);
      return 'Can bring back ' + names.length + ' of your ' + items.length + ' chosen item' + (items.length === 1 ? '' : 's') + ' (' + names.join(', ') + '); ' + LOOT_NOTE + '.';
    };
    // the plan's figure for a stage that narrowed the choice after the lead: "Then <label>: <figure>."
    var figure = function (key, x) {
      if (key === 'U1') return 'it surveys ' + name(visit) + (visit === target ? ', which can grant slot ' : ' on the way to slot ') + (slots + 1);
      if (key === 'U2') { var n = newOf(x.route); return 'it can reveal ' + n + ' new sector' + (n === 1 ? '' : 's'); }
      if (key === 'U3' || key === 'X') return 'at least ' + fmt(xph(x)) + ' experience an hour';
      if (key === 'G') { var gp = ownBy[x.route.join(',')]; return gp ? 'about ' + DR.fmt.hour(gp.merchantPerTrip / hrs(x)) + ' gil an hour at merchant prices (your own log)' : 'about ' + DR.fmt.hour(estOf(x.route, x.ev).perHour) + ' gil an hour at merchant prices (estimate from community drop records)'; }
      var tail = leadObj === 'loot' ? '' : ' (' + LOOT_NOTE + ')';
      if (key === 'L1') return 'it covers ' + lootNames(x.route).length + ' of your ' + items.length + ' chosen item' + (items.length === 1 ? '' : 's') + tail;
      var stops = x.route.filter(function (id) { return lootAt(id).some(function (it) { return chosen[it]; }); }).length;
      return stops + (stops === 1 ? ' stop' : ' stops') + ' where a chosen item can drop (' + one(stops / hrs(x)) + ' an hour)' + (leadObj === 'loot' ? '' : '; ' + LOOT_NOTE);
    };
    // the lead's score for a route, with the tier the lead itself used, and its name for the fuel sentence
    var leadFn = leadStage.prepare ? leadStage.prepare(all) : leadStage.amount;
    var leadScore = function (x) { var a = Number(leadFn(x)) || 0; return leadStage.rate ? a / hrs(x) : a; };
    var unit = lead === 'U1' ? 'slot chances per hour' : lead === 'U2' ? 'reveal chances per hour' : lead === 'U3' || lead === 'X' ? 'experience per hour' : lead === 'L1' ? 'chosen items covered'
      : lead === 'L2' ? 'item chances per hour' : 'merchant gil per hour';
    var bestLead = all.reduce(function (m, x) { return Math.max(m, leadScore(x)); }, 0);
    var isMost = function (x) { return leadScore(x) >= bestLead - 1e-9 * bestLead; }; // the route has the best lead score of all candidates
    var skippedKeys = {};
    res.skipped.forEach(function (x) { skippedKeys[x.key] = 1; });
    var fullWhy = function (x) {
      var out = [leadWhy(lead, x, isMost(x))], done2 = 0;
      res.trace.forEach(function (t) {
        if (t.key === lead || t.after >= t.before || done2 >= 2 || !res.used.includes(t.key) || res.used.indexOf(t.key) < res.used.indexOf(lead)) return;
        done2++; out.push('Then ' + R.LABEL[t.objective] + ': ' + figure(t.key, x) + '.');
      });
      for (var oi = 0; oi < order.length && order[oi] !== leadObj; oi++) {
        var o = order[oi], gone = by[o].every(function (st2) { return skippedKeys[st2.key]; });
        if (gone && causeOf[o] && !(o === 'loot' && !items.length)) out.push('Skipped ' + R.LABEL[o] + ': ' + causeOf[o] + '.');
      }
      if (fuel) {
        var off = R.pick(all, stages, { fuel: false, giveUp: giveUp }).plan; // the same candidates, decided again without the fuel step
        if (!off || off.route.join(',') === x.route.join(',')) out.push('Fuel efficiency made no difference here.');
        else {
          var sOff = leadScore(off), p = sOff > 0 ? Math.round((1 - leadScore(x) / sOff) * 100) : 0;
          out.push(x.tanks < off.tanks ? 'Fuel efficiency: ' + tankText(x.tanks) + ' instead of ' + off.tanks + ', ' + (p >= 1 ? 'for ' + p + '% less ' + unit : 'with almost no loss in ' + unit) + '.'
            : 'Fuel efficiency changed the choice: ' + tankText(x.tanks) + ' here, ' + off.tanks + ' without it.');
        }
      }
      return out.join(' ');
    };
    var shape = function (x, full) {
      var o = { route: x.route, ev: x.ev, why: full ? fullWhy(x) : leadWhy(lead, x, false) };
      if (x.label) o.label = x.label;
      if (lead === 'G') {
        var ob = ownBy[x.route.join(',')], e = estOf(x.route, x.ev);
        o.kind = x.label ? 'community' : 'derived'; o.name = x.label || A.routeText(x.route);
        o.est = { gil: e.gil, perHour: e.perHour, n: e.n, few: e.few };
        if (ob) { o.own = true; o.trips = ob.trips; o.perTrip = ob.merchantPerTrip; }
      }
      return o;
    };
    var out = { step: step, stepName: stepName, goal: step === 1 ? 'slot ' + (slots + 1) : step === 2 ? undiscovered.length + ' sectors still to find' : 'gil' };
    var stepHead = lead === 'U1' || lead === 'U2' || lead === 'U3' || (step === 3 && lead === 'G');
    out.head = stepHead ? 'Suggested · step ' + step + ' of 3: ' + stepName : 'Suggested · ' + R.LABEL[leadObj];
    out.label = R.LABEL[leadObj];
    if (step === 1 && (input.slotsFilled || 0) < slots) out.note = 'A new slot only shows once slot ' + slots + ' holds a submarine: register one there in the game when you can.';
    out.plan = shape(plan, true);
    // other routes: the next two with other sectors, never one that scores 0 for the lead
    var setKey = function (r) { return r.route.slice().sort(function (a, b) { return a - b; }).join(','); }, seen = {}, others = [];
    seen[setKey(plan)] = 1;
    res.routes.slice(1).forEach(function (x) { var k = setKey(x); if (others.length >= 2 || seen[k] || !(leadScore(x) > 0)) return; seen[k] = 1; others.push(x); });
    out.alts = others.map(function (x) { return shape(x, false); });
    // a derived route (searched in a sea with no community route) that beats a community plan by more than 5% takes second place
    if (lead === 'G' && plan.label) {
      var derived = null, bestD = 0;
      all.forEach(function (x) {
        if (x.label || commSea[SECTOR[x.route[0]].sea] === 1) return;
        var g = gilAmount(x) / hrs(x); if (g > bestD) { bestD = g; derived = x; }
      });
      if (derived && bestD > 1.05 * (gilAmount(plan) / hrs(plan))) {
        var dShape = shape(derived, false); dShape.why = derivedWhy(derived, plan);
        out.alts = [dShape].concat(out.alts).slice(0, 2);
      }
    }
    // part advice only at step 3: gil by the S6 rule when Gil leads, else the quickest-return swap for this route
    out.parts = null;
    if (step === 3) {
      if (lead === 'G') {
        var eligible = (logged || []).filter(function (l) { return l.enough && l.perTrip > 0 && allowed(l.route); });
        out.parts = gilTip(sub, eligible, fmt) || (eligible.length ? null : partTip(sub, st, plan.route));
      } else out.parts = partTip(sub, st, plan.route);
    }
    out.own = !!plan.own;
    out.lead = lead; out.skipped = fixSkipped(res.skipped); out.fuel = fuel;
    return done(out);
  }
  // the single part change that brings this route back soonest, among the parts the sub's rank allows (step 3 only)
  function partTip(sub, st, route) {
    var base = A.evalRoute(route, st), best = null;
    for (var i = 0; i < 4; i++) {
      D.parts.forEach(function (p) {
        if (p.slot !== i || p.id === sub.parts[i] || CLASS[p.class].rank > sub.rank) return;
        var parts = sub.parts.slice(); parts[i] = p.id;
        var ev = A.evalRoute(route, A.stats(sub.rank, parts));
        if (!ev || !ev.reachable) return;
        var gain = base.seconds - ev.seconds;
        if (gain >= 60 && (!best || gain > best.gain)) best = { slot: i, from: sub.parts[i], to: p.id, gain: gain };
      });
    }
    if (!best) return null;
    best.why = 'Swapping the ' + ['hull', 'stern', 'bow', 'bridge'][best.slot] + ' for ' + PART[best.to].name + ' would bring this route back ' + Math.round(best.gain / 60) + ' min sooner (calculated). Only if you already have the part or plan to craft it.';
    return best;
  }
  // Part advice in gil (item S6-3, owner's answer A to Q1): the one part swap, allowed by the rank, that raises this sub's
  // best gil per hour over its ranked routes (a route out of range now may come into range with the new part). Only swaps
  // that lower none of surveillance, retrieval and favor are weighed: how those three change what comes back is not known,
  // so the figure assumes the same items come back. Largest gain wins; ties go to the lower slot, then the lower part id;
  // a gain below 1% of the current best gives no tip. null when there is none.
  function bestGph(rank, parts, routes) {
    var st = A.stats(rank, parts), best = null;
    if (!st) return null;
    routes.forEach(function (l) {
      var ev = A.evalRoute(l.route, st); if (!ev || !ev.reachable) return;
      var g = l.perTrip / (ev.seconds / 3600);
      if (!best || g > best.gph) best = { gph: g, route: l.route };
    });
    return best;
  }
  function gilTip(sub, routes, fmt) {
    if (!routes.length) return null;
    var cur = bestGph(sub.rank, sub.parts, routes), curG = cur ? cur.gph : 0, best = null;
    var parts = D.parts.slice().sort(function (a, b) { return a.id - b.id; });
    for (var i = 0; i < 4; i++) {
      var old = PART[sub.parts[i]];
      parts.forEach(function (p) {
        if (p.slot !== i || p.id === sub.parts[i] || CLASS[p.class].rank > sub.rank) return;
        if (!old || p.surveillance < old.surveillance || p.retrieval < old.retrieval || p.favor < old.favor) return;
        var np = sub.parts.slice(); np[i] = p.id;
        var b = bestGph(sub.rank, np, routes); if (!b) return;
        var gain = b.gph - curG;
        if (gain > 0 && (!best || gain > best.gain)) best = { slot: i, from: sub.parts[i], to: p.id, gain: gain, gph: b.gph, route: b.route };
      });
    }
    if (!best || best.gain < curG * 0.01) return null;
    var tip = { slot: best.slot, from: best.from, to: best.to, gain: best.gain, gilGain: Math.round(best.gain), gilFrom: Math.round(curG), gilTo: Math.round(best.gph) };
    tip.why = 'Swapping the ' + ['hull', 'stern', 'bow', 'bridge'][best.slot] + ' for ' + PART[best.to].name + ' would give more gil per hour: about ' + fmt(best.gph) + ' instead of ' + (cur ? 'about ' + fmt(curG) : 'nothing within range now') +
      ' on ' + A.routeText(best.route) + ' (calculated from your own log; it assumes the same items come back). It lowers none of surveillance, retrieval and favor. Only if you already have the part or plan to craft it.';
    return tip;
  }
})();
