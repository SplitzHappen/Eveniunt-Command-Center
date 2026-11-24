#!/usr/bin/env node
'use strict';
// Build the Command Center shell (gate 1B) and the Submersibles module page (step S2) into command-center/site/. It holds only the shell; on the real site it
// sits at the root, next to today's tracker/ and atelier/ folders, which it opens unchanged.
// Inputs: command-center/src/ (index.html, shell.css, shell.js, sw.js template) and command-center/src/icons/ (the
// Command Center's own icons, gate 1E; drawn by command-center/make-icons.js).
// Run: node command-center/build.js
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const CC = __dirname, T = path.join(CC, '..'), SRC = path.join(CC, 'src'), OUT = path.join(CC, 'site');
const cp = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(from, path.join(OUT, to)); };
// The Tracker's look (owner request 2026-11-12: "the main menu, the tracker and all of the other modules should have
// the exact same theme"): the fonts and the Atelier's appearance module, the same ones tools/build.js puts in the Tracker.
// Fonts come from node_modules/@fontsource (restore-build-inputs.js recovers them) or, if absent, from the last build.
const FONT_DIR = process.env.FONT_DIR || path.join(T, 'node_modules', '@fontsource');
const FACES = [['Fraunces', 'fraunces', [400, 600, 900], ['normal', 'italic']], ['Atkinson Hyperlegible', 'atkinson-hyperlegible', [400, 700], ['normal', 'italic']],
  ['IBM Plex Mono', 'ibm-plex-mono', [400, 600], ['normal']], ['Big Shoulders Display', 'big-shoulders-display', [900], ['normal']], ['Cinzel', 'cinzel', [700], ['normal']]];
