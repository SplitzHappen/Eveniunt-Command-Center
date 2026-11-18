# Submersibles "Customizable Recommendations": spec

Written 2026-11-17 from reading the repository only (branch with steps S6 and S4 built). Nothing was built or run for
this spec. The worked example in 4.8 was computed by hand from `tracker/data/submarines.json`; the default numbers in
4.6 are reasoned starting values that item R4 confirms or replaces by a stated rule before anything ships.

## 1. Goal and constraints

- A sub-category "Customizable Recommendations" in the Submersibles Setup tab, with two settings that drive the route
  suggested for each submarine: a **fuel efficiency** switch (off by default) with one tunable number, and a
  **priority ranking** of four objectives (default: Unlocking Routes, Leveling Submersible Rank, Gil Farming, Loot
  Farming), where Loot Farming has five item pickers.
- The model is deterministic: the same save, prices and settings always give the same route.
- Offline-first, public, hosted on GitHub Pages. The app never reads or automates the game. No game number is typed
  or guessed: every figure comes from `tracker/data/submarines.json`, the player's own log, or prices already cached
  on the device. The Board fetches nothing (S6 decision D4 stands).
- `tracker/src/core/save.js` is **not changed** (section 6). The Tracker and the Atelier need no rebuild. If an item
  seems to need a `save.js` change, stop and escalate.
- This builds on step S6 (advice from the log, part advice in gil), which is built but not shipped. It cannot ship
  before S6 (owner question Q2).

## 2. What exists, and what is missing

### 2.1 Built on (all read in the source)

| Thing | Where | Used for |
| --- | --- | --- |
| Build stats, route figures | `advisor.js`: `ADVISOR.stats(rank, parts)`, `evalRoute(route, st)` gives `{ range, maxRange, reachable, seconds, tanks, exp }` | Hours, tanks and base experience of every candidate |
| Bounded route search | `advisor.js`: private `search(pool, st, score, must, keep)`, a beam of 80 routes per length per sea; keeps one order per set of sectors | Candidates (4.2) |
| Unlock relations | `submarines.json` `unlocks` (`by`), `subSlots`; `advisor.js` `children`, `chainTo`, `newOf` (inside `advise`) | Unlocking stages |
| Today's advice | `ADVISOR.advise(input)`: fixed order (slots, sectors, gil); result `{ step, stepName, goal, plan, alts, parts, note, own }` | Unchanged when `input.recs` is absent |
| Advice from the log (S6) | `advise` step 3 with `input.logged`, `input.enough`, `input.priceNote`; `EARN.totals().byRoute`, `EARN.ENOUGH` (10), `EARN.ranked` | Gil stage, verbatim |
| Part advice | `advisor.js`: `partTip` (minutes), `gilTip` (gil, S6-3) | Kept, rules in 4.7 |
| One entry for every screen | `subs.js`: `adviceFor(subId)` (cached by a key), used by the Board button, `adviceHtml` (send window), `planAll` (Send all), `stageOf` (notification grouping) | The only place the settings are passed in |
| Possible loot | `submarines.json` `loot` (sector id to item ids), `items` (names); `EARN.routeLoot`, `EARN.name` | Loot stages and the pickers |
| Setup tab | `subs.js`: `setupHtml()` (panels), `safeNotify()`, `onClick`, `onInput` | The new panel |
| Settings in the save today | `modules.submersibles.settings.prefs`: `sort`, `grouping`, `night`, `quietHours`, `window`, `priceWorld`; `checkSubmersibles` in `save.js` keeps only these six | Why a new field there needs a `save.js` change (6) |

### 2.2 Missing or weak data (handled, never invented)

1. **No drop odds.** `loot` is labelled "possible items only: no quantities, odds or quality". Loot is scored by
   where a chosen item *can* drop, and the wording says so.
2. **Surveillance, retrieval and favor** are not modelled for loot or experience (`formula.experienceNote`). Base
   experience is a floor ("at least").
3. **Gil** exists only for routes with 10 or more logged voyages, at the prices cached on the device. Logged items
   are stored per voyage, not per sector, so gil cannot be worked out for a route that was never run. Without own
   figures the sector stars stay "only a guide", as today.
4. **Reveals are community data** and not certain on every visit.
5. **The gil price of a ceruleum tank** is not in the data: fuel is counted in tanks, never in gil.
6. Sectors 148 and 149 have no loot list; community routes exist for two of the seven seas only.

## 3. Decisions

