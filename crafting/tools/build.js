#!/usr/bin/env node
'use strict';
/*
 * Bundle one self-contained HTML file per Cosmic Exploration destination.
 *   node tools/build.js            -> dist/cosmic-<planet>.html (+ dist/README.txt)
 * Everything (CSS, engine, planet data, UI) is inlined; the output makes no
 * network requests and needs no server.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const db = JSON.parse(read('data/cosmic-db.json'));
const engine = read('src/engine/sim.js') + '\n' + read('src/engine/solver.js');
const appJs = read('src/app/app.js');
const css = read('src/app/app.css');
const tpl = read('src/app/app.html');
const sourceHash = crypto.createHash('sha256').update(engine + appJs + css + tpl).digest('hex').slice(0, 12);

for (const [name, txt] of [['engine', engine], ['app', appJs]]) {
  if (/<\/script/i.test(txt)) throw new Error(`${name} source contains </script>`);
}

const RECIPE_KEYS = ['id', 'itemId', 'name', 'job', 'rlvl', 'level', 'stars', 'expert', 'progress', 'quality', 'durability',
  'difficultyFactor', 'qualityFactor', 'durabilityFactor', 'conditionsFlag', 'requiredQuality', 'requiredCraftsmanship',
  'requiredControl', 'maxLevelScaling', 'collectable', 'tierPct', 'tiers', 'profile'];

function planetDb(planet) {
  const missions = db.missions.filter(m => m.planet === planet.key).map(m => ({
    id: m.id, name: m.name, job: m.job, rank: m.rank, minLevel: m.minLevel, synced: m.synced, critical: m.critical,
    timeLimitSec: m.timeLimitSec, silver: m.silver, gold: m.gold, text: m.text, recipes: m.recipes,
    objectives: m.objectives.map(o => ({ kind: o.kind, items: o.items.map(it => ({ name: it.name, quantity: it.quantity })),
      bronzeScore: o.bronzeScore, specialAction: o.specialAction, specialActionCharges: o.specialActionCharges }))
  }));
  const recipes = {};
  const rlvls = new Set();
  for (const m of missions) for (const id of m.recipes) {
    const r = db.recipes[String(id)];
    const o = {};
    for (const k of RECIPE_KEYS) o[k] = r[k];
    recipes[String(id)] = o;
    rlvls.add(r.rlvl);
  }
  const levelAdjust = {};
  for (let lv = 10; lv <= 100; lv++) { levelAdjust[String(lv)] = db.levelAdjust[String(lv)]; rlvls.add(db.levelAdjust[String(lv)]); }
  const recipeLevels = {};
  for (const rl of [...rlvls].sort((a, b) => a - b)) recipeLevels[String(rl)] = db.recipeLevels[String(rl)];
  return {
    planet, jobs: db.jobs, jobNames: db.jobNames, missions, recipes, levelAdjust, recipeLevels,
    generated: {
      source: 'xivapi/ffxiv-datamining @ ' + (db.generated_from.commit || 'unknown').slice(0, 12),
      datamining: '7.57h1 (2026-10-20)',
      build: sourceHash
    }
  };
}

const outDir = path.join(ROOT, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
for (const planet of db.planets) {
  const pdb = planetDb(planet);
  const json = JSON.stringify(pdb).replace(/</g, '\\u003c');
  const html = tpl
    .replace('{{TITLE}}', () => `Cosmic Solver – ${planet.name}`)
    .replace(/\{\{PLANET\}\}/g, () => planet.name)
    .replace('{{PATCH}}', () => 'patch ' + planet.patch)
    .replace('{{CSS}}', () => css)
    .replace('{{DB}}', () => json)
    .replace('{{ENGINE}}', () => engine)
    .replace('{{APP}}', () => appJs);
  if (/\{\{[A-Z]+\}\}/.test(html)) throw new Error('unreplaced placeholder');
  if (/(src|href)\s*=\s*["']https?:/i.test(html)) throw new Error('external reference in output');
  const file = path.join(outDir, `cosmic-${planet.key}.html`);
  fs.writeFileSync(file, html);
  manifest.push({ file: path.basename(file), bytes: Buffer.byteLength(html), missions: pdb.missions.length,
    recipes: Object.keys(pdb.recipes).length, sha256: crypto.createHash('sha256').update(html).digest('hex') });
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ build: sourceHash, files: manifest }, null, 1));
console.log(manifest.map(m => `${m.file}  ${(m.bytes / 1024).toFixed(0)} KB  ${m.missions} missions  ${m.recipes} recipes`).join('\n'));
