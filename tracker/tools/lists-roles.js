#!/usr/bin/env node
'use strict';
// The colour roles of the Lists module (docs/lists-look-spec.md, decision L7 and the kit of section 3; docs/design-rules.md section 7), in the pattern of
// tools/subs-roles.js. Holds the role list (ROLES), the zone list (where each role is painted) and the contrast floors, reads the token block of
// src/lists/lists.css through the palette model of tests/subs-palette.js (theme rows of look.js, resolved as applyLook() does at contrast 50), and writes
// docs/lists-colour-roles.md. The output has no date and no machine text, so it is the same on every run.
//   node tracker/tools/lists-roles.js            writes the document
//   node tracker/tools/lists-roles.js --check    writes nothing; exits 1 when the committed document differs
const fs = require('fs');
const path = require('path');
const P = require('../tests/subs-palette.js');

const DOC = path.join(__dirname, '..', '..', 'docs', 'lists-colour-roles.md');
const CSS = path.join(P.CC, 'src', 'lists', 'lists.css');
const { THEMES, ratio, colour, shared, toHex, rgbToLch, hexRgb, hueGap } = P;

// ---- the roles: [id, name, kind, what it stands for, [[token, tone], ...]] ----
const R = (id, name, kind, stands, tokens) => ({ id, name, kind, stands, tokens });
const six = (id, name, stands) => R(id, name, 'meaning', stands, [['--lr-' + id + '-fill', 'field'], ['--lr-' + id + '-edge', 'graphic'], ['--lr-' + id + '-ink', 'text'], ['--lr-' + id + '-wash', 'wash']]);
const ROLES = [
  R('page', 'page', 'theme', 'the ground of the screen', [['--paper', 'field'], ['--paper-2', 'field'], ['--paper-3', 'field']]),
  R('panel', 'panel', 'theme', 'a raised surface, a ledger row', [['--slip', 'field']]),
  R('ink', 'ink', 'theme', 'reading text, edges', [['--ink', 'text'], ['--ink-2', 'text'], ['--ink-3', 'text']]),
  R('line', 'line', 'theme', 'hairlines and graph paper', [['--rule', 'graphic'], ['--grid', 'graphic']]),
  R('slab', 'slab', 'theme', 'structure with no kind of its own: the list head, the status line, the Wanted tab', [['--slab', 'field'], ['--on-slab', 'on'], ['--on-slab-2', 'on']]),
  R('accent', 'accent', 'theme', 'an action, the chosen thing, the single primary of a sheet, focus', [['--seal', 'field'], ['--on-seal', 'on'], ['--hi', 'wash']]),
  R('molten', 'molten', 'theme', 'the family\'s gradient (the head\'s band, a sheet\'s top rule, the primary\'s underline)', [['--molten', 'band']]),
  R('overlay', 'overlay', 'theme', 'shade over anything', [['--shadow', 'shade'], ['--scrim', 'shade']]),
  six('craft', 'craft', 'To craft: the job heads, the count of crafts, the second rung of the default order'),
  six('gather', 'gather', 'Gather: the section of nodes, a gathered item\'s word'),
  six('merchant', 'merchant', 'Buy from a merchant and Trade (told apart by their words)'),
  six('market', 'market', 'Buy on the market, the market line'),
  six('ready', 'ready', 'a count at 0, a finished row, "N of M ready"'),
  six('short', 'short', 'something is missing: "to get", Other, Not in your typed stock, a refusal, a destructive link')
];
// the text on any field of the six meaning roles
const SHARED = R('shared', 'shared', 'meaning', 'the text on any field of the six meaning roles', [['--on-mid', 'on']]);
const TONE_WORDS = { field: 'a solid ground that carries text', on: 'the text on that field', graphic: 'bands, bars, borders and marks (3:1 on the page colours)', text: 'coloured text (4.5:1 on the page colours)', wash: 'a tint under ink text (7:1)', band: 'a gradient band', shade: 'a shade over anything' };
const SIX = ['craft', 'gather', 'merchant', 'market', 'ready', 'short'];
// tokens that are sizes, fonts and patterns, not colours
const NON_COLOUR = new Set(['--edge', '--f-disp', '--f-kick', '--f-body', '--f-data', '--f-serif', '--r', '--f', '--g', '--s', '--w', '--on-f', '--rf', '--rt']);
// tokens that are set per rule (a role in use on one element), pointing at the tokens of a role; never colours of their own
const POINTERS = { '--f': ['meaning', 'slab', 'accent'], '--g': ['meaning', 'ink', 'accent'], '--s': ['meaning', 'ink'], '--w': ['meaning'], '--on-f': ['shared', 'slab', 'accent'], '--rf': ['meaning'], '--rt': ['meaning', 'ink'] };
// role tokens no rule of lists.css paints yet, each with its reason (the test fails when one is used, or when an unused one is missing here)
const UNUSED = {};
// the contrast floors of docs/design-rules.md K5; the test measures all 21 themes in light and dark
const FLOORS = { onField: 4.5, textOnPage: 4.5, graphicOnPage: 3, inkOnWash: 7, onSlab: 7, onSlab2: 4.5, hueGap: 30, hueGapText: 25, hueDrift: 40 };

