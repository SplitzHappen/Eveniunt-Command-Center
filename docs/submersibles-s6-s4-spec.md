# Submersibles steps S6 (gil advice) and S4 (sea map): spec

Written 2026-11-17 from reading the repository only. Nothing was built or run for this spec; every statement below
comes from the files named. Build order: S6 first, then S4. One pull request per step; each ships only on the owner's
`ship`.

## 1. Goal and constraints

- **S6:** at the gil step, suggest routes and parts from the player's own voyage log (gil per hour), once there is
  enough data.
- **S4:** replace the Map tab's placeholder with the seven seas and a route planner.
- The app stays offline-first, public, hosted on GitHub Pages. It never reads or automates the game. No game number is
  typed by hand or guessed: game data comes only from `tracker/data/submarines.json` (built by
  `tracker/tools/submarines.py` from pinned sources).
- **No new save fields in either step.** `tracker/src/core/save.js` is not touched, so the Tracker and the Atelier need
  no rebuild. If an item seems to need a save field, stop and escalate.
- Nothing is deleted or rewritten in the save by these steps. The Map tab writes nothing at all.

## 2. What was found

### 2.1 The design document is missing

Source comments cite a "Submersibles design" (sections 3.2, 3.3, 3.5, 3.6, 5.1, 5.4, 5.6, 7.1, 7.3, questions Q1, Q3,
Q4). `tracker/command-center/README.md` names it as `.ai/planning/SUBMERSIBLES_DESIGN.md`. There is no `.ai/` folder
and no design file anywhere in this repository. So what the design says about S6 and S4 is **not known**. This spec
takes the scope of S6 from `docs/STATE.md` and the scope of S4 from the placeholder text ("The seven sea maps and the
route planner"). See owner question Q5.

### 2.2 What already exists (both steps build on it)

| Thing | Where | Notes |
| --- | --- | --- |
| Voyage log | `S.trips[tripId]` in `subs.js`; shape checked by `checkSubmersibles` in `tracker/src/core/save.js` | `{ s (sub id), t (sent), r (route, 1 to 5 sector ids in order), back, calc, said, items [[itemId, qty]], newSectors, rankAfter, rankCalc, grade, expBase, expGot }`. Written by `logTrip()`; id from `FLEET.tripId`. |
| Earnings | `earn.js`: `EARN.unitValue`, `tripValue`, `totals(sec, prices, now)` | `totals().byRoute[<ids joined by comma>] = { route, gil, hours, trips, perHour }`. Counts only trips with items logged, a route, and `back > t`. Hours are voyage hours (sent to back), not waiting time. Same sectors in another order are another route. |
| Prices | `earn.js`: `EARN.cached(scope)`, `EARN.fetchPrices`; `PRICES` and `loadPrices()` in `subs.js` | Merchant price from game data; market price from Universalis after 5% tax, cached on the device for an hour, never in the save. Fetched only from the Log and Earnings tabs. |
| "Enough data" today | `earnHtml()` in `subs.js` | A route with fewer than 10 logged trips gets the tag "not enough data". Check C29 relies on 10. |
| Sectors discovered | `fc.discovered` (per free company) | Edited in Setup's tick list and by the "Did the report say…" ticks on return (`applyFinds`). |
| Route and time | `advisor.js`: `ADVISOR.stats(rank, parts)`, `ADVISOR.evalRoute(route, stats)` | Gives `{ range, maxRange, reachable, seconds, tanks, exp }` by the community formula ("calculated, not yet confirmed"). |
| Advice | `advisor.js`: `ADVISOR.advise(input)`; `adviceFor`, `planAll`, `stageOf` in `subs.js` | Step 3 ("Farm gil") picks a reachable community route (`commonRoutes`), else the route with the most sector stars per hour. Its reason still says "once logging arrives". |
| Part advice | `advisor.js`: `partTip(sub, st, route)` | Step 3 only: the single part swap, allowed by the rank, that brings the suggested route back at least 60 seconds sooner. It looks at time only. `stageOf` treats "no part tip on any sub" as part of the fleet's final stage (notification grouping). |
| Route picker | `pickerHtml()`, `PICK`, `sendSheet()` in `subs.js` | A list of sector buttons per sea; `data-use` loads a whole route. |
| Parts | `submarines.json` `parts` (40), `classes` (10), `ranks` (145) | Each part: slot, class, rank, surveillance, retrieval, speed, range, favor, components, repairMaterials. |

### 2.3 Game data for the map: present and missing

Present in `tracker/data/submarines.json` (sources in `tracker/data/SOURCES.md`):

- `seas` (7): id, name, the game's image id (63191 to 63197), starting point `x, y, z`, sector count (30, 20, 20, 20,
  20, 20, 13).
