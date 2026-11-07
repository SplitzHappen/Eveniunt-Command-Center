/* Eveniunt Atelier — offline crafting solver.
 * Raphael (KonaeAkira/raphael-rs, Apache-2.0) supplies recipes, the solver, the simulator and macro text
 * through the embedded WebAssembly bridge. The live guide for expert recipes is the Eveniunt Cosmic engine (CS).
 * Manually operated: nothing here reads the game or sends input to it. */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var DATA = JSON.parse($('#atelier-data').textContent);
  var ENGINE_SRC = $('#engine').textContent;   // CS: guide simulator + rollout planner
  var GLUE_SRC = $('#raphael-glue').textContent; // wasm-bindgen glue for the Raphael bridge
  var CS = window.CS, A = CS.A, COND = CS.COND;
  var B = null;           // main-thread Raphael bridge instance
  var WASM_MODULE = null; // compiled module, shared with the solver worker
  var STORE = 'eveniunt-atelier-v1';
  var LOCALES = [['en', 'English'], ['de', 'Deutsch'], ['fr', 'Français'], ['jp', '日本語'], ['cn', '简体中文'], ['kr', '한국어'], ['tw', '繁體中文']];
  var ABBR = { BasicSynthesis: 'BS', CarefulSynthesis: 'CS', Groundwork: 'GW', PrudentSynthesis: 'PS', IntensiveSynthesis: 'IS', RapidSynthesis: 'RS',
    MuscleMemory: 'MM', DelicateSynthesis: 'DS', BasicTouch: 'BT', StandardTouch: 'ST', AdvancedTouch: 'AT', PrudentTouch: 'PT', PreparatoryTouch: 'PREP',
    PreciseTouch: 'PRC', RefinedTouch: 'RT', ByregotsBlessing: 'BYR', TrainedFinesse: 'TF', Reflect: 'RFL', HastyTouch: 'HT', DaringTouch: 'DT',
    TrainedEye: 'EYE', Innovation: 'INN', Veneration: 'VEN', GreatStrides: 'GS', WasteNot: 'WN', WasteNotII: 'WN2', Manipulation: 'MANI',
    MastersMend: 'MEND', ImmaculateMend: 'IMM', Observe: 'OBS', TricksOfTheTrade: 'TOT', HeartAndSoul: 'H&S', QuickInnovation: 'QI',
    TrainedPerfection: 'TP', CarefulObservation: 'CO', FinalAppraisal: 'FA', StellarSteadyHand: 'SSH', MaterialMiracle: 'MIR' };
  var RKEY = { MasterMend: 'MastersMend', WasteNot2: 'WasteNotII' }; // Raphael key -> engine key
  var COND_KEYS = { 0: 'n', 1: 'g', 2: 'e', 3: 'p', 4: 'c', 5: 's', 6: 'l', 7: 'm', 8: 'r', 9: 'o', 10: 'b' };
  var KEY_CONDS = {}; Object.keys(COND_KEYS).forEach(function (c) { KEY_CONDS[COND_KEYS[c]] = +c; });
  var ZONES = ['SinusArdorum', 'Phaenna', 'Oizys', 'Auxesia'];
  var PLANETS = { 'sinus-ardorum': [0, 'Sinus Ardorum'], phaenna: [1, 'Phaenna'], oizys: [2, 'Oizys'], auxesia: [3, 'Auxesia'] };
  var RANKS = ['D', 'C', 'B', 'A', 'EX', 'EX+', 'Master'];
  var JOB_CODES = ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'];
  // In-game action icons per job (from Raphael's assets, © SQUARE ENIX); decoded to blob URLs on first use.
  var ICONS = JSON.parse($('#icons').textContent), ICON_URLS = {};
  function iconUrl(enName, job) {
    var m = ICONS.map[JOB_CODES[job]], h = m && m[enName];
    if (!h) return null;
    if (!ICON_URLS[h]) ICON_URLS[h] = URL.createObjectURL(new Blob([b64(ICONS.img[h])], { type: 'image/webp' }));
    return ICON_URLS[h];
  }

  // ── storage (works when blocked: in-memory fallback) ──────────────────────
  var mem = {};
  var canStore = (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } })();
  function load() { try { if (canStore) return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { /* ignore */ } return mem[STORE] || null; }
  function persist() {
    var d = { locale: S.locale, theme: S.theme, layout: S.layout, job: S.job, stats: S.stats, cosmicTool: S.cosmicTool, food: S.food, potion: S.potion,
      mode: S.mode, activeJobOnly: S.activeJobOnly, zone: S.zone, recipeId: S.recipeId, custom: S.custom, target: S.target, solver: S.solver,
      macro: S.macro, saved: S.saved, history: S.history, savedCfg: S.savedCfg, guideMs: S.guideMs, condModel: S.condModel, mmSecPerStep: S.mmSecPerStep, look: S.look };
    try { if (canStore) { localStorage.setItem(STORE, JSON.stringify(d)); return; } } catch (e) { canStore = false; }
    mem[STORE] = d;
  }

  // ── state ────────────────────────────────────────────────────────────────
  function defaultStats() { return { level: 100, craftsmanship: 4900, control: 4800, cp: 620, manipulation: true, heartAndSoul: false, quickInnovation: false }; }
  var S = {
    locale: 'en', theme: 'system', layout: 'default', job: 0, stats: [0, 1, 2, 3, 4, 5, 6, 7].map(defaultStats), cosmicTool: true,
    food: null, potion: null, mode: 'recipes', search: '', activeJobOnly: true, zone: -1, recipeId: null, recipe: null,
    custom: { rlvl: 690, jobLevel: 100, maxProgress: 6600, maxQuality: 12000, maxDurability: 80, expert: false, override: false, baseProgress: 0, baseQuality: 0 },
    hqMat: [0, 0, 0, 0, 0, 0], iqMode: 'materials', iqValue: 0,
    target: { kind: 'full', value: 0 }, solver: { adversarial: false, backload: false, mustReach: false, ssh: 0 },
    macro: { splitMacro: true, includeDelay: true, extraDelay: 0, notificationEnabled: false, defaultNotification: true, notificationSound: 1,
      customNotificationFormat: '/echo Macro #{index} finished <se.1>', differentLastNotification: false, customLastNotificationFormat: '/echo Craft finished <se.2>',
      avoidSingleActionMacro: false, introEnabled: false, defaultIntro: true, customIntroFormat: '/mlock' },
    saved: [], history: [], savedCfg: { loadFromSaved: true, op: 'rotation', maxHistory: 50 },
    guideMs: 500, condModel: 'teamcraft', mmSecPerStep: 3,
    pane: 'recipe', solving: null, result: null, guide: null
  };
  (function restore() {
    var d = load();
    if (!d) return;
    ['locale', 'theme', 'layout', 'job', 'cosmicTool', 'food', 'potion', 'mode', 'activeJobOnly', 'zone', 'recipeId', 'target', 'guideMs', 'condModel', 'mmSecPerStep']
      .forEach(function (k) { if (d[k] !== undefined) S[k] = d[k]; });
    if (Array.isArray(d.stats) && d.stats.length === 8) S.stats = d.stats.map(function (x) { return Object.assign(defaultStats(), x); });
    ['custom', 'solver', 'macro', 'savedCfg'].forEach(function (k) { if (d[k]) Object.assign(S[k], d[k]); });
    if (S.theme === 'celadon') S.theme = 'light'; if (S.theme === 'jade') S.theme = 'dark';
    if (Array.isArray(d.saved)) S.saved = d.saved;
    if (Array.isArray(d.history)) S.history = d.history;
  })();

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clean(s) { return String(s || '').replace(/[-]/g, '').trim(); }
  function fmt(n) { return (n || 0).toLocaleString('en-US'); }
  function clampInt(v, lo, hi, d) { v = Math.floor(+v); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); }
  // Raphael's translations where a label is shared with Raphael's interface; English otherwise.
  function t(en, vars) {
    var row = DATA.i18n[en];
    var s = (S.locale !== 'en' && row && row[S.locale]) || en;
    s = s.replace(/^[\u{1F300}-\u{1FAFF}☀-➿]️?\s*/u, '');
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace(new RegExp('\\{' + k + '(:[^}]*)?\\}', 'g'), vars[k]); });
    return s;
  }
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toast.h); toast.h = setTimeout(function () { el.classList.add('hidden'); }, 2600);
  }
  function call(name) { // call into the main-thread bridge, parse JSON
    var args = [].slice.call(arguments, 1);
    var out = B[name].apply(null, args);
    var v = typeof out === 'string' ? JSON.parse(out) : out;
    if (v && v.error) throw new Error(v.error);
    return v;
  }
  var ACTIONS = [];       // Raphael action list for the current locale
  var EN_NAME = {};
  var ZONE_NAMES = [];       // engine key -> English action name (icon file names)
  var JOBS = [];
  var MEALS = [], POTIONS = [];
  function loadLocaleData() {
    if (!Object.keys(EN_NAME).length) call('actions', 'en').forEach(function (a) { EN_NAME[RKEY[a.key] || a.key] = a.name; });
    ACTIONS = call('actions', S.locale);
    ZONE_NAMES = call('zone_names', S.locale);
    ALL = {};
    JOBS = call('job_names', S.locale);
    MEALS = call('meals', S.locale);
    POTIONS = call('potions', S.locale);
  }
  function engineKey(rIndex) { var k = ACTIONS[rIndex].key; return RKEY[k] || k; }
  function stats() { return S.stats[S.job]; }
  function consumable(list, sel) { return sel ? list.find(function (c) { return c.id === sel.id && c.hq === sel.hq; }) || null : null; }
  function bonus(base, rel, max) { return Math.min(Math.floor(base * rel / 100), max); }
  function effective(st, food, potion) {
    var f = consumable(MEALS, food), p = consumable(POTIONS, potion);
    var add = function (key, rel, max) { return [f, p].reduce(function (a, c) { return a + (c ? bonus(st[key], c[rel], c[max]) : 0); }, 0); };
    return { craftsmanship: st.craftsmanship + add('craftsmanship', 'craftRel', 'craftMax'), control: st.control + add('control', 'controlRel', 'controlMax'),
      cp: st.cp + add('cp', 'cpRel', 'cpMax'), plus: [add('craftsmanship', 'craftRel', 'craftMax'), add('control', 'controlRel', 'controlMax'), add('cp', 'cpRel', 'cpMax')] };
  }

  // ── requests and targets ─────────────────────────────────────────────────
  function baseReq(over) {
    over = over || {};
    var st = stats();
    var food = 'food' in over ? over.food : S.food, potion = 'potion' in over ? over.potion : S.potion;
    var req = {
      stats: { craftsmanship: st.craftsmanship, control: st.control, cp: st.cp, level: st.level, manipulation: st.manipulation,
        heartAndSoul: st.heartAndSoul, quickInnovation: st.quickInnovation },
      food: food ? [food.id, food.hq] : null, potion: potion ? [potion.id, potion.hq] : null,
      hqIngredients: S.hqMat, adversarial: S.solver.adversarial, backloadProgress: S.solver.backload, mustReachTarget: S.solver.mustReach,
      sshCharges: S.solver.ssh
    };
    if (S.mode === 'custom') {
      req.custom = { rlvl: S.custom.rlvl, jobLevel: S.custom.jobLevel, maxProgress: S.custom.maxProgress, maxQuality: S.custom.maxQuality,
        maxDurability: S.custom.maxDurability, expert: S.custom.expert,
        baseProgress: S.custom.override ? S.custom.baseProgress : null, baseQuality: S.custom.override ? S.custom.baseQuality : null };
    } else req.recipeId = S.recipeId;
    if (S.iqMode === 'value') req.initialQuality = S.iqValue;
    return req;
  }
  function hasRecipe() { return S.mode === 'custom' || !!S.recipeId; }
  function isExpert() { return S.mode === 'custom' ? !!S.custom.expert : !!(S.recipe && S.recipe.expert); }
  function cosmicInfo() { return S.recipeId && S.mode !== 'custom' ? DATA.cosmic[String(S.recipeId)] || null : null; }
  function targetOptions(maxQ) {
    var o = [
      ['zero', t('0% quality'), 0], ['half', t('50% quality'), Math.floor(maxQ / 2)],
      ['t1', t('55% quality'), Math.floor(maxQ * 55 / 100)], ['t2', t('75% quality'), Math.floor(maxQ * 75 / 100)],
      ['t3', t('95% quality'), Math.floor(maxQ * 95 / 100)], ['full', t('100% quality'), maxQ]
    ];
    var c = cosmicInfo();
    if (c && c.tiers) c.tiers.forEach(function (q, i) { o.push(['c' + (i + 1), 'Cosmic tier ' + (i + 1), q]); });
    o.push(['custom', t('Custom'), S.target.value || maxQ]);
    return o;
  }
  function resolveTarget(maxQ) {
    var o = targetOptions(maxQ).find(function (x) { return x[0] === S.target.kind; }) || ['full', '', maxQ];
    return Math.max(0, Math.min(maxQ, o[0] === 'custom' ? (S.target.value || 0) : o[2]));
  }
  function fullReq(over) {
    var req = baseReq(over);
    var st = call('settings', JSON.stringify(req));
    req.targetQuality = resolveTarget(st.maxQuality);
    return req;
  }

  // ── workers ──────────────────────────────────────────────────────────────
  var solver = { w: null, ready: null, seq: 0, jobs: {} };
  // Hosted app (https, cross-origin isolated by sw.js): Raphael's multi-core build in a module worker.
  // Opened from a file, or if anything fails: the single-core embedded build below.
  var HOSTED = /^https?:$/.test(location.protocol);
  var CORES = 1;
  function canMultiCore() { return HOSTED && self.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined' && !startSolverWorker.mtFailed; }
  function startSolverWorker() {
    if (canMultiCore()) {
      var n = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4));
      var mw;
      try { mw = new Worker('mt/solver-worker.js', { type: 'module' }); } catch (e) { startSolverWorker.mtFailed = true; return startSolverWorker(); }
      solver.w = mw;
      solver.ready = new Promise(function (resolve) {
        var fallback = function () { startSolverWorker.mtFailed = true; CORES = 1; mw.terminate(); startSolverWorker(); solver.ready.then(resolve); };
        mw.onmessage = function (e) {
          if (e.data.type === 'ready') { CORES = e.data.threads; mw.onmessage = onSolverMessage; resolve(); }
          else if (e.data.type === 'init-failed') fallback();
        };
        mw.onerror = fallback;
      });
      mw.postMessage({ type: 'init', threads: n });
      return;
    }
    var src = GLUE_SRC + '\n;(' + function () {
      var ready = null;
      self.onmessage = function (e) {
        var d = e.data;
        if (d.type === 'init') {
          ready = wasm_bindgen({ module_or_path: d.module || d.bytes }).then(function () { self.postMessage({ type: 'ready' }); },
            function (err) { self.postMessage({ type: 'init-failed', error: String(err) }); });
          return;
        }
        ready.then(function () {
          var last = 0;
          try {
            var out = wasm_bindgen.solve(d.req, function (n) { var now = Date.now(); if (now - last > 120) { last = now; self.postMessage({ type: 'progress', id: d.id, nodes: n }); } },
              function (acts) { self.postMessage({ type: 'partial', id: d.id, actions: Array.from(acts) }); });
            self.postMessage({ type: 'done', id: d.id, out: out });
          } catch (err) { self.postMessage({ type: 'done', id: d.id, out: JSON.stringify({ error: String(err) }) }); }
        });
      };
    }.toString() + ')();';
    var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    solver.w = w;
    solver.ready = new Promise(function (resolve, reject) {
      w.onmessage = function (e) {
        var d = e.data;
        if (d.type === 'ready') { resolve(); w.onmessage = onSolverMessage; }
        else if (d.type === 'init-failed') { w.postMessage({ type: 'init', bytes: WASM_BYTES }); }
      };
      w.onerror = function (err) { reject(err); };
    });
    try { w.postMessage({ type: 'init', module: WASM_MODULE }); } catch (e) { w.postMessage({ type: 'init', bytes: WASM_BYTES }); }
  }
  function onSolverMessage(e) {
    var d = e.data, job = solver.jobs[d.id];
    if (!job) return;
    if (d.type === 'progress') job.onProgress(d.nodes);
    else if (d.type === 'partial') job.onPartial(d.actions);
    else if (d.type === 'done') { delete solver.jobs[d.id]; job.resolve(JSON.parse(d.out)); }
  }
  function solveAsync(req, onProgress, onPartial) {
    var id = ++solver.seq;
    return solver.ready.then(function () {
      return new Promise(function (resolve) {
        solver.jobs[id] = { resolve: resolve, onProgress: onProgress || function () {}, onPartial: onPartial || function () {} };
        solver.w.postMessage({ id: id, req: JSON.stringify(req) });
      });
    });
  }
  function cancelSolves() {
    if (solver.w) solver.w.terminate();
    Object.keys(solver.jobs).forEach(function (k) { solver.jobs[k].resolve({ error: 'Interrupted' }); });
    solver.jobs = {};
    startSolverWorker();
  }
  var guideWorker = null, guideSeq = 0;
  function guideAsk(state, st, opt) {
    if (!guideWorker) {
      var src = ENGINE_SRC + '\n;self.onmessage=function(e){var d=e.data;try{var r=CS.recommend(d.state,d.st,d.opt);' +
        'self.postMessage({id:d.id,ok:true,r:{action:r.action?r.action.id:null,reason:r.reason,estimate:r.estimate,ms:r.ms,fallback:r.fallback,' +
        'alternatives:(r.alternatives||[]).map(function(a){return{action:a.action.id,pTarget:a.pTarget,n:a.n};})}});}catch(err){self.postMessage({id:d.id,ok:false,error:String(err)});}};';
      guideWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    }
    var id = ++guideSeq;
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { resolve({ ok: false, error: 'timeout' }); }, Math.max(5000, (opt.timeMs || 500) * 8));
      var prev = guideWorker.onmessage;
      guideWorker.addEventListener('message', function h(e) {
        if (e.data.id !== id) return;
        guideWorker.removeEventListener('message', h); clearTimeout(timer); resolve(e.data);
      });
      guideWorker.postMessage({ id: id, state: state, st: st, opt: opt });
      void prev;
    });
  }

  // ── guide settings from Raphael settings ─────────────────────────────────
  function condFlag() {
    if (S.mode === 'custom') return S.custom.expert ? 1011 : 15;
    var f = S.recipe ? DATA.condFlags[String(S.recipe.rlvl)] : 15;
    return f == null ? 15 : f;
  }
  function guideSettings(rs, req) {
    var st = stats();
    var c = cosmicInfo();
    return {
      maxProgress: rs.maxProgress, maxQuality: rs.maxQuality, maxDurability: rs.maxDurability, maxCp: rs.maxCp,
      baseProgress: rs.baseProgress, baseQuality: rs.baseQuality, level: rs.jobLevel,
      specialist: !!(st.heartAndSoul || st.quickInnovation), manipulation: st.manipulation, cosmicTool: !!S.cosmicTool,
      expert: isExpert(), condFlag: condFlag(), condModel: S.condModel,
      sshCharges: req.sshCharges || (c ? c.ssh : 0) || 0, mmCharges: c ? c.mm : 0,
      mmSteps: Math.max(1, Math.round(45 / S.mmSecPerStep)), startQuality: rs.initialQuality, disabled: null
    };
  }
  // Replay a fixed macro under random conditions with the guide engine.
  function macroMonteCarlo(actions, gst, target, n) {
    var hits = 0, complete = 0;
    for (var i = 0; i < n; i++) {
      var rnd = CS.mulberry32(9000 + i);
      var s = CS.initialState(gst);
      s.mmCharges = 0;
      for (var k = 0; k < actions.length && !s.done; k++) {
        var a = A[engineKey(actions[k])];
        if (!a || CS.whyNot(a, s, gst)) { s.done = 2; break; }
        s = CS.stepSample(s, a, gst, rnd);
      }
      if (s.done === 1) { complete++; if (s.quality >= target) hits++; }
    }
    return { n: n, hits: hits, complete: complete };
  }

  // ── solve flow ───────────────────────────────────────────────────────────
  function solveKey(req) { return JSON.stringify(req); }
  function findCached(req) {
    var key = solveKey(req);
    var hit = S.saved.concat(S.history).find(function (r) { return r.key === key; });
    return hit || null;
  }
  function solveNow(opts) {
    opts = opts || {};
    if (!hasRecipe()) { toast(t('Recipe') + ': ?'); return; }
    var req;
    try { req = fullReq(); } catch (e) { toast(e.message); return; }
    if (S.savedCfg.loadFromSaved && !opts.force) {
      var c = findCached(req);
      if (c) { showResult(req, c.actions, 0, true); return; }
    }
    if (S.solving) cancelSolves();
    var t0 = performance.now();
    S.solving = { nodes: 0, t0: t0, partial: null };
    S.result = null;
    renderCrafter(); renderRotation();
    var tick = setInterval(function () { if (S.solving) updateSolveMeta(); }, 100);
    solveAsync(req, function (n) { if (S.solving) S.solving.nodes = n; }, function (acts) { if (S.solving) S.solving.partial = acts; }).then(function (r) {
      clearInterval(tick);
      if (!S.solving) return;
      var dur = (performance.now() - t0) / 1000;
      S.solving = null;
      if (r.error) {
        if (r.error === 'Interrupted') { renderCrafter(); renderRotation(); return; }
        S.result = { error: r.error, req: req };
        renderCrafter(); renderRotation();
        return;
      }
      addHistory(req, r.actions, dur);
      showResult(req, r.actions, dur, false);
    });
  }
  function updateSolveMeta() {
    var el = $('#solve-meta');
    if (el && S.solving) el.innerHTML = '<span>' + esc(t('{num} nodes visited', { num: fmt(S.solving.nodes) })) + '</span><span>' +
      ((performance.now() - S.solving.t0) / 1000).toFixed(1) + ' s</span>';
  }
  function addHistory(req, actions, dur) {
    var item = { id: 'h' + Date.now().toString(36), key: solveKey(req), name: S.recipe ? clean(S.recipe.name) : 'Custom recipe', req: req, actions: actions,
      recipeId: S.mode === 'custom' ? null : S.recipeId, custom: S.mode === 'custom' ? Object.assign({}, S.custom) : null,
      food: S.food, potion: S.potion, job: S.job, stats: Object.assign({}, stats()), duration: dur, at: Date.now() };
    S.history.unshift(item);
    S.history = S.history.slice(0, S.savedCfg.maxHistory);
    persist();
  }
  function evaluate(req, actions) {
    var sim = call('simulate', JSON.stringify(req), Uint32Array.from(actions));
    var rs = sim.settings;
    var last = sim.steps[sim.steps.length - 1] || { progress: 0, quality: 0, durability: rs.maxDurability, cp: rs.maxCp };
    var quality = (last.quality || 0) + (rs.initialQuality || 0);
    var errorAt = sim.steps.findIndex(function (s) { return s.error; });
    var complete = errorAt < 0 && last.progress >= rs.maxProgress;
    var normalOk = complete && quality >= rs.targetQuality;
    var v = { rs: rs, steps: sim.steps, quality: quality, complete: complete, normalOk: normalOk, errorAt: errorAt, mc: null };
    if (isExpert() && actions.length) {
      v.gst = guideSettings(rs, req);
      v.mc = macroMonteCarlo(actions, v.gst, rs.targetQuality, 3000);
      v.reliable = normalOk && v.mc.hits === v.mc.n;
    } else v.reliable = normalOk;
    return v;
  }
  function showResult(req, actions, dur, fromHistory) {
    var v;
    try { v = evaluate(req, actions); } catch (e) { S.result = { error: e.message, req: req }; renderRotation(); return; }
    S.result = { req: req, actions: actions, duration: dur, fromHistory: fromHistory, v: v, guideEst: null, escalation: null };
    renderCrafter(); renderRotation();
    if (S.pane !== 'rotation' && window.matchMedia('(max-width: 860px)').matches) { setPane('rotation'); window.scrollTo(0, 0); }
    if (isExpert() && !v.reliable) estimateGuide(S.result);
    if (!v.reliable) escalate(S.result);
  }
  function estimateGuide(res) {
    var gst = res.v.gst;
    var s = CS.initialState(gst);
    var c = cosmicInfo();
    guideAsk(s, gst, { target: res.v.rs.targetQuality, lowerTiers: c && c.tiers ? c.tiers : [], timeMs: 1200, seed: 7 }).then(function (r) {
      if (S.result !== res) return;
      res.guideEst = r.ok && r.r.estimate ? r.r.estimate : { pTarget: null };
      renderRotation();
    });
  }
  // Best latest-tier HQ consumable for these stats: the largest effective gain (control and CP weigh most, since quality is what falls short).
  function bestOf(list, st) {
    var hq = list.filter(function (c) { return c.hq; });
    if (!hq.length) return null;
    var top = Math.max.apply(null, hq.map(function (c) { return c.ilvl; }));
    var score = function (c) { return bonus(st.control, c.controlRel, c.controlMax) + 2 * bonus(st.cp, c.cpRel, c.cpMax) + 0.5 * bonus(st.craftsmanship, c.craftRel, c.craftMax); };
    return hq.filter(function (c) { return c.ilvl === top; }).sort(function (a, b) { return score(b) - score(a); })[0];
  }
  function escalate(res) {
    var st = stats();
    var food = bestOf(MEALS, st), potion = bestOf(POTIONS, st);
    var steps = [];
    if (food && !(S.food && S.food.id === food.id && S.food.hq)) steps.push({ food: { id: food.id, hq: true }, potion: S.potion });
    if (food && potion && !(S.potion && S.potion.id === potion.id && S.potion.hq)) steps.push({ food: { id: food.id, hq: true }, potion: { id: potion.id, hq: true } });
    if (!steps.length) { res.escalation = { done: true, found: null, tried: 0 }; renderRotation(); return; }
    res.escalation = { done: false, step: 0, total: steps.length, found: null };
    renderRotation();
    var i = 0;
    (function next() {
      if (S.result !== res) return;
      if (i >= steps.length) { res.escalation.done = true; renderRotation(); return; }
      res.escalation.step = i + 1;
      renderRotation();
      var loadout = steps[i];
      var req;
      try { req = fullReq(loadout); } catch (e) { res.escalation.done = true; renderRotation(); return; }
      var cached = findCached(req);
      var go = cached ? Promise.resolve({ actions: cached.actions }) : solveAsync(req);
      go.then(function (r) {
        if (S.result !== res) return;
        if (!r.error && r.actions && r.actions.length) {
          var v = evaluate(req, r.actions);
          if (v.reliable) { res.escalation = { done: true, found: { loadout: loadout, actions: r.actions, req: req, v: v } }; renderRotation(); return; }
        }
        i++; next();
      });
    })();
  }
  function applyLoadout() {
    var f = S.result && S.result.escalation && S.result.escalation.found;
    if (!f) return;
    S.food = f.loadout.food; S.potion = f.loadout.potion;
    persist();
    addHistory(f.req, f.actions, 0);
    showResult(f.req, f.actions, 0, true);
    toast(t('Food') + ' + ' + t('Potion') + ' ✓');
  }

  // ── rendering: recipe pane ───────────────────────────────────────────────
  var SUBS = { I: 'What you will make', II: 'Who is making it', III: 'How to make it' };
  function paneHead(no, title, extra) {
    return '<div class="pane-head"><span class="no">' + no + '</span><div class="ttl"><h2>' + esc(title) + '</h2><em>' + esc(SUBS[no] || '') + '</em></div><span class="grow"></span>' + (extra || '') + '</div>';
  }
  function renderRecipe() {
    var el = $('#pane-recipe');
    var h = paneHead('I', t('Recipe'));
    h += '<div class="pane-body recipe-body"><div class="rc-a">';
    h += '<div class="seg" role="tablist">' + [['recipes', t('Recipe')], ['missions', t('Stellar missions')], ['custom', t('Custom')]].map(function (m) {
      return '<button data-act="mode" data-v="' + m[0] + '" class="' + (S.mode === m[0] ? 'on' : '') + '">' + esc(m[1]) + '</button>';
    }).join('') + '</div>';
    if (S.mode === 'custom') h += customForm();
    else {
      h += '<input id="q" class="inp" type="search" autocomplete="off" placeholder="' + esc(t('🔍 Search')) + '" value="' + esc(S.search) + '" aria-label="Search">';
      h += '<div class="row"><label class="check"><input id="activejob" type="checkbox"' + (S.activeJobOnly ? ' checked' : '') + '> ' + esc(t('Active job only')) + '</label>';
      if (S.mode === 'missions') {
        var zn = call('zone_names', S.locale);
        h += '<select id="zone" class="inp" style="width:auto;min-height:32px">' + '<option value="-1">' + esc(t('All')) + '</option>' +
          zn.map(function (z, i) { return '<option value="' + i + '"' + (S.zone === i ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select>';
      }
      h += '<span class="grow" style="flex:1"></span><span class="label" id="results-count"></span></div><div class="list" id="results"></div>';
    }
    h += '</div><div id="spec" class="rc-b"></div></div>';
    el.innerHTML = h;
    if (S.mode !== 'custom') renderResults();
    renderSpec();
  }
  // Every recipe of a job (or all jobs) from Raphael, cached per locale: id -> row.
  var ALL = {};
  function allRecipes(job) {
    var k = String(job);
    if (!ALL[k]) { var m = {}; call('search_recipes', '', S.locale, job, 1e6).forEach(function (r) { m[r.id] = r; }); ALL[k] = m; }
    return ALL[k];
  }
  function rankIx(r) { var i = RANKS.indexOf(r); return i < 0 ? 99 : i; }
  function divName(d) {
    if (d.level) return 'Lv ' + d.name.en.replace('-', '–');
    var n = d.name[S.locale] || d.name.en || '';
    // pages named only by a level range (Collectables 50-60 ...) carry their category name
    return /^[\d\s–-]+$/.test(n) && d.cat ? (d.cat[S.locale] || d.cat.en || '') + ' · ' + n.replace('-', '–') : n;
  }
  // Empty search: the crafting log, page by page in game order, then Cosmic Exploration by planet and mission class.
  function logList(job) {
    var all = allRecipes(job), seen = {}, groups = [], cosmic = {};
    var jobs = job < 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : [job];
    jobs.forEach(function (j) {
      DATA.log.jobs[j].forEach(function (pg) {
        var d = DATA.log.divisions[pg[0]], rows = [];
        pg[1].forEach(function (id) {
          var r = all[id];
          if (!r || seen[id]) return;
          seen[id] = 1;
          var c = DATA.cosmic[String(id)];
          if (c) { var key = (PLANETS[c.planet] ? PLANETS[c.planet][0] : 9) + '|' + rankIx(c.rank) + '|' + j; (cosmic[key] = cosmic[key] || { c: c, j: j, rows: [] }).rows.push(r); }
          else rows.push(r);
        });
        if (rows.length && !d.hidden) groups.push({ title: (jobs.length > 1 ? JOBS[j] + ' · ' : '') + divName(d), rows: rows });
      });
    });
    var rest = Object.keys(all).filter(function (id) { return !seen[id]; }).map(function (id) { return all[id]; });
    rest.forEach(function (r) { var c = DATA.cosmic[String(r.id)]; if (c) { var key = (PLANETS[c.planet] ? PLANETS[c.planet][0] : 9) + '|' + rankIx(c.rank) + '|' + r.job; (cosmic[key] = cosmic[key] || { c: c, j: r.job, rows: [] }).rows.push(r); } });
    rest = rest.filter(function (r) { return !DATA.cosmic[String(r.id)]; }).sort(function (a, b) { return a.job - b.job || a.rlvl - b.rlvl || a.id - b.id; });
    if (rest.length) groups.push({ title: t('Other'), rows: rest });
    Object.keys(cosmic).sort(function (a, b) {
      var x = a.split('|').map(Number), y = b.split('|').map(Number);
      return x[0] - y[0] || x[2] - y[2] || x[1] - y[1];
    }).forEach(function (k) {
      var g = cosmic[k], p = PLANETS[g.c.planet];
      groups.push({ title: (jobs.length > 1 ? JOBS[g.j] + ' · ' : '') + 'Cosmic · ' + (p ? p[1] : g.c.planet), rank: g.c.rank, rows: g.rows });
    });
    return groups;
  }
  function renderResults() {
    var el = $('#results');
    if (!el) return;
    var job = S.activeJobOnly ? S.job : -1;
    var h = '', n = 0;
    try {
      if (S.mode === 'missions') {
        var ms = call('search_missions', S.search, S.locale, job, S.zone, 1e6);
        if (!S.search.trim()) ms.sort(function (a, b) {
          return ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone) || a.job - b.job || rankIx(missionRank(a)) - rankIx(missionRank(b)) || a.missionId - b.missionId;
        });
        ms.forEach(function (m) {
          var rk = missionRank(m);
          var zi = ZONES.indexOf(m.zone);
          h += '<div class="mission-h">' + (rk ? rankBadge(rk) : '') + '<span>' + esc(JOBS[m.job]) + ' · ' + esc(clean(m.name)) + '</span>' + (m.sshCharges ? ' <span class="tag cosmic">SSH×' + m.sshCharges + '</span>' : '') +
            '<span class="zone">' + esc(ZONE_NAMES[zi] || m.zone) + '</span></div>';
          m.recipes.forEach(function (r) { h += itemRow(r, true); n++; });
        });
      } else if (!S.search.trim()) {
        logList(job).forEach(function (g) {
          h += '<div class="log-group"><div class="log-h">' + (g.rank ? rankBadge(g.rank) : '') + '<span>' + esc(g.title) + '</span><span class="dim">' + g.rows.length + '</span></div>' +
            g.rows.map(function (r) { return itemRow(r); }).join('') + '</div>';
          n += g.rows.length;
        });
      } else call('search_recipes', S.search, S.locale, job, 1000).forEach(function (r) { h += itemRow(r); n++; });
    } catch (e) { h = '<div class="empty"><p>' + esc(e.message) + '</p></div>'; }
    el.innerHTML = h || '<div class="empty"><p>' + esc('No recipes match.') + '</p></div>';
    var cnt = $('#results-count');
    if (cnt) cnt.textContent = fmt(n) + (S.mode === 'missions' ? ' mission recipes' : ' recipes') + (S.search.trim() ? ' found' : (S.mode === 'missions' ? '' : ' · crafting-log order'));
    var on = el.querySelector('.item.on');
    if (on) el.scrollTop = Math.max(0, on.offsetTop - el.clientHeight / 2);
  }
  function missionRank(m) { var r = m.recipes[0] && DATA.cosmic[String(m.recipes[0].id)]; return r ? r.rank : ''; }
  function rankBadge(rk) { return '<span class="rank r' + rankIx(rk) + '" title="Mission class ' + esc(rk) + '">' + esc(rk) + '</span>'; }
  function itemRow(r, inMission) {
    var cos = DATA.cosmic[String(r.id)], pl = cos && PLANETS[cos.planet];
    return '<button class="item' + (r.id === S.recipeId ? ' on' : '') + '" data-act="recipe" data-v="' + r.id + '"' + (pl ? ' title="Cosmic · ' + esc(pl[1]) + ' · class ' + esc(cos.rank) + '"' : '') + '><span class="job">' + esc(JOBS[r.job] || '') + '</span>' +
      '<span class="nm">' + esc(clean(r.name)) + (r.expert ? '<span class="xp" title="Expert recipe">✦</span>' : '') + '</span><span class="lead" aria-hidden="true"></span><span class="meta">' + (cos && !inMission ? rankBadge(cos.rank) + '<span class="pl">' + esc(pl ? pl[1].split(' ')[0].slice(0, 5) : '') + '</span>' : '') + '<span class="lv">' + r.level + '</span></span></button>';
  }
  function customForm() {
    var c = S.custom;
    var f = function (lbl, k, v) { return '<label class="field"><span class="label">' + esc(lbl) + '</span><input type="number" data-custom="' + k + '" value="' + v + '"></label>'; };
    return '<div class="grid2">' + f(t('Recipe Level:'), 'rlvl', c.rlvl) + f(t('Level:'), 'jobLevel', c.jobLevel) + f(t('Progress'), 'maxProgress', c.maxProgress) +
      f(t('Quality'), 'maxQuality', c.maxQuality) + f(t('Durability'), 'maxDurability', c.maxDurability) + '</div>' +
      '<label class="check"><input type="checkbox" data-custom="expert"' + (c.expert ? ' checked' : '') + '> ' + esc(t('Expert recipe')) + '</label>' +
      '<label class="check"><input type="checkbox" data-custom="override"' + (c.override ? ' checked' : '') + '> ' + esc(t('Override per 100% efficiency values')) + '</label>' +
      (c.override ? '<div class="grid2">' + f(t('Progress per 100% efficiency:'), 'baseProgress', c.baseProgress) + f(t('Quality per 100% efficiency:'), 'baseQuality', c.baseQuality) + '</div>' : '');
  }
  function renderSpec() {
    var el = $('#spec');
    if (!el) return;
    if (S.mode === 'custom') { el.innerHTML = ''; return; }
    var r = S.recipe;
    if (!r) { el.innerHTML = '<div class="spec"><span class="label">' + esc(t('Recipe')) + '</span><span class="dim">Pick a recipe to see its numbers.</span></div>'; return; }
    var cos = cosmicInfo();
    var h = '<div class="spec"><div class="row"><span class="label">' + esc(JOBS[r.job]) + ' · rlvl ' + r.rlvl + ' · Lv' + r.level + '</span>' +
      (r.expert ? '<span class="tag ex">' + esc(t('Expert recipe')) + '</span>' : '') + (cos ? '<span class="tag cosmic">Cosmic · ' + esc(cos.rank) + '</span>' : '') + '</div>' +
      '<h3>' + esc(clean(r.name)) + '</h3>' +
      '<div class="nums"><div class="num"><span class="label">' + esc(t('Progress')) + '</span><b>' + fmt(r.progress) + '</b></div>' +
      '<div class="num"><span class="label">' + esc(t('Quality')) + '</span><b>' + fmt(r.quality) + '</b></div>' +
      '<div class="num"><span class="label">' + esc(t('Durability')) + '</span><b>' + r.durability + '</b></div></div>';
    if (r.reqCraftsmanship || r.reqControl) h += '<div class="dim" style="font-size:13px">' + esc(t('Requirement: {req_cms} Craftsmanship, {req_ctrl} Control.', { req_cms: r.reqCraftsmanship, req_ctrl: r.reqControl })) + '</div>';
    if (r.expert) h += '<div class="dim" style="font-size:13px">Conditions: ' + condNames(condFlag()) + '</div>';
    var ings = r.ingredients.filter(function (i) { return i.hqable; });
    if (ings.length) {
      var hqState = hqStatus();
      h += '<div class="hq-box' + (hqState.unset ? ' call' : '') + '" id="hq-box">';
      if (hqState.unset) h += '<div class="hq-call"><span class="gem" aria-hidden="true">HQ</span><div><b>Got HQ materials?</b><span>Set them before you solve: they add starting quality, and the solver plans around it.</span></div>' +
        '<button class="btn sm hq-max" data-act="hq-max">' + esc('Use all HQ') + '</button></div>';
      else if (hqState.set) h += '<div class="hq-ok"><span class="gem" aria-hidden="true">HQ</span><span>' + hqState.set + ' HQ material' + (hqState.set > 1 ? 's' : '') + ' set' + (hqState.iq ? ' · starts at ' + fmt(hqState.iq) + ' quality' : '') + '</span></div>';
      h += '<div class="row"><span class="label">' + esc(t('HQ materials')) + '</span><span class="grow" style="flex:1"></span><div class="seg"><button data-act="iqmode" data-v="materials" class="' + (S.iqMode === 'materials' ? 'on' : '') + '">' + esc(t('HQ materials')) + '</button><button data-act="iqmode" data-v="value" class="' + (S.iqMode === 'value' ? 'on' : '') + '">' + esc(t('Custom')) + '</button></div></div>';
      if (S.iqMode === 'materials') {
        r.ingredients.forEach(function (ing, i) {
          if (!ing.hqable) return;
          h += '<div class="ing"><span>' + esc(clean(ing.name)) + '</span><span class="stepper"><button data-act="hq" data-i="' + i + '" data-d="-1" aria-label="fewer">−</button><span>' + S.hqMat[i] + ' / ' + ing.amount + '</span><button data-act="hq" data-i="' + i + '" data-d="1" aria-label="more">+</button></span></div>';
        });
      } else h += '<label class="field"><span class="label">' + esc(t('Initial Quality:')) + '</span><input id="iqv" type="number" min="0" value="' + S.iqValue + '"></label>';
      h += '</div>';
    }
    h += '<div class="row"><button class="btn sm ghost" data-act="copy-item">' + esc(t('Copy item name')) + '</button></div></div>';
    el.innerHTML = h;
  }
  // Whether this recipe takes HQ materials and how many are set (drives the HQ prompts in panes 01 and 02).
  function hqStatus() {
    var r = S.recipe;
    if (S.mode === 'custom' || !r) return { any: false };
    var any = r.ingredients.some(function (i) { return i.hqable; });
    if (!any) return { any: false };
    if (S.iqMode === 'value') return { any: true, set: 0, unset: false, iq: S.iqValue };
    var set = S.hqMat.reduce(function (a, b) { return a + b; }, 0), iq = 0;
    if (set) { try { iq = call('settings', JSON.stringify(baseReq())).initialQuality; } catch (e) { /* ignore */ } }
    return { any: true, set: set, unset: set === 0, iq: iq };
  }
  function condNames(flag) { var o = []; for (var b = 0; b < 11; b++) if (flag >> b & 1) o.push(CS.COND_NAMES[b]); return o.join(', '); }

  // ── rendering: crafter pane ──────────────────────────────────────────────
  function renderCrafter() {
    var el = $('#pane-crafter');
    var st = stats();
    var eff = effective(st, S.food, S.potion);
    var h = paneHead('II', t('Crafter stats'), '<button class="btn sm ghost" data-act="copy-cfg" title="' + esc(t('🗐 Copy crafter config')) + '">⧉</button><button class="btn sm ghost" data-act="paste-cfg" title="' + esc(t('📋 Paste config here to load')) + '">⇩</button>');
    h += '<div class="pane-body crafter-body"><div class="cf-a">';
    h += '<div class="jobs" role="group" aria-label="' + esc(t('Job')) + '">' + JOBS.map(function (j, i) { return '<button data-act="job" data-v="' + i + '" class="' + (i === S.job ? 'on' : '') + '">' + esc(j) + '</button>'; }).join('') + '</div>';
    var nf = function (lbl, k, min, max) { return '<label class="field"><span class="label">' + esc(lbl) + '</span><input type="number" inputmode="numeric" data-stat="' + k + '" min="' + min + '" max="' + max + '" value="' + st[k] + '"></label>'; };
    h += '<div class="grid4">' + nf(t('Craftsmanship'), 'craftsmanship', 1, 9999) + nf(t('Control'), 'control', 1, 9999) + nf('CP', 'cp', 1, 2000) + nf(t('Job level'), 'level', 1, 100) + '</div>';
    var ck = function (lbl, k) { return '<label class="check"><input type="checkbox" data-flag="' + k + '"' + (st[k] ? ' checked' : '') + '> ' + esc(lbl) + '</label>'; };
    h += '<div class="row" style="gap:14px">' + ck(t('Manipulation') === 'Manipulation' ? ACTIONS[15].name : t('Manipulation'), 'manipulation') + ck(ACTIONS[24].name, 'heartAndSoul') + ck(ACTIONS[28].name, 'quickInnovation') +
      '<label class="check"><input type="checkbox" id="cosmictool"' + (S.cosmicTool ? ' checked' : '') + '> Cosmic tool (Good ×1.75)</label></div>';
    h += '<div class="row"><button class="btn sm ghost" data-act="copy-all">' + esc(t('Copy to all jobs')) + '</button></div>';
    h += combo('food', t('Food'), MEALS, S.food) + combo('potion', t('Potion'), POTIONS, S.potion);
    h += '<div class="eff">' + ['Craftsmanship', 'Control', 'CP'].map(function (k, i) {
      var key = ['craftsmanship', 'control', 'cp'][i];
      return '<div class="num"><span class="label">' + esc(t(k)) + '</span><b>' + fmt(eff[key]) + '</b><span class="plus">' + (eff.plus[i] ? '+' + eff.plus[i] : '·') + '</span></div>';
    }).join('') + '</div>';
    // solver
    h += '</div><div class="cf-b">';
    h += '<div class="field"><span class="label">' + esc(t('Target quality')) + '</span>';
    var maxQ = 0, rs = null;
    if (hasRecipe()) { try { rs = call('settings', JSON.stringify(baseReq())); maxQ = rs.maxQuality; } catch (e) { /* invalid recipe config */ } }
    h += '<select id="target" class="inp">' + targetOptions(maxQ).map(function (o) { return '<option value="' + o[0] + '"' + (S.target.kind === o[0] ? ' selected' : '') + '>' + esc(o[1]) + (o[0] !== 'custom' ? ' · ' + fmt(o[2]) : '') + '</option>'; }).join('') + '</select>';
    if (S.target.kind === 'custom') h += '<input id="targetv" class="inp" type="number" min="0" value="' + (S.target.value || maxQ) + '">';
    h += '</div>';
    h += '<div class="row" style="gap:14px"><label class="check"><input type="checkbox" data-solver="adversarial"' + (S.solver.adversarial ? ' checked' : '') + '> ' + esc(t('Ensure 100% reliability')) + '</label>' +
      '<label class="check"><input type="checkbox" data-solver="backload"' + (S.solver.backload ? ' checked' : '') + '> ' + esc(t('Backload progress')) + '</label>' +
      '<label class="check"><input type="checkbox" data-solver="mustReach"' + (S.solver.mustReach ? ' checked' : '') + '> ' + esc(t('Solution must reach target quality')) + '</label></div>';
    if (S.recipe && S.recipe.stellarMission != null || S.solver.ssh) h += '<label class="field"><span class="label">' + esc(ACTIONS[31].name) + '</span><input type="number" min="0" max="9" data-solver="ssh" value="' + S.solver.ssh + '"></label>';
    if (rs && S.recipe && (eff.craftsmanship < S.recipe.reqCraftsmanship || eff.control < S.recipe.reqControl)) h += '<div style="color:var(--madder);font-size:13px">' + esc(t('Your stats are below the minimum requirement for this recipe.')) + '</div>';
    var hqs = hqStatus();
    if (hqs.unset && !S.solving) h += '<button class="hq-nudge" data-act="hq-goto"><span class="gem" aria-hidden="true">HQ</span><span><b>Using HQ materials?</b> This recipe takes them. Set them first; the solve depends on it.</span><span class="go">Set ↗</span></button>';
    else if (hqs.set && !S.solving) h += '<div class="hq-ok"><span class="gem" aria-hidden="true">HQ</span><span>' + hqs.set + ' HQ material' + (hqs.set > 1 ? 's' : '') + ' included' + (hqs.iq ? ' · starts at ' + fmt(hqs.iq) + ' quality' : '') + '</span></div>';
    if (S.solving) {
      h += '<button class="shuttle busy" data-act="cancel">' + esc(t('Cancel')) + '</button><div class="solve-meta" id="solve-meta"></div>';
    } else {
      h += '<button class="shuttle" data-act="solve"' + (hasRecipe() ? '' : ' disabled') + '>' + esc(t('Solve')) + ' <span class="key">Ctrl ↵</span></button>';
      if (isExpert()) h += '<button class="btn" data-act="guide" style="justify-content:center">Skip to the step-by-step guide →</button>';
    }
    h += '</div></div>';
    el.innerHTML = h;
    if (S.solving) updateSolveMeta();
    document.body.classList.toggle('lb-charging', !!S.solving);
  }
  function combo(kind, label, list, sel) {
    var c = consumable(list, sel);
    return '<div class="field combo"><span class="label">' + esc(label) + '</span><div class="row" style="flex-wrap:nowrap">' +
      '<input class="inp" data-combo="' + kind + '" autocomplete="off" placeholder="' + esc(t('None')) + '" value="' + esc(c ? clean(c.name) + (c.hq ? ' (HQ)' : '') : '') + '">' +
      (c ? '<button class="btn sm ghost" data-act="clear-' + kind + '" aria-label="clear">✕</button>' : '') + '</div><div class="combo-list hidden" id="list-' + kind + '"></div></div>';
  }
  function comboOpen(kind, q) {
    var list = kind === 'food' ? MEALS : POTIONS;
    var el = $('#list-' + kind);
    q = (q || '').toLowerCase();
    var items = list.filter(function (c) { return !q || clean(c.name).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return b.ilvl - a.ilvl || (b.hq - a.hq); }).slice(0, 60);
    el.innerHTML = items.map(function (c) {
      var parts = [];
      if (c.craftMax) parts.push(t('Craftsmanship') + ' +' + c.craftRel + '% (max ' + c.craftMax + ')');
      if (c.controlMax) parts.push(t('Control') + ' +' + c.controlRel + '% (max ' + c.controlMax + ')');
      if (c.cpMax) parts.push('CP +' + c.cpRel + '% (max ' + c.cpMax + ')');
      return '<button data-act="pick-' + kind + '" data-id="' + c.id + '" data-hq="' + (c.hq ? 1 : 0) + '">' + esc(clean(c.name)) + (c.hq ? ' <b>HQ</b>' : '') + ' <small>i' + c.ilvl + ' · ' + esc(parts.join(' · ')) + '</small></button>';
    }).join('') || '<button disabled>—</button>';
    el.classList.remove('hidden');
  }

  // ── rendering: rotation pane ─────────────────────────────────────────────
  function renderRotation() {
    var el = $('#pane-rotation');
    var res = S.result;
    var h = paneHead('III', t('Macro'), res && res.actions ? '<button class="btn sm" data-act="save">★ ' + esc(t('Saved macros')) + '</button>' : '');
    h += '<div class="pane-body">';
    if (S.solving) {
      h += '<div class="empty"><span class="label">' + esc(t('Solving ...')) + '</span><h3>Working it out…</h3><p>Raphael is searching every rotation for this recipe on this device. Hard expert recipes can take a minute offline.' +
        (isExpert() ? ' In a hurry? The step-by-step guide needs no solve.' : '') + '</p>' + (isExpert() ? '<button class="btn go" data-act="guide">Start the guide now</button>' : '') + '</div>';
    } else if (!res) {
      h += emptyState();
    } else if (res.error) {
      var map = { NoSolution: t('No solution'), SearchQueueCapacityExceeded: t('Search Queue Capacity Exceeded') };
      h += '<div class="empty"><span class="label">' + esc(t('Error')) + '</span><h3>' + esc(map[res.error] || res.error) + '</h3><p>' +
        (res.error === 'NoSolution' ? esc(t('Try lowering target quality.')) : esc(res.error)) + '</p>' + (isExpert() ? '<button class="btn go" data-act="guide">Use the step-by-step guide</button>' : '') + '</div>';
    } else h += resultView(res);
    if (!res || res.error || S.solving) h += savedDrawer();
    h += '</div>';
    el.innerHTML = h;
  }
  function emptyState() {
    return '<div class="empty"><span class="label">Eveniunt Network Command Center</span><h3>Pick a recipe. Set your stats. <i>Solve.</i></h3>' +
      '<p>The Atelier finds the best macro with Raphael\'s solver, prints it ready to paste, and for expert recipes checks whether the macro holds up against every material condition. If it does not, it hands you a live step-by-step guide instead.</p>' +
      '<div class="row"><span class="tag">Offline</span><span class="tag">' + LOCALES.length + ' languages</span><span class="tag ex">' + call('expert_recipe_count') + ' expert recipes</span></div></div>';
  }
  function verdictView(res) {
    var v = res.v, rs = v.rs;
    var h = '';
    if (isExpert()) {
      var macroPct = v.mc ? Math.round(v.mc.hits / v.mc.n * 100) : 0;
      if (v.reliable) {
        h += '<div class="verdict reliable"><div class="seal"><span>Fit<br>to run</span></div><div><h3>Macro is reliable</h3><p>It reaches ' + fmt(rs.targetQuality) +
          ' quality with no lucky conditions and in all ' + fmt(v.mc.n) + ' simulated crafts. Just run it.</p></div><button class="btn sm ghost act" data-act="guide">Guide anyway</button></div>';
      } else if (macroPct === 0 && res.guideEst && res.guideEst.pTarget != null && res.guideEst.pTarget < 0.01) {
        h += '<div class="verdict pending"><div class="seal"><span>Out of<br>reach</span></div><div><h3>Out of reach at these stats</h3><p>Neither the macro nor the live guide reaches ' + fmt(rs.targetQuality) +
          ' quality in simulation. Lower the target, or see below whether food and medicine change that. The guide still aims for the most quality you can get.</p></div><button class="btn act" data-act="guide">Guide for best quality</button></div>';
      } else {
        var g = res.guideEst;
        var gtxt = g == null ? 'estimating the guide…' : (g.pTarget == null ? 'guide estimate unavailable' : 'live guide: at least ~' + Math.round(g.pTarget * 100) + '%');
        if (res.dismissed || res.guideSeen) {
          h += '<div class="verdict slim"><div><b>The step-by-step guide is recommended here.</b> <span class="dim">The macro reaches the target in ' + macroPct + '% of simulated crafts' + (res.dismissed ? '; you chose to use it anyway.' : '.') + '</span></div>' +
            '<span class="row"><button class="btn sm go-sm" data-act="guide">' + (lastGuide && !lastGuide.state.done ? 'Resume guide' : 'Open guide') + '</button>' +
            (res.dismissed ? '' : '<button class="btn sm" data-act="use-macro">Use the macro anyway</button>') + '</span></div>';
          return h + foodView(res);
        }
        h += '<div class="verdict guide" role="alert"><div class="beacon"><span>Use the<br><b>guide</b></span></div><div><h3>Use the step-by-step guide</h3><p>This macro is not reliable here: it reaches ' + fmt(rs.targetQuality) +
          ' in ' + macroPct + '% of simulated crafts' + (v.normalOk ? '' : ' and falls short with no lucky conditions') + '. The guide reacts to every condition (' + esc(gtxt) + ').</p></div>' +
          '<span class="row act"><button class="btn go" data-act="guide">Start guide</button><button class="btn sm ghost" data-act="use-macro">Use the macro anyway</button></span></div>';
      }
    } else if (!v.normalOk && v.complete) {
      h += '<div class="verdict pending"><div class="seal">≈</div><div><h3>Short of the target</h3><p>The best macro reaches ' + fmt(v.quality) + ' of ' + fmt(rs.targetQuality) + ' quality.</p></div></div>';
    }
    return h + foodView(res);
  }
  function foodView(res) {
    var h = '';
    var e = res.escalation;
    if (e && e.found) {
      var lf = consumable(MEALS, e.found.loadout.food), lp = consumable(POTIONS, e.found.loadout.potion);
      h += '<div class="verdict food"><div class="seal"><span>Eat<br>first</span></div><div><h3>Food fixes it</h3><p>' + (lf ? 'Eat ' + esc(clean(lf.name)) + ' HQ' : '') + (lp ? ' and drink ' + esc(clean(lp.name)) + ' HQ' : '') +
        ': the macro then reaches ' + fmt(e.found.v.rs.targetQuality) + ' quality with no lucky conditions' + (e.found.v.mc ? ' and in every simulated craft' : '') + '.</p></div><button class="btn apply act" data-act="apply-loadout">Apply loadout</button></div>';
    } else if (e && !e.done) {
      h += '<div class="verdict pending"><div class="seal">' + e.step + '/' + e.total + '</div><div><h3>Trying food and medicine</h3><p>Re-solving with the best ' + (e.step === 1 ? 'food' : 'food and medicine') + ' to see whether the macro becomes reliable.</p></div></div>';
    } else if (e && e.done && e.total) {
      h += '<div class="dim" style="font-size:13px">Checked the best food' + (e.total > 1 ? ' and medicine' : '') + ': the macro still does not become reliable.</div>';
    }
    return h;
  }
  function resultView(res) {
    var v = res.v, rs = v.rs;
    var h = verdictView(res);
    var rec = !isExpert() || v.reliable || res.dismissed;
    var item = S.recipe;
    var hqTxt, failed = !v.complete;
    if (failed) hqTxt = '<b><small>' + esc(t(v.errorAt >= 0 ? 'Cannot complete synthesis.' : 'Synthesis failed')) + '</small></b>';
    else if (cosmicInfo() && cosmicInfo().tiers) {
      var ct = cosmicInfo().tiers.filter(function (q) { return v.quality >= q; }).length;
      hqTxt = '<b>T' + ct + '</b><span class="label">Cosmic tier ' + ct + ' of 3</span>';
    } else if (item && item.alwaysCollectable) {
      var tier = v.quality >= Math.floor(rs.maxQuality * 95 / 100) ? 3 : v.quality >= Math.floor(rs.maxQuality * 75 / 100) ? 2 : v.quality >= Math.floor(rs.maxQuality * 55 / 100) ? 1 : 0;
      hqTxt = '<b>T' + tier + '</b><span class="label">' + esc(t('Tier {tier} collectable', { tier: tier })) + '</span>';
    } else {
      var hq = B.hq_percentage(v.quality, rs.maxQuality);
      hqTxt = '<b>' + hq + '<small>%</small></b><span class="label">HQ</span>';
    }
    var last = v.steps.filter(function (s) { return !s.error; }).pop() || { progress: 0, quality: 0, durability: rs.maxDurability, cp: rs.maxCp };
    var body = '<div class="readout"><div class="hq' + (failed ? ' fail' : '') + '">' + hqTxt + '</div><div class="gauges">' +
      gauge('progress', t('Progress'), last.progress, rs.maxProgress) + gauge('quality', t('Quality'), v.quality, rs.maxQuality, rs.targetQuality) +
      gauge('durability', t('Durability'), last.durability, rs.maxDurability) + gauge('cp', 'CP', last.cp, rs.maxCp) +
      '<div class="assume">' + esc(t(rs.adversarial ? 'Calculated assuming worst possible sequence of conditions' : 'Calculated assuming Normal conditon on every step')) +
      ' · ' + esc(t('{steps} steps, {duration} seconds', { steps: res.actions.length, duration: macroSeconds(res.actions) })) +
      (res.fromHistory ? ' · ' + esc(t('Loaded from saved rotations')) : (res.duration ? ' · ' + esc(t('Elapsed time: {dur:.2}s', { dur: res.duration.toFixed(2) })) : '')) + '</div></div></div>';
    body += loomView(res);
    var flag = rec ? '' : '<span class="ribbon-flag">Not recommended · shown for comparison</span>';
    h += '<div class="rot-grid"><div class="rot-main muted-wrap' + (rec ? '' : ' not-rec') + '">' + flag + body + '</div>' +
      '<div class="rot-side"><div class="muted-wrap' + (rec ? '' : ' not-rec') + '">' + flag + macroView(res) + '</div>' + savedDrawer() + '</div></div>';
    return h;
  }
  function macroSeconds(actions) { return actions.reduce(function (a, i) { return a + ACTIONS[i].wait + (S.macro.includeDelay ? S.macro.extraDelay : 0); }, 0); }
  function gauge(cls, label, v, max, tick) {
    var pct = max ? Math.min(100, v / max * 100) : 0;
    var over = v > max ? ' (+' + fmt(v - max) + ')' : '';
    return '<div class="gauge g-' + cls + '"><span class="label">' + esc(label) + '</span><div class="track"><div class="fill" style="width:' + pct + '%"></div>' +
      (tick && tick < max ? '<div class="tick" style="left:' + (tick / max * 100) + '%" title="target ' + fmt(tick) + '"></div>' : '') + '</div><span class="v">' + fmt(Math.min(v, max)) + ' / ' + fmt(max) + over + '</span></div>';
  }
  var THREADS = [['iq', 'Inner Quiet', 'var(--cochineal)'], ['inno', 'Innovation', 'var(--cochineal)'], ['gs', 'Great Strides', 'var(--madder)'],
    ['vene', 'Veneration', 'var(--weld)'], ['mume', 'Muscle Memory', 'var(--weld)'], ['wn', 'Waste Not', 'var(--woad)'], ['manip', 'Manipulation', 'var(--verdigris)'],
    ['tp', 'Trained Perf.', 'var(--verdigris)'], ['ssh', 'Steady Hand', 'var(--woad)']];
  var COLW = 66; // one loom column per action (px)
  function tileHtml(key, name, kind, bad, big) {
    var url = iconUrl(EN_NAME[key] || '', S.job);
    return '<div class="tile ' + kind + (bad ? ' bad' : '') + (url ? ' icon' : '') + (big ? ' big' : '') + '" title="' + esc(name) + '">' +
      (url ? '<img src="' + url + '" alt="" draggable="false">' : esc(ABBR[key] || key.slice(0, 3))) + '</div>';
  }
  function loomView(res) {
    var v = res.v, rs = v.rs;
    var gst = v.gst || guideSettings(rs, res.req);
    var s = CS.initialState(gst);
    var cols = [], prog = [0], qual = [rs.initialQuality || 0], dur = [rs.maxDurability];
    for (var i = 0; i < res.actions.length; i++) {
      var key = engineKey(res.actions[i]);
      var a = A[key];
      var before = s;
      var bad = !a || !!CS.whyNot(a, s, gst) || (v.errorAt === i);
      if (a && !bad) { s = CS.apply(a, s, gst, true); s.cond = COND.Normal; }
      var step = v.steps[i], ok = step && !step.error && step.progress != null;
      prog.push(ok ? step.progress : prog[prog.length - 1]); qual.push(ok ? (step.quality || 0) + (rs.initialQuality || 0) : qual[qual.length - 1]);
      dur.push(ok ? step.durability : dur[dur.length - 1]);
      cols.push({ key: key, name: ACTIONS[res.actions[i]].name, kind: a ? (a.kind === 'PQ' ? 'P' : a.kind) : 'O', before: before, bad: bad });
    }
    var used = THREADS.filter(function (th) { return cols.some(function (c) { return c.before[th[0]] > 0; }); });
    var n = used.length;
    var h = '<div class="loom-wrap"><div class="loom" style="--threads:' + n + ';--colw:' + COLW + 'px">';
    h += '<div class="loom-row"><div class="loom-labels"><span>#</span><span>' + esc(t('Actions')) + '</span><span></span>' + used.map(function (th) { return '<span style="color:' + th[2] + '">' + th[1] + '</span>'; }).join('') + '</div>';
    cols.forEach(function (c, ci) {
      h += '<div class="col"><span class="ix">' + (ci + 1) + '</span>' + tileHtml(c.key, c.name, c.kind, c.bad) + '<span class="nm">' + esc(c.name) + '</span>';
      used.forEach(function (th) {
        var on = c.before[th[0]] > 0;
        var prevOn = ci > 0 && cols[ci - 1].before[th[0]] > 0, nextOn = ci < cols.length - 1 && cols[ci + 1].before[th[0]] > 0;
        h += '<span class="thread' + (on ? ' on' + (prevOn ? '' : ' first') + (nextOn ? '' : ' last') : '') + '" style="--c:' + th[2] + '">' + (on && th[0] === 'iq' ? '<b>' + c.before.iq + '</b>' : '') + '</span>';
      });
      h += '</div>';
    });
    h += '</div>' + chartRow(cols, prog, qual, dur, rs) + '</div></div>';
    return h;
  }
  // Progress and quality after every step, on the same columns as the actions above (state before step 1 at the left edge).
  function chartRow(cols, prog, qual, dur, rs) {
    var W = cols.length * COLW, H = 190, pad = 10, ph = H - 2 * pad;
    var x = function (i) { return i === 0 ? 2 : (i - 1) * COLW + COLW / 2; };
    var y = function (val, max) { return pad + ph - Math.min(1, max ? val / max : 0) * ph; };
    var line = function (arr, max) { return arr.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v, max).toFixed(1); }).join(' '); };
    var g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) { g += '<line class="grid' + (f === 1 ? ' top' : '') + '" x1="0" x2="' + W + '" y1="' + (pad + ph - f * ph) + '" y2="' + (pad + ph - f * ph) + '"/>'; });
    cols.forEach(function (c, i) { g += '<line class="vgrid" x1="' + (i * COLW) + '" x2="' + (i * COLW) + '" y1="' + pad + '" y2="' + (pad + ph) + '"/>'; });
    if (rs.targetQuality && rs.targetQuality < rs.maxQuality) g += '<line class="target" x1="0" x2="' + W + '" y1="' + y(rs.targetQuality, rs.maxQuality) + '" y2="' + y(rs.targetQuality, rs.maxQuality) + '"/>';
    g += '<polyline class="l-dur" points="' + line(dur, rs.maxDurability) + '"/>';
    g += '<polygon class="a-qual" points="' + x(0) + ',' + (pad + ph) + ' ' + line(qual, rs.maxQuality) + ' ' + x(qual.length - 1) + ',' + (pad + ph) + '"/>';
    g += '<polyline class="l-prog" points="' + line(prog, rs.maxProgress) + '"/><polyline class="l-qual" points="' + line(qual, rs.maxQuality) + '"/>';
    for (var i = 1; i < prog.length; i++) {
      var tip = (i) + '. ' + cols[i - 1].name + ' — ' + t('Progress') + ' ' + fmt(prog[i]) + ' / ' + fmt(rs.maxProgress) + ' · ' + t('Quality') + ' ' + fmt(qual[i]) + ' / ' + fmt(rs.maxQuality) + ' · ' + t('Durability') + ' ' + dur[i];
      var pg = prog[i] - prog[i - 1], qg = qual[i] - qual[i - 1];
      g += '<g class="pt"><title>' + esc(tip) + '</title><rect x="' + ((i - 1) * COLW) + '" y="0" width="' + COLW + '" height="' + H + '" fill="transparent"/>' +
        (pg ? '<circle class="d-prog" cx="' + x(i) + '" cy="' + y(prog[i], rs.maxProgress) + '" r="4"/>' : '') +
        (qg ? '<circle class="d-qual" cx="' + x(i) + '" cy="' + y(qual[i], rs.maxQuality) + '" r="4"/>' : '') + '</g>';
    }
    var lab = function (f, txt) { return '<span style="top:' + (pad + ph - f * ph) + 'px">' + txt + '</span>'; };
    return '<div class="loom-row chart"><div class="loom-labels chart-labels" style="height:' + H + 'px;padding-top:' + (pad + ph / 2 + 14) + 'px"><span class="lg"><i style="background:var(--weld)"></i>' + esc(t('Progress')) +
      '</span><span class="lg"><i style="background:var(--cochineal)"></i>' + esc(t('Quality')) + '</span><span class="lg"><i style="background:var(--verdigris);height:2px;opacity:.7"></i>' + esc(t('Durability')) + '</span>' +
      '<div class="yax">' + lab(1, '100%') + lab(0.5, '50%') + lab(0, '0') + '</div></div>' +
      '<svg class="chart-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('Progress') + ' / ' + t('Quality')) + '">' + g + '</svg></div>';
  }
  function macroView(res) {
    var m = S.macro;
    var st = stats();
    var f = consumable(MEALS, S.food), p = consumable(POTIONS, S.potion);
    var cfg = Object.assign({}, m, { itemName: S.recipe ? clean(S.recipe.name) : '', foodName: f ? clean(f.name) : t('None'), potionName: p ? clean(p.name) : t('None'),
      craftsmanship: st.craftsmanship, control: st.control, cp: st.cp, level: st.level });
    var cards = [];
    try { cards = call('macros', JSON.stringify(cfg), Uint32Array.from(res.actions), S.locale); } catch (e) { /* config error shows nothing */ }
    var ck = function (k, lbl) { return '<label class="check"><input type="checkbox" data-macro="' + k + '"' + (m[k] ? ' checked' : '') + '> ' + esc(t(lbl)) + '</label>'; };
    var h = '<details class="drawer" open><summary>' + esc(t('Macro')) + ' · ' + cards.length + '</summary><div>';
    h += '<div class="macro-cfg"><div class="row" style="gap:14px">' + ck('splitMacro', 'Split macro') + ck('includeDelay', 'Include delay') +
      (m.includeDelay ? '<label class="check">' + esc(t('Extra delay')) + ' <input type="number" class="inp" style="width:70px;min-height:30px" min="0" max="9" data-macro="extraDelay" value="' + m.extraDelay + '"></label>' : '') + '</div>' +
      '<div class="row" style="gap:14px">' + ck('notificationEnabled', 'End-of-macro notification') + ck('introEnabled', 'Macro lock / intro') + '</div>';
    if (m.notificationEnabled) {
      h += '<div class="row" style="gap:14px">' + ck('defaultNotification', 'Use default notification') + (m.defaultNotification ? '<label class="check">&lt;se.<input type="number" class="inp" style="width:64px;min-height:30px" min="1" max="16" data-macro="notificationSound" value="' + m.notificationSound + '">&gt;</label>' : '') + ck('avoidSingleActionMacro', 'Avoid single-action macros') + '</div>';
      if (!m.defaultNotification) {
        h += '<input class="inp" data-macro="customNotificationFormat" value="' + esc(m.customNotificationFormat) + '" aria-label="' + esc(t('Use custom notification format')) + '">' + ck('differentLastNotification', 'Use different format for last notification');
        if (m.differentLastNotification) h += '<input class="inp" data-macro="customLastNotificationFormat" value="' + esc(m.customLastNotificationFormat) + '">';
      }
    }
    if (m.introEnabled) {
      h += ck('defaultIntro', 'Use default intro') + (m.defaultIntro ? '' : '<input class="inp" data-macro="customIntroFormat" value="' + esc(m.customIntroFormat) + '" aria-label="' + esc(t('Use custom intro format')) + '">');
    }
    if (m.notificationEnabled && !m.defaultNotification || m.introEnabled && !m.defaultIntro) h += '<details><summary class="dim" style="font-size:12px">Placeholders</summary><pre class="mono" style="white-space:pre-wrap;font-size:11px">' + esc(B.custom_format_help ? '' : '{index} {max_index} {item_name} {food} {potion} {craftsmanship} {control} {cp} {level}') + '</pre></details>';
    h += '</div><div class="cards">' + cards.map(function (c, i) {
      return '<article class="card"><div class="card-h"><span>Card ' + (i + 1) + ' / ' + cards.length + '</span><span>' + c.duration + ' s</span></div><pre id="mc' + i + '">' + esc(c.text) + '</pre>' +
        '<button class="btn copy" data-act="copy-macro" data-i="' + i + '">Copy card ' + (i + 1) + '</button></article>';
    }).join('') + '</div></div></details>';
    return h;
  }
  function savedDrawer() {
    var row = function (r, kind) {
      return '<div class="rot"><span><span class="t">' + esc(r.name) + '</span><br><span class="dim mono" style="font-size:11px">' + esc(JOBS[r.job] || '') + ' · ' + r.actions.length + ' ' + esc(t('Actions')) +
        (r.duration ? ' · ' + r.duration.toFixed(1) + ' s' : '') + '</span></span><span class="row"><button class="btn sm" data-act="load-' + kind + '" data-id="' + r.id + '">' + esc(t('Load')) + '</button>' +
        '<button class="btn sm ghost" data-act="del-' + kind + '" data-id="' + r.id + '" aria-label="delete">✕</button></span></div>';
    };
    return '<details class="drawer"><summary>' + esc(t('Saved macros & solve history')) + '</summary><div>' +
      '<span class="label">' + esc(t('Saved macros')) + '</span>' + (S.saved.length ? S.saved.map(function (r) { return row(r, 'saved'); }).join('') : '<span class="dim">' + esc(t('No saved macros')) + '</span>') +
      '<span class="label" style="margin-top:8px">' + esc(t('Solve history')) + '</span>' + (S.history.length ? S.history.map(function (r) { return row(r, 'history'); }).join('') : '<span class="dim">' + esc(t('No solve history')) + '</span>') +
      (S.history.length >= S.savedCfg.maxHistory ? '<span class="dim">' + esc(t('⚠ Oldest rotations will be lost on next solve')) + '</span>' : '') + '</div></details>';
  }
  function loadRotation(r) {
    if (S.savedCfg.op !== 'rotation') {
      if (r.custom) { S.mode = 'custom'; S.custom = Object.assign({}, r.custom); }
      else if (r.recipeId) { S.mode = 'recipes'; selectRecipe(r.recipeId); }
      S.job = r.job;
      if (S.savedCfg.op === 'rotationRecipeConsumables') { S.food = r.food; S.potion = r.potion; }
    }
    persist();
    renderAll();
    try { showResult(fullReq(), r.actions, r.duration || 0, true); } catch (e) { toast(e.message); }
  }

  // ── live guide ───────────────────────────────────────────────────────────
  var lastGuide = null; // the guide you closed, so reopening resumes it
  function openGuide() {
    if (!hasRecipe()) return;
    var req, rs;
    try { req = fullReq(); } catch (e) { toast(e.message); return; }
    if (lastGuide && lastGuide.key === solveKey(req) && !lastGuide.state.done) {
      S.guide = lastGuide; lastGuide = null;
      showGuidePanel(); guideThink(); return;
    }
    try { req = fullReq(); rs = call('settings', JSON.stringify(req)); } catch (e) { toast(e.message); return; }
    var gst = guideSettings(rs, req);
    var c = cosmicInfo();
    S.guide = { key: solveKey(req), req: req, rs: rs, st: gst, target: rs.targetQuality || 1, lower: c && c.tiers ? c.tiers.filter(function (x) { return x < rs.targetQuality; }) : [],
      state: CS.initialState(gst), history: [], rec: null, chosen: null, thinking: false, mmEndsAt: 0, budget: { ssh: gst.sshCharges, mm: gst.mmCharges } };
    showGuidePanel();
    guideThink();
  }
  // The guide opens inside the workbook, between the top row and the Macro section, and scrolls into view.
  function showGuidePanel() {
    var el = $('#guide');
    el.classList.remove('hidden');
    if (window.matchMedia('(max-width: 860px)').matches) setPane('rotation');
    requestAnimationFrame(function () { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  }
  function closeGuide() {
    if (S.guide) { S.guide.thinking = false; lastGuide = S.guide; }
    S.guide = null; $('#guide').classList.add('hidden');
    if (S.result && !S.result.error) { S.result.guideSeen = true; renderRotation(); }
  }
  function syncMm(s) { var g = S.guide; if (!g.mmEndsAt) { s.mm = 0; return s; } var left = (g.mmEndsAt - Date.now()) / 1000; s.mm = left > 0 ? Math.max(1, Math.round(left / S.mmSecPerStep)) : 0; if (left <= 0) g.mmEndsAt = 0; return s; }
  function guideThink() {
    var g = S.guide;
    if (!g) return;
    if (g.state.done) { g.rec = null; g.thinking = false; renderGuide(); return; }
    g.thinking = true; renderGuide();
    var s = syncMm(CS.copyState(g.state));
    var st = Object.assign({}, g.st, { condModel: S.condModel });
    guideAsk(s, st, { target: g.target, lowerTiers: g.lower, timeMs: S.guideMs, seed: 1 + g.history.length }).then(function (r) {
      if (S.guide !== g) return;
      g.thinking = false;
      if (r.ok) g.rec = { action: r.r.action == null ? null : CS.ACTIONS[r.r.action], reason: r.r.reason, estimate: r.r.estimate, ms: r.r.ms };
      else { var q = CS.recommend(s, st, { target: g.target, timeMs: 0 }); g.rec = { action: q.action, reason: q.reason, estimate: null, fallback: true }; }
      g.chosen = null;
      renderGuide();
    });
  }
  function guideReport(cond, ok) {
    var g = S.guide;
    if (!g || g.state.done || g.thinking) return;
    var a = g.chosen || (g.rec && g.rec.action);
    if (!a) return;
    var s = syncMm(CS.copyState(g.state));
    var why = CS.whyNot(a, s, g.st);
    if (why) { toast(a.name + ': ' + why); return; }
    var n = CS.apply(a, s, g.st, CS.successRate(a, s) >= 100 ? true : ok !== false);
    if (!n.done) n.cond = (a.step || a === A.CarefulObservation) ? cond : s.cond;
    if (a === A.MaterialMiracle) g.mmEndsAt = Date.now() + 43000;
    g.history.push({ state: g.state, action: a.id, ok: n.lastOk, cond: n.cond, pg: n.lastPg, qg: n.lastQg });
    delete n.lastPg; delete n.lastQg; delete n.lastOk;
    g.state = n; g.chosen = null;
    guideThink();
  }
  function guideUndo() { var g = S.guide; if (!g || !g.history.length) return; g.state = g.history.pop().state; guideThink(); }
  function renderGuide() {
    var g = S.guide, el = $('#guide');
    if (!g) return;
    var s = g.state, st = g.st;
    var a = g.chosen || (g.rec && g.rec.action);
    var h = '<div class="guide-in"><div class="guide-top"><h2>' + esc(S.recipe ? clean(S.recipe.name) : 'Custom recipe') + ' · step-by-step</h2>' +
      '<button class="btn" data-act="g-undo"' + (g.history.length ? '' : ' disabled') + '>Undo <span class="dim mono">U</span></button><button class="btn" data-act="g-restart">Restart</button><button class="btn close" data-act="g-close">✕ Back to the workbook <span class="dim mono">Esc</span></button></div><div class="guide-grid"><div style="display:grid;gap:14px">';
    if (s.done) {
      var hit = s.done === 1 && s.quality >= g.target;
      h += '<div class="call"><span class="what">' + (s.done === 1 ? 'Craft complete' : 'Craft failed') + '</span><div class="act" style="color:' + (hit ? 'var(--verdigris)' : 'var(--madder)') + '">' +
        (s.done === 1 ? (hit ? 'Target reached' : 'Completed') : 'Failed') + '</div><div class="why">Quality ' + fmt(s.quality) + ' / target ' + fmt(g.target) + '</div><div class="row"><button class="btn go" data-act="g-restart">Next craft</button></div></div>';
    } else {
      h += '<div class="call' + (g.thinking ? ' thinking' : '') + '" aria-live="polite"><span class="what">' + (g.chosen ? 'You chose' : g.thinking ? 'Thinking…' : 'Do this next') + '</span><div class="act-row">' + (a ? tileHtml(a.key, a.name, a.kind === 'PQ' ? 'P' : (a.kind || 'O'), false, true) : '') + '<div class="act">' + esc(a ? a.name : '…') + '</div></div>';
      if (g.rec && !g.chosen && !g.thinking) {
        h += '<div class="why">' + esc(g.rec.reason || '') + '</div>';
        if (g.rec.estimate) h += '<div class="est">' + (g.rec.estimate.pTarget >= 0.01 ? 'Simulated chance to reach the target: at least ~' + Math.round(g.rec.estimate.pTarget * 100) + '%' : 'Target out of reach in simulation; aiming for the most quality') + ' · ' + fmt(g.rec.estimate.n) + ' sims</div>';
        if (g.rec.fallback) h += '<div class="est">Quick heuristic (search skipped).</div>';
      }
      h += '</div>';
      if (a && !g.thinking) h += guideOrbs(a, s, st);
      h += '<div class="row"><button class="btn sm" data-act="g-other">I used a different action…</button>' + (g.chosen ? '<button class="btn sm ghost" data-act="g-back">Back to the recommendation</button>' : '') + '</div>';
      if (g.otherOpen) h += '<div class="chips">' + CS.ACTIONS.map(function (x) { var why = CS.whyNot(x, syncMm(CS.copyState(s)), st); var u = iconUrl(EN_NAME[x.key] || '', S.job); return '<button class="btn sm" data-act="g-pick" data-v="' + x.id + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>' + (u ? '<img class="mini" src="' + u + '" alt="">' : '') + esc(x.name) + '</button>'; }).join('') + '</div>';
    }
    h += '</div><div style="display:grid;gap:14px"><div class="gauges">' + gauge('progress', t('Progress'), s.progress, st.maxProgress) + gauge('quality', t('Quality'), s.quality, st.maxQuality, g.target) +
      gauge('durability', t('Durability'), s.durability, st.maxDurability) + gauge('cp', 'CP', s.cp, st.maxCp) +
      '<div class="row"><span class="label">Condition</span><span class="orb c' + s.cond + '" style="min-height:0;padding:4px 8px;grid-template-columns:22px auto"><span class="o"></span>' + CS.COND_NAMES[s.cond] + '</span><span class="label">Step ' + s.step + '</span></div>' +
      '<div class="chips">' + guideBuffs(s) + '</div></div>' +
      '<details class="drawer"><summary>Correct state</summary><div>' + correctForm(s, st) + '</div></details>' +
      '<details class="drawer"><summary>History · ' + g.history.length + '</summary><div class="hist"><ol>' + g.history.map(function (x) {
        return '<li>' + esc(CS.ACTIONS[x.action].name) + (x.ok === false ? ' <b style="color:var(--madder)">failed</b>' : '') + (x.pg ? ' +' + fmt(x.pg) + 'P' : '') + (x.qg ? ' +' + fmt(x.qg) + 'Q' : '') + ' → ' + CS.COND_NAMES[x.cond] + '</li>';
      }).join('') + '</ol></div></details></div></div></div>';
    el.innerHTML = h;
  }
  function guideOrbs(a, s, st) {
    var risky = CS.successRate(a, s) < 100;
    var after = CS.apply(a, syncMm(CS.copyState(s)), st, true);
    if (after.done === 1 && !risky) return '<div class="orbs"><button class="orb likely c0" data-act="g-cond" data-v="0" data-ok="1"><span class="o"></span>Done, craft complete<kbd>↵</kbd></button></div>';
    if (!a.step && a !== A.CarefulObservation) return '<div class="orbs"><button class="orb likely c' + s.cond + '" data-act="g-cond" data-v="' + s.cond + '" data-ok="1"><span class="o"></span>Done (condition unchanged)<kbd>↵</kbd></button></div>';
    var forced = CS.COND_MODELS.teamcraft.forced(s.cond);
    if (forced !== CS.COND_MODELS.craftimizer.forced(s.cond)) forced = -1;
    var opts = CS.possibleNextConditions(after, Object.assign({}, st, { condModel: 'teamcraft' }), true);
    if (S.guide.mmEndsAt || after.mm > 0) CS.MM_CONDS.forEach(function (x) { if (opts.indexOf(x) < 0) opts.push(x); });
    opts.sort(function (x, y) { return x - y; });
    var row = function (ok) {
      return '<div class="orbs">' + opts.map(function (c) { return '<button class="orb c' + c + (ok && c === forced ? ' likely' : '') + (ok ? '' : ' fail') + '" data-act="g-cond" data-v="' + c + '" data-ok="' + (ok ? 1 : 0) + '"><span class="o"></span><span class="n">' + (ok ? '' : '✗ ') + CS.COND_NAMES[c] + '</span><kbd>' + (ok ? '' : '⇧') + COND_KEYS[c].toUpperCase() + '</kbd></button>'; }).join('') + '</div>';
    };
    return '<span class="label">' + (risky ? 'If it succeeded, the new condition is' : 'After using it in game, the new condition is') + '</span>' + row(true) + (risky ? '<span class="label">If it failed</span>' + row(false) : '');
  }
  function guideBuffs(s) {
    var b = [];
    if (s.iq) b.push('Inner Quiet ' + s.iq); if (s.inno) b.push('Innovation ' + s.inno); if (s.vene) b.push('Veneration ' + s.vene); if (s.gs) b.push('Great Strides ' + s.gs);
    if (s.wn) b.push('Waste Not ' + s.wn); if (s.manip) b.push('Manipulation ' + s.manip); if (s.mume) b.push('Muscle Memory ' + s.mume); if (s.ssh) b.push('Steady Hand ' + s.ssh);
    if (s.exped) b.push('Expedience'); if (s.hs) b.push('Heart and Soul'); if (s.tp) b.push('Trained Perfection');
    var g = S.guide;
    if (g.mmEndsAt > Date.now()) b.push('Material Miracle ~' + Math.ceil((g.mmEndsAt - Date.now()) / 1000) + ' s');
    if (s.sshCharges) b.push('SSH charges ' + s.sshCharges); if (s.mmCharges) b.push('MM charges ' + s.mmCharges);
    return b.length ? b.map(function (x) { return '<span class="chip">' + x + '</span>'; }).join('') : '<span class="dim">No active effects</span>';
  }
  function correctForm(s, st) {
    var f = function (lbl, k, max) { return '<label class="field"><span class="label">' + lbl + '</span><input type="number" data-fix="' + k + '" min="0" max="' + max + '" value="' + s[k] + '"></label>'; };
    return '<div class="grid2">' + f('Progress', 'progress', st.maxProgress) + f('Quality', 'quality', st.maxQuality * 2) + f('Durability', 'durability', st.maxDurability) + f('CP', 'cp', st.maxCp) +
      f('Inner Quiet', 'iq', 10) + f('Innovation', 'inno', 6) + f('Great Strides', 'gs', 5) + f('Veneration', 'vene', 6) + f('Waste Not', 'wn', 10) + f('Manipulation', 'manip', 10) +
      '<label class="field"><span class="label">Condition</span><select data-fix="cond">' + CS.COND_NAMES.map(function (n, i) { return '<option value="' + i + '"' + (s.cond === i ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
      '<button class="btn" data-act="g-fix">Apply correction</button>';
  }

  // ── dialogs ──────────────────────────────────────────────────────────────
  function dialog(html, onClick) {
    var d = $('#dlg'); d.innerHTML = html;
    d.onclick = function (e) { var b = e.target.closest('[data-d]'); if (!b) return; if (b.dataset.d === 'close') d.close(); else onClick(b.dataset.d, d); };
    d.showModal();
  }
  function settingsDialog() {
    var c = S.savedCfg;
    lookUi.open = null;
    setTimeout(function () { bindAppearance($('#dlg')); }, 0);
    var sel = function (id, opts, val) { return '<select id="' + id + '" class="inp">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    dialog('<h3>' + esc(t('Settings')) + '</h3><div class="pane-body" style="padding:0">' +
      '<h4 class="look-h" style="margin:0">Appearance</h4>' +
      '<div id="s-appearance" class="appearance">' + appearanceHtml() + '</div>' +
      '<h4 class="look-h">Workbook</h4>' +
      '<label class="field"><span class="label">' + esc(t('Layout')) + '</span>' + sel('s-layout', [['default', t('Default')], ['compact', t('Compact')]], S.layout) + '</label>' +
      '<label class="check"><input type="checkbox" id="s-loadsaved"' + (c.loadFromSaved ? ' checked' : '') + '> ' + esc(t('Load saved rotations when initiating solve')) + '</label>' +
      '<label class="field"><span class="label">' + esc(t('Default operation on clicking Load button:')) + '</span>' + sel('s-op', [['rotation', 'Rotation only'], ['rotationRecipe', 'Rotation + recipe'], ['rotationRecipeConsumables', 'Rotation + recipe + food and potion']], c.op) + '</label>' +
      '<label class="field"><span class="label">Solve history size</span><input id="s-hist" type="number" min="1" max="500" value="' + c.maxHistory + '"></label>' +
      '<div class="grid2"><label class="field"><span class="label">Guide thinking time</span>' + sel('s-gms', [[200, '0.2 s'], [500, '0.5 s'], [1000, '1 s'], [2000, '2 s']], S.guideMs) + '</label>' +
      '<label class="field"><span class="label">Condition rate model</span>' + sel('s-cm', [['teamcraft', 'Teamcraft estimates'], ['craftimizer', 'Craftimizer estimates']], S.condModel) + '</label></div>' +
      '<div class="dim" style="font-size:13px">' + esc(t('Compute threads')) + ': ' + CORES + '. ' + (CORES > 1 ? 'Running as the installed or hosted app, the solver uses ' + CORES + ' cores. ' : (HOSTED ? 'Multi-core solving needs a moment on the very first visit; reload once if this stays at 1. ' : 'Opened from a file, browsers do not allow multi-threaded WebAssembly, so the solver uses one core. Use the installable app for multi-core solving. ')) +
      (canStore ? 'Settings are saved in this browser.' : 'Browser storage is blocked here; settings last until the page closes.') + '</div>' +
      '<div class="row"><button class="btn go" data-d="save">' + esc(t('Close')) + '</button></div></div>', function (v, d) {
      if (v !== 'save') return;
      S.layout = $('#s-layout', d).value; c.loadFromSaved = $('#s-loadsaved', d).checked; c.op = $('#s-op', d).value;
      c.maxHistory = clampInt($('#s-hist', d).value, 1, 500, 50); S.guideMs = +$('#s-gms', d).value; S.condModel = $('#s-cm', d).value;
      S.history = S.history.slice(0, c.maxHistory);
      applyTheme(); persist(); d.close(); renderAll();
    });
  }
  function pasteDialog() {
    dialog('<h3>' + esc(t('📋 Paste config here to load')) + '</h3><textarea id="cfgtext" class="inp" rows="6" style="font-family:var(--f-data);font-size:12px" placeholder="(selected_job:0,crafter_stats:(...))"></textarea>' +
      '<div class="row" style="margin-top:10px"><button class="btn go" data-d="load">' + esc(t('Load')) + '</button><button class="btn" data-d="close">' + esc(t('Cancel')) + '</button></div>', function (v, d) {
      if (v !== 'load') return;
      try {
        var c = call('config_from_ron', $('#cfgtext', d).value);
        S.stats = c.crafter_stats.map(function (x) { return { level: x.level, craftsmanship: x.craftsmanship, control: x.control, cp: x.cp, manipulation: x.manipulation, heartAndSoul: x.heart_and_soul, quickInnovation: x.quick_innovation }; });
        S.job = c.selected_job; persist(); d.close(); renderAll(); toast('Crafter config loaded');
      } catch (e) { toast('Not a crafter config: ' + e.message); }
    });
  }
  function copyText(text, btn) {
    var done = function () { if (btn) { btn.classList.add('done'); var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.classList.remove('done'); btn.textContent = o; }, 1400); } else toast('Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Select the text and copy it'); } ta.remove(); }
  }

  // ── events ───────────────────────────────────────────────────────────────
  function selectRecipe(id) {
    S.recipeId = id;
    try { S.recipe = call('recipe', id, S.locale); } catch (e) { S.recipe = null; }
    S.hqMat = [0, 0, 0, 0, 0, 0];
    var c = cosmicInfo();
    S.solver.ssh = c ? c.ssh : 0;
    if (c && c.tiers) S.target.kind = 'c3';
    else if (S.target.kind.charAt(0) === 'c' && S.target.kind !== 'custom') S.target.kind = 'full';
    S.result = null;
  }
  function setPane(p) {
    S.pane = p;
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.pane === p); });
    document.querySelectorAll('.bench > section').forEach(function (s) { s.classList.toggle('on', s.id === 'pane-' + p); });
  }
  function configChanged() { S.result = null; persist(); renderCrafter(); renderRotation(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.closest('dialog')) { if (!e.target.closest('.combo')) document.querySelectorAll('.combo-list').forEach(function (l) { l.classList.add('hidden'); }); return; }
    var act = b.dataset.act, v = b.dataset.v;
    switch (act) {
      case 'mode': S.mode = v; S.result = null; persist(); renderRecipe(); renderCrafter(); renderRotation(); break;
      case 'recipe': selectRecipe(+v); persist(); document.querySelectorAll('.item.on').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); renderSpec(); renderCrafter(); renderRotation(); break;
      case 'iqmode': S.iqMode = v; renderSpec(); configChanged(); break;
      case 'hq': { var i = +b.dataset.i, ing = S.recipe.ingredients[i]; S.hqMat[i] = Math.max(0, Math.min(ing.amount, S.hqMat[i] + (+b.dataset.d))); renderSpec(); configChanged(); break; }
      case 'copy-item': copyText(clean(S.recipe.name)); break;
      case 'hq-max': S.iqMode = 'materials'; S.recipe.ingredients.forEach(function (ing, i) { if (ing.hqable) S.hqMat[i] = ing.amount; }); renderSpec(); configChanged(); break;
      case 'hq-goto': {
        if (window.matchMedia('(max-width: 860px)').matches) setPane('recipe');
        var box = $('#hq-box');
        if (box) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); }
        break;
      }
      case 'job': S.job = +v; persist(); if (S.activeJobOnly) renderResults(); configChanged(); break;
      case 'copy-all': { var st = stats(); S.stats = S.stats.map(function () { return Object.assign({}, st); }); persist(); toast(t('Copy to all jobs') + ' ✓'); break; }
      case 'copy-cfg': copyText(B.config_to_ron(JSON.stringify({ selected_job: S.job, crafter_stats: S.stats.map(function (x) { return { craftsmanship: x.craftsmanship, control: x.control, cp: x.cp, level: x.level, manipulation: x.manipulation, heart_and_soul: x.heartAndSoul, quick_innovation: x.quickInnovation }; }) }))); break;
      case 'paste-cfg': pasteDialog(); break;
      case 'clear-food': S.food = null; configChanged(); break;
      case 'clear-potion': S.potion = null; configChanged(); break;
      case 'pick-food': S.food = { id: +b.dataset.id, hq: b.dataset.hq === '1' }; configChanged(); break;
      case 'pick-potion': S.potion = { id: +b.dataset.id, hq: b.dataset.hq === '1' }; configChanged(); break;
      case 'solve': solveNow(); break;
      case 'cancel': cancelSolves(); S.solving = null; renderCrafter(); renderRotation(); break;
      case 'guide': openGuide(); break;
      case 'apply-loadout': applyLoadout(); break;
      case 'save': {
        var r = S.result; if (!r || !r.actions) break;
        S.saved.unshift(Object.assign({}, S.history.find(function (x) { return x.key === solveKey(r.req); }) || { req: r.req, key: solveKey(r.req), actions: r.actions, job: S.job, recipeId: S.recipeId, name: S.recipe ? clean(S.recipe.name) : 'Custom recipe', food: S.food, potion: S.potion }, { id: 's' + Date.now().toString(36) }));
        persist(); renderRotation(); toast(t('Saved macros') + ' ✓'); break;
      }
      case 'load-saved': loadRotation(S.saved.find(function (x) { return x.id === b.dataset.id; })); break;
      case 'load-history': loadRotation(S.history.find(function (x) { return x.id === b.dataset.id; })); break;
      case 'del-saved': S.saved = S.saved.filter(function (x) { return x.id !== b.dataset.id; }); persist(); renderRotation(); break;
      case 'del-history': S.history = S.history.filter(function (x) { return x.id !== b.dataset.id; }); persist(); renderRotation(); break;
      case 'copy-macro': copyText($('#mc' + b.dataset.i).textContent, b); break;
      case 'tab': setPane(b.dataset.pane); break;
      case 'settings': settingsDialog(); break;
      case 'g-close': closeGuide(); break;
      case 'use-macro': if (S.result) { S.result.dismissed = true; renderRotation(); } break;
      case 'g-undo': guideUndo(); break;
      case 'g-restart': { var g = S.guide; g.state = CS.initialState(g.st); g.history = []; g.mmEndsAt = 0; guideThink(); break; }
      case 'g-cond': guideReport(+v, b.dataset.ok === '1'); break;
      case 'g-other': S.guide.otherOpen = !S.guide.otherOpen; renderGuide(); break;
      case 'g-pick': S.guide.chosen = CS.ACTIONS[+v]; S.guide.otherOpen = false; renderGuide(); break;
      case 'g-back': S.guide.chosen = null; renderGuide(); break;
      case 'g-fix': {
        var gg = S.guide, n = CS.copyState(gg.state);
        document.querySelectorAll('#guide [data-fix]').forEach(function (inp) { var k = inp.dataset.fix; n[k] = clampInt(inp.value, 0, +inp.max || 99, n[k]); });
        n.done = n.progress >= gg.st.maxProgress ? 1 : (n.durability <= 0 ? 2 : 0);
        gg.history.push({ state: gg.state, action: 0, ok: true, cond: n.cond }); gg.state = n; guideThink(); break;
      }
    }
  });
  var searchTimer = null;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'q') { S.search = el.value; clearTimeout(searchTimer); searchTimer = setTimeout(renderResults, 90); }
    if (el.dataset.combo) comboOpen(el.dataset.combo, el.value);
  });
  document.addEventListener('focusin', function (e) { if (e.target.dataset && e.target.dataset.combo) { e.target.select(); comboOpen(e.target.dataset.combo, ''); } });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.closest('dialog') || el.closest('#guide')) return;
    if (el.id === 'activejob') { S.activeJobOnly = el.checked; persist(); renderResults(); }
    else if (el.id === 'zone') { S.zone = +el.value; persist(); renderResults(); }
    else if (el.id === 'iqv') { S.iqValue = clampInt(el.value, 0, 65535, 0); configChanged(); }
    else if (el.dataset.stat) { var lim = { level: [1, 100], craftsmanship: [1, 9999], control: [1, 9999], cp: [1, 2000] }[el.dataset.stat]; stats()[el.dataset.stat] = clampInt(el.value, lim[0], lim[1], stats()[el.dataset.stat]); configChanged(); }
    else if (el.dataset.flag) { stats()[el.dataset.flag] = el.checked; configChanged(); }
    else if (el.id === 'cosmictool') { S.cosmicTool = el.checked; configChanged(); }
    else if (el.id === 'target') { S.target.kind = el.value; configChanged(); }
    else if (el.id === 'targetv') { S.target.value = clampInt(el.value, 0, 65535, 0); configChanged(); }
    else if (el.dataset.solver) { var k = el.dataset.solver; S.solver[k] = k === 'ssh' ? clampInt(el.value, 0, 9, 0) : el.checked; configChanged(); }
    else if (el.dataset.custom) { var ck = el.dataset.custom; S.custom[ck] = el.type === 'checkbox' ? el.checked : clampInt(el.value, 0, 65535, S.custom[ck]); persist(); renderRecipe(); configChanged(); }
    else if (el.dataset.macro) { var mk = el.dataset.macro; S.macro[mk] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? clampInt(el.value, 0, 16, 0) : el.value); persist(); renderRotation(); }
    else if (el.id === 'locale') { S.locale = el.value; persist(); loadLocaleData(); if (S.recipeId) selectRecipe(S.recipeId); renderAll(); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !S.guide) { e.preventDefault(); solveNow(); return; }
    var g = S.guide;
    if (!g || $('#dlg').open) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === 'Escape') { closeGuide(); return; }
    if (g.thinking) return;
    var k = e.key.toLowerCase();
    if (k === 'u' || ((e.ctrlKey || e.metaKey) && k === 'z')) { e.preventDefault(); guideUndo(); return; }
    if (k === 'enter') { var l = $('#guide .orb.likely') || (document.querySelectorAll('#guide [data-act=g-cond]').length === 1 ? $('#guide [data-act=g-cond]') : null); if (l) { e.preventDefault(); l.click(); } return; }
    if (KEY_CONDS.hasOwnProperty(k)) {
      var btn = $('#guide [data-act=g-cond][data-v="' + KEY_CONDS[k] + '"][data-ok="' + (e.shiftKey ? 0 : 1) + '"]');
      if (btn) { e.preventDefault(); btn.click(); } else toast(CS.COND_NAMES[KEY_CONDS[k]] + ' is not possible here');
    }
  });
  setInterval(function () { var g = S.guide; if (g && g.mmEndsAt && !g.thinking) { if (g.mmEndsAt <= Date.now()) { g.mmEndsAt = 0; guideThink(); } else renderGuide(); } }, 1000);

  function applyTheme() {
    var root = document.documentElement;
    if (S.theme === 'light' || S.theme === 'dark') root.setAttribute('data-theme', S.theme); else root.removeAttribute('data-theme');
    applyColors();
    document.body.classList.toggle('compact', S.layout === 'compact');
  }
  // ── appearance (laid out like ChatGPT's Appearance settings) ──
  // Mode: System / Light / Dark. Theme: the 20 FFXIV themes. Accent, Background and Foreground can be overridden (HEX or RGB).
  // Advanced: UI and code font size, reduce motion, separate light and dark modes, contrast.
  // The 20 FFXIV-inspired themes (owner choice, 2026-11-06). Each: light and dark [background, foreground, accent, progress].
  var THEMES = [
    ['crystarium-dawnglass', "Crystarium Dawnglass", ['#d9e8f5', '#0d2133', '#b5476b', '#2f6fae'], ['#0f2234', '#e0eefb', '#ffadc4', '#9ad4ff']],
    ['ishgard-hoarfrost', "Ishgard Hoarfrost", ['#dbe2e9', '#1b2128', '#3d6c96', '#8a6a1f'], ['#1e2836', '#e6edf3', '#a9d3f5', '#e4c27a']],
    ['limsa-brineward', "Limsa Brineward", ['#d8e0ec', '#0f1b2b', '#c8202c', '#9a6c12'], ['#0f1b2b', '#e3ebf5', '#ff4b4b', '#e3b04b']],
    ['uldah-sultanate-gilt', "Ul'dah Sultanate Gilt", ['#efe0b0', '#2a1f07', '#8f2236', '#7a5a00'], ['#271c06', '#f7ecd2', '#ff6b82', '#ffc53d']],
    ['twelveswood-verdure', "Twelveswood Verdure", ['#dfeacd', '#16220f', '#3f7d18', '#8a5a00'], ['#16220f', '#e4efd8', '#a6d65a', '#e8b84a']],
    ['allagan-circuitry', "Allagan Circuitry", ['#dde3e2', '#121818', '#a35f00', '#0f7f8c'], ['#132020', '#dfe9e7', '#ffad2e', '#46d9ea']],
    ['magitek-steel', "Magitek Steel", ['#dcdfe2', '#16191c', '#0a7cc2', '#7a1f1f'], ['#14171a', '#e6e9ec', '#3fc6ff', '#ff6b5b']],
    ['umbral-astral', "Umbral Ice, Astral Fire", ['#e4dcf0', '#170d26', '#c2410c', '#1f6fb2'], ['#170d26', '#efe8fa', '#ff6a3d', '#7fd4ff']],
    ['lily-of-thaliak', "Lily of the Healer", ['#ece2e4', '#231a1c', '#2a7f50', '#c8283c'], ['#221a1d', '#f3eaec', '#9fe3b8', '#ff8a9a']],
    ['azure-dragoon', "Azure Dragoon", ['#cfdcf7', '#0a1840', '#1846c8', '#56657f'], ['#0e2257', '#e4ecfb', '#6ea2ff', '#d0dbee']],
    ['abyssal-oath', "Abyssal Oath", ['#efd8de', '#2a0b14', '#a8102c', '#5b3db0'], ['#1f0a10', '#f2e0e5', '#ff3452', '#a98bff']],
    ['moonfire-faire', "Moonfire Faire", ['#f3d6ef', '#2a0d2a', '#b8128f', '#0b8a80'], ['#2a0d2a', '#fbe6f8', '#ff4fd8', '#3cf0d0']],
    ['starlight-celebration', "Starlight Celebration", ['#e3eef0', '#0c2116', '#c21f35', '#1d7a43'], ['#0c2116', '#e8f5ee', '#ffd166', '#ff4d5e']],
    ['aetheryte-glow', "Aetheryte Glow", ['#d2eff0', '#06292c', '#007c8a', '#9a6b00'], ['#052628', '#d6f7f5', '#2ff0e0', '#ffd166']],
    ['first-world-twilight', "First World Twilight", ['#e3ddf6', '#1d1838', '#5a45c4', '#a07a00'], ['#251b48', '#ece7ff', '#ffe08a', '#b9a8ff']],
    ['ascian-crimson', "Ascian Crimson", ['#e2dfdf', '#111111', '#c0080f', '#4d4d4d'], ['#1a1213', '#efebeb', '#ff2424', '#bdbdbd']],
    ['sharlayan-lore', "Sharlayan Lore", ['#dfe1ea', '#181a26', '#7f5d0a', '#2d4f9e'], ['#181a26', '#e6e8f2', '#e2bd52', '#86b8ea']],
    ['radz-at-han-jewel', "Radz-at-Han Jewel", ['#f6dcd6', '#2d0f1f', '#0a7a76', '#8f5600'], ['#3a1624', '#fbe7f0', '#3fe0d6', '#ffc23d']],
    ['doman-sakura', "Doman Sakura", ['#f8dbe8', '#2b1424', '#c02d6c', '#3a4aa8'], ['#2b1626', '#f8e6ef', '#ff9cc6', '#8ea2ff']],
    ['ultima-thule', "Ultima Thule", ['#dcdcef', '#0b0a1f', '#5a35d6', '#007f99'], ['#100c26', '#e9e8ff', '#b07cff', '#4fe3ff']]
  ];
  var ACCENTS = [['default', 'Default'], ['blue', 'Blue', '#0a6cff', '#4aa3ff'], ['green', 'Green', '#13864d', '#43c97f'], ['yellow', 'Yellow', '#a77b00', '#f2c94c'],
    ['pink', 'Pink', '#c8286f', '#ff6fae'], ['orange', 'Orange', '#c9531a', '#ff8a4c'], ['purple', 'Purple', '#7b4bd6', '#b18cff'], ['neutral', 'Black / White', '#111417', '#f0f0f0'], ['custom', 'Custom']];
  function blankSide() { return { theme: 'crystarium-dawnglass', accent: 'default', accentHex: null, bg: null, fg: null }; }
  function defaultLook() { return { separate: false, shared: blankSide(), light: blankSide(), dark: blankSide(), uiFont: 15, codeFont: 12.5, motion: 'system', contrast: 50 }; }
  S.look = (function (d) { var l = defaultLook(); if (d && d.look) { Object.assign(l, d.look); ['shared', 'light', 'dark'].forEach(function (k) { l[k] = Object.assign(blankSide(), d.look[k] || {}); if (!THEMES.some(function (x) { return x[0] === l[k].theme; })) l[k].theme = 'crystarium-dawnglass'; }); } return l; })(load());
  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() { return S.theme === 'dark' || (S.theme !== 'light' && darkMq.matches); }
  function hexRgb(h) { h = String(h || '').trim().replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return !/^[0-9a-f]{6}$/i.test(h) ? null : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbHex(r) { return '#' + r.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join(''); }
  function lum(r) { var c = r.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function mix(a, b, t) { return rgbHex(a.map(function (x, i) { return x + (b[i] - x) * t; })); }
  function sideFor(mode) { return S.look.separate ? S.look[mode] : S.look.shared; }
  function themeOf(id) { return THEMES.find(function (x) { return x[0] === id; }) || THEMES[0]; }
  // The colours a side resolves to in a mode: [bg, fg, accent, progress].
  function resolved(side, mode) {
    var th = themeOf(side.theme)[mode === 'dark' ? 3 : 2];
    var acc = side.accent === 'custom' ? (side.accentHex || th[2]) : side.accent === 'default' ? th[2] : (ACCENTS.find(function (a) { return a[0] === side.accent; }) || [])[mode === 'dark' ? 3 : 2] || th[2];
    return [side.bg || th[0], side.fg || th[1], acc, th[3]];
  }
  function applyLook() {
    var mode = isDark() ? 'dark' : 'light', root = document.documentElement, st = root.style, L = S.look;
    var c = resolved(sideFor(mode), mode), bg = hexRgb(c[0]), fg = hexRgb(c[1]), ac = hexRgb(c[2]), pg = hexRgb(c[3]);
    var k = 0.55 + (L.contrast / 100) * 0.9; // contrast 0..100 -> 0.55..1.45 (50 = designed)
    var dk = lum(bg) < lum(fg);
    root.setAttribute('data-theme', dk ? 'dark' : 'light');
    var set = function (n, v) { st.setProperty(n, v); };
    set('--paper', rgbHex(bg)); set('--paper-2', mix(bg, fg, 0.05 * k)); set('--paper-3', mix(bg, fg, 0.1 * k)); set('--slip', mix(bg, dk ? fg : [255, 255, 255], dk ? 0.07 : 0.6));
    set('--ink', rgbHex(fg)); set('--ink-2', mix(fg, bg, Math.max(0.08, 0.32 / k))); set('--ink-3', mix(fg, bg, Math.max(0.2, 0.5 / Math.sqrt(k)))); set('--rule', mix(bg, fg, Math.min(0.5, 0.18 * k)));
    set('--grid', 'rgba(' + fg.join(',') + ',' + (0.055 * k).toFixed(3) + ')');
    set('--seal', rgbHex(ac)); set('--on-seal', lum(ac) > 0.42 ? '#111111' : '#ffffff'); set('--hi', 'rgba(' + ac.join(',') + ',.16)');
    set('--ochre', rgbHex(pg)); set('color-scheme', dk ? 'dark' : 'light');
    // Limit Break wordmark: a molten ramp from a bright tint of the accent, through the accent, into the progress colour
    set('--lb-a', dk ? mix(ac, [255, 255, 255], 0.55) : mix(ac, fg, 0.25)); set('--lb-b', rgbHex(ac)); set('--lb-c', rgbHex(pg));
    set('--lb-glow', 'rgba(' + ac.join(',') + ',' + (dk ? '.5' : '.28') + ')');
    set('--code-size', L.codeFont + 'px');
    document.body.style.zoom = L.uiFont === 15 ? '' : String(L.uiFont / 15);
    if (L.motion === 'system') root.removeAttribute('data-motion'); else root.setAttribute('data-motion', L.motion);
  }
  function applyColors() { applyLook(); }
  if (darkMq.addEventListener) darkMq.addEventListener('change', applyLook);
  function chip(th, mode) { var c = th[mode === 'dark' ? 3 : 2]; return '<span class="aa" style="background:' + c[0] + ';color:' + c[2] + ';box-shadow:inset 0 0 0 1px ' + c[1] + '33">Aa</span>'; }
  function swatchDot(hex) { return '<span class="dot" style="background:' + hex + '"></span>'; }
  function themeBlock(sideKey, mode) {
    var side = S.look[sideKey], c = resolved(side, mode), th = themeOf(side.theme), open = lookUi.open;
    var id = function (x) { return sideKey + ':' + x; };
    var h = '<div class="look-card">' + (S.look.separate ? '<div class="look-sub">' + (mode === 'dark' ? 'Dark mode' : 'Light mode') + '</div>' : '');
    h += '<div class="look-row"><b>Theme</b><span class="look-ctl"><button type="button" class="icon-btn" data-look="export" data-side="' + sideKey + '" title="Download theme" aria-label="Download theme">⤓</button>' +
      '<button type="button" class="icon-btn" data-look="copy" data-side="' + sideKey + '" title="Copy theme" aria-label="Copy theme">⧉</button>' +
      '<button type="button" class="icon-btn" data-look="import" data-side="' + sideKey + '" title="Paste a theme" aria-label="Paste a theme">⇩</button>' +
      '<button type="button" class="pill" data-look="toggle" data-v="' + id('theme') + '" aria-expanded="' + (open === id('theme')) + '">' + chip(th, mode) + esc(th[1]) + ' <span class="chev">⌄</span></button></span></div>';
    if (open === id('theme')) {
      h += '<div class="menu" role="listbox">' + '<div class="menu-h" style="border-top:0;margin-top:0">FFXIV themes</div>' + THEMES.slice().sort(function (x, y) { return x[1].localeCompare(y[1], 'en', { sensitivity: 'base' }); }).map(function (x) { return themeOpt(x, side, mode, sideKey); }).join('') + '</div>';
    }
    if (open === id('import')) h += '<div class="look-edit"><textarea class="inp" rows="4" data-import="' + sideKey + '" placeholder="Paste a theme copied from the Atelier"></textarea><button type="button" class="btn sm" data-look="import-go" data-side="' + sideKey + '">Load theme</button></div>';
    var acName = (ACCENTS.find(function (a) { return a[0] === side.accent; }) || ACCENTS[0])[1];
    h += '<div class="look-row"><b>Accent</b><span class="look-ctl"><button type="button" class="pill" data-look="toggle" data-v="' + id('accent') + '">' + swatchDot(c[2]) + esc(acName) + ' <span class="chev">⌄</span></button></span></div>';
    if (open === id('accent')) {
      h += '<div class="menu">' + ACCENTS.map(function (a) {
        var hex = a[0] === 'default' ? themeOf(side.theme)[mode === 'dark' ? 3 : 2][2] : a[0] === 'custom' ? (side.accentHex || c[2]) : a[mode === 'dark' ? 3 : 2];
        return '<button type="button" class="opt' + (side.accent === a[0] ? ' on' : '') + '" data-look="accent" data-side="' + sideKey + '" data-v="' + a[0] + '">' + swatchDot(hex) + esc(a[1]) + (side.accent === a[0] ? '<span class="tick">✓</span>' : '') + '</button>';
      }).join('') + '</div>';
    }
    if (side.accent === 'custom' || open === id('accent-edit')) h += picker(sideKey, 'accentHex', c[2]);
    ['bg', 'fg'].forEach(function (key, i) {
      h += '<div class="look-row"><b>' + (key === 'bg' ? 'Background' : 'Foreground') + '</b><span class="look-ctl">' + (side[key] ? '<button type="button" class="btn sm ghost" data-look="clear" data-side="' + sideKey + '" data-v="' + key + '">Theme default</button>' : '') +
        '<button type="button" class="pill mono-pill" data-look="toggle" data-v="' + id(key) + '">' + swatchDot(c[i]) + c[i].toUpperCase() + '</button></span></div>';
      if (open === id(key)) h += picker(sideKey, key, c[i]);
    });
    return h + '</div>';
  }
  function themeOpt(x, side, mode, sideKey) {
    return '<button type="button" class="opt' + (side.theme === x[0] ? ' on' : '') + '" role="option" data-look="theme" data-side="' + sideKey + '" data-v="' + x[0] + '">' + chip(x, mode) + esc(x[1]) + (side.theme === x[0] ? '<span class="tick">✓</span>' : '') + '</button>';
  }
  function picker(sideKey, key, hex) {
    var r = hexRgb(hex) || [0, 0, 0];
    return '<div class="picker" data-side="' + sideKey + '" data-pick="' + key + '"><input type="color" value="' + hex + '" aria-label="' + key + ' colour">' +
      '<span class="codes"><span>HEX</span><input class="inp hx" value="' + hex.toUpperCase() + '" maxlength="7" aria-label="HEX"><span>R</span><input class="inp c" type="number" min="0" max="255" data-ch="0" value="' + r[0] + '">' +
      '<span>G</span><input class="inp c" type="number" min="0" max="255" data-ch="1" value="' + r[1] + '"><span>B</span><input class="inp c" type="number" min="0" max="255" data-ch="2" value="' + r[2] + '"></span></div>';
  }
  var lookUi = { open: null };
  function appearanceHtml() {
    var L = S.look, cur = isDark() ? 'dark' : 'light';
    var tile = function (v, label) {
      var sides = v === 'system' ? ['light', 'dark'] : [v];
      return '<button type="button" class="mode-tile' + (S.theme === v ? ' on' : '') + '" data-look="mode" data-v="' + v + '" aria-pressed="' + (S.theme === v) + '" aria-label="' + label + '"><span class="prev">' + sides.map(function (m) {
        var c = resolved(sideFor(m), m);
        return '<span class="half" style="background:' + c[0] + '"><i style="background:' + c[1] + '"></i><i style="background:' + c[1] + ';width:46%"></i><i style="background:' + c[2] + ';width:62%;margin-left:auto"></i><i style="background:' + c[2] + ';width:40%;margin-left:auto"></i></span>';
      }).join('') + '</span><span class="cap">' + label + '</span></button>';
    };
    var h = '<h4 class="look-h">Visual style</h4><div class="look-card"><div class="look-row"><b>Mode</b><span class="look-ctl tiles">' + tile('system', 'System') + tile('light', 'Light') + tile('dark', 'Dark') + '</span></div></div>';
    h += L.separate ? themeBlock('light', 'light') + themeBlock('dark', 'dark') : themeBlock('shared', cur);
    var seg = function (key, opts) { return '<span class="seg2">' + opts.map(function (o) { return '<button type="button" class="' + (String(L[key]) === String(o[0]) ? 'on' : '') + '" data-look="set" data-k="' + key + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</span>'; };
    h += '<details class="look-adv"' + (lookUi.adv ? ' open' : '') + '><summary>Advanced</summary>' +
      '<div class="look-card"><div class="look-row"><span><b>UI font size</b><small>Adjust the base size used for the Atelier</small></span><span class="look-ctl"><input class="inp num" type="number" min="11" max="22" step="0.5" data-lookn="uiFont" value="' + L.uiFont + '"> px</span></div>' +
      '<div class="look-row"><span><b>Code font size</b><small>Adjust the size used for macro text</small></span><span class="look-ctl"><input class="inp num" type="number" min="9" max="20" step="0.5" data-lookn="codeFont" value="' + L.codeFont + '"> px</span></div></div>' +
      '<div class="look-card"><div class="look-row"><span><b>Reduce motion</b><small>Reduce animations or match your system</small></span><span class="look-ctl">' + seg('motion', [['system', 'System'], ['on', 'On'], ['off', 'Off']]) + '</span></div>' +
      '<div class="look-row"><span><b>Separate light and dark modes</b><small>Choose a theme and colors for each</small></span><span class="look-ctl"><label class="switch"><input type="checkbox" data-look="separate"' + (L.separate ? ' checked' : '') + '><i></i></label></span></div></div>' +
      '<div class="look-card"><div class="look-row"><b>Contrast</b><span class="look-ctl"><input type="range" min="0" max="100" data-lookn="contrast" value="' + L.contrast + '"><span class="cv">' + L.contrast + '</span></span></div></div>' +
      '<div class="row"><button type="button" class="btn sm ghost" data-look="reset">Reset appearance</button></div></details>';
    return h;
  }
  function bindAppearance(d) {
    var box = $('#s-appearance', d);
    var redraw = function () { box.innerHTML = appearanceHtml(); };
    var commit = function () { applyLook(); persist(); redraw(); };
    box.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('look-adv')) lookUi.adv = e.target.open; }, true);
    box.onclick = function (e) {
      var b = e.target.closest('[data-look]'); if (!b || b.tagName === 'INPUT') return;
      var a = b.dataset.look, side = b.dataset.side && S.look[b.dataset.side];
      if (a === 'mode') { S.theme = b.dataset.v; commit(); }
      else if (a === 'toggle') { lookUi.open = lookUi.open === b.dataset.v ? null : b.dataset.v; redraw(); }
      else if (a === 'theme') { side.theme = b.dataset.v; side.bg = side.fg = null; if (side.accent === 'custom') side.accentHex = null; lookUi.open = null; commit(); }
      else if (a === 'accent') { side.accent = b.dataset.v; lookUi.open = b.dataset.v === 'custom' ? null : null; commit(); }
      else if (a === 'clear') { side[b.dataset.v] = null; commit(); }
      else if (a === 'set') { S.look[b.dataset.k] = b.dataset.v; commit(); }
      else if (a === 'reset') { S.look = defaultLook(); S.theme = 'system'; lookUi.open = null; commit(); }
      else if (a === 'export' || a === 'copy') {
        var mode = b.dataset.side === 'dark' || (b.dataset.side === 'shared' && isDark()) ? 'dark' : 'light';
        var c = resolved(side, mode), json = JSON.stringify({ atelierTheme: 1, base: side.theme, accent: c[2], background: c[0], foreground: c[1] }, null, 2);
        if (a === 'copy') copyText(json, null);
        else { var u = URL.createObjectURL(new Blob([json], { type: 'application/json' })), el = document.createElement('a'); el.href = u; el.download = 'atelier-theme-' + side.theme + '.json'; document.body.appendChild(el); el.click(); el.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); toast('Theme downloaded'); }
      }
      else if (a === 'import') { lookUi.open = lookUi.open === b.dataset.side + ':import' ? null : b.dataset.side + ':import'; redraw(); }
      else if (a === 'import-go') {
        try {
          var o = JSON.parse($('[data-import="' + b.dataset.side + '"]', d).value);
          if (o.base && themeOf(o.base)[0] === o.base) side.theme = o.base;
          if (hexRgb(o.background)) side.bg = rgbHex(hexRgb(o.background)); if (hexRgb(o.foreground)) side.fg = rgbHex(hexRgb(o.foreground));
          if (hexRgb(o.accent)) { side.accent = 'custom'; side.accentHex = rgbHex(hexRgb(o.accent)); }
          lookUi.open = null; commit(); toast('Theme loaded');
        } catch (err) { toast('That is not an Atelier theme'); }
      }
    };
    box.onchange = function (e) {
      if (e.target.dataset.look === 'separate') {
        S.look.separate = e.target.checked;
        if (S.look.separate) { S.look.light = Object.assign({}, S.look.shared); S.look.dark = Object.assign({}, S.look.shared); }
        lookUi.adv = true; commit();
      } else if (e.target.dataset.lookn) {
        var n = e.target.dataset.lookn, lim = { uiFont: [11, 22, 15], codeFont: [9, 20, 12.5], contrast: [0, 100, 50] }[n];
        var v = +e.target.value; S.look[n] = isNaN(v) ? lim[2] : Math.max(lim[0], Math.min(lim[1], v)); lookUi.adv = true; commit();
      }
    };
    box.oninput = function (e) {
      if (e.target.dataset.lookn === 'contrast') { S.look.contrast = +e.target.value; var cv = e.target.parentNode.querySelector('.cv'); if (cv) cv.textContent = e.target.value; applyLook(); return; }
      var pk = e.target.closest('[data-pick]'); if (!pk) return;
      var side = S.look[pk.dataset.side], key = pk.dataset.pick, v = null, curHex = pk.querySelector('.hx').value;
      if (e.target.type === 'color') v = e.target.value;
      else if (e.target.classList.contains('hx')) { var r = hexRgb(e.target.value); if (r) v = rgbHex(r); }
      else if (e.target.dataset.ch != null) { var cur = hexRgb(curHex) || [0, 0, 0]; cur[+e.target.dataset.ch] = clampInt(e.target.value, 0, 255, 0); v = rgbHex(cur); }
      if (!v) return;
      side[key] = v; if (key === 'accentHex') side.accent = 'custom';
      applyLook(); persist();
      var rgb = hexRgb(v);
      pk.querySelectorAll('input').forEach(function (inp) {
        if (inp === e.target) return;
        if (inp.type === 'color') inp.value = v; else if (inp.classList.contains('hx')) inp.value = v.toUpperCase(); else if (inp.dataset.ch != null) inp.value = rgb[+inp.dataset.ch];
      });
      var pill = box.querySelector('[data-v="' + pk.dataset.side + ':' + (key === 'accentHex' ? 'accent' : key) + '"]');
      if (pill) { var dot = pill.querySelector('.dot'); if (dot) dot.style.background = v; if (key !== 'accentHex') pill.lastChild.textContent = v.toUpperCase(); }
    };
  }
  function renderHeader() {
    $('#locale').innerHTML = LOCALES.map(function (l) { return '<option value="' + l[0] + '"' + (S.locale === l[0] ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('');
    document.querySelectorAll('.tabs button').forEach(function (b) { b.textContent = { recipe: t('Recipe'), crafter: t('Crafter stats'), rotation: t('Macro') }[b.dataset.pane]; });
  }
  function renderAll() { renderHeader(); renderRecipe(); renderCrafter(); renderRotation(); setPane(S.pane); }

  // ── boot ─────────────────────────────────────────────────────────────────
  var WASM_BYTES = null;
  function b64(s) { var bin = atob(s), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u; }
  (function boot() {
    applyTheme();
    try {
      WASM_BYTES = b64($('#raphael-wasm').textContent.trim());
      (0, eval)(GLUE_SRC + ';window.__raphael=wasm_bindgen;');
      WebAssembly.compile(WASM_BYTES).then(function (mod) {
        WASM_MODULE = mod;
        return window.__raphael({ module_or_path: mod });
      }).then(function () {
        B = window.__raphael;
        loadLocaleData();
        if (S.recipeId) selectRecipe(S.recipeId);
        startSolverWorker();
        renderAll();
        $('#boot').remove();
      }).catch(function (err) { $('#boot').innerHTML = '<p style="max-width:40ch;padding:20px">The solver could not start in this browser: ' + esc(err.message || err) + '</p>'; });
    } catch (err) { $('#boot').innerHTML = '<p style="padding:20px">The solver could not start: ' + esc(err.message) + '</p>'; }
  })();
  // ── installable app (hosted only; the single offline file is unchanged) ──
  (function pwa() {
    if (!HOSTED || !('serviceWorker' in navigator)) return;
    var link = document.createElement('link'); link.rel = 'manifest'; link.href = 'manifest.webmanifest'; document.head.appendChild(link);
    var tc = document.createElement('meta'); tc.name = 'theme-color'; tc.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#0f2234'; document.head.appendChild(tc);
    navigator.serviceWorker.register('sw.js').then(function () {
      // the first visit is not yet cross-origin isolated (the service worker adds the headers): reload once it takes control
      if (!self.crossOriginIsolated) {
        var once = false; try { once = sessionStorage.getItem('atelier-coi-reload') === '1'; } catch (e) { /* ignore */ }
        if (!once) navigator.serviceWorker.addEventListener('controllerchange', function () { try { sessionStorage.setItem('atelier-coi-reload', '1'); } catch (e) { /* ignore */ } location.reload(); });
        if (!once && navigator.serviceWorker.controller) { try { sessionStorage.setItem('atelier-coi-reload', '1'); } catch (e) { /* ignore */ } location.reload(); }
      }
    }).catch(function () { /* offline install unavailable; the page still works */ });
    var deferred = null, btn = document.createElement('button');
    btn.className = 'btn sm install-btn hidden'; btn.textContent = '⤓ Install app'; btn.setAttribute('data-install', '1');
    var tools = document.querySelector('.mast-tools'); if (tools) tools.insertBefore(btn, tools.firstChild);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; btn.classList.remove('hidden'); });
    window.addEventListener('appinstalled', function () { btn.classList.add('hidden'); toast('Eveniunt Atelier installed'); });
    btn.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { deferred = null; btn.classList.add('hidden'); }); });
  })();
  window.__atelier = { S: S, threads: function () { return CORES; }, iconUrl: iconUrl, enName: function (k) { return EN_NAME[k]; }, solveNow: solveNow, openGuide: openGuide, guideReport: guideReport, call: function () { return call.apply(null, arguments); } };
})();
