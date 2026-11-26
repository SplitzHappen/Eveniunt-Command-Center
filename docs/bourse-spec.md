# Bourse, the market module (blueprint phase 4): build spec

Written 2026-11-24 for a Sonnet builder and a Haiku clerk; revised after a same-family red team (section 12), the
owner's rounds two to eight (sections 11, 13, 14), three rounds of outside review (sections 14, 16, 17) and the facts
of B0 and B1 (section 15). **Round three of the outside review failed the plan on 2026-11-26; this text holds its
corrections (section 17), which are same-family and unreviewed.** Plan only: apart from B0 (a report) and B1 (saved
replies and their test) nothing was built. **Building is paused** (order below).
Binding inputs: the owner's answers in `docs/bourse-questions.md` (eight rounds; a later round replaces an earlier
one), `docs/bourse-review-adjudication.md`, `-2.md` and `-3.md`, the look spec `docs/bourse-look-spec.md`, look v3
(screens are not designed here), `docs/design-rules.md`, `docs/bourse-research.md`.
Blueprint rules restated: **CC-12** prices are labelled as community reports with when and where they were seen;
listings and past sales are shown separately; the market tax is counted; "profit" is an estimate, never a promise;
lookups are batched and cached; stale or missing data is marked. **CC-08** a website alerts only while open in a tab.
**CC-09** a "Solve in the Atelier" link that cannot be matched exactly is refused, not guessed.

Trust marks: **found (B1)** = seen in the saved real replies (`tracker/tests/fixtures/universalis/`, section 15).
**[shipped]** = the shipped code already reads it. **[verify]** = not seen by this project: an answer 429 from the
price site, the size of a 10-listing reply, and OneDrive's "create only if missing". **Not readable, as found
(2026-11-26):** the price site's replies carry `access-control-allow-origin: *` and no
`Access-Control-Expose-Headers`, so a page cannot read a `Retry-After` header.

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
| A tick marks only (default); adding to Lists' "I have" is a switch, built with its merge rule and left out if that rule fails its tests | answer 28; rounds seven (14a) and eight | D33, D46, D47, D62 |
| The lists chosen, combined | answer 29 | D14 |
| History: 7 days shown, 30 when the site has them; figures and one small chart; one window's middle | answers 30, 31, round five | D43 |
| Prices never in the save; the watch list, own items, purchases and settings are | answers 32, 39 | section 8 |
| Watch list with in-app alerts on every page | answers 33, 34, round two | D30, D40, D57 |
| Look v3 (look B, Atelier-led), approved; state colours, gold for gil bars only; the answer blocks stay on the phone, 3 resting rows accepted on Item, Profit and Watch | rounds two to six | D31, section 9 |
| The Trip's answer is the total to spend; sale prices are read over the travel area | round two | section 6, D29 |
| Lists gains high-quality prices, and the line "before the 5% buyer's tax" | answer 40; round six (11b) | D8 |
| The standing sentences as written in section 9 | round six (5a) | section 9 |
| Older pages stop saving until reloaded: save version 2 | round six (10a) | D32, D60, D61 |
| The old Tracker's "Erase everything" is fixed first, as the Bourse work's first step, released well before the save version rises | round eight | D60; B29 |
| B0 and B1 ran before the second outside review; a third round ran; a fourth, with both reviewers, follows this correction | rounds six, seven, eight | sections 15 to 17 |

**Order.** (1) The plan passes: a fourth outside round, both reviewers, on these corrections (round eight). (2) The
one-look rules pull request. (3) The module moves, one pull request each (Lists, Atelier, Tracker, Home and Settings,
Submersibles). (4) The Bourse work, last: B28 (the baseline again), then **B29, the fix to "Erase everything",
released by itself**; the rest is built into the one look and released **no sooner than 30 days after B29's release**
(D60). B0 and B1 are done (section 15).

## 1. Goal, constraints, what is not built

- **Goal.** One new page, `bourse/`, with four views (Trip, Item, Profit, Watch) and a settings sheet: prices over the
  owner's travel area; profit per craft; a shopping trip split by region, data center and world; price history; a watch
  list with in-app alerts on every page of the app.
- **Constraints.** Offline-first, public, GitHub Pages: no server, no account, no key, no CDN; the only outside host is
  `universalis.app`, and only item numbers, place names and a world number are sent. Never read or automate the game;
  never invent game data or a price: a figure the app lacks is "unknown", never 0 (rule S5). The app does not decide
  who can travel where (D25). Saves stay compatible (section 8, D32). No personal names or private paths. Two
  releases: B29 first, then the module (one pull request); the owner ships each.
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
- **D2 One price source, five reply kinds** (section 3). The aggregated endpoint is not used.
- **D3 Saved replies first.** B1 saved real replies; a test asserts every field of section 3. A reply is never written
  by hand and called a fixture; hand-made stand-ins are named `stand-in` and use only fields the fixtures hold.

**The price service** (`tracker/command-center/src/prices.js`, existing file, extended; `PRICE.create` keeps every name)
- **D4 One request queue for the Bourse's services**, `PRICE.queue(url)`. At most 2 requests in flight and 300 ms
  between starts, counted over every page of the device by the ledger (D39, D56); at most 40 waiting per page (more
  resolve "not fetched"). **Lists' and Submersibles' services keep today's path and behaviour, byte for byte**; they
  do not use the queue or the ledger (known limit, section 11). **The plan's own backoff:** after an answer 429 the
  Bourse sends nothing for 15 minutes; a 429 on the first request after such a pause doubles it (30, 60, … at most 6
  hours); a usable answer resets it. After three failed answers in a row: 15 minutes. A failure while offline does not
  count. Coming online or pressing Refresh lifts a failure pause; nothing lifts a rate-limit pause before its time.
  **The site's `Retry-After` cannot be read by a page (trust marks) and nothing here promises to honour it; if a reply
  ever exposes it, the pause is the longer of the two.** [Routing the existing services through the ledger: it would
  change shipped behaviour where tabs cannot be coordinated.]
- **D5 New options of `PRICE.create`, each defaulting to today's behaviour:** `endpoint(place, ids)`, `freshMs`,
  `noneMs`, `batch` (100), `maxRequests`, `storage`, `strict404`, `outcomes` (D35), `ledger` (D39), `deadlineMs`
  (D56), and **`maxBytes`, the reply cap**: a reply is read as a stream and abandoned past this size (a failed fetch,
  charged, nothing stored); the Bourse sets 2 MB. A batch whose reply passes the cap is asked once more as two
  halves, each charged, never a third time. The default `storage` is today's one record, byte for byte.
  `PRICE.idb(name)` is a second `storage`: an IndexedDB database of its own (`eveniunt-bourse-prices`), one record per
  service and place, updated per item inside one database transaction, each item stamped with its request's order
  number (D56); memory only when IndexedDB is refused, and the screen says prices are not kept. `strict404`: a 404 is
  a failed fetch, never "no market price" (found (B1)).
- **D6 Quality, world and time live in the stored value**, made by shared readers: `PRICE.readDeep(x, asked)` gives
  `{ up, w: { <world>: { up, cap, n: [[price, qty, cost, listed]…], h: […] } }, s: { n: [[price, time, world, qty]…],
  h: […] } }`; `PRICE.readSlim(x, asked)` the same with at most 10 listings a region (D49). `price` = the seller's
  asking price for one unit; `cost` = what the buyer pays for the whole stack (D36); `up` = when that world's board
  was last reported; `listed` = the listing's own review time (D50); `cap` = the slice may be cut. Names of retainers
  and buyers and listing numbers are never stored. Each reader returns an outcome (D35), never a bare `null`.
- **D7 The 15-minute gate, per service and place, is unchanged** for every automatic try; Refresh ignores it. For the
  Bourse's services no automatic try is made or recorded while offline.
- **D8 Lists gains high-quality prices by changing only its own `read`.** It reads the reply's `minPriceNQ` and
  `minPriceHQ` (found (B1)); stored value `[cheapest of any quality, average, world, upload, cheapest ordinary,
  cheapest high quality]`. A minimum of 0 is "no value", stored as absent, never a price of 0 (D52). An ordinary row
  shows and adds up slot five; a high-quality row slot six; slot one is never shown as either. A stored four-part
  record has no quality: both rows read "not fetched yet", it is left out of the subtotal, and the item is due at the
  next permitted fetch. Lists' price line gains "before the 5% buyer's tax" (round six). Lists keeps its own price
  place.
- **D9 The Tracker's fetcher is removed** (answer 2; round three). `live.js` `mbFetch`, `mbSummary`,
  `fillMarketLines`, `renderMarket` go. Inside the Command Center the Market Board page is the empty-state form with
  one link "Open the Bourse", and an entry's detail line is a link "Prices in the Bourse" (`../bourse/#item=<id>`). In
  the downloaded single file the page says the market moved to the Command Center and shows no prices.
- **D10 The Tracker's shopping list is copied once per device, never moved** (section 6.8, D58). `mlist` and `mqty`
  stay stored. The copy and its receipt are one write; the player is told what was copied and what was skipped.

**Profit**
- **D11 The ranking fills only when asked.** Section 4.
- **D12 Profit of one craft**, section 5. Direct materials only, except a material that cannot be traded and has a
  recipe, which is costed by its own materials (four levels at most, loop-safe; any unknown part makes the whole
  craft "Missing a price", never free).
- **D13 The ranking prices one unit, cautiously, and says so; the opened row prices the recipe's amounts** by walking
  the listings and shows the home world's own figures (D29). In the ranking a material's market price is the higher of
  its cheapest listing seen in the area (D49) and the middle of its recent sales.

**Trip**
- **D14 The trip's needs** are Lists' items to buy on the market for the lists chosen, plus the trip's own items, less
  what is marked bought (D33). A new pure `LISTS.marketNeeds(plan, listIds)` in `engine.js` returns
  `[{ key, item, quality, qty, from: [[<wanted-item key>, <amount it asks for>]…] }]`: `from` names the wanted items
  (Lists' `targets` keys, `<list>.<target>`) of the chosen lists whose plan asks for this item, sorted. The page's
  private `sumShares(plan, ids, stepId)` (`lists.js` line 424) moves into the engine unchanged, third argument
  included, as `LISTS.sumShares`; the Lists page calls that one. One plan per character (D23).
- **D15 One split method for all three modes**, section 6. The screen says "a good split", never "the best".
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
- **D32 Older copies cannot merge a save that holds the new rules: the save's version becomes 2** (decided, round
  six). Every older page refuses to write over a newer save **except one: the older Tracker's "Erase everything"**
  (D60), which is why the version rises only under D60's rule and with D61's guard. The backup file's and the transfer
  code's own versions rise with it (`codec.js`), so an older copy refuses them with its existing sentence, and new
  code reads the old ones. Section 8 gives the contract and what each older page really shows.
- **D33 A purchase is its own record and says what it credited.** `bought` is keyed by a purchase id made at the tick.
  A fall in need is never read as a purchase; the page never clears a mark by itself. The mark and the stock credit
  are one write (D34) with a receipt, a bounded retry that cannot credit twice, and a conditional Undo. Section 6.7;
  D46, D47 and D62 complete it.
