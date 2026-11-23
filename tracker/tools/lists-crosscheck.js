'use strict';
// Cross-check of the Lists data against the Atelier's own recipe table (docs/lists-spec.md section 6, D2).
// Loads the solver glue and WebAssembly that command-center/restore-build-inputs.js writes to crafting/atelier/build/ the way
// the Atelier's own tools do (a vm context, initSync with the .wasm bytes), asks recipe(id, 'en') for every recipe of the data
// and compares:
//   strictly: the set of recipe ids, the result item and the job;
//   the ingredient list and its amounts after reducing the sheet ingredients to the items the Atelier lists: items with flag
//   bit 2 (can be high quality) set and bit 8 (crystal) clear. The Atelier exposes only those ingredients (ruling 2026-11-22).
// Any difference throws, naming the recipe id and both sides. Yields are not compared (the Atelier exposes none).
// Recipes the Atelier lacks are allowed: they are returned as `noHandOver` (no Atelier link in the page).
// Usage: require('./lists-crosscheck.js').check(listsJson) -> { compared, agreed, noHandOver: [ids] }
const fs = require('fs'), path = require('path'), vm = require('vm');
const BUILD = path.join(__dirname, '..', '..', 'crafting', 'atelier', 'build');

function loadSolver() {
  const glue = path.join(BUILD, 'atelier_bridge.js'), wasm = path.join(BUILD, 'atelier_bridge_bg.wasm');
  if (!fs.existsSync(glue) || !fs.existsSync(wasm)) throw new Error('lists cross-check: solver files missing in crafting/atelier/build (run node command-center/restore-build-inputs.js)');
  const ctx = vm.createContext({ console, WebAssembly, TextDecoder, TextEncoder, URL, Object, Array, JSON });
  vm.runInContext(fs.readFileSync(glue, 'utf8') + ';this.__W=wasm_bindgen;', ctx);
  ctx.__W.initSync({ module: fs.readFileSync(wasm) });
  return ctx.__W;
}

function check(data) {
  const W = loadSolver();
  const atelier = new Set(JSON.parse(W.search_recipes('', 'en', -1, 1000000)).map((r) => String(r.id)));
  const extra = [...atelier].filter((id) => !data.recipes[id]);
  if (extra.length) throw new Error('lists cross-check: the Atelier has recipes the sheets lack: ' + extra.slice(0, 10).join(', ') + (extra.length > 10 ? ' (and ' + (extra.length - 10) + ' more)' : ''));
  const noHandOver = [];
  let compared = 0, agreed = 0;
  for (const id of Object.keys(data.recipes)) {
    const r = data.recipes[id];
    if (!atelier.has(id)) { noHandOver.push(Number(id)); continue; }
    compared++;
    const a = JSON.parse(W.recipe(Number(id), 'en'));
    const want = r[5].filter(([i]) => { const f = data.items[i][1]; return (f & 2) && !(f & 8); });
    const got = a.ingredients.map((i) => [i.itemId, i.amount]);
    if (a.itemId !== r[0] || a.job !== r[2] || JSON.stringify(got) !== JSON.stringify(want))
      throw new Error('lists cross-check: recipe ' + id + ' differs. Sheets: item ' + r[0] + ', job ' + r[2] + ', ingredients ' + JSON.stringify(want) + '. Atelier: item ' + a.itemId + ', job ' + a.job + ', ingredients ' + JSON.stringify(got));
    agreed++;
  }
  noHandOver.sort((x, y) => x - y);
  return { compared, agreed, noHandOver };
}

module.exports = { check };
