#!/usr/bin/env node
'use strict';
// Read the links between entries that the FFXIV Completionist desktop app (1.0.5) ships in its data files, and
// translate them to tracker entries: data/desktop-links.json. Input: the app's "resources/resources" folder (from
// the installer: app-64.7z). The app's link fields, as its code applies them:
//   cPrev     ticking the entry ticks these (earlier steps); with cPrevAny only "one of" them, so nothing is implied
//   cNext     unticking the entry unticks these (so each of them implies the entry)
//   cSiblings the entry and these always share one state (ticking either ticks the other)
//   cCombo    these entries are re-checked when the entry changes (each is done when all of its cPrev are done)
//   cPrevAt / cSiblingsAt / cComboAt   the same, at numeric thresholds (levels, floors)
//   cExclude / cExclusive  either-or choices (handled in the tracker by starting city and Grand Company)
// Usage: node tools/desktop-links.js <resources dir> [<app.asar extracted>/assets/i18n/en.json]
const fs = require('fs'), path = require('path');
const T = path.join(__dirname, '..');
for (const f of ['model', 'importer']) require(path.join(T, 'src', 'core', f + '.js'));
const ET = globalThis.ET;
const ROOT = process.argv[2];
// names: name_en, or the app's translation codes ("@SOCIETY.AMALJAA - REPUTATION.NEUTRAL") read from its English
// file when it sits next to the data (resources/app.asar extracted to <...>/asarx, or passed as the second argument)
const I18N_FILE = process.argv[3];
const I18N = I18N_FILE && fs.existsSync(I18N_FILE) ? JSON.parse(fs.readFileSync(I18N_FILE, 'utf8')).DATA || {} : {};
const tr = (s) => String(s || '').replace(/@([A-Z_]+)\.([A-Z0-9_]+)/g, (m, a, b) => (I18N[a] && typeof I18N[a][b] === 'string' ? I18N[a][b] : m));
const nameOf = (t) => tr(t.name_en || t.name || '');
const idx = ET.indexData(JSON.parse(fs.readFileSync(path.join(T, 'data', 'tracker-data.json'), 'utf8')));
const resolveKey = ET.desktopKeyResolver(idx, JSON.parse(fs.readFileSync(path.join(T, 'data', 'desktop-map.json'), 'utf8')));
const PREFIX = { a: 'character.achievement', ap: 'character.adventure-plate', b: 'character.companion.barding', cj: 'character.character.classes--jobs', cl: 'logs.crafting-log', e: 'social.emotes', fa: 'character.fashion-accessories', mi: 'character.minion-guide', mo: 'character.mount-guide', d: 'duty.duty-raid-finder', h: 'duty.the-hunt', f: 'duty.fate', o: 'logs.orchestrion-list', q: 'duty.quest', t: 'character.character.title', tt: 'character.gold-saucer.triple-triad-card-list' };
const FIELDS = ['cPrev', 'cPrevAny', 'cNext', 'cSiblings', 'cCombo', 'cExclude', 'cExclusive', 'cPrevAt', 'cSiblingsAt', 'cComboAt'];

// the app's tree: groups keyed by their "key", tasks keyed by id (the number after "x"); group link fields are
// inherited by the group's tasks
const tasks = new Map(); // full key "duty.quest.main-scenario.<file>.<id>" -> task
const byPrefix = new Map(Object.keys(PREFIX).map((p) => [p, new Map()]));
function load(dir, parentKey, inherited) {
  const idxFile = path.join(dir, '_index.json');
  const g = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
  const myKey = parentKey === null ? '' : (parentKey ? parentKey + '.' : '') + (g.key || path.basename(dir));
  const inh = Object.assign({}, inherited); for (const f of FIELDS) if (g[f] !== undefined) inh[f] = g[f];
  addTasks(g, myKey, inh);
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) load(path.join(dir, ent.name), myKey, inh);
    else if (ent.name.endsWith('.json') && ent.name !== '_index.json' && parentKey !== null) {
      const fg = JSON.parse(fs.readFileSync(path.join(dir, ent.name), 'utf8'));
      const k = myKey + '.' + (fg.key || ent.name.replace(/\.json$/, ''));
      const inh2 = Object.assign({}, inh); for (const f of FIELDS) if (fg[f] !== undefined) inh2[f] = fg[f];
      addTasks(fg, k, inh2);
    }
  }
}
function addTasks(g, groupKey, inh) {
  for (const [tk, t] of Object.entries(g.tasks || {})) {
    if (t.hidden) continue;
    const id = parseInt(tk.slice(1), 10);
    const full = groupKey + '.' + id;
    const task = { id, group: groupKey, full, name: nameOf(t), raw: t };
    for (const f of FIELDS) {
      const own = t[f], par = inh[f];
      if (own === undefined && par === undefined) continue;
      if (f.endsWith('At')) task[f] = Object.assign({}, par || {}, own || {});
      else task[f] = [].concat(par === undefined ? [] : par, own === undefined ? [] : own);
    }
    tasks.set(full, task);
    for (const [p, base] of Object.entries(PREFIX)) if (full.startsWith(base + '.')) { byPrefix.get(p).set(id, task); break; }
  }
}
for (const top of fs.readdirSync(ROOT, { withFileTypes: true })) if (top.isDirectory()) load(path.join(ROOT, top.name), '', {});

