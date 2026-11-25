// One look, step 3: the same three screens (Atelier, Lists, Bourse trip) in two structures, for the owner to choose the one look
// of the whole app: node docs/one-look/v3/make.mjs, then node docs/one-look/v3/shoot.mjs. A = Submersibles-led (dark capital
// section bars, lanes with state wedges, big answers); B = Atelier-led (book chapters, one ledger per section, leaders,
// figures at reading size). Same content, same state colours, the site's own fonts, shared stylesheet and theme script.
// Figures are examples copied from the real screens and the Bourse mock-ups; names are from the pinned game data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'one-look', 'v3', 'mock');
const SITE = '../../../../tracker/command-center/site/';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gil = (n) => Number(n).toLocaleString('en-US');
const fig = (n) => '<span class="ol-fig">' + n + '</span>';
const ICON = {
  menu: '<path d="M9 6 3 12l6 6"/><rect x="12" y="5" width="4" height="4"/><rect x="17" y="5" width="4" height="4"/><rect x="12" y="11" width="4" height="4"/><rect x="17" y="11" width="4" height="4"/>',
  trip: '<path d="M5 19c4 0 3-6 7-6s3-6 7-6"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="7" r="2"/>', item: '<path d="M4 7h16M4 12h11M4 17h7"/><path d="M18 14v6M15 17h6"/>',
  profit: '<path d="M4 20h16M7 20v-5M12 20V8M17 20v-9"/><path d="m5 10 5-5 4 3 5-5"/>', watch: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  lists: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4 7h.01M4 12h.01M4 17h.01"/>', get: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>', craft: '<path d="M14 6l4 4M5 19l9-9M12 4l8 8-3 3-8-8z"/>', want: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  dots: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>', chev: '<path d="m6 9 6 6 6-6"/>',
};
const icon = (k) => '<svg class="bm-ic" viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>';
const sb = (cls, b, i, w) => '<span class="ol-sb ' + cls + '"><b' + (w ? ' class="ol-w"' : '') + '>' + b + '</b>' + (i ? '<i>' + i + '</i>' : '') + '</span>';
const more = '<button class="ol-btn-2 bm-more" type="button" aria-label="More">' + icon('dots') + '</button>';
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

