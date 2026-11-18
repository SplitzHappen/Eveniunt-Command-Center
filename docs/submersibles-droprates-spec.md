# Submersibles: community drop rates, gil routes and the top rank: spec

Written 2026-11-18. Nothing was built or run for this spec.

**Read for it:** `CLAUDE.md`, `docs/STATE.md`, `tracker/data/SOURCES.md`, `docs/submersibles-recommendations-spec.md`
(sections 3, 4, 10; called "the recs spec" below), the orchestrator's research note and the local copies of the two
community sources it points to (`Submarines.json` in parts, `sector.ts`, `build.ts`, `voyage.ts`, `target.ts`,
`Submarines.cs`, `SubLoot.cs`, `SubmarineLoot.cs`, `Sectors.cs`, `Loot.cs`, `Build.cs`, both `LICENSE` files), parts
of `tracker/data/submarines.json` (sources, sectors, parts, ranks, `itemInfo`, `commonRoutes`), and a count of three
phrases across the source, test and tool files (section 7).

**Not read:** `advisor.js`, `recs.js`, `subs.js`, `earn.js`, `chart.js`, `check.js`, `tracker/tools/submarines.py`,
`tracker/tools/recs-tune.js`, the tests. Every function name below comes from the recs spec. Each work item starts by
finding the code it names and escalates if it is not there. The worked example (5.3) was computed by hand.

## 1. Goal and constraints

The owner's three fixes to the built, unshipped Submersibles work:

1. A submarine at the top rank (145 today) skips Leveling and defaults to gil farming; below it, the owner's order
   (Unlocking, Leveling, Gil, Loot) stays.
2. The module shows drop rates from the community.
3. Gil Farming means the community's gil routes (OJ and the others), the ones whose loot is sold to merchants.

Constraints:

- Offline-first, public, on GitHub Pages. The app never reads or automates the game. No game number is typed or
  guessed: data is pinned at a commit, licensed, imported by `tracker/tools/submarines.py`, read as text, never run.
- `tracker/src/core/save.js` is not changed and nothing new is stored in the save. Only the Command Center is rebuilt.
- An estimate is always called an estimate, with its sample size. No sentence promises a drop.
- No visuals are specified here (a separate spec restyles the module): content and wording only.
- This sits on the unshipped line of work (S6, S4, Customizable Recommendations). Nothing merges without `ship`.

## 2. What the sources say: known and inferred

**Known, read in the code.**
- `Loot.cs`: the game reports each survey with result codes. Surveillance: 4 tier 3 (high), 5 tier 2 (high), 6 tier 1
  (high), 7 tier 2 (mid), 8 tier 1 (mid), 9 tier 1 (low). Retrieval: 14 optimal, 15 normal, 16 poor. Favor: 18 yes,
  19 "stats enough but failed", 20 low. So surveillance has a **band** (low, mid, high) and a **tier actually rolled**:
  high can land in tier 1, 2 or 3, mid in 1 or 2, low only in 1.