| # | Decision | Rejected |
| --- | --- | --- |
| D1 | The ranking decides in order with a 5% tolerance band: a lower priority chooses only among routes within 5% of the best for every priority above it. | Weights per rank: experience, gil and counts have no common unit, so any weight is arbitrary and the result cannot be explained in one sentence. Strict order without a band: per-hour figures almost never tie, so priorities 2 to 4 would never matter. |
| D2 | Fuel efficiency is an allowance: routes within X% of the best for the top priority are compared by what they bring per tank. X is the player's number. | Scoring everything per tank: no threshold to tune, and the priorities stop meaning anything. Fewest tanks: always a one-sector route. |
| D3 | Everything is measured per hour at sea (reveals, experience, gil, loot chances); only "how many chosen items a route covers" is per voyage. | Per voyage: the fixed 12 hours make short routes look as good as long ones. |
| D4 | Candidates: every order of 1 to 5 sectors in a sea with at most 8 visitable sectors (at most 8,800 routes); above that, the existing bounded search on the deciding objective. | Every order everywhere: 17,783,700 routes for a 30-sector sea, per sub. Bounded search only: no exact answer even for the first sectors. |
| D5 | The settings live in a save section of their own, `submersibles-recommendations`, which `save.js` already keeps as plain data. No `save.js` change. | A field in `settings.prefs`: needs `save.js` changed and three apps rebuilt, and an older cached copy strips it on its next write, which a merge then treats as a deletion on every device. Device-only storage: the settings would not follow the player. |
| D6 | One set of settings for the whole fleet. | Per free company or per sub: more screens and merge cases; not asked for. |
| D7 | `advise` without `input.recs` stays exactly as today; the page always passes `recs`. | Replacing `advise`: every existing advisor test would move at once. |
| D8 | While something is left to unlock but no route can reveal it now, Unlocking scores experience per hour ("levelling towards it"), as today. | Skipping Unlocking then: a sub stuck below a needed rank would farm instead of levelling whenever Gil is ranked second. |
| D9 | Gil stage is S6 unchanged: own log when a ranked route can be run, else community route, else stars. | A gil estimate for unlogged routes: no data (2.2 item 3). |
| D10 | Pickers are a native text box plus a native drop-down whose options the text narrows. | A custom ARIA combobox: more code and more ways to fail with a screen reader. A `datalist`: differs between phones and cannot show the whole list. |
| D11 | The 5% band is fixed; only the fuel allowance is tunable. | A second slider: not asked for. |
| D12 | New pure file `recs.js` (settings, item list, the staged choice); stage scoring stays in `advisor.js`, which owns the helpers. Tests go into `tracker/tests/submarines.test.js` (already run). | Everything in `advisor.js` or `subs.js` (1,100 lines). A new test file: `package.json` would change. |

## 4. The model

### 4.1 Inputs

Sub (rank, experience, four parts), free company (`unlockedSlots`, `discovered`), sectors pending on the company's
other voyages, the log figures of S6, and the settings `{ fuel, giveUp, order, loot }` (section 6). *Visitable*
sectors: found, and rank needed at most the sub's rank. `h = ev.seconds / 3600`; `tanks = ev.tanks` (at least 1).

### 4.2 Candidate routes

1. **Singles:** each visitable sector alone, if within range. (A sector out of range alone is out of range in every
   route: range is used from the start onward and each added sector costs at least its survey distance.) A stage is
   *live* when some single has an amount above 0; the **lead** is the first live stage in the player's order.
2. **Per sea, n visitable sectors.** `n <= 8`: every order of 1 to 5 sectors within range, at most
   8 + 56 + 336 + 1,680 + 6,720 = 8,800 evaluations. `n > 8`: the existing search (80 kept per length) scored by the
   lead stage, at most `n + 4 x 80 x n` evaluations (9,630 for 30 sectors); with fuel on, a second search scored by
   the lead's amount per tank. Of routes with the same sectors only the quickest order is kept.
3. **Always added:** community routes and logged routes with enough data that this sub can run (exact order, S6 4.2).
4. **Cost:** at most 143 + 2 x 45,903 = 91,949 route evaluations per sub (all seven seas full, fuel on); 46,046 with
   fuel off, the size of today's one search. A sub whose lead is Gil from the log or a community route needs no
   search at all, as today. Above 8 sectors the answer is the best found, not proven best; the panel says so.

### 4.3 Stages (in the order of the player's ranking)

| Objective | Stage | Amount per voyage `a(r)` | Score `s(r)` | Used when |
| --- | --- | --- | --- | --- |
| Unlocking | U1 next submarine slot | 1 if the route surveys the sector on the way to the next slot (today's `visit`), else 0 | `a / h` | a slot is still locked |
| Unlocking | U2 new sectors | unfound sectors the route's sectors can reveal, parents not pending (today's `newOf`) | `a / h` | a sector is still unfound |
| Unlocking | U3 towards it (D8) | base experience | `a / h` | U1 and U2 are not live, something is left to unlock, rank below the top |
| Leveling | X | base experience | `a / h` | rank below the top |
| Gil | G | own log: gil per voyage (S6); else stars of community routes; else stars | `a / h` | always; the tier is chosen among the routes still in play |
| Loot | L1 coverage | chosen items the route can drop, each once | `a` | an item is chosen |
| Loot | L2 chances | pairs (sector on the route, chosen item possible there) | `a / h` | an item is chosen |

### 4.4 The decision rule (`RECS.pick`)

```
S = candidates; lead = none
for each stage in order:
    best = highest s(r) in S
    if best is not above 0: the stage is skipped (its reason is kept); continue
    band = (fuel on and lead is none) ? giveUp / 100 : 0.05
    S = routes in S with s(r) >= (1 - band) x best
    if fuel on and lead is none:
        e(r) = a(r) / tanks(r);  S = routes in S with e(r) >= 0.95 x highest e in S
    if lead is none: lead = this stage
```

**Order of the result** (the plan is first): more narrowing steps survived; then each used stage's score in order,
highest first; then fewer seconds; then fewer tanks; then the route's id text ascending. **Other routes:** the next
two with a different set of sectors from the plan and from each other.

Properties: no priority ever gives up more than 5% to all lower ones together (X% for the top one with fuel on);
with one live stage the result is that stage's best route; nothing is random.

### 4.5 No data, and what the player is told

- Unlocking skipped: "every sector is found". Leveling skipped: "this sub is at the top rank". Loot skipped: no item
  chosen (said in Setup only), or "none of your chosen items can drop in a sector this sub can reach now".
- Gil without own figures uses the guide and keeps today's sentence ("… takes over once a route has 10 logged
  voyages (this one has n); until then the stars are only a guide").
- A skipped objective ranked above the lead is always named in the reason with its cause; ones below are not.
- No single within range: `blocked`, today's sentence.