const stats = { tasks: tasks.size, refs: 0, broken: [], skippedRange: 0 };
function ref(task, r) {
  stats.refs++;
  if (typeof r === 'number' || /^\d+$/.test(String(r))) return tasks.get(task.group + '.' + r) || (stats.broken.push([task.full, r]), null);
  const s = String(r);
  if (/\.all$/.test(s) || /\.\d+-\d+$/.test(s)) { stats.skippedRange++; return null; }
  const parts = s.split('.');
  if (parts.length === 2 && byPrefix.has(parts[0])) return byPrefix.get(parts[0]).get(parseInt(parts[1], 10)) || (stats.broken.push([task.full, s]), null);
  return tasks.get(s) || (stats.broken.push([task.full, s]), null);
}
function trackerKeys(task) {
  const p = task.group.split('.').join('/');
  const k = resolveKey(p, task.id);
  return k ? [].concat(k) : [];
}
const out = { imp: [], all: [], unmapped: 0, perField: {} };
const bump = (f) => { out.perField[f] = (out.perField[f] || 0) + 1; };
for (const t of tasks.values()) {
  const me = trackerKeys(t);
  const each = (list, fn) => (list || []).forEach((r) => { const x = ref(t, r); if (x) fn(x); });
  const link = (fromTask, toTask, field) => {
    const a = fromTask === t ? me : trackerKeys(fromTask), b = toTask === t ? me : trackerKeys(toTask);
    if (!a.length || !b.length) { out.unmapped++; return; }
    for (const x of a) for (const y of b) if (x !== y) { out.imp.push([x, y, field, fromTask.name || '', toTask.name || '', fromTask.group, toTask.group]); bump(field); }
  };
  if (t.cPrev && !(t.cPrevAny && t.cPrevAny.length && t.cPrevAny.some(Boolean))) each(t.cPrev, (p) => link(t, p, 'cPrev'));
  each(t.cNext, (n) => link(n, t, 'cNext'));
  each(t.cSiblings, (s) => { link(t, s, 'cSiblings'); link(s, t, 'cSiblings'); });
  each(t.cCombo, (c) => {
    if (!c.cPrev || (c.cPrevAny && c.cPrevAny.some(Boolean))) return;
    const target = trackerKeys(c), members = [];
    (c.cPrev || []).forEach((r) => { const x = ref(c, r); if (x) members.push(...trackerKeys(x)); });
    const mtasks = (c.cPrev || []).map((r) => ref(c, r)).filter(Boolean);
    if (target.length === 1 && members.length === c.cPrev.length) { out.all.push([target[0], members, 'cCombo', c.name || '', mtasks.map((m) => m.name || '')]); bump('cCombo'); }
  });
  for (const f of ['cPrevAt', 'cSiblingsAt', 'cComboAt', 'cExclude', 'cExclusive']) if (t[f]) bump(f + ' (not translated)');
}
const seen = new Set();
out.imp = out.imp.filter(([a, b]) => { const k = a + '>' + b; if (seen.has(k)) return false; seen.add(k); return true; });
const sAll = new Set(); out.all = out.all.filter(([t, m]) => { const k = t + '<' + m.slice().sort().join(','); if (sAll.has(k)) return false; sAll.add(k); return true; });
fs.writeFileSync(path.join(T, 'data', 'desktop-links.json'), JSON.stringify({ source: 'FFXIV Completionist desktop app 1.0.5 data files', imp: out.imp, all: out.all, broken: stats.broken }));
out.stats = { broken: stats.broken };
console.log(JSON.stringify({ tasks: stats.tasks, refs: stats.refs, broken: stats.broken.length, brokenExamples: stats.broken.slice(0, 8), rangeRefs: stats.skippedRange, links: out.imp.length, combos: out.all.length, unmapped: out.unmapped, perField: out.perField }, null, 1));
