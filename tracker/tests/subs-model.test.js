'use strict';
// The permanent randomized model test of the Submersibles section (docs/submersibles-integrity-spec-2.md, section 7).
// Two models, each over seeded random sequences:
//   tabs model    (MT0-MT9): stale tabs of one device writing through the real CC.writeSection, CC.foldSection and ET.saveMerge;
//   devices model (MD1-MD8): two or three devices syncing through one cloud copy with the real ET.threeWay and ET.applyMerge.
// Each invariant is one test(). A failure prints the invariant, the seed, the sequence number and the shrunk steps.
// The invariants state their rules themselves; the only shared oracle is FLEET.foldFcs (the fold exception).
// Interpretations the model makes (recorded so a reader knows them):
//   (1) MD4 counts a question with no answer as this device's answer;  (2) MT6 is checked only for steps that move something;
//   (3) a no-change edit (what the tab sends equals its base) is skipped in MT6 and MT7;
//   (4) swap and moveFree are operations no screen produces (they stand for a save changed outside the screens);
//   (5) MD4's start holds a seeded twin (two submarines in one slot), as older saves do.
// Run: node tests/subs-model.test.js     Override: SUBS_MODEL_N (sequences per seed), SUBS_MODEL_SEED (one seed).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
for (const f of ['save', 'model', 'codec', 'merge', 'storage']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'fleet.js'));
const CC = globalThis.CC, ET = globalThis.ET, FLEET = globalThis.FLEET;

// What happens when one submarine is changed in two tabs: the later save wins (owner decision 2026-11-19). 'refuse' is
// the owner's decision of 2026-11-20 and is switched on with its store rule (work item W6).
const SAME_SUB = 'refuse';
const SEEDS = process.env.SUBS_MODEL_SEED ? [Number(process.env.SUBS_MODEL_SEED)] : [1, 2, 3];
const PER_SEED = Number(process.env.SUBS_MODEL_N || 1000);
const TAB_STEPS = 12, DEVICE_STEPS = 10;

const clone = (x) => JSON.parse(JSON.stringify(x));
const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v));
const sorted = (o) => Object.keys(o || {}).sort();
const CHARS = ['c1', 'c2'];

// ---------------------------------------------------------------------------------------------------------------- random
function makeRnd(seed) { let s = seed >>> 0; return (n) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s >>> 4) % n; }; }

// the start section of a sequence: one to three companies, submarines, logged voyages; sometimes two submarines in one slot
// and an orphan submarine (older saves hold both), seeded straight into the store
function genInit(rnd) {
  const fcs = {}, subs = {}, trips = {}; let su = 0, tu = 0, first = null;
  for (let i = 0, nf = 1 + rnd(3); i < nf; i++) {
    const id = 'f' + (i + 1), solid = rnd(2) === 1;
    fcs[id] = solid ? { name: 'F' + i, charId: CHARS[rnd(2)], order: rnd(3), world: 'W', unlockedSlots: 1 + rnd(4), discovered: [1, 2, 3] }
      : { name: 'F' + i, charId: CHARS[rnd(2)], order: rnd(3), unlockedSlots: 1, discovered: [1, 2] };
    for (let s = 1, ns = rnd(3); s <= ns; s++) {
      const sid = 's' + (++su); first = first || sid;
      subs[sid] = { fcId: id, slot: s, name: 'S' + su, rank: 1 + rnd(50), voyage: null };
      if (rnd(3) !== 0 || sid === first) trips['t' + (++tu)] = { s: sid, t: 2000 + tu, r: [1, 2], items: [], newSectors: [] };
    }
  }
  const extra = rnd(6);
  if (extra === 0 && first) subs['sd'] = { fcId: subs[first].fcId, slot: subs[first].slot, name: 'Twin', rank: 7, voyage: null };
  if (extra === 1) subs['so'] = { fcId: 'fz', slot: 1, name: 'Orphan', rank: 9, voyage: null };
  return { fcs, subs, trips, settings: {} };
}

