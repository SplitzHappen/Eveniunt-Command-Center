# Lists: the look, second pass (colour by state): spec

Written 2026-11-24 for a Sonnet builder. Why: on the built Lists screens at 1440 px the owner sees "a lot of unicolor
things which give me AI slop vibes". Read for this spec: `CLAUDE.md`, `docs/design-rules.md`, `docs/lists-look-spec.md`,
`docs/submersibles-look-spec.md` (Rev4.7 layouts; R1 and section 5 by heading), `docs/lists-colour-roles.md` section 1 and
the craft and gather tables, `src/lists/lists.css` (all), in `src/lists/lists.js` the functions `windowText`,
`windowRow`, `tickWindows`, `sumShares`, `rowHtml`, `getRow`, `craftRow`, `secHead`, `routeRows`, `getTab`, `craftTab`,
`crafted` and the wanted row (lines 1174 to 1204), in `engine.js` `settleLine`, the plan's return value and `L.record`;
in `check.js` the DR1 helper (lines 8190 to 8294), DR1, C186 and the C195 header; `tracker/tests/lists-roles.test.js`
lines 100 to 212. Pictures opened: `docs/lists-redesign/build/craft-desktop-light.png`, `get-desktop-light.png`, the
theme shots `craft-desktop-uldah-light.png` and `get-desktop-azure-dark.png`, and `evidence/look-board-desktop.png`. Not
read: `shoot.js` (its seed and variant format), `tools/lists-roles.js` beyond its role list, `store.js`, the Wanted tab's
other code. Nothing was built or run.

## 1. Goal and constraints

- At 1440 px the Lists screens stop reading as stock "info" bands: colour comes in small blocks that each say a row's
  own state, rows differ when their states differ, and the heads sit in the theme the way Submersibles' group heads do.
- **Look only, plus state hooks.** Edit `src/lists/lists.css`; edit `src/lists/lists.js` only to add the attributes of
  section 3 and the tick update. No change to `engine.js`, `store.js`, the save, `save.js`, the data, any visible word
  (one exception waits for the owner, Q1), or any class, `data-act`, `data-*` or text a check reads.
- Offline-first, public, GitHub Pages; no new resource; the app never reads or automates the game; no invented figure
  (every state below comes from what the player typed, the plan or the game data's node times).
- Phone (360 px) is accepted as it is: phone changes are only what the shared rules carry over, and no phone budget,
  height or check figure may get worse.
- Every rule of `docs/design-rules.md` keeps holding (section 5). No new colour tone: everything uses the existing role
  tokens through the pointers `--f`, `--g`, `--s`, `--w`, `--on-f`, so `docs/lists-colour-roles.md` must not change.

## 2. Findings (the caller's diagnosis, checked)

1. **Confirmed, with the cause.** Section and job heads are `background: var(--f)` across the full width. The six
   `--lr-*-fill` tokens are fixed OKLCH values: the generated table gives the craft fill as `#60aaf3` in all 42 theme and
   mode pairs (gather `#74c163` likewise). Only the edge, ink and wash tones are mixed with the theme. So the largest
   coloured areas on the screen are the one colour that ignores the theme.
2. **Confirmed.** `rowHtml` gives every row the same block, ground and primary; state is only in words. The plan already
   knows have some or none (`x.given`), a timed node open or later (`E.nextWindow(...).open`), finished rows, and
   must-craft progress. "All in hand" never shows on To get: `getTab` drops rows with `short` 0.
3. **Corrected.** A filled primary on every row is what the owner rejected on 2026-11-23 (decision F1, "eight identical
   loud blocks down a column"); DR1's `f1Filled` pins one filled primary per screen. This spec keeps F1 and gives only
   rows that can be done now a colour band on their outlined primary. Going further is the owner's call (Q2).

## 3. Decisions (rejected alternatives after "Not:")

- **V-D1 Heads go on the slab, and their colour shrinks to one block.** Not: theme-mixed fills (all 42 field contrasts
  would need re-proving and the roles document would change), or keeping the full-width bands.
- **V-D2 Row state goes in two attributes on `.lr`:** `data-st` (`act` can be done now, `wait` cannot yet, `done`) and
  `data-have="some"` with `style="--p:N"`. Not: new classes (some checks join the class string), or a state word per row
  (new words).
- **V-D3 The count block changes form by state:** solid field (go, or can be done now), outlined (waiting), ready field
  (done). Shape, not only colour, so rule K4 holds with the row's existing words. Not: hatching under the figure (the
  contrast of a figure on stripes is not proven).
- **V-D4 One progress line per row that has some.** Not: a track on every row (the same texture again on every row).
- **V-D5 Craft "can be made now" is worked out in `lists.js` from the plan**, with no engine change. Not: a new engine
  field (the engine is out of scope).
- **V-D6 The primary stays an outline (owner decision F1); a "can be done now" row adds a 5 px band of its role's field
  under it.** Not: a filled block (that departs from F1 and needs the owner, Q2).
- **V-D7 The rail's current entry goes on the slab.** Not: a role field for each entry (one more flat block of one
  colour).
