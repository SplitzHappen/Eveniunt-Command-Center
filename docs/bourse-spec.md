# Bourse, the market module (blueprint phase 4): build spec

Written 2026-11-24 for a Sonnet builder (one pull request) and a Haiku clerk (mechanical items); revised the same day
after a same-family red team (section 12) and on 2026-11-25 after the owner's second round (section 13). Plan only:
nothing was built or run. Binding inputs: the owner's two answer tables in `docs/bourse-questions.md` ("answer N" is
the first table; "round two" is the second, which wins where they differ), the look spec `docs/bourse-look-spec.md`,
**look v3 (Atelier-led, chosen 2026-11-25)** (screens are not designed here), `docs/design-rules.md`, `docs/bourse-research.md`.
Blueprint rules restated: **CC-12** prices are labelled as community reports with when and where they were seen;
listings and past sales are shown separately; the market tax is counted; "profit" is an estimate, never a promise;
lookups are batched and cached; stale or missing data is marked. **CC-08** a website alerts only while open in a tab.
**CC-09** a "Solve in the Atelier" link that cannot be matched exactly is refused, not guessed.

Trust marks used below: **[shipped]** = a reply field or query the shipped code already reads (`prices.js`, `lists.js`,
`live.js`); **[verify]** = known from memory or third-party listings only, never seen by this project: item B1 checks it
against a saved real reply before anything is built on it. `docs/STATE.md` records the live price service as never
tested from a session, so B1 also asserts the [shipped] fields.

## 1. Goal, constraints, what is not built

- **Goal.** One new page, `bourse/`, with four views (Trip, Item, Profit, Watch) and a settings sheet: prices over the
  owner's travel area; profit per craft; a shopping trip split by region, data center and world; price history; a watch
  list with in-app alerts on every page of the app.
- **Constraints.** Offline-first, public, GitHub Pages: no server, no account, no key, no CDN; the only outside host is
  `universalis.app`, and only item numbers, place names and a world number are sent. Never read or automate the game;
  never invent game data or a price: a figure the app lacks is "unknown", never 0 (rule S5). The app does not decide
  who can travel where: the travel area is a setting (D25). Saves stay compatible (section 8). No personal names or
  private paths anywhere. One pull request; the owner ships.
- **Not built:** retainer listings, undercut watching and a sales ledger (answer 8); prices typed by hand; Gathering
  (answer 3); uploading to Universalis; push notifications for prices; a record of prices over time (answer 32);
  congestion rules of worlds; gil per hour.

## 2. Decisions (rejected alternatives in brackets)

