'use strict';
// One look, step 2 (docs/one-look-foundation-spec.md): the shared stylesheet tracker/src/app/one-look.css.
// Static rules: every class is prefixed ol-, no global rules, no colour literal outside the token blocks, square corners,
// inset shadows only, none of the tokens applyLook sets. The three builds carry it. Run: node tests/one-look.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const T = path.join(__dirname, '..'), ROOT = path.join(T, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const SRC = read('tracker', 'src', 'app', 'one-look.css');

// top-level rules, with the rules inside @media blocks flattened: [{ sel, body, media }]
function rulesOf(css, media) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = []; let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith('@media')) out.push(...rulesOf(body, head)); else out.push({ sel: head, body, media: media || '' });
    i = j;
  }
  return out;
}
const RULES = rulesOf(SRC);
const isTokenBlock = (r) => r.sel === ':root' || r.sel === ':root[data-theme="dark"]';

test('the stylesheet exists and has rules', () => { assert.ok(RULES.length > 100, RULES.length + ' rules'); });

test('every selector starts with .ol- (or is :root), every class in it is prefixed, and there are no global rules', () => {
  for (const r of RULES) for (const s of r.sel.split(',').map((x) => x.trim())) {
    assert.ok(/^\.ol-/.test(s) || s === ':root' || s === ':root[data-theme="dark"]', 'selector not prefixed: ' + s);
    for (const c of s.match(/\.[A-Za-z_][\w-]*/g) || []) assert.ok(c.startsWith('.ol-'), 'class not prefixed: ' + c + ' in ' + s);
  }
});

test('no hex, rgb( or oklch( outside the two token blocks', () => {
  for (const r of RULES) if (!isTokenBlock(r)) assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(/.test(r.body), 'colour literal in ' + r.sel);
});

test('square corners and no drop shadows', () => {
  for (const r of RULES) {
    for (const m of r.body.matchAll(/border-radius\s*:\s*([^;]+)/g)) assert.equal(m[1].trim(), '0', 'radius in ' + r.sel);
    for (const m of r.body.matchAll(/box-shadow\s*:\s*([^;]+)/g)) assert.ok(/^inset\b/.test(m[1].trim()), 'outer shadow in ' + r.sel);
    assert.ok(!/text-shadow|drop-shadow/.test(r.body), 'shadow in ' + r.sel);
  }
});