// ---------------------------------------------------------------------------------------------------------------- edits
// One edit of a section, as a page would make it (shared by both models). n: four numbers; tag: names the new records.
// Returns what the edit did, or null when its precondition fails (a no-op).
function applyOp(s, kind, n, tag) {
  const fcIds = sorted(s.fcs), subIds = sorted(s.subs), tripIds = sorted(s.trips);
  const eff = { kind, subs: [], removedSubs: [], trips: [], removedTrips: [], fcs: {}, removedFcs: [], tick: null, rearr: false, pref: false, desc: '' };
  const fcOf = () => fcIds[n[1] % fcIds.length], subOf = () => subIds[n[1] % subIds.length];
  const free = (fcId) => { const used = new Set(subIds.filter((x) => s.subs[x].fcId === fcId).map((x) => s.subs[x].slot)); return [1, 2, 3, 4].filter((x) => !used.has(x)); };
  const needFc = fcIds.length > 0, needSub = subIds.length > 0;
  switch (kind) {
    case 'addFc': { const id = 'fn' + tag; s.fcs[id] = { name: '', charId: CHARS[n[1] % 2], order: n[2] % 3, unlockedSlots: 1, discovered: [1, 2] }; eff.fcs[id] = ['name', 'charId', 'order']; eff.desc = 'addFc ' + id + ' ' + s.fcs[id].charId; return eff; }
    case 'renameFc': { if (!needFc) return null; const id = fcOf(); s.fcs[id].name = 'N' + (n[2] % 100); eff.fcs[id] = ['name']; eff.desc = 'renameFc ' + id + ' ' + s.fcs[id].name; return eff; }
    case 'removeFc': {
      if (!needFc) return null; const id = fcOf(); delete s.fcs[id]; eff.removedFcs.push(id);
      for (const x of subIds) if (s.subs[x].fcId === id) { delete s.subs[x]; eff.removedSubs.push(x); }
      eff.desc = 'removeFc ' + id; return eff;
    }
    case 'slots': { if (!needFc) return null; const id = fcOf(); s.fcs[id].unlockedSlots = 1 + (n[2] % 4); eff.fcs[id] = ['unlockedSlots']; eff.desc = 'slots ' + id + ' ' + s.fcs[id].unlockedSlots; return eff; }
    case 'char': { if (!needFc) return null; const id = fcOf(); s.fcs[id].charId = CHARS[n[2] % 2]; eff.fcs[id] = ['charId']; eff.desc = 'char ' + id + ' ' + s.fcs[id].charId; return eff; }
    case 'tick': {
      if (!needFc) return null; const id = fcOf(), x = [3, 4, 5, 6][n[2] % 4], d = s.fcs[id].discovered || [];
      const on = !d.includes(x); s.fcs[id].discovered = on ? d.concat(x).sort((a, b) => a - b) : d.filter((y) => y !== x);
      eff.tick = { fc: id, x, on }; eff.desc = (on ? 'tick ' : 'untick ') + id + ' ' + x; return eff;
    }
    case 'addSub': {
      if (!needFc) return null; const id = fcOf(), fr = free(id); if (!fr.length) return null;
      const sid = 'sn' + tag; s.subs[sid] = { fcId: id, slot: fr[n[2] % fr.length], name: 'New', rank: 1, voyage: null };
      eff.subs.push(sid); eff.rearr = true; eff.desc = 'addSub ' + sid + ' ' + id + ' slot ' + s.subs[sid].slot; return eff;
    }
    case 'editSub': { if (!needSub) return null; const x = subOf(); s.subs[x].name = 'R' + (n[2] % 100); s.subs[x].rank = 1 + (n[3] % 100); eff.subs.push(x); eff.desc = 'editSub ' + x; return eff; }
    case 'send': { if (!needSub) return null; const x = subOf(); s.subs[x].voyage = { sentAt: 1000, route: [1, 2], returnAt: 2000 + (n[2] % 100) }; eff.subs.push(x); eff.desc = 'send ' + x; return eff; }
    case 'return': {
      if (!needSub) return null; const x = subOf(), tid = 'tn' + tag;
      s.trips[tid] = { s: x, t: 2000, r: [1, 2], items: [], newSectors: [] }; s.subs[x].voyage = null;
      eff.subs.push(x); eff.trips.push(tid); eff.desc = 'return ' + x + ' ' + tid; return eff;
    }
    case 'removeSub': { if (!needSub) return null; const x = subOf(); delete s.subs[x]; eff.removedSubs.push(x); eff.rearr = true; eff.desc = 'removeSub ' + x; return eff; }
    case 'keepOne': {
      const by = {}; for (const x of subIds) (by[s.subs[x].fcId + '|' + s.subs[x].slot] = by[s.subs[x].fcId + '|' + s.subs[x].slot] || []).push(x);
      const keys = Object.keys(by).sort().filter((k) => by[k].length > 1); if (!keys.length) return null;
      const ids = by[keys[n[1] % keys.length]], keep = ids[n[2] % ids.length];
      for (const x of ids) if (x !== keep) { delete s.subs[x]; eff.removedSubs.push(x); }
      eff.rearr = true; eff.desc = 'keepOne ' + keep + ' of ' + ids.join(','); return eff;
    }
    case 'moveFree': {
      if (!needSub) return null; const x = subOf(), fr = free(s.subs[x].fcId); if (!fr.length) return null;
      s.subs[x].slot = fr[n[2] % fr.length]; eff.subs.push(x); eff.rearr = true; eff.desc = 'moveFree ' + x + ' slot ' + s.subs[x].slot; return eff;
    }
    case 'swap': {
      if (!needSub) return null; const a = subOf();
      const others = subIds.filter((y) => y !== a && s.subs[y].fcId === s.subs[a].fcId && s.subs[y].slot !== s.subs[a].slot); if (!others.length) return null;
      const b = others[n[2] % others.length], t = s.subs[a].slot; s.subs[a].slot = s.subs[b].slot; s.subs[b].slot = t;
      eff.subs.push(a, b); eff.rearr = true; eff.desc = 'swap ' + a + ' ' + b; return eff;
    }
    case 'editTrip': { if (!tripIds.length) return null; const t = tripIds[n[1] % tripIds.length]; s.trips[t].grade = ['C', 'B', 'A', 'S'][n[2] % 4]; eff.trips.push(t); eff.desc = 'editTrip ' + t + ' ' + s.trips[t].grade; return eff; }
    case 'removeTrip': { if (!tripIds.length) return null; const t = tripIds[n[1] % tripIds.length]; delete s.trips[t]; eff.removedTrips.push(t); eff.desc = 'removeTrip ' + t; return eff; }
    case 'pref': { s.settings = { prefs: { sort: ['fc', 'time'][n[2] % 2] } }; eff.pref = true; eff.desc = 'pref ' + s.settings.prefs.sort; return eff; }
    default: return null;
  }
}
const OPS = ['addFc', 'renameFc', 'removeFc', 'slots', 'char', 'tick', 'addSub', 'editSub', 'send', 'return', 'removeSub', 'keepOne', 'moveFree', 'swap', 'editTrip', 'removeTrip', 'pref'];
const TAB_KINDS = OPS.concat(['addSub', 'removeFc', 'keepOne', 'send', 'removeSub', 'reload', 'reload', 'fold', 'trackerSave']);
const DEV_KINDS = OPS.concat(['addSub', 'removeFc', 'swap', 'moveFree', 'editSub', 'fold', 'sync', 'sync', 'sync', 'sync', 'sync', 'sync', 'sync']);

