#!/usr/bin/env node
'use strict';
// Adopt the FFXIV Completionist desktop app's own links (data/desktop-links.json, from tools/desktop-links.js) that
// the game-data links (data/links.json, from tools/links.py) do not already give, after checks that remove its bugs:
//   1. both ends must be the same entry by name (its data is from patch 7.38, so its position-based lists no longer
//      line up with the 7.45 lists everywhere; allied society ranks must also be in the same society)
//   2. no link between the starting cities' or Grand Companies' own entries of different cities or companies
//   3. relic links stay within one job
//   4. no link the game's own quest order contradicts (the desktop data has some quest links backwards)
//   5. "ticking unticks" cascades are never adopted: links only add ticks
// Adopted links get kind "x" (from the desktop app). Writes data/links.json in place and prints a report.
// Usage: node tools/merge-desktop-links.js      (run after tools/links.py)
const fs = require('fs'), path = require('path');
const T = path.join(__dirname, '..');
for (const f of ['model', 'links']) require(path.join(T, 'src', 'core', f + '.js'));
const ET = globalThis.ET;
const data = JSON.parse(fs.readFileSync(path.join(T, 'data', 'tracker-data.json'), 'utf8'));
const idx = ET.indexData(data);
const LP = path.join(T, 'data', 'links.json');
const L = JSON.parse(fs.readFileSync(LP, 'utf8'));
L.imp = L.imp.filter((x) => x[2] !== 'x' && !x[3]); L.all = L.all.filter((x) => x[2] !== 'x'); // re-runnable (run after tools/links.py)
const X = ET.indexLinks(idx, L);
const D = JSON.parse(fs.readFileSync(path.join(T, 'data', 'desktop-links.json'), 'utf8'));
const ORDER = new Map(); for (const s of data.sections) for (const g of s.g) for (const e of g.e) ORDER.set(s.id + ':' + e.i, ORDER.size);

