# Bourse mock-up pictures: notes

Made 2026-11-24 with `node docs/bourse/tools/make-mock.mjs` then `node docs/bourse/tools/shoot.mjs` (Chromium, deviceScaleFactor
1, viewport only). The pages load the built site's own `fonts.css`, `shared.css`, `one-look.css` and `look.js`; the theme is
set the way the app stores it (`eveniunt-tracker-ui`). Every price, age, sale and tax figure is an example; item and world
names are from the pinned game data (7.57h1).

**Pictures (48).** The five main screens (Trip A, Trip B "savings first", Item, Profit, Watch) at 1,440 x 1,000 and 360 x 800
in Crystarium Dawnglass light and dark, Azure Dragoon dark and Ul'dah Sultanate Gilt light (40); the settings sheet and the
empty trip at 1,440 light and 360 dark (4); one comparison sheet per theme (4), with the real Home, Lists, Submersibles and
Atelier pictures of `docs/one-look/foundation-pictures/` on the top row.

**Measured** (`measures.json`, all 44 screen pictures): no sideways scroll at 360 px (P1); the largest text in view is the
answer numeral, 96 px on a computer and 56 px on a phone (104 and 60 px headline on the empty state) (C2); rows at rest
56 to 57 px at 1,440 (P4, at most 64) and 65 to 86 px at 360 (P2, at most 96); at least 8 rows in view at 1,440 x 1,000 on
Trip, Profit and Watch (Trip 8, Profit 9, Watch 8); first row 240 to 254 px under the header on the phone for Trip and
Profit (P3, with a strip, at most 256) and 199 px for Watch (no strip, at most 200); at most the row action and More
visible per row (A2); no monospace text without a digit (T2); no page errors.

**Not measured:** contrast (K5) beyond what the shared tokens already guarantee; the gil role fill (`bm-r-gil`) is new and
its text contrast is ink on `--gil-m` (the same pair Submersibles uses for its gil chips); tap sizes inside the settings
sheet; keyboard focus (the pages have no behaviour).

## Bold test, by eye, per screen (design rules section 12, step 6)

| Screen | Bold? | Same app? | Note |
| --- | --- | --- | --- |
| Trip A | Bold | Yes | 96 px total in the slab, purple "stops" and outlined "hops" blocks, book chapters per data center, a market-purple "you are here" block and the seal. Only the stop you are at is solid; later stops are outlined ("Later"), so the screen is not one tint (fixed after the first look: every to-buy row was solid and a chapter read as one purple band, the fault the owner named on Lists). |
| Trip B | Bold | Yes | Same, with the saving as the numeral; "266K to spend" is the one abbreviated figure on any screen. |
| Item | Bold | Yes | The answer numeral and the green "Seen" block; the ladder is the Atelier's index lines with leaders, which reads as a book page rather than a table. Less colour than the other screens by design (one cheapest line, one chart). |
| Profit | Bold | Yes | The strongest screen: gold rank blocks, one bar scale, 40 px figures per row, hatched "not priced yet". |
| Watch | Bold | Yes | Green "Under" rows against outlined "Above" rows; the alert as the slim status line. On the computer picture the status line covers part of the last row in view, as a fixed line does; in the app the page ends above it (P8). |
| Settings sheet | Calm, by intent | Yes | A form; book chapters and underlined fields as in the Atelier. |
| Empty trip | Bold | Yes | Built like the Lists and Submersibles empty states (plate, headline, three slanted steps, seal, decoration). |

**What the comparison sheets show.** In all four themes the header, the book-style chapters, the seal and the state blocks
are the same parts as on the real pages. The real Lists and Submersibles pictures are empty states, so the sheets compare the
Bourse's working screens with the app's empty ones; the Atelier picture is the closest working screen. Two honest
differences: the Bourse uses more of Submersibles' weight (answer band, numerals) than the Atelier does today, as the owner
chose (workbook mix); and the real Home and Lists still carry their older bodies (they move to the one look in later pull
requests), so for a while the Bourse will look more finished than they do.

**Phone folds that differ from the computer** (each in the look spec): the screen's one seal sits in a fixed bar above the
bottom tabs, so the first row stays on the first screen; the trip's "you are here" strip folds into a tag on the current
stop's sub-head; row actions other than More move into the opened row.
