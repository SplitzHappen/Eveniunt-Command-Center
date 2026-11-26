# Bourse, the market module (blueprint phase 4): build spec

Written 2026-11-24 for a Sonnet builder and a Haiku clerk; revised after a same-family red team (section 12), the
owner's rounds two to six (sections 13, 14), round one of the outside review (section 14), the facts of B0 and B1
(section 15) and, on 2026-11-26, **round two of the outside review (section 16)**. Plan only: apart from B0 (a report)
and B1 (saved replies and their test) nothing was built. **Building is paused** (order below).
Binding inputs: the owner's answers in `docs/bourse-questions.md` (six rounds; a later round replaces an earlier one),
`docs/bourse-review-adjudication.md` and `docs/bourse-review-adjudication-2.md`, the look spec
`docs/bourse-look-spec.md`, look v3 (screens are not designed here), `docs/design-rules.md`, `docs/bourse-research.md`.
Blueprint rules restated: **CC-12** prices are labelled as community reports with when and where they were seen;
listings and past sales are shown separately; the market tax is counted; "profit" is an estimate, never a promise;
lookups are batched and cached; stale or missing data is marked. **CC-08** a website alerts only while open in a tab.
**CC-09** a "Solve in the Atelier" link that cannot be matched exactly is refused, not guessed.

Trust marks: **found (B1)** = seen in the saved real replies (`tracker/tests/fixtures/universalis/`, section 15).
**[shipped]** = the shipped code already reads it. **[verify]** = still not seen by this project (only the reply's
`Retry-After`, and OneDrive's "create only if missing", carry it now).

## Binding ledger (later rounds replace earlier ones)

| Decision in force | Bound by | Where here |
| --- | --- | --- |
| Name "Bourse"; it replaces the Tracker's Market Board (a link, the shopping list copied once) | answers 1, 2 | D9, D10 |
| The downloaded single-file Tracker: its Market Board points to the Command Center, no prices | round three | D9 |
| Market only; no Gathering, no retainer ledger | answers 3, 8 | section 1 |
| One home world for the whole Bourse, read in a fixed order of sources | answer 4; round six (12a) | D41 |
| Travel area: exactly seven data centers in three regions, narrowed by a setting | round two (replaces 5, 15) | D25, D26 |
| Four views (Trip, Item with history, Profit, Watch); opens on Trip when a list has market items | answers 9, 13, 14 | sections 5 to 7 |
| PC: "Copy name" on every item row | answer 10 | D42 |
| Age limits set by the owner, defaults 1 day "old", 7 days left out | answer 16 | section 5 |
| Fetch on opening, one automatic try per 15 minutes per place, plus Refresh | answer 17 | D7, D39 |
| Prices for the amount needed; a listing is bought whole; bait marked, never hidden | answers 18, 19; round two | section 6, section 5 |
| Profit: both sale figures, ranked by the middle of recent sales; qualities never mixed | answers 20, 22 | section 5, D35 |
| Materials: cheapest of merchant or market; gathered at market value with a switch; crystals at market | answer 21 | section 5 |
| Tax: both sides pay; the buyer a flat 5% of each stack; the seller's rate is this week's lowest city, every city listed; labelled 5% when unreadable | answer 23, round five, research section 4, B1 | D36 |
| Gil per craft, return and sales a day beside; slow sellers sink; all recipes; the recommended ranking pace | answers 24, 25, round five | sections 4, 5 |
| Three split modes, threshold default 10%; fewest region hops first, then biggest savings; another region only when its saving beats the threshold; one allowance for the whole trip | answers 26, 27, round two; adjudication 2 | D28, D37, D54 |
| A tick marks only (default); adding to Lists' "I have" is a switch | answer 28 | D33, D46; owner question 14 |
| The lists chosen, combined | answer 29 | D14 |
| History: 7 days shown, 30 when the site has them; figures and one small chart; one window's middle | answers 30, 31, round five | D43 |
| Prices never in the save; the watch list, own items, purchases and settings are | answers 32, 39 | section 8 |
| Watch list with in-app alerts on every page | answers 33, 34, round two | D30, D40, D57 |
| Look v3 (look B, Atelier-led), approved; state colours, gold for gil bars only; the answer blocks stay on the phone, 3 resting rows accepted on Item, Profit and Watch | rounds two to six | D31, section 9 |
| The Trip's answer is the total to spend; sale prices are read over the travel area | round two | section 6, D29 |
| Lists gains high-quality prices, and the line "before the 5% buyer's tax" | answer 40; round six (11b) | D8 |
| The standing sentences as written in section 9 | round six (5a) | section 9 |
| Older pages stop saving until reloaded: save version 2 | round six (10a) | D32 |
| B0 and B1 ran before the second outside review | round six (13b) | section 15 |
| Order of work and the outside review | round five; adjudication 2 | below |

**Order.** Round two of the outside review failed the plan (section 16); the Bourse stays paused. (1) The plan passes:
the owner decides whether a third outside round is run on these corrections (owner question 15). (2) The one-look
rules pull request. (3) The module moves, one pull request each (Lists, Atelier, Tracker, Home and Settings,
Submersibles). (4) The Bourse, last, straight into the one look, starting with B28 (the baseline taken again at the
real starting commit). B0 and B1 are done (section 15).

## 1. Goal, constraints, what is not built

- **Goal.** One new page, `bourse/`, with four views (Trip, Item, Profit, Watch) and a settings sheet: prices over the
  owner's travel area; profit per craft; a shopping trip split by region, data center and world; price history; a watch
  list with in-app alerts on every page of the app.
- **Constraints.** Offline-first, public, GitHub Pages: no server, no account, no key, no CDN; the only outside host is
  `universalis.app`, and only item numbers, place names and a world number are sent. Never read or automate the game;
  never invent game data or a price: a figure the app lacks is "unknown", never 0 (rule S5). The app does not decide
  who can travel where (D25). Saves stay compatible (section 8, D32). No personal names or private paths. One pull
  request; the owner ships.
- **Not built:** retainer listings, undercut watching and a sales ledger; prices typed by hand; Gathering; uploading
  to Universalis; push notifications for prices; a record of prices over time; congestion rules; gil per hour.

## 2. Decisions (rejected alternatives in brackets)

**Data**
- **D1 No new game data.** Items, recipes, merchant offers, gather sources, master books: the Lists data (the page loads
  `../lists/data.js` and `../lists/engine.js`; packed data is read as the Lists page reads it, through `CC.unpack`).
  Regions, data centers, worlds with their numbers: `tracker/data/live.json`, built into `bourse/data.js` as
  `window.BOURSE_PLACES`. Place names on screen and in a request differ ("North America", `North-America`, found
  (B1)): one map, `PRICE.placePath(name, places)`; a place the map does not know is never sent. Maintenance times:
  `tracker/data/timers.json`, built in as `window.BOURSE_MAINT` with the date the list was built (D17).
  [A second data file: a second pin. Lists' hard-coded region map: a third copy of the worlds.]
- **D2 One price source, five reply kinds** (section 3). The aggregated endpoint is not used. [Aggregated for the
  ranking: it gives an average; answer 20 asks for the middle of recent sales.]
- **D3 Saved replies first.** B1 saved real replies; a test asserts every field of section 3. A reply is never written
  by hand and called a fixture; hand-made stand-ins are named `stand-in` and use only fields the fixtures hold.

**The price service** (`tracker/command-center/src/prices.js`, existing file, extended; `PRICE.create` keeps every name)
- **D4 One request queue**, `PRICE.queue(url)`: the only call of `fetch` in the file. At most 2 requests in flight and
  300 ms between starts, **counted over every page of the device** through the ledger (D39, D56), at most 40 waiting
  per page (more resolve "not fetched"). Existing services go through it. After an answer 429 nothing is sent for 15
  minutes, or for the reply's own `Retry-After` when longer [verify], **however long that is**; after three failed
  answers in a row, 15 minutes. A failure while offline does not count. Coming online or pressing Refresh lifts a
  failure pause; **nothing lifts a rate-limit pause before its time**. [A cap per service: two modules on one page
  would add up. A ceiling on the site's own waiting time: it would send while the site says wait.]
- **D5 New options of `PRICE.create`, each defaulting to today's behaviour:** `endpoint(place, ids)`, `freshMs`,
  `noneMs`, `batch` (100), `maxRequests`, `storage`, `strict404`, `outcomes` (D35), `ledger` (D39), `deadlineMs`
  (D56), and **`maxBytes`, the reply cap**: a reply is read as a stream and abandoned past this size (a failed fetch,
  charged, nothing stored); the Bourse sets 2 MB (the largest saved reply is 110 kB, section 15). The default
  `storage` is today's one record, byte for byte. `PRICE.idb(name)` is a second `storage`: an IndexedDB database of
  its own (`eveniunt-bourse-prices`), one record per service and place, **updated per item inside one database
  transaction**, each item stamped with the time its request started (D56); memory only when IndexedDB is refused,
  and the screen says prices are not kept. `strict404`: a 404 is a failed fetch, never "no market price" (found (B1):
  an unknown item and an unknown place answer alike). [A second price file: a fork.]
- **D6 Quality, world and time live in the stored value**, made by shared readers: `PRICE.readDeep(x, asked)` gives
  `{ up, w: { <world>: { up, cap, n: [[price, qty, cost, listed]…], h: […] } }, s: { n: [[price, time, world, qty]…],
  h: […] } }`; `PRICE.readSlim(x, asked)` the same with at most 10 listings a region (D49). `cost` = what the buyer
  pays for the whole stack (D36); `up` = when that world's board was last reported; `listed` = the listing's own
  review time, kept apart (D50); `cap` = the slice may be cut. Names of retainers and buyers and listing numbers are
  never stored. Each reader returns an outcome (D35), never a bare `null`. [A cache key per quality: two requests.]
- **D7 The 15-minute gate, per service and place, is unchanged** for every automatic try; Refresh ignores it. For the
  Bourse's services no automatic try is made or recorded while offline. (Lists and Submersibles keep their behaviour.)
- **D8 Lists gains high-quality prices by changing only its own `read`.** It reads the reply's `minPriceNQ` and
  `minPriceHQ` (found (B1)); stored value `[cheapest of any quality, average, world, upload, cheapest ordinary,
  cheapest high quality]`. **A minimum of 0 is "no value", stored as absent, never a price of 0** (D52). An ordinary
  row shows and adds up slot five; a high-quality row slot six; slot one is never shown as either. A stored four-part
  record has no quality: both rows read "not fetched yet", it is left out of the subtotal, and the item is due at the
  next permitted fetch. Lists' price line gains **"before the 5% buyer's tax"** (round six). Lists keeps its own price
  place. [Lists reading the Bourse's cache: two modules on one record.]
- **D9 The Tracker's fetcher is removed** (answer 2; round three). `live.js` `mbFetch`, `mbSummary`,
  `fillMarketLines`, `renderMarket` go. Inside the Command Center the Market Board page is the empty-state form with
  one link "Open the Bourse", and an entry's detail line is a link "Prices in the Bourse" (`../bourse/#item=<id>`). In
  the downloaded single file the page says the market moved to the Command Center and shows no prices.
  [Embedding `prices.js` in the Tracker: a third build to keep in step.]
- **D10 The Tracker's shopping list is copied once per device, never moved** (section 6.8, D58). `mlist` and `mqty`
  stay stored. The copy and its receipt are one write; the player is told what was copied and what was skipped.
  [The Tracker writing the section: its save path is not guarded by the section rules. Deleting the old list: drops
  player data. A receipt in device storage: a crash between the two writes copies twice.]

**Profit**
- **D11 The ranking fills only when asked.** Section 4.
- **D12 Profit of one craft**, section 5. Direct materials only, except a material that cannot be traded and has a
  recipe, which is costed by its own materials (four levels at most, loop-safe; any unknown part makes the whole
  craft "Missing a price", never free). [Cheapest of buying or crafting every material: a second plan engine.]
- **D13 The ranking prices one unit, cautiously, and says so; the opened row prices the recipe's amounts** by walking
  the listings and shows the home world's own figures (D29). In the ranking a material's market price is the higher of
  its cheapest listing in the area (D49) and the middle of its recent sales. [Deep listings for every ranked craft:
  the reply would be six times larger. The cheapest listing alone: a bait listing would rank a craft.]

**Trip**
- **D14 The trip's needs** are Lists' items to buy on the market for the lists chosen, plus the trip's own items, less
  what is marked bought (D33). A new pure `LISTS.marketNeeds(plan, listIds)` in `engine.js` returns
  `[{ key, item, quality, qty, lists: [<list id>…] }]` (`lists` = the chosen lists that ask for it, sorted). The
  page's private `sumShares(plan, ids, stepId)` (`lists.js` line 424) moves into the engine unchanged, third argument
  included, as `LISTS.sumShares`; the Lists page calls that one. One plan per character (D23).
- **D15 One split method for all three modes**, section 6. The screen says "a good split", never "the best".
  [An exact fewest-stops search: it grows too fast with the worlds of seven data centers.]
- **D16 (replaced by D33, round one).**
- **D17 Maintenance comes from the built copy of the Tracker's timer list only**, and the note always shows the list's
  date: "Maintenance times as of <date>. A maintenance announced later is not known here."

**Watch, save, look**
- **D18 Alerts run on every page of the app** (round two). D30, D40, D57, section 7.
- **D19 The save section has a checker in `save.js`**, no arrays, every key safe. Section 8.
- **D20 A unit removed on one side and changed on the other stays until the player answers** (rule BY0, as Lists'
  LY0); between tabs the same case is refused (BI1). Older copies are covered by D32.
- **D21 The module adds layout only** (`bourse.css`, every class `bm-`, no colour value, no shared token). The gil role
  moves into `one-look.css` as `ol-r-gil`, for gil bars only; the module's sheet never names `--gil-m`.
- **D22 One addition to the look spec:** the Profit view's filter sits in the Ranking group's More as "Filter crafts",
  its value readable in the head's state line; no field at rest.
- **D23 Who owns a trip row.** Needs are worked out per character, then rows of the same item and quality are shown as
  one row to buy with the amounts added; the opened row lists each character's share. A tick on a joined row is shared
  out in the fixed order `c1`…`c8`, `u`, `x`, each need filled before the next, as one purchase record per owner, all
  in one write (D33).
- **D24 The home world is asked for too**, and its own reply is the authority for its listings (D51). For any other
  world the words are "not among its region's cheapest 60 listings", never "none" (D35).

**Round two (owner, 2026-11-25)**
- **D25 The travel area is a setting; its default is the owner's seven data centers.** North America (Aether, Primal,
  Crystal, Dynamis), Europe (Chaos, Light), Oceania (Materia). `build.js` writes `window.BOURSE_AREA` from `live.json`
  and stops unless that gives exactly those seven. `prefs.area` is `{ <data-center name>: 1 }` (absent = all seven):
  the keys are data-center names, letters only, never a region name. The sheet shows seven boxes and says "Choose the
  data centers you can travel to. This app does not know the game's travel rules."
- **D26 One request per region, joined on the device** (three by default; each region its own cache record and gate).
  Joining follows D44. A region that failed is named ("Europe not fetched"), its worlds read "not fetched", and every
  figure made without it says so.
- **D27 Budgets** (section 4, D39): one press of "Rank these crafts" is 12 requests; 72 ranking requests per page
  visit; 180 per rolling 6 hours per device; a ranked price is fresh for 24 hours. Watch rounds: at most 6 requests,
  default every 30 minutes, least 15, most 240. All Bourse requests together: at most 300 per rolling hour per device.
- **D28 The trip is grouped by region, then data center, then world**: fewest region hops first, biggest savings first
  inside each level; another region stays only when its saving beats the threshold. Exact rules: D37, D54, section 6.
- **D29 The sale price for profit is read over the whole travel area.** The Profit screen says once: "You can only
  sell on your home world. Sale prices here are read over your whole travel area." The opened row shows the home
  world's own middle price, cheapest listing and sales a day.
- **D30 One shared alert script on every page**, `tracker/command-center/src/watch-alert.js` (new). It is tiny and
  loads the price code only when there is something to watch. The Tracker and the Atelier load it from their
  hosted-only code, so the downloaded single files never reference it.
- **D31 The look is look v3 of `docs/bourse-look-spec.md`** (look B, approved). States use the shared state roles and
  never the market purple; gold is for gil bars only. C206 measures look v3's limits.

**Round-one outside review (2026-11-25)**
- **D32 Older copies cannot write a save that holds the new rules: the save's version becomes 2** (decided, round six).
  Section 8 gives the contract and what each older page really shows. [Leaving older copies to merge: the confirmed
  loss. Removal marks: section 8, not chosen. Version 2 only once the Bourse section holds something: one missed
  place fails open.]
- **D33 A purchase is its own record and says what it credited.** `bought` is keyed by a purchase id made at the tick.
  A fall in need is never read as a purchase; the page never clears a mark by itself. The mark and the stock credit
  are one write (D34) with a receipt, a retry that cannot credit twice, and a conditional Undo. Section 6.7; D46 and
  D47 complete it.
- **D34 One write for two sections: `CC.writeSections(parts, opts)`** in `save.js` (new). `parts` is a list of
  `{ name, section, known, own }`, exactly `CC.writeSection`'s arguments; all parts are checked, merged and stored in
  one `CC.transact`, in order; any refusal or error cancels all of them. Additions: a part may give
  **`edit(storedSection)`** instead of `section` (the function runs inside the transaction on the stored section and
  returns the section to store; the section's rules still apply); `own.device` may be a function of the stored device
  part; `opts.check(doc)` runs first and may throw to cancel; **`opts.ifRev`**: the write is refused unless the stored
  stamp is this one (no merge is ever made). **On the fallback storage (device storage without IndexedDB) the save
  and its stamp are two separate writes and no lock exists, so a call with two or more parts, or with `ifRev`, is
  refused there** ("This browser's storage cannot save both together") and writes nothing. `CC.writeSection` becomes
  the one-part call of the same inner function, unchanged in behaviour. The Bourse section honours `known.expect`
  (rule BI2). [`CC.writeSection` twice: no atomicity. One stored value for save and stamp on the fallback: it changes
  the fallback's format for every module.]
- **D35 Every reply item ends in one of four outcomes**, per place and quality: **usable**; **confirmed empty**;
  **unknown**; **failed** (no answer, an error answer, a deadline passed, a reply over `maxBytes`, or a success whose
  shape is wrong). Only "confirmed empty" may be worded "none", and D52 says when a reply proves it. After a failure
  the last good values stay, marked "last read <age>; the refresh failed". Field rules: a price and a quantity are
  whole numbers of 1 or more; `hq` must be true or false; a world must be in the app's list (D50 says where it is
  read); a time must be a positive number in its unit (found (B1): report times in milliseconds, sale and review
  times in seconds; a report time of 0 occurs and is "unknown") and not more than a minute ahead of the clock, else
  the age is unknown. A bad entry is dropped and counted, never repaired, **and makes "confirmed empty" impossible for
  that item and place** (D52).
- **D36 Tax, both sides, each exactly once** (research section 4; B1). **Buyer: the one basis is the game's flat 5% of
  each stack bought, rounded down per stack:** `cost = pricePerUnit × quantity + floor(pricePerUnit × quantity × 5 /
  100)`. All 139 saved listings, from retainers in eight cities, fit it; the one that looked lower is this rounding on
  a small stack (1 gil on 35). The listing's `tax` field **is** that amount and is **only a cross-check**: when it
  differs from the rule the stack is still priced by the rule and counted "tax field differs"; a missing or zero field
  changes nothing. The reply's `total` is price times quantity without tax (found (B1)) and is not used for the cost.
  Tax is never worked out on a sum of stacks: two stacks of 35 cost 36 each. The 5% is applied before any comparison
  with a merchant: one unit costs `price + floor(price × 5 / 100)`; a tie goes to the merchant. **Seller:** `income =
  sale × yield − ceil(sale × yield × ratePct / 100)`, the cautious deduction (the game's own rounding of the seller's
  side is not in any reply). A city rate is a whole percent, and **a rate of 0 is a real rate** (found (B1)). No
  Bourse figure is "before tax"; when the seller's rate could not be read the labelled 5% is used. [The `tax` field as
  the basis: its meaning would rest on a sample. The seller's city rate for the buyer: against the research and all
  139 listings.]
- **D37 The trip starts at the home world**, and one baseline rules every comparison. Sections 6.2 to 6.6.
- **D38 The split has a budget and a labelled fallback.** Section 6.5, D55. [A time limit: the same input could give
  two plans.]
- **D39 One ledger for the device**, `eveniunt-bourse-ledger` in device storage (`PRICE.ledger`, new, in `prices.js`):
  the pauses of D4, the starts and requests in flight (D56), and every request charged against D27's budgets. A
  charged request is every request actually sent to the price site by a Bourse service: retries, the home-world read,
  opening requests, fallback reads and a failed region asked again all count, charged when sent, never refunded. A
  page reserves before it sends, inside the browser's lock `eveniunt-bourse-ledger` (Web Locks). **Where the browser
  has no Web Locks, or device storage is refused, nothing automatic is sent** (D56 gives the limited manual path), and
  the screen says "This browser cannot coordinate tabs, so prices load when you press Refresh."
- **D40 One alert round at a time, by a lock, with rechecks.** Section 7, D57.
- **D41 Home world, in this order:** (1) `prefs.home` when it names a world of the app's list; (2) the Tracker's place
  setting on this device (`eveniunt-tracker-ui` in device storage, `ui.live.world`), shown as "From the Tracker's
  place setting" and not stored until the player picks; (3) none: "Choose your home world". One home world for the
  whole Bourse (round six); a character's or a free company's world is never taken as home. The sheet has a picker
  and says: "One home world for the whole Bourse. If your characters live on different worlds, choose the one you
  shop and sell from now."
- **D42 "Copy name"** is in the More of every item row on Trip, Profit and Watch, and beside the item's name on Item.
  It copies the item's name exactly as the Lists data holds it; the status line says "Copied: <name>". If the browser
  refuses the clipboard, the name is shown selected in a field with "Press Ctrl+C". Check C210.
- **D43 One history window, stored and shown.** The `history` service asks for 30 days and keeps what it gets for 30
  days. The Item screen shows 7 days; a "30 days" choice appears only when the held sales reach back further. The
  line of figures and the chart are of the window shown. Profit always uses the 7-day window.
- **D44 One filter before every figure.** `MARKET.inArea(world)` is applied to every listing and every sale before any
  middle price, cheapest listing, sales a day, history line or alert. **Sales a day = the filtered sales inside the
  window ÷ the window's days (7, or 30 on the Item screen's longer view).** When the reply's sales were cut (it held
  the asked number of entries and they do not reach back to the window's start) the figure is a lower bound and reads
  "at least N a day (the last 40 sales cover X days)". An unknown age is never fresh.
- **D45 Tests say what they are.** A **guard** passes before and after by design. Every other assertion must fail
  without its change. Every "sends nothing", "shows nothing" or "does not contain" assertion has a positive control
  in the same test and fixture.

**Round-two outside review (2026-11-26)**
- **D46 A credit survives a merge: rule BY2, new code only** (older copies cannot merge a version 2 save). It applies
  only to a Lists count for which some purchase record holds a credit (`cr` over 0), so only to players who turned on
  "Also add to I have in Lists". Section 8 gives the rule, where it runs and its tests. In one line: **a count =
  the player's own part + the credits of the purchase records that exist**; the own part merges as counts always
  have; the credits follow the records. The setting is built only if item B26 passes; otherwise it stays off and
  hidden (owner question 14). [Leaving counts to the generic rule: two devices that each add 40 to 10 both store 50,
  which merges to 50 while both marks stay. Summing each device's change: two devices typing the same new count would
  double it.]
- **D47 Purchase records are never edited, and a credited one leaves only by Undo.** That is what makes D46 exact.
  "Still count them" adds a small check record instead of changing one; "New trip" raises the trip's number instead
  of deleting credited records; a tick is bound to the need **and to the lists that made it**; a receipt on the
  device outlives the mark. Section 6.7. [Editing `of` in place, deleting credited records at "New trip": a removal
  that keeps the credit cannot be told from a typed count in a merge.]
- **D48 The cloud copy is created only when none exists and replaced only when it is the copy read; a copy an older
  app wrote back never removes anything silently.** `cloud.js`, section 8, item B27. [Trusting that older copies
  always read first: an older device that saw "no file" uploads without a condition (`cloud.js` lines 143 to 148,
  193).]
- **D49 The ranking's listing figure has a world and an age, or is "unavailable".** The `slim` service asks for the
  10 cheapest listings a region with their worlds (`listings=10&entries=40`), not for the site's bare minimum, which
  names no world. After D44's filter the cheapest listing of the area is known, with its world and that world's
  report age; when a narrowed area leaves none of a cut slice, the figure reads "unavailable: not among the region's
  10 cheapest" and the craft is ranked from sales alone, flagged, or goes to "Missing a price" when it has neither.
  [`minPriceNQ/HQ` with `listings=0`: no world, no age, and worlds outside the area can set it.]
- **D50 Where a row's world and time come from.** A **world** reply (found (B1): its listings and sales carry no
  world) gives every row the world of the reply, after the reply's own world name and number are checked against the
  one asked. A **region** reply's rows must each carry their own world, else the row is dropped and counted. Two
  times are kept apart: a world's **report time** (`worldUploadTimes` on a region reply, `lastUploadTime` on a world
  reply) is the age of every price of that world and the only one that decides "old", "fresh" and alerts; a listing's
  **review time** (`lastReviewTime`) is shown on the Item screen as "listed <age>" and decides nothing.