### 4.6 Default numbers, and how they are chosen

| Number | Value | Why |
| --- | --- | --- |
| Band between priorities (`RECS.BAND`) | 5%, fixed | Differences smaller than this are below what the data can tell: times are "calculated, not yet confirmed", experience is a floor, gil rests on as few as 10 voyages. It also bounds the cost: the top priority loses at most 5%. |
| Fuel allowance (`RECS.GIVE_UP`) | starting value 15%; range 5 to 50, step 5 | Must exceed the 5% band or the switch does nothing, and stay well under half or the ranking stops being a ranking. The shipped number is set by the rule below, not by this guess. |
| Exact search up to | 8 sectors per sea | Never more work than one bounded search costs today (8,800 against 9,630). |
| Enough logged voyages | 10 (`EARN.ENOUGH`) | S6 decision D1. |

**Reproducible method (item R4, `tracker/tools/recs-tune.js`).** Test fleet, built only from the data: ranks 1, 10,
20, 30, 40, 50, 70, 90, 110, 130; at each rank one build per class the rank allows (the class's own four parts);
four slots. Scenario *levelling*: every sector of rank at most R found, Leveling first. Scenario *unlocking*: every
sector of rank at most R/2 found (at least A and B), default order. Gil is left out because the repository holds no
voyage log and none is made up; loot is left out because there are no odds.

- For each allowance g in 5, 10, … 50: `L(g)` = mean share of the top priority's per-hour score given up against
  fuel off; `E(g)` = mean gain in the top priority's amount per tank. **The default is the largest g up to which
  every step bought at least as much as it cost: `E(g) - E(g-5) >= L(g) - L(g-5)`** (with `E = L = 0` for fuel off).
- For the band, the tool prints, for 0, 2, 5 and 10%, the mean loss on the first live priority and the mean gain on
  the second. Accepted at 5% when the second gains more than the first loses.
- The tool writes its tables to `docs/submersibles-recommendations-tuning.md`; a unit test fails when
  `RECS.GIVE_UP` differs from the rule's result. That file is the explanation the owner asked for.

### 4.7 Living with S6: one answer everywhere

- Every screen asks `adviceFor`, which passes the settings; its cache key gains `RECS.sig(settings)`.
- **Invariant I1:** fuel off, no loot item chosen, sub at the top rank, everything found: the result equals today's
  `advise` in plan, other routes, reason, part advice and `own` (the S6 cases). Simplest way to hold it: when the lead
  is Gil and neither fuel nor a live Loot stage applies, return today's step-3 result unchanged.
- `step` keeps its meaning (1 a slot is locked, 2 a sector is unfound, 3 neither), so `stageOf` and notification
  grouping do not move.
- **Header:** today's "step N of 3: …" when the lead is Unlocking, or when step is 3 and the lead is Gil; otherwise
  the lead's label (for example "Suggested · Leveling Submersible Rank"). New result fields: `lead`, `head`,
  `skipped`, `fuel`.
- **Part advice** only at step 3, as today: lead Gil, the S6 rule (`gilTip`, else `partTip` when no ranked route);
  any other lead, `partTip` on the suggested route (minutes). A gil part tip never appears beside a non-gil plan.
- **Reason text:** the lead's sentence (today's wording for U1, U3, X and G; U2: "Can reveal n new sectors (… lead to
  them)" and, only when the route's lead score equals the best among the candidates, ": the most per hour within reach."; otherwise the figure without "most" ("At least n experience an hour."); other routes never say "most"; Loot: "Can bring back k of your m chosen items (names); possible items
  only (community data), drop odds are not known."); then "Then <label>: <figure>." for at most two later stages
  that removed a route; then skipped objectives above the lead; then, with fuel on, "Fuel efficiency: t tanks instead
  of u, for p% less <lead figure>." or "Fuel efficiency made no difference here." (the same candidates decided with
  fuel off).

### 4.8 Worked example (by hand; R2's test must reproduce it, and corrects this table if it differs)

Sub of rank 1 with the four Shark-class parts (speed 110, range 70), one slot unlocked, found: A and B of the
Deep-sea Site. A can reveal C; B can reveal D and E; E leads to J, which grants slot 2.

| Route | Range used | Seconds | Hours | Tanks | Base exp per hour | Slot chances per hour | Reveals per hour |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 16 | 54,250 | 15.07 | 1 | 704.1 | 0 | 0.0664 |
| B | 22 | 57,885 | 16.08 | 1 | 659.9 | 0.0622 | 0.1244 |
| A → B | 34 | 66,532 | 18.48 | 2 | 1,148.2 | 0.0541 | 0.1623 |
| B → A | 40 | 70,167 | 19.49 | 2 | 1,088.7 | 0.0513 | 0.1539 |

- Default order, fuel off: U1 best is B (0.0622); A → B is at 87%, outside 5%. **Plan: B**, "On the way to Deep-sea
  Site J, which grants slot 2: surveying Deep-sea Site B can reveal Deep-sea Site E." Other routes: A → B, A.
- Default order, fuel on at 15%: A → B (87%) enters the allowance; slot chances per tank are 1 for B and 0.5 for
  A → B. Plan B: "Fuel efficiency made no difference here."
- Leveling first, fuel off: best A → B (1,148.2); B → A is at 94.8%, just outside. **Plan: A → B.** With fuel on at
  15%, B → A enters; both give 10,610 experience per tank; A → B stays first on its score.

## 5. The interface

A panel "Customizable Recommendations" in `setupHtml()`, after "Free companies". After any change only this panel is
redrawn and focus returns to the control used (matched by its `data-rec` value); the Board follows on its next draw.

