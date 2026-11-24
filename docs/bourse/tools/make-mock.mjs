// Writes the Bourse mock-up pages (docs/bourse-look-spec.md) into docs/bourse/mock/: node docs/bourse/tools/make-mock.mjs
// Static pages, no behaviour. They load the built site's own fonts.css, shared.css, one-look.css and look.js, so every theme
// of the app applies; the layout is docs/bourse/mock/bourse-mock.css. Names are from the pinned game data (7.57h1); every
// price, age and sales figure is an example, computed here once so the screens agree with each other.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'bourse', 'mock');
const SITE = '../../../tracker/command-center/site/';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gil = (n) => Number(n).toLocaleString('en-US');
const fig = (n) => '<span class="ol-fig">' + n + '</span>';

const ICONS = {
  menu: '<path d="M9 6 3 12l6 6"/><rect x="12" y="5" width="4" height="4"/><rect x="17" y="5" width="4" height="4"/><rect x="12" y="11" width="4" height="4"/><rect x="17" y="11" width="4" height="4"/>',
  trip: '<path d="M5 19c4 0 3-6 7-6s3-6 7-6"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="7" r="2"/>',
  item: '<path d="M4 7h16M4 12h11M4 17h7"/><path d="M18 14v6M15 17h6"/>',
  profit: '<path d="M4 20h16M7 20v-5M12 20V8M17 20v-9"/><path d="m5 10 5-5 4 3 5-5"/>',
  watch: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  dots: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
};
const icon = (k, cls = 'bm-ic') => '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[k] + '</svg>';

function header(tools) {
  const nav = [['Home'], ['Tracker'], ['Atelier'], ['Submersibles'], ['Lists'], ['Bourse', 1], ['Settings']]
    .map(([n, on]) => '<a href="#"' + (on ? ' aria-current="page"' : '') + '>' + n + '</a>').join('');
  return '<header class="ol-hdr" data-ol-hdr><div class="ol-hdr-in"><a class="ol-menu" href="#"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.menu + '</svg><span>Main menu</span></a>' +
    '<a class="ol-mark" href="trip.html" aria-label="Eveniunt Bourse"><span class="ol-mk-top">Eveniunt</span><span class="ol-mk-word">Bourse</span><span class="ol-mk-gauge" aria-hidden="true"><i></i><i></i><i></i></span></a>' +
    '<div class="ol-tools">' + (tools || '') + '<a class="bm-tool" href="settings.html">Bourse settings</a></div><nav class="ol-nav" aria-label="Command Center">' + nav + '</nav></div></header>';
}
function rail(here, counts) {
  return '<nav class="bm-rail" aria-label="Bourse views">' + [['trip', 'Trip'], ['item', 'Item'], ['profit', 'Profit'], ['watch', 'Watch']].map(([k, n]) =>
    '<a href="' + k + '.html"' + (k === here ? ' aria-current="page"' : '') + '>' + icon(k) + '<span>' + n + '</span>' + (counts[k] != null ? '<small>' + counts[k] + '</small>' : '') + '</a>').join('') + '</nav>';
}
const FOOT = '<p class="bm-foot"><b>Mock-up.</b> Prices, ages, sales and tax rates are examples, not market data. Item and world names from the game data (7.57h1). Prices on the real screens come from Universalis, a community site that collects what players\' game clients report; this app reads nothing from the game.</p>';
function page(file, title, body, opts = {}) {
  if (opts.seal) body += '<div class="bm-act"><button class="ol-seal" type="button">' + opts.seal + '</button></div>';
  const html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(title) + ' · Bourse mock-up</title>\n' +
    '<link rel="stylesheet" href="' + SITE + 'fonts.css">\n<link rel="stylesheet" href="' + SITE + 'shared.css">\n<link rel="stylesheet" href="' + SITE + 'one-look.css">\n<link rel="stylesheet" href="bourse-mock.css">\n' +
    '<script>try { var t = (JSON.parse(localStorage.getItem(\'eveniunt-tracker-ui\') || \'{}\') || {}).theme; if (t === \'light\' || t === \'dark\') document.documentElement.setAttribute(\'data-theme\', t); } catch (e) { /* none */ }</script>\n' +
    '</head>\n<body class="bm ol-page">\n<script src="' + SITE + 'look.js"></script>\n' + header(opts.tools) + '\n' + body + '\n' + FOOT + (opts.after || '') + '\n</body>\n</html>\n';
  fs.writeFileSync(path.join(OUT, file), html);
}
const sb = (cls, b, i, w) => '<span class="ol-sb ' + cls + '"><b' + (w ? ' class="ol-w"' : '') + '>' + b + '</b>' + (i ? '<i>' + i + '</i>' : '') + '</span>';
const chap = (num, h, sub, sum, closed) => '<div class="ol-chap' + (closed ? ' ol-closed' : '') + '"><span class="ol-num">' + (closed ? '<svg class="ol-chev" viewBox="0 0 24 24" aria-hidden="true">' + ICONS.chev + '</svg> ' : '') + num + '</span><div><h2>' + h + '</h2><p class="ol-sub">' + sub + '</p></div><div class="ol-sum">' + sum + '</div></div>';
const more = '<button class="ol-btn-2 bm-more" type="button" aria-label="More">' + icon('dots') + '</button>';