- `SubmarineLoot.cs`, `Submarines.cs`, `SubLoot.cs`: one uploaded record is one sector survey (first item and count,
  second item and count, the submarine's three stats, the codes); repeats are dropped by hash. The export keeps **the
  first item only**, grouped by the tier rolled (`Pools.Tier1..3`). Per pool, `Stats` counts records by band (`Min`,
  `Mid`, `High`), by retrieval result (`Low`, `Normal`, `Optimal`) and by favor (`Favor` = enough favor, `DoubleDips`
  = a second item came). Per item: `Amount` (rolls), `Total` (summed quantity), `MinMax` (smallest and largest
  quantity seen per retrieval result). The second item's identity and quantity are **not exported** (a TODO there).
- `Sectors.cs` and `sector.ts`: one threshold row per sector (surveillance for tier 2 and tier 3, retrieval for normal
  and optimal, favor). The two tables are identical in the copies read. The source's own planner compares
  `threshold <= stat` sector by sector. `Sectors.cs` says its numbers were "automatically calculated and taken from"
  a community spreadsheet; `sector.ts` carries no such note (owner question Q1).
- `Build.cs`, `build.ts`: a stat is the rank's bonus plus the four parts, as in this app.

**Known, read in the data** (commit `c7bd2253`): `Total` 205,249,206; sector 15 (O) has 61,069,971 records. In the
six pools checked by hand (O and J), item `Amount`s, band counts and retrieval counts each add up to the pool's
`Records`. From the research note, not recounted: all 143 sectors are present, the fewest records are 18,474.

**Inferred** (section 5.2 gives the confidence): that the thresholds decide the band; that odds inside a band do not
depend on how far above the threshold a stat is; the quantity inside a retrieval result; everything about the second
item except how often it comes. Forum posts say weather picks the pool; the data is organised by tier, and no weather
is modelled.

## 3. Decisions

| # | Decision | Rejected |
| --- | --- | --- |
| E1 | Drop data and thresholds become two new tables in `tracker/data/submarines.json`, written by `tools/submarines.py` from `Infiziert90/FFXIVGachaSpreadsheet` at `c7bd22537e3fdd1fce05d9d84250ba475a7bb6e5`. | A second data file: one more thing to build and cache. Fetching at run time: not offline, and it would change under the player. |
| E2 | Raw counts are kept (rolls, summed quantity, ranges); the app does the arithmetic. | Storing computed rates: nobody could check them against the source. |
| E3 | Tier odds are measured per sector and band: rolls that landed in each tier among rolls of that band. | One fixed split for every sector: among all recorded surveys tier 3 is 15% at O and 18% at concealed bay (R). |
| E4 | Quantity is the middle of the range seen for the submarine's retrieval result, scaled so that the pool's own retrieval mix gives back the average the community recorded (`Total / Amount`). | The plain middle: range ends come from single records out of millions, and at O's tier 3 it gives 4.5 for every salvaged item where the records average 4.44 to 4.76 depending on the item. The plain average: ignores retrieval (a poor result gets 1, not 4.6). |
| E5 | The second item comes as often as recorded (`DoubleDips / Favor`, 82% at O and J) and is assumed to be drawn like the first. Said in the app. | Leaving it out: 45% of a voyage's loot at O. A different guess: no data supports one. |
| E6 | Gil is ranked in **merchant gil**, for every route. Market prices cached on the device give a second figure, shown only. | Cached market prices for ranking: the answer would differ per device and per day, bulk loot does not sell at the listed price, and fix 3 defines Gil Farming by merchant sale. |
| E7 | Every route is ranked by the same community estimate. The player's own log (S6) is shown beside it and no longer picks the route (owner question Q3). | Log first, as S6 does today: any route with 10 logged voyages, a levelling route included, would beat an unlogged OJ, against fix 3. Log replaces the estimate per route: ten voyages are too few (about a quarter either way on OJ, one standard error) and it compares a measured route with an estimated one. |
| E8 | Community routes first: when the submarine can run a pinned route, the plan is the best of those by estimated merchant gil per hour for this submarine. | Pure ranking by estimate: see E9. |
| E9 | A derived route never becomes the plan while a community route can be run. When it beats the plan by more than 5% it is shown as an other route, labelled, with both figures. | Letting it outrank: fix 3 names the community routes as what Gil Farming is; the estimate rests on E4 and E5 while community routes are the ones players run (61 million records at O); and above 8 sectors per sea the search is "best found", not proven. |
| E10 | Derived routes are searched only in seas where the submarine can run no community route. | Every sea: near-copies of OJ would fill the other-route slots. |
| E11 | At the top rank Leveling is skipped for that submarine and the rest of the player's order applies as it stands, so Unlocking still leads while that submarine can reveal something (owner question Q2). | Moving Gil to the top for top-rank submarines: a free company whose strong submarines are all 145 would stop exploring by itself. |
| E12 | The Leveling row in Setup is never disabled; a line under it names the submarines it is skipped for. | Disabling it: the order still applies to every submarine below 145, and a new one starts at rank 1. |
| E13 | Loot Farming is one stage: for each chosen item, the route's expected quantity per hour as a share of the best this submarine can get for that item; shares are added. | Adding raw quantities: 27 gems would outweigh 1 rare item. Keeping "how many chosen items a route covers" first: a route with two tiny chances would beat one that brings one item well. |
| E14 | Gil part advice counts all five stats: a swap is valued by the estimate for the changed build on the same route, and advised only above 5%. | Today's refusal of any swap that lowers surveillance, retrieval or favor: with thresholds known, a stat that stays above every threshold of the route loses nothing by the model. |
| E15 | The experience bonus is not added, though the same thresholds would allow it. Experience stays "at least". | Adding it: not asked for; the 25% steps rest on the source's reading only. |
| E16 | New pure file `drops.js` (`globalThis.DROPS`); nothing else computes an estimate. Tests stay in `tracker/tests/submarines.test.js`. | Inside `advisor.js` or `earn.js`: the Map, the send window, Earnings, the pickers and the tuning tool all need it. |
| E17 | `advise` without `input.recs` stays as it is (recs spec D7). Invariant I1 of the recs spec is retired: the Gil stage no longer equals the old step 3. | Changing the old path: every older advisor test would move. |

## 4. Data (work item D1)

### 4.1 Source and notice

- Repository `Infiziert90/FFXIVGachaSpreadsheet`, commit `c7bd22537e3fdd1fce05d9d84250ba475a7bb6e5` (2026-11-17), files
  `website/static/data/Submarines.json` (280 KB) and `website/src/lib/submarines/sector.ts`, fetched from
  `raw.githubusercontent.com` through the tool's existing cache.
- Licence: MIT, "Copyright (c) 2023 Infi <infiziert@protonmail.ch>", the same notice and permission text as the
  Submarine Tracker entry. New entry `sources.gacha` with `repo`, `commit`, `snapshot`, `licence`, `notice`, `kind`
  ("community data") and `permission`, shaped like `sources.submarineTracker`.
- `tables.dropRates` and `tables.breakpoints` name the source, commit, files and a label: "community drop records:
  first item of each survey; the second item is not in the records" and "community thresholds; used for loot
  estimates only".

### 4.2 Fields kept

```
"breakpoints": { "15": [80, 115, 120, 160, 90], ... }          // [tier 2, tier 3, normal, optimal, favor]
"dropRates": {
  "all": [[low, mid, high], [0, mid, high], [0, 0, high]],     // band counts added over all sectors, per tier
  "sectors": { "15": {
      "n": 61069971,                                           // the sector's Records
      "favor": [60547216, 49900626],                           // Stats.Favor and Stats.DoubleDips, added over pools
      "pools": [                                               // tier 1, tier 2, tier 3
        { "band": [598383, 292539, 30745381],                  // Stats.Min, Mid, High
          "ret":  [538663, 204934, 30892706],                  // Stats.Low, Normal, Optimal
          "items": [[5192, 4789712, 132109342, 15, 20, 20, 25, 25, 30], ...] }   // id, Amount, Total, then
        , ... ] } } }                                          // MinMax poor, normal, optimal (min, max each)
```

- Items inside a pool are sorted by id. A pool's record count is not stored (it is the sum of its `band`).
- **Dropped:** `ProcessedId`, each sector's `Name`, `Letter`, `Rank`, `Stars` (checked against the game's, then
  dropped), `UnlockedFrom` (the pinned unlock table stays the only one), `T3Capable` (checked, then dropped), `WasT3`,
  and `MinT2` … `MinFavor` (each is the lowest stat in one record out of millions; O's tier 1 pool gives 68 where the
  threshold is 115).
