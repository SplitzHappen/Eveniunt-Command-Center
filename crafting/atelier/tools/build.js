#!/usr/bin/env node
'use strict';
// Bundle dist/eveniunt-atelier.html: one self-contained offline file.
// Inputs: atelier/build/ (from build-wasm.sh), atelier/data/atelier-data.json, ../src/engine/*.js, atelier/src/*,
//         fonts from @fontsource packages (FONT_DIR, default: node_modules next to the binaryen install).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const A = path.join(__dirname, '..'), P = path.join(A, '..');
const read = (p, enc = 'utf8') => fs.readFileSync(p, enc);
const FONT_DIR = process.env.FONT_DIR || path.join(A, 'node_modules', '@fontsource');
const faces = [
  ['Fraunces', 'fraunces', [400, 600, 900], ['normal', 'italic']],
  ['Atkinson Hyperlegible', 'atkinson-hyperlegible', [400, 700], ['normal', 'italic']],
  ['IBM Plex Mono', 'ibm-plex-mono', [400, 600], ['normal']],
  ['Big Shoulders Display', 'big-shoulders-display', [900], ['normal']], // Limit Break wordmark
  ['Cinzel', 'cinzel', [700], ['normal']],
];
let fonts = '';
for (const [family, pkg, weights, styles] of faces) for (const w of weights) for (const st of styles) for (const sub of ['latin', 'latin-ext']) {
  const f = path.join(FONT_DIR, pkg, 'files', `${pkg}-${sub}-${w}-${st}.woff2`);
  if (!fs.existsSync(f)) continue;
  const range = sub === 'latin' ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
    : 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  fonts += `@font-face{font-family:"${family}";font-style:${st};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${read(f, null).toString('base64')}) format("woff2");unicode-range:${range}}\n`;
}
// In-game action icons, per job (Raphael's assets/action-icons, © SQUARE ENIX). Identical images are stored once.
const ICON_DIR = process.env.ICON_DIR || path.join(process.env.HOME || '/root', '.cargo/git/checkouts/raphael-rs-e9b0b2fe4e9f5b15/723b17e/assets/action-icons');
const JOBS = ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'];
const icons = { img: {}, map: {} };
for (const job of JOBS) {
  icons.map[job] = {};
  for (const f of fs.readdirSync(path.join(ICON_DIR, job)).filter((x) => x.endsWith('.webp')).sort()) {
    const buf = read(path.join(ICON_DIR, job, f), null);
    const h = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
    icons.img[h] = buf.toString('base64');
    icons.map[job][f.slice(0, -5)] = h;
  }
}
const iconsJson = JSON.stringify(icons);
if (Object.keys(icons.map.CRP).length < 37) throw new Error('action icons missing: ' + ICON_DIR);
const glue = read(path.join(A, 'build', 'atelier_bridge.js'));
const wasm = read(path.join(A, 'build', 'atelier_bridge_bg.wasm'), null).toString('base64');
const engine = read(path.join(P, 'src', 'engine', 'sim.js')) + '\n' + read(path.join(P, 'src', 'engine', 'solver.js'));
const app = read(path.join(A, 'src', 'atelier.js'));
const css = read(path.join(A, 'src', 'atelier.css'));
const data = read(path.join(A, 'data', 'atelier-data.json')).replace(/</g, '\\u003c');
for (const [n, s] of [['glue', glue], ['engine', engine], ['app', app]]) if (/<\/script/i.test(s)) throw new Error(n + ' contains </script>');
const build = crypto.createHash('sha256').update(glue + wasm + engine + app + css + data + iconsJson).digest('hex').slice(0, 12);
let html = read(path.join(A, 'src', 'atelier.html'));
const rep = { ICONS: iconsJson, FONTS: fonts, CSS: css, DATA: data, GLUE: glue, WASM: wasm, ENGINE: engine, APP: app, BUILD: build };
html = html.replace(/\{\{([A-Z]+)\}\}/g, (m, k) => { if (!(k in rep)) throw new Error('missing ' + k); return rep[k]; });
if (/(src|href)\s*=\s*["']https?:/i.test(html)) throw new Error('external reference');
const out = path.join(A, 'dist'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'eveniunt-atelier.html'), html);
console.log('dist/eveniunt-atelier.html', (Buffer.byteLength(html) / 1048576).toFixed(2), 'MB, fonts', faces.length, 'families,', Object.keys(icons.img).length, 'unique icons, build', build);