function genSequence(seed, i, model) {
  const rnd = makeRnd(seed * 100003 + i * 7919 + (model === 'dev' ? 17 : 0));
  const init = genInit(rnd), nd = model === 'dev' ? 2 + rnd(2) : 3, len = model === 'dev' ? DEVICE_STEPS : TAB_STEPS, steps = [];
  for (let k = 0; k < len; k++) {
    const list = model === 'dev' ? DEV_KINDS : TAB_KINDS;
    steps.push({ i: k, actor: rnd(nd), kind: list[rnd(list.length)], n: [rnd(100000), rnd(100000), rnd(100000), rnd(100000)] });
  }
  return { init, nd, steps };
}

// ---------------------------------------------------------------------------------------------------------------- shared
const slotSets = (sec) => { const m = {}; for (const id of sorted(sec.subs)) { const s = sec.subs[id]; (m[s.fcId + '|' + s.slot] = m[s.fcId + '|' + s.slot] || []).push(id); } return m; };
const slotKey = (sub) => sub.fcId + '|' + sub.slot;
function newDuplicate(next, prev) { // a slot holding two or more where one of them was not in that slot before
  const m = slotSets(next);
  return Object.keys(m).find((k) => m[k].length > 1 && m[k].some((id) => !(prev.subs[id] && slotKey(prev.subs[id]) === slotKey(next.subs[id])))) || null;
}
const orphans = (sec) => sorted(sec.subs).filter((id) => !sec.fcs[sec.subs[id].fcId]);

// ---------------------------------------------------------------------------------------------------------------- tabs model
const resetStore = () => { CC.resetMemory(); if (globalThis.localStorage) { localStorage.removeItem(CC.LS); localStorage.removeItem(CC.LS + '-rev'); } };
async function readStored() { const r = await CC.read(); return { rev: r.rev, raw: r.raw, sec: r.raw ? CC.checkDoc(r.raw).modules.submersibles || null : null }; }
async function seedStore(sec) {
  resetStore();
  await CC.transact((raw) => { const doc = raw ? CC.checkDoc(raw) : CC.emptyDoc(); doc.modules.submersibles = CC.checkModules({ submersibles: sec }).submersibles; doc.updated = Date.now(); return doc; });
}
const REFUSALS = [
  'This free company was removed on another device or in another tab.', 'The free company changed while its submarine was being saved.', 'The free company was removed while its submarine was being saved.',
  'That submarine slot changed elsewhere.',
  'This submarine was removed on another device or in another tab.', 'This logged voyage was removed on another device or in another tab.',
  'This free company has a submarine that was saved in another tab or on another device, so nothing was removed.', 'This submarine changed in another tab or on another device.'
];
const mkState = (sec) => { const s = ET.newState(['A', 'B', 'C']); s.modules = { submersibles: clone(sec) }; return ET.validateState(s); };

