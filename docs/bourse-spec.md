# Bourse, the market module (blueprint phase 4): build spec

Written 2026-11-24 for a Sonnet builder and a Haiku clerk; revised after a same-family red team (section 12), the
owner's rounds two to eight (sections 11, 13, 14), three rounds of outside review (sections 14, 16, 17) and the facts
of B0 and B1 (section 15). **Round five of the outside review failed the plan again on 2026-11-26; its corrections are
decisions D71 to D79 and section 19, same-family and unreviewed, and a sixth outside round follows (owner, round
ten).** **Round four of the outside review failed the plan again on 2026-11-26; its corrections are
decisions D64 to D70 and section 18, same-family and unreviewed, and a fifth outside round follows (owner, round
nine). Round three's corrections are section 17, likewise same-family.** Plan only: apart from B0 (a report) and B1 (saved
replies and their test) nothing was built. **Building is paused** (order below).
Binding inputs: the owner's answers in `docs/bourse-questions.md` (ten rounds, with
`docs/bourse-review-adjudication-5.md` and
`docs/bourse-review-adjudication-4.md` beside the adjudications named below; a later round replaces an earlier
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
| B0 and B1 ran before the second outside review; a third and a fourth round ran; a fifth, with both reviewers, follows this correction | rounds six to nine | sections 15 to 18 |
| All 15 findings of round four are fixed with the plan's scope unchanged, the Lists setting's rule included | round nine | D64 to D70; section 18 |
| The Lists credit setting stays in this plan; all twelve findings of round five are fixed; a sixth outside round, both reviewers, follows | round ten | D71 to D79; section 19 |
| An open question about a count and its purchases is identified by its contents, shows every differing pair, and no answer can drop a pair it did not show | adjudication 5 (R5-02, R5-03) | D71 |
| No newer-format save without a safety copy stored with it; where that cannot be done the save stays in the older format and the Bourse cannot save there | adjudication 4 (R4-01) | D64 |
| The newer cloud copy lives under a new file name, created only by a verified create-only route | adjudication 4 (R4-06) | D67 |

**Order.** (1) The plan passes: a sixth outside round, both reviewers, on the corrections of section 19 (round ten). (2) The
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
  record has no quality: both rows read "not fetched yet", it is left out of the subtotal, and **Lists' service
  counts such a record as no record** (a small change beside its `read`: the service's "what is still needed" test
  is told which stored records are unusable, so the hour that a fetched price normally stays fresh does not apply
  to it; `prices.js` lines 50 to 55), so the item is due at the
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
  **This limit and the pause count the Bourse's requests only** (Lists and Submersibles are outside them, D4). Every
  screen text says so: "Hourly limit reached: the Bourse has sent its 300 price requests for this hour from this
  browser. More after <time>. Lists and Submersibles are not counted here." No text says "this device sends".
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
  (D60), which is why the version rises only under D60's rule and with D61's guard. The backup file's own version
  rises with it (`codec.js`: `BACKUP_V` becomes 2). **The transfer code has no version but its prefix (`codec.js`
  line 7: `EVT2-` today, `EVT1-` before): a version 2 code is written with the new prefix `EVT3-`**, which an older
  app does not know and refuses with its existing sentence ("made by a newer version of the app"); a code written
  as `EVT2-` by new code would be loaded by an older app with its Bourse section. So an older copy refuses both, and new
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
  or proved none and every region's slice is clean (D69); otherwise it is "cheapest seen", with "(Europe not
  covered)" when a region is not covered**, and a craft ranked by the listing basis then
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
  is freed only by D68's rule, never by time alone. A pause's end is only ever moved later, **and an answer 429
  always sets or lengthens the pause, whatever its order number (D68)**. Every cached item carries the order number of the
  request that filled it, and an answer with a lower number than the stored one is discarded (order numbers, not
  clocks, so a clock set back cannot reorder). **Without Web Locks or without the ledger's storage none of this can
  be kept, so no price request is sent** (D39). [A limited manual path without coordination: every tab and every
  reload would get its own allowance, and a pause could not be kept.]
- **D57 An alert belongs to what was asked.** Section 7: every saved input is rechecked (the age limits too); a
  request can expire while waiting, when sent and when its answer is used; crossings are kept per area.
- **D58 The Tracker's old list is normal quality.** It never held a quality, so every copied item becomes
  `<trip id>.<item>.nq` (D66, D79), and the row says "normal quality (from the Tracker's list)". The larger-amount rule is worked out
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
  more, then adopts what is there and renews the guard. **Restore and "keep" are bound to the two copies the question
  showed (D65). There is no version 2 save without its guard: where the two cannot be stored together the save stays
  version 1 (D64); the earlier "no guard (known limit)" is withdrawn.** [No guard: the first sign of
  the erase would be an empty app. Restoring without asking: the player may have meant to erase.]
- **D62 Lists' counts and the purchase records move as one unit, everywhere.** In every merge (BY2). In a backup or
  transfer code loaded on this device, which **replaces** sections and does not merge them (`adoptLoaded`, `ui.js`
  lines 1016 to 1022): the credited purchase records and undo marks come from the same place as the Lists section
  (from the file when the file carries Lists, with none when the file has no Bourse section; from this device when
  it does not), and the question says so. In Settings' rebuilding of the sync base after a clash (`settings.js`
  lines 316 to 334): a count that is put back as it was at the start takes every purchase record and undo mark of
  that owner and item back with it. Rule LI6 guards a count also after its last credit is gone. Section 8.
- **D63 A cloud copy says where it comes from.** Each uploaded copy carries, beside its data, its own random id, the
  ids of the copies it descends from (the last 200), **the id of the first copy of this file (`root`) and the number
  of uploads since (`n`)**. `sync.drive` records the file's item id, the `eTag`, the root, the count and the
  copy id last synced, together. A copy read is **known** when the file's item id is the recorded one and either its
  own copy id and `eTag` are exactly the recorded ones (the unchanged copy: there is nothing new to take from it) or
  its line holds the recorded copy id (a descendant); then the merge uses the recorded base, which is kept only
  together with that identity (D67). In every other case (an
  older app's copy, which has no line or a lower version; a same-version copy from a device that never saw ours; a
  missing, partial or foreign record on this device) **the two copies are merged by the careful merge of D80, which
  is new code: today's merge with no base takes an entry found on one side only without a question (`merge.js`
  lines 87 and 88), so removals would come back.** A copy more than 200 uploads ahead is **not** such a case: it is
  known when the item id and the root are the recorded ones and its count is not below the recorded one (D80 (3));
  every sync uploads, so 200 uploads are a few days of ordinary use. Section 8.