- **D51 The home world's own reply is the authority for the home world.** When it answered (usable or confirmed
  empty), the home world's rows inside the region reply are ignored; when it failed, the region's rows for the home
  world are used and labelled as a cut slice. Rows are never matched by price and size: two equal offers are two
  offers.
- **D52 "Confirmed empty" needs a reply that proves it for that quality:** the request had no quality filter and asked
  for listings; the item is in the reply; the slice is not cut; no entry of that item was dropped; then a quality with
  no listing is confirmed empty **for that place**. For the travel area: every region answered so. Anything else is
  unknown. **A minimum of 0 (`minPriceNQ`, `minPriceHQ`) is a missing value**: never a price, and never by itself
  proof of "none".
- **D53 A figure needs all of its inputs.** A recipe's market cost is used only when every ingredient's whole amount
  is covered by listings; otherwise the opened row reads "cost unknown: only N of M <material> listed". The Trip's
  answer is "total still to spend" only when every row is resolved; otherwise it is **"known so far"**, with what is
  missing beside it ("3 items not priced, 1 region not fetched, 2 to check"). A trip with nothing left reads "Nothing
  left to buy", never a bare 0.
- **D54 One allowance for the whole trip.** The extra cost a plan may add over the baseline is one amount, `A`, spent
  by every removal of every pass together: in `cheapest` and `within` the plan's total never passes `C0 + A`. A
  baseline that holds an approximate item is a **reference**, labelled so. Section 6.2, 6.4.
- **D55 Every size has a rule, and every step is bounded.** Section 6.5: the sizes the save can hold (a need up to
  999,999, any number of rows after a merge), the work one step may do (the first pricing included), the search for
  amounts over 2,000, and a tie rule the table can keep.
- **D56 One pace for the device, deadlines, and an order for answers.** The ledger grants each start: at most 2 in
  flight and 300 ms apart over all pages; an entry in flight expires after 25 seconds. Every request has a deadline
  (`deadlineMs`, 20 seconds): it is aborted, counts as failed and stays charged. A pause's end is only ever moved
  later. **Every cached item carries the start time of the request that filled it; an answer whose request started
  earlier than the stored one is discarded**, so a late failure never marks a newer success stale. **Without Web
  Locks:** the stored pause is still read and written (best effort) and Refresh sends one request at a time, 1 second
  apart, at most 30 per page load. **With storage refused:** the same limits, and a reload forgets the pause (known
  limit).
- **D57 An alert belongs to what was asked.** Each round records the area, the watched item's quality and target, the
  age limit and a round number; a result is used only if all still match when it would ring or re-arm. Re-arming
  needs **complete fresh evidence**: every region of the area answered in that round, and the cheapest listing of the
  area is over the target with a known, fresh age. Section 7.
- **D58 The Tracker's old list is normal quality.** It never held a quality, so every copied item becomes
  `<item>.nq`, and the row says "normal quality (from the Tracker's list)". The larger-amount rule is worked out
  inside the write, against the amount stored at that moment (`edit`, D34).
- **D59 Two pinned commits.** `<base>` = the commit the Bourse branch starts from, after the module moves; `<old>` =
  the same commit, as the "older copy" of every mixed-version test. Item B28 pins both and takes B0's inventory again
  there; B0's first run (`d7322c7`, before the moves) stays as evidence only.

## 3. What is fetched (host `https://universalis.app/api/v2/`)

"per region" = one request for each region of the travel area (D26), three by default. A one-item request returns the
item itself, a batch wraps them in `items{}` with `unresolvedItems` (found (B1)); an item named there is unknown.