test('it defines none of the tokens applyLook sets; the token blocks hold the layout, derived, font and state tokens', () => {
  const atelier = read('crafting', 'atelier', 'src', 'atelier.js');
  const set = new Set([...atelier.matchAll(/set\('(--[\w-]+)'/g)].map((m) => m[1]));
  assert.ok(set.has('--paper') && set.has('--seal') && set.size >= 15, 'read the applyLook tokens: ' + set.size);
  const defined = (r) => [...r.body.matchAll(/(?:^|[;\s])(--[\w-]+)\s*:/g)].map((m) => m[1]);
  for (const r of RULES) for (const d of defined(r)) {
    assert.ok(!set.has(d), 'defines a token applyLook sets: ' + d);
    if (!isTokenBlock(r)) assert.ok(/^--(f|g|s|w|on-f|hz)$/.test(d) || r.sel.startsWith('.ol-r-'), 'a token outside the token blocks and roles: ' + d + ' in ' + r.sel);
  }
  const root = RULES.find((r) => r.sel === ':root' && !r.media), dark = RULES.find((r) => r.sel === ':root[data-theme="dark"]');
  for (const t of ['--slant', '--line-2', '--line-dbl', '--line-row', '--leader', '--s1', '--s6', '--content', '--gut', '--slab', '--on-slab', '--on-slab-2', '--molten', '--hazard', '--f-disp', '--f-kick', '--f-serif', '--f-body', '--f-data', '--back', '--on-back', '--out', '--idle', '--bad', '--on-mid', '--lr-craft-fill', '--lr-short-fill'])
    assert.ok(defined(root).includes(t), 'missing in :root: ' + t);
  assert.ok(defined(dark).includes('--back') && defined(dark).includes('--on-mid'), 'dark state hues');
});

test('the shared parts are there', () => {
  for (const c of ['ol-lbl', 'ol-kick', 'ol-fig', 'ol-page', 'ol-r-back', 'ol-r-craft', 'ol-slab', 'ol-sb', 'ol-solid', 'ol-outline', 'ol-hatch', 'ol-done', 'ol-chap', 'ol-num', 'ol-sub', 'ol-sum', 'ol-closed', 'ol-subgroup', 'ol-ix', 'ol-fld', 'ol-sel', 'ol-chk', 'ol-step', 'ol-seal', 'ol-key', 'ol-btn-p', 'ol-btn-2', 'ol-btn-q', 'ol-seg'])
    assert.ok(new RegExp('\\.' + c + '(?![\\w-])').test(SRC), 'missing class ' + c);
  assert.ok(RULES.some((r) => r.media && /max-width:\s*700px/.test(r.media)), 'phone rules');
  assert.ok(!/data-heads|data-seal/.test(SRC), 'no caps variants');
});

test('the built Tracker and Atelier hold the stylesheet; the Command Center ships it and its three pages link it', () => {
  for (const f of [['tracker', 'dist', 'eveniunt-tracker.html'], ['crafting', 'atelier', 'dist', 'eveniunt-atelier.html']]) assert.ok(read(...f).includes(SRC), f.join('/') + ' lacks the stylesheet text');
  assert.equal(read('tracker', 'command-center', 'site', 'one-look.css'), SRC, 'site/one-look.css equals the source');
  for (const p of ['index.html', 'submersibles/index.html', 'lists/index.html']) assert.ok(/<link rel="stylesheet" href="(\.\.\/)?one-look\.css">/.test(read('tracker', 'command-center', 'site', ...p.split('/'))), p + ' does not link one-look.css');
  const order = (h) => [h.indexOf('shared.css'), h.indexOf('one-look.css'), h.indexOf('shell.css')];
  const h = read('tracker', 'command-center', 'site', 'index.html'), o = order(h);
  assert.ok(o[0] > 0 && o[0] < o[1] && o[1] < o[2], 'load order: shared.css, one-look.css, shell.css');
});

// ---- F3: the one header on every page ----
const PAGES = {
  'the Tracker (single file)': ['tracker', 'dist', 'eveniunt-tracker.html'], 'the Tracker (site)': ['tracker', 'site', 'index.html'],
  'the Atelier (single file)': ['crafting', 'atelier', 'dist', 'eveniunt-atelier.html'], 'the Atelier (site)': ['crafting', 'atelier', 'site', 'index.html'],
  'Home and Settings': ['tracker', 'command-center', 'site', 'index.html'], 'Submersibles': ['tracker', 'command-center', 'site', 'submersibles', 'index.html'], 'Lists': ['tracker', 'command-center', 'site', 'lists', 'index.html']
};
const count = (s, re) => (s.match(re) || []).length;

test('each built page holds exactly one shared header with one tool slot, no tag line and no old masthead', () => {
  for (const [name, f] of Object.entries(PAGES)) {
    const h = read(...f);
    assert.equal(count(h, /class="ol-hdr[ "]/g), 1, name + ': one class="ol-hdr"');
    assert.equal(count(h, /class="ol-tools[ "]/g), 1, name + ': one ol-tools');
    assert.equal(count(h, /class="ol-nav[ "]/g), 1, name + ': one ol-nav');
    assert.equal(count(h, /class="ol-mark"/g), 1, name + ': one wordmark');
    assert.ok(!/lb-tag/.test(h), name + ': no tag line');
    assert.ok(!/class="mast/.test(h) && !/<header class="([^"]* )?mast[ "]/.test(h), name + ': no old masthead');
    assert.ok(!/<!--\/?ol-header/.test(h), name + ': no marker left in the page');
    const hdr = h.slice(h.indexOf('<header class="ol-hdr'), h.indexOf('</header>'));
    assert.ok(!/[⚙☰⌂]/.test(hdr), name + ': no text symbol in the header');
    assert.ok(/mast-tools/.test(hdr), name + ': the tool slot keeps its hook class');
  }
});

