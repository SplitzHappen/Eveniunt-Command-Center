'use strict';
// Gate 1A prototype: the size measurements (blueprint section 4a, rules 6 and 11). Reads the two current single
// files and the tracker's core code; changes nothing; writes evidence/measure.json.
// Usage: node measure.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const TRACKER = path.join(__dirname, '..', '..');
const ATELIER = path.join(TRACKER, '..', 'ffxiv-cosmic-crafting-solver', 'atelier');
const FILES = { tracker: path.join(TRACKER, 'dist', 'eveniunt-tracker.html'), atelier: path.join(ATELIER, 'dist', 'eveniunt-atelier.html') };
const MB = (n) => +(n / 1e6).toFixed(3);
const out = { date: new Date().toISOString(), node: process.version };

// ---------------------------------------------------------------- rule 6: the single offline files
const b64 = (n) => Math.ceil(n / 3) * 4; // bytes once written into the HTML as base64 text
const deflate = (buf) => zlib.deflateRawSync(buf, { level: 9 }).length; // what the browser's DecompressionStream reads
const parts = {};
for (const [app, file] of Object.entries(FILES)) {
  const s = fs.readFileSync(file, 'utf8');
  const p = { fileBytes: fs.statSync(file).size, blocks: [] };
  const re = /<(script|style)([^>]*)>([\s\S]*?)<\/\1>/g; let m;
  while ((m = re.exec(s))) {
    const id = (m[2].match(/id="([^"]+)"/) || [])[1] || m[1];
    const type = (m[2].match(/type="([^"]+)"/) || [])[1] || (m[1] === 'style' ? 'text/css' : 'text/javascript');
    p.blocks.push({ id, type, bytes: Buffer.byteLength(m[3]), body: m[3] });
  }
  const fonts = new Map();
  const reF = /url\((["']?)(data:[^)"']+)\1\)/g; let f;
  while ((f = reF.exec(s))) fonts.set(crypto.createHash('sha1').update(f[2]).digest('hex'), Buffer.byteLength(f[2]));
  p.fonts = fonts;
  parts[app] = p;
}
const fontUnion = new Map([...parts.tracker.fonts, ...parts.atelier.fonts]);
const sum = (it) => [...it].reduce((a, b) => a + b, 0);
const fontBytes = { tracker: sum(parts.tracker.fonts.values()), atelier: sum(parts.atelier.fonts.values()), onceForBoth: sum(fontUnion.values()), sharedFiles: [...parts.tracker.fonts.keys()].filter((k) => parts.atelier.fonts.has(k)).length, totalFiles: fontUnion.size };

// how each block would be stored in the all-in-one file
const plan = [];
for (const [app, p] of Object.entries(parts)) {
  for (const b of p.blocks) {
    let stored, how;
    if (b.type === 'text/css') { stored = b.bytes - (app === 'tracker' ? fontBytes.tracker : fontBytes.atelier); how = 'styles without fonts (fonts counted once below)'; }
    else if (b.type === 'application/json' && b.id !== 'icons') { stored = b64(deflate(Buffer.from(b.body))); how = 'JSON data, compressed (deflate) + base64, unpacked when the module opens'; }
    else if (b.id === 'raphael-wasm') { const bin = Buffer.from(b.body.trim(), 'base64'); stored = b64(deflate(bin)); how = 'solver WebAssembly (base64 today), compressed + base64'; }
    else if (b.id === 'info-data') { stored = b.bytes; how = 'already compressed + base64 today: unchanged'; }
    else if (b.id === 'icons') { stored = b.bytes; how = 'WebP images as base64 (already compressed): unchanged'; }
    else { stored = b.bytes; how = 'code: unchanged (shared core code would be counted once)'; }
    plan.push({ app, id: b.id, todayBytes: b.bytes, allInOneBytes: stored, how });
  }
}
const allInOne = sum(plan.map((x) => x.allInOneBytes)) + fontBytes.onceForBoth;
// the shell itself (header, switcher, settings, one save, migration) is new code; an allowance, not a measurement
const SHELL_ALLOWANCE = 300000;
// what the browser must unpack on opening the Tracker and the Atelier modules (time on this machine, Node's zlib)
function inflateMs(ids) {
  let ms = 0;
  for (const [app, p] of Object.entries(parts)) for (const b of p.blocks) if (ids.includes(app + ':' + b.id)) {
    const raw = b.id === 'raphael-wasm' ? Buffer.from(b.body.trim(), 'base64') : Buffer.from(b.body);
    const z = zlib.deflateRawSync(raw, { level: 9 });
    const t = process.hrtime.bigint(); zlib.inflateRawSync(z); ms += Number(process.hrtime.bigint() - t) / 1e6;
  }
  return +ms.toFixed(1);
}
out.singleFile = {
  today: { trackerBytes: parts.tracker.fileBytes, atelierBytes: parts.atelier.fileBytes, bothBytes: parts.tracker.fileBytes + parts.atelier.fileBytes, trackerMB: MB(parts.tracker.fileBytes), atelierMB: MB(parts.atelier.fileBytes), bothMB: MB(parts.tracker.fileBytes + parts.atelier.fileBytes) },
  fonts: fontBytes,
  blocks: plan,
  allInOne: { bytes: allInOne, MB: MB(allInOne), withShellAllowanceMB: MB(allInOne + SHELL_ALLOWANCE), shellAllowanceBytes: SHELL_ALLOWANCE, savingVsTwoFilesMB: MB(parts.tracker.fileBytes + parts.atelier.fileBytes - allInOne - SHELL_ALLOWANCE) },
  unpackMsOnThisMachine: { trackerModule: inflateMs(['tracker:tracker-data', 'tracker:desktop-map', 'tracker:links-data', 'tracker:cond-data', 'tracker:live-data']), atelierModule: inflateMs(['atelier:atelier-data', 'atelier:raphael-wasm']) },
};

// ---------------------------------------------------------------- rule 11: the worst-case save against Google Drive
globalThis.ET = {};
for (const f of ['model', 'codec', 'merge', 'gdrive']) require(path.join(TRACKER, 'src', 'core', f + '.js'));
const ET = globalThis.ET;
const data = JSON.parse(fs.readFileSync(path.join(TRACKER, 'data', 'tracker-data.json'), 'utf8'));
const idx = ET.indexData(data);
const allKeys = idx.sections.flatMap((s) => ET.sectionKeys(s));
const valKeys = allKeys.filter((k) => idx.byKey.get(k).e.val);
const names = ['Aaaaaaaaaaaaaaa Bbbbbbbbbbbbbbb', 'Ccccccccccccccc Ddddddddddddddd', 'Eeeeeeeeeeeeeee Fffffffffffffff', 'Ggggggggggggggg Hhhhhhhhhhhhhhh',
  'Iiiiiiiiiiiiiii Jjjjjjjjjjjjjjj', 'Kkkkkkkkkkkkkkk Lllllllllllllll', 'Mmmmmmmmmmmmmmm Nnnnnnnnnnnnnnn', 'Ooooooooooooooo Ppppppppppppppp'];
function fullState(opts) {
  const st = ET.newState(names);
  st.chars.forEach((c, i) => { c.lodestone = String(10000000 + i); c.gc = 1 + (i % 3); c.cls = ['mrd', 'acn', 'lnc', 'arc', 'cnj', 'gla', 'pgl', 'thm'][i]; });
  for (const c of st.chars) {
    for (const k of allKeys) st.ticks[c.id][k] = 1;
    for (const k of valKeys) st.vals[c.id][k] = 9999;
    if (opts.excludeAll) for (const k of allKeys) st.excl[c.id][k] = 1;
  }
  if (opts.overrideAll) for (const k of allKeys) st.avail[k] = 'ok';
  return ET.validateState(st);
}
const cloudDoc = (st) => JSON.stringify(Object.assign({ app: 'eveniunt-completionist-tracker', v: ET.STATE_VERSION }, ET.portable(st))); // what gdrive.js uploads

// sample module data for the new save sections (shapes are this prototype's assumption; no schema exists yet)
function sampleLists(nLists, nItems) {
  return Array.from({ length: nLists }, (_, i) => ({ id: 'l' + i, name: 'List ' + (i + 1) + ' — Dawntrail crafted gear and housing', created: 1794000000000 + i, items: Array.from({ length: nItems }, (_, j) => ({ item: 40000 + j * 7, qty: 1 + (j % 20), have: j % 13, done: j % 3 === 0, hq: j % 2 === 0, note: j % 10 === 0 ? 'from the Market' : '' })) }));
}
function sampleSubs(nFc, voyagesPerSub) {
  return Array.from({ length: nFc }, (_, f) => ({ id: 'fc' + f, world: 'Gilgamesh', name: 'Free Company ' + (f + 1), chars: ['c' + (f + 1)], subs: Array.from({ length: 4 }, (_, s) => ({
    name: 'Submarine ' + (s + 1), build: { hull: 31 + s, stern: 32 + s, bow: 33 + s, bridge: 34 + s }, rank: 125, exp: 1234567,
    voyage: { sectors: [53, 54, 55, 56, 57], start: 1794000000000, ret: 1794080000000 },
    log: Array.from({ length: voyagesPerSub }, (_, v) => ({ at: 1790000000000 + v * 86400000, sectors: [53, 54, 55, 56, 57], exp: 180000, loot: Array.from({ length: 10 }, (_, l) => ({ item: 22500 + l, qty: 1 + l })) })),
  })) }));
}
function sampleAtelier(nHistory, nSaved) {
  const req = { recipe: { rlvl: 690, level: 100, progress: 6600, quality: 12000, durability: 80, expert: false, conditions: 15 }, stats: { craftsmanship: 5200, control: 5100, cp: 620, level: 100, manipulation: true, heartAndSoul: false, quickInnovation: false },
    target: 12000, initialQuality: 0, adversarial: false, backload: false, mustReach: false, ssh: 0, job: 3, food: 46003, potion: 44169 };
  const entry = (i) => ({ id: 'h' + i, key: 'k' + i + '-690-6600-12000-80-5200-5100-620', name: 'Recipe ' + i, req, actions: Array.from({ length: 34 }, (_, a) => (a * 7) % 30), recipeId: 38200 + i, custom: null, food: 46003, potion: 44169, job: i % 8, stats: req.stats, duration: 12345, at: 1794000000000 + i });
  return { saved: Array.from({ length: nSaved }, (_, i) => entry(i)), history: Array.from({ length: nHistory }, (_, i) => entry(1000 + i)) };
}

const LIMIT = ET.DRIVE_MAX_BYTES;
function sizes(label, st, modules) {
  const doc = cloudDoc(st);
  const withModules = modules ? JSON.stringify(Object.assign(JSON.parse(doc), { modules })) : doc;
  const bytes = Buffer.byteLength(withModules);
  const z = zlib.deflateRawSync(Buffer.from(withModules), { level: 9 }).length;
  return { label, cloudCopyBytes: bytes, cloudCopyMB: MB(bytes), shareOfLimit: +(bytes / LIMIT).toFixed(3), fits: bytes <= LIMIT, compressedBytes: z, compressedBase64Bytes: b64(z), compressedShareOfLimit: +(b64(z) / LIMIT).toFixed(3) };
}
(async () => {
  const realistic = fullState({});
  const upper = fullState({ excludeAll: true, overrideAll: true });
  const modules = { lists: sampleLists(50, 200), submersibles: sampleSubs(8, 365), atelier: sampleAtelier(500, 100) };
  const modulesBig = { lists: sampleLists(200, 300), submersibles: sampleSubs(8, 1095), atelier: sampleAtelier(500, 200) };
  const modSizes = Object.fromEntries(Object.entries(modules).map(([k, v]) => [k, Buffer.byteLength(JSON.stringify(v))]));
  const modBigSizes = Object.fromEntries(Object.entries(modulesBig).map(([k, v]) => [k, Buffer.byteLength(JSON.stringify(v))]));
  const local = JSON.stringify(Object.assign({}, realistic, { sync: { fc: {}, drive: { fileId: 'x', at: '', base: ET.portable(realistic) }, backupAt: null } }));
  out.save = {
    driveLimitBytes: LIMIT, driveLimitMB: MB(LIMIT),
    trackerEntries: allKeys.length, levelEntries: valKeys.length, characters: 8,
    cases: [
      sizes('Tracker only, 8 characters, every entry ticked, every level at 9999 (worst real case today)', realistic),
      sizes('Tracker only, theoretical upper bound (also every entry excluded and every availability overridden)', upper),
      sizes('Worst real tracker case + sample modules (50 lists x 200 items, 8 free companies x 4 submarines x 1 year of voyages, Atelier 500 history + 100 saved macros)', realistic, modules),
      sizes('Worst real tracker case + large modules (200 lists x 300 items, 3 years of voyages, Atelier 500 history + 200 saved)', realistic, modulesBig),
    ],
    sampleModuleBytes: modSizes, largeModuleBytes: modBigSizes,
    otherCopies: {
      backupFileBytes: Buffer.byteLength(ET.exportFile(realistic)),
      transferCodeChars: (await ET.makeTransferCode(realistic)).length,
      onDeviceStateWithSyncBaseBytes: Buffer.byteLength(local),
    },
    note: 'gdrive.js compares body.length (UTF-16 code units) with the limit, not bytes; names with non-Latin letters make the real upload larger than the figure it checks.',
  };
  fs.mkdirSync(path.join(__dirname, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'evidence', 'measure.json'), JSON.stringify(out, null, 2) + '\n');
  const s = out.singleFile;
  console.log('single files today: tracker ' + s.today.trackerMB + ' MB, atelier ' + s.today.atelierMB + ' MB, both ' + s.today.bothMB + ' MB');
  console.log('fonts: tracker ' + MB(fontBytes.tracker) + ' MB, atelier ' + MB(fontBytes.atelier) + ' MB, once for both ' + MB(fontBytes.onceForBoth) + ' MB (' + fontBytes.sharedFiles + ' of ' + fontBytes.totalFiles + ' font files shared)');
  console.log('all-in-one estimate: ' + s.allInOne.MB + ' MB (+ shell allowance = ' + s.allInOne.withShellAllowanceMB + ' MB); unpack ms: ' + JSON.stringify(s.unpackMsOnThisMachine));
  for (const b of plan) console.log('  ' + b.app + ':' + b.id + ' ' + MB(b.todayBytes) + ' -> ' + MB(b.allInOneBytes) + ' MB  (' + b.how + ')');
  console.log('Drive limit ' + out.save.driveLimitMB + ' MB; entries ' + allKeys.length + ' (levels ' + valKeys.length + ')');
  for (const c of out.save.cases) console.log('  ' + c.cloudCopyMB + ' MB (' + Math.round(c.shareOfLimit * 100) + '%), compressed ' + MB(c.compressedBase64Bytes) + ' MB (' + Math.round(c.compressedShareOfLimit * 100) + '%)  ' + c.label);
  console.log('modules: ' + JSON.stringify(modSizes) + ' large: ' + JSON.stringify(modBigSizes));
  console.log('other copies: ' + JSON.stringify(out.save.otherCopies));
})();