**Round-four outside review (2026-11-26).** Where a sentence elsewhere in this file says otherwise, D64 to D70 rule.
- **D64 No version 2 save without a guard stored with it.** Version 2 is written only where the save, its stamp, the
  guard and the guard's stamp land in **one** storage transaction, which is IndexedDB.
  (a) **Fallback storage (device storage without IndexedDB) and memory:** new code never migrates and never writes
  version 2 there. The save stays version 1 and every existing module works as today. The Bourse cannot save there,
  and a version 2 cloud copy is not merged into such a browser. The pages say: "This browser's storage cannot keep
  the safety copy the newer save needs, so your save stays in the older format here and the Bourse cannot save. Cloud
  sync of the newer save is off in this browser. Backup files (Settings → Import and backup) still work."
  (b) **IndexedDB:** a write whose transaction fails (no room for the second copy, or cut off part-way) changes
  nothing: save, guard and both stamps stay exactly as they were, and the page says it was not saved. At the first
  migration the version 1 save stays; new code then goes on writing version 1 (only under D78's two checks, made
  inside each such write: the stored save is still version 1, and what is written holds no Bourse
  entry yet), keeps the Bourse's saving off, shows "Not enough storage for the safety copy, so the save stays in the
  older format. Free some space, or save a backup file.", and tries the migration again at the next opening.
  So "new code always writes 2" now reads: version 2 with its guard, or version 1 where that is impossible, never
  version 2 alone. [A guard written "when space allows": a save that fits once but not twice would migrate, and an
  older page's erase would then be final.]
- **D65 Restore and "keep" act only on the two copies the question showed.** The offer carries the stamps of the save
  and of the guard it was drawn from. Either action is one transaction that first reads both stamps again: **if one
  differs, nothing is written and the offer opens again with what is there now** (another tab already answered, or
  something changed). Restore: the replaced data is stored under its own key, then the guard's data becomes the save,
  with a new stamp. "Keep" is offered **only when what is there is a readable save**: it is checked, written as
  version 2 with a new guard, and the old guard's data is stored under its own key first (nothing is discarded). When
  what is there is missing, blank or unreadable, only Restore is offered, with "Download both copies". If a step
  fails, both copies stay untouched and the offer opens again. **While the offer is open, cloud sync does not run on
  that device**, from any page: no read is merged and nothing is uploaded; the sync line says "Cloud sync waits:
  answer the question about your saved data first." After Restore the sync base is dropped unless D67 revalidates it.
- **D66 An own item belongs to one trip, in its key.** `extra` is keyed `<trip id>.<item id>.<nq|hq>`, so the same
  item added on two trips started on two devices is two units, each with its own amount; choosing which trip is
  current (6.7) never mixes them. Upgrade, the same on every device: an entry found under the two-part key
  `<item id>.<nq|hq>` is read as `<its t>.<item id>.<nq|hq>`, and with no `t` as `legacy00.<item id>.<nq|hq>`; when
  both keys exist the three-part one is kept and the larger amount taken. (No shipped save holds the two-part form;
  the rule exists for saves written by builds made during this work.)
- **D67 The version 2 cloud copy has its own file, and a base only with its identity.**
  (1) **A new file name.** New code keeps its cloud copy under a new name beside the old one (the old name with
  `-v2` before its ending; B28 reports the old name from `cloud.js`). Older apps go on reading and writing the old
  file and cannot reach the new one, so their two unconditional uploads (`cloud.js` lines 193, 228) can no longer
  replace a version 2 copy. **New code never writes the old file.** It reads it only to bring its content over: at
  a device's first version 2 sync, and again whenever the old file's `eTag` is not the one that device recorded (an
  older device wrote meanwhile); **each time only what the old file changed since the shared checkpoint is taken
  (D76); "merged with no base" is withdrawn for the old file, because it brought back entries a newer device had
  removed.** Where the old file and the newer copy both changed one entry, the differences are
  asked. Known limit: a device that stays on the older app keeps syncing the old file and is not told; what it
  changes reaches the others when any updated device next syncs.
  (2) **Create only through a verified create-only route; otherwise no create.** The constant
  `ET.CLOUD_CREATE_VERIFIED` is false until both are written into `docs/STATE.md`: Microsoft's documentation for the
  route used, quoted with its address, saying a create of an existing name is refused; and a run on the real personal
  OneDrive in which ten creates over an existing file are each refused and leave its bytes unchanged. While it is
  false new code sends no create at all: "Cloud sync of the newer save is not switched on yet. Your data is safe on
  this device; backup files work." **The version-rising release is not offered for `ship` while it is false** (B12).
  The read-back after a create stays as a second check, never as the safeguard. Two browsers racing prove nothing by
  themselves and are not the gate. [Read-back alone: a later blind create can replace the copy after the first
  device read it back, and that device may never return.]
  (3) **Known copy, bound base.** D63 as amended: an exact match of item id, copy id and `eTag` is known. The sync
  base is stored as one record with the item id, copy id and `eTag` it belongs to and is used only with exactly that
  copy or a descendant of it. After a guard Restore (D65), after a loaded backup or code, and whenever the record is
  partial, the base is dropped; it comes back only from a sync that completes.
  (4) **Writes that are not confirmed change nothing here.** A replace addresses the file by its item id with the
  `eTag`, never by path. "No such item", a refusal, or an answer without an item id and `eTag` means the write did
  not happen as far as this device knows: the base, the recorded identity and the "synced" line are not advanced, and
  the sync reads again.
- **D68 A refusal always pauses; a slot is freed only by an ended request.** (1) An answer 429 sets or lengthens the
  shared pause under the ledger's lock **whatever its order number**, also when a later request already succeeded;
  only its cache write follows D56's order. (2) Each request in flight holds a browser lock of its own
  (`eveniunt-bourse-req-<order number>`) from the dispatch decision until its answer's body has been read to the
  end, it failed, or its abort has taken effect. The ledger counts a request as in flight while that lock is held,
  which other tabs can see; a closed tab frees its locks. A deadline that has passed aborts the request but does not
  free the slot by itself. **If the browser cannot tell whether such a lock is held, the slot counts as taken** and
  at most the other one is used. (3) A watch round's request is checked against that round's inputs (D57) inside the
  dispatch decision, immediately before the send, as well as before its answer is used.
- **D69 "Cheapest" needs a clean, ordered slice.** A region's slice is clean for an item and quality when no entry of
  that item was dropped (D35) and the kept asking prices do not fall along the reply's order. Only then is the
  cheapest listing of the area in that slice that region's cheapest; a dropped entry or a price out of order makes
  the region "seen, not clean", and the area's figure is "cheapest seen". B20's real reply must show the order by
  asking price for every one of its items; if it does not, every `slim` figure reads "cheapest seen" [verify].
  **A clean, ordered slice is still not enough (D77):** it shows the lowest of the rows returned, not that the site
  chose the lowest rows before cutting. The figure is "cheapest listing" only under D77; otherwise "cheapest seen".
- **D70 A held pair keeps both alternatives, in the save's shared part.** (Replaces `device.bourse.held`.)
  (1) **Where.** The Bourse section has a group `held`, one entry per `<owner>.<item>`. **Its form is D71's** (round
  five): no time in it, every differing pair in it, each named by its contents. The round-four form `{ why, at, x,
  y }` is withdrawn; where the points below say `x` and `y`, read "the alternatives". In round four's words they are
  the two whole pairs as they stood, each `{ have: { nq, hq, coll }, bought: { <id>: <record> }, undone: { <id>:
  <mark> } }`, written in a fixed order (the one whose text sorts first is `x`), with no device name, so both devices
  write the same entry and it merges as an equal unit. Being part of `modules.bourse`, it travels as every module
  unit does: through `ET.stateFromDoc`, `ET.portable` and `ET.docFromState` (`storage.js` lines 27 to 44, `codec.js`
  lines 10 to 22), through the same-device merge (`storage.js` lines 106 to 114 and 265 to 274), into backups, codes
  and the cloud copy. No device-only plumbing is needed, and B26 adds none.
  (2) **When it is written.** By the merge step itself, and saved on this device before any question is shown: the
  callers (`ui.js` sync, `settings.js` sync, `ET.saveMerge`) store the holds a merge returns even when the dialog is
  declined and nothing is uploaded.
  (3) **In the cloud copy.** The entry, with both alternatives, is uploaded like any unit, so the cloud holds both
  whatever happens to a device. While it exists, the live count and records of that pair in the cloud copy are
  whichever device uploaded last and decide nothing: every merge leaves this device's live pair alone and reads the
  alternatives from `held`.
  (4) **Frozen until answered.** While an open question exists, **every change to that owner's count of that item is
  refused, whatever made it**: a tick, an Undo, a typed count or the plus and minus buttons, Lists' "Bought it",
  "Made", a step handed in, Lists' own Undo (`lists/store.js` lines 312 to 343 and 385 to 416 all end in one stock
  write). The refusal is **rule LI7, inside the shared write itself**: a write of the Lists section that would store
  another value for that count than the stored one is refused whole, whatever else it carries ("Answer the open
  question about <item> first"), and so is any Bourse write that adds or removes a record or undo mark of that pair;
  every other item stays editable. So each device's live pair stays one of the two alternatives.
  (5) **The answer** names the question it answers and carries the pair it chose: D71 (3) to (5) replace the
  round-four form `{ ans: 'x' | 'y', at }`, which named neither. An answer changes something only where it meets
  exactly the question it was given for.
  (6) **Undo wins, lineage or not (BY2 step 1).** A valid undo mark that matches a record (same id, owner, item,
  quality) removes that record on every side, with a base or without one. With no base the pair then merges only if
  both own parts are equal; otherwise it is held.
  (7) **Malformed pairs are held before any arithmetic:** a record and its own undo mark on the same side; one id
  with different owner, item or quality on the two sides; an undo mark that does not match its record; a credit above
  its units; a count out of range. Nothing is computed from such a pair.
  (8) **A loaded backup or code (D62)** brings `held` from the same place as the Lists section. After the load an
  entry stays only if the live pair now equals one of its two alternatives; otherwise it is removed in the same
  write (a later sync asks afresh if the pairs still cannot be combined). The load also writes a new random
  `device.epoch`; **a section write from a page that read an earlier epoch is refused** ("The saved data was
  replaced. Reload the page."), so a page left open cannot write its old count even when the load removed the last
  undo mark. A guard Restore and a "keep" each write a new epoch too, and every save and every sync's last step
  checks it (D75).

**Round-five outside review (2026-11-26).** Where a sentence elsewhere in this file says otherwise, D71 to D79 rule.
- **D71 A held question is identified by what it holds, shows every pair, and is answered by name.**
  (1) **Form.** An alternative is one whole pair, `{ have, bought, undone }`, written in one fixed way (keys sorted,
  no time). Its name `h` is a fixed hash of that text, 24 characters of `a-z0-9`; two alternatives are the same only
  when their texts are equal, never on the hash alone. An open question is `held["<owner>.<item>"] = { q,
  alts: { <h>: <alternative>, … } }`, where `q` is the same hash over the sorted names. No `at`, no device name, **and
  no `why`: the reason depends on each device's base and would make equal discoveries differ; the words on screen
  ("over the limit", "under 0", "a purchase is missing", "an entry could not be read") are worked out from the
  alternatives and from `bad` when the question is shown.** So **two
  devices that find the same difference by themselves, at any time and in any order, write the same entry.**
  (2) **A third pair joins the question.** Whenever a device with an open question meets a live pair, its own or the
  other side's, that equals none of the alternatives, that pair is added, whole, as a further alternative, and `q`
  changes with it. Two versions of a question merge by taking **all alternatives of both** (rule BY3; it is never
  "this device's until answered" and never asked as a clash). The question on screen lists every alternative: "Lists'
  count of <item> and its purchases differ between your devices and cannot be combined. Choose one: (a) 999,999, with
  the purchase of 9 on 3 May; (b) …; (c) …". **No answer can remove a pair the question did not show**, because an
  answer only applies to the question it names (4).
  (3) **The answer** is `held["<owner>.<item>"] = { q, ans: <h>, alt: <the chosen alternative, whole> }`, written in
  the same guarded write that installs `alt` as the live pair. **That write also stores a rejection mark
  (`undone[<id>] = { o, i, q, at, rq: <the question's q> }`: an undo mark that names the question whose answer
  wrote it) for every purchase record that is in another alternative and not in `alt`**; D84 says when a later
  answer takes such a mark back. A
  record the answer rejects is marked exactly as an undone one, so a device or a backup that still holds it cannot
  bring its credit back (BY2 step 1 removes it wherever it is met, with a base or without). The answer is refused,
  and the question shown again, when the stored entry is no longer the question `q`.
  (4) **Where an answer meets something else.** The same question `q`: the answer applies; the device installs
  `alt` and stores the answer. **A different open question** (other or more alternatives, so another `q`): **the
  answer changes nothing there and the question stays open**; the answering device's present live pair, whatever it
  did after answering, joins that question as an alternative by (2), and when the answering device meets the open
  question its answer gives way and its pair is frozen again. So an open question always outlasts an answer to
  another question. **The same question answered differently on two devices:** neither answer applies to the other;
  a new question is raised whose alternatives are the two devices' present live pairs, whole, edits made after
  either answer included. An answer and no entry (a device that never saw the question): the answer is stored; the
  pair then merges by BY2 as any pair.
  (5) **Edits after an answer are taken only from the chosen base.** A device that applies an answer takes `alt` as
  the base of that pair for its next merge, in place of the sync base. What the answering device did afterwards is
  then a change from `alt` and merges by BY2; anything that is not a change from `alt` is a difference and raises a
  question by (2). The answer entry stays stored (it is small) until a new question for that pair replaces it.
  (6) Named tests, item B26: **"independent discovery"**, **"a late answer to a superseded question"**,
  **"conflicting answers with edits after one"**, **"a third device's purchase"** (round-five additions, section 10).
- **D72 A hold reaches the cloud by a publication that chooses nothing, or it says it is only here.** When a merge
  makes or widens an open question, the device uploads at once, with the `eTag` of the copy just read, a copy made
  of: the cloud copy as read; everything the merge settled without asking; and the `held` entry. For every entry
  that is asked, and for the held pair's live count and records, **the cloud's own value is left as it is**, and this
  device's base keeps the old value for them, so the next sync sees the same difference again. **After the upload
  is confirmed, one guarded write on this device applies every settled entry to this device's save (the removals
  made elsewhere among them) and records the new base, together.** If that write is refused or fails, the base is
  not moved for any entry: an entry may be in the base with its new value only when this device's save holds that
  value. (Today a declined dialog applies nothing here, `ui.js` line 1214 and `settings.js` line 308; a base that
  ran ahead of the save would make another device's removal look like an addition made here.) This runs also when
  the player closes the dialog. If it cannot be done (offline, the copy changed, the create route unverified), the
  question is **local only** and the app says so wherever it shows it: "This open question is saved only on this
  device so far. Sync to store it with your cloud copy." Until one confirmed publication, the sync line never reads
  "Synced" alone ("Synced, except one open question saved only here") and the backed-up time is not moved.
  [Uploading nothing after a decline: the only copy of both alternatives sat on one device.]
- **D73 Entries that fail the check are set aside whole, never offered, never dropped.** A purchase record, an undo
  mark or a held alternative that the checker would drop or cut (a missing or impossible field, a credit above its
  units, a name that does not match its text) is moved into `bad: { "<hash>": { from, key, o, i, raw } }`, a group
  of the Bourse section. **`raw` is the entry written out as one JSON text, at most 20,000 characters (a longer one
  is not cut: `raw` is then `{ p0, p1, … }`, pieces of at most 20,000 characters each, joined in order when it is
  read or downloaded); `key` is the hash of the original key when that key is not a safe one.** It has to
  be text: every reading of a save first passes the general cleaner (`save.js` lines 30 to 38 and 197), which drops
  unsafe and over-long keys, cuts deep nesting and shortens long strings, so an entry kept "as it arrived" as an
  object would be altered; one short text passes it unchanged, through a save, a backup, a code and a cloud copy
  (`codec.js` lines 23 to 42). `o` and `i` are the owner and item when they could be read. The pair it belongs to
  (when `o` and `i` are there) becomes an open question (D71 (1): the reason is not stored), whose alternatives are **only the
  valid pairs**; the unreadable entry is listed under them as "one entry could not be read: kept, not selectable.
  Download it." An answer never installs anything from `bad`. A `bad` entry leaves only when the player chooses
  "Discard the unreadable entry" (asked, after the download is offered). **One purchase id with two different
  contents** on the two sides, also when owner, item and quality agree, is a mismatch: both whole pairs become
  alternatives; nothing is merged from them.
- **D74 The build without the setting never merges a count apart from its records.** With `BOURSE.CREDIT` false
  (B26 failed, or the off build of C216), a pair that has a credited record, an undo mark, a `held` or a `bad` entry
  on either side is **one opaque unit**: equal on both sides, nothing happens; different, this device's whole pair
  stays exactly as it is, the other side's is not taken in part, the sync dialog says "Entries made with a setting
  this version does not have differ between your devices. They stay as they are on each device.", and the upload
  leaves the cloud's own values for that pair (as D72 does). The generic rule never touches such a count or record
  by itself. This grouping is the one part of B26 that stays in the code when B26 escalates.
- **D75 Every replacement of the save changes the epoch, and every write checks it.** Restore, "keep", a loaded
  backup or code, and "go back" each store a new random `device.epoch` in the same write. Every write of new code
  carries the epoch its page last read and is refused when the stored one differs ("The saved data was replaced.
  Reload the page."): section writes, the Tracker's own save, Settings' save of characters, and the last local step
  of a sync, from the Tracker and from Settings alike. **In a sync the stored epoch is read twice: immediately
  before the upload (`ET.cloudFinish` uploads before its local step, `cloud.js` lines 220 to 222; with a changed
  epoch nothing is uploaded) and again inside the local write that follows** (with a changed epoch nothing is
  applied and the base is not moved). A save that never had an epoch gets one at the first of those four replacements, so "none on
  both sides" cannot follow a replacement.
- **D76 The old cloud file is consumed once: a shared checkpoint.** The version 2 cloud copy carries `old: { tag,
  marks }`: the `eTag` of the old file as last taken in, and for each of its entries a short fixed hash of its value at
  that time (for a Lists count, the count itself). **A count that has a credited record or an undo mark in the newer
  copy is never "taken or asked" entry by entry: it goes through BY2 with the checkpoint's count as the base, the old
  file as one side and the newer copy as the other, so 10 at the checkpoint, 50 with a 40 credit here and 12 typed on
  an older device give 52.** It is written **in the same confirmed upload** as the merge it records, and travels in the copy, so
  every updated device sees it. Reading the old file: its tag equals `old.tag`: nothing is taken (it was consumed).
  Otherwise, entry by entry: its hash equals the checkpoint's: nothing is taken, **whatever the newer copy holds now,
  a removal included**; it is new or changed against the checkpoint: it is an old-device change and is taken when
  the newer copy's entry still has the checkpoint's hash (or is absent as it was), asked when both changed; it is in
  the checkpoint and gone from the old file: an old-device removal, taken under the same condition. No checkpoint
  yet (the first device to move): the old file is merged as that device's ordinary sync, with its own recorded base
  for the old file, and the checkpoint is written with the first version 2 copy. **A device that moves later does
  two things, in this order.** First, if the old file's tag is not `old.tag`, it folds the old file into the
  version 2 copy by the steps above (as any updated device would) and uploads that with the new checkpoint. Then it
  merges its own save with the version 2 copy, **using the base it recorded for the old file only when that base,
  entry by entry, gives exactly the checkpoint's marks** (the same short hashes, the same counts; no entry more,
  none less). A device's record of the old file holds no `eTag` today (`cloud.js` lines 194, 222 and 229 store
  `{ fileId, at, base }`), so a comparison of tags could never succeed for a real device; the contents can be
  compared. When they agree (the copy has taken in exactly the old file that base describes, so the
  copy descends from it, and an entry another device removed after the move stays removed). In every other case
  (no recorded base; a base whose entries do not match the checkpoint's marks) it uses the careful merge of D80. [Using the old-file
  base whatever its tag: what this device itself added to the old file after the first move would read as removed
  elsewhere, and what it removed there would come back.]
- **D77 "Cheapest listing" needs one of two proofs; else "cheapest seen".** (a) **The slice is complete:** the
  reply's own count of the item's listings (`listingsCount`, found (B1)) is not above the number returned, in every
  region; then nothing was cut and the cheapest of the area is exact. (b) **A selection contract:** the price
  site's own documentation, quoted with its address in the fixtures' README, says the listings returned under a
  limit are the lowest-priced ones; only then is `SLIM_ORDER_VERIFIED` set true, by B20, and a clean ordered slice
  (D69) counts. **B20 checks this and assumes nothing: one sorted reply is not a contract.** With neither, every
  figure from a cut slice reads "cheapest seen" and its craft "partial". The constant starts false. Not verified.
- **D78 A newer-format backup or code is taken in only by a guarded version 2 write.** Loading a version 2 backup
  file or transfer code first makes the guarded write of D64 with the loaded data; only when that succeeded does the
  page take the data over. Where it cannot (no IndexedDB, no room): **nothing is replaced, on screen or in storage;
  the local save and the file stay as they were**; "This backup is in the newer format, which this browser's storage
  cannot hold safely. Nothing was changed. Open it in a browser with full storage, or free some space." A version 1
  backup or code loads, and a backup is saved, on such a browser exactly as today. **Writing version 1 from new code**
  (D64 (b)) is checked inside the write itself each time: the stored save must still be version 1 (another tab may
  have moved it; then nothing is written and the page reloads) and what is written must hold no Bourse section.
- **D79 The first write that needs a trip makes it, in that same write.** "Add to trip", the one-time copy and the
  first tick each run as an `edit` on the stored section (D34): when it holds no `prefs.trip` they set a new random
  id and use it for their keys in the same transaction; when it holds one they use that. Two tabs at once therefore
  share one id; two devices get two ids and the two-trips question of 6.7. Entries under `legacy00` (D66) are moved
  to that new id in the same write, amounts unchanged. **The copy's receipt is written only when at least one item
  was stored under a valid three-part key**, counted after the checker has read the result; with none, no receipt,
  and the next opening tries again.

**In-house red team before round six (2026-11-26).** Where a sentence elsewhere in this file says otherwise, D80 to
D83 rule. The choice for the red team's first finding is D80: **a new, careful merge for the cases without a base,
and fewer such cases** (reasons at its end).
- **D80 Without a base nothing one-sided is taken or dropped unasked: the careful merge.**
  (1) **The fault.** Today's merge, given no base, keeps an entry found on one side only and asks nothing (`merge.js`
  lines 87 and 88); only entries on both sides with different values are asked. An entry removed on one device is
  then "found on the other side only", comes back, and is uploaded to every device. So "merged with no base:
  nothing removed, every difference asked" was false wherever this file said it.
  (2) **The careful merge (new code in `merge.js`).** `ET.threeWay(null, local, remote, { careful: true })`: equal
  entries are kept; entries on both sides that differ are asked as today; **entries on one side only are neither
  taken nor dropped**: they are listed in the result (`oneSided.here`, `oneSided.there`). While either list is not
  empty the caller applies none of them here and uploads none of them, and asks, per module, at most two questions.
  "This device holds N entries the other copy does not have (Tracker: 30 ticks; Lists: 1 wanted item; …). They may
  be new here, or removed on another device. **Keep them** (they go to the cloud and to your other devices),
  **remove them** (they exist only here, so they are gone), or **not now**?" "The other copy holds M entries this
  device does not have (…). They may be new there, or removed here. **Take them**, **remove them from every device**
  (asked once more, with the count: this deletes them in the cloud, and your other devices will remove them too),
  or **not now**?" Each can be opened to its entries and answered entry by entry. **"Not now" decides nothing:** the
  cloud keeps its own value for those entries, this device keeps its own, they stay out of this device's base, and
  the next sync asks again; every other entry syncs. **There is no answer that only "leaves out" an entry without
  saying it is removed everywhere.** What may be uploaded meanwhile: only what decides no one-sided entry, which
  includes D72's publication of a hold (it leaves the cloud's own value for every open entry, one-sided ones
  included; D72 and this rule do not conflict). **A purchase record that holds a credit and is found on one side
  only is not taken by BY2 either: with no base its pair is held (BY2 step 1, D71), on every device but an untouched
  one.** A sync that runs by itself shows this question in the way today's automatic sync shows its own two (the
  tick-removal confirmation, `ui.js` line 1208, and the clash dialog, lines 1213 and 1214): it asks when the page is
  in front, and once declined it does not ask again by itself for the same cloud copy: "Cloud sync waits for your
  answer (Settings → Cloud sync → Sync now)". **Both existing prompts stay exactly as they are; none is removed or
  bypassed by this rule.** No answer: nothing changes, on this device or in the cloud. **Both sides are read from
  what is stored:** the merge is always given this device's stored sections of every module (Settings' sync, which
  today builds a placeholder with no sections, `settings.js` line 294, passes `CC.others` of the stored save), and
  a side that arrives without its sections is an error, never filled from the other side (`merge.js` lines 38 to
  40 do that today). One exception keeps a new device simple: when
  this device's save is untouched (`ET.untouched`, which today looks only at the Tracker's names and ticks, `storage.js` 158 to 161, extended here so that it also requires no other module's entries),
  the other copy is taken whole, as today. Credited pairs are not part of these questions: they follow BY2's rules
  for no base (step 1, D70 (6)), under which a credited record found on one side only, with no base and no matching
  undo mark, holds its pair (D84).
  (3) **Fewer cases.** A version 2 cloud copy is known (D63) when the file's item id and its `root` are the recorded
  ones and its count `n` is not below the recorded one; when it is at most 200 uploads ahead its line must also
  hold the recorded copy id. Beyond 200 the root and the count are enough: the version 2 file is replaced only by
  writes that carry the `eTag` of the copy they read (D48, D67), so every copy with the same item id and root
  descends from every earlier one. **That holds only for writes made from a merge of the copy read.** The owner's
  overwrite of a damaged copy (cloud rule 3) replaces the copy with this device's data, which does not descend from
  it: **an overwrite, like a create, starts a new `root` with `n` 1 and an empty line**, so every other device finds
  the copy not known and uses the careful merge. The 200-upload limit therefore no longer ends in a merge without a
  base, and an overwrite never passes for a descendant.
  (4) **Where the careful merge is used, and only there:** a cloud copy that is not known (a foreign root or item
  id; a missing or partial record on this device); the first sync after a loaded backup or code and after a guard
  Restore (the base was dropped, D67 (3)); a device that moves to the version 2 copy without a usable old-file base
  (D76); the read-back after a create that found another device's copy; two used devices linked for the first
  time. **Everywhere this file says "merged with no base", "no base" or "with none", it means this merge.** The
  one-time catch-up from the save of before the move to the shared save (`ET.catchUpMerge`) is not touched: it is
  shipped, and its own comment states its rule.
  (5) Why this and not only (3): a loaded backup, a restored device and a lost record have no lineage to follow, so
  some merges without a base remain whatever the cloud copy carries; they need a rule that is true. Why (3) as
  well: with the careful merge alone, a phone unused for four days would be asked about every entry.
  (6) Named tests, item B27: **"removals do not come back"** and **"two hundred and one uploads"** (the red-team
  additions, section 10).
