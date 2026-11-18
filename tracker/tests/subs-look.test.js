'use strict';
// Submersibles look (docs/submersibles-look-spec.md, W1): contrast of the module's status and chart colours in all 21
// themes, light and dark. Theme rows come from command-center/site/look.js; the shared tokens are resolved as applyLook()
// does at contrast 50; the module's own tokens are read out of src/submersibles/subs.css.
// Run: node --test tests/subs-look.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CC = path.join(__dirname, '..', 'command-center');
const lookSrc = fs.readFileSync(path.join(CC, 'site', 'look.js'), 'utf8');
const css = fs.readFileSync(path.join(CC, 'src', 'submersibles', 'subs.css'), 'utf8');

const themesText = lookSrc.slice(lookSrc.indexOf('var THEMES = [') + 'var THEMES = '.length, lookSrc.indexOf('];', lookSrc.indexOf('var THEMES = [')) + 1);
const THEMES = new Function('return ' + themesText)();

const accText = lookSrc.slice(lookSrc.indexOf('var ACCENTS = [') + 'var ACCENTS = '.length);
const ACCENTS = new Function('return ' + accText.slice(0, accText.indexOf('];') + 1))();
const hexRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rnd = (r) => r.map((x) => Math.max(0, Math.min(255, Math.round(x))));
const mixRgb = (a, b, t) => rnd(a.map((x, i) => x + (b[i] - x) * t)); // applyLook's mix(), rounded to bytes
const lum = (r) => { const c = r.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// the declarations of one rule, by its exact selector text
function block(selector) {
  const i = css.indexOf('\n' + selector + ' {');
  const start = i >= 0 ? i + 1 : (css.startsWith(selector + ' {') ? 0 : -1);
  assert.ok(start >= 0, 'rule not found in subs.css: ' + selector);
  const open = css.indexOf('{', start), close = css.indexOf('}', open);
  const out = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const RULES = {
  light: block(':root'),
  dark: block(':root[data-theme="dark"]'),
  chartLight: block('.map-panel'),
  chartDark: block(':root[data-theme="dark"] .map-panel')
};

function splitTop(s) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}
// a colour expression -> [r, g, b]; color-mix(in srgb, ...) is a per-channel mix
function colour(expr, env) {
  expr = expr.trim();
  if (/^#[0-9a-f]{6}$/i.test(expr)) return hexRgb(expr);
  if (expr === 'white') return [255, 255, 255];
  let m = /^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/.exec(expr);
  if (m) {
    if (m[1] in env) return Array.isArray(env[m[1]]) ? env[m[1]] : colour(env[m[1]], env);
    assert.ok(m[2], 'unresolved ' + m[1]);
    return colour(m[2], env);
  }
  m = /^color-mix\(in srgb,(.*)\)$/s.exec(expr);
  if (m) {
    const [a, b] = splitTop(m[1]);
    const pa = /^(.*?)\s+([\d.]+)%$/.exec(a), pb = /^(.*?)\s+([\d.]+)%$/.exec(b);
    const p = pa ? +pa[2] / 100 : pb ? 1 - +pb[2] / 100 : 0.5;
    const ca = colour(pa ? pa[1] : a, env), cb = colour(pb ? pb[1] : b, env);
    return ca.map((x, i) => x * p + cb[i] * (1 - p));
  }
  throw new Error('cannot read colour: ' + expr);
}

// the shared tokens at contrast 50 (k = 1), as applyLook() sets them
function shared(row, mode) {
  const [bgH, fgH, acH, pgH] = mode === 'dark' ? row[3] : row[2];
  const bg = hexRgb(bgH), fg = hexRgb(fgH), ac = hexRgb(acH), pg = hexRgb(pgH);
  const dk = lum(bg) < lum(fg);
  return {
    dk,
    env: {
      '--paper': bg, '--paper-2': mixRgb(bg, fg, 0.05), '--paper-3': mixRgb(bg, fg, 0.1),
      '--slip': mixRgb(bg, dk ? fg : [255, 255, 255], dk ? 0.07 : 0.6),
      '--ink': fg, '--ink-2': mixRgb(fg, bg, 0.32), '--ink-3': mixRgb(fg, bg, 0.5), '--seal': ac, '--ochre': pg
    }
  };
}

const stat = {}; // pair -> { min, where }
const note = (pair, r, where) => { if (!stat[pair] || r < stat[pair].min) stat[pair] = { min: r, where }; };
const failures = [], chartFailures = [];
function need(pair, fg, bg, min, where) {
  const r = ratio(fg, bg);
  note(pair, r, where);
  if (r < min) (pair.startsWith('chart-') ? chartFailures : failures).push(pair + ' ' + r.toFixed(2) + ' < ' + min + ' in ' + where);
}

// One computation, two tests, so a failing chart pair does not hide the status pairs (or the other way round).
test('module tokens: status pairs and errors reach their contrast in all 21 themes', () => {
  assert.equal(THEMES.length, 21);
  for (const row of THEMES) {
    for (const mode of ['light', 'dark']) {
      const { dk, env: base } = shared(row, mode);
      const ac = hexRgb((mode === 'dark' ? row[3] : row[2])[2]);
      const where = row[0] + ' ' + mode;
      const tokens = Object.assign({}, dk ? RULES.dark : RULES.light);
      const env = Object.assign({}, base, tokens);
      const c = (n) => colour('var(' + n + ')', env);
      for (const k of ['back', 'out', 'idle']) {
        need('on-' + k + ' on ' + k, c('--on-' + k), c('--' + k), 4.5, where);
        need(k + ' on slip (edge, 3:1)', c('--' + k), c('--slip'), 3, where);
        // W3: the Board's row tints carry the row's text and its status edge
        need('ink on ' + k + '-bg (row text)', c('--ink'), c('--' + k + '-bg'), 4.5, where);
        need(k + ' on ' + k + '-bg (row edge, 3:1)', c('--' + k), c('--' + k + '-bg'), 3, where);
        note('ink-2 on ' + k + '-bg (shared ink, printed)', ratio(c('--ink-2'), c('--' + k + '-bg')), where);
      }
      // --on-seal: the shared token applyLook() picks through onSeal(), taken from the built look.js
      need('on-seal on seal (shared; primary buttons and .quick)', hexRgb(onSeal(ac)), c('--seal'), 4.5, where);
      // Revision 2 (W13): the inverted slab, the bar field and the card wash. The --back-bg pair above reads the new 16% value.
      need('on-slab on slab (slab text)', c('--on-slab'), c('--slab'), 4.5, where);
      need('on-slab-2 on slab (slab, secondary)', c('--on-slab-2'), c('--slab'), 4.5, where);
      need('ink on bar (figures on a bar)', c('--ink'), c('--bar'), 4.5, where);
      need('ink on hi-slip (text on the --hi wash)', c('--ink'), c('--hi-slip'), 4.5, where);
      note('ink-2 on bar (shared ink, printed)', ratio(c('--ink-2'), c('--bar')), where);
      note('ink-2 on hi-slip (shared ink, printed)', ratio(c('--ink-2'), c('--hi-slip')), where);
      need('bad on slip', c('--bad'), c('--slip'), 4.5, where);
      need('bad on paper', c('--bad'), c('--paper'), 4.5, where);
      // Revision 2 (W15, W16): labels and kickers in the sheet and the tables sit on the slip, the sector names on the paper, the Log's row hover on paper-2
      need('ink-2 on slip (labels, kickers, table heads)', c('--ink-2'), c('--slip'), 4.5, where);
      need('ink-2 on paper (sector rank line)', c('--ink-2'), c('--paper'), 4.5, where);
      need('ink on paper-2 (Log row hover)', c('--ink'), c('--paper-2'), 4.5, where);
      note('ink-2 on paper-2 (printed; the Log row uses --ink there)', ratio(c('--ink-2'), c('--paper-2')), where);
      for (let sea = 1; sea <= 7; sea++) {
        const cenv = Object.assign({}, env, dk ? RULES.chartDark : RULES.chartLight, { '--sea': env['--sea-' + sea] });
        const w = where + ' sea ' + sea;
        const cc = (n) => colour('var(' + n + ')', cenv);
        for (const bgName of ['--chart-bg', '--chart-bg-2']) {
          for (const k of ['--chart-ink', '--chart-found', '--chart-next', '--chart-hot']) need(k.slice(2) + ' on ' + bgName.slice(2), cc(k), cc(bgName), 4.5, w);
          need('chart-far on ' + bgName.slice(2), cc('--chart-far'), cc(bgName), 3, w);
        }
      }
    }
  }
  const rows = Object.entries(stat).map(([k, v]) => '  ' + k.padEnd(34) + v.min.toFixed(2).padStart(6) + '  lowest at ' + v.where);
  console.log('Contrast, lowest ratio per pair (21 themes x light/dark, chart pairs x 7 seas):\n' + rows.join('\n'));
  assert.deepEqual(failures.slice(0, 20), [], failures.length + ' pairs under their ratio');
});

test('module tokens: chart pairs reach their contrast in all 21 themes, both modes and 7 seas', () => {
  assert.deepEqual(chartFailures.slice(0, 20), [], chartFailures.length + ' chart pairs under their ratio');
});

test('the old fixed colours are gone from subs.css', () => {
  for (const bad of ['#c0392b', '#06210f;', '#2a1800;']) {
    // the dark pair values are the new tokens; only the literal old error red and stray #fff may not remain outside the token blocks
    if (bad === '#c0392b') assert.ok(!css.includes(bad));
  }
  const body = css.split('\n').filter((l) => !l.startsWith(':root') && !l.includes(':root:not([data-theme="light"])') && !l.startsWith('.map-panel')).join('\n');
  assert.ok(!/#fff\b/i.test(body));
});

// W12: the text colour on the accent, taken out of the built look.js with its own lum()
const fn = (name) => { const i = lookSrc.indexOf('function ' + name + '('); assert.ok(i >= 0, 'no ' + name + '() in look.js'); return lookSrc.slice(i, lookSrc.indexOf('\n', i)); };
const { lum: lumB, onSeal } = new Function(fn('lum') + '\n' + fn('onSeal') + '\nreturn { lum: lum, onSeal: onSeal };')();
const oldRule = (ac) => (lumB(ac) > 0.42 ? '#111111' : '#ffffff');

test('on-seal on seal reaches 4.5:1 for the 21 themes, the preset accents and a sweep of accents', () => {
  const bad = [], changed = [];
  const chk = (ac, where) => { const col = onSeal(ac); if (ratio(hexRgb(col), ac) < 4.5) bad.push(where + ' ' + col); return col; };
  for (const row of THEMES) for (const mode of ['light', 'dark']) {
    const ac = hexRgb((mode === 'dark' ? row[3] : row[2])[2]);
    const col = chk(ac, row[0] + ' ' + mode);
    if (col !== oldRule(ac)) changed.push(row[0] + ' ' + mode + ' ' + oldRule(ac) + ' -> ' + col);
  }
  const presets = ACCENTS.filter((a) => a[2]);
  assert.equal(presets.length, 7);
  for (const a of presets) { chk(hexRgb(a[2]), a[0] + ' light'); chk(hexRgb(a[3]), a[0] + ' dark'); }
  let n = 0;
  for (let r = 0; r <= 255; r += 15) for (let g = 0; g <= 255; g += 15) for (let b = 0; b <= 255; b += 15) {
    const ac = [r, g, b], col = onSeal(ac); n++;
    assert.ok(['#ffffff', '#111111', '#000000'].includes(col), 'one of the three colours');
    if (ratio([255, 255, 255], ac) >= 4.5) assert.equal(col, '#ffffff', 'white whenever it reaches 4.5:1: ' + ac);
    chk(ac, 'rgb(' + ac + ')');
  }
  assert.equal(n, 18 * 18 * 18);
  assert.deepEqual(bad, []);
  console.log('Pairs whose on-seal colour differs from the old rule (' + changed.length + '):\n  ' + changed.join('\n  '));
});

test('the three built files carry onSeal() and not the old rule', () => {
  for (const f of [path.join(CC, 'site', 'look.js'), path.join(__dirname, '..', 'dist', 'eveniunt-tracker.html'), path.join(__dirname, '..', '..', 'crafting', 'atelier', 'dist', 'eveniunt-atelier.html')]) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(t.includes('function onSeal('), f + ' has onSeal()');
    assert.ok(!t.includes('> 0.42 ?'), f + ' has no old rule');
  }
});