// ---- the token block of lists.css ----
const cssText = () => fs.readFileSync(CSS, 'utf8');
function cssRules(src) {
  const text = (src || cssText()).replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
  (function parse(s) {
    let i = 0;
    while (i < s.length) {
      const o = s.indexOf('{', i); if (o < 0) break;
      const sel = s.slice(i, o).trim(); let d = 1, j = o + 1;
      while (j < s.length && d > 0) { if (s[j] === '{') d++; else if (s[j] === '}') d--; j++; }
      const body = s.slice(o + 1, j - 1);
      if (/^@(media|supports|container|layer|scope)/.test(sel)) parse(body);
      else if (sel.startsWith('@')) out.push({ sel, body });
      else out.push({ sel: sel.replace(/\s+/g, ' '), body });
      i = j;
    }
  })(text);
  return out;
}
// the declarations of a rule: custom properties, with values that may hold balanced parentheses and a ";" inside none of them
function decls(body) {
  const out = {}; let i = 0;
  while (i < body.length) {
    const m = /(--[\w-]+)\s*:/.exec(body.slice(i)); if (!m) break;
    let j = i + m.index + m[0].length, d = 0, start = j;
    for (; j < body.length; j++) { if (body[j] === '(') d++; else if (body[j] === ')') d--; else if (body[j] === ';' && d === 0) break; }
    out[m[1]] = body.slice(start, j).trim(); i = j + 1;
  }
  return out;
}
const TOKEN_RULES = [':root', ':root[data-theme="dark"]', ':root:not([data-theme="light"])'];
function tokenBlocks() {
  const rules = cssRules(), get = (s) => { const r = rules.find((x) => x.sel === s); if (!r) throw new Error('token rule not found in lists.css: ' + s); return decls(r.body); };
  return { light: get(':root'), dark: get(':root[data-theme="dark"]'), media: get(':root:not([data-theme="light"])') };
}

// ---- the model ----
const modes = ['light', 'dark'];
const onSealFn = (() => { const t = P.lookSrc, f = (n) => { const i = t.indexOf('function ' + n + '('); return t.slice(i, t.indexOf('\n', i)); }; return new Function(f('lum') + '\n' + f('onSeal') + '\nreturn onSeal;')(); })();
// the token environment of one theme and mode: the shared tokens as look.js sets them, plus the token block of lists.css (the dark set on top in dark)
function envOf(row, mode) {
  const { dk, env } = shared(row, mode), B = tokenBlocks();
  const e = Object.assign({}, env, B.light, dk ? B.dark : {});
  e['--on-seal'] = hexRgb(onSealFn(hexRgb((mode === 'dark' ? row[3] : row[2])[2])));
  return { env: e, dk };
}
// tokens the model cannot compute: printed as their formula, never as a typed value
const FORMULA = {
  '--rule': 'set by the theme (look.js)', '--grid': 'set by the theme (look.js)', '--hi': 'set by the theme: the accent at 16% opacity', '--shadow': 'set by the theme (look.js)',
  '--molten': 'set by the theme: the accent and progress gradient', '--scrim': 'formula: black at 60%, fixed in lists.css'
};
function valueOf(token, ctx) {
  if (FORMULA[token]) return FORMULA[token];
  return toHex(colour('var(' + token + ')', ctx.env));
}
const rgbOf = (token, ctx) => colour('var(' + token + ')', ctx.env);
const hueOfHex = (h) => rgbToLch(hexRgb(h))[2];

// ---- where the roles are painted: every rule of lists.css that reads a role's token, by selector ----
const roleOf = {}; // token -> role id
ROLES.concat([SHARED]).forEach((r) => r.tokens.forEach(([t]) => { roleOf[t] = r.id; }));
const usedTokens = (body) => [...new Set([...body.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))];
function usage() {
  const by = {}; ROLES.concat([SHARED]).forEach((r) => { by[r.id] = []; });
  for (const r of cssRules()) {
    if (TOKEN_RULES.includes(r.sel)) continue;
    for (const t of usedTokens(r.body)) if (roleOf[t]) for (const sel of r.sel.split(/\s*,\s*/)) if (!by[roleOf[t]].includes(sel)) by[roleOf[t]].push(sel);
  }
  return by;
}
// the roles a rule's custom properties may point at (--f, --g and the rest are set on an element to the tokens of one role)
function pointsAt(body) { return usedTokens(body).filter((t) => roleOf[t]).map((t) => roleOf[t]); }

