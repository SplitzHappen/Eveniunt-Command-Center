/* Cosmic Crafting Solver - user interface. Manually operated: it never reads
 * game memory or sends input to the game. */
(function () {
  'use strict';
  var CS = window.CS;
  var A = CS.A, COND = CS.COND;
  var DB = JSON.parse(document.getElementById('db').textContent);
  var ENGINE_SRC = document.getElementById('engine').textContent;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var RANKS = ['D', 'C', 'B', 'A', 'EX', 'EX+', 'Master'];
  var COND_KEYS = { 0: 'n', 1: 'g', 2: 'e', 3: 'p', 4: 'c', 5: 's', 6: 'l', 7: 'm', 8: 'r', 9: 'o', 10: 'b' };
  var KEY_CONDS = {}; Object.keys(COND_KEYS).forEach(function (c) { KEY_CONDS[COND_KEYS[c]] = +c; });
  var STORE_KEY = 'cosmic-solver-v1';

  // ---------------------------------------------------------------- storage
  var memoryStore = {};
  var storageOk = (function () {
    try { var k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
  })();
  function load() {
    try { if (storageOk) return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { /* ignore */ }
    return memoryStore[STORE_KEY] || null;
  }
  function save() {
    var data = {
      settings: app.settings, profiles: app.profiles, profileByJob: app.profileByJob, job: app.job,
      rankFilter: app.rankFilter, expertOnly: app.expertOnly, mode: app.mode,
      planetCraft: app.craft ? serializeCraft() : null
    };
    var all = load() || {};
    all.shared = { settings: data.settings, profiles: data.profiles, profileByJob: data.profileByJob, job: data.job, mode: data.mode };
    all[DB.planet.key] = { rankFilter: data.rankFilter, expertOnly: data.expertOnly, craft: data.planetCraft };
    try { if (storageOk) { localStorage.setItem(STORE_KEY, JSON.stringify(all)); return; } } catch (e) { storageOk = false; }
    memoryStore[STORE_KEY] = all;
  }

  // ---------------------------------------------------------------- state
  var defaultProfile = function (job) {
    return { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: DB.jobs[job] + ' main', job: job, level: 100,
      craftsmanship: 5400, control: 5200, cp: 700, specialist: false, manipulation: true, cosmicTool: true };
  };
  var app = {
    settings: { condModel: 'teamcraft', thinkMs: 500, showEstimate: true, mmSecPerStep: 3, theme: 'auto' },
    profiles: [], profileByJob: {}, job: 0, rankFilter: 'all', expertOnly: false, search: '',
    missionId: null, recipeId: null, targetKey: null, customTarget: '', mode: 'reliable',
    session: null, craft: null, rec: null, thinking: false, setupOpen: true
  };
  (function restore() {
    var all = load() || {};
    var sh = all.shared || {};
    if (sh.settings) Object.assign(app.settings, sh.settings);
    if (sh.profiles) app.profiles = sh.profiles;
    if (sh.profileByJob) app.profileByJob = sh.profileByJob;
    if (typeof sh.job === 'number') app.job = sh.job;
    if (sh.mode) app.mode = sh.mode;
    var pl = all[DB.planet.key] || {};
    if (pl.rankFilter) app.rankFilter = pl.rankFilter;
    if (pl.expertOnly) app.expertOnly = pl.expertOnly;
    app.pendingRestore = pl.craft || null;
  })();
  applyTheme();

  function currentProfile() {
    var id = app.profileByJob[app.job];
    var p = app.profiles.find(function (x) { return x.id === id && x.job === app.job; });
    if (!p) p = app.profiles.find(function (x) { return x.job === app.job; });
    if (!p) { p = defaultProfile(app.job); app.profiles.push(p); }
    app.profileByJob[app.job] = p.id;
    return p;
  }
  function missionsForJob() {
    return DB.missions.filter(function (m) { return m.job === app.job; });
  }
  function mission() { return DB.missions.find(function (m) { return m.id === app.missionId; }) || null; }
  function recipe() { return app.recipeId ? DB.recipes[String(app.recipeId)] : null; }

  // ---------------------------------------------------------------- helpers
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (n || 0).toLocaleString('en-US'); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.add('hidden'); }, 2400);
  }
  function applyTheme() {
    var t = app.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  function objectiveSummary(m) {
    return m.objectives.map(function (o) {
      if (o.kind === 'craft') return o.items.map(function (it) { return it.quantity + '× ' + it.name; }).join(', ');
      if (o.kind === 'score') return o.bronzeScore ? 'score ≥ ' + fmt(o.bronzeScore) : 'final phase';
      if (o.kind === 'deliver') return 'deliver to location';
      return o.kind;
    }).join(' · ');
  }
  function specialOf(m) {
    var o = m.objectives.find(function (x) { return x.specialAction; });
    return o ? { action: o.specialAction, charges: o.specialActionCharges } : null;
  }
  function plannedCrafts(m) {
    var o = m.objectives.find(function (x) { return x.kind === 'craft'; });
    if (o && o.items.length) return o.items.reduce(function (a, it) { return a + it.quantity; }, 0);
    return 3;
  }
  function targets(r) {
    var out = [];
    if (r.tiers) {
      r.tiers.forEach(function (q, i) { out.push({ key: 't' + (i + 1), label: 'Tier ' + (i + 1), sub: '≥ ' + fmt(q) + ' (' + r.tierPct[i] + '%)', q: q }); });
    }
    if (r.requiredQuality) out.push({ key: 'req', label: 'Required', sub: '≥ ' + fmt(r.requiredQuality), q: r.requiredQuality });
    out.push({ key: 'max', label: 'Max quality', sub: fmt(r.quality), q: r.quality });
    out.push({ key: 'done', label: 'Just complete', sub: 'no quality goal', q: 0 });
    out.push({ key: 'custom', label: 'Custom', sub: '', q: null });
    return out;
  }
  function defaultTargetKey(r) {
    if (r.requiredQuality) return 'req';
    if (r.tiers) return 't3';
    return 'max';
  }

  // ---------------------------------------------------------------- setup view
  function renderSetup() {
    var el = $('#setup');
    var p = currentProfile();
    var ms = missionsForJob();
    var m = mission();
    var r = recipe();
    var q = app.search.trim().toLowerCase();
    var list = ms.filter(function (x) {
      if (app.rankFilter !== 'all' && x.rank !== app.rankFilter) return false;
      if (app.expertOnly && !x.recipes.some(function (id) { return DB.recipes[String(id)].expert; })) return false;
      if (q && x.name.toLowerCase().indexOf(q) < 0 && !x.recipes.some(function (id) { return DB.recipes[String(id)].name.toLowerCase().indexOf(q) >= 0; })) return false;
      return true;
    });
    var collapsed = app.craft && !app.setupOpen;
    var h = '<h2><span class="grow">Setup</span>' + (app.craft ? '<button class="small" data-act="toggleSetup">' + (collapsed ? 'Show' : 'Hide') + '</button>' : '') + '</h2>';
    if (collapsed) {
      h += '<div class="small">' + esc(DB.jobNames[app.job]) + ' · ' + esc(p.name) + ' · ' + (m ? esc(m.name) : '') + '</div>';
      el.innerHTML = h; return;
    }
    h += '<div class="chips" role="group" aria-label="Class">' + DB.jobs.map(function (j, i) {
      return '<button class="chip' + (i === app.job ? ' on' : '') + '" data-act="job" data-v="' + i + '" title="' + esc(DB.jobNames[i]) + '">' + j + '</button>';
    }).join('') + '</div>';
    // crafter profile
    var profs = app.profiles.filter(function (x) { return x.job === app.job; });
    h += '<div class="row" style="margin-top:10px"><div class="field" style="flex:1;min-width:160px">Crafter profile<select data-act="profile">' +
      profs.map(function (x) { return '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') +
      '</select></div><button class="small" data-act="newProfile">New</button><button class="small" data-act="renameProfile">Rename</button>' +
      '<button class="small" data-act="deleteProfile"' + (profs.length < 2 ? ' disabled' : '') + '>Delete</button></div>';
    h += '<div class="grid2" style="margin-top:8px">' +
      numField('Level', 'level', p.level, 10, 100) + numField('Craftsmanship', 'craftsmanship', p.craftsmanship, 1, 9999) +
      numField('Control', 'control', p.control, 1, 9999) + numField('Max CP', 'cp', p.cp, 1, 2000) + '</div>';
    h += '<div class="row small" style="margin-top:6px">' +
      chk('Specialist', 'specialist', p.specialist) + chk('Manipulation learned', 'manipulation', p.manipulation) +
      chk('Cosmic tool phase 9+ (Good ×1.75)', 'cosmicTool', p.cosmicTool) + '</div>';
    h += '<div class="note">Enter stats as shown in game with food and medicine already applied.</div>';
    // mission filter
    h += '<h2 style="margin-top:12px">Mission</h2><div class="chips">' + ['all'].concat(RANKS).map(function (k) {
      var n = k === 'all' ? ms.length : ms.filter(function (x) { return x.rank === k; }).length;
      if (!n) return '';
      return '<button class="chip' + (app.rankFilter === k ? ' on' : '') + '" data-act="rank" data-v="' + k + '">' + (k === 'all' ? 'All' : k) + ' <span class="muted">' + n + '</span></button>';
    }).join('') + '<button class="chip' + (app.expertOnly ? ' on' : '') + '" data-act="expertOnly">Expert only</button></div>';
    h += '<input type="text" placeholder="Search mission or item" data-act="search" value="' + esc(app.search) + '" style="margin-top:8px" aria-label="Search missions">';
    h += '<div class="missions" role="listbox" aria-label="Missions">' + (list.length ? list.map(function (x) {
      var sp = specialOf(x);
      var ex = x.recipes.some(function (id) { return DB.recipes[String(id)].expert; });
      var stars = Math.max.apply(null, x.recipes.map(function (id) { return DB.recipes[String(id)].stars; }));
      return '<button class="mission' + (x.id === app.missionId ? ' on' : '') + '" data-act="mission" data-v="' + x.id + '" role="option">' +
        '<div class="t">' + esc(x.name) + '</div><div class="m">' +
        '<span class="badge">' + x.rank + '</span>' + (ex ? '<span class="badge x">Expert</span>' : '') +
        (stars ? '<span class="badge">' + '★'.repeat(stars) + '</span>' : '') +
        (x.critical ? '<span class="badge">Critical</span>' : '') + (x.timeLimitSec ? '<span class="badge">' + Math.round(x.timeLimitSec / 60) + ' min</span>' : '') +
        (sp ? '<span class="badge">' + (sp.action === 'StellarSteadyHand' ? 'Steady Hand' : 'Material Miracle') + ' ×' + sp.charges + '</span>' : '') +
        ' Lv' + x.minLevel + ' · ' + esc(objectiveSummary(x)) + '</div></button>';
    }).join('') : '<div class="muted small" style="padding:10px">No missions match.</div>') + '</div>';
    if (m) h += missionDetail(m, r, p);
    el.innerHTML = h;
  }
  function numField(label, key, v, min, max) {
    return '<label class="field">' + label + '<input type="number" inputmode="numeric" data-act="stat" data-k="' + key + '" value="' + v + '" min="' + min + '" max="' + max + '"></label>';
  }
  function chk(label, key, v) {
    return '<label class="inline"><input type="checkbox" data-act="flag" data-k="' + key + '"' + (v ? ' checked' : '') + '> ' + label + '</label>';
  }
  function missionDetail(m, r, p) {
    var h = '<div style="margin-top:12px">';
    h += '<div class="small muted">' + esc(m.text) + '</div>';
    h += '<div class="small" style="margin-top:4px">';
    if (m.silver || m.gold) h += 'Silver ' + fmt(m.silver) + ' · Gold ' + fmt(m.gold) + ' score. ';
    m.objectives.forEach(function (o) { if (o.bronzeScore) h += 'Score target ' + fmt(o.bronzeScore) + '. '; });
    if (m.timeLimitSec) h += 'Time limit ' + Math.round(m.timeLimitSec / 60) + ' min. ';
    if (m.rank === 'Master') h += 'Master mission: phased score targets as listed. ';
    h += '</div><div class="note">Game data gives the mission score thresholds but not the score each crafted item earns. The solver therefore optimizes the quality target you pick for this craft, not the mission score directly.</div>';
    if (m.recipes.length > 1) {
      h += '<div class="field" style="margin-top:6px">Recipe for this craft</div><div class="chips">' + m.recipes.map(function (id) {
        var x = DB.recipes[String(id)];
        return '<button class="chip' + (id === app.recipeId ? ' on' : '') + '" data-act="recipe" data-v="' + id + '">' + esc(x.name) + (x.requiredQuality ? ' (quality ≥ ' + fmt(x.requiredQuality) + ' required)' : '') + '</button>';
      }).join('') + '</div>';
    }
    if (r) {
      h += '<div class="small" style="margin-top:8px"><b>' + esc(r.name) + '</b> · recipe level ' + r.rlvl + (r.stars ? ' ' + '★'.repeat(r.stars) : '') +
        (r.expert ? ' · expert' : '') + ' · progress ' + fmt(r.progress) + ' · quality ' + fmt(r.quality) + ' · durability ' + r.durability +
        ' · conditions: ' + condList(r.conditionsFlag) + '</div>';
      if (r.maxLevelScaling && p.level < r.maxLevelScaling) h += '<div class="small warn">Level-synced: recipe values scale to your level ' + p.level + '.</div>';
      if (p.level < m.minLevel) h += '<div class="small bad">This mission requires level ' + m.minLevel + '.</div>';
      if (!r.maxLevelScaling && p.level < r.level) h += '<div class="small bad">This recipe is level ' + r.level + '; the solver only supports it at that level.</div>';
      var tg = targets(r);
      if (!app.targetKey || !tg.some(function (t) { return t.key === app.targetKey; })) app.targetKey = defaultTargetKey(r);
      h += '<div class="field" style="margin-top:8px">Quality target for this craft</div><div class="chips">' + tg.map(function (t) {
        return '<button class="chip' + (t.key === app.targetKey ? ' on' : '') + '" data-act="target" data-v="' + t.key + '">' + t.label + (t.sub ? ' <span class="muted">' + t.sub + '</span>' : '') + '</button>';
      }).join('') + '</div>';
      if (app.targetKey === 'custom') h += '<input type="number" data-act="customTarget" placeholder="Quality" value="' + esc(app.customTarget) + '" style="margin-top:6px;max-width:200px">';
      if (r.tiers) h += '<div class="note">Tiers are the collectability thresholds from the game sheet (' + r.tierPct.join('/') + '% of max quality).</div>';
      var sp = specialOf(m);
      var ses = sessionFor(m);
      h += '<div class="grid2" style="margin-top:8px">' +
        '<label class="field">Crafts in this mission' + (m.objectives.some(function (o) { return o.kind === 'craft'; }) ? '' : ' (estimate)') + '<input type="number" min="1" max="99" data-act="ses" data-k="craftsTotal" value="' + ses.craftsTotal + '"></label>' +
        '<label class="field">Crafts done<input type="number" min="0" max="99" data-act="ses" data-k="craftsDone" value="' + ses.craftsDone + '"></label>' +
        '<label class="field">Steady Hand charges left<input type="number" min="0" max="9" data-act="ses" data-k="sshLeft" value="' + ses.sshLeft + '"></label>' +
        '<label class="field">Material Miracle charges left<input type="number" min="0" max="9" data-act="ses" data-k="mmLeft" value="' + ses.mmLeft + '"></label></div>';
      h += '<div class="note">Charges come from the mission data' + (sp ? ' (' + (sp.action === 'StellarSteadyHand' ? 'Stellar Steady Hand' : 'Material Miracle') + ' ×' + sp.charges + ')' : ' (none for this mission)') +
        '. The solver spends at most ' + budgetText(ses) + ' this craft, spreading the rest over the remaining crafts.</div>';
      h += '<div class="row" style="margin-top:8px"><span class="small muted">Mode</span>' +
        '<button class="chip' + (app.mode === 'reliable' ? ' on' : '') + '" data-act="mode" data-v="reliable">Reliable</button>' +
        '<button class="chip' + (app.mode === 'fast' ? ' on' : '') + '" data-act="mode" data-v="fast">Fast</button>' +
        '<span class="grow" style="flex:1"></span><button class="primary" data-act="start">' + (app.craft ? 'Restart with these settings' : 'Start craft') + '</button></div>';
    }
    return h + '</div>';
  }
  function condList(flag) {
    var out = [];
    for (var b = 0; b < 11; b++) if (flag >> b & 1) out.push(CS.COND_NAMES[b]);
    return out.join(', ');
  }
  function sessionFor(m) {
    if (!app.session || app.session.missionId !== m.id) {
      var sp = specialOf(m);
      app.session = {
        missionId: m.id, craftsTotal: plannedCrafts(m), craftsDone: 0,
        sshLeft: sp && sp.action === 'StellarSteadyHand' ? sp.charges : 0,
        mmLeft: sp && sp.action === 'MaterialMiracle' ? sp.charges : 0
      };
    }
    return app.session;
  }
  function budgets(ses) {
    var left = Math.max(1, ses.craftsTotal - ses.craftsDone);
    return { ssh: Math.ceil(ses.sshLeft / left), mm: Math.ceil(ses.mmLeft / left) };
  }
  function budgetText(ses) {
    var b = budgets(ses);
    var parts = [];
    if (ses.sshLeft) parts.push(b.ssh + ' Steady Hand');
    if (ses.mmLeft) parts.push(b.mm + ' Material Miracle');
    return parts.length ? parts.join(' and ') : 'no special actions';
  }

  // ---------------------------------------------------------------- craft
  function targetQuality(r) {
    var t = targets(r).find(function (x) { return x.key === app.targetKey; });
    if (!t) return r.quality;
    if (t.key === 'custom') return Math.max(0, Math.min(r.quality * 2, +app.customTarget || 0));
    return t.q;
  }
  function startCraft() {
    var m = mission(), r = recipe(), p = currentProfile();
    if (!m || !r) return;
    if (!r.maxLevelScaling && p.level < r.level) { toast('This recipe needs level ' + r.level + '.'); return; }
    if (p.level < m.minLevel) { toast('This mission needs level ' + m.minLevel + '.'); return; }
    var ses = sessionFor(m);
    var st;
    try {
      st = CS.makeSettings(r, p, DB, {
        sshCharges: ses.sshLeft, mmCharges: ses.mmLeft, condModel: app.settings.condModel,
        mmSteps: Math.max(1, Math.round(45 / app.settings.mmSecPerStep))
      });
    } catch (e) { toast('Cannot build this recipe at level ' + p.level + ': ' + e.message); return; }
    var tq = targetQuality(r);
    var b = budgets(ses);
    app.craft = {
      missionId: m.id, recipeId: r.id, st: st, target: tq,
      lowerTiers: (r.tiers || []).filter(function (x) { return x < tq; }),
      state: CS.initialState(st), history: [], pending: null, chosen: null, mmEndsAt: 0,
      budget: b, startSsh: ses.sshLeft, startMm: ses.mmLeft, profileName: p.name, finished: false
    };
    app.setupOpen = false;
    save();
    renderAll();
    think();
  }
  function serializeCraft() {
    var c = app.craft;
    return {
      missionId: c.missionId, recipeId: c.recipeId, st: c.st, target: c.target, lowerTiers: c.lowerTiers,
      state: c.state, history: c.history.map(function (h) { return { state: h.state, action: h.action, ok: h.ok, cond: h.cond, pg: h.pg, qg: h.qg, edit: h.edit }; }),
      mmEndsAt: c.mmEndsAt, budget: c.budget, startSsh: c.startSsh, startMm: c.startMm, profileName: c.profileName,
      session: app.session, recipeKey: app.targetKey
    };
  }
  function restoreCraft(d) {
    if (!d || !DB.recipes[String(d.recipeId)]) return;
    app.missionId = d.missionId; app.recipeId = d.recipeId; app.session = d.session; app.targetKey = d.recipeKey;
    var m = mission(); if (m) app.job = m.job;
    app.craft = {
      missionId: d.missionId, recipeId: d.recipeId, st: d.st, target: d.target, lowerTiers: d.lowerTiers || [],
      state: d.state, history: d.history || [], pending: null, chosen: null, mmEndsAt: d.mmEndsAt || 0,
      budget: d.budget, startSsh: d.startSsh, startMm: d.startMm, profileName: d.profileName
    };
    app.setupOpen = false;
  }

  // Material Miracle is time based (45 s). The engine needs an estimate of how
  // many more steps it covers: remaining seconds / seconds per step.
  function syncMm(s) {
    var c = app.craft;
    if (!c.mmEndsAt) { s.mm = 0; return s; }
    var left = (c.mmEndsAt - Date.now()) / 1000;
    s.mm = left > 0 ? Math.max(1, Math.round(left / app.settings.mmSecPerStep)) : 0;
    if (left <= 0) c.mmEndsAt = 0;
    return s;
  }

  // ---- worker
  var worker = null, workerFailed = false, reqId = 0;
  function getWorker() {
    if (worker || workerFailed) return worker;
    try {
      var src = ENGINE_SRC + '\n;self.onmessage=function(e){var d=e.data;try{var r=CS.recommend(d.state,d.st,d.opt);' +
        'self.postMessage({id:d.id,ok:true,r:{action:r.action?r.action.id:null,reason:r.reason,estimate:r.estimate,ms:r.ms,timedOut:!!r.timedOut,fallback:r.fallback,' +
        'alternatives:(r.alternatives||[]).map(function(a){return{action:a.action.id,pTarget:a.pTarget,value:a.value,n:a.n};})}});}catch(err){self.postMessage({id:d.id,ok:false,error:String(err)});}};';
      var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onerror = function () { workerFailed = true; worker = null; };
    } catch (e) { workerFailed = true; worker = null; }
    return worker;
  }
  function think() {
    var c = app.craft;
    if (!c) return;
    if (c.state.done) { app.rec = null; app.thinking = false; renderCraft(); return; }
    var s = syncMm(CS.copyState(c.state));
    var used = { ssh: c.startSsh - s.sshCharges, mm: c.startMm - s.mmCharges };
    var opt = {
      target: c.target || 0, lowerTiers: c.lowerTiers, mode: app.mode, timeMs: app.settings.thinkMs,
      sshBudget: Math.max(0, c.budget.ssh - used.ssh), mmBudget: Math.max(0, c.budget.mm - used.mm), seed: 1 + c.history.length
    };
    if (opt.target <= 0) opt.target = 1; // "just complete": any quality counts
    var st = Object.assign({}, c.st, { condModel: app.settings.condModel, mmSteps: Math.max(1, Math.round(45 / app.settings.mmSecPerStep)) });
    var id = ++reqId;
    app.thinking = true;
    renderCraft();
    var w = getWorker();
    var done = function (res) {
      if (id !== reqId) return;
      app.thinking = false;
      if (!res.ok) { fallback('Search failed (' + res.error + '); showing the quick heuristic.'); return; }
      var r = res.r;
      app.rec = { action: r.action === null ? null : CS.ACTIONS[r.action], reason: r.reason, estimate: r.estimate, ms: r.ms, timedOut: r.timedOut,
        fallback: r.fallback, alternatives: (r.alternatives || []).map(function (a) { return { action: CS.ACTIONS[a.action], pTarget: a.pTarget, n: a.n }; }) };
      c.pending = app.rec.action; c.chosen = null;
      renderCraft();
    };
    if (w) {
      var timer = setTimeout(function () { fallback('Search timed out; showing the quick heuristic.'); }, Math.max(4000, app.settings.thinkMs * 6));
      w.onmessage = function (e) { if (e.data.id === id) { clearTimeout(timer); done(e.data); } };
      w.postMessage({ id: id, state: s, st: st, opt: opt });
    } else {
      // main-thread fallback: yield first so the page paints
      setTimeout(function () {
        try {
          var r = CS.recommend(s, st, Object.assign({}, opt, { timeMs: Math.min(opt.timeMs, 400) }));
          done({ ok: true, r: { action: r.action ? r.action.id : null, reason: r.reason, estimate: r.estimate, ms: r.ms, timedOut: r.timedOut, fallback: r.fallback,
            alternatives: (r.alternatives || []).map(function (a) { return { action: a.action.id, pTarget: a.pTarget, n: a.n }; }) } });
        } catch (err) { done({ ok: false, error: String(err) }); }
      }, 20);
    }
    function fallback(msg) {
      if (id !== reqId) return;
      reqId++; // drop the late worker answer so the shown advice cannot change under the player
      app.thinking = false;
      // timeMs 0: the heuristic choice, still filtered against certain failure
      var q = CS.recommend(s, st, Object.assign({}, opt, { timeMs: 0 }));
      var a = q.action;
      app.rec = { action: a, reason: q.reason, estimate: null, fallback: true, note: msg, alternatives: [] };
      c.pending = a; c.chosen = null;
      renderCraft();
    }
  }

  function report(cond, ok) {
    var c = app.craft;
    if (!c || c.state.done) return;
    var a = c.chosen || c.pending;
    if (!a) return;
    var s = syncMm(CS.copyState(c.state));
    var why = CS.whyNot(a, s, c.st);
    if (why) { toast(a.name + ' is not usable: ' + why); return; }
    var rate = CS.successRate(a, s);
    var success = rate >= 100 ? true : ok !== false;
    var n = CS.apply(a, s, c.st, success);
    if (!n.done) {
      if (a.step || a === A.CarefulObservation) n.cond = cond;
      else n.cond = s.cond;
    }
    if (a === A.MaterialMiracle) c.mmEndsAt = Date.now() + 43000; // 45 s, less input latency
    c.history.push({ state: c.state, action: a.id, ok: success, cond: n.cond, pg: n.lastPg || 0, qg: n.lastQg || 0, mmEndsAt: c.mmEndsAt });
    delete n.lastPg; delete n.lastQg; delete n.lastOk;
    c.state = n;
    c.chosen = null;
    if (n.done) finishCraft();
    save();
    think();
  }
  function finishCraft() {
    var c = app.craft;
    var ses = app.session;
    if (ses && !c.counted) {
      ses.sshLeft = c.state.sshCharges; ses.mmLeft = c.state.mmCharges;
      c.counted = true;
    }
  }
  function undo() {
    var c = app.craft;
    if (!c || !c.history.length) { toast('Nothing to undo.'); return; }
    var h = c.history.pop();
    if (c.counted) { c.counted = false; app.session.sshLeft = h.state.sshCharges; app.session.mmLeft = h.state.mmCharges; }
    c.state = h.state;
    var prev = c.history[c.history.length - 1];
    if (h.action !== null && CS.ACTIONS[h.action] === A.MaterialMiracle) c.mmEndsAt = 0;
    else if (prev && prev.mmEndsAt && prev.mmEndsAt > Date.now()) c.mmEndsAt = prev.mmEndsAt;
    save(); think();
  }
  function restart() {
    var c = app.craft;
    if (!c) return;
    if (c.counted) { app.session.sshLeft = c.startSsh; app.session.mmLeft = c.startMm; }
    var s = CS.initialState(c.st);
    s.sshCharges = c.startSsh; s.mmCharges = c.startMm;
    c.state = s; c.history = []; c.mmEndsAt = 0; c.counted = false;
    save(); think();
  }
  function nextCraft() {
    var c = app.craft;
    if (!c) return;
    finishCraft();
    app.session.craftsDone = Math.min(99, app.session.craftsDone + 1);
    startCraft();
  }

  // ---------------------------------------------------------------- craft view
  function renderCraft() {
    var el = $('#craft');
    var c = app.craft;
    if (!c) { el.classList.add('hidden'); $('#main').classList.remove('crafting'); return; }
    el.classList.remove('hidden'); $('#main').classList.toggle('crafting', !!app.setupOpen);
    var s = c.state, st = c.st;
    var r = DB.recipes[String(c.recipeId)];
    var h = '';
    // recommendation
    if (s.done) {
      var hit = s.done === 1 && s.quality >= c.target;
      h += '<div class="rec ' + (s.done === 1 ? 'done' : 'failed') + '"><div class="lbl">Craft finished</div><div class="act">' +
        (s.done === 1 ? (hit ? 'Target reached' : 'Completed') : 'Craft failed') + '</div><div class="why">Quality ' + fmt(s.quality) +
        (r.tiers ? ' · ' + tierText(s.quality, r) : '') + (c.target > 0 ? ' · target ' + fmt(c.target) : '') + '</div></div>';
      h += '<div class="controls"><button class="primary" data-act="nextCraft">Next craft (' + (app.session.craftsDone + 2) + ' of ' + app.session.craftsTotal + ')</button>' +
        '<button data-act="undo">Undo last step</button><button data-act="restart">Restart this craft</button></div>';
    } else {
      var a = c.chosen || (app.rec && app.rec.action);
      var rec = app.rec;
      h += '<div class="rec' + (app.thinking ? ' thinking' : '') + '" aria-live="polite"><div class="lbl">' + (c.chosen ? 'You chose' : (app.thinking ? 'Thinking…' : 'Recommended')) + '</div>' +
        '<div class="act" id="recAction">' + (a ? esc(a.name) : (app.thinking ? '…' : 'No usable action')) + '</div>';
      if (rec && !c.chosen && !app.thinking) {
        h += '<div class="why">' + esc(rec.reason || '') + '</div>';
        var est = rec.estimate;
        if (est && app.settings.showEstimate) {
          var pct = Math.round(est.pTarget * 100);
          h += '<div class="est">' + (est.pTarget >= 0.01 ? 'Simulated chance to reach the target: at least ~' + pct + '%' :
            'Target not reached in simulation with these stats; aiming for the most quality (typical result ~' + fmt(est.meanQuality) + (r.tiers ? ', ' + tierText(est.meanQuality, r) : '') + ')') +
            (est.pComplete < 0.995 ? ' · completes ~' + Math.round(est.pComplete * 100) + '%' : '') +
            ' · ' + fmt(est.n) + ' simulations · ' + Math.round(rec.ms) + ' ms</div>';
        }
        if (rec.fallback) h += '<div class="est">' + esc(rec.note || 'Quick heuristic used (search skipped).') + '</div>';
        if (rec.alternatives && rec.alternatives.length > 1 && app.settings.showEstimate) {
          h += '<div class="alts">Next best: ' + rec.alternatives.filter(function (x) { return x.action !== rec.action; }).slice(0, 2).map(function (x) { return esc(x.action.name) + ' ~' + Math.round(x.pTarget * 100) + '%'; }).join(' · ') + '</div>';
        }
      }
      h += '</div>';
      if (a && !app.thinking && CS.certainFailure(a, syncMm(CS.copyState(s)), st)) {
        h += '<div class="small bad" style="margin-top:6px">Warning: ' + esc(a.name) + ' leaves 0 durability without finishing, so the craft fails.</div>';
      }
      // report outcome
      if (a && !app.thinking) h += reportBlock(a, s, st);
      h += '<div class="row" style="margin-top:6px"><button class="small" data-act="other">I used a different action…</button>' +
        (c.chosen ? '<button class="small" data-act="backToRec">Back to recommendation</button>' : '') + '</div>';
    }
    // state
    h += '<h2 style="margin-top:14px"><span class="grow">Current state</span><button class="small" data-act="edit">Correct state</button></h2>';
    h += '<div class="bars">' + bar('Progress', s.progress, st.maxProgress, '') +
      bar('Quality', s.quality, st.maxQuality, 'q', (r.tiers || []).concat(c.target && (!r.tiers || r.tiers.indexOf(c.target) < 0) ? [c.target] : [])) +
      bar('Durability', s.durability, st.maxDurability, 'd') + bar('CP', s.cp, st.maxCp, 'cp') + '</div>';
    h += '<div class="statgrid"><div>Condition <span class="condtag c-' + s.cond + '">' + CS.COND_NAMES[s.cond] + '</span></div>' +
      '<div>Step ' + s.step + '</div><div>Target ' + (c.target > 0 ? fmt(c.target) : 'complete only') + '</div></div>';
    h += '<div class="buffs">' + buffList(s) + '</div>';
    h += '<div class="controls"><button data-act="undo"' + (c.history.length ? '' : ' disabled') + '>Undo <span class="muted small">(U)</span></button>' +
      '<button data-act="restart">Restart craft</button><button data-act="showSetup">Change setup</button></div>';
    // history
    h += '<details style="margin-top:10px"' + (app.histOpen ? ' open' : '') + ' data-act="hist"><summary>Action history (' + c.history.length + ')</summary><div class="hist"><ol>' +
      c.history.map(function (x) {
        var act = CS.ACTIONS[x.action];
        if (x.edit) return '<li class="muted">Manual correction</li>';
        return '<li>' + esc(act.name) + (x.ok ? '' : ' <span class="bad">failed</span>') + (x.pg ? ' +' + fmt(x.pg) + ' progress' : '') + (x.qg ? ' +' + fmt(x.qg) + ' quality' : '') +
          ' <span class="muted">→ ' + CS.COND_NAMES[x.cond] + '</span></li>';
      }).join('') + '</ol></div></details>';
    el.innerHTML = h;
  }
  function tierText(q, r) {
    var n = 0; r.tiers.forEach(function (t) { if (q >= t) n++; });
    return n ? 'tier ' + n + ' of 3' : 'below tier 1';
  }
  function bar(label, v, max, cls, ticks) {
    var pct = max ? Math.max(0, Math.min(100, v / max * 100)) : 0;
    var t = (ticks || []).filter(function (x) { return x > 0 && x <= max; }).map(function (x) { return '<div class="tick" style="left:' + (x / max * 100) + '%" title="' + fmt(x) + '"></div>'; }).join('');
    return '<div class="bar ' + cls + '" role="img" aria-label="' + label + ' ' + v + ' of ' + max + '"><div class="fill" style="width:' + pct + '%"></div>' + t +
      '<div class="txt"><span>' + label + '</span><span>' + fmt(v) + ' / ' + fmt(max) + '</span></div></div>';
  }
  function buffList(s) {
    var b = [];
    if (s.iq) b.push('Inner Quiet ' + s.iq);
    if (s.inno) b.push('Innovation ' + s.inno);
    if (s.vene) b.push('Veneration ' + s.vene);
    if (s.gs) b.push('Great Strides ' + s.gs);
    if (s.wn) b.push('Waste Not ' + s.wn);
    if (s.manip) b.push('Manipulation ' + s.manip);
    if (s.mume) b.push('Muscle Memory ' + s.mume);
    if (s.fa) b.push('Final Appraisal ' + s.fa);
    if (s.exped) b.push('Expedience');
    if (s.ssh) b.push('Stellar Steady Hand ' + s.ssh);
    if (s.hs) b.push('Heart and Soul');
    if (s.tp) b.push('Trained Perfection');
    var c = app.craft;
    if (c.mmEndsAt && c.mmEndsAt > Date.now()) b.push('Material Miracle ~' + Math.ceil((c.mmEndsAt - Date.now()) / 1000) + ' s');
    var out = b.map(function (x) { return '<span class="buff">' + x + '</span>'; }).join('');
    var charges = [];
    if (c.startSsh || s.sshCharges) charges.push('Steady Hand charges ' + s.sshCharges);
    if (c.startMm || s.mmCharges) charges.push('Material Miracle charges ' + s.mmCharges);
    var used = [];
    if (s.usedHS) used.push('Heart and Soul used');
    if (s.usedQI) used.push('Quick Innovation used');
    if (s.usedTP) used.push('Trained Perfection used');
    if (s.coCount) used.push('Careful Observation ' + s.coCount + '/3');
    return (out || '<span class="muted small">No active effects</span>') + charges.concat(used).map(function (x) { return '<span class="buff muted">' + x + '</span>'; }).join('');
  }
  function reportBlock(a, s, st) {
    var risky = CS.successRate(a, s) < 100;
    var after = CS.apply(a, syncMm(CS.copyState(s)), st, true);
    // Only transitions every model agrees on are presented as certain
    // (Excellent -> Poor, Good Omen -> Good, Robust -> Sturdy).
    var forced = CS.COND_MODELS.teamcraft.forced(s.cond);
    if (forced !== CS.COND_MODELS.craftimizer.forced(s.cond)) forced = -1;
    var opts = CS.possibleNextConditions(after, Object.assign({}, st, { condModel: 'teamcraft' }), a.step || a === A.CarefulObservation);
    if (app.craft.mmEndsAt || after.mm > 0) CS.MM_CONDS.forEach(function (x) { if (opts.indexOf(x) < 0) opts.push(x); });
    opts.sort(function (x, y) { return x - y; });
    var h = '<div class="report">';
    if (after.done === 1 && !risky) {
      h += '<div class="q">This completes the craft.</div><div class="conds"><button class="cond primary" data-act="cond" data-v="0" data-ok="1">Done <kbd>Enter</kbd></button></div>';
      return h + '</div>';
    }
    if (!a.step && a !== A.CarefulObservation) {
      h += '<div class="q">This action does not change the condition.</div><div class="conds"><button class="cond c-' + s.cond + ' likely" data-act="cond" data-v="' + s.cond + '" data-ok="1">Done <kbd>Enter</kbd></button></div>';
      return h + '</div>';
    }
    h += '<div class="q">' + (risky ? 'If it <b class="ok">succeeded</b>, tap the new condition:' : 'After using it in game, tap the new condition:') + '</div>';
    h += '<div class="conds">' + opts.map(function (x) {
      return '<button class="cond c-' + x + (x === forced ? ' likely' : '') + '" data-act="cond" data-v="' + x + '" data-ok="1">' + CS.COND_NAMES[x] + '<kbd>' + COND_KEYS[x].toUpperCase() + '</kbd></button>';
    }).join('') + '</div>';
    if (risky) {
      h += '<div class="q">If it <b class="bad">failed</b> (hold Shift with the key):</div><div class="conds">' + opts.map(function (x) {
        return '<button class="cond fail c-' + x + '" data-act="cond" data-v="' + x + '" data-ok="0">✗ ' + CS.COND_NAMES[x] + '</button>';
      }).join('') + '</div>';
    }
    if (forced >= 0) h += '<div class="small muted" style="margin-top:4px">' + CS.COND_NAMES[s.cond] + ' is always followed by ' + CS.COND_NAMES[forced] + ' (Enter).</div>';
    return h + '</div>';
  }

  // ---------------------------------------------------------------- dialogs
  function openDialog(html, onSubmit) {
    var d = $('#dlg');
    d.innerHTML = html;
    d.onclick = function (e) {
      var t = e.target.closest('[data-dlg]');
      if (!t) return;
      var v = t.getAttribute('data-dlg');
      if (v === 'close') d.close();
      else if (onSubmit) onSubmit(v, d);
    };
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function otherActionDialog() {
    var c = app.craft; var s = syncMm(CS.copyState(c.state));
    var html = '<h3>Which action did you use?</h3><div class="chips">' + CS.ACTIONS.map(function (a) {
      var why = CS.whyNot(a, s, c.st);
      return '<button class="chip" data-dlg="' + a.id + '"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>' + esc(a.name) + '</button>';
    }).join('') + '</div><div class="row" style="margin-top:12px"><button data-dlg="close">Cancel</button></div>';
    openDialog(html, function (v, d) {
      c.chosen = CS.ACTIONS[+v]; d.close(); renderCraft();
    });
  }
  function editDialog() {
    var c = app.craft; var s = c.state; var st = c.st;
    var f = function (label, k, v, max) { return '<label class="field">' + label + '<input type="number" data-k="' + k + '" value="' + v + '" min="0" max="' + max + '"></label>'; };
    var html = '<h3>Correct the tracked state</h3><div class="note">Match these to the game. Values are clamped to valid ranges. The correction can be undone.</div>' +
      '<div class="grid2">' + f('Progress', 'progress', s.progress, st.maxProgress) + f('Quality', 'quality', s.quality, st.maxQuality * 2) +
      f('Durability', 'durability', s.durability, st.maxDurability) + f('CP', 'cp', s.cp, st.maxCp) + f('Inner Quiet', 'iq', s.iq, 10) +
      '<label class="field">Condition<select data-k="cond">' + CS.COND_NAMES.map(function (n, i) { return '<option value="' + i + '"' + (i === s.cond ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      f('Innovation', 'inno', s.inno, 6) + f('Veneration', 'vene', s.vene, 6) + f('Great Strides', 'gs', s.gs, 5) + f('Waste Not', 'wn', s.wn, 10) +
      f('Manipulation', 'manip', s.manip, 10) + f('Muscle Memory', 'mume', s.mume, 7) + f('Final Appraisal', 'fa', s.fa, 7) + f('Steady Hand steps', 'ssh', s.ssh, 5) +
      f('Steady Hand charges', 'sshCharges', s.sshCharges, 9) + f('Material Miracle charges', 'mmCharges', s.mmCharges, 9) +
      f('Material Miracle seconds left', 'mmSec', c.mmEndsAt ? Math.max(0, Math.ceil((c.mmEndsAt - Date.now()) / 1000)) : 0, 45) +
      f('Careful Observation used', 'coCount', s.coCount, 3) + f('Step number', 'step', s.step, 200) + '</div>' +
      '<div class="row small" style="margin-top:8px">' + ['exped:Expedience active', 'hs:Heart and Soul active', 'tp:Trained Perfection active', 'usedHS:Heart and Soul used', 'usedQI:Quick Innovation used', 'usedTP:Trained Perfection used'].map(function (x) {
        var k = x.split(':')[0]; return '<label class="inline"><input type="checkbox" data-k="' + k + '"' + (s[k] ? ' checked' : '') + '> ' + x.split(':')[1] + '</label>';
      }).join('') + '<label class="inline">Last action combo <select data-k="combo"><option value="0"' + (s.combo === 0 ? ' selected' : '') + '>none</option><option value="1"' + (s.combo === 1 ? ' selected' : '') + '>Basic Touch</option><option value="2"' + (s.combo === 2 ? ' selected' : '') + '>Standard Touch (combo)</option><option value="3"' + (s.combo === 3 ? ' selected' : '') + '>Observe</option></select></label></div>' +
      '<div class="row" style="margin-top:12px"><button class="primary" data-dlg="apply">Apply</button><button data-dlg="close">Cancel</button></div>';
    openDialog(html, function (v, d) {
      if (v !== 'apply') return;
      var n = CS.copyState(s);
      d.querySelectorAll('[data-k]').forEach(function (inp) {
        var k = inp.getAttribute('data-k');
        var val = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : Math.floor(+inp.value || 0);
        var max = +inp.getAttribute('max'); if (!isNaN(max) && inp.type !== 'checkbox' && inp.tagName !== 'SELECT') val = Math.max(0, Math.min(max, val));
        if (k === 'mmSec') { c.mmEndsAt = val > 0 ? Date.now() + val * 1000 : 0; return; }
        n[k] = val;
      });
      n.done = n.progress >= st.maxProgress ? 1 : (n.durability <= 0 ? 2 : 0);
      if (n.wn > 0 && n.wn > 8) n.wn = Math.min(n.wn, 10);
      c.history.push({ state: c.state, action: null, ok: true, cond: n.cond, edit: true, mmEndsAt: c.mmEndsAt });
      c.state = n;
      d.close(); save(); think();
    });
  }
  function settingsDialog() {
    var s = app.settings;
    var html = '<h3>Settings</h3><div class="grid2">' +
      '<label class="field">Thinking time<select data-k="thinkMs">' + [200, 500, 1000, 2000].map(function (v) { return '<option value="' + v + '"' + (s.thinkMs === v ? ' selected' : '') + '>' + v + ' ms</option>'; }).join('') + '</select></label>' +
      '<label class="field">Condition rate model<select data-k="condModel"><option value="teamcraft"' + (s.condModel === 'teamcraft' ? ' selected' : '') + '>Teamcraft estimates</option><option value="craftimizer"' + (s.condModel === 'craftimizer' ? ' selected' : '') + '>Craftimizer estimates</option></select></label>' +
      '<label class="field">Seconds per step (Material Miracle)<input type="number" step="0.5" min="1.5" max="6" data-k="mmSecPerStep" value="' + s.mmSecPerStep + '"></label>' +
      '<label class="field">Theme<select data-k="theme"><option value="auto">Auto</option><option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>Light</option><option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>Dark</option></select></label></div>' +
      '<div class="row small" style="margin-top:8px"><label class="inline"><input type="checkbox" data-k="showEstimate"' + (s.showEstimate ? ' checked' : '') + '> Show simulated chances</label></div>' +
      '<div class="note">Condition probabilities are community estimates; two tools disagree. Success chances shown are simulations under the selected model, not game-confirmed odds.</div>' +
      '<h3 style="margin-top:12px">Profiles</h3><div class="row"><button data-dlg="export">Export profiles</button><button data-dlg="import">Import profiles</button>' +
      '<span class="small muted">' + (storageOk ? 'Saved in this browser.' : 'Browser storage is unavailable here; settings last until the page closes. Use Export to keep them.') + '</span></div>' +
      '<input type="file" accept="application/json,.json" class="hidden" id="importFile">' +
      '<div class="row" style="margin-top:12px"><button class="primary" data-dlg="apply">Save</button><button data-dlg="close">Close</button></div>';
    openDialog(html, function (v, d) {
      if (v === 'export') { exportProfiles(); return; }
      if (v === 'import') { var f = $('#importFile', d); f.onchange = function () { importProfiles(f.files[0]); d.close(); }; f.click(); return; }
      if (v !== 'apply') return;
      d.querySelectorAll('[data-k]').forEach(function (inp) {
        var k = inp.getAttribute('data-k');
        if (inp.type === 'checkbox') s[k] = inp.checked;
        else if (k === 'condModel' || k === 'theme') s[k] = inp.value;
        else s[k] = +inp.value;
      });
      s.mmSecPerStep = Math.max(1.5, Math.min(6, s.mmSecPerStep || 3));
      applyTheme(); save(); d.close(); renderAll(); if (app.craft) think();
    });
  }
  function exportProfiles() {
    var blob = new Blob([JSON.stringify({ app: 'cosmic-crafting-solver', version: 1, profiles: app.profiles, settings: app.settings }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cosmic-solver-profiles.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importProfiles(file) {
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.profiles)) throw new Error('no profiles');
        var n = 0;
        d.profiles.forEach(function (p) {
          if (typeof p.job !== 'number' || p.job < 0 || p.job > 7) return;
          var clean = { id: String(p.id || ('p' + Math.random().toString(36).slice(2))), name: String(p.name || 'Imported').slice(0, 40), job: p.job,
            level: clampInt(p.level, 10, 100, 100), craftsmanship: clampInt(p.craftsmanship, 1, 9999, 5000), control: clampInt(p.control, 1, 9999, 5000),
            cp: clampInt(p.cp, 1, 2000, 600), specialist: !!p.specialist, manipulation: p.manipulation !== false, cosmicTool: !!p.cosmicTool };
          var i = app.profiles.findIndex(function (x) { return x.id === clean.id; });
          if (i >= 0) app.profiles[i] = clean; else app.profiles.push(clean);
          n++;
        });
        save(); renderAll(); toast('Imported ' + n + ' profile(s).');
      } catch (e) { toast('Could not import: ' + e.message); }
    };
    rd.readAsText(file);
  }
  function clampInt(v, lo, hi, dflt) { v = Math.floor(+v); return isNaN(v) ? dflt : Math.max(lo, Math.min(hi, v)); }
  function helpDialog() {
    var html = '<h3>How to use</h3><ol class="small">' +
      '<li>Pick your class, enter your crafter stats (with food and medicine), and choose a mission and quality target.</li>' +
      '<li>Press <b>Start craft</b>. Do the recommended action in game.</li>' +
      '<li>Tap the condition the game now shows (or press its key). For risky actions, use the failed row (or Shift+key) if it failed.</li>' +
      '<li>If the numbers drift from the game, use <b>Correct state</b>. <b>Undo</b> reverts the last step.</li></ol>' +
      '<div class="kbdhelp small"><b>Keys:</b> ' + Object.keys(COND_KEYS).map(function (c) { return '<kbd>' + COND_KEYS[c].toUpperCase() + '</kbd> ' + CS.COND_NAMES[c]; }).join(' · ') +
      ' · <kbd>Enter</kbd> forced/only option · <kbd>Shift</kbd>+key failed · <kbd>U</kbd> undo · <kbd>A</kbd> other action</div>' +
      '<h3 style="margin-top:12px">What is and is not verified</h3><div class="small">' +
      'Recipe values, quality tiers, special-action charges and mission score thresholds come from the game data (patch ' + esc(DB.generated.datamining) + '). ' +
      'Action formulas match in-game-verified sequences. Not verified: exact condition probabilities (community estimates), how Material Miracle picks its conditions (assumed even), ' +
      'and the score a crafted item earns. Simulated chances are estimates under those assumptions and assume simple play after the next step, so they tend to be on the low side.</div>' +
      '<div class="small muted" style="margin-top:8px">Data: ' + esc(DB.generated.source) + ' · Build ' + esc(DB.generated.build) + '</div>' +
      '<div class="row" style="margin-top:12px"><button data-dlg="close">Close</button></div>';
    openDialog(html);
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || t.closest('dialog')) return;
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    switch (act) {
      case 'job': app.job = +v; app.missionId = null; app.recipeId = null; save(); renderSetup(); break;
      case 'rank': app.rankFilter = v; save(); renderSetup(); break;
      case 'expertOnly': app.expertOnly = !app.expertOnly; save(); renderSetup(); break;
      case 'mission': {
        app.missionId = +v; var m = mission();
        app.recipeId = m.recipes[m.recipes.length - 1]; app.targetKey = null; renderSetup();
        break;
      }
      case 'recipe': app.recipeId = +v; app.targetKey = null; renderSetup(); break;
      case 'target': app.targetKey = v; renderSetup(); break;
      case 'mode': app.mode = v; save(); renderSetup(); if (app.craft) think(); break;
      case 'start': startCraft(); break;
      case 'newProfile': { var p = defaultProfile(app.job); p.name = DB.jobs[app.job] + ' ' + (app.profiles.filter(function (x) { return x.job === app.job; }).length + 1); app.profiles.push(p); app.profileByJob[app.job] = p.id; save(); renderSetup(); break; }
      case 'renameProfile': { var cp = currentProfile(); var nm = prompt('Profile name', cp.name); if (nm) { cp.name = nm.slice(0, 40); save(); renderSetup(); } break; }
      case 'deleteProfile': { var dp = currentProfile(); if (confirm('Delete profile ' + dp.name + '?')) { app.profiles = app.profiles.filter(function (x) { return x.id !== dp.id; }); delete app.profileByJob[app.job]; save(); renderSetup(); } break; }
      case 'toggleSetup': app.setupOpen = !app.setupOpen; renderAll(); break;
      case 'showSetup': app.setupOpen = true; renderAll(); window.scrollTo(0, 0); break;
      case 'cond': report(+v, t.getAttribute('data-ok') === '1'); break;
      case 'other': otherActionDialog(); break;
      case 'backToRec': app.craft.chosen = null; renderCraft(); break;
      case 'undo': undo(); break;
      case 'restart': restart(); break;
      case 'nextCraft': nextCraft(); break;
      case 'edit': editDialog(); break;
    }
  });
  document.addEventListener('toggle', function (e) { if (e.target.matches && e.target.matches('details[data-act=hist]')) app.histOpen = e.target.open; }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; var act = t.getAttribute && t.getAttribute('data-act');
    if (!act) return;
    var p = currentProfile();
    if (act === 'profile') { app.profileByJob[app.job] = t.value; save(); renderSetup(); }
    else if (act === 'stat') {
      var k = t.getAttribute('data-k'); var lim = { level: [10, 100], craftsmanship: [1, 9999], control: [1, 9999], cp: [1, 2000] }[k];
      p[k] = clampInt(t.value, lim[0], lim[1], p[k]); save(); renderSetup();
    } else if (act === 'flag') { p[t.getAttribute('data-k')] = t.checked; save(); }
    else if (act === 'customTarget') { app.customTarget = t.value; }
    else if (act === 'ses') { var sk = t.getAttribute('data-k'); app.session[sk] = clampInt(t.value, sk === 'craftsTotal' ? 1 : 0, 99, app.session[sk]); renderSetup(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-act') === 'search') {
      app.search = t.value; var pos = t.selectionStart; renderSetup();
      var n = $('[data-act=search]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
    }
  });
  document.addEventListener('keydown', function (e) {
    if ($('#dlg').open) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.ctrlKey || e.metaKey || e.altKey) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } return; }
    var c = app.craft;
    if (!c || app.thinking) return;
    var k = e.key.toLowerCase();
    if (k === 'u') { undo(); return; }
    if (k === 'a') { otherActionDialog(); return; }
    if (c.state.done) { if (k === 'enter') nextCraft(); return; }
    var btns = document.querySelectorAll('#craft [data-act=cond]');
    if (k === 'enter') {
      var likely = $('#craft .cond.likely') || (btns.length === 1 ? btns[0] : null);
      if (likely) { e.preventDefault(); likely.click(); }
      return;
    }
    if (KEY_CONDS.hasOwnProperty(k)) {
      var cond = KEY_CONDS[k];
      var sel = '#craft [data-act=cond][data-v="' + cond + '"][data-ok="' + (e.shiftKey ? '0' : '1') + '"]';
      var b = $(sel);
      if (b) { e.preventDefault(); b.click(); }
      else if ($('#craft [data-act=cond][data-v="' + cond + '"]')) toast('This action cannot fail; press the key without Shift.');
      else toast(CS.COND_NAMES[cond] + ' cannot occur here.');
    }
  });
  $('#btnSettings').onclick = settingsDialog;
  $('#btnHelp').onclick = helpDialog;
  setInterval(function () {
    // refresh the Material Miracle countdown
    if (app.craft && app.craft.mmEndsAt) {
      if (app.craft.mmEndsAt <= Date.now()) { app.craft.mmEndsAt = 0; save(); if (!app.thinking) think(); }
      else if (!app.thinking) { var el = document.querySelector('#craft .buffs'); if (el) el.innerHTML = buffList(app.craft.state); }
    }
  }, 1000);

  function renderAll() { renderSetup(); renderCraft(); }
  if (app.pendingRestore) { try { restoreCraft(app.pendingRestore); } catch (e) { app.craft = null; } }
  renderAll();
  if (app.craft) think();
  // test hook (no effect on normal use)
  window.__cosmicSolver = { app: app, report: report, undo: undo, restart: restart, think: think };
})();
