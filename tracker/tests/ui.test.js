'use strict';
// Eveniunt Tracker end-to-end tests: the built single file in headless Chromium opened from file:// with every
// non-local request aborted, plus the hosted site over HTTP (service worker, offline reload).
// Run: node tools/build.js && node tools/build-site.js && node --test tests/ui.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const T = path.join(__dirname, '..');
const URL = 'file://' + path.join(T, 'dist', 'eveniunt-tracker.html');
const NAMES = ['Alba Eveniunt', 'Brio Eveniunt', 'Cara Eveniunt', 'Dax Eveniunt', 'Eli Eveniunt', 'Fen Eveniunt', 'Gia Eveniunt', 'Hal Eveniunt'];

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 1000 } }, opts.context || {}));
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (/^(file|blob|data):/.test(u)) return r.continue(); external.push(u); return r.abort(); });
  await page.goto(URL);
  await page.waitForSelector('#dlg[open]', { timeout: 30000 });
  if (opts.setup !== false) await setup(page, opts.n || 8);
  return { ctx, page, errors, external };
}
async function setup(page, n) {
  await page.selectOption('#nchars', String(n));
  for (let i = 0; i < n; i++) await page.fill(`[data-name="${i}"]`, NAMES[i]);
  await page.click('#go');
  await page.waitForSelector('.ov-table');
}
// Live pages sit in dropdown folders of the side menu: open the folder, then click the link, as a person would
async function liveView(page, v) {
  await page.evaluate((x) => { const b = document.querySelector('#side [data-live-view="' + x + '"]'); const d = b && b.closest('details'); if (d) d.open = true; }, v);
  await page.click('#side [data-live-view="' + v + '"]');
}
// lists open with every group closed; the tests open them all, as the "Open all" button does
const go = (page, sid) => page.evaluate((s) => { window.__tracker.setView('sec', s); window.__tracker.openAll(); }, sid);
// "done / total" for a character in the open list, read from the column header the user sees
const tally = (page, c) => page.evaluate((cid) => {
  const i = window.__tracker.ST.chars.findIndex((x) => x.id === cid);
  const cell = document.querySelectorAll('#lh .c')[i];
  const m = cell && cell.getAttribute('title').match(/: (\d+) of (\d+)$/);
  return m ? m[1] + ' / ' + m[2] : null;
}, c);

test('first run: choose 1 to 8 characters, names shown as columns with their progress; nothing goes online', async () => {
  const { ctx, page, errors, external } = await open({ setup: false });
  assert.match(await page.textContent('#dlg'), /up to eight characters/i);
  await setup(page, 8);
  await go(page, 'mounts');
  await page.waitForSelector('.er');
  const heads = await page.$$eval('#lh .c', (els) => els.map((e) => e.getAttribute('title').split(':')[0]));
  assert.deepEqual(heads, NAMES);
  // opened from disk there is no shell to go back to: no Command Center link and no hand-over notice (gate 1D)
  assert.equal(await page.$('a[data-cc-back]'), null); assert.equal(await page.$('[data-handover]'), null);
  assert.equal(await page.locator('#lh .c .pc').count(), 8);
  assert.deepEqual(errors, []);
  assert.deepEqual(external.filter((u) => !/ffxivcollect|google/.test(u)), [], 'no unexpected network requests');
  await ctx.close();
});

