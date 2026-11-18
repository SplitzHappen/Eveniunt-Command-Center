'use strict';
// Submersibles look (docs/submersibles-look-spec.md, W1): contrast of the module's status and chart colours in all 21
// themes, light and dark. Theme rows come from command-center/site/look.js; the shared tokens are resolved as applyLook()
// does at contrast 50; the module's own tokens are read out of src/submersibles/subs.css.
// Run: node --test tests/subs-look.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
// the model of the module's colours (OKLab arithmetic, theme rows, token rules) lives in subs-palette.js
const P = require('./subs-palette.js');
const { CC, css, lookSrc, THEMES, ACCENTS, hexRgb, mixRgb, lum, ratio, RULES, colour, shared } = P;

const stat = {}; // pair -> { min, where }
const note = (pair, r, where) => { if (!stat[pair] || r < stat[pair].min) stat[pair] = { min: r, where }; };
const failures = [], chartFailures = [];
function need(pair, fg, bg, min, where) {
  const r = ratio(fg, bg);
  note(pair, r, where);
  if (r < min) (pair.startsWith('chart-') ? chartFailures : failures).push(pair + ' ' + r.toFixed(2) + ' < ' + min + ' in ' + where);
}

// One computation, two tests, so a failing chart pair does not hide the status pairs (or the other way round).
test('module tokens: status pairs and errors reach their contrast in all 21 themes', () => {
  assert.equal(THEMES.length, 21);
  for (const row of THEMES) {
    for (const mode of ['light', 'dark']) {
      const { dk } = shared(row, mode);
      const ac = hexRgb((mode === 'dark' ? row[3] : row[2])[2]);
      const where = row[0] + ' ' + mode;
      const env = P.env(row, mode);
      const c = (n) => colour('var(' + n + ')', env);
      for (const k of ['back', 'out', 'idle']) {
        need('on-' + k + ' on ' + k, c('--on-' + k), c('--' + k), 4.5, where);
        need(k + ' on slip (edge, 3:1)', c('--' + k), c('--slip'), 3, where);
        // W3: the Board's row tints carry the row's text and its status edge
        need('ink on ' + k + '-bg (row text)', c('--ink'), c('--' + k + '-bg'), 4.5, where);
        need(k + ' on ' + k + '-bg (row edge, 3:1)', c('--' + k), c('--' + k + '-bg'), 3, where);
        note('ink-2 on ' + k + '-bg (shared ink, printed)', ratio(c('--ink-2'), c('--' + k + '-bg')), where);
      }
      // W21 voyage gauge: the filled segments (--out) against the unfilled ones (--out at 12% over the row tint) and the row tint
      const gaugeTrack = colour('color-mix(in srgb, var(--out) 12%, var(--out-bg))', env);
      need('gauge fill (out) on gauge track (3:1)', c('--out'), gaugeTrack, 3, where);
      need('gauge fill (out) on out-bg (3:1)', c('--out'), c('--out-bg'), 3, where);
      note('gauge track on out-bg (printed; the unfilled segments are a guide, the figure is in words)', ratio(gaugeTrack, c('--out-bg')), where);
      // --on-seal: the shared token applyLook() picks through onSeal(), taken from the built look.js
      need('on-seal on seal (shared; primary buttons and .quick)', hexRgb(onSeal(ac)), c('--seal'), 4.5, where);
      // Revision 2 (W13): the inverted slab, the bar field and the card wash. The --back-bg pair above reads the new 16% value.
      need('on-slab on slab (slab text)', c('--on-slab'), c('--slab'), 4.5, where);
      need('on-slab-2 on slab (slab, secondary)', c('--on-slab-2'), c('--slab'), 4.5, where);
      need('ink on bar (figures on a bar)', c('--ink'), c('--bar'), 4.5, where);
      need('ink on hi-slip (text on the --hi wash)', c('--ink'), c('--hi-slip'), 4.5, where);
      note('ink-2 on bar (shared ink, printed)', ratio(c('--ink-2'), c('--bar')), where);
      note('ink-2 on hi-slip (shared ink, printed)', ratio(c('--ink-2'), c('--hi-slip')), where);
      // Revision 2 (W19, W20): the planner and the tier blocks sit on the paper, the phone Earnings labels use --ink on the bar (the pair above); the sea tab's fill on its track is decoration, its figure is the count in words, so it is printed, not asserted
      need('ink on paper (planner, tier blocks, sea tabs)', c('--ink'), c('--paper'), 4.5, where);
      for (let sea = 1; sea <= 7; sea++) note('sea ' + sea + ' fill on ink-2 track (printed; decoration)', ratio(c('--sea-' + sea), c('--ink-2')), where);
      need('bad on slip', c('--bad'), c('--slip'), 4.5, where);
      need('bad on paper', c('--bad'), c('--paper'), 4.5, where);
      // Revision 2 (W15, W16): labels and kickers in the sheet and the tables sit on the slip, the sector names on the paper, the Log's row hover on paper-2
      need('ink-2 on slip (labels, kickers, table heads)', c('--ink-2'), c('--slip'), 4.5, where);
      need('ink-2 on paper (sector rank line)', c('--ink-2'), c('--paper'), 4.5, where);
      need('ink on paper-2 (Log row hover)', c('--ink'), c('--paper-2'), 4.5, where);
      note('ink-2 on paper-2 (printed; the Log row uses --ink there)', ratio(c('--ink-2'), c('--paper-2')), where);
      for (let sea = 1; sea <= 7; sea++) {
        const cenv = Object.assign({}, env, dk ? RULES.chartDark : RULES.chartLight, { '--sea': env['--sea-' + sea] });
        const w = where + ' sea ' + sea;
        const cc = (n) => colour('var(' + n + ')', cenv);
        for (const bgName of ['--chart-bg', '--chart-bg-2', '--chart-bg-hi']) { // -hi: the lightest ground under any marker (scan line plus sweep), spec R5 W18
          for (const k of ['--chart-ink', '--chart-ink-2', '--chart-found', '--chart-next', '--chart-hot']) need(k.slice(2) + ' on ' + bgName.slice(2), cc(k), cc(bgName), 4.5, w);
          need('chart-far on ' + bgName.slice(2), cc('--chart-far'), cc(bgName), 3, w);
        }
      }
    }
  }
  const rows = Object.entries(stat).map(([k, v]) => '  ' + k.padEnd(34) + v.min.toFixed(2).padStart(6) + '  lowest at ' + v.where);
  console.log('Contrast, lowest ratio per pair (21 themes x light/dark, chart pairs x 7 seas):\n' + rows.join('\n'));
  assert.deepEqual(failures.slice(0, 20), [], failures.length + ' pairs under their ratio');
});