- `sectors` (143): id, sea, letter, name, rank needed, tanks, survey minutes, base experience, survey distance, stars,
  position `x, y, z`.
- `unlocks` (all 143; community data, one source): `by` (the sector whose survey can reveal this one), `start`,
  `extraSub`, `opensSea`, `mainPath`. `subSlots`: slots 2 to 4 from sectors 10, 15, 20.
- `formula`: distances and durations are worked out from the positions; no separate distance table is needed.
- `commonRoutes` (10 named community routes): 6 in the Deep-sea Site, 4 in the Sea of Ash, none in the other five seas.
- `loot`: possible items for 141 of 143 sectors (none for 148 and 149).

Missing:

1. **The seven map pictures.** Only the image ids are present; no picture file is in the repository
   (`tracker/VALIDATION.md` says in-game icons are not in the reachable data).
2. **What `x` and `y` mean on a picture:** the unit, the picture size, and whether `y` grows downward. Nothing in the
   repository says. In the rows read, values lie between about 49 and 940.
3. **The design's own description of S4** (section 2.1).

None of these is invented here. The proposal is a first slice that needs none of them: a chart drawn by the app from
the position numbers (owner question Q2), with `y` drawn downward as an assumption the owner checks against the game
(section 6).

## 3. Decisions

| # | Decision | Rejected |
| --- | --- | --- |
| D1 | "Enough data" stays 10 logged voyages on exactly that route (same sectors, same order), as shipped in S5; one constant `EARN.ENOUGH`. | Pooling routes by sector set regardless of order: changes the meaning of the shipped table. A lower number: less trustworthy, and C29 relies on 10. |
| D2 | Advice for a sub uses the log's average gil per voyage on a route, divided by **that sub's** worked-out hours on it. | The log's gil divided by the log's hours: mixes other subs' speeds, and cannot price a part change. |
| D3 | The Earnings table keeps its figure (logged gil divided by logged hours) and says so; the advice says which figure it uses. | One shared figure: either the table stops being "what you got" or the advice ignores the sub's build. |
| D4 | Advice uses prices already cached on this device, whatever their age, and names their date; with none cached, merchant prices only, and says so. The Board fetches nothing. | Fetching from the Board: new network calls on the main screen, and existing checks assume none. |
| D5 | The log is pooled over every free company and build in the save. | Per free company: 10 voyages take far longer to reach; the same route drops the same items. |
| D6 | Without enough data, the present suggestion stays (community route, else stars), with a reason that counts towards 10. | Hiding the suggestion until there is data: the one-press send would stop working. |
| D7 | No new save field. The map's view state (free company, sea, sub, route) lives in the tab's `sessionStorage` key `eveniunt-subs-ui`, as the tab choice does. | Saving the planned route: a save change for no lasting value. |
| D8 | The map is an SVG drawn from `x` and `y`; `z` is not drawn (distances still use it). New pure file `chart.js`, tested in Node. | Pictures: missing (Q2). Canvas: not testable in Node, poorer for screen readers. More code in `subs.js` (1,018 lines). |
| D9 | The planner never sends. Its button opens the existing send window with the route loaded. | A second send path: two places to keep right. |
| D10 | New unit tests go into files already run by `npm run test:unit` (`earn.test.js`, `core.test.js`, `submarines.test.js`). | New test files: would need `package.json` changed. |

