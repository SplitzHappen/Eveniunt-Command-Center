# Lists: red team and pre-mortem before shipping (2026-11-23)

Asked for by the owner before the ship request: "run a red-team and pre-mortem analysis iteratively on the lists module
and destroy it based on how people use teamcraft and how you know i work and then see what significant improvements
you can find. Include aesthetics to this process as well, not just capabilities." Candidate: branch
`claude/blissful-fermat-hrrqp5` at `2fe6f85`. All reviewers were Claude (same family as the builders), none of them
built Lists; this is not an independent audit.

## Round 1: three attacks

- **Workflow red team** (how players use Teamcraft lists, and how the owner plays), with runs of the engine on the real
  data: a 7-piece crafted gear set, the first five Carpenter log pages, the whole Carpenter log, currencies.
- **Look red team** (every built screen against `docs/design-rules.md`, the approved mock-ups and Submersibles), with its
  own probe: 7 themes, widths 360 to 1920, long names, 40 items, 8 characters, 12 lists.
- **Pre-mortem** ("it is three months later and Lists failed: why?"), with the unit suite run (597 of 597) and the
  engine on the real data.

### Findings, merged and ranked

Correctness and trust (a player would stop believing the plan):
1. **Currencies are planned as market-board purchases.** The market test is "not untradable" (`lists-data.py:294`,
   `engine.js:125`); 34 to 39 of the ~118 currencies (tomestones, every scrip, Grand Company seals, MGP, Skybuilders'
   Scrip, allied-society tokens) get "Buy on the market". A gear-set run plans 960 Mathematics tomestones and 3,900
   Orange Gatherers' Scrips on the market; the screenshots show 240 Skybuilders' Scrips "bought on the market board"
   (240 of the "307 to get"). All three reviewers.
2. **Gathering reads two tables that disagree.** The engine still reads the old one-spot `gather` (passed from
   `gatherLegacy`) while rows show `spots`: level or zone differ for 680 of 785 items, 358 levels and 32 jobs differ;
   six clusters' merged hours cover the whole day, so the row always says "open now" while the shown spot's window
   lasts minutes; 17 timed-only items show no window at rest. Workflow and pre-mortem.
3. **High-quality intermediates cannot be planned.** The engine and store support `ways.hq`, but no control sets it; a
   gear set plans 9 HQ-able intermediates as normal quality. For expert crafts through the Atelier this makes the plan
   wrong. Workflow.
4. **Master book, expert, specialist and stars are never shown, and the crafter level is never checked** (3,459
   master-book and 544 expert recipes). All 7 gear pieces in the run are master-book 4-star recipes. Workflow.

Workflows the owner and Teamcraft users rely on:
5. **Gathering is not a route.** Rows are in item order: a gear set's 22 gather rows cross 11 zones with 15 zone changes.
   Teamcraft groups by zone. Workflow.
6. **Crystals swamp Gather.** 258 of 402 gather units in the gear set are crystals or clusters, 210 clusters sent to
   timed nodes. Workflow.
7. **Vendor buying sends the player across the map.** Each gil item keeps one seller (the lowest NPC id): the first five
   Carpenter pages give 41 vendor rows from 10 sellers in 7 zones with 33 seller changes. Workflow.
8. **Free Company workshop projects are absent.** No submarine or airship part is in the data (searching "-class" finds
   nothing); "... Component Materials" land under Other. The owner runs submarines and crafts their parts. Workflow and
   pre-mortem.
9. **The crafting log works one page at a time** (862 pages; Carpenter alone 117). Workflow.
10. **"Made" never ticks the Tracker's crafting log,** so a completionist records every craft twice. Pre-mortem.
11. **Sources are missing:** 860 of 2,417 raw ingredients are market-only (monster drops) and 236 are "Other". Workflow.
12. **No sharing, export, import or "copy item name"** (research section 8 promised share by link or file). Workflow.
13. **Adding a gear set costs about 40 actions;** no gear-set import. Workflow.

Look and feel:
14. **The count block's slash covers the first letter of the name** on 3–4-line phone rows; names sit on the rule. Look.
15. **The ellipsis hides the answer** on phones and at 768–1024 (seller, spot and aetheryte, window, craft level), while
    1440 rows leave ~350 px empty. Look and workflow.
16. **Job icons are 10–16 px one-colour shapes with no visible name;** Fisher, Botanist and Carpenter look alike; a row
    with 8 crafters is 8 unlabelled blobs. Look.
