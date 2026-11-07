# Eveniunt Atelier — build plan and feature inventory

Owner request 2026-11-06 (see `.ai/DECISIONS.md`): an offline, single-file build of every Raphael capability plus a step-by-step guide for expert recipes. Raphael (KonaeAkira/raphael-rs, Apache-2.0, commit 723b17e) is used unchanged as a library and credited.

## Architecture
- `atelier/bridge/`: Rust crate depending on raphael-sim, raphael-solver, raphael-data and raphael-translations (path deps), plus Raphael's macro-text logic (from `raphael-gui/src/macros.rs`, Apache-2.0 notice kept). It exposes a JSON API through wasm-bindgen: recipe and mission search, game settings, solve with progress and cancel, simulate, and macro text.
- The single HTML file holds the base64-embedded WebAssembly module (instantiated offline from memory) running in a Web Worker, the Atelier interface, and the Cosmic step-by-step engine (`../src/engine`) for expert recipes.
- Threads: from `file://` there is no SharedArrayBuffer, so the solver runs single-threaded in a worker. It is built with release optimizations, LTO and wasm-opt for speed.

## Raphael features to replicate (from the GUI source)
- Recipe search over all recipes in seven languages; filters for active job only, stellar missions and custom recipes. Override recipe level, progress, quality and durability, dividers and modifiers, and progress/quality per 100% efficiency.
- Crafter stats per job: level, craftsmanship, control, CP, manipulation, Heart and Soul, Quick Innovation; copy to all jobs; copy and paste crafter config.
- Food and potion (HQ) selection with stat bonuses.
- Initial quality: HQ materials per ingredient, or a custom value.
- Target quality; collectable tiers; stellar mission links (copy item and mission name).
- Solver settings: ensure 100% reliability (adversarial), backload progress, solution must reach target quality (allow non-max), and the compute-thread note.
- Solve with progress (nodes visited) and cancel; errors for no solution, search queue capacity exceeded and internal error.
- Simulation view: progress, quality, durability and CP bars, HQ %, steps and duration, overflow, "assuming Normal condition".
- Macro view: split macro, include delay, extra delay, end-of-macro notification (default or custom format, sound, different last notification, avoid single-action macros), macro lock and intro (default or custom), placeholders {index} {max_index} {item_name} {food} {potion} {craftsmanship} {control} {cp}, copy per block.
- Saved macros and solve history: load, delete, default load operation, load saved rotations when initiating a solve.
- Settings: theme, layout, language.

## Atelier additions
- Expert recipes: Raphael's macro is always shown. It is replayed against simulated random conditions; it is recommended only if it reaches the target with no lucky conditions (owner: reliable = 100%). Otherwise a prominent banner says "Use the step-by-step guide", with both success rates, and a Start guide button opens the live guide with the stats and recipe prefilled.
- Consumable escalation (owner, 2026-11-06): if the macro for the current setup does not reach the target with no lucky conditions, re-solve with the best latest-tier HQ crafting food, then food + medicine. "Best" means the largest effective bonus for the user's base stats, since bonuses are percentages with caps. Show a banner naming the loadout that makes the macro reliable at 100%, with a one-click apply. The saved setup is never changed silently.
- Name: Eveniunt Atelier, part of the Eveniunt Network Command Center. Credit: "Powered by Raphael (Apache-2.0)".

## Timer safety (owner, 2026-11-06)
- Cache solves per recipe + stats; solve ahead while browsing; an always-visible "Skip to guide" on expert recipes (the guide answers in ~0.5 s per step and does not depend on Raphael's solver).

## Status
- [x] Pinned toolchain installs; Raphael builds natively (release, 48 s).
- [x] Bridge crate and wasm build (5.7 MB). Check: recipe 38200 at 5800/5600/750 gives the same 34-action rotation and final state as the native raphael-cli (7481 progress / 19710 quality); 19 s single-threaded in WebAssembly vs 12 s native on 2 threads.
- [x] Interface parity (see README.md for the feature map)
- [x] Expert guide integration, reliability verdict, food/medicine escalation, timer safety
- [x] Tests: 7/7 end-to-end incl. native-CLI parity (VALIDATION.md)
- [ ] Owner ship