test('ticking, the X availability switch both ways, and per-character "does not apply"', async () => {
  const { ctx, page, errors } = await open({ n: 3 });
  await go(page, 'mounts');
  const before = await tally(page, 'c1');
  const total0 = Number(before.split('/')[1]);
  // tick the first counted mount for character 1
  const counted = page.locator('.er:not(.x)').first();
  const key = await counted.getAttribute('data-k');
  await counted.locator('.tk[data-c="c1"]').click();
  assert.equal(await tally(page, 'c1'), '1 / ' + total0);
  // open the row and mark it unobtainable: it leaves the count (and its tick with it)
  await page.locator(`.er[data-k="${key}"] .c0`).click();
  await page.locator(`.det[data-det="${key}"] [data-x]`).click();
  assert.equal(await tally(page, 'c1'), '0 / ' + (total0 - 1));
  assert.ok(await page.locator(`.er[data-k="${key}"]`).evaluate((e) => e.classList.contains('x')));
  // the pill on an entry that is not counted counts it again
  const xrow = page.locator('.er.x').nth(1);
  await xrow.locator('.pill').click();
  assert.equal(await tally(page, 'c1'), '0 / ' + total0);
  // "does not apply" for character 2 only
  await page.click('[data-mode="na"]');
  await page.waitForSelector('.mode-note');
  const other = page.locator('.er:not(.x)').nth(2);
  await other.locator('.tk[data-c="c2"]').click();
  assert.equal(await tally(page, 'c2'), '0 / ' + (total0 - 1));
  assert.equal(await tally(page, 'c3'), '0 / ' + total0);
  await page.click('[data-mode="tick"]');
  // the state survives a reload (IndexedDB)
  await page.waitForTimeout(700);
  await page.reload(); await page.waitForSelector('.page');
  await go(page, 'mounts');
  assert.equal(await tally(page, 'c2'), '0 / ' + (total0 - 1));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('left click marks done, right click (or a long press) marks does not apply, a second click clears either', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  await go(page, 'mounts');
  const total0 = Number((await tally(page, 'c1')).split('/')[1]);
  const box = page.locator('.er:not(.x)').first().locator('.tk[data-c="c1"]');
  const state = () => box.evaluate((b) => (b.classList.contains('on') ? 'done' : b.classList.contains('na') ? 'na' : 'none'));
  await box.click();
  assert.equal(await state(), 'done'); assert.equal(await tally(page, 'c1'), '1 / ' + total0);
  await box.click({ button: 'right' });
  assert.equal(await state(), 'none'); assert.equal(await tally(page, 'c1'), '0 / ' + total0);
  await box.click({ button: 'right' });
  assert.equal(await state(), 'na'); assert.equal(await tally(page, 'c1'), '0 / ' + (total0 - 1));
  await box.click({ button: 'right' });
  assert.equal(await state(), 'none'); assert.equal(await tally(page, 'c1'), '0 / ' + total0);
  await box.click({ button: 'right' }); await box.click();
  assert.equal(await state(), 'none', 'a left click clears does not apply too');
  // touch: press and hold marks does not apply; the click that follows the hold is ignored
  await box.dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true });
  await page.waitForTimeout(700);
  await box.dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true });
  await box.click();
  assert.equal(await state(), 'na');
  assert.equal(await tally(page, 'c2'), '0 / ' + total0, 'other characters untouched');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('group header ticks a whole group for one character; level fields tick at the cap', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  await go(page, 'emotes');
  const g = page.locator('.lgroup').first();
  const n = await g.locator('.er:not(.x)').count();
  await g.locator('.gh .c[data-gc="c2"]').click();
  assert.equal(await g.locator('.er:not(.x) .tk.on[data-c="c2"]').count(), n);
  assert.equal(await g.locator('.tk.on[data-c="c1"]').count(), 0);
  await go(page, 'levels');
  const lv = page.locator('.lvl[data-c="c1"]').first();
  await lv.fill('90'); await lv.dispatchEvent('change');
  assert.equal(await tally(page, 'c1'), '0 / 34'); // 33 jobs plus Beastmaster (7.56)
  await page.locator('.lvl[data-c="c1"]').first().fill('100'); await page.locator('.lvl[data-c="c1"]').first().dispatchEvent('change');
  assert.equal(await tally(page, 'c1'), '1 / 34');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('clearing a whole group from its header asks first and can be undone', async () => {
  const { ctx, page, errors } = await open({ n: 1 });
  const dialogs = []; page.on('dialog', (d) => dialogs.push(d.message()));
  await page.evaluate(() => { window.__tracker.ST.settings.links = false; });
  await go(page, 'orchestrion');
  // the largest group (groups are split by expansion, so pick one with more than 25 rows)
  const sizes = await page.locator('.lgroup').evaluateAll((gs) => gs.map((g) => g.querySelectorAll('.er:not(.x)').length));
  const g = page.locator('.lgroup').nth(sizes.indexOf(Math.max(...sizes)));
  const n = await g.locator('.er:not(.x)').count();
  assert.ok(n > 25);
  await g.locator('.gh .c[data-gc="c1"]').click();
  assert.equal(await g.locator('.er:not(.x) .tk.on[data-c="c1"]').count(), n);
  assert.match(dialogs[dialogs.length - 1], /Tick all/);
  await g.locator('.gh .c[data-gc="c1"]').click();
  assert.match(dialogs[dialogs.length - 1], /Clear all \d+ ticks/, 'clearing is confirmed');
  assert.equal(await g.locator('.er:not(.x) .tk.on[data-c="c1"]').count(), 0);
  await page.waitForSelector('#toast .toast-btn');
  await page.click('#toast .toast-btn');
  assert.equal(await g.locator('.er:not(.x) .tk.on[data-c="c1"]').count(), n, 'Undo puts the ticks back');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('lists are grouped (never one flat list) and every list renders', async () => {
  const { ctx, page, errors } = await open({ n: 1 });
  const ids = await page.evaluate(() => window.__tracker.IDX.sections.map((s) => [s.id, s.groups.length, s.groups.reduce((a, g) => a + g.keys.length, 0)]));
  for (const [id, groups, n] of ids) if (n > 60) assert.ok(groups > 1, id + ' has ' + n + ' entries in one group');
  for (const [id] of ids) { await go(page, id); await page.waitForSelector('.lr.lh'); }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('search across everything, and the menu follows the game (Character, Duty, Logs, Travel, Social)', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  assert.deepEqual(await page.$$eval('.nav-menu > h3', (h) => h.map((x) => x.firstChild.textContent)), ['Live', 'Character', 'Duty', 'Logs', 'Travel', 'Social']);
  // every menu, Travel and Social included, groups its lists in dropdown folders (no loose links)
  assert.equal(await page.locator('.nav-menu > .nav-link').count(), 0);
  assert.deepEqual(await page.$$eval('.nav-menu', (ms) => ms.slice(4).map((m) => [...m.querySelectorAll('.nav-folder > summary .nm')].map((x) => x.textContent))), [['Aetherytes and Flying', 'Mounts and Porters'], ['Emotes']]);
  // the Live menu has dropdown folders like the others, with every Live page in one of them
  assert.ok(await page.locator('.nav-live > .nav-folder').count() >= 4);
  assert.equal(await page.locator('.nav-live [data-live-view]').count(), 17);
  // A to Z by default: folders, the lists in each folder, and the entries in each group
  // expansions first in release order, then everything else A to Z
  const XP = ['a realm reborn', 'heavensward', 'stormblood', 'shadowbringers', 'endwalker', 'dawntrail', 'evercold'];
  const xr = (t) => { t = t.toLowerCase(); let best = -1, at = Infinity; XP.forEach((x, i) => { const p = t.indexOf(x); if (p >= 0 && p < at) { at = p; best = i; } }); return best; };
  const cmp = (a, b) => { const x = xr(a), y = xr(b); if (x >= 0 && y >= 0 && x !== y) return x - y; if ((x >= 0) !== (y >= 0)) return x >= 0 ? -1 : 1; return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); };
  const sorted = (a) => [...a].sort(cmp);
  assert.deepEqual(await page.$$eval('.nav-folder', (fs) => { const f = fs.find((x) => /Main Scenario/.test(x.querySelector('summary').textContent)); return [...f.querySelectorAll('.nav-link .nm')].map((x) => x.textContent); }), ['A Realm Reborn', 'Heavensward', 'Stormblood', 'Shadowbringers', 'Endwalker', 'Dawntrail'], 'expansions in release order');
  const folders = await page.$$eval('.nav-menu', (ms) => ms.map((m) => [...m.querySelectorAll(':scope > .nav-folder > summary .nm')].map((x) => x.textContent)));
  folders.forEach((f) => assert.deepEqual(f, sorted(f)));
  const lists = await page.$$eval('.nav-folder', (fs) => fs.map((f) => [...f.querySelectorAll('.nav-link .nm')].map((x) => x.textContent)));
  lists.forEach((l) => assert.deepEqual(l, sorted(l)));
  await go(page, 'mounts'); await page.waitForSelector('.er');
  const names = () => page.$$eval('.lgroup', (gs) => [...gs[0].querySelectorAll('.er .nm')].map((x) => x.textContent));
  const first = await names(); assert.ok(first.length > 5); assert.deepEqual(first, sorted(first));
  await page.evaluate(() => { window.__tracker.ST.settings.gameOrder = true; window.__tracker.render(); });
  assert.notDeepEqual(await names(), first, 'the game order is one switch away');
  await page.evaluate(() => { window.__tracker.ST.settings.gameOrder = false; window.__tracker.render(); });
  await page.fill('#q', 'coeurl');
  await page.waitForSelector('text=“coeurl”');
  assert.ok(await page.locator('.er').count() >= 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('desktop-app import: ticks, X marks and levels land in the chosen column; the report lists the rest', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  const save = {
    version: '1.0.5', 'starting-class': '', custom: {}, 'bookmarked-groups': [], 'bookmarked-tasks': [],
    overall: {
      character: { 'mount-guide': { 1: 'Y', 6: 'Y' }, character: { 'classes--jobs': { 0: '100', 1: '90' } } },
      duty: { quest: { 'main-scenario': { x: { 65621: 'X' } } }, squadron: { squadron: { 0: 'Y' } } },
      travel: { porters: { 'la-noscea': { 0: 'Y' } } },
    },
  };
  const file = path.join(require('os').tmpdir(), 'Test Hero (World) - FFXIV Completionist.json');
  fs.writeFileSync(file, JSON.stringify(save));
  await page.click('[data-act=settings]'); await page.click('[data-tab=data]');
  await page.setInputFiles('#desk-files', file);
  await page.selectOption('[data-file="0"]', 'c2');
  await page.click('#do-import');
  await page.waitForSelector('text=Import finished');
  const txt = await page.textContent('#dlg');
  assert.match(txt, /Test Hero: 3 of 4 ticks imported/);
  assert.match(txt, /1 “does not apply”/);
  assert.match(txt, /Squadron/);
  const st = await page.evaluate(() => { const s = window.__tracker.ST; return { name: s.chars[1].name, t: Object.keys(s.ticks.c2).sort(), e: Object.keys(s.excl.c2), v: s.vals.c2, c1: Object.keys(s.ticks.c1).length }; });
  assert.equal(st.name, 'Test Hero');
  // the imported ticks, plus what they prove (the level achievements of a level 100 paladin and level 90 warrior)
  for (const k of ['levels:1', 'mounts:1', 'mounts:6', 'porters:1']) assert.ok(st.t.includes(k), k);
  // mount 6 is the Magitek Armor, which only the quest "The Ultimate Weapon" gives: that quest (and the story before
  // it) is proven too
  const twu = await page.evaluate(() => [...window.__tracker.IDX.byKey].find(([k, h]) => h.e.n === 'The Ultimate Weapon' && k.startsWith('quests-msq-'))[0]);
  assert.ok(st.t.includes(twu));
  assert.match(txt, /more ticked by links/);
  assert.deepEqual(st.e, ['quests-msq-arr:65621']);
  assert.deepEqual(st.v, { 'levels:1': 100, 'levels:2': 90 });
  assert.equal(st.c1, 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('transfer code round trip through the interface', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  await go(page, 'minions');
  await page.locator('.er:not(.x) .tk[data-c="c2"]').first().click();
  await page.click('[data-act=settings]'); await page.click('[data-tab=data]');
  await page.click('#make-code');
  await page.waitForFunction(() => document.querySelector('#code').value.startsWith('EVT2-'));
  const code = await page.inputValue('#code');
  const p2 = await open({ setup: false });
  await setup(p2.page, 1);
  await p2.page.click('[data-act=settings]'); await p2.page.click('[data-tab=data]');
  await p2.page.fill('#code', code); await p2.page.click('#read-code');
  await p2.page.waitForFunction(() => window.__tracker.ST.chars.length === 2);
  assert.equal(await p2.page.evaluate(() => Object.keys(window.__tracker.ST.ticks.c2).length), 1);
  assert.deepEqual(errors, []); assert.deepEqual(p2.errors, []);
  await ctx.close(); await p2.ctx.close();
});

// Owner's choice (2026-11-10): on a phone the eight columns overlapped; a bar of names at the top picks the one
// character shown, with one tap, kept on the device. A wide screen keeps every column and shows no bar.
test('phone: one character at a time, picked from the names bar at the top; the computer keeps every column', async () => {
  const { ctx, page, errors } = await open({ context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } });
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.lr.lh')[0].querySelectorAll('.c')].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.textContent));
  assert.deepEqual(await page.locator('#charbar button').allTextContents(), NAMES, 'every character in the bar, full names');
  assert.equal(await page.locator('#charbar button.on').textContent(), NAMES[0]);
  await go(page, 'minions'); await page.waitForSelector('.er');
  assert.equal((await shown()).length, 1, 'one column in the list');
  assert.match((await shown())[0], /Alba/, 'its real name, not a number');
  const visibleTicks = () => page.evaluate(() => [...document.querySelectorAll('.er .tk')].filter((b) => b.offsetParent !== null).map((b) => b.dataset.c));
  assert.ok((await visibleTicks()).every((c) => c === 'c1'));
  // a tap on a name switches, with no trip to Settings
  await page.click('#charbar button:has-text("Cara Eveniunt")');
  assert.equal(await page.locator('#charbar button.on').textContent(), 'Cara Eveniunt');
  assert.ok((await visibleTicks()).every((c) => c === 'c3'));
  const k = await page.locator('.er:not(.x) .tk[data-c="c3"]:not(.on)').first().getAttribute('data-k');
  await page.locator('.er:not(.x) .tk[data-c="c3"][data-k="' + k + '"]').click();
  assert.equal(await page.evaluate((key) => !!window.__tracker.ST.ticks.c3[key] && !window.__tracker.ST.ticks.c1[key], k), true, 'the tick lands on the chosen character');
  // big enough to tap, nothing overlaps, no sideways scroll
  const box = await page.locator('.er .tk[data-c="c3"]').first().boundingBox();
  assert.ok(box.width >= 30 && box.height >= 30, JSON.stringify(box));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 390);
  // the choice is kept on the device
  await page.reload(); await page.waitForSelector('#charbar button.on');
  assert.equal(await page.locator('#charbar button.on').textContent(), 'Cara Eveniunt');
  // a wide screen: no bar, every column
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(300);
  assert.equal(await page.locator('#charbar button').count(), 0);
  assert.equal(await page.evaluate(() => [...document.querySelector('.lr.lh').querySelectorAll('.c')].filter((c) => getComputedStyle(c).display !== 'none').length), 8);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('phone width: no sideways scroll on the overview, a long list or settings', async () => {
  const { ctx, page, errors } = await open({ context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } });
  const sw = () => page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(await sw() <= 390, 'overview ' + await sw());
  await go(page, 'quests-side-arr'); await page.waitForSelector('.er');
  assert.ok(await sw() <= 390, 'list ' + await sw());
  await page.click('[data-act=drawer]'); await page.waitForTimeout(250);
  assert.ok(await page.locator('.side').evaluate((e) => e.getBoundingClientRect().left >= 0));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await page.click('[data-act=settings]'); await page.click('[data-tab=look]');
  assert.ok(await sw() <= 390, 'settings ' + await sw());
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('all 21 themes (the Atelier\'s 20 and Solution Nine), light and dark: readable text, readable dropdowns, distinct accent', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  await go(page, 'mounts');
  // Drive the real Appearance settings: open the theme menu and pick each theme in each mode.
  await page.click('[data-act=settings]'); await page.click('[data-tab=look]');
  const names = [];
  for (const mode of ['light', 'dark']) {
    await page.click(`[data-look="mode"][data-v="${mode}"]`);
    await page.click('[data-look="toggle"][data-v="shared:theme"]');
    const ids = await page.$$eval('[data-look="theme"]', (b) => b.map((x) => x.dataset.v));
    assert.equal(ids.length, 21);
    assert.ok(ids.includes('electrope-skyline'), 'the Solution Nine theme (Electrope Skyline) is offered');
    const labels = await page.$$eval('[data-look="theme"]', (b) => b.map((x) => x.textContent.replace(/^Aa|✓$/g, '').trim()));
    assert.deepEqual(labels, labels.slice().sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), 'themes listed alphabetically');
    for (const id of ids) {
      if (!(await page.locator('[data-look="theme"]').count())) await page.click('[data-look="toggle"][data-v="shared:theme"]');
      await page.click(`[data-look="theme"][data-v="${id}"]`);
      const m = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const hex = (v) => { v = v.trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); };
        const L = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const paper = hex(cs.getPropertyValue('--paper')), ink = hex(cs.getPropertyValue('--ink')), seal = hex(cs.getPropertyValue('--seal'));
        const sel = document.createElement('select'); sel.innerHTML = '<option>Option</option>'; document.body.appendChild(sel); const so = getComputedStyle(sel.options[0]); setTimeout(() => sel.remove());
        const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
        return { text: cr(paper, ink), accent: cr(paper, seal), select: cr(rgb(so.backgroundColor), rgb(so.color)) };
      });
      names.push(mode + ':' + id);
      assert.ok(m.text >= 7, `${mode} ${id}: text contrast ${m.text.toFixed(2)}`);
      assert.ok(m.accent >= 3, `${mode} ${id}: accent contrast ${m.accent.toFixed(2)}`);
      assert.ok(m.select >= 7, `${mode} ${id}: dropdown contrast ${m.select.toFixed(2)}`);
    }
  }
  assert.equal(names.length, 42);
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--lb-b').length > 0), true, 'wordmark coloured by the theme');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('data counts match the pinned sheets and FFXIV Collect where they overlap', async () => {
  const data = JSON.parse(fs.readFileSync(path.join(T, 'data', 'tracker-data.json'), 'utf8'));
  const n = (id) => data.sections.find((s) => s.id === id).g.reduce((a, g) => a + g.e.length, 0);
  const ach = data.sections.filter((s) => s.id.startsWith('ach-')).reduce((a, s) => a + s.g.reduce((b, g) => b + g.e.length, 0), 0);
  assert.deepEqual({ mounts: n('mounts'), orchestrion: n('orchestrion'), cards: n('cards'), bluemagic: n('bluemagic'), facewear: n('facewear'), fashion: n('fashion'), barding: n('barding'), titles: n('titles'), ach },
    { mounts: 369, orchestrion: 886, cards: 475, bluemagic: 124, facewear: 61, fashion: 52, barding: 107, titles: 885, ach: 4000 });
  // 356 collectable mounts (FFXIV Collect) plus 13 quest-vehicle mounts kept with the "no longer obtainable" mark
  const mounts = data.sections.find((s) => s.id === 'mounts').g.flatMap((g) => g.e);
  assert.equal(mounts.filter((e) => e.x === 'gone').length, 13);
  assert.equal(data.sections.reduce((a, s) => a + s.g.reduce((b, g) => b + g.e.length, 0), 0) > 41000, true);
  // content added after the checklist's 7.45 edition, appended from the game data (7.57h1)
  const late = {};
  for (const s of data.sections) for (const g of s.g) for (const e of g.e) if ((e.d || '').includes("Added after the checklist's 7.45 edition")) late[s.id] = (late[s.id] || 0) + 1;
  assert.deepEqual(late, { plate: 76, portraits: 98, phantomjobs: 8, collection: 29, ocevents: 15, ocduties: 2, relicweapons: 42, relictools: 33, fishingspots: 1, levels: 1, oclevel: 20 });
  // custom deliveries (one per client, rank 5 is complete) and cosmic exploration (missions by planet and class; records)
  assert.deepEqual({ deliveries: n('deliveries'), missions: n('cosmicmissions'), records: n('cosmicrecords') }, { deliveries: 12, missions: 1699, records: 244 });
  const dl = data.sections.find((s) => s.id === 'deliveries').g[0].e;
  assert.ok(dl.some((e) => e.n === 'Tiisol Ja' && e.max === 5 && e.unit === 'rank'));
  assert.deepEqual([...new Set(data.sections.find((s) => s.id === 'cosmicmissions').g.map((g) => g.t.split(':')[0]))], ['Sinus Ardorum', 'Phaenna', 'Oizys', 'Auxesia']);
  const ids = (id) => data.sections.find((s) => s.id === id).g.flatMap((g) => g.e.map((e) => e.i));
  for (const s of data.sections) assert.equal(new Set(ids(s.id)).size, ids(s.id).length, s.id + ' has repeated ids');
});

test('hosted site over HTTP: installable, works offline after the first visit', async () => {
  const SITE = path.join(T, 'site');
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]).replace(/^\/tracker\//, '/');
    let f = path.join(SITE, u.endsWith('/') ? u + 'index.html' : u);
    if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(f)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/tracker/`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await ctx.route(/ffxivcollect|google/, (r) => r.abort());
  await page.goto(base);
  await page.waitForSelector('#dlg[open]', { timeout: 30000 });
  await setup(page, 2);
  assert.ok(await page.evaluate(() => !!document.querySelector('link[rel=manifest]')));
  // gate 1D: the way back to the Command Center (the site root) and the one-time hand-over notice, since this page was
  // not opened from the shell; "Got it" records it on the device for both apps and the notice stays away
  const root = base.replace(/tracker\/$/, ''); // the site root, where the shell lives
  assert.equal(await page.getAttribute('a[data-cc-back]', 'href'), root, 'the header link points at the shell');
  assert.match(await page.textContent('[data-handover]'), /The Tracker is now part of the Eveniunt Command Center[\s\S]*same save/);
  assert.equal(await page.getAttribute('[data-handover] a.btn', 'href'), root);
  await page.click('[data-handover-ok]');
  assert.equal(await page.$('[data-handover]'), null);
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('eveniunt-command-center-device')).handoverSeen > 0));
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }); });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.ov-table', { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__tracker.ST.chars.length), 2, 'offline reload keeps the characters');
  assert.equal(await page.$('[data-handover]'), null, 'seen once, not shown again');
  assert.equal(await page.getAttribute('a[data-cc-back]', 'href'), root, 'the way back stays');
  const coop = await page.evaluate(() => self.crossOriginIsolated);
  assert.equal(coop, false, 'no cross-origin isolation (Google sign-in needs popups)');
  assert.deepEqual(errors, []);
  await ctx.close(); server.close();
});

test('hosted site: cloud sync signs in once through Microsoft and the helper, then syncs by itself; sign-out and an ended sign-in ask for one tap (gate 1E)', async () => {
  const SITE = path.join(T, 'site');
  const { create } = require('./standins.js');
  let standins = null;
  const server = http.createServer(async (req, res) => {
    if (standins && await standins.handle(req, res)) return;
    const u = decodeURIComponent(req.url.split('?')[0]).replace(/^\/tracker\//, '/');
    let f = path.join(SITE, u.endsWith('/') ? u + 'index.html' : u);
    if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }[path.extname(f)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`; standins = create(origin);
  const base = origin + '/tracker/';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await ctx.route((u) => !u.href.startsWith(origin), (r) => r.abort());
  try {
  await page.goto(base);
  await page.waitForSelector('#dlg[open]', { timeout: 30000 });
  await setup(page, 1);
  const k = await page.evaluate(() => { const s = window.__tracker.IDX.sections.find((x) => x.id === 'mounts'); return ET.sectionKeys(s)[0]; });
  await page.evaluate((key) => { ET.setTick(window.__tracker.ST, 'c1', key, true); ET.saveState(window.__tracker.ST, true); }, k);
  // not signed in: the panel says so and offers Microsoft's sign-in; nothing has reached the helper or OneDrive
  await page.evaluate(() => window.__tracker.openSettings('cloud'));
  await page.waitForSelector('#sync-in');
  assert.match(await page.textContent('#dlg'), /This device is not signed in/);
  assert.equal(standins.kv.size, 0); assert.equal(standins.state.files.f1, undefined);
  // one tap: Microsoft's sign-in page (the stand-in answers at once), back through oauth.html, the helper, then a sync
  await page.click('#sync-in');
  await page.waitForFunction(() => /Synced \d/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
  assert.equal(page.url(), base, 'back on the Tracker after the round trip');
  assert.equal(standins.kv.size, 1, 'the helper holds one device');
  assert.ok(standins.state.files.f1, 'the cloud copy was created');
  const device = await page.evaluate(() => JSON.parse(localStorage.getItem('eveniunt-cloud-device')).device);
  assert.match(device, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(await page.evaluate(() => ET.exportFile(window.__tracker.ST))).includes(device), 'the device handle is never in a backup');
  assert.ok(!(await page.evaluate(async () => (await CC.read()).raw ? JSON.stringify((await CC.read()).raw) : '')).includes(device), 'nor in the one save');
  // a new sitting: the tab's key is gone, the device is known; the Tracker syncs by itself with no page change
  await page.evaluate(() => sessionStorage.clear());
  const grantsBefore = standins.state.log.length;
  await page.reload(); await page.waitForSelector('.ov-table');
  await page.waitForFunction(() => /Synced \d/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
  assert.equal(page.url(), base);
  assert.deepEqual(standins.state.log.slice(grantsBefore), ['refresh_token'], 'one quiet renewal through the helper, no sign-in page');
  await page.evaluate(() => window.__tracker.openSettings('cloud'));
  assert.match(await page.textContent('#dlg'), /This device is signed in[\s\S]*syncs by itself/);
  // the other device changed the copy: the next automatic sync takes the change
  const other = JSON.parse(JSON.stringify(await page.evaluate(() => ET.portable(window.__tracker.ST))));
  await page.evaluate(() => window.__tracker.closeDialog());
  other.chars[0].name = 'Renamed elsewhere'; other.updated = Date.now() + 5;
  standins.state.files.f1 = Object.assign({ app: 'eveniunt-completionist-tracker', v: 1 }, other); standins.state.etag.f1 = 'e-other';
  await page.evaluate(() => window.__tracker.syncCloud(true));
  await page.waitForFunction(() => window.__tracker.ST.chars[0].name === 'Renamed elsewhere', null, { timeout: 30000 });
  // the sign-in ended on Microsoft's side (revoked): the helper forgets the device and the Tracker asks for one tap
  standins.state.revoked = true;
  await page.evaluate(() => sessionStorage.clear());
  await page.reload(); await page.waitForSelector('.ov-table');
  await page.waitForFunction(() => /tap to sign in/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('eveniunt-cloud-device')), null, 'the device record is gone');
  assert.equal(standins.kv.size, 0);
  // signing in again works; signing out on this device forgets it at the helper and nothing syncs until the next tap
  standins.state.revoked = false;
  await page.evaluate(() => window.__tracker.openSettings('cloud')); await page.click('#sync-in');
  await page.waitForFunction(() => /Synced \d/.test(((document.querySelector('#sync-state') || {}).textContent || '')), null, { timeout: 30000 });
  assert.equal(standins.kv.size, 1);
  await page.evaluate(() => window.__tracker.openSettings('cloud')); await page.click('#sync-out');
  await page.waitForFunction(() => /Signed out on this device/.test(((document.querySelector('#sync-state') || {}).textContent || '')));
  assert.equal(standins.kv.size, 0);
  assert.deepEqual(errors, []);
  } finally { await ctx.close(); server.close(); }
});

test('starting class greys out the other cities’ opening quests; Grand Company the other companies’ quests', async () => {
  const { ctx, page, errors } = await open({ setup: false });
  await page.selectOption('#nchars', '3');
  await page.fill('[data-name="0"]', 'Lim Starter'); await page.selectOption('[data-cls="0"]', 'mrd'); await page.selectOption('[data-gcs="0"]', '1');
  await page.fill('[data-name="1"]', 'Gri Starter'); await page.selectOption('[data-cls="1"]', 'cnj');
  await page.fill('[data-name="2"]', 'No Class Yet');
  await page.click('#go'); await page.waitForSelector('.ov-table');
  await go(page, 'quests-msq-arr'); await page.waitForSelector('.er');
  const st = await page.evaluate(() => {
    const T = window.__tracker, ET = globalThis.ET, keys = T.IDX.sections.find((s) => s.id === 'quests-msq-arr').groups.flatMap((g) => g.keys);
    const gri = keys.find((k) => T.IDX.byKey.get(k).e.city === 'gri'), lim = keys.find((k) => T.IDX.byKey.get(k).e.city === 'lim');
    const cell = (k, c) => document.querySelector(`.tk[data-k="${k}"][data-c="${c}"]`).classList.contains('na');
    const t = ET.tally(T.IDX, T.ST, keys);
    return { griForLim: cell(gri, 'c1'), griForGri: cell(gri, 'c2'), limForGri: cell(lim, 'c2'), griForNone: cell(gri, 'c3'), totals: [t.totals.c1, t.totals.c2, t.totals.c3] };
  });
  assert.deepEqual([st.griForLim, st.griForGri, st.limForGri, st.griForNone], [true, false, true, false]);
  assert.ok(st.totals[0] < st.totals[2] && st.totals[1] < st.totals[2], 'city quests leave the totals: ' + st.totals);
  // clicking a greyed box explains instead of ticking
  const gk = await page.evaluate(() => { const T = window.__tracker; return T.IDX.sections.find((s) => s.id === 'quests-msq-arr').groups.flatMap((g) => g.keys).find((k) => T.IDX.byKey.get(k).e.city === 'gri'); });
  await page.locator(`.tk[data-k="${gk}"][data-c="c1"]`).click();
  assert.match(await page.textContent('#toast'), /another starting city/);
  assert.equal(await page.evaluate((k) => !!window.__tracker.ST.ticks.c1[k], gk), false);
  // Grand Company: another company's quest does not apply to a Maelstrom character
  const gc = await page.evaluate(() => { const T = window.__tracker, ET = globalThis.ET; for (const [k, h] of T.IDX.byKey) if (h.e.gc === 2 && h.s.id.startsWith('quests-')) return ET.notApplicable(T.ST, T.ST.chars[0], k, h.e); return 'none found'; });
  assert.equal(gc, 'gc');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---------------------------------------------------------------- red-team fixes (2026-11-08)
test('red team: a crafted backup loaded through the page runs no script and adds no markup', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  const evil = JSON.stringify({ app: 'eveniunt-completionist-tracker', state: { v: 1,
    chars: [{ id: 'c1', name: '<img src=x onerror="window.__pwned=1">', city: '"><img src=x onerror="window.__pwned=2">' }, { id: 'c2', name: 'B' }],
    ticks: { c1: {}, c2: {} }, vals: { c1: { 'levels:1': '"><img src=x onerror="window.__pwned=3">' } } } });
  const file = path.join(T, 'dist', 'evil-backup.json');
  fs.writeFileSync(file, evil);
  try {
    await page.click('text=Settings'); await page.click('[data-tab="data"]');
    await page.setInputFiles('#load-file', file);
    await page.waitForFunction(() => window.__tracker.ST.chars[1].name === 'B');
    for (const v of ['levels', 'mounts']) { await go(page, v); await page.waitForSelector('.er'); }
    await page.click('text=Settings'); await page.click('[data-tab="chars"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    assert.equal(await page.locator('img[src="x"]').count(), 0);
  } finally { fs.unlinkSync(file); }
  assert.deepEqual(errors.filter((e) => !/ERR_FAILED|net::/.test(e)), []);
  await ctx.close();
});

test('first run cannot be dismissed by clicking outside the window (the page would be empty)', async () => {
  const { ctx, page } = await open({ setup: false });
  await page.mouse.click(5, 5);
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#dlg[open]').count());
  await ctx.close();
});

test('saved data that cannot be read is offered for download, not overwritten', async () => {
  const { ctx, page } = await open({ n: 1 });
  // since gate 1C the data lives in the Command Center's one save: damage the Tracker's section there
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('eveniunt-command-center', 1); r.onsuccess = () => { const t = r.result.transaction('save', 'readwrite'); const s = t.objectStore('save'); const g = s.get('main'); g.onsuccess = () => { const d = g.result; d.modules.tracker.ticks = 'broken'; s.put(d, 'main'); }; t.oncomplete = res; }; }));
  await page.reload();
  await page.waitForSelector('#dl-bad');
  assert.match(await page.textContent('#dlg'), /could not be read/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dl-bad')]);
  assert.match(await fs.promises.readFile(await dl.path(), 'utf8'), /broken/);
  const kept = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('eveniunt-command-center', 1); r.onsuccess = () => { const q = r.result.transaction('save').objectStore('save').getAllKeys(); q.onsuccess = () => res(q.result); }; }));
  assert.ok(kept.some((k) => String(k).startsWith('main-unreadable-')), 'a rescue copy is kept');
  await page.click('#go-on');
  await page.waitForSelector('#nchars');
  await ctx.close();
});