**Data**
- **D1 No new game data.** Items, recipes, merchant offers, gather sources, master books: the Lists data (the page loads
  `../lists/data.js` and `../lists/engine.js`; the data can arrive packed as `LISTS_DATA_PACKED`, so it is read the way
  the Lists page reads it, through `CC.unpack`). Regions, data centers, worlds with their numbers:
  `tracker/data/live.json` (`dc`, `worlds`), built into `bourse/data.js` as `window.BOURSE_PLACES`. **Place names on
  screen and in a request differ** ("North America" on screen and in `live.json`, `North-America` in the request, as
  `lists.js` lines 48 and 70 already handle): one map, `PRICE.placePath(name, places)`, turns a region, data center or
  world into its request name; it is tested against the real request paths B1 saves, and a place the map does not know
  is never sent. Maintenance times: `tracker/data/timers.json`, built in as `window.BOURSE_MAINT` (all-worlds
  maintenance entries only). Market city names are the keys of the tax reply, shown as received. [A second data file
  for the Bourse: a second pin to keep in step. Lists' hard-coded region map: a third copy of the worlds.]
- **D2 One price source, four reply kinds.** Section 3 lists them. The aggregated endpoint is **not used** in version
  one. [Aggregated for the ranking: lighter, but it gives an average, and answer 20 asks for the middle of recent sales.]
- **D3 Saved replies first.** B1 saves real replies as fixtures and a test asserts every field in section 3. A field that
  fails takes the fallback written beside it; a feature with no fallback is escalated. A reply is never written by hand
  and called a fixture; hand-made stand-ins in tests are named `stand-in` and use only fields the fixtures hold.

**The price service** (`tracker/command-center/src/prices.js`, extended; `PRICE.create` keeps every current name)
- **D4 One request queue for the whole page**, `PRICE.queue(url)`: the only call of `fetch` in the file. At most **2
  requests in flight** and **300 ms between starts** (about 3 a second; the third-party figure is 25 a second and 8
  connections). After an answer 429, or three failed answers in a row, nothing is sent for 15 minutes; waiting requests
  resolve as not fetched and the screen says so. **A failure while the device is offline (`navigator.onLine` false) does
  not count towards the three; coming back online or pressing Refresh lifts a failure pause at once; a 429 pause always
  runs its 15 minutes.** Existing services go through it. The pace is unchanged by round two; the budgets carry the
  larger area (D27). [A cap per service: two modules on one page would add up. Raising the pace to the published
  figure: it is unconfirmed and the host is a free service.]
- **D5 New options of `PRICE.create`, each defaulting to today's behaviour:** `endpoint(place, ids)` (the path and
  query), `freshMs`, `noneMs`, `batch` (default 100), `maxRequests` (per call; the rest stay "not fetched"), `storage`,
  `strict404`. The default `storage` is today's one record in device storage, byte for byte. `PRICE.idb(name)` is a
  second `storage`: one record **per place** in an IndexedDB database of its own (`eveniunt-bourse-prices`, never the
  save's database), read through a new `S.load(place)` (a promise); memory only when IndexedDB is refused, and the
  screen says prices are not kept. `strict404` (the Bourse's services set it): **an answer 404 is a failed fetch,
  never "no market price"**, unless B1's `unknown-item` and `unknown-place` replies show the two can be told apart, in
  which case only the unknown-item form is "no market data". [A second price file for the Bourse: a fork. Device
  storage for the ranking: about 10,000 records per place do not fit beside the save's fallback copy.]
- **D6 Quality and worlds live in the stored value**, made by shared readers in `prices.js`: `PRICE.readDeep(x)` gives
  `{ up, w: { <world>: { up, n: [[price, qty, total]…], h: […] } }, s: { n: [[price, time]…], h: […] } }` (listings by
  world and quality, cheapest first; sales by quality); `PRICE.readSlim(x)` gives `{ up, n: { min, mid, sales, perDay },
  h: {…} }` and keeps the sale entries it was made from, so regions can be joined (D26). Either returns `null` for "no
  usable reply". Retainer and buyer names are never stored. [A cache key per quality: two requests per item for one
  reply.]
- **D7 The 15-minute gate, per service and place, is unchanged** and applies to every automatic try; Refresh ignores it.
  For the Bourse's services no automatic try is made, and none is recorded, while the device is offline; the try runs
  when it comes back online. (Lists and Submersibles keep their pinned behaviour.)
- **D8 Lists gains high-quality prices (answer 40) by changing only its own `read`, and its query only if needed.**
  First choice: the reply's own `minPriceNQ` and `minPriceHQ` [verify], query unchanged; value `[cheapest of any
  quality, average, world, upload, cheapest ordinary, cheapest high quality]`. If B1 fails those fields: a second
  request with the `hq` filter [verify] for the items that have a high-quality row. If that fails too:
  `?listings=20&entries=20`, scanned, and a row with none found says "No high-quality listing among the cheapest 20"
  (a known limit then). A stored four-part value stays readable (its high-quality price reads "not fetched"). Storage
  keys and the engine's planning are untouched. Lists keeps its own price place; Submersibles is untouched. [Lists
  reading the Bourse's cache: two modules on one record, the fault D9 of the Lists spec avoided.]
- **D9 The Tracker's fetcher is removed** (answer 2a; Lists spec D10). `live.js` `mbFetch`, `mbSummary`,
  `fillMarketLines`, `renderMarket` go. Inside the Command Center the Market Board page is the empty-state form with one
  link "Open the Bourse", and an entry's detail line is a link "Prices in the Bourse" (`../bourse/#item=<item id>`);
  nothing is saved by following a link. What the downloaded single file shows is owner question 3; until answered the
  builder builds its option (a). [Embedding `prices.js` in the Tracker: a third build to keep in step for a page that
  only links.]
- **D10 The Tracker's shopping list is copied, never moved.** `UI.live.mlist` and `mqty` stay stored as they are. The
  new Tracker, which alone can turn its entry keys into item numbers, writes `UI.live.mcopy = { <item id>: <amount> }`
  beside them. The Bourse page, on opening, reads it from `eveniunt-tracker-ui`, adds each item to the trip's own items
  (`extra`, the larger amount when one exists; **each amount brought into 1 to 99,999**) in one save, and says once
  "Copied N items from the Tracker's shopping list." **`mlistCopied` is recorded in the device record only after a save
  that copied at least one item succeeded**; an empty or missing `mcopy`, or a refused save, records nothing, so the
  copy is tried again at the next opening. Each device copies its own list once. [The Tracker writing the section
  itself: its save is the one path the store rules do not guard. Deleting the old list: drops player data.]

**Profit**
- **D11 The ranking fills only when asked.** Section 4.
- **D12 Profit of one craft**, section 5. Direct materials only, except a material that cannot be traded and has a
  recipe, which is costed by its own materials (four levels at most, loop-safe). [The cheapest of buying or crafting
  every material: many more lookups and a second plan engine.]
- **D13 The ranking prices one unit, cautiously; the opened row prices the recipe's amounts** by walking the listings
  (one deep lookup of that craft's items), **and shows the home world's own sale figure** (round two; D29). In the
  ranking a material's market price is the **higher** of its cheapest listing and the middle of its recent sales, so
  one cheap listing never lifts a craft up the ranking (section 5). [Deep listings for every ranked craft: twenty
  times the reply size. The cheapest listing alone: a bait listing would rank a craft.]

**Trip**
- **D14 The trip's needs** are Lists' items to buy on the market for the lists chosen (answer 29), plus the trip's own
  items (D10, "Add to trip"), less what is marked bought. A new pure `LISTS.marketNeeds(plan, listIds)` in `engine.js`
  returns `[{ key, item, quality, qty }]` from `plan.shop.market` and the shares of the chosen lists; **the page's
  private `sumShares` (`lists.js`, about line 424) moves into the engine as the exported `LISTS.sumShares`, and the
  Lists page calls that one**, so both pages add up the same way. One plan per character, as Lists does (D23).
  [Reading Lists' drawn page: not data.]
- **D15 One split method for all three modes: start cheapest, drop regions, then data centers, then worlds** (round
  two; D28). Section 6. [An exact fewest-stops search: it grows too fast with the worlds of seven data centers; the
  screen says "a good split", never "the best".]
- **D16 A bought mark remembers what was needed, and does not outlive the need.** A mark holds `n` bought and `of`, the
  amount needed then. If Lists' need has since fallen, the fall is read as that purchase typed into Lists, so it is not
  subtracted twice: `left = need now − max(0, n − max(0, of − need now))`. **When the Trip is opened or redrawn and
  Lists' need for a mark's key is 0, the page removes the mark** (one save, no Undo entry, the status line says "N
  bought marks cleared: Lists no longer needs those items"), so a later need starts clean. **"New trip"** (in the
  "Bought" group's More, error role, asks first: "Clear N bought marks and M items you added?") removes every
  mark and every own item. The "Bought" group shows each mark with its amount and date. [Subtracting `n` always: a
  player who types the purchase into Lists would be told to buy too little. Marks that never expire: an old mark would
  hide a new need.]
- **D17 Maintenance comes from the built copy of the Tracker's timer list only.** The published site has no
  `timers.json` to read (checked by the red team), so there is no live replacement; a maintenance announced after the
  last build is not known to the page, and the foot note is always shown. [The Tracker's own outside timer source from
  this page: a second outside host.]

**Watch, save, look**
- **D18 Alerts run on every page of the app** (round two; replaces "only on the Bourse page"). D30 and section 7.
- **D19 The save section has a checker in `save.js`**, no arrays, every key safe for older builds. Section 8.
  [No checker, as Submersibles' recommendations: outside data would reach the page unchecked and sync questions would
  read as raw paths.]
- **D20 A unit removed on one device and changed on the other stays until the player answers**, as Lists' rule LY0;
  between tabs the same case is refused (as LI4). [The generic rule: an unanswered merge would delete it.]
- **D21 The module adds layout only** (`bourse.css`, every class `bm-`, no colour value, no shared token). The gil role
  moves into `one-look.css` as `ol-r-gil` (`--f: var(--gil-m)`, ink text), covered by the drift check, **and is used
  for gil bars only** (round two). **The module's sheet reaches gold only as `var(--f)` under `ol-r-gil`; it never
  names `--gil-m`** (a unit test reads the sheet). No role list of its own. [A Bourse token block: the drift the one
  look removes.]
- **D22 One addition to the look spec:** the Profit view's filter (job, level band, "can make now") sits in the Ranking
  group's More as "Filter crafts", its value readable in the head's state line (F6); no field at rest (F1). It is
  listed beside the mock-ups as a difference unless look v3 draws it.
- **D23 Who owns a trip row.** Needs are worked out per character (each character's own plan and stock), then rows of
  the same item and quality are shown as **one row to buy** with the amounts added; the opened row lists each
  character's share. Bought marks are kept per character (`bought` key owner `c1` to `c8` or `u`; `x` for the trip's
  own items). A tick on a joined row is shared out in the fixed order `c1`…`c8`, `u`, `x`, each need filled before
  the next; "also add to I have" writes each character's share to that character. [One mark for the joined row: it
  could not be credited to the right character's stock.]
- **D24 The home world is asked for too.** A region's reply holds only its cheapest 60 listings per item, so the home
  world can look empty when it is not. The Trip sends the same items to the `deep` service at the **home world** as
  well (one more request per 100 items, same gate); `saved`, "not sold on <home>" and the home world's rows use that
  reply. For any other world the words are "not among its region's cheapest 60 listings", never "none".
  [The home data center instead: the same cap applies to it.]

**Round two (2026-11-25)**
- **D25 The travel area is a setting; its default is the owner's seven data centers.** North America (Aether, Primal,
  Crystal, Dynamis), Europe (Chaos, Light), Oceania (Materia). `build.js` writes `window.BOURSE_AREA` from
  `live.json`: the regions North America, Europe and Oceania with the data centers that have worlds there, and **stops
  unless that gives exactly those seven** (`live.json` also lists Japan, whose Elemental has worlds, and Europe's
  Shadow, which has none: neither is in the area). `prefs.area` (`{ <data center>: 1 }`, absent = all seven) narrows
  it; it replaces the earlier `prefs.place`. The app states no travel rule of the game: the sheet says "Choose the
  data centers you can travel to. This app does not know the game's travel rules." [Every data center of `live.json`:
  eight, not the owner's seven. Deriving who can travel where: a claim about the game the project cannot check.]
- **D26 One request per region, joined on the device.** Universalis takes one place per request, so every Bourse
  lookup except the home world's and the tax rates goes out once per region of the area that has a chosen data center
  (three by default). Each region keeps its own cache record and gate. A figure "over the travel area" is made on the
  device: listings of the three replies together, keeping only worlds of chosen data centers (a world the app's list
  does not hold is left out and counted in a foot line); the middle of recent sales over the joined sale entries; sales
  a day added up; the age per world. A region that failed is named ("Europe not fetched") and its worlds read "not
  fetched", never "none"; a figure made without it says so. [One request for a made-up joint place: the price site has
  none. The home region only: against round two.]
- **D27 Budgets for three regions** (section 4): the queue's pace stays (D4); one press of "Rank these crafts" is 12
  requests (400 items over three regions); 72 ranking requests per page visit; 180 per rolling 6 hours per device; a
  ranked price counts as fresh for 24 hours. Watch rounds: at most 6 requests, default every 30 minutes. [Keeping the
  old figures: a full ranking would take about a week of presses. Tripling them: three times the load on a free
  service for the same answer.]
- **D28 The trip is grouped by region, then data center, then world** (section 6): fewest region hops first, biggest
  savings first inside each level; a stop in another region stays only when its saving beats the threshold, in every
  split mode.
- **D29 The sale price for profit is read over the whole travel area** (round two, replacing answer 15 and closing
  owner questions 2 and 6). The Profit screen says once: "You can only sell on your home world. Sale prices here are
  read over your whole travel area." The opened row shows the home world's own middle price, cheapest listing and
  sales a day, from one home-world lookup, so the two can be compared. Material costs are read over the area too.
  `prefs.sellAt` is dropped. [The home world as the ranked figure: the spec's earlier recommendation; the owner chose
  the area.]
- **D30 One shared alert script on every page**, `tracker/command-center/src/watch-alert.js` (section 7). It is tiny
  and loads the price code only when there is something to watch. One checker at a time across tabs. The Tracker and
  the Atelier load it from their hosted-only code (the code that already adds the Main menu), so the downloaded single
  files never reference it and `prices.js` is still not embedded in them. [A copy of the checker inside each module:
  six copies to keep in step. A service worker checking in the background: it would run with no page open, against
  CC-08.]
- **D31 The look is look v3 of `docs/bourse-look-spec.md`** (the owner chose the Atelier-led look B for the whole app on 2026-11-25: book-style chapters, one ledger per section, leaders, figures at reading size, Submersibles' state colours, the answer band with its huge figure and state blocks, also on the phone). This spec names no drawing.
  States use the shared state roles (act now, next, waiting, unknown, done) and never the market purple (`ol-r-market`
  is not used by the Bourse); gold is for gil bars only. Wherever a section above says "chapter", "closed group" or
  "sub line", read it as the matching part of look v3. C206 measures the limits of whichever look the owner approves.

## 3. What is fetched (host `https://universalis.app/api/v2/`)

"per region" = one request for each region of the travel area (D26), three by default.

| Service (cache) | Used by | Request | Fresh | Fields read |
| --- | --- | --- | --- | --- |
| `deep` (`PRICE.idb`, gate key `eveniunt-bourse-tried`) | Trip (per region, and the home world, D24), Watch (per region), an opened Profit row (per region, and the home world) | `{place}/{≤100 ids}?listings=60&entries=20` | 15 min | [shipped] `items{}` (one id: the item itself), `listings[].pricePerUnit`, `.hq`, `.worldName`, `recentHistory[].pricePerUnit`, `lastUploadTime`; [verify] `listings[].quantity`, `.total`, `.tax`, `recentHistory[].hq`, `.timestamp`, `worldUploadTimes`, that `listings=60` caps per item, the unit of every time (seconds or milliseconds) |
| `item` (same database) | Item, "Look deeper" on a trip row; per region | `{region}/{one id}?entries=0`, every listing | 15 min | as `deep` |
| `slim` (same database) | Profit ranking; per region | `{region}/{≤100 ids}?listings=0&entries=40` | 24 h for "Rank these crafts"; shown by its own age | [verify] `minPriceNQ`, `minPriceHQ`, `nqSaleVelocity`, `hqSaleVelocity`, `recentHistory[].hq`, `.timestamp` |
| `history` (same database) | Item, recent sales; per region | [verify] `history/{region}/{id}?entriesWithin=<30 days>`: `entries[].pricePerUnit`, `.hq`, `.quantity`, `.timestamp`, `.worldName` | 1 h; records older than 7 days deleted on opening | |
| `tax` (same database) | Profit, where to sell | [verify] `tax-rates?world=<home world number>`: one rate per city; **[verify] the unit of a rate (5 or 0.05)** | 6 h | |

Requests per action, default area: Trip 4 per 100 items; Item 6 (three listings, three histories); an opened Profit
row 4; a watch round 3 per 100 watched; a press of "Rank these crafts" 12; opening Profit at most 3.

**[verify] the tax model, recorded by B1 from the real replies:** (1) the unit of a city rate; (2) on a listing,
whether `total` equals `pricePerUnit × quantity` and `tax` is a separate amount, or `total` includes it; (3) who pays
that amount. (1) and (2) are read off the fixtures. (3) is a rule of the game the replies cannot prove: B1 quotes one
guide line for it in the fixture README and the orchestrator confirms it with the owner. `market.js` has **one** tax
model, with the seller's rate held in percent (section 5).

Fallbacks when B1 fails a [verify] field: `quantity` missing: escalate (the trip cannot be built). `total` or `tax`
missing: trip and material costs read "before tax", as Lists does today, and each profit row says "buyer's tax not
counted" (known limit; escalate). `worldUploadTimes` missing: every world shows the item's `lastUploadTime`, labelled
"last report for <region>". `minPriceNQ/HQ` or the velocities missing: `slim` asks `listings=20` and reads them from
the listings, sales a day from the sale times. History endpoint missing: `item` asks `entries=200` and recent sales use
`recentHistory`. Tax endpoint missing, or the rate's unit unclear: profit is worked out with **5%, labelled "5% tax
assumed: the usual full rate; this week's rates could not be read"** (the research's guide figure for the three old
cities, the highest ordinary rate, so profit is not overstated), "Where to sell this week" is the empty line, and it is
escalated. Who pays the listing's tax unclear: material costs **include** it (the cautious side). A price's age is
always the reply's own report time for that world, never our fetch time.

## 4. "All recipes" (answer 25): the progressive fill

About 13,900 recipes; a full pass is about 110 to 140 batches of 100 items, each sent to three regions: **330 to 420
requests**. Rules:
1. **Opening Profit sends at most 3 requests**: the stale rows in view, one batch over the three regions. Everything
   else is the cache. No timer ever refetches the ranking.
2. **"Rank these crafts" is the fetch.** One press prices the next **400 items (12 requests)** of the current filter:
   results and their materials together, materials named once, anything fetched in the last 24 hours skipped. Order:
   crafts never priced, highest recipe level first; then the oldest fetch. The filter is applied before anything is
   asked. A batch counts as priced only when all its regions answered; a region that failed is asked again first.
3. **Budgets, kept in the device record:** 72 ranking requests per page visit and 180 per rolling 6 hours per device.
   When spent, the seal is disabled and reads "Enough for now", with "The price site is free and run by volunteers. More
   can be ranked after <time>." A pause (D4) shows the same form with its reason. A full ranking of every recipe is
   therefore about 28 to 35 presses spread over three six-hour windows, by design; a filter (one job, one level band)
   is ranked in one to three presses.
4. **While partial:** the answer is the best gil per craft "of N ranked"; "Not priced yet M" is in the unknown state;
   the Ranking head says "N of T ranked for this filter". Closed groups after the ranking, each with its count: "Not
   priced yet", "Missing a price" (a sale or material price unknown: never ranked as 0), "Price too old" (past the
   owner's limit), "Cannot be sold" (untradable or collectable results). 200 rows are drawn, then "Show 200 more".
5. Records older than 30 days are deleted on opening. Two tabs each have their own queue; the device budget is shared
   (known limit: two tabs pressing at the same instant can each spend one press).

## 5. Profit math (pure functions in `bourse/market.js`; every figure labelled "estimate")

- **Quality (22).** The sale is high quality when the recipe can be (recipe flag 1), else ordinary. Materials are
  ordinary. A high-quality figure never fills an ordinary one or the reverse.
- **Sale price (20), per unit, over the travel area (D29, D26):** *middle of recent sales* = the median unit price of
  that quality's sales in the last 7 days among the entries held from every region of the area (one sale, one entry; an
  even count takes the mean of the two middle ones, rounded); shown with "from N sales". *Cheapest listing* = that
  quality's cheapest current listing in the area, with its world. Ranked by the first, the second beside it; the
  segmented choice swaps them. No sale in 7 days: sale unknown. The opened row adds the home world's own figures.
- **Tax (23), one model.** `ratePct` = the seller's rate in percent (a reply given as a fraction is turned into
  percent once, on reading, as B1 found it). `income = sale × yield × (1 − ratePct / 100)`. `ratePct` = the lowest
  current city rate on the home world, or the city chosen in settings; "Where to sell this week" lists every city,
  lowest first, with "read <when>". Rates not readable: the 5% fallback of section 3, labelled. A rate is never shown
  as this week's unless it was read.
