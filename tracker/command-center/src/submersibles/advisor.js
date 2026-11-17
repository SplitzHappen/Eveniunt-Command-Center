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
            var route = r.concat(id), ev = A.evalRoute(route, st);
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
        alts.push(Object.assign({ why: 'Not enough of your own data (' + nn + ' of ' + enough + ' voyages); ' + (cx.label ? 'a community gil route ("' + cx.label + '")' : 'many sector stars per hour') + '.' }, cx));
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
