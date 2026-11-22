'use strict';
// Lists look (docs/lists-spec.md section 7, work item W11): the six meaning roles (craft, gather, merchant, market, ready, short), each a fill and a text
// tone with one hue in every theme, read out of command-center/src/lists/lists.css. In all 21 themes, light and dark, the text reads at 4.5:1 on its fill
// and on the page, panel and paper tones; every role colour lies inside sRGB; the six hues stay apart; no rule outside the token block holds a colour;
// every role is drawn together with a word; the phone rules keep 40 px tap targets. Theme rows and token arithmetic come from subs-palette.js.
// Run: node tests/lists-look.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('./subs-palette.js');
const { THEMES, ratio, colour, shared, rgbToLch, linear } = P;

const SRC = path.join(P.CC, 'src', 'lists');
const css = fs.readFileSync(path.join(SRC, 'lists.css'), 'utf8'), js = fs.readFileSync(path.join(SRC, 'lists.js'), 'utf8');
const ROLES = ['craft', 'gather', 'merchant', 'market', 'ready', 'short'];
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');

// every rule of the sheet, at-rule bodies included: { sel, body }
function rulesOf(text) {
  const out = []; let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i); if (open < 0) break;
    const head = text.slice(i, open).trim();
    let d = 1, j = open + 1; for (; j < text.length && d; j++) { if (text[j] === '{') d++; else if (text[j] === '}') d--; }
    const inner = text.slice(open + 1, j - 1);
    if (head.startsWith('@')) out.push(...rulesOf(inner)); else out.push({ sel: head.replace(/\s+/g, ' '), body: inner });
    i = j;
  }
  return out;
}
const rules = rulesOf(body);
const decls = (b) => Object.fromEntries([...b.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const TOKEN_RULES = [':root', ':root[data-theme="dark"]', ':root:not([data-theme="light"])'];
const light = decls(rules.find((r) => r.sel === ':root').body), dark = decls(rules.find((r) => r.sel === ':root[data-theme="dark"]').body);
const media = decls(rules.find((r) => r.sel === ':root:not([data-theme="light"])').body);

test('the token block holds exactly six roles, each a fill and a text tone, in both modes', () => {
  const want = ROLES.flatMap((r) => ['--lr-' + r + '-fill', '--lr-' + r + '-ink']).sort();
  assert.deepEqual(Object.keys(light).sort(), want);
  assert.deepEqual(Object.keys(dark).sort(), want);
  assert.deepEqual(media, dark, 'with no theme chosen yet and a dark system, the fallback is the dark set');
});

const hueOf = (v) => +/^oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s*\)$/.exec(v)[1];
test('one hue per role in every theme: the fill and the text of a role share it, light and dark alike', () => {
  for (const r of ROLES) {
    const hs = new Set([light, dark].flatMap((m) => ['fill', 'ink'].map((k) => hueOf(m['--lr-' + r + '-' + k]))));
    assert.equal(hs.size, 1, r + ' has one hue');
  }
});

const rgbOf = (mode, r, k) => colour('var(--lr-' + r + '-' + k + ')', mode === 'dark' ? dark : light);
test('every role colour lies inside sRGB (so the browser shows the hue as written)', () => {
  for (const mode of ['light', 'dark']) for (const r of ROLES) for (const k of ['fill', 'ink']) assert.ok(linear(rgbOf(mode, r, k)).every((v) => v >= -0.002 && v <= 1.002), mode + ' ' + r + ' ' + k);
});

test('the six hues are at least 30 degrees apart, as painted, in both modes', () => {
  for (const mode of ['light', 'dark']) for (const k of ['fill', 'ink']) {
    const hs = ROLES.map((r) => rgbToLch(rgbOf(mode, r, k))[2]);
    for (let a = 0; a < hs.length; a++) for (let b = a + 1; b < hs.length; b++) { const d = Math.abs(hs[a] - hs[b]) % 360, gap = d > 180 ? 360 - d : d; assert.ok(gap >= 30, mode + ' ' + k + ' ' + ROLES[a] + '/' + ROLES[b] + ' ' + gap.toFixed(1)); }
  }
});

test('in all 21 themes, light and dark: a role\'s text is 4.5:1 on its fill and on the page, the panel and the paper', () => {
  assert.equal(THEMES.length, 21);
  const low = [], seen = { fill: 99, page: 99 };
  for (const row of THEMES) for (const mode of ['light', 'dark']) {
    const { dk, env } = shared(row, mode), set = dk ? 'dark' : 'light';
    for (const r of ROLES) {
      const ink = rgbOf(set, r, 'ink'), fill = rgbOf(set, r, 'fill');
      const f = ratio(ink, fill); seen.fill = Math.min(seen.fill, f);
      if (f < 4.5) low.push(row[0] + ' ' + mode + ' ' + r + ' on its fill ' + f.toFixed(2));
      for (const b of ['--paper', '--paper-2', '--slip']) { const x = ratio(ink, env[b]); seen.page = Math.min(seen.page, x); if (x < 4.5) low.push(row[0] + ' ' + mode + ' ' + r + ' on ' + b + ' ' + x.toFixed(2)); }
    }
  }
  assert.deepEqual(low, []);
  console.log('lists roles: lowest text on fill ' + seen.fill.toFixed(2) + ', lowest text on page, panel or paper ' + seen.page.toFixed(2) + ' (21 themes x 2 modes x 6 roles)');
});

const NAMES = 'black white red blue green yellow orange purple pink gray grey gold navy teal tan silver maroon olive lime aqua fuchsia brown crimson coral salmon tomato khaki ivory beige indigo violet magenta cyan'.split(' ');
const rawColour = (val) => { // a colour written out in a value: strings and var() names do not count
  const bare = val.replace(/"[^"]*"|'[^']*'/g, '').replace(/var\(\s*--[\w-]+/g, 'var(');
  return /#[0-9a-f]{3,8}\b/i.test(bare) || /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.test(bare) || new RegExp('(^|[^\\w-])(' + NAMES.join('|') + ')(?![\\w-])', 'i').test(bare);
};
test('no rule outside the token block holds a colour: only var() of a theme token or a role token', () => {
  const bad = [], uses = new Set();
  for (const r of rules) {
    if (TOKEN_RULES.includes(r.sel)) continue;
    for (const d of r.body.split(';')) {
      const k = d.indexOf(':'); if (k < 0) continue;
      const prop = d.slice(0, k).trim(), val = d.slice(k + 1).trim();
      for (const m of val.matchAll(/var\((--[\w-]+)/g)) if (/^--lr-/.test(m[1])) uses.add(m[1]);
      if (prop === '--rf' || prop === '--rt') { assert.ok(/^var\(--lr-[a-z]+-(fill|ink)\)$/.test(val), r.sel + ' ' + prop + ': ' + val); continue; }
      if (rawColour(val)) bad.push(r.sel + ' { ' + prop + ': ' + val);
    }
  }
  assert.deepEqual(bad, []);
  // every role token is used by some rule, and only the six roles are
  assert.deepEqual([...uses].sort(), ROLES.flatMap((r) => ['--lr-' + r + '-fill', '--lr-' + r + '-ink']).sort());
  // the lint catches what it should, and lets plain values through
  for (const p of ['#fff', '1px solid #abcdef', 'rgb(0, 0, 0)', 'oklch(0.5 0.1 20)', 'red', '2px dashed gold', 'color-mix(in srgb, var(--ink) 50%, white)']) assert.ok(rawColour(p), p);
  for (const p of ['var(--ink)', '1px solid var(--rule)', 'var(--lr-craft-fill)', 'transparent', '"red"', 'none', '12px/1.5 var(--f-data)', 'Big Shoulders Display']) assert.ok(!rawColour(p), p);
});

test('every role is drawn with a word: the way words, "to get N" and "N of M ready" in lists.js, and a css class for each of the six', () => {
  const ways = [...js.matchAll(/(\w+): \['(craft|gather|merchant|market)', '([A-Z][a-z]+)'\]/g)].map((m) => [m[2], m[3]]);
  assert.deepEqual(ways.map((w) => w[1]).sort(), ['Gather', 'Market', 'Merchant', 'Trade'], 'a word for each way of getting an item');
  assert.ok(js.includes("var w = craft ? ['craft', 'Craft'] : WAY_WORD[ln.by];"), 'the craft word');
  assert.ok(js.includes('<span class="role role-short">to get \' + x.got'), 'short is "to get N"');
  assert.ok(js.includes('<span class="role role-ready">\' + r.ready + \' of \' + r.total + \' ready</span>'), 'ready is "N of M ready"');
  assert.ok(js.includes("' <span class=\"role role-' + w[0] + '\">' + w[1] + '</span>'"), 'a way word is written inside its role span');
  for (const r of ROLES) assert.ok(new RegExp('\\.role-' + r + '\\s*\\{').test(body), '.role-' + r + ' is in lists.css');
  assert.ok(/\.role\s*\{[^}]*border:[^}]*var\(--rt\)/.test(body), 'a role shows its edge as well as its fill');
});

test('the phone: one column, no sideways scroll rule broken, 40 px tap targets on every button, tab, select, field and tick', () => {
  assert.match(body, /@media \(max-width: 480px\)/);
  for (const sel of ['.lists-bar .btn', '.lists-panel .btn', '.lines .btn', '.sec-toggle', '.lists-tabs .tab', '.order-list .btn']) {
    const hit = rules.filter((r) => r.sel.split(',').some((s) => s.trim() === sel || s.trim().endsWith(' ' + sel) || s.trim() === sel.replace('.lists-panel ', '.lists-panel ')));
    assert.ok(hit.some((r) => /min-height:\s*40px/.test(r.body)), sel + ' has min-height 40px');
  }
  assert.ok(rules.some((r) => /\.lists-form input/.test(r.sel) && /min-height:\s*40px/.test(r.body)), 'fields');
  assert.ok(rules.some((r) => /\.tick|\.chk/.test(r.sel) && /min-height:\s*40px/.test(r.body)), 'ticks');
  assert.ok(!/min-width:\s*(3|4|5|6|7|8|9)\d\dpx/.test(body.replace(/minmax\([^)]*\)/g, '')), 'no fixed minimum width of 300 px or more');
});
