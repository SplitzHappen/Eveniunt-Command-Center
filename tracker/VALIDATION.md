# Validation — Eveniunt Tracker

Date: 2026-11-08. Data: `xivapi/ffxiv-datamining` @ `44948e4c` (7.57h1), FFXIV Teamcraft @ `c1ede0a0`, FFXIV Collect snapshot 2026-11-07, FFXIV 100% Completion Checklist 7.45 (see `data/SOURCES.md`).

## Automated tests

| Suite | Result | What it checks |
| --- | --- | --- |
| `node --test tests/core.test.js` | 50 / 50 pass | characters 1–8; totals; the ✕ switch both ways; ticks on uncounted entries kept but not added; group ticking; per-character “does not apply”; level values (cap ticks, desynthesis recorded only); backup file and transfer code round trips; three-way merge and conflicts; FFXIV Collect refresh (first run asks, later gains apply, clashes ask, private profiles, no connection); Google Drive sync against a simulated Drive; desktop-app import (game ids, positions, X marks, levels, master books never read as recipe ids); **red-team cases**: crafted backups (prototype keys, markup in names, cities, levels, keys), huge or malformed transfer codes, levels of a removed character, Lodestone addresses, merged-entry ticks moving over, and cloud sync with a damaged copy, a large removal, a simultaneous write and odd ids in the cloud file; **links**: built for this data and refused for other data, the main story from "The Ultimate Weapon" down to the character's own city and company quests only, achievement and title both ways, quest and aether current both ways, Freebird only after the last current, the gold-rating switch, level achievements, never ticking what does not apply; achievement tiers, Dawntrail relic stages, Grand Company rank and officer quest, a checked desktop-app link (Firebird quest and the lanners) |
| `node --test tests/ui.test.js` | 23 / 23 pass | the built file from `file://` with every network request blocked: first run with 8 characters; lists open with every group closed (Open all, Close all, find opens matches); a tick follows its links with an Undo message and explains them in the details, the switch turns links off, and Settings fills in what existing ticks prove (preview and Undo); click marks done, right-click and press-and-hold mark “does not apply”, a second click clears either; ticking, ✕ both ways and “does not apply” update the tallies and survive a reload; group ticks; level fields; every list renders and every list over 60 entries is grouped; search; the menu is Character, Duty, Logs, Travel, Social; desktop-app import through the interface; transfer code between two browsers; phone width 390 px with no sideways scroll; **all 21 themes in light and dark** (the Atelier's 20 plus Solution Nine) (text contrast ≥ 7, accent ≥ 3, dropdowns ≥ 7, themes listed alphabetically, wordmark coloured by the theme); data counts; the **hosted site over HTTP** (manifest, service worker, offline reload keeps the characters, no cross-origin isolation so Google sign-in can open); **red-team cases**: a crafted backup loaded through the page runs no script, the first-run window cannot be dismissed, unreadable saved data is offered for download and kept, and two windows of the tracker never overwrite each other |

## Starting city and Grand Company

138 quests can only be reached from one starting city (Limsa Lominsa 46, Gridania 42, Ul'dah 50; with 3 achievements and 3 levequests, 144 city entries), found by following the game's quest prerequisites from each city's first quest; per-class variants of the same opening quest are one entry (5 merges). Checked against the owner's saves: the X marks the desktop app sets from each character's starting class fall exactly on the other two cities' quests. 30 Grand Company quests (game field, company-named variants, officer quests), the Grand Company hunting logs and ranks follow the character's company. Tests: core (`notApplicable`, totals, inference from X marks) and browser (setup with classes, greyed boxes, explanation on click).

## Data counts

145 lists, 43,944 entries (78 from the game sheets with community labels, 39 from the checklist workbook, of which 325 entries were added after the workbook's 7.45 edition from the game data; see `data/SOURCES.md`). The browser data test pins the per-list count of those additions and checks that no list repeats an id. Custom Deliveries (12 clients, complete at rank 5), Cosmic Exploration missions (1,699 in 44 planet-and-class groups, planets in the game's order) and records (244) are pinned by the same test.

| List | Tracker | Independent count (FFXIV Collect) |
| --- | --- | --- |
| Mounts | 356 collectable + 13 quest vehicles marked “no longer obtainable” | 356 |
| Orchestrion rolls | 886 | 886 |
| Triple Triad cards | 475 | 475 |
| Blue Magic | 124 | 124 |
| Facewear | 61 | 61 |
| Fashion accessories | 52 | 52 |
| Barding | 107 | 107 |
| Titles | 885 | 885 |
| Achievements | 4,000 | 4,000 |
| Minions | 587 | 584 (three Grand Company wind-ups are separate game rows) |
| Emotes (unlockable) | 202 | 201 (the game's own Snowball emote row, which FFXIV Collect does not list; duplicate rows merged 2026-11-08) |
| Hairstyles | 53 | 54 (one style not sold as an item) |

Availability marks: 514 time-limited only, 873 no longer obtainable (261 Legacy achievements, 13 quest-vehicle mounts, rows the checklist pre-excludes), 463 availability unknown (FATEs not placed in any zone). Every entry has a manual switch.

## Desktop-app import (owner's seven saves, app version 1.0.5)

23,664 of 23,775 ticks placed exactly (99.53%), 615 “does not apply” marks and 64 job/desynthesis levels imported. Not placed: 111 ticks (68 Squadron, which no list covers; the rest aether-current, aetherytes, hairstyles, the Yo-kai/Portable Archive and Hunt entries affected by the desktop app's older 7.38 workbook) and Trust/Squadron level values; all are listed by the import report.

## Performance (headless Chromium, desktop)

Measured with the owner's eight characters loaded: the longest lists (1,700–2,000 rows × 8 characters) open in 0.2–0.4 s; a tick, including the menu totals, updates in 65–125 ms (per-list totals are cached; before the red-team pass it was 300–375 ms). Single file 4.7 MB.

## Links between entries (2026-11-08)

About 17,840 links: from the game data, plus 802 checked links from the FFXIV Completionist desktop app (`data/SOURCES.md`). Checked against the owner's seven saved characters: filling in what their ticks prove adds 89 ticks to the first and 111 to the second (90 and 112 before the red-team fixes removed 19 desktop links into the wrong version of a class quest and the tier links into Legacy achievements) (out of 12,885 and 10,506), none to the others; the first 169 (game data) were reviewed by hand, and the further ones from the desktop links and the new families were traced one by one (base relic tools from their class quests, allied society ranks and their quests, achievements and their items, mount speed increases) and is consistent with the game (quests done without their aether current, achievements without their reward or title, later main-story quests ticked with earlier ones missing, a second mount speed increase without the first, level achievements from the job levels). All 251 links from an item back to its only source were reviewed. Ticking "The Ultimate Weapon" for a character who started in Gridania and joined the Twin Adder ticks 170 entries, including all 22 Gridania main-story opening quests and only Twin Adder company quests. A full fill-in takes under 60 ms per character.

Compared with the FFXIV Completionist desktop app 1.0.5 (the owner's installer, unpacked without running it): it has a linking engine ("chaining-enabled") with 11,921 links between tracker entries once translated. The tracker already covered 9,767 of them (82%); 802 more were adopted after checks; 1,325 no longer point at the same entries (its data is from patch 7.38) and 19 point at one of the two versions of a first class quest (rejected). Its faults: unticking cascades (unticking one entry unticks every later one, and paired entries untick each other), 3 links to quests missing from its own data, and lists that no longer line up with current game data.

Compared with the FFXIV Completionist Browser App (open source, built on the same workbook): its chains follow the workbook's row order inside chosen sheets rather than the game's prerequisites, unticking cascades and unticks every later row, its wiki quest-chain crawl is empty (0 links in `GameDataReferences/chains.json`), and it has no links between lists (achievements, titles, rewards, aether currents, duties).

## Red-team and pre-mortem (2026-11-08)

Findings and fixes are recorded in `.ai/DECISIONS.md` (entry of 2026-11-08, "Red team and pre-mortem"). Key-stability check against the first public release (b42e037): 0 entries removed, 0 renamed, 5 merged into another entry (their ticks move over on load).

## Known limits

- After-7.45 additions not made: 3 Triple Triad opponents without a name in the game data and the North Horn aether shards (not identifiable from reachable data); tick those by hand.
- Not verifiable from the build session: Google sign-in live (the consent screen's publishing status decides who can sign in), press-and-hold on a real phone, and Safari's storage clearing (the persistence request and reminder are in place).
- The online refresh and Google sign-in can only be tried live from the hosted app; FFXIV Collect's API was checked live from the build session (browser reads allowed), Google sign-in was not reachable there.
- Time-limited marks come from community data: “time-limited” does not distinguish an event that never returns from one that recurs, so those entries say “Time-limited only” rather than “gone”.
- In-game icons are not included (not in the reachable data); the design uses type and the theme colours instead.

## Red-team consolidation (2026-11-08)

Two independent red-team reviews (ChatGPT, 8 findings; Claude, 41 findings) of the candidate at `2964384` were adjudicated and applied: `.ai/reconciliation/ASG-20261108-tracker-redteam-r1-001.md` and `-r2-001.md`. In short:

- **Saving and sync.** Two windows ticking at the same moment both keep their ticks (each save is compare-and-swap with a merge). A cloud copy missing a character's ticks, or from another app, is refused. Every removal coming from another device is confirmed. A failed upload changes nothing on this device. A write by another device at the same moment is detected and both copies are combined. A copy over 5 MB is refused with a plain message.
- **Online refresh.** An empty FFXIV Collect list is "not recorded there". An answered question is not asked again until something changes. Taking FFXIV Collect's side on more than 10 ticks is confirmed and can be undone. A failed character is named. Errors are caught.
- **Links.** The links file carries a hash of the data's key list and is refused when it does not match. No link assumes a city, company or class route for a character without one. Desktop links into the wrong version of a class quest and tier links into Legacy achievements were removed.
- **Data.** 310 seasonal and festival quests and 189 titles carry their availability marks. Each first class quest is marked with its route (starter or joiner), set by the starting class, so every character can reach 100% of Class and Job Quests. Repeated PvP arena rows and duplicate emote rows were merged, with old ticks moving over.
- **Interface.** Clearing a group is confirmed and can be undone. "Mark does not apply" resets on reload. Group headers, counts and names work from the keyboard. Same-named rows show what tells them apart. Cloud sync says when it is off.
- **Upkeep.** `check-keys` compares with the last merged data, fails on any unreviewed rename and on a stale links file. The merge tool's output is reproducible. Font licence text in `LICENSES-FONTS.md`.

## Class and job quests split, Beastmaster, and the Dawntrail sweep (2026-11-08)

- **Class & Job Quests** is now a folder of ten lists, the desktop app's pages: Disciple of War, Magic, Hand and Land Quests; Crystalline Mean, Studium and Wachumeqimeqi Quests; Disciple of War and Magic Job Quests; Role Quests. Every entry remembers its old list (`mv`), so ticks, "does not apply" marks and levels saved under the combined list move over on load. On the owner's backup, checked in memory, 774 and 691 ticks move and no tick is lost. `check-keys`: 0 removed, 875 moved.
- **Beastmaster** (7.56), under Character, Classes and Jobs:
  - the Master's Bestiary, 50 beasts with where to find them (game sheets `XBMPet`, `Pet`);
  - the Crucible of the Unbroken's 5 boards (duty finder type 40);
  - links: 10 to 50 beasts tick "A Beast in the Hand I to V"; a board ticks its achievement and, through the game's unlock fields, the quests that open it ("Into the Crucible" for the first board).
  - The 10 Beastmaster quests were already tracked, now easier to find under Disciple of War Job Quests.
- **Dawntrail sweep.** Every game sheet added since 7.0 was compared with the tracker's lists. Cosmic Exploration and the Occult Crescent were covered; the Beastmaster family was not. The duty finder also had kinds the tracker skipped. Added:
  - Treasure Hunt: 27 kinds of treasure map and 10 treasure dungeons (Cenote Ja Ja Gural and Vault Oneiron among them), each dungeon linked to its first achievement and title;
  - Quantum duties: the Final Verse and the Final Verse (Quantum), linked to its achievement;
  - Event duties: the Haunted Manor and the other seasonal duties, marked time-limited;
  - Occult Crescent: Lore, 60 entries (South Horn and North Horn);
  - Trust, 21 avatars over Shadowbringers, Endwalker and Dawntrail, each a level that counts at the expansion's top level. "Bound by Faith", "Bound by Hope" and "Bound by Amity" are ticked once the avatars their text names reach it.
- **Desktop-app import:** its Trust and Treasure Hunt pages now import. On the owner's saves the Trust paths match; levels still at the app's default (71, 81, 91) are not recorded as progress.
- **Allied Society Ranks and other checklist lists:** each group's subtitle is now its expansion (it showed the previous group's name).
- Not added, with reasons:
  - Squadron: A Realm Reborn content, outside this sweep;
  - Doman Mahjong costumes: the game's sheet carries no names;
  - Cosmic Exploration's pioneering trail: shared world progress, not per character.

## Categories by expansion, and the information window (2026-11-08)

- **Expansion first, everywhere it applies.**
  - **One list per expansion, each set in its own folder:** Main Scenario, Sidequests, Allied Society Quests, Levequests, FATEs and The Hunt.
  - **An expansion heading above the groups** in every other list whose entries span expansions: achievements, other quests, duties, crafting and gathering logs, fishing, collections and more. Each heading shows every character's count and folds its groups away.
  - **How an entry's expansion is decided:** for quests, the game's own `Quest.Expansion`; for duties, FATEs and hunt marks, their map's expansion; for levequests, their level band; for everything else, the release patch.
- **Deep dungeons:**
  - placed by series: the Palace of the Dead in Heavensward, Heaven-on-High in Stormblood, Eureka Orthos in Endwalker, Pilgrim's Traverse in Dawntrail;
  - Teamcraft's duty patch labels proved wrong in 35 cases (for example, Dawntrail dungeons labelled 6.0), so those labels are no longer shown.
- **Quests outside the journal:**
  - "So You Want to Be a …" quests now sit in that class's group of the class and job quest lists (21);
  - the other unlock quests sit in Other Quests, under "Feature Unlocks" for each expansion (159). These are levequest, sightseeing, flying, Eureka and Gold Saucer unlocks and the like.
- **Variant Dungeon Records:** 49 records, one per route through the Sil'dihn Subterrane, Mount Rokkon, Aloalo Island and the Merchant's Tale. All of a dungeon's records tick its achievement (for example "Dig Deep: The Sil'dihn Subterrane").
- **Saved ticks move over:** every moved entry keeps its old list (`mv`). On the owner's backup, checked in memory, all ticks and "does not apply" marks land on known entries. `check-keys`: 0 removed, 9,244 moved. The desktop-app import places exactly what it did before.
- **Information window:** rest the pointer on a name; on touch screens, tap the name for the details.
  - 33,000 entries have information lines built from the game sheets and FFXIV Teamcraft (MIT): quest givers with place and coordinates, level, prerequisites, duties a quest unlocks, duty levels and the quest that unlocks them, FATE levels and spots, hunt marks and Hunting Log monsters with zones and coordinates, aetheryte spots, vista spots with time, weather and emote, levemete places, recipe ingredients and books, gathering nodes (timed, legendary), and fishing holes with bait, bite and hook.
  - Collections keep their FFXIV Collect sources, and the checklist lists keep their details.
  - Owner follow-up, same day: "copy the information unto the tracker itself instead" of linking out. The windows now carry the answers and link nowhere:
    - fish: time window, weather and previous weather, bait and mooch chain, fish to catch first for Fisher's Intuition, Fish Eyes, folklore book (ff14-fish-tracker-app, MIT; 1,110 fish), and spearfishing spots;
    - field aether currents: their spot, from the game's own objects (152);
    - elite marks: rank, area, spawn condition and respawn time (204 marks);
    - Variant records: the route for each, written for the tracker (49);
    - Occult Crescent records: what unlocks each (60);
    - allied society ranks: reputation needed.
  - Wiki text is not copied word for word: the Console Games Wiki states no licence for its text. The facts taken from it (spawn triggers, what unlocks a record, a route's choices) are stated in the tracker's own words or as short facts, and credited.
  - The information is stored compressed in the page (about 0.6 MB, up from 5.0 MB to 5.9 MB in all) and unpacked the first time a window opens.

## Every entry explained; crafting and gathering in depth (2026-11-08)

- **Every one of the 43,944 entries now has how-to text in its window.** A test fails if any entry has neither information lines nor a source.
- **Crafting log (13,892 recipes):**
  - job, level, stars and recipe level;
  - specialist-only, expert and collectable;
  - every material with where it comes from (crafted by which job at which level, gathered by which job, or fished) and the yield;
  - minimum Craftsmanship and Control;
  - required item or status;
  - the master book or quest that unlocks it;
  - durability, whether it can be HQ, and whether Quick Synthesis is available.
- **Gathering log (1,153 items):**
  - node type (mining, quarrying, logging, harvesting), level, area and zone with coordinates, for up to three zones;
  - unspoiled, ephemeral and legendary nodes with their Eorzea times and how long they stay up;
  - hidden items;
  - the folklore book a legendary node needs (227 of 286, matched from the node's region);
  - whether the item is a collectable, and any Perception requirement;
  - "Sublime" items: which ordinary item they replace.
- **Every other list:** a plain instruction built from the entry's own facts. Examples:
  - Cosmic missions: job, planet, silver and gold scores, time limit;
  - plates and portraits: their source;
  - relic stages: what they need;
  - fishing holes: coordinates and the fish found there;
  - Triple Triad opponents: place, difficulty and rules;
  - master and folklore books: vendor and price;
  - porters, field operation levels, Island Sanctuary, Grand Company ranks, the Masked Carnivale, chocobo companion skills, Trust and more.

## Deeper information everywhere; Solution Nine theme (2026-11-08)

Owner request: "do all of them, quest steps included … i do not want generic or shallow text anywhere. I want useful things", and a Solution Nine theme for light and dark.

- **Quests (5,368):** the journal summary and the steps, in order, from the game's own quest text (5,284 quests have steps; long ones show the first eight and the last). "Quest Sync" and "※ Please note" boilerplate and the game's icon glyphs are removed.
- **Duties (571):** the unlocking quest with its giver, place and level, from the game data first; then, where the game data is silent, facts restated from the Console Games Wiki (`data/duty-facts.json`): ultimates (which savage fight and which Wandering Minstrel), deep dungeons (quest, entrance, floor rules, matched-party quests), treasure dungeons (which map opens the portal), criterion dungeons, the chaotic raid, Quantum, seasonal duties, Crystalline Conflict, Frontline and Rival Wings. Raid turns say which turn comes before; deep dungeon floor sets say how they open; solo quest duties name their quest (79 of 85).
- **FATEs:** the generic "gold rating" line is gone; Firmament restoration stages explain who takes part.
- **The Hunt:** 717 of 725 hunt bill marks name their bill (daily or weekly), kills, zone and the quest that opens those bills. **Hunting Log:** each monster's zone and area from the log itself.
- **Collections:** every FFXIV Collect source kind is turned into what to do: the recipe with each material's source, the vendor with place and price (and allied society rank or FATE needed), the duty with its unlock, the quest with its giver, seasonal events, Mog Station and bundled codes, treasure maps, deep dungeon coffers, Occult Crescent coffers, PvP series levels, lockboxes, submersible sectors, retainer ventures and Triple Triad opponents with their place.
- **Achievements:** what they need beyond the description: the achievements a set requires, the quest an achievement is for, the duty with its unlock, and the place of every FATE named in quotes.
- **Smaller lists:** Blue Magic (how learning works, where the source is), Blue Mage log duties (unlock), Masked Carnivale stages (where to register, the quests later stages need), chocobo skills, Shared FATE, Island Sanctuary crafts, allied society ranks (who gives the dailies), class unlocks and mount speed (quest givers), spearfishing (hole, coordinates, shadow size and speed, fish to spear first), gathering levequests, fishing windows shown as hours and minutes, and no "Gig: UNKNOWN".
- **Tests:** core 50/50 (the information test now also checks an ultimate, a treasure dungeon, a solo quest duty, a hunt bill mark, a Hunting Log area, a Masked Carnivale stage, and that no icon glyphs, "Gig: UNKNOWN" or "gold rating" lines remain); browser 23/23 (21 themes, including Solution Nine, each with text contrast ≥ 7 and accent ≥ 3 in light and dark).
- **Solution Nine theme:** light: background #e6e8f8, text #0c0f2e (contrast 15.4), accent #b8166f (5.1); dark: background #0a0d24, text #e9ecff (16.3), accent #ff4fb8 (6.4). Added to the tracker's theme list at build time; the Atelier's own list is unchanged.

## Relic weapon and tool guides (2026-11-08)

Owner request: guides, tied to the tracker's own relic entries, for getting the relic weapons and tools.

- Every one of the 1,114 relic stages (707 weapon, 407 tool) in Relics → Relic Weapons and Relic Tools now opens a guide for its stage in the information window. The guide covers 11 series: Zodiac, Anima, Eurekan, Resistance, Manderville and Phantom weapons; Lucis, Skysteel, Resplendent, Splendorous and Cosmic tools. Each guide gives:
  - the series, the stage and its place in the series (for example "Zodiac Zeta stage (8 of 8)"), the job and the item level;
  - what to do: first-time quests and NPCs, the repeatable quest, the grind and the fastest way through it;
  - what that exact weapon or tool needs, with where each item comes from (vendor with place and price, duty drops, FATE rewards);
  - how the dungeons and trials the stage asks for are unlocked (quest, giver and place, from the game data).
- The guides are written for the tracker from the Console Games Wiki relic pages (`data/relic-guides.json`); no text is copied.
- Tests: core 50/50 (the information test now checks a Zodiac, a Eurekan and a Splendorous stage, and that every relic stage has a guide); browser 23/23.

## Owner polish round (2026-11-08)

- A list's expansion heading is left out when that expansion holds a single group with the same name (for example Mounts → "A Realm Reborn" twice); the group heading alone remains.
- The information window closes the moment the pointer leaves the name.
- The FFXIV Collect refresh status is a small one-line chip ("Refreshed 05:30 PM · 5 not refreshed" with an amber dot); the full list of characters not refreshed and why is in its tooltip.
- The Solution Nine theme is now **Electrope Skyline**: neon cyan leads (accent: light #0a6c94, dark #38dcff), neon pink is the second colour (light #c2187a, dark #ff4fb8). Contrast still checked by the theme test.
- Tests: core 50/50, browser 23/23.
- Repeats removed (same day): the window no longer adds FFXIV Collect's raw "How to get it" line under the worked-out explanation (it shows only when there is no explanation), the entry's own description is shown once at the top, and the data no longer stores lines that repeat the description or each other (4,013 lines). Page 7.06 MB → 7.00 MB. Core 50/50, browser 23/23.
- Item stamps (same day): the information window shows an "Untradable" stamp at the top right, beside the name, drawn in the theme's accent colour (1,688 collection items), and a dye drop for dyeable items (one drop per dye channel; 3,894 crafted items), in place of the "Untradable" line. The explanation starts with "How to obtain:". The Mog Station price is folded into one line. Core 50/50, browser 23/23.
