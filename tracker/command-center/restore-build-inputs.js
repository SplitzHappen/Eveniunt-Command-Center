#!/usr/bin/env node
'use strict';
// Recover the build inputs that are not kept in Git (fonts, the Atelier's WebAssembly solver and its action icons)
// from the committed single-file builds, so both apps can be rebuilt in a session without the Rust toolchain, the
// raphael-rs checkout or npm. Every input is copied out byte for byte; rebuilding unchanged sources with them gives
// byte-identical files (check: node command-center/restore-build-inputs.js --verify).
// Writes only to gitignored places: <tracker>/node_modules/@fontsource, <atelier>/node_modules/@fontsource,
// <atelier>/build/, <atelier>/build-mt/ and <atelier>/build/action-icons/ (pass ICON_DIR=<that folder> to the Atelier build).
// Run it BEFORE changing either app: it reads today's committed dist/ and site/ files.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const T = path.join(__dirname, '..'), A = path.join(T, '..', 'ffxiv-cosmic-crafting-solver', 'atelier');
const PKG = { 'Fraunces': 'fraunces', 'Atkinson Hyperlegible': 'atkinson-hyperlegible', 'IBM Plex Mono': 'ibm-plex-mono', 'Big Shoulders Display': 'big-shoulders-display', 'Cinzel': 'cinzel' };
const between = (s, open, close = '</script>') => { const i = s.indexOf(open); if (i < 0) throw new Error('not found: ' + open); const j = s.indexOf(close, i + open.length); return s.slice(i + open.length, j); };
const put = (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); };

function fonts(html, dir) {
  const style = between(html, '<style>', '</style>');
  const re = /@font-face\{font-family:"([^"]+)";font-style:(\w+);font-weight:(\d+);font-display:swap;src:url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\) format\("woff2"\);unicode-range:([^}]+)\}/g;
  let m, n = 0;
  while ((m = re.exec(style))) {
    const [, family, st, w, b64, range] = m;
    const pkg = PKG[family]; if (!pkg) throw new Error('unknown font ' + family);
    const sub = range.startsWith('U+0000-00FF') ? 'latin' : 'latin-ext';
    put(path.join(dir, pkg, 'files', `${pkg}-${sub}-${w}-${st}.woff2`), Buffer.from(b64, 'base64'));
    n++;
  }
  return n;
}

function restore() {
  const th = fs.readFileSync(path.join(T, 'dist', 'eveniunt-tracker.html'), 'utf8');
  const ah = fs.readFileSync(path.join(A, 'dist', 'eveniunt-atelier.html'), 'utf8');
  const nt = fonts(th, path.join(T, 'node_modules', '@fontsource'));
  const na = fonts(ah, path.join(A, 'node_modules', '@fontsource'));
  put(path.join(A, 'build', 'atelier_bridge.js'), between(ah, '<script id="raphael-glue" type="text/plain">'));
  put(path.join(A, 'build', 'atelier_bridge_bg.wasm'), Buffer.from(between(ah, '<script id="raphael-wasm" type="text/plain">'), 'base64'));
  const icons = JSON.parse(between(ah, '<script id="icons" type="application/json">'));
  let ni = 0;
  for (const [job, names] of Object.entries(icons.map)) for (const [name, h] of Object.entries(names)) { put(path.join(A, 'build', 'action-icons', job, name + '.webp'), Buffer.from(icons.img[h], 'base64')); ni++; }
  // the multi-core solver of the hosted Atelier: site/mt/ minus the worker script, which comes from site-src/
  const MT = path.join(A, 'site', 'mt');
  const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]);
  let nm = 0;
  for (const f of walk(MT)) if (f !== 'solver-worker.js') { put(path.join(A, 'build-mt', f), fs.readFileSync(path.join(MT, f))); nm++; }
  console.log(`restored: ${nt} tracker fonts, ${na} Atelier fonts, solver glue and WebAssembly, ${ni} action icons, ${nm} multi-core files`);
}

// Rebuild both apps from the committed sources and compare with the committed builds, byte for byte.
function verify() {
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const files = [path.join(T, 'dist', 'eveniunt-tracker.html'), path.join(A, 'dist', 'eveniunt-atelier.html'), path.join(T, 'site', 'sw.js'), path.join(A, 'site', 'sw.js'), path.join(A, 'site', 'index.html'), path.join(T, 'site', 'index.html')];
  const before = files.map(sha);
  const env = Object.assign({}, process.env, { ICON_DIR: path.join(A, 'build', 'action-icons') });
  for (const [dir, tool] of [[T, 'tools/build.js'], [T, 'tools/build-site.js'], [A, 'tools/build.js'], [A, 'tools/build-site.js']]) execFileSync('node', [tool], { cwd: dir, env, stdio: 'inherit' });
  const after = files.map(sha);
  const diff = files.filter((f, i) => before[i] !== after[i]);
  console.log(diff.length ? 'DIFFERENT: ' + diff.join(', ') : 'identical: ' + files.length + ' rebuilt files match the committed ones byte for byte');
  process.exit(diff.length ? 1 : 0);
}

restore();
if (process.argv.includes('--verify')) verify();
