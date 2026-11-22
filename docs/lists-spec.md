# Lists: the crafting planner (spec)

Status: plan only, nothing built. Written 2026-11-21 from a reading of the sources named in section 12; the planning
session had no shell, so no test, build or network request was run and no file size was measured. Revised 2026-11-22
with the owner's answers (section 11) and two owner requirements: buy from a gil merchant first, and change how an
item is got at any time. Revised again 2026-11-22 after a same-family review (Claude reviewing a Claude plan, not an
independent audit): the planning model of section 5 was rebuilt so that every invariant is a property a test can
check; the owner answered the last question (Q4: option A) on 2026-11-22. **Revision 4 (2026-11-22)** applies two outside reviews (ChatGPT: not
ready, 20 findings; Mistral: ready after fixes, 15 findings); every finding and its ruling is in
`docs/lists-review-adjudication.md`. Requirements: `docs/lists-research.md` sections 1 to 8. Owner decisions of
2026-11-21 are fixed: Lists before Market with a reusable engine; one release covering research sections 1 to 7;
market prices from day one through one shared price service.

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
- **D4 Nothing computed is stored**: no tree, no totals, no "acquired" marks. Stored: wanted items (with how many of a
  must-craft entry were crafted), typed stock, choices.
- **D5 Many small save units** so that work on two devices combines: one unit per list header, per wanted item, per
  choice, per stock count (composite keys, because the merge works two levels down: `CC.UNIT_DEPTH`). [One unit per
  list: two devices editing one list would clash on the whole list. A deeper unit depth: old copies would misread.]
- **D6 Refuse, never repair** a stale write that would bring back a removed list or wanted item, orphan an entry, or
  remove something another tab changed (the Submersibles rule set, `docs/submersibles-integrity-spec-2.md` D1, D2).
  Every rule is "no new violation".
- **D7 A list removed on one device and changed on the other is one question for the whole list**, added to the sync
  beside the free-company rule. [Unit-by-unit answers: "keep" could return an empty list or leave entries without a list.]