- **V-D8 The list head is not changed** (approved, and it already says the answer). Not: a restyle.

## 4. The design (CSS in `lists.css` unless lists.js is named)

**Section head** (`.sec-toggle`, To get): `background: var(--slab); color: var(--on-slab)`; replace the ink bottom edge
with `border-bottom: 4px solid var(--f)` (closed heads keep `border-bottom: 0` as built, plus `box-shadow: inset 0 -4px 0
var(--f)`). Chevron and title in `--on-slab`, `.sec-sum` in `--on-slab-2`. `.count` becomes a block: `position: relative;
isolation: isolate; align-self: stretch; display: flex; align-items: center; min-width: 64px; padding: 0 14px 0 24px;
color: var(--on-f)`. Its `::before` is the field: `inset: 0; z-index: -1; background: var(--f); transform: skewX(-25deg)`
(no `clip-path`: the unit test refuses `clip-path` in any rule whose selector names `.sec-toggle`). Earn and Left
sections (their `--f` is the slab): the `::before` is transparent with `box-shadow: inset 0 0 0 2px currentColor`, as
`.lhead .tally.r-slab`. Hover: slab kept, `box-shadow: inset 0 -4px 0 var(--f)`. Focus: `outline: 3px solid
var(--on-slab); outline-offset: -3px`. Height stays 48 px.

**Job head** (`.job-head`, To craft): `background: var(--slab); color: var(--on-slab); --on-f: var(--on-slab);
border-bottom: 4px solid var(--f)`. The order block `.no::before` changes from `var(--ink)` to `var(--f)` and `.no`
gets `color: var(--on-mid)`, so the number is the one craft-blue block (the ready field on "Already crafted", through
`.cdone`'s `--f`). The job icon follows `--on-f` (the test's `.job-head .jicon { color: var(--on-f) }` stays word for
word). `.sum` in `--on-slab-2`.

**Zone and city sub-heads** (`.zone-head`): `background: var(--paper)`; the left edge becomes `6px solid var(--g)` (the
theme-mixed graphic tone, not the fixed fill); name, count and the 24 px height as built. `.ae-head` as built.

**Count block** (`.cnt` in `.lr`), by `data-st`:
- none set, and `act`: solid field as built, figure `--on-f`.
- `wait`: outlined. `.cnt::before` keeps its polygon with `background: var(--g)`; a new `.cnt::after` (same z-index,
  painted above it) is the polygon inset by 2 px with `background: var(--slip)`; the figure and word take `color:
  var(--s)`. The slash leans 26 px (18 px on a phone, as built); the inner polygon leans 1 px less so the outline is even.
- `done`: the ready field (wanted and "Already crafted" rows already wear `r-ready`).

