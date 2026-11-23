# Lists: the look (redesign): spec

Written 2026-11-23, for the Lists module that was taken back for a redesign (`docs/STATE.md`). It redraws every screen
under `docs/design-rules.md`. **Behaviour and the save do not change:** everything in `docs/lists-spec.md` stays as
built (sections 4 to 8 and the "built" notes of W6 to W16).

Read for this spec: `docs/design-rules.md` and its sources; `docs/lists-spec.md` sections 1, 2, 4 to 8, 10 and 11; ten of
the eighteen pictures in `docs/lists-redesign/before/` (To get, To craft, Wanted, Your lists, combined view, crafting
log, Order of ways, Left over and the empty page at 1440 px; To get and To craft at 360 px); four of the approved
Submersibles pictures (`evidence/look-board-desktop.png`, `look-board-phone.png`, `look-log-desktop.png`,
`look-empty-log-phone.png`). **Not read: the Lists code.** It is not in the working copy (it is in the history at the
merge commit of pull request 4), so every class, `data-*` hook and exact text the checks read is unknown here; item M0
lists them before anything is built. Not seen in any picture: the patch notice, the "Restored list" card, the new-list
step, a list with steps, "For which character?", a refusal line. Nothing was built or run. Every size below is a
design figure; M1 measures it.

## 1. Goal and constraints

- Every Lists screen follows the 58 rules of `docs/design-rules.md` and reads as the same family as the approved
  Submersibles screens.
- **Look only.** No change to the engine, the store, the save section, `save.js`, `merge.js`, the price service, the
  data, the Tracker's link or the Atelier hand-over. Every control and every sentence of `docs/lists-spec.md` section 7
  stays reachable and keeps its words; this spec changes where a control sits, never what it does. New words are
  listed in section 5 and are the only ones.
- Offline-first, public, hosted on GitHub Pages. No new external resource; no game artwork. The app never reads or
  automates the game. No invented number: a mock-up figure that is an example is labelled as one, and decoration
  measures nothing.
- All 21 themes, light and dark; the Appearance settings; 360 px without sideways scroll; text 4.5:1.
- The undo, the refusals, the limits and the confirms behave as built.

## 2. Decisions (alternatives rejected in brackets)

- **L1 One idea for the module: a plan you work down.** Every row leads with a count block (a large numeral on a
  solid role field) that says how many are left; the row's one action makes that number fall. [A table with columns:
  folds badly at 360 px and reads as a spreadsheet. Cards per item: the boxed rows that were rejected.]
- **L2 A row has two states.** At rest: count block, name, one line of facts, the primary. Opened: a drawer under the
  row with the reason, the stock stepper, "Get it by" and the other actions. One row is open at a time. [A floating
  "⋯" menu: selects and steppers do not belong in a menu, and it is hard to place at 360 px. Everything at rest: the
  460 px row.]
- **L3 The list's views are the tab bar** (rail from 701 px, bottom bar on a phone): Lists, To get, To craft, Wanted.
  [Buttons above the content, as built: design rule A4.]
- **L4 The list head is an inverted slab that says the answer**, with one "List settings" control; the form moves into
  a sheet. [An always-open form: rule F1.]
- **L5 Status and undo are one slim line fixed at the bottom**, above the bottom bar on a phone. [At the top of the
  page as buttons: rules S1, S2.]
- **L6 Section and job heads are solid role fields; rows under a head are one ledger.** [Pale washes and a box per
  row: rules K7, C5.]
- **L7 The six meaning roles keep their hues** (craft 250, gather 140, merchant 80, market 315, ready 195, short 25)
  and gain the tones the kit needs: a solid field with its text, a graphic tone, a text tone and a wash. [New hues:
  nothing wrong with the six; the fault was using only the wash.]
- **L8 Names:** item names in the body face, bold (they sit in dense rows); list names and character names in Fraunces
  (the player typed them); job names and section names in the display face. [Display face for typed names: uppercase
  only and Latin only.]
