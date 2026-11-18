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
