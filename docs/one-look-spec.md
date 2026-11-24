# One look for the whole Command Center: spec (first gate, mock-ups only)

Written 2026-11-24 for a Sonnet builder. Owner's request: "this is ONE app so all the aesthetics of everything need to
look cohesive"; on Lists, "still a little bland... Maybe take inspiration in the atelier". Read for this spec:
`CLAUDE.md`, `docs/design-rules.md`, the headings of `docs/submersibles-look-spec.md`, `docs/lists-look-v2.md`,
`atelier.js` lines 1338 to 1410 (THEMES, `applyLook`), `atelier.css` lines 1 to 80, `build.js` lines 37 to 41 (how
`look.js` is made), the token lines 4 to 20 of `subs.css`, the `--slab`/`--molten` lines of `lists.css`. Pictures opened:
`sheet-default-light.png`, `sheet-azure-dark.png`, `atelier2-default-light.png`, `tracker2-azure-dark.png`,
`themes/v2/get-desktop-default-light.png`, `evidence/look-board-desktop.png`. Nothing was built or run.

## 1. Goal and constraints

- One design language for every screen, drawn first as static mock-ups the owner approves before any module changes.
- This gate writes only `docs/one-look/` (mock pages, two tools, pictures). No file under `tracker/`, `crafting/`,
  `.github/` changes; no app code in the mocks; `npm run build` leaves `git status` clean.
