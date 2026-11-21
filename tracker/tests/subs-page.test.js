'use strict';
// The Submersibles page's save ordering (fourth outside review, M1 to M3): the page's own scheduling code (schedule, write, foldBare, reload,
// setSection and the helpers between them) is taken verbatim from command-center/src/submersibles/subs.js and run against the real save
// (CC, memory backend) and the real FLEET, with a hand-driven clock and a write that can be held after its transaction has stored.
// Run: node --test tests/subs-page.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
for (const f of ['save', 'model', 'codec', 'merge']) require(path.join(__dirname, '..', 'src', 'core', f + '.js'));
require(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'fleet.js'));
const CC = globalThis.CC, F = globalThis.FLEET;
const SRC = fs.readFileSync(path.join(__dirname, '..', 'command-center', 'src', 'submersibles', 'subs.js'), 'utf8');
const from = SRC.indexOf('  function emptySection()'), to = SRC.indexOf('  function setStatus(t)');
assert.ok(from > 0 && to > from, 'the page code to test was not found');
const CODE = SRC.slice(from, SRC.indexOf('\n', to));
const clone = (x) => JSON.parse(JSON.stringify(x));
const fc = (extra) => Object.assign({ name: 'Alpha FC', charId: 'c1', order: 0, unlockedSlots: 3, world: 'Ravana', discovered: [1, 2, 3] }, extra || {});
const sub = (slot, name, rank) => ({ fcId: 'fa', slot, name, rank: rank || 10, voyage: null });
const SEED = () => ({ fcs: { fa: fc() }, subs: { s1: sub(1, 'Alpha', 10), s2: sub(2, 'Beta', 10) }, trips: {}, settings: {} });

// a page: the real code, a clock driven by hand, the status line kept as text, and an optional hold on the write's result
async function page(seed) {
  CC.resetMemory();
  const first = await CC.writeSection('submersibles', seed, null);
  const timers = [], clock = { now: 0, id: 0 }, status = { text: '' }, held = [], hold = { on: false };
  const native = CC.writeSection.bind(CC);
  const cc = Object.assign({}, CC, { writeSection: function () { const p = native.apply(null, arguments); return hold.on ? p.then((r) => new Promise((res) => held.push(() => res(r)))) : p; } });
  const setT = (fn, ms) => { const t = { id: ++clock.id, at: clock.now + ms, fn }; timers.push(t); return t.id; };
  const clearT = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const el = { get textContent() { return status.text; }, set textContent(v) { status.text = v; } };
  const body = CODE + '\n;return { schedule: schedule, write: write, reload: reload, setSection: setSection, S: function () { return S; }, SH: SH, setStatus: setStatus };';
  const h = new Function('CC', 'F', 'RC', 'render', 'pushSync', 'recsRead', 'recsNow', 'hiddenSet', 'syncTicks', 'wizGone', '$', 'setTimeout', 'clearTimeout', 'W',
    'var SH = { rev: null, base: null, ready: true, timer: null, problem: null, chars: [], editSeq: 0 }; var S = {};\n' + body)(
    cc, F, { k: { pending: 0 } }, () => {}, () => {}, () => {}, () => ({}), () => ({}), () => {}, () => false, () => el, setT, clearT, null);
  h.SH.rev = first.rev; h.SH.base = clone(first.section); h.SH.chars = first.doc.chars; h.setSection(first.section);
  const other = { rev: first.rev, base: clone(first.section) }; // another tab: saves through the store with what it last read
  return Object.assign(h, {
    status, held, hold, other,
    edit: (fn) => { fn(h.S()); h.schedule(); },
    advance: (ms) => { clock.now += ms; timers.filter((t) => t.at <= clock.now).sort((a, b) => a.at - b.at).forEach((t) => { clearT(t.id); t.fn(); }); },
    release: () => { hold.on = false; held.splice(0).forEach((f) => f()); },
    settle: async () => { for (let i = 0; i < 20 && h.SH.busy; i++) await h.SH.busy; },
    otherSaves: async (fn) => { const cur = CC.checkDoc((await CC.read()).raw).modules.submersibles, sec = clone(cur); fn(sec); const r = await CC.writeSection('submersibles', sec, { rev: (await CC.read()).rev, base: cur }); other.rev = r.rev; return r; },
    stored: async () => CC.checkDoc((await CC.read()).raw).modules.submersibles,
  });
}
const tick = () => new Promise((r) => setImmediate(r));

test('M1 an edit waiting in SH.again survives a reload() and is stored with the other tab\'s change', async () => {
  const p = await page(SEED());
  p.edit((S) => { S.subs.s1.name = 'Renamed'; });
  await p.otherSaves((s) => { s.subs.s3 = sub(3, 'Gamma'); }); // the write below is a merged one
  p.hold.on = true; p.advance(250); await tick(); // the write has stored and is held
  assert.equal(p.held.length, 1);
  p.edit((S) => { S.subs.s1.rank = 9; }); p.advance(250); // the timer fires during the write: the edit waits in SH.again
  assert.equal(p.SH.timer, null); assert.equal(p.SH.again, true);
  await p.otherSaves((s) => { s.subs.s4 = sub(4, 'Delta'); });
  await p.reload(); // another tab's save, or the tab becoming visible
  p.release(); await p.settle();
  const s = await p.stored();
  assert.equal(s.subs.s1.rank, 9, 'the waiting edit is stored');
  assert.equal(s.subs.s1.name, 'Renamed');
  assert.ok(s.subs.s3 && s.subs.s4, 'the other tab\'s changes are kept');
  assert.equal(p.S().subs.s1.rank, 9, 'and shown');
});