test('module tokens: chart pairs reach their contrast in all 21 themes, both modes and 7 seas', () => {
  assert.deepEqual(chartFailures.slice(0, 20), [], chartFailures.length + ' chart pairs under their ratio');
});

test('the old fixed colours are gone from subs.css', () => {
  for (const bad of ['#c0392b', '#06210f;', '#2a1800;']) {
    // the dark pair values are the new tokens; only the literal old error red and stray #fff may not remain outside the token blocks
    if (bad === '#c0392b') assert.ok(!css.includes(bad));
  }
  const body = css.split('\n').filter((l) => !l.startsWith(':root') && !l.includes(':root:not([data-theme="light"])') && !l.startsWith('.map-panel')).join('\n');
  assert.ok(!/#fff\b/i.test(body));
});

// W12: the text colour on the accent, taken out of the built look.js with its own lum()
const fn = (name) => { const i = lookSrc.indexOf('function ' + name + '('); assert.ok(i >= 0, 'no ' + name + '() in look.js'); return lookSrc.slice(i, lookSrc.indexOf('\n', i)); };
const { lum: lumB, onSeal } = new Function(fn('lum') + '\n' + fn('onSeal') + '\nreturn { lum: lum, onSeal: onSeal };')();
const oldRule = (ac) => (lumB(ac) > 0.42 ? '#111111' : '#ffffff');

test('on-seal on seal reaches 4.5:1 for the 21 themes, the preset accents and a sweep of accents', () => {
  const bad = [], changed = [];
  const chk = (ac, where) => { const col = onSeal(ac); if (ratio(hexRgb(col), ac) < 4.5) bad.push(where + ' ' + col); return col; };
  for (const row of THEMES) for (const mode of ['light', 'dark']) {
    const ac = hexRgb((mode === 'dark' ? row[3] : row[2])[2]);
    const col = chk(ac, row[0] + ' ' + mode);
    if (col !== oldRule(ac)) changed.push(row[0] + ' ' + mode + ' ' + oldRule(ac) + ' -> ' + col);
  }
  const presets = ACCENTS.filter((a) => a[2]);
  assert.equal(presets.length, 7);
  for (const a of presets) { chk(hexRgb(a[2]), a[0] + ' light'); chk(hexRgb(a[3]), a[0] + ' dark'); }
  let n = 0;
  for (let r = 0; r <= 255; r += 15) for (let g = 0; g <= 255; g += 15) for (let b = 0; b <= 255; b += 15) {
    const ac = [r, g, b], col = onSeal(ac); n++;
    assert.ok(['#ffffff', '#111111', '#000000'].includes(col), 'one of the three colours');
    if (ratio([255, 255, 255], ac) >= 4.5) assert.equal(col, '#ffffff', 'white whenever it reaches 4.5:1: ' + ac);
    chk(ac, 'rgb(' + ac + ')');
  }
  assert.equal(n, 18 * 18 * 18);
  assert.deepEqual(bad, []);
  console.log('Pairs whose on-seal colour differs from the old rule (' + changed.length + '):\n  ' + changed.join('\n  '));
});

test('the three built files carry onSeal() and not the old rule', () => {
  for (const f of [path.join(CC, 'site', 'look.js'), path.join(__dirname, '..', 'dist', 'eveniunt-tracker.html'), path.join(__dirname, '..', '..', 'crafting', 'atelier', 'dist', 'eveniunt-atelier.html')]) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(t.includes('function onSeal('), f + ' has onSeal()');
    assert.ok(!t.includes('> 0.42 ?'), f + ' has no old rule');
  }
});

// ---- Revision 3 (W22): the palette of R3.4, computed in plain JavaScript from the theme values ----
test('palette model: OKLab arithmetic reproduces the published values', () => { P.selfCheck(); });

