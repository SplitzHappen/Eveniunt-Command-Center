# Submersibles: the look (visual redesign): spec

Written 2026-11-18 from reading the repository only. Nothing was built or run for this spec, and no screenshot was
viewed (the styles and markup were read instead). Read: `tracker/src/app/shared.css`, `tracker/src/app/tracker.css`,
`crafting/atelier/src/atelier.css`, the appearance module in `crafting/atelier/src/atelier.js`,
`tracker/command-center/src/shell.css`, `build.js`, `check.js` (the Submersibles blocks), `evidence/checks.json`
(three figures), `src/submersibles/{index.html,subs.css,chart.js}` and the rendering functions of `subs.js`, and the
chart tests in `tracker/tests/submarines.test.js`. Not read: `shell.js`, `settings.js`, the Tracker and Atelier markup.
Every contrast figure below was worked out by hand; item W1 adds a test that is the authority.

## 1. Goal and constraints

- Make every screen of the Submersibles module (Board, send window and sheets, Log, Earnings, Setup with the
  Customizable Recommendations panel, Map and planner, notices) bold and distinctive, and clearly the same family as the
  Command Center main menu, the Tracker and the Atelier. Make the sea chart the showpiece.
- **Look only.** No change to behaviour, data, the save, `save.js`, or the recommendation model. `advisor.js`,
  `recs.js`, `earn.js`, `fleet.js`, `push.js` are not opened. `subs.js` is edited only where an item names the function.
- Offline-first, public, hosted on GitHub Pages. No new external resource: only the five font families the build
  already ships, and artwork drawn by the app (CSS and SVG). No game artwork, no copied game assets. The app never
  automates the game and never presents an invented number as game data.
- Works in all 21 themes, light and dark, and with the Appearance panel's contrast and motion settings.
- Phone first: 360 px wide, no sideways page scroll, tap targets at least 36 px, keyboard focus always visible,
  WCAG AA contrast for text (4.5:1) and for meaningful graphics (3:1).