// Runs one sequence of the tabs model; returns { viol: [{ inv, msg, at }], trace }. A violation is recorded once per invariant.
async function runTabs(seq) {
  const viol = [], trace = [], seen = new Set();
  let at = 0;
  const flag = (inv, msg) => { if (!seen.has(inv)) { seen.add(inv); viol.push({ inv, msg, at }); } };
  await seedStore(seq.init);
  const first = await readStored();
  const tabs = [0, 1, 2].map(() => ({ rev: first.rev, base: clone(first.sec) }));
  const win = { rev: first.rev, base: clone(first.sec) }; // the one Tracker window
  for (at = 0; at < seq.steps.length; at++) {
    const st = seq.steps[at], before = await readStored(), t = st.actor % 3, tab = tabs[t];
    if (st.kind === 'reload') { tab.rev = before.rev; tab.base = clone(before.sec); trace.push('tab' + t + ' reload'); continue; }
    if (st.kind === 'fold') {
      const r = await CC.foldSection('submersibles', FLEET.foldFcs), after = await readStored(), removed = (r.removed || []).slice().sort();
      trace.push('fold -> removed [' + removed.join(',') + ']');
      const expect = FLEET.foldFcs(before.sec).removed.slice().sort();
      const gone = sorted(before.sec.fcs).filter((id) => !after.sec.fcs[id]);
      if (canon(removed) !== canon(expect) || canon(gone) !== canon(expect)) flag('MT8', 'fold removed [' + removed + '], gone [' + gone + '], foldFcs says [' + expect + ']');
      for (const id of sorted(before.sec.subs)) if (!after.sec.subs[id]) flag('MT5', 'fold removed submarine ' + id);
      for (const id of sorted(before.sec.trips)) if (!after.sec.trips[id]) flag('MT5', 'fold removed logged voyage ' + id);
      continue;
    }
    if (st.kind === 'trackerSave') {
      // a Tracker save that changes nothing in the section: it takes the stored section (merge.js), the stored copy stays
      const snap = mkState(win.base); let result = null;
      try {
        await CC.transact((raw, rev) => {
          const doc = CC.checkDoc(raw);
          result = ET.saveMerge(snap, rev, ET.portable(mkState(doc.modules.submersibles)), win.rev, ET.portable(mkState(win.base)));
          doc.modules.submersibles = CC.checkModules({ submersibles: result.state.modules.submersibles }).submersibles; doc.updated = Date.now(); return doc;
        });
      } catch (e) { flag('MT9', 'Tracker save threw ' + e.message); continue; }
      const after = await readStored();
      trace.push('trackerSave');
      if (canon(after.sec) !== canon(before.sec)) flag('MT9', 'a Tracker save that changed nothing changed the section');
      win.rev = after.rev; win.base = clone(after.sec);
      continue;
    }
    // an edit of the tab's own copy, then a send
    const local = clone(tab.base), eff = applyOp(local, st.kind, st.n, st.i);
    if (!eff) { trace.push('tab' + t + ' ' + st.kind + ' (no-op)'); continue; }
    const sent = CC.checkModules({ submersibles: local }).submersibles, b = clone(tab.base);
    let res = null, err = null;
    try { res = await CC.writeSection('submersibles', sent, { rev: tab.rev, base: tab.base }); } catch (e) { err = e.message; }
    const after = await readStored();
    trace.push('tab' + t + ' ' + eff.desc + (err ? ' -> REFUSED: ' + err : ' -> ok'));
    if (err) {
      if (canon(after.raw) !== canon(before.raw) || after.rev !== before.rev) flag('MT0', 'a refused write changed the store');
      if (!REFUSALS.includes(err)) flag('MT0', 'refused with a text that is not on the list: ' + err);
      tab.rev = after.rev; tab.base = clone(after.sec); continue;
    }
    tab.rev = res.rev; tab.base = clone(res.section);
    checkTabsWrite(flag, { before: before.sec, after: after.sec, b, sent, eff, raw: after.raw });
  }
  return { viol, trace };
}

// bare in a section: no submarine under it, no world, one slot, sectors 1 and 2 only (a free company never touched)
const baseBare = (sec, id) => { const f = sec.fcs[id]; return !!f && !sorted(sec.subs).some((x) => sec.subs[x].fcId === id) && !f.world && (f.unlockedSlots == null || f.unlockedSlots === 1) && (f.discovered == null || canon(f.discovered) === '[1,2]'); };