const RANGE = { latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' };
const keptFonts = {};
if (!fs.existsSync(FONT_DIR) && fs.existsSync(path.join(OUT, 'fonts'))) for (const f of fs.readdirSync(path.join(OUT, 'fonts'))) keptFonts[f] = fs.readFileSync(path.join(OUT, 'fonts', f));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
{
  let css = '/* Built by command-center/build.js: the Tracker\'s fonts (SIL Open Font License, LICENSES-FONTS.md) */\n', n = 0;
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
  for (const [family, pkg, weights, styles] of FACES) for (const w of weights) for (const st of styles) for (const sub of ['latin', 'latin-ext']) {
    const name = `${pkg}-${sub}-${w}-${st}.woff2`, src = path.join(FONT_DIR, pkg, 'files', name);
    const buf = fs.existsSync(src) ? fs.readFileSync(src) : keptFonts[name];
    if (!buf) continue;
    fs.writeFileSync(path.join(OUT, 'fonts', name), buf); n++;
    css += `@font-face{font-family:"${family}";font-style:${st};font-weight:${w};font-display:swap;src:url(fonts/${name}) format("woff2");unicode-range:${RANGE[sub]}}\n`;
  }
  if (n < 10) throw new Error('fonts missing: run node command-center/restore-build-inputs.js');
  fs.writeFileSync(path.join(OUT, 'fonts.css'), css);
  const atelier = fs.readFileSync(path.join(T, '..', 'crafting', 'atelier', 'src', 'atelier.js'), 'utf8');
  const a0 = atelier.indexOf('  // ── appearance (laid out like ChatGPT'), a1 = atelier.indexOf('  function renderHeader()');
  if (a0 < 0 || a1 < a0) throw new Error('Atelier appearance module not found');
  const SOLUTION_NINE = "    ['electrope-skyline', \"Electrope Skyline\", ['#e3ebf7', '#0a1230', '#0a6c94', '#c2187a'], ['#070a20', '#e6f4ff', '#38dcff', '#ff4fb8']]";
  const look = atelier.slice(a0, a1).replace(/\]\n  \];\n  var ACCENTS/, ']' + ',\n' + SOLUTION_NINE + '\n  ];\n  var ACCENTS');
  fs.writeFileSync(path.join(OUT, 'look.js'), "// Built by command-center/build.js: the Tracker's appearance (the Atelier's module, as tools/build.js uses it), read\n" +
    "// from the Tracker's saved choice ('eveniunt-tracker-ui') so every page of the Command Center has the same theme.\n" +
    "(function () {\n  'use strict';\n  var PREF_KEY = 'eveniunt-tracker-ui';\n  function load() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch (e) { return null; } }\n" +
    "  var S = { theme: (load() || {}).theme || 'system', look: null };\n" +
    "  // saves the theme and look next to the Tracker's other preferences (same key, the rest kept), so every page follows\n" +
    "  function persist() { try { var d = load() || {}; d.theme = S.theme; d.look = S.look; localStorage.setItem(PREF_KEY, JSON.stringify(d)); } catch (e) { /* private window */ } }\n" +
    "  function esc(s) { return String(s == null ? '' : s).replace(/[&<>\"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]; }); }\n" +
    "  function $(sel, root) { return (root || document).querySelector(sel); }\n" +
    "  function toast(msg) { var t = document.querySelector('[data-look-msg]'); if (t) t.textContent = msg; }\n" +
    "  function clampInt(v, lo, hi, d) { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); }\n" +
    "  function copyText(text, msg) { try { navigator.clipboard.writeText(text).then(function () { toast(msg || 'Copied'); }); } catch (e) { toast('Copy failed'); } }\n" +
    look + "\n  applyLook();\n  window.addEventListener('storage', function (e) { if (e.key === PREF_KEY) { var d = load() || {}; S.theme = d.theme || 'system'; if (d.look) S.look = Object.assign(S.look, d.look); applyLook(); } });\n" +
    "  window.EVENIUNT_LOOK = { apply: function () { var d = load() || {}; S.theme = d.theme || 'system'; applyLook(); }, html: function () { return appearanceHtml(); }, bind: function (root) { bindAppearance(root); } };\n})();\n");
}
cp(path.join(T, 'src', 'app', 'shared.css'), 'shared.css');
cp(path.join(T, 'src', 'app', 'one-look.css'), 'one-look.css'); // one look: the shared stylesheet, loaded after shared.css
for (const f of ['index.html', 'shell.css', 'shell.js', 'settings.js']) cp(path.join(SRC, f), f);
// the main Settings (2026-11-12) runs the Tracker's own core code for characters, cloud sync and backups
for (const f of ['model', 'codec', 'merge', 'cloud', 'storage']) cp(path.join(T, 'src', 'core', f + '.js'), 'core/' + f + '.js');
cp(path.join(SRC, 'prices.js'), 'prices.js'); // the shared price service (Submersibles, Lists)
cp(path.join(T, 'src', 'core', 'save.js'), 'save.js'); // the one save, shared with the Tracker and the Atelier (gate 1C)
for (const f of fs.readdirSync(path.join(SRC, 'icons'))) cp(path.join(SRC, 'icons', f), 'icons/' + f);
// The Submersibles module page (step S2): its page, script and styles, the shared alerts script, and data.js with a copy
// of data/submarines.json (compressed inside the page when that is smaller; both sizes are printed) and the worlds list
// of the shared place setting (data/live.json). It loads the one save from ../save.js.
for (const f of ['index.html', 'subs.css', 'subs.js', 'fleet.js', 'recs.js', 'drops.js', 'advisor.js', 'push.js', 'earn.js', 'chart.js', 'ledger.js', 'palette.js', 'timeline.js']) cp(path.join(SRC, 'submersibles', f), 'submersibles/' + f);
{
  const json = JSON.stringify(JSON.parse(fs.readFileSync(path.join(T, 'data', 'submarines.json'), 'utf8')));
  const live = JSON.parse(fs.readFileSync(path.join(T, 'data', 'live.json'), 'utf8'));
  const worlds = 'window.SUB_WORLDS=' + JSON.stringify({ dc: live.dc, worlds: live.worlds }) + ';\n';
  const head = '// Built by command-center/build.js from data/submarines.json (sources and licences inside, data/SOURCES.md) and data/live.json.\n';
  const plainJs = head + worlds + 'window.SUB_DATA=' + json + ';\n';
  const packedJs = head + worlds + 'window.SUB_DATA_PACKED="' + zlib.deflateRawSync(Buffer.from(json), { level: 9 }).toString('base64') + '";\n';
  const usePacked = Buffer.byteLength(packedJs) < Buffer.byteLength(plainJs);
  fs.writeFileSync(path.join(OUT, 'submersibles', 'data.js'), usePacked ? packedJs : plainJs);
  console.log('submersibles/data.js: plain', (Buffer.byteLength(plainJs) / 1024).toFixed(1), 'KB, compressed', (Buffer.byteLength(packedJs) / 1024).toFixed(1), 'KB; kept', usePacked ? 'compressed' : 'plain');
}
// The Lists module page (work item W6): its page, script and styles, the planning engine, and data.js with data/lists.json
// plus `log` (the crafting-log pages of the Tracker's craft-* lists, as recipe ids) and `noHandOver` (recipes the Atelier lacks, no link).
// The build stops when a log recipe id is not in `recipes`, when the Atelier disagrees with the sheets (tools/lists-crosscheck.js) or when
// data.js is over the 1.5 MB budget. Both sizes are printed.
for (const f of ['index.html', 'lists.css', 'lists.js', 'engine.js', 'store.js']) cp(path.join(SRC, 'lists', f), 'lists/' + f);
// The 11 job icons (the game's, fetched by tools/lists-data.py at the pinned Teamcraft commit): copied into the built site, so the
// page never hot-links them and the service worker caches them with the other files. The build stops when one is missing, is not a
// PNG or is over 16 kB.
for (const j of ['carpenter', 'blacksmith', 'armorer', 'goldsmith', 'leatherworker', 'weaver', 'alchemist', 'culinarian', 'miner', 'botanist', 'fisher']) {
  const file = path.join(T, 'data', 'classjob', j + '.png');
  if (!fs.existsSync(file)) throw new Error('lists icons: data/classjob/' + j + '.png is missing');
  const png = fs.readFileSync(file);
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('lists icons: ' + j + '.png is not a PNG');
  if (png.length > 16 * 1024) throw new Error('lists icons: ' + j + '.png is ' + png.length + ' bytes, over 16 kB');
  cp(file, 'lists/classjob/' + j + '.png');
}
{
  const data = JSON.parse(fs.readFileSync(path.join(T, 'data', 'lists.json'), 'utf8'));
  const tracker = JSON.parse(fs.readFileSync(path.join(T, 'data', 'tracker-data.json'), 'utf8'));
  const JOBS = ['carpenter', 'blacksmith', 'armorer', 'goldsmith', 'leatherworker', 'weaver', 'alchemist', 'culinarian'];
  const log = {};
  JOBS.forEach((name, job) => {
    const sec = tracker.sections.find((x) => x.id === 'craft-' + name);
    if (!sec) throw new Error('lists log: no craft-' + name + ' list in tracker-data.json');
    log[job] = sec.g.map((g) => [g.t, g.e.map((e) => {
      if (!data.recipes[e.i]) throw new Error('lists log: recipe ' + e.i + ' (' + e.n + ', ' + sec.id + ', ' + g.t + ') is not in the recipes of data/lists.json');
      return e.i;
    })]);
  });
  const cross = require('./../tools/lists-crosscheck.js').check(data);
  console.log('lists cross-check with the Atelier: compared ' + cross.compared + ', agreed ' + cross.agreed + ', no hand-over ' + cross.noHandOver.length);
  // R2 (docs/lists-redteam.md): the engine's `gather` table ({item: [job, level, zone, hours or 0, minutes or 0]}, "this item has a
  // gather source") is built here from the spot table, which the page's data carries as `spots` (every spot, best first). The
  // single values are those of the item's lowest-level spot (the plan-free choice); the page's chosen spot (LISTS.chosenSpot)
  // supplies the row's own spot and window, so a window is always that of one shown spot, never merged across nodes.
  const gatherOf = {};
  for (const [item, list] of Object.entries(data.gather)) {
    const s = list[0];
    gatherOf[item] = [s[0], s[2], s[3], s[7] && s[7].length ? s[7] : 0, s[7] && s[7].length ? s[8] : 0];
  }
  // R3 (docs/lists-redteam.md): the Tracker's "Master Crafting Books" entry of each master book of the game data, matched by the book's exact
  // game name (the Tracker stores each entry's id and name, not the game's item id), so a row can say the book is not ticked. The build stops
  // when a book has no entry or two, so a book is never matched by guess.
  require('./src/lists/engine.js');
  const mbSec = tracker.sections.find((x) => x.id === 'masterbooks');
  if (!mbSec) throw new Error('lists books: no masterbooks list in tracker-data.json');
  const books = globalThis.LISTS.bookEntries(data.bookNames, [].concat(...mbSec.g.map((g) => g.e)));
  if (books.missing.length) throw new Error('lists books: no single Tracker entry of the same name for the book item(s) ' + books.missing.join(', '));
  console.log('lists books: ' + Object.keys(books.map).length + ' of ' + Object.keys(data.bookNames).length + ' master books map to a Tracker entry');
  const full = Object.assign({}, data, { gather: gatherOf, spots: data.gather, log, noHandOver: cross.noHandOver, bookTicks: books.map });
  const json = JSON.stringify(full);
  const head = '// Built by command-center/build.js from data/lists.json (sources in data/SOURCES.md) and the craft-* lists of data/tracker-data.json.\n';
  const plainJs = head + 'window.LISTS_DATA=' + json + ';\n';
  const packedJs = head + 'window.LISTS_DATA_PACKED="' + zlib.deflateRawSync(Buffer.from(json), { level: 9 }).toString('base64') + '";\n';
  const usePacked = Buffer.byteLength(packedJs) < Buffer.byteLength(plainJs), out = usePacked ? packedJs : plainJs;
  if (Buffer.byteLength(out) > 1.5 * 1024 * 1024) throw new Error('lists/data.js is over the 1.5 MB budget: ' + Buffer.byteLength(out) + ' bytes');
  fs.writeFileSync(path.join(OUT, 'lists', 'data.js'), out);
  console.log('lists/data.js: plain', Buffer.byteLength(plainJs), 'bytes, packed', Buffer.byteLength(packedJs), 'bytes; kept', usePacked ? 'packed' : 'plain');
}
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'Eveniunt Command Center', short_name: 'Command Center', id: './', start_url: './', scope: './', display: 'standalone',
  description: 'The Eveniunt Tracker, Atelier and Submersibles for Final Fantasy XIV in one installable app.',
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
const page = walk(path.join(OUT, 'submersibles')).reduce((a, f) => a + fs.statSync(path.join(OUT, 'submersibles', f)).size, 0) + fs.statSync(path.join(OUT, 'save.js')).size + fs.statSync(path.join(OUT, 'shell.css')).size;
console.log('Submersibles module page with save.js and shell.css:', (page / 1024).toFixed(1), 'KB');
