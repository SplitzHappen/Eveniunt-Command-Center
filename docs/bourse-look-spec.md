# Bourse: look spec

Written 2026-11-24 from the owner's answers (`docs/bourse-questions.md`), the research (`docs/bourse-research.md`), the
house style (`docs/design-rules.md`, as amended for one look), `docs/one-look-spec.md`,
`docs/one-look-foundation-spec.md` and the shared stylesheet `tracker/src/app/one-look.css`. Mock-ups:
`docs/bourse/mock/`; pictures: `docs/bourse/pictures/`. Nothing in the app was changed.

The owner asked for: the workbook mix (the Atelier's book with Submersibles' bold answer slab on top), dense on a
computer and one thing at a time on a phone, and no stock-ticker look, no wide tables, no pills or rounded cards, no
small grey numbers (answers 35 to 38).

## 1. Parts used, and the one addition

Only the shared one-look parts, from the built `one-look.css`, loaded with the site's own `fonts.css`, `shared.css` and
`look.js` (so every theme of the app applies unchanged):

- the one header (`ol-hdr`) with the word **Bourse**, the tool slot holding "Bourse settings" (as the Atelier holds
  "Atelier settings"), and the app's pages with Bourse between Lists and Settings;
- the answer band (`ol-slab`) on top of every screen, with an answer numeral (`ol-numeral`) and state blocks (`ol-sb`);
- book-style section titles (`ol-chap`: Roman numeral, Fraunces title, italic line, state summary, 2 px rule), closed
  sections with their count (C4, P6), italic sub-groups (`ol-subgroup`);
- index lines with dotted leaders (`ol-ix`) for the price ladder and the city tax list;
- the seal (`ol-seal`) as each screen's single main action; secondary (`ol-btn-2`) and quiet (`ol-btn-q`) buttons;
  segmented choices (`ol-seg`); fields, checkbox and stepper in the settings sheet;
- state blocks whose shape says the state: **solid** (can act now: below target, cheapest, to buy here), **outlined**
  (waiting: above target, price old), **hatched** (unknown: no listings, no data, cannot make yet), **Done**.

Module layout only (`bourse-mock.css`, every class `bm-`): the rail and phone bottom bar, the ledger and its rows (copied
from the approved one-look mock and the Lists ledger), the "you are here" strip of the trip, the price-ladder columns, the
leaderboard bar, the sales strip of price history, the settings sheet and the empty state.

**The one addition: a gil role.** Submersibles already has a gil hue (`--gil-m`, gold, the same in every theme, rule K3),
and the shared stylesheet defines it, but it has no `ol-r-gil` role class. The Bourse needs it for the rank blocks and
the leaderboard bars. The mock defines `bm-r-gil` from `--gil-m` with ink text; the spec moves it into `one-look.css` as
`ol-r-gil`, where the drift check covers it. Gil figures stay in ink (gold text fails 4.5:1 on light paper, rule K5);
gold is a fill only.

Colour roles per meaning (K1, K3, K4; each also a word):

| Meaning | Role | Form |
| --- | --- | --- |
| To buy here, on the market | `ol-r-market` (the purple Lists already uses for "Buy on the market") | solid block with the count |
| Bought, done | `ol-sb ol-done` (back green) with the word "Done" | solid |
| Below target, cheapest world | `ol-r-back` | solid, with the word |
| Above target, price old | `ol-r-idle` | outlined, with "Old" or "Above" |
| Very old price, fetch failed | `ol-r-bad` | outlined, with the word, and the note form (S3) |
| No listings, no data, cannot make yet | `ol-r-locked` | hatched, with the word |
| Rank and gil per craft | `bm-r-gil` (proposed `ol-r-gil`) | solid rank block; bar fill |
| Data center chapter | ink (`ol-r-slab`) | numbered stop blocks |

## 2. The screens: one idea each (C1)