| Service (cache `PRICE.idb`) | Used by | Request | Fresh | Fields read (all found (B1)) |
| --- | --- | --- | --- | --- |
| `deep` | Trip (per region, and the home world), Watch (per region), an opened Profit row (per region, and the home world) | `{place}/{≤100 ids}?listings=60&entries=20` | 15 min | `listings[].pricePerUnit`, `.quantity`, `.hq`, `.worldName` (region replies only), `.lastReviewTime`, `.tax` (cross-check, D36); `recentHistory[].pricePerUnit`, `.hq`, `.timestamp`, `.quantity`, `.worldName` (region only); `worldUploadTimes` (region) or `lastUploadTime` (world); `listingsCount` |
| `item` | Item, "Look deeper" on a trip row; per region | `{region}/{one id}?listings=300&entries=0` | 15 min | as `deep` |
| `slim` | Profit ranking; per region | `{region}/{≤100 ids}?listings=10&entries=40` (D49) | 24 h for "Rank these crafts" | as `deep` |
| `history` | Item; per region | `history/{region}/{id}?entriesWithin=2592000` | 1 h; kept 30 days (D43) | `entries[].pricePerUnit`, `.hq`, `.quantity`, `.timestamp`, `.worldName` |
| `tax` | Profit | `tax-rates?world=<home world number>` | 6 h | one whole-percent rate per city |

Requests per action, default area: Trip 4 per 100 items; Item 6; an opened Profit row 4; a watch round 3 per 100
watched; a press of "Rank these crafts" 12; opening Profit at most 3. Every reply is bounded by `maxBytes` (D5). The
`slim` form with 10 listings was not among the saved replies: it is the `deep` form with a smaller number; B20 saves
one real reply of it (one request) and records its size before the service is used.

A price's age is always that world's report time (D50), never our fetch time. No fallback of the earlier plan is
needed (section 15); what remains unseen is a 429 and its `Retry-After`, which the tests cover with a stand-in (a
short wait, a wait of two days, no header).

## 4. "All recipes": the progressive fill

About 13,900 recipes; a full pass is 330 to 420 requests. Rules:
1. **Opening Profit sends at most 3 requests**: the stale rows in view, one batch over the three regions. No timer
   ever refetches the ranking.
2. **"Rank these crafts" is the fetch.** One press prices the next 400 items (12 requests) of the current filter:
   results and their materials together, anything fetched in the last 24 hours skipped. Order: crafts never priced,
   highest recipe level first; then the oldest fetch. A batch counts as priced only when all its regions answered; a
   region that failed is asked again first, and that request is charged like any other.
3. **Budgets (D27), kept in the ledger (D39):** when spent, the seal is disabled and reads "Enough for now", with "The
   price site is free and run by volunteers. More can be ranked after <time>." A pause shows the same form with its
   reason and its end. A full ranking is about 28 to 35 presses over three six-hour windows, by design.
4. **While partial:** the answer is the best gil per craft "of N ranked"; the Ranking head says "N of T ranked for
   this filter". Closed groups, each with its count: "Not priced yet", "Missing a price", "Too few sales to rank"
   (fewer than 3 sales of the sale quality in 7 days), "Price too old", "Cannot be sold". 200 rows, then "Show 200
   more".
5. Ranked records older than 30 days are deleted on opening.

## 5. Profit math (pure functions in `bourse/market.js`, new; every figure labelled "estimate")

- **Quality.** The sale is high quality when the recipe can be, else ordinary. Materials are ordinary. A high-quality
  figure never fills an ordinary one or the reverse; an entry without a quality is in neither (D35).
- **Sale price, per unit, over the travel area (D29, D44):** *middle of recent sales* = the median unit price of that
  quality's sales in the last 7 days after the area filter (an even count takes the mean of the two middle ones,
  rounded); *cheapest listing* = that quality's cheapest listing of the area by D49, with its world and age, or
  "unavailable". Both are shown side by side on the row, each with the profit it gives; the row is ranked by the
  first (the segmented choice swaps them; a craft whose chosen basis is unavailable is not ranked by it). The row
  states its basis: "from N sales in 7 days · 1 unit priced". Fewer than 3 sales: "Too few sales to rank"; none: sale
  unknown. The opened row adds the home world's own figures.
- **Tax: D36.** `ratePct` = the lowest current city rate on the home world, or the city chosen in settings; "Where to
  sell this week" lists every city, lowest first, with "read <when>". A rate is never shown as this week's unless read.
- **Material cost, per unit:** the cheaper of (a) the cheapest gil-only merchant offer and (b) the market price over
  the area after the buyer's 5% (D36). (b) in the ranking is the higher of the cheapest ordinary listing of the area
  (D49) and the middle of the material's recent ordinary sales; with one of the two missing, the other, flagged
  ("material priced from one listing", "no listing read"). (b) on the opened row is the listings walked for the
  recipe's amounts (section 6.1), **used only when the whole amount is covered (D53)**; the row says "ranked on 1
  unit; opened for your amounts". Gathered materials: market value, or 0 with "gathered: free" when the switch is on.
  Crystals: market. Neither (a) nor (b): unknown, and the craft goes to "Missing a price".
- **A crafted material that cannot be traded (D12):** crafts needed = `ceil(units needed ÷ its recipe's yield)`; cost =
  crafts × the cost of its materials (whole crafts; the spare units are not credited). An unknown part, a fifth level
  or a loop: the whole craft is "Missing a price".
- **Shown per craft:** `profit = income − cost` (may be negative); return = profit ÷ cost, and "no cost" when the cost
  is 0; sales a day of the sale quality (D44, with "at least" when the sample was cut); material cost; "can't make
  yet".
- **Age.** `oldDays` (default 1): marked "Old". `dropDays` (default 7): under "Price too old". The age is the oldest of
  the report times used (D50); an unknown age counts as too old for ranking and is worded "age unknown".
- **Slow sellers** under one sale a day sink under "Sells less than once a day"; never hidden.
- **Bait.** A listing under half the middle of recent sales of its quality is marked "far below recent sales"; never
  hidden, still priced. A craft whose rank would change by more than half if a material's cheapest listing were used
  wears "a material is listed far below its recent sales".
- **Home world:** D41. None set: Profit shows "Choose your home world" and fetches nothing; the Trip works (6.6).

## 6. The trip (pure functions in `bourse/trip.js` and `bourse/needs.js`, both new)

