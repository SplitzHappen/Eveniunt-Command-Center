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
