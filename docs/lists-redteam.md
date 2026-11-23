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

## Round 2

(Written after the second attack.)