- **D34 One write for two sections: `CC.writeSections(parts, opts)`** in `save.js` (new). `parts` is a list of
  `{ name, section, known, own }`, exactly `CC.writeSection`'s arguments; all parts are checked, merged and stored in
  one `CC.transact`, in order; any refusal or error cancels all of them. A part may give `edit(storedSection)`
  instead of `section` (it runs inside the transaction on the stored section); `own.device` may be a function of the
  stored device part; `opts.check(doc)` runs first and may throw to cancel; `opts.ifRev`: the write is refused unless
  the stored stamp is this one (no merge is ever made). **On the fallback storage (device storage without IndexedDB)
  the save and its stamp are two separate writes and no lock exists. `CC.writeSections` is refused there, whatever
  its parts**, and writes nothing. **The consequence is stated, not hidden: on such a browser the Bourse cannot mark
  a purchase, undo one, start a new trip or copy the Tracker's list; it says "Marking purchases is off in this
  browser: its storage cannot save safely from two tabs. Everything already saved is kept."** Watching items, own
  items and settings use the one-section write as every other module does. `CC.writeSection` becomes the one-part
  call of the same inner function, unchanged in behaviour. The Bourse section honours `known.expect` (rule BI2).
  [A weaker guarded write on the fallback: two tabs could still fill one need. One stored value for save and stamp:
  it changes the fallback's format for every module.]
- **D35 Every reply item ends in one of four outcomes**, per place and quality: **usable**; **confirmed empty**;
  **unknown**; **failed** (no answer, an error answer, a deadline passed, a reply over `maxBytes`, or a success whose
  shape is wrong). Only "confirmed empty" may be worded "none", and D52 says when a reply proves it. After a failure
  the last good values stay, marked "last read <age>; the refresh failed". Field rules: a price and a quantity are
  whole numbers of 1 or more; `hq` must be true or false; a world must be in the app's list (D50); a time must be a
  positive number in its unit (found (B1): report times in milliseconds, sale and review times in seconds; a report
  time of 0 occurs and is "unknown") and not more than a minute ahead of the clock, else the age is unknown. A bad
  entry is dropped and counted, never repaired, and makes "confirmed empty" impossible for that item and place.
- **D36 Tax, both sides, each exactly once, and three figures kept apart.** (1) **The asking price** is what the
  seller listed for one unit; it is the figure for "cheapest listing" as a sale basis and for a watch target's
  comparison base before tax. (2) **The buyer's cost** of a stack is `price × quantity + floor(price × quantity × 5 /
  100)`: the game's flat 5%, rounded down per stack. All 139 saved listings, from retainers in eight cities, fit it
  (the smallest: 3 at 12, total 36, tax 1). The listing's `tax` field is that amount and is only a cross-check: when
  it differs the stack is still priced by the rule and counted "tax field differs"; a missing or zero field changes
  nothing. Tax is never worked out on a sum of stacks. One unit bought alone costs `price + floor(price × 5 / 100)`;
  that is compared with a merchant, and a tie goes to the merchant. "Each, for N" = the stacks' summed cost ÷ the
  units **needed**, rounded up, with "buys M" beside it when it overshoots; a single stack's own unit cost on the Item
  ladder is labelled "per unit in this stack". (3) **The seller's proceeds**: `income = sale × yield − ceil(sale ×
  yield × ratePct / 100)`, where `sale` is an asking price or a past sale price, **never a buyer's cost**; the cautious
  deduction (the game's own rounding of the seller's side is in no reply). A city rate is a whole percent and a rate
  of 0 is real. No Bourse figure is "before tax"; when the seller's rate could not be read the labelled 5% is used.
- **D37 The trip starts at the home world**, and one baseline rules every comparison. Sections 6.2 to 6.6.
- **D38 The split has a budget and a labelled fallback.** Section 6.5, D55.
- **D39 One ledger for the device**, `eveniunt-bourse-ledger` in device storage (`PRICE.ledger`, new, in `prices.js`):
  the pause, the starts and requests in flight, the order numbers and every request charged against D27's budgets. A
  charged request is every request actually sent to the price site by a Bourse service: retries, the home-world read,
  opening requests, the two halves of a split batch and a failed region asked again all count, charged when sent,
  never refunded. **Where the browser has no Web Locks, or the ledger's storage is refused, the Bourse sends no price
  request at all** (D56): it shows what is cached and says "This browser cannot coordinate tabs, so the Bourse cannot
  ask for prices here. Saved prices are shown."
- **D40 One alert round at a time, by a lock, with rechecks.** Section 7, D57.
- **D41 Home world, in this order:** (1) `prefs.home` when it names a world of the app's list; (2) the Tracker's place
  setting on this device (`eveniunt-tracker-ui` in device storage, `ui.live.world`), shown as "From the Tracker's
  place setting" (never a character's name) and not stored until the player picks; (3) none: "Choose your home
  world". One home world for the whole Bourse; a character's or a free company's world is never taken as home. The
  sheet has a picker and says: "One home world for the whole Bourse. If your characters live on different worlds,
  choose the one you shop and sell from now."
- **D42 "Copy name"** is in the More of every item row on Trip, Profit and Watch, and beside the item's name on Item.
  It copies the item's name exactly as the Lists data holds it; the status line says "Copied: <name>". If the browser
  refuses the clipboard, the name is shown selected in a field with "Press Ctrl+C". Check C210.
- **D43 One history window, stored and shown.** The `history` service asks for 30 days and keeps what it gets for 30
  days. The Item screen shows 7 days; a "30 days" choice appears only when the held sales reach back further. Profit
  always uses the 7-day window.
- **D44 One filter before every figure.** `MARKET.inArea(world)` is applied to every listing and every sale before any
  middle price, cheapest listing, sales a day, history line or alert. Sales a day = the filtered sales inside the
  window ÷ the window's days (7, or 30 on the Item screen's longer view). When the reply's sales were cut the figure
  is a lower bound and reads "at least N a day (the last 40 sales cover X days)". An unknown age is never fresh.
- **D45 Tests say what they are.** A **guard** passes before and after by design. Every other assertion must fail
  without its change, assertion by assertion, not only because a file is missing. Every "sends nothing", "shows
  nothing", "refuses" or "does not contain" assertion has a positive control in the same test and fixture.

**Round-two outside review (2026-11-26)**
- **D46 A credit survives a merge: rule BY2, new code only.** It applies only to a Lists count for which a purchase
  record holds, or an undo mark shows there once was, a credit: so only to players who turned on "Also add to I have
  in Lists". **A count = the player's own part + the credits of the purchase records that exist, and no merge ever
  stores a count that breaks this.** Where the two sides cannot be combined (the sum would pass 999,999 or fall under
  0, or a record is missing with no trace of an Undo), **the whole pair, count and records, stays on this device
  exactly as it was and the player is asked; the open question is kept in the save and outlives reloads and later
  syncs** (section 8). The setting is built only if item B26 passes; otherwise it stays off and hidden, proven by
  check C216. [Clamping the sum: the next merge reads the clamp as the player's own stock and loses units. Keeping
  "this device's count" alone: a count without its records breaks the rule at once.]
- **D47 Purchase records are never edited, a credited one leaves only by Undo, and an Undo leaves a mark.** "Still
  count them" adds a check record; "New trip" starts a trip with **its own random id** and deletes no credited
  record; a tick is bound to the need and to the wanted items behind it; Undo of a credited purchase writes
  `undone[<purchase id>]`; a receipt on the device and a bounded retry stop any second credit. Section 6.7.
  [A shared trip number: two devices that each start a new trip get the same number and share marks.]
- **D48 The cloud copy: every write names the copy it replaces, and a copy that is not known to descend from the one
  this device last synced is merged without removing anything.** Create only when none exists, then read it back;
  replace only with the `eTag` read; the owner's overwrite only of the very copy the question showed; lineage carried
  inside the copy (D63). `cloud.js`, section 8, item B27.
- **D49 The ranking's listing figure is an observation with a world and an age.** The `slim` service asks for the 10
  cheapest listings a region with their worlds (`listings=10&entries=40`). Per region the outcome is **seen** (the
  slice holds a listing of the quality on a world of the area: the cheapest such one is that region's cheapest in the
  area), **proved none** (D52), or **not covered** (the slice is cut and holds none of the area, or the region
  failed). The area's figure is the cheapest seen; **it is called "cheapest listing" only when every region is seen
  or proved none, and otherwise "cheapest seen (Europe not covered)"**, and a craft ranked by the listing basis then
  wears "partial". No region seen: "unavailable". The sale basis uses the asking price (D36).
  [`minPriceNQ/HQ` with `listings=0`: no world, no age, and worlds outside the area can set it.]
- **D50 Where a row's world and time come from.** A world reply (found (B1): its listings and sales carry no world)
  gives every row the world of the reply, after the reply's own world name and number are checked against the one
  asked. A region reply's rows must each carry their own world, else the row is dropped and counted. A world's
  **report time** (`worldUploadTimes` on a region reply, `lastUploadTime` on a world reply) is the age of every price
  of that world and the only one that decides "old", "fresh" and alerts; a listing's **review time**
  (`lastReviewTime`) is shown on the Item screen as "listed <age>" and decides nothing.
- **D51 The home world's own reply is the authority for the home world.** When it answered, the home world's rows
  inside the region reply are ignored; when it failed, the region's rows for the home world are used and labelled as
  a cut slice. Rows are never matched by price and size: two equal offers are two offers.
- **D52 "Confirmed empty" needs a reply that proves it for that quality:** the request had no quality filter and asked
  for listings; the item is in the reply; the slice is not cut; no entry of that item was dropped. For the travel
  area: every region answered so. Anything else is unknown. A minimum of 0 (`minPriceNQ`, `minPriceHQ`) is a missing
  value: never a price, and never by itself proof of "none".
- **D53 A figure needs all of its inputs.** A recipe's market cost is used only when every ingredient's whole amount
  is covered by listings; otherwise the opened row reads "cost unknown: only N of M <material> listed". The Trip's
  answer is "total still to spend" only when every row is resolved; otherwise it is "known so far", with what is
  missing beside it. **Every stop the plan keeps is in that figure, a required stop in another region included; no
  kept stop is ever shown as an optional extra outside the total.** A trip with nothing left reads "Nothing left to
  buy", never a bare 0.
- **D54 One allowance for the whole trip.** The extra cost a plan may add over the baseline is one amount, `A`, spent
  by every removal of every pass together: in `cheapest` and `within` the plan's total never passes `C0 + A`. A
  baseline that holds an approximate item is a reference, labelled so. Section 6.2, 6.4.
- **D55 Every size has a rule, and every piece of work is counted.** Section 6.5: the sizes the save can hold; one
  work unit for a table cell, a comparison in a sort, a stack looked at in the search above 2,000, a listing pooled or
  filtered; no step does more than it was given, in preparation as in pricing; the 300-stack limit never loses cover
  silently.
- **D56 One dispatch decision, made immediately before sending.** For each request the page takes the ledger's lock
  and, inside it, in one go: reads the pause (no send while it runs); drops the request if its own deadline or its
  round's end has passed; checks that fewer than 2 requests are in flight on the device and 300 ms have passed since
  the last start; checks the budget; takes the next **order number**; writes all that; **and calls `fetch` before it
  gives the lock back**. There is no grant that can be used later. A request has a deadline (`deadlineMs`, 20
  seconds, covering the answer's body): then it is aborted, counts as failed and stays charged; an in-flight entry
  expires after 25 seconds. A pause's end is only ever moved later. Every cached item carries the order number of the
  request that filled it, and an answer with a lower number than the stored one is discarded (order numbers, not
  clocks, so a clock set back cannot reorder). **Without Web Locks or without the ledger's storage none of this can
  be kept, so no price request is sent** (D39). [A limited manual path without coordination: every tab and every
  reload would get its own allowance, and a pause could not be kept.]
- **D57 An alert belongs to what was asked.** Section 7: every saved input is rechecked (the age limits too); a
  request can expire while waiting, when sent and when its answer is used; crossings are kept per area.
- **D58 The Tracker's old list is normal quality.** It never held a quality, so every copied item becomes
  `<item>.nq`, and the row says "normal quality (from the Tracker's list)". The larger-amount rule is worked out
  inside the write, against the amount stored at that moment (`edit`, D34).
- **D59 Pinned commits.** `<base>` = the commit the Bourse branch starts from, after the module moves. `<old0>` = that
  same commit, the older copy **before** the erase fix. `<old>` = the commit of B29's release, the older copy
  **after** it. Mixed-version tests name which one they load. B28 pins `<base>` and `<old0>`; B29 pins `<old>`.

**Round-three outside review (2026-11-26)**
- **D60 "Erase everything" first, and a waiting time before the version rises.** Read in the code: `ET.clearState`
  (`storage.js` lines 292 to 305) catches the error a newer or unreadable save raises, starts from an empty save and
  writes it back, so an older Tracker's "Erase everything" would wipe every module of a version 2 save, while its
  question promises the other modules stay. **B29, the first step, changes the shipped app: the erase refuses a save
  it cannot read or that is newer, as every other writer does, and says so.** It is released by itself. **The release
  that raises the version ships no sooner than 30 days after B29's release went live** (the date is written in
  `docs/STATE.md` by B29 and checked by B12). A copy older than B29 can still sit in a browser's cache after that
  (a device long offline): D61 is for it. [Raising the version at once: every cached Tracker would hold the wiping
  erase. Waiting for "all devices updated": the app cannot know that.]
- **D61 A guard copy, and an offer to restore.** New code keeps the last version 2 save a second time, under its own
  key in the same storage (`main-guard`, with its stamp), written in the same transaction as every save. At every
  read and before every write, new code compares: **when a guard exists and the save is missing, blank, unreadable or
  of a lower version than the guard, an older copy replaced it.** New code then writes nothing over either and every
  page shows: "An older copy of the app replaced the saved data on this device (for example its 'Erase everything').
  Your data as the updated app last saved it, on <date>, is still here. **Restore it** (recommended) or **keep what
  is there now**." Restore puts the guard back (the replaced data is kept first under its own key). "Keep" asks once
  more, then adopts what is there and renews the guard. On the fallback storage the guard is written when space
  allows; when it cannot be, the page says nothing and there is no guard (known limit). [No guard: the first sign of
  the erase would be an empty app. Restoring without asking: the player may have meant to erase.]
- **D62 Lists' counts and the purchase records move as one unit, everywhere.** In every merge (BY2). In a backup or
  transfer code loaded on this device, which **replaces** sections and does not merge them (`adoptLoaded`, `ui.js`
  lines 1016 to 1022): the credited purchase records and undo marks come from the same place as the Lists section
  (from the file when the file carries Lists, with none when the file has no Bourse section; from this device when
  it does not), and the question says so. In Settings' rebuilding of the sync base after a clash (`settings.js`
  lines 316 to 334): a count that is put back as it was at the start takes every purchase record and undo mark of
  that owner and item back with it. Rule LI6 guards a count also after its last credit is gone. Section 8.
- **D63 A cloud copy says where it comes from.** Each uploaded copy carries, beside its data, its own random id and
  the ids of the copies it descends from (the last 200). `sync.drive` records the file's item id, the `eTag` and the
  copy id last synced, together. A copy read is a **known descendant** when the file's item id is the recorded one
  and its line holds the recorded copy id; then the merge uses the recorded base as today. In every other case (an
  older app's copy, which has no line or a lower version; a same-version copy from a device that never saw ours; a
  missing, partial or foreign record on this device; more than 200 uploads apart) **the two copies are merged with
  no base: nothing is removed and every difference is asked**, as a loaded backup is already treated. Section 8.

## 3. What is fetched (host `https://universalis.app/api/v2/`)

"per region" = one request for each region of the travel area (D26), three by default. A one-item request returns the
item itself, a batch wraps them in `items{}` with `unresolvedItems` (found (B1)); an item named there is unknown.

| Service (cache `PRICE.idb`) | Used by | Request | Fresh | Fields read (all found (B1)) |
| --- | --- | --- | --- | --- |
| `deep` | Trip (per region, and the home world), Watch (per region), an opened Profit row (per region, and the home world) | `{place}/{≤100 ids}?listings=60&entries=20` | 15 min | `listings[].pricePerUnit`, `.quantity`, `.hq`, `.worldName` (region replies only), `.lastReviewTime`, `.tax` (cross-check, D36); `recentHistory[].pricePerUnit`, `.hq`, `.timestamp`, `.quantity`, `.worldName` (region only); `worldUploadTimes` (region) or `lastUploadTime` (world); `listingsCount` |
| `item` | Item, "Look deeper" on a trip row; per region, **and the home world** | `{place}/{one id}?listings=300&entries=0` | 15 min | as `deep` |
| `slim` | Profit ranking; per region | `{region}/{≤100 ids}?listings=10&entries=40` (D49) | 24 h for "Rank these crafts" | as `deep` |
| `history` | Item; per region | `history/{region}/{id}?entriesWithin=2592000` | 1 h; kept 30 days (D43) | `entries[].pricePerUnit`, `.hq`, `.quantity`, `.timestamp`, `.worldName` |
| `tax` | Profit | `tax-rates?world=<home world number>` | 6 h | one whole-percent rate per city |

Requests per action, default area, a cold cache: Trip 4 per 100 items (three regions and the home world); **Item 7**
(three regions' listings, three histories, the home world's listings; 6 when no home world is set); an opened Profit
row 4; a watch round 3 per 100 watched; a press of "Rank these crafts" 12; opening Profit at most 3. A home-world
reply already cached and fresh (from the Trip) is used and not asked again. Every reply is bounded by `maxBytes`.
The `slim` form with 10 listings was not among the saved replies: B20 saves one real reply of it **for a full batch of
100 items** (one request) and records its size before the service is used.

A price's age is always that world's report time (D50), never our fetch time. What remains unseen is an answer 429;
the tests use a stand-in for it, with no wait header (the real case, trust marks) and, for the day one is exposed,
with a wait given in seconds and one given as a date.

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
  rounded); *cheapest listing* = that quality's cheapest **asking price** seen in the area by D49, with its world and
  age and its label ("cheapest listing", "cheapest seen (… not covered)" or "unavailable"). **Both are shown side by
  side on the row, each with the profit it gives**, the first with its sample: "from N sales in 7 days". The row is
  ranked by the first (the segmented choice swaps them; a craft whose chosen basis is unavailable is not ranked by
  it). "1 unit priced" is said once per row. Fewer than 3 sales: "Too few sales to rank"; none: sale unknown. The
  opened row adds the home world's own figures.
- **Tax: D36.** `ratePct` = the lowest current city rate on the home world, or the city chosen in settings; "Where to
  sell this week" lists every city, lowest first, with "read <when>". A rate is never shown as this week's unless read.
