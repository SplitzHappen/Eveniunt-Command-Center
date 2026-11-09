#!/usr/bin/env node
'use strict';
// Bundle dist/eveniunt-tracker.html: one self-contained offline file.
// Inputs: src/app/*, src/core/*.js, data/tracker-data.json, data/desktop-map.json, fonts from @fontsource (FONT_DIR),
// and the Appearance module (the 20 FFXIV themes and settings, taken from the Eveniunt Atelier source, plus the tracker's
// own Solution Nine theme).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = path.join(__dirname, '..');
const ATELIER = path.join(T, '..', 'ffxiv-cosmic-crafting-solver', 'atelier', 'src');
const read = (p, enc = 'utf8') => fs.readFileSync(p, enc);
const FONT_DIR = process.env.FONT_DIR || path.join(T, 'node_modules', '@fontsource');
const faces = [
  ['Fraunces', 'fraunces', [400, 600, 900], ['normal', 'italic']],
  ['Atkinson Hyperlegible', 'atkinson-hyperlegible', [400, 700], ['normal', 'italic']],
  ['IBM Plex Mono', 'ibm-plex-mono', [400, 600], ['normal']],
  ['Big Shoulders Display', 'big-shoulders-display', [900], ['normal']], // Limit Break wordmark
  ['Cinzel', 'cinzel', [700], ['normal']],
];
let fonts = '', nfont = 0;
for (const [family, pkg, weights, styles] of faces) for (const w of weights) for (const st of styles) for (const sub of ['latin', 'latin-ext']) {
  const f = path.join(FONT_DIR, pkg, 'files', `${pkg}-${sub}-${w}-${st}.woff2`);
  if (!fs.existsSync(f)) continue;
  nfont++;
  const range = sub === 'latin' ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
    : 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  fonts += `@font-face{font-family:"${family}";font-style:${st};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${read(f, null).toString('base64')}) format("woff2");unicode-range:${range}}\n`;
}
if (nfont < 10) throw new Error('fonts missing in ' + FONT_DIR);

// Appearance module from the Atelier: from its "appearance" banner to the start of renderHeader().
const atelier = read(path.join(ATELIER, 'atelier.js'));
const a0 = atelier.indexOf('  // ── appearance (laid out like ChatGPT');
const a1 = atelier.indexOf('  function renderHeader()');
if (a0 < 0 || a1 < a0) throw new Error('Atelier appearance module not found');
const look = atelier.slice(a0, a1);
if ((look.match(/^\s+\['[a-z-]+', "/gm) || []).length !== 20) throw new Error('expected 20 themes in the Atelier appearance module');
// The tracker's own extra theme (owner request, 2026-11-08): Electrope Skyline, after Solution Nine, Dawntrail's
// electrope-lit city: neon blue leads (accent), neon pink follows (progress). Light and dark,
// each [background, foreground, accent, progress]; contrast against the background: text 15.4 / 16.3, accent 5.1 / 6.4.
const SOLUTION_NINE = "    ['electrope-skyline', \"Electrope Skyline\", ['#e3ebf7', '#0a1230', '#0a6c94', '#c2187a'], ['#070a20', '#e6f4ff', '#38dcff', '#ff4fb8']]";
const lookPlus = look.replace(/\]\n  \];\n  var ACCENTS/, ']' + ',\n' + SOLUTION_NINE + '\n  ];\n  var ACCENTS');
if (lookPlus === look || (lookPlus.match(/^\s+\['[a-z-]+', "/gm) || []).length !== 21) throw new Error('could not add the Solution Nine theme');

const core = ['save', 'model', 'storage', 'codec', 'merge', 'ffxivcollect', 'cloud', 'importer', 'links'].map((f) => read(path.join(T, 'src', 'core', f + '.js'))).join('\n');
const app = read(path.join(T, 'src', 'app', 'ui.js')).replace('/*{{LOOK}}*/', () => lookPlus).replace('/*{{LIVE}}*/', () => read(path.join(T, 'src', 'app', 'live.js')));
const css = read(path.join(T, 'src', 'app', 'shared.css')) + '\n' + read(path.join(T, 'src', 'app', 'tracker.css'));
const data = read(path.join(T, 'data', 'tracker-data.json')).replace(/</g, '\\u003c');
const map = read(path.join(T, 'data', 'desktop-map.json')).replace(/</g, '\\u003c');
const links = read(path.join(T, 'data', 'links.json')).replace(/</g, '\\u003c');
// how-to-get information (data/info.json, tools/info.py): about 4 MB of text, stored compressed (deflate-raw, base64) and
// unpacked by the page the first time an entry's window opens
const cond = read(path.join(T, 'data', 'conditions.json')).replace(/</g, '\\u003c');
const live = read(path.join(T, 'data', 'live.json')).replace(/</g, '\\u003c');
const info = require('zlib').deflateRawSync(fs.readFileSync(path.join(T, 'data', 'info.json')), { level: 9 }).toString('base64');
for (const [n, s] of [['core', core], ['app', app]]) if (/<\/script/i.test(s)) throw new Error(n + ' contains </script>');
const build = crypto.createHash('sha256').update(core + app + css + data + map + links + info + cond + live).digest('hex').slice(0, 12);
let html = read(path.join(T, 'src', 'app', 'tracker.html'));
const rep = { FONTS: fonts, CSS: css, DATA: data, MAP: map, LINKS: links, INFO: info, COND: cond, LIVE: live, CORE: core, APP: app, BUILD: build };
html = html.replace(/\{\{([A-Z]+)\}\}/g, (m, k) => { if (!(k in rep)) throw new Error('missing ' + k); return rep[k]; });
if (/(src|href)\s*=\s*["']https?:/i.test(html)) throw new Error('external reference in the page');
const out = path.join(T, 'dist'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'eveniunt-tracker.html'), html);
console.log('dist/eveniunt-tracker.html', (Buffer.byteLength(html) / 1048576).toFixed(2), 'MB, build', build);