## 4. Step S6: gil advice from the player's own log

### 4.1 Player-visible behaviour

- **Earnings tab.** "Gil per hour by route" becomes two lists. *Ranked:* routes with 10 or more logged voyages, best
  first, each with a position number, gil per hour, gil per voyage and the voyage count. *Not enough data yet:* the
  other logged routes, without a position, each marked "n of 10 voyages". A line under the heading says: logged gil
  divided by logged hours at sea, at the prices shown above.
- **Suggestion at the gil step** (Board button, send window, Send all). If at least one ranked route can be run by
  this sub, the suggestion is the one that gives this sub the most gil per hour, and the reason reads like: "From your
  own log: about 412,000 gil a voyage over 14 logged voyages; this sub is back in 19.4 hours, so about 21,200 gil per
  hour. Market prices seen Tue 14:05 on this device." Up to two other routes follow. If none qualifies, today's
  suggestion stays, and its reason ends: "Your own gil per hour takes over once a route has 10 logged voyages (this one
  has n); until then the stars are only a guide."
- **Part advice at the gil step** (after owner question Q1). Today's tip speaks of minutes saved on the suggested
  route. With ranked routes it speaks of gil: the one part swap, allowed by the rank, that raises this sub's best gil
  per hour over its ranked routes, including a route the sub cannot reach now.

### 4.2 Exact rules

- A trip counts when it has items logged, a route, and `back > t` (as `EARN.totals` today).
- `perTrip = gil / trips`; `enough = trips >= EARN.ENOUGH` (10). Items without any price add nothing (as today); the
  existing "No price yet for…" line stays.
- **Earnings ranking:** by `perHour`, highest first. Routes whose `perHour` rounds to the same whole gil share a
  position (1, 1, 3); inside a tie, more voyages first, then the route text. Thin routes: by voyage count, highest
  first, then `perHour`.
- **Advice candidates** for a sub: logged routes with `enough`, `perTrip > 0`, every sector in `fc.discovered`, every
  sector's rank at most the sub's rank, and `evalRoute(...).reachable` with the sub's stats.
  `gph = perTrip / (ev.seconds / 3600)`.
- **Order:** `gph` highest first; equal `gph`: fewer seconds first; still equal: the route's id text, ascending.
  The first is the plan. "Other routes": the next candidates, up to two; if fewer than two, filled from today's list
  (community routes, else stars) without repeats, each marked "not enough of your own data (n of 10 voyages)".
- **Part advice (item S6-3):** `best(parts)` is the highest `gph` over the candidates recomputed with those parts. For
  each slot and each other part of that slot whose class the rank allows: `gain = best(swap) - best(current)`. Take the
  largest gain; ties go to the lower slot, then the lower part id. Suggest it only when the gain is at least 1% of
  `best(current)`. Which swaps are allowed, and the wording about surveillance, retrieval and favor, follow Q1. With no
  candidates, today's `partTip` is used unchanged. `advise().parts` stays `null` when there is no tip (`stageOf`
  depends on it).

### 4.3 Empty and edge states

- No trips, or none with items: Earnings as today; advice as today with "(this one has 0)" left out.
- Ranked routes exist but none can be run by this sub (not discovered, rank, range): today's suggestion, same reason.
- No cached prices: values use merchant prices; the reason says "Merchant prices only; open Earnings to load market
  prices."
- Sub without rank or parts: `advise` returns `blocked`, as today.
- A removed sub's trips still count (they are in the log).
- Two devices can show different suggestions, because prices are per device; the reason names the price date.

## 5. Step S4: the sea map

### 5.1 Player-visible behaviour