- **Material cost (21), per unit:** the cheaper of (a) the cheapest gil-only merchant offer per unit from the data and
  (b) the market price over the travel area. **(b) in the ranking** is the higher of the cheapest ordinary listing
  and the middle of the material's recent ordinary sales (D13); with no recent sale, the cheapest listing, and the row
  says "material priced from one listing". **(b) on the opened row** is the listings walked for the recipe's amounts.
  The buyer's tax is added to (b) only when B1 showed the buyer pays it (the reply's own figure where given; unclear:
  added, section 3). A craft whose rank would change by more than half if a material's cheapest listing were used
  instead wears "a material is listed far below its recent sales". Gathered materials (the data has a gather source):
  market value, or 0 with the label "gathered: free" when the switch is on. Crystals: market. Neither (a) nor (b):
  unknown, and the craft goes to "Missing a price" (D12 for untradable crafted materials).
- **Shown per craft:** `profit = income − cost` (the row's answer, may be negative), return (`profit / cost`), sales a
  day of the sale quality, material cost, "can't make yet" (no character's crafter level in the Atelier section reaches
  the recipe's, or its master book is not ticked in the Tracker; nothing known: no mark).
- **Age (16).** `oldDays` (default 1): the row is marked "Old" in place of its rank. `dropDays` (default 7): left out
  of the ranking, under "Price too old". The age is the older of the sale's and the materials' report times.
- **Slow sellers (24)** under one sale a day sink under "Sells less than once a day"; never hidden.
- **Bait (19).** A listing under half the middle of recent sales of its quality is marked "far below recent sales";
  never hidden, still priced.
- **Home world** = `prefs.home`, else the Tracker's place setting. None set: Profit shows the empty state "Choose your
  home world" with the main action opening the sheet; nothing is fetched. The Trip works without one (no "saved", no
  home-first order) and says so once.

## 6. The trip (pure functions in `bourse/market.js`)

- **Buying an amount (18).** For one item and quality, from the listings of the worlds allowed: the set of listings with
  the lowest total gil whose quantities reach the amount. **A listing is bought whole** (the owner confirmed it, round
  two), so the row says "buys 99, you need 5" when it overshoots. Found by a table over amounts up to 2,000; above
  that, cheapest unit price first. Fewer units listed than needed: the row buys what exists and says "N of M found";
  with exactly 60 listings held for a region it offers "Look deeper". No listing of the wanted quality: an ordinary
  need whose item has only high-quality listings says **"Only high quality is listed"** with the cheapest of them named
  (not bought by the plan); nothing of either quality in the replies says "Not among the cheapest listings of your
  travel area" (D24), and "Not on the market now" only when every region's own reply for the item holds no listing at
  all. Never 0.
- **Priced once, then chosen.** Before any split, each item is priced once per world: the cost of the whole amount on
  that world alone, or "cannot" (kept in a table, item by world). Choosing among sets of worlds reads that table; only
  an item that no single allowed world can supply is priced over several worlds together, and that result is kept per
  item and set. **Limit: 50 items over every world of the seven data centers are split in under 200 ms on the test
  machine** (BM-8, C202).
- **Split (26, round two), `prefs.split`:** start from every item at its cheapest over all allowed worlds (total `C`).
  Then three passes, each repeated until nothing more may be dropped; every item must stay covered as fully as before a
  drop; a pass prices the plan without each candidate and takes the one whose removal costs least.
  1. **Regions other than the home one.** A region is dropped unless keeping it saves **more than `within` percent**
     of the plan's total, **in every mode** (a region hop must beat the threshold); `fewest` drops it whenever cover
     holds.
  2. **Data centers** other than the home one, by the mode's rule.
  3. **Worlds**, by the mode's rule.
  The mode's rule: `cheapest`: never drop. `fewest`: drop while cover holds. `within` (the default, 10%): drop while
  the total stays at or under `C × (1 + within/100)`. Ties: keep the home world, then the home data center, then the
  home region, then by name. A stack may split across worlds.
- **Route (27, round two).** Grouped by region, then data center, then world, each visited once: the home region
  first, then the others by gil saved, largest first; inside a region the home data center first, then by gil saved;
  inside a data center the home world first, then by gil saved. `saved` of a stop = what its purchases would cost on
  the home world (from the home world's own reply, D24) minus what they cost there; an item the home world cannot
  supply counts 0 and is marked "not sold on <home>". `prefs.route = 'items'` orders by most items instead. The answer
  is the **total gil to spend** (round two), with the number of stops, of **region hops** and of data-center hops, and
  the gil saved, beside it.
- **Ticks (28).** "Bought", "Buy part" and "Bought all here" write `bought` (D16, D23) with Undo in the status line.
  `prefs.tick = 'only'` (default) changes nothing in Lists. `'lists'` also adds each character's share to that
  character's "I have" through `LISTS.store`'s own edit function in the same visit, marks the tick `lists: true`, and
  Undo takes both back; a refused Lists write leaves the tick unset and says why.
- **The trip's own items** (`extra`): added by "Add to trip" or the copy of D10; removed by the player ("Remove from
  trip" in the row's More, asks first), by "New trip", and **by the page when the item is marked bought in full** (the
  item and its mark go together in one save; Undo in the status line brings both back).
- **Said once (W2):** "You can buy on another world, data center or region you travel to, but you cannot sell there.
  Whether you can travel is the game's rule; your travel area is set in Bourse settings. Travel stops 30 minutes before
  maintenance." The app never says who can travel where. An all-worlds maintenance in the built list starting within 2
  hours, or running, makes it the note block (D17).
- The module opens on Trip when a chosen list has market items or the trip has its own; otherwise on Item (answer 14).

## 7. Watch list and alerts (33, 34; round two: on every page)

A watched item is an item, a quality and a target price. On the Bourse's Watch view, on opening and on Refresh, the
`deep` service prices the list over the travel area; rows fall under "Below target", "Above target", "No price".

**The shared checker** (`watch-alert.js`, D30), loaded by Home and Settings, Submersibles, Lists, the Bourse, and the
hosted Tracker and Atelier:
- **Does nothing, and loads nothing more, when** the watch list is empty, `prefs.alerts` is off, the page is hidden,
  the device is offline, or the queue is paused. It reads the save (`CC.read`, again on `CC.onChange`) and never
  writes it. Only when there is something to check does it add `prices.js`, `bourse/data.js` and
  `bourse/services.js` (the one definition of the Bourse's services, which the Bourse page uses too) to the page.
- **One checker at a time across tabs.** A round starts only when the device record `eveniunt-bourse-alert`
  (`{ at, page }`) is older than `prefs.alertMin` minutes (default 30, least 15). The page writes its claim, waits a
  short random moment, reads it back, and runs only if the claim is still its own; where the browser has
  `navigator.locks`, the round also runs inside one named lock. Other tabs see the new record and do not check.
- **A round** asks the `deep` service once per region for the watched items (at most 6 requests: 200 watched items
  over three regions; the page limit is 200), through the queue and the 15-minute gate. Results go into the shared
  price cache, so the Bourse shows them without asking again.
- **An alert** is one slim status line on the page that ran the round (form per look v3; rule S1): "<item> is under
  your target on <world>: N gil. Open" (the link goes to `bourse/#item=<id>`), with "Close". An item rings once per
  crossing, across tabs and pages (`alerted` in the device record), and again only after going back over. **It rings
  only when that world's report of the listing is no older than `oldDays`**; an older one shows on its Watch row as
  "Under, but the price is old" and does not ring. On a phone the line wraps the item's name onto a second line and
  never cuts the world, the price or the age.
- **A page works without it.** If the script or the price code fails to load, nothing else on the page changes.
- The Watch view and the settings sheet say: "Alerts ring only while this app is open in a tab. While it is open, it
  checks your watched items every N minutes, on any page. Turn this off under Alerts." No notification permission is
  asked.

## 8. The save section `modules.bourse`

```
{ v: 1,
  watch:  { "<item id>.<nq|hq>":         { target, at } },
  extra:  { "<item id>.<nq|hq>":         { qty, at } },            the trip's own items
  bought: { "<owner>.<item id>.<nq|hq>": { n, of, at, lists } },   owner c1..c8, u, or x for the trip's own items
  prefs:  { area: { <data center>: 1 }, home, oldDays, dropDays, split, within, route, tick, gatherFree, taxCity,
            rankBy, alerts, alertMin, lists: { <list id>: 1 } } }
```

- **Checker `CC.checkBourse`**, added to `CHECK`: always the whole frame in that key order; no arrays; no size limit;
  an entry is dropped only when malformed (bad key, no `target`, no `qty`, no `n`); a bad field is left out, never
  repaired. Ranges: `target` 1 to 999,999,999; `qty` 1 to 99,999; `n`, `of` 0 to 999,999; `oldDays` 1 to 30; `dropDays`
  1 to 90; `within` 0 to 100; `alertMin` 15 to 240; `split` `fewest|cheapest|within`; `route` `savings|items`; `tick`
  `only|lists`; `rankBy` `sales|listing`; `area` keys are names up to 32 letters with the value 1 (the checker does not
  know the worlds; the page ignores a name that is not in the area); texts up to 40 characters. A default is not
  stored. Page limits (edit functions only): 200 watched, 500 own items. `LABEL.bourse = 'Bourse'`; `describeUnit`
  words: "Bourse: watched item <name> (target N gil)", "Bourse: an item added to the trip (<name>, N)", "Bourse:
  bought mark for <name>", "Bourse setting: <plain name>".
- **Merge.** Units are two levels down, as everywhere: one watched item, one own item, one bought mark, one setting.
  Changed on one side: taken. Changed differently on both: asked. **BY0** (`merge.js`): removed on one side and changed
  on the other: kept, asked until answered, removed only by the removing side's answer (`integrity.kind` `bourse`,
  `keep`). **BI1** (`CC.writeSection`): a unit the page removed that the stored copy holds with another value is
  refused with "This was changed on another device or in another tab, so it was not removed." Nothing else is added.
  The page's own removals (a mark whose need is 0, a bought own item, "New trip") are ordinary removals under these
  rules: one changed elsewhere since is kept and asked, never deleted.
- **On the device only:** every price, sale, tax rate and attempt time (`eveniunt-bourse-prices`,
  `eveniunt-bourse-tried`), `eveniunt-bourse-device` (last view, `mlistCopied`, which alerts rang, the budget) and
  `eveniunt-bourse-alert` (the checker's claim).
- **A device on an older build** (read in `save.js`): `CC.checkModules` keeps a section it has no checker for as plain
  data through `clean`, on every read and every write of another section, and merges it unit by unit. `clean` only cuts
  arrays over 5,000, text over 20,000 characters, depth over 10 and unsafe keys; this shape has none of them, so the
  section survives byte for byte (test BS-3 and check C197 prove it with the shipped files). What the older build lacks:
  the checker (the new build checks on reading), the labels (its sync question shows the path) and BY0 and BI1 (its
  unanswered merge follows the generic rule: this device's side, which can be a removal). `CC.VERSION` stays 1.
- **Rebuild:** `save.js`, `merge.js`, `one-look.css`, the header's page list, `live.js` and the hosted-only code of the
  Tracker and the Atelier (D30) change, so the Tracker (`tracker/dist`, `tracker/site`), the Command Center
  (`tracker/command-center/site`) and the Atelier (`crafting/atelier/dist`, `site`) are all rebuilt and committed.

## 9. Screens

As **look v3 of `docs/bourse-look-spec.md`** and its mock-ups, once the owner has approved them (design rules section
12: nothing of B6 to B9, B14 or B11 is drawn from an unapproved look), including the states page
`docs/bourse/mock/states.html`, with look v3's measured limits, plus D22 and D31. Fixed here, whatever the drawing:
the header word is "Bourse", between Lists and Settings in the page list (`tracker/tools/one-look-header.js` `MODS`),
tool slot "Bourse settings" and, on Item, "Find an item"; Home gains a card (live line "N watched" or "Nothing watched
yet"); an age is written "14 min", "3 h", "2 days", never "14M"; **the Item screen's answer is the price of one unit
when buying the amount needed, labelled "each, for N"**, with the world; the Trip's answer is the total to spend
(section 6). Fixed sentences (owner question 5): foot "Prices are community reports collected by Universalis from
players' game clients. Each one says where and when it was seen and can be gone when you arrive. This app reads nothing
from the game."; Profit "An estimate from reported prices, after market tax. Not a promise." and the sentence of D29;
the travel sentence of section 6; the alert sentence of section 7. "Solve" appears only for a recipe not in
`LISTS_DATA.noHandOver` and links `../atelier/#recipe=<id>`; otherwise no link (CC-09).

## 10. Work items

**Order of running:** B0, B1, B2, B3, B4, B5, B13, B6, B7, B14, B8, B9, B15, B10, B11, B12 (B13 and B14 were added by
the red team, B15 by round two; all keep their numbers). **B6 and later wait for the owner's approval of look v3.**

Every builder item: branch `bourse`; only the named files and rebuilt copies; `npm run build` twice, the second exits 0
and `git status --porcelain` is empty after the commit; `npm run test:unit`; each new test or check is seen failing
without its change (a temporary revert, reported); never merge. **Guards, exempt from "seen failing" because they pass
at `<base>` by design and exist to stay passing:** PR-1 to PR-5, PX-7, BS-3, BY-3, C197, the "a reload within 15
minutes sends none" part of C200, and the "a page without the script still works" part of C207; each is reported as
"guard, passed before and after". Browser checks answer `universalis.app` with a stand-in that counts requests per
region, and route `lists/data.js` to `tracker/tests/fixtures/lists-fixture.json` unless "real data". `<base>` is the
commit B0 pins. New check ids start at C197; the builder may renumber in order.

- **B0 Baseline and facts (Haiku clerk).** No edits. Run the three suites. Report: results; the highest check id
  (expected C196); the commit the branch starts from (`<base>`) and whether the one-look foundation is in it; every line
  of `check.js` and of the tests that counts nav links, modules or Home cards, or names `data-module="lists"`; every
  test and check that reads the Tracker's Market Board, `mlist`, `mbadd` or a `universalis` request from the Tracker;
  how the Lists page unpacks `LISTS_DATA_PACKED` (file and line); the data centers that have worlds in `live.json`, by
  region; where the Tracker's and the Atelier's hosted-only code adds the Main menu (file and line), and whether either
  page sets a content security policy or a service-worker rule that would refuse a script from the Command Center's
  folder or a request to `universalis.app`; whether `checks.yml` checks out with `fetch-depth: 0`; whether
  `universalis.app` answers from this environment (one request, `/api/v2/tax-rates?world=73`). Accept: each answer with
  file and line. Escalate if: a suite fails before any change, or the foundation is not in `<base>`.
- **B1 Saved replies (Sonnet builder; first).** Files: `tracker/tests/fixtures/universalis/{region-two-items,
  region-europe-two-items,region-oceania-two-items,world-one-item,slim-two-items,history-one-item,tax-rates,
  unknown-item,unknown-place,hq-filter}.json` and `README.md`
  (the exact request path and date of each, with the status code and the reply's size before trimming; trimmed to 5
  listings and 10 sales per item; retainer, buyer and creator names removed; the guide line on who pays the tax),
  `tracker/tests/bourse-replies.test.js` (BR-1 to BR-6: every field of section 3 present with its type; the time
  units; BR-7 the tax model: the rate's unit, and the arithmetic of `total`, `tax`, `pricePerUnit × quantity`; BR-8
  the three regions' request names as they were really sent, and what an unknown item and an unknown place answer),
  `tracker/data/SOURCES.md` (one "Universalis reply fixtures" line), `package.json`. Accept: the test passes; a table
  "field, found or missing, fallback taken" and the three tax answers in the report. Escalate if: the host cannot be
  reached (the orchestrator then asks the owner to save the replies from a browser; B5 to B9 wait), `quantity` is
  missing, or the tax arithmetic fits neither form.
- **B2 Price service (Sonnet builder; after B1).** Files: `prices.js`, `tracker/tests/prices.test.js` (PR-1 to PR-5
  **unedited**; new PX-1 queue: 30 calls never exceed 2 in flight and 300 ms apart, with a fake clock; PX-2 a 429 and
  three failures pause for 15 minutes and waiting calls resolve not fetched; failures while offline do not count; going
  online and Refresh lift a failure pause; neither lifts a 429 pause; PX-3 `PRICE.idb` keeps two places apart and a
  second service's records untouched; PX-4 `readDeep` on the fixtures: both qualities, per world, cheapest first, no
  names kept, `null` for an empty reply; PX-5 `readSlim` likewise, with the fallback chosen in B1; PX-6 `maxRequests`:
  the rest stay not fetched, never "no price"; PX-7 `freshMs`, `noneMs`, `endpoint` defaults give today's URL and
  limits; PX-8 `placePath` gives B1's real request name for every region, data center and world of `live.json`, an
  unknown place is not sent, and with `strict404` a 404 is a failed fetch that records no "no price"). Accept: `npm
  run test:unit`; `CHECK_ONLY=C113,C117,C155 npm run check` unchanged and passing. Must not change: any record or URL
  of Submersibles or Lists. Escalate if: PR-1 to PR-5 need an edit.
- **B3 Save section and sync (Sonnet builder; after B0).** Files: `tracker/src/core/save.js` (`checkBourse`, `CHECK`,
  `LABEL`, labels, BI1), `tracker/src/core/merge.js` (BY0 and its `applyMerge` branch), `tracker/tests/core.test.js`
  (BS-1 checker table, every range and enum, `area`, the whole frame; BS-2 round trip through `unflatModules`; **BS-3
  the shipped `save.js` at `<base>`** keeps a full section byte for byte through `CC.checkDoc` and a write of another
  section; BS-4 BI1 refused, store unchanged; BS-5 two tabs on different watched items both kept; **BY-1 two devices**:
  each adds a watched item, both kept; one changes a target, taken; both change it, asked, each answer; BY-2 BY0 in
  both orientations through the real `ET.saveMerge` (no answer keeps) and a full sync (asked until answered); BY-3 the
  old device runs the shipped `merge.js` and `save.js` at `<base>` and drops nothing it did not remove; BY-4 the labels
  word for word), `check.js` C197 (the three new builds, and the Tracker and Atelier shipped at `<base>`, each save and
  leave the section byte-identical), C198 (the BY0 question in the Settings dialog, each answer), rebuilt copies.
  Accept: unit suite; `CHECK_ONLY=C119,C122,C145,C146,C197,C198 npm run check`. Must not change: any rule or test of
  another section. Escalate if: an existing test needs an edit, or `<base>` cannot be read.
- **B4 Shared look (Haiku clerk).** Files: `tracker/src/app/one-look.css` (`.ol-r-gil`, copied from `bm-r-gil` in
  `docs/bourse/mock/bourse-mock.css`), `tracker/command-center/one-look-fixture.html` (one gil block),
  `tracker/tests/one-look.test.js` (the role exists; ink on `--gil-m` reaches 4.5:1 in light and dark; `bourse.css`
  joins the module sheets the drift test reads, and must not contain `--gil-m` or `ol-r-market`), rebuilt copies.
  Accept: the test fails before, passes after; `CHECK_ONLY=C196 npm run check`. Escalate if: the contrast fails,
  another role's computed value changes, or look v3 needs a shared part `one-look.css` does not have.
- **B5 Math (Sonnet builder; after B1, B2).** Files: `tracker/command-center/src/bourse/market.js`, `src/lists/engine.js`
  (`LISTS.sumShares` moved in, `LISTS.marketNeeds`), `src/lists/lists.js` (calls the engine's `sumShares`; nothing
  else), `tracker/tests/fixtures/bourse-fixture.json`, `tracker/tests/bourse-market.test.js`
  (BM-1 median, even and odd, 7-day window, none is unknown, **joined over three regions' entries**; BM-2 profit by
  hand for three crafts: high-quality sale, yield 3, a merchant material cheaper than the market, a material whose
  cheapest listing is bait (the ranking uses the sales middle and the row is flagged); BM-3 unknown material or sale is
  never 0 and never ranked; BM-4 gathered at market and free; crystals; an untradable crafted material, and a loop
  ends; BM-5 tax **from the real `tax-rates` fixture**: lowest, chosen, the unit as B1 found it, the labelled 5%
  fallback, the buyer's tax in or out as B1 found; BM-6 old and too-old by the limits; slow sellers sink; bait marked;
  BM-7 buying an amount: whole listings, overshoot, too few, only high quality listed, none; BM-8 the three split modes
  on a table worked by hand, the threshold at its edge, ties, a split stack, a case where dropping a whole data center
  beats dropping any one world, **a region kept only when its saving beats the threshold (just under, just over, in
  each mode)**, and 50 items over every world of the area in under 200 ms; BM-9 route order by region, data center and
  world, the hop counts, and `saved` from the home world's own reply; BM-10 D16: the four
  cases of the formula, a mark of 99 of 99 then a need of 0 (the mark is removed) then a need of 50 (50 left), a
  mark with the need still 99 after 40 bought (59 left), "New trip" clears marks and own items, an own item bought in
  full is removed with its mark and Undo restores both; BM-11 `marketNeeds` equals `sumShares` for the fixture's
  lists; BM-12 the ranking order and both budgets (12, 72, 180) with a fake clock, and a batch with one region failed
  is not counted as priced; BM-13 D23: two characters needing one item make one row, a part tick is shared out in
  order, each mark under its owner; **BM-14 D26: the area's figure from three replies, a narrowed area leaves its
  worlds out, a failed region is named and never read as "none", an unknown world is left out and counted**),
  `package.json`.
  Accept: unit suite; `lists-engine` and `lists-model` tests unedited; `CHECK_ONLY=C150,C155 npm run check` unchanged.
  Escalate if: a rule cannot hold as written, or moving `sumShares` changes a Lists check.
- **B6 Page shell and build (Sonnet builder; after B13).** Files: `src/bourse/{index.html,bourse.css,bourse.js,
  services.js}` (`services.js`: the five services of section 3 and the per-region joining, the one definition),
  `build.js` (the page, `bourse/data.js` from `live.json` and `timers.json` with `BOURSE_AREA`, stopping unless it is
  the seven data centers of D25), `tracker/tools/one-look-header.js`
  (`MODS`), `src/index.html` (card), `src/shell.js` (module list, live line), `src/sw.js` (`PAGES`), the count lines B0
  listed (like for like, named in the pull request), rebuilt copies. Steps: the header, the views' tab bar, settings
  sheet (the travel area among them), empty states, the status line, reading the Lists data (packed or plain), the one
  write at a time of `lists.js`. Accept: unit suite; `npm run test:browser`; the page opens offline with an empty save
  and shows the empty trip. Escalate if: a check reads a count B0 missed, or look v3 is not approved.
- **B7 Trip (Sonnet builder; after B6).** Files: `bourse.js`, `bourse.css`, `check.js` C202 (on stand-in replies for
  three regions: the three modes give the hand-worked stops and totals; a region dropped under the threshold and kept
  over it; a data center dropped whole; route order and the three counts (stops, region hops, data-center hops); the
  answer is the total to spend; overshoot wording; the home world asked for and never shown empty from a region reply
  alone; a failed region named; "Only high quality is listed"; a joined row
  for two characters; tick only leaves `modules.lists` byte-identical; "also add" raises each character's "I have" and
  Undo restores both; a mark removed when Lists' need is 0; "New trip" after its confirm; D10's copy shows once and is
  tried again after an empty one; the travel sentence and the maintenance note; 4 requests per 100 items; 50 items
  over the whole area drawn with the split under 200 ms).
  Accept: `CHECK_ONLY=C202 npm run check`. Escalate if: `LISTS.store` has no edit that adds to "I have" from another
  page.
- **B8 Profit (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C200 (opening sends at most 3
  requests; one press at most 12; never more than 2 in flight; a reload within 15 minutes sends none; the budget
  disables the main action with its sentence; a 429 pauses and says so; offline failures leave no pause after coming
  back), C201 (the fixture's figures equal BM-2 over the area; the "you can only sell on your home world" sentence
  once; the opened row's home-world figures; "of N ranked"; the four closed groups; no row shows 0 for an unknown; a
  negative profit; the bait flag; "Solve" absent for a no-hand-over recipe; the tax list, and the labelled 5% when the
  rates fail). Accept: `CHECK_ONLY=C200,C201 npm run check`. Escalate if: a pass over real data draws slower than 1
  second.
- **B9 Watch (Sonnet builder; after B7).** Files: `bourse.js`, `check.js` C203 (the Watch view: three groups over the
  area; "Under, but the price is old"; the alert sentence; adding, changing and removing a watched item; at 360 px the
  longest item name wraps and the age is whole). Accept: `CHECK_ONLY=C203 npm run check`. Escalate if: the view needs
  the checker of B15 to show its rows.
- **B10 The Tracker's link and Lists' prices (Sonnet builder; after B6).** Files: `tracker/src/app/live.js` (D9, D10),
  the tests B0 listed (those pinning the Tracker's requests are replaced by tests of the link and of `mcopy`; listed in
  the pull request), `src/lists/lists.js` (D8), `check.js` C204 (no request to the price host from the Tracker's own
  code; the link; `mlist` still stored; the copy reaches the save once; an amount of 0 or 1,000,000 arrives as 1 or
  99,999), C191 rewritten as C205 (an ordinary 100 and a high-quality 10,000 each on their own row and both in the
  subtotal; an old four-part record still reads), rebuilt copies. Accept: `npm run test:browser`;
  `CHECK_ONLY=C155,C204,C205 npm run check`. Escalate if: C155 changes.
- **B11 Look checks and pictures (Sonnet builder; after B7 to B9, B14, B15).** Files: `check.js` C206 (**the limits of
  the approved look v3 and of the design rules**, on Trip, Item, Profit, Watch, the sheet, the empty trip and every
  state of `docs/bourse/mock/states.html`: fetch failed, a region not fetched, paused, budget spent, choose home world,
  empty watch list, Item before a search, a negative profit; at 1,440 x 1,000 and 360 x 800, real data with stand-in
  prices, seeded with the three longest item names of the data and five-digit counts and gil in the millions. Whatever
  the drawing, it measures: row heights at rest and rows in view (P2, P4); where the first row starts (P3); one
  primary and at most primary, More and one stepper per row (A1, A2); one main action per screen; no data-face text
  without a digit (T2); no age written as a digit and one capital letter ("14M"); no configuring field at rest but
  "Find an item" (F1); the status line's form, the alert line included (S1); 40 px targets (A6); no sideways scroll
  and no figure cut off (P1); every computed colour a tone of a role, none of them the market role, gold on gil bars
  only (K1, the helper of C160)), C196 (the Bourse page joins its six pages), evidence block `bourse-*.png` copied to
  `docs/bourse/build/` with `notes.md`: one "bold" or "still tame: <what>" line per picture and every difference from
  the approved look v3 pictures listed. Accept: `CHECK_ONLY=C196,C206 npm run check`; a temporary third bordered
  button in a row fails C206 (reverted, reported). Escalate if: a limit cannot be met without changing the look, or
  look v3 or the states page is not approved and in the repository when this item starts.
- **B12 Full run and records (Haiku clerk; last).** `npm run build` twice, the three suites, `npm run check`; add the
  entry to `docs/STATE.md` under "Built, waiting for the owner's `ship`" with what was and was not tested (the live
  price site, Firefox, Safari, a real phone, a real two-device sync) and with **what now runs while the app is open
  (the watch checker on every page) and how to stop it (Alerts, in Bourse settings)**. Accept: git clean; counts
  reported. Escalate if: any failure.
- **B13 The store (Sonnet builder; after B3, B5; before B6).** Files: `src/bourse/store.js` (pure edit functions over
  the section: watch, own items, marks, settings and the travel area, the mark clean-up and "New trip" of D16, the
  own-item removal of section 6, the copy of D10), `tracker/tests/bourse-store.test.js` (BT-1 every edit and its
  limit, a default not stored; BT-2 D10: the larger amount kept, amounts brought into range, `mlistCopied` only after a
  non-empty copy that was saved, tried again otherwise; BT-3 the clean-up removes only marks whose need is 0 and
  returns how many; BT-4 "New trip"; BT-5 a tick shared across characters; BT-6 the area: all seven is not stored, a
  narrowed one is, the last data center cannot be unticked), `package.json`. Accept: unit suite. Escalate if: an edit
  needs a field the checker does not hold.
- **B14 Item (Sonnet builder; after B7).** Files: `bourse.js`, `bourse.css`, `check.js` C199 (every price names its
  world and age; every world of the area is shown, by region and data center; the answer is the unit price for the
  amount needed, labelled; listings and sales apart; a world missing from the replies never reads "none" unless its
  region's own reply has no listing; a failed region reads "not fetched"; Normal and High quality never mix; old and
  very old marks; ages in words; the screen before a search; history from the fixtures of three regions, and its
  fallback; 6 requests). Accept: `CHECK_ONLY=C199 npm run check`. Escalate if: the history fallback of B1 leaves fewer
  than 7 days of sales.
- **B15 Alerts on every page (Sonnet builder; after B9).** Files: `tracker/command-center/src/watch-alert.js` (new),
  `build.js` (copy it), one script line in `src/{index,submersibles/index,lists/index,bourse/index}.html`, the
  hosted-only code of `tracker/src/app/ui.js` and `crafting/atelier/src/atelier.js` at the places B0 reported (add the
  script only inside the Command Center), `tracker/tests/bourse-alert.test.js` (BA-1 the claim: older than the
  interval starts a round, a newer one does not, a claim overwritten during the wait does not run; BA-2 nothing is
  loaded or sent with an empty list, alerts off, hidden, offline or paused; BA-3 one ring per crossing, shared through
  the device record, again after going back over; BA-4 no ring for a listing older than `oldDays`; BA-5 a round is at
  most 6 requests), `package.json`, `check.js` C207 (on each of Home, Settings, Submersibles, Lists, the Bourse, the
  hosted Tracker and the hosted Atelier: a watched item under its target raises one alert line and its link opens the
  Bourse's Item view; two tabs open together send one round, counted per region at the stand-in; an empty watch list
  sends nothing and loads no price code; a hidden page sends nothing; with `watch-alert.js` refused by the check's
  server each page still passes its own opening check; the downloaded Tracker and Atelier files do not contain the
  script's name), rebuilt copies. Accept: unit suite; `npm run test:browser`; `CHECK_ONLY=C9,C196,C203,C207 npm run
  check`. Must not change: any existing check of the six pages. Escalate if: a page's policy or service worker
  refuses the script or the price host (B0), or the alert line collides with a page's own status line in a way look
  v2 does not settle.

## 11. Risks, limits, owner questions

**First thing to verify (before B5):** B1's replies, the tax model among them, and the size of a region's reply.
Second: **who pays a listing's tax** is general knowledge of the game, not in the research; the orchestrator confirms
it with the owner, who plays, or a guide. ("A listing is bought whole" was confirmed by the owner in round two.) Third:
`LISTS.store` can add to "I have" from another page. Fourth: B0's answer on the Tracker's and the Atelier's hosted-only
code, before B15.

**Risks.** Load on a free service is about three times the first plan's per lookup (three regions): bounded by D4,
D27 and section 4, and nothing but the watch checker ever asks without a press or an opened screen. The watch checker
now runs wherever the app is open: at most 6 requests every 30 minutes per device by default, one tab at a time; two
tabs claiming at the same instant can each run one round where the browser has no lock. The reply sizes of `deep` at
region level are unmeasured; B1 reports them. Sale prices over three regions say little about what the home world
pays: the opened row is where that shows. The greedy split can miss a better one. `save.js` and `merge.js` change
again: an Atelier or Tracker left on an old cached copy keeps the section but not its two new rules, and does not load
the alert script until it updates. Moving `sumShares` touches the shipped Lists page. The header gains a seventh page;
the Tracker's phone header may need a second row (P1 is checked). Look v2 is not approved yet: six items wait for it.

**Known limits, as designed.** Direct materials only (D12). The ranking prices one unit, and the cautious material
price can understate a profit (D13). The ranked sale price is the travel area's, where the player cannot sell outside
the home world (the owner's choice, D29). A full ranking takes about 28 to 35 presses over three six-hour windows
(D27). An ordinary need never buys a cheaper high-quality listing; it is named, not planned. A fall in Lists' need for
any reason is read as the purchase typed in, and a mark is cleared only when the Trip is next opened with the need at
0: a need that fell to 0 and rose again while the Bourse stayed closed is still reduced by the old mark until "New
trip" or Undo (D16). Worlds other than home show only what is among their region's cheapest 60 listings (D24). The app
does not know the game's travel rules; a data center left in the area that cannot be reached is planned as a stop
(D25). Maintenance announced after the last build is unknown (D17). An item added to the old shopping list by a cached
old Tracker after the copy is not copied. The same bought mark changed on two devices is asked. Tax is a reading, not
"this week's" by a calendar: the screen says when it was read. Alerts need the app open in a tab, on any page. Not
tested by any automated run: the live price site.

**Owner questions.** Closed in round two (section 13): 1 (the Trip's big number: the total to spend), 2 (the sale
price: the whole travel area), 4 (alerts: every page), 6 (the region beside a profit row: the area is the figure; the
home world shows on the opened row). **Open:**

3. **The downloaded single-file Tracker** has no Bourse beside it. (a) Its Market Board page says the market moved to
   the Command Center, and it shows no prices: one price reader in the whole project, the download loses a feature.
   (b) The download alone keeps the old price reader: nothing is lost there, but two readers stay to maintain and the
   old one has no pacing. (c) Keep things as they are everywhere: the Tracker keeps its Market Board and the Bourse sits
   beside it, against your answer 2. Fairly sure. **Recommended: (a).**
5. **The standing sentences** (section 9: about prices, about profit, "you can only sell on your home world", about
   travel, about alerts) are public claims. (a) As written there. (b) Your own wording. (c) Keep things as they are:
   the Tracker's current sentence ("Live market prices from Universalis, a community site…"), which mentions none of
   profit, travel or alerts. No cost. Fairly sure. **Recommended: (a).**
7. **When this week's tax rates cannot be read.** (a) Work profit out with 5%, the usual full rate, and say so on the
   screen: profit is not overstated, but the figure is an assumption until the rates load. (b) Show profit before tax
   and say so: nothing assumed, but every figure is too high by the tax. (c) Keep things as they are: there is no
   earlier rule; the builder builds (a). No cost difference. Fairly sure. **Recommended: (a).**
8. **Section heads on the Bourse** (you asked to see both on the Trip screen; it is chosen from the pictures of look
   v2). (a) Keep things as they are: book-style titles, the standing rule for every new module. Nothing else changes.
   (b) Submersibles' dark capital bars: closer to the screen you named as closest, but it changes a house rule you set
   on 2026-11-24, so the rule is rewritten and later modules follow whichever you choose. No build cost either way
   before the screens are built. Not sure without the pictures. **Recommended: (a) unless the pictures say otherwise.**
9. **How fast the profit ranking may fill** (new: three regions make it three times the lookups). (a) As planned: 400
   crafts a press, and a limit that spreads a full ranking of every recipe over about 12 hours; one job or one level
   band is ranked in a few presses. Gentle on the free price site. (b) A higher limit, so everything can be ranked in
   one sitting: about 400 lookups in ten minutes from one device; a real risk of being slowed or refused by the site.
   (c) Keep things as they are: the earlier limit, set for one region; a full ranking would then take several days.
   Fairly sure. **Recommended: (a).**

**What was read, and what was not verified.** Read: the files the brief lists, and round two's table. Not verified:
any Universalis reply (the host was unreachable; every [verify] mark); whether the foundation is merged (B0); look v3
and the states page (not read; not approved yet); `lists.js` beyond lines 1 to 160 and the `sumShares` call (its line
number and the packed-data reading are the red team's); `ui.test.js`; the Tracker's and the Atelier's hosted-only code
and policies (B0); the size of anything built. Checked for round two: `live.json` `dc` lists Japan, North America,
Europe (with Shadow) and Oceania, and `worlds` has entries for eight data centers (the seven and Elemental).

## 12. Red team and pre-mortem (2026-11-24)

**Same-family review:** the red team was a Claude model reading a Claude-written spec. It is not an independent
audit. The findings are numbered as the coordinator sent them (12 to 14 were not sent). Round two later changed some
of the fixes; the last column of section 13 says which.

| # | Finding | What changed | Left as a known limit |
| --- | --- | --- | --- |
| 1 | Old bought marks hide new needs | D16: a mark is removed when Lists' need is 0; "New trip"; own items removed when bought in full or by the player (section 6); BM-10, BT-3, BT-4, C202 | A need that fell to 0 and rose again while the Bourse stayed closed |
| 2 | Tax model unknown | Section 3: the rate's unit, the listing's arithmetic and who pays are [verify], recorded by B1 (BR-7); one model in percent (section 5); buyer's tax counted only when shown, counted when unclear; BM-5 on the real fixture; a labelled 5% when rates cannot be read (owner question 7) | Who pays is a game rule the replies cannot prove; it needs the owner or a guide |
| 3 | Region name | D1: `PRICE.placePath`, tested against B1's real paths (PX-8, BR-8); D5 `strict404`: a 404 is a failure | None |
| 4 | Home world looks empty | D24: the home world is asked for too; other worlds say "not among its region's cheapest 60" | Other worlds are still seen through the cheapest 60 |
| 5 | Split too slow | Section 6: each item priced once per world, then chosen; 200 ms limit in BM-8 and C202 | The limit is measured on the test machine, not a phone |
| 6 | Split ignores data-center hops | Section 6, D15: whole data centers are dropped before worlds; BM-8 case | Still greedy: "a good split" |
| 7 | Offline lockout | D4, D7: offline failures do not count, going online or Refresh lifts a failure pause, a 429 pause stays; no gate record while offline for the Bourse; PX-2, C200 | Lists and Submersibles keep their pinned gate |
| 8 | Ranking overstates profit | D13, section 5: bait flag. **The finding said to cost a material at the lower of its cheapest listing and its sales middle; the lower raises profit, so the spec takes the higher.** Not yet ruled on by the coordinator | A cautious price can understate; the opened row gives the walked figure |
| 9 | High quality in Lists reads "none" | D8: `minPriceHQ` first, then the `hq` filter, both verified by B1 (`hq-filter` fixture); the scan of 20 only as the last fallback | "None among the cheapest 20" only if both fail |
| 10 | Tracker list copy | D10: `mlistCopied` only after a saved, non-empty copy; amounts brought into range; BT-2, C204 | Items added by an old cached Tracker after the copy |
| 11 | Alerts on stale listings | Section 7: rings only within `oldDays`; phone wrapping; C203, BA-4 | None |
| 15 | Tests that pass at the base; `sumShares`; packed data | Section 10: the named guards; `sumShares` moves into the engine (D14, B5); packed data read through `CC.unpack` (D1, B0, B6) | None |
| 16 | No `timers.json`; items too large; trip owner | D17: built copy only; B6 split (B13 the store), B7 split (B14 Item); D23 the owner rule, BM-13 | Maintenance announced after the last build |
| Look | Long names, "14M", only-HQ wording, the Item answer, `--gil-m`, the states page | Sections 6, 9; D21 and B4; C206, C199, C203 | C206 waits for look v3 and the states page |

**Pre-mortem: how this could still fail after shipping.** (1) B1 cannot reach the host and the fixtures are delayed:
five items wait, by design. (2) A [verify] field is absent and its fallback makes replies heavy (the scan of 20
listings): the budgets of section 4 still cap the number of requests, not their size. (3) The price site changes a
field later: the readers return "no usable reply", the screens say unknown, and nothing shows 0. (4) The ranked sale
price is the travel area's and the owner's world sells for less: the opened row shows it, the ranking does not. (5) An
old cached Tracker or Atelier meets the new section: it is kept, but that device's unanswered merge can follow a
removal. (6) The price site slows or refuses a device that keeps the app open all day with a long watch list: the
pause of D4 stops every lookup for 15 minutes and the screens say so.

## 13. Round two (2026-11-25)

The owner's second table in `docs/bourse-questions.md` wins over the first where they differ.

| Round two | In this spec | Changes an earlier fix or decision |
| --- | --- | --- |
| The look: change every screen, closest to Submersibles; state colours instead of the market purple; gold for gil bars only | D31, D21; section 9 refers to look v3 and names no drawing; B4 forbids `ol-r-market` in the module's sheet; C206 measures the approved look; B6 and later wait for approval | The look spec's first version is no longer the reference |
| Section heads: draw both, the owner chooses | Owner question 8 (open) | A choice of bars would change design rule C6 |
| The Trip's big number: the total to spend | Section 6 (route); owner question 1 closed | None |
| Prices over the whole travel area, seven data centers in three regions, a setting to narrow it | D25, D26; section 3 (per region); `prefs.area` replaces `prefs.place`; B1 saves replies of all three regions; BM-14, BT-6 | Answers 5 and 15; D24's wording ("its region's cheapest 60") |
| Lookups roughly triple | D27; section 4 (330 to 420 requests for a full pass; 12 a press, 72 a visit, 180 per six hours, fresh for 24 hours); the queue's pace unchanged; watch rounds at most 6 requests every 30 minutes; owner question 9 (new) | The first plan's 10, 60, 150 and 6 hours |
| The trip by region, then data center, then world; another region only when its saving beats the threshold; region hops counted | D28, D15; section 6 (split in three passes, route, the counts); BM-8, BM-9, C202 | Red-team fix 6 gains a pass above it |
| Travel limits: buying works elsewhere, selling does not; no claim about who can travel where | Section 6 ("Said once"), D25, the sheet's sentence; known limit | None |
| The sale price for profit over the whole travel area | D29, D13; section 5; the sentence on Profit and the home world's figures on the opened row; `prefs.sellAt` dropped; owner questions 2 and 6 closed | The spec's recommendation of the home world; red-team finding 8's "region at rest" |
| Alerts on every page | D18, D30; section 7; B15, BA-1 to BA-5, C207; B9 is now the Watch view alone; B12 records what runs and how to stop it; owner question 4 closed | D18's first form (the Bourse page only) |
| A listing is bought whole | Section 6; the open point is removed from section 11 | None |

**One difference to tell the owner.** The owner said the seven data centers match the app's own world list.
`tracker/data/live.json` holds worlds for eight: the seven and Elemental (Japan). The spec uses the seven the owner
named and the build stops if the data gives anything else for those three regions (D25); Japan is simply not in the
area. No question is open on it.

**Orchestrator rulings after round two (2026-11-25).** Red-team finding 8: the spec's "higher of the cheapest listing and
the recent-sales middle" stands; it never overstates profit, which was the finding's aim. Who pays the tax: both sides,
per `docs/bourse-research.md` section 4 (guides and an official forum thread); B1 still checks how a reply records it.
"A listing is bought whole": confirmed by the owner. The world list in `live.json` also holds Japan's Elemental; the
travel area takes only the owner's seven data centers.

**Round four (owner, 2026-11-25).** The owner chose one look for the whole app, B (Atelier-led), after seeing four
candidates (`docs/one-look/v3/`). The Bourse is drawn in it (`docs/bourse/mock/`, look v3); the dark-bars Trip variant is
withdrawn. The answer band's state blocks stay on the phone (owner's choice): on screens without a strip the first row then
starts at 256 px, over the 200 px limit of design rule P3, an exception the owner chose, to be written into
`docs/design-rules.md` with the one-look move. The Bourse stays paused until the one look's module moves begin.

**Round five (owner, 2026-11-25).** Look v3 approved; B6 and later no longer wait on the look, only on the outside review
and on the one-look rules pull request. Question 7 (tax fallback) closed: the labelled 5% stays as a safety net. Question 9
(ranking pace) closed: the recommended pace.
