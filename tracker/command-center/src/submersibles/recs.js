// Eveniunt Command Center, Submersibles: customizable recommendations (item R1, docs/submersibles-recommendations-spec.md).
// - The player's settings { fuel, giveUp, order, loot }: defaults, checking what was stored (one stored key per control, spec
//   section 10.3), the patch a change makes, the page's write path (RECS.keeper) and a short signature.
// - The staged choice (RECS.pick): the player's ranking decides in order, each priority keeping the routes within a
//   fixed 5% band of the best one for it; with fuel efficiency on, the top priority gets the player's allowance instead.
// No page and no storage of its own (the page hands the keeper its write function) and no game data besides the loot lists it is handed.
// Plain script: attaches to globalThis.RECS, so the choice runs in Node tests too.
(function () {
  'use strict';
  var R = (globalThis.RECS = globalThis.RECS || {});
  R.NAME = 'submersibles-recommendations'; // the save section (spec section 6)
  R.KEYS = ['unlock', 'level', 'gil', 'loot']; // the default order
  R.LABEL = { unlock: 'Unlocking Routes', level: 'Leveling Submersible Rank', gil: 'Gil Farming', loot: 'Loot Farming' };
  R.BAND = 0.05; // fixed band between priorities (spec 4.6)
  R.GIVE_UP = 15; // fuel allowance, percent; the owner's choice (docs/submersibles-recommendations-tuning.md, item R4); a stored player value is never changed by it
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

  // Every item of `loot` (listed as possible) and of `dropRates` (community drop records) once, { id, name }, by name (case ignored) then id.
  R.items = function (data) {
    var seen = {}, out = [], loot = (data && data.loot) || {}, names = (data && data.items) || {};
    var take = function (id) {
      if (!Number.isInteger(id) || id <= 0 || seen[id]) return;
      seen[id] = 1;
      out.push({ id: id, name: names[id] || 'Item ' + id });
    };
    Object.keys(loot).forEach(function (sid) { (Array.isArray(loot[sid]) ? loot[sid] : []).forEach(take); });
    var sec = (data && data.dropRates && data.dropRates.sectors) || {};
    Object.keys(sec).forEach(function (sid) { ((sec[sid] && sec[sid].pools) || []).forEach(function (pool) { ((pool && pool.items) || []).forEach(function (row) { take(row[0]); }); }); });
    out.sort(function (a, b) {
      var x = a.name.toLowerCase(), y = b.name.toLowerCase();
      if (x !== y) return x < y ? -1 : 1;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return a.id - b.id;
    });
    return out;
  };

  // The stored section ({ choices }) read as settings (spec 10.3). One key per control inside choices: fuel, giveUp, order,
  // loot1 to loot5 (an item id; 0 is none) and use2 to use5 (picker n is on). Picker 1 is always on: use1 is never read or written.
  // Only reads: a bad value is replaced here, never rewritten. An old choices.loot array is not read (spec D16).
  R.check = function (raw, data) {
    var d = R.defaults();
    var c = raw && typeof raw === 'object' && raw.choices && typeof raw.choices === 'object' && !Array.isArray(raw.choices) ? raw.choices : {};
    var out = { fuel: c.fuel === true, giveUp: d.giveUp, order: d.order, loot: d.loot };
    var g = c.giveUp;
    if (Number.isInteger(g) && g >= R.GIVE_MIN && g <= R.GIVE_MAX && g % R.GIVE_STEP === 0) out.giveUp = g;
    if (Array.isArray(c.order) && c.order.length === R.KEYS.length && R.KEYS.every(function (k) { return c.order.indexOf(k) >= 0; })) out.order = c.order.slice();
    var known = {}, taken = {};
    R.items(data).forEach(function (it) { known[it.id] = 1; });
    out.loot = d.loot.map(function (blank, i) {
      var on = i === 0 || c['use' + (i + 1)] === true, v = c['loot' + (i + 1)];
      // unknown, or a duplicate of an earlier switched-on picker: none. A switched-off picker keeps its stored choice and counts for nothing.
      var id = Number.isInteger(v) && known[v] && !(on && taken[v]) ? v : 0;
      if (id && on) taken[id] = 1;
      return [id, on];
    });
    return out;
  };

  // The stored whole number for picker i (0 to 4), 0 if none: what the save holds, before check() judged it.
  R.held = function (raw, i) {
    var c = raw && typeof raw === 'object' && raw.choices && typeof raw.choices === 'object' ? raw.choices : null, v = c ? c['loot' + (i + 1)] : 0;
    return Number.isInteger(v) && v > 0 ? v : 0;
  };

  // Which free companies the Board shows (a view preference, gaps spec G8): one flat key per free company inside choices,
  // hide-<free company id> = true when hidden; false (or absent) = shown. Flat keys are separate merge units, so two pages or devices
  // hiding different companies both keep their change. R.check ignores these keys; they are not part of R.sig.
  R.HIDE = 'hide-';
  R.hideKey = function (fcId) { return R.HIDE + fcId; };
  // The hidden ids as { id: true }: every stored key hide-<id> that is exactly true, whether or not the company still exists.
  R.hidden = function (raw) {
    var c = raw && typeof raw === 'object' && raw.choices && typeof raw.choices === 'object' && !Array.isArray(raw.choices) ? raw.choices : {}, out = {};
    Object.keys(c).forEach(function (k) { if (k.indexOf(R.HIDE) === 0 && k.length > R.HIDE.length && c[k] === true) out[k.slice(R.HIDE.length)] = true; });
    return out;
  };

  var copy = function (v) { return JSON.parse(JSON.stringify(v)); };
  var same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  // What the player's change touched: a patch { key: value } of the stored keys whose control differs between two settings
  // objects (fuel, giveUp, order by value; per picker n, loot<n> when the item differs and, from n = 2, use<n> when the switch differs).
  R.intent = function (was, now) {
    var patch = {};
    ['fuel', 'giveUp', 'order'].forEach(function (k) { if (!same(was && was[k], now && now[k])) patch[k] = copy(now[k]); });
    for (var i = 0; i < R.PICKERS; i++) {
      var a = was && was.loot && was.loot[i] || [], b = now && now.loot && now.loot[i] || [];
      if (a[0] !== b[0]) patch['loot' + (i + 1)] = b[0];
      if (i > 0 && a[1] !== b[1]) patch['use' + (i + 1)] = b[1];
    }
    return patch;
  };

  // What a write stores: a deep copy of the raw section (or {}) with choices[key] = value for each key of the patch. Nothing else
  // is touched (unknown fields, keys and item ids stay as stored); the input is not modified. A key nobody stored stays absent.
  R.store = function (raw, patch) {
    var out = raw && typeof raw === 'object' && !Array.isArray(raw) ? copy(raw) : {};
    if (!out.choices || typeof out.choices !== 'object' || Array.isArray(out.choices)) out.choices = {};
    Object.keys(patch || {}).forEach(function (k) { out.choices[k] = copy(patch[k]); });
    return out;
  };

  // The section with each edit's patch stored in order; null with no edits stays null.
  R.rebase = function (section, edits) {
    var out = section == null ? null : copy(section);
    (edits || []).forEach(function (e) { out = R.store(out, e.patch); });
    return out;
  };

  // This page's write path (spec 10.4). write(section, known) resolves { rev, section, merged } (the page hands in
  // CC.writeSection); done(result) is called after every write attempt with { ok: true, merged } or { ok: false, error }.
  // State: raw (what the panel reads), base and rev (what was last read or written), edits ({ seq, patch }: changes not yet
  // stored) and pending (changes not yet settled). change(patch) never rejects; writes run one at a time, in order.
  R.keeper = function (write, done) {
    var K = { raw: null, base: null, rev: null, edits: [], pending: 0, seq: 0, chain: Promise.resolve() };
    var tell = function (res) { try { if (typeof done === 'function') done(res); } catch (e) { /* the page's reporting must not break the queue */ } };
    K.read = function (section, rev) {
      K.base = section ? copy(section) : null; K.rev = rev;
      K.raw = R.rebase(K.base, K.edits);
    };
    K.change = function (patch) {
      if (!patch || !Object.keys(patch).length) return Promise.resolve();
      K.raw = R.store(K.raw, patch);
      K.edits.push({ seq: ++K.seq, patch: copy(patch) });
      K.pending++;
      K.chain = K.chain.then(function () {
        if (!K.edits.length) return; // an earlier write carried this change
        var snapSeq = K.edits[K.edits.length - 1].seq, upTo = function (e) { return e.seq > snapSeq; };
        return Promise.resolve().then(function () { return write(copy(K.raw), { rev: K.rev, base: K.base }); }).then(function (r) {
          K.rev = r.rev; K.base = copy(r.section);
          K.edits = K.edits.filter(upTo);
          K.raw = R.rebase(r.section, K.edits);
          tell({ ok: true, merged: !!r.merged });
        }, function (error) {
          K.edits = K.edits.filter(upTo);
          K.raw = R.rebase(K.base, K.edits);
          tell({ ok: false, error: error });
        });
      }).then(function () { K.pending--; });
      return K.chain;
    };
    return K;
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