1. **Fuel efficiency:** a checkbox, "Prioritise fuel efficiency", off by default.
2. **Allowance:** a native slider, 5 to 50, step 5, labelled "To save fuel, give up at most N% of the best result
   for my top priority", with the number shown as text and "Use the default (N%)". Disabled while the switch is off;
   the stored number is kept.
3. **Ranking:** an ordered list of the four labels, each row with "Move up" and "Move down" buttons (named, for
   example "Move Gil Farming up"; disabled at the ends), a polite live line ("Gil Farming is now 2 of 4") and "Use
   the default order". Buttons work with keyboard and touch; no dragging.
4. **Loot Farming, five pickers.** Each: a text box ("Type to narrow the list") and a drop-down of every item of
   `loot`, by name A to Z, first option "none". Typing keeps the options whose name contains the text (case
   ignored); the chosen item always stays listed; no match shows a disabled "No item matches". The text is not
   saved. Pickers 2 to 5 each have a checkbox "Use picker n", off by default; off disables the two controls and
   keeps the choice. An item chosen in a switched-on picker is left out of the other pickers' lists; a switched-off picker blocks nothing and counts for nothing, and keeps its choice untouched. Duplicates are judged among switched-on pickers only (the earlier one wins); a duplicate arriving from another device or another tab, or a picker holding an item an earlier switched-on picker uses being switched on, shows "same as picker n, counted once", and choosing "none" there clears it. Under a chosen item: "Possible in n sectors (community data; drop
   odds are not known)."
5. **States:** nothing chosen: "No item chosen: Loot Farming is skipped." A `details` block "How the recommendation
   is decided" states the rule of 4.4 in plain words, the 5%, what each objective measures and its limits (2.2), and
   that above 8 sectors per sea the route is the best found by a bounded search.

## 6. Storage

