# Bourse, the market module (blueprint phase 4): build spec

Written 2026-11-24 for a Sonnet builder and a Haiku clerk; revised after a same-family red team (section 12), the
owner's rounds two to five (section 13) and, on 2026-11-25, **round one of the outside review (section 14)**. Plan only:
nothing was built or run. **Building is paused** until round two of the outside review passes (order below).
Binding inputs: the owner's answers in `docs/bourse-questions.md` (five rounds; a later round replaces an earlier one),
`docs/bourse-review-adjudication.md` (every finding accepted), the look spec `docs/bourse-look-spec.md`, look v3
(screens are not designed here), `docs/design-rules.md`, `docs/bourse-research.md`.
Blueprint rules restated: **CC-12** prices are labelled as community reports with when and where they were seen;
listings and past sales are shown separately; the market tax is counted; "profit" is an estimate, never a promise;
lookups are batched and cached; stale or missing data is marked. **CC-08** a website alerts only while open in a tab.
**CC-09** a "Solve in the Atelier" link that cannot be matched exactly is refused, not guessed.

Trust marks: **[shipped]** = a reply field or query the shipped code already reads (`prices.js`, `lists.js`, `live.js`);
that shows what our code expects, not what the price site does. **[verify]** = known from memory or third-party
listings only. Item B1 checks both kinds against saved real replies before anything is built on them.

## Binding ledger (later rounds replace earlier ones)

| Decision in force | Bound by | Where here |
| --- | --- | --- |
| Name "Bourse"; it replaces the Tracker's Market Board (a link, the shopping list copied once) | answers 1, 2 | D9, D10 |
| The downloaded single-file Tracker: its Market Board points to the Command Center, no prices | round three | D9 |
| Market only; no Gathering, no retainer ledger | answers 3, 8 | section 1 |
| One home world for the Bourse, read in a fixed order of sources | answer 4 (default) | D41; owner question 12 |
| Travel area: exactly seven data centers in three regions, narrowed by a setting | round two (replaces 5, 15) | D25, D26 |
| Four views (Trip, Item with history, Profit, Watch); opens on Trip when a list has market items | answers 9, 13, 14 | sections 5 to 7 |
| PC: "Copy name" on every item row | answer 10 | D42 |
| Age limits set by the owner, defaults 1 day "old", 7 days left out | answer 16 | section 5 |
| Fetch on opening, one automatic try per 15 minutes per place, plus Refresh | answer 17 | D7, D39 |
| Prices for the amount needed; a listing is bought whole; bait marked, never hidden | answers 18, 19; round two | section 6, section 5 |
| Profit: both sale figures, ranked by the middle of recent sales; qualities never mixed | answers 20, 22 | section 5, D35 |
| Materials: cheapest of merchant or market; gathered at market value with a switch; crystals at market | answer 21 | section 5 |
| Tax: both sides pay; the seller's rate is this week's lowest city, every city listed; labelled 5% when unreadable | answer 23, round five, research section 4 | D36 |
| Gil per craft, return and sales a day beside; slow sellers sink; all recipes; the recommended ranking pace | answers 24, 25, round five | sections 4, 5 |
| Three split modes, threshold default 10%; fewest region hops first, then biggest savings; another region only when its saving beats the threshold | answers 26, 27, round two | D28, D37 |
| A tick marks only (default); adding to Lists' "I have" is a switch | answer 28 | D33 |
| The lists chosen, combined | answer 29 | D14 |
| History: 7 days shown, 30 when the site has them; figures and one small chart; one window's middle (the "this week against last week" idea of answer 38 was not taken: the approved Item screen shows one window) | answers 30, 31, round five | D43 |
| Prices never in the save; the watch list, own items, purchases and settings are | answers 32, 39 | section 8 |
| Watch list with in-app alerts on every page | answers 33, 34, round two | D30, D40 |
| Look v3 (look B, Atelier-led), approved; state colours, gold for gil bars only; the answer blocks stay on the phone | rounds two to five (replace 35, 38) | D31, section 9 |
| The Trip's answer is the total to spend; sale prices are read over the travel area | round two | section 6, D29 |
| Lists gains high-quality prices | answer 40 | D8 |
| Order of work and the outside review | round five | below |

**Order (round five; adjudication).** (1) Round two of the outside review passes on this corrected plan. (2) The
one-look rules pull request (look B and the phone exception written into `docs/design-rules.md`, with its checks).
(3) The module moves, one pull request each (Lists, Atelier, Tracker, Home and Settings, Submersibles). (4) The Bourse,
last, straight into the one look. No Bourse item, B0 and B1 included, starts before (1); B4 and later also wait for (2)
and (3). Owner question 13 asks whether B0 and B1 may run earlier.

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
  `window.BOURSE_PLACES`. Place names on screen and in a request differ ("North America", `North-America`): one map,
  `PRICE.placePath(name, places)`, tested against the real paths B1 saves; a place the map does not know is never sent.
  Maintenance times: `tracker/data/timers.json`, built in as `window.BOURSE_MAINT` **with the date the list was built**
  (D17). [A second data file: a second pin. Lists' hard-coded region map: a third copy of the worlds.]
- **D2 One price source, five reply kinds** (section 3). The aggregated endpoint is not used. [Aggregated for the
  ranking: it gives an average; answer 20 asks for the middle of recent sales.]
- **D3 Saved replies first.** B1 saves real replies; a test asserts every field of section 3. A field that fails takes
  the fallback written beside it; a feature with no fallback is escalated. A reply is never written by hand and called
  a fixture; hand-made stand-ins are named `stand-in` and use only fields the fixtures hold.

**The price service** (`tracker/command-center/src/prices.js`, existing file, extended; `PRICE.create` keeps every name)
- **D4 One request queue per page**, `PRICE.queue(url)`: the only call of `fetch` in the file. At most 2 requests in
  flight, 300 ms between starts, at most 40 waiting (more resolve "not fetched"). Existing services go through it.
  Pauses live in the shared ledger (D39), so every page of the device honours them: after an answer 429 nothing is
  sent for 15 minutes, or for the reply's own `Retry-After` when longer [verify], at most 6 hours; after three failed
  answers in a row, 15 minutes. A failure while offline does not count. **Coming online or pressing Refresh lifts a
  failure pause; nothing lifts a rate-limit pause before its time** (Refresh is the one deliberate bypass of the gate,
  never of this pause). [A cap per service: two modules on one page would add up. The published pace: unconfirmed.]
- **D5 New options of `PRICE.create`, each defaulting to today's behaviour:** `endpoint(place, ids)`, `freshMs`,
  `noneMs`, `batch` (100), `maxRequests`, `storage`, `strict404`, `outcomes` (D35), `maxBytes` (a reply is read as a
  stream and abandoned past this size: a failed fetch, charged, nothing stored; the Bourse sets it from B1's measured
  sizes, never over 2 MB), `ledger` (D39). The default `storage` is today's one record, byte for byte.
  `PRICE.idb(name)` is a second `storage`: an IndexedDB database of its own (`eveniunt-bourse-prices`), **one record
  per service and place, updated per item inside one database transaction** (read the record, fold in this reply's
  items, write), so two pages or two services never overwrite each other's items; memory only when IndexedDB is
  refused, and the screen says prices are not kept. `strict404`: a 404 is a failed fetch, never "no market price",
  unless B1 shows the unknown-item form can be told from the unknown-place form. [A second price file: a fork.]
- **D6 Quality, world and time live in the stored value**, made by shared readers: `PRICE.readDeep(x)` gives
  `{ up, w: { <world>: { up, n: [[price, qty, cost]…], h: […] } }, s: { n: [[price, time, world, qty]…], h: […] },
  cap: { n, h } }` (`cost` = what the buyer pays for the whole listing, D36; `cap` = the reply held exactly the asked
  number of listings, so more may exist); `PRICE.readSlim(x)` gives `{ up, n: { min, sales: [[price, time, world]…] },
  h: {…} }`. A sale or listing keeps its own world and time; names of retainers and buyers are never stored. Each
  reader returns an outcome (D35), never a bare `null`. [A cache key per quality: two requests for one reply.]
- **D7 The 15-minute gate, per service and place, is unchanged** for every automatic try; Refresh ignores it. For the
  Bourse's services no automatic try is made or recorded while offline. (Lists and Submersibles keep their behaviour.)
- **D8 Lists gains high-quality prices by changing only its own `read`, and its query only if needed.** First choice:
  the reply's `minPriceNQ` and `minPriceHQ` [verify]; stored value `[cheapest of any quality, average, world, upload,
  cheapest ordinary, cheapest high quality]`. Fallbacks as before (the `hq` filter, then a scan of 20 listings).
  **An ordinary row shows and adds up slot five; a high-quality row slot six; slot one is never shown as either.** A
  stored four-part record has no quality: both rows read "not fetched yet", it is left out of the subtotal, and the
  item counts as due at the next permitted fetch. Lists keeps its own price place. [Lists reading the Bourse's cache:
  two modules on one record.]
- **D9 The Tracker's fetcher is removed** (answer 2; round three). `live.js` `mbFetch`, `mbSummary`,
  `fillMarketLines`, `renderMarket` go. Inside the Command Center the Market Board page is the empty-state form with
  one link "Open the Bourse", and an entry's detail line is a link "Prices in the Bourse" (`../bourse/#item=<id>`). In
  the downloaded single file the page says the market moved to the Command Center and shows no prices (closed, round
  three). [Embedding `prices.js` in the Tracker: a third build to keep in step.]
- **D10 The Tracker's shopping list is copied once per device, never moved** (details in section 6.8). `mlist` and
  `mqty` stay stored. The copy and its receipt are one write; the player is told what was copied and what was skipped.
  [The Tracker writing the section: its save path is not guarded by the section rules. Deleting the old list: drops
  player data. A receipt in device storage: a crash between the two writes copies twice.]

**Profit**
- **D11 The ranking fills only when asked.** Section 4.
- **D12 Profit of one craft**, section 5. Direct materials only, except a material that cannot be traded and has a
  recipe, which is costed by its own materials (four levels at most, loop-safe; any unknown part makes the whole
  craft "Missing a price", never free). [Cheapest of buying or crafting every material: a second plan engine.]
- **D13 The ranking prices one unit, cautiously, and says so; the opened row prices the recipe's amounts** by walking
  the listings and shows the home world's own figures (D29). In the ranking a material's market price is the higher of
  its cheapest listing and the middle of its recent sales. [Deep listings for every ranked craft: twenty times the
  reply size. The cheapest listing alone: a bait listing would rank a craft.]