test('two windows of the tracker: a tick in one shows in the other, never overwritten by the older copy', async () => {
  const { ctx, page } = await open({ n: 2 });
  const other = await ctx.newPage();
  other.on('dialog', (d) => d.accept());
  await other.goto(URL); await other.waitForSelector('.ov-table');
  await go(page, 'mounts'); await go(other, 'mounts');
  await page.waitForSelector('.er');
  const box = page.locator('.er:not(.x)').first().locator('.tk[data-c="c1"]');
  const key = await page.locator('.er:not(.x)').first().getAttribute('data-k');
  await box.click();
  await other.waitForFunction((k) => !!window.__tracker.ST.ticks.c1[k], key, { timeout: 5000 });
  // the second window now ticks something else; the first window's tick survives in storage (links off here, so
  // the counts below are exactly the two ticks)
  await other.waitForSelector('.er');
  await other.evaluate(() => { window.__tracker.ST.settings.links = false; });
  await other.locator('.er:not(.x)').nth(1).locator('.tk[data-c="c2"]').click();
  await page.waitForTimeout(900);
  await page.reload(); await page.waitForSelector('.page');
  const st = await page.evaluate(() => window.__tracker.ST);
  assert.ok(st.ticks.c1[key], 'first tick kept');
  assert.equal(Object.keys(st.ticks.c2).length, 1, 'second tick kept');
  await ctx.close();
});

