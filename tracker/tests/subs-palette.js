'use strict';
// Loader for the palette tests (docs/submersibles-look-spec.md, W22 and "W22b decisions"). The palette itself is computed by
// src/submersibles/palette.js, the one script the page loads too; this file only gives it the theme rows (command-center/site/look.js,
// resolved as applyLook() does at contrast 50) and reads the fallback tokens out of src/submersibles/subs.css. Used by
// tests/subs-look.test.js and, as palette(), by the checks.
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
// colours inside the model are unrounded sRGB (0 to 255, possibly outside it); a contrast is measured on the painted bytes
const ratio = (a, b) => { const x = lum(rnd(a)), y = lum(rnd(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---- OKLab (CSS Color 4 / Ottosson matrices) ----
const toLin = (v) => { v /= 255; const s = v < 0 ? -1 : 1; v = Math.abs(v); return s * (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); };
const fromLin = (v) => { const s = v < 0 ? -1 : 1; v = Math.abs(v); return 255 * s * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function labToRgb(L, a, b) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(fromLin);
}
const rgbToLch = (rgb) => { const [L, a, b] = rgbToLab(rgb); let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360; return [L, Math.hypot(a, b), h]; };
const lchToRgb = (L, C, H) => labToRgb(L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180));
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
// the three linear channels of a colour, for the "inside sRGB" test
const linear = (rgb) => rgb.map(toLin);

// the declarations of one rule, by its exact selector text (the first rule with that selector)
function declsAt(open) {
  const close = css.indexOf('}', open), out = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
function block(selector) {
  const i = css.indexOf('\n' + selector + ' {');
  const start = i >= 0 ? i + 1 : (css.startsWith(selector + ' {') ? 0 : -1);
  assert.ok(start >= 0, 'rule not found in subs.css: ' + selector);
  return declsAt(css.indexOf('{', start));
}
// the declarations of the rule inside the @supports block of the palette
function supportsBlock() {
  const i = css.indexOf('@supports (color: oklch(from red 0.7 0.1 calc(h + 90))) { .subs-page {');
  assert.ok(i >= 0, 'the @supports form of R3.4 is not in subs.css');
  return declsAt(css.indexOf('{', css.indexOf('.subs-page', i)));
}
const SCREENS = ['log', 'earn', 'setup', 'map']; // the Board keeps the default --scr (the route voice)
const scrRule = (tab) => block('.subs-page:has(.tabs [data-tab="' + tab + '"][aria-current="page"])');
const RULES = {
  light: block(':root'),
  dark: block(':root[data-theme="dark"]'),
  chartLight: block('.map-panel'),
  chartDark: block(':root[data-theme="dark"] .map-panel'),
  page: block('.subs-page'),
  pageSupports: supportsBlock(),
  scr: Object.fromEntries(SCREENS.map((t) => [t, scrRule(t)]))
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
// a colour expression -> [r, g, b] (unrounded). Forms: hex, white, var(), color-mix(in srgb|oklab, ...), oklch(L C H) and
// oklch(from <colour> L C h) / (... calc(h + N)); any other form throws.
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
  m = /^color-mix\(in (srgb|oklab),(.*)\)$/s.exec(expr);
  if (m) {
    const [a, b] = splitTop(m[2]);
    const pa = /^(.*?)\s+([\d.]+)%$/.exec(a), pb = /^(.*?)\s+([\d.]+)%$/.exec(b);
    const p = pa ? +pa[2] / 100 : pb ? 1 - +pb[2] / 100 : 0.5;
    const ca = colour(pa ? pa[1] : a, env), cb = colour(pb ? pb[1] : b, env);
    if (m[1] === 'srgb') return ca.map((x, i) => x * p + cb[i] * (1 - p));
    const la = rgbToLab(ca), lb = rgbToLab(cb);
    return labToRgb(...la.map((x, i) => x * p + lb[i] * (1 - p)));
  }
  m = /^oklch\(from\s+(.+)\s+([\d.]+)\s+([\d.]+)\s+(h|calc\(h \+ ([\d.]+)\))\)$/s.exec(expr);
  if (m) {
    const h = rgbToLch(colour(m[1], env))[2];
    return lchToRgb(+m[2], +m[3], h + (m[5] ? +m[5] : 0));
  }
  m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(expr);
  if (m) return lchToRgb(+m[1], +m[2], +m[3]);
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

// The module's token environment for one theme row and mode.
// opts.supports (default true): the relative-colour branch of the palette; false gives the fixed-hue fallback.
// opts.hue: force the anchor hue (degrees), as for any accent, preset or custom colour.
// opts.scr: the screen whose --scr applies ('board' default, or log, earn, setup, map).
function env(row, mode, opts) {
  opts = opts || {};
  const { dk, env: base } = shared(row, mode);
  const e = Object.assign({}, base, dk ? RULES.dark : RULES.light, RULES.page);
  if (opts.supports !== false) Object.assign(e, RULES.pageSupports);
  if (opts.hue != null) e['--hue-src'] = 'oklch(0.7 0.1 ' + opts.hue + ')';
  if (opts.scr && RULES.scr[opts.scr]) Object.assign(e, RULES.scr[opts.scr]);
  return e;
}

const VOICES = ['rank', 'gil', 'loot', 'route'];
const SEAS = [1, 2, 3, 4, 5, 6, 7];
const TONES = ['m', 'g', 's', 'w'];
// The palette itself is computed by src/submersibles/palette.js, the one script the page also loads (no second model).
const PALETTE = require(path.join(CC, 'src', 'submersibles', 'palette.js'));
// the inputs of PALETTE.compute for one theme row and mode: the shared tokens as applyLook() sets them, the status colours from subs.css
function themeInput(row, mode) {
  const { env: base } = shared(row, mode), st = block(mode === 'dark' ? ':root[data-theme="dark"]' : ':root');
  const o = { paper: base['--paper'], paper2: base['--paper-2'], slip: base['--slip'], ink: base['--ink'], ink2: base['--ink-2'], seal: base['--seal'], ochre: base['--ochre'] };
  for (const k of ['back', 'out', 'idle', 'bad']) o[k] = hexRgb(st['--' + k]);
  return o;
}
const compute = (row, mode) => PALETTE.compute(themeInput(row, mode));
// every palette token as sRGB bytes, plus the screen voice per screen (--scr, --scr-g, --ring), as the checks compare them with the browser
function palette(row, mode) {
  const r = compute(row, mode), out = {};
  for (const [k, v] of Object.entries(r.tokens)) out[k] = hexRgb(v);
  const scr = { board: ['route', '--route'], log: ['loot', '--loot'], earn: ['gil', '--gil'], setup: ['rank', '--rank'], map: ['sea', '--sea-1'] };
  for (const [screen, [, pre]] of Object.entries(scr)) {
    out['--scr@' + screen] = out[pre + (pre === '--sea-1' ? '' : '-m')];
    out['--scr-g@' + screen] = out[pre + '-g'];
    out['--ring@' + screen] = out[pre + '-ring'];
  }
  return out;
}

const toHex = (rgb) => '#' + rnd(rgb).map((x) => x.toString(16).padStart(2, '0')).join('');

// the published values the model must hit before anything else is trusted (spec R3.4 "The test")
function selfCheck() {
  const w = rgbToLch([255, 255, 255]), r = rgbToLch([255, 0, 0]), b = rgbToLch([0, 0, 255]);
  assert.equal(w[0].toFixed(3), '1.000'); assert.ok(w[1] < 0.001);
  assert.deepEqual([r[0].toFixed(2), r[1].toFixed(2), r[2].toFixed(1)], ['0.63', '0.26', '29.2']);
  assert.deepEqual([b[0].toFixed(2), b[1].toFixed(2), b[2].toFixed(1)], ['0.45', '0.31', '264.1']);
}

module.exports = { PALETTE, themeInput, compute, CC, css, lookSrc, THEMES, ACCENTS, hexRgb, rnd, mixRgb, lum, ratio, block, RULES, splitTop, colour, shared, env, palette, rgbToLch, lchToRgb, rgbToLab, labToRgb, linear, hueGap, toHex, selfCheck, VOICES, SEAS, TONES, SCREENS };