**6.1 Buying an amount.** For one item and quality, from the listings of every allowed world together (after D44's
filter and D51's rule for the home world), each stack bought whole at its `cost` (D36): the set with the lowest total
whose quantities reach the amount. Up to 2,000 units this is exact: a table over the amounts that keeps, per amount,
the lowest total and, among equal totals, the fewest stacks. **Remaining ties go to the stack that comes first in one
fixed order** (home world, home data center, home region, then world name, then price, then the reply's order), so the
result never depends on the order the replies arrived in. "Fewer worlds" is not promised among equal totals. At most
the 300 cheapest stacks of an item enter the table; when more were held the row says "priced from the 300 cheapest
listings". The row says "buys 99, you need 5" when it overshoots. **Above 2,000 units the result is approximate and
labelled "approximate: a cheaper mix may exist"**: the cheapest of (i) cheapest unit price first; (ii) the cheapest
single stack that covers the whole amount; (iii) each of the first 50 leading parts of (i) closed by the cheapest
single stack that covers the rest. Every candidate is a real set of stacks. Fewer units listed than needed: "N of M
found". Wording of cover follows D35 and D52. Never 0.

**6.2 The start plan and the baseline.** Every item is priced by 6.1 over all allowed worlds together. Its total is
**`C0`, the one baseline**, and `A = floor(C0 × within / 100)` gil is **the one allowance** (D54). When the plan holds
an approximate item, `C0` is a **reference**: it is shown as "reference total (approximate)", and if a later pricing
of that item over fewer worlds comes out cheaper, the cheaper purchase is kept for the item (it is valid for the
larger set too) and counts as a removal that costs nothing; the allowance is never raised by it.

**6.3 Cover.** Per item: the units found, and each place's outcome (D35). A removal (6.4) is allowed only when every
item's found units stay the same. A region that failed is not in the plan and the plan says "made without <region>".
An item whose only listings sit behind a cut slice is "not among the cheapest 60", with "Look deeper".

**6.4 Split, `prefs.split` (default `within`, 10%).** Removing a place re-prices, by 6.1, the items bought there over
the remaining worlds; its **saving** is that plan's total minus the current total. A place that cannot be removed
without losing cover is **required**: it stays in every mode, labelled "the only listings of N items are here" when
every region of the area answered with whole slices for those items, and **"the only reported listings of N items are
here"** otherwise. The home world, home data center and home region are never candidates. Three passes; after each
removal the savings are worked out again.
1. **Other regions.** `fewest`: remove every region that can be removed, smallest saving first. `cheapest` and
   `within`: take the region with the smallest saving; remove it when that saving is **at or under `A`** *and* the
   plan's total afterwards is **at or under `C0 + A`**; a region whose saving is over `A` stays ("saves N gil"); a
   region whose saving is under `A` but no longer fits the allowance stays too and says "kept: without it the trip
   would cost more than your X% allows". `cheapest` then stops and says it is cheapest among the regions kept.
2. **Other data centers.** `cheapest`: none. `fewest`: every one that can be removed, smallest saving first.
   `within`: the smallest saving first, while the plan's total stays at or under `C0 + A`.
3. **Other worlds.** As pass 2.
So in `cheapest` and `within` no sequence of removals can pass `C0 + A`; `fewest` has no allowance and says what it
costs. Ties between candidates: the one with fewer items bought there, then by name. The answer reports "N gil (X%)
more than the cheapest split" (`total − C0`, "than the reference" when `C0` is one). The settings sheet has one
threshold field: "Another region must save more than this to be worth the trip, and fewer stops may never cost more
than this in total."

**6.5 Sizes, budget and fallback (D38, D55).** Accepted sizes: a row's need is whatever Lists holds (up to 999,999)
or an own item's amount (up to 99,999); the number of rows, own items, purchases and watched items is whatever the
save holds after a merge, also above the page's limits (section 8). Nothing is refused or cut for size: an amount
over 2,000 takes 6.1's approximate path; own items over the limit are planned and the page says "over the limit:
remove some before adding more"; watched items over 200 are shown, the first 200 by key are checked, and the view says
"N not checked: over the limit". **Work is counted in table cells, not in clock time.** One step
(`TRIP.step(state, cells)`) does at most the given number of cell updates and can stop in the middle of an item, in
the first pricing as in the passes; `TRIP.start(input)` does none. The page runs steps of a size that takes at most
50 ms (set by B25) with "Planning the trip…", and the result is the same whatever the step size. The passes may use
`EVAL_MAX` re-pricings (a named constant, start value 20,000); when it is spent they stop where they are and the plan
is labelled "A quick split: too many items to try every option." The first pricing is never cut short: until it is
complete no plan is shown. Every state after it is a complete plan with the same cover. Supported worst size for the
timing run: 600 rows, every world of the seven data centers, 60 listings a region and item, 20 rows over 2,000 units,
one of them 999,999; and a merged trip of 1,200 rows.

**6.6 Route and hops.** The trip **starts at the home world**, whether or not something is bought there. Order: the
home world; then the other worlds of the home data center; then the other data centers of the home region; then the
other regions; inside each level by gil saved, largest first (`prefs.route = 'items'`: by most items), a stop with an
unknown saving after the known ones, then by name. Hops are counted from the home world, one way, and the screen says
so once: "Hops are counted from <home>, one way." A data-center hop is each step along the route (start included) that
changes data center; a region hop each step that changes region; on a phone the stops and both hop counts stay on one
line. `saved` of a stop = what its purchases cost on the home world (6.1 on the home world's own reply, D51) minus
what they cost there. An item the home world cannot fully supply, or whose home reply failed, has an **unknown**
saving: left out of the sum and counted "N items without a home price". **No home world:** the start is **the world
where the start plan spends most** (tie: by name), named "No home world set: the trip starts on <world>"; that world,
its data center and its region take the home's place in 6.4 and in the hop count; `saved` is unknown. The answer is
the total gil still to spend, or "known so far" (D53), with the stops, region hops, data-center hops and gil saved.

**6.7 Purchases (D33, D34, D46, D47).** "Bought", "Buy part" and "Bought all here" make purchase records
`{ o, i, q, n, of, cr, ls, t, at }` under new ids: `of` = that owner's need in Lists just before; `ls` = a short
fingerprint of the chosen lists that asked for the item (`marketNeeds`' `lists`, joined and hashed to 8 characters);
`t` = the trip's number (`prefs.trip`); `cr` = units added to Lists' "I have" (0 when `prefs.tick = 'only'`, the
default, and always 0 for the trip's own items). **A record is never changed after it is written.**
- **What is left.** Only records of the current trip number count. Own items (`x`): `left = max(0, qty − Σ n)`. A
  character's row: with `unc = Σ (n − cr)` and `last` the newest record, the row is **settled** while Lists' need now
  equals `last.of − last.cr` **and the lists that ask for it now give the same fingerprint as `last.ls`**; then `left
  = max(0, need now − unc)`. Otherwise the row is **to check**: its amount left is unknown, it is left out of the
  total (D53), and the answer says "N to check". It reads "Lists needed 99 when you marked 40 bought; it now needs 50
  (or: for other lists)." with two actions: "Still count them" (adds a check record: `n` 0, the need and fingerprint
  of now) and "Remove the mark" (asks first; removes the row's records that hold no credit). So a list of 40 unchosen
  and another list of 40 chosen is to check, not settled. A row whose purchases are all credited never needs a check.
- **Every tick is a guarded write**, also a tick-only one: `CC.writeSections` with `ifRev` = the stamp the page worked
  from, so two tabs can never both fill the same shown need. Refused: the page reads again; if the row's need,
  fingerprint and records are what it showed, it sends once more; otherwise nothing is written: "This row changed
  elsewhere. Check it and tick again."
- **With `prefs.tick = 'lists'`** the same write has two parts: the Bourse records, and Lists' section after
  `LISTS.store`'s own `bought` edit (`lists/store.js`, existing; it returns `{ section, entry, capped }`; `makeKeys`
  empty) on each owner's share; `cr` is the real change of the count (the store caps a count at 999,999; then the row
  says "Lists' count is at its limit: N of M added"). Any Lists refusal: nothing is written, the reason is shown,
  with "Mark without adding to Lists". Where D34 refuses two parts (fallback storage) the switch is shown off with
  "Adding to Lists needs this browser's main storage."
- **Receipt and retry.** The write also records `device.bourse.done[<purchase id>] = <time>` in the save's
  device-only part (kept 24 hours), in the same transaction, and its `check` cancels when that entry exists. **After
  an unknown outcome** the page reads the save: a receipt means the write landed (stop), whether or not the mark is
  still there; none: send again with the same ids. So a mark undone or cleared before the retry can never be
  credited again.
- **Undo (status line, and "Undo purchase" in the row's More).** One `CC.writeSections` with `ifRev`: the purchase
  records removed and `cr` taken from each count, only if every count now holds at least its `cr`. An unrelated
  change that leaves enough is fine (10, +40, then 45 typed: Undo leaves 5). Otherwise nothing changes: "Not undone:
  Lists now counts 20 of <item>, fewer than the 40 this purchase added." **A record that holds a credit can be
  removed only this way** (D47): there is no "remove the mark only" for it; it leaves the Bought group at "New trip".
- **"New trip"** (More of the Bought group, error role, asks first: "Start a new trip? N marks and M items you added
  are cleared. Lists' counts are not changed.") removes every own item and every record without a credit, and raises
  `prefs.trip` by one. Records with a credit stay stored under their old trip number, out of the trip, in a closed
  group "Added to Lists on earlier trips (N)", each still with "Undo purchase". Nothing else removes a record.

**6.8 The trip's own items and the one-time copy (D10, D58).** `extra` holds items added by "Add to trip" or the copy;
removed only by the player ("Remove from trip", asks first) or "New trip".
The copy: the new Tracker, which alone can turn its entry keys into item numbers, writes on loading
`ui.live.mcopy = { v: 1, at, items: { <item id>: <amount> }, skipped }` into its own device record
(`eveniunt-tracker-ui`; `persist()` already stores `ui.live` whole), beside the untouched `mlist` and `mqty`. An
amount that is missing or not a number of 1 or more counts 1 (what the Tracker showed); two entries of one item are
added; an entry without an item number, unknown to the index or untradable is skipped and counted. The Bourse page, on
opening, reads that record (same site address only) and, if it holds items, sends one `CC.writeSections` whose `check`
cancels when `doc.device.bourse.mcopy` is already set, whose Bourse part is an **`edit`** that adds each item as
**`<item>.nq`** to the `extra` stored at that moment (the larger of the stored and the copied amount; over 99,999
becomes 99,999 and is counted) and whose `own.device` sets `mcopy: { at, copied, skipped, capped }`. Copy and receipt
land together or not at all, and an amount another tab saved a moment before is never lowered. The line says once:
"Copied N items from the Tracker's shopping list, as normal quality. M could not be matched; K amounts were over the
limit and set to 99,999. The old list is still in the Tracker's storage." No `mcopy` yet: nothing is copied or
recorded, and the next opening tries again.

**Said once (W2):** "You can buy on another world, data center or region you travel to, but you cannot sell there.
Whether you can travel is the game's rule; your travel area is set in Bourse settings. Travel stops 30 minutes before
maintenance. This is a plan from reported listings, not a promise that the route is open or the stock still there."
An all-worlds maintenance starting within 2 hours, or running, becomes the note block with the list's date (D17).
The module opens on Trip when a chosen list has market items or the trip has its own; otherwise on Item.

## 7. Watch list and alerts (on every page)

A watched item is an item, a quality and a target price. On the Watch view, on opening and on Refresh, the `deep`
service prices the list over the travel area; rows fall under "Below target", "Above target", "No price". An item is
**under** when the cheapest listing of its quality in the area (its unit price after D36's 5%) is at or under the
target and that world's report (D50) is no older than `oldDays`. An older or unknown age reads "Under, but the price
is old" or "Under, age unknown" and never rings. A region that failed leaves the row "Above target, <region> not
fetched" or "No price", never a plain "Above target".

**The shared checker** (`watch-alert.js`), loaded by Home and Settings, Submersibles, Lists, the Bourse, and the hosted
Tracker and Atelier:
- **Does nothing, and loads nothing more, when** the watch list is empty, `prefs.alerts` is off, the page is hidden,
  the device is offline, a pause is running, the ledger's storage is refused, or the browser has no Web Locks (the
  Watch view then says "Automatic checks are off in this browser. Refresh checks now."). It reads the save and never
  writes it. Only when there is something to check does it add `prices.js`, `bourse/data.js` and `bourse/services.js`.
- **One round at a time (D40).** The whole round runs inside the browser lock `eveniunt-bourse-watch`, asked for with
  "only if free". Inside the lock the page reads `eveniunt-bourse-alert` (`{ at, round }`); if it is younger than
  `prefs.alertMin` minutes (default 30) it leaves; else it writes the new time and the next round number and runs.
  **A round ends after 60 seconds at most: requests still open are aborted (each has its own 20-second deadline,
  D56), the lock is given back, and nothing that arrives later changes an alert.** A tab that closes frees the lock.
- **A round** asks `deep` once per region for the watched items (at most 6 requests), through the queue, the gate and
  the ledger. Results go into the shared cache by D56's order.
- **What a result belongs to (D57).** The round keeps what it asked for: its number, the area's chosen data centers,
  and per item the quality, the target and `oldDays`. Before loading the price code, before each request and before
  an alert shows or an entry is cleared, the page checks again: visible, online, alerts on, no pause, the round is
  still the stored one, the area is the same, the item is still watched with the same quality and target. A mismatch
  discards the result for alerts (the prices stay cached). A page hidden mid-round sends nothing more.
- **An alert** is one slim status line on the page that ran the round: "<item> is under your target on <world>: N gil,
  seen <age>. Open" (to `bourse/#item=<id>`), with "Close". **Ring once per crossing:** the device record keeps
  `alerted["<item>.<quality>"] = { target, area }` (written inside the lock). It rings only when the item is under
  and no entry exists for that target and area. **The entry is cleared only by complete fresh evidence:** in one
  round every region of the area answered (usable or confirmed empty) for the item, and the cheapest listing of the
  area is over the target with a known, fresh age, or the area is confirmed empty. A failed, unknown, cut-off or old
  result changes nothing; a cheaper offer that moved to another world of the area is the same crossing and does not
  ring again. A changed target or area is a new crossing. On a phone the name wraps; the world, price and age are
  never cut.
- **A page works without it.** If the script or the price code fails to load, nothing else changes.
- The Watch view and the sheet say: "Alerts ring only while this app is open in a tab. While it is open, it checks your
  watched items every N minutes, on any page. Turn this off under Alerts." No notification permission is asked.

## 8. The save: section `modules.bourse`, version 2, and the cloud copy

```
{ v: 1,
  watch:  { "<item id>.<nq|hq>": { target, at } },
  extra:  { "<item id>.<nq|hq>": { qty, at } },                        the trip's own items
  bought: { "<purchase id>":     { o, i, q, n, of, cr, ls, t, at } },  o: c1..c8, u, or x (own item); q: nq|hq
  prefs:  { area: { <data-center name>: 1 }, home, oldDays, dropDays, split, within, route, tick, gatherFree, taxCity,
            rankBy, alerts, alertMin, trip, lists: { <list id>: 1 } } }
```

- **Checker `CC.checkBourse`**, added to `CHECK`: always the whole frame in that key order; no arrays; no size limit;
  an entry is dropped only when malformed (bad key; no `target`; no `qty`; a purchase without `o`, `i`, `q` or `n`); a
  bad field is left out, never repaired. A purchase id is 8 to 16 of `a-z0-9`. Ranges: `target` 1 to 999,999,999;
  `qty` 1 to 99,999; `n` 0 to 999,999 (0 is a check record); `of` 0 to 999,999; `cr` 0 to `n`; `ls` 8 of `a-z0-9`;
  `t` and `trip` 0 to 999,999; `oldDays` 1 to 30; `dropDays` 1 to 90; `within` 0 to 100; `alertMin` 15 to 240; `split`
  `fewest|cheapest|within`; `route` `savings|items`; `tick` `only|lists`; `rankBy` `sales|listing`; `area` keys 1 to
  32 letters with the value 1; texts up to 40 characters. A default is not stored. **A purchase that arrives without
  `ls` or `t` (a hand-made or partial import) is kept; its row is to check.** Page limits (edit functions only; the
  save may hold more after a merge, section 6.5): 200 watched, 500 own items, 2,000 purchases of the current trip.
  `LABEL.bourse = 'Bourse'`; `describeUnit` words: "Bourse: watched item <name> (target N gil)", "Bourse: an item
  added to the trip (<name>, N)", "Bourse: a purchase of <name> (N)", "Bourse setting: <plain name>".
- **Merge, in pages that run the new code.** Units are two levels down. Changed on one side: taken. Changed
  differently on both: asked. **BY0** (`merge.js`; it runs whether or not the save holds lists): removed on one side
  and changed on the other: kept, asked until answered (`integrity.kind` `bourse`, `keep`); `ET.applyMerge` with no
  choice keeps it. Purchases are never edited (D47), so for them BY0 never fires: a record added on either side is
  kept, a record removed on one side is removed. **BI1** (`CC.writeSection`): a unit the page removed that the stored
  copy holds with another value is refused. **BI2:** `known.expect`.
- **Credits in a merge: rule BY2 (D46).** For one owner and item, per quality: `credits(X)` = the sum of `cr` over
  the purchase records side X holds for it; `own(X) = count(X) − credits(X)` (it may be negative: the player used
  bought stock). Ticks and Undo always change the count and the records together, so they never change `own`; only a
  typed count does.
  1. The records merge first, as above. `credits(merged)` is taken from the records the merge ends with.
  2. `own` merges as counts always have: changed on one side, that side's; changed the same on both, that; changed
     differently on both, **asked** (this device's until answered), the question showing the two counts as the
     player would see them (`own` of each side plus the merged credits).
  3. `count = own + credits(merged)`, kept within 0 to 999,999. If it would fall under 0, the count is asked like a
     clash (this device's count until answered); nothing is guessed.
  It touches only counts for which some side holds a record with a credit; every other count merges exactly as today.
  **Where it runs:** in `ET.threeWay`, which keeps the `own` values in its result, and at the end of `ET.applyMerge`,
  after every choice, which writes the counts from the records it ends with. Those two serve every merge of whole
  saves: the cloud sync (asked, and both unasked merges of `cloud.js`), a backup or code merged in, and the Tracker's
  same-device save (`ET.saveMerge`). **A page's own section write** (`CC.writeSection`, which merges one section and
  cannot see both) gets a refusal instead, **rule LI6:** a Lists write that would keep its own value of a count over
  a different stored one, while the stored save holds a credit for that owner and item, is refused with "This was
  changed on another device or in another tab since." (the page reloads its copy). The Bourse's own writes never
  merge (`ifRev`).
  **Undo and a typed count on two devices:** Undo removes record and credit together, so `own` is untouched and the
  other device's typed count is taken on top (50 with a 40 credit; one device undoes, the other types 45: 5).
  **A mark is never edited**, so "Undo against an edit of the mark" cannot arise; "Still count them" on the other
  device adds a check record and nothing clashes. **A purchase record that is missing** (lost, hand-edited, dropped
  as malformed): its credit simply stays in the count as the player's own stock; nothing is taken away, and it can no
  longer be undone.
  Named tests, each through the real cloud path and the real local path with no choice given (item B26): **"equal
  credits"** (a count of 10; each device adds 40 under its own purchase and stores 50: merged 90, two records; Undo
  of either leaves 50); **"unequal credits"** (10; +40 and +25: 75, no question); **"Undo against an edit"** (50 with
  a 40 credit; Undo here, 45 typed there: 5, the record gone; and with 20 typed there: asked, nothing under 0);
  **"an ordinary typed edit"** (a count with no credit merges exactly as before, bytes equal to the old rule's
  result; a count with a credit, typed on one device only: that count).
- **Older copies: the mixed-version contract (D32, decided).** `CC.VERSION` becomes 2. New code reads version 1 and 2
  and always writes 2; the cloud copy carries it. An older copy refuses a newer save in shipped code (`CC.checkDoc`,
  `save.js` line 209; the Tracker's save, `storage.js` line 269; the sync's read, `cloud.js` lines 164 and 170), so it
  never merges one and cannot lose a Bourse edit. **No older page writes or uploads over a version 2 save through a
  read** (B0, from the code). **What each older page really shows** (B0; these pages are already shipped and cannot
  be changed), the known limits of this decision:
  - **Tracker:** on opening, a dialog "Saved data could not be read … (This save was written by a newer version of
    the app. Reload the page to update.) A copy has been kept.", with "Download the unreadable data" and "Continue";
    each such opening stores one more rescue copy. A tab already open: its next save fails with "This browser did not
    let the tracker save. Save a backup file now", which does not name the cause.
  - **Atelier: nothing is shown.** It opens on its old local stats and silently stops saving to the shared save;
    stats typed in an old Atelier tab are not kept. This is the silent one.
  - **Home:** shows "Getting started" (or "Start here: cloud sync") as if the save were empty. It does not save.
  - **Lists, Submersibles:** "The save cannot be used here. … Nothing has been written over it."; after a refused
    save, "Not saved on this device: … reload the page to continue."
  - **Settings:** "The save cannot be used here: …", and on a save "Not saved on this device: This save was written
    by a newer version of the app. Reload the page to update."
  - **Sync from an older Tracker:** "The cloud copy was saved by a newer version of the app. Reload this page to
    update, then sync again."
  - **Recovery:** one reload of each open page while online (Submersibles reloads itself; the others need the reload).
    What was changed in an old page after the update was not saved. The release note (B12) says: "After this update,
    reload every open page of the app once. An old Atelier tab gives no warning."
  The alternative that was not chosen (removal marks: a removal adds a mark instead of deleting, so an old merge
  cannot turn it into a loss, at the price of filtering everywhere, growth and a later clean-up) was option (b) of
  question 10 in the round-one text of this file (in its history); the owner chose (a) in `docs/bourse-questions.md`,
  sixth round, which records only the choice.
- **The cloud copy (D48), `tracker/src/core/cloud.js`.** Read in the code: `upload` sends `If-Match` only when it has
  an `eTag` and always asks OneDrive to replace (lines 143 to 148); `ET.cloudSync` uploads without a condition when
  it found no file (line 193); `ET.cloudOverwrite` too (line 228). New code:
  1. **Create only if missing.** With no file found, the upload asks OneDrive to fail when the file exists
     (`conflictBehavior=fail`) [verify on the real service]. "Already exists" means another device created it
     meanwhile: the sync starts again, reads and merges.
  2. **Replace only the copy read.** Every other upload carries the `eTag` of the copy just read; `ET.cloudOverwrite`
     (the owner's own "replace the cloud copy") reads the `eTag` first and sends it. No upload is unconditional.
  3. **A copy written back by an older app.** `sync.drive` also records `v`, the save version of the copy last
     synced. When the copy read has a lower version than that, an older app replaced it (the transition case: an
     older device that saw "no file" uploads after a newer device created it, or a device that never updated
     overwrote on its owner's choice). Then **every unit the last synced copy held that the copy read lacks is kept,
     not removed, and asked** as one question: "Another device, still on an older version of the app, replaced the
     cloud copy. It lacks N entries this device has. Keep them (recommended) or remove them?" With no answer they
     stay. The merged copy is uploaded as version 2 (with the `eTag`), after which the older device is refused until
     it updates. A first sync after updating (no `v` recorded) counts as version 1: nothing special happens.
  Tests in item B27, "older" = the files at `<old>`: **"missing-file race"** (the older device finds no file; the
  newer device creates the copy; the older device uploads its copy over it; the newer device syncs: no unit is
  removed with no choice given, the question is raised, the upload is version 2, the older device's next sync is
  refused); **"two new devices create at once"** (the second gets "already exists" and merges); **"changed since
  read"** (a replace with a stale `eTag` is refused and the sync runs again); **"overwrite"** carries the `eTag`.
- **On the device only:** every price, sale, tax rate and attempt time (`eveniunt-bourse-prices`), the ledger
  (`eveniunt-bourse-ledger`), `eveniunt-bourse-device` (last view, which alerts rang), `eveniunt-bourse-alert`, and in
  the save's device-only part `device.bourse` (`mcopy`, the copy's receipt; `done`, the purchase receipts of the last
  24 hours; never in backups, codes or the cloud).
- **Rebuild:** `save.js`, `merge.js`, `cloud.js`, `one-look.css`, the header's page list, `live.js` and the
  hosted-only code of the Tracker and the Atelier change, so the Tracker (`tracker/dist`, `tracker/site`), the Command
  Center (`tracker/command-center/site`) and the Atelier (`crafting/atelier/dist`, `site`) are all rebuilt.

## 9. Screens

As **look v3 of `docs/bourse-look-spec.md`** and its pictures (approved, rounds five and six), including the states
page, plus D22 and D31. Fixed here: the header word is "Bourse", between Lists and Settings in the page list
(`tracker/tools/one-look-header.js` `MODS`), tool slot "Bourse settings" and, on Item, "Find an item"; Home gains a
card (live line "N watched" or "Nothing watched yet"); an age is written "14 min", "3 h", "2 days"; the Item screen's
answer is the price of one unit when buying the amount needed, labelled "each, for N" (the total divided by N, rounded
up), with the world and age; the Trip's answer follows D53. On a phone the quality switch (Item) and the ranking
switch (Profit) are reachable in the settings sheet or the head's More. **The standing sentences are decided as
written (round six):** foot "Prices are community reports collected by Universalis from players' game clients. Each
one says where and when it was seen and can be gone when you arrive. This app reads nothing from the game."; Profit
"An estimate from reported prices, after market tax. Not a promise." and the sentence of D29; the travel sentence of
section 6; the alert sentence of section 7. "Solve" appears only for a recipe not in `LISTS_DATA.noHandOver` and links
`../atelier/#recipe=<id>` (CC-09).
**States to be drawn by the look's owner before B11** (existing parts only: the unknown role, a sub line, More). Round
one: a row "to check" and its count; "made without <region>"; "approximate"; "A quick split"; "the only listings of N
items are here"; "N items without a home price"; the no-Web-Locks line; the copy's line (B0 found the first, the
seventh and the eighth still missing from the states page). Round two: "known so far" with what is missing; "Nothing
left to buy"; "the only reported listings…"; "kept: without it the trip would cost more than your X% allows";
"reference total (approximate)"; "unavailable: not among the region's 10 cheapest"; "at least N a day"; "cost unknown:
only N of M listed"; "normal quality (from the Tracker's list)"; "Added to Lists on earlier trips (N)"; the older-app
cloud question; the switch shown off on fallback storage.

## 10. Work items

**Order of running, after the gates of the ledger's "Order":** (B0 and B1 are done) B28, B2, B18, B3, B23, B24, B26,
B27, B4, B5, B16, B17, B13, B6, B19, B20, B7, B21, B25, B14, B8, B9, B15, B10, B22, B11, B12. (B13 to B15 were added
by the red team and round two of the owner; B16 to B25 by round one of the review; B26 to B28 by round two. Numbers
are stable.)

**Every builder item:** branch `bourse`; only the named files and rebuilt copies; `npm run build` twice, the second
exits 0 and `git status --porcelain` is empty after the commit; `npm run test:unit`; never merge. **Paths, written in
full once:** `src/` = `tracker/command-center/src/`; `check.js` = `tracker/command-center/check.js`; `build.js` =
`tracker/command-center/build.js`; `bourse.js`, `bourse.css` = `src/bourse/bourse.js`, `src/bourse/bourse.css`; a file
marked (new) does not exist at `<base>`; every other named file does; `dist/` and `site/` copies are generated, never
edited by hand. **Tests (D45):** each new assertion is seen failing without its change (a temporary revert, reported).
**Guards**, reported as "guard, passed before and after": PR-1 to PR-5, PX-7, BS-3a, BW-1, BN-1, BK-7, BV-1 to BV-3
and BV-7. Every negative assertion names its positive control in the same test. Browser checks answer
`universalis.app` with a stand-in that counts requests per region, and route `lists/data.js` to
`tracker/tests/fixtures/lists-fixture.json` unless "real data". `<base>` and `<old>`: D59. New check ids start at
C197.

- **B0 Baseline and facts (Haiku clerk). Done 2026-11-25**: `docs/bourse/b0-report.md`, section 15. It ran at
  `d7322c7`, before the module moves, which was expected; B28 takes it again at the real base. It did not map the
  price-site stand-ins of `check.js` to their checks and did not read the desktop-file import path: both go to B28.
- **B1 Saved replies (Sonnet builder). Done 2026-11-25**: fourteen files and `README.md` in
  `tracker/tests/fixtures/universalis/`, `tracker/tests/bourse-replies.test.js` (11 tests), section 15. The
  requester removes listing numbers and trace numbers from the files and makes the test check the allowed keys
  recursively (adjudication 2, R20); the plan uses neither.
- **B2 Price service: queue, options, readers (Sonnet builder; after B28).** Files: `src/prices.js`,
  `tracker/tests/prices.test.js` (PR-1 to PR-5 unedited; PX-1 queue: 60 calls: never over 2 in flight, 300 ms apart,
  40 wait and 18 resolve "not fetched"; PX-2 pauses, with D4's lift rules; PX-3 `PRICE.idb`: two places and two
  services apart, two writers of one record each keep the other's items; PX-4 `readDeep` on the fixtures: per world
  and quality, cheapest first, `cost` by D36, world and time on every sale, no names or listing numbers kept; PX-5
  `readSlim`; PX-6 `maxRequests`; PX-7 defaults give today's URL and limits; PX-8 `placePath` and `strict404`; PX-9
  outcomes: a "malformed success" is failed, records no "none" and keeps the last good value as stale, beside a
  well-formed one that is stored; a "capped high-quality-only slice" gives ordinary = unknown; an entry without
  `hq`, a price of 0, a fraction, an unknown world are dropped and counted; an old four-part record is unknown; PX-10
  a reply over `maxBytes` is failed and stores nothing, beside one just under it that is stored; PX-11 times: old,
  missing, 0, in the future, seconds against milliseconds; **PX-12 "world reply" (`world-one-item`, `world-batch`):
  every listing and sale takes the reply's world; a region row without a world is dropped; a world reply whose name
  is not the one asked is failed; report time and review time land in their own fields. PX-13 "confirmed empty": a
  whole, unfiltered, well-formed reply with no ordinary listing is confirmed empty for ordinary in that place; the
  same reply cut, filtered by quality, with one dropped entry, or with the item under `unresolvedItems` is unknown;
  "Oceania zero minimum" (`region-oceania-two-items`: a normal minimum of 0, only high-quality listings): the
  minimum reads as no value, never 0 gil. PX-14 "late answer": an older request's failure, and an older request's
  success, arriving after a newer success change nothing; a deadline passed is failed**). Accept: unit suite;
  `CHECK_ONLY=C113,C117,C155 npm run check` unchanged. Must not change: any record or URL of Submersibles or Lists.
  Escalate if: PR-1 to PR-5 need an edit.
- **B3 Save section and version (Sonnet builder; after B28).** Files: `tracker/src/core/save.js` (`checkBourse`,
  `CHECK`, `LABEL`, the labels, BI1, BI2, `CC.VERSION = 2` with `checkDoc` reading 1 and 2), `tracker/tests/core.test.js`
  (BS-1 checker table: every range and enum, purchase ids, a check record, a purchase without `ls` or `t` kept,
  `area` keys with a space or a digit dropped, the whole frame; BS-2 round trip through `unflatModules`; **BS-3a
  (guard) new code reads a version 1 save with every field unchanged; BS-3b new code writes version 2**; BS-4 BI1
  refused, store unchanged, with a control where the unit was not changed elsewhere and is removed; BS-5 two tabs on
  different watched items both kept; BS-6 BI2; BY-4 the labels word for word), rebuilt copies. Accept: unit suite;
  `CHECK_ONLY=C119,C122,C145,C146 npm run check`. Must not change: any rule or test of another section. Escalate if:
  an existing test needs an edit other than an expected version number.
- **B4 Shared look (Haiku clerk).** Files: `tracker/src/app/one-look.css` (`.ol-r-gil`, copied from `bm-r-gil` in
  `docs/bourse/mock/bourse-mock.css`), `tracker/command-center/one-look-fixture.html` (one gil block),
  `tracker/tests/one-look.test.js` (the role exists; ink on `--gil-m` reaches 4.5:1 in light and dark), rebuilt
  copies. (The Bourse's own sheet joins the drift test in B6, when it exists.) Accept: the test fails before, passes
  after; `CHECK_ONLY=C196 npm run check`. Escalate if: the contrast fails or another role's computed value changes.
- **B5 Price math (Sonnet builder; after B2).** Files (new): `src/bourse/market.js`, `tracker/tests/fixtures/
  bourse-fixture.json`, `tracker/tests/bourse-market.test.js` (BM-1 median, even and odd, 7 days, none is unknown,
  joined over three regions; BM-2 profit by hand for three crafts, both sale bases; BM-3 unknown material or sale is
  never 0 and never ranked, beside a priced one that is; BM-4 gathered at market and free; crystals; an untradable
  crafted material with a yield of 3 and a need of 4 costs two crafts; an unknown part, a fifth level and a loop are
  "Missing a price"; **BM-5 tax (D36): "per stack": two stacks of 35 at 1 cost 36 each, 72, not 73; "the saved
  small stack": the saved listing of 35 with a tax of 1 fits the rule; "field differs": a stand-in `tax` of 0 or of
  a wrong amount changes no cost and is counted; "merchant crossover": market 650 against merchant 670, the market
  wins before tax and the merchant after; "tie": a unit cost equal to the merchant's goes to the merchant; the
  seller's rounding; a city rate of 0 is used as 0; lowest and chosen city; the labelled 5%**; BM-6 old, too old,
  unknown age; slow sellers; bait; "no cost"; "thin data"; fewer than 3 sales is not ranked; **BM-7 D49: "excluded
  world": the region's cheapest listing sits on a world outside the narrowed area: the figure is the cheapest inside
  it, or "unavailable" when the 10 held are all outside, never the outside price; its world and age are shown; a
  stale world report makes it old. BM-8 D44: 40 sales in one hour read "at least 5.7 a day", not hundreds; 14 sales
  over 7 days read 2 a day. BM-9 D53: a recipe whose material is listed 3 of 5 has an unknown cost, beside the same
  recipe fully listed**; BM-14 a narrowed area leaves its worlds out of the median, sales a day and history; a
  failed region is named; an unknown world is left out and counted), `package.json`. Accept: unit suite. Escalate
  if: a rule cannot hold as written.
- **B6 Page shell (Sonnet builder; after B13).** Files (new): `src/bourse/{index.html,bourse.css,bourse.js}`;
  `build.js` (copy the page's files only); `tracker/tests/one-look.test.js` (`bourse.css` joins the sheets the drift
  test reads and must not contain `--gil-m` or `ol-r-market`, with a control sheet that does and fails). Steps: the
  header, the views' tab bar, the settings sheet (seven data-center boxes, the home-world picker by D41, one
  threshold field, the default mode Trade-off), empty states, the status line, reading the Lists data (packed or
  plain), saving through `store.js`. Accept: unit suite; `npm run test:browser`; check C213 (the built page, served
  by the check's own server, opens with an empty save and shows the empty trip; home world from each of D41's three
  sources). Opening offline is B20's. Escalate if: look v3 lacks a part the shell needs.
- **B7 Trip view (Sonnet builder; after B20).** Files: `bourse.js`, `bourse.css`, `check.js` C202 (stand-in replies
  for three regions: the three modes give the hand-worked stops and totals; a region removed at the threshold and
  kept one gil over; "one allowance" as BP-12; a required region with each of its two labels; the route starts at
  the home world and the three counts match BP-9; no home world: the first world named; "known so far" with what is
  missing, beside a fully priced trip that says "total still to spend", and "Nothing left to buy"; overshoot wording;
  "one offer in both replies" as BP-11; "made without <region>"; "Only high quality is listed"; a joined row for two
  characters; the travel sentence and the maintenance note with its date; 4 requests per 100 items counted first,
  then a reopen within 15 minutes sends none). Accept: `CHECK_ONLY=C202 npm run check`. Escalate if: a state of
  section 9 is not in the look.
- **B8 Profit (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C200 (opening sends 1 to 3
  requests; one press at most 12; never over 2 in flight; then a reload within 15 minutes sends none; the budget
  disables the main action with its sentence; a 429 pauses and says so with its end; three failures while connected
  pause, and the same three while offline leave no pause), C201 (the fixture's figures equal BM-2; both sale bases
  and the sample on the row; "unavailable" for a listing basis and the row not ranked by it; the sentence of D29
  once; the opened row's home figures and "cost unknown"; "of N ranked"; the five closed groups; a priced row beside
  a row that shows no 0 for an unknown; "no cost"; a negative profit; the bait flag; "Solve" present for one recipe
  and absent for a no-hand-over one; the tax list, and the labelled 5%). Accept: `CHECK_ONLY=C200,C201 npm run
  check`. Escalate if: a pass over real data draws slower than 1 second.
- **B9 Watch, and "Copy name" (Sonnet builder; after B14).** Files: `bourse.js`, `bourse.css`, `check.js` C203 (three
  groups; "Under, but the price is old"; "Under, age unknown"; "Above target, <region> not fetched"; the alert
  sentence; adding, changing, removing; over the limit; the no-Web-Locks line; at 360 px the longest name wraps and
  the world, price and age are whole), **C210** (D42, on each of the four views: the clipboard holds the exact name,
  also with an apostrophe and an accent; the refused-clipboard form). B9 owns C210 because it is the last view built;
  it may add the action to the rows of the earlier views. Accept: `CHECK_ONLY=C203,C210 npm run check`. Escalate if:
  the view needs B15.
- **B10 The Tracker's link and the copy (Sonnet builder; after B6).** Files: `tracker/src/app/live.js` (D9; `mcopy`
  by 6.8), the Tracker tests B28 lists (`tracker/tests/ui.test.js` lines near 799 to 840 at B0: those pinning the
  Tracker's price requests become tests of the link and of `mcopy`; no stand-in of another page's check is touched),
  `bourse.js` (the copy on opening), `tracker/tests/bourse-copy.test.js` (new: BC-1 `mcopy` from a list with a
  duplicate item, an unmapped entry, an untradable one, amounts 0, missing and 1,000,000; **BC-2 "normal quality":
  every copied key ends in `.nq`**), `check.js` C204 (control: at `<old>` the Tracker does ask the price host under
  this fixture; now it asks nothing; the link opens the Bourse; `mlist` and `mqty` byte-identical; the copy reaches
  the save once with its counts and "as normal quality" in the line, and the row says so; "crash"; "two tabs";
  "late"; **"a larger amount saved meanwhile": another tab stores 50 of an item between the page's read and its
  write; a copied 20 leaves 50, a copied 80 gives 80**; the downloaded file shows the moved line and no price),
  rebuilt copies. Accept: `npm run test:browser`; `CHECK_ONLY=C204 npm run check`. Escalate if: the hosted Tracker
  and the Bourse do not share device storage.
- **B11 Look checks and pictures (Sonnet builder; after B7 to B9, B14, B15, B21).** Files: `check.js` C206 (the limits
  of look v3 and the design rules on Trip, Item, Profit, Watch, the sheet measured by itself, the empty trip and
  every state of the states page, at exactly 1,440 x 1,000 and 360 x 800, in the light and the dark appearance, real
  data with stand-in prices, the three longest item names, five-digit counts, gil in the millions. Rows are counted
  only when wholly inside the area left by the fixed header, the bottom bar, the seal bar, the status line and a
  shown alert, **once with a live alert over the normal screen**; the counts must meet the numbers the look spec
  records (its owner-approved shortfalls included). It also measures: an opened row; the last action reachable above
  the fixed bars; no figure, name, world, price or age cut; the Item search field at least 160 px wide at 360 px;
  the same at 200% text size; where the first row starts; one primary and at most primary, More and one stepper per
  row; no data-face text without a digit; no age as "14M"; no configuring field at rest but "Find an item"; reading
  text at the house sizes; the status and alert line's form with Close and the age; 40 px targets; no sideways
  scroll; every computed colour a tone of a role, never the market role, gold on gil bars only), C196 (the Bourse page
  joins), evidence `bourse-*.png` in `docs/bourse/build/` (new folder) with `notes.md`. Accept: `CHECK_ONLY=C196,C206
  npm run check`; four planted faults each fail C206 and the unplanted page passes (a third bordered button; a row
  pushed under the bottom bar; a name cut; the search field squeezed), reverted and reported. Escalate if: a limit
  cannot be met without changing the look.
- **B12 Full run and records (Haiku clerk; last).** `npm run build` twice, `npm run test:unit`, `npm run test:browser`,
  `npm run check`, at the head that would ship; the entry in `docs/STATE.md` under "Built, waiting for the owner's
  `ship`": the commit tested, `<base>` and `<old>`; what was and was not tested (the live price site, the real
  OneDrive, Firefox, Safari, a real phone, a real two-device sync); what now runs while the app is open (the watch
  checker on every page) and how to stop it (Alerts, in Bourse settings); the save's new version, what each older
  page shows and the reload sentence of section 8; a pointer to the six owner rounds and both review rounds; the
  stale lines of `docs/STATE.md` "Next" replaced. Accept: git clean; counts reported. Escalate if: any failure.
- **B13 The store (Sonnet builder; after B3, B23, B17).** Files (new): `src/bourse/store.js` (pure edit functions:
  watch, own items, settings and the area, purchases by D33 and D47 (make, the check record, remove uncredited,
  Undo's two sections, "New trip"), the copy's `edit`), `tracker/tests/bourse-store.test.js` (BT-1 every edit and its
  limit, a default not stored; BT-2 the copy's edit: the larger amount kept, the cap counted, keys `.nq`; BT-4 "New
  trip": uncredited records and own items go, credited records stay under their old number, the number rises; BT-5 a
  tick shared across characters makes one record per owner; BT-6 the area; BT-7 no edit changes an existing purchase
  record, and none removes one except the three named edits, each of which does; BT-8 a section over the page's
  limits (600 own items, 3,000 purchases, 300 watched, as after a merge) is read, shown and editable downwards, and
  refuses only additions), `package.json`. Accept: unit suite. Escalate if: an edit needs a field the checker does
  not hold.
- **B14 Item (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C199 (every price names its
  world and age; every world of the area, by region and data center; the answer "each, for N" with world and age;
  listings and sales apart; a world missing from a cut reply reads "not among…", a world with a report time of 0
  reads "age unknown", and "none" only in a fixture whose reply proves it (D52); the home world's rows from the
  world reply, which carry no world of their own; "listed <age>" beside the report age; a failed region "not
  fetched"; qualities never mix; ages in words; the screen before a search; history by D43; 6 requests counted).
  Accept: `CHECK_ONLY=C199 npm run check`. Escalate if: a rule of D50 to D52 cannot be shown with the look's parts.
- **B15 Alerts on every page (Sonnet builder; after B9).** Files: `src/watch-alert.js` (new), `build.js`, one script
  line in `src/{index,submersibles/index,lists/index,bourse/index}.html`, the hosted-only code of
  `tracker/src/app/ui.js` and `crafting/atelier/src/atelier.js` at the places B28 reports,
  `tracker/tests/bourse-alert.test.js` (new: BA-1 the lock: two pages asking together run one round; a time younger
  than the interval runs none; no Web Locks runs none; BA-2 nothing loaded or sent with an empty list, alerts off,
  hidden, offline, paused or ledger storage refused, each after a control round that does send; BA-3 one ring per
  crossing, shared, after a first round that does ring; BA-4 no ring for an old or unknown age; BA-5 a round is at
  most 6 requests; BA-6 "hidden mid-round"; **BA-7 re-arm: a failed region, an unknown, a cut-off or an old result
  does not re-arm; "partial above target": two regions over the target and the third failed, then the third back
  with the same cheap offer: no second ring; complete fresh evidence over the target re-arms and the next crossing
  rings; the offer moving to another world does not ring again; a changed target does. BA-8 a target changed
  mid-round shows no alert for the old one. BA-9 "area narrowed mid-round": a result from a world now outside the
  area neither rings nor clears. BA-10 "hung request": it is aborted at its deadline, the round ends by 60 seconds,
  the lock is free, and its late answer changes no alert**), `package.json`, `check.js` C207 (on each of the seven
  pages a watched item under its target raises one alert line with Close and the age, and its link opens the Item
  view; two tabs send one round; then the negatives; with the script refused each page still passes its opening
  check; the downloaded files do not contain the script's name while the hosted ones do), rebuilt copies. Accept:
  unit suite; `npm run test:browser`; `CHECK_ONLY=C9,C196,C203,C207 npm run check`. Escalate if: a page's policy
  refuses the script or the price host.
- **B16 Trip math (Sonnet builder; after B5).** Files (new): `src/bourse/trip.js`, `tracker/tests/bourse-trip.test.js`
  (BP-1 buying an amount: whole stacks, overshoot, too few, only high quality, none; BP-2 "ten units, cheap split":
  one world sells all 10 at 100 each, two others sell 4 at 20 and 6 at 30: the start plan costs 84 + 189 = 273 with
  tax, never 1,050; BP-3 "2,001 units": 2,000 at 1 then 10,000 at 2 against one stack of 2,001 at 3: the plan costs
  6,303 with tax and is labelled approximate; **BP-4 ties: equal totals take fewer stacks; an equal-cost choice gives
  the same stacks whatever the order of the input; "the last stack changes the choice": a case where the best part-way
  set is not part of the best full set**; BP-5 the three modes on a hand-worked table; BP-6 the threshold edge: a
  region saving exactly `A` is removed, `A + 1` kept (`cheapest`, `within`), removed in `fewest`; a total of exactly
  `C0 + A` allows a removal, one gil more does not; BP-7 "sole supply" with both labels; BP-8 cover: a failed region,
  a cut slice and a confirmed empty reply give three outcomes and a removal never lowers the units found; BP-9 route
  order and hops from the home world; no home world: the first world, its data center and region; an unknown saving
  sorts last and is left out of the sum; BP-10 the budget: with `EVAL_MAX` 10 the plan is complete, valid, labelled,
  covers the same needs with correct arithmetic, and is identical whether stepped by 1 cell or by a million; a step
  never does more cells than given, also inside the first pricing; **BP-11 "one offer in both replies": one 4-unit
  offer on the home world, present in the region reply and the home reply, counts once (4 units); "two equal
  offers": two distinct offers of 4 at the same price in the home reply count twice (8 units); the home reply failed:
  the region's rows are used and labelled. BP-12 "one allowance": baseline 100, allowance 10, two regions and one
  stop each removable for 10: exactly one is removed and the total is 110, never 120 or 130; the two kept say why.
  BP-13 sizes: needs of 2,001, 99,999 and 999,999 give labelled approximate results within the step bound; 1,200 rows
  plan to the end; more than 300 stacks says so. BP-14 an approximate item that prices cheaper over fewer worlds
  keeps the cheaper set and raises no allowance; the total is called a reference**), `package.json`. Accept: unit
  suite. Escalate if: a rule of section 6 gives two answers for one input.
- **B17 Needs and what is left (Sonnet builder; after B5).** Files: `src/lists/engine.js` (`LISTS.sumShares` moved in
  unchanged, `LISTS.marketNeeds`), `src/lists/lists.js` (calls the engine's `sumShares`; nothing else),
  `src/bourse/needs.js` (new), `tracker/tests/bourse-needs.test.js` (new: BN-1 (guard) `sumShares` gives the same
  result as before for all steps and for one step; BN-2 `marketNeeds` equals it for the fixture's lists and names the
  lists; BN-3 settled: 40 of 99 marked leaves 59, with and without a credit; BN-4 "a fall in need is not a
  purchase"; BN-5 "changed list selection"; **BN-9 "another list, the same amount": a list needing 40 is unchosen
  and a different list needing 40 chosen: the row is to check, not settled with 0 left; the first list chosen again:
  settled**; BN-6 "still count" adds a check record and settles, the earlier records unchanged; BN-7 two characters
  make one row; BN-8 a mark of 99 of 99, the need back at 50: to check; BN-10 only the current trip's records count;
  BN-11 the total is "known so far" while a row is to check or unpriced, and a total once all are resolved). Accept:
  unit suite; `lists-engine` and `lists-model` tests unedited; `CHECK_ONLY=C150,C155 npm run check` unchanged.
  Escalate if: moving `sumShares` changes a Lists check.
- **B18 The ledger (Sonnet builder; after B2).** Files: `src/prices.js` (`PRICE.ledger`, the queue's use of it),
  `tracker/tests/bourse-ledger.test.js` (new, fake clock, fake storage and fake locks: BL-1 two pages reserving
  together never pass a budget; BL-2 retries, the home-world read, opening requests and a failed region asked again
  are charged; BL-3 a forced refresh is charged, ignores the gate and does not pass a rate-limit pause; BL-4 a
  rate-limit pause written by one page stops a second page and a second service; `Retry-After` of 30 seconds, of
  two days and absent; a pause's end never moves earlier; BL-5 the ranking order and the budgets 12, 72, 180 and
  300; a batch with one region failed is not priced; BL-6 no Web Locks: nothing automatic, Refresh sends one at a
  time, 1 second apart, at most 30 a page load, and honours a stored pause; storage refused: the same limits; BL-7
  an oversized reply and a deadline passed are charged; **BL-8 "two live tabs": both sending, the device never has
  more than 2 in flight nor two starts within 300 ms; an in-flight entry of a closed tab expires; BL-9 "six starts
  queued, then a pause": none of the six is sent; BL-10 a tab opened during a pause sends nothing, also Refresh for a
  rate-limit pause**), `package.json`. Accept: unit suite; `CHECK_ONLY=C113,C117,C155 npm run check` unchanged.
  Escalate if: Lists or Submersibles change behaviour with no pause running.
- **B19 Build and routing (Sonnet builder; after B6).** Files: `build.js` (`bourse/data.js` from `live.json` and
  `timers.json` with `BOURSE_AREA` and the timer list's date; stops unless the area is D25's seven),
  `tracker/tools/one-look-header.js` (`MODS`), `src/index.html` (card), `src/shell.js` (module list, live line), the
  count lines B28 lists (like for like, named in the pull request), rebuilt copies. Accept: unit suite; `npm run
  test:browser`; C196's page list (the Bourse is one of the pages, and a build without it fails). Escalate if: a
  check reads a count B28 missed.
- **B20 Services and the offline cache (Sonnet builder; after B19, B18).** Files: `src/bourse/services.js` (new: the
  five services of section 3 and the per-region joining, the one definition), `src/sw.js` (`PAGES`),
  `tracker/tests/fixtures/universalis/slim-ten-listings.json` (new: one real reply of the `slim` form, one request,
  trimmed and cleaned as B1's; its size in the README), `tracker/tests/bourse-services.test.js` (new: BX-1 each
  service's real path equals the saved ones; BX-2 three regions joined by D44; BX-3 a partial failure names the
  region; BX-4 the home world asked directly: its rows take the world of the reply and replace the region's rows
  for it (D51)), `check.js` C214 (control: before any visit the page does not open offline; after one online visit
  the page, its sheet and its data open offline; with a watch list the alert script's files are cached too), C215
  (two pages open together share the pause, the pace and the budget). Accept: unit suite; `CHECK_ONLY=C9,C214,C215
  npm run check`. Escalate if: the service worker refuses the price host, the price site cannot be reached for the
  one reply, or that reply is over a quarter of `maxBytes` for 100 items.
- **B21 Ticks, the Lists credit and Undo, on one device (Sonnet builder; after B7, B26).** Files: `bourse.js`,
  `check.js` C208 (tick only leaves `modules.lists` byte-identical, with the control that "also add" changes it;
  "also add" raises each character's count in the same write; "fault between the two": the Lists part refuses and no
  purchase is stored; "fallback storage": the switch is shown off and a tick only marks; **"two tabs, one need":
  both tick the same row; the second is refused and its row redrawn; "a removal before a retry": a credited tick,
  then Undo, then the tick's write sent again: the receipt stops it and the count is not raised; "stale tick-only":
  a tab with an old copy cannot fill a need another tab filled**; "stock cap": a count at 999,990 plus 40 records
  `cr` 9 and says so; "Undo after an unrelated edit", both ways; a credited record offers no "remove the mark only";
  a row to check with both actions; "New trip" after its confirm leaves Lists' counts and moves credited records to
  "earlier trips"). If B26 escalated, the switch and its cases are left out and the item says so. Accept:
  `CHECK_ONLY=C208 npm run check`. Escalate if: a case needs a rule section 6.7 does not give.
- **B22 Lists' high-quality prices (Sonnet builder; after B2).** Files: `src/lists/lists.js` (D8), `check.js` C191
  rewritten as C205 (an ordinary 100 and a high-quality 10,000 each on their own row and both in the subtotal; an old
  four-part record whose cheapest listing was high quality shows "not fetched yet" on both rows, is not in the
  subtotal, and is asked again; a minimum of 0 shows no price, beside a real minimum that does; the line "before the
  5% buyer's tax"), rebuilt copies. Accept: `CHECK_ONLY=C155,C205 npm run check`. Escalate if: C155 changes.
- **B23 One write for two sections (Sonnet builder; after B3).** Files: `tracker/src/core/save.js`
  (`CC.writeSections`; `CC.writeSection` calls the same inner function), `tracker/tests/core.test.js` (BW-1 (guard)
  every existing `writeSection` test passes unedited; BW-2 two sections land in one stored revision; BW-3 a refusal
  in the second part leaves the first unwritten, on IndexedDB and in memory; BW-4 `check` cancels all; BW-5
  `own.device`, also as a function, is written with the parts or not at all; BW-6 each part still merges and applies
  its own rules against a stale copy; **BW-7 `edit` runs on the stored section inside the transaction; BW-8 `ifRev`:
  the right stamp writes, another stamp refuses and writes nothing; BW-9 "fallback storage": two parts, or `ifRev`,
  are refused and nothing is stored, while a one-part call writes as before; an error thrown by the storage after the
  save was written and before its stamp is shown to be the case the refusal exists for**), rebuilt copies. Accept:
  unit suite; `CHECK_ONLY=C119,C122,C145,C146 npm run check` unchanged. Escalate if: any existing test of
  `writeSection` needs an edit.
- **B24 The merge rule and older copies (Sonnet builder; after B3).** Files: `tracker/src/core/merge.js` (BY0 and its
  `applyMerge` branch), `tracker/tests/core.test.js` (BY-1 two devices: both add, one changes, both change; BY-2 BY0
  asked until answered, each answer), `tracker/tests/bourse-versions.test.js` (new; "older" = the files at `<old>`,
  read by `git show`; BV-1 local path, this device removed: an older Tracker's real save against a version 2 save
  writes nothing, bytes identical, the edit still stored; control: against a version 1 save it writes. BV-2 the same,
  the other side removed. BV-3 cloud path: the older sync routine against a version 2 cloud copy refuses and uploads
  nothing, both orientations; control with a version 1 copy. BV-4 a version 1 cloud copy from an older device is read
  by new code and the upload is version 2. BV-5 new code, local path, real `ET.saveMerge`, no choice, both
  orientations: the edited unit is stored. BV-6 new code, a full sync with no choices, both orientations: stored, and
  asked until answered. BV-7 the older Atelier, Lists, Submersibles and Settings code each refuse to write a version
  2 save), `check.js` C197 (in a browser, with the built files of `<old>`: an older Tracker tab open while the new
  Bourse saves: its next save is refused with the sentence of section 8, and after a reload it saves again; **an
  older Atelier tab already open: it writes nothing to the shared save and shows nothing; an older Home shows
  "Getting started"**; each beside the same page against a version 1 save, which works), C198 (the BY0 question in
  the Settings dialog, each answer), rebuilt copies. Accept: unit suite; `CHECK_ONLY=C197,C198 npm run check`.
  Escalate if: `<old>` cannot be read, or any case shows an older copy writing.
- **B25 Worst sizes on a slow device (Sonnet builder; after B21).** Files: `check.js` C209 (the supported worst sizes
  of 6.5, with the processor slowed four times: no single block over 200 ms, also during the first pricing; the page
  answers a tap during planning; the plan appears within 10 seconds, full or labelled; **it covers the same needs and
  gives the same totals as the unslowed run, checked against hand-worked rows; two more cases: a forced small budget
  (labelled, complete), and a first pricing that alone takes several seconds (the page stays responsive and shows no
  plan until it is complete)**), `src/bourse/trip.js` (`EVAL_MAX` and the step size set from the run, never above the
  tested values). Accept: `CHECK_ONLY=C209 npm run check`; the timings in the report. Escalate if: the limits cannot
  be met with any `EVAL_MAX` of 2,000 or more.
- **B26 Credits in a merge (Sonnet builder; after B24, B23).** Files: `tracker/src/core/merge.js` (rule BY2 in
  `ET.threeWay` and at the end of `ET.applyMerge`), `tracker/src/core/save.js` (rule LI6 in the section write),
  `tracker/tests/bourse-credits.test.js` (new; every case twice: through the real cloud path (`ET.cloudSync` and
  `ET.cloudFinish` against a stand-in cloud, no choices) and through the real local path (`ET.saveState` and
  `ET.saveMerge` with a real `CC.transact`); BK-1 "equal credits"; BK-2 "unequal credits"; BK-3 "Undo against an
  edit", both amounts; BK-4 "an ordinary typed edit" with a credit present; BK-5 a count typed differently on both
  devices with a credit present: asked, this device's until answered, each answer, both shown as counts; BK-6 a
  missing purchase record: the count keeps the credit, nothing is taken; a record whose credit never reached the
  count: the count is not lowered under 0; BK-7 (guard) a save with no credited record merges byte for byte as at
  `<base>`, on the whole existing merge test set; BK-8 LI6: a Lists page with an old copy types a count the Bourse
  credited meanwhile: refused, stored count and record unchanged; control: with no credit the write behaves as
  today; BK-9 the rule after a choice: a clash answered either way leaves count = own + credits of the records
  kept), rebuilt copies. Accept: unit suite; `CHECK_ONLY=C119,C122,C145,C146,C198 npm run check` unchanged.
  **Escalate if: any existing merge or Lists test needs an edit, or a case cannot be made to pass: then the setting
  is not built (B21 leaves it out) and the owner is told.**
- **B27 The cloud copy (Sonnet builder; after B24).** Files: `tracker/src/core/cloud.js` (D48: create only if
  missing; every replace with the `eTag` read; `sync.drive.v`; the older-app question), `tracker/src/app/ui.js` (the
  question's wording in the sync dialog), `tracker/tests/core.test.js` or the existing cloud test file B28 names (BV-8
  "missing-file race"; BV-9 "two new devices create at once"; BV-10 "changed since read"; BV-11 "overwrite" sends the
  `eTag`; BV-12 a first sync after updating, with no `v` recorded, behaves as today; the stand-in cloud answers
  "already exists" and "changed" as OneDrive does), rebuilt copies. Accept: unit suite; `npm run test:browser`.
  Escalate if: an existing sync test needs an edit, or OneDrive's documentation does not give "fail if it exists" for
  this kind of upload (then the item stops and the transition case is put to the owner as a known limit).
- **B28 The baseline again, at the real base (Haiku clerk; first).** No edits. At the commit the branch starts from,
  after the module moves: pin `<base>` and `<old>` (D59); run `npm run build`, `npm run test:unit`, `npm run
  test:browser`; report B0's whole inventory again with file and line (the paths moved): the highest check id; every
  count of nav links, modules and Home cards; every test and check that reads the Tracker's Market Board; **each
  `universalis.app` stand-in of `check.js` with the check id and the page it belongs to**; where the hosted-only code
  of the Tracker and the Atelier adds the Main menu; the file that holds the cloud sync tests; whether the
  desktop-file import (`deskImport`) asks before it replaces; whether every path this section names exists. Accept:
  each answer with file and line; every path of section 10 confirmed or its new place given. Escalate if: a suite
  fails, a gate is not in the base, or a named file has no counterpart.

## 11. Risks, limits, owner questions

**First thing to verify:** B28: the paths and counts at the real base, and that the older pages still behave as B0
read them. Second: that OneDrive really refuses a create when the file exists (D48), from its documentation in B27 and
by the owner on the real service before `ship`. Third: one real `slim` reply with 10 listings (B20). Done already:
the older copies' refusal (B0), the price site's fields (B1), `lists/store.js` running by itself (B0).

**Risks.** `save.js` gains a version and a two-section write, `merge.js` a rule that touches Lists' counts, `cloud.js`
new upload conditions: the three most sensitive files of the app; every existing test stays unedited and B26 has a
byte-for-byte guard. Rule BY2 is new and unreviewed; it is built behind an escalation that leaves the setting out.
An older copy that cannot update (offline) cannot save beside an updated page, and each opening of an old Tracker
stores one more rescue copy. Load on a free service: bounded by D4, D27, D39 and D56. Web Locks is assumed in current
browsers. The to-check state can ask about many rows after the chosen lists change. The `slim` reply grows with its
10 listings. Moving `sumShares` touches the shipped Lists page. The header gains a seventh page.

**Known limits, as designed.** Direct materials only (D12). The ranking prices one unit (D13); its listing figure
sees a region's 10 cheapest only. The split is a good split, not the best; `cheapest` is cheapest among the regions
kept; amounts over 2,000 are approximate and their baseline a reference; equal-cost choices do not promise the fewest
worlds; a very large trip gets "A quick split". Hops are one way. The Bourse cannot know why Lists' need changed, so
it asks. Worlds other than home show only their region's cheapest 60 listings. The app does not know the game's
travel rules, whether a route is open, or whether stock is still there. Maintenance announced after the last build is
unknown. One home world for all characters. The Tracker's old list is copied as normal quality; an item added to it
by an old cached Tracker after the copy is not copied; the downloaded file's list is never copied. Lists' own prices
stay before the buyer's 5%, and say so. The seller's rounding is the cautious one. Purchase records that added to
Lists are kept until undone (about 80 characters each), also after "New trip". On fallback storage a tick cannot add
to Lists. Older pages: section 8, the Atelier's silence above all. A device that never updates and replaces the cloud
copy is caught by the next sync of an updated device, not before. A browser that refuses storage forgets a pause on
reload. Tax rates are a reading, with its time. Alerts need the app open in a tab, and Web Locks. Not tested by any
automated run: the live price site (but for the saved replies), the real OneDrive, a real phone, a real two-device
sync.

**Owner questions.** **Closed:** 1, 2, 4, 6 (round two); 3 (round three); 8 (round four); 7, 9 (round five); **5 (a)
the standing sentences as written; 10 (a) older pages stop saving until reloaded; 11 (b) Lists says "before the 5%
buyer's tax"; 12 (a) one home world; 13 (b) B0 and B1 ran before the second review (all round six).** **Open:**

14. **"Also add to I have in Lists" when you use two devices.** This is the optional setting (off unless you turn it
    on) that makes a tick in the Bourse also raise the item's count in Lists. The second review found that the count
    can come out wrong when two devices each tick a purchase of the same item before they sync: both add 40 to 10,
    both store 50, and the sync keeps 50 although two purchases of 40 are marked.
    (a) **Build a rule that keeps count and purchases together.** After a sync the count is your own part plus every
    purchase that added to it, so the example gives 90, and undoing one gives 50. What it costs: one more piece of
    work in the part of the app that merges saves, with its own tests; a purchase that added to Lists then stays
    stored until you undo it, also after "New trip" (it moves to "earlier trips"), and it cannot be removed while
    keeping the stock. Risk left: the rule is new and has not been reviewed by an outside model; if its tests cannot
    be made to pass, the setting is left out as in (b). Fairly sure it is right; not yet proven by a run.
    (b) **Ship without the setting for now.** A tick only marks; you type what you bought into Lists yourself, as
    today. Nothing can go wrong between the two; no extra work. What you give up: the setting you asked for in the
    first round, until it is built later.
    (c) **Keep things as they are** (the plan before this review): the setting is built without the rule. On one
    device it is right; with two devices ticking the same item before a sync, a count can be too low or a mark can
    stay for stock that was taken back, with no warning. Sure that this happens (read in the code).
    **Recommended: (a)**, with (b) as what happens by itself if the rule fails its tests.
15. **A third outside review.** Your request covered two rounds; the second failed the plan and this file holds the
    corrections, made by the same model family and not yet reviewed.
    (a) **Run a third round on the corrections only** before any Bourse code: one more wait of unknown length (the
    look work and the module moves can go on meanwhile); the best chance to catch a fault in the new merge and cloud
    rules on paper. (b) **No third round: build after the module moves**, relying on the tests named here: sooner;
    the new rules are then checked only by their own tests and the same family's review. (c) **Keep things as they
    are:** the Bourse stays paused and nothing is decided now; no cost, no progress. Fairly sure.
    **Recommended: (a)**, because the two new rules touch saved data.

**What was read, and what was not verified (this correction).** Read: both adjudications, both round-two reviews, the
B0 report, the fixtures' README, `cloud.js` 120 to 230, `merge.js` 70 to 290, `save.js` (whole, in round one),
`storage.js` 24 to 284, `lists/store.js` 300 to 360. Not read: the saved reply files themselves (their facts are
taken from the README, the adjudication and both reviews, which agree), `ui.js`'s sync dialog, `docs/bourse-questions.md`
round six (taken from section 14; the requester checked the section 8 reference against it afterwards), the look spec and pictures. Not verified: OneDrive's "fail if it exists"; a real
429; the size of a `slim` reply with 10 listings; that every merge of whole saves goes through `ET.threeWay` and
`ET.applyMerge` (B26 lists the callers before it changes them); Web Locks on the owner's browsers.

## 12. Red team and pre-mortem (2026-11-24)

**Same-family review:** a Claude model reading a Claude-written spec; not an independent audit. Findings are numbered
as sent (12 to 14 were not sent). The outside review rounds replaced several of these fixes ("Now").

| # | Finding | What changed then | Now |
| --- | --- | --- | --- |
| 1 | Old bought marks hide new needs | Marks cleared by the page when Lists' need is 0; "New trip" | D33, D47: the to-check state; nothing is cleared by the page |
| 2 | Tax model unknown | One model in percent; B1 records the reply's form | D36: the flat 5% per stack; the seller's city rate |
| 3 | Region name | `PRICE.placePath`; `strict404` | Found (B1) |
| 4 | Home world looks empty | D24: the home world is asked for too | D51: its reply is the authority |
| 5 | Split too slow | Each item priced once per world; 200 ms on the test machine | 6.1, 6.2, 6.5, D55, B25 |
| 6 | Split ignores data-center hops | Whole data centers removed before worlds | D37, D54 |
| 7 | Offline lockout | Offline failures do not count; Refresh lifts a failure pause | A rate-limit pause is never lifted (D4) |
| 8 | Ranking overstates profit | The higher of the cheapest listing and the sales middle; bait flag | D49: the listing has a world and an age |
| 9 | High quality in Lists reads "none" | `minPriceHQ`, then the `hq` filter, then a scan of 20 | D8: found (B1); a 0 is no value |
| 10 | Tracker list copy | The receipt only after a saved, non-empty copy | 6.8, D58: one write with its receipt, normal quality |
| 11 | Alerts on stale listings | Rings only within `oldDays` | D40, D57 |
| 15 | Tests that pass at the base; `sumShares`; packed data | Named guards; `sumShares` into the engine | D45; D14 |
| 16 | No `timers.json`; items too large; trip owner | Built copy only; B13, B14; D23 | D17; B16 to B28 |
| Look | Long names, "14M", wording, `--gil-m`, the states page | Sections 6, 9; D21; C206 | C206 measures the visible area (B11) |

**Pre-mortem.** (1) The price site changes a field: the readers give "failed" or "unknown", last good values show as
stale, nothing shows 0. (2) The ranked sale price is the travel area's and the home world sells for less: the opened
row shows it. (3) An old cached copy meets the new save: it refuses (D32); the Atelier does so silently. (4) The site
slows or refuses a device: the pause stops every page of the device for as long as the site says. (5) Rule BY2 has a
fault: it can only touch counts that a purchase credited, the guard BK-7 keeps every other merge byte for byte, and
the setting is off by default. (6) OneDrive does not refuse a create over an existing file: two devices that set up
sync in the same minute could each upload; the next sync of either merges, and D48's third rule keeps anything a
lower-version copy lacks.

## 13. Rounds two to five (2026-11-25)

| Round two | In this spec | Changes an earlier fix or decision |
| --- | --- | --- |
| The look: closest to Submersibles; state colours; gold for gil bars only | D31, D21; B4 | The look spec's first version |
| Section heads: draw both | Closed by round four (book-style) | — |
| The Trip's big number: the total to spend | Section 6.6 | None |
| Prices over the whole travel area, seven data centers, a setting | D25, D26, D44 | Answers 5 and 15 |
| Lookups roughly triple | D27; section 4 | The first plan's 10, 60, 150 |
| The trip by region, data center, world; another region only over the threshold | D28, D37; section 6 | Red-team fix 6 |
| Travel limits: buying works elsewhere, selling does not | Section 6 ("Said once"), D25 | None |
| The sale price for profit over the whole travel area | D29, D13; section 5 | The spec's earlier recommendation |
| Alerts on every page | D18, D30, D40; section 7; B15 | D18's first form |
| A listing is bought whole | Section 6.1 | None |

**One difference told to the owner.** `tracker/data/live.json` holds worlds for eight data centers: the seven and
Elemental (Japan). The spec uses the owner's seven and the build stops if the data gives anything else for those three
regions (D25).

**Orchestrator rulings after round two.** Red-team finding 8: "the higher of the cheapest listing and the recent-sales
middle" stands. Who pays the tax: both sides (research section 4); now D36.

**Round three.** The owner paused the build for one look; the downloaded Tracker's Market Board is link-only (D9).
**Round four.** Look B (Atelier-led) for the whole app; the dark-bars Trip withdrawn; the answer blocks stay on the
phone. **Round five.** Look v3 approved; the order of the ledger; an outside review before building; the labelled 5%
stays; the recommended ranking pace.

## 14. Round-one outside review (2026-11-25), and the owner's round six

Two outside reviewers read the plan at `0df8781`: ChatGPT (FAIL: 2 blockers, 14 major, 1 minor, 1 note) and Mistral
(PASS: 4 minor, 4 notes). The adjudication accepted every finding. The corrections were planned by a Claude model on a
Claude-written spec (same family). Round two (section 16) found most of them partly open; the "Where" column below is
the round-one place, and section 16 says what changed since.

| Finding | What changed in round one | Where | Left as a known limit then |
| --- | --- | --- | --- |
| 01 ledger, order, closed choices | One ledger; the order; closed questions; home-world order; "Copy name"; one history window | Ledger; D41, D42, D43; C210 | One home world for all characters |
| 02 older copies (blocker) | The save's version becomes 2; area keys are data-center names; tests in both orientations on both paths | D32, D25; section 8; B24 | An old page must be reloaded |
| 03 outcomes | Four outcomes; field rules; last good values kept as stale; quality slots in Lists | D35, D5, D6, D8 | Other worlds are seen through the cheapest 60 |
| 04 tax | Both taxes once; no "before tax" figure | D36; BM-5 | The seller's rounding is the cautious one |
| 05 ranking inputs | The basis shown; fewer than 3 sales not ranked; unpriced parts never free; yields; "no cost" | Sections 4, 5; D12 | The ranking still prices one unit |
| 06 worlds and ages | A world and time on every sale and listing; one filter before every figure | D6, D44; section 7 | — |
| 07 start plan, large amounts | Whole stacks over all worlds together; over 2,000 units approximate | 6.1, 6.2; BP-2, BP-3 | Over 2,000 units is not exact |
| 08 trip start, baseline | Starts at home; one baseline; required places; hops one way | D37; 6.3 to 6.6 | Greedy |
| 09 budget | Evaluations counted; a labelled fallback; a slowed-device run | D38; 6.5; B25 | A very large trip gets "A quick split" |
| 10 purchases (blocker) | A purchase record with its credit; need changes asked; one write; conditional Undo | D33, D34; 6.7; B21, B23 | The Bourse cannot know why a need changed |
| 11 the copy | Same site only; copy and receipt in one write; counts shown | D10; 6.8; B10 | A later edit of the old list is not copied |
| 12 load | A device ledger; a persisted pause; `maxBytes`; caches merged per item | D4, D5, D39; B18 | Without Web Locks manual only |
| 13 alerts | A lock for the round; rechecks; late results discarded | D40; section 7; B15 | Without Web Locks no automatic checks |
| 14 tests and items | Guards named; positive controls; items split | D45; section 10 | — |
| 15 to 17 (spec side) | C206 counts rows in the visible area; phone switches; seven boxes; one threshold field | B11; section 9 | The drawings are the requester's |
| 18 dates and caveats | The timer list's date and the route caveat shown | D17; section 6 | Maintenance announced after the build |
| Mistral F1 to F8 | "no cost"; one history window; closed questions; 30 minutes; with 07, 02, 12 | Sections 5, 11; D43; D27 | — |

**Defaults round one set:** fewer than 3 sales in 7 days is not ranked; 300 Bourse requests per rolling hour per
device; 2,000 purchases per trip; a reply over 2 MB is refused; an alert round ends after 60 seconds.

**Round six (owner, 2026-11-25).** Questions 5 (a), 10 (a), 11 (b), 12 (a) and 13 (b) are answered and closed: save
version 2 with older pages stopping to save; B0 and B1 before the second outside review; Lists gains the line "before
the 5% buyer's tax"; one home world; the standing sentences as written. The owner keeps the answer band's state blocks
on the phone, accepting 3 resting rows on Item, Profit and Watch, to be written into `docs/design-rules.md` with the
first-row exception by the one-look rules pull request.

## 15. Facts found by B0 and B1 (2026-11-25)

**B1, the price site** (`tracker/tests/fixtures/universalis/README.md`, test `tracker/tests/bourse-replies.test.js`,
11 of 11 passing): every field the plan had marked [verify] was found, so no fallback is needed. The region paths are
`North-America`, `Europe`, `Oceania`; Gilgamesh is world 63. A city tax rate is a **whole percent** (5, 3, 0). A
listing's `total` is **price times quantity, without the tax**. A listing's `tax` is **5% of that total, rounded
down, in all 139 saved listings, whatever the retainer's city** (eight cities occur); the one listing the README read
as "about 2.8%, a 3% city" is that rounding on a small total (1 gil on 35), so the buyer's 5% is flat and D36 holds.
The seller's deduction is in no reply. `lastUploadTime` and `worldUploadTimes` are in milliseconds, a sale's
`timestamp` and a listing's `lastReviewTime` in seconds; some `worldUploadTimes` are 0. `worldUploadTimes` appears
only on region replies; **a world reply carries `lastUploadTime`, and its listings and sales carry no world** (D50).
`minPriceNQ` and `minPriceHQ` are present, also with `listings=0`, but name no world, and **read 0 where a quality has
no listing** (Oceania; D52). `listings=60` caps per item; `listings=300` is accepted (134 came back; that proves no
maximum). A one-item request returns the item without the `items` wrapper; a batch adds `unresolvedItems`. An unknown
item and an unknown place both answer 404 with the same body. Sizes before trimming: a two-item region reply 9.6 kB
(Oceania) to 53 kB (North America); a four-item North America batch 110 kB, so **the 2 MB reply cap of D5** is far
above normal replies; a 100-item reply was not measured. Two gateway errors (504, 502) cleared on one retry each; no
reply carried a rate-limit or wait header, so a 429 and `Retry-After` remain unseen.

**B0, the app** (`docs/bourse/b0-report.md`): at `d7322c7` the build is clean, unit tests 634 of 634 (645 of 645 with
B1), browser tests 67 of 67, drift check C196 passes; the highest check id is C196; `checks.yml` uses `fetch-depth:
0`; the one-look rules and the module moves are not yet in the base (expected; B28 runs again after them). For D32,
read from the code, not run in a browser: no older page overwrites or uploads over a version 2 save through a read;
what each older page shows is in section 8. One upload of the older code has no condition: the one made when no cloud
file was found (`cloud.js` line 193), which D48 answers. No content policy exists; both service workers pass
cross-origin requests through. `lists/store.js` loads by itself and its `bought` returns `{ section, entry, capped }`.
Not done by B0: the price-site stand-ins of `check.js` by check and page; the desktop-file import path (B28).

## 16. Round-two outside review (2026-11-26)

Both reviewers read the plan at `f6610c6`: ChatGPT (FAIL: 1 blocker, 16 major, 2 minor, 1 note) and Mistral (PASS: 2
minor, 3 notes). `docs/bourse-review-adjudication-2.md` accepted every finding but one part of R10. **The corrections
below were planned by a Claude model on a Claude-written spec (same family) and are unreviewed; the Bourse stays
paused, and whether a third round is run is the owner's choice (question 15).** R17 to R19 and Mistral R2-2 belong to
the look, R20 to the saved replies and their test: the requester's, not made here.

| Finding | What changed | Where | Left as a known limit |
| --- | --- | --- | --- |
| R01 credit and sync (blocker) | A count is the player's own part plus the credits of the records that exist; the rule runs in the whole-save merge and after every choice; a page's own stale write is refused; records are never edited and a credited one leaves only by Undo; the setting is built only if the rule passes | D46, D47; section 8 (BY2, LI6); 6.7; B26 (BK-1 to BK-9); owner question 14 | Credited records are kept until undone; new and unreviewed |
| R02 tick identity, retry, fallback | A tick is bound to the need and the lists behind it; every tick is refused on a changed save; a receipt on the device outlives the mark; two-part writes are refused on the fallback storage | D47, D34; 6.7; section 8; B17 (BN-9), B21, B23 (BW-7 to BW-9) | On fallback storage a tick cannot add to Lists |
| R03 cloud create race | Create only if missing; replace only the copy read; a lower-version copy removes nothing without an answer | D48; section 8; B27 (BV-8 to BV-12) | Caught at the updated device's next sync; OneDrive's refusal not yet seen |
| R04 ranking listing, sales a day | The ranking reads 10 listings with worlds, or says "unavailable"; sales a day over the window, "at least" when cut | D49, D44; sections 3, 5; BM-7, BM-8 | A region's 10 cheapest only |
| R05 world replies, two times | Rows of a world reply take its world; region rows carry their own; report time and review time apart | D50, D6; PX-12; C199; BX-4 | — |
| R06 home offers counted twice | The home reply is the authority for the home world; no matching by price and size | D51, D24; 6.1; BP-11 | — |
| R07 "none", zero minimum | "Confirmed empty" only from a reply that proves it; a minimum of 0 is no value | D52, D35, D8; PX-13; C205 | — |
| R08 partial inputs | A recipe cost needs every amount covered; the Trip says "known so far" with what is missing | D53; sections 5, 6.6, 9; BM-9, BN-11 | — |
| R09 allowance, reference, labels | One allowance for the whole trip; an approximate baseline is a reference; "only reported listings"; a first world without a home | D54; 6.2, 6.4, 6.6; BP-12, BP-14, BP-7, BP-9 | `fewest` has no allowance, by its meaning |
| R10 buyer's tax | The flat 5% per stack, rounded down, is the one basis; the `tax` field is a cross-check and never overrides; rounding per stack; the seller's side cautious | D36; section 15; BM-5 | The seller's rounding is not in any reply |
| R11 sizes, steps, ties | Every size has a rule; steps counted in cells, the first pricing included; a bounded search above 2,000; a tie rule the table keeps | D55; 6.1, 6.5; BP-4, BP-10, BP-13; B25; BT-8 | Equal totals do not promise the fewest worlds |
| R12 pace across tabs | Starts and requests in flight shared by the device; a 20-second deadline; `Retry-After` honoured in full; answers ordered by their request's start | D4, D56, D39; PX-14; BL-4, BL-8 to BL-10 | Storage refused: a reload forgets a pause |
| R13 alerts | A result belongs to its round, area, quality and target; re-arming only from complete fresh evidence; the "different world" line removed | D57; section 7; BA-7 to BA-10 | — |
| R14 the copy's quality | Normal quality, said on the row and in the line; the larger amount worked out inside the write | D58, D34 (`edit`); 6.8; BC-2; C204 | A high-quality wish must be added again by hand |
| R15, Mistral R2-1, R2-3, R2-4, R2-5 | Ledger, sections 8 to 11 and 15 at round six; questions 5, 10 to 13 closed; each older page's real behaviour; "found (B1)"; the reply cap is D5 | Ledger; D32, section 8; sections 3, 11, 15; B12 | The Atelier's silence |
| R16 items | Full paths once; guards named apart; controls paired; B4 and B6 untangled; B9 owns C210; two pinned commits and the inventory taken again | Section 10; D59; B28 | — |
| R17, R18, R19, Mistral R2-2 | (look) States this round needs are listed for the look's owner | Section 9 | The drawings are the requester's |
| R20 | (saved replies and their test) The plan stores no listing number and uses no trace number | D6; B1's note | — |

**Defaults this round set, for the reviewers and the owner to see:** the ranking reads 10 listings a region; a request
is given up after 20 seconds; the price site's own waiting time is honoured without a ceiling; purchase receipts are
kept 24 hours; at most 300 stacks of an item are weighed; without Web Locks, Refresh sends at most 30 requests a page
load, one at a time.