**Trip**
- **D14 The trip's needs** are Lists' items to buy on the market for the lists chosen, plus the trip's own items, less
  what is marked bought (D33). A new pure `LISTS.marketNeeds(plan, listIds)` in `engine.js` returns
  `[{ key, item, quality, qty }]`. The page's private `sumShares(plan, ids, stepId)` (`lists.js` line 424) **moves
  into the engine unchanged, third argument included**, as `LISTS.sumShares`; the Lists page calls that one;
  `marketNeeds` calls it with `null` (every step). One plan per character (D23). [Reading Lists' drawn page: not data.]
- **D15 One split method for all three modes**, section 6. The screen says "a good split", never "the best".
  [An exact fewest-stops search: it grows too fast with the worlds of seven data centers.]
- **D16 (replaced by D33, round one).** The earlier rule read a fall in Lists' need as a purchase and let the page
  clear marks by itself; both are withdrawn.
- **D17 Maintenance comes from the built copy of the Tracker's timer list only**, and the note always shows the list's
  date: "Maintenance times as of <date>. A maintenance announced later is not known here." [The Tracker's outside
  timer source from this page: a second outside host.]

**Watch, save, look**
- **D18 Alerts run on every page of the app** (round two). D30, D40, section 7.
- **D19 The save section has a checker in `save.js`**, no arrays, every key safe. Section 8. [No checker: outside
  data would reach the page unchecked.]
- **D20 A unit removed on one side and changed on the other stays until the player answers** (rule BY0, as Lists'
  LY0); between tabs the same case is refused (BI1). This protects pages that run the new code; **older copies are
  covered by D32.** [The generic rule: an unanswered merge deletes the edit.]
- **D21 The module adds layout only** (`bourse.css`, every class `bm-`, no colour value, no shared token). The gil role
  moves into `one-look.css` as `ol-r-gil`, for gil bars only; the module's sheet never names `--gil-m`.
- **D22 One addition to the look spec:** the Profit view's filter sits in the Ranking group's More as "Filter crafts",
  its value readable in the head's state line; no field at rest.
- **D23 Who owns a trip row.** Needs are worked out per character, then rows of the same item and quality are shown as
  one row to buy with the amounts added; the opened row lists each character's share. A tick on a joined row is shared
  out in the fixed order `c1`…`c8`, `u`, `x`, each need filled before the next, **as one purchase record per owner,
  all in one write** (D33). [One mark for the joined row: it could not be credited to the right character.]
- **D24 The home world is asked for too.** A region's reply holds only its cheapest 60 listings per item, so the Trip
  sends the same items to the `deep` service at the home world as well. For any other world the words are "not among
  its region's cheapest 60 listings", never "none" (D35).

**Round two (2026-11-25)**
- **D25 The travel area is a setting; its default is the owner's seven data centers.** North America (Aether, Primal,
  Crystal, Dynamis), Europe (Chaos, Light), Oceania (Materia). `build.js` writes `window.BOURSE_AREA` from `live.json`
  and stops unless that gives exactly those seven. `prefs.area` is `{ <data-center name>: 1 }` (absent = all seven):
  **the keys are data-center names, letters only, never a region name** (a key with a space is dropped by every
  build's key filter). The sheet shows the seven as seven boxes and says "Choose the data centers you can travel to.
  This app does not know the game's travel rules." [Every data center of `live.json`: eight. Deriving who can travel
  where: a claim the project cannot check.]
- **D26 One request per region, joined on the device** (three by default; each region its own cache record and gate).
  Joining follows D44. A region that failed is named ("Europe not fetched"), its worlds read "not fetched", and every
  figure made without it says so.
- **D27 Budgets** (section 4, D39): the queue's pace stays; one press of "Rank these crafts" is 12 requests; 72 ranking
  requests per page visit; 180 per rolling 6 hours per device; a ranked price is fresh for 24 hours. Watch rounds: at
  most 6 requests, **default every 30 minutes, least 15, most 240**. All Bourse requests together: at most 300 per
  rolling hour per device.
- **D28 The trip is grouped by region, then data center, then world**: fewest region hops first, biggest savings first
  inside each level; another region stays only when its saving beats the threshold. Exact rules: D37, section 6.
- **D29 The sale price for profit is read over the whole travel area.** The Profit screen says once: "You can only
  sell on your home world. Sale prices here are read over your whole travel area." The opened row shows the home
  world's own middle price, cheapest listing and sales a day. `prefs.sellAt` is dropped.
- **D30 One shared alert script on every page**, `tracker/command-center/src/watch-alert.js` (new). It is tiny and
  loads the price code only when there is something to watch. The Tracker and the Atelier load it from their
  hosted-only code, so the downloaded single files never reference it. [A copy per module: six to keep in step. A
  service worker checking in the background: against CC-08.]
- **D31 The look is look v3 of `docs/bourse-look-spec.md`** (look B, approved in round five). States use the shared
  state roles and never the market purple; gold is for gil bars only. C206 measures look v3's limits.

**Round-one outside review (2026-11-25)**
- **D32 Older copies cannot write a save that holds the new rules: the save's version becomes 2 (default; owner
  question 10).** An older cached Tracker, Atelier or Command Center runs the generic merge, which, with no answer,
  takes this device's side and so deletes an edit when this device removed the unit. Section 8 gives the contract, the
  alternative (removal marks) and what the player sees. [Leaving older copies to merge: the confirmed loss. Version 2
  only once the Bourse section holds something: fewer notices, but every place that builds a save must apply the rule
  and one missed place fails open; a constant cannot be forgotten.]
- **D33 A purchase is its own record and says what it credited.** `bought` is keyed by a purchase id made at the tick;
  the record holds the owner, item, quality, units, Lists' need just before, and the units credited to Lists' stock.
  A fall in need is never read as a purchase; the page never clears a mark by itself. The mark and the stock credit
  are one write (D34) with an idempotent retry and a conditional Undo. Section 6.7. [The credit kept only in the
  Bourse section and added by Lists' planner: Lists' own counts would no longer say what the plan uses. Two writes
  with a recovery record: a later edit of the same count makes "did the credit land?" unanswerable.]
- **D34 One write for two sections: `CC.writeSections(parts, opts)`** in `save.js` (new). `parts` is a list of
  `{ name, section, known, own }`, exactly `CC.writeSection`'s arguments; all parts are checked, merged and stored in
  **one** `CC.transact`, in order, on the same stored save; any refusal or error cancels all of them (true on
  IndexedDB, device storage and memory: `transact` writes nothing when its function throws). `opts.check(doc)` runs
  inside the transaction before any part and may throw to cancel. `CC.writeSection` becomes the one-part call of the
  same inner function; its behaviour and every existing test stay unchanged. The Bourse section honours
  `known.expect` as Lists does (rule BI2: a unit that is not stored as expected refuses the write).
  [`CC.writeSection` twice: no atomicity.]
- **D35 Every reply item ends in one of four outcomes**, per place and quality: **usable**; **confirmed empty** (the
  place answered, the item's reply is well formed and not capped, and it holds no listing of that quality);
  **unknown** (the item is missing from an answered reply; the slice is capped, so the quality may sit beyond it; the
  record is an old one without quality; a needed field is missing); **failed** (no answer, an error answer, a reply
  over `maxBytes`, or a success whose shape is wrong). Only "confirmed empty" may be worded "none". After a failure
  the last good values stay, marked "last read <age>; the refresh failed". Field rules: a price and a quantity are
  whole numbers of 1 or more; `hq` must be true or false (absent: the entry is in neither quality and is counted as
  "quality not reported"); a world must be in the app's list; a time must be a positive number in B1's unit and not
  more than a minute ahead of the clock, else the age is unknown. A bad entry is dropped and counted, never repaired.
- **D36 Tax, both sides, each exactly once** (research section 4). **Buyer:** a market purchase costs the listing's
  price times quantity plus 5%, per whole listing. B1 records which form the reply uses: `total` before tax with `tax`
  beside it (then `cost = pricePerUnit × quantity + tax`), or `total` with the tax inside (then `cost = total`); where
  `tax` is absent the app adds `floor(pricePerUnit × quantity × 5 / 100)` (B1 confirms the rounding against real `tax`
  values). The 5% is applied **before** any comparison with a merchant, in whole numbers (`price × 105` against
  `merchant × 100`); a tie goes to the merchant. **Seller:** `income = sale × yield − ceil(sale × yield × ratePct /
  100)`. No Bourse figure is "before tax"; when the seller's rate could not be read the labelled 5% is used (round
  five). An entry whose fields fit neither form is dropped and counted (D35). [Adding the tax only when unclear: the
  earlier text, against the research.]
- **D37 The trip starts at the home world**, and one baseline rules every comparison. Section 6.4 to 6.6: the
  baseline, ties, the order of the three modes' rules, a place that alone has stock, unknown and capped cover, and
  hops counted from home, one way. [No start: "fewest hops" has no meaning.]
- **D38 The split has a budget and a labelled fallback.** Section 6.5. [A time limit: the same input could give two
  plans.]
- **D39 One ledger for the device**, `eveniunt-bourse-ledger` in device storage (`PRICE.ledger`, new, in `prices.js`):
  the pauses of D4, and every request charged against D27's budgets. **A charged request is every request actually
  sent to the price site by a Bourse service**: retries, the home-world read, opening requests, fallback reads and a
  failed region asked again all count, charged when sent, never refunded. A page reserves before it sends, inside the
  browser's lock `eveniunt-bourse-ledger` (Web Locks), so two pages cannot both spend the last request. **Where the
  browser has no Web Locks, or device storage is refused, nothing automatic is sent**: prices load on Refresh only,
  with the page's own count, and the screen says "This browser cannot coordinate tabs, so prices load when you press
  Refresh." [A read-then-write budget: two tabs both pass.]
- **D40 One alert round at a time, by a lock, with rechecks.** Section 7. [Write, wait, read back: a second tab can
  pass the old time and write after the first tab's read-back.]
- **D41 Home world, in this order:** (1) `prefs.home` when it names a world of the app's list; (2) the Tracker's place
  setting on this device (`eveniunt-tracker-ui` in device storage, `ui.live.world`, when it names a world of the
  list), shown as "From the Tracker's place setting" and not stored until the player picks; (3) none: "Choose your
  home world". **One home world for the whole Bourse, whatever the number of characters**; a character's or a free
  company's world is never taken as home. The sheet says: "One home world for the whole Bourse. If your characters
  live on different worlds, choose the one you shop and sell from now." (Owner question 12.) [Guessing from a
  character: the shared save holds no world per character (`CC.checkChars`).]
- **D42 "Copy name"** is in the More of every item row on Trip, Profit and Watch, and beside the item's name on Item.
  It copies the item's name exactly as the Lists data holds it; the status line says "Copied: <name>". If the browser
  refuses the clipboard, the name is shown selected in a field with "Press Ctrl+C". Check C210.
- **D43 One history window, stored and shown.** The `history` service asks for 30 days and keeps what it gets for 30
  days. The Item screen shows **7 days**; a "30 days" choice appears only when the held sales reach back further than
  7 days. The line of figures (low, middle, high, sales a day, "from N sales") and the chart are of the window shown.
  Profit always uses the 7-day window. No comparison of one week with another.
- **D44 One filter before every figure.** `MARKET.inArea(world)` (a chosen data center's world, from the app's list)
  is applied to every listing and every sale before any middle price, cheapest listing, sales a day, history line or
  alert. Sales a day = the filtered sales in the window ÷ the days the held sales span (at least 1), never the site's
  region-wide rates added up. If a reply's sales carry no world [verify], a figure for a narrowed area is labelled
  "over all of <region>, also worlds outside your travel area". An unknown age is never fresh.