- **D81 In a same-device merge, "this device" is the stored save.** When a page's save meets a stored save that
  another page changed (`ET.saveMerge`, `storage.js` line 111; the section merge in `CC.writeSection`), the page's
  own copy is the stale side. **Every rule of this file that says "this device's pair stays" (BY2 step 4, D70 (3)
  and (4), D74) keeps the stored pair there, never the page's copy**; only in a merge with a copy from elsewhere
  (the cloud, a file) is this device's side the one being saved. LI7 and D74's opaque pair hold inside the Tracker's
  whole-save write as well: the pair, its records, undo marks and question in the stored save are written back
  unchanged whatever the Tracker page holds. (The Tracker hears saves announced on `eveniunt-tracker`,
  `storage.js` lines 235 to 239; shared writes are announced on `eveniunt-command-center`, `save.js` lines 677 to
  683; so a Tracker page can hold another module's section from before a Bourse write, and must never be the side
  that is kept.)
- **D82 A missing count is 0, and BY2 decides before LY0.** Lists stores no entry for a count of 0 (`lists/store.js`
  line 301 deletes it). For BY2, LI6, LI7, the alternatives of D71 and the checker, **a missing count is the count 0
  in every quality**; a credited purchase beside no count is an ordinary pair (own part = minus its credits), not a
  malformed one and not a question. BY2 handles every pair it applies to **before** the Lists rule for "removed on
  one side, changed on the other" (LY0, `merge.js` lines 226 to 238) and takes that entry out of LY0's reach: a
  count that went to 0 on one device while another device added to it with a credit merges as 0-side own plus the
  credits, and is not "kept as changed".