- **L9 The mock-ups come first and live in `docs/lists-redesign/`**, outside the built site. [Mock-ups inside the
  module's source: Lists is not in the working copy, and a mock-up must not ship.]
- **L10 Existing checks are changed only to reach a control that moved** (open the row, open the sheet), never in what
  they assert. Each such edit is listed in the hand-back. [Keeping every control at rest so no check changes: that is
  the rejected look.]

### Owner decisions of 2026-11-23 (after the mock-ups)

The owner approved the direction of the mock-ups ("I can work with these aesthetics") with the orchestrator's five
fixes, answered Q1 to Q3 (section 8) and added three requirements. Written by the orchestrator (Opus) because the
planning tier's model was over its usage limit; same-family.

- **F1 Quiet primary.** A row's primary ("Have all", "Made all") is an outline in the row's role colour with bold
  body text, not a filled accent block; the count block is the loudest thing on a row. The filled accent stays for a
  sheet's or notice's single primary only. [Filled pink on every row: eight identical loud blocks down a column.]
- **F2 No stamp that repeats its section.** A way stamp ("Merchant", "Gather", "Trade", "Market") is not drawn inside
  the section of the same way; it is drawn in the combined view and on Wanted rows, where sections are not by way.
  "Must craft", "Collectable", "High quality" stamps stay everywhere.
- **F3 Desktop row anatomy.** The chevron sits right after the name, not in the middle of the row. A craft row's
  progress is a single bar with its figure ("0 of 2 crafted"), filled in the craft role; an empty bar is a 2 px
  track in the line tone, never outlined boxes.
- **F4 Budgets.** The patch notice is a one-line slab under the list head ("Game data changed: 3 recipes in this
  list. Show"), opening into its lines; the first row stays within 200 px of the masthead. The trade drawer shows the
  chosen offer and a "Other offers (N)" opener instead of a full radio list, keeping the drawer within 360 px.
- **F5 Wording.** "Quality of Made" is "Quality made".
- **D-C1 Every crafter, no pick** (owner: "tell me all the crafters that can do it and don't make me or you pick
  one"). A craft row, a craft drawer and a Wanted row show every job that can craft the item, each as its icon with
  the job name for screen readers; no one is asked to choose. Measured on the pinned data: 600 items have recipes from
  two or more jobs; for 189 the ingredients are identical, for 411 they differ, for 8 the level differs. Where they
  differ the plan still counts one recipe: the existing default (lowest level, then lowest recipe id), said on the row
  in one line ("Materials differ by crafter; counted for Blacksmith"), with an optional "Count materials for" choice
  in the opened row that stores `ways.recipe` (already in the save; no save change). Crafting-log lists keep their
  page's recipe. "Made", "Bought it", credits and "Solve in the Atelier" follow the counted recipe. To craft's job
  heads group by the counted recipe's job; the other jobs show as icons on the row.
- **D-C2 Job icons** (owner: "the crafters and gatherers icons from the game on top of their names just like
  teamcraft does them"). The game's 8 crafter and 3 gatherer icons, from the pinned Teamcraft repository
  (`apps/client/src/assets/icons/classjob/<job>.png`; all 11 answer at commit `70429e21`), fetched by the data tool,
  size-checked, copied into the built site, cached by the service worker, never hot-linked; credited as Square Enix
  materials in `tracker/data/SOURCES.md` and the NOTICE. Sizes: 24 px on desktop rows and in drawers, 20 px on phone
  rows, 32 px on To craft job heads; each `img` has the job's name as `alt` (or `alt=""` with the name next to it).
- **D-G1 Gathering locations done properly.** Every spot of every gathered item, both jobs where Miner and Botanist
  can both gather it, with: the game's node name and level ("Lv. 5 Rocky Outcrop"), the zone, X and Y as the game's
  map shows them, the nearest aetheryte on the same map, the timed window, the unspoiled, ephemeral or legendary word
  (from the game's own name), the folklore book when one is needed, and a hidden-item note. Fish: the fishing spot's
  name, zone, X and Y, level. At rest a gather row shows the gatherer icons and the best spot in one line
  ("Lv. 5 Rocky Outcrop · Western La Noscea (X 26, Y 21) · Aleport"); the opened row lists every spot, best first,
  with "N more spots" folding the rest past three. Best spot: lowest level, then the shortest distance to its
  aetheryte, then lowest node id. An item with no position says "No map position in the game data" and names the
  zone if known; never a made-up place.
- **D-G2 Node names from the game, never hand-written** (owner: "check how the game actually has it, because that
  name can be completely wrong"). Each node's name comes from the game sheets: `GatheringPointName` rows 1 to 4 are
  mineral deposit, rocky outcrop, mature tree, lush vegetation patch; 5 to 8 their unspoiled forms, 9 to 12
  ephemeral, 13 to 16 legendary, 17 onward concealed; `GatheringType` 0 to 3 are Mining, Quarrying, Logging,
  Harvesting; `GatheringPoint` links a point to its `GatheringPointBase` (type, level, items), territory and place.
  The data tool derives each node's name row from the node's gathering type and its unspoiled/ephemeral/legendary
  kind, capitalises it as the game shows it ("Rocky Outcrop"), and **stops the build** when a node's name cannot be
  derived or the mapping between Teamcraft node ids and `GatheringPoint` rows does not hold. A test quotes five
  nodes' sheet rows by hand (one of each basic kind and one unspoiled). **Unverified:** that the in-game map writes
  the level as "Lv. 5" before the name; if the game shows it otherwise, only the row text changes.

## 3. The kit (shared by every Lists screen)

Sizes are for 1440 px, then "phone:" for up to 700 px, measured at 360 px. Faces: display = Big Shoulders 900
uppercase; kicker = Cinzel 700; data = IBM Plex Mono; body = Atkinson.

- **Masthead and tab bar.** The shell's masthead with the wordmark "LISTS" and the "Main menu" button, as built. On a
  phone it follows the Submersibles phone masthead (button and wordmark only, about 120 px; M0 confirms how the
  switcher is handled there). Rail (84 px wide) or bottom bar (64 px): a drawn stroked icon over a 12 px bold
  uppercase label, and beside the label the screen's count in the data face (11 px). Entries: **Lists** (always);
  **To get**, **To craft**, **Wanted** when a list is open; **To get**, **To craft** in the combined view. Current
  entry: a solid field (Lists: accent; To get: short role; To craft: craft role; Wanted: slab) with a 3 px molten edge.
- **Count block.** The left end of every row. Desktop 88 px wide, the row's height; phone 64 px wide. A solid role
  field whose right end is slashed 25° (a skewed pseudo-element, never `clip-path` on the row). Figure: display
  30 px (phone 26 px) in the field's text colour. Under it one word, 11 px bold uppercase: "to get", "crafts",
  "wanted", "ready", "left over". When the figure is 0 or the row is finished the block is the ready field.
- **Row.** Rows of one section are one ledger: a 2 px ink frame around the group, rows divided by a 1 px dashed rule,
  no frame per row.
  - Desktop grid `88px minmax(0, 1fr) 176px 140px`, at least 56 px, at most 64 px high: count block; main; stepper;
    primary.
  - Phone grid `64px minmax(0, 1fr) auto`, 72 to 96 px high: count block; main; primary (40 px high). No stepper at
    rest.
  - Main, line 1: the item name, body 700 16 px (phone: may wrap to two lines of 20 px), then stamps (11 px bold
    uppercase, 1 px edge, square): the way ("Merchant", "Trade", "Gather", "Market", "Craft") in its role's text
    tone, the quality ("Ordinary", "High quality", "Collectable"), "Must craft" where it applies. A 14 px chevron ends
    the line.
  - Main, line 2: 13 px, second ink, one line, clipped with an ellipsis: "need 9 · have 3" with the digits in the data
    face; then "4 held for “Other list”" when so; then, on desktop only, the first sentence of the reason. A timed
    window ("opens 14:00 Eorzea time, in 12 min") or a market price is a third line of 13 px on a phone and the right
    end of line 2 on desktop, digits in the data face.
  - The main cell is the opener: a `button` with `aria-expanded`, the whole cell tappable. So at rest a row shows two
    controls on a phone (opener, primary) and three on desktop (opener, stepper, primary).
- **Stepper.** Minus, the count, plus, joined, 2 px ink edge; desktop 3 × 40 px wide and 40 px high with a 64 px
  field; in a phone drawer 44 px high with a 72 px field. The figure is data 600 15 px. Its visible label "I have" is
  body 12 px bold: above it in the drawer, and on desktop as the 11 px uppercase word "have" inside the left of the
  field cell.
- **Drawer.** Opens under its row, inside the ledger, on the role's wash with a 6 px edge in the role's graphic tone.
  Padding 12 px 16 px. Order: the full reason sentences (14 px, ink); the stepper with its label (phone only; on
  desktop it is in the row); "Get it by" with its label and a full-width select (44 px), and under it "This applies
  wherever <character> needs this item."; then the row's other actions: at most two outline buttons (40 px) and the
  rest as text links on one wrapping line. A destructive link is in the short role's text tone and last. Phone: an
  opened row is at most 360 px high.
- **Primary.** The accent fill, body 700 14 px, 40 px high, at least 96 px wide, one per row. A row with nothing left
  to do has none.
- **Section head** (To get) and **job head** (To craft): a full-width `button`, 48 px, a solid role field, no frame
  of its own. Left: a chevron and the title, display 20 px. Right: the count, display 28 px, and before it any
  summary in data 13 px. Closed at first, as built; only open sections are drawn.
- **List head.** An inverted slab across the content, 5 px molten band along its bottom. Desktop at most 120 px,
  phone at most 152 px.
  - Left: kicker (11 px, spaced): the character's name or "No character" (the combined view adds "· Combined view");
    title: the list's name, Fraunces 900 28 px (phone 22 px), one line with an ellipsis; state line, data 13 px in the
    slab's second text colour: "one step" or "N steps", then "completed hidden" when it is on, then "prices:
    <place>".
  - Right: the caption "Totals for <character>:" (body 12 px bold) over two tallies in the Submersibles count-block
    form, figure display 44 px (phone 28 px) over its word: "to get" on the short field (ready field when 0), "to
    craft" on the craft field. They are the character's totals, exactly the two figures of the built sentence
    "Totals for <character>: 26 to get, 10 to craft."; the tallies' accessible text is that sentence.
  - Far right (phone: at the right of the kicker line): one outline control on the slab, a gear glyph and the words
    "List settings", 40 px.
- **Step strip** (only when the list has steps), under the head: one row that scrolls inside itself; each step is a
  44 px tab with its name (body 700 13 px) over its share ("N to get, N to craft", data 11 px); the chosen step has a
  3 px accent underline and the accent wash. When a step is chosen, "This step is handed in" is one outline button at
  the right end (phone: full width under the strip, 40 px). The sentence "A step's figures are its share of
  <character>'s plan…" is the screen's foot note.
- **Status line.** One element with `role="status"`, fixed: bottom centre, at most 720 px wide, 16 px above the page's
  bottom on desktop; full width directly above the bottom bar on a phone. Slab ground, slab text 14 px, a 4 px accent
  left edge, 40 px for one line, at most two lines (64 px) on a phone. It holds the last change as a sentence ("Chose
  how to get Mythril Bolt.") and its actions as underlined text links in the slab's text colour: "Undo"; an offer such
  as "Buy the rest too: on the market"; "Earlier changes (2)", which opens the earlier changes as a short list above
  the line, each with its own "Undo" link. It stays while there is something to undo, as built; nothing is timed. A
  refusal ("Not saved on this device: …", "Undo was not done: …") is the same line in the error form: a 12 px hatched
  edge in the short role and the full sentence, wrapping as needed. The page's content ends 72 px (phone 144 px) above
  the bottom so no row sits under it.
- **Sheet.** A dialog in the Submersibles sheet form: panel ground, 1 px ink edge, 4 px molten rule on top, title in
  Fraunces 900 22 px over a double rule, a labelled close, closes on a tap outside and on Escape. Desktop 560 px wide;
  phone full width from the bottom, its main action 48 px, full width and sticky.
- **Foot notes**, once per screen, 12 px second ink: "You type what you have. This app never reads the game." and the
  screen's own.

Colour roles used (all from the theme or the six Lists roles; no raw colour):

| Where | Role and tone |
| --- | --- |
| Page, panels, text, rules, slab, accent, molten | the theme |
| Count block, section head and tally for merchant and trade (told apart by the word); gather; market; craft | that role's field with its text |
| "to get" tally and count block when something is missing; Other; Not in your typed stock; refusals; destructive links | short |
| Count block at 0, finished rows, "N of M ready" | ready |
| Way stamps | the role's text tone |
| Drawer | the role's wash, edge in its graphic tone |
| Wanted count block; Left over | slab (no meaning of its own) |
| Empty-state panel | deep ground mixed from the theme, as the Submersibles empty state |

## 4. The screens

One sentence of idea each (design rule C1), then what is shown first, the anatomy, the actions and the phone fold.

### 4.1 Your lists: each character's plan at a glance

- **First:** per character, a slab head with that character's two totals as tallies.
- Top strip: left, the kicker "Your lists" and the number of lists as a display numeral (28 px) with the word
  "lists"; right, the primary "New list" and the outline "From the crafting log" (phone: two half-width 44 px
  buttons under the strip).
- Group per character, in the built order ("No character" as built): a slab head, 64 px: the name in Fraunces
  900 24 px; right, the two tallies (figure 28 px) with their caption; far right the outline "Combined view" (when
  lists are ticked it reads "Combined view (2)"). The sentences "Tick two or more lists of one character." and "Each
  character has its own stock." are the head's state line when they apply.
- List cards under the head, grid `repeat(auto-fill, minmax(340px, 1fr))`, gap 12 px (phone: one column). A card is
  96 px high, panel ground, 2 px ink edge, and the whole card is the link that opens the list.
  - Left block, 112 px (phone 88 px): the ready figure, display 44 px (phone 32 px), over "of 40 ready" (11 px bold
    uppercase), on the slab; on the ready field when all are ready; along its bottom a 6 px skewed bar filled to
    ready ÷ total (a ratio of the two figures shown).
  - Middle: the list's name, Fraunces 600 20 px, one line; then data 13 px: "2 steps · made 22 Nov" (both stored
    facts); a "Game data changed" stamp when the list's stamp differs from the page's.
  - Right: a 40 px labelled tick "In combined view" (the built tick; disabled as built for another character), and a
    40 px "⋯" whose menu holds "Remove list" (short role, confirm as built).
- "Restored list" group, last: see 4.9.
- Phone: tallies sit under the name in the head; the card keeps its three parts in one row.

### 4.2 A list, To get: a shopping ledger by where you go

- **First:** the list head, then the sections as solid heads in the built order, each with its count: Buy from a
  merchant (gil) (merchant field), Gather (gather), Trade for other currencies (merchant field; the word says
  trade), Buy on the market (market), Other (short), Not in your typed stock (short), Left over (slab).
- Row: count block "N / to get" in the section's role (merchant and trade rows add "(4 purchases)" in line 2); line 2
  as in the kit. Reason sentences ("Sold by <seller> in <zone> for 120 gil each. Planned as bought, because a
  merchant comes first."; "You chose this."; a loop's note; "needs Grand Company rank N") are complete in the drawer.
- **Primary: "Have all".** Desktop also shows the stepper. Drawer: the stepper (phone), "Get it by", and as links:
  "Craft it instead" on a merchant row planned by the order; on a trade row the other trades as a labelled radio list
  (each: seller, what is given for what); the full price line on a market row.
- Market section: under its head, one line, body 14 px with the digits in the data face: "Buying on the market, before
  tax: about 500 gil for 2 items; 1 item without a price (Mythril Bolt)"; at its right "prices seen 01:32" (data) and
  the text button "Refresh prices". The failure sentence, when there is one, is a note under it.
- Not in your typed stock: rows with no primary and the sentence "5 not in your typed stock: you said you already
  have these." in line 2. Left over: count block "N / left over" on the slab, the built sentence, no primary.
- Patch notice: see 4.10. Phone: as the kit; nothing else folds.

### 4.3 A list, To craft: a work order, job by job

- **First:** job heads in crafting order, each a solid craft-role field: a display order number (28 px) in a
  96 px block at the left, the job's name (display 20 px), and at the right "N crafts" (data 13 px).
- Row: count block "N / crafts" on the craft field; line 1 name and stamps; line 2: "makes 9", "spare: 2", "2 of 3
  crafted" on a must-craft row, "level 5" (the job is in the head). No stepper.
- **Primary: "Made all"** (owner question Q2). Drawer: outline buttons "Made 1" and "Bought it"; links "Got it another
  way" and "Solve in the Atelier" (only where the hand-over exists, as built); the quality choice as a segmented
  control when the wanted items ask for different qualities; "Get it by" (not on must-craft and collectable rows, as
  built). "Bought it" asks "How many did you buy?" in a small sheet, filled as built.
- "You recorded more than the materials typed here cover…" is a status line in the error form.

### 4.4 A list, Wanted: what you asked for, and adding to it

- **First:** the add field, the one purpose field of this screen: label "Add items", a 48 px field (desktop at most
  560 px wide) with the hint "Type part of an item name", and beside it the labelled "Amount" field (88 px). Results
  (25 at most) are a ledger under it: name, stamps, and the row itself is the add action, as built.
- Row: count block "N / wanted" on the slab; "finished" on the ready field once done; line 1 name and stamps (way,
  quality, "Must craft"); line 2: "need 3 · have 0", "2 of 3 crafted", the step's name.
- **Primary: "Finished".** A finished row has none (its drawer offers the built way to clear it). Drawer: "Amount"
  (labelled number field); the ticks "High quality", "Collectable", "Must be crafted by me" (only those the item can
  have, each a 40 px labelled tick); the step select when the list has steps; "Get it by" with its reason; the "I
  have" stepper; the outline "Bought it"; last, the link "Remove" in the short role (confirm as built).
- Foot note: "You type what you have. This app never reads the game. Clearing an amount keeps the old amount; only
  Remove removes."

### 4.5 The list head and its settings

- The head is in the kit. "List settings" opens a sheet titled "List settings" holding the built controls, each with a
  visible body-face label, in this order: "List name" (text); "Character" (select); "Steps": the list's steps by
  name, then "New step" (text) with the outline "Add a step"; "Hide completed" as a labelled switch row (the built
  toggle); "Market prices from" (select); the link "Order of ways". Footer: "Done" (48 px on a phone). Each control
  saves as it does today; "Done" only closes.
- "Refresh prices" moves to the market section's head (4.2), where the prices are.

### 4.6 Order of ways: a ladder of five rungs

- A sheet titled "Order of ways" (the built inline panel becomes a sheet; it opens from List settings and from the
  link in any drawer). First: the sentence "When an item can be got in several ways, <character>'s lists try them in
  this order:".
- Five rungs, 64 px each (phone: as tall as the sentence needs, at least 64 px): a number block 56 px wide, display
  32 px, on the way's role field (merchant, craft, gather, merchant with the word trade, market); the built sentence,
  body 14 px; at the right two 40 px icon buttons, up and down, with the accessible names "Move up" and "Move down"
  (disabled at the ends, dashed). The first rung carries the accent edge.
- Under the ladder the built paragraph, 13 px. Footer: primary "Close"; the text link "Back to the usual order".

### 4.7 The combined view: one plan for several lists

- The list screen with a different head: kicker "<character> · Combined view"; the title is the lists' names joined
  as built; no "List settings" (the built head offers Hide completed, Order of ways and the price place: here they
  are three text links in the state line, opening the same sheets). Tab bar: Lists, To get, To craft.
- Rows as 4.2 and 4.3; "4 held for “Other list”" in line 2.

### 4.8 From the crafting log: pick a page, see what is missing, create

- A panel with a slab head "From the crafting log". This is a create screen, so its fields are purpose fields: three
  labelled selects, "Character", "Job", "Page", in one row (phone: stacked, 44 px each).
- **First after the fields:** an answer block: a count block 120 px wide on the craft field with the number not
  ticked (display 44 px), and beside it "23 of 40 not ticked in the Tracker" (body 15 px, digits in the data face).
  Primary "Create" (48 px); the text link "Back".
- "For which character?": a ledger, one row per character, the whole row a button: the name in Fraunces 600 18 px,
  at the right its missing count (display 28 px) and a chevron; rows at least 56 px.
- Empty: "Everything on this page is ticked." as an empty line, no primary. No characters: the full empty state with
  the built sentence "Set up your characters in the Tracker first: the crafting log is read from what each character
  has ticked there." and the built "Back".

### 4.9 The "Restored list" card

- On Your lists, in a last group whose slab head reads "Restored list". One card per missing list, as built: 2 px
  dashed edge in the short role's graphic tone, a count block on the short field with the number of wanted items and
  the word "wanted", the built sentence, the primary "Put these in a new list" and the link "Remove" (short role,
  confirm as built). "Put these in a new list" asks for the character in a small sheet (default "No character"), as
  built. Neither offers undo, as built.

### 4.10 The patch notice

- A note block directly under the list head, on every tab of that list: a 12 px accent left edge on the accent wash,
  2 px ink frame. Title, body 700 15 px: "Game data changed since this list was last checked". Lines, body 14 px, one
  per changed recipe as built; the first five, then the link "Show all N changes". One primary: "OK, noted". The
  plain sentence for a stamp outside the chain is the same block with no lines.

### 4.11 Undo and status

- As the kit's status line. The three things the built page drew as buttons at the top ("Undo: …", an offer, "Earlier
  changes") are in the line. The size-limit lines ("This list is full: 2,000 items.") and "Counts above 999,999 are
  kept at 999,999." appear in it too.

### 4.12 Empty states

| Where | Form | Words |
| --- | --- | --- |
| Your lists, none | full empty state | see section 5 |
| To get | empty line, ready-role ring | "Nothing left to get." |
| To craft | empty line, ready-role ring | "Nothing left to craft." |
| Wanted | empty line under the add field | "Add the first item." |
| Combined view | empty line | "Tick two or more lists of one character." |
| Crafting log page | empty line | "Everything on this page is ticked." |
| Crafting log, no characters | full empty state, one action | the built sentence and "Back" |

Full empty state: the Submersibles pattern (two columns, at most 1,400 px wide, 2 px ink edge; phone: the decoration
is a 140 px band on top). The decoration panel for Lists is a ruled ledger: six dashed lines, three count-block
outlines in the craft, gather and market graphic tones, and the wordmark's three gauge bars; hidden from screen
readers; it holds no number. Its two labels: "Your lists" (display 24 px) and "N recipes in the game data" (data
13 px, N counted from the data file).

## 5. New words (the only ones)

- Tab bar and rail label: "Lists". Head control: "List settings". Sheet footer: "Done". Card tick label: "In
  combined view". Card menu button's accessible name: "More for <list name>". Link: "Show all N changes".
- Status line: the change as a sentence with the separate link "Undo" (built: one button "Undo: <change>").
- Count-block words: "to get", "crafts", "wanted", "ready", "left over", "finished". Stamp: "Must craft" (the tick
  keeps "Must be crafted by me"). Stamp: "Game data changed". Card line: "made <day month>".
- Your lists, empty: kicker "No lists yet"; headline "Nothing to make yet"; the built sentence; steps "Say what you
  want to make: Add items by name, or start from a crafting-log page.", "Type what you have: The app never reads the
  game.", "Work down the plan: What to get, what to craft, and in which order."; actions "New list" and "From the
  crafting log".

M0 reports any of these that collides with a text a check reads; then the built text wins.

## 6. Work items

For every item: a branch; only the files named; never merge, push to `main` or change settings; report plainly what
ran and what did not.

### Before the owner's approval

**M0. Facts from the history (Haiku clerk).**
- Files: new `docs/lists-redesign/hooks.md`, new `docs/lists-redesign/fixture.json`. Nothing else.
- Steps: find the merge commit of pull request 4 (`git log --merges`; the coordinator names `cfae181`). With
  `git show <commit>:<path>` read `tracker/command-center/src/lists/{index.html,lists.js,lists.css}`, the Lists blocks
  of `tracker/command-center/check.js` (C147 to C176, L2) and `tracker/tests/lists-look.test.js`. Write `hooks.md`:
  every selector, `data-*` hook and exact text those checks and tests read or click, by check; how a new list is
  named and created; how the settings controls save (on change or on a button); how long a status message stays; how
  "Earlier changes" is drawn; the exact sentences of the patch notice, the Restored list card and "For which
  character?"; in `subs.css`, how the switcher is shown at 360 px. From `tracker/data/lists.json` at that commit copy
  into `fixture.json`, unchanged, the rows for one real crafted item with at least three materials of which one is
  sold by a gil merchant, one is gathered from a timed node and one is traded for another currency; one recipe that
  makes more than 1; one collectable recipe; one crafting-log page; their items, offers, sellers and nodes; and the
  recipe count.
- Acceptance: both files exist; `git status` shows only them; every fixture row equals its source row (the report
  names the item ids).
- Escalate if: the commit or a path is not found; no item fits a fixture rule.

**M1. Static mock-up screens (Sonnet builder; needs M0).**
- Files: new `docs/lists-redesign/mock/mock.css`, one page per screen in `docs/lists-redesign/mock/` (`lists.html`,
  `lists-empty.html`, `get.html`, `get-open.html`, `craft.html`, `craft-open.html`, `wanted.html`, `settings.html`,
  `order.html`, `combined.html`, `log.html`, `log-which.html`, `restored.html`, `patch.html`, `status.html`,
  `left.html`, `steps.html`), new `docs/lists-redesign/shoot.js`, output `docs/lists-redesign/after/*.png` and
  `docs/lists-redesign/after/measures.json`.
- Steps: plain HTML and CSS, no behaviour. Each page loads the built site's own `fonts.css`, `shared.css`,
  `shell.css` and `look.js` from `tracker/command-center/site/` by relative path, so the theme is the real one.
  Names, recipes, amounts, sellers, merchant prices and nodes come from `fixture.json` only; typed stock, wanted
  amounts, list names ("Plan", "Bought") and market prices are examples, and every page carries the line "Mock-up:
  stock, amounts and market prices are examples." Draw sections 3 and 4 as written. `shoot.js` serves the repository
  root on a local port, opens each page with Playwright's Chromium at 1440 × 1000 with the light scheme and at
  360 × 800 with the dark scheme, writes `<page>-desktop-light.png` and `<page>-phone-dark.png` (full page), and
  writes to `measures.json` per page: row height at rest and opened; visible controls and bordered buttons per row;
  primaries per row; distance from the masthead's bottom to the first row; rows fully in view; the texts set in the
  data face; whether the page scrolls sideways.
- Acceptance: `node docs/lists-redesign/shoot.js` exits 0 and writes 34 pictures; in `measures.json`: phone rows at
  most 96 px at rest and 360 px opened; desktop rows at most 64 px; at most two controls per phone row and three per
  desktop row at rest, one primary at most; first row at most 200 px under the masthead (256 on `steps.html`); at
  least four rows in view at 360 × 800 (three on `steps.html`); every data-face text holds a digit; no sideways
  scroll. `npm run build` changes nothing. The hand-back gives, per picture, the bold test's sentence ("bold" or
  "still tame: <what>") from `docs/design-rules.md` section 12.
- Escalate if: a budget cannot be met as drawn (report the figure, do not shrink text under rule T3); the theme
  script does not run from a page outside the site folder; a screen needs a fact `hooks.md` does not have.

**M2. The owner approves from the screenshots.** No item runs past this point without it. Changes asked for are drawn
again by M1.

### After approval (rewritten 2026-11-23)

**B1. Lists back on the branch (Sonnet builder).** Restore exactly what pull request 6 took out, by reverting that
merge on the branch (`git revert` of the merge commit of pull request 6); no hand edits; the documents already on the
branch win where both touched a file. Steps: `npm ci`, `npm run build` twice, `npm run test:unit`, `npm run
test:browser`, `npm run check`. Acceptance: the second build changes nothing; totals equal the W16 note (unit 578,
browser 61, check 181 with C26b not run) or each difference is explained. Escalate if: the revert conflicts beyond the
documents, or a suite fails before any change.

**B2. Data: job icons, every crafter, every gathering spot with the game's node names (Sonnet builder; needs B1).**
Files: `tracker/tools/lists-data.py`, `tracker/data/lists.json`, new `tracker/data/classjob/*.png` (11 icons),
`tracker/data/SOURCES.md`, `tracker/NOTICE.md` and the root `NOTICE`, `tracker/tests/lists-data.test.js`,
`tracker/command-center/build.js` (copy the icons; size budget), `src/sw.js` (cache them). Data changes (D-C1, D-C2,
D-G1, D-G2, and the dated section of `docs/lists-spec.md`): `crafters: { item: [[recipe, job, level]…] }`; `gather`
becomes `{ item: [[job, nameRow, level, zone, x, y, aetheryte, hours, minutes, folklore, hidden]…] }` sorted best first
(fish: `[2, 0, level, zone, x, y, aetheryte, 0, 0, 0, 0, spotName]`); `nodeNames: { row: "Rocky Outcrop" }` from
`GatheringPointName`; `aetherytes: { id: name }` for those named. X and Y as the game's map shows them: derived from
the node's map position with the map's size factor and offset (the same conversion the Tracker uses for its
coordinates; find it in `tracker/tools/` and reuse it), one decimal. Stop rules added: a node whose name row cannot be
derived; a Teamcraft node id that maps to no `GatheringPoint` row; an icon missing, not a PNG, or over 16 kB. Tests:
LD-15 five nodes' names quoted from the sheets (one per basic kind and one unspoiled); LD-16 a shard that both Miner
and Botanist gather has both jobs; LD-17 a timed unspoiled node with its window; LD-18 a folklore node names its book;
LD-19 an item without position keeps its zone and no coordinates; LD-20 a fish with its spot and coordinates; LD-21 an
item whose ingredients differ between Blacksmith and Armorer lists both crafters, and an item with identical
ingredients too. Report the plain and packed data sizes (budget 1.5 MB packed) and the counts (spots, items with no
position, crafters per item). Escalate if: the name derivation or the id mapping does not hold, or the budget breaks.

**B3. Engine and rows for every crafter (Sonnet builder; needs B2).** `engine.js` only as far as D-C1 needs (the
counted recipe stays today's default unless `ways.recipe` is set; nothing else changes); `lists.js` "Count materials
for" in the opened row. Tests: the counted recipe follows `ways.recipe`; the plan of an identical-ingredient item does
not change with it; the model test passes unweakened.

**B4. Roles, kit and frame (Sonnet builder; needs B3).** As the former B2 and B3: the role tones, the kit of section 3
with F1 to F5, the tab bar, list head, sheets, status line; icons placed as D-C2. Acceptance: build twice; unit,
browser and full check; every edited check line listed with its reason (reach edits only).

**B5. Rows: To get (with the gather rows of D-G1), To craft (crafter icons of D-C1), Wanted, combined; then Your lists,
crafting log, Restored list, patch notice (F4), empty states (Sonnet builder; needs B4).** As the former B4 and B5;
C154 still passes.

**B6. The checks that pin the rules (`DR1`), and the evidence (Sonnet builder; needs B5).** As the former B6, plus:
every crafter and gatherer name on a list screen has its icon; no way stamp inside a section of the same way; at most
one filled primary per screen outside sheets and notices (F1).

**B7. Final pass and the owner's pictures (Sonnet builder; needs B6).** As the former B7; then the after pictures of
every screen at 1440 px light and 360 px dark, beside the approved mock-ups, with every difference listed, for the
owner to look at before the ship request.

**B8. Records (Haiku clerk; needs B7).** As before.

The review of B1 to B7 carries the appearance section of `docs/design-rules.md` section 12 (outside reviewers
included); the orchestrator writes that section into every review prompt.

## 7. Risks, and the first thing to verify

- **First: M0.** This spec was written without the Lists code. If a check reads a text or a hook this design moves,
  the design keeps the built text and the check gains only the step that reaches it.
- The budgets are tight: a phone row with a two-line name, a facts line and a price line is 92 px by hand; the list
  head on a phone is 152 px by hand. M1 measures both before the owner sees anything.
- The built page redraws after every save; an open drawer or sheet must survive it (B3 escalates).
- Moving "Get it by" into the drawer is one tap further than the owner's requirement "on every row" (Q1).
- Old pages cached on a device keep the old look until they update; nothing in the save changes, so both work.
- The fixture's market prices are examples; the mock-up says so on every page.
- Not designed here because no picture or code was seen: the exact form of the new-list step and of the confirms.
  They take the sheet form of the kit; M0 reports what they are today.

## 8. Owner questions (answered 2026-11-23: Q1 in the opened row, Q2 "Made all", Q3 adopt for every module)

**Q1. Where "Get it by" sits on a row.** You asked for the way of getting an item to be changeable from every row.
- In the opened row (recommended): tap the row, and "Get it by" is there with its reason. Every row still has it, one
  tap further. Rows stay short: four or more on a phone screen. Risk: you may find the extra tap slow when changing
  many items in a row. Fairly sure this is the better trade.
- On the row's way stamp: the word "Merchant", "Gather" and so on becomes the button that opens the choice. No extra
  tap; one more control on every row, and a small target on a phone. Costs a little more building. Moderately sure
  it would work at 360 px.
- Keep things as they are: the select stays open on every row. No tap saved or lost; rows stay about as tall as
  today's, which is what was rejected.

**Q2. The one main button on a crafting row.**
- "Made all" (recommended): one tap records the whole batch; "Made 1" is in the opened row. Best if you usually log
  after crafting. Risk: a mis-tap records too many; Undo puts it back. Moderately sure.
- "Made 1": one tap per craft; "Made all" is in the opened row. Best if you log as you go.
- Keep things as they are: both, with the other three buttons, on every row; the row of buttons that was rejected.

**Q3. The new size limits in the house style.** `docs/design-rules.md` sets figures no earlier round decided: a phone
row at most 96 px at rest, the first row within 200 px of the top bar, at most one main button and one "more" control
per row.
- Adopt them once the mock-ups look right to you (recommended): the checks then hold every later module to them.
  Risk: a later module with unusual rows may need an exception, which would come back to you. Fairly sure.
- Adopt them for Lists only: later modules are judged by eye. Less protection against the same fault.
- Keep things as they are: no measured limits; appearance is judged only from pictures.
