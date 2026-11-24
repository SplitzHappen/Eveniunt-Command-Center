// Pictures and measures for the one-look mock-ups (docs/one-look-spec.md, item M3).
//   node docs/one-look/tools/shoot.mjs
// Writes docs/one-look/pictures/: 48 viewport pictures (6 screens x 1440x1000 and 360x800 x 4 theme pairs), 4 sheets, 6 Q1/Q2
// variants (heads=caps and seal=caps, 1440, default light), and measures.json. Exit 0 unless a page throws, a console error
// appears or a font fails to load; failed measures are listed in measures.json and printed, never hidden.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPlaywright } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.join(HERE, '..', 'mock');
const OUT = path.join(HERE, '..', 'pictures');
const SCREENS = ['home', 'tracker', 'atelier', 'submersibles', 'lists', 'settings'];
const PAIRS = [['crystarium-dawnglass', 'light'], ['crystarium-dawnglass', 'dark'], ['azure-dragoon', 'dark'], ['uldah-sultanate-gilt', 'light']];
const SIZES = [[1440, 1000], [360, 800]];
const STRIP = new Set(['submersibles']); // screens with a strip of controls above the first row (P3 allows 256 px)
fs.mkdirSync(OUT, { recursive: true });

// runs in the page: the measures of the checkable rules
function measure(arg) {
  const vw = innerWidth, vh = innerHeight;
  const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  const shown = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const all = [...document.body.querySelectorAll('*')].filter((el) => shown(el) && inView(el.getBoundingClientRect()));
  const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  // C2: the largest text in view (not the wordmark or chapter numerals, which are not answers), and whether it is a figure or a state word
  let big = { px: 0, text: '', figure: false };
  all.forEach((el) => { const t = own(el); if (!t || el.closest('svg,.hdr,.chap .num')) return; const px = parseFloat(getComputedStyle(el).fontSize); if (px > big.px) big = { px, text: t.slice(0, 24), figure: /\d/.test(t) || !!el.closest('.sb,.numeral') }; });
  // heaviest line (px): borders in view, and the molten edge (a border image)
  let heavy = 0, heavyWhere = '';
  all.forEach((el) => { const cs = getComputedStyle(el); ['Top', 'Right', 'Bottom', 'Left'].forEach((s) => { const w = parseFloat(cs['border' + s + 'Width']); if (cs['border' + s + 'Style'] !== 'none' && w > heavy) { heavy = w; heavyWhere = el.className.toString().slice(0, 30) || el.tagName; } }); });
  // T2: every visible Plex element holds a digit
  const plex = all.filter((el) => /IBM Plex Mono/.test(getComputedStyle(el).fontFamily) && own(el));
  const plexBad = plex.filter((el) => !/\d/.test(own(el))).map((el) => own(el).slice(0, 30));
  // P2 / P4: ledger rows at rest, rows in view, and where the first row starts (P3)
  const rows = [...document.querySelectorAll('.lrow')].filter((el) => shown(el));
  const heights = rows.map((el) => Math.round(el.getBoundingClientRect().height));
  const hdr = document.querySelector('.hdr').getBoundingClientRect();
  const first = rows.length ? Math.round(rows[0].getBoundingClientRect().top - hdr.bottom) : null;
  // A6: tap targets in view that are smaller than 36 px (40 on a phone)
  const min = vw <= 700 ? 40 : 36;
  const small = all.filter((el) => el.matches('a.btn-p,a.btn-2,button.btn-2,button.btn-q,.menu-btn,.seg button,.step button')).filter((el) => el.getBoundingClientRect().height < min - 0.5).map((el) => (el.textContent.trim() || el.className).slice(0, 20));
  return {
    sidewaysScroll: document.documentElement.scrollWidth > vw, scrollWidth: document.documentElement.scrollWidth,
    largestText: big, slabInView: [...document.querySelectorAll('.slab')].some((el) => inView(el.getBoundingClientRect())),
    heaviestLinePx: heavy, heaviestLineOn: heavyWhere, plexWithoutDigit: plexBad, plexCount: plex.length,
    ledgerRowHeights: { count: heights.length, min: heights.length ? Math.min(...heights) : null, max: heights.length ? Math.max(...heights) : null },
    rowsInView: rows.filter((el) => { const r = el.getBoundingClientRect(); return r.top < vh - (vw <= 700 ? 56 : 0) && r.bottom > 0; }).length,
    firstRowFromHeader: first, tapTargetsTooSmall: small,
    fontsLoaded: ![...document.fonts].some((f) => f.status === 'error'),
  };
}

