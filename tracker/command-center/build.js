#!/usr/bin/env node
'use strict';
// Build the Command Center shell (gate 1B) into command-center/site/. It holds only the shell; on the real site it
// sits at the root, next to today's tracker/ and atelier/ folders, which it opens unchanged.
// Inputs: command-center/src/ (index.html, shell.css, shell.js, sw.js template) and command-center/src/icons/ (the
// Command Center's own icons, gate 1E; drawn by command-center/make-icons.js).
// Run: node command-center/build.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CC = __dirname, T = path.join(CC, '..'), SRC = path.join(CC, 'src'), OUT = path.join(CC, 'site');
const cp = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(from, path.join(OUT, to)); };
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'shell.css', 'shell.js']) cp(path.join(SRC, f), f);
cp(path.join(T, 'src', 'core', 'save.js'), 'save.js'); // the one save, shared with the Tracker and the Atelier (gate 1C)
for (const f of fs.readdirSync(path.join(SRC, 'icons'))) cp(path.join(SRC, 'icons', f), 'icons/' + f);
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'Eveniunt Command Center', short_name: 'Command Center', id: './', start_url: './', scope: './', display: 'standalone',
  description: 'The Eveniunt Tracker and Atelier for Final Fantasy XIV in one installable app.',
  background_color: '#0f2234', theme_color: '#0f2234', categories: ['games', 'utilities'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2) + '\n');
const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]);
const files = walk(OUT).sort();
const build = crypto.createHash('sha256').update(Buffer.concat(files.map((f) => fs.readFileSync(path.join(OUT, f))))).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8').replace('__BUILD__', build).replace('__FILES__', JSON.stringify(['./'].concat(files))));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
const size = walk(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log('command-center/site build', build, (size / 1024).toFixed(1), 'KB,', walk(OUT).length, 'files');