- **Added to existing tables, nothing removed or changed:** `items` and `itemInfo` gain every drop item they lack
  (name, merchant price, market flag from the pinned game `Item` sheet). `formula.experienceNote`: "those thresholds
  are not used here" becomes "those thresholds are used for loot estimates only (table `breakpoints`); experience
  still shows the base value". `loot`, `unlocks`, `commonRoutes`, `sectors`, `parts`, `ranks`, `seas`, `subSlots`
  and the existing `counts` stay byte for byte.

### 4.3 What the tool verifies (it stops, writing nothing, on any failure)

1. Exactly 143 sectors in the drop file and 143 threshold rows; both id sets equal the game's sector ids.
2. `Total` is 205,249,206 and equals the sum of the sectors' `Records`; sector 15 has 61,069,971; the fewest is
   18,474 (sector 92, from the research note). A different figure means a different file.
3. Each sector's `Name` (markup removed), `Rank` and `Stars` equal the game's.
4. Each pool: item `Amount`s, `Min + Mid + High` and `Low + Normal + Optimal` each equal `Records`; tier 2 has no low
   rolls, tier 3 no low or mid rolls; `DoubleDips <= Favor <= Records`.
5. Each sector: `T3Capable` equals the pools' `High` added up; the pools' `Records` add up to no more than the
   sector's. A surplus (records the source could not place in a tier) is written to `dropped.dropRecordsWithoutTier`.
6. Each item row: `Amount > 0`, `Total >= Amount`, every range has min <= max, and `Total / Amount` lies between the
   smallest recorded minimum and the largest maximum.
7. Every drop item exists in the game's `Item` sheet with a name.
8. Thresholds: tier 2 <= tier 3 and normal <= optimal in every row; the table parsed from `sector.ts` equals the one
   parsed from `SubmarineTracker/Data/Sectors.cs` at the already pinned `04c54d77`.
9. New `counts`: `dropSectors` 143, `dropRecords` 205249206, `breakpoints` 143, `dropRewards` and `dropItemsAdded`
   as found (printed by the tool, then pinned by the unit test).

### 4.4 Size

About 95 KB added to `submarines.json` uncompressed (estimate: roughly 1,300 item rows of about 40 characters, 429
pool headers, 143 threshold rows, one notice; the source's reward count was not counted). D1 fails above 130 KB and
reports the exact bytes added to the data file and to the built site, raw and gzip.

### 4.5 Text for `tracker/data/SOURCES.md` (Submersibles section)

Two table rows:

| Table in the file | From | Version | Licence and notice |
| --- | --- | --- | --- |
| `dropRates`: for all 143 sectors, how often each item came as the first item of a survey, by loot tier, with quantities by retrieval result and how often a second item came (205,249,206 records) | FFXIV Gacha Spreadsheet `website/static/data/Submarines.json` | `Infiziert90/FFXIVGachaSpreadsheet` @ `c7bd22537e3fdd1fce05d9d84250ba475a7bb6e5` (2026-11-17) | MIT, Copyright (c) 2023 Infi <infiziert@protonmail.ch> |
| `breakpoints`: per sector, the surveillance needed for loot tiers 2 and 3, the retrieval for normal and optimal quantities, the favor for a possible second item | the same project, `website/src/lib/submarines/sector.ts`; must equal Submarine Tracker `SubmarineTracker/Data/Sectors.cs` @ `04c54d77` | same commit | MIT, same notice |

And a paragraph: "**Drop rates and thresholds (2026-11-18).** The records were uploaded by players who use the
source's plugin; this app reads only the published summary, as text, and runs nothing from it. The app still never
reads or automates the game. The summary holds the first item of each survey only: what the second item is, is not
recorded. Kept: per pool the counts by surveillance band and retrieval result and, per item, rolls, summed quantity
and the quantity range per retrieval result; per sector the record count and how often a second item came. Dropped:
the source's own names, ranks and unlock notes (checked against the game's), and its lowest-stat fields, which rest
on single records. Submarine Tracker's copy of the thresholds says they were calculated from a community spreadsheet;
the copy used here is the one published under the MIT licence. They are used for loot estimates only: experience
still shows the game's base value. What the app works out from these tables is an estimate, labelled as one, with the
number of records behind it." The existing "Experience" paragraph's "Those thresholds are not used" becomes "Those
thresholds are not used for experience". The regenerate commands do not change.

## 5. Expected gil for any route and build

### 5.1 Formula (`DROPS`, work item D2)

For a sector with thresholds `[t2, t3, normal, optimal, favor]` and a build with surveillance S, retrieval R, favor F:

- **Band** b: high when `S >= t3`, mid when `S >= t2`, else low. **Retrieval result** r: optimal when
  `R >= optimal`, normal when `R >= normal`, else poor.
- **Tier odds:** `P(t) = band_t[b] / (band_1[b] + band_2[b] + band_3[b])`. With fewer than 100 rolls of that band in
  the sector, the all-sector counts (`dropRates.all`) are used and the result is marked `few`.
- **Item odds in a tier:** `Amount / (the pool's rolls)`.
- **Quantity:** `q = mid_r x (Total / Amount) / sum over recorded results k of (w_k x mid_k)`, where `mid_k` is the
  middle of the range for result k and `w_k` the pool's share of rolls with result k (shares renormalised over the
  results that have a range for this item). No range for r: the nearest recorded result is used, lower first, and
  the result is marked `few`.