const status = ['--back', '--out', '--idle', '--bad'];
const sRGBok = (rgb) => P.linear(rgb).every((v) => v >= -0.001 && v <= 1.001);
const palFail = [], palStat = {}, palPrint = [];
const pnote = (pair, r, where) => { if (!palStat[pair] || r < palStat[pair].min) palStat[pair] = { min: r, where }; };
function pneed(pair, fg, bg, min, where) { const r = ratio(fg, bg); pnote(pair, r, where); if (r < min) palFail.push(pair + ' ' + r.toFixed(2) + ' < ' + min + ' in ' + where); }
// one hue's four tones against the surfaces they sit on (the "must reach" column of R3.4)
function checkTones(e, mid, tones, label, where) {
  const c = (n) => colour('var(' + n + ')', e);
  const m = c(mid);
  if (!sRGBok(m)) palFail.push(label + ' mid outside sRGB (' + P.linear(m).map((x) => x.toFixed(3)).join(',') + ') in ' + where);
  pneed('on-mid on ' + label + ' mid (4.5)', c('--on-mid'), m, 4.5, where);
  for (const s of ['--slip', '--paper', '--paper-2']) {
    pneed(label + ' graphic on ' + s.slice(2) + ' (3)', c(tones.g), c(s), 3, where);
    pneed(label + ' strong on ' + s.slice(2) + ' (4.5)', c(tones.s), c(s), 4.5, where);
  }
  pneed(label + ' strong on its wash (4.5)', c(tones.s), c(tones.w), 4.5, where);
  pneed('ink on ' + label + ' wash (4.5)', c('--ink'), c(tones.w), 4.5, where);
}
function checkPalette(row, mode, o) {
  const where = row[0] + ' ' + mode + (o.supports === false ? ' (fallback hues)' : '') + (o.hue != null ? ' hue ' + o.hue : '');
  const e = P.env(row, mode, o), c = (n) => colour('var(' + n + ')', e);
  const voices = o.hue != null ? ['rank'] : P.VOICES;
  for (const v of voices) {
    checkTones(e, '--' + v + '-m', { g: '--' + v + '-g', s: '--' + v + '-s', w: '--' + v + '-w' }, v, where);
    if (o.hue == null) pnote('ink-2 on ' + v + '-wash (printed, not asserted)', ratio(c('--ink-2'), c('--' + v + '-w')), where);
  }
  if (o.hue != null) return;
  pneed('ink on gil-bar (4.5)', c('--ink'), c('--gil-bar'), 4.5, where);
  for (const k of ['--back-bg', '--out-bg', '--idle-bg']) pneed('route-s on ' + k.slice(2) + ' (4.5)', c('--route-s'), c(k), 4.5, where);
  // W22b decision 5: the fallback text tones of the status colours (the page replaces them with the computed ones)
  for (const k of status) for (const pg of ['slip', 'paper', 'paper-2']) pneed(k.slice(2) + '-s (text tone) on ' + pg + ' (4.5)', c(k + '-s'), c('--' + pg), 4.5, where);
  for (const n of P.SEAS) {
    checkTones(e, '--sea-' + n, { g: '--sea-' + n + '-g', s: '--sea-' + n + '-s', w: '--sea-' + n + '-w' }, 'sea ' + n, where);
  }
  for (const scr of ['board'].concat(P.SCREENS)) {
    const ee = P.env(row, mode, Object.assign({}, o, { scr }));
    const sm = colour('var(--scr)', ee), cc = (n) => colour('var(' + n + ')', ee); // the screen voice: a field (mid) and a band (graphic tone)
    if (!sRGBok(sm)) palFail.push('scr ' + scr + ' mid outside sRGB in ' + where);
    pneed('on-mid on scr mid (4.5)', cc('--on-mid'), sm, 4.5, where);
    for (const s of ['--slip', '--paper', '--paper-2']) pneed('scr graphic on ' + s.slice(2) + ' (3)', cc('--scr-g'), cc(s), 3, where);
    pneed('on-slab on ring, screen ' + scr + ' (4.5)', colour('var(--on-slab)', ee), colour('var(--ring)', ee), 4.5, where);
  }
  // the four voice hues differ pairwise by at least 80 degrees
  const hues = P.VOICES.map((v) => P.rgbToLch(c('--' + v + '-m'))[2]);
  let minGap = 360;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) minGap = Math.min(minGap, P.hueGap(hues[i], hues[j]));
  if (minGap < 80) palFail.push('voice hues ' + minGap.toFixed(1) + ' deg apart in ' + where);
  // printed: each voice's hue against the nearest status hue
  if (o.supports !== false) {
    const sh = status.map((k) => [k.slice(2), P.rgbToLch(c(k))[2]]);
    palPrint.push(where.padEnd(38) + P.VOICES.map((v, i) => { const n = sh.reduce((a, b) => P.hueGap(hues[i], b[1]) < P.hueGap(hues[i], a[1]) ? b : a); return v + ' ' + hues[i].toFixed(0) + ' (' + n[0] + ' ' + P.hueGap(hues[i], n[1]).toFixed(0) + ')'; }).join('  '));
  }
}

test('fallback palette in subs.css (R3.4): every voice, sea and screen colour is in sRGB and reaches its contrast in all 21 themes, light and dark', () => {
  for (const row of THEMES) for (const mode of ['light', 'dark']) {
    checkPalette(row, mode, {});
    checkPalette(row, mode, { supports: false }); // an engine without relative colour syntax: the fixed hues 350, 80, 170, 260
  }
  const rows = Object.entries(palStat).map(([k, v]) => '  ' + k.padEnd(46) + v.min.toFixed(2).padStart(6) + '  lowest at ' + v.where);
  console.log('Palette contrast, lowest ratio per pair (21 themes x light/dark, relative and fallback hues; sea pairs x 7 seas):\n' + rows.join('\n'));
  console.log('Voice hue and nearest status hue (status colours: back, out, idle, bad):\n  ' + palPrint.join('\n  '));
  const hex = (th, mode) => { const p = P.palette(THEMES.find((r) => r[0] === th), mode); return th + ' ' + mode + '\n' + P.VOICES.map((v) => '  ' + v.padEnd(6) + P.toHex(p['--' + v + '-m']) + ' mid  ' + P.toHex(p['--' + v + '-g']) + ' graphic  ' + P.toHex(p['--' + v + '-s']) + ' strong  ' + P.toHex(p['--' + v + '-w']) + ' wash').join('\n') + '\n  seas  ' + P.SEAS.map((n) => P.toHex(p['--sea-' + n])).join(' '); };
  console.log('Palette in hex, the three evidence themes:\n' + [hex('crystarium-dawnglass', 'light'), hex('azure-dragoon', 'dark'), hex('magitek-steel', 'light')].join('\n'));
  assert.deepEqual(palFail.slice(0, 20), [], palFail.length + ' palette pairs outside their rules');
});