function header(word, here, tools) {
  const nav = ['Home', 'Tracker', 'Atelier', 'Submersibles', 'Lists', 'Bourse', 'Settings'].map((n) => '<a href="#"' + (n === here ? ' aria-current="page"' : '') + '>' + n + '</a>').join('');
  return '<header class="ol-hdr"><div class="ol-hdr-in"><a class="ol-menu" href="#"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON.menu + '</svg><span>Main menu</span></a>' +
    '<a class="ol-mark" href="#"><span class="ol-mk-top">Eveniunt</span><span class="ol-mk-word">' + word + '</span><span class="ol-mk-gauge" aria-hidden="true"><i></i><i></i><i></i></span></a>' +
    '<div class="ol-tools">' + (tools || '') + '</div><nav class="ol-nav" aria-label="Command Center">' + nav + '</nav></div></header>';
}
const rail = (items, here) => '<nav class="bm-rail" aria-label="Views">' + items.map(([k, n, c]) => '<a href="#"' + (k === here ? ' aria-current="page"' : '') + '>' + icon(k) + '<span>' + n + '</span>' + (c != null ? '<small>' + c + '</small>' : '') + '</a>').join('') + '</nav>';
function page(file, title, v, word, here, body, tools) {
  const html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(title) + ' · one look ' + v + '</title>\n' +
    '<link rel="stylesheet" href="' + SITE + 'fonts.css">\n<link rel="stylesheet" href="' + SITE + 'shared.css">\n<link rel="stylesheet" href="' + SITE + 'one-look.css">\n<link rel="stylesheet" href="../../../bourse/mock/bourse-mock.css">\n<link rel="stylesheet" href="v3.css">\n' +
    '<script>try { var t = (JSON.parse(localStorage.getItem(\'eveniunt-tracker-ui\') || \'{}\') || {}).theme; if (t === \'light\' || t === \'dark\') document.documentElement.setAttribute(\'data-theme\', t); } catch (e) { /* none */ }</script>\n' +
    '</head>\n<body class="bm ol-page' + (v === 'B' ? ' v3-book' : '') + '">\n<script src="' + SITE + 'look.js"></script>\n' + header(word, here, tools) + '\n' + body +
    '\n<p class="bm-foot"><b>Mock-up, look ' + v + ' (' + (v === 'A' ? 'Submersibles-led' : 'Atelier-led') + ').</b> Figures are examples. This app reads nothing from the game.</p>\n</body>\n</html>\n';
  fs.writeFileSync(path.join(OUT, file), html);
}
// a section head: A = dark capital bar with a state strip; B = book chapter
function head(v, n, title, sub, sumA, sumB, strip, closed) {
  if (v === 'A') return '<div class="bm-bhead"><span class="bm-bhead-strip" aria-hidden="true">' + (strip || []).map(([r, k]) => '<i class="' + r + '" style="--n:' + k + '"></i>').join('') + '</span><div class="bm-bhead-bar"><div><h2>' + title + '</h2><p>' + sub + '</p></div><div class="bm-sum">' + sumA + '</div></div></div>';
  return '<div class="ol-chap' + (closed ? ' ol-closed' : '') + '"><span class="ol-num">' + ROMAN[n] + '</span><div><h2>' + title + '</h2><p class="ol-sub">' + sub + '</p></div><div class="ol-sum">' + sumB + '</div></div>';
}
function lane(o) {
  return '<div class="bm-lane ' + o.st + (o.solid ? ' bm-solid' : '') + (o.thin ? ' bm-thin' : '') + (o.muted ? ' bm-muted' : '') + '">' + sb(o.st + (o.outline ? ' ol-outline' : ''), o.word, o.small || '', o.isWord) +
    '<div class="bm-who"><span class="bm-nm">' + esc(o.name) + '</span>' + (o.facts ? '<span class="bm-facts">' + o.facts + '</span>' : '') + '</div><div class="bm-mid">' + (o.mid || '') + '</div>' +
    '<span class="bm-ans">' + o.ans + (o.ansSmall ? '<small>' + o.ansSmall + '</small>' : '') + '</span>' + (o.noActs ? '' : '<div class="bm-acts">' + (o.act ? '<button class="' + (o.actQuiet ? 'ol-btn-2' : 'ol-btn-p') + '" type="button">' + o.act + '</button>' : '') + more + '</div>') + '</div>';
}
const slab = (kick, h1, sub, n, label, blocks) => '<div class="ol-slab"><div class="ol-sl-id"><span class="ol-kick">' + kick + '</span><h1>' + h1 + '</h1><span class="ol-sl-sub">' + sub + '</span></div><div class="bm-huge"><b>' + n + '</b><small>' + label + '</small></div><div class="ol-sl-ans ol-blocks">' + blocks + '</div></div>';
const bar = (w, role) => '<span class="bm-gbar ' + role + '" aria-hidden="true"><i style="width:' + w + '%"></i></span>';