`modules['submersibles-recommendations'] = { choices: { fuel, giveUp, order, loot1 … loot5, use2 … use5 } }` (section 10.3), written through
`CC.writeSection` with its own `{ rev, base }` (the Submersibles section's `SH.rev` is left alone, so its next write
merges as it does after any other page's save).

| Field | Shape | When absent or bad |
| --- | --- | --- |
| `fuel` | `true` or `false` | anything but `true` is off |
| `giveUp` | whole number 5 to 50, multiple of 5 | `RECS.GIVE_UP` |
| `order` | the four keys `unlock`, `level`, `gil`, `loot`, each once | the default order |
| `loot1` … `loot5` | whole number: the item id of picker 1 to 5; 0 means none | none; an id the data does not know, or one an earlier switched-on picker already uses while this picker is on, reads as none and the stored number stays (a switched-off picker keeps its item and is not judged) |
| `use2` … `use5` | `true` or `false`: picker 2 to 5 is switched on | anything but `true` is off; picker 1 is always on (`use1` is never written or read) |

- Nothing is written until the player changes a setting; then the write is a copy of the stored section in which only the keys the player changed are replaced (a picker's item and its switch are two keys); everything else stays exactly as stored, including unknown fields, unknown keys, an old `loot` array and unknown item ids (`RECS.store`). A page that merged another page's write keeps that merged section plus only its own later changes. A field nobody stored stays absent, so a merge never sees a change that was not made; `RECS.check` fills in the rest when reading. A page that found no section has no merge base.
  `RECS.check` only reads: a bad stored value is never rewritten on its own.
- **Why no `save.js` change (read in the source, not run):** `checkModules` passes a section without a checker
  through `clean()` and keeps it; `lists` is such a section today and `tracker/tests/core.test.js` covers its
  survival in backups, merges and other modules' writes. Every embedded copy of `save.js`, old or new, therefore
  keeps the new section. An older Submersibles page ignores it and advises as today.
- **Across devices:** each stored key is its own merge unit. Changed on one device: taken. Changed
  differently on both: the existing "which one is right?" prompt, labelled "submersibles-recommendations: choices ›
  order" (a nicer label needs `save.js`; known limit). Nothing is deleted without the player's choice.

## 7. Risks, and the first thing to verify

1. **First:** on a fresh branch from the S6 branch, `npm run test:unit` green. Then R1's first test: a section
   named `submersibles-recommendations` survives `CC.checkDoc`, another module's `CC.writeSection` and
   `CC.mergeModules`. If any code lists allowed module names (not read: the cloud code and the shell), stop.
2. With default settings the Board changes in two places without the player touching anything: discovery goes by
   reveals per hour (today: per voyage, then quickest), and a sub below the top rank with everything found is
   levelled before it farms (Q1). Existing browser checks may show other routes after R5.
3. The default allowance is unverified until R4 runs; the rule may return another number or no knee at all.
4. Loot advice rests on "possible" lists; the wording must never promise a drop.
5. Check line asserting `Suggested · step [12] of 3` in `check.js` relies on the header rule of 4.7.
6. Cost is asserted as a count of route evaluations, not as time.

## 8. Work items

Branch from the S6 branch. Every builder item ends with `npm run build`, then a commit of the rebuilt files; only
`tracker/command-center/site/` may change in the build (if `tracker/dist/`, `tracker/site/` or `crafting/atelier/`
change, stop). Acceptance for every builder item: `npm run build && npm run test:unit && npm run check` pass and
`git status --porcelain` is empty after the commit.

| Item | Tier | Depends on | Can start now |
| --- | --- | --- | --- |
| R1 Settings and the staged choice | Sonnet builder | none | yes |
| R2 Route choice in the advisor | Sonnet builder | R1 | after R1 |
| R3 Reasons, header, part advice | Sonnet builder | R2 | after R2 |
| R4 Tuning tool and defaults | Sonnet builder | R2 | after R2 (beside R3) |
| R5 Storage, wiring, fuel and ranking controls | Sonnet builder | R3, R4 | after them |
| R6 Loot pickers | Sonnet builder | R5 | after R5 |
| R7 Notes | Haiku clerk | R6 | after R6 |

### R1 Settings and the staged choice (Sonnet builder)

- Files: new `tracker/command-center/src/submersibles/recs.js`; `index.html` (script tag before `advisor.js`);
  `tracker/command-center/build.js` (add `recs.js` to the submersibles file list); `tracker/tests/submarines.test.js`.
- Steps: plain script on `globalThis.RECS`: `NAME`, `KEYS`, `LABEL` (the owner's four labels), `BAND = 0.05`,
  `GIVE_UP = 15`, `GIVE_MIN`, `GIVE_MAX`, `GIVE_STEP`, `defaults()`, `items(data)` (id and name, by name then id),
  `check(raw, data)` (section 6), `active(choices)` (chosen item ids), `sig(choices)`, and
  `pick(cands, stages, opts)` exactly as 4.4, returning the ordered routes, the lead, used and skipped stages.
  A stage is `{ key, objective, rate, amount(r) }` with an optional `prepare(S)` that returns the amount function.
  Nothing calls it yet.
- Unit tests: the survival test of risk 1; `check` for every row of the table in 6; `items` holds each loot item
  once, in order; `pick` on hand-made candidates: the band at 4.9% and 5.1%, a skipped stage, fuel band and
  per-tank filter, each tie-break, other routes with distinct sets.
- Escalate if: the survival test fails; or a check asserts the site's file list or count.

### R2 Route choice in the advisor (Sonnet builder)

- Files: `advisor.js`, `tracker/tests/submarines.test.js`.
- Steps: `advise(input)` with `input.recs` builds candidates (4.2) and stages (4.3), calls `RECS.pick`, and returns
  today's shape plus `lead`, `skipped`, `fuel`, with a minimal reason; `search` may take a per-sea limit;
  `ADVISOR.lastEvals` counts route evaluations. Without `input.recs` nothing changes.
- Unit tests: the four routes and both orders of 4.8 to the second; for five pools of at most 8 sectors the plan
  equals a brute-force best under 4.4; invariant I1 against the no-`recs` result for the S6 cases; D8 (rank 5,
  A to G found: experience route, Gil ranked second; with A to F found D can still reveal G, so the lead is U2); each skip of 4.5; `lastEvals` at most 92,000 for rank 130,
  everything found, Leveling first, fuel on; the existing advisor tests untouched.
- Escalate if: an existing advisor test must change; or I1 cannot hold.

### R3 Reasons, header, part advice (Sonnet builder)

- Files: `advisor.js`, `tracker/tests/submarines.test.js`.
- Steps: 4.7 in full: `head`, reason sentences, skipped causes, the fuel sentence, part advice by lead.
- Unit tests: header for each case of 4.7; the 4.8 reasons; a non-gil lead at step 3 never carries a gil part tip;
  a loot reason contains "drop odds are not known"; `parts` is `null` before step 3.
- Escalate if: a reason needs a figure the data does not hold.

### R4 Tuning tool and defaults (Sonnet builder)

- Files: new `tracker/tools/recs-tune.js`; `recs.js` (the constant only);
  new `docs/submersibles-recommendations-tuning.md` (written by the tool); `tracker/tests/submarines.test.js`.
- Steps: implement 4.6; `node tracker/tools/recs-tune.js --write` prints and writes the tables, the fleet, the rule
  and the chosen numbers; set `RECS.GIVE_UP` to the rule's result.
- Unit test: `RECS.GIVE_UP` equals the rule's result; the 5% band meets its acceptance.
- Escalate if: the rule returns 50 (no knee) or fails at the first step; the band fails its acceptance; fewer than
  20 scenarios have the intended lead; or the test adds more than about 20 seconds.

### R5 Storage, wiring, fuel and ranking controls (Sonnet builder)

- Files: `subs.js` (load, write and reload of the new section; `adviceFor`, `stageOf`, `adviceHtml`; the panel with
  controls 1 to 3 and the `details` text; `onClick`, `onInput`), `subs.css`, `check.js`.
- Steps: section 6 and 5 (items 1 to 3, 5); pass `recs` everywhere `advise` is called; `adviceHtml` prints `head`.
- Browser check **C85**: the panel shows the default order and the switch off; with nothing changed the save holds
  no new section; "Move up" by keyboard reorders, keeps focus and announces; after a reload the order is kept; with
  Gil first, a sub in an unlocking free company shows another route on the Board button and in the send window (the
  same one); `modules.submersibles` is byte-for-byte unchanged.
- Browser check **C86**: the slider is disabled until the switch is on; switch and number are stored; on a seeded
  fleet where fuel changes the route, the reason carries the fuel sentence; a second page that changed another field
  merges with no prompt.
- Escalate if: an existing check's expected route changes and the new route is not better or equal on its deciding
  stage (list old and new with both scores); or `SH.rev` handling must change.

### R6 Loot pickers (Sonnet builder)

- Files: `subs.js`, `subs.css`, `check.js`.
- Steps: section 5 item 4 and the empty state.
- Browser check **C87**: five pickers, the first without a switch; options are in A-to-Z order; typing narrows one
  list and leaves the chosen item; pickers 2 to 5 are disabled until switched on and keep their choice; an item
  chosen once is absent elsewhere; choices survive a reload; a stored duplicate shows "counted once".
- Browser check **C88**: with Loot Farming first and one item chosen, the Board suggests a route whose sectors list
  that item, the reason says "drop odds are not known", and an item out of reach shows the skip sentence.
- Escalate if: the drop-down needs a custom list box to work on a phone.

### R7 Notes (Haiku clerk)

- Files: `tracker/command-center/README.md` only.
- Steps: a short section (what it does, files, checks C85 to C88, the tuning file), `recs.js` in the file table,
  the site's file count from the build's printed line.
- Acceptance: `npm run build` leaves `git status --porcelain` empty apart from the README.
- Escalate if: anything else would change. (`docs/STATE.md` is updated by the orchestrator when the owner ships.)

## 9. Owner questions

No item is blocked from being built. Q1 must be answered before R5 ships; Q2 before a pull request is opened.

**Q1. What should the Board do on the day this ships, before a player touches the new settings?**
- *Keep things as they are:* the feature is not shipped; advice keeps its fixed order. No cost; nothing delivered.
- *A. The order you asked for (Unlocking, Leveling, Gil, Loot):* a submarine below rank 145 in a free company that
  has found everything is sent on experience routes instead of gil routes, until it reaches 145 or the player moves
  Gil above Leveling. No extra work. Risk: gil income drops for anyone who does not open Setup, and reaching 145
  takes long (1,829,558,717 experience in the game table).
- *B. Unlocking, Gil, Leveling, Loot as the starting order:* closest to today; levelling still happens whenever a
  rank stands between a submarine and the next unlock. No extra work. Risk: it is not the order you named.
- How sure: high on what each does (it follows from the rule); the size of the gil drop under A is not measured.
- Recommendation: A, as asked, since one tap in Setup changes it.

**Q2. How does this travel with steps S6 and S4, which are built but not shipped?**
- *Keep things as they are:* build nothing until S6 has shipped. No risk; the feature waits.
- *Its own branch and pull request on top of S6, merged after S6:* each `ship` covers one thing. Cost: none extra.
  Risk: if S6 changes before shipping, this branch must follow.
- *Added to the S6 and S4 pull request:* one `ship` covers three features. Risk: a problem in one holds all three.
- How sure: high. Recommendation: its own pull request on top of S6.

## 10. Storage, final design

Written 2026-11-17 from reading `tracker/src/core/save.js`, `merge.js`, `recs.js`, `subs.js`, the recommendation
tests and checks C85 to C88 on the branch. **Nothing was run for this section**; every statement about the merge
follows from the code as read, and R8's first test confirms the one the design rests on. Where this section differs
from sections 5, 6 and 8, this section wins; R8 brings 5 and 6 into line. `save.js` and `merge.js` stay untouched
(D5 stands); only the Command Center is rebuilt.

### 10.1 How the save picks merge units

- `CC.UNIT_DEPTH = 2` and `walk()` in `save.js`: a unit is the value at `section › key › key` when the first-level
  value is a non-empty plain object, otherwise the first-level value itself. Arrays are never split and nothing below
  the second level is. So `choices.loot` is **one** unit whether it is an array or an object keyed by picker; only
  keys directly inside `choices` are units of their own.
- One device (`CC.writeSection`): when the save's stamp differs from the page's, `CC.mergeModules` merges unit by
  unit against the page's base, inside the same transaction as the write (`CC.transact`; the localStorage fallback
  does read, merge and write in one synchronous step). A unit changed on one side is taken; a unit changed on both
  keeps the writing page's value, without asking.
- Across devices (`ET.threeWay`, through `CC.flatModules`): the same units; a unit changed differently on both sides
  raises "which one is right?".

### 10.2 Decisions

| # | Decision | Rejected |
| --- | --- | --- |
| D13 | Every control is its own merge unit: one key per control directly inside `choices` (10.3). The existing merge then keeps another tab's change to any other control, inside the write's own transaction. | (a) Reading the save before each write, in `subs.js` only: a save that lands between that read and the write still clashes on the whole `loot` array and the other tab's picker is lost (milliseconds, but real), and two devices changing different pickers still get a prompt. (c) Both: the extra read adds nothing once units are per control. `loot` as an object inside `choices`: still one unit (10.1). Five keys holding pairs `[itemId, on]`: a stale tab switching a picker off would undo an item chosen for it in another tab. |
| D14 | The write path moves out of `subs.js` into `recs.js` as `RECS.keeper(write, done)`; the page hands in the write function. | Leaving it in `subs.js`: it needs a page, so a unit test can only copy its logic (the reviewer found such a copy). |
| D15 | A write that fails drops the changes it carried: the panel returns to the last saved settings and says so. | Keeping them for the next write: once the status line is replaced the panel shows an unsaved value as if it were set, and reloads need a third state. Reading the save again first: not needed, the page knows its base. |
| D16 | The `choices.loot` array written by earlier builds of this branch is not read. | A fallback reader: the feature never shipped, and the frozen format would carry two shapes for good. |

### 10.3 Stored shape (frozen once shipped)

`modules['submersibles-recommendations'] = { choices: { fuel, giveUp, order, loot1 … loot5, use2 … use5 } }`

| Key in `choices` | Shape | When absent or bad |
| --- | --- | --- |
| `fuel`, `giveUp`, `order` | as in section 6 | as in section 6 |
| `loot1` … `loot5` | whole number: the item id of picker 1 to 5; 0 is none | none. An id the data does not know, or one an earlier switched-on picker already uses while this picker is on, reads as none; the stored number stays |
| `use2` … `use5` | `true` or `false`: picker 2 to 5 is switched on | anything but `true` is off. Picker 1 is always on: `use1` is never written and never read |

- In memory nothing changes: settings stay `{ fuel, giveUp, order, loot: [[itemId, on] x 5] }`, built by
  `RECS.check`; `advisor.js`, `RECS.active`, `RECS.sig`, `RECS.pick` and the tuning tool are untouched.
- A write never removes a key ("none" is 0, "off" is `false`) and holds only keys that were stored or that the
  player changed. Unknown keys beside or inside `choices`, an old `loot` array among them, stay as stored and are
  ignored. `RECS.check` only reads.

### 10.4 The write path (`recs.js`)

- `RECS.intent(was, now)` returns a **patch** `{ key: value }`: the stored keys whose control differs between two
  settings objects (`fuel`, `giveUp`, `order` by value; per picker N, `lootN` when the item differs and, from N = 2,
  `useN` when the switch differs).
- `RECS.store(raw, patch)`: a deep copy of `raw` (or `{}`) with `choices[key] = value` for each key of the patch;
  nothing else is touched; the input is not modified.
- `RECS.rebase(section, edits)`: `section` with each edit's patch stored in order; `null` with no edits stays `null`.
- `RECS.held(raw, i)`: the whole number stored for picker `i` (0 if none), for the "counted once" note.
- `RECS.keeper(write, done)`. `write(section, known)` resolves `{ rev, section, merged }`; `done(result)` is called
  after every write attempt. State: `raw` (what the panel reads), `base`, `rev`, `edits` (`{ seq, patch }`: changes
  not yet stored), `pending`.
  - `read(section, rev)`: `base` = a copy of the stored section or `null`; `rev`; `raw = rebase(base, edits)`.
  - `change(patch)` returns a promise that resolves (never rejects) when this page's queue has drained up to it:
    1. An empty patch does nothing.
    2. At once: `raw = store(raw, patch)`, the edit is recorded, `pending++`.
    3. Queued behind this page's earlier writes, one at a time, in order. At its turn: if no edit is unsent (an
       earlier write carried it) nothing is written; otherwise `snapSeq` = the highest seq and
       `write(copy of raw, { rev, base })`.
    4. Written: `rev = r.rev`; `base` = a copy of `r.section`; edits up to `snapSeq` are dropped;
       `raw = rebase(r.section, the remaining edits)`; `done({ ok: true, merged })`.
    5. Failed (thrown or rejected): edits up to `snapSeq` are dropped; `raw = rebase(base, the remaining edits)`;
       `rev` and `base` stay; `done({ ok: false, error })`.
    6. `pending--`.
- **Two changes in quick succession.** Both before the first write starts: one write carries both and the second
  turn writes nothing. The second while the first is being written: the first result becomes the base, the second
  change is put back on top of it (step 4) and written next; whatever another page stored meanwhile is in that base.
- **The page (`subs.js`).** `RC.k = RECS.keeper(…)` with `write` = `CC.writeSection(RECS.NAME, section, known)`
  (it also sets `SH.updated`, as today). `recsRead` calls `read`; `reload()` keeps its guard (no `read` while
  `pending` is above 0). `recsChange` builds the patch with `intent`, adds `lootN` by force when a stored duplicate
  is cleared, drops a change after which the settings read the same (`RECS.check(RECS.store(raw, patch))` against
  before; never when forced), calls `change` and redraws the panel. `done`: on success `pushSync()`; on failure the
  status line "Recommendation settings not saved on this device: <message> The panel shows the last saved settings
  again; make the change again if you still want it." and "Not saved. The panel shows the last saved settings
  again." in the panel's live line; in both cases the panel is redrawn when the settings now read differently from
  what it shows. No copy of steps 1 to 6 stays in `subs.js`.

### 10.5 What is safe, what asks, what remains

| Sequence | Result |
| --- | --- |
| One device: tab A changes one control; tab B, which has not taken that in, changes another (the switch, the allowance, the ranking, a picker's item, a picker's switch; the item and the switch of one picker count as two) | Both kept. No window: the merge and the write are one transaction |
| One device: another save stored a key or an item id this build does not know; a stale tab changes something else | Kept: that key is never in the tab's patch |
| One device: A picks an item in picker 1, stale B picks the same item in picker 2 | Both stored; picker 2 reads "same as picker 1, counted once" (section 5) |
| One device: A and B change the **same** control (the ranking is one control) | The later write is stored, without asking. This is what remains (Q3) |
| Two devices change different controls, two different pickers included | Merged, no prompt (the pair array raised one) |
| Two devices change the same control differently | "Which one is right?", labelled "submersibles-recommendations: choices › loot2" (a plainer label needs `save.js`; known limit) |
| A write fails | Nothing stored changes; the panel returns to the last saved settings and says so (D15) |
| An older build that never heard of the section (any embedded `save.js`: Tracker, Atelier, an older shell) | Has no checker for it and keeps it as plain data through writes, backups and merges (section 6); an older Submersibles page ignores it |

**Plainly:** no window remains in which a tab silently overwrites a control it did not change. A tab always
overwrites the control it changes; if another tab on the same device changed that same control meanwhile, the later
change wins unasked, as for every other section of the save. Only a `save.js` change could make that ask.

### 10.6 Work item R8: one merge unit per control (Sonnet builder)

Complete with 10.3 and 10.4; nothing else in this spec needs reading.

- **Files:** `tracker/command-center/src/submersibles/recs.js` and `subs.js`; `tracker/tests/submarines.test.js`;
  `tracker/command-center/check.js`; this spec (sections 5 and 6 only); the rebuilt `tracker/command-center/site/`.
  Not touched: `tracker/src/`, `advisor.js`, `tracker/tools/recs-tune.js`, `package.json`.
- **Steps:**
  1. Note `git rev-parse HEAD` as START. Write unit test K1 and run `npm run test:unit`; K1 must pass before any
     source changes. If it fails, stop and escalate.
  2. `recs.js`: `check` reads 10.3; `intent`, `store`, `rebase`, `held`, `keeper` as 10.4; the pair logic goes; the
     file's header comment is brought up to date.
  3. `subs.js`: `RC` keeps the panel's own state (`choices`, `live`, `focus`, `find`, `items`) and `k`; `recsRead`,
     `recsNow`, `recsChange`, `recDupOf` and `reload()` use the keeper; `recsWrite` goes.
  4. Tests and checks below; sections 5 and 6; `npm run build`; commit source, tests, spec and the rebuilt site.
- **Unit tests.** A "page" is `RECS.keeper((s, k) => CC.writeSection(NAME, s, k), done)` on the real save code
  (`recsFixture()`), loaded with `CC.read()` and `read()`; changes go through `RECS.intent` and `change`. No test
  re-implements a step of 10.4.
  - K1 `CC.flatModules` of a section holding every key of 10.3 gives exactly one unit per key,
    `m|["submersibles-recommendations","choices","<key>"]`; the section survives `CC.checkDoc`, another module's
    `CC.writeSection` and `CC.mergeModules` unchanged.
  - K2 the defect: A sets picker 1 to X; B, loaded earlier and not reloaded, switches picker 2 on and picks Y; the
    save reads `[[X, true], [Y, true], …]`. Once with a section stored before both loaded, once with none.
  - K3 a stored `loot3` the data does not know, an unknown key inside `choices` and one beside it survive a stale
    page's change to picker 2; so does an unknown `loot4` written by another save after the page loaded.
  - K4 A picks an item for picker 2, stale B switches picker 2 off: the item is A's and the switch is off.
  - K5 two changes without waiting: one write, both stored. A second change made while the first write is in
    progress, with another page's write landing in between (a `write` wrapper does both before it calls
    `CC.writeSection`): all three changes stored.
  - K6 a `write` that rejects once: `done` gets `ok: false`; the save is unchanged; `RECS.check(raw)` reads as
    before the change; `edits` is empty; the next change stores only itself; a change queued while the failing
    write was in progress is still stored.
  - K7 the same control in two pages (picker 1; the ranking): the later write is stored (documents what remains).
  - K8 through `ET.threeWay`: two devices changing different pickers, and the item and the switch of one picker,
    give no conflict and keep both; the same picker's item changed differently gives one conflict whose id ends
    `"choices","loot2"]`.
  - K9 `check` for every row of 10.3; an old `choices.loot` array is ignored and still there after a write.
  - Rewrite to the new shape, keeping what each asserts: "Review fix 1", "2", "2a", "2b", "2c", "Round 2, fix 2",
    "fix 3", "fix 4", the R1 `check` test, and any other test that stores a `loot` array. Delete "Round 2, fix 1"
    (it copies the write logic); K5 replaces it.