function checkTabsWrite(flag, { before, after, b, sent, eff, raw }) {
  // MT1: the store passes checkDoc, and a second check changes nothing
  try { const d1 = CC.checkDoc(raw), d2 = CC.checkDoc(clone(d1)); if (canon(d1) !== canon(d2)) flag('MT1', 'a second checkDoc changed the store'); } catch (e) { flag('MT1', 'checkDoc threw ' + e.message); }
  // MT2 (I1): no new orphan
  for (const id of orphans(after)) if (!(before.subs[id] && before.subs[id].fcId === after.subs[id].fcId && !before.fcs[before.subs[id].fcId])) flag('MT2', 'submarine ' + id + ' points at missing company ' + after.subs[id].fcId);
  // MT3 (I3): no new duplicate
  const dup = newDuplicate(after, before); if (dup) flag('MT3', 'slot ' + dup + ' now holds ' + slotSets(after)[dup]);
  // MT4 (I2): nothing in the tab's base and absent from the store before comes back
  for (const kind of ['fcs', 'subs', 'trips']) for (const id of sorted(b[kind])) {
    if (before[kind][id] || !after[kind][id]) continue;
    // A company that was bare in the tab's BASE and loses the fold against the STORED copy is treated like the automatic clean-up,
    // whatever the tab sent: the code's own test (isBareBase and CC.foldLoser), the case docs/STATE.md "Known limits" keeps open
    // on purpose and the pinned INT-A5 / checks C65 and C70 require.
    if (kind === 'fcs' && baseBare(b, id) && CC.foldLoser(before, id, b.fcs[id])) continue;
    flag('MT4', kind.slice(0, -1) + ' ' + id + ' was removed elsewhere and is stored again');
  }
  // MT5: nothing disappears unless the step removed it
  for (const id of sorted(before.fcs)) if (!after.fcs[id] && !eff.removedFcs.includes(id)) flag('MT5', 'company ' + id + ' disappeared');
  for (const id of sorted(before.subs)) if (!after.subs[id] && !eff.removedSubs.includes(id) && !(eff.removedFcs.includes(before.subs[id].fcId) && b.subs[id])) flag('MT5', 'submarine ' + id + ' disappeared');
  for (const id of sorted(before.trips)) if (!after.trips[id] && !eff.removedTrips.includes(id)) flag('MT5', 'logged voyage ' + id + ' disappeared');
  for (const id of sorted(before.fcs)) if (after.fcs[id]) for (const x of before.fcs[id].discovered || []) if (!(after.fcs[id].discovered || []).includes(x) && !(eff.tick && eff.tick.fc === id && eff.tick.x === x && !eff.tick.on)) flag('MT5', 'sector ' + x + ' of ' + id + ' disappeared');
  // MT6 (I4, intent): the step's effect is stored
  for (const id of eff.subs) {
    const want = sent.subs[id], got = after.subs[id];
    if (!want) continue;
    if (canon(b.subs[id]) === canon(want)) continue; // the edit changed nothing: not targeted
    if (!got) { flag('MT6', 'submarine ' + id + ' is not stored'); continue; }
    if (canon(got) === canon(want)) continue;
    // a submarine sent under a company the clean-up removed sits alone in that slot of the company that beat it
    const moved = got.fcId !== want.fcId && !before.fcs[want.fcId] && !after.fcs[want.fcId] && b.fcs[want.fcId] && CC.foldWinner(before, want.fcId, b.fcs[want.fcId]) === got.fcId
      && canon(Object.assign({}, got, { fcId: want.fcId })) === canon(want) && (slotSets(after)[slotKey(got)] || []).join() === id;
    if (!moved) flag('MT6', 'submarine ' + id + ' is stored as ' + canon(got) + ', not as sent ' + canon(want));
  }
  for (const id of eff.trips) if (sent.trips[id] && canon(b.trips[id]) !== canon(sent.trips[id]) && canon(after.trips[id]) !== canon(sent.trips[id])) flag('MT6', 'logged voyage ' + id + ' is not stored as sent');
  for (const id of eff.removedTrips) if (after.trips[id]) flag('MT6', 'logged voyage ' + id + ' was removed here and is stored');
  for (const id of eff.removedSubs) if (after.subs[id]) flag('MT6', 'submarine ' + id + ' was removed here and is stored');
  for (const id of Object.keys(eff.fcs)) {
    const want = sent.fcs[id], got = after.fcs[id];
    if (!want) continue;
    const fields = eff.fcs[id].filter((f) => canon(b.fcs[id] && b.fcs[id][f]) !== canon(want[f])); // a field the edit left as it was is not targeted
    if (!fields.length) continue;
    if (!got) { flag('MT6', 'company ' + id + ' is not stored'); continue; }
    for (const f of fields) {
      if (f === 'unlockedSlots' ? !((got.unlockedSlots || 1) >= (want.unlockedSlots || 1)) : canon(got[f]) !== canon(want[f])) flag('MT6', 'company ' + id + ' field ' + f + ' is ' + canon(got[f]) + ', sent ' + canon(want[f]));
    }
  }
  // Owner decision 2026-11-19 (docs/submersibles-merge-spec.md section 12, OWNER-1 B): when both sides changed a free company, the
  // discovered sectors are combined and a merge never removes one. So an untick is not required to be stored when the stored company
  // changed since the tab's base; a sector the stored company held must then still be present.
  const tickFc = eff.tick && eff.tick.fc, tickMerged = eff.tick && !eff.tick.on && before.fcs[tickFc] && b.fcs[tickFc] && canon(before.fcs[tickFc]) !== canon(b.fcs[tickFc]);
  if (tickMerged) { if (after.fcs[tickFc] && (before.fcs[tickFc].discovered || []).includes(eff.tick.x) && !(after.fcs[tickFc].discovered || []).includes(eff.tick.x)) flag('MT6', 'sector ' + eff.tick.x + ' of ' + tickFc + ' was dropped by a merge'); }
  else if (eff.tick && after.fcs[eff.tick.fc] && (after.fcs[eff.tick.fc].discovered || []).includes(eff.tick.x) !== eff.tick.on) flag('MT6', 'sector ' + eff.tick.x + ' of ' + eff.tick.fc + ' is not ' + (eff.tick.on ? 'ticked' : 'unticked'));
  // interpretation (3): a no-change edit (the sent preferences equal the tab's base) is skipped; preferences are unguarded by design
  if (eff.pref && canon(b.settings) !== canon(sent.settings) && canon(after.settings.prefs) !== canon(sent.settings.prefs)) flag('MT6', 'preference not stored as sent');
  if (eff.rearr) {
    const B = slotSets(b), L = slotSets(sent), A = slotSets(after), t = (x, k) => (x[k] || []).join();
    for (const k of new Set([...Object.keys(B), ...Object.keys(L)])) {
      if (t(B, k) === t(L, k)) continue;
      const fcId = k.split('|')[0]; if (!after.fcs[fcId]) continue;
      if (t(A, k) !== t(L, k)) flag('MT6', 'slot ' + k + ' holds [' + t(A, k) + '], the tab showed [' + t(L, k) + ']');
    }
  }
  // MT7 (I6): a record the step did not target is as the store had it
  for (const kind of ['fcs', 'subs', 'trips']) for (const id of new Set([...Object.keys(b[kind]), ...Object.keys(sent[kind])])) {
    const targeted = canon(b[kind][id]) !== canon(sent[kind][id]);
    if (!targeted) { if (canon(before[kind][id]) !== canon(after[kind][id])) flag('MT7', kind.slice(0, -1) + ' ' + id + ' was not targeted and changed'); }
    // Spec A5 (OWNER-1 B): refused when the stored record, the tab's base and what the tab sends all differ from each other. When the
    // tab sends exactly what is stored, both tabs reached the same state, nothing made elsewhere is lost, and the write is allowed.
    else if (SAME_SUB === 'refuse' && kind === 'subs' && before.subs[id] && b.subs[id] && canon(before.subs[id]) !== canon(b.subs[id]) && canon(before.subs[id]) !== canon(sent.subs[id])) flag('MT7', 'submarine ' + id + ' changed in another tab and was written');
  }
  for (const id of sorted(before.fcs)) if (!b.fcs[id] && !sent.fcs[id] && canon(before.fcs[id]) !== canon(after.fcs[id])) flag('MT7', 'company ' + id + ' (unknown to the tab) changed');
  for (const id of sorted(before.subs)) if (!b.subs[id] && !sent.subs[id] && canon(before.subs[id]) !== canon(after.subs[id])) flag('MT7', 'submarine ' + id + ' (unknown to the tab) changed');
  for (const id of sorted(before.trips)) if (!b.trips[id] && !sent.trips[id] && canon(before.trips[id]) !== canon(after.trips[id])) flag('MT7', 'logged voyage ' + id + ' (unknown to the tab) changed');
  if (canon(b.settings) === canon(sent.settings) && canon(before.settings) !== canon(after.settings)) flag('MT7', 'preferences were not targeted and changed');
}