test('fallback palette in subs.css (R3.4): a voice at any accent hue (0 to 355 degrees in steps of 5) is in sRGB and reaches its contrast in all 21 themes', () => {
  const before = palFail.length;
  for (const row of THEMES) for (const mode of ['light', 'dark']) for (let h = 0; h < 360; h += 5) checkPalette(row, mode, { hue: h });
  assert.deepEqual(palFail.slice(before, before + 20), [], (palFail.length - before) + ' hue-sweep pairs outside their rules');
});


// ---- W22b: the vivid palette, computed by src/submersibles/palette.js (the script the page loads) ----
const PAL = P.PALETTE, M = PAL.math;
const hx = (h) => (Array.isArray(h) ? h : M.hexRgb(h));
const rows = [];
for (const row of THEMES) for (const mode of ['light', 'dark']) rows.push([row, mode, row[0] + ' ' + mode]);
const pages = (th) => [th.slip, th.paper, th.paper2].map(hx);
const THEME_IN = (row, mode) => { const t = P.themeInput(row, mode); return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v])); };

test('palette (W22b): the shared script is deterministic and its cost is small', () => {
  const t = THEME_IN(THEMES[0], 'light');
  const a = JSON.stringify(PAL.compute(t)), b = JSON.stringify(PAL.compute(t));
  assert.equal(a, b);
  const t0 = process.hrtime.bigint(); let n = 0;
  for (const [row, mode] of rows) { PAL.compute(THEME_IN(row, mode)); n++; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  console.log('PALETTE.compute: ' + ms.toFixed(2) + ' ms per theme (mean of ' + n + ', Node)');
  assert.ok(ms < 40, 'compute takes ' + ms + ' ms');
});

const vivid = { fail: [], stat: {}, nudge: [], hex: [] };
const vneed = (pair, fg, bg, min, where) => { const r = M.ratio(fg, bg); if (!vivid.stat[pair] || r < vivid.stat[pair].min) vivid.stat[pair] = { min: r, where }; if (r < min) vivid.fail.push(pair + ' ' + r.toFixed(2) + ' < ' + min + ' in ' + where); };

test('palette (W22b): contrast, gamut, chroma and hue rules hold in all 21 themes, light and dark', () => {
  for (const [row, mode, where] of rows) {
    const th = THEME_IN(row, mode), r = PAL.compute(th), T = r.tokens, pg = pages(th), c = (n) => hx(T[n]);
    const mids = [];
    for (const v of PAL.VOICES.concat(PAL.SEA_HUES.map((h, i) => 'sea-' + (i + 1)))) {
      const sea = v.startsWith('sea-'), m = c(sea ? '--' + v : '--' + v + '-m'), g = sea ? '--' + v + '-g' : '--' + v + '-g', sN = '--' + v + '-s', w = '--' + v + '-w';
      mids.push([v, m]);
      pg.forEach((b, i) => { vneed(v + ' graphic on page colours (3)', c(g), b, 3, where); vneed(v + ' strong on page colours (4.5)', c(sN), b, 4.5, where); });
      vneed(v + ' ink on wash (7)', hx(th.ink), c(w), 7, where);
      const ch = M.rgbToLch(m)[1];
      if (ch < 0.11) vivid.fail.push(v + ' field chroma ' + ch.toFixed(3) + ' < 0.11 in ' + where);
      if (ch > PAL.CAP + 0.003) vivid.fail.push(v + ' field chroma ' + ch.toFixed(3) + ' over CAP in ' + where);
    }
    for (const [v, m] of mids) vneed('on-mid on ' + (v.startsWith('sea') ? v : v + ' field') + ' (4.5)', c('--on-mid'), m, 4.5, where);
    for (const k of PAL.STATUS) pg.forEach((b) => vneed('status text tone ' + k + '-s (4.5)', c('--' + k + '-s'), b, 4.5, where));
    for (const k of PAL.VOICES.map((v) => '--' + v + '-ring')) vneed('on-slab (page colour) on ring (4.5)', hx(th.paper), c(k), 4.5, where);
    vneed('ink on gil-bar (4.5)', hx(th.ink), c('--gil-bar'), 4.5, where);
    if (r.info.minVoiceGap < 60) vivid.fail.push('voices ' + r.info.minVoiceGap.toFixed(1) + ' deg apart in ' + where);
    if (r.info.minStatusAfter < PAL.NUDGE - 0.01) vivid.fail.push('voice ' + r.info.minStatusAfter.toFixed(1) + ' deg from a status colour in ' + where);
    vivid.nudge.push([where, r.info.minStatusBefore, r.info.minStatusAfter, r.info.minVoiceGap, r.info.fieldL, r.info.onMid]);
  }
  console.log('Vivid palette, lowest ratio per pair over 21 themes x 2 modes:\n' + Object.entries(vivid.stat).map(([k, v]) => '  ' + k.padEnd(46) + v.min.toFixed(2).padStart(6) + '  lowest at ' + v.where).join('\n'));
  const min = (i) => vivid.nudge.reduce((a, b) => (b[i] < a[i] ? b : a));
  console.log('Smallest hue distance voice to status colour: before the nudge ' + min(1)[1].toFixed(1) + ' (' + min(1)[0] + '), after ' + min(2)[2].toFixed(1) + ' (' + min(2)[0] + '); smallest voice to voice after ' + min(3)[3].toFixed(1) + ' (' + min(3)[0] + '); nudged: ' + vivid.nudge.filter((x) => x[1] < PAL.NUDGE).length + ' of ' + vivid.nudge.length);
  console.log('Hue distance per theme and mode (before, after, voice gap, on-mid):\n  ' + vivid.nudge.map((x) => x[0].padEnd(34) + x[1].toFixed(1).padStart(6) + x[2].toFixed(1).padStart(6) + x[3].toFixed(1).padStart(6) + ' ' + x[5]).join('\n  '));
  const hex = (th, mode) => { const p = PAL.compute(THEME_IN(THEMES.find((r) => r[0] === th), mode)).tokens; return th + ' ' + mode + '\n' + PAL.VOICES.map((v) => '  ' + v.padEnd(6) + p['--' + v + '-m'] + ' m  ' + p['--' + v + '-g'] + ' g  ' + p['--' + v + '-s'] + ' s  ' + p['--' + v + '-w'] + ' w').join('\n') + '\n  on-mid ' + p['--on-mid'] + '  status text ' + PAL.STATUS.map((k) => k + ' ' + p['--' + k + '-s']).join(' ') + '\n  seas  ' + [1, 2, 3, 4, 5, 6, 7].map((n) => p['--sea-' + n]).join(' '); };
  console.log('Vivid palette in hex, the three evidence themes:\n' + [hex('crystarium-dawnglass', 'light'), hex('azure-dragoon', 'dark'), hex('magitek-steel', 'light')].join('\n'));
  assert.deepEqual(vivid.fail.slice(0, 20), [], vivid.fail.length + ' vivid palette pairs outside their rules');
});

test('palette (W22b): every colour is inside sRGB before rounding, and any accent hue keeps the rules (hue sweep, all themes, both modes)', () => {
  const fail = [];
  for (const [row, mode, where] of rows) for (let h = 0; h < 360; h += 5) {
    const th = THEME_IN(row, mode), acc = M.rnd(M.lchToRgb(0.7, 0.1, h));
    th.seal = acc; th.ochre = acc; // the anchor takes the swept hue
    const r = PAL.compute(th), T = r.tokens, pg = pages(th);
    for (const n of Object.keys(T)) {
      const rgb = hx(T[n]);
      if (n.endsWith('-m') || /^--sea-\d$/.test(n)) { const ch = M.rgbToLch(rgb)[1]; if (ch < 0.11) fail.push(n + ' chroma ' + ch.toFixed(3) + ' hue ' + h + ' in ' + where); }
    }
    for (const v of PAL.VOICES) {
      pg.forEach((b) => { if (M.ratio(hx(T['--' + v + '-s']), b) < 4.5) fail.push(v + ' strong hue ' + h + ' ' + where); if (M.ratio(hx(T['--' + v + '-g']), b) < 3) fail.push(v + ' graphic hue ' + h + ' ' + where); });
      if (M.ratio(hx(T['--on-mid']), hx(T['--' + v + '-m'])) < 4.5) fail.push(v + ' on-mid hue ' + h + ' ' + where);
      if (M.ratio(M.rnd(th.ink), hx(T['--' + v + '-w'])) < 7) fail.push(v + ' wash hue ' + h + ' ' + where);
    }
    if (r.info.minVoiceGap < 60) fail.push('voice gap ' + r.info.minVoiceGap.toFixed(1) + ' hue ' + h + ' ' + where);
  }
  assert.deepEqual(fail.slice(0, 20), [], fail.length + ' failures in the hue sweep');
});

test('palette (W22b): the status text tones are used by the CSS wherever a status colour is a text colour', () => {
  for (const sel of ['.hint.bad, .wiz-err { color: var(--bad-s)', '.acc .ok { color: var(--back-s)', '.acc .bad { color: var(--bad-s)']) assert.ok(css.includes(sel), sel);
  // no rule sets a text colour straight from a status colour (the chart key's colours are chart tokens; line 438's is overridden later and not text on a page)
  const text = css.split('\n').filter((l) => /[^-]color: var\(--(back|out|idle|bad)\)/.test(l) && !l.startsWith('.chart-key .key.found { color: var(--back)'));
  assert.deepEqual(text, []);
});

test('palette (W22b): the page loads the script before subs.js, the build copies it, and the theme change is observed', () => {
  const html = fs.readFileSync(path.join(CC, 'src', 'submersibles', 'index.html'), 'utf8');
  assert.ok(html.indexOf('<script src="palette.js"></script>') > 0 && html.indexOf('<script src="palette.js"></script>') < html.indexOf('<script src="subs.js"></script>'));
  assert.ok(html.indexOf('<script src="../look.js"></script>') < html.indexOf('<script src="palette.js"></script>'));
  assert.ok(fs.readFileSync(path.join(CC, 'build.js'), 'utf8').includes("'palette.js'"));
  const src = fs.readFileSync(path.join(CC, 'src', 'submersibles', 'palette.js'), 'utf8');
  assert.ok(src.includes("attributeFilter: ['style', 'data-theme']"));
});

test('palette (W22b): the applier recomputes when the look changes and sets the tokens on the page element (simulated page)', () => {
  const calls = [];
  let observer = null, style = { '--paper': '#ffffff', '--paper-2': '#f2f2f2', '--slip': '#ffffff', '--ink': '#111111', '--ink-2': '#444444', '--seal': '#b5476b', '--ochre': '#c08a30', '--back': '#0f7a42', '--out': '#2343d6', '--idle': '#8f5600', '--bad': '#b3261e' };
  const page = { style: { setProperty: (n, v) => calls.push([n, v]) } };
  const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, MutationObserver: globalThis.MutationObserver, module: undefined };
  globalThis.document = { documentElement: { }, body: page, querySelector: () => page, readyState: 'complete', addEventListener() {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => ' ' + style[n] });
  globalThis.MutationObserver = function (fn) { observer = fn; this.observe = () => {}; };
  const key = require.resolve(path.join(CC, 'src', 'submersibles', 'palette.js'));
  const had = globalThis.PALETTE; delete globalThis.PALETTE; delete require.cache[key];
  try {
    const A = require(key);
    const first = Object.fromEntries(calls), n1 = calls.length;
    assert.ok(n1 > 40 && first['--rank-m'].startsWith('#'), 'tokens set at load');
    observer(); assert.equal(calls.length, n1, 'an unchanged look sets nothing');
    style = Object.assign({}, style, { '--paper': '#0b1220', '--paper-2': '#141b2a', '--slip': '#18202f', '--ink': '#e8eefc', '--ink-2': '#b0b8cc', '--seal': '#6ea2ff', '--back': '#4fd18b', '--out': '#7d93ff', '--idle': '#f0b347', '--bad': '#ff8a80' });
    observer();
    const second = Object.fromEntries(calls.slice(n1));
    assert.ok(calls.length > n1 && second['--rank-m'] !== first['--rank-m'] && second['--on-mid'] !== undefined, 'a theme change sets new tokens without a reload');
  } finally { globalThis.document = saved.document; globalThis.getComputedStyle = saved.getComputedStyle; globalThis.MutationObserver = saved.MutationObserver; delete require.cache[key]; globalThis.PALETTE = had; }
});