- **D45 Tests say what they are.** A **guard** passes before and after by design. Every other assertion must fail
  without its change. **Every "sends nothing", "shows nothing" or "does not contain" assertion has a positive control
  in the same test and fixture** (first show the request, row or text does appear when it should).

## 3. What is fetched (host `https://universalis.app/api/v2/`)

"per region" = one request for each region of the travel area (D26), three by default.

| Service (cache `PRICE.idb`) | Used by | Request | Fresh | Fields read |
| --- | --- | --- | --- | --- |
| `deep` | Trip (per region, and the home world), Watch (per region), an opened Profit row (per region, and the home world) | `{place}/{≤100 ids}?listings=60&entries=20` | 15 min | [shipped] `items{}`, `listings[].pricePerUnit`, `.hq`, `.worldName`, `recentHistory[].pricePerUnit`, `lastUploadTime`; [verify] `listings[].quantity`, `.total`, `.tax`, `recentHistory[].hq`, `.timestamp`, `.worldName`, `.quantity`, `worldUploadTimes`, that `listings=60` caps per item, the unit of every time |
| `item` | Item, "Look deeper" on a trip row; per region | `{region}/{one id}?listings=300&entries=0` [verify the cap is accepted] | 15 min | as `deep` |
| `slim` | Profit ranking; per region | `{region}/{≤100 ids}?listings=0&entries=40` | 24 h for "Rank these crafts" | [verify] `minPriceNQ`, `minPriceHQ`, `recentHistory[].hq`, `.timestamp`, `.worldName` |
| `history` | Item; per region | [verify] `history/{region}/{id}?entriesWithin=<30 days>`: `entries[].pricePerUnit`, `.hq`, `.quantity`, `.timestamp`, `.worldName` | 1 h; kept 30 days (D43) | |
| `tax` | Profit | [verify] `tax-rates?world=<home world number>`: one rate per city; [verify] the unit of a rate (5 or 0.05) | 6 h | |

Requests per action, default area: Trip 4 per 100 items; Item 6; an opened Profit row 4; a watch round 3 per 100
watched; a press of "Rank these crafts" 12; opening Profit at most 3. Every reply is bounded by `maxBytes` (D5).

**The tax model (D36), recorded by B1:** the unit of a city rate; whether `total` holds the tax; the rounding of `tax`.
Who pays is settled by the research (both sides); the replies only show how it is recorded.

Fallbacks when B1 fails a [verify] field: `quantity` missing: escalate (no trip). `total` and `tax` missing: the 5% is
computed (D36). `worldUploadTimes` missing: a world's age is unknown, shown "last report for <region>: <age>", and
never counts as fresh (no alert). `minPriceNQ/HQ` missing: `slim` asks `listings=20` and reads them from the listings
(capped: D35). `recentHistory[].worldName` missing: D44's label. History endpoint missing: `item` asks `entries=200`.
Tax endpoint missing or its unit unclear: the labelled 5% and the empty "Where to sell this week" line, escalated. A
price's age is always the reply's own report time for that world, never our fetch time.

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
   reason. A full ranking is about 28 to 35 presses over three six-hour windows, by design.
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
  rounded); *cheapest listing* = that quality's cheapest current listing in the area, with its world. **Both are shown
  side by side on the row, each with the profit it gives**; the row is ranked by the first (the segmented choice swaps
  them). The row states its basis: "from N sales in 7 days · 1 unit priced". Fewer than 3 sales: "Too few sales to
  rank"; none: sale unknown. The opened row adds the home world's own figures.
- **Tax: D36.** `ratePct` = the lowest current city rate on the home world, or the city chosen in settings; "Where to
  sell this week" lists every city, lowest first, with "read <when>". A rate is never shown as this week's unless read.
- **Material cost, per unit:** the cheaper of (a) the cheapest gil-only merchant offer and (b) the market price over
  the area **after the buyer's 5%** (D36). (b) in the ranking is the higher of the cheapest ordinary listing and the
  middle of the material's recent ordinary sales; with no recent sale, the cheapest listing, flagged "material priced
  from one listing". (b) on the opened row is the listings walked for the recipe's amounts (section 6.1), so the
  opened cost can be higher than the ranked one; the row says "ranked on 1 unit; opened for your amounts". Gathered
  materials: market value, or 0 with "gathered: free" when the switch is on. Crystals: market. Neither (a) nor (b):
  unknown, and the craft goes to "Missing a price".
- **A crafted material that cannot be traded (D12):** crafts needed = `ceil(units needed ÷ its recipe's yield)`; cost =
  crafts × the cost of its materials (whole crafts; the spare units are not credited). An unknown part, a fifth level
  or a loop: the whole craft is "Missing a price".
- **Shown per craft:** `profit = income − cost` (may be negative); **return = profit ÷ cost, and "no cost" when the
  cost is 0** (never a computed figure); sales a day of the sale quality (D44); material cost; "can't make yet".
- **Age.** `oldDays` (default 1): marked "Old". `dropDays` (default 7): under "Price too old". The age is the oldest of
  the report times used; an unknown age counts as too old for ranking and is worded "age unknown".
- **Slow sellers** under one sale a day sink under "Sells less than once a day"; never hidden.
- **Bait.** A listing under half the middle of recent sales of its quality is marked "far below recent sales"; never
  hidden, still priced. A craft whose rank would change by more than half if a material's cheapest listing were used
  wears "a material is listed far below its recent sales".
- **Home world:** D41. None set: Profit shows "Choose your home world" and fetches nothing; the Trip works (6.6).

## 6. The trip (pure functions in `bourse/trip.js` and `bourse/needs.js`, both new)