- **First item:** `first = sum over tiers of P(t) x sum over items of (item odds x q x price)`.
- **Second item:** `second = favor[1] / favor[0]` when `F >= favor`, else 0.
- **Sector:** `gil = first x (1 + second)`. **Route:** the sum over its sectors (the order changes the time only).
  **Per hour:** `gil / (seconds / 3600)`, seconds from `ADVISOR.evalRoute`.
- The same sums without the price give the **expected quantity** of each item.
- **Without a build, or without thresholds** (the "community average", used where no submarine is in view):
  `P(t)` = the pool's share of the sector's rolls, `q = Total / Amount`, `second = favor[1] / (the sector's rolls)`.
- `price` is passed in. Ranking always passes the merchant price (`itemInfo[id][0]`).

### 5.2 Assumptions

| # | Assumption | Known or inferred | Confidence |
| --- | --- | --- | --- |
| A1 | A stat at or above a sector's threshold puts the survey in the higher band or result | Inferred from the community thresholds; the source's planner uses them this way. The drop file's lowest-stat fields disagree in places | Medium |
| A2 | Inside a band, tier odds do not depend on how far above the threshold the stat is | Inferred: the records are not split by stat. O and J both give 51.2% / 33.2% / 15.6% on 60 million high-band rolls each | Medium |
| A3 | Item odds inside a tier are the same in every band | Checked on one item: Sapphire is 15.3% of tier 1 at O among high-band rolls, 15.1% among all | High |
| A4 | Retrieval sets the quantity only, the same way for every item of a pool | Inferred from the record layout (one retrieval result per survey) | Medium to high |
| A5 | Quantity as in E4 | Inferred; exact for a submarine like the community's, scaled by range middles otherwise | Medium |
| A6 | A second item comes as often as recorded | Known from the data: 82.4% of surveys with enough favor at O and at J | High |
| A7 | The second item is drawn like the first (same tier odds, items, quantities) | **Inferred; the records do not hold it.** 45% of the O and J figures rest on it. It applies to every route alike, so it moves the amounts more than the order of routes | Low to medium |
| A8 | Each sector of a route is judged against its own thresholds | The source's planner does so | Medium to high |
| A9 | Merchant price is the game sheet's `PriceLow`, as the Earnings tab uses today | Game data | High |
| A10 | Voyage time | "Calculated, not yet confirmed" (SOURCES.md) | As today |
| A11 | No weather, no rank effect beyond the stats | Not in the data | Unknown |

### 5.3 Worked example: OJ (by hand; D2's test must reproduce it, and corrects this table if it differs)

Route "Fight Club - OJ" (O then J). Build: rank 145, Shark-class hull and stern, Unkiu-class bow, Coelacanth-class
bridge (parts 3, 4, 5, 14): surveillance 185, retrieval 230, speed 235, range 170, favor 200. O needs 115 / 160 / 90
and J 115 / 110 / 90, so both surveys are high band, optimal, with a possible second item. Range used 59;
73,640 seconds (20 h 27 min).

| | Tier 1 | Tier 2 | Tier 3 | First item | Second item comes | Sector |
| --- | --- | --- | --- | --- | --- | --- |
| O: odds (high band, 60,074,656 rolls) | 51.18% | 33.20% | 15.62% | | 82.42% | |
| O: merchant gil per roll at optimal | 64 | 30,660 | 139,259 | 31,968 | x 1.8242 | 58,314 |
| J: odds (high band, 60,042,984 rolls) | 51.17% | 33.20% | 15.63% | | 82.42% | |
| J: merchant gil per roll at optimal | 64 | 30,665 | 139,284 | 31,985 | x 1.8242 | 58,348 |

- Tier 3 at O: Extravagant Salvaged Earring 32.5% (30,000 gil), Bracelet 27.5% (28,500), Necklace 22.5% (34,500),
  Ring 17.5% (27,000). Ranges 1 / 2 / 4 to 5 by retrieval; recorded averages over all results: Necklace 4.76, Ring
  4.70, Earring 4.60, Bracelet 4.44. 99.5% of that pool's rolls were optimal, so its mix-weighted middle is 4.487
  and the Earring's optimal quantity is 4.5 x 4.601 / 4.487 = 4.61.
- **About 116,700 merchant gil a voyage, about 5,700 an hour for this build.** Label: "estimate from community drop
  records, at least 60.0 million surveys per sector".
- The same parts at rank 85 (retrieval 148): normal at O (160 needed), optimal at J. O falls to about 25,900 and the
  voyage to about 84,300. This is what part advice now sees (E14).

### 5.4 How it is labelled

- Gil: "about 116,700 gil a voyage at merchant prices (about 5,700 an hour): an estimate from community drop records
  (at least 60.0 million surveys per sector on this route), not a promise." Short form: "est. 5,700 gil/h".
- Rounding: a voyage to the nearest 100, an hour to the nearest 10, quantities to two significant digits, odds to
  whole percent (one decimal below 10%). Record counts in full below a million, otherwise "61.1 million". The count
  shown for a route is its least-recorded sector's.
- A result marked `few` adds "few records for a submarine like this one".
- Once per screen that shows an estimate, in a collapsed "How this is estimated": the formula in plain words, A1, A2,
  A5 and A7, and "What the second item is, is not in the records; the estimate assumes it is drawn like the first."

### 5.5 Living with the own log (S6) and cached market prices

- **Ranking:** the community estimate in merchant gil, for every route (E6, E7).
- **Own log:** when the advised route has 10 or more logged voyages, S6's own sentence and figure are kept, placed
  after the estimate: "Your own log on this route: … over n voyages." Below 10: "n of 10 logged voyages" as today.
  The sentence "until then the stars are only a guide" goes. Earnings keeps ranking logged routes exactly as S6
  does.
