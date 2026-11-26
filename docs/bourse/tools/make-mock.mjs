// Writes the Bourse mock-up pages, look v3 (Atelier-led) (docs/bourse-look-spec.md) into docs/bourse/mock/: node docs/bourse/tools/make-mock.mjs
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
    '<div class="ol-tools">' + (tools || '') + '<a class="bm-tool" href="settings.html">Bourse settings</a><span class="ol-lbl bm-mock">Mock-up · example figures</span></div><nav class="ol-nav" aria-label="Command Center">' + nav + '</nav></div></header>';
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
    '</head>\n<body class="bm bm-book ol-page' + (opts.bodyClass ? ' ' + opts.bodyClass : '') + '">\n<script src="' + SITE + 'look.js"></script>\n' + header(opts.tools) + '\n' + body + '\n' + FOOT + (opts.after || '') + '\n</body>\n</html>\n';
  fs.writeFileSync(path.join(OUT, file), html);
}
const sb = (cls, b, i, w) => '<span class="ol-sb ' + cls + '"><b' + (w ? ' class="ol-w"' : '') + '>' + b + '</b>' + (i ? '<i>' + i + '</i>' : '') + '</span>';
const chap = (num, h, sub, sum, closed) => '<div class="ol-chap' + (closed ? ' ol-closed' : '') + '"><span class="ol-num">' + (closed ? '<svg class="ol-chev" viewBox="0 0 24 24" aria-hidden="true">' + ICONS.chev + '</svg> ' : '') + num + '</span><div><h2>' + h + '</h2><p class="ol-sub">' + sub + '</p></div><div class="ol-sum">' + sum + '</div></div>';
const more = '<button class="ol-btn-2 bm-more" type="button" aria-label="More">' + icon('dots') + '</button>';

// ------------------------------------------------------------------------------------------------- shared pieces of look v2
const STATE = { buy: ['ol-r-back', 'Buy'], later: ['ol-r-out', 'Later'], old: ['ol-r-idle', 'Old'], done: ['ol-r-slab', 'Done'], none: ['ol-r-locked ol-hatch', 'None'] };
const huge = (n, label) => '<div class="bm-huge"><b>' + n + '</b><small>' + label + '</small></div>';
const slab = (kick, h1, sub, n, label, blocks) => '<div class="ol-slab"><div class="ol-sl-id"><span class="ol-kick">' + kick + '</span><h1>' + h1 + '</h1><span class="ol-sl-sub">' + sub + '</span></div>' + huge(n, label) + '<div class="ol-sl-ans ol-blocks">' + blocks + '</div></div>';
function lane(o) { // o: { st: role classes, word, solid, thin, muted, name, hq, facts, mid, ans, ansSmall, act }
  return '<div class="bm-lane ' + o.st + (o.solid ? ' bm-solid' : '') + (o.thin ? ' bm-thin' : '') + (o.muted ? ' bm-muted' : '') + '">' + sb(o.st + (o.outline ? ' ol-outline' : ''), o.word, o.wordSmall || '', o.isWord) +
    '<div class="bm-who"><span class="bm-nm">' + esc(o.name) + (o.hq ? '<em>HQ</em>' : '') + '</span>' + (o.facts ? '<span class="bm-facts">' + o.facts + '</span>' : '') + '</div>' +
    '<div class="bm-mid">' + (o.mid || '') + '</div><span class="bm-ans' + (o.ansWord ? ' bm-word' : '') + '">' + o.ans + (o.ansSmall ? '<small>' + o.ansSmall + '</small>' : '') + '</span>' +
    (o.thin && !o.act && !o.more ? '' : '<div class="bm-acts">' + (o.act ? '<button class="ol-btn-p" type="button">' + o.act + '</button>' : '') + more + '</div>') + '</div>';
}
const lots = (parts) => '<span class="bm-lots" aria-hidden="true">' + parts.map((n) => '<i style="--n:' + n + '"></i>').join('') + '</span>';
const figs = (t) => String(t).replace(/(\d[\d,.:]*)/g, (m) => fig(m));
function bhead(title, sub, sum, strip) {
  return '<div class="bm-bhead"><span class="bm-bhead-strip" aria-hidden="true">' + strip.map(([r, n]) => '<i class="' + r + '" style="--n:' + n + '"></i>').join('') + '</span>' +
    '<div class="bm-bhead-bar"><div><h2>' + title + '</h2><p>' + sub + '</p></div><div class="bm-sum">' + sum + '</div></div></div>';
}