// ------------------------------------------------------------------------------------------------- the trip (example figures)
const HOME = 'Gilgamesh';
const TRIP = [
  { dc: 'Primal', note: 'Data center 1 of 2 · the biggest savings', stops: [
    { world: 'Exodus', items: [
      { n: 'Sanctified Water', q: 6, p: 18900, home: 20400, facts: '4 at ' + gil(18900) + ' · 2 more at ' + gil(19000), seen: '14 min ago', st: 'buy', p2: 19000, q1: 4 },
      { n: 'Glossy Dried Ether', q: 6, p: 9450, home: 11800, facts: '6 at ' + gil(9450), seen: '31 min ago', st: 'buy' },
      { n: 'Windsbalm Bay Leaf', q: 3, p: 3850, home: 4900, facts: '3 at ' + gil(3850), seen: '1 h ago', st: 'buy' },
      { n: 'Splendid Mate Leaves', q: 3, p: 3400, home: 4100, facts: '3 at ' + gil(3400), seen: '25 min ago', st: 'buy' },
      { n: 'Dark Rye Flour', q: 3, p: 610, home: 840, facts: '3 at 610', seen: '25 min ago', st: 'buy' },
      { n: 'Sungilt Aethersand', q: 6, p: 2180, home: 2650, facts: '6 at ' + gil(2180), seen: '31 min ago', st: 'done' }] },
    { world: 'Famfrit', items: [
      { n: 'Wind Parsley', q: 3, p: 3200, home: 4500, facts: '3 at ' + gil(3200), seen: '2 h ago', st: 'buy' },
      { n: 'Pearl Grass', q: 3, p: 2950, home: 3600, facts: '3 at ' + gil(2950), seen: '2 days ago', st: 'old' }] }] },
  { dc: 'Aether', note: 'Data center 2 of 2 · your home', stops: [
    { world: 'Gilgamesh', home: true, items: [
      { n: 'Water Cluster', q: 36, p: 410, home: 410, facts: '36 at ' + gil(410), seen: '9 min ago', st: 'buy' },
      { n: 'Lightning Cluster', q: 36, p: 388, home: 388, facts: '20 at 380 · 16 more at 398', seen: '9 min ago', st: 'buy' }] },
    { world: 'Siren', items: [
      { n: 'Eucalyptus', q: 3, p: 4100, home: 5200, facts: '3 at ' + gil(4100), seen: '48 min ago', st: 'buy' }] }] },
];
let total = 0, saved = 0, toBuy = 0, done = 0, stops = 0;
TRIP.forEach((d) => d.stops.forEach((s) => { stops++; s.items.forEach((x) => { const v = x.q1 ? x.q1 * x.p + (x.q - x.q1) * x.p2 : x.q * x.p; x.sum = v; total += v; saved += x.q * x.home - v; if (x.st === 'done') done++; else toBuy++; }); }));
const NONE = [{ n: "Kozama'uka Chamomile", q: 3 }];

