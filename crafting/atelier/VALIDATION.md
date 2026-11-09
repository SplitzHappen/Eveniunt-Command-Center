# Eveniunt Atelier — validation

Build `dist/eveniunt-atelier.html` (6.96 MB). Raphael commit `723b17e`. Date 2026-11-06.

## Parity with Raphael

| Check | Result |
| --- | --- |
| Same rotation as Raphael's native CLI (release build): recipe 35829 (normal, 21 steps), 34415 (level-80 expert, 14 steps), 38200 (Auxesia Master expert, 34 steps) | Identical action lists and identical final progress/quality |
| Macro text vs Raphael's own unit test (default settings, every action; durations 40/44/14 s; lock + notification) | Identical |
| Guide engine vs Raphael simulator on those three rotations (Normal conditions) | Identical progress, quality, durability, CP |
| Crafter config in Raphael's RON format | Pastes in and copies out |
| Coverage | 13,892 recipes, 544 expert recipes, all stellar missions, 100 foods and 24 medicines, 7 languages (data and Raphael's UI strings) |

## Automated tests (`tests/atelier.test.js`, 14/14 pass on 2026-11-09, 11 on 2026-11-06; Chromium from `file://` with every non-local request aborted, plus one hosted test over HTTP)

1. Opens offline: no external scripts, stylesheets or requests; no console errors.
2. Solver parity (above).
3. Macro text parity (above).
4. Level-80 expert at endgame stats → "Macro is reliable" (3,000/3,000 simulated crafts and the no-luck case), one loom column per action, copyable cards.
5. The same expert at level-80 stats → guide banner, macro flagged "not recommended", the food and medicine check finishes, the guide answers keys, and undo restores the exact state.
6. Solve history survives a reload, and identical parameters load instantly; a Raphael RON config pastes in; Japanese produces Japanese macros.
7. Stellar mission search, a custom recipe solve, no sideways scroll at 390 px, and it works with browser storage blocked.
8. Command Center gate 1C (two tests): the one save, the character switcher and the one-time question; "Not now" asks again; with no characters, one set as before.
9. Command Center gate 1D (hosted site over HTTP): the first visit reloads exactly once, under the Atelier's own worker, and ends cross-origin isolated on more than one thread; the **⌂ Command Center** link points at the site root; the hand-over notice shows, **Got it** records it on the device and it stays away after a reload; the file opened from disk has neither. The site-wide cases (a root worker that does not isolate `atelier/`, offline with the shell present, the way back) are checks C12 to C14 of `projects/eveniunt-completionist-tracker/command-center/check.js`.
8. With an empty search, all eight jobs list every recipe Raphael has (no duplicates), and the first page matches the game's crafting-log order. Each job's 198 Cosmic recipes carry a class badge. Stellar missions list all 198 mission recipes across the four planets, in class order within each planet. Icons differ by job where the game's do. The HQ-material prompt shows in both panes until **Use all HQ** sets them, then switches to a confirmation.

Test 4 also checks that every action card shows an icon and that the step graph is drawn at full size (at least 180 px tall).

Shared engine: the Cosmic tool's suites still pass after the one engine change (durability now saturates at 0, as in Raphael and the game display): engine 25/25, browser 9/9.

## Speed (this build machine, one core)

| Recipe | Native Raphael (2 threads) | Atelier (WebAssembly, 1 thread) |
| --- | --- | --- |
| Tacos (normal, Lv100) | — | about 7 s in the page |
| Auxesia Master 38200 at 5800/5600/750 | 12 s | 19–28 s (machine load varied) |

Boot takes about 0.7 s (compiling 5 MB of WebAssembly). The build uses SIMD, bulk memory and `wasm-opt -O3`, the same features as Raphael's own web build except threads, which `file://` pages cannot use. Repeat solves load from history.

## Limits

- Single-threaded offline, so hard expert solves are slower than raphael-xiv.com (multi-threaded).
- "Reliable" relies on the engine's condition model (community estimates) for the 3,000 random crafts. The no-luck check uses Raphael's exact simulator.
- Interface text is translated wherever it matches one of Raphael's 146 translated strings; Atelier-only text (verdicts, guide) is English.
- The data is Raphael's snapshot at commit `723b17e` (2026-10-18); a later game patch needs a rebuild.
- The live site could not be opened from the build environment, so parity is with Raphael's source code, not a visual comparison with raphael-xiv.com.
9. Closing the guide returns to the workbook: the big banner becomes a slim line, "Use the macro anyway" removes the grey-out, reopening resumes at the same step, and Esc closes.
10. The guide opens inside the workbook (not a separate page). Appearance: three Mode tiles, only the 20 FFXIV themes (no ChatGPT or Codex themes; default Crystarium Dawnglass) (Abyssal Oath checked, logo colour follows it) (Dracula light and dark checked), custom accent and background by HEX and RGB kept in sync, separate light and dark modes, reduce motion, code font size; native dropdown lists use the theme colours.
11. Installable app: `site/` is served over plain HTTP like GitHub Pages, with no special headers. The test checks that the manifest is valid, the service worker makes the page cross-origin isolated after its single automatic reload, the solver starts with more than one thread, recipe 38200 solves to the native CLI's quality (19,710, 34 steps), and the app reloads and works with the network cut.
