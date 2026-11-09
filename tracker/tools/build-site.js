#!/usr/bin/env node
'use strict';
// Build the hosted, installable Tracker into site/ (deployed to GitHub Pages at /tracker/ by the public repository).
// Inputs: dist/eveniunt-tracker.html (tools/build.js), site-src/sw.js, site-src/oauth.html, site-src/sync-config.json (optional), site-src/icons/ (tools/make-icons.js).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = path.join(__dirname, '..'), OUT = path.join(T, 'site');
const cp = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(from, path.join(OUT, to)); };
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
cp(path.join(T, 'dist', 'eveniunt-tracker.html'), 'index.html');
cp(path.join(T, 'site-src', 'oauth.html'), 'oauth.html'); // the return address of the OneDrive sign-in (gate 1E)
// cloud sync set-up (client id, helper address): committed by the owner's set-up, absent until then (cloud sync then says it is not set up)
if (fs.existsSync(path.join(T, 'site-src', 'sync-config.json'))) cp(path.join(T, 'site-src', 'sync-config.json'), 'sync-config.json');
for (const f of fs.readdirSync(path.join(T, 'site-src', 'icons'))) cp(path.join(T, 'site-src', 'icons', f), 'icons/' + f);
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'Eveniunt Tracker', short_name: 'Tracker', id: './', start_url: './', scope: './', display: 'standalone',
  description: 'Offline Final Fantasy XIV completion tracker for up to eight characters side by side. Part of the Eveniunt Network Command Center.',
  background_color: '#0f2234', theme_color: '#0f2234', categories: ['games', 'utilities'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));
const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]);
const files = walk(OUT).sort();
const build = crypto.createHash('sha256').update(Buffer.concat(files.map((f) => fs.readFileSync(path.join(OUT, f))))).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync(path.join(T, 'site-src', 'sw.js'), 'utf8').replace('__BUILD__', build).replace('__FILES__', JSON.stringify(['./'].concat(files))));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
const size = walk(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log('site/ build', build, (size / 1048576).toFixed(1), 'MB,', walk(OUT).length, 'files');
