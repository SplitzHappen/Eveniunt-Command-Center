# Bourse mock-up pictures: notes (look v3, after the round-two outside reviews, 2026-11-26)

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
| Trip | 52 px, 8 | 70 to 89 px, 4 (stop head counts as the strip: needs 3) | 271 px |
| Item | 48 to 49 px, 8 | 72 to 73 px, **3** (needs 4) | 273 px (the search has its own row) |
| Profit | 48 to 52 px, 9 | 50 to 90 px, **3** (needs 4) | 257 px |
| Watch | 52 px, 8 | 70 to 71 px, **3** (needs 4) | 257 px |
| Watch with an alert | 52 px, 8 (rows counted above the alert line) | 70 to 71 px, 3 | 257 px |

No sideways scroll at 360 px; no name cut short; no monospace text without a digit; at most the action and More visible
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