// ------------------------------------------------------------------------------------------------- the trip (example figures)
// Travel area: seven data centers in three regions. Order: fewest region hops, then data centers, biggest savings first.
const HOME = 'Gilgamesh';
const STOPS = [
  { world: 'Gilgamesh', dc: 'Aether', region: 'North America', home: 1, here: 1, items: [
    { n: 'Water Cluster', parts: [[36, 410]], seen: '9 min', st: 'buy' },
    { n: 'Lightning Cluster', parts: [[20, 380], [16, 398]], seen: '9 min', st: 'buy' },
    { n: 'Windsbalm Bay Leaf', parts: [[3, 3850]], seen: '1 h', st: 'buy' },
    { n: 'Splendid Mate Leaves', parts: [[1, 3400], [2, 3420]], seen: '25 min', st: 'buy' },
    { n: 'Dark Rye Flour', parts: [[3, 610]], seen: '25 min', st: 'buy' },
    { n: 'Eucalyptus', parts: [[3, 4100]], seen: '48 min', st: 'buy' },
    { n: 'Sungilt Aethersand', parts: [[6, 2180]], seen: '31 min', st: 'done' }] },
  { world: 'Exodus', dc: 'Primal', region: 'North America', items: [
    { n: 'Sanctified Water', parts: [[4, 18900], [2, 19000]], seen: '14 min', st: 'later' },
    { n: 'Glossy Dried Ether', parts: [[6, 9450]], seen: '31 min', st: 'later' }] },
  { world: 'Famfrit', dc: 'Primal', region: 'North America', items: [
    { n: 'Wind Parsley', parts: [[3, 3200]], seen: '2 h', st: 'later' },
    { n: 'Pearl Grass', parts: [[3, 2950]], seen: '2 days', st: 'old' }] },
  { world: 'Odin', dc: 'Light', region: 'Europe', sole: 1, items: [
    { n: "Kozama'uka Chamomile", parts: [[3, 2900]], seen: '3 h', st: 'later' }] },
];
let total = 0, count = { buy: 0, later: 0, old: 0, done: 0 };
let spent = 0;
const taxed = (q, p) => q * p + Math.floor(q * p * 0.05); // the buyer's 5% of each whole stack, rounded down
STOPS.forEach((s) => { s.sum = 0; s.items.forEach((x) => { x.q = x.parts.reduce((a, p) => a + p[0], 0); x.sum = x.parts.reduce((a, p) => a + taxed(p[0], p[1]), 0); s.sum += x.sum; if (x.st === 'done') spent += x.sum; else total += x.sum; count[x.st]++; }); });
const nowStop = STOPS[0], toBuyHere = nowStop.items.filter((x) => x.st === 'buy');
function tripLane(x, s) {
  const [r, w] = STATE[x.st], partsTxt = x.parts.map((p) => fig(p[0]) + ' at ' + fig(gil(p[1]))).join(' + ');
  return lane({ st: r, word: w, isWord: 1, solid: x.st === 'buy', muted: x.st === 'done', name: x.n, facts: 'seen ' + x.seen + ' ago' + (x.st === 'old' ? ', past your 1-day limit' : '') + ' · ' + partsTxt,
    mid: lots(x.parts.map((p) => p[0])), ans: gil(x.sum), ansSmall: 'gil for ' + x.q + ', tax in', act: x.st === 'buy' ? 'Bought' : '' });
}
function route() {
  let out = '<div class="bm-track"><div class="bm-track-line">';
  STOPS.forEach((s, i) => {
    if (s.sole) out += '<div class="bm-hop"><em>Europe</em></div>';
    out += '<div class="bm-stop' + (s.here ? ' ol-r-back' : ' ol-r-out') + '"><i>' + (i + 1) + '</i><b>' + s.world + (s.here ? ' · here' : s.home ? ' · home' : '') + '</b></div>';
  });
  return out + '</div></div>';
}
function stopHead(s, i, heads) {
  const items = s.items.length, buyN = s.items.filter((x) => x.st === 'buy').length;
  const title = s.world;
  const sub = 'Stop ' + (i + 1) + ' · ' + s.dc + ' · ' + s.region + (s.home ? ' · your home world' : '') + (s.here ? ' · you are here' : '') + (s.sole ? ' · the only reported listings of 1 item you still need, so the trip goes here: 1 region hop' : '');
  const strip = s.items.map((x) => [STATE[x.st][0], 1]);
  if (heads === 'bars') return bhead('Stop ' + (i + 1) + ' · ' + s.world, s.dc + ' · ' + s.region + (s.home ? ' · home world' : '') + (s.here ? ' · you are here' : ''), fig(gil(s.sum)) + '<small>GIL · ' + items + ' ITEMS</small>', strip);
  const num = ['I', 'II', 'III', 'IV', 'V'][i];
  return chap(num, title, sub, s.here ? sb('ol-r-back ol-sm', buyN, 'Buy here') : sb('ol-r-out ol-sm', items, 'Later'));
}
function tripBody(heads) {
  let out = '<div class="bm-layout">' + rail('trip', { trip: count.buy + count.later, watch: 3 }) + '<main class="bm-main">' +
    slab('Total still to spend, tax in:', 'Gemdraught batch', fig(toBuyHere.length) + ' to buy here · already bought: ' + fig(gil(spent)) + ' gil', gil(total), 'gil left<span class="bm-cnt">' + STOPS.length + ' stops · 1 data-center hop · 1 region hop</span>',
      sb('ol-r-back', count.buy, 'Buy here') + sb('ol-r-out', count.later, 'Later') + sb('ol-r-idle', count.old, 'Old') + sb('ol-r-slab ol-outline', count.done, 'Done')) +
    '<div class="bm-routebar">' + route() + '<button class="ol-seal bm-desk" type="button">Bought all here</button></div>';
  STOPS.forEach((s, i) => { out += '<section class="ol-chap-wrap">' + stopHead(s, i, heads) + '<div class="bm-lanes">' + s.items.map((x) => tripLane(x, s)).join('') + '</div></section>'; });
  return out + '<p class="bm-hint">You can buy on another data center or region, but not sell there. Travel stops 30 minutes before maintenance.</p></main></div>';
}
page('trip.html', 'Shopping trip', tripBody('book'), { seal: 'Bought all here' });

