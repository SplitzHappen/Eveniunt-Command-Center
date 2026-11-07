/*
 * Adaptive decision engine.
 *
 * Method: rollout planning (one-step lookahead with Monte Carlo rollouts of
 * a condition-aware base policy). For the observed state, every legal action
 * is simulated to the end of the craft many times, sampling action success
 * and future material conditions; the action with the best estimated value
 * is recommended. Candidates are pruned by successive halving within a time
 * budget, using common random numbers to reduce variance between actions.
 *
 * Objective (lexicographic in effect), for a completed craft:
 *   value = 0.10 + 0.80*[quality >= target] + 0.08*tierCredit
 *           + 0.02 * min(quality, target)/target
 *           + 0.01 * margin above target (Reliable mode, capped at +5%, only
 *             while the observed quality is still below the target)
 *           - per-step penalty (0.0004 Reliable, 0.004 Fast)
 * A failed craft is worth ~0 (only its progress breaks ties). Actions that
 * certainly end the craft in failure are never candidates while another
 * legal action exists.
 * so reaching the target dominates, then completing at all, then lower
 * quality tiers, then quality itself as a tie-breaker.
 */
(function (root) {
  'use strict';
  var CS = root.CS = root.CS || require('./sim.js');
  var A = CS.A, COND = CS.COND;

  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------
  // Base policy: fast, condition-aware expert-crafting rules with resource
  // accounting. Used inside rollouts and as the fallback recommendation.
  // Structure: opener -> progress to within one finishing step -> quality
  // (Inner Quiet build, Innovation windows, Great Strides + Byregot) ->
  // finish. Conditions are exploited where the gain is unambiguous.
  // ---------------------------------------------------------------------
  function usable(a, s, st) { return CS.whyNot(a, s, st) === null; }
  function pg(a, s, st) { return CS.progressGain(a, s, st); }

  function finishGain(st) {
    // progress of the planned final step without buffs
    var pot = st.level >= 62 ? (st.level >= 82 ? 180 : 150) : (st.level >= 31 ? 120 : 100);
    return Math.floor(st.baseProgress * pot * 10 * 2 / 2000);
  }
  function finishCp(st) { return st.level >= 62 ? 7 : 0; }

  // Cheapest reliable action that completes the craft now, if any.
  function finisher(s, st, remaining) {
    var list = [A.BasicSynthesis, A.CarefulSynthesis, A.IntensiveSynthesis, A.PrudentSynthesis, A.Groundwork,
      A.DelicateSynthesis, A.RapidSynthesis];
    var best = null, bestCost = 1e9;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!usable(a, s, st)) continue;
      if (CS.successRate(a, s) < 100) continue;
      if (a === A.Groundwork && s.durability < CS.durCost(a, s) && !s.tp) continue;
      if (pg(a, s, st) < remaining) continue;
      var c = CS.cpCost(a, s) + (a === A.Groundwork ? 4 : 0);
      if (c < bestCost) { best = a; bestCost = c; }
    }
    return best;
  }

  function policy(s, st, ctx) {
    var remaining = st.maxProgress - s.progress;
    var fin = finisher(s, st, remaining);
    if (s.quality >= ctx.target) return fin || progressPush(s, st, remaining);
    var window = finishGain(st);
    // Out of durability and no way to repair: finish if possible.
    if (s.durability <= 10 && !fin === false && !canRepair(s, st)) return fin;
    if (s.step === 0) {
      if (usable(A.MuscleMemory, s, st) && remaining > window * 2) return A.MuscleMemory;
      if (usable(A.Reflect, s, st)) return A.Reflect;
    }
    if (remaining > window) {
      var p = progressStep(s, st, remaining, window, ctx);
      if (p) return p;
    }
    var q = qualityStep(s, st, ctx, remaining);
    if (q) return q;
    return fin || progressPush(s, st, remaining);
  }

  function canRepair(s, st) {
    return usable(A.ImmaculateMend, s, st) || usable(A.MastersMend, s, st) ||
      (usable(A.Manipulation, s, st) && s.manip === 0) || usable(A.TrainedPerfection, s, st);
  }

  // Finish the craft as cheaply and safely as possible.
  function progressPush(s, st, remaining) {
    var fin = finisher(s, st, remaining);
    if (fin) return fin;
    if (s.ssh > 0 && usable(A.RapidSynthesis, s, st)) return A.RapidSynthesis;
    if (s.cond === COND.Good && usable(A.IntensiveSynthesis, s, st)) return A.IntensiveSynthesis;
    var gC = pg(A.CarefulSynthesis, s, st) || pg(A.BasicSynthesis, s, st);
    var stepsNeeded = Math.ceil(remaining / Math.max(1, gC));
    var durNeeded = (stepsNeeded - 1) * CS.durCost(A.CarefulSynthesis, s) + 1;
    if (s.durability < durNeeded) {
      if (usable(A.TrainedPerfection, s, st)) return A.TrainedPerfection;
      if (usable(A.ImmaculateMend, s, st) && s.cp - CS.cpCost(A.ImmaculateMend, s) >= 7 * stepsNeeded) return A.ImmaculateMend;
      if (usable(A.MastersMend, s, st) && s.cp - CS.cpCost(A.MastersMend, s) >= 7 * stepsNeeded) return A.MastersMend;
      if (usable(A.Manipulation, s, st) && s.manip === 0 && s.cp - CS.cpCost(A.Manipulation, s) >= 7 * stepsNeeded) return A.Manipulation;
    }
    if (s.vene === 0 && stepsNeeded > 1 && usable(A.Veneration, s, st) && s.cp >= 18 + 7 * stepsNeeded) return A.Veneration;
    var best = null, bestGain = -1;
    var list = [A.Groundwork, A.CarefulSynthesis, A.PrudentSynthesis, A.BasicSynthesis];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!usable(a, s, st)) continue;
      if (a === A.Groundwork && s.durability < CS.durCost(a, s)) continue;
      var g = pg(a, s, st);
      if (g > bestGain) { best = a; bestGain = g; }
    }
    if (best) return best;
    if (usable(A.RapidSynthesis, s, st)) return A.RapidSynthesis;
    return firstUsable(s, st);
  }

  function withTP(a, s, st) {
    // Trained Perfection right before a 20-durability action saves it.
    if ((a === A.PreparatoryTouch || a === A.Groundwork) && usable(A.TrainedPerfection, s, st) &&
        !(s.cond === COND.Sturdy || s.cond === COND.Robust) && s.wn === 0) return A.TrainedPerfection;
    return a;
  }

  function progressStep(s, st, remaining, window, ctx) {
    var cond = s.cond;
    var d = s.durability;
    var cpQ = s.cp; // CP left
    function fits(a) { return usable(a, s, st) && pg(a, s, st) < remaining; }
    function durAfter(a) { return d - CS.durCost(a, s); }
    // Keep Manipulation running in long crafts (standard opener: MuMe -> Manipulation).
    if (s.manip === 0 && usable(A.Manipulation, s, st) && st.maxDurability <= 80 && cpQ >= 96 + 200 &&
        (s.step <= 2 || d <= 25 || cond === COND.Pliant || cond === COND.Primed)) {
      if (!(s.mume > 0 && s.mume <= 2)) return A.Manipulation;
    }
    if (s.ssh > 0 && fits(A.RapidSynthesis) && durAfter(A.RapidSynthesis) >= 6) return A.RapidSynthesis;
    if (cond === COND.Good && fits(A.IntensiveSynthesis) && durAfter(A.IntensiveSynthesis) >= 6) return A.IntensiveSynthesis;
    if (ctx.sshBudget > 0 && s.sshCharges > 0 && s.ssh === 0 && remaining > 2 * pg(A.RapidSynthesis, s, st) &&
        d >= 26 && usable(A.StellarSteadyHand, s, st)) return A.StellarSteadyHand;
    if (s.vene === 0 && usable(A.Veneration, s, st) && remaining > 2 * pg(A.CarefulSynthesis, s, st) && cpQ >= 18 + 150 &&
        (s.mume === 0 || s.mume >= 2)) return A.Veneration;
    if (s.wn === 0 && s.vene > 0 && usable(A.WasteNotII, s, st) && remaining > 2.5 * pg(A.Groundwork, s, st) &&
        cpQ >= 98 + 250 && st.maxDurability <= 70) return A.WasteNotII;
    if ((cond === COND.Sturdy || cond === COND.Robust || cond === COND.Malleable) && fits(A.Groundwork) &&
        d >= CS.durCost(A.Groundwork, s) && durAfter(A.Groundwork) >= 6) return A.Groundwork;
    if (cond === COND.Centered && fits(A.RapidSynthesis) && durAfter(A.RapidSynthesis) >= 11) return A.RapidSynthesis;
    // Low durability: repair before continuing.
    if (d <= 15) {
      if (s.manip === 0 && usable(A.Manipulation, s, st) && cpQ >= 96 + 100) return A.Manipulation;
      if (usable(A.ImmaculateMend, s, st) && st.maxDurability - d >= 40 && cpQ >= 112 + 100) return A.ImmaculateMend;
      if (usable(A.MastersMend, s, st) && cpQ >= 88 + 80) return A.MastersMend;
    }
    // Default progress: Groundwork when buffed and durable, else Careful.
    if ((s.vene > 0 || s.mume > 0) && fits(A.Groundwork) && d >= CS.durCost(A.Groundwork, s) && durAfter(A.Groundwork) >= 16)
      return withTP(A.Groundwork, s, st);
    if (fits(A.CarefulSynthesis) && durAfter(A.CarefulSynthesis) >= 6) return A.CarefulSynthesis;
    if (s.wn === 0 && fits(A.PrudentSynthesis) && durAfter(A.PrudentSynthesis) >= 6) return A.PrudentSynthesis;
    if (fits(A.BasicSynthesis) && durAfter(A.BasicSynthesis) >= 6) return A.BasicSynthesis;
    return null; // progress phase over (or blocked): continue with quality
  }

  function qualityStep(s, st, ctx, remaining) {
    var cond = s.cond;
    var need = ctx.target - s.quality;
    var fcp = finishCp(st);
    var d = s.durability;
    var good = cond === COND.Good || cond === COND.Excellent;
    var sturdy = cond === COND.Sturdy || cond === COND.Robust;
    function cpAfter(x) { return s.cp - CS.cpCost(x, s); }
    function ok(x, extraCp) { return usable(x, s, st) && cpAfter(x) >= fcp + (extraCp || 0) && d - CS.durCost(x, s) >= 1; }
    function qg(x) { return CS.qualityGain(x, s, st); }
    // Byregot finisher reaches the target now.
    if (s.iq > 0 && ok(A.ByregotsBlessing) && qg(A.ByregotsBlessing) >= need) return A.ByregotsBlessing;
    if (s.iq >= 10 && ok(A.TrainedFinesse) && qg(A.TrainedFinesse) >= need) return A.TrainedFinesse;
    // Steady Hand: risk-free Daring/Hasty.
    if (s.exped && ok(A.DaringTouch) && (s.ssh > 0 || CS.successRate(A.DaringTouch, s) >= 85)) return A.DaringTouch;
    if (s.ssh > 0 && ok(A.HastyTouch) && s.iq < 10) return A.HastyTouch;
    // Durability: make sure the next quality actions can be paid for.
    var inCombo = (s.combo === 1 || s.combo === 2) && d >= 11;
    if (!inCombo && (d <= 15 || (d <= 25 && s.manip === 0))) {
      if (usable(A.TrainedPerfection, s, st) && d > 5) {
        // keep it for a Preparatory Touch
      } else if (st.maxDurability - d >= 40 && ok(A.ImmaculateMend, 74)) return A.ImmaculateMend;
      else if (s.manip === 0 && ok(A.Manipulation, 74)) return A.Manipulation;
      else if (d <= 15 && ok(A.MastersMend, 74)) return A.MastersMend;
    }
    if (cond === COND.Pliant) {
      if (s.manip <= 1 && st.maxDurability - d >= 15 && ok(A.Manipulation, 40)) return A.Manipulation;
      if (st.maxDurability - d >= 35 && ok(A.ImmaculateMend, 40)) return A.ImmaculateMend;
      if (s.inno === 0 && ok(A.Innovation, 40)) return A.Innovation;
    }
    if (good) {
      if (s.iq >= 8 && ok(A.ByregotsBlessing) && (s.inno > 0 || s.gs > 0 || s.iq >= 10)) return A.ByregotsBlessing;
      if (s.iq < 10 && ok(A.PreciseTouch)) return A.PreciseTouch;
      if (usable(A.TricksOfTheTrade, s, st) && s.cp < 60) return A.TricksOfTheTrade;
    }
    if (cond === COND.GoodOmen) {
      if (s.inno === 0 && ok(A.Innovation, 30)) return A.Innovation;
      if (s.gs === 0 && s.iq >= 8 && ok(A.GreatStrides, 24)) return A.GreatStrides;
    }
    if (cond === COND.Primed) {
      if (s.inno === 0 && ok(A.Innovation, 40)) return A.Innovation;
      if (s.manip <= 1 && st.maxDurability - d >= 10 && ok(A.Manipulation, 60)) return A.Manipulation;
    }
    // Material Miracle when quality work begins.
    if (ctx.mmBudget > 0 && s.mmCharges > 0 && s.mm === 0 && usable(A.MaterialMiracle, s, st)) return A.MaterialMiracle;
    // Finisher: Great Strides -> (Quick) Innovation -> Byregot.
    var finisherCp = 24 + 32 + 18;
    if (s.iq >= 10 || (s.iq >= 4 && s.cp < fcp + finisherCp + 45)) {
      if (s.gs > 0) {
        if (s.inno === 0 && usable(A.QuickInnovation, s, st)) return A.QuickInnovation;
        if (s.inno === 0 && ok(A.Innovation, 24)) return A.Innovation;
        if (ok(A.ByregotsBlessing)) return A.ByregotsBlessing;
      }
      if (s.gs === 0 && ok(A.GreatStrides, 24)) return A.GreatStrides;
      if (s.iq >= 10 && ok(A.TrainedFinesse, finisherCp) && s.inno > 0) return A.TrainedFinesse;
      if (ok(A.ByregotsBlessing)) return A.ByregotsBlessing;
    }
    // Stellar Steady Hand for free quality (Hasty + Daring) when available.
    if (ctx.sshBudget > 0 && s.sshCharges > 0 && s.ssh === 0 && d >= 26 && s.iq <= 7 && usable(A.StellarSteadyHand, s, st))
      return A.StellarSteadyHand;
    if (s.wn === 0 && s.iq <= 4 && ok(A.WasteNotII, 200) && d <= st.maxDurability - 10 && st.maxDurability <= 70) return A.WasteNotII;
    if (s.inno === 0 && ok(A.Innovation, 50)) return A.Innovation;
    // Builders.
    if (sturdy && s.iq < 10 && ok(A.PreparatoryTouch)) return A.PreparatoryTouch;
    if (cond === COND.Centered && s.iq < 10 && ok(A.HastyTouch) && d >= 21) return A.HastyTouch;
    if (s.combo === 1 && ok(A.RefinedTouch) && s.iq <= 8) return A.RefinedTouch;
    if (s.combo === 1 && ok(A.StandardTouch)) return A.StandardTouch;
    if ((s.combo === 2 || s.combo === 3) && ok(A.AdvancedTouch)) return A.AdvancedTouch;
    if (s.iq < 10 && ok(A.PreparatoryTouch, 30) && (d >= 41 || s.tp || s.wn > 0 || (s.manip >= 2 && d >= 26))) return withTP(A.PreparatoryTouch, s, st);
    if (ok(A.BasicTouch, 18 + 30)) return A.BasicTouch;
    if (s.iq >= 10 && ok(A.TrainedFinesse)) return A.TrainedFinesse;
    if (s.wn === 0 && ok(A.PrudentTouch)) return A.PrudentTouch;
    if (ok(A.BasicTouch)) return A.BasicTouch;
    if (s.iq >= 1 && ok(A.ByregotsBlessing)) return A.ByregotsBlessing;
    if (usable(A.HastyTouch, s, st) && d - CS.durCost(A.HastyTouch, s) >= 1 && need > 0) return A.HastyTouch;
    return null;
  }

  function firstUsable(s, st) {
    for (var i = 0; i < CS.ACTIONS.length; i++) {
      var a = CS.ACTIONS[i];
      if (a.step && usable(a, s, st)) return a;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Value function and rollouts
  // ---------------------------------------------------------------------
  function terminalValue(s, st, ctx) {
    var complete = s.done === 1 ? 1 : 0;
    var t = ctx.target;
    var hit = complete && s.quality >= t ? 1 : 0;
    var tier = 0;
    if (complete && ctx.lowerTiers && ctx.lowerTiers.length) {
      for (var i = 0; i < ctx.lowerTiers.length; i++) if (s.quality >= ctx.lowerTiers[i]) tier++;
      tier = tier / ctx.lowerTiers.length;
    }
    // A failed craft yields nothing; its progress only breaks ties (finishing
    // is the only way to get anything).
    if (!complete) return { v: 0.001 * Math.min(1, s.progress / st.maxProgress) - 0.0001 * s.step, hit: 0, complete: 0, q: s.quality };
    var v = 0.10 + 0.80 * hit + 0.08 * tier + 0.02 * Math.min(s.quality, t) / t;
    // Margin above the target (up to +5%) as a tie-breaker: robustness against
    // the unverified condition model and tier rounding. Reliable mode only.
    if (hit && !ctx.fast && ctx.marginActive) v += 0.01 * Math.min(s.quality - t, 0.05 * t) / (0.05 * t);
    v -= (ctx.fast ? 0.004 : 0.0004) * s.step;
    return { v: v, hit: hit, complete: complete, q: s.quality };
  }

  // Advance the condition after an action (sampled).
  function advance(n, a, st, rnd) {
    if (n.done) return n;
    if (a.step) n.cond = CS.sampleCondition(CS.nextConditionDist(n, st), rnd);
    else if (a === A.CarefulObservation) n.cond = CS.sampleCondition(CS.nextConditionDist(n, st), rnd);
    return n;
  }

  function step(s, a, st, rnd) {
    var rate = CS.successRate(a, s);
    var ok = rate >= 100 ? true : rnd() * 100 < rate;
    var n = CS.apply(a, s, st, ok);
    return advance(n, a, st, rnd);
  }

  function rollout(s0, first, st, ctx, rnd) {
    var s = step(s0, first, st, rnd);
    var guard = 0;
    var nonStep = first.step ? 0 : 1;
    while (!s.done && guard++ < 80) {
      var a = policy(s, st, ctx);
      if (!a) break;
      if (!a.step) { if (++nonStep > 4) { a = firstUsable(s, st); if (!a) break; } } else nonStep = 0;
      s = step(s, a, st, rnd);
    }
    return terminalValue(s, st, ctx);
  }

  function legalActions(s, st) {
    var out = [];
    for (var i = 0; i < CS.ACTIONS.length; i++) {
      var a = CS.ACTIONS[i];
      if (CS.whyNot(a, s, st) !== null) continue;
      if (a === A.FinalAppraisal && s.fa > 0) continue;
      out.push(a);
    }
    return out;
  }
  // True when the action ends the craft in failure whatever happens
  // (durability reaches 0 and even a successful use does not finish it).
  function certainFailure(a, s, st) {
    if (!a.dur || s.tp) return false;
    if (s.durability - CS.durCost(a, s) > 0) return false;
    var n = CS.apply(a, s, st, true);
    return n.done === 2;
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  /*
   * recommend(state, settings, options) -> {
   *   action, reason, estimate {pTarget, pComplete, se, n}, alternatives[], fallback, ms
   * }
   * options: target (quality), lowerTiers [], mode 'reliable'|'fast', timeMs,
   *          sshBudget, mmBudget, seed, minRollouts
   */
  function recommend(s, st, opt) {
    var t0 = now();
    opt = opt || {};
    var ctx = {
      target: Math.max(1, opt.target || st.maxQuality),
      lowerTiers: (opt.lowerTiers || []).filter(function (x) { return x < (opt.target || st.maxQuality); }),
      fast: opt.mode === 'fast',
      // margin only matters while the target is still ahead of the observed state
      marginActive: s.quality < Math.max(1, opt.target || st.maxQuality),
      sshBudget: opt.sshBudget === undefined ? s.sshCharges : opt.sshBudget,
      mmBudget: opt.mmBudget === undefined ? s.mmCharges : opt.mmBudget
    };
    var sCtx = CS.copyState(s);
    // Charges beyond the per-craft budget are hidden from the search.
    sCtx.sshCharges = Math.min(s.sshCharges, ctx.sshBudget);
    sCtx.mmCharges = Math.min(s.mmCharges, ctx.mmBudget);
    var cands = legalActions(sCtx, st);
    var safe = cands.filter(function (a) { return !certainFailure(a, sCtx, st); });
    if (safe.length) cands = safe;
    if (s.done) return { action: null, reason: 'The craft is finished.', estimate: null, alternatives: [], fallback: false, ms: 0 };
    if (!cands.length) return { action: null, reason: 'No usable action: not enough CP or durability for anything.', estimate: null, alternatives: [], fallback: false, ms: 0 };
    var budget = opt.timeMs === undefined ? 400 : opt.timeMs;
    var seed = opt.seed === undefined ? 12345 : opt.seed;
    var heuristic = policy(sCtx, st, ctx);
    if (heuristic && cands.indexOf(heuristic) < 0 && cands.length) heuristic = cands[0];
    if (budget <= 0 || cands.length === 1) {
      var only = cands.length === 1 ? cands[0] : heuristic;
      return { action: only, reason: explain(only, sCtx, st, ctx, null), estimate: null, alternatives: [], fallback: budget <= 0, ms: now() - t0 };
    }
    var stats = cands.map(function (a) { return { a: a, n: 0, sum: 0, sum2: 0, hit: 0, comp: 0, qsum: 0 }; });
    var alive = stats.slice();
    var nTarget = opt.minRollouts || 32;
    var maxTotal = opt.maxRollouts || Infinity;
    var total = 0;
    var timedOut = false;
    while (true) {
      for (var k = 0; k < alive.length; k++) {
        var c = alive[k];
        while (c.n < nTarget) {
          var r = rollout(sCtx, c.a, st, ctx, mulberry32(seed + c.n * 7919));
          c.n++; c.sum += r.v; c.sum2 += r.v * r.v; c.hit += r.hit; c.comp += r.complete; c.qsum += r.complete ? r.q : 0;
          total++;
        }
        if (now() - t0 > budget) { timedOut = true; break; }
      }
      if (total >= maxTotal) timedOut = true;
      alive.sort(function (x, y) { return mean(y) - mean(x); });
      if (timedOut || alive.length <= 1) break;
      // keep the top half, plus anything statistically tied with the leader
      var best = alive[0];
      var keep = Math.max(1, Math.ceil(alive.length / 2));
      var kept = alive.slice(0, keep);
      for (var j = keep; j < alive.length; j++) {
        if (alive[j].n >= nTarget && mean(best) - mean(alive[j]) < 1.5 * (se(best) + se(alive[j]))) kept.push(alive[j]);
      }
      if (kept.length === alive.length && alive.length > 1 && nTarget >= 4096) break;
      alive = kept;
      nTarget *= 2;
      if (nTarget > 8192) break;
    }
    // Choose among fully evaluated candidates (those with the most rollouts).
    var maxN = 0;
    stats.forEach(function (c) { if (c.n > maxN) maxN = c.n; });
    // candidates that survived at least to the last two rounds
    var pool = stats.filter(function (c) { return c.n * 4 >= maxN; });
    if (!pool.length) pool = stats;
    pool.sort(function (x, y) { return mean(y) - mean(x); });
    var chosen = pool[0];
    if (!chosen.a.step && pool.length > 1) {
      // Free actions that do not advance the craft (Heart and Soul, Final
      // Appraisal, Careful Observation, Quick Innovation) are recommended only
      // when they clearly beat the best step action; otherwise they add input
      // for no measurable gain.
      for (var q = 1; q < pool.length; q++) {
        if (pool[q].a.step) {
          var margin = mean(chosen) - mean(pool[q]);
          if (margin < Math.max(0.01, 1.5 * (se(chosen) + se(pool[q])))) chosen = pool[q];
          break;
        }
      }
    }
    if (!ctx.fast && pool.length > 1) {
      // Reliable mode: among statistically tied options prefer guaranteed actions.
      for (var p = 1; p < pool.length; p++) {
        var alt = pool[p];
        var tied = mean(chosen) - mean(alt) < 0.5 * (se(chosen) + se(alt));
        if (tied && CS.successRate(chosen.a, sCtx) < 100 && CS.successRate(alt.a, sCtx) >= 100) { chosen = alt; break; }
      }
    }
    var estimate = {
      pTarget: chosen.hit / chosen.n, pComplete: chosen.comp / chosen.n, n: chosen.n,
      meanQuality: chosen.comp ? Math.round(chosen.qsum / chosen.comp) : 0,
      se: Math.sqrt(Math.max(1e-9, (chosen.hit / chosen.n) * (1 - chosen.hit / chosen.n) / chosen.n))
    };
    var alternatives = stats.slice().sort(function (x, y) { return mean(y) - mean(x); }).slice(0, 5).map(function (c) {
      return { action: c.a, value: mean(c), pTarget: c.hit / c.n, n: c.n };
    });
    return {
      action: chosen.a,
      reason: explain(chosen.a, sCtx, st, ctx, estimate),
      estimate: estimate,
      alternatives: alternatives,
      fallback: false,
      timedOut: timedOut,
      heuristic: heuristic,
      ms: now() - t0
    };
  }
  function mean(c) { return c.n ? c.sum / c.n : -1; }
  function se(c) {
    if (c.n < 2) return 1;
    var m = c.sum / c.n;
    var v = Math.max(0, c.sum2 / c.n - m * m);
    return Math.sqrt(v / c.n);
  }

  // ---------------------------------------------------------------------
  // Short explanations derived from the decision context.
  // ---------------------------------------------------------------------
  function explain(a, s, st, ctx, est) {
    if (!a) return '';
    var remaining = st.maxProgress - s.progress;
    var completes = a.prog && CS.successRate(a, s) >= 100 && CS.progressGain(a, s, st) >= remaining;
    var cn = CS.COND_NAMES[s.cond];
    if (completes && s.quality >= ctx.target) return 'Complete progress now; the quality target is met.';
    if (completes) return 'Finish now: more quality is not reachable with the remaining CP and durability.';
    switch (a) {
      case A.MuscleMemory: return 'Opener: Muscle Memory doubles the next progress action.';
      case A.Reflect: return 'Opener: Reflect gives 300% quality and two Inner Quiet stacks.';
      case A.ByregotsBlessing:
        return (CS.qualityGain(a, s, st) >= ctx.target - s.quality ? 'Reaches the quality target: ' : 'Cash in ' + s.iq + ' Inner Quiet stacks: ') +
          "Byregot's Blessing" + (s.cond === COND.Good ? ' on Good.' : '.');
      case A.PreciseTouch: return 'Use ' + cn + ' for Precise Touch (+2 Inner Quiet).';
      case A.IntensiveSynthesis: return 'Use ' + cn + ' for Intensive Synthesis (400% progress).';
      case A.TricksOfTheTrade: return 'Recover 20 CP on ' + cn + '.';
      case A.Groundwork: return (s.cond === COND.Sturdy || s.cond === COND.Robust) ? cn + ' halves durability loss: Groundwork.' : 'Large progress step while durability allows.';
      case A.PreparatoryTouch: return (s.cond === COND.Sturdy || s.cond === COND.Robust) ? cn + ' halves durability loss: Preparatory Touch.' : 'Build quality and two Inner Quiet stacks.';
      case A.Manipulation: return s.cond === COND.Pliant ? 'Restore durability over 8 steps while Pliant halves the CP cost.' : (s.cond === COND.Primed ? 'Primed: Manipulation lasts 10 steps.' : 'Regenerate durability for the next 8 steps.');
      case A.ImmaculateMend: return s.cond === COND.Pliant ? 'Restore all durability while Pliant halves the CP cost.' : 'Restore all durability for the remaining steps.';
      case A.MastersMend: return 'Restore 30 durability to keep crafting.';
      case A.Innovation: return s.cond === COND.Primed ? 'Primed: Innovation lasts 6 steps.' : (s.cond === COND.GoodOmen ? 'Good comes next: set up Innovation.' : 'Boost quality for the next 4 steps.');
      case A.Veneration: return 'Boost progress for the next 4 steps.';
      case A.GreatStrides: return "Double the next quality action (Byregot's Blessing).";
      case A.StellarSteadyHand: return 'Guarantee success for the next three steps (risky actions become safe).';
      case A.MaterialMiracle: return 'Start Material Miracle: favorable conditions every step for about 45 s.';
      case A.RapidSynthesis: return s.ssh > 0 ? 'Steady Hand active: Rapid Synthesis cannot fail.' : (s.cond === COND.Centered ? 'Centered raises Rapid Synthesis to 75%.' : 'High-output progress at 50% success.');
      case A.HastyTouch: return s.ssh > 0 ? 'Steady Hand active: free Hasty Touch that cannot fail.' : 'Free quality step (60% success).';
      case A.DaringTouch: return s.ssh > 0 ? 'Expedience + Steady Hand: Daring Touch cannot fail.' : 'Expedience is up: Daring Touch.';
      case A.CarefulObservation: return 'Re-roll the condition without spending a step.';
      case A.HeartAndSoul: return 'Allow one Good-only action now.';
      case A.QuickInnovation: return 'Free one-step Innovation.';
      case A.TrainedPerfection: return 'Make the next durability-costing action free.';
      case A.FinalAppraisal: return 'Prevent the next progress action from finishing the craft.';
      case A.Observe: return 'Hold a step; Advanced Touch becomes 18 CP next.';
      case A.WasteNot: case A.WasteNotII: return 'Halve durability loss for upcoming steps.';
      case A.CarefulSynthesis: case A.BasicSynthesis: case A.PrudentSynthesis: case A.DelicateSynthesis:
        return remaining > 0 ? 'Advance progress without finishing yet.' : '';
      default:
        return est ? 'Best simulated outcome among the usable actions.' : 'Heuristic choice.';
    }
  }

  CS.policy = policy;
  CS.recommend = recommend;
  CS.legalActions = legalActions;
  CS.mulberry32 = mulberry32;
  CS.stepSample = step;
  CS.terminalValue = terminalValue;
  CS.certainFailure = certainFailure;
  CS.explain = explain;
  if (typeof module !== 'undefined' && module.exports) module.exports = CS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