function tripRow(x, here) { // the stop you are at: solid (buy now); later stops: outlined (waiting)
  const b = x.st === 'done' ? sb('ol-done', 'Done', '', 1) : x.st === 'old' ? sb('ol-r-idle ol-outline', x.q, 'Old') : here ? sb('ol-r-market', x.q, 'To buy') : sb('ol-r-market ol-outline', x.q, 'Later');
  const cls = x.st === 'buy' ? (here ? ' bm-solid ol-r-market' : ' ol-r-market') : x.st === 'old' ? ' ol-r-idle' : ' ol-r-back';
  return '<div class="bm-row' + cls + '">' + b + '<div class="bm-who"><span class="bm-nm">' + esc(x.n) + '</span><span class="bm-facts">seen ' + x.seen + (x.st === 'old' ? ', older than your 1-day limit' : '') + ' · ' + x.facts.replace(/(\d[\d,]*)/g, (m) => fig(m)) + '</span></div>' +
    '<div class="bm-mid"><span class="bm-lead" aria-hidden="true"></span></div><span class="bm-ans">' + gil(x.sum) + '<small>gil</small></span><div class="bm-acts">' + (x.st === 'done' ? '<a class="ol-btn-q" href="#">Undo</a>' : '<button class="ol-btn-2" type="button">Bought</button>') + more + '</div></div>';
}
function tripBody(version) {
  const ansA = '<div class="ol-sl-ans ol-blocks"><span class="ol-numeral bm-numgap">' + gil(total) + '<small>GIL TO SPEND</small></span>' + sb('ol-r-market', stops, 'Stops') + sb('ol-r-slab ol-outline', 2, 'Data-center hops') + '</div>';
  const ansB = '<div class="ol-sl-ans ol-blocks"><span class="ol-numeral bm-numgap">' + gil(saved) + '<small>GIL SAVED AGAINST ' + HOME.toUpperCase() + '</small></span>' + sb('ol-r-slab ol-outline', gil(Math.round(total / 1000)) + 'k', 'To spend') + sb('ol-r-market', stops, 'Stops') + '</div>';
  let out = '<div class="bm-layout">' + rail('trip', { trip: toBuy, watch: 3 }) + '<main class="bm-main">' +
    '<div class="ol-slab"><div class="ol-sl-id"><span class="ol-kick">Shopping trip · Tamsin Reed</span><h1>Gemdraught batch</h1><span class="ol-sl-sub">From 2 lists · fewest stops, at most 10% more · all of North America</span><div class="ol-sl-links"><a href="#">Choose lists</a></div></div>' + (version === 'B' ? ansB : ansA) + '</div>' +
    '<div class="bm-here">' + sb('ol-r-market', 'Stop 1', 'You are here', 1) + '<div><h2>Exodus <span style="font:italic 400 17px var(--f-serif);color:var(--ink-2)">Primal</span></h2><p>' + fig(TRIP[0].stops[0].items.filter((x) => x.st !== 'done').length) + ' to buy here for ' + fig(gil(TRIP[0].stops[0].items.filter((x) => x.st !== 'done').reduce((a, x) => a + x.sum, 0))) + ' gil · then Famfrit, then home to Aether</p></div><div class="bm-here-acts"><a class="ol-btn-q" href="#">Copy route</a><button class="ol-seal bm-desk" type="button">Bought all here</button></div></div>';
  TRIP.forEach((d, di) => {
    const dSum = d.stops.reduce((a, s) => a + s.items.reduce((b, x) => b + x.sum, 0), 0);
    out += '<section class="ol-chap-wrap">' + chap(['I', 'II'][di], d.dc, d.note, sb('ol-r-market ol-sm', d.stops.length, 'Stops') + '<span class="ol-fig">' + gil(dSum) + ' gil</span>') + '<div class="bm-ledger">';
    d.stops.forEach((s) => {
      const sSum = s.items.reduce((b, x) => b + x.sum, 0);
      out += '<div class="ol-subgroup' + (s.world === 'Exodus' ? ' bm-now' : '') + '"><span><b>' + s.world + '</b>' + (s.home ? ' · home world' : '') + (s.world === 'Exodus' ? ' <span class="ol-lbl bm-here-tag">You are here</span>' : '') + '</span><span class="ol-fig">' + s.items.length + ' items · ' + gil(sSum) + ' gil</span></div>' + s.items.map((x) => tripRow(x, s.world === 'Exodus')).join('');
    });
    out += '</div></section>';
  });
  out += '<section class="ol-chap-wrap">' + chap('III', 'Not on the market now', 'No listing of the quality you need in North America', sb('ol-r-locked ol-hatch ol-sm', NONE.length, 'None'), true) +
    chap('IV', 'Bought', 'Ticked on this trip', sb('ol-done ol-sm', done, 'Done'), true) + '</section>' +
    '<p class="bm-hint">You can buy on another data center but not sell there. Travel stops 30 minutes before maintenance.</p></main></div>';
  return out;
}
page('trip.html', 'Shopping trip', tripBody('A'), { seal: 'Bought all here' });
page('trip-saved.html', 'Shopping trip, savings first', tripBody('B'), { seal: 'Bought all here' });

// ------------------------------------------------------------------------------------------------- the item: a price ladder
function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const R = rnd(42);
const DCS = [['Aether', ['Adamantoise', 'Cactuar', 'Faerie', 'Gilgamesh', 'Jenova', 'Midgardsormr', 'Sargatanas', 'Siren']], ['Primal', ['Behemoth', 'Excalibur', 'Exodus', 'Famfrit', 'Hyperion', 'Lamia', 'Leviathan', 'Ultros']],
  ['Crystal', ['Balmung', 'Brynhildr', 'Coeurl', 'Diabolos', 'Goblin', 'Malboro', 'Mateus', 'Zalera']], ['Dynamis', ['Cuchulainn', 'Golem', 'Halicarnassus', 'Kraken', 'Maduin', 'Marilith', 'Rafflesia', 'Seraph']]];