- Offline-first, public, GitHub Pages: the mocks load only repository files (the site's own `fonts.css`), no CDN, no
  personal data (the fixture names already on the real screens, "Tamsin Reed" and "Joss Marlowe", are fine).
- Never automate or read the game; never invent game data. Every figure in a mock is copied from a real screen or from
  the built app run locally with fixture input; each mock page carries the foot line "Mock-up. Figures are examples
  from fixture data." (design rules, section 12 step 2).
- Every rule of `docs/design-rules.md` holds, except the two departures in section 2.10, which are owner questions.

**Findings checked.** 1 to 3 and 5: confirmed on the sheets (four header layouts; Atelier has its own "Command Center"
link, language select and Settings; Tracker has search and an "ET" clock and no module nav; field and button shapes
differ). 4: confirmed by picture (Atelier in Azure Dragoon dark shows a near-black teal page, not Azure's navy); the
cause is not verified (the Atelier keeps its own look state, `S.look`, while `look.js` reads `eveniunt-tracker-ui`).
Also seen: the Atelier tag line ("NETWORK COMMAND CENTER") and figure fields break T2 (mono on words, serif on figures);
Home cards and the Atelier recipe card carry shadows (M2); the Tracker's status message is a rounded pill (S1).

## 2. The shared design language: "the workbook"

One idea: every screen is a page of one crafter's workbook. The Atelier gives the book (title page, numbered chapters,
serif names, underlined fields, dotted leaders, the seal button); Submersibles gives the ink (the inverted answer slab,
slanted state blocks, huge condensed numerals, hatching). Each screen has exactly one slab (its answer), chapters on
paper below it, and colour only in state blocks.

### 2.1 Tokens (all reused unless marked new)

- Theme, from `look.js` `applyLook` (contrast 50): `--paper --paper-2 --paper-3 --slip --ink --ink-2 --ink-3 --rule
  --grid --seal --on-seal --hi --ochre --lb-a --lb-b --lb-c --lb-glow`.
- Derived, from `subs.css`: `--slab: var(--ink)`, `--on-slab: var(--paper)`, `--on-slab-2`, `--molten`, `--hazard`,
  `--f-disp` (Big Shoulders), `--f-kick` (Cinzel); from `atelier.css`: `--f-serif` (Fraunces), `--f-body` (Atkinson),
  `--f-data` (IBM Plex Mono).
- State hues (one hue per meaning in every theme, rule K3), from `subs.css` lines 4 to 6 with their light and dark
  values: `--back`/`--on-back` (ready, go), `--out`/`--on-out` (under way), `--idle`/`--on-idle` (waiting, not sent),
  `--bad` (problem), `--locked` plus `--hazard` (locked or unknown); washes `--back-bg --out-bg --idle-bg`.
- Kind hues (what sort of thing): the Lists `--lr-*-fill` set with its pointers `--f --g --s --w --on-f` (copied from
  `lists.css`), the Submersibles `--rank-* --gil-* --loot-* --route-*` fallbacks (`subs.css` lines 10 to 14).
- **New** (layout only): `--slant: 25deg`; `--line-2: 2px solid var(--ink)`; `--line-dbl: 4px double var(--ink)`;
  `--line-row: 1px dashed var(--rule)`; `--leader: radial-gradient(circle, var(--ink-3) 1px, transparent 1.4px) 0 72% /
  6px 4px repeat-x`; spacing `--s1..--s8` = 4, 8, 12, 16, 24, 32 px; `--content: 1440px`; `--r: 0` (no radius anywhere).
- Mapped, Atelier names: `--ok` becomes `--back`; `--verd`, `--indigo` stay Atelier-only kind hues (durability, CP).

### 2.2 Type: one job per face (rule T1)

| Role | Face | Desktop / phone |
| --- | --- | --- |
| Answer numeral and answer word in the slab | Big Shoulders 900, uppercase | 96 / 56 px |
| State block figure / state word | Big Shoulders 900, uppercase | 40 / 32 px; word 22 / 18 px |
| Chapter numeral (I, II, III) | Fraunces 400 italic, `--seal` | 48 / 32 px |
| Chapter and page title | Fraunces 600 (**departure, Q1**) | 28 / 22 px |
| Subtitle under a title | Fraunces 400 italic, `--ink-2` | 15 / 13 px |
| Names from the game or the player (rows, lists, companies) | Fraunces 600 | 17 / 16 px |
| Kicker over a title, index group names | Cinzel 700, uppercase, letter-spacing .32em | 11 px |
| Reading text, facts line | Atkinson 400 / 13 px for facts, `--ink-2` | 15 / 13 px |
| Labels | Atkinson 700, 11 px uppercase .12em (F4) | 11 px |
| Buttons, links | Atkinson 700, sentence case (T5) | 15 / 14 px |
| Figures (counts, times, prices, stats, percentages) | Plex Mono 600 (T2) | 15 px; field values 20 px |
| Seal label (the screen's one main action) | Fraunces 900 italic (**departure, Q2**) | 32 / 24 px |

### 2.3 The header (one for every page)

Desktop (701 px and up), one row 88 px high, content width, then `--line-dbl` across the full window:
`[Main menu]` (40 px, icon plus word, 2px `--ink` frame, as built) · wordmark (EVENIUNT kicker in Cinzel, module word in
Big Shoulders 56 px with the molten fill, three-bar slanted gauge, all as built) · **tool slot** (flex, left aligned,
items 40 px high) · app nav (Home, Tracker, Atelier, Submersibles, Lists, Settings; Atkinson 700 14 px; current page
underlined 3 px `--seal`). The Atelier tag line and the Atelier's "Command Center" link and own Settings go away.
Tool slot per module: Tracker, the search field (underlined field 320 px, label "Search everything" visually above at
11 px) and the Eorzea clock as a small slab block (`ET` label 11 px, `19:14` Plex Mono 600 18 px, local time 11 px);
Atelier, the language select (underlined); others, empty.
Phone (up to 700 px): row 1, 56 px: Main menu (icon plus word) and the wordmark at 40 px; the app nav is not shown
(Main menu leads to it). Row 2, 48 px, only if the tool slot holds anything: Tracker search full width with the clock
block at its right; Atelier language select at the right. Then the double rule.

### 2.4 Page structure

Page ground `--paper` with graph paper (`--grid`, 24 px squares, as on Submersibles and Lists). Desktop: a module with
views has the 88 px rail on the left (icon over word, Big Shoulders 13 px uppercase; current entry on the slab with a
3 px molten left edge, as Lists v2); the Tracker's rail is its index (280 px, section 2.6 index lines); the Atelier has
none. Content column max `--content`, 24 px gutters. Top of every screen: the **answer slab** (full content width,
`--slab` ground, `--on-slab` text, 3 px `--molten` bottom edge): kicker, title or name in Fraunces, and the answer as
numerals or state blocks at the right. Below it, chapters. Phone: 12 px gutters, rail becomes the bottom bar (56 px),
answer slab stacks (name over the answer numeral), no sideways scroll at 360 px (P1).

### 2.5 Chapter heads (sections)

On paper, no fill: `[numeral] [title / italic subtitle] ... [state summary]`, then `--line-2` under the whole head. The
state summary (C4) is one or more slanted state blocks at 40 px height (figure 28 px plus label 11 px), or a Plex
figure for a plain count. Closed chapter: the same head, 48 px min, chevron at the left of the numeral. Sub-groups
(zone, Lv band, folder group): Fraunces 400 italic 17 px name, count at right in Plex `--ink-3`, `1px solid --rule`
under (the Atelier "Lv 1–5" line).

### 2.6 Rows

Two kinds only.
- **Index line** (reference, navigation: Atelier recipe list, Tracker index, Home contents): 32 px; name in Fraunces
  600 16 px, `--leader` filling the gap, figure at right in Plex (or Fraunces italic for a level, as the Atelier does).
  Chosen line: `--hi` ground, 3 px `--seal` left edge. No frame.
- **Ledger row** (a thing with a state: an item to get, a submarine, a folder's progress): inside one ledger per chapter
  framed by `--line-2`, rows split by `--line-row` (C5). Anatomy at 1440 px, 56 to 64 px high: state block 88 px wide at
  the left with its right edge slanted at `--slant` (Submersibles' BACK wedge; Lists' count block) · name (Fraunces 600
  17 px) over a facts line (Atkinson 13 px `--ink-2`, figures inside it in Plex) · flexible middle (timeline, progress,
  leader) · answer figure at right (Plex 600, or Big Shoulders 40 px when it is the row's answer, as "1 h") · one row
  action (outlined, owner decision of 2026-11-23) and More. Phone: 64 px block, two lines, at most 96 px (P2).

### 2.7 State blocks (the approved Submersibles blocks, made the one way to show state)

Form says the state, fill says the meaning (K4: always with its word):
- **Solid** (can be done now / current): role fill, `--on-*` text, word or figure in Big Shoulders. Row ground becomes
  the role wash with a 2 px inset frame of the role's strong tone (the Submersibles Back lane).
- **Outlined** (waiting): 2 px outline in the role's graphic tone, `--slip` inside, text in the role's text tone.
- **Hatched** (locked, unknown): `--hazard` over `--slip`, word on a small `--slip` plate with 2 px `--ink` frame
  ("LOCKED").
- **Done**: `--back` fill with the word "Done" or "Finished" (as the row already says).
Fill is a state hue where the thing is a state (Submersibles: back, out, idle) and a kind hue where it is a kind (Lists:
merchant, crystals, gather, other currency; Atelier: progress `--ochre`, quality `--seal`, durability `--verd`, CP
`--indigo`). Slant drawn with `::before` + `skewX(var(--slant))`, never `clip-path` on anything focusable (A6).

### 2.8 Numbers, fields, buttons

- Numbers: the screen's answer at 96 px in the slab (C2); state figures 40 px; everything else Plex 15 px, tabular. A
  figure the app does not have reads "unknown", never 0 (S5).
- Fields (Atelier): no box; 40 px; 2 px `--ink` underline; label above in the label style; value in body, or Plex 600
  20 px when it is a figure. Focus: underline 3 px `--seal` plus a 2 px `--seal` outline, offset 2 px. Select: same, with
  a drawn stroked chevron. Checkbox: 18 px square, 2 px `--ink`; checked fills `--seal` with an `--on-seal` tick.
  Stepper (F5): minus, figure, plus; 2 px `--ink` frame; 40 px cells.
- Buttons, square, no shadow:
  - **Seal** (primary, one per screen, its main action: Solve, Start the setup, New list, Sign in): `--seal` fill,
    `--on-seal` text, 2 px `--on-seal` frame inset 4 px (the Atelier "Solve"), 64 / 48 px high, seal label; optional
    key hint in Plex 11 px in a 1 px frame.
  - **Primary, small** (one in a sheet or notice): same fill and inset frame, 40 px, Atkinson 700 15 px.
  - **Secondary** (row actions, "Send all back"): transparent, 2 px `--ink` frame, `--ink` text, 36 to 40 px.
  - **Quiet** ("Copy item name", "Copy to all jobs"): text, Atkinson 700, 2 px `--seal` underline offset 3 px.
  - Segmented choice (A5): 2 px `--ink` frame; chosen part on the slab.
- Status line (S1): slim 44 px slab bar with a 4 px `--seal` left edge, bottom centre, Undo as a quiet link.

### 2.9 Empty states, lines, texture

Full empty state as built in Submersibles and Lists (E1): slab kicker plate, Big Shoulders headline, one sentence, up to
three numbered steps with slanted number blocks in three kind hues, the seal button, a decoration panel marked
`aria-hidden`. An empty part (the Atelier "Pick a recipe" box) is the dashed empty line (E2). Lines: `--line-dbl` under
the header, `--line-2` under chapter heads and around ledgers, `--line-row` between rows, `--leader` in index lines,
3 px `--molten` under the answer slab and on the current rail entry. Texture: graph paper on the page, hatching only
for locked or unknown. Nothing else: no shadows, no radius, no pills, no glass, no grey cards.

### 2.10 Themes, light and dark

Every colour comes from the tokens of 2.1. The 21 themes of `look.js` (the 20 Atelier themes plus Electrope Skyline,
added by `build.js`) set the theme tokens; state and kind hues keep their hue and take the light or dark values. The
mock reproduces this with a generated `themes.css` (item M1), switched by `data-look="<theme id>"` and `data-mode="light|
dark"` on `<html>`. Departures from `docs/design-rules.md`: T1 (chapter titles in Fraunces instead of Big Shoulders) and
T5 (seal label in Fraunces 900 italic); both wait on Q1 and Q2.

## 3. The six screens

- **Home** (contents page). Slab: "Welcome back, Tamsin" in Fraunces, characters as quiet links, and at the right one
  state block per module with its live figure (Submersibles "back now", Lists "to get", Tracker "everything" percent).
  Chapter I "Modules": a ledger, one row per module (block in the module's hue with its icon, name, live line, "Open"
  as quiet link). II "Cosmic Exploration" and III "On the way" as index lines. Uses: slab, state blocks, ledger, index.
- **Tracker overview** (an index and a ledger). Rail: the folder index (Cinzel groups LIVE, CHARACTER, DUTY; index lines
  with each folder's percent). Slab: "Everything", one answer numeral per character. Chapters I Character, II Duty...:
  ledger rows, one figure column per character (Plex percent over a 4 px `--ochre` bar); a folder at 100 % gets the
  Done block. Tool slot: search and clock. Seed: tick a few items in the built Tracker; never type a percentage.
- **Atelier, recipe chosen and solved.** Chapter I Recipe: Recipe / Stellar missions / Custom as a segmented choice,
  search field, index lines (Maple Lumber chosen). Chapter II Crafter stats: underlined fields, job strip as a segmented
  choice, the Solve seal. Slab (after solving): "Maple Lumber", state blocks Progress Done, Quality (figure over max),
  Durability left, steps count; Chapter III The work: the step ledger. Content copied from the built Atelier
  (`crafting/atelier/site/`) after choosing Maple Lumber with the fixture stats and pressing Solve.
- **Submersibles board.** As approved (`look-board-desktop.png`): slab "Next back: 1D 3H" with the Back now, Out, Idle,
  Locked blocks; per free company a chapter head (numeral, "Alpha Company", italic "Gilgamesh", the company's blocks at
  right, "Send all back" secondary); lanes as ledger rows with the BACK/OUT/IDLE/LOCKED wedges, timeline, the answer
  figure and the Send seal-small. Changes from approved: company heads leave the slab for paper chapter heads; the rail's
  current entry goes on the slab; mono figure labels stay figures only.
- **Lists, To get** (mixed states, from `themes/v2/get-desktop-default-light.png`). Slab: list name in Fraunces, "Tamsin
  Reed" kicker, the 1563 to get / 215 to craft / 4074 to earn blocks, "List settings" secondary. Chapters I Buy from a
  merchant, II Crystals, III Gather, IV Trade for other currencies, V Currencies to earn, VI Left over, each with its kind
  block and count; zone sub-groups in italic. Rows in all forms: solid (open now: Windspeed Water), outlined (opens later:
  Fire Cluster), have-some progress line (Fire Crystal, have 1 of 8), done (one wanted row). The Atelier pieces: numerals,
  serif names, italic sub-groups, a dotted leader from name to the "need" figure on desktop.
- **Settings** (the book's front matter). No slab answer figure: slab holds "Settings" and the sync state block (Solid
  Back "Synced" or Outlined Idle "Not signed in"). Chapters I Cloud sync, II Characters and free companies, III Backups,
  IV Notifications, V Appearance: underlined fields, secondary and quiet buttons, one seal ("Sign in with Microsoft").

## 4. Work items

Every item: on a branch named `one-look-mock`; write only the files named; never merge or push to `main`; report what
ran and what did not. Common acceptance: `npm run build` then `git status --porcelain` shows only paths under
`docs/one-look/`; `npm run test:unit` passes (nothing in the app changed).

**M0. Baseline (Haiku clerk).** Files: none. Steps: `npm ci`, `npx playwright install chromium`, `npm run build`; count
the theme entries in `tracker/command-center/site/look.js` (expect 21) and list their ids; confirm
`tracker/command-center/site/fonts.css` and `crafting/atelier/site/` exist. Acceptance: clean `git status` after build;
ids in the hand-back. Escalate if: build changes a file, or the count is not 21.

**M1. Themes and the kit (Sonnet builder; needs M0).** Files: `docs/one-look/tools/make-themes.mjs`,
`docs/one-look/tools/verify-themes.mjs`, `docs/one-look/mock/themes.css`, `docs/one-look/mock/one-look.css`,
`docs/one-look/mock/kit.html`. Steps: (1) `make-themes.mjs` reads the THEMES array from the built `look.js` and writes
42 blocks `html[data-look="id"][data-mode="light|dark"]` with the theme tokens computed by the same formulas as
`applyLook` at contrast 50, plus the derived and state tokens of 2.1 per mode; output sorted and stable. (2)
`verify-themes.mjs` opens the built Command Center page with Playwright for the four pictured pairs (setting the stored
appearance choice the way `look.js` reads it), reads the computed theme tokens on `<html>` and compares them with a mock
page in the same pair. (3) `one-look.css`: every element of section 2, only `var()` colours. (4) `kit.html`: every
element of section 2 once (header desktop and phone, slab, chapter head open and closed, sub-group, index line, ledger
row in the four block forms, fields, stepper, checkbox, the five button kinds, segmented choice, status line, empty
state, empty line), with the theme picker as plain links that set the two attributes. Acceptance: run `make-themes.mjs`
twice, `git diff --exit-code docs/one-look/mock/themes.css` after the second; `node docs/one-look/tools/verify-themes.mjs`
exits 0 for all four pairs; `grep -nE '#[0-9a-fA-F]{3,8}|rgb\(|oklch\(' docs/one-look/mock/one-look.css` finds only
the state and kind token block; `grep -n 'border-radius\|box-shadow' one-look.css` finds only `0` or `inset`; no `http`
URL in any mock file. Escalate if: the stored-choice format cannot be found, or a token differs.

**M2. The six screens (Sonnet builder; needs M1).** Files: `docs/one-look/mock/{home,tracker,atelier,submersibles,
lists,settings}.html`, additions to `one-look.css` only for screen layout. Steps: section 3, one page each, built only
from kit classes; text and figures copied from the named real screens (Tracker and Atelier seeded by hand in the built
apps, fixture data only); no `<script>` except a 5-line one that reads `?look=&mode=&heads=&seal=` into the `<html>`
attributes; `data-heads="book|caps"` and `data-seal="book|caps"` variants for Q1 and Q2 (caps = Big Shoulders uppercase,
as built in Submersibles); the foot line of section 1 on every page. Acceptance: each page opens from the file system
without errors in the console (checked by M3's run); at 360 px no sideways scroll. Escalate if: a figure cannot be
produced from the real app (never invent one), or a screen needs an element the kit lacks.

**M3. Pictures and measures (Sonnet builder; needs M2).** Files: `docs/one-look/tools/shoot.mjs`,
`docs/one-look/pictures/*.png`, `docs/one-look/pictures/measures.json`. Steps: Playwright, viewport screenshots of each
screen at 1440x1000 and 360x800 in `crystarium-dawnglass` light and dark, `azure-dragoon` dark and
`uldah-sultanate-gilt` light (48 pictures, named `<screen>-<1440|360>-<theme>-<mode>.png`); the six desktop shots per
pair tiled into `sheet-<theme>-<mode>.png` (4); the Q1/Q2 variants (`heads=caps&seal=caps`) at 1440 default light (6).
Measures per picture: sideways scroll (P1); largest text size and whether it is a figure or state word (C2); a slab in
view; heaviest line; every Plex element holds a digit (T2); ledger row heights at rest (P2, P4); first row's distance
from the header on phone (P3); console errors. Write one sentence per picture in the hand-back: "bold" or "still tame:
<what>". Acceptance: `node docs/one-look/tools/shoot.mjs` exits 0 and writes 58 PNGs and `measures.json`; no measure
fails, or each failure is listed. Escalate if: a measure fails that the layout cannot meet without departing from a
design rule.

Records in `docs/STATE.md` and the owner's gate are the orchestrator's, not an item here.

## 5. Later steps (not designed now)

- One shared stylesheet built from `one-look.css` into the shell, the Tracker and the Atelier by their build scripts.
- One masthead helper with the tool slot, used by the shell, the Tracker and the Atelier (the Atelier's own header goes).
- The Atelier taking the shared theme from `look.js` / the shared appearance choice (find the cause of finding 4 first).
- Token unification: Atelier `--ok`, Tracker `shared.css` colours, Home and Settings cards onto 2.1; modules stop
  setting shared tokens (M3).
- Moving each module, one pull request each (suggested order: Home and Settings, Lists, Tracker, Atelier, Submersibles),
  keeping every class, `data-*` and text a check reads (DR1, L1, C186, C195) and the save untouched.
- A drift check: a browser check comparing computed header, chapter, field and button styles across the six screens,
  and a unit test that no module stylesheet redefines a shared token.
- The design-rules amendment for whatever Q1 and Q2 decide.

## 6. Risks, and the first thing to verify

- **First: M1 step 2.** If the mock's theme tokens do not match the live page, every picture misleads the owner.
- The formulas in `make-themes.mjs` are a copy; the later shared stylesheet must use `look.js` itself, not this copy.
- Fixed state hues on themes like Ul'dah Gilt may still read "on top of the theme"; the sheets will show it.
- Paper chapter heads remove dark bands from Submersibles and Lists; the screen may feel lighter. The slab plus state
  blocks must carry the weight; M3's bold test reports it.
- 58 pictures add several megabytes to a public repository.

## 7. Owner questions at the mock-up gate

**Q1. How section titles look in every module.** Recommendation: the book style.
- Book style (the Atelier's): a Roman numeral, a serif title and an italic line under it, on the page colour. Every
  module reads like the Atelier; Lists and the Tracker gain the character you pointed to. Costs a change to one house
  rule and to the approved Submersibles company heads. Risk: Submersibles feels a little less heavy. Fairly sure.
- Poster style (the Submersibles'): tall condensed capitals, Lists-style dark bands. The Atelier changes most. Costs the
  same work; risk: the Atelier loses what you liked in it. Fairly sure it stays bold.
- Keep things as they are: each module keeps its own titles; the rest of the one look still applies. No cost; the four
  styles remain visible, which is what you asked to end.

**Q2. The main button of each screen** (Solve, Start the setup, New list). Recommendation: the seal.
- The Atelier's seal: coloured block with an inner frame and a large italic serif word. One shape for the main action
  everywhere. Costs one house-rule change. Risk: little. Fairly sure.
- Condensed capitals ("START THE SETUP"), as in Submersibles and Lists. Costs one Atelier change. Risk: little.
- Keep things as they are: each module keeps its own. No cost; the main action looks different per page.

**Q3. Whether the approved Submersibles screens may change** (company heads onto the page colour, current tab on the
dark band, the shared header and fields; lanes, state blocks and the top summary stay). Recommendation: the first.
- Change the shared parts only. One app; costs one later pull request; risk: some of the weight you approved moves.
- Change nothing in Submersibles; the other modules move toward it. Costs nothing there; risk: Submersibles stays the
  odd one if Q1 is the book style.
- Keep things as they are: no one-look work at all. No cost; nothing becomes cohesive.

The pictures of M3 show both answers of Q1 and Q2 side by side, so each can be decided from the pictures.
