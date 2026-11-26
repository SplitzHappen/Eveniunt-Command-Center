# Bourse mock-up pictures: notes (look v3, after the round-four outside reviews, 2026-11-26)

Made with `node docs/bourse/tools/make-mock.mjs` then `node docs/bourse/tools/shoot.mjs` (Chromium, deviceScaleFactor 1,
viewport only). The pages load the built site's own `fonts.css`, `shared.css`, `one-look.css` and `look.js`; the theme is
set the way the app stores it. Every price, age, sale and tax figure is an example (the header says so on every screen);
item and world names are from the pinned game data (7.57h1). Earlier looks are in the history of this branch.

**Pictures (44).** Trip, Item, Profit and Watch at 1,440 x 1,000 and 360 x 800 in Crystarium Dawnglass light and dark,
Azure Dragoon dark and Ul'dah Sultanate Gilt light (32); the settings sheet (alone, whole), the empty trip, the states page
(full page) and Watch with a live alert over the normal screen, at 1,440 light and 360 dark (8); one comparison sheet per
theme (4).

**How rows are counted (changed after the review).** A row counts as in view only when it sits wholly below the header and
above every fixed bar at the bottom (the phone's tab bar, the main-button bar, a status line). The first count, before the
review, used the whole window and overstated the phone (outside review, finding 15). Names cut short are reported.

**Measured** (`measures.json`, 40 screen pictures, the same in all four themes):

| Screen | Computer: row height at rest, rows in view (rule: at most 64 px, at least 8) | Phone: row height at rest, rows in view (rule: at most 96 px; at least 4, or 3 with a strip) | First row on the phone |
| --- | --- | --- | --- |
| Trip | 52 px, 9 | 70 to 89 px, 3 (stop head counts as the strip: needs 3) | 271 px |
| Item | 48 to 49 px, 8 | 72 to 73 px, **3** (needs 4) | 273 px (the search has its own row) |
| Profit | 48 to 52 px, 9 | 50 to 90 px, **3** (needs 4) | 257 px |
| Watch | 52 px, 8 | 70 to 85 px, **3** (needs 4) | 257 px |
| Watch with an alert | 52 px, 8 (rows counted above the alert line) | 70 to 85 px, 3 | 257 px |

No sideways scroll at 360 px; no name and no facts line cut short (both measured since round three); no monospace text without a digit; at most the action and More visible
per row; no page errors. **On the phone, Item, Profit and Watch show 3 resting rows where the rule asks for 4, and the first
row starts at 257 to 273 px where the rule allows 200 (256 with a strip).** Both follow from keeping the answer band's state
blocks on the phone, the owner's choice of round three; the owner is asked whether to keep that.

**Not measured:** contrast beyond the shared tokens; tap sizes and focus inside the sheet (no behaviour); large text.

| Screen | Bold? | Same app? | Note |
| --- | --- | --- | --- |
| Trip | Bold | Yes | Starts at the home world (Gilgamesh, Aether): 3 stops, 1 data-center hop; the total counts only what is still to buy and names the Europe stop's extra cost separately. |
| Item | Bold | Yes | Cheapest anywhere over the seven data centers; the quality switch is in the section head on the phone. |
| Profit | Bold | Yes | Ranked ledger; the ranking switch is in the section head on the phone; on the phone the price sits under the name so long names stay whole. |
| Watch | Bold | Yes | The legend for marks look B does not draw was removed; the alert line moved to the states page. |
| Settings sheet | Calm, by intent | Yes | The seven data centers as boxes by region, the home world named, one threshold control, alerts every 30 minutes. |
| States page | Bold | Yes | A full-page reference sheet (nothing pinned): notices, empty parts, the trip lines the corrected spec adds (made without a region, a quick split, items without a home price, no shared alert checker, the copied shopping list, a row to check, the only listings, an approximate amount), edge rows, and the alert line with its age and Close. |
| Empty trip | Bold | Yes | Unchanged. |

**After the round-two outside review (2026-11-26).** Every gil figure the Bourse shows includes the buyer's 5%, taken per
whole stack and rounded down (confirmed in all 139 saved listings); the Trip total is 266,066 gil left to spend (bought
items apart, the optional Europe stop apart, shown as the only reported listings of an item North America does not sell);
Item answers what 6 cost, each, tax in (two whole listings on Exodus), with the world and age in the label so the phone
keeps them; the phone search has its own row; Profit shows both sale bases and how many sales the middle is taken from;
the settings sheet shows the trade-off default and a home-world picker and is pictured alone and whole; the states page
says "hourly limit reached" with the next time, dates the maintenance example, and no longer clips on the phone; a live
alert is pictured over the normal Watch screen. Reading text is at least 12 px.

**After the round-three outside review (2026-11-26).**
- **Trip:** the Europe stop is no longer optional. It holds the only reported listings of an item still needed, so the trip goes there and the total counts it: 275,201 gil left. The line reads "4 stops · 1 data-center hop · 1 region hop", on a line of its own on the phone.
- **Profit:** every row shows both profit figures ("by sales · by listing"), how many sales the middle is taken from and over how many days, at least how many sell a day, and the listing's world and age.
- **Watch:** the answer is now the cheapest price, with how far under or over the target it is; the facts give the world, the age and the target.
- **Item:** the ladder says "cheapest one, tax in", so it no longer reads like the "what 6 cost each" answer.
- **Settings:** the home-world picker says where the place came from ("from the Tracker's place setting") and names no character.
- **States page:** the bait row (101,325 gil for 6) and the only-listings row (12,915 gil for 3) include the buyer's 5%.
- **On the phone:** the facts lines wrap instead of being cut short.
- **Not measured** (needs the real app, not a static picture): tap sizes, focus and the last reachable control inside the sheet. The build checks them (B11).

**After the round-four outside review (2026-11-26).**
- **Trip:** the hop counts are worked out from the route, home included: Aether to Primal to Light is "2 data-center hops · 1 region hop". The line stays on one row on the phone.
- **Profit:** the figures follow the spec's rules.
  - Sales a day are counted over 7 days. When the last 40 sales are all more recent, the figure reads "at least 5.7 a day" (40 / 7).
  - Both profit figures are worked out from inputs shown on the row: the price sold at, the price listed (with its world and age), the seller's 3% rounded up, and the materials.
  - Example: sold 51,856 less 1,556 less 12,060 gives 38,240; listed 49,263 less 1,478 less 12,060 gives 35,725.
- **Settings:** the home-world source is a line of text under the picker, so it is not cut off on the phone.
- **States page:** the hourly limit says it counts the Bourse's requests, and that Lists and Submersibles keep their own limit.