- **Browser checks.** C87 and C88: seeds and stored assertions in the new shape, same behaviour asserted. C85 and
  C86 unchanged unless they read `loot`. New **C89** (two tabs, one browser context, both on Setup; the save seeded
  beforehand with `{ choices: { loot4: 999999999, use4: true } }`): B stops hearing A (the page-id line C86 uses);
  A picks item X in picker 1; B switches picker 2 on and picks Y; then the save holds `loot1` X, `loot2` Y, `use2`
  true, `loot4` 999999999, `use4` true and no `loot` key; B's picker 1 now shows X; both status lines are empty; no
  dialog and no page error.
- **Spec.** Section 6: the first line, the `loot` row (replaced by the two rows of 10.3), the sentence on what a
  write holds and "each of the four fields" (each stored key). Section 5 item 4: "from another device" becomes
  "from another device or another tab". Nothing else.
- **Acceptance:** `npm run build && npm run test:unit && npm run check` pass;
  `git diff --stat START..HEAD -- tracker/src tracker/dist tracker/site crafting` prints nothing;
  `git status --porcelain` is empty after the commit.
- **Escalate if:** K1 fails; anything seems to need a change in `tracker/src/`, `advisor.js` or the tuning tool;
  the build changes a file outside `tracker/command-center/site/`; C89 cannot be made repeatable with the page-id
  line; or a check outside C85 to C89 changes its result.

