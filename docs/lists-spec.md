# Lists: the crafting planner (spec)

Status: plan only, nothing built. Written 2026-11-21 from a reading of the sources named in section 12; the planning
session had no shell, so no test, build or network request was run and no file size was measured. Requirements:
`docs/lists-research.md` sections 1 to 8. Owner decisions of 2026-11-21 are fixed: Lists before Market with a reusable
engine; one release covering research sections 1 to 7; market prices from day one through one shared price service.

## 1. Goal and constraints

- **Goal.** A new module page `lists/` in the Command Center: the player says what they want to make, types what they
  have, chooses how to get each item, and sees what to get, what to craft and in which order. Every number is worked out
  again from those facts and the current game data on every change.
- **Constraints.** Offline-first public site on GitHub Pages. The app never reads or automates the game: stock is typed
  by the player and the page says so. No game data is invented: every recipe, yield, vendor and node comes from a pinned
  source, and a figure the data does not hold is shown as unknown, never as 0. No server: no shared editing.
- **Saves stay compatible.** The save's app tag, version and every existing field stay as they are. Lists adds one
  section, `modules.lists`. `save.js` changes, so the Tracker, the Command Center and the Atelier are rebuilt and
  committed in the same item (`npm run build`). A sync never deletes a list or a list entry without the player's choice.
- **Public repository.** No personal names, addresses, private paths or tokens in code, data, tests or evidence.

## 2. Decisions (rejected alternatives in brackets)