**Row body** (`.lr`):
- default: `--slip` as built.
- `act`: `background: var(--w); box-shadow: inset 0 0 0 2px var(--g)` (Submersibles' Back lane).
- `done`: `background: var(--w)` of the ready role (replaces `.lr.done { background: var(--slip) }`).
- `data-have="some"`: `::after` at the bottom, `left: 88px` (64 px on a phone), `right: 0`, `height: 4px`,
  `background: linear-gradient(var(--g), var(--g)) 0 100% / calc(var(--p) * 100%) 4px no-repeat,
  linear-gradient(var(--rule), var(--rule)) 0 100% / 100% 2px no-repeat`; `aria-hidden` is not needed because it is a
  pseudo-element. It is absolutely placed, so no row gets taller.

**Have and need control** (`.stepper` in a row): the edge becomes `2px solid var(--ink)`, as the kit of the first look
spec says (built 1 px `--ink-3`). Under `data-have="some"` the figure cell takes `background: var(--w)`. Ink on every
wash is proven at 7:1.

**Primary** (`.lbtn-r`): as built (outline and text in `--s`). Under `data-st="act"`: `color: var(--ink);
border-color: var(--g); padding-bottom: 5px; background: linear-gradient(var(--f), var(--f)) 0 100% / 100% 5px
no-repeat`; its hover keeps the band and adds the `--hi` layer. Still one primary per row, still `.lbtn-r`.

**Rail** (`.ltab[aria-selected="true"]`): `background: var(--slab); color: var(--on-slab)`, icon in `--on-slab`, the
3 px molten edge as built. Unselected icons keep their role's graphic tone (`--g`). The phone bar takes the same rule.

**List head:** unchanged.

### Row states and where each comes from (lists.js)

`rowHtml(o)` gains `o.st` (`act`, `wait`, `done` or empty) and `o.p` (a number from 0 to 1, or null); it writes
` data-st="…"` and ` data-have="some" style="--p:0.42"` (two decimals) on the `div.lr`. Do not touch the literal
strings the unit test quotes (lines 151 to 160 of `lists-roles.test.js`, for example the `word: outside ? 'not typed'
…` fragment of `getRow`).

| Row | State | Data | Word already on the row (K4) |
| --- | --- | --- | --- |
| To get, any way | have some | `x.given > 0` (`x` = `sumShares` entry; rows exist only while `x.short > 0`); `p = x.given / x.need` | desktop "need N, have M"; phone: the progress line is the shape |
| To get, gather, timed | open now: `act`; opens later: `wait` | `E.nextWindow(t.hours, t.minutes, Date.now()).open`, with `t` the same timed object `windowRow` gets (`chosenTimed(cs)` or `ln.timed`) | "open now, closes …" or "opens …" (line 3, phone too) |
| To craft | can be made now: `act`; else `wait` (V4, owner Q1 for any key words) | new `matsInHand(V, ln)`: `!bookWarn(V, ln)` and, for each ingredient `m` of `DATA.recipes[ln.recipe][5]`, the plan lines `V.plan.items[m]` whose `part` is not `make` or `coll` exist and each has `short === 0` or `by === 'have'` (the player said they have it) | none today: see Q1 |
| To craft, must-craft | progress | already drawn by `.prog` (desktop) and "N of M crafted" | as built; no `data-have` here |
| Already crafted (`crafted()` HTML) | `done` | as built; add `data-st="done"` to its `div.lr` | "finished" |
| Wanted | `done` | `t.done`; must-craft with `t.crafted > 0`: `data-have`, `p = t.crafted / t.qty` | "Finished" / "crafted N of M" |

`tickWindows()` also sets the state: for each `.w-window` inside a `.get-row`, compute `E.nextWindow(...)` and set
`closest('.lr').dataset.st` to `act` or `wait`, so a window that opens while the page is up changes its row. Rows are
not reordered on the tick (as built).

**Not used, and why.** "Have all" on To get (such rows are not drawn). Market price known or not (already a sentence;
no clear do-now meaning). Readiness per step: `matsInHand` reads the whole plan of the character (or of the combined
lists) while the counts may be one step's share; the row says "can be made now" only when everything is covered.

## 5. Design rules and checks

Touched and kept: C2 and C4 (heads still say their count; the list head's tallies stay the largest figures), C5 (one
ledger), A1 and A2 (one `.lbtn-r` per row, no new control), A6 (no target changes), K1 (only `var()` of role or theme
tokens; `transparent` only), K3 (fills unchanged), K4 (each state is a shape plus an existing word; craft readiness
waits on Q1), K5 (the new pairs are tested in V1), K7 (more hues on screen, not fewer), M2 (slab, slash, molten),
T2 (no new rule uses the data face; the unit test's list of six data-face selectors must stay equal), P2, P4 (nothing new
in the flow). **No rule changes.** If the owner answers Q2 with the filled option, F1 and DR1's `f1Filled` change: that
is an owner-visible change and its own item.

Checks that must pass unchanged: DR1 (all 21 rules, its 21 screens and its break self-test), C186, C195, the other
Lists blocks of `check.js`, and every Lists unit test, in particular `lists-roles.test.js` (contrast floors, no raw
colour, the six data-face selectors, 40 px targets, no `clip-path` on a focusable selector, `.job-head .jicon` colour).
New assertions: V1 (contrast) and V5 (a new block `LV2`).

## 6. Work items

Every item: on a branch; only the files named plus the built copies `npm run build` rewrites; commit them with the
source; never merge or push to `main`; report what ran and what did not. Acceptance for every Sonnet item: `npm run
build` twice (the second changes nothing; `docs/lists-colour-roles.md` unchanged), `npm run test:unit`, `npm run
test:browser`, `npm run check` (DR1, C186, C195 and, from V5, LV2 pass).

**V0. Baseline (Haiku clerk).** Files: none. Steps: `npm ci`, `npm run build`, `npm run test:unit`; from
`tracker/command-center/evidence/checks.json` report DR1, C186, C195 pass or fail and the DR1 figures `rows`. Acceptance:
`git status` clean after build; the figures in the hand-back. Escalate if: anything fails before any change.

**V1. Contrast proof for the new pairs (Sonnet builder).** Files: `tracker/tests/lists-roles.test.js`. Steps: in the
21-theme loop add, per mode and per role, asserted at 4.5: `--ink-2` on the role's wash (facts line on a washed row) and
`--ink` on the wash (exists; keep); asserted at 3: the role's graphic tone on its wash (row frame, primary edge) and on
`--slab` is printed only. Acceptance: the suites pass; the hand-back lists the lowest figure per pair. Escalate if: a pair
fails. Fallback the builder may apply without escalating: on washed rows `.l2`, `.l3` take `--ink`; the frame uses
`--ink` in place of `--g`; say which.

**V2. Heads and rail (Sonnet builder; needs V1).** Files: `lists.css`. Steps: section 4 "Section head", "Job head",
"Zone and city sub-heads", "Rail". Acceptance: as above; at 1440 px light no head has a background equal to a role fill
(look at `get` and `craft` pictures from C186's `r3-*`). Escalate if: a 48 px head or the 24 px sub-head budget breaks,
or a check reads a head's colour.

**V3. Row states on To get and Wanted (Sonnet builder; needs V2).** Files: `lists.css`, `lists.js` (`rowHtml`,
`getRow`, `tickWindows`, the wanted row, `crafted`). Steps: section 4 "Count block", "Row body", "Have and need
control", "Primary" and the state table, except To craft readiness. Acceptance: as above; DR1's `p2Rest`, `a1Primary`,
`f1Filled`, `focus` and `clipped` stay empty. Escalate if: a row grows; a focus ring is cut by the inset frame; a check
reads the class string of `.lr`.

**V4. Craft "can be made now" (Sonnet builder; needs V3).** Files: `lists.js` (`craftRow`, new `matsInHand`),
`lists.css` only if V3 did not cover `.craft-row`. Steps: the state table's To craft line; shape only. Add a key line
only if the owner chose it in Q1, with exactly the words the owner approved, once per screen (rule W2). Acceptance: as
above; with nothing typed every craft row is `wait`. Escalate if: an ingredient has no plan line, or the result differs
between the list view and the combined view for the same lists.

**V5. Check block `LV2` (Sonnet builder; needs V4).** Files: `tracker/command-center/check.js`, one new block after
C195, reusing `dr1Page` (with a fixed clock as C186 does) and `dr1Seed`. Steps: type 1 into the stepper of one To get
row whose need is above 1; assert, at 1440 × 1000 light and 360 × 800 dark: that row has `data-have="some"` and its
`::after` fill width is within 2 px of `p ×` its track; every `.lr[data-st]` in a gather section has a line 3 holding
"open now" (for `act`) or "opens" (for `wait`); with the clock set 30 s before a window opens, the row turns `act` within
16 s without a reload; `.sec-toggle` and `.job-head` backgrounds equal the computed slab colour; at most one `.lbtn-p`
outside sheets and notices; the DR1 helper reports no problem on the seeded screens. Each assertion is broken once on
purpose and seen failing, as DR1 does. Acceptance: `npm run check` passes with `LV2`; the run grows by at most one
minute. Escalate if: the window flip cannot be shown without a reload.

**V6. Pictures and the bold test (Sonnet builder; needs V5).** Files: none in the repository. Steps: with the
scratchpad tool `/tmp/claude-0/-home-user/1028d349-88ea-563e-8012-3fbb9c84a89a/scratchpad/themes/shoot.js`, env
`OUTD=<new folder in the scratchpad>` and `VARIANTS` (JSON list of [tag, viewport, light|dark, theme id] in the form the
script's head documents): default light, default dark, `azure-dragoon` dark, `uldah-sultanate-gilt` light,
`magitek-steel` light, `ultima-thule` dark, each at 1440 and 360, for To get, To craft and Wanted. If the script's seed
types no stock, extend the scratchpad copy so a few rows have some (examples, never committed) and shoot both. Write one
sentence per picture: "bold" or "still tame: <what>", and list every phone difference from the accepted phone pictures.
Acceptance: the pictures exist and the hand-back has the sentences. Escalate if: a phone picture is worse than before
(taller rows, cut text, lost words).

Records in `docs/STATE.md` are the orchestrator's after the owner's answer, not an item here.

## 7. Will not change

The engine, the store, the save and `save.js`, the data and its tools, the price service, the words on screen (except a
key line the owner approves in Q1), the list head, the Your lists cards, the sheets, the status line, the empty states,
the crafting log screens, the token block and the roles document, every hook a check reads.

## 8. Risks, and the first thing to verify

- **First: V1.** The washed "can be done now" row puts `--ink-2` and the role's graphic tone on the role's wash; neither
  pair is proven today. The fallback is written into V1.
- A fresh list with nothing typed is honestly uniform: every craft row waits, every To get row is solid. Variety shows
  once the player types stock; V6 shoots both states so the owner judges both.
- The tick flip (V5) depends on the 15-second timer under a fixed clock; if Playwright's fixed time stalls it, escalate
  rather than test only after a reload.
- Fills stay the fixed colours of rule K3. If the pictures still read "on top of the theme" in Ul'dah Gilt or Ultima
  Thule, the next step is theme-mixed fills through `tools/lists-roles.js` (a separate spec; all field contrasts re-proven).
- In dark themes the slab is the pale ink colour, so heads become pale bands; this is how Submersibles' heads behave.

## 9. Owner questions

**Q1. Saying that a craft can be made now.** To craft would draw a solid count block when everything a craft needs is in
what you typed, and an outlined block when it still waits for materials, an earlier craft or its recipe book.
- Shape and one key line under To craft (recommended), for example "Solid count: everything this craft needs is in what
  you typed. Outlined: still waiting for materials, an earlier craft or its book." The meaning is on screen in words.
  Costs one sentence of new text. Risk: little. Fairly sure it reads well.
- Shape only, no new words. Nothing new to read; you learn the meaning by use. Risk: the outline may be read as
  decoration. Moderately sure.
- Keep things as they are: no craft readiness; To craft changes only in its heads and finished rows. No cost; the To
  craft rows stay alike, which is what you named.

**Q2. The main button on a row that can be done now** (a node open now; a craft that can be made now).
- Outline with a coloured band under it (what this spec builds, within your rule of 2026-11-23 that row buttons are
  outlines). A little colour where it matters. Risk: may still feel quiet. Fairly sure it stays clean.
- A filled colour block on those rows only. Louder, closer to the Submersibles "Send" block. Changes your rule of
  2026-11-23 and the check that holds it; costs one small item. Risk: on a list with many open nodes, many loud blocks.
- Keep things as they are: a plain outline on every row. No cost; no state on the button.