test('M2 another tab renames a submarine, the player sets its rank during a held merged write: the follow-up is refused (A5) and the other tab\'s name stays', async () => {
  const p = await page(SEED());
  p.edit((S) => { S.subs.s2.name = 'Beta 2'; });
  await p.otherSaves((s) => { s.subs.s1.name = 'Renamed Elsewhere'; });
  p.hold.on = true; p.advance(250); await tick();
  p.edit((S) => { S.subs.s1.rank = 20; }); p.advance(250); // during the held write
  p.release(); await p.settle();
  const s = await p.stored();
  assert.equal(s.subs.s1.name, 'Renamed Elsewhere', 'the other tab\'s name is not overwritten');
  assert.equal(s.subs.s1.rank, 10);
  assert.match(p.status.text, /This submarine changed in another tab or on another device\./);
  assert.match(p.status.text, /Not saved on this device/);
  assert.equal(p.S().subs.s1.name, 'Renamed Elsewhere', 'the page shows the stored copy');
});

test('M2 the player changes a DIFFERENT submarine during the held write: both changes are stored, no refusal', async () => {
  const p = await page(SEED());
  p.edit((S) => { S.subs.s2.name = 'Beta 2'; });
  await p.otherSaves((s) => { s.subs.s1.name = 'Renamed Elsewhere'; });
  p.hold.on = true; p.advance(250); await tick();
  p.edit((S) => { S.subs.s2.rank = 20; }); p.advance(250);
  p.release(); await p.settle();
  const s = await p.stored();
  assert.equal(s.subs.s1.name, 'Renamed Elsewhere');
  assert.equal(s.subs.s2.rank, 20); assert.equal(s.subs.s2.name, 'Beta 2');
  assert.doesNotMatch(p.status.text, /Not saved/);
});

test('M2 a free company changed on both sides (another tab: world; the player: slots, during the write): the fields are merged, no refusal', async () => {
  const p = await page(SEED());
  p.edit((S) => { S.subs.s2.name = 'Beta 2'; });
  await p.otherSaves((s) => { s.fcs.fa.world = 'Odin'; });
  p.hold.on = true; p.advance(250); await tick();
  p.edit((S) => { S.fcs.fa.unlockedSlots = 4; }); p.advance(250);
  p.release(); await p.settle();
  const s = await p.stored();
  assert.equal(s.fcs.fa.world, 'Odin'); assert.equal(s.fcs.fa.unlockedSlots, 4); assert.equal(s.subs.s2.name, 'Beta 2');
  assert.doesNotMatch(p.status.text, /Not saved/);
});

test('M2 a merged write with no edit during it still takes the returned section as its base (behaviour as before)', async () => {
  const p = await page(SEED());
  p.edit((S) => { S.subs.s2.name = 'Beta 2'; });
  await p.otherSaves((s) => { s.subs.s1.name = 'Renamed Elsewhere'; });
  p.advance(250); await tick(); await p.settle();
  assert.equal(p.SH.base.subs.s1.name, 'Renamed Elsewhere');
  assert.equal(p.SH.rev, (await CC.read()).rev);
  assert.equal((await p.stored()).subs.s2.name, 'Beta 2');
});

test('M3 a write in flight for 15 seconds shows "Still saving…", cleared when it settles; nothing is retried or unblocked', async () => {
  const p = await page(SEED());
  p.edit((S) => { S.subs.s2.name = 'Beta 2'; });
  p.hold.on = true; p.advance(250); await tick();
  p.advance(14000); assert.equal(p.status.text, '');
  p.advance(1000);
  assert.equal(p.status.text, 'Still saving… if this does not finish, reload the page.');
  assert.ok(p.SH.busy, 'still the same write: no second one was started');
  p.release(); await p.settle();
  assert.equal(p.status.text, '');
  assert.equal((await p.stored()).subs.s2.name, 'Beta 2');
});

test('M1b another tab saves while this page\'s write is in flight and nothing is waiting: the skipped reload runs once the write settles, so the change is shown', async () => {
  const p = await page(SEED());
  p.edit((S) => { S.subs.s1.name = 'Renamed'; });
  p.hold.on = true; p.advance(250); await tick(); // this write has stored (not merged: nothing else had saved) and is held
  assert.equal(p.held.length, 1);
  await p.otherSaves((s) => { s.subs.s3 = sub(3, 'Gamma'); }); // another tab saves after this write's transaction
  await p.reload(); // its change event arrives while the write is in flight: skipped for now
  assert.equal(p.S().subs.s3, undefined);
  assert.equal(p.SH.reloadLater, true);
  p.release(); await p.settle();
  assert.equal(p.S().subs.s3 && p.S().subs.s3.name, 'Gamma', 'the other tab\'s submarine is shown after the write settles');
  assert.equal(p.S().subs.s1.name, 'Renamed');
  const st = await p.stored();
  assert.equal(st.subs.s1.name, 'Renamed'); assert.equal(st.subs.s3.name, 'Gamma');
  assert.equal((await CC.read()).rev, p.SH.rev, 'the page holds the stored revision again');
});