- **D1 Recipe source: the pinned game sheets**, read by a new Tracker tool in the style of `tracker/tools/submarines.py`
  (fetch at pinned commits, stop on any failed count). [The Atelier's solver data: it holds no yield, no vendors and no
  nodes, and lives inside WebAssembly. Teamcraft's recipe file: a community restatement of the same sheets.]
- **D2 Cross-check against the Atelier at build time.** `build.js` asks the Atelier's restored solver for every recipe
  and stops unless result item, job and every ingredient amount agree. [A browser test only: a mismatch could ship.
  A committed snapshot of the Atelier's recipes: one more file that can go stale; it is the fallback, section 6.]
- **D3 The engine is one pure plain script** (`globalThis.LISTS`, no DOM, no storage, no clock), loaded by the page and
  by Node tests, and later by Market. [Page code: Market could not reuse it.]
- **D4 Nothing computed is stored**: no tree, no totals, no "acquired" marks. Stored: wanted items, typed stock, choices.
- **D5 Many small save units** so that work on two devices combines: one unit per list header, per wanted item, per
  choice, per stock count (composite keys, because the merge works two levels down: `CC.UNIT_DEPTH`). [One unit per
  list: two devices editing one list would clash on the whole list. A deeper unit depth: old copies would misread.]
- **D6 Refuse, never repair** a stale write that would bring back a removed list or wanted item or orphan an entry
  (the Submersibles rule set, `docs/submersibles-integrity-spec-2.md` D1, D2). Every rule is "no new violation".
- **D7 A list removed on one device and changed on the other is one question for the whole list**, added to the sync
  beside the free-company rule. [Unit-by-unit answers: "keep" could return an empty list or leave entries without a list.]
- **D8 A stock count changed differently on two devices is asked**, as every clash is today (owner question Q2).
  [Adding both changes silently: counts twice when both devices typed the same stock.]
- **D9 Shared price service = shared code, one record per module.** The fetch, the 15-minute limit, the freshness rules
  and the settle logic move to `tracker/command-center/src/prices.js`; Submersibles keeps its two storage keys and
  record shape byte for byte; Lists gets its own two keys. [One record for both: it holds one price place, so two
  modules on different places would erase each other, and C113 pins the record's shape.]
- **D10 The Tracker's market page moves to the shared service later, with the Market module.** Reasons: it is another
  built app (single file) with its own request shape (five listings), a ten-minute memory cache and requests pinned by
  `tracker/tests/ui.test.js`; Lists needs nothing from it; Market will replace that page's shopping list anyway.
- **D11 Atelier hand-over by a link**, `atelier/#recipe=<recipe id>`. [The shared save: a visit would become a saved
  change. A query string: the Atelier's offline copy is matched by path.]
- **D12 In a combined view an item has one "get it by" choice**: the first selected list that sets one, else the first
  list's defaults; the page names a disagreement. [Per-list choices in one plan: removing an item from one list could
  raise what another list buys, breaking invariant E5.]
- **D13 What changed in a patch comes from the data, not from the save**: the data tool records recipes that differ
  from the previous data file; a list stores only the data stamp it was last confirmed against. [A stored copy or
  fingerprint of each recipe: can only say "something changed", and grows the save.]

## 3. Data (`tracker/data/lists.json`, built into `site/lists/data.js`)

Tool `tracker/tools/lists-data.py` (`python3 -I`, `--cache DIR`), pins as `tracker/data/SOURCES.md`: game sheets
`xivapi/ffxiv-datamining` @ `44948e4c`; Teamcraft @ `70429e21` (`shops.json`, `nodes.json`, `gathering-items.json`,
`fishing-sources.json`, `npcs.json`). Compact arrays; ids are game row ids; only items that are a recipe's result or
ingredient, or a currency of a kept trade.

| Table | Shape | From |
| --- | --- | --- |
| `stamp` | text: game version, sheet commit, Teamcraft commit | the pins |
| `items` | `{ id: [name, flags, merchantSells] }`; flags: tradable, can be HQ, always collectable, crystal | `Item` |
| `recipes` | `{ id: [item, yield, job 0-7, level, stars, [[item, amount]…], flags] }`; flags: can be HQ, expert, specialist, collectable, quick synthesis, master book | `Recipe` (`ItemResult`, `AmountResult`, `CraftType`, `Ingredient[0-7]`, `AmountIngredient[0-7]`), `RecipeLevelTable` |
| `gather` | `{ item: [job, level, zone, hours or 0, minutes or 0] }`; timed only when every node of the item is timed (the rule of `tools/info.py` for `conditions.json`) | Teamcraft nodes, gathering items, fishing sources |
| `trades` | `{ item: [[gives, [[currency, amount]…], alliedSociety 0/1, seller, zone]…] }`, at most four per item; currency 1 is gil | Teamcraft `shops.json` |
| `log` | `{ job: [[page title, [recipe ids]]…] }`, added by `build.js` from the `craft-*` lists of `tracker-data.json` | the Tracker's own lists |
| `changes` | `[{ from, to, recipes: { id: [old row, new row] }, gone: [ids] }]`; empty in the first file | the tool, by comparing with the committed file before it writes |

The tool stops, writing nothing, when: a recipe names an item missing from `Item`; a yield or amount is below 1; a
recipe id in `log` is missing; a trade gives fewer than 1; the recipe count differs from the count the builder records
in the tool on first run. **Size budget (not measured): `site/lists/data.js` at most 1.5 MB**, packed with deflate as
`submersibles/data.js` is; `build.js` prints plain and packed sizes and stops above the budget.

## 4. The save section

```
modules.lists = {
  v: 1,
  lists:   { <listId>: { name, charId, order, made, data, def: { order: [sources], allied }, steps: [{ id, name }] } },
  targets: { "<listId>.<targetId>": { item, recipe, qty, hq, coll, step, done } },
  rows:    { "<listId>.<itemId>":   { by, recipe, hq } },
  have:    { "<owner>.<itemId>":    { nq, hq, coll } },
  prefs:   { priceWorld, hideDone, combined: [listIds] }
}
```

- `listId`, `targetId`, step `id`: `[a-z0-9]{4,16}`, made on the device (time and random part). `name` up to 60
  characters; `charId` `c1` to `c8` or `null`; `order` 0 to 9999; `made` a time; `data` the data stamp, up to 60.
- `def.order`: a permutation of `craft`, `gather`, `vendor`, `market` (default in that order); `allied`: allied-society
  vendors allowed (default `false`). `steps`: up to 20, in order; a list with none is one step.
- Target: `item` and `recipe` game ids (`recipe` 0 for a wanted item that is not crafted); `qty` 1 to 99999; `hq`,
  `coll` true or left out; `step` a step id or left out (first step); `done` true once the player marks it finished.
- Row: `by` one of `craft`, `vendor`, `market`, `gather`, `have`, left out for the list default; `recipe` when the item
  has several; `hq` true when the player wants this material in high quality.
- Stock: `owner` is `c1` to `c8`, or `u` for lists without a character (Q1 decides owner = character or = list; only
  this key changes). `nq`, `hq`, `coll` 0 to 999999; a count that is all zeros is removed.
- Limits: 200 lists, 2,000 wanted items per list, 20,000 stock counts. `CC.checkLists` keeps only known fields of the
  right type and drops a bad entry, never repairs by guessing (the rule of `checkSubmersibles`).
- **Compatibility.** Old data is untouched: no existing field changes. An older build already keeps a section it does
  not know as plain data (`CC.checkModules` falls back to `clean`), merges it unit by unit and never strips it; every
  key above passes `CC.safeKey` and the depth and length limits of `clean`. From this release on `CC.checkLists` is the
  checker in all three apps, so a later new field needs all three rebuilt again, as `CLAUDE.md` says. Check C145 proves
  the three built apps save without changing the section. `CC.VERSION` stays 1.
- **An entry without its list** (only an older build's sync or a hand-edited save can leave one): never dropped, never
  a reason to refuse a write; the page shows it under "Restored list" and the player renames or removes it.

**Stale writes** (`CC.writeSection('lists', …)`, stale branch; base, sent, stored, result as in the Submersibles spec):
- **LI1 Nothing comes back.** A list header or wanted item in base, absent from stored, present in the result: refused
  whole. Text: `This list was removed on another device or in another tab.` / `This item was removed from the list on
  another device or in another tab.`
- **LI2 No new orphan.** A wanted item or choice in the result whose list header is missing, unless stored already held
  it that way: refused with the first text.
- **LI3 Nothing else changes.** A unit the page did not change is stored as stored has it; one it changed, as sent.
  The same unit changed in two tabs: the later save wins, as in every part of the save (known limit).
- A refused write stores nothing; the page shows the saved copy and `Not saved on this device: <reason> The page now
  shows what is saved; re-enter any unsaved edits if you still need them.` (the Submersibles page's behaviour).

**Sync** (`ET.threeWay`, `ET.applyMerge`): units merge by the existing rule (changed on one side: taken; changed
differently on both: asked, this device kept until answered). New pass beside the free-company pass:
- **LY1** A list header removed on one side while the other side changed it, or changed, added or kept-changed any of
  its wanted items or choices: one question, kind `list`, naming the list: keep it with everything in it (the keeping
  side's header, wanted items and choices) or remove it with everything in it. Its units raise no questions of their own.
- **LY2** Unanswered, nothing of that list is deleted. **LY3** After a sync no entry lacks its list unless one side
  already held it so. **LY4** Devices settle (same proof style as MD8). Stock counts are never part of a list question.
- `CC.describeUnit` gains plain labels: `Lists: list “Name”`, `Lists: “Name”: a wanted item`, `Lists: “Name”: how an
  item is got`, `Lists: the amount you have of <item>` with both sides' numbers. Item names come from `globalThis.
  LISTS_NAMES` when the page has loaded the Lists data, else `item <number>`.

## 5. The engine (`tracker/command-center/src/lists/engine.js`)

```js
LISTS.plan(data, input) -> plan      // pure: no clock, no storage, input never changed
// input: { lists: [{ id, def, steps, targets: [...], rows: { itemId: {...} } }], have: { itemId: { nq, hq, coll } }, prices: { itemId: gil } | null }
// plan:  { steps: [{ list, step, lines }], items: { itemId: line }, order: [{ job, crafts: [...] }],
//          shop: { gather, vendor, market, other, have }, gil: { vendor, market, unknown: [itemIds] }, left: { itemId: {...} }, notes: [] }
// line:  { item, need, needHq, used, toGet, by, recipe, crafts, makes, surplus, trades, cost, timed }
LISTS.source(data, list, itemId) -> by       // the row's choice, else the first of def.order the item really has, else 'other'
LISTS.craftDone(have, data, recipeId, times, quality) -> have   // a new stock map: product added, materials taken (never below 0)
LISTS.finish(have, target) -> have           // a finished wanted item leaves the stock
LISTS.missing(data, ticks, excluded, job, page) -> [recipeIds]
LISTS.nextWindow(hours, minutes, nowMs) -> { opensAt, closesAt, open }       // Eorzea time, the constant the Tracker uses
```

**One list opened on its own is never planned alone** (orchestrator review, 2026-11-21). With one stock per owner, the
page always plans every list of that owner together, in `order`, and shows the opened list's share of that plan: stock
an earlier list already uses is not offered again, and the row says so ("4 held for “Other list”"). Otherwise two lists
opened one at a time would each count the same stock as theirs, which is Teamcraft's fault of research section 1
(materials marked acquired after another craft used them). Invariant **E16**: summed over all lists of one owner, the
stock used never exceeds the stock typed, whichever list is opened. The player can reorder lists to choose which is
served first.

How a plan is made: lists in `order`, steps in order, one running stock. Per step, wanted items that are not `done`
make demands; items are settled from the wanted items down (a craft before its materials): stock is used first (a
high-quality need takes high-quality stock only; any other need takes normal stock, then high-quality); the rest goes
by the item's source: `craft` rounds crafts up to the recipe's yield and its surplus joins the stock, `vendor` rounds
trades up to what one trade gives and its currencies become gil or further demands, `gather`, `market` and `other` are
amounts to get, `have` needs nothing and touches no stock. The closing stock of a step opens the next.

**Invariants** (each a named unit test and a property of the model test):
- **E1** Same input, same plan; the input is unchanged.
- **E2** Per item and step: opening stock + made + got = used + closing stock.
- **E3** Multi-yield rounds up: crafts = the shortfall divided by the yield, rounded up; 0 ≤ surplus < yield.
- **E4** An item held in full asks for nothing below it; raising any stock count never raises any amount to get or craft.
- **E5** Removing a wanted item, or lowering its amount, never raises any amount to get or craft over the whole plan.
- **E6** A high-quality need is never met by normal stock; `hq` and `coll` stay on the line and survive a list copy.
- **E7** A collectable wanted item is met only by collectable stock and counts toward the list.
- **E8** A trade's real ratio: trades = shortfall ÷ what one trade gives, rounded up; cost = trades × the trade's cost.
- **E9** Steps lose nothing: summed over its steps a list asks for exactly what the same wanted items ask as one step.
- **E10** The crafting order is valid (no craft before one that makes its material), each block is one job, and
  neighbouring blocks differ in job.
- **E11** `have` ("already have"): nothing to get, nothing crafted, nothing below it, stock untouched.
- **E12** Recording a craft made from stock lowers that craft by the number made and changes no amount to gather or buy.
- **E13** Removing a wanted item and adding it back gives the identical plan (no residue).
- **E14** Every plan ends: a trade loop is cut, the item is listed under `other` and a note says why.
- **E15** Gil: market gil = amount × price for priced items only; an unpriced item is in `gil.unknown`, never 0.

**Model test** `tracker/tests/lists-model.test.js`, permanent, in `npm run test:unit`, built like
`subs-model.test.js`: seeded generator, seeds 1, 2, 3, 1,000 cases each, `LISTS_MODEL_N` and `LISTS_MODEL_SEED`
override, a shrinker, under 20 seconds, the test states its invariants itself. Part A: random small game data (yields
1 to 5, trades with ratios, several recipes per item, a trade loop in some), random lists, steps, choices and stock;
asserts E1 to E16. Part B, tabs (real `CC.writeSection`): three tabs editing lists; asserts LI1 to LI3, that a refused
write leaves the store byte-identical, that the store passes `CC.checkDoc`, and that nothing disappears unless a step
removed it. Part C, devices (real `ET.threeWay`, `ET.applyMerge`): asserts LY1 to LY4 and that a record of either
device missing afterwards was removed by a step, taken as a one-sided removal, or by an answered question.
An invariant is never weakened to get a green run; a failure is escalated.

## 6. Patch change, prices, Atelier

**Patch-change rule.** A list's `data` is the stamp it was last confirmed against. When it differs from the page's
data and `changes` holds entries after it: a notice on the list, "Game data changed since this list was last checked",
with one line per affected recipe in the list's present tree ("Rarefied X now needs 3 Y, was 2"; "makes 3, was 1";
"is no longer a recipe"). Kept, always: every wanted item, amount, flag, step, choice and stock count; nothing is
rewritten. A wanted item whose recipe is gone stays, shows "no longer in the game data" and asks for nothing. A choice
the data no longer offers (a vendor that stopped selling) falls back to the list default on screen and stays stored.
"OK, noted" writes the new stamp. A save whose stamp this page does not know (written by a newer page) shows no notice.

**Shared price service** `tracker/command-center/src/prices.js` (`globalThis.PRICE`, plain script, runs in Node):
`PRICE.create({ cacheKey, triedKey, query, read, tradable })` returns `cached`, `triedLoad`, `triedSave`, `mayTry`,
`aged`, `seenAt`, `oldest`, `needed`, `settle`, `fetchPrices` and the four time limits, moved unchanged from `earn.js`
lines 138 to 205 and 220 to 237. `earn.js` creates the Submersibles service with today's values (`eveniunt-subs-prices`,
`eveniunt-subs-prices-tried`, `?listings=0&entries=20`, the rounded recent average) and assigns each function to the
same `EARN.*` name; `usedMarket`, `failureNote`, `PARTIAL_NOTE`, `unitValue` stay in `earn.js`. In Node, `earn.js`
loads `../prices.js` itself when `PRICE` is missing, so `tracker/tests/earn.test.js` runs unedited. `subs.js` is not
edited; `submersibles/index.html` gains one script line. Lists creates its own service: keys `eveniunt-lists-prices`
and `eveniunt-lists-prices-tried`, query `?listings=1&entries=20`, `read` returns `[cheapest listing, recent average,
world, last upload]` (the reply fields the Tracker's market page already reads). Lists shows the cheapest listing
"before tax", with the place and the fetch time per item, the same failure sentences (worded for Lists: "showing no
market prices" instead of merchant prices), one automatic attempt per 15 minutes per place per device, and Refresh.
Prices live on the device only, never in the save. Price place: `prefs.priceWorld`, else the shared place setting.

**Atelier hand-over.** Every craft row has "Solve in the Atelier", a link to `../atelier/#recipe=<id>`, shown only for
recipes the cross-check found in the Atelier. On load and on `hashchange` the Atelier, for a recipe it knows: sets the
job to the recipe's, the mode to recipes, calls `selectRecipe(id)`, renders, then removes the hash with
`history.replaceState`. An unknown id shows the Atelier's own message and changes nothing. Nothing is written to the
shared save by the visit. Amounts are not handed over (the Atelier solves one craft).

**Cross-check (D2).** `tracker/tools/lists-crosscheck.js`, called by `build.js`: loads the solver glue and
WebAssembly that `restore-build-inputs.js` writes to `crafting/atelier/build/`, calls `recipe(id, 'en')` for every id
in `lists.json`, and throws on any difference in `itemId`, `job` or the ingredient list, or on a recipe the Atelier
has and the sheets lack. Recipes the Atelier lacks are listed in the data as "no hand-over" and counted in the build
output. Fallback if the glue cannot run in Node: a committed export `crafting/atelier/data/recipes-check.json` made
from the built Atelier, compared by `build.js`, with a test in `crafting/atelier/tests/atelier.test.js` that fails when
the export differs from the built Atelier. The Atelier exposes no yield, so yields are not cross-checked (limit).

## 7. Screens (page `tracker/command-center/src/lists/`)

Same family as the shell and Submersibles: the masthead and switcher, cards with the top rule, panel titles in the
display face, figures in the data face, square corners, the phone tab bar fixed at the bottom, the empty-state
treatment of `docs/submersibles-look-spec.md`. Colour by role: page, panel, text and accent from the theme; six
meaning roles with one hue in every theme, each a fill-and-text pair: craft, gather, merchant, market, ready, short.
A meaning is always also a word. 360 px wide without sideways scroll; tap targets 40 px on a phone; text 4.5:1.

| Screen | What it holds | Empty state |
| --- | --- | --- |
| Your lists | One card per list: name, character, "12 of 40 ready", steps. Buttons: New list, From the crafting log, Combined view (tick lists, open) | "No lists yet. Start one, or build one from the crafting-log pages you have not finished." Two buttons |
| A list, tab To get | Sections Gather, Buy from a merchant, Buy on the market, Other, Already have; closed at first, only open sections are drawn. Row: name, "need 12, have 4", minus, plus, an "I have" field, "Have all", "Get it by" select, quality stamp, next window for a timed node ("opens 14:00 Eorzea time, in 12 min"), price each and total with its fetch time | "Nothing left to get." |
| A list, tab To craft | Blocks by job in crafting order. Row: name, crafts and what they make, "Made 1", "Made all", "Solve in the Atelier" | "Nothing left to craft." |
| A list, tab Wanted | Wanted items: amount, High quality, Collectable, step, Finished, Remove; "Add items" search (25 results) | "Add the first item." |
| List bar | Name, character, step tabs with each step's own totals, "Hide completed" (one button), Defaults, price place and Refresh | none |
| Defaults sheet | "When an item can be got several ways, prefer:" an ordered list; "Use allied-society vendors" off | none |
| From the crafting log | Character, job, page; "23 of 40 not ticked in the Tracker"; Create | "Everything on this page is ticked." |
| Combined view | A list view over the chosen lists and one stock; a line where lists disagree on a choice | "Tick two or more lists." |

Wording rules: "I have", "need", "to get", "made"; no jargon. Under every stock field once per screen: "You type what
you have. This app never reads the game." Clearing an amount keeps the old amount; only Remove removes, after a
confirm. "Finished" asks nothing and can be undone. A step's "Finished" takes its wanted items out of the stock.

## 8. Work items

Every builder item: a branch; only the named files plus the built copies; `npm run build` twice (the second changes
nothing) and the rebuilt copies committed; `npm run test:unit`; report what ran and what did not; never merge. Browser
checks answer Universalis with a stand-in and route `lists/data.js` to a small fixture unless the item says real data.

- **W0 Baseline and facts (Haiku clerk).** No edits. Run `npm ci && npx playwright install chromium`, `npm run build`,
  `npm run test:unit`. Report: both results; the highest check id in `check.js` (expected C144); every `check.js` line
  that counts switcher links, modules or reads "On the way"; the size of `site/submersibles/data.js`; whether
  `raw.githubusercontent.com` answers for one pinned sheet; in Teamcraft's pinned `shops.json`, the field holding how
  many items a trade gives and any field marking an allied-society shop; whether `gather-*` entries of
  `tracker-data.json` carry `it`. Accept: the answers with file and line. Escalate if: a suite fails before any change.
- **W1 Data tool (Sonnet builder; after W0).** Files: `tracker/tools/lists-data.py` (new), `tracker/data/lists.json`
  (new), `tracker/data/SOURCES.md` (a "Lists" section with table, licences and stop rules),
  `tracker/tests/lists-data.test.js` (new), `package.json`. Steps: section 3. Tests LD-1 to LD-5: every ingredient and
  result is in `items`; five recipes checked by hand against the sheet rows quoted in the test (one multi-yield, one
  with a crafted material, one collectable); timed windows equal `conditions.json` wherever both hold the item; a
  trade that gives several keeps its ratio; a second run writes an identical file with empty `changes`. Accept: the
  test passes; counts and sizes in the report. Escalate if: no network; no field gives a trade's amount; nothing in
  the pinned data marks allied-society vendors (never guess from names); the plain file exceeds 4 MB.
- **W2 Engine (Sonnet builder; after W1).** Files: `tracker/command-center/src/lists/engine.js`,
  `tracker/tests/lists-engine.test.js` (LE-1 to LE-16, one per invariant, plus replays of the eight Teamcraft faults of
  research section 1), `tracker/tests/lists-model.test.js` part A, `package.json`. Accept: `npm run test:unit`; a plan
  for 500 wanted items of real data under 100 ms in Node (figure reported). Escalate if: an invariant cannot hold as
  written (E5, E9 and the quality rule are argued on paper only).
- **W3 Save section and store rules (Sonnet builder; after W2).** Files: `tracker/src/core/save.js` (`CC.checkLists`
  in `CHECK`, LI1 and LI2 in `writeSection`, `describeUnit` labels), `tracker/tests/core.test.js` (LS-1 to LS-8:
  checker table; round trip; an old checker stand-in keeps the section; LI1 for a list and for a wanted item; LI2; a
  stored orphan stays writable; two tabs on different items both kept), model part B, `check.js` C145. Accept:
  `npm run test:unit`, `npm run test:browser`, `CHECK_ONLY=C127,C140,C145 npm run check`. Must not change:
  `CC.mergeModules`, `CC.mergeUnit`, any Submersibles rule, any existing test. Escalate if: an existing test changes.
- **W4 Whole-list question in the sync (Sonnet builder; after W3).** Files: `tracker/src/core/merge.js` (the `list`
  pass in `ET.threeWay`, its branch in `ET.applyMerge` and `ET.describeConflict`), `core.test.js` (LY-1 to LY-6:
  removed against renamed; removed against a new wanted item; each answer and none; old device stand-in; settle),
  model part C, `check.js` C146 (the question's wording in the Settings dialog, both answers). Accept:
  `npm run test:unit`, `CHECK_ONLY=C119,C122,C146 npm run check`. Must not change: the free-company and slot passes,
  the conflict shape, R2, R3, F-01, INT and SI tests. Escalate if: an existing test needs an edit, or LY4 fails.
- **W5 Shared price service (Sonnet builder; after W0).** Files: `tracker/command-center/src/prices.js` (new),
  `src/submersibles/earn.js`, `src/submersibles/index.html`, `build.js` (copy the file), `tracker/tests/prices.test.js`
  (PR-1 to PR-4: two services do not touch each other's records; the limit, freshness and settle tables for a second
  `read`). Accept: `npm run test:unit` with `earn.test.js` unedited; `CHECK_ONLY=C29,C113,C117,C123 npm run check`
  with `check.js` unedited. Must not change: `subs.js`, the two storage keys, any message. Escalate if: either holds not.
- **W6 Build, page shell, cross-check (Sonnet builder; after W1, W2, W5).** Files: `build.js` (the `lists/` page,
  `data.js` with `log`, the budget, the cross-check call), `tracker/tools/lists-crosscheck.js`, `src/lists/index.html`,
  `lists.css`, `lists.js` (loads the save and data, shows Your lists and its empty state), `src/sw.js` (`lists/` in
  `PAGES`), `src/index.html` (switcher link, a Lists card, Lists out of "On the way"), `src/shell.js` (module list,
  the card's live line), `check.js` C147 (opens from the switcher, works offline after one visit, no page error, no
  sideways scroll at 360 px). Accept: build twice; `npm run test:unit`; `npm run check` (full). Escalate if: the glue
  will not run in Node (then build the fallback of section 6 and say so); any recipe disagrees or the Atelier lacks
  any; the budget is exceeded; an existing check counts switcher links (update it and list it in the report).
- **W7 Lists, wanted items, stock (Sonnet builder; after W3, W6).** Files: `src/lists/store.js` (pure edit functions),
  `lists.js`, `lists.css`, `tracker/tests/lists-store.test.js`, `check.js` C148 (create, add, amounts, stock entry,
  cleared amount keeps the item, reload keeps all) and C149 (two tabs: different items both kept; a stale edit of a
  removed list shows the "Not saved" line). The page writes one save at a time, as `subs.js` `write()` does. Accept:
  `npm run test:unit`, `CHECK_ONLY=C147,C148,C149 npm run check`. Escalate if: the write pattern needs a store change.
- **W8 Views and choices (Sonnet builder; after W7).** Files: `lists.js`, `lists.css`, `check.js` C150 (a "get it by"
  change and a defaults change move the totals at once), C151 (steps and leftovers), C152 (combined view, one stock,
  the disagreement line), C153 (crafting order by job, Made buttons, Hide completed), C154 (500 wanted items: under
  3,000 page elements with sections closed, an open section drawn in under one second). Accept: those checks and the
  unit suite. Escalate if: C154 cannot hold without virtual scrolling.
- **W9 Prices, timed nodes, patch notice (Sonnet builder; after W8).** Files: `lists.js`, `lists.css`, `check.js` C155
  (prices with fetch time; failure sentence; one automatic attempt across a reload; the Submersibles record untouched),
  C156 (next window at a fixed clock), C157 (fixture with a `changes` entry: the notice names the change, everything is
  kept, "OK, noted" clears it). Accept: those checks, C113 and C117 unedited. Escalate if: a reply field is missing.
- **W10 Crafting log and Atelier (Sonnet builder; after W8).** Files: `lists.js`, `crafting/atelier/src/atelier.js`
  (the hash link only), `crafting/atelier/tests/atelier.test.js` (link selects the recipe, clears the hash, saves
  nothing), `check.js` C158 (seeded ticks: the new list holds exactly the unticked, applicable recipes of that page,
  real data) and C159 (the link opens the built Atelier on that recipe). Ticks are read with the Tracker's own reader
  in `site/core/`. Accept: unit, browser and those checks. Escalate if: reading ticks needs a core change.
- **W11 Look and phone pass (Sonnet builder; after W9, W10).** Files: `lists.css`, `tracker/tests/lists-look.test.js`
  (the six roles at 4.5:1 in all 21 themes, both modes; no colour in a rule outside the token block), `check.js` C160
  (every colour on a pictured screen is a role) and evidence block `L2` (each screen at 1440 px light and 360 px dark:
  `evidence/lists-*.png`). Accept: full `npm run build`, `test:unit`, `test:browser`, `check`. Escalate if: a role
  cannot reach its ratio by lightness alone.
- **W12 Records (Haiku clerk; after W11).** Files: `docs/STATE.md` (an entry under "Built, waiting for the owner's
  `ship`"; section 10 under "Known limits"), `tracker/command-center/README.md`, `tracker/NOTICE.md` (Lists credits).
  Accept: only those files change; no personal data. Escalate if: a layout changed.

## 9. Risks, and the first thing to verify

- **First: W1's first run.** The sheets and Teamcraft files are not in the repository. On 2026-11-21 the planning
  session's environment reached `raw.githubusercontent.com` (HTTP 200), so the data can be fetched there; W0 still
  confirms it for the build session. `universalis.app` was not reachable from that environment, which is why every
  browser check answers prices with a stand-in.
- The cross-check may find the Atelier's solver data on another game version than the sheets; then the build stops by
  design and the owner is told (not decided here).
- E5, E9 and the quality rule are proved on paper only; the model test is the authority.
- `save.js` and `merge.js` change: one builder at a time, all three apps rebuilt, C127 and C140 rerun.
- Allied-society vendors may not be marked in the pinned data; then that default cannot be honest and is escalated.
- The data file may exceed the budget; trimming is a decision, not a silent step.
- Adding a switcher link may break checks that count links (W0 lists them).

## 10. Known limits (as designed)

- Stock is typed by hand. Retainers, alts and the free-company chest are whatever the player types.
- Yields are not cross-checked (the Atelier holds none). Market price is the cheapest listing of any quality, before
  tax, from community reports; it is not split by world (that is Market).
- The same unit changed in two tabs: the later save wins. A stock count changed on two devices is asked (Q2).
- A device still on the old version syncs lists unit by unit, so it can leave a kept list empty or an entry without
  its list; the new page shows such entries as "Restored list". This ends when every device has updated.
- Timed nodes show the next window only; alarms belong to the Gathering module. Fishing windows are not shown.
- Sources other than craft, gather, vendor and market (drops, quests, desynthesis, reduction) are "Other": to get,
  your own way. Sharing a list by link or file is a later phase.

## 11. Owner questions (not decided here)

**Q1. Is "what I have" counted once per character, or separately in every list?**
- A. Once per character (recommended): one stock that all of that character's lists draw on; the combined view is
  simply several lists against it. What you gain: you type a count once, and no two lists ever count the same
  materials, because stock goes to your lists in the order you put them in, and a list says how many are held for
  another. What it costs: nothing extra. Risk left: a list lower in your order can look short until you move it up.
  Sure: fairly.
- B. Separately in every list, as Teamcraft does: each list has its own counts and the combined view adds them up.
  What you gain: lists never affect each other. What it costs: the same item typed again in every list. Risk left:
  counts that disagree with your real bags. Sure: fairly.
- C. Keep things as they are: not possible to leave open, the module needs one of the two; until you answer, A is built
  (changing later moves one key and loses no data).

**Q2. Two devices changed the count of the same item before they synced (40 on one, 55 on the other).**
- A. Keep things as they are: the sync asks which is right, as for every other clash (recommended). Cost: a question
  per such item. Risk left: none to data. Sure: high.
- B. Apply both changes (10 gathered here, 3 used there) without asking. Cost: about half a day. Risk left: a wrong
  count when both devices typed the same real stock. Sure: medium.
- C. Keep the higher number without asking. Cost: small. Risk left: used-up materials come back. Sure: high it is wrong
  sometimes.

**Q3. Should the Tracker's crafting-log pages also get a "Make a list from what is missing" button?**
- A. Keep things as they are in the Tracker: the list is made from the Lists page, where you pick character, job and
  page (recommended for this release). Cost: nothing extra. Risk left: you have to know to look in Lists.
- B. Also add the button in the Tracker, opening Lists with the page chosen. Cost: one more builder item and a change
  to the Tracker's screens and tests. Risk left: low. Sure: medium, the Tracker's screen code was not read for this.

## 12. What was read, and what was not verified

Read: `CLAUDE.md`, `docs/STATE.md`, `docs/model-tiers.md`, `docs/lists-research.md`, `tracker/src/core/save.js`,
`merge.js`, the two Submersibles save specs, `docs/submersibles-look-spec.md` (sections 1 to 6 and R1),
`tracker/command-center/build.js`, `restore-build-inputs.js`, `src/shell.js`, `src/index.html`, `src/sw.js`,
`src/submersibles/earn.js` and the price calls of `subs.js`, the market part of `tracker/src/app/live.js`,
`tracker/data/SOURCES.md`, parts of `tracker/tools/extract.py` and `info.py`, `crafting/atelier/tools/prepare-data.py`,
the recipe functions of `crafting/atelier/bridge/src/lib.rs`, `selectRecipe` in `atelier.js`, `package.json`.
Not verified: any file size; that the pinned files can be fetched; the trade-amount and allied-society fields of
`shops.json`; that the solver glue runs in Node; that the Atelier's data and the sheets are the same game version;
which checks count switcher links; the shape of the Tracker's tick section (W10 reads it through the Tracker's code);
the Universalis reply fields beyond those `live.js` and `earn.js` already read; the planning background in the private
workspace was not opened.
