// Pictures of the six pages on the built site, to prove one look: node docs/one-look/tools/shoot-site.mjs [out-dir] [page ...]
// Serves the site laid out as .github/workflows/pages.yml does (root, /tracker/, /atelier/) with the checks' own server
// (tracker/command-center/serve.js), sets the stored appearance choice as check.js does, and writes
// <page>-<1440|360>-<theme>-<mode>.png at deviceScaleFactor 1 (48 pictures). It also writes measures.json: the computed --paper
// and --seal of every page, which must equal Home's in each theme and mode. Needs `npm ci && npx playwright install chromium`.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const { start, BASE } = require(path.join(ROOT, 'tracker', 'command-center', 'serve.js'));

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'one-look', 'foundation-pictures'));
const ONLY = process.argv.slice(3);
const PAGES = [['home', ''], ['settings', '#settings'], ['submersibles', 'submersibles/'], ['lists', 'lists/'], ['tracker', 'tracker/'], ['atelier', 'atelier/']];
const SIZES = [[1440, 1000], [360, 800]];
const CHOICES = [['crystarium-dawnglass', 'light'], ['crystarium-dawnglass', 'dark'], ['azure-dragoon', 'dark'], ['uldah-sultanate-gilt', 'light']];

fs.mkdirSync(OUT, { recursive: true });
const server = await start(8431);
const browser = await chromium.launch();
const measures = {};
try {
  for (const [theme, mode] of CHOICES) for (const [w, h] of SIZES) for (const [name, rel] of PAGES) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: mode, serviceWorkers: 'block' });
    await ctx.addInitScript((a) => { try { localStorage.setItem('eveniunt-tracker-ui', JSON.stringify({ theme: a[0], look: { shared: { theme: a[1] } } })); } catch (e) { /* none */ } }, [mode, theme]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:8431' + BASE + rel);
    if (name === 'tracker') { // the first opening asks how many characters: two test characters
      await page.waitForSelector('#dlg[open]', { timeout: 30000 });
      await page.selectOption('#nchars', '2');
      await page.fill('[data-name="0"]', 'Tamsin Reed'); await page.fill('[data-name="1"]', 'Joss Marlowe');
      await page.click('#go');
      await page.waitForSelector('.ov-table', { timeout: 30000 });
    } else if (name === 'atelier') await page.waitForFunction(() => !document.getElementById('boot') && window.__atelier, null, { timeout: 60000 });
    else if (name === 'submersibles' || name === 'lists') await page.waitForSelector('#view', { timeout: 30000 });
    else await page.waitForSelector('.ol-hdr');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const tag = theme + '-' + mode;
    measures[name + '-' + w + '-' + tag] = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement), hd = document.querySelector('.ol-hdr'), mk = hd && hd.querySelector('.ol-mk-word'); return { paper: cs.getPropertyValue('--paper').trim(), seal: cs.getPropertyValue('--seal').trim(), header: hd ? Math.round(hd.getBoundingClientRect().height) : null, wordFont: mk ? getComputedStyle(mk).fontSize : null }; });
    if (errors.length) measures[name + '-' + w + '-' + tag].errors = errors;
    await page.screenshot({ path: path.join(OUT, name + '-' + w + '-' + tag + '.png') });
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(OUT, 'measures.json'), JSON.stringify(measures, null, 1) + '\n');
console.log('pictures in ' + OUT);