The rail (from 701 px) and the bottom bar (phone) hold the four views: **Trip, Item, Profit, Watch**. Settings open as
a sheet from "Bourse settings" in the header (F1, F2: these settings belong to the Bourse only; the price place stays
the app-wide one in the Tracker's place setting, with a Bourse override).

### 2.1 Trip: a road book

**Idea:** the shopping trip is a road book. One chapter per data center in travel order (fewest hops, biggest savings
first, answer 27), one sub-group per world stop, the rows are what to buy there. The current stop is a "you are here"
strip under the answer band with the screen's seal, "Bought all here".

- **Answer band.** Two versions for the owner to choose from the pictures (answer 38):
  - **A, as proposed:** the total gil to spend as the numeral; state blocks "5 stops" and "2 data-center hops".
  - **B, savings-led:** the gil saved against buying everything on the home world as the numeral; blocks "Total to
    spend" and "5 stops".
  The sub line says the folded settings that change the plan (F6): the lists it comes from, the split rule ("fewest
  stops, at most 10% more") and the price place.
- **Row at rest (1440 px, 56 to 64 px):** block (solid market, the count to buy) · name (Fraunces) over facts ("3 at
  18,900 · 2 more at 19,000 · seen 14 min ago") · leader · the row's gil (Plex) · one action "Bought" (outlined) · More.
  States: solid (to buy), Done, outlined idle "Old" (price older than the owner's limit, default 1 day), hatched "None"
  (no listings in the region).
- **Opened row:** the listings it is buying (quantity, price, quality), "Copy name" (PC: pastes into the game's
  search), "Buy part" stepper, and the Lists list it came from.
- **Closed chapters:** "Not on the market now" (hatched count) and "Bought" (Done count).
- **Said once, as the foot note (W2):** "You can buy on another data center but not sell there. Travel stops 30 minutes
  before maintenance." When a maintenance is within two hours, it becomes a note block (S4) above the first chapter.
- **Phone:** the answer band stacks; the "you are here" strip takes the full width with the seal 48 px; rows show block,
  name, gil and More; facts on a second line; "Bought" moves into the opened row (A2 at 360 px: primary and opener).

### 2.2 Item: a price ladder

**Idea:** every world of the region on one ladder, cheapest first, the home world marked; listings and sales kept apart.

- **Answer band:** the cheapest price now for the amount needed, and where ("Exodus, Primal"); blocks "Seen 14m"
  (solid back when fresh, outlined idle when old) and "6.2 a day" (sold).
- **Under it:** a segmented choice Normal | High quality (A5; never mixed, answer 22) and the seal "Watch this item".
- **I. Cheapest on each world** (listings now): index lines in two columns at 1440 px, one sub-group per data center,
  each line the world, the leader and the price; the age in small body text after it; the home world tagged "Home";
  the cheapest line is the chosen line (`ol-on`). A world with no listing says "none", never 0 (S5).
- **II. Recent sales** (what actually sold, 7 days, 30 when the price site has them): one line of figures (low,
  middle, high, sales a day) as small outlined blocks, and a **sales strip**: each sale a dot on one price scale across
  the days, the middle price as a 2 px rule. No candlesticks, no red or green arrows (answer 36).
- **III. Made from, used in** (closed): links to Lists and "Solve in the Atelier".
- **Phone:** one column; the ladder shows the region's cheapest eight, "Show all 32 worlds" below.

### 2.3 Profit: a leaderboard on one scale

**Idea:** the profit ranking is a leaderboard like Earnings: every craft on one gil scale, the best at the top, its rank
in a gold block.

- **Answer band:** the best gil per craft as the numeral, with the craft named; blocks "Ranked" (how many crafts have
  enough prices) and "Not priced yet" (hatched; all recipes is about 10,000 crafts, filled a little at a time).
- **Under it:** a segmented choice "Ranked by recent sales | by cheapest listing" (answer 20) and the seal "Rank these
  crafts" (fetches the next batch for the current filter, at a pace that respects the price site).
- **I. Ranking:** row = gold rank block · name (with "HQ" where the sale is high quality) over facts (job and level,
  sells N a day, material cost, "can't make yet" when so) · the bar on one scale · gil per craft (display face, 40 px,
  the row's answer) · "Solve" (opens the Atelier) · More (Add to a list, Watch, Item prices). Slow sellers (under one
  sale a day) sink below the rest under an italic sub-group "Sells less than once a day"; never hidden. A craft whose
  sale price is old wears the outlined "Old" block in place of its rank.
- **II. Where to sell this week:** the eight market cities as index lines with this week's tax on the home world,
  lowest first, the lowest chosen (answer 23: profit uses the lowest, and the list shows the options for moving
  retainers); "read 3 hours ago".
- **Phone:** rank block, name, gil per craft, More; facts on the second line; the bar under the name.

### 2.4 Watch: the watch book

**Idea:** a short ledger of watched items in three states, below target first.

- **Answer band:** how many are below target now (numeral); blocks "Above" (outlined idle) and "No data" (hatched).
  The sub line: "Alerts ring only while this app is open in a tab." (CC-08, W5).
- **Seal:** "Add an item".
- **I. Below target** (solid back rows): facts "target 15,000 · cheapest 12,400 on Famfrit · seen 22 min ago"; answer
  "2,600 under"; action "Add to trip".
- **II. Above target** (outlined idle rows): answer "1,900 over".
- **III. No price** (closed, hatched count).
- **An alert** is the status line (S1, one place, bottom): "Sanctified Water is under your target on Famfrit: 12,400 gil.
  Open".

### 2.5 Bourse settings (sheet) and the empty trip

- **Sheet** (A7: Close, tap outside, Escape), four book chapters: I Prices (place: follow the Tracker or region, data
  center, world; "Old after" and "Leave out of profit after", steppers in days, defaults 1 and 7, answer 16); II
  Shopping trip (what comes first: fewest stops, cheapest, or a set trade-off, with the threshold stepper, default 10%,
  answer 26; route order; "When I tick an item bought": tick only (default) or also add to "I have" in Lists, answer
  28); III Profit (gathered materials at market value, switch; tax: lowest this week or a city); IV Alerts (on or off;
  how often while open, default every 15 minutes).
- **Empty trip** (E1): kicker plate "Nothing to buy", headline "No trip yet", one sentence, three numbered steps
  (choose lists, set the split, buy world by world), the seal "Choose lists", and a decoration panel (a dashed route
  with three slanted stop marks) hidden from screen readers.

## 3. Purpose fields (F1)

None at rest on any of the four screens. The item search ("Find an item") on the Item screen is the one purpose field,
in the tool slot. Everything else is in the sheet.

## 4. Measured limits (design rules section 12, step 5)

P4: rows at rest at most 64 px at 1440 px and at least eight in view at 1440 x 1000 on Trip, Profit and Watch. P2: at
most 96 px at rest on a 360 px phone. P3: the first row at most 256 px under the header on a phone (the trip's "you are
here" strip counts as the strip). A1, A2: one primary per row, at most the primary, More and one stepper at rest. T2: no
monospace except figures. P1: no sideways scroll at 360 px. A6: 40 px targets on the phone.

## 5. Departures from the house rules

None. The gil role class is an addition to the shared stylesheet, not a departure.

## 6. Phone folds (P5), decided while drawing

- **The seal in a fixed bar.** On a phone each screen's one seal ("Bought all here", "Watch this item", "Rank these
  crafts", "Add an item") sits in a fixed bar above the bottom tabs, 48 px high and full width (T5, A6); the content ends
  above both bars (P8) and the status line sits above them (S2). Without this the first row started 330 to 405 px under
  the header (P3 allows 256).
- **"You are here" as a tag.** The trip's "you are here" strip folds into a "You are here" tag on the current stop's
  sub-head; the stop's sub-head counts as the screen's strip of steps for P3.
- **Rows.** Block, name (two lines at most), facts (two lines at most), the row's figure and More; the row action moves
  into the opened row (A2 at 360 px).

## 7. Changes made after looking at the pictures

- Trip: only the stop you are at is solid ("To buy"); rows of later stops are outlined ("Later"). The first draft made
  every to-buy row solid and a whole chapter read as one purple band, the fault the owner named on Lists (look v2).
- Profit: the answer band keeps one block ("Not priced yet"); "Ranked" is in the Ranking head. Two blocks beside the
  numeral did not fit a phone.
- Trip: the "you are here" strip made slimmer and the fixture's first stop given six items (a realistic trip), so eight
  rows are in view at 1,440 x 1,000. A trip spread over many data centers shows fewer rows on the first screen because
  each data center has its head; that is the road-book idea, not a density fault.
- Empty state: step numbers were faint and small (a selector caught the state block); fixed.
- Watch: the alert status line is one line, full width on the phone.

### After the red team (same-family review, 2026-11-24)

- Every row says the price's age first ("seen 14 min ago · …"), so a phone that cuts the facts line never cuts the age.
- Names may take three lines on the phone (15 px), so the longest real names ("Grade 2 Gemdraught of Intelligence")
  are never cut to "Gemdraught o…"; rows stay within 96 px.
- "14 min" instead of "14M" (which read as 14 million gil); the Item answer says "gil each for 6", the unit price for
  the amount needed.
- The answer band's figures and labels no longer clip on the phone ("8,644", "To price"; shorter label under the big
  number).
- "Not on the market now" means no listing of the quality needed; an ordinary need with only high-quality listings is
  its own row state ("HQ only", hatched, the price shown as unknown for normal quality).
- The gil bar and the empty state's decoration take their colour through the role (`var(--f)` under the gil role),
  never the shared colour token directly.
- **A states page** (`docs/bourse/mock/states.html`, pictures `states-*.png`): the four notices (prices not fetched,
  slowed down, ranking budget spent, maintenance soon), the three empty parts (choose a home world, nothing watched,
  find an item) and three row states (a craft that loses gil, an item listed only in high quality, a listing far below
  recent sales). Not drawn: 30 stops and 200 watched items (the same rows repeated; the browser checks measure them on
  real data).

## Look v2 (2026-11-25): toward Submersibles

**Why.** The owner saw the first mock-ups and found every screen too busy, not bold enough, the colours off and not
reading as one app, with Submersibles the closest existing screen (`docs/bourse-questions.md`, second round). Look v2
supersedes sections 1, 2 and 7 above where they differ; the parts list of section 1 still holds.

**What changed, screen by screen**
- **Answer band, every screen:** the kick line ends in a colon (as Submersibles' "NEXT BACK:"), the name in the serif,
  then one huge figure (104 px on a computer, 52 px on a phone) and full-height state blocks counting the screen's
  states: Trip 5 buy here, 5 later, 1 old, 1 done; Item 47 worlds listed, 4 old, 6 none; Profit 1,212 ranked, 8,644 to
  price; Watch 3 under, 5 above, 1 no data. On a phone the blocks fold away (each section head carries its count) so the
  first lane stays on the first screen.
- **Lanes instead of rows:** a state wedge in capitals at the left, the name and one short facts line (age first), a
  track, one big answer in the state's colour, and the accent button only where you can act now ("Bought" at the stop
  you are at, "Add to trip" under target). Every other action is in More. Tracks: Trip, the listings bought whole as
  segments; Item, the price on one scale; Profit, the gil bar on one scale (gold, as on Earnings); Watch, your target as
  a tick and the cheapest listing as a diamond.
- **Colours: Submersibles' state roles only.** Green, act now (buy here, cheapest, under target); blue, next (later
  stops); amber, waiting (old price, above target); hatched, unknown (none, HQ only); ink, done or a rank; red, loss or
  failure; the theme's accent for the one main action and for rank 1. Lists' market purple is gone; gold is for gil bars
  only.
- **Trip:** a route track of the stops under the answer band (like the Board's time track): the stop you are at in
  green, later stops in blue, a stop in another region dashed after a "Europe" plate. "Bought all here" sits at the end
  of the track. Sections are stops, in travel order (fewest region hops, then data centers, biggest savings first).
  Drawn twice for the owner: book-style titles (`trip.html`) and Submersibles' dark capital bars with a state strip
  (`trip-bars.html`).
- **Item:** "Cheapest anywhere" over the seven data centers (eight thin lanes on one price scale), then one closed
  section per region with its listed count, and recent sales as three big blocks and a dot strip.
- **Profit:** a leaderboard of lanes (rank 1 in the accent, the rest in ink), gold bars on one scale, the slow sellers
  in a closed section, "Where to sell this week" as thin lanes (the seller's tax by city; buyers pay their own 5%).
- **Watch:** lanes Under (green, filled) and Above (amber), the target tick and the cheapest diamond.
- **Settings:** a new first section, Travel area (North America, Europe, Oceania; another region only above a saving
  threshold); alerts on every page.

**Measured** (all 46 screen pictures): rows in view at 1,440 x 1,000 at least 8 on Trip (both variants), Item, Profit
and Watch; lanes 52 to 56 px at rest on a computer and at most 96 px on a phone; first lane on the phone 196 px under the
header (224 px with dark bars, where the stop head is the strip); no sideways scroll; no monospace without a digit.

**Honest notes.** Bold on every screen; reads as Submersibles' sibling in all four themes. The dark-bars Trip variant
costs a little height (tightened to keep eight lanes). On a phone the state blocks of the answer band are not shown;
that is a fold the owner may want back, at the cost of the first lane starting lower than the house limit. The phone
loses the quality and ranking switches at rest (the setting shows in the answer band's label; the switch is in Bourse
settings).

## 8. Picture notes and the bold test

`docs/bourse/pictures/notes.md`: what was measured, what was not, and one line per screen ("bold" or "still tame").
Every screen passed the measured limits at the last run; none is reported as still tame.
