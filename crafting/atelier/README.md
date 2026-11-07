# Eveniunt Atelier

One offline HTML file (`dist/eveniunt-atelier.html`, about 8.5 MB) for Final Fantasy XIV crafting, part of the Eveniunt Network Command Center. It has Raphael's solver, simulator, recipe and mission search and macro generator, in all seven game languages. For expert recipes it adds a check of whether the macro is reliable and a live step-by-step guide.

## Use it

Double-click the file. It needs no internet, no install and no server, and works in current Chrome, Edge, Firefox and Safari.

On a wide screen, **01 Recipe** and **02 Crafter stats** sit side by side, and **03 Macro** runs across the full width below them: the rotation and its graph on the left, the macro cards on the right. On a phone, the three sections are tabs.

1. **01 Recipe:** with the search box empty, the list shows **every recipe of your job in crafting-log order**, page by page as in the game (Lv 1–5, 6–10 … then Master Recipes, Collectables and other special pages), and Cosmic Exploration recipes last, grouped by planet and mission class. Type to search instead. Untick *Active job only* to list all eight jobs. **Stellar missions** lists every mission, by planet and class. Every Cosmic recipe carries its class badge (**D C B A EX EX+ Master**), because many share a name. Or enter a **Custom** recipe. If the recipe takes HQ materials, a pink **HQ** box asks you to set them before solving (**Use all HQ** fills them in), and a reminder sits beside the Solve button until you do.
2. **02 Crafter stats:** pick your job and enter your base stats (Raphael's convention: **without** food and medicine). Pick a food and a medicine, and the boosted stats show underneath. ⧉ copies your crafter config in Raphael's format and ⇩ pastes one in, including configs copied on raphael-xiv.com. Choose the target quality and solver options, then press **Solve** (Ctrl+Enter).
3. **03 Macro:** the result as HQ % (or collectable / Cosmic tier), bars, the woven rotation (one card per action showing **the in-game icon for your selected job**, colored threads where buffs are active), a full-size graph of progress, quality and durability after each step (hover a step for its numbers), and macro cards to copy into the game. All of Raphael's macro options are there: split, delays, notifications and lock/intro, with placeholders. Saved macros and solve history are under the drawer at the bottom.

**Expert recipes.** The macro is always shown. Beside it, the Atelier replays it against 3,000 simulated crafts with random conditions and once with no lucky conditions at all.
- A green **Macro is reliable** banner means it reached your target every time: just run it.
- Otherwise a glowing **Use the step-by-step guide** banner appears, with both success rates. The macro is greyed and marked "not recommended", and **Start guide** opens the live guide.
- If the macro isn't reliable, the Atelier also re-solves with the best latest-tier HQ food, then food plus medicine. If that makes the macro reliable, a **Food fixes it** banner offers one-click **Apply loadout**.

**Live guide.** It opens inside the workbook, just above the Macro section. It shows one big action at a time, with its in-game icon. After doing it in game, tap the new condition, or press its key (N G E P C S L M R O B; hold Shift if a risky action failed; U undoes; Esc closes). **Correct state** fixes any drift. **Skip to the step-by-step guide** is always available on expert recipes, so a timed mission never waits on a solve.

## Installable app

The same Atelier also runs as an installable web app from the public repository SplitzHappen/Eveniunt-Command-Center, published to GitHub Pages at `/atelier/`.
- **Install:** click **Install app** in the header, or use the browser's install icon. It works offline after the first visit.
- **Multi-core solving:** the service worker (`site-src/sw.js`) adds the cross-origin isolation headers that GitHub Pages cannot send. With them, the solver runs Raphael's multi-threaded build (`tools/build-wasm-mt.sh`, the same flags as raphael-xiv.com) in a module worker (`site-src/solver-worker.js`).
- **Speed:** on a 4-core test machine the hardest test recipe (38200, Auxesia Master, 34 steps) took 18.1 s on 1 browser thread, 13.2 s on 2 and 11.6 s on 4. The plain single-core file takes 15.3 s, so the browser gain is about 25%. Raphael's native program does 13.8 s → 7.4 s on the same machine. Browser threads carry overhead, so more cores help, but not twice as much.
- **Build:**
  1. `tools/build-wasm-mt.sh` (nightly-2026-05-10, rust-src)
  2. `node tools/build.js`
  3. `FONT_DIR=… node tools/make-icons.js` (icons only)
  4. `node tools/build-site.js`, which writes `site/`
- **Publish:** `../tools/publish-public.sh <clone of Eveniunt-Command-Center>`

## Speed

From a file, browsers don't allow multi-threaded WebAssembly, so the solver uses one core. Most recipes solve in seconds; hard endgame experts can take 20–30 s. Solves are remembered: the same recipe, stats and options load instantly from history.

## Build from source

```
tools/build-wasm.sh                     # Rust stable + wasm32 target, wasm-bindgen-cli 0.2.100, binaryen wasm-opt
python3 tools/prepare-data.py <ffxiv-datamining> <raphael-rs>
FONT_DIR=<node_modules/@fontsource> node tools/build.js
node --test tests/atelier.test.js       # needs Playwright + Chromium
```

## Design rules set by the owner

- **Keep the clustered recipe list, always.** With an empty search, the list shows every recipe of the job grouped by crafting-log page (Lv 1–5 … Master Recipes, Collectables …), then Cosmic Exploration by planet and mission class, with class badges. Future changes must keep this (owner, 2026-11-06). `tests/atelier.test.js` test 8 checks it.
- Appearance follows ChatGPT's Appearance settings. **Mode:** System / Light / Dark tiles. **Theme:** only the 20 FFXIV themes (Crystarium Dawnglass, Ishgard Hoarfrost, Limsa Brineward, Ul'dah Sultanate Gilt, Twelveswood Verdure, Allagan Circuitry, Magitek Steel, Umbral Ice Astral Fire, Lily of the Healer, Azure Dragoon, Abyssal Oath, Moonfire Faire, Starlight Celebration, Aetheryte Glow, First World Twilight, Ascian Crimson, Sharlayan Lore, Radz-at-Han Jewel, Doman Sakura, Ultima Thule), each with light and dark colors; the default is Crystarium Dawnglass, plus download, copy and paste of a theme. **Accent** (Default, Blue, Green, Yellow, Pink, Orange, Purple, Black/White, Custom), **Background** and **Foreground**, each by color picker, HEX or R G B. **Advanced:** UI font size, code font size, reduce motion (System/On/Off), separate light and dark modes, contrast. ChatGPT's *Diff markers* setting is left out because the Atelier shows no diffs.
- The step-by-step guide opens as a panel inside the workbook (between Crafter and Macro), never as a separate page.
- **Logo:** the Limit Break wordmark (owner choice, concept 8 in `proposals/wordmarks/`). Its colours always come from the active theme: a bright tint of the accent, the accent, then the progress colour. The gauge charges while a solve runs.