// ---- measurements over all 21 themes in both modes ----
function measure() {
  const low = {}, put = (k, v, where) => { if (!(k in low) || v < low[k].v) low[k] = { v, where }; };
  for (const row of THEMES) for (const mode of modes) {
    const ctx = envOf(row, mode), e = ctx.env, where = row[1] + ' ' + mode;
    for (const r of SIX) {
      const f = rgbOf('--lr-' + r + '-fill', ctx), g = rgbOf('--lr-' + r + '-edge', ctx), s = rgbOf('--lr-' + r + '-ink', ctx), w = rgbOf('--lr-' + r + '-wash', ctx), om = rgbOf('--on-mid', ctx);
      put(r + ' on-mid on fill', ratio(om, f), where);
      for (const b of ['--paper', '--paper-2', '--slip']) { put(r + ' text tone on page, panel', ratio(s, e[b]), where + ' ' + b); put(r + ' graphic tone on page, panel', ratio(g, e[b]), where + ' ' + b); }
      put(r + ' ink on wash', ratio(e['--ink'], w), where);
    }
    put('slab text on slab', ratio(e['--paper'], e['--ink']), where);
    put('slab second text on slab', ratio(e['--paper-3'], e['--ink']), where);
  }
  return low;
}

// ---- the document ----
function build() {
  const L = [], out = (s) => L.push(s), B = tokenBlocks();
  const ctxs = [];
  for (const row of THEMES) for (const mode of modes) ctxs.push({ row, mode, ctx: envOf(row, mode) });
  const tones = ROLES.reduce((n, r) => n + r.tokens.length, 0) + SHARED.tokens.length;
  out('# Lists: colour roles');
  out('');
  out('Generated by tracker/tools/lists-roles.js. Do not edit.');
  out('');
  out('Source: docs/lists-look-spec.md (decision L7 and the kit of section 3) under docs/design-rules.md section 7. The tool reads the token block of `tracker/command-center/src/lists/lists.css`, the theme rows of `look.js` and the palette model of `tracker/tests/subs-palette.js`. Hex values are the colours the model computes at the default contrast, for each of the 21 themes in light and dark. `tracker/tests/lists-roles.test.js` fails when this document differs from the tool\'s output.');
  out('');
  out('## 1. The roles');
  out('');
  out('Tones: ' + Object.entries(TONE_WORDS).map(([k, v]) => '`' + k + '` ' + v).join('; ') + '.');
  out('');
  out('**' + (ROLES.length + 1) + ' roles, ' + tones + ' tones** (' + ROLES.filter((r) => r.kind === 'theme').length + ' theme roles, the six meaning roles and the shared text tone `--on-mid`). A theme role comes from the theme (`look.js`, `shared.css`). A meaning role has one hue in every theme (craft ' + hueOfCss('craft') + ', gather ' + hueOfCss('gather') + ', merchant ' + hueOfCss('merchant') + ', market ' + hueOfCss('market') + ', ready ' + hueOfCss('ready') + ', short ' + hueOfCss('short') + ' degrees, OKLCH); the theme reaches it through the ink and panel colours it is mixed with, so only lightness and strength move. A meaning is always also a word or a shape (design rule K4).');
  out('');
  out('| # | Role | Kind | Stands for | Tokens (tone) |');
  out('| --- | --- | --- | --- | --- |');
  ROLES.forEach((r, i) => out('| ' + (i + 1) + ' | ' + r.name + ' | ' + r.kind + ' | ' + r.stands + ' | ' + r.tokens.map(([t, tone]) => '`' + t + '` (' + tone + ')').join(', ') + ' |'));
  out('| | ' + SHARED.name + ' | ' + SHARED.kind + ' | ' + SHARED.stands + ' | `--on-mid` (on) |');
  out('');
  out('Pointers (set on an element to the tokens of one role, never a colour of their own, not counted): ' + Object.keys(POINTERS).map((t) => '`' + t + '`').join(', ') + '.');
  out('');
  if (Object.keys(UNUSED).length) { out('Role tokens no rule reads yet: ' + Object.keys(UNUSED).map((t) => '`' + t + '`').join(', ') + '.'); out(''); }
  out('## 2. Every tone, per theme and mode');
  out('');
  out('One table per role: 21 themes in light and dark, a hex value per token, and the hue (OKLCH degrees) of the first field or graphic tone.');
  out('');
  ROLES.concat([SHARED]).forEach((r, i) => {
    out('### ' + (r.id === 'shared' ? 'Shared' : (i + 1) + '. ' + r.name) + ': ' + r.stands);
    out('');
    out('| Theme | Mode | ' + r.tokens.map(([t, tone]) => '`' + t + '` (' + tone + ')').join(' | ') + ' | Hue |');
    out('| --- | --- | ' + r.tokens.map(() => '---').join(' | ') + ' | --- |');
    ctxs.forEach(({ row, mode, ctx }) => {
      const vals = r.tokens.map(([t]) => valueOf(t, ctx)), first = vals.find((v, k) => /^#/.test(v) && ['field', 'graphic'].includes(r.tokens[k][1]));
      out('| ' + row[1] + ' | ' + mode + ' | ' + vals.join(' | ') + ' | ' + (first ? Math.round(hueOfHex(first)) + '°' : '-') + ' |');
    });
    out('');
  });
  out('## 3. Contrast and hue, as measured');
  out('');
  out('The floors (design rule K5), each measured in all 42 pairs of theme and mode: text on its field ' + FLOORS.onField + ':1; a text tone on the page, panel and paper ' + FLOORS.textOnPage + ':1; a graphic tone on them ' + FLOORS.graphicOnPage + ':1; the theme\'s ink on a wash ' + FLOORS.inkOnWash + ':1; the slab\'s text ' + FLOORS.onSlab + ':1 and its second text ' + FLOORS.onSlab2 + ':1; two meaning fields or graphic tones at least ' + FLOORS.hueGap + ' degrees apart in hue, two text tones at least ' + FLOORS.hueGapText + ', and a role\'s graphic and text tones within ' + FLOORS.hueDrift + ' degrees of its field (the theme\'s ink tints them a little). Where hue cannot keep two roles apart, a word does. The lowest contrast found, and where:');
  out('');
  out('| Measure | Lowest | Floor | Where |');
  out('| --- | --- | --- | --- |');
  const low = measure();
  Object.keys(low).forEach((k) => {
    const floor = /on-mid on fill/.test(k) ? FLOORS.onField : /text tone/.test(k) ? FLOORS.textOnPage : /graphic tone/.test(k) ? FLOORS.graphicOnPage : /ink on wash/.test(k) ? FLOORS.inkOnWash : /second text/.test(k) ? FLOORS.onSlab2 : FLOORS.onSlab;
    out('| ' + k + ' | ' + low[k].v.toFixed(2) + ' | ' + floor + ' | ' + low[k].where + ' |');
  });
  out('');
  out('Hues of the six fields, as painted (OKLCH degrees), and the nearest other role:');
  out('');
  out('| Role | Hue | Nearest other role |');
  out('| --- | --- | --- |');
  const hues = SIX.map((r) => [r, rgbToLch(rgbOf('--lr-' + r + '-fill', ctxs[0].ctx))[2]]);
  hues.forEach(([r, h]) => {
    const near = hues.filter(([x]) => x !== r).map(([x, hx]) => [hueGap(h, hx), x]).sort((a, b) => a[0] - b[0])[0];
    out('| ' + r + ' | ' + Math.round(h) + '° | ' + near[1] + ' ' + Math.round(near[0]) + '° |');
  });
  out('');
  out('## 4. Where each role is painted');
  out('');
  out('The selectors of `lists.css` that read a token of the role, outside the token block (the pointers `--f`, `--g`, `--s`, `--w`, `--on-f`, `--rf` and `--rt` are set by the rules listed under the role they point at).');
  out('');
  const use = usage();
  ROLES.concat([SHARED]).forEach((r) => {
    out('- **' + r.name + '**: ' + (use[r.id].length ? use[r.id].map((s) => '`' + s + '`').join(', ') : 'no rule yet'));
  });
  out('');
  return L.join('\n').replace(/\n+$/, '') + '\n';
}
function hueOfCss(r) { return +/oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s*\)/.exec(tokenBlocks().light['--lr-' + r + '-fill'])[1]; }

module.exports = { ROLES, SHARED, SIX, POINTERS, NON_COLOUR, UNUSED, FLOORS, FORMULA, DOC, CSS, TOKEN_RULES, roleOf, usage, pointsAt, usedTokens, cssRules, decls, tokenBlocks, envOf, valueOf, rgbOf, measure, build, hueOfCss };

if (require.main === module) {
  const text = build();
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : null;
    if (have !== text) { console.error('docs/lists-colour-roles.md differs from the tool output; run: node tracker/tools/lists-roles.js'); process.exit(1); }
    console.log('docs/lists-colour-roles.md is up to date');
  } else {
    fs.writeFileSync(DOC, text);
    console.log('wrote docs/lists-colour-roles.md (' + text.split('\n').length + ' lines)');
  }
}