// ------------------------------------------------------------------------------------------------- the item: cheapest anywhere
function rnd(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }
const R = rnd(42);
const AREA = [['North America', [['Aether', ['Adamantoise', 'Cactuar', 'Faerie', 'Gilgamesh', 'Jenova', 'Midgardsormr', 'Sargatanas', 'Siren']], ['Primal', ['Behemoth', 'Excalibur', 'Exodus', 'Famfrit', 'Hyperion', 'Lamia', 'Leviathan', 'Ultros']],
  ['Crystal', ['Balmung', 'Brynhildr', 'Coeurl', 'Diabolos', 'Goblin', 'Malboro', 'Mateus', 'Zalera']], ['Dynamis', ['Cuchulainn', 'Golem', 'Halicarnassus', 'Kraken', 'Maduin', 'Marilith', 'Rafflesia', 'Seraph']]]],
  ['Europe', [['Chaos', ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Phantom', 'Ragnarok', 'Sagittarius', 'Spriggan']], ['Light', ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark']]]],
  ['Oceania', [['Materia', ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan']]]]];
const AGES = ['9 min', '14 min', '22 min', '40 min', '1 h', '2 h', '3 h', '5 h', '9 h', '20 h', '2 days'];
const worlds = [];
AREA.forEach(([region, dcs]) => dcs.forEach(([dc, ws]) => ws.forEach((w) => {
  let p = 19100 + Math.round(R() * 60) * 50, age = AGES[Math.floor(R() * AGES.length)];
  if (w === 'Exodus') { p = 18900; age = '14 min'; } if (w === 'Gilgamesh') { p = 20400; age = '9 min'; }
  if (['Lamia', 'Golem', 'Zalera', 'Phantom', 'Ravana', 'Zurvan'].includes(w)) p = null;
  if (region !== 'North America' && p) p += 150;
  worlds.push({ w, dc, region, p, age, home: w === HOME });
})));
const listed = worlds.filter((x) => x.p != null), old = listed.filter((x) => /day|20 h/.test(x.age)), cheap = listed.slice().sort((a, b) => a.p - b.p).slice(0, 8);
const lo = cheap[0].p, hi = Math.max(...listed.map((x) => x.p));
const scaleAt = (p) => Math.round(((p - lo) / (hi - lo)) * 92 + 4);
const sales = []; for (let d = 0; d < 7; d++) { const n = 4 + Math.floor(R() * 5); for (let k = 0; k < n; k++) sales.push({ d: d + R(), p: 18200 + Math.round(R() * 46) * 50 }); }
const sp = sales.map((x) => x.p).sort((a, b) => a - b), median = sp[Math.floor(sp.length / 2)], perDay = (sales.length / 7).toFixed(1);
function strip() {
  const W = 640, H = 150, x0 = 56, x1 = W - 8, y0 = 12, y1 = H - 28, l = 18000, h = 20600, X = (d) => x0 + (d / 7) * (x1 - x0), Y = (p) => y1 - ((p - l) / (h - l)) * (y1 - y0);
  let o = '<svg class="bm-strip ol-r-out" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + sales.length + ' sales over 7 days, middle ' + gil(median) + ' gil (example)">';
  [18000, 19000, 20000].forEach((p) => { o += '<line class="ax" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(p) + '" y2="' + Y(p) + '"/><text x="0" y="' + (Y(p) + 4) + '">' + gil(p) + '</text>'; });
  o += '<line class="mid" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(median) + '" y2="' + Y(median) + '"/><text class="lb" x="' + (x1 - 64) + '" y="' + (Y(median) - 7) + '">MIDDLE</text>';
  sales.forEach((v) => { o += '<circle class="dot" cx="' + X(v.d).toFixed(1) + '" cy="' + Y(v.p).toFixed(1) + '" r="5"/>'; });
  o += '<text class="lb" x="' + x0 + '" y="' + (H - 6) + '">7 DAYS AGO</text><text class="lb" x="' + (x1 - 44) + '" y="' + (H - 6) + '">TODAY</text>';
  return o + '</svg>';
}
const regionHead = (num, region) => { const ws = worlds.filter((x) => x.region === region), n = ws.filter((x) => x.p != null).length; return chap(num, region, ws.length + ' worlds on ' + AREA.find((a) => a[0] === region)[1].map((d) => d[0]).join(', '), sb((n === ws.length ? 'ol-r-back' : 'ol-r-idle') + ' ol-sm', n + '/' + ws.length, 'Listed'), true); };
page('item.html', 'Item prices',
  '<div class="bm-layout">' + rail('item', { trip: count.buy + count.later, watch: 3 }) + '<main class="bm-main">' +
  slab('What 6 cost you, each, tax in:', 'Sanctified Water', '4 at 18,900 and 2 at 19,000 on Exodus · normal quality', gil(Math.round((taxed(4, 18900) + taxed(2, 19000)) / 6)), 'gil each · Exodus, Primal · seen 14 min ago',
    sb('ol-r-back', listed.length, 'Worlds listed') + sb('ol-r-idle', old.length, 'Old') + sb('ol-r-locked ol-hatch', worlds.length - listed.length, 'No listing')) +
  '<div class="bm-bar"><div class="ol-seg" role="group" aria-label="Quality"><button type="button" aria-pressed="true">Normal quality</button><button type="button" aria-pressed="false">High quality</button></div><button class="ol-seal bm-desk" type="button">Watch this item</button></div>' +
  '<div class="bm-two"><div class="ol-chap-wrap">' + chap('I', 'Cheapest anywhere', 'Seven data centers, cheapest first', sb('ol-r-back ol-sm bm-desk-sum', 8, 'Shown') + '<span class="ol-seg bm-phone-seg" role="group" aria-label="Quality"><button type="button" aria-pressed="true">Normal</button><button type="button" aria-pressed="false">HQ</button></span>') + '<div class="bm-lanes">' +
  cheap.map((x, i) => lane({ st: i === 0 ? 'ol-r-back' : 'ol-r-slab', outline: i > 0, word: i + 1, thin: 1, solid: i === 0, name: x.w + (x.home ? ' · home' : ''), facts: x.dc + ' · ' + x.region + ' · seen ' + x.age + ' ago',
    mid: '<span class="bm-scale ' + (i === 0 ? 'ol-r-back' : 'ol-r-out') + '" aria-hidden="true"><span class="bm-dot" style="left:' + scaleAt(x.p) + '%"></span></span>', ans: gil(taxed(1, x.p)), ansSmall: 'cheapest one, tax in' })).join('') + '</div>' +
  regionHead('II', 'North America') + regionHead('III', 'Europe') + regionHead('IV', 'Oceania') + '</div>' +
  '<div class="ol-chap-wrap">' + chap('V', 'Recent sales', 'What actually sold, 7 days, all seven data centers', sb('ol-r-out ol-sm', perDay, 'A day')) +
  '<div class="bm-figs">' + sb('ol-r-slab ol-outline', gil(sp[0]), 'Low') + sb('ol-r-out', gil(median), 'Middle') + sb('ol-r-slab ol-outline', gil(sp[sp.length - 1]), 'High') + '</div>' + strip() +
  '<p class="bm-hint">Each dot is one sale. The thick line is the middle price.</p></div></div></main></div>',
  { seal: 'Watch this item', tools: '<label class="ol-fld ol-w320"><span class="ol-lbl">Find an item</span><input type="search" value="Sanctified Water"></label>' });

// ------------------------------------------------------------------------------------------------- profit: a leaderboard
const PROFIT = [
  ['Mate Cookie', 'CUL', 100, 1, 38240, 41, 12060], ['Ceviche', 'CUL', 100, 1, 31580, 28, 14900], ['Grade 2 Gemdraught of Strength', 'ALC', 100, 1, 27920, 64, 34110],
  ['Grade 2 Gemdraught of Dexterity', 'ALC', 100, 1, 26300, 52, 34390], ['Grade 2 Gemdraught of Mind', 'ALC', 100, 1, 24750, 47, 33640], ['Grade 2 Gemdraught of Intelligence', 'ALC', 100, 1, 23900, 39, 33980, 'old'],
  ['Rroneek Steak', 'CUL', 99, 1, 18640, 22, 7310], ["Ra'Kaznar Ingot", 'BSM', 98, 0, 9120, 85, 11480], ['Claro Walnut Lumber', 'CRP', 98, 0, 6230, 70, 9050, 'cant'],
];
const top = PROFIT[0][4];
const LWORLD = ['Exodus', 'Siren', 'Gilgamesh', 'Famfrit', 'Cactuar', 'Ultros', 'Balmung', 'Exodus', 'Siren'], LAGE = [20, 35, 12, 50, 18, 41, 26, 9, 33];
const byListing = (g) => Math.round(g * 0.92); // example: the cheapest listing usually sits a little under recent sales
const TAX = [['Ishgard', 3], ['Old Sharlayan', 3], ['Kugane', 5], ['The Crystarium', 5], ['Tuliyollal', 5], ['Limsa Lominsa', 5], ['Gridania', 5], ["Ul'dah", 5]];
page('profit.html', 'Profit per craft',
  '<div class="bm-layout">' + rail('profit', { trip: count.buy + count.later, watch: 3 }) + '<main class="bm-main">' +
  slab('Best gil per craft:', 'Mate Cookie <span style="font-style:italic">HQ</span>', 'An estimate after tax · sale prices from all seven data centers · materials at the cheapest of merchant and market', gil(top), 'gil each · by recent sales', sb('ol-r-back', gil(1212), 'Ranked') + sb('ol-r-locked ol-hatch', gil(8644), 'To price')) +
  '<div class="bm-bar"><div class="ol-seg" role="group" aria-label="Ranked by"><button type="button" aria-pressed="true">By recent sales</button><button type="button" aria-pressed="false">By cheapest listing</button></div><button class="ol-seal bm-desk" type="button">Rank these crafts</button></div>' +
  '<section class="ol-chap-wrap">' + chap('I', 'Ranking', 'Gil per craft after tax, on one scale', sb('ol-r-back ol-sm bm-desk-sum', gil(1212), 'of ' + gil(9856)) + '<span class="ol-seg bm-phone-seg" role="group" aria-label="Ranked by"><button type="button" aria-pressed="true">Sales</button><button type="button" aria-pressed="false">Listing</button></span>') + '<div class="bm-lanes">' +
  PROFIT.map((r, i) => { const [n, job, lv, hq, g, per, cost, flag] = r; return lane({ st: flag === 'old' ? 'ol-r-idle' : flag === 'cant' ? 'ol-r-locked ol-hatch' : i === 0 ? 'ol-r-seal' : 'ol-r-slab', word: flag === 'old' ? 'Old' : i + 1, isWord: flag === 'old', solid: i === 0,
    name: n, hq, facts: job + ' · ' + fig(40) + ' sales in ' + fig((40 / per).toFixed(1)) + ' days, at least ' + fig(per) + ' a day · listing ' + LWORLD[i] + ' ' + fig(LAGE[i]) + ' min ago · materials ' + fig(gil(cost)) + (flag === 'cant' ? ' · can\'t make yet' : flag === 'old' ? ' · 2 days old' : ''),
    mid: '<span class="bm-gbar bm-r-gil" aria-hidden="true"><i style="width:' + Math.round((g / top) * 100) + '%"></i></span>', ans: gil(g), ansSmall: 'by sales · by listing ' + gil(byListing(g)) }); }).join('') + '</div>' +
  chap('II', 'Sells less than once a day', 'Ranked the same way, kept apart', sb('ol-r-idle ol-sm', 1, 'Slow'), true) + '</section>' +
  '<section class="ol-chap-wrap">' + chap('III', 'Where to sell this week', 'Seller\'s tax by city on Gilgamesh, read 3 hours ago; buyers pay their own 5%', sb('ol-r-back ol-sm', '3%', 'Lowest')) + '<div class="bm-lanes">' +
  TAX.map(([c, t], i) => lane({ st: t === 3 ? 'ol-r-back' : 'ol-r-slab', outline: t !== 3, solid: i === 0, thin: 1, word: t + '%', name: c, facts: i === 0 ? 'Used for profit' : t === 3 ? 'Also reduced this week' : 'Full rate', mid: '', ans: '' })).join('') + '</div></section></main></div>',
  { seal: 'Rank these crafts' });

// ------------------------------------------------------------------------------------------------- watch list
const BELOW = [['Sanctified Water', 15000, 12400, 'Famfrit', '22 min'], ['Glossy Dried Ether', 10000, 9450, 'Exodus', '31 min'], ['Water Cluster', 450, 410, 'Gilgamesh', '9 min']];
const ABOVE = [["Ra'Kaznar Ore", 600, 2500, 'Balmung', '1 h'], ['Claro Walnut Log', 900, 1260, 'Siren', '40 min'], ['Turali Corn Oil', 1500, 1980, 'Cactuar', '3 h'], ['Dark Rye Flour', 700, 840, 'Odin', '5 h'], ['Splendid Mate Leaves', 3000, 4100, 'Ultros', '9 h']];
const wLane = (r, under) => { const max = Math.max(r[1], r[2]) * 1.25, at = (v) => Math.round((v / max) * 100);
  return lane({ st: under ? 'ol-r-back' : 'ol-r-idle', word: under ? 'Under' : 'Above', isWord: 1, solid: under, name: r[0], facts: r[3] + ', ' + r[4] + ' ago · target ' + fig(gil(r[1])),
    mid: '<span class="bm-scale ' + (under ? 'ol-r-back' : 'ol-r-idle') + '" aria-hidden="true"><span class="bm-tick" style="left:' + at(r[1]) + '%"></span><span class="bm-dot" style="left:' + at(r[2]) + '%"></span></span>',
    ans: gil(r[2]), ansSmall: 'cheapest, ' + fig(gil(Math.abs(r[1] - r[2]))) + (under ? ' under' : ' over'), act: under ? 'Add to trip' : '' }); };
const WATCH_BODY =
  '<div class="bm-layout">' + rail('watch', { trip: count.buy + count.later, watch: 3 }) + '<main class="bm-main">' +
  slab('Under target now:', 'Watched prices', '9 items · alerts ring on every page while the app is open in a tab', BELOW.length, 'of 9 items', sb('ol-r-back', BELOW.length, 'Under') + sb('ol-r-idle', ABOVE.length, 'Above') + sb('ol-r-locked ol-hatch', 1, 'No data')) +
  '<div class="bm-bar"><span class="bm-hint">Targets are per unit; the cheapest listing is read over your travel area.</span><button class="ol-seal bm-desk" type="button">Add an item</button></div>' +
  '<section class="ol-chap-wrap">' + chap('I', 'Under target', 'Cheapest listing at or below your price', sb('ol-r-back ol-sm', BELOW.length, 'Under')) + '<div class="bm-lanes">' + BELOW.map((r) => wLane(r, 1)).join('') + '</div></section>' +
  '<section class="ol-chap-wrap">' + chap('II', 'Above target', 'Waiting for the price to fall', sb('ol-r-idle ol-sm', ABOVE.length, 'Above')) + '<div class="bm-lanes">' + ABOVE.map((r) => wLane(r, 0)).join('') + '</div></section>' +
  '<section class="ol-chap-wrap">' + chap('III', 'No price', 'No listing or sale reported', sb('ol-r-locked ol-hatch ol-sm', 1, 'None'), true) + '</section></main></div>';
page('watch.html', 'Watch list', WATCH_BODY, { seal: 'Add an item' });
page('watch-alert.html', 'Watch list with an alert', WATCH_BODY, { seal: 'Add an item', after: '<div class="bm-status" role="status">Sanctified Water is under your target on Famfrit: ' + fig(gil(12400)) + ' gil, seen ' + fig(22) + ' min ago. <a href="#">Open</a> <a href="#">Close</a></div>' });

// ------------------------------------------------------------------------------------------------- settings sheet over the trip
const stepper = (v) => '<span class="ol-step ol-sm"><button type="button" aria-label="Less">−</button><span class="ol-fig">' + v + '</span><button type="button" aria-label="More">+</button></span>';
const chk = (t, on) => '<label class="ol-chk"><input type="checkbox"' + (on ? ' checked' : '') + '> ' + t + '</label>';
page('settings.html', 'Bourse settings', tripBody('book') + '<div class="bm-scrim" aria-hidden="true"></div><aside class="bm-sheet" role="dialog" aria-label="Bourse settings">' +
  '<div class="bm-sheet-hd"><h2>Bourse settings</h2><button class="ol-btn-2" type="button">Close</button></div>' +
  chap('I', 'Travel area', 'Where prices are read and the trip may go', '') + '<div class="bm-fields">' +
  '<p class="bm-hint">North America</p><div class="bm-dcs">' + ['Aether', 'Primal', 'Crystal', 'Dynamis'].map((d) => chk(d, 1)).join('') + '</div><p class="bm-hint">Europe</p><div class="bm-dcs">' + ['Chaos', 'Light'].map((d) => chk(d, 1)).join('') + '</div><p class="bm-hint">Oceania</p><div class="bm-dcs">' + chk('Materia', 1) + '</div>' +
  '<label class="ol-fld"><span class="ol-lbl">Home world (where you sell and where the trip starts)</span><span class="ol-sel"><select><option>Gilgamesh (Aether), from the Tracker’s place setting</option><option>Siren (Aether)</option></select></span></label></div>' +
  chap('II', 'Prices', 'How fresh', '') + '<div class="bm-fields"><div class="bm-pair"><div class="bm-lbl"><span class="ol-lbl">Old after (days)</span>' + stepper(1) + '</div><div class="bm-lbl"><span class="ol-lbl">Left out of profit after (days)</span>' + stepper(7) + '</div></div></div>' +
  chap('III', 'Shopping trip', 'How it splits and what a tick does', '') + '<div class="bm-fields"><div class="bm-lbl"><span class="ol-lbl">Comes first</span><div class="ol-seg" role="group"><button aria-pressed="false" type="button">Fewest stops</button><button aria-pressed="false" type="button">Cheapest</button><button aria-pressed="true" type="button">Trade-off</button></div></div>' +
  '<div class="bm-lbl"><span class="ol-lbl">Pay at most this much more to save a stop or a region (%)</span>' + stepper(10) + '</div>' +
  '<div class="bm-lbl"><span class="ol-lbl">When I tick an item bought</span><div class="ol-seg" role="group"><button aria-pressed="true" type="button">Tick only</button><button aria-pressed="false" type="button">Also add to “I have” in Lists</button></div></div></div>' +
  chap('IV', 'Profit and alerts', '', '') + '<div class="bm-fields">' + chk('Count gathered materials at market value', 1) + chk('Alert me on every page when a watched item is under its target', 1) + '<div class="bm-lbl"><span class="ol-lbl">Check every (minutes)</span>' + stepper(30) + '</div><p class="bm-hint">Only while a tab of the app is open. A closed app cannot alert.</p></div></aside>', { bodyClass: 'bm-sheetfull' });

// ------------------------------------------------------------------------------------------------- the empty trip
page('empty.html', 'No trip yet',
  '<div class="bm-layout">' + rail('trip', { watch: 3 }) + '<main class="bm-main"><section class="bm-empty"><div class="bm-empty-copy"><span class="ol-kick bm-plate">Nothing to buy</span><h1>No trip yet</h1>' +
  '<p>Pick the lists you are buying for, and the Bourse plans where to buy each item across your seven data centers, stop by stop.</p><div class="bm-steps">' +
  [['ol-r-back', 'Choose lists', 'Their market items become the shopping list.'], ['ol-r-out', 'Set the split', 'Fewest stops, cheapest, or your own trade-off.'], ['ol-r-idle', 'Buy stop by stop', 'Tick each item as you buy it.']]
    .map(([r, b, t], i) => '<div class="bm-step">' + sb(r, i + 1, '') + '<div><b>' + b + '</b><span>' + t + '</span></div></div>').join('') +
  '</div><div><button class="ol-seal" type="button">Choose lists</button></div></div><div class="bm-deco" aria-hidden="true"><svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice">' +
  '<path class="rt" d="M120 600 C 160 480, 320 470, 300 360 S 120 240, 220 120 S 340 40, 360 20"/>' +
  '<circle class="stp ol-r-back" cx="120" cy="600" r="26"/><circle class="stp ol-r-out" cx="300" cy="360" r="26"/><circle class="stp ol-r-idle" cx="220" cy="120" r="26"/>' +
  '<text class="lb" x="40" y="60">YOUR ROUTE</text></svg></div></section></main></div>');

// ------------------------------------------------------------------------------------------------- states the main pictures do not show
const note = (role, lbl, text, act) => '<div class="bm-note ' + role + '"><div><span class="ol-lbl">' + lbl + '</span><br>' + text + '</div>' + (act ? '<a class="ol-btn-q" href="#">' + act + '</a>' : '') + '</div>';
const eline = (text, act) => '<div class="bm-eline"><span>' + text + '</span>' + (act ? '<a class="ol-btn-q" href="#">' + act + '</a>' : '') + '</div>';
page('states.html', 'States',
  '<div class="bm-layout">' + rail('profit', { trip: count.buy + count.later, watch: 0 }) + '<main class="bm-main">' +
  slab('States sheet, not a screen:', 'When prices are missing', 'Each part appears on its own screen in place of its normal content', '4', 'kinds of notice', sb('ol-r-bad', 'Failed', '', 1) + sb('ol-r-locked ol-hatch', 'Unknown', '', 1)) +
  '<section class="ol-chap-wrap">' + chap('I', 'Notices', 'One at a time, above the first section', '') +
  note('ol-r-bad', 'Prices not fetched', 'The price site could not be reached. Showing the prices seen at ' + fig('14:02') + ' on this device; anything past your limit is marked old.', 'Try again') +
  note('ol-r-idle', 'Slowed down', 'The price site asked this app to wait. The next try is in ' + fig(4) + ' minutes; Refresh does not skip this pause.', '') +
  note('ol-r-idle', 'Hourly limit reached', 'This device has sent ' + fig(300) + ' price requests in the last hour, the most it sends. ' + fig(gil(1212)) + ' crafts are ranked; ranking continues at ' + fig('15:40') + '.', '') +
  note('ol-r-bad', 'Maintenance soon', 'All worlds go down at ' + fig('15:00') + ' (from the events list of ' + fig(24) + ' Nov). Data-center travel stops at ' + fig('14:30') + ': buy away from home first.', '') + '</section>' +
  '<section class="ol-chap-wrap">' + chap('II', 'Empty parts', 'What a part says when it has nothing yet', '') +
  eline('<b>Choose your home world</b> to see where to sell and the seller\'s tax. Prices to buy work without it.', 'Choose a home world') +
  eline('<b>Nothing watched yet.</b> Add an item here, or press "Watch this item" on any item.', 'Add an item') +
  eline('<b>Find an item</b> in the search above to see its price on all seven data centers.', '') + '</section>' +
  '<section class="ol-chap-wrap">' + chap('III', 'Trip lines added after the review', 'Each in place of, or under, the answer it qualifies', '') +
  note('ol-r-idle', 'Made without Europe', 'Europe could not be fetched, so this trip uses North America and Oceania only. Its prices may be higher than they need be.', 'Try again') +
  note('ol-r-idle', 'A quick split', 'This trip is long, so the app made a quick split instead of the best one. Its total may be a little higher; the best possible total is at least ' + fig(gil(241200)) + ' gil.', '') +
  note('ol-r-idle', 'Items without a home price', fig(3) + ' items have no listing on Gilgamesh, so their saving against home is unknown.', '') +
  note('ol-r-locked', 'Your browser cannot share one alert checker between tabs', 'Automatic alerts are off in this browser; the watch list still shows what is under target when you open it.', '') +
  note('ol-r-back', 'Copied from the Tracker', fig(4) + ' items copied from the Tracker\'s old shopping list into this trip; ' + fig(1) + ' skipped (no longer sold on the market). The old list is kept.', '') +
  '<div class="bm-lanes">' +
  lane({ st: 'ol-r-locked ol-hatch', word: 'Check', isWord: 1, name: 'Glossy Dried Ether', facts: 'your lists changed since you ticked it: how many of the ' + fig(6) + ' bought still count?', mid: '', ans: 'unknown', ansWord: 1, ansSmall: 'still to buy', act: 'Check', }) +
  lane({ st: 'ol-r-out', word: 'Only here', isWord: 1, name: 'Eucalyptus', facts: 'seen 48 min ago · the only listings in your travel area are on Siren · ' + fig(3) + ' at ' + fig(gil(4100)), mid: '', ans: gil(taxed(3, 4100)), ansSmall: 'gil for 3, tax in' }) +
  lane({ st: 'ol-r-idle', word: 'About', isWord: 1, name: 'Water Cluster', facts: 'seen 9 min ago · ' + fig(gil(2001)) + ' needed: approximate split over many listings, at most ' + fig(gil(6003)) + ' gil', mid: '', ans: '≈ ' + gil(5410), ansSmall: 'gil for 2,001' }) +
  '</div></section>' +
  '<section class="ol-chap-wrap">' + chap('IV', 'Lanes in edge states', 'Drawn the same way on every screen', '') + '<div class="bm-lanes">' +
  lane({ st: 'ol-r-bad', word: 'Loss', isWord: 1, name: 'Grade 2 Gemdraught of Intelligence', hq: 1, facts: 'sells ' + fig(39) + ' a day · materials ' + fig(gil(36120)) + ' · sale middle ' + fig(gil(34800)) + ' after tax', mid: '<span class="bm-gbar bm-r-gil" aria-hidden="true"><i class="bm-neg"></i></span>', ans: '−' + gil(1320), ansSmall: 'gil each' }) +
  lane({ st: 'ol-r-locked ol-hatch', word: 'HQ only', isWord: 1, name: "Kozama'uka Chamomile", facts: 'no normal-quality listing in the travel area · ' + fig(2) + ' high quality at ' + fig(gil(24800)) + ' on Seraph', mid: '', ans: 'unknown', ansWord: 1, ansSmall: 'normal quality' }) +
  lane({ st: 'ol-r-idle', word: 'Bait?', isWord: 1, name: 'Sanctified Water', facts: 'seen 3 min ago · 1 at ' + fig(2000) + ' on Hyperion, far below recent sales (' + fig(gil(19300)) + ') · the rest from ' + fig(gil(18900)), mid: lots([1, 5]), ans: gil(taxed(1, 2000) + taxed(5, 18900)), ansSmall: 'gil for 6, tax in', act: 'Bought' }) +
  '</div></section></main></div>', { bodyClass: 'bm-gallery', after: '<div class="bm-status" role="status">Sanctified Water is under your target on Famfrit: ' + fig(gil(12400)) + ' gil, seen ' + fig(22) + ' min ago. <a href="#">Open</a> <a href="#">Close</a></div>' });

console.log('mock pages in ' + OUT + ': total ' + total + ', counts ' + JSON.stringify(count));