const AGES = ['9m', '14m', '22m', '40m', '1h', '2h', '3h', '5h', '9h', '20h', '2d'];
const ladder = DCS.map(([dc, ws]) => [dc, ws.map((w) => {
  if (w === 'Exodus') return { w, p: 18900, age: '14m' };
  if (w === 'Gilgamesh') return { w, p: 20400, age: '9m', home: 1 };
  if (w === 'Lamia' || w === 'Golem' || w === 'Zalera') return { w, p: null, age: '' };
  return { w, p: 19100 + Math.round(R() * 60) * 50, age: AGES[Math.floor(R() * AGES.length)] };
}).sort((a, b) => (a.p == null) - (b.p == null) || a.p - b.p)]);
const listed = ladder.reduce((a, [, ws]) => a + ws.filter((x) => x.p != null).length, 0);
function ixLine(x) {
  const old = /d$/.test(x.age) || /^2\dh$/.test(x.age);
  return '<a class="ol-ix' + (x.w === 'Exodus' ? ' ol-on' : '') + '" href="#"><span class="ol-tag">' + (x.home ? 'Home' : '') + '</span><span class="ol-name">' + x.w + '</span><span class="ol-lead"></span>' +
    (x.p == null ? '<span class="ol-val ol-txt">none</span>' : '<span class="ol-val">' + gil(x.p) + '</span><span class="ol-val ol-txt">' + (old ? 'old · ' : '') + x.age + '</span>') + '</a>';
}
const sales = []; for (let d = 0; d < 7; d++) { const n = 4 + Math.floor(R() * 5); for (let k = 0; k < n; k++) sales.push({ d: d + R(), p: 18200 + Math.round(R() * 46) * 50 }); }
const sp = sales.map((s) => s.p).sort((a, b) => a - b), median = sp[Math.floor(sp.length / 2)], low = sp[0], high = sp[sp.length - 1], perDay = (sales.length / 7).toFixed(1);
function strip() {
  const W = 720, H = 150, x0 = 56, x1 = W - 8, y0 = 12, y1 = H - 28, lo = 18000, hi = 20600;
  const X = (d) => x0 + (d / 7) * (x1 - x0), Y = (p) => y1 - ((p - lo) / (hi - lo)) * (y1 - y0);
  let s = '<svg class="bm-strip" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + sales.length + ' sales over 7 days, middle price ' + gil(median) + ' gil (example)">';
  [18000, 19000, 20000].forEach((p) => { s += '<line class="ax" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(p) + '" y2="' + Y(p) + '"/><text x="0" y="' + (Y(p) + 4) + '">' + gil(p) + '</text>'; });
  s += '<line class="mid" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(median) + '" y2="' + Y(median) + '"/><text class="lb" x="' + (x1 - 64) + '" y="' + (Y(median) - 6) + '">MIDDLE</text>';
  sales.forEach((v) => { s += '<circle class="dot" cx="' + X(v.d).toFixed(1) + '" cy="' + Y(v.p).toFixed(1) + '" r="4.5"/>'; });
  ['7 days ago', '', '', '', '', '', 'today'].forEach((t, i) => { if (t) s += '<text class="lb" x="' + (i ? x1 - 40 : x0) + '" y="' + (H - 6) + '">' + t.toUpperCase() + '</text>'; });
  return s + '</svg>';
}
const half = (i) => '<div class="' + (i ? 'bm-col2' : '') + '">' + ladder.slice(i * 2, i * 2 + 2).map(([dc, ws]) => '<div class="ol-subgroup"><span>' + dc + '</span><span class="ol-fig">' + ws.filter((x) => x.p != null).length + ' of 8</span></div><div class="ol-ix-list">' + ws.map(ixLine).join('') + '</div>').join('') + '</div>';
page('item.html', 'Item prices',
  '<div class="bm-layout">' + rail('item', { trip: toBuy, watch: 3 }) + '<main class="bm-main">' +
  '<div class="ol-slab"><div class="ol-sl-id"><span class="ol-kick">Item · for 6 units</span><h1>Sanctified Water</h1><span class="ol-sl-sub">Listings and sales on every world of North America, normal quality</span><div class="ol-sl-links"><a href="#">Copy name</a><a href="#">Add to a list</a></div></div>' +
  '<div class="ol-sl-ans ol-blocks"><span class="ol-numeral bm-numgap">' + gil(18900) + '<small>GIL EACH FOR 6 · CHEAPEST ON EXODUS, PRIMAL</small></span>' + sb('ol-r-back', '14 min', 'Seen', 1) + sb('ol-r-slab ol-outline', perDay, 'Sold a day') + '</div></div>' +
  '<div class="bm-bar"><div class="ol-seg" role="group" aria-label="Quality"><button type="button" aria-pressed="true">Normal quality</button><button type="button" aria-pressed="false">High quality</button></div><button class="ol-seal bm-desk" type="button">Watch this item</button></div>' +
  '<div class="bm-two"><section class="ol-chap-wrap">' + chap('I', 'Cheapest on each world', 'Listings now, cheapest first', sb('ol-r-back ol-sm', listed, 'of 32 listed')) + '<div class="bm-ladder">' + half(0) + half(1) + '</div></section>' +
  '<section class="ol-chap-wrap">' + chap('II', 'Recent sales', 'What actually sold, last 7 days', '<span class="ol-fig">' + sales.length + ' sales</span>') +
  '<div class="bm-figs">' + sb('ol-r-slab ol-outline', gil(low), 'Low') + sb('ol-r-back', gil(median), 'Middle') + sb('ol-r-slab ol-outline', gil(high), 'High') + '</div>' + strip() +
  '<p class="bm-hint">Each dot is one sale on any world of the region. The line is the middle price. Older than 7 days: open "30 days".</p>' +
  chap('III', 'Made from, used in', 'Lists and the Atelier', '<span class="ol-fig">4 recipes</span>', true) + '</section></div></main></div>',
  { seal: 'Watch this item', tools: '<label class="ol-fld ol-w320"><span class="ol-lbl">Find an item</span><input type="search" value="Sanctified Water"></label>' });

// ------------------------------------------------------------------------------------------------- profit: a leaderboard
const PROFIT = [
  ['Mate Cookie', 'CUL', 100, 1, 38240, 41, 12060, 2], ['Ceviche', 'CUL', 100, 1, 31580, 28, 14900, 1], ['Grade 2 Gemdraught of Strength', 'ALC', 100, 1, 27920, 64, 34110, 0],
  ['Grade 2 Gemdraught of Dexterity', 'ALC', 100, 1, 26300, 52, 34390, 0], ['Grade 2 Gemdraught of Mind', 'ALC', 100, 1, 24750, 47, 33640, 0], ['Grade 2 Gemdraught of Intelligence', 'ALC', 100, 1, 23900, 39, 33980, 0, 'old'],
  ['Rroneek Steak', 'CUL', 99, 1, 18640, 22, 7310, 1], ["Ra'Kaznar Ingot", 'BSM', 98, 0, 9120, 85, 11480, 5], ['Claro Walnut Lumber', 'CRP', 98, 0, 6230, 70, 9050, 5, 'cant'],
];
const SLOW = [['Grade 2 Gemdraught of Vitality', 'ALC', 100, 1, 21400, 0.6, 33700, 0]];
const top = PROFIT[0][4];
function profitRow(r, i, slow) {
  const [n, job, lv, hq, g, per, cost, gath, flag] = r;
  const b = flag === 'old' ? sb('ol-r-idle ol-outline', 'Old', '', 1) : flag === 'cant' ? sb('ol-r-locked ol-hatch', i + 1, '') : sb('bm-r-gil', i + 1, '');
  const facts = job + ' · Lv. ' + fig(lv) + ' · sells ' + fig(per) + ' a day · materials ' + fig(gil(cost)) + (gath ? ' (' + fig(gath) + ' gathered, at market value)' : '') + (flag === 'cant' ? ' · you can\'t make this yet' : flag === 'old' ? ' · sale price 2 days old' : '');
  return '<div class="bm-row bm-barrow' + (i === 0 && !slow ? ' bm-solid bm-r-gil' : '') + '">' + b + '<div class="bm-who"><span class="bm-nm">' + esc(n) + (hq ? '<em>HQ</em>' : '') + '</span><span class="bm-facts">' + facts + '</span></div>' +
    '<div class="bm-mid"><span class="bm-gbar bm-r-gil" aria-hidden="true"><i style="width:' + Math.round((g / top) * 100) + '%"></i></span></div><span class="bm-ans bm-big">' + gil(g) + '</span><div class="bm-acts"><button class="ol-btn-2" type="button">Solve</button>' + more + '</div></div>';
}
const TAX = [['Ishgard', 3], ['Old Sharlayan', 3], ['Kugane', 5], ['The Crystarium', 5], ['Tuliyollal', 5], ['Limsa Lominsa', 5], ['Gridania', 5], ["Ul'dah", 5]];
page('profit.html', 'Profit per craft',
  '<div class="bm-layout">' + rail('profit', { trip: toBuy, watch: 3 }) + '<main class="bm-main">' +
  '<div class="ol-slab"><div class="ol-sl-id"><span class="ol-kick">Profit per craft · an estimate</span><h1>Best crafts to sell</h1><span class="ol-sl-sub">All recipes · sold on Gilgamesh, tax 3% (Ishgard, lowest this week) · materials at the cheapest of merchant and market</span><div class="ol-sl-links"><a href="#">Filter: all jobs, all levels</a></div></div>' +
  '<div class="ol-sl-ans ol-blocks"><span class="ol-numeral bm-numgap">' + gil(top) + '<small>GIL PER CRAFT · MATE COOKIE HQ</small></span>' + sb('ol-r-locked ol-hatch', gil(8644), 'To price') + '</div></div>' +
  '<div class="bm-bar"><div class="ol-seg" role="group" aria-label="Ranked by"><button type="button" aria-pressed="true">Ranked by recent sales</button><button type="button" aria-pressed="false">By cheapest listing</button></div><button class="ol-seal bm-desk" type="button">Rank these crafts</button></div>' +
  '<section class="ol-chap-wrap">' + chap('I', 'Ranking', 'Gil per craft after tax, on one scale', '<span class="ol-fig">' + gil(1212) + ' of ' + gil(9856) + '</span>') + '<div class="bm-ledger">' + PROFIT.map((r, i) => profitRow(r, i)).join('') +
  '<div class="ol-subgroup"><span>Sells less than once a day</span><span class="ol-fig">' + SLOW.length + '</span></div>' + SLOW.map((r, i) => profitRow(r, PROFIT.length + i, 1)).join('') + '</div></section>' +
  '<section class="ol-chap-wrap">' + chap('II', 'Where to sell this week', 'Tax on Gilgamesh by city, read 3 hours ago', sb('ol-r-back ol-sm', '3%', 'Lowest')) +
  '<div class="ol-ix-list" style="max-width:640px">' + TAX.map(([c, t], i) => '<a class="ol-ix' + (i === 0 ? ' ol-on' : '') + '" href="#"><span class="ol-tag">' + (i === 0 ? 'Used' : '') + '</span><span class="ol-name">' + c + '</span><span class="ol-lead"></span><span class="ol-val">' + t + '%</span></a>').join('') + '</div>' +
  '<p class="bm-hint">Profit uses the lowest rate. Your retainers sell where you placed them; moving them is done in the game.</p></section></main></div>', { seal: 'Rank these crafts' });

// ------------------------------------------------------------------------------------------------- watch list
const BELOW = [['Sanctified Water', 15000, 12400, 'Famfrit', '22 min'], ['Glossy Dried Ether', 10000, 9450, 'Exodus', '31 min'], ['Water Cluster', 450, 410, 'Gilgamesh', '9 min']];
const ABOVE = [["Ra'Kaznar Ore", 600, 2500, 'Balmung', '1 h'], ['Claro Walnut Log', 900, 1260, 'Siren', '40 min'], ['Turali Corn Oil', 1500, 1980, 'Cactuar', '3 h'], ['Dark Rye Flour', 700, 840, 'Kraken', '5 h'], ['Splendid Mate Leaves', 3000, 4100, 'Ultros', '9 h']];
const wRow = (r, below) => '<div class="bm-row' + (below ? ' bm-solid ol-r-back' : ' ol-r-idle') + '">' + (below ? sb('ol-r-back', 'Under', '', 1) : sb('ol-r-idle ol-outline', 'Above', '', 1)) +
  '<div class="bm-who"><span class="bm-nm">' + esc(r[0]) + '</span><span class="bm-facts">seen ' + r[4] + ' ago · target ' + fig(gil(r[1])) + ' · cheapest ' + fig(gil(r[2])) + ' on ' + r[3] + '</span></div><div class="bm-mid"><span class="bm-lead" aria-hidden="true"></span></div>' +
  '<span class="bm-ans">' + gil(Math.abs(r[1] - r[2])) + '<small>gil ' + (below ? 'under' : 'over') + '</small></span><div class="bm-acts">' + (below ? '<button class="ol-btn-2" type="button">Add to trip</button>' : '') + more + '</div></div>';
page('watch.html', 'Watch list',
  '<div class="bm-layout">' + rail('watch', { trip: toBuy, watch: 3 }) + '<main class="bm-main">' +
  '<div class="ol-slab"><div class="ol-sl-id"><span class="ol-kick">Watch list · 9 items</span><h1>Watched prices</h1><span class="ol-sl-sub">Alerts ring only while this app is open in a tab · checked every 15 minutes</span><div class="ol-sl-links"><a href="#">Alert settings</a></div></div>' +
  '<div class="ol-sl-ans ol-blocks"><span class="ol-numeral bm-numgap">' + BELOW.length + '<small>UNDER TARGET NOW</small></span>' + sb('ol-r-idle ol-outline', ABOVE.length, 'Above') + sb('ol-r-locked ol-hatch', 1, 'No data') + '</div></div>' +
  '<div class="bm-bar"><span class="bm-hint">Targets are per unit, normal quality unless marked.</span><button class="ol-seal bm-desk" type="button">Add an item</button></div>' +
  '<section class="ol-chap-wrap">' + chap('I', 'Under target', 'Cheapest listing in North America', sb('ol-r-back ol-sm', BELOW.length, 'Under')) + '<div class="bm-ledger">' + BELOW.map((r) => wRow(r, 1)).join('') + '</div></section>' +
  '<section class="ol-chap-wrap">' + chap('II', 'Above target', 'Waiting for the price to fall', sb('ol-r-idle ol-outline ol-sm', ABOVE.length, 'Above')) + '<div class="bm-ledger">' + ABOVE.map((r) => wRow(r, 0)).join('') + '</div></section>' +
  '<section class="ol-chap-wrap">' + chap('III', 'No price', 'No listing or sale reported', sb('ol-r-locked ol-hatch ol-sm', 1, 'None'), true) + '</section></main></div>',
  { seal: 'Add an item', after: '<div class="bm-status" role="status">Sanctified Water is under your target on Famfrit: ' + fig(gil(12400)) + ' gil. <a href="#">Open</a></div>' });

// ------------------------------------------------------------------------------------------------- settings sheet over the trip
const stepper = (v) => '<span class="ol-step ol-sm"><button type="button" aria-label="Less">−</button><span class="ol-fig">' + v + '</span><button type="button" aria-label="More">+</button></span>';
page('settings.html', 'Bourse settings', tripBody('A') + '<div class="bm-scrim" aria-hidden="true"></div><aside class="bm-sheet" role="dialog" aria-label="Bourse settings">' +
  '<div class="bm-sheet-hd"><h2>Bourse settings</h2><button class="ol-btn-2" type="button">Close</button></div>' +
  chap('I', 'Prices', 'Where and how fresh', '') + '<div class="bm-fields"><label class="ol-fld"><span class="ol-lbl">Prices from</span><span class="ol-sel"><select><option>Follow the Tracker: all of North America</option></select></span></label>' +
  '<div class="bm-pair"><div class="bm-lbl"><span class="ol-lbl">Old after (days)</span>' + stepper(1) + '</div><div class="bm-lbl"><span class="ol-lbl">Left out of profit after (days)</span>' + stepper(7) + '</div></div></div>' +
  chap('II', 'Shopping trip', 'How it splits and what a tick does', '') + '<div class="bm-fields"><div class="bm-lbl"><span class="ol-lbl">Comes first</span><div class="ol-seg" role="group"><button aria-pressed="true" type="button">Fewest stops</button><button aria-pressed="false" type="button">Cheapest</button><button aria-pressed="false" type="button">Trade-off</button></div></div>' +
  '<div class="bm-lbl"><span class="ol-lbl">Pay at most this much more to save a stop (%)</span>' + stepper(10) + '</div>' +
  '<label class="ol-fld"><span class="ol-lbl">Route</span><span class="ol-sel"><select><option>Fewest data-center hops, biggest savings first</option></select></span></label>' +
  '<div class="bm-lbl"><span class="ol-lbl">When I tick an item bought</span><div class="ol-seg" role="group"><button aria-pressed="true" type="button">Tick only</button><button aria-pressed="false" type="button">Also add to “I have” in Lists</button></div></div></div>' +
  chap('III', 'Profit', 'What a craft costs and earns', '') + '<div class="bm-fields"><label class="ol-chk"><input type="checkbox" checked> Count gathered materials at market value</label>' +
  '<label class="ol-fld"><span class="ol-lbl">Tax</span><span class="ol-sel"><select><option>The lowest city rate this week</option></select></span></label></div>' +
  chap('IV', 'Alerts', 'Only while the app is open', '') + '<div class="bm-fields"><label class="ol-chk"><input type="checkbox" checked> Tell me when a watched item is under its target</label><p class="bm-hint">Checked every 15 minutes while a tab is open. A closed app cannot alert.</p></div></aside>');

// ------------------------------------------------------------------------------------------------- the empty trip
page('empty.html', 'No trip yet',
  '<div class="bm-layout">' + rail('trip', { watch: 3 }) + '<main class="bm-main"><section class="bm-empty"><div class="bm-empty-copy"><span class="ol-kick bm-plate">Nothing to buy</span><h1>No trip yet</h1>' +
  '<p>Pick the lists you are buying for, and the Bourse plans where to buy each item across North America, stop by stop.</p><div class="bm-steps">' +
  [['ol-r-market', 'Choose lists', 'Their market items become the shopping list.'], ['bm-r-gil', 'Set the split', 'Fewest stops, cheapest, or your own trade-off.'], ['ol-r-back', 'Buy world by world', 'Tick each item as you buy it.']]
    .map(([r, b, s], i) => '<div class="bm-step">' + sb(r, i + 1, '') + '<div><b>' + b + '</b><span>' + s + '</span></div></div>').join('') +
  '</div><div><button class="ol-seal" type="button">Choose lists</button></div></div><div class="bm-deco" aria-hidden="true"><svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice">' +
  '<path class="rt" d="M120 600 C 160 480, 320 470, 300 360 S 120 240, 220 120 S 340 40, 360 20"/>' +
  '<g transform="translate(120 600) skewX(-25)"><rect class="stp ol-r-market" x="-26" y="-18" width="52" height="36"/></g>' +
  '<g transform="translate(300 360) skewX(-25)"><rect class="stp bm-r-gil" x="-26" y="-18" width="52" height="36"/></g>' +
  '<g transform="translate(220 120) skewX(-25)"><rect class="stp ol-r-back" x="-26" y="-18" width="52" height="36"/></g>' +
  '<text class="lb" x="40" y="60">YOUR ROUTE</text></svg></div></section></main></div>');

// ------------------------------------------------------------------------------------------------- states the main pictures do not show
const note = (role, lbl, text, act) => '<div class="bm-note ' + role + '"><div><span class="ol-lbl">' + lbl + '</span><br>' + text + '</div>' + (act ? '<a class="ol-btn-q" href="#">' + act + '</a>' : '') + '</div>';
const eline = (text, act) => '<div class="bm-eline"><span>' + text + '</span>' + (act ? '<a class="ol-btn-q" href="#">' + act + '</a>' : '') + '</div>';
page('states.html', 'States',
  '<div class="bm-layout">' + rail('profit', { trip: toBuy, watch: 0 }) + '<main class="bm-main">' +
  '<div class="ol-slab"><div class="ol-sl-id"><span class="ol-kick">States sheet · not a screen</span><h1>When prices are missing</h1><span class="ol-sl-sub">Each part below appears on the screen it belongs to, in place of its normal content</span></div>' +
  '<div class="ol-sl-ans ol-blocks">' + sb('ol-r-bad ol-outline', 'Failed', '', 1) + sb('ol-r-idle ol-outline', 'Paused', '', 1) + sb('ol-r-locked ol-hatch', 'Unknown', '', 1) + '</div></div>' +
  '<section class="ol-chap-wrap">' + chap('I', 'Notices', 'One at a time, above the first chapter', '<span class="ol-fig">4 kinds</span>') +
  note('ol-r-bad', 'Prices not fetched', 'The price site could not be reached. Showing the prices seen at ' + fig('14:02') + ' on this device; anything older than your limit is marked old.', 'Try again') +
  note('ol-r-idle', 'Slowed down', 'The price site asked this app to wait. The next try is in ' + fig(4) + ' minutes; Refresh does not skip this pause.', '') +
  note('ol-r-idle', 'Ranking budget spent', 'This session has asked for ' + fig(gil(3000)) + ' prices, the most it asks for at once. ' + fig(gil(1212)) + ' crafts are ranked; the rest wait for the next session.', '') +
  note('ol-r-bad', 'Maintenance soon', 'All worlds go down at ' + fig('15:00') + '. Data-center travel stops at ' + fig('14:30') + ': buy on other data centers first.', '') + '</section>' +
  '<section class="ol-chap-wrap">' + chap('II', 'Empty parts', 'What a part says when it has nothing yet', '<span class="ol-fig">3 kinds</span>') +
  eline('<b>Choose your home world</b> to rank profit and see where to sell. Prices to buy work without it.', 'Choose a home world') +
  eline('<b>Nothing watched yet.</b> Add an item here, or press "Watch this item" on any item.', 'Add an item') +
  eline('<b>Find an item</b> in the search above to see its price on every world of North America.', '') + '</section>' +
  '<section class="ol-chap-wrap">' + chap('III', 'Rows in edge states', 'Drawn the same way on every screen', '<span class="ol-fig">3 kinds</span>') + '<div class="bm-ledger">' +
  '<div class="bm-row bm-barrow ol-r-bad">' + sb('ol-r-bad ol-outline', 'Loss', '', 1) + '<div class="bm-who"><span class="bm-nm">Grade 2 Gemdraught of Intelligence<em>HQ</em></span><span class="bm-facts">sells ' + fig(39) + ' a day · materials ' + fig(gil(36120)) + ' · sale middle ' + fig(gil(34800)) + ' after tax</span></div><div class="bm-mid"><span class="bm-gbar bm-r-gil" aria-hidden="true"><i class="bm-neg"></i></span></div><span class="bm-ans bm-big">−' + gil(1320) + '</span><div class="bm-acts"><button class="ol-btn-2" type="button">Solve</button>' + more + '</div></div>' +
  '<div class="bm-row ol-r-locked">' + sb('ol-r-locked ol-hatch', 'HQ only', '', 1) + '<div class="bm-who"><span class="bm-nm">Kozama\'uka Chamomile</span><span class="bm-facts">no normal-quality listing in North America · ' + fig(2) + ' high quality at ' + fig(gil(24800)) + ' on Seraph</span></div><div class="bm-mid"><span class="bm-lead" aria-hidden="true"></span></div><span class="bm-ans bm-word">unknown<small>normal quality</small></span><div class="bm-acts">' + more + '</div></div>' +
  '<div class="bm-row ol-r-idle">' + sb('ol-r-idle ol-outline', 'Bait?', '', 1) + '<div class="bm-who"><span class="bm-nm">Sanctified Water</span><span class="bm-facts">seen 3 min ago · 1 at ' + fig(2000) + ' on Hyperion, far below recent sales (' + fig(gil(19300)) + ') · the rest priced from ' + fig(gil(18900)) + '</span></div><div class="bm-mid"><span class="bm-lead" aria-hidden="true"></span></div><span class="bm-ans">' + gil(2000 + 5 * 18900) + '<small>gil for 6</small></span><div class="bm-acts"><button class="ol-btn-2" type="button">Bought</button>' + more + '</div></div>' +
  '</div></section></main></div>');

console.log('mock pages in ' + OUT + ': total ' + total + ', saved ' + saved + ', stops ' + stops + ', to buy ' + toBuy);