// ---- Revision 3 (W23): the chart's lightness ladder, link colours and receding background; the wash cap ----
test('palette (W23): a wash is a quiet tint, at most WASH_CHROMA of its field\'s chroma, with ink at 7:1 (21 themes, both modes)', () => {
  const fail = []; let top = 0, low = 9, n = 0;
  for (const [row, mode, where] of rows) {
    const th = THEME_IN(row, mode), T = PAL.compute(th).tokens;
    for (const v of PAL.VOICES.map((x) => '--' + x).concat([1, 2, 3, 4, 5, 6, 7].map((i) => '--sea-' + i))) {
      const m = v.startsWith('--sea') ? v : v + '-m', fieldC = M.rgbToLch(hx(T[m]))[1], washC = M.rgbToLch(hx(T[v + '-w']))[1];
      n++; top = Math.max(top, washC / fieldC); low = Math.min(low, washC);
      if (washC > PAL.WASH_CHROMA * fieldC + 0.004) fail.push(v + ' wash chroma ' + washC.toFixed(3) + ' over ' + (PAL.WASH_CHROMA * fieldC).toFixed(3) + ' in ' + where);
      if (washC < 0.02) fail.push(v + ' wash chroma ' + washC.toFixed(3) + ' under 0.02 (not tinted) in ' + where);
      if (M.ratio(hx(th.ink), hx(T[v + '-w'])) < 7) fail.push(v + ' ink on wash under 7 in ' + where);
    }
  }
  console.log('Wash chroma (' + n + ' washes): WASH_CHROMA ' + PAL.WASH_CHROMA.toFixed(3) + ', largest share of the field ' + top.toFixed(3) + ', smallest chroma ' + low.toFixed(3));
  assert.deepEqual(fail.slice(0, 20), [], fail.length + ' washes outside the cap');
});