// ---------------------------------------------------------------------------------------------------------------- devices model
const keyOf = (kind, id) => 'm|' + JSON.stringify(['submersibles', kind, id]);
const EMPTY = { fcs: {}, subs: {}, trips: {}, settings: {} };
const secOf = (st) => st.modules.submersibles;

// One sync of a device with the cloud copy (as ET.cloudSync / ET.cloudFinish): the answer to each question comes from the
// answers array ('local', 'remote' or null for no answer), the invariants MD1-MD7 are checked on the result.
function doSync(dev, cloud, answers, flag) {
  const local = ET.portable(dev.st), res = ET.threeWay(dev.base, local, cloud.doc), choices = {};
  res.conflicts.forEach((c, j) => { const a = answers(j); if (a) choices[c.id] = a; });
  const cand = ET.applyMerge(clone(dev.st), res, choices);
  const L = secOf(dev.st), R = Object.assign({}, EMPTY, (cloud.doc.modules && cloud.doc.modules.submersibles) || {}), B = Object.assign({}, EMPTY, (dev.base && dev.base.modules && dev.base.modules.submersibles) || {}), M = secOf(cand);
  const byId = new Map(res.conflicts.map((c) => [c.id, c])), side = (c) => choices[c.id] || 'local'; // no answer: this device's value
  const slotQs = res.conflicts.filter((c) => c.integrity && c.integrity.kind === 'slot'), ownerQs = res.conflicts.filter((c) => c.integrity && c.integrity.kind === 'owner');
  const slotAsked = new Set(slotQs.map((c) => c.integrity.fcId + '|' + c.integrity.slot));
  // MD1
  try { CC.checkDoc({ app: CC.APP, v: 1, modules: cand.modules }); } catch (e) { flag('MD1', 'the merged section fails checkDoc: ' + e.message); }
  // MD2: no orphan that L or R did not already hold
  for (const id of orphans(M)) {
    const held = (x) => x.subs[id] && !x.fcs[x.subs[id].fcId];
    if (!held(L) && !held(R)) flag('MD2', 'submarine ' + id + ' has no company ' + M.subs[id].fcId);
  }
  // MD3: a slot with two or more was asked, or holds them all on L or on R, or holds a submarine both devices hold in different places
  const lm = slotSets(L), rm = slotSets(R);
  for (const [k, ids] of Object.entries(slotSets(M))) {
    if (ids.length < 2 || slotAsked.has(k)) continue;
    if (ids.every((x) => (lm[k] || []).includes(x)) || ids.every((x) => (rm[k] || []).includes(x))) continue;
    if (ids.some((x) => L.subs[x] && R.subs[x] && slotKey(L.subs[x]) !== slotKey(R.subs[x]))) continue;
    flag('MD3', 'slot ' + k + ' holds ' + ids + ' without a question');
  }
  // MD6: a submarine has the company it has on L or R
  for (const id of sorted(M.subs)) if (!(L.subs[id] && L.subs[id].fcId === M.subs[id].fcId) && !(R.subs[id] && R.subs[id].fcId === M.subs[id].fcId)) flag('MD6', 'submarine ' + id + ' has company ' + M.subs[id].fcId + ', neither device has it there');
  // MD7: no sector of L or R is lost unless it was in B
  for (const id of sorted(M.fcs)) for (const x of [L, R]) if (x.fcs[id]) for (const sec of x.fcs[id].discovered || []) if (!(M.fcs[id].discovered || []).includes(sec) && !((B.fcs[id] && B.fcs[id].discovered) || []).includes(sec)) flag('MD7', 'sector ' + sec + ' of ' + id + ' lost');
  // MD4 (S1, S2): a record of L or R missing from M is an explicit removal
  const removedSubs = new Set(); // submarines removed by (c) or (d), for (e)
  for (const kind of ['fcs', 'subs', 'trips']) for (const id of new Set([...Object.keys(L[kind]), ...Object.keys(R[kind])])) {
    if (M[kind][id]) continue;
    const inB = !!B[kind][id], inL = !!L[kind][id], inR = !!R[kind][id], k = keyOf(kind, id);
    if (inB && ((!inL && inR && canon(R[kind][id]) === canon(B[kind][id])) || (!inR && inL && canon(L[kind][id]) === canon(B[kind][id])))) continue; // (a)
    const own = byId.get(k), lacking = !inL ? 'local' : !inR ? 'remote' : null;
    if (own && lacking && side(own) === lacking) continue; // (b)
    if (kind === 'subs') {
      let ok = false;
      for (const c of slotQs) { // (c)
        const g = c.integrity, dropped = side(c) === 'local' ? g.remotes : g.locals, kept = side(c) === 'local' ? L : R;
        if ((dropped || []).some((x) => x.key === k) && (!kept.subs[id] || (kept.subs[id].fcId === g.fcId && kept.subs[id].slot === g.slot))) ok = true;
      }
      for (const c of ownerQs) { // (d)
        if (!c.integrity.linked.includes(id)) continue;
        if ((side(c) === 'remote' ? c.remote : c.local) === null) ok = true;
      }
      if (ok) { removedSubs.add(id); continue; }
    }
    if (kind === 'trips') { const tr = L.trips[id] || R.trips[id]; if (removedSubs.has(tr.s) || (!M.subs[tr.s] && tripSubGone(tr.s, slotQs, ownerQs, side, L, R))) continue; } // (e)
    flag('MD4', kind.slice(0, -1) + ' ' + id + ' is missing from the result (L:' + inL + ' R:' + inR + ' B:' + inB + ')');
  }
  // MD5: a record in B, missing on one side and present in M, had a question in this sync: its own, its company's, or its fleet's
  for (const kind of ['fcs', 'subs', 'trips']) for (const id of sorted(B[kind])) {
    if (!M[kind][id] || (!!L[kind][id] && !!R[kind][id])) continue;
    let asked = byId.has(keyOf(kind, id));
    const fcOf = kind === 'subs' ? (M.subs[id] || L.subs[id] || R.subs[id]).fcId : kind === 'trips' ? (() => { const s = M.subs[(M.trips[id]).s] || L.subs[M.trips[id].s] || R.subs[M.trips[id].s]; return s && s.fcId; })() : null;
    if (fcOf && byId.has(keyOf('fcs', fcOf))) asked = true;
    if (!asked) flag('MD5', kind.slice(0, -1) + ' ' + id + ' was removed on one side and is back without a question');
  }
  cloud.doc = clone(ET.portable(cand)); dev.base = clone(cloud.doc); dev.st = cand;
  return res.conflicts.length;
}
// (e): the submarine of a logged voyage was removed by a slot or free-company answer (computed apart from the order of records)
function tripSubGone(subId, slotQs, ownerQs, side, L, R) {
  const k = keyOf('subs', subId);
  for (const c of slotQs) {
    const g = c.integrity, dropped = side(c) === 'local' ? g.remotes : g.locals, kept = side(c) === 'local' ? L : R;
    if ((dropped || []).some((x) => x.key === k) && (!kept.subs[subId] || (kept.subs[subId].fcId === g.fcId && kept.subs[subId].slot === g.slot))) return true;
  }
  return ownerQs.some((c) => c.integrity.linked.includes(subId) && (side(c) === 'remote' ? c.remote : c.local) === null);
}