function judge(name, w, screen, m) {
  const f = [];
  if (m.sidewaysScroll) f.push('P1 sideways scroll (page is ' + m.scrollWidth + ' px wide)');
  if (!(m.largestText.px >= 28 && m.largestText.figure)) f.push('C2 largest text is ' + m.largestText.px + ' px "' + m.largestText.text + '"' + (m.largestText.figure ? '' : ' (not a figure or state word)'));
  if (!m.slabInView) f.push('no slab in view');
  if (m.heaviestLinePx < 2) f.push('heaviest line is ' + m.heaviestLinePx + ' px');
  if (m.plexWithoutDigit.length) f.push('T2 Plex text without a digit: ' + m.plexWithoutDigit.join(' | '));
  const rh = m.ledgerRowHeights;
  if (rh.count) {
    if (w >= 1000 && rh.max > 64) f.push('P4 a ledger row is ' + rh.max + ' px at 1440');
    if (w < 1000 && rh.max > 96) f.push('P2 a ledger row is ' + rh.max + ' px at 360');
    if (w >= 1000 && ['lists', 'submersibles'].includes(screen) && m.rowsInView < 8) f.push('P4 only ' + m.rowsInView + ' rows in view at 1440 (8 wanted)');
  }
  if (w < 1000 && m.firstRowFromHeader != null && ['lists', 'submersibles', 'tracker'].includes(screen)) {
    const lim = STRIP.has(screen) ? 256 : 200;
    if (m.firstRowFromHeader > lim) f.push('P3 first row starts ' + m.firstRowFromHeader + ' px below the header (limit ' + lim + ')');
  }
  if (m.tapTargetsTooSmall.length) f.push('A6 tap targets under size: ' + m.tapTargetsTooSmall.join(', '));
  return f;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const measures = {}, failures = [], hard = [];
const keep = {}; // desktop pictures for the sheets

async function shot(screen, [w, h], look, mode, extra, file) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('requestfailed', (r) => errs.push('request failed ' + r.url()));
  await page.goto(pathToFileURL(path.join(MOCK, screen + '.html')).href + '?look=' + look + '&mode=' + mode + extra);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const m = await page.evaluate(measure);
  m.consoleErrors = errs;
  const png = await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  const fails = judge(file, w, screen, m);
  m.failures = fails;
  measures[file] = m;
  fails.forEach((x) => failures.push(file + ': ' + x));
  if (errs.length) hard.push(file + ': console errors ' + errs.join(' | '));
  if (!m.fontsLoaded) hard.push(file + ': a font did not load');
  await ctx.close();
  return png;
}

try {
  for (const [look, mode] of PAIRS) {
    for (const screen of SCREENS) {
      for (const size of SIZES) {
        const file = screen + '-' + size[0] + '-' + look + '-' + mode + '.png';
        const png = await shot(screen, size, look, mode, '', file);
        if (size[0] === 1440) (keep[look + '-' + mode] = keep[look + '-' + mode] || []).push(png);
      }
    }
    // the sheet: the six desktop pictures, three by two
    const imgs = keep[look + '-' + mode].map((b) => '<img src="data:image/png;base64,' + b.toString('base64') + '" style="width:480px;height:333px;display:block">').join('');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 666 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent('<body style="margin:0;display:grid;grid-template-columns:repeat(3,480px)">' + imgs + '</body>');
    await page.screenshot({ path: path.join(OUT, 'sheet-' + look + '-' + mode + '.png') });
    await ctx.close();
  }
  for (const screen of SCREENS) await shot(screen, [1440, 1000], 'crystarium-dawnglass', 'light', '&heads=caps&seal=caps', screen + '-1440-crystarium-dawnglass-light-caps.png');
} finally { await browser.close(); }

const pngs = fs.readdirSync(OUT).filter((f) => f.endsWith('.png'));
fs.writeFileSync(path.join(OUT, 'measures.json'), JSON.stringify({ pictures: pngs.length, measuredPictures: Object.keys(measures).length, failures, measures }, null, 1) + '\n');
console.log(pngs.length + ' PNGs, ' + Object.keys(measures).length + ' measured, ' + failures.length + ' failed measures');
failures.forEach((x) => console.log('  ' + x));
if (hard.length) { hard.forEach((x) => console.log('ERROR ' + x)); process.exit(1); }