for (const v of ['A', 'B']) {
  // ----------------------------------------------------------------------------------------------- Atelier: a solved recipe
  const recipes = [['Maple Lumber', 1], ['Maple Clogs', 1], ['Maple Shortbow', 2], ['Bone Harpoon', 3], ['Maple Pattens', 4], ["Amateur's Grinding Wheel", 4], ['Square Maple Shield', 5]];
  const recipeList = v === 'A'
    ? '<div class="bm-lanes">' + recipes.map(([n, lv], i) => lane({ st: i === 0 ? 'ol-r-seal' : 'ol-r-slab', outline: i > 0, solid: i === 0, thin: 1, word: lv, small: 'Lv', name: n, facts: 'Carpenter', ans: '', noActs: 1 })).join('') + '</div>'
    : '<div class="ol-ix-list">' + recipes.map(([n, lv], i) => '<a class="ol-ix' + (i === 0 ? ' ol-on' : '') + '" href="#"><span class="ol-tag">CRP</span><span class="ol-name">' + n + '</span><span class="ol-lead"></span><span class="ol-val ol-lv">' + lv + '</span></a>').join('') + '</div>';
  const fld = (l, val) => '<label class="ol-fld"><span class="ol-lbl">' + l + '</span><input class="ol-fig" value="' + val + '"></label>';
  page('atelier-' + v + '.html', 'Atelier', v, 'Atelier', 'Atelier',
    '<main class="bm-main" style="max-width:var(--content);margin:0 auto">' +
    slab('Crafter · CRP · Lv 1:', 'Maple Lumber', 'Solved in 0.15 s with the stats below. One step, three seconds.', '100%', 'HQ chance',
      sb('ol-r-back', 'Done', 'Progress 9 / 9', 1) + sb('ol-r-out', 80, 'Quality of 80') + sb('ol-r-slab ol-outline', 30, 'Durability of 40') + sb('ol-r-idle', 588, 'CP of 620')) +
    '<div class="v3-two"><section class="ol-chap-wrap">' + head(v, 0, 'Recipe', 'What you will make', fig(gil(1588)) + '<small>RECIPES</small>', '<span class="ol-fig">' + gil(1588) + ' recipes</span>') +
    '<div class="ol-seg" role="group"><button aria-pressed="true" type="button">Recipe</button><button aria-pressed="false" type="button">Stellar missions</button><button aria-pressed="false" type="button">Custom</button></div>' +
    '<label class="ol-fld"><span class="ol-lbl">Search</span><input placeholder="Search recipes"></label>' + recipeList + '</section>' +
    '<section class="ol-chap-wrap">' + head(v, 1, 'Crafter stats', 'Who is making it', 'LV ' + fig(100), '<span class="ol-fig">Lv 100</span>') +
    '<div class="ol-seg ol-jobs" role="group">' + ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'].map((j, i) => '<button type="button" aria-pressed="' + (i === 0) + '">' + j + '</button>').join('') + '</div>' +
    '<div class="v3-fields">' + fld('Craftsmanship', 4900) + fld('Control', 4800) + fld('CP', 620) + fld('Job level', 100) + '</div>' +
    '<div class="v3-checks"><label class="ol-chk"><input type="checkbox" checked> Manipulation</label><label class="ol-chk"><input type="checkbox"> Heart and Soul</label><label class="ol-chk"><input type="checkbox"> Quick Innovation</label><label class="ol-chk"><input type="checkbox" checked> Cosmic tool (Good ×1.75)</label></div>' +
    '<div class="v3-solve"><button class="ol-seal" type="button">Solve <span class="ol-key">Ctrl Enter</span></button><a class="ol-btn-q" href="#">Copy to all jobs</a></div></section></div>' +
    '<section class="ol-chap-wrap">' + head(v, 2, 'The work', 'How to make it', fig(1) + '<small>STEP · 3 S</small>', sb('ol-r-back ol-sm', 'Done', '', 1), [['ol-r-back', 1]]) + '<div class="bm-lanes">' +
    lane({ st: 'ol-r-back', word: 1, small: 'Step', solid: 1, name: 'Delicate Synthesis', facts: 'Progress ' + fig('100%') + ' · Quality ' + fig('50%') + ' · Durability ' + fig(-10) + ' · /ac "Delicate Synthesis" &lt;wait.3&gt;', mid: bar(100, 'ol-r-back'), ans: '3 s', act: 'Copy card', actQuiet: 1 }) +
    '</div></section></main>',
    '<label class="ol-fld"><span class="ol-lbl">Language</span><span class="ol-sel"><select><option>English</option></select></span></label>');

  // ----------------------------------------------------------------------------------------------- Lists: to get
  const L1 = [{ st: 'ol-r-slab', w: 'Done', isWord: 1, muted: 1, name: 'Mustard Eggs', facts: 'need ' + fig(1) + ', have ' + fig(1) + ' · Sold by alehouse wench in South Shroud for ' + fig(58) + ' gil each', ans: 'need ' + fig(1) },
    { st: 'ol-r-back', w: 1, small: 'To get', solid: 1, name: 'Carnage Sword', facts: 'Sold by arms supplier &amp; mender in South Shroud for ' + fig(869) + ' gil each', ans: '869', ansSmall: 'gil', act: 'Have all' }];
  const L2 = [{ st: 'ol-r-back', w: 16, small: 'To get', solid: 1, name: 'Fire Crystal', facts: 'Lv. 95 Mineral Deposit · Shaaloani (X ' + fig(33.1) + ', Y ' + fig(5.8) + ')', ans: 'need ' + fig(16), act: 'Have all' },
    { st: 'ol-r-idle', w: 7, small: 'To get', name: 'Earth Crystal', facts: 'have ' + fig(1) + ' of ' + fig(8) + ' · Lv. 30 Rocky Outcrop · Lower La Noscea', mid: bar(12, 'ol-r-idle'), ans: 'need ' + fig(8), act: 'Have all', actQuiet: 1 },
    { st: 'ol-r-back', w: 24, small: 'To get', solid: 1, name: 'Lightning Crystal', facts: 'Lv. 100 Ephemeral Rocky Outcrop · Living Memory', ans: 'need ' + fig(24), act: 'Have all' },
    { st: 'ol-r-back', w: 6, small: 'To get', solid: 1, name: 'Fire Cluster', facts: 'Lv. 50 Unspoiled Rocky Outcrop · Mor Dhona · open now, closes ' + fig('06:00') + ' Eorzea time', ans: 'need ' + fig(6), act: 'Have all' },
    { st: 'ol-r-out', w: 18, small: 'Later', name: 'Windspeed Water', facts: 'Lv. 100 Legendary Mineral Deposit · opens ' + fig('02:00') + ' Eorzea time, in ' + fig(7) + ' min', ans: 'need ' + fig(18), act: 'Have all', actQuiet: 1 },
    { st: 'ol-r-back', w: 9, small: 'To get', solid: 1, name: 'Ice Cluster', facts: 'Lv. 50 Unspoiled Rocky Outcrop · Mor Dhona (X ' + fig(27.8) + ', Y ' + fig(10.9) + ')', ans: 'need ' + fig(9), act: 'Have all' }];
  const ln = (x) => lane({ st: x.st, word: x.w, small: x.small, isWord: x.isWord, solid: x.solid, muted: x.muted, name: x.name, facts: x.facts, mid: x.mid, ans: x.ans, ansSmall: x.ansSmall, act: x.act, actQuiet: x.actQuiet });
  page('lists-' + v + '.html', 'Lists', v, 'Lists', 'Lists',
    '<div class="bm-layout">' + rail([['lists', 'Lists', 5], ['get', 'To get', 1673], ['craft', 'To craft', 221], ['want', 'Wanted', 10]], 'get') + '<main class="bm-main">' +
    slab('Tamsin Reed · to get:', 'Courtly Lover set', 'One step · prices: all seven data centers · game data 7.57h1', gil(1673), 'items to get', sb('ol-r-back', 1673, 'To get') + sb('ol-r-out', 221, 'To craft') + sb('ol-r-idle', gil(4766), 'To earn')) +
    '<section class="ol-chap-wrap">' + head(v, 0, 'Buy from a merchant', 'Paid in gil · South Shroud', fig(2) + '<small>TO BUY</small>', sb('ol-r-back ol-sm', 1, 'To buy'), [['ol-r-slab', 1], ['ol-r-back', 1]]) + '<div class="bm-lanes">' + L1.map(ln).join('') + '</div></section>' +
    '<section class="ol-chap-wrap">' + head(v, 1, 'Crystals', 'Gathered from nodes', fig(6) + '<small>TO GATHER</small>', sb('ol-r-back ol-sm', 6, 'To gather'), L2.map((x) => [x.st, 1])) + '<div class="bm-lanes">' + L2.map(ln).join('') + '</div></section>' +
    '</main></div>');

  // ----------------------------------------------------------------------------------------------- Bourse: the trip
  const T1 = [['Sanctified Water', [[4, 18900], [2, 19000]], '14 min'], ['Glossy Dried Ether', [[6, 9450]], '31 min'], ['Windsbalm Bay Leaf', [[3, 3850]], '1 h'], ['Splendid Mate Leaves', [[1, 3400], [2, 3420]], '25 min'], ['Dark Rye Flour', [[3, 610]], '25 min']];
  const T2 = [['Wind Parsley', [[3, 3200]], '2 h', 'later'], ['Pearl Grass', [[3, 2950]], '2 days', 'old']];
  const sum = (ps) => ps.reduce((a, p) => a + p[0] * p[1], 0), q = (ps) => ps.reduce((a, p) => a + p[0], 0);
  const lots = (ps) => '<span class="bm-lots" aria-hidden="true">' + ps.map((p) => '<i style="--n:' + p[0] + '"></i>').join('') + '</span>';
  const tl = ([n, ps, seen, st]) => lane({ st: st === 'old' ? 'ol-r-idle' : st === 'later' ? 'ol-r-out' : 'ol-r-back', word: st === 'old' ? 'Old' : st === 'later' ? 'Later' : 'Buy', isWord: 1, solid: !st, name: n,
    facts: 'seen ' + seen + ' ago · ' + ps.map((p) => fig(p[0]) + ' at ' + fig(gil(p[1]))).join(' + '), mid: lots(ps), ans: gil(sum(ps)), ansSmall: 'gil for ' + q(ps), act: st ? '' : 'Bought' });
  const here = T1.reduce((a, x) => a + sum(x[1]), 0);
  const route = '<div class="bm-routebar"><div class="bm-track"><div class="bm-track-line">' + [['Exodus · here', 'ol-r-back'], ['Famfrit', 'ol-r-out'], ['Gilgamesh · home', 'ol-r-out'], ['Siren', 'ol-r-out']].map(([n, r], i) => '<div class="bm-stop ' + r + '"><i>' + (i + 1) + '</i><b>' + n + '</b></div>').join('') +
    '<div class="bm-hop"><em>Europe</em></div><div class="bm-stop bm-opt"><i>5</i><b>Odin · if you go</b></div></div></div><button class="ol-seal bm-desk" type="button">Bought all here</button></div>';
  page('bourse-' + v + '.html', 'Bourse trip', v, 'Bourse', 'Bourse',
    '<div class="bm-layout">' + rail([['trip', 'Trip', 10], ['item', 'Item'], ['profit', 'Profit'], ['watch', 'Watch', 3]], 'trip') + '<main class="bm-main">' +
    slab('Total to spend:', 'Gemdraught batch', fig(5) + ' to buy here for ' + fig(gil(here)) + ' gil · 4 stops, 2 data-center hops', gil(266478), 'gil · Tamsin Reed', sb('ol-r-back', 5, 'Buy here') + sb('ol-r-out', 5, 'Later') + sb('ol-r-idle', 1, 'Old') + sb('ol-r-slab ol-outline', 1, 'Done')) + route +
    '<section class="ol-chap-wrap">' + head(v, 0, v === 'A' ? 'Stop 1 · Exodus' : 'Exodus', 'Stop 1 · Primal · North America · you are here', fig(gil(here)) + '<small>GIL · 5 TO BUY</small>', sb('ol-r-back ol-sm', 5, 'Buy here'), T1.map(() => ['ol-r-back', 1])) + '<div class="bm-lanes">' + T1.map((x) => tl(x)).join('') + '</div></section>' +
    '<section class="ol-chap-wrap">' + head(v, 1, v === 'A' ? 'Stop 2 · Famfrit' : 'Famfrit', 'Stop 2 · Primal · North America', fig(gil(T2.reduce((a, x) => a + sum(x[1]), 0))) + '<small>GIL · 2 ITEMS</small>', sb('ol-r-out ol-sm', 2, 'Later'), [['ol-r-out', 1], ['ol-r-idle', 1]]) + '<div class="bm-lanes">' + T2.map((x) => tl(x)).join('') + '</div></section>' +
    '</main></div>');
}
console.log('one look v3 mock pages in ' + OUT);
