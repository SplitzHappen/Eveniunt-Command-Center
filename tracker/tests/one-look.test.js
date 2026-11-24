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