- **Map tab** (replaces the placeholder): a free-company selector, seven sea buttons (each with "found n of m"), and
  the chart of the chosen sea: the starting point marked "Start", every sector as a dot with its letter at its `x, y`,
  thin lines from each sector to the sectors its survey can reveal. Caption: "Drawn by this app from the game's
  position numbers; this is not the game's map picture. Depth is not drawn. Which sector reveals which is community
  data."
- **Sector states**, shown by shape and label as well as colour: *found* (in `fc.discovered`); *can be revealed next*
  (not found, and the sector that reveals it is found); *further away* (neither). Sectors that grant a submarine slot
  carry "slot n"; sectors that open the next sea carry "opens <sea>".
- **Tapping a sector** shows: name, rank needed, tanks, survey minutes, base experience ("at least"), stars, revealed
  by, reveals, and the possible items by name ("no loot list for this sector yet" when none).
- **Route planner** (item S4-2): "Plan for" lists the free company's submarines. With one chosen, tapping found
  sectors builds a route of up to five (tap again to drop one), drawn as a numbered line from Start. Below: back time,
  range used of range, tanks, experience, with the same wording and the same "calculated…" label as the send window;
  "Out of range" as there. The sea's community routes appear as buttons that load a route when every sector is found
  and the rank allows. "Send <sub> on this route…" opens the existing send window with the route loaded; nothing is
  sent or saved by the Map tab.
- **Setup** sector step: the sentence "The sea map comes in step S4." becomes "The Map tab shows them on a chart."

### 5.2 Data read, and rules

- Reads `SUB_DATA` (`seas`, `sectors`, `unlocks`, `subSlots`, `commonRoutes`, `loot`, `items`), `S.fcs`, `S.subs`.
  Writes nothing to the save.
- Drawing box per sea: smallest and largest `x` and `y` over the sea's sectors and its starting point, padded by 8%
  (at least 30 units), same scale on both axes, `y` downward (`CHART.Y_DOWN = true`, one line to flip).
- A reveal line is drawn when both sectors are in the same sea. A first sector revealed from the previous sea says so
  in its details instead.
- Planner taps follow the picker's rules: only found sectors, rank at most the sub's, at most five, one sea. Changing
  sea clears the route; changing free company clears the sub and the route.

### 5.3 Empty and edge states

- No free company: the Board's welcome text and "Start the setup" button.
- Free company with nothing ticked: every sector shows as not found; a note points to Setup.
- A sea with nothing found is still shown, marked "not opened yet".
- Sub without rank or parts: the route can be tapped; instead of figures, the picker's "Enter this sub's rank and four
  parts in Setup…" message. Sub that is Out: the send button is disabled and says when it is back.
- Narrow phone: the chart scales to the width; the page does not scroll sideways.

## 6. Risks, and the first thing to verify

1. **First, before any change:** run `npm run test:unit` on a fresh branch for a green baseline (the advisor test in
   `tracker/tests/core.test.js` and `earn.test.js` are what S6 changes).
2. **Map orientation and proportions are unverified.** After S4-1 the owner compares the Deep-sea Site chart with the
   game's map (by the data, A and B lie up and to the right of Start if `y` grows downward). If it is upside down,
   flip `CHART.Y_DOWN`.
3. **Gil advice rests on thin ground:** the log mixes builds, and the app does not model how surveillance, retrieval
   and favor change what comes back (`SOURCES.md`, "Experience"). The wording must say what the figure is.
4. **`stageOf`** uses "no part tip" for the fleet's final stage; S6-3 can move a free company between "gil" and
   "final" and so change notification grouping. S6-3 tests it.
5. **Stale advice:** `adviceFor` caches by a key; the key must include the log's figures, or the 10th voyage will not
   change the button until reload.
6. **Check C29** asserts the Earnings route text (`/10/` and no "not enough data"); S6-1 must keep it passing.
7. **Found while reading, not run:** in the send window of a returned sub, "Send on this route" (`data-act="quick"`)
   calls `quickSend(id, rankFix)`, which calls `logTrip(id, rankFix)` with no loot; "Send again" passes
   `readLoot(form)`. So quantities and "discovered" ticks entered before pressing "Send on this route" appear to be
   dropped. S6 depends on logged loot. See Q4 and item S6-0.