test('two windows ticking within the same moment: both ticks are kept and both windows show them', async () => {
  const { ctx, page } = await open({ n: 1 });
  const other = await ctx.newPage();
  other.on('dialog', (d) => d.accept());
  await other.goto(URL); await other.waitForSelector('.ov-table');
  for (const p of [page, other]) await p.evaluate(() => { window.__tracker.ST.settings.links = false; });
  await go(page, 'mounts'); await go(other, 'mounts');
  await page.waitForSelector('.er'); await other.waitForSelector('.er');
  const k1 = await page.locator('.er:not(.x)').nth(0).getAttribute('data-k');
  const k2 = await other.locator('.er:not(.x)').nth(1).getAttribute('data-k');
  // each window ticks before the other's save (400 ms after a tick) has run
  await page.locator('.er:not(.x)').nth(0).locator('.tk[data-c="c1"]').click();
  await page.waitForTimeout(150);
  await other.locator('.er:not(.x)').nth(1).locator('.tk[data-c="c1"]').click();
  await page.waitForTimeout(2500);
  for (const p of [page, other]) {
    const t = await p.evaluate(() => window.__tracker.ST.ticks.c1);
    assert.ok(t[k1] && t[k2], 'this window shows both ticks');
  }
  await page.reload(); await page.waitForSelector('.page');
  const t = await page.evaluate(() => window.__tracker.ST.ticks.c1);
  assert.ok(t[k1] && t[k2], 'both ticks saved');
  await ctx.close();
});

