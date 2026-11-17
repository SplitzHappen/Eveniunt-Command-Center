/*
 * Cosmic Exploration crafting simulator (deterministic state transition).
 *
 * Mechanics sources (see docs/MECHANICS.md for the full table):
 *  - Formulas and action order: Raphael simulator (KonaeAkira/raphael-rs,
 *    Apache-2.0) integer arithmetic, cross-checked with the Teamcraft
 *    simulator (MIT) and Craftimizer (MIT). Quality/progress values are
 *    tested against Raphael's in-game-verified sequences.
 *  - Action levels and CP costs: CraftAction / Action game sheets.
 *  - Special actions: Action/ActionTransient/Status sheets (Material Miracle
 *    41269, Stellar Steady Hand 46843).
 *  - Cosmic tool Good-condition bonus (x1.75, phase 9+): Item sheet text.
 * No code from those projects is copied; behaviour was re-implemented.
 */
(function (root) {
  'use strict';
  var CS = root.CS = root.CS || {};

  // ---- conditions -------------------------------------------------------
  // Index = bit position in RecipeLevelTable.ConditionsFlag.
  var COND = {
    Normal: 0, Good: 1, Excellent: 2, Poor: 3, Centered: 4, Sturdy: 5,
    Pliant: 6, Malleable: 7, Primed: 8, GoodOmen: 9, Robust: 10
  };
  var COND_NAMES = ['Normal', 'Good', 'Excellent', 'Poor', 'Centered', 'Sturdy',
    'Pliant', 'Malleable', 'Primed', 'Good Omen', 'Robust'];
  // Conditions Material Miracle guarantees (ActionTransient 41269 text).
  var MM_CONDS = [COND.Good, COND.Sturdy, COND.Centered, COND.Pliant, COND.Primed, COND.Malleable];

  // Community-estimated condition rates. Two independent tools disagree, so
  // both are kept and the app labels success estimates as model-based.
  var COND_MODELS = {
    teamcraft: {
      label: 'Teamcraft simulator rates',
      rates: function (c, expert, level) {
        switch (c) {
          case COND.Good: return expert ? 0.12 : (level >= 63 ? 0.25 : 0.20);
          case COND.Excellent: return expert ? 0 : 0.04;
          case COND.Centered: return 0.15;
          case COND.Sturdy: return 0.15;
          case COND.Pliant: return 0.12;
          case COND.Malleable: return 0.12;
          case COND.Primed: return 0.12;
          case COND.GoodOmen: return 0.10;
          case COND.Robust: return 0.10;
          default: return 0;
        }
      },
      forced: function (c) {
        if (c === COND.Excellent) return COND.Poor;
        if (c === COND.GoodOmen) return COND.Good;
        if (c === COND.Robust) return COND.Sturdy;
        return -1;
      }
    },
    craftimizer: {
      label: 'Craftimizer rates',
      rates: function (c, expert, level) {
        switch (c) {
          case COND.Good: return expert ? 0.12 : (level >= 63 ? 0.15 : 0.18);
          case COND.Excellent: return 0.04;
          case COND.Centered: return 0.15;
          case COND.Sturdy: return 0.15;
          case COND.Pliant: return 0.10;
          case COND.Malleable: return 0.13;
          case COND.Primed: return 0.15;
          case COND.GoodOmen: return 0.12;
          case COND.Robust: return 0.10;
          default: return 0;
        }
      },
      forced: function (c) {
        if (c === COND.Poor || c === COND.Good) return COND.Normal;
        if (c === COND.Excellent) return COND.Poor;
        if (c === COND.GoodOmen) return COND.Good;
        if (c === COND.Robust) return COND.Sturdy;
        return -1;
      }
    }
  };

  // ---- base values ------------------------------------------------------
  var f = Math.fround;
  // Raphael performs these in f32 (raphael-data get_game_settings); doing the
  // same reproduces in-game values where double precision is off by one.
  function baseValues(stats, rl) {
    var bp = f(f(f(f(stats.craftsmanship) * 10) / f(rl.progressDivider)) + 2);
    var bq = f(f(f(f(stats.control) * 10) / f(rl.qualityDivider)) + 35);
    if (stats.level <= rl.level) {
      bp = f(f(bp * f(rl.progressModifier)) / 100);
      bq = f(f(bq * f(rl.qualityModifier)) / 100);
    }
    return { baseProgress: Math.trunc(bp), baseQuality: Math.trunc(bq) };
  }

  // ---- actions ----------------------------------------------------------
  // kind: P progress, Q quality, B buff, R repair, O other.
  // step: whether the action advances the step (ticks buffs, new condition).
  var A = {};
  var ACTIONS = [];
  function def(o) {
    o.id = ACTIONS.length;
    o.step = o.step !== false;
    o.dur = o.dur || 0;
    o.rate = o.rate || 100;
    ACTIONS.push(o);
    A[o.key] = o;
    return o;
  }
  def({ key: 'BasicSynthesis', name: 'Basic Synthesis', level: 1, kind: 'P', cp: 0, dur: 10,
    prog: function (s, st) { return st.level >= 31 ? 120 : 100; } });
  def({ key: 'BasicTouch', name: 'Basic Touch', level: 5, kind: 'Q', cp: 18, dur: 10, qual: 100 });
  def({ key: 'MastersMend', name: "Master's Mend", level: 7, kind: 'R', cp: 88 });
  def({ key: 'HastyTouch', name: 'Hasty Touch', level: 9, kind: 'Q', cp: 0, dur: 10, qual: 100, rate: 60 });
  def({ key: 'RapidSynthesis', name: 'Rapid Synthesis', level: 9, kind: 'P', cp: 0, dur: 10, rate: 50,
    prog: function (s, st) { return st.level >= 63 ? 500 : 250; } });
  def({ key: 'Observe', name: 'Observe', level: 13, kind: 'O', cp: 7 });
  def({ key: 'TricksOfTheTrade', name: 'Tricks of the Trade', level: 13, kind: 'O', cp: 0 });
  def({ key: 'WasteNot', name: 'Waste Not', level: 15, kind: 'B', cp: 56 });
  def({ key: 'Veneration', name: 'Veneration', level: 15, kind: 'B', cp: 18 });
  def({ key: 'StandardTouch', name: 'Standard Touch', level: 18, kind: 'Q', cp: 32, dur: 10, qual: 125 });
  def({ key: 'GreatStrides', name: 'Great Strides', level: 21, kind: 'B', cp: 32 });
  def({ key: 'Innovation', name: 'Innovation', level: 26, kind: 'B', cp: 18 });
  def({ key: 'FinalAppraisal', name: 'Final Appraisal', level: 42, kind: 'B', cp: 1, step: false });
  def({ key: 'WasteNotII', name: 'Waste Not II', level: 47, kind: 'B', cp: 98 });
  def({ key: 'ByregotsBlessing', name: "Byregot's Blessing", level: 50, kind: 'Q', cp: 24, dur: 10 });
  def({ key: 'PreciseTouch', name: 'Precise Touch', level: 53, kind: 'Q', cp: 18, dur: 10, qual: 150 });
  def({ key: 'MuscleMemory', name: 'Muscle Memory', level: 54, kind: 'P', cp: 6, dur: 10,
    prog: function () { return 300; } });
  def({ key: 'CarefulObservation', name: 'Careful Observation', level: 55, kind: 'O', cp: 0, step: false });
  def({ key: 'CarefulSynthesis', name: 'Careful Synthesis', level: 62, kind: 'P', cp: 7, dur: 10,
    prog: function (s, st) { return st.level >= 82 ? 180 : 150; } });
  def({ key: 'Manipulation', name: 'Manipulation', level: 65, kind: 'R', cp: 96 });
  def({ key: 'PrudentTouch', name: 'Prudent Touch', level: 66, kind: 'Q', cp: 25, dur: 5, qual: 100 });
  def({ key: 'AdvancedTouch', name: 'Advanced Touch', level: 68, kind: 'Q', cp: 46, dur: 10, qual: 150 });
  def({ key: 'Reflect', name: 'Reflect', level: 69, kind: 'Q', cp: 6, dur: 10, qual: 300 });
  def({ key: 'PreparatoryTouch', name: 'Preparatory Touch', level: 71, kind: 'Q', cp: 40, dur: 20, qual: 200 });
  def({ key: 'Groundwork', name: 'Groundwork', level: 72, kind: 'P', cp: 18, dur: 20,
    prog: function (s, st) {
      var p = st.level >= 86 ? 360 : 300;
      if (!s.tp && s.durability < durCost(A.Groundwork, s, st)) p = p / 2;
      return p;
    } });
  def({ key: 'DelicateSynthesis', name: 'Delicate Synthesis', level: 76, kind: 'PQ', cp: 32, dur: 10, qual: 100,
    prog: function (s, st) { return st.level >= 94 ? 150 : 100; } });
  def({ key: 'IntensiveSynthesis', name: 'Intensive Synthesis', level: 78, kind: 'P', cp: 6, dur: 10,
    prog: function () { return 400; } });
  def({ key: 'TrainedEye', name: 'Trained Eye', level: 80, kind: 'Q', cp: 250 });
  def({ key: 'HeartAndSoul', name: 'Heart and Soul', level: 86, kind: 'O', cp: 0, step: false });
  def({ key: 'PrudentSynthesis', name: 'Prudent Synthesis', level: 88, kind: 'P', cp: 18, dur: 5,
    prog: function () { return 180; } });
  def({ key: 'TrainedFinesse', name: 'Trained Finesse', level: 90, kind: 'Q', cp: 32, dur: 0, qual: 100 });
  def({ key: 'RefinedTouch', name: 'Refined Touch', level: 92, kind: 'Q', cp: 24, dur: 10, qual: 100 });
  def({ key: 'DaringTouch', name: 'Daring Touch', level: 96, kind: 'Q', cp: 0, dur: 10, qual: 150, rate: 60 });
  def({ key: 'QuickInnovation', name: 'Quick Innovation', level: 96, kind: 'B', cp: 0, step: false });
  def({ key: 'ImmaculateMend', name: 'Immaculate Mend', level: 98, kind: 'R', cp: 112 });
  def({ key: 'TrainedPerfection', name: 'Trained Perfection', level: 100, kind: 'O', cp: 0 });
  def({ key: 'StellarSteadyHand', name: 'Stellar Steady Hand', level: 1, kind: 'B', cp: 0, special: true });
  def({ key: 'MaterialMiracle', name: 'Material Miracle', level: 1, kind: 'O', cp: 0, special: true });

  var COMBO_NONE = 0, COMBO_BASIC = 1, COMBO_STANDARD = 2, COMBO_OBSERVE = 3;

  // ---- state ------------------------------------------------------------
  function initialState(st) {
    return {
      progress: 0, quality: st.startQuality || 0, durability: st.maxDurability, cp: st.maxCp,
      cond: COND.Normal, step: 0,
      iq: 0, inno: 0, vene: 0, gs: 0, wn: 0, manip: 0, mume: 0, fa: 0, exped: 0, ssh: 0,
      mm: 0, hs: 0, tp: 0, combo: COMBO_NONE,
      usedHS: 0, usedQI: 0, usedTP: 0, coCount: 0,
      sshCharges: st.sshCharges || 0, mmCharges: st.mmCharges || 0,
      done: 0
    };
  }
  function copy(s) {
    return {
      progress: s.progress, quality: s.quality, durability: s.durability, cp: s.cp,
      cond: s.cond, step: s.step,
      iq: s.iq, inno: s.inno, vene: s.vene, gs: s.gs, wn: s.wn, manip: s.manip, mume: s.mume,
      fa: s.fa, exped: s.exped, ssh: s.ssh, mm: s.mm, hs: s.hs, tp: s.tp, combo: s.combo,
      usedHS: s.usedHS, usedQI: s.usedQI, usedTP: s.usedTP, coCount: s.coCount,
      sshCharges: s.sshCharges, mmCharges: s.mmCharges, done: s.done
    };
  }

  // ---- costs ------------------------------------------------------------
  function baseCp(a, s) {
    if (a === A.StandardTouch) return s.combo === COMBO_BASIC ? 18 : 32;
    if (a === A.AdvancedTouch) return (s.combo === COMBO_STANDARD || s.combo === COMBO_OBSERVE) ? 18 : 46;
    return a.cp;
  }
  function cpCost(a, s) {
    var c = baseCp(a, s);
    if (s.cond === COND.Pliant) c = Math.ceil(c / 2);
    return c;
  }
  function durCost(a, s) {
    if (!a.dur) return 0;
    if (s.tp) return 0;
    var d = a.dur;
    var div = 1;
    if (s.wn > 0) div *= 2;
    if (s.cond === COND.Sturdy || s.cond === COND.Robust) div *= 2;
    return Math.ceil(d / div);
  }
  function successRate(a, s) {
    if (a.rate >= 100) return 100;
    if (s.ssh > 0) return 100;
    var r = a.rate + (s.cond === COND.Centered ? 25 : 0);
    return r > 100 ? 100 : r;
  }
  function isGoodish(s) { return s.cond === COND.Good || s.cond === COND.Excellent; }

  // ---- legality ---------------------------------------------------------
  // Returns null when usable, otherwise a short reason string.
  function whyNot(a, s, st) {
    if (s.done) return 'craft finished';
    if (st.level < a.level) return 'level ' + a.level + ' required';
    if (st.disabled && st.disabled[a.key]) return 'disabled in settings';
    if (cpCost(a, s) > s.cp) return 'not enough CP';
    switch (a) {
      case A.Manipulation: if (!st.manipulation) return 'Manipulation not learned'; break;
      case A.MuscleMemory: case A.Reflect: if (s.step !== 0) return 'first step only'; break;
      case A.TrainedEye: return 'not usable on these recipes';
      case A.ByregotsBlessing: if (s.iq < 1) return 'needs Inner Quiet'; break;
      case A.TrainedFinesse: if (s.iq < 10) return 'needs 10 Inner Quiet'; break;
      case A.PreciseTouch: case A.IntensiveSynthesis: case A.TricksOfTheTrade:
        if (!isGoodish(s) && !s.hs) return 'needs Good/Excellent or Heart and Soul'; break;
      case A.PrudentTouch: case A.PrudentSynthesis: if (s.wn > 0) return 'not usable under Waste Not'; break;
      case A.DaringTouch: if (!s.exped) return 'needs Expedience (after a successful Hasty Touch)'; break;
      case A.HeartAndSoul: if (!st.specialist) return 'specialist only'; if (s.usedHS) return 'once per craft'; break;
      case A.QuickInnovation:
        if (!st.specialist) return 'specialist only'; if (s.usedQI) return 'once per craft';
        if (s.inno > 0) return 'Innovation already active'; break;
      case A.CarefulObservation: if (!st.specialist) return 'specialist only'; if (s.coCount >= 3) return 'three uses per craft'; break;
      case A.TrainedPerfection: if (s.usedTP) return 'once per craft'; break;
      case A.StellarSteadyHand: if (s.sshCharges < 1) return 'no charges left'; break;
      case A.MaterialMiracle: if (s.mmCharges < 1) return 'no charges left'; if (s.mm > 0) return 'already active'; break;
    }
    return null;
  }
  function canUse(a, s, st) { return whyNot(a, s, st) === null; }

  // ---- gains --------------------------------------------------------------
  function qualityCondQuarter(s, st) {
    switch (s.cond) {
      case COND.Good: return st.cosmicTool ? 7 : 6;
      case COND.Excellent: return 16;
      case COND.Poor: return 2;
      default: return 4;
    }
  }
  function progressGain(a, s, st) {
    if (!a.prog) return 0;
    var pot = a.prog(s, st);
    var eff = 10 + (s.mume > 0 ? 10 : 0) + (s.vene > 0 ? 5 : 0);
    var cond = s.cond === COND.Malleable ? 3 : 2;
    return Math.floor(st.baseProgress * pot * eff * cond / 2000);
  }
  function qualityPotency(a, s) {
    if (a === A.ByregotsBlessing) return 100 + 20 * s.iq;
    return a.qual || 0;
  }
  function qualityGain(a, s, st) {
    var pot = qualityPotency(a, s);
    if (!pot) return 0;
    var eff = (s.iq + 10) * (10 + (s.gs > 0 ? 10 : 0) + (s.inno > 0 ? 5 : 0));
    return Math.floor(st.baseQuality * pot * eff * qualityCondQuarter(s, st) / 40000);
  }

  // ---- transition ---------------------------------------------------------
  // Apply action `a` to state `s`. `success` must be supplied for actions with
  // a success rate below 100 (otherwise ignored). Returns the new state; the
  // condition of the returned state is NOT advanced (caller sets it, either
  // from the player's observation or by sampling via nextCondition).
  function apply(a, s, st, success) {
    var n = copy(s);
    var rate = successRate(a, s);
    var ok = rate >= 100 ? true : !!success;
    var c = cpCost(a, s);
    var d = durCost(a, s);
    var pg = 0, qg = 0;
    if (ok) {
      if (a.prog) {
        pg = progressGain(a, s, st);
        n.progress += pg;
        n.mume = 0;
        if (s.fa > 0 && n.progress >= st.maxProgress) { n.progress = st.maxProgress - 1; n.fa = 0; }
      }
      if (a.qual || a === A.ByregotsBlessing) {
        qg = qualityGain(a, s, st);
        n.quality += qg;
        n.gs = 0;
        if (st.level >= 11) {
          var add = 1;
          if (a === A.PreparatoryTouch || a === A.PreciseTouch || a === A.Reflect) add = 2;
          if (a === A.RefinedTouch && s.combo === COMBO_BASIC) add = 2;
          n.iq = Math.min(10, s.iq + add);
        }
        if (a === A.ByregotsBlessing) n.iq = 0;
      }
    }
    n.cp -= c;
    if (a.dur) {
      if (s.tp) n.tp = 0; else n.durability = Math.max(0, n.durability - d); // saturates at 0 like the game display and Raphael
    }
    // Heart and Soul is spent when its conditional actions are used outside Good/Excellent.
    if ((a === A.PreciseTouch || a === A.IntensiveSynthesis || a === A.TricksOfTheTrade) && !isGoodish(s)) n.hs = 0;
    if (a === A.TricksOfTheTrade) n.cp = Math.min(st.maxCp, n.cp + 20);
    if (a === A.MastersMend) n.durability = Math.min(st.maxDurability, n.durability + 30);
    if (a === A.ImmaculateMend) n.durability = st.maxDurability;

    if (n.progress >= st.maxProgress) n.done = 1;
    else if (n.durability <= 0) n.done = 2;

    if (a.step && !n.done) {
      if (s.manip > 0 && a !== A.Manipulation) n.durability = Math.min(st.maxDurability, n.durability + 5);
      // tick every duration that existed before this action
      if (n.inno > 0) n.inno--;
      if (n.vene > 0) n.vene--;
      if (n.gs > 0) n.gs--;
      if (n.wn > 0) n.wn--;
      if (n.manip > 0) n.manip--;
      if (n.mume > 0) n.mume--;
      if (n.fa > 0) n.fa--;
      if (n.exped > 0) n.exped--;
      if (n.ssh > 0) n.ssh--;
      if (n.mm > 0) n.mm--;
      n.step++;
    } else if (a.step && n.done) {
      n.step++;
    }

    // effects applied by this action (after the tick, so they last fully)
    var primed = s.cond === COND.Primed ? 2 : 0;
    switch (a) {
      case A.Innovation: n.inno = 4 + primed; break;
      case A.Veneration: n.vene = 4 + primed; break;
      case A.GreatStrides: n.gs = 3 + primed; break;
      case A.WasteNot: n.wn = 4 + primed; break;
      case A.WasteNotII: n.wn = 8 + primed; break;
      case A.Manipulation: n.manip = 8 + primed; break;
      case A.FinalAppraisal: n.fa = 5 + primed; break;
      case A.MuscleMemory: if (ok) n.mume = 5 + primed; break;
      case A.HastyTouch: n.exped = (ok && st.level >= 96) ? 1 : 0; break;
      case A.StellarSteadyHand: n.ssh = 3 + primed; n.sshCharges--; break;
      case A.MaterialMiracle: n.mm = st.mmSteps || 12; n.mmCharges--; break;
      case A.HeartAndSoul: n.hs = 1; n.usedHS = 1; break;
      case A.QuickInnovation: n.inno = 1; n.usedQI = 1; break;
      case A.TrainedPerfection: n.tp = 1; n.usedTP = 1; break;
      case A.CarefulObservation: n.coCount++; break;
    }
    if (a !== A.HastyTouch && a.step) n.exped = 0;
    // combo bookkeeping: any action breaks or sets the touch combo
    if (a === A.BasicTouch && ok) n.combo = COMBO_BASIC;
    else if (a === A.StandardTouch && ok && s.combo === COMBO_BASIC) n.combo = COMBO_STANDARD;
    else if (a === A.Observe) n.combo = COMBO_OBSERVE;
    else n.combo = COMBO_NONE;
    n.lastPg = pg; n.lastQg = qg; n.lastOk = ok;
    return n;
  }

  // ---- conditions -----------------------------------------------------------
  // Probability distribution of the next condition after a step action from
  // state `s` (whose .cond is the condition the action was used under).
  function nextConditionDist(s, st) {
    var model = COND_MODELS[st.condModel || 'teamcraft'];
    var forced = model.forced(s.cond);
    if (forced >= 0) return [[forced, 1]];
    if (s.mm > 0) {
      return MM_CONDS.map(function (c) { return [c, 1 / MM_CONDS.length]; });
    }
    var out = [];
    var total = 0;
    for (var c = 1; c < 11; c++) {
      if (st.condFlag >> c & 1) {
        var r = model.rates(c, st.expert, st.level);
        if (r > 0) { out.push([c, r]); total += r; }
      }
    }
    out.unshift([COND.Normal, Math.max(0, 1 - total)]);
    return out;
  }
  function sampleCondition(dist, rnd) {
    var x = rnd();
    for (var i = 0; i < dist.length; i++) {
      x -= dist[i][1];
      if (x < 0) return dist[i][0];
    }
    return dist[dist.length - 1][0];
  }
  // Conditions the player could observe next (for the input buttons).
  function possibleNextConditions(s, st, actionWasStep) {
    if (!actionWasStep) return [s.cond];
    var model = COND_MODELS[st.condModel || 'teamcraft'];
    var set = {};
    var forced = model.forced(s.cond);
    if (forced >= 0) set[forced] = 1;
    for (var c = 0; c < 11; c++) if (st.condFlag >> c & 1) set[c] = 1;
    if (s.mm > 0 || st.mmCharges > 0) MM_CONDS.forEach(function (c) { set[c] = 1; });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }

  // ---- settings -------------------------------------------------------------
  // Build the static craft settings from a recipe profile and crafter stats.
  function makeSettings(recipe, stats, db, opts) {
    opts = opts || {};
    var rlvl = recipe.rlvl;
    var maxDurability = recipe.durability, maxProgress = recipe.progress, maxQuality = recipe.quality;
    var rlRow = db.recipeLevels[String(rlvl)];
    var condFlag = recipe.conditionsFlag;
    if (recipe.maxLevelScaling && stats.level < recipe.maxLevelScaling) {
      // Level-synced recipe below its cap: recipe level follows the
      // GathererCrafterLvAdjustTable; durability base is 80 (Raphael PR #126).
      rlvl = db.levelAdjust[String(stats.level)];
      rlRow = db.recipeLevels[String(rlvl)];
      if (!rlRow) throw new Error('No recipe level row for synced level ' + stats.level);
      maxProgress = Math.floor(rlRow.Difficulty * recipe.difficultyFactor / 100);
      maxQuality = Math.floor(rlRow.Quality * recipe.qualityFactor / 100);
      maxDurability = Math.floor(80 * recipe.durabilityFactor / 100);
      condFlag = rlRow.ConditionsFlag;
    }
    var rl = {
      level: rlRow.ClassJobLevel, progressDivider: rlRow.ProgressDivider, qualityDivider: rlRow.QualityDivider,
      progressModifier: rlRow.ProgressModifier, qualityModifier: rlRow.QualityModifier
    };
    var b = baseValues(stats, rl);
    return {
      rlvl: rlvl, recipeLevel: rl.level, expert: !!recipe.expert, condFlag: condFlag,
      maxProgress: maxProgress, maxQuality: maxQuality, maxDurability: maxDurability, maxCp: stats.cp,
      baseProgress: b.baseProgress, baseQuality: b.baseQuality,
      level: stats.level, specialist: !!stats.specialist, manipulation: stats.manipulation !== false,
      cosmicTool: !!stats.cosmicTool, condModel: opts.condModel || 'teamcraft',
      sshCharges: opts.sshCharges || 0, mmCharges: opts.mmCharges || 0, mmSteps: opts.mmSteps || 12,
      startQuality: 0, disabled: opts.disabled || null,
      requiredCraftsmanship: recipe.requiredCraftsmanship || 0, requiredControl: recipe.requiredControl || 0
    };
  }

  CS.COND = COND;
  CS.COND_NAMES = COND_NAMES;
  CS.MM_CONDS = MM_CONDS;
  CS.COND_MODELS = COND_MODELS;
  CS.ACTIONS = ACTIONS;
  CS.A = A;
  CS.baseValues = baseValues;
  CS.initialState = initialState;
  CS.copyState = copy;
  CS.cpCost = cpCost;
  CS.durCost = durCost;
  CS.successRate = successRate;
  CS.whyNot = whyNot;
  CS.canUse = canUse;
  CS.progressGain = progressGain;
  CS.qualityGain = qualityGain;
  CS.apply = apply;
  CS.nextConditionDist = nextConditionDist;
  CS.sampleCondition = sampleCondition;
  CS.possibleNextConditions = possibleNextConditions;
  CS.makeSettings = makeSettings;
  if (typeof module !== 'undefined' && module.exports) module.exports = CS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
