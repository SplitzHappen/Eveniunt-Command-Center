#!/usr/bin/env node
'use strict';
// Build the hosted, installable app into atelier/site/ (deployed to GitHub Pages by the public repository).
// Inputs: dist/eveniunt-atelier.html (tools/build.js), build-mt/ (tools/build-wasm-mt.sh), site-src/, icons from tools/make-icons.js,
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const A = path.join(__dirname, '..'), P = path.join(A, '..'), OUT = path.join(A, 'site');
const cp = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(from, path.join(OUT, to)); };
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
cp(path.join(A, 'dist', 'eveniunt-atelier.html'), 'index.html');
const MT = path.join(A, 'build-mt');
const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]);
for (const f of walk(MT)) cp(path.join(MT, f), 'mt/' + f);
cp(path.join(A, 'site-src', 'solver-worker.js'), 'mt/solver-worker.js');
for (const f of fs.readdirSync(path.join(A, 'site-src', 'icons'))) cp(path.join(A, 'site-src', 'icons', f), 'icons/' + f);
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'Eveniunt Atelier', short_name: 'Atelier', id: './', start_url: './', scope: './', display: 'standalone',
  description: 'Offline FFXIV crafting solver with a live step-by-step guide for expert recipes. Part of the Eveniunt Network Command Center.',
  background_color: '#0f2234', theme_color: '#0f2234', categories: ['games', 'utilities'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));
const files = walk(OUT).sort();
const build = crypto.createHash('sha256').update(files.map((f) => fs.readFileSync(path.join(OUT, f))).reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0))).digest('hex').slice(0, 12);
const sw = fs.readFileSync(path.join(A, 'site-src', 'sw.js'), 'utf8').replace('__BUILD__', build).replace('__FILES__', JSON.stringify(['./'].concat(files)));
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
const size = walk(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log('site/ build', build, (size / 1048576).toFixed(1), 'MB,', walk(OUT).length, 'files');