17. **A one-entry bottom bar** ("LISTS 3") is the loudest thing on three phone screens and does nothing. Look.
18. **"Combined view" on every character,** even with one list; zebra striping at 8 characters. Look.
19. **The Restored list card:** bare-text primary, an open select at rest, the slash grows into a triangle. Look.
20. **A long list name wraps the head** to 2 lines at 1440 and 6 at 360 (first row ~350 px down). Look.
21. **Smaller:** the right third at 1440 is a grid of identical boxes (stepper and "Have all"); content stops at 1340 px
    at 1920; section heads count items while the head counts units, unlabelled; "(ordinary)" on every Wanted row;
    "Had all of Ramie Thread."; Order of ways repeats itself; "North-America" is the service's key; no thousands
    separator ("2856 gil"); "Hide completed" has no On/Off word; default select arrows and bullets; "Earlier changes"
    opens below the line; the closed patch notice takes 2 lines on a phone; the gather drawer folds after 2 spots. Look.

Durability (what makes it fail later):
22. **The first game patch freezes it.** Data pinned at 7.57h1 with a hard-coded recipe count; the build stops when the
    Tracker, Atelier and Lists data disagree, and there are no written refresh steps. Pre-mortem.
23. **Sync questions name items by number** ("the amount Tamsin has of item 5056"). Pre-mortem.
24. **The page copies the engine's rules** (`waysOf`/`offersFor` against `engine.js`), so they can drift apart;
    `lists.js` is 121 KB and `check.js` 897 KB. Pre-mortem.
25. **Checks depend on time:** 46 fixed waits and 11 real-clock reads in the Lists checks, the clock controlled only 3
    times. Pre-mortem.
26. **A patch can change a plan silently:** the change notice compares recipes only, not offers or nodes. Pre-mortem.
27. **Speed at scale:** a whole-job log list takes seconds to plan, on every stepper tap. Workflow.

What every reviewer said holds up: the save design and its refusals, the pure engine with its randomized model test,
gil merchants first, every crafter shown, "Bought it" on every craft row, spots with coordinates and aetheryte, the dark
list head with its tallies, the solid section heads over one ledger, the count block, the slim status line, the empty
state and the sheet form.

## Round 1 proposal (for round 2 to attack)