- **Market prices cached on the device:** in the send window only, when S6's price lookup has a price for at least
  one item of the route: "At the market prices cached on this device (S6's own price note): about Z a voyage. Not
  used to choose the route." Items without a cached price count at merchant price. Nothing is fetched.

## 6. Behaviour

### 6.1 Gil Farming (fix 3; work item D3)

- **Community route:** one of the ten `commonRoutes`, in its pinned order. **Can run:** every sector found by the free
  company, the submarine's rank at least each sector's, range enough.
- **Stage G** (recs spec 4.3): amount = `DROPS.route(...).gil`, score per hour. Through the stage's `prepare(S)`:
  when a community route is among the routes still in play, only community routes score; otherwise every route
  scores. `RECS.pick` is not changed.
- **Candidates when Gil leads:** the community routes the submarine can run, plus, for each sea where it can run
  none, the existing search scored by estimated gil per hour. The evaluation bound of the recs spec (4.2) holds;
  `DROPS` keeps each sector's result per band, retrieval result and favor state, so a route costs one lookup per
  sector.
- **Plan:** the best community route; with none, the best derived route. **Other routes:** the next community
  routes; when the best derived route beats the plan by more than 5%, it takes the second place.
- **What the player sees.** Every route in the plan and the other routes says which it is:
  - "Community gil route Fight Club - OJ: about 5,700 gil an hour for this submarine …" (5.4), then "The best of the
    k community routes this submarine can run."
  - "No community gil route can be run by this submarine now (rank / sectors not found / range). Found by the app
    from community drop rates: about …" and, above 8 sectors in the sea, "the best found, not proven best".
  - Other route: "Found by the app in <sea>: about X gil an hour by the same estimate, p% more than the community
    route. Community routes come first."
- New result fields on each route: `kind` (`community` or `derived`), `name`, `est` (`gil`, `perHour`, `n`, `few`).

### 6.2 The top rank (fix 1; work item D4)

- The top rank is the last row of `ranks` (145), never a typed number.
- For a submarine at the top rank the Leveling stage is skipped (recs spec 4.3 already says "used when: rank below
  the top"; D4 proves it by test) and the rest of the player's order applies. With the owner's order that is
  Unlocking, then Gil, then Loot: **Gil leads whenever this submarine can reveal nothing now.**
- **The other reading:** Gil moves above Unlocking for every top-rank submarine. The two differ in a real case:
  a free company has found the Northern Empty up to the Vyrstrant Dropoff (H, rank 141) but not K or M, which H
  reveals. With E11 a rank-145 submarine is sent to H ("can reveal 2 new sectors") and farms gil once they are
  found. With the other reading it is sent on the best community gil route, and K and M stay hidden until the player
  sends a submarine of rank 141 or more to H by hand. Owner question Q2.
- **Reason:** as the recs spec 4.5 and 4.7 (a skipped objective ranked above the lead is named): "Leveling
  Submersible Rank is skipped: this submarine is at rank 145, the top rank."
- **Setup panel:** under the Leveling row, when at least one submarine is at the top rank: "Skipped for submarines
  at rank 145, the top rank: <names>. They go to the next priority." When all are: "… : every submarine." The row
  and its buttons stay usable.
- Below the top rank nothing changes.

### 6.3 Loot Farming with rates (work item D5)

- One stage L replaces L1 and L2 (E13). For chosen item i and route r: `E_i(r)` = expected quantity per voyage for
  this submarine (5.1); `best_i` = the highest `E_i / hours` among the routes in play; score =
  `sum over i of (E_i(r) / hours(r)) / best_i`. An item with no reachable drop adds nothing.
- Reason: "Expected: about 0.9 Extravagant Salvaged Earring an hour, 0.6 … (estimate from community drop records, at
  least n surveys per sector)." It replaces "possible items only (community data), drop odds are not known".
