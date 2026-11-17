#!/usr/bin/env node
'use strict';
// Render the Command Center's own app icons (gate 1E) to command-center/src/icons/: the Limit Break mark in the
// Crystarium Dawnglass colours shared with the Tracker (letter T) and the Atelier (letter A), with the letters CC and
// the gauge full, so an installed Command Center is told apart from the two modules on a home screen.
// Needs Playwright (Chromium) and the fonts in node_modules/@fontsource (node command-center/restore-build-inputs.js).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const CC = __dirname, T = path.join(CC, '..'), FONT_DIR = process.env.FONT_DIR || path.join(T, 'node_modules', '@fontsource');
const face = (fam, pkg, w) => `@font-face{font-family:"${fam}";font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, pkg, 'files', `${pkg}-latin-${w}-normal.woff2`)).toString('base64')})}`;
const html = (pad) => `<!doctype html><html><head><style>${face('BigS', 'big-shoulders-display', 900)}${face('Cinzel', 'cinzel', 700)}
html,body{margin:0;width:512px;height:512px;background:#0f2234}
.c{position:absolute;inset:${pad}px;display:grid;place-content:center;justify-items:center;gap:${12 - pad / 20}px}
.t{font:700 ${40 - pad / 5}px Cinzel;letter-spacing:.42em;color:#ffadc4;margin-right:-.42em}
.w{font:900 ${300 - pad * 1.5}px/0.8 BigS;letter-spacing:-.02em;background:linear-gradient(90deg,#fff1f5,#ffadc4 48%,#9ad4ff);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(255,173,196,.5))}
.g{display:flex;gap:10px;width:${330 - pad * 1.2}px}.g i{flex:1;height:${26 - pad / 10}px;border:4px solid #ffadc4;transform:skewX(-25deg);background:linear-gradient(90deg,#fff1f5,#ffadc4)}
</style></head><body><div class="c"><div class="t">EVENIUNT</div><div class="w">CC</div><div class="g"><i></i><i></i><i></i></div></div></body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  const out = path.join(CC, 'src', 'icons'); fs.mkdirSync(out, { recursive: true });
  await p.setContent(html(40)); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(out, 'icon-512.png') });
  await p.setContent(html(100)); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(out, 'icon-maskable-512.png') });
  await b.close();
  require('child_process').execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open('${path.join(out, 'icon-512.png')}');im.resize((192,192),Image.LANCZOS).save('${path.join(out, 'icon-192.png')}');im.resize((180,180),Image.LANCZOS).save('${path.join(out, 'apple-touch-icon.png')}')`]);
  console.log('icons:', fs.readdirSync(out).join(', '));
})();
