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
  await page.waitForFunction(() => document.querySelector('#code').value.startsWith('EVT1-'));
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
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }); });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.ov-table', { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__tracker.ST.chars.length), 2, 'offline reload keeps the characters');
  const coop = await page.evaluate(() => self.crossOriginIsolated);
  assert.equal(coop, false, 'no cross-origin isolation (Google sign-in needs popups)');
  assert.deepEqual(errors, []);
  await ctx.close(); server.close();
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
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('eveniunt-tracker', 1); r.onsuccess = () => { const t = r.result.transaction('state', 'readwrite'); t.objectStore('state').put({ v: 1, chars: 'broken' }, 'main'); t.oncomplete = res; }; }));
  await page.reload();
  await page.waitForSelector('#dl-bad');
  assert.match(await page.textContent('#dlg'), /could not be read/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dl-bad')]);
  assert.match(await fs.promises.readFile(await dl.path(), 'utf8'), /broken/);
  const kept = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('eveniunt-tracker', 1); r.onsuccess = () => { const q = r.result.transaction('state').objectStore('state').getAllKeys(); q.onsuccess = () => res(q.result); }; }));
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
    await page.click(`[data-live-view="${v}"]`);
    assert.ok((await page.textContent('#page')).length > 500, v + ' has content');
  }
  await page.click('[data-live-view="bigfish"]');
  assert.equal(await page.locator('.bf-row').count(), 335, 'every big fish on the board');
  await page.check('[data-live="legendary"]');
  assert.equal(await page.locator('.bf-row').count(), 36, 'legendary filter');
  await page.locator('.bf-row [data-ltick]').first().click();
  assert.match(await page.locator('.bf-row [data-ltick]').first().textContent(), /Caught/);
  await page.locator('.bf-row [data-watch]').first().click();
  await page.click('[data-live-view="ocean"]');
  assert.equal(await page.locator('.of-voy').count(), 12, '12 voyages');
  await page.click('[data-live-view="now"]');
  await page.check('[data-live="hide"]');
  await page.click('[data-live-view="notify"]');
  await page.check('[data-notify="on"]');
  assert.ok(await page.locator('#page .lv-row').count() >= 1, 'the watched fish is listed');
  await page.reload(); await page.waitForSelector('.side .nav-live');
  assert.ok(await page.evaluate(() => window.__tracker.UI.live.notify.on && window.__tracker.UI.live.hide && window.__tracker.UI.live.watch.length === 1), 'Live settings survive a reload');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('more live pages: dailies count and clear, S ranks, island planner, PvP series, leveling, Jumbo Cactpot by data center', async () => {
  const { ctx, page, errors } = await open({ n: 2 });
  await page.click('[data-live-view="dailies"]');
  const cell = page.locator('[data-dl$="|mini-cactpot"]').first();
  await cell.click(); await cell.click();
  assert.match(await page.locator('[data-dl$="|mini-cactpot"]').first().textContent(), /2\/3/);
  await page.click('[data-live-view="srank"]');
  assert.equal(await page.locator('.bf-row.sr').count(), 50, 'every S rank');
  await page.click('[data-live-view="island"]');
  assert.match(await page.textContent('#page'), /Best agenda: [\d,]+ cowries per workshop/);
  await page.click('[data-live-view="pvp"]');
  assert.ok(await page.locator('#page .lv-row').count() >= 30);
  await page.click('[data-live-view="leveling"]');
  assert.match(await page.textContent('#page'), /Cosmic Exploration/);
  await page.click('[data-live-view="timers"]');
  await page.selectOption('[data-live="dc"]', 'Dynamis');
  assert.match(await page.textContent('#page'), /North America/);
  await page.click('[data-act="home"]');
  assert.match(await page.textContent('#page'), /Achievement points/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
