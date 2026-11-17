// Eveniunt Command Center, Submersibles: customizable recommendations (item R1, docs/submersibles-recommendations-spec.md).
// - The player's settings { fuel, giveUp, order, loot }: defaults, checking what was stored, and a short signature.
// - The staged choice (RECS.pick): the player's ranking decides in order, each priority keeping the routes within a
//   fixed 5% band of the best one for it; with fuel efficiency on, the top priority gets the player's allowance instead.
// Pure: no page, no storage and no game data besides the loot lists it is handed. Nothing calls it yet.
// Plain script: attaches to globalThis.RECS, so the choice runs in Node tests too.
(function () {
  'use strict';
  var R = (globalThis.RECS = globalThis.RECS || {});
  R.NAME = 'submersibles-recommendations'; // the save section (spec section 6)
  R.KEYS = ['unlock', 'level', 'gil', 'loot']; // the default order
  R.LABEL = { unlock: 'Unlocking Routes', level: 'Leveling Submersible Rank', gil: 'Gil Farming', loot: 'Loot Farming' };
  R.BAND = 0.05; // fixed band between priorities (spec 4.6)
  R.GIVE_UP = 10; // fuel allowance, percent; set by the tuning rule of spec 4.6 (docs/submersibles-recommendations-tuning.md, item R4)
  R.GIVE_MIN = 5;
  R.GIVE_MAX = 50;
  R.GIVE_STEP = 5;
  R.PICKERS = 5;
  var EPS = 1e-9;

  R.defaults = function () {
    var loot = [];
    for (var i = 0; i < R.PICKERS; i++) loot.push([0, i === 0]); // the first is always on, as R.check reads it
    return { fuel: false, giveUp: R.GIVE_UP, order: R.KEYS.slice(), loot: loot };
  };

  // Every loot item of the data once, { id, name }, by name (case ignored) then id.
  R.items = function (data) {
    var seen = {}, out = [], loot = (data && data.loot) || {}, names = (data && data.items) || {};
    Object.keys(loot).forEach(function (sid) {
      (Array.isArray(loot[sid]) ? loot[sid] : []).forEach(function (id) {
        if (!Number.isInteger(id) || id <= 0 || seen[id]) return;
        seen[id] = 1;
        out.push({ id: id, name: names[id] || 'Item ' + id });
      });
    });
    out.sort(function (a, b) {
      var x = a.name.toLowerCase(), y = b.name.toLowerCase();
      if (x !== y) return x < y ? -1 : 1;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return a.id - b.id;
    });
    return out;
  };

  // The stored section ({ choices }) read as settings. Only reads: a bad value is replaced here, never rewritten.
  R.check = function (raw, data) {
    var d = R.defaults();
    var c = raw && typeof raw === 'object' && raw.choices && typeof raw.choices === 'object' && !Array.isArray(raw.choices) ? raw.choices : {};
    var out = { fuel: c.fuel === true, giveUp: d.giveUp, order: d.order, loot: d.loot };
    var g = c.giveUp;
    if (Number.isInteger(g) && g >= R.GIVE_MIN && g <= R.GIVE_MAX && g % R.GIVE_STEP === 0) out.giveUp = g;
    if (Array.isArray(c.order) && c.order.length === R.KEYS.length && R.KEYS.every(function (k) { return c.order.indexOf(k) >= 0; })) out.order = c.order.slice();
    if (Array.isArray(c.loot)) {
      var known = {}, taken = {};
      R.items(data).forEach(function (it) { known[it.id] = 1; });
      out.loot = d.loot.map(function (blank, i) {
        var p = c.loot[i];
        if (!Array.isArray(p)) return blank;
        var id = Number.isInteger(p[0]) && known[p[0]] && !taken[p[0]] ? p[0] : 0; // unknown or later duplicate: none
        if (id) taken[id] = 1;
        return [id, i === 0 ? true : p[1] === true];
      });
    }
    return out;
  };

  // The fields that differ between two settings objects, in the order of R.FIELDS.
  R.FIELDS = ['fuel', 'giveUp', 'order', 'loot'];
  R.changed = function (a, b) {
    return R.FIELDS.filter(function (k) { return JSON.stringify(a && a[k]) !== JSON.stringify(b && b[k]); });
  };

  // What a write stores: only the fields already stored in raw plus the ones just changed, each taken from next (the
  // normalised settings). A field nobody stored stays absent, so a merge never sees a change that was not made; R.check
  // fills in the rest when reading.
  R.store = function (raw, next, changed) {
    var have = raw && typeof raw === 'object' && raw.choices && typeof raw.choices === 'object' && !Array.isArray(raw.choices) ? raw.choices : {};
    var out = {};
    R.FIELDS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(have, k) || (changed || []).indexOf(k) >= 0) out[k] = JSON.parse(JSON.stringify(next[k]));
    });
    return { choices: out };
  };

  // The chosen item ids: picker on and an item set, each once.
  R.active = function (choices) {
    var seen = {}, out = [];
    ((choices && choices.loot) || []).forEach(function (p, i) {
      if (!Array.isArray(p) || !p[0] || seen[p[0]] || (i > 0 && p[1] !== true)) return;
      seen[p[0]] = 1; out.push(p[0]);
    });
    return out;
  };

  // A short text that changes whenever the settings change the advice (for cache keys). The allowance counts only with fuel on.
  R.sig = function (choices) {
    var c = choices || R.defaults();
    return [c.fuel ? 'f' + c.giveUp : 'n', (c.order || R.KEYS).join(','), R.active(c).join(',')].join('|');
  };

  // ---- the staged choice (spec 4.4) -------------------------------------------------------------------------------
  // cands: routes { route: [sector ids], seconds, tanks, id? }. stages, in the player's order:
  //   { key, objective, rate, amount(r), prepare(S)? }; rate true: score = amount per hour at sea, false: per voyage.
  //   prepare(S) is given the routes still in play and returns the amount function.
  // opts: { fuel, giveUp (percent) } and optional accessors seconds(r), tanks(r), id(r), sectors(r).
  // Returns { routes (every candidate, best first), plan, others (two more with other sectors), lead, used, skipped,
  //   trace: per used stage { key, objective, before, after }, the routes in play before and after it }.
  R.pick = function (cands, stages, opts) {
    opts = opts || {};
    var seconds = opts.seconds || function (r) { return r.seconds; };
    var tanksOf = opts.tanks || function (r) { return Math.max(1, r.tanks || 1); };
    var idOf = opts.id || function (r) { return r.id != null ? String(r.id) : (r.route || []).join('-'); };
    var setOf = opts.sectors || function (r) { return (r.route || []).slice().sort(function (a, b) { return a - b; }).join(','); };
    var fuel = !!opts.fuel, giveUp = typeof opts.giveUp === 'number' ? opts.giveUp : R.GIVE_UP;
    var S = cands.slice(), lead = null, used = [], skipped = [], trace = [];
    var steps = new Map(), scores = new Map();
    cands.forEach(function (r) { steps.set(r, 0); scores.set(r, []); });
    (stages || []).forEach(function (st) {
      var fn = st.prepare ? st.prepare(S) : st.amount;
      var sc = new Map(), best = -Infinity;
      S.forEach(function (r) {
        var a = Number(fn(r)) || 0;
        var h = Math.max(seconds(r), 1) / 3600;
        var s = st.rate ? a / h : a;
        sc.set(r, { a: a, s: s });
        if (s > best) best = s;
      });
      if (!(best > 0)) { skipped.push({ key: st.key, objective: st.objective, reason: st.reason || null }); return; }
      var first = lead === null;
      var band = fuel && first ? giveUp / 100 : R.BAND;
      S.forEach(function (r) { scores.get(r).push(sc.get(r).s); });
      var before = S.length;
      S = S.filter(function (r) { return sc.get(r).s >= (1 - band) * best - EPS * best; });
      S.forEach(function (r) { steps.set(r, steps.get(r) + 1); });
      if (fuel && first) {
        var bestE = -Infinity;
        S.forEach(function (r) { var e = sc.get(r).a / tanksOf(r); if (e > bestE) bestE = e; });
        S = S.filter(function (r) { return sc.get(r).a / tanksOf(r) >= 0.95 * bestE - EPS * bestE; });
        S.forEach(function (r) { steps.set(r, steps.get(r) + 1); });
      }
      trace.push({ key: st.key, objective: st.objective, before: before, after: S.length }); // how many routes the stage left in play
      if (first) lead = st.key;
      used.push(st.key);
    });
    var routes = cands.slice().sort(function (x, y) {
      if (steps.get(x) !== steps.get(y)) return steps.get(y) - steps.get(x);
      var a = scores.get(x), b = scores.get(y);
      for (var i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return b[i] - a[i];
      if (seconds(x) !== seconds(y)) return seconds(x) - seconds(y);
      if (tanksOf(x) !== tanksOf(y)) return tanksOf(x) - tanksOf(y);
      var p = idOf(x), q = idOf(y);
      return p < q ? -1 : p > q ? 1 : 0;
    });
    var plan = routes[0] || null, others = [], sets = {};
    if (plan) {
      sets[setOf(plan)] = 1;
      for (var i = 1; i < routes.length && others.length < 2; i++) {
        var k = setOf(routes[i]);
        if (sets[k]) continue;
        sets[k] = 1; others.push(routes[i]);
      }
    }
    return { routes: routes, plan: plan, others: others, lead: lead, used: used, skipped: skipped, trace: trace };
  };
})();