test('chart (W23): ladder far < found < next, link colours and the receding background, all 21 themes, both modes, 7 seas (the computed sea colours)', () => {
  const fail = [], lo = {}, hi = {};
  const mn = (k, v, w) => { if (!lo[k] || v < lo[k][0]) lo[k] = [v, w]; };
  const mx = (k, v, w) => { if (!hi[k] || v > hi[k][0]) hi[k] = [v, w]; };
  const waters = {};
  for (const [row, mode, where] of rows) {
    const dk = mode === 'dark', e0 = P.env(row, mode), T = PAL.compute(THEME_IN(row, mode)).tokens;
    for (let n = 1; n <= 7; n++) {
      const env = Object.assign({}, e0, dk ? P.RULES.chartDark : P.RULES.chartLight, { '--sea': T['--sea-' + n] });
      const c = (x) => colour('var(' + x + ')', env), w = where + ' sea ' + n, L = (x) => lum(P.rnd(c(x)));
      const bg = c('--chart-bg'), bg2 = c('--chart-bg-2'), bgh = c('--chart-bg-hi');
      const need2 = (pair, v, min, max) => { if (min != null) mn(pair, v, w); if (max != null) mx(pair, v, w); if ((min != null && v < min) || (max != null && v > max)) fail.push(pair + ' ' + v.toFixed(2) + ' outside ' + (min == null ? '' : min) + '..' + (max == null ? '' : max) + ' in ' + w); };
      // the background recedes: back at most 1.6 on every ground, and still there (1.15) on the plain water
      for (const [g, b] of [['bg', bg], ['bg-2', bg2], ['bg-hi', bgh]]) need2('back on ' + g + ' (at most 1.6)', ratio(c('--chart-back'), b), null, 1.6);
      need2('back on bg (at least 1.15)', ratio(c('--chart-back'), bg), 1.15, null);
      need2('link on bg (1.8 to 3)', ratio(c('--chart-link'), bg), 1.8, 3); mx('link on bg (1.8 to 3)', ratio(c('--chart-link'), bg), w);
      need2('done on bg-hi (at least 2)', ratio(c('--chart-done'), bgh), 2, null);
      // the links that carry meaning: found to next (amber) and the way to a slot or sea (ink) read at 4.5 on every ground (the 3:1 of a meaningful graphic with room)
      for (const [g, b] of [['bg', bg], ['bg-2', bg2], ['bg-hi', bgh]]) { need2('lead link (next) on ' + g + ' (4.5)', ratio(c('--chart-next'), b), 4.5, null); need2('goal link (ink) on ' + g + ' (4.5)', ratio(c('--chart-ink'), b), 4.5, null); need2('far outline on ' + g + ' (3)', ratio(c('--chart-far'), b), 3, null); need2('found on ' + g + ' (4.5)', ratio(c('--chart-found'), b), 4.5, null); }
      // luminance order back < link < far < found < next, and the ratios a colour-blind player reads
      const ord = ['--chart-back', '--chart-link', '--chart-far', '--chart-found', '--chart-next'].map(L);
      for (let i = 0; i < 4; i++) { mn('luminance step ' + i + ' (back, link, far, found, next)', ord[i + 1] - ord[i], w); if (!(ord[i + 1] > ord[i])) fail.push('luminance order broken at step ' + i + ' in ' + w); }
      need2('next against found (luminance, at least 1.5)', (ord[4] + 0.05) / (ord[3] + 0.05), 1.5, null);
      need2('found against far (luminance, at least 1.3)', (ord[3] + 0.05) / (ord[2] + 0.05), 1.3, null);
      (waters[where] = waters[where] || []).push(M.rgbToLch(P.rnd(bg)));
    }
  }
  // the water of two seas can be told apart: smallest hue-and-chroma distance between two seas' water, per theme
  let wd = 9, wdw = '';
  for (const [where, ws] of Object.entries(waters)) for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
    const a = ws[i], b = ws[j], ax = a[1] * Math.cos(a[2] * Math.PI / 180), ay = a[1] * Math.sin(a[2] * Math.PI / 180), bx = b[1] * Math.cos(b[2] * Math.PI / 180), by = b[1] * Math.sin(b[2] * Math.PI / 180);
    const d = Math.hypot(ax - bx, ay - by); if (d < wd) { wd = d; wdw = where + ' seas ' + (i + 1) + ' and ' + (j + 1); }
  }
  console.log('Chart (W23), lowest per pair:\n' + Object.entries(lo).map(([k, v]) => '  ' + k.padEnd(62) + v[0].toFixed(3).padStart(7) + '  at ' + v[1]).join('\n') + '\nHighest per pair:\n' + Object.entries(hi).map(([k, v]) => '  ' + k.padEnd(62) + v[0].toFixed(3).padStart(7) + '  at ' + v[1]).join('\n') + '\nSmallest chroma-plane distance between two seas\' water: ' + wd.toFixed(4) + ' (' + wdw + ')');
  assert.ok(wd >= 0.012, 'two seas\' water too alike: ' + wd + ' ' + wdw);
  assert.deepEqual(fail.slice(0, 20), [], fail.length + ' chart pairs outside their rules');
});

