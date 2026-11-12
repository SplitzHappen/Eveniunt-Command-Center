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
  A.rankAfter = function (rank, into, exp) {
    var r = rank, e = (into || 0) + exp;
    while (r < TOP && RANK[r] && e >= RANK[r].expToNext) { e -= RANK[r].expToNext; r += 1; }
    return { rank: r, into: e };
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
    if (!c3.length) return { step: 3, stepName: A.STEPS[2], blocked: 'No discovered sector is within this build\'s range.' };
    out = Object.assign(head3, pack(c3, function (x) {
      return (x.label ? 'A community gil route ("' + x.label + '", Submarine Tracker)' : 'The route with the most sector stars per hour (game data)') +
        '. Real gil per hour comes from your own logged returns once logging arrives; until then the stars are only a guide.';
    }));
    out.parts = partTip(sub, st, out.plan.route);
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
})();