const norm = (s) => String(s || '').toLowerCase().replace(/’/g, "'").replace(/^quest:\s*/, '').replace(/[^a-z0-9]+/g, '');
function lev(a, b) { // edit distance, for one-letter typos between the two apps' quest names
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const lastSeg = (g) => norm(String(g || '').split('.').pop());
function sameEntry(key, dname, dgroup) {
  const h = idx.byKey.get(key);
  if (!h) return false;
  // unnamed rows in the desktop app (rank ladders): the same society or zone is the check
  if (!dname) {
    if (h.s.id === 'societyranks') { const g = norm(h.g.t), last = lastSeg(dgroup); return !!g && !!last && (last.includes(g) || g.includes(last) || last.includes(g.replace(/s$/, ''))); }
    if (h.s.id === 'sharedfate') { const last = lastSeg(dgroup); return !!last && norm(h.e.n).endsWith(last); }
    return false;
  }
  const tn = norm(h.e.n), dn = norm(dname).replace(/^rank(?=\d)/, '');
  // allied society ranks are named "<society> - <rank>" in the desktop app
  if (h.s.id === 'societyranks') { const g = norm(h.g.t).replace(/s$/, ''); return dn.endsWith(tn) && dn.startsWith(g.slice(0, 4)); }
  if (tn === dn || h.e.n.split('&').some((p) => norm(p) === dn) || String(dname).split('&').some((p) => norm(p) === tn)) return true;
  return h.s.id.startsWith('quests-') && tn.length > 6 && lev(tn, dn) <= 2;
}
const ctx = [['cnj', 2], ['mrd', 1], ['gla', 3]];
const cache = new Map();
function closure(a) {
  if (cache.has(a)) return cache.get(a);
  const s = new Set();
  for (const [cls, gc] of ctx) { const st = ET.newState(['A']); ET.setStart(st, 'c1', cls, gc); st.ticks.c1[a] = 1; for (const k of ET.applyLinks(X, idx, st, 'c1', [a], { gold: true })) s.add(k); }
  cache.set(a, s); return s;
}
const job = (key) => { const h = idx.byKey.get(key); return h && /^relic/.test(h.s.id) ? String(h.e.d || '').split(' · ')[0] : null; };
const rep = { considered: D.imp.length, covered: 0, adopted: 0, rejected: {}, adoptedBy: {}, examples: {} };
const reject = (why, a, b) => { rep.rejected[why] = (rep.rejected[why] || 0) + 1; (rep.examples[why] = rep.examples[why] || []).length < 4 && rep.examples[why].push(idx.byKey.get(a).e.n + ' -> ' + idx.byKey.get(b).e.n); };
const added = [];
for (const [a, b, field, na, nb, ga, gb] of D.imp) {
  if (!idx.byKey.has(a) || !idx.byKey.has(b)) continue;
  if (closure(a).has(b)) { rep.covered++; continue; }
  if (!sameEntry(a, na, ga) || !sameEntry(b, nb, gb)) { reject('not the same entry any more (desktop data from patch 7.38)', a, b); continue; }
  const ea = idx.byKey.get(a).e, eb = idx.byKey.get(b).e;
  if ((ea.city && eb.city && ea.city !== eb.city) || (ea.gc && eb.gc && ea.gc !== eb.gc)) { reject('crosses starting cities or Grand Companies', a, b); continue; }
  if (job(a) && job(b) && job(a) !== job(b)) { reject('relic link across jobs (desktop data error)', a, b); continue; }
  const qa = a.startsWith('quests-'), qb = b.startsWith('quests-');
  if (qa && qb && closure(b).has(a)) { reject('backwards against the game\'s quest order (desktop data error)', a, b); continue; }
  added.push([a, b]);
  const cat = a.split(':')[0].replace(/^(ach|quests|duty|craft|gather)-.*/, '$1') + ' -> ' + b.split(':')[0].replace(/^(ach|quests|duty|craft|gather)-.*/, '$1');
  rep.adoptedBy[cat] = (rep.adoptedBy[cat] || 0) + 1;
}
const have = new Set(L.imp.map(([a, b]) => a + '>' + b));
// a link to one starting city's (or Grand Company's) own entry from an entry every character can have applies only to
// characters of that city (or company): the same "qc:"/"qg:" kinds the game-data links use
const CITY_LETTER = { lim: 'l', gri: 'g', uld: 'u' };
for (const [a, b] of added) {
  const k = ORDER.get(a) + '>' + ORDER.get(b);
  if (have.has(k)) continue;
  have.add(k);
  const ea = idx.byKey.get(a).e, eb = idx.byKey.get(b).e;
  const kind = eb.city && !ea.city ? 'qc:' + CITY_LETTER[eb.city] : eb.gc && !ea.gc ? 'qg:' + eb.gc : 'x';
  L.imp.push([ORDER.get(a), ORDER.get(b), kind]); rep.adopted++;
  if (kind !== 'x') rep.cityOrCompanyOnly = (rep.cityOrCompanyOnly || 0) + 1;
}
// "complete this set" rules (cCombo): the target once all members are done, when names still match
let combos = 0;
for (const [t, m, , tn, mn] of D.all) {
  if (!idx.byKey.has(t) || m.some((k) => !idx.byKey.has(k))) continue;
  if (!sameEntry(t, tn) || m.some((k, i) => !sameEntry(k, mn[i]))) continue;
  const st = ET.newState(['A']); m.forEach((k) => { st.ticks.c1[k] = 1; });
  if (ET.applyLinks(X, idx, st, 'c1', m, { gold: true }).includes(t)) continue;
  L.all.push([ORDER.get(t), m.map((k) => ORDER.get(k)), 'x']); combos++;
}
rep.combosAdopted = combos;
rep.brokenInDesktopData = (D.broken || []).length;
fs.writeFileSync(LP, JSON.stringify(L));
console.log(JSON.stringify(rep, null, 1));