test('the header carries the app pages with their hooks; the current one is marked; the Main menu is drawn where the page has no hosted-only code', () => {
  const nav = (h) => h.slice(h.indexOf('<nav class="ol-nav'), h.indexOf('</nav>', h.indexOf('<nav class="ol-nav')));
  for (const [name, f, here, menu] of [['Home', PAGES['Home and Settings'], 'home', true], ['Submersibles', PAGES.Submersibles, 'submersibles', true], ['Lists', PAGES.Lists, 'lists', true], ['Tracker', PAGES['the Tracker (single file)'], 'tracker', false], ['Atelier', PAGES['the Atelier (single file)'], 'atelier', false]]) {
    const h = read(...f), n = nav(h);
    assert.deepEqual([...n.matchAll(/data-module="(\w+)"/g)].map((m) => m[1]), ['home', 'tracker', 'atelier', 'submersibles', 'lists', 'settings'], name);
    assert.deepEqual([...n.matchAll(/data-module="(\w+)"[^>]*aria-current="page"/g)].map((m) => m[1]), [here], name + ': current page');
    assert.deepEqual([...n.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]), ['Home', 'Tracker', 'Atelier', 'Submersibles', 'Lists', 'Settings'], name + ': labels');
    assert.equal(/data-cc-back/.test(h.slice(h.indexOf('<header class="ol-hdr'), h.indexOf('</header>'))), menu && name !== 'Home', name + ': the Main menu link (not on Home) is in the markup only where static');
    assert.equal(/<nav class="ol-nav[^>]* hidden/.test(h), !menu, name + ': the nav is hidden where the hosted-only code shows it');
    assert.equal(/class="ol-menu[ "]/.test(h.slice(h.indexOf('<header class="ol-hdr'), h.indexOf('</header>'))), menu, name + ': Main menu in the markup');
  }
  assert.ok(/class="ol-menu" href=".\/" aria-current="page"/.test(read(...PAGES['Home and Settings'])), 'on Home the Main menu is the current page');
});

test('the header helper refuses a page without its marker and a header without its parts', () => {
  const H = require('../tools/one-look-header.js');
  assert.throws(() => H.fill('<p>no marker</p>'), /no marker/);
  assert.throws(() => H.fill('<!--ol-header word="X" here="home"-->x<!--/ol-header-->'), /missing/);
  const one = H.fill('<!--ol-header word="Market" here="none" home="../" href="./" menu="static"-->\n<b>tool</b>\n<!--/ol-header-->');
  assert.ok(/<b>tool<\/b><\/div><nav class="ol-nav/.test(one) && !/aria-current/.test(one.slice(one.indexOf('<nav'))), 'a new module gets the same header with no current page');
});

test('the old header rules are gone from the module sheets (the hooks that checks read stay)', () => {
  for (const f of [['tracker', 'src', 'app', 'shared.css'], ['tracker', 'src', 'app', 'tracker.css'], ['crafting', 'atelier', 'src', 'atelier.css'], ['tracker', 'command-center', 'src', 'shell.css'], ['tracker', 'command-center', 'src', 'submersibles', 'subs.css'], ['tracker', 'command-center', 'src', 'lists', 'lists.css']]) {
    const c = read(...f).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(count(c, /\{/g), count(c, /\}/g), f.join('/') + ': braces balance (a removed rule must not take a closing brace)');
    assert.ok(!/(^|[\s,{}])\.(mast|cc-mast|subs-mast|lists-mast|lb-tag|cc-menu-link|mast-tools)\b/m.test(c), f.join('/') + ' still styles the old header');
  }
});