- Skipped: "none of your chosen items has a recorded drop this submarine can reach now" (a tier 3 item where the
  submarine's surveillance is below the tier 3 threshold counts as out of reach).
- The picker list is every item of `loot` and of `dropRates`, each once, by name.
- **Stays unknown, and said:** what the second item is (A7); the exact spread of quantities; quality; whether an item
  the community never recorded in a sector can drop there. An item Teamcraft lists as possible but the drop records
  lack counts as 0 and is described as "listed as possible, no drop record yet".

### 6.4 Part advice (work item D6)

- With Gil leading, `gilTip` values each swap it considers today by `DROPS` on the advised route for the changed
  build (time and all five stats). The rule "refuse a swap that lowers surveillance, retrieval or favor" goes.
- A swap is advised only when the estimated gil per hour rises by more than 5% and the route stays within range.
- The tip names what changes at a threshold: "about +N gil an hour on this route (estimate): n minutes faster;
  retrieval becomes optimal at O (160 needed, 148 now)." When no threshold is crossed: "surveillance, retrieval and
  favor stay above every threshold of this route."
- Always with: "Above a threshold, extra surveillance, retrieval or favor is counted as worth nothing: the
  community's reading, not confirmed."
- Other leads keep `partTip` (minutes), as today. If Q1 is answered "no thresholds", D6 is dropped.

### 6.5 Showing drop rates (work item D7; content only, readable at 360 px without sideways scrolling)

Each figure sits on its own short line under the item's name; no wide tables.

1. **Map, the selected sector.** "Community drop records: 61,069,971 surveys." Then "Thresholds (community):
   surveillance 80 for tier 2, 115 for tier 3; retrieval 120 for normal, 160 for optimal quantities; favor 90 for a
   possible second item (it came on 82% of surveys with enough favor)." Then one collapsed block per tier, tier 3
   first: "Tier 3: 16% of surveys by submarines with surveillance 115 or more", and per item, by odds: name; "33% of
   this tier"; "1 / 2 / 4 to 5 by retrieval (poor / normal / optimal)"; "30,000 gil each at a merchant".
2. **Send window.** The estimate line (5.4); per sector one line: "O: tier 3 in reach, retrieval optimal, second
   item possible" or "retrieval normal (160 needed, this submarine has 148)"; a collapsed "What this route usually
   brings": up to 8 items by expected gil, "about 0.9 a voyage" each; the market line of 5.5.
3. **Earnings.** On each logged route's row: "Community average for this route: about X gil a voyage at merchant
   prices (what the community's submarines brought back; at least n surveys per sector)." No build is involved.
4. **Loot pickers.** Under a chosen item, instead of "Possible in n sectors (community data; drop odds are not
   known)": "Recorded in n sectors (community drop records). Most per survey: <sector>, tier T, p% of that tier,
   n surveys." For an item without a record: "Listed as possible in n sectors; no drop record yet, so no rate."

### 6.6 Tuning (work item D8)

- `tracker/tools/recs-tune.js` gains rank 145 in its test fleet and a third scenario, *gil*: everything found, Gil
  first, ranks from 20. Loss and gain are measured on estimated merchant gil per hour and per tank.
- Loot stays out: which items a player picks cannot be derived from data. The tuning file says so.
- **Both defaults are re-derived by the unchanged rules** (recs spec 4.6) on the three scenarios: the fuel allowance
  is the rule's result, and the constant follows it (10% today); the 5% band is re-checked, also with Gil leading.
  A changed allowance is reported to the orchestrator, not hidden.
- A tank's price is still not in the data: fuel stays counted in tanks.

## 7. Compatibility

- `save.js`, `merge.js` and the stored recommendation settings: untouched. Nothing new is stored.
- `tracker/dist/`, `tracker/site/` and `crafting/`: no change. If a build changes them, stop.
- `submarines.json`: only added keys, added entries in `items` and `itemInfo`, and one note sentence (4.2).
- Texts that go, with their tests and checks: "drop odds are not known", "only a guide" and "possible items only"
  occur 17 times (`advisor.js` 4, `subs.js` 2, `check.js` 5, `tracker/tests/submarines.test.js` 5,
  `tools/submarines.py` 1; the last is expected to be the `loot` table's label, which stays). D3 rewrites the star
  sentences, D5 the odds sentences; each rewritten test keeps what it asserts in the new wording.
- Invariant I1 (recs spec 4.7) and its test are replaced by D3's tests. S6 checks C78 to C81 and C83: any that assert
  a route chosen from the log are rewritten to assert the log sentence beside the estimate (E7).
- Older advisor tests (no `input.recs`) do not change.

## 8. Work items

Branch from the branch that carries S6, S4 and the recommendations. Every builder item: note `git rev-parse HEAD` as
START; make the change; run `npm run build`; commit source, tests and the rebuilt `tracker/command-center/site/`.
**Acceptance for every builder item:** `npm run build && npm run test:unit && npm run check` pass;
`git diff --stat START..HEAD -- tracker/src tracker/dist tracker/site crafting` prints nothing;
`git status --porcelain` is empty. Source files are in `tracker/command-center/src/submersibles/` unless a path is
given. Visual styling is out of scope: reuse existing classes.

| Item | Tier | Depends on | Can start now |
| --- | --- | --- | --- |
| D1 Data import and verification | Sonnet builder | none | yes |
| D2 The estimator | Sonnet builder | D1 | after D1 |
| D3 Gil Farming | Sonnet builder | D2 | after D2 |
| D4 The top rank | Sonnet builder | D3 | after D3 |
| D5 Loot Farming with rates | Sonnet builder | D3 | after D3 |
| D6 Part advice | Sonnet builder | D3 | after D3 |
| D7 Showing drop rates | Sonnet builder | D2 | after D5 (same files) |
| D8 Tuning | Sonnet builder | D3, D5 | after them |
| D9 Notes | Haiku clerk | D8 | after D8 |

### D1 Data import and verification (Sonnet builder)

- Files: `tracker/tools/submarines.py`, `tracker/data/submarines.json`, `tracker/data/SOURCES.md`,
  `tracker/tests/submarines.test.js`; any notice file that already credits Submarine Tracker
  (`grep -rn "SubmarineTracker" --include=*.md .`).
- Steps: section 4 in full. Thresholds are parsed as text by a pattern over
  `<id>: CreateBreakpoint(a, b, c, d, e)` and `{ <id>, new Breakpoint(a, b, c, d, e) }`. Python standard library only.
- Unit tests: 143 drop sectors and 143 threshold rows on the game's ids; every pool's three sums agree; sector 15:
  `n` 61,069,971, high-band rolls 30,745,381 / 19,943,663 / 9,385,612, `favor` [60547216, 49900626], tier 3 items
  22504: 1,642,949, 22505: 2,580,137, 22506: 3,053,457, 22507: 2,109,069; `breakpoints[15]` = [80, 115, 120, 160,
  90] and `breakpoints[10]` = [50, 115, 80, 110, 90]; every drop item has a name and a price; `sources.gacha` holds
  the licence, notice and permission; `counts.lootPairs` 1085, `lootSectors` 141, `lootItems` 356 unchanged.
- Extra acceptance: `python3 -I tracker/tools/submarines.py --cache <dir>` run twice writes the same bytes; a
  comparison of `git show START:tracker/data/submarines.json` with the new file shows `loot`, `unlocks`,
  `commonRoutes`, `sectors`, `parts`, `ranks`, `seas`, `subSlots` equal; the size report of 4.4.
- No browser check: the app does not read the new tables yet.
- Escalate if: any check of 4.3 fails on the pinned files (say which, with the numbers); the two threshold tables
  differ; more than 130 KB is added; an existing test asserts the number of `items`; the build changes anything
  outside `tracker/command-center/site/`.

### D2 The estimator (Sonnet builder)

- Files: new `drops.js`; `index.html` (script tag before `advisor.js`); `tracker/command-center/build.js` (file
  list, as `recs.js` is listed); `tracker/tests/submarines.test.js`; this spec (table 5.3 only, if the test
  corrects it).
- Steps: plain script on `globalThis.DROPS`, pure, section 5.1: `FEW = 100`; `merchant(data)` (price function);
  `state(data, sectorId, st)` (band, retrieval result, favor yes or no, or `null` without `st` or thresholds);
  `sector(data, sectorId, st, price)` giving `{ gil, items, n, second, tiers, state, few }`, kept per sector and
  state; `route(data, route, st, price)` giving `{ gil, items, n, few, sectors }`; `fmt` helpers for the rounding of
  5.4. Nothing calls it yet.
- Unit tests: the OJ example of 5.3 within 0.5% for each sector and the voyage (print the exact figures); band edges
  at O (surveillance 114 and 115, 79 and 80; retrieval 159 and 160, 119 and 120; favor 89 and 90); low band gives
  tier 1 items only; favor below the threshold gives no second item; the rank-85 contrast of 5.3; without `st` the
  community average equals the formula of 5.1 computed in the test; a route's gil is the sum of its sectors in any
  order; `n` is the least-recorded sector's; a missing range and a thin band are marked `few`; another price function
  changes gil and nothing else; 100,000 calls of `route` for 5-sector routes finish within the test's normal time.
- No browser check. Escalate if: the example differs by more than 0.5% and the cause is not arithmetic in 5.3; a
  check asserts the site's file list or count.

### D3 Gil Farming (Sonnet builder)

- Files: `advisor.js`, `subs.js` (send window and Board texts only), `tracker/tests/submarines.test.js`, `check.js`.
- Steps: sections 6.1 and 5.5 (first two points), 5.4. First find the Gil stage, the star sentences, the S6 log
  sentence and I1's test.
- Unit tests: rank 145, the build of 5.3, everything found, default order: lead Gil, plan `kind` `community` and
  equal to the best runnable community route by `DROPS` (computed by brute force in the test); a submarine of rank 15
  with A to I found: plan `derived`, the "no community gil route" sentence with its cause; community routes runnable
  in two seas and a third sea found: a derived route appears only among the other routes, only above 5%, never as
  the plan; 10 logged voyages on another route do not change the plan and the log sentence is present; fuel on with
  Gil leading narrows by estimated gil per tank; `ADVISOR.lastEvals` stays within the recs spec's bound; no reason
  contains "only a guide".
- Browser check **C90**: a seeded rank-145 submarine (everything found, no log): the Board button and the send window
  show the same route, "Community gil route", "estimate from community drop records" and a record count. **C91**: a
  seeded rank-15 submarine shows "Found by the app from community drop rates"; with 10 seeded logged voyages the log
  sentence stands beside the estimate.
- Escalate if: an older advisor test (no `input.recs`) must change; the S6 log sentence cannot be reused as it is;
  a check outside C78 to C91 changes its result.

### D4 The top rank (Sonnet builder)

- Files: `advisor.js` (only if a test fails), `subs.js` (the Setup panel line), `tracker/tests/submarines.test.js`,
  `check.js`.
- Steps: section 6.2 (the reading of E11).
- Unit tests: at the top rank with the default order and everything found, the lead is Gil and the reason names the
  skipped Leveling with the rank from the data; with Leveling first, the same; the case of 6.2 (H found, K and M
  not): the lead is Unlocking and the plan surveys H; rank 144 in the same save: Leveling behaves as before.
- Browser check **C92**: one submarine at 145 and one at 60 in a seeded free company: the Setup line names only the
  first; the Leveling row's buttons still work; the first shows a gil route, the second a levelling route.
- Escalate if: Leveling is not already skipped at the top rank; the top rank is a typed number anywhere.

### D5 Loot Farming with rates (Sonnet builder)

- Files: `advisor.js`, `recs.js` (`items` only), `subs.js` (picker text), `tracker/tests/submarines.test.js`,
  `check.js`.
- Steps: sections 6.3 and 6.5 item 4.
- Unit tests: one chosen item: the plan is the route with the highest expected quantity per hour (brute force on a
  pool of at most 8 sectors); two items: the score is the sum of shares; a tier 3 item with surveillance below the
  threshold is out of reach and gives the skip sentence; the list holds every `loot` and `dropRates` item once; no
  reason or picker text contains "drop odds are not known".
- Browser checks: C87 and C88 rewritten to the new wording, same behaviour asserted. New **C93**: Loot Farming first
  and item 22507 chosen: the reason starts "Expected: about" and names the item; the picker shows "Recorded in";
  an item without a record shows "no drop record yet".
- Escalate if: `RECS.pick` must change; stored settings would change shape.

### D6 Part advice (Sonnet builder)

- Files: `advisor.js`, `tracker/tests/submarines.test.js`, `check.js`.
- Steps: section 6.4.
- Unit tests: the rank-85 build of 5.3 on OJ: a swap that lifts retrieval to 160 is advised and names the threshold
  (by hand, the Whale-class hull does: retrieval 173, surveillance 118, range 64 against 59 used); a swap that
  lowers a stat but keeps every threshold is advised when it gains more than 5% and says so; a gain under 5% gives
  no tip; a swap that breaks range is never advised; a non-gil lead never carries a gil tip.
- Browser check **C94**: a seeded submarine with such a swap shows the tip with the threshold sentence and the
  "counted as worth nothing" sentence.
- Escalate if: the swaps `gilTip` considers today cannot be listed without the player's inventory.

### D7 Showing drop rates (Sonnet builder)

- Files: `chart.js` or `subs.js` (wherever the Map shows the selected sector), `subs.js` (send window), `earn.js` or
  `subs.js` (Earnings rows), `subs.css` (layout needs only), `check.js`.
- Steps: section 6.5 items 1 to 3, 5.4 (the collapsed explanation) and 5.5 (the market line).
- Browser check **C95**: at 360 px wide, selecting O on the Map shows "61,069,971 surveys", the thresholds line and
  three tier blocks; the page does not scroll sideways (`scrollWidth <= innerWidth`). **C96**: the send window for OJ
  shows the estimate, one line per sector and the collapsed item list; an Earnings row of a logged route shows
  "Community average for this route".
- Escalate if: the Map has no selected sector; S6 has no per-item price lookup (then leave the market line out and
  say so).

### D8 Tuning (Sonnet builder)

- Files: `tracker/tools/recs-tune.js`, `recs.js` (the constant only), `docs/submersibles-recommendations-tuning.md`
  (written by the tool), `tracker/tests/submarines.test.js`.
- Steps: section 6.6; `node tracker/tools/recs-tune.js --write`.
- Unit test: `RECS.GIVE_UP` equals the rule's result on the three scenarios; the 5% band meets its acceptance.
- Escalate if: the rule returns 50 or fails at its first step; the band fails; the allowance is no longer 10 (report
  old and new); the test adds more than about 20 seconds.

### D9 Notes (Haiku clerk)

- Files: `tracker/command-center/README.md` only.
- Steps: a short section (what the estimate is, `drops.js`, checks C90 to C96, the data tables), the file table, the
  site's file count from the build's printed line.
- Acceptance: `npm run build` leaves `git status --porcelain` empty apart from the README.
- Escalate if: anything else would change. (`docs/STATE.md` is updated by the orchestrator when the owner ships.)

## 9. Risks, and the first thing to verify

1. **First:** D1's tool run on the pinned files. The pool sums were checked by hand in 6 of 429 pools, and the two
   threshold tables were compared in local copies whose commit was not confirmed.
2. The second item (A7) carries 45% of the O and J figures and is not in the records.
3. The thresholds are a community reading; the drop file's own lowest-stat fields disagree in places (unreliable,
   but not explained).
4. The code this spec changes was not read (see the top). Function names may differ.
5. Community-first can leave a richer derived route in second place; the player sees both figures.
6. The built site grows by about 95 KB before compression (estimate).
7. S6's Board advice changes for a player who already has 10 logged voyages on a route (Q3).
8. The pin is a snapshot of 2026-11-17; the source keeps growing. Updating is a new pin and a new run of D1.
9. Table 5.3 is hand arithmetic until D2's test confirms it.

## 10. Owner questions

No item is blocked from being built. All three must be answered before this ships.

**Q1. May the app use the community's thresholds (the surveillance, retrieval and favor each sector needs)?**
An earlier decision was to use none until a licensed source was pinned. They are now published in a project under the
MIT licence; a sister project by the same author says they were calculated from a community spreadsheet whose own
licence is not stated.
- *Keep things as they are (no thresholds):* estimates use the community's average submarine and do not react to a
  submarine's surveillance, retrieval or favor; only its speed counts. Part advice stays as today. Cost: D6 is
  dropped, D1 leaves one table out. Risk left: a weak submarine is promised a strong one's loot.
- *Use them, credited, with the spreadsheet note written into the sources file:* estimates are for each submarine.
  No extra cost. Risk left: if the spreadsheet's authors objected, the table would be removed and the app would fall
  back to the first option.
- How sure: high that the file is published under MIT; medium that nobody else has a say.
- **Recommendation: use them.** Affects D1, D2, D6.

**Q2. A submarine at rank 145 that could still reveal new sectors: explore first, or farm gil?**
- *Keep things as they are:* by the recommendations spec Leveling is already skipped at the top rank, so this is the
  same as the next option.
- *Explore first, then gil (your order with Leveling removed):* in the Northern Empty case of 6.2 it is sent to H
  until K and M are found. No extra cost. Risk left: some gil is given up while anything is left to reveal.
- *Gil first for every rank-145 submarine:* it always runs the best community gil route. Cost: a small change in D4.
  Risk left: new sectors stay hidden unless you send a submarine there yourself.
- How sure: high on what each does.
- **Recommendation: explore first.** Affects D4.

**Q3. When your own log and the community estimate disagree, which chooses the gil route?**
- *Keep things as they are (the log chooses as soon as one runnable route has 10 logged voyages):* a levelling route
  you ran ten times would be advised over OJ, against fix 3. No cost. Risk left: exactly that.
- *The community estimate chooses; your log is shown beside it:* every route is compared the same way, on every
  device. Cost: the log no longer steers the Board (Earnings is unchanged). Risk left: if the estimate is wrong for
  your submarines, the Board does not learn from your log.
- *Your log replaces the estimate for a route once it has 10 voyages:* your own results count. Cost: a little more
  work in D3. Risk left: ten voyages swing by about a quarter either way, so the advice can flip between two close
  routes.
- How sure: high on what each does; the size of the swing is a calculation from the O and J records.
- **Recommendation: the community estimate chooses.** Affects D3.