**6.1 Buying an amount.** For one item and quality, from the listings of every allowed world **together** (after
D44's filter), each bought whole at its `cost` (D36): the set with the lowest total whose quantities reach the amount.
Up to 2,000 units this is exact (a table over the amounts). Ties: fewer listings, then fewer worlds, then the home
world, home data center, home region, then world name. The row says "buys 99, you need 5" when it overshoots.
**Above 2,000 units the result is approximate and labelled "approximate: a cheaper mix may exist"**: the cheapest of
three real purchases: (i) cheapest unit price first; (ii) the cheapest single listing that covers the whole amount;
(iii) each leading part of (i) closed by the cheapest single listing that covers the rest. Every candidate is a real
set of listings, so its total is never understated. Fewer units listed than needed: "N of M found". Wording of cover
follows D35: "Only high quality is listed" (the cheapest named, not bought); "Not among the cheapest listings of your
travel area" (capped or unknown); "Not on the market now" only when every region's reply is confirmed empty. Never 0.

**6.2 The start plan and the baseline.** Every item is priced by 6.1 over all allowed worlds together; there is no
single-world shortcut. Its total is **`C0`, the one baseline**. The threshold amount is `A = floor(C0 × within / 100)`
gil. The percentage always means percent of `C0`.

**6.3 Cover.** Per item: the units found, and each place's outcome (D35). A drop (6.4) is allowed only when every
item's found units stay the same. A region that failed is not in the plan and the plan says "made without <region>".
An item whose only listings sit behind a capped slice is "not among the cheapest 60", with "Look deeper".

**6.4 Split, `prefs.split` (default `within`, 10%).** Removing a place re-prices, by 6.1, the items bought there over
the remaining worlds; its **saving** is that plan's total minus the current total. A place that cannot be removed
without losing cover is **required**: it stays in every mode and is labelled "the only listings of N items are here".
The home world, home data center and home region are never candidates. Three passes; after each removal the savings
are worked out again.
1. **Other regions.** `fewest`: remove every region that can be removed, smallest saving first. `cheapest` and
   `within`: remove the region with the smallest saving while that saving is **at or under `A`**; a region whose
   saving is over `A` stays ("saves N gil"). So equality removes; and `cheapest` means cheapest among the regions
   kept, and says so: "Without a trip to <region>: it would save N gil, under your X% rule."
2. **Other data centers.** `cheapest`: none. `fewest`: every one that can be removed, smallest saving first.
   `within`: the smallest saving first, while the plan's total stays **at or under `C1 + A`**, where `C1` is the total
   after pass 1.
3. **Other worlds.** As pass 2.
Ties between candidates: the one with fewer items bought there, then by name. The answer reports "N gil (X%) more
than the cheapest split" (`total − C0`). The settings sheet has one threshold field and says both uses in one
sentence: "Another region must save more than this to be worth the trip; with 'Trade-off', fewer stops may cost up to
this much more."

**6.5 Budget and fallback (D38).** One evaluation = one item re-priced for one set of allowed worlds (results kept per
item and set). A plan may use `EVAL_MAX` evaluations (a named constant in `trip.js`, set by B25's measurement, start
value 20,000). When it is spent the passes stop where they are; the plan is complete and valid (every state between
removals is), and is labelled "A quick split: too many items to try every option." The planner is a step function
(`TRIP.start(input)`, `TRIP.step(state, n)`), so the page runs it in slices of at most 50 ms with "Planning the
trip…", and the result is the same whatever the slice size. Supported worst size: 600 rows, every world of the seven
data centers, 60 listings a region and item, amounts up to 2,000.

**6.6 Route and hops.** The trip **starts at the home world**, whether or not something is bought there. Order: the
home world; then the other worlds of the home data center; then the other data centers of the home region; then the
other regions; inside each level by gil saved, largest first (`prefs.route = 'items'`: by most items), a stop with an
unknown saving after the known ones, then by name. **Hops are counted from the home world, one way; the way back is
not counted**, and the screen says so once: "Hops are counted from <home>, one way." A data-center hop is each step
along the route (start included) that changes data center; a region hop each step that changes region. `saved` of a
stop = what its purchases cost on the home world (6.1 on the home world's own reply, D24) minus what they cost there.
An item the home world cannot fully supply, or whose home reply failed, has an **unknown** saving: it is left out of
the sum and counted "N items without a home price". **No home world:** the start is the region where the start plan
spends most (tie: by name), named "No home world set: the trip starts in <region>"; that region is the one never
removed; `saved` is unknown. The answer is the **total gil still to spend** (what is marked bought is not in it), with
the stops, region hops, data-center hops and gil saved beside it.

**6.7 Purchases (D33, D34).** "Bought", "Buy part" and "Bought all here" make purchase records
`{ o, i, q, n, of, cr, at }` under new ids: `of` = that owner's need in Lists just before, `cr` = units added to
Lists' "I have" (0 when `prefs.tick = 'only'`, the default, and always 0 for the trip's own items).
- **What is left.** Own items (`x`): `left = max(0, qty − Σ n)`. A character's row: with `unc = Σ (n − cr)` over its
  purchases and `last` the newest of them, the row is **settled** while Lists' need now equals `last.of − last.cr`;
  then `left = max(0, need now − unc)`. Otherwise Lists' need changed for a reason the Bourse cannot know (a list
  chosen or removed, an edit, stock used or typed, a sync): the row is **to check**, its amount left is **unknown**,
  it is left out of the total, and the answer says "N to check". It reads "Lists needed 99 when you marked 40 bought;
  it now needs 50." with two actions: "Still count them" (sets `last.of` so the row is settled) and "Remove the mark"
  (asks first; Lists' stock is not changed). The group's More has both for all rows. A row whose purchases are all
  credited never needs a check (`unc = 0`: `left` = Lists' need).
- **One write.** With `prefs.tick = 'lists'`: the page reads the save, runs `LISTS.store`'s own `bought` edit
  (`lists/store.js`, existing, `makeKeys` empty) on each owner's share, takes `cr` from the real change of the count
  (the store caps a count at 999,999; then the row says "Lists' count is at its limit: N of M added"), and sends both
  sections in one `CC.writeSections`: the Bourse part expects each new id to be absent, the Lists part expects each
  touched "I have" unit as it was read. Refused because a count changed meanwhile: read again, recompute, send again
  once with the same ids; refused again: nothing is written and the line says "Not marked: Lists changed while saving.
  Try again." Any other Lists refusal: nothing is written, the reason is shown, with "Mark without adding to Lists".
  **Retry after an unknown outcome:** read the save; an id that is stored means the write landed (stop); else send
  again with the same ids. So a retry can never credit twice.
- **Undo (status line, and "Undo purchase" in the row's More).** One `CC.writeSections`: the purchase records removed
  (expected as stored) and `cr` taken from each count, **only if every count now holds at least its `cr`**. An
  unrelated change of the count that leaves enough is fine (10, +40, then 45 typed: Undo leaves 5). Otherwise nothing
  changes: "Not undone: Lists now counts 20 of <item>, fewer than the 40 this purchase added. Change the count in
  Lists, or remove the mark only." "Remove the mark only" never touches Lists.
- **"New trip"** (More of the Bought group, error role, asks first: "Clear N purchases and M items you added? Lists'
  counts are not changed.") removes every purchase and own item. Nothing else removes them; a removal changed
  elsewhere is kept and asked (D20). The Bought group shows each purchase with its amount, date and "added to Lists".

**6.8 The trip's own items and the one-time copy (D10).** `extra` holds items added by "Add to trip" or the copy;
removed only by the player ("Remove from trip", asks first) or "New trip".
The copy: the new Tracker, which alone can turn its entry keys into item numbers, writes on loading
`ui.live.mcopy = { v: 1, at, items: { <item id>: <amount> }, skipped }` into its own device record
(`eveniunt-tracker-ui`; `persist()` already stores `ui.live` whole), beside the untouched `mlist` and `mqty`. An
amount that is missing or not a number of 1 or more counts 1 (what the Tracker showed); two entries of one item are
added; an entry without an item number, unknown to the index or untradable is skipped and counted. The Bourse page, on
opening, reads that record (same site address only: the downloaded file has its own storage and is never read), and
if it holds items sends **one** `CC.writeSections` whose `check` cancels when `doc.device.bourse.mcopy` is already set
(another tab, an earlier visit), whose Bourse part adds each item to `extra` (the larger amount when one exists; over
99,999 becomes 99,999 and is counted) and whose `own.device` sets `mcopy: { at, copied, skipped, capped }` in the
save's device-only part. Copy and receipt therefore land together or not at all. The line says once: "Copied N items
from the Tracker's shopping list. M could not be matched; K amounts were over the limit and set to 99,999. The old
list is still in the Tracker's storage." No `mcopy` yet (the new Tracker has not run on this device): nothing is
copied or recorded, and the next opening tries again.

**Said once (W2):** "You can buy on another world, data center or region you travel to, but you cannot sell there.
Whether you can travel is the game's rule; your travel area is set in Bourse settings. Travel stops 30 minutes before
maintenance. This is a plan from reported listings, not a promise that the route is open or the stock still there."
An all-worlds maintenance starting within 2 hours, or running, becomes the note block (D17).
The module opens on Trip when a chosen list has market items or the trip has its own; otherwise on Item.

## 7. Watch list and alerts (on every page)

A watched item is an item, a quality and a target price. On the Watch view, on opening and on Refresh, the `deep`
service prices the list over the travel area; rows fall under "Below target", "Above target", "No price". An item is
**under** when the cheapest listing of its quality in the area (after D36's 5%) is at or under the target **and that
world's own report is no older than `oldDays`**. An older or unknown age reads "Under, but the price is old" or
"Under, age unknown" and never rings.

**The shared checker** (`watch-alert.js`), loaded by Home and Settings, Submersibles, Lists, the Bourse, and the hosted
Tracker and Atelier:
- **Does nothing, and loads nothing more, when** the watch list is empty, `prefs.alerts` is off, the page is hidden,
  the device is offline, a pause is running, or the browser has no Web Locks (D39; the Watch view then says
  "Automatic checks are off in this browser. Refresh checks now."). It reads the save and never writes it. Only when
  there is something to check does it add `prices.js`, `bourse/data.js` and `bourse/services.js`.
- **One round at a time (D40).** The whole round runs inside the browser lock `eveniunt-bourse-watch`, asked for with
  "only if free". Inside the lock the page reads `eveniunt-bourse-alert` (`{ at }`); if it is younger than
  `prefs.alertMin` minutes (default 30) it leaves; else it writes the new time and runs. A round ends after 60 seconds
  at most. A tab that closes frees the lock.
- **A round** asks `deep` once per region for the watched items (at most 6 requests; the page limit is 200 watched),
  through the queue, the gate and the ledger. Results go into the shared cache.
- **Rechecks.** Before loading the price code, before each request and before showing an alert: the page is visible
  and online, alerts are on, no pause runs, and the item is still watched with the same quality and target. A page
  hidden mid-round sends nothing more; answers that still arrive are stored but show no alert. A result from a round
  that is no longer the current one is discarded.
- **An alert** is one slim status line on the page that ran the round: "<item> is under your target on <world>: N gil,
  seen <age>. Open" (to `bourse/#item=<id>`), with "Close". **Ring once per crossing:** the device record keeps
  `alerted["<item>.<quality>"] = { target }` (written inside the lock). It rings only when the item is under and no
  such entry exists for that target. The entry is cleared **only by a usable, fresh result above the target for the
  same item and quality**; a failed, unknown or old result, or a different cheapest world, changes nothing. A changed
  target is a new crossing. On a phone the name wraps; the world, price and age are never cut.
- **A page works without it.** If the script or the price code fails to load, nothing else changes.
- The Watch view and the sheet say: "Alerts ring only while this app is open in a tab. While it is open, it checks your
  watched items every N minutes, on any page. Turn this off under Alerts." No notification permission is asked.

## 8. The save: section `modules.bourse`, and version 2

```
{ v: 1,
  watch:  { "<item id>.<nq|hq>": { target, at } },
  extra:  { "<item id>.<nq|hq>": { qty, at } },                the trip's own items
  bought: { "<purchase id>":     { o, i, q, n, of, cr, at } },  o: c1..c8, u, or x (own item); q: nq|hq
  prefs:  { area: { <data-center name>: 1 }, home, oldDays, dropDays, split, within, route, tick, gatherFree, taxCity,
            rankBy, alerts, alertMin, lists: { <list id>: 1 } } }
```

- **Checker `CC.checkBourse`**, added to `CHECK`: always the whole frame in that key order; no arrays; no size limit;
  an entry is dropped only when malformed (bad key; no `target`; no `qty`; a purchase without `o`, `i`, `q` or `n`); a
  bad field is left out, never repaired. A purchase id is 8 to 16 of `a-z0-9`. Ranges: `target` 1 to 999,999,999;
  `qty` 1 to 99,999; `n` 1 to 999,999; `of` 0 to 999,999; `cr` 0 to `n`; `oldDays` 1 to 30; `dropDays` 1 to 90;
  `within` 0 to 100; `alertMin` 15 to 240; `split` `fewest|cheapest|within`; `route` `savings|items`; `tick`
  `only|lists`; `rankBy` `sales|listing`; `area` keys 1 to 32 letters (`A-Za-z` only) with the value 1 (the page
  ignores a name that is not one of the seven); texts up to 40 characters. A default is not stored. Page limits (edit
  functions only): 200 watched, 500 own items, 2,000 purchases ("Start a new trip to mark more").
  `LABEL.bourse = 'Bourse'`; `describeUnit` words: "Bourse: watched item <name> (target N gil)", "Bourse: an item
  added to the trip (<name>, N)", "Bourse: a purchase of <name> (N)", "Bourse setting: <plain name>".
- **Merge, in pages that run the new code.** Units are two levels down: one watched item, one own item, one purchase,
  one setting. Changed on one side: taken. Changed differently on both: asked. **BY0** (`merge.js`; it runs whether or
  not the save holds lists): removed on one side and changed on the other: kept, asked until answered, removed only by
  the removing side's answer (`integrity.kind` `bourse`, `keep`); `ET.applyMerge` with no choice keeps it, and that is
  the call `ET.saveMerge` and the unasked sync merges make. **BI1** (`CC.writeSection`): a unit the page removed that
  the stored copy holds with another value is refused: "This was changed on another device or in another tab, so it
  was not removed." **BI2:** `known.expect` (D34).
- **Older copies: the mixed-version contract (D32).** Read in the code: with no choice, `ET.applyMerge` takes this
  device's side of a clash (`merge.js` line 279), and a removal on this device against an edit elsewhere is such a
  clash (lines 99 to 100); the Tracker's ordinary save (`ET.saveMerge`, `storage.js` line 111) and the unasked sync
  merges pass no choices. A copy without BY0 therefore deletes the edit. Two designs; **A is this spec's default**:
  - **A. Fail closed (default).** `CC.VERSION` becomes 2. New code reads version 1 and 2 and always writes 2; the cloud
    copy carries it (`cloud.js` writes `CC.VERSION` inside). Nothing else in the save changes; every field stays
    readable. An older copy already refuses a newer save, in shipped code: `CC.checkDoc` throws ("This save was
    written by a newer version of the app. Reload the page to update."); `CC.writeSection` and the Tracker's save
    (`storage.js` line 269) write nothing over it; Lists and Submersibles show that sentence and stop; a sync refuses
    with "The cloud copy was saved by a newer version of the app. Reload this page to update, then sync again."
    **What the player sees:** a page of the app still running the earlier version (a tab left open, or a copy the
    browser kept) cannot save or sync once any updated page has saved; it shows the sentence above. **How they
    recover:** reload that page while online (B0 reports whether one reload is enough for each app's cached copy);
    what was changed in the old page after its notice appeared was not saved and is done again. A device that has only
    old copies and never updated keeps working by itself; only its sync waits for the update. Old copies never merge a
    version 2 save, so they cannot lose a Bourse edit.
  - **B. Removal marks (the alternative).** Such an encoding exists, at a price. Because the old merge always takes
    this device's side of a clash, the only safe form is one where a removal and an edit are never the same unit: a
    removal deletes nothing and instead adds `gone: { "<group>.<key>": { of: <the unit's `at`> } }`; a unit is hidden
    while its `at` equals the mark's `of`; an edit stamps a new `at`, so the edit shows again (the edit wins, without
    a question). An old merge then sees two different units and keeps both. Costs: every reader filters hidden units;
    a setting can never be removed (a reset stores the default); removed entries stay in the save until a clean-up
    deletes pairs older than 90 days, and that clean-up is a real removal, so the same loss is possible there for an
    edit made on a device that was away longer; an edit against an edit still takes this device's side in an old copy
    (today's rule for every section). Under B the version stays 1 and BY0 is not needed for removals.
  - **Tests, both designs, with no choice given, both orientations (this device removed and the other edited; this
    device edited and the other removed), through the real paths** (item B24): the local save path (`ET.saveState`
    and `ET.saveMerge` with a real `CC.transact`) and the cloud path (the Tracker's real sync routine against a
    stand-in cloud), each run with new code on both sides and with the files at `<base>` as the older side.
- **On the device only:** every price, sale, tax rate and attempt time (`eveniunt-bourse-prices`), the ledger
  (`eveniunt-bourse-ledger`), `eveniunt-bourse-device` (last view, which alerts rang), `eveniunt-bourse-alert`, and in
  the save's device-only part `device.bourse.mcopy` (the copy's receipt; never in backups, codes or the cloud).
- **Rebuild:** `save.js`, `merge.js`, `one-look.css`, the header's page list, `live.js` and the hosted-only code of the
  Tracker and the Atelier change, so the Tracker (`tracker/dist`, `tracker/site`), the Command Center
  (`tracker/command-center/site`) and the Atelier (`crafting/atelier/dist`, `site`) are all rebuilt and committed.

## 9. Screens

As **look v3 of `docs/bourse-look-spec.md`** and its pictures (approved, round five), including the states page, plus
D22 and D31. Fixed here: the header word is "Bourse", between Lists and Settings in the page list
(`tracker/tools/one-look-header.js` `MODS`), tool slot "Bourse settings" and, on Item, "Find an item"; Home gains a
card (live line "N watched" or "Nothing watched yet"); an age is written "14 min", "3 h", "2 days"; the Item screen's
answer is the price of one unit when buying the amount needed, labelled "each, for N", with the world; the Trip's
answer is the total still to spend. On a phone the quality switch (Item) and the ranking switch (Profit) are reachable
in the settings sheet or the head's More. Fixed sentences (owner question 5, still open): foot "Prices are community
reports collected by Universalis from players' game clients. Each one says where and when it was seen and can be gone
when you arrive. This app reads nothing from the game."; Profit "An estimate from reported prices, after market tax.
Not a promise." and the sentence of D29; the travel sentence of section 6; the alert sentence of section 7. "Solve"
appears only for a recipe not in `LISTS_DATA.noHandOver` and links `../atelier/#recipe=<id>` (CC-09).
**States this round adds, to be drawn by the look's owner before B11** (existing parts only: the unknown role, a sub
line, More): a row "to check" and its count in the answer; "made without <region>"; "approximate"; "A quick split";
"the only listings of N items are here"; "N items without a home price"; the no-Web-Locks line; the copy's line.

## 10. Work items

**Order of running, after the gates of the ledger's "Order":** B0, B1, B2, B18, B3, B23, B24, B4, B5, B16, B17, B13,
B6, B19, B20, B7, B21, B25, B14, B8, B9, B15, B10, B22, B11, B12. (B13 to B15 were added earlier; B16 to B25 by round
one, by splitting B2, B3, B5, B6, B7 and B10. Numbers are stable.)

**Every builder item:** branch `bourse`; only the named files and rebuilt copies; `npm run build` twice, the second
exits 0 and `git status --porcelain` is empty after the commit; `npm run test:unit`; never merge. **Paths:** `src/`
means `tracker/command-center/src/`; a file marked (new) does not exist at `<base>`; every other named file does.
**Tests (D45):** each new assertion is seen failing without its change (a temporary revert, reported), except the
named **guards**, reported as "guard, passed before and after": PR-1 to PR-5, PX-7, BV-1 to BV-3 and BV-7 (the older
copy's refusal), the second half of every paired check. Every negative assertion names its positive control. Browser
checks answer `universalis.app` with a stand-in that counts requests per region, and route `lists/data.js` to
`tracker/tests/fixtures/lists-fixture.json` unless "real data". `<base>` is the commit B0 pins. New check ids start at
C197.

- **B0 Baseline and facts (Haiku clerk).** No edits. Run the three suites. Report, each with file and line: results;
  the highest check id (expected C196); `<base>` and whether the one-look rules and every module move are in it; every
  line of `check.js` and the tests that counts nav links, modules or Home cards; every test and check that reads the
  Tracker's Market Board, `mlist`, `mbadd` or a `universalis` request from the Tracker; how Lists unpacks
  `LISTS_DATA_PACKED`; the data centers with worlds in `live.json`, by region; where the Tracker's and the Atelier's
  hosted-only code adds the Main menu, and any content policy or service-worker rule that would refuse a script from
  the Command Center's folder or a request to `universalis.app`; whether `checks.yml` uses `fetch-depth: 0`. **For
  D32:** at `<base>`, the exact words each page (Tracker, Atelier, Home and Settings, Lists, Submersibles) shows when
  the stored save has `v: 2`, on opening and on its next save; whether the Tracker's sync routine can upload after its
  read of the cloud copy was refused; whether loading a backup or a transfer code merges without asking; how each
  app's cached copy updates (how many reloads). **For D33/D34:** whether `lists/store.js` loads on a page without the
  Lists page, and what its `bought` returns (the section, the capped flag). Whether the look spec's states page holds
  section 9's added states. Accept: each answer with file and line. Escalate if: a suite fails; a gate is not in
  `<base>`; an old copy can write or upload over a version 2 save; `store.js` cannot run outside the Lists page.
- **B1 Saved replies (Sonnet builder).** Files (all new): `tracker/tests/fixtures/universalis/{region-two-items,
  region-europe-two-items,region-oceania-two-items,region-batch,world-one-item,world-batch,slim-two-items,
  history-one-item,item-all-listings,capped-item,tax-rates,unknown-item,unknown-place,hq-filter}.json` and `README.md`
  (for each: the exact path, date, status code, the reply headers that speak of limits or waiting, the size before
  trimming; trimmed to 5 listings and 10 sales per item except `capped-item`, kept at its 60; names of retainers,
  buyers and creators removed), `tracker/tests/bourse-replies.test.js` (BR-1 to BR-6 every field of section 3 with its
  type, normal and high quality; BR-7 the tax model: the rate's unit, which form `total` takes, the rounding of `tax`;
  BR-8 the three regions' real request names, unknown item against unknown place; BR-9 a world on every listing and
  sale, the time units, `worldUploadTimes`; BR-10 `listings=60` caps per item and `listings=300` is accepted),
  `tracker/data/SOURCES.md` (one line), `package.json`. No load test: each path is asked once. Accept: the test
  passes; a table "field, found or missing, fallback taken"; the measured sizes. Escalate if: the host cannot be
  reached (the orchestrator asks the owner to save the replies from a browser), `quantity` is missing, or the tax
  arithmetic fits neither form.
- **B2 Price service: queue, options, readers (Sonnet builder; after B1).** Files: `src/prices.js`,
  `tracker/tests/prices.test.js` (PR-1 to PR-5 **unedited**; PX-1 queue: 30 calls, never over 2 in flight, 300 ms
  apart, 40 waiting; PX-2 pauses, with D4's lift rules; PX-3 `PRICE.idb`: two places and two services apart, **two
  writers of one record each keep the other's items**; PX-4 `readDeep` on the fixtures: per world and quality,
  cheapest first, `cost` by D36, world and time on every sale, no names kept; PX-5 `readSlim`; PX-6 `maxRequests`;
  PX-7 defaults give today's URL and limits; PX-8 `placePath` and `strict404`; **PX-9 outcomes (D35): "malformed
  success" (status 200, wrong shape) is failed, records no "none", keeps the last good value as stale; "capped
  high-quality-only slice" (60 listings, all high quality) gives ordinary = unknown, never "none"; an entry without
  `hq`, a price of 0, a fraction, an unknown world are dropped and counted; an old four-part record is unknown;
  PX-10 a reply over `maxBytes` is failed and stores nothing; PX-11 times: old, missing, in the future, and mixed
  sources each give the stated age or "unknown"**). Accept: unit suite; `CHECK_ONLY=C113,C117,C155 npm run check`
  unchanged. Must not change: any record or URL of Submersibles or Lists. Escalate if: PR-1 to PR-5 need an edit.
- **B3 Save section and version (Sonnet builder; after B0).** Files: `tracker/src/core/save.js` (`checkBourse`,
  `CHECK`, `LABEL`, the labels, BI1, BI2, `CC.VERSION = 2` with `checkDoc` reading 1 and 2), `tracker/tests/core.test.js`
  (BS-1 checker table: every range and enum, purchase ids, `area` keys with a space or a digit dropped, the whole
  frame; BS-2 round trip through `unflatModules`; BS-3 new code reads a version 1 save unchanged and writes version 2;
  BS-4 BI1 refused, store unchanged, with a control where the unit was not changed elsewhere and is removed; BS-5 two
  tabs on different watched items both kept; BS-6 BI2; BY-4 the labels word for word), rebuilt copies. Accept: unit
  suite; `CHECK_ONLY=C119,C122,C145,C146 npm run check`. Must not change: any rule or test of another section.
  Escalate if: an existing test needs an edit other than an expected version number, or the owner chose option B or
  "keep" for question 10 (then `CC.VERSION` stays 1 and this item is re-specified).
- **B4 Shared look (Haiku clerk).** Files: `tracker/src/app/one-look.css` (`.ol-r-gil`, copied from `bm-r-gil` in
  `docs/bourse/mock/bourse-mock.css`), `tracker/command-center/one-look-fixture.html` (one gil block),
  `tracker/tests/one-look.test.js` (the role exists; ink on `--gil-m` reaches 4.5:1 in light and dark; `bourse.css`
  joins the sheets the drift test reads and must not contain `--gil-m` or `ol-r-market`, with a control sheet that
  does and fails), rebuilt copies. Accept: the test fails before, passes after; `CHECK_ONLY=C196 npm run check`.
  Escalate if: the contrast fails, another role's computed value changes, or look v3 needs a shared part that is
  missing.
- **B5 Price math (Sonnet builder; after B2).** Files: `src/bourse/market.js` (new), `tracker/tests/fixtures/
  bourse-fixture.json` (new), `tracker/tests/bourse-market.test.js` (new: BM-1 median, even and odd, 7 days, none is
  unknown, joined over three regions; BM-2 profit by hand for three crafts, both sale bases; BM-3 unknown material or
  sale is never 0 and never ranked; BM-4 gathered at market and free; crystals; an untradable crafted material with a
  yield of 3 and a need of 4 costs two crafts; an unknown part, a fifth level and a loop are "Missing a price";
  **BM-5 tax (D36): both `total` forms give the same cost; "merchant crossover": market 650 against merchant 670, the
  market wins before tax and the merchant after; "rounding tie": `price × 105 = merchant × 100` goes to the merchant;
  the seller's rounding; lowest and chosen city; the labelled 5%**; BM-6 old, too old, unknown age; slow sellers;
  bait; **"no cost": a craft of free gathered materials shows "no cost", no number; "thin data": one cheap unit
  listed, five needed: the opened cost is above the ranked one and the row says so; fewer than 3 sales is not
  ranked**; BM-14 D44: a narrowed area leaves its worlds out of the median, sales a day and history; a failed region
  is named; an unknown world is left out and counted; sales without a world give the label), `package.json`. Accept:
  unit suite. Escalate if: a rule cannot hold as written.
- **B6 Page shell (Sonnet builder; after B13).** Files (new): `src/bourse/{index.html,bourse.css,bourse.js}`;
  `build.js` (copy the page's files only). Steps: the header, the views' tab bar, the settings sheet (the seven data
  centers, home world by D41, one threshold field), empty states, the status line, reading the Lists data (packed or
  plain), saving through `store.js` one write at a time. Accept: unit suite; `npm run test:browser`; check C213 (the
  built page opens offline with an empty save and shows the empty trip; home world from each of D41's three sources).
  Escalate if: look v3 lacks a part the shell needs.
- **B7 Trip view (Sonnet builder; after B20).** Files: `src/bourse/bourse.js`, `bourse.css`, `check.js` C202 (stand-in
  replies for three regions: the three modes give the hand-worked stops and totals; a region removed at the
  threshold and kept one gil over; a required region labelled; the route starts at the home world and the three
  counts match BP-9; no home world; the answer is the total still to spend; overshoot wording; the home world asked
  for and never shown empty from a region reply alone; "made without <region>"; "Only high quality is listed"; a
  joined row for two characters; the travel sentence and the maintenance note with its date; **4 requests per 100
  items counted first, then a reopen within 15 minutes sends none**). Accept: `CHECK_ONLY=C202 npm run check`.
  Escalate if: a state of section 9 is not in the look.
- **B8 Profit (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C200 (opening sends 1 to 3
  requests; one press at most 12; never over 2 in flight; **then** a reload within 15 minutes sends none; the budget
  disables the main action with its sentence; a 429 pauses and says so; offline failures leave no pause), C201 (the
  fixture's figures equal BM-2; both sale bases on the row; the sentence of D29 once; the opened row's home figures;
  "of N ranked"; the five closed groups; no row shows 0 for an unknown; "no cost"; a negative profit; the bait flag;
  "Solve" present for one recipe and absent for a no-hand-over one; the tax list, and the labelled 5%). Accept:
  `CHECK_ONLY=C200,C201 npm run check`. Escalate if: a pass over real data draws slower than 1 second.
- **B9 Watch (Sonnet builder; after B7).** Files: `bourse.js`, `check.js` C203 (three groups; "Under, but the price is
  old"; "Under, age unknown"; the alert sentence; adding, changing, removing; the no-Web-Locks line; at 360 px the
  longest name wraps and the age is whole), and C210 ("Copy name" on all four views). Accept: `CHECK_ONLY=C203,C210 npm run check`. Escalate if: the view needs B15.
- **B10 The Tracker's link and the copy (Sonnet builder; after B6).** Files: `tracker/src/app/live.js` (D9; `mcopy`
  by 6.8), the tests B0 listed (those pinning the Tracker's requests become tests of the link and of `mcopy`),
  `src/bourse/bourse.js` (the copy on opening), `tracker/tests/bourse-copy.test.js` (new: BC-1 `mcopy` from a list
  with a duplicate item, an unmapped entry, an untradable one, amounts 0, missing and 1,000,000), `check.js` C204
  (**control: at `<base>` the Tracker does ask the price host under this fixture; now it asks nothing**; the link
  opens the Bourse; `mlist` and `mqty` byte-identical; the copy reaches the save once with its counts in the line;
  "crash": the write is made to fail, nothing is copied and no receipt exists, the next opening copies; "two tabs":
  one copy; "late": the Bourse opened before the Tracker copies nothing and records nothing, then copies after the
  Tracker ran; the downloaded file shows the moved line and no price), rebuilt copies. Accept: `npm run test:browser`;
  `CHECK_ONLY=C204 npm run check`. Escalate if: the hosted Tracker and the Bourse do not share device storage.
- **B11 Look checks and pictures (Sonnet builder; after B7 to B9, B14, B15, B21).** Files: `check.js` C206 (the limits
  of look v3 and the design rules on Trip, Item, Profit, Watch, the sheet, the empty trip and every state of the
  states page, at 1,440 x 1,000 and 360 x 800, real data with stand-in prices, the three longest item names, five-digit
  counts, gil in the millions. **Rows are counted only when wholly inside the area left by the fixed header, the
  bottom bar, the seal bar, the status line and a shown alert**; the counts must meet the numbers the look spec
  records (its recorded, owner-approved shortfalls included) and the measured figures are written to the evidence. It
  also measures: an opened row; the last action of a screen reachable above the fixed bars; no figure or name cut;
  the same at 200% text size; where the first row starts (P3, with the owner's phone exception); one primary and at
  most primary, More and one stepper per row; no data-face text without a digit; no age as "14M"; no configuring field
  at rest but "Find an item"; the status and alert line's form with Close and the age; 40 px targets; no sideways
  scroll; every computed colour a tone of a role, never the market role, gold on gil bars only), C196 (the Bourse page
  joins), evidence `bourse-*.png` in `docs/bourse/build/` with `notes.md`. Accept: `CHECK_ONLY=C196,C206 npm run
  check`; three planted faults each fail C206 (a third bordered button; a row pushed under the bottom bar; a name
  cut), reverted and reported. Escalate if: a limit cannot be met without changing the look.
- **B12 Full run and records (Haiku clerk; last).** `npm run build` twice, the three suites, `npm run check`; the
  entry in `docs/STATE.md` under "Built, waiting for the owner's `ship`": what was and was not tested (the live price
  site, Firefox, Safari, a real phone, a real two-device sync), what now runs while the app is open (the watch checker
  on every page) and how to stop it (Alerts, in Bourse settings), the save's new version and what an old tab shows,
  and a pointer to the five owner rounds and both review rounds. Accept: git clean; counts reported. Escalate if: any
  failure.
- **B13 The store (Sonnet builder; after B3, B23, B17).** Files (new): `src/bourse/store.js` (pure edit functions:
  watch, own items, settings and the area, purchases by D33 (make, "still count", remove, Undo's two sections, "New
  trip"), the copy's edit), `tracker/tests/bourse-store.test.js` (BT-1 every edit and its limit, a default not
  stored; BT-2 the copy's edit: the larger amount kept, the cap counted; BT-4 "New trip"; BT-5 a tick shared across
  characters makes one record per owner; BT-6 the area: all seven is not stored, a narrowed one is, the last cannot be
  unticked; BT-7 nothing in the store removes a purchase or an own item except the four named edits), `package.json`.
  Accept: unit suite. Escalate if: an edit needs a field the checker does not hold.
- **B14 Item (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C199 (every price names its
  world and age; every world of the area, by region and data center; the answer "each, for N"; listings and sales
  apart; a world missing from a capped reply reads "not among…", and "none" only in a fixture whose reply is
  complete and empty; a failed region "not fetched"; qualities never mix; ages in words; the screen before a search;
  history by D43: 7 days, the "30 days" choice only when older sales are held, a narrowed area changes the figures;
  6 requests counted). Accept: `CHECK_ONLY=C199 npm run check`. Escalate if: the history fallback leaves fewer than 7
  days.
- **B15 Alerts on every page (Sonnet builder; after B9).** Files: `src/watch-alert.js` (new), `build.js`, one script
  line in `src/{index,submersibles/index,lists/index,bourse/index}.html`, the hosted-only code of
  `tracker/src/app/ui.js` and `crafting/atelier/src/atelier.js` at the places B0 reported,
  `tracker/tests/bourse-alert.test.js` (new: BA-1 the lock: two pages asking together run one round; a time younger
  than the interval runs none; no Web Locks runs none; BA-2 nothing loaded or sent with an empty list, alerts off,
  hidden, offline or paused, **each after a control round that does send**; BA-3 one ring per crossing, shared; BA-4
  no ring for an old or unknown age; BA-5 a round is at most 6 requests; **BA-6 "hidden mid-round": no further
  request and no alert; BA-7 re-arm: a failed, unknown or old result does not re-arm, a fresh above-target result
  does, another cheapest world does not ring again, a changed target does; BA-8 a target changed mid-round shows no
  alert for the old one**), `package.json`, `check.js` C207 (on each of the seven pages a watched item under its
  target raises one alert line with Close and the age, and its link opens the Item view; two tabs send one round;
  then the negatives; with the script refused each page still passes its opening check; the downloaded files do not
  contain the script's name while the hosted ones do), rebuilt copies. Accept: unit suite; `npm run test:browser`;
  `CHECK_ONLY=C9,C196,C203,C207 npm run check`. Escalate if: a page's policy refuses the script or the price host.
- **B16 Trip math (Sonnet builder; after B5).** Files (new): `src/bourse/trip.js`, `tracker/tests/bourse-trip.test.js`
  (BP-1 buying an amount: whole listings, overshoot, too few, only high quality, none; **BP-2 "ten units, cheap
  split": one world sells all 10 at 100 each (1,000), two others sell 4 at 20 and 6 at 30: the start plan costs 260
  plus tax, never 1,000; BP-3 "2,001 units": 2,000 at 1 then 10,000 at 2 (22,000) against one stack of 2,001 at 3:
  the plan costs 6,003 plus tax and is labelled approximate**; BP-4 ties of 6.1; BP-5 the three modes on a hand-worked
  table; **BP-6 the threshold edge in every mode: a region saving exactly `A` is removed, `A + 1` kept (`cheapest`,
  `within`), removed in `fewest`; a total of exactly `C1 + A` allows the removal, one gil more does not; BP-7 "sole
  supply": a region that alone lists an item stays in every mode, labelled; BP-8 cover: a failed region, a capped
  slice and a confirmed empty reply give three different outcomes and a removal never lowers the units found**; BP-9
  route order and hops from the home world: a trip to another data center of the home region is one data-center hop
  and no region hop; no home world; an unknown saving sorts last and is left out of the sum; BP-10 the budget: with
  `EVAL_MAX` set to 10 the plan is complete, valid and labelled, and identical whether stepped by 1 or by 1,000),
  `package.json`. Accept: unit suite. Escalate if: a rule of section 6 gives two answers for one input.
- **B17 Needs and what is left (Sonnet builder; after B5).** Files: `src/lists/engine.js` (`LISTS.sumShares` moved in
  unchanged, `LISTS.marketNeeds`), `src/lists/lists.js` (calls the engine's `sumShares`; nothing else),
  `src/bourse/needs.js` (new), `tracker/tests/bourse-needs.test.js` (new: BN-1 `sumShares` gives the same result as
  before for all steps and for one step; BN-2 `marketNeeds` equals it for the fixture's lists; BN-3 settled: 40 of 99
  marked leaves 59, with and without a credit; BN-4 **"a fall in need is not a purchase"**: the need falls from 99 to
  59 with a mark of 40: the row is to check, its amount unknown, not 19 and not 59; BN-5 **"changed list
  selection"**: a list unchosen and chosen again leaves every purchase stored, and the rows to check or settled as
  the need says; BN-6 "still count" settles; BN-7 two characters make one row; BN-8 a mark of 99 of 99, the need back
  at 50: to check, never silently 0). Accept: unit suite; `lists-engine` and `lists-model` tests unedited;
  `CHECK_ONLY=C150,C155 npm run check` unchanged. Escalate if: moving `sumShares` changes a Lists check.
- **B18 The ledger (Sonnet builder; after B2).** Files: `src/prices.js` (`PRICE.ledger`, the queue's use of it),
  `tracker/tests/bourse-ledger.test.js` (new, fake clock, fake storage and fake locks: BL-1 two pages reserving
  together never pass a budget; BL-2 retries, the home-world read, opening requests and a failed region asked again
  are charged; BL-3 a forced refresh is charged, ignores the gate and does not pass a rate-limit pause; BL-4 a
  rate-limit pause written by one page stops a second page and a second service, and holds for `Retry-After`; BL-5
  the ranking order and the budgets 12, 72, 180 and 300; a batch with one region failed is not priced; BL-6 storage
  refused or no Web Locks: nothing automatic, Refresh works; BL-7 an oversized reply is charged), `package.json`.
  Accept: unit suite; `CHECK_ONLY=C113,C117,C155 npm run check` unchanged. Escalate if: Lists or Submersibles change
  behaviour with no pause running.
- **B19 Build and routing (Sonnet builder; after B6).** Files: `tracker/command-center/build.js` (`bourse/data.js`
  from `live.json` and `timers.json` with `BOURSE_AREA` and the timer list's date; stops unless the area is D25's
  seven), `tracker/tools/one-look-header.js` (`MODS`), `src/index.html` (card), `src/shell.js` (module list, live
  line), the count lines B0 listed (like for like, named in the pull request), rebuilt copies. Accept: unit suite;
  `npm run test:browser`; C196's page count (a membership assertion: the Bourse is one of the pages). Escalate if: a
  check reads a count B0 missed.
- **B20 Services and the offline cache (Sonnet builder; after B19, B18).** Files: `src/bourse/services.js` (new: the
  five services of section 3 and the per-region joining, the one definition), `src/sw.js` (`PAGES`),
  `tracker/tests/bourse-services.test.js` (new: BX-1 each service's real path equals B1's; BX-2 three regions joined
  by D44; BX-3 a partial failure names the region), `check.js` C214 (after one online visit the page, its sheet and
  its data open offline; with a watch list the alert script's files are cached too; two pages open together share
  the pause and the budget). Accept: unit suite; `CHECK_ONLY=C9,C214 npm run check`. Escalate if: the service worker
  refuses the price host.
- **B21 Ticks, the Lists credit and Undo (Sonnet builder; after B7).** Files: `bourse.js`, `check.js` C208 (tick only
  leaves `modules.lists` byte-identical, with the control that "also add" changes it; "also add" raises each
  character's count in the same write; **"fault between the two": the Lists part is made to refuse and no purchase is
  stored; the same on device storage without IndexedDB; "retry": the same ids sent twice credit once; "stale tab": a
  Bourse tab and a Lists tab each with an old copy both save and nothing is lost or doubled; "stock cap": a count at
  999,990 plus 40 records `cr` 9 and says so; "Undo after an unrelated edit": enough left, Undo takes exactly `cr`;
  too little left, nothing changes and the sentence shows; a row to check with both actions; "New trip" after its
  confirm leaves Lists' counts**). Accept: `CHECK_ONLY=C208 npm run check`. Escalate if: a case needs a rule section
  6.7 does not give.
- **B22 Lists' high-quality prices (Sonnet builder; after B2).** Files: `src/lists/lists.js` (D8), `check.js` C191
  rewritten as C205 (an ordinary 100 and a high-quality 10,000 each on their own row and both in the subtotal; **an
  old four-part record whose cheapest listing was high quality shows "not fetched yet" on both rows, is not in the
  subtotal, and is asked again**), rebuilt copies. Accept: `CHECK_ONLY=C155,C205 npm run check`. Escalate if: C155
  changes.
- **B23 One write for two sections (Sonnet builder; after B3).** Files: `tracker/src/core/save.js`
  (`CC.writeSections`; `CC.writeSection` calls the same inner function), `tracker/tests/core.test.js` (BW-1 every
  existing `writeSection` test passes unedited; BW-2 two sections land in one stored revision; BW-3 a refusal in the
  second part (a Lists rule, an `expect`) leaves the first unwritten, on IndexedDB, device storage and memory; BW-4
  `check` cancels all; BW-5 `own.device` is written with the parts or not at all; BW-6 each part still merges and
  applies its own rules against a stale copy), rebuilt copies. Accept: unit suite; `CHECK_ONLY=C119,C122,C145,C146 npm
  run check` unchanged. Escalate if: any existing test of `writeSection` needs an edit.
- **B24 The merge rule and older copies (Sonnet builder; after B3).** Files: `tracker/src/core/merge.js` (BY0 and its
  `applyMerge` branch), `tracker/tests/core.test.js` (BY-1 two devices: both add, one changes, both change; BY-2 BY0
  asked until answered, each answer), `tracker/tests/bourse-versions.test.js` (new; "older" = the files at `<base>`,
  read by `git show`; **BV-1 local path, this device removed: an older Tracker's real save against a version 2 save
  writes nothing, bytes identical, the edit still stored; control: against a version 1 save it writes. BV-2 the
  same, the other side removed. BV-3 cloud path: the older sync routine against a version 2 cloud copy refuses and
  uploads nothing, both orientations; control with a version 1 copy. BV-4 a version 1 cloud copy from an older device
  is read by new code and the upload is version 2. BV-5 new code, local path, real `ET.saveMerge`, no choice, both
  orientations: the edited unit is stored. BV-6 new code, a full sync with no choices, both orientations: stored, and
  asked until answered. BV-7 the older Atelier, Lists, Submersibles and Settings code each refuse to write a version 2
  save**), `check.js` C197 (in a browser, an older Tracker tab stays open while the new Bourse saves: the old tab's
  next save is refused, it shows the sentence B0 recorded, and after a reload it saves again), C198 (the BY0 question
  in the Settings dialog, each answer), rebuilt copies. Accept: unit suite; `CHECK_ONLY=C197,C198 npm run check`.
  Escalate if: `<base>` cannot be read, or any BV case shows an older copy writing.
- **B25 Worst sizes on a slow device (Sonnet builder; after B21).** Files: `check.js` C209 (the supported worst size
  of 6.5, with the processor slowed four times: the trip is planned with no single block over 200 ms, the page
  answers a tap during planning, the plan appears within 10 seconds and is either full or labelled "A quick split";
  the same plan as the unslowed run), `src/bourse/trip.js` (`EVAL_MAX` set from the run, never above the tested
  value). Accept: `CHECK_ONLY=C209 npm run check`; the timings in the report. Escalate if: the limits cannot be met
  with any `EVAL_MAX` of 2,000 or more.

Check C210 ("Copy name", D42: on each of the four views the clipboard holds the exact name, also for a name with an
apostrophe and an accent; the refused-clipboard form) is added by B9, the last of the four views in the run order.

## 11. Risks, limits, owner questions

**First thing to verify:** B0's answers for D32: that every older copy refuses a version 2 save, and that no older
sync can upload after a refused read. If either fails, D32's default does not hold and the item stops. Second: B1's
replies (the tax form and rounding, a world on every sale, the caps, the sizes). Third: `lists/store.js` runs outside
the Lists page. Fourth: the hosted-only code and policies of the Tracker and the Atelier, before B15.

**Risks.** `save.js` gains a version and a two-section write: the most sensitive file of the app; every existing test
stays unedited (B3, B23). An older copy that cannot update (offline) cannot save beside an updated page, and each
opening of an old Tracker stores one more rescue copy of the save (`storage.js` `rescue`). Load on a free service:
bounded by D4, D27 and D39; the watch checker is at most 6 requests every 30 minutes per device. The reply sizes at
region level are unmeasured until B1. Web Locks is assumed in current browsers; where it is missing the module is
manual only. The to-check state can ask about many rows after the chosen lists change. Sale prices over three regions
say little about the home world: the opened row shows that. Moving `sumShares` touches the shipped Lists page. The
header gains a seventh page.

**Known limits, as designed.** Direct materials only (D12). The ranking prices one unit (D13). The split is a good
split, not the best; `cheapest` is cheapest among the regions kept; amounts over 2,000 are approximate; a very large
trip gets "A quick split". Hops are one way. The Bourse cannot know why Lists' need changed, so it asks. Worlds other
than home show only their region's cheapest 60 listings (D24). The app does not know the game's travel rules, whether
a route is open, or whether stock is still there. Maintenance announced after the last build is unknown (D17). One
home world for all characters (D41). An item added to the old shopping list by an old cached Tracker after the copy
is not copied; the downloaded file's list is never copied. Lists' own prices stay before the buyer's 5% (owner
question 11). Tax rates are a reading, with its time. Alerts need the app open in a tab, and Web Locks. Not tested by
any automated run: the live price site, a real phone, a real two-device sync.

**Owner questions.** **Closed:** 1 (the Trip's answer: the total to spend), 2 and 6 (the sale price: the travel
area), 4 (alerts: every page), all round two; 3 (the downloaded Tracker: its Market Board points to the Command
Center, no prices), round three; 8 (section heads: book-style, look B; the dark-bars Trip withdrawn), round four; 7
(the labelled 5% stays) and 9 (the recommended ranking pace), round five. **Open:**

5. **The standing sentences** (section 9) are public claims. (a) As written there: no cost; the travel sentence now
   also says the plan is not a promise. (b) Your own wording: you write them; nothing else changes. (c) Keep things as
   they are: the Tracker's current sentence, which mentions none of profit, travel or alerts. Fairly sure.
   **Recommended: (a).**
10. **Old copies of the app and your Bourse entries.** The update adds a rule that protects an entry you changed on
    one device from being deleted because you removed it on another. A page of the app still running the earlier
    version (a tab left open, or a copy your browser kept) does not have that rule.
    (a) **Old pages stop saving until reloaded.** Once any updated page has saved, an old page cannot save or sync
    and says "This save was written by a newer version of the app. Reload the page to update." Reloading while online
    fixes it. Cost: whatever you changed in that old page after the notice is not saved and must be done again; every
    old tab needs one reload after the update, also if you never open the Bourse. Risk left: none of the known ways
    to lose an entry. The refusal is already in the shipped app and was read in the code; it has not been run for
    this case yet. Fairly sure.
    (b) **Old pages keep working; a removed entry is kept with a "removed" mark.** Nothing shows. Cost: more to build
    and test; removed entries stay in the save for about three months before they are cleaned out; when one device
    removes an entry and another changes it, the change wins without asking. Risk left: small, at the clean-up, for a
    device away longer than that. A new design this app has not used. Less sure.
    (c) **Keep things as they are** (the plan before the review). Updated pages protect your entries; an old page can
    still, without asking, delete a watched item, a trip item, a purchase mark or a Bourse setting that you changed
    elsewhere. No cost to build. Risk left: rare, silent, until every device has reloaded. Sure the risk is real.
    **Recommended: (a).**
11. **Lists' prices and the buyer's 5%.** The Bourse shows what you pay, tax included; Lists shows the listed price.
    (a) Keep things as they are: the two screens can differ by 5% for the same item. No cost. (b) Lists says "before
    the 5% buyer's tax" beside its prices: one line of text on a shipped screen. (c) Lists adds the 5% too: its
    totals change, more to build and test. Fairly sure. **Recommended: (b).**
12. **Home world when your characters live on different worlds.** (a) One home world for the whole Bourse, changed in
    settings when you switch character: simple; "saved" and the sale figures are for that one world. (b) A home world
    per character: each character's rows are compared with its own world; clearly more to build, and the trip would
    start from several places. (c) Keep things as they are: the earlier plan did not say; the builder would build
    (a). Fairly sure. **Recommended: (a).**
13. **Asking the price site before the second review.** (a) Keep things as they are: nothing of the Bourse starts
    until the second review passes; the reviewers again judge fields nobody has seen. (b) Let the two fact-finding
    steps run first (a read-only report, and saving about fourteen real replies as test files): the second review
    then judges facts; no app code changes; a small step ahead of the order you set. Fairly sure.
    **Recommended: (b).**

**What was read, and what was not verified (this correction).** Read: the adjudication, both reviews, the owner's
five rounds, research section 4, `save.js` (whole), `merge.js` 70 to 290, `storage.js` 24 to 284, `cloud.js` 154 to
175, `prices.js` (whole), `lists/store.js` 300 to 360, `lists.js` 410 to 444, `live.js` 700 to 794, `ui.js` 19 to 49.
Not verified: any Universalis reply; what each older page shows for a newer save and the sync's order (B0); the
Atelier's handling; the service worker's update path; `store.js` outside those lines; the look spec's current text
and pictures (not read this round); Web Locks on the owner's browsers; the size of anything built.

## 12. Red team and pre-mortem (2026-11-24)

**Same-family review:** a Claude model reading a Claude-written spec; not an independent audit. Findings are numbered
as sent (12 to 14 were not sent). Round one of the outside review replaced the fixes of rows 1, 5 and 10 and added to
rows 2, 4 and 11 (section 14).

| # | Finding | What changed then | Now |
| --- | --- | --- | --- |
| 1 | Old bought marks hide new needs | Marks cleared by the page when Lists' need is 0; "New trip" | Replaced: D33, the to-check state; nothing is cleared by the page |
| 2 | Tax model unknown | One model in percent; B1 records the reply's form | D36: both sides pay, each once |
| 3 | Region name | `PRICE.placePath`; `strict404` | Unchanged |
| 4 | Home world looks empty | D24: the home world is asked for too | D35 words the other cases |
| 5 | Split too slow | Each item priced once per world; 200 ms on the test machine | Replaced: 6.1, 6.2, D38, B25 |
| 6 | Split ignores data-center hops | Whole data centers removed before worlds | D37 adds the start and the baseline |
| 7 | Offline lockout | Offline failures do not count; Refresh lifts a failure pause | A rate-limit pause is never lifted (D4) |
| 8 | Ranking overstates profit | The higher of the cheapest listing and the sales middle; bait flag | Unchanged; ruled on in section 13 |
| 9 | High quality in Lists reads "none" | `minPriceHQ`, then the `hq` filter, then a scan of 20 | D8: an old record has no quality |
| 10 | Tracker list copy | The receipt only after a saved, non-empty copy | Replaced: 6.8, one write with its receipt |
| 11 | Alerts on stale listings | Rings only within `oldDays` | D40: unknown ages, re-arming |
| 15 | Tests that pass at the base; `sumShares`; packed data | Named guards; `sumShares` into the engine | D45; the third argument kept (D14) |
| 16 | No `timers.json`; items too large; trip owner | Built copy only; B13, B14; D23 | The list's date shown (D17); B16 to B25 |
| Look | Long names, "14M", wording, `--gil-m`, the states page | Sections 6, 9; D21; C206 | C206 measures the visible area (B11) |

**Pre-mortem.** (1) B1 cannot reach the host: the items after it wait. (2) A [verify] field is absent and its
fallback makes replies heavy: `maxBytes` and the budgets cap both size and number. (3) The price site changes a
field later: the readers give "failed" or "unknown", last good values show as stale, nothing shows 0. (4) The ranked
sale price is the travel area's and the home world sells for less: the opened row shows it. (5) An old cached copy
meets the new save: it refuses and asks for a reload (D32). (6) The site slows or refuses a device: the pause stops
every page of the device and the screens say so.

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
phone (first row at 256 px on screens without a strip, an exception the owner chose, written into the design rules by
the one-look rules pull request). **Round five.** Look v3 approved; the order of the ledger; an outside review before
building; the labelled 5% stays; the recommended ranking pace.

## 14. Round-one outside review (2026-11-25)

Two outside reviewers read the plan at `0df8781`: ChatGPT (FAIL: 2 blockers, 14 major, 1 minor, 1 note) and Mistral
(PASS: 4 minor, 4 notes). The adjudication accepted every finding. **The corrections below were planned by a Claude
model on a Claude-written spec (same family) and are unreviewed until round two; building stays paused.** Fixes that
belong to the look (findings 15 to 17 and Mistral F5 in the pictures, the look spec and the picture tools) are the
requester's and are not made here.

| Finding | What changed | Where | Left as a known limit |
| --- | --- | --- | --- |
| 01 ledger, order, closed choices | One ledger; the order; questions 3, 7, 8, 9 closed; home-world order; "Copy name"; one history window | Ledger; D41, D42, D43; section 11; C210 | One home world for all characters (question 12) |
| 02 older copies (blocker) | The save's version becomes 2 so older copies refuse; removal marks kept as the alternative; area keys are data-center names; tests in both orientations on both paths | D32, D25; section 8; B0, B3, B24 (BV-1 to BV-7, C197) | An old page must be reloaded; the owner chooses (question 10) |
| 03 outcomes | Four outcomes; field rules; last good values kept as stale; quality slots in Lists | D35, D5, D6, D8; PX-9 to PX-11; C205 | Other worlds are seen through the cheapest 60 |
| 04 tax | Buyer's 5% once, before the merchant comparison; seller's rate on income; whole-purchase rounding; no "before tax" figure | D36; sections 3, 5; BM-5; BR-7 | The seller's rounding is the cautious one, not verified |
| 05 ranking inputs | The basis shown on the row; fewer than 3 sales not ranked; unpriced parts never free; yields; "no cost"; both sale bases | Sections 4, 5; D12; BM-4, BM-6 | The ranking still prices one unit |
| 06 worlds and ages | A world and time on every sale and listing; one filter before every figure; region-only figures labelled; unknown ages never fresh | D6, D44; section 7; BM-14; PX-11 | If sales carry no world, a narrowed area's sale figures are region-wide, labelled |
| 07 start plan, large amounts | Whole listings over all worlds together; over 2,000 units approximate, three real candidates | 6.1, 6.2; BP-2, BP-3 | Over 2,000 units is not exact |
| 08 trip start, baseline | Starts at home; one baseline and amount; rule order per mode; required places; unknown and capped cover; hops one way | D37; 6.3, 6.4, 6.6; BP-6 to BP-9; C202 | Greedy; `cheapest` is within the regions kept |
| 09 budget | Evaluations counted; a labelled fallback; a slowed-device run at the worst size | D38; 6.5; BP-10; B25 (C209) | A very large trip gets "A quick split" |
| 10 purchases (blocker) | A purchase record with its credit; need changes are asked, never inferred; one write for both sections; idempotent retry; conditional Undo | D33, D34; 6.7; section 8; B13, B17, B21, B23 | The Bourse cannot know why a need changed |
| 11 the copy | Same site only; duplicates added, unmapped skipped; copy and receipt in one write; counts shown; the source kept | D10; 6.8; B10 (BC-1, C204) | A later edit of the old list by an old Tracker is not copied |
| 12 load | A device ledger with reservation under a lock; a persisted pause; `maxBytes`; a queue limit; caches merged per item; Refresh never lifts a rate-limit pause | D4, D5, D39; B2, B18, B20 | Without Web Locks the module is manual only |
| 13 alerts | A lock for the round; rechecks at load, send and display; late results discarded; re-arming only from a fresh result above target | D40; section 7; B15 (BA-1, BA-6 to BA-8) | Without Web Locks no automatic checks |
| 14 tests and items | Guards named; a positive control for every negative; B2, B3, B5, B6, B7, B10 split; new and existing paths named; the store dependency named | D45; section 10 | — |
| 15 visible rows (spec side) | C206 counts rows in the visible area and measures opened rows, long names, large text | B11 | The look's own figures are the requester's to correct |
| 16, 17 (spec side) | Phone switches reachable; seven data-center boxes; one threshold field; the total excludes what is bought; the alert has Close and the age | Section 9; D25; 6.4, 6.6; section 7 | The drawings are the requester's |
| 18 dates and caveats | The timer list's date and the route caveat shown; records point to the five rounds | D17; section 6 ("Said once"); B12 | Maintenance announced after the build |
| Mistral F1 | "no cost" | Section 5; BM-6 | — |
| Mistral F2 | One window: 7 shown, 30 kept and offered when held | D43; section 3; B14 | — |
| Mistral F3 | Closed questions closed; no wait for the look's approval | Section 11; section 10 | — |
| Mistral F4 | Alert interval default 30 minutes | D27; sections 7, 8 | The look spec's line is the requester's |
| Mistral F5 | (look) | — | — |
| Mistral F6, F7, F8 | With 07, 02 and 12 | As above | — |

**New defaults this round set, for the reviewers and the owner to see:** fewer than 3 sales in 7 days is not ranked;
300 Bourse requests per rolling hour per device; 2,000 purchases per trip; a reply over 2 MB is refused; an alert
round ends after 60 seconds; the removal-marks clean-up of option B at 90 days.

**Round six (owner, 2026-11-25).** Questions 5 (a), 10 (a), 11 (b), 12 (a) and 13 (b) are answered and closed: D32's
default (save version 2, older pages stop saving) is decided; B0 and B1 run before the second outside review; Lists
gains the line "before the 5% buyer's tax"; one home world. The owner keeps the answer band's state blocks on the phone,
accepting 3 resting rows on Item, Profit and Watch (rule P3's count), to be written into `docs/design-rules.md` with the
first-row exception by the one-look rules pull request.