- `tracker/src/app/shared.css` is **not changed** (it is the Atelier's copy and is embedded in the Tracker). The Tracker
  and the Atelier need no rebuild. If an item seems to need a change there, stop and escalate.

## 2. Findings

### 2.1 The shared design language, as it is in the code

| Element | What the code does | Where |
| --- | --- | --- |
| Fonts (local, SIL Open Font License) | Only these faces and weights exist: Fraunces 400/600/900 (+italic), Atkinson Hyperlegible 400/700 (+italic), IBM Plex Mono 400/600, Big Shoulders Display **900 only**, Cinzel **700 only**; latin and latin-ext. Restored from `node_modules/@fontsource`, written to `site/fonts/` and `site/fonts.css` | `build.js` (`FACES`), `restore-build-inputs.js` |
| Font tokens | `--f-serif` (Fraunces), `--f-body` (Atkinson), `--f-data` (IBM Plex Mono); Big Shoulders and Cinzel are named literally where used | `shared.css` `:root` |
| Colour tokens | `--paper`, `--paper-2`, `--paper-3`, `--slip` (card surface), `--ink`, `--ink-2`, `--ink-3`, `--rule`, `--seal` (accent), `--on-seal`, `--hi` (accent wash), `--grid`, `--ok`, `--ochre` (progress colour), `--verd`, `--indigo`, `--shadow`, `--r: 2px` | `shared.css` `:root`, dark values under `:root[data-theme="dark"]` and the `prefers-color-scheme` block |
| Themes | 21 named themes (20 in the Atelier's `THEMES` plus "Electrope Skyline" added by the builds), each with a light and a dark set `[background, foreground, accent, progress]`; mode System / Light / Dark; accent, background and foreground can be overridden; contrast 0 to 100; motion setting. `applyLook()` sets the tokens **inline on the root** and always sets `data-theme` to `light` or `dark` by luminance. It does not set `--ok`, `--verd`, `--indigo` | `atelier.js` (appearance module), built into `site/look.js` |
| Wordmark tokens | `--lb-a`, `--lb-b`, `--lb-c`, `--lb-glow` (a ramp from a tint of the accent, through the accent, into the progress colour) | set by `applyLook()`, used in `shared.css` |
| Wordmark ("Limit Break") | `.lb-top` Cinzel 700, letter-spacing .62em; `.lb-word` Big Shoulders 900 uppercase filled with `linear-gradient(90deg, var(--lb-a), var(--lb-b) 48%, var(--lb-c))` and a glow; `.lb-gauge i`: three bars skewed `skewX(-25deg)`, the last one part-filled | `shared.css` |
| Rules | Masthead `border-bottom: 4px double var(--ink)`; foot `4px double`; dashed separators `1px dashed var(--rule)` | `shared.css` `.mast`, `shell.css` `.foot`, `.card-live` |
| Kickers | Cinzel 700, 10 to 12 px, uppercase, letter-spacing .26em to .32em, `--seal` or `--ink-3` | `shell.css` `.cc-kicker`, `.card-kicker`, `.save h2` |
| Display titles | Big Shoulders 900 uppercase, letter-spacing .02em: `.card-title` 30 px, `.set-card h2` 24 px, `.set-num` 22 px in `--seal`, `.earn-card b` | `shell.css` |
| Page and window titles | Fraunces 900 (`.p-head h2` 30 px, `dialog h3` 24 to 28 px, Atelier `.pane-head h2` 32 px) | `tracker.css`, `shared.css`, `atelier.css` |
| Cards | `background: var(--slip); border: 1px solid var(--rule); border-top: 3px solid var(--seal); box-shadow: var(--shadow)`; hover `translateY(-2px)`; square corners | `shell.css` `.card`, `.set-card`; Atelier `.spec` draws the 3 px line as a background image |
| Figures | IBM Plex Mono for live lines, counts and codes | `shell.css` `.card-live`, Atelier `.chip`, `.solve-meta` |
| Buttons | 1 px `--ink` border, transparent, radius 2 px, 700 14 px, min-height 36 px, hover inverts to ink; primary is `--seal` with `--on-seal` | `shared.css` `.btn`, `shell.css` |
| Tabs and current place | Underline in `--seal` (`.switcher a[aria-current]`, `.seg button.on`); or an inverted block `background: var(--ink); color: var(--paper)` (Atelier `.jobs button.on`); or the `--hi` wash (Tracker `.nav-link.on`) | `shell.css`, `shared.css`, `atelier.css`, `tracker.css` |
| Badges | Small uppercase stamps: 700 10 px, letter-spacing .08em to .14em, 1 px `--seal` border, radius 3 px, sometimes rotated | `tracker.css` `.lv-badge`, `.stamp`; Atelier `.ribbon-flag`, `.seal` |
| Status blocks | `border-left: 6px solid var(--vc); background: color-mix(in srgb, var(--vc) 8%, var(--paper))` | Atelier `.verdict` |
| Graph paper | `repeating-linear-gradient` in `--grid` | Atelier `.card`, `.gauge .track` |
| Icons | Stroked SVG, no fill, stroke 1.8 to 2.2, round caps and joins | `shell.css` `.card-glyph`, `.mm-ico` |
| Motion | Short transitions (.12 to .18 s); a few loops (`lbcharge`, `beacon`, `gem`). Reduced motion: `@media (prefers-reduced-motion: reduce) { :root:not([data-motion="off"]) * { animation: none !important; transition: none !important } }` and the same for `:root[data-motion="on"]` | `atelier.css` only; `shared.css` has **no** such rule |
| Focus | `:focus-visible { outline: 2px solid var(--seal); outline-offset: 2px }` | `shared.css` |

### 2.2 Where the Submersibles module departs (all in `subs.css` unless said)

- **Everywhere.** Panel titles (`.panel h2`, most `h3`) have no rule: they fall back to the browser's bold body face, so
  the only display type on the page is the wordmark and `.earn-card b`. `.panel` is a plain box: no top rule, no
  shadow. Pills with `border-radius: 999px` (`.tag`, `.chip`, `.dot`) in a square-cornered family. Text at 10 and 11 px
  (`.tag`, `.dot`, `.chip`, `.quick`, `.subs-foot`). `.code` uses the system monospace, not `--f-data`. Instructions
  (`.hint`) use `--ink-3`, the family's faintest ink. The five tab icons in `index.html` are Unicode symbols
  (`▦ ✎ ◎ ◈ ⚙`) drawn by whatever font the device has. No animation and no reduced-motion rule.
- **Colours outside the theme.** `#c0392b` four times (`.hint.bad`, `.wiz-err`, `.note.bad`, `.acc .bad`), `#fff`,
  `#06210f`, `#2a1800`. The status colours are two fixed sets that ignore the 21 themes; `--back` repeats `--ok`,
  `--out` repeats the default `--seal`. `.chip.out` puts the theme's `--on-seal` on the fixed `--out`.
- **Contrast (by hand, light mode):** `.chip.back` `#06210f` on `#148a4c` about 3.9:1; `.chip.idle` `#2a1800` on
  `#b26a00` about 4.0:1; `.chip.locked` `#fff` on `#858c93` about 3.4:1; error text `#c0392b` on the dark card surface
  about 3.1:1. All four are under 4.5:1.
- **Board.** A submarine row is a box with a 4 px edge and a 10% tint. The recommended route, the most important
  control (`.quick`), is an 11 px button 18 px high. `.strip` is a plain box.
- **Send window.** `.advice` looks like any `.note`; the recommended route is only 15 px bold.
- **Log.** One bordered box per voyage. **Earnings.** Plain tables; only the four totals use the display face.
- **Setup and recommendations.** Default headings; the ranking is a plain list with "1." in bold.
- **Map.** A `--paper` box; reveal lines in `--ink-3` at 60% opacity; stroke widths are in chart units, so they thin
  out as the chart shrinks on a phone; the legend is a sentence with text glyphs; the tapped sector is not marked on
  the chart (`CHART.svg` is not told which one it is); a sector on the planned route differs only by a number after
  its letter; the seven sea buttons are small buttons that wrap.

## 3. Decisions (alternatives rejected in brackets)

- **D1 Art direction "Dive console":** the main menu's ledger card plus the wordmark's gauge. Four motifs, all already
  in the family: the molten rule, the −25° slash, the double rule, the dashed ledger line. [A new palette or a new
  typeface: breaks "same themes"; glass or neon effects: not in the family.]
- **D2 Typography roles**, using only the shipped weights. Big Shoulders 900 uppercase for fixed app words and big
  numerals (panel titles, totals, ranking numbers, sector letters). Cinzel 700 for kickers. Fraunces for names the
  player or the game supplies (free company, sector, window titles). Atkinson for reading. IBM Plex Mono for every
  time, countdown, route, part code and gil figure. [Big Shoulders for player-typed names: forces uppercase on them and
  has only Latin glyphs.]
- **D3 Status colours stay four fixed meanings** (Back green, Out blue, Idle amber, Locked grey), each a self-contained
  fill-and-text pair so its contrast does not depend on the theme. [Deriving them from the theme accent: "Out" would
  turn red in red themes.] Status is always also a word.
- **D4 New tokens live only in `subs.css`.** [In `shared.css`: forces a Tracker and Atelier rebuild.]
- **D5 The chart is a dark "deep water" panel in both light and dark mode**, mixed from the theme's own ink or paper
  and a per-sea hue (owner question Q1; the item is written so the answer changes one token block). [A fixed navy
  palette: ignores the theme.]
- **D6 Chart background is honest decoration:** a graticule every 100 position units, sonar rings around Start, a
  depth-like gradient. The legend says they measure nothing. [Contour lines interpolated from `z`: invents a depth
  field between the points, and the data only calls `x/y/z` "position"; `advisor.js` uses `z` in leg length. A compass
  or north arrow: the orientation is unverified, `docs/STATE.md` Next 1.]
- **D7 Chart geometry is frozen:** `fs = span / 30`, `r = span / 70`, `TAP_FRACTION`, `placeTags` candidates, the
  `viewBox` and `C.Y_DOWN` stay. All new artwork sits inside the existing `viewBox` and within 1.5 r of a marker.
  [A legend or title inside the SVG: enlarges the `viewBox` and shrinks the tap circles, which are 38 px against a
  36 px limit today.]
- **D8 Route numbers stay in the letter text ("A 2").** [A separate numbered badge: the unit test reads the number
  from `.chart-letter`, and the number would show twice.]
- **D9 No `clip-path` on anything focusable** (it clips the focus outline); slashes are used on chips and ornaments
  only.
- **D10 Evidence comes from one new check block `L1`** in `check.js`, not from edits inside C20 to C88. [Weaving
  screenshots into existing blocks: collides with the parallel model work.]
- **D11 Contrast is proved by a unit test** over all 21 themes, in a new file. [Appending to `submarines.test.js`:
  the parallel model work appends there too.]

## 4. Direction

### 4.1 Tokens (W1 adds them at the top of `subs.css`; three blocks as today: `:root`, the `prefers-color-scheme`
block, `:root[data-theme="dark"]`)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--back` / `--on-back` | `#0f7a42` / `#ffffff` | `#4fd18b` / `#06210f` | Back: needs the player |
| `--out` / `--on-out` | `#2343d6` / `#ffffff` | `#7d93ff` / `#0b0d1a` | Out: at sea |
| `--idle` / `--on-idle` | `#8f5600` / `#ffffff` | `#f0b347` / `#2a1800` | Idle: not sent |
| `--locked` | `var(--ink-2)` | `var(--ink-2)` | Locked: outline chip, no fill |
| `--bad` | `#b3261e` | `#ff8a80` | Errors (replaces every `#c0392b`) |
| `--back-bg`, `--out-bg`, `--idle-bg` | `color-mix(in srgb, var(--back) 10%, var(--slip))` and so on | same formula | Row tint |
| `--molten` | `linear-gradient(90deg, var(--lb-a, var(--seal)), var(--lb-b, var(--seal)) 48%, var(--lb-c, var(--ochre)))` | same | The molten rule |
| `--f-disp` | `"Big Shoulders Display", "Arial Narrow", sans-serif` | same | Display |
| `--f-kick` | `"Cinzel", var(--f-serif)` | same | Kickers |
| `--sea-1` … `--sea-7` | `#2f7fd0`, `#d0642f`, `#2fb07a`, `#d04f9a`, `#9a6fe0`, `#5560e0`, `#6fc3d6` | same | Per-sea hue, chosen from the seas' names (blue, ash-ember, jade, rose, lilac, indigo, ice), not from the game's art; decoration only, never text |

Hand figures: white on `#0f7a42` about 5.4:1, on `#2343d6` about 7.4:1, on `#8f5600` about 6.0:1; dark pairs 8.8, 6.9
and 9.2:1. Never set `--paper`, `--ink`, `--seal` or any shared token in `subs.css` (check C28 compares `--paper`
across pages). A token that uses `var()` is resolved on the element that declares it: declare the chart tokens (4.3)
on `.map-panel`, not on `:root`.

### 4.2 Treatments

- **Type scale.** Panel title `.panel > h2`: `900 26px/1 var(--f-disp)`, uppercase, letter-spacing .02em (22 px up to
  700 px), with a gauge under it: `::after`, 50 × 6 px, `repeating-linear-gradient(90deg, var(--seal) 0 14px,
  transparent 14px 18px)`, `transform: skewX(-25deg)`. A `.muted` or `.tag` inside a title returns to
  `400 13px var(--f-body)`, no uppercase. Section label (`.recs h3`, Earnings `h3`): `700 12px var(--f-kick)`,
  uppercase, letter-spacing .22em, `--ink-2`, followed by a 1 px `--rule` line (flex + `::after`). `h4`:
  `700 13px var(--f-body)`, uppercase, .08em. Names (`.fc-head h3`, `.chart-details h3`, `.wiz-body h3`): Fraunces 600,
  17 to 18 px. Window title `.sheet h2`: Fraunces 900 22 px over `border-bottom: 3px double var(--ink)`. Body 15 px,
  small 13 px, nothing under 12 px except uppercase bold labels at 11 px. Figures: `var(--f-data)`.
- **Text colour.** `.hint` and every instruction: `--ink-2`. `--ink-3` only for decoration and disabled things.
- **Panels and cards** (`.panel`, `.fc`, `.earn-card`, `.sheet`): `--slip`, `1px solid var(--rule)`, square corners,
  `box-shadow: var(--shadow)`, and the molten rule as the top edge: `border-top: 0; background-image: var(--molten);
  background-size: 100% 3px; background-repeat: no-repeat; padding-top` + 3 px.
- **Buttons.** Shared `.btn` unchanged. `.btn.primary` and `.quick`: `--seal` fill, `--on-seal` text, 700; hover
  `filter: brightness(1.08)`; pressed `translateY(1px)`. Sentence case (no uppercase on buttons). Up to 700 px wide:
  `.btn`, `.btn.sm`, `.quick`, `.qbtn`, `.sector`, `[data-map-sea]` at least 40 px high; the main action of a sheet
  48 px and full width.
- **Chips** (`.chip`): `700 11px/1 var(--f-body)`, uppercase, letter-spacing .08em, padding 4px 10px, no radius, slashed
  ends `clip-path: polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)`. Back, Out, Idle: fill and `--on-*` text.
  Locked: transparent, `box-shadow: inset 0 0 0 1px var(--ink-2)`, text `--ink-2`, no clip. `.tag` and `.dot`: the
  Tracker's stamp: 700 11 px uppercase, .06em, `1px solid currentColor`, radius 2 px, `--ink-2`.
- **Tabs** (`.tabs`): icons become stroked SVG (W1). Label `700 12px var(--f-body)`, uppercase, .04em. Current tab:
  inverted block `background: var(--ink); color: var(--paper)` with a 3 px `--molten` edge (left on the rail, top on the
  phone bar). Phone bar: each button at least 52 px high; `.tabs` stays `position: fixed` at the bottom.
- **Notes.** `.note`: `border-left: 6px solid var(--seal)`, `--hi` wash. `.note.bad`, `.hint.bad`, `.wiz-err`,
  `.acc .bad`: `--bad`.
- **Recommended route** (send window `.advice`, Board `.quick`): the one place the molten rule is 4 px and the route
  is set in `900 28px/1 var(--f-disp)` (`.advice-route b`, letter-spacing .04em); `.advice-step` becomes a kicker; the
  block has `border-left: 6px solid var(--seal)` and the `--hi` wash; "Send on this route" is the 48 px main action.
- **Empty states** (`.panel.welcome` and the new class `empty-state`): headline `900 clamp(34px, 7vw, 64px)/.95
  var(--f-disp)` uppercase, text up to 60ch, the action 48 px high, and faint sonar rings behind:
  `background-image: repeating-radial-gradient(circle at 100% 0, transparent 0 38px, var(--grid) 38px 39px)`.
- **Motion.** Transitions of .12 s on hover and press. Three loops only: a halo on `.chip.back` (1.8 s, like the
  Atelier's `beacon`), a halo on chart markers that can be revealed next (2.4 s), a marching dash on the planned route
  (1.2 s linear). W1 copies the Atelier's two reduced-motion rules into `subs.css` word for word; with motion reduced
  the halos are not drawn and the dash stands still. Nothing animates on render (the Board redraws on status changes).
- **Focus.** The shared outline everywhere; on the chart a 3 px ring in `--chart-hot` on `.hit`. Never `outline: none`
  without a replacement.

### 4.3 The map

Evokes a nautical sonar chart. Everything is drawn by `chart.js` and CSS, deterministically, from the position
numbers; no position is changed; `C.Y_DOWN` stays the one orientation constant and every new layer goes through it.

Chart tokens, declared on `.map-panel` (the sea hue arrives as `--sea`, set by
`.map-panel:has(.chart-svg[data-sea="1"]) { --sea: var(--sea-1) }` and so on):

| Token | Light mode | Dark mode |
| --- | --- | --- |
| `--chart-bg` | `color-mix(in srgb, var(--ink) 90%, var(--sea))` | `color-mix(in srgb, var(--paper) 86%, var(--sea))` |
| `--chart-bg-2` (shallow) | `color-mix(in srgb, var(--ink) 84%, var(--sea))` | `color-mix(in srgb, var(--paper-3) 90%, var(--sea))` |
| `--chart-ink` | `var(--paper)` | `var(--ink)` |
| `--chart-ink-2` | `color-mix(in srgb, var(--paper) 70%, var(--ink))` | `var(--ink-2)` |
| `--chart-line` | `color-mix(in srgb, var(--chart-ink) 20%, transparent)` | same |
| `--chart-hot` (route, focus, selection) | `color-mix(in srgb, var(--seal) 45%, white)` | same |
| `--chart-found`, `--chart-next` | `#4fd18b`, `#f0b347` | same |
| `--chart-far` | `color-mix(in srgb, var(--chart-ink) 58%, var(--chart-bg))` | same |

Rule for these values (set by W1's contrast test, which wins over any hand figure): the chart is always a dark deep-water
panel and every token keeps its hue (per-sea tint included). Order of adjustment: first darken `--chart-bg-2` toward
`--chart-bg` (the gradient stays visible, its lightest point dark enough); then lighten a failing foreground toward
white (or the same hue, lighter, for the fixed hex colours). Every pair must pass against both gradient ends in all 21
themes, both modes and 7 seas (4.5 for ink, found, next, hot; 3 for far). Found (green), next (amber), hot (light
seal tint) and far (muted ink) differ in hue or lightness, not only shape.

Layers, back to front (all strokes `vector-effect: non-scaling-stroke`, widths in px, so they stay legible at 360 px):

1. **Water:** CSS on `.chart-svg`: `background: radial-gradient(120% 90% at 50% 0, var(--chart-bg-2), var(--chart-bg) 70%)`.
2. **Graticule** `<path class="chart-grid" aria-hidden="true">`: one path, a line at every multiple of 100 in data
   x and data y (y through the same `py` as the nodes), 1 px `--chart-line`. `C.view` gains `grid: { step: 100, xs,
   ys }` covering the box and one box-width beyond; the `viewBox` clips it.
3. **Sonar rings** `<g class="chart-rings" aria-hidden="true">`: circles centred on Start, radii 200, 400, … up to the
   farthest box corner (8 at most), 1 px dashed `4 6`, `--chart-line`.
4. **Reveal lines** `.chart-lines line`: class `open` when the revealing sector is found (1.5 px `--chart-ink-2`), else
   1 px dashed `--chart-far`. A chevron `<path class="chart-chev">` at each midpoint, size 0.6 r, pointing from the
   revealing sector to the revealed one.
5. **Route:** `<path class="chart-route-glow" aria-hidden="true">` (9 px, `--chart-hot` at 25%), then the one
   `<polyline class="chart-route">` (3 px `--chart-hot`, `stroke-dasharray: 10 6`, marching), then one chevron
   `<path class="chart-route-dir">` per leg midpoint. Exactly one `<polyline` in the SVG, as today.
6. **Start** `.chart-start`: the rotated square in `--chart-ink`, plus a ring at 1.5 r; label "Start" unchanged.
7. **Sector markers**, shapes kept (shape is the cue that does not rely on colour), on `<g class="chart-node …">`:

   | State (class) | Marker | Letter |
   | --- | --- | --- |
   | found | disc `--chart-found`, 2 px `--chart-bg` gap ring | `--chart-ink` |
   | can be revealed next (`next`) | hollow diamond, 2 px `--chart-next`, fill `--chart-bg`, halo loop | `--chart-ink` |
   | further away (`far`) | small square `--chart-far` | `--chart-ink-2` |
   | above this submarine's rank (`over-rank`, while planning) | marker at 40% opacity, dashed 1 px ring | `--chart-far` |
   | on the planned route (new class `on-route`) | 2 px `--chart-hot` ring at 1.4 r | `--chart-hot` |
   | selected (new class `selected`) | four corner brackets `<path class="chart-lock">` at 1.5 r in `--chart-hot` | `--chart-ink` |
   | grants a submarine slot (new class `has-slot`) | a small plus at the upper right, within 1.5 r, `--chart-next` | n/a |
   | opens the next sea (new class `opens-sea`) | a second ring at 1.5 r, `--chart-ink` | n/a |

   Hover: `.hit` fill `color-mix(in srgb, var(--chart-ink) 10%, transparent)`. Focus: `.hit` 3 px `--chart-hot`.
8. **Labels:** letters in `var(--f-disp)` (narrower than the 0.55 width the collision estimate assumes); slot and
   "opens" tags stay in `--f-body`, weight 700, `--chart-ink`; the halo (`paint-order: stroke`) uses `--chart-bg`.
   `placeTags` and both `font-size` attributes are untouched, so the collision rules hold.

Around the chart (W8, HTML): a head bar inside `.chart-wrap` with the sea's name in `--f-disp` and "found n of m" in
`--f-data`; sea tabs with the sea's hue as a 10 px swatch and a skewed progress bar (found / total); a legend of small
inline SVG swatches on a `--chart-bg` chip; the details card. On 1100 px and wider the chart sits left and the planner
and details right, by grid placement only (the DOM order stays planner, chart, legend, details). Up to 700 px the map
panel's side padding drops to 8 px so the chart is at least 320 px wide at 360 px.

## 5. What every item must leave alone

- **No class, id, `data-*`, `aria-*`, `name`, `role`, `tabindex` or visible text is removed or renamed.** Classes and
  wrappers may be added where an item says so. Text changes only where an item lists the exact new text.
- The checks read these; keep them working: `html[data-ready="1"]`; `.cc-back`; `.switcher a[data-module]`;
  `.tabs [data-tab]` with **the label as a direct text node of the button** (C20 joins the button's own text nodes
  into "Board,Log,Map,Earnings,Setup"); `.tabs` fixed with its bottom at the window's bottom on a phone (C24);
  `.fc`, `.fc.wide`, `.fc-head h3` (text is exactly the free company's name), `.sub[data-status]`, `.sub[data-sub]
  .sub-top`, `.quick[data-quick]`, `[data-sort]`, `[data-until]`, `[data-since]`; `#sheet` with `.advice`,
  `.advice-step`, `.advice-route b`, `.game-says`, `[data-picker]`, `.sectors` (below the sea selector and wider than
  300 px), `.sector[data-pick]`, `.sector.on`, `.route-line`, `.loot`, `.loot-group`, `.loot-h`, `.loot-row`,
  `.loot-name`, and `#sheet .btn.primary` (Enter presses the first one); `.log-row[data-trip]`; `.earn-card b` (four,
  in order), `.earn-t` (the first one's first body row is the best route), `.earn-ranked`, `.earn-thin`,
  `tr[data-pos]`; `.wiz`, `.wiz .note`, `[data-w]`, `[data-recs-panel]`, `[data-recs-body]`, `[data-recs-live]`,
  `.rec-rank .rec-name`, `.rec-rank button`, `[data-rec]`, `[data-rec-find]`, `.rec-picker`; `[data-map-sea]` (its text
  holds the sea's name and "found n of m"), `#map-fc`, `#map-sub`, `.map-panel`, `.planner .route-line`,
  `[data-map-use]`, `[data-map-send]`, `.chart-wrap`, `.chart-svg`, `.chart-start`, `.chart-node.found`,
  `.chart-node.next`, `.chart-details`.
- **Sizes the checks assert** (figures from `evidence/checks.json`, dated 2026-11-18): C25: 8 free companies × 4
  submarines inside 1920 × 1080, four columns, lowest row at 898 px today (limit 1080), two columns at 1024 px. C82:
  at 390 px the chart is 330 px wide (limit: over 300) and the smallest tap circle 38 px (limit 36). C24, C22, C87: no
  sideways page scroll at 390 and 360 px.
- **Chart unit tests** (`submarines.test.js`, must pass unchanged): each node group starts with `<g class="chart-node`
  and holds no nested `<g>`; its first `translate(x y)` is the node's place; `<text class="chart-letter" y="…"` and
  `<text class="chart-tag" x="…" y="…" text-anchor="…" font-size="…">` keep that attribute order and hold plain text;
  the route number follows the letter (" 2"); exactly one `<polyline` with a route and none without; `data-sector=`
  and `tabindex="0"` appear once per sector and nowhere else; names are escaped; no `onclick`.

## 6. Work items

For every item: work on a branch; edit only the files named; after the edit run `npm run build` and commit the
rebuilt files with the source. The only built files that may change are
`tracker/command-center/site/submersibles/{index.html,subs.css,subs.js,chart.js}` and `site/sw.js`; anything else
changed means stop. Then run `npm run test:unit` and `npm run check` (about 10 minutes; Chromium writes the
screenshots). Open every regenerated screenshot named in the item and report what was seen. Report plainly what was
run and what was not. Never merge or push to `main`.

### W0. Baseline (Haiku clerk)
- Steps: on the branch, with no change: `npm ci && npx playwright install chromium`, `npm run build`,
  `npm run test:unit`, `npm run check`. From `tracker/command-center/evidence/checks.json` record C25 `fit.maxBottom`,
  C82 `svgWidth` and `hitMin`, and passed/total. With `node -e`, load `chart.js` and the data as `submarines.test.js`
  does and print the `viewBox` of `CHART.svg(CHART.view(id, []))` for the seven seas.
- Acceptance: the four commands' results and the ten values reported in the hand-back. Commits nothing.
- Escalate if: anything fails before any change, or `git status` is not clean after `npm run build`.

### W1. Tokens, base, tabs (Sonnet builder; needs W0)
- Files: `src/submersibles/subs.css`, `src/submersibles/index.html`, new `tracker/tests/subs-look.test.js`,
  `package.json` (add `&& node tests/subs-look.test.js` after `node tests/earn.test.js` in `test:unit`).
- Steps: add the 4.1 tokens. Replace every `#c0392b`, `#fff`, `#06210f`, `#2a1800` and the old status values. Apply
  the 4.2 rules for type scale, text colour, panels, buttons, chips, `.tag`, `.dot`, notes, tabs, focus and motion
  (including the two reduced-motion rules and the keyframes, unused until later items). `.code` to `var(--f-data)`.
  In `index.html` replace the content of each `<span class="ico" aria-hidden="true">` with an inline
  `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round">` drawn for this app: Board a 2 × 2 grid, Log lines with a tick, Map
  two rings and a dot, Earnings a rising bar trio, Setup a slider pair. The label stays a direct text node.
- The test: read the 21 theme rows from `tracker/command-center/site/look.js`; resolve the tokens as `applyLook` does
  at contrast 50 (`--slip`, `--ink-2`, `--paper-3` by its `mix` formulas); read the module's token values out of
  `subs.css`; compute WCAG ratios, treating `color-mix(in srgb, …)` as a per-channel mix. **Assert:** each `--on-*` on
  its fill ≥ 4.5; `--bad` on `--slip` and on `--paper` ≥ 4.5 in every theme and mode; `--back`, `--out`, `--idle` on
  `--slip` ≥ 3 (they are edges); chart pairs for every theme, mode and sea: `--chart-ink` and `--chart-found` and
  `--chart-next` and `--chart-hot` on `--chart-bg` and on `--chart-bg-2` ≥ 4.5, `--chart-far` ≥ 3. **Print, do not
  assert:** `--ink-2` on `--slip` and `--paper` per theme (shared tokens). Print the lowest ratio of each pair.
- Untouched: section 5; the wordmark; `shared.css`, `shell.css`.
- Evidence: the six existing `submersibles-*.png` regenerate; open `submersibles-board.png` and `-phone.png`.
- Acceptance: the commands pass; the test's table is in the hand-back; C25 `fit.maxBottom` ≤ 1040.
- Escalate if: a pair cannot reach its ratio by changing lightness alone in some theme; a shared token would need to
  change; the tab label has to move into an element.

### W2. Evidence block `L1` (Sonnet builder; needs W1)
- Files: `tracker/command-center/check.js` only: one new block after the last Submersibles block, id `L1`.
- Steps: seed one profile (copy the seeding style of C82 and C22): two free companies; one with submarines Back, Out
  and Idle and slot 4 locked, sectors 1, 2, 3, 10, 15 found, and eleven logged voyages on one route with items; the
  other with one sector. Walk Board, the send window of the Back submarine, Log, Map with sector 10 tapped, Map with a
  submarine chosen and two sectors planned, Earnings, Setup, the recommendations panel. Screenshots (Chromium only):
  `look-{board,sheet,log,map,planner,earnings,setup,recommendations}-desktop.png` at 1440 × 1000 light, the same eight
  `-phone.png` at 360 × 800 with `colorScheme: 'dark'`, plus `look-board-desktop-dark.png`, `look-map-desktop-dark.png`,
  `look-board-phone-light.png`, `look-map-phone-light.png`. Assert: no sideways page scroll on any of the eight at
  360 px; no page errors. Record without asserting yet: the smallest height at 360 px among visible `.btn`, `.quick`,
  `.tabs button`, `[data-map-sea]`, `.sector`, `.qbtn`, `.log-row`, `.sub[data-sub]`, `.rec-rank button`; the chart's
  width and smallest `.hit` width at 360 px.
- Acceptance: `npm run check` passes with `L1` in `checks.json`; the 20 files exist; they are the "before" pictures.
- Escalate if: the block needs a change to another block, or the run grows by more than a minute.

### W3. Board and cards (Sonnet builder; needs W1)
- Files: `subs.css` only.
- Rules: `.strip`: card treatment; "Next back" countdown in `600 15px var(--f-data)`; `.strip-back b` in
  `900 28px/1 var(--f-disp)`, and when `.on` the whole item is a `--back` block with `--on-back` text. `.fc`: card
  treatment; name Fraunces 600 17 px; world and character line `var(--f-data)` 12 px `--ink-2`. `.sub`: `--paper`
  row, `border-left: 6px solid` in the status colour, tint `--*-bg`; name 700 14 px; `.sub-meta` in `--f-data` 12 px
  `--ink-2`; countdown `b` in `600 14px var(--f-data)`. Back rows: also `box-shadow: inset 0 0 0 1px var(--back)` and
  the chip halo. Locked rows: text `--ink-2`, background
  `repeating-linear-gradient(-65deg, transparent 0 6px, var(--grid) 6px 7px)`. `.sub.empty`: dashed 1 px `--idle`
  border. `.sub[data-sub]:hover`: `translateY(-1px)`, border `--seal`. `.quick`: primary treatment, route in
  `--f-data`, 26 px high from 701 px, 44 px and full width up to 700 px. `.panel.welcome`: the empty state.
- Height budget from 1400 px: a `.sub` may grow by at most 12 px, `.fc-head` by 10 px, `.strip` by 12 px.
- Evidence: `look-board-*` (four), `submersibles-board.png`, `-phone.png`, `-desktop.png`.
- Acceptance: commands pass; C25 `fit.maxBottom` ≤ 1040 and four columns; C24 passes.
- Escalate if: the budget cannot hold with the rules above, or a rule needs markup.

### W4. Send window and sheets (Sonnet builder; needs W1)
- Files: `subs.css` only.
- Rules: `.sheet`: `--slip`, `1px solid var(--ink)`, no radius, molten rule 4 px; title per 4.2. `.advice`: the
  recommended-route treatment of 4.2; `.alts` rows with dashed separators, routes in `--f-data`. `.seg.wide` labels
  44 px high, checked one `--seal`. `.sector`: letter `900 22px var(--f-disp)`, 48 px high; `.on` `--seal`; `.ord` a
  20 px square in `--ink` with `--f-data` 600 11 px. `.route-line b` and `.calc-line b` in `--f-data` 600. `.facts`,
  `.rankbox`: labels `--ink-2`, values `--f-data`. `.loot-row` dashed rules; `.qbtn` 40 × 40 px. `.sheet-actions`: up to
  700 px `position: sticky; bottom: 0; background: var(--slip); border-top: 1px dashed var(--rule)`, main action
  full width and 48 px.
- Evidence: `look-sheet-desktop.png`, `look-sheet-phone.png`.
- Acceptance: commands pass (C21 to C23, C22's `pickerFull`, C78 to C81 and C85 to C88 use this window).
- Escalate if: the sticky actions cover a field the checks click, or a rule needs markup.

### W5. Log and Earnings (Sonnet builder; needs W1)
- Files: `subs.css`; `subs.js` only to add the class `empty-state` to three empty panels: in `render()` (the fallback
  panel), the first `return` of `logHtml`, the first `return` of `earnHtml` (`class="panel empty-state"`).
- Rules: `.log-list`: one bordered list, rows divided by `1px dashed var(--rule)`, no box per row; `.log-when` in
  `--f-data` 13 px; name 700; hover `--paper-2` and a 6 px `--seal` left edge; rows at least 48 px. `.earn-card`: card
  treatment, label as a kicker, figure `900 30px/1 var(--f-disp)`. `.earn-t`: `th` `700 11px var(--f-body)` uppercase
  .08em `--ink-2` over `border-bottom: 3px double var(--ink)`; row rules dashed; `td b` in `--f-data` 600;
  `tr[data-pos="1"]`: `--hi` wash, first cell `900 20px var(--f-disp)` in `--seal`. Up to 700 px: `.earn-t` may scroll
  inside itself (`display: block; overflow-x: auto`) only if a table does not fit at 360 px.
- Evidence: `look-log-*`, `look-earnings-*` (four).
- Acceptance: commands pass (C22 reads `.earn-card b` and the first `.earn-t` row; C78 reads `.earn-ranked`).
- Escalate if: `subs.js` needs any other edit.

### W6. Setup and the recommendations panel (Sonnet builder; needs W1)
- Files: `subs.css` only.
- Rules: panels per 4.2. `.fc-list li`: ledger rows with dashed rules, name Fraunces 600. Wizard: `.dot` as stamps,
  `.dot.on` `--seal` fill, `.dot.done` `--ink` text with a 2 px `--seal` underline; `.wiz-foot` under a double rule;
  `fieldset` 1 px `--rule`, `legend` as a kicker; `.sea summary` 44 px high; `.tick` at least 36 px high up to 700 px;
  checkboxes and radios `accent-color: var(--seal)`, 18 px. Recommendations: `.rec-rank li` 56 px rows with dashed
  rules; `.rec-name b` `900 26px/1 var(--f-disp)` in `--seal`; the first `li` has the `--hi` wash and a 6 px `--seal`
  left edge; `.rec-give-text` in `--f-data`; `.rec-picker` dashed rules, `.rec-pick-title` 700. `.acc` like `.earn-t`.
- Evidence: `look-setup-*`, `look-recommendations-*` (four), `submersibles-recommendations.png`.
- Acceptance: commands pass (C85 to C88, including no sideways scroll at 360 px).
- Escalate if: a rule needs markup, or a recommendations check reads a style.

### W7. The chart (Sonnet builder; needs W1)
- Files: `src/submersibles/chart.js`, `subs.css` (the chart rules and the 4.3 tokens), `tracker/tests/subs-look.test.js`.
- Steps: build 4.3 layers 1 to 8. `C.svg(view, route, opts)` gains an optional third argument `{ selected: id }`; with
  it absent the output has no `selected` class. Add `data-sea="<id>"` to the `<svg>`. Add classes `on-route`,
  `selected`, `has-slot`, `opens-sea` after the existing ones. `C.view` gains `grid` only. Keep D7 and D8.
- Tests to add: the seven `viewBox` strings equal W0's; `C.svg` called twice gives the same string; one `<polyline`
  with a route and none without; `selected` appears only with `opts.selected`, once; with `C.Y_DOWN = false` (restored
  afterwards) the rings' centre equals `view.start` and every grid line still lies on a multiple of 100 in data y; no
  nested `<g>` inside a node group; every new element outside node groups is `aria-hidden="true"`.
- Untouched: `placeTags`, `hitRadii`, `TAP_FRACTION`, `C.Y_DOWN`, `STATE`, every `aria-label`, the existing tests.
- Evidence: `look-map-*` and `look-planner-*` (six), `submersibles-map.png`, `submersibles-planner.png`.
- Acceptance: commands pass; C82 `hitMin` ≥ 38 and `svgWidth` ≥ 330; C84 unchanged; the W1 chart ratios pass.
- Escalate if: an existing chart test would have to change; letters in `--f-disp` are unreadable at 360 px (fall back
  to `700 var(--f-body)` and say so); any layer needs a position changed.

### W8. Map tab chrome and details (Sonnet builder; needs W7)
- Files: `subs.css`; `subs.js` in `mapHtml` and `sectorDetails` only.
- Steps in `mapHtml`: pass `{ selected: m.sector }` to `CHART.svg`; add `style="--p:<found/total>"` to each sea
  button; add inside `.chart-wrap`, before the SVG, `<header class="chart-head"><span class="chart-sea">` sea name
  `</span><span class="chart-count">found n of m</span></header>`; wrap planner, `.chart-wrap`, legend and details in
  `<div class="map-grid">`. Legend: replace the three glyph spans by inline SVG swatches (`aria-hidden`), same words,
  and extend the sentence to exactly: "found · can be revealed next · further away · Start · planned route, numbered ·
  plus: grants a submarine slot · double ring: opens the next sea · dimmed: above this submarine's rank. The grid and
  rings are decoration and measure nothing. Tap a sector for its details."
- Rules: sea tabs: 44 px high, name 700 13 px, count in `--f-data` 11 px `--ink-2` on its own line, a 10 px swatch of
  the sea's hue with a 1 px `--ink-2` outline, a 3 px skewed bar under the tab filled to `--p`; pressed tab inverted
  (`--ink` / `--paper`). Up to 700 px the tabs are one row that scrolls inside itself. `.chart-wrap`:
  `1px solid var(--ink)`, no side padding. `.chart-head`: `--chart-bg`, sea name `900 22px var(--f-disp)` uppercase
  `--chart-ink`, count `--f-data` `--chart-ink-2`. `.chart-details`: card treatment; state line as a stamp; `.chart-facts`
  labels as 11 px uppercase `--ink-2`, values `--f-data`. `.map-grid` from 1100 px: columns `minmax(0, 1fr) 360px`, chart
  and legend left, planner and details right, by `grid-column` / `grid-row` only; `.map-panel` max-width 1400 px. Up to
  700 px: `.map-panel` side padding 8 px.
- In `check.js` `L1`: assert at 360 px chart width ≥ 320 and smallest `.hit` ≥ 36.
- Evidence: `look-map-*`, `look-planner-*`, `submersibles-map.png`, `submersibles-planner.png`.
- Acceptance: commands pass; C82 (button texts, "slot 2", "Rank needed", keyboard) and C84 unchanged.
- Escalate if: the parallel model work has changed `mapHtml` or `sectorDetails`; the tap circles miss 36 px at 360 px.

### W9. Final pass at phone width (Sonnet builder; needs W3 to W8)
- Files: `subs.css`; `check.js` `L1` (turn the recorded tap-height figure into an assertion: ≥ 36 px).
- Steps: at 360 × 800 in light and dark walk all eight screens; fix clipped or overlapping text, any target under
  36 px, any text under 12 px (11 px uppercase labels excepted), any focus ring that is hidden or cut. Switch the
  motion setting to reduced and confirm no loop runs. Try three themes besides the default (one light with a pale
  yellow page, one with a red accent, one dark) and report what was seen.
- Evidence: all 20 `look-*.png` and the six `submersibles-*.png`.
- Acceptance: `npm run build`, `npm run test:unit`, `npm run test:browser`, `npm run check` all pass; the hand-back
  lists the final C25 `maxBottom`, C82 `hitMin`, the `L1` figures and the contrast table.
- Escalate if: a fix needs markup outside the functions named in W5 and W8.

### W10. Records (Haiku clerk; needs W9)
- Files: `docs/STATE.md` (one entry under "Built, waiting for the owner's `ship`", naming this spec and check `L1`),
  `tracker/command-center/README.md` (add the `look-*.png` names to the evidence row).
- Acceptance: `git diff --stat` shows only those two files. Escalate if: either file needs more than those lines.

### W11. Voyage gauge (Sonnet builder; only on the owner's yes to Q4; needs W3)
- Files: `subs.js` (`subRow`, `tick`), `subs.css`. A 3 px skewed bar along the bottom of an Out row, filled to
  `(now − sentAt) / (returnAt − sentAt)`, updated by the existing one-second clock; omitted when either time is
  missing. Add an assertion to `L1`. Escalate if: `sentAt` is not stored for voyages typed from the game's time.

## 7. Acceptance

- **Mechanical, every item:** `npm run build` leaves only the expected built files changed; `npm run test:unit` and
  `npm run check` pass; the size figures of section 5 hold; the contrast test passes and its table is reported.
- **Visual, every item:** the named screenshots are regenerated by `L1` (desktop 1440 px light, phone 360 px dark, and
  the four extra board and map pictures), opened by the builder, and described in the hand-back: what changed, what
  still looks plain. W2's pictures are the "before" set.
- **Whole job:** W9's list. The independent review of the finished work is a separate step by the reviewer tier.

## 8. Risks, and the first thing to verify

- **First:** W0. The restyle stands on the Map and recommendations work that is built but not shipped; it must start
  from that branch, green.
- `subs.css`, `subs.js`, `check.js`, built files and `evidence/checks.json` are also touched by the parallel model
  work. Run one builder at a time on a branch; whoever lands second rebuilds and regenerates the evidence.
- The contrast figures here are by hand. If W1's test disagrees, the test wins and the hex values move.
- C25 leaves 182 px of height for the whole Board restyle; C82 leaves 2 px of tap size. Both are measured in W0.
- Sonar rings around Start can be read as travel range. They are plain distances on the chart; the legend says they
  measure nothing. Leg length in the model also uses the third position number.
- A custom background or foreground chosen by the player can lower any contrast; the test covers the 21 themes only.
- `color-mix`, `:has` and `vector-effect` are needed; the first two are already used by the family's styles. Firefox
  and WebKit runs depend on those engines being installed where the checks run.
- The chart's orientation is still unverified (`docs/STATE.md`, Next 1). Nothing here changes or asserts it.
- The stale `evidence/submersibles-s5-*.png` files are not produced by `check.js`; they are left as they are.

## 9. Owner questions

**Q1. The chart's background.**
- Always a dark deep-water panel, in light and dark themes, tinted by the theme and the sea. Stands out most; one dark
  block on an otherwise pale page. Cost: none extra. Risk: may feel heavy on pale themes.
- Follow the page: pale chart on light themes, dark on dark. Calmer, less striking; 21 more colour combinations to
  check. Cost: about the same.
- Keep things as they are: the plain box stays; the rest of the restyle goes ahead.
- Recommendation: the dark panel. Fairly sure (about 70%) it is what "make it pop" asks for.

**Q2. What to take from the game's map.** The game's map was not looked at for this spec and nothing is copied from it.
- A general sea-chart feel only: grid, sonar rings, deep-water shading (what this spec builds). Cost: none extra.
  Risk: it may not remind you of the game's map.
- The same now, and you describe in words up to five traits of the game's map you want echoed (colours, frame, grid);
  one more small item follows. Cost: one extra builder item. Risk: low.
- Keep things as they are: today's chart stays.
- Recommendation: the second. Moderately sure.

**Q3. The third position number of each sector.** The app says "Depth is not drawn."
- Keep it undrawn (things as they are). The sentence stays true. No cost, no risk.
- Show it per sector as a depth figure or shade. The sentence and legend change, and the app would then publicly call
  that number depth, which is not verified. Cost: one small item. Risk: a wrong public claim.
- Recommendation: keep it undrawn. Very sure.

**Q4. A voyage progress bar on the Board** for submarines at sea (new information on screen, from the stored send
and return times).
- Add it as a last, separate item (W11). Cost: one small item touching the Board's clock. Risk: for a voyage typed
  from the game's remaining time the bar may be approximate; W11 checks this first.
- Keep things as they are: no bar; the restyle is styles only.
- Recommendation: add it, after the rest is accepted. Moderately sure.

**Q5. How it ships.** The restyle stands on the Map, gil advice and recommendations work that is waiting for `ship`.
- Its own pull request on top of that one, shipped after it. You can judge the look alone. Risk: if the first changes,
  the second is rebuilt.
- The same pull request: one decision, a larger one.
- Keep things as they are: do not start until that work has shipped.
- Recommendation: its own pull request. Fairly sure.

## Revision 2: bolder

Appended 2026-11-18. Sections 1 to 9 above are unchanged; they record what W0 to W3 built. Where this section and
they disagree, this section wins. W4 to W9 and W11 are replaced by W15 to W21 below and are not built as written; W10
stays (see R5). A builder of W12 onward reads section 5, then R1, R4 and its own item; W18 also reads 4.3.

Why: W1, W2 and W3 are built. The owner looked at the Board and said "make it bolder, the direction is still too
tame", and "fix the shared button text colour on the accent colour that needs fixing here as well".

Read for this revision: `CLAUDE.md`; this spec; `subs.css` and `tracker/tests/subs-look.test.js` as built; in `subs.js`
the functions `strip`, `subRow`, `lockedRow`, `fcCard`, `boardHtml`, `setupHtml`, `sectorDetails`, `plannerHtml`,
`mapHtml` (the others by one-line search); `applyLook()`, `THEMES` and `ACCENTS` in `crafting/atelier/src/atelier.js`;
the token blocks of `shared.css`; the `look.js` step of `command-center/build.js`; the appearance step of
`tracker/tools/build.js`; C25 and the uses of `.sub-top`, `.fc-head h3` and `.sub-name` in `check.js`; the 21-theme
test in `tracker/tests/ui.test.js`; the theme lines of `crafting/atelier/tests/atelier.test.js`; `package.json`.
Verified by search only: `L1` is in `check.js`, the `look-*.png` files exist, `chart.js` has none of W7's classes.
Nothing was built or run and no screenshot was viewed: the picture of the built Board ("a themed list: nothing is
large, nothing breaks the grid, nothing has weight") and the C25 figure 979 are the orchestrator's. Not read:
`docs/STATE.md`, `chart.js`, the sheet, wizard and log markup beyond searches, `crafting/atelier/tools/build.js`,
`shell.css`. Every ratio below was worked out by hand; the tests of W12 and W13 are the authority.

### R1. Goal and constraints

- Raise the intensity of the whole module decisively and stay in the family: the five shipped faces, the theme tokens,
  the motifs of D1, plus two the family already has: the inverted block (the current tab, the Atelier's
  `.jobs button.on`) and graph paper.
- Look only, as in section 1. `subs.js` is edited only where an item names the function, and only to add a class or a
  `style="--p:…"`; never text, order or a hook. One exception to section 1: W12 changes one rule in
  `crafting/atelier/src/atelier.js`, so `npm run build` rewrites the Tracker, the Atelier and the Command Center.
  `shared.css` is still not changed.
- Must hold: all of section 5; every text at least 4.5:1, display sizes included; meaningful graphics 3:1; the contrast
  test as the authority; focus rings visible and never clipped; targets at least 36 px (40 px up to 700 px; `.quick` on
  a dense Board 26 px from 701 px, as built); no sideways scroll at 360 px; both reduced-motion rules; C20, C24, C25
  (`fit.maxBottom` ≤ 1040), C28, C82; no new external resource; no game artwork; nothing automated; no invented number.
- The checks click the centre of `.sub[data-sub] .sub-top`: that point must hit `.sub-top` or one of its own
  descendants. The checks read names with `textContent`, which `text-transform` does not change.
- Every item, as in section 6: a branch; only the named files; `npm run build` and commit the rebuilt files with the
  source; `npm run test:unit` and `npm run check`; say what was run and what was not; never merge or push to `main`.
  One builder at a time (section 8).
- **Bold test (required self-review, every item).** Open each screenshot the item names and answer per picture, yes or
  no: (1) the largest thing on the screen is a number or a state word of 28 px or more; (2) an inverted slab is
  visible and, where a status exists, a solid status field; (3) the heaviest line is 2 px or more and no hairline
  carries the layout; (4) it no longer reads as a plain list or table. Then one plain sentence in the hand-back: "bold"
  or "still tame: <what>". "Still tame" is reported, never hidden; it does not fail the item.

### R2. Finding: text on the accent (shared by every module)

`applyLook()` (`crafting/atelier/src/atelier.js`, the line that sets `--seal`) picks `--on-seal` with
`lum(ac) > 0.42 ? '#111111' : '#ffffff'`. White needs an accent luminance of 0.183 or less to reach 4.5:1, so every
accent between 0.183 and 0.42 gets white text that is too faint. That one rule is built into the Tracker
(`tracker/tools/build.js`), the Atelier and `tracker/command-center/site/look.js`. The values in `shared.css` and
`atelier.css` only apply before that script runs and are fine. No theme table holds `--on-seal`. It is used by primary
buttons, `.quick`, pressed segments, the chosen sector, wizard steps (Submersibles), `.install`, Settings and menu
hover (shell), `.tk.on`, the character bar and menu hover (Tracker), and the Atelier's main buttons, gem and beacon.

Nine of the 42 theme-and-mode pairs fail today (hand figures; all 21 light and 21 dark accents were worked out):

| Theme, mode | Accent | Today | With the new rule |
| --- | --- | --- | --- |
| Azure Dragoon, dark | `#6ea2ff` | white, 2.54 | `#111111`, 7.44 |
| Ul'dah Sultanate Gilt, dark | `#ff6b82` | white, 2.74 | `#111111`, 6.90 |
| Umbral Ice, Astral Fire, dark | `#ff6a3d` | white, 2.85 | `#111111`, 6.64 |
| Moonfire Faire, dark | `#ff4fd8` | white, 2.85 | `#111111`, 6.62 |
| Ultima Thule, dark | `#b07cff` | white, 2.93 | `#111111`, 6.45 |
| Limsa Brineward, dark | `#ff4b4b` | white, 3.30 | `#111111`, 5.72 |
| Abyssal Oath, dark | `#ff3452` | white, 3.58 | `#111111`, 5.27 |
| Ascian Crimson, dark | `#ff2424` | white, 3.80 | `#111111`, 4.97 |
| Magitek Steel, light | `#0a7cc2` | white, 4.49 | `#000000`, 4.67 (`#111111` would give 4.20) |

The other 33 pass today and do not change (lowest: Lily of the Healer and Aetheryte Glow, light, 4.94 with white). The
seven preset accents and custom accents go through the same rule; they were not worked out here, the test covers them.
No check or test asserts `--on-seal` today: `subs-look.test.js` prints it with its own copy of the old rule;
`ui.test.js` asserts the accent against the page (3:1), not the text on it; C28 compares `--paper` only; the Atelier
test asserts `--seal` for a custom accent.

### R3. Decisions (alternatives rejected in brackets)

- **D12 Text on the accent is chosen by measured contrast:** white if it reaches 4.5:1, else `#111111` if that does,
  else `#000000`. One of the three always reaches 4.5:1, for any accent. Themes that pass today keep their colour
  exactly. [Lowering 0.42 to the crossover: accents of luminance 0.183 to 0.200 stay under 4.5:1, Magitek Steel light
  among them. Moving `--seal` in the nine themes: changes colours the owner chose.] No `--seal` moves (but see Q6).
- **D13 The rule is a named function `onSeal(ac)` in the Atelier's appearance module,** so all three builds carry it
  and the tests read it from the built `look.js`. [A copy of the rule in a test: it drifts, as today's copy would.]
- **D14 Four signature moves** (R4): status as a slanted solid field; an inverted slab for every head; display numerals
  as the largest thing on each screen; the action slab. [All fourteen directions at once: noise. Cut card corners and
  hard offset shadows: they sit next to focus rings or are not in the family.]
- **D15 A slab is a true inversion in both modes** (`--ink` ground, `--paper` text), so on a dark theme it is a light
  block. [A darker-than-page slab with glow: no existing test guarantees its contrast; paper on ink is held at 7:1 by
  `ui.test.js`.] Dark themes add a glow (`--glow`) around actions, the strip, cards and the chart.
- **D16 Text never sits on the molten gradient;** molten is a band of 5 to 6 px or an ornament. [A gradient-filled
  button: white on the progress colour falls under 4.5:1 in several light themes, by hand estimate.]
- **D17 Every slash is the wordmark's 25°:** horizontal offset = 0.466 × height. Varying heights use a skewed
  pseudo-element; fixed heights use `clip-path` with the offset in px. D9 stands, and an element with `overflow:
  hidden` or `clip-path` keeps 4 px between its edge and any focusable child.
- **D18 C25 is kept by two densities chosen in CSS by fleet size:** hero up to 4 companies, dense from 5 at 1400 px and
  wider. [One compromise size: the tame result. A density class set by `subs.js`: behaviour for a look matter.]
- **D19 Company and submarine names on the Board and in Setup use the display face, uppercase** (changes D2 for those
  only; sector names and window titles stay Fraunces). CSS only. [Fraunces 17 px: the "small serif title".]
- **D20 Hover never uses `filter` on a surface that carries text.** [`brightness(1.08)`: lowers white-on-accent below
  the tested value.]
- **D21 The chart gains a turning sonar sweep and heavier strokes;** still decoration (D6), the legend says so;
  geometry frozen (D7). [Depth shading: Q3.]
- **D22 Bars in Earnings are ratios of figures already on screen** (`--p` = value ÷ largest value). No new number.

### R4. The Revision 2 kit (built by W13 in `subs.css`; later items use it)

**Tokens**, added to all three token blocks (same in light and dark unless said):

| Token | Value | Use |
| --- | --- | --- |
| `--slab`, `--on-slab` | `var(--ink)`, `var(--paper)` | the inverted block |
| `--on-slab-2` | `color-mix(in srgb, var(--paper) 72%, var(--ink))` | secondary text on a slab |
| `--back-bg` | `color-mix(in srgb, var(--back) 16%, var(--slip))` (was 10%) | Back row |
| `--bar` | `color-mix(in srgb, var(--seal) 22%, var(--slip))` | bar field under figures |
| `--hi-slip` | `color-mix(in srgb, var(--seal) 16%, var(--slip))` | the `--hi` wash over a card, for the test and for fills |
| `--sweep` | light `rgba(0, 0, 0, .22)`; dark `rgba(255, 255, 255, .28)` | moving highlight on a status field; it moves the field away from its text colour, so contrast only rises |
| `--glow` | light `0 0 0 0 transparent`; dark `0 0 0 1px color-mix(in srgb, var(--seal) 60%, transparent), 0 0 26px -6px var(--lb-glow, var(--seal))` | a `box-shadow` value |
| `--hazard` | `repeating-linear-gradient(-65deg, var(--hz, var(--ink-2)) 0 8px, transparent 8px 16px)` | locked, empty, warning |
| `--edge` | `2px` | every structural border |

**Base rules.**
- **Surfaces** (`.panel`, `.fc`, `.earn-card`, `.sheet`, `.strip`): `--slip`, `border: var(--edge) solid var(--ink)` on
  all four sides, no radius, `box-shadow: var(--shadow), var(--glow)`. The molten band is 6 px at the top, inside the
  border; where the surface has a head slab the band sits under the head instead.
- **Head slab.** `.panel { --pad-x: 18px; padding: 22px var(--pad-x) 16px }`; `.panel:has(> h2:first-child)
  { padding-top: 0; background-image: none }`. `.panel > h2:first-child`: `margin: 0 calc(-1 * var(--pad-x)) 14px;
  padding: 14px var(--pad-x) 12px; background: var(--slab); color: var(--on-slab); font: 900 40px/.95 var(--f-disp)`
  (30 px up to 700 px), uppercase, .02em, `border-bottom: 6px solid transparent; border-image: var(--molten) 1`. Its
  gauge `::after`: 84 × 10 px, `repeating-linear-gradient(90deg, var(--on-slab) 0 22px, transparent 22px 28px)`,
  `skewX(-25deg)`, `margin-top: 10px`.
- **On any slab:** `.muted` and `.tag` take `--on-slab-2`; `.link` takes `--on-slab`; `.btn` is `border-color:
  var(--on-slab); color: var(--on-slab); background: transparent`, hover `background: var(--on-slab); color:
  var(--slab)`; `:focus-visible` has `outline-color: var(--on-slab)`.
- **Section label** (`.recs h3`, `.wide-panel > h3`): `900 22px/1 var(--f-disp)`, uppercase, .04em, `--ink`; its
  `::after` is a slashed divider: `flex: 1; height: 10px; background: repeating-linear-gradient(-65deg, var(--ink) 0
  2px, transparent 2px 8px)`. Delete the later `font-size: 15px` on `.recs h3`. `h4`: as 4.2 plus `border-bottom: 2px
  solid var(--ink)`.
- **Buttons.** `.btn`: `border: var(--edge) solid var(--ink)`, 700. **Action slab** (`.btn.primary`, `.quick`):
  `background: var(--molten) 0 100% / 100% 5px no-repeat, var(--seal); color: var(--on-seal); border: 0;
  border-radius: 0; box-shadow: var(--glow)`; the text clears the band (5 px more bottom padding). `.btn.primary`:
  `font: 900 18px/1 var(--f-disp)`, uppercase, .05em, at least 44 px high, `padding: 0 20px 5px`. `.quick`: `font: 700
  14px/1 var(--f-data)`, sentence case, `position: relative; padding: 0 46px 5px 12px`, and a gauge `::after`:
  `position: absolute; right: 12px; top: calc(50% - 9px); width: 24px; height: 12px; background:
  repeating-linear-gradient(90deg, currentColor 0 5px, transparent 5px 9.5px); transform: skewX(-25deg)`. Hover: the
  band grows to 9 px and `translateY(-1px)`; pressed `translateY(1px)`; disabled `opacity: .5`. Delete both
  `filter: brightness(1.08)` rules.
- **Segments** (`.seg`): `border: var(--edge) solid var(--ink)`; items `700 12px var(--f-body)`, uppercase, .04em;
  pressed or checked: `--slab` / `--on-slab` (the accent is kept for actions and the chosen sector).
- **Chips** outside Board rows: `900 14px/22px var(--f-disp)`, uppercase, .06em, `padding: 0 16px`, slash 10 px each
  end; Locked: `box-shadow: inset 0 0 0 2px var(--ink)`, text `--ink`, no clip. `.tag`, `.dot`: as 4.2.
- **Notes.** `.note`: `border: var(--edge) solid var(--ink); border-left: 12px solid var(--seal); background:
  var(--hi); padding: 10px 14px; font-size: 14px`. `.note.bad`: `border-color: var(--bad); border-left: 0;
  padding-left: 30px; background: repeating-linear-gradient(-65deg, var(--bad) 0 6px, transparent 6px 12px) 0 0 / 18px
  100% no-repeat, var(--hi)`. `.hint.bad`, `.wiz-err`: `--bad`, 700.
- **Fields** (`.inp`, `select`, `.qinp`, `.rec-pick-row input`, `.rec-pick-row select`): `border: var(--edge) solid
  var(--ink)`.
- **Tabs.** Rail `border-right: var(--edge) solid var(--ink)`; label `900 15px/1 var(--f-disp)`, uppercase, .06em
  (13 px on the phone bar), still a direct text node; icons shown at 24 px by CSS; current tab: slab with a 6 px molten
  edge. Phone bar: `border-top: var(--edge) solid var(--ink)`, buttons at least 56 px, still fixed at the bottom.
- **Page texture.** `.subs-main`: `background-image: linear-gradient(var(--grid) 1px, transparent 1px),
  linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 32px 32px`.
- **Empty state** (`.panel.welcome`, `.empty-state`): the whole panel is a slab: `background-color: var(--slab); color:
  var(--on-slab); padding-top: 22px; background-image: repeating-radial-gradient(circle at 100% 0, transparent 0 46px,
  color-mix(in srgb, var(--on-slab) 10%, transparent) 46px 48px)`; its `h2` has no ground of its own and no negative
  margin, `900 clamp(44px, 9vw, 96px)/.9 var(--f-disp)`; text 16 px up to 60ch; the action 56 px high, 22 px.
- **Motion.** Keyframes: `subs-sweep` (`background-position-x` from 150% to -50%, 2.6 s linear, endless) on a status
  field whose ground is `background-color` in the status colour plus `background-image: linear-gradient(115deg,
  transparent 42%, var(--sweep) 50%, transparent 58%); background-size: 300% 100%; background-repeat: no-repeat`;
  `subs-charge` (`clip-path: inset(0 100% 0 0)`, then 66%, 33%, 0; 1.6 s, `steps(4)`, endless) on gauge bars;
  `subs-halo` and `subs-march` kept. `subs-ring` is removed by W14. The two reduced-motion rules stay word for word.
- **Focus.** The shared 2 px `--seal` outline; `--on-slab` on a slab; never `outline: none` without a replacement.

**Contrast test** (`tracker/tests/subs-look.test.js`; assert at least 4.5 in all 21 themes and both modes): `--on-slab`
on `--slab`; `--on-slab-2` on `--slab`; `--ink` on `--back-bg` (existing pair, new value); `--ink` on `--bar`; `--ink`
on `--hi-slip`. Print, do not assert: `--ink-2` on `--bar` and on `--hi-slip`. The existing pairs stay. If a pair
fails, change a mix percentage (lightness), never a hue, and report it.

### R5. Work items

Order: W12, W13, W14, then W15, W16 and W17 in any order, W18, W19, W20, W10, and W21 only on the owner's yes to Q4.
W10 is unchanged except that it runs after W20 and its `docs/STATE.md` entry also names Revision 2 and the W12 fix.

#### W12. Text on the accent, the shared fix (Sonnet builder; first; does not depend on the look work)
- Files: `crafting/atelier/src/atelier.js` (the appearance module only); `tracker/tests/subs-look.test.js`;
  `tracker/tests/ui.test.js` (the 21-theme test only); `crafting/atelier/tests/atelier.test.js` (one assertion);
  `tracker/command-center/check.js` (`L1`, one picture); the built copies `npm run build` rewrites.
- Steps: (1) Before any edit run `cd tracker && node tests/subs-look.test.js` and note the printed lowest "on-seal on
  seal" (hand figure: 2.54, Azure Dragoon dark). (2) After `function mix` add, on one line like its neighbours:
  `function onSeal(ac) { var l = lum(ac) + 0.05; return 1.05 / l >= 4.5 ? '#ffffff' : l / (lum([17, 17, 17]) + 0.05) >= 4.5 ? '#111111' : '#000000'; }`
  and in `applyLook()` replace `lum(ac) > 0.42 ? '#111111' : '#ffffff'` by `onSeal(ac)`. (3) `npm run build`.
  (4) In `subs-look.test.js` replace the printed "on-seal on seal" note by a test that takes `lum` and `onSeal` out of
  the built `site/look.js` (as `THEMES` is taken) and asserts: at least 4.5:1 for the 21 themes in both modes; for the
  seven preset accents in both modes (`ACCENTS`, read the same way); for every 15th value of each colour channel
  (5,832 accents); the result is always one of the three colours and is white whenever white reaches 4.5:1; and the
  three built files `tracker/command-center/site/look.js`, `tracker/dist/eveniunt-tracker.html` and
  `crafting/atelier/dist/eveniunt-atelier.html` each contain `function onSeal(` and none contains `> 0.42 ?`. Print
  the theme-and-mode pairs whose colour differs from the old rule. (5) In `ui.test.js`, inside the loop over the 42
  pairs, also read `--on-seal` and assert its ratio against `--seal` is at least 4.5. (6) In `atelier.test.js`, after
  the Abyssal Oath dark assertions, assert `--on-seal` is `#111111`. (7) In `L1`, after the dark Board picture, choose
  Azure Dragoon the way C28 chooses a theme and take `look-board-desktop-azure-dark.png`; if that needs more than
  C28's steps, leave the picture out and say so.
- Must not change: any theme row, `--seal`, any other token, `shared.css`, `atelier.css`, the save.
- Built files: only paths under `tracker/dist/`, `tracker/site/`, `crafting/atelier/dist/`, `crafting/atelier/site/`
  and `tracker/command-center/site/` may change; report `git status --short`.
- Also report, without fixing: any rule in the Tracker's or the Atelier's styles that puts text on `--seal` with a
  colour other than `--on-seal`.
- Acceptance: `npm run build`, `npm run test:unit`, `npm run test:browser`, `npm run check` pass; the hand-back gives
  the printed list (expected: the nine pairs of R2) and the new lowest ratio (hand figure: 4.67, Magitek Steel light).
- Self-review: open `look-board-desktop-dark.png` (the default theme: the send button must look as before) and the
  Azure picture (dark text on the blue button); say plainly whether both are so.
- Escalate if: the printed list is not the nine pairs of R2; a built file outside those folders changes; any other
  test asserts a colour that this changes.

#### W13. The Revision 2 kit (Sonnet builder; needs W12)
- Files: `src/submersibles/subs.css`, `tracker/tests/subs-look.test.js`.
- Steps: add the R4 tokens to the three token blocks; apply every R4 base rule; add the R4 contrast pairs.
- Must not change: section 5; `subs.js`; the W1 status and chart tokens other than `--back-bg`; the Board's row, card
  and strip rules (W14 owns them), except what the surface rule changes.
- Evidence: all 20 `look-*.png` and the six `submersibles-*.png` regenerate; open `look-setup-desktop.png`,
  `look-log-phone.png` and `look-board-desktop-dark.png`; bold test on those three.
- Acceptance: commands pass; the contrast table is in the hand-back; C25 `fit.maxBottom` ≤ 1040; C20 and C24 pass.
- Escalate if: a pair cannot pass by lightness alone; a panel's first child is not its `h2` and looks broken; the tab
  label would have to move into an element; C25 exceeds 1040 before W14 (then build W14's dense rules first).

#### W14. The Board (Sonnet builder; needs W13)
- Files: `subs.css` only.
- **Density.** Variables on `.subs-main`; dense = `@media (min-width: 1400px)` and `.subs-main:has(.fleet >
  .fc:nth-child(5))`. Rows inside `.fc-subs.list` use the dense row form from 701 px.

  | Variable | Hero (default) | Dense | Phone (up to 700 px) |
  | --- | --- | --- | --- |
  | `--row-pad` | 10px | 4px | 8px |
  | `--field` (top width of the status field) | 124px | 18px | a 30 px band across the top |
  | `--state-fs` (status word) | 28px | 14px (a chip) | 20px |
  | `--name-fs` | 22px | 17px | 20px |
  | `--fig-fs` (countdown) | 34px; 46px in a card 560 px or wider | 20px | 30px |
  | `--quick-h` | 40px | 26px | 48px |
  | `--head-fs` (company name) | 26px | 20px | 24px |
  | `--strip-fig` | 64px | 30px | 44px |
  | `--row-gap` | 8px | 5px | 8px |

- **Command strip.** `.strip`: surface rule, `display: flex; flex-wrap: wrap; align-items: stretch; gap: 0; padding:
  0`, no molten band of its own. `.strip-next`: a slab, `flex: 1 1 340px; display: flex; flex-wrap: wrap; align-items:
  baseline; gap: 0 10px; padding: 12px 60px 12px 16px; font: 600 15px var(--f-serif)`, right end slashed by
  `clip-path: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%)` with `--cut` = 0.466 × its measured height
  (about 44 px hero, 24 px dense). Its `b` ("Next back:"): a kicker, `700 11px var(--f-kick)`, uppercase, .26em,
  `--on-slab-2`, on its own line in hero (`flex-basis: 100%`), inline in dense. `[data-until]`: `900
  var(--strip-fig)/.9 var(--f-disp)`, uppercase, `--on-slab`. `::after`: a charge gauge at the right, `margin-left:
  auto; align-self: center`, 66 × 22 px (36 × 12 dense), `repeating-linear-gradient(90deg, var(--on-slab) 0 14px,
  transparent 14px 22px)`, `skewX(-25deg)`, `subs-charge`. `.strip-back`: `display: flex; align-items: center; gap:
  10px; padding: 0 30px; font: 700 12px var(--f-body)`, uppercase, .1em, `--ink-2`; its `b`: `900 var(--strip-fig)/.9
  var(--f-disp)`, `--ink`. `.strip-back.on`: a `--back` field with `--on-back` text (the `b` too), both ends slashed
  with the same `--cut`, and the sweep. `.strip-tools`: `margin-left: auto; align-self: center; padding: 6px 12px`.
  Phone: one column, both blocks full width, no slash, `.strip-back` 48 px high.
- **Card.** `.fc`: surface rule, `padding: 0 8px 8px`, no band of its own. `.fc-head`: a slab, `margin: 0 -8px
  var(--row-gap); padding: 8px 12px; align-items: center; border-bottom: 5px solid transparent; border-image:
  var(--molten) 1`. `h3`: `900 var(--head-fs)/1 var(--f-disp)`, uppercase, .02em. The world line: `600 11px/1.4
  var(--f-data)`, uppercase, .08em, `--on-slab-2`, on its own line. Buttons by the slab rule. `.fc-subs { gap:
  var(--row-gap) }`.
- **Row** (`.sub`), hero: `position: relative; overflow: hidden; display: grid; gap: 2px; border: 0; border-radius: 0;
  padding: var(--row-pad) 10px var(--row-pad) calc(var(--field) + 10px); background: var(--st-bg, var(--paper))`. Per
  status set `--st`, `--on-st`, `--st-bg` (Back, Out, Idle from their tokens).
  - Status field `.sub::before`: `content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: var(--field);
    background-color: var(--st); transform: skewX(-25deg); transform-origin: 0 0; pointer-events: none`. Its right edge
    leans like the wordmark's bars; the part pushed left of the row is cut by the row's `overflow`.
  - Status word: `.sub .chip`: `position: absolute; left: 10px; top: var(--row-pad); padding: 0; background: none;
    box-shadow: none; clip-path: none; font: 900 var(--state-fs)/1 var(--f-disp); letter-spacing: .04em; color:
    var(--on-st)`. Under it, hero only, a gauge `::after`: `display: block; margin-top: 8px; width: 34px; height: 10px;
    background: repeating-linear-gradient(90deg, currentColor 0 7px, transparent 7px 12px); transform: skewX(-25deg);
    opacity: .55`.
  - Back: `box-shadow: inset 0 0 0 2px var(--back)`; its field carries the sweep. Remove `subs-ring` and its use.
  - Locked: text `--ink-2`; row ground `var(--hazard)` with `--hz: var(--grid)` over `--paper`; field `var(--hazard)`
    with `--hz: var(--ink-2)` and no solid colour; `.chip.locked` is a plate: `background: var(--paper); color:
    var(--ink); box-shadow: inset 0 0 0 2px var(--ink); padding: 2px 6px; font-size: calc(var(--state-fs) - 4px)`.
  - `.sub.empty`: `border: 2px dashed var(--idle)`; field `var(--hazard)` with `--hz: var(--idle)`.
  - Hover (`.sub[data-sub]`): `translateY(-2px)` and `box-shadow: inset 0 0 0 2px var(--ink)`. Focus as built.
  - `.sub-name`: `900 var(--name-fs)/1 var(--f-disp)`, uppercase, .02em, ellipsis as built; `.sub-top { min-height:
    calc(var(--name-fs) + 4px) }`. `.sub-fc`: its own line, `600 11px/1.3 var(--f-data)`, `--ink-2`.
  - Rank plate `.sub[data-sub] .sub-meta > span:first-child`: `900 16px/20px var(--f-disp)`, uppercase, .04em,
    `padding: 0 10px; background: var(--slab); color: var(--on-slab)`, slash 9 px each end. The rest of `.sub-meta`
    as built.
  - `.when`: `display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font: 600 12px/1 var(--f-data)`,
    uppercase, .04em, `--ink`. Its `b` (the countdown or the wait): `900 var(--fig-fs)/1 var(--f-disp)`. For Idle the
    whole `.when` ("not sent") is `900 var(--fig-fs)/1 var(--f-disp)`.
  - `.quick`: the action slab, `min-height: var(--quick-h)`, `flex: 1 1 auto`, left-aligned, ellipsis as built.
- **Wide card** (`@container fcsubs (min-width: 560px)`, declared last): `.sub { grid-template-columns: minmax(0, 1fr)
  minmax(0, 1.25fr); column-gap: 18px; padding-top: 12px; padding-bottom: 12px }`; `.sub-top`, `.sub-meta` in column
  1; `.sub-when` in column 2 across both rows, `align-self: center; flex-direction: column; align-items: stretch`;
  `.when b` 46 px; `.quick` 48 px high, 15 px.
- **Dense overrides.** `.sub { gap: 0; padding: 4px 6px 4px 28px }`; the status word goes back to a chip at the right
  of `.sub-top`: `position: static; font: 900 14px/20px var(--f-disp); padding: 0 12px; background: var(--st); color:
  var(--on-st)`, slash 9 px each end, no gauge (Locked: the R4 outline chip); rank plate `900 13px/15px`, slash 7 px;
  `.when`: `display: inline; font: 400 12px var(--f-body)`, no uppercase; `.quick`: `font-size: 12px; padding: 0 8px
  4px`, band 4 px, no gauge; flex and wrap values of `.sub-when` and `.quick` exactly as built, so no line wraps that
  does not wrap today. Strip: one line, `padding: 6px 40px 6px 14px`.
- **Phone.** `.sub { padding: 38px 10px 8px }`; the field becomes a band: `left: 0; right: 0; width: auto; bottom:
  auto; height: 30px; transform: none`; status word `top: 0; line-height: 30px` (the Locked plate `top: 5px;
  line-height: 16px`), no gauge; `.quick` full width.
- **C25.** Against today's figures a dense `.sub` may grow by at most 2 px, the card top down to its first row by
  8 px, `.strip` by 10 px (worst case 1,021). Hand estimate of the result: about 990 to 1,000.
- Must not change: `subs.js`; section 5; the `.fleet` columns; `[data-until]` and `[data-since]` stay inside their
  sentences; the centre of `.sub-top` (R1).
- Evidence: `look-board-*` (four, plus the Azure picture if W12 made it), `submersibles-board.png`, `-phone.png`,
  `-desktop.png` (the 8-company dense Board). Bold test on each.
- Acceptance: commands pass; C25 `fit.maxBottom` ≤ 1040 with four columns and two at 1024 px; C24 passes; the contrast
  table is unchanged or better.
- Escalate if: the dense budget cannot hold; a status word does not fit its field; a rule needs markup; a check reads
  a name with `innerText`.

#### W15. Send window and sheets (Sonnet builder; needs W13; replaces W4)
- Files: `subs.css` only.
- Rules: `.sheet`: surface rule, no radius at any width, `::backdrop` `rgba(0, 0, 0, .6)`. `.sheet h2`: a slab flush
  with the sheet's sides and its band (`margin: -16px -18px 12px; padding: 14px 18px 12px`), Fraunces 900 26 px/1.1, no
  double rule. `.advice`: `border: 2px solid var(--ink); border-left: 12px solid var(--seal); background: var(--hi);
  padding: 12px 14px`; `.advice-step`: a kicker (`700 11px var(--f-kick)`, uppercase, .22em, `--ink-2`);
  `.advice-route`: `display: grid; gap: 10px`; its `b`: `900 clamp(38px, 10vw, 56px)/.95 var(--f-disp)`, .04em,
  `overflow-wrap: anywhere`; "Send on this route": 56 px high, full width, 22 px; "Change it first": 44 px. `.alts`: no
  bullets, no indent, rows parted by `1px dashed var(--rule)`, routes `600 15px var(--f-data)`. `.seg.wide` labels
  48 px. `.sector`: `border: 2px solid var(--ink)`, at least 56 px high, letter `900 30px/1 var(--f-disp)`, name 700
  13 px, `small` 12 px `--ink-2`; `.on`: `--seal` / `--on-seal`, a 5 px molten band at the bottom, `small` in the same
  colour with **no opacity**; `:disabled`: `opacity: .5` and `var(--hazard)` with `--hz: var(--grid)`; `.ord`: a 24 px
  square, no radius, `--slab` / `--on-slab`, `900 15px var(--f-disp)`. `.route-line`: `border-top` and `border-bottom`
  `2px solid var(--ink)`, `padding: 8px 0`, `15px var(--f-data)`; its `b`: `900 26px/1 var(--f-disp)`, .04em.
  `.calc-line b`: `900 22px/1 var(--f-disp)`. `.facts`, `.rankbox`: labels `700 11px` uppercase .08em `--ink-2`,
  values `600 16px var(--f-data)`. `.loot-h`: the section label at 16 px; `.loot-row` dashed; `.qbtn`: 44 × 44 px,
  `2px solid var(--ink)`, `900 22px var(--f-disp)`. The three `summary` lines (`.loot`, `.game-says`, `.route-pick`):
  44 px high, `700 14px`, uppercase, .06em. `.sheet-actions`: up to 700 px `position: sticky; bottom: 0; background:
  var(--slip); border-top: 2px solid var(--ink)`, the main action full width and 56 px.
- Must not change: `subs.js`; section 5 (`#sheet .btn.primary` order, `.sectors` wider than 300 px).
- Evidence: `look-sheet-desktop.png`, `look-sheet-phone.png`; bold test.
- Acceptance: commands pass (C21 to C23, C22's `pickerFull`, C78 to C81 and C85 to C88 use this window).
- Escalate if: the sticky actions cover a field the checks click; the `h2` is not the first child of `.sheet-in`; a
  rule needs markup.

#### W16. Log and Earnings (Sonnet builder; needs W13; replaces W5)
- Files: `subs.css`; `subs.js` only for: the class `empty-state` on three empty panels (the fallback panel in
  `render()`, the first `return` of `logHtml`, the first `return` of `earnHtml`: `class="panel empty-state"`); and in
  `earnHtml` a `style="--p:<ratio>"` on each `tr[data-pos]` (its gil per hour ÷ the largest gil per hour in that
  table) and on each row of the "By free company" table (its gil ÷ the largest), three decimals, 0 when the largest
  is 0.
- Log: `.log-list`: one list, `border: 2px solid var(--ink)`, rows parted by `1px dashed var(--rule)`, no box per row.
  `.log-row`: `padding: 0 12px 0 0`, at least 64 px, columns `132px 1fr auto`. `.log-when`: a slab cell, full row
  height, centred, `600 13px var(--f-data)`, right end slashed (30 px at 64 px high). `.log-who b`: 700 15 px; its
  route line `13px var(--f-data)`. `.log-what`: right-aligned 12 px; its `b` (the gil): `900 26px/1 var(--f-disp)`.
  Hover: `--paper-2`, and the time cell turns `--seal` / `--on-seal`. Phone: one column, the time cell a 24 px strip
  across the top, no slash.
- Earnings: `.earn-cards`: `repeat(auto-fit, minmax(220px, 1fr))`. `.earn-card`: surface rule, `container-type:
  inline-size`; label a kicker; figure `900 clamp(24px, 12cqi, 56px)/.95 var(--f-disp)`, `overflow-wrap: anywhere`;
  the first card is a slab (label `--on-slab-2`). `.earn-t`: `th` `700 11px var(--f-body)`, uppercase, .1em, `--ink-2`,
  over `border-bottom: 4px double var(--ink)`; rows dashed; `td b`: `600 15px var(--f-data)`. Ranked rows
  (`tr[data-pos]`): the first cell is a numbered block, 56 px wide, centred, `900 28px/1 var(--f-disp)`: position 1
  `--seal` / `--on-seal` at 40 px in a 64 px row with its gil per hour `900 30px/1 var(--f-disp)`; positions 2 and 3
  `--slab` / `--on-slab` in 52 px rows; the rest plain `--ink-2` in 44 px rows. The gil-per-hour cell of each ranked
  row and the gil cell of each free-company row is a bar: `background: linear-gradient(90deg, var(--bar) calc(var(--p)
  * 100%), transparent 0)`. `.earn-thin` rows: a 10 px hazard edge at the left (`--hz: var(--idle)`). Up to 700 px a
  table may scroll inside itself (`display: block; overflow-x: auto`) only if it does not fit at 360 px.
- Must not change: any figure, any text, the order of rows and cards; section 5.
- Evidence: `look-log-*`, `look-earnings-*` (four); bold test.
- Acceptance: commands pass (C22 reads `.earn-card b` and the first `.earn-t` row; C78 reads `.earn-ranked`).
- Escalate if: `subs.js` needs any other edit; a gil figure does not fit its card at 360 px.

#### W17. Setup and the recommendations panel (Sonnet builder; needs W13; replaces W6)
- Files: `subs.css` only.
- Setup: `.fc-list li`: `border: 2px solid var(--ink)`, at least 64 px; the name (`li > span > b`): `900 22px/1
  var(--f-disp)`, uppercase; its `.muted` line `12px var(--f-data)`. Wizard: `.dot`: step blocks, `900 13px/24px
  var(--f-disp)`, uppercase, slash 11 px each end if they are not focusable (else plain blocks); `.dot.on` `--seal` /
  `--on-seal`; `.dot.done` `--slab` / `--on-slab`; the rest outlined 2 px. `.wiz-body h3`: Fraunces 900 24 px.
  `.wiz-foot`: `border-top: 4px double var(--ink)`, its main action 48 px. `fieldset`: `2px solid var(--ink)`;
  `legend`: a slab label, `900 14px var(--f-disp)`, uppercase, .06em, `padding: 2px 10px`. `.inp.big` 20 px.
  `.sea`: `2px solid var(--ink)`; `summary` 48 px, `900 18px var(--f-disp)`, uppercase; open: the summary is a slab.
  `.tick` at least 40 px up to 700 px; checkboxes and radios 20 px, `accent-color: var(--seal)`.
- Recommendations: `.rec-rank li`: `padding: 0 10px 0 0`, at least 64 px, parted by `2px solid var(--ink)`.
  `.rec-name`: `display: flex; align-items: center; gap: 12px; align-self: stretch`, name 700 15 px; its `b` (the
  number): a block 56 px wide, full row height, centred, `900 36px/1 var(--f-disp)`, `--slab` / `--on-slab`, right end
  slashed. First `li`: the number block `--seal` / `--on-seal`, the row `--hi`, the name 17 px. `.rec-rank button`: at
  least 40 px. Fuel slider (`.rec-give input[type="range"]`): `appearance: none`; track 14 px, `--paper-3`, `2px solid
  var(--ink)`; thumb 24 × 32 px, `--seal`, `2px solid var(--ink)`, no radius (`::-webkit-slider-thumb` and
  `::-moz-range-thumb`); the focus ring stays. `.rec-give-text`: `900 40px/1 var(--f-disp)`. `.rec-picker`: `2px solid
  var(--ink)`, `padding: 10px 12px`, `margin-top: 10px`; its title line (`.rec-pick-title`, or the `.opt` label) 700
  15 px; fields 44 px high; `.rec-note` 13 px `--ink-2`. `.acc`: as `.earn-t`.
- Must not change: `subs.js`; section 5; what the slider, the buttons and the pickers do.
- Evidence: `look-setup-*`, `look-recommendations-*` (four), `submersibles-recommendations.png`; bold test.
- Acceptance: commands pass (C85 to C88, including no sideways scroll at 360 px).
- Escalate if: a rule needs markup; a recommendations check reads a style; the restyled slider cannot be moved by the
  keyboard or by the check.

#### W18. The chart (Sonnet builder; needs W13; replaces W7)
- Files: `src/submersibles/chart.js`, `subs.css` (the chart rules and tokens), `tracker/tests/subs-look.test.js`.
- Steps: build 4.3 layers 1 to 8 as written, with these changes. `C.svg(view, route, opts)` gains an optional third
  argument `{ selected: id }`; with it absent the output has no `selected` class. Add `data-sea="<id>"` to the `<svg>`.
  Add the classes `on-route`, `selected`, `has-slot`, `opens-sea` after the existing ones. `C.view` gains `grid` only.
  Keep D7 and D8.
  - New tokens on `.map-panel`: `--chart-glow: color-mix(in srgb, var(--chart-hot) 55%, transparent)`;
    `--chart-bg-hi: color-mix(in srgb, var(--chart-hot) 9%, color-mix(in srgb, var(--chart-ink) 4%, var(--chart-bg-2)))`
    (the lightest ground under any marker: scan line plus sweep).
  - Water: over the gradient, scan lines `repeating-linear-gradient(0deg, transparent 0 3px, color-mix(in srgb,
    var(--chart-ink) 4%, transparent) 3px 4px)`, and `box-shadow: inset 0 0 80px -10px var(--chart-bg)`.
  - Graticule: 1 px, and a second path `<path class="chart-grid major" aria-hidden="true">` at every multiple of 500,
    2 px.
  - Rings: 1.5 px; every second ring solid, the others dashed `4 6`.
  - Sweep (new, between rings and reveal lines): `<g class="chart-sweep" aria-hidden="true"
    style="transform-origin:<sx>px <sy>px">` (Start's place in chart units, through `py`) holding `<path
    class="chart-sweep-fan">`, a 40° sector from Start out to the largest ring, fill `color-mix(in srgb,
    var(--chart-hot) 9%, transparent)`, and `<line class="chart-sweep-edge">`, its leading edge, 2 px `--chart-hot` at
    60% opacity. CSS: `animation: subs-turn 9s linear infinite` (new keyframes: rotate one full turn). Add
    `.chart-sweep { display: none }` under both reduced-motion conditions.
  - Reveal lines: open 2 px, closed 1.5 px dashed; chevrons 0.7 r.
  - Route: glow 14 px at 30%; the line 5 px, `stroke-dasharray: 14 8`, `filter: drop-shadow(0 0 6px
    var(--chart-glow))`; `subs-march` moves by -22; leg chevrons 0.8 r.
  - Start: the ring 2 px. Markers: found disc with a 3 px `--chart-bg` gap ring and `filter: drop-shadow(0 0 5px
    var(--chart-found))`; next: 3 px stroke and the halo; on-route ring 3 px; selected brackets 3 px; plus 2.5 px;
    second ring 2 px. Letters 900. Focus: `.hit` 4 px `--chart-hot`. Everything stays within 1.5 r (D7).
- Tests to add: the seven `viewBox` strings equal W0's; `C.svg` called twice gives the same string; one `<polyline`
  with a route and none without; `selected` appears only with `opts.selected`, once; with `C.Y_DOWN = false` (restored
  afterwards) the rings' centre and the sweep's origin equal `view.start` and every grid line lies on a multiple of
  100 in data y; exactly one `chart-sweep` group; no nested `<g>` inside a node group; every new element outside node
  groups is `aria-hidden="true"`. In the contrast test: every chart pair also against `--chart-bg-hi` (4.5; 3 for
  `--chart-far`).
- Untouched: `placeTags`, `hitRadii`, `TAP_FRACTION`, `C.Y_DOWN`, `STATE`, every `aria-label`, the existing tests.
- Evidence: `look-map-*` and `look-planner-*` (six), `submersibles-map.png`, `submersibles-planner.png`; bold test,
  and say whether the fan's point sits on the Start marker in every picture.
- Acceptance: commands pass; C82 `hitMin` ≥ 38 and `svgWidth` ≥ 330; C84 unchanged; the chart ratios pass.
- Escalate if: an existing chart test would have to change; a pair fails against `--chart-bg-hi` (then lower the fan
  to an edge line only and say so); letters in `--f-disp` are unreadable at 360 px (fall back to `700 var(--f-body)`
  and say so); any layer needs a position changed.

#### W19. Map tab chrome and details (Sonnet builder; needs W18; replaces W8)
- Files: `subs.css`; `subs.js` in `mapHtml` and `sectorDetails` only; `check.js` `L1`.
- Steps in `mapHtml`: pass `{ selected: m.sector }` to `CHART.svg`; add `style="--p:<found/total>"` to each sea button;
  add inside `.chart-wrap`, before the SVG, `<header class="chart-head"><span class="chart-sea">` sea name
  `</span><span class="chart-count">found n of m</span></header>`; wrap planner, `.chart-wrap`, legend and details in
  `<div class="map-grid">`. Legend: replace the three glyph spans by inline SVG swatches (`aria-hidden`), same words,
  and extend the sentence to exactly: "found · can be revealed next · further away · Start · planned route, numbered ·
  plus: grants a submarine slot · double ring: opens the next sea · dimmed: above this submarine's rank. The grid,
  rings and sweep are decoration and measure nothing. Tap a sector for its details." `sectorDetails`: no edit unless a
  rule below cannot be met without one.
- Rules: sea tabs (`[data-map-sea]`): 52 px high, `2px solid var(--ink)`, name `900 16px var(--f-disp)` uppercase,
  count `11px var(--f-data)` `--ink-2` on its own line, and along the bottom a 6 px skewed bar in the sea's hue filled
  to `--p` on an `--ink-2` track; pressed: `--slab` / `--on-slab` (count `--on-slab-2`). Up to 700 px one row that
  scrolls inside itself. `.chart-wrap`: `2px solid var(--ink)`, no side padding, `box-shadow: var(--glow)`.
  `.chart-head`: `--chart-bg`, `padding: 10px 14px`, `border-bottom: 5px solid var(--sea)`; sea name `900 34px/1
  var(--f-disp)` uppercase `--chart-ink` (24 px up to 700 px); count `600 14px var(--f-data)` `--chart-ink-2`. Legend:
  a `--chart-bg` block with `--chart-ink` text, 13 px. `.chart-details`: surface rule; its `h3` a slab flush with the
  sides (Fraunces 900 24 px); the state line 700 13 px uppercase; `.chart-facts`: labels `700 11px` uppercase .08em
  `--ink-2`, values `900 22px/1.1 var(--f-disp)` for the first five and `14px var(--f-body)` for the rest.
  `.planner .route-line` as in W15. `.map-grid` from 1100 px: columns `minmax(0, 1fr) 360px`, chart and legend left,
  planner and details right, by `grid-column` / `grid-row` only; `.map-panel` max-width 1400 px. Up to 700 px:
  `.map-panel { --pad-x: 8px }`.
- In `L1`: assert at 360 px chart width ≥ 320 and smallest `.hit` ≥ 36.
- Must not change: section 5 (the sea button's text, "slot 2", "Rank needed", the keyboard path).
- Evidence: `look-map-*`, `look-planner-*`, `submersibles-map.png`, `submersibles-planner.png`; bold test.
- Acceptance: commands pass; C82 and C84 unchanged.
- Escalate if: the parallel model work has changed `mapHtml` or `sectorDetails`; the tap circles miss 36 px at 360 px.

#### W20. Final pass (Sonnet builder; needs W14 to W19; replaces W9)
- Files: `subs.css`; `check.js` `L1` (turn the recorded tap-height figure into an assertion: ≥ 36 px).
- Steps: at 360 × 800 in light and dark walk all eight screens; fix clipped or overlapping text, any target under
  36 px, any text under 12 px (11 px uppercase labels excepted), any focus ring hidden or cut (rows, slabs, the
  strip). Turn the motion setting to reduced and confirm that no sweep, charge, halo, march or turn runs and the chart
  sweep is not drawn. Try Azure Dragoon dark, Magitek Steel light and one light theme with a pale yellow page; report
  what was seen. Run the bold test over all pictures and list every "still tame".
- Evidence: every `look-*.png` and the six `submersibles-*.png`.
- Acceptance: `npm run build`, `npm run test:unit`, `npm run test:browser`, `npm run check` all pass; the hand-back
  lists the final C25 `maxBottom`, C82 `hitMin`, the `L1` figures and the contrast table.
- Escalate if: a fix needs markup outside the functions named in W16 and W19.

#### W21. Voyage gauge (Sonnet builder; only on the owner's yes to Q4; needs W14; replaces W11)
- Files: `subs.js` (`subRow`, `tick`), `subs.css`, `check.js` `L1` (one assertion). An `aria-hidden` bar along the
  bottom of an Out row, beside the status field: 6 px high, ten skewed segments, filled in `--out` to `(now − sentAt)
  / (returnAt − sentAt)` on a track of `--out` at 20%, placed absolutely so the row does not grow, updated by the
  existing one-second clock; omitted when either time is missing. Evidence: `look-board-*`; bold test.
  Escalate if: `sentAt` is not stored for voyages typed from the game's time; C25 moves.

### R6. Risks, and the first thing to verify

- **First:** this file was rewritten whole to append this section (no edit tool). Run `git diff --numstat
  docs/submersibles-look-spec.md`: it must show additions only (0 deleted). Then W12 step 1: if the printed lowest
  ratio or the list of changed pairs is not what R2 says, stop; R2 is hand arithmetic.
- W12 changes the label colour on the accent in nine theme-and-mode pairs in every module. That is the fix; nothing
  else moves. Magitek Steel light changes from white to black text (Q6).
- On dark themes the slabs are light blocks. If that glares, the owner will see it in `look-board-desktop-dark.png`;
  the remedy is a design change, not a tweak.
- Uppercase names: two names that differ only in case look the same on the Board; a letter the display face lacks is
  drawn by the next font in the stack.
- A fifth company switches the Board from hero to dense. That is how C25 is kept; it is a visible change of scale.
- `:has`, container units (`cqi`), `border-image` with a gradient and `transform-origin` on an SVG group are needed in
  the engines where the checks run.
- `filter: brightness(1.08)` on hover stays in the other modules (`shared.css`); it is not changed here.
- The sweep can be read as a live sonar. It is decoration; the legend says so.
- The risks of section 8 stand (parallel work on the same files, custom colours, the unverified orientation).

### R7. Owner questions

Q1 to Q5 stand as written. Two more:

**Q6. The label on Magitek Steel's light accent.** Its blue is the one accent where white text misses the standard by
a hair (4.49 against 4.5).
- Black text on that blue, by the general rule (what W12 builds). The theme's colours do not change. Cost: none
  extra. Risk: black on a medium blue looks heavier than white; 4.67.
- Darken that one accent by a single step (`#0a7cc2` to about `#0a7bc1`; not visible to the eye) so white text passes
  at about 4.55. Cost: one small extra item. Risk: it changes a theme colour you chose, everywhere it is used; the
  margin is thin.
- Keep things as they are for this theme: white text at 4.49, just under the standard, and the test excuses this one.
- Recommendation: the first. Fairly sure; the second can follow if the black label looks wrong to you.

**Q7. How the shared fix ships.** W12 changes the Tracker and the Atelier too, not only Submersibles.
- Its own pull request, first. The fix reaches every module without waiting for the look work. Cost: one more
  decision for you. Risk: low; three built apps change by one rule.
- In the same pull request as the look work. One decision; the fix waits for the restyle.
- Keep things as they are: no fix; nine theme-and-mode pairs keep faint button text.
- Recommendation: its own pull request. Fairly sure.

## Revision 3: colour

Appended 2026-11-18. Everything above is unchanged; it records what W0 to W3, W10 and W12 to W21 built. Where this
section and the earlier ones disagree, this section wins. A builder of W22 onward reads section 5, R1, R4, then R3.3
to R3.7 and its own item. R1's bold test still applies; the colour test of R3.7 is added to it.

Why: the owner looked at the finished Revision 2 screens and said: "The log looks very bland since it only has two
colors with a line in another color"; the chart is "a bunch of lines together with 2-3 colors that are very similar";
"it appears you chose 2-3 and went to the market with those, making the entire design the same in general which makes
me think AI slop/laziness". Wanted: "A LOT of contrast between colors while maintaining the same vibe of the chosen
theme", with the worry that some colours may "clash a lot with the chosen theme (which may or may not be a good
thing)".

Read for this revision: `CLAUDE.md`; this spec; the brief with the owner's words; `subs.css` and `chart.js` whole; in
`subs.js` the functions `strip`, `subRow`, `lockedRow`, `fcCard`, `boardHtml`, `recPickersHtml`, `recsBodyHtml`,
`recsHtml`, `adviceHtml`, `pickerHtml`, `logHtml`, `sectorDetails`, `plannerHtml`, `mapHtml`, `earnHtml` (the wizard's
sea list and the voyage grade by search); `THEMES`, `ACCENTS` and `applyLook()` in `crafting/atelier/src/atelier.js`;
the token blocks of `shared.css` (by search); `tracker/tests/subs-look.test.js`; block `L1` of `check.js`. By search:
no file in `tracker/tests/` reads the class of a chart line, a chevron or a dash; `submarines.test.js` reads
`chart-sweep`, `chart-sweep-fan`, both `chart-grid` paths and the ring classes `solid` and `dash`, so that markup
stays. Not read: `index.html` (one line only: `<body class="subs-page">`), `build.js`, `shell.css`, `settings.js`,
`recs.js` beyond its four labels, the data file, `docs/STATE.md`. Nothing was built or run and no picture was viewed:
what the screens look like is the orchestrator's description. Every colour figure below is hand arithmetic in OKLCH,
good to about two figures; W22's test and palette sheet are the authority. Browser versions are from memory.

### R3.1 Goal and constraints

- A real palette in each of the 21 themes, light and dark: several hues that contrast strongly with each other and
  still belong to the chosen theme. Every colour on a screen means something. The chart reads at a glance.
- Colour only. No size, spacing, text, order, hook or behaviour changes, except where an item names one. Section 5
  and R1's "must hold" list stand: text 4.5:1, meaningful graphics 3:1, C20, C24, C25 (`fit.maxBottom` is 1,020 by the
  brief; limit 1,040), C28 (never set `--paper`), C82, the 360 px checks, both reduced-motion rules, no new external
  resource, no game artwork, nothing automated, no invented number.
- Not edited: `advisor.js`, `recs.js`, `earn.js`, `drops.js`, `fleet.js`, `push.js`, `save.js`, `shared.css`,
  `atelier.js`. `subs.js` is edited only in the function an item names, and only to add a class or a
  `style="--p:…"` from data that function already holds (W24 also redraws two `aria-hidden` legend swatches).
- A state is never told by colour alone: a word or a shape always goes with it.

### R3.2 Findings

- **Where colour comes from today.** `--ink` (every slab, head, time cell and border), `--paper` and `--slip`, the
  accent, the molten band; the Board's three status colours; green and amber on the chart. In the Log, Earnings,
  Setup and around the chart no colour says what a thing is.
- **What a theme provides.** Four colours per mode: page, text, accent, progress colour. `applyLook()` derives every
  other token by mixing those (`--lb-a` is a tint of the accent, `--lb-b` the accent, `--lb-c` the progress colour).
  A theme therefore owns two hues at most, and in Ascian Crimson and Azure Dragoon dark the second one is grey. More
  hues have to be derived.
- **The 42 accents differ widely** in lightness (dark on light themes, bright on dark ones) and in strength
  (`#ff2424`, `#2ff0e0` against `#3d6c96`). Only their hue is safe to reuse.
- **Magitek Steel's accent is not grey.** `#0a7cc2` is a strong blue (hue about 245°); its page and text are the
  neutral ones. The grey accents are the "Black / White" preset (`#111417`, `#f0f0f0`) and any custom grey.
- **The test's reader** (`colour()`) knows hex, `white`, `var()` and `color-mix(in srgb, …)` only.
- **The chart** draws grid, rings, sweep and reveal lines in near-identical pale tints (`--chart-line`,
  `--chart-ink-2`, `--chart-far`) at 1 to 2 px, three of them dashed; found and next markers have almost the same
  lightness (luminance 0.49 and 0.51 by hand).
- **`L1` seeds eleven voyages on one route, all with items:** every Log row is the same by construction.

### R3.3 Decisions (alternatives rejected in brackets)

- **D23 Only the hue is taken from the theme.** Lightness and strength of every new colour are fixed numbers (OKLCH
  0.70 and 0.10); every other tone is that colour mixed into the theme's own `--ink` or `--slip`. [Taking lightness
  or strength from the accent: a neon accent gives a neon palette, a pale one fails contrast. Rotating in HSL:
  lightness swings with the hue, yellow against blue, and no contrast can be promised.]
- **D24 Four voices a quarter turn apart, the first on the accent's hue** (+0°, +90°, +180°, +270°). [The complement
  alone, or a triad: three colours again. Split complements plus neighbours: unevenly spaced, two voices 30° apart. A
  typed table per theme: 42 rows of twelve colours, and custom accents left out.] The three offsets are one line (Q8).
- **D25 Each voice means one kind of thing on every screen:** rank, gil, loot, route, the four objectives of the
  recommendations panel, which thereby is the legend. [Colour per free company: eight companies need eight hues that
  collide with seas and states, and a company is always named. A different colour per card for variety: colour without
  meaning, the complaint itself.]
- **D26 The palette is CSS in `subs.css` only. Relative colour syntax may be used in one form only, to read a hue:**
  `oklch(from <colour> 0.7 0.1 calc(h + N))`, inside `@supports (color: oklch(from red 0.7 0.1 calc(h + 90)))`.
  Fallback where that is not supported: the same tones at the fixed hues 350°, 80°, 170° and 260°, by plain
  `oklch()`: equal contrast, no rotation with the theme. [A palette computed in `applyLook()`: it could push every hue
  to its most vivid and solve contrast in a loop, and the test would call the very same function; but it is shared
  code: the Tracker, the Atelier and the Command Center are rebuilt and republished for one module's look, a fault in
  it breaks theming in every module, and it undoes D4. Kept as the strongest option of Q8. JavaScript inside the
  module: a second place that must follow every theme change, and behaviour for a look matter.]
- **D27 Every new colour lies inside sRGB for every hue** (the test proves it), so the engines' differing treatment of
  out-of-range colours and wide-gamut screens cannot change a ratio. That caps the strength near 0.10: at lightness
  0.70 the narrow point is cyan, about 0.12 by hand. [Strength 0.15: more vivid, out of range around cyan and yellow,
  and the contrast is no longer computable.]
- **D28 The hue is read from an anchor with a grey guard:** the accent 90% and the progress colour 10%, then that 97%
  and `#2f7fd0` 3%, mixed in OKLab. A coloured accent moves by a few degrees; a grey one takes the hue of the theme's
  second colour, and blue if that is grey too. [Reading the hue of a grey: undefined, engines differ, the test cannot
  compute it.]
- **D29 The status colours keep their hue and their tested values in every theme** (Back and found green, Out blue,
  Idle amber, errors red, Locked and far neutral). They sit with the theme through tone: their washes are mixed into
  the theme's `--slip`, the chart's into its water. One value moves: "next" on the chart (D33). [Pulling them toward
  the accent: Out turns violet in red themes and Back olive in orange ones; twelve tested pairs reopen.] Q9.
- **D30 The seven sea colours are fixed hues at the palette's tone** (plain `oklch()` at lightness 0.70), the same in
  every theme, and may now carry text through the same four tones. [Rotating with the theme: a sea changes colour when
  the theme does, and lands on the voices. Keeping the built hexes: their lightness runs from about 0.53 to 0.77, dark
  text fails on two of them.]
- **D31 A coloured block is a slab whose tokens are set again where it stands** (a "field", R3.5). Every "on any slab"
  rule of R4 then works unchanged. The text on a field is the darker of ink and paper in both modes. This changes D15
  for fields only: an ink slab stays a true inversion. [New classes and a second set of rules for coloured heads.]
- **D32 The molten band stops marking everything.** It stays on actions, the Board's strip and card heads, and the
  sheet; a head that becomes a field gets a 6 px `--ink` band. [Molten under every head: the "one line in another
  color".]
- **D33 On the chart each visual channel has one job.** Dashes: the planned route only. Hue: the state. Weight: how
  soon a thing matters. Lightness: a ladder from far to next. The background is one receding colour, capped at 1.6:1.
  "Next" becomes the lightest, filled marker (`#ffe38a`); "far" becomes hollow. [Plates as new `<rect>` behind labels:
  new markup inside node groups, against section 5; the halo already is the plate. Removing chevrons from the markup:
  hidden by CSS instead, so `chart.js` only adds classes.]
- **D34 The way to the next submarine slot and to the next sea is worked out in `chart.js`** from the reveal links
  already in the view, and only adds a class. It is drawn in `--chart-ink`, the lightest neutral. [A fifth chart hue:
  it lands on the accent's tint in some themes.]
- **D35 "Not two or three colours" is measured,** in `L1`, from computed colours in three themes (R3.7). [Judging
  from pictures alone: what failed twice.]
- **D36 No new words on screen in this revision.** The voyage grade on Log rows and a legend clause for the new line
  colours are owner questions (Q10, Q11).

### R3.4 The palette (W22 builds it)

**Tones.** Every hue has the same four tones, by the same formulas in light and dark mode (`X` is `rank`, `gil`,
`loot`, `route`, `sea` or `scr`):

| Token | Formula | Use | Must reach |
| --- | --- | --- | --- |
| `--X-m` (mid; a sea's is `--sea`) | the hue at OKLCH 0.70 / 0.10 (seas 0.10 to 0.13) | a field with `--on-mid` text; any mark on the chart | `--on-mid` on it 4.5; in sRGB |
| `--X-g` (graphic) | `color-mix(in srgb, var(--X-m) 66%, var(--ink))` | bands, bars, borders, icons | 3 on `--slip`, `--paper`, `--paper-2` |
| `--X-s` (strong) | `color-mix(in srgb, var(--X-m) 46%, var(--ink))` | coloured text | 4.5 on `--slip`, `--paper`, `--paper-2`, its own wash |
| `--X-w` (wash) | `color-mix(in srgb, var(--X-m) 14%, var(--slip))` | a tint under `--ink` text | `--ink` on it 4.5 |
| `--on-mid` | light `var(--ink)`; dark `var(--paper)` | text and focus ring on a field | as above |

**The rules, exactly** (after the three `:root` token rules; `--on-mid` goes into those three; `--sea-1` to `--sea-7`
are deleted from them because they move here):

```css
.subs-page { --rank-m: oklch(0.7 0.1 350); --gil-m: oklch(0.7 0.1 80); --loot-m: oklch(0.7 0.1 170); --route-m: oklch(0.7 0.1 260);
  --rank-g: color-mix(in srgb, var(--rank-m) 66%, var(--ink)); --rank-s: color-mix(in srgb, var(--rank-m) 46%, var(--ink)); --rank-w: color-mix(in srgb, var(--rank-m) 14%, var(--slip));
  --gil-g: color-mix(in srgb, var(--gil-m) 66%, var(--ink)); --gil-s: color-mix(in srgb, var(--gil-m) 46%, var(--ink)); --gil-w: color-mix(in srgb, var(--gil-m) 14%, var(--slip));
  --loot-g: color-mix(in srgb, var(--loot-m) 66%, var(--ink)); --loot-s: color-mix(in srgb, var(--loot-m) 46%, var(--ink)); --loot-w: color-mix(in srgb, var(--loot-m) 14%, var(--slip));
  --route-g: color-mix(in srgb, var(--route-m) 66%, var(--ink)); --route-s: color-mix(in srgb, var(--route-m) 46%, var(--ink)); --route-w: color-mix(in srgb, var(--route-m) 14%, var(--slip));
  --gil-bar: color-mix(in srgb, var(--gil-m) 26%, var(--slip));
  --sea-1: oklch(0.7 0.12 250); --sea-2: oklch(0.7 0.13 50); --sea-3: oklch(0.7 0.11 165); --sea-4: oklch(0.7 0.13 0); --sea-5: oklch(0.7 0.12 315); --sea-6: oklch(0.7 0.12 282); --sea-7: oklch(0.7 0.1 215);
  --scr: var(--route-m); --scr-g: color-mix(in srgb, var(--scr) 66%, var(--ink)); --ring: color-mix(in srgb, var(--scr) 45%, var(--ink)); }
@supports (color: oklch(from red 0.7 0.1 calc(h + 90))) { .subs-page { --hue-src: color-mix(in oklab, color-mix(in oklab, var(--seal) 90%, var(--ochre)) 97%, #2f7fd0); --rank-m: oklch(from var(--hue-src) 0.7 0.1 h); --gil-m: oklch(from var(--hue-src) 0.7 0.1 calc(h + 90)); --loot-m: oklch(from var(--hue-src) 0.7 0.1 calc(h + 180)); --route-m: oklch(from var(--hue-src) 0.7 0.1 calc(h + 270)); } }
.subs-page:has(.tabs [data-tab="log"][aria-current="page"]) { --scr: var(--loot-m); }
.subs-page:has(.tabs [data-tab="earn"][aria-current="page"]) { --scr: var(--gil-m); }
.subs-page:has(.tabs [data-tab="setup"][aria-current="page"]) { --scr: var(--rank-m); }
.subs-page:has(.tabs [data-tab="map"][aria-current="page"]) { --scr: var(--sea-1); }
.in-sea-1, [data-map-sea="1"] { --sea: var(--sea-1); }   /* and so on to 7 */
[class*="in-sea-"], [data-map-sea], .map-panel { --sea-g: color-mix(in srgb, var(--sea) 66%, var(--ink)); --sea-s: color-mix(in srgb, var(--sea) 46%, var(--ink)); --sea-w: color-mix(in srgb, var(--sea) 14%, var(--slip)); }
```

The sea hues keep their names: blue 250°, ember 50°, jade 165°, rose 0°, lilac 315°, indigo 282°, ice 215°. `--scr`
is the voice of the screen (Board: route; Log: loot; Earnings: gil; Setup: rank; Map: the first sea's blue). The
`@supports` condition is the exact form used, so an engine that cannot do `calc(h + 90)` there falls back instead of
breaking. Support, from memory and not checked: Chrome and Edge 119, Firefox 128, Safari 16.4 (complete in 18); plain
`oklch()` and `color-mix` are older than those (the module already needs them or `:has`).

**What it yields** (hue angles by hand; the hexes are W22's to print):

| Case | Anchor | rank | gil | loot | route |
| --- | --- | --- | --- | --- | --- |
| Crystarium Dawnglass (the default), light: accent `#b5476b` | about 356° | rose | gold 86°, about `#ba9a51` | teal 176°, about `#4fb39c` | blue-violet 266° |
| Azure Dragoon, dark: accent `#6ea2ff`, second colour near grey | about 261° | azure | rose 351° | gold 81° | teal-green 171° |
| Magitek Steel, light: accent `#0a7cc2` | about 249° | steel blue | magenta-rose 339° | amber 69° | green 159° |

**Guards, and what each yields:**

| Case | Result |
| --- | --- |
| Grey accent ("Black / White" preset, a custom grey) | the hue of the theme's second colour; blue (about 252°) if that is grey too; never a hue that differs between engines |
| Very strong accent (`#ff2424`, `#2ff0e0`) | the voices stay at strength 0.10, calmer than the accent, which remains the loudest colour on the screen |
| Pale accent on a light theme, dark accent on a dark one | lightness is fixed at 0.70 and text tones are mixed into `--ink`: no ratio depends on the accent |
| A voice beside a status hue (Magitek Steel light: loot amber beside Idle, route green beside Back; any blue accent beside Out) | not avoided by hue. Forms keep them apart: the slanted status field, the chip and the chart markers belong to states; a voice is a head, a band, a bar or a plate; a state always carries its word |
| A voice beside a sea hue | a sea colour is used only where a sea is meant, with the sea's name or its sectors' letters beside it |
| Engine without relative colour syntax | fixed hues 350°, 80°, 170°, 260° at the same tones |
| Custom page or text colour | not covered, as in section 8 |

**W22 findings (measured; they replace the hand figures above where they differ).** Model and browser agree (largest
difference 1 per channel in the default theme, 0 in the other two; the check allows 2). The hex values printed by the test
match the hand ones (default rank #d084a1, gil #ba9a51, loot #4fb39c, route #819ddd; the hue angles are 355.8, 85.8, 175.8
and 265.8, not 356, 86, 176, 266). Two rules did not hold as written. (1) The graphic tone at 70% reached 3:1 on `--paper-2`
only to 2.88 (Azure Dragoon light and others); by the change order it went 70, 68 (still 2.99), 66, which holds everywhere,
including the hue sweep; `--X-g`, `--scr-g` and `--sea-g` now use 66%. (2) `--idle` on `--paper-2` is 3.95 to 4.37 in 18 light
themes (Azure Dragoon light lowest), under the 4.5 asked for when `--idle` becomes text in the Log. That is the status
colour's own value (D29, Q9), not a share of the palette, so it is reported in its own test and not changed here. The
sRGB ceiling at lightness 0.70 is strength 0.119 (hue 200), as estimated.

**Chart tokens** (the three `.map-panel` rules): `--chart-bg` light `color-mix(in srgb, var(--ink) 80%, var(--sea))`,
dark `color-mix(in srgb, var(--paper) 80%, var(--sea))`; `--chart-bg-2` light `color-mix(in srgb, var(--ink) 74%,
var(--sea))`, dark as built; `--chart-next: #ffe38a`; new `--chart-back: color-mix(in srgb, var(--sea) 28%,
var(--chart-bg))`, `--chart-link: color-mix(in srgb, var(--chart-ink) 30%, var(--chart-bg))`, `--chart-done:
color-mix(in srgb, var(--chart-found) 50%, var(--chart-bg))`. The rest as built. So each sea's water is visibly its
own colour.

**The test** (`tracker/tests/subs-look.test.js`, with the model in the new `tracker/tests/subs-palette.js`). The model
adds to `colour()`: `oklch(L C H)`, `oklch(from <colour> L C h)` and `… calc(h + N))`, `color-mix(in oklab, …)`; any
other form throws. OKLab by the published matrices (the ones CSS Color 4 uses); first assert that `#ffffff` gives
lightness 1.000 and strength under 0.001, `#ff0000` 0.628 / 0.258 / 29.2° and `#0000ff` 0.452 / 0.313 / 264.1°, to
two decimals. Then, for the 21 themes in both modes, the four voices, the seven seas and the five values of `--scr`,
and for one voice also with its hue forced through 0° to 355° in steps of 5° (this covers every accent, preset and
custom):
- in sRGB: every mid has its three linear channels between -0.001 and 1.001;
- every "must reach" of the table above; `--ink` on `--gil-bar` 4.5; `--route-s` on `--back-bg`, `--out-bg` and
  `--idle-bg` 4.5; `--idle` on `--slip` and on `--paper-2` 4.5 (it becomes text in the Log); `--on-slab` on `--ring`
  4.5;
- the four voice hues differ pairwise by at least 80°;
- the chart: every existing pair with the new values; `--on-mid` on `--sea` 4.5; `--chart-back` on `--chart-bg`
  between 1.15 and 1.6; `--chart-link` on `--chart-bg` between 1.8 and 3; `--chart-done` on `--chart-bg-hi` at least
  2; luminance in the order back, link, far, found, next; next against found at least 1.5:1 and found against far at
  least 1.3:1 (the ladder a colour-blind player reads);
- print, do not assert: `--ink-2` on each wash; each voice's hue and the nearest status hue, per theme.

If a pair fails, change a share, never a hue, in this order, and report the final numbers: a strong tone: 46% down by
2; a graphic tone: 70% down by 2; a wash or bar: down by 2; in sRGB: strength down by 0.005; the chart: first
`--chart-hot`'s accent share from 45% down by 5 to no less than 30%, then the sea's share in the water down by 2,
then `--chart-far`'s ink share.

### R3.5 What each colour means, and the field

| Colour | Means | Never used for |
| --- | --- | --- |
| Accent (`--seal`, molten) | an action, the chosen thing, the best | a category |
| Green, blue, amber, red, neutral (status) | Back and found; Out; Idle, next and "needs your input"; an error; Locked and far | decoration |
| A sea colour | that sea: its tab, chart head, water, sector details, a voyage that went there | anything else |
| rank voice | a submarine's rank and levelling (Leveling Submersible Rank) | |
| gil voice | gil figures and value (Gil Farming) | |
| loot voice | items brought back (Loot Farming) | |
| route voice | routes, sector letters, unlocking (Unlocking Routes) | |
| `--ink` slab | structure with no kind of its own | |

**Field** (D31): set on the element `--slab: var(--X-m); --on-slab: var(--on-mid); --on-slab-2: var(--on-mid)`; where
the built rule gives it a molten band, also `border-image: none; border-bottom-color: var(--ink)`. Secondary text on a
field has the same colour and is quieter by size and weight. A coloured band that must be measured (R3.7) is a real
`border` or `background-color`, not a shadow or a gradient.

### R3.6 The chart, readable

Back to front. Nothing but the planned route is dashed; widths are px (`non-scaling-stroke`, as built).

| Layer | Selector | Colour | Weight and form | Against the water |
| --- | --- | --- | --- | --- |
| Grid, rings, sweep | `.chart-grid`, `.chart-rings circle`, `.chart-sweep-edge` | `--chart-back` only | 1 px (minor grid at `stroke-opacity: .55`); rings all solid; sweep edge 1.5 px; `.chart-sweep-fan { display: none }` | at most 1.6:1 |
| Link from a sector not yet found | `line.closed` | `--chart-link` | 1 px solid, no arrowhead | 1.8 to 3 |
| Link between two found sectors | `line.open.done` | `--chart-done` (dim green) | 1.5 px solid, no arrowhead | at least 2 |
| Link from a found sector to one that can be revealed next | `line.open.lead` | `--chart-next` | 2.5 px solid, arrowhead `.chart-chev.lead` in the same colour | 4.5 |
| The way to an unfound slot or next-sea sector | `line.goal` (declared after the others) | `--chart-ink` | 3 px solid; arrowhead `.chart-chev.goal:not(.lead)` in `--chart-ink` | highest |
| Planned route | `.chart-route`, glow, `.chart-route-dir` | `--chart-hot` | as built: 5 px dashed, marching, 14 px glow, leg arrows | 4.5 |
| Far sector | `.chart-node.far > rect` | fill `--chart-bg`, stroke `--chart-far` 2 px | small hollow square | 3 |
| Found sector | as built | `--chart-found` | filled disc with gap ring and glow | 4.5 |
| Next sector | `.chart-node.next > rect` | fill `--chart-next`, stroke `--chart-bg` 6 px, `paint-order: stroke fill` | filled diamond, halo as built; the lightest mark | 4.5, and 1.5 against found |
| Slot plus, next-sea ring | `.chart-plus`, `.chart-ring2` | `--chart-ink` (the plus was amber) | 3 px and 2 px | |
| Above the submarine's rank | `.chart-overring` | `--chart-far` | 1 px solid (was dashed) | |

`.chart-chev { display: none }` by default; only `lead` and `goal` arrowheads show. Labels, Start, selection brackets,
the on-route ring, focus and hover stay as built. Frozen, as in section 5 and D7: geometry, `viewBox`, `placeTags`,
`C.Y_DOWN`, one `<polyline`, no nested `<g>` in a node, the attribute order of `.chart-letter` and `.chart-tag`, tap
sizes, escaping, and the markup `submarines.test.js` reads (both grid paths, ring classes, the sweep group and fan).

### R3.7 Proof that it is not two or three colours again

**Measure** (a function `families()` in `L1`, run on each screen after its picture):
1. Take every rendered element inside `.subs-main` and `#sheet[open]` (the tab rail is left out), and its `::before`
   and `::after` when they have content.
2. Samples: `background-color` (weight: the element's area in px²); `color` when the element has a text node of its
   own (weight 300); each border 3 px or wider (300); in an SVG, `fill` and `stroke` that are not `none` (300 each).
   Skip a colour whose alpha is under 0.5. Resolve each to sRGB by painting it on a 1 × 1 canvas, then to OKLCH.
3. A sample is coloured when its strength is 0.06 or more. Sort coloured samples by hue; a new family starts when a
   hue is more than 30° from the first hue of the current family (the wheel wraps). A family counts when its weights
   add up to 300 or more.
4. Record per screen and theme: the number of families and each family's mean hue and weight.

**Floors** (asserted in `L1` by the item that owns the screen; hand estimates of today's figures: Log 0, Earnings 1):

| Screen | Default theme, light | Azure Dragoon dark, Magitek Steel light |
| --- | --- | --- |
| Log; Map; planner | 5 | 4 |
| Board; Earnings; Setup; recommendations | 4 | 3 |
| Send window | 3 | 3 |

**Colour test (required self-review, every item from W23).** Read the item's pictures in the three themes (tags
`desktop`, `desktop-azure-dark`, `desktop-magitek-light`) and the phone picture, and report per picture: the hue
families seen, in plain names; what each stands for; any colour that is there for no reason; any two neighbours that
could be mixed up; then one sentence: "varied" or "still two or three colours: <where>". Reported, never hidden.

Colour-blind players: the status word or the marker's shape, the chart's lightness ladder (asserted in the test), the
words "nothing logged" in the Log, and a name beside every sea colour.

### R3.8 Work items

Order: W22, W23, W24, W25, W26, W27, W28, W29, W30. One builder at a time. Each item is committable on its own and,
as in section 6: a branch; only the named files; `npm run build` and commit the rebuilt files (only
`tracker/command-center/site/submersibles/{subs.css,subs.js,chart.js}` and `site/sw.js` may change); `npm run
test:unit` and `npm run check`; report what was run and what was not; never merge or push to `main`. Every item's
acceptance includes: C25 `fit.maxBottom` unchanged from before the item; C20, C24, C28, C82 pass; the contrast test
passes and its table is in the hand-back; the item's floors of R3.7 hold; the colour test is in the hand-back.

#### W22. Palette, model, palette sheet (Sonnet builder; first)
- Files: `src/submersibles/subs.css` (token rules only); new `tracker/tests/subs-palette.js`;
  `tracker/tests/subs-look.test.js`; `tracker/command-center/check.js` (`L1` only).
- Steps: (1) Before any edit: search `shared.css`, `shell.css` and `subs.css` for the token names of R3.4 (none may
  exist); read `src/submersibles/index.html` and confirm the five tab buttons carry `data-tab` `board`, `log`, `map`,
  `earn`, `setup` inside `body.subs-page`. (2) `subs.css`: the R3.4 rules and `--on-mid`; no other rule changes (the
  chart tokens are W23's). (3) `subs-palette.js`: move the helpers of `subs-look.test.js` into it and extend them as
  R3.4 says; export also `palette(row, mode)`, every R3.4 token as sRGB bytes. (4) The test: R3.4's list except the
  chart lines that need W23's tokens; print the three themes' palettes as hex. (5) `L1`: `walk` gains a mode
  argument (`[data-look=mode][data-v=<mode>]`, as C28 picks a theme); the Azure Dragoon dark walk covers all eight
  screens (same tag), a new Magitek Steel light walk covers all eight (tag `desktop-magitek-light`); in each of the
  three desktop walks inject a temporary overlay (made and removed by the check; nothing ships) that shows every R3.4
  token as a named swatch, fields with sample text in `--on-mid`, take `look-palette-<tag>.png`, read each swatch's
  computed colour through a 1 × 1 canvas and assert it equals `palette()` within 2 per channel; record
  `CSS.supports('color', 'oklch(from red 0.7 0.1 calc(h + 90))')`. Extend the seed: four more voyages, two on a route
  in sea 2 and two in sea 5 (sector ids looked up in the data file and written as constants), one of each pair with
  `items: []`. Add `families()` and record it for every screen; assert nothing yet.
- Must not change: any look rule; the other blocks of `check.js`; `package.json`.
- Evidence: the three `look-palette-*.png`; every `look-*.png` regenerates (the sea colours move slightly).
- Acceptance: as above; the browser equals the model in the three themes; the recorded family counts are in the
  hand-back as the "before" figures.
- Self-review: Read the three palette sheets; name the four voices and seven seas per theme; say which two swatches
  are hardest to tell apart.
- Escalate if: the support check is false in Chromium; the browser and the model differ by more than 2; a mid is out
  of sRGB at strength 0.10; a pair still fails at 36% strong or 60% graphic; a token name is taken; the tab names
  differ; the `L1` run grows by more than two minutes.

#### W23. The chart (Sonnet builder; needs W22)
- Files: `src/submersibles/chart.js`; `subs.css` (chart rules, the chart tokens of R3.4);
  `tracker/tests/submarines.test.js` (append only); `tracker/tests/subs-look.test.js`; `check.js` (`L1`).
- `chart.js`, in `C.svg` only: `var byOf = {}; view.lines.forEach(function (l) { byOf[l.to] = l.from; });` then
  `var goal = {};` and, for every node with `slot` or `opens` whose state is not `found`: walk `id = n.id; while (id
  != null && at[id] && at[id].state !== 'found' && i++ < 64) { goal[id] = true; id = byOf[id]; }`. A link's classes
  become: `open` or `closed` as today; then ` done` when both ends are found; ` lead` when only its `from` end is
  found; ` goal` when `goal[l.to]`. Each chevron gets the same extra classes after `chart-chev open|closed`. Nothing
  else: no element added, removed or reordered.
- CSS: R3.6, every row. Remove every `stroke-dasharray` but the route's.
- Tests to add: every line has exactly one of `open` and `closed`; `done` and `lead` only with `open`, never both;
  for one sea and a found list that leaves a slot sector unfound, the `goal` links equal the chain walked
  independently over the data's unlock links; with every sector found there is no `goal` and no `lead`; `C.svg`
  called twice gives the same string. The chart lines of R3.4's test list.
- `L1`, on the Map screen: no element of `.chart-svg` other than `.chart-route` has a computed `stroke-dasharray`
  other than `none`; computed stroke widths: grid and rings at most 1, `lead` at least 2.5, `goal` at least 3, route
  at least 5; at least one `goal` line and one `lead` line are drawn (else change the seed's found list and say so);
  the Map and planner floors.
- Must not change: `C.view`, `placeTags`, `hitRadii`, node groups, the texts, every `aria-label`, existing tests.
- Evidence: `look-map-*`, `look-planner-*`, `submersibles-map.png`, `submersibles-planner.png`.
- Self-review: the colour test, and three questions per map picture: can you follow which sector reveals which; do
  you see at once what can be revealed next and where the next slot is; is the planned route the first thing seen.
- Escalate if: an existing chart test would have to change; C82 moves; the ladder cannot hold in some theme after
  the R3.4 order of changes; the water of two seas cannot be told apart.

#### W24. Map tab and sector details (Sonnet builder; needs W23)
- Files: `subs.css`; `subs.js` in `mapHtml` (the `next` swatch becomes filled: `fill="currentColor"`, no stroke; the
  `far` swatch hollow: `fill="none" stroke="currentColor" stroke-width="2"`) and `sectorDetails` (the state line
  becomes `<p class="muted st-found|st-next|st-far">` from `node.state`); `check.js` (`L1` floors only).
- Rules: sea tab (`.map-seas .btn[data-map-sea]`): `border-left: 10px solid var(--sea); padding-left: 6px`; bar track
  `var(--rule)`, fill `var(--sea-g)`; pressed: a field in `--sea` with `border-color: var(--ink)`, track
  `color-mix(in srgb, var(--on-mid) 25%, var(--sea))`, fill `var(--on-mid)`. `.map-panel > h2:first-child`: ink slab,
  `border-image: none; border-bottom-color: var(--sea)`. `.chart-head`: `background: var(--sea); border-bottom: 6px
  solid var(--ink)`, name and count `--on-mid`. `.chart-details h3`: a field in `--sea`. State line: `border-left:
  12px solid; padding-left: 10px`, colour `--back` for `st-found`, `--idle` for `st-next`, `--ink-2` for `st-far`.
  `.chart-facts dd:nth-of-type(1)`: `--rank-s`; the sixth and seventh: `--route-s`. `.chart-details .rates-tier >
  summary::before`: `background: var(--loot-m); color: var(--on-mid)`; `.chart-details .rate-item b`: `--loot-s`.
  `.map-grid > .planner`: `border-left: 10px solid var(--sea-g)`; `.planner .route-line b`: `--route-s`.
- Must not change: section 5 (the sea button's text, "slot 2", "Rank needed", the keyboard path); the legend's words.
- Evidence: `look-map-*`, `look-map-tiers-*`, `look-planner-*`.
- Escalate if: a sea tab grows or wraps differently at 360 px; C82 or C84 changes; `sectorDetails` needs more.

#### W25. Screen voice, tab rail and the Log (Sonnet builder; needs W22)
- Files: `subs.css`; `subs.js` in `logHtml` only; `check.js` (`L1` floors only).
- Screen voice: `.panel:not(.welcome):not(.empty-state):not(.recs):not(.map-panel) > h2:first-child` and `.wiz-head`:
  a field in `--scr`. Section hatches (`.recs h3::after`, `.wide-panel > h3::after`) and `.panel h4`'s underline:
  `--scr-g`. Rail: the current tab is a field in `--scr`, its edge `::before` `--ink`; the other tabs' icons take
  `--route-g` (Board), `--loot-g` (Log), `color-mix(in srgb, var(--sea-1) 66%, var(--ink))` (Map), `--gil-g`
  (Earnings), `--rank-g` (Setup); labels as built.
- `logHtml`: work out each row's value before building the rows; on `.log-row` add `in-sea-<id>` (the sea of the
  route's first sector, when there is a route), `logged` or `unlogged` (from the value's `logged`), and on logged rows
  `style="--p:<its gil ÷ the largest gil among the rows shown>"`, three decimals, 0 when the largest is 0.
- Log rules: `.log-row[class*="in-sea-"] .log-when`: a field in `--sea` (rows with no route keep the ink slab; hover
  as built). Even rows `background: var(--paper-2)` with `.muted` in `--ink`. `.log-row.logged`: `border-right: 8px
  solid var(--loot-g)`; `.log-row.unlogged`: `border-right: 8px dashed var(--idle)` and its "nothing logged" words in
  `--idle`, 700. `.log-what b`: `--gil-s`; under it on logged rows a heat line, `.log-what::after`: `display: block;
  height: 4px; margin: 4px 0 0 auto; width: max(4px, calc(var(--p) * 100%)); background: var(--gil-g)`. Phone: the
  same, the time strip in the sea's colour.
- Must not change: any text, the order, `.log-row[data-trip]`, the row height at 360 px (`L1` measures it).
- Evidence: `look-log-*`; also `look-earnings-*` and `look-setup-*` (their heads change here).
- Escalate if: the border makes a row wrap at 360 px; `logHtml` needs any other edit; a head's first child is not its
  `h2`.

#### W26. Earnings (Sonnet builder; needs W25)
- Files: `subs.css`; `subs.js` in `earnHtml` only (add `in-sea-<id>` to each `tr[data-pos]` and each `.earn-thin`
  body row, from the route's first sector); `check.js` (`L1` floor only).
- Rules: `.earn-card:first-child`: a field in `--gil-m`; the other cards' figures `--gil-s`, their top band
  `background-image: linear-gradient(var(--gil-g), var(--gil-g))`. Bars (ranked gil per hour, by free company):
  `--gil-bar` in place of `--bar`, figures `--ink`. Route cells (second cell of a ranked row, first of a thin row):
  `600 var(--f-data)`, `--route-s`, `border-left: 6px solid var(--sea-g)`. "Top items": first cell `--loot-s`, 700,
  `border-left: 6px solid var(--loot-g)`; third cell `--gil-s`. Position blocks, the thin rows' hazard edge and the
  phone layout as built.
- Must not change: any figure or text; `.earn-card b` (four, in order); the first `.earn-t` row; `tr[data-pos]`.
- Evidence: `look-earnings-*`, `look-earnings-ranked-*`.
- Escalate if: a table no longer fits at 360 px; C22 or C78 reads a changed cell.

#### W27. Board and send window (Sonnet builder; needs W25)
- Files: `subs.css`; `subs.js` in `pickerHtml` only (class `in-sea-<PICK.sea>` on `.route-pick`); `check.js` (`L1`
  floors only).
- Board, colour only, no size: the rank plate (`.sub[data-sub] .sub-meta > span:first-child`): a field in `--rank-m`;
  `.sub-meta .route`: `--route-s`. Strip, card heads, status fields, `.quick` as built.
- Send window: `.sector`: `border-left: 8px solid var(--sea-g); padding-left: 4px` (the same 12 px inset as today);
  `.sector:not(.on) b`: `--route-s`. `.route-line`: `border-left: 8px solid var(--route-g); padding-left: 10px`; its
  `b` `--route-s`. `.loot-h`: a label block, `background: var(--loot-m); color: var(--on-mid); padding: 2px 10px`,
  its hatch `--loot-g`; `.rate-item b`: `--loot-s`. `.rankbox`: `border-left: 8px solid var(--rank-g); padding-left:
  10px`. `.advice` and the sheet's head as built.
- Must not change: C25 by a single pixel; `.sectors` wider than 300 px; `#sheet .btn.primary` order.
- Evidence: `look-board-*`, `look-sheet-*`, `look-sheet-route-*`, `submersibles-board.png`, `-desktop.png`.
- Escalate if: C25 moves; C22's `pickerFull` or any of C21 to C23, C78 to C81, C85 to C88 changes.

#### W28. Setup, recommendations, empty states (Sonnet builder; needs W25)
- Files: `subs.css`; `subs.js` in `wizardHtml` only (class `in-sea-<sea.id>` on each `<details class="sea">`);
  `check.js` (`L1` floors only).
- Recommendations: `.panel.recs > h2:first-child`: ink slab with `border-image: linear-gradient(90deg,
  var(--route-m) 0 25%, var(--rank-m) 25% 50%, var(--gil-m) 50% 75%, var(--loot-m) 75%) 1`. Number block
  (`.rec-name b`), by objective and whatever its position: a field in `--route-m` for `li:has([data-rec="up-unlock"])`,
  `--rank-m` for `up-level`, `--gil-m` for `up-gil`, `--loot-m` for `up-loot`. First row: the `--hi` wash as built and
  `border-left: 8px solid var(--seal)`. The second section label ("Loot Farming") and each `.rec-picker`: `--loot-s`
  text on the label, `border-left: 8px solid var(--loot-g)` on the picker; a switched-off picker
  (`:has(.rec-find:disabled)`): `border-left-color: var(--ink-3)`.
- Setup: `.sea[class*="in-sea-"]`: `border-left: 10px solid var(--sea-g)`; its open summary a field in `--sea`;
  `.tick b`: `--route-s`. `.dot`, `.fc-list` and the fields as built (the wizard's head is W25's).
- Empty states (`.panel.welcome`, `.panel.empty-state`): ink slab as built, the rings in `var(--ring)` in place of
  the 10% tint.
- Must not change: what the buttons, slider and pickers do; `[data-rec]`, `[data-rec-find]`, `.rec-picker`.
- Evidence: `look-setup-*`, `look-recommendations-*`, `submersibles-recommendations.png`.
- Escalate if: a recommendations check reads a style; `wizardHtml` needs more than the class; text on the rings is
  hard to read in a picture.

#### W29. Final pass (Sonnet builder; needs W23 to W28)
- Files: `subs.css`; `check.js` (`L1`).
- Steps: every floor of R3.7 asserted; walk the eight screens at 360 × 800 in light and dark and in the three themes
  on the desktop; fix any text under its ratio that the test does not model (text over a band, a hover, a focus
  ring), any clipped band; reduced motion still stops every loop. Run the colour test and the bold test over all
  pictures and list every "still two or three colours" and "still tame".
- Acceptance: `npm run build`, `npm run test:unit`, `npm run test:browser`, `npm run check` pass; the hand-back
  lists C25 `maxBottom`, C82 `hitMin`, the family counts per screen and theme, and the contrast table.
- Escalate if: a floor is missed because two roles share a 30° family in that theme: report the hues; do not lower a
  floor or move a hue.

#### W30. Records (Haiku clerk; needs W29)
- Files: `docs/STATE.md` (one entry naming Revision 3 and the `L1` measure), `tracker/command-center/README.md` (the
  new `look-*` picture names). Acceptance: `git diff --stat` shows only those two files.

### R3.9 Risks, and the first thing to verify

- **First:** this file was rewritten whole to append this section. `git diff --numstat
  docs/submersibles-look-spec.md` must show additions only. Then W22's cross-check: Chromium supports the exact
  `@supports` form, and the browser's palette equals the model in the three themes. Until then every hue, hex and
  ratio in this revision is hand arithmetic.
- Relative colour syntax in WebKit and Firefox was not checked here; old Safari gets the fixed-hue fallback. `L1`
  records the support check in every engine it runs.
- At strength 0.10 the voices are jewel tones, not neon. If the owner finds them too quiet, the remedy is Q8's
  strongest option, not a number here: 0.10 is the ceiling that stays inside sRGB for every hue.
- A voice can land beside a status or sea hue (R3.4's guard table). Magitek Steel light is the test case; the colour
  test asks for any two neighbours that could be mixed up.
- The family count is sensitive near its 30° edges and to the seed. A missed floor is reported with the hues.
- On dark themes fields are light blocks, like slabs (R6). The Log's time cells and the heads will be bright.
- The sea colours change slightly in W22 (new values); every picture with a sea bar or the chart moves.
- The link colours are learned from the markers they join; no words explain them unless Q11 is answered yes.
- The risks of section 8 and R6 stand (parallel work on the same files, custom colours, the unverified orientation).

### R3.10 Owner questions

Q1 to Q7 stand as written. Four more:

**Q8. How far the new colours may go from the chosen theme.**
- Four colours spaced evenly around the colour wheel, starting from your theme's accent, all at one calm strength
  (what this revision builds). Strong contrast between them; the theme decides which four. Cost: none extra. Risk: in
  some themes one of them sits close to a status colour (green, amber, blue).
- Calmer: the accent's two neighbours and its opposite. Closer to the theme, less contrast; one line changes. Risk:
  it may read as "three colours" again.
- Only the theme's own two colours plus the status colours. Closest to the theme; in two themes the second colour is
  grey. Risk: the complaint stays.
- Stronger still: every colour as vivid as a screen can show. Cost: the palette moves into the code shared with the
  Tracker and the Atelier, which are then rebuilt and republished; one more item. Risk: a fault there touches every
  module.
- Keep things as they are: no new colours.
- Recommendation: the first. Fairly sure; the fourth can follow once you have seen the first.

**Q9. The status colours (green, blue, amber, red).**
- Exactly the same in every theme (what is built today and kept here). Always recognisable. Risk: in a few themes
  they stand apart from the theme.
- Tinted a little toward each theme's text colour. Slightly calmer; twelve checked colour pairs are checked again.
  Cost: one small item. Risk: low; the change is subtle.
- Recommendation: keep them exactly the same (this is also "keep things as they are"). Fairly sure.

**Q10. The voyage grade in the Log.** The grade you note on a return (C to SS) is stored but not shown in the Log.
- Show it as a small coloured chip on the row. New words on the screen. Cost: one small item.
- Keep things as they are: the Log does not show it.
- Recommendation: show it, after this revision is accepted. Moderately sure.

**Q11. Words for the new line colours on the chart.** The chart's legend text is not changed by this revision.
- Add one clause to the legend: "bright line: the way to the next slot or sea · amber arrow: can be revealed now".
  Cost: one sentence, in the next item that touches the Map. Risk: none.
- Keep things as they are: the lines are understood from the markers they join.
- Recommendation: add the clause. Fairly sure.

### W22b decisions (orchestrator, 2026-11-18): a vivid palette

The first palette sheet showed dusty pastels: voices at lightness 0.70 and strength 0.10 (#d084a1, #ba9a51, #4fb39c,
#819ddd in the default theme) with graphic and strong tones made muddy by mixing into the ink (#8e627b, #674e65).
The status colours and the accent beside them are far more saturated. The owner asked for "A LOT of contrast between
colors while maintaining the same vibe of the chosen theme". These decisions override R3's fixed strength and its
mixing rule; hues stay as R3 derives them.

1. **Chroma at the edge of the gamut.** For every palette colour (the four voices and the seven sea hues, in every
   tone) the chroma is `min(CAP, 0.94 x the largest chroma inside sRGB at that hue and lightness)`. `CAP` is one named
   constant, starting at 0.21. Yardstick: a voice field looks as saturated as the Back or Out field beside it.
2. **Tones by lightness, not by mixing with ink.** `-m` (field): lightness 0.70 in light themes; in dark themes the
   value chosen by the same contrast rule against the page, so fields glow. `-g` (bands, bars, borders): the lightness,
   searched, at which the colour just clears 3.1:1 against the worst of `--slip`, `--paper`, `--paper-2` of that theme
   and mode, with gamut-edge chroma. `-s` (coloured text): the same search for 4.6:1. `-w` (wash under ink text):
   visibly coloured, with ink text at 7:1 or better. `--on-mid`: the theme's ink, or black or white, whichever gives at
   least 4.6:1 on every `-m` field.
3. **Computed in JavaScript by the page, CSS as fallback.** One plain script, loaded by both the page and the tests
   (no second model): `tracker/command-center/src/submersibles/palette.js`, exposing a pure
   `PALETTE.compute(themeValues)` that returns every token, and an applier that reads the theme's colours from the
   root's computed style, sets the tokens as inline custom properties on the module's page element, and re-applies
   when the theme or mode changes. The tokens already in `subs.css` stay as the fallback. Nothing is stored;
   `save.js`, `applyLook()` and every shared file stay untouched.
4. **Keep apart what must not be confused.** Where a voice lands within 20 degrees of hue of a status colour that can
   share a screen with it (loot against Idle, route against Back or Out), that voice is nudged away to 20 degrees
   (one named constant), the others kept as evenly spaced as possible.
5. **Status colours used as text.** `--idle` as text on `--paper-2` is 3.95 to 4.37:1 in 18 light themes. The field
   colours do not change. Each status colour that is used as text gets a text tone (`--idle-s`, and likewise for any
   other under 4.5:1 anywhere), found by the same lightness search at that status hue, and the CSS uses it wherever a
   status colour is a text colour.
6. **The contrast test** uses the shared script and asserts, in all 21 themes and both modes: every `-s` at 4.5:1 and
   every `-g` at 3:1 on the three page colours; `--on-mid` on every `-m`; ink on every `-w` at 7:1; every colour
   inside sRGB; the four voices pairwise at least 60 degrees apart after the nudge; chroma of every `-m` at least
   0.11; the status text tones at 4.5:1. The browser's computed tokens are compared with the model on the built site
   for the default theme, Azure Dragoon dark and Magitek Steel light (tolerance 2 per channel).
7. The three palette sheets are regenerated: voices in all tones, status colours with their text tones, the seven
   seas, text samples.

#### W22b as built (builder, 2026-11-18)

Built by `tracker/command-center/src/submersibles/palette.js` (one script, loaded by the page before `subs.js` and by the tests through
`tracker/tests/subs-palette.js`, which is now only a loader plus the reader of the fallback tokens in `subs.css`). Figures are measured by
`tracker/tests/subs-look.test.js`; these replace the R3.4 figures wherever they differ, and the R3.4 hand figures (lightness 0.70, strength
0.10, mixing into the ink) now describe only the fallback in `subs.css`.
- Constants: `CAP` 0.21 (never reached: the gamut edge at these lightnesses is lower); `EDGE` 0.94; field lightness 0.70 in light themes and
  0.74 in dark ones (`FIELD_L_DARK`; the 7:1 against the page rule of point 2 is met by both; at 0.74 the smallest field chroma over all hues is 0.119; at 0.78 it
  falls to 0.106, under the 0.11 asked for); graphic tone 3.1:1 and strong tone 4.6:1 (asked), washes 0.90 (light) or 0.30 (dark) lowered
  until ink reaches 7.2:1; `NUDGE` 20 degrees. Tokens per voice: `-m -g -s -w` and `-ring` (the rings of an empty-state slab, text in the
  page colour at 4.6:1); per sea: `--sea-N`, `-g`, `-s`, `-w`, and `--sea-1-ring`; `--gil-bar`; `--on-mid` (ink, page colour, black or
  white, first that reaches 4.6 on every field); `--back-s`, `--out-s`, `--idle-s`, `--bad-s` (the status colour itself when it clears 4.6 on
  all three page colours, else the same hue and chroma at the lightness that does). `subs.css` uses `--back-s` and `--bad-s` for the three text
  rules that used a status colour as text; `--idle` is not used as text yet (the Log item will use `--idle-s`).
- The per-sea tones are now per-sea tokens (`--sea-1-g` ... `--sea-7-w`) that `.in-sea-N` and `[data-map-sea="N"]` pick; the old mixing rule
  on `--sea` is gone. `--scr`, `--scr-g` and `--ring` are set per screen from the voice tokens.
- Nudge: all four status colours are avoided (not only Idle, Back and Out), by the nearest hue 20 degrees clear of all of them, searched so
  that the four gaps stay closest to 90 and no two voices are closer than 60 degrees; if that fails the voices may move together by up to 50
  degrees (Twelveswood Verdure light needs this; the hue sweep over every accent hue also keeps all gaps at 60 or more). The page learns of a theme change from a `MutationObserver` on the root's
  `style` and `data-theme` attributes (look.js sets both in every `applyLook()`), and does nothing when the colours read are unchanged.
- The earlier W22 finding on `--idle` as text is closed by `--idle-s`; the test for the raw `--idle` colour is replaced by the tone test.

## Revision 4: roles and the timeline

Appended 2026-11-19. Everything above is unchanged; it records what W0 to W30, the W22b palette and the gaps work
built. Where this section and the earlier ones disagree, this section wins. Its parts are numbered Rev4.1 to Rev4.10
(R4 is Revision 2's kit). A builder of W31 onward reads section 5, R1, R4, then Rev4.3 to Rev4.7 and its own item.

Why: the owner looked at the Revision 3 screens and said: "I still think they look AI bland-ish but better than
before. I still think you can do a hell of a lot better … think outside the box to make it pop while also making sure
it is completely useable." On empty screens: "it bothers me tremendously. They should be in harmony with the chosen
theme." On colour: "is there a way that you can divide where coloring goes on each visual screen, see how many colors
and tones are needed to populate everything and then you just have a list with all the colors for each section
described earlier for each theme as for coloring to be consistent between themes because I feel like it is not at the
moment." The owner then approved two drawn designs, the Board as a fleet timeline and the empty Board: "yes to both,
build it across the whole module, making sure it respects the coloring for the themes."

Read for this revision: `CLAUDE.md`; this spec; the brief with the owner's words and the orchestrator's four
decisions; the two mock-ups (`Main.dc.html`, `Empty.dc.html`; drawings, not app code); `subs.css`, `palette.js` and
`index.html` whole; in `subs.js` every function that writes markup (`render`, `strip`, `subRow`, `lockedRow`, `fcCard`,
`boardHtml`, `accuracyHtml`, `notifyHtml`, the recommendations functions, `setupHtml`, `shownPanelHtml`, `wizardHtml`,
`adviceHtml`, `pickerHtml`, `discoveryHtml`, `lootHtml`, `logHtml`, `sectorDetails`, `plannerHtml`, `mapHtml`,
`tripSheet`, `earnHtml`, `openSub`, `sendSheet`, `sendAllSheet`, `tick`); `tracker/tests/subs-look.test.js` and
`subs-palette.js` whole; C25, C97, the lines of the hidden-company check that read the strip, and block `L1` of
`check.js`; three rows of `THEMES`. By search: `chart.js` and `subs.js` hold no colour literal; `build.js` copies the
module's files from a list; no check or test asserts the welcome and empty texts; `test:unit` in `package.json`. Not
read: `advisor.js`, `recs.js`, `earn.js`, `drops.js`, `fleet.js`, `push.js`, the rest of `chart.js`, `shared.css`,
`shell.css`, the body of `applyLook()` (its tokens as section 2.1 and the test loader give them), `docs/STATE.md`,
`evidence/checks.json`. Nothing was built or run and no picture was viewed. Every hue, gap, height and count below is
hand arithmetic; W31's tests and the generated list are the authority.

### Rev4.1 Goal and constraints

- **Colour by role.** Every colour on every screen is one tone of one named role. The same role is the same kind of
  colour in all 21 themes, light and dark. The theme owns the page, the panels, the text, the slab, the accent and the
  gradient: that is what makes it recognisable.
- **Layouts.** The Board becomes a fleet timeline; every screen and panel that can be empty uses one empty-state
  pattern; each other screen gets one organising idea that makes it easier to use.
- This revision is not "look only": it adds markup, and words and figures that are counts, sums or ratios of figures
  already on the same screen, or times the app already holds. Each is named in its item (Q13). No behaviour, save or
  data changes; nothing is automated; no number is invented; no game artwork; no new external resource.
- Must hold: section 5 (texts change only where an item gives the exact new text), R1's list, the frozen chart rules
  (D7, R3.6), all 21 themes in both modes, the contrast test as the authority, R3.7's floors in `L1`, C25 (limit
  1,080; target 1,000 or less), C97, no sideways scroll at 360 px, both reduced-motion rules, visible keyboard focus,
  targets of 36 px (40 px up to 700 px; the action on a compact lane 26 px, as built).
- Not edited: `advisor.js`, `recs.js`, `earn.js`, `drops.js`, `fleet.js`, `push.js`, `save.js`, `shared.css`,
  `shell.css`, `atelier.js`, the data file. `subs.js` is edited only in the functions an item names.
- Built files that may change: `tracker/command-center/site/submersibles/{index.html,subs.css,subs.js,chart.js,
  palette.js,timeline.js}` and `site/sw.js`. Anything else changed means stop.

### Rev4.2 Findings

- **Why a role changes colour today.** `palette.js` puts the four voices a quarter turn apart from the theme's accent
  and then moves them 20° clear of the status colours. So gil is gold in the default theme and rose in Azure Dragoon
  dark (R3.4's table). The mock-ups show the same: rank pink and route blue in one theme, rank blue and route teal in
  the other.
- **Hues already fixed** (OKLCH, worked out by hand from the hex values; light / dark where they differ): Back 153 /
  156, Out 267 / 273, Idle 67 / 78, error 29 / 26; seas 250, 50, 165, 0, 315, 282, 215; on the chart found 156, next
  `#ffe38a` 93, planned route `#ff6ec7` 345, cannot-add 26. Two seas already sit beside a status: jade and Back (9 to
  12° apart), indigo and Out (9 to 15°).
- **Colours outside the token rules in `subs.css`:** `rgba(0, 0, 0, .6)` on `.sheet::backdrop`; three mixes of two
  tokens inside ordinary rules (`.sub-meta .route`, `--ringc`, the track of a pressed sea tab); `#2f7fd0` in the
  `@supports` rule; `--chart-no` in a rule of its own.
- **Tokens no rule uses** (by reading; W31 confirms by search): `--gil-bar`, `--chart-line`. `--bar` is used by one
  rule that a later rule with the same selector overrides.
- **What the checks read on the Board:** the text of `.strip-next`; the text of `.strip-back`, exactly "N back now";
  the text of `.quick`; the centre of `.sub-top`; `.fc` in four columns at 1,920 px and two at 1,024 px; 31
  `.fc.wide .sub` in status order; C97: on a dense Board the gauge is 3 px high, inside its row, and the row is as
  tall without it.
- **C25 today is 1,052** (the brief). Hand reconstruction, not measured: the fleet starts near 169 px, a card head is
  near 56 px and a dense row near 88 px because its last line wraps (169 + 2 × 441.5 = 1,052).
- **The mock-ups, read closely.** The track mixes two scales (the marker is placed by time, the fill by share done).
  Discs spread along the track suggest when each sector is reached, which the app does not know. The sonar scope has
  five square blips: the chart's "further away" marker at made-up places. The route colour is a sky blue between Out's
  blue and the first sea's blue. Labels use a 700 weight of the display face, which the app does not ship (900 only).

### Rev4.3 Decisions (alternatives rejected in brackets)

- **D37 Colour is given out by role:** 27 roles with 102 tones (Rev4.4). A colour token is a tone of one role, or an
  alias that points at one by context. [A palette per screen: the inconsistency the owner named.]
- **D38 A meaning role has one hue in every theme, with no hue tint at all.** The theme reaches it through lightness
  and chroma only (Rev4.5). [A lean of a few degrees toward the accent: invisible at 4°; at 10° it eats the 20° floors
  and the list no longer shows one hue per role.]
- **D39 The four hues: rank azure 232°, gil gold 100°, loot teal 188°, route pink 340°.** [The mock-up's route blue,
  245°: 5° from the first sea and 22° from Out. Rank pink with route azure: pink would mean rank on the pages and the
  planned route on the chart.] Q12.
- **D40 The route role and the chart's planned route are one hue family** (340° and 345°). The chart keeps its tested
  hex values.
- **D41 Status, error, sea and chart colours keep their values.** [Moving jade and indigo away from Back and Out: the
  chart's water and its tests reopen; Q14.]
- **D42 Where hue cannot keep two things apart, form does** (the rules of Rev4.5).
- **D43 The list of colours is generated,** by one tool, into one document, and a test fails when they differ. The map
  of zones is data inside the tool and is checked against `subs.css`. [A table kept by hand in this spec: it drifts.]
- **D44 No raw colour outside the token rules;** a mix of two tokens inside a rule becomes a token or goes.
- **D45 On a lane only the bar and the marker are placed by time.** The route's discs sit on a row of their own, in
  route order, at a fixed pitch. [Discs along the bar, as drawn: they would claim a time for each sector.]
- **D46 The voyage gauge stays the share of the voyage done,** the same element, hooks and words, and moves under the
  countdown. [Filling the track by share done, as drawn: two scales on one line.]
- **D47 The axis starts at now and runs for the smallest of 12, 24, 48, 72 or 96 hours that holds every return shown
  or suggested;** 48 hours when there is none; a later return runs off the end. [A fixed 48 hours: short fleets bunch
  at the left, long voyages fall off. A logarithmic axis: the ticks stop meaning anything.]
- **D48 Three lane forms, chosen by the lane's own width;** one column up to four companies, and from five companies
  two columns from 701 px and four from 1,400 px. [One long timeline for eight companies: 32 lanes do not fit 1,080 px,
  and C25 asserts four columns.]
- **D49 The timeline's arithmetic lives in a new pure file, `timeline.js`,** loaded by the page and by a unit test.
  [Inside `subs.js`: a unit test cannot load it.]
- **D50 One empty-state pattern in two sizes** (Rev4.7). The scope is decoration drawn in the role colours and hidden
  from screen readers; the five blips are not drawn. [Blips: a sector marker at an invented place.]
- **D51 A route is drawn the same way on every screen:** its lettered discs in sea colours beside its text. One helper.
- **D52 Rev 3's anchor, nudge, `@supports` rule and ring tokens are retired.** R3.7's measure and floors stay.

### Rev4.4 The roles

**Tones.** `field`: a solid ground that carries text. `on`: the text on that field. `graphic`: bands, bars, borders
and marks (3:1 on the page colours). `text`: coloured text (4.5:1 on the page colours). `wash`: a tint under ink text
(7:1).

**The role list** (27 roles, 102 tones; every existing token is named once here; `new` marks a token W31 or W33 adds):

| # | Role | Stands for | Tokens (tone) | Tones |
| --- | --- | --- | --- | --- |
| 1 | page | the ground of the screen | `--paper`, `--paper-2` (alternate row, hover), `--paper-3` (trough) (fields) | 3 |
| 2 | panel | a raised surface | `--slip` (field) | 1 |
| 3 | ink | reading text, edges | `--ink` (text, 2 px edge), `--ink-2` (secondary text), `--ink-3` (disabled, decoration) | 3 |
| 4 | line | hairlines and texture | `--rule`, `--grid` (graphic) | 2 |
| 5 | slab | structure with no kind of its own | `--slab` (field), `--on-slab`, `--on-slab-2` (on) | 3 |
| 6 | accent | an action, the chosen thing, the best, focus | `--seal` (field), `--on-seal` (on), `--hi`, `--hi-slip` (wash) | 4 |
| 7 | molten | the family's gradient | `--molten` (band), `--glow` | 2 |
| 8 | overlay | shade over anything | `--shadow`, `--sweep`, `--scrim` (new) | 3 |
| 9 | deep water | the dark panel of an empty state | `--deep`, `--deep-2` (fields), `--on-deep` (on), `--deep-line` (graphic) (all new) | 4 |
| 10 | rank | a submarine's rank and levelling | `--rank-m` (field), `--rank-g` (graphic), `--rank-s` (text), `--rank-w` (wash) | 4 |
| 11 | gil | gil and value | `--gil-m`, `--gil-g`, `--gil-s`, `--gil-w` | 4 |
| 12 | loot | items brought back | `--loot-m`, `--loot-g`, `--loot-s`, `--loot-w` | 4 |
| 13 | route | routes, sector letters, unlocking | `--route-m`, `--route-g`, `--route-s`, `--route-w`; on the chart `--chart-hot` (graphic), `--chart-hot-text` (text), `--chart-glow` | 7 |
| 14 | back | Back: needs the player; found | `--back` (field), `--on-back` (on), `--back-s` (text), `--back-bg` (wash); on the chart `--chart-found`, `--chart-done` | 6 |
| 15 | out | Out: at sea | `--out`, `--on-out`, `--out-s`, `--out-bg` | 4 |
| 16 | idle | Idle: not sent; can be revealed next; not logged | `--idle`, `--on-idle`, `--idle-s`, `--idle-bg`; on the chart `--chart-next` | 5 |
| 17 | locked | Locked; further away | `--locked` (graphic); on the chart `--chart-far` | 2 |
| 18 | error | something is wrong; cannot be added | `--bad` (graphic), `--bad-s` (text); on the chart `--chart-no` | 3 |
| 19 to 25 | sea 1 to sea 7 | that sea and nothing else | `--sea-N` (field), `--sea-N-g` (graphic), `--sea-N-s` (text), `--sea-N-w` (wash) | 28 |
| 26 | water | the chart's ground, one per sea | `--chart-bg`, `--chart-bg-2`, `--chart-bg-hi` (fields), `--chart-back` (graphic) | 4 |
| 27 | chart ink | neutral marks on the water | `--chart-ink`, `--chart-ink-2`, `--chart-ink-step`, `--chart-link`, `--chart-sel` (selection and focus: the accent's pale tint) | 5 |
| | shared | the text on any field of roles 10 to 13 and 19 to 25 | `--on-mid` (on) | 1 |

Roles 1 to 9 are theme roles (25 tones); roles 10 to 27 are meaning roles (77 tones with `--on-mid`). Focus is the
accent's field colour as a 2 px outline (`--on-slab` on a slab or field); it is a use, not a role.
- **Aliases** (pointers, no colour of their own, not counted): `--st`, `--on-st`, `--st-bg` (the lane's status);
  `--sea`, `--sea-g`, `--sea-s`, `--sea-w` (the sea in scope); `--scr`, `--scr-g` (the screen's role: Board route, Log
  loot, Earnings gil, Setup rank, Map sea 1); `--lv-m`, `--lv-g` (the role that chose a suggestion); `--ico`, `--band`,
  `--hz`. `--hazard` is a pattern, not a colour.
- **Retired:** by W31 `--bar`, `--gil-bar`, `--chart-line`, `--hue-src` and the `@supports` rule; by W33 `--rank-ring`,
  `--gil-ring`, `--loot-ring`, `--route-ring`, `--sea-1-ring`, `--ring`, `--ringc`. A token is deleted only after a
  search shows no rule uses it; otherwise it is kept, listed under its role and reported.

**The zones** (role and tone per zone; "status" is back, out or idle by the lane's state; the tool's zone map starts
from this table and each item keeps it in step):

| Screen | Zone (selector) | Role and tone |
| --- | --- | --- |
| Board | ground, graph paper (`.subs-main`) | page field; line |
| Board | next-back block (`.strip-next`, `.strip-more`) | slab field, on, on-2; ink-2 |
| Board | tallies (`.strip-back`, `.strip-tally`) | status field and on when the count is above 0, else panel and ink-2; locked: panel, locked hatch, ink |
| Board | tools (`.strip-tools`, `.seg`) | panel, ink; pressed: slab |
| Board | axis (`.tl-axis`) | ink (rule, return notches); ink-2 (tick labels); slab (the count on a cluster) |
| Board | group head (`.fc-head`) | slab field, on, on-2; molten band; status fields and ink-3 in the slot strip |
| Board | lane ground (`.sub`) | status wash, else panel; ink edge; Back: a 2 px back field inset |
| Board | status field and word (`.sub::before`, `.chip`) | status field and on; locked: locked hatch, ink on page |
| Board | name, parts code, route caption | ink; ink-2; ink |
| Board | rank plate | rank field, on-mid |
| Board | discs (`.disc`) | sea field, on-mid; outlined: panel, sea graphic, ink; the gap ring is panel |
| Board | trough, bar, marker (`.tl`, `.tl-bar`, `.tl-end`) | page field 3; out field (Back: back field); ink |
| Board | countdown, clock (`.when`) | ink (Back: back text); ink-2 |
| Board | voyage gauge (`.vgauge`) | out field on its own 12% track |
| Board | action (`.quick`) | accent field, on; band: molten, or the choosing role's field over a 2 px accent-on line |
| Board | locked lane | locked hatch on page field 3; one outlined disc; ink; tag ink-2 |
| Board | empty slot (`.sub.empty`) | idle graphic (dashed edge, hatch); ink-2; link accent |
| Board | notes (`.hint`, `.foot-note`, `.tl-key`) | ink-2; link accent |
| Send window | scrim; sheet | overlay; panel, ink edge, molten band |
| Send window | title (`.sheet h2`) | slab; a 12 px status field edge |
| Send window | suggestion (`.advice`) | accent wash and field edge; ink; the reason's edge: the choosing role's graphic |
| Send window | routes compared (`.advice .tl`, `.alts .tl`) | as the Board's trough and marker, outlined; discs sea |
| Send window | actions | accent field, on, molten; other buttons ink edge on panel |
| Send window | sector buttons (`.sector`) | page field, ink; sea graphic edge; letter route text; chosen: accent field, on, molten; order badge slab; disabled: line hatch |
| Send window | route line (`.route-line`) | route graphic edge, route text; discs sea; ink rules |
| Send window | figures, tags, hints | ink; ink-2; a failing line error text |
| Send window | what came back (`.loot-h`, `.loot-row`, `.qbtn`, `.rate-item b`) | loot field, on-mid, loot graphic hatch; line; page field, ink; loot text |
| Send window | rank box, rank-up plan | rank graphic edge, rank text |
| Send window | questions after a voyage (`fieldset`, `legend`) | ink edge; slab |
| Send window | send-all rows (`.pick .chip`, `.pick-fc`) | status field and on; ink |
| Log | head | loot field, on-mid, ink band |
| Log | day rule (`.log-day`) | slab field, on, on-2 |
| Log | row (`.log-row`) | page field; hover page field 2; line |
| Log | time cell (`.log-when`) | sea field, on-mid (no route: slab); hover accent field, on |
| Log | who, route text, discs | ink; ink-2; sea |
| Log | grade (`.log-grade`) | rank wash, rank graphic, ink; S and SS: rank field, on-mid |
| Log | gil and heat line (`.log-what`) | gil text; gil graphic |
| Log | logged or not (row edge) | loot graphic; idle graphic (dashed) and idle text |
| Map | head | slab with the sea's graphic band |
| Map | sea chain (`[data-map-sea]`) | page field, ink; sea field edge; bar sea graphic on line; chosen: sea field, on-mid; closed: line hatch, ink-2 |
| Map | planner (`.planner`) | page field, ink edge, sea graphic edge; route text; discs; error text; action accent |
| Map | chart head (`.chart-head`) | sea field, on-mid, ink band |
| Map | chart (`.chart-svg`) | water; chart ink; back, idle, locked, route and error chart tones |
| Map | legend (`.chart-key`) | water field, chart ink; swatches back, idle, locked chart tones |
| Map | sector details (`.chart-details`) | panel; head sea field, on-mid; state line back text, idle text or ink-2 with its edge; labels ink-2; rank text; route text; tier number loot field, on-mid; open tier accent wash; rate loot text |
| Earnings | head | gil field, on-mid |
| Earnings | tallies (`.earn-card`) | first: gil wash, ink, ink band; others: panel, gil graphic band, gil text |
| Earnings | section labels | ink; hatch and underline gil graphic |
| Earnings | position block | 1: accent field, on; 2 and 3: slab; others ink-2 |
| Earnings | route cell | route text, sea graphic edge, discs sea |
| Earnings | bars | gil wash, gil graphic tip, quarter lines line, figures ink; other gil figures gil text |
| Earnings | thin rows; top items | idle graphic hatch; loot text, loot graphic edge, gil text |
| Setup | panel heads | rank field, on-mid (recommendations: slab and a band of the four role fields); head state on |
| Setup | notifications, free companies, ticks | ink, ink-2, slab legend; page field, ink edge; link accent |
| Setup | ranking (`.rec-rank`) | each rung: its role's wash, ink, its role's field and on-mid for the number; first rung accent field edge |
| Setup | fuel; loot pickers | accent thumb, page field 3, ink; loot text, loot graphic edge, off: ink-3 |
| Setup | accuracy (`.acc`) | ink-2 heads; agrees back text; differs error text |
| Setup | guided setup (`.wiz`) | head rank field; steps: accent field (now), slab-on (done), outline; fields page and ink; note accent wash; a closed sea: sea wash and graphic edge; an open sea: sea field, on-mid; letters route text; error text |
| Empty | full empty state (`.empty-state`) | page field, ink edge; kicker slab; headline ink; sentence ink-2; step: panel, ink edge, number in a role field with on-mid; action accent with the route band |
| Empty | scope (`.es-scope`) | deep fields; rings route, loot, gil, rank fields and deep graphic; sweep route field; labels deep on |
| Empty | empty line (`.empty-line`) | page field, ink-2 dashed edge, ink; glyph: the screen's role, graphic |
| Notices | notice (`.note`) | accent wash and field edge, ink |
| Errors | block (`.note.bad`); text (`.hint.bad`, `.wiz-err`, `.cannot-line`, `.cannot-why`) | error graphic hatch on the accent wash; error text |

### Rev4.5 The fixed hues

| Role | Hue | Reads as | Nearest status | Nearest sea | Nearest other role |
| --- | --- | --- | --- | --- | --- |
| rank | 232° | azure | Out 35° (light), 41° (dark) | ice 17°, blue 18° | loot 44° |
| gil | 100° | gold | Idle 33° (light), 22° (dark) | ember 50° | loot 88° |
| loot | 188° | teal | Back 35° (light), 32° (dark) | jade 23°, ice 27° | rank 44° |
| route | 340° | pink | error 49° (light), 46° (dark) | rose 20°, lilac 25° | rank 108° |

Why these: with eleven hues already fixed, only four arcs of the wheel are 20° clear of every status colour: 98 to
133°, 176 to 247°, 293 to 360° and 0 to 6°. Gold has to sit at the start of the first. The chart already draws the
planned route in pink, so pink is the route. Teal and azure share the second arc, as far from Back, from Out and from
each other as it allows; azure rather than violet for rank, because violet (298°) is 25° from Out in dark themes.

**How a tone is fitted to a theme** (all in `palette.js`, as W22b built them; only the hue's source changes):
- field: lightness 0.70 in a light theme, 0.74 in a dark one; chroma `min(0.21, 0.94 × the largest chroma inside sRGB
  at that lightness and hue)`;
- graphic: the lightest (light theme) or darkest (dark theme) lightness, found by bisection, at which the colour
  reaches 3.1:1 against each of `--slip`, `--paper` and `--paper-2`; chroma by the same rule at that lightness;
- text: the same search for 4.6:1;
- wash: lightness 0.90 (light) or 0.30 (dark), chroma a third of the field's, moved until `--ink` on it reaches 7.2:1;
- `--on-mid`: the first of ink, page colour, black, white that reaches 4.6:1 on all eleven fields;
- a status text tone: the status colour itself when it reaches 4.6:1 on the three page colours, else the same hue and
  chroma at the lightness that does.
- **Tint toward the theme: none.** A role's field has the same hue in all 42 theme-and-mode pairs; the test allows
  2.5° for rounding to screen values. If the owner later wants warmth, the windows that still keep every floor are
  rank 229 to 235°, gil 100 to 106°, loot 185 to 191°, route 337 to 343°; that would be a new decision.
- New, deep water (W33): let D be the darker of `--ink` and `--paper` and its hue h (the accent's hue when D's chroma
  is under 0.02). `--deep` is OKLCH lightness of D less 0.04, held between 0.12 and 0.22, chroma at most 0.05, hue h.
  `--deep-2` is lightness 0.34, chroma at most 0.09, hue h, lowered by 0.01 at a time until `--on-deep` reaches 7:1
  on it. `--on-deep` is the lighter of ink and paper. `--deep-line` is `--on-deep` mixed 45% into `--deep-2` in OKLab.
- New, `--scrim`: `rgba(0, 0, 0, .6)` in the three `:root` token rules.

**Floors the test asserts in all 42 pairs** (hand minimum in brackets): a voice to any status 20° (22); a voice to a
voice 40° (44); a voice to a sea 15° (17); a status to a status 35° (38); a sea to a sea 30° (32). A sea to a status
is printed, not asserted. If a hand figure is wrong by more than 3° or a floor fails, W31 stops (Rev4.9).

**The closest pairs, and what tells them apart besides hue:**

| Pair | Apart | Told apart by |
| --- | --- | --- |
| route and the chart's planned route | 5° | nothing: they are the same thing |
| gil and "can be revealed next" on the chart | 7° | never on one surface: gil is not used inside the Map tab; "next" exists only on the chart's water, as a diamond |
| jade sea and Back; indigo sea and Out | 9 to 15° | a sea colour is only ever a round lettered disc with a gap ring, a sea tab, a time cell or an edge beside the sea's name; a status is a slanted field with its word |
| rank and the ice and blue seas | 17°, 18° | the rank plate is a slanted label holding the word "Rank"; see the sea rule above |
| route and the rose sea | 20° | the sea rule above; route is text, an edge or a band, never a disc |
| gil and Idle | 22° dark, 33° light | Idle is a field with the word "Idle" (in light themes also much darker); gil is a figure, a bar or a 5 px band |
| loot and rank | 44° | each is named where it stands (the ranking's labels, "Rank", item names) |
| the accent and whichever role its theme sits on | any | the accent is only the fill of an action, the chosen thing and focus; a role is never a button's fill; a role band on a button is parted from it by a 2 px line in the button's text colour |

**What stays the theme's:** roles 1 to 9: page and its two steps, panel, the three inks, lines, the slab, the accent
with its text and wash, the gradient and glow, overlays, and the deep-water panel.

**What this changes from Revision 3:** D24, D28 and W22b's point 4 no longer apply. `anchorHue`, `nudge` and
`evenness` leave `palette.js`; `PALETTE.ROLE_HUE = { rank: 232, gil: 100, loot: 188, route: 340 }` takes their place;
`compute()` still accepts the accent and the progress colour and ignores them. The fallback in `subs.css` becomes
`oklch(0.7 0.1 232)`, `oklch(0.7 0.1 100)`, `oklch(0.7 0.1 188)`, `oklch(0.7 0.1 340)` and the `@supports` rule is
deleted. In the default theme rank turns from rose to azure and route from blue-violet to pink; gil and loot move by
about 14°.

### Rev4.6 The generated list

- **Tool:** new `tracker/tools/subs-roles.js`. It holds `ROLES` (the table of Rev4.4 as data: role, kind, meaning,
  each token and its tone), `ALIASES`, and `ZONES` (screen, zone, the selector fragments that identify its rules, the
  roles allowed there). It loads the themes and the model through `tracker/tests/subs-palette.js`.
  `node tracker/tools/subs-roles.js` writes the document; with `--check` it writes nothing and exits 1 when the
  document differs. No date or time is written, so the output is the same on every run.
- **Document:** `docs/submersibles-colour-roles.md`, headed "Generated by tracker/tools/subs-roles.js. Do not edit."
  Contents: (1) the role list with the count of roles and tones; (2) per role, a table of 42 rows (theme, mode) with
  one column per tone as hex, and for a field its hue; a tone the model cannot compute (`--rule`, `--grid`, `--hi`,
  `--molten`, `--glow`, `--shadow`, `--sweep`, `--scrim`) is printed as its formula or "set by the theme", never as a
  typed value; (3) the hue gaps of Rev4.5 as measured, every gap under 25° named; (4) the zone map.
- **Test:** new `tracker/tests/subs-roles.test.js`, added to `test:unit` after `subs-look.test.js`. It asserts: the
  document equals what the tool would write; 27 roles and 102 tones; every colour token used in `subs.css` is in
  `ROLES` or `ALIASES`, and every token in `ROLES` is used by a rule or listed in `UNUSED` with a reason; every rule
  that uses a colour token matches a zone (longest selector fragment wins) whose roles include that token's role (an
  alias counts as any role it can point at); gil is in no zone of the Map.
- **Lint** (same test file), over `subs.css`, `chart.js` and `subs.js`. In `subs.css` a raw colour (`#` hex, `rgb(`,
  `hsl(`, `oklch(`, `oklab(`, `lab(`, `lch(`, `hwb(`, `color(`, a colour name) may appear only in a custom-property
  declaration inside a token rule: the three `:root` rules, `.subs-page`, and the three `.map-panel` token rules.
  Everywhere else a colour is `var(--token)`, `transparent`, `currentColor`, or `color-mix(in srgb, var(--token) N%,
  transparent)`. `chart.js` and `subs.js` hold no colour literal and no `fill="` or `stroke="` value other than `none`
  and `currentColor`. Exceptions live in one list, `LINT_PENDING`, which must be empty after W36.
- **Palette sheets:** `look-palette-{default,azure-dark,magitek-light}.png`, made by `L1` as today, regrouped by role:
  each role a row, its tones as swatches with sample text, the hex the browser computed under each.
- **In the browser:** `L1` gains `roleAudit()`: on each screen it walks, every opaque computed `color`,
  `background-color`, border colour, `fill` and `stroke` inside `.subs-main` and `#sheet[open]` must equal a tone of
  that theme's list within 2 per channel. W31 records the misses; W36 asserts there are none.

### Rev4.7 The layouts

**The Board: a fleet timeline.** One idea: every submarine is a lane on one shared time axis that starts now.

- **Strip.** As built, plus: after `.strip-next`, only when other shown submarines return within 10 minutes of the
  next one, `<span class="strip-more">and N more within 10 minutes</span>`; after `.strip-back`, three tallies
  `<span class="strip-tally out"><b>N</b> out</span>`, the same with `idle` and `locked` (locked: for each shown
  company, 4 less its unlocked slots). `.strip-next` and `.strip-back` keep their text to the letter. A tally is the
  Board's count block: slanted ends, the figure in `900 var(--strip-fig)/.9 var(--f-disp)` over its word, in its
  status field when the count is above 0. `--strip-fig`: 84 px from 1,100 px with up to four companies, else as built.
- **Axis.** `timeline.js` exposes `TL.span(ms)` (the smallest of 12, 24, 48, 72, 96 hours that is at least `ms`; 48
  for nothing; 96 for more), `TL.pos(ms, span)` (0 to 1, four decimals), `TL.ticks(hours)` (five labels: "now", then
  "+N h" at each quarter) and `TL.marks(positions)` (returns closer than 0.02 of the axis become one mark with a
  count). `ms` is the largest of: each shown Out submarine's time to return; each shown Back or Idle submarine's
  suggested voyage length. The axis is the first child of every `.fc-subs`:
  `<div class="tl-axis" aria-hidden="true" data-span="48">` holding five `<i style="--x:0">now</i>` ticks and one
  `<i class="tl-mark" style="--x:.5625" data-n="1">` per mark (returns of Out submarines only). It has a 3 px ink rule,
  tick labels `600 11px var(--f-data)`, and takes the same left and right insets as the lanes' track, so a tick stands
  over the same moment in every lane. With one column every group shows its axis; with two or four columns only the
  cards of the first row do. Nothing out: the strip says "Next back: none out" as today, the axis covers the longest
  suggestion (48 hours when there is none), and no lane has a bar.
- **Lane** (`subRow`): after `.sub-meta` add `<span class="tl" aria-hidden="true" style="--ret:F">` holding the discs
  (`routeDiscs`, below), `<i class="tl-bar"></i>` and `<i class="tl-end"></i>`; wrap the clock in `.when` in
  `<span class="when-at">` (the text does not change). Classes on `.tl`: `out` (bar from the left edge to `--ret` in
  `--out`, a solid 4 px ink marker at `--ret`); `done` (Back: the whole trough in `--back`, no marker, the returned
  voyage's discs); `ghost` (Back or Idle with a suggestion and no voyage to show: no bar, outlined discs of the
  suggested route, an outlined marker at the suggested return); `over` (a return past the axis: the bar runs to the
  right edge and ends in two chevrons, no marker; the countdown and clock say when). A locked lane's `.tl` is the
  locked hatch with one outlined disc, the unlocking sector. An empty slot has no `.tl`. `tick()` sets `--ret` each
  second from `data-ret` and the axis's `data-span`, and redraws when `TL.span` would change.
- **Discs.** `routeDiscs(route)` returns `<span class="discs" aria-hidden="true">` with one
  `<i class="disc in-sea-N" style="--i:K">LETTER</i>` per sector (five at most). A disc is round, its sea's field with
  the letter in `--on-mid` (`900` display face, 0.55 of the disc), and a 2 px panel-coloured ring around it. On a
  lane the discs stand on the top row of the track cell at a fixed pitch from the left; they are a label, not times.
- **Three forms,** by the width of `.fc-subs` (a container query; `.fc-subs.list` becomes one column and uses the
  compact form at any width from 400 px):

  | | Hero (760 px and wider) | Compact (400 to 759 px) | Phone (under 400 px) |
  | --- | --- | --- | --- |
  | Lane | grid `220px minmax(0, 1fr) 320px`, gap 16 px, at least 84 px, padding `10px 14px 10px calc(var(--field) + 12px)`, 2 px ink border | two lines of 26 and 30 px, padding `4px 6px 4px 28px`: 64 px; line 2 is `minmax(0, 1fr) 190px`, gap 8 px; nothing wraps | stacked, padding `38px 10px 10px` |
  | Status | 124 px slanted field, word 28 px (as built) | 18 px slanted edge, the word a 14 px chip at the right of line 1 (as built) | 30 px band, word 20 px (as built) |
  | Line 1 / column 1 | name 26 px; under it rank plate, parts code, route text | name 17 px, chip, rank plate `13px/15px`, parts code; route text clipped out of sight, not removed | name 20 px and rank plate; then parts code and route text |
  | Track cell | 46 px high: discs 28 px (pitch 34 px), bar 8 px at the bottom, marker 4 × 46 px | 30 px: discs 20 px (pitch 24 px), bar 6 px, marker 4 × 30 px | 34 px: discs 22 px (pitch 26 px), bar 6 px, marker 4 × 34 px |
  | When | countdown 40 px, the sentence `600 13px var(--f-data)` | in the 190 px cell: countdown 20 px and, for Out, the clock in 12 px; the rest of the sentence at `font-size: 0`; Back: countdown, then the action | countdown 30 px, the sentence wraps |
  | Action | 48 px high, as built | 26 px high, one line, ellipsis, full text in its title (as built) | 48 px high, full width |
  | Gauge | 6 px, under the when column | 3 px, at the lane's bottom edge under the 190 px cell | as built |

  Hero applies to `.fc-subs:not(.list)` only. In hero the group has no card frame; in compact and phone it keeps it.
  Columns: `.fleet` is one column while it has four companies or fewer; from five, two columns from 701 px and four
  from 1,400 px (as today).
- **By return time.** One group, "All submarines by return time", one column of compact lanes in today's order (Back,
  longest wait first; Out by return; Idle). The company name stays in `.sub-fc`. Sorted like this the markers of the
  Out lanes step to the right, lane by lane.
- **Dense, and C25.** At 1,920 px a card is (1,920 − 92 − 32 − 30) / 4 = 441.5 px, its lanes 421.5 px: compact. A
  compact lane is 64 px by construction (4 + 26 + 30 + 4). With T the top of the fleet and H a card head (today near
  169 and 56): a first-row card is 2 + H + 5 + 24 (axis 20, gap 4) + 4 × 64 + 3 × 5 + 8 + 2 = H + 312; a second-row
  card down to its last lane is 2 + H + 5 + 4 × 64 + 3 × 5 = H + 278; the lowest lane ends at T + (H + 312) + 10 +
  (H + 278) = T + 2H + 600, about 881 (today 1,052; limit 1,080). The track in a compact lane is 421.5 − 34 − 190 − 8
  = 189.5 px; five discs need 116 px.
- **Phone, 360 px.** The lane is 320 px wide and 300 px inside. Top to bottom: the status band with its word; name
  and rank plate; parts code and route text; the track, full width (five discs need 126 px; five tick labels fit); the
  countdown and its sentence; the action, full width and 48 px. Nothing is positioned wider than the lane.
- **Key, exact new text,** a `<p class="foot-note tl-key">` before the existing foot note: "Letters: the route's
  sectors, in order, in their sea's colour. Bar and marker: the time left and the return, on the line above. Outlined:
  a suggestion, not sent."
- **Keyboard and names.** The timeline adds no focus stop. Tab order is the page order: the strip's buttons, then per
  group its head buttons, then each lane followed by its action. The axis, the track and the discs are hidden from
  screen readers; everything they show is already in the lane's text (status word, countdown, clock, route, the
  action's label) and in `.vgauge-sr`. The lane keeps `overflow: hidden`, so its action stays 4 px inside its edge
  (D17). Motion: the bar and marker move once a second with no transition; the sweeps of R4 are as built.

**Empty states.** One pattern, two sizes.
- **Full** (helper `emptyHtml(o)`): `<section class="panel empty-state" data-empty="ID">` with `<div class="es-main">`
  (`<p class="es-kick">`, `<h2>`, `<p class="es-text">`, `<ol class="es-steps">` of up to three `<li class="es-step
  v-ROLE"><b>N</b><span><strong>TITLE</strong><span>TEXT</span></span></li>`, `<p class="es-act">` with one primary
  button and an optional `<span class="es-aside">`, an optional `<p class="es-note">`) and `<div class="es-scope"
  aria-hidden="true">` (one SVG and two labels). The Board's keeps the class `welcome` as well.
- Rules: two columns `minmax(0, 1fr) minmax(280px, 44%)`, no padding, at most 1,400 px wide, page ground, 2 px ink
  edge. Main: padding `48px 40px 48px 56px`; kicker a slab chip, `700 12px var(--f-kick)`, .24em; headline `900
  clamp(44px, 7.2vw, 104px)/.88 var(--f-disp)`, uppercase, ink; sentence 18 px, `--ink-2`, at most 56ch; a step: panel
  ground, 2 px ink edge, at least 64 px high, its number a block 86 px wide in its role's field with `--on-mid`, `900
  44px var(--f-disp)`, right end slashed 30 px, title `900 22px var(--f-disp)` uppercase, text 15 px `--ink-2`; the
  action 60 px high, `900 26px var(--f-disp)`, with a 7 px route band; aside `13px var(--f-data)`, `--ink-2`.
- Scope: ground `linear-gradient(160deg, var(--deep-2), var(--deep))`, left edge slashed 90 px. The SVG (`viewBox="0 0
  640 820"`, sliced to fill) draws, with classes and no colour attributes: five rings round (370, 430) of radius 90,
  180, 270, 360 and 450 in the route, loot, gil and rank fields and `--deep-line`, 2 px; a cross in `--deep-line`; a
  45° fan in the route field at 16% with a 4 px leading edge, turning once in 9 s (it stands still with reduced
  motion); a diamond at the centre in `--on-deep` with a 4 px route edge. Labels in `--on-deep`: the screen's word in
  `900 24px var(--f-disp)`, and "N seas, M sectors" from the data in `13px var(--f-data)`.
- Up to 700 px: one column; the scope is a 140 px band on top with no slash; main padding `20px 16px`; the action full
  width and 56 px.
- **Line** (class `empty-line`, added to existing sentences; their text does not change): `display: flex; align-items:
  center; gap: 12px; min-height: 48px; padding: 8px 14px; border: 2px dashed var(--ink-2); background: var(--paper)`,
  14 px ink, with a 22 px ring glyph in `--scr-g` before it.

| Where | Kicker | Headline | Sentence | Steps (role: title; text) | Action |
| --- | --- | --- | --- | --- | --- |
| Board, and Map, with no free company (`board-none`, also `welcome`) | The dock is empty | No submarines in the water | Add a free company and its submarines, and this Board shows who is out, who is back and what to send next. | route: Name the free company; Its world and the character it belongs to. rank: Add its submarines; Name, rank and the four parts of each one, and any voyage under way. loot: Tick what is discovered; One press can mark a whole sea. | `data-act="new"`, "Start the setup"; aside "about 3 to 5 minutes per free company"; note: today's second paragraph, unchanged |
| Board, every company hidden (`board-hidden`; after the note and the empty `.fleet`) | Nothing on the Board | Every free company is hidden | Their data and alerts are unchanged. Tick one in Setup to see it here. | none | `data-tab="setup"`, "Show them in Setup" |
| Log, no voyage (`log-none`) | The log is empty | No voyages yet | today's sentence, unchanged | route: Send a submarine; From the Board, on the suggested route or your own. loot: Log what came back; When it returns, enter the items in the send window or here. gil: See what it earned; Earnings adds it up by route, company and item. | `data-tab="board"`, "Go to the Board" |
| Earnings, no voyage (`earn-none`) | No earnings yet | Nothing logged yet | today's sentence, unchanged | loot: Log a returned voyage; Enter what came back in the Log tab. gil: Prices are added; The better of the merchant price and the market price after tax. | `data-tab="log"`, "Go to the Log" |

  Scope words: "Your dock", "Hidden", "Log", "Earnings". Lines: the fallback panel of `render()`; "Opening your
  fleet…" (`index.html`); by return time with no submarine, new text "No submarine is in an unlocked slot yet."; Map:
  "This sea is not opened yet.", the planner's two sentences for no submarine and none chosen; Earnings: "Log what
  came back from voyages with a route to see this."; Setup: "No checks yet.", the loot pickers' line when it has
  text; send window: "No discovered sectors entered…", "No loot list for this sector yet.", "No route was recorded…",
  "No submarine is back or waiting to be sent.", "This submarine was removed…". Notices and errors keep R4's forms.

**The other screens, one idea each.**
- **Log: a ledger by day.** `logHtml` puts before the first row of each local day `<div class="log-day"><b>LABEL</b>
  <span>N voyages · G gil logged</span></div>` ("1 voyage"; "nothing logged" in place of the gil when no row of that
  day is logged). LABEL is "Today", "Yesterday", or the weekday, day and month in English (with the year when it is
  not this year); the day is that of the time the row shows; G is the sum of the gil figures of that day's rows. Each
  row gains `routeDiscs` before its who cell. Rules: the day rule is a slab strip, `position: sticky; top: 0`, label
  `900 20px var(--f-disp)` uppercase, summary `600 13px var(--f-data)` in `--on-slab-2`; row columns `96px 150px
  minmax(0, 1fr) auto` (phone: one column, discs after the time strip); figures right-aligned with tabular numerals;
  the two zebra rules go; everything else as built.
- **Earnings: a leaderboard on one printed scale.** `earnHtml` computes `scale`, the smallest of 1, 2, 2.5, 5 or 10
  times a power of ten that is at least the largest gil per hour, sets each ranked row's `--p` to its gil per hour ÷
  `scale`, and adds `<caption class="earn-scale">Bars run from 0 to SCALE an hour</caption>`; the same for the
  by-company and by-submarine tables with their own scale and "Bars run from 0 to SCALE". Ranked and thin rows gain
  `routeDiscs` in the route cell. Rules: bar cells get quarter lines in `--rule` under the bar; the four totals become
  tallies, the Board's count block (slanted ends, figure over label), the first as built.
- **Setup and recommendations: every head says its state; the ranking is a ladder.** After the `h2` of "Free
  companies" and of "Free companies on the Board", and as the first child of `[data-recs-body]`, add `<p
  class="head-state" aria-hidden="true">`: "N set up"; "All shown" or "N hidden"; "First: LABEL" plus " · fuel saving
  on" when it is on. It sits at the right of the panel's head (`position: absolute; top: 14px; right: var(--pad-x)`,
  `600 13px var(--f-data)`, the head's text colour); up to 700 px it is a plain line under the head in `--ink-2`.
  `recsBodyHtml` adds `rung-1` to `rung-4` to the four ranking rows: at least 76, 68, 60 and 56 px high, number block
  72, 64, 56 and 52 px wide with figures of 44, 38, 32 and 28 px, each row on its role's wash with ink text; the first
  keeps the accent edge. `.tick b` takes the route text colour only inside `.wiz`.
- **Send window: routes compared on one time axis.** `adviceHtml` computes one span for the suggestion and the other
  routes (`TL.span` of the longest), puts a `.tl-axis` and the suggestion's discs and `.tl.ghost` under its route, and
  discs and a `.tl.ghost` in each row of the other routes, so every return time lines up. `pickerHtml` and
  `plannerHtml` put `routeDiscs` in their route line. `openSub` and `sendSheet` add `st-back`, `st-out` or `st-idle`
  to the sheet's `h2`: a 12 px edge in that status field. `.sheet::backdrop` uses `--scrim`. Enter still presses the
  first primary button.
- **Map chrome: the seven seas as one chain.** `mapHtml` adds `closed` to a sea button with nothing found. Rules: the
  buttons join with no gap; a chevron drawn as a background at each right edge points to the next sea (no `clip-path`:
  the buttons take focus); closed: `var(--hazard)` with `--hz: var(--grid)` and `--ink-2` text; the chosen sea as
  built; the pressed tab's track is `--on-mid` at `opacity: .3`. The chart, its legend and the details are untouched.

### Rev4.8 Work items

Order: W31, W32, W33, W34, W35, W36, W37. One builder at a time; each item leaves the app working and is committed on
its own. Every item, as in section 6: a branch; only the files named; `npm run build` and commit the rebuilt files
(Rev4.1's list); `npm run test:unit` and `npm run check`; report what was run and what was not; never merge or push to
`main`. Every item's acceptance includes: C20, C24, C25, C28, C82, C97 pass; `L1` passes with R3.7's floors; the
contrast tests and `subs-roles.test.js` pass; the generated document is regenerated and committed; the item's
pictures exist in the tags `desktop`, `desktop-azure-dark`, `desktop-magitek-light` and `phone`.
**Role review (required self-review, every item).** Open the item's pictures in the default theme, Azure Dragoon dark
and Magitek Steel light, and the phone picture. Report per picture: (1) each colour seen and the role it stands for;
(2) whether each role is the same kind of colour in all three (rank azure, gil gold, loot teal, route pink, Back
green, Out blue, Idle amber); (3) any colour with no role, or one role in two colours; (4) any two neighbours that
could be mixed up; (5) what tells this theme from the other two; (6) what the eye lands on first, and whether that is
what the screen is for. Then one sentence: "consistent" or "inconsistent: <where>". R1's bold test still applies.
Reported, never hidden.

#### W31. Roles, the tool, the list, the tests, the sheets (Sonnet builder; first)
- Files: `src/submersibles/palette.js`, `src/submersibles/subs.css` (token rules, and the four rules named below);
  new `tracker/tools/subs-roles.js`; new `docs/submersibles-colour-roles.md` (written by the tool); new
  `tracker/tests/subs-roles.test.js`; `tracker/tests/subs-palette.js`, `tracker/tests/subs-look.test.js`;
  `package.json` (`test:unit` only); `check.js` (`L1` only).
- Steps: (1) Before any edit, with the built `palette.js`, print the OKLCH hue of the four status colours in both
  modes, of the seven seas and of `#ff6ec7` and `#ffe38a`, and the gaps of Rev4.5's two tables for the hues 232, 100,
  188, 340. Compare with Rev4.2 and Rev4.5; stop on the "Escalate if" below. Record the family counts of `L1` as they
  are. (2) `palette.js`: Rev4.5's change, nothing else; `info` gives `hues`, `statusHues`, `minStatus`, `minVoiceGap`,
  `minSea`. (3) `subs.css`: the fallback hues; delete the `@supports` rule, `--bar` with the overridden rule that
  used it, `--gil-bar`, `--chart-line`; add `--scrim` and use it on `.sheet::backdrop`; move `--chart-no` into the
  three chart token rules; `.sub-meta .route { color: var(--ink) }`; the pressed sea tab's track as Rev4.7 says. (4)
  The tool and the document (Rev4.6); `ZONES` describes the screens as they are now. (5) The two tests of Rev4.6;
  `LINT_PENDING` may hold `--ringc` only. (6) `subs-palette.js`: drop the `@supports` reader and the `supports` and
  `hue` options. `subs-look.test.js`: the fallback test runs once per pair with a voice gap of 40°; the two hue-sweep
  tests and every `--gil-bar` pair go; add the test of Rev4.5's floors and of each field's hue within 2.5° of its
  number; the nudge figures go. (7) `L1`: the palette sheets by role; `roleAudit()` recorded, not asserted.
- Must not change: any layout, text or markup; `subs.js`; the status, sea and chart values; `compute()`'s arguments.
- Pictures: the three `look-palette-*.png`; every `look-*.png` regenerates (four colours move).
- Acceptance: as above; the browser's tokens equal the model within 2 in the three themes; the hand-back gives the
  measured hue and gap tables, the counts (27 and 102, or what differs and why), the family counts before and after,
  and the list `roleAudit()` recorded.
- Escalate if: a hand hue of Rev4.2 or Rev4.5 is off by more than 3°; a floor of Rev4.5 fails; a floor of R3.7 fails
  after the change (report the hues; do not lower a floor or move a hue); gold at 100° reads as olive on a sheet; a
  token thought unused is used; the coverage rule cannot be met without loosening it.

#### W32. The Board as a timeline (Sonnet builder; needs W31)
- Files: new `src/submersibles/timeline.js`; `index.html` (one script tag, before `subs.js`); `build.js` (add the file
  to the list that copies the module); `subs.js` in `shownSummary`, `strip`, `subRow`, `lockedRow`, `fcCard`,
  `boardHtml`, `tick`, and the new helpers `routeDiscs` and `axisHtml`; `subs.css` (the Board's rules); new
  `tracker/tests/subs-timeline.test.js` (added to `test:unit`); `subs-look.test.js`; the tool's `ZONES`; `check.js`
  (new C103 to C106, and `L1`).
- Steps: (1) Measure today's C25 parts on the eight-company seed: the top of the fleet, a card head, a row, the
  strip; put them in the hand-back beside Rev4.7's figures. (2) Build Rev4.7's Board exactly. (3) Unit test: `TL.span`
  at 0, 12 h, 12 h and a second, 96 h, 200 h; `TL.pos` clamps; `TL.ticks` for the five spans; `TL.marks` merges under
  0.02 and counts. (4) Contrast pairs to add (all 42 pairs): `--out` and `--back` on `--paper-3` at 3; `--ink` on
  `--paper-3` and on each status wash at 4.5; `--on-mid` on each sea field (exists); each sea's graphic on `--slip`
  (exists). Update the tests that quote Board rules word for word.
- Checks: C103: a seeded fleet with known returns: each Out lane's marker is at (return − now) ÷ span within 0.01, the
  axis shows the span the rule gives and five ticks, tallies equal the counts, `.strip-back` and `.strip-next` read as
  before. C104: a return 120 hours away runs off the end (`.tl.over`, no marker) with no sideways scroll; three
  returns within 10 minutes give one mark with `data-n="3"` and "and 2 more within 10 minutes". C105: by return time
  is one column, in today's order, and the Out lanes' markers never step back; with nothing out the strip says "none
  out", no lane has a bar, and the axis follows the longest suggestion. C106: at 360 px no sideways scroll, the track
  is at least 280 px wide, every lane and action is at least 40 px high; Tab goes from a lane to its action; a focused
  lane and action show an outline; with reduced motion nothing inside a lane animates.
- Must not change: what a press does; `.quick`'s text; section 5; `fleet.js`; the order by return time.
- Pictures: `look-board-*`, `submersibles-board.png`, `-phone.png`, `-desktop.png` (the dense Board), and a new
  `look-board-time-*` (by return time).
- Acceptance: as above; C25 `fit.maxBottom` at most 1,000 with four columns and two at 1,024 px; the hand-back gives
  T, H and the result beside T + 2H + 600.
- Escalate if: C25 is over 1,000; a compact lane cannot stay at 64 px; C97 cannot hold with the gauge where Rev4.7
  puts it; a check clicks something the new lane covers; hiding text with `font-size: 0` is read out wrongly or shows.

#### W33. Empty states (Sonnet builder; needs W32)
- Files: `palette.js` (the four deep-water tokens); `subs.css`; `subs.js` (new `emptyHtml`; `render`, `boardHtml`,
  `logHtml`, `earnHtml`, and the functions that hold the sentences listed as lines, class only); `index.html` (the
  loading line's class); `subs-look.test.js`; the tool's `ZONES`; `check.js` (new C107, and `L1`'s empty walk).
- Steps: build Rev4.7's pattern and table exactly; retire the ring tokens and `--ringc` (W31's exception list is then
  empty). Contrast pairs to add: `--on-deep` on `--deep-2` at 7; each of the four role fields on `--deep-2` at 3;
  `--on-mid` on the three role fields used by steps (exist); the fallback values of the four new tokens.
- Check C107: the four full empty states show their headline and action; each action does what its row says (the
  setup opens; the tab changes); the scope is hidden from screen readers; no sideways scroll at 360 px; with reduced
  motion the fan does not turn.
- Must not change: what `data-act="new"` and `data-tab` do; `.panel.welcome` and `.panel.empty-state` exist where they
  do today; `[data-hidden-note]`.
- Pictures: `look-empty-{board,hidden,log,earnings}-*`.
- Escalate if: a check or test turns out to read one of the replaced texts; a role ring is under 3:1 on the panel in
  some theme; the headline does not fit at 360 px.

#### W34. Log and Earnings (Sonnet builder; needs W32)
- Files: `subs.css`; `subs.js` in `logHtml` and `earnHtml` only; `subs-look.test.js` (the rules it quotes); the tool's
  `ZONES`; `check.js` (new C108, C109, and `L1`).
- Steps: build Rev4.7's two paragraphs exactly.
- Checks: C108: each day rule's count and gil equal the rows under it; the rows still open their voyage. C109: each
  ranked bar's `--p` equals its gil per hour ÷ the printed scale, the scale is at least the largest figure, and C22
  and C78 read what they read before.
- Must not change: any figure, the order of rows and tables, `.log-row[data-trip]`, `.earn-card b`, `tr[data-pos]`.
- Pictures: `look-log-*`, `look-earnings-*`, `look-earnings-ranked-*`.
- Escalate if: the sticky day rule covers a row's focus ring; a table no longer fits at 360 px; a row grows at 360 px.

#### W35. Send window, Setup and recommendations, Map chrome (Sonnet builder; needs W32)
- Files: `subs.css`; `subs.js` in `adviceHtml`, `pickerHtml`, `plannerHtml`, `openSub`, `sendSheet`, `setupHtml`,
  `shownPanelHtml`, `recsBodyHtml`, `mapHtml` only; `subs-look.test.js`; the tool's `ZONES`; `check.js` (new C110 to
  C112, and `L1`).
- Steps: build Rev4.7's last three paragraphs exactly.
- Checks: C110: in the send window each route's marker is at its voyage length ÷ the shared span; Enter presses the
  first primary button; C21 to C23 and C78 to C81 pass. C111: each head state equals what its panel says, and the
  recommendations one follows a change of order without a reload; the four rungs step down in height. C112: a sea
  button is `closed` exactly when nothing is found there; its text is unchanged; C82 and C84 pass.
- Must not change: what the buttons, the slider and the pickers do; the chart; `sectorDetails`; section 5.
- Pictures: `look-sheet-*`, `look-sheet-route-*`, `look-setup-*`, `look-recommendations-*`, `look-map-*`,
  `look-planner-*`.
- Escalate if: the head state overlaps a long head at 701 px; the chain cannot show focus without `clip-path`; a
  recommendations check reads a style.

#### W36. Final pass (Sonnet builder; needs W33 to W35)
- Files: `subs.css`; the tool's `ZONES`; `check.js` (`L1`).
- Steps: `LINT_PENDING` and `UNUSED` are empty or each entry is explained; `roleAudit()` is asserted with no miss in
  the three themes; walk every screen at 360 × 800 in light and dark and fix clipped text, any target under its size,
  any hidden focus ring; reduced motion stops every loop; run the role review and the bold test over every picture and
  list every "inconsistent" and "still tame".
- Acceptance: `npm run build`, `npm run test:unit`, `npm run test:browser`, `npm run check` pass; the hand-back gives
  C25 `maxBottom`, C82 `hitMin`, the family counts, the measured gap table and the role and tone counts.
- Escalate if: a miss of `roleAudit()` comes from a shared style outside this module; a fix needs markup outside the
  functions named in W32 to W35.

#### W37. Records (Haiku clerk; needs W36)
- Files: `docs/STATE.md` (one entry naming Revision 4, the generated list and checks C103 to C112),
  `tracker/command-center/README.md` (the new picture names and the tool). Acceptance: `git diff --stat` shows only
  those two files.

### Rev4.9 Risks, and the first thing to verify

- **First:** this file was rewritten whole to append this section. `git diff --numstat docs/submersibles-look-spec.md`
  must show additions only. Then W31's step 1: every hue and gap here is hand arithmetic from hex values; if one is
  off by more than 3° or a floor fails, the four numbers of D39 come back to the architect before anything is built.
- R3.7's family floors were set for rotating hues. By hand they hold with the fixed ones (the Log in the default theme
  is the tightest, at exactly 5); W31 records them before the Board changes.
- C25's 881 rests on a reconstruction of today's layout, not on a measurement. W32 measures first; the lane's 64 px is
  fixed by construction, the top of the fleet and the card head are not.
- A theme's accent can sit on a role's hue: the default theme's rose beside the route pink, Azure Dragoon's blue
  beside Out, Magitek Steel's beside rank and the first sea. Form keeps them apart (Rev4.5); the role review asks.
- Jade discs on a Back lane and indigo discs on an Out lane are close in colour to the bar under them; the discs sit
  on their own row with a gap ring. Q14.
- At 100° and lightness 0.70 gold may look olive on some pages; W31 looks at the sheets and stops if so.
- The axis changes scale with the fleet (12 to 96 hours). Its ticks are labelled; a player comparing two days sees
  two scales.
- `font-size: 0` hides words on compact lanes for the eye only; screen readers still read them, which is intended.
- The generated document is long (about 1,300 table rows). It is for looking things up, not for reading through.
- Needed in the engines where the checks run, all already used by the module: `:has`, container queries, `color-mix`,
  `position: sticky`. The risks of section 8, R6 and R3.9 stand (parallel work on the same files, custom colours,
  light slabs and fields on dark themes, the unverified orientation).

### Rev4.10 Owner questions

Q1 to Q11 stand as written. Three more:

**Q12. Which colour stands for which thing.**
- Rank blue, gil gold, loot teal, routes pink, in every theme (what this revision builds). Pink already marks the
  planned route on the map, so pink means "route" on every screen. Cost: none extra. Risk: the rank label is close in
  colour to the first sea's blue discs (they differ in shape and wording), and in the default theme the pink sits near
  the theme's own rose buttons. Fairly sure.
- Rank pink, gil gold, loot teal, routes blue, as the first drawing showed. Cost: none extra. Risk: pink would mean
  rank on the pages and the planned route on the map, and the route blue sits between the "Out" blue and the first
  sea's blue. Moderately sure this reads worse.
- Keep things as they are: the four colours keep changing with the theme (gil is gold in one theme and rose in
  another). No work; the inconsistency you noticed stays.
- Recommendation: the first. Fairly sure.

**Q13. New words and figures on the screens.** The new layouts add short lines made only from what is already on the
same screen: on the Board "3 out", "2 idle", "1 locked" and "and 2 more within 10 minutes"; in the Log a heading per
day with that day's voyages and gil; in Earnings "Bars run from 0 to 50,000 gil an hour"; in Setup the current setting
beside three panel titles; on empty screens a new headline and up to three short steps.
- Add them all (what this revision builds). Cost: none extra. Risk: more words on screen; each is a count or a sum,
  never a new estimate. Fairly sure.
- Layout and colour only: no day headings, tallies, scale lines or head settings, and empty screens keep today's
  sentences. Cost: a little less work. You give up most of what makes the Log and Earnings easier to read.
- Keep things as they are: these screens keep today's layout.
- Recommendation: add them all. Fairly sure.

**Q14. Two sea colours that sit close to a status colour.** The Sea of Jade's green is close to the "Back" green, and
the indigo sea's blue is close to the "Out" blue.
- Keep the sea colours (this is also "keep things as they are", and what this revision builds). A sea is always a
  round lettered disc, a tab or a cell beside the sea's name; a status is always a slanted block with its word. Cost:
  none. Risk: at a glance a jade disc on a "Back" lane is green beside green. Fairly sure it is fine.
- Move those two sea colours a little (jade toward teal, indigo toward violet). Cost: one extra item; the map's water
  for those two seas changes and its checks are redone. Risk: jade then sits nearer the loot teal. Moderately sure.
- Recommendation: keep them, and look again at the Board pictures of W32. Fairly sure.