test('chart (W23): subs.css has the dash only on the route, chevrons hidden but lead and goal, the sweep fan hidden and a hollow far marker', () => {
  const rules = css.split('\n').filter((l) => /stroke-dasharray/.test(l));
  assert.equal(rules.length, 1); assert.ok(rules[0].startsWith('.chart-route {'));
  assert.ok(/\.chart-chev \{ display: none;/.test(css) && css.includes('.chart-chev.lead { display: inline;') && css.includes('.chart-chev.goal:not(.lead) { display: inline;'));
  assert.ok(css.includes('.chart-sweep-fan { display: none; }'));
  assert.ok(css.includes('.chart-node.far > rect { fill: var(--chart-bg); stroke: var(--chart-far); stroke-width: 2; }'));
  assert.ok(css.includes('.chart-node.next > rect { fill: var(--chart-next); stroke: var(--chart-bg); stroke-width: 6; paint-order: stroke fill; }'));
  assert.ok(css.indexOf('.chart-lines line.goal:is(.open, .closed)') > css.indexOf('.chart-lines line.open.lead') && css.indexOf('.chart-lines line.open.lead') > css.indexOf('.chart-lines line.open.done'));
  assert.equal(P.RULES.chartLight['--chart-next'], '#ffe38a'); assert.equal(P.RULES.chartDark['--chart-next'], '#ffe38a');
});

// ---- Revision 3 (W25, W26): the screen voice, the rail, the Log and Earnings ----
test('Log and Earnings (W25, W26): every new pair reaches its contrast in all 21 themes, light and dark (computed palette)', () => {
  const fail = [], lo = {};
  const need3 = (pair, fg, bg, min, where) => { const r = M.ratio(fg, bg); if (!lo[pair] || r < lo[pair].min) lo[pair] = { min: r, where }; if (r < min) fail.push(pair + ' ' + r.toFixed(2) + ' < ' + min + ' in ' + where); };
  for (const [row, mode, where] of rows) {
    const th = THEME_IN(row, mode), T = PAL.compute(th).tokens, c = (n) => hx(T[n]), ink = hx(th.ink);
    const pg = { slip: hx(th.slip), paper: hx(th.paper), 'paper-2': hx(th.paper2) };
    for (const [n, b] of Object.entries(pg)) {
      // text: even Log rows (ink on paper-2), the unlogged words, gil, route and loot figures, the "Grade" chip's neighbours
      need3('Log/Earnings text: ink on ' + n + ' (4.5)', ink, b, 4.5, where);
      need3('Log: "nothing logged" idle-s on ' + n + ' (4.5)', c('--idle-s'), b, 4.5, where);
      for (const v of ['gil', 'route', 'loot']) need3('Log/Earnings text: ' + v + '-s on ' + n + ' (4.5)', c('--' + v + '-s'), b, 4.5, where);
      // meaningful graphics: the unlogged dashed edge (--idle), the logged edge, the heat line and card bands, the chip border, the sea edges, the rail icons
      need3('Log graphic: dashed edge idle on ' + n + ' (3)', hx(T['--idle'] || th.idle), b, 3, where);
      for (const v of ['loot', 'gil', 'rank', 'route']) need3('Log/Earnings/rail graphic: ' + v + '-g on ' + n + ' (3)', c('--' + v + '-g'), b, 3, where);
      for (let s = 1; s <= 7; s++) need3('Log/Earnings graphic: sea edge -g on ' + n + ' (3)', c('--sea-' + s + '-g'), b, 3, where);
    }
    need3('Log chip: ink on rank wash (7)', ink, c('--rank-w'), 7, where);
    need3('Log chip (S, SS): on-mid on rank field (4.5)', c('--on-mid'), c('--rank-m'), 4.5, where);
    need3('Earnings: ink figure on gil bar (4.5)', ink, c('--gil-bar'), 4.5, where);
    need3('Earnings card and head: on-mid on gil field (4.5)', c('--on-mid'), c('--gil-m'), 4.5, where);
    need3('Log head: on-mid on loot field (4.5)', c('--on-mid'), c('--loot-m'), 4.5, where);
    need3('Setup head: on-mid on rank field (4.5)', c('--on-mid'), c('--rank-m'), 4.5, where);
    need3('Board head: on-mid on route field (4.5)', c('--on-mid'), c('--route-m'), 4.5, where);
    for (let s = 1; s <= 7; s++) need3('Log time cell: on-mid on sea field (4.5)', c('--on-mid'), c('--sea-' + s), 4.5, where);
    for (const v of ['gil', 'loot', 'rank', 'route']) need3('rail: current tab on-mid on ' + v + ' field (4.5)', c('--on-mid'), c('--' + v + '-m'), 4.5, where);
    need3('rail: current tab on-mid on sea-1 field (Map) (4.5)', c('--on-mid'), c('--sea-1'), 4.5, where);
    for (const v of ['gil', 'loot', 'rank', 'route']) need3('head band: ink on page (the 6 px band) (3)', ink, pg.slip, 3, where);
  }
  console.log('Log and Earnings (W25, W26), lowest ratio per new pair over 21 themes x 2 modes:\n' + Object.entries(lo).map(([k, v]) => '  ' + k.padEnd(62) + v.min.toFixed(2).padStart(6) + '  lowest at ' + v.where).join('\n'));
  assert.deepEqual(fail.slice(0, 20), [], fail.length + ' new Log and Earnings pairs outside their rules');
});

test('Log and Earnings (W25, W26): subs.css and logHtml and earnHtml carry the rules and the classes', () => {
  for (const s of [
    '.panel:not(.welcome):not(.empty-state):not(.recs):not(.map-panel) > h2:first-child, .wiz-head { --slab: var(--scr);',
    '.tabs button[aria-current="page"] { --slab: var(--scr);', '.tabs button[aria-current="page"]::before { background: var(--ink); }',
    '.log-row[class*="in-sea-"] .log-when { --slab: var(--sea);', '.log-row:nth-child(even) { background: var(--paper-2); }',
    '.log-row.logged { border-right: 8px solid var(--loot-g); }', '.log-row.unlogged { border-right: 8px dashed var(--idle); }',
    '.log-row.unlogged .log-what .muted { color: var(--idle-s); font-weight: 700; }', '.log-what b { color: var(--gil-s); }', 'background: var(--gil-g); }',
    '.earn-card:first-child { --slab: var(--gil-m);', 'var(--gil-bar) calc(var(--p) * 100%)', 'border-left: 6px solid var(--sea-g, var(--route-g))', 'border-left: 6px solid var(--loot-g)']) assert.ok(css.includes(s), s);
  const js = fs.readFileSync(path.join(CC, 'src', 'submersibles', 'subs.js'), 'utf8');
  assert.ok(js.includes("' in-sea-' + sec.sea") && js.includes("(v.logged ? ' logged' : ' unlogged')") && js.includes('"--p:'), 'Log row classes');
  assert.ok(js.includes('class="log-grade g-') && js.includes("'>Grade ' + esc(t.grade)") === false && js.includes("Grade ' + esc(t.grade)"), 'the grade chip');
  assert.ok(js.includes("var seaOf = function (route)") && js.includes('<tr data-pos="\' + r.pos + \'" class="\' + seaOf(r.route)'), 'Earnings route rows carry the sea');
});