## 7. Work items

Every item: work on the step's branch; finish with `npm run build`, then commit the rebuilt files. Only files under
`tracker/command-center/site/` may change in the build; if `tracker/dist/`, `tracker/site/` or `crafting/atelier/`
change, stop and escalate. Acceptance for every builder item: `npm run build && npm run test:unit && npm run check`
all pass, and `git status --porcelain` is empty after the commit.

| Item | Tier | Depends on | Can start now |
| --- | --- | --- | --- |
| S6-1 Earnings ranking | Sonnet builder | none | yes |
| S6-2 Advice from the log | Sonnet builder | S6-1 | after S6-1 |
| S6-3 Part advice in gil | Sonnet builder | S6-2, owner answer Q1 | no |
| S6-0 Loot kept on "Send on this route" | Sonnet builder | owner answer Q4 | no |
| S6-4 Notes | Haiku clerk | S6 items done | after them |
| S4-1 Chart, read-only map | Sonnet builder | none (independent of S6) | yes |
| S4-2 Route planner | Sonnet builder | S4-1 | after S4-1 |
| S4-3 Notes | Haiku clerk | S4 items done | after them |

### S6-1 Earnings ranking (Sonnet builder)

- Files: `tracker/command-center/src/submersibles/earn.js`, `subs.js` (`earnHtml`), `subs.css`,
  `tracker/tests/earn.test.js`, `tracker/command-center/check.js`.
- Steps: add `EARN.ENOUGH = 10`; give each `byRoute` entry `perTrip` and `enough`; add
  `EARN.ranked(byRoute)` returning `{ ranked: [entry + pos], thin: [entry] }` by the rules in 4.2; render the two
  lists and the explaining line of 4.1; replace the literal `10` in `earnHtml`.
- Unit tests: positions with a tie (1, 1, 3) and its inner order; a route with 9 trips is thin and with 10 is ranked;
  an unlogged trip adds nothing; `perTrip`.
- Browser check **C78**: a seeded save (two routes with 10 logged voyages and equal gil per hour, one with 3, one trip
  with nothing logged; Universalis answered by a stand-in as in C29) shows two ranked rows sharing position 1, the
  thin route marked "3 of 10 voyages" without a position, and the explaining line.
- Escalate if: C29 can only pass by changing what it asserts.

### S6-2 Advice from the log (Sonnet builder)

- Files: `advisor.js` (`advise`, step 3), `subs.js` (`adviceFor`, `planAll`, `stageOf`, start-up),
  `tracker/tests/core.test.js`, `check.js`.
- Steps: `advise` accepts optional `input.logged` (`[{ route, trips, perTrip, enough }]`), `input.enough`,
  `input.priceNote`, and applies 4.2 and 4.3; the result says whether the plan is from the log (`own`). In `subs.js`
  one helper builds the list from `EARN.totals(S, prices, now).byRoute` with the device's cached prices
  (`EARN.cached(priceScope())`, no fetch), a short signature of it, and the price note; `render()`, `sendSheet()`,
  `sendAllSheet()` and the two places that log a trip before asking for advice (`quickSend`, `dosendall`) refresh it;
  the `adviceFor` cache key includes the signature. Replace the "once logging arrives" sentence.
- Unit tests: without `logged`, results equal today's (the existing advisor test unchanged); a ranked, reachable route
  becomes the plan with "From your own log"; the order rules including both tie-breaks; a ranked route that is
  undiscovered, above the rank or out of range is ignored; 9 voyages do not count and the reason says "(this one has
  9)"; fill-up of "Other routes"; `perTrip` of 0 ignored.