### 10.7 Risks, and the first thing to verify

1. **First:** K1. The whole design rests on keys inside `choices` being separate units, which was read, not run.
2. The key names are frozen at shipping and show in the prompt label across devices ("choices › loot2").
3. Nine existing tests are rewritten; each must keep its assertion in the new shape, not lose it.
4. A page that skipped a reload while its own write was in progress shows another tab's change only at the next
   save it hears or makes. That is as today and safe for other controls; it is not changed here.
5. A save written by an earlier build of this branch keeps its `loot` array, ignored (D16); pickers chosen in such a
   test build read as none. No published build ever wrote one.

### 10.8 Owner question

**Q3. On one device, the same setting changed in two open tabs: should the app ask which one is right?**
- *Keep things as they are (after R8):* the later change is stored without a question, as when one submarine is
  edited in two tabs today. No cost. Risk left: the earlier tab's value for that one setting is replaced unasked;
  the later tab changed it on purpose, though it may not have shown the earlier value.
- *Ask on one device too:* the shared save code changes, against D5; the Tracker, the Command Center and the Atelier
  are rebuilt and checked again, and the question then appears in every module. Cost: a separate, larger job. Risk:
  a change to the code all three apps share.
- How sure: high on what each does (it follows from the code as read; not run).
- Recommendation: keep things as they are.