**Before shipping (A):**
- A1 A real "can be sold on the market board" flag (the game's `ItemSearchCategory` above 0) and a **"Currencies to
  earn"** section for tomestones, scrips, seals, tokens and MGP, counted apart from what to get and buy (finding 1).
- A2 **One gathering table:** the engine reads `spots`; `gatherLegacy` is removed; the row's window, level, zone and the
  drawer's text all come from the shown spot (2).
- A3 **High quality:** a "Need it in high quality" choice in the drawer of every HQ-able intermediate and a list setting
  "High-quality materials for every craft" (3); **recipe stamps** (master book with its name, expert, specialist, stars)
  and a **level warning** from the Tracker's job levels (4).
- A4 **Gathering as a route:** the Gather section grouped by zone, then aetheryte, timed nodes by next window (5);
  **Crystals** as their own section (6).
- A5 **Vendors grouped by city and seller,** every seller kept, the seller chosen to share a place with the rest (7).
- A6 **"Made" offers to tick the Tracker's crafting-log entry** (10).
- A7 **Look fixes:** 14 to 21, with icons at the spec's sizes and the job's game abbreviation under each, and every
  crafter still shown.
- A8 **Durability:** a written data-refresh checklist with a test that the Tracker, Atelier and Lists data pins match,
  and the data version shown on the page (22); item names in sync questions (23); the page uses the engine's own way
  rules (24); the page clock controlled in every Lists check and waits on page state, not time (25).

**After shipping (B), in order of value to the owner:** B1 Free Company workshop projects with a step per phase (8);
B2 several crafting-log pages or a whole job up to a level in one list (9); B3 copy item names, and share or export a
list as a file or link (12); B4 source hints for drops, ventures, desynthesis and reduction (11); B5 gear-set import
(13); B6 the change notice also for offers and nodes (26); B7 planning off the page's main thread for huge lists (27);
B8 the Lists checks in their own file (24).

## Round 2: the proposal attacked

A fresh reviewer (not in round 1, not a builder) checked each proposal against the code, `lists.json` and the pinned game
sheets (`Item`, `CompanyCraftSequence`, `CompanyCraftPart`, `CompanyCraftProcess`, `CompanyCraftSupplyItem`, `Recipe`,
`SecretRecipeBook`). Same family. Verdicts:

- **A1 keep, sharpened.** The game's market-board category (`ItemSearchCategory` above 0) removes the 33 tradable
  currencies wrongly marked as market items; six real market items (Fire Shard, potions) stay. But 183 items are tradable
  and not on the market board (Skybuilders' crafts among them), so "Currencies to earn" means "used as a non-gil price in a
  trade and not on the market board", shown as a display group of the existing "other" way; the engine's rules stay.
- **A2 changed.** The engine keeps reading "has a gather source"; `build.js` builds that table from the spot table, and one
  shared "chosen spot" function feeds the row's window, level and zone, the drawer and the route grouping.
- **A3 changed.** The per-item "Need it in high quality" choice stays (it uses `ways.hq`, already saved). The per-list
  setting becomes a one-step bulk action with undo (a per-list setting would break the per-character rule and need a new
  save field). **The level warning's premise was wrong:** the Tracker holds no job levels (the only levels are the
  Atelier's per-job stats, which read 100 when never typed). Use the Tracker's "Master Crafting Books" ticks instead: its
  110 entries match the game's book names, so a row can warn "Master Carpenter IV not ticked for this character". Book
  names go in a separate data table, not inside the recipe rows (which would flag every recipe as changed).
- **A4 changed.** Grouping by zone still hops zones when each item shows its lowest-level spot (the owner's rule D-G1);
  choosing spots in zones already on the route changes that rule, so it is an owner decision. Timed nodes are reordered
  only when the page redraws, not every 15 seconds. Crystals section kept.
- **A5 changed.** The planner's seller must not depend on the other items (that breaks a core rule); keep the planned
  offer, add a sellers table, and choose among equal-price sellers on the page for display only.
- **A6 moved to after shipping.** Ticking the Tracker's log means a second, separate save write; undo and the Tracker's
  linked ticks would need a design first.
- **A7 changed.** Keep 14, 15, 16, 17 and 20, within the 96 px phone row; 18, 19 and the small items of 21 after shipping.
- **A8 changed.** Keep the data-pin test, written refresh steps, the data version on the page, item names in sync questions
  (a name lookup passed from the Command Center, number elsewhere); 24 only as a small switch to the engine's own way rule;
  25 after shipping.
- **Moved before shipping:** "copy item name" (tiny; the owner looks items up in game).
- **B1 is cheaper than assumed:** the company-craft sheets give all 40 submarine parts with their phases, supply items and
  quantities; each phase can be a step, with no engine or save change.
- **Missing, added:** a gil vendor locked behind a reputation rank still says "buy" (only the Grand Company rank is kept;
  not verified further); a stored "market" way for a currency becomes "earn", and the row must say why.

**Final "before shipping" set, in order:** A1; A2 with the shared chosen-spot function; A3 trimmed (high-quality choice and
bulk action, recipe stamps, the master-book warning); A4; A5 for display only; copy item name; A7's core five; A8 trimmed.
**Main risk:** the set touches the data shape, every To get section and `save.js` at once; many checks need reach edits
and may flake, so the cycle runs long; the `save.js` label change rebuilds all three modules.

## Owner's answers (2026-11-23) and the build plan

**Answers:** 1A — a gather row shows the spot in a zone the list already visits for other items, falling back to the
lowest level; the row says why it chose it, and every spot stays listed (this changes decision D-G1's "lowest level
first"). 2B — submarine parts are built before shipping. Plan written by the orchestrator (the planning tier's model was
over its limit); same family.

Every item: only its named files plus rebuilt copies; `engine.js` changes only where an item says so, keeping every
invariant (the model test passes unweakened); existing checks get reach edits only (no assertion changes) unless an item
names the assertion; each new test is seen failing without its part; `npm run build` twice, unit, browser, full check;
appearance measured against `docs/design-rules.md` (and `DR1` stays green); screenshots looked at.

- **R1 Data (builder).** `lists-data.py`, `lists.json`, `SOURCES.md`, `lists-data.test.js`. (a) `market` flag from the
  game's `Item.ItemSearchCategory` above 0 (replaces "not untradable" for the market way); (b) `currencies`: items used as a
  non-gil price in a kept trade and not on the market board; (c) `sellers: { item: [[npc, price]…] }` for every gil seller
  (the planned offer stays as today); (d) `books: { recipe: bookItem }` and `bookNames` from `Recipe.SecretRecipeBook` and
  `SecretRecipeBook` (a separate table, so recipe rows do not change); (e) `projects`: the company-craft sheets
  (`CompanyCraftSequence`, `CompanyCraftPart`, `CompanyCraftProcess`, `CompanyCraftSupplyItem`) for every submarine part
  (all 40) and airship part: result item, parts, phases in order, each phase's supply items with amount per set and sets;
  supply items closed into the data (their recipes, offers, spots); a stop rule if a part's phases cannot be read. Tests:
  no currency has the market way and the six real market items keep it; a seller table entry for an item with several
  sellers; one master-book recipe with its book name quoted from the sheet; one submarine part with its phases quoted.
- **R2 Gathering engine input and the chosen spot (builder).** `build.js` builds the engine's `gather` table from
  `spots` (the engine keeps reading "has a gather source"); `gatherLegacy` removed with LD-3 re-pointed to the new shape
  (equivalent assertions); one shared `chosenSpot(item, plan)` used by the row's window, level and zone, the drawer and
  grouping: among the item's spots, prefer one in a zone that other gather rows of the same plan already use (most rows
  first), then lowest level, then nearest aetheryte, then lowest id; deterministic for a given plan. Tests: an item whose
  lowest spot is elsewhere but another spot is in the route's zone shows the route spot and says why; windows come from
  the shown spot.
- **R3 Page: currencies, high quality, books, crystals, vendors, copy (builder).** (a) "Currencies to earn" section (a
  display group of the existing "other" way for `currencies`), counted apart from "to get"; a stored market way for a
  currency shows "This is a currency: it is earned, not bought"; (b) the drawer's "Need it in high quality" on HQ-able
  materials (`ways.hq`) and a list-level bulk action "High quality for every material" with one undo; (c) stamps: master
  book (its name), expert, specialist, stars; a warning on the row when the Tracker's "Master Crafting Books" entry for
  that book is not ticked for the list's character ("Master Carpenter IV is not ticked for Tamsin Reed"), read through the
  Tracker's own reader as W10 does; (d) Crystals as their own section (shards, crystals, clusters), before Gather;
  (e) Gather grouped by zone, then aetheryte, with timed nodes ordered by next window, reordered only on redraw; (f) Vendor
  section grouped by city and seller; among equal-price sellers the page shows the one in a place the list already
  visits; (g) "Copy name" on every row (clipboard, with the status line saying "Copied").
- **R4 Submarine and airship parts (builder; needs R1).** Search finds project results ("Shark-class Bow"); adding one
  makes a list with one step per phase, each phase's supply items as wanted items (amount × sets), and the plan works as
  for any list; the steps carry the phase names; a test with one real submarine part (its phases and amounts from the
  sheet) and a browser check.
- **R5 Look fixes (builder).** From the look red team: 14 the count block's slash never covers the name (fixed height,
  padding); 15 no answer hidden by an ellipsis: on a phone "need N, have N" is dropped (the count block says it), spot and
  window get their own line within the 96 px row, and the stepper hides between 701 and 1100 px; 16 job icons at the
  spec's 20/24/32 px with the game abbreviation (CRP, BSM, ARM, GSM, LTW, WVR, ALC, CUL, MIN, BTN, FSH) under each, every
  crafter still shown; 17 no bottom bar or rail when there is one entry; 20 a long list name ellipsizes (two lines at most
  on a phone) with the full name on hover and in the sheet; plus thousands separators in gil amounts.
- **R6 Patch safety and sync names (builder).** A written refresh checklist in `tracker/data/SOURCES.md` (which tools,
  in which order, for the Tracker, Atelier and Lists data); a unit test that the game-data pins of the three match; the
  data version on the Lists page (list head state line); item names in sync questions: `save.js` labels take a name
  lookup passed by the Command Center and fall back to the number elsewhere (all three modules rebuilt); the page uses
  the engine's own way rule instead of its copy (`waysOf`/`offersFor`), behaviour unchanged.
- **R7 Pictures, records, and the ship request (builder, then orchestrator).** Every screen retaken at 1440 light and 360
  dark, looked at beside the approved mock-ups; `DR1` green; records in `docs/STATE.md`; then the pull request.

After shipping, in order: "Made" ticks the Tracker's log (needs a design: two save sections and undo); several log pages
or a whole job in one list; share and export; source hints for drops, ventures, desynthesis and reduction; gear-set
import; the change notice for offers and nodes; planning off the main thread for huge lists; the Lists checks in their
own file; the remaining small look items (18, 19, 21) and the clock-controlled checks.