function runDevices(seq) {
  const viol = [], trace = [], seen = new Set();
  let at = 0;
  const flag = (inv, msg) => { if (!seen.has(inv)) { seen.add(inv); viol.push({ inv, msg, at }); } };
  const first = mkState(seq.init), cloud = { doc: clone(ET.portable(first)) }, devs = [];
  for (let i = 0; i < seq.nd; i++) devs.push({ st: mkState(seq.init), base: clone(cloud.doc) });
  for (at = 0; at < seq.steps.length; at++) {
    const s = seq.steps[at], d = s.actor % seq.nd, dev = devs[d];
    if (s.kind === 'sync') {
      const asked = doSync(dev, cloud, (j) => ['local', 'remote', null][(s.n[1] + j * (s.n[2] | 1)) % 3], flag);
      trace.push('sync' + d + ' (' + asked + ' asked)'); continue;
    }
    const sec = clone(secOf(dev.st));
    if (s.kind === 'fold') { const r = FLEET.foldFcs(sec); if (!r.removed.length) { trace.push('dev' + d + ' fold (no-op)'); continue; } dev.st.modules.submersibles = CC.checkModules({ submersibles: r.section }).submersibles; trace.push('dev' + d + ' fold [' + r.removed + ']'); continue; }
    const eff = applyOp(sec, s.kind, s.n, s.i);
    if (!eff) { trace.push('dev' + d + ' ' + s.kind + ' (no-op)'); continue; }
    dev.st.modules.submersibles = CC.checkModules({ submersibles: sec }).submersibles; trace.push('dev' + d + ' ' + eff.desc);
  }
  // MD8 (S3): everybody syncs answering "this device"; within six rounds nothing is asked and all devices are equal
  let quiet = false;
  for (let round = 0; round < 6 && !quiet; round++) {
    quiet = true; const before = canon(cloud.doc.modules);
    for (let d = 0; d < seq.nd; d++) { const n = doSync(devs[d], cloud, () => 'local', flag); trace.push('settle-sync' + d + ' (' + n + ' asked)'); if (n) quiet = false; }
    if (canon(cloud.doc.modules) !== before) quiet = false;
  }
  at = seq.steps.length;
  if (!quiet) flag('MD8', 'still asking after six rounds');
  else if (!devs.every((x) => canon(secOf(x.st)) === canon(secOf(devs[0].st)))) flag('MD8', 'the devices differ after settling');
  return { viol, trace };
}