test('expansion headings above groups fold away; resting the pointer on a name opens its information window', async () => {
  const { ctx, page, errors } = await open({ n: 1 });
  await page.evaluate(() => window.__tracker.setView('sec', 'ach-battle'));
  const heads = await page.locator('.gx .t').allInnerTexts();
  assert.deepEqual(heads, ['A Realm Reborn', 'Heavensward', 'Stormblood', 'Shadowbringers', 'Endwalker', 'Dawntrail']);
  const before = await page.locator('.lgroup').count();
  await page.locator('.gx .c0').first().click();
  assert.ok(await page.locator('.lgroup').count() < before, 'folding an expansion hides its groups');
  await page.evaluate(() => { window.__tracker.setView('sec', 'quests-side-hw'); window.__tracker.openAll(); });
  await page.waitForSelector('.er .nm');
  await page.locator('.er .c0 .nm').nth(3).hover();
  await page.waitForSelector('#tip:not(.hidden)', { timeout: 5000 });
  const tip = await page.locator('#tip').innerText();
  assert.match(tip, /Starts with /);
  assert.match(tip, /Level \d+/);
  assert.equal(await page.locator('#tip a').count(), 0, 'no links out: the information is in the window itself');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a list opens with every group closed; a group header opens it; Open all and Close all; find shows matches', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  await page.evaluate(() => window.__tracker.setView('sec', 'mounts'));
  const groups = await page.locator('.lgroup').count();
  assert.ok(groups > 1);
  assert.equal(await page.locator('.lgroup.folded').count(), groups);
  assert.equal(await page.locator('.er').count(), 0, 'no rows until a group is opened');
  await page.locator('.lgroup .gh .c0').first().click();
  assert.equal(await page.locator('.lgroup.folded').count(), groups - 1);
  assert.ok(await page.locator('.er').count() > 0);
  await page.click('[data-openall="1"]');
  assert.equal(await page.locator('.lgroup.folded').count(), 0);
  await page.click('[data-openall="0"]');
  assert.equal(await page.locator('.lgroup.folded').count(), groups);
  await page.fill('#find', 'chocobo');
  await page.waitForFunction(() => document.querySelectorAll('.er').length > 0);
  // entering another list starts closed again
  await page.evaluate(() => window.__tracker.setView('sec', 'minions'));
  assert.equal(await page.locator('.er').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('links: ticking a quest ticks what it proves, says so with Undo, explains it in the details; the switch turns it off', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  // set character 1's starting class and Grand Company, so the main story reaches its own city's opening quests
  await page.evaluate(() => { const t = window.__tracker; ET.setStart(t.ST, 'c1', 'cnj', 2); t.render(); });
  await go(page, 'quests-msq-arr');
  const key = await page.evaluate(() => [...window.__tracker.IDX.byKey].find(([k, h]) => h.e.n === 'The Ultimate Weapon' && k.startsWith('quests-msq-'))[0]);
  await page.locator(`.er[data-k="${key}"] .tk[data-c="c1"]`).click();
  await page.waitForSelector('#toast .toast-btn');
  assert.match(await page.textContent('#toast'), /Also ticked for Alba Eveniunt: .* and \d+ more/);
  const n = await page.evaluate(() => Object.keys(window.__tracker.ST.ticks.c1).length);
  assert.ok(n > 150, 'the whole main story before it: ' + n);
  assert.equal(await page.evaluate(() => Object.keys(window.__tracker.ST.ticks.c2).length), 0, 'only that character');
  // Undo removes what the links added, and keeps the tick itself
  await page.click('#toast .toast-btn');
  assert.deepEqual(await page.evaluate(() => Object.keys(window.__tracker.ST.ticks.c1)), [key]);
  // the details explain the links
  await page.locator(`.er[data-k="${key}"] .c0`).click();
  assert.match(await page.textContent(`.det[data-det="${key}"]`), /Ticking it also ticks:/);
  // switched off: a tick is just a tick
  await page.evaluate(() => { window.__tracker.ST.settings.links = false; });
  const prev = await page.evaluate((k) => { const t = window.__tracker; const h = [...t.IDX.byKey].find(([x, v]) => v.e.n === 'Operation Archon' && x.startsWith('quests-msq-')); return h[0]; }, key);
  await page.locator(`.er[data-k="${prev}"] .tk[data-c="c2"]`).click();
  assert.deepEqual(await page.evaluate(() => Object.keys(window.__tracker.ST.ticks.c2)), [prev]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('links: Settings fills in what existing ticks prove, with a preview and Undo', async () => {
  const { ctx, page, errors } = await open({ n: 1 });
  const ach = await page.evaluate(() => {
    const t = window.__tracker;
    const k = [...t.IDX.byKey].find(([x, h]) => h.e.n === 'The Ultimate Weapon' && x.startsWith('quests-msq-'))[0];
    t.ST.ticks.c1[k] = 1; t.render(); return k;
  });
  await page.click('text=Settings'); await page.click('[data-tab="count"]');
  await page.click('#fill-links');
  await page.waitForSelector('#do-fill');
  assert.match(await page.textContent('#dlg'), /entries would be ticked/);
  await page.click('#do-fill');
  await page.waitForSelector('#toast .toast-btn');
  assert.ok(await page.evaluate(() => Object.keys(window.__tracker.ST.ticks.c1).length) > 100);
  await page.click('#toast .toast-btn');
  assert.deepEqual(await page.evaluate(() => Object.keys(window.__tracker.ST.ticks.c1)), [ach]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('clock and weather: Eorzea and local time in the header, weather for every zone, entries open right now highlighted', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  assert.match(await page.textContent('#clock'), /ET \d\d:\d\d/);
  await page.click('#clock');
  assert.ok((await page.locator('.wx-row').count()) >= 80, 'a weather row for every zone');
  for (const z of ['Eureka Anemos', 'Zadnor', 'South Horn', 'Middle La Noscea']) assert.ok(await page.locator('.wx-row .wx-z', { hasText: z }).count(), z);
  // the formula: weather is fixed for each 8 Eorzea hours and follows the zone's table
  const same = await page.evaluate(() => { const t = Date.now() - (Date.now() % 1400000); const ids = Array.from(document.querySelectorAll('.wx-row .wx.now')).map((x) => x.textContent); return ids.every(Boolean); });
  assert.ok(same, 'every zone shows a current weather');
  await go(page, 'sightseeing');
  await page.waitForTimeout(5500);
  assert.ok((await page.locator('.er.timed').count()) >= 80, 'vistas with a time or weather are tracked live');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('live pages: Up Now, Big Fish, Ocean Fishing, Timers, Field Monsters, Gold Saucer and Notifications render; settings stay', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  for (const v of ['now', 'bigfish', 'ocean', 'timers', 'weather', 'field', 'gold', 'notify']) {
    await liveView(page, v);
    assert.ok((await page.textContent('#page')).length > 500, v + ' has content');
  }
  await liveView(page, 'bigfish');
  assert.equal(await page.locator('.bf-row').count(), 335, 'every big fish on the board');
  await page.check('[data-live="legendary"]');
  assert.equal(await page.locator('.bf-row').count(), 36, 'legendary filter');
  await page.locator('.bf-row [data-ltick]').first().click();
  assert.match(await page.locator('.bf-row [data-ltick]').first().textContent(), /Caught/);
  await page.locator('.bf-row [data-watch]').first().click();
  await liveView(page, 'ocean');
  assert.equal(await page.locator('.of-voy').count(), 12, '12 voyages');
  await liveView(page, 'now');
  await page.check('[data-live="hide"]');
  await liveView(page, 'notify');
  await page.check('[data-notify="on"]');
  assert.ok(await page.locator('#page .lv-row').count() >= 1, 'the watched fish is listed');
  await page.reload(); await page.waitForSelector('.side .nav-live');
  assert.ok(await page.evaluate(() => window.__tracker.UI.live.notify.on && window.__tracker.UI.live.hide && window.__tracker.UI.live.watch.length === 1), 'Live settings survive a reload');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('more live pages: dailies count and clear, S ranks, island planner, PvP series, leveling, Jumbo Cactpot by data center', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  await liveView(page, 'dailies');
  const cell = page.locator('[data-dl$="|mini-cactpot"]').first();
  await cell.click(); await cell.click();
  assert.match(await page.locator('[data-dl$="|mini-cactpot"]').first().textContent(), /2\/3/);
  await liveView(page, 'srank');
  assert.equal(await page.locator('.bf-row.sr').count(), 50, 'every S rank');
  await liveView(page, 'island');
  assert.match(await page.textContent('#page'), /Best agenda: [\d,]+ cowries per workshop/);
  await liveView(page, 'pvp');
  assert.ok(await page.locator('#page .lv-row').count() >= 30);
  await liveView(page, 'leveling');
  assert.match(await page.textContent('#page'), /Cosmic Exploration/);
  await liveView(page, 'timers');
  await page.selectOption('[data-live="dc"]', 'Dynamis');
  assert.match(await page.textContent('#page'), /North America/);
  await page.click('[data-act="home"]');
  assert.match(await page.textContent('#page'), /Achievement points/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hunts, Market Board, Housing and News: windows from kills, spawn maps, prices and plots; only the named sites are asked', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage(); const errors = [], external = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept('100'));
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (/^(file|blob|data):/.test(u)) return r.continue();
    external.push(u.split("/")[2]);
    const m = u.match(/universalis\.app\/api\/v2\/North-America\/([\d,]+)/);
    if (m) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ itemID: +m[1], lastUploadTime: Date.now(), regularSaleVelocity: 2, listings: [{ pricePerUnit: 1234, hq: false, worldName: 'Hyperion' }], recentHistory: [{ pricePerUnit: 1000 }] }) });
    if (/paissadb\.zhu\.codes\/worlds\/411$/.test(u)) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 411, name: 'Golem', num_open_plots: 1, districts: [{ id: 339, name: 'Mist', num_open_plots: 1, open_plots: [{ ward_number: 0, plot_number: 0, size: 2, price: 40000000, purchase_system: 5, lotto_phase: 1, lotto_entries: 2, last_updated_time: Date.now() / 1000 }] }] }) });
    return r.abort();
  });
  await page.goto(URL); await page.waitForSelector('#dlg[open]'); await setup(page, 2);
  await liveView(page, 'hunts');
  assert.match(await page.textContent('#page'), /Choose your data center/);
  await page.selectOption('[data-live="dc"]', 'Dynamis'); await page.selectOption('[data-live="world"]', 'Golem');
  assert.equal(await page.locator('.hn-row').first().locator('.hn-chip').count(), 32, 'every North American world');
  await page.click('[data-hkill="Ihnuxokiy"]');
  assert.equal(await page.locator('.hn-row').filter({ hasText: 'Ihnuxokiy' }).locator('.hn-chip.closed').count(), 1, 'the kill shows on its world only');
  assert.match(await page.textContent('.hn-row.closed'), /Ihnuxokiy[\s\S]*Closed[\s\S]*opens in/);
  await page.click('[data-hkill-at="Sansheya"]'); // 100 minutes ago: still closed
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('eveniunt-tracker-hunts')); s.kills.Golem.Sansheya = Date.now() - 100 * 3600000; localStorage.setItem('eveniunt-tracker-hunts', JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector('.lv-tabs');
  assert.match(await page.textContent('.hn-row.open'), /Sansheya[\s\S]*Open[\s\S]*% through/, 'killed 100 h ago: window open (84 to 132 h)');
  await page.click('[data-hmap="Sansheya"]');
  const before = await page.locator('.hn-map circle:not(.done)').count();
  await page.click('.hn-map circle >> nth=0');
  assert.equal(await page.locator('.hn-map circle:not(.done)').count(), before - 1, 'a checked spawn point');
  assert.equal(await page.locator('.hn-row').filter({ hasText: 'Ttokrrone' }).count(), 1, 'world boss FATE for the expansion');
  await liveView(page, 'market');
  await page.fill('[data-mbq]', 'iron ingot'); await page.waitForTimeout(500);
  await page.click('[data-mbadd] >> nth=0'); await page.waitForSelector('.mb-row');
  await page.waitForFunction(() => /1,234 gil Hyperion \(Primal\)/.test(document.querySelector('.mb-row').textContent));
  await liveView(page, 'housing');
  await page.waitForSelector('.hs-row');
  assert.match(await page.textContent('.hs-row'), /^11Large40,000,000 gilIndividualsTaking entries · 2 entries/);
  await liveView(page, 'news');
  assert.match(await page.textContent('#page'), /hosted tracker/);
  assert.deepEqual([...new Set(external)].sort(), ['paissadb.zhu.codes', 'universalis.app']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The owner's case (2026-11-10): this version opened first on a blank save and moved it; a Tracker tab from before the
// update, open in the same browser, then saved real characters to the old place. The next load brings them in.
test('catch-up: what an old Tracker tab saved after the move arrives on the next load (IndexedDB), once', async () => {
  const { ctx, page, errors } = await open({ setup: false });
  const putOld = (names, later) => page.evaluate(([n, l]) => new Promise((res) => {
    const ET = window.ET, keys = window.__tracker.IDX.sections.flatMap((s) => ET.sectionKeys(s));
    const st = ET.newState(n);
    if (l) { st.chars.forEach((c, i) => { for (let k = i; k < 400; k += 5) st.ticks[c.id][keys[k]] = 1; }); st.updated = Date.now() + 1000; }
    const r = indexedDB.open('eveniunt-tracker', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => { const t = r.result.transaction('state', 'readwrite'); t.objectStore('state').put(st, 'main'); t.oncomplete = () => { r.result.close(); res(JSON.stringify(st)); }; };
  }), [names, later]);
  await putOld(['Character 1', 'Character 2', 'Character 3'], false);
  await page.reload(); await page.waitForSelector('.ov-table');
  assert.deepEqual(await page.evaluate(() => window.__tracker.ST.chars.map((c) => c.name)), ['Character 1', 'Character 2', 'Character 3'], 'moved while still blank');
  const oldJson = await putOld(['Alba', 'Brio'], true); // the old tab, still open, saves real characters
  await page.reload(); await page.waitForSelector('.ov-table');
  assert.deepEqual(await page.evaluate(() => window.__tracker.ST.chars.map((c) => c.name)), ['Alba', 'Brio']);
  assert.equal(await page.evaluate((j) => window.ET.compareTracker(window.ET.validateState(JSON.parse(j)), window.__tracker.ST), oldJson), null, 'every tick arrived');
  assert.match(await page.textContent('body'), /Brought in what an older Tracker window saved/);
  // once: a tick removed now is still removed after the next load
  const key = await page.evaluate(() => { const T = window.__tracker, k = Object.keys(T.ST.ticks.c1)[0]; window.ET.setTick(T.ST, 'c1', k, false); return window.ET.saveState(T.ST, true).then(() => k); });
  await page.reload(); await page.waitForSelector('.ov-table');
  assert.equal(await page.evaluate((k) => !!window.__tracker.ST.ticks.c1[k], key), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('gate 1C: an existing save is copied into the one save (IndexedDB), the old save stays untouched, and the way back works', async () => {
  const { ctx, page, errors, external } = await open({ setup: false });
  // today's save, as the version before gate 1C kept it: IndexedDB eveniunt-tracker → state → main
  const oldJson = await page.evaluate(() => new Promise((res) => {
    const ET = window.ET, keys = window.__tracker.IDX.sections.flatMap((s) => ET.sectionKeys(s));
    const st = ET.newState(['Alba', 'Brio', 'Cara', 'Dax', 'Eli', 'Fen', 'Gia', 'Hal']);
    st.chars.forEach((c, n) => { c.lodestone = String(20000000 + n); c.gc = (n % 3) + 1; c.cls = ['gla', 'pgl', 'mrd', 'lnc', 'arc', 'cnj', 'thm', 'acn'][n]; for (let i = n; i < keys.length; i += 4) st.ticks[c.id][keys[i]] = 1; st.excl[c.id][keys[n + 7]] = 1; });
    const r = indexedDB.open('eveniunt-tracker', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => { const t = r.result.transaction('state', 'readwrite'); t.objectStore('state').put(st, 'main'); t.objectStore('state').put('r-old', 'main-rev'); t.oncomplete = () => { r.result.close(); res(JSON.stringify(st)); }; };
  }));
  await page.reload();
  await page.waitForSelector('.ov-table');
  // expected: the old save after the Tracker's usual start-up step (ticks under an old entry id or on another class
  // route move to the current entry), which runs on every load, before and after gate 1C alike
  const same = () => page.evaluate((j) => { const o = window.ET.validateState(JSON.parse(j)); window.ET.migrateAliases(window.__tracker.IDX, o); return window.ET.compareTracker(o, window.__tracker.ST); }, oldJson);
  const got = await page.evaluate(() => ({ moved: window.__tracker.ST.moved.tracker, ticks: Object.values(window.__tracker.ST.ticks).reduce((n, t) => n + Object.keys(t).length, 0) }));
  assert.equal(await same(), null, 'all 8 characters arrive exactly (characters, ticks, marks, levels, choices, settings)');
  assert.ok(got.ticks > 8000, got.ticks + ' ticks');
  assert.equal(got.moved.from, 'indexeddb'); assert.equal(got.moved.check.chars, 8);
  const readOld = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('eveniunt-tracker'); r.onsuccess = () => { const s = r.result.transaction('state').objectStore('state'); const a = s.get('main'), b = s.get('main-rev'), k = s.getAllKeys(); a.transaction.oncomplete = () => { r.result.close(); res({ main: JSON.stringify(a.result), rev: b.result, keys: k.result }); }; }; }));
  const old1 = await readOld();
  assert.equal(old1.main, oldJson, 'the old save is untouched'); assert.equal(old1.rev, 'r-old'); assert.deepEqual(old1.keys.sort(), ['main', 'main-rev']);
  // the panel offers the way back; a new tick, then going back, restores the save from before the move
  await go(page, 'minions');
  await page.locator('.er:not(.x) .tk[data-c="c1"]:not(.on)').first().click();
  await page.click('[data-act=settings]'); await page.click('[data-tab=data]');
  assert.match(await page.textContent('#dlg'), /Your shared save[\s\S]*8 characters/);
  await Promise.all([page.waitForEvent('load'), page.click('#move-back')]);
  await page.waitForFunction(() => window.__tracker && window.__tracker.ST && !document.getElementById('boot')); // reopens on the list it was on
  assert.equal(await same(), null, 'back to the save from before the move');
  await page.click('[data-act=settings]'); await page.click('[data-tab=data]');
  await page.click('#move-ok');
  await page.waitForFunction(() => window.__tracker.ST.moved.tracker.confirmed && /You confirmed it/.test(document.querySelector('#dlg').textContent)); // shown once saved
  assert.equal((await readOld()).main, oldJson, 'still untouched');
  // characters with a Lodestone number start the usual online refresh, which this test blocks: that is the only error
  assert.deepEqual(errors.filter((e) => !/net::ERR_FAILED/.test(e)), []);
  assert.ok(external.every((u) => /ffxivcollect\.com/.test(u)), external.join(' '));
  await ctx.close();
});