- Browser check **C79**: a free company at the gil step (four slots, every sector found, rank 145) with 9 logged
  voyages on a route other than the community one shows the community route; after the 10th is logged through the
  page, another sub's Board button and send window show the logged route and "From your own log", without a reload;
  the stored section holds no new field.
- Escalate if: any existing check's suggested route changes; or the helper needs a save field.

### S6-3 Part advice in gil (Sonnet builder; blocked by Q1)

- Files: `advisor.js` (`partTip` and a sibling), `tracker/tests/core.test.js`, `check.js`.
- Steps: implement 4.2 "Part advice" with the variant the owner chose; keep `{ slot, from, to, why }` and add the gil
  gain; `null` when no tip.
- Unit tests: a swap that makes a better ranked route reachable is preferred to one that only saves minutes; below 1%
  no tip; tie-breaks; the chosen variant's filter or wording; with no candidates the result equals today's `partTip`.
- Browser check **C80**: with C79's log, a weak build shows a part note with "more gil per hour" and
  `window.__subs.stageOf(fc)` is `gil`; a build with no better part shows none.
- Escalate if: the existing assertions on `a6.parts` or `a7.parts` fail.

### S6-0 Loot kept on "Send on this route" (Sonnet builder; blocked by Q4)

- Files: `subs.js` (`quickSend`, the `quick` case), `check.js`.
- Steps: first write check **C81** (returned sub; enter a quantity and tick a discovery; press "Send on this route";
  the trip must hold the items and the free company the sector). If C81 passes on unchanged code, stop and report that
  the fault does not exist. Otherwise pass `readLoot(form)` through to `logTrip` for the send-window button only (the
  Board's one-press button has no form and stays as it is).
- Escalate if: the fix needs more than `quickSend` and its caller.

### S6-4 and S4-3 Notes (Haiku clerk)

- Files: `tracker/command-center/README.md` only.
- Steps: add a short section for the step, in the style of the S5 section (what it does, files, check numbers); for
  S4 add `chart.js` to the file table and correct the site's file count from the build's printed line.
- Acceptance: `npm run build` leaves `git status --porcelain` empty apart from the README.
- Escalate if: anything other than the README would change. (`docs/STATE.md` is updated by the orchestrator when the
  owner ships.)

### S4-1 Chart and read-only map (Sonnet builder)

- Files: new `tracker/command-center/src/submersibles/chart.js`; `index.html` (script tag before `subs.js`);
  `tracker/command-center/build.js` (add `chart.js` to the list on the line that copies the submersibles files);
  `subs.js` (`TABS`, `render`, new `mapHtml`, click handling, the Setup sentence); `subs.css`;
  `tracker/tests/submarines.test.js`; `check.js`.
- Steps: `chart.js` is a plain script on `globalThis.CHART` (as `earn.js`): `CHART.init(data)`;
  `CHART.view(seaId, discovered, rank)` returning the box, Start, nodes (id, letter, name, x, y, rank, state, slot,
  opens) and reveal lines by 5.2; `CHART.svg(view, route)` returning the SVG text, every sector an element with
  `data-sector`, a readable label, and keyboard focus. `mapHtml` renders 5.1 without the planner. Names are escaped.
- Unit tests: for each of the seven seas, as many nodes as `sea.sectors`, all inside the box, one reveal line per
  sector whose revealing sector is in the same sea; states for a given discovered list; slot and sea-opening labels on
  sectors 10, 15, 20 and the six `opensSea` sectors; the SVG holds each sector once and escapes "Offender's Rot".
- Browser check **C82**: the Map tab no longer shows "arrive in step S4"; seven sea buttons; the Deep-sea Site shows 30
  sectors and Start; found counts match the seeded free company and change with the selector; tapping J shows its
  details with "slot 2"; at a phone width the page does not scroll sideways; the Setup sentence is the new one; the
  stored section is unchanged.
- Escalate if: a check or test asserts the site's file list or count; or the chart needs data not in
  `submarines.json`.

### S4-2 Route planner (Sonnet builder)

- Files: `subs.js` (`mapHtml`, click handling, a small opener that calls `sendSheet` then loads `PICK.route`),
  `chart.js` (route line and numbers), `subs.css`, `tracker/tests/submarines.test.js`, `check.js`.
- Steps: implement 5.1 "Route planner", 5.2 and 5.3; reuse `figures()`, `confirmation()`, `ADVISOR.evalRoute`; keep
  the view state in `UI` through `keepUi()`.
- Unit tests: the SVG draws the route in order from Start with numbers 1 to n; an empty route draws no line.
- Browser check **C83**: choose a sub, tap two found sectors: the figures equal `ADVISOR.evalRoute` for that sub; a
  sixth sector cannot be added; a sector above the sub's rank cannot be tapped; a community route button loads its
  route; "Send … on this route…" opens the send window with that route selected; pressing Cancel leaves the stored
  section byte-for-byte as before; a sub that is Out has the button disabled.
- Escalate if: the planner would need to write the save, or to change `sendSheet`'s behaviour for existing callers.

## 8. Owner questions

Items S6-1, S6-2, S4-1 and S4-2 can proceed without any answer.

**Q1. Which part swaps may the gil advice suggest? (Blocks S6-3 only.)**
The app knows how a part changes voyage time and range. It does not know how surveillance, retrieval and favor change
what comes back.
- *Keep things as they are:* the tip stays "back N minutes sooner". No cost. S6's part advice is not delivered; today's
  tip can already name a part with lower retrieval.
- *A. Gil figure, only for swaps that lower none of surveillance, retrieval and favor:* one builder item. Fewer tips;
  the figure still assumes the same items come back.
- *B. Gil figure for any swap, listing how the three stats change and saying their effect is unknown:* one builder
  item. The app may recommend a part that in fact brings back less.
- How sure: high that A is the safest claim; medium on how often A yields a tip (not measured).
- Recommendation: A.

**Q2. The map: drawn chart or the game's pictures? (Blocks nothing; S4-1 builds the drawn chart.)**
- *Keep things as they are:* the Map tab keeps its placeholder; S4 is not built.
- *Drawn chart from the position numbers already in the repository:* two builder items; no new data. Risk: it may not
  look like the game's map (orientation is checked by the owner, section 6).
- *The game's seven map pictures behind the dots:* needs a source for the files (none in the repository), a decision
  to publish game artwork in a public repository, more to download for offline use, and the picture scale, which is
  unknown. Can be added later on top of the chart.
- How sure: high that the chart can be built from what is present; unknown for the pictures.
- Recommendation: the drawn chart now.

**Q3. Should discoveries be ticked on the map? (Blocks nothing.)**
- *Keep things as they are:* discoveries are edited in Setup and on return; the map only shows them (what S4-1
  builds). No cost.
- *Also on the map:* one more builder item that writes `fc.discovered`; an untick removes a discovery only by the
  player's own tap. Risk: accidental taps on a small screen.
- How sure: high. Recommendation: keep for this slice; decide after using the map.

**Q4. Fix the loot that "Send on this route" appears to drop? (Blocks S6-0 only.)**
- *Keep things as they are:* no cost; quantities typed before that button may be lost, which starves the gil advice.
- *Fix with S6:* one small builder item, which first proves the fault with a check.
- *Fix later, separately:* same cost, later; S6 ships on a log that can silently miss returns.
- How sure: medium (read in the code, not run). Recommendation: fix with S6.

**Q5. The missing design document. (Blocks nothing.)**
- *Keep things as they are:* this spec is the reference for S6 and S4; source comments keep citing sections nobody
  can read here.
- *Add it to `docs/`:* the owner first checks it for anything private, since the repository is public.
- *Give only the S4 and S6 sections to the session:* nothing published; this spec is then checked against them.
- How sure: medium that the design asks for more in S4 than the placeholder says. Recommendation: add it to `docs/`
  after the privacy check.