- **D8 A stock count changed differently on two devices is asked**, as every clash is today (the owner's answer to Q2).
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
- **D12 One plan per character, and in it one way of getting each item** (review, 2026-11-22; owner's answer to Q4,
  option A, 2026-11-22). All lists of a character are planned together against that character's stock. How an
  item is got, and the order in which ways are tried, are stored once per character, not per list. [Per-list choices
  with one shared plan, as first written: list 1 crafts X (makes 3, needs 1), list 2 buys X (needs 2) and lives on
  list 1's spare; removing list 1's item makes list 2 buy 2. Amounts that rise when something is removed are the fault
  this module exists to avoid, and no test could hold. Per-list choices with no sharing of what a list crafts: sound,
  but totals come out higher than needed; it is option B of Q4.]
- **D13 What changed in a patch comes from the data, not from the save**: the data tool records recipes that differ
  from the previous data file, with their old rows; a list stores only the data stamp it was last confirmed against.
  [A stored copy or fingerprint of each recipe: can only say "something changed", and grows the save.]
- **D14 A gil merchant comes first, at every level** (owner requirement, 2026-11-22). Two vendor sources, told apart
  by the data: `vendor` is a merchant that sells the item for gil only; `trade` is a vendor that takes anything else
  (scrips, tomestones, seals, tokens). Default order: `vendor`, `craft`, `gather`, `trade`, `market`. An item a gil
  merchant sells is bought and nothing below it is planned. [One "vendor" source: a scrip trade would outrank
  crafting. Cheapest-by-gil ranking: needs market prices to plan, so plans would differ online and offline.]
- **D15 "Get it by" is on every row of every view**, and a craft row has a one-tap "Bought it" (owner requirement).
  Both only change stored facts (a choice, a stock count); the plan follows. [A choice column on To get only: an item
  planned as a craft never appears there, so the player cannot say "I bought it".]
- **D16 Undo lives in the page, not the save, and is conditional**: each change keeps the units it replaced and the
  units it wrote; "Undo" puts the earlier ones back only if every unit it would restore is still exactly as that
  change left it, checked inside the save's own transaction; otherwise it is refused with a plain line and nothing
  changes. [A stored history: grows the save and merges badly. An unconditional restore: would erase a count typed in
  another tab since.]
- **D17 The Tracker's button hands the page over by a link**, never a save write; Lists makes the list only when the
  player presses Create (the owner's answer to Q3).
- **D18 Totals are worked out once for the whole character, then shared out to lists and steps** (review). Totals
  never depend on how wanted items are split into lists and steps. [Step after step with a running stock, as first
  written: an earlier normal need could use up high-quality stock a later step needed, so steps and one step gave
  different answers.]
- **D19 "Must be crafted by me" belongs to the wanted item, not to the item** (review): a crafting-log entry is
  crafted whatever the item's way is, and the same item as a material elsewhere still follows the character's way.
  [A per-item craft choice: an ingot that is both a log entry and a material would be crafted everywhere, against D14.]
- **D20 Size limits are enforced when the player edits, never by the checker** (review). The checker runs inside every
  sync and tab merge; a cap there would silently drop merged data. [Caps in `CC.checkLists`: a sync could delete.]
- **D21 Removed against changed is kept until answered, everywhere** (outside review). A list header, wanted item,
  way, order or stock count removed on one side and changed on the other stays, with its question, until the player
  answers; a stale tab that removes something another tab changed is refused. [The generic rule: this device's side
  wins unanswered, so a removal on this device silently deleted the other side's change.]
- **D22 One plan line per item and part**, each with its own way, recipe, offer and counts. [One line per item: a
  normal need bought from a merchant and a high-quality need crafted cannot share one `by` and one `recipe`.]
- **D23 No arrays in the saved section** (outside review): steps, the order of ways and the combined-view selection
  are objects or text. [Arrays: the generic cleaner of every build, old ones included, cuts an array at 5,000 entries.]
- **D24 Loops are found once, on the ways alone, and cut at the lowest item number** (outside review): which item is
  cut never depends on stock or on what is wanted, so the "never rises" rules still hold. [Cutting while walking the
  plan: the cut would move when a wanted item is removed.]
- **D25 A trade offer is fixed by a rule that ignores amounts; a gil offer is the cheapest for the amount** (outside
  review). A gil purchase has nothing below it, so choosing by total cost is safe; a trade's currencies become needs,
  and an offer that changed with the amount could make a currency's need rise when a wanted item is removed.
- **D27 Recording takes only stock the plan did not promise elsewhere** (W2 model test, 2026-11-22). A recorded craft
  takes its materials from what the plan gave that craft, then from unpromised stock; never from stock another line
  holds, so recording can never make another line short. [Normal-then-high-quality regardless of the plan: the model
  test found a case where it took the high-quality material another line needed.]
- **D28 Handing in a step removes the items handed in, not their materials** (W2 model test, 2026-11-22). [Taking the
  materials the plan gave the step: with a craft that makes 2 shared by two lists, that raised the other list's need.]
- **D29 A cut never overrides a merchant purchase** (orchestrator, 2026-11-22; the W2 builder had a gil-merchant item
  inside a recipe loop planned as Other). Which item is cut stays as D24 says (independent of stock and wanted items,
  so E5 holds), but a cut affects only the parts of that item that would pass needs down (a part planned as `craft`
  or `trade`, and its make and collectable parts). A part whose way is `vendor`, `market`, `gather` or `have` passes
  nothing down and is planned by its way as usual, so an item a gil merchant sells is still bought (E17).
- **D26 Recording a craft is one operation on stock and wanted items together** and is always allowed, also when the
  typed materials do not cover it: the player knows what they made. [Refusing: the app would deny a true fact.]

## 3. Data (`tracker/data/lists.json`, built into `site/lists/data.js`)

Tool `tracker/tools/lists-data.py` (`python3 -I`, `--cache DIR`), pins as `tracker/data/SOURCES.md`: game sheets
`xivapi/ffxiv-datamining` @ `44948e4c` (English CSVs at `csv/en/<Sheet>.csv`; checked 2026-11-22: `Recipe.csv` answers at the full hash, the path without `en/` does not); Teamcraft @ `70429e21` (`shops.json`, `nodes.json`, `gathering-items.json`,
`fishing-sources.json`, `npcs.json`). Compact arrays; ids are game row ids. **Closure:** the file holds every item
that is a recipe's result or ingredient, and every currency of a kept offer, and for each of those its own recipes,
offers and nodes, repeated until nothing new is added, so a currency can always be planned like any item.

| Table | Shape | From |
| --- | --- | --- |
| `stamp` | text, at most 40 characters: `<game version> <first 8 of the sheet commit> <first 8 of the Teamcraft commit>`, for example `7.57h1 44948e4c 70429e21` | the pins |
| `items` | `{ id: [name, flags, merchantSells] }`; flags: tradable, can be HQ, always collectable, crystal | `Item` |
| `recipes` | `{ id: [item, yield, job 0-7, level, stars, [[item, amount]…], flags] }`; flags: can be HQ, expert, specialist, collectable, quick synthesis, master book | `Recipe` (`ItemResult`, `AmountResult`, `CraftType`, `Ingredient[0-7]`, `AmountIngredient[0-7]`), `RecipeLevelTable` |
| `gather` | `{ item: [job, level, zone, hours or 0, minutes or 0] }`; timed only when every node of the item is timed (the rule of `tools/info.py` for `conditions.json`) | Teamcraft nodes, gathering items, fishing sources |
| `trades` | `{ item: [[gives, [[currency, amount]…], hq 0/1, gcRank or 0, npc]…] }`; **every distinct offer is kept**: only offers equal in what they give, every currency and amount, quality and rank are merged, keeping the lowest NPC id; gil offers first; currency 1 is gil. Seller name and zone come from `npcs` | Teamcraft `shops.json` (`trades[].items[].id/amount/hq`, `trades[].currencies[].id/amount`, `trades[].requiredGCRank`, shop `npcs`) |
| `npcs` | `{ npc: [name, zone] }` for sellers in `trades` only; an NPC without a name or place shows as "a merchant" | Teamcraft `npcs.json`, same commit (already used by the Tracker) |
| `log` | `{ job: [[page title, [recipe ids]]…] }`, added by `build.js` (W6) from the `craft-*` lists of `tracker-data.json`; `build.js` stops if a recipe id in it is not in `recipes` | the Tracker's own lists |
| `changes` | `[{ from, to, recipes: { id: [old row, new row] }, gone: { id: old row } }]`, `from` and `to` are stamps; empty in the first file; a later run keeps every earlier entry and adds one | the tool, by comparing with the committed file before it writes |

**Built in W1 (2026-11-22), choices the orchestrator accepted:** `items[2]` (merchantSells) is the Item sheet's
`PriceMid`; `gather` hours are the sorted spawn hours (0 when not timed) and minutes the node's duration (all 185 timed
items agree with `conditions.json`); fish are job 2 with the lowest spot's level and zone and no window; flag bits are
written in the tool's header (items: 1 tradable, 2 can be HQ, 4 always collectable, 8 crystal; recipes: 1 HQ, 2 expert,
4 specialist, 8 collectable, 16 quick synthesis, 32 master book); a `changes` entry records only a recipe that differs
or is gone (added recipes are not recorded). First run: 13,892 recipes, 13,848 items, 4,041 gil offers, 1,045 other
offers, 25 items with more than four offers, 118 currencies closed, no recipe loop; plain 1,758,168 bytes, packed
317,979 bytes (423,972 as base64), stamp `7.57h1 44948e4c 70429e21`.

**Gil merchant or not** is read from the offer, never guessed: an offer is `vendor` when its only currency is gil
(currency 1); every other offer is `trade`. **Facts checked by W0 (2026-11-22):** the pinned `shops.json` has 2,253
shops and 38,908 offers; every offer lists its currencies (16,560 gil only, 22,348 with another currency, none without
one). It has **no allied-society marker** and no seller name or zone (shops carry NPC ids). So allied-society vendors
are not told apart: their offers in tribal tokens are `trade`, which comes after crafting and gathering by default, so
the owner's "not easier" rule holds without a marker; a gil offer from an allied-society NPC that needs reputation is
planned as an ordinary gil merchant (known limit). 857 offers carry `requiredGCRank`: the row shows "needs Grand
Company rank N". 831 offer rows sell high quality (`hq`).

The tool stops, writing nothing, when: a recipe names an item missing from `Item`; a yield or amount is below 1; a
trade gives fewer than 1 or has no currency; **the recipes form a loop** (an item that, through recipes alone, needs
itself); the stamp is longer than 40 characters; the recipe count differs from the count the builder records in the
tool on first run. **Size budget (not measured): `site/lists/data.js` at most 1.5 MB**, packed with deflate as
`submersibles/data.js` is; `build.js` prints plain and packed sizes and stops above the budget. W1 reports both sizes
on its first run, so a trimming decision, if one is needed, is made early and with numbers.

## 4. The save section

```
modules.lists = {
  v: 1,
  lists:   { <listId>: { name, charId, order, made, data, steps: { <stepId>: { name, n } } } },
  targets: { "<listId>.<targetId>": { item, recipe, qty, hq, coll, make, crafted, step, done, at } },
  ways:    { "<owner>.<itemId>":    { by, recipe, hq, offer } },
  owners:  { <owner>:               { order: "vendor craft gather trade market" } },
  have:    { "<owner>.<itemId>":    { nq, hq, coll } },
  prefs:   { priceWorld, hideDone, combined: { <listId>: 1 } }
}
```

- **No arrays anywhere in the section (D23).** Steps are an object, each with its place `n`; the order of ways is one
  text of five words; the combined-view selection is an object keyed by list id.
- `owner` is the list's character, `c1` to `c8`, or `u` for lists without a character. Stock (owner decision Q1), ways
  and the order of ways (D12, owner question Q4) are kept once per owner.
- **Ids.** `listId`, `targetId`, `stepId`: 12 characters of `0-9a-z` drawn from `crypto.getRandomValues` (about 62
  bits); the checker accepts `[a-z0-9]{4,16}`. Two devices making the same id is handled by LY6.
- Header: `name` up to 60 characters; `charId` `c1` to `c8` or `null`; `order` 0 to 9999; `made` the time it was
  created; `data` the data stamp, up to 60 characters (stamps are at most 40). **List order is fixed:** by `order`,
  then `made`, then `listId` as plain text. Steps are ordered by `n`, then `stepId`; a list with none is one step.
- `owners.<owner>.order`: the five words `vendor`, `craft`, `gather`, `trade`, `market` in any order, each once; **the
  default is that order** (D14). An owner without it, or with a malformed text, reads as the default. (No
  allied-society switch: the data cannot mark those vendors, section 3.)
- Target (a wanted item): `item` and `recipe` game ids (`recipe` 0 for a wanted item that is not crafted); `qty` 1 to
  99999; `hq`, `coll`, `make` true or left out (`make`: must be crafted by the player whatever the item's way is;
  D19); `crafted` 0 to `qty`, how many of a `make` item's amount have been crafted; `step` a step id or left out;
  `done` true once marked finished; `at` the time it was created. **A `step` id that is not in the list's header is
  kept as stored and read as the first step**, never dropped. Every combination of flags is kept as stored; how they
  are read is in section 5.
- Way: `by` one of `vendor`, `craft`, `gather`, `trade`, `market`, `have`, left out for the owner's order; `recipe`
  when the item has several; `hq` true when the player wants this material in high quality; `offer` the chosen trade
  offer as text `<npc>.<gives>.<first currency id>`, left out for the usual one.
- Stock: `nq`, `hq`, `coll` 0 to 999999; a count that is all zeros is removed.
- **The checker always returns the whole frame:** `{ v: 1, lists: {}, targets: {}, ways: {}, owners: {}, have: {},
  prefs: {} }` with the valid entries filled in, in that key order, as `checkSubmersibles` returns its four groups.
  So once written the section never disappears, and byte-for-byte tests are stable.
- **The checker has no size limits (D20).** `CC.checkLists` keeps every entry whose fields are valid, however many
  there are; it keeps only known fields of the right type and drops an entry only when it is malformed (the rule of
  `checkSubmersibles`), never to make room. Limits are applied by the page's edit functions alone: a new list is
  refused above 200 lists, a new wanted item above 2,000 in a list, a new step above 20, a new stock count above
  20,000, each with a plain line ("This list is full: 2,000 items."). Data over a limit that arrived by a sync or
  another tab stays, shows and can be edited or removed.
- **Compatibility.** Old data is untouched: no existing field changes. An older build already keeps a section it does
  not know as plain data (`CC.checkModules` falls back to `clean`), merges it unit by unit and never strips it; every
  key above passes `CC.safeKey` and the depth and length limits of `clean`, and with no arrays the cleaner's cut at
  5,000 array entries can never apply (both outside reviews confirmed the rest in the code). From this release on
  `CC.checkLists` is the checker in all three apps, so a later new field needs all three rebuilt again, as `CLAUDE.md`
  says. Check C145 proves it with the shipped builds. `CC.VERSION` stays 1.
- **A wanted item without its list** (only an older build's sync or a hand-edited save can leave one): never dropped.
  A write that would create a *new* one is refused (LI2); one already in the stored copy stays writable and shows
  under "Restored list", where the player renames or removes it.

**Stale writes** (`CC.writeSection('lists', …)`; base, sent, stored, result as in the Submersibles spec). **The gate:**
today the merge and every refusal run only when a stored section exists (`if (stored && …)`). For `lists` the rules
run whenever the revision differs, and a missing stored section is read as the empty frame, so a stale page can never
write its old copy back whole. Checked in this order:
- **LI2 No new orphan (first).** A wanted item in the result whose list header is missing from the result, unless
  stored already held it that way; and a wanted item the page added or changed whose list header is in base and absent
  from stored: refused whole with `This list was removed on another device or in another tab.`
- **LI1 Nothing comes back.** A list header in base, absent from stored, present in the result: refused with the same
  text. A wanted item in base, absent from stored, present in the result (its list still stored): refused with `This
  item was removed from the list on another device or in another tab.`
- **LI4 Nothing changed elsewhere is removed (D21).** A unit of any group that is in base, that the page removed, and
  that stored holds with a value different from base: refused with `This was changed on another device or in another
  tab, so it was not removed.`
- **LI5 A conditional write (D16).** `known` may carry `expect: { <unit key>: <JSON text or null> }`; inside the
  transaction, if any named unit of the stored section differs from the expected text, the write is refused with
  `This was changed on another device or in another tab since.` Only undo uses it.
- **LI3 Nothing else changes.** A unit the page did not change is stored as stored has it; one it changed, as sent.
  The same unit changed in two tabs (a way, an order, a stock count, a wanted item's amount): the later save wins, as
  in every part of the save (known limit).
- A refused write stores nothing; the page shows the saved copy and `Not saved on this device: <reason> The page now
  shows what is saved; re-enter any unsaved edits if you still need them.` (the Submersibles page's behaviour).

**Sync and the Tracker's tab merge** (`ET.threeWay`, then `ET.applyMerge` with the player's answers; the Tracker's
`ET.saveMerge` and the end of a Settings sync call it with no answers). Units merge by the existing rule: changed on
one side only, taken; changed differently on both, asked. One new pass for `lists`, beside the free-company pass, in
`ET.threeWay`, with its branch in `ET.applyMerge`:
- **LY0 Removed against changed is kept (D21).** For every `lists` unit that one side removed and the other changed
  (today a clash whose provisional value is this device's, so a removal here deletes unanswered): the clash is tagged
  `integrity: { kind: 'lists', keep: true, … }`, the provisional value is the surviving one, and `ET.applyMerge`
  removes it only on an explicit answer for the removing side. With no answer the unit stays and the question is
  asked again at the next sync that can ask. Both orientations.
- **LY1 The whole-list question.** For a list whose header is in base (B), with X the side that lacks the header and
  Y the side that holds it:

  | Case | What each side holds | Result |
  | --- | --- | --- |
  | 1 | X removed the header and every wanted item; Y's header and wanted items equal B | The removal is taken: the list goes with everything in it. No question (the player removed it; nothing is orphaned) |
  | 2 | X removed the list; Y changed the header, or changed or added any wanted item | One question, kind `list` |
  | 3 | X lacks the header but still holds wanted items of the list (an older build, a hand edit); Y changed or not | One question, kind `list` |
  | 4 | Both sides lack the header | No list question; wanted items left on either side stay and show as "Restored list" (LY3's exception) |
  | 5 | The header is not in B and one side added it (a new list), or there is no B | Taken with its wanted items; no question |

  The question names the list. **Keep**: Y's header stays, and every wanted item of the list that either side holds
  stays (where both hold one differently, the ordinary unit rule and LY0 decide its value); nothing of the list is
  dropped. **Remove**: the header and every wanted item of that list on both sides are removed. **Unanswered**: the
  same as Keep, and the question is asked again at the next sync that can ask (the cloud base keeps the list as it was,
  as it does for a free-company question). The list's units raise no questions of their own while the list question is
  open, except value clashes between two versions of one wanted item.
- **LY2** Unanswered, nothing of any list is deleted. **LY3** After a sync no wanted item lacks its list unless one
  side already held it so. **LY4** Devices settle: after every question is answered, further syncs change nothing and
  ask nothing; with questions unanswered, further syncs change nothing and ask the same questions (proof style of
  MD8). **LY5** Ways, orders and stock counts belong to the character and are never part of a list question; LY0
  covers them.
- **LY6 The same id made on two devices.** A list header or wanted item that is not in base, is on both sides, and
  has a different creation time (`made`, `at`) on each is two records, not one: both are kept, and the one with the
  later time (equal times: the one whose JSON text sorts later) is stored under a new id, the first 12 characters of
  the base-36 text of a hash of its old id and its time, so both devices compute the same; a list's wanted items move
  with it. No question. With equal times it is one record and the ordinary rules apply.
- **Wording.** `CC.describeUnit(id, local, remote, nameOf, integrity)` keeps its signature and cannot see list names
  or item names, and Settings does not load the Lists data. So the pass puts `listName` in the `integrity` of every
  clash about a list or a wanted item (read from the header in the merged copy or on either side), as the slot
  question carries the free company's name. Labels: `Lists: list “Name”`; `Lists: “Name”: a wanted item (item 5057,
  3 wanted)`; `Lists: how <character> gets item 5057`; `Lists: <character>'s order of ways to get items`; `Lists: the
  amount <character> has of item 5057` with both sides' numbers; a removed side reads `(removed)`. Characters are
  named through `nameOf`. **Items appear by number in these questions** (known limit).

## 5. The engine (`tracker/command-center/src/lists/engine.js`)

```js
LISTS.plan(data, input) -> plan      // one owner; pure: no clock, no storage, input never changed
// input: { order, ways: { itemId: { by, recipe, hq, offer } }, have: { itemId: { nq, hq, coll } },
//          lists: [{ id, steps, targets: [...] }] (already in list order), prices: { itemId: gil } | null }
// plan:  { lines: { "<itemId>|<part>|<recipe or 0>": line },   // the owner's totals: the only place amounts are decided
//          items: { itemId: [line keys] },
//          shares: [{ list, step, lines }],     // the same totals shared out; per line the shares add up to the total
//          order: [{ job, crafts: [...] }], shop: { vendor, gather, trade, market, other, outside },
//          gil: { vendor, market, unknown: [itemIds] }, spare: { lineKey: n }, left: { itemId: { nq, hq, coll } },
//          leftover: { listId: [{ item, nq, hq }] }, cut: { itemId: note }, notes: [] }
// line:  { item, part, need, given, outside, short, by, why, recipe, offer, crafts, trades, makes, got, spare, cost, timed }
LISTS.way(data, input, itemId, quality) -> { by, why, recipe, offer }   // fixed by the data, the order and the stored way; never by stock or lists
LISTS.cuts(data, input) -> { itemId: note }  // the loops, from the ways alone (D24)
LISTS.tree(data, lists) -> Set(itemIds)      // every item the wanted items could need, whatever the ways and stock
LISTS.record(data, state, plan, { line, times, quality, targets: { targetKey: n } }) -> { have, targets, short: [itemIds] }  // see E12, D27
LISTS.bought(have, itemId, units, quality) -> have       // units of the item added to stock, nothing taken
LISTS.finishStep(plan, state, listId, stepId) -> { have, targets }       // see E19
LISTS.missing(data, ticks, excluded, job, page) -> [recipeIds]
LISTS.nextWindow(hours, minutes, nowMs) -> { opensAt, closesAt, open }       // Eorzea time, the constant the Tracker uses
```
`state` is `{ have, targets, ways }` of one owner. "Total" below means a figure of a line in `plan.lines`.

**One list opened on its own is never planned alone** (orchestrator review, 2026-11-21). With one stock per owner, the
page always plans every list of that owner together, in list order, and shows the opened list's share of that plan:
stock an earlier list already uses is not offered again, and the row says so ("4 held for “Other list”"). Otherwise
two lists opened one at a time would each count the same stock as theirs, which is Teamcraft's fault of research
section 1 (materials marked acquired after another craft used them). The player can reorder lists to choose which is
served first.

**The four parts, and which a wanted item counts in (D22).** A wanted item counts in exactly one part, by this
precedence; its flags stay stored whatever they are:
1. `make` with a recipe in the data: the **make** part (key: item, `make`, that recipe). `hq` and `coll` on it only
   say in which quality the craft is expected to be recorded. `make` without a usable recipe is read as not set, with
   a row note.
2. else `coll`, when the recipe is flagged collectable or the item is always collectable: the **coll** part (key:
   item, `coll`, the target's recipe). `coll` on an item that cannot be a collectable is read as not set, with the row
   note "This cannot be made as a collectable; planned as an ordinary item." `coll` together with `hq`: `coll` wins.
3. else `hq`: the **hq** part. 4. else the **normal** part.
A material's need goes to the hq part when that item's way has `hq`, else to the normal part. The hq and normal parts
have recipe 0 in their key and use the way's recipe, or the item's recipe of lowest level, then lowest id.

**The way of an item, per quality** (D12, D14). For the normal part and for the hq part separately: the stored way's
`by` when the item really has that source in that quality; else the first source in the owner's order that the item
has in that quality; else `other`. A source "has the quality": `craft` for normal always and for high quality when the
recipe can be HQ; a `vendor` or `trade` offer for normal when it is not marked `hq`, for high quality only when it is;
`market` for both; `gather` for normal only. Both ways depend only on the data, the owner's order and the stored way.
The make and coll parts are always crafts. With the default order an item a gil merchant sells is bought, wanted items
included, and nothing below it is planned; its row shows "Sold by <seller> for N gil; planned as bought" with "Craft
it instead" one tap away.

**Which offer.** `vendor`: among the item's gil offers of the part's quality, the one with the lowest total for the
shortfall, (shortfall ÷ gives, rounded up) × price; ties: lower price per unit (compared by cross-multiplying), then
fewer per purchase, then lowest NPC id. `trade` (D25): the stored `offer` when the data still has it in that quality;
else, among the item's non-gil offers of that quality: fewest currencies, then lowest amount of its first currency per
unit given (cross-multiplied), then lowest first currency id, then lowest NPC id. The row offers the other trades to
choose from. Every currency of the chosen trade is charged: gil to `gil.vendor`, every other currency as a need of
that item's normal part, planned like any item (recursively).

**Loops (D24, E14).** Take every item in the data with, for each of its two ways and for its recipes, the edges the
way would create: `craft` to each material of the way's recipe, `trade` to each non-gil currency of the way's offer,
nothing for the others; plus recipe edges for every recipe (the make and coll parts can use any). Where a set of items
reach each other (a self-edge included), the item with the lowest id in the set is **cut**: all its parts are planned
as `other` except a part whose way passes nothing down (D29: `vendor`, `market`, `gather`, `have`, which is planned by
its way), nothing is passed below it, and `plan.cut` and a row note say "<item> and <item> need each other; <item>
is listed under Other." The cut item's edges are removed and the search repeated until no loop is left. The cuts
depend on the data, the order and the ways only.

**How totals are made (D18).** Every wanted item of the owner that is not `done` is taken together, whatever its list
or step. Lines are settled from the wanted items down, each exactly once, after every line that can give it a need
(always possible once the cuts are made). For one item:
1. **make** lines: need = the sum of `qty − crafted` of their wanted items; crafts = need ÷ yield, rounded up. They
   are given no stock, and what they make beyond the need is `spare`.
2. **coll** lines: need = the amounts; given = collectable stock (shared between coll lines in list order); short =
   need − given; crafts = short ÷ yield, rounded up.
3. **hq** line: given = high-quality stock; short = need − given; got by the hq way.
4. **normal** line: given = normal stock, then only the high-quality stock line 3 did not take; short = need − given;
   got by the normal way.
Getting a shortfall: `craft` = short ÷ yield, rounded up, and each material gets a need of crafts × its amount;
`vendor` and `trade` = short ÷ what one purchase gives, rounded up, charged as above; `gather`, `market`, `other` =
`got` is the shortfall, to get; `have` = the shortfall is recorded as `outside` (below). What a craft or purchase gives
beyond the shortfall is the line's `spare`; **`spare` is never given to any need in the plan**. `left` is typed stock
no line was given.

**"Already have" is an outside supply, counted and named (E11).** With the way `have`, the line's shortfall is not
hidden: it is `outside`, the amount the player says they hold outside the typed stock. Nothing is taken from stock,
nothing is planned below. The row sits in its own section and says "5 not in your typed stock: you said you already
have these." The select calls it "I have enough of this (do not count it)".

**How totals are shared out.** Needs carry the list and step they come from; a material's need carries the list and
step of the craft that asks for it. Within a line, stock is given in list order then step order, and crafts and
purchases are counted up in that order: a step's crafts = (the shortfall up to and including it ÷ yield, rounded up) −
(the same up to the step before). **Shares are a display, they decide nothing**, and a step's "leftovers" are this
display, not a second calculation. Removing something from an earlier list can move a craft from that list's share to
a later list's share, so **one list's or step's figures can rise while the character's totals stay or fall**.

**Left over.** `plan.leftover[listId]`: entries of `left` for items in `LISTS.tree` of that list. It is what a changed
way or a "Bought it" freed; it stays in the stock and other lists use it.

**Recording a craft (D26, E12).** "Made" on a craft row calls `LISTS.record` with the row's line, the number of
crafts, the quality made (the line's own by default) and, for a make line, how much of the output is credited to which
`make` wanted items (the page fills these in list order, then step order, up to each one's `qty − crafted`). It adds
crafts × yield of the product to stock in that quality (collectable for a coll line); raises `crafted` on the named
wanted items by the credited amounts, never above `qty`; and takes crafts × amount of each material **(D27, from the
W2 model test, 2026-11-22):** first from the stock the plan gave this craft's own material line, then from stock the
plan gave to no line at all (normal before high quality, high quality only when the material may be high quality);
**never from stock the plan gave to another line**; never below 0. A material it could not take that way is returned
in `short` and the page says "You recorded more than the materials typed here cover. Those materials were not taken
from what your other lists are counting on; check what you have." Recording is never refused. A `make` wanted item with `crafted` equal to `qty` needs nothing more; it is shown
as crafted and can be marked Finished.

**Finished (E19).** On a wanted item's row: sets `done`; the stock is not touched (the item is still in the bags);
undone by clearing `done`. On a step ("This step is handed in"): sets `done` on its wanted items that are not `done`
and takes out of stock **only the handed-in items themselves**: for each, the stock of that item the plan had given
its share, in the qualities given (D28, from the W2 model test, 2026-11-22: taking the materials of a craft whose
output is shared with another list raised that list's needs). Materials are never taken by a hand-in. The confirm
names the counts and says: "If you crafted any of these without pressing Made, press Made first, so what is left over
is counted." `make` wanted items are only marked `done`. Both go through undo.

**Invariants** (each a named unit test and a property of the model test):
- **E1** Same input, same plan; the input is unchanged; ties are broken as written (list order, offers, cuts).
- **E2** Per line: given + got or made + outside = need + spare. Per item and quality: stock given over its lines +
  `left` = stock typed. `spare` and `outside` are never given to a need.
- **E3** Rounding up: crafts = short ÷ yield, rounded up; 0 ≤ made − short < yield; the same for purchases.
- **E4** Raising any stock count never raises any total to get, to craft or to trade, of any line. A line whose need
  is covered by stock gives no need to anything below it.
- **E5** Removing a wanted item, or lowering its amount, never raises any total to get, to craft or to trade.
  (Totals of the character; a list's or step's share can rise, see E9.)
- **E6** A high-quality need is given high-quality stock only and is never sent to a source or offer that lacks the
  quality; a wanted item counts in exactly one part, by the precedence above; `hq`, `coll`, `make` and `crafted` stay
  on the wanted item whatever their combination and survive a list copy.
- **E7** A collectable wanted item is met only by collectable stock or a craft, and counts toward the list.
- **E8** A trade's real ratio: purchases = short ÷ what one gives, rounded up; every currency of the offer is charged
  purchases × its amount, gil as gil, the others as needs that are planned in turn; the offer is the one the rule or
  the stored choice names, whatever the amount.
- **E9** Totals do not depend on lists or steps: moving wanted items between lists and steps of one owner, or
  reordering lists, leaves every total unchanged; and for every line the shares add up exactly to its total. Shares
  carry no "never rises" promise. (The review's case holds: one high-quality X held, a merchant selling normal X
  only, X craftable; one high-quality and one normal X wanted, in one step or two: the high-quality one takes the
  stock, one normal X is bought, both times.)
- **E10** The crafting order is valid (no craft before one that makes its material), each block is one job, and
  neighbouring blocks differ in job.
- **E11** `have`: the line's shortfall equals its `outside`, it has nothing to get or craft and nothing below it, and
  no stock count is used for that shortfall.
- **E12** Recording. (a) Always: the product's stock rises by exactly crafts × yield in the quality given; each
  material's stock falls by what D27 lets it take (this line's given stock, then stock given to no line), at most
  crafts × amount; stock given to any other line is unchanged; `short` names
  exactly the materials that were not fully there; `crafted` rises by the credited amounts, never above `qty`, and the
  credits never exceed what was made; no other unit changes. (b) When `short` is empty, the crafts recorded are no
  more than the line showed, and the quality made is the line's own (any quality for a make line): that line's crafts
  fall by exactly the number recorded, and no total to get, to trade or to craft of any line rises. Other lines may
  fall, because what was made is now typed stock (one must-craft X and one ordinary X, X makes 3: recording the
  must-craft once ends both crafts). (c) When (b)'s conditions do not hold, only (a) is promised.
- **E13** Removing a wanted item and adding an equal one back (same item, recipe, amount, flags, list and step; a new
  id) leaves every total equal. Putting back the very same record, shares included, is undo's job (E20).
- **E14** Every plan ends, for every loop of crafts, of trades or of both, a self-loop included: the cut item is the
  lowest id of its loop; its parts that would pass needs down are listed under `other` with its note (a vendor,
  market, gather or have part is planned by its way, D29), passes nothing down, and is the same item whatever the
  stock and the wanted items.
- **E15** Gil: market gil = amount × price for priced items only; an unpriced item is in `gil.unknown`, never 0.
- **E16** Stock given over all lines, lists and steps of an owner never exceeds the stock typed, for every item and
  quality, whichever list is opened; the shares of stock add up to the stock given.
- **E17** With the default order and no stored ways: every normal line of an item that has a gil offer of normal
  quality is got by `vendor`, never `craft` or `gather`, and gives no need to anything below it (the same for an hq
  line and an offer marked high quality); only make and coll lines are crafts regardless. And in every plan, every
  line with a need gets it from a wanted item, a craft in the plan or a trade in the plan.
- **E18** (a) Changing an item's way from `craft` to `vendor`, `market` or `have`, or recording units with
  `LISTS.bought`: no total to craft rises, no total to get or trade of any other item rises, and no stock count
  changes except the bought item's own, which rises by exactly the units entered. The item itself moves from "to
  craft" to at most its shortfall, rounded up to what one purchase gives; gil may rise. Buying fewer units than the
  shortfall leaves the rest of the need, and everything below it for that rest, in the plan. (b) Changing it from
  `craft` to `trade`: the same, except that the offer's currencies gain needs, so the only totals that may rise are
  those of those currencies and of items in `LISTS.tree` of a currency. (c) Changing the way back, with the stock
  counts as they were, gives the earlier plan again; after a purchase or a recorded craft, changing the way back gives
  a plan in which no total is higher than before the first change. The exact earlier state, stock included, is
  restored by undo.
- **E19** Finished. A row's Finished changes no stock count; a step's Finished lowers only the stock of its wanted
  items themselves, by exactly what the plan had given them (D28), and no material's stock; after either, no total to get, to craft or to trade of any line is higher than before.
- **E20** Undo (store rule, section 7). An undo that is applied restores every unit the change replaced, byte for
  byte, and changes nothing else; an undo is applied only if every such unit is still exactly as the change wrote it;
  a refused undo changes nothing.

**Model test** `tracker/tests/lists-model.test.js`, permanent, in `npm run test:unit`, built like
`subs-model.test.js`: seeded generator, seeds 1, 2, 3, 1,000 cases each, `LISTS_MODEL_N` and `LISTS_MODEL_SEED`
override, a shrinker, under 20 seconds, the test states its invariants itself. Part A: random small game data (yields
1 to 5; several gil offers per item with different pack sizes and qualities; trades with one to three currencies, some
currencies crafted; several recipes per item; in some cases a self-loop, a loop of two crafts, a loop of two trades
and a loop of a craft and a trade), one owner with several lists and steps, wanted items with every combination of
`hq`, `coll` and `make`, random ways (`have` included), order and stock in all three qualities, and random sequences
of way changes, crafts recorded (within and beyond the plan, with and without materials), units bought (fewer, equal
and more than the shortfall), rows and steps finished, wanted items moved between lists and steps, and lists
reordered; asserts E1 to E19. Part B, tabs (real `CC.writeSection`): three tabs editing lists, each with an undo
stack; asserts LI1 to LI5, E20, that a refused write leaves the store byte-identical, that the store passes
`CC.checkDoc`, that nothing disappears unless a step removed it, that an emptied section stays a frame, and that a
store seeded above every size limit is kept whole by a write. Part C, devices (real `ET.threeWay`, `ET.applyMerge`,
`ET.saveMerge`): asserts LY0 to LY6, that a record of either device missing afterwards was removed by a step, taken as
a one-sided removal, or by an answered question, and that two devices each just under a limit merge to more than the
limit with nothing dropped. An invariant is never weakened to get a green run; a failure is escalated.

## 6. Patch change, prices, Atelier

**Patch-change rule.** A list's `data` is the stamp it was last confirmed against. When it differs from the page's
stamp: the page follows `changes` from the entry whose `from` is the list's stamp to the newest (entries chain by
`from` and `to`), and rebuilds the **old recipe table** for that stamp: today's recipes with, for every recipe id in
those entries, the old row of the earliest entry (a `gone` recipe is put back from its old row). It then works out
`LISTS.tree` of the list with the old table and with today's, and shows "Game data changed since this list was last
checked" with one line for every recipe in either tree whose row differs: "Rarefied X now needs 3 Y, was 2"; "makes 3,
was 1"; "X can no longer be crafted (it was made from A and B)", also for a material deep in the old tree; "X is now
crafted from …" for one new in the tree. Several patches in a row are compared as one step, oldest row against
today's. When the list's stamp is not in the chain (a stamp older than the first data file, or unknown), the notice
says "Game data changed since this list was last checked; the details for that version are not available." Kept,
always: every wanted item, amount, flag, step, way and stock count; nothing is rewritten. A wanted item whose recipe
is gone stays, shows "no longer in the game data" and asks for nothing. A way or offer the data no longer has falls
back to the owner's order or the usual offer on screen and stays stored. "OK, noted" writes the new stamp. A save
whose stamp is newer than this page's (written by a newer page) shows no notice. Only recipes are compared; changed
offers and nodes show through the fall-back note alone (limit).

**Shared price service** `tracker/command-center/src/prices.js` (`globalThis.PRICE`, plain script, runs in Node):
`PRICE.create({ cacheKey, triedKey, query, read, tradable })` returns `cached`, `triedLoad`, `triedSave`, `mayTry`,
`aged`, `seenAt`, `oldest`, `needed`, `settle`, `fetchPrices` and the four time limits. The rules and limits move
unchanged from `earn.js` lines 138 to 205 and 220 to 237; **exactly two lines become parameters of `create()`**: the
reply-field read in `settle` (`x.averagePrice || x.currentAveragePrice`, line 197) becomes `read(x)`, and the query
text in `fetchPrices` (`?listings=0&entries=20`, line 229) becomes `query`. `read` returns the value to store, or
`null` for "this reply holds no usable price", which `settle` records as it records an item left out of a reply.
`earn.js` creates the Submersibles service with today's values (`eveniunt-subs-prices`, `eveniunt-subs-prices-tried`,
that query, a `read` that returns the rounded average or 0 exactly as today and never `null`, and a `tradable` that
calls `E.tradable`) and assigns each function to the same `EARN.*` name; `usedMarket`, `failureNote`, `PARTIAL_NOTE`,
`unitValue` stay in `earn.js`. In Node, `earn.js` loads `../prices.js` itself when `PRICE` is missing, so
`tracker/tests/earn.test.js` runs unedited. `subs.js` is not edited (confirmed by both reviews);
`submersibles/index.html` gains one script line. Lists creates its own service: keys `eveniunt-lists-prices` and
`eveniunt-lists-prices-tried`, query `?listings=1&entries=20`, and a `read` that returns `[cheapest listing, recent
average, world, last upload]` (the reply fields the Tracker's market page already reads) or `null`. Prices live on the
device only, never in the save. Price place: `prefs.priceWorld`, else the shared place setting. One automatic attempt
per 15 minutes per place per device, and Refresh. Market prices never change which way the plan picks (D14).

**What Lists shows for a price, case by case** (unknown is never 0):

| The service holds | The row shows | In the gil total |
| --- | --- | --- |
| A cheapest listing above 0 | the price "before tax", the place, when it was fetched | counted |
| A reply with no listing, and a recent average above 0 | "No listings now; recent sales about N gil" | not counted; item under "no price" |
| A reply with no listing and no average, a price of 0, or a value that is not a positive whole number | "No market price" | not counted; item under "no price" |
| The item left out of the reply, or answered 404 | "No market data for this item" | not counted |
| The fetch failed and an earlier price is kept | the earlier price with "last seen <time>" and the failure sentence | counted, and the total says "prices seen <oldest time>" |
| The fetch failed and nothing is kept | "Price not fetched" and the failure sentence (worded for Lists: "showing no market prices") | not counted |
| A price fetched an hour ago or more | the price with its time; fetched again at the next attempt | counted, the total names the oldest time |

The total always reads "about N gil for M items; K items without a price" when K is not 0.

**Atelier hand-over.** Every craft row has "Solve in the Atelier", a link to `../atelier/#recipe=<id>`, shown only for
recipes the cross-check found in the Atelier. On load and on `hashchange` the Atelier, for a recipe it knows: sets the
job to the recipe's, the mode to recipes, calls `selectRecipe(id)`, renders, then removes the hash with
`history.replaceState`. An unknown id shows the Atelier's own message and changes nothing. The link itself writes
nothing to the shared save. (The Atelier's first visit on a device moves its old settings into the save once; the test
of the link therefore starts from a save in which that move is already recorded, `moved.atelier`.) Amounts are not
handed over (the Atelier solves one craft).

**From the Tracker (D17).** The Tracker shows every character side by side and has no "current character" (read in
`tracker/src/app/ui.js`: `groupHtml` draws one group row with one count cell per character). The group row's first
cell is itself a button that folds the group (`role="button"`, `data-fold`), so the link is **not placed inside it**:
when a group of a `craft-*` list is open, the first line under its header is a slim row of its own holding the link
"Make a list from what is missing". It is an ordinary link, reached by Tab after the header, opened by click or
Enter; the Tracker's click and key handlers return at once for it, so it never folds or ticks. It is shown only when
the Tracker runs inside the Command Center (the condition that already shows the back link), never in the downloaded
single file, and only when some character has an unticked, applicable entry in the group. Link:
`<Command Center>/lists/#from=<job 0-7>.<first recipe id of the group>&char=<cN>`; `char` is given only when the save
has exactly one character. Lists opens "From the crafting log" with job and page chosen (the page is found by that
recipe id, so an older cached Tracker still lands on the right page), and the character chosen when given; otherwise
it shows "For which character?" with each character's missing count, one tap each. Lists then removes the hash.
Nothing is saved until Create. An unknown job or recipe opens the screen unfilled.
**A list made from the crafting log** stores each entry as a wanted item with `make` (D19), because buying the item
would not complete the log entry: it is crafted even when a gil merchant sells it. No way is stored, so the same item
needed as a material, in this or any other list, still follows the character's order and is bought when a gil
merchant sells it. The player can switch "Must be crafted by me" off on the Wanted row.

**Cross-check (D2).** `tracker/tools/lists-crosscheck.js`, called by `build.js`: loads the solver glue and
WebAssembly that `restore-build-inputs.js` writes to `crafting/atelier/build/`, calls `recipe(id, 'en')` for every id
in `lists.json`, and throws on any difference in `itemId`, `job` or the ingredient list, or on a recipe the Atelier
has and the sheets lack. **Recipes the Atelier lacks are allowed**: they are listed in the data as "no hand-over",
counted in the build output, and their rows have no Atelier link. Fallback if the glue cannot run in Node: a committed
export `crafting/atelier/data/recipes-check.json` made from the built Atelier, compared by `build.js`, with a test in
`crafting/atelier/tests/atelier.test.js` that fails when the export differs from the built Atelier. The Atelier
exposes no yield, so yields are not cross-checked (limit).

## 7. Screens (page `tracker/command-center/src/lists/`)

Same family as the shell and Submersibles: the masthead and switcher, cards with the top rule, panel titles in the
display face, figures in the data face, square corners, the phone tab bar fixed at the bottom, the empty-state
treatment of `docs/submersibles-look-spec.md`. Colour by role: page, panel, text and accent from the theme; six
meaning roles with one hue in every theme, each a fill-and-text pair: craft, gather, merchant (gil merchants and other
vendors, told apart by the word), market, ready, short. A meaning is always also a word. 360 px wide without sideways
scroll; tap targets 40 px on a phone; text 4.5:1.

**A row is one line of the plan (D22)**: an item needed both in high quality and ordinary shows two rows, each with
its own way, seller or recipe, and counts; a must-craft or collectable row is marked so.

| Screen | What it holds | Empty state |
| --- | --- | --- |
| Your lists | Lists grouped by character, one card per list: name, "12 of 40 ready", steps. Buttons: New list, From the crafting log, and per character Combined view (tick that character's lists, open) | "No lists yet. Start one, or build one from the crafting-log pages you have not finished." Two buttons |
| A list, tab To get | Sections Buy from a merchant (gil), Gather, Trade for other currencies, Buy on the market, Other, Not in your typed stock, Left over; closed at first, only open sections are drawn. Row: name, "need 12, have 4", "4 held for “Other list”" when so, minus, plus, an "I have" field, "Have all", "Get it by" select, the reason ("Sold by <seller> in <zone> for 120 gil each"; "You chose this"; a loop's note), the other trades to choose from on a trade row, quality stamp, next window for a timed node ("opens 14:00 Eorzea time, in 12 min"), the price as section 6 | "Nothing left to get." |
| A list, tab To craft | Blocks by job in crafting order. Row: name, crafts and what they make, "spare: 2" when a craft makes more than is needed, "2 of 3 crafted" on a must-craft row, "Made 1", "Made all", "Bought it", "Got it another way", "Get it by" select, "Solve in the Atelier" | "Nothing left to craft." |
| A list, tab Wanted | Wanted items: amount, High quality, Collectable, "Must be crafted by me", step, "Get it by" select with its reason, Finished, Remove; "Add items" search (25 results) | "Add the first item." |
| List bar | Name, character, step tabs with each step's own share and "This step is handed in", "Hide completed" (one button), Order of ways, price place and Refresh | none |
| Order of ways sheet | "When an item can be got in several ways, <character>'s lists try them in this order:" an ordered list the player can rearrange, with the sentences below | none |
| From the crafting log | Character, job, page; "23 of 40 not ticked in the Tracker"; Create. Opened filled in from the Tracker's link | "Everything on this page is ticked." |
| Combined view | The chosen lists of one character as one list view: each row is the sum of those lists' shares | "Tick two or more lists of one character." |

**Order of ways sheet, the sentences:** "1. Buy from a merchant for gil. If an ordinary merchant sells it for gil, you
buy it, and the materials to craft it are left out." "2. Craft it." "3. Gather it." "4. Trade for it with another
currency (scrips, tomestones, seals, tokens). These are not counted as easy, so they come after crafting and
gathering unless you move them up." "5. Buy on the market board." Below: "This order is used in all of <character>'s
lists. You can change it here, or choose a way for one item on its row, at any time. Items from the crafting log, and
collectables, are always crafted."

**Combined view, settled (review).** (a) It holds lists of one character only, because stock, ways and the order of
ways belong to a character; lists of two characters cannot be ticked together, and the picker says "Each character
has its own stock." (b) It shows the ticked lists' shares of that character's whole plan: stock held for an earlier
list that is not ticked is not offered, and the row says "4 held for “Other list”" (E16). (c) "Get it by", "Bought
it" and the stock fields write the character's one way and one stock count for the item, exactly as in a single list;
there is nothing per list to disagree about.

**Changing how an item is got** (D15), the same on To get, To craft, Wanted and the combined view, at any time,
also after crafts were recorded or materials gathered:
- The "Get it by" select lists the ways the item has **in the row's quality**, plus "I have enough of this (do not
  count it)" and "Use the usual order". Choosing one sets the character's one way for the item; the other quality of
  the same item uses it too when that source has that quality, and otherwise keeps to the usual order. Must-craft and
  collectable rows have no select (they are crafted); a must-craft row has the "Must be crafted by me" switch. Under
  the select, once per screen: "This applies wherever <character> needs this item."
- "Bought it" on a craft row asks "How many did you buy?", filled with what the row still needs, in units of the item
  (not purchases), with the row's quality. It adds exactly that many to the stock. With the full amount the row and
  everything under it drop out at once; with fewer, the row stays for the rest and its materials shrink to match; with
  more, the extra shows under "Left over". It then offers, in the status line, "Buy the rest too" with the ways the
  item has (merchant, market), which sets the item's way. On a "Must be crafted by me" row it also switches that off.
  "Got it another way" does the same without the offer (a drop, a gift, a retainer).
- Materials already gathered or made for it are never taken away: they stay in the stock and show under "Left over"
  as "12 Iron Ore: no longer needed by this list. Still in your stock, and used by your other lists if they need it."
- **Undo (D16, E20).** Every such change, every "Made", "Finished" and stock edit shows "Undo" in the status line, one
  tap, for the last 20 changes of this visit, newest first. Undo puts back the exact earlier units. If any of them was
  changed since, here in a later change that was not undone, in another tab or by a sync, undo is refused: "Undo was
  not done: this was changed again since, here or on another device. Nothing was changed." and that entry is dropped.
  Switching back by hand is always possible.

**Finished.** A wanted item's "Finished": it no longer asks for anything; your stock is not changed. A step's "This
step is handed in": marks its items finished and takes what they were using out of your stock, after a confirm that
names the counts.

Wording rules: "I have", "need", "to get", "made", "bought"; no jargon. Under every stock field once per screen: "You
type what you have. This app never reads the game." Clearing an amount keeps the old amount; only Remove removes,
after a confirm. Where a step's own figures are shown: "A step's figures are its share of <character>'s plan and can
move between steps and lists; the totals for <character> never go up when you remove something."

## 8. Work items

Every builder item: a branch; only the named files plus the built copies; `npm run build` twice (the second changes
nothing) and the rebuilt copies committed; `npm run test:unit`; report what ran and what did not; never merge. Browser
checks answer Universalis with a stand-in and route `lists/data.js` to a small fixture unless the item says real data.
The fixture `tracker/tests/fixtures/lists-fixture.json` (made in W2, used by unit tests and checks) holds the owner's
case: a crafted item with three materials: one has a recipe of its own and is also sold by a gil merchant; one is sold
for another currency **and also has a recipe** (so "not traded" is a real choice between two ways); one is gathered.
It also holds an item that makes 3 per craft, a merchant offer marked high quality that is the item's fifth offer, two
gil offers "1 for 100" and "3 for 280", a trade "2 for 3 of Y and 50 gil" whose Y is crafted from 2 Z, a self-loop, a
loop of two crafts, a loop of a craft and a trade, and a page of the crafting log whose entries include an item that
is another entry's material and is sold by a gil merchant.
**Old builds in tests** are the shipped files, read with `git show <base>:<path>` where `<base>` is
`git merge-base HEAD origin/main`, never a stand-in written for the test. The checks workflow checks out one commit
only (`actions/checkout@v4` without `fetch-depth`, checked 2026-11-22), so W3 adds `fetch-depth: 0` to
`.github/workflows/checks.yml`; a test that cannot find `<base>` fails with that reason, it never skips.

- **W0 Baseline and facts (Haiku clerk). Done 2026-11-22:** build clean, unit tests 416 of 416, highest check C144;
  switcher and module counts at `check.js` lines 154, 155, 254, 767 and card counts at 296, 313, 535 to 537, 630, 769
  (W6 updates them and lists them); no `check.js` line reads "On the way" (the home page does show it, below); `site/submersibles/data.js` 62,878 bytes; `shops.json` facts
  in section 3; every `gather-*` item entry carries `it` (1,153 of 1,153). Original brief kept below. No edits. Run `npm ci && npx playwright install chromium`, `npm run build`,
  `npm run test:unit`. Report: both results; the highest check id in `check.js` (expected C144); every `check.js` line
  that counts switcher links, modules or reads "On the way"; the size of `site/submersibles/data.js`; whether
  `raw.githubusercontent.com` answers for one pinned sheet; in Teamcraft's pinned `shops.json`, the field holding how
  many items a trade gives, whether every trade lists its currencies with gil as currency 1, and any field marking an
  allied-society shop; whether `gather-*` entries of `tracker-data.json` carry `it`. Accept: the answers with file and
  line. Escalate if: a suite fails before any change.
- **W1 Data tool (Sonnet builder; after W0).** Files: `tracker/tools/lists-data.py` (new), `tracker/data/lists.json`
  (new), `tracker/data/SOURCES.md` (a "Lists" section with table, licences and stop rules),
  `tracker/tests/lists-data.test.js` (new), `package.json`. Steps: section 3, without `log` (W6 adds and checks it).
  Tests LD-1 to LD-10: every ingredient, result and currency is in `items`, and every currency has its own recipes and
  offers in the file (closure); five recipes checked by hand against the sheet rows quoted in the test (one
  multi-yield, one with a crafted material, one collectable); timed windows equal `conditions.json` wherever both hold
  the item; a trade that gives several keeps its ratio; a second run writes an identical file with empty `changes`;
  every offer has at least one currency and gil offers sort first; **LD-7** the tool's compare step, run on a copy of
  the file with one recipe row altered, one recipe removed and one existing `changes` entry, writes the earlier entry
  and a new one holding both old rows; **LD-8** the stamp matches the format and is at most 40 characters; **LD-9** the
  tool's loop check, given a table with a recipe loop, stops and writes nothing, and the real table has none;
  **LD-10** an item with more than four offers keeps every distinct one, among them a high-quality offer, and only
  exact duplicates are merged. Accept: the test passes; counts (recipes, items, gil offers, other offers) and plain
  and packed sizes in the report. Escalate if: no network; no field gives a trade's amount; the data cannot tell gil
  merchants from other-currency vendors for every offer; the real recipes hold a loop; the plain file exceeds 4 MB or
  the packed size 1.5 MB. (Allied-society vendors are not marked in the data; that is settled in section 3.)
- **W2 Engine (Sonnet builder; after W1).** Files: `tracker/command-center/src/lists/engine.js`,
  `tracker/tests/fixtures/lists-fixture.json`, `tracker/tests/lists-engine.test.js` (LE-1 to LE-19, one per engine
  invariant; replays of the eight Teamcraft faults of research section 1; **LE-R9, the owner's case** on the fixture:
  with the default order the gil-merchant material is under `shop.vendor` with its seller and price, it is in no craft
  block, none of its own materials is in the plan, and the other-currency material is crafted, not traded;
  **LE-R10**: after a recorded craft of the top item's material, switching it to `vendor` and `LISTS.bought` each
  satisfy E18(a), switching it to `trade` satisfies E18(b), `leftover` lists what was freed, and E18(c) holds in both
  its halves; **LE-R11 and LE-R12, the first review's two cases**: two lists and an item that makes 3, with every
  removal and every stock rise checked against E4 and E5 on totals, and one share shown to rise; one high-quality X
  held with a normal-only merchant, as one step and as two; **LE-R13**: a crafting-log page whose entry is also
  another entry's material; **LE-R14** loops: a self-loop, two crafts, a craft and a trade, two trades: each plan
  ends, the lowest id is cut and noted, and the cut is the same with other stock and other wanted items; **LE-R15**
  the trade "2 for 3 Y and 50 gil", 3 wanted: 2 trades, 6 Y, 100 gil, 12 Z, and the same offer at every amount;
  **LE-R16** gil offers "1 for 100" and "3 for 280", shortfall 4: four singles for 400 gil, that seller named; a
  high-quality need takes the fifth, high-quality offer; **LE-R17** recording: one must-craft X and one ordinary X
  with X making 3 (both crafts end, E12(b) holds); a must-craft amount of 3 at yield 1 through three recordings
  (`crafted` 1, 2, 3); a recording with a material short (`short` named, count 0, only E12(a)); a recording in another
  quality; **LE-R18** `have`: need 5, stock 0: `outside` 5, E2 balances, nothing below; **LE-R19** every combination
  of `hq`, `coll`, `make`, with and without a collectable recipe, counts in exactly one part; **LE-R20** bought fewer
  (need 5, makes 3, buy 2: 3 left, one craft), equal and more, in each quality; **LE-R21** row and step Finished
  (E19)), `tracker/tests/lists-model.test.js` part A, `package.json`. Accept: `npm run test:unit`; a plan for 500
  wanted items of real data under 100 ms in Node, the loop search included (figure reported). Escalate if: an
  invariant cannot hold as written (they are argued on paper only; the model test is the authority).
- **W3 ruling (orchestrator, 2026-11-22).** Two existing tests in `tracker/tests/core.test.js` used a made-up module
  named `lists` as a stand-in for "a section this build does not know" (fixture `MODS` and the R2 two-device test). No
  shipped build has ever written `modules.lists` (searched: no source writes it), so no player data has that name. The
  stand-in is renamed to `notes` in those tests, every assertion unchanged; this is the one permitted edit of existing
  tests in W3, together with the same rename in five lines of `tracker/tests/submarines.test.js` (R1 test), which the
  owner approved on 2026-11-22 after the session's permission check stopped the builder's edit. Builder choices accepted: LI5 `expect` keys are the existing unit keys (`m|` + JSON path), values the
  unit's JSON text or null; LI2's first part and LI5 also run when the stamp is equal; a wanted item missing `item` or
  `qty` is dropped, a missing `recipe` reads as 0 (never dropped for that alone); `crafted` 0 to 99999, not clamped to
  `qty`; an all-zero stock count is kept by the checker; step `name` up to 60, `n` 0 to 9999; `offer` matches
  digits.digits.digits.
- **W3 Save section and store rules (Sonnet builder; after W2).** Files: `.github/workflows/checks.yml` (`fetch-depth: 0`
  on the checkout, for the tests against shipped builds), `tracker/src/core/save.js` (`CC.checkLists`
  in `CHECK`, always the whole frame, no size limit; for `lists` the gate and LI2, LI1, LI4, LI5 in `writeSection`;
  `describeUnit` labels), `tracker/tests/core.test.js`
  (LS-1 to LS-15: checker table, including an owner without an order or with a malformed one, all six `by` values,
  every flag combination kept, `crafted`, an `offer`, and a wanted item whose `step` is not in the header kept as it
  is; round trip; **LS-3 the shipped `save.js` at `<base>`** loaded in a fresh context keeps a full lists section byte
  for byte through `CC.checkDoc` and a `CC.writeSection` of another module; LI1 for a list and for a wanted item; LI2,
  and a stale edit inside a removed list rejects with the list's text; a stored orphan stays writable; two tabs on
  different items both kept; a section with 250 lists, 2,500 wanted items in one list and 25,000 stock counts passes
  the checker and `CC.unflatModules` unchanged; **LS-11** the empty section checks to the frame, and a stale page
  writing after every list was removed elsewhere, also with the stored section deleted by hand, is refused or merged,
  never written back whole; **LS-12** a combined selection of 5,001 lists and a list with 5,001 steps pass the new
  checker and the shipped `save.js` at `<base>` unchanged; **LS-13** LI4 for a wanted item, a way and a stock count,
  the store unchanged; **LS-14** LI5: a write with `expect` succeeds when the units match and is refused whole when
  one differs; **LS-15** a real stamp from `lists.json` round-trips through the checker), model part B,
  `check.js` C145 (the three newly built apps each save and leave the lists section byte-identical; **and the Tracker
  and Atelier builds shipped at `<base>`**, written to a temporary folder with `git show` and served beside the site,
  do the same). Accept: `npm run test:unit`, `npm run test:browser`, `CHECK_ONLY=C127,C140,C145 npm run check`. Must
  not change: `CC.mergeModules`, `CC.mergeUnit`, any Submersibles rule, the gate for every other section, any existing
  test. Escalate if: an existing test changes, or `<base>` cannot be read in the check's environment.
- **W4 The lists pass in the sync (Sonnet builder; after W3).** Files: `tracker/src/core/merge.js` (the `lists`
  pass in `ET.threeWay` with LY0, LY1, LY6 and the names in `integrity`; its branch in `ET.applyMerge` and
  `ET.describeConflict`), `core.test.js` (LY-1 to LY-11: **the five cases of LY1's table**, each with Keep, Remove and
  no answer, and a second sync after each; **LY0 in both orientations** for a wanted item, a way, a stock count and a
  list header, **through the real `ET.saveMerge`** (a tab save with no answers keeps the unit) and through a full
  sync, where the question is asked again until answered and each answer does what it says; a wanted item only on the
  other side survives Keep and no answer; **the old device runs the shipped `merge.js` and `save.js` at `<base>`** in
  its own context, and the new device shows what it left as "Restored list" with nothing dropped; settle, answered and
  unanswered (LY4); two devices whose lists together pass a size limit merge with nothing dropped; **LY6**: the same
  list id and the same wanted-item id made on two devices with different times: both kept, the same new id on both
  devices, wanted items moved with their list; the labels of section 4 word for word), model part C, `check.js` C146
  (the whole-list question and a removed-against-changed question in the Settings dialog, each answer). Accept:
  `npm run test:unit`, `CHECK_ONLY=C119,C122,C146 npm run check`. Must not change: the free-company and slot passes,
  the conflict shape, the result for every unit outside `lists`, R2, R3, F-01, INT and SI tests. Escalate if: an
  existing test needs an edit, or LY4 fails.
- **W5 Shared price service (Sonnet builder; after W0).** Files: `tracker/command-center/src/prices.js` (new),
  `src/submersibles/earn.js`, `src/submersibles/index.html`, `build.js` (copy the file), `tracker/tests/prices.test.js`
  (PR-1 to PR-5: two services do not touch each other's records; the limit, freshness and settle tables for a second
  `read`; **PR-5** a `read` that returns `null` is recorded as no price and never as 0, and the Submersibles `read`
  gives byte-identical cache records to today's for the replies in `earn.test.js`). Accept: `npm run test:unit` with
  `earn.test.js` unedited; `CHECK_ONLY=C29,C113,C117,C123 npm run check` with `check.js` unedited. Must not change:
  `subs.js`, the two storage keys, any message. Escalate if: either holds not.
- **W6 Build, page shell, cross-check (Sonnet builder; after W1, W2, W5).** Files: `build.js` (the `lists/` page,
  `data.js` with `log` and the check that every `log` recipe id is in `recipes`, the budget, the cross-check call),
  `tracker/tools/lists-crosscheck.js`, `src/lists/index.html`,
  `lists.css`, `lists.js` (loads the save and data, shows Your lists and its empty state), `src/sw.js` (`lists/` in
  `PAGES`), `src/index.html` (a switcher link and a Lists card; the home page's "On the way" line, `src/index.html`
  line 83, names Lists first (checked 2026-11-22): take "Lists crafting planner" out of it; no check reads that text), `src/shell.js` (module list, the card's live
  line), `check.js` C147 (opens from the switcher, works offline after one visit, no page error, no sideways scroll at
  360 px) and the count lines W0 named. Accept: build twice; `npm run test:unit`; `npm run check` (full); the number
  of recipes without an Atelier hand-over in the report. Escalate if: the glue will not run in Node (then build the
  fallback of section 6 and say so); any recipe both hold disagrees, or the Atelier has a recipe the sheets lack; a
  `log` recipe id is missing; the budget is exceeded.
- **W7 Lists, wanted items, stock (Sonnet builder; after W3, W6).** Files: `src/lists/store.js` (pure edit functions;
  every one returns the new section and an undo entry: the units it replaced and the units it wrote; the size limits
  of section 4 live here and only here), `lists.js`, `lists.css`, `tracker/tests/lists-store.test.js` (ST-1 to ST-13:
  add, amount, cleared amount keeps the item, remove; set and clear an item's way and offer; `bought` after a recorded
  craft raises only that item's count, by the units entered; "Buy the rest too" sets the way; "Bought it" on a `make`
  row switches `make` off; ticking Collectable on a high-quality item keeps both flags stored; undo of each restores
  the section byte for byte; twenty undos in a row; no edit lowers a stock count except minus, "I have", a recorded
  craft and a step handed in; each limit refuses the edit with its line and changes nothing; a section already over a
  limit can still be edited and shrunk; **ST-11** an undo whose unit was changed since is refused and changes nothing,
  and the undo before it still works when its own units are untouched; **ST-12** recording through the store writes
  stock and `crafted` in one change and one undo restores both; **ST-13** new ids are 12 characters from the random
  source and never repeat within a section), `check.js` C148 (create, add, amounts, stock entry, cleared amount keeps
  the item, reload keeps all), C149 (two tabs: different items both kept; a stale edit inside a removed list shows the
  "Not saved" line with the list's text; a stale removal of an item the other tab changed is refused) and **C165**
  (two tabs: tab A buys 1, tab B types 10 for the same item, tab A's Undo is refused with its line and the count stays
  10; without tab B's edit the Undo works). The page writes one save at a time, as `subs.js` `write()` does. Accept:
  `npm run test:unit`, `CHECK_ONLY=C147,C148,C149,C165 npm run check`. Escalate if: the write pattern needs a store
  change beyond LI5.
- **W8 Views and choices (Sonnet builder; after W7).** Files: `lists.js`, `lists.css`, `check.js` C150 (a "get it by"
  change and a change of the order of ways move the totals at once, in every list of that character; a high-quality
  row and an ordinary row of one item each show their own way and seller), C151 (steps: each step's share, the shares
  add up to the list's totals, moving a wanted item to another step changes no total; "This step is handed in" lowers
  the stock by what the step used and no total rises), C152 (combined view: only one character's lists can be ticked;
  a subset shows "held for" an unticked earlier list and offers no stock twice; a "Get it by" change made there shows
  in the single lists too), C153 (crafting order by job, Made buttons, "2 of 3 crafted" on a must-craft row, a
  recording beyond the typed materials shows its line, Hide completed), C154 (500 wanted items: under 3,000 page
  elements with sections closed, an open section drawn in under one second), **C161** (the owner's case on the fixture
  with a new list and the untouched order: the gil-merchant material is under "Buy from a merchant (gil)" with "Sold
  by … for … gil each", is absent from To craft, none of its materials is on any tab, the other-currency material is
  crafted and not under trades; the sheet shows the five sentences; moving "Craft it" first brings the craft and its
  materials back), **C162** ("Made 1" on a craft, then "Bought it" on the same row with the full amount: the row and
  everything below it leave To craft and To get at once, no stock count fell, the gathered materials show under "Left
  over" with the sentence, "Buy the rest too" sets the way; with fewer units the row stays for the rest; "Undo" twice
  restores both steps exactly; a reload keeps what was not undone), **C163** (the "Get it by" select is present and
  works on a To get row, a To craft row, a Wanted row and a combined-view row, lists only the ways the item has in the
  row's quality, and a craft switched to bought and back shows the first plan again; "I have enough of this" moves the
  row to "Not in your typed stock" with its sentence; a looped item shows under Other with its note). Accept: those
  checks and the unit suite. Escalate if: C154 cannot hold without virtual scrolling.
- **W9 Prices, timed nodes, patch notice (Sonnet builder; after W8).** Files: `lists.js`, `lists.css`, `check.js` C155
  (prices with fetch time; failure sentence; one automatic attempt across a reload; the Submersibles record untouched;
  the plan's ways are the same with and without prices), **C166** (the seven rows of the price table of section 6,
  each with a stand-in reply: the row's words, and a total that counts only priced items and names the rest), C156
  (next window at a fixed clock), C157 (fixture with two `changes` entries in a row, one changing a recipe twice and
  one removing a material's recipe deep in the tree: the notice names each change once, oldest against today's,
  everything is kept, "OK, noted" clears it; a stamp outside the chain shows the plain sentence). Accept: those
  checks, C113 and C117 unedited. Escalate if: a reply field is missing.
- **W10 Crafting log and Atelier (Sonnet builder; after W8).** Files: `lists.js` (the screen, and reading
  `#from=…&char=…` as section 6 says), `crafting/atelier/src/atelier.js` (the hash link only),
  `crafting/atelier/tests/atelier.test.js` (starting from a save in which the Atelier's first-visit move is already
  recorded, `moved.atelier`: the link selects the recipe, clears the hash, and the save is byte-identical afterwards),
  `check.js` C158 (seeded ticks: the new list holds exactly the unticked, applicable recipes of that page, real data,
  each as a wanted item with `make` and no stored way; each is planned as a craft even when a gil merchant sells it;
  an entry that is also another entry's material is crafted once for itself and its material need is bought when a
  gil merchant sells it; opened with `#from=` and with `&char=`: job, page and character are chosen, the hash is
  removed, nothing is saved before Create; an unknown recipe id opens the screen unfilled) and C159 (the link opens
  the built Atelier on that recipe; a recipe without a hand-over has no link). Ticks are read with the Tracker's own
  reader in `site/core/`. Accept: unit, browser and those checks. Escalate if: reading ticks needs a core change.
- **W11 Look and phone pass (Sonnet builder; after W9, W10).** Files: `lists.css`, `tracker/tests/lists-look.test.js`
  (the six roles at 4.5:1 in all 21 themes, both modes; no colour in a rule outside the token block), `check.js` C160
  (every colour on a pictured screen is a role) and evidence block `L2` (each screen at 1440 px light and 360 px dark,
  the Order of ways sheet and a list with a "Left over" line included: `evidence/lists-*.png`). Accept: full
  `npm run build`, `test:unit`, `test:browser`, `check`. Escalate if: a role cannot reach its ratio by lightness alone.
- **W12 The Tracker's link (Sonnet builder; after W10).** Read first: `tracker/src/app/ui.js` (`groupHtml`,
  `renderLedger`, the click and key handling of `data-fold` and `data-gc`, the code that adds the back link `.cc-back`
  and its `home` address) and `tracker/tests/ui.test.js`. Files: `tracker/src/app/ui.js`, `tracker/src/app/tracker.css`
  (one rule), `tracker/tests/ui.test.js`, `check.js` **C164**. Steps: in `groupHtml`, for a list whose id starts
  `craft-`, when the group is open, the back link's condition holds and at least one character has an unticked,
  applicable entry in the group, add **after the header row and outside its fold cell** one row
  `<div class="lr mk"><a class="mk-list" data-mklist href="…">Make a list from what is missing</a></div>` with the
  link of section 6; the click handler and the key handler return at once when the event comes from `[data-mklist]`.
  Unit-level tests in `ui.test.js` (the Tracker's browser tests): TL-1 the link is on open crafting-log groups only,
  not in the downloaded file's mode, and is not inside any element with `role="button"`; TL-2 its address carries the
  job and the group's first recipe id, and `char` only with one character; TL-3 a mouse click on it neither folds the
  group nor ticks anything, and the save is byte-identical afterwards; TL-4 a fully ticked group has no link; **TL-5**
  by keyboard: Tab reaches the link after the group header, Enter follows it without folding, and Enter and Space on
  the header still fold and unfold as before. C164 (built site, seeded ticks, two characters): the link opens Lists on
  that job and page, "For which character?" shows both counts, Create makes the list of exactly the missing recipes;
  with one character the character is already chosen. **The Tracker is a separate built app**: `npm run build`
  rewrites `tracker/dist/eveniunt-tracker.html`, `tracker/site/` and their worker file; they are committed with the
  source, and the first build run reports them as different by design. Accept: build twice, `npm run test:unit`,
  `npm run test:browser`, `CHECK_ONLY=C158,C164 npm run check`. Must not change: the group header row and its fold and
  count cells (`data-fold`, `data-gc`, `data-gk`, their titles and what a click or key does), `ET` core files,
  `save.js`, the Tracker's save, every existing `ui.test.js` test, the row layout at 360 px (no sideways scroll).
  Escalate if: an existing test needs an edit; the extra row disturbs the ledger's column layout; the Tracker cannot
  tell that it runs inside the Command Center without new stored state.
- **W13 Records (Haiku clerk; after W11, W12).** Files: `docs/STATE.md` (an entry under "Built, waiting for the
  owner's `ship`"; section 10 under "Known limits"), `tracker/command-center/README.md`, `tracker/NOTICE.md` (Lists
  credits). Accept: only those files change; no personal data. Escalate if: a layout changed.

## 9. Risks, and the first thing to verify

- **First: W1's first run.** The sheets and Teamcraft files are not in the repository. On 2026-11-21 the planning
  session's environment reached `raw.githubusercontent.com` (HTTP 200), so the data can be fetched there; W0 still
  confirms it for the build session. `universalis.app` was not reachable from that environment, which is why every
  browser check answers prices with a stand-in.
- **Gil merchants must be told apart from other vendors by the data** (D14). If W0 or W1 finds they cannot be, the
  owner's first requirement cannot be met honestly and the work stops there for a decision.
- **Q4 is answered** (section 11): option A, one way per item per character, as W2, W3, W7 and W8 build it.
- **The data budget is not measured** and keeping every offer and every currency's own recipes makes the file larger
  than first planned. W1 reports plain and packed sizes on its first run; above the budget it stops and the trimming
  is a decision, not a silent step.
- The cross-check may find the Atelier's solver data on another game version than the sheets; then the build stops by
  design and the owner is told (not decided here).
- The invariants of section 5 are argued on paper only, by one planner, one same-family reviewer and two outside
  reviewers; the model test is the authority, and W2 reports any that fails instead of bending it.
- `save.js` and `merge.js` change, now also the write gate and the unanswered result for `lists` units: one builder at
  a time, all three apps rebuilt, C127 and C140 rerun, and W4's tests pin that nothing outside `lists` changes.
- Allied-society vendors are not marked in the pinned data (W0); settled in section 3: their token offers are `trade`.
- Adding a switcher link may break checks that count links (W0 lists them).
- W12 adds a row to the Tracker's most used table; its tests pin that folding and ticking are untouched.
- Tests against shipped builds need `origin/main` in the checkout; W3 adds `fetch-depth: 0` to the checks workflow.

## 10. Known limits (as designed)

- Stock is typed by hand. Retainers, alts and the free-company chest are whatever the player types.
- One way per item per character (D12): an item cannot be crafted for one list and bought for another at the same
  time, except that crafting-log entries are always crafted. Moving a list to another character puts it under that
  character's stock, ways and order.
- What a craft or purchase gives beyond the need ("spare") is shown but not planned with: once it is recorded it is
  typed stock and everything uses it. So before a multi-yield craft is recorded, another need of the same item (in
  another quality, or as a must-craft entry) can look larger than it will be.
- **The character's totals never rise from a removal or from more stock; one list's or one step's own figures can**,
  because a craft can move from one list's share to the next.
- Collectables and crafting-log entries are always planned as crafts, even if a merchant sells the item: the merchant
  data does not say whether what it sells is a collectable. Collectability ratings are not tracked.
- "I have enough of this" is the player's word; the amount is shown as not in the typed stock and is not checked.
- Recording a craft the typed materials do not cover is allowed; the counts go to 0 and the page asks the player to
  check them.
- An item that is part of a loop (it needs something that needs it) is listed under Other and not planned further.
- Yields are not cross-checked (the Atelier holds none). Market price is the cheapest listing of any quality, before
  tax, from community reports; it is not split by world (that is Market).
- "Buy from a merchant first" looks only at whether a gil merchant sells the item, not at the price: an expensive
  merchant item is still planned as bought, with its price on the row and "Craft it instead" one tap away. The data
  does not say whether a merchant needs a quest or a housing plot to reach, and does not mark allied-society NPCs, so a
  gil offer that needs allied reputation is planned like any merchant; the row names the seller and place, and a Grand
  Company rank when the data gives one.
- A trade is chosen by a fixed rule, not by cost for the amount; the row lists the other trades to choose from.
- A high-quality need goes to a merchant only for an offer marked high quality; whether a given market listing is high quality is not checked.
- The patch notice compares recipes only, and only as far back as the first data file this app shipped.
- Undo covers the last 20 changes of one visit, is gone after a reload, and is refused when the same thing was changed
  again since; a way can always be changed back by hand.
- "Left over" lists unused stock of items in this list's tree; it cannot know why the stock is there.
- The same unit changed in two tabs: the later save wins. A stock count changed on two devices is asked.
- Sync questions about Lists name the list and the character but show items by number, because Settings does not hold
  the item names.
- Size limits stop new entries on a device; a sync can still bring a save above them, and nothing is dropped.
- A device still on the old version syncs lists unit by unit and by the old rules, so it can leave a kept list empty,
  an entry without its list, or delete on its own side what the other device changed; the new page shows entries
  without a list as "Restored list". This ends when every device has updated.
- The Tracker's link appears only inside the Command Center and only in an open group, and with several characters
  the character is chosen in Lists, because the Tracker has no current character.
- Timed nodes show the next window only; alarms belong to the Gathering module. Fishing windows are not shown.
- Sources other than merchant, craft, gather, trade and market (drops, quests, desynthesis, reduction) are "Other": to
  get, your own way. Sharing a list by link or file is a later phase.

## 11. Owner decisions (2026-11-22)

- **Q1, what I have: once per character (option A).** One stock per character that all of that character's lists draw
  on, in the order the lists are put in; a list says how many are held for another list. Lists without a character
  share one stock of their own.
- **Q2, the same item's count changed on two devices: ask (option A, things as they are).** The sync asks which count
  is right, as for every other clash. Nothing is added up or picked silently.
- **Q3, a button in the Tracker: yes (option B).** The Tracker's crafting-log pages get "Make a list from what is
  missing", which opens Lists with the job and page chosen, and the character when there is only one (work item W12).
  The list can still be made from the Lists page.
- **New requirement 1: buy from a merchant for gil first**, at every level, with other-currency vendors after crafting
  and gathering unless the player moves them up (D14, E17, C161).
- **New requirement 2: how an item is got can be changed at any time, from every row**, with a one-tap "Bought it",
  nothing gathered lost, and one-tap undo (D15, D16, E18, E20, C162, C163, C165).

**Q4 (answered 2026-11-22: option A). When a character has several lists, is "how I get this item" chosen once for the character, or
separately in each list?** Your decision of 2026-11-21 spoke of settings per list. Once all of a character's lists
share one stock (Q1), settings per list can make the numbers go up when you remove something, so the plan needs one of
the following. Both outside reviewers recommend A.
- **A. Once per character (recommended; the owner's choice).** What happens: if you say "I buy
  Iron Ingots", that holds in all of that character's lists, and the order of ways (merchant first, then craft, …) is
  set once per character. What it improves: removing an item or typing more stock can never make any of the
  character's totals go up, that is, what the character has to get, craft or trade over all lists together; "Bought
  it" is said once. What it does not promise: the figures shown for one list or one step are that list's share of the
  whole, and a share can go up when a sister list changes (the craft that list was counting on is now counted here).
  What it costs: nothing extra to build. What you give up: you cannot craft an item for one list and buy the same item
  for another list at the same moment (crafting-log entries are still always crafted). Risk left: the share shifts
  just described. How sure: fairly; worked through on paper by four readers and to be proved by the permanent test.
- **B. Separately in each list.** What happens: each list keeps its own choices and its own order; lists share only
  the stock you typed, handed out in list order; what one list crafts beyond its need is not passed to another list
  until you record the craft. What it improves: each list can be planned its own way. What it costs: about one more
  builder item and a different save layout; best decided before the save work starts. What you give up: totals are
  sometimes higher than needed (one list shows 2 spare while another tells you to buy 2 of the same item). Risk left:
  whether the "totals never go up" promise can be kept was not worked through in this plan. How sure: medium.
- **C. Keep the plan as it was written before the reviews:** choices per list, and what one list crafts beyond its
  need is passed on to the others. Costs nothing to write. Risk left: removing an item from one list, or typing that
  you hold one more, can make the character's totals go up (another list is told to buy more); that is the kind of
  wrong total this module is meant to end, and no test can promise otherwise. How sure: certain, a reviewer gave a
  worked example.
- Recommendation: A.

Escalations that would return to the owner are named in section 9.

## 12. What was read, and what was not verified

Read: `CLAUDE.md`, `docs/STATE.md`, `docs/model-tiers.md`, `docs/lists-research.md`, `tracker/src/core/save.js`,
`merge.js`, the two Submersibles save specs, `docs/submersibles-look-spec.md` (sections 1 to 6 and R1),
`tracker/command-center/build.js`, `restore-build-inputs.js`, `src/shell.js`, `src/index.html`, `src/sw.js`,
`src/submersibles/earn.js` and the price calls of `subs.js`, the market part of `tracker/src/app/live.js`,
`tracker/data/SOURCES.md`, parts of `tracker/tools/extract.py` and `info.py`, `crafting/atelier/tools/prepare-data.py`,
the recipe functions of `crafting/atelier/bridge/src/lib.rs`, `selectRecipe` in `atelier.js`, `package.json`; for the
revision, in `tracker/src/app/ui.js` the functions `groupHtml`, `setView`, `renderSection`, `renderLedger` and the
lines that read the address and add the back link, and a search of `tracker/tests/ui.test.js`.
Verified by W0 on 2026-11-22: the fields of `shops.json` (section 3), the switcher and card counts in `check.js`,
the size of the Submersibles data file, and that the pinned sheets and Teamcraft files can be fetched. Not verified:
the size of the Lists data file; that the solver glue runs in Node; that the Atelier's data and the sheets are the same
game version; the shape of the Tracker's tick section (W10
reads it through the Tracker's code); that `ui.test.js` has no test of the group row's markup (a search for its selectors
found none); the Universalis reply fields beyond those `live.js` and `earn.js` already read; the planning background
in the private workspace was not opened. The "On the way" question is settled: the home page has
the line (`src/index.html` line 83), no check reads it (orchestrator, 2026-11-22).
For revision 4: both outside reviews were read in full, and `ET.saveMerge` in `tracker/src/core/storage.js` (lines 98
to 114) was read to place LY0. Taken from the reviews and the orchestrator's checks, not re-read by the planner: the
Tracker's click handler lines, the Atelier's first-visit move and its `moved.atelier` marker, the write gate at
`save.js` line 460 (read in revision 1 as part of the file), and the exact `earn.js` lines 197 and 229. Nothing was
run. Argued on paper only and left to W2's and W4's tests: that the cuts of D24 keep E4 and E5; that a fixed trade
offer keeps E5; E12(b); E19; that LY6's renaming settles on both devices; that the lists branch in `ET.applyMerge`
leaves every other section's result as it is.