// ---------------------------------------------------------------------------------------------------------------- sweep and shrinker
async function shrink(run, seq, inv, at) {
  let cur = { init: seq.init, nd: seq.nd, steps: seq.steps.slice(0, at + 1) };
  const fails = async (c) => (await run(c)).viol.some((v) => v.inv === inv);
  for (let progress = true; progress;) {
    progress = false;
    for (let k = 0; k < cur.steps.length; k++) {
      const cand = { init: cur.init, nd: cur.nd, steps: cur.steps.filter((_, j) => j !== k) };
      if (await fails(cand)) { cur = cand; progress = true; k--; }
    }
  }
  return cur;
}
async function sweep(model, run, invs) {
  const out = {}, ran = { n: 0 };
  for (const inv of invs) out[inv] = { count: 0, first: null };
  for (const seed of SEEDS) for (let i = 0; i < PER_SEED; i++) {
    const seq = genSequence(seed, i, model), r = await run(seq); ran.n++;
    for (const v of r.viol) {
      if (!out[v.inv]) out[v.inv] = { count: 0, first: null };
      out[v.inv].count++;
      if (!out[v.inv].first) out[v.inv].first = { seed, i, seq, at: v.at, msg: v.msg };
    }
  }
  for (const inv of Object.keys(out)) {
    const f = out[inv].first; if (!f) continue;
    const small = await shrink(run, f.seq, inv, f.at), r = await run(small), v = r.viol.find((x) => x.inv === inv);
    f.shrunk = small; f.shrunkMsg = v ? v.msg : f.msg;
    f.steps = r.trace.filter((x, k) => k < small.steps.length + 0 || true);
  }
  out.ran = ran.n;
  return out;
}
const TAB_INVS = ['MT0', 'MT1', 'MT2', 'MT3', 'MT4', 'MT5', 'MT6', 'MT7', 'MT8', 'MT9'];
const DEV_INVS = ['MD1', 'MD2', 'MD3', 'MD4', 'MD5', 'MD6', 'MD7', 'MD8'];
let tabsRun = null, devsRun = null;
const tabsResult = () => (tabsRun = tabsRun || sweep('tab', runTabs, TAB_INVS));
const devsResult = () => (devsRun = devsRun || sweep('dev', async (q) => runDevices(q), DEV_INVS));
function explain(inv, o) {
  const f = o[inv].first;
  return inv + ' failed in ' + o[inv].count + ' of ' + o.ran + ' sequences. First: seed ' + f.seed + ', sequence ' + f.i + '. ' + f.shrunkMsg + '\n  shrunk to ' + f.shrunk.steps.length + ' step(s):\n    '
    + f.steps.map((x) => x).join('\n    ') + (f.shrunk.nd ? '\n  (' + f.shrunk.nd + ' devices/tabs; start ' + canon(f.shrunk.init) + ')' : '');
}

const TAB_TEXT = {
  MT0: 'a refused write leaves the store as it was, with one of the known texts', MT1: 'the store passes checkDoc, unchanged by a second check', MT2: 'I1 no new orphan submarine', MT3: 'I3 no new slot duplicate',
  MT4: 'I2 nothing removed elsewhere comes back', MT5: 'nothing disappears unless the step removed it', MT6: 'I4 the step\'s effect is stored as the tab showed it', MT7: 'I6 a record the step did not target is as stored',
  MT8: 'a fold removes exactly what FLEET.foldFcs says', MT9: 'a plain Tracker save leaves the section as it is'
};
const DEV_TEXT = {
  MD1: 'the merge result passes checkDoc', MD2: 'no new orphan', MD3: 'a slot with two or more was asked about, or already held them', MD4: 'a record missing after a sync is an explicit removal (S1, S2)',
  MD5: 'a record removed on one side is back only after a question', MD6: 'a submarine has the company it has on a device', MD7: 'no sector is lost', MD8: 'devices settle (S3)'
};
for (const inv of TAB_INVS) test(inv + ' (tabs) ' + TAB_TEXT[inv], async () => { const o = await tabsResult(); if (o[inv].count) assert.fail(explain(inv, o)); });
for (const inv of DEV_INVS) test(inv + ' (devices) ' + DEV_TEXT[inv], async () => { const o = await devsResult(); if (o[inv].count) assert.fail(explain(inv, o)); });
test('the models ran the sequences asked for', async () => {
  const a = await tabsResult(), b = await devsResult();
  console.log('# tabs model: ' + a.ran + ' sequences of ' + TAB_STEPS + ' steps; devices model: ' + b.ran + ' sequences of ' + DEVICE_STEPS + ' steps then settling (seeds ' + SEEDS.join(',') + ')');
  assert.equal(a.ran, SEEDS.length * PER_SEED); assert.equal(b.ran, SEEDS.length * PER_SEED);
});
