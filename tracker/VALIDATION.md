# Validation — Eveniunt Tracker

Date: 2026-11-08. Data: `xivapi/ffxiv-datamining` @ `44948e4c` (7.57h1), FFXIV Teamcraft @ `c1ede0a0`, FFXIV Collect snapshot 2026-11-07, FFXIV 100% Completion Checklist 7.45 (see `data/SOURCES.md`).

## Automated tests

| Suite | Result | What it checks |
| --- | --- | --- |
| `node --test tests/core.test.js` | 73 / 73 pass (2026-11-11, Submersibles step S2; 65 on 2026-11-10; 61 on 2026-11-09) | **Submersibles** (2026-11-11): the section's checker (bad input dropped, limits, ids pinned to the data), 15,000 trips kept, two devices logging different trips with no clash, typed game times and the calendar file, worked-out voyages against the five hand-worked ones and against the three numbers players measured in the game, the route advisor; | **names** (2026-11-10): a placeholder name never replaces a typed one in a merge, either way, and is never a clash; | **catch-up** (2026-11-10): an old Tracker tab's work after the move reaches a still-blank save whole, is merged into a save in use (placeholder names give way), arrives once, never from a stamp filled in on reading, and an erase stays erased; characters 1–8; totals; the ✕ switch both ways; ticks on uncounted entries kept but not added; group ticking; per-character “does not apply”; level values (cap ticks, desynthesis recorded only); backup file and transfer code round trips; three-way merge and conflicts; FFXIV Collect refresh (first run asks, later gains apply, clashes ask, private profiles, no connection); Google Drive sync against a simulated Drive; desktop-app import (game ids, positions, X marks, levels, master books never read as recipe ids); **red-team cases**: crafted backups (prototype keys, markup in names, cities, levels, keys), huge or malformed transfer codes, levels of a removed character, Lodestone addresses, merged-entry ticks moving over, and cloud sync with a damaged copy, a large removal, a simultaneous write and odd ids in the cloud file; **links**: built for this data and refused for other data, the main story from "The Ultimate Weapon" down to the character's own city and company quests only, achievement and title both ways, quest and aether current both ways, Freebird only after the last current, the gold-rating switch, level achievements, never ticking what does not apply; achievement tiers, Dawntrail relic stages, Grand Company rank and officer quest, a checked desktop-app link (Firebird quest and the lanners) |
| `node --test tests/ui.test.js` | 31 / 31 pass (2026-11-11, after the Hunts test was made independent of the date; 2026-11-10; 28 on 2026-11-09) | **date-proof Hunts test** (2026-11-11): the Hunts check runs the page at a fixed time after every maintenance in the built-in events list, so the days after a maintenance (when every world rightly reads closed) no longer fail it; | **phone** (2026-11-10): one character at a time, picked from the names bar at the top, tick lands on the chosen character, choice kept, a wide screen unchanged; | **catch-up** (2026-11-10): what an old Tracker tab saved to IndexedDB after the move arrives on the next load, with a notice, once; the built file from `file://` with every network request blocked: first run with 8 characters; lists open with every group closed (Open all, Close all, find opens matches); a tick follows its links with an Undo message and explains them in the details, the switch turns links off, and Settings fills in what existing ticks prove (preview and Undo); click marks done, right-click and press-and-hold mark “does not apply”, a second click clears either; ticking, ✕ both ways and “does not apply” update the tallies and survive a reload; group ticks; level fields; every list renders and every list over 60 entries is grouped; search; the menu is Character, Duty, Logs, Travel, Social; desktop-app import through the interface; transfer code between two browsers; phone width 390 px with no sideways scroll; **all 21 themes in light and dark** (the Atelier's 20 plus Solution Nine) (text contrast ≥ 7, accent ≥ 3, dropdowns ≥ 7, themes listed alphabetically, wordmark coloured by the theme); data counts; the **hosted site over HTTP** (manifest, service worker, offline reload keeps the characters, no cross-origin isolation so Google sign-in can open; gate 1D: the **⌂ Command Center** header link points at the site root, the one-time hand-over notice shows, **Got it** records it on the device and it stays away, while the file opened from disk has neither); **gate 1C**: an existing save is copied into the one save, the old save stays untouched, the way back works; **red-team cases**: a crafted backup loaded through the page runs no script, the first-run window cannot be dismissed, unreadable saved data is offered for download and kept, and two windows of the tracker never overwrite each other |

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
- Not verifiable from the build session: the live Microsoft sign-in and the live helper (gate 1E: checked against stand-ins for Microsoft, the helper and OneDrive; the owner's first real sign-in is the live check), press-and-hold on a real phone, and Safari's storage clearing (the persistence request and reminder are in place).
- The online refresh and the cloud sign-in can only be tried live from the hosted app; FFXIV Collect's API was checked live from the build session (browser reads allowed); Microsoft's sign-in and OneDrive were not reachable there.
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

## No vague groups; Hildibrand Adventures list (2026-11-08)

Owner request: no "Other" or "Patch not recorded" groups; the Hildibrand quests needed for the Endwalker relic.

- **FATEs Teamcraft could not place (463):** each was placed by its zone from Garland Tools' FATE data where it names one (179), otherwise by the FATE's own type in the game data: Firmament restoration stages (133), Cosmic Exploration (101), Bozja (7), Occult Crescent (16), seasonal and special event FATEs (14). The 137 FATEs of the original Diadem are under "The Diadem (original 3.x version)". 13 were never placed in the game world (test or removed FATEs); they stay, marked not counted, in a group that says so (`data/fate-zones.json`).
- **Collection entries without a patch (24 mounts, minions and bardings):** placed in the expansion of the entry released just before them (the game's ids follow release order).
- **Other groups:** crafting "Other" pages are now "Replica Gear (glamour)" and "Aetherial Wheels"; spearfishing "Other" is split by the hole's zone (from `SpearfishingNotebook`) and "Treasure Maps"; Triple Triad opponents sit under their place (Gangos, Terncliff, Lower Jeuno, the Gold Saucer's Battlehall, Azys Lla) and expansion; ocean fishing routes are under the expansion of their sea; "Mapping the Realm" achievements are under their region; the gathering log's "Other Items" list is "Relic Tool Materials" (Skysteel and Splendorous); plates, portraits and Occult Crescent duties newer than the checklist join the group of their kind. Plates and portraits whose source is not published yet (38) sit in "Patch 7.5 additions (source not yet published)".
- **Hildibrand Adventures:** all 57 Hildibrand quests from every expansion are now one list, Sidequests → Hildibrand Adventures, with expansion headings.
- **Saved ticks:** entries that left a list they were published in remember it (`pv`), and ticks saved under the old key move on load; `check-keys` passes.
- Tests: core 50/50 (new checks: no vague groups, no list called Other, the Hildibrand list), browser 23/23.

## Clock, weather and live windows (2026-11-08)

- **Header clock:** Eorzea time and your local time, updated every second. Clicking it opens **Weather**.
- **Weather page:** all 82 zones with weather, grouped by expansion and region, including Eureka (4), Bozja and Zadnor, the Occult Crescent, the Diadem, the Firmament, Island Sanctuary and Cosmic Exploration: the weather now and for the next three 8-hour Eorzea periods, with the local time each starts. Worked out in the page with the game's own weather formula and each zone's `WeatherRate` table (`data/conditions.json`); no connection needed.
- **Live windows:** 834 entries carry their condition: 82 vistas (time and weather), 440 fish and 1 spearfishing fish with a time, weather or previous-weather condition (ff14-fish-tracker-app data), and 311 timed gathering items (spawn hours). In the lists, an entry that can be done right now turns the accent colour with a "now" tag (checked every 5 seconds); its window says "Available now for 23 min" or "Next window in 5 h 27 min (your time 04:43 AM)", with the condition and zone.
- Tests: core 50/50, browser 24/24 (new: clock, weather for Eureka, Bozja, the Occult Crescent and overworld zones, live vistas).

## Live pages, Armoire and Outfits, Gold Saucer goals (2026-11-08)

Owner request: add items 1 to 8 of the sweep (Up Now with a hide toggle; a detailed big fish board; resets and seasonal events; ocean fishing with guides; Armoire and Outfits; field monsters with element filters; Gold Saucer with Lord of Verminion and chocobo racing guides; notifications with detailed switches).

- **Live menu** (top of the side menu): Up Now, Big Fish, Ocean Fishing, Timers & Events, Weather, Field Monsters, Gold Saucer, Notifications. Everything is worked out in the page; no connection needed.
- **Up Now:** every fish, spearfishing fish, timed gathering node and vista whose window is open now, then what opens within the hour, with countdowns; hover a name for how to get it. A character choice and "Hide what this character already has".
- **Big Fish:** all 335 big fish (299) and legendary fish (36) of every expansion (`data/big-fish.json`, Console Games Wiki), 330 matched to the Fishing Log and 301+ with a computed window. A board in the manner of spawn trackers: fish that are up first, with a bar showing how far into the window you are, then the soonest windows with the next two after them in your local time; zone, hole and coordinates; hours, weather and previous weather; bait chain, bite and hookset, Fisher's Intuition fish, Fish Eyes, folklore book, lure; filters (expansion, legendary only, hide caught, up within the hour); "Mark caught" ticks the Fishing Log entry; ☆ adds a fish to notifications.
- **Ocean Fishing:** the next 12 boats from Limsa Lominsa (Indigo) and Kugane (Ruby) from the game's own 144-voyage route table (`IKDRouteTable`; the offset was checked against the community schedule at ffxiv.oceanfishing.boats, which it matches exactly for both routes; a test pins it). Each voyage: boarding countdown, the three stops with the time of day, the route's best targets, and how many of the fish there the chosen character still has to log. Below: the 53 ocean fishing achievements with ticks, and a guide (unlock, boarding, bait for the fabled fish, spectral currents, points, fast leveling, planning).
- **Timers & Events:** daily (15:00 UTC), weekly (Tuesday 08:00 UTC) and Grand Company (20:00 UTC) resets, the Fashion Report window, the next GATE and boat, and seasonal events and maintenance from Xenoveritas' timer list (`data/timers.json`, `tools/fetch-timers.py`). The hosted tracker reads a fresh `timers.json` next to the page when one is published; a scheduled refresh of that file needs the owner's permission (not set up).
- **Field Monsters:** monster logs for Eureka (Anemos 99, Pagos 35, Pyros 98, Hydatos 67), the Bozjan Southern Front (9 documented), Zadnor (63, by area) and South Horn (102): level, coordinates, element (Eureka) or weakness (Occult Crescent), weather or night spawns (highlighted while they are out), aggro; filters by element pair, sprites and ashkin for the Eureka challenge log (with "Show them" buttons beside each challenge), by weakness for the Occult Crescent, and "only those out now"; notorious monsters with their trigger and whether its weather is up.
- **Gold Saucer:** the GATE schedule with the next one counting down; guides for GATEs, Lord of Verminion and chocobo racing; progress for the two new lists.
- **New lists:** Collections → Armoire (3,563) and Outfit Glamours (1,088) from FFXIV Collect, with sources, time-limited marks, item stamps and online refresh; Gold Saucer → Lord of Verminion (24 challenges, Master Battles, the two minion rewards) and Chocobo Racing (the game's Chocobo Challenge races, ranks, pedigrees), each with how-to text.
- **Notifications:** a master switch and browser permission button; delivery by browser notification, sound and in-page message, each switchable; per category: big fish (off, watched, not caught, all; legendary only; lead time), other fish, timed nodes, vistas, ocean fishing (every boat or boats with fish to log; lead time), resets (daily, weekly, Grand Company, Fashion Report), each GATE by name, events and maintenance, field operations (a notorious monster's trigger is out); a watch list (☆ on the board, on Up Now or in an entry's details). Works while the tracker is open in a tab.
- Tests: core 51/51 (new: the ocean schedule against the community pattern, routes, big fish, field monsters, the new lists), browser 25/25 (new: every Live page renders; big fish filters, ticking and watching; 12 voyages; settings survive a reload).

## Deeper field monsters, every big fish with a window, events refresh (2026-11-09)

- **Field monsters:** each enemy page of the patches that added Eureka, Bozja and the Occult Crescent was read from the Console Games Wiki (its location rows, rank, aggro, family and loot), on top of the structured data: the Bozjan Southern Front 9 → 77, Zadnor 63 → 83, Eureka Anemos 99 → 120, Pyros 98 → 117, Hydatos 67 → 83, South Horn 102 → 103, and **North Horn** added (152). Pagos stays at 36: that is all the wiki documents, and no other source lists Eureka positions. Bozjan sprites and undead without a documented condition use the rule Zadnor documents (marked "usual rule"). Monsters show their area, family and drops (Forgotten Fragments, clusters, memories).
- **Fixed:** Bozja's weather table is named "Bozjan Southern Front" in the game data, so its live weather and spawn highlights were not working; they are now.
- **Lost Actions:** 49 of 99 now say which monsters drop their fragment.
- **Big fish:** the wiki's older table rows are read too (hours, weather and the weather before, hole, coordinates, bait, intuition), and fish the fish-tracker data lists without limits show as always up: all 335 have a window or none needed. Housing districts (the Goblet, the Lavender Beds, Shirogane, Empyreum) now have weather forecasts (86 zones).
- **Events refresh (owner approved):** the public site's Pages workflow now runs every 6 hours and saves a fresh copy of Xenoveritas' timer list next to the tracker (`tracker/timers.json`), which the Timers & Events page reads. To stop it, remove the `schedule` lines from `.github/workflows/pages.yml` (or ask).
- Tests: core 51/51 (new checks: Bozja and North Horn monsters, Bozja's weather table, every big fish with a window), browser 25/25.

## Dailies, S ranks, island planner and more (2026-11-09)

Owner request: add sweep items 1 to 9; data center Dynamis; a weekly Island Sanctuary workshop recommendation.

- **Dailies & Weeklies:** 25 tasks (roulettes, allied society quests 0/12, Mini Cactpot 0/3, hunt bills, Grand Company turn-ins, timeworn map every 18 hours, Island Sanctuary; weekly Wondrous Tails, Custom Deliveries 0/12, elite bills, Doman Enclave, Masked Carnivale 0/3, challenge log, Faux Hollows, Fashion Report, Jumbo Cactpot 0/3, tomestones, raids, next week's workshop agenda) for every character, clearing themselves at the daily (15:00 UTC), Grand Company (20:00 UTC) and weekly (Tuesday 08:00 UTC) resets; kept on this device.
- **S Ranks:** all 50 S-rank marks with their spawn condition and respawn time; the 10 whose condition is weather, Eorzea time, the moon or dry weather (Laideronnette, Kirlirger, Burfurlur, Okina, Croakadile, Mindflayer, Croque-Mitaine, Bonnacon, Thousand-cast Theda, the Garlok) show when it is met and the next three times. The moon phase follows the Eorzean month (32 days, a new moon on the first; Console Games Wiki).
- **Island Sanctuary:** the 29 rare animals with time or weather needs, from the island's own weather table, with where they roam, what catches them and what they leave; a **workshop planner** using the game's export value formula (rank bonus, groove, the supply and popularity multiplier table, efficiency ×2 for chained categories) that finds the best 24-hour agenda for the popularity and supply you enter from the workshop screen.
- **Field Monsters:** every weather or night monster shows when it is next out.
- **Timers & Events:** the Jumbo Cactpot drawing for the data center you choose (Japan Saturday 12:00 UTC, North America Sunday 02:00 UTC, Europe Saturday 19:00 UTC, Oceania Saturday 09:00 UTC; Console Games Wiki), and, while a seasonal event is announced, its rewards from this and earlier years with ticks.
- **PvP Series:** each series' collectable rewards by level, newest first, with ticks. **Leveling Guides:** combat jobs by level band, crafters and gatherers, and the stacking bonuses.
- **Overview:** achievement points per character (from ticked achievements).
- **Notifications:** new switches for S-rank conditions, rare island animals and the Jumbo Cactpot drawing.
- The data center is chosen in the app and kept on the device; no character or world name is stored in the tracker's files.
- Tests: core 52/52, browser 26/26.

## Hunts, market board, housing, news, wider character sync (2026-11-09)

Owner request: add candidates A to D from the Command Center sweep, and everything Faloop offers that the tracker did not yet have.

- **Hunts (in the manner of Faloop):** every S rank (47), SS rank (3) and A rank (76), with its respawn time from the Console Games Wiki's elite mark tables. Choose your data center and world. Record a kill ("Killed now" or "Killed at…") and the board shows the window: closed (opens in…), open (how far through, caps in…) or capped (should be up). After an all-worlds maintenance, the shorter maintenance windows start by themselves, from the end time in the events list (or a time you enter). **Spawn point maps** for all 47 hunt zones (941 points, from Hunt Helper, MIT licence) let you tick off checked points. **World boss FATEs:** all 12 (Behemoth, Odin, Coeurlregina, Noctilucale, Ixion, Tamamo Gozen, Formidable, Archaeotania, Daivadipa, Chi, Ttokrrone, Mica the Magical Mu), with their FATE chains and coordinates, weather, rewards, the documented timers (Behemoth, Ixion, Tamamo Gozen) and a kill record. Notifications can say when a window opens and when it caps. What Faloop has and the tracker cannot: other players' live kill and spawn reports. Faloop gathers those from its signed-in community, and they have no public feed; the tracker knows only what you record.
- **Market Board (Universalis):** prices for your data center or world in every tradeable entry's details (cheapest listing and world, recent sale price, sales a day, how old the data is), and a shopping list with quantities and a total. Checked in the browser on 2026-11-09: the site answers with an allow-all cross-origin header.
- **Housing (PaissaDB):** open plots on your world by district, with size, price, who can buy, lottery phase, entries and the phase end. Ward and plot numbers are shown as the game shows them (the source counts from 0).
- **News:** the Lodestone's official news and topics feeds. The public site's Pages workflow saves them every 6 hours, beside the events list (the browser cannot read them from another site). A notification can fire for new maintenance notices or for every new item.
- **Character sync (A):** this already existed for 11 collections. FFXIV Collect's Triple Triad cards, Triple Triad opponents (130 of 131 matched by name) and levequests are now refreshed too.
- **Fixed:** on the hosted site, the offline cache kept serving the first saved copy of the events list. The 6-hour lists (events, news) now come from the network first, with the saved copy used only offline.
- Tests: core 53/53 (new: hunts, spawn maps, boss FATEs, worlds, sync collections), browser 27/27 (new: kill windows, a spawn point check, prices, housing and news pages with fake replies; only Universalis and PaissaDB are contacted).
- **Region-wide (owner follow-up):** Hunts and the Market Board now cover the whole region of the chosen data center (for Dynamis: Aether, Crystal, Dynamis and Primal, 32 worlds), since characters travel freely between them. On Hunts each mark shows one square per world (grey closed, green open, blue capped, grouped by data center), and clicking a square chooses that world for recording kills. Market prices come from Universalis' whole-region query (checked on 2026-11-09: `North-America` returns listings from every NA data center), and each price names its world and data center. "My data center" and "one world" remain as choices. Housing can pick any world in the region too. Notifications for windows that start from maintenance fire once per mark, not once per world. Tests: core 53/53, browser 27/27 (new checks: 32 worlds per mark, a kill shows on its world only, prices show world and data center).
- **Hourly refresh (owner choice, 2026-11-09):** the public site's Pages workflow now runs every hour instead of every 6 hours (`cron: '23 * * * *'`), so the events and maintenance list and the Lodestone news are at most about an hour old. Nothing else changes for the tracker: the app only reads the small saved files. To go back, change the `cron` line in `.github/workflows/pages.yml` (or ask).

## A to Z lists, Live dropdown menu, Command Center blueprint (2026-11-09)

- **A to Z (owner request: "every list in the tracker should be alphabetical"):** by default, the folders in each menu, the lists in each folder and the entries in each group are sorted by name, with numbers in natural order (Lv 2 before Lv 10). Groups inside a list (for example the expansions) keep their order. Settings → Counting → **Keep the game's order** brings back story order for quests, level order for recipes and leves, and release order for expansions. The save is unchanged, and so are the keys.
- **Live menu:** five dropdown folders like the other menus (Daily Life; Economy and Housing; Fishing and Island; Gold Saucer, PvP and Leveling; Hunts and Field Operations), holding all 17 Live pages.
- **Blueprint:** `.ai/planning/COMMAND_CENTER_BLUEPRINT.md` (private record): the Command Center app with modules, for the owner to approve. Nothing built yet.
- Tests: core 53/53, browser 27/27 (new checks: A to Z folders, lists and entries; the game-order switch; 17 Live pages in dropdown folders).
- **Expansions first (owner follow-up):** within A to Z, a name that is or names an expansion sorts by release order first (A Realm Reborn, Heavensward, Stormblood, Shadowbringers, Endwalker, Dawntrail, Evercold), and those names come before everything else in the same list; everything else follows A to Z. Example: Sidequests → A Realm Reborn … Dawntrail, then Hildibrand Adventures. Tests: core 53/53, browser 27/27 (new check: Main Scenario Quests lists in release order).

## Command Center gate 1C — one save, compressed cloud copy, the Atelier's character switcher (2026-11-09)

- **Tests:** core 61/61; browser 28/28; Atelier 13/13; Command Center checks 15/15 (`command-center/evidence/checks.json`).
- **Core, 8 new tests** (Node, on the localStorage fallback):
  - an 8-character save with every field filled is copied into the one save and matches character by character; the old save stays byte for byte the same and is copied only once, even if two windows load at once;
  - "go back" keeps a copy of the current save first, then restores the save from before the move; erasing keeps the old save and the move record;
  - a Tracker save after an Atelier save keeps both;
  - a save written by a newer version is never overwritten;
  - Lists, Submersibles and Atelier sections survive a backup file, a transfer code and a two-device cloud sync;
  - backups and EVT1 codes from before gate 1C, and v1 cloud copies, still load and leave the other sections alone;
  - the cloud copy is compressed, marked version 2, and size-checked in bytes.
- **Browser, 1 new test** (IndexedDB): an 8-character save from before gate 1C is copied in exactly, measured after the Tracker's usual start-up step. The old database is untouched, and "go back" and "It looks right" work.
- **Atelier, 2 new tests:**
  - the one-time question, the switcher keeping each character's stats across a reload, the old key untouched and the Tracker's section untouched;
  - "Not now" asks again next time; with no characters, the Atelier works with one set.
- **Two existing tests changed with the formats:**
  - the transfer-code browser test expects `EVT2-`;
  - the unreadable-data browser test damages the one save, where the data now lives.
- **Six core cloud tests changed the same way:** they read the cloud file through the app's own reader, because the file is now compressed.
- **Size:** a full save (8 characters × 48,652 entries, all ticked) is 8.02 MB as plain text. Its cloud copy, compressed and in base64, is 1.42 MB: 29% of the 5,177,344-byte limit.
- **Not tested here:** Firefox and Safari (gate 1D); real Google Drive and sign-in (gate 1E).

## Submersibles step S2 — fleet board and guided setup (2026-11-11)

- **Tests:** core 73/73; submarines 15/15 (unchanged); helper 5/5; browser 31/31; Command Center checks 30/30 in Chromium (`command-center/evidence/checks.json`). Atelier not run (not touched). Firefox and WebKit not run (not installed in the session).
- **Core, 5 new tests and one changed:**
  - the old prototype-shaped Submersibles sample is replaced by one in the design 7.1 shape (free company, two subs, one trip, preferences); the existing backup, transfer-code and two-device cloud-sync test keeps passing with it, and now also checks that the sample sub's voyage and the trip arrive whole;
  - the checker keeps a good section exactly, and its sector and part lists match `data/submarines.json` id for id;
  - bad fields and entries are dropped, never repaired (character c9, 5 slots, rank 0, 146 or 50.5, parts in the wrong slots or unknown, a voyage with no return time, sea starting points, unknown fields); names capped (free company 40, sub 20, typed time 40); routes at 5 sectors;
  - 15,000 trips (about a year for 32 subs) are all kept by the checker and by a merge;
  - two devices each log a different trip and send a different sub: both arrive on both, with no clash, through the cloud sync and through two pages writing the one save with stale stamps;
  - typed game times ("1d 3h 12m", "27:45", "45 min"; nonsense refused), statuses, countdown rounding and the calendar file (CRLF, folded lines, escaped text, one event, 0-minute alarm).
- **Worked-out times and suggestions (owner's request, same day), 2 more core tests:** the app's stats, range, tanks, experience, rank after and return time equal the five hand-worked voyages to the second; the advisor follows the owner's order (step 1 aims at the next slot sector, levelling when rank stops it; step 2 reveals the most new sectors and does not count another sub's sectors twice; step 3 a reachable community gil route), gives part advice only at step 3, refuses to guess without rank and parts, and every suggestion is a reachable route of 1 to 5 sectors.
- **Game accuracy (owner's request before ship):** a core test pins the formula's three constants to what players measured in the game on the official Square Enix forum (12 hours per voyage, 39.9 minutes per unit of distance at speed 1, 61,600 minutes for an 880-minute survey at speed 1). Not proven here: the game itself for every speed and route, which only the owner's "Check against the game" entries can show (Setup → Accuracy).
- **Command Center, 6 new checks:** C20 the module opens from the shell and directly, not isolated, under the shell's worker, offline after one visit; C21 the guided setup of one free company with four subs end to end, then a rename; C22 a send by tapping a route, a one-press send from the board's suggested-route button, "Check against the game" and the accuracy table, the time worked out with no typing and equal to the formula, the page clock moved past the return (Back with one banner), a reload (no second banner), "Send all back" on each sub's own suggested route (different routes while discovering), two game times in the same minute sharing one banner with the worked-out time kept; C23 the calendar file's time and alarm; C24 390 px with no sideways scrolling on the board, in the sheet and in every setup step; C25 8 free companies x 4 subs inside 1920 x 1080, two columns at 1024 px, sorting by return time. Screenshots `command-center/evidence/submersibles-*.png`.
- **Size:** the module page is about 158 KB with the save and the shared styles; its data is kept compressed (27.8 KB against 84.2 KB plain). The all-in-one offline file (blueprint rule 6) is not built yet, so its measurement waits.
- **Not tested here:** Safari and the phone (the owner's check on the published site); sound (headless browsers play none); the Tracker's and the Atelier's built files still carry the earlier `save.js` until their next build (they keep the section as plain data).

## Submersibles step S3 (rest) — rank after a voyage, size meter (2026-11-12)

- **Tests:** core 74/74 (1 new: the rank and experience after each of the five hand-worked voyages, no change without a route, the top rank holds, the checker keeps the rank evidence); submarines 15/15; helper 5/5; browser 31/31; Command Center checks 30/30 in Chromium (C22 now also checks the rank moving on by the route's base experience when a voyage is logged, the trip's rank evidence, and the size meter). Atelier not run (not touched); Firefox and WebKit not installed.
- **Not tested here:** survey bonuses (the app counts only the base experience, so a rank can be higher in the game; the owner enters it).

## Submersibles step S7 — phone notifications (2026-11-12)

- **Tests:** core 75/75 (1 new: automatic grouping by stage, stragglers, the fixed groupings, quiet hours across midnight and in the day, the checker's new preferences); helper 7/7 (2 new: the push key, only signed-in devices, the schedule's newest-save rule, the minute timer merging alerts of one minute and deleting what it sent, expired addresses forgotten; every message decrypted by an independent reader per RFC 8291 and its VAPID signature verified); submarines 15/15; browser 31/31; Command Center checks 31/31 in Chromium, 1 not run (C26: the page sends the automatic schedule to the real helper code in-process, shows its status and the grouping in force, keeps changed choices; C26b, a real delivery, needs a browser push service the session cannot reach).
- **Not tested here:** a real push to a phone (the owner's "Send a test" after set-up); Safari on iPhone (home-screen app only, by Apple's rule); Cloudflare's live timer.

## Command Center UI round — main Settings, closable windows (2026-11-12)

- **Tests:** core 76/76 (1 new: the settings section's checker); helper 7/7; submarines 15/15; browser 31/31 (the first-run test now checks that a tap outside closes the window and the page offers the set-up again; owner's decision replacing the 2026-11-08 rule); Command Center checks 32/32 in Chromium, 1 not run (C27 new: Settings from the main menu, characters and a free company reaching the Tracker without a first-run window and Submersibles, the night rule kept; C26: the notifications panel first and visible during the guided setup, the link to Settings; C1, C20: the Settings entry in the menu).
- **Not tested here:** the real Microsoft sign-in from the main Settings (the return through tracker/oauth.html is the same page and address as before; the owner's sign-in in the home-screen app is the check); a real push delivery.

## Submersibles step S5 — what came back, the log and earnings (2026-11-12)

- **Tests:** core 76/76; earn 5/5 (new `tests/earn.test.js`: the merchant table covers every item the data names; the better of merchant and market after the 5% tax, rounded down, untradable items merchant only; the route's loot by sector, each item once, the history and "Repeat last"; totals by day, week from Monday, month and all time, per free company, per route with gil per hour, per item, unpriced items left out, the CSV with quoting; the archive and loading it back without duplicates); helper 7/7; submarines 15/15; browser 31/31; Command Center checks 34/34 in Chromium, 1 not run (C29 new: the folded panel, the route's loot by sector, typed and tapped quantities, an item by name, a new sector reaching the free company, the Log reopening a trip to change it, Earnings at stand-in Universalis prices equal to the sum worked out independently, gil per hour with 10 trips, the CSV, the archive file and loading it back, 390 px with no sideways scrolling, the route picker full width).
- **Not tested here:** the real Universalis service (the session reaches no outside site; a stand-in answers in its documented shape: one item, or `items` for several); Safari and the phone (the owner's check).