- **D83 A browser that cannot hold version 2 does not touch the version 2 cloud copy, and storage does not change
  under a save.** (1) Where new code stays on version 1 (D64 (a) and (b): no IndexedDB, or no room for the guard
  even after D86's clearing), **that browser behaves towards the cloud as an older device does: it goes on syncing
  the old file exactly as today, every module, and never reads or writes the version 2 copy.** To the other devices
  it is an older device, and what it writes to the old file is taken in by D76. It says once: "This browser cannot
  hold the newer save, so it keeps the older one and syncs with your older cloud copy. The Bourse cannot save
  here." Nothing of the Bourse section can therefore arrive in a version 1 save, so D78's check "holds no Bourse
  section" never meets one; if it ever does (a save damaged or hand-made), the page says so and writes nothing, and
  **no code removes the section to make a save pass**. (The earlier wording, cloud sync off for both files, is
  withdrawn: it took sync away from every module on a phone that only lacked space.) (2) **Where the save lives is
  decided once, and the note comes first.** `CC.transact` and `CC.read` today fall back to device storage whenever
  one IndexedDB open fails (`save.js` lines 368 to 400 and 412 to 448). **Before** the first version 2 write, new
  code records in device storage that this browser's save is in IndexedDB; **if that note cannot be written, the
  save is not migrated** (it stays version 1, with D64's sentence). The version 2 write follows; a note with no
  version 2 save behind it (the page closed in between) is harmless: the version 1 save in IndexedDB is read as
  today and migrated at the next write. From the note on, a call whose IndexedDB open fails or is blocked **fails**
  ("The browser's storage is busy or blocked. Nothing was saved. Reload the page.") and never reads or writes the
  old device-storage copy.

**Second in-house red team (2026-11-26).** Where a sentence elsewhere in this file says otherwise, D84 to D87 rule.
- **D84 A rejection can be taken back by a later answer; an Undo cannot.** An open question records the questions it
  grew out of: `prev: { <q>: 1, … }` holds the `q` of every answer it met when it was raised (D71 (4): the same
  question answered differently, or an answer overtaken by a wider question) and the `prev` of those; widening a
  question keeps its `prev`. The answer copies `prev` into its entry. **An answer whose `prev` holds the `q` of
  another answer for the same pair replaces that answer wherever the two meet, in a sync or in a loaded backup.**
  **A rejection mark whose `rq` is in the `prev` of the stored answer, for a record that is in that answer's `alt`,
  is void: it is deleted and removes nothing.** So a record that an earlier answer rejected and a later answer chose
  stays, also when an old backup or a device that only saw the earlier answer comes back. An undo mark without `rq`
  (a real Undo) is never void. Two answers neither of which is in the other's `prev`: D71 (4), a new question.
- **D85 "Made" and a handed-in step are refused when they would change a frozen count, with the reason. (The
  choice for the red team's finding 13.)** Freezing only the frozen ingredient's change inside one write was
  rejected: the craft would be counted and the ingredient not taken, and the answer to the open question would then
  install a count that never saw the craft; recording the missing change for later would be a second kind of pending
  entry. So the whole action is refused, which Lists never did for "Made" before (`lists/store.js` lines 403 to
  410), and it says exactly why and what to do: "Not recorded: there is an open question about <item>, which this
  craft would use. Answer it first." with a button that opens the question. Nothing of the action is written. A
  craft or hand-in that touches no frozen count is written as today.
- **D86 Storage that is short: the price cache gives way first, and it has a limit.** The Bourse's price database
  (`eveniunt-bourse-prices`) shares the browser's allowance with the save and its guard. (1) It holds at most
  60,000 item records in all; the oldest fetched go first when a write would pass that. (2) **When a save's
  transaction fails for space (the first migration or any later write), new code deletes the whole price database
  and tries the write once more**; only if that also fails do D64 (b)'s sentences apply. Prices are a cache: the
  screens then read "not fetched" until the next lookup. (3) The pages show how much the save, the guard and the
  price cache take (Settings, Import and backup), with "Clear saved prices".
- **D87 The collectable count merges inside its pair.** Lists' unit for one owner and item is `{ nq, hq, coll }`.
  BY2 takes the whole unit out of LY0 and the generic rule, so it must merge all three: `nq` and `hq` by steps 1 to
  4; **`coll`, which no purchase credits, as an own part with no credits** (changed on one side, that side's; the
  same on both, that; differently on both, asked together with the pair's own-part question, this device's until
  answered). An alternative of a held question carries all three, and installing it installs all three.

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
unit cost; **whenever those hold fewer units than the amount, the largest remaining stacks are added, one by one,
until the amount is covered or none is left** (also when all held stacks together hold exactly the amount, or less).
Whenever any held stack was left out the row says "priced
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
the current trip (`prefs.trip`, 8 random characters; made by the first write that needs one, inside that write: a
tick, "Add to trip" or the one-time copy (D79), and at every "New trip"); `cr` = units
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
each `{ qty, at, t }` under the key `<trip id>.<item id>.<nq|hq>` (D66; the copy below writes that key with the
current trip's id); removed only by the player ("Remove from trip", asks first) or "New trip".
The copy: the new Tracker, which alone can turn its entry keys into item numbers, writes on loading
`ui.live.mcopy = { v: 1, at, items: { <item id>: <amount> }, skipped }` into its own device record
(`eveniunt-tracker-ui`; `persist()` already stores `ui.live` whole), beside the untouched `mlist` and `mqty`. An
amount that is missing or not a number of 1 or more counts 1 (what the Tracker showed); two entries of one item are
added; an entry without an item number, unknown to the index or untradable is skipped and counted. The Bourse page, on
opening, reads that record (same site address only) and, if it holds items, sends one `CC.writeSections` whose `check`
cancels when `doc.device.bourse.mcopy` is already set, whose Bourse part is an `edit` that adds each item as
`<trip id>.<item>.nq` (the current trip's id, made in this write when there is none: D79) to the `extra` stored at that moment (the larger of the stored and the copied amount; over 99,999 becomes
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
  held:   { "<owner>.<item id>": { q, prev, alts: { <h>: <pair> } } | { q, prev, ans, alt } },    an open or answered pair question (D71, D84; no reason is stored)
  bad:    { "<hash>": { from, key, o, i, raw } },                      entries that failed the check, kept whole (D73; raw is text, in pieces when long)
  extra:  { "<trip id>.<item id>.<nq|hq>": { qty, at, t } },                     the trip's own items
  bought: { "<purchase id>":     { o, i, q, n, of, cr, ls, t, at } },  o: c1..c8, u, or x (own item); q: nq|hq
  undone: { "<purchase id>":     { o, i, q, at } },                    a credited purchase that was undone
  prefs:  { area: { <data-center name>: 1 }, home, oldDays, dropDays, split, within, route, tick, gatherFree, taxCity,
            rankBy, alerts, alertMin, trip, lists: { <list id>: 1 } } }
```

- **Checker `CC.checkBourse`**, added to `CHECK`: always the whole frame in that key order; no arrays; no size limit;
  a watched item or an own item is dropped only when malformed (bad key; no `target`; no `qty`); **a purchase, an
  undo mark or a held alternative is never dropped and never cut: one that fails the check is moved whole into
  `bad` (D73)**; elsewhere a bad field is left out, never repaired. A purchase id and a trip id are 8 to 16
  of `a-z0-9`. Ranges: `target` 1 to 999,999,999; `qty` 1 to 99,999; `n` 0 to 999,999 (0 is a check record); `of` 0
  to 999,999; `cr` 0 to `n`; `ls` 12 of `a-z0-9`; `oldDays` 1 to 30; `dropDays` 1 to 90; `within` 0 to 100;
  `alertMin` 15 to 240; `split` `fewest|cheapest|within`; `route` `savings|items`; `tick` `only|lists`; `rankBy`
  `sales|listing`; `area` keys 1 to 32 letters with the value 1; texts up to 40 characters. A default is not stored.
  A purchase that arrives without `ls` or `t` (a hand-made or partial import) is kept and its row is to check; a
  purchase whose `cr` is over 0 while Lists holds no count for its owner and item is kept **as an ordinary pair
  with a count of 0 (D82): Lists stores no entry for 0, so this is what a credited purchase looks like once the
  stock was used up; nothing is asked**. Page limits (edit functions only; the save may hold more, section 6.5): 200 watched, 500 own items, 2,000
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
  0. **A malformed or mismatched pair is held at once (step 4), before any arithmetic** (D70 (7)).
  1. **Records.** A record on either side is kept, **unless either side holds its matching, valid undo mark: then it
     is removed on both, with a base or with none** (D70 (6)), and its credit leaves the count with it by step 3. A
     record the base held that one side lacks **with no undo mark on either side** is unexplained (a partial
     restore, a dropped entry): **it is never taken as an Undo; the pair is held (step 4).** With no base, own parts
     that differ are held as well, and so is a pair whose credited record is found on one side only with no matching
     undo mark (D84; an untouched device takes the other copy whole). A missing count is 0 (D82), and this rule decides a pair before LY0 can.
  2. **Own part.** Changed on one side, that side's; changed the same on both, that; changed differently on both,
     asked, this device's until answered, the question showing each side's own part plus the merged credits, which
     are the two counts as the player would see them. This keeps the rule: count = own + credits.
  3. **Count** = own + credits of the records the merge ends with, **when that lies within 0 to 999,999**.
  4. **Otherwise the pair is held.** Nothing of the pair changes on this device: its count, its records and its undo
     marks stay exactly as they were, a state that kept the rule before and keeps it now ("this device" is the
     stored save when the merge is between a page and the stored save, D81). **The Bourse section records the open
     question in D71's form, `held["<owner>.<item>"] = { q, alts }`, with every differing pair whole** (no reason and
     no time are stored). **While it is open, every later merge leaves this device's pair alone, whatever the other
     side holds, adds any pair it has not seen as a further alternative, and raises the question again**, listing
     every alternative (D71 (2)) with the reason in words. An answer installs the chosen pair whole, which keeps the
     rule, marks the records it rejects as undone, and **replaces the question by the answer entry** `{ q, ans,
     alt }` (D71 (3)); it does not delete the entry. No
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
    sync is the careful merge of D80: entries found on one side only are asked, never taken or dropped by themselves.
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
- **Version 2 and older copies (D32, D60, D61, D64, D67).** `CC.VERSION` becomes 2 in the release D60 allows. New
  code reads version 1 and 2. **It writes version 2 only together with its guard, in one transaction, and version 1
  where that cannot be done (D64, D78); it never writes version 2 alone.** The version 2 cloud copy is a file of its
  own (D67), and a version 2 backup or code is taken in only by a guarded write (D78). Older pages
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
  and a Bourse tick are refused while the offer is open; control: both write once it is answered); **"no version 2
  without its guard"** (D64: on fallback storage and when the transaction fails for space the save stays version 1,
  byte for byte, and the reason shows; control: with room on IndexedDB the same step migrates and guards);
  **"a stale offer"** (D65: an offer answered after another tab restored changes nothing and opens again).
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
     race: the copy read is merged by the careful merge (D80) and written back with its `eTag`.** Safety does not rest on the
     service honouring the create condition: a create that was silently replaced later is caught by rule 4.
  3. **The owner's overwrite replaces only the copy the question was about.** The "damaged" error carries that copy's
     item id and `eTag`; the question is asked with them in hand; `ET.cloudOverwrite` sends that `eTag` and writes
     nothing when it has none. "Changed since" (another device repaired or replaced the copy while the question was
     open), a missing tag or another item id: **nothing is overwritten; the sync reads again**, merges if the copy is
     now sound, and asks again, about the new copy, only if it is still damaged.
  4. **Lineage (D63).** Every upload carries its copy id and its line. A copy that is not a known descendant is
     merged by the careful merge of D80 (one-sided entries asked, nothing taken or dropped unasked). **This rule is about the version 2 file only.** An older app cannot reach that file
     (D67), so "an older app replaced the cloud copy" can no longer happen to it, and the earlier sentence that the
     older device is then refused until it updates is withdrawn: an older device keeps its own file, is refused
     nothing by the cloud, and what it writes there is taken in by D76.
  **Round four (D67) changes these rules.** The version 2 copy is a file of its own, under a new name; the old file
  is only read. Rule 2's create is sent only while `ET.CLOUD_CREATE_VERIFIED` is true; the read-back stays as a
  second check and is no longer what the plan relies on. Rule 4's "known" includes the exact, unchanged copy, and
  the base lives and dies with the identity it was recorded for. A replace addresses the item id; a write that is not
  confirmed advances nothing.
  **Who verifies the create-only route, and when:** B27's builder quotes Microsoft's documentation for the route
  used; **the owner, or the orchestrator with the owner present, runs D67 (2)'s ten refused creates on the real
  personal OneDrive before the version-rising release is offered for `ship`**; B12 writes both into
  `docs/STATE.md`. Until then the constant stays false and new code creates no cloud copy. Not verified by anyone
  yet.
  Tests in item B27 ("older" names its commit): **"missing-file race", rewritten for two files (BV-8)** (`<old>`
  finds no old file; the newer device creates the version 2 file; the older then uploads its copy: it lands in the
  old file; the version 2 file is byte for byte untouched; the newer device's next sync takes the old file's entries
  in by D76, removes nothing, and never writes the old file; the older device's next sync works on its own file and
  is refused nothing; control, kept only as a witness of the old fault: at `<base>`, with one file name, the same
  upload replaces the newer copy); **"a late second create"** (BV-22, which replaces the earlier "create condition ignored": a later rescue no longer
  passes; with the route refusing, the second device gets "already exists" and merges; with the create route
  unverified, no device creates and both say why); **"same-version replacement"** (a version 2 copy with a foreign line: no base, nothing removed; control: a
  true descendant merges with its base and takes a removal); **"missing checkpoint"** (the device's record lacks the
  copy id, or names another item id: the careful merge, and the test asserts what that means: an entry this device
  alone holds is neither uploaded nor dropped before the answer); **"restored checkpoint"** (a device restored from
  a backup: the base is forgotten, so the careful merge; **and a device whose record is intact but 201 uploads
  behind: the copy is known by root and count, the recorded base is used, and a removal made elsewhere is taken**,
  D80 (3)); **"repaired while
  the question is open"** (device A is asked about a damaged copy; device B replaces it with a sound one; A says
  yes: nothing is overwritten, B's copy survives byte for byte and is merged; control: with no second device the
  overwrite goes through with the shown copy's `eTag`); **"no tag, no replace"**.
- **On the device only:** every price, sale, tax rate and attempt time (`eveniunt-bourse-prices`), the ledger
  (`eveniunt-bourse-ledger`), `eveniunt-bourse-device` (last view, which alerts rang), `eveniunt-bourse-alert`, the
  guard, and in the save's device-only part `device.bourse` (`mcopy`; `done`, the purchase receipts of the last 24
  hours; `device.epoch`, D70 (8); never in backups, codes or the cloud). The open pair questions are **not** kept
  here: `held` is part of the Bourse section and travels with it (D70).
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
  lower-numbered success arriving after a higher-numbered success change nothing in the cache, also with equal clock
  times and with the clock set back between them; a deadline passed is failed; control: a higher-numbered answer
  replaces; "a refusal out of order" (D68): a lower-numbered answer 429 arriving after a higher-numbered success
  leaves the cached success as it is and still starts the pause; control: a lower-numbered ordinary failure starts
  none**).
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
  both sale bases, each with its own profit figure; **beside those figures, in the row itself or in a labelled
  detail one tap away, the sample ("from N sales in 7 days") and the seller's rate used ("after 3% in <city>"), at
  1,440 and at 360 px, with nothing cut; the check reads both texts at both widths and fails when either is only
  in the Ranking head**;
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
  **the two records D67 (2) asks for (the documentation quoted, the ten refused creates on the real OneDrive) and
  that `ET.CLOUD_CREATE_VERIFIED` was set true only after them; if either is missing the release is not offered for
  `ship` and the item escalates**; what
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
  kept, never changed, with no Undo offered; **two comparisons, never one over the whole save: (1) a merge of two
  such saves gives, in every field the code at `<base>` can hold (characters, the Tracker's, Atelier's, Lists',
  Submersibles' and Settings' sections), byte for byte what the code at `<base>` gives; (2) on the off build's own
  terms: the Bourse section's purchases, undo marks and held entries are byte for byte what went in, `modules.lists`
  is unchanged by a tick, and no part of rule BY2, LI6 or LI7 runs (the test plants a pair that the rule would hold
  and sees it merged by the generic rule); the off build is made and run even when B26 passed**; control with the
  constant true: the same tick writes both halves, and an ordinary tick marks in both builds). Accept: `CHECK_ONLY=C208,C216 npm run
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
  this item's changes to `merge.js`, `save.js`, `ui.js` and `settings.js` are taken out again except D74's opaque
  grouping of credited pairs, which the off build keeps (round five), check C216 is the proof of the fallback, and the
  owner is told.**
- **B27 The cloud copy (Sonnet builder; after B24).** Files: `tracker/src/core/cloud.js` (D48, D63: no replace
  without a tag; create, then read back; the copy id and line; `sync.drive` with item id, `eTag` and copy id; no base
  for a copy that is not a known descendant; `ET.cloudOverwrite` with the shown copy's item id and `eTag`),
  `tracker/src/app/ui.js` and `tracker/command-center/src/settings.js` (both callers: the overwrite question carries
  the copy's identity; the older-app line; a refused overwrite reads again), the cloud test file B28 names (BV-8,
  rewritten against the two files as section 8 now words it: the older upload lands in the old file and is taken
  in by D76; its earlier expected result, "the older device's next sync is refused", is void;
  "missing-file race"; BV-9 replaced by BV-22 "a late second create" (see the round-four additions); BV-10 "changed since read"; BV-11
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
  meanwhile", for each page, each with its control; BG-7 (replaced, round four) "no version 2 without its guard":
  on fallback storage and in memory new code leaves a version 1 save version 1, writes the other modules as today,
  refuses Bourse writes and shows D64's sentence; a version 2 cloud copy is not merged there; control: on IndexedDB
  with room the same save migrates; BG-8 a save with no guard yet (the first run of new code over a version 1 save) is read
  and written normally and gets its guard), `check.js` C217 (in a browser: the offer on each of the seven pages,
  Restore from one of them, and the other open pages follow), rebuilt copies. Accept: unit suite;
  `CHECK_ONLY=C119,C122,C145,C146,C217 npm run check`. Escalate if: an existing save test needs an edit, or the
  guard cannot be written in the same transaction as the save on IndexedDB.

**Round-four additions to the items (binding; each belongs to the item named, is built and run with it, and names its
control).**
- **B2.** PX-14 as amended above.
- **B3.** BS-8 "the first version 2 write has no room": the transaction is made to fail for space: the stored version
  1 save is byte for byte as before, no guard exists, the next write is version 1, the sentence of D64 shows;
  control: with room the same write stores version 2 and its guard. BS-9 the `extra` upgrade of D66: a two-part key
  with `t`, one without, and both forms present; control: a three-part key is left alone. BS-10 the checker keeps a
  `held` entry with both alternatives whole and drops one with an alternative missing. Files add nothing.
- **B5.** BM-7 adds "a dropped cheaper row": North America's slice holds a valid listing at 120 and an entry at 90
  with no world, which is dropped: the figure reads "cheapest seen", never "cheapest listing"; "out of order": prices
  120 then 100 in the reply: "cheapest seen"; control: a clean, ordered slice in every region: "cheapest listing".
- **B7.** C202 and BP-9 add the pictured route: home Gilgamesh (Aether); stops Exodus and Famfrit (Primal), Odin
  (Light): **2 data-center hops, 1 region hop**, counted from consecutive places of the route with the home world as
  the first; control: a trip that stays on Aether counts 0 and 0.
- **B8.** C201's sample is one a reader can check by hand: 40 held sales that reach back 1 day, cut: "at least 5.7 a
  day"; 14 sales over the 7 days, not cut: "2 a day"; the second profit figure is worked out in the check from the
  shown asking price, the city rate and the shown material cost, and must equal the row's.
- **B10, B13.** BT-4's "two new trips" uses **the same item and quality with different amounts** (3 on one device, 5
  on the other): after the merge both units exist under their trips' keys, each answer shows its own amount, the
  other is kept; the copy writes the current trip's key; control: one trip, one unit.
- **B11.** C206 also reads, at 360 px and at 200% text size, the home-world source sentence in full, as text outside
  the picker; and the hourly-limit text of D27 word for word.
- **B12.** As amended above.
- **B15.** BA-14 "changed while waiting": a watch request waits behind a pause or in the queue; the target, the area
  or `oldDays` changes before its turn: it is not sent (the dispatch decision refuses it); control: unchanged, it is
  sent when the pause ends.
- **B16, B25.** BP-15 adds "exactly enough": 1,000 needed, the 300 cheapest hold 600, the one other stack holds 400:
  the plan covers 1,000 with that stack and reads "1,000 of 1,000 found"; "more than enough" (the other stack holds
  500, as before); "a true shortfall" (the other stack holds 300: every stack is weighed, "900 of 1,000 found");
  control: 300 stacks or fewer, no label.
- **B18.** BL-14 "a refusal after a later success" (D68 (1)), with the control that an ordinary late failure starts
  no pause. BL-15 "a deadline is not an ending": a tab is frozen with a request open, its deadline and 25 seconds
  pass, its request lock is still held: other tabs still count the slot as taken and never have a third request in
  flight; when the tab closes or the request ends, the slot is free; when the browser stand-in cannot report locks,
  one slot stays taken; control: an ended request frees its slot at once. BL-16 a watch request whose inputs changed
  is refused at the dispatch decision; control as BA-14.
- **B21.** C216 as amended above. C208 adds: a tick, an Undo and a typed count for a held pair are refused with the
  sentence of D70 (4), in the Bourse and in Lists; control: another item on the same pages is written.
- **B24.** BV-21 the older app's two unconditional uploads, as two separate cases, each made **after** the newer
  device wrote its copy: the older Tracker's "no file seen" upload and its "replace the cloud copy" both land in the
  old file; the version 2 file is byte for byte untouched; the newer device's next sync reads the old file, merges it
  by the checkpoint of D76 (not by a merge without a base), removes nothing; control: at `<base>`, with one file name, the same upload replaces the newer copy.
- **B26.** Files add `tracker/src/core/storage.js` only if B28's inventory shows a caller that drops the holds a
  merge returns; D70 needs no other storage change. Cases, each through the real cloud path and the real local path,
  each checking the bytes of **both devices' saves and of the cloud copy**: BK-16 "declined": the sync dialog is
  closed without an answer: this device's save holds the `held` entry with both alternatives, nothing was uploaded,
  both live pairs are as before; BK-17 "reload": the same after the page is reloaded and after three more syncs;
  BK-18 "Settings": the hold is created and kept by a sync started from Settings; BK-19 "unrelated edits on both
  sides": each device then changes other items and syncs: those merge, the held pair and both alternatives are
  unchanged on both devices and in the cloud; BK-20 "one device never returns": after one upload the cloud copy
  alone yields both alternatives; BK-21 each answer, met by the other device, installs the same pair there; two
  different answers are asked again; an answer against a changed entry is refused; BK-22 "Undo with no base": a
  backup with a count of 50 and a 40-credit record is loaded on one device, the other holds 10 and the matching undo
  mark: merged 10, the record gone, the mark kept, no question; control: without the undo mark the pair is held;
  BK-23 "malformed": a loaded file whose record and undo mark sit on the same side, and one whose id names another
  item: held before any count is computed, this device's intact pair unchanged; BK-24 a load with a held entry: it
  stays when the live pair equals an alternative and is removed otherwise, in both orientations; BK-25 "a page left
  open across a load": its Lists write is refused by the epoch even though no credit and no undo mark is left;
  control: a page that read after the load writes. BK-10 to BK-12 now also assert that the entry holds both
  alternatives. The earlier phrase "held is kept in the device-only part" is void.
- **B27.** Files add the new file name in `cloud.js` and `ET.CLOUD_CREATE_VERIFIED`. BV-9 is replaced: "the create
  condition ignored" is no longer passed by a later rescue. BV-22 "a late second create": device A creates and reads
  its copy back; device B, which saw no file earlier, creates afterwards; A never syncs again: with the route
  refusing (the verified behaviour) B gets "already exists", reads A's copy and merges, and A's entries are in the
  cloud; with `ET.CLOUD_CREATE_VERIFIED` false neither device sends a create and both say why; control: one device
  alone, constant true, creates. BV-23 "the unchanged copy": a second sync with nothing changed in the cloud and one
  entry removed here: the base is used and the removal is uploaded, the entry does not come back; control: a foreign
  copy with the same content brings it back as a question. BV-24 "the target is gone" and "no confirmation": a
  replace answered "no such item", and one answered without item id and `eTag`: base, identity and the synced line
  are as before and the next sync reads again; control: a confirmed replace advances all three. BV-25 "after a
  guard Restore": the base is dropped and the next sync merges with no base. BV-26 the old file is never written by
  new code (every request the stand-in receives is checked) and is read again when its `eTag` changed.
- **B28.** Reports also the cloud file's present name and how `cloud.js` builds its address.
- **B29.** BE-5: the version check and the erase are one transaction (a save that becomes newer between the click
  and the write is not erased); BE-6: when the erase is refused or fails the page does not say it erased and does
  not reload; controls: BE-1.
- **B30.** Files: as before. BG-9 "no room": D64 (b) on a save already version 2: the write is refused, save and
  guard byte for byte as before, the page says not saved; control: with room it writes both. BG-10 "cut off
  part-way": the transaction is aborted after the save and before the guard, and the other way round: neither
  changed; then the erase of `<old0>` runs and the restore offer gives back the last complete pair; control: an
  uninterrupted write. BG-11 "a stale offer": two tabs show the offer; one restores and a tick is saved; the other
  tab's Restore, and its "keep", change nothing and open the offer anew (which now finds nothing to offer); control:
  the first tab's Restore. BG-12 "keep" with a readable version 1 save: adopted as version 2, the old guard's data
  kept under its own key; with a missing, a blank and an unreadable save "keep" is not offered and "Download both
  copies" is. BG-13 "sync waits": while the offer is open neither the Tracker's nor Settings' sync reads or uploads,
  also one already started (its upload is not sent); control: after the answer the sync runs. BG-5 is read with
  BG-12.

**Round-five additions to the items (binding; each belongs to the item named, is built and run with it, and names its
control).**
- **B3.** `checkBourse` holds `held` in D71's form and the group `bad` (D73). BS-10 is replaced: a `held` entry
  whose alternative's name does not match its text, or whose alternative is malformed, is not dropped: the
  alternative goes to `bad` whole and is never among the choices; run through the real readers of a backup, a code
  and a cloud copy (`codec.js`, `save.js` `checkModules`), with the bytes of the `bad` entry compared before and
  after; control: a well-formed entry is stored unchanged. BS-11 a malformed purchase record and a malformed undo
  mark go to `bad` the same way, and their pair becomes an open question (no `why` is stored, D71 (1); the screen
  says "an entry could not be read" because a `bad` entry names that owner and item); control: well-formed ones stay
  in place. BS-12 (D78) "a newer backup on a browser limited to version 1": on fallback storage, and on IndexedDB
  with no room, a version 2 backup and a version 2 code are not taken in: the stored save is byte for byte as
  before, the page still shows the old data, the sentence shows; on the same browser a version 1 backup loads and a
  backup is saved as today; control: with full storage the version 2 backup loads and is guarded. BS-13 "version 1
  is not written over version 2": new code about to write version 1 finds the stored save already version 2
  (another tab moved it): nothing is written; control: still version 1, it writes.
- **B5, B20.** BM-7 adds "clean and sorted, but cut": a region's slice of 10 is clean and in order, the reply's own
  count says 37 listings exist, `SLIM_ORDER_VERIFIED` is false: "cheapest seen", "partial"; "complete": the count
  says 6 and 6 are held, in every region: "cheapest listing"; control for the contract: the constant set true in the
  test, the same cut slice: "cheapest listing". B20's report states which of D77's two proofs exists, quotes the
  documentation or says none was found, and leaves the constant false in the second case; B20 does not escalate for
  that.
- **B8.** C201 as amended above.
- **B10, B13.** BT-10 "cold Add to trip": a save with no `prefs.trip`: one write stores the item under
  `<new id>.<item>.<q>` and the id in `prefs.trip`; after a reload the row is in the current trip. BT-11 "cold
  copy": the same for the one-time copy, and its receipt exists; "nothing valid": a copy whose items all fail the
  check stores no receipt and tries again at the next opening. BT-12 "two tabs, first use": both add at once: one id,
  both items under it. BT-13 "legacy items": entries under `legacy00` move to the first id made, amounts unchanged.
  Control for all four: a save that already has a trip id keeps it.
- **B13, B21.** C208 widens "a held pair is frozen" to every path that changes that count: the typed count, plus and
  minus, Lists' "Bought it", "Made" (a craft that would add to it or take from it), a step handed in, Lists' own
  Undo, a Bourse tick and a Bourse Undo: each is refused with the sentence, in the write itself (the test also sends
  the write directly, past the page), and the stored count, records and question are byte for byte as before;
  controls: each of the same eight actions on another item of the same owner is written.
- **B21.** C216 adds (D74) "two histories, setting off": one save holds 50 with a 40-credit record, the other 10
  with the matching undo mark; merged by the off build through the cloud path, through a loaded backup and through
  the same-device path: on each device its own pair is byte for byte as before, no save anywhere holds the record
  and its undo mark together, the sentence of D74 shows; the same two saves opened afterwards by the build with the
  setting on merge to 10 by BY2; control: two saves without any credited record, undo mark, `held` or `bad` entry
  merge by the generic rule exactly as at `<base>`.
- **B26.** Files add what D72 needs in `tracker/src/core/cloud.js`, `tracker/src/app/ui.js` and
  `tracker/command-center/src/settings.js` (the publication after a decline, also on Settings' "open the Tracker"
  path; the local-only wording). On escalation everything of this item is taken out again **except D74's grouping**.
  Cases, each through the real cloud path and the real local path, bytes of every device's save and of the cloud
  copy compared:
  BK-26 "independent discovery" (D71 (1)): two devices each find the same two pairs, at different clock times and in
  both orders of syncing: their `held` entries are byte for byte equal and merge as one unit with no question about
  the entry itself; control: a third pair on one device gives a different `q`.
  BK-27 "a late answer to a superseded question": A and B hold question Q1 (two pairs); C's pair joins on B, making
  Q2; A, offline since Q1, answers Q1 and syncs: on B and C nothing is installed, Q2 stays open with A's present
  pair among its alternatives, C's purchase is in no way removed; A, meeting Q2, is frozen again; control: an answer
  to Q1 met by a device still holding Q1 installs the chosen pair.
  BK-28 "conflicting answers with edits after one": A answers Q1 with the first pair and then ticks a further
  purchase; B answers Q1 with the second: neither is applied to the other; a new question holds A's present pair
  (with the later purchase) and B's, whole; control: equal answers on both, then A's later tick merges by BY2 from
  the chosen pair as base.
  BK-29 "a third device's purchase" (D71 (2)): A and B each hold 999,999 with their own purchase of 9 and share a
  question; C, offline, holds 999,999 with a third purchase and then syncs: the question has three alternatives on
  every device and in the cloud; choosing one is the only way the others leave; no state exists in which C's record is gone without having been
  shown; control: C's pair equal to A's adds nothing.
  BK-30 "the hold is published" (D72): first discovery on A, the dialog is closed: one upload is made that changes
  no asked entry and no live pair in the cloud and adds the question; B pulls and has every alternative; **A never
  returns**: the cloud copy alone yields them; an unrelated entry A had changed is in the cloud too; control: with
  the upload made to fail, A shows "saved only on this device", the sync line does not read "Synced" alone and the
  backed-up time is unchanged.
  BK-31 "an invalid side" (D73): a loaded backup and a cloud copy each carrying a credit above its units, and one
  carrying one purchase id with two contents: the unreadable entry is in `bad` on every reading, the question offers
  only valid pairs, an attempt to answer with the `bad` entry's name is refused and changes nothing, this device's
  valid pair is byte for byte unchanged; control: the same files without the fault merge by BY2.
  BK-32 Settings and both reconciliations: BK-26 to BK-30 are run once more with the sync started from Settings and
  with an edit made on this device while the sync was running, so that both of `cloud.js`' merges and Settings' base
  rebuilding are passed with a question open; the base keeps the old value for the held pair.
  BK-16 is amended: after a declined dialog the question is on this device **and**, by D72, in the cloud; "nothing
  was uploaded" holds only in its failing control. BK-21 is replaced by BK-27 and BK-28.
- **B27.** BV-8 as rewritten in section 8. BV-27 "the old file is consumed once" (D76): device A moves first and
  takes in the old file with entry X; A removes X; **B moves second, the old file unchanged**: X is not taken from
  the old file, and B's own copy of X is removed by its recorded base: X stays removed everywhere. The other order
  (B first) gives the same. "An unrelated later edit": an older device changes entry Y in the old file: Y is taken,
  X is not brought back. "A real old-file edit of X": the older device changes X itself after the checkpoint: X is
  a real old-device change against a removal here and is asked. The checkpoint is absent from the cloud when the
  upload that would carry it is not confirmed. Control: with no checkpoint in the copy (the fault), B's move brings
  X back. BV-26 is read with BV-27.
- **B30.** BG-14 "a stale edit after keep" (D75): two tabs; one answers "keep"; the other, opened before, saves a
  Lists count, a Tracker tick and a Settings character name, and finishes a sync it had started: each is refused
  with the epoch sentence and the stored save is unchanged; the same after Restore; control: a tab opened after the
  answer writes all four. BG-15 a save with no epoch before "keep" has one after it. BG-16 "no way down": a browser
  that held a version 2 save on IndexedDB and now offers only fallback storage reads no save there and never writes
  a version 1 save over the version 2 one (they are different stores; the page says the newer save is not available
  in this mode); control: IndexedDB back, the version 2 save opens unchanged.

**Red-team additions to the items (before round six; binding; each belongs to the item named and names its
control).**
- **B24, B27 (D80).** Files add the careful merge to `tracker/src/core/merge.js` (B24) and its two questions to
  `tracker/src/app/ui.js` and `tracker/command-center/src/settings.js` (B27); `root` and `n` to `cloud.js` (B27).
  BV-28 **"removals do not come back"**: a phone and a PC share a save; the PC unticks 30 Tracker entries, removes
  one wanted item in Lists and starts a new trip; the phone's record of the cloud copy is then removed (and, as a
  second run, a backup is loaded on the phone; and, as a third, a guard Restore is made): the phone's sync applies
  nothing and uploads nothing, the question names 30 ticks, 1 wanted item and the trip's entries as held here only;
  "remove them here" removes them and nothing comes back on the PC; "keep them" uploads them; an unattended sync
  stops with its sentence and the cloud copy is byte for byte unchanged. **Control, which must fail without the new
  code: the same three runs through `ET.threeWay(null, …)` as it is at `<base>` bring all 32 entries back with no
  question and upload them.** A fresh device (untouched save) takes the cloud copy whole with no question.
  BV-29 **"two hundred and one uploads"**: the PC makes 250 uploads while the phone is away, removals among them;
  the phone's next sync finds the copy known (same item id and root, a higher count), uses its recorded base and
  takes the removals **with no careful-merge question; today's confirmation for ticks another device removed
  (`ui.js` line 1208) still shows, exactly as at `<base>`, and the test asserts that it does**; control: the same copy with another root is not known and goes to the
  careful merge. BV-15's "201 uploads behind: no base" is replaced by this. Every test of this file that says "no
  base" (BV-9, BV-13, BV-14, BV-21, BV-25, BK-22, BK-13) asserts the careful merge's behaviour for one-sided entries,
  not only that no base was used.
- **B26 (D72, RT-2).** BK-33 "a decline does not undo a removal": device B removes wanted item W; device A's sync
  makes a question on a pair and A closes the dialog: after the publication A's save no longer holds W and A's base
  no longer holds W, in one write; A's next sync does not bring W back anywhere; with the local write made to fail
  after the upload, A's base still holds W and A's save still holds W, and the next sync takes the removal;
  control (the fault): a base moved without the save brings W back.
- **B26, B23 (D81, RT-3).** BK-34 "a stale Tracker page": the Tracker page loads with a count of 10; the Bourse adds
  40 with a credit (50, record R); a sync from Settings makes a question on that pair; the player ticks any Tracker
  entry: the stored save still holds 50, R and the question, byte for byte, and the tick is saved; the same with
  the setting off (D74's opaque pair) and with a plain credited pair and no question; control: a Tracker page loaded
  after the Bourse write saves the same bytes.
- **B27 (D76, RT-4, RT-5).** BV-27 adds: "a later mover that wrote to the old file": A moves at old-file tag e1; B,
  still on the older app, adds Y and removes Z and syncs (tag e2); B updates: Y is in the version 2 copy and on
  every device, Z is removed on every device; control (the fault): B's old-file base used directly deletes Y and
  brings Z back. "A count on the old file": the checkpoint holds a count of 10; A adds 40 with a credit; an older
  device types 12: merged 52, no question; control: a count with no credit and no undo mark is taken or asked entry
  by entry as before.
- **B26 (D82, RT-6).** BK-35 "used up": a count of 40 from one credited purchase; "Made" uses all 40, so Lists
  deletes the entry: every reading of the save shows an ordinary pair, no question, and the item is not frozen;
  meanwhile another device adds 10 with a credit: merged 10 with two records, not 50; control: the same merge with
  BY2 run after LY0 keeps 50.
- **B26 (D71 (3), RT-7).** BK-36 "a rejected purchase stays rejected": an answer chooses A's pair; C's record (credit
  9) is not in it; a fourth device, and a backup loaded later, still hold C's record: after their merges the record
  is gone everywhere and no count rose by 9, with a base and without; control: without the mark the answer writes,
  the 9 come back.
- **B26 (RT-11).** BK-26 is run with two devices whose bases differ (one finds the pair "over the limit", the other
  "a purchase is missing"): their entries are still byte for byte equal.
- **B3 (RT-9, RT-12, RT-8, RT-13).** BS-11 adds: a malformed purchase whose text holds a key of 80 characters, 12
  levels of nesting and a string of 30,000 characters: its `raw` text is the same after a save, a backup, a code and
  a cloud copy (and is marked cut at 20,000); control: stored as an object it comes back altered. BS-7 is amended:
  new code writes a version 2 code as `EVT3-…`; the files at `<old>` refuse it with their shipped sentence and
  load no part of it; new code reads `EVT1-`, `EVT2-` and `EVT3-`; control: the same data written as `EVT2-` is
  loaded by `<old>` with its Bourse section (the fault). BS-14 "version 1 and the cloud" (D83 (1)): on a browser
  with no room for the guard, a sync neither reads the version 2 copy into the save nor writes any file; a Tracker
  tick made offline afterwards is saved and survives a reload; a version 1 save that does hold a Bourse section is
  not written and not stripped; control: with room, the same sync merges. BS-15 "one home for the save" (D83 (2)):
  after a version 2 save exists in IndexedDB, a call whose IndexedDB open is blocked fails with its sentence and
  neither reads nor writes device storage; control: a browser that never had IndexedDB uses device storage as today.
  BG-16 is read with BS-15, which is its mechanism.
- **B30, B27 (D75, RT-14).** BG-14 adds: a sync that read the cloud copy before a "keep" sends no upload after it
  (the stand-in cloud receives none); control: with no replacement in between the upload is sent.
- **B22 (RT-15).** C205 adds: an old four-part record fetched ten minutes ago is asked again at the next permitted
  fetch, not after the hour; control: a six-part record of the same age is not asked again.

**Second red-team additions to the items (before round six; binding; each belongs to the item named and names its
control).**
- **B24, B27 (D80 (2), finding 1).** Files add `tracker/command-center/src/settings.js` (the sync's state carries the
  stored sections) and the stricter `ET.untouched` in `tracker/src/core/storage.js`. BV-28 adds **"Lists entries and
  no characters"**: a phone holds Lists counts, an Atelier macro and a Bourse undo mark that were never synced, and
  no characters (after "Erase everything", and as a second run on a device that only ever used Lists); Home is
  opened and Settings' automatic sync runs: this device's Lists, Atelier and Bourse sections are byte for byte as
  before, the save is not "untouched", and the careful merge asks about what each side alone holds; the undo mark is
  still there and no count rose; control (the fault, which the plan must not rely on): the code at `<base>` replaces
  the three sections with the cloud's. A device with placeholder names, no ticks and no entry in any module takes
  the cloud copy whole, as before.
- **B26 (D84, finding 2).** BK-37 "a rejection taken back": A answers Q1 and rejects B's record R; A saves a backup;
  B answered Q1 differently, the new question is answered with B's pair, which holds R; then A's backup is loaded
  on a device, and a device that only installed A's answer syncs: R and its credit stay everywhere, the old
  rejection mark is deleted, no question; control: a real Undo of R (no `rq`) removes it in the same two runs; and
  without `prev` (the fault) the old mark removes R silently.
- **B26, B27 (D80 (2), finding 3).** BK-38 "a purchase one side alone holds, no base": a count of 10 with a 40 credit
  (50), synced; an older backup is loaded, which drops the record (10): the next sync does not put the count back to
  50: the pair is an open question with both pairs; on an untouched device the same record is taken with the copy;
  control (the fault): BY2's step for equal own parts takes the record unasked.
- **B27 (D80 (3), finding 4).** BV-30 "an overwrite is not a descendant": A last synced at upload 40, C at 50; the
  copy is damaged at 299; A overwrites: the new copy has a new root and count 1; C finds it not known and is asked
  about what it alone holds; nothing added between 40 and 50 is removed unasked; control (the fault): the same root
  with count 300 lets C use base 50 and remove them.
- **B27 (D80 (2), finding 5).** BV-31 "three answers": "take them" brings the entries here; "remove them from every
  device" asks once more with the count and then a third device, whose base held them, removes them (its own
  confirmation for ticks still shows); "not now" leaves the cloud copy byte for byte unchanged for those entries,
  syncs an unrelated entry, keeps them out of this device's base and asks again at the next sync; control: no
  button exists that drops them from the upload without the second question.
- **B27 (D76, finding 6).** BV-27's later-mover cases are run **from a sync record written by the real `cloud.js` at
  `<base>`** (`{ fileId, at, base }`, no tag), not from a hand-made one: B's base equals the checkpoint's marks, so
  it is used, its automatic sync does not stop, and a removal made after the move stays; B's base differs (B wrote
  to the old file after the first move): the old file is folded in first, then the base equals the new marks and is
  used; a base that matches neither: the careful merge; control: a rule that compares tags never uses a real
  device's base.
- **B3, B30 (D86, D83, findings 7 and 8).** BS-8, BG-9 and BS-14 are amended: with the price database filling the
  allowance, the first migration and a later version 2 write each succeed after the price database is deleted
  (prices then read "not fetched"); control: with storage still short after that, D64 (b)'s sentences. BS-14 is
  replaced: a browser held at version 1 **syncs the old file as at `<base>`**, every module, and sends no request
  for the version 2 file; an offline tick is saved and survives a reload. BL-17 (B18): the price database never
  holds more than 60,000 item records; the oldest go first; control: under the limit nothing is dropped. BS-15 adds:
  the note is written before the version 2 write; with device storage refusing the note nothing is migrated; a page
  closed between note and write opens the version 1 save unchanged and migrates at its next write; control: note
  and write both made, a later blocked open fails the call.
- **B3 (D73, finding 12).** BS-11's long entry (30,000 characters, and a held alternative with 300 records) comes
  back whole from its pieces after a save, a backup, a code and a cloud copy; control: cut at 20,000 it loses data.
- **B13, B21 (D85, finding 13).** C208's "Made" and hand-in cases read: refused whole with D85's sentence and the
  button to the question, nothing written (stock, crafted counts and wanted items byte for byte as before);
  control: the same craft with no frozen ingredient is recorded as at `<base>`, never refused.
- **B26 (D87, finding 14).** BK-39 "collectables": a pair with a credit on `nq`; one device changes `coll` from 2 to
  5: merged 5; both change it differently: asked with the pair, this device's until answered, `nq` and `hq` still by
  BY2; a held question's alternatives each carry their `coll`, and the answer installs it; control (the fault): a
  rule for `nq` and `hq` only drops the change.
- **B26 (finding 10).** BK-40 "a hold and one-sided entries in one merge": the hold is published by D72 while the
  one-sided entries stay undecided: the cloud copy gains the question and nothing else of them; control: with no
  hold, nothing is uploaded until the answer.

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
that never updates keeps reading and writing the old cloud file; it cannot reach the newer copy and is not told
that one exists; what it changes is taken in by the next sync of an updated device (D67, D76). A cloud copy more than 200 uploads ahead is
no longer a special case (it is known by its root and count, D80). **Where a sync has no base to work from (after a
loaded backup, a restore, a lost record, a foreign copy, two used devices linked for the first time) it stops and
asks about every entry only one side holds, and a sync that runs by itself waits for that answer.** A browser that
cannot hold the newer save has no cloud sync at all. Alerts need the app open in a tab, and Web Locks. Not tested by any automated run: the live
price site (but for the saved replies), the real OneDrive, a real phone, a real two-device sync.

**Owner questions. None is open.** Closed: 1, 2, 4, 6 (round two); 3 (round three); 8 (round four); 7, 9 (round
five); 5 (a), 10 (a), 11 (b), 12 (a), 13 (b) (round six); 14 (a) build the rule that keeps count and purchases
together, the setting left out by itself if the rule fails its tests, and 15 (a) a third outside round (round seven).
**Round eight (2026-11-26), after the third round failed the plan:** the Lists setting's rule is still built, now
corrected for the count limit, backups and codes, Undo on another device and fallback storage, and still left out if
its tests fail; the fix to the old Tracker's "Erase everything" is the Bourse work's first step, released well before
the save version rises, with no separate pull request now; a fourth outside round, with both reviewers, follows this
correction before any Bourse code. **Round nine (2026-11-26), after the fourth round failed the plan:** all 15
findings are fixed with the plan's scope unchanged, the Lists setting's rule included; a fifth outside round, with
both reviewers, follows. **Round ten (2026-11-26), after the fifth round failed the plan:** the Lists credit setting
stays in this plan; all twelve findings are fixed; a sixth outside round, with both reviewers, follows. Added by
round five to the limits: a question about a count and its purchases can list more than two choices; a count with an
open question cannot be changed by anything until answered, and a craft or hand-in that would touch it is refused
whole; an entry that fails the check is kept unreadable until the player discards it; the build without the setting
leaves such pairs as they are on each device; a declined sync still uploads what needed no answer; the newer cloud
copy carries a short mark for every entry of the old file; "cheapest listing" appears only for a complete slice
until the price site's selection order is documented. Added to what is unverified: the price site's selection order
before its limit (D77; nobody has found it documented); the size of the old file's checkpoint in a large save (B27
measures it against the 4 MB upload limit and escalates above a tenth of it); that every save path of the Tracker
and of Settings can carry the epoch (B28 lists them, B30 tests them). The planner read
`docs/bourse-review-adjudication-5.md`, ChatGPT's round-five review, the tenth owner round and `lists/store.js`
lines 380 to 417, and did not read Mistral's round-five notes. No question is open. The questions as they were asked are in `docs/bourse-questions.md`
and in the adjudications.

**Added by round four to the limits and to what is unverified.** Limits: on a browser without IndexedDB the save
stays in the older format, the Bourse cannot save and the newer cloud copy is not synced there; a device that stays
on the older app keeps its own cloud file and is not told that newer devices moved on; a pair with an open question
cannot be ticked, undone or retyped until answered; the Bourse section grows by each open or answered pair question;
with the create-only route unverified the newer save has no cloud sync at all, and the release is held back. Not
verified: the create-only route on the real OneDrive (nobody has run it); that the browser reports held locks to
other tabs as D68 needs (the Web Locks query; B18 escalates if it does not); that the price site orders listings by
asking price (D69, B20); the present cloud file name (B28). This correction was written as exact replacements to the
file; the planner read `docs/bourse-review-adjudication-4.md`, ChatGPT's round-four review, the ninth owner round,
`codec.js` lines 6 to 25 and the spec lines it replaced, and did not read Mistral's round-four notes.

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
not a new one. (8) A player answers "keep what is there now" by mistake: it asks twice, and since round four the
old guard's data is stored under its own key first (D65), so it can still be downloaded. (9) A save cannot get its
guard (no IndexedDB, or no room): it stays version 1 and the Bourse cannot save there (D64). (10) The create-only
route is never verified: the newer save has no cloud sync and the release waits (D67).

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

Round four found F01, F02, F04, F05, F07 open and F08, F10, F12, F13 partly open; section 18 says what replaced the
entries above (the guard on fallback storage, `device.bourse.held`, the read-back as safeguard, the 25-second expiry,
the strict comparison in 6.1, C216's whole-save comparison).

## 18. Round-four outside review (2026-11-26)

Both reviewers read the plan at `3282839`: ChatGPT (FAIL: 4 blockers, 9 major, 2 minor; 6 of its 16 round-three
findings closed) and Mistral (PASS: 5 notes, among them the correction of its two wrong round-three claims).
`docs/bourse-review-adjudication-4.md` accepted every finding and confirmed R4-01, R4-07, R4-10, R4-12, R4-13 and
R4-14 against the spec text or the pictures. The owner decided (round nine): fix all 15 with the scope unchanged,
then a fifth outside round with both reviewers. **The corrections below were planned by a Claude model on a
Claude-written spec (same family) and are unreviewed; the Bourse stays paused.** R4-12 and R4-14, and the pictures
for R4-13 and R4-15, belong to the look: the requester's.

| Finding | What changed | Where | Left as a known limit |
| --- | --- | --- | --- |
| R4-01 a version 2 save with no guard (blocker) | Version 2 is written only where save and guard land in one transaction; elsewhere the save stays version 1, the reason is shown, backups work; a failed write changes nothing | D64, D61; section 8 (guard tests); B3 (BS-8), B30 (BG-7 replaced, BG-9, BG-10) | Without IndexedDB: no Bourse saving and no sync of the newer save |
| R4-02 a stale restore prompt (blocker) | Restore and "keep" recheck both shown stamps in one transaction; a stale prompt changes nothing and reopens; "keep" discards nothing and is offered only for a readable save; cloud sync waits while the question is open | D65; B30 (BG-11 to BG-13) | — |
| R4-03 the held pair's storage (blocker) | Both whole alternatives are kept in the Bourse section itself, written the same on both devices, so they travel through the existing save, merge, backup and cloud paths; written before any dialog; the pair is frozen until answered; the answer is a unit of its own | D70 (1) to (5); section 8 (schema, BY2 step 4); B26 (BK-16 to BK-21), B21 (C208), B3 (BS-10) | The section grows by each question; a held pair cannot be edited until answered |
| R4-04 Undo without a common base; restores | A matching valid undo mark removes its record whatever the lineage; malformed or mismatched pairs are held before any arithmetic; a load rebinds or clears held entries; a page left open across a load is refused by an epoch | D70 (6) to (8); section 8 (BY2 steps 0, 1); B26 (BK-22 to BK-25) | With no base, own parts that differ are asked |
| R4-05 two trips, one own-item key | Own items are keyed by trip, item and quality, with one fixed upgrade from the two-part key | D66; 6.8; section 8 (schema); B3 (BS-9), B13 and B10 (BT-4) | — |
| R4-06 a blind create after the read-back (blocker) | The version 2 cloud copy is a new file, out of older apps' reach; the old file is read only to bring its content over; a create is sent only through a route verified by documentation and a run on the real service, otherwise none is sent and the release waits | D67 (1), (2); section 8; B27 (BV-22, BV-26), B24 (BV-21), B12, B28 | A device on the older app keeps its own file and is not told; the route is not yet verified by anyone |
| R4-07 the unchanged copy read as foreign | An exact match of item id, copy id and tag is known; the base is stored with its identity and dropped after a guard Restore or a load; a replace addresses the item; an unconfirmed write advances nothing | D63, D67 (3), (4); B27 (BV-23 to BV-25) | — |
| R4-08 refusals out of order; slots freed by time | A 429 always pauses, whatever the order of answers; a slot is freed only when the request has ended, shown by a browser lock per request, else it counts as taken; watch inputs rechecked at the dispatch decision | D68, D56; B2 (PX-14), B18 (BL-14 to BL-16), B15 (BA-14) | A frozen tab can hold one of the two slots until it closes; the lock query is unverified |
| R4-09 C216's comparison | Two comparisons: the fields both builds can hold against the older behaviour, and the off build on its own terms, run even when the setting passed | B21 (C216) | — |
| R4-10 the 300 stacks at equality | Stacks are added whenever the weighed supply is short | 6.1; B16 and B25 (BP-15) | — |
| R4-11 "cheapest" from an unclean slice | "Cheapest listing" only from a clean, ordered slice in every region; otherwise "cheapest seen" | D69, D49; B5 (BM-7), B20 | If the site's order is not shown by B20's reply, every ranking figure reads "cheapest seen" |
| R4-12 the Profit picture | (look) The check's sample is one a reader can work out by hand | B8 (C201) | The picture is the requester's |
| R4-13 the Trip picture's hops | The pictured route is a named case: 2 data-center hops, 1 region hop, counted from the route with home first | B7 (C202), B16 (BP-9) | The picture is the requester's |
| R4-14 the home-world picker | (look) C206 reads the source sentence in full outside the picker | B11 | The picture is the requester's |
| R4-15 the hourly limit's wording | The limit and the pause are the Bourse's requests, and every text says so | D27; B11 | The states picture is the requester's |
| Mistral R4-1 to R4-5 | Recorded; R4-3 is replaced by D64 | — | — |

**Defaults this round set, for the reviewers and the owner to see:** the cloud file's new name (the old one with
`-v2`); ten refused creates as the run that verifies the create-only route; "keep" stores the old guard's data
instead of discarding it; the two-part own-item key without a trip id becomes `legacy00`.

Round five found R4-03, R4-04, R4-05, R4-06, R4-09 and R4-11 partly open; section 19 says what replaced the entries
above (the held entry's form and its answer, LI7's reach, "merged with no base" for the old file, the clean slice as
proof of "cheapest", the off build's generic merge).

## 19. Round-five outside review (2026-11-26)

Both reviewers read the plan at `c66b46d`: ChatGPT (FAIL: 2 blockers, 8 major, 2 minor; 10 of its 15 round-four
findings closed, 5 partly open) and Mistral (PASS: 7 notes, each a limit the spec already states).
`docs/bourse-review-adjudication-5.md` accepted every finding at the reviewer's severity and confirmed R5-02 and
R5-11 in the spec text. The owner decided (round ten): keep the Lists credit setting in this plan, fix all twelve,
then a sixth outside round with both reviewers. **The corrections below were planned by a Claude model on a
Claude-written spec (same family) and are unreviewed; the Bourse stays paused.** R5-10's pictures are the
requester's.

| Finding | What changed | Where | Left as a known limit |
| --- | --- | --- | --- |
| R5-01 a stale edit after "keep" | "Keep", like Restore, a load and "go back", writes a new epoch; every save and every sync's last step checks it | D75, D70 (8); B30 (BG-14, BG-15) | A page left open must be reloaded |
| R5-02 an answer not bound to its question (blocker) | A question is named by its contents, with no time, so equal discoveries are one unit; the answer names the question and carries the chosen pair; an answer that meets another question changes nothing and that question stays open; later edits are taken only from the chosen pair as base | D71 (1), (3) to (5); D70 (1), (5); schema; B26 (BK-26 to BK-28) | An answer can be overtaken by a wider question and must then be given again |
| R5-03 a third device's pair; the frozen stock (blocker) | A pair that equals no alternative joins the question; two versions of a question merge by taking all alternatives; no answer applies to a question it did not name; every change to the frozen count is refused inside the write, whatever made it | D71 (2), D70 (4) (LI7, BY3); B26 (BK-29), B21 and B13 (C208) | A craft or hand-in that touches a frozen count is refused whole |
| R5-04 the hold only on one device | After a merge makes or widens a question, one upload stores it and everything that needed no answer, leaving the cloud's own value for what is asked; otherwise the question is shown as saved only here and nothing claims it is backed up | D72; B26 (BK-30, BK-32, BK-16 amended) | A declined sync now uploads the settled part |
| R5-05 invalid alternatives | An entry that fails the check is moved whole into a group the checker keeps, never offered, never dropped; its pair is asked with valid pairs only; one id with two contents is a mismatch | D73; schema; B3 (BS-10, BS-11), B26 (BK-31) | The unreadable entry stays until the player discards it |
| R5-06 the old cloud file replayed | A checkpoint in the version 2 copy records what of the old file was taken in; only changes since are taken; a device that moves later uses its recorded base, so a removal stays | D76, D67 (1); B27 (BV-27) | The copy grows by a short mark per old entry; without a recorded base a late mover is asked |
| R5-07 "cheapest" from a cut slice | "Cheapest listing" only for a complete slice or under a documented selection order; one sorted reply is not a contract; the constant starts false | D77, D69; B5 (BM-7), B20 | Until documented, cut slices read "cheapest seen" |
| R5-08 the off build and credited pairs | With the setting off a pair with credit history is one opaque unit: equal or left alone on each device, never merged count and records apart | D74; B21 (C216), B26 | Such pairs do not converge until a build with the setting meets them |
| R5-09 a version 2 import on a browser limited to version 1 | A newer backup or code is taken in only after a guarded version 2 write; otherwise nothing changes and the reason shows; version 1 is written only when the stored save is still version 1 | D78, D64 (b); B3 (BS-12, BS-13), B30 (BG-16) | No newer backup can be loaded on such a browser |
| R5-10 sample and seller rate beside the Profit figure | (look) The check requires both texts beside the figures at both widths | B8 (C201) | The pictures are the requester's |
| R5-11 stale text | Section 8's "always writes 2", single cloud file and "older device refused" are replaced; BV-8 is rewritten against the two files; section 11's line corrected | Section 8; section 11; B27 | — |
| R5-12 the first trip's id | The first write that needs a trip makes its id in the same transaction; legacy items move to it; the copy's receipt only with valid items | D79; 6.7; B10 and B13 (BT-10 to BT-13) | Two devices that both start cold get the two-trips question |
| Mistral R5-1 to R5-7 | Recorded; each is a limit already stated | — | — |

**Defaults this round set, for the reviewers and the owner to see:** an alternative's name is 24 characters of a
fixed hash, with the text compared as well; the old file's checkpoint may take at most a tenth of the upload limit
before B27 escalates; `SLIM_ORDER_VERIFIED` starts false; "go back" counts as a replacement of the save for the
epoch.

### In-house red team before round six (2026-11-26)

A fresh reviewer with no context (same family, so not independent) read the round-five text at `ecf457e` and the
code before the sixth outside round; the requester confirmed its code facts (`docs/bourse-review-adjudication-5.md`,
last section). All fifteen findings were accepted. **The corrections are same-family and unreviewed**; a second fresh
red team runs on them before round six is filed.

| Finding | What changed | Where |
| --- | --- | --- |
| RT-1 "merged with no base" does not ask (blocker) | Chosen: a new careful merge that neither takes nor drops one-sided entries without an answer, and lineage by root and upload count so that 200 uploads no longer end without a base; every "no base" sentence now means the careful merge | D80, D63; section 8 (after a load, cloud rules 2 and 4, the cloud tests); section 11; B24, B27 (BV-28, BV-29) |
| RT-2 a decline publishes what it did not apply | The settled entries are applied here in the same guarded write that records the base; a base never runs ahead of the save | D72; B26 (BK-33) |
| RT-3 the stale page kept as "this device" | In a same-device merge the stored save is this device; LI7 and the opaque pair hold in the Tracker's whole-save write | D81; BY2 step 4; B26, B23 (BK-34) |
| RT-4 a later mover's old-file base | The old file is folded in first; the old-file base is used only when its tag is the consumed one; otherwise the careful merge | D76; B27 (BV-27) |
| RT-5 counts on the old file outside BY2 | The checkpoint keeps counts whole; credited pairs go through BY2 with the checkpoint as base | D76; B27 (BV-27) |
| RT-6 a count of 0 has no entry | A missing count is 0 for BY2, LI6, LI7, the alternatives and the checker; BY2 decides before LY0 | D82; checker; BY2 step 1; B26 (BK-35) |
| RT-7 an answer removes records without a mark | The answer writes an undo mark for every record it rejects | D71 (3); BY2 step 4; B26 (BK-36) |
| RT-8 a version 1 browser and the version 2 copy | Cloud sync is off there: neither file is read or written; no code strips a section | D83 (1); B3 (BS-14) |
| RT-9 the unreadable entry altered by the cleaner | `raw` is one JSON text of at most 20,000 characters | D73; B3 (BS-11) |
| RT-10 stale section 8 text | The checker's "dropped", BY2 step 4's two-way form and "clears the entry", and the copy's `<item>.nq` are edited in place | Checker; BY2 step 4; 6.8; D58 |
| RT-11 the reason inside the held entry | The reason is not stored; it is worked out when shown | D71 (1), D73; B26 (BK-26) |
| RT-12 the transfer code's version | A version 2 code is written as `EVT3-` | D32; B3 (BS-7) |
| RT-13 storage chosen per call | Once a version 2 save is in IndexedDB a failed open fails the call; device storage is never used instead | D83 (2); B3 (BS-15), BG-16 |
| RT-14 the epoch checked after the upload | The epoch is read immediately before the upload and again in the local write | D75; B30 (BG-14) |
| RT-15 an old Lists price record waits an hour | Lists' service counts a record without quality as no record | D8; B22 (C205) |

Left as known limits by these corrections: a sync without a base stops for an answer, also the unattended one; a
browser that cannot hold the newer save has no cloud sync (withdrawn by the second red team: it syncs the old file
as an older device); undo marks are also written for purchases an answer rejects.

**Second in-house red team (2026-11-26).** A second fresh reviewer (same family, not independent) read the text at
`ea81d9d`; the requester confirmed its code facts. All fourteen findings were accepted. The corrections are
same-family and unreviewed.

| Finding | What changed | Where |
| --- | --- | --- |
| 1 a placeholder state takes the cloud's sections as its own | Every merge is given this device's stored sections; a side without sections is an error; "untouched" is judged from what is stored, every module included | D80 (2); B24, B27 (BV-28 "Lists entries and no characters") |
| 2 a rejection mark cannot be taken back | The mark names its question; a later answer that grew out of it and chose the record makes the mark void; a real Undo stays final | D71 (3), D84; schema; B26 (BK-37) |
| 3 one-sided purchase records taken unasked | With no base a credited record found on one side only holds its pair as a question, except on an untouched device | D80 (2); B26, B27 (BK-38) |
| 4 an overwrite passing for a descendant | An overwrite, like a create, starts a new root | D80 (3); B27 (BV-30) |
| 5 "leave them out" removed entries everywhere | Three answers: take, remove from every device (asked once more), not now (the cloud's value stays, out of the base, asked again) | D80 (2); B27 (BV-31) |
| 6 later movers never used their base | The base is used when its entries equal the checkpoint's marks; tested from a record the shipped code wrote | D76; B27 (BV-27) |
| 7 low storage hurt every module | The price cache is deleted and the write tried again; the cache has a limit; a browser held at version 1 syncs the old file as today | D86, D83 (1); B3, B30, B18 (BS-8, BS-14, BG-9, BL-17) |
| 8 the storage note written after the save | The note is written first; no migration without it | D83 (2); B3 (BS-15) |
| 9 contradictions | Schema lines, BS-11 and BV-21 brought into line with D71, D73 and D76 | Section 8 schema; section 10 |
| 10 D72 against D80 | A hold is published while one-sided entries stay open: the publication decides none of them | D80 (2); B26 (BK-40) |
| 11 "as it does today" | Today's two prompts are named and kept; the careful question is shown the same way | D80 (2); B27 (BV-29) |
| 12 the unreadable entry cut at 20,000 characters | Stored in pieces, never cut | D73; B3 (BS-11) |
| 13 "Made" with a frozen ingredient | Chosen: the action is refused whole, with the reason and a way to the question; a partial write was rejected | D85; B13, B21 (C208) |
| 14 the collectable count | Merged inside the pair as an own part with no credits | D87; B26 (BK-39) |

Left as known limits by these corrections: "Made" and a handed-in step can now be refused, which Lists never did;
after an owner's overwrite of a damaged cloud copy every other device is asked about what it alone holds; a sync
with undecided one-sided entries asks again each time until they are answered; deleting the price cache to make
room empties every price screen until the next lookup.