- **Material cost, per unit:** the cheaper of (a) the cheapest gil-only merchant offer and (b) the market: **the
  buyer's cost of one unit** (D36) at a market price. (b)'s market price in the ranking is the higher of the cheapest
  ordinary asking price seen in the area (D49) and the middle of the material's recent ordinary sales; with one of
  the two missing, the other, flagged ("material priced from one listing", "no listing read"). (b) on the opened row
  is the listings walked for the recipe's amounts (section 6.1), used only when the whole amount is covered (D53);
  the row says "ranked on 1 unit; opened for your amounts". Gathered materials: market value, or 0 with "gathered:
  free" when the switch is on. Crystals: market. Neither (a) nor (b): unknown, and the craft goes to "Missing a price".
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
whose quantities reach the amount. Up to 2,000 units this is exact over the stacks weighed: a table over the amounts
that keeps, per amount, the lowest total and, among equal totals, the fewest stacks. Remaining ties go to the stack
that comes first in one fixed order (home world, home data center, home region, then world name, then price, then the
reply's order). "Fewer worlds" is not promised among equal totals. **Which stacks are weighed:** the 300 cheapest by
unit cost; **if those hold fewer units than the amount while all held stacks hold more, the largest remaining stacks
are added until the amount is covered or none is left.** Whenever any held stack was left out the row says "priced
from a restricted set of listings: a cheaper mix may exist". **"N of M found" is always counted over every held
stack, never over the weighed ones.** The row says "buys 99, you need 5" when it overshoots. Above 2,000 units the
result is approximate and labelled "approximate: a cheaper mix may exist": the cheapest of (i) cheapest unit price
first; (ii) the cheapest single stack that covers the whole amount; (iii) each of the first 50 leading parts of (i)
closed by the cheapest single stack that covers the rest. Every candidate is a real set of stacks. Wording of cover
follows D35 and D52. Never 0.

**6.2 The start plan and the baseline.** Every item is priced by 6.1 over all allowed worlds together. Its total is
`C0`, the one baseline, and `A = floor(C0 × within / 100)` gil is the one allowance (D54). When the plan holds an
approximate or restricted item, `C0` is a reference: it is shown as "reference total (approximate)", and if a later
pricing of that item over fewer worlds comes out cheaper, the cheaper purchase is kept for the item and counts as a
removal that costs nothing; the allowance is never raised by it.

**6.3 Cover.** Per item: the units found (6.1), and each place's outcome (D35). A removal (6.4) is allowed only when
every item's found units stay the same. A region that failed is not in the plan and the plan says "made without
<region>". An item whose only listings sit behind a cut slice is "not among the cheapest 60", with "Look deeper".

**6.4 Split, `prefs.split` (default `within`, 10%).** Removing a place re-prices, by 6.1, the items bought there over
the remaining worlds; its **saving** is that plan's total minus the current total. A place that cannot be removed
without losing cover is **required**: it stays in every mode, labelled "the only listings of N items are here" when
every region of the area answered with whole slices for those items, and "the only reported listings of N items are
here" otherwise. **A required stop is a stop like any other: its purchases are in the total (D53).** The home world,
home data center and home region are never candidates. Three passes; after each removal the savings are worked out
again.
1. **Other regions.** `fewest`: remove every region that can be removed, smallest saving first. `cheapest` and
   `within`: take the region with the smallest saving; remove it when that saving is at or under `A` *and* the plan's
   total afterwards is at or under `C0 + A`; a region whose saving is over `A` stays ("saves N gil"); a region whose
   saving is under `A` but no longer fits the allowance stays too and says "kept: without it the trip would cost more
   than your X% allows". `cheapest` then stops and says it is cheapest among the regions kept.
2. **Other data centers.** `cheapest`: none. `fewest`: every one that can be removed, smallest saving first.
   `within`: the smallest saving first, while the plan's total stays at or under `C0 + A`.
3. **Other worlds.** As pass 2.
In `cheapest` and `within` no sequence of removals can pass `C0 + A`; `fewest` has no allowance and says what it
costs. Ties between candidates: the one with fewer items bought there, then by name. The answer reports "N gil (X%)
more than the cheapest split" (`total − C0`, "than the reference" when `C0` is one). The settings sheet has one
threshold field: "Another region must save more than this to be worth the trip, and fewer stops may never cost more
than this in total."

**6.5 Sizes, work and fallback (D38, D55).** Accepted sizes: a row's need is whatever Lists holds (up to 999,999) or
an own item's amount (up to 99,999); the number of rows, own items, purchases and watched items is whatever the save
holds after a merge or a loaded backup, also above the page's limits (section 8). Nothing is refused or cut for size:
an amount over 2,000 takes 6.1's approximate path; own items over the limit are planned and the page says "over the
limit: remove some before adding more"; watched items over 200 are shown, the first 200 by key are checked, and the
view says "N not checked: over the limit". **Work is counted in units, not in clock time**: one unit for a table
cell, for a comparison while sorting, for a listing pooled or filtered, for a stack looked at in the search above
2,000. `TRIP.start(input)` does none. `TRIP.step(state, units)` does at most the given number and can stop anywhere:
inside an item's preparation, inside its table, inside a candidate of the search above 2,000, inside a pass. The page
runs steps of a size that takes at most 50 ms (set by B25) with "Planning the trip…", and the result is the same
whatever the step size. The passes may use `EVAL_MAX` re-pricings (a named constant, start value 20,000); when it is
spent they stop where they are and the plan is labelled "A quick split: too many items to try every option." The
first pricing is never cut short: until it is complete no plan is shown. Supported worst sizes for the timing run:
600 rows, every world of the seven data centers, 60 listings a region and item, 20 rows over 2,000 units, one of them
999,999; one item with 900 held stacks after "Look deeper"; and a merged trip of 1,200 rows.

**6.6 Route and hops.** The trip starts at the home world, whether or not something is bought there. Order: the home
world; then the other worlds of the home data center; then the other data centers of the home region; then the other
regions; inside each level by gil saved, largest first (`prefs.route = 'items'`: by most items), a stop with an
unknown saving after the known ones, then by name. Hops are counted from the home world, one way, and the screen says
so once: "Hops are counted from <home>, one way." A data-center hop is each step along the route (start included) that
changes data center; a region hop each step that changes region; **on a phone the stops, the region hops and the
data-center hops stay on one line**. `saved` of a stop = what its purchases cost on the home world (6.1 on the home
world's own reply, D51) minus what they cost there. An item the home world cannot fully supply, or whose home reply
failed, has an unknown saving: left out of the sum and counted "N items without a home price". **No home world:** the
start is the world where the start plan spends most (tie: by name), named "No home world set: the trip starts on
<world>"; that world, its data center and its region take the home's place in 6.4 and in the hop count; `saved` is
unknown. The answer is the total gil still to spend over every kept stop, or "known so far" (D53), with the stops,
region hops, data-center hops and gil saved.

**6.7 Purchases (D33, D34, D46, D47).** "Bought", "Buy part" and "Bought all here" make purchase records
`{ o, i, q, n, of, cr, ls, t, at }` under new ids: `of` = that owner's need in Lists just before; `ls` = a 12-character
fingerprint of the wanted items behind the need and what each asks for (`marketNeeds`' `from`, D14); `t` = the id of
the current trip (`prefs.trip`, 8 random characters; made at the first tick and at every "New trip"); `cr` = units
added to Lists' "I have" (0 when `prefs.tick = 'only'`, the default, and always 0 for the trip's own items). A record
is never changed after it is written.
- **What is left.** Only records whose `t` is the current trip's id count. Own items (`x`): `left = max(0, qty − Σ
  n)`. A character's row: with `unc = Σ (n − cr)` and `last` the newest record (ties by id), the row is **settled**
  while Lists' need now equals `last.of − last.cr` and the wanted items behind it give the same fingerprint as
  `last.ls`; then `left = max(0, need now − unc)`. Otherwise the row is **to check**: its amount left is unknown, it
  is left out of the total (D53), and the answer says "N to check", with "Still count them" (adds a check record:
  `n` 0, the need and fingerprint of now) and "Remove the mark" (asks first; removes the row's records that hold no
  credit). A check record settles a row only while what it states is true now, so two check records that disagree
  can never both settle it: the row is to check and the player is asked again. A different wanted item for the same
  amount, on the same list or another, is to check.
- **Every tick is a guarded write**, also a tick-only one: `CC.writeSections` with `ifRev` = the stamp the page worked
  from. Refused: the page reads again; if the row's need, fingerprint and records are what it showed, it sends once
  more; otherwise nothing is written: "This row changed elsewhere. Check it and tick again." On fallback storage:
  D34's sentence, and no tick.
- **With `prefs.tick = 'lists'`** the same write has two parts: the Bourse records, and Lists' section after
  `LISTS.store`'s own `bought` edit (`lists/store.js`, existing; it returns `{ section, entry, capped }`; `makeKeys`
  empty) on each owner's share; `cr` is the real change of the count (the store caps a count at 999,999; then the row
  says "Lists' count is at its limit: N of M added"). Any Lists refusal: nothing is written, the reason is shown,
  with "Mark without adding to Lists".
- **Receipt and a bounded retry.** The write records `device.bourse.done[<purchase id>] = <time>` in the save's
  device-only part (kept 24 hours), in the same transaction, and its `check` cancels when that entry, the record or
  its undo mark exists. **A retry exists only inside the page that made the tick, for at most 2 minutes and 3 tries**:
  after an unknown outcome the page reads the save; a receipt, the record or an undo mark means it landed (stop);
  none: send again with the same ids. After that, or after a reload, the page never sends those ids again; it shows
  what the save holds and the player ticks anew, under new ids. The receipt therefore always outlives the retry.
- **Undo (status line, and "Undo purchase" in the row's More).** One `CC.writeSections` with `ifRev`: the purchase
  records removed, **`undone[<id>] = { o, i, q, at }` written for each that held a credit**, and `cr` taken from each
  count, only if every count now holds at least its `cr`. An unrelated change that leaves enough is fine (10, +40,
  then 45 typed: Undo leaves 5). Otherwise nothing changes: "Not undone: Lists now counts 20 of <item>, fewer than the
  40 this purchase added." A record that holds a credit can be removed only this way.
- **"New trip"** (More of the Bought group, error role, asks first: "Start a new trip? N marks and M items you added
  are cleared. Lists' counts are not changed.") removes every own item and every record without a credit of the
  current trip, and sets `prefs.trip` to a new random id. Records with a credit stay stored under their trip's id, in
  a closed group "Added to Lists on earlier trips (N)", each still with "Undo purchase". **Two devices that each
  start a new trip get two different ids:** `prefs.trip` is then one setting changed differently on both, so it is
  asked ("Each of two devices started a new trip. Continue with this device's (N marks, M items) or the other's?");
  until answered this device's is current. The other trip's marks and own items stay stored, shown in a closed group
  "From another device's trip (N)", never counted in this trip and never deleted by the app.

**6.8 The trip's own items and the one-time copy (D10, D58).** `extra` holds items added by "Add to trip" or the copy,
each `{ qty, at, t }` with its trip's id; removed only by the player ("Remove from trip", asks first) or "New trip".
The copy: the new Tracker, which alone can turn its entry keys into item numbers, writes on loading
`ui.live.mcopy = { v: 1, at, items: { <item id>: <amount> }, skipped }` into its own device record
(`eveniunt-tracker-ui`; `persist()` already stores `ui.live` whole), beside the untouched `mlist` and `mqty`. An
amount that is missing or not a number of 1 or more counts 1 (what the Tracker showed); two entries of one item are
added; an entry without an item number, unknown to the index or untradable is skipped and counted. The Bourse page, on
opening, reads that record (same site address only) and, if it holds items, sends one `CC.writeSections` whose `check`
cancels when `doc.device.bourse.mcopy` is already set, whose Bourse part is an `edit` that adds each item as
`<item>.nq` to the `extra` stored at that moment (the larger of the stored and the copied amount; over 99,999 becomes
99,999 and is counted) and whose `own.device` sets `mcopy: { at, copied, skipped, capped }`. The line says once:
"Copied N items from the Tracker's shopping list, as normal quality. M could not be matched; K amounts were over the
limit and set to 99,999. The old list is still in the Tracker's storage." No `mcopy` yet: nothing is copied or
recorded, and the next opening tries again. **On fallback storage the copy is not made** (D34); the line reads "The
Tracker's shopping list was not copied: this browser's storage cannot save it safely. It is still in the Tracker's
storage." and nothing is recorded, so a later opening with the main storage copies it.

**Said once (W2):** "You can buy on another world, data center or region you travel to, but you cannot sell there.
Whether you can travel is the game's rule; your travel area is set in Bourse settings. Travel stops 30 minutes before
maintenance. This is a plan from reported listings, not a promise that the route is open or the stock still there."
An all-worlds maintenance starting within 2 hours, or running, becomes the note block with the list's date (D17).
The module opens on Trip when a chosen list has market items or the trip has its own; otherwise on Item.

## 7. Watch list and alerts (on every page)

A watched item is an item, a quality and a target price. On the Watch view, on opening and on Refresh, the `deep`
service prices the list over the travel area; rows fall under "Below target", "Above target", "No price". An item is
**under** when the cheapest listing of its quality in the area (one unit's buyer's cost, D36) is at or under the
target and that world's report (D50) is no older than `oldDays`. An older or unknown age reads "Under, but the price
is old" or "Under, age unknown" and never rings. A region that failed leaves the row "Above target, <region> not
fetched" or "No price", never a plain "Above target".

**The shared checker** (`watch-alert.js`), loaded by Home and Settings, Submersibles, Lists, the Bourse, and the hosted
Tracker and Atelier:
- **Does nothing, and loads nothing more, when** the watch list is empty, `prefs.alerts` is off, the page is hidden,
  the device is offline, a pause is running, the ledger's storage is refused, or the browser has no Web Locks (the
  Watch view then says "Automatic checks are off in this browser."). It reads the save and never writes it. Only when
  there is something to check does it add `prices.js`, `bourse/data.js` and `bourse/services.js`.
- **One round at a time (D40).** The whole round runs inside the browser lock `eveniunt-bourse-watch`, asked for with
  "only if free". Inside the lock the page reads `eveniunt-bourse-alert` (`{ at, round }`); if it is younger than
  `prefs.alertMin` minutes (default 30) it leaves; else it writes the new time and the next round number and runs.
  **A round ends after 60 seconds at most, and that end is an expiry carried by each of its requests, applied three
  times: a request still waiting in the queue is dropped when its turn comes; the dispatch decision (D56) refuses
  it; an answer that arrives later is cached by D56's order but changes no alert.** Requests already open are
  aborted; the lock is given back. A tab that closes frees the lock.
- **A round** asks `deep` once per region for the watched items (at most 6 requests), through the queue, the gate and
  the ledger.
- **What a result belongs to (D57).** The round keeps what it asked for: its number, the area's chosen data centers,
  `oldDays`, and per item the quality and the target. Before loading the price code, before each request and before
  an alert shows or an entry is cleared, the page reads the save again and checks **every one of them**, and: visible,
  online, alerts on, the interval unchanged, no pause, the round still the stored one, the item still watched. Any
  mismatch discards the result for alerts (the prices stay cached). A page hidden mid-round sends nothing more.
- **An alert** is one slim status line on the page that ran the round: "<item> is under your target on <world>: N gil,
  seen <age>. Open" (to `bourse/#item=<id>`), with "Close". **Ring once per crossing, kept per area:** the device
  record keeps `alerted["<item>.<quality>|<area>"] = { target, at }`, where `<area>` is the sorted chosen data
  centers joined (written inside the lock). It rings only when the item is under and no entry exists for that item,
  quality, area and target. **Changing the area neither clears nor moves an entry:** the new area has its own (so it
  can ring once), and returning to an earlier area finds that area's entry and does not ring again. An entry is
  cleared only by complete fresh evidence for its own area: in one round every region of that area answered (usable
  or confirmed empty) for the item, and the cheapest listing of the area is over the target with a known, fresh age,
  or the area is confirmed empty. A failed, unknown, cut-off or old result changes nothing; a cheaper offer that
  moved to another world of the area is the same crossing. A changed target is a new crossing. Entries untouched for
  30 days are dropped. On a phone the name wraps; the world, price and age are never cut.
- **A page works without it.** If the script or the price code fails to load, nothing else changes.
- The Watch view and the sheet say: "Alerts ring only while this app is open in a tab. While it is open, it checks your
  watched items every N minutes, on any page. Turn this off under Alerts." No notification permission is asked.

## 8. The save: section `modules.bourse`, version 2, the guard, and the cloud copy

```
{ v: 1,
  watch:  { "<item id>.<nq|hq>": { target, at } },
  extra:  { "<item id>.<nq|hq>": { qty, at, t } },                     the trip's own items
  bought: { "<purchase id>":     { o, i, q, n, of, cr, ls, t, at } },  o: c1..c8, u, or x (own item); q: nq|hq
  undone: { "<purchase id>":     { o, i, q, at } },                    a credited purchase that was undone
  prefs:  { area: { <data-center name>: 1 }, home, oldDays, dropDays, split, within, route, tick, gatherFree, taxCity,
            rankBy, alerts, alertMin, trip, lists: { <list id>: 1 } } }
```

- **Checker `CC.checkBourse`**, added to `CHECK`: always the whole frame in that key order; no arrays; no size limit;
  an entry is dropped only when malformed (bad key; no `target`; no `qty`; a purchase or undo mark without `o`, `i`
  or `q`; a purchase without `n`); a bad field is left out, never repaired. A purchase id and a trip id are 8 to 16
  of `a-z0-9`. Ranges: `target` 1 to 999,999,999; `qty` 1 to 99,999; `n` 0 to 999,999 (0 is a check record); `of` 0
  to 999,999; `cr` 0 to `n`; `ls` 12 of `a-z0-9`; `oldDays` 1 to 30; `dropDays` 1 to 90; `within` 0 to 100;
  `alertMin` 15 to 240; `split` `fewest|cheapest|within`; `route` `savings|items`; `tick` `only|lists`; `rankBy`
  `sales|listing`; `area` keys 1 to 32 letters with the value 1; texts up to 40 characters. A default is not stored.
  A purchase that arrives without `ls` or `t` (a hand-made or partial import) is kept and its row is to check; a
  purchase whose `cr` is over 0 while Lists holds no count for its owner and item is kept and its pair is asked
  (BY2). Page limits (edit functions only; the save may hold more, section 6.5): 200 watched, 500 own items, 2,000
  purchases of the current trip. `LABEL.bourse = 'Bourse'`; `describeUnit` words: "Bourse: watched item <name>
  (target N gil)", "Bourse: an item added to the trip (<name>, N)", "Bourse: a purchase of <name> (N)", "Bourse: an
  undone purchase of <name>", "Bourse setting: <plain name>" ("which trip is current" for `trip`).
- **Merge, in pages that run the new code.** Units are two levels down. Changed on one side: taken. Changed
  differently on both: asked. **BY0** (`merge.js`; it runs whether or not the save holds lists): removed on one side
  and changed on the other: kept, asked until answered; `ET.applyMerge` with no choice keeps it. Purchases and undo
  marks are never edited. **BI1** (`CC.writeSection`): a unit the page removed that the stored copy holds with
  another value is refused. **BI2:** `known.expect`.
- **Credits in a merge: rule BY2 (D46, D62).** For one owner and item, the **pair** is its Lists count and every
  purchase record and undo mark of that owner and item. Per quality: `credits(X)` = the sum of `cr` over the records
  side X holds; `own(X) = count(X) − credits(X)` (it may be negative: the player used bought stock). Ticks and Undo
  change the count and the records together, so they never change `own`; only a typed count does.
  1. **Records.** A record on either side is kept. A record the base held that one side lacks is removed **only when
     that side holds its undo mark**. A record one side lacks **without an undo mark** is unexplained (a partial
     restore, a dropped entry): **it is never taken as an Undo; the pair is held (step 4).**
  2. **Own part.** Changed on one side, that side's; changed the same on both, that; changed differently on both,
     asked, this device's until answered, the question showing each side's own part plus the merged credits, which
     are the two counts as the player would see them. This keeps the rule: count = own + credits.
  3. **Count** = own + credits of the records the merge ends with, **when that lies within 0 to 999,999**.
  4. **Otherwise the pair is held.** Nothing of the pair changes on this device: its count, its records and its undo
     marks stay exactly as they were, a state that kept the rule before and keeps it now. The save's device-only
     part records `device.bourse.held["<owner>.<item>"] = { why, at }` (`why`: over the limit, under 0, a missing
     record). **While that entry exists, every later merge leaves this device's pair alone, whatever the other side
     holds, and raises the question again:** "Lists' count of <item> and the purchases that added to it differ
     between your devices and cannot be combined (<reason in words>). Use this device's count and purchases, or the
     other device's?" Either answer installs one side's whole pair, which keeps the rule, and clears the entry. No
     answer: nothing changes, on any number of syncs and reloads. The Bourse row and Lists' Settings line show "an
     open question about <item>" until then.
  It touches only pairs for which some side holds a credited record or an undo mark; every other count merges exactly
  as today. **Where it runs:** in `ET.threeWay` (which is given the held entries and keeps the own parts in its
  result) and at the end of `ET.applyMerge`, after every choice. Those two serve the cloud sync from the Tracker
  (`cloud.js` lines 201, 218, 221), the Tracker's same-device save (`ET.saveMerge`, `storage.js` line 111), the
  Tracker's reconciliation after a save, and Settings' sync (`settings.js` line 321). **It does not run when a backup
  or a transfer code is loaded: that replaces sections (D62).** The three places that handle a pair without merging
  it are bound to it by their own rules:
  - **A loaded backup or code** (`adoptLoaded`): the credited records and undo marks are taken from wherever the
    Lists section is taken (D62); the question becomes "Replace everything on this device with this backup (…)? The
    purchases the Bourse added to Lists here are replaced with it." The sync base is forgotten as today, so the next
    sync merges with no base and asks.
  - **Settings' base after a clash** (`settings.js` lines 324 to 332): putting a count back into the base as it was
    at the start puts every record and undo mark of that owner and item back as they were at the start, in the same
    step, so the next sync sees the whole pair's difference again.
  - **A page's own section write** (`CC.writeSection`, which merges one section and cannot see both): **rule LI6:** a
    Lists write that would keep its own value of a count over a different stored one is refused, "This was changed on
    another device or in another tab since.", **whenever the stored save holds, for that owner and item, a credited
    record or an undo mark**. The undo mark is what keeps the guard alive after the last credit is gone: a page that
    still shows 50 cannot write 51 over the 10 an Undo stored. The Bourse's own writes never merge (`ifRev`).
  Named tests (item B26), each through the real cloud path and the real local path with no choice given, each with
  its control: **"equal credits"** (10; each device adds 40 under its own purchase and stores 50: merged 90, two
  records; Undo of either leaves 50); **"unequal credits"** (10; +40 and +25: 75); **"Undo against a typed count"**
  (50 with a 40 credit; Undo here, 45 typed there: 5, the record gone, its undo mark kept); **"under 0"** (the same
  with 20 typed there: held; this device keeps 10 and no record, the other keeps 20 and its record; three more syncs
  and a reload change nothing and ask each time; each answer gives a pair that keeps the rule); **"at the limit"**
  (999,990; each device adds 9 and stores 999,999: held on both; after any number of syncs each device still has
  999,999 with its one record, and Undo on each gives 999,990, not 999,981; control: from 999,980 the same merges to
  999,998 with no question); **"a missing record"** (the base and one side hold a 40 credit, the other side shows 50
  and no record and no undo mark: held, the record is not removed anywhere); **"an ordinary typed edit"** (a count
  with no credit and no undo mark merges byte for byte as today).
- **Version 2 and older copies (D32, D60, D61).** `CC.VERSION` becomes 2 in the release D60 allows. New code reads
  version 1 and 2 and always writes 2; the cloud copy, the backup file and the transfer code carry it. Older pages
  refuse a newer save in shipped code (`CC.checkDoc`, `save.js` line 209; the Tracker's save, `storage.js` line 269;
  the sync's read, `cloud.js` lines 164 and 170), so they never merge one. **Not every older writer refuses.** The
  inventory, from the code read so far (B28 completes it at the real base; B24 tests each line):

  | Older writer | Over a version 2 save | Answer |
  | --- | --- | --- |
  | Tracker "Erase everything" (`ET.clearState`, `storage.js` 292 to 305; `ui.js` 1011) | **Writes an empty save: every module is wiped** | B29 fixes it first (D60); the guard restores (D61) |
  | Tracker's ordinary save, also after a loaded backup, code or desktop file (`adoptLoaded`, `deskImport` → `ET.saveState`) | Refuses (`storage.js` 269); its toast does not name the cause | Tested as it is |
  | Tracker "go back" and the first move (`ET.goBack`, `moveOld`) | Refuse: their read throws | Tested as it is |
  | Tracker's sync: a read first | Refuses before merging or uploading | Tested as it is |
  | Tracker's sync: no cloud file seen, and the owner's "replace the cloud copy" | Upload with no condition (`cloud.js` 193, 228) | D48, D63: caught at the next sync, nothing removed |
  | Atelier, Lists, Submersibles, Settings (their section writes; Settings' sync) | Refuse | Tested as they are |
  | Rescue copies and other extra records (`CC.putExtra`) | Add a record, never touch the save | Tested as it is |

  **What each older page shows** (B0; shipped, cannot be changed): the **Tracker**, on opening, a dialog "Saved data
  could not be read … (This save was written by a newer version of the app. Reload the page to update.) A copy has
  been kept.", storing one more rescue copy each time; a tab already open fails its next save with "This browser did
  not let the tracker save. Save a backup file now". **The Atelier shows nothing** and silently stops saving to the
  shared save. **Home** shows "Getting started" as if empty. **Lists, Submersibles, Settings** say the save cannot be
  used and that nothing was written over it. An older Tracker's sync says "The cloud copy was saved by a newer version
  of the app. Reload this page to update, then sync again." Recovery: one reload of each open page while online. The
  release note (B12) says: "After this update, reload every open page of the app once. An old Atelier tab gives no
  warning."
- **The guard (D61).** `CC.transact` in new code stores, with every version 2 save and in the same transaction,
  the same data under `main-guard` and its stamp under `main-guard-rev`. `CC.read` and `CC.transact` compare before
  anything else; "replaced" (D61's test) raises an error with the code `replaced`, which every page turns into the
  restore offer, and under which no page writes. Restore and "keep" are the only writes allowed then. Named tests
  (item B30): **"erased by an older Tracker"** (the files at `<old0>`: their "Erase everything" over a version 2 save
  writes an empty save; the new page opens with the offer; Restore gives back the guard's data byte for byte and
  keeps the empty save under its own key; control: a version 2 save with its own guard opens with no offer);
  **"keep"** (asked twice, then the empty save is adopted and guarded); **"no page writes meanwhile"** (a Lists edit
  and a Bourse tick are refused while the offer is open; control: both write once it is answered); **"no guard on
  fallback when space is short"** (the save succeeds, nothing is offered later: the stated limit).
- **Every write path the Bourse work adds or changes** (each named in an item): section writes of watch, own items
  and settings (`CC.writeSection`, B13); ticks, check records, Undo, "New trip" and the copy (`CC.writeSections`
  with `ifRev`, B21, B10); the guard and the restore (B30); the erase (B29); the cloud upload's conditions and
  lineage (B27); `adoptLoaded`'s pair rule and Settings' base (B26). Nothing else writes the save.
- **The cloud copy (D48, D63), `tracker/src/core/cloud.js` and its two callers.** Read in the code: `upload` sends
  `If-Match` only when it has an `eTag` and always asks OneDrive to replace (lines 143 to 148); `ET.cloudSync` uploads
  without a condition when it found no file (line 193); `ET.cloudOverwrite` too (line 228), after `ui.js` asked the
  player about a copy read earlier (lines 1183 to 1184). New code:
  1. **No replace without a tag.** `upload` refuses to send a replace that carries no `eTag`: the one unsafe write is
     not sent at all.
  2. **Create, then read back.** With no file found, the upload asks OneDrive to fail when the file exists
     (`conflictBehavior=fail`) [verify]. "Already exists": the sync starts again, reads and merges. **After a create
     that succeeded, the copy is read again; if its copy id is not the one just written, another device won the
     race: the copy read is merged (with no base) and written back with its `eTag`.** Safety does not rest on the
     service honouring the create condition: a create that was silently replaced later is caught by rule 4.
  3. **The owner's overwrite replaces only the copy the question was about.** The "damaged" error carries that copy's
     item id and `eTag`; the question is asked with them in hand; `ET.cloudOverwrite` sends that `eTag` and writes
     nothing when it has none. "Changed since" (another device repaired or replaced the copy while the question was
     open), a missing tag or another item id: **nothing is overwritten; the sync reads again**, merges if the copy is
     now sound, and asks again, about the new copy, only if it is still damaged.
  4. **Lineage (D63).** Every upload carries its copy id and its line. A copy that is not a known descendant is
     merged with no base. One question tells the player why when the copy came from an older app: "Another device,
     still on an older version of the app, replaced the cloud copy. Nothing was removed here; where the two differ
     you are asked." The merged copy is uploaded as version 2 with the `eTag`, after which the older device is
     refused until it updates.
  **Who verifies the create condition, and when:** B27's builder records what Microsoft's documentation says for this
  kind of upload; **the owner, or the orchestrator with the owner present, tries it on the real personal OneDrive
  before the version-rising release ships** (two browsers that both set up sync in the same minute; the result is
  written in `docs/STATE.md` by B12). Rules 1, 2's read-back and 4 hold whatever the outcome.
  Tests in item B27 ("older" names its commit): **"missing-file race"** (`<old>` finds no file; the newer device
  creates; the older uploads over it; the newer syncs: no unit removed with no choice given, differences asked, the
  upload is version 2, the older device's next sync is refused); **"the create condition ignored"** (the stand-in
  lets two new devices both create: the loser's read-back, or its next sync, merges with no base and nothing is
  lost); **"same-version replacement"** (a version 2 copy with a foreign line: no base, nothing removed; control: a
  true descendant merges with its base and takes a removal); **"missing checkpoint"** (the device's record lacks the
  copy id, or names another item id: no base); **"restored checkpoint"** (a device restored from a backup: the base
  is forgotten, so no base; and a device whose record is intact but 201 uploads behind: no base); **"repaired while
  the question is open"** (device A is asked about a damaged copy; device B replaces it with a sound one; A says
  yes: nothing is overwritten, B's copy survives byte for byte and is merged; control: with no second device the
  overwrite goes through with the shown copy's `eTag`); **"no tag, no replace"**.
- **On the device only:** every price, sale, tax rate and attempt time (`eveniunt-bourse-prices`), the ledger
  (`eveniunt-bourse-ledger`), `eveniunt-bourse-device` (last view, which alerts rang), `eveniunt-bourse-alert`, the
  guard, and in the save's device-only part `device.bourse` (`mcopy`; `done`, the purchase receipts of the last 24
  hours; `held`, the open pair questions; never in backups, codes or the cloud).
- **Rebuild:** `save.js`, `merge.js`, `storage.js`, `cloud.js`, `codec.js`, `one-look.css`, the header's page list,
  `live.js`, `ui.js`, `settings.js` and the hosted-only code of the Tracker and the Atelier change, so the Tracker
  (`tracker/dist`, `tracker/site`), the Command Center (`tracker/command-center/site`) and the Atelier
  (`crafting/atelier/dist`, `site`) are all rebuilt, for B29's release and again for the module's.

## 9. Screens

As **look v3 of `docs/bourse-look-spec.md`** and its pictures (approved, rounds five and six), including the states
page, plus D22 and D31. Fixed here: the header word is "Bourse", between Lists and Settings in the page list
(`tracker/tools/one-look-header.js` `MODS`), tool slot "Bourse settings" and, on Item, "Find an item"; Home gains a
card (live line "N watched" or "Nothing watched yet"); an age is written "14 min", "3 h", "2 days"; the Item screen's
answer is "each, for N" by D36, with the world and age, and the ladder's figures are "per unit in this stack"; the
Trip's answer follows D53. On a phone the quality switch (Item) and the ranking switch (Profit) are reachable in the
settings sheet or the head's More. The standing sentences are decided as written (round six): foot "Prices are
community reports collected by Universalis from players' game clients. Each one says where and when it was seen and
can be gone when you arrive. This app reads nothing from the game."; Profit "An estimate from reported prices, after
market tax. Not a promise." and the sentence of D29; the travel sentence of section 6; the alert sentence of section
7. "Solve" appears only for a recipe not in `LISTS_DATA.noHandOver` and links `../atelier/#recipe=<id>` (CC-09).
**States to be drawn by the look's owner before B11** (existing parts only). Rounds one and two: a row "to check" and
its count; "made without <region>"; "approximate"; "A quick split"; both "only … listings" labels; "N items without a
home price"; the copy's line; "known so far" with what is missing; "Nothing left to buy"; "kept: without it the trip
would cost more than your X% allows"; "reference total (approximate)"; "at least N a day"; "cost unknown: only N of M
listed"; "normal quality (from the Tracker's list)"; "Added to Lists on earlier trips (N)". Round three: a required
stop in another region inside the total; "cheapest seen (… not covered)" and "partial"; "priced from a restricted set
of listings"; the second profit figure with its sample; stops, region hops and data-center hops on one phone line;
"This browser cannot coordinate tabs, so the Bourse cannot ask for prices here."; "Marking purchases is off in this
browser…"; the restore offer; the held-pair question and "an open question about <item>"; "From another device's
trip (N)" and the two-trips question; the older-app cloud line; the copy not made on fallback storage. Every amount
on the states page comes from D36's helper.

## 10. Work items

**Order of running, after the gates of the ledger's "Order":** (B0 and B1 are done) B28, **B29 (released by itself)**,
B2, B18, B3, B23, B30, B24, B26, B27, B4, B5, B16, B17, B13, B6, B19, B20, B7, B21, B25, B14, B8, B9, B15, B10, B22,
B11, B12. (B13 to B15 were added by the red team and round two of the owner; B16 to B25 by round one of the review;
B26 to B28 by round two; B29 and B30 by round three. Numbers are stable.)

**Every builder item:** branch `bourse` (B29: branch `erase-fix`); only the named files and rebuilt copies; `npm run
build` twice, the second exits 0 and `git status --porcelain` is empty after the commit; `npm run test:unit`; never
merge. **Paths, written in full once:** `src/` = `tracker/command-center/src/`; `check.js` =
`tracker/command-center/check.js`; `build.js` = `tracker/command-center/build.js`; `bourse.js`, `bourse.css` =
`src/bourse/bourse.js`, `src/bourse/bourse.css`; a file marked (new) does not exist at `<base>`; every other named
file does; `dist/` and `site/` copies are generated, never edited by hand. **Tests (D45):** each new assertion is seen
failing without its change (a temporary revert, reported). **Guards**, reported as "guard, passed before and after":
PR-1 to PR-5, PX-7, BS-3a, BW-1, BN-1, BK-7, BV-1 to BV-3 and BV-7. Every negative assertion names its positive
control in the same test. Browser checks answer `universalis.app` with a stand-in that counts requests per region,
and route `lists/data.js` to `tracker/tests/fixtures/lists-fixture.json` unless "real data". Pinned commits: D59. New
check ids start at C197.

- **B0 Baseline and facts (Haiku clerk). Done 2026-11-25**: `docs/bourse/b0-report.md`, section 15. It ran at
  `d7322c7`, before the module moves. It read the save paths and **missed the erase path** (D60); it did not map the
  price-site stand-ins of `check.js` to their checks and did not read the desktop-file import: all three go to B28.
- **B1 Saved replies (Sonnet builder). Done 2026-11-25**: fourteen files and `README.md` in
  `tracker/tests/fixtures/universalis/`, `tracker/tests/bourse-replies.test.js` (12 tests after the requester's
  redaction change, as the requester reports). The requester corrects the README's tax paragraph (section 15).
- **B2 Price service: queue, options, readers (Sonnet builder; after B28).** Files: `src/prices.js`,
  `tracker/tests/prices.test.js` (PR-1 to PR-5 unedited and, as a guard, Lists' and Submersibles' services never
  touch the queue or the ledger; PX-1 queue, with a fake clock and a queue that is drained under control: 60 calls
  made at once; starts are never under 300 ms apart and never more than 2 are in flight; while 40 wait, further calls
  resolve "not fetched", and a call made after the queue drained is sent; PX-2 pauses, with D4's lift rules and the
  doubling; PX-3 `PRICE.idb`: two places and two services apart, two writers of one record each keep the other's
  items; PX-4 `readDeep` on the fixtures: per world and quality, cheapest first, asking price and `cost` apart, world
  and time on every sale, no names or listing numbers kept; PX-5 `readSlim`; PX-6 `maxRequests`; PX-7 defaults give
  today's URL and limits; PX-8 `placePath` and `strict404`; PX-9 outcomes: a "malformed success" is failed and keeps
  the last good value as stale, beside a well-formed one that is stored; a "capped high-quality-only slice" gives
  ordinary = unknown; bad entries dropped and counted; an old four-part record is unknown; PX-10 a reply over
  `maxBytes` is failed and stores nothing, beside one just under it that is stored; **"split once": a batch over the
  cap is asked again as two halves, both charged, and a half still over the cap is failed with no third request**;
  PX-11 times: old, missing, 0, in the future, seconds against milliseconds; PX-12 "world reply"; PX-13 "confirmed
  empty" and "Oceania zero minimum"; **PX-14 "late answer", by order number: a lower-numbered failure and a
  lower-numbered success arriving after a higher-numbered success change nothing, also with equal clock times and
  with the clock set back between them; a deadline passed is failed; control: a higher-numbered answer replaces**).
  Accept: unit suite; `CHECK_ONLY=C113,C117,C155 npm run check` unchanged. Escalate if: PR-1 to PR-5 need an edit.
- **B3 Save section and version (Sonnet builder; after B29).** Files: `tracker/src/core/save.js` (`checkBourse`,
  `CHECK`, `LABEL`, the labels, BI1, BI2, `CC.VERSION = 2` with `checkDoc` reading 1 and 2),
  `tracker/src/core/codec.js` (the backup's and the transfer code's version rise; old ones are read),
  `tracker/tests/core.test.js` (BS-1 checker table: every range and enum, ids, a check record, an undo mark, a
  purchase without `ls` or `t` kept, a credited purchase with no Lists count kept, `area` keys with a space or a
  digit dropped, the whole frame; BS-2 round trip through `unflatModules`; BS-3a (guard) new code reads a version 1
  save with every field unchanged; BS-3b new code writes version 2; BS-4 BI1 refused, with a control; BS-5 two tabs
  on different watched items both kept; BS-6 BI2; BS-7 a new backup and a new code are refused by the files at
  `<old>` with their shipped sentences and read by new code; an old backup and an old code are read by new code;
  BY-4 the labels word for word), rebuilt copies. Accept: unit suite; `CHECK_ONLY=C119,C122,C145,C146 npm run
  check`. **The release holding this item ships no sooner than 30 days after B29's (D60).** Escalate if: an existing
  test needs an edit other than an expected version number.
- **B4 Shared look (Haiku clerk).** Files: `tracker/src/app/one-look.css` (`.ol-r-gil`, copied from `bm-r-gil` in
  `docs/bourse/mock/bourse-mock.css`), `tracker/command-center/one-look-fixture.html` (one gil block),
  `tracker/tests/one-look.test.js` (the role exists; ink on `--gil-m` reaches 4.5:1 in every appearance the file
  already tests), rebuilt copies. Accept: the test fails before, passes after; `CHECK_ONLY=C196 npm run check`.
  Escalate if: the contrast fails or another role's computed value changes.
- **B5 Price math (Sonnet builder; after B2).** Files (new): `src/bourse/market.js`, `tracker/tests/fixtures/
  bourse-fixture.json`, `tracker/tests/bourse-market.test.js` (BM-1 median, even and odd, 7 days, none is unknown,
  joined over three regions; BM-2 profit by hand for three crafts, both sale bases; BM-3 unknown material or sale is
  never 0 and never ranked, beside a priced one that is; BM-4 gathered at market and free; crystals; yields; an
  unknown part, a fifth level and a loop are "Missing a price"; **BM-5 tax (D36): "the saved small stack": the saved
  listing of 3 at 12 (`region-batch`, item 44001: total 36, tax 1) costs 37; "per stack", a made-up case named so:
  two stacks of 35 at 1 cost 36 each, 72, not 73; "field differs": a stand-in `tax` of 0 or of a wrong amount changes
  no cost and is counted; "merchant crossover"; "tie"; "three figures": for one listing at 1,000 the sale basis and
  the seller's proceeds start from 1,000, never from the buyer's 1,050, while the same listing as a material costs
  1,050; "each, for N": 6 needed from whole stacks of 4 at 18,900 and 2 at 19,000 cost 119,280 with tax and read
  19,880 each; when the whole stacks hold more than needed (4 and 3 for 6), the row says "buys 7" and the cost covers
  all 7; the cheapest stack's own unit cost is labelled apart; the seller's rounding; a city rate of 0; lowest and chosen city; the
  labelled 5%**; BM-6 old, too old, unknown age; slow sellers; bait; "no cost"; "thin data"; fewer than 3 sales is
  not ranked; **BM-7 D49: "excluded world"; "one region not covered": North America shows a listing at 100, Europe's
  slice is cut and holds none of the area: the figure reads "cheapest seen (Europe not covered)", the craft wears
  "partial", and it is not called the cheapest listing; control: Europe proved none: "cheapest listing"; no region
  seen: "unavailable"**; BM-8 D44: 40 sales in one hour read "at least 5.7 a day"; 82 sales in 7 days read 11.7 a
  day; BM-9 D53: a recipe whose material is listed 3 of 5 has an unknown cost, beside the same recipe fully listed;
  BM-14 a narrowed area leaves its worlds out of every figure; a failed region is named), `package.json`. Accept:
  unit suite. Escalate if: a rule cannot hold as written.
- **B6 Page shell (Sonnet builder; after B13).** Files (new): `src/bourse/{index.html,bourse.css,bourse.js}`;
  `build.js` (copy the page's files only); `tracker/tests/one-look.test.js` (`bourse.css` joins the sheets the drift
  test reads and must not contain `--gil-m` or `ol-r-market`, with a control sheet that does and fails). Steps: the
  header, the views' tab bar, the settings sheet (seven data-center boxes, the home-world picker by D41, one
  threshold field, the default mode Trade-off; the "Also add to I have in Lists" switch only when
  `BOURSE.CREDIT` is true, the one constant of `store.js` that B26's outcome sets), empty states, the status line,
  reading the Lists data (packed or plain), saving through `store.js`, the restore offer of D61. Accept: unit suite;
  `npm run test:browser`; check C213 (the built page, served by the check's own server, opens with an empty save and
  shows the empty trip; home world from each of D41's three sources, the second worded without a character's name).
  Opening offline is B20's. Escalate if: look v3 lacks a part the shell needs.
- **B7 Trip view (Sonnet builder; after B20).** Files: `bourse.js`, `bourse.css`, `check.js` C202 (stand-in replies
  for three regions and the home world: the three modes give the hand-worked stops and totals; a region removed at
  the threshold and kept one gil over; "one allowance" as BP-12; **"a required stop counts": an item listed only in
  another region: its stop is kept, its cost is inside the total, and the figure is "total still to spend";
  control: the same trip with that region failed reads "known so far" and names what is missing**; the route starts
  at the home world and the three counts match BP-9, on the phone on one line; no home world: the first world named;
  "Nothing left to buy"; overshoot wording; "one offer in both replies" as BP-11; "made without <region>"; "Only high
  quality is listed"; a joined row for two characters; the travel sentence and the maintenance note with its date;
  **requests counted on a cold cache for 100 items: exactly 4 (three regions and the home world), then a reopen
  within 15 minutes sends none**). Accept: `CHECK_ONLY=C202 npm run check`. Escalate if: a state of section 9 is not
  in the look.
- **B8 Profit (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C200 (opening sends 1 to 3
  requests; one press at most 12; never over 2 in flight; then a reload within 15 minutes sends none; the budget
  disables the main action with its sentence; a 429 pauses and says so with its end; three failures while connected
  pause, and the same three while offline leave no pause), C201 (the fixture's figures equal BM-2; **one row shows
  both sale bases, each with its own profit figure, and the sample, at 1,440 and at 360 px with nothing cut**;
  "cheapest seen (… not covered)" with "partial"; "unavailable" and the row not ranked by it, beside a row that is;
  the sentence of D29 once; the opened row's home figures and "cost unknown"; "of N ranked"; the five closed groups;
  "no cost"; a negative profit; the bait flag; "Solve" present for one recipe and absent for a no-hand-over one; the
  tax list, and the labelled 5%). Accept: `CHECK_ONLY=C200,C201 npm run check`. Escalate if: a pass over real data
  draws slower than 1 second.
- **B9 Watch, and "Copy name" (Sonnet builder; after B14).** Files: `bourse.js`, `bourse.css`, `check.js` C203 (three
  groups; "Under, but the price is old"; "Under, age unknown"; "Above target, <region> not fetched"; the alert
  sentence; adding, changing, removing; over the limit; at 360 px the longest name wraps and the world, price and
  age are whole; **the no-coordination line, in a browser stand-in without Web Locks, at the same viewport as a
  normal run that does fetch**), C210 (D42, on each of the four views). Accept: `CHECK_ONLY=C203,C210 npm run
  check`. Escalate if: the view needs B15.
- **B10 The Tracker's link and the copy (Sonnet builder; after B6).** Files: `tracker/src/app/live.js` (D9; `mcopy`
  by 6.8), the Tracker tests B28 lists (those pinning the Tracker's price requests become tests of the link and of
  `mcopy`; no stand-in of another page's check is touched), `bourse.js` (the copy on opening),
  `tracker/tests/bourse-copy.test.js` (new: BC-1 `mcopy` from a list with a duplicate item, an unmapped entry, an
  untradable one, amounts 0, missing and 1,000,000; BC-2 every copied key ends in `.nq`), `check.js` C204 (control: at
  `<old>` the Tracker does ask the price host under this fixture; now it asks nothing; the link opens the Bourse;
  `mlist` and `mqty` byte-identical; the copy reaches the save once with its counts and "as normal quality"; "crash";
  "two tabs", in one browser profile, where the storage is shared; "late"; "a larger amount saved meanwhile";
  **"fallback storage": no copy is made, the line of 6.8 shows, nothing is recorded, every stored amount is byte for
  byte as before, and with the main storage back the next opening copies**; the downloaded file shows the moved line
  and no price), rebuilt copies. Accept: `npm run test:browser`; `CHECK_ONLY=C204 npm run check`. Escalate if: the
  hosted Tracker and the Bourse do not share device storage.
- **B11 Look checks and pictures (Sonnet builder; after B7 to B9, B14, B15, B21).** Files: `check.js` C206 (the limits
  of look v3 and the design rules on Trip, Item, Profit, Watch, **the real settings sheet opened over a view**, the
  empty trip and every state of the states page, at exactly 1,440 x 1,000 and 360 x 800, in the light and the dark
  appearance, real data with stand-in prices, the three longest item names, five-digit counts, gil in the millions.
  Rows are counted only when wholly inside the area left by the fixed header, the bottom bar, the seal bar, the
  status line and a shown alert, once with a live alert over the normal screen. It also measures: an opened row; in
  the sheet, every control's size, that the last control can be reached and that Close and Escape work; no figure,
  name, world, price, age or second profit figure cut; the Item search field at least 160 px wide at 360 px; the same
  at 200% text size; where the first row starts; one primary and at most primary, More and one stepper per row; no
  data-face text without a digit; no age as "14M"; no configuring field at rest but "Find an item"; reading text at
  the house sizes; the status and alert line's form with Close and the age; 40 px targets; visible focus on every
  control; no sideways scroll; every computed colour a tone of a role, never the market role, gold on gil bars only),
  C196 (the Bourse page joins), evidence `bourse-*.png` in `docs/bourse/build/` (new folder) with `notes.md`. Accept:
  `CHECK_ONLY=C196,C206 npm run check`; five planted faults each fail C206 and the unplanted page passes (a third
  bordered button; a row pushed under the bottom bar; a name cut; the search field squeezed; the second profit figure
  cut on the phone), reverted and reported. Escalate if: a limit cannot be met without changing the look.
- **B12 Full run and records (Haiku clerk; last).** `npm run build` twice, `npm run test:unit`, `npm run test:browser`,
  `npm run check`, at the head that would ship; the entry in `docs/STATE.md` under "Built, waiting for the owner's
  `ship`": the commit tested, `<base>`, `<old0>` and `<old>`; **B29's release date and that 30 days have passed**;
  **the result of the owner's try of the create condition on the real OneDrive, or that it has not been done**; what
  was and was not tested (the live price site, Firefox, Safari, a real phone, a real two-device sync); what now runs
  while the app is open (the watch checker on every page) and how to stop it; the save's new version, what each older
  page shows, the reload sentence and the restore offer; whether the Lists setting was built (B26) or left out; a
  pointer to the eight owner rounds and the outside review rounds; the stale lines of `docs/STATE.md` "Next"
  replaced. Accept: git clean; counts reported. Escalate if: any failure, or the 30 days have not passed.
- **B13 The store (Sonnet builder; after B3, B23, B17).** Files (new): `src/bourse/store.js` (pure edit functions:
  watch, own items, settings and the area, purchases by D33 and D47 (make, the check record, remove uncredited,
  Undo's two sections with the undo mark, "New trip" with a new trip id), the copy's `edit`; the constant
  `BOURSE.CREDIT`, false until B26 passes: while false, no edit ever gives a credit), `tracker/tests/
  bourse-store.test.js` (BT-1 every edit and its limit, a default not stored; BT-2 the copy's edit; BT-4 "New trip":
  uncredited records and own items of the trip go, credited records stay under their trip's id, a new id is set;
  **"two new trips": two devices each start one from the same save; after the merge `prefs.trip` is asked, each
  device's marks and items carry their own id, none counts in the other trip, none is deleted; either answer keeps
  both sets stored**; BT-5 a tick shared across characters makes one record per owner; BT-6 the area; BT-7 no edit
  changes an existing purchase record or undo mark, and none removes a record except the three named edits, each of
  which does; **two check records that disagree leave the row to check**; BT-8 a section over the page's limits is
  read, shown and editable downwards, and refuses only additions; BT-9 with `BOURSE.CREDIT` false a stored
  `tick: 'lists'` is read as tick only and stays stored, beside the same edit with the constant true, which
  credits), `package.json`. Accept: unit suite. Escalate if: an edit needs a field the checker does not hold.
- **B14 Item (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C199 (every price names its
  world and age; every world of the area, by region and data center; the answer "each, for N" by D36 with world and
  age, and the ladder's "per unit in this stack"; listings and sales apart; a world missing from a cut reply reads
  "not among…", a world with a report time of 0 reads "age unknown", and "none" only in a fixture whose reply proves
  it; the home world's rows from the world reply; "listed <age>" beside the report age; a failed region "not
  fetched"; qualities never mix; ages in words; the screen before a search; history by D43; **requests counted on a
  cold cache: exactly 7 with a home world (the seventh is the home world's listings) and 6 without; with the home
  reply already cached and fresh: 6**). Accept: `CHECK_ONLY=C199 npm run check`. Escalate if: a rule of D50 to D52
  cannot be shown with the look's parts.
- **B15 Alerts on every page (Sonnet builder; after B9).** Files: `src/watch-alert.js` (new), `build.js`, one script
  line in `src/{index,submersibles/index,lists/index,bourse/index}.html`, the hosted-only code of
  `tracker/src/app/ui.js` and `crafting/atelier/src/atelier.js` at the places B28 reports,
  `tracker/tests/bourse-alert.test.js` (new: BA-1 the lock: two pages asking together run one round; a time younger
  than the interval runs none; no Web Locks runs none; BA-2 nothing loaded or sent with an empty list, alerts off,
  hidden, offline, paused or ledger storage refused, each after a control round that does send; BA-3 one ring per
  crossing, shared, after a first round that does ring; BA-4 no ring for an old or unknown age; BA-5 a round is at
  most 6 requests; BA-6 "hidden mid-round"; BA-7 re-arm, with "partial above target"; BA-8 a target changed
  mid-round shows no alert for the old one; BA-9 "area narrowed mid-round"; BA-10 "hung request"; **BA-11 "age limit
  changed mid-round": `oldDays` lowered so the listing is now old: no ring; control: unchanged, it rings. BA-12 "the
  round ended while a request waited": at 60 seconds a request still in the queue is never sent, also when its turn
  comes later; one refused at the dispatch decision is never sent; control: the same request inside the time is
  sent. BA-13 "back to an earlier area": rings in area A, the player narrows to B (B may ring once), returns to A
  while still under: no second ring in A; A's entry was never cleared by B's rounds**), `package.json`, `check.js`
  C207 (on each of the seven pages a watched item under its target raises one alert line with Close and the age, and
  its link opens the Item view; two tabs send one round; then the negatives; with the script refused each page still
  passes its opening check; the downloaded files do not contain the script's name while the hosted ones do), rebuilt
  copies. Accept: unit suite; `npm run test:browser`; `CHECK_ONLY=C9,C196,C203,C207 npm run check`. Escalate if: a
  page's policy refuses the script or the price host.
- **B16 Trip math (Sonnet builder; after B5).** Files (new): `src/bourse/trip.js`, `tracker/tests/bourse-trip.test.js`
  (BP-1 buying an amount; BP-2 "ten units, cheap split": 273 with tax, never 1,050; BP-3 "2,001 units": 6,303 with
  tax, labelled approximate; BP-4 ties, and "the last stack changes the choice"; BP-5 the three modes on a
  hand-worked table; BP-6 the threshold edge; BP-7 "sole supply" with both labels, **and its cost inside the
  total**; BP-8 cover; BP-9 route order and hops from the home world; no home world; an unknown saving; BP-10 the
  budget: with `EVAL_MAX` 10 the plan is complete, valid, labelled and identical whether stepped by 1 unit or by a
  million; **a step never does more units than given, measured separately inside an item's preparation (pooling and
  sorting 900 stacks), inside a table, and inside the search above 2,000**; BP-11 "one offer in both replies" and
  "two equal offers"; BP-12 "one allowance": baseline 100, allowance 10, three removals of 10: exactly one, total
  110; BP-13 sizes: needs of 2,001, 99,999 and 999,999; 1,200 rows plan to the end; BP-14 an approximate item that
  prices cheaper over fewer worlds; **BP-15 "the 300 cheapest are not enough": 320 stacks held, the 300 cheapest
  hold 600 units, a dearer stack of 500 is among the other 20, 1,000 are needed: the plan covers 1,000 using the
  large stack, reads "N of M found" as 1,000 of 1,000 and wears "priced from a restricted set"; control: with 300
  stacks or fewer no label and an exact result**), `package.json`. Accept: unit suite. Escalate if: a rule of
  section 6 gives two answers for one input.
- **B17 Needs and what is left (Sonnet builder; after B5).** Files: `src/lists/engine.js` (`LISTS.sumShares` moved in
  unchanged, `LISTS.marketNeeds` with `from`), `src/lists/lists.js` (calls the engine's `sumShares`; nothing else),
  `src/bourse/needs.js` (new), `tracker/tests/bourse-needs.test.js` (new: BN-1 (guard) `sumShares` gives the same
  result as before for all steps and for one step; BN-2 `marketNeeds` equals it for the fixture's lists and names the
  wanted items; BN-3 settled: 40 of 99 marked leaves 59, with and without a credit; BN-4 "a fall in need is not a
  purchase"; BN-5 "changed list selection"; BN-9 "another list, the same amount"; **BN-12 "another wanted item on
  the same list, the same amount": to check; control: the same wanted item, untouched: settled**; BN-6 "still count"
  adds a check record and settles, the earlier records unchanged; BN-7 two characters make one row; BN-8 a mark of 99
  of 99, the need back at 50: to check; BN-10 only the current trip's records count, by id; BN-11 "known so far"
  while a row is to check or unpriced, and a total once all are resolved). Accept: unit suite; `lists-engine` and
  `lists-model` tests unedited; `CHECK_ONLY=C150,C155 npm run check` unchanged. Escalate if: moving `sumShares`
  changes a Lists check.
- **B18 The ledger and the dispatch decision (Sonnet builder; after B2).** Files: `src/prices.js` (`PRICE.ledger`,
  the queue's use of it), `tracker/tests/bourse-ledger.test.js` (new, fake clock, fake storage and fake locks: BL-1
  two pages deciding together never pass a budget; BL-2 retries, the home-world read, opening requests, split halves
  and a failed region asked again are charged; BL-3 a forced refresh is charged, ignores the gate and does not pass a
  rate-limit pause; BL-4 the plan's own backoff: 15 minutes, doubled on a 429 right after it, reset by a usable
  answer, at most 6 hours, never shortened; **no header is read in the real case; with a stand-in that exposes one,
  a wait in seconds and a wait given as a date each lengthen the pause and never shorten it**; BL-5 the ranking order
  and the budgets 12, 72, 180 and 300; BL-7 an oversized reply and a deadline passed are charged; BL-8 "two live
  tabs"; BL-9 "six starts queued, then a pause": none of the six is sent; BL-10 a tab opened during a pause sends
  nothing; **BL-11 "the decision is the send": while one tab holds the lock between its decision and its send, no
  other tab can write a pause (the test asserts the second tab waits for the lock); a tab that is stopped before the
  decision and resumed after its deadline sends nothing; there is no call that returns a grant. BL-12 "no coordination, no request":
  without Web Locks, and with the ledger's storage refused, Refresh and every automatic path send nothing, the
  sentence shows and cached prices are shown; coordination lost while another tab changes the pause: nothing more is
  sent; control: with both present the same Refresh sends. BL-13 order numbers rise by one per request over two
  tabs**), `package.json`. Accept: unit suite; `CHECK_ONLY=C113,C117,C155 npm run check` unchanged. Escalate if: Lists
  or Submersibles change behaviour in any case.
- **B19 Build and routing (Sonnet builder; after B6).** Files: `build.js` (`bourse/data.js` from `live.json` and
  `timers.json` with `BOURSE_AREA` and the timer list's date; stops unless the area is D25's seven),
  `tracker/tools/one-look-header.js` (`MODS`), `src/index.html` (card), `src/shell.js` (module list, live line), the
  count lines B28 lists (like for like, named in the pull request), rebuilt copies. Accept: unit suite; `npm run
  test:browser`; C196's page list (the Bourse is one of the pages, and a build without it fails). Escalate if: a
  check reads a count B28 missed.
- **B20 Services and the offline cache (Sonnet builder; after B19, B18).** Files: `src/bourse/services.js` (new: the
  five services of section 3 and the per-region joining, the one definition), `src/sw.js` (`PAGES`),
  `tracker/tests/fixtures/universalis/slim-ten-listings.json` (new: one real reply of the `slim` form **for 100
  items of North America**, one request, trimmed and cleaned as B1's) and that folder's `README.md` (its path, date
  and size before trimming), `tracker/tests/bourse-services.test.js` (new: BX-1 each service's real path equals the
  saved ones; BX-2 three regions joined by D44; BX-3 a partial failure names the region; BX-4 the home world asked
  directly: its rows take the world of the reply and replace the region's rows for it; BX-5 the Item's seven
  requests, and six when the home reply is cached), `check.js` C214 (control: before any visit the page does not
  open offline; after one online visit the page, its sheet and its data open offline; with a watch list the alert
  script's files are cached too), C215 (two pages open together share the pause, the pace and the budget). Accept:
  unit suite; `CHECK_ONLY=C9,C214,C215 npm run check`. Escalate if: the service worker refuses the price host, the
  price site cannot be reached for the one reply, or that reply is over half of `maxBytes`.
- **B21 Ticks, the Lists credit and Undo, on one device (Sonnet builder; after B7, B26).** Files: `bourse.js`,
  `check.js` C208 (tick only leaves `modules.lists` byte-identical, with the control that "also add" changes it;
  "also add" raises each character's count in the same write; "fault between the two"; "two tabs, one need"; **"a
  removal before a retry", inside the 2 minutes: a credited tick, Undo, the tick's write sent again: stopped by the
  receipt and by the undo mark, the count not raised; "after the retry window": the page never sends those ids
  again, also after a reload and after the receipt's 24 hours (driven by a fake clock): the count is not raised;
  control: an honest first send does raise it**; "stale tick-only"; "stock cap"; "Undo after an unrelated edit", both
  ways; a credited record offers no "remove the mark only"; a row to check with both actions; "New trip"; **"fallback
  storage": no tick, no Undo, no "New trip" is written; the sentence of D34 shows; every stored amount, in Lists and
  in the Bourse, is byte for byte as before; control: the same clicks with the main storage write**), **C216 "the
  setting left out"** (run with `BOURSE.CREDIT` false, whatever B26's outcome, beside the same fixtures with it true
  when B26 passed: the switch is absent; a stored `tick: 'lists'` behaves as tick only and is left stored; a tick
  marks and `modules.lists` is byte-identical; a credited record already in the save is shown under "earlier trips",
  kept, never changed, with no Undo offered; a merge of two such saves gives byte for byte what the code at `<base>`
  gives; control with the constant true: the same tick writes both halves). Accept: `CHECK_ONLY=C208,C216 npm run
  check`. Escalate if: a case needs a rule section 6.7 does not give.
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
  its own rules against a stale copy; BW-7 `edit` runs on the stored section inside the transaction; BW-8 `ifRev`:
  the right stamp writes, another stamp refuses and writes nothing; **BW-9 "fallback storage": every call of
  `CC.writeSections`, with one part or two, with or without `ifRev`, is refused and nothing is stored; two tabs
  calling at once both get the refusal; no caller falls back to `CC.writeSection` for a tick, an Undo, a "New trip"
  or the copy (the test reads `store.js` and `bourse.js` for such a call); control: `CC.writeSection` writes on the
  fallback as before; and an error thrown by the storage after the save was written and before its stamp is shown to
  be the case the refusal exists for**), rebuilt copies. Accept: unit suite; `CHECK_ONLY=C119,C122,C145,C146 npm run
  check` unchanged. Escalate if: any existing test of `writeSection` needs an edit.
- **B24 The merge rule and older copies (Sonnet builder; after B3, B30).** Files: `tracker/src/core/merge.js` (BY0
  and its `applyMerge` branch), `tracker/tests/core.test.js` (BY-1 two devices: both add, one changes, both change;
  BY-2 BY0 asked until answered, each answer), `tracker/tests/bourse-versions.test.js` (new; the older files are
  read by `git show` at `<old>` unless `<old0>` is named; BV-1 local path, this device removed: an older Tracker's
  real save against a version 2 save writes nothing, bytes identical; control: against a version 1 save it writes.
  BV-2 the same, the other side removed. BV-3 cloud path: the older sync routine against a version 2 cloud copy
  refuses and uploads nothing; control with a version 1 copy. BV-4 a version 1 cloud copy from an older device is
  read by new code and the upload is version 2. BV-5 new code, local path, real `ET.saveMerge`, no choice, both
  orientations: the edited unit is stored. BV-6 new code, a full sync with no choices, both orientations. BV-7 the
  older Atelier, Lists, Submersibles and Settings code each refuse to write a version 2 save. **BV-20 "every older
  writer": one case per line of section 8's inventory and per further writer B28 found, each run against a version 2
  save with the stored bytes compared before and after, each with its control against a version 1 save, which
  writes: the erase at `<old>` (refuses, says why) and at `<old0>` (wipes: asserted as the known fault, and D61's
  restore is run after it); a backup, a code and a desktop file loaded in the older Tracker (refused at the save;
  bytes identical); "go back"; the first move; Settings' sync and its character save; `CC.putExtra` (adds a record,
  the save untouched)**), `check.js` C197 (in a browser, with the built files of `<old>`: an older Tracker tab open
  while the new Bourse saves: its next save is refused, and its "Erase everything" changes nothing and says why; an
  older Atelier tab already open writes nothing to the shared save; an older Home shows "Getting started"; each
  beside the same page against a version 1 save, which works; with the built files of `<old0>`: the erase wipes and
  the new page offers the restore), C198 (the BY0 question in the Settings dialog, each answer), rebuilt copies.
  Accept: unit suite; `CHECK_ONLY=C197,C198 npm run check`. Escalate if: a pinned commit cannot be read, or **any
  older writer other than the `<old0>` erase changes a version 2 save: then the version does not rise and the owner
  is told.**
- **B25 Worst sizes on a slow device (Sonnet builder; after B21).** Files: `check.js` C209 (the supported worst sizes
  of 6.5, with the processor slowed four times: no single block over 200 ms, also during preparation and the first
  pricing; the page answers a tap during planning; the plan appears within 10 seconds, full or labelled; it covers
  the same needs and gives the same totals as the unslowed run, checked against hand-worked rows; three more cases: a
  forced small budget (labelled, complete); a first pricing that alone takes several seconds (responsive, no plan
  shown until complete); **an item with 900 held stacks and a need over 2,000 (responsive during its preparation,
  labelled restricted and approximate)**), `src/bourse/trip.js` (`EVAL_MAX` and the step size set from the run, never
  above the tested values). Accept: `CHECK_ONLY=C209 npm run check`; the timings in the report. Escalate if: the
  limits cannot be met with any `EVAL_MAX` of 2,000 or more.
- **B26 Credits in a merge (Sonnet builder; after B24, B23).** Files: `tracker/src/core/merge.js` (rule BY2 in
  `ET.threeWay` and at the end of `ET.applyMerge`; the held pairs), `tracker/src/core/save.js` (rule LI6),
  `tracker/src/app/ui.js` (`adoptLoaded` by D62, its question, the held-pair question in the sync dialog),
  `tracker/command-center/src/settings.js` (the base rebuilt pair by pair; the open-question line),
  `src/bourse/store.js` (`BOURSE.CREDIT = true`, last, only when every case below passes),
  `tracker/tests/bourse-credits.test.js` (new; first a list, by file and line, of every caller of `ET.threeWay` and
  `ET.applyMerge` at `<base>`, each either covered by a case below or named as not touching pairs; then every case
  through the real cloud path (`ET.cloudSync` and `ET.cloudFinish` against a stand-in cloud) and the real local path
  (`ET.saveState` and `ET.saveMerge` with a real `CC.transact`), no choices unless said: BK-1 "equal credits"; BK-2
  "unequal credits"; BK-3 "Undo against a typed count"; BK-4 "an ordinary typed edit" with a credit present; BK-5 a
  count typed differently on both devices with a credit present: asked, this device's own part until answered, and
  count = own + credits holds before and after **each of the two real answers**; BK-6 "a missing record": held, never
  removed; a record whose credit never reached the count: held, the count not changed; BK-7 (guard) a save with no
  credited record and no undo mark merges byte for byte as at `<base>`, on the whole existing merge test set; BK-8
  LI6: a Lists page with an old copy types a count the Bourse credited meanwhile: refused; **"after the last
  Undo": the page shows 50, an Undo stores 10 and its undo mark, the page types 51: refused, 10 stays**; control:
  with no credit and no undo mark the write behaves as today; BK-9 the rule after a choice; **BK-10 "at the limit",
  as section 8, with three further syncs and both Undos; BK-11 "under 0", as section 8, with three further syncs, a
  reload between them, and each answer; BK-12 "held is durable": a held pair is not changed by a later sync in which
  the other side's pair is itself valid, nor after the page is reloaded, nor by Settings' sync; control: once
  answered the next sync applies normally. BK-13 "a backup with Lists and no Bourse section" loaded over a device
  with a credited record: the count comes from the file and the device's credited records and undo marks go with
  the replaced counts; uncredited marks stay; control: a backup carrying both sections restores both; a backup with
  neither leaves both. BK-14 "Settings' base": a sync from Settings during which the count is typed here and
  credited there: the rebuilt base holds the count and its records as at the start, and the next sync raises the
  pair once, whole; control: without a clash the base advances. BK-15 the retry of an expired receipt is B21's; here:
  an undo mark alone, with no receipt, stops a second credit of the same id in a merge of two saves**), rebuilt
  copies. Accept: unit suite; `CHECK_ONLY=C119,C122,C145,C146,C198 npm run check` unchanged. **Escalate if: any
  existing merge or Lists test needs an edit, or a case cannot be made to pass: then `BOURSE.CREDIT` stays false,
  this item's changes to `merge.js`, `save.js`, `ui.js` and `settings.js` are taken out again, check C216 is the
  proof of the fallback, and the owner is told.**
- **B27 The cloud copy (Sonnet builder; after B24).** Files: `tracker/src/core/cloud.js` (D48, D63: no replace
  without a tag; create, then read back; the copy id and line; `sync.drive` with item id, `eTag` and copy id; no base
  for a copy that is not a known descendant; `ET.cloudOverwrite` with the shown copy's item id and `eTag`),
  `tracker/src/app/ui.js` and `tracker/command-center/src/settings.js` (both callers: the overwrite question carries
  the copy's identity; the older-app line; a refused overwrite reads again), the cloud test file B28 names (BV-8
  "missing-file race"; BV-9 "the create condition ignored", and honoured; BV-10 "changed since read"; BV-11
  "repaired while the question is open", with its control; BV-12 a first sync after updating behaves as today;
  BV-13 "same-version replacement" with its control; BV-14 "missing checkpoint"; BV-15 "restored checkpoint" and "201
  uploads behind"; BV-16 "no tag, no replace": every path that would send a replace without an `eTag` sends nothing;
  control: with a tag it sends; the stand-in answers "already exists" and "changed" as OneDrive documents them), the
  report (what Microsoft's documentation says of `conflictBehavior=fail` for this upload, quoted with its address),
  rebuilt copies. Accept: unit suite; `npm run test:browser`. Escalate if: an existing sync test needs an edit other
  than the new record's fields.
- **B28 The baseline again, at the real base (Haiku clerk; first).** No edits. At the commit the branch starts from,
  after the module moves: pin `<base>` and `<old0>` (D59); run `npm run build`, `npm run test:unit`, `npm run
  test:browser`; report B0's whole inventory again with file and line: the highest check id; every count of nav
  links, modules and Home cards; every test and check that reads the Tracker's Market Board; each `universalis.app`
  stand-in of `check.js` with the check id and the page it belongs to; where the hosted-only code of the Tracker and
  the Atelier adds the Main menu; the file that holds the cloud sync tests. **The inventory of writers:** every call
  of `CC.transact`, `CC.writeSection`, `CC.foldSection`, `CC.putExtra` and every direct write to the save's storage
  keys, in the Tracker, the Atelier and the Command Center, each with what it does when the stored save is
  unreadable or newer (refuses, or writes: quote the lines), **the erase, the loaded backup, the loaded code, the
  desktop-file import (`deskImport`), "go back", the first move and catch-up, Settings' sync and character save, and
  every place where a save is finished after a sync** among them; every caller of `ET.threeWay` and `ET.applyMerge`;
  the names in `codec.js` of the backup's and the code's versions; whether every path this section names exists.
  Accept: each answer with file and line. Escalate if: a suite fails, a gate is not in the base, a named file has no
  counterpart, or **a writer other than `ET.clearState` writes over a newer save.**
- **B29 "Erase everything" refuses a save it cannot read (Sonnet builder; after B28; released by itself).** A fix to
  the shipped app, with no Bourse code in it. Files: `tracker/src/core/storage.js` (`ET.clearState`: when the stored
  save is unreadable or newer it writes nothing and reports why; a save it can read, and no save at all, are erased
  as today), `tracker/src/app/ui.js` (the result is shown: "Not erased: the saved data on this device was written by
  a newer version of the app. Reload the page to update, then try again." or "… could not be read. Download it first
  (Settings → Import and backup)."; the page is not reloaded then; the question's text is unchanged),
  `tracker/tests/core.test.js` and `tracker/tests/ui.test.js` (BE-1 control: a version 1 save is erased exactly as
  today, the other modules' sections byte-identical; BE-2 a save with a higher version: nothing is written, bytes
  identical, the sentence shows; BE-3 an unreadable save: nothing is written, the sentence shows; BE-4 no save: as
  today), rebuilt copies of the Tracker, the Command Center and the Atelier, `docs/STATE.md` (the entry "Built,
  waiting for the owner's `ship`", and after the owner's `ship` the release date from which D60's 30 days run, and
  `<old>`). Accept: unit suite; `npm run test:browser`; `npm run check`. Escalate if: an existing test needs an
  edit, or the erase is reached by another path than `ET.clearState`.
- **B30 The guard copy and the restore offer (Sonnet builder; after B23).** Files: `tracker/src/core/save.js`
  (`CC.transact` writes the guard with every version 2 save; `CC.read` and `CC.transact` raise `replaced`; the two
  writes allowed then: restore and keep), `tracker/src/core/storage.js` and the pages that read the save
  (`src/shell.js`, `src/settings.js`, `src/lists/lists.js`, `src/submersibles/subs.js`, `src/bourse/bourse.js`,
  `tracker/src/app/ui.js`, `crafting/atelier/src/atelier.js`: each shows D61's offer through one shared function and
  writes nothing until it is answered), `tracker/tests/core.test.js` (BG-1 every version 2 write stores the guard in
  the same transaction, and a failed write stores neither; BG-2 "erased by an older Tracker" with the real
  `ET.clearState` of `<old0>`; BG-3 a blank save, a missing save, an unreadable save and a version 1 save each
  beside a guard are "replaced"; control: a version 2 save beside its guard is not; BG-4 Restore: the guard's data
  byte for byte, the replaced data kept under its own key; BG-5 "keep", asked twice; BG-6 "no page writes
  meanwhile", for each page, each with its control; BG-7 the fallback storage with too little space: the save
  succeeds without a guard; BG-8 a save with no guard yet (the first run of new code over a version 1 save) is read
  and written normally and gets its guard), `check.js` C217 (in a browser: the offer on each of the seven pages,
  Restore from one of them, and the other open pages follow), rebuilt copies. Accept: unit suite;
  `CHECK_ONLY=C119,C122,C145,C146,C217 npm run check`. Escalate if: an existing save test needs an edit, or the
  guard cannot be written in the same transaction as the save on IndexedDB.

## 11. Risks, limits, owner questions

**First thing to verify:** B28's inventory of writers at the real base: that the erase is the only older writer that
writes over a newer save. If another is found, the version does not rise until it has its own fix and waiting time.
Second: the create condition on the real OneDrive (section 8: who, and when). Third: one real `slim` reply for 100
items (B20). Done already: the older pages' refusal of ordinary writes (B0), the price site's fields (B1),
`lists/store.js` running by itself (B0), that a page cannot read the price site's wait header (the requester, one
request, 2026-11-26).

**Risks.** `save.js`, `merge.js`, `storage.js` and `cloud.js` all change: the most sensitive files of the app; every
existing test stays unedited, B26 has a byte-for-byte guard, and B26's failure takes its changes out again. Rules
BY2, the guard and the lineage are new and unreviewed. The guard doubles the stored size of the save. A copy older
than B29 that sat offline for more than 30 days can still erase a version 2 save; the guard then restores what the
updated app last saved, not what an older tab changed since. B29 could be released earlier than the Bourse work (it
needs nothing from the look or the moves), which would start the 30 days sooner; the owner's round eight makes it the
Bourse work's first step, so the plan keeps it there. The no-base merge after a foreign cloud copy can ask many
questions. Load on a free service: bounded by D4, D27, D39 and D56. The to-check state can ask about many rows. The
`slim` reply grows with its 10 listings. Moving `sumShares` touches the shipped Lists page. The header gains a
seventh page.

**Known limits, as designed.** Direct materials only (D12). The ranking prices one unit (D13); its listing figure is
what a region's 10 cheapest show. The split is a good split, not the best; `cheapest` is cheapest among the regions
kept; amounts over 2,000 and restricted sets are approximate and their baseline a reference; equal-cost choices do
not promise the fewest worlds; a very large trip gets "A quick split". Hops are one way. The Bourse cannot know why
Lists' need changed, so it asks. Worlds other than home show only their region's cheapest 60 listings. The app does
not know the game's travel rules, whether a route is open, or whether stock is still there. Maintenance announced
after the last build is unknown. One home world for all characters. The Tracker's old list is copied as normal
quality; an item added to it by an old cached Tracker after the copy is not copied; the downloaded file's list is
never copied. Lists' own prices stay before the buyer's 5%, and say so. The seller's rounding is the cautious one.
Purchase records that added to Lists, and undo marks, are kept (about 80 characters each). A pair that cannot be
combined waits for an answer on each device. **Without Web Locks, or with the ledger's storage refused, the Bourse
shows cached prices only. On fallback storage it cannot mark purchases or copy the Tracker's list.** Lists and
Submersibles keep their own pace and do not know the Bourse's pause. The price site's own waiting time cannot be read
by a page; the plan's backoff stands in for it. Older pages: section 8, the Atelier's silence above all. A device
that never updates and replaces the cloud copy is caught at the next sync of an updated device, not before; nothing
is removed then, but the newer copy was out of the cloud meanwhile. A cloud copy more than 200 uploads ahead is
merged with no base. Alerts need the app open in a tab, and Web Locks. Not tested by any automated run: the live
price site (but for the saved replies), the real OneDrive, a real phone, a real two-device sync.

**Owner questions. None is open.** Closed: 1, 2, 4, 6 (round two); 3 (round three); 8 (round four); 7, 9 (round
five); 5 (a), 10 (a), 11 (b), 12 (a), 13 (b) (round six); 14 (a) build the rule that keeps count and purchases
together, the setting left out by itself if the rule fails its tests, and 15 (a) a third outside round (round seven).
**Round eight (2026-11-26), after the third round failed the plan:** the Lists setting's rule is still built, now
corrected for the count limit, backups and codes, Undo on another device and fallback storage, and still left out if
its tests fail; the fix to the old Tracker's "Erase everything" is the Bourse work's first step, released well before
the save version rises, with no separate pull request now; a fourth outside round, with both reviewers, follows this
correction before any Bourse code. The questions as they were asked are in `docs/bourse-questions.md` and in the
adjudications.

**What was read, and what was not verified (this correction).** Read: `docs/bourse-review-adjudication-3.md`, both
round-three reviews, the eighth round of `docs/bourse-questions.md`, `storage.js` 286 to 341, `ui.js` 988 to 1025 and
1174 to 1217, `settings.js` 280 to 343; from earlier rounds `save.js`, `merge.js` 70 to 290, `cloud.js` 120 to 230.
**Sections 1 to 10 were written again from this planner's round-two text plus the changes of section 17; they were
not compared line by line with the file as the requester had edited it between rounds, so any hand edit there other
than those in sections 11, 14, 15 and 16 should be checked.** Not read: `codec.js` (the names of the backup's and the
code's versions are B28's to report), `deskImport`, the Atelier's and Lists' save code, the saved reply files, the
look spec and pictures. Not verified: that `ET.clearState` is the only older writer over a newer save (the
requester's check, B28 repeats it); that every merge of whole saves goes through `ET.threeWay` and `ET.applyMerge`
(Mistral's list of call sites was partly wrong; B26 lists them first); OneDrive's create condition; a real 429; the
size of a `slim` reply; Web Locks on the owner's browsers; that IndexedDB and device storage have room for the
guard.

## 12. Red team and pre-mortem (2026-11-24)

**Same-family review:** a Claude model reading a Claude-written spec; not an independent audit. Findings are numbered
as sent (12 to 14 were not sent). The outside review rounds replaced several of these fixes ("Now").

| # | Finding | What changed then | Now |
| --- | --- | --- | --- |
| 1 | Old bought marks hide new needs | Marks cleared by the page when Lists' need is 0; "New trip" | D33, D47: the to-check state; trips with their own id |
| 2 | Tax model unknown | One model in percent; B1 records the reply's form | D36: three figures kept apart |
| 3 | Region name | `PRICE.placePath`; `strict404` | Found (B1) |
| 4 | Home world looks empty | D24: the home world is asked for too | D51; the Item asks for it too (7 requests) |
| 5 | Split too slow | Each item priced once per world; 200 ms on the test machine | 6.1, 6.5, D55, B25 |
| 6 | Split ignores data-center hops | Whole data centers removed before worlds | D37, D54 |
| 7 | Offline lockout | Offline failures do not count; Refresh lifts a failure pause | The plan's own backoff (D4) |
| 8 | Ranking overstates profit | The higher of the cheapest listing and the sales middle; bait flag | D49: an observation, labelled when partial |
| 9 | High quality in Lists reads "none" | `minPriceHQ`, then the `hq` filter, then a scan of 20 | D8: found (B1); a 0 is no value |
| 10 | Tracker list copy | The receipt only after a saved, non-empty copy | 6.8, D58; not made on fallback storage |
| 11 | Alerts on stale listings | Rings only within `oldDays` | D40, D57: per area, every input rechecked |
| 15 | Tests that pass at the base; `sumShares`; packed data | Named guards; `sumShares` into the engine | D45; D14 |
| 16 | No `timers.json`; items too large; trip owner | Built copy only; B13, B14; D23 | D17; B16 to B30 |
| Look | Long names, "14M", wording, `--gil-m`, the states page | Sections 6, 9; D21; C206 | C206 measures the real sheet too (B11) |

**Pre-mortem.** (1) The price site changes a field: the readers give "failed" or "unknown", last good values show as
stale, nothing shows 0. (2) The ranked sale price is the travel area's and the home world sells for less: the opened
row shows it. (3) An old cached copy meets the new save: it refuses, the Atelier silently; **an old Tracker from
before B29 can still erase it, and the guard offers the restore**. (4) The site slows or refuses a device: the pause
stops every Bourse page of the device and doubles while refusals go on. (5) Rule BY2 has a fault: it can only touch
pairs that a purchase credited, it never stores a count that breaks its rule, the guard BK-7 keeps every other merge
byte for byte, and the setting is off by default. (6) OneDrive does not refuse a create over an existing file: the
read-back or the next sync finds a copy that does not descend from this device's, merges with no base and removes
nothing. (7) The guard itself is lost (storage cleared by the browser): the save goes with it; that is today's risk,
not a new one. (8) A player answers "keep what is there now" by mistake: it asks twice, and the replaced data is
kept under its own key by Restore only, so this answer is final (stated in the question).

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
Claude-written spec (same family). Rounds two and three (sections 16, 17) found many of them partly open; the "Where"
column below is the round-one place.

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
| 12 load | A device ledger; a persisted pause; `maxBytes`; caches merged per item | D4, D5, D39; B18 | Without Web Locks: see D56 now |
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

## 15. Facts found by B0 and B1 (2026-11-25), as corrected by the three review rounds

**B1, the price site** (`tracker/tests/fixtures/universalis/README.md`, test `tracker/tests/bourse-replies.test.js`;
the requester reports 12 of 12 passing after the redaction change, 11 of 11 before; no reviewer ran it): every field
the plan had marked [verify] was found. The region paths are `North-America`, `Europe`, `Oceania`; Gilgamesh is world
63. A city tax rate is a whole percent (5, 3, 0). A listing's `total` is price times quantity, without the tax.
**A listing's `tax` is 5% of that total, rounded down, in all 139 listings kept in the saved files, whatever the
retainer's city (eight city numbers occur).** The smallest is in `region-batch`, item 44001: **3 at 12, total 36, tax
1**. No saved listing totals 35; the "35" of earlier texts was a misreading, and 35 is used only as a made-up case in
BM-5, named so. The README's earlier line about a "3% city" was wrong and is corrected there (2026-11-26); its "734 listings
checked" is a count made during the capture, before trimming, and is not reproducible from the 139 kept. The test's
own tax case (BR-7) reads the 60-listing file only; BM-5 pins the 36-gil row. The seller's deduction is in no reply.
`lastUploadTime` and `worldUploadTimes` are in milliseconds, a sale's `timestamp` and a listing's `lastReviewTime` in
seconds; some `worldUploadTimes` are 0. `worldUploadTimes` appears only on region replies; a world reply carries
`lastUploadTime`, and its listings and sales carry no world (D50). `minPriceNQ` and `minPriceHQ` are present, also
with `listings=0`, but name no world, and read 0 where a quality has no listing (Oceania; D52). `listings=60` caps per
item; `listings=300` is accepted (134 came back; that proves no maximum). A one-item request returns the item without
the `items` wrapper; a batch adds `unresolvedItems`. An unknown item and an unknown place both answer 404 with the
same body. Sizes before trimming: a two-item region reply 9.6 kB (Oceania) to 53 kB (North America); a four-item
North America batch 110 kB, so the 2 MB reply cap of D5 is far above those; **a 100-item reply was not measured**
(B20). Two gateway errors (504, 502) cleared on one retry each. No saved reply carried a rate-limit or wait header,
and a page could not read one if it did (trust marks).

**B0, the app** (`docs/bourse/b0-report.md`): at `d7322c7` the build is clean, unit tests 634 of 634 (645 of 645 with
B1), browser tests 67 of 67, drift check C196 passes; the highest check id is C196; `checks.yml` uses `fetch-depth:
0`; the one-look rules and the module moves are not yet in the base (B28 runs again after them). For D32, read from
the code, not run in a browser: the ordinary saves of every older page, and the Tracker's sync after a read, refuse a
version 2 save. **B0's sentence that no older write path overwrites one was wrong: it read the save paths and missed
"Erase everything" (`ET.clearState`, `storage.js` lines 292 to 305), which writes an empty save over a newer one and
wipes every module (confirmed by the requester, adjudication 3).** Two uploads of the older code have no condition:
the one made when no cloud file was found (`cloud.js` line 193) and the owner's "replace the cloud copy" (line 228).
A loaded backup or transfer code replaces sections and does not merge them (`ui.js` lines 1016 to 1022). What each
older page shows is in section 8. No content policy exists; both service workers pass cross-origin requests through.
`lists/store.js` loads by itself and its `bought` returns `{ section, entry, capped }`. Not done by B0: the full
inventory of writers, the price-site stand-ins of `check.js` by check and page, the desktop-file import (B28).

## 16. Round-two outside review (2026-11-26)

Both reviewers read the plan at `f6610c6`: ChatGPT (FAIL: 1 blocker, 16 major, 2 minor, 1 note) and Mistral (PASS: 2
minor, 3 notes). `docs/bourse-review-adjudication-2.md` accepted every finding but one part of R10. The corrections
were same-family; the owner chose a third round on them (question 15 (a), round seven), and that round found R01 open
and several others partly open (section 17, which says what replaced the entries below). R17 to R19 and Mistral R2-2
belong to the look, R20 to the saved replies and their test.

| Finding | What changed in round two | Where then | Since (section 17) |
| --- | --- | --- | --- |
| R01 credit and sync (blocker) | A count is the player's own part plus the credits of the records; the rule in the whole-save merge; records never edited | D46, D47; BY2, LI6; B26 | F02, F05: held pairs, undo marks, one unit everywhere |
| R02 tick identity, retry, fallback | A tick bound to the need and the lists; every tick refused on a changed save; a receipt | D47, D34; 6.7 | F06, F07: bounded retry; no ticks on fallback; wanted items, trip ids |
| R03 cloud create race | Create only if missing; replace only the copy read; a lower-version copy removes nothing | D48; B27 | F03, F04: the shown copy's tag; read-back; lineage |
| R04 ranking listing, sales a day | The ranking reads 10 listings with worlds; sales a day over the window | D49, D44 | F09: an observation, labelled when partial |
| R05 world replies, two times | Rows of a world reply take its world; two times apart | D50, D6 | Closed; the Item's home read counted (F12) |
| R06 home offers counted twice | The home reply is the authority | D51 | Closed |
| R07 "none", zero minimum | "Confirmed empty" only when proved; a minimum of 0 is no value | D52, D35, D8 | Closed |
| R08 partial inputs | A recipe cost needs every amount covered; "known so far" | D53 | F14: a required stop is in the total |
| R09 allowance, reference, labels | One allowance; a reference; "only reported listings"; a first world | D54; 6.2 to 6.6 | Closed on the rule |
| R10 buyer's tax | The flat 5% per stack is the one basis; the `tax` field a cross-check | D36 | F09, F16: three figures apart; the 36-gil row |
| R11 sizes, steps, ties | Every size has a rule; steps counted; a bounded search; a tie rule | D55; 6.1, 6.5 | F10: every piece of work counted; the 300 keep cover |
| R12 pace across tabs | Shared starts; a deadline; answers ordered | D4, D56, D39 | F08: one dispatch decision; own backoff; no request without coordination |
| R13 alerts | A result belongs to its round, area, quality and target | D57; section 7 | F11: age limits, three expiries, per area |
| R14 the copy's quality | Normal quality; the larger amount worked out inside the write | D58; 6.8 | F06: not made on fallback storage |
| R15, Mistral R2-1, R2-3 to R2-5 | Ledger and sections brought to round six; older pages' real behaviour | D32; sections 3, 11, 15 | F01, F16: the erase path; counts corrected |
| R16 items | Full paths; guards apart; controls; pinned commits | Section 10; D59; B28 | F12: owners, counts, the off-path proved |
| R17 to R19, Mistral R2-2 | (look) | Section 9 | F13 to F15 |
| R20 | (saved replies and their test) | D6 | Closed |

**Defaults round two set, as they stand now:** the ranking reads 10 listings a region; a request is given up after 20
seconds; purchase receipts are kept 24 hours; at most 300 stacks of an item are weighed unless cover needs more.
Withdrawn in round three: honouring the price site's waiting time without a ceiling (it cannot be read), and 30
requests a page load without Web Locks (no request is sent then).

## 17. Round-three outside review (2026-11-26)

Both reviewers read the plan at `6734ea5`: ChatGPT (FAIL: 3 blockers, 11 major, 2 minor) and Mistral (PASS: 3 notes).
`docs/bourse-review-adjudication-3.md` accepted every finding, confirmed F01, F02, F03 and F05 in the code or by
arithmetic, and found two of Mistral's supporting claims wrong (that B0 had verified no older copy writes over a
version 2 save; that a loaded backup reaches the merge rule). **The corrections below were planned by a Claude model
on a Claude-written spec (same family) and are unreviewed. The Bourse stays paused; a fourth outside round, with both
reviewers, follows (owner, round eight).** F13, F15 and the picture side of F14 belong to the look: the requester's.

| Finding | What changed | Where | Left as a known limit |
| --- | --- | --- | --- |
| F01 the old erase wipes a newer save (blocker) | The erase is fixed first, in its own release; the version rises no sooner than 30 days later; new code keeps a guard copy, detects a blank or older save in its place and offers to restore; every older writer is listed and tested; the "no older page overwrites" claim is corrected | D60, D61, D32; section 8 (inventory, guard); B29, B30, B28, B24 (BV-20, C197), B3, B12; section 15 | A copy older than the fix, offline past the waiting time, can still erase; the guard restores the last save of the updated app |
| F02 the credit rule at its limits (blocker) | No count is stored that breaks count = own + credits; over the limit or under 0 the whole pair stays and is asked; the open question is kept in the save across reloads and syncs | D46; section 8 (BY2 steps 3, 4); B26 (BK-10 to BK-12) | Each device answers its own question |
| F03 the overwrite of a copy never shown (blocker) | The overwrite carries the item id and `eTag` of the copy the question was about; a missing or changed tag stops, reads again and asks again | D48; section 8 (cloud rule 3); B27 (BV-11, BV-16) | — |
| F04 create, lineage (with Mistral R3-1) | A create is read back and merged if it differs; no replace is sent without a tag; the copy carries its id and line, the device records item id, `eTag` and copy id together; anything not a known descendant is merged with no base; who verifies the service, and when | D48, D63; section 8 (cloud rules 1, 2, 4); B27 (BV-9, BV-13 to BV-15), B12 | More than 200 uploads apart: no base, more questions; the real service still to be tried |
| F05 backups, missing records, Settings' base, LI6 | Count and records move as one unit in a loaded backup or code, in Settings' base and in every merge; a missing record with no undo mark is asked, never an Undo; LI6 holds after the last credit, by the undo mark; the "merged in" sentence is corrected | D62, D47, D46; section 8; 6.7 (Undo); B26 (BK-6, BK-8, BK-13, BK-14) | Undo marks are kept |
| F06 replay after expiry, fallback storage | A retry lives 2 minutes inside its own page and never after; the receipt outlives it; the undo mark stops a credit for good; on fallback storage ticks, Undo, "New trip" and the copy are refused in words, every stored amount kept | D34, D47; 6.7, 6.8; B21 (C208), B23 (BW-9), B10 | No marking of purchases on fallback storage |
| F07 trips and needs | Each trip has its own random id; two new trips are asked, neither's marks deleted; a mark is bound to the wanted items behind the need; disagreeing check records leave the row to check | D47, D14; 6.7, 6.8; section 8; B13 (BT-4, BT-7), B17 (BN-12) | A wanted item's amount changing sends the row to check |
| F08 dispatch, backoff, no coordination | One decision immediately before sending, inside the lock, with the send; order numbers; the plan's own doubling backoff; the unreadable wait header never promised; without Web Locks or the ledger's storage no price request; Lists and Submersibles left exactly as they are | D4, D39, D56; trust marks; sections 3, 7; B2 (PX-1, PX-14), B18 (BL-4, BL-11 to BL-13) | Cached prices only in such a browser; Lists and Submersibles do not share the pause |
| F09 the 10-listing slice; three figures | A slice is an observation: seen, proved none or not covered, and the figure is named accordingly; asking price, buyer's cost and seller's proceeds kept apart; "each, for N" defined; a real 100-item reply; an oversized batch split once | D49, D36, D6, D5; sections 3, 5; B5 (BM-5, BM-7), B20, B2 (PX-10) | A region's 10 cheapest only |
| F10 the 300 stacks; work outside the table | The limit never loses cover; "N of M found" over all held stacks; a restricted set is labelled; sorting, pooling and the search above 2,000 are counted and stepped | D55; 6.1, 6.5; B16 (BP-10, BP-15), B25 | A restricted set is approximate |
| F11 alerts | Every saved input rechecked, the age limits too; expiry when queued, when sent and when used; crossings kept per area | D57; section 7; B15 (BA-11 to BA-13) | — |
| F12 items | The Item's home read counted (7); the left-out setting proved by its own check; every write path named with its item; owners for the new fixture, Settings and `adoptLoaded`; callers of the merge listed before they change | Sections 3, 8, 10; B14, B20, B21 (C216), B26, B28 | — |
| F13, F15 | (look) States this round needs are listed for the look's owner; C206 measures the real sheet, focus and the second profit figure | Section 9; B11 | The drawings are the requester's |
| F14 a required stop and the total (spec part) | Every kept stop, a required one in another region included, is in the total; "known so far" only when something is unresolved; states-page amounts from the tax helper | D53; 6.4, 6.6; section 9; B7 (C202), B16 (BP-7) | The pictures are the requester's |
| F16 the tax example and the counts | The 36-gil row cited; 35 only as a named made-up case; the capture's count told apart from the 139 saved; rounds and test counts updated | Section 15; D36; B5 (BM-5); B1's note; B12 | The README's line is the requester's to correct |
| Mistral R3-1 | With F04 | As above | — |
| Mistral R3-2 | Superseded by F08: the header cannot be read | D4 | — |
| Mistral R3-3 | Stands: BY2 is unbuilt and proven only by B26's tests; the fallback is now proved by C216 | D46; B26, B21 | Contractual until B26 runs |

**Defaults this round set, for the reviewers and the owner to see:** 30 days between the erase fix's release and the
release that raises the save version; the backoff after a refusal starts at 15 minutes, doubles, and stops at 6
hours; a retry of a tick lives 2 minutes and 3 tries; a cloud copy's line holds 200 ids; alert entries untouched for
30 days are dropped; an oversized batch is split once.
