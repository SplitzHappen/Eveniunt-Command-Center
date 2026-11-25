# Bourse mock-up pictures: notes (look v2, 2026-11-25)

Made with `node docs/bourse/tools/make-mock.mjs` then `node docs/bourse/tools/shoot.mjs` (Chromium, deviceScaleFactor 1,
viewport only). The pages load the built site's own `fonts.css`, `shared.css`, `one-look.css` and `look.js`; the theme is
set the way the app stores it. Every price, age, sale and tax figure is an example; item and world names are from the
pinned game data (7.57h1). Look v1 pictures are in the history of this branch.

**Pictures (50).** Trip (book-style titles), Trip (dark capital bars), Item, Profit and Watch at 1,440 x 1,000 and 360 x 800
in Crystarium Dawnglass light and dark, Azure Dragoon dark and Ul'dah Sultanate Gilt light (40); the settings sheet, the
empty trip and the states page at 1,440 light and 360 dark (6); one comparison sheet per theme (4).

**Measured** (`measures.json`, all 46 screen pictures): no sideways scroll at 360 px; the largest text is the huge figure
(104 px, 52 px on a phone); lanes 52 to 56 px at rest at 1,440 and at most 96 px at 360; at least 8 lanes in view at
1,440 x 1,000 on Trip (both), Item, Profit and Watch; first lane on the phone at most 200 px under the header (Trip with
dark bars 224 px, its stop head being the strip, limit 256); at most the action and More per lane; no monospace without a
digit; no page errors.

**Not measured:** contrast beyond the shared tokens (the state roles are the Submersibles ones, already tested there);
tap sizes inside the sheet; keyboard focus (no behaviour).

| Screen | Bold? | Same app? | Note |
| --- | --- | --- | --- |
| Trip, book titles | Bold | Yes | Huge total, four state blocks, the route track, green lanes at the stop you are at, blue later lanes, amber old. |
| Trip, dark bars | Bold | Yes, closest to the Board today | Submersibles' company bar with a state strip per stop; slightly taller. |
| Item | Bold | Yes | Eight thin lanes on one price scale; regions as closed sections; big sales blocks and a dot strip. |
| Profit | Bold | Yes | The Earnings leaderboard: accent rank 1, ink ranks, gold bars, big figures. |
| Watch | Bold | Yes | Filled green Under lanes against amber Above lanes; target tick and cheapest diamond. |
| Settings sheet | Calm, by intent | Yes | A form; travel area first. |
| States page | Bold | Yes | Notices in the failure and waiting roles, dashed empty lines, loss, HQ-only and bait lanes. |
| Empty trip | Bold | Yes | Plate, headline, three slanted steps in green, blue and amber, the seal, a route decoration. |

Fixed before showing: the wedges spilled past the lane's left edge and, on the phone, over the first letter of the name;
a label under the huge figure ran under the first block; the item lanes cut their facts line; Trip and Watch had fewer
than eight lanes in view; on the phone the first lane started up to 61 px too low (the answer band's blocks fold away
there now).
